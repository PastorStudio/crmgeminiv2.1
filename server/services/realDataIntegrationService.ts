/**
 * Real Data Integration Service
 * Ensures all system components use authentic data from the database
 */

import { db } from '../db';
import { 
  leads, 
  contacts, 
  whatsappMessages, 
  whatsappAccounts, 
  tickets,
  tags,
  activities
} from '@shared/schema';
import { eq, desc, and, or, gt, count, sql, isNull, ne } from 'drizzle-orm';

export class RealDataIntegrationService {
  private static instance: RealDataIntegrationService;

  static getInstance(): RealDataIntegrationService {
    if (!RealDataIntegrationService.instance) {
      RealDataIntegrationService.instance = new RealDataIntegrationService();
    }
    return RealDataIntegrationService.instance;
  }

  /**
   * Get real leads data with proper filtering and pagination
   */
  async getRealLeads(userId?: number, limit = 50, offset = 0) {
    try {
      const query = db
        .select({
          id: leads.id,
          name: leads.name,
          email: leads.email,
          phone: leads.phone,
          status: leads.status,
          priority: leads.priority,
          source: leads.source,
          assignedTo: leads.assignedTo,
          estimatedValue: leads.value,
          createdAt: leads.createdAt,
          updatedAt: leads.updatedAt,
          tags: leads.tags,
          notes: leads.notes
        })
        .from(leads)
        .orderBy(desc(leads.createdAt))
        .limit(limit)
        .offset(offset);

      if (userId) {
        query.where(eq(leads.assignedTo, userId));
      }

      const results = await query;
      
      return {
        success: true,
        leads: results,
        total: results.length,
        hasMore: results.length === limit,
        realData: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching real leads:', error);
      return {
        success: false,
        leads: [],
        total: 0,
        hasMore: false,
        error: 'Failed to fetch real leads data',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get real contacts data with WhatsApp integration
   */
  async getRealContacts(userId?: number, limit = 50) {
    try {
      const results = await db
        .select({
          id: contacts.id,
          name: contacts.name,
          email: contacts.email,
          phone: contacts.phone,
          whatsappNumber: contacts.phone,
          tags: contacts.tags,
          isActive: contacts.isActive,
          lastInteraction: contacts.lastSeen,
          createdAt: contacts.createdAt,
          userId: contacts.whatsappAccountId
        })
        .from(contacts)
        .where(userId ? eq(contacts.whatsappAccountId, userId) : undefined)
        .orderBy(desc(contacts.lastSeen))
        .limit(limit);

      return {
        success: true,
        contacts: results,
        total: results.length,
        realData: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching real contacts:', error);
      return {
        success: false,
        contacts: [],
        total: 0,
        error: 'Failed to fetch real contacts data',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get real dashboard metrics with current data
   */
  async getRealDashboardMetrics(userId?: number) {
    try {
      // Get today's date range
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      // Count leads by status
      const leadsQuery = db
        .select({
          status: leads.status,
          count: count()
        })
        .from(leads)
        .groupBy(leads.status);

      if (userId) {
        leadsQuery.where(eq(leads.assignedTo, userId));
      }

      const leadsStats = await leadsQuery;

      // Count messages today
      const messagesToday = await db
        .select({ count: count() })
        .from(whatsappMessages)
        .where(
          and(
            gt(whatsappMessages.createdAt, startOfDay),
            userId ? eq(whatsappMessages.accountId, userId) : undefined
          )
        );

      // Count active tickets
      const activeTickets = await db
        .select({ count: count() })
        .from(tickets)
        .where(
          and(
            eq(tickets.status, 'open'),
            userId ? eq(tickets.whatsappAccountId, userId) : undefined
          )
        );

      // Recent activities
      const recentActivities = await db
        .select({
          id: activities.id,
          type: activities.type,
          description: activities.description,
          createdAt: activities.createdAt,
          userId: activities.userId
        })
        .from(activities)
        .where(userId ? eq(activities.userId, userId) : undefined)
        .orderBy(desc(activities.createdAt))
        .limit(10);

      return {
        success: true,
        metrics: {
          leads: {
            total: leadsStats.reduce((acc, stat) => acc + stat.count, 0),
            byStatus: leadsStats.reduce((acc, stat) => {
              acc[stat.status] = stat.count;
              return acc;
            }, {} as Record<string, number>)
          },
          messages: {
            today: messagesToday[0]?.count || 0
          },
          tickets: {
            active: activeTickets[0]?.count || 0
          },
          activities: recentActivities
        },
        realData: true,
        fetchedAt: Date.now(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching real dashboard metrics:', error);
      return {
        success: false,
        metrics: null,
        error: 'Failed to fetch real dashboard metrics',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get real sales pipeline data
   */
  async getRealSalesPipeline(userId?: number) {
    try {
      const pipelineData = await db
        .select({
          id: leads.id,
          name: leads.name,
          email: leads.email,
          phone: leads.phone,
          status: leads.status,
          priority: leads.priority,
          estimatedValue: leads.value,
          createdAt: leads.createdAt,
          assignedTo: leads.assignedTo
        })
        .from(leads)
        .where(
          and(
            ne(leads.status, 'lost'),
            userId ? eq(leads.assignedTo, userId) : undefined
          )
        )
        .orderBy(desc(leads.value));

      // Group by status for pipeline visualization
      const pipeline = pipelineData.reduce((acc, lead) => {
        if (!acc[lead.status]) {
          acc[lead.status] = [];
        }
        acc[lead.status].push(lead);
        return acc;
      }, {} as Record<string, typeof pipelineData>);

      return {
        success: true,
        pipeline,
        totalValue: pipelineData.reduce((sum, lead) => sum + (Number(lead.estimatedValue) || 0), 0),
        totalLeads: pipelineData.length,
        realData: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching real sales pipeline:', error);
      return {
        success: false,
        pipeline: {},
        totalValue: 0,
        totalLeads: 0,
        error: 'Failed to fetch real sales pipeline data',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get real WhatsApp conversations with messages
   */
  async getRealWhatsAppChats(userId?: number, limit = 20) {
    try {
      // Get latest message for each chat
      const latestMessages = await db
        .select({
          chatId: whatsappMessages.chatId,
          lastMessage: whatsappMessages.content,
          lastMessageAt: whatsappMessages.createdAt,
          contactId: whatsappMessages.chatId,
          whatsappAccountId: whatsappMessages.accountId,
          isFromMe: whatsappMessages.from_me
        })
        .from(whatsappMessages)
        .where(userId ? eq(whatsappMessages.accountId, userId) : undefined)
        .orderBy(desc(whatsappMessages.createdAt))
        .limit(limit * 2); // Get more to ensure unique chats

      // Group by chatId to get unique conversations
      const uniqueChats = new Map();
      latestMessages.forEach(msg => {
        if (!uniqueChats.has(msg.chatId)) {
          uniqueChats.set(msg.chatId, msg);
        }
      });

      const chats = Array.from(uniqueChats.values()).slice(0, limit);

      return {
        success: true,
        chats,
        total: chats.length,
        realData: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching real WhatsApp chats:', error);
      return {
        success: false,
        chats: [],
        total: 0,
        error: 'Failed to fetch real WhatsApp data',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get real tickets data with proper filtering
   */
  async getRealTickets(userId?: number, status?: string, limit = 50) {
    try {
      let query = db
        .select({
          id: tickets.id,
          title: tickets.title,
          description: tickets.description,
          status: tickets.status,
          priority: tickets.priority,
          category: tickets.category,
          assignedTo: tickets.assignedTo,
          contactId: tickets.contactId,
          chatId: tickets.contactId,
          createdAt: tickets.createdAt,
          updatedAt: tickets.updatedAt,
          tags: tickets.tags
        })
        .from(tickets)
        .orderBy(desc(tickets.createdAt))
        .limit(limit);

      const conditions = [];
      if (userId) {
        conditions.push(eq(tickets.assignedTo, userId));
      }
      if (status) {
        conditions.push(eq(tickets.status, status));
      }

      let finalQuery = query;
      if (conditions.length > 0) {
        finalQuery = query.where(and(...conditions));
      }

      const results = await query;

      return {
        success: true,
        tickets: results,
        total: results.length,
        realData: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching real tickets:', error);
      return {
        success: false,
        tickets: [],
        total: 0,
        error: 'Failed to fetch real tickets data',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get real tag statistics and usage
   */
  async getRealTagStats(userId?: number) {
    try {
      const tagStats = await db
        .select({
          id: tags.id,
          name: tags.name,
          color: tags.color,
          isSystem: tags.isSystem,
          createdAt: tags.createdAt
        })
        .from(tags)
        .where(userId ? eq(tags.userId, userId) : undefined)
        .orderBy(desc(tags.createdAt));

      return {
        success: true,
        tags: tagStats,
        total: tagStats.length,
        realData: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching real tag stats:', error);
      return {
        success: false,
        tags: [],
        total: 0,
        error: 'Failed to fetch real tag data',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Force refresh all cached data
   */
  async refreshAllData(userId?: number) {
    try {
      const [
        leadsData,
        contactsData,
        dashboardData,
        pipelineData,
        chatsData,
        ticketsData,
        tagsData
      ] = await Promise.all([
        this.getRealLeads(userId),
        this.getRealContacts(userId),
        this.getRealDashboardMetrics(userId),
        this.getRealSalesPipeline(userId),
        this.getRealWhatsAppChats(userId),
        this.getRealTickets(userId),
        this.getRealTagStats(userId)
      ]);

      return {
        success: true,
        data: {
          leads: leadsData,
          contacts: contactsData,
          dashboard: dashboardData,
          pipeline: pipelineData,
          chats: chatsData,
          tickets: ticketsData,
          tags: tagsData
        },
        refreshedAt: new Date().toISOString(),
        realData: true
      };
    } catch (error) {
      console.error('Error refreshing all real data:', error);
      return {
        success: false,
        error: 'Failed to refresh real data',
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
export const realDataIntegrationService = RealDataIntegrationService.getInstance();