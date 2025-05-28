/**
 * Sistema de respuestas automáticas reales
 * Detecta mensajes nuevos y genera respuestas automáticamente sin intervención humana
 */

import OpenAI from 'openai';
import { whatsappMultiAccountManager } from './whatsappMultiAccountManager';
import { db } from '../db';
import { whatsappAccounts } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Configurar OpenAI con la clave del sistema
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY
});

interface AutoResponseConfig {
  accountId: number;
  agentName: string;
  enabled: boolean;
  lastProcessedMessageId?: string;
}

class RealAutoResponseManager {
  private configs = new Map<number, AutoResponseConfig>();
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  /**
   * Activa respuestas automáticas para una cuenta
   */
  activateAutoResponse(accountId: number, agentName: string = "Smart Assistant"): boolean {
    try {
      console.log(`🤖 Activando respuestas automáticas para cuenta ${accountId} con agente: ${agentName}`);
      
      this.configs.set(accountId, {
        accountId,
        agentName,
        enabled: true
      });

      if (!this.isRunning) {
        this.startMonitoring();
      }

      console.log(`✅ Respuestas automáticas ACTIVADAS para cuenta ${accountId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error activando respuestas automáticas:`, error);
      return false;
    }
  }

  /**
   * Desactiva respuestas automáticas para una cuenta
   */
  deactivateAutoResponse(accountId: number): boolean {
    try {
      console.log(`🛑 Desactivando respuestas automáticas para cuenta ${accountId}`);
      
      this.configs.delete(accountId);

      if (this.configs.size === 0) {
        this.stopMonitoring();
      }

      console.log(`✅ Respuestas automáticas DESACTIVADAS para cuenta ${accountId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error desactivando respuestas automáticas:`, error);
      return false;
    }
  }

  /**
   * Inicia el monitoreo automático de mensajes
   */
  private startMonitoring(): void {
    if (this.isRunning) return;

    console.log('🚀 Iniciando monitoreo automático de mensajes...');
    this.isRunning = true;

    this.intervalId = setInterval(async () => {
      await this.checkForNewMessages();
    }, 3000); // Revisar cada 3 segundos

    console.log('✅ Monitoreo automático iniciado');
  }

  /**
   * Detiene el monitoreo automático
   */
  private stopMonitoring(): void {
    if (!this.isRunning) return;

    console.log('🛑 Deteniendo monitoreo automático...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    console.log('✅ Monitoreo automático detenido');
  }

  /**
   * Revisa si hay mensajes nuevos en todas las cuentas activas
   */
  private async checkForNewMessages(): Promise<void> {
    for (const [accountId, config] of this.configs) {
      if (!config.enabled) continue;

      try {
        await this.processAccountMessages(accountId, config);
      } catch (error) {
        console.error(`❌ Error procesando cuenta ${accountId}:`, error);
      }
    }
  }

  /**
   * Procesa mensajes de una cuenta específica
   */
  private async processAccountMessages(accountId: number, config: AutoResponseConfig): Promise<void> {
    try {
      // Obtener chats activos
      const chats = await whatsappMultiAccountManager.getChats(accountId);
      
      for (const chat of chats) {
        await this.processChatMessages(accountId, chat.id, config);
      }
    } catch (error) {
      console.error(`❌ Error obteniendo chats de cuenta ${accountId}:`, error);
    }
  }

  /**
   * Procesa mensajes de un chat específico
   */
  private async processChatMessages(accountId: number, chatId: string, config: AutoResponseConfig): Promise<void> {
    try {
      // Obtener mensajes del chat
      const messages = await whatsappMultiAccountManager.getMessages(accountId, chatId);
      
      if (!messages || messages.length === 0) return;

      // Buscar el último mensaje recibido (no enviado por nosotros)
      const lastIncomingMessage = messages
        .filter(msg => !msg.fromMe && msg.type === 'chat')
        .sort((a, b) => b.timestamp - a.timestamp)[0];

      if (!lastIncomingMessage) return;

      // Verificar si ya procesamos este mensaje
      const messageKey = `${chatId}_${lastIncomingMessage.id}`;
      if (config.lastProcessedMessageId === messageKey) return;

      console.log(`📨 Nuevo mensaje detectado en chat ${chatId}: "${lastIncomingMessage.body}"`);

      // Generar respuesta automática
      const response = await this.generateResponse(lastIncomingMessage.body, config.agentName);

      if (response) {
        // Enviar respuesta
        await whatsappMultiAccountManager.sendMessage(accountId, chatId, response);
        console.log(`✅ Respuesta automática enviada: "${response}"`);

        // Marcar como procesado
        config.lastProcessedMessageId = messageKey;
      }

    } catch (error) {
      console.error(`❌ Error procesando chat ${chatId}:`, error);
    }
  }

  /**
   * Genera una respuesta usando OpenAI
   */
  private async generateResponse(message: string, agentName: string): Promise<string | null> {
    try {
      console.log(`🤖 Generando respuesta con ${agentName} para: "${message}"`);

      const completion = await openai.chat.completions.create({
        model: "gpt-4o", // El modelo más reciente de OpenAI
        messages: [
          {
            role: "system",
            content: `Eres ${agentName}, un asistente útil y amigable. Responde de manera concisa y profesional. Siempre en español y con un tono cálido.`
          },
          {
            role: "user",
            content: message
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      });

      const response = completion.choices[0]?.message?.content?.trim();
      
      if (response) {
        console.log(`✅ Respuesta generada: "${response}"`);
        return response;
      }

      return null;
    } catch (error) {
      console.error(`❌ Error generando respuesta:`, error);
      return null;
    }
  }

  /**
   * Obtiene el estado del sistema
   */
  getStatus(): { running: boolean; activeAccounts: number; configs: AutoResponseConfig[] } {
    return {
      running: this.isRunning,
      activeAccounts: this.configs.size,
      configs: Array.from(this.configs.values())
    };
  }
}

// Instancia global
export const realAutoResponseManager = new RealAutoResponseManager();