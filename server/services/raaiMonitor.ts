import { directOpenaiResponder } from './directOpenaiResponder';

/**
 * Monitor automático para R.A. AI - completamente independiente
 * No depende de configuraciones de agentes ni del sistema principal
 */
class RAIMonitor {
  private isMonitoring: boolean = false;
  private monitorInterval: NodeJS.Timeout | null = null;
  private processedMessages: Set<string> = new Set();
  private whatsappManager: any = null;

  constructor() {
    console.log('🤖 R.A. AI Monitor inicializado');
  }

  /**
   * Configurar el manager de WhatsApp
   */
  setWhatsAppManager(manager: any) {
    this.whatsappManager = manager;
  }

  /**
   * Iniciar monitoreo automático
   */
  startMonitoring() {
    if (this.isMonitoring) {
      console.log('⚠️ R.A. AI: Monitoreo ya está activo');
      return;
    }

    this.isMonitoring = true;
    console.log('🔄 R.A. AI: Iniciando monitoreo automático de mensajes...');

    // Monitorear cada 5 segundos
    this.monitorInterval = setInterval(async () => {
      if (directOpenaiResponder.isActive()) {
        await this.checkForNewMessages();
      }
    }, 5000);
  }

  /**
   * Detener monitoreo automático
   */
  stopMonitoring() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.isMonitoring = false;
    console.log('🛑 R.A. AI: Monitoreo detenido');
  }

  /**
   * Verificar mensajes nuevos en todas las cuentas activas
   */
  private async checkForNewMessages() {
    try {
      if (!this.whatsappManager) {
        return;
      }

      // Obtener cuentas de WhatsApp disponibles
      const accounts = await this.getAvailableAccounts();
      
      for (const account of accounts) {
        await this.processAccountMessages(account);
      }
    } catch (error) {
      console.error('❌ R.A. AI Monitor: Error verificando mensajes:', error);
    }
  }

  /**
   * Obtener cuentas de WhatsApp disponibles
   */
  private async getAvailableAccounts(): Promise<any[]> {
    try {
      // Intentar obtener cuentas activas
      return [
        { id: 1, name: 'Cuenta Principal' } // Usar cuenta ID 1 por defecto
      ];
    } catch (error) {
      return [{ id: 1, name: 'Cuenta Principal' }];
    }
  }

  /**
   * Procesar mensajes de una cuenta específica
   */
  private async processAccountMessages(account: any) {
    try {
      // Obtener chats de la cuenta
      const chats = await this.getAccountChats(account.id);
      
      for (const chat of chats) {
        await this.processChatMessages(account.id, chat.id);
      }
    } catch (error) {
      // Error silencioso para no spam en logs
    }
  }

  /**
   * Obtener chats de una cuenta
   */
  private async getAccountChats(accountId: number): Promise<any[]> {
    try {
      if (this.whatsappManager && this.whatsappManager.getChatsForAccount) {
        const chats = await this.whatsappManager.getChatsForAccount(accountId);
        return chats || [];
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Procesar mensajes de un chat específico
   */
  private async processChatMessages(accountId: number, chatId: string) {
    try {
      // Obtener mensajes del chat
      const messages = await this.getChatMessages(accountId, chatId);
      
      if (!messages || messages.length === 0) {
        return;
      }

      // Buscar mensajes nuevos no procesados del cliente
      const newMessages = messages
        .filter(msg => !msg.fromMe && !this.isMessageProcessed(msg.id))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 1); // Solo el más reciente

      for (const message of newMessages) {
        await this.processNewMessage(accountId, chatId, message, messages);
      }
    } catch (error) {
      // Error silencioso
    }
  }

  /**
   * Obtener mensajes de un chat
   */
  private async getChatMessages(accountId: number, chatId: string): Promise<any[]> {
    try {
      if (this.whatsappManager && this.whatsappManager.getMessagesForChat) {
        const messages = await this.whatsappManager.getMessagesForChat(accountId, chatId);
        return messages || [];
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Verificar si un mensaje ya fue procesado
   */
  private isMessageProcessed(messageId: string): boolean {
    return this.processedMessages.has(messageId);
  }

  /**
   * Marcar mensaje como procesado
   */
  private markMessageAsProcessed(messageId: string) {
    this.processedMessages.add(messageId);
    
    // Limpiar cache si es muy grande (mantener solo los últimos 1000)
    if (this.processedMessages.size > 1000) {
      const array = Array.from(this.processedMessages);
      this.processedMessages.clear();
      array.slice(-500).forEach(id => this.processedMessages.add(id));
    }
  }

  /**
   * Procesar un mensaje nuevo
   */
  private async processNewMessage(accountId: number, chatId: string, message: any, allMessages: any[]) {
    try {
      console.log(`🔍 R.A. AI: Nuevo mensaje detectado en ${chatId}: "${message.body?.substring(0, 50)}..."`);

      // Marcar como procesado inmediatamente para evitar duplicados
      this.markMessageAsProcessed(message.id);

      // Generar respuesta con R.A. AI
      const result = await directOpenaiResponder.processMessage(
        message.body || message.content || '',
        allMessages.slice(-10) // Últimos 10 mensajes como contexto
      );

      if (result.success) {
        // Intentar enviar respuesta
        try {
          if (this.whatsappManager && this.whatsappManager.sendMessage) {
            await this.whatsappManager.sendMessage(accountId, chatId, result.response);
            console.log(`✅ R.A. AI: Respuesta enviada automáticamente a ${chatId}`);
          } else {
            console.log(`🤖 R.A. AI: Respuesta generada: "${result.response}"`);
          }
        } catch (sendError) {
          console.log(`⚠️ R.A. AI: Respuesta generada pero no se pudo enviar: "${result.response}"`);
        }
      } else {
        console.log(`❌ R.A. AI: Error procesando mensaje: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ R.A. AI: Error procesando mensaje nuevo:`, error);
    }
  }

  /**
   * Obtener estado del monitor
   */
  getStatus() {
    return {
      monitoring: this.isMonitoring,
      processedCount: this.processedMessages.size,
      aiActive: directOpenaiResponder.isActive()
    };
  }
}

// Exportar instancia única
export const raaiMonitor = new RAIMonitor();