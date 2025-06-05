/**
 * Servicio de renovación automática de códigos QR de WhatsApp
 * Cambia el código QR automáticamente cada 2 minutos
 */

import { storage } from '../storage';
import { whatsappMultiAccountManager } from './whatsappMultiAccountManager';

class QRAutoRefreshService {
  private refreshIntervals: Map<number, NodeJS.Timeout> = new Map();
  private whatsappManager: WhatsAppMultiAccountManager;
  private readonly REFRESH_INTERVAL = 2 * 60 * 1000; // 2 minutos en milisegundos

  constructor() {
    this.whatsappManager = WhatsAppMultiAccountManager.getInstance();
  }

  /**
   * Inicia la renovación automática de QR para una cuenta específica
   */
  startAutoRefresh(accountId: number): void {
    // Detener cualquier intervalo existente para esta cuenta
    this.stopAutoRefresh(accountId);

    console.log(`🔄 Iniciando renovación automática de QR para cuenta ${accountId} cada 2 minutos`);

    const intervalId = setInterval(async () => {
      try {
        await this.refreshQRCode(accountId);
      } catch (error) {
        console.error(`❌ Error renovando QR para cuenta ${accountId}:`, error);
      }
    }, this.REFRESH_INTERVAL);

    this.refreshIntervals.set(accountId, intervalId);
  }

  /**
   * Detiene la renovación automática para una cuenta específica
   */
  stopAutoRefresh(accountId: number): void {
    const intervalId = this.refreshIntervals.get(accountId);
    if (intervalId) {
      clearInterval(intervalId);
      this.refreshIntervals.delete(accountId);
      console.log(`⏹️ Renovación automática de QR detenida para cuenta ${accountId}`);
    }
  }

  /**
   * Renueva el código QR para una cuenta específica
   */
  private async refreshQRCode(accountId: number): Promise<void> {
    try {
      // Verificar que la cuenta existe y está activa
      const accounts = await storage.getWhatsAppAccounts();
      const account = accounts.find(acc => acc.id === accountId);
      
      if (!account) {
        console.log(`⚠️ Cuenta ${accountId} no encontrada, deteniendo renovación automática`);
        this.stopAutoRefresh(accountId);
        return;
      }

      // Solo renovar si la cuenta no está conectada
      const status = this.whatsappManager.getAccountStatus(accountId);
      if (status?.ready) {
        console.log(`✅ Cuenta ${accountId} ya está conectada, no se necesita renovar QR`);
        return;
      }

      console.log(`🔄 Renovando código QR para cuenta ${accountId}...`);

      // Desconectar el cliente actual si existe
      try {
        await this.whatsappManager.disconnectAccount(accountId);
      } catch (error) {
        console.log(`⚠️ Error desconectando cliente existente:`, error.message);
      }

      // Esperar un momento antes de generar nuevo QR
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Generar nuevo código QR
      const qrResult = await this.whatsappManager.initializeAccount(accountId);
      
      if (qrResult.success && qrResult.qrcode) {
        console.log(`✅ Código QR renovado exitosamente para cuenta ${accountId}`);
        
        // Actualizar timestamp de última actividad
        await storage.updateWhatsAppAccount(accountId, {
          lastActivity: new Date()
        });
      } else {
        console.error(`❌ Error generando nuevo QR para cuenta ${accountId}`);
      }

    } catch (error) {
      console.error(`❌ Error en renovación de QR para cuenta ${accountId}:`, error);
    }
  }

  /**
   * Inicia la renovación automática para todas las cuentas activas
   */
  async startAllAutoRefresh(): Promise<void> {
    try {
      const accounts = await storage.getWhatsAppAccounts();
      
      for (const account of accounts) {
        // Solo iniciar renovación para cuentas activas que no estén conectadas
        const status = this.whatsappManager.getAccountStatus(account.id);
        if (!status?.ready) {
          this.startAutoRefresh(account.id);
        }
      }

      console.log(`🔄 Sistema de renovación automática de QR iniciado para ${accounts.length} cuentas`);
    } catch (error) {
      console.error('❌ Error iniciando renovación automática global:', error);
    }
  }

  /**
   * Detiene la renovación automática para todas las cuentas
   */
  stopAllAutoRefresh(): void {
    for (const [accountId] of this.refreshIntervals) {
      this.stopAutoRefresh(accountId);
    }
    console.log('⏹️ Renovación automática de QR detenida para todas las cuentas');
  }

  /**
   * Obtiene el estado de renovación para una cuenta
   */
  getRefreshStatus(accountId: number): boolean {
    return this.refreshIntervals.has(accountId);
  }

  /**
   * Obtiene información de renovación para todas las cuentas
   */
  getRefreshInfo(): { accountId: number, isActive: boolean }[] {
    const info: { accountId: number, isActive: boolean }[] = [];
    
    this.refreshIntervals.forEach((_, accountId) => {
      info.push({
        accountId,
        isActive: true
      });
    });

    return info;
  }
}

// Instancia singleton
export const qrAutoRefreshService = new QRAutoRefreshService();

// Auto-iniciar cuando se importe el módulo
setTimeout(async () => {
  await qrAutoRefreshService.startAllAutoRefresh();
}, 5000); // Esperar 5 segundos después del inicio del servidor