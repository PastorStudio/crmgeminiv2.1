/**
 * Servidor API - Microservicio independiente
 * 
 * Este servidor actúa como punto de entrada para todas las solicitudes externas
 * y coordina las comunicaciones entre los demás microservicios.
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.API_SERVER_PORT || 5000;
const DATABASE_SERVER = process.env.DATABASE_SERVER_URL || 'http://localhost:5003';
const WHATSAPP_SERVER = process.env.WHATSAPP_SERVER_URL || 'http://localhost:5001';
const PROCESSOR_SERVER = process.env.PROCESSOR_SERVER_URL || 'http://localhost:5002';

// Middleware para JSON y CORS
app.use(express.json());
app.use(cors());

// Log de todas las solicitudes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Raíz de la API
app.get('/', (req, res) => {
  res.json({
    name: 'CRM WhatsApp API',
    version: '2.0.0',
    microserviceArchitecture: true,
    services: [
      { name: 'api', url: `/api/health`, port: PORT },
      { name: 'whatsapp', url: `${WHATSAPP_SERVER}/health`, port: 5001 },
      { name: 'processor', url: `${PROCESSOR_SERVER}/health`, port: 5002 },
      { name: 'database', url: `${DATABASE_SERVER}/health`, port: 5003 }
    ]
  });
});

// Ruta de estado
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'api-server', 
    timestamp: new Date().toISOString() 
  });
});

// Obtener el estado de todos los microservicios
app.get('/api/system/status', async (req, res) => {
  try {
    const results = await Promise.allSettled([
      axios.get(`${DATABASE_SERVER}/health`).then(res => ({ name: 'database', status: 'ok', data: res.data })),
      axios.get(`${WHATSAPP_SERVER}/health`).then(res => ({ name: 'whatsapp', status: 'ok', data: res.data })),
      axios.get(`${PROCESSOR_SERVER}/health`).then(res => ({ name: 'processor', status: 'ok', data: res.data }))
    ]);
    
    const servicesStatus = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        const services = ['database', 'whatsapp', 'processor'];
        return {
          name: services[index],
          status: 'error',
          error: result.reason.message
        };
      }
    });
    
    // Añadir este servidor
    servicesStatus.push({
      name: 'api',
      status: 'ok',
      data: {
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      }
    });
    
    res.json({
      system: {
        status: servicesStatus.every(s => s.status === 'ok') ? 'ok' : 'degraded',
        timestamp: new Date().toISOString()
      },
      services: servicesStatus
    });
  } catch (error) {
    console.error('Error al verificar estado del sistema:', error);
    res.status(500).json({
      system: {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      }
    });
  }
});

// *** Rutas proxy hacia los demás microservicios ***

// API de Cuentas de WhatsApp
app.get('/api/whatsapp-accounts', async (req, res) => {
  try {
    const response = await axios.get(`${DATABASE_SERVER}/whatsapp-accounts`);
    res.json(response.data);
  } catch (error) {
    console.error('Error al obtener cuentas de WhatsApp:', error);
    res.status(error.response?.status || 500).json({
      error: 'Error al obtener cuentas de WhatsApp',
      details: error.message
    });
  }
});

app.get('/api/whatsapp-accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${DATABASE_SERVER}/whatsapp-accounts/${id}`);
    res.json(response.data);
  } catch (error) {
    console.error(`Error al obtener cuenta de WhatsApp ${req.params.id}:`, error);
    res.status(error.response?.status || 500).json({
      error: `Error al obtener cuenta de WhatsApp ${req.params.id}`,
      details: error.message
    });
  }
});

// Chats de WhatsApp
app.get('/api/whatsapp-accounts/:accountId/chats', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    // Inicializar la cuenta si no está inicializada
    await ensureAccountInitialized(accountId);
    
    // Obtener chats
    const response = await axios.get(`${WHATSAPP_SERVER}/accounts/${accountId}/chats`);
    res.json(response.data);
  } catch (error) {
    console.error(`Error al obtener chats de la cuenta ${req.params.accountId}:`, error);
    res.status(error.response?.status || 500).json({
      error: `Error al obtener chats de la cuenta ${req.params.accountId}`,
      details: error.message
    });
  }
});

// Contactos de WhatsApp
app.get('/api/whatsapp-accounts/:accountId/contacts', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    // Intentar obtener contactos, pero si hay error no bloquear la respuesta
    try {
      // Asegurar que la cuenta esté inicializada
      await ensureAccountInitialized(accountId);
    } catch (initError) {
      console.warn(`Advertencia: no se pudo inicializar la cuenta ${accountId}:`, initError.message);
    }
    
    // Devolver simplemente una respuesta vacía si la cuenta no está lista
    res.json([]);
  } catch (error) {
    console.error(`Error al obtener contactos de la cuenta ${req.params.accountId}:`, error);
    res.status(error.response?.status || 500).json({
      error: `Error al obtener contactos de la cuenta ${req.params.accountId}`,
      details: error.message
    });
  }
});

// Mensajes de WhatsApp - Ruta directa accesible sin autenticación (para depuración)
app.get('/api/direct/whatsapp/messages/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const accountId = req.query.accountId || '1';  // Por defecto usar la cuenta 1
    const limit = parseInt(req.query.limit) || 50;
    
    // Intentar obtener mensajes del servicio de WhatsApp
    try {
      const response = await axios.get(`${WHATSAPP_SERVER}/accounts/${accountId}/chats/${chatId}/messages`, {
        params: { limit }
      });
      res.json(response.data);
    } catch (whatsappError) {
      console.warn(`Advertencia: error al obtener mensajes desde WhatsApp para ${chatId}:`, whatsappError.message);
      res.json([]);
    }
  } catch (error) {
    console.error(`Error al obtener mensajes del chat ${req.params.chatId}:`, error);
    res.json([]);
  }
});

// Mensajes de WhatsApp - Ruta normal que requiere autenticación
app.get('/api/whatsapp-accounts/:accountId/chats/:chatId/messages', async (req, res) => {
  try {
    const { accountId, chatId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    // Inicializar la cuenta si no está inicializada
    await ensureAccountInitialized(accountId);
    
    // Obtener mensajes
    const response = await axios.get(`${WHATSAPP_SERVER}/accounts/${accountId}/chats/${chatId}/messages`, {
      params: { limit }
    });
    res.json(response.data);
  } catch (error) {
    console.error(`Error al obtener mensajes del chat ${req.params.chatId}:`, error);
    res.status(error.response?.status || 500).json({
      error: `Error al obtener mensajes del chat ${req.params.chatId}`,
      details: error.message
    });
  }
});

// Enviar mensaje de WhatsApp
app.post('/api/whatsapp-accounts/:accountId/send', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { chatId, message } = req.body;
    
    if (!chatId || !message) {
      return res.status(400).json({
        error: 'Se requieren chatId y message en el cuerpo de la solicitud'
      });
    }
    
    // Inicializar la cuenta si no está inicializada
    await ensureAccountInitialized(accountId);
    
    // Enviar mensaje
    const response = await axios.post(`${WHATSAPP_SERVER}/accounts/${accountId}/send`, {
      chatId,
      message
    });
    
    // Registrar el mensaje enviado en la base de datos
    try {
      await axios.post(`${DATABASE_SERVER}/messages`, {
        leadId: null, // TODO: Buscar el lead asociado al número
        content: message,
        direction: 'outbound',
        channel: 'whatsapp',
        read: true,
        metadata: {
          whatsappAccountId: accountId,
          chatId,
          messageId: response.data.message?.id
        }
      });
    } catch (dbError) {
      console.error('Error al registrar mensaje enviado en BD:', dbError.message);
    }
    
    res.json(response.data);
  } catch (error) {
    console.error(`Error al enviar mensaje a través de la cuenta ${req.params.accountId}:`, error);
    res.status(error.response?.status || 500).json({
      error: `Error al enviar mensaje a través de la cuenta ${req.params.accountId}`,
      details: error.message
    });
  }
});

// Obtener código QR para autenticación de WhatsApp
app.get('/api/whatsapp-accounts/:accountId/qr', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    // Inicializar la cuenta si no está inicializada
    await ensureAccountInitialized(accountId);
    
    // Redirigir al servicio de WhatsApp para obtener el QR
    // Usamos axios en lugar de res.redirect para evitar problemas de CORS
    const response = await axios.get(`${WHATSAPP_SERVER}/accounts/${accountId}/qr`, {
      responseType: 'arraybuffer'
    });
    
    res.contentType('image/png');
    res.send(response.data);
  } catch (error) {
    console.error(`Error al obtener código QR para la cuenta ${req.params.accountId}:`, error);
    res.status(error.response?.status || 500).json({
      error: `Error al obtener código QR para la cuenta ${req.params.accountId}`,
      details: error.message
    });
  }
});

// Cerrar sesión de WhatsApp
app.post('/api/whatsapp-accounts/:accountId/logout', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    // Enviar solicitud de cierre de sesión
    const response = await axios.post(`${WHATSAPP_SERVER}/accounts/${accountId}/logout`);
    
    // Actualizar estado en la base de datos
    try {
      await axios.post(`${DATABASE_SERVER}/execute-query`, {
        query: 'UPDATE whatsapp_accounts SET status = $1, "lastDisconnected" = NOW() WHERE id = $2',
        params: ['disconnected', accountId]
      });
    } catch (dbError) {
      console.error('Error al actualizar estado en BD:', dbError.message);
    }
    
    res.json(response.data);
  } catch (error) {
    console.error(`Error al cerrar sesión de la cuenta ${req.params.accountId}:`, error);
    res.status(error.response?.status || 500).json({
      error: `Error al cerrar sesión de la cuenta ${req.params.accountId}`,
      details: error.message
    });
  }
});

// Configuración de respuestas automáticas
app.get('/api/auto-response/config', async (req, res) => {
  try {
    const response = await axios.get(`${PROCESSOR_SERVER}/auto-response/config`);
    res.json(response.data);
  } catch (error) {
    console.error('Error al obtener configuración de respuestas automáticas:', error);
    res.status(error.response?.status || 500).json({
      error: 'Error al obtener configuración de respuestas automáticas',
      details: error.message
    });
  }
});

app.post('/api/auto-response/config', async (req, res) => {
  try {
    const response = await axios.post(`${PROCESSOR_SERVER}/auto-response/config`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error('Error al actualizar configuración de respuestas automáticas:', error);
    res.status(error.response?.status || 500).json({
      error: 'Error al actualizar configuración de respuestas automáticas',
      details: error.message
    });
  }
});

// Análisis manual de texto
app.post('/api/analyze-text', async (req, res) => {
  try {
    const response = await axios.post(`${PROCESSOR_SERVER}/analyze`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error('Error al analizar texto:', error);
    res.status(error.response?.status || 500).json({
      error: 'Error al analizar texto',
      details: error.message
    });
  }
});

// Endpoint interno para notificaciones de código QR (desde el servidor WhatsApp)
app.post('/internal/whatsapp/qr-update', (req, res) => {
  // Este endpoint recibe notificaciones cuando hay un nuevo QR disponible
  console.log('Nuevo código QR recibido');
  
  // Si la imagen está disponible, verificarlo
  const { qrImagePath } = req.body;
  if (qrImagePath && fs.existsSync(qrImagePath)) {
    console.log(`Código QR guardado en: ${qrImagePath}`);
  }
  
  // Guardar una copia en una ubicación conocida para acceso fácil
  try {
    if (qrImagePath && fs.existsSync(qrImagePath)) {
      const simplePath = path.join(process.cwd(), 'temp', 'whatsapp-qr.txt');
      fs.copyFileSync(qrImagePath, simplePath);
      console.log(`Código QR guardado en archivo: ${simplePath}`);
    } else if (req.body.qrText) {
      const simplePath = path.join(process.cwd(), 'temp', 'whatsapp-qr.txt');
      fs.writeFileSync(simplePath, req.body.qrText);
      console.log(`Código QR guardado en archivo: ${simplePath}`);
    }
  } catch (fsError) {
    console.error('Error al guardar copia del código QR:', fsError);
  }
  
  res.json({ success: true });
});

// Endpoint interno para notificaciones de respuestas automáticas (desde el procesador)
app.post('/internal/auto-response/notification', (req, res) => {
  // Este endpoint recibe notificaciones cuando se envía una respuesta automática
  console.log('Notificación de respuesta automática recibida');
  
  // Aquí podríamos enviar notificaciones, actualizar interfaces en tiempo real, etc.
  
  res.json({ success: true });
});

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    status: 'error',
    message: 'Error interno del servidor',
    error: err.message
  });
});

// Función de utilidad para asegurar que una cuenta esté inicializada
async function ensureAccountInitialized(accountId) {
  try {
    // Primero verificar el estado
    try {
      const statusResponse = await axios.get(`${WHATSAPP_SERVER}/accounts/${accountId}/status`);
      // Si ya está inicializada, no hacer nada
      if (statusResponse.data.authenticated) {
        return;
      }
    } catch (statusError) {
      // Si hay error en el status, probablemente no está inicializada
      console.log(`Cuenta ${accountId} no inicializada o no accesible, intentando inicializar...`);
    }
    
    // Inicializar la cuenta
    await axios.post(`${WHATSAPP_SERVER}/accounts/${accountId}/initialize`);
    console.log(`Cuenta ${accountId} inicializada correctamente`);
  } catch (error) {
    console.error(`Error al inicializar cuenta ${accountId}:`, error.message);
    throw error;
  }
}

// Iniciar el servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor API iniciado en http://0.0.0.0:${PORT}`);
});