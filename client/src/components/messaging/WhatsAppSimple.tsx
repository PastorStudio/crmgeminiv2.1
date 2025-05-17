import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { generateAutoResponse } from '@/lib/gemini';
import { chatContext } from '@/lib/chatContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useWebSocket, NotificationType } from '@/hooks/useWebSocket';
import { getInitials } from '@/lib/utils';
import { MessageText } from '@/components/ui/message-text';
import {
  Search,
  Send,
  Paperclip,
  Brain,
  Bot,
  MoreVertical,
  Smile,
  CheckCheck,
  RefreshCw,
  MessageSquare,
  Image,
  FileText,
  Mic,
  Camera,
  Contact,
  File,
  Settings,
  Wifi,
  WifiOff
} from 'lucide-react';
// Importar el componente de configuración
import { GeminiConfig } from '@/components/GeminiConfig';

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

interface WhatsAppInterfaceProps {
  selectedLeadId?: number;
  onSelectLead?: (leadId: number) => void;
}

// Sin datos de demostración - Sólo se utilizarán datos reales

export function WhatsAppSimple({ selectedLeadId, onSelectLead }: WhatsAppInterfaceProps) {
  // Estado local
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [activeTab, setActiveTab] = useState('chats');
  const [chatFilter, setChatFilter] = useState('');
  const [autoResponses, setAutoResponses] = useState<boolean>(false);
  const [showConfigMenu, setShowConfigMenu] = useState<boolean>(false);
  
  // Refs para scroll automático
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Hook para WebSockets
  const { 
    sendMessage: sendWSMessage, 
    lastMessage, 
    connectionStatus 
  } = useWebSocket();
  
  // Toast para notificaciones
  const { toast } = useToast();

  // Query para obtener el estado de WhatsApp
  const { 
    data: whatsappStatus,
    isLoading: isLoadingStatus
  } = useQuery({
    queryKey: ['/api/direct/whatsapp/status'],
    refetchInterval: 5000
  });

  // Query para obtener chats - con protección adicional contra la desaparición de datos
  const { 
    data: apiChats = [],
    isLoading: isLoadingChats,
    refetch: refetchChats,
    error: chatError
  } = useQuery({
    queryKey: ['/api/direct/whatsapp/chats'],
    refetchInterval: 10000, // Reducimos frecuencia para evitar sobrecarga
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 5, // Aumentamos reintentos
    staleTime: 30000, // Mantenemos datos por más tiempo
    queryFn: async () => {
      try {
        // Agregamos parámetro timestamp para evitar caché del navegador
        const timestamp = new Date().getTime();
        const url = `/api/direct/whatsapp/chats?t=${timestamp}`;
        
        // Usar XMLHttpRequest en lugar de fetch para evitar problemas con el caché
        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('GET', url, true);
          xhr.setRequestHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          xhr.setRequestHeader('Pragma', 'no-cache');
          
          xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText);
                if (Array.isArray(data)) {
                  console.log(`Chats obtenidos correctamente: ${data.length} chats`);
                  
                  // Guardamos en localStorage para tener un respaldo
                  if (data.length > 0) {
                    try {
                      localStorage.setItem('whatsapp_chats_backup', JSON.stringify(data));
                      console.log('Chat backup guardado:', data.length, 'chats');
                    } catch (localStorageError) {
                      console.error('Error al guardar en localStorage:', localStorageError);
                    }
                  }
                  
                  resolve(data);
                } else {
                  console.error('Respuesta no es un array:', typeof data);
                  
                  // Intentar recuperar del localStorage
                  try {
                    const backup = localStorage.getItem('whatsapp_chats_backup');
                    if (backup) {
                      const parsedBackup = JSON.parse(backup);
                      console.log('Usando chats de respaldo:', parsedBackup.length);
                      resolve(parsedBackup);
                      return;
                    }
                  } catch (backupError) {
                    console.error('Error al recuperar backup:', backupError);
                  }
                  
                  resolve([]);
                }
              } catch (error) {
                console.error('Error al parsear respuesta:', error);
                resolve([]);
              }
            } else {
              console.error('Error en la solicitud XHR:', xhr.status);
              resolve([]);
            }
          };
          
          xhr.onerror = function() {
            console.error('Error de red en la solicitud XHR');
            resolve([]);
          };
          
          xhr.send();
        });
      } catch (error) {
        console.error("Error obteniendo chats:", error);
        return [];
      }
    }
  });

  // Query para obtener mensajes del chat seleccionado
  const { 
    data: apiMessages = [],
    isLoading: isLoadingMessages,
    refetch: refetchMessages
  } = useQuery({
    queryKey: ['/api/direct/whatsapp/messages', selectedChatId],
    queryFn: async () => {
      try {
        if (selectedChatId) {
          const response = await fetch(`/api/direct/whatsapp/messages/${selectedChatId}`);
          if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
          }
          const data = await response.json();
          console.log(`Mensajes recibidos para ${selectedChatId}:`, data.length);
          return data;
        } else {
          return [];
        }
      } catch (error) {
        console.error(`Error obteniendo mensajes para ${selectedChatId}:`, error);
        return [];
      }
    },
    // Siempre intentamos cargar mensajes si hay un chat seleccionado
    enabled: !!selectedChatId,
    // Configuración de refresco
    refetchInterval: selectedChatId ? 3000 : false,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 3
  });
  
  // Mutación para enviar mensaje
  const messageMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!selectedChatId) throw new Error('No hay chat seleccionado');
      
      const response = await fetch(`/api/direct/whatsapp/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: selectedChatId,
          message
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Error al enviar mensaje: ${response.statusText}`);
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      console.log('Mensaje enviado con éxito', data);
      // Refrescar mensajes
      setTimeout(() => {
        refetchMessages();
      }, 500);
    },
    onError: (error) => {
      console.error('Error al enviar mensaje:', error);
      toast({
        title: 'Error al enviar mensaje',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive'
      });
    }
  });
  
  // Mutación para activar/desactivar respuestas automáticas
  const autoResponseMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await fetch(`/api/auto-response/${enabled ? 'config' : 'cancel'}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled,
          model: 'gemini-pro' // Modelo predeterminado
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Error al ${enabled ? 'activar' : 'desactivar'} respuestas automáticas`);
      }
      
      return await response.json();
    },
    onSuccess: (data, variables) => {
      console.log(`Respuestas automáticas ${variables ? 'activadas' : 'desactivadas'}`, data);
      toast({
        title: `Respuestas automáticas ${variables ? 'activadas' : 'desactivadas'}`,
        description: variables 
          ? 'Ahora Gemini AI responderá automáticamente los mensajes entrantes' 
          : 'Has desactivado las respuestas automáticas',
        variant: 'default'
      });
    },
    onError: (error) => {
      console.error('Error al configurar respuestas automáticas:', error);
      toast({
        title: 'Error al configurar respuestas automáticas',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive'
      });
    }
  });

  // Solo usar chats reales de la API - NUNCA datos de ejemplo
  console.log("Estado de autenticación WhatsApp:", whatsappStatus?.authenticated);
  console.log("Chats recibidos de la API:", apiChats?.length);
  
  // Verificamos el estado de WhatsApp y mostramos datos detallados
  console.log("WhatsApp Status completo:", JSON.stringify(whatsappStatus));
  
  // Solución para evitar desaparición de chats
  const hasRealChats = Array.isArray(apiChats) && apiChats.length > 0;
  
  // Estado local para almacenar los chats y que no desaparezcan
  const [persistentChats, setPersistentChats] = useState<WhatsAppChat[]>([]);
  
  // Efecto para mantener los chats persistentes
  useEffect(() => {
    if (Array.isArray(apiChats) && apiChats.length > 0) {
      console.log("Actualizando chats persistentes con", apiChats.length, "chats");
      setPersistentChats(apiChats);
    }
  }, [apiChats]);
  
  // Usamos chats persistentes si están disponibles, o los datos de la API en caso contrario
  const whatsappChats = persistentChats.length > 0 ? persistentChats : (Array.isArray(apiChats) ? apiChats : []);
  
  // Filtrar chats por nombre o último mensaje (si hay chats)
  const filteredChats = whatsappChats.length > 0 
    ? whatsappChats.filter(chat => {
        if (!chatFilter) return true;
        
        const searchTermLower = chatFilter.toLowerCase();
        return (
          (chat.name && chat.name.toLowerCase().includes(searchTermLower)) || 
          (chat.lastMessage && chat.lastMessage.toLowerCase().includes(searchTermLower))
        );
      })
    : [];
  
  // Solo usar mensajes reales de la API
  const whatsappMessages = selectedChatId && Array.isArray(apiMessages) ? apiMessages : [];
  
  // Obtener el chat actual
  const currentChat = selectedChatId && Array.isArray(whatsappChats) 
    ? whatsappChats.find((chat: WhatsAppChat) => chat.id === selectedChatId) 
    : null;

  // Seleccionar el primer chat al cargar
  useEffect(() => {
    if (Array.isArray(whatsappChats) && whatsappChats.length > 0 && !selectedChatId) {
      // Ordenar por más reciente
      const sortedChats = [...whatsappChats].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setSelectedChatId(sortedChats[0].id);
    }
  }, [whatsappChats, selectedChatId]);

  // Scroll al último mensaje
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [whatsappMessages]);

  // Actualizar cuando llega una notificación por WebSocket
  useEffect(() => {
    if (lastMessage && lastMessage.type === NotificationType.NewMessage) {
      console.log('Nueva notificación de mensaje:', lastMessage);
      // Refrescar chats y mensajes
      refetchChats();
      if (selectedChatId) {
        refetchMessages();
      }
      
      // Mostrar notificación
      toast({
        title: 'Nuevo mensaje',
        description: `De: ${lastMessage.sender || 'Desconocido'}`,
        variant: 'default'
      });
    }
  }, [lastMessage, refetchChats, refetchMessages, selectedChatId, toast]);

  // Manejar selección de chat
  const handleChatSelect = (chat: WhatsAppChat) => {
    setSelectedChatId(chat.id);
    
    // Si hay un ID de lead asociado, notificar
    if (onSelectLead && selectedLeadId) {
      onSelectLead(selectedLeadId);
    }
  };

  // Enviar mensaje
  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedChatId) return;
    
    messageMutation.mutate(newMessage);
    setNewMessage('');
  };

  // Procesar keydown en el input de mensaje
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Generar respuesta automática
  const handleAutoResponse = async (message: WhatsAppMessage) => {
    if (!message || !selectedChatId) return;
    
    try {
      const context = await chatContext(selectedChatId);
      const response = await generateAutoResponse(message.body, context);
      
      if (response) {
        messageMutation.mutate(response);
        
        toast({
          title: 'Respuesta automática generada',
          description: 'Se ha enviado una respuesta generada por IA',
          variant: 'default'
        });
      }
    } catch (error) {
      console.error('Error al generar respuesta automática:', error);
      toast({
        title: 'Error al generar respuesta automática',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive'
      });
    }
  };

  // Manejar cambio en el switch de respuestas automáticas
  const handleAutoResponseToggle = (checked: boolean) => {
    setAutoResponses(checked);
    autoResponseMutation.mutate(checked);
  };

  return (
    <Card className="flex flex-col w-full h-full overflow-hidden shadow-md">
      <CardHeader className="p-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-500" />
            GeminiCRM WhatsApp
            {connectionStatus === 'Connected' && (
              <Wifi className="h-4 w-4 text-green-500" />
            )}
            {connectionStatus !== 'Connected' && (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {isLoadingStatus ? (
              <Spinner size="sm" />
            ) : whatsappStatus?.authenticated ? (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Conectado
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                No conectado
              </Badge>
            )}
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56">
                <div className="grid gap-2">
                  <div className="flex items-center gap-2">
                    <Switch id="auto-responses" checked={autoResponses} onCheckedChange={handleAutoResponseToggle} />
                    <label 
                      htmlFor="auto-responses" 
                      className="text-sm font-medium cursor-pointer flex items-center"
                    >
                      <Bot className="mr-1 h-4 w-4" />
                      Respuestas automáticas
                    </label>
                  </div>
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-start">
                        <Settings className="mr-1 h-4 w-4" />
                        Configurar Gemini
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Configuración de Gemini AI</DialogTitle>
                      </DialogHeader>
                      <GeminiConfig />
                    </DialogContent>
                  </Dialog>
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={() => {
                      refetchChats();
                      refetchMessages();
                      toast({
                        title: "Actualizando",
                        description: "Recuperando mensajes y chats más recientes"
                      });
                    }}
                  >
                    <RefreshCw className="mr-1 h-4 w-4" />
                    Actualizar datos
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      
      <div className="grid grid-cols-12 flex-1 overflow-hidden">
        {/* Panel izquierdo - Chats */}
        <div className="col-span-12 md:col-span-4 flex flex-col border-r h-full overflow-hidden">
          <Tabs defaultValue="chats" className="flex flex-col h-full overflow-hidden">
            <div className="border-b p-2">
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar chat o contacto..."
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
              {/* Lista de chats - Manejo más robusto */}
              {activeTab === 'chats' && (
                <ScrollArea className="flex-1">
                  {isLoadingChats && whatsappChats.length === 0 ? (
                    <div className="flex justify-center p-4">
                      <Spinner />
                    </div>
                  ) : whatsappChats && whatsappChats.length > 0 ? (
                    <div className="divide-y">
                      {filteredChats.map((chat: WhatsAppChat) => (
                        <div
                          key={chat.id}
                          className={`p-3 hover:bg-gray-50 cursor-pointer ${
                            selectedChatId === chat.id ? 'bg-green-50 border-l-4 border-l-green-500' : ''
                          }`}
                          onClick={() => handleChatSelect(chat)}
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
              )}
              
              {/* Lista de contactos (placeholder) */}
              {activeTab === 'contacts' && (
                <ScrollArea className="flex-1">
                  <div className="p-4 text-center text-gray-500">
                    <div className="mb-2">Lista de contactos</div>
                    <div className="text-xs">
                      Próximamente: funcionalidad para gestionar contactos
                    </div>
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
            
            <TabsContent value="contacts" className="flex-1 overflow-hidden">
              <ScrollArea className="flex-1">
                <div className="p-4 text-center text-gray-500">
                  <div className="mb-2">Lista de contactos</div>
                  <div className="text-xs">
                    Próximamente: funcionalidad para gestionar contactos
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Panel derecho - Mensajes */}
        <div className="col-span-12 md:col-span-8 flex flex-col h-full overflow-hidden">
          {selectedChatId && currentChat ? (
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
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => {
                      if (selectedChatId) {
                        refetchMessages();
                      }
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => handleAutoResponse(whatsappMessages[whatsappMessages.length - 1])}
                    disabled={whatsappMessages.length === 0 || messageMutation.isPending}
                  >
                    <Brain className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Área de mensajes */}
              <div 
                className="flex-1 overflow-y-auto p-3 bg-gray-50" 
                ref={chatContainerRef}
              >
                {isLoadingMessages ? (
                  <div className="flex justify-center p-4">
                    <Spinner />
                  </div>
                ) : whatsappMessages && whatsappMessages.length > 0 ? (
                  <div className="space-y-1">
                    {whatsappMessages.map((msg: WhatsAppMessage, index: number) => {
                      // Verificar si debe mostrar separador de fecha
                      const showDateSeparator = index === 0 || 
                        new Date(msg.timestamp * 1000).toDateString() !== 
                        new Date(whatsappMessages[index - 1].timestamp * 1000).toDateString();
                      
                      // Verificar si es una secuencia de mensajes del mismo remitente
                      const isSequential = index > 0 && 
                        msg.fromMe === whatsappMessages[index - 1].fromMe;
                      
                      return (
                        <React.Fragment key={msg.id}>
                          {showDateSeparator && (
                            <div className="flex justify-center my-4">
                              <div className="bg-gray-100 text-gray-500 text-xs rounded-full px-3 py-1 font-medium">
                                {format(new Date(msg.timestamp * 1000), 'EEEE, d MMMM', { locale: es })}
                              </div>
                            </div>
                          )}
                          
                          <div 
                            className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'} ${isSequential ? 'mt-1' : 'mt-3'} w-full`}
                          >
                            {!msg.fromMe && !isSequential && (
                              <Avatar className="h-8 w-8 mr-2 mt-2 flex-shrink-0 border shadow-sm">
                                <AvatarFallback className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs">
                                  {currentChat?.name ? getInitials(currentChat.name) : 'UN'}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            
                            {!msg.fromMe && isSequential && <div className="w-10 flex-shrink-0"></div>}
                            
                            <div 
                              className={`max-w-[95%] w-fit rounded-lg p-3 ${
                                msg.fromMe 
                                  ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md ml-auto' 
                                  : 'bg-white border shadow-sm mr-auto'
                              } ${isSequential && msg.fromMe ? 'rounded-tr-sm' : ''} ${isSequential && !msg.fromMe ? 'rounded-tl-sm' : ''}`}
                            >
                              {msg.hasMedia && (
                                <div className="mb-2">
                                  {msg.mediaUrl ? (
                                    <img 
                                      src={msg.mediaUrl} 
                                      alt={msg.caption || 'Imagen'} 
                                      className="rounded mb-1 w-full object-cover"
                                    />
                                  ) : (
                                    <div className="bg-gray-100 rounded flex items-center justify-center h-32 w-full">
                                      <MessageSquare size={30} className="text-gray-400" />
                                    </div>
                                  )}
                                  {msg.caption && <div className="text-xs mt-1">{msg.caption}</div>}
                                </div>
                              )}
                              
                              <MessageText 
                                text={msg.body} 
                                className="text-sm whitespace-pre-wrap break-words" 
                              />
                              
                              <div className="text-right mt-1 flex justify-end items-center gap-1">
                                <span className={`text-[10px] ${msg.fromMe ? 'text-green-100' : 'text-gray-500'}`}>
                                  {new Date(msg.timestamp * 1000).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                                
                                {msg.fromMe && (
                                  <CheckCheck size={14} className="text-green-100" />
                                )}
                              </div>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                    <MessageSquare className="h-10 w-10 text-gray-300 mb-2" />
                    <div className="text-gray-500 text-sm">No hay mensajes</div>
                    <div className="text-gray-400 text-xs mt-1">Envía un mensaje para iniciar la conversación</div>
                  </div>
                )}
              </div>
              
              {/* Área de entrada de mensaje */}
              <div className="border-t p-2 flex items-center gap-2">
                <Button variant="ghost" size="icon">
                  <Smile className="h-5 w-5 text-gray-500" />
                </Button>
                
                <Button variant="ghost" size="icon">
                  <Paperclip className="h-5 w-5 text-gray-500" />
                </Button>
                
                <Input
                  placeholder="Escribe un mensaje"
                  className="flex-1"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={messageMutation.isPending}
                />
                
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleSendMessage} 
                  disabled={!newMessage.trim() || messageMutation.isPending}
                  className={messageMutation.isPending ? 'opacity-50' : ''}
                >
                  {messageMutation.isPending ? (
                    <Spinner size="sm" />
                  ) : (
                    <Send className="h-5 w-5 text-green-600" />
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <MessageSquare className="h-16 w-16 text-gray-200 mb-4" />
              <h3 className="text-xl font-medium text-gray-700 mb-2">WhatsApp Messenger</h3>
              <p className="text-gray-500 max-w-md">
                Selecciona un chat para ver los mensajes o escanea el código QR para conectar WhatsApp si aún no lo has hecho.
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}