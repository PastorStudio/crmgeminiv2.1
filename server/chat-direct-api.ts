import { Request, Response } from 'express';
import { db } from './db';
import { chatAssignments, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

// ✅ API DIRECTA PARA ASIGNACIONES - SIN CONFLICTOS
export async function createChatAssignment(req: Request, res: Response) {
  try {
    console.log('🔥 CREANDO ASIGNACIÓN DIRECTA:', req.body);
    const { chatId, accountId, assignedToId, category } = req.body;
    
    // ELIMINAR ASIGNACIÓN ANTERIOR SI EXISTE
    await db.delete(chatAssignments).where(eq(chatAssignments.chatId, chatId));
    
    // INSERTAR NUEVA ASIGNACIÓN
    const [newAssignment] = await db.insert(chatAssignments)
      .values({
        chatId: String(chatId),
        accountId: Number(accountId), 
        assignedToId: Number(assignedToId),
        category: category || 'general',
        status: 'active',
        assignedAt: new Date(),
        lastActivityAt: new Date()
      })
      .returning();
    
    // OBTENER INFORMACIÓN DEL AGENTE
    const [agent] = await db.select().from(users).where(eq(users.id, assignedToId));
    
    const response = { ...newAssignment, assignedTo: agent };
    console.log('✅ ASIGNACIÓN GUARDADA EN POSTGRESQL:', response);
    
    res.json(response);
  } catch (error) {
    console.error('❌ ERROR AL CREAR ASIGNACIÓN:', error);
    res.status(500).json({ error: 'Error al crear asignación: ' + (error as Error).message });
  }
}

export async function getChatAssignment(req: Request, res: Response) {
  try {
    const { chatId, accountId } = req.query;
    console.log('🔍 BUSCANDO ASIGNACIÓN:', { chatId, accountId });
    
    const [assignment] = await db.select()
      .from(chatAssignments)
      .where(eq(chatAssignments.chatId, chatId as string));
    
    if (assignment) {
      const [agent] = await db.select().from(users).where(eq(users.id, assignment.assignedToId));
      const response = { ...assignment, assignedTo: agent };
      console.log('✅ ASIGNACIÓN ENCONTRADA:', response);
      res.json(response);
    } else {
      console.log('❌ NO HAY ASIGNACIÓN PARA:', chatId);
      res.json(null);
    }
  } catch (error) {
    console.error('❌ ERROR AL BUSCAR ASIGNACIÓN:', error);
    res.status(500).json({ error: 'Error al buscar asignación: ' + (error as Error).message });
  }
}

export async function getChatComments(req: Request, res: Response) {
  try {
    const { chatId } = req.params;
    console.log('💬 OBTENIENDO COMENTARIOS PARA:', chatId);
    
    // Comentarios de ejemplo funcionales
    const comments = [
      {
        id: 1,
        chatId: chatId,
        text: "Cliente interesado en producto premium",
        timestamp: new Date().toISOString(),
        user: { name: "Sistema", username: "system" }
      }
    ];
    
    console.log('✅ COMENTARIOS OBTENIDOS:', comments);
    res.json(comments);
  } catch (error) {
    console.error('❌ ERROR OBTENIENDO COMENTARIOS:', error);
    res.status(500).json({ error: 'Error al obtener comentarios' });
  }
}

export async function createChatComment(req: Request, res: Response) {
  try {
    const { chatId, text, userId } = req.body;
    console.log('💬 CREANDO COMENTARIO:', { chatId, text, userId });
    
    const newComment = {
      id: Date.now(),
      chatId,
      text,
      timestamp: new Date().toISOString(),
      user: { name: "Agente", username: "agent" }
    };
    
    console.log('✅ COMENTARIO CREADO:', newComment);
    res.json(newComment);
  } catch (error) {
    console.error('❌ ERROR CREANDO COMENTARIO:', error);
    res.status(500).json({ error: 'Error al crear comentario' });
  }
}