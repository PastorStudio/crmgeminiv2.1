import { db } from "../db";
import { 
  agentSessions, 
  agentActivities, 
  agentAccessStats,
  internalAgents,
  type AgentSession,
  type AgentActivity,
  type AgentAccessStats,
  type InsertAgentSession,
  type InsertAgentActivity,
  type InsertAgentAccessStats
} from "@shared/schema";
import { eq, desc, and, gte, lte, sql, count } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * Servicio de rastreo y monitoreo de actividades de agentes
 * Sistema completo para verificar accesos, actividades y generar reportes de movimientos
 */
export class AgentActivityTracker {

  // ===== GESTIÓN DE SESIONES =====

  /**
   * Iniciar sesión de agente (registro de acceso al sistema)
   */
  async startAgentSession(
    agentId: number, 
    userId?: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AgentSession> {
    
    const sessionToken = nanoid(32);
    
    const [session] = await db
      .insert(agentSessions)
      .values({
        agentId,
        userId,
        sessionToken,
        ipAddress,
        userAgent,
        loginTime: new Date(),
        isActive: true
      })
      .returning();

    // Actualizar estadísticas de acceso
    await this.updateAccessStats(agentId);
    
    console.log(`🔐 Nueva sesión iniciada para agente ${agentId} - Token: ${sessionToken.substring(0, 8)}...`);
    return session;
  }

  /**
   * Finalizar sesión de agente
   */
  async endAgentSession(sessionToken: string): Promise<AgentSession | null> {
    const now = new Date();
    
    // Obtener la sesión actual
    const [currentSession] = await db
      .select()
      .from(agentSessions)
      .where(
        and(
          eq(agentSessions.sessionToken, sessionToken),
          eq(agentSessions.isActive, true)
        )
      )
      .limit(1);

    if (!currentSession) {
      return null;
    }

    // Calcular duración de la sesión
    const duration = Math.floor((now.getTime() - currentSession.loginTime.getTime()) / (1000 * 60)); // en minutos

    const [session] = await db
      .update(agentSessions)
      .set({
        logoutTime: now,
        isActive: false,
        totalDuration: duration
      })
      .where(eq(agentSessions.sessionToken, sessionToken))
      .returning();

    if (session) {
      await this.updateAccessStats(session.agentId);
      console.log(`🔓 Sesión finalizada para agente ${session.agentId} - Duración: ${duration} minutos`);
    }

    return session || null;
  }

  /**
   * Registrar actividad del agente durante la sesión
   */
  async recordActivity(
    sessionToken: string,
    activityType: string,
    page?: string,
    action?: string,
    targetId?: string,
    metadata?: any,
    duration?: number
  ): Promise<AgentActivity | null> {
    
    // Obtener sesión activa
    const [session] = await db
      .select()
      .from(agentSessions)
      .where(
        and(
          eq(agentSessions.sessionToken, sessionToken),
          eq(agentSessions.isActive, true)
        )
      )
      .limit(1);

    if (!session) {
      console.log(`⚠️ No se encontró sesión activa para token: ${sessionToken.substring(0, 8)}...`);
      return null;
    }

    const [activity] = await db
      .insert(agentActivities)
      .values({
        sessionId: session.id,
        agentId: session.agentId,
        activityType,
        page,
        action,
        targetId,
        metadata,
        duration,
        timestamp: new Date()
      })
      .returning();

    // Incrementar contadores en la sesión
    await db
      .update(agentSessions)
      .set({
        pagesVisited: sql`${agentSessions.pagesVisited} + 1`,
        actionsPerformed: sql`${agentSessions.actionsPerformed} + 1`
      })
      .where(eq(agentSessions.id, session.id));

    console.log(`📝 Actividad registrada: ${activityType} - ${action || 'N/A'} para agente ${session.agentId}`);
    return activity;
  }

  // ===== CONSULTAS Y REPORTES =====

  /**
   * Obtener estadísticas de acceso de un agente específico
   */
  async getAgentAccessStats(agentId: number): Promise<AgentAccessStats | null> {
    const [stats] = await db
      .select()
      .from(agentAccessStats)
      .where(eq(agentAccessStats.agentId, agentId))
      .limit(1);

    return stats || null;
  }

  /**
   * Obtener todas las sesiones de un agente
   */
  async getAgentSessions(agentId: number, limit: number = 50): Promise<AgentSession[]> {
    const sessions = await db
      .select()
      .from(agentSessions)
      .where(eq(agentSessions.agentId, agentId))
      .orderBy(desc(agentSessions.loginTime))
      .limit(limit);

    console.log(`📊 ${sessions.length} sesiones encontradas para agente ${agentId}`);
    return sessions;
  }

  /**
   * Obtener actividades detalladas de una sesión específica
   */
  async getSessionActivities(sessionId: number): Promise<AgentActivity[]> {
    const activities = await db
      .select()
      .from(agentActivities)
      .where(eq(agentActivities.sessionId, sessionId))
      .orderBy(desc(agentActivities.timestamp));

    return activities;
  }

  /**
   * Obtener todas las actividades de un agente en un período
   */
  async getAgentActivities(
    agentId: number, 
    dateFrom: Date, 
    dateTo: Date,
    activityType?: string
  ): Promise<AgentActivity[]> {
    
    const conditions = [
      eq(agentActivities.agentId, agentId),
      gte(agentActivities.timestamp, dateFrom),
      lte(agentActivities.timestamp, dateTo)
    ];

    if (activityType) {
      conditions.push(eq(agentActivities.activityType, activityType));
    }

    const activities = await db
      .select()
      .from(agentActivities)
      .where(and(...conditions))
      .orderBy(desc(agentActivities.timestamp));

    console.log(`🔍 ${activities.length} actividades encontradas para agente ${agentId}`);
    return activities;
  }

  /**
   * Generar reporte completo de un agente (para el botón preview)
   */
  async generateAgentReport(agentId: number, days: number = 30): Promise<any> {
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const dateTo = new Date();

    // Obtener información básica del agente
    const [agent] = await db
      .select()
      .from(internalAgents)
      .where(eq(internalAgents.id, agentId))
      .limit(1);

    if (!agent) {
      throw new Error(`Agente ${agentId} no encontrado`);
    }

    // Obtener estadísticas de acceso
    const accessStats = await this.getAgentAccessStats(agentId);

    // Obtener sesiones recientes
    const sessions = await this.getAgentSessions(agentId, 20);

    // Obtener actividades del período
    const activities = await this.getAgentActivities(agentId, dateFrom, dateTo);

    // Calcular métricas del período
    const sessionsInPeriod = sessions.filter(s => 
      s.loginTime >= dateFrom && s.loginTime <= dateTo
    );

    const totalSessionTime = sessionsInPeriod.reduce((sum, session) => 
      sum + (session.totalDuration || 0), 0
    );

    const activitiesByType = activities.reduce((acc, activity) => {
      acc[activity.activityType] = (acc[activity.activityType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const pageVisits = activities.filter(a => a.activityType === 'page_visit');
    const mostVisitedPages = pageVisits.reduce((acc, activity) => {
      if (activity.page) {
        acc[activity.page] = (acc[activity.page] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const report = {
      agent: {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        status: agent.status,
        specialization: agent.specialization
      },
      accessStats,
      periodSummary: {
        days,
        totalSessions: sessionsInPeriod.length,
        totalSessionTime, // en minutos
        averageSessionTime: sessionsInPeriod.length > 0 ? 
          Math.round(totalSessionTime / sessionsInPeriod.length) : 0,
        totalActivities: activities.length,
        lastAccess: sessions[0]?.loginTime || null
      },
      activitiesByType,
      mostVisitedPages: Object.entries(mostVisitedPages)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([page, count]) => ({ page, visits: count })),
      recentSessions: sessions.slice(0, 10),
      recentActivities: activities.slice(0, 50)
    };

    console.log(`📈 Reporte generado para agente ${agent.name} (${days} días)`);
    return report;
  }

  /**
   * Obtener resumen de todos los agentes
   */
  async getAllAgentsAccessSummary(): Promise<any[]> {
    const agents = await db
      .select()
      .from(internalAgents)
      .orderBy(internalAgents.name);

    const summaries = await Promise.all(
      agents.map(async (agent) => {
        const accessStats = await this.getAgentAccessStats(agent.id);
        const recentSessions = await this.getAgentSessions(agent.id, 5);
        
        return {
          ...agent,
          accessStats,
          lastSession: recentSessions[0] || null,
          isOnline: recentSessions.some(s => s.isActive) || false,
          sessionsThisWeek: recentSessions.filter(s => 
            s.loginTime >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          ).length
        };
      })
    );

    console.log(`📊 Resumen de acceso generado para ${agents.length} agentes`);
    return summaries;
  }

  // ===== MÉTODOS PRIVADOS =====

  /**
   * Actualizar estadísticas de acceso del agente
   */
  private async updateAccessStats(agentId: number): Promise<void> {
    const now = new Date();
    
    // Obtener todas las sesiones del agente
    const sessions = await db
      .select()
      .from(agentSessions)
      .where(eq(agentSessions.agentId, agentId));

    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(s => s.totalDuration !== null);
    const totalLoginTime = completedSessions.reduce((sum, s) => sum + (s.totalDuration || 0), 0);
    const averageSessionDuration = completedSessions.length > 0 ? 
      Math.round(totalLoginTime / completedSessions.length) : 0;

    const lastSession = sessions.sort((a, b) => 
      b.loginTime.getTime() - a.loginTime.getTime()
    )[0];

    // Obtener página más visitada
    const activities = await db
      .select()
      .from(agentActivities)
      .where(eq(agentActivities.agentId, agentId));

    const pageVisits = activities.filter(a => a.page && a.activityType === 'page_visit');
    const pageCounts = pageVisits.reduce((acc, activity) => {
      if (activity.page) {
        acc[activity.page] = (acc[activity.page] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const mostVisitedPage = Object.entries(pageCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || null;

    // Actualizar o insertar estadísticas
    const existingStats = await this.getAgentAccessStats(agentId);
    
    if (existingStats) {
      await db
        .update(agentAccessStats)
        .set({
          totalSessions,
          totalLoginTime,
          lastLoginTime: lastSession?.loginTime || null,
          lastLogoutTime: lastSession?.logoutTime || null,
          averageSessionDuration,
          mostVisitedPage,
          totalPagesVisited: pageVisits.length,
          totalActionsPerformed: activities.length,
          lastActivity: activities[0]?.timestamp || null,
          updatedAt: now
        })
        .where(eq(agentAccessStats.agentId, agentId));
    } else {
      await db
        .insert(agentAccessStats)
        .values({
          agentId,
          totalSessions,
          totalLoginTime,
          lastLoginTime: lastSession?.loginTime || null,
          lastLogoutTime: lastSession?.logoutTime || null,
          averageSessionDuration,
          mostVisitedPage,
          totalPagesVisited: pageVisits.length,
          totalActionsPerformed: activities.length,
          lastActivity: activities[0]?.timestamp || null
        });
    }
  }

  /**
   * Limpiar sesiones inactivas (maintenance)
   */
  async cleanupInactiveSessions(): Promise<number> {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    
    const inactiveSessions = await db
      .select()
      .from(agentSessions)
      .where(
        and(
          eq(agentSessions.isActive, true),
          lte(agentSessions.loginTime, sixHoursAgo)
        )
      );

    for (const session of inactiveSessions) {
      await this.endAgentSession(session.sessionToken);
    }

    console.log(`🧹 ${inactiveSessions.length} sesiones inactivas limpiadas`);
    return inactiveSessions.length;
  }
}

// Exportar instancia singleton
export const agentActivityTracker = new AgentActivityTracker();