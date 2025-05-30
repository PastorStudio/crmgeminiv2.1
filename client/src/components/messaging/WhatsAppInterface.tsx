import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Phone, MoreVertical, Send, Paperclip, Smile } from "lucide-react";
import { apiRequest } from '@/lib/queryClient';

export default function WhatsAppInterface() {
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Obtener chats reales de WhatsApp
  const { data: whatsappChatsData = [] } = useQuery({
    queryKey: ['/api/whatsapp/chats'],
    queryFn: async () => {
      try {
        const result = await apiRequest('/api/whatsapp/chats');
        // Asegurar que siempre devolvemos un array
        return Array.isArray(result) ? result : [];
      } catch (error) {
        console.error('Error obteniendo chats:', error);
        return [];
      }
    }
  });

  // Obtener mensajes del chat seleccionado
  const { data: chatMessagesData = [] } = useQuery({
    queryKey: ['/api/whatsapp/messages', selectedChat?.id],
    queryFn: async () => {
      if (!selectedChat) return [];
      try {
        const result = await apiRequest(`/api/whatsapp/messages/${selectedChat.id}`);
        // Asegurar que siempre devolvemos un array
        return Array.isArray(result) ? result : [];
      } catch (error) {
        console.error('Error obteniendo mensajes:', error);
        return [];
      }
    },
    enabled: !!selectedChat
  });

  // Asegurar que whatsappChats siempre sea un array
  const whatsappChats = Array.isArray(whatsappChatsData) ? whatsappChatsData : [];
  const chatMessages = Array.isArray(chatMessagesData) ? chatMessagesData : [];

  const filteredChats = whatsappChats.filter((chat: any) =>
    chat.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.phone?.includes(searchTerm) ||
    chat.chatId?.includes(searchTerm)
  );

  const handleSendMessage = async () => {
    if (newMessage.trim() && selectedChat) {
      try {
        await apiRequest('/api/whatsapp/send', {
          method: 'POST',
          body: {
            chatId: selectedChat.chatId,
            message: newMessage,
            accountId: selectedChat.accountId
          }
        });
        setNewMessage("");
      } catch (error) {
        console.error('Error enviando mensaje:', error);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatTimestamp = (timestamp: string | Date) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) {
      const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      return diffMinutes < 1 ? 'ahora' : `${diffMinutes}m`;
    } else if (diffHours < 24) {
      return `${diffHours}h`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Panel izquierdo - Lista de chats */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        {/* Header del panel izquierdo */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold text-gray-900">WhatsApp Business</h1>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {filteredChats.length} chats
              </Badge>
            </div>
          </div>
          
          {/* Barra de búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar chats..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-50 border-gray-200"
            />
          </div>
        </div>

        {/* Lista de chats */}
        <div className="flex-1 overflow-y-auto">
          {filteredChats.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4 mx-auto">
                <Phone className="h-8 w-8 text-gray-400" />
              </div>
              <p>No hay chats disponibles</p>
              <p className="text-sm mt-1">Los chats aparecerán aquí cuando recibas mensajes</p>
            </div>
          ) : (
            filteredChats.map((chat: any) => (
              <div
                key={chat.id || chat.chatId}
                onClick={() => setSelectedChat(chat)}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedChat?.id === chat.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-green-500 text-white font-semibold">
                        {getInitials(chat.name || chat.chatId)}
                      </AvatarFallback>
                    </Avatar>
                    {chat.isOnline && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {chat.name || chat.chatId || 'Chat sin nombre'}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {formatTimestamp(chat.lastMessageTime || chat.updatedAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600 truncate flex-1 mr-2">
                        {chat.lastMessage || 'Sin mensajes'}
                      </p>
                      {chat.unreadCount > 0 && (
                        <Badge className="bg-green-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center">
                          {chat.unreadCount}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{chat.phone || chat.chatId}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Panel derecho - Chat activo */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {selectedChat ? (
          <>
            {/* Header del chat */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-green-500 text-white font-semibold">
                      {getInitials(selectedChat.name || selectedChat.chatId)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="font-semibold text-gray-900">
                      {selectedChat.name || selectedChat.chatId || 'Chat sin nombre'}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {selectedChat.isOnline ? 'En línea' : 'Desconectado'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm">
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Área de mensajes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 ? (
                <div className="text-center text-gray-500 mt-8">
                  <p>No hay mensajes en esta conversación</p>
                  <p className="text-sm mt-1">Escribe un mensaje para comenzar</p>
                </div>
              ) : (
                chatMessages.map((message: any) => (
                  <div
                    key={message.id}
                    className={`flex ${message.fromMe || message.sender === 'business' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.fromMe || message.sender === 'business'
                          ? 'bg-green-500 text-white rounded-br-none'
                          : 'bg-white text-gray-900 rounded-bl-none border border-gray-200'
                      }`}
                    >
                      <p className="text-sm">{message.content || message.text || message.body}</p>
                      <p className={`text-xs mt-1 ${
                        message.fromMe || message.sender === 'business' ? 'text-green-100' : 'text-gray-500'
                      }`}>
                        {formatTimestamp(message.timestamp || message.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input para escribir mensaje */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <div className="flex-1 relative">
                  <Input
                    placeholder="Escribe un mensaje..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="pr-10"
                  />
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="absolute right-1 top-1/2 transform -translate-y-1/2"
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                </div>
                <Button 
                  onClick={handleSendMessage}
                  className="bg-green-500 hover:bg-green-600 text-white"
                  size="sm"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4 mx-auto">
                <Phone className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Selecciona un chat</h3>
              <p className="text-gray-600">Elige una conversación para comenzar a chatear</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}