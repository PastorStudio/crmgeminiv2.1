/**
 * User Data Isolation Service
 * 
 * This service ensures complete data separation between users in a multi-tenant environment.
 * Each user can only access their own data, while administrators can access all data.
 * 
 * Features:
 * - Complete data isolation by user ownership
 * - Role-based access control (admin, superadmin can see all data)
 * - Automatic owner assignment on data creation
 * - Query filtering by user ownership
 */

import { eq, and, sql, or } from 'drizzle-orm';
import { db } from '../index';
import { 
  users, 
  leads, 
  tickets, 
  contacts, 
  conversations, 
  whatsappMessages,
  enhancedMessages,
  whatsappAccounts,
  userAccountAssignments
} from '../../shared/schema';

export interface AuthenticatedUser {
  id: number;
  username: string;
  role: string;
  organizationId?: number;
}

export class UserDataIsolationService {
  
  /**
   * Check if user has admin privileges (can see all data)
   */
  private isAdmin(user: AuthenticatedUser): boolean {
    return user.role === 'admin' || user.role === 'superadmin';
  }

  /**
   * Get user's accessible WhatsApp account IDs
   */
  async getUserAccessibleAccountIds(userId: number): Promise<number[]> {
    const assignments = await db
      .select({ whatsappAccountId: userAccountAssignments.whatsappAccountId })
      .from(userAccountAssignments)
      .where(eq(userAccountAssignments.userId, userId));
    
    return assignments.map(a => a.whatsappAccountId);
  }

  /**
   * Get leads with user isolation
   */
  async getUserLeads(user: AuthenticatedUser, filters?: any) {
    let query = db.select().from(leads);
    
    if (!this.isAdmin(user)) {
      // Non-admin users can only see their own leads
      query = query.where(eq(leads.ownerId, user.id));
    }
    
    // Apply additional filters if provided
    if (filters?.status) {
      const existingWhere = query.toSQL().where;
      query = query.where(existingWhere ? and(existingWhere, eq(leads.status, filters.status)) : eq(leads.status, filters.status));
    }
    
    return await query;
  }

  /**
   * Get tickets with user isolation
   */
  async getUserTickets(user: AuthenticatedUser, filters?: any) {
    let query = db.select().from(tickets);
    
    if (!this.isAdmin(user)) {
      // Non-admin users can only see their own tickets
      query = query.where(eq(tickets.ownerId, user.id));
    }
    
    // Apply additional filters if provided
    if (filters?.status) {
      const existingWhere = query.toSQL().where;
      query = query.where(existingWhere ? and(existingWhere, eq(tickets.status, filters.status)) : eq(tickets.status, filters.status));
    }
    
    return await query;
  }

  /**
   * Get contacts with user isolation
   */
  async getUserContacts(user: AuthenticatedUser, filters?: any) {
    let query = db.select().from(contacts);
    
    if (!this.isAdmin(user)) {
      // Non-admin users can only see their own contacts
      query = query.where(eq(contacts.ownerId, user.id));
    }
    
    return await query;
  }

  /**
   * Get conversations with user isolation
   */
  async getUserConversations(user: AuthenticatedUser, filters?: any) {
    let query = db.select().from(conversations);
    
    if (!this.isAdmin(user)) {
      // Non-admin users can only see their own conversations
      query = query.where(eq(conversations.ownerId, user.id));
    }
    
    return await query;
  }

  /**
   * Get WhatsApp messages with user isolation
   */
  async getUserWhatsAppMessages(user: AuthenticatedUser, chatId?: string) {
    let query = db.select().from(whatsappMessages);
    
    if (!this.isAdmin(user)) {
      // Non-admin users can only see their own messages
      query = query.where(eq(whatsappMessages.ownerId, user.id));
    }
    
    if (chatId) {
      const existingWhere = query.toSQL().where;
      query = query.where(existingWhere ? and(existingWhere, eq(whatsappMessages.chatId, chatId)) : eq(whatsappMessages.chatId, chatId));
    }
    
    return await query;
  }

  /**
   * Create lead with automatic owner assignment
   */
  async createUserLead(user: AuthenticatedUser, leadData: any) {
    const newLead = {
      ...leadData,
      ownerId: user.id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    return await db.insert(leads).values(newLead).returning();
  }

  /**
   * Create ticket with automatic owner assignment
   */
  async createUserTicket(user: AuthenticatedUser, ticketData: any) {
    const newTicket = {
      ...ticketData,
      ownerId: user.id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    return await db.insert(tickets).values(newTicket).returning();
  }

  /**
   * Create contact with automatic owner assignment
   */
  async createUserContact(user: AuthenticatedUser, contactData: any) {
    const newContact = {
      ...contactData,
      ownerId: user.id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    return await db.insert(contacts).values(newContact).returning();
  }

  /**
   * Create conversation with automatic owner assignment
   */
  async createUserConversation(user: AuthenticatedUser, conversationData: any) {
    const newConversation = {
      ...conversationData,
      ownerId: user.id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    return await db.insert(conversations).values(newConversation).returning();
  }

  /**
   * Create WhatsApp message with automatic owner assignment
   */
  async createUserWhatsAppMessage(user: AuthenticatedUser, messageData: any) {
    const newMessage = {
      ...messageData,
      ownerId: user.id,
      createdAt: new Date()
    };
    
    return await db.insert(whatsappMessages).values(newMessage).returning();
  }

  /**
   * Update lead with ownership verification
   */
  async updateUserLead(user: AuthenticatedUser, leadId: number, updateData: any) {
    let whereClause = eq(leads.id, leadId);
    
    if (!this.isAdmin(user)) {
      // Non-admin users can only update their own leads
      whereClause = and(whereClause, eq(leads.ownerId, user.id));
    }
    
    const updatedData = {
      ...updateData,
      updatedAt: new Date()
    };
    
    return await db.update(leads).set(updatedData).where(whereClause).returning();
  }

  /**
   * Update ticket with ownership verification
   */
  async updateUserTicket(user: AuthenticatedUser, ticketId: number, updateData: any) {
    let whereClause = eq(tickets.id, ticketId);
    
    if (!this.isAdmin(user)) {
      // Non-admin users can only update their own tickets
      whereClause = and(whereClause, eq(tickets.ownerId, user.id));
    }
    
    const updatedData = {
      ...updateData,
      updatedAt: new Date()
    };
    
    return await db.update(tickets).set(updatedData).where(whereClause).returning();
  }

  /**
   * Delete lead with ownership verification
   */
  async deleteUserLead(user: AuthenticatedUser, leadId: number) {
    let whereClause = eq(leads.id, leadId);
    
    if (!this.isAdmin(user)) {
      // Non-admin users can only delete their own leads
      whereClause = and(whereClause, eq(leads.ownerId, user.id));
    }
    
    return await db.delete(leads).where(whereClause).returning();
  }

  /**
   * Delete ticket with ownership verification
   */
  async deleteUserTicket(user: AuthenticatedUser, ticketId: number) {
    let whereClause = eq(tickets.id, ticketId);
    
    if (!this.isAdmin(user)) {
      // Non-admin users can only delete their own tickets
      whereClause = and(whereClause, eq(tickets.ownerId, user.id));
    }
    
    return await db.delete(tickets).where(whereClause).returning();
  }

  /**
   * Get dashboard statistics with user isolation
   */
  async getUserDashboardStats(user: AuthenticatedUser) {
    const stats = {
      totalLeads: 0,
      totalTickets: 0,
      totalContacts: 0,
      totalConversations: 0,
      activeChats: 0,
      recentActivity: []
    };

    if (this.isAdmin(user)) {
      // Admin can see all data
      const [leadsCount, ticketsCount, contactsCount, conversationsCount] = await Promise.all([
        db.select({ count: sql`count(*)` }).from(leads),
        db.select({ count: sql`count(*)` }).from(tickets),
        db.select({ count: sql`count(*)` }).from(contacts),
        db.select({ count: sql`count(*)` }).from(conversations)
      ]);
      
      stats.totalLeads = Number(leadsCount[0]?.count || 0);
      stats.totalTickets = Number(ticketsCount[0]?.count || 0);
      stats.totalContacts = Number(contactsCount[0]?.count || 0);
      stats.totalConversations = Number(conversationsCount[0]?.count || 0);
    } else {
      // Regular users can only see their own data
      const [leadsCount, ticketsCount, contactsCount, conversationsCount] = await Promise.all([
        db.select({ count: sql`count(*)` }).from(leads).where(eq(leads.ownerId, user.id)),
        db.select({ count: sql`count(*)` }).from(tickets).where(eq(tickets.ownerId, user.id)),
        db.select({ count: sql`count(*)` }).from(contacts).where(eq(contacts.ownerId, user.id)),
        db.select({ count: sql`count(*)` }).from(conversations).where(eq(conversations.ownerId, user.id))
      ]);
      
      stats.totalLeads = Number(leadsCount[0]?.count || 0);
      stats.totalTickets = Number(ticketsCount[0]?.count || 0);
      stats.totalContacts = Number(contactsCount[0]?.count || 0);
      stats.totalConversations = Number(conversationsCount[0]?.count || 0);
    }

    return stats;
  }

  /**
   * Verify user owns a specific resource
   */
  async verifyUserOwnership(user: AuthenticatedUser, resourceType: string, resourceId: number): Promise<boolean> {
    if (this.isAdmin(user)) {
      return true; // Admins can access everything
    }

    switch (resourceType) {
      case 'lead':
        const leadOwner = await db.select().from(leads).where(and(eq(leads.id, resourceId), eq(leads.ownerId, user.id)));
        return leadOwner.length > 0;
      
      case 'ticket':
        const ticketOwner = await db.select().from(tickets).where(and(eq(tickets.id, resourceId), eq(tickets.ownerId, user.id)));
        return ticketOwner.length > 0;
      
      case 'contact':
        const contactOwner = await db.select().from(contacts).where(and(eq(contacts.id, resourceId), eq(contacts.ownerId, user.id)));
        return contactOwner.length > 0;
      
      case 'conversation':
        const conversationOwner = await db.select().from(conversations).where(and(eq(conversations.id, resourceId), eq(conversations.ownerId, user.id)));
        return conversationOwner.length > 0;
      
      default:
        return false;
    }
  }

  /**
   * Bulk assign ownership to existing data (migration helper)
   */
  async assignOwnershipToExistingData(defaultOwnerId: number) {
    const tasks = [];

    // Update leads without owner
    tasks.push(
      db.update(leads)
        .set({ ownerId: defaultOwnerId })
        .where(sql`owner_id IS NULL`)
    );

    // Update tickets without owner
    tasks.push(
      db.update(tickets)
        .set({ ownerId: defaultOwnerId })
        .where(sql`owner_id IS NULL`)
    );

    // Update contacts without owner
    tasks.push(
      db.update(contacts)
        .set({ ownerId: defaultOwnerId })
        .where(sql`owner_id IS NULL`)
    );

    // Update conversations without owner
    tasks.push(
      db.update(conversations)
        .set({ ownerId: defaultOwnerId })
        .where(sql`owner_id IS NULL`)
    );

    // Update messages without owner
    tasks.push(
      db.update(whatsappMessages)
        .set({ ownerId: defaultOwnerId })
        .where(sql`owner_id IS NULL`)
    );

    await Promise.all(tasks);
    
    console.log(`✅ Data ownership assigned to user ${defaultOwnerId} for existing records`);
  }
}

// Export singleton instance
export const userDataIsolation = new UserDataIsolationService();