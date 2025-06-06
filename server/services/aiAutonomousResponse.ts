/**
 * Sistema autónomo de respuestas AI con OpenAI
 * Maneja respuestas inteligentes automáticas para WhatsApp
 */

import OpenAI from 'openai';
import { db } from '../db.js';
import { whatsappAccounts, whatsappMessages, contacts, leads } from '../../shared/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';
import { notificationService } from './notificationWebSocket.js';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

interface ChatContext {
  chatId: string;
  contactName: string;
  recentMessages: Array<{
    body: string;
    fromMe: boolean;
    timestamp: number;
  }>;
  contactInfo?: any;
  leadInfo?: any;
}

interface AIResponseConfig {
  accountId: number;
  prompt: string;
  enabled: boolean;
  responseDelay: number;
  maxResponseLength: number;
  language: string;
}

export class AIAutonomousResponseService {
  private isInitialized = false;
  private responseConfigs: Map<number, AIResponseConfig> = new Map();
  private processingQueue: Set<string> = new Set();

  constructor() {
    this.initialize();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🤖 Inicializando sistema de respuestas autónomas AI...');
      
      // Cargar configuraciones de cuentas
      await this.loadResponseConfigs();
      
      this.isInitialized = true;
      console.log('✅ Sistema de respuestas autónomas AI inicializado');
    } catch (error) {
      console.error('❌ Error inicializando sistema AI:', error);
    }
  }

  private async loadResponseConfigs(): Promise<void> {
    try {
      const accounts = await db.select().from(whatsappAccounts);
      
      for (const account of accounts) {
        if (account.autoResponseEnabled) {
          const config: AIResponseConfig = {
            accountId: account.id,
            prompt: this.getDefaultPrompt(account.name || 'Asistente'),
            enabled: true,
            responseDelay: 2000, // 2 segundos
            maxResponseLength: 500,
            language: 'es'
          };
          
          this.responseConfigs.set(account.id, config);
          console.log(`🤖 Configuración AI cargada para cuenta ${account.id}`);
        }
      }
    } catch (error) {
      console.error('Error cargando configuraciones AI:', error);
    }
  }

  private getDefaultPrompt(businessName: string): string {
    return `Eres un asistente inteligente de ${businessName}. Tu función es:

1. RESPONDER DE FORMA PROFESIONAL Y AMIGABLE
2. IDENTIFICAR INTENCIONES DEL CLIENTE (consulta, venta, soporte, información)
3. PROPORCIONAR INFORMACIÓN ÚTIL SOBRE PRODUCTOS/SERVICIOS
4. CAPTURAR LEADS CALIFICADOS
5. DERIVAR A HUMANOS CUANDO SEA NECESARIO

REGLAS IMPORTANTES:
- Responde en español de manera natural y conversacional
- Mantén respuestas concisas (máximo 2-3 párrafos)
- Si no sabes algo específico, deriva a un asesor humano
- Siempre sé cortés y profesional
- Identifica oportunidades de venta sutilmente
- Solicita información de contacto cuando sea apropiado

CONTEXTO DE NEGOCIO: ${businessName} - Empresa comprometida con brindar excelente servicio al cliente.`;
  }

  async processMessage(message: any, accountId: number): Promise<boolean> {
    // No procesar mensajes propios o si ya está en proceso
    if (message.fromMe || this.processingQueue.has(message.chatId)) {
      return false;
    }

    const config = this.responseConfigs.get(accountId);
    if (!config || !config.enabled) {
      return false;
    }

    try {
      this.processingQueue.add(message.chatId);
      
      console.log(`🤖 Procesando mensaje AI para chat ${message.chatId}`);

      // Obtener contexto del chat
      const context = await this.getChatContext(message.chatId, accountId);
      
      // Generar respuesta AI
      const aiResponse = await this.generateAIResponse(message.body, context, config);
      
      if (aiResponse) {
        // Esperar delay configurado antes de enviar
        setTimeout(async () => {
          await this.sendAIResponse(message.chatId, aiResponse, accountId);
          this.processingQueue.delete(message.chatId);
        }, config.responseDelay);

        return true;
      }

      this.processingQueue.delete(message.chatId);
      return false;

    } catch (error) {
      console.error(`❌ Error procesando mensaje AI:`, error);
      this.processingQueue.delete(message.chatId);
      return false;
    }
  }

  private async getChatContext(chatId: string, accountId: number): Promise<ChatContext> {
    try {
      // Obtener mensajes recientes
      const recentMessages = await db
        .select({
          body: messages.body,
          fromMe: messages.fromMe,
          timestamp: messages.timestamp
        })
        .from(messages)
        .where(and(
          eq(messages.chatId, chatId),
          eq(messages.whatsappAccountId, accountId)
        ))
        .orderBy(desc(messages.timestamp))
        .limit(10);

      // Obtener información del contacto
      const contact = await db
        .select()
        .from(contacts)
        .where(and(
          eq(contacts.chatId, chatId),
          eq(contacts.whatsappAccountId, accountId)
        ))
        .limit(1);

      // Obtener información de lead si existe
      const lead = contact.length > 0 ? await db
        .select()
        .from(leads)
        .where(eq(leads.contactId, contact[0].id))
        .limit(1) : [];

      return {
        chatId,
        contactName: contact[0]?.name || 'Cliente',
        recentMessages: recentMessages.reverse(), // Ordenar cronológicamente
        contactInfo: contact[0],
        leadInfo: lead[0]
      };

    } catch (error) {
      console.error('Error obteniendo contexto:', error);
      return {
        chatId,
        contactName: 'Cliente',
        recentMessages: []
      };
    }
  }

  private async generateAIResponse(userMessage: string, context: ChatContext, config: AIResponseConfig): Promise<string | null> {
    try {
      // Construir historial de conversación para contexto
      const conversationHistory = context.recentMessages
        .slice(-5) // Últimos 5 mensajes
        .map(msg => `${msg.fromMe ? 'Asistente' : context.contactName}: ${msg.body}`)
        .join('\n');

      const systemPrompt = `${config.prompt}

INFORMACIÓN DEL CLIENTE:
- Nombre: ${context.contactName}
- Chat ID: ${context.chatId}
${context.contactInfo ? `- Teléfono: ${context.contactInfo.phone || 'No disponible'}` : ''}
${context.leadInfo ? `- Estado de lead: ${context.leadInfo.status}` : ''}

HISTORIAL RECIENTE:
${conversationHistory}

MENSAJE ACTUAL DEL CLIENTE: ${userMessage}

INSTRUCCIONES:
1. Analiza el mensaje y el contexto
2. Responde de manera natural y útil
3. Máximo ${config.maxResponseLength} caracteres
4. Si detectas una oportunidad de venta, menciona sutilmente cómo podemos ayudar
5. Si el cliente necesita soporte técnico específico, deriva a un asesor humano`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userMessage
          }
        ],
        max_tokens: Math.floor(config.maxResponseLength / 2), // Aproximadamente 2 chars por token
        temperature: 0.7,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      const aiResponse = response.choices[0]?.message?.content?.trim();
      
      if (aiResponse && aiResponse.length > 10) {
        console.log(`🤖 Respuesta AI generada para ${context.contactName}: ${aiResponse.substring(0, 50)}...`);
        return aiResponse;
      }

      return null;

    } catch (error) {
      console.error('❌ Error generando respuesta AI:', error);
      return null;
    }
  }

  private async sendAIResponse(chatId: string, response: string, accountId: number): Promise<void> {
    try {
      // Guardar mensaje AI en base de datos
      await db.insert(messages).values({
        chatId,
        body: response,
        fromMe: true,
        timestamp: Math.floor(Date.now() / 1000),
        whatsappAccountId: accountId,
        messageType: 'text',
        status: 'sent'
      });

      // Enviar notificación de respuesta AI enviada
      notificationService.sendNotification(
        'Respuesta AI Enviada',
        `Respuesta automática enviada en chat ${chatId}`,
        { chatId, response: response.substring(0, 100), type: 'ai_response' }
      );

      console.log(`✅ Respuesta AI enviada a chat ${chatId}`);

    } catch (error) {
      console.error('❌ Error enviando respuesta AI:', error);
    }
  }

  // Método para actualizar configuración de una cuenta
  async updateConfig(accountId: number, newConfig: Partial<AIResponseConfig>): Promise<void> {
    const currentConfig = this.responseConfigs.get(accountId);
    if (currentConfig) {
      this.responseConfigs.set(accountId, { ...currentConfig, ...newConfig });
      console.log(`🤖 Configuración AI actualizada para cuenta ${accountId}`);
    }
  }

  // Método para habilitar/deshabilitar respuestas AI
  async toggleEnabled(accountId: number, enabled: boolean): Promise<void> {
    const config = this.responseConfigs.get(accountId);
    if (config) {
      config.enabled = enabled;
      console.log(`🤖 Respuestas AI ${enabled ? 'habilitadas' : 'deshabilitadas'} para cuenta ${accountId}`);
    }
  }

  // Obtener estadísticas del sistema
  getStats(): any {
    return {
      initialized: this.isInitialized,
      activeConfigs: this.responseConfigs.size,
      processingQueue: this.processingQueue.size,
      configs: Array.from(this.responseConfigs.entries()).map(([accountId, config]) => ({
        accountId,
        enabled: config.enabled,
        language: config.language
      }))
    };
  }
}

// Instancia singleton del servicio
export const aiResponseService = new AIAutonomousResponseService();