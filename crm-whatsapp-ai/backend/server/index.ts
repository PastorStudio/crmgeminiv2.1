import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import session from 'express-session';
import { setupRoutes } from './routes';

// Cargar variables de entorno
dotenv.config();

// Verificar conexión a base de datos
console.log('Conectando a la base de datos PostgreSQL...');
try {
  // Importar db para verificar conexión
  const { db } = require('./db');
  console.log('Usando DatabaseStorage con PostgreSQL para datos reales');
} catch (error) {
  console.error('Error al conectar a la base de datos:', error);
  process.exit(1);
}

// Crear aplicación Express
const app = express();
const httpServer = createServer(app);

// Configuración de sesión
const SESSION_SECRET = process.env.SESSION_SECRET || 'secreto-desarrollo-local';
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// Configuración general
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configurar rutas API
setupRoutes(app, httpServer);

// Manejo de errores
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error en servidor:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Error interno del servidor',
      status: err.status || 500
    }
  });
});

// Configurar WebSocketServer para notificaciones en tiempo real
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

wss.on('connection', (ws) => {
  console.log('Cliente WebSocket conectado');
  
  // Enviar mensaje de conexión exitosa
  ws.send(JSON.stringify({
    type: 'connection',
    message: 'Conectado al servidor de notificaciones en tiempo real'
  }));
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Mensaje WebSocket recibido:', data);
      
      // Implementar lógica de autenticación y manejo de mensajes
      if (data.type === 'auth') {
        // Autenticar cliente
      }
    } catch (error) {
      console.error('Error al procesar mensaje WebSocket:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('Cliente WebSocket desconectado');
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Servidor iniciado en el puerto ${PORT}`);
});