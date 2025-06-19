/**
 * Real WhatsApp Activator Service
 * Forces authentic WhatsApp connections for real data
 */

import { whatsappMultiAccountManager } from './whatsappMultiAccountManager';

export class RealWhatsAppActivator {
  static async activateRealConnections(): Promise<void> {
    console.log('🔄 Activating real WhatsApp connections...');
    
    try {
      // Add timeout to prevent hanging
      const initPromise = whatsappMultiAccountManager.initializeAccount(1);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('WhatsApp initialization timeout')), 60000)
      );
      
      const success = await Promise.race([initPromise, timeoutPromise]);
      
      if (success) {
        console.log('✅ WhatsApp account 1 initialized for real data');
        
        try {
          // Force QR generation for authentication
          await whatsappMultiAccountManager.forceRefreshQR(1);
          console.log('✅ QR code generated for authentication');
          
          // Activate persistent connection
          whatsappMultiAccountManager.activateKeepAlive(1);
          console.log('✅ Persistent connection activated');
          
          // Mark system as ready for real data
          console.log('🚀 Real WhatsApp system activated - ready for authentic data');
        } catch (qrError) {
          console.log('⚠️ QR generation failed, but WhatsApp client is running');
        }
      } else {
        console.log('⚠️ Failed to initialize WhatsApp account 1');
      }
    } catch (error) {
      console.error('❌ Error activating real WhatsApp connections:', error);
      console.log('🔄 App will continue running without WhatsApp connection');
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