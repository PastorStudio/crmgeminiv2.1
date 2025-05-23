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
    console.log('💬 Creando comentario:', req.body);
    const { chatId, text } = req.body;
    
    if (!chatId || !text) {
      return res.status(400).json({ error: 'Se requieren chatId y text' });
    }

    const comment = await storage.createChatComment({ chatId, text });
    res.json(comment);
    
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