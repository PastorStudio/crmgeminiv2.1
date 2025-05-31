import { Router } from 'express';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Get all chats - using mock data for immediate functionality
router.get('/chats', async (req, res) => {
  try {
    const mockChats = [
      {
        id: '1347961@c.us',
        name: 'Juan Pérez',
        lastMessage: 'Hola, me interesa el producto',
        timestamp: '10:30 AM',
        unreadCount: 2,
        status: 'online',
        type: 'individual',
        phoneNumber: '+1 347 961 1717',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Juan'
      },
      {
        id: '1829293@c.us',
        name: 'María García',
        lastMessage: 'Gracias por la información',
        timestamp: '9:45 AM',
        unreadCount: 0,
        status: 'offline',
        type: 'individual',
        phoneNumber: '+1 829 293 0209',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Maria'
      },
      {
        id: '120363141@g.us',
        name: 'Grupo Ventas',
        lastMessage: 'Reunión a las 3pm',
        timestamp: '8:15 AM',
        unreadCount: 5,
        status: 'online',
        type: 'group',
        avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=GV'
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
    
    const mockMessages = [
      {
        id: '1',
        content: 'Hola, buenos días',
        fromMe: false,
        timestamp: '9:00 AM',
        type: 'text',
        status: 'read'
      },
      {
        id: '2',
        content: 'Buenos días! ¿En qué puedo ayudarte?',
        fromMe: true,
        timestamp: '9:02 AM',
        type: 'text',
        status: 'read'
      },
      {
        id: '3',
        content: 'Me interesa conocer más sobre sus productos',
        fromMe: false,
        timestamp: '9:05 AM',
        type: 'text',
        status: 'read'
      },
      {
        id: '4',
        content: 'Perfecto, te envío nuestro catálogo actualizado',
        fromMe: true,
        timestamp: '9:07 AM',
        type: 'text',
        status: 'delivered'
      }
    ];

    res.json(mockMessages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});

// Get users for assignments
router.get('/users', async (req, res) => {
  try {
    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        role: users.role
      })
      .from(users);

    res.json(allUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// Get assignment for a chat
router.get('/assignment/:chatId', async (req, res) => {
  try {
    const mockAssignment = {
      id: 1,
      chatId: req.params.chatId,
      assignedToId: 1,
      assignedTo: {
        id: 1,
        fullName: 'Ana López',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ana'
      },
      status: 'active',
      priority: 'high',
      category: 'sales'
    };

    res.json(mockAssignment);
  } catch (error) {
    console.error('Error fetching assignment:', error);
    res.status(500).json({ error: 'Error al obtener asignación' });
  }
});

// Get comments for a chat
router.get('/comments/:chatId', async (req, res) => {
  try {
    const mockComments = [
      {
        id: 1,
        chatId: req.params.chatId,
        content: 'Cliente muy interesado en el producto premium',
        user: {
          id: 1,
          fullName: 'Ana López',
          avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ana'
        },
        createdAt: '2025-05-31T10:30:00Z',
        isPrivate: false
      },
      {
        id: 2,
        chatId: req.params.chatId,
        content: 'Seguimiento programado para mañana',
        user: {
          id: 2,
          fullName: 'Carlos Ruiz',
          avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carlos'
        },
        createdAt: '2025-05-31T11:15:00Z',
        isPrivate: true
      }
    ];

    res.json(mockComments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Error al obtener comentarios' });
  }
});

// Get tickets for a chat
router.get('/tickets/:chatId', async (req, res) => {
  try {
    const mockTickets = [
      {
        id: 1,
        chatId: req.params.chatId,
        title: 'Consulta sobre precios',
        description: 'Cliente solicita información detallada sobre precios del producto premium',
        status: 'open',
        priority: 'medium',
        category: 'sales',
        assignedTo: {
          id: 1,
          fullName: 'Ana López'
        },
        createdAt: '2025-05-31T09:00:00Z',
        dueDate: '2025-06-02T17:00:00Z'
      }
    ];

    res.json(mockTickets);
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Error al obtener tickets' });
  }
});

// Get analytics for a chat
router.get('/analytics/:chatId', async (req, res) => {
  try {
    const mockAnalytics = {
      messageCount: 12,
      responseTime: 45,
      sentiment: 'positive',
      sentimentScore: 0.8,
      intent: 'purchase_inquiry',
      salesStage: 'consideration',
      conversionProbability: 0.75
    };

    res.json(mockAnalytics);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Error al obtener analíticas' });
  }
});

// Send a message
router.post('/send-message', async (req, res) => {
  try {
    const { chatId, content } = req.body;
    
    const newMessage = {
      id: Date.now().toString(),
      content,
      fromMe: true,
      timestamp: new Date().toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      type: 'text',
      status: 'sent'
    };

    res.json(newMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
});

// Create assignment
router.post('/assignment', async (req, res) => {
  try {
    const { chatId, assignedToId, priority, category } = req.body;
    
    const newAssignment = {
      id: Date.now(),
      chatId,
      assignedToId,
      status: 'active',
      priority: priority || 'medium',
      category: category || 'general',
      assignedAt: new Date().toISOString()
    };

    res.json(newAssignment);
  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({ error: 'Error al crear asignación' });
  }
});

// Create comment
router.post('/comments', async (req, res) => {
  try {
    const { chatId, content, isPrivate } = req.body;
    
    const newComment = {
      id: Date.now(),
      chatId,
      content,
      user: {
        id: 1,
        fullName: 'Usuario Actual',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=User'
      },
      createdAt: new Date().toISOString(),
      isPrivate: isPrivate || false
    };

    res.json(newComment);
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Error al crear comentario' });
  }
});

// Create ticket
router.post('/tickets', async (req, res) => {
  try {
    const { chatId, title, description, priority, category, dueDate } = req.body;
    
    const newTicket = {
      id: Date.now(),
      chatId,
      title,
      description,
      status: 'open',
      priority: priority || 'medium',
      category: category || 'support',
      assignedTo: {
        id: 1,
        fullName: 'Usuario Actual'
      },
      createdAt: new Date().toISOString(),
      dueDate: dueDate || null
    };

    res.json(newTicket);
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ error: 'Error al crear ticket' });
  }
});

export default router;