/**
 * Sistema de Asignación Automática de Chats de WhatsApp
 * Asigna automáticamente conversaciones de WhatsApp a usuarios del sistema
 */

import { db } from '../db';
import { chatAssignments, whatsappAccounts, users } from '@shared/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';

interface AssignmentRule {
  userId: number;
  accountIds: number[];
  maxChatsPerUser: number;
  priority: number; // 1 = alta prioridad, 5 = baja prioridad
  isActive: boolean;
  workingHours?: {
    start: string; // "09:00"
    end: string;   // "17:00"
    timezone: string;
  };
  specialties?: string[]; // ["ventas", "soporte", "tecnico"]
}

interface ChatAssignmentContext {
  chatId: string;
  accountId: number;
  userId: number;
  contactName?: string;
  lastMessage?: string;
  messageCount: number;
}

export class AutomaticAssignmentService {
  private static instance: AutomaticAssignmentService;
  private assignmentRules: Map<number, AssignmentRule> = new Map();
  private isProcessing: boolean = false;

  private constructor() {
    this.loadAssignmentRules();
  }

  static getInstance(): AutomaticAssignmentService {
    if (!AutomaticAssignmentService.instance) {
      AutomaticAssignmentService.instance = new AutomaticAssignmentService();
    }
    return AutomaticAssignmentService.instance;
  }

  /**
   * Cargar reglas de asignación desde la base de datos
   */
  private async loadAssignmentRules(): Promise<void> {
    try {
      console.log('🔄 Cargando reglas de asignación automática...');
      
      // Obtener usuarios activos con sus cuentas de WhatsApp
      const userAccounts = await db
        .select({
          userId: users.id,
          userName: users.firstName,
          accountId: whatsappAccounts.id,
          accountName: whatsappAccounts.name
        })
        .from(users)
        .leftJoin(whatsappAccounts, eq(whatsappAccounts.userId, users.id))
        .where(eq(users.isActive, true));

      // Crear reglas por defecto para cada usuario
      const userRules = new Map<number, AssignmentRule>();
      
      for (const userAccount of userAccounts) {
        if (!userRules.has(userAccount.userId)) {
          userRules.set(userAccount.userId, {
            userId: userAccount.userId,
            accountIds: [],
            maxChatsPerUser: 10, // Máximo 10 chats activos por usuario
            priority: 3, // Prioridad media por defecto
            isActive: true,
            workingHours: {
              start: "09:00",
              end: "18:00",
              timezone: "America/Panama"
            },
            specialties: ["general"]
          });
        }
        
        if (userAccount.accountId) {
          userRules.get(userAccount.userId)!.accountIds.push(userAccount.accountId);
        }
      }

      this.assignmentRules = userRules;
      console.log(`✅ ${this.assignmentRules.size} reglas de asignación cargadas`);
      
    } catch (error) {
      console.error('❌ Error cargando reglas de asignación:', error);
    }
  }

  /**
   * Asignar automáticamente un chat a un usuario
   */
  async assignChat(chatId: string, accountId: number, contactName?: string): Promise<boolean> {
    try {
      console.log(`🎯 Asignando chat ${chatId} de cuenta ${accountId}...`);
      
      // Verificar si el chat ya está asignado
      const existingAssignment = await db
        .select()
        .from(chatAssignments)
        .where(eq(chatAssignments.chatId, chatId))
        .limit(1);

      if (existingAssignment.length > 0) {
        console.log(`⏭️ Chat ${chatId} ya está asignado a usuario ${existingAssignment[0].assignedToId}`);
        return false;
      }

      // Buscar el mejor usuario para asignar este chat
      const bestUser = await this.findBestUserForAssignment(accountId);
      
      if (!bestUser) {
        console.log(`❌ No se encontró usuario disponible para cuenta ${accountId}`);
        return false;
      }

      // Crear la asignación
      await db.insert(chatAssignments).values({
        chatId,
        accountId,
        assignedToId: bestUser.userId,
        assignedById: 1, // Sistema automático
        status: 'active',
        priority: 'medium',
        category: 'whatsapp',
        notes: `Asignado automáticamente - Contacto: ${contactName || 'Desconocido'}`,
        assignedAt: new Date(),
        lastActivityAt: new Date()
      });

      console.log(`✅ Chat ${chatId} asignado a usuario ${bestUser.userId}`);
      return true;

    } catch (error) {
      console.error('❌ Error asignando chat:', error);
      return false;
    }
  }

  /**
   * Encontrar el mejor usuario para asignar un chat
   */
  private async findBestUserForAssignment(accountId: number): Promise<AssignmentRule | null> {
    try {
      // Obtener usuarios que pueden manejar esta cuenta
      const candidateUsers = Array.from(this.assignmentRules.values())
        .filter(rule => 
          rule.isActive && 
          (rule.accountIds.includes(accountId) || rule.accountIds.length === 0)
        );

      if (candidateUsers.length === 0) {
        return null;
      }

      // Verificar carga actual de cada usuario
      const userLoads = await Promise.all(
        candidateUsers.map(async (user) => {
          const currentChats = await db
            .select({ count: chatAssignments.id })
            .from(chatAssignments)
            .where(
              and(
                eq(chatAssignments.assignedToId, user.userId),
                eq(chatAssignments.status, 'active')
              )
            );

          return {
            user,
            currentLoad: currentChats.length,
            availability: user.maxChatsPerUser - currentChats.length
          };
        })
      );

      // Filtrar usuarios que no están saturados
      const availableUsers = userLoads.filter(ul => ul.availability > 0);
      
      if (availableUsers.length === 0) {
        console.log('⚠️ Todos los usuarios están saturados');
        return null;
      }

      // Ordenar por disponibilidad (más disponible primero) y prioridad
      availableUsers.sort((a, b) => {
        if (a.user.priority !== b.user.priority) {
          return a.user.priority - b.user.priority; // Prioridad más alta primero
        }
        return b.availability - a.availability; // Más disponibilidad primero
      });

      return availableUsers[0].user;

    } catch (error) {
      console.error('❌ Error encontrando usuario para asignación:', error);
      return null;
    }
  }

  /**
   * Procesar asignaciones pendientes
   */
  async processUnassignedChats(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    
    try {
      console.log('🔄 Procesando chats sin asignar...');
      
      // Buscar conversaciones activas sin asignación
      const unassignedConversations = await db
        .select({
          chatId: chatAssignments.chatId,
          accountId: chatAssignments.accountId
        })
        .from(chatAssignments)
        .where(isNull(chatAssignments.assignedToId))
        .limit(50);

      console.log(`📊 Encontrados ${unassignedConversations.length} chats sin asignar`);

      let assignedCount = 0;
      
      for (const conversation of unassignedConversations) {
        const success = await this.assignChat(
          conversation.chatId,
          conversation.accountId!
        );
        
        if (success) {
          assignedCount++;
        }
        
        // Pausa pequeña entre asignaciones
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`✅ ${assignedCount} chats asignados automáticamente`);
      
    } catch (error) {
      console.error('❌ Error procesando asignaciones:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Reasignar chat a otro usuario
   */
  async reassignChat(chatId: string, newUserId: number, reason?: string): Promise<boolean> {
    try {
      console.log(`🔄 Reasignando chat ${chatId} a usuario ${newUserId}...`);
      
      const updated = await db
        .update(chatAssignments)
        .set({
          assignedToId: newUserId,
          assignedAt: new Date(),
          notes: `Reasignado: ${reason || 'Sin motivo especificado'}`,
          lastActivityAt: new Date()
        })
        .where(eq(chatAssignments.chatId, chatId));

      console.log(`✅ Chat ${chatId} reasignado exitosamente`);
      return true;
      
    } catch (error) {
      console.error('❌ Error reasignando chat:', error);
      return false;
    }
  }

  /**
   * Obtener estadísticas de asignaciones
   */
  async getAssignmentStats(): Promise<any> {
    try {
      const stats = await db
        .select({
          assignedToId: chatAssignments.assignedToId,
          status: chatAssignments.status,
          count: chatAssignments.id
        })
        .from(chatAssignments)
        .where(eq(chatAssignments.status, 'active'));

      return {
        totalActiveChats: stats.length,
        userDistribution: stats.reduce((acc: any, stat) => {
          const userId = stat.assignedToId || 'unassigned';
          acc[userId] = (acc[userId] || 0) + 1;
          return acc;
        }, {}),
        lastUpdated: new Date()
      };
      
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      return null;
    }
  }

  /**
   * Actualizar regla de asignación para un usuario
   */
  async updateAssignmentRule(userId: number, rule: Partial<AssignmentRule>): Promise<boolean> {
    try {
      const existingRule = this.assignmentRules.get(userId);
      
      if (existingRule) {
        this.assignmentRules.set(userId, { ...existingRule, ...rule });
        console.log(`✅ Regla de asignación actualizada para usuario ${userId}`);
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('❌ Error actualizando regla:', error);
      return false;
    }
  }

  /**
   * Iniciar monitoreo automático
   */
  startAutoMonitoring(): void {
    console.log('🚀 Iniciando monitoreo automático de asignaciones...');
    
    // Procesar cada 2 minutos
    setInterval(async () => {
      await this.processUnassignedChats();
    }, 120000);

    // Recargar reglas cada 10 minutos
    setInterval(async () => {
      await this.loadAssignmentRules();
    }, 600000);

    console.log('✅ Monitoreo automático iniciado');
  }
}