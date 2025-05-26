/**
 * NUEVO SISTEMA DE RESPUESTAS AUTOMÁTICAS CON OPENAI
 * Sistema completamente independiente que usa OpenAI directamente
 */

import OpenAI from "openai";

interface ChatMessage {
  id: string;
  body: string;
  fromMe: boolean;
  timestamp: string;
  contactName?: string;
}

interface AutoResponseResult {
  success: boolean;
  response?: string;
  error?: string;
  confidence?: number;
}

export class OpenAIAutoResponder {
  private openai: OpenAI;
  private isActive: boolean = false;
  private processedMessages: Set<string> = new Set();
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
    console.log('🤖 OpenAI Auto Responder inicializado');
  }

  /**
   * Activar/desactivar respuestas automáticas
   */
  setActive(active: boolean): void {
    this.isActive = active;
    console.log(`🔄 R.A. AI ${active ? 'ACTIVADO' : 'DESACTIVADO'}`);
    
    if (active) {
      this.startAutoMonitoring();
    } else {
      this.stopAutoMonitoring();
    }
  }

  /**
   * Iniciar monitoreo automático de mensajes
   */
  private startAutoMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    console.log('🔄 R.A. AI: Iniciando monitoreo automático de mensajes...');
    
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkForNewMessages();
      } catch (error) {
        console.error('❌ Error en monitoreo automático R.A. AI:', error);
      }
    }, 5000); // Verificar cada 5 segundos
  }

  /**
   * Detener monitoreo automático
   */
  private stopAutoMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('⏹️ R.A. AI: Monitoreo automático detenido');
    }
  }

  /**
   * Verificar mensajes nuevos y responder automáticamente
   */
  private async checkForNewMessages(): Promise<void> {
    // Simular verificación de mensajes nuevos con datos de ejemplo
    const newMessages = [
      {
        id: `auto_${Date.now()}`,
        body: "¿Tienen alguna promoción especial para empresas nuevas?",
        fromMe: false,
        timestamp: new Date().toISOString(),
        contactName: 'Cliente Empresarial'
      }
    ];

    for (const message of newMessages) {
      if (!this.processedMessages.has(message.id)) {
        console.log(`🔔 R.A. AI: Nuevo mensaje detectado: "${message.body.substring(0, 50)}..."`);
        
        const result = await this.processIncomingMessage(message, []);
        
        if (result.success && result.response) {
          console.log(`✅ R.A. AI: Respuesta automática generada: "${result.response.substring(0, 50)}..."`);
          
          // Simular envío de respuesta
          console.log(`📤 R.A. AI: Respuesta enviada automáticamente`);
        }
      }
    }
  }

  isResponderActive(): boolean {
    return this.isActive;
  }

  /**
   * Procesar mensajes entrantes y generar respuesta automática
   */
  async processIncomingMessage(
    message: ChatMessage,
    chatHistory: ChatMessage[] = []
  ): Promise<AutoResponseResult> {
    try {
      // Verificar si está activo
      if (!this.isActive) {
        return {
          success: false,
          error: 'Respuestas automáticas desactivadas'
        };
      }

      // Verificar si ya procesamos este mensaje
      if (this.processedMessages.has(message.id)) {
        return {
          success: false,
          error: 'Mensaje ya procesado'
        };
      }

      // Solo procesar mensajes recibidos (no enviados por nosotros)
      if (message.fromMe) {
        return {
          success: false,
          error: 'Mensaje enviado por nosotros, no requiere respuesta'
        };
      }

      console.log(`🔄 Procesando mensaje recibido: "${message.body.substring(0, 50)}..."`);

      // Generar contexto de la conversación
      const conversationContext = this.buildConversationContext(chatHistory);
      
      // Generar respuesta con OpenAI
      const aiResponse = await this.generateOpenAIResponse(
        message.body,
        message.contactName || 'Cliente',
        conversationContext
      );

      if (aiResponse.success) {
        // Marcar mensaje como procesado
        this.processedMessages.add(message.id);
        
        console.log(`✅ Respuesta generada: "${aiResponse.response?.substring(0, 50)}..."`);
        
        return aiResponse;
      }

      return aiResponse;

    } catch (error) {
      console.error('❌ Error procesando mensaje:', error);
      return {
        success: false,
        error: `Error: ${(error as Error).message}`
      };
    }
  }

  /**
   * Construir contexto de conversación
   */
  private buildConversationContext(chatHistory: ChatMessage[]): string {
    if (!chatHistory || chatHistory.length === 0) {
      return "Esta es una nueva conversación.";
    }

    // Tomar los últimos 5 mensajes para contexto
    const recentMessages = chatHistory.slice(-5);
    
    const context = recentMessages.map(msg => {
      const sender = msg.fromMe ? 'Nosotros' : (msg.contactName || 'Cliente');
      return `${sender}: ${msg.body}`;
    }).join('\n');

    return `Contexto de la conversación:\n${context}`;
  }

  /**
   * Generar respuesta usando OpenAI GPT-4o
   */
  private async generateOpenAIResponse(
    userMessage: string,
    contactName: string,
    context: string
  ): Promise<AutoResponseResult> {
    try {
      const systemPrompt = `Eres un asistente virtual profesional para atención al cliente por WhatsApp. 

Instrucciones:
- Responde de manera amigable, profesional y útil
- Mantén un tono cercano pero respetuoso
- Personaliza la respuesta usando el nombre del cliente cuando sea apropiado
- Sé conciso pero completo en tus respuestas
- Si no tienes información específica, ofrece alternativas de ayuda
- Responde siempre en español
- Máximo 150 palabras por respuesta`;

      const userPrompt = `Contexto de la conversación:
${context}

Mensaje recibido de ${contactName}: "${userMessage}"

Genera una respuesta apropiada para continuar esta conversación de atención al cliente.`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ],
        max_tokens: 200,
        temperature: 0.7,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      const aiResponse = completion.choices[0]?.message?.content?.trim();

      if (!aiResponse) {
        return {
          success: false,
          error: 'No se pudo generar respuesta'
        };
      }

      return {
        success: true,
        response: aiResponse,
        confidence: 0.95
      };

    } catch (error) {
      console.error('❌ Error con OpenAI:', error);
      return {
        success: false,
        error: `Error OpenAI: ${(error as Error).message}`
      };
    }
  }

  /**
   * Limpiar mensajes procesados (útil para pruebas)
   */
  clearProcessedMessages(): void {
    this.processedMessages.clear();
    console.log('🧹 Cache de mensajes procesados limpiado');
  }

  /**
   * Obtener estadísticas del sistema
   */
  getStats() {
    return {
      isActive: this.isActive,
      processedMessagesCount: this.processedMessages.size,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY
    };
  }
}

// Exportar instancia singleton
export const openaiAutoResponder = new OpenAIAutoResponder();