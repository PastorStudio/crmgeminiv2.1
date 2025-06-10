import { db } from "../db";
import { leads, whatsappAccounts, users, contacts, whatsappMessages } from "@shared/schema";
import { count, sum, eq, gte, desc, sql } from "drizzle-orm";

/**
 * Service for real dashboard data - no demonstration data
 * Returns actual counts from database tables
 */
export class RealDashboardService {
  
  /**
   * Get actual dashboard metrics from database
   */
  async getDashboardMetrics() {
    try {
      // Get real counts from database
      const [
        totalLeads,
        totalAccounts, 
        totalUsers,
        totalContacts,
        totalMessages
      ] = await Promise.all([
        db.select({ count: count() }).from(leads),
        db.select({ count: count() }).from(whatsappAccounts),
        db.select({ count: count() }).from(users),
        db.select({ count: count() }).from(contacts),
        db.select({ count: count() }).from(whatsappMessages)
      ]);

      // Calculate total lead value
      const leadValues = await db.select({ value: leads.value }).from(leads);
      const totalValue = leadValues.reduce((sum, lead) => {
        const value = parseFloat(lead.value || '0');
        return sum + (isNaN(value) ? 0 : value);
      }, 0);

      // Get leads by status
      const leadsByStatus = await db
        .select({ 
          status: leads.status, 
          count: count() 
        })
        .from(leads)
        .groupBy(leads.status);

      // Get accounts by status
      const accountsByStatus = await db
        .select({ 
          status: whatsappAccounts.status, 
          count: count() 
        })
        .from(whatsappAccounts)
        .groupBy(whatsappAccounts.status);

      // Get recent activity (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const recentLeads = await db
        .select({ count: count() })
        .from(leads)
        .where(gte(leads.createdAt, yesterday));

      const recentMessages = await db
        .select({ count: count() })
        .from(whatsappMessages)
        .where(gte(whatsappMessages.createdAt, yesterday));

      return {
        success: true,
        data: {
          totals: {
            leads: totalLeads[0]?.count || 0,
            accounts: totalAccounts[0]?.count || 0,
            users: totalUsers[0]?.count || 0,
            contacts: totalContacts[0]?.count || 0,
            messages: totalMessages[0]?.count || 0,
            revenue: totalValue
          },
          breakdown: {
            leadsByStatus: leadsByStatus.map(item => ({
              status: item.status,
              count: item.count
            })),
            accountsByStatus: accountsByStatus.map(item => ({
              status: item.status,
              count: item.count
            }))
          },
          activity: {
            newLeadsToday: recentLeads[0]?.count || 0,
            messagesLast24h: recentMessages[0]?.count || 0
          }
        }
      };
    } catch (error) {
      console.error('Error getting real dashboard metrics:', error);
      return {
        success: false,
        error: 'Failed to fetch dashboard metrics'
      };
    }
  }

  /**
   * Get real-time system status
   */
  async getSystemStatus() {
    try {
      // Get connected accounts
      const connectedAccounts = await db
        .select({ count: count() })
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.status, 'connected'));

      // Get active users  
      const activeUsers = await db
        .select({ count: count() })
        .from(users)
        .where(eq(users.status, 'active'));

      return {
        success: true,
        data: {
          connectedAccounts: connectedAccounts[0]?.count || 0,
          activeUsers: activeUsers[0]?.count || 0,
          systemStatus: 'operational',
          lastUpdate: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error getting system status:', error);
      return {
        success: false,
        error: 'Failed to fetch system status'
      };
    }
  }
}

export const realDashboardService = new RealDashboardService();