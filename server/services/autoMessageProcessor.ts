import OpenAI from 'openai';
import { db } from '../db';
import { whatsappAccounts } from '../../shared/schema';
import { eq } from 'drizzle-orm';

interface WhatsAppMessage {
  id: string;
  chatId: string;
  accountId: number;
  from: string;
  body: string;
  timestamp: number;
  fromMe: boolean;
  contactName?: string;
}

export class AutoMessageProcessor {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY 
    });
  }

  /**
   * Procesa un mensaje entrante y genera respuesta automática si está configurado
   */
  async processIncomingMessage(message: WhatsAppMessage): Promise<{ success: boolean; response?: string; agentName?: string }> {
    try {
      // Solo procesar mensajes que no son nuestros
      if (message.fromMe) {
        return { success: false };
      }

      console.log(`📨 Procesando mensaje entrante en cuenta ${message.accountId}: "${message.body.substring(0, 50)}..."`);

      // Obtener configuración de la cuenta WhatsApp
      const [account] = await db
        .select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.id, message.accountId))
        .limit(1);

      if (!account) {
        console.log(`❌ Cuenta WhatsApp ${message.accountId} no encontrada`);
        return { success: false };
      }

      // Verificar si tiene agente externo asignado y respuesta automática activada
      if (!account.assignedExternalAgentId || !account.autoResponseEnabled) {
        console.log(`⏭️ Cuenta ${message.accountId} no tiene agente externo activo`);
        console.log(`🔍 Debug - assignedExternalAgentId: ${account.assignedExternalAgentId}, autoResponseEnabled: ${account.autoResponseEnabled}`);
        
        // Intentar consulta directa con SQL puro
        try {
          const directQuery = await db.execute(`
            SELECT assigned_external_agent_id, auto_response_enabled 
            FROM whatsapp_accounts 
            WHERE id = $1
          `, [message.accountId]);
          
          if (directQuery.rows.length > 0) {
            const directConfig = directQuery.rows[0];
            console.log(`🔧 Configuración directa encontrada:`, directConfig);
            
            if (directConfig.assigned_external_agent_id && directConfig.auto_response_enabled) {
              // Obtener información del agente
              const agentQuery = await db.execute(`
                SELECT agent_name FROM external_agents 
                WHERE id = $1
              `, [directConfig.assigned_external_agent_id]);
              
              if (agentQuery.rows.length > 0) {
                const agentName = agentQuery.rows[0].agent_name;
                console.log(`🤖 Generando respuesta automática con ${agentName}...`);
                
                // Generar respuesta usando OpenAI
                const OpenAI = require('openai');
                const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                
                const systemPrompt = `Eres ${agentName}, un asistente virtual profesional y amigable. 
                Responde de manera útil y conversacional en español. 
                Mantén las respuestas concisas pero informativas.`;
                
                const response = await openai.chat.completions.create({
                  model: "gpt-4o",
                  messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: message.body }
                  ],
                  max_tokens: 200,
                  temperature: 0.7,
                });

                const autoResponse = response.choices[0].message.content || 'Lo siento, no pude procesar tu mensaje.';
                
                console.log(`✅ RESPUESTA GENERADA POR ${agentName}: ${autoResponse.substring(0, 50)}...`);
                
                return {
                  success: true,
                  response: autoResponse,
                  agentName: agentName
                };
              }
            }
          }
        } catch (directError) {
          console.error('❌ Error en consulta directa:', directError);
        }
        
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
          id: 'telca-001',
          name: 'Agente de Ventas de Telca Panama',
          agentUrl: 'https://chatgpt.com/g/g-682f9b5208988191b08215b3d8f65333-agente-de-ventas-de-telca-panama',
          context: 'Eres un agente de ventas profesional de Telca Panama. Ayudas con consultas de productos, servicios y procesos de venta.'
        },
        {
          id: 'tecnico-001',
          name: 'Asistente Técnico en Gestión en Campo',
          agentUrl: 'https://chatgpt.com/g/g-682bb98fedf881918e0c4ed5fcf592e4-asistente-tecnico-en-gestion-en-campo',
          context: 'Eres un asistente técnico especializado en gestión en campo. Proporcionas soporte técnico y soluciones para trabajos de campo.'
        }
      ];

      const assignedAgent = defaultAgents.find(agent => agent.id === account.assignedExternalAgentId);

      if (!assignedAgent) {
        console.log(`❌ Agente externo ${account.assignedExternalAgentId} no encontrado`);
        return { success: false };
      }

      console.log(`🤖 Generando respuesta con ${assignedAgent.name}...`);

      // Generar respuesta automática usando OpenAI
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `${assignedAgent.context}

Responde de manera natural y conversacional como si fueras este agente específico. 
Mantén un tono profesional pero amigable, apropiado para WhatsApp.
Si no puedes ayudar con algo específico, ofrece alternativas o sugiere contactar a un humano.`
          },
          {
            role: "user",
            content: message.body
          }
        ],
        max_tokens: 300,
        temperature: 0.7
      });

      const responseText = response.choices[0]?.message?.content;

      if (responseText) {
        console.log(`✅ Respuesta generada por ${assignedAgent.name}: "${responseText.substring(0, 50)}..."`);
        
        return { 
          success: true, 
          response: responseText,
          agentName: assignedAgent.name
        };
      }

      return { success: false };

    } catch (error) {
      console.error('❌ Error en procesamiento automático de mensajes:', error);
      return { success: false };
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