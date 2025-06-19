/**
 * Estabilizador de conexiones WhatsApp
 * Previene ciclos destructivos de reconexión para cuenta ID 1
 */

class WhatsAppConnectionStabilizer {
  private static connectionStates: Map<number, {
    lastInitialization: number;
    initializationCount: number;
    isStable: boolean;
    blockReconnection: boolean;
  }> = new Map();

  /**
   * Verifica si una cuenta puede ser inicializada
   */
  static canInitialize(accountId: number): boolean {
    const state = this.connectionStates.get(accountId);
    const now = Date.now();
    
    if (!state) {
      // Primera inicialización
      this.connectionStates.set(accountId, {
        lastInitialization: now,
        initializationCount: 1,
        isStable: false,
        blockReconnection: false
      });
      return true;
    }
    
    // Si hay demasiadas inicializaciones en poco tiempo, bloquear
    if (state.initializationCount > 5 && (now - state.lastInitialization) < 300000) { // 5 minutos
      console.log(`🚫 Bloqueando inicialización frecuente para cuenta ${accountId}`);
      state.blockReconnection = true;
      return false;
    }
    
    // Si está bloqueado, verificar si ya pasó suficiente tiempo
    if (state.blockReconnection && (now - state.lastInitialization) < 600000) { // 10 minutos
      console.log(`⏳ Cuenta ${accountId} sigue bloqueada por reconexiones frecuentes`);
      return false;
    }
    
    // Permitir inicialización y actualizar estado
    state.lastInitialization = now;
    state.initializationCount++;
    state.blockReconnection = false;
    
    return true;
  }
  
  /**
   * Marca una cuenta como estable
   */
  static markAsStable(accountId: number): void {
    const state = this.connectionStates.get(accountId);
    if (state) {
      state.isStable = true;
      state.blockReconnection = false;
      console.log(`✅ Cuenta ${accountId} marcada como estable`);
    }
  }
  
  /**
   * Verifica si una cuenta está estable
   */
  static isStable(accountId: number): boolean {
    const state = this.connectionStates.get(accountId);
    return state ? state.isStable : false;
  }
  
  /**
   * Resetea el estado de una cuenta
   */
  static reset(accountId: number): void {
    this.connectionStates.delete(accountId);
    console.log(`🔄 Estado reseteado para cuenta ${accountId}`);
  }
  
  /**
   * Obtiene estadísticas de una cuenta
   */
  static getStats(accountId: number): any {
    const state = this.connectionStates.get(accountId);
    if (!state) return null;
    
    return {
      initializationCount: state.initializationCount,
      isStable: state.isStable,
      isBlocked: state.blockReconnection,
      lastInitialization: new Date(state.lastInitialization).toISOString()
    };
  }
}

export { WhatsAppConnectionStabilizer };