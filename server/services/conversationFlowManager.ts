/**
 * Advanced Conversation Flow Manager
 * Manages natural conversation flow with greeting, development, and farewell phases
 */

// Dynamic import to avoid circular dependencies

interface ConversationState {
  chatId: string;
  phase: 'greeting' | 'development' | 'farewell' | 'completed';
  messageCount: number;
  lastMessageTime: Date;
  context: string[];
  userIntent: string;
  activePrompt: string;
  accountId: number;
  userName?: string;
}

interface ConversationFlow {
  greeting: {
    triggers: string[];
    responses: string[];
    nextPhase: 'development';
  };
  development: {
    maxMessages: number;
    contextAware: boolean;
    nextPhase: 'farewell';
  };
  farewell: {
    triggers: string[];
    responses: string[];
    nextPhase: 'completed';
  };
}

class ConversationFlowManager {
  private conversationStates = new Map<string, ConversationState>();
  private conversationFlow: ConversationFlow;

  constructor() {
    this.conversationFlow = {
      greeting: {
        triggers: ['hola', 'hello', 'buenos días', 'buenas tardes', 'buenas noches', 'hi', 'hey', 'saludos'],
        responses: [
          'Hola! Me da mucho gusto saludarte. ¿En qué puedo ayudarte hoy?',
          'Buenos días! Soy tu asistente. ¿Cómo puedo ser de utilidad?',
          'Hola! Espero que tengas un excelente día. ¿Qué información necesitas?',
          'Hola, bienvenido. Estoy aquí para ayudarte con lo que necesites.'
        ],
        nextPhase: 'development'
      },
      development: {
        maxMessages: 6,
        contextAware: true,
        nextPhase: 'farewell'
      },
      farewell: {
        triggers: ['gracias', 'thank you', 'adiós', 'goodbye', 'bye', 'hasta luego', 'nos vemos', 'chao'],
        responses: [
          'Ha sido un placer ayudarte! Si necesitas algo más, no dudes en escribirme.',
          'Excelente! Me alegra haber podido ayudarte. Que tengas un gran día!',
          'Gracias por contactarnos. Estaré aquí cuando me necesites. Hasta pronto!',
          'Fue un gusto atenderte. No dudes en contactarme si necesitas más ayuda.'
        ],
        nextPhase: 'completed'
      }
    };
  }

  /**
   * Process incoming message and determine conversation flow
   */
  async processMessage(
    chatId: string, 
    message: string, 
    accountId: number
  ): Promise<{
    response: string;
    phase: string;
    shouldContinue: boolean;
    confidence: number;
  }> {
    try {
      const state = this.getOrCreateConversationState(chatId, accountId);
      const cleanMessage = message.toLowerCase().trim();

      // Determine conversation phase
      const newPhase = this.determinePhase(cleanMessage, state);
      
      // Update conversation state
      state.phase = newPhase;
      state.messageCount++;
      state.lastMessageTime = new Date();
      state.context.push(message);

      // Keep only last 10 messages for context
      if (state.context.length > 10) {
        state.context = state.context.slice(-10);
      }

      // Generate contextual response
      const response = await this.generateContextualResponse(state, message);
      
      // Update state after response
      this.conversationStates.set(chatId, state);

      return {
        response: response.text,
        phase: state.phase,
        shouldContinue: state.phase !== 'completed',
        confidence: response.confidence
      };

    } catch (error) {
      console.error('Error processing conversation flow:', error);
      return {
        response: 'Disculpa, hubo un error. ¿Puedes repetir tu mensaje?',
        phase: 'development',
        shouldContinue: true,
        confidence: 50
      };
    }
  }

  /**
   * Get or create conversation state
   */
  private getOrCreateConversationState(chatId: string, accountId: number): ConversationState {
    if (!this.conversationStates.has(chatId)) {
      this.conversationStates.set(chatId, {
        chatId,
        phase: 'greeting',
        messageCount: 0,
        lastMessageTime: new Date(),
        context: [],
        userIntent: '',
        activePrompt: '',
        accountId
      });
    }
    return this.conversationStates.get(chatId)!;
  }

  /**
   * Determine conversation phase based on message content and current state
   */
  private determinePhase(message: string, state: ConversationState): ConversationState['phase'] {
    // Check for farewell triggers
    if (this.conversationFlow.farewell.triggers.some(trigger => message.includes(trigger))) {
      return 'farewell';
    }

    // Check for greeting triggers (only if first message or after long pause)
    if (state.messageCount === 0 || this.isGreetingMessage(message)) {
      return 'greeting';
    }

    // Check if we should move to farewell phase
    if (state.phase === 'development' && state.messageCount >= this.conversationFlow.development.maxMessages) {
      return 'farewell';
    }

    // Default to development phase
    return state.phase === 'greeting' ? 'development' : state.phase;
  }

  /**
   * Check if message is a greeting
   */
  private isGreetingMessage(message: string): boolean {
    return this.conversationFlow.greeting.triggers.some(trigger => 
      message.includes(trigger)
    );
  }

  /**
   * Generate contextual response based on conversation state
   */
  private async generateContextualResponse(
    state: ConversationState, 
    message: string
  ): Promise<{ text: string; confidence: number }> {
    try {
      // Get active prompt for the account
      const activePrompt = await this.getActivePrompt(state.accountId);
      
      switch (state.phase) {
        case 'greeting':
          return this.generateGreetingResponse(state, message, activePrompt);
        
        case 'development':
          return this.generateDevelopmentResponse(state, message, activePrompt);
        
        case 'farewell':
          return this.generateFarewellResponse(state, message, activePrompt);
        
        default:
          return {
            text: 'Hola, ¿en qué puedo ayudarte?',
            confidence: 70
          };
      }
    } catch (error) {
      console.error('Error generating contextual response:', error);
      return {
        text: 'Disculpa, ¿puedes repetir tu pregunta?',
        confidence: 50
      };
    }
  }

  /**
   * Generate greeting response
   */
  private async generateGreetingResponse(
    state: ConversationState, 
    message: string, 
    activePrompt: string
  ): Promise<{ text: string; confidence: number }> {
    const greetingResponses = this.conversationFlow.greeting.responses;
    const baseResponse = greetingResponses[Math.floor(Math.random() * greetingResponses.length)];
    
    // Return base greeting response
    return {
      text: baseResponse,
      confidence: 85
    };
  }

  /**
   * Generate development response
   */
  private async generateDevelopmentResponse(
    state: ConversationState, 
    message: string, 
    activePrompt: string
  ): Promise<{ text: string; confidence: number }> {
    // Generate contextual response for development phase
    const developmentResponses = [
      'Entiendo tu consulta. ¿Puedes darme más detalles sobre lo que necesitas?',
      'Perfecto, puedo ayudarte con eso. ¿Qué información específica buscas?',
      'Claro, estoy aquí para asistirte. ¿Podrías ser más específico?',
      'Excelente pregunta. Déjame ayudarte con esa información.'
    ];
    
    const response = developmentResponses[Math.floor(Math.random() * developmentResponses.length)];
    
    return {
      text: response,
      confidence: 80
    };
  }

  /**
   * Generate farewell response
   */
  private async generateFarewellResponse(
    state: ConversationState, 
    message: string, 
    activePrompt: string
  ): Promise<{ text: string; confidence: number }> {
    const farewellResponses = this.conversationFlow.farewell.responses;
    const baseResponse = farewellResponses[Math.floor(Math.random() * farewellResponses.length)];
    
    // Return base farewell response
    return {
      text: baseResponse,
      confidence: 85
    };
  }

  /**
   * Get active prompt for WhatsApp account
   */
  private async getActivePrompt(accountId: number): Promise<string> {
    try {
      // Import storage dynamically to avoid circular dependencies
      const { storage } = await import('../storage');
      const accounts = await storage.getWhatsAppAccounts();
      const account = accounts.find(acc => acc.id === accountId);
      return account?.autoResponsePrompt || '';
    } catch (error) {
      console.error('Error getting active prompt:', error);
      return '';
    }
  }

  /**
   * Enhance response with AI (simplified version)
   */
  private async enhanceWithAI(
    context: string, 
    message: string, 
    phase: string
  ): Promise<string> {
    // For now, return fallback responses to ensure system stability
    return this.getFallbackResponse(phase);
  }

  /**
   * Clean AI response to make it more natural
   */
  private cleanResponse(text: string): string {
    // Remove common AI response patterns
    let cleaned = text
      .replace(/^(Respuesta:|Response:|Asistente:|Usuario:)/gi, '')
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove markdown bold
      .replace(/\*(.*?)\*/g, '$1') // Remove markdown italic
      .replace(/^\s*[-•]\s*/gm, '') // Remove bullet points
      .trim();

    // Ensure response doesn't start with common AI phrases
    const aiPhrases = [
      'Como asistente de IA',
      'Soy un asistente virtual',
      'Como IA',
      'Según mi conocimiento',
      'Basándome en la información'
    ];

    for (const phrase of aiPhrases) {
      if (cleaned.toLowerCase().startsWith(phrase.toLowerCase())) {
        cleaned = cleaned.substring(phrase.length).trim();
        if (cleaned.startsWith(',')) {
          cleaned = cleaned.substring(1).trim();
        }
      }
    }

    // Ensure response ends naturally
    if (!cleaned.match(/[.!?]$/)) {
      cleaned += '.';
    }

    // Limit length for WhatsApp
    if (cleaned.length > 300) {
      cleaned = cleaned.substring(0, 297) + '...';
    }

    return cleaned;
  }

  /**
   * Build AI prompt for natural conversation
   */
  private buildAIPrompt(context: string, message: string, phase: string): string {
    const phaseInstructions = {
      greeting: 'Responde con un saludo cálido y profesional. Pregunta cómo puedes ayudar.',
      development: 'Mantén la conversación natural y relevante. Proporciona información útil basada en el contexto.',
      farewell: 'Despídete de forma amable y profesional. Deja la puerta abierta para futuras consultas.'
    };

    return `
INSTRUCCIONES PARA CONVERSACIÓN NATURAL:
- Fase actual: ${phase}
- ${phaseInstructions[phase as keyof typeof phaseInstructions]}
- Mantén un tono profesional pero amigable
- Responde en máximo 2 oraciones
- Usa emojis solo si es apropiado

CONTEXTO:
${context}

MENSAJE DEL USUARIO:
${message}

RESPUESTA:`;
  }

  /**
   * Get fallback response for each phase
   */
  private getFallbackResponse(phase: string): string {
    const fallbacks = {
      greeting: '¡Hola! ¿En qué puedo ayudarte hoy?',
      development: 'Entiendo tu consulta. ¿Puedes darme más información?',
      farewell: '¡Gracias por contactarnos! Que tengas un excelente día.'
    };
    
    return fallbacks[phase as keyof typeof fallbacks] || 'Hola, ¿cómo puedo ayudarte?';
  }

  /**
   * Clean up old conversation states
   */
  public cleanupOldConversations(): void {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [chatId, state] of this.conversationStates.entries()) {
      if (now.getTime() - state.lastMessageTime.getTime() > maxAge) {
        this.conversationStates.delete(chatId);
      }
    }
  }

  /**
   * Get conversation statistics
   */
  public getConversationStats(): {
    activeConversations: number;
    completedConversations: number;
    averageMessageCount: number;
  } {
    const states = Array.from(this.conversationStates.values());
    const completed = states.filter(s => s.phase === 'completed').length;
    const active = states.length - completed;
    const avgMessages = states.reduce((sum, s) => sum + s.messageCount, 0) / states.length || 0;

    return {
      activeConversations: active,
      completedConversations: completed,
      averageMessageCount: Math.round(avgMessages)
    };
  }
}

export const conversationFlowManager = new ConversationFlowManager();

// Clean up old conversations every hour
setInterval(() => {
  conversationFlowManager.cleanupOldConversations();
}, 60 * 60 * 1000);