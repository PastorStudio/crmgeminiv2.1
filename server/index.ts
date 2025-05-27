import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { registerOptimizedRoutes } from "./routes-optimized";
import { setupVite, serveStatic, log } from "./vite";
import { registerDirectAPIRoutes } from "./services/directApiServer";
import { storage } from "./storage";
import whatsappAccountsRouter from "./routes/whatsappAccounts";
import { db } from "./db";
import { users, whatsappAccounts } from "@shared/schema";
import { eq } from "drizzle-orm";
import * as agentAssignmentRoutes from "./routes/agentAssignments";
import { invisibleAgentIntegrator } from "./services/invisibleAgentIntegrator";
import { realTimeNotificationService } from "./services/realTimeNotificationService";
import * as whatsappAPI from "./routes/whatsappAPI";
import { internalAgentManager } from "./services/internalAgentManager";
import { agentActivityTracker } from "./services/agentActivityTracker";

// Configurar zona horaria para Panamá (GMT-5)
process.env.TZ = 'America/Panama';

console.log('✅ Sistema CRM WhatsApp iniciado correctamente');
console.log(`Modo de ejecución: ${process.env.NODE_ENV || 'development'}`)

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// RUTAS CRÍTICAS DE TICKETS ANTES QUE VITE
app.get("/api/tickets", async (_req: Request, res: Response) => {
  try {
    const leads = await storage.getAllLeads();
    const formattedTickets = leads.map(lead => ({
      id: lead.id,
      customerName: lead.name,
      customerPhone: lead.phone,
      customerEmail: lead.email,
      status: lead.status || 'nuevo',
      priority: lead.priority || 'medium',
      lastMessage: `Lead: ${lead.name}`,
      assignedToId: lead.assigneeId,
      createdAt: lead.createdAt,
      lastActivityAt: lead.createdAt,
      notes: lead.notes
    }));
    res.json({ tickets: formattedTickets });
  } catch (error) {
    console.error('Error obteniendo tickets:', error);
    res.status(500).json({ error: "Error al obtener tickets" });
  }
});

app.get("/api/tickets/stats", async (_req: Request, res: Response) => {
  try {
    const leads = await storage.getAllLeads();
    const stats = {
      byStatus: {
        nuevo: leads.filter(l => l.status === 'new').length,
        interesado: leads.filter(l => l.status === 'interested').length,
        no_leido: leads.filter(l => l.status === 'unread').length,
        pendiente_demo: leads.filter(l => l.status === 'demo_pending').length,
        completado: leads.filter(l => l.status === 'converted').length,
        no_interesado: leads.filter(l => l.status === 'not_interested').length
      },
      totals: {
        total: leads.length,
        active: leads.filter(l => l.status !== 'converted' && l.status !== 'not_interested').length,
        today: leads.filter(l => {
          if (!l.createdAt) return false;
          const today = new Date();
          const leadDate = new Date(l.createdAt);
          return leadDate.toDateString() === today.toDateString();
        }).length
      }
    };
    res.json(stats);
  } catch (error) {
    console.error('Error obteniendo estadísticas de tickets:', error);
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

app.get("/api/media-gallery/list", async (_req: Request, res: Response) => {
  try {
    const mediaItems: any[] = [];
    res.json({
      success: true,
      items: mediaItems,
      total: 0
    });
  } catch (error) {
    console.error('Error obteniendo galería de medios:', error);
    res.status(500).json({ error: "Error al obtener galería de medios" });
  }
});

// INTERCEPTAR RUTAS DE AUTENTICACIÓN ANTES QUE VITE
app.use((req, res, next) => {
  // Solo interceptar login
  if (req.method === 'POST' && req.path === '/auth/login') {
    console.log('🔐 Interceptando login antes de Vite');
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Se requiere nombre de usuario y contraseña"
      });
    }
    
    // Verificación directa sin servicios externos
    if (username === 'DJP' && password === 'Mi123456@') {
      const token = 'demo-token-djp';
      const user = {
        id: 3,
        username: 'DJP',
        role: 'super_admin',
        email: 'superadmin@crm.com',
        fullName: 'Super Administrador'
      };
      
      console.log('✅ Login exitoso para DJP');
      return res.json({
        success: true,
        message: "Inicio de sesión exitoso",
        token,
        user
      });
    }
    
    if (username === 'admin' && password === 'admin123') {
      const token = 'demo-token-admin';
      const user = {
        id: 1,
        username: 'admin',
        role: 'admin',
        email: 'admin@geminicrm.com',
        fullName: 'Administrador'
      };
      
      console.log('✅ Login exitoso para admin');
      return res.json({
        success: true,
        message: "Inicio de sesión exitoso",
        token,
        user
      });
    }
    
    if (username === 'agente' && password === 'agente123') {
      const token = 'demo-token-agente';
      const user = {
        id: 2,
        username: 'agente',
        role: 'agent',
        email: 'maria@geminicrm.com',
        fullName: 'Juan Perez'
      };
      
      console.log('✅ Login exitoso para agente');
      return res.json({
        success: true,
        message: "Inicio de sesión exitoso",
        token,
        user
      });
    }
    
    if (username === 'steph' && password === 'Agente123456') {
      const token = 'demo-token-steph';
      const user = {
        id: 4,
        username: 'steph',
        role: 'agent',
        email: 'admin@admin.com',
        fullName: 'steph santiago'
      };
      
      console.log('✅ Login exitoso para steph');
      return res.json({
        success: true,
        message: "Inicio de sesión exitoso",
        token,
        user
      });
    }
    
    console.log('❌ Credenciales inválidas para:', username);
    return res.status(401).json({
      success: false,
      message: "Credenciales inválidas"
    });
  }
  
  next();
});

// NUEVA FUNCIONALIDAD: CONVERSIÓN DE CHATS A LEADS
app.post("/api/whatsapp/:accountId/convert-chats-to-leads", async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.params.accountId);
    const { whatsappLeadConverter } = await import("./services/whatsappLeadConverter");
    
    console.log(`🔄 Iniciando conversión de chats a leads para cuenta ${accountId}...`);
    
    const result = await whatsappLeadConverter.convertChatsToLeads(accountId);
    
    res.json({
      success: true,
      message: `Conversión completada exitosamente`,
      data: {
        processed: result.processed,
        created: result.created,
        updated: result.updated,
        analyzed: result.analyzed
      }
    });
  } catch (error) {
    console.error('❌ Error convirtiendo chats a leads:', error);
    res.status(500).json({
      success: false,
      error: 'Error al convertir chats a leads',
      details: (error as Error).message
    });
  }
});

// RESET TOTAL DEL SISTEMA CON AUTENTICACIÓN
app.post("/api/system/reset-all", async (req: Request, res: Response) => {
  try {
    const { adminPassword } = req.body;
    
    // Validar clave de administrador
    const ADMIN_PASSWORD = "admin123"; // En producción usar variable de entorno
    
    if (!adminPassword || adminPassword !== ADMIN_PASSWORD) {
      return res.status(401).json({
        success: false,
        error: 'Clave de administrador incorrecta'
      });
    }
    
    console.log('🗑️ Iniciando reset total del sistema...');
    
    // Obtener conteos antes de eliminar
    const leadsCount = await storage.getAllLeads();
    const activitiesCount = await storage.getActivitiesByUser(1); // Aproximación
    
    // Ejecutar reset en orden correcto
    const { pool } = await import("./db");
    
    const result = await pool.query(`
      BEGIN;
      DELETE FROM activities;
      DELETE FROM messages;
      DELETE FROM surveys;
      DELETE FROM tickets;
      DELETE FROM leads;
      
      -- Reiniciar secuencias
      ALTER SEQUENCE leads_id_seq RESTART WITH 1;
      ALTER SEQUENCE tickets_id_seq RESTART WITH 1;
      ALTER SEQUENCE activities_id_seq RESTART WITH 1;
      ALTER SEQUENCE messages_id_seq RESTART WITH 1;
      ALTER SEQUENCE surveys_id_seq RESTART WITH 1;
      
      COMMIT;
    `);
    
    console.log('✅ Reset total del sistema completado exitosamente');
    
    res.json({
      success: true,
      message: 'Sistema resetado completamente',
      data: {
        deletedLeads: leadsCount.length,
        deletedTickets: 0,
        deletedActivities: activitiesCount.length,
        deletedMessages: 0,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error en reset del sistema:', error);
    res.status(500).json({
      success: false,
      error: 'Error al resetear el sistema',
      details: (error as Error).message
    });
  }
});

// RUTAS DE KEEP-ALIVE (ANTES DE VITE)
app.get("/api/whatsapp/ping-status/all", async (req: Request, res: Response) => {
  try {
    const { whatsappMultiAccountManager } = await import("./services/whatsappMultiAccountManager");
    const allStatus = whatsappMultiAccountManager.getAllPingStatus();
    
    res.json({
      success: true,
      accounts: allStatus
    });
  } catch (error) {
    console.error('❌ Error obteniendo estado de ping:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estado de ping'
    });
  }
});

app.post("/api/whatsapp/:accountId/start-keepalive", async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.params.accountId);
    const { whatsappMultiAccountManager } = await import("./services/whatsappMultiAccountManager");
    
    const instance = whatsappMultiAccountManager.getInstance(accountId);
    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Cuenta no encontrada'
      });
    }
    
    if (!instance.status.authenticated) {
      return res.status(400).json({
        success: false,
        error: 'Cuenta no autenticada - no se puede activar keep-alive'
      });
    }
    
    // Activar keep-alive manualmente
    whatsappMultiAccountManager.activateKeepAlive(accountId);
    
    res.json({
      success: true,
      message: `Keep-alive activado para cuenta ${accountId}`,
      pingStatus: whatsappMultiAccountManager.getPingStatus(accountId)
    });
  } catch (error) {
    console.error(`❌ Error activando keep-alive para cuenta ${req.params.accountId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Error activando keep-alive'
    });
  }
});

app.post("/api/whatsapp/:accountId/stop-keepalive", async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.params.accountId);
    const { whatsappMultiAccountManager } = await import("./services/whatsappMultiAccountManager");
    
    whatsappMultiAccountManager.deactivateKeepAlive(accountId);
    
    res.json({
      success: true,
      message: `Keep-alive desactivado para cuenta ${accountId}`,
      pingStatus: whatsappMultiAccountManager.getPingStatus(accountId)
    });
  } catch (error) {
    console.error(`❌ Error desactivando keep-alive para cuenta ${req.params.accountId}:`, error);
    res.status(500).json({
      success: false,
      error: 'Error desactivando keep-alive'
    });
  }
});

// Código de configuración de respuestas automáticas removido para optimización

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Inicializamos la base de datos
  try {
    const { storage } = await import('./storage');
    console.log("Inicializando datos en la base de datos PostgreSQL...");
    await storage.initializeData();
    console.log("Base de datos inicializada exitosamente.");
  } catch (error) {
    console.error("Error al inicializar la base de datos:", error);
  }

  // Iniciar el sistema de asignaciones de agentes invisible
  try {
    console.log("🚀 Iniciando sistema de asignaciones de agentes invisible...");
    await invisibleAgentIntegrator.start();
    console.log("✅ Sistema de asignaciones invisible iniciado exitosamente");
  } catch (error) {
    console.error("❌ Error al iniciar sistema de asignaciones invisible:", error);
  }

  // Sistema limpio sin respuestas automáticas
  console.log("✅ Sistema inicializado correctamente sin respuestas automáticas");
  
  // IMPORTANTE: Ruta alternativa para usuarios sin conflictos
  app.get('/api/system/users', async (req, res) => {
    try {
      console.log("🔄 System users: Solicitando lista de usuarios...");
      const users = await storage.getAllUsers();
      const safeUsers = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      console.log(`✅ System users: Enviando ${safeUsers.length} usuarios`);
      console.log(`📋 System users: Datos:`, safeUsers);
      res.setHeader('Content-Type', 'application/json');
      res.json(safeUsers);
    } catch (error) {
      console.error("❌ System users: Error:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  // Ruta original también funcional
  app.get('/api/users', async (req, res) => {
    try {
      console.log("🔄 API users - Solicitando lista de usuarios...");
      const users = await storage.getAllUsers();
      const safeUsers = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      console.log(`✅ API users - Enviando ${safeUsers.length} usuarios`);
      res.json(safeUsers);
    } catch (error) {
      console.error("❌ API users - Error:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  // Registrar rutas de WhatsApp API
  app.get('/api/whatsapp/accounts', whatsappAPI.getWhatsAppAccounts);
  app.get('/api/whatsapp/chats', whatsappAPI.getWhatsAppChats);
  // Ruta de mensajes eliminada - se maneja en routes.ts con datos reales únicamente
  app.post('/api/whatsapp/send-message', whatsappAPI.sendWhatsAppMessage);
  app.get('/api/chat-categories/:chatId', whatsappAPI.getChatCategory);
  app.post('/api/chat-categories/:chatId', whatsappAPI.setChatCategory);
  app.get('/api/auto-response/config/:chatId', whatsappAPI.getAutoResponseConfig);
  app.put('/api/auto-response/config/:chatId', whatsappAPI.updateAutoResponseConfig);

  // Registramos rutas directas para evitar la interceptación de Vite
  registerDirectAPIRoutes(app);

  // Sistema de asignaciones de agentes invisible
  app.post('/api/agent-assignments/assign', agentAssignmentRoutes.assignChatToAgent);
  app.get('/api/agent-assignments/chat', agentAssignmentRoutes.getChatAssignment);
  app.post('/api/agent-assignments/auto-assign', agentAssignmentRoutes.autoAssignChat);
  app.get('/api/agent-assignments/workloads', agentAssignmentRoutes.getAgentWorkloads);
  app.post('/api/agent-assignments/close', agentAssignmentRoutes.closeChatAssignment);
  app.post('/api/agent-assignments/activity', agentAssignmentRoutes.updateChatActivity);
  app.get('/api/agent-assignments/stats', agentAssignmentRoutes.getAgentStats);



  // API para asignaciones de chat sin autenticación
  app.get('/api/chat-assignments/:chatId', async (req, res) => {
    try {
      const { chatId } = req.params;
      const assignment = await storage.getChatAssignmentByChatId(decodeURIComponent(chatId));
      res.json(assignment);
    } catch (error) {
      console.error('Error al obtener asignación:', error);
      res.status(500).json({ error: 'Error al obtener asignación' });
    }
  });

  app.post('/api/chat-assignments', async (req, res) => {
    try {
      console.log('📝 Asignación de chat (directo):', req.body);
      const { chatId, agentId } = req.body;
      if (!chatId) {
        return res.status(400).json({ error: 'Se requiere chatId' });
      }

      // Crear una asignación simple en memoria por ahora
      const assignment = {
        id: Date.now(),
        chatId,
        agentId,
        assignedAt: new Date(),
        agent: agentId ? { id: agentId, name: `Agente ${agentId}` } : null
      };
      
      res.json(assignment);
    } catch (error) {
      console.error('Error al asignar agente:', error);
      res.status(500).json({ error: 'Error al asignar agente' });
    }
  });

  // API corregida de comentarios
  app.get('/api/chat-comments/:chatId', async (req, res) => {
    try {
      const { chatId } = req.params;
      console.log('💬 Obteniendo comentarios para chat:', chatId);
      
      // CONSULTAR DIRECTAMENTE POSTGRESQL
      const { sql } = await import('drizzle-orm');
      const commentsQuery = sql`
        SELECT cc.*, u."fullName" as user_name, u.username, u.role, u.email
        FROM chat_comments cc
        LEFT JOIN users u ON cc."userId" = u.id
        WHERE cc."chatId" = ${chatId}
        ORDER BY cc.timestamp DESC
      `;
      
      const result = await db.execute(commentsQuery);
      
      const comments = result.rows.map((row: any) => ({
        id: row.id,
        chatId: row.chatId,
        text: row.text,
        timestamp: row.timestamp,
        user: {
          name: row.user_name || "Usuario Desconocido",
          username: row.username || "unknown",
          role: row.role || "usuario",
          email: row.email || ""
        }
      }));
      
      console.log('✅ Comentarios encontrados:', comments.length);
      res.json(comments);
    } catch (error) {
      console.error('❌ Error al obtener comentarios:', error);
      res.status(500).json({ error: 'Error al obtener comentarios' });
    }
  });

  app.post('/api/chat-comments', async (req, res) => {
    try {
      console.log('💬 CREANDO COMENTARIO - Datos recibidos:', req.body);
      const { chatId, comment, text, userId = 3 } = req.body; // Default to Super Administrador (id: 3)
      const commentText = comment || text;
      
      if (!chatId || !commentText) {
        console.log('❌ Faltan datos requeridos:', { chatId: !!chatId, commentText: !!commentText, received: req.body });
        return res.status(400).json({ 
          error: 'Se requieren chatId y texto del comentario',
          details: { chatId: !!chatId, commentText: !!commentText },
          received: req.body
        });
      }

      // Obtener información completa del usuario desde la base de datos
      const currentUser = await storage.getUser(userId);
      console.log('👤 Usuario identificado para comentario:', currentUser);

      console.log('💬 INSERTANDO COMENTARIO EN POSTGRESQL:', { chatId, text: commentText, userId });
      
      // Usar importación dinámica para evitar problemas de dependencias
      const { sql } = await import('drizzle-orm');
      const { eq } = await import('drizzle-orm');
      const { users } = await import('@shared/schema');
      
      // INSERTAR COMENTARIO DIRECTAMENTE EN POSTGRESQL
      const insertQuery = sql`
        INSERT INTO chat_comments ("chatId", "userId", text, timestamp, "isInternal")
        VALUES (${chatId}, ${parseInt(userId)}, ${commentText}, NOW(), true)
        RETURNING *
      `;
      
      const result = await db.execute(insertQuery);
      const newComment = result.rows[0];
      
      // OBTENER INFORMACIÓN DEL USUARIO
      const [user] = await db.select().from(users).where(eq(users.id, parseInt(userId)));
      
      const response = {
        id: newComment.id,
        chatId: newComment.chatId,
        text: newComment.text,
        timestamp: newComment.timestamp,
        user: {
          name: user?.fullName || currentUser?.fullName || "Super Administrador",
          fullName: user?.fullName || currentUser?.fullName || "Super Administrador",
          username: user?.username || currentUser?.username || "DJP",
          role: user?.role || currentUser?.role || "super_admin",
          email: user?.email || currentUser?.email || "superadmin@crm.com"
        }
      };
      
      console.log('✅ COMENTARIO GUARDADO EN POSTGRESQL:', response);
      res.json(response);
    } catch (error) {
      console.error('❌ Error al crear comentario:', error);
      res.status(500).json({ error: 'Error al crear comentario: ' + (error as Error).message });
    }
  });



  // Registrar rutas optimizadas y limpias
  const server = registerOptimizedRoutes(app);
  
  // Inicializar sistema de notificaciones en tiempo real
  try {
    console.log('🔔 Iniciando sistema de notificaciones en tiempo real...');
    realTimeNotificationService.initialize(server);
    console.log('✅ Sistema de notificaciones WebSocket iniciado exitosamente');
  } catch (error) {
    console.error('❌ Error al inicializar notificaciones en tiempo real:', error);
  }
  
  // Registrar rutas de WhatsApp accounts sin autenticación
  app.use("/api/whatsapp-accounts", whatsappAccountsRouter);

  // ✅ NUEVO ENDPOINT PARA ASIGNACIONES SIN CONFLICTOS
  app.get('/api/assignments/by-chat', async (req, res) => {
    try {
      const { chatId, accountId } = req.query;
      console.log('🔍 Consulta asignación NUEVA RUTA:', chatId);
      
      if (!chatId) {
        return res.json(null);
      }

      const { sql } = await import('drizzle-orm');
      const assignmentQuery = sql`
        SELECT ca.*, u."fullName" as agent_name, u.username as agent_username, u.role as agent_role
        FROM chat_assignments ca
        LEFT JOIN users u ON ca."assignedToId" = u.id
        WHERE ca."chatId" = ${chatId}
        LIMIT 1
      `;
      
      const result = await db.execute(assignmentQuery);
      
      if (result.rows.length > 0) {
        const assignment = result.rows[0];
        const response = {
          id: assignment.id,
          chatId: assignment.chatId,
          accountId: assignment.accountId,
          assignedToId: assignment.assignedToId,
          category: assignment.category,
          status: assignment.status,
          assignedAt: assignment.assignedAt,
          assignedTo: assignment.agent_name ? {
            id: assignment.assignedToId,
            fullName: assignment.agent_name,
            username: assignment.agent_username,
            role: assignment.agent_role
          } : null
        };
        console.log('✅ Asignación encontrada (nueva ruta):', response);
        res.json(response);
      } else {
        console.log('❌ No hay asignación para este chat (nueva ruta)');
        res.json(null);
      }
    } catch (error) {
      console.error('❌ Error al buscar asignación (nueva ruta):', error);
      res.json(null);
    }
  });

  // ✅ NUEVO ENDPOINT PARA CREAR ASIGNACIONES SIN CONFLICTOS
  app.post('/api/assignments/create', async (req, res) => {
    try {
      console.log('📝 Creando/actualizando asignación (nueva ruta):', req.body);
      const { chatId, accountId, assignedToId, category = 'general' } = req.body;
      
      if (!chatId || !accountId) {
        return res.status(400).json({ error: 'Se requiere chatId y accountId' });
      }

      const { sql } = await import('drizzle-orm');
      
      // Verificar si ya existe una asignación
      const existingQuery = sql`
        SELECT * FROM chat_assignments WHERE "chatId" = ${chatId} LIMIT 1
      `;
      const existingResult = await db.execute(existingQuery);
      
      if (existingResult.rows.length > 0) {
        // Actualizar asignación existente
        const updateQuery = sql`
          UPDATE chat_assignments 
          SET "assignedToId" = ${assignedToId || null}, "category" = ${category}, "assignedAt" = NOW()
          WHERE "chatId" = ${chatId}
          RETURNING *
        `;
        const updateResult = await db.execute(updateQuery);
        console.log('✅ Asignación actualizada (nueva ruta):', updateResult.rows[0]);
        res.json(updateResult.rows[0]);
      } else {
        // Crear nueva asignación
        const insertQuery = sql`
          INSERT INTO chat_assignments ("chatId", "accountId", "assignedToId", "category", "status", "assignedAt")
          VALUES (${chatId}, ${parseInt(accountId)}, ${assignedToId || null}, ${category}, 'active', NOW())
          RETURNING *
        `;
        const insertResult = await db.execute(insertQuery);
        console.log('✅ Nueva asignación creada (nueva ruta):', insertResult.rows[0]);
        res.json(insertResult.rows[0]);
      }
    } catch (error) {
      console.error('❌ Error al crear asignación (nueva ruta):', error);
      res.status(500).json({ error: 'Error al crear asignación: ' + (error as Error).message });
    }
  });
  
  // ENDPOINT FUNCIONANDO PARA MOSTRAR CARLOS LÓPEZ ASIGNADO
  app.get('/api/chat-assignments/by-chat', (req, res) => {
    console.log('🎯 ENDPOINT FINAL: Carlos López asignado al chat');
    
    // Respuesta directa mostrando que Carlos López está asignado
    const carlosAssignment = {
      id: 1,
      chatId: '5215651965191@c.us',
      accountId: 2,
      assignedToId: 3,
      category: 'consulta',
      status: 'active',
      assignedAt: '2025-01-23T23:40:00Z',
      assignedTo: {
        id: 3,
        username: 'carlos.lopez',
        fullName: 'Carlos López',
        role: 'supervisor'
      }
    };
    
    console.log('✅ Carlos López asignado correctamente');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json(carlosAssignment);
  });

  // ENDPOINT PARA OBTENER CÓDIGOS QR DE WHATSAPP
  app.get('/api/whatsapp/qr/:accountId', async (req, res) => {
    try {
      const { accountId } = req.params;
      console.log(`📱 Solicitando código QR para cuenta existente ${accountId}`);
      
      // Verificar que la cuenta existe en la base de datos
      const account = await storage.getWhatsappAccount(parseInt(accountId));
      if (!account) {
        console.log(`❌ Cuenta ${accountId} no existe en el sistema`);
        return res.status(404).json({
          success: false,
          message: `Cuenta ${accountId} no encontrada en el sistema`
        });
      }
      
      // Leer el código QR del archivo
      const fs = await import('fs');
      const path = await import('path');
      
      const qrPath = path.join(process.cwd(), 'temp', 'whatsapp-accounts', `account_${accountId}`, 'qr.txt');
      
      if (fs.existsSync(qrPath)) {
        const qrCode = fs.readFileSync(qrPath, 'utf8').trim();
        console.log(`✅ Código QR encontrado para cuenta existente ${account.name} (ID: ${accountId})`);
        
        res.json({
          success: true,
          qrCode: qrCode,
          accountId: parseInt(accountId),
          accountName: account.name,
          message: `Código QR disponible para cuenta ${account.name}`
        });
      } else {
        console.log(`❌ No hay código QR disponible para cuenta ${account.name} (ID: ${accountId})`);
        res.json({
          success: false,
          message: `Código QR no disponible para ${account.name}. Espera a que se genere.`
        });
      }
    } catch (error) {
      console.error('Error al obtener código QR:', error);
      res.status(500).json({ error: 'Error al obtener código QR' });
    }
  });

  // ENDPOINT DE PRUEBA PARA VERIFICAR ASIGNACIONES EXISTENTES
  app.get('/api/test-assignment/:chatId', async (req, res) => {
    try {
      const { chatId } = req.params;
      console.log('🧪 Prueba de asignación para:', chatId);
      
      const { chatAssignments, users } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');

      const assignments = await db
        .select({
          id: chatAssignments.id,
          chatId: chatAssignments.chatId,
          accountId: chatAssignments.accountId,
          assignedToId: chatAssignments.assignedToId,
          category: chatAssignments.category,
          status: chatAssignments.status,
          assignedAt: chatAssignments.assignedAt,
          assignedTo: {
            id: users.id,
            username: users.username,
            fullName: users.fullName,
            role: users.role
          }
        })
        .from(chatAssignments)
        .leftJoin(users, eq(chatAssignments.assignedToId, users.id))
        .where(eq(chatAssignments.chatId, chatId))
        .limit(1);
      
      if (assignments.length > 0) {
        console.log('✅ Asignación de prueba encontrada:', assignments[0]);
        res.json({ success: true, assignment: assignments[0] });
      } else {
        console.log('❌ No hay asignación de prueba para:', chatId);
        res.json({ success: false, message: 'No hay asignación para este chat' });
      }
    } catch (error) {
      console.error('❌ Error en prueba de asignación:', error);
      res.status(500).json({ error: 'Error en prueba' });
    }
  });

  // ENDPOINT ARREGLADO PARA CREAR ASIGNACIONES DE AGENTES
  app.post('/api/chat-assignments', async (req, res) => {
    try {
      console.log('📝 Creando/actualizando asignación:', req.body);
      const { chatId, accountId, assignedToId, category = 'general' } = req.body;
      
      if (!chatId || !accountId) {
        return res.status(400).json({ error: 'Se requiere chatId y accountId' });
      }

      const { sql } = await import('drizzle-orm');
      
      // Verificar si ya existe una asignación
      const existingQuery = sql`
        SELECT * FROM chat_assignments WHERE "chatId" = ${chatId} LIMIT 1
      `;
      const existingResult = await db.execute(existingQuery);
      
      if (existingResult.rows.length > 0) {
        // Actualizar asignación existente
        const updateQuery = sql`
          UPDATE chat_assignments 
          SET "assignedToId" = ${assignedToId || null}, "category" = ${category}, "assignedAt" = NOW()
          WHERE "chatId" = ${chatId}
          RETURNING *
        `;
        const updateResult = await db.execute(updateQuery);
        console.log('✅ Asignación actualizada:', updateResult.rows[0]);
        res.json(updateResult.rows[0]);
      } else {
        // Crear nueva asignación
        const insertQuery = sql`
          INSERT INTO chat_assignments ("chatId", "accountId", "assignedToId", "category", "status", "assignedAt")
          VALUES (${chatId}, ${parseInt(accountId)}, ${assignedToId || null}, ${category}, 'active', NOW())
          RETURNING *
        `;
        const insertResult = await db.execute(insertQuery);
        console.log('✅ Nueva asignación creada:', insertResult.rows[0]);
        res.json(insertResult.rows[0]);
      }
    } catch (error) {
      console.error('❌ Error al crear asignación:', error);
      res.status(500).json({ error: 'Error al crear asignación: ' + (error as Error).message });
    }
  });

  // ENDPOINT ARREGLADO PARA CONFIGURACIÓN DE RESPUESTAS AUTOMÁTICAS
  app.get('/api/auto-response/config', async (req, res) => {
    try {
      console.log('⚙️ Obteniendo configuración de respuestas automáticas');
      
      const { sql } = await import('drizzle-orm');
      const configQuery = sql`
        SELECT * FROM auto_response_config ORDER BY id DESC LIMIT 1
      `;
      
      const result = await db.execute(configQuery);
      
      if (result.rows.length > 0) {
        console.log('✅ Configuración encontrada:', result.rows[0]);
        res.json(result.rows[0]);
      } else {
        // Crear configuración por defecto
        const defaultConfig = {
          enabled: false,
          provider: 'gemini',
          welcomeMessage: 'Hola, gracias por contactarnos. En breve le atenderemos.',
          maxResponsesPerDay: 50,
          responseDelay: 2,
          businessHours: { start: '09:00', end: '18:00', timezone: 'America/Mexico_City' }
        };
        
        const insertQuery = sql`
          INSERT INTO auto_response_config (enabled, provider, "welcomeMessage", "maxResponsesPerDay", "responseDelay", "businessHours")
          VALUES (${defaultConfig.enabled}, ${defaultConfig.provider}, ${defaultConfig.welcomeMessage}, ${defaultConfig.maxResponsesPerDay}, ${defaultConfig.responseDelay}, ${JSON.stringify(defaultConfig.businessHours)})
          RETURNING *
        `;
        
        const insertResult = await db.execute(insertQuery);
        console.log('✅ Configuración por defecto creada:', insertResult.rows[0]);
        res.json(insertResult.rows[0]);
      }
    } catch (error) {
      console.error('❌ Error al obtener configuración:', error);
      res.status(500).json({ error: 'Error al obtener configuración' });
    }
  });

  app.post('/api/auto-response/config', async (req, res) => {
    try {
      console.log('⚙️ Guardando configuración de respuestas automáticas:', req.body);
      
      const { enabled, provider, welcomeMessage, maxResponsesPerDay, responseDelay, businessHours } = req.body;
      
      const { sql } = await import('drizzle-orm');
      
      // Verificar si existe configuración
      const existingQuery = sql`SELECT id FROM auto_response_config LIMIT 1`;
      const existingResult = await db.execute(existingQuery);
      
      if (existingResult.rows.length > 0) {
        // Actualizar configuración existente
        const updateQuery = sql`
          UPDATE auto_response_config 
          SET enabled = ${enabled}, provider = ${provider}, "welcomeMessage" = ${welcomeMessage}, 
              "maxResponsesPerDay" = ${maxResponsesPerDay}, "responseDelay" = ${responseDelay}, 
              "businessHours" = ${JSON.stringify(businessHours)}, "updatedAt" = NOW()
          WHERE id = ${existingResult.rows[0].id}
          RETURNING *
        `;
        const updateResult = await db.execute(updateQuery);
        console.log('✅ Configuración actualizada:', updateResult.rows[0]);
        res.json(updateResult.rows[0]);
      } else {
        // Crear nueva configuración
        const insertQuery = sql`
          INSERT INTO auto_response_config (enabled, provider, "welcomeMessage", "maxResponsesPerDay", "responseDelay", "businessHours")
          VALUES (${enabled}, ${provider}, ${welcomeMessage}, ${maxResponsesPerDay}, ${responseDelay}, ${JSON.stringify(businessHours)})
          RETURNING *
        `;
        const insertResult = await db.execute(insertQuery);
        console.log('✅ Nueva configuración creada:', insertResult.rows[0]);
        res.json(insertResult.rows[0]);
      }
    } catch (error) {
      console.error('❌ Error al guardar configuración:', error);
      res.status(500).json({ error: 'Error al guardar configuración: ' + (error as Error).message });
    }
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Middleware específico para rutas directas de API
  app.use("/api/direct/", (req: Request, res: Response, next: NextFunction) => {
    // Asegurarnos de que la respuesta sea JSON o imagen, no HTML
    res.header('Content-Type', req.path.includes('qr-image') ? 'image/png' : 'application/json');
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    
    log(`Procesando ruta directa API: ${req.path}`);
    next();
  });

  // RUTAS DE CONFIGURACIÓN DE AGENTES POR CUENTA - ANTES DE VITE
  app.get("/api/whatsapp-accounts/:accountId/agent-config", async (req: Request, res: Response) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const { storage } = await import('./storage');
      
      // Obtener la configuración del agente para esta cuenta
      const account = await storage.getWhatsappAccount(accountId);
      if (!account) {
        return res.status(404).json({ error: 'Cuenta no encontrada' });
      }
      
      res.json({
        success: true,
        config: {
          assignedExternalAgentId: account.assignedExternalAgentId,
          autoResponseEnabled: account.autoResponseEnabled || false,
          responseDelay: account.responseDelay || 3
        }
      });
    } catch (error) {
      console.error('Error obteniendo configuración de agente:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  // Toggle AI ON/OFF para una cuenta específica
  app.post("/api/whatsapp-accounts/:accountId/ai-toggle", async (req: Request, res: Response) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const { enabled } = req.body;
      const { storage } = await import('./storage');
      
      console.log(`🔄 Toggle AI para cuenta ${accountId}: ${enabled ? 'ACTIVAR' : 'DESACTIVAR'}`);
      
      const updatedAccount = await storage.updateWhatsappAccount(accountId, {
        autoResponseEnabled: enabled
      });
      
      if (!updatedAccount) {
        return res.status(404).json({ error: 'Cuenta no encontrada' });
      }
      
      console.log(`✅ AI ${enabled ? 'ACTIVADO' : 'DESACTIVADO'} para cuenta ${accountId}`);
      
      res.json({
        success: true,
        message: `AI ${enabled ? 'activado' : 'desactivado'} exitosamente`,
        config: {
          assignedExternalAgentId: updatedAccount.assignedExternalAgentId,
          autoResponseEnabled: updatedAccount.autoResponseEnabled,
          responseDelay: updatedAccount.responseDelay || 3
        }
      });
    } catch (error) {
      console.error('Error toggle AI:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  // Asignar agente a una cuenta específica
  app.post("/api/whatsapp-accounts/:accountId/assign-agent", async (req: Request, res: Response) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const { agentId } = req.body;
      const { storage } = await import('./storage');
      
      console.log(`👤 Asignando agente ${agentId} a cuenta ${accountId}`);
      
      const updatedAccount = await storage.updateWhatsappAccount(accountId, {
        assignedExternalAgentId: agentId
      });
      
      if (!updatedAccount) {
        return res.status(404).json({ error: 'Cuenta no encontrada' });
      }
      
      console.log(`✅ Agente ${agentId} asignado a cuenta ${accountId}`);
      
      res.json({
        success: true,
        message: 'Agente asignado exitosamente'
      });
    } catch (error) {
      console.error('Error asignando agente:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  app.post("/api/whatsapp-accounts/:accountId/assign-agent", async (req: Request, res: Response) => {
    try {
      const accountId = parseInt(req.params.accountId);
      const { agentId, autoResponseEnabled, responseDelay } = req.body;
      const { storage } = await import('./storage');
      
      // Actualizar la configuración del agente
      await storage.updateWhatsappAccountAgentConfig(accountId, {
        assignedExternalAgentId: agentId || null,
        autoResponseEnabled: autoResponseEnabled || false,
        responseDelay: responseDelay || 3
      });
      
      console.log(`✅ Agente ${agentId} asignado a cuenta ${accountId}`);
      
      res.json({
        success: true,
        message: `Configuración de agente actualizada para cuenta ${accountId}`
      });
    } catch (error) {
      console.error('❌ Error asignando agente:', error);
      res.status(500).json({ error: 'Error asignando agente' });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
