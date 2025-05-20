/**
 * API Server
 * Servidor principal para manejar peticiones HTTP y la lógica de negocio
 */

const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const axios = require('axios');

// Configuración básica
const app = express();
const PORT = process.env.API_SERVER_PORT || 5000;
const httpServer = createServer(app);

// Configuración de middleware
app.use(express.json());
app.use(cors());

// Configuración de WebSocket para comunicación con otros servidores
const wss = new WebSocketServer({ server: httpServer, path: '/internal-api' });

// Conexiones a otros servidores
const WHATSAPP_SERVER = process.env.WHATSAPP_SERVER || 'http://localhost:5001';
const PROCESSOR_SERVER = process.env.PROCESSOR_SERVER || 'http://localhost:5002';
const DATABASE_SERVER = process.env.DATABASE_SERVER || 'http://localhost:5003';

// Estado de las conexiones
let serverConnections = {
  whatsapp: false,
  processor: false,
  database: false
};

// WebSocket para comunicación interna entre servidores
wss.on('connection', (ws) => {
  console.log('Nueva conexión interna establecida');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Mensaje recibido desde otro servidor:', data.type);
      
      // Procesar mensajes de otros servidores
      if (data.type === 'status_update') {
        serverConnections[data.server] = data.status;
        console.log(`Estado de ${data.server} actualizado a: ${data.status}`);
      }
      
      if (data.type === 'whatsapp_message') {
        // Reenviar mensajes a clientes conectados
        console.log('Mensaje de WhatsApp recibido, procesando...');
        // Aquí implementaríamos la lógica para reenviar a clientes
      }
    } catch (error) {
      console.error('Error procesando mensaje:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('Conexión interna cerrada');
  });
});

// Verificación de estado de servidores
async function checkServerStatus() {
  try {
    // Verificar WhatsApp Server
    await axios.get(`${WHATSAPP_SERVER}/health`);
    serverConnections.whatsapp = true;
  } catch (error) {
    serverConnections.whatsapp = false;
    console.error('WhatsApp Server no disponible:', error.message);
  }
  
  try {
    // Verificar Processor Server
    await axios.get(`${PROCESSOR_SERVER}/health`);
    serverConnections.processor = true;
  } catch (error) {
    serverConnections.processor = false;
    console.error('Processor Server no disponible:', error.message);
  }
  
  try {
    // Verificar Database Server
    await axios.get(`${DATABASE_SERVER}/health`);
    serverConnections.database = true;
  } catch (error) {
    serverConnections.database = false;
    console.error('Database Server no disponible:', error.message);
  }
}

// API Routes

// Endpoint de salud para verificar estado del servidor API
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'api',
    connections: serverConnections
  });
});

// Proxy para WhatsApp
app.get('/api/whatsapp/status', async (req, res) => {
  try {
    const response = await axios.get(`${WHATSAPP_SERVER}/status`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Error de conexión con WhatsApp Server', details: error.message });
  }
});

app.get('/api/whatsapp/chats', async (req, res) => {
  try {
    const response = await axios.get(`${WHATSAPP_SERVER}/chats`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo chats de WhatsApp', details: error.message });
  }
});

app.get('/api/whatsapp/messages/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const response = await axios.get(`${WHATSAPP_SERVER}/messages/${chatId}`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo mensajes de WhatsApp', details: error.message });
  }
});

app.post('/api/whatsapp/send', async (req, res) => {
  try {
    const { to, message } = req.body;
    const response = await axios.post(`${WHATSAPP_SERVER}/send`, { to, message });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Error enviando mensaje de WhatsApp', details: error.message });
  }
});

// Proxy para Processor Server (AI, análisis, etc.)
app.post('/api/analyze', async (req, res) => {
  try {
    const response = await axios.post(`${PROCESSOR_SERVER}/analyze`, req.body);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Error analizando mensaje', details: error.message });
  }
});

// Proxy para Database Server (CRUD de datos)
app.get('/api/users', async (req, res) => {
  try {
    const response = await axios.get(`${DATABASE_SERVER}/users`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo usuarios', details: error.message });
  }
});

app.get('/api/leads', async (req, res) => {
  try {
    const response = await axios.get(`${DATABASE_SERVER}/leads`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo leads', details: error.message });
  }
});

// Iniciar servidor
httpServer.listen(PORT, () => {
  console.log(`API Server corriendo en http://localhost:${PORT}`);
  
  // Verificar estado de otros servidores
  checkServerStatus();
  
  // Programar verificación periódica
  setInterval(checkServerStatus, 30000); // Cada 30 segundos
});