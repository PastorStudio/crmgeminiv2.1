import { db } from "../db";
import { 
  internalAgents, 
  internalChatAssignments, 
  internalAgentPerformance, 
  internalAgentMetrics,
  type InternalAgent,
  type InternalChatAssignment,
  type InsertInternalAgent,
  type InsertInternalChatAssignment,
  type InsertInternalAgentPerformance,
  type InsertInternalAgentMetrics
} from "@shared/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

/**
 * Servicio de gestión de agentes internos
 * Sistema invisible para WhatsApp, solo para etiquetado y gestión interna del CRM
 */
export class InternalAgentManager {
  
  // ===== GESTIÓN DE AGENTES =====
  
  /**
   * Crear un nuevo agente interno
   */
  async createAgent(agentData: InsertInternalAgent): Promise<InternalAgent> {
    const [agent] = await db
      .insert(internalAgents)
      .values({
        ...agentData,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    console.log(`✅ Agente interno creado: ${agent.name} (${agent.email})`);
    return agent;
  }

  /**
   * Obtener todos los agentes internos
   */
  async getAllAgents(): Promise<InternalAgent[]> {
    const agents = await db
      .select()
      .from(internalAgents)
      .orderBy(desc(internalAgents.createdAt));
    
    console.log(`📋 ${agents.length} agentes internos encontrados`);
    return agents;
  }

  /**
   * Obtener agentes disponibles (activos y con capacidad)
   */
  async getAvailableAgents(): Promise<InternalAgent[]> {
    const agents = await db
      .select()
      .from(internalAgents)
      .where(
        and(
          eq(internalAgents.status, 'active'),
          sql`${internalAgents.currentChats} < ${internalAgents.maxChats}`
        )
      )
      .orderBy(internalAgents.currentChats);
    
    console.log(`🟢 ${agents.length} agentes disponibles para asignación`);
    return agents;
  }

  /**
   * Actualizar estado de un agente
   */
  async updateAgentStatus(agentId: number, status: string): Promise<InternalAgent | null> {
    const [agent] = await db
      .update(internalAgents)
      .set({ 
        status,
        updatedAt: new Date()
      })
      .where(eq(internalAgents.id, agentId))
      .returning();
    
    if (agent) {
      console.log(`🔄 Estado de agente ${agent.name} actualizado a: ${status}`);
    }
    return agent || null;
  }

  // ===== ASIGNACIÓN DE CHATS =====

  /**
   * Asignar un chat a un agente interno (etiquetado invisible)
   */
  async assignChatToAgent(
    chatId: string, 
    accountId: number, 
    agentId: number,
    assignmentData?: Partial<InsertInternalChatAssignment>
  ): Promise<InternalChatAssignment> {
    
    // Verificar si ya existe una asignación activa
    const existingAssignment = await this.getChatAssignment(chatId, accountId);
    if (existingAssignment && existingAssignment.status === 'active') {
      throw new Error(`Chat ${chatId} ya está asignado al agente ${existingAssignment.agentId}`);
    }

    // Crear nueva asignación
    const [assignment] = await db
      .insert(internalChatAssignments)
      .values({
        chatId,
        accountId,
        agentId,
        ...assignmentData,
        assignedAt: new Date(),
        lastActivityAt: new Date()
      })
      .returning();

    // Incrementar contador de chats del agente
    await db
      .update(internalAgents)
      .set({ 
        currentChats: sql`${internalAgents.currentChats} + 1`
      })
      .where(eq(internalAgents.id, agentId));

    console.log(`🎯 Chat ${chatId} asignado al agente ${agentId} (etiqueta invisible)`);
    return assignment;
  }

  /**
   * Obtener asignación actual de un chat
   */
  async getChatAssignment(chatId: string, accountId: number): Promise<InternalChatAssignment | null> {
    const [assignment] = await db
      .select()
      .from(internalChatAssignments)
      .where(
        and(
          eq(internalChatAssignments.chatId, chatId),
          eq(internalChatAssignments.accountId, accountId),
          eq(internalChatAssignments.status, 'active')
        )
      )
      .orderBy(desc(internalChatAssignments.assignedAt))
      .limit(1);

    return assignment || null;
  }

  /**
   * Transferir chat entre agentes
   */
  async transferChat(
    chatId: string, 
    accountId: number, 
    newAgentId: number,
    reason?: string
  ): Promise<InternalChatAssignment> {
    
    // Cerrar asignación actual
    const currentAssignment = await this.getChatAssignment(chatId, accountId);
    if (currentAssignment) {
      await this.completeChatAssignment(chatId, accountId, 'transferred');
    }

    // Crear nueva asignación
    const transferHistory = currentAssignment ? 
      [{ 
        fromAgent: currentAssignment.agentId, 
        toAgent: newAgentId, 
        timestamp: new Date(),
        reason 
      }] : [];

    return await this.assignChatToAgent(chatId, accountId, newAgentId, {
      transferHistory,
      notes: reason
    });
  }

  /**
   * Completar asignación de chat
   */
  async completeChatAssignment(
    chatId: string, 
    accountId: number, 
    status: string = 'completed'
  ): Promise<InternalChatAssignment | null> {
    
    const [assignment] = await db
      .update(internalChatAssignments)
      .set({ 
        status,
        completedAt: new Date()
      })
      .where(
        and(
          eq(internalChatAssignments.chatId, chatId),
          eq(internalChatAssignments.accountId, accountId),
          eq(internalChatAssignments.status, 'active')
        )
      )
      .returning();

    if (assignment) {
      // Decrementar contador de chats del agente
      await db
        .update(internalAgents)
        .set({ 
          currentChats: sql`${internalAgents.currentChats} - 1`
        })
        .where(eq(internalAgents.id, assignment.agentId));

      console.log(`✅ Asignación de chat ${chatId} completada con estado: ${status}`);
    }

    return assignment || null;
  }

  // ===== ANÁLISIS Y MÉTRICAS =====

  /**
   * Obtener chats asignados a un agente
   */
  async getAgentChats(agentId: number, status?: string): Promise<InternalChatAssignment[]> {
    const conditions = [eq(internalChatAssignments.agentId, agentId)];
    
    if (status) {
      conditions.push(eq(internalChatAssignments.status, status));
    }

    const chats = await db
      .select()
      .from(internalChatAssignments)
      .where(and(...conditions))
      .orderBy(desc(internalChatAssignments.assignedAt));

    return chats;
  }

  /**
   * Generar métricas de rendimiento para un agente
   */
  async generateAgentMetrics(agentId: number, dateFrom: Date, dateTo: Date): Promise<any> {
    
    // Obtener todas las asignaciones del período
    const assignments = await db
      .select()
      .from(internalChatAssignments)
      .where(
        and(
          eq(internalChatAssignments.agentId, agentId),
          gte(internalChatAssignments.assignedAt, dateFrom),
          lte(internalChatAssignments.assignedAt, dateTo)
        )
      );

    // Calcular métricas
    const totalChats = assignments.length;
    const completedChats = assignments.filter(a => a.status === 'completed').length;
    const activeChats = assignments.filter(a => a.status === 'active').length;
    
    const avgResponseTime = assignments
      .filter(a => a.responseTime)
      .reduce((sum, a) => sum + (a.responseTime || 0), 0) / assignments.length || 0;

    const avgResolutionTime = assignments
      .filter(a => a.resolutionTime)
      .reduce((sum, a) => sum + (a.resolutionTime || 0), 0) / completedChats || 0;

    const avgSatisfaction = assignments
      .filter(a => a.customerSatisfaction)
      .reduce((sum, a) => sum + (a.customerSatisfaction || 0), 0) / assignments.length || 0;

    const totalEstimatedValue = assignments
      .reduce((sum, a) => sum + (Number(a.estimatedValue) || 0), 0);

    const metrics = {
      agentId,
      period: 'custom',
      periodStart: dateFrom,
      periodEnd: dateTo,
      totalChats,
      completedChats,
      activeChats,
      completionRate: totalChats > 0 ? (completedChats / totalChats) * 100 : 0,
      averageResponseTime: Math.round(avgResponseTime),
      averageResolutionTime: Math.round(avgResolutionTime),
      customerSatisfactionAvg: Math.round(avgSatisfaction * 100) / 100,
      totalEstimatedValue,
      transfersGiven: assignments.filter(a => a.status === 'transferred').length,
      escalations: assignments.filter(a => a.status === 'escalated').length
    };

    console.log(`📊 Métricas generadas para agente ${agentId}: ${totalChats} chats`);
    return metrics;
  }

  /**
   * Obtener resumen de todos los agentes
   */
  async getAgentsSummary(): Promise<any[]> {
    const agents = await this.getAllAgents();
    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const summaries = await Promise.all(
      agents.map(async (agent) => {
        const metrics = await this.generateAgentMetrics(agent.id, lastWeek, today);
        const activeChats = await this.getAgentChats(agent.id, 'active');
        
        return {
          ...agent,
          weeklyMetrics: metrics,
          currentActiveChats: activeChats.length,
          workloadPercentage: agent.maxChats > 0 ? 
            Math.round((agent.currentChats / agent.maxChats) * 100) : 0
        };
      })
    );

    console.log(`📈 Resumen generado para ${agents.length} agentes`);
    return summaries;
  }

  /**
   * Asignar chat automáticamente al mejor agente disponible
   */
  async autoAssignChat(
    chatId: string, 
    accountId: number, 
    category?: string,
    priority: string = 'normal'
  ): Promise<InternalChatAssignment | null> {
    
    const availableAgents = await this.getAvailableAgents();
    
    if (availableAgents.length === 0) {
      console.log(`⚠️ No hay agentes disponibles para chat ${chatId}`);
      return null;
    }

    // Lógica de asignación inteligente
    let selectedAgent = availableAgents[0];

    // Priorizar por especialización si se especifica categoría
    if (category) {
      const specializedAgent = availableAgents.find(agent => 
        agent.specialization === category
      );
      if (specializedAgent) {
        selectedAgent = specializedAgent;
      }
    }

    // Para prioridad alta, asignar al agente con menos carga
    if (priority === 'high' || priority === 'urgent') {
      selectedAgent = availableAgents.reduce((prev, current) => 
        (current.currentChats < prev.currentChats) ? current : prev
      );
    }

    return await this.assignChatToAgent(chatId, accountId, selectedAgent.id, {
      category,
      priority,
      notes: `Asignación automática por ${category || 'sistema'}`
    });
  }
}

// Exportar instancia singleton
export const internalAgentManager = new InternalAgentManager();