import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { Lead, User, Message, Activity } from '@shared/schema';
import { apiKeyManager } from './apiKeyManager';

// Configurar el cliente de la API de Gemini usando nuestro gestor de claves
let genAI: GoogleGenerativeAI;

interface ChatHistory {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Service class for interacting with Google's Gemini API
 */
export class GeminiService {
  
  /**
   * Initialize the Gemini model with specified parameters
   * @param temperature Controls randomness (0.0 to 1.0)
   * @param maxOutputTokens Maximum tokens to generate in the response
   */
  async getModel(temperature = 0.7, maxOutputTokens = 1024) {
    // Obtenemos la clave API desde nuestro gestor
    const apiKey = apiKeyManager.getGeminiKey();
    
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }
    
    // Inicializar o actualizar el cliente con la clave más reciente
    genAI = new GoogleGenerativeAI(apiKey);
    
    // Mostrar advertencia si se está usando una clave temporal
    if (apiKeyManager.isUsingTemporaryKey()) {
      console.warn('⚠️ Usando una clave API temporal para Gemini. Esto es solo para desarrollo.');
    }
    
    const model = genAI.getGenerativeModel({
      model: 'gemini-pro',
      generationConfig: {
        temperature,
        maxOutputTokens,
        topP: 0.95,
        topK: 40,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    });
    
    return model;
  }

  /**
   * Analyze a lead to extract insights, determine lead score and provide recommendations
   * @param lead The lead to analyze
   */
  async analyzeLead(lead: Lead) {
    try {
      const model = await this.getModel(0.2); // Low temperature for more factual analysis
      
      const prompt = `
You are a CRM Assistant specializing in lead analysis. Analyze the following lead information and provide:
1. A lead score from 0-100 based on likelihood to convert
2. A match percentage indicating how well this lead matches our ideal customer profile
3. Enrichment insights and recommendations for follow-up

Lead Information:
- Name: ${lead.fullName}
- Email: ${lead.email}
- Company: ${lead.company || 'Unknown'}
- Position: ${lead.position || 'Unknown'}
- Source: ${lead.source || 'Unknown'}
- Status: ${lead.status || 'New'}
- Notes: ${lead.notes || 'None'}

Provide your response in valid JSON format with the following structure:
{
  "score": number,
  "matchPercentage": number,
  "enrichmentData": {
    "insights": string[],
    "recommendedActions": string[],
    "nextSteps": string,
    "potentialBudget": string,
    "decisionTimeframe": string
  }
}
`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      try {
        // Extract the JSON from the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : '{}';
        return JSON.parse(jsonString);
      } catch (error) {
        console.error("Error parsing JSON from Gemini response:", error);
        // Fallback to a structured response if JSON parsing fails
        return {
          score: 50,
          matchPercentage: 50,
          enrichmentData: {
            insights: ["Could not properly analyze the lead"],
            recommendedActions: ["Review lead information manually"],
            nextSteps: "Contact the lead to gather more information",
            potentialBudget: "Unknown",
            decisionTimeframe: "Unknown"
          }
        };
      }
    } catch (error) {
      console.error("Error calling Gemini API for lead analysis:", error);
      throw error;
    }
  }

  /**
   * Generate personalized message content based on lead information
   * @param lead The lead to generate a message for
   * @param messageType The type of message to generate (follow-up, proposal, etc.)
   * @param context Additional context for the message
   */
  async generateMessage(lead: Lead, messageType: string, context?: string) {
    try {
      const model = await this.getModel(0.7); // Medium temperature for balanced creativity
      
      const prompt = `
You are a CRM Assistant specializing in customer communication. Generate a personalized ${messageType} message for the following lead:

Lead Information:
- Name: ${lead.fullName}
- Email: ${lead.email}
- Company: ${lead.company || 'Unknown'}
- Position: ${lead.position || 'Unknown'}
- Status: ${lead.status || 'New'}
${context ? `\nAdditional Context:\n${context}` : ''}

Generate a professional and personalized message appropriate for a ${messageType}. The message should be specific to this lead and their company. Do not include placeholders like [Your Name].
`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      return { content: text };
    } catch (error) {
      console.error(`Error calling Gemini API for ${messageType} generation:`, error);
      throw error;
    }
  }

  /**
   * Chat with the Gemini AI assistant about CRM-related topics
   * @param message The user's message
   * @param history Previous chat history
   */
  async chat(message: string, history: ChatHistory[] = []) {
    try {
      const model = await this.getModel(0.7);
      const chat = model.startChat({
        history: history.map(msg => ({
          role: msg.role,
          parts: [{ text: msg.content }],
        })),
        generationConfig: {
          maxOutputTokens: 1024,
        },
      });
      
      const systemPrompt = `
You are a helpful CRM Assistant specializing in helping sales and marketing teams manage customer relationships. 
You can provide advice on:
- Lead management and qualification
- Sales strategies
- Customer engagement tactics
- Analyzing customer data
- Creating follow-up plans
- Drafting personalized messages

Always be professional, concise, and practical in your responses.
`;

      // Add system prompt if this is the first message
      if (history.length === 0) {
        await chat.sendMessage(systemPrompt);
      }
      
      const result = await chat.sendMessage(message);
      const response = result.response;
      
      return {
        role: "assistant" as const,
        content: response.text(),
      };
    } catch (error) {
      console.error("Error calling Gemini API for chat:", error);
      throw error;
    }
  }
  
  /**
   * Generate AI suggestions for the next best action based on lead data
   * @param lead The lead to analyze
   */
  async suggestNextAction(lead: Lead) {
    try {
      const model = await this.getModel(0.4);
      
      const prompt = `
You are a CRM Assistant specializing in sales strategy. Based on the following lead information, suggest the best next action to take:

Lead Information:
- Name: ${lead.fullName}
- Email: ${lead.email}
- Company: ${lead.company || 'Unknown'}
- Position: ${lead.position || 'Unknown'}
- Source: ${lead.source || 'Unknown'}
- Status: ${lead.status || 'New'}
- Last Contact: ${lead.lastContact ? new Date(lead.lastContact).toLocaleDateString() : 'Never'}
- Notes: ${lead.notes || 'None'}

Provide your response in valid JSON format with the following structure:
{
  "recommendedAction": string,
  "actionType": "call" | "email" | "meeting" | "task",
  "priority": "high" | "medium" | "low",
  "reasoning": string,
  "suggestedSchedule": string,
  "talkingPoints": string[]
}
`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      try {
        // Extract the JSON from the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : '{}';
        return JSON.parse(jsonString);
      } catch (error) {
        console.error("Error parsing JSON from Gemini response:", error);
        return {
          recommendedAction: "Follow up with the lead",
          actionType: "email",
          priority: "medium",
          reasoning: "Regular follow-up is important for lead nurturing",
          suggestedSchedule: "Within the next 3 business days",
          talkingPoints: ["Introduce your company's value proposition", "Ask about their current needs"]
        };
      }
    } catch (error) {
      console.error("Error calling Gemini API for next action suggestion:", error);
      throw error;
    }
  }
}

// Export a singleton instance
export const geminiService = new GeminiService();