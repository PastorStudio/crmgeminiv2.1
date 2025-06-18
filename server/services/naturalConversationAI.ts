/**
 * Sistema de Conversación Natural - Elimina respuestas genéricas y formales
 * Genera conversaciones auténticas y variadas usando IA libre
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

interface NaturalConversationConfig {
  accountId: number;
  businessName?: string;
  businessType?: string;
  tone: 'casual' | 'friendly' | 'professional';
  language: 'es' | 'en';
}

interface ConversationHistory {
  messages: Array<{
    content: string;
    fromUser: boolean;
    timestamp: Date;
  }>;
  userProfile?: {
    name?: string;
    preferences?: string[];
    previousInteractions: number;
  };
}

export class NaturalConversationAI {
  private geminiAPI: GoogleGenerativeAI;
  private responseCache = new Map<string, string>();
  private usedResponses = new Set<string>();

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('No se encontró clave API de Gemini');
    }
    this.geminiAPI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Genera respuesta natural evitando frases genéricas
   */
  async generateNaturalResponse(
    userMessage: string,
    config: NaturalConversationConfig,
    history: ConversationHistory
  ): Promise<string | null> {
    try {
      const cacheKey = this.generateCacheKey(userMessage, config, history);
      
      // Evitar respuestas repetidas
      if (this.responseCache.has(cacheKey)) {
        const cachedResponse = this.responseCache.get(cacheKey);
        if (cachedResponse && !this.usedResponses.has(cachedResponse)) {
          this.usedResponses.add(cachedResponse);
          return cachedResponse;
        }
      }

      const prompt = this.buildAntiGenericPrompt(userMessage, config, history);
      const response = await this.callGeminiWithVariation(prompt);
      
      if (response) {
        const cleanResponse = this.removeGenericPhrases(response);
        const finalResponse = this.ensureVariation(cleanResponse);
        
        this.responseCache.set(cacheKey, finalResponse);
        this.usedResponses.add(finalResponse);
        
        // Limpiar caché si crece mucho
        if (this.usedResponses.size > 100) {
          this.usedResponses.clear();
        }
        
        return finalResponse;
      }
      
      return null;
    } catch (error) {
      console.error('Error generando respuesta natural:', error);
      return null;
    }
  }

  /**
   * Construye prompt que explícitamente evita respuestas genéricas
   */
  private buildAntiGenericPrompt(
    userMessage: string,
    config: NaturalConversationConfig,
    history: ConversationHistory
  ): string {
    const recentContext = history.messages
      .slice(-3)
      .map(msg => `${msg.fromUser ? 'Usuario' : 'Empresa'}: ${msg.content}`)
      .join('\n');

    const businessContext = config.businessName || 'nuestro negocio';
    const interactionCount = history.userProfile?.previousInteractions || 0;
    const isReturningCustomer = interactionCount > 0;

    return `Eres un asistente de WhatsApp NATURAL y AUTÉNTICO para ${businessContext}.

REGLAS ESTRICTAS - NUNCA uses estas frases genéricas:
❌ "Gracias por escribirnos"
❌ "Le saluda [nombre]"
❌ "Departamento de [algo]"
❌ "Sistema Municipal"
❌ "Estoy aquí para apoyarle"
❌ "¿en qué puedo ayudarle?"
❌ "Servicio al Cliente"
❌ "por favor"

PERSONALIDAD REQUERIDA:
- Habla como una persona real del equipo
- Usa lenguaje cotidiano de WhatsApp
- Sé específico según el mensaje
- Varía completamente tus respuestas
- No uses títulos formales
- Responde como si fueras parte del equipo

CONTEXTO:
Usuario: ${isReturningCustomer ? 'Cliente frecuente' : 'Nuevo contacto'}
Conversación reciente:
${recentContext || 'Primera interacción'}

MENSAJE DEL USUARIO: "${userMessage}"

INSTRUCCIONES ESPECÍFICAS:
1. Responde de forma directa y específica al mensaje
2. Usa máximo 1-2 emojis si es natural
3. Habla en primera persona ("puedo ayudarte", "te explico")
4. Sé conversacional, no corporativo
5. Ofrece ayuda concreta, no general
6. Si es un saludo, responde el saludo y pregunta algo específico

Genera UNA respuesta natural y específica (máximo 120 caracteres):`;
  }

  /**
   * Llama a Gemini con configuración para máxima variación
   */
  private async callGeminiWithVariation(prompt: string): Promise<string | null> {
    try {
      const model = this.geminiAPI.getGenerativeModel({
        model: 'gemini-pro',
        generationConfig: {
          temperature: 0.9, // Máxima creatividad
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 100,
          candidateCount: 1
        }
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text()?.trim() || null;
    } catch (error) {
      console.error('Error en llamada a Gemini:', error);
      return null;
    }
  }

  /**
   * Remueve frases genéricas conocidas
   */
  private removeGenericPhrases(response: string): string {
    const genericPhrases = [
      /gracias por escribir(nos|te)/gi,
      /le saluda \w+/gi,
      /departamento de \w+/gi,
      /sistema municipal/gi,
      /estoy aquí para apoyar(le|te)/gi,
      /servicio al (cliente|ciudadano)/gi,
      /por favor/gi,
      /¿en qué (puedo|podemos) ayudar(le|te)\?/gi,
      /buenos días\. mi nombre es/gi,
      /soy \w+, agente/gi
    ];

    let cleaned = response;
    genericPhrases.forEach(phrase => {
      cleaned = cleaned.replace(phrase, '');
    });

    // Limpiar espacios extra
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // Si quedó muy corto, generar respuesta de emergencia
    if (cleaned.length < 10) {
      return this.generateEmergencyResponse();
    }

    return cleaned;
  }

  /**
   * Asegura que la respuesta sea única y variada
   */
  private ensureVariation(response: string): string {
    // Si ya se usó una respuesta similar, modificarla
    const similarUsed = Array.from(this.usedResponses).find(used => 
      this.calculateSimilarity(response, used) > 0.7
    );

    if (similarUsed) {
      return this.createVariation(response);
    }

    return response;
  }

  /**
   * Calcula similitud entre dos strings
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = Math.max(words1.length, words2.length);
    
    return commonWords.length / totalWords;
  }

  /**
   * Crea variación de una respuesta existente
   */
  private createVariation(originalResponse: string): string {
    const variations = [
      `${originalResponse} 😊`,
      `¡${originalResponse}!`,
      `${originalResponse} ✨`,
      originalResponse.replace(/hola/gi, 'hey'),
      originalResponse.replace(/¿/g, '').replace(/\?/g, ''),
    ];

    return variations[Math.floor(Math.random() * variations.length)];
  }

  /**
   * Genera respuesta de emergencia natural
   */
  private generateEmergencyResponse(): string {
    const emergencyResponses = [
      "¡Hola! ¿En qué te ayudo?",
      "¡Hey! Cuéntame, ¿qué necesitas?",
      "¡Buenas! ¿Cómo puedo ayudarte?",
      "¡Hola! Dime, ¿en qué te apoyo?",
      "¡Hey! ¿Qué tal? ¿En qué puedo ayudarte?",
      "¡Hola! ¿Qué buscas hoy?",
      "¡Buenas! ¿Cómo te va? ¿En qué te ayudo?"
    ];

    const randomIndex = Math.floor(Math.random() * emergencyResponses.length);
    return emergencyResponses[randomIndex];
  }

  /**
   * Genera clave de caché única
   */
  private generateCacheKey(
    message: string,
    config: NaturalConversationConfig,
    history: ConversationHistory
  ): string {
    const messageType = this.classifyMessageType(message);
    const historyLength = history.messages.length;
    return `${config.accountId}_${messageType}_${historyLength}`;
  }

  /**
   * Clasifica tipo de mensaje para cacheo inteligente
   */
  private classifyMessageType(message: string): string {
    const lower = message.toLowerCase();
    
    if (lower.includes('hola') || lower.includes('buenos') || lower.includes('buenas')) {
      return 'greeting';
    }
    if (lower.includes('precio') || lower.includes('costo') || lower.includes('cuanto')) {
      return 'pricing';
    }
    if (lower.includes('gracias') || lower.includes('chao') || lower.includes('bye')) {
      return 'farewell';
    }
    if (lower.includes('problema') || lower.includes('ayuda') || lower.includes('soporte')) {
      return 'support';
    }
    if (lower.includes('info') || lower.includes('que') || lower.includes('como')) {
      return 'inquiry';
    }
    
    return 'general';
  }

  /**
   * Limpia caché de respuestas usadas
   */
  clearResponseCache(): void {
    this.responseCache.clear();
    this.usedResponses.clear();
  }
}

export const naturalConversationAI = new NaturalConversationAI();