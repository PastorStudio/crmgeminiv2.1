import { Router, Request, Response } from 'express';
import { db } from '../db';
import { 
  whatsappAccounts, 
  leads, 
  conversations, 
  users, 
  userAccountAssignments,
  chatAssignments,
  contacts
} from '@shared/schema';
import { eq, and, inArray, or, sql, desc, asc } from 'drizzle-orm';
import { multiTenantAuth, AuthenticatedRequest, getAccessibleAccountIds, canAccessAccount } from '../middleware/multiTenantAuth';

const router = Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(multiTenantAuth);

/**
 * GET /api/isolated/accounts
 * Obtener solo las cuentas WhatsApp asignadas al usuario actual
 */
router.get('/accounts', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    let accountsQuery;

    if (user.canAccessAll) {
      // Superadmin y admin ven todas las cuentas
      accountsQuery = db
        .select({
          id: whatsappAccounts.id,
          name: whatsappAccounts.name,
          description: whatsappAccounts.description,
          status: whatsappAccounts.status,
          ownerName: whatsappAccounts.ownerName,
          ownerPhone: whatsappAccounts.ownerPhone,
          autoResponseEnabled: whatsappAccounts.autoResponseEnabled,
          createdAt: whatsappAccounts.createdAt,
          organizationId: whatsappAccounts.organizationId
        })
        .from(whatsappAccounts)
        .orderBy(asc(whatsappAccounts.name));
    } else {
      // Otros usuarios solo ven sus cuentas asignadas
      if (user.assignedAccountIds.length === 0) {
        return res.json({ success: true, accounts: [] });
      }

      accountsQuery = db
        .select({
          id: whatsappAccounts.id,
          name: whatsappAccounts.name,
          description: whatsappAccounts.description,
          status: whatsappAccounts.status,
          ownerName: whatsappAccounts.ownerName,
          ownerPhone: whatsappAccounts.ownerPhone,
          autoResponseEnabled: whatsappAccounts.autoResponseEnabled,
          createdAt: whatsappAccounts.createdAt,
          organizationId: whatsappAccounts.organizationId
        })
        .from(whatsappAccounts)
        .where(inArray(whatsappAccounts.id, user.assignedAccountIds))
        .orderBy(asc(whatsappAccounts.name));
    }

    const accounts = await accountsQuery;

    res.json({
      success: true,
      accounts,
      userInfo: {
        id: user.id,
        username: user.username,
        role: user.role,
        canAccessAll: user.canAccessAll,
        assignedAccountsCount: user.assignedAccountIds.length
      }
    });
  } catch (error) {
    console.error('Error obteniendo cuentas del usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/isolated/leads
 * Obtener solo los leads de las cuentas asignadas al usuario
 */
router.get('/leads', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    let leadsQuery;

    if (user.canAccessAll) {
      // Superadmin y admin ven todos los leads
      leadsQuery = db
        .select({
          id: leads.id,
          name: leads.name,
          phone: leads.phone,
          email: leads.email,
          status: leads.status,
          source: leads.source,
          whatsappAccountId: leads.whatsappAccountId,
          assignedUserId: leads.assignedUserId,
          createdAt: leads.createdAt,
          updatedAt: leads.updatedAt
        })
        .from(leads)
        .orderBy(desc(leads.createdAt));
    } else {
      // Otros usuarios solo ven leads de sus cuentas asignadas
      if (user.assignedAccountIds.length === 0) {
        return res.json({ success: true, leads: [] });
      }

      leadsQuery = db
        .select({
          id: leads.id,
          name: leads.name,
          phone: leads.phone,
          email: leads.email,
          status: leads.status,
          source: leads.source,
          whatsappAccountId: leads.whatsappAccountId,
          assignedUserId: leads.assignedUserId,
          createdAt: leads.createdAt,
          updatedAt: leads.updatedAt
        })
        .from(leads)
        .where(inArray(leads.whatsappAccountId, user.assignedAccountIds))
        .orderBy(desc(leads.createdAt));
    }

    const userLeads = await leadsQuery;

    res.json({
      success: true,
      leads: userLeads,
      userInfo: {
        id: user.id,
        username: user.username,
        role: user.role,
        canAccessAll: user.canAccessAll,
        leadsCount: userLeads.length
      }
    });
  } catch (error) {
    console.error('Error obteniendo leads del usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/isolated/conversations
 * Obtener solo las conversaciones de las cuentas asignadas al usuario
 */
router.get('/conversations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    let conversationsQuery;

    if (user.canAccessAll) {
      // Superadmin y admin ven todas las conversaciones
      conversationsQuery = db
        .select({
          id: conversations.id,
          chatId: conversations.chatId,
          contactName: conversations.contactName,
          contactPhone: conversations.contactPhone,
          lastMessage: conversations.lastMessage,
          lastMessageTime: conversations.lastMessageTime,
          whatsappAccountId: conversations.whatsappAccountId,
          status: conversations.status,
          unreadCount: conversations.unreadCount
        })
        .from(conversations)
        .orderBy(desc(conversations.lastMessageTime));
    } else {
      // Otros usuarios solo ven conversaciones de sus cuentas asignadas
      if (user.assignedAccountIds.length === 0) {
        return res.json({ success: true, conversations: [] });
      }

      conversationsQuery = db
        .select({
          id: conversations.id,
          chatId: conversations.chatId,
          contactName: conversations.contactName,
          contactPhone: conversations.contactPhone,
          lastMessage: conversations.lastMessage,
          lastMessageTime: conversations.lastMessageTime,
          whatsappAccountId: conversations.whatsappAccountId,
          status: conversations.status,
          unreadCount: conversations.unreadCount
        })
        .from(conversations)
        .where(inArray(conversations.whatsappAccountId, user.assignedAccountIds))
        .orderBy(desc(conversations.lastMessageTime));
    }

    const userConversations = await conversationsQuery;

    res.json({
      success: true,
      conversations: userConversations,
      userInfo: {
        id: user.id,
        username: user.username,
        role: user.role,
        canAccessAll: user.canAccessAll,
        conversationsCount: userConversations.length
      }
    });
  } catch (error) {
    console.error('Error obteniendo conversaciones del usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/isolated/dashboard/stats
 * Estadísticas del dashboard filtradas por usuario
 */
router.get('/dashboard/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    let accountFilter;

    if (user.canAccessAll) {
      // Sin filtro para superadmin y admin
      accountFilter = sql`1=1`;
    } else {
      if (user.assignedAccountIds.length === 0) {
        return res.json({
          success: true,
          stats: {
            totalLeads: 0,
            totalConversations: 0,
            totalAccounts: 0,
            activeConversations: 0
          },
          userInfo: {
            id: user.id,
            username: user.username,
            role: user.role,
            canAccessAll: user.canAccessAll
          }
        });
      }

      accountFilter = inArray(sql.placeholder('accountId'), user.assignedAccountIds);
    }

    // Contar leads
    const [leadsResult] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(leads)
      .where(user.canAccessAll ? sql`1=1` : inArray(leads.whatsappAccountId, user.assignedAccountIds));

    // Contar conversaciones
    const [conversationsResult] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(conversations)
      .where(user.canAccessAll ? sql`1=1` : inArray(conversations.whatsappAccountId, user.assignedAccountIds));

    // Contar cuentas accesibles
    const accountsCount = user.canAccessAll 
      ? (await db.select({ count: sql`count(*)`.mapWith(Number) }).from(whatsappAccounts))[0].count
      : user.assignedAccountIds.length;

    // Conversaciones activas (últimas 24 horas)
    const [activeConversationsResult] = await db
      .select({ count: sql`count(*)`.mapWith(Number) })
      .from(conversations)
      .where(
        and(
          user.canAccessAll ? sql`1=1` : inArray(conversations.whatsappAccountId, user.assignedAccountIds),
          sql`${conversations.lastMessageTime} > NOW() - INTERVAL '24 hours'`
        )
      );

    res.json({
      success: true,
      stats: {
        totalLeads: leadsResult.count || 0,
        totalConversations: conversationsResult.count || 0,
        totalAccounts: accountsCount,
        activeConversations: activeConversationsResult.count || 0
      },
      userInfo: {
        id: user.id,
        username: user.username,
        role: user.role,
        canAccessAll: user.canAccessAll,
        assignedAccountsCount: user.assignedAccountIds.length
      }
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas del usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/isolated/profile
 * Información del perfil del usuario actual
 */
router.get('/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;

    // Obtener información adicional del usuario
    const [userDetails] = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        status: users.status,
        organizationId: users.organizationId,
        permissions: users.permissions,
        department: users.department,
        createdAt: users.createdAt
      })
      .from(users)
      .where(eq(users.id, user.id));

    // Obtener asignaciones detalladas
    const assignments = await db
      .select({
        whatsappAccountId: userAccountAssignments.whatsappAccountId,
        role: userAccountAssignments.role,
        permissions: userAccountAssignments.permissions,
        assignedAt: userAccountAssignments.assignedAt,
        accountName: whatsappAccounts.name
      })
      .from(userAccountAssignments)
      .leftJoin(whatsappAccounts, eq(userAccountAssignments.whatsappAccountId, whatsappAccounts.id))
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
        assignments,
        accessLevel: {
          canAccessAll: user.canAccessAll,
          assignedAccountsCount: user.assignedAccountIds.length,
          totalPermissions: user.permissions.length
        }
      }
    });
  } catch (error) {
    console.error('Error obteniendo perfil del usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/isolated/users (Solo para admin/superadmin)
 * Lista de usuarios con sus asignaciones - solo para administradores
 */
router.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;

    if (!user.canAccessAll) {
      return res.status(403).json({ error: 'Sin permisos para ver usuarios' });
    }

    // Obtener todos los usuarios con sus asignaciones
    const allUsers = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        status: users.status,
        organizationId: users.organizationId,
        department: users.department,
        createdAt: users.createdAt
      })
      .from(users)
      .orderBy(asc(users.username));

    // Obtener asignaciones para cada usuario
    const usersWithAssignments = await Promise.all(
      allUsers.map(async (userData) => {
        const assignments = await db
          .select({
            accountId: userAccountAssignments.whatsappAccountId,
            accountName: whatsappAccounts.name,
            role: userAccountAssignments.role
          })
          .from(userAccountAssignments)
          .leftJoin(whatsappAccounts, eq(userAccountAssignments.whatsappAccountId, whatsappAccounts.id))
          .where(
            and(
              eq(userAccountAssignments.userId, userData.id),
              eq(userAccountAssignments.isActive, true)
            )
          );

        return {
          ...userData,
          assignments
        };
      })
    );

    res.json({
      success: true,
      users: usersWithAssignments,
      adminInfo: {
        requestedBy: user.username,
        totalUsers: usersWithAssignments.length
      }
    });
  } catch (error) {
    console.error('Error obteniendo lista de usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;