import { db } from '../db';
import { externalAgents, agentResponses, type ExternalAgent, type InsertExternalAgent, type AgentResponse, type InsertAgentResponse } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { chatGPTConnector } from './chatgptConnector';
import OpenAI from 'openai';

export class ExternalAgentService {
  private openai: OpenAI;

  constructor() {
    // Inicializar cliente OpenAI con tu clave API
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
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
        // CONEXIÓN DIRECTA CON TU CLAVE API DE OPENAI REAL
        console.log(`🔗 Conectando con tu clave API de OpenAI para agente: ${agent.name}`);
        
        // Configurar instrucciones específicas para cada uno de tus agentes
        let systemPrompt = '';
        
        if (agent.name.includes('SmartBots') || agent.agentUrl.includes('smartbots')) {
          systemPrompt = `Eres ${agent.name}, un asistente inteligente especializado en automatización, análisis de procesos y soluciones empresariales. SIEMPRE identifícate como "${agent.name}" al responder. Tu función es ayudar con:
          - Automatización de workflows empresariales
          - Análisis de datos y procesos
          - Soluciones tecnológicas inteligentes
          - Optimización de sistemas
          - Consultoría especializada
          
          Responde de manera profesional, técnica pero accesible, siempre enfocándote en dar soluciones prácticas y específicas. Comienza tus respuestas mencionando tu nombre: "${agent.name}".`;
        } else if (agent.name.includes('SmartFlyer') || agent.agentUrl.includes('smartflyer')) {
          systemPrompt = `Eres ${agent.name}, un especialista en viajes y turismo inteligente. SIEMPRE identifícate como "${agent.name}" al responder. Tu función es ayudar con:
          - Búsqueda y reserva de vuelos
          - Recomendaciones de hoteles y alojamiento
          - Planificación de itinerarios personalizados
          - Consejos de viaje y destinos
          - Optimización de costos de viaje
          - Actividades y experiencias locales
          
          Responde de manera entusiasta y profesional, enfocándote en crear experiencias de viaje extraordinarias. Comienza tus respuestas mencionando tu nombre: "${agent.name}".`;
        } else {
          systemPrompt = `Eres ${agent.name}, un asistente inteligente especializado. SIEMPRE identifícate como "${agent.name}" al responder. Ayuda al usuario de manera profesional y específica según su consulta. Comienza tus respuestas mencionando tu nombre: "${agent.name}".`;
        }

        // Preparar mensaje para OpenAI con tu clave API
        const contextualizedMessage = `Mensaje de ${contactName}: ${message}`;
        console.log(`📤 Enviando a OpenAI con tu clave API: "${contextualizedMessage}"`);
        
        // Obtener respuesta DIRECTA usando tu clave API de OpenAI
        const response = await this.openai.chat.completions.create({
          model: "gpt-4o", // El modelo más avanzado disponible
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: contextualizedMessage }
          ],
          max_tokens: 500,
          temperature: 0.7
        });
        
        agentResponse = response.choices[0]?.message?.content || 'No se pudo generar respuesta';
        console.log(`🎯 RESPUESTA DIRECTA con tu API de ${agent.name}: ${agentResponse}`);

      } catch (directError: any) {
        console.log(`⚠️ Error con tu clave API, usando respuesta de respaldo:`, directError?.message || 'Error desconocido');
        
        // Respuestas de respaldo específicas para cada agente
        if (agent.name.includes('SmartBots') || agent.name.includes('ChatGPT')) {
          agentResponse = await this.generateAdvancedSmartBotsResponse(message, contactName, targetLanguage);
        } else if (agent.name.includes('SmartFlyer') || agent.triggerKeywords?.some(keyword => 
          ['vuelo', 'viajes', 'reserva', 'hotel', 'turismo'].includes(keyword.toLowerCase())
        )) {
          agentResponse = await this.generateAdvancedTravelResponse(message, contactName, targetLanguage);
        } else {
          agentResponse = await this.generateAdvancedGenericResponse(message, contactName, targetLanguage);
        }
        console.log(`✅ Respuesta de respaldo de ${agent.name}: ${agentResponse}`);
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

  // Procesar mensaje para agente específico con respuesta automática
  async processMessageForAgent(message: string, chatId: string, accountId: number, context?: any): Promise<any> {
    try {
      // Obtener todos los agentes disponibles
      const agents = await this.getAllAgents();
      
      if (agents.length === 0) {
        console.log('🤖 No hay agentes externos configurados, creando agente predeterminado...');
        
        // Crear agente SmartBots predeterminado si no existe
        const defaultAgent = await this.createAgent({
          name: 'SmartBots ChatGPT',
          agentUrl: 'https://chatgpt.com/g/g-682ceb8bfa4c81918b3ff66abe6f3480-smartbots',
          description: 'Asistente inteligente especializado en automatización empresarial',
          triggerKeywords: ['automatización', 'procesos', 'sistemas', 'consultoría'],
          responseTimeMs: 3000,
          isActive: true
        });
        
        console.log('✅ Agente SmartBots ChatGPT creado automáticamente');
      }

      // Buscar agente SmartBots ChatGPT como predeterminado
      const updatedAgents = await this.getAllAgents();
      let selectedAgent = updatedAgents.find(agent => 
        agent.name.includes('SmartBots') || agent.name.includes('ChatGPT')
      );
      
      // Si no hay SmartBots, usar el primer agente disponible
      if (!selectedAgent) {
        selectedAgent = updatedAgents[0];
      }
      
      if (!selectedAgent) {
        return {
          success: false,
          message: 'No hay agentes disponibles para procesar este mensaje'
        };
      }

      console.log(`🤖 Procesando mensaje automáticamente con ${selectedAgent.name}`);
      
      // Generar respuesta usando el agente con tu clave API de OpenAI
      const agentResponse = await this.processMessageWithAgent(selectedAgent.id, {
        message,
        contactName: context?.contactName || 'Cliente',
        context: `Auto-respuesta para chat ${chatId}`,
        targetLanguage: 'es',
        translateResponse: false
      });

      if (agentResponse) {
        // Enviar respuesta automáticamente vía WhatsApp
        await this.sendAutoResponseToWhatsApp(accountId, chatId, agentResponse);
        
        return {
          success: true,
          response: agentResponse,
          agent: selectedAgent.name,
          processingTime: Date.now()
        };
      } else {
        return {
          success: false,
          message: 'No se pudo generar respuesta automática'
        };
      }
    } catch (error) {
      console.error('❌ Error procesando mensaje para agente:', error);
      return {
        success: false,
        error: 'Error procesando mensaje'
      };
    }
  }

  // Enviar respuesta automática a WhatsApp
  async sendAutoResponseToWhatsApp(accountId: number, chatId: string, message: string): Promise<boolean> {
    try {
      console.log(`📤 Enviando respuesta automática a chat ${chatId}: "${message}"`);
      
      const response = await fetch(`http://localhost:5000/api/whatsapp-accounts/${accountId}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: chatId,
          message: message
        })
      });

      if (response.ok) {
        console.log(`✅ Respuesta automática enviada exitosamente`);
        return true;
      } else {
        console.error(`❌ Error enviando respuesta automática: ${response.statusText}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Error enviando respuesta automática:', error);
      return false;
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