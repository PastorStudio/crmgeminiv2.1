import { Request, Response } from 'express';
import { db } from './db';
import { users, chatAssignments, chatComments, autoResponseConfig } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// ✅ PROBLEMA 1: ASIGNACIONES QUE SÍ FUNCIONAN Y SE GUARDAN
export async function createRealAssignment(req: Request, res: Response) {
  try {
    const { chatId, accountId, assignedToId, category } = req.body;
    console.log('🎯 CREANDO ASIGNACIÓN REAL:', { chatId, accountId, assignedToId, category });

    if (!chatId || !accountId || !assignedToId) {
      return res.status(400).json({ 
        error: 'Faltan datos requeridos',
        details: { chatId, accountId, assignedToId }
      });
    }

    // Verificar si ya existe una asignación y eliminarla
    await db
      .delete(chatAssignments)
      .where(and(
        eq(chatAssignments.chatId, chatId),
        eq(chatAssignments.accountId, parseInt(accountId))
      ));

    // Crear nueva asignación
    const [newAssignment] = await db
      .insert(chatAssignments)
      .values({
        chatId: chatId,
        accountId: parseInt(accountId),
        assignedToId: parseInt(assignedToId),
        category: category || 'general',
        status: 'active',
        assignedAt: new Date(),
        lastActivityAt: new Date()
      })
      .returning();

    // Obtener datos del agente asignado
    const [assignedAgent] = await db
      .select()
      .from(users)
      .where(eq(users.id, parseInt(assignedToId)));

    const result = {
      ...newAssignment,
      assignedTo: assignedAgent
    };

    console.log('✅ ASIGNACIÓN CREADA EXITOSAMENTE:', result);
    return res.status(201).json(result);
  } catch (error) {
    console.error('❌ Error creando asignación:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ✅ PROBLEMA 1: OBTENER ASIGNACIÓN ACTUAL QUE FUNCIONA
export async function getRealAssignment(req: Request, res: Response) {
  try {
    const { chatId, accountId } = req.query;
    console.log('🔍 BUSCANDO ASIGNACIÓN REAL:', { 
      chatId, 
      accountId, 
      fullQuery: req.query,
      url: req.url,
      path: req.path 
    });

    // Si no hay parámetros, devolver respuesta vacía válida
    if (!chatId || !accountId) {
      console.log('❌ Parámetros faltantes - devolviendo null');
      return res.json(null);
    }

    // Buscar asignación con JOIN para obtener datos del agente
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
          fullName: users.fullName,
          role: users.role
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
      console.log('✅ ASIGNACIÓN ENCONTRADA:', assignments[0]);
      return res.json(assignments[0]);
    } else {
      console.log('❌ NO HAY ASIGNACIÓN');
      return res.json(null);
    }
  } catch (error) {
    console.error('❌ Error buscando asignación:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ✅ PROBLEMA 2: COMENTARIOS QUE SÍ FUNCIONAN
export async function createRealComment(req: Request, res: Response) {
  try {
    const { chatId, text, comment, userId = 1 } = req.body;
    const commentText = text || comment;
    
    console.log('💬 CREANDO COMENTARIO REAL:', { chatId, commentText, userId });

    if (!chatId || !commentText) {
      return res.status(400).json({ 
        error: 'Datos requeridos faltantes',
        details: { chatId: !!chatId, text: !!commentText }
      });
    }

    // Crear comentario en PostgreSQL
    const [newComment] = await db
      .insert(chatComments)
      .values({
        chatId: chatId,
        userId: parseInt(userId),
        text: commentText,
        isInternal: true,
        timestamp: new Date()
      })
      .returning();

    // Obtener datos del usuario
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, parseInt(userId)));

    const result = {
      ...newComment,
      user: user
    };

    console.log('✅ COMENTARIO CREADO EXITOSAMENTE:', result);
    return res.status(201).json(result);
  } catch (error) {
    console.error('❌ Error creando comentario:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ✅ PROBLEMA 2: OBTENER COMENTARIOS QUE FUNCIONA
export async function getRealComments(req: Request, res: Response) {
  try {
    const { chatId } = req.params;
    console.log('💬 OBTENIENDO COMENTARIOS REALES:', chatId);

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

    console.log(`✅ ENCONTRADOS ${comments.length} COMENTARIOS REALES`);
    return res.json(comments);
  } catch (error) {
    console.error('❌ Error obteniendo comentarios:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ✅ PROBLEMA 3: RESPUESTAS AUTOMÁTICAS QUE SÍ SE GUARDAN Y MANTIENEN
export async function getRealAutoResponseConfig(req: Request, res: Response) {
  try {
    console.log('⚙️ OBTENIENDO CONFIGURACIÓN REAL DE RESPUESTAS AUTOMÁTICAS');

    let configs = await db
      .select()
      .from(autoResponseConfig)
      .limit(1);

    if (configs.length === 0) {
      // Crear configuración por defecto si no existe
      const [defaultConfig] = await db
        .insert(autoResponseConfig)
        .values({
          enabled: false,
          provider: 'gemini',
          welcomeMessage: 'Hola, gracias por contactarnos. En breve le atenderemos.',
          maxResponsesPerDay: 50,
          responseDelay: 2,
          updatedAt: new Date()
        })
        .returning();

      configs = [defaultConfig];
      console.log('✅ CONFIGURACIÓN POR DEFECTO CREADA:', defaultConfig);
    }

    console.log('✅ CONFIGURACIÓN REAL OBTENIDA:', configs[0]);
    return res.json(configs[0]);
  } catch (error) {
    console.error('❌ Error obteniendo configuración:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// ✅ PROBLEMA 3: GUARDAR CONFIGURACIÓN QUE SÍ PERSISTE
export async function saveRealAutoResponseConfig(req: Request, res: Response) {
  try {
    const configData = req.body;
    console.log('💾 GUARDANDO CONFIGURACIÓN REAL:', configData);

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
          enabled: configData.enabled ?? false,
          provider: configData.provider || 'gemini',
          welcomeMessage: configData.welcomeMessage,
          businessHours: configData.businessHours,
          maxResponsesPerDay: configData.maxResponsesPerDay || 50,
          responseDelay: configData.responseDelay || 2,
          updatedAt: new Date(),
          updatedBy: configData.updatedBy || 1
        })
        .where(eq(autoResponseConfig.id, existingConfigs[0].id))
        .returning();
    } else {
      // Crear nueva configuración
      [savedConfig] = await db
        .insert(autoResponseConfig)
        .values({
          enabled: configData.enabled ?? false,
          provider: configData.provider || 'gemini',
          welcomeMessage: configData.welcomeMessage,
          businessHours: configData.businessHours,
          maxResponsesPerDay: configData.maxResponsesPerDay || 50,
          responseDelay: configData.responseDelay || 2,
          updatedAt: new Date(),
          updatedBy: configData.updatedBy || 1
        })
        .returning();
    }

    console.log('✅ CONFIGURACIÓN GUARDADA PERMANENTEMENTE:', savedConfig);
    return res.json(savedConfig);
  } catch (error) {
    console.error('❌ Error guardando configuración:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}