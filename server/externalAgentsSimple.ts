/**
 * Sistema simplificado de agentes externos
 * Para evitar conflictos con el esquema complejo
 */

import { nanoid } from 'nanoid';

// Almacenamiento en memoria para agentes externos (persistente)
let externalAgentsStore: Map<string, any> = new Map();

// Inicializar con datos de ejemplo para debug
const initializeDefaultAgents = () => {
  if (externalAgentsStore.size === 0) {
    console.log('🚀 Inicializando agentes externos por defecto...');
    
    const defaultAgents = [
      {
        id: 'smartbots-001',
        name: 'Smartbots',
        agentUrl: 'https://chatgpt.com/g/g-682ceb8bfa4c81918b3ff66abe6f3480-smartbots',
        isActive: true,
        responseCount: 0,
        createdAt: new Date()
      },
      {
        id: 'smartplanner-001',
        name: 'Smartplanner IA',
        agentUrl: 'https://chatgpt.com/g/g-682e61ce2364819196df9641616414b1-smartplanner-ia',
        isActive: true,
        responseCount: 0,
        createdAt: new Date()
      },
      {
        id: 'smartflyer-001',
        name: 'Smartflyer IA',
        agentUrl: 'https://chatgpt.com/g/g-682f551bee70819196aeb603eb638762-smartflyer-ia',
        isActive: true,
        responseCount: 0,
        createdAt: new Date()
      },
      {
        id: 'telca-001',
        name: 'Agente de Ventas de Telca Panama',
        agentUrl: 'https://chatgpt.com/g/g-682f9b5208988191b08215b3d8f65333-agente-de-ventas-de-telca-panama',
        isActive: true,
        responseCount: 0,
        createdAt: new Date()
      },
      {
        id: 'tecnico-001',
        name: 'Asistente Técnico en Gestión en Campo',
        agentUrl: 'https://chatgpt.com/g/g-682bb98fedf881918e0c4ed5fcf592e4-asistente-tecnico-en-gestion-en-campo',
        isActive: true,
        responseCount: 0,
        createdAt: new Date()
      }
    ];

    defaultAgents.forEach(agent => {
      externalAgentsStore.set(agent.id, agent);
    });

    console.log(`✅ ${defaultAgents.length} agentes externos inicializados`);
  }
};

// Inicializar agentes por defecto al cargar el módulo
initializeDefaultAgents();

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