/**
 * Rutas para gestionar asignaciones de chats a agentes
 */
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { chatAssignments, whatsappAccounts, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { storage } from '../storage';
import { whatsappMultiAccountManager } from '../services/whatsappMultiAccountManager';

const router = Router();

// Middleware para verificar que el usuario es administrador o supervisor
const isAdminOrSupervisor = (req: Request, res: Response, next: Function) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  
  if (['admin', 'super_admin', 'supervisor'].includes(user.role)) {
    return next();
  }
  
  return res.status(403).json({ error: 'No autorizado' });
};

// Obtener todas las asignaciones de chat
router.get('/', async (req: Request, res: Response) => {
  try {
    // Buscar asignaciones en la base de datos
    const assignments = await db.select().from(chatAssignments);
    
    // Obtener información detallada de cada asignación
    const assignmentsWithDetails = await Promise.all(
      assignments.map(async (assignment) => {
        const account = await db.select().from(whatsappAccounts).where(eq(whatsappAccounts.id, assignment.accountId)).limit(1);
        const assignedTo = await db.select().from(users).where(eq(users.id, assignment.assignedToId)).limit(1);
        let assignedBy = null;
        if (assignment.assignedById) {
          assignedBy = await db.select().from(users).where(eq(users.id, assignment.assignedById)).limit(1);
        }
        
        // Intentar obtener información del chat desde WhatsApp
        let chatInfo = null;
        try {
          const chats = await whatsappMultiAccountManager.getChats(assignment.accountId);
          chatInfo = chats.find(chat => chat.id === assignment.chatId);
        } catch (error) {
          console.error(`Error al obtener información del chat ${assignment.chatId}:`, error);
        }
        
        return {
          ...assignment,
          accountInfo: account[0] || null,
          assignedTo: assignedTo[0] || null,
          assignedBy: assignedBy?.[0] || null,
          chatInfo: chatInfo || { 
            id: assignment.chatId,
            name: assignment.chatId.split('@')[0],
            isGroup: assignment.chatId.includes('-')
          }
        };
      })
    );
    
    res.json(assignmentsWithDetails);
  } catch (error) {
    console.error('Error al obtener asignaciones de chat:', error);
    res.status(500).json({ error: 'Error al obtener asignaciones de chat' });
  }
});

// Obtener asignación de chat por ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const assignment = await storage.getChatAssignment(id);
    
    if (!assignment) {
      return res.status(404).json({ error: 'Asignación de chat no encontrada' });
    }
    
    res.json(assignment);
  } catch (error) {
    console.error('Error al obtener asignación de chat:', error);
    res.status(500).json({ error: 'Error al obtener asignación de chat' });
  }
});

// Obtener asignación de chat por ID de chat
router.get('/by-chat', async (req: Request, res: Response) => {
  try {
    const { chatId, accountId } = req.query;
    
    if (!chatId || !accountId) {
      return res.status(400).json({ error: 'Se requiere chatId y accountId' });
    }
    
    const assignment = await storage.getChatAssignmentByChatId(chatId as string, parseInt(accountId as string));
    
    if (!assignment) {
      return res.status(404).json({ error: 'Asignación de chat no encontrada' });
    }
    
    // Asegurarse de que la información del agente sea consistente
    if (assignment.assignedTo) {
      // Si el usuario tiene fullName pero no name, copiar fullName a name
      if (assignment.assignedTo.fullName && !assignment.assignedTo.name) {
        assignment.assignedTo.name = assignment.assignedTo.fullName;
      }
      // Si tiene name pero no fullName, copiar name a fullName
      else if (assignment.assignedTo.name && !assignment.assignedTo.fullName) {
        assignment.assignedTo.fullName = assignment.assignedTo.name;
      }
      // Si no tiene ninguno, usar username como fallback
      else if (!assignment.assignedTo.name && !assignment.assignedTo.fullName) {
        assignment.assignedTo.name = assignment.assignedTo.username;
        assignment.assignedTo.fullName = assignment.assignedTo.username;
      }
    }
    
    res.json(assignment);
  } catch (error) {
    console.error('Error al obtener asignación de chat por chatId:', error);
    res.status(500).json({ error: 'Error al obtener asignación de chat por chatId' });
  }
});

// Crear asignación de chat
router.post('/', isAdminOrSupervisor, async (req: Request, res: Response) => {
  try {
    const { chatId, accountId, assignedToId, category, notes } = req.body;
    
    if (!chatId || !accountId || !assignedToId) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    
    // Verificar si el chat ya está asignado
    const existingAssignment = await storage.getChatAssignmentByChatId(chatId, accountId);
    if (existingAssignment) {
      return res.status(409).json({ error: 'Este chat ya está asignado' });
    }
    
    // Crear asignación
    const assignment = await storage.createChatAssignment({
      chatId,
      accountId,
      assignedToId,
      assignedById: req.user?.id,
      category,
      notes,
      status: 'active'
    });
    
    res.status(201).json(assignment);
  } catch (error) {
    console.error('Error al crear asignación de chat:', error);
    res.status(500).json({ error: 'Error al crear asignación de chat' });
  }
});

// Actualizar asignación de chat
router.put('/:id', isAdminOrSupervisor, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { assignedToId, category, status, notes } = req.body;
    
    // Verificar si la asignación existe
    const existingAssignment = await storage.getChatAssignment(id);
    if (!existingAssignment) {
      return res.status(404).json({ error: 'Asignación de chat no encontrada' });
    }
    
    // Actualizar asignación
    const updatedAssignment = await storage.updateChatAssignment(id, {
      assignedToId,
      category,
      status,
      notes,
      assignedById: req.user?.id
    });
    
    res.json(updatedAssignment);
  } catch (error) {
    console.error('Error al actualizar asignación de chat:', error);
    res.status(500).json({ error: 'Error al actualizar asignación de chat' });
  }
});

// Eliminar asignación de chat
router.delete('/:id', isAdminOrSupervisor, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    // Verificar si la asignación existe
    const existingAssignment = await storage.getChatAssignment(id);
    if (!existingAssignment) {
      return res.status(404).json({ error: 'Asignación de chat no encontrada' });
    }
    
    // Eliminar asignación
    await storage.deleteChatAssignment(id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar asignación de chat:', error);
    res.status(500).json({ error: 'Error al eliminar asignación de chat' });
  }
});

export default router;