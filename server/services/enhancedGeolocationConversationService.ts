/**
 * Enhanced Geolocation Conversation Service
 * Eliminates repetitive greetings and provides location-aware responses
 */

import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../db';
import { whatsappMessages, leads } from '../../shared/schema';
import { eq, desc, and } from 'drizzle-orm';

interface ConversationMemory {
  chatId: string;
  accountId: number;
  contactName: string;
  phone: string;
  hasGreeted: boolean;
  lastInteraction: Date;
  messageCount: number;
  detectedLocation: LocationData | null;
  conversationStage: ConversationStage;
  previousTopics: string[];
  leadStatus?: string;
}

interface LocationData {
  country: string;
  region?: string;
  city?: string;
  timezone?: string;
  detectionMethod: 'explicit' | 'inferred' | 'ip_lookup';
  confidence: number;
  coordinates?: { lat: number; lng: number };
  nearbyServices?: string[];
}

enum ConversationStage {
  FIRST_CONTACT = 'first_contact',
  LOCATION_DETECTION = 'location_detection',
  NEEDS_ASSESSMENT = 'needs_assessment',
  SERVICE_RECOMMENDATION = 'service_recommendation',
  FOLLOW_UP = 'follow_up'
}

export class EnhancedGeolocationConversationService {
  private static instance: EnhancedGeolocationConversationService;
  private conversationMemory: Map<string, ConversationMemory> = new Map();
  private openaiClient: OpenAI;
  private geminiClient: GoogleGenerativeAI | null = null;
  
  // Location patterns for Latin America and specific regions
  private locationPatterns = {
    countries: new Map([
      ['panama', { name: 'Panamá', timezone: 'America/Panama', region: 'Central America' }],
      ['panamá', { name: 'Panamá', timezone: 'America/Panama', region: 'Central America' }],
      ['costa rica', { name: 'Costa Rica', timezone: 'America/Costa_Rica', region: 'Central America' }],
      ['guatemala', { name: 'Guatemala', timezone: 'America/Guatemala', region: 'Central America' }],
      ['honduras', { name: 'Honduras', timezone: 'America/Tegucigalpa', region: 'Central America' }],
      ['nicaragua', { name: 'Nicaragua', timezone: 'America/Managua', region: 'Central America' }],
      ['colombia', { name: 'Colombia', timezone: 'America/Bogota', region: 'South America' }],
      ['venezuela', { name: 'Venezuela', timezone: 'America/Caracas', region: 'South America' }],
      ['mexico', { name: 'México', timezone: 'America/Mexico_City', region: 'North America' }],
      ['méxico', { name: 'México', timezone: 'America/Mexico_City', region: 'North America' }]
    ]),
    
    panamaCities: new Map([
      ['ciudad de panamá', { province: 'Panamá', coordinates: { lat: 8.983333, lng: -79.516667 } }],
      ['colón', { province: 'Colón', coordinates: { lat: 9.354444, lng: -79.900278 } }],
      ['david', { province: 'Chiriquí', coordinates: { lat: 8.433333, lng: -82.433333 } }],
      ['santiago', { province: 'Veraguas', coordinates: { lat: 8.1, lng: -80.983333 } }],
      ['chitré', { province: 'Herrera', coordinates: { lat: 7.966667, lng: -80.433333 } }],
      ['las tablas', { province: 'Los Santos', coordinates: { lat: 7.766667, lng: -80.283333 } }],
      ['penonomé', { province: 'Coclé', coordinates: { lat: 8.516667, lng: -80.35 } }]
    ]),
    
    panamaProvinces: [
      'chiriquí', 'coclé', 'colón', 'herrera', 'los santos', 
      'panamá', 'panamá oeste', 'veraguas', 'darién', 'bocas del toro'
    ]
  };

  private constructor() {
    this.initializeClients();
    this.startCleanupTimer();
  }

  static getInstance(): EnhancedGeolocationConversationService {
    if (!EnhancedGeolocationConversationService.instance) {
      EnhancedGeolocationConversationService.instance = new EnhancedGeolocationConversationService();
    }
    return EnhancedGeolocationConversationService.instance;
  }

  private initializeClients(): void {
    this.openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY
    });

    const geminiKey = process.env.GOOGLE_AI_API_KEY;
    if (geminiKey) {
      this.geminiClient = new GoogleGenerativeAI(geminiKey);
    }

    console.log('🌍 Enhanced Geolocation Conversation Service initialized');
  }

  /**
   * Process incoming message with location awareness and conversation memory
   */
  async processLocationAwareMessage(
    message: string,
    chatId: string,
    accountId: number,
    contactName: string,
    phone: string,
    customPrompt?: string
  ): Promise<string | null> {
    try {
      // Get or create conversation memory
      let memory = await this.getOrCreateMemory(chatId, accountId, contactName, phone);
      
      // Detect location information in the message
      const locationData = this.detectLocationInMessage(message);
      if (locationData) {
        memory.detectedLocation = locationData;
        console.log(`📍 Location detected for ${contactName}: ${locationData.city || locationData.region || locationData.country}`);
      }

      // Update conversation memory
      memory = this.updateConversationMemory(memory, message);

      // Generate contextual response based on conversation stage and location
      const response = await this.generateLocationAwareResponse(memory, message, customPrompt);

      // Save the response to memory
      if (response) {
        this.saveResponseToMemory(memory, response);
      }

      return response;

    } catch (error) {
      console.error('Error processing location-aware message:', error);
      return null;
    }
  }

  /**
   * Get or create conversation memory for a chat
   */
  private async getOrCreateMemory(
    chatId: string,
    accountId: number,
    contactName: string,
    phone: string
  ): Promise<ConversationMemory> {
    let memory = this.conversationMemory.get(chatId);

    if (!memory) {
      // Load conversation history from database
      const messageHistory = await this.loadMessageHistory(chatId, accountId);
      
      // Check if we've already greeted this contact
      const hasGreeted = messageHistory.some(msg => 
        msg.from_me && this.isGreetingMessage(msg.content || '')
      );

      // Get lead information if available
      const leadInfo = await this.getLeadInfo(phone);

      memory = {
        chatId,
        accountId,
        contactName,
        phone,
        hasGreeted,
        lastInteraction: new Date(),
        messageCount: messageHistory.length,
        detectedLocation: null,
        conversationStage: this.determineConversationStage(messageHistory, hasGreeted),
        previousTopics: this.extractTopicsFromHistory(messageHistory),
        leadStatus: leadInfo?.status
      };

      this.conversationMemory.set(chatId, memory);
    }

    return memory;
  }

  /**
   * Detect location information in message text
   */
  private detectLocationInMessage(message: string): LocationData | null {
    const lowerMessage = message.toLowerCase();

    // Check for countries
    for (const [key, countryData] of this.locationPatterns.countries) {
      if (lowerMessage.includes(key)) {
        return {
          country: countryData.name,
          timezone: countryData.timezone,
          detectionMethod: 'explicit',
          confidence: 0.9
        };
      }
    }

    // Check for Panama cities
    for (const [city, cityData] of this.locationPatterns.panamaCities) {
      if (lowerMessage.includes(city)) {
        return {
          country: 'Panamá',
          region: cityData.province,
          city: city,
          timezone: 'America/Panama',
          coordinates: cityData.coordinates,
          detectionMethod: 'explicit',
          confidence: 0.95
        };
      }
    }

    // Check for Panama provinces
    for (const province of this.locationPatterns.panamaProvinces) {
      if (lowerMessage.includes(province)) {
        return {
          country: 'Panamá',
          region: province,
          timezone: 'America/Panama',
          detectionMethod: 'explicit',
          confidence: 0.85
        };
      }
    }

    // Check for location indicators
    const locationIndicators = [
      /(?:vivo en|estoy en|me encuentro en|soy de|desde|ubicado en)\s+([a-záéíóúñ\s]+)/gi,
      /(?:zona|sector|barrio|distrito)\s+([a-záéíóúñ\s]+)/gi
    ];

    for (const pattern of locationIndicators) {
      const match = pattern.exec(message);
      if (match && match[1]) {
        return {
          country: 'Unknown',
          region: match[1].trim(),
          detectionMethod: 'inferred',
          confidence: 0.6
        };
      }
    }

    return null;
  }

  /**
   * Update conversation memory with new message
   */
  private updateConversationMemory(memory: ConversationMemory, message: string): ConversationMemory {
    memory.lastInteraction = new Date();
    memory.messageCount++;

    // Extract topics from message
    const topics = this.extractTopics(message);
    memory.previousTopics = [...new Set([...memory.previousTopics, ...topics])].slice(0, 10);

    // Update conversation stage
    memory.conversationStage = this.updateConversationStage(memory, message);

    return memory;
  }

  /**
   * Generate location-aware response based on conversation context
   */
  private async generateLocationAwareResponse(
    memory: ConversationMemory,
    message: string,
    customPrompt?: string
  ): Promise<string | null> {
    try {
      const systemPrompt = this.buildLocationAwarePrompt(memory, customPrompt);

      const response = await this.openaiClient.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        max_tokens: 400,
        temperature: 0.7,
        presence_penalty: 0.1,
        frequency_penalty: 0.2
      });

      const aiResponse = response.choices[0]?.message?.content?.trim();
      
      if (aiResponse && aiResponse.length > 10) {
        console.log(`🧠 Location-aware response generated for ${memory.contactName}`);
        return aiResponse;
      }

      return null;

    } catch (error) {
      console.error('Error generating location-aware response:', error);
      return null;
    }
  }

  /**
   * Build location-aware prompt with conversation context
   */
  private buildLocationAwarePrompt(memory: ConversationMemory, customPrompt?: string): string {
    const basePrompt = customPrompt || "Eres un asistente virtual profesional especializado en servicios locales.";
    
    const locationContext = memory.detectedLocation 
      ? this.buildLocationContext(memory.detectedLocation)
      : '';

    const conversationContext = this.buildConversationContext(memory);
    const stageInstructions = this.getStageInstructions(memory.conversationStage);

    return `${basePrompt}

CONTEXTO DE CONVERSACIÓN:
- Cliente: ${memory.contactName}
- Teléfono: ${memory.phone}
- Mensajes intercambiados: ${memory.messageCount}
- Ya saludado: ${memory.hasGreeted ? 'SÍ' : 'NO'}
- Etapa actual: ${memory.conversationStage}
${memory.leadStatus ? `- Estado como lead: ${memory.leadStatus}` : ''}

${locationContext}

${conversationContext}

INSTRUCCIONES ESPECÍFICAS PARA ESTA ETAPA:
${stageInstructions}

REGLAS FUNDAMENTALES:
1. NUNCA saludes si ya has saludado antes (Ya saludado: SÍ)
2. Si no conoces la ubicación del cliente, pregunta de forma natural: "¿Desde qué zona nos contactas?"
3. Usa la información de ubicación para dar recomendaciones específicas de la zona
4. Mantén continuidad natural basada en el historial de conversación
5. Máximo 300 caracteres por respuesta
6. Sé específico y útil, evita respuestas genéricas
7. Si detectas una necesidad de servicio, ofrece soluciones locales específicas`;
  }

  /**
   * Build location context for prompt
   */
  private buildLocationContext(location: LocationData): string {
    let context = `UBICACIÓN DETECTADA:
- País: ${location.country}`;

    if (location.region) {
      context += `\n- Región/Provincia: ${location.region}`;
    }

    if (location.city) {
      context += `\n- Ciudad: ${location.city}`;
    }

    if (location.timezone) {
      context += `\n- Zona horaria: ${location.timezone}`;
    }

    if (location.coordinates) {
      context += `\n- Coordenadas: ${location.coordinates.lat}, ${location.coordinates.lng}`;
    }

    context += `\n- Método de detección: ${location.detectionMethod}`;
    context += `\n- Confianza: ${Math.round(location.confidence * 100)}%`;

    return context;
  }

  /**
   * Build conversation context
   */
  private buildConversationContext(memory: ConversationMemory): string {
    let context = '';

    if (memory.previousTopics.length > 0) {
      context += `TEMAS PREVIOS DISCUTIDOS: ${memory.previousTopics.slice(0, 5).join(', ')}`;
    }

    return context;
  }

  /**
   * Get stage-specific instructions
   */
  private getStageInstructions(stage: ConversationStage): string {
    const instructions = {
      [ConversationStage.FIRST_CONTACT]: 
        'Saluda calurosamente (solo si no has saludado antes) y pregunta cómo puedes ayudar.',
      
      [ConversationStage.LOCATION_DETECTION]: 
        'Pregunta de manera natural la ubicación del cliente para brindar mejor asistencia: "¿Desde qué zona nos contactas?"',
      
      [ConversationStage.NEEDS_ASSESSMENT]: 
        'Identifica las necesidades específicas del cliente y qué tipo de servicio busca.',
      
      [ConversationStage.SERVICE_RECOMMENDATION]: 
        'Ofrece servicios específicos basados en la ubicación y necesidades identificadas.',
      
      [ConversationStage.FOLLOW_UP]: 
        'Haz seguimiento de propuestas anteriores y verifica la satisfacción del cliente.'
    };

    return instructions[stage] || 'Responde de manera profesional y útil.';
  }

  /**
   * Determine conversation stage based on history and current state
   */
  private determineConversationStage(
    messageHistory: any[], 
    hasGreeted: boolean
  ): ConversationStage {
    if (!hasGreeted) {
      return ConversationStage.FIRST_CONTACT;
    }

    const hasLocationInfo = messageHistory.some(msg => 
      this.detectLocationInMessage(msg.content || '')
    );

    if (!hasLocationInfo) {
      return ConversationStage.LOCATION_DETECTION;
    }

    const hasServiceDiscussion = messageHistory.some(msg => 
      this.isServiceRelatedMessage(msg.content || '')
    );

    if (!hasServiceDiscussion) {
      return ConversationStage.NEEDS_ASSESSMENT;
    }

    return ConversationStage.SERVICE_RECOMMENDATION;
  }

  /**
   * Update conversation stage based on current message
   */
  private updateConversationStage(memory: ConversationMemory, message: string): ConversationStage {
    // If location was just detected, move to needs assessment
    if (memory.conversationStage === ConversationStage.LOCATION_DETECTION && 
        memory.detectedLocation) {
      return ConversationStage.NEEDS_ASSESSMENT;
    }

    // If service topics are discussed, move to service recommendation
    if (memory.conversationStage === ConversationStage.NEEDS_ASSESSMENT &&
        this.isServiceRelatedMessage(message)) {
      return ConversationStage.SERVICE_RECOMMENDATION;
    }

    return memory.conversationStage;
  }

  /**
   * Check if message is greeting
   */
  private isGreetingMessage(message: string): boolean {
    const greetingPatterns = [
      /\b(hola|hello|hi|buenas|buenos días|buenas tardes|buenas noches|saludos)\b/gi,
      /\b(qué tal|cómo estás|cómo está|que hay)\b/gi
    ];
    
    return greetingPatterns.some(pattern => pattern.test(message));
  }

  /**
   * Check if message is service-related
   */
  private isServiceRelatedMessage(message: string): boolean {
    const serviceKeywords = [
      'precio', 'costo', 'servicio', 'producto', 'ayuda', 'soporte',
      'necesito', 'busco', 'quiero', 'interesa', 'información'
    ];
    
    const lowerMessage = message.toLowerCase();
    return serviceKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  /**
   * Extract topics from message
   */
  private extractTopics(message: string): string[] {
    const topicKeywords = [
      'precio', 'costo', 'servicio', 'producto', 'ayuda', 'soporte',
      'información', 'cotización', 'consulta', 'pregunta', 'horario',
      'disponibilidad', 'ubicación', 'dirección', 'teléfono', 'contacto'
    ];

    const lowerMessage = message.toLowerCase();
    return topicKeywords.filter(keyword => lowerMessage.includes(keyword));
  }

  /**
   * Extract topics from conversation history
   */
  private extractTopicsFromHistory(messageHistory: any[]): string[] {
    const topics: string[] = [];
    
    messageHistory.forEach(msg => {
      if (msg.content) {
        topics.push(...this.extractTopics(msg.content));
      }
    });

    return [...new Set(topics)];
  }

  /**
   * Load message history from database
   */
  private async loadMessageHistory(chatId: string, accountId: number): Promise<any[]> {
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

      return messages;
    } catch (error) {
      console.error('Error loading message history:', error);
      return [];
    }
  }

  /**
   * Get lead information
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
      console.error('Error getting lead info:', error);
      return null;
    }
  }

  /**
   * Save response to memory
   */
  private saveResponseToMemory(memory: ConversationMemory, response: string): void {
    // Mark as greeted if this is a greeting response
    if (this.isGreetingMessage(response)) {
      memory.hasGreeted = true;
    }

    // Update memory in the map
    this.conversationMemory.set(memory.chatId, memory);
  }

  /**
   * Get conversation statistics
   */
  getConversationStats(): any {
    const memories = Array.from(this.conversationMemory.values());
    
    const stageDistribution = memories.reduce((acc, memory) => {
      acc[memory.conversationStage] = (acc[memory.conversationStage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const locationDetected = memories.filter(m => m.detectedLocation).length;
    const greetedConversations = memories.filter(m => m.hasGreeted).length;

    return {
      totalActiveConversations: memories.length,
      stageDistribution,
      locationDetectionRate: Math.round((locationDetected / memories.length) * 100) || 0,
      greetedConversations,
      averageMessageCount: Math.round(
        memories.reduce((acc, m) => acc + m.messageCount, 0) / memories.length
      ) || 0
    };
  }

  /**
   * Clean up old conversation memories
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      const now = new Date();
      const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours

      for (const [chatId, memory] of this.conversationMemory.entries()) {
        if (memory.lastInteraction < cutoff) {
          this.conversationMemory.delete(chatId);
          console.log(`🧹 Conversation memory cleaned for chat ${chatId}`);
        }
      }
    }, 60 * 60 * 1000); // Run every hour
  }
}

// Export singleton instance
export const enhancedGeolocationConversationService = EnhancedGeolocationConversationService.getInstance();