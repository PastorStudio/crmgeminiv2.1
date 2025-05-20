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
  console.error('Sin embargo, continuaremos para pruebas sin base de datos real.');
}

// Conexión a la base de datos PostgreSQL (o memoria si no está disponible)
let pool;
let dbConnected = false;

try {
  if (process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    dbConnected = true;
    console.log('Conectado a la base de datos PostgreSQL');
  } else {
    console.log('Modo simulado: No se usará PostgreSQL real');
  }
} catch (error) {
  console.error('Error al conectar a PostgreSQL:', error);
}

// Middleware para JSON y CORS
app.use(express.json());
app.use(cors());

// Log de todas las solicitudes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Almacenamiento en memoria (fallback si no hay base de datos)
const memoryStorage = {
  whatsappAccounts: [
    {
      id: 1,
      name: 'Cuenta Principal',
      description: 'Cuenta principal de WhatsApp Business',
      status: 'disconnected',
      lastConnected: null,
      lastDisconnected: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  whatsappMessages: [],
  whatsappChats: [],
  autoResponseConfig: {
    id: 1,
    enabled: false,
    greetingMessage: 'Gracias por contactarnos. En breve un asesor le atenderá.',
    outOfHoursMessage: 'Gracias por su mensaje. Nuestro horario de atención es de lunes a viernes de 9:00 a 18:00. Le responderemos en cuanto estemos disponibles.',
    businessHoursStart: '09:00:00',
    businessHoursEnd: '18:00:00',
    workingDays: '1,2,3,4,5',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
};

// Funciones de acceso a datos
async function executeQuery(query, params = []) {
  if (dbConnected) {
    try {
      const result = await pool.query(query, params);
      return result;
    } catch (error) {
      console.error('Error al ejecutar consulta SQL:', error);
      throw error;
    }
  } else {
    console.log('Consulta simulada (sin BD):', query, params);
    return { rows: [], rowCount: 0 };
  }
}

// Ruta de salud para verificar que el servicio está funcionando
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'database-server',
    timestamp: new Date().toISOString(),
    postgresConnected: dbConnected
  });
});

// === API para cuentas de WhatsApp ===

// Obtener todas las cuentas de WhatsApp
app.get('/whatsapp-accounts', async (req, res) => {
  try {
    if (dbConnected) {
      const result = await pool.query('SELECT * FROM whatsapp_accounts ORDER BY id ASC');
      res.json(result.rows);
    } else {
      res.json(memoryStorage.whatsappAccounts);
    }
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
    
    if (dbConnected) {
      const result = await pool.query('SELECT * FROM whatsapp_accounts WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: `Cuenta de WhatsApp con ID ${id} no encontrada`
        });
      }
      
      res.json(result.rows[0]);
    } else {
      // Buscar en memoria
      const account = memoryStorage.whatsappAccounts.find(a => a.id === parseInt(id));
      if (!account) {
        return res.status(404).json({
          status: 'error',
          message: `Cuenta de WhatsApp con ID ${id} no encontrada`
        });
      }
      res.json(account);
    }
  } catch (error) {
    console.error(`Error al obtener cuenta de WhatsApp ${req.params.id}:`, error);
    res.status(500).json({
      status: 'error',
      message: `Error al obtener cuenta de WhatsApp ${req.params.id}`,
      error: error.message
    });
  }
});

// Actualizar una cuenta de WhatsApp
app.put('/whatsapp-accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status, qrCode } = req.body;
    
    if (dbConnected) {
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
    } else {
      // Actualizar en memoria
      const accountIndex = memoryStorage.whatsappAccounts.findIndex(a => a.id === parseInt(id));
      if (accountIndex === -1) {
        return res.status(404).json({
          status: 'error',
          message: `Cuenta de WhatsApp con ID ${id} no encontrada`
        });
      }
      
      const updatedAccount = {
        ...memoryStorage.whatsappAccounts[accountIndex]
      };
      
      if (name !== undefined) updatedAccount.name = name;
      if (description !== undefined) updatedAccount.description = description;
      if (status !== undefined) {
        updatedAccount.status = status;
        if (status === 'connected') {
          updatedAccount.lastConnected = new Date().toISOString();
        } else if (status === 'disconnected') {
          updatedAccount.lastDisconnected = new Date().toISOString();
        }
      }
      if (qrCode !== undefined) updatedAccount.qrCode = qrCode;
      
      updatedAccount.updatedAt = new Date().toISOString();
      
      memoryStorage.whatsappAccounts[accountIndex] = updatedAccount;
      res.json(updatedAccount);
    }
  } catch (error) {
    console.error(`Error al actualizar cuenta de WhatsApp ${req.params.id}:`, error);
    res.status(500).json({
      status: 'error',
      message: `Error al actualizar cuenta de WhatsApp ${req.params.id}`,
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
    
    if (dbConnected) {
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
      
      res.status(201).json(result.rows[0]);
    } else {
      // Almacenar en memoria
      const newMessage = {
        id: memoryStorage.whatsappMessages.length + 1,
        accountId: accountId || 1,
        chatId,
        messageId: messageId || `mem-${Date.now()}`,
        from_me,
        content,
        timestamp: timestamp || new Date().toISOString(),
        hasMedia: hasMedia || false,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        metadata: metadata || {},
        createdAt: new Date().toISOString()
      };
      
      memoryStorage.whatsappMessages.push(newMessage);
      
      // Actualizar o crear el chat asociado
      const chatIndex = memoryStorage.whatsappChats.findIndex(c => 
        c.accountId === newMessage.accountId && c.chatId === newMessage.chatId);
      
      if (chatIndex >= 0) {
        // Actualizar chat existente
        memoryStorage.whatsappChats[chatIndex].lastMessageAt = new Date().toISOString();
        memoryStorage.whatsappChats[chatIndex].updatedAt = new Date().toISOString();
        if (!from_me) {
          memoryStorage.whatsappChats[chatIndex].unreadCount += 1;
        }
      } else {
        // Crear nuevo chat
        memoryStorage.whatsappChats.push({
          id: memoryStorage.whatsappChats.length + 1,
          accountId: newMessage.accountId,
          chatId: newMessage.chatId,
          lastMessageAt: new Date().toISOString(),
          unreadCount: from_me ? 0 : 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      res.status(201).json(newMessage);
    }
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
    
    if (dbConnected) {
      const result = await pool.query(`
        SELECT * FROM whatsapp_messages
        WHERE "chatId" = $1 AND "accountId" = $2
        ORDER BY "timestamp" DESC
        LIMIT $3
      `, [chatId, accountId, limit]);
      
      res.json(result.rows);
    } else {
      // Filtrar mensajes en memoria
      const messages = memoryStorage.whatsappMessages
        .filter(m => m.chatId === chatId && m.accountId === parseInt(accountId))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);
      
      res.json(messages);
    }
  } catch (error) {
    console.error(`Error al obtener mensajes del chat ${req.params.chatId}:`, error);
    res.status(500).json({
      status: 'error',
      message: `Error al obtener mensajes del chat ${req.params.chatId}`,
      error: error.message
    });
  }
});

// === API para configuración de respuestas automáticas ===

// Obtener configuración actual
app.get('/auto-response/config', async (req, res) => {
  try {
    if (dbConnected) {
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
    } else {
      // Devolver configuración en memoria
      res.json(memoryStorage.autoResponseConfig);
    }
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
    
    if (dbConnected) {
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
        const fields = updateFields.map(f => f.split(' = ')[0]);
        const placeholders = updateFields.map((_, i) => `$${i + 1}`);
        
        result = await pool.query(`
          INSERT INTO auto_response_config (${fields.join(', ')})
          VALUES (${placeholders.join(', ')})
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
    } else {
      // Actualizar en memoria
      const updatedConfig = { ...memoryStorage.autoResponseConfig };
      
      if (enabled !== undefined) updatedConfig.enabled = enabled;
      if (greetingMessage !== undefined) updatedConfig.greetingMessage = greetingMessage;
      if (outOfHoursMessage !== undefined) updatedConfig.outOfHoursMessage = outOfHoursMessage;
      if (businessHoursStart !== undefined) updatedConfig.businessHoursStart = businessHoursStart;
      if (businessHoursEnd !== undefined) updatedConfig.businessHoursEnd = businessHoursEnd;
      if (workingDays !== undefined) updatedConfig.workingDays = workingDays;
      if (settings !== undefined) updatedConfig.settings = settings;
      
      updatedConfig.updatedAt = new Date().toISOString();
      
      memoryStorage.autoResponseConfig = updatedConfig;
      res.json(updatedConfig);
    }
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
});

// Manejar señales de cierre
process.on('SIGINT', () => {
  console.log('Cerrando conexiones a la base de datos...');
  if (dbConnected) {
    pool.end();
  }
  server.close(() => {
    console.log('Servidor detenido');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Cerrando conexiones a la base de datos...');
  if (dbConnected) {
    pool.end();
  }
  server.close(() => {
    console.log('Servidor detenido');
    process.exit(0);
  });
});