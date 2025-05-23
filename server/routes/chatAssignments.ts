import { Router } from 'express';
import { storage } from '../storage';

const router = Router();

// Obtener asignación de agente de un chat
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
    const { chatId, agentId } = req.body;
    
    if (!chatId) {
      return res.status(400).json({ error: 'Se requiere chatId' });
    }

    let assignment;
    
    if (agentId === null || agentId === undefined) {
      // Desasignar agente
      await storage.removeChatAssignment(chatId);
      assignment = null;
    } else {
      // Asignar agente
      assignment = await storage.createOrUpdateChatAssignment({
        chatId,
        agentId,
        assignedAt: new Date()
      });
    }
    
    res.json(assignment);
  } catch (error) {
    console.error('Error al asignar agente:', error);
    res.status(500).json({ error: 'Error al asignar agente' });
  }
});

export { router };