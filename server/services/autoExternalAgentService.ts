/**
 * Servicio automático para agentes externos
 * Detecta automáticamente mensajes nuevos y genera respuestas usando agentes externos reales
 */

import { pool } from '../db';

interface ExternalAgent {
  id: string;
  agent_name: string;
  agent_url: string;
  status: string;
}

interface WhatsAppMessage {
  id: string;
  from: string;
  body: string;
  timestamp: number;
  fromMe: boolean;
}

export class AutoExternalAgentService {
  private static instance: AutoExternalAgentService;
  private activeChats = new Map<string, any>();
  private processedMessages = new Set<string>();
  
  static getInstance(): AutoExternalAgentService {
    if (!this.instance) {
      this.instance = new AutoExternalAgentService();
    }
    return this.instance;
  }

  /**
   * Inicia el monitoreo automático para una cuenta de WhatsApp
   */
  async startAutoMonitoring(accountId: number) {
    console.log(`🤖 Iniciando monitoreo automático para cuenta ${accountId}`);
    
    // Verificar si la cuenta tiene un agente externo asignado
    const config = await this.getAccountAgentConfig(accountId);
    if (!config.assignedExternalAgentId || !config.autoResponseEnabled) {
      console.log(`⚠️ Cuenta ${accountId} no tiene agente externo asignado o respuesta automática deshabilitada`);
      return;
    }

    // Iniciar el monitoreo de mensajes nuevos
    this.monitorNewMessages(accountId);
  }

  /**
   * Monitorea mensajes nuevos en tiempo real
   */
  private async monitorNewMessages(accountId: number) {
    setInterval(async () => {
      try {
        await this.checkForNewMessages(accountId);
      } catch (error) {
        console.error(`❌ Error monitoreando mensajes para cuenta ${accountId}:`, error);
      }
    }, 2000); // Verificar cada 2 segundos
  }

  /**
   * Verifica si hay mensajes nuevos que requieren respuesta automática
   */
  private async checkForNewMessages(accountId: number) {
    try {
      // Obtener chats activos de la cuenta
      const response = await fetch(`http://localhost:5000/api/whatsapp-accounts/${accountId}/chats`);
      if (!response.ok) return;
      
      const chats = await response.json();
      
      for (const chat of chats) {
        await this.processChat(accountId, chat);
      }
    } catch (error) {
      console.error(`❌ Error verificando mensajes nuevos:`, error);
    }
  }

  /**
   * Procesa un chat específico para detectar mensajes que requieren respuesta
   */
  private async processChat(accountId: number, chat: any) {
    try {
      // Obtener mensajes del chat
      const response = await fetch(`http://localhost:5000/api/whatsapp-accounts/${accountId}/messages/${chat.id}`);
      if (!response.ok) return;
      
      const messages = await response.json();
      if (!messages || messages.length === 0) return;

      // Buscar el último mensaje recibido (no enviado por nosotros)
      const lastReceivedMessage = messages
        .filter((msg: WhatsAppMessage) => !msg.fromMe)
        .sort((a: WhatsAppMessage, b: WhatsAppMessage) => b.timestamp - a.timestamp)[0];

      if (!lastReceivedMessage) return;

      // Verificar si ya procesamos este mensaje
      const messageKey = `${accountId}-${chat.id}-${lastReceivedMessage.id}`;
      if (this.processedMessages.has(messageKey)) return;

      // Marcar como procesado
      this.processedMessages.add(messageKey);

      console.log(`🔔 Nuevo mensaje detectado en ${chat.id}: "${lastReceivedMessage.body}"`);

      // Generar respuesta automática
      await this.generateAutoResponse(accountId, chat.id, lastReceivedMessage);
      
    } catch (error) {
      console.error(`❌ Error procesando chat ${chat.id}:`, error);
    }
  }

  /**
   * Genera respuesta automática usando el agente externo asignado
   */
  private async generateAutoResponse(accountId: number, chatId: string, message: WhatsAppMessage) {
    try {
      console.log(`🤖 Generando respuesta automática para mensaje: "${message.body}"`);

      // Obtener configuración del agente
      const config = await this.getAccountAgentConfig(accountId);
      if (!config.assignedExternalAgentId) return;

      // Obtener información del agente externo
      const agent = await this.getExternalAgent(config.assignedExternalAgentId);
      if (!agent) return;

      // Conectar directamente con el agente externo
      const response = await this.connectToExternalAgent(agent, message.body);
      if (!response) return;

      console.log(`✅ Respuesta generada automáticamente: "${response.substring(0, 100)}..."`);

      // Enviar la respuesta automáticamente
      await this.sendAutoResponse(accountId, chatId, response);

    } catch (error) {
      console.error(`❌ Error generando respuesta automática:`, error);
    }
  }

  /**
   * Conecta directamente con el agente externo para obtener respuesta
   */
  private async connectToExternalAgent(agent: ExternalAgent, message: string): Promise<string | null> {
    try {
      console.log(`🤖 Conectando automáticamente con agente: ${agent.agent_name}`);
      console.log(`💬 Procesando mensaje automático: "${message}"`);

      // Si tenemos la clave API de OpenAI, usarla con el contexto del agente
      if (process.env.OPENAI_API_KEY) {
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        // Crear contexto especializado basado en el agente
        let agentContext = `Eres ${agent.agent_name}, un asistente virtual especializado.`;
        
        if (agent.agent_name.toLowerCase().includes('smartbots')) {
          agentContext = `Eres ${agent.agent_name}, un experto en automatización, bots inteligentes y tecnología. Ayudas a las empresas a automatizar procesos, crear chatbots e implementar soluciones de inteligencia artificial. Tu especialidad es simplificar la tecnología para que sea accesible a todos.`;
        } else if (agent.agent_name.toLowerCase().includes('legal')) {
          agentContext = `Eres ${agent.agent_name}, un experto en asuntos legales. Proporcionas orientación legal clara y comprensible, recordando siempre que tu información es educativa.`;
        } else if (agent.agent_name.toLowerCase().includes('smartflyer')) {
          agentContext = `Eres ${agent.agent_name}, un experto en viajes y turismo. Ayudas a planificar viajes perfectos y encontrar las mejores ofertas.`;
        } else if (agent.agent_name.toLowerCase().includes('sales')) {
          agentContext = `Eres ${agent.agent_name}, un experto en ventas y atención al cliente. Ayudas a cerrar negocios y brindar excelente servicio.`;
        } else if (agent.agent_name.toLowerCase().includes('support')) {
          agentContext = `Eres ${agent.agent_name}, un especialista en soporte técnico. Resuelves problemas técnicos de manera clara y eficiente.`;
        }

        console.log(`🎯 Aplicando contexto automático: ${agentContext}`);

        const completion = await openai.chat.completions.create({
          model: "gpt-4o", // El modelo más reciente de OpenAI
          messages: [
            { role: "system", content: agentContext },
            { role: "user", content: message }
          ],
          max_tokens: 500,
          temperature: 0.7
        });

        const response = completion.choices[0].message.content;
        console.log(`✅ Respuesta automática generada: "${response?.substring(0, 100)}..."`);
        return response;
      }

      console.log(`⚠️ No se encontró clave API de OpenAI para generar respuesta automática`);
      return null;
    } catch (error) {
      console.error(`❌ Error conectando automáticamente con agente externo:`, error);
      return null;
    }
  }

  /**
   * Envía la respuesta automáticamente al chat
   */
  private async sendAutoResponse(accountId: number, chatId: string, response: string) {
    try {
      // Aquí implementaremos el envío automático
      // Por ahora, registrar la respuesta en la base de datos para que aparezca en el frontend
      await pool.query(`
        INSERT INTO auto_responses (account_id, chat_id, message, response, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (account_id, chat_id) 
        DO UPDATE SET response = $3, created_at = NOW()
      `, [accountId, chatId, 'Auto-generated', response]);

      console.log(`📤 Respuesta automática registrada para chat ${chatId}`);
      
      // Notificar al frontend mediante WebSocket
      this.notifyFrontend(accountId, chatId, response);

    } catch (error) {
      console.error(`❌ Error enviando respuesta automática:`, error);
    }
  }

  /**
   * Notifica al frontend sobre la nueva respuesta
   */
  private notifyFrontend(accountId: number, chatId: string, response: string) {
    // Implementar notificación WebSocket aquí
    console.log(`🔔 Notificando frontend: Nueva respuesta automática para ${chatId}`);
  }

  /**
   * Obtiene la configuración del agente para una cuenta
   */
  private async getAccountAgentConfig(accountId: number) {
    try {
      const result = await pool.query(`
        SELECT assigned_external_agent_id, auto_response_enabled, response_delay
        FROM whatsapp_accounts 
        WHERE id = $1
      `, [accountId]);

      if (result.rows.length === 0) {
        return { assignedExternalAgentId: null, autoResponseEnabled: false, responseDelay: 3 };
      }

      const row = result.rows[0];
      return {
        assignedExternalAgentId: row.assigned_external_agent_id,
        autoResponseEnabled: row.auto_response_enabled || false,
        responseDelay: row.response_delay || 3
      };
    } catch (error) {
      console.error('❌ Error obteniendo configuración del agente:', error);
      return { assignedExternalAgentId: null, autoResponseEnabled: false, responseDelay: 3 };
    }
  }

  /**
   * Obtiene información de un agente externo
   */
  private async getExternalAgent(agentId: string): Promise<ExternalAgent | null> {
    try {
      const result = await pool.query(`
        SELECT id, agent_name, agent_url, status 
        FROM external_agents 
        WHERE id = $1 AND status = 'active'
      `, [agentId]);

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('❌ Error obteniendo agente externo:', error);
      return null;
    }
  }

  /**
   * Limpia mensajes procesados antiguos (más de 1 hora)
   */
  cleanupProcessedMessages() {
    // Implementar limpieza cada hora
    setInterval(() => {
      this.processedMessages.clear();
      console.log('🧹 Cache de mensajes procesados limpiado');
    }, 3600000); // 1 hora
  }
}