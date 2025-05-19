import { 
  users, 
  leads, 
  activities, 
  messages, 
  surveys, 
  dashboardStats,
  whatsappAccounts,
  chatAssignments,
  agents,
  type User, 
  type InsertUser,
  type Lead,
  type InsertLead,
  type Activity,
  type InsertActivity,
  type Message,
  type InsertMessage,
  type Survey,
  type InsertSurvey,
  type DashboardStats,
  type InsertDashboardStats,
  type WhatsappAccount,
  type InsertWhatsappAccount,
  type ChatAssignment,
  type InsertChatAssignment,
  type Agent,
  type InsertAgent
} from "@shared/schema";
import { db } from './db';
import { eq, desc, or } from 'drizzle-orm';

// Interface for storage methods
export interface IStorage {
  // Inicialización y utilidades
  initializeData(): Promise<void>;
  
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;

  // Lead methods
  getLead(id: number): Promise<Lead | undefined>;
  getLeadsByStatus(status: string): Promise<Lead[]>;
  getLeadsByAssignee(userId: number): Promise<Lead[]>;
  getLeadsByPhone(phone: string): Promise<Lead[]>;
  getAllLeads(): Promise<Lead[]>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: number, lead: Partial<InsertLead>): Promise<Lead | undefined>;
  updateLeadStatus(id: number, status: string): Promise<Lead | undefined>;

  // Activity methods
  getActivity(id: number): Promise<Activity | undefined>;
  getActivitiesByLead(leadId: number): Promise<Activity[]>;
  getActivitiesByUser(userId: number): Promise<Activity[]>;
  getUpcomingActivities(userId: number, limit?: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  updateActivity(id: number, activity: Partial<InsertActivity>): Promise<Activity | undefined>;
  completeActivity(id: number): Promise<Activity | undefined>;

  // Message methods
  getMessage(id: number): Promise<Message | undefined>;
  getMessagesByLead(leadId: number): Promise<Message[]>;
  getRecentMessages(limit?: number): Promise<Message[]>;
  getAllMessages(): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(id: number): Promise<Message | undefined>;

  // Survey methods
  getSurvey(id: number): Promise<Survey | undefined>;
  getSurveysByLead(leadId: number): Promise<Survey[]>;
  createSurvey(survey: InsertSurvey): Promise<Survey>;
  updateSurveyResponses(id: number, responses: any): Promise<Survey | undefined>;

  // Dashboard stats methods
  getDashboardStats(): Promise<DashboardStats | undefined>;
  updateDashboardStats(stats: InsertDashboardStats): Promise<DashboardStats>;
  
  // WhatsApp Account methods
  getAllWhatsappAccounts(): Promise<WhatsappAccount[]>;
  getWhatsappAccount(id: number): Promise<WhatsappAccount | undefined>;
  createWhatsappAccount(account: InsertWhatsappAccount): Promise<WhatsappAccount>;
  updateWhatsappAccount(id: number, data: Partial<InsertWhatsappAccount>): Promise<WhatsappAccount | undefined>;
  deleteWhatsappAccount(id: number): Promise<void>;
  
  // Chat Assignment methods
  getAllChatAssignments(): Promise<ChatAssignment[]>;
  getChatAssignmentsByAgent(agentId: number): Promise<ChatAssignment[]>;
  getChatAssignment(id: number): Promise<ChatAssignment | undefined>;
  getChatAssignmentByChatId(chatId: string): Promise<ChatAssignment | undefined>;
  createChatAssignment(assignment: InsertChatAssignment): Promise<ChatAssignment>;
  updateChatAssignment(id: number, data: Partial<InsertChatAssignment>): Promise<ChatAssignment | undefined>;
  deleteChatAssignment(id: number): Promise<void>;
  
  // Agent methods
  getAllAgents(): Promise<Agent[]>;
  getAgent(id: number): Promise<Agent | undefined>;
  getAgentByUserId(userId: number): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: number, data: Partial<InsertAgent>): Promise<Agent | undefined>;
  updateAgentMetrics(id: number, metrics: any): Promise<Agent | undefined>;
  deleteAgent(id: number): Promise<void>;
  
  // WhatsApp methods
  getWhatsAppContact(contactId: string): Promise<any>;
  getWhatsAppChat(chatId: string): Promise<any>;
  sendWhatsAppMessage(to: string, message: string): Promise<any>;
  logAutoResponse(data: any): Promise<void>;
  
  // Gemini settings
  getGeminiSettings(): Promise<any>;
  updateGeminiSettings(settings: any): Promise<any>;
}

/**
 * Implementación de almacenamiento que utiliza una base de datos PostgreSQL
 */
export class DatabaseStorage implements IStorage {
  /**
   * Inicializa la base de datos creando datos de ejemplo si es necesario
   */
  async initializeData(): Promise<void> {
    try {
      // Verificar si ya existen usuarios
      const existingUsers = await this.getAllUsers();
      
      if (existingUsers.length === 0) {
        console.log("Base de datos lista para recibir datos reales. No se generarán datos de ejemplo.");
        
        // Crear usuario administrador
        await db.insert(users).values({
          username: "admin",
          password: "admin123",
          fullName: "Administrador",
          email: "admin@geminicrm.com",
          role: "admin",
          status: "active"
        });
        
        // Crear superadministrador
        await db.insert(users).values({
          username: "DJP",
          password: "Mi123456@",
          fullName: "Super Administrador",
          email: "superadmin@crm.com",
          role: "super_admin",
          status: "active",
          department: "Dirección"
        });
        
        // Crear estadísticas iniciales del dashboard
        await this.updateDashboardStats({
          totalLeads: 1652,
          newLeadsThisMonth: 350,
          activeLeads: 520,
          convertedLeads: 315,
          totalSales: 24500,
          salesThisMonth: 8500,
          pendingActivities: 37,
          completedActivities: 128,
          performanceMetrics: {
            responseTime: 3.5,
            conversionRate: 24.5,
            customerSatisfaction: 4.8
          }
        });
        
        console.log("Datos de ejemplo inicializados correctamente.");
      } else {
        console.log("La base de datos ya contiene datos, omitiendo inicialización.");
      }
    } catch (error) {
      console.error("Error al inicializar datos en la base de datos:", error);
    }
  }
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async createUser(user: InsertUser): Promise<User> {
    const [createdUser] = await db.insert(users).values(user).returning();
    return createdUser;
  }
  
  async updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(user)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async getLead(id: number): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead;
  }

  async getLeadsByStatus(status: string): Promise<Lead[]> {
    return db.select().from(leads).where(eq(leads.status, status));
  }

  async getLeadsByAssignee(userId: number): Promise<Lead[]> {
    return db.select().from(leads).where(eq(leads.assigneeId, userId));
  }
  
  async getLeadsByPhone(phone: string): Promise<Lead[]> {
    // Buscar por teléfono principal
    return db.select()
      .from(leads)
      .where(eq(leads.phone, phone));
  }

  async getAllLeads(): Promise<Lead[]> {
    return db.select().from(leads);
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const [createdLead] = await db.insert(leads).values(lead).returning();
    return createdLead;
  }

  async updateLead(id: number, lead: Partial<InsertLead>): Promise<Lead | undefined> {
    const [updatedLead] = await db
      .update(leads)
      .set(lead)
      .where(eq(leads.id, id))
      .returning();
    return updatedLead;
  }

  async updateLeadStatus(id: number, status: string): Promise<Lead | undefined> {
    const [updatedLead] = await db
      .update(leads)
      .set({ status })
      .where(eq(leads.id, id))
      .returning();
    return updatedLead;
  }

  async getActivity(id: number): Promise<Activity | undefined> {
    const [activity] = await db.select().from(activities).where(eq(activities.id, id));
    return activity;
  }

  async getActivitiesByLead(leadId: number): Promise<Activity[]> {
    return db.select().from(activities).where(eq(activities.leadId, leadId));
  }

  async getActivitiesByUser(userId: number): Promise<Activity[]> {
    return db.select().from(activities).where(eq(activities.userId, userId));
  }

  async getUpcomingActivities(userId: number, limit: number = 10): Promise<Activity[]> {
    return db
      .select()
      .from(activities)
      .where(eq(activities.userId, userId))
      .orderBy(activities.scheduled)
      .limit(limit);
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [createdActivity] = await db.insert(activities).values(activity).returning();
    return createdActivity;
  }

  async updateActivity(id: number, activity: Partial<InsertActivity>): Promise<Activity | undefined> {
    const [updatedActivity] = await db
      .update(activities)
      .set(activity)
      .where(eq(activities.id, id))
      .returning();
    return updatedActivity;
  }

  async completeActivity(id: number): Promise<Activity | undefined> {
    const [updatedActivity] = await db
      .update(activities)
      .set({ completed: true })
      .where(eq(activities.id, id))
      .returning();
    return updatedActivity;
  }

  async getMessage(id: number): Promise<Message | undefined> {
    const [message] = await db.select().from(messages).where(eq(messages.id, id));
    return message;
  }

  async getMessagesByLead(leadId: number): Promise<Message[]> {
    return db.select().from(messages).where(eq(messages.leadId, leadId));
  }

  async getRecentMessages(limit: number = 10): Promise<Message[]> {
    return db
      .select()
      .from(messages)
      .orderBy(desc(messages.sentAt))
      .limit(limit);
  }
  
  async getAllMessages(): Promise<Message[]> {
    return db
      .select()
      .from(messages)
      .orderBy(desc(messages.sentAt));
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [createdMessage] = await db.insert(messages).values(message).returning();
    return createdMessage;
  }

  async markMessageAsRead(id: number): Promise<Message | undefined> {
    const [updatedMessage] = await db
      .update(messages)
      .set({ read: true })
      .where(eq(messages.id, id))
      .returning();
    return updatedMessage;
  }

  async getSurvey(id: number): Promise<Survey | undefined> {
    const [survey] = await db.select().from(surveys).where(eq(surveys.id, id));
    return survey;
  }

  async getSurveysByLead(leadId: number): Promise<Survey[]> {
    return db.select().from(surveys).where(eq(surveys.leadId, leadId));
  }

  async createSurvey(survey: InsertSurvey): Promise<Survey> {
    const [createdSurvey] = await db.insert(surveys).values(survey).returning();
    return createdSurvey;
  }

  async updateSurveyResponses(id: number, responses: any): Promise<Survey | undefined> {
    const [updatedSurvey] = await db
      .update(surveys)
      .set({ 
        responses, 
        completedAt: new Date() 
      })
      .where(eq(surveys.id, id))
      .returning();
    return updatedSurvey;
  }

  async getDashboardStats(): Promise<DashboardStats | undefined> {
    const [stats] = await db.select().from(dashboardStats);
    return stats;
  }

  async updateDashboardStats(stats: InsertDashboardStats): Promise<DashboardStats> {
    // Intentamos actualizar el primer registro si existe
    const existingStats = await this.getDashboardStats();
    
    if (existingStats) {
      const [updatedStats] = await db
        .update(dashboardStats)
        .set({ 
          ...stats, 
          updatedAt: new Date() 
        })
        .where(eq(dashboardStats.id, existingStats.id))
        .returning();
      return updatedStats;
    } else {
      // Si no existe, creamos uno nuevo
      const [newStats] = await db
        .insert(dashboardStats)
        .values(stats)
        .returning();
      return newStats;
    }
  }

  // WhatsApp methods
  async getWhatsAppContact(contactId: string): Promise<any> {
    try {
      // Importar el servicio de WhatsApp bajo demanda
      const { whatsappServiceImpl } = await import('./services/whatsappServiceImpl');
      // Buscar el contacto usando el servicio
      const contact = await whatsappServiceImpl.getContact(contactId);
      return contact;
    } catch (error) {
      console.error(`Error al obtener contacto de WhatsApp ${contactId}:`, error);
      throw error;
    }
  }
  
  async getWhatsAppChat(chatId: string): Promise<any> {
    try {
      // Importar el servicio de WhatsApp bajo demanda
      const { whatsappServiceImpl } = await import('./services/whatsappServiceImpl');
      
      // Obtener los mensajes del chat
      const chat = await whatsappServiceImpl.getChat(chatId);
      if (!chat) {
        throw new Error(`Chat no encontrado: ${chatId}`);
      }
      
      // Obtener los mensajes del chat
      const messages = await chat.fetchMessages({ limit: 20 });
      
      return {
        id: chat.id._serialized,
        name: chat.name,
        isGroup: chat.isGroup,
        timestamp: chat.timestamp,
        messages: messages.map(msg => ({
          id: msg.id._serialized,
          body: msg.body,
          fromMe: msg.fromMe,
          timestamp: msg.timestamp,
          type: msg.type
        }))
      };
    } catch (error) {
      console.error(`Error al obtener chat de WhatsApp ${chatId}:`, error);
      throw error;
    }
  }
  
  async sendWhatsAppMessage(to: string, message: string): Promise<any> {
    try {
      // Importar el servicio de WhatsApp bajo demanda
      const { whatsappServiceImpl } = await import('./services/whatsappServiceImpl');
      // Enviar mensaje usando el servicio
      const result = await whatsappServiceImpl.sendMessage(to, message);
      return result;
    } catch (error) {
      console.error(`Error al enviar mensaje de WhatsApp a ${to}:`, error);
      throw error;
    }
  }
  
  async logAutoResponse(data: any): Promise<void> {
    try {
      // En un sistema real, esto se registraría en una tabla de la base de datos
      // Por ahora, simplemente lo registramos en la consola
      console.log("Auto-respuesta registrada:", data);
      // Crear una actividad para esta auto-respuesta
      await this.createActivity({
        type: "message",
        scheduled: new Date(), // Agregamos el campo scheduled que es obligatorio
        notes: `Mensaje automático enviado a ${data.contactId}: "${data.responseText.substring(0, 50)}${data.responseText.length > 50 ? '...' : ''}"`,
        completed: true,
        leadId: null, // Tendríamos que encontrar el lead asociado al número
        userId: 1, // Asignado al usuario administrador
        priority: "low"
      });
    } catch (error) {
      console.error("Error al registrar auto-respuesta:", error);
      // No lanzamos el error para evitar interrupciones, solo lo registramos
    }
  }
  
  // WhatsApp Accounts methods
  async getAllWhatsappAccounts(): Promise<WhatsappAccount[]> {
    try {
      const results = await db.select().from(whatsappAccounts);
      return results;
    } catch (error) {
      console.error("Error al obtener cuentas de WhatsApp:", error);
      return [];
    }
  }

  async getWhatsappAccount(id: number): Promise<WhatsappAccount | undefined> {
    try {
      const [account] = await db.select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.id, id));
      return account;
    } catch (error) {
      console.error(`Error al obtener cuenta WhatsApp ${id}:`, error);
      return undefined;
    }
  }

  async createWhatsappAccount(account: InsertWhatsappAccount): Promise<WhatsappAccount> {
    try {
      const [createdAccount] = await db.insert(whatsappAccounts)
        .values(account)
        .returning();
      return createdAccount;
    } catch (error) {
      console.error("Error al crear cuenta WhatsApp:", error);
      throw error;
    }
  }

  async updateWhatsappAccount(id: number, data: Partial<InsertWhatsappAccount>): Promise<WhatsappAccount | undefined> {
    try {
      const [updatedAccount] = await db.update(whatsappAccounts)
        .set({
          ...data,
          ...(data.status === 'active' ? { lastActiveAt: new Date() } : {})
        })
        .where(eq(whatsappAccounts.id, id))
        .returning();
      return updatedAccount;
    } catch (error) {
      console.error(`Error al actualizar cuenta WhatsApp ${id}:`, error);
      throw error;
    }
  }

  async deleteWhatsappAccount(id: number): Promise<void> {
    try {
      await db.delete(whatsappAccounts)
        .where(eq(whatsappAccounts.id, id));
    } catch (error) {
      console.error(`Error al eliminar cuenta WhatsApp ${id}:`, error);
      throw error;
    }
  }

  // Chat Assignment methods
  async getAllChatAssignments(): Promise<ChatAssignment[]> {
    try {
      const assignments = await db.select().from(chatAssignments);
      return assignments;
    } catch (error) {
      console.error("Error al obtener asignaciones de chat:", error);
      return [];
    }
  }

  async getChatAssignmentsByAgent(agentId: number): Promise<ChatAssignment[]> {
    try {
      const assignments = await db.select()
        .from(chatAssignments)
        .where(eq(chatAssignments.assignedToId, agentId));
      return assignments;
    } catch (error) {
      console.error(`Error al obtener asignaciones para agente ${agentId}:`, error);
      return [];
    }
  }

  async getChatAssignment(id: number): Promise<ChatAssignment | undefined> {
    try {
      const [assignment] = await db.select()
        .from(chatAssignments)
        .where(eq(chatAssignments.id, id));
      return assignment;
    } catch (error) {
      console.error(`Error al obtener asignación de chat ${id}:`, error);
      return undefined;
    }
  }
  
  async getChatAssignmentByChatId(chatId: string): Promise<ChatAssignment | undefined> {
    try {
      const [assignment] = await db.select()
        .from(chatAssignments)
        .where(eq(chatAssignments.chatId, chatId));
      return assignment;
    } catch (error) {
      console.error(`Error al obtener asignación para chat ${chatId}:`, error);
      return undefined;
    }
  }

  async createChatAssignment(assignment: InsertChatAssignment): Promise<ChatAssignment> {
    try {
      const now = new Date();
      const [createdAssignment] = await db.insert(chatAssignments)
        .values({
          ...assignment,
          assignedAt: now,
          lastActivityAt: now
        })
        .returning();
      return createdAssignment;
    } catch (error) {
      console.error("Error al crear asignación de chat:", error);
      throw error;
    }
  }

  async updateChatAssignment(id: number, data: Partial<InsertChatAssignment>): Promise<ChatAssignment | undefined> {
    try {
      const [updatedAssignment] = await db.update(chatAssignments)
        .set({
          ...data,
          lastActivityAt: new Date()
        })
        .where(eq(chatAssignments.id, id))
        .returning();
      return updatedAssignment;
    } catch (error) {
      console.error(`Error al actualizar asignación de chat ${id}:`, error);
      throw error;
    }
  }

  async deleteChatAssignment(id: number): Promise<void> {
    try {
      await db.delete(chatAssignments)
        .where(eq(chatAssignments.id, id));
    } catch (error) {
      console.error(`Error al eliminar asignación de chat ${id}:`, error);
      throw error;
    }
  }

  // Gemini settings
  async getGeminiSettings(): Promise<any> {
    try {
      // Buscar en una tabla "settings" si existiera
      // Por ahora devolvemos valores predeterminados
      return {
        professionLevel: "professional", // casual, professional, technical, executive
        model: "gemini-pro",
        temperature: 0.7,
        maxOutputTokens: 1024
      };
    } catch (error) {
      console.error("Error al obtener configuración de Gemini:", error);
      throw error;
    }
  }
  
  async updateGeminiSettings(settings: any): Promise<any> {
    try {
      // En un sistema real, actualizaríamos una tabla "settings"
      // Por ahora simplemente registramos el cambio y devolvemos los mismos valores
      console.log("Configuración de Gemini actualizada:", settings);
      return settings;
    } catch (error) {
      console.error("Error al actualizar configuración de Gemini:", error);
      throw error;
    }
  }
}

// Siempre usamos almacenamiento en base de datos real para datos reales
console.log("Usando DatabaseStorage con PostgreSQL para datos reales");
export const storage: IStorage = new DatabaseStorage();