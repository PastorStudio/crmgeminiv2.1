import { Request, Response } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * API simplificada para leads que funciona con la estructura real de la base de datos
 */
export async function getLeadsSimple(req: Request, res: Response) {
  try {
    console.log("🔄 Ejecutando consulta SQL directa para obtener leads...");
    
    // Usar el pool de conexiones directamente
    const { Pool } = await import("@neondatabase/serverless");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    try {
      const result = await pool.query(`
        SELECT 
          id,
          name,
          email,
          phone,
          source,
          status,
          "assigneeId",
          company,
          budget,
          notes,
          priority,
          tags,
          "createdAt"
        FROM leads 
        ORDER BY "createdAt" DESC
      `);

      console.log(`✅ Se obtuvieron ${result.rows.length} leads de la base de datos`);

      // Transformar los datos para compatibilidad con el frontend
      const leadsData = result.rows.map((row: any) => ({
        id: row.id,
        title: row.name,
        name: row.name,
        email: row.email,
        phone: row.phone,
        source: row.source,
        status: row.status,
        assignedTo: row.assigneeId,
        company: row.company,
        budget: row.budget,
        notes: row.notes,
        priority: row.priority,
        tags: row.tags,
        createdAt: row.createdAt,
        // Valores por defecto para compatibilidad
        stage: 'lead',
        value: row.budget ? row.budget.toString() : '0',
        currency: 'USD',
        probability: 50,
        updatedAt: row.createdAt
      }));

      res.json(leadsData);
    } finally {
      await pool.end();
    }
  } catch (error) {
    console.error("❌ Error en getLeadsSimple:", error);
    res.status(500).json({ error: "Error al obtener leads" });
  }
}

export async function updateLeadStatusSimple(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const result = await db.execute(sql`
      UPDATE leads 
      SET status = ${status}
      WHERE id = ${parseInt(id)}
      RETURNING *
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Lead no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error actualizando lead:", error);
    res.status(500).json({ error: "Error al actualizar lead" });
  }
}

export async function deleteLeadSimple(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    const result = await db.execute(sql`
      DELETE FROM leads 
      WHERE id = ${parseInt(id)}
      RETURNING id
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Lead no encontrado" });
    }

    res.json({ success: true, id: parseInt(id) });
  } catch (error) {
    console.error("Error eliminando lead:", error);
    res.status(500).json({ error: "Error al eliminar lead" });
  }
}

export async function getLeadStatsSimple(req: Request, res: Response) {
  try {
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'new' THEN 1 END) as new_leads,
        COUNT(CASE WHEN status = 'assigned' THEN 1 END) as assigned,
        COUNT(CASE WHEN status = 'contacted' THEN 1 END) as contacted,
        COUNT(CASE WHEN status = 'negotiation' THEN 1 END) as negotiation,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'not-interested' THEN 1 END) as not_interested,
        COALESCE(AVG(budget), 0) as avg_value,
        COALESCE(SUM(budget), 0) as total_value
      FROM leads
    `);

    const stats = result.rows[0];
    
    res.json({
      total: parseInt(stats.total),
      new: parseInt(stats.new_leads),
      assigned: parseInt(stats.assigned),
      contacted: parseInt(stats.contacted),
      negotiation: parseInt(stats.negotiation),
      completed: parseInt(stats.completed),
      notInterested: parseInt(stats.not_interested),
      averageValue: parseFloat(stats.avg_value),
      totalValue: parseFloat(stats.total_value)
    });
  } catch (error) {
    console.error("Error en getLeadStatsSimple:", error);
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
}