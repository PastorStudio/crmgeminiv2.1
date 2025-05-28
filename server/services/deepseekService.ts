/**
 * Servicio de integración con DeepSeek AI
 * Proporciona respuestas automáticas inteligentes usando la API de DeepSeek
 */

export interface DeepSeekMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface DeepSeekResponse {
  success: boolean;
  response?: string;
  error?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class DeepSeekService {
  private apiKey: string;
  private baseUrl: string = 'https://api.deepseek.com/v1';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.DEEPSEEK_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ DeepSeek API key no configurada. Configura DEEPSEEK_API_KEY en variables de entorno.');
    }
  }

  /**
   * Genera una respuesta usando DeepSeek AI
   */
  async generateResponse(
    message: string, 
    context?: string,
    systemPrompt?: string
  ): Promise<DeepSeekResponse> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'DeepSeek API key no configurada'
      };
    }

    try {
      console.log('🤖 [DEEPSEEK] Generando respuesta para:', message.substring(0, 100) + '...');

      const messages: DeepSeekMessage[] = [];

      // Agregar prompt del sistema si existe
      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt
        });
      } else {
        // Prompt por defecto para atención al cliente
        messages.push({
          role: 'system',
          content: `Eres un asistente de atención al cliente profesional y amigable. 
                   Responde de manera útil, clara y concisa. 
                   Mantén un tono cordial y profesional.
                   Si no tienes información específica, indica que un agente humano puede ayudar mejor.`
        });
      }

      // Agregar contexto si existe
      if (context) {
        messages.push({
          role: 'system',
          content: `Contexto adicional: ${context}`
        });
      }

      // Agregar mensaje del usuario
      messages.push({
        role: 'user',
        content: message
      });

      const requestBody = {
        model: 'deepseek-chat', // Modelo principal de DeepSeek
        messages: messages,
        max_tokens: 500,
        temperature: 0.7,
        top_p: 0.9,
        stream: false
      };

      console.log('🤖 [DEEPSEEK] Enviando petición a API...');

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [DEEPSEEK] Error en API:', response.status, errorText);
        return {
          success: false,
          error: `Error de API DeepSeek: ${response.status} - ${errorText}`
        };
      }

      const data = await response.json();
      console.log('✅ [DEEPSEEK] Respuesta recibida exitosamente');

      const aiResponse = data.choices?.[0]?.message?.content || 'No se pudo generar respuesta';

      return {
        success: true,
        response: aiResponse.trim(),
        usage: data.usage
      };

    } catch (error) {
      console.error('❌ [DEEPSEEK] Error generando respuesta:', error);
      return {
        success: false,
        error: `Error interno: ${error.message}`
      };
    }
  }

  /**
   * Genera respuesta específica para WhatsApp
   */
  async generateWhatsAppResponse(
    userMessage: string,
    senderName?: string,
    companyName?: string
  ): Promise<DeepSeekResponse> {
    const systemPrompt = `Eres un asistente de atención al cliente para ${companyName || 'nuestra empresa'} en WhatsApp.
                         Responde de manera profesional pero amigable, como lo haría un representante humano.
                         Mantén las respuestas concisas y útiles para el formato de WhatsApp.
                         Si el usuario pregunta por información específica que no conoces, indica que un agente humano le ayudará pronto.
                         ${senderName ? `El cliente se llama ${senderName}.` : ''}`;

    return this.generateResponse(userMessage, undefined, systemPrompt);
  }

  /**
   * Verifica si la API key está configurada y es válida
   */
  async testConnection(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      const testResponse = await this.generateResponse('Hola', undefined, 'Responde solo con "OK"');
      return testResponse.success;
    } catch (error) {
      console.error('❌ [DEEPSEEK] Error en test de conexión:', error);
      return false;
    }
  }

  /**
   * Actualizar API key
   */
  updateApiKey(newApiKey: string): void {
    this.apiKey = newApiKey;
    console.log('✅ [DEEPSEEK] API key actualizada');
  }
}

// Instancia singleton
export const deepSeekService = new DeepSeekService();

export default deepSeekService;