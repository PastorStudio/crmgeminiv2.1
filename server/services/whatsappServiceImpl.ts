/**
 * Implementación real del servicio de WhatsApp utilizando whatsapp-web.js y Chromium
 * Genera códigos QR auténticos para conexión con WhatsApp Web
 * Mantiene la conexión activa de forma permanente hasta desconexión explícita
 */

import * as path from 'path';
import * as fs from 'fs';
import { Client, Message, MessageMedia } from 'whatsapp-web.js';
import * as qrcode from 'qrcode';
import { IWhatsAppService, WhatsAppStatus, WhatsAppMessage, WhatsAppChat } from './whatsappInterface';
import { EventEmitter } from 'events';

// Directorio temporal para archivos
const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Constantes para manejo de reconexión y persistencia
const RECONNECT_ATTEMPTS_MAX = 5; // Número máximo de intentos de reconexión
const SESSION_PATH = path.join(TEMP_DIR, 'whatsapp-sessions'); // Directorio para sesión
if (!fs.existsSync(SESSION_PATH)) {
  fs.mkdirSync(SESSION_PATH, { recursive: true });
}

// Archivo para guardar el QR en texto
const QR_TEXT_FILE = path.join(TEMP_DIR, 'whatsapp-qr.txt');

// Intervalos para mantener la conexión
const CONNECTION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos
const KEEP_ALIVE_INTERVAL = 30 * 1000; // 30 segundos

/**
 * Clase que implementa el servicio de WhatsApp usando whatsapp-web.js
 * Mantiene la conexión activa permanentemente 
 */
class WhatsAppServiceImpl extends EventEmitter implements IWhatsAppService {
  private client: Client | null = null;
  private status: WhatsAppStatus = {
    initialized: false,
    ready: false,
    authenticated: false,
    error: undefined,
    qrCode: undefined
  };
  private connectionCheckTimer: NodeJS.Timeout | null = null;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private chatCache: Map<string, WhatsAppChat> = new Map();
  private messageCache: Map<string, WhatsAppMessage[]> = new Map();
  private customTags: any[] = [];
  private customTagsFile: string = path.join(TEMP_DIR, 'custom-tags.json');
  
  /**
   * Método para actualizar información del chat
   */
  private async updateChatInfo(chat: any): Promise<void> {
    if (!chat || !chat.id) return;
    
    try {
      // Extraer datos básicos del chat
      const chatInfo: WhatsAppChat = {
        id: chat.id._serialized || chat.id,
        name: chat.name || '',
        isGroup: !!chat.isGroup,
        timestamp: chat.timestamp || Date.now(),
        unreadCount: chat.unreadCount || 0,
        lastMessage: chat.lastMessage?.body || '',
        profilePicUrl: undefined,
        participants: chat.participants?.map((p: any) => p.id._serialized || p.id) || []
      };
      
      // Intentar obtener la foto de perfil si es posible
      try {
        if (this.client && !chat.isGroup) {
          const profilePicUrl = await this.client.getProfilePicUrl(chat.id._serialized || chat.id);
          if (profilePicUrl) {
            chatInfo.profilePicUrl = profilePicUrl;
          }
        }
      } catch (error) {
        console.log(`No se pudo obtener foto de perfil para ${chat.id._serialized || chat.id}`);
      }
      
      // Guardar en caché
      this.chatCache.set(chatInfo.id, chatInfo);
      
    } catch (error) {
      console.error('Error actualizando info del chat:', error);
    }
  }
  
  /**
   * Convierte un mensaje de whatsapp-web.js al formato de nuestra aplicación
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
      return {
        id: message.id._serialized || message.id,
        body: message.body || '',
        from: message.from || '',
        to: message.to || '',
        fromMe: !!message.fromMe,
        timestamp: (message.timestamp || Date.now() / 1000) * 1000, // Convertir a milisegundos
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
   * Obtiene la ruta al ejecutable de Chromium en Replit
   */
  private getChromiumExecutablePath(): string {
    // Primero intentar el comando 'which' para encontrar el Chromium instalado
    try {
      const whichChromium = require('child_process').execSync('which chromium').toString().trim();
      if (whichChromium && fs.existsSync(whichChromium)) {
        console.log('Usando Chromium encontrado en:', whichChromium);
        return whichChromium;
      }
    } catch (error) {
      console.warn('No se pudo determinar la ubicación de Chromium mediante "which"');
    }
    
    // Rutas comunes de Chromium en Replit (orden del más reciente al más antiguo)
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
   * Inicializa el cliente de WhatsApp Web con soporte para recuperación de sesiones
   */
  async initialize(): Promise<void> {
    try {
      if (this.client) {
        console.log('Cliente WhatsApp ya inicializado');
        return;
      }

      // Verificar si hay una sesión activa anterior
      const sessionStatusFile = path.join(SESSION_PATH, 'session_active.json');
      let hasExistingSession = false;
      
      try {
        if (fs.existsSync(sessionStatusFile)) {
          const sessionData = JSON.parse(fs.readFileSync(sessionStatusFile, 'utf8'));
          const lastActiveTime = new Date(sessionData.lastCheckedAt || sessionData.activatedAt);
          const timeSinceActive = Date.now() - lastActiveTime.getTime();
          
          // Si la sesión ha estado activa en las últimas 8 horas, intentar recuperarla
          if (timeSinceActive < 8 * 60 * 60 * 1000) {
            console.log('Sesión de WhatsApp previa encontrada. Intentando recuperar...');
            hasExistingSession = true;
          } else {
            console.log('Sesión de WhatsApp muy antigua. Creando nueva sesión...');
            // Hacer copia de respaldo por si acaso
            fs.copyFileSync(
              sessionStatusFile, 
              path.join(SESSION_PATH, `session_backup_${Date.now()}.json`)
            );
          }
        }
      } catch (err) {
        console.warn('Error verificando sesión anterior:', err);
      }

      console.log('Inicializando cliente de WhatsApp Web...');

      // Configuración de puppeteer para Replit - optimizada para estabilidad
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

      // Inicializamos el cliente con configuración optimizada para persistencia
      // Nota: userDataDir no está soportado en la versión actual, usamos otra estrategia
      this.client = new Client({
        puppeteer: puppeteerOptions,
        qrMaxRetries: hasExistingSession ? 3 : 5, // Menos reintentos si estamos recuperando sesión
        restartOnAuthFail: true, // Reintentar automáticamente si falla la autenticación
        takeoverOnConflict: true, // Tomar el control en caso de conflicto de sesión
        takeoverTimeoutMs: 15000 // Mayor tiempo de espera para tomar el control si hay sesión previa
      });

      // Configuramos los eventos del cliente
      this.setupClientEvents();

      console.log('Iniciando cliente WhatsApp con sesión persistente en:', SESSION_PATH);
      
      // Iniciamos el cliente
      await this.client.initialize();
      
      this.status.initialized = true;
      console.log('Cliente de WhatsApp Web inicializado exitosamente');
      
      // Activar la conexión permanente inmediatamente
      this.activatePermanentConnection();
      
    } catch (error) {
      console.error('Error al inicializar WhatsApp:', error);
      this.status.error = `Error al inicializar: ${error instanceof Error ? error.message : 'Error desconocido'}`;
      this.status.initialized = true;
      this.status.ready = false;
      throw error;
    }
  }

  /**
   * Configura los eventos del cliente de WhatsApp
   */
  private setupClientEvents(): void {
    if (!this.client) return;

    // Evento cuando se genera un código QR
    this.client.on('qr', async (qrText) => {
      console.log('Nuevo código QR recibido');
      
      // Guardamos el QR en un archivo de texto para depuración
      fs.writeFileSync(QR_TEXT_FILE, qrText);
      console.log('Código QR guardado en archivo:', QR_TEXT_FILE);
      
      try {
        // Generamos una imagen data URL del código QR
        const qrDataUrl = await qrcode.toDataURL(qrText, {
          errorCorrectionLevel: 'H',
          type: 'image/png',
          margin: 4,
          scale: 4,
          color: {
            dark: '#128C7E',  // Color principal de WhatsApp
            light: '#FFFFFF'
          }
        });
        
        // Actualizamos el estado
        this.status.qrCode = qrText;
        this.status.ready = true;
        this.status.qrDataUrl = qrDataUrl;  // Guardamos el dataURL para mostrarlo en frontend
        
        // Emitimos evento para notificar al frontend
        this.emit('qr', { qrText, qrDataUrl });
        
      } catch (error) {
        console.error('Error generando imagen QR:', error);
        this.status.error = 'Error generando imagen QR';
        this.status.qrCode = qrText;  // Al menos guardamos el texto del QR
      }
    });

    // Evento cuando el cliente está listo
    this.client.on('ready', () => {
      console.log('Cliente WhatsApp listo para usar');
      this.status.ready = true;
      this.status.authenticated = true;
      this.status.connectionState = 'CONNECTED';
      this.status.error = undefined;
      this.status.qrCode = undefined;
      
      // Actualizar el archivo de sesión para marcar autenticación
      this.updateSessionStatusFile();
      
      // Activar la conexión permanente
      this.activatePermanentConnection()
        .then(() => console.log('Conexión permanente de WhatsApp activada'))
        .catch(err => console.error('Error activando conexión permanente:', err));
      
      this.emit('ready');
    });

    // Evento cuando la autenticación falla
    this.client.on('auth_failure', (error) => {
      console.error('Error de autenticación WhatsApp:', error);
      this.status.authenticated = false;
      this.status.error = `Error de autenticación: ${error}`;
      this.emit('auth_failure', error);
    });

    // Evento cuando se desconecta - implementa reconexión automática
    this.client.on('disconnected', async (reason) => {
      console.log('Cliente WhatsApp desconectado:', reason);
      this.status.authenticated = false;
      this.status.ready = false;
      this.status.error = `Desconectado: ${reason}`;
      this.emit('disconnected', reason);
      
      // Estrategia de reconexión automática con retraso progresivo
      console.log('Iniciando proceso de reconexión automática...');
      
      // Definir los intentos de reconexión con espera incremental
      const reconnectionDelays = [3000, 6000, 10000, 15000, 30000];
      
      for (let i = 0; i < reconnectionDelays.length; i++) {
        console.log(`Intento de reconexión ${i+1}/${reconnectionDelays.length} en ${reconnectionDelays[i]/1000} segundos...`);
        
        // Esperar antes de intentar la reconexión
        await new Promise(resolve => setTimeout(resolve, reconnectionDelays[i]));
        
        try {
          // Verificar si ya ha sido reconectado por otro proceso
          if (this.client) {
            try {
              const state = await this.client.getState().catch(() => null);
              if (state === 'CONNECTED') {
                console.log('Cliente ya reconectado por otro proceso');
                return;
              }
            } catch (err) {
              // Continuar con el proceso de reconexión
            }
          }
          
          // Intentar reconectar usando nuestra estrategia robusta
          const reconnected = await this.checkConnection();
          
          if (reconnected) {
            console.log(`Reconexión automática exitosa en intento ${i+1}`);
            // Asegurar que la conexión permanente está activa
            this.activatePermanentConnection();
            return;
          }
        } catch (error) {
          console.error(`Error en intento de reconexión ${i+1}:`, error);
        }
      }
      
      // Si llegamos aquí, todos los intentos fallaron
      console.error('Todos los intentos de reconexión automática fallaron');
      // Programar un reinicio completo como último recurso
      setTimeout(async () => {
        try {
          console.log('Ejecutando reinicio completo como último recurso');
          await this.restart();
        } catch (err) {
          console.error('Error en reinicio final:', err);
        }
      }, 60000); // Esperar 1 minuto antes del reinicio final
    });

    // Evento para mensajes entrantes
    this.client.on('message', async (message) => {
      console.log('Mensaje recibido:', message.body);
      
      try {
        // Enviar a través del sistema de eventos del servicio
        this.emit('message', message);
        
        // Obtener información del chat y contacto para posibles acciones adicionales
        const chat = await message.getChat();
        const contactName = chat.name || 'Contacto';
        const contactId = message.from || '';
        const chatId = chat.id._serialized || chat.id;
        
        // Guardar mensaje en la base de datos para la sección de mensajes
        try {
          // Importamos el almacenamiento bajo demanda
          const { storage } = await import('../storage');
          
          // Crear entrada de mensaje para la sección de mensajes
          await storage.createMessage({
            leadId: 1, // Utilizar ID de lead principal o buscar según el número
            content: message.body,
            sender: contactName,
            recipient: "CRM Sistema",
            channel: "WhatsApp",
            status: "received",
            timestamp: new Date()
          });
          
          console.log('Mensaje guardado en la base de datos');
        } catch (dbError) {
          console.error('Error guardando mensaje en la base de datos:', dbError);
        }
        
        // Enviar notificación global vía WebSocket (usando función global)
        if (global.sendNotification) {
          (global as any).sendNotification({
            type: 'new_message',
            contactName,
            messageText: message.body,
            timestamp: new Date()
          });
        }
        
        // Procesar respuesta automática si está configurada
        try {
          // Importar el servicio de respuestas automáticas
          const { autoResponseService } = await import('./autoResponseManager');
          
          console.log('Procesando mensaje para respuesta automática');
          await autoResponseService.handleIncomingMessage(message);
        } catch (autoResponseError) {
          console.error('Error procesando respuesta automática:', autoResponseError);
        }
      } catch (error) {
        console.error('Error al procesar notificación de mensaje:', error);
      }
    });
  }

  /**
   * Obtiene el estado actual del servicio
   */
  getStatus(): WhatsAppStatus {
    return this.status;
  }
  
  /**
   * Obtiene el cliente de WhatsApp Web.js para operaciones avanzadas
   * @returns El cliente de WhatsApp Web o null si no está inicializado
   */
  getClient(): Client | null {
    return this.client;
  }

  /**
   * Reinicia el servicio de WhatsApp
   */
  async restart(): Promise<void> {
    try {
      console.log('Reiniciando servicio de WhatsApp...');
      
      if (this.client) {
        await this.client.destroy();
        this.client = null;
      }
      
      // Resetear estado
      this.status = {
        initialized: false,
        ready: false,
        authenticated: false,
        error: undefined,
        qrCode: undefined
      };
      
      // Volvemos a inicializar
      await this.initialize();
      
    } catch (error) {
      console.error('Error al reiniciar servicio de WhatsApp:', error);
      this.status.error = `Error al reiniciar: ${error instanceof Error ? error.message : 'Error desconocido'}`;
      throw error;
    }
  }

  /**
   * Cierra la sesión actual
   */
  async logout(): Promise<void> {
    try {
      if (!this.client) {
        throw new Error('Cliente no inicializado');
      }

      await this.client.logout();
      
      // Reiniciamos el cliente para generar nuevo QR
      await this.restart();
      
    } catch (error) {
      console.error('Error al cerrar sesión de WhatsApp:', error);
      this.status.error = `Error al cerrar sesión: ${error instanceof Error ? error.message : 'Error desconocido'}`;
      throw error;
    }
  }

  /**
   * Envía un mensaje de WhatsApp al número especificado
   */
  async sendMessage(phoneNumber: string, message: string): Promise<any> {
    try {
      if (!this.client || !this.status.authenticated) {
        throw new Error('Cliente no inicializado o no autenticado');
      }

      // Formato estándar para números internacionales en WhatsApp (sin el +)
      let formattedNumber = phoneNumber.replace(/[^0-9]/g, '');
      
      // Añadir @c.us que es el formato que espera WhatsApp Web
      const chatId = `${formattedNumber}@c.us`;
      
      // Enviar el mensaje
      const response = await this.client.sendMessage(chatId, message);
      
      console.log(`Mensaje enviado a ${phoneNumber}:`, message);
      
      return {
        success: true,
        messageId: response.id._serialized,
        to: phoneNumber,
        message: message
      };
      
    } catch (error) {
      console.error(`Error enviando mensaje a ${phoneNumber}:`, error);
      throw error;
    }
  }
  
  /**
   * Activa la conexión permanente y establece los mecanismos para mantenerla activa
   * Incluye almacenamiento persistente para la sesión
   */
  async activatePermanentConnection(): Promise<void> {
    // Detener timers existentes si los hay
    this.stopConnectionTimers();
    
    // Crear archivo de estado de sesión para indicar que estamos activos
    try {
      const sessionStatusFile = path.join(SESSION_PATH, 'session_active.json');
      const sessionStatus = {
        activatedAt: new Date().toISOString(),
        clientId: 'crm-client',
        active: true,
        lastCheckedAt: new Date().toISOString(),
        connectionState: this.status.connectionState,
        permanentConnection: true
      };
      fs.writeFileSync(sessionStatusFile, JSON.stringify(sessionStatus, null, 2));
      console.log('Archivo de estado de sesión creado en:', sessionStatusFile);
    } catch (err) {
      console.error('Error guardando estado de sesión:', err);
    }
    
    // Configurar timer para verificar la conexión periódicamente con intervalo más corto
    this.connectionCheckTimer = setInterval(() => {
      // Actualizar archivo de estado de sesión
      this.updateSessionStatusFile();
      
      // Verificar si el cliente está inicializado antes de verificar la conexión
      if (this.client) {
        this.checkConnection().catch(err => {
          console.error('Error verificando conexión de WhatsApp:', err);
          
          // Si hay un error, intentar recuperación inmediata y más agresiva
          setTimeout(() => {
            console.log('Intentando recuperación inmediata tras error...');
            this.checkConnection().catch(recoverErr => {
              console.error('Error en recuperación inmediata:', recoverErr);
              
              // Si falla la recuperación inmediata, intentar manejo de error completo
              this.handleConnectionError(recoverErr).catch(handleErr => {
                console.error('Error en manejo de error de conexión:', handleErr);
              });
            });
          }, 5000); // Esperar 5 segundos e intentar inmediatamente
        });
      } else {
        // Si el cliente no está inicializado, intentar inicializarlo
        console.log('Cliente WhatsApp no inicializado, intentando inicializar...');
        this.initialize().catch(err => {
          console.error('Error inicializando cliente de WhatsApp:', err);
        });
      }
    }, Math.min(CONNECTION_CHECK_INTERVAL, 3 * 60 * 1000)); // Máximo 3 minutos entre verificaciones
    
    // Configurar timer para mantener activa la conexión (keep-alive)
    this.keepAliveTimer = setInterval(() => {
      this.performKeepAlive().catch(err => {
        console.error('Error en keep-alive de WhatsApp:', err);
      });
    }, KEEP_ALIVE_INTERVAL);
    
    console.log('Timers de conexión permanente configurados');
    
    // Realizar una verificación inicial
    await this.checkConnection();
    
    // Cargar chats iniciales
    this.refreshChats().catch(err => {
      console.error('Error cargando chats iniciales:', err);
    });
  }
  
  /**
   * Maneja errores de conexión de forma robusta
   * @param error Error original que causó el problema de conexión
   */
  private async handleConnectionError(error: any): Promise<void> {
    console.log('Manejando error de conexión:', error);
    
    // Esperar un tiempo antes de intentar reiniciar (evita bucles de reinicio)
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    try {
      // Verificar si el cliente actual está en buen estado
      if (this.client) {
        try {
          // Intentar obtener el estado primero
          const state = await this.client.getState();
          console.log('Estado actual después de error:', state);
          
          // Si el estado es null o indica desconexión, reiniciar
          if (!state || state === 'DISCONNECTED' || String(state).toUpperCase() === 'DISCONNECTED') {
            console.log('Estado indica desconexión, reiniciando cliente...');
            await this.restart();
          }
        } catch (stateError) {
          // Si no se puede obtener el estado, reiniciar
          console.error('Error obteniendo estado, reiniciando cliente:', stateError);
          await this.restart();
        }
      } else {
        // Si no hay cliente, inicializarlo de nuevo
        await this.initialize();
      }
    } catch (recoveryError) {
      console.error('Error en recuperación de conexión:', recoveryError);
      // Último recurso: reiniciar completamente
      try {
        await this.restart();
      } catch (finalError) {
        console.error('Error en reinicio final:', finalError);
      }
    }
  }
  
  /**
   * Actualiza el archivo de estado de la sesión 
   * para indicar que seguimos activos y registrar eventos importantes
   */
  private updateSessionStatusFile(): void {
    try {
      const sessionStatusFile = path.join(SESSION_PATH, 'session_active.json');
      let currentStatus: Record<string, any> = {
        lastCheckedAt: new Date().toISOString(),
        connectionState: this.status.connectionState
      };
      
      // Cargar estado actual o crear nuevo
      if (fs.existsSync(sessionStatusFile)) {
        try {
          const existingData = JSON.parse(fs.readFileSync(sessionStatusFile, 'utf8'));
          // Combinar datos existentes con los actuales
          currentStatus = { ...existingData, ...currentStatus };
        } catch (parseError) {
          console.error('Error al parsear archivo de sesión, creando nuevo:', parseError);
        }
      } else {
        currentStatus.createdAt = new Date().toISOString();
        currentStatus.activatedAt = new Date().toISOString();
        console.log('Archivo de estado de sesión creado en:', sessionStatusFile);
      }
      
      // Registrar eventos de autenticación si es necesario
      if (this.status.authenticated && !currentStatus.authenticated) {
        currentStatus.authenticated = true;
        currentStatus.authenticatedAt = new Date().toISOString();
        console.log('Sesión autenticada correctamente');
      }
      
      // Si pasamos de autenticado a no autenticado, registramos desconexión
      if (!this.status.authenticated && currentStatus.authenticated) {
        currentStatus.authenticated = false;
        currentStatus.disconnectedAt = new Date().toISOString();
        if (currentStatus.authenticatedAt) {
          currentStatus.previousAuthenticatedAt = currentStatus.authenticatedAt;
        }
        console.log('Sesión desconectada');
      }
      
      // Guardar el archivo
      fs.writeFileSync(sessionStatusFile, JSON.stringify(currentStatus, null, 2));
    } catch (err) {
      // No lanzar error, solo registrar
      console.error('Error actualizando archivo de estado:', err);
    }
  }
  
  /**
   * Detiene los temporizadores de conexión
   */
  private stopConnectionTimers(): void {
    if (this.connectionCheckTimer) {
      clearInterval(this.connectionCheckTimer);
      this.connectionCheckTimer = null;
    }
    
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }
  
  /**
   * Activa el modo de conexión ultra-persistente con WhatsApp
   * Esta función configura opciones adicionales para garantizar que la conexión se mantenga
   * activa incluso en situaciones adversas como mala conectividad o reinicio del navegador
   */
  async activateUnbreakableConnection(): Promise<boolean> {
    try {
      console.log('Activando modo de conexión ultra-persistente con WhatsApp...');
      
      // Primero, activamos la conexión permanente estándar
      await this.activatePermanentConnection();
      
      // Guardar configuración de conexión ultra-persistente
      const connectionConfigFile = path.join(SESSION_PATH, 'permanent_connection.json');
      const connectionConfig = {
        activatedAt: new Date().toISOString(),
        mode: 'unbreakable',
        keepAliveInterval: KEEP_ALIVE_INTERVAL,
        checkInterval: CONNECTION_CHECK_INTERVAL,
        active: true,
        autoReconnect: true,
        lastKeepAlive: new Date().toISOString()
      };
      
      fs.writeFileSync(connectionConfigFile, JSON.stringify(connectionConfig, null, 2));
      console.log('Configuración de conexión ultra-persistente guardada en:', connectionConfigFile);
      
      // Configurar un intervalo más frecuente para el keep-alive
      if (this.keepAliveTimer) {
        clearInterval(this.keepAliveTimer);
      }
      
      // Realizar keep-alive más frecuente (cada 20 segundos)
      this.keepAliveTimer = setInterval(() => {
        this.performKeepAlive()
          .then(() => {
            // Actualizar el archivo de configuración cada vez que se realiza un keep-alive exitoso
            try {
              if (fs.existsSync(connectionConfigFile)) {
                const currentConfig = JSON.parse(fs.readFileSync(connectionConfigFile, 'utf8'));
                currentConfig.lastKeepAlive = new Date().toISOString();
                currentConfig.successfulKeepAlives = (currentConfig.successfulKeepAlives || 0) + 1;
                fs.writeFileSync(connectionConfigFile, JSON.stringify(currentConfig, null, 2));
              }
            } catch (updateErr) {
              console.error('Error actualizando archivo de configuración:', updateErr);
            }
          })
          .catch(err => {
            console.error('Error en keep-alive (modo ultra-persistente):', err);
            
            // Intentar recuperar inmediatamente la conexión
            this.handleConnectionError(err).catch(handleErr => {
              console.error('Error en recuperación de conexión ultra-persistente:', handleErr);
            });
          });
      }, 20000); // Cada 20 segundos
      
      console.log('Modo de conexión ultra-persistente activado exitosamente');
      return true;
    } catch (error) {
      console.error('Error activando modo de conexión ultra-persistente:', error);
      return false;
    }
  }
  
  /**
   * Desactiva el modo de conexión ultra-persistente
   * Vuelve al modo de conexión estándar o lo desactiva completamente
   */
  deactivateUnbreakableConnection(): boolean {
    try {
      console.log('Desactivando modo de conexión ultra-persistente...');
      
      // Detener los timers existentes
      this.stopConnectionTimers();
      
      // Actualizar el archivo de configuración
      const connectionConfigFile = path.join(SESSION_PATH, 'permanent_connection.json');
      if (fs.existsSync(connectionConfigFile)) {
        const connectionConfig = JSON.parse(fs.readFileSync(connectionConfigFile, 'utf8'));
        connectionConfig.active = false;
        connectionConfig.deactivatedAt = new Date().toISOString();
        fs.writeFileSync(connectionConfigFile, JSON.stringify(connectionConfig, null, 2));
      }
      
      // Volver a activar los timers estándar
      this.activatePermanentConnection().catch(err => {
        console.error('Error restableciendo conexión estándar:', err);
      });
      
      console.log('Modo de conexión ultra-persistente desactivado');
      return true;
    } catch (error) {
      console.error('Error desactivando modo ultra-persistente:', error);
      return false;
    }
  }
  
  /**
   * Realiza una acción para mantener activa la conexión
   */
  private async performKeepAlive(): Promise<void> {
    if (!this.client || !this.status.authenticated) return;
    
    try {
      // Obtener el estado simplemente para mantener la conexión activa
      await this.client.getState();
      console.log('Keep-alive de WhatsApp ejecutado correctamente');
    } catch (error) {
      console.error('Error en keep-alive de WhatsApp:', error);
      
      // Si falla, verificar la conexión completa
      await this.checkConnection();
    }
  }
  
  /**
   * Verifica el estado de la conexión y la reactiva si es necesario
   * Implementa una estrategia robusta de reconexión con múltiples intentos
   */
  async checkConnection(): Promise<boolean> {
    // Variable para rastrear el último intento de reconexión
    const lastReconnectAttemptFile = path.join(SESSION_PATH, 'last_reconnect_attempt.txt');
    const now = Date.now();
    
    // Verificar si hemos intentado reconectar recientemente (evitar bucles de reconexiones)
    try {
      if (fs.existsSync(lastReconnectAttemptFile)) {
        const lastAttemptTime = parseInt(fs.readFileSync(lastReconnectAttemptFile, 'utf8'));
        // Si han pasado menos de 2 minutos desde el último intento, no intentar de nuevo
        if (now - lastAttemptTime < 2 * 60 * 1000) {
          console.log('Último intento de reconexión hace menos de 2 minutos, esperando...');
          return false;
        }
      }
      // Registrar este intento
      fs.writeFileSync(lastReconnectAttemptFile, now.toString());
    } catch (err) {
      console.error('Error verificando tiempo desde último intento:', err);
    }
    
    if (!this.client) {
      console.log('Cliente de WhatsApp no inicializado, inicializando...');
      try {
        await this.initialize();
        return true;
      } catch (error) {
        console.error('Error inicializando cliente de WhatsApp:', error);
        return false;
      }
    }
    
    let reconnectAttempts = 0;
    
    try {
      // Verificar el estado actual de la conexión
      const state = await this.client.getState();
      
      console.log('Estado actual de la conexión WhatsApp:', state);
      
      this.status.lastConnectionCheck = new Date();
      this.status.connectionState = state;
      
      // Si está conectado, registrarlo en el archivo de estado
      if (state === 'CONNECTED') {
        this.updateSessionStatusFile();
        return true;
      }
      
      // Verificar si estamos esperando autenticación (QR code scan)
      if (state === null && this.status.qrCode) {
        console.log('Esperando autenticación mediante escaneo de código QR...');
        // No iniciar reconexiones si estamos esperando que se escanee el QR
        return false;
      }
      
      // Estrategia de reconexión en cascada (desde opciones ligeras a más invasivas)
      console.log('WhatsApp no está conectado (estado: ' + state + '), intentando reconexión...');
      
      // PASO 1: Intentar reconexión suave usando la API interna de WhatsApp Web
      try {
        if (this.client.pupPage) {
          console.log('Intento #1: Reconexión suave mediante API interna');
          await this.client.pupPage.evaluate(() => {
            // @ts-ignore - Store es parte de la API interna de WhatsApp Web
            if (window.Store && window.Store.AppState) {
              return window.Store.AppState.checkState();
            }
            // @ts-ignore
            if (window.Store && window.Store.State) {
              return window.Store.State.default.checkState();
            }
            return null;
          });
          
          // Verificar si la reconexión suave funcionó
          const newState = await this.client.getState();
          if (newState === 'CONNECTED') {
            console.log('Reconexión suave exitosa');
            this.updateSessionStatusFile(); // Actualizar estado de sesión
            return true;
          }
        }
      } catch (err) {
        console.error('Reconexión suave falló:', err);
      }
      
      // PASO 2: Intentar mantener la sesión pero con reinicialización parcial
      reconnectAttempts++;
      if (reconnectAttempts <= RECONNECT_ATTEMPTS_MAX) {
        try {
          console.log(`Intento #${reconnectAttempts+1}: Reconexión mediante reenfoque de página`);
          
          // Recargar la página de WhatsApp Web sin perder la sesión
          if (this.client.pupPage) {
            await this.client.pupPage.evaluate(() => {
              // @ts-ignore - API interna de WhatsApp Web
              if (window.Store && window.Store.ServiceWorker) {
                return window.Store.ServiceWorker.default.registerUpdates();
              }
              return null;
            });
            
            // Esperar un momento para la reconexión
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Verificar si la reconexión funcionó
            const newState = await this.client.getState();
            if (newState === 'CONNECTED') {
              console.log('Reconexión mediante reenfoque exitosa');
              this.updateSessionStatusFile(); // Actualizar estado de sesión
              return true;
            }
          }
        } catch (err) {
          console.error('Reconexión mediante reenfoque falló:', err);
        }
      }
      
      // Verificar si la última autenticación fue hace más de 24 horas
      // Si es así, es mejor esperar a un nuevo escaneo de QR en lugar de reiniciar constantemente
      const sessionStatusFile = path.join(SESSION_PATH, 'session_active.json');
      try {
        if (fs.existsSync(sessionStatusFile)) {
          const sessionData = JSON.parse(fs.readFileSync(sessionStatusFile, 'utf8'));
          if (sessionData.authenticated) {
            const lastAuthTime = new Date(sessionData.authenticatedAt || sessionData.activatedAt);
            const timeSinceAuth = Date.now() - lastAuthTime.getTime();
            
            // Si la autenticación es muy antigua, esperar nuevo QR en lugar de reiniciar
            if (timeSinceAuth > 24 * 60 * 60 * 1000) {
              console.log('Autenticación antigua, esperando nuevo escaneo de QR...');
              return false;
            }
          }
        }
      } catch (err) {
        console.error('Error verificando tiempo de autenticación:', err);
      }
      
      // PASO 3: Reinicio completo como último recurso, pero solo si la última reconexión fue hace tiempo
      console.log('Intento final: Reinicio completo del cliente...');
      await this.restart();
      
      // Verificar si el reinicio completo funcionó
      try {
        const finalState = await this.client.getState();
        if (finalState === 'CONNECTED') {
          this.updateSessionStatusFile(); // Actualizar estado de sesión
        }
        return finalState === 'CONNECTED';
      } catch (error) {
        console.error('Error verificando estado tras reinicio completo:', error);
        return false;
      }
    } catch (error) {
      console.error('Error verificando conexión de WhatsApp:', error);
      
      // Si hay error en la verificación, intentar reiniciar el cliente
      // pero solo si no lo hemos intentado recientemente
      try {
        console.log('Intentando reiniciar cliente de WhatsApp tras error...');
        await this.restart();
        return true;
      } catch (restartError) {
        console.error('Error reiniciando cliente de WhatsApp:', restartError);
        return false;
      }
    }
  }
  
  /**
   * Actualiza la lista de chats disponibles
   */
  private async refreshChats(): Promise<void> {
    if (!this.client || !this.status.authenticated) return;
    
    try {
      console.log('Actualizando lista de chats...');
      
      // Obtener todos los chats de WhatsApp
      const chats = await this.client.getChats();
      
      // Actualizar caché de chats
      for (const chat of chats) {
        await this.updateChatInfo(chat);
      }
      
      console.log(`${chats.length} chats actualizados correctamente`);
    } catch (error) {
      console.error('Error actualizando chats:', error);
    }
  }
  
  /**
   * Obtiene la lista de chats disponibles
   */
  async getChats(): Promise<WhatsAppChat[]> {
    // Si no hay caché o está vacía, intentar cargar
    if (this.chatCache.size === 0) {
      await this.refreshChats();
    }
    
    // Convertir el mapa a un array y ordenar por timestamp (más reciente primero)
    return Array.from(this.chatCache.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }
  
  /**
   * Obtiene los mensajes de un chat específico
   */
  async getMessages(chatId: string, limit: number = 100): Promise<WhatsAppMessage[]> {
    if (!this.client || !this.status.authenticated) {
      throw new Error('Cliente no inicializado o no autenticado');
    }
    
    try {
      // Verificar si tenemos mensajes en caché
      if (this.messageCache.has(chatId)) {
        const cachedMessages = this.messageCache.get(chatId) || [];
        
        // Si tenemos suficientes mensajes en caché, usarlos
        if (cachedMessages.length >= limit) {
          return cachedMessages.slice(0, limit);
        }
      }
      
      // Si no hay suficientes en caché, cargar desde WhatsApp
      console.log(`Cargando mensajes para el chat ${chatId}...`);
      
      // Obtener el chat
      const chat = await this.client.getChatById(chatId);
      
      // Cargar los mensajes
      await chat.fetchMessages({ limit });
      
      // Obtener los mensajes cargados
      const messages = await chat.fetchMessages({ limit });
      
      // Convertir a nuestro formato
      const convertedMessages: WhatsAppMessage[] = messages.map(msg => this.convertToWhatsAppMessage(msg));
      
      // Actualizar caché
      this.messageCache.set(chatId, convertedMessages);
      
      return convertedMessages;
    } catch (error) {
      console.error(`Error obteniendo mensajes para ${chatId}:`, error);
      
      // Devolver caché si existe, o un array vacío
      return this.messageCache.get(chatId) || [];
    }
  }
  
  /**
   * Marca un chat como leído
   */
  async markChatAsRead(chatId: string): Promise<void> {
    if (!this.client || !this.status.authenticated) {
      throw new Error('Cliente no inicializado o no autenticado');
    }
    
    try {
      const chat = await this.client.getChatById(chatId);
      await chat.sendSeen();
      console.log(`Chat ${chatId} marcado como leído`);
    } catch (error) {
      console.error(`Error marcando chat ${chatId} como leído:`, error);
      throw error;
    }
  }
  
  /**
   * Obtiene las etiquetas personalizadas para contactos
   * @returns Lista de etiquetas personalizadas
   */
  async getCustomTags(): Promise<any[]> {
    try {
      // Cargar etiquetas desde el archivo si existen
      if (fs.existsSync(this.customTagsFile)) {
        const data = fs.readFileSync(this.customTagsFile, 'utf8');
        try {
          this.customTags = JSON.parse(data);
        } catch (err) {
          console.error("Error al parsear etiquetas:", err);
          this.customTags = [];
        }
      }
      
      return this.customTags;
    } catch (error) {
      console.error("Error al obtener etiquetas personalizadas:", error);
      return [];
    }
  }
  
  /**
   * Guarda una nueva etiqueta personalizada
   * @param tag Datos de la etiqueta a guardar
   * @returns Etiqueta guardada con su ID
   */
  async saveCustomTag(tag: any): Promise<any> {
    try {
      // Cargar etiquetas existentes
      await this.getCustomTags();
      
      // Verificar si ya existe una etiqueta con el mismo ID
      const existingIndex = this.customTags.findIndex(t => t.id === tag.id);
      
      if (existingIndex >= 0) {
        // Actualizar etiqueta existente
        this.customTags[existingIndex] = { 
          ...this.customTags[existingIndex],
          ...tag,
          updatedAt: new Date().toISOString()
        };
      } else {
        // Agregar nueva etiqueta
        this.customTags.push({
          ...tag,
          createdAt: new Date().toISOString()
        });
      }
      
      // Guardar las etiquetas en el archivo
      fs.writeFileSync(
        this.customTagsFile, 
        JSON.stringify(this.customTags, null, 2),
        'utf8'
      );
      
      return tag;
    } catch (error) {
      console.error("Error al guardar etiqueta personalizada:", error);
      throw error;
    }
  }
}

// Exportamos una instancia del servicio
export const whatsappService = new WhatsAppServiceImpl();
export const whatsappServiceImpl = whatsappService;
export default whatsappService;