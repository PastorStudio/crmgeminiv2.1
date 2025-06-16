import { db } from '../db';
import { leads, whatsappMessages, contacts, whatsappAccounts } from '../../shared/schema';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';

interface ChatMessage {
  id: string;
  content: string;
  from_me: boolean;
  timestamp: Date;
  hasMedia: boolean;
  mediaType?: string;
  mediaUrl?: string;
  contactId?: number;
  accountId: number;
}

interface ChatConversation {
  contactId: number;
  accountId: number;
  contactName: string;
  contactPhone: string;
  messages: ChatMessage[];
  lastMessageTime: Date;
  messageCount: number;
}

export class AutomaticChatToLeadService {
  private static instance: AutomaticChatToLeadService;
  
  public static getInstance(): AutomaticChatToLeadService {
    if (!AutomaticChatToLeadService.instance) {
      AutomaticChatToLeadService.instance = new AutomaticChatToLeadService();
    }
    return AutomaticChatToLeadService.instance;
  }

  async processAllChatsToLeads(): Promise<{
    processed: number;
    converted: number;
    skipped: number;
    details: Array<{
      contactName: string;
      phone: string;
      status: 'converted' | 'exists' | 'skipped';
      leadId?: number;
    }>;
  }> {
    try {
      console.log('🔄 Iniciando procesamiento automático de chats a leads...');
      
      // Get all conversations from WhatsApp messages
      const conversations = await this.getChatConversations();
      console.log(`📊 Encontradas ${conversations.length} conversaciones activas`);
      
      const results = {
        processed: 0,
        converted: 0,
        skipped: 0,
        details: [] as Array<{
          contactName: string;
          phone: string;
          status: 'converted' | 'exists' | 'skipped';
          leadId?: number;
        }>
      };

      for (const conversation of conversations) {
        try {
          results.processed++;
          
          // Check if lead already exists for this contact
          const existingLead = await db.query.leads.findFirst({
            where: and(
              eq(leads.phone, conversation.contactPhone),
              eq(leads.isDeleted, false)
            )
          });

          if (existingLead) {
            console.log(`⏭️ Lead ya existe para ${conversation.contactName} (${conversation.contactPhone})`);
            results.skipped++;
            results.details.push({
              contactName: conversation.contactName,
              phone: conversation.contactPhone,
              status: 'exists'
            });
            continue;
          }

          // Analyze conversation to determine if it should become a lead
          const shouldConvert = await this.shouldConvertToLead(conversation);
          
          if (shouldConvert) {
            const newLead = await this.createLeadFromChat(conversation);
            results.converted++;
            results.details.push({
              contactName: conversation.contactName,
              phone: conversation.contactPhone,
              status: 'converted',
              leadId: newLead.id
            });
            console.log(`✅ Lead creado: ${conversation.contactName} (ID: ${newLead.id})`);
          } else {
            results.skipped++;
            results.details.push({
              contactName: conversation.contactName,
              phone: conversation.contactPhone,
              status: 'skipped'
            });
            console.log(`⏭️ Conversación omitida: ${conversation.contactName} (no cumple criterios)`);
          }
          
        } catch (error) {
          console.error(`❌ Error procesando conversación ${conversation.contactName}:`, error);
          results.skipped++;
        }
      }

      console.log(`🎉 Procesamiento completado: ${results.converted} leads creados de ${results.processed} conversaciones`);
      return results;
      
    } catch (error) {
      console.error('❌ Error en procesamiento automático:', error);
      throw error;
    }
  }

  private async getChatConversations(): Promise<ChatConversation[]> {
    try {
      // Get all recent conversations grouped by contact
      const conversationsData = await db
        .select({
          contactId: contacts.id,
          accountId: whatsappMessages.accountId,
          contactName: contacts.name,
          contactPhone: contacts.phone,
          lastMessage: sql<Date>`MAX(${whatsappMessages.timestamp})`,
          messageCount: sql<number>`COUNT(*)::int`
        })
        .from(whatsappMessages)
        .innerJoin(contacts, eq(whatsappMessages.accountId, contacts.whatsappAccountId))
        .where(
          and(
            eq(whatsappMessages.from_me, false), // Only incoming messages
            sql`${whatsappMessages.timestamp} > NOW() - INTERVAL '30 days'` // Last 30 days
          )
        )
        .groupBy(contacts.id, whatsappMessages.accountId, contacts.name, contacts.phone)
        .having(sql`COUNT(*) >= 3`) // At least 3 messages
        .orderBy(desc(sql`MAX(${whatsappMessages.timestamp})`));

      const conversations: ChatConversation[] = [];

      for (const conv of conversationsData) {
        // Get recent messages for this conversation
        const messages = await db
          .select({
            id: whatsappMessages.messageId,
            content: whatsappMessages.content,
            from_me: whatsappMessages.from_me,
            timestamp: whatsappMessages.timestamp,
            hasMedia: whatsappMessages.hasMedia,
            mediaType: whatsappMessages.mediaType,
            mediaUrl: whatsappMessages.mediaUrl,
            contactId: conv.contactId,
            accountId: whatsappMessages.accountId
          })
          .from(whatsappMessages)
          .where(
            and(
              eq(whatsappMessages.accountId, conv.accountId),
              sql`${whatsappMessages.timestamp} > NOW() - INTERVAL '30 days'`
            )
          )
          .orderBy(desc(whatsappMessages.timestamp))
          .limit(20);

        conversations.push({
          contactId: conv.contactId,
          accountId: conv.accountId,
          contactName: conv.contactName || 'Sin nombre',
          contactPhone: conv.contactPhone || '',
          messages: messages,
          lastMessageTime: conv.lastMessage,
          messageCount: conv.messageCount
        });
      }

      return conversations;
    } catch (error) {
      console.error('❌ Error obteniendo conversaciones:', error);
      return [];
    }
  }

  private async shouldConvertToLead(conversation: ChatConversation): Promise<boolean> {
    try {
      // Basic criteria for lead conversion
      const criteria = {
        minMessages: 3,
        recentActivity: 7, // days
        hasIncomingMessages: true,
        excludeSystemMessages: true
      };

      // Check if conversation meets basic criteria
      if (conversation.messageCount < criteria.minMessages) {
        return false;
      }

      // Check for recent activity
      const daysSinceLastMessage = Math.floor(
        (Date.now() - conversation.lastMessageTime.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceLastMessage > criteria.recentActivity) {
        return false;
      }

      // Check for business-related keywords in messages
      const businessKeywords = [
        'precio', 'costo', 'comprar', 'vender', 'producto', 'servicio',
        'información', 'cotización', 'presupuesto', 'contacto', 'empresa',
        'negocio', 'consulta', 'disponible', 'horario', 'ubicación'
      ];

      const hasBusinessIntent = conversation.messages.some(msg => 
        !msg.from_me && businessKeywords.some(keyword => 
          msg.content.toLowerCase().includes(keyword)
        )
      );

      return hasBusinessIntent;
      
    } catch (error) {
      console.error('❌ Error evaluando criterios de conversión:', error);
      return false;
    }
  }

  private async createLeadFromChat(conversation: ChatConversation): Promise<any> {
    try {
      // Get WhatsApp account info
      const [account] = await db
        .select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.id, conversation.accountId));

      // Create conversation summary
      const recentMessages = conversation.messages
        .slice(0, 5)
        .map(msg => `${msg.from_me ? 'Yo' : conversation.contactName}: ${msg.content}`)
        .join('\n');

      const [newLead] = await db
        .insert(leads)
        .values({
          name: conversation.contactName,
          fullName: conversation.contactName,
          phone: conversation.contactPhone,
          email: '', // Will be updated if found in messages
          company: '', // Will be updated if found in messages
          source: 'WhatsApp',
          status: 'new',
          priority: 'medium',
          notes: `Lead generado automáticamente desde WhatsApp.\n\nÚltimos mensajes:\n${recentMessages}`,
          value: '0',
          assignedTo: account?.userId || 1,
          whatsappAccountId: conversation.accountId,
          contactId: conversation.contactId,
          chatId: `chat_${conversation.contactId}_${conversation.accountId}`,
          lastContactDate: conversation.lastMessageTime,
          tags: ['WhatsApp', 'Automático'],
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      return newLead;
      
    } catch (error) {
      console.error('❌ Error creando lead desde chat:', error);
      throw error;
    }
  }

  async getConversionStats(): Promise<{
    totalChats: number;
    eligibleChats: number;
    convertedLeads: number;
    conversionRate: number;
    lastProcessed: Date | null;
  }> {
    try {
      // Get total chat conversations
      const totalChatsResult = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${contacts.id})::int` })
        .from(contacts)
        .innerJoin(whatsappMessages, eq(whatsappMessages.accountId, contacts.whatsappAccountId));

      // Get eligible conversations (those meeting conversion criteria)
      const eligibleChatsResult = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(
          db
            .select({ contactId: contacts.id })
            .from(whatsappMessages)
            .innerJoin(contacts, eq(whatsappMessages.accountId, contacts.whatsappAccountId))
            .where(
              and(
                eq(whatsappMessages.from_me, false),
                sql`${whatsappMessages.timestamp} > NOW() - INTERVAL '30 days'`
              )
            )
            .groupBy(contacts.id)
            .having(sql`COUNT(*) >= 3`)
            .as('eligible')
        );

      // Get converted leads from WhatsApp
      const convertedLeadsResult = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(leads)
        .where(
          and(
            eq(leads.source, 'WhatsApp'),
            eq(leads.isDeleted, false)
          )
        );

      const totalChats = totalChatsResult[0]?.count || 0;
      const eligibleChats = eligibleChatsResult[0]?.count || 0;
      const convertedLeads = convertedLeadsResult[0]?.count || 0;
      const conversionRate = eligibleChats > 0 ? (convertedLeads / eligibleChats) * 100 : 0;

      return {
        totalChats,
        eligibleChats,
        convertedLeads,
        conversionRate: Math.round(conversionRate * 100) / 100,
        lastProcessed: new Date()
      };
      
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas de conversión:', error);
      return {
        totalChats: 0,
        eligibleChats: 0,
        convertedLeads: 0,
        conversionRate: 0,
        lastProcessed: null
      };
    }
  }
}

export const automaticChatToLeadService = AutomaticChatToLeadService.getInstance();