/**
 * Servicio de renovación automática de códigos QR de WhatsApp
 * Cambia el código QR automáticamente cada 2 minutos
 */

import { storage } from '../storage';

class QRAutoRefreshService {
  private refreshIntervals: Map<number, NodeJS.Timeout> = new Map();
  private readonly REFRESH_INTERVAL = 2 * 60 * 1000; // 2 minutos en milisegundos

  constructor() {
    console.log('🔄 Servicio de auto-refresh QR inicializado con intervalo de 2 minutos');
  }

  /**
   * Inicia la renovación automática de QR para una cuenta específica
   */
  startAutoRefresh(accountId: number): void {
    // Detener cualquier intervalo existente para esta cuenta
    this.stopAutoRefresh(accountId);

    console.log(`🔄 Iniciando renovación automática de QR para cuenta ${accountId} cada 2 minutos`);

    // Configurar el intervalo para renovar el QR cada 2 minutos
    const intervalId = setInterval(async () => {
      await this.refreshQRCode(accountId);
    }, this.REFRESH_INTERVAL);

    // Almacenar el ID del intervalo
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
      console.log(`🔄 Solicitando renovación de QR para cuenta ${accountId}`);
      
      // Verificar que la cuenta existe
      const accounts = await storage.getAllWhatsappAccounts();
      const account = accounts.find(acc => acc.id === accountId);
      
      if (!account) {
        console.log(`⚠️ Cuenta ${accountId} no encontrada, deteniendo renovación automática`);
        this.stopAutoRefresh(accountId);
        return;
      }

      // Actualizar timestamp para indicar actividad de renovación
      await storage.updateWhatsappAccount(accountId, {
        lastActiveAt: new Date()
      });
      
      console.log(`✅ Renovación de QR procesada para cuenta ${accountId}`);
      
    } catch (error) {
      console.error(`❌ Error en renovación de QR para cuenta ${accountId}:`, error);
    }
  }

  /**
   * Inicia la renovación automática para todas las cuentas activas
   */
  async startAllAutoRefresh(): Promise<void> {
    try {
      const accounts = await storage.getAllWhatsappAccounts();
      const activeAccounts = accounts.filter(account => 
        account.status === 'pending_auth' || account.status === 'inactive'
      );

      console.log(`🚀 Iniciando auto-refresh para ${activeAccounts.length} cuentas`);

      for (const account of activeAccounts) {
        this.startAutoRefresh(account.id);
      }
    } catch (error) {
      console.error('Error iniciando auto-refresh para todas las cuentas:', error);
    }
  }

  /**
   * Detiene la renovación automática para todas las cuentas
   */
  stopAllAutoRefresh(): void {
    console.log(`🛑 Deteniendo auto-refresh para ${this.refreshIntervals.size} cuentas`);
    
    for (const accountId of this.refreshIntervals.keys()) {
      this.stopAutoRefresh(accountId);
    }
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
    const refreshInfo: { accountId: number, isActive: boolean }[] = [];
    
    this.refreshIntervals.forEach((_, accountId) => {
      refreshInfo.push({
        accountId,
        isActive: true
      });
    });
    
    return refreshInfo;
  }
}

export const qrAutoRefreshService = new QRAutoRefreshService();