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
      
      // Generar respuesta usando OpenAI
      const response = await this.generateOpenAIResponse(messageBody);
      
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
   * Genera una respuesta usando OpenAI
   */
  private static async generateOpenAIResponse(messageBody: string): Promise<string | null> {
    try {
      const openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY 
      });

      if (!process.env.OPENAI_API_KEY) {
        console.log(`❌ OpenAI API key no disponible`);
        return "Gracias por tu mensaje. Te responderemos a la brevedad.";
      }

      console.log(`🤖 Generando respuesta con OpenAI para: "${messageBody}"`);
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "Eres un asistente de atención al cliente profesional. Responde de manera amable, útil y en español. Mantén las respuestas concisas y profesionales."
          },
          {
            role: "user",
            content: messageBody
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      });

      const generatedResponse = response.choices[0].message.content;
      console.log(`✅ Respuesta OpenAI generada: "${generatedResponse}"`);
      
      return generatedResponse;
      
    } catch (error) {
      console.error(`❌ Error generando respuesta OpenAI:`, error);
      // Fallback a respuesta predeterminada
      return "Gracias por tu mensaje. Te responderemos a la brevedad.";
    }
  }
}