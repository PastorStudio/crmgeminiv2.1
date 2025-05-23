/**
 * Servicio integrado de respuestas automáticas
 * Combina el agente SmartBots con el sistema de WhatsApp para respuestas automáticas
 */

import { smartBotsAgent, SmartBotsAgent } from './smartBotsAgent';

export interface AutoResponseMessage {
  id: string;
  chatId: string;
  accountId: number;
  contactName?: string;
  contactPhone: string;
  messageText: string;
  timestamp: Date;
  fromMe: boolean;
}

export interface AutoResponseConfig {
  enabled: boolean;
  delaySeconds: number;
  useSmartBots: boolean;
  smartBotsConfig: {
    enabled: boolean;
    temperature: number;
    maxTokens: number;
    customPrompt?: string;
  };
  excludedContacts: string[];
  businessHours: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };
  maxResponsesPerDay: number;
}

export class AutoResponseIntegration {
  private config: AutoResponseConfig;
  private responseCount: Map<string, number> = new Map();
  private lastResetDate: Date = new Date();

  constructor() {
    this.config = {
      enabled: true,
      delaySeconds: 10,
      useSmartBots: true,
      smartBotsConfig: {
        enabled: true,
        temperature: 0.7,
        maxTokens: 500,
        customPrompt: undefined
      },
      excludedContacts: [],
      businessHours: {
        enabled: true,
        start: '09:00',
        end: '18:00',
        timezone: 'America/Mexico_City'
      },
      maxResponsesPerDay: 50
    };
  }

  /**
   * Procesa un mensaje entrante y determina si debe generar una respuesta automática
   */
  async processIncomingMessage(message: AutoResponseMessage): Promise<string | null> {
    try {
      console.log('🔄 Procesando mensaje para respuesta automática:', message.messageText);

      // Verificar si las respuestas automáticas están habilitadas
      if (!this.config.enabled) {
        console.log('⏸️ Respuestas automáticas deshabilitadas');
        return null;
      }

      // No responder a mensajes enviados por nosotros
      if (message.fromMe) {
        console.log('⏸️ Mensaje enviado por nosotros, no responder');
        return null;
      }

      // Verificar si el contacto está excluido
      if (this.isContactExcluded(message.contactPhone)) {
        console.log('⏸️ Contacto excluido de respuestas automáticas');
        return null;
      }

      // Verificar límite diario de respuestas
      if (!this.canSendMoreResponses(message.contactPhone)) {
        console.log('⏸️ Límite diario de respuestas alcanzado para el contacto');
        return null;
      }

      // Verificar horario comercial
      if (!this.isWithinBusinessHours()) {
        console.log('⏸️ Fuera del horario comercial');
        return null;
      }

      // Generar respuesta usando SmartBots
      const response = await this.generateAutoResponse(message);

      if (response) {
        // Incrementar contador de respuestas
        this.incrementResponseCount(message.contactPhone);
        console.log('✅ Respuesta automática generada:', response);
      }

      return response;

    } catch (error) {
      console.error('❌ Error procesando mensaje para respuesta automática:', error);
      return null;
    }
  }

  /**
   * Genera una respuesta automática usando SmartBots
   */
  private async generateAutoResponse(message: AutoResponseMessage): Promise<string | null> {
    try {
      if (!this.config.useSmartBots || !this.config.smartBotsConfig.enabled) {
        // Respuesta genérica si SmartBots está deshabilitado
        return 'Gracias por tu mensaje. Un asesor te contactará pronto.';
      }

      // Verificar disponibilidad del agente SmartBots
      const isAvailable = await smartBotsAgent.isAvailable();
      if (!isAvailable) {
        console.log('⚠️ SmartBots no está disponible, usando respuesta genérica');
        return 'Gracias por tu mensaje. Un asesor te contactará pronto.';
      }

      // Actualizar configuración del agente si es necesario
      if (this.config.smartBotsConfig.customPrompt) {
        smartBotsAgent.updateConfig({
          systemPrompt: this.config.smartBotsConfig.customPrompt,
          temperature: this.config.smartBotsConfig.temperature,
          maxTokens: this.config.smartBotsConfig.maxTokens
        });
      }

      // Obtener contexto de conversación (simplificado por ahora)
      const conversationContext: string[] = [];

      // Generar respuesta con SmartBots
      const response = await smartBotsAgent.generateResponse(
        message.messageText,
        message.contactName,
        conversationContext
      );

      return response;

    } catch (error) {
      console.error('❌ Error generando respuesta con SmartBots:', error);
      return 'Gracias por tu mensaje. Un asesor te contactará pronto.';
    }
  }

  /**
   * Verifica si un contacto está excluido
   */
  private isContactExcluded(contactPhone: string): boolean {
    return this.config.excludedContacts.some(excluded => 
      contactPhone.includes(excluded) || excluded.includes(contactPhone)
    );
  }

  /**
   * Verifica si se pueden enviar más respuestas hoy
   */
  private canSendMoreResponses(contactPhone: string): boolean {
    this.resetDailyCountIfNeeded();
    
    const currentCount = this.responseCount.get(contactPhone) || 0;
    return currentCount < this.config.maxResponsesPerDay;
  }

  /**
   * Incrementa el contador de respuestas para un contacto
   */
  private incrementResponseCount(contactPhone: string): void {
    const currentCount = this.responseCount.get(contactPhone) || 0;
    this.responseCount.set(contactPhone, currentCount + 1);
  }

  /**
   * Resetea los contadores diarios si es un nuevo día
   */
  private resetDailyCountIfNeeded(): void {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const resetDate = new Date(this.lastResetDate.getFullYear(), this.lastResetDate.getMonth(), this.lastResetDate.getDate());

    if (today > resetDate) {
      this.responseCount.clear();
      this.lastResetDate = now;
      console.log('🔄 Contadores diarios de respuestas automáticas reseteados');
    }
  }

  /**
   * Verifica si estamos dentro del horario comercial
   */
  private isWithinBusinessHours(): boolean {
    if (!this.config.businessHours.enabled) {
      return true;
    }

    try {
      const now = new Date();
      const currentTime = now.toLocaleTimeString('en-US', { 
        hour12: false,
        timeZone: this.config.businessHours.timezone 
      });

      const [currentHour, currentMinute] = currentTime.split(':').map(Number);
      const currentTotalMinutes = currentHour * 60 + currentMinute;

      const [startHour, startMinute] = this.config.businessHours.start.split(':').map(Number);
      const startTotalMinutes = startHour * 60 + startMinute;

      const [endHour, endMinute] = this.config.businessHours.end.split(':').map(Number);
      const endTotalMinutes = endHour * 60 + endMinute;

      return currentTotalMinutes >= startTotalMinutes && currentTotalMinutes <= endTotalMinutes;

    } catch (error) {
      console.error('❌ Error verificando horario comercial:', error);
      return true; // En caso de error, permitir respuestas
    }
  }

  /**
   * Envía una respuesta automática a WhatsApp
   */
  async sendAutoResponse(
    chatId: string, 
    accountId: number, 
    response: string, 
    delayMs?: number
  ): Promise<boolean> {
    try {
      const delay = delayMs || (this.config.delaySeconds * 1000);
      
      console.log(`⏱️ Enviando respuesta automática en ${delay}ms:`, response);

      // Esperar el delay configurado
      await new Promise(resolve => setTimeout(resolve, delay));

      // Aquí se integraría con el servicio de WhatsApp para enviar el mensaje
      // Por ahora simulamos el envío
      console.log('📤 Enviando respuesta automática a chat:', chatId);
      console.log('💬 Mensaje:', response);

      // TODO: Integrar con el servicio real de WhatsApp
      // await whatsappService.sendMessage(accountId, chatId, response);

      return true;

    } catch (error) {
      console.error('❌ Error enviando respuesta automática:', error);
      return false;
    }
  }

  /**
   * Actualiza la configuración de respuestas automáticas
   */
  updateConfig(newConfig: Partial<AutoResponseConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 Configuración de respuestas automáticas actualizada:', this.config);
  }

  /**
   * Obtiene la configuración actual
   */
  getConfig(): AutoResponseConfig {
    return { ...this.config };
  }

  /**
   * Obtiene estadísticas de respuestas automáticas
   */
  getStats(): {
    totalResponsesToday: number;
    activeContacts: number;
    configEnabled: boolean;
    smartBotsEnabled: boolean;
  } {
    this.resetDailyCountIfNeeded();
    
    const totalResponsesToday = Array.from(this.responseCount.values()).reduce((sum, count) => sum + count, 0);
    const activeContacts = this.responseCount.size;

    return {
      totalResponsesToday,
      activeContacts,
      configEnabled: this.config.enabled,
      smartBotsEnabled: this.config.useSmartBots && this.config.smartBotsConfig.enabled
    };
  }
}

// Instancia global del servicio de respuestas automáticas
export const autoResponseIntegration = new AutoResponseIntegration();