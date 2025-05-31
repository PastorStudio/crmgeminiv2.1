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

    // Usar servicios de traducción gratuitos
    try {
      const translation = await this.translateWithFreeServices(text, targetLanguage);
      if (translation && translation !== text) {
        return translation;
      }
    } catch (error) {
      console.warn('Free translation services error:', error);
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

  static async translateWithFreeServices(text: string, targetLanguage: string): Promise<string> {
    // Intentar múltiples servicios gratuitos
    const services = [
      () => this.translateWithMyMemory(text, targetLanguage),
      () => this.translateWithLibreTranslate(text, targetLanguage),
      () => this.translateWithLinguee(text, targetLanguage)
    ];

    for (const service of services) {
      try {
        const result = await service();
        if (result && result !== text && result.length > 0) {
          console.log(`✅ Traducción exitosa: ${text} -> ${result}`);
          return result;
        }
      } catch (error) {
        console.warn('Error en servicio de traducción:', error);
        continue;
      }
    }

    return text; // Fallback al texto original
  }

  static async translateWithMyMemory(text: string, targetLanguage: string): Promise<string> {
    try {
      const langPair = `es|${targetLanguage}`;
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.responseData && data.responseData.translatedText) {
          return data.responseData.translatedText;
        }
      }
    } catch (error) {
      console.warn('MyMemory translation error:', error);
    }
    return text;
  }

  static async translateWithLibreTranslate(text: string, targetLanguage: string): Promise<string> {
    try {
      // Usar instancia pública de LibreTranslate
      const response = await fetch('https://libretranslate.de/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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
        if (data.translatedText) {
          return data.translatedText;
        }
      }
    } catch (error) {
      console.warn('LibreTranslate error:', error);
    }
    return text;
  }

  static async translateWithLinguee(text: string, targetLanguage: string): Promise<string> {
    try {
      // Simular traducción usando patrones conocidos para textos comunes
      const commonTranslations: { [key: string]: { [lang: string]: string } } = {
        'Dashboard': {
          'en': 'Dashboard',
          'fr': 'Tableau de bord',
          'de': 'Armaturenbrett',
          'pt': 'Painel',
          'it': 'Cruscotto',
          'ru': 'Панель управления',
          'zh': '仪表板',
          'ja': 'ダッシュボード',
          'ko': '대시보드',
          'ar': 'لوحة القيادة'
        },
        'Mensajes': {
          'en': 'Messages',
          'fr': 'Messages',
          'de': 'Nachrichten',
          'pt': 'Mensagens',
          'it': 'Messaggi',
          'ru': 'Сообщения',
          'zh': '消息',
          'ja': 'メッセージ',
          'ko': '메시지',
          'ar': 'الرسائل'
        },
        'Prospectos': {
          'en': 'Leads',
          'fr': 'Prospects',
          'de': 'Interessenten',
          'pt': 'Prospects',
          'it': 'Prospect',
          'ru': 'Лиды',
          'zh': '潜在客户',
          'ja': 'リード',
          'ko': '리드',
          'ar': 'العملاء المحتملون'
        },
        'Configuración': {
          'en': 'Settings',
          'fr': 'Paramètres',
          'de': 'Einstellungen',
          'pt': 'Configurações',
          'it': 'Impostazioni',
          'ru': 'Настройки',
          'zh': '设置',
          'ja': '設定',
          'ko': '설정',
          'ar': 'الإعدادات'
        },
        'Guardar': {
          'en': 'Save',
          'fr': 'Sauvegarder',
          'de': 'Speichern',
          'pt': 'Salvar',
          'it': 'Salva',
          'ru': 'Сохранить',
          'zh': '保存',
          'ja': '保存',
          'ko': '저장',
          'ar': 'حفظ'
        },
        'Cancelar': {
          'en': 'Cancel',
          'fr': 'Annuler',
          'de': 'Abbrechen',
          'pt': 'Cancelar',
          'it': 'Annulla',
          'ru': 'Отмена',
          'zh': '取消',
          'ja': 'キャンセル',
          'ko': '취소',
          'ar': 'إلغاء'
        },
        'Nuevo': {
          'en': 'New',
          'fr': 'Nouveau',
          'de': 'Neu',
          'pt': 'Novo',
          'it': 'Nuovo',
          'ru': 'Новый',
          'zh': '新建',
          'ja': '新規',
          'ko': '새로운',
          'ar': 'جديد'
        },
        'Editar': {
          'en': 'Edit',
          'fr': 'Modifier',
          'de': 'Bearbeiten',
          'pt': 'Editar',
          'it': 'Modifica',
          'ru': 'Редактировать',
          'zh': '编辑',
          'ja': '編集',
          'ko': '편집',
          'ar': 'تحرير'
        },
        'Eliminar': {
          'en': 'Delete',
          'fr': 'Supprimer',
          'de': 'Löschen',
          'pt': 'Excluir',
          'it': 'Elimina',
          'ru': 'Удалить',
          'zh': '删除',
          'ja': '削除',
          'ko': '삭제',
          'ar': 'حذف'
        },
        'Total': {
          'en': 'Total',
          'fr': 'Total',
          'de': 'Gesamt',
          'pt': 'Total',
          'it': 'Totale',
          'ru': 'Всего',
          'zh': '总计',
          'ja': '合計',
          'ko': '총계',
          'ar': 'المجموع'
        }
      };

      if (commonTranslations[text] && commonTranslations[text][targetLanguage]) {
        return commonTranslations[text][targetLanguage];
      }
    } catch (error) {
      console.warn('Linguee translation error:', error);
    }
    return text;
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
          const translatedText = await this.translateWithFreeServices(text, language);
          
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