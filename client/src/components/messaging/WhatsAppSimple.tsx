import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
// import { ConnectionStatus } from './ConnectionStatus';
import MessagesLoader from './MessagesLoader';
import { Send, MessageSquare, Users, Phone, Clock } from 'lucide-react';

interface WhatsAppChat {
  id: string;
  name: string;
  isGroup: boolean;
  timestamp: number;
  unreadCount: number;
  lastMessage: string;
}

interface WhatsAppMessage {
  id: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  hasMedia: boolean;
}

interface WhatsAppSimpleProps {
  currentAccountId: number;
}

export function WhatsAppSimple({ currentAccountId }: WhatsAppSimpleProps) {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [chatFilter, setChatFilter] = useState('');
  const [activeTab, setActiveTab] = useState('chats');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estados para manejo de datos
  const [realChats, setRealChats] = useState<WhatsAppChat[]>([]);
  const [realMessages, setRealMessages] = useState<WhatsAppMessage[]>([]);

  // Cargar chats reales desde el servidor
  const { data: whatsappChats = [], isLoading: isLoadingChats, refetch: refetchChats } = useQuery({
    queryKey: ['direct-whatsapp-chats', currentAccountId],
    queryFn: async () => {
      const response = await fetch('/api/direct/whatsapp/chats');
      const data = await response.json();
      
      // Solo retornar chats válidos (sin datos demo)
      const validChats = Array.isArray(data) 
        ? data.filter(chat => chat && chat.id && !chat.id.startsWith('demo-'))
        : [];
      
      return validChats;
    },
    refetchInterval: 10000, // Refrescar cada 10 segundos
    staleTime: 5000
  });

  // Obtener estado de conexión
  const { data: connectionStatus } = useQuery({
    queryKey: ['whatsapp-status', currentAccountId],
    queryFn: async () => {
      const response = await fetch('/api/direct/whatsapp/status');
      return response.json();
    },
    refetchInterval: 5000
  });

  // Selección automática del primer chat real
  useEffect(() => {
    if (whatsappChats.length > 0 && !selectedChatId) {
      const firstRealChat = whatsappChats[0];
      if (firstRealChat && !firstRealChat.id.startsWith('demo-')) {
        setSelectedChatId(firstRealChat.id);
        console.log(`✅ Chat real seleccionado automáticamente: ${firstRealChat.name}`);
      }
    }
  }, [whatsappChats, selectedChatId]);

  // Filtrar chats por búsqueda
  const filteredChats = whatsappChats.filter(chat =>
    chat.name?.toLowerCase().includes(chatFilter.toLowerCase()) ||
    chat.id.toLowerCase().includes(chatFilter.toLowerCase())
  );

  // Manejar selección de chat
  const handleChatSelect = (chat: WhatsAppChat) => {
    // Rechazar chats demo
    if (chat.id.startsWith('demo-')) {
      return;
    }
    
    setSelectedChatId(chat.id);
  };

  // Enviar mensaje
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChatId) return;

    try {
      const response = await fetch('/api/direct/whatsapp/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: selectedChatId,
          message: newMessage.trim()
        })
      });

      if (response.ok) {
        setNewMessage('');
        toast({ title: 'Mensaje enviado', description: 'El mensaje se envió correctamente' });
        
        // Refrescar mensajes después de enviar
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['whatsapp-messages', selectedChatId] });
        }, 1000);
      } else {
        throw new Error('Error al enviar mensaje');
      }
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      toast({
        title: 'Error',
        description: 'No se pudo enviar el mensaje',
        variant: 'destructive'
      });
    }
  };

  // Scroll al final de mensajes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [realMessages]);

  return (
    <div className="flex h-full bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Panel izquierdo - Lista de chats */}
      <div className="w-1/3 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold mb-3">WhatsApp</h3>
          
          {/* Estado de conexión */}
          <div className={`text-xs px-2 py-1 rounded ${
            connectionStatus?.authenticated 
              ? 'bg-green-100 text-green-700' 
              : 'bg-red-100 text-red-700'
          }`}>
            {connectionStatus?.authenticated ? '🟢 Conectado' : '🔴 Desconectado'}
          </div>
          
          {/* Filtro de búsqueda */}
          <div className="mt-3">
            <Input
              placeholder="Buscar chats..."
              value={chatFilter}
              onChange={(e) => setChatFilter(e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        {/* Tabs para chats/contactos */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2 mx-4 mt-2">
            <TabsTrigger value="chats">Chats</TabsTrigger>
            <TabsTrigger value="contacts">Contactos</TabsTrigger>
          </TabsList>

          <TabsContent value="chats" className="flex-1 mt-2">
            <ScrollArea className="h-full">
              {isLoadingChats ? (
                <div className="flex justify-center p-4">
                  <Spinner size="sm" />
                </div>
              ) : filteredChats.length === 0 ? (
                <div className="text-center p-4 text-gray-500">
                  {whatsappChats.length === 0 ? (
                    <div>
                      <MessageSquare className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                      <p>No hay chats disponibles</p>
                      <p className="text-xs mt-1">Conecta WhatsApp para ver tus chats</p>
                    </div>
                  ) : (
                    <p>No se encontraron chats</p>
                  )}
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {filteredChats.map((chat) => (
                    <div
                      key={chat.id}
                      onClick={() => handleChatSelect(chat)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 ${
                        selectedChatId === chat.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {chat.isGroup ? <Users className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium truncate">{chat.name}</p>
                            <div className="flex items-center space-x-1">
                              {chat.unreadCount > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {chat.unreadCount}
                                </Badge>
                              )}
                              <Clock className="h-3 w-3 text-gray-400" />
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-1">{chat.lastMessage}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="contacts" className="flex-1 mt-2">
            <div className="text-center p-4 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>Contactos no disponibles</p>
              <p className="text-xs mt-1">Función en desarrollo</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Panel derecho - Chat activo */}
      <div className="flex-1 flex flex-col">
        {selectedChatId ? (
          <>
            {/* Header del chat */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center space-x-3">
                <Avatar>
                  <AvatarFallback>
                    {filteredChats.find(c => c.id === selectedChatId)?.isGroup ? 
                      <Users className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="font-medium">
                    {filteredChats.find(c => c.id === selectedChatId)?.name || 'Chat'}
                  </h4>
                  <p className="text-xs text-gray-500">
                    {connectionStatus?.authenticated ? 'En línea' : 'Desconectado'}
                  </p>
                </div>
              </div>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-hidden">
              <MessagesLoader
                chatId={selectedChatId}
                onMessagesLoaded={setRealMessages}
              />
            </div>

            {/* Input de mensaje */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex space-x-2">
                <Input
                  placeholder="Escribe un mensaje..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1"
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || !connectionStatus?.authenticated}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">Selecciona un chat</h3>
              <p className="text-sm">Elige una conversación para comenzar a chatear</p>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

export default WhatsAppSimple;