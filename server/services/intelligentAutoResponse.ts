/**
 * Sistema Inteligente de Respuestas Automáticas
 * Mantiene conversaciones genuinas usando IA gratuita con identificación de prompts
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../db.js';
import { whatsappMessages, contacts, aiPrompts, whatsappAccounts } from '../../shared/schema';
import { eq, and, desc, gt } from 'drizzle-orm';
import { naturalConversationAI } from './naturalConversationAI.js';
import { unifiedAIProvider } from './unifiedAIProvider.js';

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
   * Procesa mensaje entrante y genera respuesta inteligente usando múltiples proveedores AI
   */
  async processIncomingMessage(
    accountId: number,
    chatId: string,
    message: string,
    fromNumber: string
  ): Promise<AIResponse | null> {
    try {
      console.log(`🧠 Procesando mensaje con IA múltiple: "${message}"`);

      // Get conversation context
      const context = await this.getConversationContext(accountId, chatId, fromNumber);
      
      if (!context) {
        console.log('⚠️ No se pudo obtener contexto de conversación');
        return null;
      }

      // Determine which AI provider to use based on prompt assignment
      let selectedProvider = 'gemini'; // default
      
      if (context.assignedPrompt) {
        // Extract provider from prompt if specified
        if (context.assignedPrompt.toLowerCase().includes('openai')) {
          selectedProvider = 'openai';
        } else if (context.assignedPrompt.toLowerCase().includes('qwen')) {
          selectedProvider = 'qwen';
        } else if (context.assignedPrompt.toLowerCase().includes('deepseek')) {
          selectedProvider = 'deepseek';
        }
      }

      console.log(`🎯 Using AI provider: ${selectedProvider}`);

      // Generate response using unified AI provider
      const aiResponse = await unifiedAIProvider.generateWithFallback(
        message,
        selectedProvider
      );

      if (!aiResponse.success || !aiResponse.message) {
        console.log('⚠️ No se pudo generar respuesta con proveedores AI');
        return null;
      }

      // Update conversation state
      const nextState = this.determineNextState(message, context);
      
      return {
        message: aiResponse.message,
        confidence: aiResponse.confidence,
        nextState,
        shouldSendFarewell: false,
        needsHumanIntervention: aiResponse.confidence < 70
      };

    } catch (error) {
      console.error('❌ Error procesando mensaje inteligente:', error);
      return null;
    }
  }

  /**
   * Get conversation context from database
   */
  private async getConversationContext(
    accountId: number,
    chatId: string,
    fromNumber: string
  ): Promise<ConversationContext | null> {
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

      // Crear prompt optimizado para respuestas naturales
      const systemPrompt = `Eres un asistente de WhatsApp natural y auténtico.

REGLAS ESTRICTAS - NUNCA uses:
❌ "Gracias por escribirnos"
❌ "Le saluda [nombre]"
❌ "Departamento de"
❌ "Sistema Municipal"
❌ "Servicio al Cliente"
❌ "Estoy aquí para apoyarle"
❌ "¿en qué puedo ayudarle?"

PERSONALIDAD:
- Habla como una persona real del equipo
- Usa lenguaje cotidiano de WhatsApp
- Sé específico según el mensaje
- Varía tus respuestas

CONTEXTO:
Cliente: ${context.contactName}
Estado: ${context.conversationState}
Conversación:
${conversationHistory}

MENSAJE: "${currentMessage}"

INSTRUCCIONES:
1. Responde de forma directa y específica
2. Usa 1-2 emojis máximo si es natural
3. Habla en primera persona
4. Sé conversacional, no corporativo
5. Máximo 100 caracteres

Responde SOLO el mensaje natural (sin JSON, sin formato):`;

      const result = await model.generateContent(systemPrompt);
      const response = await result.response;
      const text = response.text();

      // Limpiar respuesta de la IA
      let cleanedResponse = text.trim();
      
      // Remover frases genéricas si aparecen
      const genericPhrases = [
        /gracias por escribir(nos|te)/gi,
        /le saluda \w+/gi,
        /departamento de \w+/gi,
        /sistema municipal/gi,
        /servicio al (cliente|ciudadano)/gi,
        /estoy aquí para apoyar(le|te)/gi
      ];
      
      genericPhrases.forEach(phrase => {
        cleanedResponse = cleanedResponse.replace(phrase, '');
      });
      
      cleanedResponse = cleanedResponse.replace(/\s+/g, ' ').trim();
      
      // Si quedó muy corto o vacío, usar fallback natural
      if (cleanedResponse.length < 10) {
        const fallbacks = [
          "¡Hola! ¿En qué te ayudo?",
          "¡Hey! ¿Qué necesitas?",
          "¡Buenas! ¿Cómo puedo ayudarte?",
          "¡Hola! ¿Qué tal?"
        ];
        cleanedResponse = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      }

      return {
        message: cleanedResponse,
        confidence: this.calculateResponseConfidence(cleanedResponse, currentMessage),
        nextState: this.determineNextState(currentMessage),
        shouldSendFarewell: this.shouldSendFarewell(currentMessage),
        needsHumanIntervention: this.needsHumanIntervention(currentMessage)
      };
    } catch (error) {
      console.error('Error generando respuesta IA:', error);
      
      // Respuesta de fallback basada en contexto
      return this.generateFallbackResponse(context, currentMessage);
    }
  }

  /**
   * Calcula confianza de la respuesta
   */
  private calculateResponseConfidence(response: string, message: string): number {
    let confidence = 75;
    
    if (response.length > 15 && response.length < 120) confidence += 10;
    if (response.toLowerCase().includes('gracias por escribirnos')) confidence -= 30;
    if (response.toLowerCase().includes('departamento de')) confidence -= 25;
    
    return Math.min(95, Math.max(40, confidence));
  }

  /**
   * Determina próximo estado
   */
  private determineNextState(message: string): string {
    const lower = message.toLowerCase();
    if (lower.includes('precio') || lower.includes('costo')) return 'sales';
    if (lower.includes('problema') || lower.includes('ayuda')) return 'support';
    if (lower.includes('gracias') || lower.includes('chao')) return 'farewell';
    return 'ongoing';
  }

  /**
   * Verifica si debe enviar despedida
   */
  private shouldSendFarewell(message: string): boolean {
    const farewells = ['gracias', 'chao', 'bye', 'hasta luego'];
    return farewells.some(f => message.toLowerCase().includes(f));
  }

  /**
   * Verifica si necesita intervención humana
   */
  private needsHumanIntervention(message: string): boolean {
    const escalation = ['supervisor', 'gerente', 'queja', 'reclamo'];
    return escalation.some(e => message.toLowerCase().includes(e));
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