/**
 * Real WhatsApp Activator Service
 * Forces authentic WhatsApp connections for real data
 */

import { whatsappMultiAccountManager } from './whatsappMultiAccountManager';

export class RealWhatsAppActivator {
  static async activateRealConnections(): Promise<void> {
    console.log('🔄 Checking for existing WhatsApp accounts...');
    
    try {
      // Import storage to check for existing accounts
      const { storage } = await import('../storage');
      const existingAccounts = await storage.getAllWhatsappAccounts();
      
      if (existingAccounts.length === 0) {
        console.log('📭 No WhatsApp accounts found - system ready for manual account creation');
        return;
      }
      
      // Only initialize existing accounts from database
      for (const account of existingAccounts) {
        console.log(`🔄 Initializing existing account ${account.id}: ${account.name}`);
        
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
      
      console.log('🚀 Real WhatsApp system activated - ready for authentic data');
    } catch (error) {
      console.error('❌ Error activating real WhatsApp connections:', error);
    }
  }
  
  static async checkAuthenticationStatus(): Promise<any> {
    const instance = whatsappMultiAccountManager.getInstance(1);
    
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