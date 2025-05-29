import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Send, Phone, Search, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  isGroup: boolean;
  avatar?: string;
  isOnline?: boolean;
  phone?: string;
}

interface Message {
  id: string;
  text: string;
  timestamp: string;
  fromMe: boolean;
  sender?: string;
  status?: 'sent' | 'delivered' | 'read';
}

interface WhatsAppAccount {
  id: number;
  name: string;
  status: string;
  isConnected: boolean;
}

export function WhatsAppSimple() {
  const [selectedAccount, setSelectedAccount] = useState<number | null>(1);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageText, setMessageText] = useState('');

  // Queries básicas con manejo de errores
  const { data: accounts = [] } = useQuery({
    queryKey: ['/api/whatsapp-accounts'],
    enabled: true,
    retry: false,
    select: (data) => Array.isArray(data) ? data : []
  });

  const { data: chats = [] } = useQuery({
    queryKey: ['/api/whatsapp/chats', selectedAccount],
    enabled: !!selectedAccount,
    retry: false,
    select: (data) => Array.isArray(data) ? data : []
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['/api/whatsapp/messages', selectedAccount, selectedChat?.id],
    enabled: !!selectedAccount && !!selectedChat?.id,
    retry: false,
    select: (data) => Array.isArray(data) ? data : []
  });

  // Filtrar chats
  const filteredChats = chats.filter((chat: Chat) =>
    chat.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedChat || !selectedAccount) return;

    try {
      const response = await fetch('/api/whatsapp/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccount,
          chatId: selectedChat.id,
          message: messageText
        })
      });

      if (response.ok) {
        setMessageText('');
      }
    } catch (error) {
      console.error('Error enviando mensaje:', error);
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Panel izquierdo - Lista de chats */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">WhatsApp CRM</h2>
            <div className="flex items-center gap-2">
              <select 
                value={selectedAccount || ''}
                onChange={(e) => setSelectedAccount(Number(e.target.value) || null)}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value="">Seleccionar cuenta</option>
                {accounts.map((account: WhatsAppAccount) => (
                  <option key={account.id} value={account.id}>
                    {account.name} {account.isConnected ? '🟢' : '🔴'}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar conversaciones..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Lista de chats */}
        <div className="flex-1 overflow-y-auto">
          {filteredChats.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {selectedAccount ? 'No hay chats disponibles' : 'Selecciona una cuenta'}
            </div>
          ) : (
            filteredChats.map((chat: Chat) => (
              <div
                key={chat.id}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                  selectedChat?.id === chat.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                }`}
                onClick={() => setSelectedChat(chat)}
              >
                <div className="flex items-start space-x-3">
                  <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-gray-600 font-medium">
                      {chat.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900 truncate">
                        {chat.name || 'Sin nombre'}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {formatTime(chat.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 truncate">
                      {chat.lastMessage || 'Sin mensajes'}
                    </p>
                    {chat.unreadCount > 0 && (
                      <Badge variant="destructive" className="mt-1">
                        {chat.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Panel derecho - Chat */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Header del chat */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-gray-600 font-medium">
                      {selectedChat.name?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {selectedChat.name || 'Sin nombre'}
                    </h3>
                    {selectedChat.phone && (
                      <p className="text-sm text-gray-500">{selectedChat.phone}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm">
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500">
                  No hay mensajes en esta conversación
                </div>
              ) : (
                messages.map((message: Message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.fromMe
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-200 text-gray-900'
                      }`}
                    >
                      <p className="text-sm">{message.text}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs opacity-75">
                          {formatTime(message.timestamp)}
                        </span>
                        {message.fromMe && message.status && (
                          <span className="text-xs opacity-75">
                            {message.status === 'read' ? '✓✓' : 
                             message.status === 'delivered' ? '✓✓' : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input de mensaje */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex items-center space-x-4">
                <Input
                  placeholder="Escribe un mensaje..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1"
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!messageText.trim()}
                  size="sm"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-24 h-24 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Phone className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Selecciona una conversación
              </h3>
              <p className="text-gray-600">
                Elige un chat de la lista para comenzar a conversar
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}