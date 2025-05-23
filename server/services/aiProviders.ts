/**
 * Servicio unificado para proveedores de IA
 * Maneja Gemini, OpenAI y SmartBots
 */

interface AIResponse {
  success: boolean;
  response: string;
  analysis?: {
    sentiment: 'positive' | 'negative' | 'neutral';
    urgency: 'high' | 'medium' | 'low';
    confidence: number;
    intent: string;
  };
  error?: string;
}

export class AIProvidersService {
  
  /**
   * Generar respuesta usando SmartBots (OpenAI)
   */
  async generateSmartBotsResponse(message: string, contactName: string = 'Usuario'): Promise<AIResponse> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY no configurada');
      }

      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "Eres SmartBots, un asistente virtual especializado en atención al cliente para WhatsApp. Responde de manera amable, profesional y útil en español. Mantén las respuestas concisas pero informativas."
          },
          {
            role: "user", 
            content: `Mensaje del cliente ${contactName}: ${message}`
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      const response = completion.choices[0].message.content || 'Lo siento, no pude generar una respuesta en este momento.';

      // Análisis básico del mensaje
      const analysis = this.analyzeMessage(message);

      return {
        success: true,
        response,
        analysis
      };

    } catch (error) {
      console.error('❌ Error con SmartBots/OpenAI:', error);
      return {
        success: false,
        response: `Hola ${contactName}, gracias por tu mensaje. Un agente te atenderá pronto.`,
        error: error.message
      };
    }
  }

  /**
   * Generar respuesta usando OpenAI directamente
   */
  async generateOpenAIResponse(message: string, contactName: string = 'Usuario'): Promise<AIResponse> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY no configurada');
      }

      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "Eres un asistente virtual profesional para atención al cliente. Responde de manera amable y útil en español."
          },
          {
            role: "user", 
            content: `Cliente ${contactName} dice: ${message}`
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      const response = completion.choices[0].message.content || 'Lo siento, no pude generar una respuesta en este momento.';
      const analysis = this.analyzeMessage(message);

      return {
        success: true,
        response,
        analysis
      };

    } catch (error) {
      console.error('❌ Error con OpenAI:', error);
      return {
        success: false,
        response: `Hola ${contactName}, gracias por contactarnos. Te atenderemos pronto.`,
        error: error.message
      };
    }
  }

  /**
   * Generar respuesta usando Gemini
   */
  async generateGeminiResponse(message: string, contactName: string = 'Usuario'): Promise<AIResponse> {
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY no configurada');
      }

      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      const prompt = `Eres un asistente virtual profesional para atención al cliente. El cliente ${contactName} ha enviado este mensaje: "${message}". Responde de manera amable, profesional y útil en español. Mantén la respuesta concisa.`;

      const result = await model.generateContent(prompt);
      const response = result.response.text() || 'Lo siento, no pude generar una respuesta en este momento.';
      const analysis = this.analyzeMessage(message);

      return {
        success: true,
        response,
        analysis
      };

    } catch (error) {
      console.error('❌ Error con Gemini:', error);
      return {
        success: false,
        response: `Hola ${contactName}, gracias por tu mensaje. Te responderemos pronto.`,
        error: error.message
      };
    }
  }

  /**
   * Análisis básico del mensaje
   */
  private analyzeMessage(message: string) {
    const lowerMessage = message.toLowerCase();
    
    // Análisis de sentimiento
    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (lowerMessage.includes('gracias') || lowerMessage.includes('excelente') || lowerMessage.includes('perfecto')) {
      sentiment = 'positive';
    } else if (lowerMessage.includes('problema') || lowerMessage.includes('error') || lowerMessage.includes('mal')) {
      sentiment = 'negative';
    }

    // Análisis de urgencia
    let urgency: 'high' | 'medium' | 'low' = 'low';
    if (lowerMessage.includes('urgente') || lowerMessage.includes('inmediato') || lowerMessage.includes('emergencia')) {
      urgency = 'high';
    } else if (lowerMessage.includes('pronto') || lowerMessage.includes('rápido')) {
      urgency = 'medium';
    }

    // Análisis de intención
    let intent = 'Consulta general';
    if (lowerMessage.includes('precio') || lowerMessage.includes('costo') || lowerMessage.includes('cuanto')) {
      intent = 'Consulta de precios';
    } else if (lowerMessage.includes('producto') || lowerMessage.includes('servicio')) {
      intent = 'Información de producto';
    } else if (lowerMessage.includes('problema') || lowerMessage.includes('error') || lowerMessage.includes('falla')) {
      intent = 'Reporte de problema';
    } else if (lowerMessage.includes('compra') || lowerMessage.includes('comprar') || lowerMessage.includes('adquirir')) {
      intent = 'Intención de compra';
    }

    return {
      sentiment,
      urgency,
      confidence: 0.85,
      intent
    };
  }

  /**
   * Generar respuesta según el proveedor configurado
   */
  async generateResponse(provider: string, message: string, contactName: string = 'Usuario'): Promise<AIResponse> {
    console.log(`🤖 Generando respuesta con ${provider} para: ${message.substring(0, 50)}...`);
    
    switch (provider) {
      case 'smartbots':
        return await this.generateSmartBotsResponse(message, contactName);
      case 'openai':
        return await this.generateOpenAIResponse(message, contactName);
      case 'gemini':
        return await this.generateGeminiResponse(message, contactName);
      default:
        return {
          success: false,
          response: `Hola ${contactName}, gracias por tu mensaje. Te atenderemos pronto.`,
          error: 'Proveedor de IA no válido'
        };
    }
  }
}

export const aiProvidersService = new AIProvidersService();