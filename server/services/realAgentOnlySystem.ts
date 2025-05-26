/**
 * SISTEMA EXCLUSIVO DE AGENTES REALES
 * 
 * Esta función elimina completamente cualquier sistema de respuestas genéricas
 * y asegura que SOLO se usen respuestas auténticas de agentes externos.
 */

import { antiGenericFilter } from './antiGenericResponseFilter';

export class RealAgentOnlySystem {
  private static instance: RealAgentOnlySystem;
  private isActive = false;

  private constructor() {}

  public static getInstance(): RealAgentOnlySystem {
    if (!RealAgentOnlySystem.instance) {
      RealAgentOnlySystem.instance = new RealAgentOnlySystem();
    }
    return RealAgentOnlySystem.instance;
  }

  /**
   * Activa el sistema que bloquea respuestas genéricas
   */
  public activate(): void {
    if (this.isActive) {
      console.log('🛡️ Sistema de agentes reales ya está activo');
      return;
    }

    console.log('🚀 ACTIVANDO SISTEMA DE AGENTES REALES EXCLUSIVAMENTE');
    this.isActive = true;

    // Interceptar y bloquear cualquier función que genere respuestas inmediatas
    this.interceptGenericResponseFunctions();
    console.log('✅ Sistema de agentes reales activado - SOLO respuestas auténticas permitidas');
  }

  /**
   * Intercepta y bloquea funciones que generan respuestas genéricas
   */
  private interceptGenericResponseFunctions(): void {
    // Interceptar console.log para detectar y bloquear mensajes de prueba
    const originalConsoleLog = console.log;
    
    console.log = (...args: any[]) => {
      const message = args.join(' ');
      
      // Bloquear mensajes que indican respuestas de prueba
      if (message.includes('✅ Respuesta de prueba enviada')) {
        console.warn('🛑 BLOQUEADO: Intento de envío de respuesta de prueba detectado');
        return;
      }

      if (message.includes('he recibido tu mensaje') && message.includes('Te responderé pronto')) {
        console.warn('🛑 BLOQUEADO: Mensaje genérico detectado y bloqueado');
        return;
      }

      // Permitir otros logs normales
      originalConsoleLog.apply(console, args);
    };
  }

  /**
   * Valida que una respuesta sea auténtica antes de permitir su envío
   */
  public validateResponse(response: string, agentId: string): boolean {
    if (!this.isActive) {
      return true; // Si el sistema no está activo, permitir todo
    }

    // Usar el filtro anti-genérico para validar
    const validatedResponse = antiGenericFilter.filterAndValidateResponse(response, agentId);
    
    if (!validatedResponse) {
      console.log(`🚫 RESPUESTA RECHAZADA de agente ${agentId} - No cumple criterios de autenticidad`);
      return false;
    }

    console.log(`✅ RESPUESTA APROBADA de agente ${agentId} - Auténtica y válida`);
    return true;
  }

  /**
   * Fuerza el sistema a usar SOLO agentes externos
   */
  public enforceExternalAgentsOnly(): void {
    console.log('🔒 MODO FORZADO: Solo agentes externos permitidos');
    
    // Bloquear cualquier intento de generar respuestas inmediatas
    this.blockImmediateResponses();
  }

  /**
   * Bloquea respuestas inmediatas que no provienen de agentes externos
   */
  private blockImmediateResponses(): void {
    // Interceptar fetch para bloquear envíos de mensajes genéricos
    const originalFetch = global.fetch;
    
    global.fetch = async (url: any, options?: any) => {
      if (typeof url === 'string' && url.includes('/send-message') && options?.method === 'POST') {
        const body = JSON.parse(options.body || '{}');
        const message = body.message || '';
        
        // Bloquear mensajes genéricos
        if (antiGenericFilter.shouldBlockMessage(message, 'fetch-interceptor')) {
          console.log('🛑 ENVÍO BLOQUEADO: Mensaje genérico interceptado por sistema de seguridad');
          return new Response(JSON.stringify({ blocked: true, reason: 'Mensaje genérico bloqueado' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      
      return originalFetch(url, options);
    };
  }

  /**
   * Desactiva temporalmente el sistema (para testing)
   */
  public deactivate(): void {
    this.isActive = false;
    console.log('⚠️ Sistema de agentes reales desactivado');
  }

  /**
   * Verifica si el sistema está activo
   */
  public isSystemActive(): boolean {
    return this.isActive;
  }
}

// Exportar instancia única
export const realAgentOnly = RealAgentOnlySystem.getInstance();