/**
 * Intelligent Auto Response Service
 * Handles natural conversation using AI providers
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { unifiedAIProvider } from './unifiedAIProvider.js';

interface ConversationContext {
  chatId: string;
  fromNumber: string;
  currentState: string;
  recentMessages: any[];
  lastMessageTime: Date;
  conversationCount: number;
  customerName: string;
  businessContext: string;
}

interface AutoResponse {
  message: string;
  confidence: number;
  nextState: string;
  shouldSendFarewell: boolean;
  needsHumanIntervention: boolean;
}

export class IntelligentAutoResponseService {
  private geminiAPI: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }
    this.geminiAPI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Process incoming message and generate intelligent response
   */
  async processIncomingMessage(
    accountId: number,
    chatId: string,
    messageContent: string,
    fromNumber: string
  ): Promise<AutoResponse | null> {
    try {
      console.log(`Processing message: "${messageContent}" from ${fromNumber}`);

      // Get conversation context
      const context = await this.getConversationContext(accountId, chatId, fromNumber);
      if (!context) {
        console.log('Could not get conversation context');
        return null;
      }

      // Generate response using unified AI provider with fallback
      const aiResponse = await unifiedAIProvider.generateWithFallback(
        messageContent,
        'deepseek'
      );

      if (!aiResponse.success || !aiResponse.message) {
        console.log('Could not generate AI response');
        return null;
      }

      console.log(`Generated response: "${aiResponse.message}" (confidence: ${aiResponse.confidence}%)`);

      return {
        message: aiResponse.message,
        confidence: aiResponse.confidence,
        nextState: context.currentState,
        shouldSendFarewell: false,
        needsHumanIntervention: aiResponse.confidence < 70
      };
    } catch (error) {
      console.error('Error processing intelligent message:', error);
      return null;
    }
  }

  /**
   * Get conversation context
   */
  private async getConversationContext(
    accountId: number,
    chatId: string,
    fromNumber: string
  ): Promise<ConversationContext | null> {
    try {
      console.log(`Getting context for chat ${chatId} from ${fromNumber}`);
      
      // Simple context for response generation
      return {
        chatId,
        fromNumber,
        currentState: 'ongoing',
        recentMessages: [],
        lastMessageTime: new Date(),
        conversationCount: 1,
        customerName: 'Cliente',
        businessContext: 'general'
      };
    } catch (error) {
      console.error('Error getting conversation context:', error);
      return null;
    }
  }

  /**
   * Send response (placeholder for actual WhatsApp sending)
   */
  async sendResponse(accountId: number, chatId: string, message: string): Promise<boolean> {
    console.log(`Would send message to ${chatId}: "${message}"`);
    return true;
  }
}

// Export singleton instance
export const intelligentAutoResponse = new IntelligentAutoResponseService();