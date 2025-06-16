/**
 * Real WhatsApp Data Integration Service
 * Replaces all mock data with authentic WhatsApp data throughout the system
 */

import { db } from '../db';
import { 
  leads, 
  whatsappMessages, 
  contacts, 
  whatsappAccounts,
  mediaFiles,
  tags,
  leadTags
} from '@shared/schema';
import { eq, desc, count, sql } from 'drizzle-orm';

export class RealDataIntegrationService {
  
  /**
   * Get real WhatsApp conversations with message counts
   */
  async getRealWhatsAppConversations(accountId?: number) {
    try {
      let query = db
        .select({
          chatId: whatsappMessages.chatId,
          contactName: contacts.name,
          contactPhone: contacts.phone,
          lastMessage: whatsappMessages.content,
          lastMessageTime: whatsappMessages.timestamp,
          messageCount: count(whatsappMessages.id),
          accountId: whatsappMessages.whatsappAccountId
        })
        .from(whatsappMessages)
        .leftJoin(contacts, eq(whatsappMessages.from, contacts.phone))
        .groupBy(
          whatsappMessages.chatId,
          contacts.name,
          contacts.phone,
          whatsappMessages.content,
          whatsappMessages.timestamp,
          whatsappMessages.whatsappAccountId
        )
        .orderBy(desc(whatsappMessages.timestamp));

      if (accountId) {
        query = query.where(eq(whatsappMessages.whatsappAccountId, accountId));
      }

      const conversations = await query;
      
      return {
        success: true,
        conversations,
        count: conversations.length,
        realData: true
      };
    } catch (error) {
      console.error('Error fetching real WhatsApp conversations:', error);
      throw error;
    }
  }

  /**
   * Get real leads with conversion source tracking
   */
  async getRealLeadsWithSource(includeDeleted = false) {
    try {
      let query = db
        .select()
        .from(leads)
        .orderBy(desc(leads.createdAt));

      if (!includeDeleted) {
        query = query.where(eq(leads.isDeleted, false));
      }

      const realLeads = await query;
      
      // Get lead tags for each lead
      const leadsWithTags = await Promise.all(
        realLeads.map(async (lead) => {
          const leadTagsData = await db
            .select({ tag: tags })
            .from(leadTags)
            .leftJoin(tags, eq(leadTags.tagId, tags.id))
            .where(eq(leadTags.leadId, lead.id));
          
          return {
            ...lead,
            tags: leadTagsData.map(lt => lt.tag).filter(Boolean)
          };
        })
      );

      return {
        success: true,
        leads: leadsWithTags,
        count: leadsWithTags.length,
        realData: true
      };
    } catch (error) {
      console.error('Error fetching real leads:', error);
      throw error;
    }
  }

  /**
   * Get real WhatsApp messages for a specific conversation
   */
  async getRealMessagesForConversation(chatId: string, limit = 50, offset = 0) {
    try {
      const realMessages = await db
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.chatId, chatId))
        .orderBy(desc(whatsappMessages.timestamp))
        .limit(limit)
        .offset(offset);

      // Get media files for messages that have them
      const messagesWithMedia = await Promise.all(
        realMessages.map(async (message) => {
          const media = await db
            .select()
            .from(mediaFiles)
            .where(eq(mediaFiles.messageId, message.id.toString()));
          
          return {
            ...message,
            mediaFiles: media
          };
        })
      );

      return {
        success: true,
        messages: messagesWithMedia,
        count: messagesWithMedia.length,
        chatId,
        realData: true
      };
    } catch (error) {
      console.error('Error fetching real messages:', error);
      throw error;
    }
  }

  /**
   * Get real contacts with account filtering
   */
  async getRealContacts(accountId?: number) {
    try {
      let query = db.select().from(contacts);
      
      if (accountId) {
        query = query.where(eq(contacts.whatsappAccountId, accountId));
      }

      const realContacts = await query.orderBy(desc(contacts.createdAt));

      return {
        success: true,
        contacts: realContacts,
        count: realContacts.length,
        realData: true
      };
    } catch (error) {
      console.error('Error fetching real contacts:', error);
      throw error;
    }
  }

  /**
   * Get real dashboard metrics
   */
  async getRealDashboardMetrics() {
    try {
      const [
        totalLeads,
        totalMessages,
        totalContacts,
        totalAccounts
      ] = await Promise.all([
        db.select({ count: count() }).from(leads).where(eq(leads.isDeleted, false)),
        db.select({ count: count() }).from(whatsappMessages),
        db.select({ count: count() }).from(contacts),
        db.select({ count: count() }).from(whatsappAccounts)
      ]);

      // Get conversion rate
      const leadsFromWhatsApp = await db
        .select({ count: count() })
        .from(leads)
        .where(sql`${leads.source} = 'whatsapp' AND ${leads.isDeleted} = false`);

      const conversionRate = totalMessages[0].count > 0 
        ? (leadsFromWhatsApp[0].count / totalMessages[0].count * 100).toFixed(2)
        : 0;

      return {
        success: true,
        metrics: {
          leads: totalLeads[0].count,
          messages: totalMessages[0].count,
          contacts: totalContacts[0].count,
          accounts: totalAccounts[0].count,
          conversionRate: parseFloat(conversionRate.toString()),
          revenue: 0 // Calculate from lead values if needed
        },
        realData: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching real dashboard metrics:', error);
      throw error;
    }
  }

  /**
   * Get real sales pipeline data
   */
  async getRealSalesPipeline() {
    try {
      const pipelineData = await db
        .select({
          status: leads.status,
          count: count(),
          totalValue: sql<number>`COALESCE(SUM(CAST(${leads.value} AS DECIMAL)), 0)`
        })
        .from(leads)
        .where(eq(leads.isDeleted, false))
        .groupBy(leads.status);

      return {
        success: true,
        pipeline: pipelineData,
        realData: true
      };
    } catch (error) {
      console.error('Error fetching real sales pipeline:', error);
      throw error;
    }
  }

  /**
   * Get real media files with metadata
   */
  async getRealMediaFiles(messageId?: string) {
    try {
      let query = db.select().from(mediaFiles);
      
      if (messageId) {
        query = query.where(eq(mediaFiles.messageId, messageId));
      }

      const files = await query.orderBy(desc(mediaFiles.createdAt));

      return {
        success: true,
        mediaFiles: files,
        count: files.length,
        realData: true
      };
    } catch (error) {
      console.error('Error fetching real media files:', error);
      throw error;
    }
  }
}

export const realDataIntegrationService = new RealDataIntegrationService();