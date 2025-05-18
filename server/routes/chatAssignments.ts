import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { insertChatAssignmentSchema } from '@shared/schema';
import { getWhatsAppClient } from '../services/whatsappService';

const router = Router();

// Obtener todas las asignaciones de chat (con filtros opcionales)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { accountId, agentId, category, query } = req.query;
    
    // Si el usuario no es admin o super_admin, solo puede ver sus propias asignaciones
    const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin');
    const userId = req.user ? req.user.id : null;
    
    if (!isAdmin && userId) {
      // Forzar a que solo vea sus propias asignaciones
      const userAssignments = await storage.getChatAssignmentsByAgent(userId);
      return res.json(userAssignments);
    }
    
    // Aplicar filtros si existen
    let assignments = await storage.getAllChatAssignments();
    
    if (accountId && accountId !== 'all') {
      assignments = assignments.filter(a => a.accountId === parseInt(accountId as string));
    }
    
    if (agentId && agentId !== 'all') {
      assignments = assignments.filter(a => a.assignedToId === parseInt(agentId as string));
    }
    
    if (category && category !== 'all') {
      assignments = assignments.filter(a => a.category === category);
    }
    
    if (query) {
      const searchTerm = (query as string).toLowerCase();
      assignments = assignments.filter(a => 
        a.chatId.toLowerCase().includes(searchTerm) || 
        (a.notes && a.notes.toLowerCase().includes(searchTerm))
      );
    }
    
    res.json(assignments);
  } catch (error) {
    console.error('Error al obtener asignaciones de chat:', error);
    res.status(500).json({ error: 'Error al obtener asignaciones de chat' });
  }
});

// Obtener una asignación específica
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const assignment = await storage.getChatAssignment(parseInt(id));
    
    if (!assignment) {
      return res.status(404).json({ error: 'Asignación de chat no encontrada' });
    }
    
    // Verificar si el usuario tiene acceso a esta asignación
    const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin');
    const isAssignedAgent = req.user && assignment.assignedToId === req.user.id;
    
    if (!isAdmin && !isAssignedAgent) {
      return res.status(403).json({ error: 'No tiene permisos para ver esta asignación' });
    }
    
    res.json(assignment);
  } catch (error) {
    console.error('Error al obtener asignación de chat:', error);
    res.status(500).json({ error: 'Error al obtener asignación de chat' });
  }
});

// Obtener asignación por chatId
router.get('/by-chat/:chatId', async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const assignment = await storage.getChatAssignmentByChatId(chatId);
    
    if (!assignment) {
      return res.status(404).json({ error: 'Asignación de chat no encontrada' });
    }
    
    // Verificar si el usuario tiene acceso a esta asignación
    const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin');
    const isAssignedAgent = req.user && assignment.assignedToId === req.user.id;
    
    if (!isAdmin && !isAssignedAgent) {
      return res.status(403).json({ error: 'No tiene permisos para ver esta asignación' });
    }
    
    res.json(assignment);
  } catch (error) {
    console.error('Error al obtener asignación de chat:', error);
    res.status(500).json({ error: 'Error al obtener asignación de chat' });
  }
});

// Crear una nueva asignación de chat
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validar los datos de entrada con el esquema
    const validation = insertChatAssignmentSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ error: 'Datos de entrada inválidos', details: validation.error });
    }
    
    // Verificar si el chat ya está asignado
    const existingAssignment = await storage.getChatAssignmentByChatId(req.body.chatId);
    
    if (existingAssignment) {
      return res.status(400).json({ error: 'Este chat ya está asignado a un agente' });
    }
    
    // Si hay un usuario autenticado, marcarlo como el que hizo la asignación
    if (req.user && req.user.id) {
      req.body.assignedById = req.user.id;
    }
    
    // Crear la asignación
    const newAssignment = await storage.createChatAssignment(req.body);
    
    res.status(201).json(newAssignment);
  } catch (error) {
    console.error('Error al crear asignación de chat:', error);
    res.status(500).json({ error: 'Error al crear asignación de chat' });
  }
});

// Actualizar una asignación de chat
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const assignmentId = parseInt(id);
    
    // Verificar si la asignación existe
    const existingAssignment = await storage.getChatAssignment(assignmentId);
    
    if (!existingAssignment) {
      return res.status(404).json({ error: 'Asignación de chat no encontrada' });
    }
    
    // Verificar si el usuario tiene permisos para actualizar
    const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin');
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'No tiene permisos para actualizar esta asignación' });
    }
    
    // Actualizar la asignación
    const updatedAssignment = await storage.updateChatAssignment(assignmentId, req.body);
    
    res.json(updatedAssignment);
  } catch (error) {
    console.error('Error al actualizar asignación de chat:', error);
    res.status(500).json({ error: 'Error al actualizar asignación de chat' });
  }
});

// Eliminar una asignación de chat
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const assignmentId = parseInt(id);
    
    // Verificar si la asignación existe
    const existingAssignment = await storage.getChatAssignment(assignmentId);
    
    if (!existingAssignment) {
      return res.status(404).json({ error: 'Asignación de chat no encontrada' });
    }
    
    // Verificar si el usuario tiene permisos para eliminar
    const isAdmin = req.user && (req.user.role === 'admin' || req.user.role === 'super_admin');
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'No tiene permisos para eliminar esta asignación' });
    }
    
    // Eliminar la asignación
    await storage.deleteChatAssignment(assignmentId);
    
    res.json({ success: true, message: 'Asignación de chat eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar asignación de chat:', error);
    res.status(500).json({ error: 'Error al eliminar asignación de chat' });
  }
});

export default router;