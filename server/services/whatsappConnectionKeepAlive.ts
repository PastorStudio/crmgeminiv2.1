/**
 * Sistema avanzado de mantenimiento de conexiones WhatsApp
 * Previene desconexiones por inactividad con múltiples estrategias
 */

import { db } from '../db';
import { whatsappAccounts } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface ConnectionHealth {
  accountId: number;
  lastActivity: Date;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  failureCount: number;
  lastPing: Date;
  sessionAge: number;
}

class WhatsAppConnectionKeepAlive {
  private connections = new Map<number, ConnectionHealth>();
  private keepAliveInterval?: NodeJS.Timeout;
  private deepPingInterval?: NodeJS.Timeout;
  private sessionMonitorInterval?: NodeJS.Timeout;
  private isRunning = false;

  // Configuraciones optimizadas
  private readonly PING_INTERVAL = 30000; // 30 segundos en lugar de 5
  private readonly DEEP_PING_INTERVAL = 120000; // 2 minutos - ping profundo
  private readonly SESSION_MONITOR_INTERVAL = 300000; // 5 minutos - verificación de sesión
  private readonly MAX_FAILURE_COUNT = 3;
  private readonly SESSION_REFRESH_THRESHOLD = 12 * 60 * 60 * 1000; // 12 horas

  async initialize(): Promise<void> {
    if (this.isRunning) {
      console.log('🔒 Sistema KeepAlive ya está funcionando');
      return;
    }

    console.log('🚀 Iniciando sistema avanzado KeepAlive para WhatsApp...');
    
    try {
      await this.loadActiveConnections();
      this.startKeepAliveServices();
      this.isRunning = true;
      console.log('✅ Sistema KeepAlive iniciado correctamente');
    } catch (error) {
      console.error('❌ Error inicializando KeepAlive:', error);
    }
  }

  private async loadActiveConnections(): Promise<void> {
    try {
      const accounts = await db
        .select()
        .from(whatsappAccounts)
        .where(eq(whatsappAccounts.status, 'connected'));

      this.connections.clear();
      
      for (const account of accounts) {
        this.connections.set(account.id, {
          accountId: account.id,
          lastActivity: new Date(),
          connectionStatus: 'connected',
          failureCount: 0,
          lastPing: new Date(),
          sessionAge: 0
        });
      }

      console.log(`📋 Cargadas ${this.connections.size} conexiones activas para KeepAlive`);
    } catch (error) {
      console.error('❌ Error cargando conexiones:', error);
    }
  }

  private startKeepAliveServices(): void {
    // 1. Ping ligero cada 30 segundos
    this.keepAliveInterval = setInterval(() => {
      this.performLightPing();
    }, this.PING_INTERVAL);

    // 2. Ping profundo cada 2 minutos
    this.deepPingInterval = setInterval(() => {
      this.performDeepPing();
    }, this.DEEP_PING_INTERVAL);

    // 3. Monitor de sesiones cada 5 minutos
    this.sessionMonitorInterval = setInterval(() => {
      this.monitorSessions();
    }, this.SESSION_MONITOR_INTERVAL);

    console.log('⚡ Servicios KeepAlive iniciados:');
    console.log(`   - Ping ligero: cada ${this.PING_INTERVAL/1000}s`);
    console.log(`   - Ping profundo: cada ${this.DEEP_PING_INTERVAL/1000}s`);
    console.log(`   - Monitor sesiones: cada ${this.SESSION_MONITOR_INTERVAL/1000}s`);
  }

  private async performLightPing(): Promise<void> {
    for (const [accountId, health] of this.connections) {
      try {
        // Ping muy ligero - solo verificar estado
        const { whatsappMultiAccountManager } = await import('./whatsappMultiAccountManager');
        
        if (whatsappMultiAccountManager.isAuthenticated(accountId)) {
          // Actividad mínima para mantener sesión viva
          await this.sendKeepAliveSignal(accountId);
          
          health.lastPing = new Date();
          health.lastActivity = new Date();
          health.failureCount = 0;
          health.connectionStatus = 'connected';
          
          console.log(`💚 Ping ligero exitoso - Cuenta ${accountId}`);
        } else {
          this.handleConnectionFailure(accountId, health);
        }
      } catch (error) {
        console.error(`❌ Error ping ligero cuenta ${accountId}:`, error);
        this.handleConnectionFailure(accountId, health);
      }
    }
  }

  private async performDeepPing(): Promise<void> {
    for (const [accountId, health] of this.connections) {
      try {
        console.log(`🔍 Realizando ping profundo - Cuenta ${accountId}`);
        
        const { whatsappMultiAccountManager } = await import('./whatsappMultiAccountManager');
        
        // Verificación profunda del estado de la conexión
        const isAuth = whatsappMultiAccountManager.isAuthenticated(accountId);
        const client = whatsappMultiAccountManager.getClient(accountId);
        
        if (isAuth && client) {
          // Operaciones para mantener conexión activa
          await this.performMaintenanceOperations(accountId, client);
          
          health.connectionStatus = 'connected';
          health.failureCount = 0;
          console.log(`✅ Ping profundo exitoso - Cuenta ${accountId}`);
        } else {
          await this.attemptReconnection(accountId, health);
        }
      } catch (error) {
        console.error(`❌ Error ping profundo cuenta ${accountId}:`, error);
        await this.attemptReconnection(accountId, health);
      }
    }
  }

  private async sendKeepAliveSignal(accountId: number): Promise<void> {
    try {
      const { whatsappMultiAccountManager } = await import('./whatsappMultiAccountManager');
      const client = whatsappMultiAccountManager.getClient(accountId);
      
      if (client) {
        // Señal mínima para mantener conexión
        await client.pupPage?.evaluate(() => {
          // Actividad mínima en la página para evitar timeout
          return window.location.href;
        });
      }
    } catch (error) {
      // Error silencioso para evitar spam en logs
    }
  }

  private async performMaintenanceOperations(accountId: number, client: any): Promise<void> {
    try {
      // 1. Verificar estado de la conexión WebSocket
      const info = await client.info?.catch(() => null);
      
      // 2. Refrescar tokens si es necesario
      if (client.pupPage) {
        await client.pupPage.evaluate(() => {
          // Mantener la sesión activa ejecutando JavaScript mínimo
          if (window.Store && window.Store.State) {
            return window.Store.State.state;
          }
          return 'active';
        });
      }

      // 3. Verificar y limpiar memoria si es necesario
      await this.performMemoryCleanup(accountId);
      
    } catch (error) {
      console.error(`❌ Error operaciones mantenimiento cuenta ${accountId}:`, error);
    }
  }

  private async performMemoryCleanup(accountId: number): Promise<void> {
    try {
      const { whatsappMultiAccountManager } = await import('./whatsappMultiAccountManager');
      const client = whatsappMultiAccountManager.getClient(accountId);
      
      if (client?.pupPage) {
        // Limpiar memoria del navegador para evitar crashes
        await client.pupPage.evaluate(() => {
          if (window.gc) {
            window.gc();
          }
          // Limpiar caché de mensajes antiguos
          if (window.Store && window.Store.Msg) {
            const msgs = window.Store.Msg.models;
            if (msgs && msgs.length > 1000) {
              // Mantener solo los últimos 500 mensajes
              msgs.splice(0, msgs.length - 500);
            }
          }
        });
      }
    } catch (error) {
      // Error silencioso
    }
  }

  private async monitorSessions(): Promise<void> {
    console.log('📊 Monitoreando sesiones WhatsApp...');
    
    for (const [accountId, health] of this.connections) {
      try {
        // Calcular edad de la sesión
        health.sessionAge = Date.now() - health.lastActivity.getTime();
        
        // Si la sesión es muy antigua, refrescarla
        if (health.sessionAge > this.SESSION_REFRESH_THRESHOLD) {
          console.log(`🔄 Sesión antigua detectada - Cuenta ${accountId}, refrescando...`);
          await this.refreshSession(accountId);
        }
        
        // Verificar salud general de la conexión
        if (health.failureCount >= this.MAX_FAILURE_COUNT) {
          console.log(`⚠️ Demasiados fallos - Cuenta ${accountId}, iniciando recuperación...`);
          await this.initiateSessionRecovery(accountId);
        }
        
        // Actualizar estado en base de datos
        await this.updateConnectionStatus(accountId, health);
        
      } catch (error) {
        console.error(`❌ Error monitoreando cuenta ${accountId}:`, error);
      }
    }
  }

  private async refreshSession(accountId: number): Promise<void> {
    try {
      const { whatsappMultiAccountManager } = await import('./whatsappMultiAccountManager');
      
      // Refrescar sesión sin desconectar
      await whatsappMultiAccountManager.refreshConnection(accountId);
      
      const health = this.connections.get(accountId);
      if (health) {
        health.lastActivity = new Date();
        health.sessionAge = 0;
        health.failureCount = 0;
      }
      
      console.log(`✅ Sesión refrescada - Cuenta ${accountId}`);
    } catch (error) {
      console.error(`❌ Error refrescando sesión cuenta ${accountId}:`, error);
    }
  }

  private async initiateSessionRecovery(accountId: number): Promise<void> {
    try {
      console.log(`🔧 Iniciando recuperación de sesión - Cuenta ${accountId}`);
      
      const { WhatsAppSessionRecovery } = await import('./whatsappSessionRecovery');
      const recovery = WhatsAppSessionRecovery.getInstance();
      
      // Intentar recuperación sin perder datos
      const success = await recovery.attemptGracefulRecovery(accountId);
      
      if (success) {
        const health = this.connections.get(accountId);
        if (health) {
          health.failureCount = 0;
          health.connectionStatus = 'connected';
          health.lastActivity = new Date();
        }
        console.log(`✅ Recuperación exitosa - Cuenta ${accountId}`);
      } else {
        console.log(`❌ Recuperación fallida - Cuenta ${accountId}`);
      }
    } catch (error) {
      console.error(`❌ Error recuperación cuenta ${accountId}:`, error);
    }
  }

  private handleConnectionFailure(accountId: number, health: ConnectionHealth): void {
    health.failureCount++;
    health.connectionStatus = 'disconnected';
    
    if (health.failureCount <= this.MAX_FAILURE_COUNT) {
      console.log(`⚠️ Fallo conexión ${health.failureCount}/${this.MAX_FAILURE_COUNT} - Cuenta ${accountId}`);
    }
  }

  private async attemptReconnection(accountId: number, health: ConnectionHealth): Promise<void> {
    try {
      health.connectionStatus = 'reconnecting';
      console.log(`🔄 Intentando reconexión - Cuenta ${accountId}`);
      
      const { whatsappMultiAccountManager } = await import('./whatsappMultiAccountManager');
      await whatsappMultiAccountManager.reconnectAccount(accountId);
      
      health.connectionStatus = 'connected';
      health.failureCount = 0;
      health.lastActivity = new Date();
      
      console.log(`✅ Reconexión exitosa - Cuenta ${accountId}`);
    } catch (error) {
      console.error(`❌ Error reconexión cuenta ${accountId}:`, error);
      this.handleConnectionFailure(accountId, health);
    }
  }

  private async updateConnectionStatus(accountId: number, health: ConnectionHealth): Promise<void> {
    try {
      await db
        .update(whatsappAccounts)
        .set({ 
          lastActiveAt: health.lastActivity,
          status: health.connectionStatus === 'connected' ? 'connected' : 'disconnected'
        })
        .where(eq(whatsappAccounts.id, accountId));
    } catch (error) {
      // Error silencioso para evitar spam
    }
  }

  // Método para agregar nueva conexión dinámicamente
  async addConnection(accountId: number): Promise<void> {
    this.connections.set(accountId, {
      accountId,
      lastActivity: new Date(),
      connectionStatus: 'connected',
      failureCount: 0,
      lastPing: new Date(),
      sessionAge: 0
    });
    console.log(`➕ Nueva conexión agregada al KeepAlive - Cuenta ${accountId}`);
  }

  // Método para remover conexión
  async removeConnection(accountId: number): Promise<void> {
    this.connections.delete(accountId);
    console.log(`➖ Conexión removida del KeepAlive - Cuenta ${accountId}`);
  }

  // Obtener estado del sistema
  getStatus(): any {
    const connections = Array.from(this.connections.entries()).map(([id, health]) => ({
      accountId: id,
      status: health.connectionStatus,
      lastActivity: health.lastActivity,
      failureCount: health.failureCount,
      sessionAge: Math.floor(health.sessionAge / 1000 / 60) // en minutos
    }));

    return {
      isRunning: this.isRunning,
      totalConnections: this.connections.size,
      activeConnections: connections.filter(c => c.status === 'connected').length,
      connections,
      intervals: {
        lightPing: this.PING_INTERVAL / 1000,
        deepPing: this.DEEP_PING_INTERVAL / 1000,
        sessionMonitor: this.SESSION_MONITOR_INTERVAL / 1000
      }
    };
  }

  async stop(): Promise<void> {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = undefined;
    }
    
    if (this.deepPingInterval) {
      clearInterval(this.deepPingInterval);
      this.deepPingInterval = undefined;
    }
    
    if (this.sessionMonitorInterval) {
      clearInterval(this.sessionMonitorInterval);
      this.sessionMonitorInterval = undefined;
    }
    
    this.isRunning = false;
    console.log('🛑 Sistema KeepAlive detenido');
  }
}

// Exportar instancia única
export const whatsappKeepAlive = new WhatsAppConnectionKeepAlive();