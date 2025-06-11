/**
 * API Routes para Gestión de Intervenciones Manuales
 * Endpoints seguros con aislamiento total por usuario
 */

import { Router, Request, Response } from 'express';
import { interventionManager } from '../services/interventionManager';
import jwt from 'jsonwebtoken';

const router = Router();

/**
 * Middleware para extraer y validar usuario desde JWT
 */
function extractUserFromToken(req: Request): number | null {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    return decoded.userId || decoded.id || null;
  } catch (error) {
    return null;
  }
}

/**
 * Obtener intervenciones activas del usuario autenticado
 */
router.get('/active', async (req: Request, res: Response) => {
  try {
    const userId = extractUserFromToken(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticación requerido'
      });
    }

    const interventions = await interventionManager.getUserActiveInterventions(userId);
    
    res.json({
      success: true,
      interventions: interventions.map(intervention => ({
        id: intervention.id,
        accountId: intervention.accountId,
        chatId: intervention.chatId,
        interventionAt: intervention.interventionAt,
        pauseUntil: intervention.pauseUntil,
        remainingMinutes: Math.ceil((intervention.pauseUntil.getTime() - new Date().getTime()) / (1000 * 60))
      }))
    });

  } catch (error) {
    console.error('❌ Error obteniendo intervenciones activas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * Verificar si un chat específico tiene intervención activa
 */
router.get('/check/:accountId/:chatId', async (req: Request, res: Response) => {
  try {
    const userId = extractUserFromToken(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticación requerido'
      });
    }

    const { accountId, chatId } = req.params;
    const accountIdNum = parseInt(accountId);

    if (isNaN(accountIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'ID de cuenta inválido'
      });
    }

    const isActive = await interventionManager.isInterventionActive(userId, accountIdNum, chatId);
    const interventionInfo = isActive ? 
      await interventionManager.getInterventionInfo(userId, accountIdNum, chatId) : null;

    res.json({
      success: true,
      isActive,
      intervention: interventionInfo ? {
        id: interventionInfo.id,
        interventionAt: interventionInfo.interventionAt,
        pauseUntil: interventionInfo.pauseUntil,
        remainingMinutes: Math.ceil((interventionInfo.pauseUntil.getTime() - new Date().getTime()) / (1000 * 60))
      } : null
    });

  } catch (error) {
    console.error('❌ Error verificando intervención:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * Registrar intervención manual para un chat específico
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const userId = extractUserFromToken(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticación requerido'
      });
    }

    const { accountId, chatId } = req.body;

    if (!accountId || !chatId) {
      return res.status(400).json({
        success: false,
        message: 'accountId y chatId son requeridos'
      });
    }

    const success = await interventionManager.registerIntervention({
      userId,
      accountId: parseInt(accountId),
      chatId,
      fromMe: true,
      timestamp: new Date()
    });

    if (success) {
      res.json({
        success: true,
        message: 'Intervención registrada exitosamente',
        pauseMinutes: 30
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'No se pudo registrar la intervención'
      });
    }

  } catch (error) {
    console.error('❌ Error registrando intervención:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * Finalizar intervención manualmente
 */
router.post('/end', async (req: Request, res: Response) => {
  try {
    const userId = extractUserFromToken(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticación requerido'
      });
    }

    const { accountId, chatId } = req.body;

    if (!accountId || !chatId) {
      return res.status(400).json({
        success: false,
        message: 'accountId y chatId son requeridos'
      });
    }

    const success = await interventionManager.endIntervention(userId, parseInt(accountId), chatId);

    if (success) {
      res.json({
        success: true,
        message: 'Intervención finalizada exitosamente'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'No se encontró intervención activa para finalizar'
      });
    }

  } catch (error) {
    console.error('❌ Error finalizando intervención:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

/**
 * Obtener estadísticas de intervenciones del usuario
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = extractUserFromToken(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Token de autenticación requerido'
      });
    }

    const activeInterventions = await interventionManager.getUserActiveInterventions(userId);
    
    res.json({
      success: true,
      stats: {
        activeCount: activeInterventions.length,
        totalPausedChats: activeInterventions.length,
        accountsWithInterventions: [...new Set(activeInterventions.map(i => i.accountId))].length
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas de intervenciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

export default router;