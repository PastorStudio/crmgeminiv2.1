/**
 * Sistema de respuestas automáticas basado en prompts asignados
 * Utiliza los prompts configurados para cada cuenta en lugar de agentes genéricos
 */

import OpenAI from 'openai';
import { db } from '../db';
import { whatsappAccounts, aiPrompts } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Configurar OpenAI con la clave del sistema
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY
});

interface PromptBasedConfig {
  accountId: number;
  promptId: number;
  promptName: string;
  promptContent: string;
  customPrompt?: string;
  enabled: boolean;
  targetLanguage: string;
}

class PromptBasedAutoResponseManager {
  private configs = new Map<number, PromptBasedConfig>();
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  /**
   * Cargar configuración de prompts para todas las cuentas
   */
  async loadPromptConfigurations(): Promise<void> {
    try {
      console.log('🔄 Cargando configuraciones de prompts desde base de datos...');
      
      const accountsWithPrompts = await db
        .select({
          accountId: whatsappAccounts.id,
          promptId: whatsappAccounts.assignedPromptId,
          promptName: aiPrompts.name,
          promptContent: aiPrompts.content,
          customPrompt: whatsappAccounts.customPrompt,
          autoResponseEnabled: whatsappAccounts.autoResponseEnabled,
          targetLanguage: whatsappAccounts.targetLanguage,
          accountName: whatsappAccounts.name
        })
        .from(whatsappAccounts)
        .leftJoin(aiPrompts, eq(whatsappAccounts.assignedPromptId, aiPrompts.id))
        .where(eq(whatsappAccounts.autoResponseEnabled, true));

      console.log(`📊 Encontradas ${accountsWithPrompts.length} cuentas con respuestas automáticas habilitadas`);

      // Limpiar configuraciones previas
      this.configs.clear();

      // Cargar nuevas configuraciones
      for (const account of accountsWithPrompts) {
        if (account.promptId && account.promptContent) {
          const config: PromptBasedConfig = {
            accountId: account.accountId,
            promptId: account.promptId,
            promptName: account.promptName || 'Prompt Personalizado',
            promptContent: account.promptContent,
            customPrompt: account.customPrompt || undefined,
            enabled: account.autoResponseEnabled || false,
            targetLanguage: account.targetLanguage || 'es'
          };

          this.configs.set(account.accountId, config);
          console.log(`✅ Configuración cargada para cuenta ${account.accountId} (${account.accountName}) - Prompt: ${config.promptName}`);
        } else {
          console.log(`⚠️ Cuenta ${account.accountId} (${account.accountName}) no tiene prompt asignado`);
        }
      }

      console.log(`🚀 Sistema de prompts inicializado con ${this.configs.size} cuentas configuradas`);
    } catch (error) {
      console.error('❌ Error cargando configuraciones de prompts:', error);
    }
  }

  /**
   * Activar respuestas automáticas para una cuenta con prompt específico
   */
  async activatePromptBasedResponse(accountId: number, promptId: number): Promise<boolean> {
    try {
      console.log(`🚀 Activando respuestas automáticas basadas en prompt - Cuenta: ${accountId}, Prompt ID: ${promptId}`);
      
      // Actualizar en la base de datos
      await db.update(whatsappAccounts)
        .set({ 
          autoResponseEnabled: true,
          assignedPromptId: promptId
        })
        .where(eq(whatsappAccounts.id, accountId));

      // Recargar configuraciones
      await this.loadPromptConfigurations();

      console.log(`✅ Respuestas automáticas basadas en prompt ACTIVADAS para cuenta ${accountId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error activando respuestas automáticas basadas en prompt para cuenta ${accountId}:`, error);
      return false;
    }
  }

  /**
   * Generar respuesta usando el prompt asignado a la cuenta
   */
  async generatePromptBasedResponse(accountId: number, messageContent: string, contactName: string = 'Cliente'): Promise<string | null> {
    try {
      const config = this.configs.get(accountId);
      
      if (!config || !config.enabled) {
        console.log(`⚠️ No hay configuración de prompt para cuenta ${accountId} o está deshabilitada`);
        return null;
      }

      // Construir el prompt completo
      let fullPrompt = config.promptContent;
      
      // Si hay un prompt personalizado, usarlo en combinación
      if (config.customPrompt) {
        fullPrompt = `${config.promptContent}\n\nInstrucciones adicionales: ${config.customPrompt}`;
      }

      // Añadir contexto del mensaje
      const contextualPrompt = `${fullPrompt}

Información del contexto:
- Nombre del contacto: ${contactName}
- Idioma objetivo: ${config.targetLanguage}
- Mensaje recibido: "${messageContent}"

Por favor, responde de manera profesional y útil según las instrucciones del prompt.`;

      console.log(`🤖 Generando respuesta con prompt "${config.promptName}" para cuenta ${accountId}`);

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
        temperature: 0.7
      });

      const response = completion.choices[0]?.message?.content;
      
      if (response) {
        console.log(`✅ Respuesta generada exitosamente con prompt "${config.promptName}"`);
        return response.trim();
      }

      console.log(`⚠️ No se pudo generar respuesta con prompt para cuenta ${accountId}`);
      return null;
    } catch (error) {
      console.error(`❌ Error generando respuesta con prompt para cuenta ${accountId}:`, error);
      return null;
    }
  }

  /**
   * Obtener configuración de prompt para una cuenta
   */
  getPromptConfig(accountId: number): PromptBasedConfig | undefined {
    return this.configs.get(accountId);
  }

  /**
   * Listar todas las configuraciones activas
   */
  getActiveConfigurations(): PromptBasedConfig[] {
    return Array.from(this.configs.values()).filter(config => config.enabled);
  }

  /**
   * Inicializar el sistema de respuestas basadas en prompts
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Inicializando sistema de respuestas automáticas basado en prompts...');
      
      await this.loadPromptConfigurations();
      
      // Iniciar procesamiento automático cada 15 segundos
      if (!this.isRunning) {
        this.isRunning = true;
        this.intervalId = setInterval(() => {
          this.processAutomaticResponses();
        }, 15000);
      }

      console.log('✅ Sistema de respuestas automáticas basado en prompts iniciado exitosamente');
    } catch (error) {
      console.error('❌ Error inicializando sistema de respuestas basadas en prompts:', error);
    }
  }

  /**
   * Procesar respuestas automáticas (placeholder para integración futura)
   */
  private async processAutomaticResponses(): Promise<void> {
    // Este método se ejecuta cada 15 segundos para procesar mensajes pendientes
    // Se integrará con el sistema de WhatsApp para detectar mensajes nuevos
    if (this.configs.size > 0) {
      console.log(`🔄 Procesando respuestas automáticas para ${this.configs.size} cuentas configuradas con prompts`);
    }
  }

  /**
   * Detener el sistema
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    console.log('🛑 Sistema de respuestas automáticas basado en prompts detenido');
  }
}

// Exportar instancia singleton
export const promptBasedAutoResponseManager = new PromptBasedAutoResponseManager();