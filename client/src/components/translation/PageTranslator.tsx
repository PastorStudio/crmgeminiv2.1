import React, { useState, useEffect, createContext, useContext } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Languages, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Contexto para el traductor de página
interface PageTranslationContextType {
  currentLanguage: string;
  translateText: (text: string, targetLang?: string) => Promise<string>;
  isTranslating: boolean;
  translatePage: (targetLanguage: string) => void;
  resetTranslation: () => void;
}

const PageTranslationContext = createContext<PageTranslationContextType | null>(null);

// Hook para usar el contexto de traducción
export const usePageTranslation = () => {
  const context = useContext(PageTranslationContext);
  if (!context) {
    throw new Error('usePageTranslation must be used within a PageTranslationProvider');
  }
  return context;
};

// Idiomas disponibles para traducción de página completa
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
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
  { code: 'no', name: 'Norsk', flag: '🇳🇴' },
  { code: 'da', name: 'Dansk', flag: '🇩🇰' },
  { code: 'fi', name: 'Suomi', flag: '🇫🇮' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'cs', name: 'Čeština', flag: '🇨🇿' },
  { code: 'hu', name: 'Magyar', flag: '🇭🇺' },
  { code: 'ro', name: 'Română', flag: '🇷🇴' },
  { code: 'bg', name: 'Български', flag: '🇧🇬' },
  { code: 'hr', name: 'Hrvatski', flag: '🇭🇷' },
  { code: 'sk', name: 'Slovenčina', flag: '🇸🇰' },
  { code: 'sl', name: 'Slovenščina', flag: '🇸🇮' },
  { code: 'et', name: 'Eesti', flag: '🇪🇪' },
  { code: 'lv', name: 'Latviešu', flag: '🇱🇻' },
  { code: 'lt', name: 'Lietuvių', flag: '🇱🇹' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'he', name: 'עברית', flag: '🇮🇱' },
  { code: 'th', name: 'ไทย', flag: '🇹🇭' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'ms', name: 'Bahasa Melayu', flag: '🇲🇾' },
  { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'tl', name: 'Filipino', flag: '🇵🇭' }
];

// Cache de traducciones para optimizar rendimiento
const translationCache = new Map<string, string>();

// Proveedor del contexto de traducción
export const PageTranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState('es'); // Idioma por defecto: español
  const [isTranslating, setIsTranslating] = useState(false);
  const [originalTexts, setOriginalTexts] = useState<Map<Element, string>>(new Map());
  const { toast } = useToast();

  // Función para traducir texto individual
  const translateText = async (text: string, targetLang: string = currentLanguage): Promise<string> => {
    if (!text || text.trim() === '') return text;
    if (targetLang === 'es') return text; // Si es español, no traducir
    
    const cacheKey = `${text}_${targetLang}`;
    if (translationCache.has(cacheKey)) {
      return translationCache.get(cacheKey)!;
    }

    try {
      // Usar Google Translate API a través de nuestro backend
      const response = await fetch('/api/translate-page-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          targetLanguage: targetLang,
          sourceLanguage: 'es'
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.translatedText) {
          translationCache.set(cacheKey, result.translatedText);
          return result.translatedText;
        }
      }

      // Fallback: intentar con Google Translate público
      const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=es&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
      const googleResponse = await fetch(googleUrl);
      
      if (googleResponse.ok) {
        const data = await googleResponse.json();
        if (data && data[0] && data[0][0] && data[0][0][0]) {
          const translatedText = data[0][0][0];
          translationCache.set(cacheKey, translatedText);
          return translatedText;
        }
      }
    } catch (error) {
      console.warn('Translation failed for:', text, error);
    }

    return text; // Retornar texto original si falla la traducción
  };

  // Función para obtener elementos que contienen texto
  const getTextElements = (): Element[] => {
    const elements: Element[] = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          const element = node as Element;
          
          // Evitar elementos de scripts, estilos, etc.
          if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'META', 'LINK'].includes(element.tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Solo elementos que contienen texto directo
          const hasDirectText = Array.from(element.childNodes).some(
            child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim()
          );
          
          return hasDirectText ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      elements.push(node as Element);
    }
    
    return elements;
  };

  // Función para traducir toda la página
  const translatePage = async (targetLanguage: string) => {
    if (targetLanguage === currentLanguage) return;
    
    setIsTranslating(true);
    
    try {
      console.log(`🌐 Iniciando traducción de página a ${targetLanguage}`);
      
      // Obtener elementos con texto
      const elements = getTextElements();
      console.log(`📄 Encontrados ${elements.length} elementos para traducir`);
      
      // Guardar textos originales si es la primera traducción
      if (currentLanguage === 'es') {
        const newOriginalTexts = new Map<Element, string>();
        elements.forEach(element => {
          const textNodes = Array.from(element.childNodes).filter(
            node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
          );
          
          if (textNodes.length > 0) {
            const originalText = textNodes.map(node => node.textContent).join(' ').trim();
            if (originalText) {
              newOriginalTexts.set(element, originalText);
            }
          }
        });
        setOriginalTexts(newOriginalTexts);
      }
      
      // Traducir elementos en lotes para mejor rendimiento
      const batchSize = 10;
      const elementsToTranslate = currentLanguage === 'es' ? elements : Array.from(originalTexts.keys());
      
      for (let i = 0; i < elementsToTranslate.length; i += batchSize) {
        const batch = elementsToTranslate.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (element) => {
          try {
            const originalText = currentLanguage === 'es' 
              ? Array.from(element.childNodes)
                  .filter(node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
                  .map(node => node.textContent)
                  .join(' ')
                  .trim()
              : originalTexts.get(element) || '';
            
            if (!originalText) return;
            
            const translatedText = await translateText(originalText, targetLanguage);
            
            if (translatedText && translatedText !== originalText) {
              // Reemplazar solo los nodos de texto
              const textNodes = Array.from(element.childNodes).filter(
                node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
              );
              
              if (textNodes.length > 0) {
                textNodes.forEach(node => {
                  if (node.textContent?.trim()) {
                    node.textContent = translatedText;
                  }
                });
              }
            }
          } catch (error) {
            console.warn('Error translating element:', element, error);
          }
        }));
        
        // Pequeña pausa entre lotes para no sobrecargar
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setCurrentLanguage(targetLanguage);
      
      const languageName = availableLanguages.find(lang => lang.code === targetLanguage)?.name || targetLanguage;
      toast({
        title: "Traducción completada",
        description: `Página traducida a ${languageName}`,
        duration: 3000
      });
      
    } catch (error) {
      console.error('Error translating page:', error);
      toast({
        title: "Error en traducción",
        description: "No se pudo traducir la página completa",
        variant: "destructive"
      });
    } finally {
      setIsTranslating(false);
    }
  };

  // Función para resetear traducción
  const resetTranslation = () => {
    if (currentLanguage === 'es') return;
    
    try {
      // Restaurar textos originales
      originalTexts.forEach((originalText, element) => {
        const textNodes = Array.from(element.childNodes).filter(
          node => node.nodeType === Node.TEXT_NODE
        );
        
        if (textNodes.length > 0) {
          textNodes.forEach(node => {
            node.textContent = originalText;
          });
        }
      });
      
      setCurrentLanguage('es');
      toast({
        title: "Traducción reiniciada",
        description: "Página restaurada al español original",
        duration: 2000
      });
    } catch (error) {
      console.error('Error resetting translation:', error);
    }
  };

  const contextValue: PageTranslationContextType = {
    currentLanguage,
    translateText,
    isTranslating,
    translatePage,
    resetTranslation
  };

  return (
    <PageTranslationContext.Provider value={contextValue}>
      {children}
    </PageTranslationContext.Provider>
  );
};

// Componente del selector de idioma para traducción de página
export const PageTranslationSelector: React.FC = () => {
  const { currentLanguage, translatePage, resetTranslation, isTranslating } = usePageTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const currentLangData = availableLanguages.find(lang => lang.code === currentLanguage);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={currentLanguage === 'es' ? "outline" : "default"}
          size="sm"
          className={`h-9 px-3 ${currentLanguage !== 'es' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
          disabled={isTranslating}
        >
          <Globe className="h-4 w-4 mr-2" />
          {currentLangData?.flag} {currentLangData?.name}
          {isTranslating && <span className="ml-2 animate-spin">⟳</span>}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-3" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Traducir Página Completa</h4>
            {currentLanguage !== 'es' && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetTranslation}
                disabled={isTranslating}
              >
                Resetear
              </Button>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-1 max-h-60 overflow-y-auto">
            {availableLanguages.map((language) => (
              <Button
                key={language.code}
                variant={currentLanguage === language.code ? "default" : "ghost"}
                size="sm"
                className="justify-start text-xs p-2 h-8"
                onClick={() => {
                  if (language.code === 'es') {
                    resetTranslation();
                  } else {
                    translatePage(language.code);
                  }
                  setIsOpen(false);
                }}
                disabled={isTranslating}
              >
                <span className="mr-2">{language.flag}</span>
                {language.name}
              </Button>
            ))}
          </div>
          
          <div className="text-xs text-gray-500 pt-2 border-t">
            <p>Selecciona un idioma para traducir toda la interfaz usando Google Translate</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};