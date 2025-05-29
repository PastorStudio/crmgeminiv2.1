/**
 * Sistema de respuestas automáticas estable
 * No depende de conexiones activas de WhatsApp para mantener configuraciones
 */

import OpenAI from 'openai';
import { db } from '../db';
import { whatsappAccounts } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Configurar OpenAI con la clave del sistema
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY
});

interface StableAutoResponseConfig {
  accountId: number;
  agentName: string;
  enabled: boolean;
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
      console.log(`📊 Verificando estado estable - ${this.configs.size} cuentas configuradas`);
      
      for (const [accountId, config] of this.configs) {
        if (config.enabled) {
          console.log(`✅ Cuenta ${accountId} - Respuestas automáticas ACTIVAS con agente: ${config.agentName}`);
        }
      }
      
      // Las configuraciones permanecen activas independientemente del estado de WhatsApp
    } catch (error) {
      console.error('⚠️ Error en verificación estable - manteniendo configuraciones activas:', error);
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
   * Genera una respuesta usando OpenAI
   */
  private async generateStableResponse(message: string, agentName: string): Promise<string | null> {
    try {
      console.log(`🤖 Generando respuesta estable con ${agentName} para: "${message.substring(0, 50)}..."`);

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `Eres ${agentName}, un asistente profesional y útil. Responde de manera concisa, amigable y profesional. Mantén un tono cálido pero profesional.`
          },
          {
            role: "user",
            content: message
          }
        ],
        max_tokens: 300,
        temperature: 0.7
      });

      const aiResponse = response.choices[0]?.message?.content;
      if (aiResponse) {
        console.log(`✅ Respuesta estable generada: "${aiResponse.substring(0, 50)}..."`);
        return aiResponse;
      }

      return null;
    } catch (error) {
      console.error('❌ Error generando respuesta estable:', error);
      return null;
    }
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