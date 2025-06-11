/**
 * Real WhatsApp Activator Service
 * Forces authentic WhatsApp connections for real data
 */

import { whatsappMultiAccountManager } from './whatsappMultiAccountManager';

export class RealWhatsAppActivator {
  static async activateRealConnections(): Promise<void> {
    console.log('🔄 Activating real WhatsApp connections...');
    
    try {
      // Get all existing WhatsApp accounts from database
      const { storage } = await import('../storage');
      const accounts = await storage.getAllWhatsappAccounts();
      
      if (accounts.length === 0) {
        console.log('⚠️ No WhatsApp accounts found in database');
        return;
      }
      
      // Initialize each existing account
      for (const account of accounts) {
        try {
          console.log(`🔄 Initializing WhatsApp account ${account.id} (${account.name})`);
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
        } catch (accountError) {
          console.error(`❌ Error initializing account ${account.id}:`, accountError);
        }
      }
      
      console.log(`🚀 Real WhatsApp system activated - ${accounts.length} accounts ready for authentic data`);
    } catch (error) {
      console.error('❌ Error activating real WhatsApp connections:', error);
    }
  }
  
  static async checkAuthenticationStatus(accountId?: number): Promise<any> {
    if (!accountId) {
      // Return status for first available account
      const { storage } = await import('../storage');
      const accounts = await storage.getAllWhatsappAccounts();
      if (accounts.length === 0) {
        return { authenticated: false, ready: false, initialized: false, hasClient: false };
      }
      accountId = accounts[0].id;
    }
    
    const instance = whatsappMultiAccountManager.getInstance(accountId);
    
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