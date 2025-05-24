import { db } from '../db';
import { externalAgents, agentResponses, type ExternalAgent, type InsertExternalAgent, type AgentResponse, type InsertAgentResponse } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export class ExternalAgentService {
  // Crear un nuevo agente externo
  async createAgent(agentData: Omit<InsertExternalAgent, 'id'>): Promise<ExternalAgent> {
    const id = nanoid();
    
    const [agent] = await db.insert(externalAgents).values({
      ...agentData,
      id,
    }).returning();
    
    return agent;
  }

  // Obtener todos los agentes externos
  async getAllAgents(): Promise<ExternalAgent[]> {
    return await db.select().from(externalAgents);
  }

  // Obtener agente por ID
  async getAgentById(id: string): Promise<ExternalAgent | undefined> {
    const [agent] = await db.select().from(externalAgents).where(eq(externalAgents.id, id));
    return agent;
  }

  // Actualizar agente
  async updateAgent(id: string, updates: Partial<ExternalAgent>): Promise<ExternalAgent | undefined> {
    const [agent] = await db.update(externalAgents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(externalAgents.id, id))
      .returning();
    
    return agent;
  }

  // Eliminar agente
  async deleteAgent(id: string): Promise<boolean> {
    const result = await db.delete(externalAgents).where(eq(externalAgents.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Obtener agentes activos
  async getActiveAgents(): Promise<ExternalAgent[]> {
    return await db.select().from(externalAgents).where(eq(externalAgents.isActive, true));
  }

  // Guardar respuesta de agente
  async saveAgentResponse(responseData: Omit<InsertAgentResponse, 'id'>): Promise<AgentResponse> {
    const [response] = await db.insert(agentResponses).values(responseData).returning();
    return response;
  }

  // Obtener respuestas de un agente
  async getAgentResponses(agentId: string): Promise<AgentResponse[]> {
    return await db.select().from(agentResponses).where(eq(agentResponses.agentId, agentId));
  }

  // Enviar mensaje a agente externo y procesar respuesta
  async sendMessageToAgent(agentId: string, message: string, chatId: string): Promise<string | null> {
    try {
      const agent = await this.getAgentById(agentId);
      
      if (!agent || !agent.isActive) {
        console.log(`Agente ${agentId} no encontrado o inactivo`);
        return null;
      }

      const startTime = Date.now();

      // Preparar el payload para el agente externo
      const payload = {
        message: message,
        chatId: chatId,
        timestamp: new Date().toISOString()
      };

      console.log(`🤖 Enviando mensaje a agente externo: ${agent.name}`);
      console.log(`📡 URL: ${agent.agentUrl}`);
      console.log(`💬 Mensaje: ${message}`);

      // Hacer la petición al agente externo con AbortController para timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(agent.agentUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`❌ Error en respuesta del agente: ${response.status} ${response.statusText}`);
        return null;
      }

      const responseData = await response.json();
      const responseTime = Date.now() - startTime;

      // Extraer la respuesta del agente
      let agentResponseText = '';
      
      if (typeof responseData === 'string') {
        agentResponseText = responseData;
      } else if (responseData.response) {
        agentResponseText = responseData.response;
      } else if (responseData.message) {
        agentResponseText = responseData.message;
      } else if (responseData.text) {
        agentResponseText = responseData.text;
      } else {
        agentResponseText = JSON.stringify(responseData);
      }

      console.log(`✅ Respuesta recibida del agente: ${agentResponseText}`);

      // Guardar la respuesta en la base de datos
      await this.saveAgentResponse({
        agentId: agentId,
        chatId: chatId,
        originalMessage: message,
        agentResponse: agentResponseText,
        confidence: responseData.confidence || null,
        responseTime: responseTime
      });

      return agentResponseText;

    } catch (error) {
      console.error(`❌ Error comunicándose con agente externo ${agentId}:`, error);
      return null;
    }
  }

  // Verificar si un mensaje debe ser procesado por algún agente
  async shouldProcessMessage(message: string): Promise<ExternalAgent | null> {
    const activeAgents = await this.getActiveAgents();
    
    for (const agent of activeAgents) {
      // Si no hay palabras clave específicas, el agente procesa todos los mensajes
      if (!agent.triggerKeywords || agent.triggerKeywords.length === 0) {
        return agent;
      }
      
      // Verificar si el mensaje contiene alguna palabra clave
      const messageText = message.toLowerCase();
      const hasKeyword = agent.triggerKeywords.some(keyword => 
        messageText.includes(keyword.toLowerCase())
      );
      
      if (hasKeyword) {
        return agent;
      }
    }
    
    return null;
  }

  // Procesar mensaje para agente específico
  async processMessageForAgent(message: string, chatId: string, accountId: number, context?: any): Promise<any> {
    try {
      const agent = await this.shouldProcessMessage(message);
      
      if (!agent) {
        return {
          success: false,
          message: 'No hay agentes disponibles para procesar este mensaje'
        };
      }

      const response = await this.sendMessageToAgent(agent.id, message, chatId);
      
      return {
        success: true,
        response: response,
        agent: agent.name,
        processingTime: Date.now()
      };
    } catch (error) {
      console.error('❌ Error procesando mensaje para agente:', error);
      return {
        success: false,
        error: 'Error procesando mensaje'
      };
    }
  }

  // Activar agente
  async activateAgent(agentId: string): Promise<boolean> {
    try {
      const result = await this.updateAgent(agentId, { isActive: true });
      return !!result;
    } catch (error) {
      console.error('❌ Error activando agente:', error);
      return false;
    }
  }

  // Desactivar agente
  async deactivateAgent(agentId: string): Promise<boolean> {
    try {
      const result = await this.updateAgent(agentId, { isActive: false });
      return !!result;
    } catch (error) {
      console.error('❌ Error desactivando agente:', error);
      return false;
    }
  }

  // Obtener estadísticas de agentes
  async getAgentStats(): Promise<any> {
    try {
      const allAgents = await this.getAllAgents();
      const activeAgents = allAgents.filter(agent => agent.isActive);
      
      const agentsByUrl: Record<string, number> = {};
      
      allAgents.forEach(agent => {
        try {
          const domain = new URL(agent.agentUrl).hostname;
          agentsByUrl[domain] = (agentsByUrl[domain] || 0) + 1;
        } catch {
          agentsByUrl['unknown'] = (agentsByUrl['unknown'] || 0) + 1;
        }
      });
      
      return {
        totalAgents: allAgents.length,
        activeAgents: activeAgents.length,
        agentsByUrl: agentsByUrl
      };
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas de agentes:', error);
      return {
        totalAgents: 0,
        activeAgents: 0,
        agentsByUrl: {}
      };
    }
  }
}

export const externalAgentService = new ExternalAgentService();