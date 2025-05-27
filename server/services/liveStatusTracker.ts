import { db } from "../db";
import { agentSessions, type AgentSession } from "@shared/schema";
import { eq, and, gte } from "drizzle-orm";

/**
 * Servicio para rastrear el estado en vivo de los agentes
 * Determina si un agente está actualmente activo en el sistema
 */
export class LiveStatusTracker {
  private activeAgents = new Set<number>();
  private heartbeatInterval = 30000; // 30 segundos
  private sessionTimeout = 60000; // 1 minuto

  constructor() {
    // Limpiar sesiones inactivas cada minuto
    setInterval(() => this.cleanupInactiveSessions(), 60000);
  }

  /**
   * Marcar agente como activo (heartbeat)
   */
  async markAgentActive(agentId: number): Promise<void> {
    this.activeAgents.add(agentId);
    
    // Actualizar solo el campo isActive por ahora
    await db
      .update(agentSessions)
      .set({ 
        isActive: true 
      })
      .where(
        and(
          eq(agentSessions.agentId, agentId),
          eq(agentSessions.isActive, true)
        )
      );
    
    console.log(`💚 Agente ${agentId} marcado como activo`);
  }

  /**
   * Marcar agente como inactivo
   */
  async markAgentInactive(agentId: number): Promise<void> {
    this.activeAgents.delete(agentId);
    
    await db
      .update(agentSessions)
      .set({ 
        isActive: false,
        logoutTime: new Date()
      })
      .where(
        and(
          eq(agentSessions.agentId, agentId),
          eq(agentSessions.isActive, true)
        )
      );
    
    console.log(`⚫ Agente ${agentId} marcado como inactivo`);
  }

  /**
   * Verificar si un agente está activo
   */
  async isAgentActive(agentId: number): Promise<boolean> {
    // Por ahora usamos memoria para verificar estado activo
    return this.activeAgents.has(agentId);
  }

  /**
   * Obtener todos los agentes activos
   */
  async getActiveAgents(): Promise<number[]> {
    return Array.from(this.activeAgents);
  }

  /**
   * Limpiar sesiones inactivas
   */
  private async cleanupInactiveSessions(): Promise<void> {
    const timeoutAgo = new Date(Date.now() - this.sessionTimeout);
    
    const inactiveSessions = await db
      .select()
      .from(agentSessions)
      .where(
        and(
          eq(agentSessions.isActive, true),
          gte(agentSessions.lastHeartbeat, timeoutAgo)
        )
      );

    for (const session of inactiveSessions) {
      await this.markAgentInactive(session.agentId);
    }
  }

  /**
   * Obtener estado de múltiples agentes
   */
  async getAgentsStatus(agentIds: number[]): Promise<Record<number, boolean>> {
    const status: Record<number, boolean> = {};
    
    for (const agentId of agentIds) {
      status[agentId] = await this.isAgentActive(agentId);
    }
    
    return status;
  }
}

export const liveStatusTracker = new LiveStatusTracker();