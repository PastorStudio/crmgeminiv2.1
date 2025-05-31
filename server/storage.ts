import { 
  users, 
  leads, 
  whatsappAccounts,
  chatAssignments,
  chatComments,
  type User, 
  type InsertUser,
  type Lead,
  type InsertLead,
  type InsertWhatsAppAccount,
  type WhatsAppAccount,
  type ChatAssignment,
  type InsertChatAssignment
} from "@shared/schema";
import { db } from './db';
import { eq, desc, or } from 'drizzle-orm';

// Interface for storage methods
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  
  // Lead methods
  getLeads(): Promise<Lead[]>;
  createLead(insertLead: InsertLead): Promise<Lead>;
  updateLead(id: number, updates: Partial<Lead>): Promise<Lead | undefined>;
  deleteLead(id: number): Promise<boolean>;
  
  // WhatsApp accounts methods
  getWhatsAppAccounts(): Promise<WhatsAppAccount[]>;
  createWhatsAppAccount(account: InsertWhatsAppAccount): Promise<WhatsAppAccount>;
  getAllWhatsappAccounts(): Promise<WhatsAppAccount[]>;
  getWhatsappAccount(id: number): Promise<WhatsAppAccount | undefined>;
  updateWhatsappAccount(id: number, updates: Partial<WhatsAppAccount>): Promise<WhatsAppAccount | undefined>;
  deleteWhatsappAccount(id: number): Promise<boolean>;
  
  // Chat assignments methods
  getChatAssignments(): Promise<ChatAssignment[]>;
  createChatAssignment(assignment: InsertChatAssignment): Promise<ChatAssignment>;
  
  // Additional required methods
  initializeData(): Promise<void>;
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db
      .delete(users)
      .where(eq(users.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getLeads(): Promise<Lead[]> {
    return await db.select().from(leads).orderBy(desc(leads.createdAt));
  }

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const [lead] = await db
      .insert(leads)
      .values(insertLead)
      .returning();
    return lead;
  }

  async updateLead(id: number, updates: Partial<Lead>): Promise<Lead | undefined> {
    const [lead] = await db
      .update(leads)
      .set(updates)
      .where(eq(leads.id, id))
      .returning();
    return lead || undefined;
  }

  async deleteLead(id: number): Promise<boolean> {
    const result = await db
      .delete(leads)
      .where(eq(leads.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getWhatsAppAccounts(): Promise<WhatsAppAccount[]> {
    return await db.select().from(whatsappAccounts);
  }

  async createWhatsAppAccount(account: InsertWhatsAppAccount): Promise<WhatsAppAccount> {
    const [newAccount] = await db
      .insert(whatsappAccounts)
      .values(account)
      .returning();
    return newAccount;
  }

  async getChatAssignments(): Promise<ChatAssignment[]> {
    return await db.select().from(chatAssignments);
  }

  async createChatAssignment(assignment: InsertChatAssignment): Promise<ChatAssignment> {
    const [newAssignment] = await db
      .insert(chatAssignments)
      .values(assignment)
      .returning();
    return newAssignment;
  }

  async getAllWhatsappAccounts(): Promise<WhatsAppAccount[]> {
    return await db.select().from(whatsappAccounts);
  }

  async getWhatsappAccount(id: number): Promise<WhatsAppAccount | undefined> {
    const [account] = await db.select().from(whatsappAccounts).where(eq(whatsappAccounts.id, id));
    return account || undefined;
  }

  async updateWhatsappAccount(id: number, updates: Partial<WhatsAppAccount>): Promise<WhatsAppAccount | undefined> {
    const [account] = await db
      .update(whatsappAccounts)
      .set(updates)
      .where(eq(whatsappAccounts.id, id))
      .returning();
    return account || undefined;
  }

  async deleteWhatsappAccount(id: number): Promise<boolean> {
    const result = await db
      .delete(whatsappAccounts)
      .where(eq(whatsappAccounts.id, id));
    return (result.rowCount || 0) > 0;
  }

  async initializeData(): Promise<void> {
    try {
      // Initialize basic data if needed
      const existingAccounts = await this.getWhatsAppAccounts();
      if (existingAccounts.length === 0) {
        // Create a default WhatsApp account for testing
        await this.createWhatsAppAccount({
          name: 'Demo WhatsApp',
          description: 'Cuenta de demostración',
          ownerName: 'Sistema Demo',
          ownerPhone: '+1234567890',
          status: 'disconnected',
          adminId: 1,
          autoResponseEnabled: false,
          responseDelay: 1000
        });
      }
    } catch (error) {
      console.error('Error initializing data:', error);
    }
  }
}

export const storage = new DatabaseStorage();