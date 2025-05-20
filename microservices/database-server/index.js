/**
 * Servidor de base de datos - Microservicio independiente
 * 
 * Este servidor gestiona todas las operaciones relacionadas con la base de datos,
 * proporcionando una API REST para que los demás microservicios puedan 
 * interactuar con los datos almacenados en PostgreSQL.
 */

const express = require('express');
const cors = require('cors');
const { Pool } = require('@neondatabase/serverless');
const app = express();
const PORT = process.env.DATABASE_SERVER_PORT || 5003;

// Verificar que DATABASE_URL está configurado
if (!process.env.DATABASE_URL) {
  console.error('ERROR: La variable de entorno DATABASE_URL no está configurada.');
  console.error('Por favor, asegúrese de tener una base de datos PostgreSQL configurada.');
  process.exit(1);
}

// Conexión a la base de datos PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Middleware para JSON y CORS
app.use(express.json());
app.use(cors());

// Log de todas las solicitudes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Ruta de salud para verificar que el servicio está funcionando
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'database-server',
    timestamp: new Date().toISOString(),
    postgresConnected: true
  });
});

// Probar la conexión a la base de datos
app.get('/test-connection', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'ok',
      connection: 'successful',
      timestamp: result.rows[0].now
    });
  } catch (error) {
    console.error('Error al conectar a la base de datos:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al conectar a la base de datos',
      error: error.message
    });
  }
});

// Inicializar la base de datos (crear tablas si no existen)
app.post('/initialize', async (req, res) => {
  try {
    // Crear tabla de cuentas de WhatsApp
    await pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_accounts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'disconnected',
        "qrCode" TEXT,
        "lastConnected" TIMESTAMP,
        "lastDisconnected" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW(),
        settings JSONB DEFAULT '{}'::jsonb
      )
    `);

    // Crear tabla de mensajes de WhatsApp
    await pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id SERIAL PRIMARY KEY,
        "accountId" INTEGER REFERENCES whatsapp_accounts(id),
        "chatId" VARCHAR(100) NOT NULL,
        "messageId" VARCHAR(100),
        from_me BOOLEAN NOT NULL,
        content TEXT,
        "timestamp" TIMESTAMP NOT NULL,
        "hasMedia" BOOLEAN DEFAULT FALSE,
        "mediaUrl" TEXT,
        "mediaType" VARCHAR(50),
        metadata JSONB DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Crear tabla de chats de WhatsApp
    await pool.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_chats (
        id SERIAL PRIMARY KEY,
        "accountId" INTEGER REFERENCES whatsapp_accounts(id),
        "chatId" VARCHAR(100) NOT NULL,
        name VARCHAR(100),
        "isGroup" BOOLEAN DEFAULT FALSE,
        "lastMessageAt" TIMESTAMP,
        "unreadCount" INTEGER DEFAULT 0,
        metadata JSONB DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW(),
        UNIQUE("accountId", "chatId")
      )
    `);
    
    // Crear tabla para configuración de respuestas automáticas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS auto_response_config (
        id SERIAL PRIMARY KEY,
        enabled BOOLEAN DEFAULT FALSE,
        "greetingMessage" TEXT,
        "outOfHoursMessage" TEXT,
        "businessHoursStart" TIME,
        "businessHoursEnd" TIME,
        "workingDays" VARCHAR(50) DEFAULT '1,2,3,4,5',
        settings JSONB DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Crear tabla para leads (clientes potenciales)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        phone VARCHAR(20) UNIQUE,
        email VARCHAR(100),
        status VARCHAR(20) DEFAULT 'new',
        source VARCHAR(50),
        "assignedTo" INTEGER,
        notes TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Insertar cuenta de WhatsApp por defecto si no existe
    const accountExists = await pool.query('SELECT id FROM whatsapp_accounts WHERE id = 1');
    if (accountExists.rows.length === 0) {
      await pool.query(`
        INSERT INTO whatsapp_accounts (id, name, description, status)
        VALUES (1, 'Cuenta Principal', 'Cuenta principal de WhatsApp Business', 'disconnected')
      `);
    }
    
    // Insertar configuración de respuestas automáticas por defecto si no existe
    const configExists = await pool.query('SELECT id FROM auto_response_config WHERE id = 1');
    if (configExists.rows.length === 0) {
      await pool.query(`
        INSERT INTO auto_response_config (
          id, enabled, "greetingMessage", "outOfHoursMessage", 
          "businessHoursStart", "businessHoursEnd"
        )
        VALUES (
          1, 
          false, 
          'Gracias por contactarnos. En breve un asesor le atenderá.',
          'Gracias por su mensaje. Nuestro horario de atención es de lunes a viernes de 9:00 a 18:00. Le responderemos en cuanto estemos disponibles.',
          '09:00:00',
          '18:00:00'
        )
      `);
    }
    
    res.json({
      status: 'ok',
      message: 'Base de datos inicializada correctamente'
    });
  } catch (error) {
    console.error('Error al inicializar la base de datos:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al inicializar la base de datos',
      error: error.message
    });
  }
});

// Ejecutar consulta SQL directa (sólo para uso interno)
app.post('/execute-query', async (req, res) => {
  try {
    const { query, params } = req.body;
    
    if (!query) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere una consulta SQL'
      });
    }
    
    const result = await pool.query(query, params || []);
    res.json({
      status: 'ok',
      rowCount: result.rowCount,
      rows: result.rows
    });
  } catch (error) {
    console.error('Error al ejecutar consulta SQL:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al ejecutar consulta SQL',
      error: error.message
    });
  }
});

// === API para cuentas de WhatsApp ===

// Obtener todas las cuentas de WhatsApp
app.get('/whatsapp-accounts', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM whatsapp_accounts
      ORDER BY id ASC
    `);
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

// Obtener una cuenta de WhatsApp específica
app.get('/whatsapp-accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT * FROM whatsapp_accounts
      WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: `Cuenta de WhatsApp con ID ${id} no encontrada`
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

// Crear una nueva cuenta de WhatsApp
app.post('/whatsapp-accounts', async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requiere un nombre para la cuenta'
      });
    }
    
    const result = await pool.query(`
      INSERT INTO whatsapp_accounts (name, description, status)
      VALUES ($1, $2, 'disconnected')
      RETURNING *
    `, [name, description || '']);
    
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

// Actualizar una cuenta de WhatsApp
app.put('/whatsapp-accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status, qrCode } = req.body;
    
    // Verificar que la cuenta existe
    const accountExists = await pool.query('SELECT id FROM whatsapp_accounts WHERE id = $1', [id]);
    if (accountExists.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: `Cuenta de WhatsApp con ID ${id} no encontrada`
      });
    }
    
    // Construir consulta dinámica
    let updateFields = [];
    let params = [];
    let paramIndex = 1;
    
    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      params.push(name);
    }
    
    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      params.push(description);
    }
    
    if (status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      params.push(status);
      
      // Actualizar campos de conexión/desconexión según el estado
      if (status === 'connected') {
        updateFields.push(`"lastConnected" = NOW()`);
      } else if (status === 'disconnected') {
        updateFields.push(`"lastDisconnected" = NOW()`);
      }
    }
    
    if (qrCode !== undefined) {
      updateFields.push(`"qrCode" = $${paramIndex++}`);
      params.push(qrCode);
    }
    
    // Siempre actualizar la fecha de actualización
    updateFields.push(`"updatedAt" = NOW()`);
    
    // Si no hay campos para actualizar, retornar error
    if (updateFields.length === 1) { // Solo updatedAt
      return res.status(400).json({
        status: 'error',
        message: 'No se proporcionaron campos para actualizar'
      });
    }
    
    // Ejecutar la consulta
    params.push(id); // Añadir el ID al final
    const result = await pool.query(`
      UPDATE whatsapp_accounts
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, params);
    
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

// Eliminar una cuenta de WhatsApp
app.delete('/whatsapp-accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que no sea la cuenta principal (ID 1)
    if (id === '1') {
      return res.status(400).json({
        status: 'error',
        message: 'No se puede eliminar la cuenta principal'
      });
    }
    
    // Eliminar la cuenta
    const result = await pool.query(`
      DELETE FROM whatsapp_accounts
      WHERE id = $1
      RETURNING id
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: `Cuenta de WhatsApp con ID ${id} no encontrada`
      });
    }
    
    res.json({
      status: 'ok',
      message: `Cuenta de WhatsApp con ID ${id} eliminada correctamente`
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

// Guardar un nuevo mensaje
app.post('/messages', async (req, res) => {
  try {
    const {
      accountId,
      chatId,
      messageId,
      from_me,
      content,
      timestamp,
      hasMedia,
      mediaUrl,
      mediaType,
      metadata
    } = req.body;
    
    if (!chatId || from_me === undefined || !content) {
      return res.status(400).json({
        status: 'error',
        message: 'Se requieren los campos chatId, from_me y content'
      });
    }
    
    // Insertar mensaje
    const result = await pool.query(`
      INSERT INTO whatsapp_messages (
        "accountId", "chatId", "messageId", from_me, content, 
        "timestamp", "hasMedia", "mediaUrl", "mediaType", metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      accountId || 1, // Usar cuenta 1 por defecto
      chatId,
      messageId || null,
      from_me,
      content,
      timestamp ? new Date(timestamp) : new Date(),
      hasMedia || false,
      mediaUrl || null,
      mediaType || null,
      metadata || {}
    ]);
    
    // Actualizar o crear el chat asociado
    await pool.query(`
      INSERT INTO whatsapp_chats ("accountId", "chatId", "lastMessageAt", "updatedAt")
      VALUES ($1, $2, NOW(), NOW())
      ON CONFLICT ("accountId", "chatId") 
      DO UPDATE SET 
        "lastMessageAt" = NOW(), 
        "updatedAt" = NOW(),
        "unreadCount" = CASE WHEN $3 = false THEN whatsapp_chats."unreadCount" + 1 ELSE whatsapp_chats."unreadCount" END
    `, [accountId || 1, chatId, from_me]);
    
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

// Obtener mensajes por chat
app.get('/messages/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const accountId = req.query.accountId || 1; // Por defecto cuenta 1
    const limit = parseInt(req.query.limit) || 50;
    
    const result = await pool.query(`
      SELECT * FROM whatsapp_messages
      WHERE "chatId" = $1 AND "accountId" = $2
      ORDER BY "timestamp" DESC
      LIMIT $3
    `, [chatId, accountId, limit]);
    
    res.json(result.rows);
  } catch (error) {
    console.error(`Error al obtener mensajes del chat ${req.params.chatId}:`, error);
    res.status(500).json({
      status: 'error',
      message: `Error al obtener mensajes del chat ${req.params.chatId}`,
      error: error.message
    });
  }
});

// === API para chats ===

// Obtener todos los chats de una cuenta
app.get('/chats', async (req, res) => {
  try {
    const accountId = req.query.accountId || 1; // Por defecto cuenta 1
    
    const result = await pool.query(`
      SELECT * FROM whatsapp_chats
      WHERE "accountId" = $1
      ORDER BY "lastMessageAt" DESC
    `, [accountId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener chats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener chats',
      error: error.message
    });
  }
});

// === API para configuración de respuestas automáticas ===

// Obtener configuración actual
app.get('/auto-response/config', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM auto_response_config LIMIT 1');
    
    if (result.rows.length === 0) {
      // Si no existe configuración, crear una por defecto
      const newConfig = await pool.query(`
        INSERT INTO auto_response_config (
          enabled, "greetingMessage", "outOfHoursMessage", 
          "businessHoursStart", "businessHoursEnd"
        )
        VALUES (
          false, 
          'Gracias por contactarnos. En breve un asesor le atenderá.',
          'Gracias por su mensaje. Nuestro horario de atención es de lunes a viernes de 9:00 a 18:00. Le responderemos en cuanto estemos disponibles.',
          '09:00:00',
          '18:00:00'
        )
        RETURNING *
      `);
      
      return res.json(newConfig.rows[0]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener configuración de respuestas automáticas:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener configuración de respuestas automáticas',
      error: error.message
    });
  }
});

// Actualizar configuración
app.post('/auto-response/config', async (req, res) => {
  try {
    const {
      enabled,
      greetingMessage,
      outOfHoursMessage,
      businessHoursStart,
      businessHoursEnd,
      workingDays,
      settings
    } = req.body;
    
    // Construir consulta dinámica
    let updateFields = [];
    let params = [];
    let paramIndex = 1;
    
    if (enabled !== undefined) {
      updateFields.push(`enabled = $${paramIndex++}`);
      params.push(enabled);
    }
    
    if (greetingMessage !== undefined) {
      updateFields.push(`"greetingMessage" = $${paramIndex++}`);
      params.push(greetingMessage);
    }
    
    if (outOfHoursMessage !== undefined) {
      updateFields.push(`"outOfHoursMessage" = $${paramIndex++}`);
      params.push(outOfHoursMessage);
    }
    
    if (businessHoursStart !== undefined) {
      updateFields.push(`"businessHoursStart" = $${paramIndex++}`);
      params.push(businessHoursStart);
    }
    
    if (businessHoursEnd !== undefined) {
      updateFields.push(`"businessHoursEnd" = $${paramIndex++}`);
      params.push(businessHoursEnd);
    }
    
    if (workingDays !== undefined) {
      updateFields.push(`"workingDays" = $${paramIndex++}`);
      params.push(workingDays);
    }
    
    if (settings !== undefined) {
      updateFields.push(`settings = $${paramIndex++}`);
      params.push(settings);
    }
    
    // Siempre actualizar la fecha de actualización
    updateFields.push(`"updatedAt" = NOW()`);
    
    // Si no hay campos para actualizar, retornar error
    if (updateFields.length === 1) { // Solo updatedAt
      return res.status(400).json({
        status: 'error',
        message: 'No se proporcionaron campos para actualizar'
      });
    }
    
    // Comprobar si existe configuración
    const configExists = await pool.query('SELECT id FROM auto_response_config LIMIT 1');
    
    let result;
    if (configExists.rows.length === 0) {
      // Si no existe, crear una nueva
      result = await pool.query(`
        INSERT INTO auto_response_config (${updateFields.map((_, i) => `$${i + 1}`).join(', ')})
        VALUES (${updateFields.map((_, i) => `$${i + 1}`).join(', ')})
        RETURNING *
      `, params);
    } else {
      // Si existe, actualizarla
      const id = configExists.rows[0].id;
      result = await pool.query(`
        UPDATE auto_response_config
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, [...params, id]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar configuración de respuestas automáticas:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar configuración de respuestas automáticas',
      error: error.message
    });
  }
});

// Iniciar el servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor de base de datos iniciado en http://0.0.0.0:${PORT}`);
  
  // Inicializar la base de datos
  fetch(`http://localhost:${PORT}/initialize`, {
    method: 'POST'
  }).then(response => response.json())
    .then(data => {
      console.log('Inicialización de la base de datos:', data.status);
    })
    .catch(error => {
      console.error('Error al inicializar la base de datos:', error);
    });
});

// Manejar señales de cierre
process.on('SIGINT', () => {
  console.log('Cerrando conexiones a la base de datos...');
  pool.end();
  server.close(() => {
    console.log('Servidor detenido');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Cerrando conexiones a la base de datos...');
  pool.end();
  server.close(() => {
    console.log('Servidor detenido');
    process.exit(0);
  });
});