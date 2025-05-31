import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { z } from 'zod';

const router = Router();

// Get WhatsApp accounts for modern messaging
router.get('/whatsapp-accounts', async (req: Request, res: Response) => {
  try {
    const accounts = await storage.getWhatsAppAccounts();
    
    // Ensure we always return an array
    const validAccounts = Array.isArray(accounts) ? accounts : [];
    
    // Transform data for frontend compatibility
    const transformedAccounts = validAccounts.map(account => ({
      id: account.id,
      name: account.name || 'Sin nombre',
      description: account.description || '',
      status: account.status || 'disconnected',
      ownerName: account.ownerName || '',
      ownerPhone: account.ownerPhone || '',
      autoResponseEnabled: account.autoResponseEnabled || false,
      responseDelay: account.responseDelay || 1000,
      createdAt: account.createdAt,
      lastActivity: account.lastActivity
    }));

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
    
    // For now, return demo chats
    const demoChats = [
      {
        id: 'chat1',
        name: 'Juan Pérez',
        lastMessage: 'Hola, tengo una consulta sobre el producto',
        timestamp: new Date().toISOString(),
        unreadCount: 2,
        avatar: '/avatars/user1.jpg',
        status: 'online',
        accountId: parseInt(accountId)
      },
      {
        id: 'chat2',
        name: 'María García',
        lastMessage: 'Gracias por la información',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        unreadCount: 0,
        avatar: '/avatars/user2.jpg',
        status: 'offline',
        accountId: parseInt(accountId)
      }
    ];

    res.json({
      success: true,
      chats: demoChats
    });
  } catch (error) {
    console.error('Error fetching chats:', error);
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
    
    // For now, return demo messages
    const demoMessages = [
      {
        id: 'msg1',
        chatId,
        content: 'Hola, ¿cómo están?',
        sender: 'user',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        type: 'text'
      },
      {
        id: 'msg2',
        chatId,
        content: 'Hola! Todo bien por aquí. ¿En qué te podemos ayudar?',
        sender: 'agent',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        type: 'text'
      },
      {
        id: 'msg3',
        chatId,
        content: 'Tengo una consulta sobre el producto que vi en su página',
        sender: 'user',
        timestamp: new Date().toISOString(),
        type: 'text'
      }
    ];

    res.json({
      success: true,
      messages: demoMessages
    });
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

export default router;