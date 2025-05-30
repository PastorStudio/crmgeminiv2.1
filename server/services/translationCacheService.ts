import { db } from "../db";
import { translations } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export class TranslationCacheService {
  // Cache local en memoria para evitar consultas repetidas
  private static memoryCache = new Map<string, string>();

  // Generar clave única para la traducción
  private static generateCacheKey(originalText: string, targetLanguage: string, context: string = 'general'): string {
    return `${originalText.trim()}|||${targetLanguage}|||${context}`;
  }

  // Obtener traducción desde cache de base de datos
  static async getCachedTranslation(originalText: string, targetLanguage: string, context: string = 'general'): Promise<string | null> {
    try {
      const cacheKey = this.generateCacheKey(originalText, targetLanguage, context);
      
      // Buscar primero en cache de memoria
      if (this.memoryCache.has(cacheKey)) {
        return this.memoryCache.get(cacheKey) || null;
      }

      // Buscar en base de datos
      const result = await db
        .select()
        .from(translations)
        .where(
          and(
            eq(translations.originalText, originalText.trim()),
            eq(translations.targetLanguage, targetLanguage),
            eq(translations.context, context)
          )
        )
        .limit(1);

      if (result.length > 0) {
        const translation = result[0].translatedText;
        // Guardar en cache de memoria para próximas consultas
        this.memoryCache.set(cacheKey, translation);
        return translation;
      }

      return null;
    } catch (error) {
      console.warn('Error fetching cached translation:', error);
      return null;
    }
  }

  // Guardar traducción en cache
  static async saveTranslation(originalText: string, translatedText: string, targetLanguage: string, context: string = 'general'): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(originalText, targetLanguage, context);
      
      // Guardar en base de datos
      await db
        .insert(translationCache)
        .values({
          originalText: originalText.trim(),
          translatedText: translatedText.trim(),
          targetLanguage,
          context,
          createdAt: new Date()
        })
        .onConflictDoUpdate({
          target: [translationCache.originalText, translationCache.targetLanguage, translationCache.context],
          set: {
            translatedText: translatedText.trim(),
            createdAt: new Date()
          }
        });

      // Guardar en cache de memoria
      this.memoryCache.set(cacheKey, translatedText);
    } catch (error) {
      console.warn('Error saving translation to cache:', error);
    }
  }

  // Traducir usando Google Translate (simulado - usaría API real)
  static async translateText(text: string, targetLanguage: string): Promise<string> {
    try {
      // En un entorno real, aquí se usaría la API de Google Translate
      // Por ahora, devolvemos el texto original si no es español
      if (targetLanguage === 'es') {
        return text;
      }

      // Mapeo básico para demostración
      const commonTranslations: Record<string, Record<string, string>> = {
        'en': {
          'Dashboard': 'Dashboard',
          'CRM con Gemini': 'CRM with Gemini',
          'Bienvenido de vuelta': 'Welcome back',
          'Total de Leads': 'Total Leads',
          'Leads Nuevos': 'New Leads',
          'Ventas del Mes': 'Monthly Sales',
          'Actividades Pendientes': 'Pending Activities',
          'Importar Contactos WhatsApp': 'Import WhatsApp Contacts',
          'Conversaciones Recientes': 'Recent Conversations',
          'Próximas Actividades': 'Upcoming Activities'
        },
        'fr': {
          'Dashboard': 'Tableau de bord',
          'CRM con Gemini': 'CRM avec Gemini',
          'Bienvenido de vuelta': 'Bon retour',
          'Total de Leads': 'Total des prospects',
          'Leads Nuevos': 'Nouveaux prospects',
          'Ventas del Mes': 'Ventes du mois',
          'Actividades Pendientes': 'Activités en attente'
        }
      };

      return commonTranslations[targetLanguage]?.[text] || text;
    } catch (error) {
      console.warn('Translation service error:', error);
      return text; // Devolver texto original si falla
    }
  }

  // Función principal que combina cache y traducción
  static async translateAndCache(originalText: string, targetLanguage: string, context: string = 'general'): Promise<string> {
    try {
      // Si es español, devolver el texto original
      if (targetLanguage === 'es') {
        return originalText;
      }

      // Buscar en cache primero
      const cachedTranslation = await this.getCachedTranslation(originalText, targetLanguage, context);
      if (cachedTranslation) {
        return cachedTranslation;
      }

      // Si no está en cache, traducir
      const translatedText = await this.translateText(originalText, targetLanguage);
      
      // Guardar en cache para futuras consultas
      await this.saveTranslation(originalText, translatedText, targetLanguage, context);
      
      return translatedText;
    } catch (error) {
      console.warn('Error in translateAndCache:', error);
      return originalText; // Devolver texto original si falla
    }
  }

  // Obtener múltiples traducciones de forma eficiente
  static async getMultipleTranslations(texts: string[], targetLanguage: string): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    for (const text of texts) {
      if (text && text.trim()) {
        const translation = await this.translateAndCache(text.trim(), targetLanguage);
        results.set(text, translation);
      }
    }
    
    return results;
  }

  // Pre-cargar traducciones comunes para un idioma
  static async preloadCommonTranslations(targetLanguage: string): Promise<void> {
    const commonTexts = [
      'Dashboard',
      'CRM con Gemini',
      'Bienvenido de vuelta',
      'Total de Leads',
      'Leads Nuevos',
      'Ventas del Mes',
      'Actividades Pendientes',
      'Conversaciones Recientes',
      'Próximas Actividades',
      'Importar Contactos WhatsApp',
      'Ver todos',
      'Crear nuevo',
      'Configuración',
      'Cerrar sesión'
    ];

    for (const text of commonTexts) {
      await this.translateAndCache(text, targetLanguage, 'ui');
    }
  }

  // Limpiar cache de memoria (útil para desarrollo)
  static clearMemoryCache(): void {
    this.memoryCache.clear();
  }
}

// Exportar instancia por defecto
export const translationCacheService = TranslationCacheService;