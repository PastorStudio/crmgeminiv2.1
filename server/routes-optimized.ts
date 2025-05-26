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
import { geminiLeadOrganizer } from "./services/geminiLeadOrganizer";

// SISTEMA DE RUTAS OPTIMIZADO Y LIMPIO CON GEMINI AI
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

  // ***** RUTAS DE GEMINI AI PARA ORGANIZACIÓN INTELIGENTE *****

  // Analizar lead específico con Gemini AI
  app.get("/api/ai/analyze-lead/:id", async (req: Request, res: Response) => {
    try {
      const leadId = parseInt(req.params.id);
      const lead = await storage.getLead(leadId);
      
      if (!lead) {
        return res.status(404).json({ error: "Lead no encontrado" });
      }

      const messages = await storage.getMessagesByLead(leadId);
      const analysis = await geminiLeadOrganizer.analyzeLeadPriority(lead, messages);
      
      res.json({
        success: true,
        leadId,
        analysis,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error analizando lead:', error);
      res.status(500).json({ error: "Error al analizar lead con IA" });
    }
  });

  // Organizar todos los leads con Gemini AI
  app.post("/api/ai/organize-leads", async (_req: Request, res: Response) => {
    try {
      console.log('🤖 Iniciando organización automática con Gemini AI...');
      const result = await geminiLeadOrganizer.organizeAllLeads();
      
      res.json({
        success: true,
        organized: result.organized,
        insights: result.insights,
        message: `✅ ${result.organized} leads organizados exitosamente`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error organizando leads:', error);
      res.status(500).json({ error: "Error en organización automática" });
    }
  });

  // Optimizar pipeline de ventas
  app.get("/api/ai/optimize-pipeline/:leadId", async (req: Request, res: Response) => {
    try {
      const leadId = parseInt(req.params.leadId);
      const lead = await storage.getLead(leadId);
      
      if (!lead) {
        return res.status(404).json({ error: "Lead no encontrado" });
      }

      const activities = await storage.getActivitiesByLead(leadId);
      const optimization = await geminiLeadOrganizer.optimizeSalesPipeline(lead, activities);
      
      res.json({
        success: true,
        leadId,
        optimization,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error optimizando pipeline:', error);
      res.status(500).json({ error: "Error al optimizar pipeline" });
    }
  });

  // Clasificar ticket con Gemini AI
  app.post("/api/ai/classify-ticket", async (req: Request, res: Response) => {
    try {
      const ticketData = req.body;
      const classification = await geminiLeadOrganizer.classifyTicket(ticketData);
      
      res.json({
        success: true,
        classification,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error clasificando ticket:', error);
      res.status(500).json({ error: "Error al clasificar ticket" });
    }
  });

  // Generar reporte inteligente
  app.get("/api/ai/smart-report", async (_req: Request, res: Response) => {
    try {
      const leads = await storage.getAllLeads();
      const report = await geminiLeadOrganizer.generateSmartReport(leads);
      
      res.json({
        success: true,
        report,
        leadsAnalyzed: leads.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error generando reporte:', error);
      res.status(500).json({ error: "Error al generar reporte inteligente" });
    }
  });

  // Dashboard de IA con insights
  app.get("/api/ai/dashboard", async (_req: Request, res: Response) => {
    try {
      const leads = await storage.getAllLeads();
      const highPriorityLeads = leads.filter(lead => lead.priority === 'high').length;
      const totalLeads = leads.length;
      
      res.json({
        success: true,
        dashboard: {
          totalLeads,
          highPriorityLeads,
          aiReadiness: highPriorityLeads > 0 ? 'Listo para análisis' : 'Sin leads prioritarios',
          lastAnalysis: new Date().toISOString(),
          recommendations: [
            'Analizar leads de alta prioridad',
            'Optimizar pipeline de ventas',
            'Revisar clasificación de tickets'
          ]
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error en dashboard de IA:', error);
      res.status(500).json({ error: "Error al obtener dashboard de IA" });
    }
  });

  // ***** RUTA DE SALUD DEL SISTEMA *****
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      message: "Sistema optimizado funcionando correctamente",
      geminiAI: "Integrado y listo"
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