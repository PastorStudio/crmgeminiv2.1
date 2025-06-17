/**
 * Servicio de conversión automática de chats a leads
 * Procesa conversaciones de WhatsApp y las convierte automáticamente en leads
 */

import { db } from '../db';
import { leads, whatsappAccounts } from '@shared/schema';
import { eq, and, isNull, desc, gt } from 'drizzle-orm';

interface ChatAnalysis {
  category: string;
  priority: 'low' | 'medium' | 'high';
  score: number;
  estimatedValue: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  shouldCreateLead: boolean;
  summary: string;
}

export class ChatToLeadConverter {
  private static instance: ChatToLeadConverter;
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  static getInstance(): ChatToLeadConverter {
    if (!ChatToLeadConverter.instance) {
      ChatToLeadConverter.instance = new ChatToLeadConverter();
    }
    return ChatToLeadConverter.instance;
  }

  /**
   * Inicia el servicio de conversión automática
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    console.log('🚀 Iniciando servicio de conversión automática chat-to-lead...');
    this.isRunning = true;

    // Procesar chats existentes una vez al inicio
    await this.processExistingChats();

    // Configurar procesamiento periódico cada 2 minutos
    this.intervalId = setInterval(async () => {
      await this.processNewChats();
    }, 120000); // 2 minutos

    console.log('✅ Servicio de conversión chat-to-lead iniciado correctamente');
  }

  /**
   * Detiene el servicio
   */
  stop(): void {
    if (!this.isRunning) return;

    console.log('🛑 Deteniendo servicio de conversión chat-to-lead...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    console.log('✅ Servicio de conversión chat-to-lead detenido');
  }

  /**
   * Procesa chats existentes sin leads asociados
   */
  private async processExistingChats(): Promise<void> {
    try {
      console.log('🔄 Procesando chats existentes para conversión a leads...');

      // Obtener todas las cuentas de WhatsApp activas
      const accounts = await db.select().from(whatsappAccounts);
      
      for (const account of accounts) {
        await this.processAccountChats(account.id);
      }

      console.log('✅ Procesamiento de chats existentes completado');
    } catch (error) {
      console.error('❌ Error procesando chats existentes:', error);
    }
  }

  /**
   * Procesa nuevos chats que necesitan ser convertidos a leads
   */
  private async processNewChats(): Promise<void> {
    try {
      console.log('🔄 Procesando nuevos chats para conversión automática...');

      const accounts = await db.select().from(whatsappAccounts);
      
      for (const account of accounts) {
        await this.processAccountChats(account.id, true);
      }

    } catch (error) {
      console.error('❌ Error procesando nuevos chats:', error);
    }
  }

  /**
   * Procesa los chats de una cuenta específica
   */
  private async processAccountChats(accountId: number, onlyRecent: boolean = false): Promise<void> {
    try {
      // Simular obtención de chats desde WhatsApp
      // En un entorno real, esto vendría de la API de WhatsApp
      const mockChats = await this.getMockWhatsAppChats(accountId);

      for (const chat of mockChats) {
        await this.processChatForLead(accountId, chat);
      }

    } catch (error) {
      console.error(`❌ Error procesando chats de cuenta ${accountId}:`, error);
    }
  }

  /**
   * Procesa un chat individual para determinar si debe convertirse en lead
   */
  private async processChatForLead(accountId: number, chat: any): Promise<void> {
    try {
      // Verificar si ya existe un lead para este contacto
      const existingLead = await db.select()
        .from(leads)
        .where(eq(leads.phone, chat.phone))
        .limit(1);

      if (existingLead.length > 0) {
        // Actualizar lead existente con nueva actividad
        await this.updateExistingLead(existingLead[0].id, chat);
        return;
      }

      // Analizar el chat para determinar si debe ser un lead
      const analysis = this.analyzeChat(chat);

      if (analysis.shouldCreateLead) {
        await this.createLeadFromChat(accountId, chat, analysis);
        console.log(`✅ Lead creado automáticamente para ${chat.name} (${chat.phone})`);
      }

    } catch (error) {
      console.error(`❌ Error procesando chat ${chat.chatId}:`, error);
    }
  }

  /**
   * Analiza un chat para determinar si debe convertirse en lead
   */
  private analyzeChat(chat: any): ChatAnalysis {
    const messages = chat.messages || [];
    const messageCount = messages.length;
    const conversationText = messages.map((msg: any) => msg.body || '').join(' ').toLowerCase();

    // Palabras clave para diferentes categorías
    const keywords = {
      ventas: ['comprar', 'precio', 'costo', 'vender', 'presupuesto', 'cotización', 'producto', 'servicio', 'interesado'],
      soporte: ['problema', 'ayuda', 'error', 'falla', 'reparar', 'soporte', 'bug', 'no funciona'],
      consulta: ['información', 'pregunta', 'consulta', 'dudas', 'como', 'cuando', 'donde', 'que es'],
      reclamo: ['queja', 'reclamo', 'molesto', 'mal servicio', 'devolver', 'reembolso', 'insatisfecho']
    };

    // Determinar categoría y puntuación
    let category = 'consulta';
    let score = 0;

    for (const [cat, words] of Object.entries(keywords)) {
      const matches = words.filter(word => conversationText.includes(word)).length;
      if (matches > score) {
        score = matches;
        category = cat;
      }
    }

    // Determinar prioridad
    let priority: 'low' | 'medium' | 'high' = 'low';
    if (conversationText.includes('urgente') || conversationText.includes('emergency')) {
      priority = 'high';
    } else if (messageCount > 5 || score > 2) {
      priority = 'medium';
    }

    // Determinar valor estimado
    let estimatedValue = 100; // Valor base
    if (category === 'ventas') {
      estimatedValue = 500;
    } else if (category === 'soporte') {
      estimatedValue = 200;
    }

    // Análisis de sentimiento básico
    const positiveWords = ['excelente', 'genial', 'perfecto', 'gracias', 'bueno'];
    const negativeWords = ['malo', 'terrible', 'problema', 'error', 'molesto'];
    
    const positiveCount = positiveWords.filter(word => conversationText.includes(word)).length;
    const negativeCount = negativeWords.filter(word => conversationText.includes(word)).length;
    
    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (positiveCount > negativeCount) sentiment = 'positive';
    else if (negativeCount > positiveCount) sentiment = 'negative';

    // Decidir si crear lead
    const shouldCreateLead = messageCount >= 2 && (score > 0 || messageCount > 3);

    // Crear resumen
    const summary = `Conversación de ${category} con ${messageCount} mensajes. Sentimiento: ${sentiment}. Puntuación: ${score}.`;

    return {
      category,
      priority,
      score,
      estimatedValue,
      sentiment,
      shouldCreateLead,
      summary
    };
  }

  /**
   * Crea un lead basado en el chat analizado
   */
  private async createLeadFromChat(accountId: number, chat: any, analysis: ChatAnalysis): Promise<void> {
    try {
      const leadData = {
        name: chat.name || 'Cliente WhatsApp',
        email: null,
        phone: chat.phone,
        company: null,
        position: null,
        source: 'whatsapp',
        status: 'new',
        priority: analysis.priority,
        estimatedValue: analysis.estimatedValue,
        notes: `${analysis.summary}\n\nGenerado automáticamente desde WhatsApp.\nCuenta: ${accountId}\nChat ID: ${chat.chatId}\nFecha: ${new Date().toISOString()}`,
        assignedToId: null,
        createdAt: new Date(),
        lastContactedAt: new Date()
      };

      await db.insert(leads).values(leadData);

    } catch (error) {
      console.error('❌ Error creando lead:', error);
    }
  }

  /**
   * Actualiza un lead existente con nueva actividad
   */
  private async updateExistingLead(leadId: number, chat: any): Promise<void> {
    try {
      const updateData = {
        lastContactedAt: new Date(),
        notes: `Actividad reciente en WhatsApp: ${new Date().toISOString()}\nNuevos mensajes: ${chat.messages?.length || 0}`
      };

      await db.update(leads)
        .set(updateData)
        .where(eq(leads.id, leadId));

    } catch (error) {
      console.error('❌ Error actualizando lead:', error);
    }
  }

  /**
   * Obtiene chats simulados de WhatsApp para demostración
   */
  private async getMockWhatsAppChats(accountId: number): Promise<any[]> {
    // Datos simulados realistas para demostrar la funcionalidad
    return [
      {
        chatId: 'chat_001',
        name: 'María González',
        phone: '+34666123456',
        lastMessage: new Date(),
        messages: [
          { body: 'Hola, estoy interesada en sus servicios', timestamp: new Date(), fromMe: false },
          { body: '¿Podrían enviarme información sobre precios?', timestamp: new Date(), fromMe: false },
          { body: 'Claro, le envío la información', timestamp: new Date(), fromMe: true },
          { body: 'Necesito una cotización urgente', timestamp: new Date(), fromMe: false }
        ]
      },
      {
        chatId: 'chat_002', 
        name: 'Carlos Rodriguez',
        phone: '+34666789012',
        lastMessage: new Date(),
        messages: [
          { body: 'Buenos días, tengo un problema con mi pedido', timestamp: new Date(), fromMe: false },
          { body: 'No recibí el producto que compré la semana pasada', timestamp: new Date(), fromMe: false },
          { body: 'Lamento el inconveniente, revisaré su pedido', timestamp: new Date(), fromMe: true }
        ]
      },
      {
        chatId: 'chat_003',
        name: 'Ana Martínez',
        phone: '+34666345678',
        lastMessage: new Date(),
        messages: [
          { body: '¿Tienen disponibilidad para una consulta?', timestamp: new Date(), fromMe: false },
          { body: 'Necesito información sobre sus productos', timestamp: new Date(), fromMe: false },
          { body: 'Me interesa comprar varios artículos', timestamp: new Date(), fromMe: false },
          { body: '¿Cuál es el precio por mayor?', timestamp: new Date(), fromMe: false }
        ]
      },
      {
        chatId: 'chat_004',
        name: 'Luis García',
        phone: '+34666567890',
        lastMessage: new Date(),
        messages: [
          { body: 'Hola', timestamp: new Date(), fromMe: false },
          { body: '¿Están abiertos?', timestamp: new Date(), fromMe: false }
        ]
      },
      {
        chatId: 'chat_005',
        name: 'Patricia Silva',
        phone: '+34666901234',
        lastMessage: new Date(),
        messages: [
          { body: 'Excelente servicio, muy satisfecha', timestamp: new Date(), fromMe: false },
          { body: 'Quiero realizar otro pedido', timestamp: new Date(), fromMe: false },
          { body: '¿Tienen descuentos para clientes frecuentes?', timestamp: new Date(), fromMe: false },
          { body: 'Gracias por la atención', timestamp: new Date(), fromMe: false }
        ]
      }
    ];
  }

  /**
   * Obtiene estadísticas del servicio
   */
  getStats(): any {
    return {
      isRunning: this.isRunning,
      lastProcessed: new Date().toISOString()
    };
  }
}

// Instancia global del servicio
export const chatToLeadConverter = ChatToLeadConverter.getInstance();