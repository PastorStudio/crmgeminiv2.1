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
        console.log('⚠️ No WhatsApp accounts found in database, creating default account...');

        // Create a default account if none exists
        const defaultAccount = await storage.createWhatsappAccount({
          name: 'Default Account',
          description: 'Default WhatsApp account',
          userId: 1,
          status: 'inactive'
        });

        console.log('✅ Default WhatsApp account created:', defaultAccount.id);

        // Initialize the new account
        const success = await whatsappMultiAccountManager.initializeAccount(defaultAccount.id);

        if (success) {
          console.log(`✅ WhatsApp account ${defaultAccount.id} initialized for real data`);

          // Force QR generation for authentication
          await whatsappMultiAccountManager.forceRefreshQR(defaultAccount.id);
          console.log('✅ QR code generated for authentication');

          // Activate persistent connection
          whatsappMultiAccountManager.activateKeepAlive(defaultAccount.id);
          console.log('✅ Persistent connection activated');

          console.log('🚀 Real WhatsApp system activated - ready for authentic data');
        } else {
          console.log(`⚠️ Failed to initialize WhatsApp account ${defaultAccount.id}`);
        }
      } else {
        // Use first existing account
        const firstAccount = accounts[0];
        const success = await whatsappMultiAccountManager.initializeAccount(firstAccount.id);

        if (success) {
          console.log(`✅ WhatsApp account ${firstAccount.id} initialized for real data`);

          // Force QR generation for authentication
          await whatsappMultiAccountManager.forceRefreshQR(firstAccount.id);
          console.log('✅ QR code generated for authentication');

          // Activate persistent connection
          whatsappMultiAccountManager.activateKeepAlive(firstAccount.id);
          console.log('✅ Persistent connection activated');

          console.log('🚀 Real WhatsApp system activated with existing accounts');
        } else {
          console.log(`⚠️ Failed to initialize WhatsApp account ${firstAccount.id}`);
        }
      }
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