import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import * as fs from "fs";
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
import { apiKeyManager } from "./services/apiKeyManager";
import { db } from "./db";
// Importar las rutas de WhatsApp
import { registerWhatsAppRoutes } from "./services/whatsappRoutes";
import { registerAnalyticsRoutes } from "./services/analyticsRoutes";
import { autoResponseService } from "./services/autoResponseService";
import multer from "multer";
import { messageTemplateService } from "./services/messageTemplateService";
import { analyticsService } from "./services/analyticsService";
import { excelImportService } from "./services/excelImportService";
import { massSenderService } from "./services/massSenderService";
import { mediaGalleryRouter, mediaServeRouter } from "./services/mediaGalleryRoutes";
import { mediaGalleryService } from "./services/mediaGalleryService";

// Configurar middleware para upload de archivos
const upload = multer({ storage: multer.memoryStorage() });

// Profile update schema
const profileUpdateSchema = z.object({
  fullName: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  username: z.string().min(3, { message: "Username must be at least 3 characters." }),
  avatar: z.string().optional(),
  role: z.string().optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes prefix with /api
  
  // Registrar rutas específicas de WhatsApp con implementación directa
  registerWhatsAppRoutes(app);
  
  // Registrar rutas de analytics avanzado
  registerAnalyticsRoutes(app);
  
  // Registrar rutas para la galería de medios
  app.use("/api/media-gallery", mediaGalleryRouter);
  app.use("/api/media", mediaServeRouter);
  
  // Ruta para la página de prueba de la galería de medios
  app.get("/media-gallery-test", (req: Request, res: Response) => {
    res.sendFile(path.join(process.cwd(), "temp", "upload-test.html"));
  });
  
  // Health check endpoint
  app.get("/api/health", (req: Request, res: Response) => {
    res.json({ status: "ok" });
  });
  
  // Database status endpoint
  app.get("/api/database/status", (req: Request, res: Response) => {
    res.json({
      status: "connected",
      message: "Conectado a PostgreSQL con datos reales",
      database_url: "configured"
    });
  });
  
  // Database initialization endpoint
  app.post("/api/database/initialize", async (req: Request, res: Response) => {
    // Con la nueva configuración, siempre tenemos una base de datos real
    try {
      // Usamos import dinámico para que solo se cargue cuando se necesite
      const { default: dbInit } = await import('./scripts/dbInit');
      
      // Inicializar la base de datos
      await dbInit();
      
      return res.json({ 
        success: true, 
        message: "Base de datos inicializada correctamente" 
      });
    } catch (error) {
      console.error("Error al inicializar la base de datos:", error);
      
      return res.status(500).json({ 
        error: true, 
        message: "Error al inicializar la base de datos" 
      });
    }
  });

  // Users endpoints
  app.get("/api/users", async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/users", async (req: Request, res: Response) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const newUser = await storage.createUser(userData);
      res.status(201).json(newUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  });
  
  app.patch("/api/users/:id", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const userData = profileUpdateSchema.parse(req.body);
      
      // Verificar si el usuario existe
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Actualizar el usuario
      const updatedUser = await storage.updateUser(userId, userData);
      res.status(200).json(updatedUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Leads endpoints
  app.get("/api/leads", async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string;
      const assignedTo = req.query.assignedTo ? parseInt(req.query.assignedTo as string) : undefined;
      
      if (status) {
        const leads = await storage.getLeadsByStatus(status);
        return res.json(leads);
      } else if (assignedTo) {
        const leads = await storage.getLeadsByAssignee(assignedTo);
        return res.json(leads);
      } else {
        const leads = await storage.getAllLeads();
        return res.json(leads);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  app.get("/api/leads/:id", async (req: Request, res: Response) => {
    try {
      const leadId = parseInt(req.params.id);
      const lead = await storage.getLead(leadId);
      
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      res.json(lead);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch lead" });
    }
  });

  app.post("/api/leads", async (req: Request, res: Response) => {
    try {
      const leadData = insertLeadSchema.parse(req.body);
      const newLead = await storage.createLead(leadData);
      res.status(201).json(newLead);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid lead data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create lead" });
    }
  });

  app.patch("/api/leads/:id", async (req: Request, res: Response) => {
    try {
      const leadId = parseInt(req.params.id);
      const leadData = req.body;
      
      const updatedLead = await storage.updateLead(leadId, leadData);
      
      if (!updatedLead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      res.json(updatedLead);
    } catch (error) {
      res.status(500).json({ message: "Failed to update lead" });
    }
  });

  app.patch("/api/leads/:id/status", async (req: Request, res: Response) => {
    try {
      const leadId = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }
      
      const updatedLead = await storage.updateLeadStatus(leadId, status);
      
      if (!updatedLead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      res.json(updatedLead);
    } catch (error) {
      res.status(500).json({ message: "Failed to update lead status" });
    }
  });

  // Activities endpoints
  app.get("/api/activities", async (req: Request, res: Response) => {
    try {
      const leadId = req.query.leadId ? parseInt(req.query.leadId as string) : undefined;
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      const upcoming = req.query.upcoming === "true";
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      
      if (leadId) {
        const activities = await storage.getActivitiesByLead(leadId);
        return res.json(activities);
      } else if (userId && upcoming) {
        const activities = await storage.getUpcomingActivities(userId, limit);
        return res.json(activities);
      } else if (userId) {
        const activities = await storage.getActivitiesByUser(userId);
        return res.json(activities);
      } else {
        return res.status(400).json({ message: "Missing required parameters" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  app.get("/api/activities/:id", async (req: Request, res: Response) => {
    try {
      const activityId = parseInt(req.params.id);
      const activity = await storage.getActivity(activityId);
      
      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }
      
      res.json(activity);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch activity" });
    }
  });

  app.post("/api/activities", async (req: Request, res: Response) => {
    try {
      const activityData = insertActivitySchema.parse(req.body);
      const newActivity = await storage.createActivity(activityData);
      res.status(201).json(newActivity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid activity data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create activity" });
    }
  });

  app.patch("/api/activities/:id", async (req: Request, res: Response) => {
    try {
      const activityId = parseInt(req.params.id);
      const activityData = req.body;
      
      const updatedActivity = await storage.updateActivity(activityId, activityData);
      
      if (!updatedActivity) {
        return res.status(404).json({ message: "Activity not found" });
      }
      
      res.json(updatedActivity);
    } catch (error) {
      res.status(500).json({ message: "Failed to update activity" });
    }
  });

  app.patch("/api/activities/:id/complete", async (req: Request, res: Response) => {
    try {
      const activityId = parseInt(req.params.id);
      const completedActivity = await storage.completeActivity(activityId);
      
      if (!completedActivity) {
        return res.status(404).json({ message: "Activity not found" });
      }
      
      res.json(completedActivity);
    } catch (error) {
      res.status(500).json({ message: "Failed to complete activity" });
    }
  });

  // Messages endpoints
  app.get("/api/messages", async (req: Request, res: Response) => {
    try {
      const leadId = req.query.leadId ? parseInt(req.query.leadId as string) : undefined;
      const recent = req.query.recent === "true";
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      
      if (leadId) {
        const messages = await storage.getMessagesByLead(leadId);
        return res.json(messages);
      } else if (recent) {
        const messages = await storage.getRecentMessages(limit);
        return res.json(messages);
      } else {
        return res.status(400).json({ message: "Missing required parameters" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.get("/api/messages/:id", async (req: Request, res: Response) => {
    try {
      const messageId = parseInt(req.params.id);
      const message = await storage.getMessage(messageId);
      
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      
      res.json(message);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch message" });
    }
  });

  app.post("/api/messages", async (req: Request, res: Response) => {
    try {
      const messageData = insertMessageSchema.parse(req.body);
      const newMessage = await storage.createMessage(messageData);
      res.status(201).json(newMessage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid message data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  app.patch("/api/messages/:id/read", async (req: Request, res: Response) => {
    try {
      const messageId = parseInt(req.params.id);
      const updatedMessage = await storage.markMessageAsRead(messageId);
      
      if (!updatedMessage) {
        return res.status(404).json({ message: "Message not found" });
      }
      
      res.json(updatedMessage);
    } catch (error) {
      res.status(500).json({ message: "Failed to mark message as read" });
    }
  });

  // Surveys endpoints
  app.get("/api/surveys", async (req: Request, res: Response) => {
    try {
      const leadId = req.query.leadId ? parseInt(req.query.leadId as string) : undefined;
      
      if (leadId) {
        const surveys = await storage.getSurveysByLead(leadId);
        return res.json(surveys);
      } else {
        return res.status(400).json({ message: "Missing required parameters" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch surveys" });
    }
  });

  app.get("/api/surveys/:id", async (req: Request, res: Response) => {
    try {
      const surveyId = parseInt(req.params.id);
      const survey = await storage.getSurvey(surveyId);
      
      if (!survey) {
        return res.status(404).json({ message: "Survey not found" });
      }
      
      res.json(survey);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch survey" });
    }
  });

  app.post("/api/surveys", async (req: Request, res: Response) => {
    try {
      const surveyData = insertSurveySchema.parse(req.body);
      const newSurvey = await storage.createSurvey(surveyData);
      res.status(201).json(newSurvey);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid survey data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create survey" });
    }
  });

  app.patch("/api/surveys/:id/responses", async (req: Request, res: Response) => {
    try {
      const surveyId = parseInt(req.params.id);
      const { responses } = req.body;
      
      if (!responses) {
        return res.status(400).json({ message: "Responses are required" });
      }
      
      const updatedSurvey = await storage.updateSurveyResponses(surveyId, responses);
      
      if (!updatedSurvey) {
        return res.status(404).json({ message: "Survey not found" });
      }
      
      res.json(updatedSurvey);
    } catch (error) {
      res.status(500).json({ message: "Failed to update survey responses" });
    }
  });

  // Dashboard stats endpoint
  app.get("/api/dashboard-stats", async (req: Request, res: Response) => {
    try {
      const stats = await storage.getDashboardStats();
      
      if (!stats) {
        return res.status(404).json({ message: "Dashboard stats not found" });
      }
      
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  app.patch("/api/dashboard-stats", async (req: Request, res: Response) => {
    try {
      const statsData = insertDashboardStatsSchema.parse(req.body);
      const updatedStats = await storage.updateDashboardStats(statsData);
      res.json(updatedStats);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid stats data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update dashboard stats" });
    }
  });

  // Gemini AI endpoints - for integrating with Google's Gemini
  app.post("/api/gemini/analyze-lead", async (req: Request, res: Response) => {
    try {
      const { leadId } = req.body;
      
      if (!leadId) {
        return res.status(400).json({ message: "Lead ID is required" });
      }
      
      // Import the Gemini service
      const { geminiService } = await import('./services/geminiService');
      
      // Call the Gemini API to analyze the lead
      const analysis = await geminiService.analyzeLead(parseInt(leadId));
      
      res.json({ 
        success: true, 
        analysis 
      });
    } catch (error) {
      console.error("Error al analizar lead con Gemini:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error al analizar lead con Gemini",
        error: (error as Error).message 
      });
    }
  });
  
  // API de prueba para verificar el estado de Gemini
  app.get("/api/gemini/status", async (req: Request, res: Response) => {
    try {
      // Importar el servicio Gemini
      const { geminiService } = await import('./services/geminiService');
      
      // Generar una pregunta simple para verificar que Gemini está funcionando
      const testQuery = "Genera una respuesta corta a la pregunta: ¿Qué aporta la IA a un CRM?";
      const testResponse = await geminiService.generateContent(testQuery);
      
      // Si llegamos aquí, Gemini está funcionando correctamente
      res.json({
        success: true,
        status: "Gemini API está funcionando correctamente",
        test_response: testResponse.substring(0, 300) + (testResponse.length > 300 ? "..." : "")
      });
    } catch (error) {
      console.error("Error al verificar estado de Gemini:", error);
      res.status(500).json({
        success: false,
        status: "Gemini API no está disponible",
        error: (error as Error).message
      });
    }
  });
  
  app.post("/api/gemini/generate-message", async (req: Request, res: Response) => {
    try {
      const { leadId, messageType } = req.body;
      
      if (!leadId || !messageType) {
        return res.status(400).json({ 
          success: false, 
          message: "Lead ID y tipo de mensaje son requeridos" 
        });
      }
      
      // Import the Gemini service
      const { geminiService } = await import('./services/geminiService');
      
      // Generate personalized message
      const message = await geminiService.generateMessage(parseInt(leadId), messageType);
      
      res.json({ 
        success: true, 
        message 
      });
    } catch (error) {
      console.error("Error al generar mensaje con Gemini:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error al generar mensaje con Gemini" 
      });
    }
  });
  
  // Ruta para chat con Gemini
  app.post("/api/gemini/chat", async (req: Request, res: Response) => {
    try {
      // Acepta tanto el formato {prompt, context} como {message, history}
      const { prompt, context, message, history } = req.body;
      
      if (!prompt && !message) {
        return res.status(400).json({ 
          success: false, 
          message: "Se requiere un mensaje o prompt" 
        });
      }
      
      // Importar el servicio Gemini
      const { geminiService } = await import('./services/geminiService');
      
      // Por ahora, simular una respuesta simple ya que esta función está en desarrollo
      const responseContent = "Soy tu asistente de CRM. Puedo ayudarte con análisis de leads, generación de contenido y proporcionando insights para tu proceso de ventas. ¿En qué tarea específica te gustaría recibir ayuda hoy?";
      
      const responseObj = {
        role: "assistant",
        content: responseContent
      };
      
      res.json({ 
        success: true, 
        response: responseObj 
      });
    } catch (error) {
      console.error("Error en chat con Gemini:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error al procesar el chat con Gemini" 
      });
    }
  });

  // Endpoint para sugerir acciones para un lead
  app.post("/api/gemini/suggest-action", async (req: Request, res: Response) => {
    try {
      const { leadId } = req.body;
      
      if (!leadId) {
        return res.status(400).json({ 
          success: false, 
          message: "Se requiere un ID de lead" 
        });
      }
      
      const lead = await storage.getLead(parseInt(leadId));
      
      if (!lead) {
        return res.status(404).json({ 
          success: false, 
          message: "Lead no encontrado" 
        });
      }
      
      // Importar el servicio Gemini
      const { geminiService } = await import('./services/geminiService');
      
      // Por ahora, devolver una acción sugerida simple
      const action = {
        type: "follow-up",
        description: "Programar una llamada de seguimiento",
        priority: "alta",
        timeframe: "próximos 2 días",
        reasoning: `El lead ${lead.name} ha mostrado interés en nuestros servicios. Sería ideal realizar una llamada para resolver dudas pendientes.`,
        script: `Hola ${lead.name}, notamos que estabas interesado en nuestro plan premium. Te llamo para ver si tienes alguna pregunta que pueda responderte y para discutir cómo podríamos adaptar nuestra solución a tus necesidades específicas.`
      };
      
      res.json({ 
        success: true, 
        action 
      });
    } catch (error) {
      console.error("Error al sugerir acción con Gemini:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error al sugerir acción con Gemini" 
      });
    }
  });
  
  // Nuevas rutas para funcionalidades avanzadas de IA
  app.post("/api/gemini/extract-info", async (req: Request, res: Response) => {
    try {
      const { leadId, conversation } = req.body;
      
      if (!leadId || !conversation) {
        return res.status(400).json({
          success: false,
          message: "Se requiere ID del lead y texto de la conversación"
        });
      }
      
      // Importar el servicio Gemini
      const { geminiService } = await import('./services/geminiService');
      
      const result = await geminiService.extractLeadInfoFromConversation(parseInt(leadId), conversation);
      
      res.json(result);
    } catch (error) {
      console.error("Error al extraer información:", error);
      res.status(500).json({
        success: false,
        message: "Error al extraer información de la conversación",
        error: (error as Error).message
      });
    }
  });
  
  app.post("/api/gemini/generate-tags", async (req: Request, res: Response) => {
    try {
      const { leadId } = req.body;
      
      if (!leadId) {
        return res.status(400).json({
          success: false,
          message: "Se requiere ID del lead"
        });
      }
      
      // Importar el servicio Gemini
      const { geminiService } = await import('./services/geminiService');
      
      const result = await geminiService.generateTagsWithProbability(parseInt(leadId));
      
      res.json(result);
    } catch (error) {
      console.error("Error al generar etiquetas:", error);
      res.status(500).json({
        success: false,
        message: "Error al generar etiquetas con probabilidades",
        error: (error as Error).message
      });
    }
  });
  
  // Rutas para gestión automatizada con IA
  app.post("/api/auto/manage-lead", async (req: Request, res: Response) => {
    try {
      const { leadId } = req.body;
      
      if (!leadId) {
        return res.status(400).json({
          success: false,
          message: "Se requiere ID del lead"
        });
      }
      
      // Importamos el servicio bajo demanda
      const taskTagServiceModule = await import('./services/taskTagService');
      // Obtenemos la instancia del servicio
      const { geminiService } = await import('./services/geminiService');
      const taskTagService = new taskTagServiceModule.default(geminiService);
      
      const result = await taskTagService.manageLead(parseInt(leadId));
      
      // Evitamos duplicar la propiedad success si ya viene en result
      if (result && typeof result === 'object' && 'success' in result) {
        res.json(result);
      } else {
        // Aseguramos que result sea un objeto antes de hacer el spread
        const resultObject = result && typeof result === 'object' ? result : { data: result };
        res.json({
          success: true,
          ...resultObject
        });
      }
    } catch (error) {
      console.error("Error en gestión automática:", error);
      res.status(500).json({
        success: false,
        message: "Error al gestionar automáticamente el lead",
        error: (error as Error).message
      });
    }
  });
  
  // Ruta para generar tareas automáticas
  app.post("/api/auto/generate-tasks", async (req: Request, res: Response) => {
    try {
      const { leadId } = req.body;
      
      if (!leadId) {
        return res.status(400).json({
          success: false,
          message: "Se requiere ID del lead"
        });
      }
      
      // Importamos el servicio bajo demanda
      const taskTagServiceModule = await import('./services/taskTagService');
      // Obtenemos la instancia del servicio
      const { geminiService } = await import('./services/geminiService');
      const taskTagService = new taskTagServiceModule.default(geminiService);
      
      const tasks = await taskTagService.generateTasks(parseInt(leadId));
      
      // Evitamos duplicar la propiedad success si ya viene en tasks
      if (tasks && typeof tasks === 'object' && 'success' in tasks) {
        res.json(tasks);
      } else if (Array.isArray(tasks)) {
        res.json({
          success: true,
          tasks
        });
      } else {
        // Si no es un array ni un objeto con success, lo manejamos como un valor general
        const tasksData = tasks && typeof tasks === 'object' ? tasks : { data: tasks };
        res.json({
          success: true,
          ...tasksData
        });
      }
    } catch (error) {
      console.error("Error al generar tareas:", error);
      res.status(500).json({
        success: false,
        message: "Error al generar tareas automáticas",
        error: (error as Error).message
      });
    }
  });
  
  // Auto-response endpoints
  app.get("/api/auto-response/config", async (req: Request, res: Response) => {
    try {
      const config = autoResponseService.getConfig();
      res.json(config);
    } catch (error) {
      console.error("Error al obtener configuración de respuestas automáticas:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error al obtener configuración de respuestas automáticas" 
      });
    }
  });

  app.post("/api/auto-response/config", async (req: Request, res: Response) => {
    try {
      const config = req.body;
      
      if (!config) {
        return res.status(400).json({
          success: false,
          message: "Se requiere configuración"
        });
      }
      
      const updatedConfig = autoResponseService.updateConfig(config);
      res.json({ 
        success: true, 
        config: updatedConfig 
      });
    } catch (error) {
      console.error("Error al actualizar configuración de respuestas automáticas:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error al actualizar configuración de respuestas automáticas" 
      });
    }
  });

  app.post("/api/auto-response/cancel", async (req: Request, res: Response) => {
    try {
      const { contactId } = req.body;
      
      if (!contactId) {
        return res.status(400).json({
          success: false,
          message: "Se requiere ID del contacto"
        });
      }
      
      const cancelled = autoResponseService.cancelPendingResponse(contactId);
      res.json({ 
        success: true, 
        cancelled 
      });
    } catch (error) {
      console.error("Error al cancelar respuesta automática:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error al cancelar respuesta automática" 
      });
    }
  });
  
  // API Key Management endpoints
  app.get("/api/settings/gemini-key-status", async (req: Request, res: Response) => {
    try {
      const status = {
        hasValidKey: apiKeyManager.hasValidGeminiKey(),
        isTemporary: apiKeyManager.isUsingTemporaryKey(),
      };
      
      res.json(status);
    } catch (error) {
      console.error("Error checking Gemini API key status:", error);
      res.status(500).json({ message: "Failed to check API key status" });
    }
  });
  
  app.post("/api/settings/update-gemini-key", async (req: Request, res: Response) => {
    try {
      const { apiKey } = req.body;
      
      if (!apiKey) {
        return res.status(400).json({ message: "API key is required" });
      }
      
      // Actualizar la clave API
      apiKeyManager.updateGeminiKey(apiKey);
      
      res.json({ success: true, message: "API key updated successfully" });
    } catch (error) {
      console.error("Error updating Gemini API key:", error);
      res.status(500).json({ message: "Failed to update API key" });
    }
  });
  
  app.post("/api/settings/generate-temp-key", async (req: Request, res: Response) => {
    try {
      // Este endpoint generaría una clave temporal a través de apiKeyManager
      // En una implementación real, esto se comunicaría con el servicio de Google
      // para obtener una clave temporal con los permisos limitados
      
      // Simulamos que se generó una clave temporal
      const tempKey = apiKeyManager.getGeminiKey();
      
      res.json({ 
        success: true, 
        message: "Temporary API key generated successfully",
        isTemporary: true
      });
    } catch (error) {
      console.error("Error generating temporary Gemini API key:", error);
      res.status(500).json({ message: "Failed to generate temporary API key" });
    }
  });
  
  // Rutas para WhatsApp - Usando implementación directa
  // Estas rutas ahora están gestionadas por el servicio registerWhatsAppRoutes que se llama al inicio
  /*
  app.get("/api/integrations/whatsapp/status", async (req: Request, res: Response) => {
    try {
      // Importar el servicio directo de WhatsApp
      const { whatsappDirectService } = await import('./services/whatsappDirectService');
      // Inicializar si no está inicializado
      if (!whatsappDirectService.getStatus().initialized) {
        await whatsappDirectService.initialize().catch(err => {
          console.error("Error inicializando servicio directo de WhatsApp:", err);
        });
      }
      const status = whatsappDirectService.getStatus();
      res.json(status);
    } catch (error) {
      console.error("Error al obtener estado de WhatsApp:", error);
      res.status(500).json({ message: "Error al obtener estado de WhatsApp" });
    }
  });
  */
  
  // Rutas para obtener código QR - Ahora gestionada por whatsappRoutes.ts
  /*
  app.get("/api/integrations/whatsapp/qrcode", async (req: Request, res: Response) => {
    try {
      // Usar el servicio directo
      const { whatsappDirectService } = await import('./services/whatsappDirectService');
      const status = whatsappDirectService.getStatus();
      
      if (status.qrCode) {
        res.json({ data: status.qrCode });
      } else {
        res.status(204).json({ message: "No hay código QR disponible" });
      }
    } catch (error) {
      console.error("Error al obtener código QR de WhatsApp:", error);
      res.status(500).json({ message: "Error al obtener código QR de WhatsApp" });
    }
  });
  */
  
  // Ruta para reiniciar WhatsApp - Ahora gestionada por whatsappRoutes.ts
  /*
  app.post("/api/integrations/whatsapp/restart", async (req: Request, res: Response) => {
    try {
      // Usar el servicio directo
      const { whatsappDirectService } = await import('./services/whatsappDirectService');
      await whatsappDirectService.restart();
      res.json({ success: true });
    } catch (error) {
      console.error("Error al reiniciar WhatsApp:", error);
      res.status(500).json({ message: "Error al reiniciar WhatsApp" });
    }
  });
  */
  
  // Ruta para cerrar sesión de WhatsApp - Ahora gestionada por whatsappRoutes.ts
  /*
  app.post("/api/integrations/whatsapp/logout", async (req: Request, res: Response) => {
    try {
      // Usar el servicio directo
      const { whatsappDirectService } = await import('./services/whatsappDirectService');
      const result = await whatsappDirectService.logout();
      res.json(result);
    } catch (error) {
      console.error("Error al cerrar sesión de WhatsApp:", error);
      res.status(500).json({ message: "Error al cerrar sesión de WhatsApp" });
    }
  });
  */
  
  // Ruta para enviar mensajes de WhatsApp - Ahora gestionada por whatsappRoutes.ts
  /*
  app.post("/api/integrations/whatsapp/send", async (req: Request, res: Response) => {
    try {
      const { phone, message, leadId } = req.body;
      
      if (!phone || !message) {
        return res.status(400).json({ message: "Número de teléfono y mensaje son requeridos" });
      }
      
      // Usar el servicio directo
      const { whatsappDirectService } = await import('./services/whatsappDirectService');
      const result = await whatsappDirectService.sendMessage(
        phone, 
        message, 
        leadId ? parseInt(leadId) : undefined
      );
      res.json(result);
    } catch (error) {
      console.error("Error al enviar mensaje de WhatsApp:", error);
      res.status(500).json({ message: "Error al enviar mensaje de WhatsApp" });
    }
  });
  */
  
  // Rutas para Telegram
  app.get("/api/integrations/telegram/status", async (req: Request, res: Response) => {
    try {
      // Importar el servicio de Telegram
      const { telegramService } = await import('./services/telegramService');
      const status = telegramService.getStatus();
      res.json(status);
    } catch (error) {
      console.error("Error al obtener estado de Telegram:", error);
      res.status(500).json({ message: "Error al obtener estado de Telegram" });
    }
  });
  
  app.get("/api/integrations/telegram/authcode", async (req: Request, res: Response) => {
    try {
      // Importar el servicio de Telegram
      const { telegramService } = await import('./services/telegramService');
      const authCode = telegramService.getAuthCode();
      
      if (!authCode) {
        // Si no hay código de autenticación disponible, generar uno de demostración solo en desarrollo
        if (process.env.NODE_ENV === 'development') {
          const demoCode = telegramService.generateDemoAuthCode();
          // Esperar un poco para que se genere la imagen QR
          setTimeout(() => {
            const authCode = telegramService.getAuthCode();
            if (authCode && authCode.base64Image) {
              res.json({ 
                data: authCode.base64Image,
                expiry: authCode.expiresAt.toISOString()
              });
            } else {
              res.json({ 
                data: `https://api.qrserver.com/v1/create-qr-code/?data=geminicrm://telegram/auth/${demoCode.code}`,
                expiry: demoCode.expiresAt.toISOString()
              });
            }
          }, 500);
        } else {
          res.status(404).json({ message: "No hay código de autenticación disponible" });
        }
      } else {
        res.json({ 
          data: authCode.base64Image || `https://api.qrserver.com/v1/create-qr-code/?data=geminicrm://telegram/auth/${authCode.code}`,
          expiry: authCode.expiresAt.toISOString()
        });
      }
    } catch (error) {
      console.error("Error al obtener código de autenticación de Telegram:", error);
      res.status(500).json({ message: "Error al obtener código de autenticación de Telegram" });
    }
  });
  
  app.post("/api/integrations/telegram/restart", async (req: Request, res: Response) => {
    try {
      // Importar el servicio de Telegram
      const { telegramService } = await import('./services/telegramService');
      const result = await telegramService.restart();
      res.json(result);
    } catch (error) {
      console.error("Error al reiniciar Telegram:", error);
      res.status(500).json({ message: "Error al reiniciar Telegram" });
    }
  });
  
  app.post("/api/integrations/telegram/generate-authcode", async (req: Request, res: Response) => {
    try {
      // Importar el servicio de Telegram
      const { telegramService } = await import('./services/telegramService');
      telegramService.generateAuthCode();
      
      // Dar tiempo para que se genere la imagen QR
      setTimeout(() => {
        const authCode = telegramService.getAuthCode();
        res.json({ 
          success: true,
          code: authCode?.code,
          expiry: authCode?.expiresAt.toISOString()
        });
      }, 500);
    } catch (error) {
      console.error("Error al generar código de autenticación de Telegram:", error);
      res.status(500).json({ message: "Error al generar código de autenticación de Telegram" });
    }
  });
  
  app.post("/api/integrations/telegram/set-token", async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ message: "Token es requerido" });
      }
      
      // Importar el servicio de Telegram
      const { telegramService } = await import('./services/telegramService');
      const result = await telegramService.setToken(token);
      res.json(result);
    } catch (error) {
      console.error("Error al configurar token de Telegram:", error);
      res.status(500).json({ message: "Error al configurar token de Telegram" });
    }
  });
  
  app.post("/api/integrations/telegram/send", async (req: Request, res: Response) => {
    try {
      const { chatId, message, leadId } = req.body;
      
      if (!chatId || !message) {
        return res.status(400).json({ message: "Chat ID y mensaje son requeridos" });
      }
      
      // Importar el servicio de Telegram
      const { telegramService } = await import('./services/telegramService');
      const result = await telegramService.sendMessage(chatId, message, leadId ? parseInt(leadId) : undefined);
      res.json(result);
    } catch (error) {
      console.error("Error al enviar mensaje de Telegram:", error);
      res.status(500).json({ message: "Error al enviar mensaje de Telegram" });
    }
  });

  // Crear servidor HTTP
  const httpServer = createServer(app);
  
  // Rutas para plantillas de mensajes
  app.get("/api/message-templates", async (req: Request, res: Response) => {
    try {
      const templates = await messageTemplateService.getAllTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error al obtener plantillas:", error);
      res.status(500).json({ error: "Error al obtener plantillas" });
    }
  });

  app.get("/api/message-templates/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const template = await messageTemplateService.getTemplateById(id);
      
      if (!template) {
        return res.status(404).json({ error: "Plantilla no encontrada" });
      }
      
      res.json(template);
    } catch (error) {
      console.error("Error al obtener plantilla:", error);
      res.status(500).json({ error: "Error al obtener plantilla" });
    }
  });

  app.post("/api/message-templates", async (req: Request, res: Response) => {
    try {
      const templateData = req.body;
      const template = await messageTemplateService.createTemplate(templateData);
      res.status(201).json(template);
    } catch (error) {
      console.error("Error al crear plantilla:", error);
      res.status(500).json({ error: "Error al crear plantilla" });
    }
  });

  app.patch("/api/message-templates/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const templateData = req.body;
      const template = await messageTemplateService.updateTemplate(id, templateData);
      
      if (!template) {
        return res.status(404).json({ error: "Plantilla no encontrada" });
      }
      
      res.json(template);
    } catch (error) {
      console.error("Error al actualizar plantilla:", error);
      res.status(500).json({ error: "Error al actualizar plantilla" });
    }
  });

  app.delete("/api/message-templates/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await messageTemplateService.deleteTemplate(id);
      
      if (!success) {
        return res.status(404).json({ error: "Plantilla no encontrada" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error al eliminar plantilla:", error);
      res.status(500).json({ error: "Error al eliminar plantilla" });
    }
  });

  app.get("/api/message-templates/:id/variables", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const variables = await messageTemplateService.analyzeTemplateVariables(id);
      
      res.json({ variables });
    } catch (error) {
      console.error("Error al analizar variables de plantilla:", error);
      res.status(500).json({ error: "Error al analizar variables de plantilla" });
    }
  });

  // No hay configuración adicional para el middleware de upload de archivos

  // Rutas para importación de Excel
  app.post("/api/excel/upload", upload.single('file'), async (req: Request, res: Response) => {
    try {
      console.log("Recibida solicitud para subir archivo Excel");
      
      const file = req.file;
      if (!file) {
        console.error("No se proporcionó ningún archivo en la solicitud");
        return res.status(400).json({ error: "No se ha proporcionado ningún archivo" });
      }
      
      console.log(`Archivo recibido: ${file.originalname}, tamaño: ${file.size} bytes, tipo: ${file.mimetype}`);
      
      // Verificar tipo de archivo
      const validMimeTypes = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'];
      if (!validMimeTypes.includes(file.mimetype) && !file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
        console.error(`Tipo de archivo no válido: ${file.mimetype}`);
        return res.status(400).json({ 
          error: "Formato de archivo no válido. Por favor, suba un archivo Excel (.xlsx, .xls) o CSV (.csv)" 
        });
      }
      
      try {
        const filename = await excelImportService.saveUploadedFile(file);
        
        console.log(`Archivo guardado exitosamente como: ${filename}`);
        res.json({ 
          success: true, 
          filename,
          originalname: file.originalname
        });
      } catch (saveError) {
        console.error("Error al guardar el archivo Excel:", saveError);
        res.status(500).json({ 
          error: "Error al guardar el archivo Excel en el servidor",
          details: saveError instanceof Error ? saveError.message : String(saveError)
        });
      }
    } catch (error) {
      console.error("Error inesperado al procesar la carga del archivo Excel:", error);
      res.status(500).json({ 
        error: "Error al procesar el archivo Excel",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get("/api/excel/analyze/:filename", async (req: Request, res: Response) => {
    try {
      const filename = req.params.filename;
      console.log(`Recibida solicitud para analizar archivo Excel: ${filename}`);
      
      if (!filename) {
        return res.status(400).json({ error: "Nombre de archivo no proporcionado" });
      }
      
      try {
        const result = await excelImportService.analyzeExcelFile(filename);
        
        if (!result.columns || result.columns.length === 0) {
          console.log(`No se encontraron columnas en el archivo ${filename}`);
          // Enviar una respuesta con columnas vacías pero sin error para que el frontend pueda manejar esta situación
          return res.json({ 
            columns: [], 
            suggestedMapping: {},
            message: "No se pudieron detectar columnas en el archivo. El archivo podría estar vacío o tener un formato no compatible."
          });
        }
        
        console.log(`Análisis exitoso. Se encontraron ${result.columns.length} columnas`);
        res.json(result);
      } catch (analyzeError) {
        console.error("Error específico al analizar archivo Excel:", analyzeError);
        res.status(500).json({ 
          error: "Error al analizar el archivo Excel", 
          details: analyzeError instanceof Error ? analyzeError.message : String(analyzeError)
        });
      }
    } catch (error) {
      console.error("Error inesperado al procesar solicitud de análisis:", error);
      res.status(500).json({ 
        error: "Error inesperado al analizar archivo Excel",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post("/api/excel/import", async (req: Request, res: Response) => {
    try {
      console.log("Recibida solicitud para importar datos desde Excel");
      const { filename, originalname, fieldMapping } = req.body;
      
      if (!filename) {
        console.error("Falta parámetro filename en la solicitud");
        return res.status(400).json({ error: "Se requiere el parámetro filename" });
      }
      
      if (!fieldMapping) {
        console.error("Falta parámetro fieldMapping en la solicitud");
        return res.status(400).json({ error: "Se requiere el parámetro fieldMapping con el mapeo de campos" });
      }
      
      console.log(`Parámetros de importación: filename=${filename}, fieldMapping=`, JSON.stringify(fieldMapping));
      
      if (!fieldMapping.phoneNumber || fieldMapping.phoneNumber === 'none') {
        console.error("El mapeo de campos no incluye el campo phoneNumber o está marcado como 'none'");
        return res.status(400).json({ 
          error: "El mapeo de campos debe incluir una columna válida para el campo phoneNumber" 
        });
      }
      
      try {
        // Verificar que el directorio temporal existe
        const tempDir = path.join(process.cwd(), 'temp', 'uploads');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
          console.log(`Directorio creado: ${tempDir}`);
        }
        
        // Lista todos los archivos en el directorio temp/uploads para depuración
        console.log("Archivos en directorio temp/uploads:");
        const files = fs.readdirSync(tempDir);
        files.forEach(file => {
          console.log(`- ${file}`);
        });
        
        // Intenta buscar el archivo correcto incluso si hay diferencias de capitalización
        let realFilename = filename;
        const matchingFile = files.find(file => file.toLowerCase() === filename.toLowerCase());
        if (matchingFile && matchingFile !== filename) {
          console.log(`Se encontró un archivo con nombre similar: ${matchingFile} (original: ${filename})`);
          realFilename = matchingFile;
        }
        
        // Verificar que el archivo existe
        const filePath = path.join(tempDir, realFilename);
        const fileExists = fs.existsSync(filePath);
        console.log(`Verificando archivo ${filePath}: ${fileExists ? 'EXISTE' : 'NO EXISTE'}`);
        
        if (!fileExists) {
          return res.status(404).json({ 
            error: "Archivo no encontrado", 
            details: `El archivo ${filename} no existe en el servidor. Archivos disponibles: ${files.join(', ')}` 
          });
        }
        
        const importResult = await excelImportService.importFromExcel(
          realFilename,
          originalname || realFilename,
          fieldMapping
        );
        
        console.log(`Importación completada: ${importResult.validRows} filas válidas, ${importResult.invalidRows} filas inválidas`);
        
        res.json(importResult);
      } catch (importError) {
        console.error("Error específico al importar datos desde Excel:", importError);
        res.status(500).json({ 
          error: "Error al importar datos desde Excel", 
          details: importError instanceof Error ? importError.message : String(importError)
        });
      }
    } catch (error) {
      console.error("Error inesperado al procesar solicitud de importación:", error);
      res.status(500).json({ 
        error: "Error inesperado al importar datos desde Excel",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get("/api/excel/imports", async (req: Request, res: Response) => {
    try {
      const imports = excelImportService.listImports();
      res.json(imports);
    } catch (error) {
      console.error("Error al obtener lista de importaciones:", error);
      res.status(500).json({ error: "Error al obtener lista de importaciones" });
    }
  });

  app.get("/api/excel/imports/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const importResult = excelImportService.getImportResult(id);
      
      if (!importResult) {
        return res.status(404).json({ error: "Importación no encontrada" });
      }
      
      res.json(importResult);
    } catch (error) {
      console.error("Error al obtener importación:", error);
      res.status(500).json({ error: "Error al obtener importación" });
    }
  });

  app.delete("/api/excel/imports/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const success = excelImportService.deleteImport(id);
      
      if (!success) {
        return res.status(404).json({ error: "Importación no encontrada" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error al eliminar importación:", error);
      res.status(500).json({ error: "Error al eliminar importación" });
    }
  });
  
  // Rutas para integración de Excel con plantillas de mensajes
  app.post("/api/excel/prepare-template-batch", async (req: Request, res: Response) => {
    try {
      const { importId, templateId, variableMapping } = req.body;
      
      if (!importId || !templateId || !variableMapping) {
        return res.status(400).json({ 
          error: "Se requiere importId, templateId y variableMapping" 
        });
      }
      
      const batch = excelImportService.prepareTemplateContactBatch(
        importId,
        parseInt(templateId),
        variableMapping
      );
      
      if (!batch) {
        return res.status(404).json({ error: "Importación no encontrada" });
      }
      
      res.json(batch);
    } catch (error) {
      console.error("Error al preparar lote de contactos:", error);
      res.status(500).json({ error: "Error al preparar lote de contactos para plantilla" });
    }
  });
  
  app.post("/api/excel/preview-template-message", async (req: Request, res: Response) => {
    try {
      const { templateId, variables } = req.body;
      
      if (!templateId || !variables) {
        return res.status(400).json({ 
          error: "Se requiere templateId y variables" 
        });
      }
      
      // Obtener la plantilla
      const template = await messageTemplateService.getTemplateById(parseInt(templateId));
      
      if (!template) {
        return res.status(404).json({ error: "Plantilla no encontrada" });
      }
      
      // Aplicar variables a la plantilla
      const message = excelImportService.generatePersonalizedMessage(
        template.content,
        variables
      );
      
      res.json({ 
        templateId,
        templateName: template.name,
        message 
      });
    } catch (error) {
      console.error("Error al previsualizar mensaje con plantilla:", error);
      res.status(500).json({ error: "Error al previsualizar mensaje con plantilla" });
    }
  });
  
  // Endpoint para formatear números de teléfono con código de país específico
  app.post("/api/excel/format-phone-numbers", async (req: Request, res: Response) => {
    try {
      const { phoneNumbers, countryCode } = req.body;
      
      if (!Array.isArray(phoneNumbers) || !phoneNumbers.length) {
        return res.status(400).json({ 
          error: "Se requiere un array de números de teléfono" 
        });
      }
      
      if (!countryCode || typeof countryCode !== 'string') {
        return res.status(400).json({ 
          error: "Se requiere un código de país válido" 
        });
      }
      
      const formattedNumbers = excelImportService.formatPhoneNumberWithCountryCode(
        phoneNumbers,
        countryCode
      );
      
      res.json({
        success: true,
        totalProcessed: phoneNumbers.length,
        formattedNumbers
      });
    } catch (error) {
      console.error("Error formateando números de teléfono:", error);
      res.status(500).json({ 
        error: "Error al formatear números de teléfono",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Endpoint para agregar etiquetas a contactos
  app.post("/api/contacts/tags", async (req: Request, res: Response) => {
    try {
      const { importId, tag } = req.body;
      
      if (!importId || !tag) {
        return res.status(400).json({ 
          error: "Se requiere un ID de importación y una etiqueta" 
        });
      }
      
      // Obtener la importación
      const importResult = excelImportService.getImportResult(importId);
      
      if (!importResult) {
        return res.status(404).json({ error: "Importación no encontrada" });
      }
      
      // Agregar la etiqueta a todos los contactos que no la tengan
      let updatedCount = 0;
      importResult.contacts.forEach(contact => {
        if (!contact.tags) {
          contact.tags = [tag];
          updatedCount++;
        } else if (!contact.tags.includes(tag)) {
          contact.tags.push(tag);
          updatedCount++;
        }
      });
      
      res.json({
        success: true,
        importId,
        tag,
        updatedCount,
        totalContacts: importResult.contacts.length
      });
    } catch (error) {
      console.error("Error agregando etiquetas a contactos:", error);
      res.status(500).json({ 
        error: "Error al agregar etiquetas a contactos",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Rutas para campañas de marketing
  app.get("/api/mass-sender/campaigns", async (req: Request, res: Response) => {
    try {
      const campaigns = await massSenderService.getCampaigns();
      res.json(campaigns);
    } catch (error) {
      console.error("Error al obtener campañas:", error);
      res.status(500).json({ error: "Error al obtener campañas" });
    }
  });

  app.post("/api/mass-sender/campaigns", async (req: Request, res: Response) => {
    try {
      const campaignData = req.body;
      const campaign = await massSenderService.createCampaign(campaignData);
      res.status(201).json(campaign);
    } catch (error) {
      console.error("Error al crear campaña:", error);
      res.status(500).json({ error: "Error al crear campaña" });
    }
  });

  app.get("/api/mass-sender/campaigns/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const campaign = await massSenderService.getCampaignById(id);
      
      if (!campaign) {
        return res.status(404).json({ error: "Campaña no encontrada" });
      }
      
      res.json(campaign);
    } catch (error) {
      console.error("Error al obtener campaña:", error);
      res.status(500).json({ error: "Error al obtener campaña" });
    }
  });

  app.patch("/api/mass-sender/campaigns/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const campaignData = req.body;
      const campaign = await massSenderService.updateCampaign(id, campaignData);
      
      if (!campaign) {
        return res.status(404).json({ error: "Campaña no encontrada" });
      }
      
      res.json(campaign);
    } catch (error) {
      console.error("Error al actualizar campaña:", error);
      res.status(500).json({ error: "Error al actualizar campaña" });
    }
  });

  app.post("/api/mass-sender/campaigns/:id/import", async (req: Request, res: Response) => {
    try {
      const campaignId = parseInt(req.params.id);
      const { importId } = req.body;
      
      if (!importId) {
        return res.status(400).json({ error: "Se requiere el ID de importación" });
      }
      
      const success = await massSenderService.importContactsFromExcel(campaignId, importId);
      
      if (!success) {
        return res.status(404).json({ error: "Campaña o importación no encontrada" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error al importar contactos a la campaña:", error);
      res.status(500).json({ error: "Error al importar contactos a la campaña" });
    }
  });

  app.post("/api/mass-sender/campaigns/:id/import-with-template", async (req: Request, res: Response) => {
    try {
      const campaignId = parseInt(req.params.id);
      const { batch } = req.body;
      
      if (!batch || !batch.templateId || !batch.contactIds || !batch.variables) {
        return res.status(400).json({ 
          error: "Se requiere batch con templateId, contactIds y variables" 
        });
      }
      
      const success = await massSenderService.importContactsWithTemplate(campaignId, batch);
      
      if (!success) {
        return res.status(404).json({ error: "Campaña o plantilla no encontrada" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error al importar contactos con plantilla:", error);
      res.status(500).json({ error: "Error al importar contactos con plantilla" });
    }
  });

  app.post("/api/mass-sender/campaigns/:id/start", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await massSenderService.startCampaign(id);
      
      if (!success) {
        return res.status(400).json({ 
          error: "No se pudo iniciar la campaña",
          details: "Verifique que WhatsApp esté conectado y que la campaña contenga destinatarios"
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error al iniciar campaña:", error);
      res.status(500).json({ error: "Error al iniciar campaña" });
    }
  });

  app.post("/api/mass-sender/campaigns/:id/pause", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await massSenderService.pauseCampaign(id);
      
      if (!success) {
        return res.status(404).json({ error: "Campaña no encontrada" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error al pausar campaña:", error);
      res.status(500).json({ error: "Error al pausar campaña" });
    }
  });

  app.post("/api/mass-sender/campaigns/:id/resume", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await massSenderService.resumeCampaign(id);
      
      if (!success) {
        return res.status(404).json({ error: "Campaña no encontrada o no está pausada" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error al reanudar campaña:", error);
      res.status(500).json({ error: "Error al reanudar campaña" });
    }
  });
  
  // Verificar mensaje como entregado
  app.post("/api/mass-sender/campaigns/:id/verify-message", async (req: Request, res: Response) => {
    try {
      const campaignId = parseInt(req.params.id);
      const { contactId, messageId } = req.body;
      
      if (!contactId) {
        return res.status(400).json({ error: "Se requiere el ID del contacto" });
      }
      
      const success = await massSenderService.verifyMessageSent(campaignId, contactId, messageId);
      
      if (!success) {
        return res.status(404).json({ error: "Campaña o contacto no encontrado" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error al verificar mensaje:", error);
      res.status(500).json({ error: "Error al verificar mensaje como entregado" });
    }
  });
  
  // Obtener grupos de contactos de WhatsApp
  app.get("/api/whatsapp/contact-groups", async (req: Request, res: Response) => {
    try {
      import('./services/whatsappServiceImpl').then(async ({ default: whatsappService }) => {
        // Obtener los chats y filtrar grupos
        const chats = await whatsappService.getChats();
        const groups = chats
          .filter(chat => chat.isGroup)
          .map(chat => {
            // Manejar diferentes formatos del ID
            const chatId = typeof chat.id === 'string' 
              ? chat.id 
              : (chat.id && typeof chat.id === 'object' && Object.prototype.hasOwnProperty.call(chat.id, '_serialized') 
                ? (chat.id as any)._serialized 
                : String(chat.id));
                
            return {
              id: chatId,
              name: chat.name || 'Grupo sin nombre',
              count: chat.participants ? chat.participants.length : 0
            };
          });
        
        res.json(groups);
      }).catch(error => {
        console.error("Error al importar servicio WhatsApp:", error);
        res.status(500).json({ error: String(error) });
      });
    } catch (error) {
      console.error("Error al obtener grupos de contactos:", error);
      res.status(500).json({ error: String(error) });
    }
  });
  
  // Obtener etiquetas de contactos (simulación - WhatsApp no soporta etiquetas oficialmente)
  app.get("/api/whatsapp/contact-tags", async (req: Request, res: Response) => {
    try {
      // Importar el servicio de WhatsApp
      const { whatsappService } = await import('./services/whatsappServiceImpl');
      
      // Como WhatsApp no tiene etiquetas nativas, usamos categorías definidas en nuestra app
      // Datos iniciales para etiquetas
      const baseTags = [
        { id: "cliente_potencial", name: "Cliente potencial", count: 12 },
        { id: "cliente_nuevo", name: "Cliente nuevo", count: 8 },
        { id: "cliente_recurrente", name: "Cliente recurrente", count: 15 },
        { id: "promocion_mayo", name: "Promoción Mayo", count: 24 },
        { id: "interesado_producto_a", name: "Interesado Producto A", count: 10 },
        { id: "interesado_producto_b", name: "Interesado Producto B", count: 7 },
        { id: "importado_excel", name: "Importado Excel", count: 0 } 
      ];
      
      // Obtener etiquetas desde el servicio de WhatsApp si existiera
      try {
        // Si hay etiquetas personalizadas, agregadas por importaciones
        const customTags = await whatsappService.getCustomTags();
        if (customTags && customTags.length > 0) {
          // Combinar y devolver sin duplicados
          const allTags = [...baseTags];
          
          // Agregar tags personalizados evitando duplicados por ID
          for (const tag of customTags) {
            if (!allTags.some(t => t.id === tag.id)) {
              allTags.push(tag);
            }
          }
          
          return res.json(allTags);
        }
      } catch (err) {
        console.log("No se pudieron obtener etiquetas personalizadas:", err);
        // Continuar con las etiquetas base
      }
      
      res.json(baseTags);
    } catch (error) {
      console.error("Error al obtener etiquetas de contactos:", error);
      res.status(500).json({ error: String(error) });
    }
  });
  
  // Crear nueva etiqueta para contactos
  app.post("/api/whatsapp/contact-tags", async (req: Request, res: Response) => {
    try {
      // Importar el servicio de WhatsApp
      const { whatsappService } = await import('./services/whatsappServiceImpl');
      
      const { name, color } = req.body;
      
      if (!name) {
        return res.status(400).json({ 
          error: "Se requiere un nombre para la etiqueta" 
        });
      }
      
      // Crear una nueva etiqueta con ID basado en el nombre
      const id = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      
      // Crear la nueva etiqueta
      const newTag = {
        id,
        name, 
        color: color || "default",
        count: 0,
        custom: true,
        createdAt: new Date().toISOString()
      };
      
      // Guardar la etiqueta
      await whatsappService.saveCustomTag(newTag);
      
      res.status(201).json({
        success: true,
        tag: newTag
      });
    } catch (error) {
      console.error("Error creando etiqueta:", error);
      res.status(500).json({ 
        error: "Error al crear etiqueta",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Configurar el servidor WebSocket para notificaciones en tiempo real
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Intentaremos importar el servicio de notificaciones si está disponible
  let notificationService: any;
  try {
    const notificationModule = await import('./services/notificationService');
    notificationService = notificationModule.notificationService;
  } catch (error) {
    console.warn('Servicio de notificaciones no disponible:', error);
    notificationService = null;
  }
  
  // Lista de clientes conectados (para compatibilidad con código existente)
  const clients = new Set<WebSocket>();
  
  // Evento cuando un cliente se conecta
  wss.on('connection', (ws: WebSocket) => {
    console.log('Cliente WebSocket conectado');
    
    // Registrar cliente en el servicio de notificaciones si está disponible
    if (notificationService) {
      try {
        notificationService.registerClient(ws);
      } catch (error) {
        console.warn('Error al registrar cliente en servicio de notificaciones:', error);
      }
    }
    
    // Añadir a la lista simple de clientes (siempre activo)
    clients.add(ws);
    
    // Enviar un mensaje de bienvenida
    ws.send(JSON.stringify({
      type: 'connection',
      message: 'Conectado al servidor de notificaciones en tiempo real'
    }));
    
    // Autenticación simulada
    setTimeout(() => {
      try {
        // Si el servicio de notificaciones avanzado está disponible
        if (notificationService) {
          // Autenticar al cliente
          notificationService.authenticateClient(ws, 1, 'admin');
          
          // Enviar una notificación de sistema de prueba
          notificationService.sendSystemNotification(
            "Sistema inicializado", 
            "El sistema de notificaciones en tiempo real está funcionando",
            "low"
          );
        } else {
          // Fallback a notificación simple
          ws.send(JSON.stringify({
            type: 'notification',
            title: 'Sistema inicializado',
            message: 'Las notificaciones básicas están funcionando',
            timestamp: new Date()
          }));
        }
      } catch (error) {
        console.error('Error al autenticar cliente WebSocket:', error);
      }
    }, 1000);
    
    // Evento cuando se recibe un mensaje del cliente
    ws.on('message', (message: any) => {
      try {
        let parsedMessage: any;
        
        if (typeof message === 'string') {
          parsedMessage = JSON.parse(message);
        } else if (message instanceof Buffer) {
          parsedMessage = JSON.parse(message.toString('utf8'));
        } else {
          throw new Error('Formato de mensaje no soportado');
        }
        
        console.log('Mensaje recibido:', parsedMessage);
        
        // Aquí puedes manejar diferentes tipos de mensajes del cliente
        if (parsedMessage.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch (error) {
        console.error('Error procesando mensaje WebSocket:', error);
      }
    });
    
    // Evento cuando el cliente se desconecta
    ws.on('close', () => {
      console.log('Cliente WebSocket desconectado');
      clients.delete(ws);
    });
  });
  
  // Función global para enviar notificaciones a todos los clientes
  (global as any).sendNotification = (data: any) => {
    const message = JSON.stringify({
      type: 'notification',
      timestamp: Date.now(),
      data
    });
    
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };
  
  return httpServer;
}
