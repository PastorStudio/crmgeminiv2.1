import { Router } from 'express';
import { db } from '../db';
import { 
  chatAssignments, 
  chatComments, 
  modernTickets, 
  autoResponseConfigs,
  conversationAnalytics,
  notifications,
  users,
  whatsappAccounts
} from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

// Get all chats (mock data for now - will connect to WhatsApp later)
router.get('/chats', async (req, res) => {
  try {
    // Mock chat data - replace with actual WhatsApp data later
    const mockChats = [
      {
        id: '13479611717@c.us',
        name: 'Juan Pérez',
        lastMessage: 'Hola, me interesa el producto',
        timestamp: '10:30 AM',
        unreadCount: 2,
        status: 'online',
        type: 'individual',
        phoneNumber: '+1 347 961 1717'
      },
      {
        id: '18292930209@c.us',
        name: 'María García',
        lastMessage: 'Gracias por la información',
        timestamp: '9:45 AM',
        unreadCount: 0,
        status: 'offline',
        type: 'individual',
        phoneNumber: '+1 829 293 0209'
      },
      {
        id: '120363141924296249@g.us',
        name: 'Grupo Ventas',
        lastMessage: 'Reunión a las 3pm',
        timestamp: '8:15 AM',
        unreadCount: 5,
        status: 'online',
        type: 'group'
      }
    ];

    res.json(mockChats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ error: 'Error al obtener chats' });
  }
});

// Get messages for a specific chat
router.get('/messages/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    
    // Mock message data - replace with actual WhatsApp messages later
    const mockMessages = [
      {
        id: 'msg1',
        content: 'Hola, buenos días',
        fromMe: false,
        timestamp: '9:00 AM',
        type: 'text',
        status: 'read'
      },
      {
        id: 'msg2',
        content: 'Buenos días! ¿En qué puedo ayudarle?',
        fromMe: true,
        timestamp: '9:01 AM',
        type: 'text',
        status: 'read'
      },
      {
        id: 'msg3',
        content: 'Me interesa conocer más sobre sus servicios',
        fromMe: false,
        timestamp: '9:02 AM',
        type: 'text',
        status: 'read'
      }
    ];

    res.json(mockMessages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});

// Send a message
router.post('/send-message', async (req, res) => {
  try {
    const { chatId, content } = req.body;
    
    // Here you would integrate with WhatsApp API to send the message
    // For now, we'll just return success
    
    res.json({ 
      success: true, 
      message: 'Mensaje enviado',
      data: {
        id: `msg_${Date.now()}`,
        content,
        fromMe: true,
        timestamp: new Date().toLocaleTimeString(),
        type: 'text',
        status: 'sent'
      }
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});

// Get chat assignment
router.get('/assignment/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    
    const assignment = await db
      .select({
        id: chatAssignments.id,
        chatId: chatAssignments.chatId,
        assignedToId: chatAssignments.assignedToId,
        status: chatAssignments.status,
        priority: chatAssignments.priority,
        category: chatAssignments.category,
        notes: chatAssignments.notes,
        assignedTo: {
          id: users.id,
          fullName: users.fullName,
          avatar: users.avatar
        }
      })
      .from(chatAssignments)
      .leftJoin(users, eq(chatAssignments.assignedToId, users.id))
      .where(eq(chatAssignments.chatId, chatId))
      .limit(1);

    res.json(assignment[0] || null);
  } catch (error) {
    console.error('Error fetching assignment:', error);
    res.status(500).json({ error: 'Error al obtener asignación' });
  }
});

// Assign chat to agent
router.post('/assign', async (req, res) => {
  try {
    const { chatId, assignedToId, category, priority } = req.body;
    
    // Check if assignment already exists
    const existing = await db
      .select()
      .from(chatAssignments)
      .where(eq(chatAssignments.chatId, chatId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing assignment
      await db
        .update(chatAssignments)
        .set({
          assignedToId,
          category,
          priority,
          lastActivityAt: new Date()
        })
        .where(eq(chatAssignments.chatId, chatId));
    } else {
      // Create new assignment
      await db
        .insert(chatAssignments)
        .values({
          chatId,
          assignedToId,
          category,
          priority,
          accountId: 1, // Default account for now
          assignedById: 1 // Current user - should come from session
        });
    }

    res.json({ success: true, message: 'Chat asignado exitosamente' });
  } catch (error) {
    console.error('Error assigning chat:', error);
    res.status(500).json({ error: 'Error al asignar chat' });
  }
});

// Get comments for a chat
router.get('/comments/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    
    const comments = await db
      .select({
        id: chatComments.id,
        chatId: chatComments.chatId,
        content: chatComments.content,
        isPrivate: chatComments.isPrivate,
        createdAt: chatComments.createdAt,
        user: {
          id: users.id,
          fullName: users.fullName,
          avatar: users.avatar
        }
      })
      .from(chatComments)
      .leftJoin(users, eq(chatComments.userId, users.id))
      .where(eq(chatComments.chatId, chatId))
      .orderBy(desc(chatComments.createdAt));

    res.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Error al obtener comentarios' });
  }
});

// Add comment to chat
router.post('/comments', async (req, res) => {
  try {
    const { chatId, content, isPrivate = true } = req.body;
    
    const [comment] = await db
      .insert(chatComments)
      .values({
        chatId,
        content,
        isPrivate,
        userId: 1, // Current user - should come from session
        accountId: 1 // Default account
      })
      .returning();

    // Create notification for mentioned users or assigned agent
    await db
      .insert(notifications)
      .values({
        userId: 1, // Should be the assigned agent
        type: 'comment',
        title: 'Nuevo comentario',
        message: `Nuevo comentario en el chat: ${content.substring(0, 50)}...`,
        data: { chatId, commentId: comment.id }
      });

    res.json({ success: true, comment });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Error al agregar comentario' });
  }
});

// Get tickets for a chat
router.get('/tickets/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    
    const tickets = await db
      .select({
        id: modernTickets.id,
        chatId: modernTickets.chatId,
        title: modernTickets.title,
        description: modernTickets.description,
        status: modernTickets.status,
        priority: modernTickets.priority,
        category: modernTickets.category,
        createdAt: modernTickets.createdAt,
        dueDate: modernTickets.dueDate,
        assignedTo: {
          id: users.id,
          fullName: users.fullName
        }
      })
      .from(modernTickets)
      .leftJoin(users, eq(modernTickets.assignedToId, users.id))
      .where(eq(modernTickets.chatId, chatId))
      .orderBy(desc(modernTickets.createdAt));

    res.json(tickets);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Error al obtener tickets' });
  }
});

// Create ticket
router.post('/tickets', async (req, res) => {
  try {
    const { chatId, title, description, priority, category, dueDate } = req.body;
    
    const [ticket] = await db
      .insert(modernTickets)
      .values({
        chatId,
        title,
        description,
        priority,
        category,
        dueDate: dueDate ? new Date(dueDate) : null,
        accountId: 1, // Default account
        createdById: 1, // Current user
        assignedToId: 1 // Could be auto-assigned or manual
      })
      .returning();

    // Create notification
    await db
      .insert(notifications)
      .values({
        userId: 1, // Assigned user
        type: 'ticket',
        title: 'Nuevo ticket creado',
        message: `Ticket: ${title}`,
        data: { chatId, ticketId: ticket.id }
      });

    res.json({ success: true, ticket });
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ error: 'Error al crear ticket' });
  }
});

// Get conversation analytics
router.get('/analytics/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    
    const analytics = await db
      .select()
      .from(conversationAnalytics)
      .where(eq(conversationAnalytics.chatId, chatId))
      .limit(1);

    if (analytics.length === 0) {
      // Return default analytics if none exist
      res.json({
        messageCount: 0,
        responseTime: 0,
        sentiment: 'neutral',
        sentimentScore: 0,
        intent: 'inquiry',
        salesStage: 'lead',
        conversionProbability: 0
      });
    } else {
      res.json(analytics[0]);
    }
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Error al obtener analíticas' });
  }
});

// Auto-assign chats
router.post('/auto-assign', async (req, res) => {
  try {
    // Get all unassigned chats (mock implementation)
    const unassignedChats = ['13479611717@c.us', '18292930209@c.us'];
    
    // Get available agents
    const agents = await db
      .select()
      .from(users)
      .where(eq(users.role, 'agent'));

    let assignmentCount = 0;
    
    for (const chatId of unassignedChats) {
      // Check if already assigned
      const existing = await db
        .select()
        .from(chatAssignments)
        .where(eq(chatAssignments.chatId, chatId))
        .limit(1);

      if (existing.length === 0 && agents.length > 0) {
        // Simple round-robin assignment
        const agent = agents[assignmentCount % agents.length];
        
        await db
          .insert(chatAssignments)
          .values({
            chatId,
            assignedToId: agent.id,
            category: 'support',
            priority: 'medium',
            accountId: 1,
            assignedById: 1
          });

        assignmentCount++;
      }
    }

    res.json({ 
      success: true, 
      message: `${assignmentCount} chats asignados automáticamente`,
      assignedCount: assignmentCount
    });
  } catch (error) {
    console.error('Error auto-assigning chats:', error);
    res.status(500).json({ error: 'Error en auto-asignación' });
  }
});

// Analyze conversations with AI
router.post('/analyze-conversations', async (req, res) => {
  try {
    // Mock AI analysis - replace with actual AI integration
    const chatsToAnalyze = ['13479611717@c.us', '18292930209@c.us'];
    
    for (const chatId of chatsToAnalyze) {
      // Check if analytics already exist
      const existing = await db
        .select()
        .from(conversationAnalytics)
        .where(eq(conversationAnalytics.chatId, chatId))
        .limit(1);

      const analyticsData = {
        chatId,
        accountId: 1,
        messageCount: Math.floor(Math.random() * 50) + 10,
        responseTime: Math.floor(Math.random() * 30) + 5,
        sentiment: ['positive', 'negative', 'neutral'][Math.floor(Math.random() * 3)],
        sentimentScore: (Math.random() * 2 - 1).toFixed(2),
        intent: ['sales', 'support', 'information', 'complaint'][Math.floor(Math.random() * 4)],
        salesStage: ['lead', 'qualified', 'proposal', 'negotiation'][Math.floor(Math.random() * 4)],
        conversionProbability: (Math.random()).toFixed(2),
        keywords: ['producto', 'precio', 'información'],
        topics: ['ventas', 'consulta'],
        aiInsights: {
          summary: 'Cliente interesado en productos',
          nextSteps: 'Enviar información detallada',
          urgency: 'medium'
        }
      };

      if (existing.length > 0) {
        await db
          .update(conversationAnalytics)
          .set(analyticsData)
          .where(eq(conversationAnalytics.chatId, chatId));
      } else {
        await db
          .insert(conversationAnalytics)
          .values(analyticsData);
      }
    }

    res.json({ 
      success: true, 
      message: 'Análisis de conversaciones completado',
      analyzedCount: chatsToAnalyze.length
    });
  } catch (error) {
    console.error('Error analyzing conversations:', error);
    res.status(500).json({ error: 'Error en análisis de conversaciones' });
  }
});

// Get auto-response config
router.get('/auto-response-config/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    const config = await db
      .select()
      .from(autoResponseConfigs)
      .where(eq(autoResponseConfigs.accountId, parseInt(accountId)))
      .limit(1);

    if (config.length === 0) {
      // Return default config
      res.json({
        enabled: false,
        aiProvider: 'gemini',
        responseDelay: 5,
        maxResponsesPerDay: 50,
        personalityPrompt: 'Eres un asistente amigable de atención al cliente.',
        contextWindow: 10
      });
    } else {
      res.json(config[0]);
    }
  } catch (error) {
    console.error('Error fetching auto-response config:', error);
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

// Update auto-response config
router.post('/auto-response-config', async (req, res) => {
  try {
    const {
      accountId,
      enabled,
      aiProvider,
      responseDelay,
      workingHours,
      triggers,
      excludeKeywords,
      maxResponsesPerDay,
      personalityPrompt,
      contextWindow
    } = req.body;

    const existing = await db
      .select()
      .from(autoResponseConfigs)
      .where(eq(autoResponseConfigs.accountId, accountId))
      .limit(1);

    const configData = {
      accountId,
      enabled,
      aiProvider,
      responseDelay,
      workingHours,
      triggers,
      excludeKeywords,
      maxResponsesPerDay,
      personalityPrompt,
      contextWindow,
      updatedAt: new Date()
    };

    if (existing.length > 0) {
      await db
        .update(autoResponseConfigs)
        .set(configData)
        .where(eq(autoResponseConfigs.accountId, accountId));
    } else {
      await db
        .insert(autoResponseConfigs)
        .values(configData);
    }

    res.json({ success: true, message: 'Configuración actualizada' });
  } catch (error) {
    console.error('Error updating auto-response config:', error);
    res.status(500).json({ error: 'Error al actualizar configuración' });
  }
});

export default router;