import { Request, Response, NextFunction } from 'express';

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
 * SUBSCRIPTION MIDDLEWARE COMPLETELY DISABLED
 * All users have full access to all features
 */
export async function subscriptionAuth(req: Request, res: Response, next: NextFunction) {
  next();
}

export async function getUserSubscriptionStatus(userId: number): Promise<SubscriptionInfo> {
  return {
    hasActivePlan: true,
    planName: "Plan Enterprise",
    planFeatures: ["Acceso completo", "Sin restricciones"],
    maxWhatsappAccounts: 999,
    maxUsers: 999,
    maxChatsPerMonth: 999999
  };
}

export async function whatsappSubscriptionCheck(req: Request, res: Response, next: NextFunction) {
  next();
}