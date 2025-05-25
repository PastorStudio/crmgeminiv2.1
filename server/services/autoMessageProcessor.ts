/**
 * Servicio para procesar mensajes entrantes automáticamente
 * Detecta mensajes recibidos y los envía a agentes externos para generar respuestas
 */
import { db } from '../db';
import { externalAgents, autoResponseConfig } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

interface IncomingMessage {
  id: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  chatId: string;
  accountId: number;
  contactName?: string;
  contactPhone?: string;
}

class AutoMessageProcessor {
  private processedMessages = new Set<string>();
  private isProcessing = false;

  /**
   * Procesa un mensaje entrante y genera respuesta automática si está configurado
   */
  async processIncomingMessage(message: IncomingMessage): Promise<void> {
    try {
      // No procesar mensajes propios
      if (message.fromMe) {
        console.log('🔄 Mensaje propio, no procesando:', message.id);
        return;
      }

      // Evitar procesamiento duplicado
      if (this.processedMessages.has(message.id)) {
        console.log('🔄 Mensaje ya procesado:', message.id);
        return;
      }

      console.log('🤖 Procesando mensaje entrante:', {
        messageId: message.id,
        chatId: message.chatId,
        accountId: message.accountId,
        body: message.body.substring(0, 50) + '...'
      });

      // Marcar como procesado
      this.processedMessages.add(message.id);

      // Verificar configuración de respuestas automáticas para esta cuenta
      const autoConfig = await this.getAutoResponseConfig(message.accountId);
      if (!autoConfig || !autoConfig.enabled) {
        console.log('🔄 Respuestas automáticas deshabilitadas para cuenta:', message.accountId);
        return;
      }

      // Obtener agente externo asignado a esta cuenta
      const assignedAgent = await this.getAssignedAgent(message.accountId);
      if (!assignedAgent) {
        console.log('🔄 No hay agente asignado para cuenta:', message.accountId);
        return;
      }

      console.log('✅ Agente encontrado para procesamiento:', assignedAgent.name);

      // Generar respuesta usando el agente externo
      const response = await this.generateAgentResponse(assignedAgent.id, message.body, message.contactName);
      if (!response) {
        console.log('❌ No se pudo generar respuesta con agente:', assignedAgent.name);
        return;
      }

      // Enviar respuesta automática
      await this.sendAutoResponse(message.accountId, message.chatId, response);

      console.log('✅ Respuesta automática enviada exitosamente');

    } catch (error) {
      console.error('❌ Error procesando mensaje entrante:', error);
    }
  }

  /**
   * Obtiene la configuración de respuestas automáticas para una cuenta
   */
  private async getAutoResponseConfig(accountId: number) {
    try {
      const [config] = await db
        .select()
        .from(autoResponseConfig)
        .where(eq(autoResponseConfig.accountId, accountId));
      
      return config || null;
    } catch (error) {
      console.error('❌ Error obteniendo configuración de respuestas automáticas:', error);
      return null;
    }
  }

  /**
   * Obtiene el agente externo asignado a una cuenta
   */
  private async getAssignedAgent(accountId: number) {
    try {
      const [agent] = await db
        .select()
        .from(externalAgents)
        .where(and(
          eq(externalAgents.accountId, accountId),
          eq(externalAgents.isActive, true)
        ));
      
      return agent || null;
    } catch (error) {
      console.error('❌ Error obteniendo agente asignado:', error);
      return null;
    }
  }

  /**
   * Genera respuesta usando agente externo
   */
  private async generateAgentResponse(agentId: string, message: string, contactName: string = 'Cliente'): Promise<string | null> {
    try {
      const response = await fetch('http://localhost:5000/api/external-agents/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId: agentId,
          message: message,
          context: `Conversación de WhatsApp con ${contactName}`
        })
      });

      if (!response.ok) {
        console.error('❌ Error en API de agentes externos:', response.statusText);
        return null;
      }

      const data = await response.json();
      
      if (data.success && data.response) {
        console.log('✅ Respuesta generada por agente:', data.response.substring(0, 100) + '...');
        return data.response;
      }

      return null;
    } catch (error) {
      console.error('❌ Error generando respuesta con agente externo:', error);
      return null;
    }
  }

  /**
   * Envía respuesta automática al chat
   */
  private async sendAutoResponse(accountId: number, chatId: string, message: string): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:5000/api/whatsapp-accounts/${accountId}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: chatId,
          message: message,
          isAutoResponse: true
        })
      });

      if (!response.ok) {
        console.error('❌ Error enviando respuesta automática:', response.statusText);
        return false;
      }

      console.log('✅ Respuesta automática enviada exitosamente');
      return true;
    } catch (error) {
      console.error('❌ Error enviando respuesta automática:', error);
      return false;
    }
  }

  /**
   * Inicia el monitoreo de mensajes para procesamiento automático
   */
  startMonitoring(): void {
    console.log('🚀 Iniciando monitoreo de mensajes para respuestas automáticas');
    
    // Limpiar mensajes procesados cada 24 horas para evitar memoria infinita
    setInterval(() => {
      this.processedMessages.clear();
      console.log('🧹 Cache de mensajes procesados limpiado');
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Procesa mensajes en lote (para mensajes detectados por polling)
   */
  async processBatchMessages(messages: IncomingMessage[]): Promise<void> {
    if (this.isProcessing) {
      console.log('🔄 Ya hay un procesamiento en curso, saltando...');
      return;
    }

    this.isProcessing = true;
    
    try {
      // Filtrar solo mensajes entrantes (no propios)
      const incomingMessages = messages.filter(msg => !msg.fromMe);
      
      if (incomingMessages.length === 0) {
        return;
      }

      console.log(`🔄 Procesando lote de ${incomingMessages.length} mensajes entrantes`);

      // Procesar mensajes secuencialmente para evitar saturación
      for (const message of incomingMessages) {
        await this.processIncomingMessage(message);
        
        // Pequeña pausa entre mensajes para no saturar las APIs
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } finally {
      this.isProcessing = false;
    }
  }
}

// Exportar instancia singleton
export const autoMessageProcessor = new AutoMessageProcessor();

// Auto-inicializar
autoMessageProcessor.startMonitoring();