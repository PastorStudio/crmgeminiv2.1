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

    console.log(`📊 Configuración para cuenta ${accountId}:`, {
      enabled: account.autoResponseEnabled,
      assignedAgentId: account.assignedExternalAgentId
    });

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

    // Actualizar solo el estado de respuestas automáticas, manteniendo el agente asignado
    const updateData: any = {
      autoResponseEnabled: enabled || false,
      lastActiveAt: new Date()
    };

    // Solo cambiar el agente si se proporciona uno específico
    if (assignedAgentId !== undefined) {
      updateData.assignedExternalAgentId = assignedAgentId;
    }

    const [updatedAccount] = await db
      .update(whatsappAccounts)
      .set(updateData)
      .where(eq(whatsappAccounts.id, accountId))
      .returning();

    if (!updatedAccount) {
      return res.status(404).json({
        success: false,
        error: 'Cuenta no encontrada'
      });
    }

    console.log(`✅ Configuración actualizada para cuenta ${accountId}:`, {
      enabled: updatedAccount.autoResponseEnabled,
      assignedAgentId: updatedAccount.assignedExternalAgentId
    });

    return res.json({
      success: true,
      config: {
        enabled: updatedAccount.autoResponseEnabled,
        assignedAgentId: updatedAccount.assignedExternalAgentId
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