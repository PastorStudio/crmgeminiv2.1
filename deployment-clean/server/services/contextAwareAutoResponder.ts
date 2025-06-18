/**
 * Context-Aware Auto Response System
 * Fixes repetitive greetings and uses conversation history
 */
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY
});

// Almacena el contexto de conversaciones por chat
const conversationContexts = new Map<string, {
  messageCount: number;
  lastResponse: string | null;
  lastMessageTime: number;
  recentMessages: Array<{ role: 'user' | 'assistant'; content: string; time: number }>;
}>();

export class ContextAwareAutoResponder {
  
  /**
   * Procesa mensaje con contexto de conversación
   */
  static async processMessage(
    accountId: number,
    chatId: string,
    messageText: string,
    fromMe: boolean,
    whatsappClient: any
  ): Promise<boolean> {
    
    // Solo procesar mensajes recibidos, no enviados
    if (fromMe) {
      console.log(`📤 Mensaje enviado ignorado en chat ${chatId}`);
      return false;
    }
    
    // Verificar si la cuenta tiene respuestas automáticas habilitadas
    const isEnabled = await this.isAutoResponseEnabled(accountId);
    if (!isEnabled) {
      console.log(`🔒 Respuestas automáticas deshabilitadas para cuenta ${accountId}`);
      return false;
    }
    
    console.log(`🤖 Procesando mensaje con contexto para cuenta ${accountId}`);
    console.log(`💬 Chat: ${chatId} | Mensaje: "${messageText.substring(0, 50)}..."`);
    
    try {
      // Obtener o inicializar contexto de conversación
      const context = this.getOrCreateContext(chatId);
      
      // Determinar tipo de respuesta basado en contexto
      const responseType = this.determineResponseType(context, messageText);
      
      // Generar respuesta contextual
      const response = await this.generateContextualResponse(
        messageText,
        context,
        responseType,
        accountId
      );
      
      if (response) {
        // Enviar respuesta
        await whatsappClient.sendMessage(chatId, response);
        
        // Actualizar contexto
        this.updateContext(chatId, messageText, response);
        
        console.log(`✅ Respuesta contextual enviada: "${response.substring(0, 50)}..."`);
        return true;
      }
      
    } catch (error) {
      console.error(`❌ Error en respuesta contextual:`, error);
    }
    
    return false;
  }
  
  /**
   * Verifica si las respuestas automáticas están habilitadas
   */
  private static async isAutoResponseEnabled(accountId: number): Promise<boolean> {
    try {
      // Importar dinámicamente para evitar dependencias circulares
      const { storage } = await import('../storage');
      const account = await storage.getWhatsappAccount(accountId);
      return account?.autoResponseEnabled || false;
    } catch (error) {
      console.error('Error verificando estado de respuestas automáticas:', error);
      return false;
    }
  }
  
  /**
   * Obtiene o crea contexto de conversación
   */
  private static getOrCreateContext(chatId: string) {
    if (!conversationContexts.has(chatId)) {
      conversationContexts.set(chatId, {
        messageCount: 0,
        lastResponse: null,
        lastMessageTime: 0,
        recentMessages: []
      });
    }
    return conversationContexts.get(chatId)!;
  }
  
  /**
   * Determina el tipo de respuesta basado en contexto
   */
  private static determineResponseType(context: any, messageText: string): 'greeting' | 'continuation' | 'followup' {
    const timeSinceLastMessage = Date.now() - context.lastMessageTime;
    const fiveMinutes = 5 * 60 * 1000;
    
    // Primera interacción o después de mucho tiempo = saludo
    if (context.messageCount === 0 || timeSinceLastMessage > fiveMinutes) {
      return 'greeting';
    }
    
    // Mensaje de seguimiento reciente
    if (context.messageCount > 0 && timeSinceLastMessage < fiveMinutes) {
      return 'continuation';
    }
    
    return 'followup';
  }
  
  /**
   * Genera respuesta contextual basada en historial
   */
  private static async generateContextualResponse(
    messageText: string,
    context: any,
    responseType: string,
    accountId: number
  ): Promise<string | null> {
    
    try {
      // Construir prompt contextual
      let systemPrompt = '';
      
      switch (responseType) {
        case 'greeting':
          systemPrompt = `Eres un asistente virtual de atención al cliente. Esta es la primera interacción o después de un tiempo prolongado.
          Saluda de manera amigable y profesional, pregunta cómo puedes ayudar. Mantén el saludo breve (1-2 líneas).`;
          break;
          
        case 'continuation':
          systemPrompt = `Eres un asistente virtual de atención al cliente en una conversación activa.
          NO repitas saludos ni presentaciones. Responde directamente al mensaje del cliente de manera útil y natural.
          Mantén la respuesta concisa y enfocada en resolver su consulta.`;
          break;
          
        case 'followup':
          systemPrompt = `Eres un asistente virtual de atención al cliente dando seguimiento a una conversación previa.
          Reconoce la continuidad de la conversación y responde de manera coherente. Evita repetir información ya proporcionada.`;
          break;
      }
      
      systemPrompt += `\nSiempre responde en español, de manera profesional pero cercana. Máximo 2-3 líneas por respuesta.`;
      
      // Construir historial de mensajes recientes
      const messages: any[] = [
        { role: "system", content: systemPrompt }
      ];
      
      // Agregar contexto de mensajes recientes (últimos 3)
      const recentMessages = context.recentMessages.slice(-3);
      recentMessages.forEach((msg: any) => {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      });
      
      // Agregar mensaje actual
      messages.push({ role: "user", content: messageText });
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        max_tokens: 150,
        temperature: 0.7
      });
      
      const generatedResponse = response.choices[0]?.message?.content;
      
      if (generatedResponse) {
        console.log(`✅ Respuesta ${responseType} generada exitosamente`);
        return generatedResponse;
      }
      
      return null;
      
    } catch (error) {
      console.error('Error generando respuesta contextual:', error);
      return null;
    }
  }
  
  /**
   * Actualiza contexto de conversación
   */
  private static updateContext(chatId: string, userMessage: string, botResponse: string): void {
    const context = conversationContexts.get(chatId);
    if (!context) return;
    
    const now = Date.now();
    
    // Actualizar contadores
    context.messageCount++;
    context.lastResponse = botResponse;
    context.lastMessageTime = now;
    
    // Agregar mensajes al historial
    context.recentMessages.push(
      { role: 'user', content: userMessage, time: now },
      { role: 'assistant', content: botResponse, time: now }
    );
    
    // Mantener solo los últimos 10 mensajes
    if (context.recentMessages.length > 10) {
      context.recentMessages = context.recentMessages.slice(-10);
    }
    
    // Limpiar contextos antiguos (más de 1 hora)
    this.cleanOldContexts();
  }
  
  /**
   * Limpia contextos antiguos para liberar memoria
   */
  private static cleanOldContexts(): void {
    const oneHour = 60 * 60 * 1000;
    const now = Date.now();
    
    for (const [chatId, context] of conversationContexts.entries()) {
      if (now - context.lastMessageTime > oneHour) {
        conversationContexts.delete(chatId);
      }
    }
  }
  
  /**
   * Obtiene estadísticas de contextos activos
   */
  static getStats(): { activeContexts: number; totalMessages: number } {
    let totalMessages = 0;
    
    for (const context of conversationContexts.values()) {
      totalMessages += context.messageCount;
    }
    
    return {
      activeContexts: conversationContexts.size,
      totalMessages
    };
  }
}