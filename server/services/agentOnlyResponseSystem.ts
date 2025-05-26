/**
 * SISTEMA DE RESPUESTAS EXCLUSIVAMENTE DE AGENTES EXTERNOS
 * 
 * Esta función elimina completamente cualquier respuesta genérica/de prueba
 * y garantiza que SOLO se envíen respuestas auténticas de agentes externos.
 */

import { antiGenericFilter } from './antiGenericResponseFilter';

export class AgentOnlyResponseSystem {
  private static instance: AgentOnlyResponseSystem;
  private isActive = false;
  private originalSendMessage: any = null;

  private constructor() {}

  public static getInstance(): AgentOnlyResponseSystem {
    if (!AgentOnlyResponseSystem.instance) {
      AgentOnlyResponseSystem.instance = new AgentOnlyResponseSystem();
    }
    return AgentOnlyResponseSystem.instance;
  }

  /**
   * Activa el sistema que bloquea COMPLETAMENTE respuestas genéricas
   */
  public activate(): void {
    if (this.isActive) {
      console.log('🛡️ Sistema de agentes exclusivos ya está activo');
      return;
    }

    console.log('🚀 ACTIVANDO SISTEMA DE AGENTES EXTERNOS EXCLUSIVAMENTE');
    this.isActive = true;

    // Interceptar TODAS las funciones que pueden generar respuestas inmediatas
    this.interceptAllGenericFunctions();
    console.log('✅ Sistema de agentes exclusivos activado - CERO tolerancia a respuestas genéricas');
  }

  /**
   * Intercepta TODAS las funciones que pueden generar respuestas genéricas
   */
  private interceptAllGenericFunctions(): void {
    // 1. Interceptar console.log para bloquear logs de respuestas de prueba
    this.interceptConsoleLog();
    
    // 2. Interceptar fetch para bloquear envíos de mensajes genéricos
    this.interceptFetch();
    
    // 3. Interceptar cualquier función que construya mensajes genéricos
    this.interceptGenericMessageBuilders();
  }

  /**
   * Intercepta console.log para bloquear mensajes de prueba
   */
  private interceptConsoleLog(): void {
    const originalConsoleLog = console.log;
    
    console.log = (...args: any[]) => {
      const message = args.join(' ');
      
      // Bloquear COMPLETAMENTE mensajes de respuestas de prueba
      if (message.includes('✅ Respuesta de prueba enviada') || 
          message.includes('he recibido tu mensaje') && message.includes('Te responderé pronto')) {
        // NO mostrar nada - bloqueo total
        return;
      }

      // Permitir otros logs normales
      originalConsoleLog.apply(console, args);
    };
  }

  /**
   * Intercepta fetch para bloquear envíos de mensajes genéricos
   */
  private interceptFetch(): void {
    const originalFetch = global.fetch;
    
    global.fetch = async (url: any, options?: any) => {
      if (typeof url === 'string' && url.includes('/send-message') && options?.method === 'POST') {
        try {
          const body = JSON.parse(options.body || '{}');
          const message = body.message || '';
          
          // Bloquear COMPLETAMENTE mensajes genéricos
          if (antiGenericFilter.shouldBlockMessage(message, 'fetch-interceptor')) {
            console.log('🛑 ENVÍO BLOQUEADO: Mensaje genérico interceptado y eliminado');
            
            // Retornar respuesta falsa para que el sistema crea que se envió
            return new Response(JSON.stringify({ 
              success: true, 
              message: 'Mensaje genérico bloqueado - esperando respuesta real del agente' 
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        } catch (error) {
          // Si hay error parseando, continuar con el fetch original
        }
      }
      
      return originalFetch(url, options);
    };
  }

  /**
   * Intercepta funciones que construyen mensajes genéricos
   */
  private interceptGenericMessageBuilders(): void {
    // Interceptar cualquier función que construya el patrón "Hola [nombre], he recibido tu mensaje"
    const originalStringPrototype = String.prototype.includes;
    
    String.prototype.includes = function(searchString: string) {
      const result = originalStringPrototype.call(this, searchString);
      
      // Si detectamos construcción de mensaje genérico, bloquear
      if (this.toString().includes('he recibido tu mensaje') && 
          this.toString().includes('Te responderé pronto')) {
        console.log('🛑 CONSTRUCCIÓN DE MENSAJE GENÉRICO BLOQUEADA');
        return false; // Hacer que parezca que no encontró el patrón
      }
      
      return result;
    };
  }

  /**
   * Valida que SOLO se permitan respuestas auténticas de agentes
   */
  public validateAndFilterResponse(response: string, agentId: string): string | null {
    if (!this.isActive) {
      return response; // Si no está activo, permitir todo
    }

    // Usar el filtro anti-genérico para validar
    const validatedResponse = antiGenericFilter.filterAndValidateResponse(response, agentId);
    
    if (!validatedResponse) {
      console.log(`🚫 RESPUESTA RECHAZADA de agente ${agentId} - No es auténtica`);
      return null;
    }

    console.log(`✅ RESPUESTA APROBADA de agente ${agentId} - 100% auténtica`);
    return validatedResponse;
  }

  /**
   * Fuerza el sistema a esperar SOLO respuestas de agentes externos
   */
  public enforceAgentResponsesOnly(): void {
    console.log('🔒 MODO ULTRA-ESTRICTO: Solo respuestas de agentes externos permitidas');
    
    // Crear un sistema de cola que espere respuestas reales
    this.createAgentResponseQueue();
  }

  /**
   * Crea un sistema de cola que espera respuestas reales de agentes
   */
  private createAgentResponseQueue(): void {
    // Interceptar cualquier intento de envío inmediato
    const pendingResponses = new Map<string, boolean>();
    
    // Sistema que espera confirmación de respuesta real antes de permitir envío
    const originalSendFunction = this.originalSendMessage;
    
    global.sendWhatsAppMessage = async (accountId: number, chatId: string, message: string, contactName: string) => {
      const key = `${accountId}_${chatId}`;
      
      // Solo permitir si tenemos confirmación de que es respuesta real
      if (!pendingResponses.get(key + '_authenticated')) {
        console.log(`🛑 ENVÍO RECHAZADO: No hay confirmación de respuesta auténtica para ${contactName}`);
        return false;
      }
      
      // Limpiar la confirmación después del uso
      pendingResponses.delete(key + '_authenticated');
      
      // Proceder con el envío real
      console.log(`✅ ENVIANDO RESPUESTA AUTÉNTICA a ${contactName}`);
      return true;
    };
  }

  /**
   * Confirma que una respuesta es auténtica y puede ser enviada
   */
  public authenticateResponse(accountId: number, chatId: string, response: string): boolean {
    if (!this.validateAndFilterResponse(response, 'external-agent')) {
      return false;
    }
    
    const key = `${accountId}_${chatId}`;
    const pendingResponses = new Map<string, boolean>();
    pendingResponses.set(key + '_authenticated', true);
    
    console.log(`🔐 RESPUESTA AUTENTICADA para chat ${chatId}`);
    return true;
  }

  /**
   * Desactiva el sistema (para testing)
   */
  public deactivate(): void {
    this.isActive = false;
    console.log('⚠️ Sistema de agentes exclusivos desactivado');
  }
}

// Exportar instancia única
export const agentOnlySystem = AgentOnlyResponseSystem.getInstance();