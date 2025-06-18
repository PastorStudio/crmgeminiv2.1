/**
 * Integrador de Mensajes de WhatsApp con Sistema de Respuestas Inteligentes
 * Conecta el sistema existente con el nuevo procesador inteligente
 */

import { realTimeMessageProcessor } from './realTimeMessageProcessor.js';
import { intelligentAutoResponse } from './intelligentAutoResponse.js';

export class WhatsAppMessageIntegrator {
  private initialized = false;

  /**
   * Inicializa el integrador con el sistema existente
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('🔌 Inicializando integrador de mensajes inteligentes...');
    
    // Conectar con el sistema existente de WhatsApp
    this.setupMessageInterception();
    
    this.initialized = true;
    console.log('✅ Integrador de mensajes inteligentes iniciado');
  }

  /**
   * Configura la interceptación de mensajes
   */
  private setupMessageInterception(): void {
    // Interceptar mensajes del cliente WhatsApp existente
    const originalSendMessage = this.patchWhatsAppClient();
    
    // Hook para mensajes entrantes
    this.setupIncomingMessageHook();
  }

  /**
   * Configura hook para mensajes entrantes
   */
  private setupIncomingMessageHook(): void {
    // Integración con el evento de mensaje entrante existente
    if (typeof global !== 'undefined') {
      (global as any).intelligentMessageHandler = async (
        accountId: number,
        message: any
      ) => {
        try {
          await realTimeMessageProcessor.processWhatsAppMessage(
            accountId,
            message.from || message.chatId,
            {
              id: message.id,
              body: message.body,
              from: message.from,
              timestamp: message.timestamp || Date.now() / 1000,
              fromMe: message.fromMe || false,
              hasMedia: message.hasMedia || false,
              mediaType: message.mediaType,
              mediaUrl: message.mediaUrl
            }
          );
        } catch (error) {
          console.error('Error procesando mensaje inteligente:', error);
        }
      };
    }
  }

  /**
   * Parcha el cliente WhatsApp para interceptar mensajes
   */
  private patchWhatsAppClient(): any {
    // Retornar función original si existe
    if ((global as any).originalWhatsAppSendMessage) {
      return (global as any).originalWhatsAppSendMessage;
    }

    // Hook básico para el sistema existente
    return null;
  }

  /**
   * Procesa mensaje manualmente (para testing)
   */
  async processTestMessage(
    accountId: number,
    chatId: string,
    message: string,
    fromNumber: string
  ): Promise<string | null> {
    try {
      const response = await intelligentAutoResponse.processIncomingMessage(
        accountId,
        chatId,
        message,
        fromNumber
      );

      if (response && response.message) {
        await intelligentAutoResponse.sendResponse(accountId, chatId, response.message);
        return response.message;
      }

      return null;
    } catch (error) {
      console.error('Error procesando mensaje de prueba:', error);
      return null;
    }
  }
}

export const whatsappMessageIntegrator = new WhatsAppMessageIntegrator();