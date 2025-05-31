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

    // Primero intentar usar DeepSeek con web scraping
    try {
      const deepSeekTranslation = await this.translateWithDeepSeek(text, targetLanguage);
      if (deepSeekTranslation && deepSeekTranslation !== text) {
        return deepSeekTranslation;
      }
    } catch (error) {
      console.warn('DeepSeek translation error:', error);
    }

    // Fallback a Google Translate API si está disponible
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
    
    // Último fallback con indicadores visuales
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

  static async translateWithDeepSeek(text: string, targetLanguage: string): Promise<string> {
    const puppeteer = require('puppeteer');
    
    const languageMap: { [key: string]: string } = {
      'en': 'English',
      'fr': 'French',
      'de': 'German',
      'pt': 'Portuguese',
      'it': 'Italian',
      'ru': 'Russian',
      'zh': 'Chinese',
      'ja': 'Japanese',
      'ko': 'Korean',
      'ar': 'Arabic'
    };

    const targetLangName = languageMap[targetLanguage] || targetLanguage;
    
    let browser;
    try {
      browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      
      const page = await browser.newPage();
      
      // Configurar user agent para evitar detección
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Ir a DeepSeek Chat
      await page.goto('https://chat.deepseek.com/', { waitUntil: 'networkidle2' });
      
      // Esperar a que cargue la página
      await page.waitForTimeout(3000);
      
      // Encontrar el textarea de entrada
      const inputSelector = 'textarea, [contenteditable="true"], input[type="text"]';
      await page.waitForSelector(inputSelector, { timeout: 10000 });
      
      // Crear el prompt de traducción
      const prompt = `Translate this text from Spanish to ${targetLangName}. Only respond with the translation, no explanations: "${text}"`;
      
      // Escribir en el input
      await page.type(inputSelector, prompt);
      
      // Buscar y hacer clic en el botón de enviar
      const sendButtonSelectors = [
        'button[type="submit"]',
        'button:contains("Send")',
        'button:contains("Enviar")',
        '[data-testid="send-button"]',
        '.send-button',
        'button:last-child'
      ];
      
      let buttonClicked = false;
      for (const selector of sendButtonSelectors) {
        try {
          await page.click(selector);
          buttonClicked = true;
          break;
        } catch (e) {
          // Continuar con el siguiente selector
        }
      }
      
      if (!buttonClicked) {
        // Intentar presionar Enter
        await page.keyboard.press('Enter');
      }
      
      // Esperar la respuesta
      await page.waitForTimeout(5000);
      
      // Buscar la respuesta en diferentes selectores posibles
      const responseSelectors = [
        '.message-content',
        '.response-text',
        '.chat-message:last-child',
        '[data-testid="message-content"]',
        '.prose',
        'p:last-child'
      ];
      
      let translatedText = '';
      for (const selector of responseSelectors) {
        try {
          const elements = await page.$$(selector);
          if (elements.length > 0) {
            const lastElement = elements[elements.length - 1];
            translatedText = await page.evaluate(el => el.textContent?.trim(), lastElement);
            if (translatedText && translatedText !== prompt) {
              break;
            }
          }
        } catch (e) {
          // Continuar con el siguiente selector
        }
      }
      
      // Limpiar la respuesta (quitar texto extra que pueda haber)
      if (translatedText) {
        // Remover cualquier texto que contenga el prompt original
        translatedText = translatedText.replace(new RegExp(text, 'gi'), '').trim();
        // Remover comillas si las hay
        translatedText = translatedText.replace(/^["']|["']$/g, '').trim();
      }
      
      return translatedText || text;
      
    } catch (error) {
      console.error('Error en traducción con DeepSeek:', error);
      return text;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
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
    console.log(`🌐 Iniciando traducción masiva con DeepSeek de ${texts.length} textos a ${targetLanguages.length} idiomas...`);

    for (const language of targetLanguages) {
      if (language === 'es') continue; // Skip source language
      
      console.log(`📝 Traduciendo a ${language} usando DeepSeek...`);
      
      // Process one by one to avoid overwhelming DeepSeek
      for (const text of texts) {
        try {
          // Check if translation already exists in cache
          const cached = await this.getCachedTranslation(text, language);
          if (cached && cached !== text) {
            console.log(`✓ Ya existe traducción en cache para: ${text}`);
            continue;
          }

          console.log(`🔄 Traduciendo: ${text}`);
          const translatedText = await this.translateWithDeepSeek(text, language);
          
          if (translatedText && translatedText !== text) {
            await this.saveTranslation(text, translatedText, language);
            console.log(`✅ Traducido y guardado: ${text} -> ${translatedText}`);
          }
          
          // Delay between translations to avoid overwhelming the service
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (error) {
          console.error(`Error traduciendo "${text}" a ${language}:`, error);
        }
      }
    }
    
    console.log('✅ Traducción masiva con DeepSeek completada');
  }

  static clearMemoryCache(): void {
    this.memoryCache.clear();
  }
}

export const translationCacheService = TranslationCacheService;