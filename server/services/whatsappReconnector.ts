/**
 * Servicio para asegurar la reconexión automática de WhatsApp
 * Este servicio monitorea el estado de la conexión y realiza reconexiones automáticas
 * cuando detecta problemas de conectividad.
 */

import { whatsappService } from './whatsappServiceImpl';

class WhatsAppReconnector {
  private reconnectionTimer: NodeJS.Timeout | null = null;
  private monitoringTimer: NodeJS.Timeout | null = null;
  private consecutiveFailures: number = 0;
  private maxConsecutiveFailures: number = 5;
  private baseReconnectionDelay: number = 10000; // 10 segundos
  private reconnectionInProgress: boolean = false;

  constructor() {
    console.log('Inicializando WhatsAppReconnector...');
  }

  /**
   * Inicia el monitoreo de la conexión
   */
  startMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }

    console.log('Iniciando monitoreo de conexión WhatsApp...');
    
    // Verificar la conexión cada 30 segundos
    this.monitoringTimer = setInterval(() => {
      this.checkAndReconnectIfNeeded();
    }, 30000);

    // Ejecutar una verificación inicial inmediata
    this.checkAndReconnectIfNeeded();
  }

  /**
   * Detiene el monitoreo de la conexión
   */
  stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
    
    if (this.reconnectionTimer) {
      clearTimeout(this.reconnectionTimer);
      this.reconnectionTimer = null;
    }
    
    console.log('Monitoreo de conexión WhatsApp detenido');
  }

  /**
   * Verifica la conexión y reconecta si es necesario
   */
  private async checkAndReconnectIfNeeded(): Promise<void> {
    if (this.reconnectionInProgress) {
      console.log('Reconexión ya en progreso, saltando verificación');
      return;
    }

    try {
      console.log('Verificando estado de conexión WhatsApp...');
      const status = await whatsappService.getStatus();
      
      // Si el cliente no está inicializado o autenticado, intentar reconectar
      if (!status.initialized || !status.authenticated || !status.ready) {
        console.log('Cliente WhatsApp no está correctamente conectado, intentando reconectar...');
        this.consecutiveFailures++;
        await this.triggerReconnection();
      } else {
        // La conexión parece estar bien, resetear contador
        if (this.consecutiveFailures > 0) {
          console.log('Conexión restablecida, reseteando contador de fallos');
          this.consecutiveFailures = 0;
        }
      }
    } catch (error) {
      console.error('Error verificando estado de WhatsApp:', error);
      this.consecutiveFailures++;
      
      // Si alcanzamos el límite de fallos consecutivos, intentar una reconexión más agresiva
      if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
        console.log(`Detectados ${this.consecutiveFailures} fallos consecutivos, iniciando reconexión agresiva...`);
        await this.triggerAggressiveReconnection();
      } else {
        await this.triggerReconnection();
      }
    }
  }

  /**
   * Inicia un proceso de reconexión normal
   */
  private async triggerReconnection(): Promise<void> {
    if (this.reconnectionInProgress) return;
    
    this.reconnectionInProgress = true;
    
    try {
      console.log('Iniciando reconexión automática de WhatsApp...');
      
      // Intentar inicializar el servicio
      await whatsappService.initialize();
      
      // Verificar si realmente funcionó
      const status = await whatsappService.getStatus();
      if (status.authenticated && status.ready) {
        console.log('Reconexión automática exitosa');
        this.consecutiveFailures = 0;
      } else {
        console.log('La reconexión automática no fue completamente exitosa, programa nueva verificación');
        
        // Si no funcionó completamente, programar una nueva verificación
        if (this.reconnectionTimer) {
          clearTimeout(this.reconnectionTimer);
        }
        
        const delay = this.baseReconnectionDelay * Math.min(this.consecutiveFailures, 5);
        this.reconnectionTimer = setTimeout(() => {
          this.checkAndReconnectIfNeeded();
        }, delay);
      }
    } catch (error) {
      console.error('Error en reconexión automática:', error);
    } finally {
      this.reconnectionInProgress = false;
    }
  }

  /**
   * Inicia un proceso de reconexión agresivo que incluye reinicio completo
   */
  private async triggerAggressiveReconnection(): Promise<void> {
    if (this.reconnectionInProgress) return;
    
    this.reconnectionInProgress = true;
    
    try {
      console.log('Iniciando reconexión agresiva de WhatsApp...');
      
      // Intentar reiniciar completamente el servicio
      await whatsappService.restart();
      
      // Verificar si realmente funcionó
      const status = await whatsappService.getStatus();
      if (status.authenticated && status.ready) {
        console.log('Reconexión agresiva exitosa');
        this.consecutiveFailures = 0;
      } else {
        console.log('La reconexión agresiva no fue completamente exitosa');
        
        // Programar otra verificación con un retraso mayor
        if (this.reconnectionTimer) {
          clearTimeout(this.reconnectionTimer);
        }
        
        this.reconnectionTimer = setTimeout(() => {
          this.checkAndReconnectIfNeeded();
        }, 60000); // Esperar 1 minuto antes del siguiente intento
      }
    } catch (error) {
      console.error('Error en reconexión agresiva:', error);
    } finally {
      this.reconnectionInProgress = false;
    }
  }
}

// Exportar una instancia singleton
export const whatsappReconnector = new WhatsAppReconnector();