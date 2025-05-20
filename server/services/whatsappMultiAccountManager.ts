/**
 * Administrador de múltiples cuentas de WhatsApp
 * Permite gestionar varias instancias de clientes de WhatsApp simultáneamente
 */

import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { Client, Message, MessageMedia } from 'whatsapp-web.js';
import * as qrcode from 'qrcode';
import { IWhatsAppService, WhatsAppStatus, WhatsAppMessage, WhatsAppChat } from './whatsappInterface';
import { storage } from '../storage';
import { whatsappAccounts } from '@shared/schema';
import { convertWhatsAppTimestamp, getTimeZoneConfig } from '../utils/timeZoneDetector';

// Estructura para mantener información de cada cliente
interface WhatsAppInstance {
  id: number;
  name: string;
  client: Client;
  status: WhatsAppStatus;
  sessionPath: string;
  qrCodePath: string;
  connectionTimers: {
    connectionCheck: NodeJS.Timeout | null;
    keepAlive: NodeJS.Timeout | null;
  };
  lastReconnectAttempt: number;
}

// Constantes para manejo de sesiones y reconexión
const TEMP_DIR = path.join(process.cwd(), 'temp');
const ACCOUNTS_DIR = path.join(TEMP_DIR, 'whatsapp-accounts');
const RECONNECT_ATTEMPTS_MAX = 10; // Aumentado para mayor persistencia
const CONNECTION_CHECK_INTERVAL = 3 * 60 * 1000; // 3 minutos
const KEEP_ALIVE_INTERVAL = 20 * 1000; // 20 segundos
const AUTO_RECONNECT_INTERVAL = 60 * 1000; // 1 minuto
const PERMANENT_CONNECTION_ENABLED = true; // Flag para activar conexión permanente

// Asegurarse de que los directorios existan
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}
if (!fs.existsSync(ACCOUNTS_DIR)) {
  fs.mkdirSync(ACCOUNTS_DIR, { recursive: true });
}

/**
 * Clase que administra múltiples cuentas de WhatsApp
 */
class WhatsAppMultiAccountManager extends EventEmitter {
  private instances: Map<number, WhatsAppInstance> = new Map();

  constructor() {
    super();
    // Al iniciar, intentar cargar todas las cuentas activas desde la base de datos
    this.loadAccountsFromDatabase()
      .then(() => console.log('Cuentas de WhatsApp cargadas desde la base de datos'))
      .catch(err => console.error('Error cargando cuentas de WhatsApp:', err));
  }

  /**
   * Carga las cuentas de WhatsApp desde la base de datos e inicializa las que están activas
   */
  private async loadAccountsFromDatabase(): Promise<void> {
    try {
      // Obtener todas las cuentas de WhatsApp
      const accounts = await storage.getAllWhatsappAccounts();
      console.log(`Encontradas ${accounts.length} cuentas de WhatsApp en la base de datos`);

      // Inicializar aquellas que están activas o pendientes de autenticación
      for (const account of accounts) {
        if (account.status === 'active' || account.status === 'pending_auth') {
          console.log(`Inicializando cuenta WhatsApp: ${account.name} (ID: ${account.id})`);
          await this.initializeAccount(account.id);
        }
      }
    } catch (error) {
      console.error('Error cargando cuentas de WhatsApp desde la base de datos:', error);
      throw error;
    }
  }

  /**
   * Obtiene la ruta al ejecutable de Chromium en el sistema
   */
  private getChromiumExecutablePath(): string {
    try {
      const whichChromium = require('child_process').execSync('which chromium').toString().trim();
      if (whichChromium && fs.existsSync(whichChromium)) {
        console.log('Usando Chromium encontrado en:', whichChromium);
        return whichChromium;
      }
    } catch (error) {
      console.warn('No se pudo determinar la ubicación de Chromium mediante "which"');
    }
    
    // Rutas comunes de Chromium en Replit
    const possiblePaths = [
      '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      '/nix/store/x205pbkd5xh5g5iack1dxfcms3cz2549-chromium-108.0.5359.94/bin/chromium',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/nix/store/chromium/bin/chromium'
    ];
    
    for (const path of possiblePaths) {
      if (fs.existsSync(path)) {
        console.log('Usando Chromium encontrado en:', path);
        return path;
      }
    }
    
    throw new Error('No se pudo encontrar el ejecutable de Chromium');
  }

  /**
   * Verifica si una cuenta de WhatsApp existe
   */
  async accountExists(accountId: number): Promise<boolean> {
    try {
      const account = await storage.getWhatsappAccount(accountId);
      return !!account;
    } catch (error) {
      console.error(`Error verificando existencia de cuenta ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Inicializa una cuenta de WhatsApp
   */
  async initializeAccount(accountId: number): Promise<boolean> {
    try {
      // Verificar si la instancia ya existe
      if (this.instances.has(accountId)) {
        console.log(`Cuenta WhatsApp ID ${accountId} ya inicializada`);
        return true;
      }

      // Verificar si la cuenta existe en la base de datos
      const account = await storage.getWhatsappAccount(accountId);
      if (!account) {
        console.error(`Cuenta WhatsApp ID ${accountId} no encontrada en la base de datos`);
        return false;
      }

      // Crear directorios para esta cuenta
      const accountDir = path.join(ACCOUNTS_DIR, `account_${accountId}`);
      if (!fs.existsSync(accountDir)) {
        fs.mkdirSync(accountDir, { recursive: true });
      }

      // Configurar rutas para sesión y código QR
      const sessionPath = path.join(accountDir, 'session');
      const qrCodePath = path.join(accountDir, 'qr.txt');

      // Verificar si hay una sesión existente
      let hasExistingSession = false;
      const sessionStatusFile = path.join(accountDir, 'session_status.json');
      
      try {
        if (fs.existsSync(sessionStatusFile)) {
          const sessionData = JSON.parse(fs.readFileSync(sessionStatusFile, 'utf8'));
          const lastActiveTime = new Date(sessionData.lastCheckedAt || sessionData.activatedAt);
          const timeSinceActive = Date.now() - lastActiveTime.getTime();
          
          // Si la sesión ha estado activa en las últimas 8 horas, intentar recuperarla
          if (timeSinceActive < 8 * 60 * 60 * 1000) {
            console.log(`Sesión existente encontrada para cuenta ID ${accountId}. Intentando recuperar...`);
            hasExistingSession = true;
          } else {
            console.log(`Sesión muy antigua para cuenta ID ${accountId}. Creando nueva sesión...`);
            // Hacer copia de respaldo
            fs.copyFileSync(
              sessionStatusFile, 
              path.join(accountDir, `session_backup_${Date.now()}.json`)
            );
          }
        }
      } catch (err) {
        console.warn(`Error verificando sesión anterior para cuenta ID ${accountId}:`, err);
      }

      // Configuración para puppeteer
      const puppeteerOptions = {
        executablePath: this.getChromiumExecutablePath(),
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
          '--disable-web-security',
          '--ignore-certificate-errors',
          '--disable-features=AudioServiceOutOfProcess',
          '--disable-gl-drawing-for-tests'
        ]
      };

      // Crear nuevo cliente para esta cuenta
      const client = new Client({
        puppeteer: {
          ...puppeteerOptions,
          timeout: 120000,
          ignoreHTTPSErrors: true,
        },
        qrMaxRetries: hasExistingSession ? 5 : 10,
        restartOnAuthFail: true,
        takeoverOnConflict: true,
        authTimeoutMs: 120000,
        takeoverTimeoutMs: 15000
      });

      // Estado inicial
      const status: WhatsAppStatus = {
        initialized: false,
        ready: false,
        authenticated: false,
        error: undefined,
        qrCode: undefined
      };

      // Crear instancia de WhatsApp
      const instance: WhatsAppInstance = {
        id: accountId,
        name: account.name,
        client,
        status,
        sessionPath,
        qrCodePath,
        connectionTimers: {
          connectionCheck: null,
          keepAlive: null
        },
        lastReconnectAttempt: 0
      };

      // Configurar eventos para este cliente
      this.setupClientEvents(instance);

      // Almacenar la instancia
      this.instances.set(accountId, instance);

      // Inicializar el cliente
      console.log(`Iniciando cliente WhatsApp para cuenta ID ${accountId} (${account.name})`);
      await client.initialize();
      
      // Actualizar estado
      instance.status.initialized = true;
      console.log(`Cliente WhatsApp inicializado para cuenta ID ${accountId}`);

      return true;
    } catch (error) {
      console.error(`Error inicializando cuenta WhatsApp ID ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Configura los eventos para un cliente de WhatsApp
   */
  private setupClientEvents(instance: WhatsAppInstance): void {
    const { client, id, name, qrCodePath } = instance;

    // Evento cuando se genera un código QR
    client.on('qr', async (qrText) => {
      console.log(`Nuevo código QR recibido para cuenta ID ${id} (${name})`);
      
      // Guardar QR en archivo
      fs.writeFileSync(qrCodePath, qrText);
      console.log(`Código QR guardado en: ${qrCodePath}`);
      
      try {
        // Generar imagen del QR
        const qrDataUrl = await qrcode.toDataURL(qrText, {
          errorCorrectionLevel: 'H',
          type: 'image/png',
          margin: 4,
          scale: 4,
          color: {
            dark: '#128C7E',
            light: '#FFFFFF'
          }
        });
        
        // Actualizar estado
        instance.status.qrCode = qrText;
        instance.status.qrDataUrl = qrDataUrl;
        instance.status.ready = true;
        
        // Actualizar estado en la base de datos
        await storage.updateWhatsappAccount(id, { 
          status: 'pending_auth',
          sessionData: {
            ...instance.status,
            lastQrGeneratedAt: new Date().toISOString()
          }
        });
        
        // Emitir evento
        this.emit('qr', { 
          accountId: id, 
          accountName: name, 
          qrText, 
          qrDataUrl 
        });
        
      } catch (error) {
        console.error(`Error generando imagen QR para cuenta ID ${id}:`, error);
        instance.status.error = `Error generando imagen QR: ${error instanceof Error ? error.message : 'Error desconocido'}`;
        instance.status.qrCode = qrText;
      }
    });

    // Evento cuando el cliente está listo
    client.on('ready', async () => {
      console.log(`Cliente WhatsApp listo para cuenta ID ${id} (${name})`);
      
      instance.status.ready = true;
      instance.status.authenticated = true;
      instance.status.connectionState = 'CONNECTED';
      instance.status.error = undefined;
      instance.status.qrCode = undefined;
      
      // Actualizar estado en la base de datos
      await storage.updateWhatsappAccount(id, { 
        status: 'active',
        lastActiveAt: new Date(),
        sessionData: {
          ...instance.status,
          lastAuthenticated: new Date().toISOString()
        }
      });
      
      // Actualizar archivo de sesión
      this.updateSessionStatusFile(instance);
      
      // Activar timers de conexión
      this.activatePermanentConnection(instance);
      
      // Emitir evento
      this.emit('ready', { accountId: id, accountName: name });
    });

    // Evento cuando la autenticación falla
    client.on('auth_failure', async (error) => {
      console.error(`Error de autenticación WhatsApp para cuenta ID ${id} (${name}):`, error);
      
      instance.status.authenticated = false;
      instance.status.error = `Error de autenticación: ${error}`;
      
      // Actualizar estado en la base de datos
      await storage.updateWhatsappAccount(id, { 
        status: 'pending_auth',
        sessionData: {
          ...instance.status,
          lastAuthFailure: new Date().toISOString(),
          authFailureReason: error
        }
      });
      
      // Emitir evento
      this.emit('auth_failure', { 
        accountId: id, 
        accountName: name, 
        error 
      });
    });

    // Evento cuando se desconecta
    client.on('disconnected', async (reason) => {
      console.log(`Cliente WhatsApp desconectado para cuenta ID ${id} (${name}): ${reason}`);
      
      instance.status.authenticated = false;
      instance.status.ready = false;
      instance.status.error = `Desconectado: ${reason}`;
      
      // Actualizar estado en la base de datos
      await storage.updateWhatsappAccount(id, { 
        status: 'inactive',
        sessionData: {
          ...instance.status,
          lastDisconnect: new Date().toISOString(),
          disconnectReason: reason
        }
      });
      
      // Desactivar timers
      this.deactivateConnectionTimers(instance);
      
      // Emitir evento
      this.emit('disconnected', { 
        accountId: id, 
        accountName: name, 
        reason 
      });
      
      // Iniciar reconexión automática después de un tiempo
      if (Date.now() - instance.lastReconnectAttempt > 2 * 60 * 1000) { // 2 minutos entre intentos
        instance.lastReconnectAttempt = Date.now();
        console.log(`Iniciando reconexión automática para cuenta ID ${id}...`);
        
        // Esperar un tiempo antes de intentar reconexión
        setTimeout(() => {
          this.attemptConnectionRecovery(id)
            .then(success => {
              if (success) {
                console.log(`Reconexión exitosa para cuenta ID ${id}`);
              } else {
                console.error(`Falló la reconexión para cuenta ID ${id}`);
              }
            })
            .catch(err => {
              console.error(`Error en reconexión para cuenta ID ${id}:`, err);
            });
        }, 5000);
      } else {
        console.log(`Último intento de reconexión hace menos de 2 minutos, esperando...`);
      }
    });

    // Evento cuando se recibe un mensaje
    client.on('message', async (msg) => {
      try {
        // Convertir mensaje al formato interno
        const message = this.convertToWhatsAppMessage(msg);
        
        // Emitir evento
        this.emit('message', { 
          accountId: id, 
          accountName: name, 
          message 
        });
        
        // Importar servicio de respuestas automáticas
        const { autoResponseService } = await import('./autoResponseManager');
        
        // Procesar respuesta automática si está configurada
        if (autoResponseService) {
          console.log(`Procesando mensaje con respuesta automática para cuenta ID ${id}`);
          await autoResponseService.handleIncomingMessage({
            ...msg,
            accountId: id
          });
        }
      } catch (error) {
        console.error(`Error procesando mensaje para cuenta ID ${id}:`, error);
      }
    });
  }

  /**
   * Actualiza el archivo de estado de sesión
   */
  private updateSessionStatusFile(instance: WhatsAppInstance): void {
    try {
      const sessionDir = path.dirname(instance.sessionPath);
      const sessionStatusFile = path.join(sessionDir, 'session_status.json');
      
      const sessionStatus = {
        accountId: instance.id,
        accountName: instance.name,
        activatedAt: new Date().toISOString(),
        lastCheckedAt: new Date().toISOString(),
        status: instance.status
      };
      
      fs.writeFileSync(sessionStatusFile, JSON.stringify(sessionStatus, null, 2));
      console.log(`Archivo de estado de sesión creado en: ${sessionStatusFile}`);
    } catch (error) {
      console.error(`Error actualizando archivo de estado de sesión para cuenta ID ${instance.id}:`, error);
    }
  }

  /**
   * Activa los temporizadores para mantener la conexión permanente
   */
  private activatePermanentConnection(instance: WhatsAppInstance): void {
    // Limpiar timers existentes si los hay
    this.deactivateConnectionTimers(instance);
    
    // Configurar temporizador para verificar la conexión
    instance.connectionTimers.connectionCheck = setInterval(() => {
      this.checkConnection(instance.id)
        .catch(err => console.error(`Error verificando conexión para cuenta ID ${instance.id}:`, err));
    }, CONNECTION_CHECK_INTERVAL);
    
    // Configurar temporizador para mantener viva la conexión
    instance.connectionTimers.keepAlive = setInterval(() => {
      this.keepConnectionAlive(instance.id)
        .catch(err => console.error(`Error en keepAlive para cuenta ID ${instance.id}:`, err));
    }, KEEP_ALIVE_INTERVAL);
    
    console.log(`Timers de conexión permanente configurados para cuenta ID ${instance.id}`);
  }

  /**
   * Desactiva los temporizadores de conexión
   */
  private deactivateConnectionTimers(instance: WhatsAppInstance): void {
    if (instance.connectionTimers.connectionCheck) {
      clearInterval(instance.connectionTimers.connectionCheck);
      instance.connectionTimers.connectionCheck = null;
    }
    
    if (instance.connectionTimers.keepAlive) {
      clearInterval(instance.connectionTimers.keepAlive);
      instance.connectionTimers.keepAlive = null;
    }
  }

  /**
   * Verifica el estado de la conexión
   */
  private async checkConnection(accountId: number): Promise<void> {
    const instance = this.instances.get(accountId);
    if (!instance || !instance.client) return;
    
    try {
      console.log(`Verificando conexión para cuenta ID ${accountId}...`);
      const state = await instance.client.getState();
      
      // Actualizar estado en la instancia
      instance.status.connectionState = state;
      
      if (state === 'CONNECTED') {
        console.log(`Conexión OK para cuenta ID ${accountId}`);
        
        // Actualizar último timestamp de verificación
        this.updateSessionStatusFile(instance);
        
        // Verificar si debemos actualizar el estado en BD
        if (!instance.status.authenticated) {
          instance.status.authenticated = true;
          instance.status.ready = true;
          
          // Actualizar estado en la base de datos
          await storage.updateWhatsappAccount(accountId, { 
            status: 'active',
            lastActiveAt: new Date()
          });
        }
      } else {
        console.log(`Estado actual de la conexión: ${state} para cuenta ID ${accountId}`);
        
        if (state === 'DISCONNECTED') {
          console.log(`No autenticado, verificando conexión...`);
          // Intentar recuperar la conexión
          await this.attemptConnectionRecovery(accountId);
        }
      }
    } catch (error) {
      console.error(`Error verificando conexión para cuenta ID ${accountId}:`, error);
      
      // Si hay un error al verificar el estado, intentar recuperar la conexión
      if (Date.now() - instance.lastReconnectAttempt > 2 * 60 * 1000) {
        console.log(`Intentando recuperar conexión después de error para cuenta ID ${accountId}...`);
        await this.attemptConnectionRecovery(accountId);
      } else {
        console.log(`Último intento de reconexión hace menos de 2 minutos, esperando...`);
      }
    }
  }

  /**
   * Mantiene la conexión activa enviando un mensaje a sí mismo o verificando el estado
   */
  private async keepConnectionAlive(accountId: number): Promise<void> {
    const instance = this.instances.get(accountId);
    if (!instance || !instance.client) {
      if (PERMANENT_CONNECTION_ENABLED) {
        console.log(`[Conexión Permanente] No hay cliente para cuenta ID ${accountId}, intentando inicializar...`);
        try {
          await this.initializeAccount(accountId);
          
          // Guardar en BD que esta cuenta está configurada para conexión permanente
          await storage.updateWhatsappAccount(accountId, {
            status: 'reconnecting',
            sessionData: {
              permanentConnection: true,
              lastReconnectAttempt: new Date().toISOString()
            }
          });
        } catch (err) {
          console.error(`[Conexión Permanente] Error inicializando cuenta ID ${accountId}:`, err);
        }
      }
      return;
    }
    
    try {
      // Verificar estado actual
      const state = await instance.client.getState();
      
      // Actualizar el estado interno
      instance.status.connectionState = state;
      instance.status.lastConnectionCheck = new Date();
      
      // Si está conectado, actualizar el estado en la BD y mantener sesión activa
      if (state === 'CONNECTED') {
        // Marcar como activa en la BD
        await storage.updateWhatsappAccount(accountId, {
          status: 'active',
          sessionData: {
            ...instance.status,
            permanentConnection: PERMANENT_CONNECTION_ENABLED,
            lastActive: new Date().toISOString()
          }
        });
        
        // Realizar una petición sencilla para mantener la sesión activa
        try {
          // Usar getState() que es el método más confiable y está disponible en todas las versiones
          const state = await instance.client.getState();
          console.log(`[Conexión Permanente] Mantener activa cuenta ID ${accountId} - OK (${state})`);
        } catch (pingErr) {
          console.warn(`[Conexión Permanente] Error en ping para cuenta ID ${accountId}:`, pingErr);
        }
        
        return;
      }
      
      // Si no está conectado, intentar recuperar si ha pasado suficiente tiempo
      if (Date.now() - instance.lastReconnectAttempt > AUTO_RECONNECT_INTERVAL) {
        console.log(`[Conexión Permanente] Conexión no activa (${state}) para cuenta ID ${accountId}, intentando recuperar...`);
        await this.attemptConnectionRecovery(accountId);
        
        // Registrar el intento de reconexión
        await storage.updateWhatsappAccount(accountId, {
          status: 'reconnecting',
          sessionData: {
            connectionState: state,
            permanentConnection: PERMANENT_CONNECTION_ENABLED,
            lastReconnectAttempt: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      console.error(`[Conexión Permanente] Error en keepAlive para cuenta ID ${accountId}:`, error);
      
      // Si hay un error en la verificación del estado, probablemente la sesión esté corrupta
      // Intentar reconectar después de un tiempo
      if (Date.now() - instance.lastReconnectAttempt > AUTO_RECONNECT_INTERVAL * 2) {
        console.log(`[Conexión Permanente] Intentando recuperación de emergencia para cuenta ID ${accountId}...`);
        await this.attemptConnectionRecovery(accountId, true);
      }
    }
  }

  /**
   * Intenta recuperar una conexión perdida con estrategia mejorada de persistencia
   * @param accountId ID de la cuenta a recuperar
   * @param forceReinit Si es true, fuerza la reinicialización completa
   */
  private async attemptConnectionRecovery(accountId: number, forceReinit: boolean = false): Promise<boolean> {
    const instance = this.instances.get(accountId);
    if (!instance) return false;
    
    // Actualizar timestamp del último intento
    instance.lastReconnectAttempt = Date.now();
    
    // Registrar el intento en la BD
    try {
      await storage.updateWhatsappAccount(accountId, {
        status: 'reconnecting',
        sessionData: {
          lastReconnectAttempt: new Date().toISOString(),
          permanentConnection: PERMANENT_CONNECTION_ENABLED
        }
      });
    } catch (dbErr) {
      console.error(`[Conexión Permanente] Error actualizando estado de reconexión en BD:`, dbErr);
    }
    
    try {
      // Si el cliente no existe o se fuerza la reinicialización, inicializar uno nuevo
      if (!instance.client || forceReinit) {
        console.log(`[Conexión Permanente] Cliente no existe o reinicio forzado para cuenta ID ${accountId}, inicializando nuevo...`);
        
        // Si hay un cliente existente, intentar cerrarlo limpiamente
        if (instance.client) {
          try {
            await instance.client.destroy();
          } catch (err) {
            console.error(`[Conexión Permanente] Error al cerrar cliente para cuenta ID ${accountId}:`, err);
          }
          
          // Liberar recursos
          instance.client = null;
        }
        
        // Remover instancia si es necesario
        this.instances.delete(accountId);
        
        // Crear nueva instancia
        return await this.initializeAccount(accountId);
      }
      
      // Verificar estado actual
      try {
        const state = await instance.client.getState();
        console.log(`[Conexión Permanente] Estado actual para cuenta ID ${accountId}: ${state}`);
        
        if (state !== 'CONNECTED') {
          // Estrategia progresiva de reconexión
          console.log(`[Conexión Permanente] Intentando recuperación progresiva para cuenta ID ${accountId}...`);
          
          // Paso 1: Intentar resetear el estado
          await instance.client.resetState();
          
          // Verificar nuevamente
          const newState = await instance.client.getState();
          
          if (newState !== 'CONNECTED') {
            // Si sigue sin conectar, intentar el Paso 2: reiniciar la página de WhatsApp
            console.log(`[Conexión Permanente] Reset de estado falló para cuenta ID ${accountId}, intentando reiniciar página...`);
            
            try {
              // Intentar recargar la página de WhatsApp
              if (instance.client.pupPage) {
                await instance.client.pupPage.reload();
                await new Promise(resolve => setTimeout(resolve, 5000)); // Esperar a que cargue
                
                // Verificar nuevamente
                const reloadState = await instance.client.getState().catch(() => 'ERROR');
                
                if (reloadState === 'CONNECTED') {
                  console.log(`[Conexión Permanente] Recarga de página exitosa para cuenta ID ${accountId}`);
                  
                  await storage.updateWhatsappAccount(accountId, {
                    status: 'active',
                    sessionData: {
                      connectionState: 'CONNECTED',
                      lastRecoveryMethod: 'page_reload',
                      lastActive: new Date().toISOString()
                    }
                  });
                  
                  return true;
                }
              }
            } catch (reloadErr) {
              console.error(`[Conexión Permanente] Error recargando página para cuenta ID ${accountId}:`, reloadErr);
            }
            
            // Paso 3: Si todo falla, reinicializar completamente
            console.log(`[Conexión Permanente] Todos los intentos de recuperación fallaron para cuenta ID ${accountId}, reinicializando...`);
            
            // Cerrar cliente existente
            try {
              await instance.client.destroy();
            } catch (err) {
              console.error(`[Conexión Permanente] Error al cerrar cliente para cuenta ID ${accountId}:`, err);
            }
            
            // Remover instancia
            this.instances.delete(accountId);
            
            // Crear nueva instancia
            return await this.initializeAccount(accountId);
          }
          
          console.log(`[Conexión Permanente] Conexión recuperada para cuenta ID ${accountId}`);
          
          await storage.updateWhatsappAccount(accountId, {
            status: 'active',
            sessionData: {
              connectionState: 'CONNECTED',
              lastRecoveryMethod: 'state_reset',
              lastActive: new Date().toISOString()
            }
          });
          
          return true;
        } else {
          // Ya está conectado, actualizar estado en BD
          await storage.updateWhatsappAccount(accountId, {
            status: 'active',
            sessionData: {
              connectionState: 'CONNECTED',
              lastActive: new Date().toISOString()
            }
          });
          
          return true;
        }
      } catch (error) {
        console.error(`[Conexión Permanente] Error verificando estado para cuenta ID ${accountId}:`, error);
        
        // Si no podemos verificar el estado, reinicializar
        try {
          await instance.client.destroy();
        } catch (err) {
          console.error(`Error al cerrar cliente para cuenta ID ${accountId}:`, err);
        }
        
        // Remover instancia
        this.instances.delete(accountId);
        
        // Crear nueva instancia
        return await this.initializeAccount(accountId);
      }
    } catch (error) {
      console.error(`Error recuperando conexión para cuenta ID ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Convierte un mensaje de la librería whatsapp-web.js a nuestro formato interno
   * Ajusta el timestamp para usar la zona horaria local del sistema
   */
  private convertToWhatsAppMessage(message: any): WhatsAppMessage {
    if (!message || !message.id) {
      console.error('Mensaje inválido en convertToWhatsAppMessage');
      return {
        id: 'error',
        body: 'Mensaje inválido',
        from: '',
        to: '',
        fromMe: false,
        timestamp: Date.now(),
        hasMedia: false,
        type: 'error',
        isStatus: false,
        isForwarded: false,
        isStarred: false,
        containsEmoji: false
      };
    }
    
    try {
      // Convertir el timestamp a milisegundos para la zona horaria local
      const timestamp = message.timestamp || Date.now() / 1000;
      const timestampMs = timestamp * 1000; // Convertir a milisegundos
      
      return {
        id: message.id._serialized || message.id,
        body: message.body || '',
        from: message.from || '',
        to: message.to || '',
        fromMe: !!message.fromMe,
        timestamp: timestampMs, // Ya ajustado a milisegundos
        hasMedia: !!message.hasMedia,
        type: message.type || 'unknown',
        isStatus: !!message.isStatus,
        isForwarded: !!message.isForwarded,
        isStarred: !!message.isStarred,
        mediaUrl: undefined, // Se cargará bajo demanda
        caption: message.caption || '',
        containsEmoji: message.body ? /\p{Emoji}/u.test(message.body) : false
      };
    } catch (error) {
      console.error('Error convirtiendo mensaje:', error);
      return {
        id: message.id?._serialized || 'error',
        body: 'Error procesando mensaje',
        from: message.from || '',
        to: message.to || '',
        fromMe: !!message.fromMe,
        timestamp: Date.now(),
        hasMedia: false,
        type: 'error',
        isStatus: false,
        isForwarded: false,
        isStarred: false,
        containsEmoji: false
      };
    }
  }

  /**
   * Obtiene el estado de una cuenta de WhatsApp
   */
  getStatus(accountId: number): WhatsAppStatus {
    const instance = this.instances.get(accountId);
    if (!instance) {
      return {
        initialized: false,
        ready: false,
        authenticated: false,
        error: 'Cuenta no inicializada'
      };
    }
    
    return { ...instance.status };
  }

  /**
   * Envía un mensaje a través de una cuenta de WhatsApp
   */
  async sendMessage(accountId: number, to: string, body: string, options: any = {}): Promise<any> {
    const instance = this.instances.get(accountId);
    if (!instance || !instance.client) {
      throw new Error(`Cuenta WhatsApp ID ${accountId} no inicializada`);
    }
    
    try {
      // Verificar si el cliente está listo
      if (!instance.status.authenticated) {
        throw new Error(`Cliente WhatsApp para cuenta ID ${accountId} no está autenticado`);
      }
      
      // Enviar mensaje
      const result = await instance.client.sendMessage(to, body, options);
      console.log(`Mensaje enviado desde cuenta ID ${accountId} a ${to}: "${body.substring(0, 50)}${body.length > 50 ? '...' : ''}"`);
      
      return result;
    } catch (error) {
      console.error(`Error enviando mensaje desde cuenta ID ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene el código QR más reciente para una cuenta de WhatsApp
   */
  async getLatestQR(accountId: number): Promise<string | null> {
    const instance = this.instances.get(accountId);
    if (!instance) {
      console.error(`Cuenta WhatsApp ID ${accountId} no inicializada`);
      return null;
    }
    
    // Si ya tenemos un código QR, devolverlo
    if (instance.status.qrCode) {
      return instance.status.qrCode;
    }
    
    // Si tenemos un archivo QR, leerlo
    try {
      if (fs.existsSync(instance.qrCodePath)) {
        const qrText = fs.readFileSync(instance.qrCodePath, 'utf8');
        console.log(`Código QR leído de archivo para cuenta ID ${accountId}`);
        return qrText;
      }
    } catch (error) {
      console.error(`Error leyendo archivo QR para cuenta ID ${accountId}:`, error);
    }
    
    // Intentar generar un nuevo QR reinicializando (si no está autenticado)
    if (!instance.status.authenticated) {
      try {
        // Reinicializar para forzar un nuevo QR
        await this.attemptConnectionRecovery(accountId);
        console.log(`Solicitando nuevo QR para cuenta ID ${accountId}`);
        
        // Esperar un momento para que se genere el QR
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Intentar leer el QR generado
        if (fs.existsSync(instance.qrCodePath)) {
          const qrText = fs.readFileSync(instance.qrCodePath, 'utf8');
          return qrText;
        }
      } catch (error) {
        console.error(`Error generando nuevo QR para cuenta ID ${accountId}:`, error);
      }
    }
    
    return null;
  }

  /**
   * Obtiene los chats disponibles para una cuenta de WhatsApp
   */
  async getChats(accountId: number): Promise<WhatsAppChat[]> {
    const instance = this.instances.get(accountId);
    if (!instance || !instance.client) {
      console.log(`No hay cliente disponible para la cuenta ID ${accountId}`);
      return [];
    }
    
    // Verificar estado de la conexión en vez de confiar solo en la bandera de autenticación
    try {
      // Si tenemos una cuenta con ID 1 (Ventas), la manejamos de forma especial
      // ya que sabemos que tiene una configuración que funciona correctamente
      if (accountId === 1) {
        if (!instance.status.authenticated) {
          console.log(`Cliente WhatsApp no autenticado para cuenta ID ${accountId}. No hay datos disponibles.`);
          return [];
        }
      } else {
        // Para el resto de cuentas, intentamos obtener el estado actual
        // y forzamos la autenticación si el cliente responde correctamente
        const state = await instance.client.getState();
        
        if (state === 'CONNECTED') {
          // Si está conectado pero no marcado como autenticado, lo marcamos
          if (!instance.status.authenticated) {
            console.log(`Actualizando estado de autenticación para cuenta ID ${accountId}`);
            instance.status.authenticated = true;
            instance.status.ready = true;
            // Guardar estado actualizado
            this.updateSessionStatusFile(instance);
          }
        } else if (!instance.status.authenticated) {
          console.log(`Cliente WhatsApp no autenticado para cuenta ID ${accountId}. Estado: ${state}`);
          return [];
        }
      }
    } catch (err) {
      // Si hay error al verificar el estado pero la cuenta está marcada como autenticada,
      // permitimos continuar para ser consistente con la cuenta de ventas
      if (!instance.status.authenticated) {
        console.log(`Cliente WhatsApp no autenticado para cuenta ID ${accountId}. No hay datos disponibles.`);
        return [];
      }
    }
    
    try {
      // Obtener chats del cliente
      console.log(`Obteniendo chats para cuenta ID ${accountId}...`);
      const chats = await instance.client.getChats();
      
      // Convertir chats a nuestro formato
      const result: WhatsAppChat[] = [];
      
      for (const chat of chats) {
        try {
          // Extraer datos básicos con manejo mejorado para prevenir errores de tipo
          let chatId = '';
          try {
            // Manejar diferentes formatos de ID
            if (typeof chat.id === 'object' && chat.id !== null && '_serialized' in chat.id) {
              chatId = chat.id._serialized;
            } else if (chat.id) {
              chatId = String(chat.id);
            } else {
              chatId = `chat-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            }
          } catch (e) {
            console.warn(`Error al obtener ID del chat para cuenta ${accountId}:`, e);
            chatId = `chat-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          }

          // Crear objeto de chat con valores seguros
          const chatInfo: WhatsAppChat = {
            id: chatId,
            name: chat.name || '',
            isGroup: !!chat.isGroup,
            timestamp: chat.timestamp || Date.now(),
            unreadCount: chat.unreadCount || 0,
            lastMessage: '',
            profilePicUrl: undefined,
            participants: []
          };
          
          // Obtener el último mensaje de forma segura
          try {
            if (chat.lastMessage && typeof chat.lastMessage === 'object') {
              chatInfo.lastMessage = chat.lastMessage.body || '';
            }
          } catch (e) {
            console.warn(`Error al obtener último mensaje para chat ${chatId}:`, e);
          }
          
          // Obtener participantes de forma segura
          try {
            if (chat.participants && Array.isArray(chat.participants)) {
              chatInfo.participants = chat.participants.map((p: any) => {
                try {
                  if (p && typeof p === 'object' && p.id) {
                    if (typeof p.id === 'object' && '_serialized' in p.id) {
                      return p.id._serialized;
                    } else {
                      return String(p.id);
                    }
                  }
                  return '';
                } catch (e) {
                  return '';
                }
              }).filter(id => id); // Filtrar IDs vacíos
            }
          } catch (e) {
            console.warn(`Error al obtener participantes para chat ${chatId}:`, e);
          }
          
          // Intentar obtener foto de perfil si no es un grupo
          try {
            if (!chat.isGroup) {
              const profilePicUrl = await instance.client.getProfilePicUrl(chat.id._serialized || chat.id);
              if (profilePicUrl) {
                chatInfo.profilePicUrl = profilePicUrl;
              }
            }
          } catch (picError) {
            // Ignorar errores al obtener foto de perfil
          }
          
          result.push(chatInfo);
        } catch (chatError) {
          console.error(`Error procesando chat para cuenta ID ${accountId}:`, chatError);
        }
      }
      
      console.log(`Obtenidos ${result.length} chats para cuenta ID ${accountId}`);
      return result;
    } catch (error) {
      console.error(`Error obteniendo chats para cuenta ID ${accountId}:`, error);
      return [];
    }
  }

  /**
   * Obtiene los mensajes de un chat para una cuenta de WhatsApp
   */
  async getChatMessages(accountId: number, chatId: string, limit: number = 50): Promise<WhatsAppMessage[]> {
    const instance = this.instances.get(accountId);
    if (!instance || !instance.client) {
      throw new Error(`Cuenta WhatsApp ID ${accountId} no inicializada`);
    }
    
    // Verificar si el cliente está autenticado
    if (!instance.status.authenticated) {
      throw new Error(`Cliente WhatsApp para cuenta ID ${accountId} no está autenticado`);
    }
    
    try {
      // Obtener el chat
      const chat = await instance.client.getChatById(chatId);
      
      // Obtener mensajes
      const messages = await chat.fetchMessages({ limit });
      
      // Convertir mensajes a nuestro formato
      return messages.map(msg => this.convertToWhatsAppMessage(msg));
    } catch (error) {
      console.error(`Error obteniendo mensajes para chat ${chatId} (cuenta ID ${accountId}):`, error);
      throw error;
    }
  }

  /**
   * Desconecta una cuenta de WhatsApp
   */
  async disconnectAccount(accountId: number): Promise<boolean> {
    const instance = this.instances.get(accountId);
    if (!instance || !instance.client) {
      console.log(`No hay cliente para desconectar en cuenta ID ${accountId}`);
      return false;
    }
    
    try {
      // Desactivar timers
      this.deactivateConnectionTimers(instance);
      
      // Destruir cliente
      await instance.client.destroy();
      console.log(`Cliente WhatsApp desconectado para cuenta ID ${accountId}`);
      
      // Eliminar instancia
      this.instances.delete(accountId);
      
      // Actualizar estado en la base de datos
      await storage.updateWhatsappAccount(accountId, { 
        status: 'inactive',
        sessionData: {
          disconnectedAt: new Date().toISOString(),
          disconnectedBy: 'user'
        }
      });
      
      return true;
    } catch (error) {
      console.error(`Error desconectando cuenta WhatsApp ID ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Obtiene información resumida de todas las cuentas activas
   */
  getActiveAccounts(): { id: number, name: string, status: string }[] {
    const result = [];
    
    for (const [id, instance] of this.instances.entries()) {
      result.push({
        id,
        name: instance.name,
        status: instance.status.authenticated ? 'active' : 
               instance.status.qrCode ? 'pending_auth' : 'inactive'
      });
    }
    
    return result;
  }

  /**
   * Limpia una sesión de WhatsApp específica completamente
   * Desconecta, elimina archivos de sesión y actualiza la base de datos
   */
  async clearWhatsAppSession(accountId: number): Promise<boolean> {
    try {
      console.log(`Limpiando sesión para cuenta de WhatsApp ID ${accountId}...`);
      
      // 1. Desconectar la cuenta si está activa
      const instance = this.instances.get(accountId);
      if (instance) {
        try {
          // Desactivar timers de conexión
          this.deactivateConnectionTimers(instance);
          
          // Intentar destruir el cliente
          if (instance.client) {
            await instance.client.destroy()
              .catch(err => console.error(`Error al destruir cliente para cuenta ID ${accountId}:`, err));
          }
          
          // Eliminar instancia del mapa
          this.instances.delete(accountId);
          console.log(`Cliente desconectado para cuenta ID ${accountId}`);
        } catch (disconnectErr) {
          console.error(`Error desconectando cuenta ID ${accountId}:`, disconnectErr);
          // Continuar con la limpieza aunque falle la desconexión
        }
      }
      
      // 2. Eliminar archivos de sesión
      try {
        // Eliminar archivos específicos de la cuenta
        const accountDir = path.join(ACCOUNTS_DIR, `account_${accountId}`);
        if (fs.existsSync(accountDir)) {
          const files = fs.readdirSync(accountDir);
          for (const file of files) {
            fs.unlinkSync(path.join(accountDir, file));
          }
          console.log(`Eliminados ${files.length} archivos de sesión para cuenta ID ${accountId}`);
        }
      } catch (fileErr) {
        console.error(`Error eliminando archivos de cuenta ID ${accountId}:`, fileErr);
      }
      
      // 3. Actualizar estado en la base de datos
      await storage.updateWhatsappAccount(accountId, {
        status: 'inactive',
        sessionData: {
          connectionState: 'DISCONNECTED',
          disconnectedAt: new Date().toISOString(),
          disconnectedBy: 'user_forced',
          sessionCleared: true
        }
      });
      
      console.log(`Sesión completamente limpiada para cuenta ID ${accountId}`);
      return true;
    } catch (error) {
      console.error(`Error limpiando sesión para cuenta ID ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Limpia todas las sesiones de WhatsApp (desconecta y elimina los archivos de sesión)
   */
  async cleanAllSessions(): Promise<boolean> {
    try {
      console.log("Iniciando limpieza completa de todas las sesiones de WhatsApp...");
      
      // 1. Desconectar todas las instancias activas
      const activeInstanceIds = Array.from(this.instances.keys());
      for (const accountId of activeInstanceIds) {
        try {
          console.log(`Desconectando instancia WhatsApp ID ${accountId}...`);
          await this.disconnectAccount(accountId);
        } catch (err) {
          console.error(`Error desconectando instancia WhatsApp ID ${accountId}:`, err);
          // Continuar con las demás desconexiones aunque falle alguna
        }
      }
      
      // 2. Limpiar mapa de instancias
      this.instances.clear();
      
      // 3. Eliminar archivos de sesión
      try {
        const tempDir = path.join(process.cwd(), 'temp');
        const sessionPath = path.join(tempDir, 'whatsapp-sessions');
        
        // Eliminar archivos en el directorio de sesiones
        if (fs.existsSync(sessionPath)) {
          const files = fs.readdirSync(sessionPath);
          for (const file of files) {
            fs.unlinkSync(path.join(sessionPath, file));
          }
          console.log(`Eliminados ${files.length} archivos de sesión de WhatsApp`);
        }
        
        // Limpiar directorios de cuentas individuales
        if (fs.existsSync(ACCOUNTS_DIR)) {
          const accountDirs = fs.readdirSync(ACCOUNTS_DIR);
          for (const dir of accountDirs) {
            const fullPath = path.join(ACCOUNTS_DIR, dir);
            if (fs.statSync(fullPath).isDirectory()) {
              // Eliminar archivos en cada subdirectorio de cuenta
              const accountFiles = fs.readdirSync(fullPath);
              for (const file of accountFiles) {
                fs.unlinkSync(path.join(fullPath, file));
              }
            }
          }
          console.log(`Limpiados ${accountDirs.length} directorios de cuentas de WhatsApp`);
        }
      } catch (fileErr) {
        console.error("Error eliminando archivos de sesión:", fileErr);
      }
      
      // 4. Actualizar estado en la base de datos
      try {
        const accounts = await storage.getAllWhatsappAccounts();
        for (const account of accounts) {
          await storage.updateWhatsappAccount(account.id, {
            status: 'inactive',
            sessionData: {
              connectionState: 'DISCONNECTED',
              disconnectedAt: new Date().toISOString(),
              disconnectedBy: 'admin_forced',
              sessionCleared: true
            }
          });
        }
        console.log(`Actualizados ${accounts.length} registros de cuentas en la base de datos`);
      } catch (dbErr) {
        console.error("Error actualizando estado en la base de datos:", dbErr);
      }
      
      console.log("Limpieza completa de sesiones de WhatsApp finalizada");
      return true;
    } catch (error) {
      console.error("Error en proceso de limpieza de sesiones:", error);
      return false;
    }
  }
}

// Exportar instancia única
export const whatsappMultiAccountManager = new WhatsAppMultiAccountManager();