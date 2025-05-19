import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Send, Paperclip, User, Phone, Bot, X, Check, MessageSquare, Settings, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

// Modelo para mensaje de WhatsApp
interface WhatsAppMessage {
  id: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  hasMedia: boolean;
  mediaUrl?: string;
  caption?: string;
}

// Modelo para chat de WhatsApp
interface WhatsAppChat {
  id: string;
  name: string;
  isGroup: boolean;
  timestamp: number;
  unreadCount: number;
  lastMessage?: string;
  profilePicUrl?: string;
  accountId?: number;
}

// Modelo para estado de cuenta WhatsApp
interface WhatsAppAccountStatus {
  id: number;
  name: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING';
  qrCode?: string;
}

// Propiedades del componente
interface WhatsAppInterfaceProps {
  selectedLeadId?: number;
  onSelectLead?: (leadId: number) => void;
  initialChatId?: string | null;
  initialAccountId?: number | null;
}

export function SimplifiedWhatsApp({ 
  selectedLeadId, 
  onSelectLead,
  initialChatId,
  initialAccountId
}: WhatsAppInterfaceProps) {
  // Estados para la funcionalidad de chat
  const [selectedChat, setSelectedChat] = useState<WhatsAppChat | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<number | null>(initialAccountId || null);
  const [message, setMessage] = useState('');
  const [whatsappMessages, setWhatsappMessages] = useState<WhatsAppMessage[]>([]);
  const [whatsappChats, setWhatsappChats] = useState<WhatsAppChat[]>([]);
  const [showQrCode, setShowQrCode] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [accountsStatus, setAccountsStatus] = useState<WhatsAppAccountStatus[]>([]);
  const [chatFilter, setChatFilter] = useState('');
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Consulta para obtener las cuentas de WhatsApp
  const { data: whatsappAccounts = [] } = useQuery({
    queryKey: ['/api/whatsapp-accounts'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/whatsapp-accounts');
        if (!response.ok) throw new Error("Error al obtener cuentas de WhatsApp");
        const data = await response.json();
        return data;
      } catch (error) {
        console.error("Error obteniendo cuentas WhatsApp:", error);
        return [];
      }
    }
  });

  // Consulta para obtener el estado de las cuentas
  const { data: statusData, refetch: refetchStatus } = useQuery({
    queryKey: ['/api/direct/whatsapp/status'],
    queryFn: async () => {
      try {
        // Si tenemos una cuenta seleccionada, obtener solo su estado
        if (selectedAccount) {
          const response = await fetch(`/api/direct/whatsapp/status?accountId=${selectedAccount}`);
          if (!response.ok) throw new Error("Error al obtener estado de WhatsApp");
          const data = await response.json();
          return Array.isArray(data) ? data : [data];
        } else {
          const response = await fetch('/api/direct/whatsapp/status');
          if (!response.ok) throw new Error("Error al obtener estado de WhatsApp");
          const data = await response.json();
          return Array.isArray(data) ? data : [data];
        }
      } catch (error) {
        console.error("Error obteniendo estado WhatsApp:", error);
        return [];
      }
    },
    refetchInterval: 5000
  });

  // Actualizar el estado de las cuentas cuando cambia el resultado de la consulta
  useEffect(() => {
    if (statusData) {
      setAccountsStatus(Array.isArray(statusData) ? statusData : [statusData]);
      
      // Si hay un código QR disponible
      const accountWithQr = Array.isArray(statusData) 
        ? statusData.find(acc => acc.qrCode && acc.status === 'CONNECTING')
        : statusData.qrCode && statusData.status === 'CONNECTING' ? statusData : null;
      
      if (accountWithQr) {
        setQrCodeData(accountWithQr.qrCode || null);
        setShowQrCode(true);
      }
    }
  }, [statusData]);

  // Seleccionar la primera cuenta disponible si no hay una seleccionada
  useEffect(() => {
    if (!selectedAccount && whatsappAccounts.length > 0) {
      const firstAccount = whatsappAccounts[0];
      setSelectedAccount(firstAccount.id);
    }
  }, [whatsappAccounts, selectedAccount]);

  // Cargar chats cuando cambia la cuenta seleccionada
  useEffect(() => {
    if (selectedAccount) {
      loadChats();
    }
  }, [selectedAccount]);

  // Seleccionar chat inicial si existe
  useEffect(() => {
    if (initialChatId && whatsappChats.length > 0) {
      const chat = whatsappChats.find(c => c.id === initialChatId);
      if (chat) {
        setSelectedChat(chat);
        loadMessages(chat.id);
      }
    }
  }, [initialChatId, whatsappChats]);

  // Función para cargar chats
  const loadChats = async () => {
    if (!selectedAccount) return;
    
    setIsLoadingChats(true);
    try {
      const response = await fetch(`/api/direct/whatsapp/chats?accountId=${selectedAccount}`);
      if (!response.ok) throw new Error('Error al cargar chats');
      
      const chats = await response.json();
      setWhatsappChats(chats);
      
      // Si no hay chat seleccionado o el chat seleccionado no está en la lista nueva,
      // seleccionar el primer chat si existe
      if ((!selectedChat || !chats.find(c => c.id === selectedChat.id)) && chats.length > 0) {
        setSelectedChat(chats[0]);
        loadMessages(chats[0].id);
      }
    } catch (error) {
      console.error('Error cargando chats:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los chats',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingChats(false);
    }
  };

  // Función para cargar mensajes de un chat
  const loadMessages = async (chatId: string) => {
    if (!selectedAccount) return;
    
    setIsLoadingMessages(true);
    try {
      const response = await fetch(`/api/direct/whatsapp/messages?chatId=${chatId}&accountId=${selectedAccount}`);
      if (!response.ok) throw new Error('Error al cargar mensajes');
      
      const messages = await response.json();
      setWhatsappMessages(messages);
      
      // Desplazamiento al último mensaje
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      console.error('Error cargando mensajes:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los mensajes',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Función para enviar un mensaje
  const sendMessage = async () => {
    if (!message.trim() || !selectedChat || !selectedAccount) return;
    
    try {
      const response = await fetch('/api/direct/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chatId: selectedChat.id,
          message: message.trim(),
          accountId: selectedAccount
        })
      });
      
      if (!response.ok) throw new Error('Error al enviar mensaje');
      
      setMessage('');
      
      // Recargar mensajes después de enviar
      setTimeout(() => {
        loadMessages(selectedChat.id);
      }, 1000);
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      toast({
        title: 'Error',
        description: 'No se pudo enviar el mensaje',
        variant: 'destructive'
      });
    }
  };

  // Función para manejar selección de chat
  const handleChatSelect = (chat: WhatsAppChat) => {
    if (selectedChat?.id === chat.id) return;
    
    setSelectedChat(chat);
    loadMessages(chat.id);
  };

  // Función para manejar cambio de cuenta
  const handleAccountChange = (accountId: number) => {
    if (selectedAccount === accountId) return;
    
    setSelectedAccount(accountId);
    setSelectedChat(null);
    setWhatsappMessages([]);
  };

  // Función para formatear la fecha
  const formatMessageTime = (timestamp: number) => {
    try {
      return new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Filtrar chats según el término de búsqueda
  const filteredChats = chatFilter
    ? whatsappChats.filter(chat => 
        chat.name.toLowerCase().includes(chatFilter.toLowerCase()) || 
        (chat.lastMessage && chat.lastMessage.toLowerCase().includes(chatFilter.toLowerCase()))
      )
    : whatsappChats;

  // Función para actualizar WebSocket
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('Conexión WebSocket establecida');
    };

    socket.onmessage = (event) => {
      try {
        const notification = JSON.parse(event.data);
        console.log('Notificación recibida:', notification);
        
        // Si es nuevo mensaje y corresponde al chat seleccionado
        if (notification.type === 'NEW_MESSAGE' && 
            selectedChat && 
            notification.data.chatId === selectedChat.id &&
            notification.data.accountId === selectedAccount) {
          // Recargar mensajes
          loadMessages(selectedChat.id);
        }
        
        // Actualizar lista de chats si hay cambios
        if (notification.type === 'NEW_MESSAGE' || 
            notification.type === 'CHAT_UPDATE') {
          loadChats();
        }
        
        // Actualizar estado de conexión si cambia
        if (notification.type === 'CONNECTION_STATUS') {
          refetchStatus();
        }
        
        // Si se recibe un código QR
        if (notification.type === 'QR_CODE' && 
            notification.data.accountId === selectedAccount) {
          setQrCodeData(notification.data.qrCode);
          setShowQrCode(true);
        }
      } catch (error) {
        console.error('Error procesando evento WebSocket:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('Error en WebSocket:', error);
    };

    // Limpieza al desmontar
    return () => {
      socket.close();
    };
  }, [selectedChat, selectedAccount]);

  // Manejar tecla Enter para enviar mensaje
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Obtener el estado de la cuenta seleccionada
  const selectedAccountStatus = selectedAccount
    ? accountsStatus.find(account => account.id === selectedAccount)
    : null;

  // Verificar si hay alguna cuenta conectada
  const hasConnectedAccount = accountsStatus.some(account => account.status === 'CONNECTED');

  return (
    <div className="flex h-full w-full">
      {/* Panel lateral - Cuentas y chats */}
      <div className="w-1/4 border-r flex flex-col h-full bg-white">
        {/* Selector de cuentas */}
        <div className="p-3 border-b">
          <Tabs defaultValue="accounts" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="accounts" className="flex-1">Cuentas</TabsTrigger>
              <TabsTrigger value="chats" className="flex-1">Chats</TabsTrigger>
            </TabsList>
            
            <TabsContent value="accounts" className="mt-2">
              <div className="space-y-2">
                {whatsappAccounts.length === 0 ? (
                  <p className="text-sm text-gray-500 p-2">No hay cuentas configuradas</p>
                ) : (
                  whatsappAccounts.map((account) => {
                    const status = accountsStatus.find(s => s.id === account.id);
                    return (
                      <Card 
                        key={account.id}
                        className={`cursor-pointer ${selectedAccount === account.id ? 'border-primary' : ''}`}
                        onClick={() => handleAccountChange(account.id)}
                      >
                        <CardHeader className="p-3">
                          <CardTitle className="text-sm flex justify-between items-center">
                            <span>{account.name}</span>
                            <Badge variant={status?.status === 'CONNECTED' ? 'default' : 'outline'}>
                              {status?.status === 'CONNECTED' ? 'Conectado' : 
                               status?.status === 'CONNECTING' ? 'Conectando' : 'Desconectado'}
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                      </Card>
                    );
                  })
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="chats" className="mt-2">
              {selectedAccount ? (
                <>
                  <div className="pb-2">
                    <Input
                      placeholder="Buscar chats..."
                      value={chatFilter}
                      onChange={(e) => setChatFilter(e.target.value)}
                    />
                  </div>
                  
                  {isLoadingChats ? (
                    <div className="flex items-center justify-center p-8">
                      <RefreshCw className="animate-spin h-5 w-5 mr-2" />
                      <span>Cargando chats...</span>
                    </div>
                  ) : selectedAccountStatus?.status !== 'CONNECTED' ? (
                    <p className="text-sm text-gray-500 p-2">
                      La cuenta no está conectada. Escanea el código QR para conectarte.
                    </p>
                  ) : filteredChats.length === 0 ? (
                    <p className="text-sm text-gray-500 p-2">
                      {chatFilter ? 'No se encontraron chats' : 'No hay chats disponibles'}
                    </p>
                  ) : (
                    <ScrollArea className="h-[calc(100vh-240px)]">
                      <div className="space-y-1">
                        {filteredChats.map(chat => (
                          <div
                            key={chat.id}
                            className={`p-2 hover:bg-gray-100 rounded cursor-pointer ${
                              selectedChat?.id === chat.id ? 'bg-gray-100' : ''
                            }`}
                            onClick={() => handleChatSelect(chat)}
                          >
                            <div className="flex items-center">
                              <Avatar className="h-8 w-8 mr-2">
                                <AvatarImage src={chat.profilePicUrl} />
                                <AvatarFallback>
                                  <User className="h-4 w-4" />
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between">
                                  <h4 className="text-sm font-medium truncate">{chat.name}</h4>
                                  {chat.unreadCount > 0 && (
                                    <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-xs text-white">
                                      {chat.unreadCount}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 truncate">{chat.lastMessage}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500 p-2">Selecciona una cuenta para ver los chats</p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      {/* Panel de mensajes */}
      <div className="flex-1 flex flex-col h-full">
        {/* Cabecera del chat */}
        {selectedChat ? (
          <>
            <div className="p-3 border-b bg-white flex justify-between items-center">
              <div className="flex items-center">
                <Avatar className="h-8 w-8 mr-2">
                  <AvatarImage src={selectedChat.profilePicUrl} />
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium">{selectedChat.name}</h3>
                  <p className="text-xs text-gray-500">
                    {selectedAccountStatus?.status === 'CONNECTED' ? 'En línea' : 'Desconectado'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => loadMessages(selectedChat.id)}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Área de mensajes */}
            <ScrollArea className="flex-1 p-4">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw className="animate-spin h-5 w-5 mr-2" />
                  <span>Cargando mensajes...</span>
                </div>
              ) : whatsappMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <MessageSquare className="h-12 w-12 mb-2" />
                  <p>No hay mensajes disponibles</p>
                  <p className="text-sm">Inicia la conversación enviando un mensaje</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {whatsappMessages.map((msg, index) => (
                    <div
                      key={msg.id || index}
                      className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          msg.fromMe
                            ? 'bg-blue-500 text-white rounded-br-none'
                            : 'bg-gray-100 text-gray-800 rounded-bl-none'
                        }`}
                      >
                        {msg.hasMedia && msg.mediaUrl && (
                          <div className="mb-2">
                            <img
                              src={msg.mediaUrl}
                              alt="Media"
                              className="rounded max-w-full h-auto"
                            />
                            {msg.caption && <p className="mt-1">{msg.caption}</p>}
                          </div>
                        )}
                        <p className="break-words">{msg.body}</p>
                        <p className={`text-xs mt-1 text-right ${msg.fromMe ? 'text-blue-100' : 'text-gray-500'}`}>
                          {formatMessageTime(msg.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>
            
            {/* Entrada de mensaje */}
            <div className="p-3 border-t bg-white">
              {selectedAccountStatus?.status === 'CONNECTED' ? (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    placeholder="Escribe un mensaje..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                  />
                  <Button onClick={sendMessage} disabled={!message.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="text-center p-2 bg-yellow-50 rounded border border-yellow-200">
                  <p className="text-yellow-700">
                    La cuenta no está conectada. Conéctate para enviar mensajes.
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 mx-auto mb-4" />
              <h3 className="text-xl font-medium mb-2">WhatsApp Web</h3>
              <p>Selecciona un chat para comenzar a enviar mensajes</p>
              {!hasConnectedAccount && (
                <p className="mt-4">
                  No hay cuentas conectadas. Escanea el código QR para conectarte.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Dialog para mostrar código QR */}
      <Dialog open={showQrCode} onOpenChange={setShowQrCode}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escanea el código QR con WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            {qrCodeData ? (
              <img
                src={qrCodeData}
                alt="QR Code para WhatsApp"
                className="w-64 h-64"
              />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center bg-gray-100">
                <RefreshCw className="animate-spin h-8 w-8" />
              </div>
            )}
          </div>
          <p className="text-center text-sm text-gray-500">
            Abre WhatsApp en tu teléfono &gt; Menú &gt; Dispositivos vinculados &gt; Vincular un dispositivo
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}