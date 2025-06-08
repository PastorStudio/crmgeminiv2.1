import { DatabaseStorage } from '../storage';
import { db } from '../db';
import { leads, contacts, conversations } from '@shared/schema';
import { eq, and, isNull } from 'drizzle-orm';

export class RealLeadGenerator {
  private storage: DatabaseStorage;

  constructor(storage: DatabaseStorage) {
    this.storage = storage;
  }

  // Extract phone number from chat ID
  private extractPhoneFromChatId(chatId: string): string | null {
    // For individual chats: phone@c.us
    const individualMatch = chatId.match(/^(\d+)@c\.us$/);
    if (individualMatch) {
      return individualMatch[1];
    }
    
    // For test chats or other formats
    if (chatId.startsWith('test_chat_')) {
      return `test_${chatId.replace('test_chat_', '')}`;
    }
    
    return null;
  }

  // Generate lead title from chat content
  private generateLeadTitle(messages: any[]): string {
    const userMessages = messages.filter(msg => msg.is_from_user);
    if (userMessages.length === 0) return 'WhatsApp Lead';

    const firstMessage = userMessages[0].message_text;
    if (firstMessage.length > 50) {
      return firstMessage.substring(0, 47) + '...';
    }
    return firstMessage;
  }

  // Analyze conversation to determine lead value
  private analyzeLeadValue(messages: any[]): number {
    let score = 0;
    const messageTexts = messages.map(m => m.message_text.toLowerCase());
    
    // Keywords that indicate sales interest
    const salesKeywords = ['precio', 'costo', 'cuanto', 'comprar', 'servicio', 'producto', 'consulta', 'presupuesto'];
    const urgencyKeywords = ['urgente', 'rapido', 'pronto', 'inmediato', 'ya'];
    const businessKeywords = ['empresa', 'negocio', 'comercial', 'profesional'];

    salesKeywords.forEach(keyword => {
      if (messageTexts.some(text => text.includes(keyword))) score += 20;
    });

    urgencyKeywords.forEach(keyword => {
      if (messageTexts.some(text => text.includes(keyword))) score += 15;
    });

    businessKeywords.forEach(keyword => {
      if (messageTexts.some(text => text.includes(keyword))) score += 10;
    });

    // Base value for any conversation
    score += 50;

    return Math.min(score, 500); // Cap at $500
  }

  // Determine lead status based on conversation
  private determineLeadStatus(messages: any[]): string {
    const lastUserMessage = messages.filter(msg => msg.is_from_user).pop();
    const lastBotMessage = messages.filter(msg => !msg.is_from_user).pop();

    if (!lastUserMessage) return 'new';

    const lastText = lastUserMessage.message_text.toLowerCase();
    
    if (lastText.includes('si') || lastText.includes('acepto') || lastText.includes('agenda')) {
      return 'qualified';
    }
    
    if (lastText.includes('no') || lastText.includes('gracias')) {
      return 'lost';
    }

    if (lastBotMessage && lastBotMessage.timestamp > lastUserMessage.timestamp) {
      return 'contacted';
    }

    return 'new';
  }

  // Convert real WhatsApp conversations to leads
  async convertConversationsToLeads(): Promise<{ success: boolean; leadsCreated: number; message: string }> {
    try {
      console.log('🔄 Converting real WhatsApp conversations to leads...');

      // Get all conversation data grouped by chat_id
      const conversationQuery = `
        SELECT 
          chat_id,
          json_agg(
            json_build_object(
              'id', id,
              'message_text', message_text,
              'is_from_user', is_from_user,
              'timestamp', timestamp
            ) ORDER BY timestamp
          ) as messages
        FROM conversation_history 
        GROUP BY chat_id
      `;

      const conversationData = await db.raw(conversationQuery);
      const conversations = conversationData.rows;

      let leadsCreated = 0;

      for (const conversation of conversations) {
        const { chat_id, messages } = conversation;
        
        // Skip group chats and newsletters
        if (chat_id.includes('@g.us') || chat_id.includes('@newsletter')) {
          continue;
        }

        // Extract phone number
        const phoneNumber = this.extractPhoneFromChatId(chat_id);
        if (!phoneNumber) continue;

        // Check if lead already exists for this chat
        const existingLead = await db
          .select()
          .from(leads)
          .where(eq(leads.customFields, { chatId: chat_id }))
          .limit(1);

        if (existingLead.length > 0) {
          console.log(`Lead already exists for chat ${chat_id}`);
          continue;
        }

        // Create or get contact
        let contact = await db
          .select()
          .from(contacts)
          .where(eq(contacts.phone, phoneNumber))
          .limit(1);

        let contactId: number;

        if (contact.length === 0) {
          // Create new contact
          const [newContact] = await db
            .insert(contacts)
            .values({
              name: `WhatsApp Contact ${phoneNumber}`,
              phone: phoneNumber,
              source: 'whatsapp',
              customFields: { chatId: chat_id }
            })
            .returning();
          contactId = newContact.id;
        } else {
          contactId = contact[0].id;
        }

        // Generate lead data
        const leadTitle = this.generateLeadTitle(messages);
        const leadValue = this.analyzeLeadValue(messages);
        const leadStatus = this.determineLeadStatus(messages);

        // Create lead
        const [newLead] = await db
          .insert(leads)
          .values({
            contactId,
            whatsappAccountId: 1, // Default WhatsApp account
            title: leadTitle,
            name: `WhatsApp Contact ${phoneNumber}`,
            company: 'WhatsApp Lead',
            status: leadStatus,
            value: leadValue.toString(),
            source: 'whatsapp',
            customFields: { 
              chatId: chat_id,
              messageCount: messages.length,
              firstMessage: messages[0]?.message_text || '',
              lastMessage: messages[messages.length - 1]?.message_text || ''
            },
            notes: `Lead generated from WhatsApp conversation. Chat ID: ${chat_id}. ${messages.length} messages exchanged.`
          })
          .returning();

        leadsCreated++;
        console.log(`✅ Created lead: ${newLead.title} (Value: $${leadValue})`);
      }

      return {
        success: true,
        leadsCreated,
        message: `Successfully converted ${leadsCreated} WhatsApp conversations to leads`
      };

    } catch (error) {
      console.error('❌ Error converting conversations to leads:', error);
      return {
        success: false,
        leadsCreated: 0,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}