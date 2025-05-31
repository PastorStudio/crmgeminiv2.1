import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { whatsappMultiAccountManager } from '../services/whatsappMultiAccountManager';
import { z } from 'zod';

const router = Router();

// Get WhatsApp accounts for modern messaging
router.get('/whatsapp-accounts', async (req: Request, res: Response) => {
  try {
    const accounts = await storage.getWhatsAppAccounts();
    
    // Ensure we always return an array
    const validAccounts = Array.isArray(accounts) ? accounts : [];
    
    // Transform data for frontend compatibility with real-time status
    const transformedAccounts = validAccounts.map(account => {
      // Get real-time status from WhatsApp manager
      let realTimeStatus = 'disconnected';
      try {
        const instance = whatsappMultiAccountManager?.getInstance(account.id);
        if (instance) {
          if (instance.status.authenticated) {
            realTimeStatus = 'connected';
          } else if (instance.status.qrCode) {
            realTimeStatus = 'waiting_qr';
          } else if (instance.status.initialized) {
            realTimeStatus = 'initializing';
          }
        }
      } catch (error) {
        // Keep default disconnected status
      }

      return {
        id: account.id,
        name: account.name || 'Sin nombre',
        description: account.description || '',
        status: realTimeStatus,
        ownerName: account.ownerName || '',
        ownerPhone: account.ownerPhone || '',
        autoResponseEnabled: account.autoResponseEnabled || false,
        responseDelay: account.responseDelay || 1000,
        createdAt: account.createdAt,
        lastActivity: account.lastActivity,
        isConnected: realTimeStatus === 'connected'
      };
    });

    res.json({
      success: true,
      accounts: transformedAccounts
    });
  } catch (error) {
    console.error('Error fetching WhatsApp accounts:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener cuentas de WhatsApp',
      accounts: [] // Always provide empty array as fallback
    });
  }
});

// Get chats for a specific WhatsApp account
router.get('/chats/:accountId', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;
    
    // Get real WhatsApp chats using whatsapp-web.js
    const instance = whatsappMultiAccountManager?.getInstance(parseInt(accountId));
    
    if (!instance || !instance.client) {
      console.log(`WhatsApp account ${accountId} not connected`);
      return res.json({
        success: true,
        chats: []
      });
    }

    try {
      // Get real chats from WhatsApp
      const chats = await instance.client.getChats();
      
      // Transform real chats to frontend format
      const formattedChats = await Promise.all(chats.slice(0, 20).map(async (chat: any) => {
        let lastMessage = 'Sin mensajes';
        let timestamp = new Date().toISOString();
        
        try {
          const messages = await chat.fetchMessages({ limit: 1 });
          if (messages.length > 0) {
            const lastMsg = messages[0];
            lastMessage = lastMsg.body || 'Archivo multimedia';
            timestamp = lastMsg.timestamp ? new Date(lastMsg.timestamp * 1000).toISOString() : timestamp;
          }
        } catch (msgError) {
          console.log('Error fetching last message for chat:', msgError);
        }

        // Get contact info and profile picture
        let contactName = chat.name || 'Sin nombre';
        let profilePicUrl = '';
        
        try {
          const contact = await chat.getContact();
          contactName = contact.pushname || contact.name || contact.number || contactName;
          profilePicUrl = await contact.getProfilePicUrl() || '';
        } catch (contactError) {
          console.log('Error fetching contact info:', contactError);
        }

        return {
          id: chat.id._serialized || chat.id,
          name: contactName,
          lastMessage: lastMessage,
          timestamp: timestamp,
          unreadCount: chat.unreadCount || 0,
          avatar: profilePicUrl,
          status: 'unknown',
          type: chat.isGroup ? 'group' : 'individual',
          phoneNumber: chat.id.user || '',
          accountId: parseInt(accountId)
        };
      }));

      res.json({
        success: true,
        chats: formattedChats
      });
    } catch (whatsappError) {
      console.error('Error fetching real WhatsApp chats:', whatsappError);
      // Return empty array if WhatsApp is not ready
      res.json({
        success: true,
        chats: []
      });
    }
  } catch (error) {
    console.error('Error in chats endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener chats',
      chats: []
    });
  }
});

// Get messages for a specific chat
router.get('/messages/:chatId', async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    
    const { accountId } = req.query;
    
    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'Account ID is required',
        messages: []
      });
    }

    // Get real WhatsApp messages using whatsapp-web.js
    const instance = whatsappMultiAccountManager?.getInstance(parseInt(accountId as string));
    
    if (!instance || !instance.client) {
      console.log(`WhatsApp account ${accountId} not connected for messages`);
      return res.json({
        success: true,
        messages: []
      });
    }

    try {
      // Get real chat and messages from WhatsApp
      const chat = await instance.client.getChatById(chatId);
      const messages = await chat.fetchMessages({ limit: 50 });

      // Transform real messages to frontend format
      const formattedMessages = await Promise.all(messages.map(async (msg: any) => {
        let senderInfo = {
          name: 'Usuario',
          avatar: ''
        };

        // Get sender information and profile picture for individual chats
        if (!chat.isGroup && !msg.fromMe) {
          try {
            const contact = await chat.getContact();
            senderInfo.name = contact.pushname || contact.name || contact.number || 'Usuario';
            senderInfo.avatar = await contact.getProfilePicUrl() || '';
          } catch (contactError) {
            console.log('Error fetching sender info:', contactError);
          }
        }

        return {
          id: msg.id._serialized || msg.id,
          chatId,
          content: msg.body || (msg.hasMedia ? 'Archivo multimedia' : ''),
          sender: msg.fromMe ? 'agent' : 'user',
          timestamp: msg.timestamp ? new Date(msg.timestamp * 1000).toISOString() : new Date().toISOString(),
          type: msg.type || 'text',
          hasMedia: msg.hasMedia || false,
          author: msg.fromMe ? 'agent' : senderInfo.name,
          authorAvatar: msg.fromMe ? '' : senderInfo.avatar,
          messageType: msg.type,
          quotedMsg: msg.hasQuotedMsg ? msg.quotedMsg?.body : null
        };
      }));

      res.json({
        success: true,
        messages: formattedMessages.reverse() // Show oldest first
      });
    } catch (chatError) {
      console.error(`Error fetching real messages for chat ${chatId}:`, chatError);
      res.json({
        success: true,
        messages: []
      });
    }
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener mensajes',
      messages: []
    });
  }
});

// Send a message
router.post('/send-message', async (req: Request, res: Response) => {
  try {
    const { chatId, content, type = 'text' } = req.body;
    
    if (!chatId || !content) {
      return res.status(400).json({
        success: false,
        error: 'chatId y content son requeridos'
      });
    }

    const newMessage = {
      id: `msg_${Date.now()}`,
      chatId,
      content,
      sender: 'agent',
      timestamp: new Date().toISOString(),
      type
    };

    res.json({
      success: true,
      message: newMessage
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      error: 'Error al enviar mensaje'
    });
  }
});

// Get chat assignments
router.get('/assignments', async (req: Request, res: Response) => {
  try {
    const assignments = await storage.getChatAssignments();
    res.json({
      success: true,
      assignments: Array.isArray(assignments) ? assignments : []
    });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener asignaciones',
      assignments: []
    });
  }
});

// Create chat assignment
router.post('/assignments', async (req: Request, res: Response) => {
  try {
    const { chatId, agentId, notes } = req.body;
    
    if (!chatId || !agentId) {
      return res.status(400).json({
        success: false,
        error: 'chatId y agentId son requeridos'
      });
    }

    const assignment = await storage.createChatAssignment({
      chatId,
      agentId,
      notes: notes || null,
      status: 'active'
    });

    res.json({
      success: true,
      assignment
    });
  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear asignación'
    });
  }
});

// Assignment endpoints
router.get('/assignment', async (req: Request, res: Response) => {
  res.json({
    success: true,
    assignment: {
      autoAssignEnabled: true,
      availableAgents: [],
      currentAssignments: []
    }
  });
});

// Tickets endpoints
router.get('/tickets', async (req: Request, res: Response) => {
  res.json({
    success: true,
    tickets: []
  });
});

// Comments endpoints
router.get('/comments', async (req: Request, res: Response) => {
  res.json({
    success: true,
    comments: []
  });
});

// Analytics endpoints
router.get('/analytics', async (req: Request, res: Response) => {
  res.json({
    success: true,
    analytics: {
      totalMessages: 0,
      activeChats: 0,
      responseTime: 0,
      satisfactionScore: 0
    }
  });
});

// Send message endpoint
router.post('/send-message', async (req: Request, res: Response) => {
  try {
    const { chatId, message, accountId } = req.body;
    
    if (!chatId || !message || !accountId) {
      return res.status(400).json({
        success: false,
        error: 'ChatId, message y accountId son requeridos'
      });
    }

    const instance = whatsappMultiAccountManager?.getInstance(parseInt(accountId));
    if (!instance || !instance.client) {
      return res.status(400).json({
        success: false,
        error: 'Cuenta de WhatsApp no conectada'
      });
    }

    // Send message through WhatsApp
    const sentMessage = await instance.client.sendMessage(chatId, message);
    
    res.json({
      success: true,
      message: {
        id: sentMessage.id._serialized || sentMessage.id,
        chatId,
        content: message,
        sender: 'agent',
        timestamp: new Date().toISOString(),
        type: 'text'
      }
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      error: 'Error al enviar mensaje'
    });
  }
});

// Analyze conversations endpoint
router.post('/analyze-conversations', async (req: Request, res: Response) => {
  res.json({
    success: true,
    analysis: {
      sentiment: 'neutral',
      topics: [],
      suggestions: []
    }
  });
});

export default router;