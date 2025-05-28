import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { motion, AnimatePresence } from 'framer-motion';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  Send,
  Phone,
  Video,
  MoreVertical,
  MessageCircle,
  CheckCircle2,
  User,
  Clock,
  Bot,
  Globe,
  MessageSquare,
  Users,
  Calendar,
  Hash,
  UserCheck,
  MessageCircleHeart,
  Bell,
  Tag,
  AlertCircle,
  CheckCircle2 as CheckIcon,
  Smile,
  Paperclip,
  Languages,
  Image,
  FileText,
  Video as VideoIcon,
  File,
  Loader2,
  Ticket,
  Play
} from 'lucide-react';

// Import components
import { AccountSelector } from './AccountSelector';
import ChatAssignmentDialog from './ChatAssignmentDialog';
import { ChatCommentsDialog } from './ChatCommentsDialog';
import { ExternalAgentButton } from './ExternalAgentButton';
import { AgentSelector } from './AgentSelector';
import { VoiceNoteMessage } from './VoiceNoteMessage';

function ChatAssignmentBadge({ chatId, accountId }: { chatId: string; accountId: number }) {
  const { data: assignmentResponse } = useQuery({
    queryKey: ['/api/chat-assignments', chatId],
    queryFn: () => fetch(`/api/chat-assignments/${encodeURIComponent(chatId)}`).then(res => res.json()),
    enabled: !!chatId
  });

  const { data: usersResponse } = useQuery({
    queryKey: ['/api/users'],
    staleTime: 60000,
  });

  const users = usersResponse?.users || usersResponse || [];
  const assignment = assignmentResponse;

  if (!assignment || !assignment.assignedToId) {
    return (
      <div className="flex items-center space-x-1">
        <User className="h-3 w-3 text-gray-400" />
      </div>
    );
  }

  const assignedUser = users.find((user: any) => user.id === assignment.assignedToId);
  const userName = assignedUser ? assignedUser.name : `Usuario ${assignment.assignedToId}`;

  return (
    <div className="flex items-center space-x-1">
      <User className="h-3 w-3 text-green-600" />
      <span className="text-xs text-green-600 font-medium">{userName}</span>
    </div>
  );
}

function AgentAssignmentDisplay({ chatId }: { chatId: string }) {
  const { data: agentData } = useQuery({
    queryKey: ['/api/agent-assignments', chatId],
    queryFn: () => fetch(`/api/agent-assignments/${encodeURIComponent(chatId)}`).then(res => res.json()),
    enabled: !!chatId
  });

  if (!agentData?.success || !agentData?.agent) {
    return null;
  }

  return (
    <div className="flex items-center space-x-1">
      <Bot className="h-3 w-3 text-blue-600" />
      <span className="text-xs text-blue-600 font-medium">{agentData.agent.name}</span>
    </div>
  );
}

function ChatCategorizationBadge({ chatId, accountId }: { chatId: string; accountId: number }) {
  const { data: categorizationData } = useQuery({
    queryKey: ['/api/chat-categorization', chatId],
    queryFn: () => fetch(`/api/chat-categorization/${encodeURIComponent(chatId)}`).then(res => res.json()),
    enabled: !!chatId
  });

  if (!categorizationData?.success || !categorizationData?.category) {
    return null;
  }

  const categoryColors = {
    'lead': 'bg-green-100 text-green-800',
    'support': 'bg-blue-100 text-blue-800',
    'sales': 'bg-purple-100 text-purple-800',
    'general': 'bg-gray-100 text-gray-800'
  };

  const categoryColor = categoryColors[categorizationData.category as keyof typeof categoryColors] || 'bg-gray-100 text-gray-800';

  return (
    <Badge className={`text-xs ${categoryColor} border-0`}>
      {categorizationData.category}
    </Badge>
  );
}

function ChatCommentsIndicator({ chatId }: { chatId: string }) {
  const { data: commentsData } = useQuery({
    queryKey: ['/api/chat-comments', chatId],
    queryFn: () => fetch(`/api/chat-comments/${encodeURIComponent(chatId)}`).then(res => res.json()),
    enabled: !!chatId
  });

  const hasComments = commentsData?.success && commentsData?.comments?.length > 0;

  if (!hasComments) {
    return null;
  }

  return (
    <div className="flex items-center">
      <MessageCircleHeart className="h-3 w-3 text-orange-500" />
    </div>
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
  const [selectedChat, setSelectedChat] = useState<WhatsAppChat | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [commentsDialogOpen, setCommentsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [translatorEnabled, setTranslatorEnabled] = useState(false);
  const [smartBotsEnabled, setSmartBotsEnabled] = useState(false);
  const [selectedExternalAgent, setSelectedExternalAgent] = useState<string>('');

  const { toast } = useToast();

  // Query for accounts
  const { data: accounts, isLoading: loadingAccounts } = useQuery({
    queryKey: ['/api/whatsapp/accounts'],
    staleTime: 30000,
  });

  // Query for chats
  const { data: chats, isLoading: loadingChats } = useQuery({
    queryKey: ['/api/whatsapp/chats', selectedAccounts],
    enabled: selectedAccounts.length > 0,
  });

  // Query for messages
  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ['/api/whatsapp-accounts', selectedChat?.accountId, 'messages', selectedChat?.id],
    enabled: !!selectedChat,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { chatId: string; accountId: number; message: string }) => {
      const response = await fetch('/api/whatsapp/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to send message');
      return response.json();
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/messages', selectedChat?.id] });
      toast({
        title: "Mensaje enviado",
        description: "Tu mensaje ha sido enviado exitosamente"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje",
        variant: "destructive"
      });
    }
  });

  // WebSocket connection for real-time notifications
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/notifications`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('🔔 Conectado a notificaciones en tiempo real');
      socket.send(JSON.stringify({ type: 'subscribe' }));
    };

    socket.onmessage = (event) => {
      try {
        const notification = JSON.parse(event.data);
        
        // Show toast notification only for errors
        if (notification.type === 'error') {
          toast({
            title: notification.title,
            description: notification.message,
            variant: "destructive",
            duration: 5000
          });
        }

        // Refresh relevant queries based on notification type
        if (notification.type === 'new_message' && notification.chatId) {
          queryClient.invalidateQueries({
            queryKey: ['/api/whatsapp-accounts', notification.accountId, 'messages', notification.chatId]
          });
        }
      } catch (error) {
        console.error('Error parsing notification:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    socket.onclose = () => {
      console.log('🔔 Desconectado de notificaciones');
    };

    return () => {
      socket.close();
    };
  }, [toast]);

  // Handle chat selection
  const handleChatSelect = async (chat: WhatsAppChat) => {
    setSelectedChat(chat);
    setNewMessage('');
  };

  // Check if contact is online
  const isContactOnline = (chat: WhatsAppChat) => {
    if (chat.isOnline) return true;
    if (chat.lastSeen) {
      const lastSeenTime = new Date(chat.lastSeen).getTime();
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      return (now - lastSeenTime) < fiveMinutes;
    }
    return false;
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;

    sendMessageMutation.mutate({
      chatId: selectedChat.id,
      accountId: selectedChat.accountId,
      message: newMessage.trim()
    });
  };

  // Handle account selection
  const handleAccountSelection = (accountId: number) => {
    setSelectedAccounts(prev => 
      prev.includes(accountId) 
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
    setSelectedChat(null);
  };

  // Filter chats based on search
  const filteredChats = chats?.filter((chat: WhatsAppChat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Panel - Chats List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-900">WhatsApp Business</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowUserProfile(true)}
              className="text-gray-500 hover:text-gray-700"
            >
              <User className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Account Selector */}
        <div className="p-4 border-b border-gray-100">
          <AccountSelector 
            accounts={accounts || []}
            selectedAccounts={selectedAccounts}
            onAccountSelect={handleAccountSelection}
            loading={loadingAccounts}
          />
        </div>

        {/* Chats List */}
        <ScrollArea className="flex-1">
          {loadingChats ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-gray-500">
              <MessageCircle className="h-12 w-12 mb-3 text-gray-300" />
              <p>No hay chats disponibles</p>
              <p className="text-sm">Selecciona una cuenta de WhatsApp</p>
            </div>
          ) : (
            <div className="p-2">
              {filteredChats.map((chat: WhatsAppChat) => (
                <Card
                  key={chat.id}
                  className={`mb-2 cursor-pointer transition-all duration-200 hover:shadow-md ${
                    selectedChat?.id === chat.id ? 'ring-2 ring-green-500 bg-green-50' : ''
                  }`}
                  onClick={() => handleChatSelect(chat)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start space-x-3">
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={chat.profilePicUrl} />
                          <AvatarFallback className="bg-green-100 text-green-600">
                            {chat.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {isContactOnline(chat) && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-medium text-gray-900 truncate">{chat.name}</h3>
                          <span className="text-xs text-gray-500">
                            {new Date(chat.timestamp).toLocaleTimeString('es-ES', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </span>
                        </div>
                        
                        <p className="text-sm text-gray-600 truncate mb-2">{chat.lastMessage}</p>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <ChatAssignmentBadge chatId={chat.id} accountId={chat.accountId} />
                            <AgentAssignmentDisplay chatId={chat.id} />
                            <ChatCommentsIndicator chatId={chat.id} />
                            <ChatCategorizationBadge chatId={chat.id} accountId={chat.accountId} />
                          </div>
                          
                          {chat.unreadCount > 0 && (
                            <Badge className="bg-green-500 text-white text-xs px-2 py-0.5">
                              {chat.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right Panel - Chat Messages */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={selectedChat.profilePicUrl} />
                      <AvatarFallback className="bg-green-100 text-green-600">
                        {selectedChat.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {isContactOnline(selectedChat) && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                  
                  <div>
                    <h2 className="font-semibold text-gray-900">{selectedChat.name}</h2>
                    <p className="text-sm text-gray-500">
                      {isContactOnline(selectedChat) ? 'En línea' : 'Desconectado'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Agent Selector */}
                  <AgentSelector 
                    selectedChat={selectedChat}
                    selectedExternalAgent={selectedExternalAgent}
                    onAgentChange={setSelectedExternalAgent}
                  />

                  {/* External Agent Button */}
                  <ExternalAgentButton
                    chatId={selectedChat.id}
                    accountId={selectedChat.accountId}
                  />

                  {/* Chat Actions */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAssignmentDialogOpen(true)}
                      className="border-blue-600 text-blue-600 hover:bg-blue-50"
                    >
                      <UserCheck className="h-4 w-4 mr-2" />
                      Asignar
                    </Button>
                  </motion.div>
                  
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCommentsDialogOpen(true)}
                      className="border-orange-600 text-orange-600 hover:bg-orange-50"
                    >
                      <MessageCircleHeart className="h-4 w-4 mr-2" />
                      Comentarios
                    </Button>
                  </motion.div>
                  
                  {/* Profile Button */}
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
              ) : (
                <div className="space-y-4">
                  {messages.map((message: WhatsAppMessage, index: number) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] ${message.fromMe ? 'bg-green-500 text-white' : 'bg-white text-gray-900 border border-gray-200'} rounded-lg p-3 shadow-sm`}>
                        {message.type === 'ptt' || message.type === 'audio' ? (
                          <VoiceNoteMessage message={message} />
                        ) : message.hasMedia ? (
                          <div className="flex items-center space-x-2 text-gray-600">
                            {message.type?.includes('image') ? (
                              <Image className="h-4 w-4" />
                            ) : message.type?.includes('video') ? (
                              <VideoIcon className="h-4 w-4" />
                            ) : (
                              <File className="h-4 w-4" />
                            )}
                            <span className="text-sm">
                              {message.type?.includes('image') ? 'Imagen' : 
                               message.type?.includes('video') ? 'Video' : 'Archivo'}
                            </span>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{message.body}</p>
                        )}
                        
                        <div className={`flex items-center justify-end mt-1 space-x-1 ${message.fromMe ? 'text-green-100' : 'text-gray-500'}`}>
                          <span className="text-xs">
                            {new Date(message.timestamp * 1000).toLocaleTimeString('es-ES', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </span>
                          {message.fromMe && (
                            <CheckIcon className="h-3 w-3" />
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              <form onSubmit={handleSubmit} className="flex items-center space-x-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-gray-500 hover:text-gray-700"
                >
                  <Paperclip className="h-5 w-5" />
                </Button>
                
                <div className="flex-1 relative">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    className="pr-12"
                    disabled={sendMessageMutation.isPending}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                </div>
                
                <Button
                  type="submit"
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white"
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
          /* No Chat Selected */
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Selecciona un chat</h3>
              <p className="text-gray-500">Elige un chat de la lista para empezar a conversar</p>
            </div>
          </div>
        )}
      </div>

      {/* Chat Assignment Dialog */}
      <ChatAssignmentDialog
        open={assignmentDialogOpen}
        onOpenChange={setAssignmentDialogOpen}
        chatId={selectedChat?.id || ''}
        chatName={selectedChat?.name || ''}
      />

      {/* Chat Comments Dialog */}
      <ChatCommentsDialog
        open={commentsDialogOpen}
        onOpenChange={setCommentsDialogOpen}
        chatId={selectedChat?.id || ''}
        chatName={selectedChat?.name || ''}
      />
    </div>
  );
}