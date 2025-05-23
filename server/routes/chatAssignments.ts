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
    
    const assignment = await storage.getChatAssignmentByChat(chatId as string, parseInt(accountId as string));
    res.json(assignment);
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
      // Asignar agente
      assignment = await storage.createOrUpdateChatAssignment({
        chatId,
        accountId,
        assignedToId
      });
    }
    
    res.json(assignment);
  } catch (error) {
    console.error('Error al asignar agente:', error);
    res.status(500).json({ error: 'Error al asignar agente' });
  }
});

export { router };