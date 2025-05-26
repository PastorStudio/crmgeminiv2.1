import OpenAI from 'openai';

/**
 * Sistema R.A. AI simplificado que funciona de forma completamente independiente
 * No depende de configuraciones de agentes ni del sistema principal
 */
export class SimpleOpenaiResponder {
  private openai: OpenAI;
  private isActiveState: boolean = false;

  constructor() {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
    console.log('🤖 Simple R.A. AI inicializado');
  }

  /**
   * Activar/desactivar el sistema R.A. AI
   */
  setActive(active: boolean): void {
    this.isActiveState = active;
    console.log(`🤖 Simple R.A. AI ${active ? 'ACTIVADO' : 'DESACTIVADO'}`);
  }

  /**
   * Verificar si está activo
   */
  isActive(): boolean {
    return this.isActiveState;
  }

  /**
   * Generar respuesta automática usando OpenAI
   */
  async generateResponse(messageText: string, conversationHistory: any[] = []): Promise<string> {
    try {
      // Crear contexto de la conversación
      const context = conversationHistory.slice(-5).map(msg => 
        `${msg.fromMe ? 'Agente' : 'Cliente'}: ${msg.body || msg.content || ''}`
      ).join('\n');

      const prompt = `Eres un asistente de ventas profesional y amigable especializado en telecomunicaciones. 

Contexto de la conversación:
${context}

Mensaje actual del cliente: ${messageText}

Instrucciones:
- Responde de manera profesional y amigable
- Enfócate en ayudar al cliente con sus necesidades de telecomunicaciones
- Ofrece soluciones específicas cuando sea apropiado
- Mantén un tono conversacional pero profesional
- Si el cliente pregunta por precios, ofrece programar una llamada con un asesor
- Máximo 150 palabras

Responde al cliente:`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "Eres un asistente de ventas especializado en telecomunicaciones. Responde de manera profesional y útil."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.7
      });

      return response.choices[0].message.content || "Gracias por contactarnos. Un asesor se comunicará contigo pronto.";
    } catch (error) {
      console.error('❌ Error generando respuesta R.A. AI:', error);
      throw new Error(`Error generando respuesta: ${error.message}`);
    }
  }

  /**
   * Procesar mensaje y generar respuesta automática
   */
  async processMessage(messageText: string, conversationHistory: any[] = []): Promise<{
    success: boolean;
    response?: string;
    error?: string;
  }> {
    try {
      if (!this.isActiveState) {
        return {
          success: false,
          error: 'R.A. AI está desactivado - actívalo con el botón morado'
        };
      }

      if (!messageText || !messageText.trim()) {
        return {
          success: false,
          error: 'Mensaje vacío'
        };
      }

      console.log(`🔍 Simple R.A. AI: Procesando mensaje: "${messageText.substring(0, 50)}..."`);

      const response = await this.generateResponse(messageText, conversationHistory);
      
      console.log(`✅ Simple R.A. AI: Respuesta generada exitosamente`);
      
      return {
        success: true,
        response: response
      };
    } catch (error) {
      console.error(`❌ Simple R.A. AI: Error procesando mensaje:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Instancia global del Simple R.A. AI
export const simpleOpenaiResponder = new SimpleOpenaiResponder();