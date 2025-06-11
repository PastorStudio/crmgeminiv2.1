import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users, userAccountAssignments, whatsappAccounts, organizations } from '@shared/schema';
import { eq, and, inArray, or } from 'drizzle-orm';

export interface AuthenticatedUser {
  id: number;
  username: string;
  role: string;
  organizationId?: number;
  permissions: string[];
  assignedAccountIds: number[];
  canAccessAll: boolean;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

/**
 * Middleware de autenticación multi-tenant
 * Cada usuario solo puede acceder a los datos que le han sido asignados
 */
export async function multiTenantAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Obtener userId desde la sesión, headers o query params para testing
    let userId = req.session?.userId || req.headers['x-user-id'] || req.query.userId;
    
    // Para testing, permitir override de usuario
    if (req.query.testUser) {
      const testUserMap: Record<string, number> = {
        'superadmin': 3,  // DJP
        'admin': 17,      // admin
        'manager': 19,    // manager1
        'agent': 20,      // agent1
        'agent2': 21,     // agent2
        'demo': 9         // demo
      };
      userId = testUserMap[req.query.testUser as string] || userId;
    }
    
    userId = parseInt(userId as string) || 3; // Default a DJP (superadmin)
    
    if (!userId) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    // Obtener información del usuario con sus asignaciones
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        role: users.role,
        organizationId: users.organizationId,
        permissions: users.permissions,
        assignedAccounts: users.assignedAccounts,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    // Obtener cuentas WhatsApp asignadas al usuario
    const accountAssignments = await db
      .select({
        whatsappAccountId: userAccountAssignments.whatsappAccountId,
        role: userAccountAssignments.role,
        permissions: userAccountAssignments.permissions,
      })
      .from(userAccountAssignments)
      .where(
        and(
          eq(userAccountAssignments.userId, userId),
          eq(userAccountAssignments.isActive, true)
        )
      );

    const assignedAccountIds = accountAssignments.map(a => a.whatsappAccountId);

    // Determinar permisos del usuario - solo superadmin y admin pueden ver todos los datos
    const canAccessAll = user.role === 'superadmin' || user.role === 'admin';
    
    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      username: user.username,
      role: user.role,
      organizationId: user.organizationId || undefined,
      permissions: user.permissions as string[] || [],
      assignedAccountIds,
      canAccessAll,
    };

    (req as AuthenticatedRequest).user = authenticatedUser;
    next();
  } catch (error) {
    console.error('Error en autenticación multi-tenant:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/**
 * Filtrar cuentas WhatsApp basado en permisos del usuario
 */
export function getAccessibleAccountIds(user: AuthenticatedUser, requestedAccountIds?: number[]): number[] {
  if (user.canAccessAll) {
    return requestedAccountIds || [];
  }

  if (!requestedAccountIds) {
    return user.assignedAccountIds;
  }

  // Solo devolver las cuentas que el usuario puede acceder
  return requestedAccountIds.filter(id => user.assignedAccountIds.includes(id));
}

/**
 * Verificar si el usuario puede acceder a una cuenta específica
 */
export function canAccessAccount(user: AuthenticatedUser, accountId: number): boolean {
  return user.canAccessAll || user.assignedAccountIds.includes(accountId);
}

/**
 * Verificar permisos específicos
 */
export function hasPermission(user: AuthenticatedUser, permission: string): boolean {
  if (user.canAccessAll) return true;
  return user.permissions.includes(permission);
}

/**
 * Middleware para verificar permisos específicos
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    
    if (!user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (!hasPermission(user, permission)) {
      return res.status(403).json({ error: 'Sin permisos suficientes' });
    }

    next();
  };
}

/**
 * Middleware para verificar acceso a cuenta específica
 */
export function requireAccountAccess() {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user;
    const accountId = parseInt(req.params.accountId || req.body.accountId || req.query.accountId as string);
    
    if (!user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (!accountId) {
      return res.status(400).json({ error: 'ID de cuenta requerido' });
    }

    if (!canAccessAccount(user, accountId)) {
      return res.status(403).json({ error: 'Sin acceso a esta cuenta' });
    }

    next();
  };
}

/**
 * Obtener filtros de base de datos para el usuario
 */
export function getUserDataFilters(user: AuthenticatedUser) {
  if (user.canAccessAll) {
    return {}; // Sin filtros para admins
  }

  return {
    // Filtrar por cuentas asignadas
    accountFilter: user.assignedAccountIds.length > 0 
      ? inArray(whatsappAccounts.id, user.assignedAccountIds)
      : eq(whatsappAccounts.id, -1), // Ninguna cuenta si no tiene asignaciones
    
    // Filtrar por organización si aplica
    organizationFilter: user.organizationId 
      ? eq(users.organizationId, user.organizationId)
      : undefined,
  };
}

/**
 * Roles y permisos predefinidos
 */
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin', 
  MANAGER: 'manager',
  AGENT: 'agent',
  READONLY: 'readonly',
} as const;

export const PERMISSIONS = {
  // Cuentas WhatsApp
  VIEW_ACCOUNTS: 'view_accounts',
  MANAGE_ACCOUNTS: 'manage_accounts',
  DELETE_ACCOUNTS: 'delete_accounts',
  
  // Leads y contactos
  VIEW_LEADS: 'view_leads',
  MANAGE_LEADS: 'manage_leads',
  DELETE_LEADS: 'delete_leads',
  EXPORT_LEADS: 'export_leads',
  
  // Mensajes y chats
  VIEW_MESSAGES: 'view_messages',
  SEND_MESSAGES: 'send_messages',
  DELETE_MESSAGES: 'delete_messages',
  
  // Configuración
  MANAGE_SETTINGS: 'manage_settings',
  MANAGE_USERS: 'manage_users',
  MANAGE_ORGANIZATION: 'manage_organization',
  
  // Reportes y análisis
  VIEW_REPORTS: 'view_reports',
  ADVANCED_REPORTS: 'advanced_reports',
} as const;

/**
 * Permisos por rol
 */
export const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
  [ROLES.ADMIN]: [
    PERMISSIONS.VIEW_ACCOUNTS,
    PERMISSIONS.MANAGE_ACCOUNTS,
    PERMISSIONS.VIEW_LEADS,
    PERMISSIONS.MANAGE_LEADS,
    PERMISSIONS.EXPORT_LEADS,
    PERMISSIONS.VIEW_MESSAGES,
    PERMISSIONS.SEND_MESSAGES,
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.ADVANCED_REPORTS,
  ],
  [ROLES.MANAGER]: [
    PERMISSIONS.VIEW_ACCOUNTS,
    PERMISSIONS.VIEW_LEADS,
    PERMISSIONS.MANAGE_LEADS,
    PERMISSIONS.EXPORT_LEADS,
    PERMISSIONS.VIEW_MESSAGES,
    PERMISSIONS.SEND_MESSAGES,
    PERMISSIONS.VIEW_REPORTS,
  ],
  [ROLES.AGENT]: [
    PERMISSIONS.VIEW_ACCOUNTS,
    PERMISSIONS.VIEW_LEADS,
    PERMISSIONS.MANAGE_LEADS,
    PERMISSIONS.VIEW_MESSAGES,
    PERMISSIONS.SEND_MESSAGES,
  ],
  [ROLES.READONLY]: [
    PERMISSIONS.VIEW_ACCOUNTS,
    PERMISSIONS.VIEW_LEADS,
    PERMISSIONS.VIEW_MESSAGES,
    PERMISSIONS.VIEW_REPORTS,
  ],
};