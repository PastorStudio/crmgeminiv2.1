/**
 * Servidor de WhatsApp - Microservicio independiente
 * 
 * Este servidor gestiona las conexiones de WhatsApp Web
 * y proporciona una interfaz para interactuar con ellas.
 */

import express from 'express';
import cors from 'cors';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.WHATSAPP_SERVER_PORT || 5001;

// Middleware para JSON y CORS
app.use(express.json());
app.use(cors());

// Cliente de WhatsApp
let client = null;
let qrCodeData = null;
let connectionStatus = 'disconnected';
let lastQrTimestamp = null;

// Función para inicializar el cliente de WhatsApp
function initializeClient() {
  // Crear directorios si no existen
  const sessionDir = path.join(__dirname, '..', 'temp', '.wwebjs_auth');
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  // Crear cliente con autenticación local para mantener la sesión
  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: sessionDir
    }),
    puppeteer: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ],
      headless: true
    }
  });

  // Evento al recibir un código QR
  client.on('qr', (qr) => {
    console.log('QR Code recibido:');
    qrCodeData = qr;
    lastQrTimestamp = Date.now();
    
    // Mostrar código QR en la terminal (solo para depuración)
    qrcode.generate(qr, { small: true });
    
    console.log('Escanea el código QR para conectar WhatsApp');
  });

  // Evento al autenticarse
  client.on('authenticated', () => {
    console.log('Cliente autenticado');
    connectionStatus = 'authenticated';
  });

  // Evento al iniciar sesión
  client.on('ready', () => {
    console.log('Cliente listo para usar');
    connectionStatus = 'connected';
  });

  // Evento al desconectarse
  client.on('disconnected', (reason) => {
    console.log('Cliente desconectado:', reason);
    connectionStatus = 'disconnected';
    
    // Reiniciar el cliente solo si la desconexión fue por error
    if (reason !== 'manual_disconnect') {
      console.log('Intentando reconectar automáticamente...');
      client = null;
      // Reiniciar después de un breve retraso
      setTimeout(initializeClient, 5000);
    }
  });

  // Evento al recibir un mensaje
  client.on('message', async (message) => {
    console.log(`Mensaje recibido de ${message.from}: ${message.body}`);
    
    // Aquí puedes implementar alguna lógica para procesar los mensajes
    // Por ejemplo, notificar al servidor de procesamiento
  });

  // Iniciar cliente
  client.initialize().catch((error) => {
    console.error('Error al inicializar el cliente:', error);
    connectionStatus = 'error';
  });
}

// Log de todas las solicitudes
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

// Ruta de salud para verificar que el servicio está funcionando
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'whatsapp-server',
    timestamp: new Date().toISOString()
  });
});

// Ruta para obtener el estado de conexión
app.get('/status', (req, res) => {
  res.json({
    status: connectionStatus,
    authenticated: connectionStatus === 'connected' || connectionStatus === 'authenticated',
    hasQrCode: qrCodeData !== null && (Date.now() - lastQrTimestamp < 60000),
    timestamp: new Date().toISOString()
  });
});

// Ruta para iniciar la conexión
app.post('/connect', (req, res) => {
  if (client && connectionStatus === 'connected') {
    return res.json({
      status: 'warning',
      message: 'Cliente ya conectado'
    });
  }
  
  if (!client) {
    initializeClient();
  } else {
    client.initialize().catch((error) => {
      console.error('Error al inicializar el cliente:', error);
    });
  }
  
  res.json({
    status: 'success',
    message: 'Inicializando cliente de WhatsApp',
    action: 'check_qr'
  });
});

// Ruta para desconectar
app.post('/disconnect', async (req, res) => {
  if (!client || connectionStatus === 'disconnected') {
    return res.json({
      status: 'warning',
      message: 'Cliente no conectado'
    });
  }
  
  try {
    // Marcar razón de desconexión como manual
    connectionStatus = 'disconnecting';
    await client.destroy();
    client = null;
    connectionStatus = 'disconnected';
    
    res.json({
      status: 'success',
      message: 'Cliente desconectado exitosamente'
    });
  } catch (error) {
    console.error('Error al desconectar cliente:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al desconectar cliente',
      error: error.message
    });
  }
});

// Ruta para obtener el código QR
app.get('/qr', (req, res) => {
  if (!qrCodeData || (Date.now() - lastQrTimestamp > 60000)) {
    return res.status(404).json({
      status: 'error',
      message: 'Código QR no disponible o expirado, inicie la conexión primero'
    });
  }
  
  res.send(qrCodeData);
});

// Ruta para obtener chats
app.get('/chats', async (req, res) => {
  if (!client || connectionStatus !== 'connected') {
    return res.status(400).json({
      status: 'error',
      message: 'Cliente no conectado'
    });
  }
  
  try {
    const chats = await client.getChats();
    
    // Formatear los chats para la respuesta
    const formattedChats = await Promise.all(chats.map(async (chat) => {
      let contact = {};
      
      try {
        // Intentar obtener información de contacto
        if (chat.isGroup) {
          contact = {
            name: chat.name,
            isGroup: true
          };
        } else {
          const contactInfo = await client.getContactById(chat.id._serialized);
          contact = {
            name: contactInfo.name || contactInfo.pushname || 'Desconocido',
            number: contactInfo.number,
            isGroup: false
          };
        }
      } catch (error) {
        console.error(`Error al obtener contacto para chat ${chat.id._serialized}:`, error);
        contact = {
          name: 'Contacto desconocido',
          isGroup: chat.isGroup
        };
      }
      
      return {
        id: chat.id._serialized,
        name: contact.name,
        isGroup: chat.isGroup,
        unreadCount: chat.unreadCount,
        timestamp: chat.timestamp ? new Date(chat.timestamp * 1000).toISOString() : null,
        lastMessage: chat.lastMessage ? {
          body: chat.lastMessage.body,
          fromMe: chat.lastMessage.fromMe,
          timestamp: chat.lastMessage.timestamp ? new Date(chat.lastMessage.timestamp * 1000).toISOString() : null
        } : null
      };
    }));
    
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
  if (!client || connectionStatus !== 'connected') {
    return res.status(400).json({
      status: 'error',
      message: 'Cliente no conectado'
    });
  }
  
  try {
    const chatId = req.params.chatId;
    const chat = await client.getChatById(chatId);
    
    // Obtener mensajes (limitado a los últimos 50)
    const messages = await chat.fetchMessages({ limit: 50 });
    
    // Formatear los mensajes para la respuesta
    const formattedMessages = messages.map((message) => {
      return {
        id: message.id._serialized,
        body: message.body,
        timestamp: message.timestamp ? new Date(message.timestamp * 1000).toISOString() : null,
        fromMe: message.fromMe,
        author: message.author || message.from,
        hasMedia: message.hasMedia,
        type: message.type
      };
    });
    
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

// Ruta para enviar mensaje
app.post('/send', async (req, res) => {
  if (!client || connectionStatus !== 'connected') {
    return res.status(400).json({
      status: 'error',
      message: 'Cliente no conectado'
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
    
    // Enviar mensaje
    const sentMessage = await client.sendMessage(chatId, message);
    
    res.json({
      status: 'success',
      message: 'Mensaje enviado exitosamente',
      messageId: sentMessage.id._serialized
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
  if (!client || connectionStatus !== 'connected') {
    return res.status(400).json({
      status: 'error',
      message: 'Cliente no conectado'
    });
  }
  
  try {
    const chatId = req.params.chatId;
    const chat = await client.getChatById(chatId);
    
    // Marcar como leído
    await chat.sendSeen();
    
    res.json({
      status: 'success',
      message: 'Chat marcado como leído'
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
process.on('SIGINT', () => {
  console.log('Cerrando servidor de WhatsApp...');
  if (client) {
    console.log('Desconectando cliente...');
    connectionStatus = 'disconnecting';
    client.destroy().catch((err) => console.error('Error al desconectar:', err));
  }
  server.close(() => {
    console.log('Servidor de WhatsApp detenido');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Cerrando servidor de WhatsApp...');
  if (client) {
    console.log('Desconectando cliente...');
    connectionStatus = 'disconnecting';
    client.destroy().catch((err) => console.error('Error al desconectar:', err));
  }
  server.close(() => {
    console.log('Servidor de WhatsApp detenido');
    process.exit(0);
  });
});