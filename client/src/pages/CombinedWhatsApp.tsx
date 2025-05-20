import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { WhatsAppQRCode } from '@/components/messaging/WhatsAppQRCode';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { getInitials } from '@/lib/utils';
import { format } from 'date-fns';
import { Search, Send, Brain, RefreshCw } from 'lucide-react';

// Interfaces
interface WhatsAppChat {
  id: string;
  name: string;
  isGroup: boolean;
  timestamp: number;
  unreadCount: number;
  lastMessage?: string;
  profilePicUrl?: string;
  accountId?: number;
  accountName?: string;
}

interface WhatsAppMessage {
  id: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  hasMedia: boolean;
}

export default function CombinedWhatsApp() {
  const { toast } = useToast();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [currentAccountId, setCurrentAccountId] = useState<number>(1);
  const [isViewingAllAccounts, setIsViewingAllAccounts] = useState(false);
  const [combinedChats, setCombinedChats] = useState<WhatsAppChat[]>([]);
  const [chatFilter, setChatFilter] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [messagesState, setMessagesState] = useState<WhatsAppMessage[]>([]);
  const chatContainerRef = React.useRef<HTMLDivElement>(null);

  // Query para obtener todas las cuentas
  const {
    data: whatsappAccounts,
    isLoading: isLoadingAccounts
  } = useQuery({
    queryKey: ['/api/whatsapp-accounts'],
    queryFn: async () => {
      try {
        const { apiRequest } = await import('@/lib/queryClient');
        const response = await apiRequest('/api/whatsapp-accounts');
        return response || [];
      } catch (error) {
        console.error('Error obteniendo cuentas de WhatsApp:', error);
        return [];
      }
    },
    refetchInterval: 10000
  });

  // Query para obtener status de WhatsApp
  const {
    data: whatsappStatus
  } = useQuery({
    queryKey: ['/api/direct/whatsapp/status'],
    queryFn: async () => {
      try {
        const { apiRequest } = await import('@/lib/queryClient');
        const response = await apiRequest('/api/direct/whatsapp/status');
        return response;
      } catch (error) {
        console.error('Error obteniendo estado de WhatsApp:', error);
        return { authenticated: false, status: 'disconnected' };
      }
    },
    refetchInterval: 5000
  });

  // Query para obtener chats (según modo seleccionado)
  const {
    data: whatsappChats,
    isLoading: isLoadingChats,
    refetch: refetchChats
  } = useQuery({
    queryKey: ['/api/whatsapp-accounts', currentAccountId, 'chats'],
    queryFn: async () => {
      try {
        // Cache primero
        const cachedData = localStorage.getItem(`whatsapp_chats_${currentAccountId}`);
        const initialData = cachedData ? JSON.parse(cachedData) : [];
        
        const { apiRequest } = await import('@/lib/queryClient');
        try {
          // Intentar API específica de cuenta
          const response = await apiRequest(`/api/whatsapp-accounts/${currentAccountId}/chats`);
          
          if (Array.isArray(response) && response.length > 0) {
            console.log(`${response.length} chats obtenidos para cuenta ${currentAccountId}`);
            localStorage.setItem(`whatsapp_chats_${currentAccountId}`, JSON.stringify(response));
            return response;
          }
        } catch (apiError) {
          console.error(`Error en API específica de cuenta ${currentAccountId}:`, apiError);
        }
        
        // Intentar endpoint directo
        try {
          const fallbackResponse = await apiRequest('/api/direct/whatsapp/chats');
          
          if (Array.isArray(fallbackResponse) && fallbackResponse.length > 0) {
            console.log(`Usando fallback: ${fallbackResponse.length} chats obtenidos`);
            localStorage.setItem(`whatsapp_chats_${currentAccountId}`, JSON.stringify(fallbackResponse));
            return fallbackResponse;
          }
        } catch (fallbackError) {
          console.error('Error en fallback de chats:', fallbackError);
        }
        
        // Si todo falla, usar cache o array vacío
        return initialData.length > 0 ? initialData : [];
      } catch (error) {
        console.error(`Error obteniendo chats:`, error);
        return [];
      }
    },
    enabled: !!whatsappStatus?.authenticated && !isViewingAllAccounts && !!currentAccountId
  });

  // Cargar chats combinados de todas las cuentas
  const loadAllAccountChats = async () => {
    try {
      // Mostrar indicador de carga
      toast({
        title: "Cargando todas las cuentas",
        description: "Preparando vista de todas las cuentas conectadas...",
        variant: "default"
      });
      
      // Importar apiRequest
      const { apiRequest } = await import('@/lib/queryClient');
      
      // Cargar todas las cuentas
      const accounts = await apiRequest('/api/whatsapp-accounts');
      
      if (Array.isArray(accounts) && accounts.length > 0) {
        // Filtrar solo cuentas autenticadas
        const authenticatedAccounts = accounts.filter(
          acc => acc.currentStatus?.authenticated
        );
        
        // Crear array para almacenar todos los chats combinados
        let allChats: WhatsAppChat[] = [];
        
        // Para cada cuenta autenticada, cargar sus chats
        for (const acc of authenticatedAccounts) {
          try {
            const accountChats = await apiRequest(`/api/whatsapp-accounts/${acc.id}/chats`);
            
            if (Array.isArray(accountChats) && accountChats.length > 0) {
              // Añadir identificador de cuenta a cada chat
              const chatWithAccountInfo = accountChats.map(chat => ({
                ...chat,
                accountId: acc.id,
                accountName: acc.name
              }));
              
              // Añadir a la lista combinada
              allChats = [...allChats, ...chatWithAccountInfo];
            }
          } catch (error) {
            console.error(`Error cargando chats de cuenta ${acc.id}:`, error);
          }
        }
        
        // Ordenar por cuenta (ID secuencial)
        allChats.sort((a, b) => {
          // Primero por ID de cuenta
          const aAccountId = a.accountId || 0;
          const bAccountId = b.accountId || 0;
          
          if (aAccountId !== bAccountId) {
            return aAccountId - bAccountId;
          }
          // Luego por nombre de chat
          return a.name.localeCompare(b.name);
        });
        
        // Guardar todos los chats combinados
        setCombinedChats(allChats);
        
        // Notificar completado
        toast({
          title: `Todas las cuentas cargadas`,
          description: `Se cargaron ${allChats.length} chats de ${authenticatedAccounts.length} cuentas`,
          variant: "default"
        });
      }
    } catch (error) {
      console.error("Error cargando todas las cuentas:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar todas las cuentas",
        variant: "destructive"
      });
    }
  };

  // Filtrar chats según el texto de búsqueda
  const filteredChats = React.useMemo(() => {
    // Determinar qué lista de chats usar
    const chatsToFilter = isViewingAllAccounts ? combinedChats : whatsappChats || [];
    
    if (!Array.isArray(chatsToFilter)) return [];
    
    if (!chatFilter) return chatsToFilter;
    
    const lowerFilter = chatFilter.toLowerCase();
    return chatsToFilter.filter(chat => {
      const name = (chat.name || '').toLowerCase();
      const lastMessage = (chat.lastMessage || '').toLowerCase();
      return name.includes(lowerFilter) || lastMessage.includes(lowerFilter);
    });
  }, [whatsappChats, chatFilter, isViewingAllAccounts, combinedChats]);

  // Obtener el chat actual
  const currentChat = React.useMemo(() => {
    if (!selectedChatId) return null;
    
    // Si estamos en modo "todas las cuentas", buscar en la lista combinada
    if (isViewingAllAccounts && Array.isArray(combinedChats)) {
      return combinedChats.find(chat => chat.id === selectedChatId);
    }
    
    // De lo contrario, buscar en los chats de la cuenta actual
    return whatsappChats?.find((chat: WhatsAppChat) => chat.id === selectedChatId) || null;
  }, [selectedChatId, whatsappChats, isViewingAllAccounts, combinedChats]);

  // Cargar mensajes cuando cambia el chat seleccionado
  useEffect(() => {
    if (selectedChatId) {
      const refetchMessages = async () => {
        try {
          const { apiRequest } = await import('@/lib/queryClient');
          const messages = await apiRequest(`/api/direct/whatsapp/messages/${selectedChatId}`);
          
          if (Array.isArray(messages)) {
            setMessagesState(messages);
          }
        } catch (error) {
          console.error('Error cargando mensajes:', error);
        }
      };
      
      refetchMessages();
    }
  }, [selectedChatId]);

  // Manejar envío de mensajes
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChatId) return;
    
    try {
      // Crear mensaje temporal optimista
      const tempMessage: WhatsAppMessage = {
        id: `temp_${Date.now()}`,
        body: newMessage,
        fromMe: true,
        timestamp: Date.now() / 1000,
        hasMedia: false
      };
      
      // Actualizar UI optimistamente
      setMessagesState(prev => [...prev, tempMessage]);
      
      // Enviar mensaje
      const { apiRequest } = await import('@/lib/queryClient');
      await apiRequest('/api/direct/whatsapp/send', {
        method: 'POST',
        body: JSON.stringify({
          chatId: selectedChatId,
          message: newMessage
        })
      });
      
      // Limpiar campo de mensaje
      setNewMessage('');
      
      // Recargar mensajes después de un breve retraso
      setTimeout(() => {
        if (selectedChatId) {
          const refetchMessages = async () => {
            try {
              const messages = await apiRequest(`/api/direct/whatsapp/messages/${selectedChatId}`);
              if (Array.isArray(messages)) {
                setMessagesState(messages);
              }
            } catch (error) {
              console.error('Error recargando mensajes:', error);
            }
          };
          
          refetchMessages();
        }
      }, 1000);
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      toast({
        title: 'Error al enviar mensaje',
        description: 'No se pudo enviar el mensaje. Intente nuevamente.',
        variant: 'destructive'
      });
    }
  };

  // Manejar scroll automático cuando llegan nuevos mensajes
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messagesState]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">WhatsApp Multi-Cuenta</h1>
      
      <div className="bg-white rounded-lg shadow-md h-[calc(100vh-14rem)] max-h-[800px] overflow-hidden">
        <div className="grid grid-cols-12 h-full">
          {/* Panel izquierdo - Selector de cuentas y chats */}
          <div className="col-span-12 md:col-span-4 flex flex-col border-r h-full overflow-hidden">
            <Tabs defaultValue="chats" className="flex flex-col h-full overflow-hidden">
              <div className="border-b p-2">
                {/* Selector de cuentas WhatsApp */}
                <div className="mb-2">
                  <select 
                    className="w-full rounded-md border border-gray-300 py-1 px-2 text-sm font-medium"
                    value={isViewingAllAccounts ? "all" : currentAccountId.toString()}
                    onChange={(e) => {
                      const value = e.target.value;
                      
                      // Si seleccionó "todas las cuentas"
                      if (value === "all") {
                        setIsViewingAllAccounts(true);
                        loadAllAccountChats();
                        return;
                      }
                      
                      // Si es una cuenta individual
                      setIsViewingAllAccounts(false);
                      setCombinedChats([]);
                      
                      const newAccountId = Number(value);
                      const accountName = whatsappAccounts?.find(acc => acc.id === newAccountId)?.name || 'seleccionada';
                      
                      // Mostrar indicador de carga
                      toast({
                        title: "Cambiando cuenta",
                        description: `Preparando cuenta ${accountName}...`,
                        variant: "default"
                      });
                      
                      // Actualizar la cuenta seleccionada
                      setCurrentAccountId(newAccountId);
                      setSelectedChatId(null);
                      refetchChats();
                    }}
                    disabled={isLoadingAccounts || !Array.isArray(whatsappAccounts) || whatsappAccounts.length === 0}
                  >
                    {isLoadingAccounts ? (
                      <option>Cargando cuentas...</option>
                    ) : !whatsappAccounts || whatsappAccounts.length === 0 ? (
                      <option>No hay cuentas disponibles</option>
                    ) : (
                      <>
                        <option value="all">🔄 Todas las cuentas conectadas</option>
                        {whatsappAccounts.map(account => (
                          <option key={account.id} value={account.id}>
                            ID {account.id} - {account.name} {account.currentStatus?.authenticated ? '✓' : ''}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>

                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar chat..."
                    className="pl-8 h-9"
                    value={chatFilter}
                    onChange={(e) => setChatFilter(e.target.value)}
                  />
                </div>
                
                <TabsList className="w-full">
                  <TabsTrigger value="chats" className="flex-1">Chats</TabsTrigger>
                  <TabsTrigger value="contacts" className="flex-1">Contactos</TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="chats" className="flex-1 overflow-hidden">
                <ScrollArea className="h-[calc(100vh-180px)]">
                  {isLoadingChats && !isViewingAllAccounts ? (
                    <div className="flex justify-center p-4">
                      <Spinner />
                    </div>
                  ) : (!whatsappStatus?.authenticated && currentAccountId !== 2 && !isViewingAllAccounts) ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 bg-gray-50 rounded-lg">
                      <div className="text-center mb-6">
                        <h3 className="text-xl font-semibold text-gray-800 mb-2">WhatsApp no conectado</h3>
                        <p className="text-gray-600 mb-4">Para ver tus chats y mensajes, necesitas conectar WhatsApp escaneando el código QR.</p>
                      </div>
                      
                      <div className="mt-4">
                        <div className="flex items-center justify-center">
                          <WhatsAppQRCode accountId={currentAccountId} />
                        </div>
                      </div>
                      
                      <div className="mt-4 text-center text-sm text-gray-500">
                        <p>También puedes ir a la página de cuentas para administrar múltiples conexiones de WhatsApp.</p>
                      </div>
                    </div>
                  ) : ((isViewingAllAccounts && combinedChats.length > 0) || whatsappChats) ? (
                    <div className="divide-y">
                      {/* Contador de chats disponibles */}
                      <div className="p-3 text-sm text-gray-500">
                        Chats disponibles: {isViewingAllAccounts ? combinedChats.length : (whatsappChats?.length || 0)}
                      </div>
                      
                      {/* Lista de chats filtrados */}
                      {filteredChats.map((chat) => (
                        <div
                          key={chat.id}
                          className={`p-3 hover:bg-gray-50 cursor-pointer ${
                            selectedChatId === chat.id ? 'bg-green-50 border-l-4 border-l-green-500' : ''
                          }`}
                          onClick={() => {
                            console.log('Seleccionando chat:', chat.name, chat.id);
                            
                            // Actualizar chat seleccionado
                            setSelectedChatId(chat.id);
                            
                            // Cargar mensajes desde la API
                            fetch(`/api/direct/whatsapp/messages/${chat.id}`)
                              .then(res => res.json())
                              .then(data => {
                                if (Array.isArray(data) && data.length > 0) {
                                  console.log(`✅ Cargados ${data.length} mensajes para chat ${chat.id}`);
                                  setMessagesState(data);
                                } else {
                                  console.log('No hay mensajes disponibles');
                                  setMessagesState([{
                                    id: `system_${Date.now()}`,
                                    body: "No hay mensajes disponibles para este chat.",
                                    fromMe: false,
                                    timestamp: Date.now() / 1000,
                                    hasMedia: false
                                  }]);
                                }
                              })
                              .catch(err => {
                                console.error('Error cargando mensajes:', err);
                                setMessagesState([{
                                  id: `error_${Date.now()}`,
                                  body: "Error al cargar mensajes. Intente nuevamente.",
                                  fromMe: false,
                                  timestamp: Date.now() / 1000,
                                  hasMedia: false
                                }]);
                              });
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-11 w-11 flex-shrink-0 border shadow-sm">
                              {chat.profilePicUrl ? (
                                <AvatarImage src={chat.profilePicUrl} alt={chat.name} />
                              ) : null}
                              <AvatarFallback className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                                {getInitials(chat.name)}
                              </AvatarFallback>
                            </Avatar>
                            
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <div className="flex items-center gap-1">
                                <span className="font-medium truncate">{chat.name}</span>
                                
                                {/* Mostrar el identificador de cuenta cuando estamos en modo "Todas las cuentas" */}
                                {isViewingAllAccounts && chat.accountId && (
                                  <Badge variant="outline" className="text-[10px] h-4 px-1 bg-blue-100 text-blue-800 border-blue-200 font-medium">
                                    ID {chat.accountId}
                                  </Badge>
                                )}
                                
                                {/* Tipo de chat */}
                                {chat.id.includes('@g.us') && (
                                  <Badge variant="outline" className="text-[10px] h-4 px-1 bg-blue-50 text-blue-700 border-blue-200">
                                    Grupo
                                  </Badge>
                                )}
                                {!chat.id.includes('@g.us') && (
                                  <Badge variant="outline" className="text-[10px] h-4 px-1 bg-green-50 text-green-700 border-green-200">
                                    Chat
                                  </Badge>
                                )}
                                
                                {/* Contador de mensajes no leídos */}
                                {chat.unreadCount > 0 && (
                                  <span className="inline-flex items-center justify-center ml-1 bg-green-500 text-white text-[11px] w-5 h-5 rounded-full">
                                    {chat.unreadCount}
                                  </span>
                                )}
                              </div>
                              
                              <div className="flex justify-between items-center text-sm text-gray-500">
                                <p className="truncate w-36">
                                  {chat.lastMessage || 'Sin mensajes'}
                                </p>
                                <span className="text-xs whitespace-nowrap">
                                  {chat.timestamp ? format(new Date(chat.timestamp * 1000), 'HH:mm') : ''}
                                </span>
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
              </TabsContent>
              
              <TabsContent value="contacts" className="flex-1 overflow-hidden">
                <div className="p-4 text-center text-gray-500">
                  <div className="mb-2">Lista de contactos</div>
                  <div className="text-xs">
                    Próximamente: funcionalidad para gestionar contactos
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          
          {/* Panel derecho - Mensajes */}
          <div className="col-span-12 md:col-span-8 flex flex-col h-full overflow-hidden">
            {selectedChatId && currentChat && whatsappStatus?.authenticated ? (
              <>
                {/* Encabezado del chat */}
                <div className="border-b p-3 flex items-center gap-3">
                  <Avatar className="h-10 w-10 border shadow-sm">
                    {currentChat.profilePicUrl ? (
                      <AvatarImage src={currentChat.profilePicUrl} alt={currentChat.name} />
                    ) : null}
                    <AvatarFallback className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                      {getInitials(currentChat.name)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <h3 className="font-medium">{currentChat.name}</h3>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      {currentChat.id.includes('@g.us') ? 'Grupo' : 'Chat individual'}
                      <span className="inline-block h-1 w-1 rounded-full bg-gray-300 mx-1"></span>
                      {whatsappStatus?.authenticated ? 'Conectado' : 'Desconectado'}
                      
                      {/* Mostrar ID de cuenta en modo "Todas las cuentas" */}
                      {isViewingAllAccounts && currentChat.accountId && (
                        <>
                          <span className="inline-block h-1 w-1 rounded-full bg-gray-300 mx-1"></span>
                          <Badge variant="outline" className="text-[10px] h-5 px-1 bg-blue-100 text-blue-800 border-blue-200">
                            Cuenta ID {currentChat.accountId}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={() => {
                        if (selectedChatId) {
                          const refetchMessages = async () => {
                            try {
                              const { apiRequest } = await import('@/lib/queryClient');
                              const messages = await apiRequest(`/api/direct/whatsapp/messages/${selectedChatId}`);
                              
                              if (Array.isArray(messages)) {
                                setMessagesState(messages);
                              }
                            } catch (error) {
                              console.error('Error cargando mensajes:', error);
                            }
                          };
                          
                          refetchMessages();
                        }
                      }}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Área de mensajes */}
                <div 
                  className="flex-1 overflow-y-auto p-3 bg-gray-50 messages-container" 
                  ref={chatContainerRef}
                >
                  {messagesState.length > 0 ? (
                    <div className="space-y-1">
                      {messagesState.map((msg: WhatsAppMessage, index: number) => {
                        // Verificar si es una secuencia de mensajes del mismo remitente
                        const isSequential = index > 0 && 
                          msg.fromMe === messagesState[index - 1].fromMe;
                        
                        return (
                          <div 
                            key={msg.id || `temp-${Date.now()}-${index}`}
                            className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'} ${isSequential ? 'mt-1' : 'mt-3'} w-full`}
                          >
                            <div 
                              className={`max-w-[95%] w-fit rounded-lg p-3 ${
                                msg.fromMe 
                                  ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md ml-auto' 
                                  : 'bg-white border shadow-sm mr-auto'
                              } ${isSequential && msg.fromMe ? 'rounded-tr-sm' : ''} ${isSequential && !msg.fromMe ? 'rounded-tl-sm' : ''}`}
                            >
                              <div className="whitespace-pre-wrap break-words">
                                {msg.body}
                              </div>
                              
                              <div className={`text-xs mt-1 text-right ${msg.fromMe ? 'text-white text-opacity-70' : 'text-gray-500'}`}>
                                {format(new Date(typeof msg.timestamp === 'number' ? 
                                  (msg.timestamp > 9999999999 ? msg.timestamp : msg.timestamp * 1000) : 
                                  Date.now()), 'HH:mm')}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-gray-500">
                        <p>No hay mensajes para mostrar</p>
                        <p className="text-sm mt-1">Selecciona un chat para ver la conversación</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Área de entrada de mensajes */}
                <div className="p-2 border-t bg-white">
                  <div className="flex items-center gap-2">
                    <Input
                      className="flex-1"
                      placeholder="Escribe un mensaje..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim()}
                    >
                      <Send className="h-5 w-5 text-green-600" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full bg-gray-50">
                <div className="text-center p-4">
                  <h3 className="text-lg font-medium text-gray-800 mb-1">WhatsApp Web</h3>
                  <p className="text-gray-500 mb-4">
                    Selecciona un chat para ver los mensajes o conecta una cuenta de WhatsApp.
                  </p>
                  <div className="mt-2 text-sm text-gray-500">
                    {whatsappStatus?.authenticated ? 
                      'Conectado a WhatsApp Web 🟢' : 
                      'Escanea el código QR para conectar WhatsApp 🔴'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}