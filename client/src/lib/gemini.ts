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
  professionLevel?: ProfessionLevel;
}

/**
 * Represents a message in a conversation with Gemini
 */
export interface GeminiMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Niveles de profesionalismo para la comunicación de Gemini
 */
export enum ProfessionLevel {
  CASUAL = "casual",           // Informal y amigable
  PROFESSIONAL = "professional", // Formal y profesional
  TECHNICAL = "technical",      // Técnico y detallado
  EXECUTIVE = "executive"       // Ejecutivo y conciso
}

/**
 * Categoría de chat según análisis de Gemini
 */
export interface ChatCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  probability: number;
}

/**
 * Información extraída de mensajes por Gemini
 */
export interface MessageAnalysis {
  intent: string;
  sentiment: "positive" | "neutral" | "negative";
  urgency: "low" | "medium" | "high";
  topics: string[];
  entities: {
    name: string;
    type: string;
    value: string;
  }[];
  suggestedNextAction?: string;
  suggestedResponseTemplate?: string;
}

/**
 * Utility class for interacting with the Gemini API
 */
export class GeminiClient {
  private config: GeminiConfig;

  constructor(config: GeminiConfig = {}) {
    this.config = {
      apiKey: import.meta.env.VITE_GEMINI_API_KEY || "",
      temperature: 0.7,
      maxOutputTokens: 1024,
      topK: 40,
      topP: 0.95,
      professionLevel: ProfessionLevel.PROFESSIONAL,
      ...config
    };
  }

  /**
   * Actualiza el nivel de profesionalismo para las comunicaciones
   */
  setProfessionLevel(level: ProfessionLevel) {
    this.config.professionLevel = level;
  }

  /**
   * Obtiene el nivel de profesionalismo actual
   */
  getProfessionLevel(): ProfessionLevel {
    return this.config.professionLevel || ProfessionLevel.PROFESSIONAL;
  }

  /**
   * Analyze a lead using Gemini to extract insights
   */
  async analyzeLead(leadId: number) {
    try {
      const response = await apiRequest("/api/gemini/analyze-lead", {
        method: "POST",
        body: { 
          leadId,
          professionLevel: this.config.professionLevel 
        }
      });
      return response;
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
      const response = await apiRequest("/api/gemini/generate-message", {
        method: "POST",
        body: {
          leadId,
          messageType,
          context,
          professionLevel: this.config.professionLevel
        }
      });
      return response;
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
      const response = await apiRequest("/api/gemini/chat", {
        method: "POST",
        body: {
          message,
          history,
          professionLevel: this.config.professionLevel
        }
      });
      return response;
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

  /**
   * Analiza un mensaje o conversación para extraer información relevante
   */
  async analyzeMessage(message: string, context?: string) {
    try {
      const response = await apiRequest("/api/gemini/extract-info", {
        method: "POST",
        body: {
          text: message,
          context,
          professionLevel: this.config.professionLevel
        }
      });
      return response as MessageAnalysis;
    } catch (error) {
      console.error("Error analyzing message with Gemini:", error);
      throw error;
    }
  }

  /**
   * Categoriza un chat basado en sus mensajes
   */
  async categorizeChat(chatId: string, messageCount: number = 10) {
    try {
      const response = await apiRequest("/api/gemini/generate-tags", {
        method: "POST",
        body: {
          chatId,
          messageCount,
          professionLevel: this.config.professionLevel
        }
      });
      return response as ChatCategory[];
    } catch (error) {
      console.error("Error categorizing chat with Gemini:", error);
      throw error;
    }
  }

  /**
   * Sugiere la próxima acción recomendada para un chat o lead
   */
  async suggestAction(chatId: string, leadId?: number) {
    try {
      const response = await apiRequest("/api/gemini/suggest-action", {
        method: "POST",
        body: {
          chatId,
          leadId,
          professionLevel: this.config.professionLevel
        }
      });
      return response;
    } catch (error) {
      console.error("Error getting action suggestion with Gemini:", error);
      throw error;
    }
  }
}

// Export a singleton instance of the client
export const geminiClient = new GeminiClient();
