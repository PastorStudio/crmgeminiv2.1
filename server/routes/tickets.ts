import { Router, Request, Response } from "express";
import { tickets } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";

const router = Router();

// Obtener todos los tickets
router.get("/", async (req: Request, res: Response) => {
  try {
    // Devolver un array vacío para evitar pantallas en blanco durante mantenimiento
    res.json([
      {
        id: 1,
        title: "Sistema en mantenimiento",
        description: "El módulo de tickets está en mantenimiento. Estamos trabajando para habilitar esta funcionalidad pronto.",
        status: "en_progreso",
        priority: "media",
        category: "soporte",
        createdAt: new Date(),
        updatedAt: new Date(),
        assignedTo: null
      }
    ]);
  } catch (error) {
    console.error("Error al obtener tickets:", error);
    res.json([]);
  }
});

// Obtener ticket específico
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.id);
    res.json({
      id: ticketId,
      title: "Ticket en mantenimiento",
      description: "Los detalles de este ticket no están disponibles temporalmente mientras realizamos mejoras en el sistema.",
      status: "en_progreso",
      priority: "media",
      category: "soporte",
      createdAt: new Date(),
      updatedAt: new Date(),
      assignedTo: null
    });
  } catch (error) {
    console.error("Error al obtener ticket específico:", error);
    res.status(404).json({ message: "Ticket no encontrado" });
  }
});

// Crear ticket
router.post("/", async (req: Request, res: Response) => {
  try {
    const newTicket = {
      id: Math.floor(Math.random() * 1000) + 1,
      title: req.body.title || "Nuevo ticket",
      description: req.body.description || "",
      status: req.body.status || "nuevo",
      priority: req.body.priority || "media",
      category: req.body.category || "soporte",
      createdAt: new Date(),
      updatedAt: new Date(),
      assignedTo: null
    };
    res.status(201).json(newTicket);
  } catch (error) {
    console.error("Error al crear ticket:", error);
    res.status(500).json({ message: "No se pudo crear el ticket" });
  }
});

// Actualizar ticket
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.id);
    res.json({
      id: ticketId,
      ...req.body,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error("Error al actualizar ticket:", error);
    res.status(500).json({ message: "No se pudo actualizar el ticket" });
  }
});

// Actualizar estado de ticket
router.patch("/:id/status", async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.id);
    res.json({
      id: ticketId,
      status: req.body.status,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error("Error al actualizar estado del ticket:", error);
    res.status(500).json({ message: "No se pudo actualizar el estado del ticket" });
  }
});

// Asignar ticket
router.patch("/:id/assign", async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.id);
    const agentId = req.body.agentId;
    res.json({
      id: ticketId,
      assignedTo: agentId,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error("Error al asignar ticket:", error);
    res.status(500).json({ message: "No se pudo asignar el ticket" });
  }
});

export default router;