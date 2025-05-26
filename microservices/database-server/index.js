/**
 * Servidor de Base de Datos - Microservicio independiente
 * 
 * Este servidor gestiona todas las operaciones de base de datos
 * y proporciona una API para interactuar con ella.
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.DATABASE_SERVER_PORT || 5003;

// Middleware para JSON y CORS
app.use(express.json());
app.use(cors());

// Configuración de conexión a PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Verificar conexión a la base de datos
async function testDatabaseConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Conexión a PostgreSQL exitosa:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('❌ Error al conectar a PostgreSQL:', error);
    return false;
  }
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
app.get('/health', async (req, res) => {
  const dbConnected = await testDatabaseConnection();
  
  res.json({
    status: dbConnected ? 'ok' : 'error',
    service: 'database-server',
    database: dbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// === API para cuentas de WhatsApp ===

// Obtener todas las cuentas de WhatsApp
app.get('/whatsapp-accounts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM whatsapp_accounts ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener cuentas de WhatsApp:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener cuentas de WhatsApp',
      error: error.message
    });
  }
});

// Obtener una cuenta de WhatsApp por ID
app.get('/whatsapp-accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM whatsapp_accounts WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Cuenta de WhatsApp no encontrada'
      });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error(`Error al obtener cuenta de WhatsApp ${req.params.id}:`, error);
    res.status(500).json({
      status: 'error',
      message: `Error al obtener cuenta de WhatsApp ${req.params.id}`,
      error: error.message
    });
  }
});

// Crear nueva cuenta de WhatsApp
app.post('/whatsapp-accounts', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere el campo name'
      });
    }
    
    const result = await pool.query(
      'INSERT INTO whatsapp_accounts (name, description, status) VALUES ($1, $2, $3) RETURNING *',
      [name, description, 'disconnected']
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear cuenta de WhatsApp:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al crear cuenta de WhatsApp',
      error: error.message
    });
  }
});

// Actualizar cuenta de WhatsApp
app.put('/whatsapp-accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status, qrCode } = req.body;
    
    // Verificar que la cuenta existe
    const checkResult = await pool.query('SELECT * FROM whatsapp_accounts WHERE id = $1', [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Cuenta de WhatsApp no encontrada'
      });
    }
    
    // Construir consulta dinámica
    let query = 'UPDATE whatsapp_accounts SET ';
    const params = [];
    const updates = [];
    
    if (name) {
      params.push(name);
      updates.push(`name = $${params.length}`);
    }
    
    if (description !== undefined) {
      params.push(description);
      updates.push(`description = $${params.length}`);
    }
    
    if (status) {
      params.push(status);
      updates.push(`status = $${params.length}`);
      
      // Si se conecta o desconecta, actualizar timestamp
      if (status === 'connected') {
        updates.push(`"lastConnected" = NOW()`);
      } else if (status === 'disconnected') {
        updates.push(`"lastDisconnected" = NOW()`);
      }
    }
    
    if (qrCode !== undefined) {
      params.push(qrCode);
      updates.push(`"qrCode" = $${params.length}`);
    }
    
    // Agregar siempre el timestamp de actualización
    updates.push(`"updatedAt" = NOW()`);
    
    // Finalizar consulta
    query += updates.join(', ');
    query += ' WHERE id = $' + (params.length + 1) + ' RETURNING *';
    params.push(id);
    
    const result = await pool.query(query, params);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error(`Error al actualizar cuenta de WhatsApp ${req.params.id}:`, error);
    res.status(500).json({
      status: 'error',
      message: `Error al actualizar cuenta de WhatsApp ${req.params.id}`,
      error: error.message
    });
  }
});

// Eliminar cuenta de WhatsApp
app.delete('/whatsapp-accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que la cuenta existe
    const checkResult = await pool.query('SELECT * FROM whatsapp_accounts WHERE id = $1', [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Cuenta de WhatsApp no encontrada'
      });
    }
    
    await pool.query('DELETE FROM whatsapp_accounts WHERE id = $1', [id]);
    
    res.json({
      status: 'success',
      message: `Cuenta de WhatsApp ${id} eliminada exitosamente`
    });
  } catch (error) {
    console.error(`Error al eliminar cuenta de WhatsApp ${req.params.id}:`, error);
    res.status(500).json({
      status: 'error',
      message: `Error al eliminar cuenta de WhatsApp ${req.params.id}`,
      error: error.message
    });
  }
});

// === API para mensajes ===

// Obtener mensajes por cuenta y chat
app.get('/messages/:accountId/:chatId', async (req, res) => {
  try {
    const { accountId, chatId } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM whatsapp_messages WHERE "accountId" = $1 AND "chatId" = $2 ORDER BY "timestamp" DESC LIMIT 100',
      [accountId, chatId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error(`Error al obtener mensajes para cuenta ${req.params.accountId}, chat ${req.params.chatId}:`, error);
    res.status(500).json({
      status: 'error',
      message: `Error al obtener mensajes para cuenta ${req.params.accountId}, chat ${req.params.chatId}`,
      error: error.message
    });
  }
});

// Guardar un nuevo mensaje
app.post('/messages', async (req, res) => {
  try {
    const { accountId, chatId, messageId, fromMe, content, hasMedia, mediaUrl, mediaType, metadata } = req.body;
    
    if (!accountId || !chatId || !content) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requieren los campos accountId, chatId y content'
      });
    }
    
    const result = await pool.query(
      `INSERT INTO whatsapp_messages 
      ("accountId", "chatId", "messageId", from_me, content, "hasMedia", "mediaUrl", "mediaType", metadata) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
      RETURNING *`,
      [accountId, chatId, messageId, fromMe, content, hasMedia || false, mediaUrl, mediaType, metadata || {}]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al guardar mensaje:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al guardar mensaje',
      error: error.message
    });
  }
});



// Iniciar el servidor
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`✅ Servidor de Base de Datos iniciado en http://0.0.0.0:${PORT}`);
  
  // Verificar conexión a la base de datos
  const dbConnected = await testDatabaseConnection();
  
  if (dbConnected) {
    console.log('Base de datos PostgreSQL conectada y lista para usar');
  } else {
    console.error('⚠️ No se pudo conectar a la base de datos PostgreSQL');
    console.error('Verifique que la variable de entorno DATABASE_URL esté configurada correctamente');
  }
});

// Manejar señales de cierre
process.on('SIGINT', () => {
  console.log('Cerrando servidor de Base de Datos...');
  server.close(() => {
    console.log('Servidor de Base de Datos detenido');
    pool.end().catch((err) => console.error('Error al cerrar pool de conexiones:', err));
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Cerrando servidor de Base de Datos...');
  server.close(() => {
    console.log('Servidor de Base de Datos detenido');
    pool.end().catch((err) => console.error('Error al cerrar pool de conexiones:', err));
    process.exit(0);
  });
});