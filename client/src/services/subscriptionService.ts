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
    try {
      const response = await apiRequest<SubscriptionStatus>('/api/subscription-status');
      this.subscriptionStatus = response;
      return response;
    } catch (error) {
      console.error('Error getting subscription status:', error);
      return { hasActivePlan: false };
    }
  }

  async getAllPlans(): Promise<SubscriptionPlan[]> {
    try {
      const response = await fetch('/api/subscription-plans', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
      const data = await response.json();
      return data.success ? data.plans : [];
    } catch (error) {
      console.error('Error getting subscription plans:', error);
      return [];
    }
  }

  async createPlan(planData: Omit<SubscriptionPlan, 'id'>): Promise<SubscriptionPlan | null> {
    try {
      const response = await apiRequest<{ success: boolean; plan: SubscriptionPlan; message: string }>('/api/subscription-plans', {
        method: 'POST',
        body: planData
      });
      
      if (response.success) {
        return response.plan;
      }
      throw new Error(response.message);
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