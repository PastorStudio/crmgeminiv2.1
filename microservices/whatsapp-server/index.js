/**
 * Servidor de WhatsApp - Microservicio independiente
 * 
 * Este microservicio gestiona todas las conexiones con WhatsApp Web,
 * manteniendo sesiones activas, procesando mensajes y proporcionando
 * una API para interactuar con WhatsApp.
 */

const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const app = express();
const PORT = process.env.WHATSAPP_SERVER_PORT || 5001;

// Middleware para JSON y CORS
app.use(express.json());
app.use(cors());

// Crear directorios necesarios
const TEMP_DIR = path.join(__dirname, '..', 'temp');
const QR_PATH = path.join(TEMP_DIR, 'qrcode.png');
const SESSION_DIR = path.join(TEMP_DIR, 'whatsapp-session');

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

// URL del servidor de base de datos
const DATABASE_SERVER_URL = process.env.DATABASE_SERVER_URL || 'http://localhost:5003';

// Cliente de WhatsApp
let whatsappClient = null;
let qrCode = null;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 5;
let reconnectionTimeout = null;

const whatsappStatus = {
  connected: false,
  qr: null,
  lastQR: null,
  connecting: false,
  lastError: null,
  lastConnection: null,
  lastDisconnection: null,
  clientInfo: null,
  permanentConnection: {
    active: false,
    lastKeepAlive: null,
    autoReconnect: true
  }
};

// Middleware para log de solicitudes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Middleware para manejar errores
app.use((err, req, res, next) => {
  console.error(`Error en ${req.method} ${req.url}:`, err);
  res.status(500).json({
    status: 'error',
    message: 'Error interno del servidor',
    error: err.message
  });
});

// Función para generar código QR
async function generateQRCode(qrCodeData) {
  try {
    // Guardar el código QR como archivo PNG
    await qrcode.toFile(QR_PATH, qrCodeData);
    
    // También generar como texto para consola
    const qrText = await qrcode.toString(qrCodeData, { type: 'terminal' });
    console.log('\nCódigo QR generado:\n');
    console.log(qrText);
    
    // Actualizar estado
    whatsappStatus.qr = qrCodeData;
    whatsappStatus.lastQR = new Date().toISOString();
    
    return qrCodeData;
  } catch (error) {
    console.error('Error al generar código QR:', error);
    throw error;
  }
}

// Función para inicializar el cliente de WhatsApp
function initializeWhatsAppClient() {
  if (whatsappClient) {
    console.log('Ya existe un cliente de WhatsApp, cerrando sesión antes de reiniciar...');
    try {
      whatsappClient.destroy();
    } catch (error) {
      console.error('Error al cerrar cliente existente:', error);
    }
    whatsappClient = null;
  }
  
  console.log('Iniciando cliente de WhatsApp...');
  whatsappStatus.connecting = true;
  
  // Configurar cliente con autenticación local
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
    authStrategy: new LocalAuth({
      clientId: 'whatsapp-integration',
      dataPath: SESSION_DIR
    }),
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2409.2.html'
    }
  };
  
  whatsappClient = new Client(clientOptions);
  
  // Eventos del cliente
  whatsappClient.on('qr', async (qr) => {
    console.log('QR Code recibido, generando imagen...');
    qrCode = qr;
    await generateQRCode(qr);
    
    // Actualizar estado en la base de datos
    try {
      await axios.put(`${DATABASE_SERVER_URL}/whatsapp-accounts/1`, {
        status: 'awaiting_connection',
        qrCode: qrCode
      });
    } catch (error) {
      console.error('Error al actualizar estado en base de datos:', error);
    }
  });
  
  whatsappClient.on('ready', async () => {
    console.log('Cliente de WhatsApp listo');
    whatsappStatus.connected = true;
    whatsappStatus.connecting = false;
    whatsappStatus.lastConnection = new Date().toISOString();
    whatsappStatus.lastError = null;
    connectionAttempts = 0;
    
    // Obtener información del cliente
    try {
      const info = await whatsappClient.getWWebVersion();
      whatsappStatus.clientInfo = {
        version: info,
        phone: (await whatsappClient.getInfo()).wid.user
      };
    } catch (error) {
      console.error('Error al obtener información del cliente:', error);
    }
    
    // Actualizar estado en la base de datos
    try {
      await axios.put(`${DATABASE_SERVER_URL}/whatsapp-accounts/1`, {
        status: 'connected',
        qrCode: null
      });
    } catch (error) {
      console.error('Error al actualizar estado en base de datos:', error);
    }
    
    // Activar conexión permanente
    activatePermanentConnection();
  });
  
  whatsappClient.on('authenticated', () => {
    console.log('Cliente autenticado');
    whatsappStatus.qr = null;
  });
  
  whatsappClient.on('auth_failure', (error) => {
    console.error('Error de autenticación:', error);
    whatsappStatus.lastError = {
      message: 'Error de autenticación',
      error: error.toString(),
      timestamp: new Date().toISOString()
    };
    
    // Si se configuró reconexión automática, intentar de nuevo
    if (whatsappStatus.permanentConnection.autoReconnect && connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
      connectionAttempts++;
      console.log(`Intentando reconectar (intento ${connectionAttempts} de ${MAX_CONNECTION_ATTEMPTS})...`);
      reconnectionTimeout = setTimeout(() => {
        initializeWhatsAppClient();
      }, 5000 * connectionAttempts); // Aumentar el tiempo entre intentos
    } else {
      console.log('Se alcanzó el número máximo de intentos de reconexión');
      whatsappStatus.connecting = false;
    }
  });
  
  whatsappClient.on('disconnected', async (reason) => {
    console.log('Cliente desconectado:', reason);
    whatsappStatus.connected = false;
    whatsappStatus.lastDisconnection = new Date().toISOString();
    
    // Actualizar estado en la base de datos
    try {
      await axios.put(`${DATABASE_SERVER_URL}/whatsapp-accounts/1`, {
        status: 'disconnected'
      });
    } catch (error) {
      console.error('Error al actualizar estado en base de datos:', error);
    }
    
    // Si se configuró reconexión automática, intentar de nuevo
    if (whatsappStatus.permanentConnection.autoReconnect && connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
      connectionAttempts++;
      console.log(`Intentando reconectar (intento ${connectionAttempts} de ${MAX_CONNECTION_ATTEMPTS})...`);
      reconnectionTimeout = setTimeout(() => {
        initializeWhatsAppClient();
      }, 5000 * connectionAttempts); // Aumentar el tiempo entre intentos
    } else {
      console.log('Se alcanzó el número máximo de intentos de reconexión o reconexión automática desactivada');
      whatsappStatus.connecting = false;
    }
  });
  
  whatsappClient.on('message', async (message) => {
    try {
      console.log(`Nuevo mensaje recibido de ${message.from}: ${message.body}`);
      
      // Preparar datos del mensaje
      const messageData = {
        accountId: 1, // Cuenta por defecto
        chatId: message.from,
        messageId: message.id._serialized,
        from_me: false,
        content: message.body,
        timestamp: new Date(message.timestamp * 1000).toISOString(),
        hasMedia: message.hasMedia,
        mediaUrl: null,
        mediaType: null,
        metadata: {
          notifyName: message._data.notifyName || '',
          type: message.type,
          isForwarded: message.isForwarded,
          isStatus: message.isStatus,
          isGroup: message.chat.isGroup
        }
      };
      
      // Si tiene media, obtenerla
      if (message.hasMedia) {
        try {
          const media = await message.downloadMedia();
          messageData.mediaType = media.mimetype;
          messageData.mediaUrl = `data:${media.mimetype};base64,${media.data}`;
        } catch (mediaError) {
          console.error('Error al descargar media:', mediaError);
        }
      }
      
      // Guardar mensaje en la base de datos
      try {
        await axios.post(`${DATABASE_SERVER_URL}/messages`, messageData);
      } catch (dbError) {
        console.error('Error al guardar mensaje en la base de datos:', dbError);
      }
      
      // Verificar si se debe enviar respuesta automática
      try {
        const configResponse = await axios.get(`${DATABASE_SERVER_URL}/auto-response/config`);
        const autoConfig = configResponse.data;
        
        if (autoConfig.enabled) {
          // Obtener horario actual
          const now = new Date();
          const currentHour = now.getHours();
          const currentMinutes = now.getMinutes();
          const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}:00`;
          const currentDay = now.getDay(); // 0 = domingo, 1 = lunes, ...
          
          // Verificar si estamos en horario laboral
          const businessHoursStart = autoConfig.businessHoursStart || '09:00:00';
          const businessHoursEnd = autoConfig.businessHoursEnd || '18:00:00';
          const workingDays = (autoConfig.workingDays || '1,2,3,4,5').split(',').map(d => parseInt(d));
          
          const isWorkingDay = workingDays.includes(currentDay);
          const isBusinessHours = currentTime >= businessHoursStart && currentTime <= businessHoursEnd;
          
          if (isWorkingDay && isBusinessHours) {
            console.log('Enviando mensaje de bienvenida (horario laboral)');
            await whatsappClient.sendMessage(message.from, autoConfig.greetingMessage);
          } else {
            console.log('Enviando mensaje fuera de horario');
            await whatsappClient.sendMessage(message.from, autoConfig.outOfHoursMessage);
          }
        }
      } catch (autoError) {
        console.error('Error al procesar respuesta automática:', autoError);
      }
    } catch (error) {
      console.error('Error al procesar mensaje:', error);
    }
  });
  
  // Iniciar cliente
  console.log('Iniciando cliente de WhatsApp...');
  whatsappClient.initialize()
    .catch(error => {
      console.error('Error al inicializar cliente:', error);
      whatsappStatus.lastError = {
        message: 'Error al inicializar cliente',
        error: error.toString(),
        timestamp: new Date().toISOString()
      };
      whatsappStatus.connecting = false;
    });
  
  return whatsappClient;
}

// Función para mantener la conexión activa
function activatePermanentConnection() {
  whatsappStatus.permanentConnection.active = true;
  
  // Función para realizar ping periódico para mantener conexión activa
  const keepAlive = async () => {
    if (whatsappStatus.connected && whatsappClient) {
      try {
        // Obtener estado para mantener conexión activa
        await whatsappClient.getState();
        whatsappStatus.permanentConnection.lastKeepAlive = new Date().toISOString();
        console.log('Conexión de WhatsApp: Activa');
      } catch (error) {
        console.error('Error al verificar estado de WhatsApp:', error);
      }
    }
    
    // Programar próximo ping
    setTimeout(keepAlive, 60000); // Cada minuto
  };
  
  // Iniciar ping periódico
  keepAlive();
  console.log('Conexión permanente activada');
}

// Función para convertir un objeto de mensaje de WhatsApp a nuestro formato
function convertWhatsAppMessage(message) {
  try {
    const timestamp = message.timestamp ? new Date(message.timestamp * 1000) : new Date();
    
    return {
      id: message.id._serialized,
      chatId: message.from,
      fromMe: message.fromMe,
      content: message.body,
      timestamp: timestamp.toISOString(),
      contact: message._data.notifyName || '',
      isRead: message.isStatus,
      hasMedia: message.hasMedia,
      mediaType: message.type !== 'chat' ? message.type : null,
      metadata: {
        type: message.type,
        isForwarded: message.isForwarded,
        isStatus: message.isStatus,
        isGroup: message.chat.isGroup
      }
    };
  } catch (error) {
    console.error('Error al convertir mensaje:', error);
    return {
      id: message.id ? message.id._serialized : `error-${Date.now()}`,
      content: 'Error al procesar mensaje',
      timestamp: new Date().toISOString(),
      fromMe: false,
      chatId: message.from || 'unknown',
      hasError: true
    };
  }
}

// Función para convertir un objeto de chat de WhatsApp a nuestro formato
function convertWhatsAppChat(chat) {
  try {
    return {
      id: chat.id._serialized,
      name: chat.name,
      isGroup: chat.isGroup,
      timestamp: chat.timestamp ? new Date(chat.timestamp * 1000).toISOString() : new Date().toISOString(),
      unreadCount: chat.unreadCount,
      lastMessage: chat.lastMessage ? {
        body: chat.lastMessage.body,
        fromMe: chat.lastMessage.fromMe,
        timestamp: chat.lastMessage.timestamp ? new Date(chat.lastMessage.timestamp * 1000).toISOString() : new Date().toISOString()
      } : null
    };
  } catch (error) {
    console.error('Error al convertir chat:', error);
    return {
      id: chat.id ? chat.id._serialized : `error-${Date.now()}`,
      name: chat.name || 'Error',
      isGroup: chat.isGroup || false,
      timestamp: new Date().toISOString(),
      unreadCount: chat.unreadCount || 0,
      hasError: true
    };
  }
}

// Ruta de salud para verificar que el servicio está funcionando
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'whatsapp-server',
    timestamp: new Date().toISOString(),
    connected: whatsappStatus.connected
  });
});

// Ruta para obtener el estado actual de WhatsApp
app.get('/status', (req, res) => {
  res.json({
    ...whatsappStatus,
    timestamp: new Date().toISOString()
  });
});

// Ruta para conectar WhatsApp
app.post('/connect', (req, res) => {
  if (whatsappStatus.connecting) {
    return res.status(400).json({
      status: 'error',
      message: 'Ya hay una conexión en proceso'
    });
  }
  
  try {
    initializeWhatsAppClient();
    
    res.json({
      status: 'success',
      message: 'Iniciando conexión a WhatsApp',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al iniciar conexión:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al iniciar conexión',
      error: error.message
    });
  }
});

// Ruta para desconectar WhatsApp
app.post('/disconnect', async (req, res) => {
  if (!whatsappClient || !whatsappStatus.connected) {
    return res.status(400).json({
      status: 'error',
      message: 'No hay conexión activa'
    });
  }
  
  try {
    // Detener reconexión automática
    whatsappStatus.permanentConnection.autoReconnect = false;
    if (reconnectionTimeout) {
      clearTimeout(reconnectionTimeout);
      reconnectionTimeout = null;
    }
    
    // Actualizar estado en la base de datos antes de desconectar
    try {
      await axios.put(`${DATABASE_SERVER_URL}/whatsapp-accounts/1`, {
        status: 'disconnecting'
      });
    } catch (error) {
      console.error('Error al actualizar estado en base de datos:', error);
    }
    
    // Desconectar cliente
    await whatsappClient.destroy();
    whatsappClient = null;
    whatsappStatus.connected = false;
    whatsappStatus.lastDisconnection = new Date().toISOString();
    
    res.json({
      status: 'success',
      message: 'Desconectado de WhatsApp',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al desconectar:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al desconectar',
      error: error.message
    });
  }
});

// Ruta para obtener el código QR
app.get('/qr', (req, res) => {
  if (whatsappStatus.qr) {
    res.send(`<html>
      <head>
        <title>Código QR de WhatsApp</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; margin: 20px; }
          .qr-container { max-width: 300px; margin: 0 auto; }
          .qr-code { width: 100%; height: auto; }
          .instructions { margin-top: 20px; text-align: left; }
          .timestamp { font-size: 12px; color: #666; margin-top: 10px; }
        </style>
      </head>
      <body>
        <h1>Conectar WhatsApp</h1>
        <div class="qr-container">
          <img src="data:image/png;base64,${fs.readFileSync(QR_PATH).toString('base64')}" class="qr-code" alt="Código QR de WhatsApp">
        </div>
        <div class="instructions">
          <h3>Instrucciones:</h3>
          <ol>
            <li>Abra WhatsApp en su teléfono</li>
            <li>Toque Menú o Configuración y seleccione WhatsApp Web</li>
            <li>Apunte su teléfono a esta pantalla para capturar el código</li>
          </ol>
        </div>
        <div class="timestamp">
          QR generado: ${new Date(whatsappStatus.lastQR).toLocaleString()}
        </div>
      </body>
    </html>`);
  } else {
    res.status(404).json({
      status: 'error',
      message: 'No hay código QR disponible. Inicie una conexión primero.'
    });
  }
});

// Ruta para obtener código QR como texto (para clientes no navegador)
app.get('/qr/raw', (req, res) => {
  if (whatsappStatus.qr) {
    res.json({
      qr: whatsappStatus.qr,
      timestamp: whatsappStatus.lastQR
    });
  } else {
    res.status(404).json({
      status: 'error',
      message: 'No hay código QR disponible. Inicie una conexión primero.'
    });
  }
});

// Ruta para obtener chats
app.get('/chats', async (req, res) => {
  if (!whatsappClient || !whatsappStatus.connected) {
    return res.status(400).json({
      status: 'error',
      message: 'No hay conexión activa a WhatsApp'
    });
  }
  
  try {
    const chats = await whatsappClient.getChats();
    const formattedChats = chats.map(chat => convertWhatsAppChat(chat));
    
    res.json(formattedChats);
  } catch (error) {
    console.error('Error al obtener chats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener chats',
      error: error.message
    });
  }
});

// Ruta para obtener mensajes de un chat
app.get('/chats/:chatId/messages', async (req, res) => {
  if (!whatsappClient || !whatsappStatus.connected) {
    return res.status(400).json({
      status: 'error',
      message: 'No hay conexión activa a WhatsApp'
    });
  }
  
  try {
    const { chatId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    const chat = await whatsappClient.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit });
    const formattedMessages = messages.map(msg => convertWhatsAppMessage(msg));
    
    res.json(formattedMessages);
  } catch (error) {
    console.error(`Error al obtener mensajes del chat ${req.params.chatId}:`, error);
    res.status(500).json({
      status: 'error',
      message: `Error al obtener mensajes del chat ${req.params.chatId}`,
      error: error.message
    });
  }
});

// Ruta para enviar un mensaje
app.post('/send', async (req, res) => {
  if (!whatsappClient || !whatsappStatus.connected) {
    return res.status(400).json({
      status: 'error',
      message: 'No hay conexión activa a WhatsApp'
    });
  }
  
  try {
    const { chatId, message } = req.body;
    
    if (!chatId || !message) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requieren los campos chatId y message'
      });
    }
    
    const result = await whatsappClient.sendMessage(chatId, message);
    
    // Guardar mensaje en la base de datos
    try {
      const messageData = {
        accountId: 1,
        chatId,
        messageId: result.id._serialized,
        from_me: true,
        content: message,
        timestamp: new Date().toISOString(),
        hasMedia: false
      };
      
      await axios.post(`${DATABASE_SERVER_URL}/messages`, messageData);
    } catch (dbError) {
      console.error('Error al guardar mensaje en la base de datos:', dbError);
    }
    
    res.json({
      status: 'success',
      message: 'Mensaje enviado correctamente',
      messageId: result.id._serialized,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al enviar mensaje',
      error: error.message
    });
  }
});

// Ruta para marcar un chat como leído
app.post('/read/:chatId', async (req, res) => {
  if (!whatsappClient || !whatsappStatus.connected) {
    return res.status(400).json({
      status: 'error',
      message: 'No hay conexión activa a WhatsApp'
    });
  }
  
  try {
    const { chatId } = req.params;
    
    const chat = await whatsappClient.getChatById(chatId);
    await chat.sendSeen();
    
    res.json({
      status: 'success',
      message: `Chat ${chatId} marcado como leído`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error al marcar chat ${req.params.chatId} como leído:`, error);
    res.status(500).json({
      status: 'error',
      message: `Error al marcar chat ${req.params.chatId} como leído`,
      error: error.message
    });
  }
});

// Iniciar el servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor de WhatsApp iniciado en http://0.0.0.0:${PORT}`);
});

// Manejar señales de cierre
process.on('SIGINT', async () => {
  console.log('\nSeñal de interrupción recibida');
  
  if (whatsappClient && whatsappStatus.connected) {
    console.log('Cerrando conexión de WhatsApp...');
    try {
      await whatsappClient.destroy();
    } catch (error) {
      console.error('Error al cerrar cliente de WhatsApp:', error);
    }
  }
  
  server.close(() => {
    console.log('Servidor de WhatsApp detenido');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('\nSeñal de terminación recibida');
  
  if (whatsappClient && whatsappStatus.connected) {
    console.log('Cerrando conexión de WhatsApp...');
    try {
      await whatsappClient.destroy();
    } catch (error) {
      console.error('Error al cerrar cliente de WhatsApp:', error);
    }
  }
  
  server.close(() => {
    console.log('Servidor de WhatsApp detenido');
    process.exit(0);
  });
});