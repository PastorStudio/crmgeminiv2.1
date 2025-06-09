/**
 * Intelligent Auto Response System
 * Handles conversation context and uses configured prompt settings
 */
import { db } from '../db';
import { whatsappAccounts, whatsappMessages, conversations } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import OpenAI from 'openai';

interface ConversationContext {
  messageCount: number;
  lastMessageTime: Date;
  lastBotResponse: string | null;
  userMessages: string[];
  botResponses: string[];
}

interface AccountConfig {
  customPrompt: string | null;
  temperature: number;
  maxTokens: number;
  agentName: string;
}

const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY
});

export class IntelligentAutoResponder {
  
  /**
   * Procesa mensaje entrante con contexto inteligente
   */
  static async processMessage(
    chatId: string,
    messageId: string,
    messageText: string,
    fromMe: boolean,
    accountId: number,
    whatsappInstance?: any
  ): Promise<boolean> {
    
    // Solo procesar mensajes recibidos, no enviados
    if (fromMe) {
      console.log(`📤 Mensaje enviado ignorado: ${messageId}`);
      return false;
    }
    
    // Verificar si la cuenta tiene respuestas automáticas habilitadas
    const accountConfig = await this.getAccountConfig(accountId);
    if (!accountConfig) {
      return false;
    }
    
    console.log(`🤖 Procesando mensaje inteligente para cuenta ${accountId}`);
    console.log(`💬 Mensaje: "${messageText.substring(0, 50)}..."`);
    
    try {
      // Obtener contexto de conversación
      const context = await this.getConversationContext(chatId, accountId);
      
      // Generar respuesta inteligente basada en contexto
      const response = await this.generateIntelligentResponse(
        messageText,
        context,
        accountConfig
      );
      
      if (response) {
        // Enviar respuesta
        if (whatsappInstance?.sendMessage) {
          await whatsappInstance.sendMessage(chatId, response);
          console.log(`📤 Respuesta inteligente enviada: "${response.substring(0, 50)}..."`);
          
          // Guardar respuesta en historial
          await this.saveResponseToHistory(chatId, accountId, messageText, response);
        }
        
        return true;
      }
      
    } catch (error) {
      console.error(`❌ Error en respuesta inteligente:`, error);
    }
    
    return false;
  }
  
  /**
   * Obtiene configuración de la cuenta WhatsApp
   */
  private static async getAccountConfig(accountId: number): Promise<AccountConfig | null> {
    try {
      const account = await db.select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.id, accountId))
        .limit(1);
      
      if (!account[0] || !account[0].autoResponseEnabled) {
        return null;
      }
      
      return {
        customPrompt: account[0].assignedExternalAgentId || null,
        temperature: 0.7,
        maxTokens: 150,
        agentName: account[0].assignedExternalAgentId || 'Asistente Virtual'
      };
      
    } catch (error) {
      console.error('❌ Error obteniendo configuración de cuenta:', error);
      return null;
    }
  }
  
  /**
   * Obtiene contexto de conversación reciente
   */
  private static async getConversationContext(chatId: string, accountId: number): Promise<ConversationContext> {
    try {
      // Obtener últimos 10 mensajes de la conversación
      const recentMessages = await db.select()
        .from(whatsappMessages)
        .where(
          and(
            eq(whatsappMessages.chatId, chatId),
            eq(whatsappMessages.accountId, accountId)
          )
        )
        .orderBy(desc(whatsappMessages.timestamp))
        .limit(10);
      
      const userMessages: string[] = [];
      const botResponses: string[] = [];
      let lastBotResponse: string | null = null;
      
      recentMessages.forEach(msg => {
        if (msg.direction === 'inbound') {
          userMessages.push(msg.content);
        } else if (msg.direction === 'outbound') {
          botResponses.push(msg.content);
          if (!lastBotResponse) {
            lastBotResponse = msg.content;
          }
        }
      });
      
      return {
        messageCount: recentMessages.length,
        lastMessageTime: recentMessages[0]?.timestamp || new Date(),
        lastBotResponse,
        userMessages: userMessages.reverse(), // Orden cronológico
        botResponses: botResponses.reverse()
      };
      
    } catch (error) {
      console.error('❌ Error obteniendo contexto:', error);
      return {
        messageCount: 0,
        lastMessageTime: new Date(),
        lastBotResponse: null,
        userMessages: [],
        botResponses: []
      };
    }
  }
  
  /**
   * Genera respuesta inteligente basada en contexto
   */
  private static async generateIntelligentResponse(
    message: string,
    context: ConversationContext,
    config: AccountConfig
  ): Promise<string | null> {
    try {
      const isFirstMessage = context.messageCount === 0;
      const hasRecentBotResponse = context.lastBotResponse && 
        (Date.now() - context.lastMessageTime.getTime()) < 300000; // 5 minutos
      
      // Construir prompt inteligente
      let systemPrompt = config.customPrompt || 
        `Eres ${config.agentName}, un asistente virtual de atención al cliente.`;
      
      // Agregar instrucciones contextuales
      if (isFirstMessage) {
        systemPrompt += `\n\nEsta es la primera interacción con este cliente. Salúdalo de manera amigable y pregunta cómo puedes ayudarle.`;
      } else {
        systemPrompt += `\n\nEsta es una conversación continua. NO repitas saludos ni presentaciones. Responde directamente al mensaje del cliente de manera natural y útil.`;
        
        if (hasRecentBotResponse) {
          systemPrompt += `\n\nTu última respuesta fue: "${context.lastBotResponse}"`;
          systemPrompt += `\nContinúa la conversación de manera coherente sin repetir información.`;
        }
      }
      
      systemPrompt += `\n\nMantén las respuestas concisas (máximo 2-3 líneas) y profesionales. Si no puedes ayudar, ofrece derivar con un agente humano.`;
      
      // Construir historial de conversación
      const messages: any[] = [
        { role: "system", content: systemPrompt }
      ];
      
      // Agregar contexto de conversación reciente (últimos 3 intercambios)
      const maxHistory = Math.min(3, Math.min(context.userMessages.length, context.botResponses.length));
      for (let i = Math.max(0, context.userMessages.length - maxHistory); i < context.userMessages.length - 1; i++) {
        messages.push({ role: "user", content: context.userMessages[i] });
        if (context.botResponses[i]) {
          messages.push({ role: "assistant", content: context.botResponses[i] });
        }
      }
      
      // Agregar mensaje actual
      messages.push({ role: "user", content: message });
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        max_tokens: config.maxTokens,
        temperature: config.temperature
      });
      
      const generatedResponse = response.choices[0]?.message?.content;
      
      if (generatedResponse) {
        console.log(`✅ Respuesta inteligente generada (${isFirstMessage ? 'primer mensaje' : 'conversación continua'})`);
        return generatedResponse;
      }
      
      return null;
      
    } catch (error) {
      console.error('❌ Error generando respuesta inteligente:', error);
      return null;
    }
  }
  
  /**
   * Guarda respuesta en historial para contexto futuro
   */
  private static async saveResponseToHistory(
    chatId: string,
    accountId: number,
    userMessage: string,
    botResponse: string
  ): Promise<void> {
    try {
      // Obtener o crear conversación
      let conversation = await db.select()
        .from(conversations)
        .where(
          and(
            eq(conversations.chatId, chatId),
            eq(conversations.whatsappAccountId, accountId)
          )
        )
        .limit(1);
      
      let conversationId: number;
      
      if (conversation.length === 0) {
        const newConversation = await db.insert(conversations)
          .values({
            chatId,
            whatsappAccountId: accountId,
            status: 'active',
            lastMessageAt: new Date(),
            messageCount: 1
          })
          .returning();
        
        conversationId = newConversation[0].id;
      } else {
        conversationId = conversation[0].id;
        
        // Actualizar conversación
        await db.update(conversations)
          .set({
            lastMessageAt: new Date(),
            messageCount: conversation[0].messageCount + 1
          })
          .where(eq(conversations.id, conversationId));
      }
      
      // Guardar respuesta del bot
      await db.insert(whatsappMessages)
        .values({
          messageId: `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          chatId,
          content: botResponse,
          direction: 'outbound',
          timestamp: new Date(),
          whatsappAccountId: accountId,
          conversationId,
          messageType: 'text',
          isProcessed: true
        });
      
    } catch (error) {
      console.error('❌ Error guardando respuesta en historial:', error);
    }
  }
}