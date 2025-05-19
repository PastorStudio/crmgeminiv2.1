import { Router, Request, Response } from "express";
import { db } from "../db";
import { leads } from "@shared/schema";

const router = Router();

// Endpoint para eliminar todos los leads
router.delete("/delete-all", async (req: Request, res: Response) => {
  try {
    await db.delete(leads);
    
    res.json({
      success: true,
      message: "Todos los leads han sido eliminados correctamente"
    });
  } catch (error) {
    console.error("Error eliminando todos los leads:", error);
    res.status(500).json({
      success: false,
      message: "Error al eliminar todos los leads"
    });
  }
});

export default router;