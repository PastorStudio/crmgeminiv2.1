/**
 * Servicio para conversión automática al conectar cuenta WhatsApp
 * Ejecuta la conversión de chats a leads automáticamente cuando una cuenta se conecta
 */

import { automaticChatToLeadService } from './automaticChatToLeadService';
import { EventEmitter } from 'events';

class AutoConvertOnConnect extends EventEmitter {
  private processingAccounts = new Set<number>();

  constructor() {
    super();
    console.log('🔄 AutoConvertOnConnect inicializado');
  }

  /**
   * Ejecuta conversión automática cuando una cuenta se conecta
   */
  async onAccountConnected(accountId: number, accountName: string): Promise<void> {
    try {
      // Evitar procesamiento duplicado
      if (this.processingAccounts.has(accountId)) {
        console.log(`⏳ Cuenta ${accountId} ya está siendo procesada`);
        return;
      }

      this.processingAccounts.add(accountId);
      console.log(`🚀 Iniciando conversión automática para cuenta: ${accountName} (ID: ${accountId})`);

      // Espera breve para que la conexión se estabilice
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Ejecutar conversión automática
      const result = await automaticChatToLeadService.processAllChatsToLeads();
      
      console.log(`✅ Conversión automática completada para cuenta ${accountId}:`);
      console.log(`   📊 Procesados: ${result.processed}`);
      console.log(`   ✨ Convertidos: ${result.converted}`);
      console.log(`   ⏭️ Omitidos: ${result.skipped}`);
      console.log(`   🧹 Duplicados removidos: ${result.duplicatesRemoved}`);

      // Emitir evento de completación
      this.emit('conversionComplete', {
        accountId,
        accountName,
        result
      });

    } catch (error) {
      console.error(`❌ Error en conversión automática para cuenta ${accountId}:`, error);
    } finally {
      this.processingAccounts.delete(accountId);
    }
  }

  /**
   * Forzar conversión para una cuenta específica
   */
  async forceConversionForAccount(accountId: number): Promise<any> {
    try {
      console.log(`🔄 Forzando conversión para cuenta ${accountId}...`);
      
      const result = await automaticChatToLeadService.processAllChatsToLeads();
      
      console.log(`✅ Conversión forzada completada para cuenta ${accountId}`);
      return result;
      
    } catch (error) {
      console.error(`❌ Error en conversión forzada para cuenta ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Conversión automática para todas las cuentas conectadas
   */
  async convertAllConnectedAccounts(): Promise<any> {
    try {
      console.log('🔄 Iniciando conversión automática para todas las cuentas...');
      
      const result = await automaticChatToLeadService.processAllChatsToLeads();
      
      console.log('✅ Conversión automática global completada');
      return result;
      
    } catch (error) {
      console.error('❌ Error en conversión automática global:', error);
      throw error;
    }
  }
}

export const autoConvertOnConnect = new AutoConvertOnConnect();