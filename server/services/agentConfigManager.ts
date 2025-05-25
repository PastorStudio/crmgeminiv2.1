/**
 * Gestor de configuración de agentes externos
 * Maneja la asignación, activación y configuración de agentes por cuenta
 */
import { db } from '../db';
import { whatsappAccounts, externalAgents } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export interface AgentConfig {
  accountId: number;
  agentId: string | null;
  enabled: boolean;
  responseDelay?: number;
  maxResponsesPerDay?: number;
}

export class AgentConfigManager {
  /**
   * Obtener configuración actual de un agente para una cuenta
   */
  async getAgentConfig(accountId: number): Promise<AgentConfig | null> {
    try {
      console.log(`📋 Obteniendo configuración para cuenta ${accountId}`);
      
      const [account] = await db
        .select({
          id: whatsappAccounts.id,
          autoResponseEnabled: whatsappAccounts.autoResponseEnabled,
          assignedExternalAgentId: whatsappAccounts.assignedExternalAgentId
        })
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.id, accountId));

      if (!account) {
        console.log(`❌ Cuenta ${accountId} no encontrada`);
        return null;
      }

      const config: AgentConfig = {
        accountId: account.id,
        agentId: account.assignedExternalAgentId,
        enabled: account.autoResponseEnabled || false,
        responseDelay: 3,
        maxResponsesPerDay: 100
      };

      console.log(`✅ Configuración obtenida:`, config);
      return config;
    } catch (error) {
      console.error(`❌ Error obteniendo configuración para cuenta ${accountId}:`, error);
      return null;
    }
  }

  /**
   * Configurar agente para una cuenta
   */
  async setAgentConfig(config: AgentConfig): Promise<boolean> {
    try {
      console.log(`🔧 Configurando agente para cuenta ${config.accountId}:`, config);

      // Verificar que el agente existe si se está asignando
      if (config.agentId) {
        const [agent] = await db
          .select()
          .from(externalAgents)
          .where(eq(externalAgents.id, config.agentId));

        if (!agent) {
          console.log(`❌ Agente ${config.agentId} no encontrado`);
          return false;
        }
      }

      // Actualizar configuración en la cuenta
      const [updatedAccount] = await db
        .update(whatsappAccounts)
        .set({
          autoResponseEnabled: config.enabled,
          assignedExternalAgentId: config.agentId,
          lastActiveAt: new Date()
        })
        .where(eq(whatsappAccounts.id, config.accountId))
        .returning();

      if (!updatedAccount) {
        console.log(`❌ No se pudo actualizar cuenta ${config.accountId}`);
        return false;
      }

      console.log(`✅ Configuración actualizada exitosamente para cuenta ${config.accountId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error configurando agente para cuenta ${config.accountId}:`, error);
      return false;
    }
  }

  /**
   * Activar/desactivar AI para una cuenta (mantiene el agente asignado)
   */
  async toggleAI(accountId: number, enabled: boolean): Promise<boolean> {
    try {
      console.log(`🔄 Toggle AI para cuenta ${accountId}: ${enabled ? 'ACTIVAR' : 'DESACTIVAR'}`);

      const [updatedAccount] = await db
        .update(whatsappAccounts)
        .set({
          autoResponseEnabled: enabled,
          lastActiveAt: new Date()
        })
        .where(eq(whatsappAccounts.id, accountId))
        .returning();

      if (!updatedAccount) {
        console.log(`❌ No se pudo actualizar cuenta ${accountId}`);
        return false;
      }

      console.log(`✅ AI ${enabled ? 'ACTIVADO' : 'DESACTIVADO'} para cuenta ${accountId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error toggle AI para cuenta ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Asignar agente específico a una cuenta
   */
  async assignAgent(accountId: number, agentId: string): Promise<boolean> {
    try {
      console.log(`👤 Asignando agente ${agentId} a cuenta ${accountId}`);

      // Verificar que el agente existe
      const [agent] = await db
        .select()
        .from(externalAgents)
        .where(eq(externalAgents.id, agentId));

      if (!agent) {
        console.log(`❌ Agente ${agentId} no encontrado`);
        return false;
      }

      const [updatedAccount] = await db
        .update(whatsappAccounts)
        .set({
          assignedExternalAgentId: agentId,
          lastActiveAt: new Date()
        })
        .where(eq(whatsappAccounts.id, accountId))
        .returning();

      if (!updatedAccount) {
        console.log(`❌ No se pudo actualizar cuenta ${accountId}`);
        return false;
      }

      console.log(`✅ Agente ${agent.name} asignado a cuenta ${accountId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error asignando agente a cuenta ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Obtener todas las configuraciones de agentes
   */
  async getAllConfigs(): Promise<AgentConfig[]> {
    try {
      console.log(`📊 Obteniendo todas las configuraciones de agentes`);
      
      const accounts = await db
        .select({
          id: whatsappAccounts.id,
          autoResponseEnabled: whatsappAccounts.autoResponseEnabled,
          assignedExternalAgentId: whatsappAccounts.assignedExternalAgentId
        })
        .from(whatsappAccounts);

      const configs: AgentConfig[] = accounts.map(account => ({
        accountId: account.id,
        agentId: account.assignedExternalAgentId,
        enabled: account.autoResponseEnabled || false,
        responseDelay: 3,
        maxResponsesPerDay: 100
      }));

      console.log(`✅ ${configs.length} configuraciones obtenidas`);
      return configs;
    } catch (error) {
      console.error(`❌ Error obteniendo configuraciones:`, error);
      return [];
    }
  }
}

export const agentConfigManager = new AgentConfigManager();