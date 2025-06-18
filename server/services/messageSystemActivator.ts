/**
 * Activador del Sistema de Mensajes Inteligentes
 * Integra el sistema de respuestas automáticas con la infraestructura existente
 */

import { whatsappMessageIntegrator } from './whatsappMessageIntegrator.js';
import { intelligentAutoResponse } from './intelligentAutoResponse.js';
import { realTimeMessageProcessor } from './realTimeMessageProcessor.js';
import { db } from '../db.js';
import { whatsappAccounts } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export class MessageSystemActivator {
  private isActivated = false;

  /**
   * Activa el sistema completo de mensajes inteligentes
   */
  async activate(): Promise<void> {
    if (this.isActivated) return;

    console.log('🚀 Activando sistema inteligente de respuestas automáticas...');

    try {
      // Inicializar integrador
      await whatsappMessageIntegrator.initialize();

      // Configurar monitoreo para cuentas activas
      await this.setupAccountMonitoring();

      // Configurar hooks globales
      this.setupGlobalHooks();

      this.isActivated = true;
      console.log('✅ Sistema inteligente de respuestas automáticas activado correctamente');
    } catch (error) {
      console.error('❌ Error activando sistema de mensajes:', error);
    }
  }

  /**
   * Configura monitoreo para cuentas con respuestas automáticas habilitadas
   */
  private async setupAccountMonitoring(): Promise<void> {
    try {
      const activeAccounts = await db
        .select({
          id: whatsappAccounts.id,
          name: whatsappAccounts.name,
          autoResponseEnabled: whatsappAccounts.autoResponseEnabled
        })
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.autoResponseEnabled, true));

      console.log(`🔍 Encontradas ${activeAccounts.length} cuentas con respuestas automáticas habilitadas`);

      for (const account of activeAccounts) {
        await realTimeMessageProcessor.startMonitoring(account.id);
        console.log(`📱 Monitoreo inteligente activado para cuenta: ${account.name} (ID: ${account.id})`);
      }
    } catch (error) {
      console.error('Error configurando monitoreo de cuentas:', error);
    }
  }

  /**
   * Configura hooks globales para integración
   */
  private setupGlobalHooks(): void {
    // Hook para mensajes entrantes del sistema existente
    (global as any).processIntelligentMessage = async (accountId: number, messageData: any) => {
      try {
        await realTimeMessageProcessor.processWhatsAppMessage(
          accountId,
          messageData.chatId || messageData.from,
          messageData
        );
      } catch (error) {
        console.error('Error en hook de mensaje inteligente:', error);
      }
    };

    // Hook para testing manual
    (global as any).testIntelligentResponse = async (
      accountId: number,
      chatId: string,
      message: string,
      fromNumber: string
    ) => {
      return await whatsappMessageIntegrator.processTestMessage(
        accountId,
        chatId,
        message,
        fromNumber
      );
    };

    console.log('🔧 Hooks globales configurados para sistema inteligente');
  }

  /**
   * Procesa mensaje de prueba para verificar funcionamiento
   */
  async testSystem(
    accountId: number = 1,
    testMessage: string = "Hola, necesito información sobre sus servicios"
  ): Promise<void> {
    const testChatId = `test_${Date.now()}`;
    const testFromNumber = "+521234567890";

    console.log('🧪 Iniciando prueba del sistema inteligente...');
    console.log(`Mensaje de prueba: "${testMessage}"`);

    try {
      const response = await intelligentAutoResponse.processIncomingMessage(
        accountId,
        testChatId,
        testMessage,
        testFromNumber
      );

      if (response) {
        console.log(`✅ Respuesta generada: "${response.message}"`);
        console.log(`📊 Confianza: ${response.confidence}`);
        console.log(`🔄 Próximo estado: ${response.nextState}`);
      } else {
        console.log('⚠️ No se generó respuesta automática');
      }
    } catch (error) {
      console.error('❌ Error en prueba del sistema:', error);
    }
  }

  /**
   * Obtiene estadísticas del sistema
   */
  getSystemStats(): any {
    return {
      activated: this.isActivated,
      timestamp: new Date().toISOString(),
      components: {
        intelligentAutoResponse: !!intelligentAutoResponse,
        realTimeProcessor: !!realTimeMessageProcessor,
        messageIntegrator: !!whatsappMessageIntegrator
      }
    };
  }
}

export const messageSystemActivator = new MessageSystemActivator();