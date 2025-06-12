/**
 * Automatic Demo Cleanup Service
 * Monitors and disables demo users exactly 3 days after creation
 */

import { demoUserManager } from "./demoUserManager";
import { db } from '../db';
import { demoUsers, users } from '@shared/schema';
import { eq, lt, and } from 'drizzle-orm';

class AutomaticDemoCleanup {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start automatic cleanup service
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️ Servicio de limpieza automática ya está ejecutándose');
      return;
    }

    console.log('🔄 Iniciando servicio de limpieza automática de demos...');
    
    // Execute immediate cleanup
    this.performCleanup();
    
    // Schedule cleanup every hour
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 60 * 60 * 1000); // 1 hour

    this.isRunning = true;
    console.log('✅ Servicio de limpieza automática iniciado - ejecutándose cada hora');
  }

  /**
   * Stop automatic cleanup service
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 Servicio de limpieza automática detenido');
  }

  /**
   * Perform cleanup of expired demo users
   */
  private async performCleanup(): Promise<void> {
    try {
      console.log('🧹 Ejecutando limpieza automática de demos expirados...');
      
      const now = new Date();
      console.log(`🕐 Hora actual: ${now.toISOString()}`);

      // Find expired demo users (older than 3 days)
      const expiredDemos = await db.select()
        .from(demoUsers)
        .where(
          and(
            eq(demoUsers.status, 'active'),
            lt(demoUsers.expiresAt, now)
          )
        );

      console.log(`🔍 Encontrados ${expiredDemos.length} demos expirados`);

      let cleanedCount = 0;

      for (const expiredDemo of expiredDemos) {
        const expirationTime = new Date(expiredDemo.expiresAt);
        const hoursDiff = (now.getTime() - expirationTime.getTime()) / (1000 * 60 * 60);
        
        console.log(`⏰ Demo "${expiredDemo.customerName}" expiró hace ${hoursDiff.toFixed(1)} horas`);
        
        try {
          // Disable demo user
          await db.update(demoUsers)
            .set({ 
              status: 'expired',
              updatedAt: new Date()
            })
            .where(eq(demoUsers.id, expiredDemo.id));

          // Disable real user account
          await db.update(users)
            .set({ 
              isActive: false,
              updatedAt: new Date()
            })
            .where(eq(users.username, expiredDemo.username));

          console.log(`✅ Demo usuario "${expiredDemo.customerName}" (${expiredDemo.username}) deshabilitado automáticamente`);
          cleanedCount++;

        } catch (error) {
          console.error(`❌ Error deshabilitando demo ${expiredDemo.id}:`, error);
        }
      }

      if (cleanedCount > 0) {
        console.log(`🎯 Limpieza completada: ${cleanedCount} demos deshabilitados automáticamente`);
      } else {
        console.log('✨ No hay demos expirados para limpiar');
      }

      // Log statistics
      await this.logCleanupStats();

    } catch (error) {
      console.error('❌ Error en limpieza automática:', error);
    }
  }

  /**
   * Log cleanup statistics
   */
  private async logCleanupStats(): Promise<void> {
    try {
      const stats = await demoUserManager.getDemoUserStats();
      console.log(`📊 Estadísticas de demos: Total: ${stats.total}, Activos: ${stats.active}, Expirados: ${stats.expired}`);
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
    }
  }

  /**
   * Force cleanup of all expired demos (manual trigger)
   */
  async forceCleanup(): Promise<number> {
    console.log('🔧 Ejecutando limpieza forzada de demos...');
    await this.performCleanup();
    
    const stats = await demoUserManager.getDemoUserStats();
    return stats.expired;
  }

  /**
   * Get service status
   */
  getStatus(): any {
    return {
      isRunning: this.isRunning,
      hasInterval: this.cleanupInterval !== null,
      startTime: this.isRunning ? new Date().toISOString() : null
    };
  }

  /**
   * Check specific demo expiration
   */
  async checkDemoExpiration(demoId: number): Promise<any> {
    try {
      const [demo] = await db.select()
        .from(demoUsers)
        .where(eq(demoUsers.id, demoId))
        .limit(1);

      if (!demo) {
        return { found: false };
      }

      const { isDemoExpired, getDemoRemainingTimeMs, getDemoRemainingTimeHours } = await import('../utils/demoConstants');
      const isExpired = isDemoExpired(demo.expiresAt);
      const timeRemaining = getDemoRemainingTimeMs(demo.expiresAt);
      
      return {
        found: true,
        demo: {
          id: demo.id,
          customerName: demo.customerName,
          username: demo.username,
          status: demo.status,
          createdAt: demo.createdAt,
          expiresAt: demo.expiresAt,
          isExpired,
          timeRemainingMs: timeRemaining,
          timeRemainingHours: getDemoRemainingTimeHours(demo.expiresAt)
        }
      };
    } catch (error) {
      console.error('❌ Error checking demo expiration:', error);
      return { found: false, error: error.message };
    }
  }
}

export const automaticDemoCleanup = new AutomaticDemoCleanup();