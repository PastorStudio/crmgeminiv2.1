import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageCircle, 
  Send, 
  User,
  Building,
  MessageSquareMore, 
  Clock, 
  Users, 
  Smartphone,
  Wifi,
  WifiOff,
  Star,
  MessageSquare,
  UserPlus,
  Settings,
  Bell,
  Calendar,
  Filter,
  Eye,
  EyeOff,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Volume2,
  VolumeX,
  Languages,
  Hash,
  File,
  Loader2,
  Zap,
  Ticket,
  Bot,
  Play
} from 'lucide-react';

// Import components
import { AccountSelector } from './AccountSelector';
import ChatAssignmentDialog from './ChatAssignmentDialog';
import { ChatCommentsDialog } from './ChatCommentsDialog';
import { ExternalAgentButton } from './ExternalAgentButton';
import { AgentSelector } from './AgentSelector';

import { VoiceNoteMessage } from './VoiceNoteMessage';
import { SmartMessageGrouping } from './SmartMessageGrouping';



function ChatAssignmentBadge({ chatId, accountId }: { chatId: string; accountId: number }) {
  const { data: assignmentResponse } = useQuery({
    queryKey: ['/api/chat-assignments', chatId],
    queryFn: () => fetch(`/api/chat-assignments/${encodeURIComponent(chatId)}`).then(res => res.json()),
    enabled: !!chatId
  });

  // Cargar lista de agentes para obtener el nombre
  const { data: usersResponse } = useQuery({
    queryKey: ['/api/users'],
    staleTime: 60000, // Cache por 1 minuto
  });

  // Si no hay asignación, no mostrar nada
  if (!assignmentResponse?.success || !assignmentResponse?.assignment) {
    return null;
  }

  const assignment = assignmentResponse.assignment;
  const users = usersResponse?.users || [];
  
  // Buscar el nombre del agente
  const assignedAgent = users.find((user: any) => user.id === assignment.agentId);
  const agentName = assignedAgent?.name || `Agente ${assignment.agentId}`;

  return (
    <Badge 
      variant="secondary" 
      className="text-xs bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200 transition-colors"
    >
      <User className="h-3 w-3 mr-1" />
      {agentName}
    </Badge>
  );
}

function AgentAssignmentDisplay({ chatId }: { chatId: string }) {
  const { data: assignmentResponse } = useQuery({
    queryKey: ['/api/chat-assignments', chatId],
    queryFn: () => fetch(`/api/chat-assignments/${encodeURIComponent(chatId)}`).then(res => res.json()),
    enabled: !!chatId
  });

  // Cargar lista de agentes para obtener el nombre
  const { data: usersResponse } = useQuery({
    queryKey: ['/api/users'],
    staleTime: 60000, // Cache por 1 minuto
  });

  // Si no hay asignación, no mostrar nada
  if (!assignmentResponse?.success || !assignmentResponse?.assignment) {
    return (
      <div className="text-xs text-gray-500 italic">
        Sin agente asignado
      </div>
    );
  }

  const assignment = assignmentResponse.assignment;
  const users = usersResponse?.users || [];
  
  // Buscar el nombre del agente
  const assignedAgent = users.find((user: any) => user.id === assignment.agentId);
  const agentName = assignedAgent?.name || `Agente ${assignment.agentId}`;

  return (
    <div className="flex items-center space-x-2">
      <div className="flex items-center space-x-1 text-xs text-blue-600">
        <User className="h-3 w-3" />
        <span className="font-medium">{agentName}</span>
      </div>
      {assignment.createdAt && (
        <div className="text-xs text-gray-400">
          desde {new Date(assignment.createdAt).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}

function ChatCategorizationBadge({ chatId, accountId }: { chatId: string; accountId: number }) {
  const { data: ticketsResponse } = useQuery({
    queryKey: ['/api/tickets', { chatId }],
    queryFn: () => fetch(`/api/tickets?chatId=${encodeURIComponent(chatId)}`).then(res => res.json()),
    enabled: !!chatId
  });

  // Verificar si hay tickets para este chat
  const tickets = ticketsResponse?.tickets || [];
  const hasTickets = tickets.length > 0;

  // Solo mostrar si hay tickets
  if (!hasTickets) {
    return null;
  }

  const ticketCount = tickets.length;
  const latestTicket = tickets[0]; // Asumiendo que están ordenados por fecha

  return (
    <Badge 
      variant="secondary" 
      className="text-xs bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200 transition-colors"
    >
      <Ticket className="h-3 w-3 mr-1" />
      {ticketCount} ticket{ticketCount !== 1 ? 's' : ''}
    </Badge>
  );
}

function ChatCommentsIndicator({ chatId }: { chatId: string }) {
  const { data: commentsResponse } = useQuery({
    queryKey: ['/api/chat-comments', chatId],
    queryFn: () => fetch(`/api/chat-comments/${encodeURIComponent(chatId)}`).then(res => res.json()),
    enabled: !!chatId
  });

  const comments = commentsResponse?.comments || [];
  const hasComments = comments.length > 0;

  // Solo mostrar el indicador si hay comentarios
  if (!hasComments) {
    return null;
  }

  return (
    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
  );
}

interface WhatsAppChat {
  id: string;
  name: string;
  isGroup: boolean;
  timestamp: number;
  unreadCount: number;
  lastMessage: string;
  accountId: number;
  isOnline?: boolean;
  lastSeen?: number;
  messageRead?: boolean;
  profilePicUrl?: string;
}

interface WhatsAppMessage {
  id: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  hasMedia: boolean;
  type: string;
  author?: string;
  chatId: string;
  authorProfilePic?: string;
  authorNumber?: string;
}

interface WhatsAppAccount {
  id: number;
  name: string;
  phone: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  lastSeen?: Date;
  messageCount?: number;
  profilePicUrl?: string;
}

export function WhatsAppTwoColumn() {
  const queryClient = useQueryClient();
  const [selectedChat, setSelectedChat] = useState<WhatsAppChat | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [externalAgentActive, setExternalAgentActive] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [commentsDialogOpen, setCommentsDialogOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [translatorEnabled, setTranslatorEnabled] = useState(false);
  const [smartBotsEnabled, setSmartBotsEnabled] = useState(false);
  const [selectedExternalAgent, setSelectedExternalAgent] = useState<string>('');
  const [showSmartGrouping, setShowSmartGrouping] = useState(false);

  const [autoSendTimer, setAutoSendTimer] = useState<NodeJS.Timeout | null>(null);
  const [isAutoSending, setIsAutoSending] = useState(false);

  const handleChatSelect = async (chat: WhatsAppChat) => {
    setSelectedChat(chat);
    setNewMessage('');
    
    // Marcar como leído
    try {
      await fetch(`/api/whatsapp/${chat.accountId}/chats/${encodeURIComponent(chat.id)}/mark-read`, {
        method: 'POST',
      });
      
      // Refrescar la lista de chats
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
    } catch (error) {
      console.error('Error al marcar como leído:', error);
    }
  };

  const isContactOnline = (chat: WhatsAppChat) => {
    if (!chat.lastSeen) return false;
    
    const now = Date.now();
    const lastSeenTime = new Date(chat.lastSeen).getTime();
    const timeDiff = now - lastSeenTime;
    
    // Considerar online si fue visto en los últimos 5 minutos
    return timeDiff < 5 * 60 * 1000;
  };

  // Cargar cuentas WhatsApp
  const { data: accountsData, isLoading: loadingAccounts } = useQuery({
    queryKey: ['/api/whatsapp-accounts'],
    staleTime: 30000,
  });

  // Cargar chats de las cuentas seleccionadas
  const { data: chatsData, isLoading: loadingChats } = useQuery({
    queryKey: ['/api/whatsapp/chats', selectedAccounts],
    queryFn: async () => {
      if (selectedAccounts.length === 0) return { chats: [] };
      
      const allChats = [];
      for (const accountId of selectedAccounts) {
        try {
          const response = await fetch(`/api/whatsapp/${accountId}/chats`);
          const data = await response.json();
          if (data.chats) {
            // Agregar accountId a cada chat
            const chatsWithAccount = data.chats.map((chat: WhatsAppChat) => ({
              ...chat,
              accountId
            }));
            allChats.push(...chatsWithAccount);
          }
        } catch (error) {
          console.error(`Error loading chats for account ${accountId}:`, error);
        }
      }
      return { chats: allChats };
    },
    enabled: selectedAccounts.length > 0,
    staleTime: 10000,
  });

  // Cargar mensajes del chat seleccionado
  const { data: messagesData, isLoading: loadingMessages } = useQuery({
    queryKey: ['/api/whatsapp/messages', selectedChat?.accountId, selectedChat?.id],
    queryFn: () => fetch(`/api/whatsapp/${selectedChat?.accountId}/chats/${encodeURIComponent(selectedChat?.id || '')}/messages`).then(res => res.json()),
    enabled: !!selectedChat,
    staleTime: 5000,
  });

  // Cargar comentarios del chat seleccionado
  const { data: commentsData } = useQuery({
    queryKey: ['/api/chat-comments', selectedChat?.id],
    queryFn: () => fetch(`/api/chat-comments/${encodeURIComponent(selectedChat?.id || '')}`).then(res => res.json()),
    enabled: !!selectedChat,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ accountId, chatId, message }: { accountId: number; chatId: string; message: string }) => {
      const response = await fetch(`/api/whatsapp/${accountId}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId,
          message,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Error al enviar mensaje');
      }
      
      return response.json();
    },
    onSuccess: () => {
      setNewMessage('');
      // Refrescar mensajes
      queryClient.invalidateQueries({ 
        queryKey: ['/api/whatsapp/messages', selectedChat?.accountId, selectedChat?.id] 
      });
      // Refrescar lista de chats para actualizar último mensaje
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
    },
    onError: (error) => {
      console.error('Error sending message:', error);
    },
  });

  const handleSendMessage = useCallback(() => {
    if (!selectedChat || !newMessage.trim() || sendMessageMutation.isPending) return;

    sendMessageMutation.mutate({
      accountId: selectedChat.accountId,
      chatId: selectedChat.id,
      message: newMessage.trim(),
    });
  }, [selectedChat, newMessage, sendMessageMutation]);

  // Auto-envío con delay de 5 segundos
  useEffect(() => {
    if (newMessage.trim() && selectedChat) {
      // Limpiar timer anterior si existe
      if (autoSendTimer) {
        clearTimeout(autoSendTimer);
        setAutoSendTimer(null);
        setIsAutoSending(false);
      }

      // Configurar nuevo timer
      setIsAutoSending(true);
      const timer = setTimeout(() => {
        handleSendMessage();
        setIsAutoSending(false);
        setAutoSendTimer(null);
      }, 5000);

      setAutoSendTimer(timer);
    } else {
      // Limpiar timer si no hay mensaje
      if (autoSendTimer) {
        clearTimeout(autoSendTimer);
        setAutoSendTimer(null);
        setIsAutoSending(false);
      }
    }

    // Cleanup al desmontar
    return () => {
      if (autoSendTimer) {
        clearTimeout(autoSendTimer);
      }
    };
  }, [newMessage, selectedChat, handleSendMessage]);

  // Procesar respuesta automática cuando hay un agente externo seleccionado
  const processAutoResponse = useCallback(async () => {
    if (!selectedChat || !smartBotsEnabled || !selectedExternalAgent) {
      console.log('❌ No se puede procesar respuesta automática:', {
        selectedChat: !!selectedChat,
        smartBotsEnabled,
        selectedExternalAgent
      });
      return;
    }

    try {
      console.log('🤖 Procesando respuesta automática...');
      const response = await fetch('/api/simple/process-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: selectedChat.id,
          accountId: selectedChat.accountId,
          externalAgentId: selectedExternalAgent,
        }),
      });

      const data = await response.json();
      console.log('🤖 Respuesta del agente:', data);

      if (data.success && data.response) {
        // Simular escribir la respuesta del agente
        setNewMessage(data.response);
        console.log('✅ Respuesta del agente establecida:', data.response);
      }
    } catch (error) {
      console.error('❌ Error procesando respuesta automática:', error);
    }
  }, [selectedChat, smartBotsEnabled, selectedExternalAgent]);

  // Función para obtener el ID del último mensaje entrante (no enviado por nosotros)
  const getLastIncomingMessageId = (messages: WhatsAppMessage[]) => {
    // Filtrar mensajes que no son de nosotros y obtener el más reciente
    const incomingMessages = messages.filter(msg => !msg.fromMe);
    return incomingMessages.length > 0 ? incomingMessages[incomingMessages.length - 1].id : null;
  };

  // Auto-procesar último mensaje recibido cuando hay agente asignado
  useEffect(() => {
    if (messagesData?.messages && smartBotsEnabled && selectedExternalAgent && selectedChat) {
      const messages = messagesData.messages;
      const lastIncomingMessageId = getLastIncomingMessageId(messages);
      
      if (lastIncomingMessageId) {
        console.log('🔄 Nuevo mensaje detectado, procesando respuesta automática...');
        processAutoResponse();
      }
    }
  }, [messagesData?.messages, smartBotsEnabled, selectedExternalAgent, selectedChat, processAutoResponse]);

  const accounts = accountsData?.accounts || [];
  const chats = chatsData?.chats || [];
  const messages = messagesData?.messages || [];
  const chatComments = commentsData?.comments || [];

  // Ordenar chats por timestamp (más reciente primero)
  const sortedChats = useMemo(() => {
    return [...chats].sort((a, b) => b.timestamp - a.timestamp);
  }, [chats]);

  // Auto-seleccionar primera cuenta disponible al cargar
  useEffect(() => {
    if (accounts.length > 0 && selectedAccounts.length === 0) {
      const connectedAccounts = accounts.filter((acc: any) => acc.status === 'connected');
      if (connectedAccounts.length > 0) {
        setSelectedAccounts([connectedAccounts[0].id]);
      } else {
        // Si no hay cuentas conectadas, seleccionar la primera disponible
        setSelectedAccounts([accounts[0].id]);
      }
    }
  }, [accounts, selectedAccounts]);

  // Auto-seleccionar primer chat cuando cambian las cuentas
  useEffect(() => {
    if (sortedChats.length > 0 && !selectedChat) {
      // No auto-seleccionar chat para mantener la interfaz limpia
      // setSelectedChat(sortedChats[0]);
    }
  }, [sortedChats, selectedChat]);

  // Invalidar queries cada 30 segundos para mantener datos actualizados
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      if (selectedChat) {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/whatsapp/messages', selectedChat.accountId, selectedChat.id] 
        });
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [queryClient, selectedAccounts]);

  const filteredChats = sortedChats.filter(chat => 
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loadingAccounts) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Cargando cuentas WhatsApp...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Panel - Chat List */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        {/* Header with Account Selector */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <MessageCircle className="h-5 w-5 mr-2 text-green-600" />
                WhatsApp CRM
              </h2>
            </div>
            
            <AccountSelector
              accounts={accounts}
              selectedAccounts={selectedAccounts}
              onSelectionChange={setSelectedAccounts}
            />
            
            {/* Search */}
            <div className="relative">
              <Input
                type="text"
                placeholder="Buscar conversaciones..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MessageCircle className="h-4 w-4 text-gray-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Chat List */}
        <ScrollArea className="flex-1">
          {loadingChats ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Cargando chats...</span>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <MessageCircle className="h-12 w-12 mb-3 text-gray-300" />
              <p>No hay conversaciones disponibles</p>
              <p className="text-sm text-gray-400 mt-1">
                {selectedAccounts.length === 0 ? 'Selecciona una cuenta' : 'No se encontraron chats'}
              </p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {filteredChats.map((chat) => (
                <motion.div
                  key={chat.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`p-3 rounded-lg cursor-pointer transition-all duration-200 hover:bg-gray-50 ${
                    selectedChat?.id === chat.id ? 'bg-blue-50 border border-blue-200' : ''
                  }`}
                  onClick={() => handleChatSelect(chat)}
                >
                  <div className="flex items-start space-x-3">
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={chat.profilePicUrl} />
                        <AvatarFallback className="bg-gray-200 text-gray-600">
                          {chat.isGroup ? (
                            <Users className="h-6 w-6" />
                          ) : (
                            chat.name.charAt(0).toUpperCase()
                          )}
                        </AvatarFallback>
                      </Avatar>
                      {isContactOnline(chat) && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {chat.name}
                        </h3>
                        <span className="text-xs text-gray-500">
                          {new Date(chat.timestamp).toLocaleTimeString('es', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-600 truncate mt-1">
                        {chat.lastMessage}
                      </p>
                      
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center space-x-2">
                          {chat.isGroup && (
                            <Badge variant="secondary" className="text-xs">
                              <Users className="h-3 w-3 mr-1" />
                              Grupo
                            </Badge>
                          )}
                          
                          <ChatAssignmentBadge chatId={chat.id} accountId={chat.accountId} />
                          <ChatCategorizationBadge chatId={chat.id} accountId={chat.accountId} />
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <ChatCommentsIndicator chatId={chat.id} />
                          {chat.unreadCount > 0 && (
                            <Badge className="bg-green-600 text-white text-xs min-w-[20px] h-5 rounded-full flex items-center justify-center">
                              {chat.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right Panel - Chat View */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-white border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedChat.profilePicUrl} />
                    <AvatarFallback className="bg-gray-200 text-gray-600">
                      {selectedChat.isGroup ? (
                        <Users className="h-5 w-5" />
                      ) : (
                        selectedChat.name.charAt(0).toUpperCase()
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-medium text-gray-900">{selectedChat.name}</h3>
                    <div className="flex items-center space-x-2">
                      {isContactOnline(selectedChat) ? (
                        <div className="flex items-center text-xs text-green-600">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                          En línea
                        </div>
                      ) : selectedChat.lastSeen ? (
                        <div className="text-xs text-gray-500">
                          Visto por última vez: {new Date(selectedChat.lastSeen).toLocaleString('es')}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">
                          Estado no disponible
                        </div>
                      )}
                      <AgentAssignmentDisplay chatId={selectedChat.id} />
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {/* Asignar Agente Button */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-blue-600 text-blue-600 hover:bg-blue-50 shadow-sm transition-all duration-300"
                      onClick={() => setAssignmentDialogOpen(true)}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Asignar
                    </Button>
                  </motion.div>
                  
                  {/* SELECTOR DE AGENTE EXTERNO */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                  >
                    <AgentSelector 
                      chatId={selectedChat.id}
                      accountId={selectedChat.accountId}
                      onAgentChange={(agentId) => {
                        console.log('🤖 Agente seleccionado:', agentId);
                        // Actualizar ambos estados para activar respuestas automáticas
                        setExternalAgentActive(!!agentId);
                        setSmartBotsEnabled(!!agentId);
                        setSelectedExternalAgent(agentId || '');
                        
                        console.log('✅ Estados actualizados:', {
                          agentId,
                          smartBotsEnabled: !!agentId,
                          externalAgentActive: !!agentId
                        });
                      }}
                    />
                  </motion.div>

                  {/* Smart Grouping Toggle */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.15 }}
                  >
                    <Button
                      size="sm"
                      variant={showSmartGrouping ? "default" : "outline"}
                      className={`transition-all duration-300 ${
                        showSmartGrouping 
                          ? 'bg-purple-600 text-white hover:bg-purple-700 border-purple-600' 
                          : 'border-purple-600 text-purple-600 hover:bg-purple-50'
                      } shadow-sm`}
                      onClick={() => setShowSmartGrouping(!showSmartGrouping)}
                    >
                      <Hash className="h-4 w-4 mr-2" />
                      {showSmartGrouping ? 'Normal' : 'Agrupar'}
                    </Button>
                  </motion.div>

                  {/* Comments Button */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-orange-600 text-orange-600 hover:bg-orange-50 shadow-sm transition-all duration-300 relative"
                      onClick={() => setCommentsDialogOpen(true)}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Comentarios
                      {chatComments.length > 0 && (
                        <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                          {chatComments.length}
                        </span>
                      )}
                    </Button>
                  </motion.div>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-500">Cargando mensajes...</span>
                </div>
              ) : (!messages || !Array.isArray(messages) || messages.length === 0) ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                  <MessageCircle className="h-12 w-12 mb-3 text-gray-300" />
                  <p>No hay mensajes en este chat</p>
                </div>
              ) : showSmartGrouping ? (
                <SmartMessageGrouping 
                  messages={messages}
                  onMessageClick={(message) => {
                    console.log('Mensaje seleccionado:', message);
                  }}
                  onGroupClick={(group) => {
                    console.log('Grupo seleccionado:', group);
                  }}
                />
              ) : (
                <div className="space-y-4">
                  {messages.map((message, index) => {
                    const showAvatar = selectedChat.isGroup && !message.fromMe;
                    const isFirstFromAuthor = index === 0 || 
                      messages[index - 1].author !== message.author || 
                      messages[index - 1].fromMe !== message.fromMe;
                    
                    // Identificar si este es el último mensaje recibido (no enviado por nosotros)
                    const lastIncomingMessageId = getLastIncomingMessageId(messages);
                    const isLastIncomingMessage = !message.fromMe && message.id === lastIncomingMessageId;
                    
                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className={`flex ${message.fromMe ? 'justify-end pt-[-34px] pb-[-34px] mt-[6px] mb-[6px] ml-[-4px] mr-[-4px] pl-[-20px] pr-[-20px] text-[14px]' : 'justify-start pt-[-34px] pb-[-34px] mt-[6px] mb-[6px] ml-[-4px] mr-[-4px] pl-[-20px] pr-[-20px] text-[14px]'}`}
                      >
                        <div className={`flex space-x-2 max-w-[80%] ${message.fromMe ? 'flex-row-reverse space-x-reverse' : ''}`}>
                          {showAvatar && isFirstFromAuthor && (
                            <Avatar className="h-8 w-8 mt-1">
                              <AvatarImage src={message.authorProfilePic} />
                              <AvatarFallback className="text-xs bg-gray-200">
                                {message.author?.charAt(0).toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          
                          <div className={`rounded-lg px-3 py-2 ${
                            message.fromMe 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-gray-200 text-gray-900'
                          }`}>
                            {showAvatar && isFirstFromAuthor && (
                              <div className="text-xs font-medium mb-1 opacity-70">
                                {message.author}
                              </div>
                            )}
                            
                            {message.type === 'audio' && message.hasMedia ? (
                              <VoiceNoteMessage message={message} />
                            ) : message.hasMedia ? (
                              <div className="flex items-center space-x-2 mb-2">
                                <File className="h-4 w-4" />
                                <span className="text-sm">Archivo multimedia</span>
                              </div>
                            ) : null}
                            
                            <div className="text-sm whitespace-pre-wrap break-words">{message.body}</div>
                            
                            <div className={`text-xs mt-1 flex items-center justify-end space-x-1 ${
                              message.fromMe ? 'text-blue-100' : 'text-gray-500'
                            }`}>
                              <span>
                                {new Date(message.timestamp).toLocaleTimeString('es', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </span>
                              {message.fromMe && (
                                <div className="text-blue-100">✓</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 bg-white border-t border-gray-200">
              <div className="flex space-x-2">
                <Input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  className="flex-1"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              
              {isAutoSending && (
                <div className="mt-2 text-xs text-blue-600 flex items-center">
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  Enviando automáticamente en 5 segundos...
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-500">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">Selecciona una conversación</h3>
              <p>Elige un chat de la lista para empezar a conversar</p>
            </div>
          </div>
        )}
      </div>
      {/* Dialogs */}
      {selectedChat && (
        <ChatAssignmentDialog
          open={assignmentDialogOpen}
          onOpenChange={setAssignmentDialogOpen}
          chatId={selectedChat.id}
          accountId={selectedChat.accountId}
        />
      )}

      {selectedChat && (
        <ChatCommentsDialog
          open={commentsDialogOpen}
          onOpenChange={setCommentsDialogOpen}
          chatId={selectedChat.id}
          chatName={selectedChat.name}
        />
      )}

    </div>
  );
}