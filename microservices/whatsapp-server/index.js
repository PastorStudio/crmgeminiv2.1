/**
 * Servidor de WhatsApp - Microservicio independiente
 * 
 * Este servidor gestiona las conexiones con WhatsApp Web,
 * mantiene sesiones activas, y proporciona una API REST para
 * interactuar con las cuentas de WhatsApp.
 */

const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = process.env.WHATSAPP_SERVER_PORT || 5001;
const API_SERVER = process.env.API_SERVER_URL || 'http://localhost:5000';
const DATABASE_SERVER = process.env.DATABASE_SERVER_URL || 'http://localhost:5003';

// Configuración de directorios
const DATA_DIR = path.join(__dirname, '..', '..', '.wwebjs_auth');
const TEMP_DIR = path.join(__dirname, '..', '..', 'temp');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Middleware para JSON y CORS
app.use(express.json());
app.use(cors());

// Log de todas las solicitudes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Mapa de clientes de WhatsApp por ID de cuenta
const whatsappClients = new Map();
// Mapa de códigos QR por ID de cuenta
const qrCodes = new Map();
// Mapa de estado de las cuentas
const accountStatus = new Map();
// Mapa de mensajes recientes por chat
const recentMessages = new Map();

// Ruta de salud para verificar que el servicio está funcionando
app.get('/health', (req, res) => {
  const activeAccounts = Array.from(whatsappClients.keys()).length;
  res.json({
    status: 'ok',
    service: 'whatsapp-server',
    activeAccounts,
    timestamp: new Date().toISOString()
  });
});

// Inicializar cliente de WhatsApp para una cuenta específica
app.post('/accounts/:accountId/initialize', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    // Verificar si ya existe un cliente para esta cuenta
    if (whatsappClients.has(accountId)) {
      const clientState = accountStatus.get(accountId) || 'unknown';
      if (clientState === 'CONNECTED') {
        return res.json({
          status: 'ok',
          message: `Cliente de WhatsApp para cuenta ${accountId} ya está conectado`
        });
      } else if (clientState === 'CONNECTING' || clientState === 'QR_READY') {
        return res.json({
          status: 'ok',
          message: `Cliente de WhatsApp para cuenta ${accountId} se está conectando`,
          qrAvailable: clientState === 'QR_READY'
        });
      }
      
      // Si hay un cliente en otro estado, lo cerramos y creamos uno nuevo
      try {
        const client = whatsappClients.get(accountId);
        await client.destroy();
        console.log(`Cliente existente para cuenta ${accountId} destruido`);
      } catch (destroyError) {
        console.error(`Error al destruir cliente existente para cuenta ${accountId}:`, destroyError);
      }
      
      whatsappClients.delete(accountId);
      qrCodes.delete(accountId);
      accountStatus.delete(accountId);
    }
    
    console.log(`Inicializando cliente de WhatsApp para cuenta ${accountId}...`);
    
    // Crear nuevo cliente con autenticación local
    const client = new Client({
      authStrategy: new LocalAuth({ 
        clientId: `account-${accountId}`,
        dataPath: DATA_DIR
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      }
    });
    
    // Manejar evento de código QR
    client.on('qr', async (qr) => {
      console.log(`Código QR generado para cuenta ${accountId}`);
      
      try {
        // Generar imagen del código QR
        const qrImagePath = path.join(TEMP_DIR, `qr-${accountId}.png`);
        await qrcode.toFile(qrImagePath, qr);
        
        // Guardar también el texto del QR
        const qrTextPath = path.join(TEMP_DIR, `qr-${accountId}.txt`);
        fs.writeFileSync(qrTextPath, qr);
        
        // Guardar el código QR en el mapa
        qrCodes.set(accountId, {
          text: qr,
          imagePath: qrImagePath,
          timestamp: new Date()
        });
        
        // Actualizar estado
        accountStatus.set(accountId, 'QR_READY');
        
        // Notificar al servidor API
        try {
          await axios.post(`${API_SERVER}/internal/whatsapp/qr-update`, {
            accountId,
            qrText: qr,
            qrImagePath
          });
        } catch (notifyError) {
          console.warn(`No se pudo notificar al servidor API sobre nuevo QR:`, notifyError.message);
        }
        
        // Actualizar estado en la base de datos
        try {
          await axios.put(`${DATABASE_SERVER}/whatsapp-accounts/${accountId}`, {
            status: 'waiting_for_qr',
            qrCode: qr
          });
        } catch (dbError) {
          console.warn(`Error al actualizar estado de QR en la base de datos:`, dbError.message);
        }
      } catch (qrError) {
        console.error(`Error al generar QR para cuenta ${accountId}:`, qrError);
      }
    });
    
    // Manejar evento de autenticación
    client.on('authenticated', async () => {
      console.log(`Cliente de WhatsApp para cuenta ${accountId} autenticado`);
      accountStatus.set(accountId, 'AUTHENTICATED');
      
      // Actualizar estado en la base de datos
      try {
        await axios.put(`${DATABASE_SERVER}/whatsapp-accounts/${accountId}`, {
          status: 'authenticated'
        });
      } catch (dbError) {
        console.warn(`Error al actualizar estado en la base de datos:`, dbError.message);
      }
    });
    
    // Manejar evento de autenticación fallida
    client.on('auth_failure', async (msg) => {
      console.error(`Error de autenticación en cuenta ${accountId}:`, msg);
      accountStatus.set(accountId, 'AUTH_FAILURE');
      
      // Actualizar estado en la base de datos
      try {
        await axios.put(`${DATABASE_SERVER}/whatsapp-accounts/${accountId}`, {
          status: 'auth_failed'
        });
      } catch (dbError) {
        console.warn(`Error al actualizar estado en la base de datos:`, dbError.message);
      }
    });
    
    // Manejar evento de conexión lista
    client.on('ready', async () => {
      console.log(`Cliente de WhatsApp para cuenta ${accountId} listo`);
      accountStatus.set(accountId, 'CONNECTED');
      
      // Actualizar estado en la base de datos
      try {
        await axios.put(`${DATABASE_SERVER}/whatsapp-accounts/${accountId}`, {
          status: 'connected'
        });
      } catch (dbError) {
        console.warn(`Error al actualizar estado en la base de datos:`, dbError.message);
      }
      
      // Inicializar contenedor para mensajes recientes de esta cuenta
      if (!recentMessages.has(accountId)) {
        recentMessages.set(accountId, new Map());
      }
    });
    
    // Manejar evento de mensaje
    client.on('message', async (message) => {
      try {
        if (message.fromMe) {
          return; // Ignorar mensajes propios
        }
        
        console.log(`Nuevo mensaje recibido en cuenta ${accountId}:`, 
          message.body.substring(0, 50) + (message.body.length > 50 ? '...' : ''));
          
        const chatId = message.from;
        
        // Guardar en caché de mensajes recientes
        if (!recentMessages.has(accountId)) {
          recentMessages.set(accountId, new Map());
        }
        
        let chatMessages = recentMessages.get(accountId).get(chatId) || [];
        chatMessages.unshift(message);
        // Limitar a 100 mensajes recientes por chat
        if (chatMessages.length > 100) {
          chatMessages = chatMessages.slice(0, 100);
        }
        recentMessages.get(accountId).set(chatId, chatMessages);
        
        // Guardar mensaje en base de datos
        try {
          const contact = await message.getContact();
          const chat = await message.getChat();
          const messageData = {
            accountId: parseInt(accountId),
            chatId,
            messageId: message.id.id,
            from_me: false,
            content: message.body,
            timestamp: new Date(message.timestamp * 1000).toISOString(),
            hasMedia: message.hasMedia,
            metadata: {
              notifyName: contact.pushname || '',
              chatName: chat.name || contact.pushname || chatId,
              isGroup: chat.isGroup
            }
          };
          
          await axios.post(`${DATABASE_SERVER}/messages`, messageData);
          
          // Notificar al servidor de procesamiento para posibles respuestas automáticas
          try {
            await axios.post(`${process.env.PROCESSOR_SERVER_URL || 'http://localhost:5002'}/process-message`, {
              accountId,
              message: messageData
            });
          } catch (processError) {
            console.warn(`Error al enviar mensaje para procesamiento:`, processError.message);
          }
        } catch (dbError) {
          console.error(`Error al guardar mensaje en la base de datos:`, dbError.message);
        }
      } catch (messageError) {
        console.error(`Error al procesar mensaje recibido:`, messageError);
      }
    });
    
    // Manejar evento de desconexión
    client.on('disconnected', async (reason) => {
      console.log(`Cliente de WhatsApp para cuenta ${accountId} desconectado. Razón: ${reason}`);
      accountStatus.set(accountId, 'DISCONNECTED');
      
      // Actualizar estado en la base de datos
      try {
        await axios.put(`${DATABASE_SERVER}/whatsapp-accounts/${accountId}`, {
          status: 'disconnected'
        });
      } catch (dbError) {
        console.warn(`Error al actualizar estado en la base de datos:`, dbError.message);
      }
      
      // Limpiar recursos
      try {
        await client.destroy();
        console.log(`Cliente para cuenta ${accountId} destruido correctamente`);
      } catch (destroyError) {
        console.error(`Error al destruir cliente para cuenta ${accountId}:`, destroyError);
      }
      
      whatsappClients.delete(accountId);
      qrCodes.delete(accountId);
    });
    
    // Empezar a inicializar el cliente
    accountStatus.set(accountId, 'CONNECTING');
    whatsappClients.set(accountId, client);
    
    // Iniciar el cliente
    client.initialize();
    
    res.json({
      status: 'ok',
      message: `Cliente de WhatsApp para cuenta ${accountId} inicializándose`
    });
  } catch (error) {
    console.error(`Error al inicializar cliente de WhatsApp para cuenta ${req.params.accountId}:`, error);
    res.status(500).json({
      status: 'error',
      message: `Error al inicializar cliente de WhatsApp para cuenta ${req.params.accountId}`,
      error: error.message
    });
  }
});

// Obtener estado de una cuenta específica
app.get('/accounts/:accountId/status', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    // Verificar si existe un cliente para esta cuenta
    if (!whatsappClients.has(accountId)) {
      return res.json({
        status: 'not_initialized',
        authenticated: false,
        qrAvailable: false
      });
    }
    
    const clientState = accountStatus.get(accountId) || 'unknown';
    const authenticated = clientState === 'AUTHENTICATED' || clientState === 'CONNECTED';
    const connected = clientState === 'CONNECTED';
    const qrAvailable = clientState === 'QR_READY' && qrCodes.has(accountId);
    
    res.json({
      status: clientState.toLowerCase(),
      authenticated,
      connected,
      qrAvailable
    });
  } catch (error) {
    console.error(`Error al obtener estado de la cuenta ${req.params.accountId}:`, error);
    res.status(500).json({
      status: 'error',
      message: `Error al obtener estado de la cuenta ${req.params.accountId}`,
      error: error.message
    });
  }
});

// Obtener código QR para una cuenta específica
app.get('/accounts/:accountId/qr', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    // Verificar si hay un código QR disponible para esta cuenta
    if (!qrCodes.has(accountId)) {
      return res.status(404).json({
        status: 'error',
        message: `No hay código QR disponible para la cuenta ${accountId}`
      });
    }
    
    const qrData = qrCodes.get(accountId);
    const qrImagePath = qrData.imagePath;
    
    // Verificar si la imagen existe
    if (!fs.existsSync(qrImagePath)) {
      return res.status(404).json({
        status: 'error',
        message: `Imagen de código QR no encontrada para la cuenta ${accountId}`
      });
    }
    
    // Enviar la imagen del código QR
    res.sendFile(qrImagePath);
  } catch (error) {
    console.error(`Error al obtener código QR para la cuenta ${req.params.accountId}:`, error);
    res.status(500).json({
      status: 'error',
      message: `Error al obtener código QR para la cuenta ${req.params.accountId}`,
      error: error.message
    });
  }
});

// Obtener chats de una cuenta específica
app.get('/accounts/:accountId/chats', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    // Verificar si hay un cliente conectado para esta cuenta
    if (!whatsappClients.has(accountId)) {
      return res.status(404).json({
        status: 'error',
        message: `No hay cliente conectado para la cuenta ${accountId}`
      });
    }
    
    const client = whatsappClients.get(accountId);
    const clientState = accountStatus.get(accountId);
    
    if (clientState !== 'CONNECTED') {
      return res.status(400).json({
        status: 'error',
        message: `Cliente de WhatsApp para cuenta ${accountId} no está conectado (estado: ${clientState})`
      });
    }
    
    // Obtener todos los chats
    const chats = await client.getChats();
    
    // Transformar a formato simplificado
    const simplifiedChats = await Promise.all(chats.map(async (chat) => {
      try {
        // Intentar obtener información adicional según el tipo de chat
        let profilePictureUrl = null;
        try {
          if (chat.isGroup) {
            // Para grupos no hay foto de perfil individual
          } else {
            const contact = await client.getContactById(chat.id._serialized);
            if (contact) {
              try {
                profilePictureUrl = await contact.getProfilePicUrl();
              } catch (picError) {
                // Ignorar errores de foto de perfil
              }
            }
          }
        } catch (infoError) {
          console.warn(`Error al obtener información adicional del chat ${chat.id._serialized}:`, infoError.message);
        }
        
        return {
          id: chat.id._serialized,
          name: chat.name || 'Chat sin nombre',
          lastMessage: chat.lastMessage ? {
            body: chat.lastMessage.body,
            fromMe: chat.lastMessage.fromMe,
            timestamp: chat.lastMessage.timestamp
          } : null,
          isGroup: chat.isGroup,
          unreadCount: chat.unreadCount,
          timestamp: chat.timestamp,
          profilePictureUrl
        };
      } catch (chatError) {
        console.error(`Error al procesar chat ${chat.id?._serialized || 'desconocido'}:`, chatError);
        return {
          id: chat.id?._serialized || 'error',
          name: 'Error al cargar chat',
          error: chatError.message
        };
      }
    }));
    
    // Ordenar por fecha de último mensaje (más reciente primero)
    simplifiedChats.sort((a, b) => {
      const timestampA = a.timestamp || a.lastMessage?.timestamp || 0;
      const timestampB = b.timestamp || b.lastMessage?.timestamp || 0;
      return timestampB - timestampA;
    });
    
    res.json(simplifiedChats);
  } catch (error) {
    console.error(`Error al obtener chats para la cuenta ${req.params.accountId}:`, error);
    res.status(500).json({
      status: 'error',
      message: `Error al obtener chats para la cuenta ${req.params.accountId}`,
      error: error.message
    });
  }
});

// Obtener mensajes de un chat específico
app.get('/accounts/:accountId/chats/:chatId/messages', async (req, res) => {
  try {
    const { accountId, chatId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    // Verificar si hay un cliente conectado para esta cuenta
    if (!whatsappClients.has(accountId)) {
      return res.status(404).json({
        status: 'error',
        message: `No hay cliente conectado para la cuenta ${accountId}`
      });
    }
    
    const client = whatsappClients.get(accountId);
    const clientState = accountStatus.get(accountId);
    
    if (clientState !== 'CONNECTED') {
      return res.status(400).json({
        status: 'error',
        message: `Cliente de WhatsApp para cuenta ${accountId} no está conectado (estado: ${clientState})`
      });
    }
    
    let messages = [];
    
    // Primero intentar obtener de la caché de mensajes recientes
    if (recentMessages.has(accountId) && recentMessages.get(accountId).has(chatId)) {
      const cachedMessages = recentMessages.get(accountId).get(chatId);
      if (cachedMessages && cachedMessages.length > 0) {
        console.log(`Usando ${cachedMessages.length} mensajes de caché para chat ${chatId}`);
        messages = cachedMessages;
      }
    }
    
    // Si no hay suficientes mensajes en caché, cargar del historial
    if (messages.length < limit) {
      try {
        // Obtener el chat
        const chat = await client.getChatById(chatId);
        
        // Cargar mensajes históricos
        await chat.fetchMessages({ limit });
        
        // Obtener los mensajes
        messages = chat.messages;
        
        // Actualizar caché
        if (messages.length > 0) {
          if (!recentMessages.has(accountId)) {
            recentMessages.set(accountId, new Map());
          }
          recentMessages.get(accountId).set(chatId, messages);
        }
      } catch (historyError) {
        console.error(`Error al cargar historial de mensajes para chat ${chatId}:`, historyError);
        // Si ya tenemos algunos mensajes de la caché, continuamos con esos
        if (messages.length === 0) {
          throw historyError; // Re-lanzar error si no tenemos mensajes
        }
      }
    }
    
    // Limitar al número solicitado
    messages = messages.slice(0, limit);
    
    // Transformar a formato simplificado
    const simplifiedMessages = await Promise.all(messages.map(async (msg) => {
      try {
        let contact = null;
        if (!msg.fromMe) {
          try {
            contact = await msg.getContact();
          } catch (contactError) {
            // Ignorar errores al obtener contacto
          }
        }
        
        return {
          id: msg.id.id,
          body: msg.body,
          fromMe: msg.fromMe,
          hasMedia: msg.hasMedia,
          type: msg.type,
          timestamp: msg.timestamp,
          notifyName: contact?.pushname || '',
          author: msg.author || ''
        };
      } catch (msgError) {
        console.error(`Error al procesar mensaje ${msg.id?.id || 'desconocido'}:`, msgError);
        return {
          id: msg.id?.id || 'error',
          body: 'Error al cargar mensaje',
          error: msgError.message,
          timestamp: msg.timestamp || Date.now() / 1000
        };
      }
    }));
    
    // Ordenar por timestamp (más antiguos primero)
    simplifiedMessages.sort((a, b) => a.timestamp - b.timestamp);
    
    res.json(simplifiedMessages);
  } catch (error) {
    console.error(`Error al obtener mensajes del chat ${req.params.chatId}:`, error);
    res.status(500).json({
      status: 'error',
      message: `Error al obtener mensajes del chat ${req.params.chatId}`,
      error: error.message
    });
  }
});

// Enviar mensaje a un chat específico
app.post('/accounts/:accountId/send', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { chatId, message } = req.body;
    
    if (!chatId || !message) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requieren chatId y message en el cuerpo de la solicitud'
      });
    }
    
    // Verificar si hay un cliente conectado para esta cuenta
    if (!whatsappClients.has(accountId)) {
      return res.status(404).json({
        status: 'error',
        message: `No hay cliente conectado para la cuenta ${accountId}`
      });
    }
    
    const client = whatsappClients.get(accountId);
    const clientState = accountStatus.get(accountId);
    
    if (clientState !== 'CONNECTED') {
      return res.status(400).json({
        status: 'error',
        message: `Cliente de WhatsApp para cuenta ${accountId} no está conectado (estado: ${clientState})`
      });
    }
    
    // Enviar el mensaje
    const result = await client.sendMessage(chatId, message);
    
    // Guardar mensaje en caché de mensajes recientes
    try {
      if (!recentMessages.has(accountId)) {
        recentMessages.set(accountId, new Map());
      }
      
      if (!recentMessages.get(accountId).has(chatId)) {
        recentMessages.get(accountId).set(chatId, []);
      }
      
      recentMessages.get(accountId).get(chatId).unshift(result);
      
      // Limitar a 100 mensajes recientes por chat
      const chatMessages = recentMessages.get(accountId).get(chatId);
      if (chatMessages.length > 100) {
        recentMessages.get(accountId).set(chatId, chatMessages.slice(0, 100));
      }
    } catch (cacheError) {
      console.warn(`Error al guardar mensaje en caché:`, cacheError.message);
    }
    
    // Guardar mensaje en base de datos
    try {
      const messageData = {
        accountId: parseInt(accountId),
        chatId,
        messageId: result.id.id,
        from_me: true,
        content: message,
        timestamp: new Date().toISOString(),
        hasMedia: false
      };
      
      await axios.post(`${DATABASE_SERVER}/messages`, messageData);
    } catch (dbError) {
      console.warn(`Error al guardar mensaje enviado en la base de datos:`, dbError.message);
    }
    
    res.json({
      status: 'ok',
      message: result,
      sent: true
    });
  } catch (error) {
    console.error(`Error al enviar mensaje al chat ${req.body.chatId}:`, error);
    res.status(500).json({
      status: 'error',
      message: `Error al enviar mensaje al chat ${req.body.chatId}`,
      error: error.message
    });
  }
});

// Cerrar sesión de una cuenta específica
app.post('/accounts/:accountId/logout', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    // Verificar si hay un cliente conectado para esta cuenta
    if (!whatsappClients.has(accountId)) {
      return res.status(404).json({
        status: 'error',
        message: `No hay cliente conectado para la cuenta ${accountId}`
      });
    }
    
    const client = whatsappClients.get(accountId);
    
    // Cerrar sesión
    console.log(`Cerrando sesión de cuenta ${accountId}...`);
    await client.logout();
    
    // Destruir cliente
    try {
      await client.destroy();
      console.log(`Cliente para cuenta ${accountId} destruido correctamente`);
    } catch (destroyError) {
      console.error(`Error al destruir cliente para cuenta ${accountId}:`, destroyError);
    }
    
    // Limpiar recursos
    whatsappClients.delete(accountId);
    qrCodes.delete(accountId);
    accountStatus.set(accountId, 'DISCONNECTED');
    
    // Actualizar estado en la base de datos
    try {
      await axios.put(`${DATABASE_SERVER}/whatsapp-accounts/${accountId}`, {
        status: 'disconnected'
      });
    } catch (dbError) {
      console.warn(`Error al actualizar estado en la base de datos:`, dbError.message);
    }
    
    res.json({
      status: 'ok',
      message: `Sesión cerrada correctamente para cuenta ${accountId}`
    });
  } catch (error) {
    console.error(`Error al cerrar sesión de la cuenta ${req.params.accountId}:`, error);
    res.status(500).json({
      status: 'error',
      message: `Error al cerrar sesión de la cuenta ${req.params.accountId}`,
      error: error.message
    });
  }
});

// Reconectar automáticamente las cuentas al inicio
async function reconnectAccounts() {
  try {
    console.log('Intentando reconectar cuentas de WhatsApp...');
    
    // Obtener cuentas desde la base de datos
    const response = await axios.get(`${DATABASE_SERVER}/whatsapp-accounts`);
    const accounts = response.data;
    
    if (!accounts || accounts.length === 0) {
      console.log('No hay cuentas para reconectar');
      return;
    }
    
    console.log(`Encontradas ${accounts.length} cuentas`);
    
    // Intentar conectar cada cuenta que estaba previamente conectada
    for (const account of accounts) {
      if (account.status === 'connected' || account.status === 'authenticated') {
        console.log(`Reconectando cuenta ${account.id}: ${account.name}`);
        
        try {
          // Inicializar cliente
          await axios.post(`http://localhost:${PORT}/accounts/${account.id}/initialize`);
          console.log(`Reconexión iniciada para cuenta ${account.id}`);
        } catch (initError) {
          console.error(`Error al reconectar cuenta ${account.id}:`, initError.message);
        }
      } else {
        console.log(`Cuenta ${account.id} no estaba conectada (estado: ${account.status}), no se reconecta automáticamente`);
      }
    }
  } catch (error) {
    console.error('Error al obtener cuentas para reconexión:', error);
  }
}

// Iniciar el servidor
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`✅ Servidor de WhatsApp iniciado en http://0.0.0.0:${PORT}`);
  
  // Esperar un momento para que otros servicios estén listos
  setTimeout(reconnectAccounts, 10000);
});

// Manejar señales de cierre
process.on('SIGINT', async () => {
  console.log('Desconectando todos los clientes de WhatsApp...');
  
  // Cerrar todos los clientes de WhatsApp
  for (const [accountId, client] of whatsappClients.entries()) {
    try {
      console.log(`Cerrando cliente para cuenta ${accountId}...`);
      await client.destroy();
    } catch (error) {
      console.error(`Error al cerrar cliente para cuenta ${accountId}:`, error);
    }
  }
  
  whatsappClients.clear();
  qrCodes.clear();
  accountStatus.clear();
  
  server.close(() => {
    console.log('Servidor detenido');
    process.exit(0);
  });
});

process.on('SIGTERM', async () => {
  console.log('Desconectando todos los clientes de WhatsApp...');
  
  // Cerrar todos los clientes de WhatsApp
  for (const [accountId, client] of whatsappClients.entries()) {
    try {
      console.log(`Cerrando cliente para cuenta ${accountId}...`);
      await client.destroy();
    } catch (error) {
      console.error(`Error al cerrar cliente para cuenta ${accountId}:`, error);
    }
  }
  
  whatsappClients.clear();
  qrCodes.clear();
  accountStatus.clear();
  
  server.close(() => {
    console.log('Servidor detenido');
    process.exit(0);
  });
});