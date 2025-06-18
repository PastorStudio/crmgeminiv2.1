/**
 * Sistema Inteligente de Respuestas Automáticas
 * Mantiene conversaciones genuinas usando IA gratuita con identificación de prompts
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../db.js';
import { whatsappMessages, contacts, aiPrompts, whatsappAccounts } from '../../shared/schema';
import { eq, and, desc, gt } from 'drizzle-orm';
import { naturalConversationAI } from './naturalConversationAI.js';

interface ConversationContext {
  contactId: number;
  accountId: number;
  chatId: string;
  contactName: string;
  recentMessages: Array<{
    content: string;
    fromMe: boolean;
    timestamp: Date;
  }>;
  conversationState: 'greeting' | 'ongoing' | 'farewell' | 'support' | 'sales';
  lastResponseTime?: Date;
  assignedPrompt?: string;
}

interface AIResponse {
  message: string;
  confidence: number;
  nextState: string;
  shouldSendFarewell: boolean;
  needsHumanIntervention: boolean;
}

export class IntelligentAutoResponseService {
  private geminiAPI: GoogleGenerativeAI;
  private conversationStates = new Map<string, ConversationContext>();

  constructor() {
    // Usar Gemini gratuito
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key no configurada');
    }
    this.geminiAPI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Procesa mensaje entrante y genera respuesta inteligente
   */
  async processIncomingMessage(
    accountId: number,
    chatId: string,
    messageContent: string,
    fromNumber: string
  ): Promise<AIResponse | null> {
    try {
      // Obtener contexto de la conversación
      const context = await this.getConversationContext(accountId, chatId, fromNumber);
      if (!context) return null;

      // Determinar si necesita respuesta automática
      const shouldRespond = await this.shouldGenerateResponse(context, messageContent);
      if (!shouldRespond) return null;

      // Generar respuesta usando IA
      const response = await this.generateIntelligentResponse(context, messageContent);
      
      // Actualizar estado de conversación
      await this.updateConversationState(context, response);

      return response;
    } catch (error) {
      console.error('Error procesando mensaje inteligente:', error);
      return null;
    }
  }

  /**
   * Obtiene contexto completo de la conversación
   */
  private async getConversationContext(
    accountId: number,
    chatId: string,
    fromNumber: string
  ): Promise<ConversationContext | null> {
    try {
      // Obtener información de la cuenta y prompt asignado
      const accountInfo = await db
        .select({
          id: whatsappAccounts.id,
          name: whatsappAccounts.name,
          autoResponseEnabled: whatsappAccounts.autoResponseEnabled,
          assignedPromptId: whatsappAccounts.assignedPromptId,
          customPrompt: whatsappAccounts.customPrompt
        })
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.id, accountId))
        .limit(1);

      if (!accountInfo.length || !accountInfo[0].autoResponseEnabled) {
        return null;
      }

      // Obtener prompt asignado
      let assignedPrompt = accountInfo[0].customPrompt || '';
      if (accountInfo[0].assignedPromptId) {
        const promptData = await db
          .select({ content: aiPrompts.content })
          .from(aiPrompts)
          .where(eq(aiPrompts.id, accountInfo[0].assignedPromptId))
          .limit(1);
        
        if (promptData.length) {
          assignedPrompt = promptData[0].content;
        }
      }

      // Buscar contacto existente
      let contact = await db
        .select()
        .from(contacts)
        .where(eq(contacts.phone, fromNumber))
        .limit(1);

      let contactId: number;
      let contactName: string;

      if (contact.length === 0) {
        // Crear nuevo contacto
        const newContact = await db
          .insert(contacts)
          .values({
            name: `Cliente ${fromNumber.slice(-4)}`,
            phone: fromNumber
          })
          .returning({ id: contacts.id, name: contacts.name });
        
        contactId = newContact[0].id;
        contactName = newContact[0].name;
      } else {
        contactId = contact[0].id;
        contactName = contact[0].name;
      }

      // Obtener mensajes recientes (últimos 10)
      const recentMessages = await db
        .select({
          content: whatsappMessages.content,
          fromMe: whatsappMessages.from_me,
          timestamp: whatsappMessages.timestamp
        })
        .from(whatsappMessages)
        .where(
          and(
            eq(whatsappMessages.accountId, accountId),
            eq(whatsappMessages.chatId, chatId)
          )
        )
        .orderBy(desc(whatsappMessages.timestamp))
        .limit(10);

      // Determinar estado de conversación
      const conversationState = this.determineConversationState(recentMessages);

      return {
        contactId,
        accountId,
        chatId,
        contactName,
        recentMessages: recentMessages.reverse(), // Orden cronológico
        conversationState,
        assignedPrompt
      };
    } catch (error) {
      console.error('Error obteniendo contexto:', error);
      return null;
    }
  }

  /**
   * Determina si debe generar respuesta automática
   */
  private async shouldGenerateResponse(
    context: ConversationContext,
    messageContent: string
  ): Promise<boolean> {
    // No responder a mensajes vacíos
    if (!messageContent?.trim()) return false;

    // No responder si el último mensaje fue nuestro
    const lastMessage = context.recentMessages[context.recentMessages.length - 1];
    if (lastMessage?.fromMe) return false;

    // No responder más de una vez cada 30 segundos
    if (context.lastResponseTime) {
      const timeSince = Date.now() - context.lastResponseTime.getTime();
      if (timeSince < 30000) return false;
    }

    return true;
  }

  /**
   * Genera respuesta inteligente usando Gemini
   */
  private async generateIntelligentResponse(
    context: ConversationContext,
    currentMessage: string
  ): Promise<AIResponse> {
    try {
      const model = this.geminiAPI.getGenerativeModel({ model: 'gemini-pro' });

      // Construir historial de conversación
      const conversationHistory = context.recentMessages
        .map(msg => `${msg.fromMe ? 'Asistente' : 'Cliente'}: ${msg.content}`)
        .join('\n');

      // Crear prompt inteligente
      const systemPrompt = `
Eres un asistente de atención al cliente inteligente para WhatsApp. Tu objetivo es mantener conversaciones genuinas y naturales.

INFORMACIÓN DEL CONTACTO:
- Nombre: ${context.contactName}
- Estado de conversación: ${context.conversationState}

PROMPT PERSONALIZADO ASIGNADO:
${context.assignedPrompt || 'Proporciona atención al cliente profesional y amigable'}

HISTORIAL DE CONVERSACIÓN:
${conversationHistory}

MENSAJE ACTUAL DEL CLIENTE:
${currentMessage}

INSTRUCCIONES:
1. Responde de manera natural y conversacional
2. Adapta tu tono según el contexto de la conversación
3. Si es el primer mensaje, saluda cordialmente
4. Si la conversación está avanzada, da seguimiento apropiado
5. Si parece ser una despedida, responde con agradecimiento
6. Mantén respuestas concisas (máximo 2-3 oraciones)
7. Usa el prompt personalizado como guía de comportamiento

ESTADO DE CONVERSACIÓN:
- greeting: Primera interacción, saluda y presenta el servicio
- ongoing: Conversación en progreso, proporciona información útil
- support: Cliente necesita ayuda específica
- sales: Oportunidad de venta
- farewell: Cliente se despide

Responde en formato JSON:
{
  "message": "tu respuesta natural",
  "confidence": 0.85,
  "nextState": "ongoing",
  "shouldSendFarewell": false,
  "needsHumanIntervention": false
}
`;

      const result = await model.generateContent(systemPrompt);
      const response = await result.response;
      const text = response.text();

      try {
        const parsed = JSON.parse(text);
        return {
          message: parsed.message || 'Gracias por tu mensaje. ¿En qué puedo ayudarte?',
          confidence: parsed.confidence || 0.7,
          nextState: parsed.nextState || 'ongoing',
          shouldSendFarewell: parsed.shouldSendFarewell || false,
          needsHumanIntervention: parsed.needsHumanIntervention || false
        };
      } catch (parseError) {
        // Si no puede parsear JSON, usar respuesta de fallback natural
        return {
          message: text.trim() || 'Gracias por tu mensaje. ¿En qué puedo ayudarte?',
          confidence: 0.6,
          nextState: 'ongoing',
          shouldSendFarewell: false,
          needsHumanIntervention: false
        };
      }
    } catch (error) {
      console.error('Error generando respuesta IA:', error);
      
      // Respuesta de fallback basada en contexto
      return this.generateFallbackResponse(context, currentMessage);
    }
  }

  /**
   * Genera respuesta de fallback natural
   */
  private generateFallbackResponse(
    context: ConversationContext,
    message: string
  ): AIResponse {
    const lowerMessage = message.toLowerCase();
    
    // Patrones de saludo
    if (lowerMessage.includes('hola') || lowerMessage.includes('buenos') || 
        lowerMessage.includes('buenas') || context.conversationState === 'greeting') {
      return {
        message: `¡Hola ${context.contactName}! 👋 Gracias por contactarnos. ¿En qué podemos ayudarte hoy?`,
        confidence: 0.8,
        nextState: 'ongoing',
        shouldSendFarewell: false,
        needsHumanIntervention: false
      };
    }

    // Patrones de despedida
    if (lowerMessage.includes('gracias') || lowerMessage.includes('chau') || 
        lowerMessage.includes('adiós') || lowerMessage.includes('bye')) {
      return {
        message: `¡De nada ${context.contactName}! Fue un placer ayudarte. Que tengas un excelente día. 😊`,
        confidence: 0.8,
        nextState: 'farewell',
        shouldSendFarewell: true,
        needsHumanIntervention: false
      };
    }

    // Patrones de pregunta
    if (lowerMessage.includes('?') || lowerMessage.includes('información') || 
        lowerMessage.includes('precio') || lowerMessage.includes('costo')) {
      return {
        message: `Claro ${context.contactName}, con gusto te ayudo con esa información. Un momento mientras reviso los detalles para ti.`,
        confidence: 0.7,
        nextState: 'support',
        shouldSendFarewell: false,
        needsHumanIntervention: true
      };
    }

    // Respuesta general
    return {
      message: `Gracias por tu mensaje ${context.contactName}. He recibido tu consulta y te responderé a la brevedad.`,
      confidence: 0.6,
      nextState: 'ongoing',
      shouldSendFarewell: false,
      needsHumanIntervention: false
    };
  }

  /**
   * Determina estado de conversación basado en historial
   */
  private determineConversationState(
    messages: Array<{ content: string; fromMe: boolean; timestamp: Date }>
  ): 'greeting' | 'ongoing' | 'farewell' | 'support' | 'sales' {
    if (messages.length === 0) return 'greeting';
    
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage.content?.toLowerCase() || '';
    
    if (content.includes('hola') || content.includes('buenos')) return 'greeting';
    if (content.includes('gracias') || content.includes('chau')) return 'farewell';
    if (content.includes('precio') || content.includes('comprar')) return 'sales';
    if (content.includes('ayuda') || content.includes('problema')) return 'support';
    
    return 'ongoing';
  }

  /**
   * Actualiza estado de conversación
   */
  private async updateConversationState(
    context: ConversationContext,
    response: AIResponse
  ): Promise<void> {
    this.conversationStates.set(context.chatId, {
      ...context,
      conversationState: response.nextState as any,
      lastResponseTime: new Date()
    });
  }

  /**
   * Envía respuesta a WhatsApp
   */
  async sendResponse(
    accountId: number,
    chatId: string,
    message: string
  ): Promise<boolean> {
    try {
      // Integrar con el sistema de WhatsApp existente
      const whatsappManager = (global as any).whatsappManager;
      if (!whatsappManager) {
        console.error('WhatsApp manager no disponible');
        return false;
      }

      await whatsappManager.sendMessage(accountId, chatId, message);
      
      // Guardar mensaje enviado en base de datos
      await db.insert(whatsappMessages).values({
        chatId: chatId,
        messageId: `auto_${Date.now()}`,
        content: message,
        from_me: true,
        timestamp: new Date()
      });

      console.log(`✅ Respuesta automática enviada a ${chatId}: ${message.substring(0, 50)}...`);
      return true;
    } catch (error) {
      console.error('Error enviando respuesta automática:', error);
      return false;
    }
  }
}

export const intelligentAutoResponse = new IntelligentAutoResponseService();