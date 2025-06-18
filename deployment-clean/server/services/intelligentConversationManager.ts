/**
 * Sistema Inteligente de Gestión de Conversaciones
 * - Elimina saludos repetitivos
 * - Mantiene contexto conversacional
 * - Incluye detección de geolocalización
 * - Conversaciones naturales basadas en historial
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { db } from '../db';
import { whatsappMessages, leads, whatsappAccounts } from '../../shared/schema';
import { eq, desc, and } from 'drizzle-orm';

interface ConversationContext {
  chatId: string;
  accountId: number;
  contactName: string;
  phone: string;
  conversationHistory: ConversationMessage[];
  hasGreeted: boolean;
  lastInteraction: Date;
  detectedLocation?: LocationInfo;
  conversationStage: ConversationStage;
  leadInfo?: any;
}

interface ConversationMessage {
  id: string;
  content: string;
  fromMe: boolean;
  timestamp: Date;
  messageType: 'greeting' | 'question' | 'response' | 'location' | 'business';
}

interface LocationInfo {
  country?: string;
  region?: string;
  city?: string;
  coordinates?: { lat: number; lng: number };
  detectedFrom: 'explicit' | 'inferred' | 'ip';
  confidence: number;
}

enum ConversationStage {
  INITIAL_CONTACT = 'initial_contact',
  LOCATION_GATHERING = 'location_gathering', 
  NEEDS_ASSESSMENT = 'needs_assessment',
  SOLUTION_OFFERING = 'solution_offering',
  FOLLOW_UP = 'follow_up',
  CLOSURE = 'closure'
}

export class IntelligentConversationManager {
  private static instance: IntelligentConversationManager;
  private conversationContexts: Map<string, ConversationContext> = new Map();
  private geminiClient: GoogleGenerativeAI | null = null;
  private openaiClient: OpenAI | null = null;
  private locationPatterns: RegExp[];

  private constructor() {
    this.initializeAIClients();
    this.setupLocationPatterns();
  }

  static getInstance(): IntelligentConversationManager {
    if (!IntelligentConversationManager.instance) {
      IntelligentConversationManager.instance = new IntelligentConversationManager();
    }
    return IntelligentConversationManager.instance;
  }

  private initializeAIClients(): void {
    try {
      // Inicializar Gemini
      const geminiKey = process.env.GOOGLE_AI_API_KEY;
      if (geminiKey) {
        this.geminiClient = new GoogleGenerativeAI(geminiKey);
        console.log('🧠 Gemini AI inicializado para conversaciones inteligentes');
      }

      // Inicializar OpenAI
      const openaiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
      if (openaiKey) {
        this.openaiClient = new OpenAI({ apiKey: openaiKey });
        console.log('🤖 OpenAI inicializado para conversaciones inteligentes');
      }
    } catch (error) {
      console.error('❌ Error inicializando clientes AI:', error);
    }
  }

  private setupLocationPatterns(): void {
    this.locationPatterns = [
      // Países de Latinoamérica
      /\b(panamá|panama|costa rica|guatemala|honduras|nicaragua|el salvador|méxico|mexico|colombia|venezuela|ecuador|perú|peru|bolivia|chile|argentina|uruguay|paraguay|brasil|brazil)\b/gi,
      // Ciudades principales
      /\b(ciudad de panamá|san josé|guatemala city|tegucigalpa|managua|san salvador|ciudad de méxico|bogotá|caracas|quito|lima|la paz|santiago|buenos aires|montevideo|asunción|brasilia|são paulo|rio de janeiro)\b/gi,
      // Provincias/Estados
      /\b(chiriquí|coclé|colón|herrera|los santos|panamá oeste|veraguas|darién)\b/gi,
      // Indicadores de ubicación
      /\b(vivo en|estoy en|me encuentro en|soy de|desde|ubicado en|zona|sector|barrio|distrito)\b/gi
    ];
  }

  /**
   * Procesa un mensaje entrante y genera una respuesta contextual inteligente
   */
  async processIntelligentMessage(
    message: string,
    chatId: string,
    accountId: number,
    contactName: string,
    phone: string,
    customPrompt?: string
  ): Promise<string | null> {
    try {
      // Obtener o crear contexto de conversación
      let context = await this.getOrCreateConversationContext(chatId, accountId, contactName, phone);
      
      // Analizar el mensaje
      const messageAnalysis = await this.analyzeMessage(message, context);
      
      // Actualizar contexto con el nuevo mensaje
      context = await this.updateConversationContext(context, message, messageAnalysis);
      
      // Detectar ubicación si está presente
      const locationInfo = this.detectLocationInMessage(message);
      if (locationInfo) {
        context.detectedLocation = locationInfo;
        console.log(`📍 Ubicación detectada para ${contactName}: ${locationInfo.city || locationInfo.region || locationInfo.country}`);
      }

      // Generar respuesta inteligente basada en contexto
      const response = await this.generateContextualResponse(context, message, customPrompt);
      
      // Guardar respuesta en el contexto
      if (response) {
        await this.saveResponseToContext(context, response);
      }

      return response;

    } catch (error) {
      console.error('❌ Error procesando mensaje inteligente:', error);
      return null;
    }
  }

  /**
   * Obtiene o crea el contexto de conversación
   */
  private async getOrCreateConversationContext(
    chatId: string,
    accountId: number,
    contactName: string,
    phone: string
  ): Promise<ConversationContext> {
    let context = this.conversationContexts.get(chatId);
    
    if (!context) {
      // Cargar historial desde base de datos
      const conversationHistory = await this.loadConversationHistory(chatId, accountId);
      
      // Verificar si ya ha habido interacciones (evitar saludos repetitivos)
      const hasGreeted = conversationHistory.some(msg => 
        msg.fromMe && this.isGreetingMessage(msg.content)
      );

      // Determinar etapa de conversación basada en historial
      const conversationStage = this.determineConversationStage(conversationHistory);

      // Buscar información del lead si existe
      const leadInfo = await this.getLeadInfo(phone);

      context = {
        chatId,
        accountId,
        contactName,
        phone,
        conversationHistory,
        hasGreeted,
        lastInteraction: new Date(),
        conversationStage,
        leadInfo
      };

      this.conversationContexts.set(chatId, context);
    }

    return context;
  }

  /**
   * Analiza el tipo y contenido del mensaje
   */
  private async analyzeMessage(message: string, context: ConversationContext): Promise<any> {
    const analysis = {
      isGreeting: this.isGreetingMessage(message),
      isQuestion: this.isQuestionMessage(message),
      hasLocationInfo: this.detectLocationInMessage(message) !== null,
      sentiment: await this.analyzeSentiment(message),
      intent: await this.detectIntent(message, context),
      urgency: this.detectUrgency(message)
    };

    return analysis;
  }

  /**
   * Detecta si es un mensaje de saludo
   */
  private isGreetingMessage(message: string): boolean {
    const greetingPatterns = [
      /\b(hola|hello|hi|buenas|buenos días|buenas tardes|buenas noches|saludos)\b/gi,
      /\b(qué tal|cómo estás|cómo está|que hay)\b/gi
    ];
    
    return greetingPatterns.some(pattern => pattern.test(message));
  }

  /**
   * Detecta si es una pregunta
   */
  private isQuestionMessage(message: string): boolean {
    return /\?/.test(message) || 
           /\b(qué|cómo|cuándo|dónde|por qué|cuál|cuáles|cuánto|cuántos)\b/gi.test(message);
  }

  /**
   * Detecta información de ubicación en el mensaje
   */
  private detectLocationInMessage(message: string): LocationInfo | null {
    for (const pattern of this.locationPatterns) {
      const match = message.match(pattern);
      if (match) {
        const location = match[0].toLowerCase();
        
        // Determinar tipo de ubicación
        let locationInfo: LocationInfo = {
          detectedFrom: 'explicit',
          confidence: 0.8
        };

        // Países
        if (['panamá', 'panama', 'costa rica', 'guatemala', 'méxico', 'mexico', 'colombia'].includes(location)) {
          locationInfo.country = this.normalizeCountryName(location);
        }
        // Ciudades
        else if (['ciudad de panamá', 'san josé', 'ciudad de méxico', 'bogotá'].includes(location)) {
          locationInfo.city = location;
        }
        // Provincias/Estados
        else if (['chiriquí', 'coclé', 'colón'].includes(location)) {
          locationInfo.region = location;
          locationInfo.country = 'Panamá';
        }

        return locationInfo;
      }
    }
    return null;
  }

  /**
   * Normaliza nombres de países
   */
  private normalizeCountryName(country: string): string {
    const countryMap: { [key: string]: string } = {
      'panama': 'Panamá',
      'mexico': 'México',
      'costa rica': 'Costa Rica'
    };
    
    return countryMap[country.toLowerCase()] || country;
  }

  /**
   * Detecta la urgencia del mensaje
   */
  private detectUrgency(message: string): 'low' | 'medium' | 'high' {
    const highUrgencyWords = ['urgente', 'emergencia', 'rápido', 'ya', 'ahora', 'inmediato'];
    const mediumUrgencyWords = ['pronto', 'cuando puedan', 'necesito'];
    
    const lowerMessage = message.toLowerCase();
    
    if (highUrgencyWords.some(word => lowerMessage.includes(word))) {
      return 'high';
    }
    if (mediumUrgencyWords.some(word => lowerMessage.includes(word))) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Analiza el sentimiento del mensaje
   */
  private async analyzeSentiment(message: string): Promise<'positive' | 'neutral' | 'negative'> {
    const positiveWords = ['bueno', 'excelente', 'perfecto', 'gracias', 'genial', 'fantástico'];
    const negativeWords = ['malo', 'terrible', 'problema', 'error', 'molesto', 'frustrado'];
    
    const lowerMessage = message.toLowerCase();
    
    const positiveCount = positiveWords.filter(word => lowerMessage.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerMessage.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * Detecta la intención del mensaje
   */
  private async detectIntent(message: string, context: ConversationContext): Promise<string> {
    const intents = {
      'info_request': ['información', 'detalles', 'explicar', 'qué es', 'cómo funciona'],
      'price_inquiry': ['precio', 'costo', 'cuánto', 'valor', 'tarifa'],
      'support_request': ['ayuda', 'soporte', 'problema', 'no funciona', 'error'],
      'schedule_meeting': ['reunión', 'cita', 'encuentro', 'visita', 'horario'],
      'location_sharing': ['ubicación', 'dirección', 'dónde', 'lugar', 'zona']
    };

    const lowerMessage = message.toLowerCase();
    
    for (const [intent, keywords] of Object.entries(intents)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        return intent;
      }
    }
    
    return 'general_inquiry';
  }

  /**
   * Determina la etapa de conversación basada en el historial
   */
  private determineConversationStage(history: ConversationMessage[]): ConversationStage {
    if (history.length === 0) {
      return ConversationStage.INITIAL_CONTACT;
    }

    const lastMessages = history.slice(-5);
    const hasLocationInfo = lastMessages.some(msg => msg.messageType === 'location');
    const hasBusinessDiscussion = lastMessages.some(msg => msg.messageType === 'business');

    if (!hasLocationInfo) {
      return ConversationStage.LOCATION_GATHERING;
    }
    if (!hasBusinessDiscussion) {
      return ConversationStage.NEEDS_ASSESSMENT;
    }
    
    return ConversationStage.SOLUTION_OFFERING;
  }

  /**
   * Carga el historial de conversación desde la base de datos
   */
  private async loadConversationHistory(chatId: string, accountId: number): Promise<ConversationMessage[]> {
    try {
      const messages = await db
        .select()
        .from(whatsappMessages)
        .where(and(
          eq(whatsappMessages.chatId, chatId),
          eq(whatsappMessages.accountId, accountId)
        ))
        .orderBy(desc(whatsappMessages.createdAt))
        .limit(20);

      return messages.map(msg => ({
        id: msg.id.toString(),
        content: msg.content || '',
        fromMe: msg.from_me || false,
        timestamp: msg.createdAt,
        messageType: this.classifyMessageType(msg.content || '')
      }));
    } catch (error) {
      console.error('Error cargando historial:', error);
      return [];
    }
  }

  /**
   * Clasifica el tipo de mensaje
   */
  private classifyMessageType(message: string): ConversationMessage['messageType'] {
    if (this.isGreetingMessage(message)) return 'greeting';
    if (this.isQuestionMessage(message)) return 'question';
    if (this.detectLocationInMessage(message)) return 'location';
    if (this.isBusinessMessage(message)) return 'business';
    return 'response';
  }

  /**
   * Detecta si es un mensaje de negocios
   */
  private isBusinessMessage(message: string): boolean {
    const businessKeywords = ['precio', 'servicio', 'producto', 'comprar', 'vender', 'negocio', 'contrato'];
    return businessKeywords.some(keyword => message.toLowerCase().includes(keyword));
  }

  /**
   * Obtiene información del lead si existe
   */
  private async getLeadInfo(phone: string): Promise<any> {
    try {
      const [lead] = await db
        .select()
        .from(leads)
        .where(eq(leads.phone, phone))
        .limit(1);
      
      return lead || null;
    } catch (error) {
      console.error('Error obteniendo info del lead:', error);
      return null;
    }
  }

  /**
   * Actualiza el contexto de conversación
   */
  private async updateConversationContext(
    context: ConversationContext,
    message: string,
    analysis: any
  ): Promise<ConversationContext> {
    // Agregar nuevo mensaje al historial
    const newMessage: ConversationMessage = {
      id: Date.now().toString(),
      content: message,
      fromMe: false,
      timestamp: new Date(),
      messageType: this.classifyMessageType(message)
    };

    context.conversationHistory.unshift(newMessage);
    context.lastInteraction = new Date();

    // Actualizar etapa de conversación si es necesario
    if (analysis.hasLocationInfo && context.conversationStage === ConversationStage.LOCATION_GATHERING) {
      context.conversationStage = ConversationStage.NEEDS_ASSESSMENT;
    }

    // Mantener solo los últimos 20 mensajes
    if (context.conversationHistory.length > 20) {
      context.conversationHistory = context.conversationHistory.slice(0, 20);
    }

    return context;
  }

  /**
   * Genera respuesta contextual inteligente
   */
  private async generateContextualResponse(
    context: ConversationContext,
    message: string,
    customPrompt?: string
  ): Promise<string | null> {
    try {
      if (!this.openaiClient) {
        console.error('OpenAI cliente no disponible');
        return null;
      }

      // Construir prompt contextual
      const systemPrompt = this.buildContextualPrompt(context, customPrompt);
      
      const response = await this.openaiClient.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        max_tokens: 500,
        temperature: 0.7,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      const aiResponse = response.choices[0]?.message?.content?.trim();
      
      if (aiResponse && aiResponse.length > 10) {
        console.log(`🧠 Respuesta contextual generada para ${context.contactName}`);
        return aiResponse;
      }

      return null;

    } catch (error) {
      console.error('❌ Error generando respuesta contextual:', error);
      return null;
    }
  }

  /**
   * Construye el prompt contextual
   */
  private buildContextualPrompt(context: ConversationContext, customPrompt?: string): string {
    const basePrompt = customPrompt || "Eres un asistente virtual profesional y amigable.";
    
    const historyText = context.conversationHistory
      .slice(0, 5)
      .reverse()
      .map(msg => `${msg.fromMe ? 'Asistente' : context.contactName}: ${msg.content}`)
      .join('\n');

    const locationText = context.detectedLocation 
      ? `Ubicación detectada: ${context.detectedLocation.city || context.detectedLocation.region || context.detectedLocation.country}`
      : '';

    const stageText = this.getStageInstructions(context.conversationStage);

    return `${basePrompt}

CONTEXTO DE CONVERSACIÓN:
- Cliente: ${context.contactName}
- Teléfono: ${context.phone}
- Ha sido saludado: ${context.hasGreeted ? 'SÍ' : 'NO'}
- Etapa actual: ${context.conversationStage}
${locationText ? `- ${locationText}` : ''}
${context.leadInfo ? `- Estado de lead: ${context.leadInfo.status}` : ''}

HISTORIAL RECIENTE:
${historyText}

INSTRUCCIONES ESPECÍFICAS:
${stageText}

REGLAS IMPORTANTES:
1. NO saludes si ya has saludado antes (hasGreeted: SÍ)
2. Mantén continuidad natural basada en el historial
3. Si no conoces la ubicación, pregunta de forma natural: "¿Desde qué zona nos escribes?"
4. Adapta tu respuesta a la etapa de conversación actual
5. Máximo 300 caracteres por respuesta
6. Sé específico y útil, evita respuestas genéricas
${context.detectedLocation ? '7. Usa la información de ubicación para dar sugerencias específicas de la zona' : ''}`;
  }

  /**
   * Obtiene instrucciones específicas por etapa
   */
  private getStageInstructions(stage: ConversationStage): string {
    const instructions = {
      [ConversationStage.INITIAL_CONTACT]: 'Saluda calurosamente y pregunta cómo puedes ayudar.',
      [ConversationStage.LOCATION_GATHERING]: 'Pregunta de manera natural desde qué zona o ciudad nos escribe para poder brindar mejor asistencia.',
      [ConversationStage.NEEDS_ASSESSMENT]: 'Identifica las necesidades específicas del cliente y qué tipo de solución busca.',
      [ConversationStage.SOLUTION_OFFERING]: 'Presenta soluciones específicas basadas en sus necesidades y ubicación.',
      [ConversationStage.FOLLOW_UP]: 'Haz seguimiento de propuestas anteriores y verifica satisfacción.',
      [ConversationStage.CLOSURE]: 'Concluye de manera profesional y ofrece canales para futuro contacto.'
    };

    return instructions[stage] || 'Responde de manera profesional y útil.';
  }

  /**
   * Guarda la respuesta en el contexto
   */
  private async saveResponseToContext(context: ConversationContext, response: string): Promise<void> {
    const responseMessage: ConversationMessage = {
      id: Date.now().toString(),
      content: response,
      fromMe: true,
      timestamp: new Date(),
      messageType: 'response'
    };

    context.conversationHistory.unshift(responseMessage);
    
    // Marcar como saludado si es un saludo
    if (this.isGreetingMessage(response)) {
      context.hasGreeted = true;
    }

    // Actualizar contexto en memoria
    this.conversationContexts.set(context.chatId, context);
  }

  /**
   * Obtiene estadísticas del gestor de conversaciones
   */
  getConversationStats(): any {
    const contexts = Array.from(this.conversationContexts.values());
    
    const stageDistribution = contexts.reduce((acc, context) => {
      acc[context.conversationStage] = (acc[context.conversationStage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const locationsDetected = contexts.filter(c => c.detectedLocation).length;

    return {
      totalActiveConversations: contexts.length,
      stageDistribution,
      locationsDetected,
      greetedConversations: contexts.filter(c => c.hasGreeted).length,
      averageMessagesPerConversation: contexts.reduce((acc, c) => acc + c.conversationHistory.length, 0) / contexts.length || 0
    };
  }

  /**
   * Limpia contextos antiguos (más de 24 horas sin actividad)
   */
  cleanupOldContexts(): void {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 horas

    for (const [chatId, context] of this.conversationContexts.entries()) {
      if (context.lastInteraction < cutoff) {
        this.conversationContexts.delete(chatId);
        console.log(`🧹 Contexto de conversación limpiado para chat ${chatId}`);
      }
    }
  }
}

// Exportar instancia singleton
export const intelligentConversationManager = IntelligentConversationManager.getInstance();

// Limpiar contextos antiguos cada hora
setInterval(() => {
  intelligentConversationManager.cleanupOldContexts();
}, 60 * 60 * 1000);