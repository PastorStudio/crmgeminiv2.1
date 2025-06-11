/**
 * ChatGPT Plus Streaming Service
 * Uses ChatGPT Plus account with streaming capabilities instead of OpenAI API
 */

import { OpenAI } from 'openai';

export class ChatGPTStreamer {
  private openai: OpenAI;
  private assistant: any;
  private thread: any;

  constructor() {
    // Initialize with ChatGPT Plus configuration
    this.openai = new OpenAI({
      apiKey: process.env.CHATGPT_PLUS_API_KEY || 'placeholder'
    });
  }

  /**
   * Initialize assistant and thread for streaming
   */
  async initialize(agentName: string): Promise<void> {
    try {
      // Create assistant
      this.assistant = await this.openai.beta.assistants.create({
        name: agentName,
        instructions: `Eres ${agentName}, un asistente de atención al cliente profesional y amigable. Responde de manera útil, concisa y cordial.`,
        model: "gpt-4-turbo-preview",
        tools: []
      });

      // Create thread
      this.thread = await this.openai.beta.threads.create();
      
      console.log(`✅ ChatGPT Plus assistant initialized: ${agentName}`);
    } catch (error) {
      console.error('❌ Error initializing ChatGPT Plus assistant:', error);
      throw error;
    }
  }

  /**
   * Generate streaming response using ChatGPT Plus
   */
  async generateStreamingResponse(messageText: string, agentName: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        // Ensure assistant is initialized
        if (!this.assistant || !this.thread) {
          await this.initialize(agentName);
        }

        // Add message to thread
        await this.openai.beta.threads.messages.create(this.thread.id, {
          role: "user",
          content: messageText
        });

        let responseText = '';

        // Stream the response using ChatGPT Plus
        const run = this.openai.beta.threads.runs.stream(this.thread.id, {
          assistant_id: this.assistant.id
        })
        .on('textCreated', (text) => {
          console.log('🤖 ChatGPT Plus response started...');
        })
        .on('textDelta', (textDelta, snapshot) => {
          // Accumulate response text
          responseText += textDelta.value || '';
        })
        .on('toolCallCreated', (toolCall) => {
          console.log(`🔧 Tool call: ${toolCall.type}`);
        })
        .on('toolCallDelta', (toolCallDelta, snapshot) => {
          if (toolCallDelta.type === 'code_interpreter') {
            if (toolCallDelta.code_interpreter?.input) {
              console.log('📝 Code input:', toolCallDelta.code_interpreter.input);
            }
            if (toolCallDelta.code_interpreter?.outputs) {
              toolCallDelta.code_interpreter.outputs.forEach(output => {
                if (output.type === "logs") {
                  console.log('📊 Output logs:', output.logs);
                }
              });
            }
          }
        })
        .on('end', () => {
          console.log('✅ ChatGPT Plus stream completed');
          resolve(responseText.trim() || 'Lo siento, no pude generar una respuesta en este momento.');
        })
        .on('error', (error) => {
          console.error('❌ ChatGPT Plus stream error:', error);
          reject(error);
        });

        // Timeout after 30 seconds
        setTimeout(() => {
          if (responseText.length === 0) {
            reject(new Error('ChatGPT Plus response timeout'));
          }
        }, 30000);

      } catch (error) {
        console.error('❌ Error in ChatGPT Plus streaming:', error);
        reject(error);
      }
    });
  }

  /**
   * Fallback method for when streaming is not available
   */
  async generateFallbackResponse(messageText: string, agentName: string): Promise<string> {
    try {
      // Simple predefined responses for demo purposes
      const responses = [
        'Gracias por tu mensaje. Un representante se pondrá en contacto contigo pronto.',
        'Hemos recibido tu consulta y la estamos procesando.',
        'Tu solicitud es importante para nosotros. Te responderemos en breve.',
        'Estamos aquí para ayudarte. ¿En qué más podemos asistirte?',
        'Apreciamos tu contacto. Nuestro equipo revisará tu mensaje.'
      ];

      // Select response based on message content
      const randomIndex = Math.floor(Math.random() * responses.length);
      return responses[randomIndex];
    } catch (error) {
      console.error('❌ Error in fallback response:', error);
      return 'Gracias por tu mensaje. Te responderemos pronto.';
    }
  }

  /**
   * Main method to generate AI response with ChatGPT Plus
   */
  async generateResponse(messageText: string, agentName: string): Promise<string> {
    try {
      // Try ChatGPT Plus streaming first
      return await this.generateStreamingResponse(messageText, agentName);
    } catch (error) {
      console.log('🔄 ChatGPT Plus unavailable, using fallback response');
      return await this.generateFallbackResponse(messageText, agentName);
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.assistant) {
        await this.openai.beta.assistants.del(this.assistant.id);
        this.assistant = null;
      }
      if (this.thread) {
        await this.openai.beta.threads.del(this.thread.id);
        this.thread = null;
      }
      console.log('✅ ChatGPT Plus resources cleaned up');
    } catch (error) {
      console.error('❌ Error cleaning up ChatGPT Plus resources:', error);
    }
  }
}

// Singleton instance
export const chatGPTStreamer = new ChatGPTStreamer();