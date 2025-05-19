/**
 * Rutas para la gestión de tickets
 */
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

export const ticketsRouter = Router();

// Obtener todos los tickets
ticketsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    // Obtener tickets con información del agente asignado
    const tickets = await db.execute(sql`
      SELECT t.*, a.name as agent_name, a.email as agent_email
      FROM tickets t
      LEFT JOIN agents a ON t.assigned_agent_id = a.id
      ORDER BY t.created_at DESC
    `);
    
    // Transformar los datos para que sean compatibles con el cliente
    const formattedTickets = tickets.rows.map(ticket => ({
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status || 'nuevo',
      priority: ticket.priority || 'media',
      category: ticket.category || 'consulta',
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at,
      dueDate: ticket.due_date,
      assignedTo: ticket.assigned_agent_id,
      assignedToName: ticket.agent_name,
      assignedToEmail: ticket.agent_email,
      createdBy: ticket.created_by,
      notes: ticket.notes,
      tags: ticket.tags,
      isInternal: ticket.is_internal
    }));

    res.json(formattedTickets);
  } catch (error) {
    console.error('Error al obtener tickets:', error);
    res.status(500).json({ success: false, message: 'Error al obtener tickets' });
  }
});

// Crear un nuevo ticket
ticketsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { title, description, priority, category, status } = req.body;
    
    // Validación básica
    if (!title) {
      return res.status(400).json({ success: false, message: 'El título es obligatorio' });
    }
    
    // Insertar el nuevo ticket
    const result = await db.execute(sql`
      INSERT INTO tickets 
        (title, description, priority, category, status, created_at, updated_at)
      VALUES 
        (${title}, ${description}, ${priority}, ${category}, ${status}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `);
    
    if (!result.rows || result.rows.length === 0) {
      throw new Error('Error al crear el ticket');
    }
    
    const ticket = result.rows[0];
    
    // Formatear la respuesta
    const formattedTicket = {
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status || 'nuevo',
      priority: ticket.priority || 'media',
      category: ticket.category || 'consulta',
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at
    };
    
    res.status(201).json(formattedTicket);
  } catch (error) {
    console.error('Error al crear ticket:', error);
    res.status(500).json({ success: false, message: 'Error al crear el ticket' });
  }
});

// Actualizar un ticket existente
ticketsRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, priority, category } = req.body;
    
    // Validación básica
    if (!title) {
      return res.status(400).json({ success: false, message: 'El título es obligatorio' });
    }
    
    // Actualizar el ticket
    const result = await db.execute(sql`
      UPDATE tickets
      SET 
        title = ${title},
        description = ${description},
        priority = ${priority},
        category = ${category},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `);
    
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ticket no encontrado' });
    }
    
    const ticket = result.rows[0];
    
    // Formatear la respuesta
    const formattedTicket = {
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at
    };
    
    res.json(formattedTicket);
  } catch (error) {
    console.error('Error al actualizar ticket:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar el ticket' });
  }
});

// Actualizar el estado de un ticket
ticketsRouter.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Validación básica
    if (!status) {
      return res.status(400).json({ success: false, message: 'El estado es obligatorio' });
    }
    
    // Actualizar el estado del ticket
    const result = await db.execute(sql`
      UPDATE tickets
      SET 
        status = ${status},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `);
    
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ticket no encontrado' });
    }
    
    const ticket = result.rows[0];
    
    // Formatear la respuesta
    const formattedTicket = {
      id: ticket.id,
      status: ticket.status
    };
    
    res.json(formattedTicket);
  } catch (error) {
    console.error('Error al actualizar estado del ticket:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar el estado' });
  }
});

// Asignar un ticket a un agente
ticketsRouter.patch('/:id/assign', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { agentId } = req.body;
    
    // Actualizar la asignación del ticket
    const result = await db.execute(sql`
      UPDATE tickets
      SET 
        assigned_agent_id = ${agentId === null ? sql`NULL` : agentId},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${parseInt(id)}
      RETURNING *
    `);
    
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ticket no encontrado' });
    }
    
    // Si se asignó a un agente, obtener la información del agente
    let agentInfo = null;
    if (agentId !== null) {
      const agentResult = await db.execute(sql`
        SELECT * FROM agents WHERE id = ${agentId}
      `);
      
      if (agentResult.rows && agentResult.rows.length > 0) {
        agentInfo = agentResult.rows[0];
      }
    }
    
    const ticket = result.rows[0];
    
    // Formatear la respuesta
    const formattedTicket = {
      id: ticket.id,
      assignedTo: ticket.assigned_agent_id,
      assignedToName: agentInfo ? agentInfo.name : null,
      assignedToEmail: agentInfo ? agentInfo.email : null
    };
    
    res.json(formattedTicket);
  } catch (error) {
    console.error('Error al asignar ticket:', error);
    res.status(500).json({ success: false, message: 'Error al asignar el ticket' });
  }
});