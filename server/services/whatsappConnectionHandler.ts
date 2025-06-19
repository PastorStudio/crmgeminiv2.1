/**
 * Manejador de conexiones WhatsApp con conversión automática
 * Se activa cuando una cuenta WhatsApp se conecta exitosamente
 */

import { autoConvertOnConnect } from './autoConvertOnConnect';
import { EventEmitter } from 'events';

class WhatsAppConnectionHandler extends EventEmitter {
  constructor() {
    super();
    console.log('🔗 WhatsAppConnectionHandler inicializado');
  }

  /**
   * Maneja cuando una cuenta WhatsApp se conecta
   */
  async handleAccountConnected(accountId: number, accountData?: any): Promise<void> {
    try {
      const accountName = accountData?.name || `Cuenta ${accountId}`;
      console.log(`🔗 Cuenta WhatsApp conectada: ${accountName} (ID: ${accountId})`);

      // Emitir evento de conexión
      this.emit('accountConnected', { accountId, accountName, accountData });

      // Ejecutar conversión automática con delay para estabilización
      setTimeout(async () => {
        try {
          await autoConvertOnConnect.onAccountConnected(accountId, accountName);
        } catch (error) {
          console.error(`❌ Error en conversión automática para cuenta ${accountId}:`, error);
        }
      }, 5000); // 5 segundos de delay

    } catch (error) {
      console.error(`❌ Error manejando conexión de cuenta ${accountId}:`, error);
    }
  }

  /**
   * Maneja cuando una cuenta WhatsApp se desconecta
   */
  async handleAccountDisconnected(accountId: number): Promise<void> {
    try {
      console.log(`🔌 Cuenta WhatsApp desconectada: ID ${accountId}`);
      this.emit('accountDisconnected', { accountId });
    } catch (error) {
      console.error(`❌ Error manejando desconexión de cuenta ${accountId}:`, error);
    }
  }

  /**
   * Maneja cambios en el estado de autenticación
   */
  async handleAuthStateChange(accountId: number, isAuthenticated: boolean): Promise<void> {
    try {
      console.log(`🔐 Estado de autenticación cambiado para cuenta ${accountId}: ${isAuthenticated ? 'autenticada' : 'no autenticada'}`);
      
      if (isAuthenticated) {
        // Account just got authenticated, trigger connection handler
        await this.handleAccountConnected(accountId);
      }
      
      this.emit('authStateChanged', { accountId, isAuthenticated });
    } catch (error) {
      console.error(`❌ Error manejando cambio de autenticación para cuenta ${accountId}:`, error);
    }
  }

  /**
   * Fuerza conversión para una cuenta específica
   */
  async forceConversionForAccount(accountId: number): Promise<any> {
    try {
      console.log(`🔄 Forzando conversión para cuenta ${accountId}...`);
      return await autoConvertOnConnect.forceConversionForAccount(accountId);
    } catch (error) {
      console.error(`❌ Error forzando conversión para cuenta ${accountId}:`, error);
      throw error;
    }
  }
}

export const whatsappConnectionHandler = new WhatsAppConnectionHandler();