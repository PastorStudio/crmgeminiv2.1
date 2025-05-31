/**
 * API endpoints para manejo de agentes externos y respuestas automáticas
 */

import { Request, Response } from 'express';
import { SimpleExternalAgentManager, WhatsAppAccountConfigManager } from '../externalAgentsSimple';
import { externalAgentIntegrator } from '../services/externalAgentIntegrator';

/**
 * Habilitar respuesta automática para una cuenta de WhatsApp
 */
export async function enableAutoResponse(req: Request, res: Response) {
  try {
    const { accountId, agentId, delay = 3 } = req.body;

    if (!accountId || !agentId) {
      return res.status(400).json({
        success: false,
        error: 'accountId y agentId son requeridos'
      });
    }

    const success = externalAgentIntegrator.enableAutoResponse(
      parseInt(accountId),
      agentId,
      parseInt(delay)
    );

    if (success) {
      res.json({
        success: true,
        message: 'Respuesta automática habilitada correctamente'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Error habilitando respuesta automática'
      });
    }
  } catch (error) {
    console.error('Error en enableAutoResponse:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}

/**
 * Deshabilitar respuesta automática para una cuenta de WhatsApp
 */
export async function disableAutoResponse(req: Request, res: Response) {
  try {
    const { accountId } = req.body;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'accountId es requerido'
      });
    }

    const success = externalAgentIntegrator.disableAutoResponse(parseInt(accountId));

    if (success) {
      res.json({
        success: true,
        message: 'Respuesta automática deshabilitada correctamente'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Error deshabilitando respuesta automática'
      });
    }
  } catch (error) {
    console.error('Error en disableAutoResponse:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}

/**
 * Obtener configuración de respuesta automática para una cuenta
 */
export async function getAutoResponseConfig(req: Request, res: Response) {
  try {
    const { accountId } = req.params;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'accountId es requerido'
      });
    }

    const config = WhatsAppAccountConfigManager.getAccountConfig(parseInt(accountId));
    
    if (!config) {
      return res.json({
        success: true,
        config: {
          accountId: parseInt(accountId),
          assignedExternalAgentId: null,
          autoResponseEnabled: false,
          responseDelay: 3
        }
      });
    }

    // Obtener información del agente si está asignado
    let agentInfo = null;
    if (config.assignedExternalAgentId) {
      agentInfo = SimpleExternalAgentManager.getAgent(config.assignedExternalAgentId);
    }

    res.json({
      success: true,
      config: {
        ...config,
        agentInfo
      }
    });
  } catch (error) {
    console.error('Error en getAutoResponseConfig:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}

/**
 * Obtener todas las configuraciones de respuesta automática
 */
export async function getAllAutoResponseConfigs(req: Request, res: Response) {
  try {
    const configs = WhatsAppAccountConfigManager.getAllConfigs();
    
    // Enriquecer con información de agentes
    const enrichedConfigs = configs.map(config => {
      let agentInfo = null;
      if (config.assignedExternalAgentId) {
        agentInfo = SimpleExternalAgentManager.getAgent(config.assignedExternalAgentId);
      }
      
      return {
        ...config,
        agentInfo
      };
    });

    res.json({
      success: true,
      configs: enrichedConfigs
    });
  } catch (error) {
    console.error('Error en getAllAutoResponseConfigs:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}

/**
 * Obtener estadísticas del integrador de agentes externos
 */
export async function getIntegratorStats(req: Request, res: Response) {
  try {
    const stats = externalAgentIntegrator.getStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error en getIntegratorStats:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}

/**
 * Probar agente externo con un mensaje de prueba
 */
export async function testExternalAgent(req: Request, res: Response) {
  try {
    const { agentId, testMessage = "Hola, ¿cómo estás?" } = req.body;

    if (!agentId) {
      return res.status(400).json({
        success: false,
        error: 'agentId es requerido'
      });
    }

    const agent = SimpleExternalAgentManager.getAgent(agentId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: 'Agente no encontrado'
      });
    }

    // Simular procesamiento con mensaje de prueba
    // En un entorno real, esto haría una llamada real al agente
    const testResponse = {
      agent: agent.name,
      testMessage,
      response: "Esta es una respuesta de prueba del agente externo. El sistema está funcionando correctamente.",
      timestamp: new Date().toISOString(),
      success: true
    };

    res.json({
      success: true,
      test: testResponse
    });
  } catch (error) {
    console.error('Error en testExternalAgent:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}