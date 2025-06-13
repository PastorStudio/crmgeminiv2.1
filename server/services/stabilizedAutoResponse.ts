/**
 * Sistema estabilizado de respuestas automáticas
 * Soluciona desconexiones y agotamiento de cuota AI
 */

import { db } from '../db';
import { whatsappAccounts, whatsappMessages, externalAgents } from '@shared/schema';
import { eq, and, desc, gt } from 'drizzle-orm';
import OpenAI from 'openai';

interface StableConfig {
  accountId: number;
  enabled: boolean;
  agentName: string;
  lastProcessed: Date;
}

class StabilizedAutoResponseService {
  private configs = new Map<number, StableConfig>();
  private processingInterval?: NodeJS.Timeout;
  private isRunning = false;
  private openai: OpenAI;
  private processedMessages = new Set<string>();
  private geminiQuotaExhausted = false;
  private lastQuotaCheck = new Date();
  private requestCount = 0;
  private dailyLimit = 400; // Límite seguro para Gemini

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async initialize(): Promise<void> {
    if (this.isRunning) {
      console.log('🔒 Sistema estabilizado ya está funcionando');
      return;
    }

    console.log('🚀 Inicializando sistema estabilizado de respuestas automáticas...');
    
    try {
      await this.loadConfigurations();
      this.startIntelligentProcessing();
      this.isRunning = true;
      console.log('✅ Sistema estabilizado iniciado correctamente');
    } catch (error) {
      console.error('❌ Error inicializando sistema estabilizado:', error);
    }
  }

  private async loadConfigurations(): Promise<void> {
    try {
      const accounts = await db
        .select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.status, 'connected'));

      this.configs.clear();
      
      for (const account of accounts) {
        this.configs.set(account.id, {
          accountId: account.id,
          enabled: true,
          agentName: account.name || 'AI Assistant',
          lastProcessed: new Date(Date.now() - 10 * 60 * 1000) // 10 minutos atrás
        });
      }

      console.log(`📋 Configuraciones cargadas para ${this.configs.size} cuentas estables`);
    } catch (error) {
      console.error('❌ Error cargando configuraciones estables:', error);
    }
  }

  private startIntelligentProcessing(): void {
    console.log('⚡ Iniciando procesamiento inteligente estabilizado...');
    
    this.processingInterval = setInterval(async () => {
      // Reset contador diario
      const now = new Date();
      if (now.getHours() === 0 && this.requestCount > 0) {
        this.requestCount = 0;
        this.geminiQuotaExhausted = false;
        console.log('🔄 Contador diario reseteado');
      }

      // Verificar si hemos excedido el límite diario
      if (this.requestCount >= this.dailyLimit) {
        this.geminiQuotaExhausted = true;
        console.log('🚨 Límite diario preventivo alcanzado, usando proveedores alternativos');
      }

      await this.processRecentMessages();
    }, 45000); // 45 segundos para estabilidad
  }

  private async processRecentMessages(): Promise<void> {
    if (this.configs.size === 0) {
      return;
    }

    try {
      for (const [accountId, config] of this.configs) {
        if (!config.enabled) continue;

        // Buscar solo mensajes muy recientes
        const recentMessages = await db
          .select()
          .from(whatsappMessages)
          .where(
            and(
              eq(whatsappMessages.accountId, accountId),
              eq(whatsappMessages.from_me, false),
              gt(whatsappMessages.timestamp, config.lastProcessed)
            )
          )
          .orderBy(desc(whatsappMessages.timestamp))
          .limit(1); // Solo 1 mensaje por cuenta para evitar spam

        for (const message of recentMessages) {
          const messageKey = `${accountId}-${message.id}`;
          
          // Verificar si ya fue procesado
          if (!this.processedMessages.has(messageKey)) {
            const processed = await this.processStableMessage(accountId, message);
            if (processed) {
              this.processedMessages.add(messageKey);
              config.lastProcessed = new Date();
              
              // Limpiar cache cada 100 mensajes
              if (this.processedMessages.size > 100) {
                this.processedMessages.clear();
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Error en procesamiento estable:', error);
    }
  }

  private async processStableMessage(accountId: number, message: any): Promise<boolean> {
    try {
      const config = this.configs.get(accountId);
      if (!config) return false;

      // Verificar si es solicitud de demo
      const isDemoRequest = this.detectDemoRequest(message.body);
      if (isDemoRequest) {
        console.log('🎭 Demo detectado, procesando...');
        await this.handleDemoRequest(message.chatId);
        return true;
      }

      // Generar respuesta AI con sistema estable
      const aiResponse = await this.generateStableAIResponse(message.body, config.agentName);
      
      // Guardar respuesta en base de datos
      await this.saveStableResponse(accountId, message.chatId, aiResponse);
      
      console.log(`📤 Respuesta estable para ${message.chatId}: "${aiResponse.substring(0, 50)}..."`);
      
      return true;

    } catch (error) {
      console.error('❌ Error procesando mensaje estable:', error);
      return false;
    }
  }

  private async generateStableAIResponse(messageText: string, agentName: string): Promise<string> {
    try {
      // Si Gemini está agotado, usar alternativas directamente
      if (this.geminiQuotaExhausted) {
        return await this.generateWithAlternativeProvider(messageText, agentName);
      }

      // Intentar con Gemini con control de cuota
      if (this.requestCount < this.dailyLimit) {
        return await this.generateWithGeminiSafe(messageText, agentName);
      } else {
        return await this.generateWithAlternativeProvider(messageText, agentName);
      }

    } catch (error) {
      console.error('❌ Error generando respuesta estable:', error);
      return this.getStableFallbackResponse();
    }
  }

  private async generateWithGeminiSafe(messageText: string, agentName: string): Promise<string> {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const prompt = `Eres ${agentName}, un asistente de atención al cliente profesional.
      
Responde al mensaje: "${messageText}"

Instrucciones:
- Respuesta en español
- Máximo 100 palabras
- Tono amable y profesional`;

      this.requestCount++;
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      if (text && text.trim().length > 0) {
        console.log(`✅ Respuesta Gemini estable generada (${this.requestCount}/${this.dailyLimit})`);
        return text.trim();
      }
      
      throw new Error('Respuesta vacía de Gemini');
      
    } catch (error) {
      console.error('❌ Error Gemini estable:', error);
      
      // Detectar error de cuota
      if (error.message && (error.message.includes('429') || error.message.includes('quota'))) {
        this.geminiQuotaExhausted = true;
        console.log('🚨 Cuota Gemini agotada, cambiando a alternativas');
        return await this.generateWithAlternativeProvider(messageText, agentName);
      }
      
      return this.getStableFallbackResponse();
    }
  }

  private async generateWithAlternativeProvider(messageText: string, agentName: string): Promise<string> {
    try {
      // Intentar OpenAI primero
      if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
        console.log('🔄 Usando OpenAI estable...');
        
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `Eres ${agentName}, asistente de atención al cliente profesional en español.`
            },
            {
              role: 'user',
              content: messageText
            }
          ],
          max_tokens: 100,
          temperature: 0.7
        });

        const response = completion.choices[0]?.message?.content;
        if (response && response.trim().length > 0) {
          console.log('✅ Respuesta OpenAI estable generada');
          return response.trim();
        }
      }

      // Intentar DeepSeek
      if (process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY !== 'your_deepseek_api_key_here') {
        console.log('🔄 Usando DeepSeek estable...');
        return await this.generateWithDeepSeekSafe(messageText, agentName);
      }

      return this.getStableFallbackResponse();
      
    } catch (error) {
      console.error('❌ Error proveedor alternativo estable:', error);
      return this.getStableFallbackResponse();
    }
  }

  private async generateWithDeepSeekSafe(messageText: string, agentName: string): Promise<string> {
    try {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: `Eres ${agentName}, asistente profesional en español. Responde en máximo 80 palabras.`
            },
            {
              role: 'user',
              content: messageText
            }
          ],
          max_tokens: 100,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`);
      }

      const data = await response.json();
      const result = data.choices[0]?.message?.content;
      
      if (result && result.trim().length > 0) {
        console.log('✅ Respuesta DeepSeek estable generada');
        return result.trim();
      }
      
      return this.getStableFallbackResponse();
      
    } catch (error) {
      console.error('❌ Error DeepSeek estable:', error);
      return this.getStableFallbackResponse();
    }
  }

  private detectDemoRequest(message: string): boolean {
    const demoKeywords = ['demo', 'prueba', 'demostración', 'test', 'probar', 'ejemplo'];
    const lowerMessage = message.toLowerCase();
    return demoKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  private async handleDemoRequest(chatId: string): Promise<void> {
    try {
      // Lógica simplificada de demo
      console.log(`🎭 Procesando solicitud de demo para ${chatId}`);
      // Aquí iría la lógica de creación de demo
    } catch (error) {
      console.error('❌ Error manejando demo:', error);
    }
  }

  private async saveStableResponse(accountId: number, chatId: string, response: string): Promise<void> {
    try {
      const { whatsappMessages } = await import('@shared/schema');
      
      await db.insert(whatsappMessages).values({
        chatId,
        messageId: `stable-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        from_me: true,
        body: response,
        timestamp: new Date(),
        accountId
      });
      
      console.log(`✅ Respuesta estable guardada en BD para chat ${chatId}`);
    } catch (error) {
      console.error('❌ Error guardando respuesta estable:', error);
    }
  }

  private getStableFallbackResponse(): string {
    const responses = [
      'Gracias por contactarnos. Te atenderemos pronto.',
      'Hemos recibido tu mensaje. Un agente te responderá.',
      'Tu consulta es importante. Te contactaremos en breve.',
      'Mensaje recibido. Te responderemos a la brevedad.',
      'Estamos aquí para ayudarte. Responderemos pronto.'
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  public async stop(): Promise<void> {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
    this.isRunning = false;
    console.log('🛑 Sistema estabilizado detenido');
  }

  public getStatus(): object {
    return {
      isRunning: this.isRunning,
      accountsCount: this.configs.size,
      processedMessages: this.processedMessages.size,
      geminiQuotaExhausted: this.geminiQuotaExhausted,
      requestCount: this.requestCount,
      dailyLimit: this.dailyLimit
    };
  }
}

// Exportar instancia única
export const stabilizedAutoResponse = new StabilizedAutoResponseService();