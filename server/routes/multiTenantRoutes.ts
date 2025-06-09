import { Router } from 'express';
import { db } from '../db';
import { 
  users, 
  whatsappAccounts, 
  leads, 
  contacts, 
  conversations,
  userAccountAssignments,
  organizations
} from '@shared/schema';
import { eq, and, inArray, or, desc, asc } from 'drizzle-orm';
import { 
  multiTenantAuth, 
  requirePermission, 
  requireAccountAccess,
  getAccessibleAccountIds,
  canAccessAccount,
  getUserDataFilters,
  PERMISSIONS,
  type AuthenticatedRequest 
} from '../middleware/multiTenantAuth';

const router = Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(multiTenantAuth);

/**
 * Obtener cuentas WhatsApp accesibles para el usuario
 */
router.get('/accounts', async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;
    const filters = getUserDataFilters(user);

    let query = db.select().from(whatsappAccounts);

    if (!user.canAccessAll) {
      query = query.where(filters.accountFilter);
    }

    const accounts = await query.orderBy(asc(whatsappAccounts.name));

    res.json({
      success: true,
      accounts: accounts.map(account => ({
        ...account,
        // Ocultar datos sensibles para usuarios no admin
        sessionData: user.canAccessAll ? account.sessionData : null,
      })),
      userInfo: {
        canCreateAccounts: user.canAccessAll,
        assignedCount: user.assignedAccountIds.length,
        totalAccessible: accounts.length,
      }
    });
  } catch (error) {
    console.error('Error obteniendo cuentas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * Obtener leads filtrados por permisos del usuario
 */
router.get('/leads', async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;
    const { accountId, status, limit = 50 } = req.query;

    let query = db
      .select({
        id: leads.id,
        title: leads.title,
        name: leads.name,
        email: leads.email,
        company: leads.company,
        status: leads.status,
        value: leads.value,
        whatsappAccountId: leads.whatsappAccountId,
        assignedTo: leads.assignedTo,
        createdAt: leads.createdAt,
      })
      .from(leads);

    // Filtrar por cuentas accesibles
    if (!user.canAccessAll) {
      if (user.assignedAccountIds.length === 0) {
        return res.json({ success: true, leads: [], total: 0 });
      }
      query = query.where(inArray(leads.whatsappAccountId, user.assignedAccountIds));
    }

    // Filtros adicionales
    const conditions = [];
    if (accountId && canAccessAccount(user, parseInt(accountId as string))) {
      conditions.push(eq(leads.whatsappAccountId, parseInt(accountId as string)));
    }
    if (status) {
      conditions.push(eq(leads.status, status as string));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query
      .orderBy(desc(leads.createdAt))
      .limit(parseInt(limit as string));

    res.json({
      success: true,
      leads: results,
      total: results.length,
      userAccess: {
        canManageLeads: user.permissions.includes(PERMISSIONS.MANAGE_LEADS),
        canExportLeads: user.permissions.includes(PERMISSIONS.EXPORT_LEADS),
        assignedAccounts: user.assignedAccountIds,
      }
    });
  } catch (error) {
    console.error('Error obteniendo leads:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * Crear lead (requiere permisos)
 */
router.post('/leads', requirePermission(PERMISSIONS.MANAGE_LEADS), async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;
    const { whatsappAccountId, ...leadData } = req.body;

    // Verificar acceso a la cuenta
    if (!canAccessAccount(user, whatsappAccountId)) {
      return res.status(403).json({ error: 'Sin acceso a esta cuenta WhatsApp' });
    }

    const [newLead] = await db
      .insert(leads)
      .values({
        ...leadData,
        whatsappAccountId,
        assignedTo: user.id, // Asignar al usuario que crea
      })
      .returning();

    res.json({ success: true, lead: newLead });
  } catch (error) {
    console.error('Error creando lead:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * Obtener conversaciones filtradas
 */
router.get('/conversations', async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;
    const { accountId, limit = 20 } = req.query;

    let query = db
      .select()
      .from(conversations);

    // Filtrar por cuentas accesibles
    if (!user.canAccessAll) {
      if (user.assignedAccountIds.length === 0) {
        return res.json({ success: true, conversations: [] });
      }
      query = query.where(inArray(conversations.whatsappAccountId, user.assignedAccountIds));
    }

    // Filtro por cuenta específica
    if (accountId && canAccessAccount(user, parseInt(accountId as string))) {
      query = query.where(eq(conversations.whatsappAccountId, parseInt(accountId as string)));
    }

    const results = await query
      .orderBy(desc(conversations.lastMessageAt))
      .limit(parseInt(limit as string));

    res.json({
      success: true,
      conversations: results,
      userAccess: {
        canSendMessages: user.permissions.includes(PERMISSIONS.SEND_MESSAGES),
        canViewAll: user.canAccessAll,
      }
    });
  } catch (error) {
    console.error('Error obteniendo conversaciones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * Obtener estadísticas del dashboard filtradas por usuario
 */
router.get('/dashboard/stats', async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;

    // Construir filtros basados en permisos
    let accountFilter = user.canAccessAll 
      ? undefined 
      : user.assignedAccountIds.length > 0
        ? inArray(leads.whatsappAccountId, user.assignedAccountIds)
        : eq(leads.whatsappAccountId, -1);

    // Obtener estadísticas de leads
    const leadsQuery = db
      .select({
        total: leads.id,
        status: leads.status,
      })
      .from(leads);

    if (accountFilter) {
      leadsQuery.where(accountFilter);
    }

    const leadsData = await leadsQuery;

    const stats = {
      totalLeads: leadsData.length,
      newLeads: leadsData.filter(l => l.status === 'new').length,
      activeLeads: leadsData.filter(l => ['contacted', 'qualified'].includes(l.status || '')).length,
      wonLeads: leadsData.filter(l => l.status === 'won').length,
      accessibleAccounts: user.assignedAccountIds.length,
      userRole: user.role,
      permissions: user.permissions,
    };

    res.json({
      success: true,
      stats,
      userInfo: {
        username: user.username,
        role: user.role,
        canAccessAll: user.canAccessAll,
        assignedAccounts: user.assignedAccountIds.length,
      }
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * Asignar cuenta a usuario (solo admins)
 */
router.post('/accounts/:accountId/assign', 
  requirePermission(PERMISSIONS.MANAGE_USERS),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { accountId } = req.params;
      const { userId, role = 'operator', permissions = [] } = req.body;
      const assignedBy = req.user.id;

      // Verificar que la cuenta existe
      const [account] = await db
        .select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.id, parseInt(accountId)));

      if (!account) {
        return res.status(404).json({ error: 'Cuenta no encontrada' });
      }

      // Verificar que el usuario existe
      const [targetUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!targetUser) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      // Crear o actualizar asignación
      const [assignment] = await db
        .insert(userAccountAssignments)
        .values({
          userId,
          whatsappAccountId: parseInt(accountId),
          role,
          permissions,
          assignedBy,
        })
        .onConflictDoUpdate({
          target: [userAccountAssignments.userId, userAccountAssignments.whatsappAccountId],
          set: {
            role,
            permissions,
            assignedBy,
            isActive: true,
          }
        })
        .returning();

      res.json({
        success: true,
        assignment,
        message: `Cuenta ${account.name} asignada a ${targetUser.username}`
      });
    } catch (error) {
      console.error('Error asignando cuenta:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

/**
 * Obtener usuarios y sus asignaciones (solo admins)
 */
router.get('/users/assignments', 
  requirePermission(PERMISSIONS.MANAGE_USERS),
  async (req: AuthenticatedRequest, res) => {
    try {
      const usersWithAssignments = await db
        .select({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          role: users.role,
          status: users.status,
          assignmentId: userAccountAssignments.id,
          accountId: userAccountAssignments.whatsappAccountId,
          accountRole: userAccountAssignments.role,
          accountName: whatsappAccounts.name,
        })
        .from(users)
        .leftJoin(userAccountAssignments, eq(users.id, userAccountAssignments.userId))
        .leftJoin(whatsappAccounts, eq(userAccountAssignments.whatsappAccountId, whatsappAccounts.id))
        .orderBy(users.username);

      // Agrupar por usuario
      const usersMap = new Map();
      usersWithAssignments.forEach(row => {
        if (!usersMap.has(row.id)) {
          usersMap.set(row.id, {
            id: row.id,
            username: row.username,
            fullName: row.fullName,
            role: row.role,
            status: row.status,
            assignments: []
          });
        }

        if (row.assignmentId) {
          usersMap.get(row.id).assignments.push({
            accountId: row.accountId,
            accountName: row.accountName,
            role: row.accountRole,
          });
        }
      });

      res.json({
        success: true,
        users: Array.from(usersMap.values()),
      });
    } catch (error) {
      console.error('Error obteniendo asignaciones:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

/**
 * Perfil del usuario actual
 */
router.get('/profile', async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user;

    // Obtener información detallada del usuario
    const [userDetails] = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        department: users.department,
        avatar: users.avatar,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, user.id));

    // Obtener asignaciones de cuentas
    const assignments = await db
      .select({
        accountId: whatsappAccounts.id,
        accountName: whatsappAccounts.name,
        role: userAccountAssignments.role,
        assignedAt: userAccountAssignments.assignedAt,
      })
      .from(userAccountAssignments)
      .innerJoin(whatsappAccounts, eq(userAccountAssignments.whatsappAccountId, whatsappAccounts.id))
      .where(
        and(
          eq(userAccountAssignments.userId, user.id),
          eq(userAccountAssignments.isActive, true)
        )
      );

    res.json({
      success: true,
      profile: {
        ...userDetails,
        permissions: user.permissions,
        assignments,
        accessLevel: {
          canAccessAll: user.canAccessAll,
          assignedAccountsCount: user.assignedAccountIds.length,
        }
      }
    });
  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;