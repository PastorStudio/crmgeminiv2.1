/**
 * Force WhatsApp Authentication Service
 * Establishes real WhatsApp connections for authentic data
 */

import { whatsappMultiAccountManager } from './whatsappMultiAccountManager';

export class ForceWhatsAppAuth {
  static async forceAuthentication(accountId: number): Promise<boolean> {
    try {
      console.log(`🔄 Forcing WhatsApp authentication for account ${accountId}...`);
      
      // Initialize account if not already done
      await whatsappMultiAccountManager.initializeAccount(accountId);
      
      // Force QR generation
      const qrResult = await whatsappMultiAccountManager.forceRefreshQR(accountId);
      
      if (qrResult) {
        console.log(`✅ QR code generated for account ${accountId}`);
        
        // Activate persistent connection
        whatsappMultiAccountManager.activateKeepAlive(accountId);
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`❌ Error forcing authentication for account ${accountId}:`, error);
      return false;
    }
  }
  
  static async checkRealDataAvailability(accountId: number): Promise<any> {
    try {
      const instance = whatsappMultiAccountManager.getInstance(accountId);
      
      if (instance && instance.client && instance.status.authenticated) {
        // Try to get real data
        const chats = await instance.client.getChats();
        return {
          authenticated: true,
          chatsCount: chats.length,
          hasRealData: true
        };
      }
      
      return {
        authenticated: false,
        chatsCount: 0,
        hasRealData: false,
        needsQR: true
      };
    } catch (error) {
      return {
        authenticated: false,
        chatsCount: 0,
        hasRealData: false,
        error: error.message
      };
    }
  }
}