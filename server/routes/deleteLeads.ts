import { Router, Request, Response } from "express";
import { db } from "../db";
import { leads, activities, messages, surveys } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

const router = Router();

// Endpoint para eliminar todos los leads
router.delete("/delete-all", async (req: Request, res: Response) => {
  try {
    // Primero eliminamos las entidades relacionadas para evitar errores de clave foránea
    console.log("Eliminando actividades relacionadas...");
    await db.delete(activities).where(sql`activities."leadId" IS NOT NULL`);
    
    console.log("Eliminando mensajes relacionados...");
    await db.delete(messages).where(sql`messages."leadId" IS NOT NULL`);
    
    console.log("Eliminando encuestas relacionadas...");
    await db.delete(surveys).where(sql`surveys."leadId" IS NOT NULL`);
    
    // Finalmente eliminamos los leads
    console.log("Eliminando todos los leads...");
    await db.delete(leads);
    
    console.log("Todos los leads han sido eliminados correctamente");
    res.json({
      success: true,
      message: "Todos los leads han sido eliminados correctamente"
    });
  } catch (error) {
    console.error("Error eliminando todos los leads:", error);
    res.status(500).json({
      success: false,
      message: "Error al eliminar todos los leads: " + String(error)
    });
  }
});

export default router;