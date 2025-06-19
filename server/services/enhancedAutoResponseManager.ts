/**
 * Enhanced Auto Response Manager with Natural Conversation Flow
 * Integrates the conversation flow system with WhatsApp auto responses
 */

import { conversationFlowManager } from './conversationFlowManager';

interface AutoResponseMessage {
  id: string;
  from: string;
  body: string;
  timestamp: number;
  isFromMe: boolean;
  accountId?: number;
}

interface ConversationResponse {
  response: string;
  phase: 'greeting' | 'development' | 'farewell' | 'completed';
  confidence: number;
  shouldContinue: boolean;
}

class EnhancedAutoResponseManager {
  private responseCache = new Map<string, string>();
  private lastProcessedMessage = new Map<string, number>();

  /**
   * Handle incoming WhatsApp message with natural conversation flow
   */
  async handleIncomingMessage(message: AutoResponseMessage): Promise<void> {
    try {
      console.log('🤖 Procesando mensaje para respuesta conversacional:', message.body);
      
      // Skip messages from ourselves
      if (message.isFromMe) {
        console.log('⏭️ Ignorando mensaje enviado por nosotros');
        return;
      }

      // Avoid processing duplicate messages
      const messageKey = `${message.from}-${message.timestamp}`;
      if (this.lastProcessedMessage.has(messageKey)) {
        console.log('⏭️ Mensaje ya procesado');
        return;
      }
      this.lastProcessedMessage.set(messageKey, Date.now());

      // Clean up old processed messages (keep last 100)
      if (this.lastProcessedMessage.size > 100) {
        const entries = Array.from(this.lastProcessedMessage.entries());
        const oldest = entries.sort((a, b) => a[1] - b[1]).slice(0, 50);
        oldest.forEach(([key]) => this.lastProcessedMessage.delete(key));
      }

      const accountId = message.accountId || 1;
      
      // Check if auto responses are enabled for this account
      if (!(await this.isAutoResponseEnabled(accountId))) {
        console.log(`⏸️ Respuestas automáticas deshabilitadas para cuenta ${accountId}`);
        return;
      }

      // Process with conversation flow manager
      const conversationResult = await conversationFlowManager.processMessage(
        message.from,
        message.body,
        accountId
      );

      if (conversationResult.response && conversationResult.confidence > 60) {
        console.log(`✅ Respuesta conversacional generada (${conversationResult.phase}): "${conversationResult.response.substring(0, 50)}..."`);
        console.log(`🎯 Confianza: ${conversationResult.confidence}%`);
        
        // Send response (simulated for now)
        await this.sendResponse(message.from, conversationResult.response, accountId);
        
        // Save to database
        await this.saveConversationToDatabase(message, conversationResult.response, accountId);
      } else {
        console.log(`⚠️ Respuesta con baja confianza (${conversationResult.confidence}%), no enviada`);
      }
      
    } catch (error) {
      console.error('❌ Error procesando mensaje conversacional:', error);
    }
  }

  /**
   * Check if auto responses are enabled for account
   */
  private async isAutoResponseEnabled(accountId: number): Promise<boolean> {
    try {
      const { storage } = await import('../storage');
      const accounts = await storage.getWhatsAppAccounts();
      const account = accounts.find(acc => acc.id === accountId);
      return account?.autoResponseEnabled || false;
    } catch (error) {
      console.error('Error checking auto response status:', error);
      return false;
    }
  }

  /**
   * Send WhatsApp response (simulated)
   */
  private async sendResponse(toNumber: string, message: string, accountId: number): Promise<void> {
    try {
      console.log(`📱 [Simulado] Enviando respuesta a ${toNumber} desde cuenta ${accountId}: "${message}"`);
      
      // Real WhatsApp integration would go here
      // This is where you'd connect to WhatsApp Web API or Business API
      
    } catch (error) {
      console.error('❌ Error enviando respuesta WhatsApp:', error);
    }
  }

  /**
   * Save conversation to database
   */
  private async saveConversationToDatabase(
    incomingMessage: AutoResponseMessage, 
    botResponse: string, 
    accountId: number
  ): Promise<void> {
    try {
      // Create or find associated lead
      const leadId = await this.findOrCreateLead(incomingMessage.from, accountId);
      
      const { storage } = await import('../storage');
      
      // Save incoming message
      await storage.createMessage({
        leadId,
        content: incomingMessage.body,
        direction: "incoming",
        channel: "whatsapp",
        read: false
      });

      // Save bot response
      await storage.createMessage({
        leadId,
        content: botResponse,
        direction: "outgoing", 
        channel: "whatsapp",
        read: true
      });

      console.log(`💾 Conversación guardada en base de datos para lead ${leadId}`);
    } catch (error) {
      console.error('Error guardando conversación:', error);
    }
  }

  /**
   * Find or create lead for phone number
   */
  private async findOrCreateLead(phoneNumber: string, accountId: number): Promise<number> {
    try {
      const { storage } = await import('../storage');
      
      // Search for existing lead
      const leads = await storage.getLeads();
      const existingLead = leads.find(lead => lead.phone === phoneNumber);
      
      if (existingLead) {
        return existingLead.id;
      }

      // Create new lead
      const newLead = await storage.createLead({
        name: `Contacto WhatsApp ${phoneNumber.slice(-4)}`,
        email: `${phoneNumber}@whatsapp.contact`,
        phone: phoneNumber,
        company: '',
        position: '',
        status: 'new',
        whatsappAccountId: accountId,
        source: 'whatsapp',
        notes: 'Lead creado automáticamente desde conversación WhatsApp',
        lastInteractionDate: new Date(),
        value: 0
      });

      return newLead.id;
    } catch (error) {
      console.error('Error creando lead:', error);
      return 1; // Fallback to default lead
    }
  }

  /**
   * Test conversation flow with sample messages
   */
  async testConversationFlow(): Promise<void> {
    console.log('🧪 Probando flujo de conversación...\n');
    
    const testMessages = [
      'Hola, buenos días',
      'Necesito información sobre sus productos',
      '¿Qué precios manejan?',
      'Me interesa hacer una compra',
      'Gracias por la información',
      'Hasta luego'
    ];

    const chatId = `test-${Date.now()}`;
    
    for (let i = 0; i < testMessages.length; i++) {
      const message = testMessages[i];
      
      try {
        const result = await conversationFlowManager.processMessage(
          chatId,
          message,
          1
        );
        
        console.log(`👤 Usuario: ${message}`);
        console.log(`🤖 Bot (${result.phase}): ${result.response}`);
        console.log(`📊 Confianza: ${result.confidence}%\n`);
        
        // Brief pause between messages
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error procesando "${message}":`, error);
      }
    }
    
    console.log('✅ Prueba de flujo conversacional completada');
  }

  /**
   * Get conversation statistics
   */
  getStats(): {
    activeConversations: number;
    cacheSize: number;
    recentMessages: number;
  } {
    const stats = conversationFlowManager.getConversationStats();
    
    return {
      activeConversations: stats.activeConversations,
      cacheSize: this.responseCache.size,
      recentMessages: this.lastProcessedMessage.size
    };
  }
}

export const enhancedAutoResponseManager = new EnhancedAutoResponseManager();
export { EnhancedAutoResponseManager };