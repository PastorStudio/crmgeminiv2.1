/**
 * Rutas para el dashboard
 */
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

export const dashboardRouter = Router();

// Obtener estadísticas de tickets por agente
dashboardRouter.get('/tickets-by-agent', async (_req: Request, res: Response) => {
  try {
    // Obtener estadísticas de tickets por agente
    const ticketsByAgent = await db.execute(sql`
      SELECT 
        a.id AS agent_id,
        a.name AS agent_name,
        a.department AS department,
        SUM(CASE WHEN t.status IN ('nuevo', 'en_progreso', 'sin_asignar') THEN 1 ELSE 0 END) AS pending_tickets,
        SUM(CASE WHEN t.status = 'resuelto' THEN 1 ELSE 0 END) AS resolved_tickets,
        SUM(CASE WHEN t.status = 'cancelado' THEN 1 ELSE 0 END) AS canceled_tickets,
        COUNT(t.id) AS total_tickets,
        AVG(EXTRACT(EPOCH FROM (t.updated_at - t.created_at))/3600)::numeric(10,2) AS avg_resolution_time_hours
      FROM 
        agents a
      LEFT JOIN 
        tickets t ON a.id = t.assigned_agent_id
      GROUP BY 
        a.id, a.name, a.department
      ORDER BY 
        COUNT(t.id) DESC
    `);
    
    // Obtener totales generales para todas las estadísticas
    const totals = await db.execute(sql`
      SELECT 
        COUNT(*) AS total_tickets,
        SUM(CASE WHEN status IN ('nuevo', 'en_progreso', 'sin_asignar') THEN 1 ELSE 0 END) AS total_pending,
        SUM(CASE WHEN status = 'resuelto' THEN 1 ELSE 0 END) AS total_resolved,
        SUM(CASE WHEN status = 'cancelado' THEN 1 ELSE 0 END) AS total_canceled
      FROM 
        tickets
    `);
    
    // Obtener distribución de tickets por categoría
    const ticketsByCategory = await db.execute(sql`
      SELECT 
        category,
        COUNT(*) AS count
      FROM 
        tickets
      GROUP BY 
        category
      ORDER BY 
        COUNT(*) DESC
    `);
    
    // Obtener distribución de tickets por estado
    const ticketsByStatus = await db.execute(sql`
      SELECT 
        status,
        COUNT(*) AS count
      FROM 
        tickets
      GROUP BY 
        status
      ORDER BY 
        COUNT(*) DESC
    `);
    
    res.json({
      agentStats: ticketsByAgent.rows || [],
      totals: totals.rows[0] || {
        total_tickets: 0,
        total_pending: 0,
        total_resolved: 0,
        total_canceled: 0
      },
      categoryDistribution: ticketsByCategory.rows || [],
      statusDistribution: ticketsByStatus.rows || []
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de tickets por agente:', error);
    res.status(500).json({ success: false, message: 'Error al obtener estadísticas' });
  }
});

// Obtener próximos eventos con un evento por cliente
dashboardRouter.get('/upcoming-events', async (_req: Request, res: Response) => {
  try {
    // Obtener los próximos 5 eventos, uno por cliente (lead_id)
    const upcomingEvents = await db.execute(sql`
      WITH RankedActivities AS (
        SELECT 
          a.*,
          l.name AS lead_name,
          ROW_NUMBER() OVER (PARTITION BY a.lead_id ORDER BY a.scheduled ASC) AS rn
        FROM 
          activities a
        LEFT JOIN 
          leads l ON a.lead_id = l.id
        WHERE 
          a.scheduled >= NOW() 
          AND a.completed = false
        ORDER BY 
          a.scheduled ASC
      )
      SELECT 
        id, 
        lead_id, 
        lead_name,
        type, 
        scheduled, 
        notes, 
        priority
      FROM 
        RankedActivities
      WHERE 
        rn = 1
      LIMIT 5
    `);
    
    const formattedEvents = upcomingEvents.rows.map(event => ({
      id: event.id,
      leadId: event.lead_id,
      leadName: event.lead_name || 'Cliente sin nombre',
      type: event.type,
      scheduled: event.scheduled,
      notes: event.notes,
      priority: event.priority
    }));
    
    res.json(formattedEvents);
  } catch (error) {
    console.error('Error al obtener próximos eventos:', error);
    res.status(500).json({ success: false, message: 'Error al obtener próximos eventos' });
  }
});