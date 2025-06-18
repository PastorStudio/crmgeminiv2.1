
/**
 * Rutas unificadas para el manejo de mensajes con respuestas automáticas
 */

import { Router } from 'express';
import { unifiedAutoResponseSystem } from '../services/unifiedAutoResponseSystem';
import { db } from '../db';
import { whatsappMessages, conversations } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * Procesar mensaje entrante
 */
router.post('/process-message', async (req, res) => {
  try {
    const { 
      accountId, 
      chatId, 
      messageContent, 
      fromMe, 
      contactName,
      messageId 
    } = req.body;

    console.log(`📨 Procesando mensaje: ${messageContent} para cuenta ${accountId}`);

    // Verificar si es un mensaje de usuario
    if (!fromMe) {
      // Guardar mensaje en base de datos
      try {
        await db.insert(whatsappMessages).values({
          messageId: messageId || `msg_${Date.now()}`,
          chatId,
          content: messageContent,
          fromMe: false,
          timestamp: new Date(),
          accountId
        });
      } catch (dbError) {
        console.log('⚠️ Error guardando mensaje (puede ya existir):', dbError);
      }

      // Generar respuesta automática
      const autoResponse = await unifiedAutoResponseSystem.processMessage(
        accountId,
        chatId,
        messageContent,
        fromMe,
        contactName
      );

      if (autoResponse) {
        // Guardar respuesta en base de datos
        try {
          await db.insert(whatsappMessages).values({
            messageId: `resp_${Date.now()}`,
            chatId,
            content: autoResponse,
            fromMe: true,
            timestamp: new Date(),
            accountId
          });

          console.log(`✅ Respuesta automática enviada: ${autoResponse}`);
          
          res.json({
            success: true,
            response: autoResponse,
            message: 'Respuesta automática generada'
          });
        } catch (dbError) {
          console.error('❌ Error guardando respuesta:', dbError);
          res.json({
            success: true,
            response: autoResponse,
            message: 'Respuesta generada pero no guardada'
          });
        }
      } else {
        res.json({
          success: true,
          message: 'Mensaje procesado sin respuesta automática'
        });
      }
    } else {
      res.json({
        success: true,
        message: 'Mensaje propio ignorado'
      });
    }
  } catch (error) {
    console.error('❌ Error procesando mensaje:', error);
    res.status(500).json({
      success: false,
      error: 'Error procesando mensaje'
    });
  }
});

/**
 * Activar/desactivar respuestas automáticas
 */
router.post('/toggle-auto-response', async (req, res) => {
  try {
    const { accountId, enabled } = req.body;

    const success = await unifiedAutoResponseSystem.setAutoResponseStatus(
      accountId,
      enabled
    );

    if (success) {
      res.json({
        success: true,
        message: `Respuestas automáticas ${enabled ? 'activadas' : 'desactivadas'}`,
        enabled
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Error cambiando estado de respuestas automáticas'
      });
    }
  } catch (error) {
    console.error('❌ Error cambiando estado:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * Obtener estado de respuestas automáticas
 */
router.get('/auto-response-status/:accountId', async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId);
    const isActive = unifiedAutoResponseSystem.isAutoResponseActive(accountId);

    res.json({
      success: true,
      accountId,
      autoResponseEnabled: isActive
    });
  } catch (error) {
    console.error('❌ Error obteniendo estado:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estado'
    });
  }
});

/**
 * Obtener estadísticas del sistema
 */
router.get('/system-stats', async (req, res) => {
  try {
    const stats = unifiedAutoResponseSystem.getSystemStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estadísticas'
    });
  }
});

export default router;
