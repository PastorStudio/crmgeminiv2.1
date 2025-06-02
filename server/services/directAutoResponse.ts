/**
 * Sistema de respuestas automáticas DIRECTO
 * Sin complicaciones, sin interceptaciones, solo funciona
 */

import OpenAI from 'openai';
import { db } from '../db';
import { whatsappAccounts, externalAgents } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface DirectMessage {
  accountId: number;
  chatId: string;
  messageText: string;
  fromMe: boolean;
}

export class DirectAutoResponse {
  /**
   * Función principal - recibe mensaje y genera respuesta automática
   */
  static async processMessage(message: DirectMessage): Promise<boolean> {
    try {
      console.log(`🚀 RESPUESTA DIRECTA - Mensaje: "${message.messageText}"`);
      
      // Si el mensaje es nuestro, ignorar
      if (message.fromMe) {
        console.log('⏭️ Mensaje propio, ignorando');
        return false;
      }
      
      // Buscar configuración de la cuenta directamente
      const accountConfig = await db.select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.id, message.accountId))
        .limit(1);
      
      if (accountConfig.length === 0) {
        console.log('❌ Cuenta no encontrada');
        return false;
      }
      
      const account = accountConfig[0];
      
      // Verificar si tiene respuestas automáticas activadas
      if (!account.autoResponseEnabled) {
        console.log('⏭️ Respuestas automáticas no activadas');
        return false;
      }
      
      // USAR CONFIGURACIÓN AI PERSONALIZADA en lugar de agentes externos
      console.log(`🤖 Generando respuesta con configuración AI personalizada para cuenta ${message.accountId}...`);
      
      // Generar respuesta usando la configuración AI personalizada
      const responseText = await this.generateAIResponse(message.messageText, message.accountId);
      
      if (!responseText) {
        console.log('❌ No se pudo generar respuesta con configuración AI');
        return false;
      }
      
      console.log(`✅ Respuesta AI personalizada generada: "${responseText}"`);
      console.log(`📤 RESPUESTA LISTA PARA ENVÍO al chat ${message.chatId}`);
      
      return true;
      
    } catch (error) {
      console.error('❌ Error en respuesta directa:', error);
      return false;
    }
  }
  
  /**
   * Genera respuesta usando configuración AI personalizada de AI Settings
   */
  private static async generateAIResponse(messageBody: string, accountId: number): Promise<string | null> {
    try {
      // Obtener configuración AI personalizada desde AI Settings
      const { IntelligentResponseService } = await import('./intelligentResponseService');
      
      console.log(`🤖 Usando configuración AI personalizada para cuenta ${accountId}`);
      console.log(`📝 Mensaje: "${messageBody}"`);
      
      // Usar el servicio de respuestas inteligentes que lee la configuración AI
      const response = await IntelligentResponseService.generateResponse(messageBody, accountId);
      
      if (response) {
        console.log(`✅ Respuesta AI personalizada: "${response}"`);
        return response;
      }
      
      console.log(`⚠️ No se pudo generar respuesta con configuración AI, usando fallback`);
      return "Gracias por tu mensaje. Te responderemos a la brevedad.";
      
    } catch (error) {
      console.error(`❌ Error generando respuesta AI personalizada:`, error);
      return "Gracias por tu mensaje. Te responderemos a la brevedad.";
    }
  }

  /**
   * Verificar si una cuenta tiene respuestas automáticas activas
   */
  static async hasAutoResponseActive(accountId: number): Promise<boolean> {
    try {
      const account = await db.select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.id, accountId))
        .limit(1);
      
      if (account.length === 0) return false;
      
      const acc = account[0];
      return acc.autoResponseEnabled === true;
    } catch (error) {
      console.error('Error verificando auto-respuesta:', error);
      return false;
    }
  }
}

export default DirectAutoResponse;