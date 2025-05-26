/**
 * Servicio para manejar mensajes de WhatsApp en base de datos
 * Este servicio reemplaza el sistema de memoria virtual por PostgreSQL
 */

import { db } from "../db";
import { whatsappMessages } from "@shared/schema";
import { eq, and, desc, gt } from "drizzle-orm";

export interface WhatsAppDatabaseMessage {
  id: string;
  accountId: number;
  chatId: string;
  contactName?: string;
  body?: string;
  fromMe: boolean;
  timestamp: Date;
  type?: string;
  processedByAutoResponse?: boolean;
  autoResponseGenerated?: string;
}

export class DatabaseMessageService {
  /**
   * Guarda un mensaje en la base de datos
   */
  async saveMessage(message: WhatsAppDatabaseMessage): Promise<void> {
    try {
      await db.insert(whatsappMessages).values({
        messageId: message.id,
        accountId: message.accountId,
        chatId: message.chatId,
        contactName: message.contactName,
        body: message.body,
        fromMe: message.fromMe,
        timestamp: message.timestamp,
        mediaType: message.type || 'text',
        processedByAutoResponse: message.processedByAutoResponse || false,
        autoResponseGenerated: message.autoResponseGenerated,
      }).onConflictDoNothing();
      
      console.log(`💾 Mensaje guardado en DB: ${message.chatId} - ${message.body?.substring(0, 50)}...`);
    } catch (error) {
      console.error('❌ Error guardando mensaje en DB:', error);
    }
  }

  /**
   * Obtiene el último mensaje no procesado de un chat específico
   */
  async getLastUnprocessedMessage(accountId: number, chatId: string): Promise<WhatsAppDatabaseMessage | null> {
    try {
      const result = await db
        .select()
        .from(whatsappMessages)
        .where(
          and(
            eq(whatsappMessages.accountId, accountId),
            eq(whatsappMessages.chatId, chatId),
            eq(whatsappMessages.fromMe, false), // Solo mensajes entrantes
            eq(whatsappMessages.processedByAutoResponse, false) // No procesados
          )
        )
        .orderBy(desc(whatsappMessages.timestamp))
        .limit(1);

      if (result.length === 0) return null;

      const msg = result[0];
      return {
        id: msg.messageId,
        accountId: msg.accountId!,
        chatId: msg.chatId,
        contactName: msg.contactName || undefined,
        body: msg.body || undefined,
        fromMe: msg.fromMe || false,
        timestamp: msg.timestamp || new Date(),
        type: msg.mediaType || 'text',
        processedByAutoResponse: msg.processedByAutoResponse || false,
        autoResponseGenerated: msg.autoResponseGenerated || undefined,
      };
    } catch (error) {
      console.error('❌ Error obteniendo último mensaje no procesado:', error);
      return null;
    }
  }

  /**
   * Marca un mensaje como procesado por el sistema automático
   */
  async markAsProcessed(messageId: string, autoResponse?: string): Promise<void> {
    try {
      await db
        .update(whatsappMessages)
        .set({
          processedByAutoResponse: true,
          autoResponseGenerated: autoResponse,
          updatedAt: new Date(),
        })
        .where(eq(whatsappMessages.messageId, messageId));

      console.log(`✅ Mensaje marcado como procesado: ${messageId}`);
    } catch (error) {
      console.error('❌ Error marcando mensaje como procesado:', error);
    }
  }

  /**
   * Verifica si existe un mensaje en la base de datos
   */
  async messageExists(messageId: string): Promise<boolean> {
    try {
      const result = await db
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.messageId, messageId))
        .limit(1);

      return result.length > 0;
    } catch (error) {
      console.error('❌ Error verificando existencia de mensaje:', error);
      return false;
    }
  }

  /**
   * Obtiene todos los mensajes no procesados de una cuenta
   */
  async getUnprocessedMessages(accountId: number): Promise<WhatsAppDatabaseMessage[]> {
    try {
      const result = await db
        .select()
        .from(whatsappMessages)
        .where(
          and(
            eq(whatsappMessages.accountId, accountId),
            eq(whatsappMessages.fromMe, false), // Solo mensajes entrantes
            eq(whatsappMessages.processedByAutoResponse, false) // No procesados
          )
        )
        .orderBy(desc(whatsappMessages.timestamp));

      return result.map(msg => ({
        id: msg.messageId,
        accountId: msg.accountId!,
        chatId: msg.chatId,
        contactName: msg.contactName || undefined,
        body: msg.body || undefined,
        fromMe: msg.fromMe || false,
        timestamp: msg.timestamp || new Date(),
        type: msg.mediaType || 'text',
        processedByAutoResponse: msg.processedByAutoResponse || false,
        autoResponseGenerated: msg.autoResponseGenerated || undefined,
      }));
    } catch (error) {
      console.error('❌ Error obteniendo mensajes no procesados:', error);
      return [];
    }
  }

  /**
   * Limpia mensajes antiguos (opcional, para mantener la DB limpia)
   */
  async cleanOldMessages(daysOld: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      await db
        .delete(whatsappMessages)
        .where(gt(whatsappMessages.createdAt, cutoffDate));

      console.log(`🧹 Mensajes antiguos limpiados (> ${daysOld} días)`);
    } catch (error) {
      console.error('❌ Error limpiando mensajes antiguos:', error);
    }
  }
}

// Instancia singleton
export const databaseMessageService = new DatabaseMessageService();