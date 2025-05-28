import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, FileText, Send, Clock, CheckCircle2, Users, Phone } from 'lucide-react';
import { AgentSelector } from './AgentSelector';

// Interfaces básicas
interface WhatsAppChat {
  id: string;
  name: string;
  isGroup: boolean;
  timestamp: number;
  unreadCount: number;
  lastMessage: string;
  accountId: number;
  isOnline?: boolean;
  lastSeen?: number;
  messageRead?: boolean;
  profilePicUrl?: string;
}

interface WhatsAppMessage {
  id: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  hasMedia: boolean;
  type: string;
  author?: string;
  chatId: string;
  authorProfilePic?: string;
  authorNumber?: string;
}

// Componente para mostrar asignación de chat (sin prefijo "Agente:")
function ChatAssignmentBadge({ chatId, accountId }: { chatId: string; accountId: number }) {
  const [assignment, setAssignment] = useState<any>(null);

  useEffect(() => {
    // Simular carga de asignación
    setAssignment({ agentName: "Smart Legal Bot" });
  }, [chatId, accountId]);

  if (!assignment?.agentName) return null;

  return (
    <div className="flex items-center gap-2 mb-2">
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        <Users className="w-3 h-3 mr-1" />
        {assignment.agentName}
      </Badge>
    </div>
  );
}

// Componente para mostrar comentarios solo cuando existen
function ChatCommentsIndicator({ chatId }: { chatId: string }) {
  const [hasComments, setHasComments] = useState(false);

  useEffect(() => {
    // Simular verificación de comentarios
    // Solo algunos chats tienen comentarios
    setHasComments(Math.random() > 0.7);
  }, [chatId]);

  if (!hasComments) return null;

  return (
    <div className="flex items-center gap-1 text-blue-600">
      <MessageCircle className="w-4 h-4" />
      <span className="text-xs">Comentarios</span>
    </div>
  );
}

// Componente para mostrar tickets solo cuando existen
function ChatCategorizationBadge({ chatId, accountId }: { chatId: string; accountId: number }) {
  const [hasTicket, setHasTicket] = useState(false);

  useEffect(() => {
    // Simular verificación de tickets
    // Solo algunos chats tienen tickets
    setHasTicket(Math.random() > 0.8);
  }, [chatId, accountId]);

  if (!hasTicket) return null;

  return (
    <div className="flex items-center gap-1 text-green-600">
      <FileText className="w-4 h-4" />
      <span className="text-xs">Ticket</span>
    </div>
  );
}

export function WhatsAppTwoColumnClean() {
  const [selectedChat, setSelectedChat] = useState<WhatsAppChat | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');

  // Datos de ejemplo para mostrar las mejoras
  const sampleChats: WhatsAppChat[] = [
    {
      id: '1347961@c.us',
      name: 'Juan Pérez',
      isGroup: false,
      timestamp: Date.now() - 300000,
      unreadCount: 3,
      lastMessage: 'Necesito información sobre el contrato',
      accountId: 1,
      isOnline: true
    },
    {
      id: '1234567@c.us',
      name: 'María García',
      isGroup: false,
      timestamp: Date.now() - 600000,
      unreadCount: 0,
      lastMessage: 'Gracias por la ayuda',
      accountId: 1,
      isOnline: false,
      lastSeen: Date.now() - 900000
    }
  ];

  const sampleMessages: WhatsAppMessage[] = [
    {
      id: '1',
      body: 'Hola, necesito ayuda con mi consulta legal',
      fromMe: false,
      timestamp: Date.now() - 180000,
      hasMedia: false,
      type: 'chat',
      chatId: '1347961@c.us'
    },
    {
      id: '2',
      body: 'Por supuesto, puedo ayudarte. ¿Podrías contarme más detalles sobre tu situación?',
      fromMe: true,
      timestamp: Date.now() - 120000,
      hasMedia: false,
      type: 'chat',
      chatId: '1347961@c.us'
    },
    {
      id: '3',
      body: 'ÚLTIMO RECIBIDO: Se trata de un problema con mi contrato de arrendamiento',
      fromMe: false,
      timestamp: Date.now() - 60000,
      hasMedia: false,
      type: 'chat',
      chatId: '1347961@c.us'
    }
  ];

  useEffect(() => {
    if (selectedChat) {
      setMessages(sampleMessages.filter(msg => msg.chatId === selectedChat.id));
    }
  }, [selectedChat]);

  const handleChatSelect = (chat: WhatsAppChat) => {
    setSelectedChat(chat);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="flex h-[800px] bg-white border rounded-lg overflow-hidden">
      {/* Panel izquierdo - Lista de chats */}
      <div className="w-1/3 border-r bg-gray-50">
        <div className="p-4 border-b bg-white">
          <h2 className="text-lg font-semibold">Chats de WhatsApp</h2>
        </div>
        <ScrollArea className="h-full">
          {sampleChats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => handleChatSelect(chat)}
              className={`p-4 border-b cursor-pointer hover:bg-gray-100 ${
                selectedChat?.id === chat.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium">{chat.name[0]}</span>
                  </div>
                  <div>
                    <h3 className="font-medium">{chat.name}</h3>
                    {chat.isOnline ? (
                      <div className="flex items-center gap-1 text-green-600 text-xs">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        En línea
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">
                        Últ. vez: {formatTime(chat.lastSeen || chat.timestamp)}
                      </div>
                    )}
                  </div>
                </div>
                {chat.unreadCount > 0 && (
                  <Badge className="bg-green-500 text-white text-xs">
                    {chat.unreadCount}
                  </Badge>
                )}
              </div>

              {/* Asignación de agente SIN prefijo "Agente:" */}
              <ChatAssignmentBadge chatId={chat.id} accountId={chat.accountId} />

              <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                {chat.lastMessage}
              </p>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{formatTime(chat.timestamp)}</span>
                <div className="flex items-center gap-2">
                  {/* Iconos condicionales - solo aparecen cuando hay contenido */}
                  <ChatCommentsIndicator chatId={chat.id} />
                  <ChatCategorizationBadge chatId={chat.id} accountId={chat.accountId} />
                </div>
              </div>
            </div>
          ))}
        </ScrollArea>
      </div>

      {/* Panel derecho - Chat activo */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Encabezado del chat */}
            <div className="p-4 border-b bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium">{selectedChat.name[0]}</span>
                  </div>
                  <div>
                    <h3 className="font-medium">{selectedChat.name}</h3>
                    {selectedChat.isOnline ? (
                      <div className="flex items-center gap-1 text-green-600 text-sm">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        En línea
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">
                        Últ. vez: {formatTime(selectedChat.lastSeen || selectedChat.timestamp)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Phone className="w-4 h-4" />
                  </Button>
                  <AgentSelector 
                    accountId={selectedChat.accountId}
                    chatId={selectedChat.id}
                  />
                </div>
              </div>
            </div>

            {/* Área de mensajes */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}
                  >
                    {/* Burbujas limitadas al 80% del ancho */}
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        message.fromMe
                          ? 'bg-green-500 text-white rounded-br-none'
                          : 'bg-white border rounded-bl-none'
                      }`}
                    >
                      <p className="text-sm">{message.body}</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className={`text-xs ${
                          message.fromMe ? 'text-green-100' : 'text-gray-500'
                        }`}>
                          {formatTime(message.timestamp)}
                        </span>
                        {message.fromMe && (
                          <CheckCircle2 className="w-3 h-3 text-green-100" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Área de entrada de mensajes */}
            <div className="p-4 border-t bg-white">
              <div className="flex items-center gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  className="flex-1"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      // Enviar mensaje
                      console.log('Enviando:', newMessage);
                      setNewMessage('');
                    }
                  }}
                />
                <Button className="bg-green-500 hover:bg-green-600">
                  🤖 A.E
                </Button>
                <Button>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">Selecciona un chat para ver los mensajes</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}