import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Send, Loader2, Search, MessageCircle, Clock, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WhatsAppChat {
  id: string;
  name: string;
  isGroup: boolean;
  timestamp: number;
  unreadCount: number;
  lastMessage: string;
  accountId: number;
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
}

export function WhatsAppTwoColumn() {
  const [selectedChat, setSelectedChat] = useState<WhatsAppChat | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Cargar cuentas de WhatsApp disponibles
  const { data: accounts = [] } = useQuery({
    queryKey: ['whatsapp-accounts'],
    queryFn: async () => {
      const response = await fetch('/api/whatsapp-accounts');
      if (!response.ok) throw new Error('Error al cargar cuentas');
      return response.json();
    },
    refetchInterval: 30000
  });

  // Usar la primera cuenta activa
  const selectedAccount = accounts.find(acc => acc.currentStatus?.authenticated) || accounts[0];

  // Cargar chats de WhatsApp - CHATS REALES
  const { data: chats = [], isLoading: loadingChats, refetch: refetchChats } = useQuery({
    queryKey: ['whatsapp-chats', selectedAccount?.id],
    queryFn: async () => {
      if (!selectedAccount?.id) return [];
      
      console.log(`Cargando chats reales para cuenta ${selectedAccount.id}...`);
      const response = await fetch(`/api/whatsapp-accounts/${selectedAccount.id}/chats`);
      if (!response.ok) {
        console.log('Error en respuesta de chats');
        return [];
      }
      const chatsData = await response.json();
      console.log(`✅ Cargados ${chatsData.length} chats reales`);
      return chatsData;
    },
    enabled: !!selectedAccount?.id,
    refetchInterval: 15000, // Refrescar cada 15 segundos
  });

  // Cargar mensajes del chat seleccionado - MENSAJES REALES
  const { data: messages = [], isLoading: loadingMessages, refetch: refetchMessages } = useQuery({
    queryKey: ['whatsapp-messages', selectedChat?.id, selectedAccount?.id],
    queryFn: async () => {
      if (!selectedChat?.id || !selectedAccount?.id) return [];
      
      console.log(`Cargando mensajes reales para chat ${selectedChat.id}...`);
      const response = await fetch(`/api/whatsapp-accounts/${selectedAccount.id}/messages/${selectedChat.id}?limit=50`);
      if (!response.ok) {
        console.log('Error en respuesta de mensajes');
        return [];
      }
      const messagesData = await response.json();
      console.log(`✅ Cargados ${messagesData.length} mensajes reales`);
      return messagesData;
    },
    enabled: !!selectedChat?.id && !!selectedAccount?.id,
    refetchInterval: 10000, // Refrescar cada 10 segundos
  });

  // Enviar mensaje
  const sendMessageMutation = useMutation({
    mutationFn: async ({ chatId, message }: { chatId: string; message: string }) => {
      const response = await fetch(`/api/whatsapp-accounts/${selectedAccount.id}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: chatId,
          message: message,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Error al enviar mensaje');
      }
      
      return response.json();
    },
    onSuccess: () => {
      setNewMessage('');
      refetchMessages();
      toast({
        title: "Mensaje enviado",
        description: "Tu mensaje se envió correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje.",
        variant: "destructive",
      });
    },
  });

  // Filtrar chats según búsqueda
  const filteredChats = chats.filter(chat => 
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Auto-scroll a mensajes más recientes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Formatear fecha
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoy';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ayer';
    } else {
      return date.toLocaleDateString('es-ES', { 
        day: '2-digit', 
        month: '2-digit', 
        year: '2-digit' 
      });
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;

    sendMessageMutation.mutate({
      chatId: selectedChat.id,
      message: newMessage.trim(),
    });
  };

  return (
    <div className="w-full h-screen flex bg-gray-50">
      {/* COLUMNA IZQUIERDA - LISTA DE CHATS (25%) */}
      <div className="w-1/4 border-r border-gray-200 bg-white flex flex-col">
        {/* Header de chats */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">WhatsApp</h2>
            <Badge variant="outline" className="text-xs">
              {selectedAccount?.name || 'Sin cuenta'}
            </Badge>
          </div>
          
          {/* Buscador de chats */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-gray-50 border-gray-200"
            />
          </div>
        </div>

        {/* Lista de chats */}
        <ScrollArea className="flex-1">
          {loadingChats ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Cargando chats...</span>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-gray-500">
              <MessageCircle className="h-12 w-12 mb-3 text-gray-300" />
              <p className="text-sm">No hay chats disponibles</p>
              {!selectedAccount?.currentStatus?.authenticated && (
                <p className="text-xs mt-1">Conecta WhatsApp primero</p>
              )}
            </div>
          ) : (
            <div className="p-2">
              {filteredChats.map((chat) => (
                <Card
                  key={chat.id}
                  className={`p-3 mb-2 cursor-pointer transition-colors hover:bg-gray-50 ${
                    selectedChat?.id === chat.id ? 'bg-blue-50 border-blue-200' : 'border-gray-200'
                  }`}
                  onClick={() => setSelectedChat(chat)}
                >
                  <div className="flex items-start space-x-3">
                    {/* Avatar */}
                    <Avatar className="h-12 w-12 flex-shrink-0">
                      <AvatarFallback className={`${chat.isGroup ? 'bg-green-100' : 'bg-blue-100'}`}>
                        {chat.isGroup ? (
                          <Users className="h-6 w-6 text-green-600" />
                        ) : (
                          chat.name.charAt(0).toUpperCase()
                        )}
                      </AvatarFallback>
                    </Avatar>

                    {/* Contenido del chat */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-medium text-gray-900 truncate">
                          {chat.name}
                        </h3>
                        <span className="text-xs text-gray-500">
                          {formatTime(chat.timestamp)}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-600 truncate mb-1">
                        {chat.lastMessage || 'Sin mensajes'}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">
                          {formatDate(chat.timestamp)}
                        </span>
                        {chat.unreadCount > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {chat.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* COLUMNA DERECHA - ÁREA DE MENSAJES (75%) */}
      <div className="w-3/4 flex flex-col bg-white">
        {selectedChat ? (
          <>
            {/* Header del chat seleccionado */}
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center space-x-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className={`${selectedChat.isGroup ? 'bg-green-100' : 'bg-blue-100'}`}>
                    {selectedChat.isGroup ? (
                      <Users className="h-5 w-5 text-green-600" />
                    ) : (
                      selectedChat.name.charAt(0).toUpperCase()
                    )}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedChat.name}</h3>
                  <p className="text-sm text-gray-500">
                    {selectedChat.isGroup ? 'Grupo' : 'Contacto'} • {messages.length} mensajes
                  </p>
                </div>
              </div>
            </div>

            {/* Área de mensajes */}
            <ScrollArea className="flex-1 p-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-500">Cargando mensajes...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                  <MessageCircle className="h-12 w-12 mb-3 text-gray-300" />
                  <p>No hay mensajes en este chat</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.fromMe
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {!message.fromMe && selectedChat.isGroup && (
                          <p className="text-xs font-medium mb-1 opacity-75">
                            {message.author || 'Desconocido'}
                          </p>
                        )}
                        <p className="text-sm">{message.body}</p>
                        <div className={`flex items-center justify-end mt-1 space-x-1 ${
                          message.fromMe ? 'text-blue-100' : 'text-gray-400'
                        }`}>
                          <Clock className="h-3 w-3" />
                          <span className="text-xs">
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input para enviar mensajes */}
            <div className="p-4 border-t border-gray-100">
              <form onSubmit={handleSendMessage} className="flex space-x-3">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  className="flex-1"
                  disabled={sendMessageMutation.isPending}
                />
                <Button 
                  type="submit" 
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  className="px-6"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          </>
        ) : (
          /* Pantalla cuando no hay chat seleccionado */
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-500">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">Selecciona un chat</h3>
              <p className="text-sm">Elige un chat de la lista para ver los mensajes</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}