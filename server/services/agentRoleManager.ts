import { db } from "../db";
import { 
  internalAgents,
  agentActivities,
  type InternalAgent
} from "@shared/schema";
import { eq, and, desc, inArray } from "drizzle-orm";

/**
 * Sistema de gestión de roles y permisos para agentes
 * Controla qué páginas puede ver cada agente según su rol
 */
export class AgentRoleManager {

  // ===== DEFINICIÓN DE ROLES Y PERMISOS =====

  /**
   * Roles disponibles en el sistema
   */
  private readonly ROLES = {
    admin: {
      name: 'Administrador',
      description: 'Acceso completo al sistema',
      level: 5
    },
    supervisor: {
      name: 'Supervisor',
      description: 'Gestión de equipos y reportes avanzados',
      level: 4
    },
    senior_agent: {
      name: 'Agente Senior',
      description: 'Agente experimentado con acceso ampliado',
      level: 3
    },
    agent: {
      name: 'Agente',
      description: 'Agente estándar con acceso básico',
      level: 2
    },
    viewer: {
      name: 'Visualizador',
      description: 'Solo lectura de información básica',
      level: 1
    }
  };

  /**
   * Páginas y módulos disponibles en el sistema
   */
  private readonly PAGES = {
    // Dashboard y inicio
    dashboard: { name: 'Dashboard', category: 'general', minLevel: 1 },
    
    // WhatsApp y comunicación
    whatsapp: { name: 'WhatsApp', category: 'communication', minLevel: 2 },
    whatsapp_accounts: { name: 'Cuentas WhatsApp', category: 'communication', minLevel: 3 },
    whatsapp_settings: { name: 'Configuración WhatsApp', category: 'communication', minLevel: 4 },
    
    // CRM y leads
    leads: { name: 'Leads', category: 'crm', minLevel: 2 },
    leads_create: { name: 'Crear Leads', category: 'crm', minLevel: 2 },
    leads_edit: { name: 'Editar Leads', category: 'crm', minLevel: 2 },
    leads_delete: { name: 'Eliminar Leads', category: 'crm', minLevel: 3 },
    
    // Actividades y tareas
    activities: { name: 'Actividades', category: 'tasks', minLevel: 2 },
    activities_create: { name: 'Crear Actividades', category: 'tasks', minLevel: 2 },
    
    // Tickets y soporte
    tickets: { name: 'Tickets', category: 'support', minLevel: 2 },
    tickets_create: { name: 'Crear Tickets', category: 'support', minLevel: 2 },
    tickets_manage: { name: 'Gestionar Tickets', category: 'support', minLevel: 3 },
    
    // Usuarios y agentes
    users: { name: 'Usuarios', category: 'admin', minLevel: 4 },
    agents: { name: 'Agentes', category: 'admin', minLevel: 4 },
    agent_tracking: { name: 'Rastreo de Agentes', category: 'admin', minLevel: 4 },
    
    // Reportes y análisis
    reports: { name: 'Reportes', category: 'analytics', minLevel: 3 },
    analytics: { name: 'Análisis', category: 'analytics', minLevel: 3 },
    gemini_ai: { name: 'Gemini AI', category: 'analytics', minLevel: 3 },
    
    // Configuración del sistema
    settings: { name: 'Configuración', category: 'admin', minLevel: 4 },
    system_reset: { name: 'Reset del Sistema', category: 'admin', minLevel: 5 },
    
    // Galería y medios
    media_gallery: { name: 'Galería de Medios', category: 'content', minLevel: 2 },
    
    // Campañas de marketing
    marketing: { name: 'Marketing', category: 'marketing', minLevel: 3 },
    campaigns: { name: 'Campañas', category: 'marketing', minLevel: 3 }
  };

  /**
   * Permisos por defecto según el rol
   */
  private readonly DEFAULT_PERMISSIONS = {
    admin: Object.keys(this.PAGES),
    supervisor: [
      'dashboard', 'whatsapp', 'whatsapp_accounts', 'leads', 'leads_create', 
      'leads_edit', 'leads_delete', 'activities', 'activities_create', 
      'tickets', 'tickets_create', 'tickets_manage', 'users', 'agents', 
      'agent_tracking', 'reports', 'analytics', 'gemini_ai', 'settings', 
      'media_gallery', 'marketing', 'campaigns'
    ],
    senior_agent: [
      'dashboard', 'whatsapp', 'leads', 'leads_create', 'leads_edit', 
      'activities', 'activities_create', 'tickets', 'tickets_create', 
      'tickets_manage', 'reports', 'analytics', 'gemini_ai', 'media_gallery', 
      'marketing', 'campaigns'
    ],
    agent: [
      'dashboard', 'whatsapp', 'leads', 'leads_create', 'leads_edit', 
      'activities', 'activities_create', 'tickets', 'tickets_create', 
      'media_gallery'
    ],
    viewer: [
      'dashboard', 'leads', 'activities', 'tickets', 'media_gallery'
    ]
  };

  // ===== GESTIÓN DE ROLES =====

  /**
   * Obtener todos los roles disponibles
   */
  getRoles() {
    return this.ROLES;
  }

  /**
   * Obtener todas las páginas disponibles
   */
  getPages() {
    return this.PAGES;
  }

  /**
   * Obtener permisos por defecto para un rol
   */
  getDefaultPermissions(role: string): string[] {
    return this.DEFAULT_PERMISSIONS[role as keyof typeof this.DEFAULT_PERMISSIONS] || [];
  }

  /**
   * Verificar si un agente tiene permiso para acceder a una página
   */
  async hasPermission(agentId: number, page: string): Promise<boolean> {
    const agent = await this.getAgentRole(agentId);
    if (!agent) return false;

    // Si tiene permisos personalizados, usar esos
    if (agent.permissions && agent.permissions.length > 0) {
      return agent.permissions.includes(page);
    }

    // Si no tiene permisos personalizados, usar los del rol
    const defaultPermissions = this.getDefaultPermissions(agent.role || 'viewer');
    return defaultPermissions.includes(page);
  }

  /**
   * Obtener todas las páginas que puede ver un agente
   */
  async getAgentPages(agentId: number): Promise<string[]> {
    const agent = await this.getAgentRole(agentId);
    if (!agent) return [];

    // Si tiene permisos personalizados, usar esos
    if (agent.permissions && agent.permissions.length > 0) {
      return agent.permissions;
    }

    // Si no tiene permisos personalizados, usar los del rol
    return this.getDefaultPermissions(agent.role || 'viewer');
  }

  /**
   * Obtener información del rol de un agente
   */
  async getAgentRole(agentId: number): Promise<InternalAgent | null> {
    const [agent] = await db
      .select()
      .from(internalAgents)
      .where(eq(internalAgents.id, agentId))
      .limit(1);

    return agent || null;
  }

  /**
   * Asignar rol a un agente
   */
  async assignRole(agentId: number, role: string): Promise<InternalAgent | null> {
    // Verificar que el rol existe
    if (!this.ROLES[role as keyof typeof this.ROLES]) {
      throw new Error(`Rol "${role}" no válido`);
    }

    const [agent] = await db
      .update(internalAgents)
      .set({ 
        role,
        permissions: null, // Limpiar permisos personalizados al cambiar rol
        updatedAt: new Date()
      })
      .where(eq(internalAgents.id, agentId))
      .returning();

    if (agent) {
      console.log(`👤 Rol "${role}" asignado al agente ${agent.name}`);
    }

    return agent || null;
  }

  /**
   * Asignar permisos personalizados a un agente
   */
  async assignCustomPermissions(agentId: number, permissions: string[]): Promise<InternalAgent | null> {
    // Verificar que todas las páginas existen
    const invalidPages = permissions.filter(page => !this.PAGES[page as keyof typeof this.PAGES]);
    if (invalidPages.length > 0) {
      throw new Error(`Páginas no válidas: ${invalidPages.join(', ')}`);
    }

    const [agent] = await db
      .update(internalAgents)
      .set({ 
        permissions,
        updatedAt: new Date()
      })
      .where(eq(internalAgents.id, agentId))
      .returning();

    if (agent) {
      console.log(`🔑 Permisos personalizados asignados al agente ${agent.name}: ${permissions.join(', ')}`);
    }

    return agent || null;
  }

  // ===== ANÁLISIS DE ACCESO POR ROL =====

  /**
   * Obtener estadísticas de acceso por rol
   */
  async getRoleAccessStats(days: number = 30): Promise<any> {
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Obtener todos los agentes
    const agents = await db
      .select()
      .from(internalAgents);

    // Obtener actividades de visualización de páginas
    const activities = await db
      .select()
      .from(agentActivities)
      .where(
        and(
          eq(agentActivities.activityType, 'page_visit'),
          desc(agentActivities.timestamp)
        )
      );

    // Agrupar por rol
    const roleStats = {};

    for (const agent of agents) {
      const role = agent.role || 'viewer';
      if (!roleStats[role]) {
        roleStats[role] = {
          roleName: this.ROLES[role as keyof typeof this.ROLES]?.name || role,
          agentCount: 0,
          totalPageViews: 0,
          uniquePages: new Set(),
          mostVisitedPages: {},
          agents: []
        };
      }

      roleStats[role].agentCount++;

      // Contar actividades de este agente
      const agentActivities = activities.filter(a => a.agentId === agent.id);
      roleStats[role].totalPageViews += agentActivities.length;

      agentActivities.forEach(activity => {
        if (activity.page) {
          roleStats[role].uniquePages.add(activity.page);
          roleStats[role].mostVisitedPages[activity.page] = 
            (roleStats[role].mostVisitedPages[activity.page] || 0) + 1;
        }
      });

      roleStats[role].agents.push({
        id: agent.id,
        name: agent.name,
        pageViews: agentActivities.length,
        permissions: agent.permissions || this.getDefaultPermissions(role)
      });
    }

    // Convertir Sets a arrays y ordenar páginas más visitadas
    Object.keys(roleStats).forEach(role => {
      roleStats[role].uniquePages = Array.from(roleStats[role].uniquePages);
      roleStats[role].mostVisitedPages = Object.entries(roleStats[role].mostVisitedPages)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 10)
        .map(([page, count]) => ({ page, visits: count }));
    });

    console.log(`📊 Estadísticas de acceso por rol generadas para ${Object.keys(roleStats).length} roles`);
    return roleStats;
  }

  /**
   * Generar reporte de permisos por página
   */
  async getPagePermissionsReport(): Promise<any> {
    const agents = await db
      .select()
      .from(internalAgents);

    const pageReport = {};

    // Inicializar reporte por página
    Object.keys(this.PAGES).forEach(page => {
      pageReport[page] = {
        pageName: this.PAGES[page as keyof typeof this.PAGES].name,
        category: this.PAGES[page as keyof typeof this.PAGES].category,
        minLevel: this.PAGES[page as keyof typeof this.PAGES].minLevel,
        totalAgentsWithAccess: 0,
        agentsByRole: {},
        accessDeniedCount: 0
      };
    });

    // Analizar acceso por agente
    for (const agent of agents) {
      const role = agent.role || 'viewer';
      const permissions = agent.permissions || this.getDefaultPermissions(role);

      Object.keys(this.PAGES).forEach(page => {
        if (permissions.includes(page)) {
          pageReport[page].totalAgentsWithAccess++;
          
          if (!pageReport[page].agentsByRole[role]) {
            pageReport[page].agentsByRole[role] = 0;
          }
          pageReport[page].agentsByRole[role]++;
        } else {
          pageReport[page].accessDeniedCount++;
        }
      });
    }

    console.log(`📋 Reporte de permisos por página generado para ${Object.keys(this.PAGES).length} páginas`);
    return pageReport;
  }

  /**
   * Verificar acceso y registrar intento de acceso
   */
  async checkAndLogPageAccess(
    agentId: number, 
    page: string, 
    sessionToken?: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    
    const hasPermission = await this.hasPermission(agentId, page);
    
    if (!hasPermission) {
      console.log(`🚫 Acceso denegado para agente ${agentId} a página: ${page}`);
      
      // Registrar intento de acceso denegado si hay sesión activa
      if (sessionToken) {
        const { agentActivityTracker } = await import('./agentActivityTracker');
        await agentActivityTracker.recordActivity(
          sessionToken,
          'access_denied',
          page,
          'Intento de acceso a página sin permisos',
          undefined,
          { reason: 'insufficient_permissions' }
        );
      }
      
      return { 
        allowed: false, 
        reason: 'No tienes permisos para acceder a esta página' 
      };
    }

    console.log(`✅ Acceso permitido para agente ${agentId} a página: ${page}`);
    return { allowed: true };
  }
}

// Exportar instancia singleton
export const agentRoleManager = new AgentRoleManager();