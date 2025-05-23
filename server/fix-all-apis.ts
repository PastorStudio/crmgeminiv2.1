import { Request, Response } from 'express';
import { db } from './db';
import { users, chatAssignments, chatComments, autoResponseConfig } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// ✅ ENDPOINT PARA ASIGNACIONES DE CHAT FUNCIONANDO
export async function getAssignmentByChat(req: Request, res: Response) {
  try {
    const { chatId, accountId } = req.query;
    console.log('🔍 Buscando asignación para:', { chatId, accountId });

    if (!chatId || !accountId) {
      return res.status(400).json({ error: 'chatId y accountId requeridos' });
    }

    // Buscar asignación en PostgreSQL
    const assignments = await db
      .select({
        id: chatAssignments.id,
        chatId: chatAssignments.chatId,
        accountId: chatAssignments.accountId,
        assignedToId: chatAssignments.assignedToId,
        category: chatAssignments.category,
        status: chatAssignments.status,
        assignedAt: chatAssignments.assignedAt,
        assignedTo: {
          id: users.id,
          username: users.username,
          fullName: users.fullName
        }
      })
      .from(chatAssignments)
      .leftJoin(users, eq(chatAssignments.assignedToId, users.id))
      .where(and(
        eq(chatAssignments.chatId, chatId as string),
        eq(chatAssignments.accountId, parseInt(accountId as string))
      ))
      .limit(1);

    if (assignments.length > 0) {
      console.log('✅ Asignación encontrada:', assignments[0]);
      return res.json(assignments[0]);
    } else {
      console.log('❌ No hay asignación para este chat');
      return res.json(null);
    }
  } catch (error) {
    console.error('❌ Error buscando asignación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ✅ ENDPOINT PARA CREAR ASIGNACIONES FUNCIONANDO
export async function createAssignmentFixed(req: Request, res: Response) {
  try {
    const { chatId, accountId, assignedToId, category } = req.body;
    console.log('💼 Creando asignación:', { chatId, accountId, assignedToId, category });

    if (!chatId || !accountId || !assignedToId) {
      return res.status(400).json({ error: 'Datos requeridos faltantes' });
    }

    // Crear asignación en PostgreSQL
    const [newAssignment] = await db
      .insert(chatAssignments)
      .values({
        chatId,
        accountId: parseInt(accountId),
        assignedToId: parseInt(assignedToId),
        category: category || 'general',
        status: 'active'
      })
      .returning();

    console.log('✅ Asignación creada exitosamente:', newAssignment);
    return res.json(newAssignment);
  } catch (error) {
    console.error('❌ Error creando asignación:', error);
    res.status(500).json({ error: 'Error creando asignación' });
  }
}

// ✅ ENDPOINT PARA COMENTARIOS FUNCIONANDO
export async function getCommentsFixed(req: Request, res: Response) {
  try {
    const { chatId } = req.params;
    console.log('💬 Obteniendo comentarios para chat:', chatId);

    const comments = await db
      .select({
        id: chatComments.id,
        chatId: chatComments.chatId,
        text: chatComments.text,
        timestamp: chatComments.timestamp,
        user: {
          id: users.id,
          username: users.username,
          fullName: users.fullName
        }
      })
      .from(chatComments)
      .leftJoin(users, eq(chatComments.userId, users.id))
      .where(eq(chatComments.chatId, chatId))
      .orderBy(chatComments.timestamp);

    console.log(`✅ Encontrados ${comments.length} comentarios`);
    return res.json(comments);
  } catch (error) {
    console.error('❌ Error obteniendo comentarios:', error);
    res.status(500).json({ error: 'Error obteniendo comentarios' });
  }
}

// ✅ ENDPOINT PARA CREAR COMENTARIOS FUNCIONANDO
export async function createCommentFixed(req: Request, res: Response) {
  try {
    const { chatId, text, comment, userId = 1 } = req.body;
    const commentText = text || comment;
    
    console.log('💬 Creando comentario:', { chatId, commentText, userId });

    if (!chatId || !commentText) {
      return res.status(400).json({ error: 'chatId y texto requeridos' });
    }

    const [newComment] = await db
      .insert(chatComments)
      .values({
        chatId,
        userId,
        text: commentText,
        isInternal: true
      })
      .returning();

    console.log('✅ Comentario creado exitosamente:', newComment);
    return res.json(newComment);
  } catch (error) {
    console.error('❌ Error creando comentario:', error);
    res.status(500).json({ error: 'Error creando comentario' });
  }
}

// ✅ ENDPOINT PARA CONFIGURACIÓN DE RESPUESTAS AUTOMÁTICAS
export async function getAutoResponseConfigFixed(req: Request, res: Response) {
  try {
    console.log('⚙️ Obteniendo configuración de respuestas automáticas');

    const configs = await db
      .select()
      .from(autoResponseConfig)
      .limit(1);

    if (configs.length > 0) {
      console.log('✅ Configuración encontrada:', configs[0]);
      return res.json(configs[0]);
    } else {
      // Crear configuración por defecto
      const [defaultConfig] = await db
        .insert(autoResponseConfig)
        .values({
          enabled: false,
          provider: 'gemini',
          welcomeMessage: 'Hola, gracias por contactarnos. En breve le atenderemos.',
          maxResponsesPerDay: 50,
          responseDelay: 2
        })
        .returning();

      console.log('✅ Configuración por defecto creada:', defaultConfig);
      return res.json(defaultConfig);
    }
  } catch (error) {
    console.error('❌ Error obteniendo configuración:', error);
    res.status(500).json({ error: 'Error obteniendo configuración' });
  }
}

// ✅ ENDPOINT PARA GUARDAR CONFIGURACIÓN DE RESPUESTAS AUTOMÁTICAS
export async function saveAutoResponseConfigFixed(req: Request, res: Response) {
  try {
    const configData = req.body;
    console.log('💾 Guardando configuración:', configData);

    // Verificar si existe configuración
    const existingConfigs = await db
      .select()
      .from(autoResponseConfig)
      .limit(1);

    let savedConfig;
    
    if (existingConfigs.length > 0) {
      // Actualizar configuración existente
      [savedConfig] = await db
        .update(autoResponseConfig)
        .set({
          ...configData,
          updatedAt: new Date()
        })
        .where(eq(autoResponseConfig.id, existingConfigs[0].id))
        .returning();
    } else {
      // Crear nueva configuración
      [savedConfig] = await db
        .insert(autoResponseConfig)
        .values(configData)
        .returning();
    }

    console.log('✅ Configuración guardada exitosamente:', savedConfig);
    return res.json(savedConfig);
  } catch (error) {
    console.error('❌ Error guardando configuración:', error);
    res.status(500).json({ error: 'Error guardando configuración' });
  }
}