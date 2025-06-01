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
  getAllUsers(): Promise<User[]>;
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
  
  // WhatsApp agent configuration methods
  setWhatsappAgentConfig(accountId: number, agentId: string, autoResponse: boolean): Promise<boolean>;
  getWhatsappAgentConfig(accountId: number): Promise<{agentId: string | null, autoResponse: boolean} | null>;
  toggleWhatsappAutoResponse(accountId: number): Promise<boolean>;
  updateWhatsappAccountAgentConfig(accountId: number, config: {assignedExternalAgentId?: string | null, autoResponseEnabled?: boolean, responseDelay?: number}): Promise<boolean>;
  
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

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.id));
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
    // Verificar si no hay cuentas existentes para reiniciar la secuencia
    const existingAccounts = await db.select().from(whatsappAccounts);
    
    if (existingAccounts.length === 0) {
      // Reiniciar la secuencia de ID desde 1
      try {
        await db.execute(`ALTER SEQUENCE whatsapp_accounts_id_seq RESTART WITH 1`);
        console.log('✅ Secuencia de ID de WhatsApp reiniciada desde 1');
      } catch (error) {
        console.log('⚠️ No se pudo reiniciar la secuencia, continuando con ID actual');
      }
    }
    
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

  // WhatsApp agent configuration methods
  async setWhatsappAgentConfig(accountId: number, agentId: string, autoResponse: boolean): Promise<boolean> {
    try {
      const updates = {
        assignedExternalAgentId: agentId,
        autoResponseEnabled: autoResponse
      };
      
      const result = await db
        .update(whatsappAccounts)
        .set(updates)
        .where(eq(whatsappAccounts.id, accountId))
        .returning();
        
      console.log(`✅ Configuración persistente guardada - Cuenta: ${accountId}, Agente: ${agentId}, Auto-respuesta: ${autoResponse}`);
      return result.length > 0;
    } catch (error) {
      console.error('Error setting WhatsApp agent config:', error);
      return false;
    }
  }

  async getWhatsappAgentConfig(accountId: number): Promise<{agentId: string | null, autoResponse: boolean} | null> {
    try {
      const [account] = await db
        .select({
          agentId: whatsappAccounts.assignedExternalAgentId,
          autoResponse: whatsappAccounts.autoResponseEnabled
        })
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.id, accountId));
        
      if (!account) return null;
      
      return {
        agentId: account.agentId,
        autoResponse: account.autoResponse || false
      };
    } catch (error) {
      console.error('Error getting WhatsApp agent config:', error);
      return null;
    }
  }

  async toggleWhatsappAutoResponse(accountId: number): Promise<boolean> {
    try {
      // Get current config
      const config = await this.getWhatsappAgentConfig(accountId);
      if (!config) return false;
      
      // Toggle auto response but keep agent assignment
      const newAutoResponse = !config.autoResponse;
      
      const result = await db
        .update(whatsappAccounts)
        .set({ autoResponseEnabled: newAutoResponse })
        .where(eq(whatsappAccounts.id, accountId))
        .returning();
        
      console.log(`🔄 Auto-respuesta cambiada - Cuenta: ${accountId}, Estado: ${newAutoResponse}, Agente mantiene: ${config.agentId}`);
      return result.length > 0;
    } catch (error) {
      console.error('Error toggling auto response:', error);
      return false;
    }
  }

  async updateWhatsappAccountAgentConfig(accountId: number, config: {assignedExternalAgentId?: string | null, autoResponseEnabled?: boolean, responseDelay?: number}): Promise<boolean> {
    try {
      const updateData: any = {};
      
      if (config.assignedExternalAgentId !== undefined) {
        updateData.assignedExternalAgentId = config.assignedExternalAgentId;
      }
      
      if (config.autoResponseEnabled !== undefined) {
        updateData.autoResponseEnabled = config.autoResponseEnabled;
      }
      
      if (config.responseDelay !== undefined) {
        updateData.responseDelay = config.responseDelay;
      }
      
      const result = await db
        .update(whatsappAccounts)
        .set(updateData)
        .where(eq(whatsappAccounts.id, accountId))
        .returning();
        
      console.log(`✅ Configuración de agente actualizada - Cuenta: ${accountId}`, updateData);
      return result.length > 0;
    } catch (error) {
      console.error('Error updating WhatsApp account agent config:', error);
      return false;
    }
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
      
      // Asegurar que la cuenta 1 tenga asignado el agente Smartplanner IA permanentemente
      const account1 = await this.getWhatsappAccount(1);
      if (account1 && account1.assignedExternalAgentId !== '3') {
        await this.setWhatsappAgentConfig(1, '3', true);
        console.log('🔧 Asignación persistente restaurada: Cuenta 1 -> Smartplanner IA (ID: 3)');
      }
    } catch (error) {
      console.error('Error initializing data:', error);
    }
  }
}

export const storage = new DatabaseStorage();