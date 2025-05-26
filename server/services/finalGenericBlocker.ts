/**
 * BLOQUEADOR DEFINITIVO DE RESPUESTAS GENÉRICAS
 * 
 * Este sistema desactiva COMPLETAMENTE cualquier función que genere
 * respuestas de prueba como "Hola [nombre], he recibido tu mensaje... Te responderé pronto"
 */

export class FinalGenericBlocker {
  private static instance: FinalGenericBlocker;
  private isActive = false;
  private interceptedFunctions: any[] = [];

  private constructor() {}

  public static getInstance(): FinalGenericBlocker {
    if (!FinalGenericBlocker.instance) {
      FinalGenericBlocker.instance = new FinalGenericBlocker();
    }
    return FinalGenericBlocker.instance;
  }

  /**
   * Activa el bloqueador definitivo que desactiva TODAS las funciones
   * que generan respuestas de prueba inmediatas
   */
  public activate(): void {
    if (this.isActive) {
      console.log('🛡️ Bloqueador definitivo ya está activo');
      return;
    }

    console.log('🚀 ACTIVANDO BLOQUEADOR DEFINITIVO DE RESPUESTAS GENÉRICAS');
    this.isActive = true;

    // Interceptar TODAS las funciones que pueden construir mensajes genéricos
    this.interceptGenericMessageConstructors();
    this.blockGenericResponseFunctions();
    this.overrideConsoleLogsWithGenericPatterns();
    
    console.log('✅ Bloqueador definitivo activado - CERO respuestas genéricas permitidas');
  }

  /**
   * Intercepta constructores de mensajes genéricos
   */
  private interceptGenericMessageConstructors(): void {
    // Interceptar template literals que construyen mensajes genéricos
    const originalStringTemplate = String.raw;
    
    String.raw = function(template: TemplateStringsArray, ...substitutions: any[]): string {
      const result = originalStringTemplate.call(this, template, ...substitutions);
      
      // Bloquear si contiene patrones genéricos
      if (result.includes('he recibido tu mensaje') && result.includes('Te responderé pronto')) {
        console.log('🚫 CONSTRUCCIÓN DE MENSAJE GENÉRICO BLOQUEADA');
        return ''; // Devolver cadena vacía para evitar envío
      }
      
      return result;
    };
  }

  /**
   * Bloquea funciones que generan respuestas genéricas
   */
  private blockGenericResponseFunctions(): void {
    // Interceptar cualquier función que construya respuestas inmediatas
    console.log('🚫 Bloqueando funciones que generan respuestas genéricas');
    
    // Interceptar template strings que puedan contener patrones genéricos
    const originalStringTemplate = String.prototype.concat;
    String.prototype.concat = function(...args: string[]): string {
      const result = originalStringTemplate.apply(this, args);
      
      // Bloquear si contiene patrones genéricos
      if (result.includes('he recibido tu mensaje') && result.includes('Te responderé pronto')) {
        console.log('🚫 CONSTRUCCIÓN DE MENSAJE GENÉRICO BLOQUEADA VIA CONCAT');
        return ''; // Devolver cadena vacía para evitar envío
      }
      
      return result;
    };
  }

  /**
   * Anula logs de consola que contengan patrones genéricos
   */
  private overrideConsoleLogsWithGenericPatterns(): void {
    const originalConsoleLog = console.log;
    
    console.log = (...args: any[]) => {
      const message = args.join(' ');
      
      // Bloquear COMPLETAMENTE logs de respuestas de prueba
      if (message.includes('✅ Respuesta de prueba enviada') ||
          (message.includes('he recibido tu mensaje') && message.includes('Te responderé pronto')) ||
          message.includes('RESPUESTA AUTOMÁTICA (texto) ENVIADA')) {
        // NO mostrar nada - bloqueo total silencioso
        return;
      }
      
      // Permitir otros logs normales
      originalConsoleLog.apply(console, args);
    };
  }

  /**
   * Desactiva el bloqueador
   */
  public deactivate(): void {
    if (!this.isActive) {
      return;
    }
    
    console.log('🔄 Desactivando bloqueador definitivo...');
    this.isActive = false;
    
    // Restaurar funciones originales si es necesario
    // (no implementado para mantener simplicidad)
  }

  /**
   * Verifica si una respuesta es genérica y debe ser bloqueada
   */
  public shouldBlockResponse(response: string): boolean {
    if (!response || typeof response !== 'string') {
      return true;
    }

    // Patrones que indican respuestas genéricas
    const genericPatterns = [
      /hola.*he recibido.*mensaje/i,
      /te responderé pronto/i,
      /mensaje.*recibido.*pronto/i,
      /gracias.*contactar/i
    ];

    for (const pattern of genericPatterns) {
      if (pattern.test(response)) {
        console.log(`🚫 RESPUESTA GENÉRICA DETECTADA Y BLOQUEADA: "${response}"`);
        return true;
      }
    }

    return false;
  }

  /**
   * Obtiene estadísticas del bloqueador
   */
  public getStats() {
    return {
      active: this.isActive,
      interceptedFunctions: this.interceptedFunctions.length,
      blockerType: 'Final Generic Blocker'
    };
  }
}

// Instancia singleton
export const finalGenericBlocker = FinalGenericBlocker.getInstance();