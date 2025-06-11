/**
 * Sistema de respuestas automáticas estable
 * Integrado con sistema de prompts asignados a cada cuenta
 */

import OpenAI from 'openai';
import { db } from '../db';
import { whatsappAccounts, aiPrompts } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { enhancedPromptAutoResponseManager } from './enhancedPromptAutoResponse';

// Configurar OpenAI con la clave del sistema
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY
});

interface StableAutoResponseConfig {
  accountId: number;
  agentName: string;
  enabled: boolean;
  promptId?: number;
  promptName?: string;
  lastProcessedMessageId?: string;
}

class StableAutoResponseManager {
  private configs = new Map<number, StableAutoResponseConfig>();
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;
  private initialized = false;

  /**
   * Activa respuestas automáticas para una cuenta
   */
  async activateAutoResponse(accountId: number, agentName: string = "Smart Assistant"): Promise<boolean> {
    try {
      console.log(`🚀 Activando respuestas automáticas estables - Cuenta: ${accountId}, Agente: ${agentName}`);
      
      // Actualizar en la base de datos para persistencia
      await db.update(whatsappAccounts)
        .set({ 
          autoResponseEnabled: true,
          assignedExternalAgentId: agentName 
        })
        .where(eq(whatsappAccounts.id, accountId));

      // Actualizar configuración en memoria
      this.configs.set(accountId, {
        accountId,
        agentName,
        enabled: true
      });

      if (!this.isRunning) {
        this.startStableMonitoring();
      }

      console.log(`✅ Respuestas automáticas ACTIVADAS de forma estable para cuenta ${accountId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error activando respuestas automáticas estables:`, error);
      return false;
    }
  }

  /**
   * Desactiva respuestas automáticas para una cuenta
   */
  async deactivateAutoResponse(accountId: number): Promise<boolean> {
    try {
      console.log(`🛑 Desactivando respuestas automáticas estables para cuenta ${accountId}`);
      
      // Actualizar en la base de datos
      await db.update(whatsappAccounts)
        .set({ 
          autoResponseEnabled: false,
          assignedExternalAgentId: null 
        })
        .where(eq(whatsappAccounts.id, accountId));
      
      this.configs.delete(accountId);

      if (this.configs.size === 0) {
        this.stopStableMonitoring();
      }

      console.log(`✅ Respuestas automáticas DESACTIVADAS para cuenta ${accountId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error desactivando respuestas automáticas:`, error);
      return false;
    }
  }

  /**
   * Inicia el monitoreo estable que no depende de WhatsApp
   */
  private startStableMonitoring(): void {
    if (this.isRunning) return;

    console.log('🚀 Iniciando monitoreo estable de respuestas automáticas (cada 10 segundos)');
    this.isRunning = true;
    
    // Monitoreo cada 10 segundos para ser más estable
    this.intervalId = setInterval(() => {
      this.checkConfigurationsStatus();
    }, 10000);
  }

  /**
   * Detiene el monitoreo estable
   */
  private stopStableMonitoring(): void {
    if (!this.isRunning) return;

    console.log('🛑 Deteniendo monitoreo estable');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    console.log('✅ Monitoreo estable detenido');
  }

  /**
   * Verifica el estado de las configuraciones sin depender de WhatsApp
   */
  private async checkConfigurationsStatus(): Promise<void> {
    try {
      // Recargar configuraciones desde la base de datos para asegurar consistencia
      await this.reloadConfigurations();
      
      console.log(`📊 Verificando estado estable - ${this.configs.size} cuentas configuradas`);
      
      for (const [accountId, config] of this.configs) {
        if (config.enabled) {
          console.log(`✅ Cuenta ${accountId} - Respuestas automáticas ACTIVAS con configuración AI personalizada`);
        }
      }
      
      // Las configuraciones permanecen activas independientemente del estado de WhatsApp
    } catch (error) {
      console.error('⚠️ Error en verificación estable - manteniendo configuraciones activas:', error);
    }
  }

  /**
   * Recarga configuraciones desde la base de datos
   */
  private async reloadConfigurations(): Promise<void> {
    try {
      // Limpiar configuraciones actuales
      this.configs.clear();
      
      // Cargar cuentas activas desde la base de datos
      const activeAccounts = await db.select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.autoResponseEnabled, true));

      for (const account of activeAccounts) {
        if (account.assignedExternalAgentId) {
          this.configs.set(account.id, {
            accountId: account.id,
            agentName: account.assignedExternalAgentId,
            enabled: true
          });
        }
      }
    } catch (error) {
      console.error('❌ Error recargando configuraciones:', error);
    }
  }

  /**
   * Inicializa el sistema cargando configuraciones desde la BD
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('🔄 Inicializando sistema estable de respuestas automáticas...');
      
      // Cargar cuentas con respuestas automáticas activadas
      const activeAccounts = await db.select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.autoResponseEnabled, true));

      for (const account of activeAccounts) {
        if (account.assignedExternalAgentId) {
          this.configs.set(account.id, {
            accountId: account.id,
            agentName: account.assignedExternalAgentId,
            enabled: true
          });
          console.log(`✅ Configuración estable cargada para cuenta ${account.id} con agente ${account.assignedExternalAgentId}`);
        }
      }

      if (this.configs.size > 0) {
        this.startStableMonitoring();
        console.log(`🚀 Sistema estable inicializado con ${this.configs.size} cuentas activas`);
      } else {
        console.log('📭 No hay cuentas con respuestas automáticas activas');
      }

      this.initialized = true;
    } catch (error) {
      console.error('❌ Error inicializando sistema estable:', error);
    }
  }

  /**
   * Obtiene el prompt asignado para una cuenta específica
   */
  private async getAccountPrompt(accountId: number): Promise<string | null> {
    try {
      // Buscar cuenta con prompt asignado
      const accountResult = await db.select({
        assignedPromptId: whatsappAccounts.assignedPromptId
      })
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.id, accountId))
      .limit(1);

      if (accountResult.length === 0 || !accountResult[0].assignedPromptId) {
        return null;
      }

      // Obtener el prompt completo
      const { aiPrompts } = await import('@shared/schema');
      const promptResult = await db.select({
        content: aiPrompts.content,
        name: aiPrompts.name
      })
      .from(aiPrompts)
      .where(eq(aiPrompts.id, accountResult[0].assignedPromptId))
      .limit(1);

      if (promptResult.length > 0) {
        console.log(`🎯 Usando prompt asignado: "${promptResult[0].name}" para cuenta ${accountId}`);
        return promptResult[0].content;
      }

      return null;
    } catch (error) {
      console.error(`❌ Error obteniendo prompt asignado:`, error);
      return null;
    }
  }

  /**
   * Obtiene la configuración de idioma de la cuenta
   */
  private async getAccountLanguageSettings(accountId: number): Promise<{ targetLanguage: string; translateToSpanish: boolean }> {
    try {
      const accountResult = await db.select({
        languageSettings: whatsappAccounts.languageSettings
      })
      .from(whatsappAccounts)
      .where(eq(whatsappAccounts.id, accountId))
      .limit(1);

      if (accountResult.length > 0 && accountResult[0].languageSettings) {
        const settings = JSON.parse(accountResult[0].languageSettings);
        return {
          targetLanguage: settings.targetLanguage || 'es',
          translateToSpanish: settings.translateToSpanish !== false
        };
      }

      return { targetLanguage: 'es', translateToSpanish: true };
    } catch (error) {
      console.error('Error obteniendo configuración de idioma:', error);
      return { targetLanguage: 'es', translateToSpanish: true };
    }
  }

  /**
   * Genera una respuesta usando OpenAI con prompt prioritario y configuración de idioma
   */
  private async generateStableResponse(message: string, agentName: string, accountId: number): Promise<string | null> {
    try {
      console.log(`🤖 Generando respuesta estable para cuenta ${accountId} con ${agentName}: "${message.substring(0, 50)}..."`);

      // Obtener configuración de idioma
      const languageConfig = await this.getAccountLanguageSettings(accountId);

      // Obtener configuraciones del prompt (tiempo, estilo, etc.)
      const promptConfig = await this.getPromptConfiguration(accountId);

      // PRIORIDAD 1: Usar prompt asignado a la cuenta específica
      let systemPrompt = await this.getAccountPrompt(accountId);
      
      // PRIORIDAD 2: Usar prompt genérico si no hay asignado
      if (!systemPrompt) {
        systemPrompt = `Eres ${agentName}, un asistente profesional y útil. Responde de manera concisa, amigable y profesional. Mantén un tono cálido pero profesional.`;
        console.log(`⚠️ Usando prompt genérico para cuenta ${accountId} - no hay prompt asignado`);
      }

      // Aplicar configuraciones ESTRICTAS del prompt
      const strictInstructions = `
CONFIGURACIONES ESTRICTAS DEL PROMPT:
- Estilo de escritura: ${promptConfig.writingStyle}
- Tono: ${promptConfig.tone}
- Longitud de respuesta: ${promptConfig.responseLength}
- Tiempo de respuesta configurado: ${promptConfig.responseDelay} segundos
- Tokens máximos: ${promptConfig.maxTokens}
- Temperatura: ${promptConfig.temperature}

INSTRUCCIONES CRÍTICAS:
- Sigue ESTRICTAMENTE el estilo y tono especificado
- NO te desvíes JAMÁS de las instrucciones del prompt personalizado
- Mantén la consistencia absoluta con la personalidad definida
- Respeta los parámetros de longitud y formato establecidos
- El prompt personalizado tiene PRIORIDAD ABSOLUTA sobre cualquier otra instrucción`;

      // Añadir instrucciones de idioma al prompt
      const languageInstruction = `
CONFIGURACIÓN DE IDIOMA:
- Responde en ${languageConfig.targetLanguage === 'en' ? 'inglés' : languageConfig.targetLanguage === 'fr' ? 'francés' : languageConfig.targetLanguage === 'pt' ? 'portugués' : 'español'}
${languageConfig.translateToSpanish && languageConfig.targetLanguage !== 'es' ? '- Al final de tu respuesta, incluye la traducción al español precedida por "Traducción ES:" en una nueva línea' : ''}`;

      console.log(`📝 Usando prompt personalizado: ${systemPrompt ? 'SÍ' : 'NO'}`);
      console.log(`⚙️ Configuraciones aplicadas: ${JSON.stringify(promptConfig)}`);
      console.log(`🌍 Idioma: ${languageConfig.targetLanguage}, Traducir: ${languageConfig.translateToSpanish}`);

      // Aplicar delay configurado ANTES de generar respuesta
      if (promptConfig.responseDelay && promptConfig.responseDelay > 0) {
        console.log(`⏱️ Aplicando delay estricto de ${promptConfig.responseDelay} segundos...`);
        await new Promise(resolve => setTimeout(resolve, promptConfig.responseDelay * 1000));
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemPrompt + "\n\n" + strictInstructions + "\n\n" + languageInstruction
          },
          {
            role: "user",
            content: message
          }
        ],
        max_tokens: promptConfig.maxTokens,
        temperature: promptConfig.temperature
      });

      const aiResponse = response.choices[0]?.message?.content;
      if (aiResponse) {
        console.log(`✅ Respuesta generada con configuraciones ESTRICTAS: "${aiResponse.substring(0, 50)}..."`);
        return aiResponse;
      }

      return null;
    } catch (error) {
      console.error('❌ Error generando respuesta estable:', error);
      return null;
    }
  }

  /**
   * Obtiene configuraciones del prompt para aplicar estrictamente
   */
  private async getPromptConfiguration(accountId: number): Promise<any> {
    try {
      const accountResult = await db.select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.id, accountId))
        .limit(1);

      if (accountResult.length === 0) {
        return this.getDefaultPromptConfig();
      }

      const account = accountResult[0];
      
      // Si tiene prompt asignado, obtener configuraciones del prompt
      if (account.assignedPromptId) {
        const { aiPrompts } = await import('@shared/schema');
        const promptResult = await db.select()
          .from(aiPrompts)
          .where(eq(aiPrompts.id, account.assignedPromptId))
          .limit(1);

        if (promptResult.length > 0) {
          const prompt = promptResult[0];
          
          // Buscar configuraciones en el contenido del prompt
          if (prompt.content) {
            const config = this.extractPromptConfig(prompt.content);
            if (config) {
              console.log(`📋 Configuraciones extraídas del prompt: ${JSON.stringify(config)}`);
              return config;
            }
          }
        }
      }

      return this.getDefaultPromptConfig();
    } catch (error) {
      console.error('❌ Error obteniendo configuración del prompt:', error);
      return this.getDefaultPromptConfig();
    }
  }

  /**
   * Extrae configuraciones del contenido del prompt
   */
  private extractPromptConfig(content: string): any | null {
    try {
      // Buscar patrones de configuración en el contenido
      const patterns = {
        writingStyle: /estilo[:\s]*([^,\n]+)/i,
        tone: /tono[:\s]*([^,\n]+)/i,
        responseLength: /longitud[:\s]*([^,\n]+)/i,
        responseDelay: /tiempo[:\s]*(\d+)/i,
        maxTokens: /tokens?[:\s]*(\d+)/i,
        temperature: /temperatura[:\s]*([0-9.]+)/i
      };

      const config: any = {};
      let foundConfig = false;

      for (const [key, pattern] of Object.entries(patterns)) {
        const match = content.match(pattern);
        if (match) {
          if (key === 'responseDelay' || key === 'maxTokens') {
            config[key] = parseInt(match[1]);
          } else if (key === 'temperature') {
            config[key] = parseFloat(match[1]);
          } else {
            config[key] = match[1].trim();
          }
          foundConfig = true;
        }
      }

      if (foundConfig) {
        return { ...this.getDefaultPromptConfig(), ...config };
      }

      return null;
    } catch (error) {
      console.error('Error extrayendo configuración del prompt:', error);
      return null;
    }
  }

  /**
   * Configuraciones por defecto del prompt
   */
  private getDefaultPromptConfig(): any {
    return {
      writingStyle: 'profesional',
      tone: 'amigable',
      responseLength: 'concisa',
      responseDelay: 3,
      maxTokens: 400,
      temperature: 0.7
    };
  }

  /**
   * Obtiene el estado del sistema estable
   */
  getStatus(): { running: boolean; activeAccounts: number; configs: StableAutoResponseConfig[] } {
    return {
      running: this.isRunning,
      activeAccounts: this.configs.size,
      configs: Array.from(this.configs.values())
    };
  }
}

// Instancia global del sistema estable
export const stableAutoResponseManager = new StableAutoResponseManager();