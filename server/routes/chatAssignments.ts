import { Request, Response } from 'express';
import { Express } from 'express';
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { authService } from '../services/authService';
import { chatAssignmentService } from '../services/chatAssignmentService';

export function registerChatAssignmentRoutes(app: Express) {
  // Obtener agentes disponibles para asignación
  app.get('/api/users/agents', authService.authenticate.bind(authService), async (req: Request, res: Response) => {
    try {
      const accountId = req.query.accountId ? parseInt(req.query.accountId as string) : undefined;
      
      if (!accountId) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere el ID de la cuenta'
        });
      }
      
      // En una implementación completa, filtrar los agentes según permisos en la cuenta
      // Por ahora, devolver todos los usuarios con rol 'agent'
      const agents = await db
        .select({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          email: users.email,
          avatar: users.avatar,
          department: users.department,
          role: users.role
        })
        .from(users)
        .where(
          and(
            eq(users.role, 'agent'),
            eq(users.status, 'active')
          )
        );
      
      return res.json({
        success: true,
        agents
      });
    } catch (error: any) {
      console.error('Error al obtener agentes:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al obtener la lista de agentes disponibles'
      });
    }
  });

  // Obtener asignaciones de chat
  app.get('/api/chat-assignments', authService.authenticate.bind(authService), async (req: Request, res: Response) => {
    try {
      const chatId = req.query.chatId as string;
      const accountId = req.query.accountId ? parseInt(req.query.accountId as string) : undefined;
      
      // Si se especifican chatId y accountId, buscar una asignación específica
      if (chatId && accountId) {
        const assignment = await chatAssignmentService.findAssignment(chatId, accountId);
        
        if (!assignment) {
          return res.status(404).json({
            success: false,
            message: 'Asignación no encontrada'
          });
        }
        
        return res.json({
          success: true,
          assignment
        });
      }
      
      // Si no, obtener todas las asignaciones según filtros
      const assignedToId = req.query.assignedToId ? parseInt(req.query.assignedToId as string) : undefined;
      const status = req.query.status as string;
      
      const assignments = await chatAssignmentService.getAllAssignments({
        accountId,
        assignedToId,
        status
      });
      
      return res.json({
        success: true,
        assignments
      });
    } catch (error) {
      console.error('Error al obtener asignaciones:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al obtener asignaciones de chat'
      });
    }
  });

  // Crear una nueva asignación
  app.post('/api/chat-assignments', authService.authenticate.bind(authService), async (req: Request, res: Response) => {
    try {
      const { chatId, accountId, assignedToId, category, notes } = req.body;
      
      if (!chatId || !accountId || !assignedToId) {
        return res.status(400).json({
          success: false,
          message: 'Faltan datos requeridos'
        });
      }
      
      // Verificar si ya existe una asignación para este chat
      const existingAssignment = await chatAssignmentService.findAssignment(chatId, accountId);
      
      if (existingAssignment) {
        return res.status(409).json({
          success: false,
          message: 'Ya existe una asignación para este chat',
          assignment: existingAssignment
        });
      }
      
      // Crear la asignación
      const newAssignment = await chatAssignmentService.createAssignment({
        chatId,
        accountId,
        assignedToId,
        assignedById: (req as any).user.id,
        category,
        notes
      });
      
      return res.status(201).json({
        success: true,
        message: 'Asignación creada exitosamente',
        assignment: newAssignment
      });
    } catch (error) {
      console.error('Error al crear asignación:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Error al crear asignación de chat'
      });
    }
  });

  // Actualizar una asignación
  app.patch('/api/chat-assignments/:id', authService.authenticate.bind(authService), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { assignedToId, category, notes, status } = req.body;
      
      // Buscar la asignación por ID
      const existingAssignment = await chatAssignmentService.findAssignmentById(id);
      
      if (!existingAssignment) {
        return res.status(404).json({
          success: false,
          message: 'Asignación no encontrada'
        });
      }
      
      // Verificar permisos (admin, supervisor, o el agente asignado)
      const userRole = (req as any).user.role;
      const userId = (req as any).user.id;
      
      if (userRole !== 'admin' && userRole !== 'supervisor' && existingAssignment.assignedToId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para modificar esta asignación'
        });
      }
      
      // Actualizar la asignación
      const updatedAssignment = await chatAssignmentService.updateAssignment(id, {
        assignedToId,
        category,
        notes,
        status
      });
      
      return res.json({
        success: true,
        message: 'Asignación actualizada exitosamente',
        assignment: updatedAssignment
      });
    } catch (error: any) {
      console.error('Error al actualizar asignación:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Error al actualizar asignación de chat'
      });
    }
  });

  // Obtener categorías de chat
  app.get('/api/chat-categories', authService.authenticate.bind(authService), async (req: Request, res: Response) => {
    try {
      const categories = await chatAssignmentService.getAllCategories();
      
      return res.json({
        success: true,
        categories
      });
    } catch (error) {
      console.error('Error al obtener categorías:', error);
      return res.status(500).json({
        success: false,
        message: 'Error al obtener categorías de chat'
      });
    }
  });

  // Crear una nueva categoría
  app.post('/api/chat-categories', authService.authenticate.bind(authService), async (req: Request, res: Response) => {
    try {
      // Solo admins y supervisores pueden crear categorías
      const userRole = (req as any).user.role;
      
      if (userRole !== 'admin' && userRole !== 'supervisor') {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para crear categorías'
        });
      }
      
      const { name, description, color, icon } = req.body;
      
      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'El nombre de la categoría es obligatorio'
        });
      }
      
      // Crear la categoría
      const newCategory = await chatAssignmentService.createCategory({
        name,
        description,
        color,
        icon,
        createdBy: (req as any).user.id
      });
      
      return res.status(201).json({
        success: true,
        message: 'Categoría creada exitosamente',
        category: newCategory
      });
    } catch (error) {
      console.error('Error al crear categoría:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Error al crear categoría de chat'
      });
    }
  });
}