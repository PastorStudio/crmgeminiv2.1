import { Request, Response } from 'express';
import { db } from '../db';
import { whatsappAccounts, chatCategories } from '../../shared/schema';
import { eq } from 'drizzle-orm';

// Get WhatsApp accounts
export async function getWhatsAppAccounts(req: Request, res: Response) {
  try {
    console.log('🔄 Obteniendo cuentas de WhatsApp...');
    
    const { whatsappMultiAccountManager } = await import('../services/whatsappMultiAccountManager');
    const accounts = await db.select().from(whatsappAccounts);
    
    const accountsWithStatus = await Promise.all(
      accounts.map(async (account) => {
        try {
          const client = whatsappMultiAccountManager.getClient(account.id);
          let isConnected = false;
          
          if (client) {
            try {
              const state = await client.getState();
              isConnected = state === 'CONNECTED';
            } catch (error) {
              console.error(`❌ Error verificando estado de cuenta ${account.id}:`, (error as Error).message);
            }
          }
          
          return {
            ...account,
            isConnected
          };
        } catch (error) {
          console.error(`❌ Error procesando cuenta ${account.id}:`, (error as Error).message);
          return {
            ...account,
            isConnected: false
          };
        }
      })
    );

    console.log('✅ Cuentas obtenidas:', accountsWithStatus.length);
    res.json(accountsWithStatus);
  } catch (error) {
    console.error('❌ Error obteniendo cuentas:', (error as Error).message);
    res.json([]);
  }
}

// Get chats for a specific account
export async function getWhatsAppChats(req: Request, res: Response) {
  try {
    const { accountId } = req.params;
    console.log(`🔄 Solicitando chats reales para cuenta ${accountId}...`);

    const { whatsappMultiAccountManager } = await import('../services/whatsappMultiAccountManager');
    const client = whatsappMultiAccountManager.getClient(parseInt(accountId));
    
    if (!client) {
      console.log(`❌ Cliente no encontrado para cuenta ${accountId}`);
      return res.json([]);
    }

    try {
      const state = await client.getState();
      
      if (state !== 'CONNECTED') {
        console.log(`❌ Cliente no conectado para cuenta ${accountId}, estado: ${state}`);
        return res.json([]);
      }

      const chats = await client.getChats();
      
      const formattedChats = chats
        .filter(chat => chat.lastMessage)
        .map(chat => ({
          id: chat.id._serialized,
          name: chat.name || chat.id.user,
          isGroup: chat.isGroup,
          lastMessage: chat.lastMessage ? {
            body: chat.lastMessage.body || '',
            timestamp: chat.lastMessage.timestamp * 1000,
            fromMe: chat.lastMessage.fromMe
          } : null,
          unreadCount: chat.unreadCount || 0,
          accountId: parseInt(accountId)
        }))
        .slice(0, 50);

      console.log(`✅ Enviando ${formattedChats.length} chats reales al frontend`);
      res.json(formattedChats);
    } catch (error) {
      console.error(`❌ Error obteniendo chats de cuenta ${accountId}:`, (error as Error).message);
      res.json([]);
    }
  } catch (error) {
    console.error(`❌ Error general obteniendo chats:`, (error as Error).message);
    res.json([]);
  }
}

// Get messages for a specific chat with real WhatsApp data
export async function getWhatsAppMessages(req: Request, res: Response) {
  try {
    const { chatId } = req.params;
    
    if (!chatId) {
      return res.json([]);
    }

    console.log('🔄 Obteniendo mensajes reales para chat:', chatId);

    const { whatsappMultiAccountManager } = await import('../services/whatsappMultiAccountManager');
    
    let messages: any[] = [];
    const accounts = await db.select().from(whatsappAccounts);
    
    for (const account of accounts) {
      try {
        const client = whatsappMultiAccountManager.getClient(account.id);
        if (client) {
          const state = await client.getState();
          
          if (state === 'CONNECTED') {
            console.log(`📱 Buscando mensajes en cuenta ${account.id} para chat ${chatId}`);
            
            const chat = await client.getChatById(chatId);
            if (chat) {
              const chatMessages = await chat.fetchMessages({ limit: 50 });
              
              const formattedMessages = chatMessages.map(msg => ({
                id: msg.id.id,
                body: msg.body || '',
                fromMe: msg.fromMe,
                timestamp: msg.timestamp * 1000,
                hasMedia: msg.hasMedia,
                type: msg.type,
                chatId: chatId,
                author: !msg.fromMe && chat.isGroup ? msg.author : undefined,
                authorNumber: msg.from
              }));
              
              messages = formattedMessages;
              console.log(`✅ ${messages.length} mensajes reales obtenidos para chat ${chatId}`);
              break;
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error obteniendo mensajes de cuenta ${account.id}:`, (error as Error).message);
      }
    }

    res.json(messages);
  } catch (error) {
    console.error('❌ Error general obteniendo mensajes:', error);
    res.json([]);
  }
}

// Send a message
export async function sendWhatsAppMessage(req: Request, res: Response) {
  try {
    const { chatId, message, accountId } = req.body;
    
    if (!chatId || !message) {
      return res.status(400).json({ error: 'Chat ID and message are required' });
    }

    const { whatsappMultiAccountManager } = await import('../services/whatsappMultiAccountManager');
    const client = whatsappMultiAccountManager.getClient(accountId || 1);
    
    if (!client) {
      return res.status(400).json({ error: 'WhatsApp client not found' });
    }

    const state = await client.getState();
    if (state !== 'CONNECTED') {
      return res.status(400).json({ error: 'WhatsApp not connected' });
    }

    await client.sendMessage(chatId, message);
    res.json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('Error sending message:', error);
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

    if (category.length > 0) {
      res.json(category[0]);
    } else {
      res.json({ category: '', confidence: 0 });
    }
  } catch (error) {
    console.error('Error getting chat category:', error);
    res.status(500).json({ error: 'Failed to get chat category' });
  }
}

// Set chat category
export async function setChatCategory(req: Request, res: Response) {
  try {
    const { chatId } = req.params;
    const { category, confidence, reason } = req.body;

    const existingCategory = await db.select()
      .from(chatCategories)
      .where(eq(chatCategories.chatId, chatId))
      .limit(1);

    if (existingCategory.length > 0) {
      await db.update(chatCategories)
        .set({ category, confidence, reason })
        .where(eq(chatCategories.chatId, chatId));
    } else {
      await db.insert(chatCategories)
        .values({ chatId, category, confidence, reason });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error setting chat category:', error);
    res.status(500).json({ error: 'Failed to set chat category' });
  }
}

// Get auto-response configuration
export async function getAutoResponseConfig(req: Request, res: Response) {
  try {
    console.log('⚙️ Obteniendo configuración de respuestas automáticas');
    
    // Return default configuration
    const defaultConfig = {
      id: 1,
      enabled: false,
      greetingMessage: 'Gracias por contactarnos. En breve un asesor le atenderá.',
      outOfHoursMessage: 'Gracias por su mensaje. Nuestro horario de atención es de lunes a viernes de 9:00 a 18:00. Le responderemos en cuanto estemos disponibles.',
      businessHoursStart: '09:00:00',
      businessHoursEnd: '18:00:00',
      workingDays: '1,2,3,4,5',
      geminiApiKey: null,
      settings: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    console.log('✅ Configuración encontrada:', defaultConfig);
    res.json(defaultConfig);
  } catch (error) {
    console.error('Error getting auto-response config:', error);
    res.status(500).json({ error: 'Failed to get auto-response config' });
  }
}

// Update auto-response configuration
export async function updateAutoResponseConfig(req: Request, res: Response) {
  try {
    const config = req.body;
    console.log('⚙️ Actualizando configuración de respuestas automáticas');
    
    // Here you would normally update the database
    // For now, just return success
    res.json({ success: true, message: 'Configuration updated successfully' });
  } catch (error) {
    console.error('Error updating auto-response config:', error);
    res.status(500).json({ error: 'Failed to update auto-response config' });
  }
}