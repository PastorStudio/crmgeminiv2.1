import { db } from '../db';
import { tickets, contacts, whatsappMessages, whatsappAccounts } from '@shared/schema';
import { eq, and, desc, isNull, gt } from 'drizzle-orm';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface TicketData {
  chatId: string;
  contactId: number;
  whatsappAccountId: number;
  userId: number;
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  interestLevel: 'unknown' | 'low' | 'medium' | 'high' | 'very_high';
  estimatedValue: number;
  source: string;
  tags: string[];
  metadata: any;
}

class AutomaticTicketGenerationService {
  private geminiAI: GoogleGenerativeAI | null = null;
  private isProcessing = false;

  constructor() {
    this.initializeAI();
    this.startPeriodicProcessing();
  }

  private initializeAI() {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        this.geminiAI = new GoogleGenerativeAI(apiKey);
        console.log('🎫 Servicio de generación automática de tickets iniciado con Gemini AI');
      } else {
        console.log('⚠️ GEMINI_API_KEY no encontrada, funcionando sin AI');
      }
    } catch (error) {
      console.error('❌ Error inicializando Gemini AI para tickets:', error);
    }
  }

  private startPeriodicProcessing() {
    // Procesar cada 2 minutos para generar tickets automáticamente
    setInterval(async () => {
      if (!this.isProcessing) {
        await this.processNewConversations();
      }
    }, 120000); // 2 minutos

    // Ejecutar inmediatamente
    setTimeout(() => this.processNewConversations(), 5000);
  }

  private async processNewConversations() {
    try {
      this.isProcessing = true;
      console.log('🎫 Procesando conversaciones para generar tickets automáticamente...');

      // Obtener conversaciones activas sin tickets
      const conversations = await this.getConversationsWithoutTickets();
      console.log(`📋 Encontradas ${conversationsList.length} conversaciones candidatas para tickets`);

      for (const conversation of conversationsList) {
        try {
          const ticket = await this.analyzeAndCreateTicket(conversation);
          if (ticket) {
            console.log(`✅ Ticket creado automáticamente: ${ticket.title} (ID: ${ticket.id})`);
          }
        } catch (error) {
          console.error(`❌ Error creando ticket para chat ${conversation.chatId}:`, error);
        }
      }

    } catch (error) {
      console.error('❌ Error en procesamiento automático de tickets:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async getConversationsWithoutTickets() {
    try {
      // Obtener chats activos con mensajes recientes que no tienen tickets
      // Usar consulta más simple para evitar errores de groupBy
      const recentMessages = await db
        .select({
          chatId: whatsappMessages.chatId,
          contactId: whatsappMessages.contactId,
          whatsappAccountId: whatsappMessages.whatsappAccountId,
          userId: whatsappMessages.userId,
          lastMessage: whatsappMessages.body,
          createdAt: whatsappMessages.createdAt
        })
        .from(whatsappMessages)
        .where(
          gt(whatsappMessages.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))
        )
        .orderBy(desc(whatsappMessages.createdAt))
        .limit(50);

      // Verificar cuáles ya tienen tickets
      const chatsWithTickets = await db
        .select({ chatId: tickets.chatId })
        .from(tickets)
        .where(tickets.chatId !== null);

      const ticketChatIds = new Set(chatsWithTickets.map(t => t.chatId).filter(Boolean));

      // Filtrar chats únicos sin tickets
      const uniqueChats = new Map();
      recentMessages.forEach(message => {
        if (message.chatId && 
            !ticketChatIds.has(message.chatId) && 
            !uniqueChats.has(message.chatId)) {
          uniqueChats.set(message.chatId, {
            chatId: message.chatId,
            contactId: message.contactId,
            whatsappAccountId: message.whatsappAccountId,
            userId: message.userId,
            lastMessage: message.lastMessage,
            contactName: null, // Se obtendrá después si es necesario
            contactPhone: null
          });
        }
      });

      return Array.from(uniqueChats.values()).slice(0, 10); // Limitar a 10 para evitar sobrecarga
    } catch (error) {
      console.error('❌ Error obteniendo conversaciones:', error);
      return [];
    }
  }

  private async analyzeAndCreateTicket(conversation: any): Promise<any | null> {
    try {
      // Obtener mensajes de la conversación
      const messages = await db
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.chatId, conversation.chatId))
        .orderBy(desc(whatsappMessages.createdAt))
        .limit(10);

      if (messages.length === 0) {
        return null;
      }

      // Analizar conversación con AI
      const analysis = await this.analyzeConversationWithAI(messages, conversation);
      
      // Crear ticket basado en el análisis
      const ticketData: TicketData = {
        chatId: conversation.chatId,
        contactId: conversation.contactId || 1,
        whatsappAccountId: conversation.whatsappAccountId || 1,
        userId: conversation.userId || 1,
        title: analysis.title || `Consulta de ${conversation.contactName || 'Cliente'}`,
        description: analysis.description || `Conversación iniciada desde WhatsApp con ${messages.length} mensajes`,
        category: analysis.category || 'consultation',
        priority: analysis.priority || 'medium',
        interestLevel: analysis.interestLevel || 'medium',
        estimatedValue: analysis.estimatedValue || 0,
        source: 'whatsapp_auto',
        tags: analysis.tags || ['automático', 'whatsapp'],
        metadata: {
          messageCount: messages.length,
          autoGenerated: true,
          analysisDate: new Date().toISOString(),
          firstMessage: messages[messages.length - 1]?.body || '',
          lastMessage: messages[0]?.body || ''
        }
      };

      // Crear el ticket en la base de datos
      const [newTicket] = await db
        .insert(tickets)
        .values({
          ...ticketData,
          status: 'open',
          uuid: `auto-ticket-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      return newTicket;

    } catch (error) {
      console.error('❌ Error analizando conversación:', error);
      return null;
    }
  }

  private async analyzeConversationWithAI(messages: any[], conversation: any) {
    try {
      if (!this.geminiAI) {
        return this.getFallbackAnalysis(messages, conversation);
      }

      const model = this.geminiAI.getGenerativeModel({ model: 'gemini-pro' });

      const conversationText = messages
        .reverse()
        .map((msg, index) => `${index + 1}. ${msg.fromMe ? 'Agente' : 'Cliente'}: ${msg.body}`)
        .join('\n');

      const prompt = `
Analiza esta conversación de WhatsApp y genera un ticket de soporte automático:

CONVERSACIÓN:
${conversationText}

Genera el análisis en formato JSON con esta estructura:
{
  "title": "Título descriptivo del ticket (máximo 80 caracteres)",
  "description": "Descripción detallada del problema o consulta",
  "category": "consultation|sales_interest|support|complaint|information|follow_up|general",
  "priority": "low|medium|high|urgent",
  "interestLevel": "unknown|low|medium|high|very_high",
  "estimatedValue": número (0 si no hay valor comercial aparente),
  "tags": ["array", "de", "tags", "relevantes"],
  "reasoning": "Breve explicación del análisis"
}

CRITERIOS:
- Priority: urgent si hay quejas graves, high si hay problemas críticos, medium para consultas normales, low para información general
- InterestLevel: very_high si menciona compra inmediata, high si pregunta precios/servicios, medium si muestra interés, low si solo información
- EstimatedValue: Estima valor en pesos mexicanos si detectas intención de compra
- Tags: Incluye palabras clave de la conversación
- Category: Clasifica según el tipo principal de consulta

Responde SOLO con el JSON, sin texto adicional.
`;

      const result = await model.generateContent(prompt);
      const response = result.response.text();
      
      try {
        const analysis = JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
        console.log(`🤖 Análisis AI para ticket: ${analysis.title} - ${analysis.category}`);
        return analysis;
      } catch (parseError) {
        console.log('⚠️ Error parseando respuesta AI, usando análisis por defecto');
        return this.getFallbackAnalysis(messages, conversation);
      }

    } catch (error) {
      console.log('⚠️ Error en análisis AI, usando análisis por defecto');
      return this.getFallbackAnalysis(messages, conversation);
    }
  }

  private getFallbackAnalysis(messages: any[], conversation: any) {
    const messageText = messages.map(m => m.body.toLowerCase()).join(' ');
    
    // Análisis básico por palabras clave
    let category = 'consultation';
    let priority = 'medium';
    let interestLevel = 'medium';
    let estimatedValue = 0;
    let tags = ['automático', 'whatsapp'];

    // Detectar categoría
    if (messageText.includes('precio') || messageText.includes('costo') || messageText.includes('comprar')) {
      category = 'sales_interest';
      interestLevel = 'high';
      estimatedValue = 1000; // Valor estimado básico
      tags.push('ventas', 'precio');
    } else if (messageText.includes('problema') || messageText.includes('error') || messageText.includes('ayuda')) {
      category = 'support';
      tags.push('soporte', 'problema');
    } else if (messageText.includes('queja') || messageText.includes('malo') || messageText.includes('terrible')) {
      category = 'complaint';
      priority = 'high';
      tags.push('queja', 'urgente');
    } else if (messageText.includes('información') || messageText.includes('info')) {
      category = 'information';
      priority = 'low';
      interestLevel = 'low';
      tags.push('información');
    }

    // Detectar urgencia
    if (messageText.includes('urgente') || messageText.includes('ya') || messageText.includes('ahora')) {
      priority = 'high';
    }

    return {
      title: `${category === 'sales_interest' ? 'Interés de venta' : 'Consulta'} de ${conversation.contactName || 'Cliente'}`,
      description: `Conversación automática detectada con ${messages.length} mensajes. Último mensaje: "${messages[0]?.body?.substring(0, 100) || ''}..."`,
      category,
      priority,
      interestLevel,
      estimatedValue,
      tags,
      reasoning: 'Análisis automático basado en palabras clave'
    };
  }

  // Método público para procesar manualmente
  public async forceProcessNewConversations() {
    await this.processNewConversations();
  }

  // Método para crear ticket específico desde un chat
  public async createTicketFromChat(chatId: string, userId?: number) {
    try {
      const conversation = await db
        .select({
          chatId: whatsappMessages.chatId,
          contactId: whatsappMessages.contactId,
          whatsappAccountId: whatsappMessages.whatsappAccountId,
          userId: whatsappMessages.userId,
          contactName: contacts.name,
          contactPhone: contacts.phone
        })
        .from(whatsappMessages)
        .leftJoin(contacts, eq(whatsappMessages.contactId, contacts.id))
        .where(eq(whatsappMessages.chatId, chatId))
        .limit(1);

      if (conversation.length === 0) {
        throw new Error('Conversación no encontrada');
      }

      const ticket = await this.analyzeAndCreateTicket({
        ...conversation[0],
        userId: userId || conversation[0].userId
      });

      return ticket;
    } catch (error) {
      console.error('❌ Error creando ticket manual:', error);
      throw error;
    }
  }

  public getStatus() {
    return {
      isRunning: true,
      hasAI: !!this.geminiAI,
      isProcessing: this.isProcessing,
      lastProcessed: new Date().toISOString()
    };
  }
}

// Singleton instance
export const automaticTicketService = new AutomaticTicketGenerationService();
export default automaticTicketService;