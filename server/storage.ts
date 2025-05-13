import { 
  users, 
  leads, 
  activities, 
  messages, 
  surveys, 
  dashboardStats,
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
  type InsertDashboardStats
} from "@shared/schema";
import { db, isDatabaseAvailable } from './db';
import { eq, desc } from 'drizzle-orm';

// Interface for storage methods
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;

  // Lead methods
  getLead(id: number): Promise<Lead | undefined>;
  getLeadsByStatus(status: string): Promise<Lead[]>;
  getLeadsByAssignee(userId: number): Promise<Lead[]>;
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
}

/**
 * Implementación de almacenamiento que utiliza una base de datos PostgreSQL
 */
export class DatabaseStorage implements IStorage {
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

  async getLead(id: number): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead;
  }

  async getLeadsByStatus(status: string): Promise<Lead[]> {
    return db.select().from(leads).where(eq(leads.status, status));
  }

  async getLeadsByAssignee(userId: number): Promise<Lead[]> {
    return db.select().from(leads).where(eq(leads.assignedTo, userId));
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
      .orderBy(activities.startTime)
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

  // Método para inicializar la base de datos con datos de prueba
  async initializeData() {
    // Verificar si ya existe un usuario administrador
    const adminUser = await this.getUserByUsername("sarahjohnson");
    
    if (!adminUser) {
      // Crear un usuario administrador
      await this.createUser({
        username: "sarahjohnson",
        password: "password123", // En una aplicación real, esto estaría hasheado
        fullName: "Sarah Johnson",
        email: "sarah.johnson@example.com",
        role: "admin",
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330"
      });
    }
    
    // Verificar si ya existen estadísticas del dashboard
    const stats = await this.getDashboardStats();
    
    if (!stats) {
      // Crear estadísticas iniciales
      await this.updateDashboardStats({
        totalLeads: 1652,
        conversionRate: 2450, // 24.5%
        activeConversations: 37,
        todayMeetings: 5,
        leadsByStatus: {
          new: 425,
          contacted: 312,
          qualified: 211,
          proposal: 156,
          negotiation: 98,
          "closed-won": 315,
          "closed-lost": 135
        }
      });
    }
  }
}

// Importar el almacenamiento en memoria
import { MemStorage } from './memStorage';

// Elegir la implementación adecuada según la disponibilidad de la base de datos
let storage: IStorage;

if (isDatabaseAvailable) {
  console.log("Usando DatabaseStorage con PostgreSQL");
  storage = new DatabaseStorage();
} else {
  console.log("Usando MemStorage (almacenamiento en memoria)");
  storage = new MemStorage();
  
  // Inicializar con datos de prueba inmediatamente
  storage.initializeData().catch(err => 
    console.error("Error al inicializar datos de prueba:", err)
  );
}

// Exportar instancia de almacenamiento
export { storage };