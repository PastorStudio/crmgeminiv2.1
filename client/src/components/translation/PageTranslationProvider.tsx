import React, { createContext, useContext, ReactNode } from 'react';

interface PageTranslationContextType {
  translate: (key: string) => string;
  currentLanguage: string;
}

const PageTranslationContext = createContext<PageTranslationContextType | undefined>(undefined);

interface PageTranslationProviderProps {
  children: ReactNode;
}

export const PageTranslationProvider: React.FC<PageTranslationProviderProps> = ({ children }) => {
  const translate = (key: string) => key; // Simple passthrough for now
  const currentLanguage = 'es';

  return (
    <PageTranslationContext.Provider value={{ translate, currentLanguage }}>
      {children}
    </PageTranslationContext.Provider>
  );
};

export const usePageTranslation = () => {
  const context = useContext(PageTranslationContext);
  if (context === undefined) {
    throw new Error('usePageTranslation must be used within a PageTranslationProvider');
  }
  return context;
};