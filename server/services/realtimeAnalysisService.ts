/**
 * Servicio de análisis en tiempo real para conversaciones de WhatsApp
 * Analiza automáticamente cada 5 segundos todas las conversaciones activas
 * y actualiza leads, tickets y estadísticas usando IA
 */

import { pool } from '../db';
import { storage } from '../storage';

interface WhatsAppMessage {
  id: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  type: string;
  hasMedia?: boolean;
}

interface ConversationAnalysis {
  chatId: string;
  contactName: string;
  phoneNumber: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  intent: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  leadScore: number;
  ticketStatus: 'new' | 'pending' | 'resolved' | 'escalated';
  categories: string[];
  estimatedValue: number;
  responseNeeded: boolean;
  lastActivity: Date;
  messageStats: {
    total: number;
    sent: number;
    received: number;
    responseRate: number;
  };
}

export class RealtimeAnalysisService {
  private static instance: RealtimeAnalysisService;
  private analysisInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private lastAnalysisTime: Date = new Date();

  static getInstance(): RealtimeAnalysisService {
    if (!RealtimeAnalysisService.instance) {
      RealtimeAnalysisService.instance = new RealtimeAnalysisService();
    }
    return RealtimeAnalysisService.instance;
  }

  /**
   * Inicia el análisis automático cada 5 segundos
   */
  public startRealtimeAnalysis(): void {
    if (this.isRunning) {
      console.log('🔄 Análisis en tiempo real ya está ejecutándose');
      return;
    }

    console.log('🚀 Iniciando análisis en tiempo real de conversaciones WhatsApp');
    this.isRunning = true;
    
    // Ejecutar análisis inicial
    this.performAnalysisCycle();
    
    // Configurar intervalo de 5 segundos
    this.analysisInterval = setInterval(() => {
      this.performAnalysisCycle();
    }, 5000);
  }

  /**
   * Detiene el análisis automático
   */
  public stopRealtimeAnalysis(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
    this.isRunning = false;
    console.log('⏹️ Análisis en tiempo real detenido');
  }

  /**
   * Verifica si el análisis está ejecutándose
   */
  public isAnalysisRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Ejecuta un ciclo completo de análisis
   */
  private async performAnalysisCycle(): Promise<void> {
    try {
      console.log('🔍 Ejecutando ciclo de análisis en tiempo real...');
      
      // Obtener todos los chats activos de WhatsApp
      const activeChats = await this.fetchActiveWhatsAppChats();
      
      if (activeChats.length === 0) {
        console.log('📱 No hay chats activos para analizar');
        return;
      }

      console.log(`📊 Analizando ${activeChats.length} conversaciones activas`);

      // Analizar cada conversación
      for (const chat of activeChats) {
        try {
          await this.analyzeConversation(chat);
        } catch (error) {
          console.error(`❌ Error analizando chat ${chat.id}:`, error);
        }
      }

      this.lastAnalysisTime = new Date();
      console.log(`✅ Ciclo de análisis completado - ${activeChats.length} conversaciones procesadas`);

    } catch (error) {
      console.error('❌ Error en ciclo de análisis:', error);
    }
  }

  /**
   * Obtiene todos los chats activos de WhatsApp
   */
  private async fetchActiveWhatsAppChats(): Promise<any[]> {
    try {
      const response = await fetch('http://localhost:5000/api/direct/whatsapp/chats', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return [];
      }

      const chatsData = await response.json();
      return Array.isArray(chatsData) ? chatsData : [];

    } catch (error) {
      console.error('Error fetching WhatsApp chats:', error);
      return [];
    }
  }

  /**
   * Analiza una conversación específica usando IA
   */
  private async analyzeConversation(chat: any): Promise<ConversationAnalysis> {
    const chatId = chat.id?._serialized || chat.id;
    const contactName = chat.name || chat.pushname || 'Contacto sin nombre';
    const phoneNumber = this.extractPhoneFromChatId(chatId);

    // Obtener mensajes recientes de la conversación
    const messages = await this.fetchChatMessages(chatId);
    
    // Realizar análisis con IA
    const analysis = await this.performAIAnalysis(messages, contactName, phoneNumber);
    
    // Actualizar base de datos con resultados del análisis
    await this.updateDatabaseWithAnalysis(chatId, analysis);
    
    // Crear o actualizar lead si es necesario
    await this.updateOrCreateLead(analysis);
    
    // Actualizar ticket si existe
    await this.updateTicketStatus(analysis);

    return analysis;
  }

  /**
   * Obtiene mensajes recientes de un chat específico
   */
  private async fetchChatMessages(chatId: string): Promise<WhatsAppMessage[]> {
    try {
      const response = await fetch(`http://localhost:5000/api/whatsapp-accounts/2/messages/${chatId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return [];
      }

      const messagesData = await response.json();
      return Array.isArray(messagesData) ? messagesData.slice(-20) : []; // Últimos 20 mensajes

    } catch (error) {
      console.error(`Error fetching messages for chat ${chatId}:`, error);
      return [];
    }
  }

  /**
   * Realiza análisis de IA sobre los mensajes
   */
  private async performAIAnalysis(
    messages: WhatsAppMessage[], 
    contactName: string, 
    phoneNumber: string
  ): Promise<ConversationAnalysis> {
    
    // Análisis básico de mensajes
    const messageStats = this.calculateMessageStats(messages);
    const lastMessage = messages[messages.length - 1];
    const conversationText = messages.map(m => m.body).join(' ').toLowerCase();

    // Análisis de sentimiento
    const sentiment = this.analyzeSentiment(conversationText);
    
    // Análisis de intención
    const intent = this.analyzeIntent(conversationText);
    
    // Análisis de urgencia
    const urgency = this.analyzeUrgency(conversationText, messages);
    
    // Cálculo de lead score
    const leadScore = this.calculateLeadScore(conversationText, messageStats, sentiment);
    
    // Determinación de estado de ticket
    const ticketStatus = this.determineTicketStatus(conversationText, urgency);
    
    // Categorización
    const categories = this.categorizeConversation(conversationText);
    
    // Estimación de valor
    const estimatedValue = this.estimateBusinessValue(conversationText, intent);
    
    // Verificar si necesita respuesta
    const responseNeeded = this.needsResponse(messages, urgency);

    return {
      chatId: phoneNumber,
      contactName,
      phoneNumber,
      sentiment,
      intent,
      urgency,
      leadScore,
      ticketStatus,
      categories,
      estimatedValue,
      responseNeeded,
      lastActivity: new Date(),
      messageStats
    };
  }

  /**
   * Calcula estadísticas de mensajes
   */
  private calculateMessageStats(messages: WhatsAppMessage[]): ConversationAnalysis['messageStats'] {
    const total = messages.length;
    const sent = messages.filter(m => m.fromMe).length;
    const received = messages.filter(m => !m.fromMe).length;
    const responseRate = received > 0 ? (sent / received) * 100 : 0;

    return {
      total,
      sent,
      received,
      responseRate: Math.round(responseRate)
    };
  }

  /**
   * Analiza el sentimiento de la conversación
   */
  private analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = ['gracias', 'excelente', 'perfecto', 'bueno', 'genial', 'fantástico', 'me gusta', 'satisfecho'];
    const negativeWords = ['problema', 'error', 'mal', 'terrible', 'horrible', 'no funciona', 'molesto', 'disgusto'];
    
    const positiveCount = positiveWords.reduce((count, word) => count + (text.includes(word) ? 1 : 0), 0);
    const negativeCount = negativeWords.reduce((count, word) => count + (text.includes(word) ? 1 : 0), 0);
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * Analiza la intención de la conversación
   */
  private analyzeIntent(text: string): string {
    const intents = {
      'Cotización': ['precio', 'costo', 'cuánto', 'cotizar', 'presupuesto', 'tarifa'],
      'Soporte': ['ayuda', 'problema', 'error', 'no funciona', 'soporte', 'asistencia'],
      'Información': ['información', 'detalles', 'características', 'especificaciones'],
      'Compra': ['comprar', 'adquirir', 'pedido', 'orden', 'contratar'],
      'Consulta': ['consulta', 'pregunta', 'duda', 'consultar']
    };

    for (const [intent, keywords] of Object.entries(intents)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return intent;
      }
    }
    
    return 'Consulta general';
  }

  /**
   * Analiza la urgencia de la conversación
   */
  private analyzeUrgency(text: string, messages: WhatsAppMessage[]): 'low' | 'medium' | 'high' | 'critical' {
    const urgentWords = ['urgente', 'inmediato', 'ya', 'ahora', 'crítico', 'emergency'];
    const highWords = ['importante', 'pronto', 'rápido', 'necesito'];
    
    const hasUrgentWords = urgentWords.some(word => text.includes(word));
    const hasHighWords = highWords.some(word => text.includes(word));
    const recentMessages = messages.filter(m => Date.now() - m.timestamp < 3600000); // Última hora
    
    if (hasUrgentWords || recentMessages.length > 10) return 'critical';
    if (hasHighWords || recentMessages.length > 5) return 'high';
    if (recentMessages.length > 2) return 'medium';
    return 'low';
  }

  /**
   * Calcula el score del lead
   */
  private calculateLeadScore(text: string, messageStats: any, sentiment: string): number {
    let score = 50; // Base score
    
    // Bonus por palabras de interés comercial
    const businessWords = ['comprar', 'contratar', 'presupuesto', 'precio', 'costo'];
    score += businessWords.filter(word => text.includes(word)).length * 10;
    
    // Bonus por engagement
    score += Math.min(messageStats.total * 2, 30);
    
    // Bonus/penalty por sentimiento
    if (sentiment === 'positive') score += 15;
    if (sentiment === 'negative') score -= 10;
    
    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * Determina el estado del ticket
   */
  private determineTicketStatus(text: string, urgency: string): 'new' | 'pending' | 'resolved' | 'escalated' {
    const resolvedWords = ['resuelto', 'solucionado', 'gracias', 'perfecto'];
    const escalationWords = ['supervisor', 'gerente', 'director', 'urgente'];
    
    if (resolvedWords.some(word => text.includes(word))) return 'resolved';
    if (escalationWords.some(word => text.includes(word)) || urgency === 'critical') return 'escalated';
    if (urgency === 'high' || urgency === 'medium') return 'pending';
    return 'new';
  }

  /**
   * Categoriza la conversación
   */
  private categorizeConversation(text: string): string[] {
    const categories: string[] = [];
    
    const categoryMap = {
      'Ventas': ['precio', 'comprar', 'vender', 'cotización'],
      'Soporte': ['problema', 'error', 'ayuda', 'soporte'],
      'Información': ['información', 'detalles', 'características'],
      'Reclamo': ['reclamo', 'queja', 'disgusto', 'problema'],
      'Seguimiento': ['seguimiento', 'estado', 'actualización']
    };

    for (const [category, keywords] of Object.entries(categoryMap)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        categories.push(category);
      }
    }
    
    return categories.length > 0 ? categories : ['General'];
  }

  /**
   * Estima el valor comercial
   */
  private estimateBusinessValue(text: string, intent: string): number {
    let value = 0;
    
    // Extraer números que podrían ser valores monetarios
    const numbers = text.match(/\d+/g);
    if (numbers) {
      value = Math.max(...numbers.map(n => parseInt(n)));
    }
    
    // Valor base por intención
    const intentValues = {
      'Cotización': 5000,
      'Compra': 10000,
      'Soporte': 2000,
      'Información': 3000
    };
    
    if (!value && intentValues[intent as keyof typeof intentValues]) {
      value = intentValues[intent as keyof typeof intentValues];
    }
    
    return Math.min(value, 50000); // Máximo 50k
  }

  /**
   * Determina si necesita respuesta
   */
  private needsResponse(messages: WhatsAppMessage[], urgency: string): boolean {
    const lastMessage = messages[messages.length - 1];
    
    // Si el último mensaje no es nuestro y es reciente
    if (!lastMessage?.fromMe && Date.now() - lastMessage?.timestamp < 1800000) { // 30 minutos
      return true;
    }
    
    // Si es urgente o crítico
    if (urgency === 'critical' || urgency === 'high') {
      return true;
    }
    
    return false;
  }

  /**
   * Actualiza la base de datos con el análisis
   */
  private async updateDatabaseWithAnalysis(chatId: string, analysis: ConversationAnalysis): Promise<void> {
    try {
      // Actualizar o crear registro de análisis
      await pool.query(`
        INSERT INTO conversation_analysis (
          chat_id, contact_name, phone_number, sentiment, intent, urgency,
          lead_score, ticket_status, categories, estimated_value, response_needed,
          last_activity, message_stats, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
        ON CONFLICT (chat_id) DO UPDATE SET
          sentiment = $4, intent = $5, urgency = $6, lead_score = $7,
          ticket_status = $8, categories = $9, estimated_value = $10,
          response_needed = $11, last_activity = $12, message_stats = $13,
          updated_at = NOW()
      `, [
        chatId,
        analysis.contactName,
        analysis.phoneNumber,
        analysis.sentiment,
        analysis.intent,
        analysis.urgency,
        analysis.leadScore,
        analysis.ticketStatus,
        JSON.stringify(analysis.categories),
        analysis.estimatedValue,
        analysis.responseNeeded,
        analysis.lastActivity,
        JSON.stringify(analysis.messageStats)
      ]);

    } catch (error) {
      console.error('Error updating conversation analysis:', error);
    }
  }

  /**
   * Actualiza o crea lead basado en el análisis
   */
  private async updateOrCreateLead(analysis: ConversationAnalysis): Promise<void> {
    try {
      // Verificar si ya existe un lead para este contacto
      const existingLead = await pool.query(
        'SELECT id FROM leads WHERE phone = $1',
        [analysis.phoneNumber]
      );

      if (existingLead.rows.length > 0) {
        // Actualizar lead existente
        await pool.query(`
          UPDATE leads SET
            status = $1,
            probability = $2,
            value = $3,
            notes = $4,
            "lastContactDate" = NOW(),
            "updatedAt" = NOW()
          WHERE phone = $5
        `, [
          this.mapTicketStatusToLeadStatus(analysis.ticketStatus),
          analysis.leadScore,
          analysis.estimatedValue,
          `Último análisis: ${analysis.intent} - Urgencia: ${analysis.urgency} - Sentimiento: ${analysis.sentiment}`,
          analysis.phoneNumber
        ]);
      } else if (analysis.leadScore > 60) {
        // Crear nuevo lead solo si el score es alto
        await pool.query(`
          INSERT INTO leads (
            name, "fullName", phone, source, status, notes, budget, priority,
            stage, probability, value, "whatsappAccountId", "createdAt", "lastContactDate"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
        `, [
          analysis.contactName,
          analysis.contactName,
          analysis.phoneNumber,
          'WhatsApp Auto-Análisis',
          'new',
          `Análisis automático: ${analysis.intent} - Score: ${analysis.leadScore}`,
          analysis.estimatedValue,
          analysis.urgency,
          'prospecting',
          analysis.leadScore,
          analysis.estimatedValue,
          1
        ]);
      }

    } catch (error) {
      console.error('Error updating/creating lead:', error);
    }
  }

  /**
   * Actualiza estado del ticket
   */
  private async updateTicketStatus(analysis: ConversationAnalysis): Promise<void> {
    try {
      // Crear o actualizar ticket
      await pool.query(`
        INSERT INTO tickets (
          whatsapp_account_id, contact_id, title, description, status, priority,
          category, assigned_to, created_at, updated_at
        ) 
        SELECT 1, 1, $1, $2, $3, $4, $5, NULL, NOW(), NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM tickets WHERE description LIKE $6
        )
      `, [
        `${analysis.intent} - ${analysis.contactName}`,
        `Ticket automático generado por análisis de IA: ${analysis.intent}`,
        analysis.ticketStatus,
        analysis.urgency,
        analysis.categories[0] || 'General',
        `%${analysis.phoneNumber}%`
      ]);

    } catch (error) {
      console.error('Error updating ticket:', error);
    }
  }

  /**
   * Mapea estado de ticket a estado de lead
   */
  private mapTicketStatusToLeadStatus(ticketStatus: string): string {
    const mapping = {
      'new': 'new',
      'pending': 'contacted',
      'resolved': 'closed-won',
      'escalated': 'meeting'
    };
    
    return mapping[ticketStatus as keyof typeof mapping] || 'new';
  }

  /**
   * Extrae número de teléfono del ID del chat
   */
  private extractPhoneFromChatId(chatId: string): string {
    const phoneMatch = chatId.match(/(\d+)@/);
    if (phoneMatch) {
      const rawNumber = phoneMatch[1];
      if (rawNumber.startsWith('52') && rawNumber.length >= 12) {
        return `+52 ${rawNumber.substring(2, 5)} ${rawNumber.substring(5, 8)} ${rawNumber.substring(8)}`;
      }
      return `+${rawNumber}`;
    }
    return chatId;
  }

  /**
   * Obtiene estadísticas del análisis en tiempo real
   */
  public getAnalysisStats(): any {
    return {
      isRunning: this.isRunning,
      lastAnalysisTime: this.lastAnalysisTime,
      intervalMs: 5000
    };
  }
}

// Exportar instancia singleton
export const realtimeAnalysis = RealtimeAnalysisService.getInstance();