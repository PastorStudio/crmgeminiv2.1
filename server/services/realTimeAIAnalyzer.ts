/**
 * Real-time AI Analysis System for Chat Messages
 * Provides immediate analysis display in the UI
 */
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY
});

export interface AIAnalysisResult {
  leadScore: number;
  intent: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  topics: string[];
  urgency: 'low' | 'medium' | 'high';
  shouldCreateLead: boolean;
}

// Cache de análisis para evitar re-procesar el mismo contenido
const analysisCache = new Map<string, AIAnalysisResult>();

export class RealTimeAIAnalyzer {
  
  /**
   * Analiza un chat en tiempo real para mostrar en la UI
   */
  static async analyzeChat(chatId: string, lastMessage: string, contactInfo: any): Promise<AIAnalysisResult> {
    
    // Crear clave de cache basada en contenido
    const cacheKey = `${chatId}-${lastMessage.substring(0, 50)}`;
    
    // Verificar cache primero
    if (analysisCache.has(cacheKey)) {
      console.log(`📊 Usando análisis en cache para chat ${chatId}`);
      return analysisCache.get(cacheKey)!;
    }
    
    try {
      console.log(`🧠 Analizando chat ${chatId} en tiempo real...`);
      
      // Si no hay OpenAI key, usar análisis básico
      if (!openai.apiKey) {
        console.log('⚠️ No OpenAI key, usando análisis básico');
        return this.performBasicAnalysis(lastMessage, contactInfo);
      }
      
      const analysis = await this.performAIAnalysis(lastMessage, contactInfo);
      
      // Guardar en cache
      analysisCache.set(cacheKey, analysis);
      
      // Limpiar cache antiguo (mantener solo últimos 100)
      if (analysisCache.size > 100) {
        const firstKey = analysisCache.keys().next().value;
        analysisCache.delete(firstKey);
      }
      
      console.log(`✅ Análisis completado - Lead Score: ${analysis.leadScore}% | Intent: ${analysis.intent}`);
      return analysis;
      
    } catch (error) {
      console.error('❌ Error en análisis AI, usando básico:', error);
      return this.performBasicAnalysis(lastMessage, contactInfo);
    }
  }
  
  /**
   * Análisis con OpenAI
   */
  private static async performAIAnalysis(message: string, contactInfo: any): Promise<AIAnalysisResult> {
    
    const prompt = `
Analiza este mensaje de WhatsApp y proporciona un análisis en formato JSON:

MENSAJE: "${message}"
CONTACTO: ${contactInfo?.name || 'Desconocido'}

Responde solo con JSON válido:
{
  "leadScore": 75,
  "intent": "consulta",
  "sentiment": "positive",
  "topics": ["tema1", "tema2"],
  "urgency": "medium",
  "shouldCreateLead": true
}

CRITERIOS:
- leadScore: 0-100 (probabilidad de conversión)
- intent: consulta|ventas|soporte|reclamo|cotización
- sentiment: positive|neutral|negative
- topics: máximo 3 temas principales
- urgency: low|medium|high
- shouldCreateLead: true si muestra interés comercial
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.3
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    try {
      return JSON.parse(content);
    } catch (parseError) {
      console.error('Error parsing AI response:', content);
      throw parseError;
    }
  }
  
  /**
   * Análisis básico sin IA
   */
  private static performBasicAnalysis(message: string, contactInfo: any): AIAnalysisResult {
    
    const messageText = message.toLowerCase();
    
    // Palabras clave para análisis
    const salesKeywords = ['precio', 'costo', 'comprar', 'producto', 'servicio', 'cotización', 'presupuesto', 'vender', 'oferta', 'interesa'];
    const supportKeywords = ['problema', 'ayuda', 'error', 'falla', 'soporte', 'reclamo', 'queja', 'no funciona'];
    const urgentKeywords = ['urgente', 'inmediato', 'ya', 'rápido', 'ahora', 'emergency', 'necesito'];
    const positiveKeywords = ['gracias', 'excelente', 'perfecto', 'genial', 'bueno', 'me gusta'];
    const negativeKeywords = ['mal', 'terrible', 'horrible', 'enojado', 'molesto', 'problema'];
    
    // Contar coincidencias
    const salesScore = salesKeywords.filter(keyword => messageText.includes(keyword)).length;
    const supportScore = supportKeywords.filter(keyword => messageText.includes(keyword)).length;
    const urgencyScore = urgentKeywords.filter(keyword => messageText.includes(keyword)).length;
    const positiveScore = positiveKeywords.filter(keyword => messageText.includes(keyword)).length;
    const negativeScore = negativeKeywords.filter(keyword => messageText.includes(keyword)).length;
    
    // Determinar intención
    let intent = 'consulta';
    if (salesScore > 0) intent = 'ventas';
    else if (supportScore > 0) intent = 'soporte';
    
    // Determinar sentimiento
    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (positiveScore > negativeScore) sentiment = 'positive';
    else if (negativeScore > positiveScore) sentiment = 'negative';
    
    // Calcular lead score
    const baseScore = message.length > 10 ? 25 : 15; // Mensaje sustancial
    const leadScore = Math.min(baseScore + (salesScore * 20) + (positiveScore * 10), 100);
    
    // Extraer temas básicos
    const topics: string[] = [];
    if (salesScore > 0) topics.push('ventas');
    if (supportScore > 0) topics.push('soporte');
    if (message.includes('información')) topics.push('información');
    
    return {
      leadScore: Math.max(leadScore, 20), // Mínimo 20% para cualquier interacción
      intent,
      sentiment,
      topics: topics.slice(0, 3),
      urgency: urgencyScore > 0 ? 'high' : salesScore > 0 ? 'medium' : 'low',
      shouldCreateLead: leadScore > 30 || salesScore > 0
    };
  }
  
  /**
   * Analiza múltiples chats de forma eficiente
   */
  static async analyzeBatchChats(chats: any[]): Promise<Map<string, AIAnalysisResult>> {
    const results = new Map<string, AIAnalysisResult>();
    
    console.log(`🔍 Analizando lote de ${chats.length} chats...`);
    
    // Procesar en paralelo con límite
    const batchSize = 5;
    for (let i = 0; i < chats.length; i += batchSize) {
      const batch = chats.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (chat) => {
        try {
          const analysis = await this.analyzeChat(
            chat.id,
            chat.lastMessage?.body || '',
            { name: chat.contact?.name }
          );
          results.set(chat.id, analysis);
        } catch (error) {
          console.error(`Error analizando chat ${chat.id}:`, error);
          // Fallback analysis
          results.set(chat.id, {
            leadScore: 25,
            intent: 'consulta',
            sentiment: 'neutral',
            topics: [],
            urgency: 'low',
            shouldCreateLead: false
          });
        }
      });
      
      await Promise.all(batchPromises);
      
      // Pausa entre lotes para no sobrecargar
      if (i + batchSize < chats.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`✅ Análisis completado para ${results.size} chats`);
    return results;
  }
  
  /**
   * Limpia el cache de análisis
   */
  static clearCache(): void {
    analysisCache.clear();
    console.log('🧹 Cache de análisis limpiado');
  }
  
  /**
   * Obtiene estadísticas del cache
   */
  static getCacheStats(): { size: number; maxSize: number } {
    return {
      size: analysisCache.size,
      maxSize: 100
    };
  }
}