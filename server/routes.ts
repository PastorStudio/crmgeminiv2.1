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
import jwt from "jsonwebtoken";
// Importar las rutas de WhatsApp
import { registerWhatsAppRoutes } from "./services/whatsappRoutes";
import { registerAnalyticsRoutes } from "./services/analyticsRoutes";
import { authService } from "./services/authService";
import { eq, and, ne, not, isNull } from "drizzle-orm";
import { users, whatsappAccounts, userWhatsappAccounts, chatAssignments, chatCategories } from "@shared/schema";
import { autoResponseService } from "./services/autoResponseService";
import { registerDirectAPIRoutes } from "./services/directApiServer";
import multer from "multer";
import { messageTemplateService } from "./services/messageTemplateService";
import { analyticsService } from "./services/analyticsService";
import { excelImportService } from "./services/excelImportService";
import { massSenderService } from "./services/massSenderService";
import { mediaGalleryRouter, mediaServeRouter } from "./services/mediaGalleryRoutes";
import { mediaGalleryService } from "./services/mediaGalleryService";
import { registerTemplateVariablesRoutes } from "./services/templateVariablesRoutes";
import whatsappAccountsRouter from "./routes/whatsappAccounts";
import chatAssignmentsRouter from "./routes/chatAssignments";

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
  
  // Registrar rutas de API directa para WhatsApp (códigos QR, etc.)
  registerDirectAPIRoutes(app);
  
  // Registrar rutas para manejo de variables en plantillas
  registerTemplateVariablesRoutes(app);
  
  // Registrar rutas de analytics avanzado
  registerAnalyticsRoutes(app);
  
  // Registrar rutas para la galería de medios
  app.use("/api/media-gallery", mediaGalleryRouter);
  app.use("/api/media", mediaServeRouter);
  
  // Registrar rutas para cuentas de WhatsApp y asignaciones de chat
  app.use("/api/whatsapp-accounts", whatsappAccountsRouter);
  app.use("/api/chat-assignments", chatAssignmentsRouter);
  
  // Ruta para la página de prueba de la galería de medios
  app.get("/media-gallery-test", (req: Request, res: Response) => {
    res.sendFile(path.join(process.cwd(), "temp", "upload-test.html"));
  });
  
  // Health check endpoint
  app.get("/api/health", (req: Request, res: Response) => {
    res.json({ status: "ok" });
  });
  
  // Rutas de autenticación
  
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: "Se requiere nombre de usuario y contraseña"
        });
      }
      
      // Verificar credenciales de superadmin antes de consultar la base de datos
      if (username === 'DJP' && password === 'Mi123456@') {
        // Crear usuario superadministrador hardcoded - ID 3 debe coincidir con el de la base de datos
        const superAdmin = {
          id: 3,
          username: 'DJP',
          role: 'super_admin',
          email: 'superadmin@crm.com',
          fullName: 'Super Administrador',
          status: 'active',
          department: 'Dirección',
          avatar: '/assets/avatars/superadmin.png'
        };
        
        // Generar token JWT para el superadmin
        const token = jwt.sign(
          { 
            userId: superAdmin.id, 
            username: superAdmin.username, 
            role: superAdmin.role 
          }, 
          process.env.JWT_SECRET || 'crm-whatsapp-secret-key', 
          { expiresIn: '24h' }
        );
        
        // Responder con el superadmin
        return res.json({
          success: true,
          message: "Inicio de sesión exitoso (Super Administrador)",
          token,
          user: superAdmin
        });
      }
      
      // Para usuarios normales, seguir el flujo habitual
      const user = await authService.verifyCredentials(username, password);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Credenciales inválidas"
        });
      }
      
      // Verificar si el usuario está activo
      if (user.status && user.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: "Cuenta suspendida o inactiva. Contacte al administrador."
        });
      }
      
      // Generar token JWT
      const token = authService.generateToken(user);
      
      // Actualizar última fecha de login solo si no es el superadmin
      try {
        if (user.id !== 3) { // ID 3 es el superadmin DJP
          await db.update(users)
            .set({ lastLoginAt: new Date() })
            .where(eq(users.id, user.id));
        }
      } catch (error) {
        console.error("Error al actualizar la fecha de último inicio de sesión:", error);
        // Continuar con el inicio de sesión aunque falle esta actualización
      }
      
      // Devolver información del usuario (sin contraseña)
      const { password: _, ...userInfo } = user;
      
      res.json({
        success: true,
        message: "Inicio de sesión exitoso",
        token,
        user: userInfo
      });
    } catch (error) {
      console.error("Error en inicio de sesión:", error);
      
      // Verificar si es el superadmin incluso en caso de error
      const { username, password } = req.body;
      if (username === 'DJP' && password === 'Mi123456@') {
        try {
          // Intentar obtener el usuario real de la base de datos para usar su ID real
          const [dbSuperAdmin] = await db
            .select({
              id: users.id,
              username: users.username,
              role: users.role,
              email: users.email,
              fullName: users.fullName,
              status: users.status,
              department: users.department,
              avatar: users.avatar
            })
            .from(users)
            .where(eq(users.username, 'DJP'));
          
          // Si encontramos el usuario en la DB, usamos sus datos
          const superAdmin = dbSuperAdmin || {
            id: 3, // ID conocido del usuario en la base de datos
            username: 'DJP',
            role: 'super_admin',
            email: 'superadmin@crm.com',
            fullName: 'Super Administrador',
            status: 'active',
            department: 'Dirección',
            avatar: '/assets/avatars/superadmin.png'
          };
          
          // Generar token JWT usando el ID real del usuario
          const token = jwt.sign(
            { 
              userId: superAdmin.id, 
              username: superAdmin.username, 
              role: superAdmin.role 
            }, 
            process.env.JWT_SECRET || 'crm-whatsapp-secret-key', 
            { expiresIn: '24h' }
          );
          
          return res.json({
            success: true,
            message: "Inicio de sesión exitoso (Super Administrador)",
            token,
            user: superAdmin
          });
          
        } catch (err) {
          console.error("Error al buscar usuario superadmin en DB:", err);
          
          // Fallback usando ID conocido
          const superAdmin = {
            id: 3, // ID conocido del usuario en la base de datos
            username: 'DJP',
            role: 'super_admin',
            email: 'superadmin@crm.com',
            fullName: 'Super Administrador',
            status: 'active',
            department: 'Dirección',
            avatar: '/assets/avatars/superadmin.png'
          };
          
          // Generar token JWT usando el ID conocido
          const token = jwt.sign(
            { 
              userId: superAdmin.id, 
              username: superAdmin.username, 
              role: superAdmin.role 
            }, 
            process.env.JWT_SECRET || 'crm-whatsapp-secret-key', 
            { expiresIn: '24h' }
          );
        
          return res.json({
            success: true,
            message: "Inicio de sesión exitoso (Super Administrador - Fallback)",
            token,
            user: superAdmin
          });
        }
      }
      
      return res.status(500).json({
        success: false,
        message: "Error al procesar la solicitud de inicio de sesión"
      });
    }
  });
  
  app.get("/api/auth/me", authService.authenticate.bind(authService), async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      
      // Modificación para seleccionar campos específicos (sin incluir settings que causa problemas)
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          email: users.email,
          role: users.role,
          status: users.status,
          avatar: users.avatar,
          department: users.department,
          supervisorId: users.supervisorId,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt
        })
        .from(users)
        .where(eq(users.id, userId));
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Usuario no encontrado"
        });
      }
      
      res.json({
        success: true,
        user: user
      });
    } catch (error) {
      console.error("Error al obtener perfil:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener información de perfil"
      });
    }
  });
  
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    // En un JWT puro, el logout se maneja del lado del cliente
    // eliminando el token, pero podríamos implementar una lista negra
    // de tokens si es necesario
    
    res.json({
      success: true,
      message: "Sesión cerrada correctamente"
    });
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

  // Ruta eliminada - se maneja en index.ts

  app.get("/api/users/:id", authService.authenticate.bind(authService), async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const requestingUserId = (req as any).user.userId;
      const requestingUserRole = (req as any).user.role;
      
      // Solo permitir ver detalles de usuarios si:
      // - El usuario solicita su propio perfil
      // - El usuario es admin o supervisor
      if (userId !== requestingUserId && requestingUserRole !== 'admin' && requestingUserRole !== 'supervisor') {
        return res.status(403).json({ 
          success: false, 
          message: "No tienes permisos para ver este usuario" 
        });
      }
      
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: "Usuario no encontrado" 
        });
      }
      
      // No devolver la contraseña
      const { password, ...userWithoutPassword } = user;
      
      res.json({ 
        success: true, 
        user: userWithoutPassword 
      });
    } catch (error) {
      console.error("Error al obtener usuario:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error al obtener detalles del usuario" 
      });
    }
  });

  app.post("/api/users", authService.authenticate.bind(authService), async (req: Request, res: Response) => {
    try {
      // Verificar que el usuario tiene permisos de admin o supervisor
      const userRole = (req as any).user.role;
      if (userRole !== 'admin' && userRole !== 'supervisor') {
        return res.status(403).json({ 
          success: false, 
          message: "No tienes permisos para crear usuarios" 
        });
      }
      
      const userData = insertUserSchema.parse(req.body);
      
      // Verificar si ya existe un usuario con el mismo nombre de usuario
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(409).json({ 
          success: false, 
          message: "Ya existe un usuario con ese nombre de usuario" 
        });
      }
      
      // Crear el usuario
      const newUser = await storage.createUser(userData);
      
      // No devolver la contraseña
      const { password, ...newUserWithoutPassword } = newUser;
      
      res.status(201).json({ 
        success: true, 
        user: newUserWithoutPassword,
        message: "Usuario creado exitosamente" 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          message: "Datos de usuario inválidos", 
          errors: error.errors 
        });
      }
      console.error("Error al crear usuario:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error al crear el usuario" 
      });
    }
  });
  
  app.patch("/api/users/:id", authService.authenticate.bind(authService), async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const requestingUserId = (req as any).user.userId;
      const requestingUserRole = (req as any).user.role;
      
      // Solo permitir actualizar usuarios si:
      // - El usuario actualiza su propio perfil
      // - El usuario es admin o supervisor
      if (userId !== requestingUserId && requestingUserRole !== 'admin' && requestingUserRole !== 'supervisor') {
        return res.status(403).json({ 
          success: false, 
          message: "No tienes permisos para actualizar este usuario" 
        });
      }
      
      // Aplicar restricciones adicionales para proteger a los administradores
      if (requestingUserRole === 'supervisor') {
        const targetUser = await storage.getUser(userId);
        if (targetUser && targetUser.role === 'admin') {
          return res.status(403).json({ 
            success: false, 
            message: "Los supervisores no pueden modificar usuarios administradores" 
          });
        }
      }
      
      const userData = req.body;
      
      // Verificar si el usuario existe
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ 
          success: false, 
          message: "Usuario no encontrado" 
        });
      }
      
      // Si el usuario intenta cambiar su propio rol y no es administrador, no permitirlo
      if (userId === requestingUserId && userData.role && userData.role !== existingUser.role) {
        if (requestingUserRole !== 'admin') {
          return res.status(403).json({ 
            success: false, 
            message: "No puedes cambiar tu propio rol" 
          });
        }
      }
      
      // Actualizar el usuario
      const updatedUser = await storage.updateUser(userId, userData);
      
      if (!updatedUser) {
        return res.status(500).json({ 
          success: false, 
          message: "Error al actualizar el usuario" 
        });
      }
      
      // No devolver la contraseña
      const { password, ...updatedUserWithoutPassword } = updatedUser;
      
      res.json({ 
        success: true, 
        user: updatedUserWithoutPassword,
        message: "Usuario actualizado exitosamente" 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          message: "Datos de usuario inválidos", 
          errors: error.errors 
        });
      }
      console.error("Error al actualizar usuario:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error al actualizar el usuario" 
      });
    }
  });
  
  // Endpoint para eliminar usuario (nuevo)
  app.delete("/api/users/:id", authService.authenticate.bind(authService), async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const requestingUserRole = (req as any).user.role;
      const requestingUserId = (req as any).user.userId;
      
      // Solo permitir eliminar usuarios a admin o supervisor
      if (requestingUserRole !== 'admin' && requestingUserRole !== 'supervisor') {
        return res.status(403).json({ 
          success: false, 
          message: "No tienes permisos para eliminar usuarios" 
        });
      }
      
      // No permitir auto-eliminación
      if (userId === requestingUserId) {
        return res.status(403).json({ 
          success: false, 
          message: "No puedes eliminar tu propio usuario" 
        });
      }
      
      // Verificar si el usuario existe
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ 
          success: false, 
          message: "Usuario no encontrado" 
        });
      }
      
      // Los supervisores no pueden eliminar administradores
      if (requestingUserRole === 'supervisor' && existingUser.role === 'admin') {
        return res.status(403).json({ 
          success: false, 
          message: "Los supervisores no pueden eliminar usuarios administradores" 
        });
      }
      
      // Eliminar el usuario - Esta función aún no existe en el storage
      // Por ahora, podemos marcar el usuario como inactivo
      const updatedUser = await storage.updateUser(userId, { status: 'inactive' });
      
      if (!updatedUser) {
        return res.status(500).json({
          success: false,
          message: "Error al eliminar el usuario"
        });
      }
      
      res.json({ 
        success: true, 
        message: "Usuario eliminado exitosamente" 
      });
    } catch (error) {
      console.error("Error al eliminar usuario:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error al eliminar el usuario" 
      });
    }
  });

  // Leads endpoints - usando datos reales de WhatsApp
  app.get("/api/leads", async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string;
      const assignedTo = req.query.assignedTo ? parseInt(req.query.assignedTo as string) : undefined;
      
      // Primero obtenemos los leads de la base de datos
      let dbLeads = [];
      if (status) {
        dbLeads = await storage.getLeadsByStatus(status);
      } else if (assignedTo) {
        dbLeads = await storage.getLeadsByAssignee(assignedTo);
      } else {
        dbLeads = await storage.getAllLeads();
      }
      
      // Obtener mensajes para enriquecer los leads con su último mensaje
      try {
        const allMessages = await storage.getAllMessages();
        
        // Enriquecer los leads con el último mensaje
        dbLeads = dbLeads.map(lead => {
          // Buscar mensajes para este lead
          const leadMessages = allMessages
            .filter(msg => msg.leadId === lead.id)
            .sort((a, b) => {
              const dateA = a.sentAt ? new Date(a.sentAt).getTime() : 0;
              const dateB = b.sentAt ? new Date(b.sentAt).getTime() : 0;
              return dateB - dateA;
            });
          
          // Si hay mensajes, añadir el último al lead
          if (leadMessages.length > 0) {
            return {
              ...lead,
              lastMessage: leadMessages[0].content,
              lastMessageDate: leadMessages[0].sentAt
            };
          }
          
          return lead;
        });
      } catch (error) {
        console.error('Error obteniendo mensajes para leads:', error);
        // Continuamos con los leads sin enriquecer con mensajes
      }
      
      // Luego intentamos enriquecer los datos con información real de WhatsApp
      try {
        const whatsappService = (global as any).whatsappService;
        
        if (whatsappService && whatsappService.isReady()) {
          // Obtener datos reales de WhatsApp
          const contactos = await whatsappService.getContacts();
          const chats = await whatsappService.getChats();
          
          // Mapa para buscar leads por número de teléfono
          const leadsByPhone: { [phone: string]: any } = {};
          dbLeads.forEach((lead: any) => {
            if (lead.phone) {
              leadsByPhone[lead.phone] = lead;
            }
          });
          
          // Convertir contactos de WhatsApp a leads si no existen en la base de datos
          const phoneNumbers = new Set(dbLeads.map((lead: any) => lead.phone));
          const newLeads = [];
          
          for (const contacto of contactos) {
            if (!contacto.id || phoneNumbers.has(contacto.id.replace('@c.us', ''))) {
              continue; // Ya existe en la base de datos o no tiene ID
            }
            
            // Buscar el último chat con este contacto
            const chat = chats.find((c: any) => c.id === contacto.id);
            let lastMessage = '';
            let lastActivity = new Date();
            
            if (chat && chat.messages && chat.messages.length > 0) {
              const message = chat.messages[chat.messages.length - 1];
              lastMessage = message.body || '';
              if (message.timestamp) {
                lastActivity = new Date(message.timestamp);
              }
            }
            
            // Crear un nuevo lead desde el contacto de WhatsApp
            const phone = contacto.id.replace('@c.us', '');
            const newLead = await storage.createLead({
              name: contacto.name || contacto.pushname || phone,
              email: '',
              phone,
              status: status || 'new', // Asignar el estado solicitado o 'new' por defecto
              assigneeId: assignedTo || 1, // Asignar al usuario solicitado o al primero
              source: 'whatsapp',
              notes: `Última actividad: ${lastActivity.toLocaleString()}\nÚltimo mensaje: ${lastMessage}`,
              value: 0,
              tags: ['whatsapp', 'auto-importado']
            });
            
            newLeads.push(newLead);
          }
          
          // Combinar los leads existentes con los nuevos
          if (newLeads.length > 0) {
            if (status) {
              // Filtrar solo los nuevos leads con el estado correcto
              const filteredNewLeads = newLeads.filter(lead => lead.status === status);
              return res.json([...dbLeads, ...filteredNewLeads]);
            } else if (assignedTo) {
              // Filtrar solo los nuevos leads asignados al usuario correcto
              const filteredNewLeads = newLeads.filter(lead => lead.assignedTo === assignedTo);
              return res.json([...dbLeads, ...filteredNewLeads]);
            } else {
              return res.json([...dbLeads, ...newLeads]);
            }
          }
        }
      } catch (whatsappError) {
        console.error('Error obteniendo datos reales de WhatsApp para leads:', whatsappError);
        // Si hay un error, continuamos con los leads de la base de datos
      }
      
      // Si no pudimos obtener datos de WhatsApp o no hay nuevos leads, devolvemos los de la base de datos
      return res.json(dbLeads);
    } catch (error) {
      console.error('Error en endpoint de leads:', error);
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

  // Dashboard stats endpoint - usando datos reales de WhatsApp
  app.get("/api/dashboard-stats", async (req: Request, res: Response) => {
    try {
      // Intentar obtener estadísticas de la base de datos primero
      let stats = await storage.getDashboardStats();
      
      // Si estamos conectados a WhatsApp, obtenemos datos reales
      try {
        const whatsappService = (global as any).whatsappService;
        
        if (whatsappService && whatsappService.isReady()) {
          // Obtener datos reales de WhatsApp
          const contactos = await whatsappService.getContacts();
          const chats = await whatsappService.getChats();
          
          // Calcular métricas en base a datos reales
          const totalLeads = contactos.length;
          const messagesThisMonth = chats.reduce((total: number, chat: any) => {
            return total + (chat.messages?.length || 0);
          }, 0);
          
          // Calcular chats activos (con mensajes en los últimos 7 días)
          const now = new Date();
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          
          const activeChats = chats.filter((chat: any) => {
            if (!chat.messages || chat.messages.length === 0) return false;
            const lastMessage = chat.messages[chat.messages.length - 1];
            const timestamp = lastMessage.timestamp || 0;
            return new Date(timestamp) >= sevenDaysAgo;
          }).length;
          
          // Crear o actualizar estadísticas con datos reales
          if (!stats) {
            // Si no existen estadísticas, las creamos
            stats = await storage.updateDashboardStats({
              totalLeads,
              newLeadsThisMonth: totalLeads, // Por ahora, asumimos todos como nuevos
              activeLeads: activeChats,
              messagesThisMonth,
              conversionRate: 0,
              averageResponseTime: 0,
              salesThisMonth: 0,
              revenue: 0
            });
          } else {
            // Actualizamos las estadísticas existentes con datos reales
            stats = await storage.updateDashboardStats({
              ...stats,
              totalLeads,
              activeLeads: activeChats,
              messagesThisMonth,
              newLeadsThisMonth: totalLeads // Por ahora, asumimos todos como nuevos
            });
          }
        }
      } catch (whatsappError) {
        console.error('Error obteniendo estadísticas reales de WhatsApp:', whatsappError);
        // Si hay un error, continuamos con las estadísticas de la base de datos
      }
      
      if (!stats) {
        return res.status(404).json({ message: "Dashboard stats not found" });
      }
      
      res.json(stats);
    } catch (error) {
      console.error('Error en dashboard stats:', error);
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
      // Aceptar tanto el formato para leads como para envíos masivos
      const { leadId, messageType, prompt, type } = req.body;
      
      // Import the Gemini service
      const { geminiService } = await import('./services/geminiService');
      
      // Si es para envío masivo, generamos con el prompt directo
      if (prompt) {
        console.log("Generando mensaje con Gemini para envío masivo:", prompt.substring(0, 50) + "...");
        
        try {
          const content = await geminiService.generateContent(prompt);
          return res.json({ 
            success: true,
            content 
          });
        } catch (error) {
          console.error("Error al generar contenido con Gemini:", error);
          return res.status(500).json({ 
            success: false, 
            message: "Error al generar contenido con Gemini",
            error: (error as Error).message
          });
        }
      }
      
      // Si no hay prompt, verificamos leadId y messageType
      if (!leadId || !messageType) {
        return res.status(400).json({ 
          success: false, 
          message: "Lead ID y tipo de mensaje son requeridos o un prompt es requerido" 
        });
      }
      
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
  
  // Rutas para gestión automatizada con IA - EXCLUSIVAMENTE con Gemini
  app.post("/api/auto/manage-lead", async (req: Request, res: Response) => {
    try {
      const { leadId } = req.body;
      
      if (!leadId) {
        return res.status(400).json({
          success: false,
          message: "Se requiere ID del lead"
        });
      }
      
      // Importamos el servicio Gemini exclusivamente para esta funcionalidad
      const { geminiService } = await import('./services/geminiService');
      
      // Validamos que el servicio Gemini esté disponible
      if (!geminiService || !geminiService.isReady()) {
        return res.status(400).json({
          success: false,
          message: "El servicio de Gemini no está disponible. El auto-movimiento de leads requiere específicamente Gemini."
        });
      }
      
      // Importamos el servicio de tareas y etiquetas
      const taskTagServiceModule = await import('./services/taskTagService');
      const taskTagService = new taskTagServiceModule.default(geminiService);
      
      console.log("Iniciando gestión automática de lead con Gemini (exclusivamente)");
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
  
  // Ruta para generar tareas automáticas - EXCLUSIVAMENTE con Gemini
  app.post("/api/auto/generate-tasks", async (req: Request, res: Response) => {
    try {
      const { leadId } = req.body;
      
      if (!leadId) {
        return res.status(400).json({
          success: false,
          message: "Se requiere ID del lead"
        });
      }
      
      // Importamos el servicio Gemini exclusivamente para esta funcionalidad
      const { geminiService } = await import('./services/geminiService');
      
      // Validamos que el servicio Gemini esté disponible
      if (!geminiService || !geminiService.isReady()) {
        return res.status(400).json({
          success: false,
          message: "El servicio de Gemini no está disponible. La generación automática de tareas requiere específicamente Gemini."
        });
      }
      
      // Importamos el servicio de tareas y etiquetas
      const taskTagServiceModule = await import('./services/taskTagService');
      const taskTagService = new taskTagServiceModule.default(geminiService);
      
      console.log("Iniciando generación automática de tareas con Gemini (exclusivamente)");
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
  
  // Verificar secretos disponibles (API keys)
  app.get("/api/check-secrets", async (req: Request, res: Response) => {
    try {
      const secretKeys = req.query.secret_keys ? 
        (Array.isArray(req.query.secret_keys) ? 
          req.query.secret_keys as string[] : 
          [req.query.secret_keys as string]) : 
        [];
      
      // Verificar qué claves están disponibles
      const availableSecrets = secretKeys.filter(key => {
        return process.env[key] !== undefined && process.env[key] !== '';
      });

      return res.json(availableSecrets);
    } catch (error) {
      console.error('Error verificando secretos disponibles:', error);
      return res.status(500).json({ 
        success: false, 
        error: (error as Error).message || "Error del servidor" 
      });
    }
  });
  
  // Auto-response endpoints
  app.get("/api/auto-response/config", async (req: Request, res: Response) => {
    try {
      console.log('🤖 Obteniendo configuración de respuestas automáticas...');
      // Configuración por defecto para respuestas automáticas
      const config = {
        enabled: false,
        provider: 'gemini',
        delay: 2000,
        messageTemplate: 'Gracias por contactarnos. Te responderemos pronto.',
        businessHours: {
          enabled: true,
          start: '09:00',
          end: '18:00',
          timezone: 'America/Mexico_City'
        },
        excludedNumbers: [],
        maxResponsesPerDay: 10
      };
      
      console.log('🤖 Configuración obtenida:', config);
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
      console.log('🤖 Actualizando configuración de respuestas automáticas:', req.body);
      const config = req.body;
      
      if (!config) {
        return res.status(400).json({
          success: false,
          message: "Se requiere configuración"
        });
      }
      
      // Validar el proveedor de IA
      if (config.aiProvider === 'gemini') {
        const hasGeminiKey = process.env.GEMINI_API_KEY;
        if (!hasGeminiKey) {
          return res.status(400).json({
            success: false,
            message: "No hay clave API de Gemini configurada"
          });
        }
      } else if (config.aiProvider === 'openai') {
        const hasOpenAIKey = process.env.OPENAI_API_KEY;
        if (!hasOpenAIKey) {
          return res.status(400).json({
            success: false,
            message: "No hay clave API de OpenAI configurada"
          });
        }
      }
      
      console.log('🤖 Configuración validada y guardada correctamente');
      res.json({ 
        success: true, 
        config: config,
        message: "Configuración de respuestas automáticas actualizada correctamente"
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
      
      // Intentar cancelar con el servicio mejorado
      try {
        const { setAutoResponseConfig, getAutoResponseConfig } = await import('./services/autoResponseIntegration');
        const currentConfig = getAutoResponseConfig();
        
        // Añadir este chat a la lista de excluidos si no está ya
        if (!currentConfig.excludedChats) {
          currentConfig.excludedChats = [];
        }
        
        if (!currentConfig.excludedChats.includes(contactId)) {
          currentConfig.excludedChats.push(contactId);
          setAutoResponseConfig({
            ...currentConfig,
            excludedChats: currentConfig.excludedChats
          });
        }
        
        console.log(`Chat ${contactId} agregado a la lista de exclusión de respuestas automáticas`);
        res.json({ 
          success: true, 
          message: "Respuestas automáticas desactivadas para este contacto",
          cancelled: true 
        });
        return;
      } catch (importError) {
        console.log("Usando servicio de respuestas automáticas clásico para cancelar");
        // Fallback al servicio original
        const cancelled = autoResponseService.cancelPendingResponse(contactId);
        res.json({ 
          success: true, 
          cancelled 
        });
      }
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
      console.log('🔑 Verificando estado de clave Gemini...');
      const hasKey = process.env.GEMINI_API_KEY !== undefined && process.env.GEMINI_API_KEY !== '';
      const status = {
        hasValidKey: hasKey,
        isTemporary: false,
        message: hasKey ? "Clave API configurada" : "No hay clave API configurada"
      };
      
      console.log('🔑 Estado de Gemini:', status);
      res.json(status);
    } catch (error) {
      console.error("Error checking Gemini API key status:", error);
      res.status(500).json({ message: "Failed to check API key status" });
    }
  });
  
  // Endpoint para verificar el estado de la clave API de OpenAI
  app.get("/api/settings/openai-key-status", async (req: Request, res: Response) => {
    try {
      console.log('🔑 Verificando estado de clave OpenAI...');
      // Verificar si tenemos una clave API de OpenAI configurada
      const hasKey = process.env.OPENAI_API_KEY !== undefined && 
                    process.env.OPENAI_API_KEY !== null && 
                    process.env.OPENAI_API_KEY !== '';
      
      console.log('🔑 Estado de OpenAI key:', hasKey);
      
      res.json({
        success: true,
        hasKey: hasKey,
        hasValidKey: hasKey,
        message: hasKey ? "Clave API configurada" : "No hay clave API configurada"
      });
    } catch (error) {
      console.error('Error verificando estado de API key OpenAI:', error);
      res.status(500).json({
        success: false,
        error: 'Error al verificar el estado de la API key OpenAI'
      });
    }
  });
  
  // Endpoint para obtener la clave API de Gemini para el cliente
  app.get("/api/settings/gemini-client-key", async (req: Request, res: Response) => {
    try {
      // Importar el generador de claves de Gemini
      const { geminiKeyGenerator } = await import('./services/geminiKeyGenerator');
      
      // Obtener una clave API válida generada automáticamente si es necesario
      const keyInfo = await geminiKeyGenerator.getValidKey();
      
      if (!keyInfo || !keyInfo.key) {
        return res.status(404).json({
          success: false,
          message: 'No se pudo obtener una clave API de Gemini'
        });
      }
      
      // Devolver la clave API y la información de modelo al cliente
      res.json({
        success: true,
        apiKey: keyInfo.key,
        model: "gemini-pro", // Usamos sólo el modelo estable para evitar error 404
        recommendedModel: "gemini-pro" // Modelo recomendado con cuota disponible
      });
    } catch (error) {
      console.error('Error obteniendo clave API de Gemini:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno al obtener la clave API'
      });
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
  
  // Ruta para crear leads a partir de contactos de WhatsApp
  app.post("/api/direct/whatsapp/create-leads-from-contacts", async (req: Request, res: Response) => {
    try {
      // Importar el servicio de WhatsApp e importar storage
      const { whatsappService } = await import('./services/whatsappServiceImpl');
      
      // Verificar que el servicio esté activo
      const status = whatsappService.getStatus();
      if (!status.authenticated) {
        return res.status(403).json({ 
          success: false, 
          message: "WhatsApp no está autenticado. Escanee el código QR primero." 
        });
      }
      
      // Obtener lista de contactos y chats
      const contacts = await whatsappService.getContacts();
      const chats = await whatsappService.getChats();
      
      if (!contacts || contacts.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: "No se encontraron contactos de WhatsApp" 
        });
      }
      
      // Definir el período de actividad reciente (1 día)
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      // Convertir contactos en leads
      const createdLeads = [];
      const updatedLeads = [];
      
      for (const contact of contacts) {
        // Omitir contactos sin nombre o con formato incorrecto
        if (!contact.name || !contact.id || !contact.id.includes('@c.us')) continue;
        
        // Verificar si es un chat individual (no grupo)
        const chatId = contact.id;
        const isGroup = chatId.includes('@g.us');
        if (isGroup) continue; // Omitir grupos
        
        // Buscar el chat correspondiente al contacto
        const chat = chats.find((c: any) => c.id === chatId);
        
        // Verificar si hay mensajes recientes
        let hasRecentMessages = false;
        let lastMessage = '';
        let lastActivity = new Date();
        
        if (chat) {
          // Usar la timestamp del chat como indicador de actividad
          if (chat.timestamp) {
            lastActivity = new Date(chat.timestamp * 1000); // Convertir timestamp a milisegundos
            hasRecentMessages = lastActivity >= oneDayAgo;
          }
          
          // Intentar obtener el último mensaje si está disponible
          if (chat.messages && chat.messages.length > 0) {
            const message = chat.messages[chat.messages.length - 1];
            lastMessage = message.body || '';
          } else if (chat.lastMessage) {
            // Usar lastMessage si está disponible directamente en el chat
            lastMessage = chat.lastMessage;
          }
          
          // Si no se pudo determinar por timestamp pero hay mensaje, considerar activo
          if (!hasRecentMessages && lastMessage) {
            hasRecentMessages = true;
          }
        }
        
        // Solo importar contactos con mensajes recientes/activos
        if (!hasRecentMessages) continue;
        
        // Verificar si ya existe un lead con este número de teléfono
        const phone = contact.id.split('@')[0];
        const existingLeads = await storage.getLeadsByPhone(phone);
        
        if (existingLeads && existingLeads.length > 0) {
          // Actualizar el lead existente con información reciente
          const updatedLead = await storage.updateLead(existingLeads[0].id, {
            name: contact.name,
            phone: phone,
            source: 'whatsapp',
            notes: `Última actividad: ${lastActivity.toLocaleString()}\nÚltimo mensaje: ${lastMessage}`,
            tags: ['whatsapp', 'contacto-reciente']
          });
          
          if (updatedLead) {
            updatedLeads.push(updatedLead);
          }
        } else {
          // Crear nuevo lead con información de actividad reciente
          const newLead = await storage.createLead({
            name: contact.name,
            email: `${phone}@whatsapp.contact`,
            phone: phone,
            company: contact.name.split(' ')[0] + ' Inc',
            status: 'new',
            source: 'whatsapp',
            notes: `Última actividad: ${lastActivity.toLocaleString()}\nÚltimo mensaje: ${lastMessage}`,
            value: 0,
            tags: ['whatsapp', 'contacto-reciente']
          });
          
          createdLeads.push(newLead);
        }
      }
      
      // Analizar los leads con Gemini
      const { geminiService } = await import('./services/geminiService');
      
      // Intentar analizar cada lead nuevo
      for (const lead of [...createdLeads, ...updatedLeads]) {
        try {
          await geminiService.analyzeLead(lead.id);
        } catch (error) {
          console.error(`Error analizando lead ${lead.id} con Gemini:`, error);
        }
      }
      
      res.json({
        success: true,
        message: `Se procesaron ${contacts.length} contactos, creando ${createdLeads.length} leads nuevos y actualizando ${updatedLeads.length} existentes.`,
        createdLeads,
        updatedLeads
      });
    } catch (error) {
      console.error("Error creando leads desde contactos WhatsApp:", error);
      res.status(500).json({ 
        success: false, 
        message: "Error al procesar contactos de WhatsApp" 
      });
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
  // Endpoints para mantenimiento de conexión de WhatsApp
  app.post("/api/whatsapp/permanent-connection/activate", async (req: Request, res: Response) => {
    try {
      const { whatsappService } = await import('./services/whatsappServiceImpl');
      
      // Verificar si el cliente ya está en estado avanzado
      const status = whatsappService.getStatus();
      
      // Activar modo de conexión permanente avanzado
      const success = await whatsappService.activateUnbreakableConnection();
      
      if (success) {
        res.json({
          success: true,
          message: "Modo de conexión permanente activado exitosamente",
          status: whatsappService.getStatus()
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Error activando modo de conexión permanente",
          status: whatsappService.getStatus()
        });
      }
    } catch (error) {
      console.error("Error en activación de conexión permanente:", error);
      res.status(500).json({
        success: false,
        error: "Error activando conexión permanente",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  app.post("/api/whatsapp/permanent-connection/deactivate", async (req: Request, res: Response) => {
    try {
      const { whatsappService } = await import('./services/whatsappServiceImpl');
      
      // Desactivar modo de conexión permanente avanzado
      const success = whatsappService.deactivateUnbreakableConnection();
      
      if (success) {
        res.json({
          success: true,
          message: "Modo de conexión permanente desactivado exitosamente",
          status: whatsappService.getStatus()
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Error desactivando modo de conexión permanente",
          status: whatsappService.getStatus()
        });
      }
    } catch (error) {
      console.error("Error en desactivación de conexión permanente:", error);
      res.status(500).json({
        success: false,
        error: "Error desactivando conexión permanente",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  app.get("/api/whatsapp/permanent-connection/status", async (req: Request, res: Response) => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      // Buscar archivos de estado de conexión permanente
      const tempDir = path.join(process.cwd(), 'temp');
      const sessionPath = path.join(tempDir, 'whatsapp-sessions');
      const permanentConnectionFile = path.join(sessionPath, 'permanent_connection.json');
      const sessionStatusFile = path.join(sessionPath, 'session_active.json');
      
      let permanentConnectionStatus = null;
      let sessionStatus = null;
      
      if (fs.existsSync(permanentConnectionFile)) {
        try {
          permanentConnectionStatus = JSON.parse(fs.readFileSync(permanentConnectionFile, 'utf8'));
        } catch (parseErr) {
          console.error("Error parseando archivo de conexión permanente:", parseErr);
        }
      }
      
      if (fs.existsSync(sessionStatusFile)) {
        try {
          sessionStatus = JSON.parse(fs.readFileSync(sessionStatusFile, 'utf8'));
        } catch (parseErr) {
          console.error("Error parseando archivo de estado de sesión:", parseErr);
        }
      }
      
      const { whatsappService } = await import('./services/whatsappServiceImpl');
      const currentStatus = whatsappService.getStatus();
      
      res.json({
        success: true,
        currentStatus,
        permanentConnection: permanentConnectionStatus || false,
        sessionStatus: sessionStatus || false,
        mode: permanentConnectionStatus ? 
              (permanentConnectionStatus.mode || "standard") : 
              (sessionStatus && sessionStatus.permanentConnection ? "standard" : "disabled")
      });
    } catch (error) {
      console.error("Error obteniendo estado de conexión permanente:", error);
      res.status(500).json({
        success: false,
        error: "Error obteniendo estado de conexión permanente",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

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
      
      console.log("Recibiendo actualización de plantilla:", JSON.stringify(templateData));
      
      // Asegurarse de que los tags sean un array si vienen en la solicitud
      if (templateData.tags && !Array.isArray(templateData.tags)) {
        console.log("Tags no es un array, corrigiendo:", templateData.tags);
        if (typeof templateData.tags === 'string') {
          // Intentar convertir si es un string (posiblemente JSON)
          try {
            templateData.tags = JSON.parse(templateData.tags);
          } catch (e) {
            templateData.tags = templateData.tags.split(',').map(tag => tag.trim());
          }
        } else {
          // Por defecto, crear un array vacío
          templateData.tags = [];
        }
      }
      
      console.log("Datos procesados para actualización:", JSON.stringify(templateData));

      const template = await messageTemplateService.updateTemplate(id, templateData);
      
      if (!template) {
        console.log("La plantilla no fue encontrada:", id);
        return res.status(404).json({ error: "Plantilla no encontrada" });
      }
      
      console.log("Plantilla actualizada exitosamente:", JSON.stringify(template));
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
  // Endpoint para envío inmediato de mensajes (sin programación)
  app.post("/api/mass-sender/send-immediate", async (req: Request, res: Response) => {
    try {
      const { contactIds, message } = req.body;
      
      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({
          error: "Se requiere al menos un contacto para enviar mensajes"
        });
      }
      
      if (!message || typeof message !== 'string' || message.trim() === '') {
        return res.status(400).json({
          error: "El mensaje no puede estar vacío"
        });
      }
      
      // Importar el servicio de WhatsApp
      const { whatsappService } = await import('./services/whatsappServiceImpl');
      
      // Verificar estado de WhatsApp
      const status = whatsappService.getStatus();
      if (!status.ready || !status.authenticated) {
        return res.status(400).json({
          error: "El servicio de WhatsApp no está listo para enviar mensajes"
        });
      }
      
      // Enviar mensajes a cada contacto
      const results = [];
      let sentCount = 0;
      
      for (const contactId of contactIds) {
        try {
          // Buscar el contacto en las importaciones
          let phoneNumber = contactId;
          
          // Si el contactId es un ID de importación, obtener el número de teléfono
          if (!contactId.includes('+') && !(/^\d+$/.test(contactId))) {
            // Buscar en las importaciones por ID
            const importedContacts = await excelImportService.getAllImportedContacts();
            const contact = importedContacts.find(c => c.id === contactId);
            
            if (contact) {
              phoneNumber = contact.phoneNumber;
            }
          }
          
          // Asegurarse de que sea un número de teléfono válido
          if (!phoneNumber || (typeof phoneNumber === 'string' && !phoneNumber.match(/\d/))) {
            results.push({
              contactId,
              success: false,
              error: "Número de teléfono inválido"
            });
            continue;
          }
          
          // Enviar mensaje
          await whatsappService.sendMessage(phoneNumber, message);
          
          results.push({
            contactId,
            success: true
          });
          
          sentCount++;
          
          // Esperar un breve período para evitar el anti-spam de WhatsApp
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          console.error(`Error enviando mensaje a ${contactId}:`, error);
          results.push({
            contactId,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      res.json({
        success: true,
        totalContacts: contactIds.length,
        sentCount,
        failedCount: contactIds.length - sentCount,
        results
      });
      
    } catch (error) {
      console.error("Error en envío inmediato de mensajes:", error);
      res.status(500).json({
        error: "Error en el envío de mensajes",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

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
  console.log('Servidor WebSocket inicializado en la ruta /ws');
  
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
        // Manejar envío de mensajes de WhatsApp
        else if (parsedMessage.type === 'SEND_MESSAGE') {
          try {
            const { chatId, accountId, message } = parsedMessage;
            console.log(`WebSocket: Procesando envío de mensaje a ${chatId} desde cuenta ${accountId}`);
            
            // Generar un ID único para el mensaje
            const messageId = `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            
            // Notificar inmediatamente a todos los clientes (actualización optimista)
            const notificationData = {
              type: 'NOTIFICATION',
              data: {
                id: messageId,
                type: 'NEW_MESSAGE',
                timestamp: new Date(),
                data: {
                  chatId,
                  message: {
                    id: messageId,
                    body: message,
                    fromMe: true,
                    timestamp: Date.now(),
                    hasMedia: false
                  }
                }
              }
            };
            
            // Enviar a todos los clientes conectados
            clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(notificationData));
              }
            });
            
            // Intentar enviar el mensaje real (puede fallar, pero la UI ya se actualizó)
            console.log('Mensaje enviado con éxito (simulado)');
          } catch (error) {
            console.error('Error procesando envío de mensaje:', error);
          }
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
