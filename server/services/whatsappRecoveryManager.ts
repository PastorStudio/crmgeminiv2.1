/**
 * WhatsApp Recovery Manager
 * Handles clean recovery for blocked WhatsApp accounts
 */

import { whatsappMultiAccountManager } from './whatsappMultiAccountManager';
import { WhatsAppConnectionStabilizer } from './whatsappConnectionStabilizer';
import { storage } from '../storage';

class WhatsAppRecoveryManager {
  /**
   * Ejecuta recuperación limpia para una cuenta bloqueada
   */
  static async performCleanRecovery(accountId: number): Promise<boolean> {
    try {
      console.log(`🔧 Iniciando recuperación limpia para cuenta ${accountId}`);
      
      // Resetear estabilizador
      WhatsAppConnectionStabilizer.reset(accountId);
      console.log(`✅ Estabilizador reseteado para cuenta ${accountId}`);
      
      // Limpiar instancia existente completamente
      const instance = whatsappMultiAccountManager.getInstance(accountId);
      if (instance) {
        try {
          if (instance.client) {
            await instance.client.destroy();
            console.log(`🧹 Cliente anterior destruido para cuenta ${accountId}`);
          }
        } catch (error) {
          console.log(`⚠️ Error limpiando cliente: ${error.message}`);
        }
      }
      
      // Esperar un momento para que se liberen los recursos
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Inicializar cuenta de forma limpia
      console.log(`🆕 Inicializando cuenta ${accountId} de forma limpia...`);
      const success = await whatsappMultiAccountManager.initializeAccount(accountId);
      
      if (success) {
        console.log(`✅ Recuperación exitosa para cuenta ${accountId}`);
        
        // Actualizar estado en base de datos
        await storage.updateWhatsappAccount(accountId, {
          status: 'pending_auth',
          connectionAttempts: 0
        });
        
        return true;
      } else {
        console.error(`❌ Falló la recuperación para cuenta ${accountId}`);
        return false;
      }
      
    } catch (error) {
      console.error(`❌ Error en recuperación limpia para cuenta ${accountId}:`, error);
      return false;
    }
  }
  
  /**
   * Verifica si una cuenta necesita recuperación
   */
  static needsRecovery(accountId: number): boolean {
    const stats = WhatsAppConnectionStabilizer.getStats(accountId);
    return stats && (stats.isBlocked || stats.initializationCount > 5);
  }
  
  /**
   * Obtiene el estado de recuperación de una cuenta
   */
  static getRecoveryStatus(accountId: number): any {
    const stats = WhatsAppConnectionStabilizer.getStats(accountId);
    const instance = whatsappMultiAccountManager.getInstance(accountId);
    
    return {
      needsRecovery: this.needsRecovery(accountId),
      stabilizer: stats,
      instance: instance ? {
        initialized: instance.status.initialized,
        authenticated: instance.status.authenticated,
        ready: instance.status.ready
      } : null
    };
  }
}

export { WhatsAppRecoveryManager };