/**
 * Procesador Unificado de Mensajes
 * Sistema centralizado que garantiza que los prompts asignados tengan prioridad absoluta
 * sobre cualquier otro sistema de respuestas automáticas
 */

import { pool } from '../db';

interface MessageContext {
  chatId: string;
  accountId: number;
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

export class UnifiedMessageProcessor {
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
      // No procesar mensajes propios
      if (context.fromMe) {
        return { success: false, source: 'none' };
      }

      console.log(`📨 Procesando mensaje en cuenta ${context.accountId}: "${context.body.substring(0, 50)}..."`);

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

      // Construir prompt completo
      const systemPrompt = `${config.promptContent}

${config.customPrompt ? `Instrucciones adicionales: ${config.customPrompt}` : ''}

Contexto:
- Nombre del contacto: ${context.contactName || 'Usuario'}
- Idioma objetivo: ${config.targetLanguage}
- Mantén siempre el tono y personalidad definida en el prompt principal.
- Responde directamente al mensaje del usuario de manera útil y profesional.`;

      // Llamar a OpenAI
      const response = await this.callOpenAI(systemPrompt, context.body, config.temperature);

      if (response) {
        console.log(`✅ Respuesta generada con prompt "${config.promptName}": "${response.substring(0, 50)}..."`);
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
      const systemPrompt = `Eres un asistente virtual profesional y útil. 
Responde de manera amable y profesional a las consultas de los usuarios.
Mantén las respuestas concisas y relevantes.
Nombre del contacto: ${context.contactName || 'Usuario'}`;

      const response = await this.callOpenAI(systemPrompt, context.body, 0.7);

      if (response) {
        console.log(`✅ Respuesta generada con IA genérica: "${response.substring(0, 50)}..."`);
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
   * Llamar a OpenAI para generar respuesta
   */
  private async callOpenAI(systemPrompt: string, userMessage: string, temperature: number): Promise<string | null> {
    try {
      const OpenAI = (await import('openai')).default;
      
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || 'sk-proj-fake-key'
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
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
}

// Exportar instancia global
export const unifiedMessageProcessor = UnifiedMessageProcessor.getInstance();