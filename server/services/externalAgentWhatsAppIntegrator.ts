/**
 * Integrador de Agentes Externos con WhatsApp
 * Conecta automáticamente los agentes externos con las cuentas de WhatsApp
 * para generar respuestas usando OpenAI cuando están activos
 */

import { db } from '../db';
import { whatsappAccounts, externalAgents } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

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

export class ExternalAgentWhatsAppIntegrator {
  
  /**
   * Procesa un mensaje entrante y genera respuesta con agente externo si está configurado
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
        return { success: false };
      }

      // Obtener el agente externo asignado
      const [agent] = await db
        .select()
        .from(externalAgents)
        .where(eq(externalAgents.id, parseInt(account.assignedExternalAgentId)))
        .limit(1);

      if (!agent || agent.status !== 'active') {
        console.log(`❌ Agente externo ${account.assignedExternalAgentId} no encontrado o inactivo`);
        return { success: false };
      }

      console.log(`🤖 Generando respuesta con agente externo: ${agent.agentName}`);

      // Generar respuesta usando OpenAI con el contexto del agente
      const response = await this.generateResponseWithOpenAI(agent.agentName, message.body);

      if (response) {
        console.log(`✅ Respuesta generada exitosamente: "${response.substring(0, 50)}..."`);
        
        // Actualizar contador de respuestas del agente
        await db
          .update(externalAgents)
          .set({ 
            responseCount: (agent.responseCount || 0) + 1,
            lastUsed: new Date()
          })
          .where(eq(externalAgents.id, agent.id));

        return { 
          success: true, 
          response, 
          agentName: agent.agentName 
        };
      }

      return { success: false };

    } catch (error) {
      console.error('❌ Error procesando mensaje con agente externo:', error);
      return { success: false };
    }
  }

  /**
   * Genera respuesta usando la configuración AI personalizada guardada
   */
  private async generateResponseWithOpenAI(agentName: string, message: string): Promise<string | null> {
    try {
      console.log(`🎯 Generando respuesta con configuración AI personalizada para ${agentName}`);

      // Intentar usar el servicio de respuestas inteligentes con configuración personalizada
      try {
        const { intelligentResponseService } = await import('./intelligentResponseService');
        
        const intelligentResponse = await intelligentResponseService.generateResponse({
          chatId: 'auto-response-chat',
          accountId: 1, // Dinámicamente obtenible si es necesario
          userMessage: message,
          customerName: agentName
        });

        if (intelligentResponse && intelligentResponse.message) {
          console.log(`✅ Respuesta generada con ${intelligentResponse.provider} usando prompt personalizado`);
          return intelligentResponse.message;
        }
      } catch (intelligentError) {
        console.log('⚠️ Configuración AI personalizada no disponible, usando fallback:', intelligentError.message);
      }

      // Fallback: OpenAI directo si no hay configuración personalizada
      if (!process.env.OPENAI_API_KEY) {
        console.error('❌ OPENAI_API_KEY no configurada');
        return null;
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY 
      });

      // Crear contexto específico según el agente (fallback)
      const agentContext = this.getAgentContext(agentName);

      console.log(`🎯 Enviando a OpenAI con contexto fallback de ${agentName}`);

      const completion = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: agentContext
          },
          {
            role: "user",
            content: message
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      return completion.choices[0].message.content;

    } catch (error) {
      console.error('❌ Error generando respuesta:', error);
      return null;
    }
  }

  /**
   * Obtiene el contexto específico para cada tipo de agente
   */
  private getAgentContext(agentName: string): string {
    const name = agentName.toLowerCase();
    
    if (name.includes('smartbots')) {
      return `Eres ${agentName}, un experto en automatización, bots inteligentes y tecnología para WhatsApp. Ayudas a las empresas a automatizar procesos, crear chatbots y implementar soluciones de inteligencia artificial. Tu especialidad es simplificar la tecnología para que sea accesible a todos. Responde de manera profesional, útil y amigable a las consultas de WhatsApp.`;
    } else if (name.includes('smartflyer')) {
      return `Eres ${agentName}, un experto en viajes, aerolíneas y turismo especializado en WhatsApp. Ayudas a las personas a planificar viajes perfectos, encontrar las mejores ofertas de vuelos, recomendar destinos y resolver cualquier consulta relacionada con viajes. Responde de manera profesional y entusiasta.`;
    } else if (name.includes('smartplanner')) {
      return `Eres ${agentName}, un experto en planificación, organización y productividad para WhatsApp. Tu misión es ayudar a las personas a organizar sus tareas, proyectos y tiempo de manera eficiente para maximizar su productividad. Responde de manera estructurada y práctica.`;
    } else if (name.includes('agente') && name.includes('ventas')) {
      return `Eres ${agentName}, un especialista en ventas de telecomunicaciones en Panamá via WhatsApp. Conoces a fondo los productos, servicios y planes de TELCA Panamá. Tu objetivo es ayudar a los clientes a encontrar las mejores soluciones de telecomunicaciones para sus necesidades. Responde de manera comercial pero no agresiva.`;
    } else if (name.includes('asistente') && name.includes('tecnico')) {
      return `Eres ${agentName}, un especialista en gestión técnica de campo via WhatsApp. Tu experiencia incluye mantenimiento técnico, soporte operativo y gestión de equipos en campo. Ayudas a resolver problemas técnicos y optimizar operaciones. Responde de manera técnica pero clara.`;
    } else {
      return `Eres ${agentName}, un asistente virtual inteligente y profesional especializado en WhatsApp. Estás aquí para ayudar con cualquier consulta de manera efectiva, amigable y profesional. Siempre mantén un tono conversacional apropiado para WhatsApp.`;
    }
  }

  /**
   * Verifica si una cuenta tiene agente externo activo
   */
  async hasActiveExternalAgent(accountId: number): Promise<boolean> {
    try {
      const [account] = await db
        .select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.id, accountId))
        .limit(1);

      return !!(account?.assignedExternalAgentId && account.autoResponseEnabled);
    } catch (error) {
      console.error('Error verificando agente externo activo:', error);
      return false;
    }
  }

  /**
   * Obtiene información del agente externo activo para una cuenta
   */
  async getActiveExternalAgent(accountId: number): Promise<{ agentName: string; agentUrl: string } | null> {
    try {
      const [account] = await db
        .select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.id, accountId))
        .limit(1);

      if (!account?.assignedExternalAgentId || !account.autoResponseEnabled) {
        return null;
      }

      const [agent] = await db
        .select()
        .from(externalAgents)
        .where(eq(externalAgents.id, parseInt(account.assignedExternalAgentId)))
        .limit(1);

      if (!agent || agent.status !== 'active') {
        return null;
      }

      return {
        agentName: agent.agentName,
        agentUrl: agent.agentUrl
      };
    } catch (error) {
      console.error('Error obteniendo agente externo activo:', error);
      return null;
    }
  }
}

export const externalAgentWhatsAppIntegrator = new ExternalAgentWhatsAppIntegrator();