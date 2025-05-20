import { Express, Request, Response } from "express";
import { db } from "../db";
import { SQL, eq, sql } from "drizzle-orm";
import { tickets, agents, users, activities, leads } from "@shared/schema";

export const dashboardRouter = (app: Express) => {
  
  // Endpoint para obtener estadísticas de tickets por agente
  app.get("/api/dashboard/tickets-by-agent", async (req: Request, res: Response) => {
    try {
      // Consulta para obtener estadísticas de tickets por agente
      const result = await db.execute(sql`
        SELECT 
          a.id as agent_id,
          a.name as agent_name,
          a.department,
          COUNT(CASE WHEN t.status IN ('nuevo', 'en_progreso') THEN 1 END) as pending_tickets,
          COUNT(CASE WHEN t.status = 'resuelto' THEN 1 END) as resolved_tickets,
          COUNT(CASE WHEN t.status = 'cancelado' THEN 1 END) as canceled_tickets,
          COUNT(t.id) as total_tickets,
          COALESCE(
            EXTRACT(EPOCH FROM AVG(
              CASE WHEN t.status = 'resuelto' AND t.created_at IS NOT NULL
              THEN NOW() - t.created_at
              END
            )) / 3600, 0
          ) as avg_resolution_time_hours
        FROM agents a
        LEFT JOIN tickets t ON t.assigned_agent_id = a.id
        GROUP BY a.id, a.name, a.department
        ORDER BY total_tickets DESC
      `);

      // Consulta para obtener la distribución de categorías
      const categoryDistribution = await db.execute(sql`
        SELECT 
          category,
          COUNT(*) as count
        FROM tickets
        GROUP BY category
        ORDER BY count DESC
      `);

      // Consulta para obtener la distribución de estados
      const statusDistribution = await db.execute(sql`
        SELECT 
          status,
          COUNT(*) as count
        FROM tickets
        GROUP BY status
        ORDER BY count DESC
      `);

      // Consulta para obtener totales
      const totalCounts = await db.execute(sql`
        SELECT 
          COUNT(*) as total_tickets,
          COUNT(CASE WHEN status IN ('nuevo', 'en_progreso') THEN 1 END) as total_pending,
          COUNT(CASE WHEN status = 'resuelto' THEN 1 END) as total_resolved,
          COUNT(CASE WHEN status = 'cancelado' THEN 1 END) as total_canceled
        FROM tickets
      `);

      // Si no hay datos, devolver valores por defecto
      const totals = totalCounts.length > 0 ? totalCounts[0] : {
        total_tickets: 0,
        total_pending: 0,
        total_resolved: 0,
        total_canceled: 0
      };

      // Formatear los resultados para que coincidan con lo que espera el frontend
      // Asegurarnos de que result sea un array, no solo un objeto con comando SQL
      const formattedAgentStats = Array.isArray(result) ? result : [];
      
      // Devolver los datos al cliente
      res.json({
        agentStats: formattedAgentStats,
        totals: totals,
        categoryDistribution: Array.isArray(categoryDistribution) ? categoryDistribution : [],
        statusDistribution: Array.isArray(statusDistribution) ? statusDistribution : []
      });
    } catch (error) {
      console.error("Error al obtener estadísticas de tickets:", error);
      res.status(500).json({ error: "Error al obtener estadísticas de tickets" });
    }
  });

  // Endpoint para obtener eventos próximos (uno por cliente, máximo 5)
  app.get("/api/dashboard/upcoming-events", async (req: Request, res: Response) => {
    try {
      // Obtener actividades próximas con información del lead asociado
      const query = sql`
        WITH RankedActivities AS (
          SELECT 
            a.*,
            l.name AS lead_name,
            ROW_NUMBER() OVER (PARTITION BY a."leadId" ORDER BY a."scheduled" ASC) as row_num
          FROM activities a
          LEFT JOIN leads l ON a."leadId" = l.id
          WHERE a.completed = false AND a."scheduled" >= NOW()
          ORDER BY a."scheduled" ASC
        )
        SELECT * FROM RankedActivities 
        WHERE row_num = 1
        LIMIT 5
      `;

      const result = await db.execute(query);

      // Verificar si result es un array y formatearlo
      if (Array.isArray(result)) {
        // Formatear las propiedades para que coincidan con lo que espera el frontend
        const formattedResult = result.map(act => ({
          id: act.id,
          title: act.title || act.notes || 'Sin título',
          description: act.description || act.notes || '',
          type: act.type || 'task',
          startTime: act.scheduled || act.createdAt,
          endTime: null,
          leadId: act.leadId,
          leadName: act.lead_name || 'Cliente',
          userId: act.userId,
          completed: act.completed || false,
          createdAt: act.createdAt,
          updatedAt: null,
          isAutomatic: act.reminder || false
        }));

        res.json(formattedResult);
      } else {
        // Si no es un array, devolver un array vacío
        res.json([]);
      }
    } catch (error) {
      console.error("Error al obtener próximos eventos:", error);
      res.status(500).json({ error: "Error al obtener próximos eventos" });
    }
  });
}