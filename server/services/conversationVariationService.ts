
/**
 * Servicio para variar respuestas automáticas y evitar repetición
 */

const recentResponses = new Map<string, string[]>();

interface VariationConfig {
  greetings: string[];
  helpOffers: string[];
  questions: string[];
  closings: string[];
}

const variations: VariationConfig = {
  greetings: [
    "¡Hola!",
    "¿Qué tal?",
    "¡Hey!",
    "Hola, ¿cómo estás?",
    "¡Buenos días!",
    "¡Buenas tardes!",
    "¿Cómo te va?"
  ],
  helpOffers: [
    "¿En qué te puedo ayudar?",
    "¿Cómo puedo asistirte?",
    "¿Qué necesitas?",
    "¿En qué te puedo echar una mano?",
    "¿Cómo te puedo apoyar?",
    "¿Qué puedo hacer por ti?",
    "Cuéntame, ¿qué necesitas?"
  ],
  questions: [
    "¿Podrías contarme más detalles?",
    "¿Qué información específica necesitas?",
    "¿En qué aspecto te gustaría que te ayude?",
    "¿Hay algo en particular que te preocupa?",
    "¿Qué tipo de solución estás buscando?"
  ],
  closings: [
    "¡Espero haberte ayudado!",
    "¿Hay algo más en lo que pueda asistirte?",
    "¿Te quedó claro o tienes alguna otra duda?",
    "¡Cualquier cosa me dices!",
    "¿Necesitas algo más?"
  ]
};

export class ConversationVariationService {
  
  /**
   * Genera un saludo variado que no se haya usado recientemente
   */
  static getVariedGreeting(chatId: string): string {
    const recent = recentResponses.get(chatId) || [];
    const availableGreetings = variations.greetings.filter(greeting => 
      !recent.some(response => response.includes(greeting))
    );
    
    if (availableGreetings.length === 0) {
      // Si todos se han usado, reiniciar con variaciones aleatorias
      this.clearRecentResponses(chatId);
      return this.getRandomItem(variations.greetings);
    }
    
    return this.getRandomItem(availableGreetings);
  }
  
  /**
   * Genera una oferta de ayuda variada
   */
  static getVariedHelpOffer(chatId: string): string {
    return this.getRandomItem(variations.helpOffers);
  }
  
  /**
   * Genera una pregunta de seguimiento variada
   */
  static getVariedQuestion(chatId: string): string {
    return this.getRandomItem(variations.questions);
  }
  
  /**
   * Mejora una respuesta automática para que sea más conversacional
   */
  static improveResponse(response: string, chatId: string): string {
    // Detectar y reemplazar patrones formales repetitivos
    const formalPatterns = [
      /Gracias por escribirnos,?\s*[^.]*\./gi,
      /Le saluda\s+[^,]+,\s*agente\s+del\s+[^.]*\./gi,
      /Estoy aquí para apoyarle en canalizar su necesidad\.?/gi,
      /Departamento de [^.]*\./gi
    ];
    
    let improvedResponse = response;
    
    // Remover patrones formales
    formalPatterns.forEach(pattern => {
      improvedResponse = improvedResponse.replace(pattern, '');
    });
    
    // Limpiar espacios extra
    improvedResponse = improvedResponse.replace(/\s+/g, ' ').trim();
    
    // Si la respuesta queda muy corta o vacía, generar una nueva
    if (improvedResponse.length < 10) {
      const greeting = this.getVariedGreeting(chatId);
      const helpOffer = this.getVariedHelpOffer(chatId);
      improvedResponse = `${greeting} ${helpOffer}`;
    }
    
    // Agregar a respuestas recientes
    this.addToRecentResponses(chatId, improvedResponse);
    
    return improvedResponse;
  }
  
  /**
   * Verifica si una respuesta es muy similar a las recientes
   */
  static isSimilarToRecent(response: string, chatId: string): boolean {
    const recent = recentResponses.get(chatId) || [];
    const similarity = this.calculateSimilarity(response, recent);
    return similarity > 0.7; // 70% de similitud
  }
  
  /**
   * Calcula similitud entre respuesta y respuestas recientes
   */
  private static calculateSimilarity(response: string, recentList: string[]): number {
    if (recentList.length === 0) return 0;
    
    const responseWords = response.toLowerCase().split(/\s+/);
    
    let maxSimilarity = 0;
    recentList.forEach(recent => {
      const recentWords = recent.toLowerCase().split(/\s+/);
      const commonWords = responseWords.filter(word => recentWords.includes(word));
      const similarity = commonWords.length / Math.max(responseWords.length, recentWords.length);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    });
    
    return maxSimilarity;
  }
  
  /**
   * Agrega respuesta a la lista de respuestas recientes
   */
  private static addToRecentResponses(chatId: string, response: string): void {
    const recent = recentResponses.get(chatId) || [];
    recent.push(response);
    
    // Mantener solo las últimas 5 respuestas
    if (recent.length > 5) {
      recent.shift();
    }
    
    recentResponses.set(chatId, recent);
  }
  
  /**
   * Limpia respuestas recientes para un chat
   */
  private static clearRecentResponses(chatId: string): void {
    recentResponses.delete(chatId);
  }
  
  /**
   * Obtiene un elemento aleatorio de un array
   */
  private static getRandomItem<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }
}

export default ConversationVariationService;
