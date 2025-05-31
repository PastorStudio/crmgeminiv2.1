export class TranslationCacheService {
  // Cache local en memoria para evitar consultas repetidas
  private static memoryCache = new Map<string, string>();

  private static generateCacheKey(originalText: string, targetLanguage: string, context: string = 'general'): string {
    return `${originalText.trim()}_${targetLanguage}_${context}`;
  }

  static async getCachedTranslation(originalText: string, targetLanguage: string, context: string = 'general'): Promise<string | null> {
    try {
      const cacheKey = this.generateCacheKey(originalText, targetLanguage, context);
      
      // Verificar cache en memoria
      if (this.memoryCache.has(cacheKey)) {
        return this.memoryCache.get(cacheKey) || null;
      }

      return null;
    } catch (error) {
      console.warn('Error getting cached translation:', error);
      return null;
    }
  }

  static async saveTranslation(originalText: string, translatedText: string, targetLanguage: string, context: string = 'general'): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(originalText, targetLanguage, context);
      
      // Guardar en cache de memoria
      this.memoryCache.set(cacheKey, translatedText);
    } catch (error) {
      console.warn('Error saving translation:', error);
    }
  }

  static async translateText(text: string, targetLanguage: string): Promise<string> {
    // Por ahora retorna el texto original con indicador de idioma
    // Esto se activará completamente cuando se configure GOOGLE_TRANSLATE_API_KEY
    if (targetLanguage === 'es') {
      return text; // Texto original en español
    }
    
    // Para otros idiomas, agregar indicador temporal
    const languageNames: { [key: string]: string } = {
      'en': '[EN]',
      'fr': '[FR]', 
      'de': '[DE]',
      'pt': '[PT]',
      'it': '[IT]',
      'ru': '[RU]',
      'zh': '[中文]',
      'ja': '[日本語]'
    };
    
    const prefix = languageNames[targetLanguage] || `[${targetLanguage.toUpperCase()}]`;
    return `${prefix} ${text}`;
  }

  static async translateAndCache(originalText: string, targetLanguage: string, context: string = 'general'): Promise<string> {
    // Intentar obtener de cache primero
    const cached = await this.getCachedTranslation(originalText, targetLanguage, context);
    if (cached) {
      return cached;
    }

    // Si no está en cache, traducir y guardar
    const translated = await this.translateText(originalText, targetLanguage);
    await this.saveTranslation(originalText, translated, targetLanguage, context);
    
    return translated;
  }

  static async getMultipleTranslations(texts: string[], targetLanguage: string): Promise<Map<string, string>> {
    const translations = new Map<string, string>();
    
    for (const text of texts) {
      const translation = await this.translateAndCache(text, targetLanguage);
      translations.set(text, translation);
    }
    
    return translations;
  }

  static async preloadCommonTranslations(targetLanguage: string): Promise<void> {
    const commonTexts = [
      'Dashboard',
      'Messages',
      'Leads',
      'Settings',
      'Reports',
      'Save',
      'Cancel',
      'Delete',
      'Edit',
      'Add'
    ];

    await this.getMultipleTranslations(commonTexts, targetLanguage);
  }

  static clearMemoryCache(): void {
    this.memoryCache.clear();
  }
}

export const translationCacheService = TranslationCacheService;