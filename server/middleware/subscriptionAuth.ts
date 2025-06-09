import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { users, userSubscriptions, subscriptionPlans } from '@shared/schema';
import { eq, and, gte } from 'drizzle-orm';

export interface SubscriptionInfo {
  hasActivePlan: boolean;
  planName?: string;
  planFeatures?: string[];
  maxWhatsappAccounts?: number;
  maxUsers?: number;
  maxChatsPerMonth?: number;
  expiresAt?: Date;
  daysRemaining?: number;
}

export interface AuthenticatedRequestWithSubscription extends Request {
  user: any;
  subscription: SubscriptionInfo;
}

/**
 * Middleware to check subscription status and enforce access control
 * Blocks access to WhatsApp and messaging features when subscription expires
 */
export async function subscriptionAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Get userId from request (from previous auth middleware)
    const userId = req.session?.userId || (req as any).user?.id || req.headers['x-user-id'];
    
    if (!userId) {
      return res.status(401).json({ 
        error: 'No autenticado',
        requiresLogin: true 
      });
    }

    // Get user's active subscription
    const userSubscription = await db
      .select({
        subscription: userSubscriptions,
        plan: subscriptionPlans,
        user: users
      })
      .from(userSubscriptions)
      .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
      .innerJoin(users, eq(userSubscriptions.userId, users.id))
      .where(
        and(
          eq(userSubscriptions.userId, parseInt(userId)),
          eq(userSubscriptions.status, 'active'),
          gte(userSubscriptions.endDate, new Date())
        )
      )
      .orderBy(userSubscriptions.endDate)
      .limit(1);

    const subscriptionInfo: SubscriptionInfo = {
      hasActivePlan: false
    };

    if (userSubscription.length > 0) {
      const { subscription, plan } = userSubscription[0];
      const now = new Date();
      const endDate = new Date(subscription.endDate);
      const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      subscriptionInfo.hasActivePlan = true;
      subscriptionInfo.planName = plan.name;
      subscriptionInfo.planFeatures = Array.isArray(plan.features) ? plan.features : JSON.parse(plan.features || '[]');
      subscriptionInfo.maxWhatsappAccounts = plan.maxWhatsAppAccounts || 1;
      subscriptionInfo.maxUsers = plan.maxUsers || 1;
      subscriptionInfo.maxChatsPerMonth = plan.maxChatsPerMonth || 1000;
      subscriptionInfo.expiresAt = endDate;
      subscriptionInfo.daysRemaining = daysRemaining;
    }

    // Add subscription info to request
    (req as AuthenticatedRequestWithSubscription).subscription = subscriptionInfo;

    // Check if user is admin/superadmin (bypass subscription checks)
    const user = await db.select().from(users).where(eq(users.id, parseInt(userId))).limit(1);
    const userRole = user[0]?.role;
    
    if (userRole === 'admin' || userRole === 'superadmin' || userRole === 'super_admin') {
      return next(); // Admins bypass subscription restrictions
    }

    // Define protected routes that require active subscription
    const protectedRoutes = [
      '/api/whatsapp',
      '/api/chat',
      '/api/messages',
      '/api/direct/whatsapp',
      '/api/integrations/whatsapp',
      '/api/whatsapp-accounts',
      '/api/chat-assignments'
    ];

    const isProtectedRoute = protectedRoutes.some(route => req.path.startsWith(route));

    if (isProtectedRoute && !subscriptionInfo.hasActivePlan) {
      return res.status(403).json({
        error: 'Plan de suscripción requerido',
        message: 'Necesita un plan activo para acceder a las funciones de WhatsApp y mensajería',
        requiresSubscription: true,
        redirectTo: '/subscription-required'
      });
    }

    // Warn if subscription expires soon (less than 7 days)
    if (subscriptionInfo.hasActivePlan && subscriptionInfo.daysRemaining && subscriptionInfo.daysRemaining <= 7) {
      res.header('X-Subscription-Warning', `Su plan expira en ${subscriptionInfo.daysRemaining} días`);
    }

    next();
  } catch (error) {
    console.error('Error en middleware de suscripción:', error);
    res.status(500).json({ error: 'Error verificando suscripción' });
  }
}

/**
 * Get subscription status for a user
 */
export async function getUserSubscriptionStatus(userId: number): Promise<SubscriptionInfo> {
  try {
    const userSubscription = await db
      .select({
        subscription: userSubscriptions,
        plan: subscriptionPlans
      })
      .from(userSubscriptions)
      .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
      .where(
        and(
          eq(userSubscriptions.userId, userId),
          eq(userSubscriptions.status, 'active'),
          gte(userSubscriptions.endDate, new Date())
        )
      )
      .orderBy(userSubscriptions.endDate)
      .limit(1);

    if (userSubscription.length === 0) {
      return { hasActivePlan: false };
    }

    const { subscription, plan } = userSubscription[0];
    const now = new Date();
    const endDate = new Date(subscription.endDate);
    const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      hasActivePlan: true,
      planName: plan.name,
      planFeatures: Array.isArray(plan.features) ? plan.features : JSON.parse(plan.features || '[]'),
      maxWhatsappAccounts: plan.maxWhatsAppAccounts || 1,
      maxUsers: plan.maxUsers || 1,
      maxChatsPerMonth: plan.maxChatsPerMonth || 1000,
      expiresAt: endDate,
      daysRemaining: daysRemaining
    };
  } catch (error) {
    console.error('Error getting subscription status:', error);
    return { hasActivePlan: false };
  }
}

/**
 * Middleware specifically for WhatsApp routes
 */
export async function whatsappSubscriptionCheck(req: Request, res: Response, next: NextFunction) {
  const userId = req.session?.userId || (req as any).user?.id || req.headers['x-user-id'];
  
  if (!userId) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  const user = await db.select().from(users).where(eq(users.id, parseInt(userId))).limit(1);
  const userRole = user[0]?.role;
  
  // Admins bypass subscription checks
  if (userRole === 'admin' || userRole === 'superadmin' || userRole === 'super_admin') {
    return next();
  }

  const subscriptionStatus = await getUserSubscriptionStatus(parseInt(userId));
  
  if (!subscriptionStatus.hasActivePlan) {
    return res.status(403).json({
      error: 'Acceso denegado',
      message: 'Necesita una suscripción activa para acceder a WhatsApp',
      requiresSubscription: true
    });
  }

  next();
}