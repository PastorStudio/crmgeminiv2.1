/**
 * Sistema Completo de Asignaciones Automáticas
 * Procesamiento cada 5 segundos con IA Gemini integrada
 */

import { db } from '../db';
import { 
  leads, 
  activities, 
  contacts,
  chatAssignments,
  whatsappAccounts,
  users
} from '@shared/schema';
import { eq, desc, and, sql, isNull } from 'drizzle-orm';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { chatAssignmentService } from './chatAssignmentService';

interface MessageAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral';
  intent: 'sales' | 'support' | 'inquiry' | 'complaint';
  urgency: 'low' | 'medium' | 'high';
  leadPotential: number;
  shouldCreateLead: boolean;
  assignedAgent?: number;
  extractedInfo: {
    name?: string;
    company?: string;
    products?: string[];
    budget?: string;
  };
}

export class CompleteAutomaticAssignmentSystem {
  private genAI: GoogleGenerativeAI | null = null;
  private isProcessing: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeAI();
    this.startAutomaticProcessing();
  }

  private initializeAI() {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (apiKey && apiKey !== 'tu_clave_gemini_aqui') {
      this.genAI = new GoogleGenerativeAI(apiKey);
      console.log('🤖 Sistema de Asignaciones Automáticas activado con Gemini AI');
    } else {
      console.log('⚠️ Sistema funcionando en modo básico sin IA');
    }
  }

  /**
   * Inicia el procesamiento automático cada 5 segundos
   */
  private startAutomaticProcessing() {
    // Procesar inmediatamente al iniciar
    this.processAllPendingItems();
    
    // Configurar procesamiento cada 5 segundos
    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing) {
        await this.processAllPendingItems();
      }
    }, 5000);

    console.log('🔄 Sistema de Asignaciones Automáticas iniciado - Procesamiento cada 5 segundos');
  }

  /**
   * Procesa todos los elementos pendientes
   */
  async processAllPendingItems(): Promise<void> {
    if (this.isProcessing) return;

    try {
      this.isProcessing = true;

      // 1. Procesar mensajes nuevos sin asignar
      await this.processUnassignedMessages();
      
      // 2. Actualizar leads existentes
      await this.updateExistingLeads();
      
      // 3. Verificar asignaciones automáticas
      await this.processAutomaticAssignments();
      
      // 4. Crear actividades automáticas
      await this.createAutomaticActivities();

    } catch (error) {
      console.error('❌ Error en procesamiento automático:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Procesa mensajes no asignados
   */
  private async processUnassignedMessages(): Promise<void> {
    try {
      // Obtener mensajes recientes sin asignar
      const unassignedMessages = await db.select()
        .from(messages)
        .where(and(
          eq(messages.read, false),
          sql`${messages.createdAt} > NOW() - INTERVAL '24 hours'`
        ))
        .orderBy(desc(messages.createdAt))
        .limit(50);

      for (const message of unassignedMessages) {
        await this.processMessage(message);
      }

      if (unassignedMessages.length > 0) {
        console.log(`📨 ${unassignedMessages.length} mensajes procesados automáticamente`);
      }
    } catch (error) {
      console.error('Error procesando mensajes no asignados:', error);
    }
  }

  /**
   * Procesa un mensaje individual
   */
  private async processMessage(message: any): Promise<void> {
    try {
      // Analizar mensaje con IA
      const analysis = await this.analyzeMessageWithAI(message.content || '');
      
      // Buscar o crear lead
      let leadId = message.leadId;
      if (!leadId) {
        leadId = await this.findOrCreateLead(message, analysis);
      }

      // Asignar automáticamente si es necesario
      if (analysis.assignedAgent) {
        await this.assignChatToAgent(message, analysis.assignedAgent);
      }

      // Crear actividad automática
      await this.createActivityFromMessage(message, analysis, leadId);

      // Marcar mensaje como procesado
      await db.update(messages)
        .set({ 
          read: true,
          leadId: leadId,
          processedAt: new Date()
        })
        .where(eq(messages.id, message.id));

    } catch (error) {
      console.error('Error procesando mensaje individual:', error);
    }
  }

  /**
   * Analiza mensaje con Gemini AI
   */
  private async analyzeMessageWithAI(content: string): Promise<MessageAnalysis> {
    if (!this.genAI) {
      return this.getBasicAnalysis(content);
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
      
      const prompt = `
Analiza este mensaje de WhatsApp y proporciona un análisis en formato JSON:

Mensaje: "${content}"

Responde SOLO con un JSON válido con esta estructura:
{
  "sentiment": "positive|negative|neutral",
  "intent": "sales|support|inquiry|complaint",
  "urgency": "low|medium|high",
  "leadPotential": 0-100,
  "shouldCreateLead": true/false,
  "assignedAgent": null o número de agente,
  "extractedInfo": {
    "name": "nombre extraído o null",
    "company": "empresa o null",
    "products": ["productos mencionados"],
    "budget": "presupuesto mencionado o null"
  }
}`;

      const result = await model.generateContent(prompt);
      const response = result.response.text();
      
      // Limpiar respuesta y parsear JSON
      const cleanResponse = response.replace(/```json|```/g, '').trim();
      return JSON.parse(cleanResponse);
      
    } catch (error) {
      console.error('Error analizando con IA:', error);
      return this.getBasicAnalysis(content);
    }
  }

  /**
   * Análisis básico sin IA
   */
  private getBasicAnalysis(content: string): MessageAnalysis {
    const lowerContent = content.toLowerCase();
    
    return {
      sentiment: lowerContent.includes('gracias') || lowerContent.includes('excelente') ? 'positive' : 'neutral',
      intent: lowerContent.includes('comprar') || lowerContent.includes('precio') ? 'sales' : 'inquiry',
      urgency: lowerContent.includes('urgente') || lowerContent.includes('ahora') ? 'high' : 'medium',
      leadPotential: lowerContent.includes('comprar') ? 80 : 50,
      shouldCreateLead: true,
      extractedInfo: {}
    };
  }

  /**
   * Encuentra o crea un lead
   */
  private async findOrCreateLead(message: any, analysis: MessageAnalysis): Promise<number> {
    try {
      // Buscar lead existente
      const [existingLead] = await db.select()
        .from(leads)
        .where(eq(leads.contactId, message.contactId || 0))
        .limit(1);

      if (existingLead) {
        return existingLead.id;
      }

      // Crear nuevo lead
      const [newLead] = await db.insert(leads)
        .values({
          title: `Lead desde WhatsApp - ${analysis.extractedInfo.name || 'Contacto'}`,
          source: 'whatsapp',
          status: 'nuevo',
          priority: analysis.urgency === 'high' ? 'alta' : 'media',
          value: analysis.extractedInfo.budget || '0',
          notes: `Análisis automático: ${analysis.intent} - Potencial: ${analysis.leadPotential}%`,
          contactId: message.contactId || 0,
          whatsappAccountId: message.whatsappAccountId || 1,
          assignedTo: analysis.assignedAgent || 1,
          tags: [analysis.intent, analysis.sentiment],
          createdAt: new Date(),
          lastContactDate: new Date()
        })
        .returning();

      console.log(`🎯 Nuevo lead creado automáticamente: ${newLead.title}`);
      return newLead.id;

    } catch (error) {
      console.error('Error creando lead:', error);
      return 1; // Lead por defecto
    }
  }

  /**
   * Asigna chat a un agente automáticamente
   */
  private async assignChatToAgent(message: any, agentId: number): Promise<void> {
    try {
      // Verificar si ya existe asignación
      const existingAssignment = await chatAssignmentService.findAssignment(
        message.chatId || message.from,
        message.whatsappAccountId || 1
      );

      if (!existingAssignment) {
        await chatAssignmentService.createAssignment({
          chatId: message.chatId || message.from,
          accountId: message.whatsappAccountId || 1,
          assignedToId: agentId,
          assignedById: 1, // Sistema automático
          category: 'automatico',
          notes: 'Asignación automática basada en análisis de IA'
        });

        console.log(`👤 Chat asignado automáticamente al agente ${agentId}`);
      }
    } catch (error) {
      console.error('Error asignando chat:', error);
    }
  }

  /**
   * Crea actividad automática desde mensaje
   */
  private async createActivityFromMessage(message: any, analysis: MessageAnalysis, leadId: number): Promise<void> {
    try {
      await db.insert(activities)
        .values({
          title: `Mensaje WhatsApp - ${analysis.intent}`,
          description: `Mensaje recibido: "${message.content?.substring(0, 100)}..."`,
          activityType: 'mensaje',
          priority: analysis.urgency,
          status: 'completado',
          leadId: leadId,
          userId: analysis.assignedAgent || 1,
          dueDate: new Date(),
          completedAt: new Date(),
          createdAt: new Date()
        });
    } catch (error) {
      console.error('Error creando actividad:', error);
    }
  }

  /**
   * Actualiza leads existentes
   */
  private async updateExistingLeads(): Promise<void> {
    try {
      // Obtener leads activos sin actividad reciente
      const staleLeads = await db.select()
        .from(leads)
        .where(and(
          eq(leads.status, 'en_progreso'),
          sql`${leads.lastContactDate} < NOW() - INTERVAL '7 days'`
        ))
        .limit(20);

      for (const lead of staleLeads) {
        // Actualizar estado a seguimiento
        await db.update(leads)
          .set({
            status: 'seguimiento',
            notes: `${lead.notes}\n\nActualizado automáticamente - Sin actividad por 7 días`
          })
          .where(eq(leads.id, lead.id));
      }

      if (staleLeads.length > 0) {
        console.log(`📋 ${staleLeads.length} leads actualizados automáticamente`);
      }
    } catch (error) {
      console.error('Error actualizando leads:', error);
    }
  }

  /**
   * Procesa asignaciones automáticas
   */
  private async processAutomaticAssignments(): Promise<void> {
    try {
      // Buscar chats sin asignar con mensajes recientes
      const unassignedChats = await db.select({
        chatId: messages.chatId,
        accountId: messages.whatsappAccountId,
        lastMessage: messages.createdAt
      })
        .from(messages)
        .leftJoin(chatAssignments, and(
          eq(messages.chatId, chatAssignments.chatId),
          eq(messages.whatsappAccountId, chatAssignments.accountId)
        ))
        .where(and(
          isNull(chatAssignments.id),
          sql`${messages.createdAt} > NOW() - INTERVAL '1 hour'`
        ))
        .groupBy(messages.chatId, messages.whatsappAccountId, messages.createdAt)
        .limit(10);

      for (const chat of unassignedChats) {
        // Asignar al primer agente disponible
        const [availableAgent] = await db.select()
          .from(users)
          .where(eq(users.role, 'agent'))
          .limit(1);

        if (availableAgent) {
          await chatAssignmentService.createAssignment({
            chatId: chat.chatId,
            accountId: chat.accountId,
            assignedToId: availableAgent.id,
            assignedById: 1,
            category: 'automatico',
            notes: 'Asignación automática por sistema'
          });
        }
      }
    } catch (error) {
      console.error('Error procesando asignaciones automáticas:', error);
    }
  }

  /**
   * Crea actividades automáticas
   */
  private async createAutomaticActivities(): Promise<void> {
    try {
      // Buscar leads sin actividad reciente
      const leadsNeedingActivity = await db.select()
        .from(leads)
        .leftJoin(activities, eq(leads.id, activities.leadId))
        .where(and(
          eq(leads.status, 'nuevo'),
          sql`${leads.createdAt} > NOW() - INTERVAL '1 hour'`,
          isNull(activities.id)
        ))
        .limit(10);

      for (const { leads: lead } of leadsNeedingActivity) {
        if (lead) {
          await db.insert(activities)
            .values({
              title: 'Contacto inicial automático',
              description: 'Actividad creada automáticamente para nuevo lead',
              activityType: 'llamada',
              priority: 'media',
              status: 'pendiente',
              leadId: lead.id,
              userId: lead.assignedTo,
              dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Mañana
              createdAt: new Date()
            });
        }
      }
    } catch (error) {
      console.error('Error creando actividades automáticas:', error);
    }
  }

  /**
   * Detiene el sistema
   */
  public stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('🔴 Sistema de Asignaciones Automáticas detenido');
    }
  }
}

// Instancia global del sistema
export const completeAutomaticAssignmentSystem = new CompleteAutomaticAssignmentSystem();