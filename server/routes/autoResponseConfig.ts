/**
 * Rutas para manejar configuración de respuestas automáticas por cuenta
 */
import { Request, Response } from 'express';
import { db } from '../db';
import { whatsappAccounts, externalAgents } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

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

    // Buscar la cuenta de WhatsApp
    const [account] = await db
      .select()
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.id, accountId));

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Cuenta no encontrada'
      });
    }

    res.json({
      success: true,
      config: {
        enabled: account.autoResponseEnabled || false,
        assignedAgentId: account.assignedExternalAgentId || null
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

    if (isNaN(accountId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de cuenta inválido'
      });
    }

    // Validar que el agente existe si se está asignando
    if (assignedAgentId) {
      const [agent] = await db
        .select()
        .from(externalAgents)
        .where(eq(externalAgents.id, assignedAgentId));

      if (!agent) {
        return res.status(400).json({
          success: false,
          error: 'Agente externo no encontrado'
        });
      }
    }

    // Buscar configuración existente
    const [existingConfig] = await db
      .select()
      .from(autoResponseConfig)
      .where(eq(autoResponseConfig.accountId, accountId));

    if (existingConfig) {
      // Actualizar configuración existente
      const [updatedConfig] = await db
        .update(autoResponseConfig)
        .set({
          enabled: enabled || false,
          assignedAgentId: assignedAgentId || null,
          updatedBy: 1, // Usuario por defecto
          updatedAt: new Date()
        })
        .where(eq(autoResponseConfig.accountId, accountId))
        .returning();

      console.log(`✅ Configuración actualizada para cuenta ${accountId}:`, {
        enabled: updatedConfig.enabled,
        assignedAgentId: updatedConfig.assignedAgentId
      });

      return res.json({
        success: true,
        config: {
          enabled: updatedConfig.enabled,
          assignedAgentId: updatedConfig.assignedAgentId
        }
      });
    } else {
      // Crear nueva configuración
      const [newConfig] = await db
        .insert(autoResponseConfig)
        .values({
          accountId,
          enabled: enabled || false,
          assignedAgentId: assignedAgentId || null,
          createdBy: 1,
          updatedBy: 1
        })
        .returning();

      console.log(`✅ Nueva configuración creada para cuenta ${accountId}:`, {
        enabled: newConfig.enabled,
        assignedAgentId: newConfig.assignedAgentId
      });

      return res.json({
        success: true,
        config: {
          enabled: newConfig.enabled,
          assignedAgentId: newConfig.assignedAgentId
        }
      });
    }

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
    const configs = await db
      .select()
      .from(autoResponseConfig);

    res.json({
      success: true,
      configs: configs.map(config => ({
        accountId: config.accountId,
        enabled: config.enabled,
        assignedAgentId: config.assignedAgentId
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