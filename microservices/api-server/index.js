/**
 * Servidor de API - Microservicio independiente
 * 
 * Este microservicio actúa como punto de entrada centralizado para la aplicación,
 * proporcionando APIs RESTful para el frontend y coordinando la comunicación
 * entre todos los demás microservicios.
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.API_SERVER_PORT || 5000;
const DATABASE_SERVER_URL = process.env.DATABASE_SERVER_URL || 'http://localhost:5003';
const WHATSAPP_SERVER_URL = process.env.WHATSAPP_SERVER_URL || 'http://localhost:5001';
const PROCESSOR_SERVER_URL = process.env.PROCESSOR_SERVER_URL || 'http://localhost:5002';

// Middleware para JSON y CORS
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Log de todas las solicitudes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Ruta para servir archivos estáticos (frontend)
app.use(express.static(path.join(__dirname, '..', '..', 'client', 'dist')));

// === Rutas de la API ===

// Ruta de salud para verificar todos los servicios
app.get('/api/health', async (req, res) => {
  const results = {
    api: {
      status: 'ok',
      service: 'api-server',
      timestamp: new Date().toISOString()
    },
    database: { status: 'unknown' },
    whatsapp: { status: 'unknown' },
    processor: { status: 'unknown' }
  };
  
  // Verificar el estado de cada servicio
  try {
    const dbRes = await axios.get(`${DATABASE_SERVER_URL}/health`, { timeout: 3000 });
    results.database = dbRes.data;
  } catch (error) {
    results.database = {
      status: 'error',
      message: `No se pudo conectar al servicio de base de datos: ${error.message}`,
      error: error.code
    };
  }
  
  try {
    const waRes = await axios.get(`${WHATSAPP_SERVER_URL}/health`, { timeout: 3000 });
    results.whatsapp = waRes.data;
  } catch (error) {
    results.whatsapp = {
      status: 'error',
      message: `No se pudo conectar al servicio de WhatsApp: ${error.message}`,
      error: error.code
    };
  }
  
  try {
    const procRes = await axios.get(`${PROCESSOR_SERVER_URL}/health`, { timeout: 3000 });
    results.processor = procRes.data;
  } catch (error) {
    results.processor = {
      status: 'error',
      message: `No se pudo conectar al servicio de procesamiento: ${error.message}`,
      error: error.code
    };
  }
  
  // Determinar el estado general
  const allServicesOk = 
    results.database.status === 'ok' &&
    results.whatsapp.status === 'ok' &&
    results.processor.status === 'ok';
  
  res.json({
    status: allServicesOk ? 'ok' : 'partial',
    timestamp: new Date().toISOString(),
    services: results
  });
});

// === Rutas para cuentas de WhatsApp ===

// Obtener todas las cuentas de WhatsApp
app.get('/api/whatsapp-accounts', async (req, res) => {
  try {
    const response = await axios.get(`${DATABASE_SERVER_URL}/whatsapp-accounts`);
    res.json(response.data);
  } catch (error) {
    console.error('Error al obtener cuentas de WhatsApp:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener cuentas de WhatsApp',
      error: error.message
    });
  }
});

// Obtener una cuenta específica
app.get('/api/whatsapp-accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${DATABASE_SERVER_URL}/whatsapp-accounts/${id}`);
    res.json(response.data);
  } catch (error) {
    console.error(`Error al obtener cuenta de WhatsApp ${req.params.id}:`, error.message);
    res.status(error.response?.status || 500).json({
      status: 'error',
      message: `Error al obtener cuenta de WhatsApp ${req.params.id}`,
      error: error.message
    });
  }
});

// Conectar una cuenta de WhatsApp
app.post('/api/whatsapp/connect', async (req, res) => {
  try {
    const { accountId } = req.body;
    
    if (!accountId) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere el ID de la cuenta de WhatsApp'
      });
    }
    
    const response = await axios.post(`${WHATSAPP_SERVER_URL}/connect`, { accountId });
    res.json(response.data);
  } catch (error) {
    console.error('Error al conectar WhatsApp:', error.message);
    res.status(error.response?.status || 500).json({
      status: 'error',
      message: 'Error al conectar WhatsApp',
      error: error.message
    });
  }
});

// Obtener código QR para una cuenta
app.get('/api/whatsapp/qr-code/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    const response = await axios.get(`${WHATSAPP_SERVER_URL}/qr-code/${accountId}`);
    res.json(response.data);
  } catch (error) {
    console.error(`Error al obtener código QR para cuenta ${req.params.accountId}:`, error.message);
    res.status(error.response?.status || 500).json({
      status: 'error',
      message: `Error al obtener código QR para cuenta ${req.params.accountId}`,
      error: error.message
    });
  }
});

// Desconectar una cuenta de WhatsApp
app.post('/api/whatsapp/disconnect/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    const response = await axios.post(`${WHATSAPP_SERVER_URL}/disconnect/${accountId}`);
    res.json(response.data);
  } catch (error) {
    console.error(`Error al desconectar cuenta ${req.params.accountId}:`, error.message);
    res.status(error.response?.status || 500).json({
      status: 'error',
      message: `Error al desconectar cuenta ${req.params.accountId}`,
      error: error.message
    });
  }
});

// Obtener estado de conexión
app.get('/api/whatsapp/connection-status/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    const response = await axios.get(`${WHATSAPP_SERVER_URL}/connection-status/${accountId}`);
    res.json(response.data);
  } catch (error) {
    console.error(`Error al obtener estado de conexión para cuenta ${req.params.accountId}:`, error.message);
    res.status(error.response?.status || 500).json({
      status: 'error',
      message: `Error al obtener estado de conexión para cuenta ${req.params.accountId}`,
      error: error.message
    });
  }
});

// === Rutas para mensajes ===

// Enviar mensaje
app.post('/api/whatsapp/send-message', async (req, res) => {
  try {
    const { accountId, chatId, message, mediaUrl } = req.body;
    
    if (!accountId || !chatId || (!message && !mediaUrl)) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requieren accountId, chatId y message o mediaUrl'
      });
    }
    
    const response = await axios.post(`${WHATSAPP_SERVER_URL}/send-message`, {
      accountId,
      chatId,
      message,
      mediaUrl
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error al enviar mensaje:', error.message);
    res.status(error.response?.status || 500).json({
      status: 'error',
      message: 'Error al enviar mensaje',
      error: error.message
    });
  }
});

// Obtener mensajes por chat
app.get('/api/messages/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const accountId = req.query.accountId || 1;
    const limit = req.query.limit || 50;
    
    const response = await axios.get(`${DATABASE_SERVER_URL}/messages/${chatId}`, {
      params: {
        accountId,
        limit
      }
    });
    
    res.json(response.data);
  } catch (error) {
    console.error(`Error al obtener mensajes para chat ${req.params.chatId}:`, error.message);
    res.status(error.response?.status || 500).json({
      status: 'error',
      message: `Error al obtener mensajes para chat ${req.params.chatId}`,
      error: error.message
    });
  }
});

// Obtener chats
app.get('/api/whatsapp/chats/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    const response = await axios.get(`${WHATSAPP_SERVER_URL}/chats/${accountId}`);
    res.json(response.data);
  } catch (error) {
    console.error(`Error al obtener chats para cuenta ${req.params.accountId}:`, error.message);
    res.status(error.response?.status || 500).json({
      status: 'error',
      message: `Error al obtener chats para cuenta ${req.params.accountId}`,
      error: error.message
    });
  }
});

// === Rutas para configuración de respuestas automáticas ===

// Obtener configuración actual
app.get('/api/auto-response/config', async (req, res) => {
  try {
    const response = await axios.get(`${DATABASE_SERVER_URL}/auto-response/config`);
    res.json(response.data);
  } catch (error) {
    console.error('Error al obtener configuración de respuestas automáticas:', error.message);
    res.status(error.response?.status || 500).json({
      status: 'error',
      message: 'Error al obtener configuración de respuestas automáticas',
      error: error.message
    });
  }
});

// Actualizar configuración
app.post('/api/auto-response/config', async (req, res) => {
  try {
    const config = req.body;
    
    // Actualizar en el servicio de procesamiento
    const processorResponse = await axios.post(`${PROCESSOR_SERVER_URL}/auto-response/config`, config);
    
    res.json(processorResponse.data);
  } catch (error) {
    console.error('Error al actualizar configuración de respuestas automáticas:', error.message);
    res.status(error.response?.status || 500).json({
      status: 'error',
      message: 'Error al actualizar configuración de respuestas automáticas',
      error: error.message
    });
  }
});

// === Rutas para análisis de mensajes con IA ===

// Generar respuesta con IA
app.post('/api/ai/generate-response', async (req, res) => {
  try {
    const { message, contactName } = req.body;
    
    if (!message) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere el contenido del mensaje'
      });
    }
    
    const response = await axios.post(`${PROCESSOR_SERVER_URL}/generate-response`, {
      message,
      contactName
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error al generar respuesta con IA:', error.message);
    res.status(error.response?.status || 500).json({
      status: 'error',
      message: 'Error al generar respuesta con IA',
      error: error.message
    });
  }
});

// Analizar mensaje con IA
app.post('/api/ai/analyze-message', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere el contenido del mensaje'
      });
    }
    
    const response = await axios.post(`${PROCESSOR_SERVER_URL}/analyze-message`, {
      message
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Error al analizar mensaje con IA:', error.message);
    res.status(error.response?.status || 500).json({
      status: 'error',
      message: 'Error al analizar mensaje con IA',
      error: error.message
    });
  }
});

// === Rutas para zona horaria ===

// Obtener información de zona horaria
app.get('/api/timezone', (req, res) => {
  const timeZoneInfo = {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    offset: new Date().getTimezoneOffset() / -60, // Convertir a horas (negativo porque getTimezoneOffset() devuelve inverso)
    date: new Date().toISOString(),
    localTime: new Date().toLocaleString(),
    timestamp: Date.now()
  };
  
  res.json(timeZoneInfo);
});

// === Ruta para servir la aplicación frontend ===

// Esto debe ir al final para no interferir con las rutas de la API
app.get('*', (req, res) => {
  // Para vistas de SPA (Single Page Application)
  res.sendFile(path.join(__dirname, '..', '..', 'client', 'dist', 'index.html'));
});

// Iniciar el servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor API iniciado en http://0.0.0.0:${PORT}`);
});

// Manejar cierre de proceso
process.on('SIGINT', () => {
  console.log('Cerrando servidor API...');
  server.close(() => {
    console.log('Servidor API detenido');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Cerrando servidor API...');
  server.close(() => {
    console.log('Servidor API detenido');
    process.exit(0);
  });
});