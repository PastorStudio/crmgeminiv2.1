import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { WhatsAppQRCode } from './WhatsAppQRCode';
import { UnifiedViewToggle } from './UnifiedViewToggle';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { generateAutoResponse } from '@/lib/gemini';
import { chatContext } from '@/lib/chatContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  ScrollArea
} from '@/components/ui/scroll-area';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Badge,
} from '@/components/ui/badge';
import {
  ArrowUpCircle,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Settings,
  SmilePlus,
  Image,
  FileText,
  Mic,
  Camera,
  Contact,
  File,
  UserPlus,
  User,
  Smartphone,
  LayoutGrid
} from 'lucide-react';
import ChatAssignmentDialog from './ChatAssignmentDialog';
import { MessageText } from '@/components/ui/message-text';
import { MessageBubble } from '@/components/ui/message-bubble';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ChatGeminiConfig } from '@/components/gemini/ChatGeminiConfig';
import { WsEvents } from '@/types/wsEvents';
import { isAgent, isSupervisor, isAdmin } from '@/lib/permissions';
import { useAuth } from '@/lib/authContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import _ from 'lodash';

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

// Tipo para notificaciones recibidas por WebSocket
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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState('');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const [selectedAccountQr, setSelectedAccountQr] = useState<number | null>(null);
  const [showGeminiConfig, setShowGeminiConfig] = useState(false);
  const [currentChatContext, setCurrentChatContext] = useState<string>('');
  const [chatFilter, setChatFilter] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'chats' | 'contacts'>('chats');
  const [currentAccountId, setCurrentAccountId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'single' | 'all'>('single');
  const [allAccountsChats, setAllAccountsChats] = useState<WhatsAppChat[]>([]);
  const [showSendButtons, setShowSendButtons] = useState(false);
  const [showChatAssignmentDialog, setShowChatAssignmentDialog] = useState(false);

  // WebSocket para comunicación en tiempo real
  const socket = useWebSocket({
    onMessage: handleWebSocketMessage
  });

  // Consulta para obtener las cuentas WhatsApp
  const { data: whatsappAccounts = [], isLoading: isLoadingAccounts } = useQuery({
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
  
  // Consulta para obtener el estado de conexión de las cuentas WhatsApp
  const { data: whatsappStatuses = [], isLoading: isLoadingStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['/api/direct/whatsapp/status'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/direct/whatsapp/status');
        if (!response.ok) throw new Error("Error al obtener estado de WhatsApp");
        const data = await response.json();
        // Si recibimos un solo objeto, lo convertimos en array
        if (!Array.isArray(data)) {
          return data.ready ? [{ 
            id: 1, 
            name: "WhatsApp", 
            status: data.authenticated ? 'CONNECTED' : 'DISCONNECTED'
          }] : [];
        }
        return data;
      } catch (error) {
        console.error("Error obteniendo estado WhatsApp:", error);
        return [];
      }
    },
    refetchInterval: 5000 // Actualizar cada 5 segundos
  });

  // Consulta para obtener los chats
  const { 
    data: whatsappChats = [], 
    isLoading: isLoadingChats,
    refetch: refetchChats
  } = useQuery({
    queryKey: ['/api/direct/whatsapp/chats', currentAccountId],
    queryFn: async () => {
      try {
        // Si no hay cuenta seleccionada, no hacer la petición
        if (currentAccountId === null) return [];
        
        const response = await fetch(`/api/direct/whatsapp/chats?accountId=${currentAccountId}`);
        if (!response.ok) throw new Error("Error al obtener chats de WhatsApp");
        const data = await response.json();
        return data;
      } catch (error) {
        console.error("Error obteniendo chats WhatsApp:", error);
        return [];
      }
    },
    enabled: currentAccountId !== null
  });

  // Consulta para obtener los mensajes del chat seleccionado
  const { 
    data: whatsappMessages = [], 
    isLoading: isLoadingMessages,
    refetch: refetchMessages 
  } = useQuery({
    queryKey: ['/api/direct/whatsapp/messages', selectedChatId, currentAccountId],
    queryFn: async () => {
      try {
        // Si no hay chat seleccionado, no hacer la petición
        if (!selectedChatId || currentAccountId === null) return [];
        
        const response = await fetch(`/api/direct/whatsapp/messages?chatId=${selectedChatId}&accountId=${currentAccountId}`);
        if (!response.ok) throw new Error("Error al obtener mensajes de WhatsApp");
        const data = await response.json();
        return data;
      } catch (error) {
        console.error("Error obteniendo mensajes WhatsApp:", error);
        return [];
      }
    },
    enabled: !!selectedChatId && currentAccountId !== null
  });

  // Consulta para obtener los contactos
  const { 
    data: whatsappContacts = [], 
    isLoading: isLoadingContacts 
  } = useQuery({
    queryKey: ['/api/direct/whatsapp/contacts', currentAccountId],
    queryFn: async () => {
      try {
        // Si no hay cuenta seleccionada, no hacer la petición
        if (currentAccountId === null) return [];
        
        const response = await fetch(`/api/direct/whatsapp/contacts?accountId=${currentAccountId}`);
        if (!response.ok) throw new Error("Error al obtener contactos de WhatsApp");
        const data = await response.json();
        return data;
      } catch (error) {
        console.error("Error obteniendo contactos WhatsApp:", error);
        return [];
      }
    },
    enabled: currentAccountId !== null
  });

  // Función para cargar los chats de todas las cuentas
  async function loadAllAccountsChats() {
    try {
      const allChats: WhatsAppChat[] = [];
      
      // Iterar sobre todas las cuentas disponibles
      for (const account of whatsappAccounts) {
        const accountId = account.id;
        
        // Verificar si la cuenta está conectada
        const accountStatus = whatsappStatuses.find(status => status.id === accountId);
        if (!accountStatus || accountStatus.status !== 'CONNECTED') continue;
        
        // Obtener los chats para esta cuenta
        const response = await fetch(`/api/direct/whatsapp/chats?accountId=${accountId}`);
        if (!response.ok) continue;
        
        const accountChats = await response.json();
        
        // Añadir el ID de la cuenta a cada chat para identificar su origen
        const chatsWithAccountId = accountChats.map((chat: WhatsAppChat) => ({
          ...chat,
          accountId
        }));
        
        // Añadir al array de todos los chats
        allChats.push(...chatsWithAccountId);
      }
      
      // Actualizar estado
      setAllAccountsChats(allChats);
    } catch (error) {
      console.error("Error cargando todos los chats:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los chats de todas las cuentas",
        variant: "destructive"
      });
    }
  }

  // Cargar chats para todas las cuentas cuando cambia el modo de vista
  useEffect(() => {
    if (viewMode === 'all') {
      loadAllAccountsChats();
    }
  }, [viewMode, whatsappAccounts, whatsappStatuses]);

  // Manejar mensajes recibidos por WebSocket
  function handleWebSocketMessage(event: MessageEvent) {
    try {
      const notification: Notification = JSON.parse(event.data);
      
      // Manejar según el tipo de notificación
      switch(notification.type) {
        case NotificationType.NEW_MESSAGE:
          // Actualizar chats y mensajes si hay un nuevo mensaje
          const msgData = notification.data;
          
          // Determinar si el mensaje es del chat actualmente seleccionado
          if (msgData.chatId === selectedChatId) {
            refetchMessages();
          }
          
          // Actualizar lista de chats en cualquier caso
          refetchChats();
          
          // Actualizar notificación de sonido solo si el mensaje no es nuestro
          if (!msgData.fromMe) {
            // Si el mensaje es de una cuenta distinta a la actual pero estamos en vista unificada
            // aun así queremos actualizarlo
            if (viewMode === 'all' || msgData.accountId === currentAccountId) {
              playNotificationSound();
            }
          }
          
          break;
          
        case NotificationType.CONNECTION_STATUS:
          // Actualizar estado de conexión
          refetchStatus();
          break;
          
        case NotificationType.QR_CODE:
          // Actualizar QR code para la cuenta especificada
          refetchStatus();
          break;
      }
    } catch (error) {
      console.error('Error procesando mensaje de WebSocket:', error);
    }
  }

  // Reproducir sonido de notificación
  function playNotificationSound() {
    try {
      const audio = new Audio('/notification.mp3');
      audio.play();
    } catch (error) {
      console.error('Error reproduciendo sonido de notificación:', error);
    }
  }

  // Efecto para seleccionar la primera cuenta disponible al cargar
  useEffect(() => {
    // Solo intentar autoseleccionar si no hay cuenta seleccionada aún
    if (currentAccountId === null && whatsappAccounts.length > 0) {
      // Buscar la primera cuenta conectada
      const connectedAccount = whatsappAccounts.find(account => {
        const status = whatsappStatuses.find(status => status.id === account.id);
        return status && status.status === 'CONNECTED';
      });
      
      // Si hay una cuenta conectada, seleccionarla
      if (connectedAccount) {
        setCurrentAccountId(connectedAccount.id);
      } 
      // Si no hay cuentas conectadas pero hay cuentas, seleccionar la primera
      else if (whatsappAccounts.length > 0) {
        setCurrentAccountId(whatsappAccounts[0].id);
      }
    }
  }, [whatsappAccounts, whatsappStatuses, currentAccountId]);

  // Efecto para hacer scroll al último mensaje
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [whatsappMessages]);

  // Hacer scroll cuando cambia el chat seleccionado
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [selectedChatId]);

  // Actualizar el contexto del chat cuando cambian los mensajes
  useEffect(() => {
    if (whatsappMessages.length > 0) {
      // Construir contexto: últimos 10 mensajes (o menos si no hay suficientes)
      const recentMessages = whatsappMessages.slice(-10);
      let context = recentMessages.map((msg: WhatsAppMessage) => {
        const sender = msg.fromMe ? 'Yo' : 'Cliente';
        return `${sender}: ${msg.body}`;
      }).join('\n');
      
      setCurrentChatContext(context);
    } else {
      setCurrentChatContext('');
    }
  }, [whatsappMessages]);

  // Manejar envío de mensaje
  const sendMessageMutation = useMutation({
    mutationFn: async ({ chatId, message, accountId }: { chatId: string, message: string, accountId: number }) => {
      const response = await fetch('/api/direct/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message, accountId })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al enviar mensaje");
      }
      
      return response.json();
    },
    onSuccess: () => {
      setMessage('');
      refetchMessages();
      refetchChats();
    },
    onError: (error: Error) => {
      toast({
        title: "Error al enviar mensaje",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Manejar respuesta automática con Gemini
  const handleAutoResponse = async (message: WhatsAppMessage) => {
    try {
      if (!selectedChatId || currentAccountId === null) return;
      
      // Obtenemos el nombre del chat seleccionado
      const currentChat = whatsappChats.find((chat) => chat.id === selectedChatId);
      if (!currentChat) return;
      
      // Generar respuesta automática con Gemini
      const response = await generateAutoResponse(
        message.body,
        currentChat.name,
        currentChatContext
      );
      
      if (response) {
        // Enviar la respuesta generada
        await sendMessageMutation.mutateAsync({
          chatId: selectedChatId,
          message: response,
          accountId: currentAccountId
        });
        
        toast({
          title: "Respuesta automática enviada",
          description: "Se ha enviado una respuesta generada por Gemini",
        });
      }
    } catch (error) {
      console.error("Error generando respuesta automática:", error);
      toast({
        title: "Error en respuesta automática",
        description: "No se pudo generar/enviar una respuesta automática",
        variant: "destructive"
      });
    }
  };

  // Manejar selección de chat
  const handleChatSelect = (chat: WhatsAppChat) => {
    // Si estamos en modo vista unificada, necesitamos cambiar a la cuenta correcta
    if (viewMode === 'all' && chat.accountId && chat.accountId !== currentAccountId) {
      setCurrentAccountId(chat.accountId);
    }
    
    setSelectedChatId(chat.id);
  };

  // Manejar envío de mensaje con Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Función para enviar mensaje
  const handleSendMessage = () => {
    if (!message.trim() || !selectedChatId || currentAccountId === null) return;
    
    sendMessageMutation.mutateAsync({
      chatId: selectedChatId,
      message: message.trim(),
      accountId: currentAccountId
    });
  };

  // Mostrar el código QR para una cuenta específica
  const handleShowQR = (accountId: number) => {
    setSelectedAccountQr(accountId);
    setIsQrDialogOpen(true);
  };

  // Función para mostrar la fecha de los mensajes en formato legible
  const formatMessageDate = (timestamp: number) => {
    try {
      const date = new Date(timestamp * 1000);
      return format(date, 'HH:mm', { locale: es });
    } catch (error) {
      return "Fecha desconocida";
    }
  };

  // Función para mostrar la fecha de los chats en formato legible
  const formatChatDate = (timestamp: number) => {
    try {
      const date = new Date(timestamp * 1000);
      const now = new Date();
      
      // Si es hoy, mostrar hora
      if (date.toDateString() === now.toDateString()) {
        return format(date, 'HH:mm', { locale: es });
      }
      
      // Si es esta semana, mostrar día
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 7) {
        return format(date, 'EEEE', { locale: es });
      }
      
      // Si es este año, mostrar día y mes
      if (date.getFullYear() === now.getFullYear()) {
        return format(date, 'd MMM', { locale: es });
      }
      
      // Si es otro año, mostrar fecha completa
      return format(date, 'd MMM yyyy', { locale: es });
    } catch (error) {
      return "Fecha desconocida";
    }
  };

  // Filtrar chats según el término de búsqueda
  const filteredChats = () => {
    const chatsToFilter = viewMode === 'all' ? allAccountsChats : whatsappChats;
    
    if (!chatFilter) return chatsToFilter;
    
    const filter = chatFilter.toLowerCase();
    return chatsToFilter.filter(chat => 
      chat.name.toLowerCase().includes(filter) || 
      (chat.lastMessage && chat.lastMessage.toLowerCase().includes(filter))
    );
  };

  // Filtrar contactos según el término de búsqueda
  const filteredContacts = () => {
    if (!chatFilter) return whatsappContacts;
    
    const filter = chatFilter.toLowerCase();
    return whatsappContacts.filter(contact => 
      contact.name.toLowerCase().includes(filter)
    );
  };

  // Obtener el nombre de la cuenta para un ID dado
  const getAccountName = (accountId: number) => {
    const account = whatsappAccounts.find(acc => acc.id === accountId);
    return account ? account.name : `Cuenta ${accountId}`;
  };

  // Agrupar chats por cuenta en modo vista unificada
  const groupedChats = () => {
    if (viewMode !== 'all') return {};
    
    // Agrupar chats por accountId
    return _.groupBy(filteredChats(), 'accountId');
  };

  // Verificar si una cuenta está conectada
  const isAccountConnected = (accountId: number) => {
    const status = whatsappStatuses.find(s => s.id === accountId);
    return status && status.status === 'CONNECTED';
  };

  // Determinar si el usuario tiene permiso para gestionar asignaciones
  const canManageAssignments = user && (isAdmin(user) || isSupervisor(user));

  // Verificar si hay cuentas conectadas
  const hasConnectedAccounts = whatsappStatuses.some(status => status.status === 'CONNECTED');

  // Chat actualmente seleccionado
  const selectedChat = viewMode === 'single' 
    ? whatsappChats.find((chat) => chat.id === selectedChatId) 
    : allAccountsChats.find(chat => chat.id === selectedChatId);

  // Ajustar automáticamente la altura del textarea
  const autoResizeTextarea = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  // Alternar el modo de vista entre individual y unificada
  const toggleViewMode = () => {
    const newMode = viewMode === 'single' ? 'all' : 'single';
    setViewMode(newMode);
    
    // Si cambiamos a modo unificado, cargar todos los chats
    if (newMode === 'all') {
      loadAllAccountsChats();
    }
  };

  return (
    <div className="h-full w-full flex flex-col">
      {/* Barra superior con título y controles */}
      <div className="bg-white border-b p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="pl-2">
            <h1 className="text-xl font-bold text-gray-800">
              WhatsApp Messenger
              {currentAccountId && viewMode === 'single' && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ({getAccountName(currentAccountId)})
                </span>
              )}
              {viewMode === 'all' && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  (Vista Unificada)
                </span>
              )}
            </h1>
            <div className="ml-8 mt-1 text-xs font-medium text-gray-700">
              {hasConnectedAccounts ? (
                <>
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                  Conectado
                </>
              ) : (
                <>
                  <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-1"></span>
                  Desconectado
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      refetchChats();
                      refetchStatus();
                      if (viewMode === 'all') {
                        loadAllAccountsChats();
                      }
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Actualizar chats</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <UnifiedViewToggle 
              viewMode={viewMode} 
              onToggle={toggleViewMode} 
            />

            {canManageAssignments && selectedChatId && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowChatAssignmentDialog(true)}
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Asignar chat a agente</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>
      
      {/* Interfaz principal de WhatsApp con Grid */}
      <div className="grid grid-cols-12 flex-1 overflow-hidden">
        {/* Panel izquierdo - Chats */}
        <div className="col-span-12 md:col-span-4 flex flex-col border-r h-full overflow-hidden">
          <Tabs defaultValue="chats" className="flex flex-col h-full overflow-hidden">
            <div className="border-b p-2">
              {/* Selector de cuentas WhatsApp */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1 mr-2">
                  <select 
                    className="w-full rounded-md border border-gray-300 py-1 px-2 text-sm font-medium"
                    value={currentAccountId === null ? '' : currentAccountId}
                    disabled={viewMode === 'all'}
                    onChange={(e) => {
                    // Si no hay valor seleccionado, no hacer nada
                    if (!e.target.value) return;
                    
                    // Convertir a número con validación
                    const newAccountId = parseInt(e.target.value, 10);
                    if (isNaN(newAccountId)) {
                      console.error('ID de cuenta inválido:', e.target.value);
                      return;
                    }
                    
                    // Buscar la cuenta en la lista para confirmar que existe
                    const account = whatsappAccounts.find(acc => acc.id === newAccountId);
                    if (!account) {
                      console.error('Cuenta no encontrada con ID:', newAccountId);
                      toast({
                        title: "Error al cambiar de cuenta",
                        description: `No se encontró la cuenta con ID ${newAccountId}`,
                        variant: "destructive"
                      });
                      return;
                    }
                    
                    // Cambiar a la nueva cuenta
                    setCurrentAccountId(newAccountId);
                    // Resetear chat seleccionado al cambiar de cuenta
                    setSelectedChatId(null);
                  }}
                  >
                    <option value="">Seleccionar cuenta</option>
                    {whatsappAccounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name} 
                        {isAccountConnected(account.id) ? ' (Conectada)' : ' (Desconectada)'}
                      </option>
                    ))}
                  </select>
                </div>
                
                {currentAccountId && viewMode === 'single' && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleShowQR(currentAccountId)}
                  >
                    QR
                  </Button>
                )}
              </div>
              
              <div className="relative mb-2">
                <Input
                  placeholder="Buscar chats o mensajes..."
                  className="pl-8"
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
                <ScrollArea className="h-[calc(100vh-180px)]">
                  {isLoadingChats ? (
                    <div className="flex justify-center p-4">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                  ) : viewMode === 'all' ? (
                    <div className="divide-y">
                      <div className="p-3 text-sm font-medium bg-gray-50 sticky top-0 z-10">
                        Vista unificada de todas las cuentas
                      </div>
                      
                      {Object.keys(groupedChats()).length === 0 ? (
                        <div className="p-8 text-center flex flex-col items-center gap-4">
                          <div className="text-gray-500">
                            No hay cuentas conectadas o no hay chats disponibles
                          </div>
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              refetchStatus();
                              loadAllAccountsChats();
                            }}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Actualizar
                          </Button>
                        </div>
                      ) : (
                        // Mostrar chats agrupados por cuenta
                        Object.entries(groupedChats()).map(([accountId, chats]) => {
                          const numericAccountId = parseInt(accountId, 10);
                          return (
                            <div key={accountId} className="account-group">
                              <div className="p-2 bg-gray-100 border-t border-b sticky top-0 z-10">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium text-sm">
                                    {getAccountName(numericAccountId)}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {Array.isArray(chats) ? chats.length : 0} chats
                                  </span>
                                </div>
                              </div>
                              
                              {Array.isArray(chats) && chats.map(chat => (
                                <div
                                  key={`${chat.accountId}-${chat.id}`}
                                  className={`p-3 hover:bg-gray-100 cursor-pointer flex items-start ${
                                    selectedChatId === chat.id ? 'bg-blue-50' : ''
                                  }`}
                                  onClick={() => handleChatSelect(chat)}
                                >
                                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-300 mr-3 flex items-center justify-center overflow-hidden">
                                    {chat.profilePicUrl ? (
                                      <img src={chat.profilePicUrl} alt={chat.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <User className="h-6 w-6 text-gray-500" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex justify-between">
                                      <h4 className="text-sm font-medium text-gray-900 truncate">
                                        {chat.name}
                                      </h4>
                                      <span className="text-xs text-gray-500">
                                        {formatChatDate(chat.timestamp)}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-500 truncate">
                                      {chat.lastMessage}
                                    </p>
                                  </div>
                                  {chat.unreadCount > 0 && (
                                    <div className="ml-2 bg-green-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                                      {chat.unreadCount}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        })
                      )}
                    </div>
                  ) : filteredChats().length === 0 ? (
                    <div className="p-6 text-center">
                      {currentAccountId === null ? (
                        <div>Selecciona una cuenta de WhatsApp</div>
                      ) : isAccountConnected(currentAccountId) ? (
                        <div>
                          <p className="text-gray-500 mb-2">No hay chats disponibles</p>
                          <Button 
                            variant="outline" 
                            onClick={() => refetchChats()}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Actualizar
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <p className="text-gray-500 mb-2">Cuenta desconectada</p>
                          <Button 
                            variant="outline" 
                            onClick={() => handleShowQR(currentAccountId)}
                          >
                            Escanear QR
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredChats().map(chat => (
                        <div
                          key={chat.id}
                          className={`p-3 hover:bg-gray-100 cursor-pointer flex items-start ${
                            selectedChatId === chat.id ? 'bg-blue-50' : ''
                          }`}
                          onClick={() => handleChatSelect(chat)}
                        >
                          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-300 mr-3 flex items-center justify-center overflow-hidden">
                            {chat.profilePicUrl ? (
                              <img src={chat.profilePicUrl} alt={chat.name} className="w-full h-full object-cover" />
                            ) : (
                              <User className="h-6 w-6 text-gray-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between">
                              <h4 className="text-sm font-medium text-gray-900 truncate">
                                {chat.name}
                              </h4>
                              <span className="text-xs text-gray-500">
                                {formatChatDate(chat.timestamp)}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 truncate">
                              {chat.lastMessage}
                            </p>
                          </div>
                          {chat.unreadCount > 0 && (
                            <div className="ml-2 bg-green-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                              {chat.unreadCount}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              )}
            </TabsContent>
            
            <TabsContent value="contacts" className="flex-1 overflow-hidden">
              <ScrollArea className="h-[calc(100vh-180px)]">
                {isLoadingContacts ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : filteredContacts().length === 0 ? (
                  <div className="p-8 text-center">
                    {currentAccountId === null ? (
                      <div>Selecciona una cuenta de WhatsApp</div>
                    ) : isAccountConnected(currentAccountId) ? (
                      <div>
                        <div className="mb-2">No hay contactos disponibles</div>
                        <div className="text-xs">
                          Se ha establecido conexión con WhatsApp, pero no se encontraron contactos.
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-gray-500 mb-2">Cuenta desconectada</p>
                        <Button 
                          variant="outline" 
                          onClick={() => handleShowQR(currentAccountId)}
                        >
                          Escanear QR
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredContacts().map(contact => (
                      <div 
                        key={contact.id}
                        className="p-3 hover:bg-gray-100 cursor-pointer flex items-center"
                        onClick={async () => {
                          try {
                            if (!currentAccountId) return;
                            
                            const response = await fetch('/api/direct/whatsapp/chat-by-contact', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ 
                                contactId: contact.id,
                                accountId: currentAccountId
                              })
                            });
                            
                            if (!response.ok) {
                              throw new Error('No se pudo obtener el chat');
                            }
                            
                            const data = await response.json();
                            setSelectedChatId(data.id);
                            
                            // Actualizar lista de chats
                            refetchChats();
                          } catch (error) {
                            console.error('Error obteniendo chat por contacto:', error);
                            toast({
                              title: "Error",
                              description: "No se pudo abrir el chat con este contacto",
                              variant: "destructive"
                            });
                          }
                        }}
                      >
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-300 mr-3 flex items-center justify-center overflow-hidden">
                          {contact.profilePicUrl ? (
                            <img src={contact.profilePicUrl} alt={contact.name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="h-6 w-6 text-gray-500" />
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">
                            {contact.name}
                          </h4>
                          <p className="text-xs text-gray-500">
                            {contact.isMyContact ? 'Contacto' : 'No agregado'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Panel derecho - Mensajes */}
        <div className="col-span-12 md:col-span-8 flex flex-col h-full overflow-hidden">
          {!currentAccountId ? (
            // Panel de mensaje cuando no hay cuenta seleccionada
            <div className="flex flex-col items-center justify-center h-full p-8 bg-gray-50">
              <Card className="w-full max-w-md">
                <CardHeader>
                  <CardTitle>Selecciona una cuenta de WhatsApp</CardTitle>
                </CardHeader>
                <div className="p-6">
                  <p className="text-center text-gray-500 mb-4">
                    Selecciona una cuenta de WhatsApp del menú desplegable para comenzar a chatear.
                  </p>
                  {whatsappAccounts.length === 0 ? (
                    <div className="text-center">
                      <p className="text-sm text-gray-500 mb-4">
                        No hay cuentas de WhatsApp configuradas.
                      </p>
                      <Button asChild className="mt-2">
                        <a href="/whatsapp-accounts">Configurar cuentas</a>
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {whatsappAccounts.map(account => {
                        const status = whatsappStatuses.find(s => s.id === account.id);
                        const isConnected = status && status.status === 'CONNECTED';
                        
                        return (
                          <div key={account.id} className="flex items-center justify-between p-3 border rounded-md">
                            <div>
                              <h3 className="font-medium">{account.name}</h3>
                              <p className="text-sm text-gray-500">
                                {isConnected ? (
                                  <span className="text-green-600">Conectada</span>
                                ) : (
                                  <span className="text-red-600">Desconectada</span>
                                )}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentAccountId(account.id)}
                              >
                                Seleccionar
                              </Button>
                              {!isConnected && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleShowQR(account.id)}
                                >
                                  QR
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          ) : !selectedChatId ? (
            // Panel de inicio cuando no hay chat seleccionado
            <div className="flex flex-col items-center justify-center h-full p-8 bg-gray-50">
              <Card className="w-full max-w-md">
                <CardHeader>
                  <CardTitle>Selecciona un chat para comenzar</CardTitle>
                </CardHeader>
                <div className="p-6">
                  <p className="text-center text-gray-500 mb-4">
                    Selecciona un chat de la lista para comenzar a enviar mensajes.
                  </p>
                  
                  {isAccountConnected(currentAccountId) ? (
                    filteredChats().length === 0 ? (
                      <div className="text-center">
                        <p className="text-sm text-gray-500 mb-4">
                          No hay chats disponibles en esta cuenta.
                        </p>
                        <Button 
                          onClick={() => refetchChats()}
                          className="mt-2"
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Actualizar
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-sm text-gray-600">
                          Cuentas con {filteredChats().length} {filteredChats().length === 1 ? 'chat' : 'chats'} disponibles.
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="text-center">
                      <p className="text-sm text-gray-500 mb-4">
                        Esta cuenta no está conectada. Escanea el código QR para conectarte.
                      </p>
                      <Button 
                        onClick={() => handleShowQR(currentAccountId)}
                        className="mt-2"
                      >
                        Escanear QR
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          ) : (
            // Interfaz de chat
            <>
              {/* Encabezado del chat */}
              <div className="bg-white border-b p-3 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-gray-300 mr-3 flex items-center justify-center overflow-hidden">
                    {selectedChat?.profilePicUrl ? (
                      <img src={selectedChat.profilePicUrl} alt={selectedChat.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-6 w-6 text-gray-500" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-sm font-bold">
                      {selectedChat?.name}
                      {viewMode === 'all' && selectedChat?.accountId && (
                        <span className="ml-2 text-xs font-normal text-gray-500">
                          ({getAccountName(selectedChat.accountId)})
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-gray-500">
                      {isLoadingMessages ? 'Cargando...' : `${whatsappMessages.length} mensajes`}
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      refetchMessages();
                      toast({
                        title: "Actualizando mensajes",
                        description: "Obteniendo los últimos mensajes",
                      });
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  
                  {canManageAssignments && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowChatAssignmentDialog(true)}
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Área de mensajes */}
              <div className="bg-[#e5ded8] bg-opacity-30 flex-1 overflow-y-auto p-4">
                {isLoadingMessages ? (
                  <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : whatsappMessages.length === 0 ? (
                  <div className="flex justify-center items-center h-full text-gray-500">
                    No hay mensajes disponibles
                  </div>
                ) : (
                  <div className="space-y-3">
                    {whatsappMessages.map((msg: WhatsAppMessage, index: number) => {
                      const showDate = index === 0 || 
                        (whatsappMessages[index - 1].timestamp < msg.timestamp - 3600); // 1 hora de diferencia
                      
                      return (
                        <div key={msg.id} className="space-y-1">
                          {showDate && (
                            <div className="flex justify-center my-2">
                              <div className="bg-white rounded-full px-3 py-1 text-xs text-gray-500 shadow-sm">
                                {formatChatDate(msg.timestamp)}
                              </div>
                            </div>
                          )}
                          
                          <MessageBubble 
                            message={msg.body}
                            isOutgoing={msg.fromMe}
                            timestamp={formatMessageDate(msg.timestamp)}
                            hasMedia={msg.hasMedia}
                            mediaUrl={msg.mediaUrl}
                            caption={msg.caption}
                          />
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
              
              {/* Área de entrada de mensaje */}
              <div className="bg-white border-t p-3">
                <div className="flex items-end gap-2">
                  <div className="relative flex-1">
                    <Textarea
                      ref={textareaRef}
                      placeholder="Escribe un mensaje..."
                      className="resize-none min-h-[40px] max-h-32 py-2 pr-10"
                      value={message}
                      onChange={(e) => {
                        setMessage(e.target.value);
                        autoResizeTextarea(e);
                      }}
                      onKeyDown={handleKeyDown}
                      onFocus={() => setShowSendButtons(true)}
                      onBlur={() => setTimeout(() => setShowSendButtons(false), 100)}
                    />
                    
                    {/* Botón de emoji (placeholder) */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute bottom-1 right-1 h-6 w-6 p-0"
                      onClick={() => {
                        toast({
                          title: "Emojis",
                          description: "La funcionalidad de emojis está en desarrollo",
                        });
                      }}
                    >
                      <SmilePlus className="h-4 w-4 text-gray-500" />
                    </Button>
                  </div>
                  
                  <Button 
                    size="icon"
                    className="rounded-full bg-green-600 h-10 w-10 hover:bg-green-700"
                    onClick={handleSendMessage}
                    disabled={!message.trim() || sendMessageMutation.isPending}
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </Button>
                </div>
                
                {/* Botones adicionales para envío */}
                {showSendButtons && (
                  <div className="flex gap-3 mt-2 pl-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 rounded-full"
                      title="Enviar imagen"
                    >
                      <Image className="h-4 w-4 text-gray-600" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 rounded-full"
                      title="Enviar documento"
                    >
                      <FileText className="h-4 w-4 text-gray-600" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 rounded-full"
                      title="Enviar audio"
                    >
                      <Mic className="h-4 w-4 text-gray-600" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 rounded-full"
                      title="Enviar contacto"
                    >
                      <Contact className="h-4 w-4 text-gray-600" />
                    </Button>
                    
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0 rounded-full ml-auto"
                          title="Configuración IA"
                        >
                          <Settings className="h-4 w-4 text-gray-600" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[220px] p-0" align="end">
                        <div className="px-1 py-2 grid gap-1">
                          <div 
                            className="px-2 py-1 text-sm hover:bg-gray-100 rounded cursor-pointer"
                            onClick={() => setShowGeminiConfig(true)}
                          >
                            Configurar asistente Gemini
                          </div>
                          <div 
                            className="px-2 py-1 text-sm hover:bg-gray-100 rounded cursor-pointer"
                            onClick={() => {
                              if (whatsappMessages.length > 0) {
                                handleAutoResponse(whatsappMessages[whatsappMessages.length - 1]);
                              } else {
                                toast({
                                  title: "No hay mensajes",
                                  description: "No hay mensajes disponibles para responder automáticamente",
                                  variant: "destructive"
                                });
                              }
                            }}
                          >
                            Generar respuesta automática
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Diálogo para mostrar código QR */}
      <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              Escanea este código QR con tu teléfono para conectar WhatsApp
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-center py-4">
            {selectedAccountQr !== null && (
              <WhatsAppQRCode accountId={selectedAccountQr} />
            )}
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cerrar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo de configuración de Gemini */}
      <Dialog open={showGeminiConfig} onOpenChange={setShowGeminiConfig}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configuración de asistente Gemini</DialogTitle>
            <DialogDescription>
              Configura cómo el asistente IA responderá a los mensajes
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {selectedChatId && currentAccountId !== null ? (
              <ChatGeminiConfig
                chatId={selectedChatId}
                isOpen={showGeminiConfig}
                onClose={() => setShowGeminiConfig(false)}
              />
            ) : (
              <p>Selecciona un chat para configurar las respuestas automáticas</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo para asignar chats */}
      {showChatAssignmentDialog && selectedChatId && (
        <ChatAssignmentDialog
          isOpen={showChatAssignmentDialog}
          onClose={() => setShowChatAssignmentDialog(false)}
          chatId={selectedChatId}
          accountId={currentAccountId || 0}
        />
      )}
    </div>
  );
}