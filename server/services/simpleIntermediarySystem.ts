/**
 * SISTEMA INTERMEDIARIO SIMPLE
 * 
 * Hace UNA sola cosa:
 * 1. Recibe mensaje de WhatsApp
 * 2. Lo envía al agente externo asignado
 * 3. Envía la respuesta del agente de vuelta a WhatsApp
 * 
 * Sin complicaciones. Sin filtros. Sin respuestas genéricas.
 */

import { db } from "../db";
import { whatsappAccounts } from "@shared/schema";
import { eq } from "drizzle-orm";

export class SimpleIntermediarySystem {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 3000; // 3 segundos

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    console.log("🚀 SISTEMA INTERMEDIARIO SIMPLE INICIADO");
    console.log("📱 WhatsApp ↔ 🤖 Agente Externo");
    this.isRunning = true;

    // Verificación inicial
    await this.processMessages();

    // Bucle cada 3 segundos
    this.intervalId = setInterval(async () => {
      await this.processMessages();
    }, this.CHECK_INTERVAL);

    console.log("✅ Sistema intermediario activo - Verificando cada 3 segundos");
  }

  stop(): void {
    if (!this.isRunning) return;
    
    console.log("🛑 Deteniendo sistema intermediario...");
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    console.log("✅ Sistema intermediario detenido");
  }

  /**
   * Procesa mensajes: WhatsApp → Agente → WhatsApp
   */
  private async processMessages(): Promise<void> {
    try {
      // 1. Obtener cuentas activas con agente asignado
      const accounts = await db
        .select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.status, 'active'));

      for (const account of accounts) {
        if (account.assignedExternalAgentId && account.autoResponseEnabled) {
          await this.processAccountMessages(account);
        }
      }
    } catch (error) {
      console.error("❌ Error procesando mensajes:", error);
    }
  }

  /**
   * Procesa mensajes de una cuenta específica
   */
  private async processAccountMessages(account: any): Promise<void> {
    try {
      // 2. Obtener chats de la cuenta
      const chatsResponse = await fetch(`http://127.0.0.1:5000/api/whatsapp-accounts/${account.id}/chats`);
      if (!chatsResponse.ok) return;

      const chats = await chatsResponse.json();
      
      for (const chat of chats) {
        await this.checkChatForNewMessages(account, chat);
      }
    } catch (error) {
      console.error(`❌ Error procesando cuenta ${account.id}:`, error);
    }
  }

  /**
   * Verifica un chat por nuevos mensajes que necesiten respuesta
   */
  private async checkChatForNewMessages(account: any, chat: any): Promise<void> {
    try {
      // 3. Obtener mensajes del chat
      const messagesResponse = await fetch(`http://127.0.0.1:5000/api/whatsapp-accounts/${account.id}/messages/${chat.id}`);
      if (!messagesResponse.ok) return;

      const messages = await messagesResponse.json();
      if (!messages || messages.length === 0) return;

      // 4. Buscar último mensaje recibido (no enviado por nosotros)
      const lastReceivedMessage = messages.find((msg: any) => !msg.fromMe);
      if (!lastReceivedMessage) return;

      // 5. Verificar si es un nuevo mensaje que necesita respuesta
      if (lastReceivedMessage.body?.includes('ÚLTIMO RECIBIDO')) {
        console.log(`📨 Nuevo mensaje en ${chat.name || chat.id}: "${lastReceivedMessage.body}"`);
        
        // 6. Enviar al agente externo
        const agentResponse = await this.sendToAgent(
          account.assignedExternalAgentId,
          lastReceivedMessage.body,
          chat.name || chat.id
        );

        // 7. Si el agente respondió, enviar por WhatsApp
        if (agentResponse) {
          await this.sendWhatsAppMessage(account.id, chat.id, agentResponse);
        }
      }
    } catch (error) {
      console.error(`❌ Error verificando chat ${chat.id}:`, error);
    }
  }

  /**
   * Envía mensaje al agente externo - Misma lógica que funciona en "Probar Agente"
   */
  private async sendToAgent(agentId: string, message: string, contactName: string): Promise<string> {
    try {
      console.log(`🤖 Enviando a agente ${agentId}: "${message}"`);

      const response = await fetch(`http://127.0.0.1:5000/api/external-agents/${agentId}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          chatContext: {},
          userInfo: {
            chatId: 'intermediary-system',
            accountId: 1,
            name: contactName
          }
        }),
      });

      if (!response.ok) {
        console.log(`⚠️ Agente no disponible - Status: ${response.status}`);
        return '';
      }

      const data = await response.json();
      
      if (data.success && data.response) {
        console.log(`✅ Respuesta del agente: "${data.response}"`);
        return data.response;
      } else {
        console.log(`❌ Error del agente: ${data.error || 'Sin respuesta'}`);
        return '';
      }

    } catch (error) {
      console.error(`❌ Error conectando con agente ${agentId}:`, error);
      return '';
    }
  }

  /**
   * Envía respuesta por WhatsApp
   */
  private async sendWhatsAppMessage(accountId: number, chatId: string, message: string): Promise<void> {
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/whatsapp-accounts/${accountId}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: chatId,
          message: message
        }),
      });

      if (response.ok) {
        console.log(`✅ MENSAJE ENVIADO POR WHATSAPP: "${message}"`);
      } else {
        console.error(`❌ Error enviando por WhatsApp: ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ Error enviando mensaje:`, error);
    }
  }

  getStatus() {
    return {
      running: this.isRunning,
      checkInterval: this.CHECK_INTERVAL,
      systemType: 'Simple Intermediary System'
    };
  }
}

// Instancia singleton
export const simpleIntermediarySystem = new SimpleIntermediarySystem();