import { agentAssignmentService } from './agentAssignmentService';

/**
 * Integrador de asignaciones de agentes invisible
 * Este servicio funciona en segundo plano sin que el usuario final lo note
 * Asigna automáticamente chats a agentes basándose en reglas de negocio
 */

interface ChatData {
  id: string;
  name: string;
  accountId: number;
  lastMessage?: string;
  timestamp?: string;
}

export class InvisibleAgentIntegrator {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private processedChats = new Set<string>();

  /**
   * Iniciar el integrador invisible
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('🔄 Integrador de agentes ya está ejecutándose');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Iniciando integrador invisible de asignaciones de agentes');

    // DESACTIVADO: Sistema automático deshabilitado para permitir asignaciones manuales
    console.log('⚠️ Sistema de asignación automática DESACTIVADO para pruebas manuales');
    // await this.processExistingChats();

    // DESACTIVADO: No configurar intervalo automático
    // this.intervalId = setInterval(async () => {
    //   await this.processNewChats();
    // }, 30000);

    console.log('✅ Integrador invisible de agentes iniciado exitosamente');
  }

  /**
   * Detener el integrador invisible
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('🛑 Integrador invisible de agentes detenido');
  }

  /**
   * Procesar chats existentes en el sistema
   */
  private async processExistingChats(): Promise<void> {
    try {
      console.log('🔍 Procesando chats existentes para asignación invisible...');

      // Obtener chats de todas las cuentas activas
      const accounts = await this.getActiveAccounts();
      
      for (const account of accounts) {
        const chats = await this.getChatsForAccount(account.id);
        
        for (const chat of chats) {
          await this.processChat(chat, account.id);
        }
      }

      console.log(`✅ Procesados ${this.processedChats.size} chats para asignación invisible`);
    } catch (error) {
      console.error('❌ Error procesando chats existentes:', error);
    }
  }

  /**
   * Procesar nuevos chats que lleguen al sistema
   */
  private async processNewChats(): Promise<void> {
    try {
      const accounts = await this.getActiveAccounts();
      
      for (const account of accounts) {
        const chats = await this.getChatsForAccount(account.id);
        
        for (const chat of chats) {
          const chatKey = `${account.id}_${chat.id}`;
          
          // Solo procesar chats que no hemos visto antes
          if (!this.processedChats.has(chatKey)) {
            console.log(`🆕 Nuevo chat detectado: ${chat.name || chat.id}`);
            await this.processChat(chat, account.id);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error procesando nuevos chats:', error);
    }
  }

  /**
   * Procesar un chat individual para asignación
   */
  private async processChat(chat: ChatData, accountId: number): Promise<void> {
    try {
      const chatKey = `${accountId}_${chat.id}`;
      
      // Marcar como procesado para evitar reprocesamiento
      this.processedChats.add(chatKey);

      // Verificar si ya tiene asignación activa
      const existingAssignment = await agentAssignmentService.getChatAssignment(chat.id, accountId);
      
      if (existingAssignment) {
        console.log(`👤 Chat ${chat.name || chat.id} ya asignado a ${existingAssignment.agentName}`);
        return;
      }

      // Determinar categoría basada en el contenido del chat
      const category = this.determineCategory(chat);

      // Asignar automáticamente basándose en carga de trabajo
      const assignment = await agentAssignmentService.autoAssignChat(
        chat.id,
        accountId,
        category
      );

      if (assignment) {
        console.log(`✨ Chat ${chat.name || chat.id} asignado invisiblemente a ${assignment.agentName}`);
        
        // Registrar actividad del chat
        await agentAssignmentService.updateChatActivity(chat.id, accountId);
      } else {
        console.log(`⚠️ No se pudo asignar chat ${chat.name || chat.id} - sin agentes disponibles`);
      }
    } catch (error) {
      console.error(`❌ Error procesando chat ${chat.id}:`, error);
    }
  }

  /**
   * Determinar categoría del chat basándose en su contenido
   */
  private determineCategory(chat: ChatData): string {
    const lastMessage = chat.lastMessage?.toLowerCase() || '';
    const chatName = chat.name?.toLowerCase() || '';

    // Reglas simples de categorización
    if (lastMessage.includes('precio') || lastMessage.includes('costo') || lastMessage.includes('venta')) {
      return 'ventas';
    }
    
    if (lastMessage.includes('problema') || lastMessage.includes('error') || lastMessage.includes('ayuda')) {
      return 'soporte';
    }
    
    if (lastMessage.includes('información') || lastMessage.includes('consulta')) {
      return 'informacion';
    }
    
    // Categoría por defecto
    return 'general';
  }

  /**
   * Obtener cuentas activas del sistema
   */
  private async getActiveAccounts(): Promise<Array<{id: number, name: string}>> {
    try {
      // Simular obtención de cuentas activas
      // En un entorno real, esto vendría de la base de datos
      return [
        { id: 1, name: 'WhatsApp' },
        { id: 2, name: 'com' }
      ];
    } catch (error) {
      console.error('Error obteniendo cuentas activas:', error);
      return [];
    }
  }

  /**
   * Obtener chats para una cuenta específica
   */
  private async getChatsForAccount(accountId: number): Promise<ChatData[]> {
    try {
      // Simular obtención de chats
      // En un entorno real, esto vendría del servicio de WhatsApp
      const response = await fetch(`http://localhost:5000/api/whatsapp-accounts/${accountId}/chats`);
      if (!response.ok) return [];
      
      const chats = await response.json();
      return chats.map((chat: any) => ({
        id: chat.id,
        name: chat.name,
        accountId,
        lastMessage: chat.lastMessage?.body || '',
        timestamp: chat.timestamp
      }));
    } catch (error) {
      console.error(`Error obteniendo chats para cuenta ${accountId}:`, error);
      return [];
    }
  }

  /**
   * Obtener estadísticas del integrador
   */
  getStats(): {
    isRunning: boolean;
    processedChats: number;
    uptime: string;
  } {
    return {
      isRunning: this.isRunning,
      processedChats: this.processedChats.size,
      uptime: this.isRunning ? 'Activo' : 'Detenido'
    };
  }

  /**
   * Forzar procesamiento de un chat específico
   */
  async forceProcessChat(chatId: string, accountId: number): Promise<boolean> {
    try {
      console.log(`🔄 Forzando procesamiento de chat ${chatId} en cuenta ${accountId}`);
      
      const chats = await this.getChatsForAccount(accountId);
      const chat = chats.find(c => c.id === chatId);
      
      if (!chat) {
        console.log(`❌ Chat ${chatId} no encontrado`);
        return false;
      }

      // Remover de procesados para forzar reprocesamiento
      const chatKey = `${accountId}_${chatId}`;
      this.processedChats.delete(chatKey);
      
      await this.processChat(chat, accountId);
      return true;
    } catch (error) {
      console.error(`❌ Error forzando procesamiento de chat ${chatId}:`, error);
      return false;
    }
  }
}

// Instancia singleton del integrador invisible
export const invisibleAgentIntegrator = new InvisibleAgentIntegrator();