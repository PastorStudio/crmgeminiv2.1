/**
 * API Routes para el Sistema Autónomo de WhatsApp
 */

import { Request, Response } from 'express';
import { db } from '../db';
import { leads, activities, messages } from '../../shared/schema';
import { eq, desc, sql, count } from 'drizzle-orm';
import { autonomousProcessor } from '../services/autonomousProcessor';

/**
 * Obtiene leads generados automáticamente con vista de tarjetas
 */
export async function getAutonomousLeads(req: Request, res: Response) {
  try {
    const { status, source } = req.query;

    let query = db.select({
      id: leads.id,
      name: leads.name,
      phone: leads.phone,
      company: leads.company,
      status: leads.status,
      priority: leads.priority,
      source: leads.source,
      value: leads.value,
      notes: leads.notes,
      tags: leads.tags,
      assignedTo: leads.assignedTo,
      lastContactDate: leads.lastContactDate,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt
    }).from(leads);

    // Filtrar por fuente autónoma si se especifica
    if (source === 'autonomous') {
      query = query.where(eq(leads.source, 'whatsapp_auto'));
    }

    if (status) {
      query = query.where(eq(leads.status, status as string));
    }

    const leadsData = await query.orderBy(desc(leads.createdAt)).limit(50);

    // Agregar métricas de actividad para cada lead
    const leadsWithActivity = await Promise.all(
      leadsData.map(async (lead) => {
        const [activityCount] = await db.select({ count: sql<number>`count(*)` })
          .from(activities)
          .where(eq(activities.leadId, lead.id));

        const [lastActivity] = await db.select()
          .from(activities)
          .where(eq(activities.leadId, lead.id))
          .orderBy(desc(activities.createdAt))
          .limit(1);

        return {
          ...lead,
          activityCount: activityCount.count,
          lastActivity: lastActivity?.createdAt || null,
          isAutonomous: lead.source === 'whatsapp_auto'
        };
      })
    );

    res.json({
      success: true,
      leads: leadsWithActivity,
      total: leadsWithActivity.length
    });

  } catch (error) {
    console.error('Error obteniendo leads autónomos:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo leads',
      error: error.message
    });
  }
}

/**
 * Obtiene estadísticas del sistema autónomo
 */
export async function getAutonomousStats(req: Request, res: Response) {
  try {
    const stats = await autonomousProcessor.getStats();

    // Métricas adicionales
    const [autonomousLeads] = await db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(eq(leads.source, 'whatsapp_auto'));

    const [hotLeads] = await db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(eq(leads.status, 'hot'));

    const [unprocessedMessages] = await db.select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(eq(messages.isProcessed, false));

    res.json({
      success: true,
      stats: {
        ...stats,
        autonomousLeads: autonomousLeads.count,
        hotLeads: hotLeads.count,
        unprocessedMessages: unprocessedMessages.count
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas',
      error: error.message
    });
  }
}

/**
 * Fuerza el procesamiento de mensajes pendientes
 */
export async function forceProcessMessages(req: Request, res: Response) {
  try {
    await autonomousProcessor.processNewMessages();

    res.json({
      success: true,
      message: 'Procesamiento forzado completado'
    });

  } catch (error) {
    console.error('Error forzando procesamiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error en procesamiento',
      error: error.message
    });
  }
}

/**
 * Procesa un mensaje específico manualmente
 */
export async function processSpecificMessage(req: Request, res: Response) {
  try {
    const { messageData } = req.body;

    if (!messageData) {
      return res.status(400).json({
        success: false,
        message: 'Datos del mensaje requeridos'
      });
    }

    await autonomousProcessor.forceProcess(messageData);

    res.json({
      success: true,
      message: 'Mensaje procesado exitosamente'
    });

  } catch (error) {
    console.error('Error procesando mensaje específico:', error);
    res.status(500).json({
      success: false,
      message: 'Error procesando mensaje',
      error: error.message
    });
  }
}

/**
 * Obtiene métricas de conversión en tiempo real
 */
export async function getConversionMetrics(req: Request, res: Response) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Leads generados hoy
    const [leadsToday] = await db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(sql`DATE(${leads.createdAt}) = CURRENT_DATE`);

    // Leads autónomos generados hoy
    const [autonomousLeadsToday] = await db.select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(sql`DATE(${leads.createdAt}) = CURRENT_DATE AND ${leads.source} = 'whatsapp_auto'`);

    // Mensajes procesados hoy
    const [messagesProcessedToday] = await db.select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(sql`DATE(${messages.createdAt}) = CURRENT_DATE AND ${messages.isProcessed} = true`);

    // Tasa de conversión
    const conversionRate = messagesProcessedToday.count > 0 
      ? (autonomousLeadsToday.count / messagesProcessedToday.count) * 100 
      : 0;

    // Distribución por prioridad
    const priorityDistribution = await db.select({
      priority: leads.priority,
      count: sql<number>`count(*)`
    })
    .from(leads)
    .where(eq(leads.source, 'whatsapp_auto'))
    .groupBy(leads.priority);

    res.json({
      success: true,
      metrics: {
        leadsToday: leadsToday.count,
        autonomousLeadsToday: autonomousLeadsToday.count,
        messagesProcessedToday: messagesProcessedToday.count,
        conversionRate: Math.round(conversionRate * 100) / 100,
        priorityDistribution
      }
    });

  } catch (error) {
    console.error('Error obteniendo métricas de conversión:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo métricas',
      error: error.message
    });
  }
}

/**
 * Obtiene actividad reciente del sistema autónomo
 */
export async function getRecentActivity(req: Request, res: Response) {
  try {
    const recentActivities = await db.select({
      id: activities.id,
      type: activities.type,
      title: activities.title,
      notes: activities.notes,
      leadId: activities.leadId,
      completed: activities.completed,
      createdAt: activities.createdAt
    })
    .from(activities)
    .where(sql`${activities.createdAt} > NOW() - INTERVAL '24 hours'`)
    .orderBy(desc(activities.createdAt))
    .limit(20);

    res.json({
      success: true,
      activities: recentActivities,
      total: recentActivities.length
    });

  } catch (error) {
    console.error('Error obteniendo actividad reciente:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo actividad',
      error: error.message
    });
  }
}