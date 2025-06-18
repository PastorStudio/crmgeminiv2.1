
/**
 * Servicio para limpiar respuestas automáticas de patrones formales no deseados
 */

export class ResponseCleanerService {
  
  private static forbiddenPhrases = [
    'Gracias por escribirnos',
    'Le saluda',
    'agente del',
    'Departamento de Servicio al Ciudadano',
    'Sistema Municipal',
    'Estoy aquí para apoyarle en canalizar su necesidad',
    'Misael Moreno Frias',
    'Enrique, agente',
    'para apoyarle en canalizar'
  ];

  private static formalPatterns = [
    /Gracias por escribirnos,?\s*[^.]*\./gi,
    /Le saluda\s+[^,]+,\s*agente\s+del\s+[^.]*\./gi,
    /Estoy aquí para apoyarle en canalizar su necesidad\.?/gi,
    /Departamento de [^.]*\./gi,
    /Sistema Municipal/gi,
    /Misael Moreno Frias/gi,
    /Enrique,?\s*agente/gi,
    /Departamento de Servicio al Ciudadano del Sistema Municipal/gi,
    /para apoyarle en canalizar/gi
  ];

  /**
   * Limpia una respuesta de patrones formales no deseados
   */
  static cleanResponse(response: string): string {
    let cleanedResponse = response;

    // Remover patrones formales usando regex
    this.formalPatterns.forEach(pattern => {
      cleanedResponse = cleanedResponse.replace(pattern, '');
    });

    // Remover frases específicas
    this.forbiddenPhrases.forEach(phrase => {
      const regex = new RegExp(phrase, 'gi');
      cleanedResponse = cleanedResponse.replace(regex, '');
    });

    // Limpiar espacios extra y puntuación doble
    cleanedResponse = cleanedResponse
      .replace(/\s+/g, ' ')
      .replace(/\.+/g, '.')
      .replace(/^[.\s]+/, '')
      .trim();

    // Si la respuesta queda muy corta o vacía, usar una respuesta genérica
    if (cleanedResponse.length < 10) {
      const genericResponses = [
        '¡Hola! ¿En qué te puedo ayudar?',
        '¿Qué tal? ¿Cómo puedo asistirte?',
        '¡Hey! Cuéntame, ¿qué necesitas?',
        '¿En qué te puedo echar una mano?',
        'Hola, ¿cómo puedo ayudarte hoy?'
      ];
      cleanedResponse = genericResponses[Math.floor(Math.random() * genericResponses.length)];
    }

    return cleanedResponse;
  }

  /**
   * Verifica si una respuesta contiene patrones prohibidos
   */
  static hasProhibitedContent(response: string): boolean {
    const lowerResponse = response.toLowerCase();
    
    return this.forbiddenPhrases.some(phrase => 
      lowerResponse.includes(phrase.toLowerCase())
    ) || this.formalPatterns.some(pattern => 
      pattern.test(response)
    );
  }

  /**
   * Genera una respuesta alternativa cuando se detecta contenido prohibido
   */
  static generateAlternativeResponse(): string {
    const alternatives = [
      '¡Hola! ¿En qué te puedo ayudar?',
      '¿Qué tal? ¿Cómo puedo asistirte?',
      '¡Hey! Cuéntame, ¿qué necesitas?',
      '¿En qué te puedo echar una mano?',
      'Hola, ¿cómo puedo ayudarte hoy?',
      '¿Qué puedo hacer por ti?',
      'Cuéntame, ¿en qué te puedo apoyar?'
    ];
    
    return alternatives[Math.floor(Math.random() * alternatives.length)];
  }
}

export default ResponseCleanerService;
