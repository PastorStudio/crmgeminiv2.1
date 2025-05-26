import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { 
  insertUserSchema, 
  insertLeadSchema, 
  insertActivitySchema, 
  insertMessageSchema, 
  insertSurveySchema,
  insertDashboardStatsSchema
} from "@shared/schema";
import { z } from "zod";

// SISTEMA DE RUTAS OPTIMIZADO Y LIMPIO
export function registerOptimizedRoutes(app: Express): Server {
  
  // Validación de esquemas
  const validateUser = (req: Request, res: Response, next: any) => {
    try {
      insertUserSchema.parse(req.body);
      next();
    } catch (error) {
      res.status(400).json({ error: "Datos de usuario inválidos" });
    }
  };

  const validateLead = (req: Request, res: Response, next: any) => {
    try {
      insertLeadSchema.parse(req.body);
      next();
    } catch (error) {
      res.status(400).json({ error: "Datos de lead inválidos" });
    }
  };

  // ***** RUTAS DE USUARIOS OPTIMIZADAS *****
  app.get("/api/users", async (_req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener usuarios" });
    }
  });

  app.post("/api/users", validateUser, async (req: Request, res: Response) => {
    try {
      const user = await storage.createUser(req.body);
      res.status(201).json(user);
    } catch (error) {
      res.status(500).json({ error: "Error al crear usuario" });
    }
  });

  // ***** RUTAS DE LEADS OPTIMIZADAS *****
  app.get("/api/leads", async (_req: Request, res: Response) => {
    try {
      const leads = await storage.getAllLeads();
      res.json(leads);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener leads" });
    }
  });

  app.post("/api/leads", validateLead, async (req: Request, res: Response) => {
    try {
      const lead = await storage.createLead(req.body);
      res.status(201).json(lead);
    } catch (error) {
      res.status(500).json({ error: "Error al crear lead" });
    }
  });

  app.get("/api/leads/:id", async (req: Request, res: Response) => {
    try {
      const lead = await storage.getLead(parseInt(req.params.id));
      if (!lead) {
        return res.status(404).json({ error: "Lead no encontrado" });
      }
      res.json(lead);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener lead" });
    }
  });

  // ***** RUTAS DE ACTIVIDADES OPTIMIZADAS *****
  app.get("/api/activities", async (_req: Request, res: Response) => {
    try {
      const activities = await storage.getUpcomingActivities(1, 50);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener actividades" });
    }
  });

  app.post("/api/activities", async (req: Request, res: Response) => {
    try {
      const activity = await storage.createActivity(req.body);
      res.status(201).json(activity);
    } catch (error) {
      res.status(500).json({ error: "Error al crear actividad" });
    }
  });

  // ***** RUTAS DE MENSAJES OPTIMIZADAS *****
  app.get("/api/messages", async (_req: Request, res: Response) => {
    try {
      const messages = await storage.getRecentMessages(50);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener mensajes" });
    }
  });

  app.post("/api/messages", async (req: Request, res: Response) => {
    try {
      const message = await storage.createMessage(req.body);
      res.status(201).json(message);
    } catch (error) {
      res.status(500).json({ error: "Error al crear mensaje" });
    }
  });

  // ***** RUTAS DE DASHBOARD OPTIMIZADAS *****
  app.get("/api/dashboard-stats", async (_req: Request, res: Response) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener estadísticas" });
    }
  });

  // ***** RUTA DE SALUD DEL SISTEMA *****
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      message: "Sistema optimizado funcionando correctamente"
    });
  });

  // ***** CONFIGURACIÓN DEL SERVIDOR HTTP Y WEBSOCKET *****
  const httpServer = createServer(app);
  
  // WebSocket optimizado para notificaciones en tiempo real
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    perMessageDeflate: false,
    maxPayload: 1024 * 1024 // 1MB máximo
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log('✅ Cliente WebSocket conectado');
    
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📨 Mensaje WebSocket recibido:', message);
      } catch (error) {
        console.error('❌ Error procesando mensaje WebSocket:', error);
      }
    });

    ws.on('close', () => {
      console.log('🔌 Cliente WebSocket desconectado');
    });

    // Enviar mensaje de bienvenida
    ws.send(JSON.stringify({
      type: 'welcome',
      message: 'Conectado al sistema optimizado',
      timestamp: new Date().toISOString()
    }));
  });

  console.log('🚀 Rutas optimizadas registradas correctamente');
  console.log('📡 WebSocket configurado en /ws');
  
  return httpServer;
}