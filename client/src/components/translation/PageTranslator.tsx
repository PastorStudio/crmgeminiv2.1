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
  // Recuperar idioma guardado del localStorage
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    try {
      return localStorage.getItem('selectedLanguage') || 'es';
    } catch {
      return 'es';
    }
  });
  const [isTranslating, setIsTranslating] = useState(false);
  const [originalTexts, setOriginalTexts] = useState<Map<Element, { text: string, attributes: Map<string, string> } | string>>(new Map());
  const { toast } = useToast();

  // Guardar idioma seleccionado en localStorage
  useEffect(() => {
    try {
      localStorage.setItem('selectedLanguage', currentLanguage);
    } catch (error) {
      console.warn('No se pudo guardar el idioma seleccionado:', error);
    }
  }, [currentLanguage]);

  // Solo auto-traducir una vez al cargar si no es español
  useEffect(() => {
    if (currentLanguage !== 'es') {
      const timer = setTimeout(() => {
        translatePage(currentLanguage);
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, []); // Solo ejecutar una vez al montar

  // Observador de mutaciones deshabilitado temporalmente para evitar retraducciones múltiples
  // TODO: Re-implementar con mejor lógica para detectar contenido realmente nuevo
  /*
  useEffect(() => {
    if (currentLanguage === 'es') return;

    const observer = new MutationObserver((mutations) => {
      let shouldRetranslate = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          const hasTextNodes = Array.from(mutation.addedNodes).some(node => {
            if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
              return true;
            }
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              return element.textContent?.trim() || 
                     element.getAttribute('placeholder') ||
                     element.getAttribute('title') ||
                     element.getAttribute('aria-label');
            }
            return false;
          });
          
          if (hasTextNodes) {
            shouldRetranslate = true;
          }
        }
      });
      
      if (shouldRetranslate) {
        clearTimeout(window.retranslateTimer);
        window.retranslateTimer = setTimeout(() => {
          console.log('🔄 Detectados nuevos elementos, retraduciendo...');
          translatePage(currentLanguage);
        }, 1000);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: true
    });

    return () => {
      observer.disconnect();
      clearTimeout(window.retranslateTimer);
    };
  }, [currentLanguage]);
  */

  // Función para traducir texto individual usando Google Translate directo
  const translateText = async (text: string, targetLang: string = currentLanguage): Promise<string> => {
    if (!text || text.trim() === '') return text;
    if (targetLang === 'es') return text; // Si es español, no traducir
    
    const cacheKey = `${text}_${targetLang}`;
    if (translationCache.has(cacheKey)) {
      return translationCache.get(cacheKey)!;
    }

    try {
      // Usar Google Translate directamente
      const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=es&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
      
      const response = await fetch(googleUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data && data[0] && data[0].length > 0) {
          // Combinar todas las traducciones del array
          const translatedText = data[0].map((item: any) => item[0]).join('');
          if (translatedText && translatedText !== text) {
            translationCache.set(cacheKey, translatedText);
            return translatedText;
          }
        }
      }
    } catch (error) {
      console.warn('Translation failed for:', text, error);
    }

    return text; // Retornar texto original si falla la traducción
  };

  // Función para obtener elementos que contienen texto (mejorada para widgets y reportes)
  const getTextElements = (): Element[] => {
    const elements: Element[] = [];
    
    // Selectores específicos para capturar solo elementos de texto finales
    const selectors = [
      // Elementos de texto básicos
      'h1, h2, h3, h4, h5, h6',
      'p',
      'span:not([class*="material"]):not([class*="icon"])',
      'li',
      'td, th',
      'button:not([aria-expanded]):not([class*="dropdown"])',
      'a:not([class*="dropdown"])',
      'label',
      
      // Solo elementos de texto específicos, no contenedores (excluir dashboard)
      'dt:not(.dashboard-stats dt)',
      
      // Elementos de navegación y menús - más específicos
      '[role="menuitem"]',
      '[role="tab"]',
      '.nav-link',
      '.menu-item',
      '.sidebar-item',
      
      // Elementos de formularios
      'input[placeholder]',
      'textarea[placeholder]'
    ];

    selectors.forEach(selector => {
      try {
        const foundElements = document.querySelectorAll(selector);
        foundElements.forEach(element => {
          // Evitar elementos de scripts, estilos, etc.
          if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'META', 'LINK'].includes(element.tagName)) {
            return;
          }
          
          // Verificar atributo data-no-translate en el elemento o sus padres
          if (element.getAttribute('data-no-translate') === 'true' || 
              element.closest('[data-no-translate="true"]')) {
            return;
          }
          
          // Evitar completamente elementos dentro del dashboard
          if (element.closest('.dashboard-stats')) {
            return;
          }
          
          // Excluir elementos que contengan iconos, SVGs o imágenes
          const containsIcons = element.querySelector('svg, img, .icon, [class*="icon"], [role="img"]');
          if (containsIcons) {
            return;
          }
          
          // Excluir elementos con clases que indican iconos
          const iconClasses = ['icon', 'material-icons', 'lucide', 'fa-', 'svg'];
          const hasIconClass = iconClasses.some(iconClass => 
            element.className && element.className.includes(iconClass)
          );
          if (hasIconClass) {
            return;
          }
          
          // Verificar si tiene texto directo (no en elementos hijos)
          const directTextNodes = Array.from(element.childNodes).filter(
            child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim()
          );
          
          const hasDirectText = directTextNodes.length > 0;
          const hasPlaceholder = element.getAttribute('placeholder')?.trim();
          
          // Solo procesar elementos con texto directo y sin muchos hijos
          const hasMaxTwoTextNodes = directTextNodes.length <= 2;
          
          // Evitar elementos que contengan muchos elementos hijos
          const hasFewChildren = element.children.length <= 3;
          
          // Solo procesar elementos que tengan texto directo o placeholder válido
          if ((hasDirectText || hasPlaceholder) && hasMaxTwoTextNodes) {
            // Verificar que el texto no sea solo símbolos o iconos de fuente
            const textContent = element.textContent?.trim() || '';
            const placeholderContent = hasPlaceholder || '';
            const contentToCheck = textContent || placeholderContent;
            
            // Excluir contenido que parece ser iconos o símbolos
            const isValidText = contentToCheck.length > 2 && 
                               !/^[\d\s\-\+\*\/\=\.\,\:\;\!\?\@\#\$\%\^\&\*\(\)\_\+\[\]\{\}\|\\▼▲→←↑↓]+$/.test(contentToCheck) &&
                               !/^[^\w\s]*$/.test(contentToCheck); // No solo símbolos especiales
            
            if (isValidText && !elements.includes(element)) {
              elements.push(element);
            }
          }
        });
      } catch (error) {
        console.warn('Error selecting elements with selector:', selector, error);
      }
    });
    
    // Usar TreeWalker como fallback para elementos que puedan haberse perdido
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          const element = node as Element;
          
          if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'META', 'LINK'].includes(element.tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          const hasDirectText = Array.from(element.childNodes).some(
            child => child.nodeType === Node.TEXT_NODE && child.textContent?.trim()
          );
          
          return hasDirectText ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
      }
    );

    let node;
    while (node = walker.nextNode()) {
      const element = node as Element;
      if (!elements.includes(element)) {
        elements.push(element);
      }
    }
    
    console.log(`📄 Elementos encontrados para traducir: ${elements.length}`);
    return elements;
  };

  // Función para traducir toda la página (mejorada para evitar duplicaciones)
  const translatePage = async (targetLanguage: string) => {
    // Verificación estricta para español
    if (targetLanguage === 'es') {
      console.log('🚫 Idioma objetivo es español, no se requiere traducción');
      if (currentLanguage !== 'es') {
        setToSpanish();
      }
      return;
    }
    
    if (targetLanguage === currentLanguage) return;
    if (isTranslating) return; // Evitar traducciones concurrentes
    
    setIsTranslating(true);
    
    try {
      console.log(`🌐 Iniciando traducción de página a ${targetLanguage}`);
      
      // Si estamos volviendo al español, cambiar directamente
      if (targetLanguage === 'es') {
        setToSpanish();
        return;
      }
      
      // Obtener elementos con texto
      const elements = getTextElements();
      console.log(`📄 Elementos encontrados para traducir: ${elements.length}`);
      
      // Siempre guardar o usar textos originales en español
      const currentOriginalTexts = new Map<Element, { text: string, attributes: Map<string, string> }>();
      
      elements.forEach(element => {
        // Obtener texto original
        const textNodes = Array.from(element.childNodes).filter(
          node => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
        );
        
        const originalText = currentLanguage === 'es' 
          ? textNodes.map(node => node.textContent).join(' ').trim()
          : originalTexts.get(element) || textNodes.map(node => node.textContent).join(' ').trim();
        
        // Obtener atributos originales
        const originalAttributes = new Map<string, string>();
        const attributesToSave = ['placeholder', 'title', 'aria-label', 'alt'];
        
        attributesToSave.forEach(attr => {
          const value = element.getAttribute(attr);
          if (value?.trim()) {
            originalAttributes.set(attr, value);
          }
        });
        
        if (originalText || originalAttributes.size > 0) {
          currentOriginalTexts.set(element, {
            text: originalText,
            attributes: originalAttributes
          });
        }
      });
      
      // Actualizar el mapa de textos originales
      if (currentLanguage === 'es') {
        const newOriginalTexts = new Map<Element, string>();
        currentOriginalTexts.forEach((data, element) => {
          if (data.text) {
            newOriginalTexts.set(element, data.text);
          }
        });
        setOriginalTexts(newOriginalTexts);
      }
      
      // Traducir elementos en lotes
      const batchSize = 8;
      const elementsArray = Array.from(currentOriginalTexts.entries());
      
      for (let i = 0; i < elementsArray.length; i += batchSize) {
        const batch = elementsArray.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async ([element, data]) => {
          try {
            // Traducir contenido de texto
            if (data.text) {
              const translatedText = await translateText(data.text, targetLanguage);
              
              if (translatedText && translatedText !== data.text) {
                const textNodes = Array.from(element.childNodes).filter(
                  node => node.nodeType === Node.TEXT_NODE
                );
                
                if (textNodes.length > 0) {
                  // Encontrar el nodo de texto que coincide exactamente
                  const matchingNode = textNodes.find(node => 
                    node.textContent && node.textContent.trim() === data.text.trim()
                  );
                  
                  if (matchingNode) {
                    matchingNode.textContent = translatedText;
                  } else if (textNodes.length === 1) {
                    // Si solo hay un nodo de texto, reemplazarlo
                    textNodes[0].textContent = translatedText;
                  }
                } else {
                  // Si no hay nodos de texto directos, intentar con textContent del elemento
                  if (element.textContent && element.textContent.trim() === data.text.trim()) {
                    element.textContent = translatedText;
                  }
                }
              }
            }
            
            // Traducir atributos
            const attributeKeys = Array.from(data.attributes.keys());
            for (const attr of attributeKeys) {
              const originalValue = data.attributes.get(attr);
              if (originalValue) {
                const translatedAttr = await translateText(originalValue, targetLanguage);
                if (translatedAttr && translatedAttr !== originalValue) {
                  element.setAttribute(attr, translatedAttr);
                }
              }
            }
            
          } catch (error) {
            console.warn('Error translating element:', element, error);
          }
        }));
        
        // Pausa entre lotes
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      
      setCurrentLanguage(targetLanguage);
      
      const languageName = availableLanguages.find(lang => lang.code === targetLanguage)?.name || targetLanguage;
      console.log(`✅ Traducción completada a ${languageName}`);
      
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

  // Función para cambiar a español (sin reseteo, solo cambio de estado)
  const setToSpanish = () => {
    console.log('🇪🇸 Cambiando a español - modo original');
    setCurrentLanguage('es');
    setIsTranslating(false);
    localStorage.setItem('selectedLanguage', 'es');
    
    toast({
      title: "Idioma cambiado",
      description: "Interfaz en español original",
      duration: 2000
    });
  };

  const contextValue: PageTranslationContextType = {
    currentLanguage,
    translateText,
    isTranslating,
    translatePage,
    resetTranslation: setToSpanish
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
                    if (currentLanguage !== 'es') {
                      setToSpanish();
                    }
                  } else if (language.code !== currentLanguage) {
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