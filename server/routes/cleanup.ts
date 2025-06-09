/**
 * Cleanup routes for system maintenance
 */
import { Router } from 'express';
import { storage } from '../storage';
import { whatsappMultiAccountManager } from '../services/whatsappMultiAccountManager';

const router = Router();

// Delete all WhatsApp accounts - emergency cleanup
router.post('/whatsapp-accounts/delete-all', async (req, res) => {
  try {
    console.log('🗑️ Starting emergency cleanup of all WhatsApp accounts...');
    
    // Get all accounts before deleting
    const allAccounts = await storage.getAllWhatsappAccounts();
    console.log(`Found ${allAccounts.length} accounts to delete`);
    
    // Disconnect all accounts
    for (const account of allAccounts) {
      try {
        await whatsappMultiAccountManager.disconnectAccount(account.id);
        console.log(`✅ Disconnected account ${account.id} (${account.name})`);
      } catch (error) {
        console.error(`⚠️ Error disconnecting account ${account.id}:`, error);
      }
    }
    
    // Delete from database
    await storage.deleteAllWhatsappAccounts();
    console.log('✅ All accounts deleted from database');
    
    res.json({
      success: true,
      message: `Successfully deleted ${allAccounts.length} WhatsApp accounts`,
      deletedAccounts: allAccounts.map(acc => ({ id: acc.id, name: acc.name }))
    });
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete WhatsApp accounts'
    });
  }
});

export default router;