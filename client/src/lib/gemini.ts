import { apiRequest } from "./queryClient";

/**
 * Configuration for the Gemini API
 */
interface GeminiConfig {
  apiKey?: string;
  temperature?: number;
  maxOutputTokens?: number;
  topK?: number;
  topP?: number;
}

/**
 * Represents a message in a conversation with Gemini
 */
export interface GeminiMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Utility class for interacting with the Gemini API
 */
export class GeminiClient {
  private config: GeminiConfig;

  constructor(config: GeminiConfig = {}) {
    this.config = {
      apiKey: process.env.GEMINI_API_KEY || "",
      temperature: 0.7,
      maxOutputTokens: 1024,
      topK: 40,
      topP: 0.95,
      ...config
    };
  }

  /**
   * Analyze a lead using Gemini to extract insights
   */
  async analyzeLead(leadId: number) {
    try {
      const response = await apiRequest("POST", "/api/gemini/analyze-lead", { leadId });
      return await response.json();
    } catch (error) {
      console.error("Error analyzing lead with Gemini:", error);
      throw error;
    }
  }

  /**
   * Generate personalized message content based on lead information
   */
  async generateMessage(leadId: number, messageType: string, context?: string) {
    try {
      const response = await apiRequest("POST", "/api/gemini/generate-message", {
        leadId,
        messageType,
        context
      });
      return await response.json();
    } catch (error) {
      console.error("Error generating message with Gemini:", error);
      throw error;
    }
  }

  /**
   * Send a chat message to Gemini and get a response
   */
  async chat(message: string, history: GeminiMessage[] = []) {
    try {
      const response = await apiRequest("POST", "/api/gemini/chat", {
        message,
        history
      });
      return await response.json();
    } catch (error) {
      console.error("Error chatting with Gemini:", error);
      throw error;
    }
  }

  /**
   * Generate a follow-up email for a lead
   */
  async generateFollowUpEmail(leadId: number) {
    return this.generateMessage(leadId, "follow-up");
  }

  /**
   * Generate a proposal email for a lead
   */
  async generateProposal(leadId: number) {
    return this.generateMessage(leadId, "proposal");
  }

  /**
   * Generate a meeting request email for a lead
   */
  async generateMeetingRequest(leadId: number) {
    return this.generateMessage(leadId, "meeting-request");
  }
}

// Export a singleton instance of the client
export const geminiClient = new GeminiClient();
