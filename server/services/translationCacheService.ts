import { db } from '../db';
import { translations } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

export class TranslationCacheService {
  
  // Generar hash único para el texto
  private static generateTextHash(text: string, targetLanguage: string): string {
    return crypto.createHash('md5').update(`${text}_${targetLanguage}`).digest('hex');
  }

  // Obtener traducción desde cache
  static async getTranslation(originalText: string, targetLanguage: string): Promise<string | null> {
    if (!originalText?.trim() || targetLanguage === 'es') {
      return originalText;
    }

    try {
      const textHash = this.generateTextHash(originalText, targetLanguage);
      
      const [cached] = await db
        .select()
        .from(translations)
        .where(and(
          eq(translations.textHash, textHash),
          eq(translations.targetLanguage, targetLanguage)
        ))
        .limit(1);

      return cached?.translatedText || null;
    } catch (error) {
      console.warn('Error fetching cached translation:', error);
      return null;
    }
  }

  // Guardar traducción en cache
  static async saveTranslation(
    originalText: string, 
    targetLanguage: string, 
    translatedText: string,
    context: string = 'general'
  ): Promise<void> {
    if (!originalText?.trim() || !translatedText?.trim() || targetLanguage === 'es') {
      return;
    }

    try {
      const textHash = this.generateTextHash(originalText, targetLanguage);
      
      await db
        .insert(translations)
        .values({
          originalText: originalText.trim(),
          targetLanguage,
          translatedText: translatedText.trim(),
          context,
          textHash
        })
        .onConflictDoNothing();
    } catch (error) {
      console.warn('Error saving translation to cache:', error);
    }
  }

  // Traducir texto con Google Translate y guardarlo en cache
  static async translateAndCache(
    originalText: string, 
    targetLanguage: string,
    context: string = 'general'
  ): Promise<string> {
    if (!originalText?.trim() || targetLanguage === 'es') {
      return originalText;
    }

    // Primero revisar cache
    const cached = await this.getTranslation(originalText, targetLanguage);
    if (cached) {
      return cached;
    }

    // Si no está en cache, traducir con Google
    try {
      const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=es&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(originalText)}`;
      
      const response = await fetch(googleUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data && data[0] && data[0].length > 0) {
          const translatedText = data[0].map((item: any) => item[0]).join('');
          if (translatedText && translatedText !== originalText) {
            // Guardar en cache
            await this.saveTranslation(originalText, targetLanguage, translatedText, context);
            return translatedText;
          }
        }
      }
    } catch (error) {
      console.warn('Translation failed for:', originalText, error);
    }

    return originalText; // Retornar original si falla
  }

  // Obtener múltiples traducciones de una vez
  static async getMultipleTranslations(
    texts: string[], 
    targetLanguage: string
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();

    if (targetLanguage === 'es') {
      texts.forEach(text => result.set(text, text));
      return result;
    }

    try {
      const textHashes = texts.map(text => this.generateTextHash(text, targetLanguage));
      
      const cached = await db
        .select()
        .from(translations)
        .where(and(
          eq(translations.targetLanguage, targetLanguage)
        ));

      // Mapear resultados
      cached.forEach(translation => {
        result.set(translation.originalText, translation.translatedText);
      });

      // Para textos no encontrados, agregar original
      texts.forEach(text => {
        if (!result.has(text)) {
          result.set(text, text);
        }
      });

    } catch (error) {
      console.warn('Error fetching multiple translations:', error);
      // En caso de error, retornar textos originales
      texts.forEach(text => result.set(text, text));
    }

    return result;
  }

  // Pre-cargar traducciones para elementos comunes de la interfaz
  static async preloadCommonTranslations(targetLanguage: string): Promise<void> {
    if (targetLanguage === 'es') return;

    const commonTexts = [
      'Dashboard',
      'Total Leads',
      'Conversion Rate', 
      'Active Conversations',
      'Today\'s Meetings',
      'Messages',
      'Leads',
      'Activities',
      'Reports',
      'Settings',
      'Logout',
      'Search',
      'Filter',
      'Save',
      'Cancel',
      'Delete',
      'Edit',
      'Add',
      'New',
      'Status',
      'Priority',
      'Assigned to',
      'Created',
      'Updated',
      'Actions'
    ];

    // Traducir y cachear todos los textos comunes
    await Promise.all(
      commonTexts.map(text => 
        this.translateAndCache(text, targetLanguage, 'interface')
      )
    );
  }
}