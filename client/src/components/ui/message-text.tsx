import React from 'react';

// Regex para detectar URLs en el texto
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

interface MessageTextProps {
  text: string;
  className?: string;
}

export function MessageText({ text, className = '' }: MessageTextProps) {
  if (!text) return null;
  
  // Si no hay enlaces, simplemente mostrar el texto
  if (!text.match(URL_REGEX)) {
    return <div className={className}>{text}</div>;
  }

  // Dividir el texto por URLs
  const parts = text.split(URL_REGEX);
  const matches = text.match(URL_REGEX) || [];
  
  // Crear elementos para el texto con enlaces resaltados
  const content: JSX.Element[] = [];
  
  // Procesar cada parte del texto y los enlaces
  for (let i = 0; i < parts.length; i++) {
    // Agregar el texto normal
    if (parts[i]) {
      content.push(<span key={`text-${i}`}>{parts[i]}</span>);
    }
    
    // Agregar enlace (si existe en esta posición)
    if (i < matches.length) {
      const url = matches[i];
      content.push(
        <a 
          key={`link-${i}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline font-medium"
          onClick={(e) => {
            e.stopPropagation();
            window.open(url, '_blank');
          }}
        >
          {url}
        </a>
      );
    }
  }
  
  return <div className={className}>{content}</div>;
}