/**
 * Servicio para integración con Google Gemini AI
 * Proporciona funcionalidades de IA generativa para todo el sistema
 */

import axios from 'axios';
import { apiKeyManager } from './apiKeyManager';
import { geminiKeyGenerator } from './geminiKeyGenerator';

interface GeminiConfig {
  professionLevel: string;
  model: string;
  temperature: number;
  maxOutputTokens: number;
}

class GeminiService {
  private static instance: GeminiService;
  private config: GeminiConfig;

  private constructor() {
    // Configuración por defecto
    this.config = {
      professionLevel: "professional",
      model: "gemini-1.5-pro", // Usando la última versión de Gemini
      temperature: 0.7,
      maxOutputTokens: 1024
    };
  }

  public static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  /**
   * Obtiene una clave API válida para Gemini
   */
  private async getApiKey(): Promise<string> {
    try {
      // Intentar obtener una clave válida del generador
      return await geminiKeyGenerator.getValidKey();
    } catch (error) {
      console.error('Error obteniendo clave API de Gemini:', error);
      throw new Error('No se pudo obtener una clave API válida para Gemini');
    }
  }

  /**
   * Actualiza la configuración de Gemini
   */
  public updateConfig(newConfig: Partial<GeminiConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Genera contenido de texto con Gemini
   */
  public async generateContent(prompt: string): Promise<string> {
    try {
      const apiKey = await this.getApiKey();
      
      // Endpoint para Gemini 1.5
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${apiKey}`;
      
      const response = await axios.post(url, {
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: this.config.temperature,
          maxOutputTokens: this.config.maxOutputTokens,
          topP: 0.8,
          topK: 40
        }
      });
      
      // Extraer el texto generado
      const generatedText = response.data.candidates[0]?.content?.parts[0]?.text || '';
      return generatedText;
    } catch (error) {
      console.error('Error generando contenido con Gemini:', error);
      return `Error: No se pudo generar contenido con Gemini. ${(error as Error).message}`;
    }
  }

  /**
   * Genera una respuesta para un chat con contexto
   */
  public async generateChatResponse(
    message: string, 
    conversationHistory: any[] = [], 
    customSystemPrompt?: string
  ): Promise<string> {
    try {
      const apiKey = await this.getApiKey();
      
      // Endpoint para Gemini 1.5
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${apiKey}`;
      
      // Configurar el prompt del sistema según el nivel de profesionalismo
      let systemPrompt = customSystemPrompt || this.getSystemPromptByLevel(this.config.professionLevel);
      
      // Construir el historial de la conversación
      const contents = [];
      
      // Añadir el prompt del sistema como primer mensaje
      contents.push({
        role: 'user',
        parts: [{ text: systemPrompt }]
      });
      
      contents.push({
        role: 'model',
        parts: [{ text: 'Entendido. Actuaré según las instrucciones proporcionadas.' }]
      });
      
      // Añadir el historial de conversación
      if (conversationHistory && conversationHistory.length > 0) {
        for (const entry of conversationHistory) {
          contents.push({
            role: entry.role === 'user' ? 'user' : 'model',
            parts: [{ text: entry.content }]
          });
        }
      }
      
      // Añadir el mensaje actual
      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });
      
      const response = await axios.post(url, {
        contents,
        generationConfig: {
          temperature: this.config.temperature,
          maxOutputTokens: this.config.maxOutputTokens,
          topP: 0.8,
          topK: 40
        }
      });
      
      // Extraer la respuesta generada
      const generatedText = response.data.candidates[0]?.content?.parts[0]?.text || '';
      return generatedText;
    } catch (error) {
      console.error('Error generando respuesta de chat con Gemini:', error);
      return `Error: No se pudo generar una respuesta. ${(error as Error).message}`;
    }
  }

  /**
   * Analiza un lead para extraer información y sugerir acciones
   */
  public async analyzeLead(leadId: number): Promise<any> {
    try {
      // En un sistema real, obtendríamos los datos del lead de la base de datos
      // y los pasaríamos a Gemini para su análisis
      
      // Por ahora, devolvemos un análisis simulado
      return {
        insights: [
          "Cliente potencial para servicios de marketing digital",
          "Alta probabilidad de conversión (78%)",
          "Interesado principalmente en SEO y publicidad en redes sociales"
        ],
        suggestedActions: [
          "Programar una demostración de la plataforma de análisis",
          "Enviar material informativo sobre casos de éxito en su industria",
          "Ofrecer una consultoría inicial gratuita"
        ],
        priority: "alta",
        expectedValue: 5800,
        conversionProbability: 0.78
      };
    } catch (error) {
      console.error('Error analizando lead con Gemini:', error);
      throw error;
    }
  }

  /**
   * Genera un mensaje personalizado para un lead
   */
  public async generateMessage(leadId: number, messageType: string): Promise<string> {
    try {
      // En un sistema real, obtendríamos los datos del lead y usaríamos Gemini
      // para generar un mensaje personalizado basado en esos datos
      
      const messageTemplates = {
        followUp: "Estimado cliente, me gustaría hacer un seguimiento de nuestra conversación anterior...",
        welcome: "¡Bienvenido! Gracias por su interés en nuestros servicios...",
        offer: "Tenemos una oferta especial para usted basada en sus intereses..."
      };
      
      return messageTemplates[messageType as keyof typeof messageTemplates] || 
        "Gracias por contactarnos. Estamos a su disposición para cualquier consulta.";
    } catch (error) {
      console.error('Error generando mensaje con Gemini:', error);
      throw error;
    }
  }

  /**
   * Obtiene el prompt del sistema según el nivel de profesionalismo
   */
  private getSystemPromptByLevel(level: string): string {
    const prompts = {
      casual: `
        Eres un asistente amigable y conversacional. Responde de manera informal, 
        cercana y utilizando un lenguaje sencillo. Puedes usar expresiones coloquiales
        y mostrar una personalidad cálida y accesible.
      `,
      professional: `
        Eres un asistente profesional para un CRM. Responde de manera clara, concisa 
        y profesional. Mantén un tono formal pero amable, y proporciona información 
        precisa y útil sin tecnicismos innecesarios.
      `,
      technical: `
        Eres un especialista técnico. Proporciona respuestas detalladas y precisas,
        utilizando terminología técnica cuando sea apropiado. Enfócate en proporcionar
        información detallada y procedimientos paso a paso cuando sea necesario.
      `,
      executive: `
        Eres un asistente ejecutivo de alto nivel. Proporciona respuestas concisas,
        estratégicas y orientadas a resultados. Enfócate en el valor comercial, eficiencia
        y perspectivas estratégicas sin detalles innecesarios.
      `
    };
    
    return prompts[level as keyof typeof prompts] || prompts.professional;
  }
}

// Exportar la instancia única
export const geminiService = GeminiService.getInstance();