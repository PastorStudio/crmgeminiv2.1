/**
 * Rutas para manejar configuración de respuestas automáticas por cuenta
 */
import { Request, Response } from 'express';
import { db } from '../db';
import { whatsappAccounts, externalAgents } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { agentConfigManager } from '../services/agentConfigManager';

/**
 * Obtener configuración de respuestas automáticas para una cuenta
 */
export async function getAutoResponseConfig(req: Request, res: Response) {
  try {
    const accountId = parseInt(req.params.accountId);
    
    if (isNaN(accountId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de cuenta inválido'
      });
    }

    const config = await agentConfigManager.getAgentConfig(accountId);
    
    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Configuración no encontrada'
      });
    }

    res.json({
      success: true,
      config: {
        enabled: config.enabled,
        assignedAgentId: config.agentId
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo configuración de respuestas automáticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}

/**
 * Actualizar configuración de respuestas automáticas para una cuenta
 */
export async function updateAutoResponseConfig(req: Request, res: Response) {
  try {
    const accountId = parseInt(req.params.accountId);
    const { enabled, assignedAgentId } = req.body;

    console.log('🔄 UPDATE AUTO RESPONSE CONFIG:', { accountId, enabled, assignedAgentId, body: req.body });

    if (isNaN(accountId)) {
      console.log('❌ Account ID inválido:', req.params.accountId);
      return res.status(400).json({
        success: false,
        error: 'ID de cuenta inválido'
      });
    }

    // Si solo se está cambiando enabled (toggle AI), usar toggleAI
    if (enabled !== undefined && assignedAgentId === undefined) {
      const success = await agentConfigManager.toggleAI(accountId, enabled);
      
      if (!success) {
        return res.status(500).json({
          success: false,
          error: 'Error activando/desactivando AI'
        });
      }
    }
    // Si se está asignando un agente específico
    else if (assignedAgentId !== undefined) {
      const config = {
        accountId,
        agentId: assignedAgentId,
        enabled: enabled || false
      };
      
      const success = await agentConfigManager.setAgentConfig(config);
      
      if (!success) {
        return res.status(500).json({
          success: false,
          error: 'Error configurando agente'
        });
      }
    }

    // Obtener configuración actualizada
    const updatedConfig = await agentConfigManager.getAgentConfig(accountId);
    
    if (!updatedConfig) {
      return res.status(404).json({
        success: false,
        error: 'Configuración no encontrada'
      });
    }

    return res.json({
      success: true,
      config: {
        enabled: updatedConfig.enabled,
        assignedAgentId: updatedConfig.agentId
      }
    });

  } catch (error) {
    console.error('❌ Error actualizando configuración de respuestas automáticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}

/**
 * Obtener todas las configuraciones de respuestas automáticas
 */
export async function getAllAutoResponseConfigs(req: Request, res: Response) {
  try {
    const accounts = await db
      .select()
      .from(whatsappAccounts);

    res.json({
      success: true,
      configs: accounts.map(account => ({
        accountId: account.id,
        enabled: account.autoResponseEnabled || false,
        assignedAgentId: account.assignedExternalAgentId || null
      }))
    });

  } catch (error) {
    console.error('❌ Error obteniendo todas las configuraciones:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}