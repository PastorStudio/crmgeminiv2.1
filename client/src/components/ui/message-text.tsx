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
  
  return (
    <div className={className}>
      {parts.map((part, index) => (
        <React.Fragment key={index}>
          {part}
          {index < matches.length && (
            <a 
              href={matches[index]} 
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              {matches[index]}
            </a>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}