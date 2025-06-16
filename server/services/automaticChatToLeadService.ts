import { storage } from '../storage';
import { whatsappMultiAccountManager } from './whatsappMultiAccountManager';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '../db';
import { leads, whatsappAccounts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface ProcessedChat {
  chatId: string;
  contactName: string;
  contactPhone: string;
  accountId: number;
  lastMessage: string;
  messageCount: number;
  timestamp: Date;
}

/**
 * Servicio automático para convertir todos los chats en leads
 * Se ejecuta automáticamente cuando llegan nuevos mensajes
 */
export class AutomaticChatToLeadService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private isProcessing = false;
  private processedChats = new Set<string>();

  constructor() {
    this.initializeAI();
    this.startPeriodicConversion();
  }

  private initializeAI() {
    try {
      const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
      if (apiKey) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        console.log('🤖 Sistema automático de conversión de chats a leads con IA inicializado');
      }
    } catch (error) {
      console.log('⚠️ IA no disponible para análisis automático de chats');
    }
  }

  /**
   * Inicia la conversión periódica automática cada 30 segundos
   */
  private startPeriodicConversion() {
    setInterval(async () => {
      if (!this.isProcessing) {
        await this.processAllNewChats();
      }
    }, 30000); // Cada 30 segundos

    console.log('🔄 Conversión automática de chats a leads activada - cada 30 segundos');
  }

  /**
   * Procesa todos los chats nuevos de todas las cuentas de WhatsApp
   */
  async processAllNewChats(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;
    console.log('🔄 Iniciando conversión automática de chats a leads...');

    try {
      // Obtener todas las cuentas de WhatsApp activas
      const accounts = await db.select().from(whatsappAccounts);
      
      let totalProcessed = 0;
      let totalCreated = 0;
      let totalUpdated = 0;

      for (const account of accounts) {
        try {
          const result = await this.processChatsFromAccount(account.id);
          totalProcessed += result.processed;
          totalCreated += result.created;
          totalUpdated += result.updated;
        } catch (error) {
          console.error(`Error procesando cuenta ${account.id}:`, error);
        }
      }

      if (totalCreated > 0 || totalUpdated > 0) {
        console.log(`✅ Conversión automática completada: ${totalCreated} nuevos leads, ${totalUpdated} actualizados de ${totalProcessed} chats`);
      }

    } catch (error) {
      console.error('Error en conversión automática:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Procesa chats de una cuenta específica
   */
  async processChatsFromAccount(accountId: number): Promise<{processed: number, created: number, updated: number}> {
    let processed = 0;
    let created = 0;
    let updated = 0;

    try {
      // Obtener chats de la cuenta
      const chats = await this.getChatsFromAccount(accountId);
      
      for (const chat of chats) {
        const chatKey = `${accountId}_${chat.chatId}`;
        
        // Saltar si ya fue procesado recientemente
        if (this.processedChats.has(chatKey)) {
          continue;
        }

        try {
          const result = await this.convertChatToLead(chat);
          processed++;
          
          if (result.created) {
            created++;
            console.log(`✅ Nuevo lead automático: ${chat.contactName} (${chat.contactPhone})`);
          } else if (result.updated) {
            updated++;
            console.log(`🔄 Lead actualizado automáticamente: ${chat.contactName}`);
          }

          // Marcar como procesado
          this.processedChats.add(chatKey);

        } catch (error) {
          console.error(`Error procesando chat ${chat.chatId}:`, error);
        }
      }

      // Limpiar cache de chats procesados (mantener solo los últimos 1000)
      if (this.processedChats.size > 1000) {
        const entries = Array.from(this.processedChats);
        this.processedChats.clear();
        entries.slice(-500).forEach(entry => this.processedChats.add(entry));
      }

    } catch (error) {
      console.error(`Error obteniendo chats de cuenta ${accountId}:`, error);
    }

    return { processed, created, updated };
  }

  /**
   * Obtiene chats INDIVIDUALES de una cuenta de WhatsApp (EXCLUYE GRUPOS)
   */
  private async getChatsFromAccount(accountId: number): Promise<ProcessedChat[]> {
    try {
      const client = whatsappMultiAccountManager.getClient(accountId);
      if (!client) {
        console.log(`⚠️ Cliente WhatsApp no disponible para cuenta ${accountId}`);
        return this.generateFallbackChats(accountId);
      }

      // Verificar si el cliente está listo y autenticado
      const isReady = client.info && client.info.wid;
      if (!isReady) {
        console.log(`⚠️ Cliente WhatsApp no está listo para cuenta ${accountId}`);
        return this.generateFallbackChats(accountId);
      }

      // Obtener SOLO chats individuales, excluyendo grupos completamente
      let chats;
      try {
        chats = await client.getChats();
      } catch (error) {
        console.error(`❌ Error obteniendo chats de cuenta ${accountId}:`, error);
        return this.generateFallbackChats(accountId);
      }

      if (!Array.isArray(chats) || chats.length === 0) {
        console.log(`📱 No hay chats disponibles para cuenta ${accountId}, usando datos de demostración`);
        return this.generateFallbackChats(accountId);
      }

      const individualChats = chats.filter(chat => {
        // FILTRO CRÍTICO: Solo chats individuales (no grupos)
        const isIndividual = !chat.isGroup && !chat.id._serialized.includes('@g.us');
        const hasRecentActivity = chat.lastMessage && chat.lastMessage.timestamp > (Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 días
        const hasValidContact = chat.contact && chat.contact.number;
        
        if (chat.isGroup || chat.id._serialized.includes('@g.us')) {
          console.log(`🚫 GRUPO EXCLUIDO: ${chat.name || chat.id.user} - No se convierte a lead`);
          return false;
        }
        
        return isIndividual && hasValidContact;
      });

      console.log(`📱 Procesando ${individualChats.length} chats INDIVIDUALES de cuenta ${accountId} (${chats.length - individualChats.length} grupos excluidos)`);

      const processedChats: ProcessedChat[] = [];

      for (const chat of individualChats) {
        try {
          const contact = await chat.getContact();
          const lastMessage = chat.lastMessage;
          
          if (!contact || !contact.number || !lastMessage) continue;

          // Asegurar que es un chat individual válido
          if (chat.isGroup) {
            console.log(`🚫 VERIFICACIÓN ADICIONAL: Grupo detectado ${chat.id.user} - omitido`);
            continue;
          }

          const processedChat: ProcessedChat = {
            chatId: chat.id.user,
            contactName: contact.pushname || contact.name || contact.number,
            contactPhone: `+${contact.number}`,
            accountId,
            lastMessage: lastMessage.body || '',
            messageCount: await this.getMessageCount(chat),
            timestamp: new Date(lastMessage.timestamp * 1000)
          };

          processedChats.push(processedChat);
          console.log(`✅ Chat individual válido: ${processedChat.contactName} (${processedChat.contactPhone})`);
          
        } catch (error) {
          console.error(`Error procesando chat individual:`, error);
        }
      }

      return processedChats;
    } catch (error) {
      console.error(`Error obteniendo chats individuales de cuenta ${accountId}:`, error);
      // Fallback con datos demo solo para desarrollo
      if (process.env.NODE_ENV === 'development') {
        return [{
          chatId: `demo_individual_${accountId}_${Date.now()}`,
          contactName: 'Cliente Demo Individual',
          contactPhone: `+5491123456${Math.floor(Math.random() * 100)}`,
          accountId,
          lastMessage: 'Hola, estoy interesado en sus servicios',
          messageCount: 3,
          timestamp: new Date()
        }];
      }
      return [];
    }
  }

  /**
   * Obtiene el número de mensajes en un chat
   */
  private async getMessageCount(chat: any): Promise<number> {
    try {
      const messages = await chat.fetchMessages({ limit: 50 });
      return messages.length;
    } catch (error) {
      return 1; // Fallback
    }
  }

  /**
   * Convierte un chat individual en lead
   */
  async convertChatToLead(chat: ProcessedChat): Promise<{created: boolean, updated: boolean}> {
    try {
      // Verificar si ya existe un lead para este teléfono
      const existingLeads = await storage.getLeadsByPhone(chat.contactPhone);
      
      if (existingLeads.length === 0) {
        // Crear nuevo lead
        const leadData = {
          name: chat.contactName,
          phone: chat.contactPhone,
          email: this.generateEmailFromPhone(chat.contactPhone),
          source: 'whatsapp_auto',
          status: 'new',
          priority: this.determinePriorityFromChat(chat),
          notes: this.generateNotesFromChat(chat),
          company: this.extractCompanyFromName(chat.contactName),
          whatsappAccountId: chat.accountId,
          assignedTo: await this.getDefaultAssignee(),
          value: '0',
          tags: ['whatsapp', 'auto_converted'],
          stage: 'lead',
          lastContactDate: chat.timestamp,
          nextFollowUpDate: this.calculateNextFollowUp(),
          leadScore: this.calculateLeadScore(chat),
          timezone: 'America/Argentina/Buenos_Aires'
        };

        const newLead = await storage.createLead(leadData);
        console.log(`📝 Lead automático creado: ${chat.contactName} (ID: ${newLead.id})`);
        
        return { created: true, updated: false };
      } else {
        // Actualizar lead existente
        const existingLead = existingLeads[0];
        const updatedNotes = `${existingLead.notes || ''}\n\n[${new Date().toLocaleString()}] Nueva actividad automática:\n${chat.lastMessage}`;
        
        await storage.updateLead(existingLead.id, {
          lastContactDate: chat.timestamp,
          notes: updatedNotes,
          leadScore: Math.max(existingLead.leadScore || 0, this.calculateLeadScore(chat))
        });

        return { created: false, updated: true };
      }
    } catch (error) {
      console.error(`Error convirtiendo chat a lead:`, error);
      return { created: false, updated: false };
    }
  }

  /**
   * Genera email temporal basado en teléfono
   */
  private generateEmailFromPhone(phone: string): string {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    return `${cleanPhone}@whatsapp.auto`;
  }

  /**
   * Determina prioridad basada en el chat
   */
  private determinePriorityFromChat(chat: ProcessedChat): 'high' | 'medium' | 'low' {
    const message = chat.lastMessage.toLowerCase();
    
    // Palabras clave de alta prioridad
    if (message.includes('urgente') || message.includes('comprar') || message.includes('precio') || message.includes('presupuesto')) {
      return 'high';
    }
    
    // Palabras clave de prioridad media
    if (message.includes('interesado') || message.includes('información') || message.includes('consulta')) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Genera notas automáticas del chat
   */
  private generateNotesFromChat(chat: ProcessedChat): string {
    return `[CONVERSIÓN AUTOMÁTICA - ${new Date().toLocaleString()}]
Origen: WhatsApp Cuenta ${chat.accountId}
Chat ID: ${chat.chatId}
Mensajes en conversación: ${chat.messageCount}
Último mensaje: "${chat.lastMessage}"

Estado: Lead creado automáticamente desde chat de WhatsApp`;
  }

  /**
   * Extrae posible nombre de empresa
   */
  private extractCompanyFromName(name: string): string | null {
    const companyKeywords = ['srl', 'sa', 'ltda', 'inc', 'corp', 'empresa', 'company'];
    const lowerName = name.toLowerCase();
    
    for (const keyword of companyKeywords) {
      if (lowerName.includes(keyword)) {
        return name;
      }
    }
    
    return null;
  }

  /**
   * Obtiene agente por defecto para asignación
   */
  private async getDefaultAssignee(): Promise<number> {
    try {
      // Buscar agentes disponibles, priorizar supervisores
      const users = await storage.getAllUsers();
      const supervisor = users.find(u => u.role === 'supervisor' && u.status === 'active');
      if (supervisor) return supervisor.id;
      
      const agent = users.find(u => u.role === 'agent' && u.status === 'active');
      if (agent) return agent.id;
      
      return 17; // Usuario admin por defecto
    } catch (error) {
      return 17; // Usuario admin por defecto
    }
  }

  /**
   * Calcula fecha de siguiente seguimiento
   */
  private calculateNextFollowUp(): Date {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 1); // Seguimiento al día siguiente
    return nextDate;
  }

  /**
   * Calcula score del lead basado en el chat
   */
  private calculateLeadScore(chat: ProcessedChat): number {
    let score = 50; // Base score
    
    const message = chat.lastMessage.toLowerCase();
    
    // Incrementar score por palabras clave positivas
    if (message.includes('comprar')) score += 20;
    if (message.includes('precio') || message.includes('costo')) score += 15;
    if (message.includes('urgente')) score += 10;
    if (message.includes('interesado')) score += 10;
    if (message.includes('cuando')) score += 5;
    
    // Incrementar por número de mensajes (más engagement)
    score += Math.min(chat.messageCount * 2, 20);
    
    return Math.min(score, 100);
  }

  /**
   * Método manual para forzar conversión de todos los chats
   */
  async forceConvertAllChats(): Promise<{processed: number, created: number, updated: number}> {
    console.log('🚀 Forzando conversión manual de todos los chats...');
    this.processedChats.clear(); // Limpiar cache para procesar todos
    return await this.processAllNewChats() as any;
  }
}

// Instancia singleton
export const automaticChatToLeadService = new AutomaticChatToLeadService();