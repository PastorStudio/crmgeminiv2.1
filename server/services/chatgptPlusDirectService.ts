/**
 * ChatGPT Plus Direct Service
 * Simple integration that uses OpenAI API with your provided key
 */

import OpenAI from 'openai';

export class ChatGPTPlusDirectService {
  private openai: OpenAI | null = null;
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize OpenAI client with provided API key
   */
  private initialize(): void {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      
      if (!apiKey || apiKey === 'placeholder') {
        console.log('⚠️ OPENAI_API_KEY no configurada correctamente');
        return;
      }

      this.openai = new OpenAI({
        apiKey: apiKey
      });

      this.isInitialized = true;
      console.log('✅ ChatGPT Plus Direct Service inicializado correctamente');
      
    } catch (error) {
      console.error('❌ Error inicializando ChatGPT Plus Direct Service:', error);
    }
  }

  /**
   * Generate response using ChatGPT Plus API
   */
  async generateResponse(message: string, agentName: string = 'Asistente AI'): Promise<string> {
    try {
      if (!this.isInitialized || !this.openai) {
        console.log('🔄 ChatGPT Plus no disponible, usando respuesta de emergencia');
        return this.getEmergencyResponse();
      }

      console.log(`🤖 Generando respuesta con ChatGPT Plus API para: ${agentName}`);

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `Eres ${agentName}, un asistente de atención al cliente profesional y amigable para un sistema CRM de WhatsApp. Responde de manera útil, concisa y cordial. Mantén un tono profesional pero cálido.`
          },
          {
            role: "user",
            content: message
          }
        ],
        max_tokens: 500,
        temperature: 0.7
      });

      const response = completion.choices[0]?.message?.content;

      if (response && response.trim().length > 0) {
        console.log(`✅ Respuesta generada exitosamente con ChatGPT Plus: ${response.substring(0, 100)}...`);
        return response.trim();
      } else {
        console.log('⚠️ ChatGPT Plus no generó respuesta válida');
        return this.getEmergencyResponse();
      }

    } catch (error) {
      console.error('❌ Error generando respuesta con ChatGPT Plus:', error);
      
      // Check if it's a quota/billing issue
      if (error.message?.includes('quota') || error.message?.includes('billing')) {
        console.log('💳 Error de cuota/facturación detectado');
      }
      
      return this.getEmergencyResponse();
    }
  }

  /**
   * Check if service is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.isInitialized || !this.openai) {
      return false;
    }

    try {
      // Test with a simple request
      await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "test" }],
        max_tokens: 1
      });
      return true;
    } catch (error) {
      console.log('⚠️ ChatGPT Plus API no disponible:', error.message);
      return false;
    }
  }

  /**
   * Get emergency fallback response
   */
  private getEmergencyResponse(): string {
    const responses = [
      'Gracias por contactarnos. Un representante se pondrá en contacto contigo pronto.',
      'Hemos recibido tu mensaje y te responderemos en el menor tiempo posible.',
      'Tu consulta es importante para nosotros. Te atenderemos tan pronto como sea posible.',
      'Estamos aquí para ayudarte. Nuestro equipo te responderá en breve.',
      'Apreciamos tu contacto. Te responderemos lo antes posible.'
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Get service status
   */
  getStatus(): { initialized: boolean; available: boolean; apiKeyConfigured: boolean } {
    const apiKey = process.env.OPENAI_API_KEY;
    return {
      initialized: this.isInitialized,
      available: this.openai !== null,
      apiKeyConfigured: Boolean(apiKey && apiKey !== 'placeholder')
    };
  }
}

// Singleton instance
export const chatgptPlusDirectService = new ChatGPTPlusDirectService();