/**
 * API routes for intelligent messaging system
 */

import express from 'express';
import { intelligentAutoResponse } from '../services/intelligentAutoResponse.js';

const router = express.Router();

// Process intelligent message
router.post('/process-message', async (req, res) => {
  try {
    const { accountId, chatId, message, fromNumber } = req.body;
    
    if (!accountId || !chatId || !message || !fromNumber) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const response = await intelligentAutoResponse.processIntelligentMessage(
      parseInt(accountId),
      chatId,
      message,
      fromNumber
    );

    if (response) {
      res.json({
        success: true,
        response: {
          message: response.message,
          confidence: response.confidence || 85,
          needsHumanIntervention: response.needsHumanIntervention || false
        }
      });
    } else {
      res.json({
        success: false,
        error: 'Could not generate response'
      });
    }
  } catch (error) {
    console.error('Error in intelligent message processing:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;

const router = express.Router();

// Procesar mensaje manualmente para pruebas
router.post('/process-message', async (req, res) => {
  try {
    const { accountId, chatId, message, fromNumber } = req.body;

    if (!accountId || !chatId || !message || !fromNumber) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: accountId, chatId, message, fromNumber'
      });
    }

    console.log(`📨 Procesando mensaje manual: "${message}" desde ${fromNumber}`);

    const response = await intelligentAutoResponse.processIncomingMessage(
      accountId,
      chatId,
      message,
      fromNumber
    );

    if (response) {
      // Enviar respuesta
      const sent = await intelligentAutoResponse.sendResponse(accountId, chatId, response.message);
      
      res.json({
        success: true,
        response: {
          message: response.message,
          confidence: response.confidence,
          nextState: response.nextState,
          sent: sent,
          needsHumanIntervention: response.needsHumanIntervention
        }
      });
    } else {
      res.json({
        success: true,
        response: null,
        message: 'No se generó respuesta automática'
      });
    }
  } catch (error) {
    console.error('Error procesando mensaje:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Obtener estadísticas del sistema
router.get('/system-stats', async (req, res) => {
  try {
    const stats = messageSystemActivator.getSystemStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Probar sistema con casos predefinidos
router.post('/test-system', async (req, res) => {
  try {
    const { accountId = 1 } = req.body;
    
    console.log(`🧪 Iniciando prueba del sistema para cuenta ${accountId}`);
    
    const testMessages = [
      'Hola, buenos días',
      'Necesito información sobre sus servicios',
      'Gracias por la atención, hasta luego'
    ];

    const results = [];

    for (const message of testMessages) {
      const response = await intelligentAutoResponse.processIncomingMessage(
        accountId,
        `test_${Date.now()}`,
        message,
        '+1234567890'
      );

      results.push({
        input: message,
        response: response ? response.message : 'Sin respuesta',
        confidence: response ? response.confidence : 0,
        state: response ? response.nextState : 'none'
      });
    }

    res.json({
      success: true,
      testResults: results,
      message: 'Pruebas completadas exitosamente'
    });

  } catch (error) {
    console.error('Error en prueba del sistema:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Webhook para recibir mensajes de WhatsApp en tiempo real
router.post('/webhook/whatsapp', async (req, res) => {
  try {
    const { accountId, messageData } = req.body;

    if (!accountId || !messageData) {
      return res.status(400).json({
        success: false,
        error: 'Missing accountId or messageData'
      });
    }

    // Procesar mensaje en tiempo real
    await realTimeMessageProcessor.processWhatsAppMessage(
      accountId,
      messageData.chatId || messageData.from,
      messageData
    );

    res.json({
      success: true,
      message: 'Mensaje procesado correctamente'
    });

  } catch (error) {
    console.error('Error en webhook:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;