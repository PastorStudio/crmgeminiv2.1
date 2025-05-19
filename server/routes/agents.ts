/**
 * Rutas para la gestión de agentes
 */
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

export const agentsRouter = Router();

// Obtener todos los agentes
agentsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    // Obtener todos los agentes con logging mejorado
    console.log("Obteniendo lista de agentes...");
    const agents = await db.execute(sql`
      SELECT * FROM agents ORDER BY name ASC
    `);
    
    console.log(`Número de agentes encontrados: ${agents.rows?.length || 0}`);
    
    if (!agents.rows || agents.rows.length === 0) {
      console.log("No se encontraron agentes en la base de datos");
      
      // Verificar si existen usuarios que pueden ser usados como agentes
      console.log("Buscando usuarios para usar como agentes...");
      const users = await db.execute(sql`
        SELECT * FROM users WHERE role != 'viewer' ORDER BY id ASC
      `);
      
      console.log(`Número de usuarios encontrados: ${users.rows?.length || 0}`);
      
      if (users.rows && users.rows.length > 0) {
        // Transformar usuarios a agentes
        const formattedUsers = users.rows.map(user => ({
          id: user.id,
          name: user.fullname || user.username,
          email: user.email || `${user.username}@geminicrm.com`,
          status: 'active',
          department: user.department || 'General',
          role: user.role || 'agent',
          avatar: null,
          phone: null,
          workload: 0,
          availability: 'available',
          createdAt: user.created_at || new Date(),
          updatedAt: user.updated_at || new Date()
        }));
        
        console.log("Usando usuarios como agentes temporalmente");
        return res.json(formattedUsers);
      }
    }
    
    // Transformar los datos para que sean compatibles con el cliente
    console.log("Formateando datos de agentes para el cliente");
    const formattedAgents = agents.rows.map(agent => ({
      id: agent.id,
      name: agent.name,
      email: agent.email,
      status: agent.status || 'active',
      department: agent.department,
      role: agent.role || 'agent',
      avatar: agent.avatar,
      phone: agent.phone,
      workload: agent.workload || 0,
      availability: agent.availability || 'available',
      createdAt: agent.created_at,
      updatedAt: agent.updated_at
    }));

    res.json(formattedAgents);
  } catch (error) {
    console.error('Error al obtener agentes:', error);
    res.status(500).json({ success: false, message: 'Error al obtener agentes' });
  }
});

// Obtener un agente específico
agentsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Obtener el agente
    const result = await db.execute(sql`
      SELECT * FROM agents WHERE id = ${parseInt(id)}
    `);
    
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Agente no encontrado' });
    }
    
    const agent = result.rows[0];
    
    // Formatear la respuesta
    const formattedAgent = {
      id: agent.id,
      name: agent.name,
      email: agent.email,
      status: agent.status || 'active',
      department: agent.department,
      role: agent.role || 'agent',
      avatar: agent.avatar,
      phone: agent.phone,
      workload: agent.workload || 0,
      availability: agent.availability || 'available',
      createdAt: agent.created_at,
      updatedAt: agent.updated_at
    };
    
    res.json(formattedAgent);
  } catch (error) {
    console.error('Error al obtener agente:', error);
    res.status(500).json({ success: false, message: 'Error al obtener el agente' });
  }
});