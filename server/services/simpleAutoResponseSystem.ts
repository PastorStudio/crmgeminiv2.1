/**
 * Sistema simple de respuestas automáticas
 * Detecta mensaje "ÚLTIMO RECIBIDO" -> Envía al agente externo -> Responde automáticamente
 */

import { db } from "../db";
import { whatsappAccounts } from "@shared/schema";
import { eq } from "drizzle-orm";

export class SimpleAutoResponseSystem {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 3000; // 3 segundos

  /**
   * Inicia el sistema simple
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("🔄 Sistema simple ya está ejecutándose");
      return;
    }

    console.log("🚀 Iniciando sistema simple de respuestas automáticas...");
    this.isRunning = true;

    // Inicia el bucle de verificación
    this.intervalId = setInterval(async () => {
      await this.checkAndRespond();
    }, this.CHECK_INTERVAL);

    console.log(`✅ Sistema simple iniciado - verificando cada ${this.CHECK_INTERVAL / 1000} segundos`);
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
    console.log("⏹️ Sistema simple detenido");
  }

  /**
   * Función principal: Verifica y responde automáticamente
   */
  private async checkAndRespond(): Promise<void> {
    try {
      // 1. Obtener cuentas con AI ON (autoResponseEnabled = true)
      const accounts = await db
        .select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.autoResponseEnabled, true));

      if (accounts.length === 0) {
        return; // No hay cuentas con AI activado
      }

      console.log(`🔍 Verificando ${accounts.length} cuentas con AI ON...`);

      for (const account of accounts) {
        await this.processAccount(account);
      }
    } catch (error) {
      console.error("❌ Error en sistema simple:", error);
    }
  }

  /**
   * Procesa una cuenta específica
   */
  private async processAccount(account: any): Promise<void> {
    try {
      // Verificar que tenga agente asignado
      if (!account.assignedExternalAgentId) {
        console.log(`⚠️ Cuenta ${account.name} no tiene agente asignado`);
        return;
      }

      // 1. Obtener chats de WhatsApp
      const chatsResponse = await fetch(`http://localhost:5000/api/whatsapp-accounts/${account.id}/chats`);
      if (!chatsResponse.ok) {
        console.log(`⚠️ No se pudieron obtener chats para cuenta ${account.name}`);
        return;
      }

      const chats = await chatsResponse.json();
      if (!chats || chats.length === 0) {
        return;
      }

      // 2. Buscar mensajes con "ÚLTIMO RECIBIDO"
      for (const chat of chats) {
        await this.checkChatForLastMessage(account, chat);
      }
    } catch (error) {
      console.error(`❌ Error procesando cuenta ${account.name}:`, error);
    }
  }

  /**
   * Verifica un chat específico buscando el mensaje "ÚLTIMO RECIBIDO"
   */
  private async checkChatForLastMessage(account: any, chat: any): Promise<void> {
    try {
      // Obtener mensajes del chat
      const messagesResponse = await fetch(`http://localhost:5000/api/whatsapp-accounts/${account.id}/messages/${chat.id}`);
      if (!messagesResponse.ok) {
        return;
      }

      const messages = await messagesResponse.json();
      if (!messages || messages.length === 0) {
        return;
      }

      // Buscar el mensaje más reciente que NO sea nuestro (fromMe: false) y tenga contenido
      const lastReceivedMessage = messages.find((msg: any) => !msg.fromMe && msg.body?.trim());

      if (!lastReceivedMessage) {
        return; // No hay mensajes recibidos
      }

      console.log(`📨 ÚLTIMO RECIBIDO detectado en ${chat.name || chat.id}: "${lastReceivedMessage.body}"`);

      // 3. Enviar al agente externo y obtener respuesta
      const agentResponse = await this.sendToExternalAgent(
        account.assignedExternalAgentId,
        lastReceivedMessage.body,
        chat.name || chat.id
      );

      if (agentResponse) {
        // 4. Enviar respuesta automática por WhatsApp
        await this.sendWhatsAppResponse(account.id, chat.id, agentResponse, chat.name || chat.id);
      }
    } catch (error) {
      console.error(`❌ Error verificando chat ${chat.id}:`, error);
    }
  }

  /**
   * Envía mensaje al agente externo y obtiene respuesta
   */
  private async sendToExternalAgent(agentId: string, message: string, contactName: string): Promise<string | null> {
    try {
      console.log(`🤖 Enviando a agente ${agentId}: "${message}"`);

      const response = await fetch(`http://localhost:5000/api/external-agents/${agentId}/generate-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          contactName: contactName
        })
      });

      if (!response.ok) {
        console.log(`⚠️ Error llamando al agente ${agentId}`);
        return null;
      }

      const responseText = await response.text();
      
      try {
        const responseData = JSON.parse(responseText);
        if (responseData.success && responseData.response) {
          console.log(`✅ Agente respondió: "${responseData.response}"`);
          return responseData.response;
        } else {
          console.log(`⚠️ Agente no pudo generar respuesta: ${responseData.error || 'Error desconocido'}`);
          return null;
        }
      } catch (parseError) {
        // Si no es JSON, usar la respuesta directamente como texto
        console.log(`✅ Agente respondió (texto): "${responseText}"`);
        return responseText;
      }
    } catch (error) {
      console.error(`❌ Error llamando al agente externo:`, error);
      return null;
    }
  }

  /**
   * Envía respuesta automática por WhatsApp
   */
  private async sendWhatsAppResponse(accountId: number, chatId: string, message: string, contactName: string): Promise<void> {
    try {
      const sendResponse = await fetch(`http://localhost:5000/api/whatsapp-accounts/${accountId}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: chatId,
          message: message
        })
      });

      if (sendResponse.ok) {
        console.log(`✅ RESPUESTA AUTOMÁTICA ENVIADA a ${contactName}: "${message}"`);
      } else {
        console.log(`⚠️ Error enviando respuesta a ${contactName}`);
      }
    } catch (error) {
      console.error(`❌ Error enviando respuesta automática:`, error);
    }
  }

  /**
   * Obtiene estadísticas del sistema
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.CHECK_INTERVAL,
    };
  }
}

// Instancia singleton
export const simpleAutoResponseSystem = new SimpleAutoResponseSystem();