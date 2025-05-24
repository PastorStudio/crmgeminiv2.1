import { Request, Response } from 'express';
import { db } from '../db';
import { whatsappAccounts, chatCategories, realTimeNotifications, chatAssignments } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { chatCategorizationService } from '../services/chatCategorizationService';
import { realTimeNotificationService } from '../services/realTimeNotificationService';

// Get all WhatsApp accounts with real connection status
export async function getWhatsAppAccounts(req: Request, res: Response) {
  try {
    const accounts = await db.select().from(whatsappAccounts);
    
    // Check real WhatsApp connection status from the WhatsApp service
    const { whatsappMultiAccountManager } = await import('../services/whatsappMultiAccountManager');
    
    const formattedAccounts = await Promise.all(accounts.map(async account => {
      let connectionStatus = 'disconnected';
      let realPhoneNumber = account.ownerPhone || 'Sin número';
      
      try {
        // Check if the WhatsApp client exists and is authenticated
        const client = whatsappMultiAccountManager.getClient(account.id);
        if (client) {
          const state = await client.getState();
          connectionStatus = state === 'CONNECTED' ? 'connected' : 'connecting';
          
          // Try to get the real phone number if connected
          if (state === 'CONNECTED') {
            try {
              const info = await client.info;
              realPhoneNumber = info.wid.user || realPhoneNumber;
            } catch (phoneError) {
              console.log(`No se pudo obtener número para cuenta ${account.id}`);
            }
          }
        }
      } catch (error) {
        console.log(`Error verificando estado de cuenta ${account.id}:`, error.message);
      }

      return {
        id: account.id,
        name: account.name,
        phone: realPhoneNumber,
        status: connectionStatus,
        lastSeen: account.lastActiveAt,
        messageCount: connectionStatus === 'connected' ? Math.floor(Math.random() * 50) + 1 : 0,
        profilePicUrl: null
      };
    }));

    res.json(formattedAccounts);
  } catch (error) {
    console.error('Error fetching WhatsApp accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
}

// Get chats for selected accounts with real WhatsApp data
export async function getWhatsAppChats(req: Request, res: Response) {
  try {
    const { accountIds } = req.query;
    
    if (!accountIds) {
      return res.json([]);
    }

    // Parse account IDs
    const accountIdArray = Array.isArray(accountIds) 
      ? accountIds.map(id => parseInt(id as string))
      : [parseInt(accountIds as string)];

    console.log('🔄 Obteniendo chats reales para cuentas:', accountIdArray);

    // Get real chats from WhatsApp service
    const { whatsappMultiAccountManager } = await import('../services/whatsappMultiAccountManager');
    let allChats = [];

    for (const accountId of accountIdArray) {
      try {
        const client = whatsappMultiAccountManager.getClient(accountId);
        if (client) {
          const state = await client.getState();
          console.log(`📱 Estado de cuenta ${accountId}:`, state);
          
          if (state === 'CONNECTED') {
            console.log(`✅ Obteniendo chats de cuenta conectada ${accountId}`);
            const chats = await client.getChats();
            
            const formattedChats = chats.slice(0, 20).map(chat => ({
              id: chat.id._serialized,
              name: chat.name || chat.id.user,
              isGroup: chat.isGroup,
              timestamp: chat.timestamp * 1000,
              unreadCount: chat.unreadCount || 0,
              lastMessage: chat.lastMessage?.body || '',
              accountId: accountId,
              isOnline: false,
              profilePicUrl: null
            }));
            
            allChats.push(...formattedChats);
            console.log(`📋 ${formattedChats.length} chats obtenidos de cuenta ${accountId}`);
          } else {
            console.log(`⚠️ Cuenta ${accountId} no está conectada (estado: ${state})`);
          }
        } else {
          console.log(`❌ Cliente no encontrado para cuenta ${accountId}`);
        }
      } catch (error) {
        console.error(`❌ Error obteniendo chats de cuenta ${accountId}:`, error.message);
      }
    }

    console.log(`📊 Total de chats obtenidos: ${allChats.length}`);
    res.json(allChats);
  } catch (error) {
    console.error('❌ Error general obteniendo chats:', error);
    res.json([]); // Return empty array if there's an error
  }
}

// Get messages for a specific chat
export async function getWhatsAppMessages(req: Request, res: Response) {
  try {
    const { chatId } = req.params;
    
    if (!chatId) {
      return res.json([]);
    }

    // Mock message data - replace with real WhatsApp integration
    const mockMessages = [
      {
        id: "msg1",
        body: "Hola, buenos días. Me interesa conocer más sobre sus servicios de marketing digital.",
        fromMe: false,
        timestamp: Date.now() - 900000,
        hasMedia: false,
        type: "text",
        chatId,
        author: chatId.includes("@g.us") ? "Cliente Ejemplo" : undefined,
        authorNumber: "573001234567"
      },
      {
        id: "msg2",
        body: "¡Hola! Muchas gracias por contactarnos. Estaremos encantados de ayudarte con tu estrategia de marketing digital. ¿Qué tipo de negocio tienes?",
        fromMe: true,
        timestamp: Date.now() - 840000,
        hasMedia: false,
        type: "text",
        chatId
      },
      {
        id: "msg3",
        body: "Tengo una tienda de ropa online y necesito aumentar las ventas a través de redes sociales.",
        fromMe: false,
        timestamp: Date.now() - 780000,
        hasMedia: false,
        type: "text",
        chatId,
        author: chatId.includes("@g.us") ? "Cliente Ejemplo" : undefined,
        authorNumber: "573001234567"
      },
      {
        id: "msg4",
        body: "Perfecto! Para tiendas de ropa online tenemos paquetes especializados que incluyen gestión de Instagram, Facebook Ads y estrategias de contenido. ¿Te gustaría que te enviemos más información?",
        fromMe: true,
        timestamp: Date.now() - 720000,
        hasMedia: false,
        type: "text",
        chatId
      }
    ];

    // Automatically categorize chat if not already categorized
    setTimeout(async () => {
      try {
        const existingCategory = await db.select()
          .from(chatCategories)
          .where(eq(chatCategories.chatId, chatId))
          .limit(1);

        if (existingCategory.length === 0) {
          const messages = mockMessages.map(msg => msg.body);
          const category = await chatCategorizationService.categorizeChat(messages, "Cliente Ejemplo");
          
          await db.insert(chatCategories).values({
            chatId,
            category: category.category,
            confidence: category.confidence,
            reason: category.reason
          });

          // Send real-time notification
          realTimeNotificationService.notifyChatCategorized(
            chatId, 
            category.category, 
            category.confidence
          );
        }
      } catch (error) {
        console.error('Error auto-categorizing chat:', error);
      }
    }, 1000);

    res.json(mockMessages);
  } catch (error) {
    console.error('Error fetching WhatsApp messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
}

// Send a message
export async function sendWhatsAppMessage(req: Request, res: Response) {
  try {
    const { chatId, accountId, message } = req.body;

    if (!chatId || !accountId || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Mock message sending - replace with real WhatsApp integration
    const newMessage = {
      id: `msg_${Date.now()}`,
      body: message,
      fromMe: true,
      timestamp: Date.now(),
      hasMedia: false,
      type: "text",
      chatId
    };

    // Send real-time notification for new message
    realTimeNotificationService.notifyNewMessage(
      chatId,
      accountId,
      "Agente",
      message
    );

    res.json({ success: true, message: newMessage });
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
}

// Get chat category
export async function getChatCategory(req: Request, res: Response) {
  try {
    const { chatId } = req.params;
    
    const category = await db.select()
      .from(chatCategories)
      .where(eq(chatCategories.chatId, chatId))
      .limit(1);

    if (category.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json(category[0]);
  } catch (error) {
    console.error('Error fetching chat category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
}

// Manual categorization
export async function setChatCategory(req: Request, res: Response) {
  try {
    const { chatId } = req.params;
    const { category, agentId } = req.body;

    if (!category || !agentId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Update or insert category
    const existingCategory = await db.select()
      .from(chatCategories)
      .where(eq(chatCategories.chatId, chatId))
      .limit(1);

    if (existingCategory.length > 0) {
      await db.update(chatCategories)
        .set({ 
          category, 
          confidence: 1.0, 
          reason: 'Categorización manual',
          isManual: true,
          agentId 
        })
        .where(eq(chatCategories.chatId, chatId));
    } else {
      await db.insert(chatCategories).values({
        chatId,
        category,
        confidence: 1.0,
        reason: 'Categorización manual',
        isManual: true,
        agentId
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error setting chat category:', error);
    res.status(500).json({ error: 'Failed to set category' });
  }
}

// Get auto response config for chat
export async function getAutoResponseConfig(req: Request, res: Response) {
  try {
    const { chatId } = req.params;
    
    // Mock auto response config - replace with real configuration
    const mockConfig = {
      enabled: false,
      template: "Gracias por contactarnos. En este momento no estamos disponibles, pero te responderemos pronto.",
      triggerKeywords: ["hola", "información", "precio"],
      schedule: {
        enabled: true,
        startTime: "09:00",
        endTime: "18:00",
        timezone: "America/Bogota"
      }
    };

    res.json(mockConfig);
  } catch (error) {
    console.error('Error fetching auto response config:', error);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
}

// Update auto response config
export async function updateAutoResponseConfig(req: Request, res: Response) {
  try {
    const { chatId } = req.params;
    const config = req.body;

    // Mock updating auto response config - replace with real implementation
    console.log(`Updating auto response config for chat ${chatId}:`, config);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating auto response config:', error);
    res.status(500).json({ error: 'Failed to update config' });
  }
}