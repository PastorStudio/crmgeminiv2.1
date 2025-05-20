/**
 * Servidor de WhatsApp - Microservicio independiente
 * 
 * Este microservicio gestiona todas las conexiones con WhatsApp Web,
 * manteniendo sesiones activas, procesando mensajes y proporcionando
 * una API para interactuar con WhatsApp.
 */

const express = require('express');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.WHATSAPP_SERVER_PORT || 5001;
const DATABASE_SERVER_URL = process.env.DATABASE_SERVER_URL || 'http://localhost:5003';
const PROCESSOR_SERVER_URL = process.env.PROCESSOR_SERVER_URL || 'http://localhost:5002';

// Asegurar que existan directorios para almacenamiento local
const SESSIONS_DIR = path.join(__dirname, '..', 'temp', 'whatsapp-sessions');
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// Middleware para JSON y CORS
app.use(express.json());
app.use(cors());

// Log de todas las solicitudes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Map para almacenar sesiones activas de WhatsApp
const activeClients = new Map();

// Opciones para cliente de WhatsApp
const puppeteerOptions = {
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
};

// Función para crear y configurar un cliente de WhatsApp
async function createWhatsAppClient(accountId, sessionDir = null) {
  // Obtener detalles de la cuenta de la base de datos
  console.log(`Creando cliente de WhatsApp para cuenta ID: ${accountId}`);
  
  // Verificar si ya existe un cliente para esta cuenta
  if (activeClients.has(accountId)) {
    console.log(`Cliente ya existe para cuenta ID: ${accountId}`);
    return activeClients.get(accountId);
  }
  
  // Configurar directorio de sesión
  const sessionDirPath = sessionDir || path.join(SESSIONS_DIR, `account-${accountId}`);
  
  // Crear cliente
  const client = new Client({
    puppeteer: puppeteerOptions,
    authStrategy: new LocalAuth({
      clientId: `account-${accountId}`,
      dataPath: sessionDirPath
    }),
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2408.52.html'
    }
  });
  
  // Manejar generación de código QR
  let qrCode = null;
  let qrGenerated = false;
  
  client.on('qr', async (qr) => {
    qrCode = qr;
    qrGenerated = true;
    console.log(`QR Code generado para cuenta ID: ${accountId}`);
    
    // Convertir QR a datos URL para mostrar en cliente
    const qrImageUrl = await qrcode.toDataURL(qr);
    
    // Actualizar estado en la base de datos
    try {
      await axios.put(`${DATABASE_SERVER_URL}/whatsapp-accounts/${accountId}`, {
        status: 'pending_auth',
        qrCode: qrImageUrl
      });
    } catch (error) {
      console.error(`Error al actualizar estado de QR en base de datos:`, error.message);
    }
  });
  
  // Manejar autenticación exitosa
  client.on('authenticated', async () => {
    console.log(`Cliente autenticado para cuenta ID: ${accountId}`);
    qrCode = null;
    qrGenerated = false;
    
    // Actualizar estado en la base de datos
    try {
      await axios.put(`${DATABASE_SERVER_URL}/whatsapp-accounts/${accountId}`, {
        status: 'authenticated'
      });
    } catch (error) {
      console.error(`Error al actualizar estado autenticado en base de datos:`, error.message);
    }
  });
  
  // Manejar inicio de sesión exitoso
  client.on('ready', async () => {
    console.log(`Cliente listo para cuenta ID: ${accountId}`);
    
    // Actualizar estado en la base de datos
    try {
      await axios.put(`${DATABASE_SERVER_URL}/whatsapp-accounts/${accountId}`, {
        status: 'connected'
      });
    } catch (error) {
      console.error(`Error al actualizar estado conectado en base de datos:`, error.message);
    }
  });
  
  // Manejar desconexión
  client.on('disconnected', async (reason) => {
    console.log(`Cliente desconectado para cuenta ID: ${accountId}. Razón: ${reason}`);
    
    // Actualizar estado en la base de datos
    try {
      await axios.put(`${DATABASE_SERVER_URL}/whatsapp-accounts/${accountId}`, {
        status: 'disconnected'
      });
    } catch (error) {
      console.error(`Error al actualizar estado desconectado en base de datos:`, error.message);
    }
    
    // Eliminar cliente del mapa
    activeClients.delete(accountId);
  });
  
  // Manejar mensajes entrantes
  client.on('message', async (message) => {
    try {
      console.log(`Mensaje recibido en cuenta ID: ${accountId}`, {
        from: message.from,
        body: message.body.substring(0, 50) + (message.body.length > 50 ? '...' : '')
      });
      
      // Guardar mensaje en la base de datos
      const messageData = {
        accountId: accountId,
        chatId: message.from,
        messageId: message.id._serialized,
        from_me: false,
        content: message.body,
        timestamp: message.timestamp * 1000, // Convertir a milisegundos
        hasMedia: message.hasMedia,
        timeZoneInfo: {
          detectedTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          messageTimestamp: message.timestamp * 1000,
          serverTimestamp: Date.now()
        }
      };
      
      // Si tiene contenido multimedia, procesarlo
      if (message.hasMedia) {
        try {
          const media = await message.downloadMedia();
          messageData.mediaType = media.mimetype;
          messageData.mediaUrl = `data:${media.mimetype};base64,${media.data}`;
          messageData.caption = message.caption || '';
        } catch (mediaError) {
          console.error(`Error al descargar contenido multimedia:`, mediaError);
        }
      }
      
      // Guardar en la base de datos
      try {
        await axios.post(`${DATABASE_SERVER_URL}/messages`, messageData);
      } catch (dbError) {
        console.error(`Error al guardar mensaje en base de datos:`, dbError.message);
      }
      
      // Enviar al procesador de mensajes
      try {
        await axios.post(`${PROCESSOR_SERVER_URL}/process-message`, {
          message: messageData
        });
      } catch (processorError) {
        console.error(`Error al enviar mensaje al procesador:`, processorError.message);
      }
    } catch (error) {
      console.error(`Error al procesar mensaje entrante:`, error);
    }
  });
  
  // Inicializar el cliente
  try {
    console.log(`Iniciando cliente de WhatsApp para cuenta ID: ${accountId}`);
    await client.initialize();
    console.log(`Cliente inicializado correctamente para cuenta ID: ${accountId}`);
    
    // Almacenar el cliente en el mapa
    const clientInfo = {
      client,
      accountId,
      qrCode: () => qrCode,
      qrGenerated: () => qrGenerated,
      isReady: () => client.info ? true : false,
      getState: () => client.getState(),
      createdAt: new Date()
    };
    
    activeClients.set(accountId, clientInfo);
    return clientInfo;
  } catch (error) {
    console.error(`Error al inicializar cliente de WhatsApp:`, error);
    throw error;
  }
}

// Función para reconectar clientes existentes al iniciar
async function reconnectExistingSessions() {
  try {
    console.log("Buscando sesiones existentes para reconexión...");
    
    // Ver si hay sesiones guardadas en el directorio
    const sessionDirs = fs.readdirSync(SESSIONS_DIR);
    
    for (const dir of sessionDirs) {
      if (dir.startsWith('account-')) {
        const accountId = parseInt(dir.replace('account-', ''));
        if (!isNaN(accountId)) {
          console.log(`Encontrada sesión para cuenta ID: ${accountId}, reconectando...`);
          
          try {
            await createWhatsAppClient(accountId);
            console.log(`Sesión reconectada para cuenta ID: ${accountId}`);
          } catch (error) {
            console.error(`Error al reconectar sesión para cuenta ID: ${accountId}:`, error);
          }
        }
      }
    }
    
    console.log("Reconexión de sesiones existentes completa");
  } catch (error) {
    console.error("Error al reconectar sesiones existentes:", error);
  }
}

// === API de WhatsApp ===

// Ruta de salud para verificar que el servicio está funcionando
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'whatsapp-server',
    timestamp: new Date().toISOString(),
    activeConnections: activeClients.size
  });
});

// Iniciar una conexión de WhatsApp
app.post('/connect', async (req, res) => {
  try {
    const { accountId } = req.body;
    
    if (!accountId) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere el ID de la cuenta de WhatsApp'
      });
    }
    
    // Verificar si ya hay un cliente activo
    if (activeClients.has(accountId)) {
      const clientInfo = activeClients.get(accountId);
      const state = await clientInfo.getState();
      
      // Si ya está conectado, devolver información
      if (state === 'CONNECTED') {
        return res.json({
          status: 'success',
          message: 'Cliente ya está conectado',
          accountId,
          connectionStatus: state
        });
      }
    }
    
    // Crear nuevo cliente
    const clientInfo = await createWhatsAppClient(accountId);
    
    res.json({
      status: 'success',
      message: 'Conexión iniciada',
      accountId,
      needsQrScan: clientInfo.qrGenerated(),
      qrCode: clientInfo.qrGenerated() ? clientInfo.qrCode() : null
    });
  } catch (error) {
    console.error('Error al conectar WhatsApp:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al iniciar conexión de WhatsApp',
      error: error.message
    });
  }
});

// Obtener QR para autenticación
app.get('/qr-code/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    if (!activeClients.has(parseInt(accountId))) {
      return res.status(404).json({
        status: 'error',
        message: `No hay cliente activo para la cuenta ID: ${accountId}`
      });
    }
    
    const clientInfo = activeClients.get(parseInt(accountId));
    
    if (!clientInfo.qrGenerated()) {
      return res.status(404).json({
        status: 'error',
        message: 'No hay código QR generado para esta cuenta'
      });
    }
    
    const qr = clientInfo.qrCode();
    
    // Generar imagen QR
    const qrImage = await qrcode.toDataURL(qr);
    
    res.json({
      status: 'success',
      accountId,
      qrCode: qr,
      qrImage
    });
  } catch (error) {
    console.error(`Error al obtener código QR para cuenta ${req.params.accountId}:`, error);
    res.status(500).json({
      status: 'error',
      message: `Error al obtener código QR para cuenta ${req.params.accountId}`,
      error: error.message
    });
  }
});

// Desconectar un cliente de WhatsApp
app.post('/disconnect/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    if (!activeClients.has(parseInt(accountId))) {
      return res.status(404).json({
        status: 'error',
        message: `No hay cliente activo para la cuenta ID: ${accountId}`
      });
    }
    
    const clientInfo = activeClients.get(parseInt(accountId));
    
    console.log(`Desconectando cliente para cuenta ID: ${accountId}`);
    await clientInfo.client.destroy();
    activeClients.delete(parseInt(accountId));
    
    // Actualizar estado en la base de datos
    try {
      await axios.put(`${DATABASE_SERVER_URL}/whatsapp-accounts/${accountId}`, {
        status: 'disconnected'
      });
    } catch (dbError) {
      console.error(`Error al actualizar estado en base de datos:`, dbError.message);
    }
    
    res.json({
      status: 'success',
      message: 'Cliente desconectado correctamente',
      accountId
    });
  } catch (error) {
    console.error(`Error al desconectar cliente para cuenta ${req.params.accountId}:`, error);
    res.status(500).json({
      status: 'error',
      message: `Error al desconectar cliente para cuenta ${req.params.accountId}`,
      error: error.message
    });
  }
});

// Obtener estado de conexión
app.get('/connection-status/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    if (!activeClients.has(parseInt(accountId))) {
      return res.json({
        status: 'success',
        connectionStatus: 'DISCONNECTED',
        accountId
      });
    }
    
    const clientInfo = activeClients.get(parseInt(accountId));
    const state = await clientInfo.getState();
    
    res.json({
      status: 'success',
      connectionStatus: state,
      isReady: clientInfo.isReady(),
      accountId,
      needsQrScan: clientInfo.qrGenerated(),
      qrCode: clientInfo.qrGenerated() ? clientInfo.qrCode() : null
    });
  } catch (error) {
    console.error(`Error al obtener estado de conexión para cuenta ${req.params.accountId}:`, error);
    res.status(500).json({
      status: 'error',
      message: `Error al obtener estado de conexión para cuenta ${req.params.accountId}`,
      error: error.message
    });
  }
});

// Enviar mensaje de WhatsApp
app.post('/send-message', async (req, res) => {
  try {
    const { accountId, chatId, message, mediaUrl } = req.body;
    
    if (!accountId || !chatId || (!message && !mediaUrl)) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requieren accountId, chatId y message o mediaUrl'
      });
    }
    
    if (!activeClients.has(parseInt(accountId))) {
      return res.status(404).json({
        status: 'error',
        message: `No hay cliente activo para la cuenta ID: ${accountId}`
      });
    }
    
    const clientInfo = activeClients.get(parseInt(accountId));
    
    // Verificar que el cliente esté listo
    if (!clientInfo.isReady()) {
      return res.status(400).json({
        status: 'error',
        message: 'El cliente de WhatsApp no está listo'
      });
    }
    
    let sentMessage;
    
    // Enviar mensaje con o sin media
    if (mediaUrl) {
      // Extraer datos de mediaUrl (data URL)
      const mediaData = mediaUrl.split(',')[1];
      const mimeType = mediaUrl.match(/data:(.*);base64/)[1];
      
      const media = new MessageMedia(mimeType, mediaData);
      sentMessage = await clientInfo.client.sendMessage(chatId, media, {
        caption: message || ''
      });
    } else {
      sentMessage = await clientInfo.client.sendMessage(chatId, message);
    }
    
    // Guardar mensaje en la base de datos
    try {
      const messageData = {
        accountId: accountId,
        chatId: chatId,
        messageId: sentMessage.id._serialized,
        from_me: true,
        content: message || '',
        timestamp: Date.now(),
        hasMedia: !!mediaUrl,
        mediaUrl: mediaUrl || null,
        mediaType: mediaUrl ? mediaUrl.match(/data:(.*);base64/)[1] : null,
        timeZoneInfo: {
          detectedTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          messageTimestamp: Date.now(),
          serverTimestamp: Date.now()
        }
      };
      
      await axios.post(`${DATABASE_SERVER_URL}/messages`, messageData);
    } catch (dbError) {
      console.error(`Error al guardar mensaje enviado en base de datos:`, dbError.message);
    }
    
    res.json({
      status: 'success',
      message: 'Mensaje enviado correctamente',
      accountId,
      chatId,
      messageId: sentMessage.id._serialized
    });
  } catch (error) {
    console.error(`Error al enviar mensaje:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Error al enviar mensaje',
      error: error.message
    });
  }
});

// Obtener chats
app.get('/chats/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    if (!activeClients.has(parseInt(accountId))) {
      return res.status(404).json({
        status: 'error',
        message: `No hay cliente activo para la cuenta ID: ${accountId}`
      });
    }
    
    const clientInfo = activeClients.get(parseInt(accountId));
    
    // Verificar que el cliente esté listo
    if (!clientInfo.isReady()) {
      return res.status(400).json({
        status: 'error',
        message: 'El cliente de WhatsApp no está listo'
      });
    }
    
    // Obtener chats
    const chats = await clientInfo.client.getChats();
    
    // Formatear para respuesta
    const formattedChats = chats.map(chat => ({
      id: chat.id._serialized,
      name: chat.name,
      isGroup: chat.isGroup,
      timestamp: chat.timestamp,
      unreadCount: chat.unreadCount
    }));
    
    res.json({
      status: 'success',
      accountId,
      chats: formattedChats
    });
  } catch (error) {
    console.error(`Error al obtener chats para cuenta ${req.params.accountId}:`, error);
    res.status(500).json({
      status: 'error',
      message: `Error al obtener chats para cuenta ${req.params.accountId}`,
      error: error.message
    });
  }
});

// Iniciar el servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor de WhatsApp iniciado en http://0.0.0.0:${PORT}`);
});

// Reconectar sesiones existentes al iniciar
reconnectExistingSessions();

// Manejar cierre de proceso
process.on('SIGINT', async () => {
  console.log('Cerrando todas las conexiones de WhatsApp...');
  
  // Cerrar todos los clientes activos
  const disconnectPromises = [];
  for (const [accountId, clientInfo] of activeClients.entries()) {
    console.log(`Desconectando cliente para cuenta ${accountId}...`);
    disconnectPromises.push(clientInfo.client.destroy());
  }
  
  try {
    await Promise.all(disconnectPromises);
  } catch (error) {
    console.error('Error al desconectar clientes:', error);
  }
  
  server.close(() => {
    console.log('Servidor de WhatsApp detenido');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('Cerrando todas las conexiones de WhatsApp...');
  
  // Cerrar todos los clientes activos
  const disconnectPromises = [];
  for (const [accountId, clientInfo] of activeClients.entries()) {
    console.log(`Desconectando cliente para cuenta ${accountId}...`);
    disconnectPromises.push(clientInfo.client.destroy());
  }
  
  try {
    await Promise.all(disconnectPromises);
  } catch (error) {
    console.error('Error al desconectar clientes:', error);
  }
  
  server.close(() => {
    console.log('Servidor de WhatsApp detenido');
    process.exit(0);
  });
});