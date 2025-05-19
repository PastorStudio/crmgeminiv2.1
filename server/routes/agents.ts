import express, { Request, Response } from 'express';
import { storage } from '../storage';
import { insertAgentSchema } from '@shared/schema';
import { z } from 'zod';

const router = express.Router();

// Schema para actualización parcial de agentes
const updateAgentSchema = insertAgentSchema.partial();

// Obtener todos los agentes
router.get('/', async (req: Request, res: Response) => {
  try {
    const agents = await storage.getAllAgents();
    res.json(agents);
  } catch (error) {
    console.error('Error al obtener agentes:', error);
    res.status(500).json({ error: 'Error al obtener agentes' });
  }
});

// Obtener un agente por ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID de agente inválido' });
    }

    const agent = await storage.getAgent(id);
    if (!agent) {
      return res.status(404).json({ error: 'Agente no encontrado' });
    }

    res.json(agent);
  } catch (error) {
    console.error(`Error al obtener agente ${req.params.id}:`, error);
    res.status(500).json({ error: 'Error al obtener agente' });
  }
});

// Obtener un agente por ID de usuario
router.get('/by-user/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'ID de usuario inválido' });
    }

    const agent = await storage.getAgentByUserId(userId);
    if (!agent) {
      return res.status(404).json({ error: 'Agente no encontrado para este usuario' });
    }

    res.json(agent);
  } catch (error) {
    console.error(`Error al obtener agente para usuario ${req.params.userId}:`, error);
    res.status(500).json({ error: 'Error al obtener agente por usuario' });
  }
});

// Crear un nuevo agente
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validar los datos de entrada con el schema
    const validationResult = insertAgentSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Datos de agente inválidos', 
        details: validationResult.error.format() 
      });
    }

    const newAgent = await storage.createAgent(validationResult.data);
    res.status(201).json(newAgent);
  } catch (error) {
    console.error('Error al crear agente:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    res.status(500).json({ error: 'Error al crear agente', message: errorMessage });
  }
});

// Actualizar un agente existente
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID de agente inválido' });
    }

    // Validar los datos de actualización con el schema parcial
    const validationResult = updateAgentSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Datos de actualización inválidos', 
        details: validationResult.error.format() 
      });
    }

    const updatedAgent = await storage.updateAgent(id, validationResult.data);
    if (!updatedAgent) {
      return res.status(404).json({ error: 'Agente no encontrado' });
    }

    res.json(updatedAgent);
  } catch (error) {
    console.error(`Error al actualizar agente ${req.params.id}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    res.status(500).json({ error: 'Error al actualizar agente', message: errorMessage });
  }
});

// Actualizar métricas de un agente
router.patch('/:id/metrics', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID de agente inválido' });
    }

    // Validación básica de métricas
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Métricas inválidas' });
    }

    const updatedAgent = await storage.updateAgentMetrics(id, req.body);
    if (!updatedAgent) {
      return res.status(404).json({ error: 'Agente no encontrado' });
    }

    res.json(updatedAgent);
  } catch (error) {
    console.error(`Error al actualizar métricas del agente ${req.params.id}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    res.status(500).json({ error: 'Error al actualizar métricas', message: errorMessage });
  }
});

// Eliminar un agente
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID de agente inválido' });
    }

    await storage.deleteAgent(id);
    res.status(204).end(); // 204 No Content para operaciones de eliminación exitosas
  } catch (error) {
    console.error(`Error al eliminar agente ${req.params.id}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    res.status(500).json({ error: 'Error al eliminar agente', message: errorMessage });
  }
});

export default router;