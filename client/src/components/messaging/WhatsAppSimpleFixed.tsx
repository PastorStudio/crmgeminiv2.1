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
import MessagesLoader from '@/components/messaging/MessagesLoader';
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
  User,
  Maximize,
  Download,
  Video,
  Play
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
  accountId?: number;
  accountName?: string;
}

interface WhatsAppMessage {
  id: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  hasMedia: boolean;
  mediaUrl?: string;
  caption?: string;
  mimetype?: string;
  filename?: string;
}

interface WhatsAppInterfaceProps {
  selectedLeadId?: number;
  onSelectLead?: (leadId: number) => void;
}

// Componente principal
export function WhatsAppSimpleFixed({ selectedLeadId, onSelectLead }: WhatsAppInterfaceProps) {
  // Sistema de notificaciones toast y acceso a React Query
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
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
  // Estados para previsualización de archivos multimedia
  const [isMediaPreviewOpen, setIsMediaPreviewOpen] = useState(false);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState('');
  const [mediaCaption, setMediaCaption] = useState('');
  const [mediaType, setMediaType] = useState('image/jpeg');
  // Estados para la vista "Todas las cuentas"
  const [isViewingAllAccounts, setIsViewingAllAccounts] = useState(false);
  const [combinedChats, setCombinedChats] = useState<WhatsAppChat[]>([]);
  const [authenticatedAccounts, setAuthenticatedAccounts] = useState<any[]>([]);
  // Estado para la configuración de Gemini
  const [showGeminiConfig, setShowGeminiConfig] = useState(false);
  const [selectedChatForGemini, setSelectedChatForGemini] = useState<string | null>(null);
  // Estado para almacenar mensajes
  const [messagesState, setMessagesState] = useState<WhatsAppMessage[]>([]);
  
  // Refs para scroll automático
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Hook para WebSockets
  const { 
    sendMessage: sendWSMessage, 
    lastMessage, 
    connectionStatus 
  } = useWebSocket();
  
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

  // Actualizar estado de cuentas cuando se carguen
  useEffect(() => {
    if (accountsData && Array.isArray(accountsData)) {
      setWhatsappAccounts(accountsData);
    }
  }, [accountsData]);

  // Query para obtener estado de WhatsApp
  const {
    data: whatsappStatus,
    refetch: refetchStatus
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

  // Usar un mock parcial desde storage si falla la obtención en vivo
  const {
    data: whatsappContacts,
    isLoading: isLoadingContacts
  } = useQuery({
    queryKey: ['/api/whatsapp-accounts', currentAccountId, 'contacts'],
    queryFn: async () => {
      try {
        const { apiRequest } = await import('@/lib/queryClient');
        const response = await apiRequest(`/api/whatsapp-accounts/${currentAccountId}/contacts`);
        if (Array.isArray(response)) {
          return response;
        }
        throw new Error('Respuesta de contactos no es un array');
      } catch (error) {
        console.error('Error obteniendo contactos de WhatsApp:', error);
        return [];
      }
    },
    enabled: !!whatsappStatus?.authenticated && !isViewingAllAccounts && !!currentAccountId
  });
  
  // Filtrar contactos según el texto de búsqueda
  const filteredContacts = React.useMemo(() => {
    if (!whatsappContacts || !Array.isArray(whatsappContacts)) return [];
    
    if (!contactFilter) return whatsappContacts;
    
    const lowerFilter = contactFilter.toLowerCase();
    return whatsappContacts.filter(contact => {
      const name = (contact.name || '').toLowerCase();
      const number = (contact.number || '').toLowerCase();
      return name.includes(lowerFilter) || number.includes(lowerFilter);
    });
  }, [whatsappContacts, contactFilter]);

  // Lista de chats para la cuenta seleccionada
  const {
    data: whatsappChats,
    isLoading: isLoadingChats,
    refetch: refetchChats
  } = useQuery({
    queryKey: ['/api/whatsapp-accounts', currentAccountId, 'chats'],
    queryFn: async () => {
      try {
        // Intentar cargar desde caché primero
        const cachedData = localStorage.getItem(`whatsapp_chats_${currentAccountId}`);
        const initialData = cachedData ? JSON.parse(cachedData) : [];
        
        const { apiRequest } = await import('@/lib/queryClient');
        try {
          // Intentar cargar desde la API específica de la cuenta
          const response = await apiRequest(`/api/whatsapp-accounts/${currentAccountId}/chats`);
          
          if (Array.isArray(response) && response.length > 0) {
            console.log(`${response.length} chats obtenidos para cuenta ${currentAccountId}`);
            // Guardar en caché
            localStorage.setItem(`whatsapp_chats_${currentAccountId}`, JSON.stringify(response));
            return response;
          }
        } catch (apiError) {
          console.error(`Error en API específica de cuenta ${currentAccountId}:`, apiError);
        }
        
        // Si no hay respuesta o hay error, intentar con el endpoint directo
        try {
          const fallbackResponse = await apiRequest('/api/direct/whatsapp/chats');
          
          if (Array.isArray(fallbackResponse) && fallbackResponse.length > 0) {
            console.log(`Usando fallback: ${fallbackResponse.length} chats obtenidos`);
            // Guardar estos datos también en caché
            localStorage.setItem(`whatsapp_chats_${currentAccountId}`, JSON.stringify(fallbackResponse));
            return fallbackResponse;
          }
        } catch (fallbackError) {
          console.error('Error en fallback de chats:', fallbackError);
        }
        
        // Si todo falla, devolver la cache o un array vacío
        return initialData.length > 0 ? initialData : [];
      } catch (error) {
        console.error(`Error obteniendo chats de WhatsApp para cuenta ${currentAccountId}:`, error);
        return [];
      }
    },
    refetchInterval: 60000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 1,
    retryDelay: 10000,
    enabled: !!whatsappStatus?.authenticated && !isViewingAllAccounts && !!currentAccountId
  });
  
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

  // Mutation para enviar mensajes
  const messageMutation = useMutation({
    mutationFn: async (data: { chatId: string; message: string }) => {
      try {
        const { apiRequest } = await import('@/lib/queryClient');
        return await apiRequest('/api/direct/whatsapp/send', {
          method: 'POST',
          body: JSON.stringify(data)
        });
      } catch (error) {
        throw error;
      }
    },
    onSuccess: () => {
      // Limpiar campo de mensaje
      setNewMessage('');
      
      // Recargar mensajes después de un breve retraso
      setTimeout(() => {
        if (selectedChatId) {
          refetchMessages();
        }
      }, 1000);
    },
    onError: (error) => {
      console.error('Error enviando mensaje:', error);
      toast({
        title: 'Error al enviar mensaje',
        description: 'No se pudo enviar el mensaje. Intente nuevamente.',
        variant: 'destructive'
      });
    }
  });

  // Función para manejar el envío de mensajes
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChatId) return;
    
    // Crear un mensaje temporal optimista
    const tempMessage: WhatsAppMessage = {
      id: `temp_${Date.now()}`,
      body: newMessage,
      fromMe: true,
      timestamp: Date.now() / 1000,
      hasMedia: false
    };
    
    // Actualizar la UI con el mensaje optimista
    setMessagesState(prev => [...prev, tempMessage]);
    
    // Enviar a WebSocket para notificar a otros clientes
    sendWSMessage({
      type: NotificationType.MESSAGE_SENT,
      payload: {
        chatId: selectedChatId,
        message: tempMessage
      }
    });
    
    // Intentar enviar el mensaje
    messageMutation.mutate({
      chatId: selectedChatId,
      message: newMessage
    });
  };

  // Función para manejar la generación de respuestas automáticas
  const handleAutoResponse = async (message: WhatsAppMessage) => {
    if (!selectedChatId || !currentChat) return;
    
    try {
      // Mostrar indicador de carga
      toast({
        title: 'Generando respuesta...',
        description: 'Procesando mensaje con IA...',
        variant: 'default'
      });
      
      // Generar respuesta con IA
      const chatHistory = messagesState.slice(-10).map(msg => ({
        role: msg.fromMe ? 'assistant' : 'user',
        content: msg.body
      }));
      
      // Añadir contexto adicional
      const context = {
        contactName: currentChat.name,
        isGroup: currentChat.isGroup,
        recentMessages: chatHistory
      };
      
      const generatedResponse = await generateAutoResponse(message.body, chatHistory, context);
      
      if (generatedResponse) {
        // Copiar respuesta al campo de mensaje
        setNewMessage(generatedResponse);
        
        // Mostrar notificación
        toast({
          title: 'Respuesta generada',
          description: 'Puede editar la respuesta antes de enviarla',
          variant: 'default'
        });
      } else {
        toast({
          title: 'No se pudo generar respuesta',
          description: 'El servicio de IA no pudo procesar el mensaje',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error generando respuesta automática:', error);
      toast({
        title: 'Error en respuesta automática',
        description: 'No se pudo generar la respuesta. Intente nuevamente.',
        variant: 'destructive'
      });
    }
  };

  // Función para seleccionar un chat específico
  const handleChatSelect = (chat: WhatsAppChat) => {
    setSelectedChatId(chat.id);
  };

  // Función para refrescar mensajes de un chat
  const refetchMessages = async () => {
    if (!selectedChatId) return;
    
    try {
      const { apiRequest } = await import('@/lib/queryClient');
      const messages = await apiRequest(`/api/direct/whatsapp/messages/${selectedChatId}`);
      
      if (Array.isArray(messages)) {
        setMessagesState(messages);
      }
    } catch (error) {
      console.error('Error refrescando mensajes:', error);
    }
  };

  // Cargar mensajes cuando cambia el chat seleccionado
  useEffect(() => {
    if (selectedChatId) {
      refetchMessages();
    }
  }, [selectedChatId]);

  // Manejar scroll automático cuando llegan nuevos mensajes
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messagesState]);

  // Renderizar el componente
  return (
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
                    
                    // Si seleccionó "todas las cuentas" (valor especial "all")
                    if (value === "all") {
                      setIsViewingAllAccounts(true);
                      
                      // Mostrar indicador de carga
                      toast({
                        title: "Cargando todas las cuentas",
                        description: "Preparando vista de todas las cuentas conectadas...",
                        variant: "default"
                      });
                      
                      // Limpiar selección actual
                      setSelectedChatId(null);
                      
                      // Cargar chats de todas las cuentas
                      const loadAllAccountChats = async () => {
                        try {
                          // Importar apiRequest
                          const { apiRequest } = await import('@/lib/queryClient');
                          
                          // Primero cargar todas las cuentas
                          const accounts = await apiRequest('/api/whatsapp-accounts');
                          
                          if (Array.isArray(accounts) && accounts.length > 0) {
                            // Filtrar solo cuentas autenticadas
                            const authenticatedAccounts = accounts.filter(
                              acc => acc.currentStatus?.authenticated
                            );
                            
                            // Almacenar para uso posterior
                            setAuthenticatedAccounts(authenticatedAccounts);
                            
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
                      
                      loadAllAccountChats();
                      return;
                    }
                    
                    // Si es una cuenta individual (comportamiento normal)
                    setIsViewingAllAccounts(false);
                    setCombinedChats([]);
                    
                    const newAccountId = Number(value);
                    const accountName = whatsappAccounts.find(acc => acc.id === newAccountId)?.name || 'seleccionada';
                    
                    // Mostrar indicador de carga
                    toast({
                      title: "Cambiando cuenta",
                      description: `Preparando cuenta ${accountName}...`,
                      variant: "default"
                    });
                    
                    // Guardar el chat seleccionado actual para la cuenta anterior
                    if (selectedChatId && currentAccountId) {
                      localStorage.setItem(`last_chat_${currentAccountId}`, selectedChatId);
                    }
                    
                    // Limpiar selección actual inmediatamente
                    setSelectedChatId(null);
                    
                    // Limpiar caché de consultas anteriores para evitar mezclar datos
                    queryClient.invalidateQueries({
                      queryKey: ['/api/whatsapp-accounts', currentAccountId]
                    });
                    
                    // Actualizar la cuenta seleccionada
                    setCurrentAccountId(newAccountId);
                    
                    // Iniciar precarga de datos para la nueva cuenta
                    setTimeout(async () => {
                      try {
                        // Precarga cuenta independientemente de su estado
                        const { apiRequest } = await import('@/lib/queryClient');
                        
                        // Cargar información de la cuenta
                        apiRequest(`/api/whatsapp-accounts/${newAccountId}`).catch(() => {});
                        
                        // Intentar cargar chats inmediatamente
                        apiRequest(`/api/whatsapp-accounts/${newAccountId}/chats`).catch(() => {});
                        
                        // Tratamiento especial para la cuenta de Soporte (ID 2)
                        if (newAccountId === 2) {
                          // Limpiar caché para evitar confusiones
                          queryClient.invalidateQueries({
                            queryKey: ['/api/whatsapp-accounts', 2]
                          });
                          
                          // Usar endpoint directo que funciona con todas las cuentas
                          apiRequest('/api/direct/whatsapp/chats').catch(() => {});
                          
                          // Precargar algunos mensajes de ejemplo para tener datos
                          const lastChats = localStorage.getItem('whatsapp_chats_2');
                          if (lastChats) {
                            try {
                              const parsedChats = JSON.parse(lastChats);
                              if (Array.isArray(parsedChats) && parsedChats.length > 0) {
                                // Precargar mensajes del primer chat para tener algo rápido
                                const firstChatId = parsedChats[0]?.id;
                                if (firstChatId) {
                                  apiRequest(`/api/direct/whatsapp/messages/${firstChatId}`).catch(() => {});
                                }
                              }
                            } catch (e) {}
                          }
                        }
                        
                        // Notificar completado
                        toast({
                          title: `Cuenta ${accountName} cargada`,
                          description: "Puedes empezar a usar esta cuenta ahora",
                          variant: "default"
                        });
                        
                        // Restaurar último chat usado
                        const lastChatForAccount = localStorage.getItem(`last_chat_${newAccountId}`);
                        if (lastChatForAccount) {
                          setSelectedChatId(lastChatForAccount);
                        }
                        
                        // Forzar refresco
                        refetchChats();
                      } catch (error) {
                        console.error("Error en precarga de cuenta:", error);
                      }
                    }, 100);
                  }}
                  disabled={isLoadingAccounts || !Array.isArray(whatsappAccounts) || whatsappAccounts.length === 0}
                >
                  {isLoadingAccounts ? (
                    <option>Cargando cuentas...</option>
                  ) : whatsappAccounts.length === 0 ? (
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
                  placeholder="Buscar chat o contacto..."
                  className="pl-8 h-9"
                  value={chatFilter}
                  onChange={(e) => setChatFilter(e.target.value)}
                />
              </div>
              
              <TabsList className="w-full">
                <TabsTrigger value="chats" className="flex-1" onClick={() => setActiveTab('chats')}>Chats</TabsTrigger>
                <TabsTrigger value="contacts" className="flex-1" onClick={() => setActiveTab('contacts')}>Contactos</TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="chats" className="flex-1 overflow-hidden">
              {/* Lista de chats - Verificación explícita */}
              {activeTab === 'chats' && (
                <ScrollArea className="h-[calc(100vh-180px)]">
                  {isLoadingChats ? (
                    <div className="flex justify-center p-4">
                      <Spinner />
                    </div>
                  ) : (!whatsappStatus?.authenticated && currentAccountId !== 2) ? (
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
                  ) : ((isViewingAllAccounts && combinedChats.length > 0) || whatsappChats) ? (
                    <div className="divide-y">
                      {/* Mostramos un mensaje de depuración antes del mapeo */}
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
                            
                            // Guardar en localStorage
                            localStorage.setItem('last_selected_chat_id', chat.id);
                            
                            // Si estamos en modo "todas las cuentas" y el chat tiene ID de cuenta
                            if (isViewingAllAccounts && chat.accountId) {
                              localStorage.setItem('last_selected_chat_account', chat.accountId.toString());
                            } else {
                              localStorage.setItem('last_selected_chat_account', currentAccountId.toString());
                            }
                            
                            // Cargar mensajes directamente desde la API
                            fetch(`/api/direct/whatsapp/messages/${chat.id}`)
                              .then(res => res.json())
                              .then(data => {
                                if (Array.isArray(data) && data.length > 0) {
                                  console.log(`✅ Cargados ${data.length} mensajes para chat ${chat.id}`);
                                  setMessagesState(data);
                                  localStorage.setItem(`messages_${chat.id}`, JSON.stringify(data));
                                } else {
                                  console.log('No hay mensajes disponibles, intentando cargar desde caché...');
                                  const cachedMessages = localStorage.getItem(`messages_${chat.id}`);
                                  if (cachedMessages) {
                                    try {
                                      const parsed = JSON.parse(cachedMessages);
                                      if (Array.isArray(parsed) && parsed.length > 0) {
                                        console.log(`🔄 Usando ${parsed.length} mensajes de caché local`);
                                        setMessagesState(parsed);
                                      }
                                    } catch (e) {
                                      console.error('Error al parsear caché:', e);
                                    }
                                  } else {
                                    // Crear mensaje de sistema
                                    setMessagesState([{
                                      id: `system_${Date.now()}`,
                                      body: "No hay mensajes disponibles para este chat. Si acabas de conectar la cuenta, intenta refrescar la página.",
                                      fromMe: false,
                                      timestamp: Date.now() / 1000,
                                      hasMedia: false
                                    }]);
                                  }
                                }
                              })
                              .catch(err => {
                                console.error('Error cargando mensajes:', err);
                                // Mensaje de error
                                setMessagesState([{
                                  id: `error_${Date.now()}`,
                                  body: "Error al cargar mensajes. Intente nuevamente o escanee el código QR para reconectar la cuenta.",
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
                    {currentChat.id.includes('@g.us') ? 'Grupo' : 
                      assignedAgent ? (
                        <Badge variant="outline" className="text-[10px] h-5 px-1 bg-indigo-50 text-indigo-700 border-indigo-200 flex items-center">
                          <UserCheck className="mr-1 h-3 w-3" />
                          Asignado a: {assignedAgent.name || 'Agente'}
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
                    onClick={() => handleAutoResponse(messagesState[messagesState.length - 1])}
                    disabled={messagesState.length === 0 || messageMutation.isPending}
                  >
                    <Brain className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Área de mensajes */}
              <div 
                className="flex-1 overflow-y-auto p-3 bg-gray-50 messages-container" 
                ref={chatContainerRef}
              >
                {messageMutation.isPending ? (
                  <div className="flex justify-center p-4">
                    <Spinner />
                  </div>
                ) : messagesState && messagesState.length > 0 ? (
                  <div className="space-y-1">
                    {messagesState.map((msg: WhatsAppMessage, index: number) => {
                      // Verificar si debe mostrar separador de fecha
                      const showDateSeparator = index === 0 || 
                        new Date(msg.timestamp * 1000).toDateString() !== 
                        new Date(messagesState[index - 1].timestamp * 1000).toDateString();
                      
                      // Verificar si es una secuencia de mensajes del mismo remitente
                      const isSequential = index > 0 && 
                        msg.fromMe === messagesState[index - 1].fromMe;
                      
                      return (
                        <React.Fragment key={msg.id || `temp-${Date.now()}-${index}`}>
                          {showDateSeparator && (
                            <div className="flex justify-center my-4">
                              <div className="bg-gray-100 text-gray-500 text-xs rounded-full px-3 py-1 font-medium">
                                {format(new Date(typeof msg.timestamp === 'number' ? 
                                  (msg.timestamp > 9999999999 ? msg.timestamp : msg.timestamp * 1000) : 
                                  Date.now()), 'EEEE, d MMMM', { locale: es })}
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
                                    <div 
                                      className="relative cursor-pointer group"
                                      onClick={() => {
                                        // Abrir el modal con la media
                                        setMediaPreviewUrl(msg.mediaUrl || '');
                                        setMediaCaption(msg.caption || '');
                                        setMediaType(msg.mimetype || 'image/jpeg');
                                        setIsMediaPreviewOpen(true);
                                      }}
                                    >
                                      {msg.mimetype?.startsWith('image/') ? (
                                        <>
                                          <img 
                                            src={msg.mediaUrl} 
                                            alt={msg.caption || 'Image'} 
                                            className="rounded-md max-w-full max-h-48 bg-gray-100"
                                          />
                                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity rounded-md flex items-center justify-center">
                                            <Maximize className="text-white opacity-0 group-hover:opacity-100 h-6 w-6" />
                                          </div>
                                        </>
                                      ) : msg.mimetype?.startsWith('video/') ? (
                                        <div className="relative rounded-md overflow-hidden bg-gray-900">
                                          <div className="absolute inset-0 flex items-center justify-center">
                                            <Play className="text-white h-10 w-10 opacity-80" />
                                          </div>
                                          <div className="h-32 flex items-center justify-center">
                                            <Video className="text-gray-400 h-10 w-10" />
                                          </div>
                                        </div>
                                      ) : msg.mimetype?.startsWith('audio/') ? (
                                        <div className="rounded-md bg-gray-100 p-3 flex items-center gap-2">
                                          <Mic className="text-gray-500 h-5 w-5" />
                                          <span className="text-sm text-gray-700">Audio</span>
                                        </div>
                                      ) : (
                                        <div className="rounded-md bg-gray-100 p-3 flex items-center gap-2">
                                          <File className="text-gray-500 h-5 w-5" />
                                          <span className="text-sm text-gray-700">
                                            {msg.filename || 'Archivo'}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="rounded-md bg-gray-100 p-3 flex items-center gap-2">
                                      <FileText className="text-gray-500 h-5 w-5" />
                                      <span className="text-sm text-gray-700">Archivo no disponible</span>
                                    </div>
                                  )}
                                  
                                  {msg.caption && (
                                    <div className={`mt-1 text-sm ${msg.fromMe ? 'text-white text-opacity-90' : 'text-gray-700'}`}>
                                      {msg.caption}
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              <div className="whitespace-pre-wrap break-words">
                                <MessageText content={msg.body} isOutgoing={msg.fromMe} />
                              </div>
                              
                              <div className={`text-xs mt-1 text-right ${msg.fromMe ? 'text-white text-opacity-70' : 'text-gray-500'}`}>
                                {format(new Date(typeof msg.timestamp === 'number' ? 
                                  (msg.timestamp > 9999999999 ? msg.timestamp : msg.timestamp * 1000) : 
                                  Date.now()), 'HH:mm')}
                                {msg.fromMe && <CheckCheck className="inline-block ml-1 h-3 w-3" />}
                              </div>
                            </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-gray-500">
                      <MessageSquare className="mx-auto h-10 w-10 mb-2 text-gray-400" />
                      <p>No hay mensajes para mostrar</p>
                      <p className="text-sm mt-1">Selecciona un chat para ver la conversación</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Área de entrada de mensajes */}
              <div className="p-2 border-t bg-white">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" title="Adjuntar archivo" disabled>
                    <Paperclip className="h-5 w-5 text-gray-500" />
                  </Button>
                  
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
                    disabled={!newMessage.trim() || messageMutation.isPending}
                  >
                    <Send className="h-5 w-5 text-green-600" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-50">
              <div className="text-center p-4">
                <MessageSquare className="mx-auto h-12 w-12 text-gray-400 mb-2" />
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
      
      {/* Modal para previsualizar archivos multimedia */}
      <Dialog open={isMediaPreviewOpen} onOpenChange={setIsMediaPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{mediaCaption || 'Contenido multimedia'}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center mt-2">
            {mediaType?.startsWith('image/') ? (
              <img src={mediaPreviewUrl} alt={mediaCaption || 'Image preview'} className="max-h-[70vh] object-contain" />
            ) : mediaType?.startsWith('video/') ? (
              <video controls className="max-h-[70vh] max-w-full">
                <source src={mediaPreviewUrl} type={mediaType} />
                Tu navegador no soporta la reproducción de videos.
              </video>
            ) : mediaType?.startsWith('audio/') ? (
              <audio controls className="w-full">
                <source src={mediaPreviewUrl} type={mediaType} />
                Tu navegador no soporta la reproducción de audio.
              </audio>
            ) : (
              <div className="text-center py-8">
                <File className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                <p>Este tipo de archivo no se puede previsualizar</p>
                <Button className="mt-4" onClick={() => window.open(mediaPreviewUrl, '_blank')}>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar archivo
                </Button>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsMediaPreviewOpen(false)}>
              Cerrar
            </Button>
            <Button onClick={() => window.open(mediaPreviewUrl, '_blank')}>
              <Download className="mr-2 h-4 w-4" />
              Descargar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo para asignar chat */}
      {assignmentDialogOpen && selectedChatId && (
        <ChatAssignmentDialog
          isOpen={assignmentDialogOpen}
          onClose={() => setAssignmentDialogOpen(false)}
          chatId={selectedChatId}
          chatName={currentChat?.name || 'Chat'}
          onAssigned={(agentData) => {
            setAssignedAgent(agentData);
            setAssignmentDialogOpen(false);
            toast({
              title: 'Chat asignado',
              description: `El chat ha sido asignado a ${agentData.name}`,
              variant: 'default'
            });
          }}
        />
      )}
      
      {/* Configuración de IA para respuestas */}
      {showGeminiConfig && selectedChatForGemini && (
        <GeminiConfig
          chatId={selectedChatForGemini}
          isOpen={showGeminiConfig}
          onClose={() => {
            setShowGeminiConfig(false);
            setSelectedChatForGemini(null);
          }}
        />
      )}
    </div>
  );
}