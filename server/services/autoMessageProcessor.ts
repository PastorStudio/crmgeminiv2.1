import { db } from '../db';
import { whatsappAccounts, externalAgents } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

export interface AutoMessageResponse {
  success: boolean;
  response?: string;
  agentName?: string;
}

export interface MessageForProcessing {
  body: string;
  accountId: number;
  chatId: string;
  fromMe: boolean;
  type: string;
}

/**
 * Procesador automático de mensajes con agentes externos
 */
export class AutoMessageProcessor {
  
  /**
   * Detecta el idioma de un texto usando OpenAI
   */
  private async detectLanguage(text: string): Promise<string> {
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: "Detecta el idioma del siguiente texto y responde únicamente con el código del idioma (es, en, fr, pt, it, de, etc.). Si es español, responde 'es'." 
          },
          { role: "user", content: text }
        ],
        max_tokens: 10,
        temperature: 0,
      });

      return response.choices[0].message.content?.trim().toLowerCase() || 'es';
    } catch (error) {
      console.error('❌ Error detectando idioma:', error);
      return 'es'; // Default al español
    }
  }

  /**
   * Traduce un texto al español usando OpenAI
   */
  private async translateToSpanish(text: string, fromLanguage: string): Promise<string> {
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: `Traduce el siguiente texto del ${fromLanguage} al español de manera natural y precisa. Mantén el tono y el contexto original. Responde únicamente con la traducción.` 
          },
          { role: "user", content: text }
        ],
        max_tokens: 300,
        temperature: 0.3,
      });

      return response.choices[0].message.content?.trim() || text;
    } catch (error) {
      console.error('❌ Error traduciendo texto:', error);
      return text; // Retornar el texto original si falla la traducción
    }
  }

  /**
   * Traduce un texto a un idioma específico usando OpenAI
   */
  private async translateToLanguage(text: string, targetLanguage: string, targetLanguageName: string): Promise<string> {
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: `Traduce el siguiente texto al ${targetLanguageName} de manera natural y precisa. Mantén el tono y el contexto original. Responde únicamente con la traducción.` 
          },
          { role: "user", content: text }
        ],
        max_tokens: 300,
        temperature: 0.3,
      });

      return response.choices[0].message.content?.trim() || text;
    } catch (error) {
      console.error('❌ Error traduciendo al idioma objetivo:', error);
      return text; // Retornar el texto original si falla la traducción
    }
  }

  /**
   * Procesa un mensaje entrante y genera una respuesta automática si está configurado
   */
  async processMessage(message: MessageForProcessing, translationConfig?: { enabled: boolean; language: string; languageName: string }): Promise<AutoMessageResponse> {
    try {
      console.log(`🔄 PROCESANDO MENSAJE AUTOMÁTICO: "${message.body.substring(0, 50)}..." en cuenta ${message.accountId}`);
      
      // Verificar que no sea un mensaje propio o de estados
      if (message.fromMe || message.chatId.includes('status@broadcast')) {
        console.log('⏭️ Omitiendo mensaje propio o de estado');
        return { success: false };
      }

      // Obtener configuración de la cuenta
      const [account] = await db
        .select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.id, message.accountId))
        .limit(1);

      if (!account) {
        console.log(`❌ No se encontró cuenta ${message.accountId}`);
        return { success: false };
      }

      console.log(`🔍 Debug - Verificando agente para cuenta ${message.accountId}...`);
      console.log(`🔍 Debug inicial - assignedExternalAgentId: ${account.assignedExternalAgentId}, autoResponseEnabled: ${account.autoResponseEnabled}`);
      
      try {
        const directQuery = await db.select({
          assignedExternalAgentId: whatsappAccounts.assignedExternalAgentId,
          autoResponseEnabled: whatsappAccounts.autoResponseEnabled
        }).from(whatsappAccounts).where(eq(whatsappAccounts.id, message.accountId));
          
        if (directQuery.length > 0) {
          const directConfig = directQuery[0];
          console.log(`🔧 Configuración directa encontrada:`, directConfig);
          
          if (directConfig.assignedExternalAgentId && directConfig.autoResponseEnabled) {
            // Obtener información del agente
            const agentQuery = await db.select({
              agentName: externalAgents.agentName
            }).from(externalAgents).where(eq(externalAgents.id, directConfig.assignedExternalAgentId));
            
            if (agentQuery.length > 0) {
              const agentName = agentQuery[0].agentName;
              console.log(`🤖 Conectando con agente externo real: ${agentName}...`);
              
              // Usar el servicio de agentes externos reales
              const { RealExternalAgentService } = await import('./realExternalAgents');
              
              const realAgentResponse = await RealExternalAgentService.sendMessageToRealAgent(
                directConfig.assignedExternalAgentId,
                message.body,
                translationConfig
              );
              
              if (realAgentResponse.success) {
                console.log(`✅ RESPUESTA REAL DEL AGENTE ${agentName}: ${realAgentResponse.response?.substring(0, 50)}...`);
                return {
                  success: true,
                  response: realAgentResponse.response,
                  agentName: realAgentResponse.agentName
                };
              } else {
                console.log(`❌ Error en comunicación real con ${agentName}: ${realAgentResponse.error}`);
                return { success: false };
              }
            }
          }
        }
      } catch (directError) {
        console.error('❌ Error en consulta directa:', directError);
        return { success: false };
      }

      // Buscar el agente asignado en los agentes predefinidos
      const defaultAgents = [
        {
          id: 'smartbots-001',
          name: 'Smartbots',
          agentUrl: 'https://chatgpt.com/g/g-682ceb8bfa4c81918b3ff66abe6f3480-smartbots',
          context: 'Eres un asistente inteligente especializado en automatización y gestión de tareas. Proporcionas respuestas útiles y eficientes.'
        },
        {
          id: 'smartplanner-001',
          name: 'Smartplanner IA',
          agentUrl: 'https://chatgpt.com/g/g-682e61ce2364819196df9641616414b1-smartplanner-ia',
          context: 'Eres un asistente de planificación inteligente. Ayudas a organizar tareas, proyectos y gestionar el tiempo de manera eficiente.'
        },
        {
          id: 'smartflyer-001',
          name: 'Smartflyer IA',
          agentUrl: 'https://chatgpt.com/g/g-682f551bee70819196aeb603eb638762-smartflyer-ia',
          context: 'Eres un asistente especializado en viajes y gestión de vuelos. Proporcionas información sobre vuelos, hoteles y planificación de viajes.'
        },
        {
          id: 'smartlegal-001',
          name: 'Smart Legal Bot',
          agentUrl: 'https://chatgpt.com/g/g-682f6c2f3f80819196ac6e9e4b1e4e96-smart-legal-bot',
          context: 'Eres un asistente legal inteligente. Proporcionas información legal básica y orientación sobre procesos legales.'
        },
        {
          id: 'smarttech-001',
          name: 'Smart Tech Support',
          agentUrl: 'https://chatgpt.com/g/g-682f7d4e5e90819196ad7f0f5c2f5f07-smart-tech-support',
          context: 'Eres un asistente técnico especializado en soporte tecnológico. Ayudas a resolver problemas técnicos y proporcionas orientación sobre tecnología.'
        }
      ];

      // Verificar si la cuenta tiene un agente asignado por ID
      if (account.assignedExternalAgentId && account.autoResponseEnabled) {
        const assignedAgent = defaultAgents.find(agent => agent.id === account.assignedExternalAgentId);
        
        if (assignedAgent) {
          console.log(`🤖 Conectando con agente externo real: ${assignedAgent.name}...`);
          
          try {
            // Usar el servicio de agentes externos reales
            const { RealExternalAgentService } = await import('./realExternalAgents');
            
            const realAgentResponse = await RealExternalAgentService.sendMessageToRealAgent(
              assignedAgent.id,
              message.body,
              translationConfig
            );
            
            if (realAgentResponse.success) {
              console.log(`✅ RESPUESTA REAL DEL AGENTE ${assignedAgent.name}: ${realAgentResponse.response?.substring(0, 50)}...`);
              return {
                success: true,
                response: realAgentResponse.response,
                agentName: realAgentResponse.agentName
              };
            } else {
              console.log(`❌ Error en comunicación real con ${assignedAgent.name}: ${realAgentResponse.error}`);
              return { success: false };
            }
          } catch (realAgentError) {
            console.error('❌ Error conectando con agente externo real:', realAgentError);
            return { success: false };
          }
        }
      }

      console.log('⏭️ No hay agente asignado o respuestas automáticas desactivadas');
      return { success: false };

    } catch (error) {
      console.error('❌ Error en procesamiento automático de mensajes:', error);
      return { success: false };
    }
  }

  /**
   * Procesa un mensaje entrante y genera respuesta automática
   */
  async processIncomingMessage(messageData: {
    id: string;
    body: string;
    fromMe: boolean;
    timestamp: number;
    chatId: string;
    accountId: number;
    contactName?: string;
    contactPhone?: string;
  }): Promise<void> {
    try {
      // Solo procesar mensajes que NO son nuestros
      if (messageData.fromMe) {
        console.log('🔄 Ignorando mensaje propio');
        return;
      }

      console.log(`🔄 PROCESANDO MENSAJE ENTRANTE - Cuenta: ${messageData.accountId}, Chat: ${messageData.chatId}`);
      console.log(`📝 Mensaje: "${messageData.body}"`);

      // Verificar si la cuenta tiene respuestas automáticas activas
      const hasAutoResponse = await this.hasActiveAutoResponse(messageData.accountId);
      if (!hasAutoResponse) {
        console.log('⏭️ Respuestas automáticas desactivadas para esta cuenta');
        return;
      }

      // Procesar mensaje con agente externo
      const messageForProcessing: MessageForProcessing = {
        body: messageData.body,
        accountId: messageData.accountId,
        chatId: messageData.chatId,
        fromMe: false,
        type: 'text'
      };

      // Procesar mensaje con el sistema de respuestas automáticas multi-proveedor
      const { WhatsAppAutoResponder } = await import('./whatsappAutoResponder');
      const response = await WhatsAppAutoResponder.processIncomingMessage(
        messageForProcessing,
        (to: string, responseMessage: string) => {
          console.log(`📤 Enviando respuesta a ${to}: ${responseMessage}`);
          return Promise.resolve();
        }
      );
      
      if (response) {
        console.log(`✅ Respuesta generada y procesada correctamente`);
      } else {
        console.log('❌ No se pudo generar respuesta automática');
      }
    } catch (error) {
      console.error('❌ Error procesando mensaje entrante:', error);
    }
  }

  /**
   * Verifica si una cuenta tiene respuestas automáticas activas
   */
  async hasActiveAutoResponse(accountId: number): Promise<boolean> {
    try {
      const [account] = await db
        .select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.id, accountId))
        .limit(1);

      return !!(account?.assignedExternalAgentId && account.autoResponseEnabled);
    } catch (error) {
      console.error('Error verificando respuesta automática activa:', error);
      return false;
    }
  }
}

export const autoMessageProcessor = new AutoMessageProcessor();