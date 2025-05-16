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
      model: "gemini-pro", // Usando el modelo disponible de Gemini
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
   * Obtiene una clave API válida para Gemini y actualiza el modelo si es necesario
   * @returns Objeto con la clave API y el modelo recomendado
   */
  private async getApiKeyAndModel(): Promise<{key: string, model: string}> {
    try {
      // Intentar obtener una clave válida del generador junto con el modelo recomendado
      const keyInfo = await geminiKeyGenerator.getValidKey();
      
      // Si el keyInfo es un objeto con key y model, lo manejamos correctamente
      if (typeof keyInfo === 'object' && keyInfo.key && keyInfo.model) {
        // Actualizar el modelo si es diferente al configurado actualmente
        if (keyInfo.model !== this.config.model) {
          console.log(`Cambiando modelo de Gemini de ${this.config.model} a ${keyInfo.model} por disponibilidad de cuota`);
          this.config.model = keyInfo.model;
        }
        return keyInfo;
      } 
      
      // Si por alguna razón recibimos solo una string, la manejamos para compatibilidad
      if (typeof keyInfo === 'string') {
        return {
          key: keyInfo,
          model: this.config.model
        };
      }
      
      // Si llegamos aquí, algo salió mal
      throw new Error('Formato de clave API inválido');
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
      const { key: apiKey } = await this.getApiKeyAndModel();
      
      // Endpoint para Gemini (la versión se determina por this.config.model)
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
      const { key: apiKey } = await this.getApiKeyAndModel();
      
      // Endpoint para Gemini (la versión se determina por this.config.model)
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
   * Extrae información de una conversación con un lead
   */
  public async extractLeadInfoFromConversation(leadId: number, conversation: string): Promise<any> {
    try {
      const { key: apiKey } = await this.getApiKeyAndModel();
      
      // Endpoint para Gemini (la versión se determina por this.config.model)
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${apiKey}`;
      
      const prompt = `
      Analiza la siguiente conversación con un cliente potencial y extrae toda la información relevante.
      Organiza los datos en formato JSON con las siguientes claves:
      - intereses: array de temas que interesan al cliente
      - objeciones: array de preocupaciones o objeciones del cliente
      - necesidades: array de necesidades expresadas o implícitas
      - urgencia: (alta, media, baja) basada en el tono y contenido
      - nivel_de_interes: valor numérico del 1 al 10
      - mejor_producto: cuál de nuestros productos o servicios parece más adecuado
      - siguientes_pasos: recomendación sobre cómo proceder

      Conversación:
      ${conversation}
      
      Responde ÚNICAMENTE con un objeto JSON válido sin explicaciones adicionales.
      `;
      
      const response = await axios.post(url, {
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2, // Baja temperatura para respuestas más precisas
          maxOutputTokens: this.config.maxOutputTokens,
          topP: 0.8,
          topK: 40
        }
      });
      
      // Extraer el texto generado
      const generatedText = response.data.candidates[0]?.content?.parts[0]?.text || '';
      
      // Intentar parsear el JSON
      try {
        // Limpiar el texto para asegurar que es JSON válido
        const cleanedText = generatedText.replace(/```json|```/g, '').trim();
        const result = JSON.parse(cleanedText);
        return {
          success: true,
          leadId,
          analysis: result
        };
      } catch (parseError) {
        console.error('Error parseando respuesta JSON:', parseError);
        return {
          success: false,
          error: 'No se pudo parsear la respuesta',
          rawResponse: generatedText
        };
      }
    } catch (error) {
      console.error('Error extrayendo información de conversación:', error);
      return {
        success: false,
        error: `Error al extraer información: ${(error as Error).message}`
      };
    }
  }
  
  /**
   * Genera etiquetas con probabilidades para un lead
   */
  public async generateTagsWithProbability(leadId: number): Promise<any> {
    try {
      const { key: apiKey } = await this.getApiKeyAndModel();
      
      // En un sistema real, obtendríamos los datos del lead desde la base de datos
      const leadData = {
        id: leadId,
        name: "Cliente Ejemplo",
        lastInteraction: "Mostró interés en nuestros servicios de desarrollo web y pidió presupuesto para una aplicación móvil",
        industry: "Tecnología",
        source: "Referido",
        interactions: [
          "Solicitud inicial de información",
          "Demostración de producto",
          "Revisión de presupuesto"
        ]
      };
      
      // Endpoint para Gemini 1.5
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${apiKey}`;
      
      const prompt = `
      Analiza la siguiente información de un cliente potencial (lead) y genera etiquetas relevantes 
      con su probabilidad de precisión (de 0 a 1).
      
      Información del lead:
      ID: ${leadData.id}
      Nombre: ${leadData.name}
      Última interacción: ${leadData.lastInteraction}
      Industria: ${leadData.industry}
      Origen: ${leadData.source}
      Interacciones:
      ${leadData.interactions.map(i => `- ${i}`).join('\n')}
      
      Genera un array de objetos JSON, cada uno con:
      - tag: el nombre de la etiqueta
      - probability: probabilidad de 0 a 1 
      - relevance: explicación breve de por qué esta etiqueta es relevante
      
      Incluye al menos 5 etiquetas posibles.
      Responde ÚNICAMENTE con un array JSON válido sin explicaciones adicionales.
      `;
      
      const response = await axios.post(url, {
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: this.config.maxOutputTokens,
          topP: 0.8,
          topK: 40
        }
      });
      
      // Extraer el texto generado
      const generatedText = response.data.candidates[0]?.content?.parts[0]?.text || '';
      
      // Intentar parsear el JSON
      try {
        // Limpiar el texto para asegurar que es JSON válido
        const cleanedText = generatedText.replace(/```json|```/g, '').trim();
        const result = JSON.parse(cleanedText);
        return {
          success: true,
          leadId,
          tags: result
        };
      } catch (parseError) {
        console.error('Error parseando respuesta JSON:', parseError);
        return {
          success: false,
          error: 'No se pudo parsear la respuesta',
          rawResponse: generatedText
        };
      }
    } catch (error) {
      console.error('Error generando etiquetas:', error);
      return {
        success: false,
        error: `Error al generar etiquetas: ${(error as Error).message}`
      };
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