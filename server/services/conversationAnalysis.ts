/**
 * Intelligent Conversation Analysis Service
 * Analyzes conversations every 5 seconds using AI to extract insights and update contact information
 */

import OpenAI from 'openai';
import { db } from '../db';
import { whatsappMessages, whatsappContacts } from '@shared/schema';
import { eq, desc, and, gt } from 'drizzle-orm';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY
});

interface ConversationInsight {
  contactInfo?: {
    name?: string;
    interests?: string[];
    location?: string;
    age?: number;
    profession?: string;
    preferences?: string[];
  };
  sentiment: 'positive' | 'negative' | 'neutral';
  intent: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  topics: string[];
  actionItems?: string[];
  followUpSuggestions?: string[];
}

class ConversationAnalysisService {
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;
  private lastProcessedMessageId = new Map<string, string>();

  /**
   * Starts the conversation analysis service
   */
  start(): void {
    if (this.isRunning) return;

    console.log('🧠 Iniciando servicio de análisis de conversaciones cada 5 segundos...');
    this.isRunning = true;

    this.intervalId = setInterval(async () => {
      await this.analyzeRecentConversations();
    }, 5000); // Every 5 seconds

    console.log('✅ Servicio de análisis de conversaciones iniciado');
  }

  /**
   * Stops the conversation analysis service
   */
  stop(): void {
    if (!this.isRunning) return;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    this.isRunning = false;
    console.log('🛑 Servicio de análisis de conversaciones detenido');
  }

  /**
   * Analyzes recent conversations for all active WhatsApp accounts
   */
  private async analyzeRecentConversations(): Promise<void> {
    try {
      // Get all active WhatsApp accounts
      const { whatsappAccounts } = await import('@shared/schema');
      const activeAccounts = await db.select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.status, 'connected'));

      for (const account of activeAccounts) {
        await this.analyzeAccountConversations(account.id);
      }
    } catch (error) {
      console.error('❌ Error analizando conversaciones:', error);
    }
  }

  /**
   * Analyzes conversations for a specific WhatsApp account
   */
  private async analyzeAccountConversations(accountId: number): Promise<void> {
    try {
      const lastProcessedId = this.lastProcessedMessageId.get(`account_${accountId}`) || '0';

      // Get new messages since last processing
      const newMessages = await db.select()
        .from(whatsappMessages)
        .where(and(
          eq(whatsappMessages.whatsappAccountId, accountId),
          gt(whatsappMessages.id, parseInt(lastProcessedId))
        ))
        .orderBy(desc(whatsappMessages.timestamp))
        .limit(50);

      if (newMessages.length === 0) return;

      // Group messages by chat/contact
      const messagesByChat = new Map<string, typeof newMessages>();
      
      for (const message of newMessages) {
        const chatId = message.chatId;
        if (!messagesByChat.has(chatId)) {
          messagesByChat.set(chatId, []);
        }
        messagesByChat.get(chatId)!.push(message);
      }

      // Analyze each conversation
      for (const [chatId, messages] of messagesByChat) {
        await this.analyzeConversation(accountId, chatId, messages);
      }

      // Update last processed message ID
      if (newMessages.length > 0) {
        this.lastProcessedMessageId.set(`account_${accountId}`, newMessages[0].id.toString());
      }

    } catch (error) {
      console.error(`❌ Error analizando conversaciones de cuenta ${accountId}:`, error);
    }
  }

  /**
   * Analyzes a single conversation and updates contact information
   */
  private async analyzeConversation(
    accountId: number, 
    chatId: string, 
    messages: any[]
  ): Promise<void> {
    try {
      if (messages.length === 0) return;

      // Get conversation context (last 20 messages)
      const allMessages = await db.select()
        .from(whatsappMessages)
        .where(and(
          eq(whatsappMessages.whatsappAccountId, accountId),
          eq(whatsappMessages.chatId, chatId)
        ))
        .orderBy(desc(whatsappMessages.timestamp))
        .limit(20);

      const conversationText = allMessages
        .reverse()
        .map(msg => `${msg.isFromMe ? 'Agente' : 'Cliente'}: ${msg.body}`)
        .join('\n');

      if (!conversationText.trim()) return;

      // Analyze with AI
      const insights = await this.analyzeWithAI(conversationText);
      
      if (insights) {
        await this.updateContactInformation(accountId, chatId, insights);
        await this.logConversationInsights(accountId, chatId, insights);
      }

    } catch (error) {
      console.error(`❌ Error analizando conversación ${chatId}:`, error);
    }
  }

  /**
   * Uses OpenAI to analyze conversation and extract insights
   */
  private async analyzeWithAI(conversationText: string): Promise<ConversationInsight | null> {
    try {
      const prompt = `Analiza la siguiente conversación de WhatsApp y extrae información relevante del cliente.

Conversación:
${conversationText}

Responde en formato JSON con la siguiente estructura:
{
  "contactInfo": {
    "name": "nombre si se menciona",
    "interests": ["lista de intereses mencionados"],
    "location": "ubicación si se menciona",
    "age": número_si_se_menciona,
    "profession": "profesión si se menciona",
    "preferences": ["preferencias del cliente"]
  },
  "sentiment": "positive/negative/neutral",
  "intent": "intención principal del cliente",
  "priority": "low/medium/high/urgent",
  "topics": ["temas principales discutidos"],
  "actionItems": ["acciones requeridas"],
  "followUpSuggestions": ["sugerencias de seguimiento"]
}

Importante: Solo incluye información que esté explícitamente mencionada. Si no hay información específica, omite esos campos.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Eres un analista experto en conversaciones de atención al cliente. Extrae información valiosa y relevante de las conversaciones."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.3
      });

      const aiResponse = response.choices[0]?.message?.content;
      if (!aiResponse) return null;

      // Parse JSON response
      const insights = JSON.parse(aiResponse) as ConversationInsight;
      console.log(`🧠 Análisis completado para conversación: ${insights.intent} (${insights.sentiment})`);
      
      return insights;

    } catch (error) {
      console.error('❌ Error en análisis AI:', error);
      return null;
    }
  }

  /**
   * Updates contact information based on AI insights
   */
  private async updateContactInformation(
    accountId: number,
    chatId: string,
    insights: ConversationInsight
  ): Promise<void> {
    try {
      if (!insights.contactInfo) return;

      // Check if contact exists
      const existingContact = await db.select()
        .from(whatsappContacts)
        .where(and(
          eq(whatsappContacts.whatsappAccountId, accountId),
          eq(whatsappContacts.chatId, chatId)
        ))
        .limit(1);

      const contactInfo = insights.contactInfo;
      const updateData: any = {};

      // Prepare update data
      if (contactInfo.name) updateData.name = contactInfo.name;
      if (contactInfo.interests?.length) updateData.interests = JSON.stringify(contactInfo.interests);
      if (contactInfo.location) updateData.location = contactInfo.location;
      if (contactInfo.age) updateData.age = contactInfo.age;
      if (contactInfo.profession) updateData.profession = contactInfo.profession;
      if (contactInfo.preferences?.length) updateData.preferences = JSON.stringify(contactInfo.preferences);

      // Add conversation insights
      updateData.lastAnalysis = new Date();
      updateData.sentiment = insights.sentiment;
      updateData.priority = insights.priority;
      updateData.topics = JSON.stringify(insights.topics);

      if (existingContact.length > 0) {
        // Update existing contact
        await db.update(whatsappContacts)
          .set(updateData)
          .where(eq(whatsappContacts.id, existingContact[0].id));
        
        console.log(`📝 Información de contacto actualizada para ${chatId}`);
      } else {
        // Create new contact record
        await db.insert(whatsappContacts).values({
          whatsappAccountId: accountId,
          chatId,
          phoneNumber: chatId.split('@')[0],
          ...updateData
        });
        
        console.log(`📝 Nuevo contacto creado para ${chatId}`);
      }

    } catch (error) {
      console.error('❌ Error actualizando información de contacto:', error);
    }
  }

  /**
   * Logs conversation insights for future reference
   */
  private async logConversationInsights(
    accountId: number,
    chatId: string,
    insights: ConversationInsight
  ): Promise<void> {
    try {
      // Log to conversation analysis table (create if needed)
      const logData = {
        whatsapp_account_id: accountId,
        chat_id: chatId,
        sentiment: insights.sentiment,
        intent: insights.intent,
        priority: insights.priority,
        topics: JSON.stringify(insights.topics),
        action_items: JSON.stringify(insights.actionItems || []),
        follow_up_suggestions: JSON.stringify(insights.followUpSuggestions || []),
        analyzed_at: new Date()
      };

      // For now, log to console (could be stored in database table)
      console.log(`📊 Insight registrado para ${chatId}:`, {
        intent: insights.intent,
        sentiment: insights.sentiment,
        priority: insights.priority,
        topics: insights.topics?.slice(0, 3)
      });

    } catch (error) {
      console.error('❌ Error registrando insights:', error);
    }
  }

  /**
   * Gets analysis status
   */
  getStatus(): { running: boolean; accountsMonitored: number; lastProcessed: string[] } {
    return {
      running: this.isRunning,
      accountsMonitored: this.lastProcessedMessageId.size,
      lastProcessed: Array.from(this.lastProcessedMessageId.keys())
    };
  }
}

// Create singleton instance
export const conversationAnalysisService = new ConversationAnalysisService();

// Auto-start the service
conversationAnalysisService.start();

export default conversationAnalysisService;