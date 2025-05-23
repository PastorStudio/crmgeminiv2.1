import { Router } from 'express';
import { storage } from '../storage';

const router = Router();

// Obtener comentarios de un chat
router.get('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    
    const comments = await storage.getChatComments(chatId);
    res.json(comments);
  } catch (error) {
    console.error('Error al obtener comentarios:', error);
    res.status(500).json({ error: 'Error al obtener comentarios' });
  }
});

// Agregar comentario a un chat
router.post('/', async (req, res) => {
  try {
    const { chatId, comment } = req.body;
    
    if (!chatId || !comment) {
      return res.status(400).json({ error: 'Se requieren chatId y comment' });
    }

    // TODO: Obtener userId del usuario autenticado
    const userId = 1; // Por ahora usar usuario por defecto
    
    const newComment = await storage.createChatComment({
      chatId,
      userId,
      comment,
      createdAt: new Date()
    });
    
    res.json(newComment);
  } catch (error) {
    console.error('Error al agregar comentario:', error);
    res.status(500).json({ error: 'Error al agregar comentario' });
  }
});

export { router };