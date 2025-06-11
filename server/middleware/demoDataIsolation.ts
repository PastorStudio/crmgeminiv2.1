/**
 * Demo User Data Isolation Middleware
 * Ensures each demo user can only access their own WhatsApp accounts, messages, and data
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { whatsappAccounts, userAccountAssignments, users } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
    isDemo?: boolean;
    demoUserId?: number;
  };
}

/**
 * Middleware to ensure demo users can only access their own data
 */
export const ensureDemoDataIsolation = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Skip isolation for non-demo users
    if (!req.user || req.user.role !== 'demo') {
      return next();
    }

    console.log(`🔒 Aplicando aislamiento de datos para usuario demo: ${req.user.username}`);

    // Get user's assigned WhatsApp accounts
    const userAccounts = await db.select({
      accountId: userAccountAssignments.whatsappAccountId
    })
    .from(userAccountAssignments)
    .where(and(
      eq(userAccountAssignments.userId, req.user.id),
      eq(userAccountAssignments.isActive, true)
    ));

    const assignedAccountIds = userAccounts.map(ua => ua.accountId);

    // Also get accounts directly owned by the user
    const ownedAccounts = await db.select({
      id: whatsappAccounts.id
    })
    .from(whatsappAccounts)
    .where(eq(whatsappAccounts.userId, req.user.id));

    const ownedAccountIds = ownedAccounts.map(acc => acc.id);

    // Combine assigned and owned accounts
    const allowedAccountIds = [...new Set([...assignedAccountIds, ...ownedAccountIds])];

    console.log(`📊 Usuario demo ${req.user.username} tiene acceso a cuentas: [${allowedAccountIds.join(', ')}]`);

    // Store allowed accounts in request for use in route handlers
    req.user.allowedAccountIds = allowedAccountIds;

    // Check if route requires account access validation
    const accountIdFromParams = req.params.accountId ? parseInt(req.params.accountId) : null;
    const accountIdFromBody = req.body?.accountId ? parseInt(req.body.accountId) : null;
    const requestedAccountId = accountIdFromParams || accountIdFromBody;

    if (requestedAccountId) {
      if (!allowedAccountIds.includes(requestedAccountId)) {
        console.log(`❌ Usuario demo ${req.user.username} intentó acceder a cuenta no autorizada: ${requestedAccountId}`);
        return res.status(403).json({
          success: false,
          error: 'Acceso denegado: No tienes permisos para esta cuenta de WhatsApp'
        });
      }
    }

    next();
  } catch (error) {
    console.error('❌ Error en middleware de aislamiento de datos demo:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

/**
 * Filter function to apply data isolation to query results
 */
export const filterDataForDemoUser = (
  data: any[],
  user: AuthenticatedRequest['user'],
  accountIdField: string = 'accountId'
): any[] => {
  if (!user || user.role !== 'demo' || !user.allowedAccountIds) {
    return data;
  }

  return data.filter(item => {
    const itemAccountId = item[accountIdField];
    return user.allowedAccountIds.includes(itemAccountId);
  });
};

/**
 * Create isolated WhatsApp account for demo user
 */
export const createDemoWhatsAppAccount = async (
  userId: number,
  customerName: string
): Promise<any> => {
  try {
    console.log(`🎭 Creando cuenta WhatsApp demo para usuario ID: ${userId}`);

    // Create demo WhatsApp account
    const [demoAccount] = await db.insert(whatsappAccounts).values({
      name: `Demo - ${customerName}`,
      description: `Cuenta demo para ${customerName}`,
      userId: userId,
      status: 'inactive',
      autoResponseEnabled: true,
      responseDelay: 3,
      customPrompt: 'Eres un asistente de atención al cliente profesional y amigable. Responde de manera útil y cordial.',
      targetLanguage: 'es',
      translateToSpanish: true,
      keepAliveEnabled: true,
      createdAt: new Date()
    }).returning();

    // Create user-account assignment
    await db.insert(userAccountAssignments).values({
      userId: userId,
      whatsappAccountId: demoAccount.id,
      role: 'owner',
      isActive: true,
      assignedAt: new Date()
    });

    console.log(`✅ Cuenta demo creada exitosamente: ID ${demoAccount.id} para usuario ${userId}`);

    return demoAccount;
  } catch (error) {
    console.error('❌ Error creando cuenta WhatsApp demo:', error);
    throw new Error('Error al crear cuenta demo');
  }
};

/**
 * Validate demo user access to specific resources
 */
export const validateDemoUserAccess = (
  req: AuthenticatedRequest,
  resourceAccountId: number
): boolean => {
  if (!req.user || req.user.role !== 'demo') {
    return true; // Non-demo users bypass this validation
  }

  if (!req.user.allowedAccountIds) {
    return false;
  }

  return req.user.allowedAccountIds.includes(resourceAccountId);
};

/**
 * Get demo user statistics
 */
export const getDemoUserStats = async (userId: number): Promise<any> => {
  try {
    // Get user's accounts
    const userAccounts = await db.select()
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.userId, userId));

    // Get account assignments
    const assignments = await db.select()
      .from(userAccountAssignments)
      .where(and(
        eq(userAccountAssignments.userId, userId),
        eq(userAccountAssignments.isActive, true)
      ));

    return {
      totalAccounts: userAccounts.length,
      activeAccounts: userAccounts.filter(acc => acc.status === 'active').length,
      assignments: assignments.length,
      lastActivity: userAccounts.reduce((latest, acc) => {
        if (!latest || (acc.lastActivity && acc.lastActivity > latest)) {
          return acc.lastActivity;
        }
        return latest;
      }, null)
    };
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas de usuario demo:', error);
    return {
      totalAccounts: 0,
      activeAccounts: 0,
      assignments: 0,
      lastActivity: null
    };
  }
};

// Type augmentation for Express Request
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        role: string;
        isDemo?: boolean;
        demoUserId?: number;
        allowedAccountIds?: number[];
      };
    }
  }
}