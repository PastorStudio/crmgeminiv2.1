import { db } from "../db";
import { tickets, insertTicketSchema, type Ticket, type InsertTicket } from "@shared/schema";
import { eq, and, or, desc } from "drizzle-orm";
import { generateTextWithGemini } from "./geminiService";

// Estados posibles para los tickets
export enum TicketStatus {
  NUEVO = "nuevo",
  EN_PROGRESO = "en_progreso",
  RESUELTO = "resuelto",
  CANCELADO = "cancelado",
  SIN_ASIGNAR = "sin_asignar"
}

export class TicketService {
  // Obtener todos los tickets
  async getAllTickets(): Promise<Ticket[]> {
    try {
      return await db.select().from(tickets).orderBy(desc(tickets.createdAt));
    } catch (error) {
      console.error("Error al obtener tickets:", error);
      return [];
    }
  }

  // Obtener tickets por estado
  async getTicketsByStatus(status: TicketStatus): Promise<Ticket[]> {
    try {
      return await db.select().from(tickets).where(eq(tickets.status, status)).orderBy(desc(tickets.createdAt));
    } catch (error) {
      console.error(`Error al obtener tickets con estado ${status}:`, error);
      return [];
    }
  }

  // Obtener tickets por agente asignado
  async getTicketsByAgent(agentId: number): Promise<Ticket[]> {
    try {
      return await db.select().from(tickets).where(eq(tickets.assignedTo, agentId)).orderBy(desc(tickets.createdAt));
    } catch (error) {
      console.error(`Error al obtener tickets del agente ${agentId}:`, error);
      return [];
    }
  }

  // Obtener un ticket por su ID
  async getTicket(id: number): Promise<Ticket | undefined> {
    try {
      const [ticket] = await db.select().from(tickets).where(eq(tickets.id, id));
      return ticket;
    } catch (error) {
      console.error(`Error al obtener ticket ${id}:`, error);
      return undefined;
    }
  }

  // Crear un nuevo ticket
  async createTicket(ticketData: InsertTicket): Promise<Ticket> {
    try {
      // Validar datos usando schema de zod
      const validData = insertTicketSchema.parse(ticketData);
      
      // Insertar en base de datos
      const [ticket] = await db.insert(tickets).values(validData).returning();
      return ticket;
    } catch (error) {
      console.error("Error al crear ticket:", error);
      throw error;
    }
  }

  // Actualizar un ticket existente
  async updateTicket(id: number, ticketData: Partial<InsertTicket>): Promise<Ticket | undefined> {
    try {
      const [updatedTicket] = await db
        .update(tickets)
        .set({
          ...ticketData,
          updatedAt: new Date()
        })
        .where(eq(tickets.id, id))
        .returning();
      
      return updatedTicket;
    } catch (error) {
      console.error(`Error al actualizar ticket ${id}:`, error);
      return undefined;
    }
  }

  // Cambiar el estado de un ticket
  async updateTicketStatus(id: number, status: TicketStatus): Promise<Ticket | undefined> {
    try {
      const [updatedTicket] = await db
        .update(tickets)
        .set({
          status,
          updatedAt: new Date()
        })
        .where(eq(tickets.id, id))
        .returning();
      
      return updatedTicket;
    } catch (error) {
      console.error(`Error al actualizar estado del ticket ${id}:`, error);
      return undefined;
    }
  }

  // Asignar un ticket a un agente
  async assignTicket(id: number, agentId: number): Promise<Ticket | undefined> {
    try {
      const [updatedTicket] = await db
        .update(tickets)
        .set({
          assignedTo: agentId,
          status: agentId ? TicketStatus.EN_PROGRESO : TicketStatus.SIN_ASIGNAR,
          updatedAt: new Date()
        })
        .where(eq(tickets.id, id))
        .returning();
      
      return updatedTicket;
    } catch (error) {
      console.error(`Error al asignar ticket ${id} al agente ${agentId}:`, error);
      return undefined;
    }
  }

  // Generar un ticket automáticamente desde un mensaje
  async generateTicketFromMessage(
    leadId: number, 
    chatId: string, 
    message: string, 
    contactName: string
  ): Promise<Ticket | null> {
    try {
      // Utilizar Gemini para analizar el mensaje y generar datos para el ticket
      const prompt = `
      Analiza el siguiente mensaje de WhatsApp y genera datos para un ticket de atención al cliente.
      El mensaje es de un cliente llamado "${contactName}" y dice: "${message}"
      
      Genera una respuesta en formato JSON con los siguientes campos:
      1. "title": Un título breve y descriptivo para el ticket (máximo 100 caracteres)
      2. "description": Una descripción del problema o solicitud (máximo 500 caracteres)
      3. "priority": La prioridad del ticket ("baja", "media", "alta", "crítica") basada en la urgencia del mensaje
      4. "category": La categoría a la que pertenece ("soporte", "ventas", "facturación", "técnico", "consulta")
      5. "suggestedStatus": El estado sugerido del ticket ("nuevo", "en_progreso", "resuelto", "cancelado", "sin_asignar")
      
      Responde SOLO con el JSON, sin texto adicional.
      `;

      const aiResponse = await generateTextWithGemini(prompt);
      
      // Procesar la respuesta de la IA
      let ticketData;
      try {
        ticketData = JSON.parse(aiResponse);
      } catch (error) {
        console.error("Error parsing AI response:", error);
        console.log("AI response:", aiResponse);
        return null;
      }
      
      // Crear el ticket con los datos generados por la IA
      const newTicket: InsertTicket = {
        title: ticketData.title || `Ticket para ${contactName}`,
        description: ticketData.description || message.substring(0, 500),
        status: ticketData.suggestedStatus as TicketStatus || TicketStatus.NUEVO,
        priority: ticketData.priority || "media",
        category: ticketData.category || "consulta",
        leadId,
        chatId,
        source: "whatsapp",
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Guardar el ticket en la base de datos
      return await this.createTicket(newTicket);
    } catch (error) {
      console.error("Error generando ticket desde mensaje:", error);
      return null;
    }
  }
}

// Exportar instancia del servicio
export const ticketService = new TicketService();