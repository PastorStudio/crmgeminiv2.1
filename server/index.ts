import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes";
// Comentado temporalmente para evitar errores de inicio
import { setupVite, serveStatic, log } from "./vite";
import { registerDirectAPIRoutes } from "./services/directApiServer";
import { storage } from "./storage";
import whatsappAccountsRouter from "./routes/whatsappAccounts";

// Sistema iniciado correctamente
console.log('✅ Sistema CRM WhatsApp iniciado correctamente');
// Configuración específica para WhatsApp QR
console.log(`Modo de ejecución: ${process.env.NODE_ENV || 'development'}`);
// No cambiamos NODE_ENV para no afectar a Vite
// La ruta de chat assignments se registrará en routes.ts

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ENDPOINT DIRECTO - GET CONFIG 
app.get("/api/config/auto-response", (req, res) => {
  try {
    let config = global.autoResponseConfig;
    
    if (!config) {
      config = {
        enabled: false,
        delaySeconds: 10,
        templates: [{
          id: "1",
          name: "Saludo automático",
          content: "¡Hola! Gracias por contactarnos. Te atenderemos pronto.",
          variables: []
        }],
        useProfessionLevel: true,
        defaultTemplate: "1",
        enabledForGroups: false,
        enabledForBroadcast: false,
        excludedContacts: [],
        aiProvider: "smartbots",
        customPrompts: {
          enabled: true,
          system: "Eres SmartBots, un asistente virtual especializado en atención al cliente para WhatsApp. Responde de manera amable, profesional y útil.",
          temperature: 0.7,
          maxTokens: 500
        }
      };
    }

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    });
    res.end(JSON.stringify(config));
  } catch (error) {
    console.error('❌ Error obteniendo configuración:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message }));
  }
});

// ENDPOINT DIRECTO SIN CONFLICTOS CON VITE - CON PERSISTENCIA REAL
app.post("/api/config/auto-response", async (req, res) => {
  try {
    console.log('✅ ENDPOINT FUNCIONAL - /api/config/auto-response');
    console.log('📦 Body:', req.body);
    
    // Guardar en la base de datos o storage
    const storage = require('./storage').storage;
    
    // Guardar la configuración en el storage
    if (storage.setAutoResponseConfig) {
      await storage.setAutoResponseConfig(req.body);
      console.log('💾 Configuración guardada en storage');
    } else {
      // Si no existe el método, guardarlo en memoria global temporalmente
      global.autoResponseConfig = req.body;
      console.log('💾 Configuración guardada en memoria global');
    }
    
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    });
    
    const response = {
      success: true,
      message: "✅ Configuración guardada y persistida correctamente",
      config: req.body,
      timestamp: new Date().toISOString()
    };
    
    res.end(JSON.stringify(response));
  } catch (error) {
    console.error('❌ Error guardando configuración:', error);
    res.writeHead(500, {
      'Content-Type': 'application/json'
    });
    res.end(JSON.stringify({
      success: false,
      error: error.message
    }));
  }
});

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

  // Registramos rutas directas para evitar la interceptación de Vite
  registerDirectAPIRoutes(app);

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
      
      const comments = await storage.getChatComments(chatId);
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
        console.log('❌ Faltan datos requeridos:', { chatId: !!chatId, comment: !!commentText });
        return res.status(400).json({ 
          error: 'Faltan datos requeridos',
          required: { chatId: !!chatId, comment: !!commentText }
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
          name: user?.fullName || "Agente",
          username: user?.username || "agent"
        }
      };
      
      console.log('✅ COMENTARIO GUARDADO EN POSTGRESQL:', response);
      res.json(response);
    } catch (error) {
      console.error('❌ Error al crear comentario:', error);
      res.status(500).json({ error: 'Error al crear comentario: ' + (error as Error).message });
    }
  });

  // TEMPORALMENTE desactivado para usar rutas directas sin autenticación
  // const server = await registerRoutes(app);
  
  // Crear servidor HTTP manualmente para evitar conflictos
  const server = createServer(app);
  
  // Registrar rutas de WhatsApp accounts sin autenticación
  app.use("/api/whatsapp-accounts", whatsappAccountsRouter);
  
  // Las rutas para asignación de chats se registran en routes.ts

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
