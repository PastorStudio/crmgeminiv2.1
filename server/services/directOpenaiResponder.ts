import OpenAI from 'openai';

/**
 * Sistema R.A. AI directo que funciona automáticamente con OpenAI
 * No requiere configuraciones adicionales, solo activar/desactivar
 */
class DirectOpenaiResponder {
  private openai: OpenAI;
  private isActiveState: boolean = false;

  constructor() {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
    console.log('🤖 R.A. AI Direct inicializado correctamente');
  }

  /**
   * Activar o desactivar el sistema
   */
  setActive(active: boolean): void {
    this.isActiveState = active;
    console.log(`🤖 R.A. AI ${active ? '✅ ACTIVADO' : '❌ DESACTIVADO'}`);
  }

  /**
   * Verificar si está activo
   */
  isActive(): boolean {
    return this.isActiveState;
  }

  /**
   * Generar respuesta usando OpenAI
   */
  async generateResponse(messageText: string, chatHistory: any[] = []): Promise<string> {
    try {
      // Crear contexto de conversación usando los últimos mensajes
      let context = '';
      if (chatHistory && chatHistory.length > 0) {
        const lastMessages = chatHistory.slice(-5).map(msg => {
          const sender = msg.fromMe ? 'Agente' : 'Cliente';
          const content = msg.body || msg.content || '';
          return `${sender}: ${content}`;
        }).join('\n');
        context = `Historial reciente:\n${lastMessages}\n\n`;
      }

      const prompt = `${context}Mensaje actual del cliente: ${messageText}

Eres un asistente de ventas profesional especializado en telecomunicaciones. Responde de manera amigable y útil:

- Sé profesional pero cercano
- Ayuda con consultas sobre servicios de telecomunicaciones  
- Ofrece soluciones específicas cuando sea apropiado
- Si necesitan información detallada, sugiere contactar a un asesor
- Mantén las respuestas claras y concisas (máximo 150 palabras)

Responde al cliente:`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "Eres un asistente de ventas especializado en telecomunicaciones. Responde de manera profesional, amigable y útil."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.7
      });

      const generatedResponse = response.choices[0].message.content || "Gracias por contactarnos. Un asesor se comunicará contigo pronto.";
      
      console.log(`✅ R.A. AI: Respuesta generada exitosamente (${generatedResponse.length} caracteres)`);
      
      return generatedResponse;
    } catch (error) {
      console.error('❌ R.A. AI: Error generando respuesta:', error);
      throw new Error(`Error al generar respuesta: ${error.message}`);
    }
  }

  /**
   * Procesar mensaje automáticamente
   */
  async processMessage(messageText: string, chatHistory: any[] = []): Promise<{
    success: boolean;
    response?: string;
    error?: string;
  }> {
    try {
      // Verificar si está activo
      if (!this.isActiveState) {
        return {
          success: false,
          error: 'R.A. AI está desactivado. Actívalo con el botón morado.'
        };
      }

      // Validar mensaje
      if (!messageText || !messageText.trim()) {
        return {
          success: false,
          error: 'Mensaje vacío'
        };
      }

      console.log(`🔍 R.A. AI: Procesando mensaje: "${messageText.substring(0, 50)}..."`);

      // Generar respuesta
      const response = await this.generateResponse(messageText, chatHistory);
      
      return {
        success: true,
        response: response
      };
    } catch (error) {
      console.error(`❌ R.A. AI: Error procesando mensaje:`, error);
      return {
        success: false,
        error: error.message || 'Error interno'
      };
    }
  }

  /**
   * Obtener estado del sistema
   */
  getStatus(): { active: boolean; ready: boolean } {
    return {
      active: this.isActiveState,
      ready: !!process.env.OPENAI_API_KEY
    };
  }
}

// Exportar instancia única
export const directOpenaiResponder = new DirectOpenaiResponder();