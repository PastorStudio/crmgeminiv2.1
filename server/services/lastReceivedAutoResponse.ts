/**
 * Sistema de respuestas automáticas basado en el último mensaje recibido
 * Utiliza el mensaje con indicador rojo "ÚLTIMO RECIBIDO"
 */

import { db } from '../db';
import { whatsappAccounts, externalAgents } from '@shared/schema';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';

export class LastReceivedAutoResponse {
  
  /**
   * Procesa el último mensaje recibido (marcado con indicador rojo) 
   * y genera respuesta automática con el agente externo asignado
   */
  static async processLastReceivedMessage(data: {
    accountId: number;
    chatId: string;
    lastReceivedMessage: string;
  }): Promise<{ success: boolean; response?: string; error?: string }> {
    
    try {
      console.log(`🔴 PROCESANDO ÚLTIMO MENSAJE RECIBIDO para cuenta ${data.accountId}`);
      console.log(`📨 Mensaje: "${data.lastReceivedMessage.substring(0, 100)}..."`);
      
      // Obtener configuración de la cuenta
      const accountConfig = await db.select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.id, data.accountId));
      
      if (accountConfig.length === 0) {
        console.log('❌ Cuenta no encontrada');
        return { success: false, error: 'Cuenta no encontrada' };
      }
      
      const account = accountConfig[0];
      
      // Verificar si tiene respuestas automáticas activadas
      if (!account.autoResponseEnabled) {
        console.log('⏭️ Respuestas automáticas no activadas');
        return { success: false, error: 'Respuestas automáticas no activadas' };
      }
      
      // Verificar si tiene agente asignado
      if (!account.assignedExternalAgentId) {
        console.log('⏭️ No hay agente externo asignado');
        return { success: false, error: 'No hay agente externo asignado' };
      }
      
      // Obtener información del agente externo
      const agentInfo = await db.select()
        .from(externalAgents)
        .where(eq(externalAgents.id, account.assignedExternalAgentId));
      
      if (agentInfo.length === 0) {
        console.log('❌ Agente externo no encontrado');
        return { success: false, error: 'Agente externo no encontrado' };
      }
      
      const agent = agentInfo[0];
      console.log(`🤖 Generando respuesta con agente: ${agent.agentName}`);
      
      // Verificar que tenemos clave OpenAI
      if (!process.env.OPENAI_API_KEY) {
        console.log('❌ Clave OpenAI no configurada');
        return { success: false, error: 'Clave OpenAI no configurada' };
      }
      
      // Generar respuesta usando OpenAI
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const systemPrompt = `Eres ${agent.agentName}, un asistente virtual profesional y amigable. 
      Responde de manera útil y conversacional en español. 
      Mantén las respuestas concisas pero informativas.
      Actúa como un experto en atención al cliente.`;
      
      console.log(`📤 Enviando a OpenAI con agente: ${agent.agentName}`);
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: data.lastReceivedMessage }
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      const autoResponse = response.choices[0].message.content || 'Lo siento, no pude procesar tu mensaje.';
      
      console.log(`✅ RESPUESTA GENERADA: ${autoResponse.substring(0, 100)}...`);
      
      // Enviar respuesta a WhatsApp
      await this.sendToWhatsApp(data.accountId, data.chatId, autoResponse, agent.agentName);
      
      return { 
        success: true, 
        response: autoResponse 
      };
      
    } catch (error) {
      console.error('❌ Error procesando último mensaje recibido:', error);
      return { 
        success: false, 
        error: `Error interno: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
  
  /**
   * Envía la respuesta automática a WhatsApp
   */
  private static async sendToWhatsApp(accountId: number, chatId: string, message: string, agentName: string): Promise<void> {
    try {
      console.log(`📱 Enviando respuesta automática a WhatsApp - Chat: ${chatId}`);
      
      // Importar el servicio de WhatsApp
      const { whatsappServiceMulti } = await import('./whatsappServiceMulti');
      
      // Enviar mensaje usando el servicio de WhatsApp
      await whatsappServiceMulti.sendMessage(accountId, chatId, {
        message: message,
        isAutoResponse: true,
        source: `Agente: ${agentName}`
      });
      
      console.log(`🚀 Respuesta automática enviada exitosamente por ${agentName}`);
      
    } catch (error) {
      console.error('❌ Error enviando respuesta a WhatsApp:', error);
      throw error;
    }
  }
}