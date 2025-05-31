import React, { useState, useEffect, createContext, useContext } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Languages, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Contexto para el traductor basado en base de datos
interface DatabaseTranslationContextType {
  currentLanguage: string;
  translatePage: (targetLanguage: string) => void;
  resetTranslation: () => void;
  isTranslating: boolean;
}

const DatabaseTranslationContext = createContext<DatabaseTranslationContextType | null>(null);

export const useDatabaseTranslation = () => {
  const context = useContext(DatabaseTranslationContext);
  if (!context) {
    throw new Error('useDatabaseTranslation must be used within a DatabaseTranslationProvider');
  }
  return context;
};

// Idiomas disponibles
const availableLanguages = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' }
];

// Cache local para traducciones ya obtenidas
const translationCache = new Map<string, string>();

// Proveedor del contexto de traducción con base de datos
export const DatabaseTranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    try {
      return localStorage.getItem('selectedLanguage') || 'es';
    } catch {
      return 'es';
    }
  });
  const [isTranslating, setIsTranslating] = useState(false);
  const [originalTexts, setOriginalTexts] = useState<Map<Element, string>>(new Map());
  const { toast } = useToast();

  // Guardar idioma seleccionado
  useEffect(() => {
    try {
      localStorage.setItem('selectedLanguage', currentLanguage);
    } catch (error) {
      console.warn('No se pudo guardar el idioma seleccionado:', error);
    }
  }, [currentLanguage]);

  // Función para obtener traducciones desde la API
  const getTranslationsFromAPI = async (texts: string[], targetLanguage: string): Promise<Record<string, string>> => {
    try {
      const response = await fetch('/api/translate/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texts,
          targetLanguage
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.translations || {};
      }
    } catch (error) {
      console.warn('Error fetching translations from API:', error);
    }
    
    // Fallback temporal con indicadores visuales cuando no hay API configurada
    const result: Record<string, string> = {};
    const languageIndicators: { [key: string]: string } = {
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
    
    const indicator = languageIndicators[targetLanguage] || `[${targetLanguage.toUpperCase()}]`;
    
    texts.forEach(text => {
      if (targetLanguage === 'es') {
        result[text] = text; // Original español
      } else {
        result[text] = `${indicator} ${text}`;
      }
    });
    
    return result;
  };

  // Obtener elementos que contienen solo texto (sin iconos)
  const getTextElements = (): Element[] => {
    const elements: Element[] = [];
    
    const selectors = [
      'h1, h2, h3, h4, h5, h6',
      'p',
      'span:not([class*="icon"]):not([aria-hidden="true"])',
      'button:not(:has(svg)):not(:has(.icon))',
      'a:not(:has(svg)):not(:has(.icon))',
      'label:not(:has(svg))',
      'td, th',
      'li'
    ];

    selectors.forEach(selector => {
      try {
        const foundElements = document.querySelectorAll(selector);
        foundElements.forEach(element => {
          // Excluir elementos del dashboard (usan traducciones estáticas)
          if (element.closest('.dashboard-stats')) return;
          
          // Excluir elementos que contengan iconos o SVGs
          if (element.querySelector('svg, img, .icon, [class*="icon"], [role="img"]')) return;
          
          // Solo elementos con texto directo
          const hasDirectText = Array.from(element.childNodes).some(
            child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim()
          );
          
          if (hasDirectText && !elements.includes(element)) {
            const textContent = element.textContent?.trim() || '';
            // Filtrar texto válido (más de 2 caracteres, no solo símbolos)
            if (textContent.length > 2 && !/^[^\w\s]*$/.test(textContent)) {
              elements.push(element);
            }
          }
        });
      } catch (error) {
        console.warn('Error selecting elements:', error);
      }
    });
    
    return elements;
  };

  // Función principal de traducción
  const translatePage = async (targetLanguage: string) => {
    if (targetLanguage === currentLanguage) return;
    if (isTranslating) return;
    
    setIsTranslating(true);
    
    try {
      console.log(`🌐 Iniciando traducción a ${targetLanguage} usando base de datos`);
      
      if (targetLanguage === 'es') {
        resetTranslation();
        setCurrentLanguage('es');
        return;
      }
      
      // Pre-cargar traducciones comunes si es necesario
      await fetch(`/api/translate/preload/${targetLanguage}`, { method: 'POST' });
      
      const elements = getTextElements();
      console.log(`📄 Elementos encontrados para traducir: ${elements.length}`);
      
      // Guardar textos originales si no están guardados
      const currentOriginalTexts = new Map<Element, string>();
      const textsToTranslate: string[] = [];
      
      elements.forEach(element => {
        const originalText = originalTexts.get(element) || element.textContent?.trim() || '';
        if (originalText && !originalTexts.has(element)) {
          originalTexts.set(element, originalText);
        }
        currentOriginalTexts.set(element, originalText);
        
        if (originalText && !textsToTranslate.includes(originalText)) {
          textsToTranslate.push(originalText);
        }
      });
      
      if (textsToTranslate.length === 0) {
        console.log('No hay textos para traducir');
        setCurrentLanguage(targetLanguage);
        setIsTranslating(false);
        return;
      }
      
      // Obtener traducciones de la API (cache de base de datos)
      console.log(`🔄 Obteniendo ${textsToTranslate.length} traducciones desde cache de BD`);
      const translations = await getTranslationsFromAPI(textsToTranslate, targetLanguage);
      
      // Aplicar traducciones
      elements.forEach(element => {
        const originalText = currentOriginalTexts.get(element);
        if (originalText && translations[originalText]) {
          const translatedText = translations[originalText];
          if (translatedText !== originalText) {
            element.textContent = translatedText;
          }
        }
      });
      
      setCurrentLanguage(targetLanguage);
      
      const languageName = availableLanguages.find(lang => lang.code === targetLanguage)?.name || targetLanguage;
      console.log(`✅ Traducción completada a ${languageName}`);
      
      toast({
        title: "Traducción completada",
        description: `Página traducida a ${languageName}`,
      });
      
    } catch (error) {
      console.error('Error during translation:', error);
      toast({
        title: "Error de traducción",
        description: "No se pudo completar la traducción",
        variant: "destructive"
      });
    } finally {
      setIsTranslating(false);
    }
  };

  // Resetear traducción
  const resetTranslation = () => {
    if (originalTexts.size === 0) return;
    
    originalTexts.forEach((originalText, element) => {
      if (element && element.isConnected) {
        element.textContent = originalText;
      }
    });
    
    setCurrentLanguage('es');
    translationCache.clear();
  };

  // Auto-traducir al cargar si hay idioma guardado
  useEffect(() => {
    if (currentLanguage !== 'es') {
      const timer = setTimeout(() => {
        translatePage(currentLanguage);
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <DatabaseTranslationContext.Provider 
      value={{ 
        currentLanguage, 
        translatePage, 
        resetTranslation, 
        isTranslating 
      }}
    >
      {children}
    </DatabaseTranslationContext.Provider>
  );
};

// Componente del selector de idioma
export const DatabaseLanguageSelector: React.FC = () => {
  const { currentLanguage, translatePage, isTranslating } = useDatabaseTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const currentLang = availableLanguages.find(lang => lang.code === currentLanguage);

  const handleLanguageSelect = (languageCode: string) => {
    translatePage(languageCode);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative h-8 w-auto px-2 text-xs"
          disabled={isTranslating}
        >
          <Globe className="h-3 w-3 mr-1" />
          <span className="mr-1">{currentLang?.flag}</span>
          <span className="hidden sm:inline">{currentLang?.name}</span>
          <span className="sm:hidden">{currentLang?.code.toUpperCase()}</span>
          {isTranslating && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <div className="grid gap-1">
          <div className="px-2 py-1.5 text-sm font-medium text-gray-900 border-b border-gray-200">
            Seleccionar idioma
          </div>
          {availableLanguages.map((language) => (
            <Button
              key={language.code}
              variant="ghost"
              size="sm"
              className={`justify-start text-sm h-8 ${
                currentLanguage === language.code ? 'bg-blue-50 text-blue-700' : ''
              }`}
              onClick={() => handleLanguageSelect(language.code)}
              disabled={isTranslating}
            >
              <span className="mr-2">{language.flag}</span>
              {language.name}
              {currentLanguage === language.code && (
                <span className="ml-auto h-2 w-2 rounded-full bg-blue-600"></span>
              )}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};