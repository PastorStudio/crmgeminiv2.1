/**
 * Sistema directo para conectar con agentes externos
 * Especialmente diseñado para NCGtgTLfcpxBgS8PcFHJo
 */

import { db } from '../db';
import { whatsappAccounts } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export class DirectExternalAgentSystem {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 5000; // 5 segundos

  /**
   * Inicia el sistema directo
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log("🔄 Sistema directo ya está funcionando");
      return;
    }

    console.log("🚀 INICIANDO SISTEMA DIRECTO DE AGENTES EXTERNOS");
    this.isRunning = true;

    // Inicia el bucle de verificación
    this.intervalId = setInterval(async () => {
      await this.processExternalAgents();
    }, this.CHECK_INTERVAL);

    console.log(`✅ Sistema directo iniciado - verificando cada ${this.CHECK_INTERVAL / 1000} segundos`);
  }

  /**
   * Detiene el sistema
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("⏹️ Sistema directo detenido");
  }

  /**
   * Procesa agentes externos
   */
  private async processExternalAgents(): Promise<void> {
    try {
      // Obtener cuentas con agentes externos asignados
      const accounts = await db
        .select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.autoResponseEnabled, true));

      console.log(`🔍 SISTEMA DIRECTO: Verificando ${accounts.length} cuentas con AI activado...`);

      for (const account of accounts) {
        if (account.assignedExternalAgentId) {
          console.log(`🤖 Procesando cuenta: ${account.name} con agente externo: ${account.assignedExternalAgentId}`);
          await this.processAccountDirectly(account);
        }
      }
    } catch (error) {
      console.error("❌ Error en sistema directo:", error);
    }
  }

  /**
   * Procesa una cuenta específica directamente
   */
  private async processAccountDirectly(account: any): Promise<void> {
    try {
      // 1. Obtener chats de WhatsApp
      console.log(`📱 Obteniendo chats para cuenta ${account.name}...`);
      const chatsResponse = await fetch(`http://localhost:5000/api/whatsapp-accounts/${account.id}/chats`);
      
      if (!chatsResponse.ok) {
        console.log(`⚠️ No se pudieron obtener chats para cuenta ${account.name}`);
        return;
      }

      const chats = await chatsResponse.json();
      console.log(`📊 Encontrados ${chats.length} chats para cuenta ${account.name}`);

      // 2. Procesar cada chat
      for (const chat of chats.slice(0, 5)) { // Limitar a 5 chats por vez
        await this.processChatDirectly(account, chat);
      }
    } catch (error) {
      console.error(`❌ Error procesando cuenta ${account.name}:`, error);
    }
  }

  /**
   * Procesa un chat específico
   */
  private async processChatDirectly(account: any, chat: any): Promise<void> {
    try {
      // 1. Obtener mensajes del chat
      const messagesResponse = await fetch(
        `http://localhost:5000/api/whatsapp-accounts/${account.id}/messages/${chat.id}`
      );

      if (!messagesResponse.ok) {
        return;
      }

      const messages = await messagesResponse.json();
      
      // 2. Buscar el último mensaje no respondido
      const lastMessage = messages.find((msg: any) => 
        !msg.fromMe && 
        msg.body && 
        msg.body.trim() !== '' &&
        !msg.body.includes('he recibido tu mensaje') // Evitar responder a respuestas automáticas
      );

      if (!lastMessage) {
        return;
      }

      console.log(`📨 ÚLTIMO MENSAJE DETECTADO en ${chat.name}: "${lastMessage.body.substring(0, 50)}..."`);

      // 3. Verificar si ya se respondió a este mensaje
      const recentOutgoingMessage = messages.find((msg: any) => 
        msg.fromMe && 
        msg.timestamp > lastMessage.timestamp
      );

      if (recentOutgoingMessage) {
        console.log(`✅ Mensaje ya respondido en chat ${chat.name}`);
        return;
      }

      // 4. Enviar al agente externo
      console.log(`🤖 Enviando a agente externo ${account.assignedExternalAgentId}: "${lastMessage.body}"`);
      
      const agentResponse = await this.callExternalAgent(
        account.assignedExternalAgentId,
        lastMessage.body,
        chat.name
      );

      if (agentResponse && agentResponse.trim() !== '') {
        console.log(`✅ Respuesta del agente: "${agentResponse.substring(0, 100)}..."`);
        
        // 5. Enviar la respuesta
        await this.sendResponse(account.id, chat.id, agentResponse);
      }
    } catch (error) {
      console.error(`❌ Error procesando chat ${chat.id}:`, error);
    }
  }

  /**
   * Llama al agente externo
   */
  private async callExternalAgent(agentId: string, message: string, contactName: string): Promise<string | null> {
    try {
      const response = await fetch('http://localhost:5000/api/external-agents/generate-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId,
          message,
          contactName,
          context: `Conversación de WhatsApp con ${contactName}`
        }),
      });

      if (!response.ok) {
        console.error(`❌ Error en respuesta del agente ${agentId}:`, response.status);
        return null;
      }

      const data = await response.json();
      
      if (data.success && data.response) {
        return data.response;
      } else {
        console.error(`❌ Agente ${agentId} no devolvió respuesta válida:`, data);
        return null;
      }
    } catch (error) {
      console.error(`❌ Error llamando agente externo ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Envía la respuesta
   */
  private async sendResponse(accountId: number, chatId: string, message: string): Promise<void> {
    try {
      const response = await fetch(`http://localhost:5000/api/whatsapp-accounts/${accountId}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId,
          message,
        }),
      });

      if (response.ok) {
        console.log(`✅ RESPUESTA AUTOMÁTICA ENVIADA: "${message.substring(0, 100)}..."`);
      } else {
        console.error(`❌ Error enviando respuesta:`, response.status);
      }
    } catch (error) {
      console.error(`❌ Error enviando respuesta:`, error);
    }
  }
}

// Instancia única
export const directExternalAgentSystem = new DirectExternalAgentSystem();