/**
 * Service for managing WhatsApp chat data and conversion to leads
 */
import { storage } from '../storage';
import { whatsappMultiAccountManager } from '../whatsappMultiAccountManager';

interface WhatsAppChatData {
  id: string;
  name: string;
  pushname?: string;
  phone: string;
  lastMessage?: string;
  lastMessageTime?: Date;
  isGroup: boolean;
  accountId: number;
  profilePic?: string;
}

interface RealWhatsAppContact {
  id: {
    _serialized: string;
    user: string;
    server: string;
  };
  name?: string;
  pushname?: string;
  shortName?: string;
  number?: string;
  isGroup: boolean;
  isMyContact: boolean;
  profilePicUrl?: string;
}

export class WhatsAppChatService {
  private static instance: WhatsAppChatService;
  private chatCache = new Map<string, WhatsAppChatData[]>();

  static getInstance(): WhatsAppChatService {
    if (!WhatsAppChatService.instance) {
      WhatsAppChatService.instance = new WhatsAppChatService();
    }
    return WhatsAppChatService.instance;
  }

  async getRealChatsFromAccount(accountId: number): Promise<WhatsAppChatData[]> {
    try {
      console.log(`📱 Getting real chats for account ${accountId}`);
      
      // Get the WhatsApp client instance
      const client = whatsappMultiAccountManager.getClient(accountId);
      if (!client) {
        console.log(`❌ No client found for account ${accountId}`);
        return [];
      }

      // Check if client is ready
      const state = await client.getState();
      if (state !== 'CONNECTED') {
        console.log(`⚠️ Account ${accountId} not connected (state: ${state})`);
        return [];
      }

      // Get all chats
      const chats = await client.getChats();
      console.log(`📱 Found ${chats.length} chats for account ${accountId}`);

      const chatData: WhatsAppChatData[] = [];

      for (const chat of chats) {
        // Skip group chats and status updates
        if (chat.isGroup || chat.id._serialized.includes('status@broadcast')) {
          continue;
        }

        // Get contact info
        const contact = await chat.getContact();
        const phone = contact.number || chat.id.user;
        const name = contact.name || contact.pushname || contact.shortName || `Contact ${phone}`;

        // Get last message
        const messages = await chat.fetchMessages({ limit: 1 });
        const lastMessage = messages.length > 0 ? messages[0] : null;

        chatData.push({
          id: chat.id._serialized,
          name: name,
          pushname: contact.pushname,
          phone: phone,
          lastMessage: lastMessage?.body || '',
          lastMessageTime: lastMessage ? new Date(lastMessage.timestamp * 1000) : undefined,
          isGroup: chat.isGroup,
          accountId: accountId,
          profilePic: contact.profilePicUrl
        });
      }

      // Cache the results
      this.chatCache.set(`account_${accountId}`, chatData);
      console.log(`✅ Processed ${chatData.length} real chats for account ${accountId}`);
      
      return chatData;
    } catch (error) {
      console.error(`❌ Error getting real chats for account ${accountId}:`, error);
      return [];
    }
  }

  async convertChatsToLeads(accountId: number): Promise<{ created: number; updated: number; processed: number }> {
    const chats = await this.getRealChatsFromAccount(accountId);
    
    let created = 0;
    let updated = 0;
    let processed = 0;

    for (const chat of chats) {
      processed++;

      try {
        // Check if lead already exists
        const existingLeads = await storage.getLeads();
        const existingLead = existingLeads.find(lead => 
          (lead.notes && lead.notes.includes(chat.phone)) ||
          (lead.email && lead.email.includes(chat.phone)) ||
          lead.name === chat.name
        );

        if (existingLead) {
          // Update existing lead
          await storage.updateLead(existingLead.id, {
            ...existingLead,
            source: 'whatsapp',
            notes: `${existingLead.notes || ''}\nWhatsApp: ${chat.phone}\nLast message: ${chat.lastMessage || 'No messages'}`.trim(),
            lastContactDate: chat.lastMessageTime || new Date(),
            updatedAt: new Date()
          });
          updated++;
          console.log(`✅ Updated lead: ${chat.name}`);
        } else {
          // Create new lead
          const newLead = {
            name: chat.name,
            fullName: chat.pushname || chat.name,
            email: `${chat.phone}@whatsapp.contact`,
            company: '',
            notes: `WhatsApp Contact\nPhone: ${chat.phone}\nLast message: ${chat.lastMessage || 'No messages'}\nProfile: ${chat.profilePic || 'No profile pic'}`,
            source: 'whatsapp',
            priority: 'medium',
            status: 'new',
            budget: 0,
            tags: ['whatsapp-real'],
            assigneeId: null,
            whatsappAccountId: accountId,
            contactId: 1,
            title: `WhatsApp - ${chat.name}`,
            lastContactDate: chat.lastMessageTime || new Date()
          };

          const createdLead = await storage.createLead(newLead);
          created++;
          console.log(`✅ Created lead: ${chat.name} (ID: ${createdLead.id})`);
        }
      } catch (error) {
        console.error(`❌ Error processing chat ${chat.name}:`, error);
      }
    }

    return { created, updated, processed };
  }

  async getAllChatsFromAllAccounts(): Promise<WhatsAppChatData[]> {
    const accounts = await storage.getAllWhatsappAccounts();
    const allChats: WhatsAppChatData[] = [];

    for (const account of accounts) {
      const chats = await this.getRealChatsFromAccount(account.id);
      allChats.push(...chats);
    }

    return allChats;
  }

  getCachedChats(accountId: number): WhatsAppChatData[] {
    return this.chatCache.get(`account_${accountId}`) || [];
  }

  clearCache(): void {
    this.chatCache.clear();
    console.log('🗑️ WhatsApp chat cache cleared');
  }
}

export const whatsappChatService = WhatsAppChatService.getInstance();