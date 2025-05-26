/**
 * Sistema optimizado de respuestas automáticas sin memoria virtual
 * Usa directamente PostgreSQL para detectar mensajes nuevos
 */

import { whatsappMultiAccountManager } from "./whatsappMultiAccountManager";
import { externalAgentService } from "./externalAgentService";
import { db } from "../db";
import { whatsappAccounts, whatsappMessages } from "@shared/schema";
import { eq, and, desc, max } from "drizzle-orm";

// Cache simple en memoria para IDs de último mensaje procesado por chat
const lastProcessedMessageIds = new Map<string, string>();

export class OptimizedAutoResponseService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 3000; // 3 segundos

  /**
   * Inicia el sistema optimizado
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("🔄 Sistema optimizado ya está ejecutándose");
      return;
    }

    console.log("🚀 Iniciando sistema optimizado de respuestas automáticas...");
    this.isRunning = true;

    // Limpia el cache de memoria para detectar todos los mensajes como nuevos
    lastProcessedMessageIds.clear();
    console.log("🔄 CACHE DE MENSAJES LIMPIADO - detectará todos los mensajes como nuevos");

    // Inicia el bucle de verificación
    this.intervalId = setInterval(async () => {
      await this.checkForNewMessages();
    }, this.CHECK_INTERVAL);

    console.log(`✅ Sistema optimizado iniciado - verificando cada ${this.CHECK_INTERVAL / 1000} segundos`);
  }

  /**
   * Detiene el sistema
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("⏹️ Sistema optimizado detenido");
  }

  /**
   * Verifica nuevos mensajes de manera optimizada
   */
  private async checkForNewMessages(): Promise<void> {
    try {
      // Obtiene cuentas con auto-respuesta habilitada
      const accounts = await db
        .select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.autoResponseEnabled, true));

      if (accounts.length === 0) {
        return;
      }

      console.log(`🔍 Verificando mensajes nuevos en ${accounts.length} cuentas...`);

      for (const account of accounts) {
        await this.processAccount(account.id, account.assignedExternalAgentId);
      }
    } catch (error) {
      console.error("❌ Error verificando mensajes:", error);
    }
  }

  /**
   * Procesa una cuenta específica
   */
  private async processAccount(accountId: number, agentId: string | null): Promise<void> {
    try {
      if (!agentId) {
        return; // Sin agente asignado
      }

      // Obtiene chats de WhatsApp usando el endpoint interno
      const response = await fetch(`http://localhost:5000/api/whatsapp-accounts/${accountId}/chats`);
      if (!response.ok) {
        console.log(`⚠️ No se pudieron obtener chats para cuenta ${accountId}`);
        return;
      }
      
      const chats = await response.json();
      if (!chats || chats.length === 0) {
        return;
      }

      let newMessagesFound = 0;

      for (const chat of chats) {
        const newMessages = await this.processChatOptimized(accountId, chat.id, agentId);
        newMessagesFound += newMessages;
      }

      if (newMessagesFound > 0) {
        console.log(`📨 ${newMessagesFound} mensajes nuevos procesados en cuenta ${accountId}`);
      }
    } catch (error) {
      console.error(`❌ Error procesando cuenta ${accountId}:`, error);
    }
  }

  /**
   * Procesa un chat de manera optimizada
   */
  private async processChatOptimized(accountId: number, chatId: string, agentId: string): Promise<number> {
    try {
      // Obtiene mensajes recientes de WhatsApp usando el endpoint interno
      const messagesResponse = await fetch(`http://localhost:5000/api/whatsapp-accounts/${accountId}/messages/${chatId}`);
      if (!messagesResponse.ok) {
        return 0;
      }
      
      const messages = await messagesResponse.json();
      if (!messages || messages.length === 0) {
        return 0;
      }

      // Clave para el cache de este chat
      const cacheKey = `${accountId}:${chatId}`;
      const lastProcessedId = lastProcessedMessageIds.get(cacheKey);

      let newMessagesProcessed = 0;
      let foundNewMessage = false;

      // Procesa mensajes en orden cronológico inverso (más reciente primero)
      for (const message of messages) {
        // Si llegamos a un mensaje que ya procesamos, para aquí
        if (lastProcessedId && message.id === lastProcessedId) {
          break;
        }

        // Solo procesa mensajes entrantes con contenido
        if (!message.fromMe && message.body?.trim()) {
          console.log(`📨 NUEVO MENSAJE DETECTADO en chat ${chatId}: "${message.body}"`);
          
          // Genera y envía respuesta automática
          const success = await this.generateAndSendResponse(accountId, chatId, message, agentId);
          
          if (success) {
            newMessagesProcessed++;
          }

          // Marca como el mensaje más reciente procesado
          if (!foundNewMessage) {
            lastProcessedMessageIds.set(cacheKey, message.id);
            foundNewMessage = true;
          }
        }
      }

      // Si no había cache anterior, usa el mensaje más reciente como referencia
      if (!lastProcessedId && messages.length > 0) {
        lastProcessedMessageIds.set(cacheKey, messages[0].id);
      }

      return newMessagesProcessed;
    } catch (error) {
      console.error(`❌ Error procesando chat ${chatId}:`, error);
      return 0;
    }
  }

  /**
   * Genera y envía respuesta automática
   */
  private async generateAndSendResponse(
    accountId: number,
    chatId: string,
    message: any,
    agentId: string
  ): Promise<boolean> {
    try {
      // Genera respuesta usando agente externo
      const contactName = (message as any).contact?.name || chatId;
      const response = await fetch(`http://localhost:5000/api/external-agents/${agentId}/generate-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.body,
          contactName: contactName
        })
      });

      if (!response.ok) {
        console.log(`⚠️ Error llamando al agente externo ${agentId}`);
        return false;
      }

      const responseData = await response.json();

      if (responseData.success && responseData.response) {
        // Envía la respuesta usando el endpoint interno
        const sendResponse = await fetch(`http://localhost:5000/api/whatsapp-accounts/${accountId}/send-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chatId: chatId,
            message: responseData.response
          })
        });

        if (sendResponse.ok) {
          console.log(`✅ RESPUESTA AUTOMÁTICA ENVIADA a ${contactName}: "${responseData.response}"`);
          return true;
        } else {
          console.log(`⚠️ Error enviando respuesta a ${contactName}`);
          return false;
        }
      } else {
        console.log(`⚠️ No se pudo generar respuesta para ${contactName}: ${responseData.error || 'Error desconocido'}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error generando respuesta para ${chatId}:`, error);
      return false;
    }
  }

  /**
   * Limpia el cache (útil para reiniciar detección)
   */
  clearCache(): void {
    lastProcessedMessageIds.clear();
    console.log("🔄 Cache de mensajes procesados limpiado");
  }

  /**
   * Obtiene estadísticas del sistema
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      cachedChats: lastProcessedMessageIds.size,
      checkInterval: this.CHECK_INTERVAL,
    };
  }
}

// Instancia singleton
export const optimizedAutoResponseService = new OptimizedAutoResponseService();