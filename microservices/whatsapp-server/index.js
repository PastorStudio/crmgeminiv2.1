/**
 * WhatsApp Server
 * Servidor dedicado exclusivamente a mantener las conexiones con WhatsApp
 * Se encarga de gestionar sesiones, reconexiones y comunicación con WhatsApp Web
 */

const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuración básica
const app = express();
const PORT = process.env.WHATSAPP_SERVER_PORT || 5001;
const httpServer = createServer(app);

// Configuración de middleware
app.use(express.json());
app.use(cors());

// Configuración de WebSocket para comunicación con otros servidores
const internalWss = new WebSocketServer({ server: httpServer, path: '/internal-ws' });

// WebSocket para enviar actualizaciones a clientes (QR codes, etc.)
const clientWss = new WebSocketServer({ server: httpServer, path: '/client-ws' });

// Directorio para almacenar datos de sesión
const SESSION_DIR = path.join(__dirname, 'sessions');
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

// Directorio para QR codes
const QR_DIR = path.join(__dirname, 'qrcodes');
if (!fs.existsSync(QR_DIR)) {
  fs.mkdirSync(QR_DIR, { recursive: true });
}

// Configuración de servidores
const API_SERVER = process.env.API_SERVER || 'http://localhost:5000';
const PROCESSOR_SERVER = process.env.PROCESSOR_SERVER || 'http://localhost:5002';
const DATABASE_SERVER = process.env.DATABASE_SERVER || 'http://localhost:5003';

// Constantes para manejo de reconexión
const RECONNECT_ATTEMPTS_MAX = 10; // Aumentado para mayor persistencia
const CONNECTION_CHECK_INTERVAL = 3 * 60 * 1000; // 3 minutos
const KEEP_ALIVE_INTERVAL = 20 * 1000; // 20 segundos
const AUTO_RECONNECT_INTERVAL = 60 * 1000; // 1 minuto
const PERMANENT_CONNECTION_ENABLED = true; // Flag para activar conexión permanente

// Estado de clientes WhatsApp
const whatsappClients = new Map();

// Clase para gestionar clientes de WhatsApp
class WhatsAppClientManager {
  constructor(id, name = 'Default') {
    this.id = id;
    this.name = name;
    this.client = null;
    this.qrCode = null;
    this.status = {
      initialized: false,
      authenticated: false,
      ready: false,
      connectionState: null,
      lastConnectionCheck: null,
      error: null
    };
    this.sessionPath = path.join(SESSION_DIR, `session_${id}.json`);
    this.qrPath = path.join(QR_DIR, `qr_${id}.png`);
    this.connectionTimers = {
      connectionCheck: null,
      keepAlive: null
    };
    this.lastReconnectAttempt = 0;
  }

  // Inicializa el cliente de WhatsApp
  async initialize() {
    try {
      console.log(`Inicializando cliente WhatsApp ID ${this.id} (${this.name})`);
      
      // Verificar si existe sesión previa
      let sessionData = null;
      if (fs.existsSync(this.sessionPath)) {
        try {
          const data = fs.readFileSync(this.sessionPath, 'utf8');
          sessionData = JSON.parse(data);
          console.log(`Sesión existente encontrada para cuenta ID ${this.id}. Intentando recuperar...`);
        } catch (err) {
          console.error(`Error leyendo sesión para cuenta ID ${this.id}:`, err);
        }
      }
      
      // Opciones del cliente
      const clientOptions = {
        puppeteer: {
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
        },
        session: sessionData
      };
      
      // Crear cliente
      this.client = new Client(clientOptions);
      
      // Configurar eventos
      this.setupEvents();
      
      // Inicializar cliente
      await this.client.initialize();
      this.status.initialized = true;
      
      // Activar mecanismos de conexión permanente
      if (PERMANENT_CONNECTION_ENABLED) {
        this.activatePermanentConnection();
      }
      
      return true;
    } catch (error) {
      console.error(`Error inicializando cliente WhatsApp ID ${this.id}:`, error);
      this.status.error = error.message;
      return false;
    }
  }
  
  // Configura los eventos del cliente WhatsApp
  setupEvents() {
    // Evento QR Code
    this.client.on('qr', async (qr) => {
      console.log(`Nuevo código QR recibido para cuenta ID ${this.id} (${this.name})`);
      
      // Guardar QR en archivo
      try {
        this.qrCode = qr;
        await qrcode.toFile(this.qrPath, qr);
        console.log(`Código QR guardado en: ${this.qrPath}`);
        
        // Enviar QR a clientes conectados
        this.broadcastToClients({
          type: 'qr_code',
          accountId: this.id,
          accountName: this.name,
          qr: qr
        });
      } catch (err) {
        console.error(`Error guardando QR para cuenta ID ${this.id}:`, err);
      }
    });
    
    // Evento de autenticación exitosa
    this.client.on('authenticated', (session) => {
      console.log(`Cliente WhatsApp autenticado para cuenta ID ${this.id} (${this.name})`);
      
      // Guardar datos de sesión
      if (session) {
        fs.writeFileSync(this.sessionPath, JSON.stringify(session));
        console.log(`Sesión guardada para cuenta ID ${this.id}`);
      }
      
      this.status.authenticated = true;
      this.status.error = null;
      this.qrCode = null;
      
      // Notificar a clientes
      this.broadcastToClients({
        type: 'authentication',
        accountId: this.id,
        accountName: this.name,
        authenticated: true
      });
    });
    
    // Evento de autenticación fallida
    this.client.on('auth_failure', (msg) => {
      console.error(`Error de autenticación para cuenta ID ${this.id}:`, msg);
      this.status.authenticated = false;
      this.status.error = `Error de autenticación: ${msg}`;
      
      // Notificar a clientes
      this.broadcastToClients({
        type: 'authentication',
        accountId: this.id,
        accountName: this.name,
        authenticated: false,
        error: msg
      });
    });
    
    // Evento de cliente listo
    this.client.on('ready', () => {
      console.log(`Cliente WhatsApp listo para cuenta ID ${this.id} (${this.name})`);
      this.status.ready = true;
      this.status.authenticated = true;
      this.status.error = null;
      
      // Notificar a clientes
      this.broadcastToClients({
        type: 'ready',
        accountId: this.id,
        accountName: this.name
      });
      
      // Verificar que los temporizadores de conexión permanente estén activos
      if (PERMANENT_CONNECTION_ENABLED) {
        this.activatePermanentConnection();
      }
    });
    
    // Evento de desconexión
    this.client.on('disconnected', async (reason) => {
      console.log(`Cliente WhatsApp desconectado para cuenta ID ${this.id} (${this.name}): ${reason}`);
      this.status.authenticated = false;
      this.status.ready = false;
      this.status.error = `Desconectado: ${reason}`;
      
      // Notificar a clientes
      this.broadcastToClients({
        type: 'disconnected',
        accountId: this.id,
        accountName: this.name,
        reason: reason
      });
      
      // Iniciar proceso de reconexión automática si está habilitada
      if (PERMANENT_CONNECTION_ENABLED) {
        console.log(`Iniciando reconexión automática para cuenta ID ${this.id}...`);
        setTimeout(() => this.attemptConnectionRecovery(), 5000);
      }
    });
    
    // Evento de mensaje recibido
    this.client.on('message', async (message) => {
      console.log(`Mensaje recibido en cuenta ID ${this.id} de ${message.from}`);
      
      // Convertir mensaje a nuestro formato
      const formattedMessage = await this.convertToWhatsAppMessage(message);
      
      // Enviar mensaje al servidor de procesamiento
      try {
        await axios.post(`${PROCESSOR_SERVER}/process-message`, {
          accountId: this.id,
          accountName: this.name,
          message: formattedMessage
        });
      } catch (error) {
        console.error(`Error enviando mensaje al processor para cuenta ID ${this.id}:`, error.message);
      }
      
      // Notificar a clientes
      this.broadcastToClients({
        type: 'new_message',
        accountId: this.id,
        accountName: this.name,
        message: formattedMessage
      });
    });
  }
  
  // Activa los temporizadores para mantener la conexión permanente
  activatePermanentConnection() {
    // Limpiar timers existentes si los hay
    this.deactivateConnectionTimers();
    
    // Configurar temporizador para verificar la conexión
    this.connectionTimers.connectionCheck = setInterval(() => {
      this.checkConnection()
        .catch(err => console.error(`Error verificando conexión para cuenta ID ${this.id}:`, err));
    }, CONNECTION_CHECK_INTERVAL);
    
    // Configurar temporizador para mantener viva la conexión
    this.connectionTimers.keepAlive = setInterval(() => {
      this.keepConnectionAlive()
        .catch(err => console.error(`Error en keepAlive para cuenta ID ${this.id}:`, err));
    }, KEEP_ALIVE_INTERVAL);
    
    console.log(`Timers de conexión permanente configurados para cuenta ID ${this.id}`);
  }
  
  // Desactiva los temporizadores de conexión
  deactivateConnectionTimers() {
    if (this.connectionTimers.connectionCheck) {
      clearInterval(this.connectionTimers.connectionCheck);
      this.connectionTimers.connectionCheck = null;
    }
    
    if (this.connectionTimers.keepAlive) {
      clearInterval(this.connectionTimers.keepAlive);
      this.connectionTimers.keepAlive = null;
    }
  }
  
  // Verifica el estado de la conexión
  async checkConnection() {
    if (!this.client) return false;
    
    try {
      // Verificar estado actual
      const state = await this.client.getState();
      
      this.status.connectionState = state;
      this.status.lastConnectionCheck = new Date();
      
      console.log(`Estado de conexión para cuenta ID ${this.id}: ${state || 'desconocido'}`);
      
      // Si está conectado, todo bien
      if (state === 'CONNECTED') {
        return true;
      }
      
      // Si no está conectado, intentar recuperar si ha pasado suficiente tiempo
      if (Date.now() - this.lastReconnectAttempt > AUTO_RECONNECT_INTERVAL) {
        console.log(`Conexión no activa para cuenta ID ${this.id}, intentando recuperar...`);
        return await this.attemptConnectionRecovery();
      }
      
      return false;
    } catch (error) {
      console.error(`Error verificando conexión para cuenta ID ${this.id}:`, error);
      
      // Si hay un error al verificar el estado, intentar recuperar la conexión
      if (Date.now() - this.lastReconnectAttempt > AUTO_RECONNECT_INTERVAL * 2) {
        console.log(`Intentando recuperar conexión después de error para cuenta ID ${this.id}...`);
        return await this.attemptConnectionRecovery(true);
      }
      
      return false;
    }
  }
  
  // Mantiene la conexión activa
  async keepConnectionAlive() {
    if (!this.client) {
      if (PERMANENT_CONNECTION_ENABLED) {
        console.log(`[Conexión Permanente] No hay cliente para cuenta ID ${this.id}, intentando inicializar...`);
        try {
          await this.initialize();
          
          // Registrar en base de datos
          try {
            await axios.put(`${DATABASE_SERVER}/whatsapp-accounts/${this.id}`, {
              status: 'reconnecting',
              sessionData: {
                permanentConnection: true,
                lastReconnectAttempt: new Date().toISOString()
              }
            });
          } catch (dbErr) {
            console.error(`[Conexión Permanente] Error actualizando estado en BD:`, dbErr);
          }
        } catch (err) {
          console.error(`[Conexión Permanente] Error inicializando cuenta ID ${this.id}:`, err);
        }
      }
      return;
    }
    
    try {
      // Verificar estado actual
      const state = await this.client.getState();
      
      // Actualizar el estado interno
      this.status.connectionState = state;
      this.status.lastConnectionCheck = new Date();
      
      // Si está conectado, actualizar el estado y mantener sesión activa
      if (state === 'CONNECTED') {
        // Registrar en base de datos
        try {
          await axios.put(`${DATABASE_SERVER}/whatsapp-accounts/${this.id}`, {
            status: 'active',
            sessionData: {
              connectionState: state,
              permanentConnection: PERMANENT_CONNECTION_ENABLED,
              lastActive: new Date().toISOString()
            }
          });
        } catch (dbErr) {
          console.error(`[Conexión Permanente] Error actualizando estado en BD:`, dbErr);
        }
        
        // Realizar una petición sencilla para mantener la sesión activa
        try {
          // Acceder a información de usuario mantiene la sesión activa
          const info = await this.client.getInfo();
          console.log(`[Conexión Permanente] Mantener activa cuenta ID ${this.id} - OK`);
        } catch (pingErr) {
          console.warn(`[Conexión Permanente] Error en ping para cuenta ID ${this.id}:`, pingErr);
        }
        
        return;
      }
      
      // Si no está conectado, intentar recuperar si ha pasado suficiente tiempo
      if (Date.now() - this.lastReconnectAttempt > AUTO_RECONNECT_INTERVAL) {
        console.log(`[Conexión Permanente] Conexión no activa (${state}) para cuenta ID ${this.id}, intentando recuperar...`);
        await this.attemptConnectionRecovery();
        
        // Registrar en base de datos
        try {
          await axios.put(`${DATABASE_SERVER}/whatsapp-accounts/${this.id}`, {
            status: 'reconnecting',
            sessionData: {
              connectionState: state,
              permanentConnection: PERMANENT_CONNECTION_ENABLED,
              lastReconnectAttempt: new Date().toISOString()
            }
          });
        } catch (dbErr) {
          console.error(`[Conexión Permanente] Error actualizando estado en BD:`, dbErr);
        }
      }
    } catch (error) {
      console.error(`[Conexión Permanente] Error en keepAlive para cuenta ID ${this.id}:`, error);
      
      // Si hay un error en la verificación del estado, iniciar recuperación de emergencia
      if (Date.now() - this.lastReconnectAttempt > AUTO_RECONNECT_INTERVAL * 2) {
        console.log(`[Conexión Permanente] Intentando recuperación de emergencia para cuenta ID ${this.id}...`);
        await this.attemptConnectionRecovery(true);
      }
    }
  }
  
  // Intenta recuperar una conexión perdida
  async attemptConnectionRecovery(forceReinit = false) {
    // Actualizar timestamp del último intento
    this.lastReconnectAttempt = Date.now();
    
    // Registrar en base de datos
    try {
      await axios.put(`${DATABASE_SERVER}/whatsapp-accounts/${this.id}`, {
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
      // Si se fuerza la reinicialización o no hay cliente, inicializar nuevo
      if (forceReinit || !this.client) {
        console.log(`[Conexión Permanente] Reinicializando cliente para cuenta ID ${this.id}...`);
        
        // Cerrar cliente existente si es necesario
        if (this.client) {
          try {
            await this.client.destroy();
          } catch (err) {
            console.error(`[Conexión Permanente] Error al cerrar cliente para cuenta ID ${this.id}:`, err);
          }
          this.client = null;
        }
        
        // Crear nueva instancia
        return await this.initialize();
      }
      
      // Estrategia progresiva de reconexión
      try {
        const state = await this.client.getState();
        console.log(`[Conexión Permanente] Estado actual para cuenta ID ${this.id}: ${state}`);
        
        if (state !== 'CONNECTED') {
          // Intentar resetear el estado (opción suave)
          console.log(`[Conexión Permanente] Intento de reconexión suave para cuenta ID ${this.id}...`);
          try {
            if (this.client.pupPage) {
              // Intentar recargar la página de WhatsApp Web
              await this.client.pupPage.reload();
              await new Promise(resolve => setTimeout(resolve, 5000)); // Esperar a que cargue
              
              // Verificar nuevamente
              const newState = await this.client.getState().catch(() => 'ERROR');
              
              if (newState === 'CONNECTED') {
                console.log(`[Conexión Permanente] Recarga de página exitosa para cuenta ID ${this.id}`);
                return true;
              }
            }
          } catch (reloadErr) {
            console.error(`[Conexión Permanente] Error recargando página para cuenta ID ${this.id}:`, reloadErr);
          }
          
          // Si no funciona, reinicializar completamente
          console.log(`[Conexión Permanente] Recarga falló, reinicializando cliente para cuenta ID ${this.id}...`);
          
          // Cerrar cliente existente
          try {
            await this.client.destroy();
          } catch (err) {
            console.error(`[Conexión Permanente] Error al cerrar cliente para cuenta ID ${this.id}:`, err);
          }
          
          this.client = null;
          
          // Crear nueva instancia
          return await this.initialize();
        } else {
          console.log(`[Conexión Permanente] Cliente ya conectado para cuenta ID ${this.id}`);
          return true;
        }
      } catch (error) {
        console.error(`[Conexión Permanente] Error en recuperación para cuenta ID ${this.id}:`, error);
        
        // Si hay error en la recuperación, intentar reinicializar
        try {
          if (this.client) {
            await this.client.destroy();
          }
        } catch (err) {
          console.error(`[Conexión Permanente] Error cerrando cliente para cuenta ID ${this.id}:`, err);
        }
        
        this.client = null;
        return await this.initialize();
      }
    } catch (error) {
      console.error(`Error recuperando conexión para cuenta ID ${this.id}:`, error);
      return false;
    }
  }
  
  // Convierte un mensaje a nuestro formato interno con zona horaria
  async convertToWhatsAppMessage(message) {
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
        containsEmoji: false,
        timeZoneInfo: { detected: false }
      };
    }
    
    try {
      // Detectar la zona horaria
      let timeZoneInfo = { detected: false };
      
      try {
        // Obtener zona horaria desde el servidor de base de datos
        const response = await axios.get(`${DATABASE_SERVER}/timezone-config`);
        const timeZoneConfig = response.data;
        
        if (timeZoneConfig && timeZoneConfig.timeZone) {
          // Formatear la hora según la zona horaria detectada
          const timestamp = message.timestamp || Date.now() / 1000;
          const localDate = new Date(timestamp * 1000);
          
          const formattedTime = localDate.toLocaleString(undefined, { 
            timeZone: timeZoneConfig.timeZone,
            hour: '2-digit', 
            minute: '2-digit',
            month: 'short',
            day: 'numeric'
          });
          
          timeZoneInfo = {
            detected: true,
            timeZone: timeZoneConfig.timeZone,
            offset: timeZoneConfig.offset,
            formattedTime: formattedTime,
            source: timeZoneConfig.source,
            location: timeZoneConfig.location
          };
        }
      } catch (tzError) {
        console.error('Error detectando zona horaria:', tzError);
      }
      
      // Convertir timestamp a milisegundos para la zona horaria local
      const timestamp = message.timestamp || Date.now() / 1000;
      const timestampMs = timestamp * 1000; // Convertir a milisegundos
      
      return {
        id: message.id._serialized || message.id,
        body: message.body || '',
        from: message.from || '',
        to: message.to || '',
        fromMe: !!message.fromMe,
        timestamp: timestampMs,
        hasMedia: !!message.hasMedia,
        type: message.type || 'unknown',
        isStatus: !!message.isStatus,
        isForwarded: !!message.isForwarded,
        isStarred: !!message.isStarred,
        mediaUrl: undefined, // Se cargará bajo demanda
        caption: message.caption || '',
        containsEmoji: message.body ? /\p{Emoji}/u.test(message.body) : false,
        timeZoneInfo: timeZoneInfo
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
        containsEmoji: false,
        timeZoneInfo: { detected: false, error: true }
      };
    }
  }
  
  // Envía un mensaje a través de WhatsApp
  async sendMessage(to, body) {
    if (!this.client || !this.status.authenticated || !this.status.ready) {
      throw new Error(`Cliente WhatsApp ID ${this.id} no está listo para enviar mensajes`);
    }
    
    try {
      const result = await this.client.sendMessage(to, body);
      return result;
    } catch (error) {
      console.error(`Error enviando mensaje desde cuenta ID ${this.id}:`, error);
      throw error;
    }
  }
  
  // Obtiene los chats disponibles
  async getChats() {
    if (!this.client || !this.status.authenticated || !this.status.ready) {
      console.log(`Cliente WhatsApp ID ${this.id} no está listo para obtener chats`);
      return [];
    }
    
    try {
      const chats = await this.client.getChats();
      
      // Convertir a formato estándar
      return chats.map(chat => ({
        id: chat.id._serialized,
        name: chat.name || 'Sin nombre',
        isGroup: chat.isGroup,
        timestamp: chat.timestamp ? chat.timestamp * 1000 : Date.now(),
        unreadCount: chat.unreadCount || 0,
        lastMessage: chat.lastMessage ? chat.lastMessage.body : '',
        profilePicUrl: null, // Se cargará bajo demanda
        participants: chat.participants ? chat.participants.map(p => p.id._serialized) : []
      }));
    } catch (error) {
      console.error(`Error obteniendo chats para cuenta ID ${this.id}:`, error);
      return [];
    }
  }
  
  // Obtiene los mensajes de un chat específico
  async getMessages(chatId, limit = 50) {
    if (!this.client || !this.status.authenticated || !this.status.ready) {
      console.log(`Cliente WhatsApp ID ${this.id} no está listo para obtener mensajes`);
      return [];
    }
    
    try {
      const chat = await this.client.getChatById(chatId);
      const messages = await chat.fetchMessages({ limit });
      
      // Convertir a nuestro formato
      const convertedMessages = await Promise.all(
        messages.map(msg => this.convertToWhatsAppMessage(msg))
      );
      
      return convertedMessages;
    } catch (error) {
      console.error(`Error obteniendo mensajes para chat ${chatId} en cuenta ID ${this.id}:`, error);
      return [];
    }
  }
  
  // Cierra el cliente y libera recursos
  async close() {
    this.deactivateConnectionTimers();
    
    if (this.client) {
      try {
        await this.client.destroy();
        console.log(`Cliente WhatsApp ID ${this.id} cerrado correctamente`);
      } catch (error) {
        console.error(`Error cerrando cliente WhatsApp ID ${this.id}:`, error);
      }
      this.client = null;
    }
    
    this.status.initialized = false;
    this.status.authenticated = false;
    this.status.ready = false;
  }
  
  // Difunde un mensaje a todos los clientes conectados
  broadcastToClients(message) {
    clientWss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          ...message,
          timestamp: Date.now()
        }));
      }
    });
    
    // También informar a otros servidores a través del WebSocket interno
    internalWss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          ...message,
          timestamp: Date.now()
        }));
      }
    });
  }
}

// API Routes

// Endpoint de salud
app.get('/health', (req, res) => {
  const clientStatus = {};
  
  whatsappClients.forEach((client, id) => {
    clientStatus[id] = {
      name: client.name,
      status: client.status
    };
  });
  
  res.json({
    status: 'ok',
    server: 'whatsapp',
    clients: clientStatus
  });
});

// Obtener estado de un cliente específico
app.get('/status/:id?', (req, res) => {
  if (req.params.id) {
    const id = parseInt(req.params.id);
    const client = whatsappClients.get(id);
    
    if (!client) {
      return res.status(404).json({ error: `Cliente WhatsApp ID ${id} no encontrado` });
    }
    
    return res.json(client.status);
  }
  
  // Si no se proporciona ID, devolver el estado del primer cliente
  if (whatsappClients.size > 0) {
    const firstClient = whatsappClients.values().next().value;
    return res.json(firstClient.status);
  }
  
  res.status(404).json({ error: 'No hay clientes de WhatsApp activos' });
});

// Obtener QR code para un cliente
app.get('/qr/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const client = whatsappClients.get(id);
  
  if (!client) {
    return res.status(404).json({ error: `Cliente WhatsApp ID ${id} no encontrado` });
  }
  
  if (!client.qrCode) {
    return res.status(404).json({ error: `No hay código QR disponible para el cliente ID ${id}` });
  }
  
  res.json({ qrCode: client.qrCode });
});

// Obtener chats para un cliente
app.get('/chats/:id?', async (req, res) => {
  let clientId;
  
  if (req.params.id) {
    clientId = parseInt(req.params.id);
  } else if (whatsappClients.size > 0) {
    clientId = whatsappClients.keys().next().value;
  } else {
    return res.status(404).json({ error: 'No hay clientes de WhatsApp activos' });
  }
  
  const client = whatsappClients.get(clientId);
  
  if (!client) {
    return res.status(404).json({ error: `Cliente WhatsApp ID ${clientId} no encontrado` });
  }
  
  try {
    const chats = await client.getChats();
    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener mensajes de un chat para un cliente
app.get('/messages/:chatId', async (req, res) => {
  const { chatId } = req.params;
  const clientId = parseInt(req.query.clientId || '1');
  const limit = parseInt(req.query.limit || '50');
  
  const client = whatsappClients.get(clientId);
  
  if (!client) {
    return res.status(404).json({ error: `Cliente WhatsApp ID ${clientId} no encontrado` });
  }
  
  try {
    const messages = await client.getMessages(chatId, limit);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Enviar mensaje
app.post('/send', async (req, res) => {
  const { to, message, clientId = 1 } = req.body;
  
  if (!to || !message) {
    return res.status(400).json({ error: 'Se requieren los campos "to" y "message"' });
  }
  
  const client = whatsappClients.get(parseInt(clientId));
  
  if (!client) {
    return res.status(404).json({ error: `Cliente WhatsApp ID ${clientId} no encontrado` });
  }
  
  try {
    const result = await client.sendMessage(to, message);
    res.json({ success: true, messageId: result.id._serialized });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Inicializar cliente
app.post('/initialize/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { name } = req.body;
  
  if (whatsappClients.has(id)) {
    return res.status(400).json({ error: `Ya existe un cliente con ID ${id}` });
  }
  
  const client = new WhatsAppClientManager(id, name || `Cliente ${id}`);
  whatsappClients.set(id, client);
  
  try {
    await client.initialize();
    res.json({ success: true, status: client.status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cerrar cliente
app.post('/close/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const client = whatsappClients.get(id);
  
  if (!client) {
    return res.status(404).json({ error: `Cliente WhatsApp ID ${id} no encontrado` });
  }
  
  try {
    await client.close();
    whatsappClients.delete(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket para comunicación interna entre servidores
internalWss.on('connection', (ws) => {
  console.log('Nueva conexión interna establecida con otro servidor');
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Mensaje recibido desde otro servidor:', data.type);
      
      // Manejar diferentes tipos de mensajes
      if (data.type === 'initialize_client') {
        const { id, name } = data;
        if (!whatsappClients.has(id)) {
          const client = new WhatsAppClientManager(id, name || `Cliente ${id}`);
          whatsappClients.set(id, client);
          await client.initialize();
        }
      }
      
      if (data.type === 'send_message') {
        const { clientId, to, message } = data;
        const client = whatsappClients.get(clientId);
        if (client) {
          await client.sendMessage(to, message);
        }
      }
      
      if (data.type === 'check_connection') {
        const { clientId } = data;
        const client = whatsappClients.get(clientId);
        if (client) {
          await client.checkConnection();
        }
      }
    } catch (error) {
      console.error('Error procesando mensaje interno:', error);
    }
  });
});

// WebSocket para clientes (frontend)
clientWss.on('connection', (ws) => {
  console.log('Nueva conexión de cliente establecida');
  
  // Enviar estado actual de todos los clientes
  const status = {};
  whatsappClients.forEach((client, id) => {
    status[id] = {
      id,
      name: client.name,
      status: client.status
    };
  });
  
  ws.send(JSON.stringify({
    type: 'init',
    clients: status,
    timestamp: Date.now()
  }));
});

// Cargar clientes desde la base de datos al inicio
async function loadClientsFromDatabase() {
  try {
    const response = await axios.get(`${DATABASE_SERVER}/whatsapp-accounts`);
    const accounts = response.data;
    
    console.log(`Cargando ${accounts.length} cuentas de WhatsApp desde la base de datos...`);
    
    for (const account of accounts) {
      const client = new WhatsAppClientManager(account.id, account.name);
      whatsappClients.set(account.id, client);
      await client.initialize();
    }
    
    console.log('Todas las cuentas de WhatsApp han sido inicializadas');
  } catch (error) {
    console.error('Error cargando cuentas de WhatsApp desde la base de datos:', error.message);
    
    // Si no podemos conectar con la base de datos, crear al menos un cliente por defecto
    if (whatsappClients.size === 0) {
      console.log('Creando cliente de WhatsApp por defecto...');
      const client = new WhatsAppClientManager(1, 'Cliente Principal');
      whatsappClients.set(1, client);
      await client.initialize();
    }
  }
}

// Iniciar servidor
httpServer.listen(PORT, () => {
  console.log(`WhatsApp Server corriendo en http://localhost:${PORT}`);
  
  // Cargar clientes desde la base de datos
  loadClientsFromDatabase().catch(err => {
    console.error('Error en carga inicial de clientes:', err);
  });
});