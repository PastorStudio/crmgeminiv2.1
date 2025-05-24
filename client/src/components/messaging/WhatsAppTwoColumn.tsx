import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
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
  Tag,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react';

// Import components
import { AccountSelector } from './AccountSelector';
import ChatAssignmentDialog from './ChatAssignmentDialog';
import { ChatCommentsDialog } from './ChatCommentsDialog';
import { AutoResponseDialog } from './AutoResponseDialog';

function ChatCategorizationBadge({ chatId, accountId }: { chatId: string; accountId: number }) {
  const { data: category } = useQuery({
    queryKey: ['/api/chat-categories', chatId],
    enabled: !!chatId
  });

  if (!category) return null;

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'ventas': return '💰';
      case 'soporte': return '🔧';
      case 'informacion': return 'ℹ️';
      case 'consulta': return '💬';
      default: return '💬';
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'ventas': return 'bg-green-100 text-green-800 border-green-200';
      case 'soporte': return 'bg-red-100 text-red-800 border-red-200';
      case 'informacion': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'consulta': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center space-x-1"
    >
      <Badge 
        variant="outline" 
        className={`text-xs border ${getCategoryColor(category.category)}`}
      >
        <span className="mr-1">{getCategoryIcon(category.category)}</span>
        {category.category}
        <span className="ml-1 text-xs opacity-70">
          ({Math.round(category.confidence * 100)}%)
        </span>
      </Badge>
    </motion.div>
  );
}

function ChatAssignmentBadge({ chatId, accountId }: { chatId: string; accountId: number }) {
  const { data: assignment } = useQuery({
    queryKey: ['/api/chat-assignments', chatId],
    enabled: !!chatId
  });

  if (!assignment) return null;

  return (
    <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs">
      <UserPlus className="h-3 w-3 mr-1" />
      {assignment.agentName}
    </Badge>
  );
}

function ChatCommentsIndicator({ chatId }: { chatId: string }) {
  const { data: comments = [] } = useQuery({
    queryKey: ['/api/chat-comments', chatId],
    enabled: !!chatId
  });

  if (!comments || comments.length === 0) return null;

  return (
    <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200 mt-[0px] mb-[0px] ml-[90px] mr-[90px]">
      <MessageSquareMore className="h-3 w-3 mr-1" />
      {comments.length}
    </Badge>
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
  const [autoResponseConfigOpen, setAutoResponseConfigOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserProfile, setShowUserProfile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch WhatsApp accounts
  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ['/api/whatsapp/accounts'],
    refetchInterval: 5000 // Refresh every 5 seconds to check status
  });

  // Fetch chats based on selected accounts
  const { data: chats = [], isLoading: loadingChats } = useQuery({
    queryKey: ['/api/whatsapp/chats', selectedAccounts],
    enabled: selectedAccounts.length > 0,
    queryFn: async () => {
      if (selectedAccounts.length === 0) return [];
      
      const allChats = [];
      for (const accountId of selectedAccounts) {
        try {
          const response = await fetch(`/api/whatsapp-accounts/${accountId}/chats`);
          if (response.ok) {
            const accountChats = await response.json();
            allChats.push(...accountChats);
          }
        } catch (error) {
          console.error(`Error fetching chats for account ${accountId}:`, error);
        }
      }
      return allChats;
    }
  });

  // Fetch messages for selected chat
  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ['/api/whatsapp/messages', selectedChat?.id],
    enabled: !!selectedChat?.id,
    queryFn: async () => {
      if (!selectedChat?.id) return [];
      
      console.log('🔄 Obteniendo mensajes reales para chat:', selectedChat.id);
      
      try {
        // Usar el endpoint que devuelve mensajes REALES de WhatsApp
        const response = await fetch(`/api/whatsapp-accounts/${selectedChat.accountId}/messages/${selectedChat.id}`);
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            console.log(`✅ ${data.length} mensajes REALES obtenidos para chat ${selectedChat.id}`);
            return data;
          }
        }
        
        // Fallback: intentar con API directa de WhatsApp
        const directResponse = await fetch(`/api/direct/whatsapp/messages/${selectedChat.id}`);
        if (directResponse.ok) {
          const directData = await directResponse.json();
          if (Array.isArray(directData) && directData.length > 0) {
            console.log(`✅ ${directData.length} mensajes DIRECTOS obtenidos para chat ${selectedChat.id}`);
            return directData;
          }
        }
        
        console.log('⚠️ No se encontraron mensajes reales para este chat');
        return [];
      } catch (error) {
        console.error('❌ Error obteniendo mensajes reales:', error);
        return [];
      }
    },
    refetchInterval: 5000 // Refresh messages every 5 seconds
  });

  // Fetch auto response config
  const { data: autoResponseConfig } = useQuery({
    queryKey: ['/api/auto-response/config', selectedChat?.id],
    enabled: !!selectedChat?.id
  });

  // Fetch chat comments
  const { data: chatComments = [] } = useQuery({
    queryKey: ['/api/chat-comments', selectedChat?.id],
    enabled: !!selectedChat?.id
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
        
        // Show toast notification
        toast({
          title: notification.title,
          description: notification.message,
          duration: 5000
        });

        // Refresh relevant queries based on notification type
        if (notification.type === 'new_message' && notification.chatId) {
          queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/messages', notification.chatId] });
          queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
        } else if (notification.type === 'new_assignment') {
          queryClient.invalidateQueries({ queryKey: ['/api/chat-assignments'] });
        } else if (notification.type === 'chat_categorized') {
          queryClient.invalidateQueries({ queryKey: ['/api/chat-categories'] });
        } else if (notification.type === 'account_status') {
          queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/accounts'] });
        }
      } catch (error) {
        console.error('Error processing notification:', error);
      }
    };

    socket.onclose = () => {
      console.log('🔌 Desconectado de notificaciones');
    };

    return () => {
      socket.close();
    };
  }, [queryClient]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Initialize with all accounts selected by default
  useEffect(() => {
    if ((accounts as any[])?.length > 0 && selectedAccounts.length === 0) {
      // Select all accounts by default
      const allAccountIds = (accounts as any[]).map((acc: any) => acc.id);
      setSelectedAccounts(allAccountIds);
    }
  }, [accounts, selectedAccounts]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedChat) return;
    
    sendMessageMutation.mutate({
      chatId: selectedChat.id,
      accountId: selectedChat.accountId,
      message: newMessage.trim()
    });
  };

  const handleAccountsChange = (accountIds: number[]) => {
    setSelectedAccounts(accountIds);
    setSelectedChat(null); // Clear selected chat when accounts change
  };

  const handleAccountClick = (accountId: number) => {
    // Focus on specific account
    setSelectedAccounts([accountId]);
    setSelectedChat(null);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    });
  };

  const isContactOnline = (chat: WhatsAppChat) => {
    if (chat.isOnline) return true;
    if (chat.lastSeen) {
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      return chat.lastSeen > fiveMinutesAgo;
    }
    return false;
  };

  const getSelectedAccount = () => {
    return accounts.find(acc => acc.id === selectedChat?.accountId);
  };

  // Sort chats by activity: unread messages first, then by most recent timestamp
  const sortedChats = useMemo(() => {
    return [...chats].sort((a, b) => {
      // Priority 1: Chats with unread messages first
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
      
      // Priority 2: Most recent activity (highest timestamp first)
      const timestampA = a.timestamp || 0;
      const timestampB = b.timestamp || 0;
      return timestampB - timestampA;
    });
  }, [chats]);

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
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-blue-50 pt-[0px] pb-[0px] text-[14px] mt-[6px] mb-[6px] ml-[0px] mr-[0px] pl-[6px] pr-[6px]">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">WhatsApp Business</h2>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {selectedAccounts.length}/{(accounts as any[])?.length || 0} seleccionadas
              </Badge>
            </div>
            
            <AccountSelector
              accounts={accounts}
              selectedAccounts={selectedAccounts}
              onAccountsChange={handleAccountsChange}
              onAccountClick={handleAccountClick}
            />
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200 mt-[-1px] mb-[-1px] pl-[20px] pr-[20px] pt-[2px] pb-[2px] ml-[2px] mr-[2px]">
          <Input
            placeholder="Buscar conversaciones..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-[100px] pr-[100px] pt-[4px] pb-[4px] mt-[10px] mb-[10px] ml-[-5px] mr-[-5px]"
          />
        </div>

        {/* Chat List */}
        <ScrollArea className="flex-1">
          {loadingChats ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Cargando chats...</span>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {selectedAccounts.length === 0 
                ? "Selecciona una cuenta para ver los chats"
                : "No hay chats disponibles"
              }
            </div>
          ) : (
            <div className="space-y-1 p-2">
              <AnimatePresence>
                {filteredChats.map((chat, index) => (
                  <motion.div
                    key={chat.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    className="p-3 rounded-lg cursor-pointer transition-all duration-200 hover:bg-gray-50 ml-[-8px] mr-[-8px] pl-[10px] pr-[10px] pt-[10px] pb-[10px] mt-[0px] mb-[0px] text-[14px] font-bold"
                    onClick={() => setSelectedChat(chat)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={chat.profilePicUrl} />
                          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                            {chat.isGroup ? <Users className="h-6 w-6" /> : chat.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {isContactOnline(chat) && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900 truncate">{chat.name}</span>
                            {chat.isGroup && <Users className="h-4 w-4 text-gray-400" />}
                          </div>
                          <div className="flex items-center space-x-1">
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                              #{chat.accountId}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {formatTime(chat.timestamp)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2 flex-1">
                            {/* Chat Assignment Info */}
                            <ChatAssignmentBadge chatId={chat.id} accountId={chat.accountId} />
                            
                            {/* Account Badge */}
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 ml-[74px] mr-[74px]">
                              <Building className="h-3 w-3 mr-1" />
                              Cuenta #{chat.accountId}
                            </Badge>
                            
                            {/* Comments Indicator */}
                            <ChatCommentsIndicator chatId={chat.id} />
                          </div>
                          
                          {chat.unreadCount > 0 && (
                            <Badge className="bg-green-500 text-white ml-2">
                              {chat.unreadCount}
                            </Badge>
                          )}
                        </div>


                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </div>
      {/* Right Panel - Chat Messages */}
      <div className="flex-1 flex flex-col ml-[2px] mr-[2px] mt-[-1px] mb-[-1px]">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-white pl-[10px] pr-[10px] mt-[8px] mb-[8px] ml-[1px] mr-[1px] text-[18px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={selectedChat.profilePicUrl} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                        {selectedChat.isGroup ? <Users className="h-5 w-5" /> : selectedChat.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {isContactOnline(selectedChat) && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-gray-900">{selectedChat.name}</h3>
                      {selectedChat.isGroup && <Users className="h-4 w-4 text-gray-400" />}
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                        Cuenta #{selectedChat.accountId}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      {isContactOnline(selectedChat) ? (
                        <span className="flex items-center space-x-1 text-green-600">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>En línea</span>
                        </span>
                      ) : selectedChat.lastSeen ? (
                        <span>Última vez: {formatTime(selectedChat.lastSeen)}</span>
                      ) : (
                        <span>Desconectado</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-2">
                  {/* Assignment Button */}
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
                  
                  {/* Auto Response Button */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                  >
                    <Button
                      size="sm"
                      variant={autoResponseConfig?.enabled ? "default" : "outline"}
                      className={`shadow-sm transition-all duration-300 ${
                        autoResponseConfig?.enabled 
                          ? "bg-green-600 hover:bg-green-700 text-white" 
                          : "border-green-600 text-green-600 hover:bg-green-50"
                      }`}
                      onClick={() => setAutoResponseConfigOpen(true)}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      {autoResponseConfig?.enabled ? "Auto ON" : "Auto OFF"}
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
                  {messages.map((message, index) => {
                    const showAvatar = selectedChat.isGroup && !message.fromMe;
                    const isFirstFromAuthor = index === 0 || 
                      messages[index - 1].author !== message.author || 
                      messages[index - 1].fromMe !== message.fromMe;
                    
                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className={`flex ${message.fromMe ? 'justify-end pt-[-34px] pb-[-34px] mt-[6px] mb-[6px] ml-[-4px] mr-[-4px] pl-[-20px] pr-[-20px] text-[14px]' : 'justify-start pt-[-34px] pb-[-34px] mt-[6px] mb-[6px] ml-[-4px] mr-[-4px] pl-[-20px] pr-[-20px] text-[14px]'}`}
                      >
                        <div className={`flex space-x-2 max-w-[70%] ${message.fromMe ? 'flex-row-reverse space-x-reverse' : ''}`}>
                          {showAvatar && isFirstFromAuthor && (
                            <Avatar className="h-8 w-8 mt-1">
                              <AvatarImage src={message.authorProfilePic} />
                              <AvatarFallback className="text-xs bg-gray-200">
                                {message.author?.charAt(0).toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          
                          <div className={`${showAvatar && !isFirstFromAuthor ? 'ml-10' : ''}`}>
                            {selectedChat.isGroup && !message.fromMe && isFirstFromAuthor && (
                              <div className="text-xs text-gray-500 mb-1 px-3">
                                {message.author || message.authorNumber}
                              </div>
                            )}
                            
                            <div
                              className={`px-4 py-2 rounded-2xl ${
                                message.fromMe
                                  ? 'bg-blue-500 text-white rounded-br-md'
                                  : 'bg-gray-100 text-gray-900 rounded-bl-md'
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                              <div className={`text-xs mt-1 ${message.fromMe ? 'text-blue-100 text-left' : 'text-gray-500 text-right'} pt-[10px] pb-[10px] ml-[10px] mr-[10px]`}>
                                {formatTime(message.timestamp)}
                                {message.fromMe && (
                                  <span className="ml-1">
                                    {message.type === 'delivered' ? '✓✓' : '✓'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex space-x-2">
                <Input
                  placeholder="Escribe un mensaje..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1"
                  disabled={sendMessageMutation.isPending}
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
        <AutoResponseDialog
          open={autoResponseConfigOpen}
          onOpenChange={setAutoResponseConfigOpen}
          config={autoResponseConfig}
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