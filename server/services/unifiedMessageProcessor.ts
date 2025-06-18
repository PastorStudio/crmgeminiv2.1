/**
 * Procesador Unificado de Mensajes
 * Sistema centralizado que garantiza que los prompts asignados tengan prioridad absoluta
 * sobre cualquier otro sistema de respuestas automáticas
 */

import { db } from '../db';
import { interventionManager } from './interventionManager';

interface MessageContext {
  chatId: string;
  accountId: number;
  userId?: number;
  from: string;
  body: string;
  contactName?: string;
  fromMe: boolean;
}

interface ProcessingResult {
  success: boolean;
  response?: string;
  agentName?: string;
  source: 'prompt' | 'ai' | 'none';
}

class UnifiedMessageProcessor {
  private static instance: UnifiedMessageProcessor;
  private promptConfigs: Map<number, any> = new Map();
  private initialized = false;

  static getInstance(): UnifiedMessageProcessor {
    if (!UnifiedMessageProcessor.instance) {
      UnifiedMessageProcessor.instance = new UnifiedMessageProcessor();
    }
    return UnifiedMessageProcessor.instance;
  }

  /**
   * Inicializar el procesador y cargar configuraciones de prompts
   */
  async initialize(): Promise<void> {
    try {
      console.log('🎯 Inicializando procesador unificado de mensajes...');
      await this.loadPromptConfigurations();
      this.initialized = true;
      console.log('✅ Procesador unificado inicializado correctamente');
    } catch (error) {
      console.error('❌ Error inicializando procesador unificado:', error);
    }
  }

  /**
   * Cargar configuraciones de prompts desde la base de datos
   */
  private async loadPromptConfigurations(): Promise<void> {
    try {
      const result = await pool.query(`
        SELECT wa.id, wa.name, wa.autoresponseenabled, wa.assigned_prompt_id, wa.customprompt, wa.target_language,
               ap.name as prompt_name, ap.content as prompt_content, ap.provider, ap.temperature
        FROM whatsapp_accounts wa
        LEFT JOIN ai_prompts ap ON wa.assigned_prompt_id = ap.id
        WHERE wa.autoresponseenabled = true AND wa.assigned_prompt_id IS NOT NULL
      `);

      this.promptConfigs.clear();

      for (const row of result.rows) {
        if (row.prompt_content) {
          this.promptConfigs.set(row.id, {
            accountId: row.id,
            accountName: row.name,
            promptId: row.assigned_prompt_id,
            promptName: row.prompt_name,
            promptContent: row.prompt_content,
            customPrompt: row.customprompt,
            targetLanguage: row.target_language || 'es',
            provider: row.provider || 'openai',
            temperature: row.temperature || 0.7
          });
          
          console.log(`🎯 Cuenta ${row.id} (${row.name}) configurada con prompt "${row.prompt_name}"`);
        }
      }

      console.log(`📊 Total configuraciones de prompt cargadas: ${this.promptConfigs.size}`);
    } catch (error) {
      console.error('❌ Error cargando configuraciones de prompts:', error);
    }
  }

  /**
   * Procesar mensaje entrante con prioridad absoluta para prompts
   */
  async processMessage(context: MessageContext): Promise<ProcessingResult> {
    try {
      // Obtener userId si no está proporcionado
      if (!context.userId) {
        const userQuery = await pool.query(
          'SELECT user_id FROM whatsapp_accounts WHERE id = $1',
          [context.accountId]
        );
        if (userQuery.rows.length > 0) {
          context.userId = userQuery.rows[0].user_id;
        }
      }

      // Si es mensaje manual (fromMe = true), registrar intervención
      if (context.fromMe && context.userId) {
        await interventionManager.registerIntervention({
          userId: context.userId,
          accountId: context.accountId,
          chatId: context.chatId,
          fromMe: context.fromMe,
          timestamp: new Date()
        });
        console.log(`🔒 Intervención manual registrada - Chat ${context.chatId} pausado por 30 minutos`);
        return { success: false, source: 'none' };
      }

      // Verificar si hay intervención activa para este chat
      if (context.userId) {
        const isInterventionActive = await interventionManager.isInterventionActive(
          context.userId,
          context.accountId,
          context.chatId
        );

        if (isInterventionActive) {
          const interventionInfo = await interventionManager.getInterventionInfo(
            context.userId,
            context.accountId,
            context.chatId
          );
          
          if (interventionInfo) {
            const remainingTime = Math.ceil((interventionInfo.pauseUntil.getTime() - new Date().getTime()) / (1000 * 60));
            console.log(`🔒 Chat ${context.chatId} en pausa por intervención - ${remainingTime} minutos restantes`);
            return { success: false, source: 'none' };
          }
        }
      }

      console.log(`📨 Procesando mensaje en cuenta ${context.accountId}: "${context.body.substring(0, 50)}..."`);

      // Asignar chat automáticamente si es un mensaje entrante
      if (!context.fromMe && context.chatId) {
        await this.assignChatAutomatically(context.chatId, context.accountId, context.contactName);
      }

      // PRIORIDAD 1: Verificar si hay prompt asignado
      if (this.promptConfigs.has(context.accountId)) {
        console.log(`🎯 PROMPT DETECTADO para cuenta ${context.accountId} - procesando con prompt`);
        return await this.processWithPrompt(context);
      }

      // PRIORIDAD 2: Verificar si tiene respuestas automáticas habilitadas (sin prompt)
      const accountCheck = await pool.query(
        'SELECT autoresponseenabled FROM whatsapp_accounts WHERE id = $1',
        [context.accountId]
      );

      if (accountCheck.rows.length > 0 && accountCheck.rows[0].autoresponseenabled) {
        console.log(`🤖 Sin prompt asignado para cuenta ${context.accountId} - usando IA genérica`);
        return await this.processWithGenericAI(context);
      }

      console.log(`⏭️ Cuenta ${context.accountId} no tiene respuestas automáticas habilitadas`);
      return { success: false, source: 'none' };

    } catch (error) {
      console.error('❌ Error procesando mensaje:', error);
      return { success: false, source: 'none' };
    }
  }

  /**
   * Procesar mensaje usando prompt asignado
   */
  private async processWithPrompt(context: MessageContext): Promise<ProcessingResult> {
    try {
      const config = this.promptConfigs.get(context.accountId);
      if (!config) {
        return { success: false, source: 'none' };
      }

      console.log(`🎯 Generando respuesta con prompt "${config.promptName}" para cuenta ${context.accountId}`);

      // Obtener historial de conversación para contexto
      const conversationHistory = await this.getConversationHistory(context.accountId, context.chatId);
      
      // Analizar si es un nuevo contacto o conversación existente
      const isExistingConversation = conversationHistory.length > 0;
      const recentBotMessages = conversationHistory
        .filter(msg => msg.from_me === true)
        .slice(0, 3);
      
      // Detectar si ya se saludó anteriormente
      const hasGreeted = recentBotMessages.some(msg => 
        this.containsGreeting(msg.content)
      );

      // Construir contexto conversacional
      let conversationContext = '';
      if (isExistingConversation) {
        const recentMessages = conversationHistory.slice(0, 5).reverse();
        conversationContext = `
Historial de conversación reciente:
${recentMessages.map(msg => 
  `${msg.from_me ? 'Tú' : context.contactName || 'Cliente'}: ${msg.content}`
).join('\n')}

IMPORTANTE: Esta es una conversación CONTINUA. ${hasGreeted ? 'Ya saludaste anteriormente, NO vuelvas a saludar.' : 'Es el primer contacto, puedes saludar apropiadamente.'} Continúa la conversación de manera natural basándote en el historial.`;
      }

      // Construir prompt completo con contexto
      const systemPrompt = `${config.promptContent}

${config.customPrompt ? `Instrucciones adicionales: ${config.customPrompt}` : ''}

Contexto del contacto:
- Nombre del contacto: ${context.contactName || 'Usuario'}
- Idioma objetivo: ${config.targetLanguage}
- Conversación existente: ${isExistingConversation ? 'SÍ' : 'NO'}
- Ya saludaste antes: ${hasGreeted ? 'SÍ' : 'NO'}

${conversationContext}

REGLAS CRÍTICAS:
1. Si ya existe historial de conversación, NO saludes nuevamente
2. Continúa la conversación de manera natural basándote en el contexto
3. Mantén la coherencia con mensajes anteriores
4. Responde específicamente al último mensaje del usuario
5. Mantén siempre el tono y personalidad definida en el prompt principal`;

      // Llamar a IA (prioridad: Gemini > DeepSeek > OpenAI)
      const response = await this.callWorkingAI(systemPrompt, context.body, config.temperature);

      if (response) {
        // Guardar mensaje en historial
        await this.saveMessageToHistory(context.accountId, context.chatId, context.body, false);
        await this.saveMessageToHistory(context.accountId, context.chatId, response, true);
        
        console.log(`✅ Respuesta generada con prompt "${config.promptName}" (contexto: ${isExistingConversation ? 'continuo' : 'nuevo'}): "${response.substring(0, 50)}..."`);
        return {
          success: true,
          response: response,
          agentName: config.promptName,
          source: 'prompt'
        };
      }

      return { success: false, source: 'prompt' };
    } catch (error) {
      console.error('❌ Error procesando con prompt:', error);
      return { success: false, source: 'prompt' };
    }
  }

  /**
   * Procesar mensaje usando IA genérica
   */
  private async processWithGenericAI(context: MessageContext): Promise<ProcessingResult> {
    try {
      // Obtener historial para contexto conversacional
      const conversationHistory = await this.getConversationHistory(context.accountId, context.chatId);
      const isExistingConversation = conversationHistory.length > 0;
      
      // Verificar si ya se saludó
      const recentBotMessages = conversationHistory
        .filter(msg => msg.from_me === true)
        .slice(0, 3);
      const hasGreeted = recentBotMessages.some(msg => this.containsGreeting(msg.content));

      // Construir contexto conversacional
      let conversationContext = '';
      if (isExistingConversation) {
        const recentMessages = conversationHistory.slice(0, 5).reverse();
        conversationContext = `
Historial de conversación reciente:
${recentMessages.map(msg => 
  `${msg.from_me ? 'Tú' : context.contactName || 'Cliente'}: ${msg.content}`
).join('\n')}

IMPORTANTE: Esta es una conversación CONTINUA. ${hasGreeted ? 'Ya saludaste anteriormente, NO vuelvas a saludar.' : 'Es el primer contacto, puedes saludar apropiadamente.'} Continúa la conversación de manera natural.`;
      }

      const systemPrompt = `Eres un asistente virtual profesional y útil. 
Responde de manera amable y profesional a las consultas de los usuarios.
Mantén las respuestas concisas y relevantes.

Contexto del contacto:
- Nombre del contacto: ${context.contactName || 'Usuario'}
- Conversación existente: ${isExistingConversation ? 'SÍ' : 'NO'}
- Ya saludaste antes: ${hasGreeted ? 'SÍ' : 'NO'}

${conversationContext}

REGLAS CRÍTICAS:
1. Si ya existe historial de conversación, NO saludes nuevamente
2. Continúa la conversación de manera natural basándote en el contexto
3. Responde específicamente al último mensaje del usuario
4. Mantén coherencia con mensajes anteriores`;

      const response = await this.callWorkingAI(systemPrompt, context.body, 0.7);

      if (response) {
        // Guardar mensaje en historial
        await this.saveMessageToHistory(context.accountId, context.chatId, context.body, false);
        await this.saveMessageToHistory(context.accountId, context.chatId, response, true);
        
        console.log(`✅ Respuesta generada con IA genérica (contexto: ${isExistingConversation ? 'continuo' : 'nuevo'}): "${response.substring(0, 50)}..."`);
        return {
          success: true,
          response: response,
          agentName: 'Asistente Virtual',
          source: 'ai'
        };
      }

      return { success: false, source: 'ai' };
    } catch (error) {
      console.error('❌ Error procesando con IA genérica:', error);
      return { success: false, source: 'ai' };
    }
  }

  /**
   * Asignar chat automáticamente usando el servicio de asignación
   */
  private async assignChatAutomatically(chatId: string, accountId: number, contactName?: string): Promise<void> {
    try {
      const { AutomaticAssignmentService } = await import('./automaticAssignmentService');
      const assignmentService = AutomaticAssignmentService.getInstance();
      
      const success = await assignmentService.assignChat(chatId, accountId, contactName);
      
      if (success) {
        console.log(`✅ Chat ${chatId} asignado automáticamente para cuenta ${accountId}`);
      }
      
    } catch (error) {
      console.error('❌ Error en asignación automática:', error);
    }
  }

  /**
   * Llamar a IA con prioridad de servicios funcionales
   */
  private async callWorkingAI(systemPrompt: string, userMessage: string, temperature: number): Promise<string | null> {
    // PRIORIDAD 1: Intentar Gemini (funcional)
    try {
      console.log('🤖 Intentando respuesta con Gemini...');
      const response = await this.callGemini(systemPrompt, userMessage, temperature);
      if (response) {
        console.log('✅ Respuesta generada con Gemini');
        return response;
      }
    } catch (error) {
      console.log('❌ Gemini falló:', error.message);
    }

    // PRIORIDAD 2: Intentar DeepSeek (funcional)
    try {
      console.log('🤖 Intentando respuesta con DeepSeek...');
      const response = await this.callDeepSeek(systemPrompt, userMessage, temperature);
      if (response) {
        console.log('✅ Respuesta generada con DeepSeek');
        return response;
      }
    } catch (error) {
      console.log('❌ DeepSeek falló:', error.message);
    }

    // PRIORIDAD 3: Intentar OpenAI (tiene problemas de cuota)
    try {
      console.log('🤖 Intentando respuesta con OpenAI...');
      const response = await this.callOpenAI(systemPrompt, userMessage, temperature);
      if (response) {
        console.log('✅ Respuesta generada con OpenAI');
        return response;
      }
    } catch (error) {
      console.log('❌ OpenAI falló:', error.message);
    }

    console.log('❌ Todos los servicios de IA fallaron');
    return null;
  }

  /**
   * Llamar a Gemini para generar respuesta
   */
  private async callGemini(systemPrompt: string, userMessage: string, temperature: number): Promise<string | null> {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY no configurada');
      }

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `${systemPrompt}\n\nUsuario: ${userMessage}`;
      const result = await model.generateContent(prompt);
      const response = await result.response;
      
      return response.text() || null;
    } catch (error) {
      console.error('❌ Error llamando a Gemini:', error.message);
      return null;
    }
  }

  /**
   * Llamar a DeepSeek para generar respuesta
   */
  private async callDeepSeek(systemPrompt: string, userMessage: string, temperature: number): Promise<string | null> {
    try {
      const axios = (await import('axios')).default;
      
      if (!process.env.DEEPSEEK_API_KEY) {
        throw new Error('DEEPSEEK_API_KEY no configurada');
      }

      const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 500,
        temperature: temperature
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      return response.data.choices[0]?.message?.content || null;
    } catch (error) {
      console.error('❌ Error llamando a DeepSeek:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Llamar a OpenAI para generar respuesta (respaldo)
   */
  private async callOpenAI(systemPrompt: string, userMessage: string, temperature: number): Promise<string | null> {
    try {
      const OpenAI = (await import('openai')).default;
      
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || 'sk-proj-fake-key'
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        temperature: temperature,
        max_tokens: 500
      });

      return completion.choices[0]?.message?.content || null;
    } catch (error) {
      console.error('❌ Error llamando a OpenAI:', error);
      return null;
    }
  }

  /**
   * Recargar configuraciones de prompts
   */
  async reloadConfigurations(): Promise<void> {
    await this.loadPromptConfigurations();
  }

  /**
   * Verificar si una cuenta tiene prompt asignado
   */
  hasPromptForAccount(accountId: number): boolean {
    return this.promptConfigs.has(accountId);
  }

  /**
   * Obtener información de configuración para una cuenta
   */
  getAccountConfig(accountId: number): any {
    return this.promptConfigs.get(accountId);
  }

  /**
   * Forzar recarga de configuraciones de prompts
   */
  async reloadPromptConfigurations(): Promise<void> {
    console.log('🔄 Forzando recarga de configuraciones de prompts...');
    await this.loadPromptConfigurations();
  }

  /**
   * Obtener historial de conversación reciente
   */
  private async getConversationHistory(accountId: number, chatId: string): Promise<any[]> {
    try {
      const result = await pool.query(`
        SELECT "accountId", "chatId", from_me, content, timestamp
        FROM whatsapp_messages 
        WHERE "accountId" = $1 AND "chatId" = $2
        ORDER BY timestamp DESC
        LIMIT 10
      `, [accountId, chatId]);
      
      return result.rows;
    } catch (error) {
      console.error('❌ Error obteniendo historial de conversación:', error);
      return [];
    }
  }

  /**
   * Detectar si un mensaje contiene saludos
   */
  private containsGreeting(content: string): boolean {
    const greetingPatterns = [
      /hola\b/i,
      /buenos días/i,
      /buenas tardes/i,
      /buenas noches/i,
      /hello\b/i,
      /hi\b/i,
      /good morning/i,
      /good afternoon/i,
      /good evening/i,
      /bienvenido/i,
      /welcome/i,
      /¿en qué puedo ayudarte/i,
      /how can I help/i,
      /cómo puedo asistirte/i,
      /gracias por contactarnos/i,
      /thank you for contacting/i,
      /es un placer saludarte/i,
      /nice to meet you/i,
      /un gusto conocerte/i,
      /me presento/i,
      /soy .* y estoy aquí para/i
    ];

    return greetingPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Guardar mensaje en el historial
   */
  private async saveMessageToHistory(accountId: number, chatId: string, content: string, fromMe: boolean): Promise<void> {
    try {
      const messageId = `${chatId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      
      await pool.query(`
        INSERT INTO whatsapp_messages (
          "accountId", "chatId", "messageId", from_me, content, 
          timestamp, "hasMedia", "createdAt"
        ) VALUES ($1, $2, $3, $4, $5, NOW(), false, NOW())
        ON CONFLICT ("messageId") DO NOTHING
      `, [accountId, chatId, messageId, fromMe, content]);
      
    } catch (error) {
      console.error('❌ Error guardando mensaje en historial:', error);
    }
  }
}

// Exportar instancia global
export const unifiedMessageProcessor = UnifiedMessageProcessor.getInstance();