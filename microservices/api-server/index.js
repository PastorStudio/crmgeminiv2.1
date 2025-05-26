/**
 * Servidor API - Microservicio independiente
 * 
 * Este servidor gestiona todas las solicitudes HTTP,
 * sirviendo como punto de entrada principal para el sistema.
 */

import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.API_SERVER_PORT || 5000;

// Middleware para JSON y CORS
app.use(express.json());
app.use(cors());

// Configuración de URLs de los microservicios
const WHATSAPP_SERVER_URL = process.env.WHATSAPP_SERVER_URL || 'http://localhost:5001';
const PROCESSOR_SERVER_URL = process.env.PROCESSOR_SERVER_URL || 'http://localhost:5002';
const DATABASE_SERVER_URL = process.env.DATABASE_SERVER_URL || 'http://localhost:5003';

// Crear directorios temporales si no existen
const TEMP_DIR = path.join(__dirname, '..', 'temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
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
    service: 'api-server',
    timestamp: new Date().toISOString()
  });
});

// Ruta de estado general del sistema
app.get('/system/status', async (req, res) => {
  try {
    const status = {
      api: { status: 'ok', timestamp: new Date().toISOString() },
      whatsapp: null,
      processor: null,
      database: null
    };
    
    // Verificar estado de WhatsApp
    try {
      const whatsappRes = await axios.get(`${WHATSAPP_SERVER_URL}/health`, { timeout: 2000 });
      status.whatsapp = whatsappRes.data;
    } catch (error) {
      status.whatsapp = { status: 'error', message: error.message };
    }
    
    // Verificar estado del procesador
    try {
      const processorRes = await axios.get(`${PROCESSOR_SERVER_URL}/health`, { timeout: 2000 });
      status.processor = processorRes.data;
    } catch (error) {
      status.processor = { status: 'error', message: error.message };
    }
    
    // Verificar estado de la base de datos
    try {
      const databaseRes = await axios.get(`${DATABASE_SERVER_URL}/health`, { timeout: 2000 });
      status.database = databaseRes.data;
    } catch (error) {
      status.database = { status: 'error', message: error.message };
    }
    
    res.json(status);
  } catch (error) {
    console.error('Error al obtener estado del sistema:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener estado del sistema',
      error: error.message
    });
  }
});

// === API proxy para WhatsApp ===

// Obtener estado de conexión de WhatsApp
app.get('/api/whatsapp/status', async (req, res) => {
  try {
    const response = await axios.get(`${WHATSAPP_SERVER_URL}/status`);
    res.json(response.data);
  } catch (error) {
    console.error('Error al obtener estado de WhatsApp:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener estado de WhatsApp',
      error: error.message
    });
  }
});

// Iniciar conexión de WhatsApp
app.post('/api/whatsapp/connect', async (req, res) => {
  try {
    const response = await axios.post(`${WHATSAPP_SERVER_URL}/connect`);
    res.json(response.data);
  } catch (error) {
    console.error('Error al conectar WhatsApp:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al conectar WhatsApp',
      error: error.message
    });
  }
});

// Desconectar WhatsApp
app.post('/api/whatsapp/disconnect', async (req, res) => {
  try {
    const response = await axios.post(`${WHATSAPP_SERVER_URL}/disconnect`);
    res.json(response.data);
  } catch (error) {
    console.error('Error al desconectar WhatsApp:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al desconectar WhatsApp',
      error: error.message
    });
  }
});

// Obtener código QR para conexión
app.get('/api/whatsapp/qr', async (req, res) => {
  try {
    const response = await axios.get(`${WHATSAPP_SERVER_URL}/qr`);
    res.send(response.data);
  } catch (error) {
    console.error('Error al obtener código QR:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener código QR',
      error: error.message
    });
  }
});

// Obtener chats de WhatsApp
app.get('/api/whatsapp/chats', async (req, res) => {
  try {
    const response = await axios.get(`${WHATSAPP_SERVER_URL}/chats`);
    res.json(response.data);
  } catch (error) {
    console.error('Error al obtener chats de WhatsApp:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener chats de WhatsApp',
      error: error.message
    });
  }
});

// Obtener mensajes de un chat específico
app.get('/api/whatsapp/chats/:chatId/messages', async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const response = await axios.get(`${WHATSAPP_SERVER_URL}/chats/${chatId}/messages`);
    res.json(response.data);
  } catch (error) {
    console.error(`Error al obtener mensajes del chat ${req.params.chatId}:`, error);
    res.status(500).json({
      status: 'error',
      message: `Error al obtener mensajes del chat ${req.params.chatId}`,
      error: error.message
    });
  }
});

// Enviar mensaje
app.post('/api/whatsapp/send', async (req, res) => {
  try {
    const { chatId, message } = req.body;
    
    if (!chatId || !message) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requieren los campos chatId y message'
      });
    }
    
    const response = await axios.post(`${WHATSAPP_SERVER_URL}/send`, { chatId, message });
    res.json(response.data);
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al enviar mensaje',
      error: error.message
    });
  }
});

// Marcar chat como leído
app.post('/api/whatsapp/read/:chatId', async (req, res) => {
  try {
    const chatId = req.params.chatId;
    const response = await axios.post(`${WHATSAPP_SERVER_URL}/read/${chatId}`);
    res.json(response.data);
  } catch (error) {
    console.error(`Error al marcar chat ${req.params.chatId} como leído:`, error);
    res.status(500).json({
      status: 'error',
      message: `Error al marcar chat ${req.params.chatId} como leído`,
      error: error.message
    });
  }
});

// === API proxy para respuestas automáticas ===



// Ruta para servir la aplicación frontend
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'API del Sistema de Integración WhatsApp lista',
    docs: '/docs'
  });
});

// Documentación de la API
app.get('/docs', (req, res) => {
  res.json({
    api_version: '1.0',
    endpoints: [
      { path: '/api/whatsapp/status', method: 'GET', description: 'Obtiene el estado de conexión de WhatsApp' },
      { path: '/api/whatsapp/connect', method: 'POST', description: 'Inicia la conexión de WhatsApp' },
      { path: '/api/whatsapp/disconnect', method: 'POST', description: 'Cierra la conexión de WhatsApp' },
      { path: '/api/whatsapp/qr', method: 'GET', description: 'Obtiene el código QR para conexión (formato de texto)' },
      { path: '/api/whatsapp/chats', method: 'GET', description: 'Obtiene la lista de chats disponibles' },
      { path: '/api/whatsapp/chats/:chatId/messages', method: 'GET', description: 'Obtiene los mensajes de un chat específico' },
      { path: '/api/whatsapp/send', method: 'POST', description: 'Envía un mensaje de WhatsApp (body: {chatId, message})' },
      { path: '/api/whatsapp/read/:chatId', method: 'POST', description: 'Marca un chat como leído' },

      { path: '/system/status', method: 'GET', description: 'Obtiene el estado de todos los microservicios' }
    ]
  });
});

// Iniciar el servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor API iniciado en http://0.0.0.0:${PORT}`);
  console.log(`📚 Documentación disponible en http://0.0.0.0:${PORT}/docs`);
});

// Manejar señales de cierre
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