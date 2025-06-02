/**
 * Sistema funcional de respuestas automáticas para WhatsApp
 */

import OpenAI from 'openai';

export class WorkingAutoResponseService {
  /**
   * Procesa un mensaje entrante y envía respuesta automática
   */
  static async processIncomingMessage(
    accountId: number,
    chatId: string,
    messageBody: string,
    whatsappClient: any
  ): Promise<boolean> {
    
    try {
      console.log(`🤖 PROCESANDO RESPUESTA AUTOMÁTICA para cuenta ${accountId}, chat: ${chatId}`);
      console.log(`📝 Mensaje recibido: "${messageBody}"`);
      
      // Verificar que el cliente de WhatsApp esté disponible
      if (!whatsappClient) {
        console.log(`❌ Cliente de WhatsApp no disponible para cuenta ${accountId}`);
        return false;
      }
      
      // Obtener configuración actual de la cuenta
      const accountConfig = await this.getAccountConfiguration(accountId);
      if (!accountConfig || !accountConfig.autoResponseEnabled) {
        console.log(`⏭️ Respuestas automáticas deshabilitadas para cuenta ${accountId}`);
        return false;
      }
      
      // SISTEMA AI PERSONALIZADO: Usar configuración AI en lugar de agentes externos
      console.log(`🤖 Usando configuración AI personalizada para cuenta ${accountId}`);
      
      // Generar respuesta usando la configuración AI personalizada
      const response = await this.generateAIResponse(messageBody, accountId);
      
      if (!response) {
        console.log(`❌ No se pudo generar respuesta automática`);
        return false;
      }
      
      console.log(`✅ Respuesta generada: "${response}"`);
      
      // Enviar respuesta por WhatsApp
      await whatsappClient.sendMessage(chatId, response);
      console.log(`📤 Respuesta enviada exitosamente a ${chatId}`);
      
      return true;
      
    } catch (error) {
      console.error(`❌ Error en respuesta automática:`, error);
      return false;
    }
  }

  /**
   * Obtiene la configuración actual de la cuenta de WhatsApp
   */
  private static async getAccountConfiguration(accountId: number) {
    try {
      const { db } = await import('../db');
      const { whatsappAccounts } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const [account] = await db
        .select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.id, accountId))
        .limit(1);
      
      return account || null;
    } catch (error) {
      console.error(`❌ Error obteniendo configuración de cuenta ${accountId}:`, error);
      return null;
    }
  }

  /**
   * Genera respuesta usando configuración AI personalizada de AI Settings
   */
  private static async generateAIResponse(messageBody: string, accountId: number): Promise<string | null> {
    try {
      // Obtener configuración AI personalizada
      const { IntelligentResponseService } = await import('./intelligentResponseService');
      
      console.log(`🤖 Generando respuesta con configuración AI personalizada para cuenta ${accountId}`);
      console.log(`📝 Mensaje: "${messageBody}"`);
      
      // Usar el servicio de respuestas inteligentes que lee la configuración AI
      const response = await IntelligentResponseService.generateResponse(messageBody, accountId);
      
      if (response) {
        console.log(`✅ Respuesta AI personalizada generada: "${response}"`);
        return response;
      }
      
      console.log(`⚠️ No se pudo generar respuesta con configuración AI, usando fallback`);
      return "Gracias por tu mensaje. Te responderemos a la brevedad.";
      
    } catch (error) {
      console.error(`❌ Error generando respuesta AI personalizada:`, error);
      // Fallback a respuesta predeterminada
      return "Gracias por tu mensaje. Te responderemos a la brevedad.";
    }
  }
}