import { Router } from 'express';
import { storage } from '../storage';

const router = Router();

// Obtener asignación de agente de un chat por chat y cuenta
router.get('/by-chat', async (req, res) => {
  try {
    const { chatId, accountId } = req.query;
    
    if (!chatId || !accountId) {
      return res.status(400).json({ error: 'Se requiere chatId y accountId' });
    }
    
    // Usar el método que funciona correctamente
    const assignment = await storage.getChatAssignmentByChatId(chatId as string);
    
    if (assignment) {
      // Obtener información del agente
      const agent = await storage.getUser(assignment.assignedToId);
      res.json({ ...assignment, assignedTo: agent });
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error('Error al obtener asignación:', error);
    res.status(500).json({ error: 'Error al obtener asignación' });
  }
});

// Obtener asignación de agente de un chat (método legacy)
router.get('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    
    const assignment = await storage.getChatAssignmentByChatId(chatId);
    res.json(assignment);
  } catch (error) {
    console.error('Error al obtener asignación:', error);
    res.status(500).json({ error: 'Error al obtener asignación' });
  }
});

// Asignar o desasignar agente a un chat
router.post('/', async (req, res) => {
  try {
    console.log('📝 Asignación de chat (directo):', req.body);
    const { chatId, accountId, assignedToId } = req.body;
    
    if (!chatId || !accountId) {
      return res.status(400).json({ error: 'Se requiere chatId y accountId' });
    }

    let assignment;
    
    if (assignedToId === null || assignedToId === undefined) {
      // Desasignar agente
      await storage.removeChatAssignment(chatId);
      assignment = null;
    } else {
      // 🔥 FORZAR USO DIRECTO DE POSTGRESQL - NO MEMORIA VIRTUAL
      console.log('🔥 INSERTANDO DIRECTAMENTE EN POSTGRESQL DESDE ROUTER');
      
      const { db } = await import('../db');
      const { chatAssignments } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      
      // Borrar asignación existente
      await db.delete(chatAssignments).where(eq(chatAssignments.chatId, chatId));
      
      // Insertar nueva asignación DIRECTAMENTE en PostgreSQL
      const [newAssignment] = await db.insert(chatAssignments)
        .values({
          chatId,
          accountId: Number(accountId),
          assignedToId: Number(assignedToId),
          category: 'general',
          status: 'active',
          assignedAt: new Date(),
          lastActivityAt: new Date()
        })
        .returning();
      
      console.log('✅ ASIGNACIÓN GUARDADA DIRECTAMENTE EN POSTGRESQL:', newAssignment);
      assignment = newAssignment;
    }
    
    res.json(assignment);
  } catch (error) {
    console.error('Error al asignar agente:', error);
    res.status(500).json({ error: 'Error al asignar agente' });
  }
});

export { router };