/**
 * FILTRO ANTI-RESPUESTAS GENÉRICAS
 * 
 * Esta función detecta automáticamente y bloquea cualquier mensaje genérico,
 * de prueba o simulación, asegurando que SOLO se usen respuestas reales 
 * de agentes externos.
 */

export class AntiGenericResponseFilter {
  private static instance: AntiGenericResponseFilter;
  private blockedPatterns: string[] = [
    "he recibido tu mensaje",
    "Te responderé pronto",
    "respuesta de prueba",
    "mensaje de prueba",
    "respuesta automática genérica",
    "respuesta temporal",
    "respuesta placeholder",
    "respuesta de ejemplo",
    "respuesta simulada",
    "mensaje genérico"
  ];

  private constructor() {}

  public static getInstance(): AntiGenericResponseFilter {
    if (!AntiGenericResponseFilter.instance) {
      AntiGenericResponseFilter.instance = new AntiGenericResponseFilter();
    }
    return AntiGenericResponseFilter.instance;
  }

  /**
   * Detecta si un mensaje es genérico o de prueba
   */
  public isGenericResponse(message: string): boolean {
    if (!message || typeof message !== 'string') {
      return true; // Bloquear mensajes vacíos o inválidos
    }

    const lowerMessage = message.toLowerCase();
    
    // Verificar patrones genéricos
    for (const pattern of this.blockedPatterns) {
      if (lowerMessage.includes(pattern.toLowerCase())) {
        console.log(`🚫 MENSAJE GENÉRICO DETECTADO: "${pattern}"`);
        return true;
      }
    }

    // Verificar si es un mensaje muy corto y genérico
    if (message.length < 10) {
      console.log(`🚫 MENSAJE DEMASIADO CORTO DETECTADO: "${message}"`);
      return true;
    }

    // Verificar patrones específicos de respuestas de prueba
    const testPatterns = [
      /hola.*he recibido.*mensaje/i,
      /gracias.*contactar.*responder/i,
      /mensaje.*recibido.*pronto/i
    ];

    for (const pattern of testPatterns) {
      if (pattern.test(message)) {
        console.log(`🚫 PATRÓN DE PRUEBA DETECTADO en: "${message}"`);
        return true;
      }
    }

    return false;
  }

  /**
   * Valida que una respuesta sea auténtica del agente externo
   */
  public isAuthenticAgentResponse(response: string, agentId: string): boolean {
    if (!response || this.isGenericResponse(response)) {
      return false;
    }

    // Una respuesta auténtica debe tener contenido sustancial
    if (response.length < 20) {
      console.log(`🚫 RESPUESTA DEMASIADO CORTA de agente ${agentId}: "${response}"`);
      return false;
    }

    // No debe contener patrones genéricos
    const genericIndicators = [
      "este es un mensaje de prueba",
      "respuesta automática",
      "mensaje generado",
      "placeholder"
    ];

    for (const indicator of genericIndicators) {
      if (response.toLowerCase().includes(indicator)) {
        console.log(`🚫 INDICADOR GENÉRICO ENCONTRADO en respuesta de ${agentId}`);
        return false;
      }
    }

    console.log(`✅ RESPUESTA AUTÉNTICA VALIDADA de agente ${agentId}`);
    return true;
  }

  /**
   * Bloquea el envío de mensajes genéricos
   */
  public shouldBlockMessage(message: string, source: string = "unknown"): boolean {
    if (this.isGenericResponse(message)) {
      console.log(`🛑 BLOQUEANDO MENSAJE GENÉRICO de ${source}: "${message}"`);
      return true;
    }
    return false;
  }

  /**
   * Permite solo respuestas auténticas de agentes externos
   */
  public filterAndValidateResponse(response: string, agentId: string): string | null {
    if (!response) {
      console.log(`❌ Respuesta vacía de agente ${agentId}`);
      return null;
    }

    if (this.shouldBlockMessage(response, `agente ${agentId}`)) {
      console.log(`🚫 RESPUESTA BLOQUEADA de agente ${agentId}`);
      return null;
    }

    if (!this.isAuthenticAgentResponse(response, agentId)) {
      console.log(`🚫 RESPUESTA NO AUTÉNTICA de agente ${agentId}`);
      return null;
    }

    console.log(`✅ RESPUESTA VÁLIDA APROBADA de agente ${agentId}`);
    return response;
  }

  /**
   * Detecta si un sistema está enviando respuestas de prueba
   */
  public detectTestResponseSystem(logMessages: string[]): boolean {
    const testIndicators = [
      "respuesta de prueba enviada",
      "mensaje genérico enviado",
      "respuesta temporal enviada"
    ];

    for (const log of logMessages) {
      for (const indicator of testIndicators) {
        if (log.toLowerCase().includes(indicator)) {
          console.log(`🚨 SISTEMA DE PRUEBA DETECTADO: ${log}`);
          return true;
        }
      }
    }

    return false;
  }
}

export const antiGenericFilter = AntiGenericResponseFilter.getInstance();