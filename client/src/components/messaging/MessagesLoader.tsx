import React, { useState, useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { MessageSquare, Clock, Phone, CheckCheck } from 'lucide-react';

interface WhatsAppMessage {
  id: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  hasMedia: boolean;
  type?: string;
}

interface MessagesLoaderProps {
  chatId: string;
  onMessagesLoaded?: (messages: WhatsAppMessage[]) => void;
}

export function MessagesLoader({ chatId, onMessagesLoaded }: MessagesLoaderProps) {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Cargar mensajes desde la API
  const loadMessages = async () => {
    if (!chatId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`Cargando mensajes reales para chat: ${chatId}`);
      
      // Rechazar chats demo
      if (chatId.startsWith('demo-')) {
        console.log(`⚠️ Chat demo rechazado: ${chatId}`);
        setMessages([]);
        setIsLoading(false);
        return;
      }
      
      // Cargar mensajes reales desde la API
      const response = await fetch(`/api/direct/whatsapp/messages/${chatId}`);
      const data = await response.json();
      
      if (Array.isArray(data) && data.length > 0) {
        console.log(`✅ Cargados ${data.length} mensajes reales para chat ${chatId}`);
        setMessages(data);
        
        // Notificar al componente padre
        if (onMessagesLoaded) {
          onMessagesLoaded(data);
        }
        
        // Guardar en caché
        localStorage.setItem(`whatsapp_messages_${chatId}`, JSON.stringify(data));
      } else {
        // No hay mensajes desde API, intentar cargar desde caché
        const cachedMessages = localStorage.getItem(`whatsapp_messages_${chatId}`);
        
        if (cachedMessages) {
          try {
            const parsedMessages = JSON.parse(cachedMessages);
            if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
              console.log(`Cargados ${parsedMessages.length} mensajes desde caché para chat ${chatId}`);
              setMessages(parsedMessages);
              
              if (onMessagesLoaded) {
                onMessagesLoaded(parsedMessages);
              }
            } else {
              setMessages([]);
            }
          } catch (e) {
            console.error('Error parseando mensajes desde caché:', e);
            setMessages([]);
          }
        } else {
          console.log(`No se encontraron mensajes para el chat ${chatId}`);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error(`Error al cargar mensajes:`, err);
      setError('Error al cargar mensajes. Intente nuevamente.');
      
      // Intentar cargar desde caché como respaldo
      const cachedMessages = localStorage.getItem(`whatsapp_messages_${chatId}`);
      if (cachedMessages) {
        try {
          const parsedMessages = JSON.parse(cachedMessages);
          setMessages(parsedMessages);
        } catch (e) {
          setMessages([]);
        }
      } else {
        setMessages([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Cargar mensajes cuando cambia el chat
  useEffect(() => {
    if (chatId) {
      loadMessages();
    }
  }, [chatId]);

  // Scroll automático al final
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Formatear timestamp
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-2 text-sm text-gray-500">Cargando mensajes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-red-500">
          <MessageSquare className="h-12 w-12 mx-auto mb-2" />
          <p className="font-medium">Error al cargar mensajes</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full p-4">
      <div className="space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>No hay mensajes en este chat</p>
            <p className="text-sm">Los mensajes aparecerán aquí cuando tengas una conversación</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-3 py-2 ${
                  message.fromMe
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm">{message.body}</p>
                <div className={`flex items-center justify-end mt-1 space-x-1 text-xs ${
                  message.fromMe ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  <Clock className="h-3 w-3" />
                  <span>{formatTime(message.timestamp)}</span>
                  {message.fromMe && (
                    <CheckCheck className="h-3 w-3" />
                  )}
                </div>
                {message.hasMedia && (
                  <Badge variant="secondary" className="mt-1 text-xs">
                    Media
                  </Badge>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}

export default MessagesLoader;