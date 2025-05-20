import { Router, Request, Response } from "express";
import { db } from "../db";
import { tickets, insertTicketSchema } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

// Estados posibles para los tickets
export enum TicketStatus {
  NUEVO = "nuevo",
  EN_PROGRESO = "en_progreso",
  RESUELTO = "resuelto",
  CANCELADO = "cancelado",
  SIN_ASIGNAR = "sin_asignar"
}

const router = Router();

// Obtener todos los tickets
router.get("/", async (req: Request, res: Response) => {
  try {
    const result = await db.select().from(tickets).orderBy(desc(tickets.createdAt));
    res.json(result);
  } catch (error) {
    console.error("Error obteniendo tickets:", error);
    res.status(500).json({ error: "Error al obtener tickets" });
  }
});

// Obtener ticket por ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, id));
    
    if (!ticket) {
      return res.status(404).json({ error: "Ticket no encontrado" });
    }
    
    res.json(ticket);
  } catch (error) {
    console.error(`Error obteniendo ticket ${req.params.id}:`, error);
    res.status(500).json({ error: "Error al obtener ticket" });
  }
});

// Crear nuevo ticket
router.post("/", async (req: Request, res: Response) => {
  try {
    const validatedData = insertTicketSchema.parse(req.body);
    const [newTicket] = await db.insert(tickets).values(validatedData).returning();
    
    res.status(201).json(newTicket);
  } catch (error) {
    console.error("Error creando ticket:", error);
    res.status(400).json({
      error: error instanceof z.ZodError
        ? error.errors.map(e => e.message).join(", ")
        : "Error al crear ticket"
    });
  }
});

// Actualizar ticket existente
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [updatedTicket] = await db
      .update(tickets)
      .set({
        ...req.body,
        updatedAt: new Date()
      })
      .where(eq(tickets.id, id))
      .returning();
    
    if (!updatedTicket) {
      return res.status(404).json({ error: "Ticket no encontrado" });
    }
    
    res.json(updatedTicket);
  } catch (error) {
    console.error(`Error actualizando ticket ${req.params.id}:`, error);
    res.status(400).json({ error: "Error al actualizar ticket" });
  }
});

// Actualizar estado del ticket
router.patch("/:id/status", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    
    if (!Object.values(TicketStatus).includes(status)) {
      return res.status(400).json({ 
        error: `Estado inválido. Debe ser uno de: ${Object.values(TicketStatus).join(", ")}` 
      });
    }
    
    const [updatedTicket] = await db
      .update(tickets)
      .set({
        status,
        updatedAt: new Date(),
        ...(status === TicketStatus.RESUELTO ? { resolvedAt: new Date() } : {})
      })
      .where(eq(tickets.id, id))
      .returning();
    
    if (!updatedTicket) {
      return res.status(404).json({ error: "Ticket no encontrado" });
    }
    
    res.json(updatedTicket);
  } catch (error) {
    console.error(`Error actualizando estado del ticket ${req.params.id}:`, error);
    res.status(500).json({ error: "Error al actualizar estado del ticket" });
  }
});

// Asignar ticket a un agente
router.patch("/:id/assign", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { agentId } = req.body;
    
    const [updatedTicket] = await db
      .update(tickets)
      .set({
        assignedTo: agentId ? agentId : null,
        status: agentId ? TicketStatus.EN_PROGRESO : TicketStatus.SIN_ASIGNAR,
        updatedAt: new Date()
      })
      .where(eq(tickets.id, id))
      .returning();
    
    if (!updatedTicket) {
      return res.status(404).json({ error: "Ticket no encontrado" });
    }
    
    res.json(updatedTicket);
  } catch (error) {
    console.error(`Error asignando ticket ${req.params.id}:`, error);
    res.status(500).json({ error: "Error al asignar ticket" });
  }
});

// Generar ticket desde un mensaje de chat
router.post("/generate-from-message", async (req: Request, res: Response) => {
  try {
    const { leadId, chatId, message, contactName } = req.body;
    
    if (!leadId || !chatId || !message) {
      return res.status(400).json({ error: "Faltan datos obligatorios (leadId, chatId, message)" });
    }
    
    // Analizar el mensaje para determinar categoría, prioridad, etc.
    // En un caso real, aquí se usaría IA para procesar el mensaje
    const title = `Ticket para ${contactName || 'Cliente'}`;
    const description = message.length > 500 ? message.substring(0, 497) + "..." : message;
    
    const newTicket = {
      title,
      description,
      status: TicketStatus.NUEVO,
      priority: "media",
      category: "consulta",
      leadId,
      chatId,
      source: "whatsapp",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const [createdTicket] = await db.insert(tickets).values(newTicket).returning();
    
    res.status(201).json(createdTicket);
  } catch (error) {
    console.error("Error generando ticket desde mensaje:", error);
    res.status(500).json({ error: "Error al generar ticket desde mensaje" });
  }
});

export default router;