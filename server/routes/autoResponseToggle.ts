/**
 * Endpoint dedicado para activar/desactivar respuestas automáticas
 */
import { Router } from 'express';
import { db } from '../db';
import { autoResponseConfigs } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { storage } from '../storage';

const router = Router();

// Activar/desactivar respuestas automáticas
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
    
    // Verificar que la cuenta existe
    const account = await storage.getWhatsappAccount(accountId);
    if (!account) {
      return res.status(404).json({ 
        success: false, 
        error: 'Cuenta no encontrada' 
      });
    }
    
    // Obtener o crear configuración de respuesta automática
    let config = await db.select()
      .from(autoResponseConfigs)
      .where(eq(autoResponseConfigs.accountId, accountId))
      .limit(1);
    
    if (config.length === 0) {
      // Crear nueva configuración
      const newConfig = await db.insert(autoResponseConfigs).values({
        accountId: accountId,
        enabled: enabled,
        aiProvider: 'gemini',
        responseDelay: 3000,
        maxResponsesPerDay: 100,
        personalityPrompt: enabled ? 'Responde de manera amigable y profesional a los mensajes de WhatsApp.' : null,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      
      console.log(`✅ Nueva configuración creada para cuenta ${accountId}: enabled=${enabled}`);
      
      res.json({ 
        success: true, 
        enabled,
        config: newConfig[0],
        message: `Respuestas automáticas ${enabled ? 'activadas' : 'desactivadas'} correctamente`
      });
    } else {
      // Actualizar configuración existente
      const updatedConfig = await db.update(autoResponseConfigs)
        .set({ 
          enabled: enabled,
          updatedAt: new Date()
        })
        .where(eq(autoResponseConfigs.accountId, accountId))
        .returning();
      
      console.log(`✅ Configuración actualizada para cuenta ${accountId}: enabled=${enabled}`);
      
      res.json({ 
        success: true, 
        enabled,
        config: updatedConfig[0],
        message: `Respuestas automáticas ${enabled ? 'activadas' : 'desactivadas'} correctamente`
      });
    }
    
    // Activar o desactivar en el sistema de respuestas automáticas
    try {
      if (enabled) {
        const { stableAutoResponseManager } = await import('../services/stableAutoResponse');
        await stableAutoResponseManager.activateAccount(accountId);
        console.log(`🤖 Sistema de respuestas automáticas activado para cuenta ${accountId}`);
      } else {
        const { stableAutoResponseManager } = await import('../services/stableAutoResponse');
        await stableAutoResponseManager.deactivateAccount(accountId);
        console.log(`🔇 Sistema de respuestas automáticas desactivado para cuenta ${accountId}`);
      }
    } catch (systemError) {
      console.error('⚠️ Error en sistema de respuestas automáticas:', systemError);
      // No fallar la request por esto
    }
    
  } catch (error) {
    console.error('Error al activar/desactivar respuestas automáticas:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

// Obtener estado de respuestas automáticas
router.get('/:accountId/status', async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId);
    
    if (isNaN(accountId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID de cuenta inválido' 
      });
    }
    
    // Buscar configuración
    const config = await db.select()
      .from(autoResponseConfigs)
      .where(eq(autoResponseConfigs.accountId, accountId))
      .limit(1);
    
    if (config.length === 0) {
      return res.json({ 
        success: true, 
        enabled: false,
        config: null
      });
    }
    
    res.json({ 
      success: true, 
      enabled: config[0].isEnabled || false,
      config: config[0]
    });
    
  } catch (error) {
    console.error('Error obteniendo estado de respuestas automáticas:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

export default router;