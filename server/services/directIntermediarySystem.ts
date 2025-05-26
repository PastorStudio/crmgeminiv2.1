/**
 * SISTEMA DIRECTO INTERMEDIARIO
 * 
 * Sistema simple que realmente funciona:
 * 1. Detecta mensajes nuevos en WhatsApp
 * 2. Los envía al agente externo configurado
 * 3. Envía la respuesta de vuelta a WhatsApp
 */

import { db } from "../db";
import { whatsappAccounts } from "@shared/schema";
import { eq } from "drizzle-orm";

class DirectIntermediarySystem {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  async start(): Promise<void> {
    if (this.isRunning) return;

    console.log("🚀 SISTEMA DIRECTO INTERMEDIARIO INICIADO");
    console.log("📱 WhatsApp ↔ 🤖 Agente Externo");
    
    this.isRunning = true;

    // Verificar cada 3 segundos
    this.intervalId = setInterval(async () => {
      try {
        await this.checkForNewMessages();
      } catch (error) {
        console.error("❌ Error en sistema directo:", error);
      }
    }, 3000);

    console.log("✅ Sistema directo activo - Verificando cada 3 segundos");
  }

  private async checkForNewMessages(): Promise<void> {
    // 1. Obtener cuenta configurada (cualquier estado que no sea 'disconnected')
    const accounts = await db
      .select()
      .from(whatsappAccounts);

    for (const account of accounts) {
      if (account.assignedExternalAgentId && account.autoResponseEnabled && account.status !== 'disconnected') {
        console.log(`🔍 Verificando cuenta ${account.id} (${account.name}) con agente ${account.assignedExternalAgentId}`);
        await this.processAccount(account);
      } else if (account.assignedExternalAgentId && account.autoResponseEnabled) {
        console.log(`⚠️ Cuenta ${account.id} (${account.name}) configurada pero desconectada`);
      } else if (account.assignedExternalAgentId) {
        console.log(`💤 Cuenta ${account.id} (${account.name}) con agente pero auto-respuestas deshabilitadas`);
      }
    }
  }

  private async processAccount(account: any): Promise<void> {
    try {
      // Obtener chats usando fetch a la API local
      const chats = await this.getAccountChats(account.id);
      
      for (const chat of chats) {
        await this.processChat(account, chat);
      }
    } catch (error) {
      console.error(`❌ Error procesando cuenta ${account.id}:`, error);
    }
  }

  private async getAccountChats(accountId: number): Promise<any[]> {
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/whatsapp-accounts/${accountId}/chats`);
      if (!response.ok) return [];
      const chats = await response.json();
      return Array.isArray(chats) ? chats : [];
    } catch (error) {
      console.error(`❌ Error obteniendo chats cuenta ${accountId}:`, error);
      return [];
    }
  }

  private async processChat(account: any, chat: any): Promise<void> {
    try {
      // Obtener mensajes del chat usando fetch a la API local
      const response = await fetch(`http://127.0.0.1:5000/api/whatsapp-accounts/${account.id}/messages/${chat.id}`);
      if (!response.ok) return;
      
      const messages = await response.json();
      if (!Array.isArray(messages) || messages.length === 0) return;

      // Buscar último mensaje recibido (no enviado por nosotros)
      const lastReceivedMessage = messages.find((msg: any) => !msg.fromMe);
      if (!lastReceivedMessage) return;

      // Solo procesar mensajes con "ÚLTIMO RECIBIDO"
      if (lastReceivedMessage.body?.includes('ÚLTIMO RECIBIDO')) {
        console.log(`📨 DETECTADO: "${lastReceivedMessage.body}" en chat ${chat.name || chat.id}`);
        
        // Enviar al agente externo
        const agentResponse = await this.sendToAgent(
          account.assignedExternalAgentId,
          lastReceivedMessage.body,
          chat.name || chat.id
        );

        // Si el agente respondió, enviar por WhatsApp
        if (agentResponse) {
          await this.sendToWhatsApp(account.id, chat.id, agentResponse);
        }
      }
    } catch (error) {
      console.error(`❌ Error procesando chat ${chat.id}:`, error);
    }
  }

  private async sendToAgent(agentId: string, message: string, contactName: string): Promise<string> {
    try {
      console.log(`🤖 Enviando al agente ${agentId}: "${message}"`);

      const response = await fetch(`http://127.0.0.1:5000/api/external-agents/${agentId}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          chatContext: {},
          userInfo: {
            chatId: 'direct-system',
            accountId: 1,
            name: contactName
          }
        })
      });

      if (!response.ok) {
        console.log(`❌ Error HTTP del agente: ${response.status}`);
        return '';
      }

      const result = await response.json();
      if (result.success && result.response) {
        console.log(`✅ Respuesta del agente: "${result.response}"`);
        return result.response;
      } else {
        console.log(`❌ Error del agente: ${result.error || 'Sin respuesta'}`);
        return '';
      }

    } catch (error) {
      console.error(`❌ Error conectando con agente ${agentId}:`, error);
      return '';
    }
  }

  private async sendToWhatsApp(accountId: number, chatId: string, message: string): Promise<void> {
    try {
      console.log(`📱 Enviando a WhatsApp: "${message}"`);

      const response = await fetch(`http://127.0.0.1:5000/api/whatsapp-accounts/${accountId}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: chatId,
          message: message
        })
      });

      if (response.ok) {
        console.log(`✅ MENSAJE ENVIADO A WHATSAPP EXITOSAMENTE`);
      } else {
        console.error(`❌ Error HTTP enviando mensaje a WhatsApp: ${response.status}`);
      }
    } catch (error) {
      console.error(`❌ Error enviando a WhatsApp:`, error);
    }
  }

  stop(): void {
    if (!this.isRunning) return;
    
    console.log("🛑 Deteniendo sistema directo...");
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    console.log("✅ Sistema directo detenido");
  }

  getStatus() {
    return {
      running: this.isRunning,
      systemType: 'Direct Intermediary System'
    };
  }
}

export const directIntermediarySystem = new DirectIntermediarySystem();