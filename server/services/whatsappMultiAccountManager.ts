/**
 * Administrador de múltiples cuentas de WhatsApp
 * Versión optimizada para códigos QR en producción
 */
import { EventEmitter } from 'events';
import { Client } from 'whatsapp-web.js';
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

      // Crear cliente WhatsApp
      const client = new Client({
        puppeteer: {
          ...puppeteerOptions,
          timeout: 120000,
          ignoreHTTPSErrors: true,
        },
        qrMaxRetries: 0, // Infinite retries to prevent disconnection
        restartOnAuthFail: true,
        takeoverOnConflict: true,
        authTimeoutMs: 0, // No timeout to maintain connection
        takeoverTimeoutMs: 60000, // 60 segundos

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
      
      // ✨ ACTIVAR KEEP-ALIVE AUTOMÁTICAMENTE ✨
      console.log(`💓 Iniciando keep-alive automático para cuenta ${id} (${name})`);
      this.startKeepAlive(instance);
    });

    // Evento cuando está listo
    client.on('ready', () => {
      console.log(`Cliente WhatsApp ${id} (${name}) listo para usar`);
      instance.status.ready = true;
      this.activatePermanentConnection(instance);
    });

    // Evento de desconexión
    client.on('disconnected', (reason) => {
      console.log(`Cliente WhatsApp ${id} (${name}) desconectado: ${reason}`);
      instance.status.authenticated = false;
      instance.status.ready = false;
      
      // NO DETENER KEEP-ALIVE - mantener activo para reconexión automática
      console.log(`🔄 Manteniendo keep-alive activo para cuenta ${id} (${name}) - intentando reconexión`);
      
      // Programar reconexión automática después de 30 segundos
      setTimeout(async () => {
        console.log(`🔄 Intentando reconectar cuenta ${id} (${name})...`);
        try {
          await client.initialize();
          console.log(`✅ Reconexión iniciada para cuenta ${id} (${name})`);
        } catch (error) {
          console.error(`❌ Error en reconexión automática cuenta ${id}:`, error);
          // Reintentar en 2 minutos
          setTimeout(() => this.handleAutoReconnect(id), 120000);
        }
      }, 30000);
      
      this.deactivateConnectionTimers(instance);
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

          // Procesar mensaje con sistema funcional de respuestas automáticas
          try {
            console.log(`🤖 INICIANDO RESPUESTA AUTOMÁTICA para cuenta ${id}`);
            console.log(`📝 Mensaje: "${messageBody}" | fromMe: ${message.fromMe} | Chat: ${message.from}`);
            
            const { WorkingAutoResponseService } = await import('./workingAutoResponse');
            
            // Procesar mensaje para respuesta automática
            const processed = await WorkingAutoResponseService.processIncomingMessage(
              id, // accountId
              message.from, // chatId
              messageBody, // message
              client // whatsappClient
            );

            if (processed) {
              console.log(`✅ Respuesta automática enviada para cuenta ${id}`);
            } else {
              console.log(`⏭️ No se envió respuesta automática para cuenta ${id}`);
            }
          } catch (error) {
            console.error(`❌ Error en respuesta automática:`, error);
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
      
      // Limpiar cache
      this.qrCodeCache.delete(accountId);
      
      const instance = this.instances.get(accountId);
      if (!instance || !instance.client) {
        console.log(`❌ Instancia no encontrada para cuenta ${accountId}`);
        return false;
      }

      // Reinicializar cliente para generar nuevo QR
      try {
        await instance.client.destroy();
        console.log(`🔄 Cliente destruido para cuenta ${accountId}`);
        
        // Pequeña pausa antes de reinicializar
        setTimeout(async () => {
          try {
            await this.initializeAccount(accountId);
            console.log(`✅ QR forzado para cuenta ${accountId}`);
          } catch (error) {
            console.error(`❌ Error reinicializando cuenta ${accountId}:`, error);
          }
        }, 2000);
        
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
   * Activa conexión permanente
   */
  private activatePermanentConnection(instance: WhatsAppInstance): void {
    // Verificar conexión cada 30 segundos
    instance.connectionTimers.connectionCheck = setInterval(() => {
      this.checkConnection(instance.id);
    }, 30000);

    // Mantener vivo cada 5 minutos
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
  getClient(accountId: number): Client | null {
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
   * Sistema de Keep-Alive/Ping para mantener sesiones activas
   */
  private startKeepAlive(instance: WhatsAppInstance): void {
    // Limpiar timer existente si hay uno
    if (instance.connectionTimers.keepAlive) {
      clearInterval(instance.connectionTimers.keepAlive);
    }

    // Inicializar estado de ping
    instance.status.pingStatus = {
      isActive: true,
      lastPing: Date.now(),
      pingCount: 0,
      nextPing: Date.now() + 30000 // 30 segundos
    };

    // Crear timer de keep-alive cada 30 segundos
    instance.connectionTimers.keepAlive = setInterval(async () => {
      try {
        if (!instance.client || !instance.status.authenticated) {
          console.log(`🔄 Keep-alive pausado para cuenta ${instance.id} - no autenticada`);
          return;
        }

        // Realizar ping simple verificando estado del cliente
        const isConnected = await this.performPing(instance);
        
        if (isConnected) {
          instance.status.pingStatus!.lastPing = Date.now();
          instance.status.pingStatus!.pingCount++;
          instance.status.pingStatus!.nextPing = Date.now() + 30000;
          console.log(`💓 Ping exitoso cuenta ${instance.id} (${instance.name}) - Ping #${instance.status.pingStatus!.pingCount}`);
        } else {
          console.log(`❌ Ping fallido cuenta ${instance.id} - intentando reconectar...`);
          await this.handlePingFailure(instance);
        }
      } catch (error) {
        console.error(`❌ Error en keep-alive cuenta ${instance.id}:`, error);
        await this.handlePingFailure(instance);
      }
    }, 30000); // 30 segundos

    console.log(`💓 Keep-alive iniciado para cuenta ${instance.id} (${instance.name})`);
  }

  private async performPing(instance: WhatsAppInstance): Promise<boolean> {
    try {
      // Verificar si el cliente está listo
      if (!instance.client) return false;
      
      // Intentar obtener info del cliente (ping ligero)
      const info = await instance.client.getState();
      return info === 'CONNECTED';
    } catch (error) {
      console.log(`🔄 Ping simple falló, intentando método alternativo para cuenta ${instance.id}`);
      try {
        // Método alternativo: verificar si se pueden obtener chats
        await instance.client.getChats();
        return true;
      } catch (altError) {
        return false;
      }
    }
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