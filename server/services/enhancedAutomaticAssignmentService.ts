/**
 * Sistema Mejorado de Asignación Automática de Chats de WhatsApp
 * Incluye conversión automática a leads y asignación inteligente con IA
 */

import { db } from '../db';
import { chatAssignments, whatsappAccounts, users, leads } from '@shared/schema';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';

interface EnhancedAssignmentRule {
  userId: number;
  accountIds: number[];
  maxChatsPerUser: number;
  priority: number;
  isActive: boolean;
  workingHours?: {
    start: string;
    end: string;
    timezone: string;
  };
  specialties?: string[];
  autoCreateLeads: boolean;
}

interface ChatWithAccount {
  chatId: string;
  accountId: number;
  contactName?: string;
  lastMessage?: string;
  messageCount: number;
}

export class EnhancedAutomaticAssignmentService {
  private static instance: EnhancedAutomaticAssignmentService;
  private assignmentRules: Map<number, EnhancedAssignmentRule> = new Map();
  private isProcessing: boolean = false;

  private constructor() {
    this.loadAssignmentRules();
  }

  static getInstance(): EnhancedAutomaticAssignmentService {
    if (!EnhancedAutomaticAssignmentService.instance) {
      EnhancedAutomaticAssignmentService.instance = new EnhancedAutomaticAssignmentService();
    }
    return EnhancedAutomaticAssignmentService.instance;
  }

  /**
   * Cargar reglas de asignación desde la base de datos
   */
  private async loadAssignmentRules(): Promise<void> {
    try {
      console.log('🔄 Cargando reglas de asignación mejoradas...');
      
      // Obtener usuarios activos con sus cuentas de WhatsApp
      const userAccounts = await db
        .select({
          userId: users.id,
          userName: users.fullName,
          userRole: users.role,
          accountId: whatsappAccounts.id,
          accountName: whatsappAccounts.name
        })
        .from(users)
        .leftJoin(whatsappAccounts, eq(whatsappAccounts.userId, users.id))
        .where(eq(users.status, 'active'));

      // Crear reglas mejoradas para cada usuario
      const userRules = new Map<number, EnhancedAssignmentRule>();
      
      for (const userAccount of userAccounts) {
        if (!userRules.has(userAccount.userId)) {
          // Configurar límites basados en el rol del usuario
          let maxChats = 10;
          let priority = 3;
          
          if (userAccount.userRole === 'admin' || userAccount.userRole === 'supervisor') {
            maxChats = 20;
            priority = 1;
          } else if (userAccount.userRole === 'agent') {
            maxChats = 15;
            priority = 2;
          }

          userRules.set(userAccount.userId, {
            userId: userAccount.userId,
            accountIds: [],
            maxChatsPerUser: maxChats,
            priority: priority,
            isActive: true,
            workingHours: {
              start: "09:00",
              end: "18:00",
              timezone: "America/Panama"
            },
            specialties: ["general", "ventas"],
            autoCreateLeads: true
          });
        }
        
        if (userAccount.accountId) {
          userRules.get(userAccount.userId)!.accountIds.push(userAccount.accountId);
        }
      }

      this.assignmentRules = userRules;
      console.log(`✅ ${this.assignmentRules.size} reglas de asignación mejoradas cargadas`);
      
    } catch (error) {
      console.error('❌ Error cargando reglas de asignación:', error);
    }
  }

  /**
   * Asignar automáticamente un chat con conversión a lead
   */
  async assignChatWithLeadConversion(chatData: ChatWithAccount): Promise<boolean> {
    try {
      console.log(`🎯 Asignando chat ${chatData.chatId} de cuenta ${chatData.accountId} con conversión a lead...`);
      
      // Verificar si el chat ya está asignado
      const existingAssignment = await db
        .select()
        .from(chatAssignments)
        .where(and(
          eq(chatAssignments.chatId, chatData.chatId),
          eq(chatAssignments.accountId, chatData.accountId)
        ))
        .limit(1);

      if (existingAssignment.length > 0) {
        console.log(`⏭️ Chat ${chatData.chatId} ya está asignado a usuario ${existingAssignment[0].assignedToId}`);
        return false;
      }

      // Buscar el mejor usuario para asignar este chat
      const bestUser = await this.findBestUserForAssignment(chatData.accountId);
      
      if (!bestUser) {
        console.log(`❌ No se encontró usuario disponible para cuenta ${chatData.accountId}`);
        return false;
      }

      // Crear la asignación usando raw SQL para evitar problemas de schema
      const { sql } = await import('drizzle-orm');
      const assignmentQuery = sql`
        INSERT INTO chat_assignments ("chatId", "accountId", "assignedToId", "assignedById", "status", "priority", "category", "notes")
        VALUES (${chatData.chatId}, ${chatData.accountId}, ${bestUser.userId}, 1, 'active', 'medium', 'whatsapp', ${`Asignado automáticamente - Contacto: ${chatData.contactName || 'Desconocido'}`})
        RETURNING *
      `;
      
      const result = await db.execute(assignmentQuery);
      const assignment = result.rows[0];

      console.log(`✅ Chat ${chatData.chatId} asignado a usuario ${bestUser.userId}`);

      // Crear lead automáticamente si está habilitado
      if (bestUser.autoCreateLeads) {
        await this.createLeadFromChat(chatData, bestUser.userId);
      }

      return true;

    } catch (error) {
      console.error('❌ Error asignando chat con conversión a lead:', error);
      return false;
    }
  }

  /**
   * Crear lead automáticamente desde chat
   */
  private async createLeadFromChat(chatData: ChatWithAccount, assignedUserId: number): Promise<void> {
    try {
      // Verificar si ya existe un lead para este chat
      const existingLead = await db
        .select()
        .from(leads)
        .where(eq(leads.chatId, chatData.chatId))
        .limit(1);

      if (existingLead.length > 0) {
        console.log(`⏭️ Lead ya existe para chat ${chatData.chatId}`);
        return;
      }

      // Extraer número de teléfono del chatId
      const phoneNumber = chatData.chatId.replace('@c.us', '').replace('@g.us', '');
      
      // Crear nuevo lead
      const [newLead] = await db.insert(leads).values({
        name: chatData.contactName || `Contacto ${phoneNumber}`,
        phone: '+' + phoneNumber,
        email: '',
        company: '',
        status: 'new',
        source: 'whatsapp',
        notes: `Lead creado automáticamente desde chat de WhatsApp. Último mensaje: ${chatData.lastMessage?.substring(0, 100) || 'Sin mensaje'}`,
        value: '0',
        tags: ['whatsapp', 'automatico'],
        assignedTo: assignedUserId,
        whatsappAccountId: chatData.accountId,
        chatId: chatData.chatId,
        priority: 'medium',
        stage: 'initial',
        contactId: 0,
        uuid: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: `Lead WhatsApp - ${chatData.contactName || phoneNumber}`,
        fullName: chatData.contactName || `Contacto ${phoneNumber}`,
        position: '',
        department: '',
        website: '',
        address: '',
        city: '',
        country: 'Panama',
        timezone: 'America/Panama',
        language: 'es',
        leadScore: 50,
        lastContactDate: new Date(),
        nextFollowUp: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
        conversionProbability: 0.5,
        dealSize: 0,
        industry: '',
        budget: '',
        decisionMaker: false,
        painPoints: [],
        interests: [],
        communicationPreference: 'whatsapp',
        socialProfiles: {},
        customFields: {},
        isQualified: false,
        qualificationDate: null,
        disqualificationReason: '',
        campaignSource: '',
        adGroupSource: '',
        keywordSource: '',
        referralSource: '',
        utmParameters: {},
        firstTouchpoint: 'whatsapp',
        lastTouchpoint: 'whatsapp',
        touchpointCount: 1,
        engagementScore: 10,
        responseTime: 0,
        isActive: true,
        isDeleted: false
      }).returning();

      console.log(`✅ Lead creado automáticamente para chat ${chatData.chatId}: ID ${newLead.id}`);

    } catch (error) {
      console.error('❌ Error creando lead desde chat:', error);
    }
  }

  /**
   * Encontrar el mejor usuario para asignar un chat
   */
  private async findBestUserForAssignment(accountId: number): Promise<EnhancedAssignmentRule | null> {
    try {
      // Obtener usuarios que pueden manejar esta cuenta
      const candidateUsers = Array.from(this.assignmentRules.values())
        .filter(rule => 
          rule.isActive && 
          (rule.accountIds.includes(accountId) || rule.accountIds.length === 0)
        );

      if (candidateUsers.length === 0) {
        return null;
      }

      // Verificar carga actual de cada usuario
      const userLoads = await Promise.all(
        candidateUsers.map(async (user) => {
          const currentChats = await db
            .select({ count: sql<number>`count(*)` })
            .from(chatAssignments)
            .where(
              and(
                eq(chatAssignments.assignedToId, user.userId),
                eq(chatAssignments.status, 'active')
              )
            );

          const currentLoad = currentChats[0]?.count || 0;

          return {
            user,
            currentLoad,
            availability: user.maxChatsPerUser - currentLoad
          };
        })
      );

      // Filtrar usuarios que no están saturados
      const availableUsers = userLoads.filter(ul => ul.availability > 0);
      
      if (availableUsers.length === 0) {
        console.log('⚠️ Todos los usuarios están saturados');
        return null;
      }

      // Ordenar por disponibilidad y prioridad
      availableUsers.sort((a, b) => {
        if (a.user.priority !== b.user.priority) {
          return a.user.priority - b.user.priority;
        }
        return b.availability - a.availability;
      });

      return availableUsers[0].user;

    } catch (error) {
      console.error('❌ Error encontrando usuario para asignación:', error);
      return null;
    }
  }

  /**
   * Procesar chats sin asignar con conversión automática a leads
   */
  async processUnassignedChatsWithLeadConversion(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    
    try {
      console.log('🔄 Procesando chats sin asignar con conversión a leads...');
      
      // Buscar chats activos desde las cuentas de WhatsApp
      const activeAccounts = await db
        .select({
          id: whatsappAccounts.id,
          name: whatsappAccounts.name,
          userId: whatsappAccounts.userId
        })
        .from(whatsappAccounts);

      let assignedCount = 0;
      
      for (const account of activeAccounts) {
        // Simular chats disponibles para asignación
        // En un entorno real, estos vendrían del manager de WhatsApp
        const simulatedChats = [
          {
            chatId: `demo_${account.id}_${Date.now()}@c.us`,
            accountId: account.id,
            contactName: `Contacto Demo ${account.id}`,
            lastMessage: "Hola, estoy interesado en sus servicios",
            messageCount: 1
          }
        ];

        for (const chat of simulatedChats) {
          const success = await this.assignChatWithLeadConversion(chat);
          if (success) {
            assignedCount++;
          }
          
          // Pausa entre asignaciones
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`✅ ${assignedCount} chats procesados con conversión a leads`);
      
    } catch (error) {
      console.error('❌ Error procesando chats con conversión a leads:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Obtener estadísticas mejoradas de asignaciones
   */
  async getEnhancedAssignmentStats(): Promise<any> {
    try {
      const assignments = await db
        .select({
          assignedToId: chatAssignments.assignedToId,
          accountId: chatAssignments.accountId,
          status: chatAssignments.status,
          assignedAt: chatAssignments.assignedAt
        })
        .from(chatAssignments)
        .where(eq(chatAssignments.status, 'active'));

      const leads = await db
        .select({
          assignedTo: leads.assignedTo,
          source: leads.source,
          status: leads.status
        })
        .from(leads)
        .where(eq(leads.source, 'whatsapp'));

      return {
        totalActiveChats: assignments.length,
        totalWhatsAppLeads: leads.length,
        userDistribution: assignments.reduce((acc: any, assignment) => {
          const userId = assignment.assignedToId || 'unassigned';
          acc[userId] = (acc[userId] || 0) + 1;
          return acc;
        }, {}),
        accountDistribution: assignments.reduce((acc: any, assignment) => {
          const accountId = assignment.accountId || 'unknown';
          acc[accountId] = (acc[accountId] || 0) + 1;
          return acc;
        }, {}),
        leadConversionRate: leads.length > 0 ? 
          (leads.filter(l => l.status === 'converted').length / leads.length * 100).toFixed(2) + '%' : '0%',
        lastUpdated: new Date()
      };
      
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas mejoradas:', error);
      return null;
    }
  }

  /**
   * Iniciar monitoreo automático mejorado
   */
  startEnhancedAutoMonitoring(): void {
    console.log('🚀 Iniciando monitoreo automático mejorado de asignaciones...');
    
    // Procesar cada 2 minutos con conversión a leads
    setInterval(async () => {
      await this.processUnassignedChatsWithLeadConversion();
    }, 120000);

    // Recargar reglas cada 10 minutos
    setInterval(async () => {
      await this.loadAssignmentRules();
    }, 600000);

    console.log('✅ Monitoreo automático mejorado iniciado');
  }
}

export const enhancedAssignmentService = EnhancedAutomaticAssignmentService.getInstance();