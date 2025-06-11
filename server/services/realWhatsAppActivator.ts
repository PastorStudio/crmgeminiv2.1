/**
 * Real WhatsApp Activator Service
 * Forces authentic WhatsApp connections for real data
 */

import { whatsappMultiAccountManager } from './whatsappMultiAccountManager';

export class RealWhatsAppActivator {
  static async activateRealConnections(): Promise<void> {
    console.log('🔄 Activating real WhatsApp connections...');
    
    try {
      // Get available accounts dynamically instead of hardcoding account 1
      const { storage } = await import('../storage');
      const accounts = await storage.getAllWhatsappAccounts();
      
      if (accounts.length === 0) {
        console.log('📱 No WhatsApp accounts available - system ready for new account creation');
        return;
      }
      
      // Initialize all available accounts
      for (const account of accounts) {
        const success = await whatsappMultiAccountManager.initializeAccount(account.id);
        
        if (success) {
          console.log(`✅ WhatsApp account ${account.id} initialized for real data`);
          
          // Force QR generation for authentication
          await whatsappMultiAccountManager.forceRefreshQR(account.id);
          console.log(`✅ QR code generated for account ${account.id}`);
          
          // Activate persistent connection
          whatsappMultiAccountManager.activateKeepAlive(account.id);
          console.log(`✅ Persistent connection activated for account ${account.id}`);
        } else {
          console.log(`⚠️ Failed to initialize WhatsApp account ${account.id}`);
        }
      }
      
      console.log('🚀 Real WhatsApp system activated with authentic user accounts');
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