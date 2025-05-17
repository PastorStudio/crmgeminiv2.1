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

export function WhatsAppSimple({ selectedLeadId, onSelectLead }: WhatsAppInterfaceProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [messageText, setMessageText] = useState('');
  const [activeTab, setActiveTab] = useState('chats');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [autoResponsesEnabled, setAutoResponsesEnabled] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentOptions, setShowAttachmentOptions] = useState(false);
  const [showGeminiDialog, setShowGeminiDialog] = useState(false);
  const [showGeminiConfigDialog, setShowGeminiConfigDialog] = useState(false);
  const [lastMessageCount, setLastMessageCount] = useState(0);
  const [newMessagesReceived, setNewMessagesReceived] = useState(false);
  const [processingAutoResponse, setProcessingAutoResponse] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSeenMessagesRef = useRef<{[chatId: string]: number}>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Configurar WebSocket para mensajes en tiempo real
  const { isConnected: isWsConnected, lastMessage: wsLastMessage } = useWebSocket({
    onNotification: (notification) => {
      console.log('Notificación WebSocket recibida:', notification);

      // Si es una notificación de nuevo mensaje y tenemos un chat seleccionado
      if (notification.type === NotificationType.NEW_MESSAGE && 
          notification.data.chatId === selectedChatId) {
        // Invalidar las consultas para actualizar los datos
        queryClient.invalidateQueries({ queryKey: ['whatsapp-messages-direct', selectedChatId] });
        queryClient.invalidateQueries({ queryKey: ['whatsapp-chats-direct'] });
        
        // Marcar que hay nuevos mensajes
        setNewMessagesReceived(true);
      }
    },
    onConnect: () => {
      toast({
        title: "Conexión establecida",
        description: "Conectado al servidor de mensajería en tiempo real",
        duration: 3000
      });
    },
    onDisconnect: () => {
      console.log('Desconectado del WebSocket');
    }
  });

  // Estado de WhatsApp
  const { data: whatsappStatus, isLoading: isLoadingWhatsappStatus } = useQuery({
    queryKey: ['whatsapp-status-direct'],
    queryFn: async () => {
      try {
        const timestamp = Date.now();
        const response = await fetch(`/api/direct/whatsapp/status?t=${timestamp}`);
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        return await response.json();
      } catch (error) {
        console.error('Error obteniendo estado de WhatsApp:', error);
        return { authenticated: false };
      }
    },
    // Reducir la frecuencia de polling si el WebSocket está conectado
    refetchInterval: isWsConnected ? 10000 : 5000
  });
  
  // Consulta para chats
  const { data: whatsappChatsResponse, isLoading: isLoadingChats } = useQuery({
    queryKey: ['whatsapp-chats-direct'],
    queryFn: async () => {
      try {
        const timestamp = Date.now();
        const response = await fetch(`/api/direct/whatsapp/chats?t=${timestamp}`);
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        const data = await response.json();
        
        // El nuevo formato incluye chats y status
        if (data && typeof data === 'object' && data.chats) {
          // Actualizar el estado de WhatsApp si viene en la respuesta
          if (data.status) {
            // El queryClient actualizará automáticamente el estado en la siguiente consulta
            queryClient.setQueryData(['whatsapp-status-direct'], data.status);
          }
          
          return {
            chats: Array.isArray(data.chats) ? data.chats : [],
            status: data.status
          };
        }
        
        // Compatibilidad con formato anterior (solo array de chats)
        return {
          chats: Array.isArray(data) ? data : [],
          status: null
        };
      } catch (error) {
        console.error('Error obteniendo chats:', error);
        return { chats: [], status: null };
      }
    },
    // Siempre habilitado para intentar recuperar la conexión
    enabled: true,
    // Reducimos la frecuencia con WebSocket conectado
    staleTime: isWsConnected ? 60000 : 30000, // 1 minuto o 30 segundos dependiendo de la conexión
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 3,
    refetchInterval: isWsConnected ? 10000 : 5000 // Siempre intentamos obtener los chats
  });
  
  // Extraer los chats del nuevo formato de respuesta
  const whatsappChats = whatsappChatsResponse?.chats || [];
  
  // Consulta para mensajes
  const { 
    data: whatsappMessagesResponse, 
    isLoading: isLoadingWhatsappMessages 
  } = useQuery({
    queryKey: ['whatsapp-messages-direct', selectedChatId],
    queryFn: async () => {
      if (!selectedChatId) return { messages: [], count: 0, chatId: null };
      try {
        const timestamp = Date.now();
        // Solicitamos explícitamente 1000 mensajes para asegurar que se carguen todos los disponibles
        const response = await fetch(`/api/direct/whatsapp/messages/${selectedChatId}?t=${timestamp}&limit=1000`);
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        const data = await response.json();
        
        // Formato nuevo con campo messages y metadatos
        if (data && typeof data === 'object' && data.messages) {
          return {
            messages: Array.isArray(data.messages) ? data.messages : [],
            count: data.count || 0,
            chatId: data.chatId || selectedChatId,
            timestamp: data.timestamp
          };
        }
        
        // Compatibilidad con formato anterior (array directo)
        return {
          messages: Array.isArray(data) ? data : [],
          count: Array.isArray(data) ? data.length : 0,
          chatId: selectedChatId,
          timestamp: Date.now()
        };
      } catch (error) {
        console.error('Error obteniendo mensajes:', error);
        return { 
          messages: [], 
          count: 0, 
          chatId: selectedChatId,
          error: true
        };
      }
    },
    // Siempre intentamos cargar mensajes si hay un chat seleccionado
    enabled: !!selectedChatId,
    // Con WebSocket, podemos reducir la frecuencia pero seguimos actualizando
    refetchInterval: selectedChatId ? 
      (isWsConnected ? 8000 : 3000) : false,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 2
  });
  
  // Extraer los mensajes del nuevo formato de respuesta
  const whatsappMessages = whatsappMessagesResponse?.messages || [];
  
  // Seleccionar el primer chat al cargar
  useEffect(() => {
    if (Array.isArray(whatsappChats) && whatsappChats.length > 0 && !selectedChatId && whatsappStatus?.authenticated) {
      // Ordenar por más reciente
      const sortedChats = [...whatsappChats].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setSelectedChatId(sortedChats[0].id);
    }
  }, [whatsappChats, selectedChatId, whatsappStatus]);
  
  // Scroll al último mensaje
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [whatsappMessages]);
  
  // Detectar nuevos mensajes y procesar respuestas automáticas
  useEffect(() => {
    if (Array.isArray(whatsappMessages) && whatsappMessages.length > 0 && selectedChatId) {
      // Siempre actualizar contador para evitar problemas de detección
      setLastMessageCount(whatsappMessages.length);
      
      // Buscar mensajes no procesados
      const sortedMessages = [...whatsappMessages].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      const lastIncomingMessage = sortedMessages.find(msg => !msg.fromMe);
      
      // Procesar respuesta automática si está habilitada
      if (autoResponsesEnabled && 
          !processingAutoResponse && 
          lastIncomingMessage && 
          lastIncomingMessage.body.trim() !== '') {
          
        console.log('Procesando respuesta automática para mensaje:', lastIncomingMessage.body);
        
        // Usar setTimeout para evitar múltiples respuestas
        setTimeout(() => {
          handleAutoResponse(lastIncomingMessage);
        }, 1000);
      }
    }
  }, [whatsappMessages, selectedChatId, autoResponsesEnabled]);

  // Mutación para enviar mensaje
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!selectedChatId) throw new Error('No hay chat seleccionado');
      
      const response = await fetch('/api/direct/whatsapp/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedChatId,
          message: message
        })
      });
      
      if (!response.ok) throw new Error('Error enviando mensaje');
      return await response.json();
    },
    onSuccess: () => {
      setMessageText('');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages-direct', selectedChatId] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje",
        variant: "destructive"
      });
    }
  });

  // Manejar envío de mensaje
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;
    sendMessageMutation.mutate(messageText);
  };

  // Manejar selección de chat
  const handleChatSelect = (chat: WhatsAppChat) => {
    setSelectedChatId(chat.id);
  };
  
  // Función para generar y enviar respuestas automáticas con Gemini
  const handleAutoResponse = async (message: WhatsAppMessage) => {
    if (!selectedChatId || !message.body || processingAutoResponse) return;
    
    try {
      // Marcar que estamos procesando una respuesta automática
      setProcessingAutoResponse(true);
      
      // Añadir el mensaje del usuario al contexto de la conversación
      chatContext.addMessage(selectedChatId, 'user', message.body);
      
      // Obtener el historial de la conversación para este chat
      const conversationHistory = chatContext.getHistoryForGemini(selectedChatId, 10);
      
      // Obtener el prompt personalizado si existe
      const customPrompt = chatContext.getCustomPrompt(selectedChatId);
      
      console.log('Generando respuesta con historial de', conversationHistory.length, 'mensajes');
      
      // Generar respuesta con Gemini usando el contexto de la conversación
      const response = await generateAutoResponse(message.body, conversationHistory, customPrompt);
      
      if (response && response.trim() !== '') {
        // Guardar la respuesta del asistente en el contexto
        chatContext.addMessage(selectedChatId, 'assistant', response);
        
        // Enviar la respuesta generada
        sendMessageMutation.mutate(response);
        
        // Notificar al usuario
        toast({
          title: "Respuesta automática",
          description: "Gemini AI ha respondido automáticamente al mensaje",
          duration: 3000
        });
      }
    } catch (error) {
      console.error("Error al generar respuesta automática:", error);
      toast({
        title: "Error en respuesta automática",
        description: "No se pudo generar una respuesta con Gemini AI",
        variant: "destructive"
      });
    } finally {
      // Marcar que ya no estamos procesando
      setProcessingAutoResponse(false);
    }
  };

  // Obtener iniciales para avatar
  const getInitials = (name: string | undefined) => {
    if (!name) return 'UN';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Formatear timestamp
  const formatTime = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    const now = new Date();
    
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString();
    }
  };

  // Encontrar el chat actual
  const currentChat = selectedChatId 
    ? whatsappChats.find((chat: WhatsAppChat) => chat.id === selectedChatId) 
    : null;

  return (
    <Card className="h-full flex flex-col shadow-md w-full border-0 rounded-none">
      <CardHeader className="p-3 pb-0">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-green-500 text-white text-xs">
                WA
              </AvatarFallback>
            </Avatar>
            <span>WhatsApp</span>
          </div>
          
          <div className="flex items-center gap-1">
            {isLoadingWhatsappStatus ? (
              <Badge variant="outline" className="flex items-center gap-1 h-6">
                <Spinner className="h-3 w-3" />
                <span>Cargando...</span>
              </Badge>
            ) : whatsappStatus?.authenticated ? (
              <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700 h-6">Conectado</Badge>
            ) : (
              <Badge variant="outline" className="h-6">Desconectado</Badge>
            )}
            
            {/* Indicador de WebSocket */}
            <Badge 
              variant="outline" 
              className={`flex items-center gap-1 h-6 ${
                isWsConnected 
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "bg-gray-50 border-gray-200 text-gray-500"
              }`}
            >
              {isWsConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
              <span className="text-xs">
                {isWsConnected ? "Tiempo real" : "Sincronización manual"}
              </span>
            </Badge>
            
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['whatsapp-status-direct'] });
                queryClient.invalidateQueries({ queryKey: ['whatsapp-chats-direct'] });
                if (selectedChatId) {
                  queryClient.invalidateQueries({ queryKey: ['whatsapp-messages-direct', selectedChatId] });
                }
              }}
            >
              <RefreshCw size={14} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      
      {/* Contenedor principal de dos columnas */}
      <div className="flex-1 flex overflow-hidden h-[calc(100vh-10rem)]">
        {/* Columna izquierda - Lista de chats */}
        <div className="w-1/4 border-r flex flex-col overflow-hidden">
          <div className="p-3">
            <div className="rounded-lg border mb-3">
              <div className="flex items-center p-2">
                <Search className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar chats..."
                  className="border-0 p-0 h-6 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            </div>
            
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="w-full mb-3">
                <TabsTrigger value="chats" className="flex-1">Chats</TabsTrigger>
                <TabsTrigger value="contacts" className="flex-1">Contactos</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          {/* Lista de chats */}
          {activeTab === 'chats' && (
            <ScrollArea className="flex-1">
              {isLoadingChats ? (
                <div className="flex justify-center p-4">
                  <Spinner />
                </div>
              ) : !whatsappStatus?.authenticated ? (
                <div className="flex flex-col items-center justify-center p-4 h-full">
                  <div className="text-sm text-gray-500 text-center mb-3">
                    Escanea el código QR para ver tus chats de WhatsApp
                  </div>
                </div>
              ) : Array.isArray(whatsappChats) && whatsappChats.length > 0 ? (
                <div className="divide-y">
                  {whatsappChats.map((chat: WhatsAppChat) => (
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
              <div className="p-4 text-center text-gray-500 text-sm">
                Lista de contactos en desarrollo
              </div>
            </ScrollArea>
          )}
        </div>
        
        {/* Columna derecha - Área de mensajes */}
        <div className="w-3/4 flex flex-col overflow-hidden h-[calc(100vh-10rem)]">
          {!whatsappStatus?.authenticated ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="text-center mb-6">
                <div className="text-xl font-bold mb-2">Conectar WhatsApp</div>
                <div className="text-gray-500 mb-4">
                  Escanea el código QR con tu WhatsApp para iniciar sesión.
                </div>
              </div>
              {whatsappStatus?.qrDataUrl && (
                <div className="mb-6 border p-3 rounded-lg bg-white">
                  <img src={whatsappStatus.qrDataUrl} alt="WhatsApp QR Code" width={200} height={200} />
                </div>
              )}
            </div>
          ) : !selectedChatId ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-gray-400 mb-2">
                  <MessageSquare size={64} strokeWidth={1} className="mx-auto" />
                </div>
                <div className="text-xl font-bold mb-2">Mensajería de WhatsApp</div>
                <div className="text-gray-500">
                  Selecciona un chat para comenzar a enviar mensajes.
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Cabecera del chat */}
              <div className="border-b p-2 flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  {currentChat?.profilePicUrl ? (
                    <AvatarImage src={currentChat.profilePicUrl} alt={currentChat.name} />
                  ) : null}
                  <AvatarFallback className="bg-green-500 text-white text-xs">
                    {getInitials(currentChat?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{currentChat?.name || 'Chat'}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {currentChat?.isGroup ? 'Grupo' : 'Contacto'}
                  </div>
                </div>
                <div className="flex gap-1">
                  {/* Botón de Agente IA */}
                  <Dialog open={showGeminiDialog} onOpenChange={setShowGeminiDialog}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Brain size={16} className={showGeminiDialog ? "text-primary" : ""} />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Asistente de Inteligencia Artificial</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <p className="text-sm text-gray-600">
                            El asistente IA de Gemini puede generar mensajes, analizar conversaciones y ayudarte a gestionar tus comunicaciones de manera más eficiente.
                          </p>
                        </div>
                        <div className="flex flex-col space-y-1.5">
                          <Button onClick={() => {
                            setMessageText("Hola, soy el asistente IA de Gemini. ¿En qué puedo ayudarte hoy?");
                            setShowGeminiDialog(false);
                          }}>
                            Generar mensaje de bienvenida
                          </Button>
                          
                          {selectedChatId && (
                            <Button 
                              variant="outline" 
                              onClick={() => {
                                setShowGeminiDialog(false);
                                setShowGeminiConfigDialog(true);
                              }}
                              className="mt-2"
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Configurar prompts y respuestas
                            </Button>
                          )}
                          
                          <div className="mt-4 p-3 bg-gray-50 rounded-md">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Bot className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium">Respuestas automáticas</span>
                              </div>
                              <Switch
                                checked={autoResponsesEnabled}
                                onCheckedChange={setAutoResponsesEnabled}
                                aria-label="Activar respuestas automáticas"
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              Cuando está activado, Gemini AI responderá automáticamente a los mensajes entrantes
                            </p>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  {/* Diálogo de configuración avanzada de Gemini */}
                  {selectedChatId && (
                    <GeminiConfig 
                      chatId={selectedChatId} 
                      isOpen={showGeminiConfigDialog} 
                      onClose={() => setShowGeminiConfigDialog(false)} 
                    />
                  )}
                  
                  {/* Indicador de estado IA */}
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md text-xs">
                    <Bot size={14} className={autoResponsesEnabled ? "text-green-500" : "text-gray-400"} />
                    <span className={autoResponsesEnabled ? "text-green-500" : "text-gray-400"}>
                      {autoResponsesEnabled ? "IA Activa" : "IA Inactiva"}
                    </span>
                  </div>
                  
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical size={16} />
                  </Button>
                </div>
              </div>
              
              {/* Área de mensajes */}
              <div className="flex-1 overflow-auto flex flex-col items-center">
                {isLoadingWhatsappMessages ? (
                  <div className="flex justify-center items-center h-full w-full">
                    <div className="text-center">
                      <Spinner className="mx-auto mb-3" />
                      <p className="text-sm text-gray-500">Cargando mensajes...</p>
                    </div>
                  </div>
                ) : whatsappMessages.length > 0 ? (
                  <div className="space-y-2 py-4 w-full max-w-4xl px-4 flex-grow">
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
                  <div className="flex flex-col items-center justify-center h-full w-full">
                    <div className="p-4 rounded-full bg-gray-50 mb-4">
                      <MessageSquare size={35} className="text-gray-300" />
                    </div>
                    <p className="text-base font-medium text-gray-600 mb-1">No hay mensajes</p>
                    <p className="text-sm text-gray-500 text-center">
                      Envía tu primer mensaje para iniciar la conversación
                    </p>
                  </div>
                )}
              </div>
              
              {/* Área de escritura de mensajes */}
              <div className="border-t p-2">
                <form onSubmit={handleSendMessage} className="flex items-end gap-2">
                  <div className="flex-1 rounded-lg bg-background border">
                    <div className="flex items-end p-2 gap-1">
                      {/* Botón de emoji con popover */}
                      <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                        <PopoverTrigger asChild>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 flex-shrink-0"
                          >
                            <Smile size={18} className={showEmojiPicker ? "text-primary" : ""} />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2" align="start">
                          <div className="grid grid-cols-7 gap-2">
                            {["😊", "👍", "❤️", "😂", "🎉", "👏", "🙏", 
                              "😍", "😎", "🤔", "👌", "💪", "🔥", "👋",
                              "🤗", "😉", "🤝", "💯", "✅", "⭐", "🌟"].map(emoji => (
                              <Button 
                                key={emoji} 
                                variant="ghost" 
                                className="h-8 w-8 p-0 hover:bg-gray-100"
                                onClick={() => {
                                  setMessageText(prev => prev + emoji);
                                  setShowEmojiPicker(false);
                                }}
                              >
                                {emoji}
                              </Button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      
                      <Input
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="Escribe un mensaje..."
                        className="border-0 flex-1 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                      
                      {/* Botón de adjuntos con popover */}
                      <Popover open={showAttachmentOptions} onOpenChange={setShowAttachmentOptions}>
                        <PopoverTrigger asChild>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 flex-shrink-0"
                          >
                            <Paperclip size={18} className={showAttachmentOptions ? "text-primary" : ""} />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-52 p-2" align="end">
                          <div className="grid grid-cols-2 gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="justify-start gap-2"
                              onClick={() => {
                                toast({
                                  title: "Adjunto de foto",
                                  description: "Esta función está en desarrollo"
                                });
                                setShowAttachmentOptions(false);
                              }}
                            >
                              <Image size={14} />
                              <span>Foto</span>
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="justify-start gap-2"
                              onClick={() => {
                                toast({
                                  title: "Adjunto de documento",
                                  description: "Esta función está en desarrollo"
                                });
                                setShowAttachmentOptions(false);
                              }}
                            >
                              <FileText size={14} />
                              <span>Documento</span>
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="justify-start gap-2"
                              onClick={() => {
                                toast({
                                  title: "Adjunto de audio",
                                  description: "Esta función está en desarrollo"
                                });
                                setShowAttachmentOptions(false);
                              }}
                            >
                              <Mic size={14} />
                              <span>Audio</span>
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="justify-start gap-2"
                              onClick={() => {
                                toast({
                                  title: "Adjunto de contacto",
                                  description: "Esta función está en desarrollo"
                                });
                                setShowAttachmentOptions(false);
                              }}
                            >
                              <Contact size={14} />
                              <span>Contacto</span>
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  
                  <Button 
                    type="submit" 
                    size="icon" 
                    className="h-9 w-9 rounded-full flex-shrink-0" 
                    disabled={!messageText.trim() || sendMessageMutation.isPending}
                  >
                    {sendMessageMutation.isPending ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <Send size={16} />
                    )}
                  </Button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}