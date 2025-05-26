/**
 * Sistema de respuestas automáticas basado en base de datos
 * Reemplaza el sistema de memoria virtual por PostgreSQL para mayor eficiencia
 */

import { whatsappMultiAccountManager } from "./whatsappMultiAccountManager";
import { databaseMessageService, WhatsAppDatabaseMessage } from "./databaseMessageService";
import { externalAgentService } from "./externalAgentService";
import { db } from "../db";
import { whatsappAccounts } from "@shared/schema";
import { eq } from "drizzle-orm";

export class DatabaseAutoResponseService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 3000; // 3 segundos

  /**
   * Inicia el sistema de respuestas automáticas basado en base de datos
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("🔄 Sistema de respuestas automáticas ya está ejecutándose");
      return;
    }

    console.log("🚀 Iniciando sistema de respuestas automáticas basado en base de datos...");
    this.isRunning = true;

    // Limpia cache anterior (equivalente a limpiar memoria)
    console.log("🔄 SISTEMA BASADO EN BASE DE DATOS - sin cache en memoria");

    // Inicia el bucle de verificación
    this.intervalId = setInterval(async () => {
      await this.checkForNewMessages();
    }, this.CHECK_INTERVAL);

    console.log(`✅ Sistema iniciado - verificando cada ${this.CHECK_INTERVAL / 1000} segundos`);
  }

  /**
   * Detiene el sistema de respuestas automáticas
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log("⏹️ Sistema de respuestas automáticas detenido");
  }

  /**
   * Verifica nuevos mensajes en todas las cuentas activas
   */
  private async checkForNewMessages(): Promise<void> {
    try {
      // Obtiene todas las cuentas activas
      const accounts = await db
        .select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.autoResponseEnabled, true));

      if (accounts.length === 0) {
        return; // No hay cuentas con auto-respuesta habilitada
      }

      console.log(`🔍 Verificando mensajes nuevos en ${accounts.length} cuentas con auto-respuesta activada...`);

      for (const account of accounts) {
        await this.processAccountMessages(account.id);
      }
    } catch (error) {
      console.error("❌ Error verificando nuevos mensajes:", error);
    }
  }

  /**
   * Procesa mensajes de una cuenta específica
   */
  private async processAccountMessages(accountId: number): Promise<void> {
    try {
      // Obtiene chats de WhatsApp en tiempo real
      const chats = await whatsappMultiAccountManager.getChats(accountId);
      
      if (!chats || chats.length === 0) {
        return;
      }

      let newMessagesFound = 0;

      for (const chat of chats) {
        const newMessages = await this.processChat(accountId, chat.id);
        newMessagesFound += newMessages;
      }

      if (newMessagesFound > 0) {
        console.log(`📨 ${newMessagesFound} mensajes nuevos detectados y procesados en cuenta ${accountId}`);
      }
    } catch (error) {
      console.error(`❌ Error procesando mensajes de cuenta ${accountId}:`, error);
    }
  }

  /**
   * Procesa un chat específico
   */
  private async processChat(accountId: number, chatId: string): Promise<number> {
    try {
      // Obtiene mensajes reales de WhatsApp
      const messages = await whatsappMultiAccountManager.getMessages(accountId, chatId, 10);
      
      if (!messages || messages.length === 0) {
        return 0;
      }

      let newMessagesProcessed = 0;

      for (const message of messages) {
        // Verifica si el mensaje ya existe en la base de datos
        const exists = await databaseMessageService.messageExists(message.id);
        
        if (!exists) {
          // Nuevo mensaje - lo guarda en la base de datos
          const dbMessage: WhatsAppDatabaseMessage = {
            id: message.id,
            accountId: accountId,
            chatId: chatId,
            contactName: message.fromMe ? undefined : (message as any).contact?.name || chatId,
            body: message.body,
            fromMe: message.fromMe || false,
            timestamp: new Date(message.timestamp * 1000),
            type: message.type || 'text',
            processedByAutoResponse: false,
          };

          await databaseMessageService.saveMessage(dbMessage);

          // Si es un mensaje entrante (no enviado por nosotros), procesa respuesta automática
          if (!message.fromMe && message.body?.trim()) {
            await this.generateAutoResponse(accountId, chatId, message);
            newMessagesProcessed++;
          }
        }
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
  private async generateAutoResponse(accountId: number, chatId: string, message: any): Promise<void> {
    try {
      // Obtiene configuración de la cuenta
      const account = await db
        .select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.id, accountId))
        .limit(1);

      if (account.length === 0 || !account[0].assignedExternalAgentId) {
        console.log(`⚠️ Cuenta ${accountId} sin agente externo asignado`);
        return;
      }

      const agentId = account[0].assignedExternalAgentId;
      console.log(`📨 NUEVO MENSAJE DETECTADO en chat ${chatId}: "${message.body}"`);

      // Genera respuesta usando agente externo
      const response = await externalAgentService.generateResponse(
        agentId,
        message.body,
        (message as any).contact?.name || chatId
      );

      if (response.success && response.response) {
        // Envía la respuesta
        await whatsappMultiAccountManager.sendMessage(accountId, chatId, response.response);
        
        // Marca el mensaje como procesado en la base de datos
        await databaseMessageService.markAsProcessed(message.id, response.response);

        console.log(`✅ RESPUESTA AUTOMÁTICA ENVIADA a ${chatId}: "${response.response}"`);
      } else {
        console.log(`⚠️ No se pudo generar respuesta para ${chatId}: ${response.error}`);
      }
    } catch (error) {
      console.error(`❌ Error generando respuesta automática para ${chatId}:`, error);
    }
  }

  /**
   * Obtiene estadísticas del sistema
   */
  async getStats(): Promise<{
    isRunning: boolean;
    totalUnprocessedMessages: number;
    accountsWithAutoResponse: number;
  }> {
    try {
      const accountsWithAutoResponse = await db
        .select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.autoResponseEnabled, true));

      let totalUnprocessed = 0;
      for (const account of accountsWithAutoResponse) {
        const unprocessed = await databaseMessageService.getUnprocessedMessages(account.id);
        totalUnprocessed += unprocessed.length;
      }

      return {
        isRunning: this.isRunning,
        totalUnprocessedMessages: totalUnprocessed,
        accountsWithAutoResponse: accountsWithAutoResponse.length,
      };
    } catch (error) {
      console.error("❌ Error obteniendo estadísticas:", error);
      return {
        isRunning: this.isRunning,
        totalUnprocessedMessages: 0,
        accountsWithAutoResponse: 0,
      };
    }
  }
}

// Instancia singleton
export const databaseAutoResponseService = new DatabaseAutoResponseService();