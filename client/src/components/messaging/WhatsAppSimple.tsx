import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, ChevronDown, LogOut, Menu, Search, Send, Settings, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface WhatsAppSimpleProps {
  accountId?: number;
}

// Componente principal
export const WhatsAppSimple = ({ accountId = 1 }: WhatsAppSimpleProps) => {
  const [activeTab, setActiveTab] = useState('chats');
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [messageText, setMessageText] = useState('');
  const [connection, setConnection] = useState('connecting');
  const [showSettings, setShowSettings] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Consulta para obtener información de la cuenta
  const { data: accountData, isLoading: isLoadingAccount } = useQuery({
    queryKey: [`/api/whatsapp-accounts/${accountId}`],
    enabled: !!accountId,
  });

  // Consulta para obtener chats
  const { data: chats = [], isLoading: isLoadingChats } = useQuery({
    queryKey: [`/api/whatsapp/${accountId}/chats`],
    refetchInterval: refreshInterval,
    enabled: !!accountId && connection === 'connected',
  });

  // Consulta para obtener contactos
  const { data: contacts = [], isLoading: isLoadingContacts } = useQuery({
    queryKey: [`/api/whatsapp/${accountId}/contacts`],
    refetchInterval: refreshInterval,
    enabled: !!accountId && connection === 'connected' && activeTab === 'contacts',
  });

  // Consulta para obtener mensajes del chat seleccionado
  const { data: messages = [], isLoading: isLoadingMessages } = useQuery({
    queryKey: [`/api/whatsapp/${accountId}/chats/${selectedChat}/messages`],
    refetchInterval: refreshInterval,
    enabled: !!selectedChat && connection === 'connected',
  });

  // Mutación para enviar mensajes
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await fetch(`/api/whatsapp/${accountId}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: selectedChat,
          message,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Error al enviar mensaje');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Refrescar mensajes después de enviar uno nuevo
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/${accountId}/chats/${selectedChat}/messages`] });
      
      // Actualizar chats para reflejar el último mensaje
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/${accountId}/chats`] });
      
      toast({
        title: "Mensaje enviado",
        description: "El mensaje se ha enviado correctamente.",
        variant: "default",
      });
    },
    onError: () => {
      toast({
        title: "Error al enviar mensaje",
        description: "No se pudo enviar el mensaje. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  // Mutación para desconectar WhatsApp
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/whatsapp/${accountId}/logout`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Error al desconectar');
      }
      
      return response.json();
    },
    onSuccess: () => {
      setConnection('disconnected');
      setSelectedChat(null);
      
      toast({
        title: "Desconectado",
        description: "Se ha desconectado de WhatsApp correctamente.",
        variant: "default",
      });
      
      // Invalidar todas las consultas relacionadas
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/${accountId}`] });
    },
    onError: () => {
      toast({
        title: "Error al desconectar",
        description: "No se pudo desconectar de WhatsApp. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  // Efecto para comprobar el estado de la conexión
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch(`/api/whatsapp/${accountId}/status`);
        const data = await response.json();
        
        setConnection(data.connected ? 'connected' : 'disconnected');
      } catch (error) {
        console.error('Error al comprobar conexión:', error);
        setConnection('error');
      }
    };
    
    checkConnection();
    const interval = setInterval(checkConnection, 10000);
    
    return () => clearInterval(interval);
  }, [accountId]);

  // Efecto para desplazarse al último mensaje
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Filtrar chats según término de búsqueda
  const filteredChats = chats.filter((chat: any) => {
    const name = chat.name || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Manejar envío de mensaje
  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedChat) return;
    
    sendMessageMutation.mutate(messageText);
    setMessageText('');
  };

  // Manejar tecla Enter para enviar mensaje
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Renderizar chat
  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Cabecera */}
      <header className="bg-green-600 text-white p-4 shadow-md">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10 bg-white text-green-600">
              <AvatarImage src={`/whatsapp-avatar-${accountId}.png`} alt="Avatar" />
              <AvatarFallback>
                {accountData?.name?.charAt(0) || 'W'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="font-semibold">{accountData?.name || 'WhatsApp'}</h1>
              <div className="flex items-center text-sm">
                <span className={`w-2 h-2 rounded-full mr-2 ${
                  connection === 'connected' ? 'bg-green-300' :
                  connection === 'connecting' ? 'bg-yellow-300' :
                  'bg-red-400'
                }`}></span>
                <span>{
                  connection === 'connected' ? 'Conectado' :
                  connection === 'connecting' ? 'Conectando...' :
                  connection === 'disconnected' ? 'Desconectado' :
                  'Error de conexión'
                }</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setShowSettings(!showSettings)}>
                    <Settings className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Configuración</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => disconnectMutation.mutate()}>
                  <LogOut className="w-4 h-4 mr-2" />
                  <span>Desconectar</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      
      {/* Contenido principal */}
      <div className="flex flex-1 overflow-hidden">
        {/* Panel lateral */}
        <div className="w-1/3 border-r border-gray-300 bg-white flex flex-col">
          {/* Buscador */}
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                className="pl-10 bg-gray-100 border-none focus-visible:ring-0"
                placeholder="Buscar chat o contacto"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  className="absolute right-3 top-1/2 transform -translate-y-1/2"
                  onClick={() => setSearchTerm('')}
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
          </div>
          
          {/* Tabs de Chats y Contactos */}
          <Tabs defaultValue="chats" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="chats">Chats</TabsTrigger>
              <TabsTrigger value="contacts">Contactos</TabsTrigger>
            </TabsList>
            
            <TabsContent value="chats" className="flex-1 p-0">
              {connection === 'connected' ? (
                <ScrollArea className="flex-1">
                  {filteredChats.length > 0 ? (
                    <div className="divide-y divide-gray-200">
                      {filteredChats.map((chat: any) => (
                        <div
                          key={chat.id}
                          className={`p-3 hover:bg-gray-100 cursor-pointer ${
                            selectedChat === chat.id ? 'bg-gray-200' : ''
                          }`}
                          onClick={() => setSelectedChat(chat.id)}
                        >
                          <div className="flex items-start space-x-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={chat.profilePicUrl} alt={chat.name} />
                              <AvatarFallback>
                                {chat.name?.charAt(0) || '?'}
                              </AvatarFallback>
                            </Avatar>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between">
                                <span className="font-medium truncate">
                                  {chat.name || chat.id.split('@')[0] || 'Chat sin nombre'}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {chat.timestamp ? format(new Date(chat.timestamp * 1000), 'HH:mm') : ''}
                                </span>
                              </div>
                              
                              <div className="flex justify-between items-center text-sm text-gray-500">
                                <p className="truncate w-36">
                                  {chat.lastMessage || 'Sin mensajes'}
                                </p>
                                {chat.unreadCount > 0 && (
                                  <Badge variant="default" className="bg-green-600 text-white">
                                    {chat.unreadCount}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      <div className="mb-2">No hay chats disponibles</div>
                      <div className="text-xs">
                        Se ha establecido conexión con WhatsApp, pero no se encontraron chats.
                      </div>
                    </div>
                  )}
                </ScrollArea>
              ) : (
                <div className="flex items-center justify-center h-full text-center p-4">
                  <div>
                    <div className="mb-4 text-gray-500">
                      {connection === 'connecting' ? (
                        <>
                          <div className="animate-spin w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                          <p>Conectando con WhatsApp...</p>
                          <p className="text-sm mt-2">Este proceso puede tardar unos segundos</p>
                        </>
                      ) : connection === 'disconnected' ? (
                        <>
                          <p>WhatsApp desconectado</p>
                          <p className="text-sm mt-2">Escanea el código QR para iniciar sesión</p>
                        </>
                      ) : (
                        <>
                          <p>Error de conexión</p>
                          <p className="text-sm mt-2">No se pudo conectar con WhatsApp</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="contacts" className="flex-1 p-0">
              <ScrollArea className="flex-1">
                {contacts.length > 0 ? (
                  <div className="divide-y divide-gray-200">
                    {contacts.map((contact: any) => (
                      <div
                        key={contact.id}
                        className="p-3 hover:bg-gray-100 cursor-pointer"
                      >
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={contact.profilePicUrl} alt={contact.name} />
                            <AvatarFallback>
                              {contact.name?.charAt(0) || contact.number?.charAt(0) || '?'}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div>
                            <div className="font-medium">
                              {contact.name || 'Sin nombre'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {contact.number || contact.id.split('@')[0] || 'Sin número'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500">
                    <p>No hay contactos disponibles</p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Panel de chat */}
        <div className="flex-1 flex flex-col">
          {selectedChat ? (
            <>
              {/* Cabecera del chat */}
              <div className="p-3 border-b border-gray-300 bg-white flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage 
                      src={filteredChats.find((c: any) => c.id === selectedChat)?.profilePicUrl} 
                      alt="Chat"
                    />
                    <AvatarFallback>
                      {filteredChats.find((c: any) => c.id === selectedChat)?.name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div>
                    <h2 className="font-medium">
                      {filteredChats.find((c: any) => c.id === selectedChat)?.name || 
                       selectedChat.split('@')[0] || 
                       'Chat'}
                    </h2>
                    <p className="text-xs text-gray-500">
                      {filteredChats.find((c: any) => c.id === selectedChat)?.isGroup ? 
                        'Grupo' : 'Contacto'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="icon">
                    <Search className="w-5 h-5" />
                  </Button>
                  
                  <Button variant="ghost" size="icon">
                    <ChevronDown className="w-5 h-5" />
                  </Button>
                </div>
              </div>
              
              {/* Área de mensajes */}
              <div className="flex-1 overflow-y-auto p-4 bg-gray-100">
                {isLoadingMessages ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                  </div>
                ) : messages.length > 0 ? (
                  <div className="space-y-3">
                    {messages.map((message: any, index: number) => (
                      <div
                        key={message.id || `msg-${index}`}
                        className={`max-w-[80%] p-3 rounded-lg ${
                          message.fromMe
                            ? 'ml-auto bg-green-100 text-gray-800'
                            : 'bg-white text-gray-800 border border-gray-200'
                        }`}
                      >
                        <div className="text-sm">{message.body}</div>
                        <div className="text-right mt-1">
                          <span className="text-xs text-gray-500">
                            {message.timestamp
                              ? format(new Date(message.timestamp * 1000), 'HH:mm')
                              : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-center text-gray-500">
                    <div>
                      <p>No hay mensajes en este chat</p>
                      <p className="text-sm mt-2">Envía un mensaje para iniciar la conversación</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Área de entrada de mensaje */}
              <div className="p-3 bg-white border-t border-gray-300">
                <div className="flex items-center">
                  <textarea
                    className="flex-1 border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                    placeholder="Escribe un mensaje..."
                    rows={2}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={handleKeyPress}
                  ></textarea>
                  <Button
                    className="ml-2 bg-green-600 hover:bg-green-700"
                    size="icon"
                    onClick={handleSendMessage}
                    disabled={!messageText.trim() || sendMessageMutation.isPending}
                  >
                    {sendMessageMutation.isPending ? (
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-50">
              <div className="text-center p-8">
                <div className="w-16 h-16 mx-auto mb-4 opacity-20">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="text-green-600">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1h-6v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-medium text-gray-700 mb-2">WhatsApp Web</h2>
                <p className="text-gray-500 mb-4">
                  Selecciona un chat para ver los mensajes
                </p>
                {connection !== 'connected' && (
                  <div className="mt-4 border-t border-gray-200 pt-4">
                    <p className="text-yellow-600 font-medium mb-2">
                      {connection === 'connecting' ? 'Conectando...' : 
                       connection === 'disconnected' ? 'Desconectado' : 
                       'Error de conexión'}
                    </p>
                    <p className="text-gray-500 text-sm">
                      {connection === 'connecting' ? 'Estableciendo conexión con WhatsApp' : 
                       connection === 'disconnected' ? 'Escanea el código QR para iniciar sesión' : 
                       'Revisa tu conexión y vuelve a intentarlo'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Panel de configuración */}
      <Sheet open={showSettings} onOpenChange={setShowSettings}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Configuración</SheetTitle>
          </SheetHeader>
          <div className="py-4 space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Intervalo de actualización</h3>
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  min={1000}
                  step={1000}
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
                  className="w-24"
                />
                <span className="text-sm text-gray-500">ms</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Tiempo entre actualizaciones (en milisegundos)
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};