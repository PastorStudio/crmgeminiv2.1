/**
 * API endpoints para recuperación de cuentas WhatsApp
 */

import express from 'express';
import { WhatsAppRecoveryManager } from '../services/whatsappRecoveryManager';

const router = express.Router();

/**
 * Ejecutar recuperación limpia para una cuenta
 */
router.post('/recover/:accountId', async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId);
    
    if (isNaN(accountId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de cuenta inválido'
      });
    }
    
    console.log(`🔧 Solicitud de recuperación para cuenta ${accountId}`);
    
    const success = await WhatsAppRecoveryManager.performCleanRecovery(accountId);
    
    if (success) {
      res.json({
        success: true,
        message: `Recuperación exitosa para cuenta ${accountId}`,
        accountId
      });
    } else {
      res.status(500).json({
        success: false,
        error: `Falló la recuperación para cuenta ${accountId}`
      });
    }
    
  } catch (error) {
    console.error('Error en endpoint de recuperación:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

/**
 * Obtener estado de recuperación de una cuenta
 */
router.get('/status/:accountId', async (req, res) => {
  try {
    const accountId = parseInt(req.params.accountId);
    
    if (isNaN(accountId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de cuenta inválido'
      });
    }
    
    const status = WhatsAppRecoveryManager.getRecoveryStatus(accountId);
    
    res.json({
      success: true,
      accountId,
      recoveryStatus: status
    });
    
  } catch (error) {
    console.error('Error obteniendo estado de recuperación:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

export { router as whatsappRecoveryRouter };