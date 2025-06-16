/**
 * Servicio de Respuestas AI Mejorado con Historial de Conversación y Detección de Idioma
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

interface ConversationMessage {
  id: string;
  chatId: string;
  sender: 'user' | 'bot';
  message: string;
  timestamp: Date;
  language?: string;
  translated?: string;
}

interface AIResponseConfig {
  accountId: number;
  agentId?: number;
  customPrompt?: string;
  language: string;
  enableTranslation: boolean;
  maxHistoryMessages: number;
}

export class EnhancedAIResponseService {
  private static instance: EnhancedAIResponseService;
  private conversationHistory: Map<string, ConversationMessage[]> = new Map();
  private geminiClient: GoogleGenerativeAI | null = null;
  private deepseekApiKey: string | null = null;

  private constructor() {
    this.initializeAIProviders();
  }

  static getInstance(): EnhancedAIResponseService {
    if (!EnhancedAIResponseService.instance) {
      EnhancedAIResponseService.instance = new EnhancedAIResponseService();
    }
    return EnhancedAIResponseService.instance;
  }

  private initializeAIProviders(): void {
    try {
      // Inicializar Gemini
      const geminiKey = process.env.GOOGLE_AI_API_KEY;
      if (geminiKey) {
        this.geminiClient = new GoogleGenerativeAI(geminiKey);
        console.log('✅ Gemini AI inicializado');
      }

      // Inicializar DeepSeek
      this.deepseekApiKey = process.env.DEEPSEEK_API_KEY || null;
      if (this.deepseekApiKey) {
        console.log('✅ DeepSeek AI inicializado');
      }

      console.log('🤖 Servicios AI mejorados inicializados');
    } catch (error) {
      console.error('❌ Error inicializando servicios AI:', error);
    }
  }

  /**
   * Detectar idioma del mensaje
   */
  async detectLanguage(text: string): Promise<string> {
    try {
      // Detección simple basada en patrones
      if (/[áéíóúñü]/i.test(text) || /\b(hola|gracias|por favor|sí|no)\b/i.test(text)) {
        return 'es';
      }
      if (/\b(hello|thank you|please|yes|no)\b/i.test(text)) {
        return 'en';
      }
      if (/[àâäéèêëïîôöùûüÿç]/i.test(text) || /\b(bonjour|merci|s'il vous plaît|oui|non)\b/i.test(text)) {
        return 'fr';
      }
      if (/[äöüß]/i.test(text) || /\b(hallo|danke|bitte|ja|nein)\b/i.test(text)) {
        return 'de';
      }
      if (/[\u4e00-\u9fff]/.test(text)) {
        return 'zh';
      }
      if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) {
        return 'ja';
      }
      if (/[\uac00-\ud7af]/.test(text)) {
        return 'ko';
      }
      if (/[\u0600-\u06ff]/.test(text)) {
        return 'ar';
      }
      if (/[\u0400-\u04ff]/.test(text)) {
        return 'ru';
      }

      return 'es'; // Default a español
    } catch (error) {
      console.error('❌ Error detectando idioma:', error);
      return 'es';
    }
  }

  /**
   * Traducir texto usando Google Translate API
   */
  async translateText(text: string, fromLang: string, toLang: string): Promise<string> {
    try {
      if (fromLang === toLang) {
        return text;
      }

      const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
      if (!apiKey) {
        console.log('⚠️ Google Translate API key no configurada, retornando texto original');
        return text;
      }

      const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          source: fromLang,
          target: toLang,
          format: 'text'
        })
      });

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error.message);
      }

      const translatedText = result.data.translations[0].translatedText;
      console.log(`🌐 Traducido de ${fromLang} a ${toLang}: "${text.substring(0, 30)}..." → "${translatedText.substring(0, 30)}..."`);
      
      return translatedText;
    } catch (error) {
      console.error('❌ Error traduciendo texto:', error);
      return text;
    }
  }

  /**
   * Agregar mensaje al historial de conversación
   */
  addToConversationHistory(chatId: string, message: ConversationMessage): void {
    if (!this.conversationHistory.has(chatId)) {
      this.conversationHistory.set(chatId, []);
    }

    const history = this.conversationHistory.get(chatId)!;
    history.push(message);

    // Mantener solo los últimos 20 mensajes
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }

    console.log(`📝 Mensaje agregado al historial de ${chatId}. Total mensajes: ${history.length}`);
  }

  /**
   * Obtener historial de conversación
   */
  getConversationHistory(chatId: string, maxMessages: number = 10): ConversationMessage[] {
    const history = this.conversationHistory.get(chatId) || [];
    return history.slice(-maxMessages);
  }

  /**
   * Generar respuesta AI con contexto e historial
   */
  async generateContextualResponse(
    message: string,
    chatId: string,
    config: AIResponseConfig
  ): Promise<{ response: string; language: string; translated?: string }> {
    try {
      console.log(`🤖 Generando respuesta contextual para chat ${chatId} con mensaje: "${message.substring(0, 50)}..."`);

      // Detectar idioma del mensaje entrante
      const detectedLanguage = await this.detectLanguage(message);
      console.log(`🔍 Idioma detectado: ${detectedLanguage}`);

      // Agregar mensaje del usuario al historial
      const userMessage: ConversationMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        chatId,
        sender: 'user',
        message,
        timestamp: new Date(),
        language: detectedLanguage
      };
      this.addToConversationHistory(chatId, userMessage);

      // Obtener historial para contexto
      const conversationHistory = this.getConversationHistory(chatId, config.maxHistoryMessages);
      
      // Construir contexto de conversación
      const contextMessages = conversationHistory
        .slice(-6) // Últimos 6 mensajes para contexto
        .map(msg => `${msg.sender === 'user' ? 'Cliente' : 'Agente'}: ${msg.message}`)
        .join('\n');

      // Preparar prompt con contexto y configuración personalizada
      const customPrompt = config.customPrompt || `
Eres un agente de servicio al cliente profesional y amigable. 
Responde de manera útil, clara y concisa.
Mantén un tono profesional pero cálido.
Si el cliente pregunta sobre productos o servicios, proporciona información útil.
Si necesitas más información, haz preguntas específicas.
Responde SIEMPRE en español, sin importar el idioma del mensaje.
`;

      const prompt = `
${customPrompt}

Contexto de la conversación:
${contextMessages}

Último mensaje del cliente: "${message}"

Instrucciones:
- Responde en español de manera natural y profesional
- Considera el contexto de la conversación anterior
- Si el mensaje está en otro idioma, entiéndelo pero responde en español
- Máximo 150 palabras
- No menciones que eres una IA

Respuesta:`;

      // Intentar generar respuesta con diferentes proveedores
      let aiResponse = '';

      // Intentar con Gemini primero
      if (this.geminiClient) {
        try {
          const model = this.geminiClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
          const result = await model.generateContent(prompt);
          aiResponse = result.response.text().trim();
          console.log('✅ Respuesta generada con Gemini');
        } catch (geminiError) {
          console.error('❌ Error con Gemini:', geminiError);
        }
      }

      // Intentar con DeepSeek si Gemini falla
      if (!aiResponse && this.deepseekApiKey) {
        try {
          aiResponse = await this.generateDeepSeekResponse(prompt);
          console.log('✅ Respuesta generada con DeepSeek');
        } catch (deepseekError) {
          console.error('❌ Error con DeepSeek:', deepseekError);
        }
      }

      // Respuesta de fallback
      if (!aiResponse) {
        aiResponse = this.generateFallbackResponse(message, detectedLanguage);
        console.log('⚠️ Usando respuesta de fallback');
      }

      // Agregar respuesta del bot al historial
      const botMessage: ConversationMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        chatId,
        sender: 'bot',
        message: aiResponse,
        timestamp: new Date(),
        language: 'es'
      };
      this.addToConversationHistory(chatId, botMessage);

      // Traducir respuesta si es necesario
      let translatedResponse: string | undefined;
      if (config.enableTranslation && detectedLanguage !== 'es') {
        translatedResponse = await this.translateText(aiResponse, 'es', detectedLanguage);
      }

      console.log(`✅ Respuesta contextual generada para chat ${chatId}`);

      return {
        response: aiResponse,
        language: 'es',
        translated: translatedResponse
      };

    } catch (error) {
      console.error('❌ Error generando respuesta contextual:', error);
      
      return {
        response: 'Disculpa, estoy experimentando dificultades técnicas. Un agente humano te atenderá pronto.',
        language: 'es'
      };
    }
  }

  /**
   * Generar respuesta con DeepSeek
   */
  private async generateDeepSeekResponse(prompt: string): Promise<string> {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.deepseekApiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  }

  /**
   * Generar respuesta de fallback basada en patrones
   */
  private generateFallbackResponse(message: string, language: string): string {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('hola') || lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      return '¡Hola! Gracias por contactarnos. ¿En qué puedo ayudarte hoy?';
    }
    
    if (lowerMessage.includes('precio') || lowerMessage.includes('cost') || lowerMessage.includes('price')) {
      return 'Con gusto te ayudo con información sobre precios. ¿Qué producto o servicio específico te interesa?';
    }
    
    if (lowerMessage.includes('producto') || lowerMessage.includes('product') || lowerMessage.includes('servicio')) {
      return 'Perfecto, me da mucho gusto saber que estás interesado en nuestros productos. ¿Podrías contarme más detalles sobre lo que buscas?';
    }
    
    if (lowerMessage.includes('gracias') || lowerMessage.includes('thank')) {
      return '¡De nada! Estoy aquí para ayudarte. ¿Hay algo más en lo que pueda asistirte?';
    }

    return 'Gracias por tu mensaje. He recibido tu consulta y un agente especializado te atenderá pronto. ¿Hay algo específico en lo que pueda ayudarte mientras tanto?';
  }

  /**
   * Limpiar historial de conversación
   */
  clearConversationHistory(chatId: string): void {
    this.conversationHistory.delete(chatId);
    console.log(`🗑️ Historial de conversación limpiado para chat ${chatId}`);
  }

  /**
   * Obtener estadísticas de conversaciones
   */
  getConversationStats(): any {
    const totalChats = this.conversationHistory.size;
    let totalMessages = 0;
    let languageDistribution: { [key: string]: number } = {};

    this.conversationHistory.forEach((messages) => {
      totalMessages += messages.length;
      messages.forEach((msg) => {
        if (msg.language) {
          languageDistribution[msg.language] = (languageDistribution[msg.language] || 0) + 1;
        }
      });
    });

    return {
      totalActiveChats: totalChats,
      totalMessages,
      averageMessagesPerChat: totalChats > 0 ? Math.round(totalMessages / totalChats) : 0,
      languageDistribution,
      lastUpdated: new Date()
    };
  }
}

export const enhancedAIService = EnhancedAIResponseService.getInstance();