import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { WhatsAppQRCode } from './WhatsAppQRCode';
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
import { 
  UserCheck, 
  RefreshCw, 
  Trash, 
  Send, 
  Search, 
  X, 
  Settings, 
  MessageSquare, 
  Users,
  Bot, 
  Image as ImageIcon, 
  MoreVertical, 
  Wifi, 
  WifiOff,
  QrCode,
  Paperclip,
  Brain,
  Smile,
  CheckCheck,
  Image,
  FileText,
  Mic,
  Camera,
  Contact,
  File,
  UserPlus,
  User
} from 'lucide-react';
import ChatAssignmentDialog from './ChatAssignmentDialog';
import { MessageText } from '@/components/ui/message-text';
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
  // Estado para el agente asignado al chat actual
  const [assignedAgent, setAssignedAgent] = useState<{name: string, username: string} | null>(null);
  const [chatFilter, setChatFilter] = useState('');
  const [contactFilter, setContactFilter] = useState('');
  const [autoResponses, setAutoResponses] = useState<boolean>(false);
  const [showConfigMenu, setShowConfigMenu] = useState<boolean>(false);
  // Estado para controlar el diálogo de asignación de chat
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState<boolean>(false);
  // Estado para almacenar el ID de cuenta de WhatsApp actual (por defecto 1)
  const [currentAccountId, setCurrentAccountId] = useState<number>(1);
  // Estado para almacenar todas las cuentas de WhatsApp
  const [whatsappAccounts, setWhatsappAccounts] = useState<any[]>([]);
  
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

  // Query para obtener todas las cuentas de WhatsApp
  const {
    data: accountsData,
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

  // Actualizar el estado de las cuentas cuando se carguen
  useEffect(() => {
    if (accountsData && Array.isArray(accountsData)) {
      setWhatsappAccounts(accountsData);
    }
  }, [accountsData]);

  // Query para obtener el estado de WhatsApp para la cuenta actual
  const { 
    data: whatsappStatus,
    isLoading: isLoadingStatus
  } = useQuery({
    queryKey: ['/api/whatsapp-accounts', currentAccountId],
    queryFn: async () => {
      try {
        // Importar en línea apiRequest
        const { apiRequest } = await import('@/lib/queryClient');
        const response = await apiRequest(`/api/whatsapp-accounts/${currentAccountId}`);
        return {
          initialized: true,
          ready: true,
          authenticated: response.currentStatus?.authenticated || false
        };
      } catch (error) {
        console.error('Error obteniendo estado de WhatsApp:', error);
        return { initialized: false, ready: false, authenticated: false };
      }
    },
    refetchInterval: 5000
  });

  // Query para obtener chats reales de WhatsApp para la cuenta específica
  const { 
    data: whatsappChats = [],
    isLoading: isLoadingChats,
    refetch: refetchChats,
    error: chatError
  } = useQuery({
    queryKey: ['/api/whatsapp-accounts', currentAccountId, 'chats'],
    queryFn: async () => {
      try {
        if (!whatsappStatus?.authenticated) {
          return [];
        }
        // Importar en línea apiRequest
        const { apiRequest } = await import('@/lib/queryClient');
        
        try {
          const response = await apiRequest(`/api/whatsapp-accounts/${currentAccountId}/chats`);
          console.log("Respuesta de chats obtenida:", response);
          return response || [];
        } catch (apiError) {
          console.error('Error en solicitud API a /api/whatsapp-accounts:', apiError);
          
          // Intentar con el endpoint directo como fallback temporal
          const fallbackResponse = await apiRequest('/api/direct/whatsapp/chats');
          console.log("Respuesta de fallback obtenida:", fallbackResponse);
          return fallbackResponse || [];
        }
      } catch (error) {
        console.error('Error obteniendo chats de WhatsApp:', error);
        return [];
      }
    },
    refetchInterval: 15000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 3,
    enabled: !!whatsappStatus?.authenticated
  });

  // Query para obtener contactos de WhatsApp para la cuenta específica
  const {
    data: whatsappContacts = [],
    isLoading: isLoadingContacts,
  } = useQuery({
    queryKey: ['/api/whatsapp-accounts', currentAccountId, 'contacts'],
    queryFn: async () => {
      try {
        if (!whatsappStatus?.authenticated) {
          return [];
        }
        // Importar en línea apiRequest
        const { apiRequest } = await import('@/lib/queryClient');
        
        try {
          const response = await apiRequest(`/api/whatsapp-accounts/${currentAccountId}/contacts`);
          console.log("Respuesta de contactos obtenida:", response);
          return response || [];
        } catch (apiError) {
          console.error('Error en solicitud API a /api/whatsapp-accounts/contacts:', apiError);
          
          // Intentar con el endpoint directo como fallback temporal
          const fallbackResponse = await apiRequest('/api/direct/whatsapp/contacts');
          console.log("Respuesta de fallback para contactos obtenida:", fallbackResponse);
          return fallbackResponse || [];
        }
      } catch (error) {
        console.error('Error obteniendo contactos de WhatsApp:', error);
        return [];
      }
    },
    refetchInterval: 30000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    enabled: !!whatsappStatus?.authenticated
  });
  
  // Query para obtener la asignación del chat actual
  const {
    data: chatAssignment,
    isLoading: isLoadingAssignment,
    refetch: refetchAssignment
  } = useQuery({
    queryKey: ['/api/chat-assignments/by-chat', selectedChatId, currentAccountId],
    queryFn: async () => {
      if (!selectedChatId || !currentAccountId) return null;
      try {
        // Importar en línea apiRequest
        const { apiRequest } = await import('@/lib/queryClient');
        const response = await apiRequest(`/api/chat-assignments/by-chat?chatId=${selectedChatId}&accountId=${currentAccountId}`);
        return response;
      } catch (error) {
        // Si es error 404, significa que no hay asignación
        if ((error as any)?.status === 404) {
          return null;
        }
        console.error('Error obteniendo asignación de chat:', error);
        return null;
      }
    },
    enabled: !!selectedChatId && !!currentAccountId
  });
  
  // Actualizar información del agente asignado cuando cambia la asignación
  useEffect(() => {
    if (chatAssignment && chatAssignment.assignedTo) {
      setAssignedAgent({
        name: chatAssignment.assignedTo.fullName,
        username: chatAssignment.assignedTo.username
      });
    } else {
      setAssignedAgent(null);
    }
  }, [chatAssignment]);
  
  // Ya tenemos una consulta para la asignación del chat actual arriba,
  // así que eliminamos esta duplicada

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
    
  // Filtrar contactos por nombre o número
  const filteredContacts = Array.isArray(whatsappContacts) && whatsappContacts.length > 0
    ? whatsappContacts.filter(contact => {
        if (!contactFilter) return true;
        
        const searchTermLower = contactFilter.toLowerCase();
        return (
          (contact.name && contact.name.toLowerCase().includes(searchTermLower)) || 
          (contact.number && contact.number.toLowerCase().includes(searchTermLower))
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
      // Obtener el historial de mensajes para contexto
      const chatHistory = chatContext.getHistoryForGemini(selectedChatId);
      
      // Generar respuesta usando la configuración del chat seleccionado
      const response = await generateAutoResponse(message.body, selectedChatId, chatHistory);
      
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
      <CardHeader className="p-3 border-b bg-gradient-to-r from-purple-300 via-pink-200 to-green-300">
        <div className="flex items-center justify-between">
          <div className="pl-2">
            <CardTitle className="text-xl font-semibold flex items-center gap-2 text-purple-800">
              <MessageSquare className="h-6 w-6 text-purple-700" />
              GeminiCRM WhatsApp
              {connectionStatus === 'Connected' && (
                <Wifi className="h-5 w-5 text-green-600" />
              )}
              {connectionStatus !== 'Connected' && (
                <WifiOff className="h-5 w-5 text-red-600 animate-pulse" />
              )}
            </CardTitle>
            
            {/* Añadimos un estado visible */}
            <div className="ml-8 mt-1 text-xs font-medium text-gray-700">
              {whatsappStatus?.authenticated ? 
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 bg-green-500 rounded-full"></span>
                  Conectado y listo para usar
                </span> : 
                <span className="flex items-center gap-1 text-red-600">
                  <span className="h-2 w-2 bg-red-500 rounded-full animate-pulse"></span>
                  <strong>Desconectado</strong> - Se requiere autenticación
                </span>
              }
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isLoadingStatus ? (
              <Spinner size="sm" />
            ) : whatsappStatus?.authenticated ? (
              <Badge variant="outline" className="bg-green-100/70 text-green-800 border-green-300 font-medium">
                Conectado
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-red-100/70 text-red-800 border-red-300 font-medium animate-pulse">
                No conectado
              </Badge>
            )}
            
            {/* Mostrar estado de asignación si hay un chat seleccionado */}
            {selectedChatId && assignedAgent && (
              <Badge variant="outline" className="bg-purple-100/70 text-purple-800 border-purple-300 font-medium">
                <User className="h-3 w-3 mr-1" />
                {assignedAgent.name}
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
                  
                  {/* Botón para asignar chat a agente */}
                  {selectedChatId && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-start bg-purple-50 hover:bg-purple-100 border-purple-200"
                      onClick={() => setAssignmentDialogOpen(true)}
                    >
                      <UserPlus className="mr-1 h-4 w-4 text-purple-600" />
                      {assignedAgent ? 'Reasignar chat' : 'Asignar a agente'}
                    </Button>
                  )}
                  
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
                  
                  {/* Botón para asignar agente */}
                  {selectedChatId && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-start mb-2"
                      onClick={() => setAssignmentDialogOpen(true)}
                    >
                      <UserCheck className="mr-2 h-4 w-4" />
                      Asignar a agente
                    </Button>
                  )}
                  
                  {/* Diálogo de asignación */}
                  {selectedChatId && (
                    <ChatAssignmentDialog
                      open={assignmentDialogOpen}
                      onOpenChange={setAssignmentDialogOpen}
                      chatId={selectedChatId}
                      accountId={currentAccountId}
                    />
                  )}
                  
                  {/* Botón de actualizar */}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={() => {
                      refetchChats();
                      refetchMessages();
                      if (selectedChatId) {
                        refetchAssignment();
                      }
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
              {/* Selector de cuentas WhatsApp */}
              <div className="mb-2">
                <select 
                  className="w-full rounded-md border border-gray-300 py-1 px-2 text-sm"
                  value={currentAccountId}
                  onChange={(e) => setCurrentAccountId(Number(e.target.value))}
                  disabled={isLoadingAccounts || !Array.isArray(whatsappAccounts) || whatsappAccounts.length === 0}
                >
                  {isLoadingAccounts ? (
                    <option>Cargando cuentas...</option>
                  ) : whatsappAccounts.length === 0 ? (
                    <option>No hay cuentas disponibles</option>
                  ) : (
                    whatsappAccounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name} {account.currentStatus?.authenticated ? '✓' : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

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
              {/* Lista de chats - Verificación explícita */}
              {activeTab === 'chats' && (
                <ScrollArea className="h-[calc(100vh-320px)]">
                  {isLoadingChats ? (
                    <div className="flex justify-center p-4">
                      <Spinner />
                    </div>
                  ) : !whatsappStatus?.authenticated ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 bg-gray-50 rounded-lg">
                      <div className="text-center mb-6">
                        <h3 className="text-xl font-semibold text-gray-800 mb-2">WhatsApp no conectado</h3>
                        <p className="text-gray-600 mb-4">Para ver tus chats y mensajes, necesitas conectar WhatsApp escaneando el código QR.</p>
                      </div>
                      
                      {/* Usamos el componente importado */}
                      <div className="mt-4">
                        <div className="flex items-center justify-center">
                          <WhatsAppQRCode accountId={currentAccountId} />
                        </div>
                      </div>
                      
                      <div className="mt-4 text-center text-sm text-gray-500">
                        <p>También puedes ir a la página de cuentas para administrar múltiples conexiones de WhatsApp.</p>
                      </div>
                    </div>
                  ) : whatsappChats ? (
                    <div className="divide-y">
                      {/* Mostramos un mensaje de depuración antes del mapeo */}
                      <div className="p-3 text-sm text-gray-500">
                        Chats disponibles: {whatsappChats.length}
                      </div>
                      
                      {/* Mapeo de chats con protección de errores */}
                      {whatsappChats.map((chat: any) => (
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
              <div className="relative mb-2 p-2 border-b">
                <Search className="absolute left-4 top-4.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar contacto por nombre o número..."
                  className="pl-8 h-9"
                  value={contactFilter}
                  onChange={(e) => setContactFilter(e.target.value)}
                />
              </div>
              
              <div className="flex-1 overflow-auto" style={{ height: 'calc(100vh - 180px)' }}>
                {isLoadingContacts ? (
                  <div className="flex justify-center p-4">
                    <Spinner />
                  </div>
                ) : Array.isArray(whatsappContacts) && whatsappContacts.length > 0 ? (
                  <div className="divide-y">
                    <div className="p-3 text-sm text-gray-500 sticky top-0 bg-white z-10 border-b">
                      Contactos disponibles: {filteredContacts.length}
                    </div>
                    
                    <div className="overflow-auto contact-list">
                      {filteredContacts.map((contact: any) => (
                        <div
                          key={contact.id}
                          className="p-3 hover:bg-gray-50 cursor-pointer border-b"
                          onClick={() => {
                            // Cambiar a la pestaña de chats y seleccionar este contacto
                            setActiveTab("chats");
                            setSelectedChatId(contact.id);
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-11 w-11 flex-shrink-0 border shadow-sm">
                              {contact.profilePicUrl ? (
                                <AvatarImage src={contact.profilePicUrl} alt={contact.name} />
                              ) : null}
                              <AvatarFallback className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
                                {getInitials(contact.name)}
                              </AvatarFallback>
                            </Avatar>
                            
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <div className="flex items-center gap-1">
                                <span className="font-medium truncate">{contact.name}</span>
                                {contact.isGroup && (
                                  <Badge variant="outline" className="text-[10px] h-4 px-1 bg-blue-50 text-blue-700 border-blue-200">
                                    Grupo
                                  </Badge>
                                )}
                                {!contact.isGroup && (
                                  <Badge variant="outline" className="text-[10px] h-4 px-1 bg-purple-50 text-purple-700 border-purple-200">
                                    Contacto
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="flex justify-between items-center text-sm text-gray-500">
                                <p className="truncate w-36">
                                  {contact.number || 'Sin número'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    <div className="mb-2">No hay contactos disponibles</div>
                    <div className="text-xs">
                      Se ha establecido conexión con WhatsApp, pero no se encontraron contactos.
                    </div>
                  </div>
                )}
              </div>
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
                    {currentChat.id.includes('@g.us') ? 'Grupo' : 
                      assignedAgent ? (
                        <Badge variant="outline" className="text-[10px] h-5 px-1 bg-indigo-50 text-indigo-700 border-indigo-200 flex items-center">
                          <UserCheck className="mr-1 h-3 w-3" />
                          Asignado a: {assignedAgent.name}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] h-5 px-1 bg-amber-50 text-amber-700 border-amber-200">
                          Chat sin asignar
                        </Badge>
                      )
                    }
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
      
      {/* Diálogo de asignación de chat */}
      {selectedChatId && (
        <ChatAssignmentDialog
          open={assignmentDialogOpen}
          onOpenChange={setAssignmentDialogOpen}
          chatId={selectedChatId}
          accountId={currentAccountId}
        />
      )}
    </Card>
  );
}