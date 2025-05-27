/**
 * Sistema simplificado de agentes externos
 * Para evitar conflictos con el esquema complejo
 */

import { nanoid } from 'nanoid';

// Almacenamiento en memoria para agentes externos (persistente)
let externalAgentsStore: Map<string, any> = new Map();

export interface SimpleExternalAgent {
  id: string;
  name: string;
  agentUrl: string;
  isActive: boolean;
  responseCount: number;
  createdAt: Date;
}

export class SimpleExternalAgentManager {
  
  // Crear nuevo agente
  static createAgent(agentUrl: string): SimpleExternalAgent {
    const id = nanoid();
    
    // Extraer nombre del URL
    let name = 'Agente Externo';
    try {
      const urlParts = agentUrl.split('/');
      const lastPart = urlParts[urlParts.length - 1];
      if (lastPart && lastPart.includes('-')) {
        // Tomar todo después del último guión
        const namePart = lastPart.split('-').slice(1).join('-');
        name = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      }
    } catch (error) {
      console.log('Error extrayendo nombre:', error);
    }

    const agent: SimpleExternalAgent = {
      id,
      name,
      agentUrl,
      isActive: true,
      responseCount: 0,
      createdAt: new Date()
    };

    externalAgentsStore.set(id, agent);
    console.log(`✅ Agente creado: ${name} (ID: ${id})`);
    
    return agent;
  }

  // Listar todos los agentes
  static getAllAgents(): SimpleExternalAgent[] {
    return Array.from(externalAgentsStore.values());
  }

  // Obtener agente por ID
  static getAgent(id: string): SimpleExternalAgent | undefined {
    return externalAgentsStore.get(id);
  }

  // Eliminar agente
  static deleteAgent(id: string): boolean {
    return externalAgentsStore.delete(id);
  }

  // Actualizar agente
  static updateAgent(id: string, updates: Partial<SimpleExternalAgent>): SimpleExternalAgent | null {
    const agent = externalAgentsStore.get(id);
    if (!agent) return null;

    const updatedAgent = { ...agent, ...updates };
    externalAgentsStore.set(id, updatedAgent);
    return updatedAgent;
  }

  // Limpiar todos los agentes (para testing)
  static clearAll(): void {
    externalAgentsStore.clear();
  }
}

// Almacenamiento para configuración de cuentas WhatsApp
let whatsappAccountConfigs: Map<number, any> = new Map();

export interface WhatsAppAccountConfig {
  accountId: number;
  assignedExternalAgentId: string | null;
  autoResponseEnabled: boolean;
  responseDelay: number;
}

export class WhatsAppAccountConfigManager {
  
  // Asignar agente a cuenta
  static assignAgent(accountId: number, externalAgentId: string | null, autoResponseEnabled: boolean = false): WhatsAppAccountConfig {
    const config: WhatsAppAccountConfig = {
      accountId,
      assignedExternalAgentId: externalAgentId,
      autoResponseEnabled,
      responseDelay: 3
    };

    whatsappAccountConfigs.set(accountId, config);
    console.log(`✅ Configuración guardada para cuenta ${accountId}: Agente ${externalAgentId}, Auto: ${autoResponseEnabled}`);
    
    return config;
  }

  // Obtener configuración de cuenta
  static getAccountConfig(accountId: number): WhatsAppAccountConfig | null {
    return whatsappAccountConfigs.get(accountId) || null;
  }

  // Listar todas las configuraciones
  static getAllConfigs(): WhatsAppAccountConfig[] {
    return Array.from(whatsappAccountConfigs.values());
  }
}