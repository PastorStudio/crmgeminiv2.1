import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { generateAutoResponse } from '@/lib/gemini';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import {
  User, Users, Phone, Paperclip, MessageSquare, Camera, X, 
  Send, RefreshCw, Settings, ArrowDown, Copy, Bot,
  Clock, MoreVertical, Check, RefreshCcw, List, Menu
} from 'lucide-react';

// Interfaces
interface WhatsAppChat {
  id: string;
  name: string;
  isGroup: boolean;
  timestamp: number;
  unreadCount: number;
  lastMessage?: string;
  profilePicUrl?: string;
}

interface WhatsAppMessage {
  id: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  hasMedia: boolean;
  mediaUrl?: string;
  caption?: string;
}

interface WhatsAppAccountStatus {
  id: number;
  name: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING';
  qrCode?: string;
}

interface WhatsAppInterfaceProps {
  selectedLeadId?: number;
  onSelectLead?: (leadId: number) => void;
}

enum NotificationType {
  NEW_MESSAGE = 'NEW_MESSAGE',
  CONNECTION_STATUS = 'CONNECTION_STATUS',
  QR_CODE = 'QR_CODE'
}

interface Notification {
  type: NotificationType;
  data: any;
}

export function WhatsAppSimple({ selectedLeadId, onSelectLead }: WhatsAppInterfaceProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Estados para la interfaz
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [whatsappChats, setWhatsappChats] = useState<WhatsAppChat[]>([]);
  const [whatsappMessages, setWhatsappMessages] = useState<WhatsAppMessage[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrCodeData, setQRCodeData] = useState<string | null>(null);
  const [isAutoResponseEnabled, setIsAutoResponseEnabled] = useState(false);
  const [autoResponseConfig, setAutoResponseConfig] = useState({
    useAI: true,
    customResponse: '',
    delay: 2
  });
  const [accountsStatus, setAccountsStatus] = useState<WhatsAppAccountStatus[]>([]);
  const [currentAccountId, setCurrentAccountId] = useState<number | null>(null);
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const [allAccountsChats, setAllAccountsChats] = useState<{[accountId: number]: WhatsAppChat[]}>({});
  
  // Referencias
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
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

  // Consulta para obtener estado de WhatsApp
  const { data: statusData, refetch: refetchStatus } = useQuery({
    queryKey: ['/api/direct/whatsapp/status'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/direct/whatsapp/status');
        if (!response.ok) throw new Error("Error al obtener estado de WhatsApp");
        return await response.json();
      } catch (error) {
        console.error("Error obteniendo estado WhatsApp:", error);
        return [];
      }
    },
    refetchInterval: 5000
  });

  // Cargar chats de todas las cuentas
  const loadAllAccountsChats = async () => {
    if (!whatsappAccounts || whatsappAccounts.length === 0) return;
    
    const newAllChats: {[accountId: number]: WhatsAppChat[]} = {};
    
    for (const account of whatsappAccounts) {
      try {
        const response = await fetch(`/api/direct/whatsapp/chats?accountId=${account.id}`);
        if (!response.ok) continue;
        
        const chats = await response.json();
        newAllChats[account.id] = chats;
      } catch (error) {
        console.error(`Error cargando chats para cuenta ${account.id}:`, error);
      }
    }
    
    setAllAccountsChats(newAllChats);
  };

  // Actualizar estados cuando cambia el status
  useEffect(() => {
    if (statusData) {
      const statusArray = Array.isArray(statusData) ? statusData : [statusData];
      setAccountsStatus(statusArray);
      
      // Verificar si hay un código QR disponible
      const accountWithQr = statusArray.find(acc => acc.qrCode && acc.status === 'CONNECTING');
      if (accountWithQr) {
        setQRCodeData(accountWithQr.qrCode);
        setShowQRCode(true);
      }
    }
  }, [statusData]);

  // Seleccionar la primera cuenta disponible si no hay una seleccionada
  useEffect(() => {
    if (!currentAccountId && whatsappAccounts.length > 0) {
      setCurrentAccountId(whatsappAccounts[0].id);
    }
  }, [whatsappAccounts, currentAccountId]);

  // Cargar chats cuando cambia la cuenta seleccionada
  useEffect(() => {
    if (currentAccountId) {
      loadChats();
    }
  }, [currentAccountId]);

  // Función para cargar chats de la cuenta actual
  const loadChats = async () => {
    if (!currentAccountId) return;
    
    setIsLoadingChats(true);
    try {
      const response = await fetch(`/api/direct/whatsapp/chats?accountId=${currentAccountId}`);
      if (!response.ok) throw new Error("Error al cargar chats");
      
      const chats = await response.json();
      setWhatsappChats(chats || []);
      
      // Si no hay chat seleccionado, seleccionar el primero
      if (!selectedChatId && chats.length > 0) {
        setSelectedChatId(chats[0].id);
        loadMessages(chats[0].id);
      }
    } catch (error) {
      console.error("Error cargando chats:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los chats",
        variant: "destructive"
      });
    } finally {
      setIsLoadingChats(false);
    }
  };

  // Función para cargar mensajes
  const loadMessages = async (chatId: string) => {
    if (!chatId || !currentAccountId) return;
    
    setIsLoadingMessages(true);
    try {
      const response = await fetch(`/api/direct/whatsapp/messages?chatId=${chatId}&accountId=${currentAccountId}`);
      if (!response.ok) throw new Error("Error al cargar mensajes");
      
      const messages = await response.json();
      setWhatsappMessages(messages || []);
      
      // Scroll al último mensaje
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      console.error("Error cargando mensajes:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los mensajes",
        variant: "destructive"
      });
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Función para enviar mensaje
  const sendMessage = async () => {
    if (!inputMessage.trim() || !selectedChatId || !currentAccountId) return;
    
    try {
      const response = await fetch('/api/direct/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chatId: selectedChatId,
          message: inputMessage.trim(),
          accountId: currentAccountId
        })
      });
      
      if (!response.ok) throw new Error("Error al enviar mensaje");
      
      setInputMessage('');
      
      // Recargar mensajes después de enviar
      setTimeout(() => loadMessages(selectedChatId), 1000);
    } catch (error) {
      console.error("Error enviando mensaje:", error);
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje",
        variant: "destructive"
      });
    }
  };

  // Función para seleccionar un chat
  const handleChatSelect = (chat: WhatsAppChat) => {
    setSelectedChatId(chat.id);
    loadMessages(chat.id);
  };

  // Función para formatear hora del chat
  const formatChatTime = (timestamp: number) => {
    try {
      const date = new Date(timestamp * 1000);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return format(date, 'HH:mm');
      } else if (diffDays < 7) {
        return format(date, 'EEE');
      } else {
        return format(date, 'dd/MM/yyyy');
      }
    } catch (error) {
      return '';
    }
  };

  // Función para formatear hora del mensaje
  const formatMessageTime = (timestamp: number) => {
    try {
      return format(new Date(timestamp * 1000), 'HH:mm');
    } catch (error) {
      return '';
    }
  };

  // Conectar WebSocket
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('Conexión WebSocket establecida');
    };

    socket.onmessage = (event) => {
      try {
        const notification: Notification = JSON.parse(event.data);
        
        if (notification.type === NotificationType.NEW_MESSAGE) {
          // Si el mensaje es para el chat seleccionado, recargar mensajes
          if (notification.data.chatId === selectedChatId && 
              notification.data.accountId === currentAccountId) {
            loadMessages(selectedChatId);
          }
          
          // Siempre recargar la lista de chats para actualizar las previsualizaciones
          loadChats();
          
          // Si está habilitada la respuesta automática y el mensaje no es nuestro
          if (isAutoResponseEnabled && !notification.data.fromMe) {
            handleAutoResponse(notification.data);
          }
        } 
        else if (notification.type === NotificationType.CONNECTION_STATUS) {
          refetchStatus();
        }
        else if (notification.type === NotificationType.QR_CODE) {
          if (notification.data.accountId === currentAccountId) {
            setQRCodeData(notification.data.qrCode);
            setShowQRCode(true);
          }
        }
      } catch (error) {
        console.error('Error procesando evento WebSocket:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('Error en WebSocket:', error);
    };

    return () => {
      socket.close();
    };
  }, [selectedChatId, currentAccountId, isAutoResponseEnabled]);

  // Filtrar chats según búsqueda
  const filteredChats = chatSearchQuery
    ? whatsappChats.filter(chat => 
        chat.name.toLowerCase().includes(chatSearchQuery.toLowerCase()) || 
        (chat.lastMessage && chat.lastMessage.toLowerCase().includes(chatSearchQuery.toLowerCase()))
      )
    : whatsappChats;

  // Manejar respuesta automática
  const handleAutoResponse = async (message: WhatsAppMessage) => {
    // Esperar el tiempo configurado
    await new Promise(resolve => setTimeout(resolve, autoResponseConfig.delay * 1000));
    
    let responseText = autoResponseConfig.customResponse;
    
    // Si está configurado para usar IA, generar respuesta
    if (autoResponseConfig.useAI) {
      try {
        const recentMessages = whatsappMessages.slice(-5);
        let context = recentMessages.map((msg) => {
          return `${msg.fromMe ? 'Yo' : 'Cliente'}: ${msg.body}`;
        }).join('\n');
        
        responseText = await generateAutoResponse(message.body, context);
      } catch (error) {
        console.error('Error generando respuesta automática:', error);
        responseText = autoResponseConfig.customResponse || "Gracias por su mensaje. Le responderemos a la brevedad.";
      }
    }
    
    // Enviar la respuesta
    if (responseText && selectedChatId && currentAccountId) {
      try {
        await fetch('/api/direct/whatsapp/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            chatId: selectedChatId,
            message: responseText,
            accountId: currentAccountId
          })
        });
        
        // Recargar mensajes después de enviar
        setTimeout(() => loadMessages(selectedChatId), 1000);
      } catch (error) {
        console.error('Error enviando respuesta automática:', error);
      }
    }
  };

  // Determinar si un mensaje forma parte de una secuencia
  const isSequentialMessage = (currentMsg: WhatsAppMessage, index: number) => {
    if (index === 0) return false;
    
    const prevMsg = whatsappMessages[index - 1];
    return prevMsg.fromMe === currentMsg.fromMe && 
           currentMsg.timestamp - prevMsg.timestamp < 60; // menos de 1 minuto de diferencia
  };

  // Obtener el estado de la cuenta actual
  const currentAccountStatus = currentAccountId 
    ? accountsStatus.find(acc => acc.id === currentAccountId)
    : null;

  // Tecla Enter para enviar
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Card className="flex flex-col w-full h-full overflow-hidden">
      <CardHeader className="p-3 border-b">
        <CardTitle className="text-lg flex justify-between items-center">
          <span>WhatsApp Web</span>
          
          {/* Selector de cuenta */}
          <div className="flex gap-2">
            {currentAccountId && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={loadChats}
                disabled={isLoadingChats}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isLoadingChats ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            )}
            
            <select 
              className="text-sm border rounded px-2 py-1 bg-white"
              value={currentAccountId || ''}
              onChange={(e) => setCurrentAccountId(Number(e.target.value))}
            >
              <option value="" disabled>Seleccionar cuenta</option>
              {whatsappAccounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.name} 
                  {accountsStatus.find(s => s.id === account.id)?.status === 'CONNECTED' ? ' ✓' : ''}
                </option>
              ))}
            </select>
          </div>
        </CardTitle>
      </CardHeader>

      <div className="grid grid-cols-12 flex-1 overflow-hidden">
        {/* Panel lateral - 4 columnas */}
        <div className="col-span-4 border-r h-full flex flex-col">
          <Tabs defaultValue="chats" className="flex flex-col h-full overflow-hidden">
            <TabsList className="grid grid-cols-3 mb-2 p-2">
              <TabsTrigger value="chats">Chats</TabsTrigger>
              <TabsTrigger value="accounts">Cuentas</TabsTrigger>
              <TabsTrigger value="all-accounts">Todas</TabsTrigger>
            </TabsList>

            <TabsContent value="chats" className="flex-1 overflow-hidden">
              <div className="px-2 mb-2">
                <Input
                  placeholder="Buscar chats..."
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                  className="mb-1"
                />
              </div>

              <ScrollArea className="h-[calc(100vh-230px)]">
                {isLoadingChats ? (
                  <div className="flex items-center justify-center h-40">
                    <Spinner size="md" />
                    <span className="ml-2">Cargando chats...</span>
                  </div>
                ) : !currentAccountStatus?.status ? (
                  <div className="text-center p-4 text-gray-500">
                    <p>Cuenta no conectada</p>
                  </div>
                ) : filteredChats.length === 0 ? (
                  <div className="text-center p-4 text-gray-500">
                    <p>No hay chats disponibles</p>
                  </div>
                ) : (
                  <div className="space-y-1 pr-4">
                    {filteredChats.map((chat) => (
                      <div
                        key={chat.id}
                        onClick={() => handleChatSelect(chat)}
                        className={`p-2 rounded-md cursor-pointer flex items-center ${
                          selectedChatId === chat.id
                            ? "bg-gray-100"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex-shrink-0 mr-3">
                          <Avatar>
                            {chat.profilePicUrl ? (
                              <AvatarImage src={chat.profilePicUrl} alt={chat.name} />
                            ) : (
                              <AvatarFallback>
                                {chat.isGroup ? (
                                  <Users className="h-5 w-5" />
                                ) : (
                                  <User className="h-5 w-5" />
                                )}
                              </AvatarFallback>
                            )}
                          </Avatar>
                        </div>
                        <div className="flex-grow min-w-0">
                          <div className="flex justify-between">
                            <h3 className="text-sm font-medium truncate">
                              {chat.name}
                            </h3>
                            <span className="text-xs text-gray-500">
                              {formatChatTime(chat.timestamp)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {chat.lastMessage}
                          </p>
                        </div>
                        {chat.unreadCount > 0 && (
                          <div className="ml-2">
                            <Badge variant="outline" className="bg-green-500 hover:bg-green-600 text-white">
                              {chat.unreadCount}
                            </Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="accounts" className="overflow-auto">
              <div className="p-2 space-y-2">
                {whatsappAccounts.length === 0 ? (
                  <p className="text-center text-gray-500 p-4">
                    No hay cuentas configuradas
                  </p>
                ) : (
                  <>
                    {whatsappAccounts.map((account) => {
                      const status = accountsStatus.find(s => s.id === account.id);
                      return (
                        <Card 
                          key={account.id}
                          className={`cursor-pointer ${currentAccountId === account.id ? 'border-primary' : ''}`}
                          onClick={() => setCurrentAccountId(account.id)}
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
                    })}
                    <div className="flex justify-end p-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={refetchStatus}
                        className="text-xs"
                      >
                        <RefreshCw className="mr-1 h-3 w-3" />
                        Actualizar estado
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="all-accounts" className="overflow-auto">
              <div className="p-2 mb-2">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-medium">Todos los chats</h3>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={loadAllAccountsChats}
                    className="text-xs"
                  >
                    <RefreshCw className="mr-1 h-3 w-3" />
                    Actualizar
                  </Button>
                </div>
                
                <Input
                  placeholder="Buscar en todas las cuentas..."
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                  className="mb-2"
                />
              </div>

              <ScrollArea className="h-[calc(100vh-250px)]">
                {Object.keys(allAccountsChats).length === 0 ? (
                  <div className="text-center p-4 text-gray-500">
                    <p>Haga clic en "Actualizar" para cargar todos los chats</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(allAccountsChats).map(([accountId, chats]) => {
                      if (chats.length === 0) return null;
                      
                      const account = whatsappAccounts.find(acc => acc.id === Number(accountId));
                      
                      return (
                        <div key={accountId} className="mb-2">
                          <div className="bg-gray-100 p-2 sticky top-0 z-10 border-y">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">{account?.name || `Cuenta ${accountId}`}</span>
                              <Badge variant="outline" className="text-xs">
                                {chats.length} {chats.length === 1 ? 'chat' : 'chats'}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            {chats.filter(chat => 
                              chatSearchQuery ? 
                                chat.name.toLowerCase().includes(chatSearchQuery.toLowerCase()) : 
                                true
                            ).map(chat => (
                              <div
                                key={chat.id}
                                onClick={() => {
                                  setCurrentAccountId(Number(accountId));
                                  setTimeout(() => handleChatSelect(chat), 100);
                                }}
                                className="p-2 hover:bg-gray-50 cursor-pointer"
                              >
                                <div className="flex items-center">
                                  <Avatar className="h-8 w-8 mr-2">
                                    <AvatarImage src={chat.profilePicUrl} alt={chat.name} />
                                    <AvatarFallback>
                                      <User className="h-4 w-4" />
                                    </AvatarFallback>
                                  </Avatar>
                                  
                                  <div className="flex-1 min-w-0">
                                    <div className="flex justify-between">
                                      <h4 className="text-sm font-medium truncate">{chat.name}</h4>
                                      <span className="text-xs text-gray-500">
                                        {formatChatTime(chat.timestamp)}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-500 truncate">
                                      {chat.lastMessage}
                                    </p>
                                  </div>
                                  
                                  {chat.unreadCount > 0 && (
                                    <Badge className="ml-2 bg-green-500">
                                      {chat.unreadCount}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* Panel principal - 8 columnas */}
        <div className="col-span-8 flex flex-col h-full">
          {selectedChatId ? (
            <>
              {/* Cabecera del chat */}
              <div className="p-3 border-b flex justify-between items-center">
                <div className="flex items-center">
                  <Avatar className="h-9 w-9 mr-2">
                    {whatsappChats.find(c => c.id === selectedChatId)?.profilePicUrl ? (
                      <AvatarImage 
                        src={whatsappChats.find(c => c.id === selectedChatId)?.profilePicUrl} 
                        alt={whatsappChats.find(c => c.id === selectedChatId)?.name || 'Contact'} 
                      />
                    ) : (
                      <AvatarFallback>
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                    <h3 className="font-medium text-sm">
                      {whatsappChats.find(c => c.id === selectedChatId)?.name}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {currentAccountStatus?.status === 'CONNECTED' ? 'En línea' : 'Desconectado'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => loadMessages(selectedChatId)}
                    disabled={isLoadingMessages}
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoadingMessages ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsAutoResponseEnabled(!isAutoResponseEnabled)}
                  >
                    <Bot className={`h-4 w-4 ${isAutoResponseEnabled ? 'text-green-500' : ''}`} />
                  </Button>
                </div>
              </div>

              {/* Contenido del chat */}
              <ScrollArea 
                className="flex-1 p-4" 
                ref={chatContainerRef}
              >
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <Spinner size="lg" />
                  </div>
                ) : whatsappMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <MessageSquare className="h-12 w-12 mb-2" />
                    <div className="text-gray-500 text-sm">No hay mensajes</div>
                    <div className="text-gray-400 text-xs mt-1">Envía un mensaje para iniciar la conversación</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {whatsappMessages.map((msg, index) => {
                      const isSequential = isSequentialMessage(msg, index);
                      return (
                        <div 
                          key={msg.id || index}
                          className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}
                        >
                          {!msg.fromMe && !isSequential && (
                            <Avatar className="h-8 w-8 mr-2">
                              <AvatarFallback>
                                <User className="h-4 w-4" />
                              </AvatarFallback>
                            </Avatar>
                          )}
                          {!msg.fromMe && isSequential && <div className="w-10 flex-shrink-0"></div>}
                          
                          <div
                            className={`max-w-[70%] p-3 rounded-lg ${
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
                                {msg.caption && <div className="text-xs mt-1">{msg.caption}</div>}
                              </div>
                            )}
                            <div className="break-words whitespace-pre-wrap">{msg.body}</div>
                            <div className={`text-xs mt-1 text-right ${
                              msg.fromMe ? 'text-blue-100' : 'text-gray-500'
                            }`}>
                              {formatMessageTime(msg.timestamp)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Entrada de mensaje */}
              <div className="p-3 border-t">
                {currentAccountStatus?.status === 'CONNECTED' ? (
                  <div className="flex items-center">
                    <Button variant="outline" size="icon" className="mr-2">
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Input
                      placeholder="Escribe un mensaje..."
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={handleKeyPress}
                      className="mr-2"
                    />
                    <Button 
                      onClick={sendMessage}
                      disabled={!inputMessage.trim()}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="text-center p-2 bg-yellow-50 rounded border border-yellow-200">
                    <p className="text-yellow-700 text-sm">
                      La cuenta no está conectada. Conecte WhatsApp para enviar mensajes.
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <MessageSquare className="h-16 w-16 mb-4" />
              <h3 className="text-xl font-medium mb-2">WhatsApp Web</h3>
              <p className="text-sm mb-4">Selecciona un chat para empezar a enviar mensajes</p>
              
              {!currentAccountStatus?.status && (
                <div className="text-center max-w-md">
                  <Badge variant="outline" className="mb-2">No conectado</Badge>
                  <p className="text-sm">
                    Selecciona una cuenta de WhatsApp y escanea el código QR para conectarte.
                  </p>
                  <Button 
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      if (currentAccountId) {
                        const status = accountsStatus.find(s => s.id === currentAccountId);
                        if (status?.qrCode) {
                          setQRCodeData(status.qrCode);
                          setShowQRCode(true);
                        }
                      }
                    }}
                  >
                    <QRCode className="h-4 w-4 mr-2" />
                    Mostrar código QR
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Diálogo para el código QR */}
      <Dialog open={showQRCode} onOpenChange={setShowQRCode}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escanea este código QR con WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center p-4">
            {qrCodeData ? (
              <img
                src={qrCodeData}
                alt="QR Code"
                className="w-64 h-64"
              />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center bg-gray-100">
                <Spinner size="lg" />
              </div>
            )}
          </div>
          <p className="text-center text-gray-500 text-sm">
            Abre WhatsApp en tu teléfono &gt; Ajustes &gt; Dispositivos vinculados &gt; Vincular un dispositivo
          </p>
        </DialogContent>
      </Dialog>
    </Card>
  );
}