/**
 * Sistema de respuestas automáticas mejorado que usa prompts asignados
 * Reemplaza el sistema normal de agentes con configuración basada en prompts
 */

import OpenAI from 'openai';
import { db } from '../db';
import { whatsappAccounts, aiPrompts } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Configurar OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY
});

interface PromptConfig {
  accountId: number;
  promptId: number;
  promptName: string;
  promptContent: string;
  customPrompt?: string;
  enabled: boolean;
  targetLanguage: string;
  provider: string;
  temperature: number;
}

class EnhancedPromptAutoResponseManager {
  private activeConfigs = new Map<number, PromptConfig>();
  private isInitialized = false;

  /**
   * Inicializar el sistema de respuestas basadas en prompts
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Inicializando sistema de respuestas automáticas basado en prompts...');

      await this.loadActivePromptConfigurations();

      this.isInitialized = true;
      console.log(`✅ Sistema iniciado con ${this.activeConfigs.size} cuentas configuradas con prompts`);
    } catch (error) {
      console.error('❌ Error inicializando sistema de respuestas basadas en prompts:', error);
    }
  }

  /**
   * Cargar configuraciones activas de prompts desde la base de datos
   */
  async loadActivePromptConfigurations(): Promise<void> {
    try {
      console.log('🔄 Cargando configuraciones de prompts activas...');

      // Usar consulta SQL directa para evitar problemas de esquema
      const { pool } = await import('../db');
      const result = await pool.query(`
        SELECT wa.id, wa.name, wa.autoresponseenabled, wa.assigned_prompt_id, wa.customprompt, wa.target_language,
               ap.name as prompt_name, ap.content as prompt_content, ap.provider, ap.temperature
        FROM whatsapp_accounts wa
        LEFT JOIN ai_prompts ap ON wa.assigned_prompt_id = ap.id
        WHERE wa.autoresponseenabled = true AND wa.assigned_prompt_id IS NOT NULL
      `);

      this.activeConfigs.clear();

      for (const row of result.rows) {
        if (row.prompt_content) {
          const config: PromptConfig = {
            accountId: row.id,
            promptId: row.assigned_prompt_id,
            promptName: row.prompt_name,
            promptContent: row.prompt_content,
            customPrompt: row.customprompt || undefined,
            enabled: row.autoresponseenabled || false,
            targetLanguage: row.target_language || 'es',
            provider: row.provider || 'openai',
            temperature: row.temperature || 0.7
          };

          this.activeConfigs.set(row.id, config);
          console.log(`✅ Cuenta ${row.id} configurada con prompt "${row.prompt_name}" (ID: ${row.assigned_prompt_id})`);
        } else {
          console.log(`⚠️ Cuenta ${row.id} tiene prompt asignado (ID: ${row.assigned_prompt_id}) pero no se encontró el contenido`);
        }
      }

      console.log(`📊 Total de configuraciones de prompt cargadas: ${this.activeConfigs.size}`);
    } catch (error) {
      console.error('❌ Error cargando configuraciones de prompts:', error);
    }
  }

  /**
   * Activar respuestas automáticas con prompt específico para una cuenta
   */
  async activatePromptForAccount(accountId: number, promptId: number): Promise<boolean> {
    try {
      console.log(`🚀 Activando prompt ${promptId} para cuenta ${accountId}...`);

      // Actualizar base de datos usando consulta SQL directa
      const { pool } = await import('../db');
      await pool.query(`
        UPDATE whatsapp_accounts 
        SET autoresponseenabled = true, assigned_prompt_id = $1 
        WHERE id = $2
      `, [promptId, accountId]);

      // Recargar configuraciones
      await this.loadActivePromptConfigurations();

      const config = this.activeConfigs.get(accountId);
      if (config) {
        console.log(`✅ Prompt "${config.promptName}" activado para cuenta ${accountId}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`❌ Error activando prompt para cuenta ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Generar respuesta usando el prompt asignado a la cuenta
   */
  async generatePromptResponse(accountId: number, messageContent: string, contactName: string = 'Cliente'): Promise<string | null> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const config = this.activeConfigs.get(accountId);
      if (!config || !config.enabled) {
        console.log(`⚠️ No hay configuración de prompt activa para cuenta ${accountId}`);
        return null;
      }

      console.log(`🤖 Generando respuesta con prompt "${config.promptName}" para cuenta ${accountId}`);

      // Construir prompt completo con contexto
      let fullPrompt = config.promptContent;

      if (config.customPrompt) {
        fullPrompt = `${config.promptContent}\n\nInstrucciones adicionales: ${config.customPrompt}`;
      }

      const contextualPrompt = `${fullPrompt}

Contexto de la conversación:
- Nombre del contacto: ${contactName}
- Idioma preferido: ${config.targetLanguage}
- Mensaje recibido: "${messageContent}"

Instrucciones:
- Responde de manera profesional y útil
- Mantén el tono y estilo definido en el prompt
- Responde en ${config.targetLanguage}
- Sé conciso pero completo`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: contextualPrompt
          },
          {
            role: 'user',
            content: messageContent
          }
        ],
        max_tokens: 500,
        temperature: config.temperature
      });

      const response = completion.choices[0]?.message?.content;

      if (response) {
        console.log(`✅ Respuesta generada exitosamente con prompt "${config.promptName}"`);
        return response.trim();
      }

      console.log(`⚠️ No se pudo generar respuesta para cuenta ${accountId}`);
      return null;
    } catch (error) {
      console.error(`❌ Error generando respuesta con prompt para cuenta ${accountId}:`, error);
      return null;
    }
  }

  /**
   * Verificar si una cuenta tiene prompt asignado
   */
  hasPromptConfig(accountId: number): boolean {
    return this.activeConfigs.has(accountId);
  }

  /**
   * Obtener configuración de prompt para una cuenta
   */
  getPromptConfig(accountId: number): PromptConfig | undefined {
    return this.activeConfigs.get(accountId);
  }

  /**
   * Listar todas las configuraciones activas
   */
  getActiveConfigurations(): PromptConfig[] {
    return Array.from(this.activeConfigs.values());
  }

  /**
   * Verificar y reportar estado del sistema
   */
  async verifySystemStatus(): Promise<{ 
    initialized: boolean; 
    activeAccounts: number; 
    configuredPrompts: number; 
    status: string;
  }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const activeAccounts = this.activeConfigs.size;
      const configuredPrompts = Array.from(this.activeConfigs.values()).filter(c => c.enabled).length;

      return {
        initialized: this.isInitialized,
        activeAccounts,
        configuredPrompts,
        status: configuredPrompts > 0 ? 'active' : 'inactive'
      };
    } catch (error) {
      console.error('❌ Error verificando estado del sistema:', error);
      return {
        initialized: false,
        activeAccounts: 0,
        configuredPrompts: 0,
        status: 'error'
      };
    }
  }
}

// Exportar instancia singleton
export const enhancedPromptAutoResponseManager = new EnhancedPromptAutoResponseManager();

// Inicializar automáticamente
enhancedPromptAutoResponseManager.initialize().catch(error => {
  console.error('❌ Error en inicialización automática del sistema de prompts:', error);
});