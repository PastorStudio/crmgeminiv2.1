/**
 * Database Server
 * Servidor dedicado a operaciones de base de datos
 * Proporciona una API para acceder y modificar datos
 */

const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const { Pool } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-serverless');
const { and, eq, like, desc } = require('drizzle-orm');
const ws = require('ws');

// Configuración básica
const app = express();
const PORT = process.env.DATABASE_SERVER_PORT || 5003;
const httpServer = createServer(app);

// Configuración de middleware
app.use(express.json());
app.use(cors());

// Configuración de WebSocket para comunicación con otros servidores
const wss = new WebSocketServer({ server: httpServer, path: '/internal-ws' });

// Configuración de servidores
const API_SERVER = process.env.API_SERVER || 'http://localhost:5000';
const WHATSAPP_SERVER = process.env.WHATSAPP_SERVER || 'http://localhost:5001';
const PROCESSOR_SERVER = process.env.PROCESSOR_SERVER || 'http://localhost:5002';

// Configuración de base de datos
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL no está definida');
  process.exit(1);
}

// Configuración para Neon serverless
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
let db;

// Inicializar la conexión a la base de datos
async function initializeDatabase() {
  try {
    // Importar schema
    const schema = require('../../shared/schema');
    
    // Inicializar conexión
    db = drizzle({ client: pool, schema });
    
    console.log('Conexión a base de datos PostgreSQL establecida');
    
    // Verificar tablas
    await verifyTables();
    
    return { success: true };
  } catch (error) {
    console.error('Error inicializando base de datos:', error);
    return { success: false, error: error.message };
  }
}

// Verificar y crear tablas si es necesario
async function verifyTables() {
  try {
    // Verificar tablas usando una consulta simple
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const tables = tableCheck.rows.map(row => row.table_name);
    console.log('Tablas existentes:', tables);
    
    // Si no hay tablas, probablemente necesitamos configurar la base de datos
    if (tables.length === 0) {
      console.log('No se encontraron tablas, ejecutando migración inicial...');
      
      // Importar herramientas de migración de drizzle-kit
      const { migrate } = require('drizzle-orm/postgres-js/migrator');
      
      // Ejecutar migración
      await migrate(db, { migrationsFolder: './migrations' });
      console.log('Migración inicial completada');
      
      // Verificar datos iniciales
      await seedInitialData();
    }
    
    return { success: true, tables };
  } catch (error) {
    console.error('Error verificando tablas:', error);
    return { success: false, error: error.message };
  }
}

// Insertar datos iniciales
async function seedInitialData() {
  try {
    const schema = require('../../shared/schema');
    
    // Verificar si ya hay datos
    const userCount = await db.select({ count: db.fn.count() })
      .from(schema.users)
      .then(result => result[0]?.count || 0);
    
    if (Number(userCount) > 0) {
      console.log('La base de datos ya contiene datos, omitiendo inicialización.');
      return { success: true, initialized: false };
    }
    
    console.log('Insertando datos iniciales...');
    
    // Insertar usuario administrador
    const adminUser = await db.insert(schema.users)
      .values({
        username: 'admin',
        password: 'admin123', // En producción, usar hash
        name: 'Administrador',
        email: 'admin@example.com',
        role: 'admin'
      })
      .returning();
    
    console.log('Usuario administrador creado:', adminUser[0].id);
    
    // Insertar cuentas de WhatsApp
    const whatsappAccounts = await db.insert(schema.whatsappAccounts)
      .values([
        {
          name: 'Ventas',
          phone: '+1234567890',
          status: 'inactive',
          sessionData: JSON.stringify({})
        },
        {
          name: 'Soporte',
          phone: '+0987654321',
          status: 'inactive',
          sessionData: JSON.stringify({})
        }
      ])
      .returning();
    
    console.log('Cuentas de WhatsApp creadas:', whatsappAccounts.map(a => a.id));
    
    // Insertar configuración de IA
    await db.insert(schema.aiConfig)
      .values({
        autoResponse: false,
        defaultModel: 'gemini',
        confidenceThreshold: 0.75
      });
    
    // Insertar configuración de zona horaria
    await db.insert(schema.timeZoneConfig)
      .values({
        timeZone: 'America/Mexico_City',
        offset: -6,
        source: 'default',
        location: { latitude: 19.4326, longitude: -99.1332 }
      });
    
    console.log('Configuraciones iniciales creadas');
    
    return { success: true, initialized: true };
  } catch (error) {
    console.error('Error insertando datos iniciales:', error);
    return { success: false, error: error.message };
  }
}

// API Routes

// Endpoint de salud
app.get('/health', async (req, res) => {
  try {
    // Verificar conexión a base de datos
    const result = await pool.query('SELECT NOW()');
    const dbTimestamp = result.rows[0].now;
    
    res.json({
      status: 'ok',
      server: 'database',
      database: {
        connected: true,
        timestamp: dbTimestamp
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      server: 'database',
      error: error.message
    });
  }
});

// CRUD para usuarios
app.get('/users', async (req, res) => {
  try {
    const schema = require('../../shared/schema');
    const users = await db.select().from(schema.users);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/users/:id', async (req, res) => {
  try {
    const schema = require('../../shared/schema');
    const id = parseInt(req.params.id);
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/users', async (req, res) => {
  try {
    const schema = require('../../shared/schema');
    const [user] = await db.insert(schema.users).values(req.body).returning();
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/users/:id', async (req, res) => {
  try {
    const schema = require('../../shared/schema');
    const id = parseInt(req.params.id);
    const [user] = await db.update(schema.users)
      .set(req.body)
      .where(eq(schema.users.id, id))
      .returning();
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/users/:id', async (req, res) => {
  try {
    const schema = require('../../shared/schema');
    const id = parseInt(req.params.id);
    await db.delete(schema.users).where(eq(schema.users.id, id));
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CRUD para cuentas de WhatsApp
app.get('/whatsapp-accounts', async (req, res) => {
  try {
    const schema = require('../../shared/schema');
    const accounts = await db.select().from(schema.whatsappAccounts);
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/whatsapp-accounts/:id', async (req, res) => {
  try {
    const schema = require('../../shared/schema');
    const id = parseInt(req.params.id);
    const [account] = await db.select().from(schema.whatsappAccounts).where(eq(schema.whatsappAccounts.id, id));
    
    if (!account) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }
    
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/whatsapp-accounts', async (req, res) => {
  try {
    const schema = require('../../shared/schema');
    const [account] = await db.insert(schema.whatsappAccounts).values(req.body).returning();
    res.status(201).json(account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/whatsapp-accounts/:id', async (req, res) => {
  try {
    const schema = require('../../shared/schema');
    const id = parseInt(req.params.id);
    const [account] = await db.update(schema.whatsappAccounts)
      .set(req.body)
      .where(eq(schema.whatsappAccounts.id, id))
      .returning();
    
    if (!account) {
      return res.status(404).json({ error: 'Cuenta no encontrada' });
    }
    
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/whatsapp-accounts/:id', async (req, res) => {
  try {
    const schema = require('../../shared/schema');
    const id = parseInt(req.params.id);
    await db.delete(schema.whatsappAccounts).where(eq(schema.whatsappAccounts.id, id));
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener/actualizar configuración de IA
app.get('/ai-config', async (req, res) => {
  try {
    const schema = require('../../shared/schema');
    const [config] = await db.select().from(schema.aiConfig);
    res.json(config || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/ai-config/update', async (req, res) => {
  try {
    const schema = require('../../shared/schema');
    
    // Verificar si existe configuración
    const configs = await db.select().from(schema.aiConfig);
    
    if (configs.length === 0) {
      // Crear nueva configuración
      const [config] = await db.insert(schema.aiConfig).values(req.body).returning();
      return res.json(config);
    }
    
    // Actualizar configuración existente
    const [config] = await db.update(schema.aiConfig)
      .set(req.body)
      .where(eq(schema.aiConfig.id, configs[0].id))
      .returning();
    
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener/actualizar configuración de zona horaria
app.get('/timezone-config', async (req, res) => {
  try {
    const schema = require('../../shared/schema');
    const [config] = await db.select().from(schema.timeZoneConfig);
    res.json(config || {});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/timezone-config/update', async (req, res) => {
  try {
    const schema = require('../../shared/schema');
    
    // Verificar si existe configuración
    const configs = await db.select().from(schema.timeZoneConfig);
    
    if (configs.length === 0) {
      // Crear nueva configuración
      const [config] = await db.insert(schema.timeZoneConfig).values(req.body).returning();
      return res.json(config);
    }
    
    // Actualizar configuración existente
    const [config] = await db.update(schema.timeZoneConfig)
      .set(req.body)
      .where(eq(schema.timeZoneConfig.id, configs[0].id))
      .returning();
    
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CRUD para mensajes
app.get('/messages', async (req, res) => {
  try {
    const schema = require('../../shared/schema');
    const { limit, offset, chatId, accountId } = req.query;
    
    let query = db.select().from(schema.messages);
    
    if (chatId) {
      query = query.where(eq(schema.messages.chatId, chatId));
    }
    
    if (accountId) {
      query = query.where(eq(schema.messages.accountId, parseInt(accountId)));
    }
    
    query = query.orderBy(desc(schema.messages.timestamp));
    
    if (limit) {
      query = query.limit(parseInt(limit));
    }
    
    if (offset) {
      query = query.offset(parseInt(offset));
    }
    
    const messages = await query;
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/messages', async (req, res) => {
  try {
    const schema = require('../../shared/schema');
    const { accountId, message } = req.body;
    
    if (!accountId || !message) {
      return res.status(400).json({ error: 'Se requieren los campos accountId y message' });
    }
    
    // Adaptar mensaje al formato del schema
    const messageData = {
      accountId: parseInt(accountId),
      messageId: message.id,
      chatId: message.from,
      body: message.body,
      from: message.from,
      to: message.to,
      fromMe: message.fromMe,
      timestamp: new Date(message.timestamp),
      hasMedia: message.hasMedia,
      mediaType: message.type,
      mediaUrl: message.mediaUrl,
      timeZoneInfo: message.timeZoneInfo ? JSON.stringify(message.timeZoneInfo) : null
    };
    
    const [savedMessage] = await db.insert(schema.messages)
      .values(messageData)
      .returning();
    
    res.status(201).json(savedMessage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CRUD para contactos
app.get('/contacts', async (req, res) => {
  try {
    const schema = require('../../shared/schema');
    const contacts = await db.select().from(schema.contacts);
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/contacts/by-phone/:phone', async (req, res) => {
  try {
    const schema = require('../../shared/schema');
    const { phone } = req.params;
    
    const [contact] = await db.select()
      .from(schema.contacts)
      .where(eq(schema.contacts.phone, phone));
    
    if (!contact) {
      return res.status(404).json({ error: 'Contacto no encontrado' });
    }
    
    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/contacts', async (req, res) => {
  try {
    const schema = require('../../shared/schema');
    const [contact] = await db.insert(schema.contacts).values(req.body).returning();
    res.status(201).json(contact);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket para comunicación interna entre servidores
wss.on('connection', (ws) => {
  console.log('Nueva conexión interna establecida con otro servidor');
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Mensaje recibido desde otro servidor:', data.type);
      
      // Implementar lógica para manejar diferentes tipos de mensajes
      if (data.type === 'store_message') {
        try {
          const schema = require('../../shared/schema');
          const [savedMessage] = await db.insert(schema.messages)
            .values(data.message)
            .returning();
          
          ws.send(JSON.stringify({
            type: 'message_stored',
            success: true,
            message: savedMessage
          }));
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'message_stored',
            success: false,
            error: error.message
          }));
        }
      }
    } catch (error) {
      console.error('Error procesando mensaje interno:', error);
    }
  });
});

// Iniciar servidor
httpServer.listen(PORT, async () => {
  console.log(`Database Server corriendo en http://localhost:${PORT}`);
  
  // Inicializar base de datos
  const dbResult = await initializeDatabase();
  
  if (!dbResult.success) {
    console.error('Error inicializando base de datos:', dbResult.error);
    // No cerramos el servidor para que pueda seguir intentando
  }
});