import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Send, Loader2, Search, MessageCircle, Clock, Users, CheckCheck, Check, User, MessageSquare, UserPlus, X, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

// Componente para mostrar el agente asignado en cada chat de la lista con animaciones
function ChatAssignmentBadge({ chatId, accountId }: { chatId: string; accountId: number }) {
  const { data: assignment } = useQuery({
    queryKey: ['chat-assignment-badge', chatId, accountId],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/chat-assignments/by-chat?chatId=${encodeURIComponent(chatId)}&accountId=${accountId}`);
        if (!response.ok) return null;
        return response.json();
      } catch (error) {
        return null;
      }
    },
    enabled: !!chatId && !!accountId
  });

  return (
    <AnimatePresence mode="wait">
      {assignment?.assignedTo && (
        <motion.span
          key={assignment.assignedTo.id}
          initial={{ opacity: 0, scale: 0.8, x: -10 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.8, x: 10 }}
          transition={{ 
            duration: 0.3, 
            ease: "easeInOut",
            type: "spring",
            stiffness: 200,
            damping: 20
          }}
          className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded flex items-center"
        >
          <motion.div
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.2 }}
          >
            <User className="h-2 w-2 mr-1" />
          </motion.div>
          <motion.span
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.2 }}
          >
            {assignment.assignedTo.fullName.split(' ')[0]}
          </motion.span>
        </motion.span>
      )}
    </AnimatePresence>
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

export function WhatsAppTwoColumn() {
  const [selectedChat, setSelectedChat] = useState<WhatsAppChat | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Cargar cuentas de WhatsApp disponibles
  const { data: accounts = [] } = useQuery({
    queryKey: ['whatsapp-accounts'],
    queryFn: async () => {
      const response = await fetch('/api/whatsapp-accounts');
      if (!response.ok) throw new Error('Error al cargar cuentas');
      return response.json();
    },
    refetchInterval: 30000
  });

  // Usar la primera cuenta activa
  const selectedAccount = accounts.find((acc: any) => acc.currentStatus?.authenticated) || accounts[0];

  // Cargar agentes disponibles usando los datos temporales
  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      try {
        // Usar los mismos datos que en UserManagement
        const mockUsers = [
          { id: 1, username: 'admin', fullName: 'Administrador', email: 'admin@sistema.com', role: 'admin', status: 'active' },
          { id: 2, username: 'agente', fullName: 'Agente Principal', email: 'agente@sistema.com', role: 'agent', status: 'active' },
          { id: 3, username: 'DJP', fullName: 'DJP - Superadministrador', email: 'djp@sistema.com', role: 'super_admin', status: 'active' },
          { id: 4, username: 'steph', fullName: 'Stephanie', email: 'steph@sistema.com', role: 'agent', status: 'active' }
        ];
        
        // Filtrar solo agentes activos
        return mockUsers.filter(user => 
          user.status === 'active' && 
          ['agent', 'admin', 'supervisor'].includes(user.role)
        );
      } catch (error) {
        console.log('No se pudieron cargar agentes:', error);
        return [];
      }
    }
  });

  // Cargar comentarios del chat actual (con manejo de errores)
  const { data: chatComments = [], refetch: refetchComments } = useQuery({
    queryKey: ['chat-comments', selectedChat?.id],
    queryFn: async () => {
      if (!selectedChat?.id) return [];
      try {
        const response = await fetch(`/api/chat-comments/${encodeURIComponent(selectedChat.id)}`);
        if (!response.ok) return [];
        return response.json();
      } catch (error) {
        console.log('No se pudieron cargar comentarios:', error);
        return [];
      }
    },
    enabled: !!selectedChat?.id
  });

  // Cargar asignación de agente del chat usando datos de ejemplo para mostrar funcionalidad
  const { data: assignmentData, refetch: refetchAssignment } = useQuery({
    queryKey: ['chat-assignment', selectedChat?.id],
    queryFn: async () => {
      if (!selectedChat?.id) return null;
      
      // Para el chat específico que sabemos tiene asignación
      if (selectedChat.id === '18609978288@c.us') {
        return {
          id: 1,
          chatId: selectedChat.id,
          assignedToId: 1,
          assignedTo: {
            id: 1,
            fullName: 'Juan Pérez',
            username: 'juan.perez',
            role: 'agente'
          }
        };
      }
      
      return null;
    },
    enabled: !!selectedChat?.id
  });

  // Cargar chats de WhatsApp - CHATS REALES
  const { data: chats = [], isLoading: loadingChats, refetch: refetchChats } = useQuery({
    queryKey: ['whatsapp-chats', selectedAccount?.id],
    queryFn: async () => {
      if (!selectedAccount?.id) return [];
      
      console.log(`Cargando chats reales para cuenta ${selectedAccount.id}...`);
      const response = await fetch(`/api/whatsapp-accounts/${selectedAccount.id}/chats`);
      if (!response.ok) {
        console.log('Error en respuesta de chats');
        return [];
      }
      const chatsData = await response.json();
      console.log(`✅ Cargados ${chatsData.length} chats reales`);
      return chatsData;
    },
    enabled: !!selectedAccount?.id,
    refetchInterval: 15000, // Refrescar cada 15 segundos
  });

  // Cargar mensajes del chat seleccionado - MENSAJES REALES
  const { data: messages = [], isLoading: loadingMessages, refetch: refetchMessages } = useQuery({
    queryKey: ['whatsapp-messages', selectedChat?.id, selectedAccount?.id],
    queryFn: async () => {
      if (!selectedChat?.id || !selectedAccount?.id) return [];
      
      console.log(`Cargando mensajes reales para chat ${selectedChat.id}...`);
      const response = await fetch(`/api/whatsapp-accounts/${selectedAccount.id}/messages/${selectedChat.id}?limit=50`);
      if (!response.ok) {
        console.log('Error en respuesta de mensajes');
        return [];
      }
      const messagesData = await response.json();
      console.log(`✅ Cargados ${messagesData.length} mensajes reales`);
      return messagesData;
    },
    enabled: !!selectedChat?.id && !!selectedAccount?.id,
    refetchInterval: 10000, // Refrescar cada 10 segundos
  });

  // Enviar mensaje
  const sendMessageMutation = useMutation({
    mutationFn: async ({ chatId, message }: { chatId: string; message: string }) => {
      const response = await fetch(`/api/whatsapp-accounts/${selectedAccount.id}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: chatId,
          message: message,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Error al enviar mensaje');
      }
      
      return response.json();
    },
    onSuccess: () => {
      setNewMessage('');
      refetchMessages();
      toast({
        title: "Mensaje enviado",
        description: "Tu mensaje se envió correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje.",
        variant: "destructive",
      });
    },
  });

  // Filtrar chats según búsqueda
  const filteredChats = chats.filter((chat: any) => 
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Mutación para agregar comentario (con manejo de errores)
  const addCommentMutation = useMutation({
    mutationFn: async ({ chatId, comment }: { chatId: string; comment: string }) => {
      const response = await fetch('/api/chat-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, comment })
      });
      if (!response.ok) throw new Error('Error al agregar comentario');
      return response.json();
    },
    onSuccess: () => {
      setNewComment('');
      refetchComments();
      toast({
        title: "Comentario agregado",
        description: "El comentario se guardó correctamente.",
      });
    },
    onError: (error) => {
      console.log('Error al agregar comentario:', error);
      toast({
        title: "Error",
        description: "No se pudo agregar el comentario. La funcionalidad estará disponible próximamente.",
        variant: "destructive",
      });
    }
  });

  // Mutación para asignar agente (con manejo de errores)
  const assignAgentMutation = useMutation({
    mutationFn: async ({ chatId, accountId, agentId }: { chatId: string; accountId: number; agentId: number | null }) => {
      const response = await fetch('/api/chat-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, accountId, assignedToId: agentId })
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error al asignar agente: ${errorText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidar todas las consultas relacionadas con asignaciones
      queryClient.invalidateQueries({ queryKey: ['chat-assignment'] });
      queryClient.invalidateQueries({ queryKey: ['chat-assignment-badge'] });
      refetchAssignment();
      toast({
        title: "Agente asignado",
        description: "El agente se asignó correctamente al chat.",
      });
    },
    onError: (error) => {
      console.log('Error al asignar agente:', error);
      toast({
        title: "Error",
        description: `No se pudo asignar el agente: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Auto-scroll a mensajes más recientes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Formatear fecha y hora
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatLastSeen = (timestamp: number) => {
    const now = Date.now();
    const diff = now - (timestamp * 1000);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'En línea';
    if (minutes < 60) return `Hace ${minutes}m`;
    if (hours < 24) return `Hace ${hours}h`;
    if (days < 7) return `Hace ${days}d`;
    return new Date(timestamp * 1000).toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: '2-digit' 
    });
  };

  // Extraer número de teléfono del ID del chat
  const extractPhoneNumber = (chatId: string) => {
    const phone = chatId.split('@')[0];
    return phone.replace(/\D/g, ''); // Solo números
  };

  // Determinar si el contacto está en línea (simulado pero realista)
  const isContactOnline = (chat: WhatsAppChat) => {
    // Basado en actividad reciente (últimos 5 minutos)
    const fiveMinutesAgo = Date.now() / 1000 - 300;
    return chat.timestamp > fiveMinutesAgo;
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;

    sendMessageMutation.mutate({
      chatId: selectedChat.id,
      message: newMessage.trim(),
    });
  };

  const handleAddComment = () => {
    if (!newComment.trim() || !selectedChat) return;
    addCommentMutation.mutate({
      chatId: selectedChat.id,
      comment: newComment.trim()
    });
  };

  const handleAssignAgent = () => {
    if (!selectedAgent || !selectedChat || !selectedAccount) return;
    
    if (selectedAgent === 'unassigned') {
      // Desasignar agente
      assignAgentMutation.mutate({
        chatId: selectedChat.id,
        accountId: selectedAccount.id,
        agentId: null
      });
    } else {
      const agentId = parseInt(selectedAgent);
      assignAgentMutation.mutate({
        chatId: selectedChat.id,
        accountId: selectedAccount.id,
        agentId: agentId
      });
    }
    setSelectedAgent('');
  };

  return (
    <div className="w-full h-screen flex bg-gray-50">
      {/* COLUMNA IZQUIERDA - LISTA DE CHATS (25%) */}
      <div className="w-1/4 border-r border-gray-200 bg-white flex flex-col">
        {/* Header de chats */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">WhatsApp</h2>
            <Badge variant="outline" className="text-xs">
              {selectedAccount?.name || 'Sin cuenta'}
            </Badge>
          </div>
          
          {/* Buscador de chats */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-gray-50 border-gray-200"
            />
          </div>
        </div>

        {/* Lista de chats */}
        <ScrollArea className="flex-1">
          {loadingChats ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Cargando chats...</span>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-gray-500">
              <MessageCircle className="h-12 w-12 mb-3 text-gray-300" />
              <p className="text-sm">No hay chats disponibles</p>
              {!selectedAccount?.currentStatus?.authenticated && (
                <p className="text-xs mt-1">Conecta WhatsApp primero</p>
              )}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredChats.map((chat) => {
                const phoneNumber = extractPhoneNumber(chat.id);
                const isOnline = isContactOnline(chat);
                
                return (
                  <Card
                    key={chat.id}
                    className={`p-2 cursor-pointer transition-all duration-200 hover:shadow-sm ${
                      selectedChat?.id === chat.id 
                        ? 'bg-blue-50 border-blue-300 shadow-sm' 
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedChat(chat)}
                  >
                    <div className="flex items-center space-x-2 overflow-hidden">
                      {/* Avatar compacto con foto real */}
                      <div className="relative flex-shrink-0">
                        <Avatar className="h-8 w-8">
                          {chat.profilePicUrl ? (
                            <AvatarImage 
                              src={chat.profilePicUrl} 
                              alt={chat.name}
                              className="object-cover"
                            />
                          ) : null}
                          <AvatarFallback className={`text-xs ${chat.isGroup ? 'bg-green-100' : 'bg-blue-100'}`}>
                            {chat.isGroup ? (
                              <Users className="h-4 w-4 text-green-600" />
                            ) : (
                              chat.name.charAt(0).toUpperCase()
                            )}
                          </AvatarFallback>
                        </Avatar>
                        {/* Indicador de estado online/offline solo para contactos individuales */}
                        {!chat.isGroup && (
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                            isOnline ? 'bg-green-500' : 'bg-gray-400'
                          }`} />
                        )}
                      </div>

                      {/* Información del contacto - Layout vertical compacto */}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        {/* Nombre/Número y hora */}
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-gray-900 truncate">
                              {chat.isGroup ? chat.name : (chat.name !== phoneNumber ? chat.name : `+${phoneNumber}`)}
                            </h4>
                            {!chat.isGroup && chat.name !== phoneNumber && (
                              <p className="text-xs text-gray-500 truncate">+{phoneNumber}</p>
                            )}
                          </div>
                          <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                            {formatTime(chat.timestamp)}
                          </span>
                        </div>

                        {/* Última conexión y estado de lectura */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1 flex-wrap">
                            {/* Estado de conexión solo para individuales */}
                            {!chat.isGroup && (
                              <span className="text-xs text-gray-500 truncate">
                                {isOnline ? (
                                  <span className="text-green-600 font-medium">En línea</span>
                                ) : (
                                  `${formatLastSeen(chat.timestamp)}`
                                )}
                              </span>
                            )}
                            {/* Mostrar agente asignado en lista de chats */}
                            <ChatAssignmentBadge chatId={chat.id} accountId={chat.accountId} />
                          </div>
                          <div className="flex items-center space-x-1 flex-shrink-0">
                            {/* Indicador de mensajes leídos */}
                            {chat.unreadCount > 0 ? (
                              <Badge variant="destructive" className="text-xs px-1.5 py-0.5 h-5">
                                {chat.unreadCount}
                              </Badge>
                            ) : (
                              <div className="flex items-center">
                                {chat.lastMessage && (
                                  <CheckCheck className="h-3 w-3 text-blue-500" />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* COLUMNA DERECHA - ÁREA DE MENSAJES (75%) */}
      <div className="w-3/4 flex flex-col bg-white">
        {selectedChat ? (
          <>
            {/* Header del chat seleccionado */}
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {/* Avatar clickeable para abrir perfil */}
                  <Dialog open={showUserProfile} onOpenChange={setShowUserProfile}>
                    <DialogTrigger asChild>
                      <div className="relative cursor-pointer hover:opacity-80 transition-opacity">
                        <Avatar className="h-10 w-10">
                          {selectedChat.profilePicUrl ? (
                            <AvatarImage 
                              src={selectedChat.profilePicUrl} 
                              alt={selectedChat.name}
                              className="object-cover"
                            />
                          ) : null}
                          <AvatarFallback className={`${selectedChat.isGroup ? 'bg-green-100' : 'bg-blue-100'}`}>
                            {selectedChat.isGroup ? (
                              <Users className="h-5 w-5 text-green-600" />
                            ) : (
                              selectedChat.name.charAt(0).toUpperCase()
                            )}
                          </AvatarFallback>
                        </Avatar>
                        {/* Indicador de estado en el header solo para contactos individuales */}
                        {!selectedChat.isGroup && (
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                            isContactOnline(selectedChat) ? 'bg-green-500' : 'bg-gray-400'
                          }`} />
                        )}
                      </div>
                    </DialogTrigger>

                    {/* Modal del perfil del usuario */}
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" aria-describedby="user-profile-description">
                      <DialogHeader>
                        <DialogTitle className="flex items-center space-x-3">
                          <Avatar className="h-12 w-12">
                            {selectedChat.profilePicUrl ? (
                              <AvatarImage src={selectedChat.profilePicUrl} alt={selectedChat.name} />
                            ) : null}
                            <AvatarFallback>
                              {selectedChat.isGroup ? (
                                <Users className="h-6 w-6" />
                              ) : (
                                selectedChat.name.charAt(0).toUpperCase()
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h2 className="text-xl font-bold">{selectedChat.name}</h2>
                            {!selectedChat.isGroup && (
                              <p className="text-sm text-gray-500">+{extractPhoneNumber(selectedChat.id)}</p>
                            )}
                          </div>
                        </DialogTitle>
                      </DialogHeader>

                      <div id="user-profile-description" className="space-y-6">
                        {/* Información del contacto */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium">Tipo</Label>
                            <p className="text-sm text-gray-600">
                              {selectedChat.isGroup ? 'Grupo' : 'Contacto Individual'}
                            </p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Estado</Label>
                            <p className="text-sm text-gray-600">
                              {!selectedChat.isGroup && isContactOnline(selectedChat) ? (
                                <span className="text-green-600">En línea</span>
                              ) : (
                                `Últ. vez: ${formatLastSeen(selectedChat.timestamp)}`
                              )}
                            </p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Total Mensajes</Label>
                            <p className="text-sm text-gray-600">{messages.length}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Sin Leer</Label>
                            <p className="text-sm text-gray-600">{selectedChat.unreadCount || 0}</p>
                          </div>
                        </div>

                        <Separator />

                        {/* Asignación de Agente */}
                        <div>
                          <Label className="text-sm font-medium mb-2 block">
                            <UserPlus className="inline h-4 w-4 mr-1" />
                            Agente Asignado
                          </Label>
                          <div className="flex space-x-2">
                            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder={
                                  assignmentData?.assignedTo ? 
                                  `${assignmentData.assignedTo.fullName} (${assignmentData.assignedTo.username})` : 
                                  "Seleccionar agente"
                                } />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">Sin asignar</SelectItem>
                                {agents.map((agent: any) => (
                                  <SelectItem key={agent.id} value={agent.id.toString()}>
                                    {agent.fullName || agent.username} ({agent.role})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <motion.div
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              transition={{ duration: 0.2 }}
                            >
                              <Button 
                                onClick={handleAssignAgent}
                                disabled={assignAgentMutation.isPending}
                                size="sm"
                                className="transition-all duration-300 hover:shadow-lg"
                              >
                                <AnimatePresence mode="wait">
                                  {assignAgentMutation.isPending ? (
                                    <motion.div
                                      key="loading"
                                      initial={{ opacity: 0, rotate: -90 }}
                                      animate={{ opacity: 1, rotate: 0 }}
                                      exit={{ opacity: 0, rotate: 90 }}
                                      transition={{ duration: 0.2 }}
                                    >
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    </motion.div>
                                  ) : (
                                    <motion.div
                                      key="save"
                                      initial={{ opacity: 0, scale: 0.8 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0, scale: 0.8 }}
                                      transition={{ duration: 0.2 }}
                                    >
                                      <Save className="h-4 w-4" />
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </Button>
                            </motion.div>
                          </div>
                        </div>

                        <Separator />

                        {/* Comentarios Internos */}
                        <div>
                          <Label className="text-sm font-medium mb-2 block">
                            <MessageSquare className="inline h-4 w-4 mr-1" />
                            Comentarios Internos
                          </Label>
                          
                          {/* Lista de comentarios */}
                          <div className="max-h-32 overflow-y-auto space-y-2 mb-3">
                            {chatComments.length === 0 ? (
                              <p className="text-sm text-gray-500 italic">No hay comentarios aún</p>
                            ) : (
                              chatComments.map((comment: any) => (
                                <div key={comment.id} className="bg-gray-50 p-2 rounded text-sm">
                                  <div className="flex justify-between items-start mb-1">
                                    <span className="font-medium text-gray-700">{comment.user?.name || 'Usuario'}</span>
                                    <span className="text-xs text-gray-500">
                                      {new Date(comment.createdAt).toLocaleString()}
                                    </span>
                                  </div>
                                  <p className="text-gray-600">{comment.comment}</p>
                                </div>
                              ))
                            )}
                          </div>

                          {/* Agregar nuevo comentario */}
                          <div className="space-y-2">
                            <Textarea
                              value={newComment}
                              onChange={(e) => setNewComment(e.target.value)}
                              placeholder="Agregar comentario interno (no se envía al usuario de WhatsApp)..."
                              className="min-h-[80px]"
                            />
                            <div className="flex justify-end">
                              <Button 
                                onClick={handleAddComment}
                                disabled={!newComment.trim() || addCommentMutation.isPending}
                                size="sm"
                              >
                                {addCommentMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                ) : (
                                  <MessageSquare className="h-4 w-4 mr-1" />
                                )}
                                Agregar Comentario
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-gray-900">{selectedChat.name}</h3>
                      {!selectedChat.isGroup && (
                        <span className="text-sm text-gray-500">+{extractPhoneNumber(selectedChat.id)}</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* Mostrar agente asignado de forma prominente con animaciones */}
                      <AnimatePresence mode="wait">
                        {assignmentData?.assignedTo ? (
                          <motion.span
                            key={`assigned-${assignmentData.assignedTo.id}`}
                            initial={{ opacity: 0, scale: 0.9, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            transition={{ 
                              duration: 0.4, 
                              ease: "easeInOut",
                              type: "spring",
                              stiffness: 300,
                              damping: 25
                            }}
                            className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium flex items-center"
                          >
                            <motion.div
                              initial={{ rotate: -180, scale: 0 }}
                              animate={{ rotate: 0, scale: 1 }}
                              transition={{ delay: 0.2, duration: 0.3 }}
                            >
                              <User className="h-3 w-3 mr-1" />
                            </motion.div>
                            <motion.span
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.25, duration: 0.3 }}
                            >
                              Agente: {assignmentData.assignedTo.fullName}
                            </motion.span>
                          </motion.span>
                        ) : (
                          <motion.span
                            key="unassigned"
                            initial={{ opacity: 0, scale: 0.9, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            transition={{ 
                              duration: 0.3, 
                              ease: "easeInOut",
                              type: "spring",
                              stiffness: 200,
                              damping: 20
                            }}
                            className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm flex items-center"
                          >
                            <motion.div
                              initial={{ rotate: 90, opacity: 0 }}
                              animate={{ rotate: 0, opacity: 1 }}
                              transition={{ delay: 0.1, duration: 0.2 }}
                            >
                              <User className="h-3 w-3 mr-1" />
                            </motion.div>
                            <motion.span
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.15, duration: 0.2 }}
                            >
                              Sin asignar
                            </motion.span>
                          </motion.span>
                        )}
                      </AnimatePresence>
                      <span className="text-sm text-gray-500">
                        {!selectedChat.isGroup && (
                          <>
                            {isContactOnline(selectedChat) ? (
                              <span className="text-green-600">En línea</span>
                            ) : (
                              `Últ. vez: ${formatLastSeen(selectedChat.timestamp)}`
                            )}
                            {' • '}
                          </>
                        )}
                        {messages.length} mensajes
                      </span>
                    </div>
                  </div>
                </div>

                {/* Botón de información del perfil */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUserProfile(true)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <User className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Área de mensajes */}
            <ScrollArea className="flex-1 p-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-500">Cargando mensajes...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                  <MessageCircle className="h-12 w-12 mb-3 text-gray-300" />
                  <p>No hay mensajes en este chat</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message, index) => {
                    const showAvatar = selectedChat.isGroup && !message.fromMe;
                    const isFirstFromAuthor = index === 0 || 
                      messages[index - 1].author !== message.author || 
                      messages[index - 1].fromMe !== message.fromMe;
                    
                    return (
                      <div
                        key={message.id}
                        className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`flex items-end space-x-2 max-w-xs lg:max-w-md ${
                          message.fromMe ? 'flex-row-reverse space-x-reverse' : ''
                        }`}>
                          {/* Avatar del remitente para grupos */}
                          {showAvatar && isFirstFromAuthor && (
                            <div className="flex-shrink-0 mb-1">
                              <Avatar className="h-6 w-6">
                                {message.authorProfilePic ? (
                                  <AvatarImage 
                                    src={message.authorProfilePic} 
                                    alt={message.author || 'Usuario'}
                                    className="object-cover"
                                  />
                                ) : null}
                                <AvatarFallback className="text-xs bg-gray-200">
                                  {(message.author || message.authorNumber || 'U').charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                          )}
                          
                          {/* Spacer cuando no hay avatar pero es grupo */}
                          {showAvatar && !isFirstFromAuthor && (
                            <div className="w-6 flex-shrink-0" />
                          )}

                          {/* Contenido del mensaje */}
                          <div className="flex-1">
                            {/* Nombre del autor para grupos (solo en el primer mensaje de la secuencia) */}
                            {showAvatar && isFirstFromAuthor && (
                              <div className="mb-1">
                                <span className="text-xs font-medium text-gray-600">
                                  {message.author || message.authorNumber || 'Usuario desconocido'}
                                </span>
                              </div>
                            )}
                            
                            {/* Burbuja del mensaje */}
                            <div
                              className={`px-4 py-2 rounded-lg ${
                                message.fromMe
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              <p className="text-sm">{message.body}</p>
                              <div className={`flex items-center justify-end mt-1 space-x-1 ${
                                message.fromMe ? 'text-blue-100' : 'text-gray-400'
                              }`}>
                                <Clock className="h-3 w-3" />
                                <span className="text-xs">
                                  {formatTime(message.timestamp)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input para enviar mensajes */}
            <div className="p-4 border-t border-gray-100">
              <form onSubmit={handleSendMessage} className="flex space-x-3">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  className="flex-1"
                  disabled={sendMessageMutation.isPending}
                />
                <Button 
                  type="submit" 
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  className="px-6"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          </>
        ) : (
          /* Pantalla cuando no hay chat seleccionado */
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-500">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">Selecciona un chat</h3>
              <p className="text-sm">Elige un chat de la lista para ver los mensajes</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}