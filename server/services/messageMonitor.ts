/**
 * Monitor de mensajes entrantes en tiempo real
 * Detecta nuevos mensajes y los procesa automáticamente con agentes externos
 */
import { autoMessageProcessor } from './autoMessageProcessor';
import { db } from '../db';
import { externalAgents, autoResponseConfig } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

interface MonitoredMessage {
  id: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  chatId: string;
  accountId: number;
  contactName?: string;
}

class MessageMonitor {
  private lastMessageTimestamps = new Map<string, number>(); // chatId -> timestamp
  private monitoringActive = false;
  private monitorInterval: NodeJS.Timeout | null = null;

  /**
   * Inicia el monitoreo de mensajes para todas las cuentas activas
   */
  startMonitoring(): void {
    if (this.monitoringActive) {
      console.log('🔄 Monitor de mensajes ya está activo');
      return;
    }

    console.log('🚀 Iniciando monitor automático de mensajes entrantes');
    this.monitoringActive = true;

    // Monitorear cada 10 segundos
    this.monitorInterval = setInterval(async () => {
      await this.checkForNewMessages();
    }, 10000);

    console.log('✅ Monitor de mensajes iniciado - revisando cada 10 segundos');
  }

  /**
   * Detiene el monitoreo
   */
  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.monitoringActive = false;
    console.log('🛑 Monitor de mensajes detenido');
  }

  /**
   * Verifica si hay nuevos mensajes en todas las cuentas activas
   */
  private async checkForNewMessages(): Promise<void> {
    try {
      console.log('🔍 Verificando nuevos mensajes...');

      // Obtener todas las cuentas que tienen agentes externos asignados
      const accountsWithAgents = await this.getAccountsWithAgents();
      
      if (accountsWithAgents.length === 0) {
        console.log('⏸️ No hay cuentas con agentes asignados para monitorear');
        return;
      }

      console.log(`🔍 Monitoreando ${accountsWithAgents.length} cuentas con agentes asignados`);

      // Verificar mensajes nuevos para cada cuenta
      for (const accountId of accountsWithAgents) {
        await this.checkAccountMessages(accountId);
      }

    } catch (error) {
      console.error('❌ Error en verificación de mensajes:', error);
    }
  }

  /**
   * Obtiene las cuentas que tienen agentes externos asignados y respuestas automáticas habilitadas
   */
  private async getAccountsWithAgents(): Promise<number[]> {
    try {
      // Obtener cuentas con agentes asignados y activos
      const agentsResult = await db
        .select({ accountId: externalAgents.accountId })
        .from(externalAgents)
        .where(eq(externalAgents.isActive, true));

      const accountIds = [...new Set(agentsResult.map(a => a.accountId))];

      // Filtrar solo cuentas con respuestas automáticas habilitadas
      const activeAccounts: number[] = [];
      
      for (const accountId of accountIds) {
        const [config] = await db
          .select()
          .from(autoResponseConfig)
          .where(and(
            eq(autoResponseConfig.accountId, accountId),
            eq(autoResponseConfig.enabled, true)
          ));

        if (config) {
          activeAccounts.push(accountId);
        }
      }

      return activeAccounts;
    } catch (error) {
      console.error('❌ Error obteniendo cuentas con agentes:', error);
      return [];
    }
  }

  /**
   * Verifica mensajes nuevos para una cuenta específica
   */
  private async checkAccountMessages(accountId: number): Promise<void> {
    try {
      // Obtener chats de la cuenta
      const chatsResponse = await fetch(`http://localhost:5000/api/whatsapp-accounts/${accountId}/chats`);
      
      if (!chatsResponse.ok) {
        console.log(`⚠️ No se pudieron obtener chats para cuenta ${accountId}`);
        return;
      }

      const chats = await chatsResponse.json();
      
      if (!Array.isArray(chats) || chats.length === 0) {
        return;
      }

      console.log(`🔍 Verificando ${chats.length} chats en cuenta ${accountId}`);

      // Verificar cada chat
      for (const chat of chats) {
        await this.checkChatMessages(accountId, chat);
      }

    } catch (error) {
      console.error(`❌ Error verificando mensajes de cuenta ${accountId}:`, error);
    }
  }

  /**
   * Verifica mensajes nuevos en un chat específico
   */
  private async checkChatMessages(accountId: number, chat: any): Promise<void> {
    try {
      const chatId = chat.id;
      const lastKnownTimestamp = this.lastMessageTimestamps.get(chatId) || 0;

      // Obtener mensajes del chat
      const messagesResponse = await fetch(`http://localhost:5000/api/whatsapp-accounts/${accountId}/messages/${chatId}`);
      
      if (!messagesResponse.ok) {
        return;
      }

      const messages = await messagesResponse.json();
      
      if (!Array.isArray(messages) || messages.length === 0) {
        return;
      }

      // Filtrar mensajes nuevos (posteriores al último timestamp conocido)
      const newMessages = messages.filter((msg: any) => 
        msg.timestamp > lastKnownTimestamp && !msg.fromMe
      );

      if (newMessages.length === 0) {
        return;
      }

      console.log(`🟢 ${newMessages.length} mensajes nuevos detectados en chat ${chatId}`);

      // Actualizar timestamp del último mensaje
      const latestTimestamp = Math.max(...messages.map((msg: any) => msg.timestamp));
      this.lastMessageTimestamps.set(chatId, latestTimestamp);

      // Procesar cada mensaje nuevo
      for (const message of newMessages) {
        const processableMessage: MonitoredMessage = {
          id: message.id,
          body: message.body || '',
          fromMe: message.fromMe,
          timestamp: message.timestamp,
          chatId: chatId,
          accountId: accountId,
          contactName: chat.name || 'Cliente'
        };

        console.log(`🤖 Procesando mensaje entrante: "${message.body?.substring(0, 50)}..."`);
        
        // Procesar con agente externo
        await autoMessageProcessor.processIncomingMessage(processableMessage);
        
        // Pausa pequeña entre procesamiento de mensajes
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error(`❌ Error verificando chat ${chat.id}:`, error);
    }
  }

  /**
   * Obtiene el estado actual del monitor
   */
  getStatus() {
    return {
      active: this.monitoringActive,
      monitoredChats: this.lastMessageTimestamps.size,
      lastCheck: new Date().toISOString()
    };
  }
}

// Exportar instancia singleton
export const messageMonitor = new MessageMonitor();

// Auto-inicializar el monitor
console.log('🔧 Inicializando monitor de mensajes...');
setTimeout(() => {
  messageMonitor.startMonitoring();
}, 5000); // Esperar 5 segundos antes de iniciar