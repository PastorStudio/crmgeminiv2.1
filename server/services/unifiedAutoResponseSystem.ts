
/**
 * Sistema Unificado de Respuestas Automáticas
 * Un solo sistema que maneja todas las respuestas automáticas con prompts y historial
 */

import OpenAI from 'openai';
import { db } from '../db';
import { whatsappAccounts, aiPrompts, whatsappMessages, conversations } from '../../shared/schema';
import { eq, desc, and } from 'drizzle-orm';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY
});

interface ConversationContext {
  messageCount: number;
  lastBotResponse: string | null;
  recentMessages: Array<{
    content: string;
    from_me: boolean;
    timestamp: Date;
  }>;
}

interface AutoResponseConfig {
  accountId: number;
  promptId: number;
  promptContent: string;
  enabled: boolean;
  temperature: number;
  maxTokens: number;
}

class UnifiedAutoResponseSystem {
  private activeConfigs = new Map<number, AutoResponseConfig>();
  private conversationContexts = new Map<string, ConversationContext>();

  /**
   * Inicializar el sistema cargando configuraciones activas
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Inicializando Sistema Unificado de Respuestas Automáticas...');
      
      await this.loadActiveConfigurations();
      
      console.log(`✅ Sistema inicializado con ${this.activeConfigs.size} cuentas configuradas`);
    } catch (error) {
      console.error('❌ Error inicializando sistema unificado:', error);
    }
  }

  /**
   * Cargar configuraciones activas desde la base de datos
   */
  private async loadActiveConfigurations(): Promise<void> {
    try {
      const accounts = await db.select({
        accountId: whatsappAccounts.id,
        promptId: whatsappAccounts.assignedPromptId,
        autoResponseEnabled: whatsappAccounts.autoResponseEnabled
      })
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.autoResponseEnabled, true));

      this.activeConfigs.clear();

      for (const account of accounts) {
        if (account.promptId) {
          const prompt = await db.select()
            .from(aiPrompts)
            .where(eq(aiPrompts.id, account.promptId))
            .limit(1);

          if (prompt.length > 0 && prompt[0].isActive) {
            const config: AutoResponseConfig = {
              accountId: account.accountId,
              promptId: account.promptId,
              promptContent: prompt[0].content,
              enabled: account.autoResponseEnabled || false,
              temperature: prompt[0].temperature || 0.7,
              maxTokens: prompt[0].maxTokens || 150
            };

            this.activeConfigs.set(account.accountId, config);
            console.log(`✅ Configuración cargada para cuenta ${account.accountId} con prompt ${account.promptId}`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error cargando configuraciones:', error);
    }
  }

  /**
   * Procesar mensaje entrante y generar respuesta automática
   */
  async processMessage(
    accountId: number,
    chatId: string,
    messageContent: string,
    fromMe: boolean,
    contactName?: string
  ): Promise<string | null> {
    try {
      // Solo procesar mensajes de usuarios (no nuestros)
      if (fromMe) {
        return null;
      }

      // Verificar si la cuenta tiene configuración activa
      const config = this.activeConfigs.get(accountId);
      if (!config || !config.enabled) {
        return null;
      }

      console.log(`🤖 Procesando mensaje para cuenta ${accountId} en chat ${chatId}`);

      // Obtener contexto de conversación
      const context = await this.getConversationContext(chatId);
      
      // Generar respuesta usando prompt asignado y contexto
      const response = await this.generateContextualResponse(
        config,
        messageContent,
        context,
        contactName || 'Cliente'
      );

      if (response) {
        // Actualizar contexto de conversación
        await this.updateConversationContext(chatId, messageContent, response);
        
        console.log(`✅ Respuesta generada: "${response}"`);
        return response;
      }

      return null;
    } catch (error) {
      console.error('❌ Error procesando mensaje:', error);
      return null;
    }
  }

  /**
   * Obtener contexto de conversación desde la base de datos
   */
  private async getConversationContext(chatId: string): Promise<ConversationContext> {
    try {
      // Obtener mensajes recientes de la conversación
      const recentMessages = await db.select({
        content: whatsappMessages.content,
        from_me: whatsappMessages.fromMe,
        timestamp: whatsappMessages.timestamp
      })
      .from(whatsappMessages)
      .where(eq(whatsappMessages.chatId, chatId))
      .orderBy(desc(whatsappMessages.timestamp))
      .limit(10);

      const messageCount = recentMessages.length;
      const lastBotMessage = recentMessages.find(msg => msg.from_me);

      return {
        messageCount,
        lastBotResponse: lastBotMessage?.content || null,
        recentMessages: recentMessages.map(msg => ({
          content: msg.content,
          from_me: msg.from_me,
          timestamp: new Date(msg.timestamp)
        }))
      };
    } catch (error) {
      console.error('❌ Error obteniendo contexto:', error);
      return {
        messageCount: 0,
        lastBotResponse: null,
        recentMessages: []
      };
    }
  }

  /**
   * Generar respuesta contextual usando OpenAI
   */
  private async generateContextualResponse(
    config: AutoResponseConfig,
    userMessage: string,
    context: ConversationContext,
    contactName: string
  ): Promise<string | null> {
    try {
      // Construir historial de conversación
      let conversationHistory = '';
      if (context.recentMessages.length > 0) {
        conversationHistory = context.recentMessages
          .reverse() // Orden cronológico
          .map(msg => `${msg.from_me ? 'Tú' : contactName}: ${msg.content}`)
          .join('\n');
      }

      // Construir prompt contextual
      const systemPrompt = `${config.promptContent}

CONTEXTO DE LA CONVERSACIÓN:
- Nombre del contacto: ${contactName}
- Número de mensajes en la conversación: ${context.messageCount}
- Es una conversación nueva: ${context.messageCount <= 1 ? 'SÍ' : 'NO'}

${conversationHistory ? `HISTORIAL RECIENTE:
${conversationHistory}` : 'Esta es la primera interacción con este contacto.'}

INSTRUCCIONES IMPORTANTES:
- Responde de forma natural y conversacional
- Considera el contexto de la conversación anterior
- NO repitas saludos si ya se ha saludado antes
- Mantén coherencia con mensajes anteriores
- Responde específicamente al último mensaje del usuario
- Sé conciso pero útil (máximo 2-3 líneas)

MENSAJE ACTUAL DEL USUARIO: "${userMessage}"

Responde de manera apropiada basándote en el contexto y el prompt asignado.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        max_tokens: config.maxTokens,
        temperature: config.temperature
      });

      const response = completion.choices[0]?.message?.content?.trim();
      
      if (response) {
        // Limpiar respuesta de patrones no deseados
        return this.cleanResponse(response);
      }

      return null;
    } catch (error) {
      console.error('❌ Error generando respuesta:', error);
      return "Gracias por tu mensaje. Te responderemos a la brevedad.";
    }
  }

  /**
   * Limpiar respuesta de patrones formales no deseados
   */
  private cleanResponse(response: string): string {
    const forbiddenPatterns = [
      /Gracias por escribirnos,?\s*[^.]*\./gi,
      /Le saluda\s+[^,]+,\s*agente\s+del\s+[^.]*\./gi,
      /Departamento de [^.]*\./gi,
      /Sistema Municipal/gi,
      /Misael Moreno Frias/gi,
      /Enrique,?\s*agente/gi
    ];

    let cleanedResponse = response;
    
    forbiddenPatterns.forEach(pattern => {
      cleanedResponse = cleanedResponse.replace(pattern, '');
    });

    cleanedResponse = cleanedResponse.replace(/\s+/g, ' ').trim();

    if (cleanedResponse.length < 10) {
      const alternatives = [
        '¡Hola! ¿En qué te puedo ayudar?',
        '¿Qué tal? ¿Cómo puedo asistirte?',
        '¡Hey! Cuéntame, ¿qué necesitas?'
      ];
      return alternatives[Math.floor(Math.random() * alternatives.length)];
    }

    return cleanedResponse;
  }

  /**
   * Actualizar contexto de conversación
   */
  private async updateConversationContext(
    chatId: string,
    userMessage: string,
    botResponse: string
  ): Promise<void> {
    try {
      // Actualizar cache local
      const existingContext = this.conversationContexts.get(chatId);
      const newContext: ConversationContext = {
        messageCount: (existingContext?.messageCount || 0) + 2, // +2 por mensaje usuario y respuesta bot
        lastBotResponse: botResponse,
        recentMessages: [
          ...(existingContext?.recentMessages || []).slice(-8), // Mantener solo los últimos 8
          {
            content: userMessage,
            from_me: false,
            timestamp: new Date()
          },
          {
            content: botResponse,
            from_me: true,
            timestamp: new Date()
          }
        ]
      };

      this.conversationContexts.set(chatId, newContext);
    } catch (error) {
      console.error('❌ Error actualizando contexto:', error);
    }
  }

  /**
   * Verificar si una cuenta tiene respuestas automáticas activas
   */
  isAutoResponseActive(accountId: number): boolean {
    const config = this.activeConfigs.get(accountId);
    return config?.enabled || false;
  }

  /**
   * Activar/desactivar respuestas automáticas para una cuenta
   */
  async setAutoResponseStatus(accountId: number, enabled: boolean): Promise<boolean> {
    try {
      await db.update(whatsappAccounts)
        .set({ autoResponseEnabled: enabled })
        .where(eq(whatsappAccounts.id, accountId));

      if (enabled) {
        await this.loadActiveConfigurations();
      } else {
        this.activeConfigs.delete(accountId);
      }

      console.log(`✅ Estado de respuestas automáticas ${enabled ? 'activado' : 'desactivado'} para cuenta ${accountId}`);
      return true;
    } catch (error) {
      console.error('❌ Error cambiando estado:', error);
      return false;
    }
  }

  /**
   * Obtener estadísticas del sistema
   */
  getSystemStats() {
    return {
      activeAccounts: this.activeConfigs.size,
      totalConversations: this.conversationContexts.size,
      configurations: Array.from(this.activeConfigs.values())
    };
  }
}

// Exportar instancia singleton
export const unifiedAutoResponseSystem = new UnifiedAutoResponseSystem();

// Inicializar automáticamente
unifiedAutoResponseSystem.initialize().catch(error => {
  console.error('❌ Error inicializando sistema unificado:', error);
});

export default unifiedAutoResponseSystem;
