/**
 * Administrador de múltiples cuentas de WhatsApp
 * Versión optimizada para códigos QR en producción
 */
import { EventEmitter } from 'events';
import whatsappWebJS from 'whatsapp-web.js';
const { Client, LocalAuth } = whatsappWebJS;
import fs from 'fs';
import path from 'path';
import qrcode from 'qrcode';
import { storage } from '../storage';
import { improvedQRManager } from '../utils/improvedQRManager';

interface WhatsAppStatus {
  initialized: boolean;
  ready: boolean;
  authenticated: boolean;
  error?: string;
  qrCode?: string;
  qrDataUrl?: string;
  pingStatus?: {
    isActive: boolean;
    lastPing: number;
    pingCount: number;
    nextPing: number;
  };
}

interface WhatsAppInstance {
  id: number;
  name: string;
  client: any;
  status: WhatsAppStatus;
  sessionPath: string;
  qrCodePath: string;
  connectionTimers: {
    connectionCheck: NodeJS.Timeout | null;
    keepAlive: NodeJS.Timeout | null;
  };
  lastReconnectAttempt: number;
}

interface WhatsAppMessage {
  id: string;
  body: string;
  from: string;
  to: string;
  timestamp: number;
  fromMe: boolean;
  isGroup: boolean;
  chatId: string;
}

interface WhatsAppChat {
  id: string;
  name: string;
  isGroup: boolean;
  isReadOnly: boolean;
  unreadCount: number;
  lastMessage?: {
    body: string;
    timestamp: number;
  };
}

/**
 * Clase que administra múltiples cuentas de WhatsApp con QR mejorado para producción
 */
class WhatsAppMultiAccountManager extends EventEmitter {
  private instances: Map<number, WhatsAppInstance> = new Map();
  private qrCodeCache: Map<number, { text: string; dataUrl: string; generatedAt: number }> = new Map();

  constructor() {
    super();
    this.loadAccountsFromDatabase();
    
    // Limpiar cache cada 10 minutos
    setInterval(() => {
      this.cleanExpiredQRCache();
    }, 10 * 60 * 1000);
  }

  /**
   * Valida si un código QR es válido para WhatsApp
   */
  private isValidQRCode(qrText: string): boolean {
    if (!qrText || typeof qrText !== 'string') {
      return false;
    }
    
    // Los códigos QR de WhatsApp tienen un formato específico
    const isValidFormat = qrText.length > 20 && (
      qrText.startsWith('1@') || 
      qrText.startsWith('2@') ||
      qrText.includes('@')
    );
    
    return isValidFormat;
  }

  /**
   * Método para refrescar conexión sin desconectar completamente
   */
  async refreshConnection(accountId: number): Promise<void> {
    const instance = this.instances.get(accountId);
    if (!instance) {
      console.log(`❌ No existe instancia para cuenta ${accountId}`);
      return;
    }

    try {
      console.log(`🔄 Refrescando conexión para cuenta ${accountId}...`);
      
      // Limpiar timers existentes
      if (instance.connectionTimers.keepAlive) {
        clearInterval(instance.connectionTimers.keepAlive);
        instance.connectionTimers.keepAlive = null;
      }

      // Verificar si el cliente sigue conectado
      if (instance.client && instance.status.authenticated) {
        // Refresh interno sin desconectar
        try {
          await instance.client.pupPage?.reload({ waitUntil: 'networkidle0' });
          console.log(`✅ Página refrescada para cuenta ${accountId}`);
        } catch (reloadError) {
          console.log(`⚠️ Error refrescando página, continuando...`);
        }
      }

      // Reiniciar keep-alive con intervalo optimizado
      this.startKeepAlive(instance);
      
      instance.status.error = undefined;
      instance.lastReconnectAttempt = Date.now();
      
      console.log(`✅ Conexión refrescada exitosamente - Cuenta ${accountId}`);
    } catch (error) {
      console.error(`❌ Error refrescando conexión cuenta ${accountId}:`, error);
    }
  }

  /**
   * Método para reconectar una cuenta específica
   */
  async reconnectAccount(accountId: number): Promise<void> {
    const instance = this.instances.get(accountId);
    if (!instance) {
      console.log(`❌ No existe instancia para cuenta ${accountId}`);
      return;
    }

    try {
      console.log(`🔄 Reconectando cuenta ${accountId}...`);
      
      // Verificar si ya está conectado
      if (instance.status.authenticated && instance.status.ready) {
        console.log(`✅ Cuenta ${accountId} ya está conectada`);
        return;
      }

      // Limpiar estado anterior
      this.clearConnectionTimers(accountId);
      
      // Intentar reconexión suave primero
      if (instance.client) {
        try {
          const state = await instance.client.getState();
          if (state === 'CONNECTED') {
            instance.status.authenticated = true;
            instance.status.ready = true;
            instance.status.error = undefined;
            this.startKeepAlive(instance);
            console.log(`✅ Reconexión suave exitosa - Cuenta ${accountId}`);
            return;
          }
        } catch (stateError) {
          console.log(`⚠️ Estado no disponible, continuando con reconexión completa...`);
        }
      }

      // Si reconexión suave falla, reinicializar cliente
      await this.initializeAccount(accountId);
      
      console.log(`✅ Reconexión completa exitosa - Cuenta ${accountId}`);
    } catch (error) {
      console.error(`❌ Error reconectando cuenta ${accountId}:`, error);
      
      // Marcar como desconectado pero mantener instancia
      instance.status.authenticated = false;
      instance.status.ready = false;
      instance.status.error = error.message;
    }
  }

  /**
   * Limpiar timers de conexión para una cuenta
   */
  private clearConnectionTimers(accountId: number): void {
    const instance = this.instances.get(accountId);
    if (!instance) return;

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
   * Genera una imagen optimizada del código QR para producción
   */
  private async generateQRImage(qrText: string): Promise<string> {
    try {
      const qrDataUrl = await qrcode.toDataURL(qrText, {
        errorCorrectionLevel: 'H', // Máxima corrección de errores
        type: 'image/png',
        margin: 2,
        scale: 8, // Escala alta para mejor calidad
        width: 400, // Tamaño fijo para consistencia
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      return qrDataUrl;
    } catch (error) {
      console.error('Error generando imagen QR:', error);
      throw new Error('No se pudo generar la imagen del código QR');
    }
  }

  /**
   * Almacena un código QR en cache con validación
   */
  private cacheQRCode(accountId: number, qrText: string, dataUrl?: string): boolean {
    try {
      if (!this.isValidQRCode(qrText)) {
        console.warn(`Código QR inválido para cuenta ${accountId}: ${qrText.substring(0, 50)}...`);
        return false;
      }

      this.qrCodeCache.set(accountId, {
        text: qrText,
        dataUrl: dataUrl || '',
        generatedAt: Date.now()
      });

      console.log(`Código QR almacenado en cache para cuenta ${accountId}`);
      return true;
    } catch (error) {
      console.error(`Error almacenando QR en cache para cuenta ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Obtiene un código QR desde el cache si es válido y no muy antiguo
   */
  private getCachedQR(accountId: number): { text: string; dataUrl: string; generatedAt: number } | null {
    try {
      const cached = this.qrCodeCache.get(accountId);
      if (!cached) {
        return null;
      }

      // Verificar si no es muy antiguo (máximo 20 minutos para reducir frecuencia)
      const maxAge = 20 * 60 * 1000; // 20 minutos
      if (Date.now() - cached.generatedAt > maxAge) {
        this.qrCodeCache.delete(accountId);
        console.log(`Cache QR expirado para cuenta ${accountId}, eliminando`);
        return null;
      }

      // Verificar si sigue siendo válido
      if (!this.isValidQRCode(cached.text)) {
        this.qrCodeCache.delete(accountId);
        console.log(`Cache QR inválido para cuenta ${accountId}, eliminando`);
        return null;
      }

      return cached;
    } catch (error) {
      console.error(`Error obteniendo QR desde cache para cuenta ${accountId}:`, error);
      return null;
    }
  }

  /**
   * Guarda el código QR en archivo de manera segura
   */
  private saveQRToFile(qrText: string, filePath: string): boolean {
    try {
      // Verificar que el directorio existe
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Guardar con validación
      if (this.isValidQRCode(qrText)) {
        fs.writeFileSync(filePath, qrText, 'utf8');
        console.log(`Código QR guardado en: ${filePath}`);
        return true;
      } else {
        console.warn(`No se guardó código QR inválido en: ${filePath}`);
        return false;
      }
    } catch (error) {
      console.error(`Error guardando QR en archivo ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Lee un código QR desde archivo con validación
   */
  private readQRFromFile(filePath: string): string | null {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const qrText = fs.readFileSync(filePath, 'utf8').trim();
      
      if (this.isValidQRCode(qrText)) {
        return qrText;
      } else {
        console.warn(`Código QR inválido leído desde archivo: ${filePath}`);
        return null;
      }
    } catch (error) {
      console.error(`Error leyendo QR desde archivo ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Limpia códigos QR expirados del cache
   */
  private cleanExpiredQRCache(): number {
    let cleaned = 0;
    const now = Date.now();
    const maxAge = 20 * 60 * 1000; // 20 minutos - tiempo extendido para conexión
    
    Array.from(this.qrCodeCache.entries()).forEach(([accountId, qrData]) => {
      if (now - qrData.generatedAt > maxAge) {
        this.qrCodeCache.delete(accountId);
        cleaned++;
      }
    });
    
    if (cleaned > 0) {
      console.log(`Limpiados ${cleaned} códigos QR expirados del cache`);
    }
    
    return cleaned;
  }

  /**
   * Carga las cuentas de WhatsApp desde la base de datos
   */
  private async loadAccountsFromDatabase(): Promise<void> {
    try {
      const accounts = await storage.getAllWhatsappAccounts();
      console.log(`Encontradas ${accounts.length} cuentas de WhatsApp en la base de datos`);
      
      for (const account of accounts) {
        if (account.status === 'active' || account.status === 'pending_auth') {
          console.log(`Inicializando cuenta WhatsApp: ${account.name} (ID: ${account.id})`);
          await this.initializeAccount(account.id);
        }
      }
      
      console.log('Cuentas de WhatsApp cargadas desde la base de datos');
    } catch (error) {
      console.error('Error cargando cuentas desde la base de datos:', error);
    }
  }

  /**
   * Obtiene la ruta al ejecutable de Chromium
   */
  private getChromiumExecutablePath(): string {
    const possiblePaths = [
      '/nix/store/*/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/google-chrome',
      '/snap/bin/chromium'
    ];

    for (const pathPattern of possiblePaths) {
      try {
        if (pathPattern.includes('*')) {
          const { globSync } = require('glob');
          const matches = globSync(pathPattern);
          if (matches.length > 0 && fs.existsSync(matches[0])) {
            console.log(`Chromium encontrado en: ${matches[0]}`);
            return matches[0];
          }
        } else if (fs.existsSync(pathPattern)) {
          console.log(`Chromium encontrado en: ${pathPattern}`);
          return pathPattern;
        }
      } catch (error) {
        continue;
      }
    }

    // Buscar usando which
    try {
      const { execSync } = require('child_process');
      const whichResult = execSync('which chromium', { encoding: 'utf8' }).trim();
      if (whichResult && fs.existsSync(whichResult)) {
        console.log(`Chromium encontrado mediante which: ${whichResult}`);
        return whichResult;
      }
    } catch (error) {
      console.log('No se pudo determinar la ubicación de Chromium mediante "which"');
    }

    // Buscar en el sistema Nix específicamente
    try {
      const { execSync } = require('child_process');
      const findResult = execSync('find /nix/store -name chromium -type f 2>/dev/null | head -1', { encoding: 'utf8' }).trim();
      if (findResult && fs.existsSync(findResult)) {
        console.log(`Usando Chromium encontrado en: ${findResult}`);
        return findResult;
      }
    } catch (error) {
      // Continúa con el path por defecto
    }

    console.log('Usando path por defecto de Chromium');
    return '/usr/bin/chromium-browser';
  }

  /**
   * Verifica si una cuenta existe
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
   * Inicializa una cuenta de WhatsApp con QR mejorado
   */
  async initializeAccount(accountId: number): Promise<boolean> {
    try {
      if (this.instances.has(accountId)) {
        console.log(`Cuenta WhatsApp ID ${accountId} ya está inicializada`);
        return true;
      }

      const account = await storage.getWhatsappAccount(accountId);
      if (!account) {
        console.error(`Cuenta WhatsApp ID ${accountId} no encontrada en la base de datos`);
        return false;
      }

      // Configurar rutas
      const baseDir = path.join(process.cwd(), 'temp', 'whatsapp-accounts', `account_${accountId}`);
      const sessionPath = path.join(baseDir, 'session');
      const qrCodePath = path.join(baseDir, 'qr.txt');

      // Crear directorios
      if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
      }

      const chromiumPath = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';
      const hasExistingSession = fs.existsSync(sessionPath);

      const puppeteerOptions = {
        executablePath: chromiumPath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-gpu',
          '--disable-extensions',
          '--no-first-run',
          '--disable-default-apps',
          '--disable-background-networking',
          '--disable-features=AudioServiceOutOfProcess',
          '--disable-gl-drawing-for-tests'
        ]
      };

      // Crear cliente WhatsApp con configuración de persistencia mejorada
      const client = new Client({
        authStrategy: new LocalAuth({
          clientId: `account_${accountId}`,
          dataPath: sessionPath
        }),
        puppeteer: {
          ...puppeteerOptions,
          timeout: 180000, // Increased timeout
          ignoreHTTPSErrors: true,
        },
        qrMaxRetries: 999, // Maximum retries to prevent disconnection
        restartOnAuthFail: true,
        takeoverOnConflict: true,
        authTimeoutMs: 0, // No timeout to maintain connection
        takeoverTimeoutMs: 30000, // 30 segundos para takeover más rápido
        webVersionCache: {
          type: 'remote',
          remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
        }
      });

      // Estado inicial
      const status: WhatsAppStatus = {
        initialized: false,
        ready: false,
        authenticated: false,
        error: undefined,
        qrCode: undefined
      };

      // Crear instancia
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

      // Configurar eventos mejorados para QR
      this.setupClientEvents(instance);

      // Almacenar instancia
      this.instances.set(accountId, instance);

      // Inicializar cliente
      console.log(`Iniciando cliente WhatsApp para cuenta ID ${accountId} (${account.name})`);
      await client.initialize();
      
      instance.status.initialized = true;
      console.log(`Cliente WhatsApp inicializado para cuenta ID ${accountId}`);

      return true;
    } catch (error) {
      console.error(`Error inicializando cuenta WhatsApp ID ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Configura eventos para un cliente con QR mejorado para producción
   */
  private setupClientEvents(instance: WhatsAppInstance): void {
    const { client, id, name, qrCodePath } = instance;

    // Evento QR mejorado con control de timing
    client.on('qr', async (qr) => {
      try {
        // Verificar si ya tenemos un QR válido reciente (evitar regeneración frecuente)
        const cached = this.getCachedQR(id);
        if (cached && Date.now() - cached.generatedAt < 15 * 60 * 1000) { // 15 minutos
          console.log(`⏭️ QR reciente ya disponible para cuenta ${id}, omitiendo regeneración`);
          return;
        }

        console.log(`📱 Código QR recibido para cuenta ${id}: ${qr.substring(0, 50)}...`);
        
        // Validar formato del código QR
        if (qr && qr.startsWith('2@')) {
          // Usar el gestor mejorado de QR
          await improvedQRManager.generateQRCode(id, qr);
          
          const remainingMinutes = improvedQRManager.getRemainingValidityMinutes(id);
          console.log(`✅ Código QR generado para cuenta ${id} (válido por ${remainingMinutes} minutos)`);
          
          // Mantener compatibilidad con el cache actual con timestamp actualizado
          this.qrCodeCache.set(id, {
            text: qr,
            dataUrl: await this.generateQRImage(qr),
            generatedAt: Date.now()
          });
        } else {
          console.warn(`⚠ Código QR inválido recibido para cuenta ${id}`);
        }
      } catch (error) {
        console.error(`❌ Error procesando código QR para cuenta ${id}:`, error);
      }
    });

    // Evento de autenticación exitosa
    client.on('authenticated', () => {
      console.log(`✅ Cuenta WhatsApp ${id} (${name}) autenticada correctamente`);
      console.log(`🔔 Activando listeners de mensajes para cuenta ${id}`);
      instance.status.authenticated = true;
      instance.status.qrCode = undefined;
      instance.status.ready = true;
      
      // Limpiar cache de QR
      this.qrCodeCache.delete(id);
      
      // ✨ ACTIVAR CONEXIÓN PERMANENTE AUTOMÁTICAMENTE ✨
      console.log(`🛡️ Iniciando conexión PERMANENTE para cuenta ${id} (${name})`);
      this.activatePermanentConnection(instance);
    });

    // Evento cuando está listo
    client.on('ready', () => {
      console.log(`Cliente WhatsApp ${id} (${name}) listo para usar`);
      instance.status.ready = true;
      this.activatePermanentConnection(instance);
    });

    // Evento de desconexión con sistema de recuperación de sesión
    client.on('disconnected', async (reason) => {
      console.log(`🚨 Cliente WhatsApp ${id} (${name}) desconectado: ${reason}`);
      instance.status.authenticated = false;
      instance.status.ready = false;
      
      // Solo usar recuperación para LOGOUT - otros tipos no necesitan recuperación
      if (reason === 'LOGOUT') {
        console.log(`🔄 Iniciando recuperación de sesión para cuenta ${id} (${name})`);
        
        try {
          const { sessionRecovery } = await import('./whatsappSessionRecovery');
          const recoveryResult = await sessionRecovery.attemptRecovery(id);
          
          if (recoveryResult === 'recovered') {
            console.log(`✅ Sesión recuperada para cuenta ${id}, lista para nueva conexión`);
            // No intentar reconexión automática - esperar que el usuario use el QR
          } else if (recoveryResult === 'cleanup_needed') {
            console.log(`🧹 Limpieza de sesión completada para cuenta ${id}`);
            await sessionRecovery.cleanupSession(id);
            console.log(`⏳ Cuenta ${id} preparada para nueva autenticación con QR`);
          } else {
            console.log(`❌ Recuperación fallida para cuenta ${id}, requiere limpieza manual`);
            await sessionRecovery.cleanupSession(id);
          }
        } catch (error) {
          console.error(`❌ Error en recuperación de sesión para cuenta ${id}:`, error);
          // Como respaldo, limpiar la sesión
          try {
            const { sessionRecovery } = await import('./whatsappSessionRecovery');
            await sessionRecovery.cleanupSession(id);
          } catch (cleanupError) {
            console.error(`❌ Error en limpieza de respaldo:`, cleanupError);
          }
        }
      } else {
        console.log(`ℹ️ Desconexión por ${reason} - no requiere recuperación de sesión`);
      }
      
      // Limpiar timers de keep-alive para evitar intentos fallidos
      if (instance.connectionTimers.keepAlive) {
        clearInterval(instance.connectionTimers.keepAlive);
        instance.connectionTimers.keepAlive = null;
      }
    });

    // Evento de mensajes entrantes para sistema de tickets y análisis AI
    client.on('message', async (message) => {
      try {
        console.log(`🔔 EVENTO MESSAGE ACTIVADO en cuenta ${id}`);
        console.log(`📊 Datos del mensaje:`, {
          fromMe: message.fromMe,
          type: message.type,
          hasMedia: message.hasMedia,
          body: message.body?.substring(0, 50) || '[Sin texto]',
          chatId: message.from
        });
        
        // DEBUGGING: Verificar si llegó un mensaje real
        if (!message.fromMe) {
          console.log(`🚨 MENSAJE REAL ENTRANTE DETECTADO - Cuenta ${id}`);
          console.log(`📱 Chat: ${message.from}, Mensaje: "${message.body}"`);
        }
        
        // Almacenar conversación para análisis AI
        await this.storeConversationForAnalysis(id, message);
        
        // Solo procesar mensajes entrantes (no enviados por nosotros)
        // Validación estricta: debe ser fromMe=false Y el chat debe ser diferente al número de la cuenta
        if (!message.fromMe && message.from !== client.info?.wid?._serialized) {
          console.log(`📨 Nuevo mensaje ENTRANTE recibido en cuenta ${id}: ${message.body?.substring(0, 50) || '[Sin texto]'}...`);
          console.log(`🔍 Tipo de mensaje: ${message.type}, hasMedia: ${message.hasMedia}`);
          
          let messageBody = message.body || '';
          
          // Transcripción automática de notas de voz
          // Detectar múltiples tipos de audio de WhatsApp
          const isVoiceMessage = message.type === 'ptt' || 
                                 message.type === 'audio';
          
          console.log(`🎵 ¿Es mensaje de voz? ${isVoiceMessage} (tipo: ${message.type}, hasMedia: ${message.hasMedia})`);
          
          if (isVoiceMessage) {
            console.log(`🎤 NOTA DE VOZ DETECTADA (tipo: ${message.type}), iniciando transcripción automática...`);
            
            try {
              const media = await message.downloadMedia();
              if (media) {
                // Importar el servicio de almacenamiento de notas de voz
                const { voiceNoteStorage } = await import('./voiceNoteStorage');
                
                // Convertir el archivo de audio a buffer
                const audioBuffer = Buffer.from(media.data, 'base64');
                
                // Guardar la nota de voz con transcripción automática
                const voiceNote = await voiceNoteStorage.saveVoiceNote(
                  message.id._serialized,
                  message.from,
                  id,
                  audioBuffer,
                  message.timestamp * 1000
                );
                
                if (voiceNote && voiceNote.transcription) {
                  console.log(`✅ Nota de voz guardada y transcrita: "${voiceNote.transcription}"`);
                  messageBody = voiceNote.transcription;
                  
                  // Emitir evento de transcripción para la interfaz
                  setTimeout(() => {
                    this.emit('transcription_complete', {
                      chatId: message.from,
                      accountId: id,
                      originalMessageId: message.id._serialized,
                      transcription: voiceNote.transcription,
                      timestamp: Date.now()
                    });
                  }, 1000);
                } else {
                  console.log(`💾 Nota de voz guardada sin transcripción automática`);
                  messageBody = '[Nota de voz guardada - transcripción pendiente]';
                }
              } else {
                console.log('⚠️ OpenAI API key no disponible para transcripción');
                messageBody = '[Nota de voz recibida - transcripción no disponible]';
              }
            } catch (error) {
              console.error('❌ Error transcribiendo nota de voz:', error);
              messageBody = '[Nota de voz recibida - error en transcripción]';
            }
          }
          
          // 🕷️ SISTEMA DE WEB SCRAPING AUTOMÁTICO
          try {
            console.log(`🕷️ Enviando mensaje al sistema de web scraping automático...`);
            const { MessageInterceptorService } = await import('./messageInterceptorService');
            
            await MessageInterceptorService.interceptMessage(id, {
              id: message.id._serialized || String(message.id),
              body: messageBody,
              from: message.from,
              to: message.to,
              timestamp: message.timestamp || Math.floor(Date.now() / 1000),
              hasMedia: message.hasMedia || false,
              type: message.type || 'text'
            });
            
            console.log(`✅ Mensaje procesado por web scraping automático`);
          } catch (webScrapingError) {
            console.error(`❌ Error en web scraping automático:`, webScrapingError);
          }

          // 🤖 ACTIVAR SISTEMA DE RESPUESTAS AUTOMÁTICAS MULTI-PROVEEDOR
          try {
            console.log(`🤖 INICIANDO RESPUESTAS AUTOMÁTICAS MULTI-PROVEEDOR para cuenta ${id}`);
            console.log(`📝 Mensaje: "${messageBody}" | fromMe: ${message.fromMe} | Chat: ${message.from}`);
            
            const { WhatsAppAutoResponder } = await import('./whatsappAutoResponder');
            
            // ACTIVAR AUTOMÁTICAMENTE PARA TODOS LOS CHATS ENTRANTES
            console.log(`🔥 Auto-activando respuestas para chat ${message.from}`);
            WhatsAppAutoResponder.activateForChat(message.from, "A.E AI Smartbots");
            
            // Procesar mensaje con el sistema de respuestas automáticas multi-proveedor
            const processed = await WhatsAppAutoResponder.processIncomingMessage(
              {
                id: message.id._serialized || String(message.id),
                body: messageBody,
                fromMe: message.fromMe,
                timestamp: message.timestamp || Math.floor(Date.now() / 1000),
                chatId: message.from,
                type: message.type || 'text'
              },
              (to: string, responseMessage: string) => {
                return client.sendMessage(to, responseMessage);
              }
            );

            if (processed) {
              console.log(`✅ Respuesta automática multi-proveedor enviada para cuenta ${id}`);
              return; // Salir aquí - ya se procesó con respuestas automáticas
            } else {
              console.log(`⏭️ Sistema de respuestas automáticas no generó respuesta para cuenta ${id}`);
            }
          } catch (autoResponseError) {
            console.error(`❌ Error en respuestas automáticas multi-proveedor:`, autoResponseError);
            console.log(`🔄 Fallback a procesador unificado...`);
          }

          // FALLBACK 1: USAR PROCESADOR UNIFICADO DE MENSAJES
          try {
            console.log(`🎯 INICIANDO PROCESADOR UNIFICADO (fallback) para cuenta ${id}`);
            
            const { unifiedMessageProcessor } = await import('./unifiedMessageProcessor');
            
            // Asegurar inicialización del procesador
            await unifiedMessageProcessor.initialize();
            
            // Obtener nombre del contacto si está disponible
            let contactName = 'Usuario';
            try {
              const contact = await message.getContact();
              contactName = contact.name || contact.pushname || contact.number || 'Usuario';
            } catch (contactError) {
              console.log('ℹ️ No se pudo obtener información del contacto');
            }
            
            // Procesar mensaje con el procesador unificado (prioriza prompts asignados)
            const unifiedResult = await unifiedMessageProcessor.processMessage({
              chatId: message.from,
              accountId: id,
              from: message.from,
              body: messageBody,
              contactName: contactName,
              fromMe: message.fromMe
            });

            if (unifiedResult.success && unifiedResult.response) {
              console.log(`✅ RESPUESTA GENERADA POR PROCESADOR UNIFICADO (${unifiedResult.source}): ${unifiedResult.response.substring(0, 50)}...`);
              console.log(`🎯 Agente usado: ${unifiedResult.agentName || 'Desconocido'}`);
              
              // Enviar la respuesta usando WhatsApp
              await client.sendMessage(message.from, unifiedResult.response);
              console.log(`📤 Respuesta enviada por WhatsApp para cuenta ${id} usando prompt asignado`);
              return; // Salir aquí - ya se procesó con el procesador unificado
            } else {
              console.log(`⏭️ Procesador unificado no generó respuesta para cuenta ${id}`);
            }
          } catch (unifiedError) {
            console.error(`❌ Error en procesador unificado:`, unifiedError);
            console.log(`🔄 Fallback a sistema contextual...`);
          }

          // FALLBACK 2: Procesar mensaje con sistema contextual de respuestas automáticas
          try {
            console.log(`🤖 INICIANDO RESPUESTA CONTEXTUAL (fallback final) para cuenta ${id}`);
            
            const { ContextAwareAutoResponder } = await import('./contextAwareAutoResponder');
            
            // Procesar mensaje con contexto de conversación
            const processed = await ContextAwareAutoResponder.processMessage(
              id, // accountId
              message.from, // chatId
              messageBody, // messageText
              message.fromMe, // fromMe
              client // whatsappClient
            );

            if (processed) {
              console.log(`✅ Respuesta contextual enviada para cuenta ${id}`);
            } else {
              console.log(`⏭️ No se envió respuesta automática para cuenta ${id}`);
            }
          } catch (error) {
            console.error(`❌ Error en respuesta automática contextual:`, error);
          }
        }
      } catch (error) {
        console.error(`❌ Error procesando mensaje para tickets automáticos:`, error);
      }
    });
  }

  /**
   * Fuerza la generación de un nuevo código QR limpiando el cache
   */
  async forceRefreshQR(accountId: number): Promise<boolean> {
    try {
      console.log(`🔄 Forzando actualización de QR para cuenta ${accountId}`);
      
      // Limpiar cache completamente
      this.qrCodeCache.delete(accountId);
      
      const instance = this.instances.get(accountId);
      if (!instance || !instance.client) {
        console.log(`❌ Instancia no encontrada para cuenta ${accountId}`);
        return false;
      }

      // Reinicializar cliente para generar nuevo QR - SINCRONO
      try {
        await instance.client.destroy();
        console.log(`🔄 Cliente destruido para cuenta ${accountId}`);
        
        // Esperar un momento y luego reinicializar sincrónicamente
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Reinicializar inmediatamente de forma síncrona
        await this.initializeAccount(accountId);
        console.log(`✅ QR forzado para cuenta ${accountId}`);
        
        return true;
      } catch (error) {
        console.error(`❌ Error forzando refresh QR:`, error);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error en forceRefreshQR:`, error);
      return false;
    }
  }

  /**
   * Obtiene código QR optimizado para producción
   */
  async getLatestQR(accountId: number): Promise<string | null> {
    try {
      // Primero verificar el cache en memoria
      const cachedQR = this.getCachedQR(accountId);
      if (cachedQR) {
        console.log(`Usando QR almacenado en memoria para cuenta ID ${accountId}`);
        return cachedQR.text;
      }

      const instance = this.instances.get(accountId);
      if (!instance) {
        console.error(`Cuenta WhatsApp ID ${accountId} no inicializada`);
        return null;
      }

      // Verificar estado de la instancia
      if (instance.status.qrCode) {
        this.cacheQRCode(accountId, instance.status.qrCode, instance.status.qrDataUrl);
        return instance.status.qrCode;
      }

      // Leer desde archivo de manera segura
      const qrFromFile = this.readQRFromFile(instance.qrCodePath);
      if (qrFromFile) {
        this.cacheQRCode(accountId, qrFromFile);
        return qrFromFile;
      }

      return null;
    } catch (error) {
      console.error(`Error obteniendo QR para cuenta ${accountId}:`, error);
      return null;
    }
  }

  /**
   * Obtiene el código QR con imagen base64 para una cuenta específica
   */
  async getQRWithImage(accountId: number): Promise<{ qrcode: string; qrDataUrl?: string } | null> {
    try {
      const cachedQR = this.getCachedQR(accountId);
      if (cachedQR && cachedQR.dataUrl) {
        return {
          qrcode: cachedQR.text,
          qrDataUrl: cachedQR.dataUrl
        };
      }

      const qrText = await this.getLatestQR(accountId);
      if (!qrText) {
        return null;
      }

      // Generar imagen si no existe
      try {
        const qrDataUrl = await this.generateQRImage(qrText);

        // Actualizar cache
        this.cacheQRCode(accountId, qrText, qrDataUrl);

        return {
          qrcode: qrText,
          qrDataUrl: qrDataUrl
        };
      } catch (imageError) {
        console.warn(`Error generando imagen QR para cuenta ${accountId}:`, imageError);
        return {
          qrcode: qrText
        };
      }
    } catch (error) {
      console.error(`Error obteniendo QR con imagen para cuenta ${accountId}:`, error);
      return null;
    }
  }

  /**
   * VERSIÓN ORIGINAL - Activa conexión permanente básica
   */
  private activatePermanentConnectionBasic(instance: WhatsAppInstance): void {
    // Verificar conexión cada 30 segundos
    instance.connectionTimers.connectionCheck = setInterval(() => {
      this.checkConnection(instance.id);
    }, 30000);
    instance.connectionTimers.keepAlive = setInterval(() => {
      this.keepConnectionAlive(instance.id);
    }, 5 * 60 * 1000);
  }

  /**
   * Desactiva temporizadores de conexión
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
   * Verifica estado de conexión
   */
  private async checkConnection(accountId: number): Promise<void> {
    try {
      const instance = this.instances.get(accountId);
      if (!instance || !instance.client) return;

      const state = await instance.client.getState();
      if (state !== 'CONNECTED') {
        console.log(`Conexión perdida para cuenta ${accountId}, intentando reconectar...`);
        await this.attemptConnectionRecovery(accountId);
      }
    } catch (error) {
      console.error(`Error verificando conexión para cuenta ${accountId}:`, error);
    }
  }

  /**
   * Mantiene conexión activa
   */
  private async keepConnectionAlive(accountId: number): Promise<void> {
    try {
      const instance = this.instances.get(accountId);
      if (!instance || !instance.client) return;

      // Verificar que esté autenticado
      if (instance.status.authenticated) {
        await instance.client.getState();
      }
    } catch (error) {
      console.warn(`Error manteniendo conexión activa para cuenta ${accountId}:`, error);
    }
  }

  /**
   * Intenta recuperar conexión perdida
   */
  private async attemptConnectionRecovery(accountId: number): Promise<boolean> {
    try {
      const instance = this.instances.get(accountId);
      if (!instance) return false;

      const now = Date.now();
      if (now - instance.lastReconnectAttempt < 60000) {
        return false; // Evitar reconexiones muy frecuentes
      }

      instance.lastReconnectAttempt = now;
      console.log(`Iniciando reconexión automática para cuenta ID ${accountId}...`);

      // Destruir cliente actual
      if (instance.client) {
        try {
          await instance.client.destroy();
        } catch (destroyError) {
          console.warn(`Error destruyendo cliente para cuenta ${accountId}:`, destroyError);
        }
      }

      // Recrear instancia
      this.instances.delete(accountId);
      const success = await this.initializeAccount(accountId);
      
      if (success) {
        console.log(`Reconexión exitosa para cuenta ID ${accountId}`);
        return true;
      } else {
        console.error(`Falló la reconexión para cuenta ID ${accountId}`);
        return false;
      }
    } catch (error) {
      console.error(`Error en recuperación de conexión para cuenta ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Obtiene estado de una cuenta
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
    return instance.status;
  }

  /**
   * Obtiene instancia de cuenta
   */
  getInstance(accountId: number): WhatsAppInstance | undefined {
    return this.instances.get(accountId);
  }

  /**
   * Envía mensaje
   */
  async sendMessage(accountId: number, to: string, body: string): Promise<any> {
    try {
      const instance = this.instances.get(accountId);
      if (!instance || !instance.client) {
        throw new Error(`Cuenta WhatsApp ID ${accountId} no inicializada`);
      }

      if (!instance.status.authenticated) {
        throw new Error(`Cuenta WhatsApp ID ${accountId} no autenticada`);
      }

      const result = await instance.client.sendMessage(to, body);
      return result;
    } catch (error) {
      console.error(`Error enviando mensaje desde cuenta ID ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene la foto de perfil de un contacto
   */
  async getContactProfilePicture(accountId: number, contactId: string): Promise<string | null> {
    try {
      const instance = this.instances.get(accountId);
      if (!instance) {
        console.warn(`Instancia WhatsApp ID ${accountId} no encontrada para foto de perfil`);
        return null;
      }

      if (!instance.client) {
        console.warn(`Cliente WhatsApp ID ${accountId} no inicializado para foto de perfil`);
        return null;
      }

      // Verificar estado de conexión real
      const clientState = await instance.client.getState();
      console.log(`📸 Estado del cliente ${accountId}: ${clientState}`);
      
      if (clientState !== 'CONNECTED') {
        console.warn(`Cliente WhatsApp ID ${accountId} no conectado (${clientState}) para foto de perfil`);
        return null;
      }

      console.log(`📸 Obteniendo foto de perfil para ${contactId} desde cuenta ${accountId}`);
      
      // Obtener la URL de la foto de perfil con timeout
      const profilePicUrl = await Promise.race([
        instance.client.getProfilePicUrl(contactId),
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 10000)
        )
      ]);
      
      if (profilePicUrl) {
        console.log(`✅ Foto de perfil obtenida para ${contactId}: ${profilePicUrl.substring(0, 100)}...`);
        return profilePicUrl;
      } else {
        console.log(`📸 Sin foto de perfil disponible para ${contactId}`);
        return null;
      }
    } catch (error) {
      console.warn(`❌ Error obteniendo foto de perfil para ${contactId} en cuenta ${accountId}:`, error);
      return null;
    }
  }

  /**
   * Obtiene información del contacto incluyendo foto de perfil
   */
  async getContactInfo(accountId: number, contactId: string): Promise<any> {
    try {
      const instance = this.instances.get(accountId);
      if (!instance || !instance.status.authenticated) {
        console.warn(`Cuenta WhatsApp ID ${accountId} no autenticada para obtener info de contacto`);
        return null;
      }

      // Obtener información del contacto
      const contact = await instance.client.getContactById(contactId);
      if (!contact) {
        return null;
      }

      // Obtener foto de perfil
      let profilePicUrl = null;
      try {
        profilePicUrl = await instance.client.getProfilePicUrl(contactId);
      } catch (picError) {
        console.warn(`No se pudo obtener foto de perfil para ${contactId}:`, picError);
      }

      return {
        id: contact.id._serialized,
        name: contact.name || contact.pushname || contact.shortName || 'Sin nombre',
        number: contact.number || '',
        profilePicUrl: profilePicUrl,
        isGroup: contact.isGroup || false,
        isUser: contact.isUser || false
      };
    } catch (error) {
      console.warn(`Error obteniendo información de contacto para ${contactId}:`, error);
      return null;
    }
  }

  /**
   * Desconecta una cuenta
   */
  async disconnectAccount(accountId: number): Promise<boolean> {
    try {
      const instance = this.instances.get(accountId);
      if (!instance) {
        console.error(`Cuenta WhatsApp ID ${accountId} no inicializada`);
        return false;
      }

      // Desactivar temporizadores
      this.deactivateConnectionTimers(instance);

      // Cerrar cliente
      if (instance.client) {
        try {
          await instance.client.logout();
          await instance.client.destroy();
        } catch (clientError) {
          console.warn(`Error cerrando cliente para cuenta ${accountId}:`, clientError);
        }
      }

      // Remover instancia
      this.instances.delete(accountId);

      // Limpiar cache QR
      this.qrCodeCache.delete(accountId);

      // Actualizar estado en BD
      try {
        await storage.updateWhatsappAccount(accountId, { status: 'disconnected' });
      } catch (dbError) {
        console.warn(`Error actualizando estado en BD para cuenta ${accountId}:`, dbError);
      }

      console.log(`Cuenta WhatsApp ${accountId} desconectada exitosamente`);
      return true;
    } catch (error) {
      console.error(`Error desconectando cuenta ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Obtiene el cliente de WhatsApp para una cuenta específica
   */
  getClient(accountId: number): any | null {
    const instance = this.instances.get(accountId);
    return instance ? instance.client : null;
  }

  /**
   * Obtiene el estado de una cuenta específica
   */
  getAccountStatus(accountId: number): WhatsAppStatus | null {
    const instance = this.instances.get(accountId);
    return instance ? instance.status : null;
  }

  /**
   * Verifica si una cuenta está conectada
   */
  isAccountConnected(accountId: number): boolean {
    const instance = this.instances.get(accountId);
    return instance ? instance.status.authenticated && instance.status.ready : false;
  }

  /**
   * Almacena conversación para análisis AI
   */
  private async storeConversationForAnalysis(accountId: number, message: any): Promise<void> {
    try {
      const { db } = await import('../db');
      const { conversations } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');

      const chatId = message.from;
      const messageText = message.body || '';
      const timestamp = new Date(message.timestamp * 1000);

      // Buscar conversación existente
      const existingConversation = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.chatId, chatId),
            eq(conversations.whatsappAccountId, accountId)
          )
        )
        .limit(1);

      if (existingConversation.length > 0) {
        // Actualizar conversación existente
        const conversation = existingConversation[0];
        const currentMessages = conversation.messages ? JSON.parse(conversation.messages) : [];
        
        currentMessages.push({
          id: message.id._serialized,
          body: messageText,
          fromMe: message.fromMe,
          timestamp: timestamp.toISOString(),
          type: message.type
        });

        await db
          .update(conversations)
          .set({
            messages: JSON.stringify(currentMessages),
            lastMessageAt: timestamp,
            messageCount: currentMessages.length,
            analyzed: false // Marcar para re-análisis
          })
          .where(eq(conversations.id, conversation.id));

        console.log(`📝 Conversación actualizada para análisis AI: ${chatId}`);
      } else {
        // Crear nueva conversación
        const newMessages = [{
          id: message.id._serialized,
          body: messageText,
          fromMe: message.fromMe,
          timestamp: timestamp.toISOString(),
          type: message.type
        }];

        await db.insert(conversations).values({
          chatId,
          whatsappAccountId: accountId,
          contactId: 1, // Default contact ID
          messages: JSON.stringify(newMessages),
          lastMessageAt: timestamp,
          messageCount: 1,
          analyzed: false,
          status: 'active'
        });

        console.log(`📝 Nueva conversación creada para análisis AI: ${chatId}`);
      }
    } catch (error) {
      console.error('❌ Error almacenando conversación para análisis:', error);
    }
  }

  /**
   * Maneja reconexión automática para una cuenta
   */
  private handleAutoReconnect(accountId: number): void {
    const instance = this.instances.get(accountId);
    if (!instance) return;

    console.log(`🔄 Ejecutando reconexión automática para cuenta ${accountId}...`);
    
    try {
      // Reinicializar cliente
      instance.client.initialize().then(() => {
        console.log(`✅ Reconexión automática exitosa para cuenta ${accountId}`);
      }).catch((error) => {
        console.error(`❌ Falló reconexión automática cuenta ${accountId}:`, error);
        // Reintentar en 5 minutos
        setTimeout(() => this.handleAutoReconnect(accountId), 300000);
      });
    } catch (error) {
      console.error(`❌ Error iniciando reconexión cuenta ${accountId}:`, error);
      // Reintentar en 5 minutos
      setTimeout(() => this.handleAutoReconnect(accountId), 300000);
    }
  }

  /**
   * Obtiene cuentas activas
   */
  getActiveAccounts(): { id: number, name: string, status: string }[] {
    const activeAccounts: { id: number, name: string, status: string }[] = [];
    
    Array.from(this.instances.entries()).forEach(([id, instance]) => {
      activeAccounts.push({
        id,
        name: instance.name,
        status: instance.status.authenticated ? 'connected' : 'disconnected'
      });
    });
    
    return activeAccounts;
  }

  /**
   * Sistema de Keep-Alive/Ping ULTRA PERSISTENTE para mantener sesiones activas
   */
  private startKeepAlive(instance: WhatsAppInstance): void {
    // Limpiar timer existente si hay uno
    if (instance.connectionTimers.keepAlive) {
      clearInterval(instance.connectionTimers.keepAlive);
    }

    // Inicializar estado de ping ultra persistente
    instance.status.pingStatus = {
      isActive: true,
      lastPing: Date.now(),
      pingCount: 0,
      nextPing: Date.now() + 15000 // 15 segundos - más frecuente
    };

    // Crear timer de keep-alive ULTRA AGRESIVO cada 15 segundos
    instance.connectionTimers.keepAlive = setInterval(async () => {
      try {
        // SIEMPRE intentar mantener la conexión, incluso si no está autenticada
        if (!instance.client) {
          console.log(`🔄 Cliente no existe para cuenta ${instance.id} - reinicializando...`);
          await this.forceReconnect(instance);
          return;
        }

        // Realizar ping PERSISTENTE verificando estado del cliente
        const isConnected = await this.performAggressivePing(instance);
        
        if (isConnected) {
          instance.status.pingStatus!.lastPing = Date.now();
          instance.status.pingStatus!.pingCount++;
          instance.status.pingStatus!.nextPing = Date.now() + 15000;
          instance.status.authenticated = true;
          instance.status.ready = true;
          console.log(`💓 Ping exitoso cuenta ${instance.id} (${instance.name}) - Ping #${instance.status.pingStatus!.pingCount}`);
        } else {
          console.log(`❌ Ping fallido cuenta ${instance.id} - FORZANDO reconexión inmediata...`);
          await this.forceReconnect(instance);
        }
      } catch (error) {
        console.error(`❌ Error en keep-alive cuenta ${instance.id}:`, error);
        // NO FALLAR - siempre intentar reconectar
        await this.forceReconnect(instance);
      }
    }, 15000); // 15 segundos - más agresivo

    console.log(`💓 Keep-alive ULTRA PERSISTENTE iniciado para cuenta ${instance.id} (${instance.name})`);
  }

  private async performAggressivePing(instance: WhatsAppInstance): Promise<boolean> {
    try {
      // Verificar si el cliente está listo
      if (!instance.client) return false;
      
      // Método 1: Verificar estado del cliente
      try {
        const info = await instance.client.getState();
        if (info === 'CONNECTED') return true;
      } catch (error) {
        console.log(`🔄 Método 1 falló para cuenta ${instance.id}`);
      }

      // Método 2: Verificar si se pueden obtener chats (más confiable)
      try {
        const chats = await instance.client.getChats();
        if (chats && chats.length >= 0) return true;
      } catch (error) {
        console.log(`🔄 Método 2 falló para cuenta ${instance.id}`);
      }

      // Método 3: Verificar información del cliente
      try {
        const clientInfo = await instance.client.getWWebVersion();
        if (clientInfo) return true;
      } catch (error) {
        console.log(`🔄 Método 3 falló para cuenta ${instance.id}`);
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  private async forceReconnect(instance: WhatsAppInstance): Promise<void> {
    console.log(`🔧 FORZANDO reconexión para cuenta ${instance.id}`);
    
    try {
      // No detener el keep-alive - mantener activo durante la reconexión
      
      // Método 1: Reinicializar cliente si existe
      if (instance.client) {
        try {
          await instance.client.initialize();
          console.log(`✅ Cliente reinicializado para cuenta ${instance.id}`);
          return;
        } catch (error) {
          console.log(`🔄 Reinicialización falló, intentando método 2 para cuenta ${instance.id}`);
        }
      }

      // Método 2: Crear nuevo cliente si el anterior falló
      console.log(`🔄 Creando nuevo cliente para cuenta ${instance.id}`);
      await this.initializeAccount(instance.id);
      
    } catch (error) {
      console.error(`❌ Error en reconexión forzada cuenta ${instance.id}:`, error);
      
      // Programar reintento en 30 segundos - NUNCA RENDIRSE
      setTimeout(() => {
        console.log(`🔄 Reintentando reconexión para cuenta ${instance.id}...`);
        this.forceReconnect(instance);
      }, 30000);
    }
  }

  // Método de reconexión removido - usar sistema de recuperación de sesión en su lugar

  private activatePermanentConnection(instance: WhatsAppInstance): void {
    console.log(`🛡️ ACTIVANDO conexión PERMANENTE ULTRA-AGRESIVA para cuenta ${instance.id}`);
    
    // Activar keep-alive ultra agresivo cada 15 segundos
    this.startKeepAlive(instance);
    
    // Configurar verificaciones CONTINUAS de estado cada 3 segundos
    const statusCheck = setInterval(async () => {
      try {
        if (!instance.status.authenticated && instance.client) {
          console.log(`⚠️ Cuenta ${instance.id} perdió autenticación, usando recuperación de sesión...`);
          // Usar sistema de recuperación de sesión en lugar de reconexión inmediata
        }
        
        // Verificación adicional de conexión real
        const isConnected = await this.performAggressivePing(instance);
        if (!isConnected && instance.client) {
          console.log(`🚨 Conexión perdida detectada para cuenta ${instance.id}, forzando reconexión...`);
          await this.forceReconnect(instance);
        }
      } catch (error) {
        console.log(`🔄 Error en verificación continua cuenta ${instance.id}:`, error);
        // Usar sistema de recuperación de sesión en caso de error
      }
    }, 3000); // Cada 3 segundos - MUY agresivo

    // Almacenar el timer para limpieza posterior si es necesario
    instance.connectionTimers.connectionCheck = statusCheck;
    
    // Timer adicional de supervivencia cada 30 segundos
    const survivalCheck = setInterval(async () => {
      try {
        if (instance.client) {
          // Forzar una acción para mantener la sesión viva
          await instance.client.getState();
          console.log(`💪 Supervivencia verificada para cuenta ${instance.id}`);
        }
      } catch (error) {
        console.log(`⚠️ Fallo en supervivencia cuenta ${instance.id}, reconectando...`);
        await this.forceReconnect(instance);
      }
    }, 30000);
    
    // Almacenar también el timer de supervivencia
    if (!instance.connectionTimers.keepAlive) {
      instance.connectionTimers.keepAlive = survivalCheck;
    }
    
    console.log(`✅ Conexión PERMANENTE ULTRA-AGRESIVA activada para cuenta ${instance.id}`);
  }

  private async handlePingFailure(instance: WhatsAppInstance): Promise<void> {
    console.log(`🔧 Manejando fallo de ping para cuenta ${instance.id}`);
    
    // Marcar como inactivo temporalmente
    if (instance.status.pingStatus) {
      instance.status.pingStatus.isActive = false;
    }

    // Intentar restaurar conexión
    try {
      await instance.client.pupPage?.reload();
      console.log(`🔄 Página recargada para cuenta ${instance.id}`);
      
      // Esperar un poco y reactivar
      setTimeout(() => {
        if (instance.status.pingStatus) {
          instance.status.pingStatus.isActive = true;
          console.log(`✅ Keep-alive reactivado para cuenta ${instance.id}`);
        }
      }, 5000);
    } catch (error) {
      console.error(`❌ Error restaurando conexión cuenta ${instance.id}:`, error);
    }
  }

  /**
   * Activa keep-alive para una cuenta específica por ID
   */
  public activateKeepAlive(accountId: number): boolean {
    const instance = this.instances.get(accountId);
    if (!instance) return false;

    if (!instance.status.authenticated) return false;

    this.startKeepAlive(instance);
    return true;
  }

  /**
   * Desactiva keep-alive para una cuenta específica por ID
   */
  public deactivateKeepAlive(accountId: number): boolean {
    this.stopKeepAlive(accountId);
    return true;
  }

  /**
   * Detiene el keep-alive para una cuenta específica
   */
  stopKeepAlive(accountId: number): void {
    const instance = this.instances.get(accountId);
    if (!instance) return;

    if (instance.connectionTimers.keepAlive) {
      clearInterval(instance.connectionTimers.keepAlive);
      instance.connectionTimers.keepAlive = null;
    }

    if (instance.status.pingStatus) {
      instance.status.pingStatus.isActive = false;
    }

    console.log(`💤 Keep-alive detenido para cuenta ${accountId} (${instance.name})`);
  }

  /**
   * Obtiene el estado del ping para una cuenta
   */
  getPingStatus(accountId: number): any {
    const instance = this.instances.get(accountId);
    if (!instance || !instance.status.pingStatus) {
      return {
        isActive: false,
        lastPing: 0,
        pingCount: 0,
        nextPing: 0
      };
    }

    return {
      ...instance.status.pingStatus,
      timeSinceLastPing: Date.now() - instance.status.pingStatus.lastPing,
      timeToNextPing: Math.max(0, instance.status.pingStatus.nextPing - Date.now())
    };
  }

  /**
   * Obtiene el estado del ping para todas las cuentas
   */
  getAllPingStatus(): any[] {
    const allStatus: any[] = [];
    
    this.instances.forEach((instance, accountId) => {
      const pingStatus = this.getPingStatus(accountId);
      allStatus.push({
        accountId,
        accountName: instance.name,
        pingStatus
      });
    });
    
    return allStatus;
  }
}

export const whatsappMultiAccountManager = new WhatsAppMultiAccountManager();