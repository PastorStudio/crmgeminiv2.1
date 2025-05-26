/**
 * SISTEMA LIMPIO DE RESPUESTAS AUTOMÁTICAS
 * 
 * Usa exactamente la misma lógica que funciona en "Probar Agente Intermediario"
 * Sin funciones conflictivas ni respuestas genéricas
 */

import { db } from "../db";
import { whatsappAccounts } from "@shared/schema";
import { eq } from "drizzle-orm";

export class CleanAutoResponseSystem {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 3000; // 3 segundos

  /**
   * Inicia el sistema limpio de respuestas automáticas
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("🔄 Sistema de respuestas automáticas ya está ejecutándose");
      return;
    }

    console.log("🚀🚀🚀 INICIANDO SISTEMA LIMPIO DE RESPUESTAS AUTOMÁTICAS 🚀🚀🚀");
    console.log("🎯 SOLO RESPUESTAS AUTÉNTICAS DE AGENTES - SIN MENSAJES GENÉRICOS");
    this.isRunning = true;

    // Hacer una verificación inmediata para test
    console.log("🔍 Ejecutando verificación inicial...");
    await this.checkAndRespond();

    // Inicia el bucle de verificación
    this.intervalId = setInterval(async () => {
      await this.checkAndRespond();
    }, this.CHECK_INTERVAL);

    console.log("✅ Sistema limpio ACTIVADO - Verificando cada 3 segundos");
  }

  /**
   * Detiene el sistema
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log("🛑 Deteniendo sistema de respuestas automáticas...");
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log("✅ Sistema detenido");
  }

  /**
   * Función principal: Verifica y responde automáticamente
   */
  private async checkAndRespond(): Promise<void> {
    try {
      console.log("🔍 Sistema limpio verificando cuentas...");
      
      // 1. Obtener cuentas con agentes asignados
      const accounts = await db
        .select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.status, 'active'));

      console.log(`📋 Encontradas ${accounts.length} cuentas activas`);

      for (const account of accounts) {
        console.log(`🔍 Revisando cuenta ${account.id} - Agente: ${account.assignedExternalAgentId} - AutoResponse: ${account.autoResponseEnabled}`);
        
        if (account.assignedExternalAgentId && account.autoResponseEnabled) {
          console.log(`✅ Procesando cuenta ${account.id} con agente ${account.assignedExternalAgentId}`);
          await this.processAccount(account);
        } else {
          console.log(`⏭️ Saltando cuenta ${account.id} - Sin agente o auto-response deshabilitado`);
        }
      }
    } catch (error) {
      console.error("❌ Error en checkAndRespond:", error);
    }
  }

  /**
   * Procesa una cuenta específica
   */
  private async processAccount(account: any): Promise<void> {
    try {
      // 2. Obtener chats de la cuenta
      const response = await fetch(`http://localhost:5000/api/whatsapp-accounts/${account.id}/chats`);
      if (!response.ok) {
        return;
      }

      const chats = await response.json();
      
      for (const chat of chats) {
        await this.checkChatForLastMessage(account, chat);
      }
    } catch (error) {
      console.error(`❌ Error procesando cuenta ${account.id}:`, error);
    }
  }

  /**
   * Verifica un chat específico buscando el mensaje "ÚLTIMO RECIBIDO"
   */
  private async checkChatForLastMessage(account: any, chat: any): Promise<void> {
    try {
      // Obtener mensajes del chat
      const response = await fetch(`http://localhost:5000/api/whatsapp-accounts/${account.id}/messages/${chat.id}`);
      if (!response.ok) {
        return;
      }

      const messages = await response.json();
      if (!messages || messages.length === 0) {
        return;
      }

      // Buscar el último mensaje no enviado por nosotros
      const lastReceivedMessage = messages.find((msg: any) => !msg.fromMe);
      if (!lastReceivedMessage) {
        return;
      }

      // Verificar si contiene el indicador "ÚLTIMO RECIBIDO"
      if (!lastReceivedMessage.body?.includes('ÚLTIMO RECIBIDO')) {
        return;
      }

      console.log(`📨 ÚLTIMO RECIBIDO detectado en ${chat.name || chat.id}: "${lastReceivedMessage.body}"`);

      // 3. Enviar al agente externo usando la lógica que funciona
      const agentResponse = await this.sendToExternalAgentClean(
        account.assignedExternalAgentId,
        lastReceivedMessage.body,
        chat.name || chat.id
      );

      if (agentResponse && agentResponse.trim().length > 0) {
        console.log(`🚀 Enviando respuesta AUTÉNTICA del agente: "${agentResponse}"`);
        await this.sendWhatsAppResponse(account.id, chat.id, agentResponse, chat.name || chat.id);
      } else {
        console.log(`❌ Agente ${account.assignedExternalAgentId} no respondió - NO se envía mensaje automático`);
      }
    } catch (error) {
      console.error(`❌ Error verificando chat ${chat.id}:`, error);
    }
  }

  /**
   * Envía mensaje al agente externo usando EXACTAMENTE la misma lógica 
   * que funciona en "Probar Agente Intermediario"
   */
  private async sendToExternalAgentClean(agentId: string, message: string, contactName: string): Promise<string> {
    if (!agentId) {
      console.log('⚠️ No hay agente asignado');
      return '';
    }

    try {
      console.log(`🤖 Enviando a agente ${agentId}: "${message}"`);

      // Usar EXACTAMENTE la misma lógica que funciona en las pruebas
      const response = await fetch(`http://localhost:5000/api/external-agents/${agentId}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          chatContext: {},
          userInfo: {
            chatId: 'auto-response-chat',
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
        console.log(`✅ Respuesta auténtica del agente ${agentId}: "${data.response}"`);
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
   * Envía respuesta automática por WhatsApp
   */
  private async sendWhatsAppResponse(accountId: number, chatId: string, response: string, contactName: string): Promise<void> {
    try {
      const sendResponse = await fetch(`http://localhost:5000/api/whatsapp-accounts/${accountId}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: chatId,
          message: response
        }),
      });

      if (sendResponse.ok) {
        console.log(`✅ RESPUESTA AUTÉNTICA ENVIADA a ${contactName}: "${response}"`);
      } else {
        console.error(`❌ Error enviando mensaje por WhatsApp: ${sendResponse.status}`);
      }
    } catch (error) {
      console.error(`❌ Error enviando respuesta por WhatsApp:`, error);
    }
  }

  /**
   * Obtiene estadísticas del sistema
   */
  getStats() {
    return {
      running: this.isRunning,
      checkInterval: this.CHECK_INTERVAL,
      systemType: 'Clean Auto Response System'
    };
  }
}

// Instancia singleton
export const cleanAutoResponseSystem = new CleanAutoResponseSystem();