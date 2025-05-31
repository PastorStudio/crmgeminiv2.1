/**
 * Integrador de Agentes Externos para Respuestas Automáticas
 * Basado en la guía de integración proporcionada
 */

import axios from 'axios';
import { SimpleExternalAgentManager, WhatsAppAccountConfigManager } from '../externalAgentsSimple';

// Interfaz para request a agente externo
interface ExternalAgentRequest {
  message: string;
  user_id: string;
  context?: any;
}

// Interfaz para respuesta de agente externo
interface ExternalAgentResponse {
  response: string;
  confidence?: number;
  metadata?: any;
}

// Cola de mensajes en memoria (en producción usar Redis)
interface MessageJob {
  id: string;
  accountId: number;
  chatId: string;
  message: string;
  userId: string;
  timestamp: Date;
  retries: number;
}

class ExternalAgentIntegrator {
  private messageQueue: Map<string, MessageJob> = new Map();
  private processing = false;
  private maxRetries = 3;
  private responseTimeout = 30000; // 30 segundos

  /**
   * Procesa un mensaje entrante de WhatsApp y determina si debe enviar respuesta automática
   */
  async processIncomingMessage(
    accountId: number,
    chatId: string,
    message: string,
    fromNumber: string
  ): Promise<boolean> {
    try {
      // Verificar si la cuenta tiene respuestas automáticas habilitadas
      const config = WhatsAppAccountConfigManager.getAccountConfig(accountId);
      
      if (!config || !config.autoResponseEnabled || !config.assignedExternalAgentId) {
        console.log(`⏭️ Respuesta automática deshabilitada para cuenta ${accountId}`);
        return false;
      }

      // Verificar que el agente externo existe y está activo
      const agent = SimpleExternalAgentManager.getAgent(config.assignedExternalAgentId);
      
      if (!agent || !agent.isActive) {
        console.log(`❌ Agente externo ${config.assignedExternalAgentId} no disponible`);
        return false;
      }

      console.log(`🤖 Procesando mensaje para agente: ${agent.name}`);

      // Crear job de procesamiento
      const jobId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const job: MessageJob = {
        id: jobId,
        accountId,
        chatId,
        message,
        userId: fromNumber,
        timestamp: new Date(),
        retries: 0
      };

      // Agregar a la cola
      this.messageQueue.set(jobId, job);

      // Procesar de forma asíncrona
      this.processQueueAsync();

      return true;
    } catch (error) {
      console.error('❌ Error procesando mensaje entrante:', error);
      return false;
    }
  }

  /**
   * Procesa la cola de mensajes de forma asíncrona
   */
  private async processQueueAsync(): Promise<void> {
    if (this.processing) return;
    
    this.processing = true;

    try {
      for (const [jobId, job] of Array.from(this.messageQueue.entries())) {
        try {
          await this.processJob(job);
          this.messageQueue.delete(jobId);
        } catch (error) {
          console.error(`❌ Error procesando job ${jobId}:`, error);
          
          // Reintentar hasta maxRetries
          job.retries++;
          if (job.retries >= this.maxRetries) {
            console.error(`❌ Job ${jobId} falló después de ${this.maxRetries} intentos`);
            this.messageQueue.delete(jobId);
          }
        }
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Procesa un job individual
   */
  private async processJob(job: MessageJob): Promise<void> {
    const config = WhatsAppAccountConfigManager.getAccountConfig(job.accountId);
    if (!config || !config.assignedExternalAgentId) return;

    const agent = SimpleExternalAgentManager.getAgent(config.assignedExternalAgentId);
    if (!agent) return;

    console.log(`🔄 Consultando agente ${agent.name} para mensaje: "${job.message.substring(0, 50)}..."`);

    // Simular delay configurado
    await this.delay(config.responseDelay * 1000);

    // Obtener respuesta del agente externo
    const response = await this.callExternalAgent(agent.agentUrl, job.message, job.userId);

    if (response) {
      console.log(`✅ Respuesta obtenida de ${agent.name}: "${response.substring(0, 50)}..."`);
      
      // Enviar respuesta a través de WhatsApp
      await this.sendWhatsAppResponse(job.accountId, job.chatId, response);
      
      // Incrementar contador de respuestas
      SimpleExternalAgentManager.updateAgent(agent.id, {
        responseCount: agent.responseCount + 1
      });
    }
  }

  /**
   * Llama al agente externo para obtener respuesta
   */
  private async callExternalAgent(
    agentUrl: string,
    message: string,
    userId: string
  ): Promise<string | null> {
    try {
      // Para ChatGPT Custom GPTs, necesitamos una implementación especial
      // En este caso, usamos una aproximación con llamada a API compatible
      
      if (agentUrl.includes('chatgpt.com/g/')) {
        // Para GPTs de ChatGPT, necesitamos extraer el ID y usar API de OpenAI
        return await this.callChatGPTAgent(agentUrl, message);
      }
      
      // Para otros tipos de agentes con API REST estándar
      return await this.callGenericAgent(agentUrl, message, userId);
      
    } catch (error) {
      console.error('❌ Error llamando agente externo:', error);
      return null;
    }
  }

  /**
   * Llama a agente ChatGPT personalizado
   */
  private async callChatGPTAgent(agentUrl: string, message: string): Promise<string | null> {
    try {
      // Verificar si hay clave API de OpenAI configurada
      const openaiKey = process.env.OPENAI_API_KEY;
      
      if (!openaiKey) {
        console.warn('⚠️ No hay clave OpenAI configurada para agentes ChatGPT');
        return this.generateFallbackResponse(message);
      }

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'Eres un asistente útil que responde preguntas de manera profesional y amigable.'
            },
            {
              role: 'user',
              content: message
            }
          ],
          max_tokens: 500,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: this.responseTimeout
        }
      );

      return response.data.choices[0]?.message?.content || null;
    } catch (error) {
      console.error('❌ Error con API de OpenAI:', error);
      return this.generateFallbackResponse(message);
    }
  }

  /**
   * Llama a agente con API REST genérica
   */
  private async callGenericAgent(
    agentUrl: string,
    message: string,
    userId: string
  ): Promise<string | null> {
    try {
      const response = await axios.post(
        agentUrl,
        {
          message,
          user_id: userId,
          timestamp: new Date().toISOString()
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'WhatsApp-CRM-Integration/1.0'
          },
          timeout: this.responseTimeout
        }
      );

      return response.data.response || response.data.message || null;
    } catch (error) {
      console.error('❌ Error con agente genérico:', error);
      return null;
    }
  }

  /**
   * Genera respuesta de respaldo cuando el agente externo no está disponible
   */
  private generateFallbackResponse(message: string): string {
    const fallbackResponses = [
      'Gracias por tu mensaje. Un agente humano te contactará pronto.',
      'Hemos recibido tu consulta. Te responderemos a la brevedad.',
      'Tu mensaje es importante para nosotros. En breve te daremos una respuesta.',
      'Gracias por contactarnos. Un especialista revisará tu mensaje.'
    ];

    return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
  }

  /**
   * Envía respuesta a través de WhatsApp
   */
  private async sendWhatsAppResponse(
    accountId: number,
    chatId: string,
    message: string
  ): Promise<void> {
    try {
      // Importar dinámicamente para evitar dependencias circulares
      const { whatsappMultiAccountManager } = await import('./whatsappMultiAccountManager');
      
      await whatsappMultiAccountManager.sendMessage(accountId, chatId, message);
      console.log(`📤 Respuesta automática enviada a ${chatId} desde cuenta ${accountId}`);
      
    } catch (error) {
      console.error('❌ Error enviando respuesta WhatsApp:', error);
    }
  }

  /**
   * Utilidad para delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtiene estadísticas del integrador
   */
  getStats() {
    return {
      queueSize: this.messageQueue.size,
      processing: this.processing,
      totalAgents: SimpleExternalAgentManager.getAllAgents().length,
      activeConfigs: WhatsAppAccountConfigManager.getAllConfigs().filter(c => c.autoResponseEnabled).length
    };
  }

  /**
   * Habilita respuesta automática para una cuenta
   */
  enableAutoResponse(accountId: number, agentId: string, delay: number = 3): boolean {
    try {
      const agent = SimpleExternalAgentManager.getAgent(agentId);
      if (!agent) {
        console.error(`❌ Agente ${agentId} no encontrado`);
        return false;
      }

      WhatsAppAccountConfigManager.assignAgent(accountId, agentId, true);
      console.log(`✅ Respuesta automática habilitada para cuenta ${accountId} con agente ${agent.name}`);
      return true;
    } catch (error) {
      console.error('❌ Error habilitando respuesta automática:', error);
      return false;
    }
  }

  /**
   * Deshabilita respuesta automática para una cuenta
   */
  disableAutoResponse(accountId: number): boolean {
    try {
      WhatsAppAccountConfigManager.assignAgent(accountId, null, false);
      console.log(`✅ Respuesta automática deshabilitada para cuenta ${accountId}`);
      return true;
    } catch (error) {
      console.error('❌ Error deshabilitando respuesta automática:', error);
      return false;
    }
  }
}

// Exportar instancia singleton
export const externalAgentIntegrator = new ExternalAgentIntegrator();