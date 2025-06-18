/**
 * Fixed auto-response toggle endpoint with correct schema references
 */
import { Router } from 'express';
import { db } from '../db';
import { autoResponseConfigs, whatsappAccounts } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Toggle auto-response for an account
router.post('/:accountId/toggle', async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId);
    const { enabled } = req.body;
    
    console.log(`🔄 Toggling auto-response for account ${accountId}: ${enabled}`);
    
    if (isNaN(accountId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID de cuenta inválido' 
      });
    }
    
    // Verify account exists
    const account = await db.select()
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.id, accountId))
      .limit(1);
      
    if (account.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Cuenta no encontrada' 
      });
    }
    
    // Get or create auto-response configuration
    let config = await db.select()
      .from(autoResponseConfigs)
      .where(eq(autoResponseConfigs.accountId, accountId))
      .limit(1);
    
    if (config.length === 0) {
      // Create new configuration
      const newConfig = await db.insert(autoResponseConfigs).values({
        accountId: accountId,
        enabled: enabled,
        aiProvider: 'gemini',
        responseDelay: 3,
        maxResponsesPerDay: 100,
        personalityPrompt: enabled ? 'Responde de manera amigable y profesional a los mensajes de WhatsApp.' : null,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      
      console.log(`✅ New auto-response config created for account ${accountId}: enabled=${enabled}`);
      
      res.json({ 
        success: true, 
        enabled,
        config: newConfig[0],
        message: `Respuestas automáticas ${enabled ? 'activadas' : 'desactivadas'} correctamente`
      });
    } else {
      // Update existing configuration
      const updatedConfig = await db.update(autoResponseConfigs)
        .set({ 
          enabled: enabled,
          updatedAt: new Date()
        })
        .where(eq(autoResponseConfigs.accountId, accountId))
        .returning();
      
      console.log(`✅ Auto-response config updated for account ${accountId}: enabled=${enabled}`);
      
      res.json({ 
        success: true, 
        enabled,
        config: updatedConfig[0],
        message: `Respuestas automáticas ${enabled ? 'activadas' : 'desactivadas'} correctamente`
      });
    }
    
    // Update WhatsApp account auto-response status
    await db.update(whatsappAccounts)
      .set({ 
        autoResponseEnabled: enabled,
        lastActiveAt: new Date()
      })
      .where(eq(whatsappAccounts.id, accountId));
    
    // Activate/deactivate in auto-response system
    try {
      if (enabled) {
        const { stableAutoResponseManager } = await import('../services/stableAutoResponse');
        await stableAutoResponseManager.activateAccount(accountId);
        console.log(`🤖 Auto-response system activated for account ${accountId}`);
      } else {
        const { stableAutoResponseManager } = await import('../services/stableAutoResponse');
        await stableAutoResponseManager.deactivateAccount(accountId);
        console.log(`🔇 Auto-response system deactivated for account ${accountId}`);
      }
    } catch (systemError) {
      console.error('⚠️ Error in auto-response system:', systemError);
      // Don't fail the request for this
    }
    
  } catch (error) {
    console.error('Error toggling auto-response:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// Get auto-response status
router.get('/:accountId/status', async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId);
    
    if (isNaN(accountId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID de cuenta inválido' 
      });
    }
    
    // Get configuration
    const config = await db.select()
      .from(autoResponseConfigs)
      .where(eq(autoResponseConfigs.accountId, accountId))
      .limit(1);
    
    if (config.length === 0) {
      return res.json({ 
        success: true, 
        enabled: false,
        message: 'No hay configuración de respuestas automáticas'
      });
    }
    
    res.json({ 
      success: true, 
      enabled: config[0].enabled,
      config: config[0],
      message: `Estado actual: ${config[0].enabled ? 'activado' : 'desactivado'}`
    });
    
  } catch (error) {
    console.error('Error getting auto-response status:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

export default router;