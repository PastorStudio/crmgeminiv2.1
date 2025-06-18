/**
 * Procesador de Mensajes en Tiempo Real
 * Integra el sistema inteligente de respuestas automáticas con WhatsApp
 */

import { intelligentAutoResponse } from './intelligentAutoResponse.js';
import { db } from '../db.js';
import { whatsappMessages, whatsappAccounts } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

export class RealTimeMessageProcessor {
  private processingQueue = new Map<string, boolean>();

  /**
   * Procesa mensaje entrante de WhatsApp en tiempo real
   */
  async processWhatsAppMessage(
    accountId: number,
    chatId: string,
    messageData: {
      id: string;
      body: string;
      from: string;
      timestamp: number;
      fromMe: boolean;
      hasMedia?: boolean;
      mediaType?: string;
      mediaUrl?: string;
    }
  ): Promise<void> {
    const messageKey = `${accountId}_${chatId}_${messageData.id}`;
    
    // Evitar procesamiento duplicado
    if (this.processingQueue.has(messageKey)) return;
    this.processingQueue.set(messageKey, true);

    try {
      // Guardar mensaje en base de datos
      await this.saveMessage(accountId, chatId, messageData);

      // Solo procesar mensajes entrantes (no enviados por nosotros)
      if (!messageData.fromMe && messageData.body?.trim()) {
        await this.handleIncomingMessage(accountId, chatId, messageData);
      }
    } catch (error) {
      console.error('Error procesando mensaje WhatsApp:', error);
    } finally {
      this.processingQueue.delete(messageKey);
    }
  }

  /**
   * Guarda mensaje en base de datos
   */
  private async saveMessage(
    accountId: number,
    chatId: string,
    messageData: any
  ): Promise<void> {
    try {
      await db.insert(whatsappMessages).values({
        chatId,
        messageId: messageData.id,
        content: messageData.body || '',
        from_me: messageData.fromMe || false,
        timestamp: new Date(messageData.timestamp * 1000)
        metadata: {
          originalData: messageData
        }
      }).onConflictDoNothing();
    } catch (error) {
      console.error('Error guardando mensaje:', error);
    }
  }

  /**
   * Maneja mensaje entrante y genera respuesta si es necesario
   */
  private async handleIncomingMessage(
    accountId: number,
    chatId: string,
    messageData: any
  ): Promise<void> {
    try {
      console.log(`📨 Procesando mensaje entrante - Cuenta: ${accountId}, Chat: ${chatId}`);
      
      // Verificar si la cuenta tiene respuestas automáticas habilitadas
      const account = await db
        .select({
          autoResponseEnabled: whatsappAccounts.autoResponseEnabled,
          name: whatsappAccounts.name
        })
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.id, accountId))
        .limit(1);

      if (!account.length || !account[0].autoResponseEnabled) {
        console.log(`⏸️ Respuestas automáticas deshabilitadas para cuenta ${accountId}`);
        return;
      }

      // Procesar con sistema inteligente
      const response = await intelligentAutoResponse.processIncomingMessage(
        accountId,
        chatId,
        messageData.body,
        messageData.from
      );

      if (response && response.message) {
        console.log(`🤖 Generando respuesta automática inteligente...`);
        
        // Enviar respuesta
        const sent = await intelligentAutoResponse.sendResponse(
          accountId,
          chatId,
          response.message
        );

        if (sent) {
          console.log(`✅ Respuesta enviada automáticamente - Confianza: ${response.confidence}`);
          
          // Si necesita intervención humana, marcar para seguimiento
          if (response.needsHumanIntervention) {
            console.log(`👤 Marcando conversación para intervención humana`);
            await this.flagForHumanIntervention(accountId, chatId, messageData.from);
          }
        }
      }
    } catch (error) {
      console.error('Error manejando mensaje entrante:', error);
    }
  }

  /**
   * Marca conversación para intervención humana
   */
  private async flagForHumanIntervention(
    accountId: number,
    chatId: string,
    fromNumber: string
  ): Promise<void> {
    try {
      // Aquí se puede integrar con el sistema de tickets o notificaciones
      console.log(`🚨 Conversación ${chatId} requiere atención humana`);
      
      // Emitir evento para notificar al dashboard
      const notificationData = {
        type: 'human_intervention_required',
        accountId,
        chatId,
        fromNumber,
        timestamp: new Date().toISOString()
      };

      // Enviar notificación WebSocket si está disponible
      if ((global as any).notificationService) {
        (global as any).notificationService.broadcast('chat_intervention', notificationData);
      }
    } catch (error) {
      console.error('Error marcando para intervención:', error);
    }
  }

  /**
   * Inicia monitoreo de mensajes para una cuenta específica
   */
  async startMonitoring(accountId: number): Promise<void> {
    console.log(`🔄 Iniciando monitoreo inteligente para cuenta ${accountId}`);
    
    // El monitoreo real se integra con el cliente WhatsApp existente
    // Este método se llama cuando se inicializa una cuenta
  }
}

export const realTimeMessageProcessor = new RealTimeMessageProcessor();