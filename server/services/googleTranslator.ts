/**
 * Google Translate API service
 * Simple and reliable translation using Google Translate
 */

export interface GoogleTranslationResponse {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
}

/**
 * Detect language using simple pattern matching
 */
function detectLanguage(text: string): string {
  // Spanish indicators
  const spanishPatterns = /[áéíóúñ¿¡]|hola|como|que|para|con|una|este|todo|pero|muy|cuando|hasta|donde|gracias|por favor|buenos días|buenas tardes|buenas noches/i;
  
  if (spanishPatterns.test(text)) {
    return 'es';
  }
  
  // English by default
  return 'en';
}

/**
 * Translate text using Google Translate API
 */
export async function translateWithGoogle(text: string): Promise<GoogleTranslationResponse> {
  try {
    const sourceLanguage = detectLanguage(text);
    const targetLanguage = sourceLanguage === 'es' ? 'en' : 'es';
    
    // Google Translate API endpoint
    const googleTranslateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLanguage}&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(text)}`;
    
    console.log('🌐 Traduciendo con Google:', text);
    console.log('📡 URL:', googleTranslateUrl);
    
    const response = await fetch(googleTranslateUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Google Translate API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Google Translate returns an array with translation data
    const translatedText = data[0]?.map((item: any) => item[0]).join('') || text;
    
    console.log('✅ Traducción exitosa:', translatedText);
    
    return {
      originalText: text,
      translatedText,
      sourceLanguage,
      targetLanguage,
      confidence: 0.95
    };
    
  } catch (error) {
    console.error('❌ Error en traducción Google:', error);
    
    // Fallback to simple word replacement
    const sourceLanguage = detectLanguage(text);
    const targetLanguage = sourceLanguage === 'es' ? 'en' : 'es';
    
    let fallbackTranslation = text;
    
    if (sourceLanguage === 'es') {
      // Spanish to English basic replacements
      fallbackTranslation = text
        .replace(/hola/gi, 'hello')
        .replace(/como estas/gi, 'how are you')
        .replace(/como/gi, 'how')
        .replace(/que tal/gi, 'how are you')
        .replace(/que/gi, 'what')
        .replace(/donde/gi, 'where')
        .replace(/cuando/gi, 'when')
        .replace(/por favor/gi, 'please')
        .replace(/gracias/gi, 'thank you')
        .replace(/buenos días/gi, 'good morning')
        .replace(/buenas tardes/gi, 'good afternoon')
        .replace(/buenas noches/gi, 'good night')
        .replace(/sí/gi, 'yes')
        .replace(/no/gi, 'no');
    } else {
      // English to Spanish basic replacements
      fallbackTranslation = text
        .replace(/hello/gi, 'hola')
        .replace(/how are you/gi, 'como estas')
        .replace(/how/gi, 'como')
        .replace(/what/gi, 'que')
        .replace(/where/gi, 'donde')
        .replace(/when/gi, 'cuando')
        .replace(/please/gi, 'por favor')
        .replace(/thank you/gi, 'gracias')
        .replace(/good morning/gi, 'buenos días')
        .replace(/good afternoon/gi, 'buenas tardes')
        .replace(/good night/gi, 'buenas noches')
        .replace(/yes/gi, 'sí')
        .replace(/no/gi, 'no');
    }
    
    return {
      originalText: text,
      translatedText: fallbackTranslation,
      sourceLanguage,
      targetLanguage,
      confidence: 0.7
    };
  }
}