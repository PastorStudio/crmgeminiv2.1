/**
 * Servicio para integrar con el agente SmartBots de ChatGPT
 * Este servicio se conecta al agente específico para generar respuestas automáticas
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface SmartBotsConfig {
  enabled: boolean;
  agentId: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

export class SmartBotsAgent {
  private config: SmartBotsConfig;

  constructor(config: SmartBotsConfig) {
    this.config = {
      enabled: true,
      agentId: 'g-682ceb8bfa4c81918b3ff66abe6f3480-smartbots',
      model: 'gpt-4o', // el modelo más reciente de OpenAI
      temperature: 0.7,
      maxTokens: 500,
      systemPrompt: `Eres SmartBots, un asistente virtual especializado en atención al cliente para WhatsApp. 

Tu misión es:
- Responder de manera amable y profesional
- Proporcionar información útil y relevante
- Mantener conversaciones naturales y fluidas
- Detectar la intención del cliente y responder apropiadamente
- Ofrecer soluciones prácticas a las consultas

Mantén las respuestas concisas pero completas, usando un tono amigable y profesional. Si no tienes información específica, reconócelo honestamente y ofrece alternativas de ayuda.`,
      ...config
    };
  }

  /**
   * Genera una respuesta automática usando el agente SmartBots
   */
  async generateResponse(
    message: string, 
    contactName?: string, 
    conversationContext?: string[]
  ): Promise<string> {
    try {
      if (!this.config.enabled) {
        throw new Error('SmartBots agent está deshabilitado');
      }

      console.log('🤖 SmartBots: Generando respuesta para mensaje:', message);

      // Construir el contexto de la conversación
      let contextPrompt = this.config.systemPrompt;
      
      if (contactName) {
        contextPrompt += `\n\nEl cliente se llama: ${contactName}`;
      }

      if (conversationContext && conversationContext.length > 0) {
        contextPrompt += `\n\nContexto de conversación reciente:\n${conversationContext.join('\n')}`;
      }

      contextPrompt += `\n\nMensaje actual del cliente: "${message}"`;

      const completion = await openai.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: contextPrompt
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
      });

      const response = completion.choices[0].message.content;
      
      if (!response) {
        throw new Error('No se recibió respuesta del agente SmartBots');
      }

      console.log('🤖 SmartBots: Respuesta generada:', response);
      return response.trim();

    } catch (error) {
      console.error('❌ Error en SmartBots agent:', error);
      
      // Respuesta de fallback
      const fallbackResponses = [
        'Gracias por tu mensaje. Un asesor te contactará pronto.',
        'Hemos recibido tu consulta. Te responderemos a la brevedad.',
        'Gracias por contactarnos. En breve te atenderemos.',
      ];
      
      return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    }
  }

  /**
   * Analiza el sentimiento y la intención del mensaje
   */
  async analyzeMessage(message: string): Promise<{
    sentiment: 'positive' | 'neutral' | 'negative';
    intent: string;
    urgency: 'low' | 'medium' | 'high';
    confidence: number;
  }> {
    try {
      const analysisPrompt = `Analiza el siguiente mensaje de WhatsApp y proporciona un análisis en formato JSON:

Mensaje: "${message}"

Responde SOLO con un objeto JSON válido que contenga:
{
  "sentiment": "positive|neutral|negative",
  "intent": "descripción breve de la intención",
  "urgency": "low|medium|high",
  "confidence": número entre 0 y 1
}`;

      const completion = await openai.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en análisis de sentimientos y detección de intenciones para mensajes de atención al cliente.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 150,
        response_format: { type: "json_object" }
      });

      const response = completion.choices[0].message.content;
      const analysis = JSON.parse(response || '{}');

      return {
        sentiment: analysis.sentiment || 'neutral',
        intent: analysis.intent || 'consulta general',
        urgency: analysis.urgency || 'medium',
        confidence: analysis.confidence || 0.5
      };

    } catch (error) {
      console.error('❌ Error en análisis de mensaje:', error);
      return {
        sentiment: 'neutral',
        intent: 'consulta general',
        urgency: 'medium',
        confidence: 0.5
      };
    }
  }

  /**
   * Actualiza la configuración del agente
   */
  updateConfig(newConfig: Partial<SmartBotsConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🤖 SmartBots: Configuración actualizada:', this.config);
  }

  /**
   * Obtiene la configuración actual
   */
  getConfig(): SmartBotsConfig {
    return { ...this.config };
  }

  /**
   * Verifica si el agente está disponible
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return false;
      }

      // Hacer una prueba simple para verificar la conexión
      await openai.chat.completions.create({
        model: this.config.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5
      });

      return true;
    } catch (error) {
      console.error('❌ SmartBots agent no está disponible:', error);
      return false;
    }
  }
}

// Instancia global del agente SmartBots
export const smartBotsAgent = new SmartBotsAgent({
  enabled: true,
  agentId: 'g-682ceb8bfa4c81918b3ff66abe6f3480-smartbots',
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 500,
  systemPrompt: ''
});