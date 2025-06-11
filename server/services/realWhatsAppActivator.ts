/**
 * Real WhatsApp Activator Service
 * Forces authentic WhatsApp connections for real data
 */

import { whatsappMultiAccountManager } from './whatsappMultiAccountManager';

export class RealWhatsAppActivator {
  static async activateRealConnections(): Promise<void> {
    console.log('🔄 Activating real WhatsApp connections...');

    try {
      // Get first available account dynamically
      const { storage } = await import('../storage');
      const accounts = await storage.getAllWhatsappAccounts();

      if (accounts.length === 0) {
        console.log('⚠️ No WhatsApp accounts found in database');
        return;
      }

      console.log(`📱 Found ${accounts.length} WhatsApp accounts in database`);

      // Initialize only the first account to avoid overload
      const firstAccount = accounts[0];
      try {
        console.log(`🔄 Inicializando cuenta ${firstAccount.id} (${firstAccount.name})...`);
        
        // Check if account is already initialized
        const instance = whatsappMultiAccountManager.getInstance(firstAccount.id);
        if (instance && instance.status.initialized) {
          console.log(`✅ Account ${firstAccount.id} already initialized`);
          return;
        }
        
        const success = await whatsappMultiAccountManager.initializeAccount(firstAccount.id);

        if (success) {
          console.log(`✅ WhatsApp account ${firstAccount.id} initialized for real data`);

          // Wait a moment before forcing QR
          await new Promise(resolve => setTimeout(resolve, 3000));

          // Activate persistent connection
          whatsappMultiAccountManager.activateKeepAlive(firstAccount.id);
          console.log('✅ Persistent connection activated');
        } else {
          console.log(`⚠️ Failed to initialize WhatsApp account ${firstAccount.id}`);
        }
      } catch (accountError) {
        console.error(`❌ Error procesando cuenta ${firstAccount.id}:`, accountError);
      }

      console.log('🚀 Real WhatsApp system activated with existing accounts');
      console.log('📱 WhatsApp requiere autenticación - escanear código QR para datos reales');
      
    } catch (error) {
      console.error('❌ Error activating real WhatsApp connections:', error);
    }
  }

  static async checkAuthenticationStatus(): Promise<any> {
    // Get first available account dynamically
    const { storage } = await import('../storage');
    const accounts = await storage.getAllWhatsappAccounts();

    if (accounts.length === 0) {
      return {
        authenticated: false,
        ready: false,
        initialized: false,
        hasClient: false,
        message: 'No WhatsApp accounts available'
      };
    }

    const instance = whatsappMultiAccountManager.getInstance(accounts[0].id);

    if (instance) {
      return {
        authenticated: instance.status.authenticated,
        ready: instance.status.ready,
        initialized: instance.status.initialized,
        hasClient: !!instance.client
      };
    }

    return {
      authenticated: false,
      ready: false,
      initialized: false,
      hasClient: false
    };
  }
}

// Auto-activate real connections on server start
RealWhatsAppActivator.activateRealConnections();