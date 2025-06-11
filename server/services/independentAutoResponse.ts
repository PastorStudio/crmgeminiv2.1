/**
 * Sistema completamente independiente de respuestas automáticas
 * Funciona sin ninguna dependencia del frontend
 */

import { db } from '../db';
import { whatsappAccounts, whatsappMessages, externalAgents } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import OpenAI from 'openai';
import { chatgptPlusDirectService } from './chatgptPlusDirectService';

interface IndependentConfig {
  accountId: number;
  enabled: boolean;
  agentName: string;
  lastProcessed: Date;
}

class IndependentAutoResponseService {
  private configs = new Map<number, IndependentConfig>();
  private processingInterval?: NodeJS.Timeout;
  private isRunning = false;
  private openai: OpenAI;

  constructor() {
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Inicializa el servicio completamente independiente
   */
  async initialize(): Promise<void> {
    if (this.isRunning) {
      console.log('🤖 Sistema independiente ya está funcionando');
      return;
    }

    console.log('🚀 Iniciando sistema de respuestas automáticas INDEPENDIENTE...');
    
    try {
      // Cargar configuraciones desde la base de datos
      await this.loadConfigurations();
      
      // Iniciar procesamiento continuo
      this.startContinuousProcessing();
      
      this.isRunning = true;
      console.log('✅ Sistema independiente iniciado correctamente');
    } catch (error) {
      console.error('❌ Error inicializando sistema independiente:', error);
      throw error;
    }
  }

  /**
   * Carga configuraciones desde la base de datos
   */
  private async loadConfigurations(): Promise<void> {
    try {
      console.log('🔄 Cargando configuraciones de respuestas automáticas...');
      
      const accounts = await db
        .select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.autoResponseEnabled, true));

      for (const account of accounts) {
        this.configs.set(account.id, {
          accountId: account.id,
          enabled: true,
          agentName: account.assignedExternalAgentId ? 'AI Assistant' : 'Smart Bot',
          lastProcessed: new Date()
        });
      }

      console.log(`📊 Configuraciones cargadas para ${this.configs.size} cuentas`);
    } catch (error) {
      console.error('❌ Error cargando configuraciones:', error);
    }
  }

  /**
   * Inicia procesamiento continuo cada 10 segundos
   */
  private startContinuousProcessing(): void {
    console.log('⏰ Iniciando procesamiento continuo cada 10 segundos...');
    
    this.processingInterval = setInterval(async () => {
      await this.processNewMessages();
    }, 10000); // Cada 10 segundos
  }

  /**
   * Procesa mensajes nuevos de forma independiente
   */
  private async processNewMessages(): Promise<void> {
    if (this.configs.size === 0) {
      return;
    }

    try {
      for (const [accountId, config] of this.configs) {
        if (!config.enabled) continue;

        // Buscar mensajes nuevos desde la última vez procesada
        const newMessages = await db
          .select()
          .from(whatsappMessages)
          .where(
            and(
              eq(whatsappMessages.accountId, accountId),
              eq(whatsappMessages.from_me, false)
            )
          )
          .orderBy(desc(whatsappMessages.timestamp))
          .limit(5);

        for (const message of newMessages) {
          await this.processMessage(accountId, message);
        }

        // Actualizar última vez procesada
        config.lastProcessed = new Date();
      }
    } catch (error) {
      console.error('❌ Error procesando mensajes nuevos:', error);
    }
  }

  /**
   * Procesa un mensaje individual
   */
  private async processMessage(accountId: number, message: any): Promise<void> {
    try {
      const config = this.configs.get(accountId);
      if (!config) return;

      console.log(`🤖 Procesando mensaje independiente - Cuenta: ${accountId}, Chat: ${message.chatId}`);

      // Generar respuesta usando IA
      const response = await this.generateAIResponse(message.content, config.agentName);
      
      if (response) {
        // Simular envío de respuesta (aquí se conectaría con WhatsApp real)
        console.log(`📤 Respuesta generada para ${message.chatId}: "${response.substring(0, 50)}..."`);
        
        // Guardar la respuesta en la base de datos
        await this.saveResponse(accountId, message.chatId, response);
      }
    } catch (error) {
      console.error('❌ Error procesando mensaje individual:', error);
    }
  }

  /**
   * Genera respuesta usando el proveedor de IA configurado
   */
  private async generateAIResponse(messageText: string, agentName: string): Promise<string | null> {
    try {
      console.log(`🤖 Generando respuesta con proveedor de IA para agente: ${agentName}`);
      
      // Import AI provider service
      const { aiProviderService } = await import('./aiProviderService');
      
      // Generate response using configured provider
      const response = await aiProviderService.generateResponse(messageText, agentName);
      
      if (response && response.trim().length > 0) {
        console.log(`✅ Respuesta generada exitosamente: ${response.substring(0, 50)}...`);
        return response;
      }
      
      console.log('⚠️ No se generó respuesta, usando respuesta por defecto');
      return 'Gracias por tu mensaje. Te responderemos pronto.';
      
    } catch (error) {
      console.error('❌ Error generando respuesta con IA:', error);
      
      // Check if error is related to billing/quota
      if (error.message && (error.message.includes('quota') || error.message.includes('billing'))) {
        console.log('💳 Error de cuota/facturación detectado');
      }
      
      // Fallback to simple response instead of failing
      const fallbackResponses = [
        'Gracias por contactarnos. Tu mensaje es importante para nosotros.',
        'Hemos recibido tu mensaje y te responderemos pronto.',
        'Estamos aquí para ayudarte. Un representante se pondrá en contacto contigo.',
        'Tu consulta ha sido recibida. Te responderemos en breve.',
        'Apreciamos tu contacto. Te responderemos lo antes posible.',
        'Hemos recibido tu mensaje y te atenderemos a la brevedad.',
        'Tu consulta es importante para nosotros. Te atenderemos pronto.',
        'Gracias por contactarnos. Un representante se pondrá en contacto contigo.'
      ];
      
      const randomResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
      console.log(`🔄 Usando respuesta de respaldo: ${randomResponse}`);
      return randomResponse;
    }
  }

  /**
   * Guarda la respuesta en la base de datos
   */
  private async saveResponse(accountId: number, chatId: string, response: string): Promise<void> {
    try {
      await db.insert(whatsappMessages).values({
        accountId,
        chatId,
        messageId: `auto_${Date.now()}`,
        content: response,
        from_me: true,
        timestamp: new Date(),
        hasMedia: false
      });
    } catch (error) {
      console.error('❌ Error guardando respuesta:', error);
    }
  }

  /**
   * Habilita respuestas automáticas para una cuenta
   */
  async enableForAccount(accountId: number, agentName: string = 'AI Assistant'): Promise<void> {
    console.log(`🟢 Habilitando respuestas independientes para cuenta ${accountId}`);
    
    this.configs.set(accountId, {
      accountId,
      enabled: true,
      agentName,
      lastProcessed: new Date()
    });

    // Actualizar en base de datos
    await db
      .update(whatsappAccounts)
      .set({ autoResponseEnabled: true })
      .where(eq(whatsappAccounts.id, accountId));
  }

  /**
   * Deshabilita respuestas automáticas para una cuenta
   */
  async disableForAccount(accountId: number): Promise<void> {
    console.log(`🔴 Deshabilitando respuestas independientes para cuenta ${accountId}`);
    
    this.configs.delete(accountId);

    // Actualizar en base de datos
    await db
      .update(whatsappAccounts)
      .set({ autoResponseEnabled: false })
      .where(eq(whatsappAccounts.id, accountId));
  }

  /**
   * Obtiene estado del sistema
   */
  getStatus(): any {
    return {
      isRunning: this.isRunning,
      activeAccounts: Array.from(this.configs.keys()),
      totalConfigs: this.configs.size,
      lastCheck: new Date().toISOString()
    };
  }

  /**
   * Detiene el sistema
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
    
    this.isRunning = false;
    console.log('🛑 Sistema independiente detenido');
  }
}

// Exportar instancia única
export const independentAutoResponseService = new IndependentAutoResponseService();