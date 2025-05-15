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

// Directorio para sesiones de WhatsApp
const SESSION_PATH = path.join(TEMP_DIR, 'whatsapp-sessions');
if (!fs.existsSync(SESSION_PATH)) {
  fs.mkdirSync(SESSION_PATH, { recursive: true });
}

// Archivo para guardar el QR en texto
const QR_TEXT_FILE = path.join(TEMP_DIR, 'whatsapp-qr.txt');

// Intervalos para mantener la conexión
const CONNECTION_CHECK_INTERVAL = 15 * 60 * 1000; // 15 minutos
const KEEP_ALIVE_INTERVAL = 45 * 1000; // 45 segundos

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
   * Inicializa el cliente de WhatsApp Web
   */
  async initialize(): Promise<void> {
    try {
      if (this.client) {
        console.log('Cliente WhatsApp ya inicializado');
        return;
      }

      console.log('Inicializando cliente de WhatsApp Web...');

      // Configuración de puppeteer para Replit
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
          '--disable-gpu'
        ]
      };

      // Inicializamos el cliente con la configuración de puppeteer
      this.client = new Client({
        puppeteer: puppeteerOptions
      });

      // Configuramos los eventos del cliente
      this.setupClientEvents();

      // Iniciamos el cliente
      await this.client.initialize();
      
      this.status.initialized = true;
      console.log('Cliente de WhatsApp Web inicializado exitosamente');
      
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
      this.status.qrCode = undefined;
      this.status.error = undefined;
      
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

    // Evento cuando se desconecta
    this.client.on('disconnected', (reason) => {
      console.log('Cliente WhatsApp desconectado:', reason);
      this.status.authenticated = false;
      this.status.ready = false;
      this.status.error = `Desconectado: ${reason}`;
      this.emit('disconnected', reason);
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
        
        // Enviar notificación global vía WebSocket (usando función global)
        if (global.sendNotification) {
          (global as any).sendNotification({
            type: 'new_message',
            contactName,
            messageText: message.body,
            timestamp: new Date()
          });
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
   */
  async activatePermanentConnection(): Promise<void> {
    // Detener timers existentes si los hay
    this.stopConnectionTimers();
    
    // Configurar timer para verificar la conexión periódicamente
    this.connectionCheckTimer = setInterval(() => {
      this.checkConnection().catch(err => {
        console.error('Error verificando conexión de WhatsApp:', err);
      });
    }, CONNECTION_CHECK_INTERVAL);
    
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
   */
  async checkConnection(): Promise<boolean> {
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
    
    try {
      // Verificar el estado actual de la conexión
      const state = await this.client.getState();
      
      console.log('Estado actual de la conexión WhatsApp:', state);
      
      this.status.lastConnectionCheck = new Date();
      this.status.connectionState = state;
      
      // Si no está conectado, intentar reconectar
      if (state !== 'CONNECTED') {
        console.log('WhatsApp no está conectado, intentando reconexión...');
        
        // Usar forceRefocus para intentar reconectar sin reiniciar todo
        try {
          await this.client.pupPage.evaluate(() => {
            return window.Store.AppState.checkState();
          });
          console.log('Reconexión de WhatsApp iniciada');
          return true;
        } catch (err) {
          console.error('Error en reconexión suave:', err);
          
          // Si no funciona, intentar restart completo
          console.log('Intentando reinicio completo del cliente...');
          await this.restart();
          return true;
        }
      }
      
      return state === 'CONNECTED';
    } catch (error) {
      console.error('Error verificando conexión de WhatsApp:', error);
      
      // Si hay error en la verificación, intentar reiniciar el cliente
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
}

// Exportamos una instancia del servicio
export const whatsappService = new WhatsAppServiceImpl();