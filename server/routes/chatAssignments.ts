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
    console.log('📝 ASIGNACIÓN DE CHAT - INICIO:', req.body);
    const { chatId, accountId, assignedToId } = req.body;
    
    if (!chatId || !accountId) {
      console.log('❌ ERROR: Faltan parámetros obligatorios');
      return res.status(400).json({ error: 'Se requiere chatId y accountId' });
    }

    if (assignedToId === null || assignedToId === undefined) {
      // Desasignar agente
      console.log('🗑️ DESASIGNANDO AGENTE DE CHAT:', chatId);
      const { db } = await import('../db');
      const { chatAssignments } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      
      await db.delete(chatAssignments).where(eq(chatAssignments.chatId, chatId));
      console.log('✅ AGENTE DESASIGNADO EXITOSAMENTE');
      return res.json(null);
    }

    // ASIGNAR AGENTE DIRECTAMENTE EN POSTGRESQL
    console.log('🔥 ASIGNANDO AGENTE DIRECTAMENTE EN POSTGRESQL');
    
    const { db } = await import('../db');
    const { chatAssignments, users } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');
    
    // 1. Borrar asignación existente
    await db.delete(chatAssignments).where(eq(chatAssignments.chatId, chatId));
    console.log('🗑️ Asignación anterior eliminada');
    
    // 2. Insertar nueva asignación
    const insertData = {
      chatId: String(chatId),
      accountId: Number(accountId),
      assignedToId: Number(assignedToId),
      category: 'general',
      status: 'active',
      assignedAt: new Date(),
      lastActivityAt: new Date()
    };
    
    console.log('📊 DATOS A INSERTAR:', insertData);
    
    const [newAssignment] = await db.insert(chatAssignments)
      .values(insertData)
      .returning();
    
    console.log('✅ ASIGNACIÓN CREADA EN POSTGRESQL:', newAssignment);
    
    // 3. Obtener información del agente
    const [agent] = await db.select().from(users).where(eq(users.id, assignedToId));
    console.log('👤 AGENTE ENCONTRADO:', agent);
    
    // 4. Verificar que se guardó
    const [verification] = await db.select().from(chatAssignments).where(eq(chatAssignments.chatId, chatId));
    console.log('🔍 VERIFICACIÓN EN BD:', verification);
    
    const response = {
      ...newAssignment,
      assignedTo: agent
    };
    
    console.log('🎉 RESPUESTA FINAL:', response);
    res.json(response);
    
  } catch (error) {
    console.error('❌ ERROR CRÍTICO AL ASIGNAR AGENTE:', error);
    res.status(500).json({ error: 'Error al asignar agente: ' + error.message });
  }
});

export { router };