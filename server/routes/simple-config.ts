/**
 * Sistema simplificado para configuración AI ON/OFF
 */
import { Request, Response } from 'express';
import { db } from '../db';
import { whatsappAccounts } from '../../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Actualizar configuración AI de forma directa
 */
export async function updateSimpleConfig(req: Request, res: Response) {
  try {
    const accountId = parseInt(req.params.accountId);
    const { enabled, assignedAgentId } = req.body;

    console.log('🎯 SISTEMA DIRECTO - Configurando:', {
      accountId,
      enabled,
      assignedAgentId
    });

    // Actualizar directamente en la base de datos
    await db
      .update(whatsappAccounts)
      .set({
        autoResponseEnabled: enabled,
        assignedExternalAgentId: assignedAgentId
      })
      .where(eq(whatsappAccounts.id, accountId));

    console.log(`✅ GUARDADO EXITOSO cuenta ${accountId}: AI=${enabled}, Agente=${assignedAgentId}`);

    // Verificar que se guardó correctamente
    const [result] = await db
      .select({
        enabled: whatsappAccounts.autoResponseEnabled,
        agentId: whatsappAccounts.assignedExternalAgentId
      })
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.id, accountId));

    console.log(`📊 VERIFICACIÓN: ${JSON.stringify(result)}`);

    return res.json({
      success: true,
      config: {
        enabled: result?.enabled || false,
        assignedAgentId: result?.agentId
      }
    });

  } catch (error) {
    console.error('❌ Error sistema directo:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}

/**
 * Obtener configuración actual
 */
export async function getSimpleConfig(req: Request, res: Response) {
  try {
    const accountId = parseInt(req.params.accountId);

    const [result] = await db
      .select({
        enabled: whatsappAccounts.autoResponseEnabled,
        agentId: whatsappAccounts.assignedExternalAgentId
      })
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.id, accountId));

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Cuenta no encontrada'
      });
    }

    return res.json({
      success: true,
      config: {
        enabled: result.enabled || false,
        assignedAgentId: result.agentId
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo configuración:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}