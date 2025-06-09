import { apiRequest } from '@/lib/queryClient';

export interface SubscriptionStatus {
  hasActivePlan: boolean;
  planName?: string;
  planFeatures?: string[];
  maxWhatsappAccounts?: number;
  maxUsers?: number;
  maxChatsPerMonth?: number;
  expiresAt?: string;
  daysRemaining?: number;
}

export interface SubscriptionPlan {
  id: number;
  name: string;
  description: string;
  price: number;
  currency: string;
  duration_days: number;
  features: string[];
  max_users: number;
  max_whatsapp_accounts: number;
  max_chats_per_month: number;
  is_active: boolean;
}

export class SubscriptionService {
  private static instance: SubscriptionService;
  private subscriptionStatus: SubscriptionStatus | null = null;

  static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  async getSubscriptionStatus(userId?: number): Promise<SubscriptionStatus> {
    // SUBSCRIPTION RESTRICTIONS DISABLED - RETURN FULL ACCESS
    this.subscriptionStatus = {
      hasActivePlan: true,
      planName: "Plan Enterprise",
      planFeatures: ["Acceso completo", "Sin restricciones"],
      maxWhatsappAccounts: 999,
      maxUsers: 999,
      maxChatsPerMonth: 999999
    };
    return this.subscriptionStatus;
  }

  async getAllPlans(): Promise<SubscriptionPlan[]> {
    try {
      const response = await fetch('/api/subscription-plans', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-user-id': '3', // Authenticated user ID
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const text = await response.text();
      if (!text.trim()) {
        return [];
      }
      
      try {
        const data = JSON.parse(text);
        return data.success ? data.plans : [];
      } catch (parseError) {
        console.error('JSON parsing error for subscription plans:', parseError, 'Response:', text);
        return [];
      }
    } catch (error) {
      console.error('Error getting subscription plans:', error);
      return [];
    }
  }

  async createPlan(planData: Omit<SubscriptionPlan, 'id'>): Promise<SubscriptionPlan | null> {
    try {
      const response = await fetch('/api/subscription-plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-user-id': '3',
        },
        body: JSON.stringify({
          name: planData.name,
          description: planData.description,
          price: planData.price,
          currency: planData.currency,
          duration_days: planData.duration_days,
          features: planData.features,
          max_users: planData.max_users,
          max_whatsapp_accounts: planData.max_whatsapp_accounts,
          max_chats_per_month: planData.max_chats_per_month,
          is_active: planData.is_active
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      
      if (data.success) {
        this.clearCache();
        return data.plan;
      }
      throw new Error(data.message);
    } catch (error) {
      console.error('Error creating subscription plan:', error);
      throw error;
    }
  }

  async assignPlanToUser(userId: number, planId: number, durationDays?: number, notes?: string): Promise<boolean> {
    try {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + (durationDays || 30));

      const response = await fetch('/api/user-subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-user-id': '3',
        },
        body: JSON.stringify({
          user_id: userId,
          plan_id: planId,
          end_date: endDate.toISOString(),
          notes: notes || ''
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Assignment failed:', errorText);
        return false;
      }

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Error assigning plan to user:', error);
      return false;
    }
  }

  hasAccess(feature: string): boolean {
    if (!this.subscriptionStatus?.hasActivePlan) {
      return false;
    }

    const features = this.subscriptionStatus.planFeatures || [];
    return features.some(f => f.toLowerCase().includes(feature.toLowerCase()));
  }

  canAccessWhatsApp(): boolean {
    return this.subscriptionStatus?.hasActivePlan || false;
  }

  canAccessMessaging(): boolean {
    return this.subscriptionStatus?.hasActivePlan || false;
  }

  getMaxWhatsAppAccounts(): number {
    return this.subscriptionStatus?.maxWhatsappAccounts || 0;
  }

  getMaxUsers(): number {
    return this.subscriptionStatus?.maxUsers || 0;
  }

  isExpiringSoon(): boolean {
    return (this.subscriptionStatus?.daysRemaining || 0) <= 7;
  }

  clearCache(): void {
    this.subscriptionStatus = null;
  }
}

export const subscriptionService = SubscriptionService.getInstance();