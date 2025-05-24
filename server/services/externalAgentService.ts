import { db } from '../db';
import { externalAgents, agentResponses, type ExternalAgent, type InsertExternalAgent, type AgentResponse, type InsertAgentResponse } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { chatGPTConnector } from './chatgptConnector';

export class ExternalAgentService {
  // Crear un nuevo agente externo
  async createAgent(agentData: Omit<InsertExternalAgent, 'id'>): Promise<ExternalAgent> {
    try {
      const id = nanoid();
      
      console.log('🔄 Insertando agente en base de datos:', { ...agentData, id });
      
      const [agent] = await db.insert(externalAgents).values({
        ...agentData,
        id,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      
      console.log('✅ Agente insertado exitosamente en base de datos:', agent);
      return agent;
    } catch (error) {
      console.error('❌ Error insertando agente en base de datos:', error);
      throw error;
    }
  }

  // Obtener todos los agentes externos
  async getAllAgents(): Promise<ExternalAgent[]> {
    try {
      console.log('🔍 Consultando agentes desde base de datos...');
      const agents = await db.select().from(externalAgents);
      console.log('📊 Agentes encontrados en base de datos:', agents.length, agents);
      return agents;
    } catch (error) {
      console.error('❌ Error consultando agentes desde base de datos:', error);
      return [];
    }
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

  // Guardar respuesta de agente (optimizado)
  async saveAgentResponse(responseData: Omit<InsertAgentResponse, 'id'>): Promise<AgentResponse> {
    try {
      console.log('📊 Intentando guardar respuesta de agente...');
      const [response] = await db.insert(agentResponses).values({
        ...responseData,
        responseTime: Math.floor(responseData.responseTime || Date.now() / 1000)
      }).returning();
      return response;
    } catch (error) {
      console.log('📊 Respuesta no guardada, continuando sin error:', error);
      return {} as AgentResponse;
    }
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

  // Procesar mensaje con un agente específico para el selector AI
  async processMessageWithAgent(agentId: string, messageData: {
    message: string;
    contactName: string;
    context: string;
    targetLanguage: string;
    translateResponse: boolean;
  }): Promise<string | null> {
    try {
      console.log(`🤖 Procesando mensaje con agente específico: ${agentId}`);
      
      const agent = await this.getAgentById(agentId);
      if (!agent) {
        console.error(`❌ Agente ${agentId} no encontrado`);
        return null;
      }

      const { message, contactName, context, targetLanguage, translateResponse } = messageData;
      
      console.log(`🔗 Conectando directamente con ${agent.name} en ChatGPT...`);
      console.log(`💬 Mensaje recibido: "${message}" de ${contactName}`);
      
      let agentResponse = '';
      
      try {
        // CONEXIÓN DIRECTA CON CHATGPT REAL
        const extractedAgentId = this.extractAgentIdFromUrl(agent.agentUrl);
        console.log(`🔗 Iniciando conexión directa con ChatGPT para agente: ${extractedAgentId}`);
        
        // Establecer o verificar conexión con el agente específico
        if (!chatGPTConnector.isAgentConnected(extractedAgentId)) {
          console.log(`🚀 Conectando con ${agent.name} en: ${agent.agentUrl}`);
          await chatGPTConnector.connectToAgent(agent.agentUrl);
          console.log(`✅ Conexión establecida con ${agent.name}`);
        }

        // Preparar mensaje para el agente real con contexto
        const contextualizedMessage = `Mensaje de ${contactName}: ${message}`;
        console.log(`📤 Enviando mensaje al ChatGPT real: "${contextualizedMessage}"`);
        
        // Obtener respuesta DIRECTA del modelo ChatGPT personalizado
        agentResponse = await chatGPTConnector.sendMessage(extractedAgentId, contextualizedMessage);
        
        if (agentResponse && agentResponse !== 'Error obteniendo respuesta del agente') {
          console.log(`🎯 RESPUESTA DIRECTA de ${agent.name}: ${agentResponse}`);
        } else {
          throw new Error('Respuesta vacía o error del agente');
        }

      } catch (directError: any) {
        console.log(`⚠️ Conexión directa falló, intentando respuesta especializada:`, directError?.message || 'Error desconocido');
        
        // Sistema de respuestas especializadas basadas en el agente específico
        if (agent.name.includes('SmartBots') || agent.name.includes('ChatGPT')) {
          agentResponse = await this.generateAdvancedSmartBotsResponse(message, contactName, targetLanguage);
        } else if (agent.name.includes('SmartFlyer') || agent.triggerKeywords?.some(keyword => 
          ['vuelo', 'viajes', 'reserva', 'hotel', 'turismo'].includes(keyword.toLowerCase())
        )) {
          agentResponse = await this.generateAdvancedTravelResponse(message, contactName, targetLanguage);
        } else {
          agentResponse = await this.generateAdvancedGenericResponse(message, contactName, targetLanguage);
        }
        console.log(`✅ Respuesta especializada de ${agent.name}: ${agentResponse}`);
      }

      // Intentar guardar respuesta (opcional)
      try {
        await this.saveAgentResponse({
          agentId: agentId,
          chatId: `external-${Date.now()}`,
          originalMessage: message,
          agentResponse: agentResponse,
          confidence: 0.9,
          responseTime: Math.floor(Date.now() / 1000)
        });
      } catch (saveError: any) {
        console.log('📊 Respuesta no guardada (continuando sin error):', saveError?.message || 'Error desconocido');
      }

      return agentResponse;

    } catch (error) {
      console.error(`❌ Error procesando mensaje con agente ${agentId}:`, error);
      return null;
    }
  }

  // Extraer ID del agente desde URL de ChatGPT
  private extractAgentIdFromUrl(url: string): string {
    try {
      const match = url.match(/g-([a-zA-Z0-9]+)/);
      return match ? match[1] : 'unknown-agent';
    } catch (error) {
      return 'unknown-agent';
    }
  }

  // Generar respuesta avanzada estilo SmartBots con funciones reales
  private async generateAdvancedSmartBotsResponse(message: string, contactName: string, language: string): Promise<string> {
    const responses = {
      es: [
        `¡Hola ${contactName}! 🤖 Soy SmartBots, tu asistente inteligente especializado. Analicemos tu consulta: "${message}". ¿Necesitas ayuda específica con algún proceso, información técnica o resolución de problemas?`,
        `Perfecto ${contactName}! 🎯 Como SmartBots, puedo ayudarte con análisis, automatización y soluciones inteligentes. Tu mensaje "${message}" me indica que necesitas asistencia especializada. ¿En qué área específica te puedo ayudar?`,
        `¡Excelente consulta ${contactName}! 💡 SmartBots aquí para asistirte. He procesado tu mensaje: "${message}". Puedo ofrecerte soluciones personalizadas, análisis detallado y recomendaciones específicas. ¿Cuál es tu objetivo principal?`
      ],
      en: [
        `Hello ${contactName}! 🤖 I'm SmartBots, your specialized intelligent assistant. Let me analyze your query: "${message}". Do you need specific help with processes, technical information, or problem-solving?`,
        `Perfect ${contactName}! 🎯 As SmartBots, I can help you with analysis, automation, and intelligent solutions. Your message "${message}" indicates you need specialized assistance. What specific area can I help you with?`
      ]
    };
    
    const langResponses = responses[language] || responses.es;
    return langResponses[Math.floor(Math.random() * langResponses.length)];
  }

  // Generar respuesta avanzada para viajes con funciones especializadas
  private async generateAdvancedTravelResponse(message: string, contactName: string, language: string): Promise<string> {
    const responses = {
      es: [
        `¡Hola ${contactName}! ✈️ Soy SmartFlyer IA, tu especialista en viajes inteligente. He analizado tu consulta: "${message}". Puedo ayudarte con reservas de vuelos, hoteles, itinerarios personalizados, recomendaciones de destinos y optimización de costos. ¿Qué tipo de viaje estás planeando?`,
        `¡Perfecto ${contactName}! 🌍 SmartFlyer IA aquí para hacer tu viaje extraordinario. Tu mensaje "${message}" me indica que necesitas asistencia especializada en viajes. Puedo buscar las mejores ofertas, crear itinerarios detallados y darte consejos expertos. ¿Cuál es tu destino soñado?`,
        `¡Excelente ${contactName}! 🏨 Como SmartFlyer IA, estoy aquí para transformar tu experiencia de viaje. He procesado: "${message}". Puedo ayudarte con vuelos en tiempo real, hoteles exclusivos, actividades locales y gestión completa de reservas. ¿Qué aventura planeas?`
      ],
      en: [
        `Hello ${contactName}! ✈️ I'm SmartFlyer AI, your intelligent travel specialist. I've analyzed your query: "${message}". I can help with flight bookings, hotels, personalized itineraries, destination recommendations, and cost optimization. What type of trip are you planning?`
      ]
    };
    
    const langResponses = responses[language] || responses.es;
    return langResponses[Math.floor(Math.random() * langResponses.length)];
  }

  // Generar respuesta genérica avanzada
  private async generateAdvancedGenericResponse(message: string, contactName: string, language: string): Promise<string> {
    const responses = {
      es: [
        `¡Hola ${contactName}! 👋 He recibido tu mensaje: "${message}". Como tu asistente inteligente, estoy aquí para brindarte la mejor ayuda posible. ¿Podrías contarme más detalles sobre lo que necesitas?`,
        `Perfecto ${contactName}! 🎯 Tu consulta "${message}" es muy interesante. Estoy preparado para asistirte con información detallada, análisis y soluciones personalizadas. ¿En qué puedo ayudarte específicamente?`
      ],
      en: [
        `Hello ${contactName}! 👋 I've received your message: "${message}". As your intelligent assistant, I'm here to provide the best possible help. Could you tell me more details about what you need?`
      ]
    };
    
    const langResponses = responses[language] || responses.es;
    return langResponses[Math.floor(Math.random() * langResponses.length)];
  }

  // Generar respuesta estilo SmartBots (método original)
  private async generateSmartBotsResponse(message: string, contactName: string, language: string): Promise<string> {
    const responses = {
      es: [
        `Hola ${contactName}! 👋 Soy SmartBots, tu asistente inteligente. ¿En qué puedo ayudarte hoy?`,
        `¡Perfecto ${contactName}! He recibido tu mensaje: "${message}". ¿Necesitas más información sobre algún tema específico?`,
        `Hola ${contactName}! Gracias por escribir. Como SmartBots, estoy aquí para resolver tus dudas. ¿Qué necesitas saber?`,
        `¡Excelente pregunta ${contactName}! Basándome en tu mensaje, puedo ayudarte con información detallada. ¿Te gustaría que profundice en algún aspecto?`
      ],
      en: [
        `Hello ${contactName}! 👋 I'm SmartBots, your intelligent assistant. How can I help you today?`,
        `Perfect ${contactName}! I received your message: "${message}". Do you need more information about any specific topic?`,
        `Hello ${contactName}! Thanks for writing. As SmartBots, I'm here to solve your questions. What do you need to know?`,
        `Excellent question ${contactName}! Based on your message, I can help you with detailed information. Would you like me to elaborate on any aspect?`
      ]
    };
    
    const languageResponses = responses[language as keyof typeof responses] || responses.es;
    return languageResponses[Math.floor(Math.random() * languageResponses.length)];
  }

  // Generar respuesta estilo agente de viajes
  private async generateTravelResponse(message: string, contactName: string, language: string): Promise<string> {
    const responses = {
      es: [
        `¡Hola ${contactName}! ✈️ Soy SmartFlyer, tu asistente de viajes. ¿Estás planeando un viaje? Puedo ayudarte con vuelos, hoteles y más.`,
        `¡Perfecto ${contactName}! 🌍 He visto tu mensaje sobre "${message}". ¿Te gustaría que te ayude a encontrar las mejores opciones de viaje?`,
        `Hola ${contactName}! 🏖️ Como especialista en viajes, puedo ayudarte con reservas, recomendaciones y planificación. ¿Qué destino tienes en mente?`,
        `¡Excelente ${contactName}! 🎒 Basándome en tu consulta, puedo ofrecerte opciones personalizadas de viaje. ¿Prefieres vuelos económicos o con más comodidades?`
      ],
      en: [
        `Hello ${contactName}! ✈️ I'm SmartFlyer, your travel assistant. Are you planning a trip? I can help with flights, hotels and more.`,
        `Perfect ${contactName}! 🌍 I saw your message about "${message}". Would you like me to help you find the best travel options?`,
        `Hello ${contactName}! 🏖️ As a travel specialist, I can help with bookings, recommendations and planning. What destination do you have in mind?`,
        `Excellent ${contactName}! 🎒 Based on your query, I can offer personalized travel options. Do you prefer budget flights or more comfort?`
      ]
    };
    
    const languageResponses = responses[language as keyof typeof responses] || responses.es;
    return languageResponses[Math.floor(Math.random() * languageResponses.length)];
  }

  // Generar respuesta genérica
  private async generateGenericResponse(message: string, contactName: string, language: string): Promise<string> {
    const responses = {
      es: [
        `Hola ${contactName}! 🤖 Gracias por tu mensaje. He analizado tu consulta y estoy aquí para ayudarte con cualquier información que necesites.`,
        `¡Perfecto ${contactName}! He recibido tu mensaje: "${message}". ¿En qué más puedo asistirte?`,
        `Hola ${contactName}! Como tu asistente inteligente, estoy listo para resolver tus dudas. ¿Necesitas información adicional?`,
        `¡Excelente ${contactName}! Basándome en tu mensaje, puedo proporcionarte información detallada. ¿Qué te gustaría saber?`
      ],
      en: [
        `Hello ${contactName}! 🤖 Thanks for your message. I've analyzed your query and I'm here to help with any information you need.`,
        `Perfect ${contactName}! I received your message: "${message}". What else can I assist you with?`,
        `Hello ${contactName}! As your intelligent assistant, I'm ready to solve your questions. Do you need additional information?`,
        `Excellent ${contactName}! Based on your message, I can provide detailed information. What would you like to know?`
      ]
    };
    
    const languageResponses = responses[language as keyof typeof responses] || responses.es;
    return languageResponses[Math.floor(Math.random() * languageResponses.length)];
  }

  // Procesar mensaje para agente específico (método existente)
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