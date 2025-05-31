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
    // Si es español, retorna el texto original
    if (targetLanguage === 'es') {
      return text;
    }

    // Usar Google Translate API si está disponible
    if (process.env.GOOGLE_TRANSLATE_API_KEY) {
      try {
        const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${process.env.GOOGLE_TRANSLATE_API_KEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            q: text,
            source: 'es',
            target: targetLanguage,
            format: 'text'
          })
        });

        if (response.ok) {
          const data = await response.json();
          return data.data.translations[0].translatedText;
        }
      } catch (error) {
        console.warn('Google Translate API error:', error);
      }
    }
    
    // Fallback con indicadores visuales si no hay API key
    const languageNames: { [key: string]: string } = {
      'en': '[EN]',
      'fr': '[FR]', 
      'de': '[DE]',
      'pt': '[PT]',
      'it': '[IT]',
      'ru': '[RU]',
      'zh': '[中文]',
      'ja': '[日本語]',
      'ko': '[한국어]',
      'ar': '[العربية]'
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
      'Panel de Control',
      'Mensajes',
      'Messages',
      'Leads',
      'Prospectos',
      'Configuración',
      'Settings',
      'Reportes',
      'Reports',
      'Guardar',
      'Save',
      'Cancelar',
      'Cancel',
      'Eliminar',
      'Delete',
      'Editar',
      'Edit',
      'Agregar',
      'Add',
      'Usuario',
      'User',
      'Fecha',
      'Date',
      'Estado',
      'Status',
      'Activo',
      'Active',
      'Inactivo',
      'Inactive',
      'Total',
      'Hoy',
      'Today',
      'Ayer',
      'Yesterday',
      'Esta semana',
      'This week',
      'Este mes',
      'This month',
      'Buscar',
      'Search',
      'Filtrar',
      'Filter',
      'Exportar',
      'Export',
      'Importar',
      'Import',
      'Enviar',
      'Send',
      'Recibir',
      'Receive',
      'Nombre',
      'Name',
      'Email',
      'Teléfono',
      'Phone',
      'Empresa',
      'Company',
      'Notas',
      'Notes',
      'Acciones',
      'Actions',
      'Ver',
      'View',
      'Nuevo',
      'New',
      'Crear',
      'Create',
      'Actualizar',
      'Update',
      'Cerrar',
      'Close',
      'Abrir',
      'Open',
      'Completado',
      'Completed',
      'Pendiente',
      'Pending',
      'En progreso',
      'In progress',
      'Rechazado',
      'Rejected',
      'Aprobado',
      'Approved'
    ];

    await this.getMultipleTranslations(commonTexts, targetLanguage);
  }

  static async bulkTranslateAndStore(texts: string[], targetLanguages: string[]): Promise<void> {
    if (!process.env.GOOGLE_TRANSLATE_API_KEY) {
      console.warn('No Google Translate API key available for bulk translation');
      return;
    }

    console.log(`🌐 Iniciando traducción masiva de ${texts.length} textos a ${targetLanguages.length} idiomas...`);

    for (const language of targetLanguages) {
      if (language === 'es') continue; // Skip source language
      
      console.log(`📝 Traduciendo a ${language}...`);
      
      // Process in batches to avoid rate limiting
      const batchSize = 10;
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        
        try {
          const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${process.env.GOOGLE_TRANSLATE_API_KEY}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              q: batch,
              source: 'es',
              target: language,
              format: 'text'
            })
          });

          if (response.ok) {
            const data = await response.json();
            const translations = data.data.translations;
            
            // Save each translation to cache
            for (let j = 0; j < batch.length; j++) {
              const originalText = batch[j];
              const translatedText = translations[j].translatedText;
              await this.saveTranslation(originalText, translatedText, language);
            }
          }
        } catch (error) {
          console.error(`Error translating batch to ${language}:`, error);
        }
        
        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log('✅ Traducción masiva completada');
  }

  static clearMemoryCache(): void {
    this.memoryCache.clear();
  }
}

export const translationCacheService = TranslationCacheService;