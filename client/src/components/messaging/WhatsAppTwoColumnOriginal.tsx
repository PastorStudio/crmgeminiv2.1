import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  User, Users, MessageCircle, Send, Search, UserPlus, Bot, MessageSquare, 
  Filter, Tag, Plus, Loader2, Mic, MicOff, Globe, Smile, Paperclip, 
  PlayCircle, Download, Eye, Clock, Check, CheckCheck 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Interfaces
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

interface Category {
  id: number;
  name: string;
  description?: string;
  color: string;
  icon: string;
}

// Assignment Badge Component
function ChatAssignmentBadge({ chatId, accountId }: { chatId: string; accountId: number }) {
  const { data: assignmentResponse } = useQuery({
    queryKey: [`/api/agent-assignments/chat`, chatId, accountId],
    staleTime: 30000,
  });

  const { data: usersResponse } = useQuery({
    queryKey: ['/api/users'],
    staleTime: 60000,
  });

  const users = Array.isArray(usersResponse?.users) ? usersResponse.users : 
                Array.isArray(usersResponse) ? usersResponse : [];
  const assignment = assignmentResponse;

  if (!assignment || !assignment.assignedToId) {
    return (
      <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs">
        <UserPlus className="h-3 w-3" />
      </Badge>
    );
  }

  const assignedUser = users.find((user: any) => user.id === assignment.assignedToId);
  
  return (
    <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
      <User className="h-3 w-3 mr-1" />
      {assignedUser?.fullName || assignedUser?.username || 'Agente'}
    </Badge>
  );
}

// Agent Assignment Display Component
function AgentAssignmentDisplay({ chatId }: { chatId: string }) {
  const { data: assignmentResponse } = useQuery({
    queryKey: [`/api/agent-assignments/chat`, chatId],
    staleTime: 30000,
  });

  const { data: usersResponse } = useQuery({
    queryKey: ['/api/users'],
    staleTime: 60000,
  });

  const users = Array.isArray(usersResponse?.users) ? usersResponse.users : 
                Array.isArray(usersResponse) ? usersResponse : [];
  const assignment = assignmentResponse;

  if (!assignment || !assignment.assignedToId) {
    return <span>Desconectado</span>;
  }

  const assignedUser = users.find((user: any) => user.id === assignment.assignedToId);
  
  return <span>Asignado a: {assignedUser?.fullName || assignedUser?.username || 'Agente'}</span>;
}

// Category Badge Component
function ChatCategorizationBadge({ chatId, accountId }: { chatId: string; accountId: number }) {
  const { data: categoryResponse } = useQuery({
    queryKey: [`/api/chat-categories/${chatId}`],
    staleTime: 30000,
  });

  if (!categoryResponse || !categoryResponse.status) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'abierto': return 'bg-green-100 text-green-800';
      case 'en_progreso': return 'bg-yellow-100 text-yellow-800';
      case 'resuelto': return 'bg-blue-100 text-blue-800';
      case 'cerrado': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Badge variant="outline" className={`text-xs ${getStatusColor(categoryResponse.status)}`}>
      <Tag className="h-3 w-3 mr-1" />
      {categoryResponse.status.replace('_', ' ')}
    </Badge>
  );
}

// Comments Indicator Component
function ChatCommentsIndicator({ chatId }: { chatId: string }) {
  const { data: comments = [] } = useQuery({
    queryKey: [`/api/chat-comments/${chatId}`],
    staleTime: 30000,
  });

  const commentsArray = Array.isArray(comments) ? comments : [];

  if (commentsArray.length === 0) {
    return null;
  }

  return (
    <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800">
      <MessageSquare className="h-3 w-3 mr-1" />
      {commentsArray.length}
    </Badge>
  );
}

// Voice Note Component
function VoiceNoteMessage({ messageId, chatId, accountId }: { messageId: string; chatId: string; accountId: number }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [showTranscription, setShowTranscription] = useState(false);

  const handleAudioMessage = async () => {
    try {
      const response = await fetch(`/api/whatsapp-accounts/${accountId}/messages/${chatId}/${messageId}/audio`);
      if (response.ok) {
        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.play();
      }
    } catch (error) {
      console.error('Error reproduciendo audio:', error);
    }
  };

  return (
    <div className="flex items-center space-x-3 bg-gray-50 rounded-lg p-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleAudioMessage}
        className="bg-blue-600 text-white hover:bg-blue-700 rounded-full p-2"
      >
        <PlayCircle className="h-4 w-4" />
      </Button>
      <div className="flex flex-col">
        <span className="text-xs text-gray-600">Nota de voz</span>
        {transcription && showTranscription && (
          <p className="text-sm mt-1 text-gray-700">{transcription}</p>
        )}
      </div>
      {transcription && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowTranscription(!showTranscription)}
          className="text-xs text-blue-600"
        >
          {showTranscription ? 'Ocultar' : 'Ver texto'}
        </Button>
      )}
    </div>
  );
}

// Main Component
export function WhatsAppTwoColumn() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State management
  const [selectedChat, setSelectedChat] = useState<WhatsAppChat | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [commentsDialogOpen, setCommentsDialogOpen] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [externalAgentActive, setExternalAgentActive] = useState(false);
  const [externalAgentProcessing, setExternalAgentProcessing] = useState(false);
  const [categoryLoadingChat, setCategoryLoadingChat] = useState<string | null>(null);
  const [chatComments, setChatComments] = useState<any[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('es');
  const [languageSelectorOpen, setLanguageSelectorOpen] = useState(false);
  const [translatorEnabled, setTranslatorEnabled] = useState(false);
  const [isAutoSending, setIsAutoSending] = useState(false);
  const [autoSendTimer, setAutoSendTimer] = useState<NodeJS.Timeout | null>(null);
  const [showAutoClickConfig, setShowAutoClickConfig] = useState(false);
  const [autoClickSettings, setAutoClickSettings] = useState({
    enabled: false,
    interval: 5000,
    clickSelector: '',
    message: ''
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Available languages for translation
  const availableLanguages = [
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'pt', name: 'Português', flag: '🇧🇷' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: '한국어', flag: '🇰🇷' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' }
  ];

  // Fetch WhatsApp accounts
  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ['/api/whatsapp/accounts'],
    refetchInterval: 30000,
  });

  // Fetch all chats from all accounts
  const { data: allChats = [], isLoading: loadingChats } = useQuery({
    queryKey: ['/api/whatsapp/all-chats'],
    enabled: Array.isArray(accounts) && accounts.length > 0,
    refetchInterval: 5000,
    queryFn: async () => {
      if (!Array.isArray(accounts) || accounts.length === 0) return [];
      
      const chatPromises = accounts.map(async (account: WhatsAppAccount) => {
        try {
          const response = await fetch(`/api/whatsapp-accounts/${account.id}/chats`);
          if (!response.ok) return [];
          const chats = await response.json();
          return Array.isArray(chats) ? chats.map((chat: WhatsAppChat) => ({
            ...chat,
            accountId: account.id
          })) : [];
        } catch (error) {
          console.error(`Error fetching chats for account ${account.id}:`, error);
          return [];
        }
      });
      
      const allAccountChats = await Promise.all(chatPromises);
      return allAccountChats.flat();
    }
  });

  // Fetch messages for selected chat
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: [`/api/whatsapp-accounts/${selectedChat?.accountId}/messages/${selectedChat?.id}`],
    enabled: !!selectedChat,
    refetchInterval: 10000, // Reduced frequency
    staleTime: 5000, // Add stale time to prevent unnecessary requests
  });

  // Fetch categories
  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ['/api/chat-categories']
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: { chatId: string; message: string; accountId: number }) => {
      const response = await fetch(`/api/whatsapp-accounts/${messageData.accountId}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: messageData.chatId,
          message: messageData.message
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: [`/api/whatsapp-accounts/${selectedChat?.accountId}/messages/${selectedChat?.id}`] 
      });
    }
  });

  // Assign category mutation
  const assignCategoryMutation = useMutation({
    mutationFn: ({ chatId, accountId, categoryId }: { chatId: string; accountId: number; categoryId: number }) =>
      apiRequest('/api/chat-categories/assign', { 
        method: 'POST', 
        body: { chatId, accountId, categoryId } 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/all-chats'] });
      setCategoryLoadingChat(null);
    },
    onError: () => {
      setCategoryLoadingChat(null);
    }
  });

  // Helper functions
  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isContactOnline = (chat: WhatsAppChat) => {
    if (chat.isOnline) return true;
    if (chat.lastSeen && Date.now() - (chat.lastSeen * 1000) < 300000) return true;
    return false;
  };

  const getSelectedAccount = () => {
    return Array.isArray(accounts) ? accounts.find(acc => acc.id === selectedChat?.accountId) : null;
  };

  const getLastIncomingMessageId = (messages: WhatsAppMessage[]) => {
    const incomingMessages = messages.filter(msg => !msg.fromMe);
    return incomingMessages.length > 0 ? incomingMessages[incomingMessages.length - 1].id : null;
  };

  // Handle chat selection
  const handleChatSelect = async (chat: WhatsAppChat) => {
    setSelectedChat(chat);
    
    // Load chat comments
    try {
      const commentsResponse = await fetch(`/api/chat-comments/${chat.id}`);
      if (commentsResponse.ok) {
        const comments = await commentsResponse.json();
        setChatComments(Array.isArray(comments) ? comments : []);
      }
    } catch (error) {
      console.error('Error loading chat comments:', error);
      setChatComments([]);
    }
  };

  // Handle send message
  const handleSendMessage = () => {
    if (!selectedChat || !newMessage.trim()) return;
    
    sendMessageMutation.mutate({
      chatId: selectedChat.id,
      message: newMessage,
      accountId: selectedChat.accountId
    });
    
    setNewMessage('');
  };

  // Voice recording functions
  const startVoiceRecording = () => {
    setIsRecording(true);
    // Voice recording logic would go here
  };

  const stopVoiceRecording = () => {
    setIsRecording(false);
    // Voice recording logic would go here
  };

  // Auto-send functionality
  useEffect(() => {
    if (translatorEnabled && newMessage && !isAutoSending) {
      const timer = setTimeout(() => {
        setIsAutoSending(true);
        handleSendMessage();
        setIsAutoSending(false);
      }, 3000);
      
      setAutoSendTimer(timer);
      
      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  }, [newMessage, translatorEnabled]);

  // Auto-click functionality
  const saveAutoClickSettings = (settings: typeof autoClickSettings) => {
    setAutoClickSettings(settings);
    // Save to backend or localStorage
  };

  // Sort chats by activity
  const sortedChats = useMemo(() => {
    if (!Array.isArray(allChats)) return [];
    
    return [...allChats].sort((a, b) => {
      // First, prioritize unread messages
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
      
      // Then sort by timestamp (most recent first)
      return b.timestamp - a.timestamp;
    });
  }, [allChats]);

  // Filter chats based on search and category
  const filteredChats = useMemo(() => {
    return sortedChats.filter(chat => {
      const matchesSearch = chat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           chat.lastMessage.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === null || true; // Category filtering logic
      
      return matchesSearch && matchesCategory;
    });
  }, [sortedChats, searchTerm, selectedCategory]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (loadingAccounts) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar - Chat List */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Chats de WhatsApp</h2>
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              {filteredChats.length} chats
            </Badge>
          </div>
          
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar chats..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={selectedCategory === null ? "default" : "outline"}
              onClick={() => setSelectedCategory(null)}
              className="flex items-center space-x-1"
            >
              <Filter className="h-3 w-3" />
              <span>Todas</span>
            </Button>

            {Array.isArray(categories) && categories.map((category: any) => (
              <Button
                key={category.id}
                size="sm"
                variant={selectedCategory === category.id ? "default" : "outline"}
                onClick={() => setSelectedCategory(category.id)}
                className="flex items-center space-x-1"
                style={{ 
                  backgroundColor: selectedCategory === category.id ? category.color : 'transparent',
                  borderColor: category.color,
                  color: selectedCategory === category.id ? 'white' : category.color
                }}
              >
                <Tag className="h-3 w-3" />
                <span>{category.name}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Chat List */}
        <ScrollArea className="flex-1">
          {loadingChats ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {filteredChats.map((chat) => (
                <motion.div
                  key={chat.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                    selectedChat?.id === chat.id 
                      ? 'bg-blue-50 border-l-4 border-blue-500' 
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleChatSelect(chat)}
                >
                  <div className="flex items-start space-x-3">
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={chat.profilePicUrl} />
                        <AvatarFallback className="bg-gradient-to-br from-blue-400 to-purple-500 text-white">
                          {chat.isGroup ? (
                            <Users className="h-6 w-6" />
                          ) : (
                            chat.name.charAt(0).toUpperCase()
                          )}
                        </AvatarFallback>
                      </Avatar>
                      {isContactOnline(chat) && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium text-gray-900 truncate">{chat.name}</h3>
                          {chat.isGroup && <Users className="h-4 w-4 text-gray-400" />}
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(chat.timestamp * 1000), { 
                              addSuffix: true, 
                              locale: es 
                            })}
                          </span>
                          {chat.unreadCount > 0 && (
                            <Badge className="bg-green-500 text-white text-xs min-w-[20px] h-5 flex items-center justify-center rounded-full">
                              {chat.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 truncate mb-2">{chat.lastMessage}</p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                          <ChatAssignmentBadge chatId={chat.id} accountId={chat.accountId} />
                          <ChatCategorizationBadge chatId={chat.id} accountId={chat.accountId} />
                          <ChatCommentsIndicator chatId={chat.id} />
                        </div>
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                          Cuenta #{chat.accountId}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedChat.profilePicUrl} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-400 to-purple-500 text-white">
                      {selectedChat.isGroup ? (
                        <Users className="h-5 w-5" />
                      ) : (
                        selectedChat.name.charAt(0).toUpperCase()
                      )}
                    </AvatarFallback>
                  </Avatar>
                  
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
                        <AgentAssignmentDisplay chatId={selectedChat.id} />
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-2">
                  {/* Assignment Button */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-blue-600 text-blue-600 hover:bg-blue-50"
                          onClick={() => setAssignmentDialogOpen(true)}
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Asignar agente</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* Comments Button */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-orange-600 text-orange-600 hover:bg-orange-50 relative"
                          onClick={() => setCommentsDialogOpen(true)}
                        >
                          <MessageSquare className="h-4 w-4" />
                          {chatComments.length > 0 && (
                            <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                              {chatComments.length}
                            </span>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Comentarios del chat</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* Profile Button */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowUserProfile(true)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <User className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Ver perfil</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
              {messagesLoading ? (
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
                    
                    const lastIncomingMessageId = getLastIncomingMessageId(messages);
                    const isLastIncomingMessage = !message.fromMe && message.id === lastIncomingMessageId;
                    
                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`flex space-x-2 max-w-[75%] ${message.fromMe ? 'flex-row-reverse space-x-reverse' : ''}`}>
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
                            
                            <div className={`flex items-end gap-1 ${message.fromMe ? 'justify-end' : 'flex-row'}`}>
                              {message.fromMe && (
                                <div className="text-xs text-gray-500 flex-shrink-0">
                                  {formatTime(message.timestamp)}
                                </div>
                              )}
                              <div
                                className={`px-4 py-2 rounded-2xl ${
                                  message.fromMe
                                    ? 'bg-blue-500 text-white rounded-br-md'
                                    : 'bg-gray-100 text-gray-900 rounded-bl-md'
                                }`}
                              >
                                {(message.type === 'ptt' || message.type === 'audio') ? (
                                  <VoiceNoteMessage 
                                    messageId={message.id} 
                                    chatId={selectedChat.id}
                                    accountId={selectedChat.accountId}
                                  />
                                ) : message.type === 'image' ? (
                                  <div className="flex items-center space-x-2">
                                    <Eye className="h-4 w-4" />
                                    <span>Imagen</span>
                                  </div>
                                ) : (
                                  <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                                )}
                              </div>
                              {!message.fromMe && (
                                <div className="text-xs text-gray-500 flex-shrink-0">
                                  {formatTime(message.timestamp)}
                                </div>
                              )}
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
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex items-center space-x-2">
                {/* Emoji Picker */}
                <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Smile className="h-5 w-5 text-gray-500" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="grid grid-cols-8 gap-2 p-2">
                      {['😀', '😁', '😂', '🤣', '😃', '😄', '😅', '😆', '😉', '😊', '😋', '😎', '😍', '😘', '🥰', '😗', '😙', '😚', '☺️', '🙂', '🤗', '🤩', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮'].map((emoji) => (
                        <button
                          key={emoji}
                          className="p-2 hover:bg-gray-100 rounded text-lg"
                          onClick={() => {
                            setNewMessage(prev => prev + emoji);
                            setEmojiPickerOpen(false);
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* File Menu */}
                <Popover open={fileMenuOpen} onOpenChange={setFileMenuOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Paperclip className="h-5 w-5 text-gray-500" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48">
                    <div className="space-y-2">
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => setFileMenuOpen(false)}
                      >
                        <User className="h-4 w-4 mr-2" />
                        Contacto
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => setFileMenuOpen(false)}
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Documento
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => setFileMenuOpen(false)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Cámara
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => setFileMenuOpen(false)}
                      >
                        <Tag className="h-4 w-4 mr-2" />
                        Sticker
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Message Input */}
                <div className="flex-1 relative">
                  <Input
                    placeholder="Escribe un mensaje..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="pr-12"
                    disabled={translatorEnabled && isAutoSending}
                  />
                  {translatorEnabled && isAutoSending && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                    </div>
                  )}
                </div>

                {/* Voice Recording */}
                <Button
                  variant="ghost"
                  size="sm"
                  onMouseDown={startVoiceRecording}
                  onMouseUp={stopVoiceRecording}
                  className={isRecording ? 'bg-red-100 text-red-600' : 'text-gray-500'}
                >
                  {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>

                {/* Language Selector */}
                <Popover open={languageSelectorOpen} onOpenChange={setLanguageSelectorOpen}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className={translationEnabled ? 'bg-blue-100 text-blue-600' : 'text-gray-500'}
                    >
                      <Globe className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Traducción</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setTranslationEnabled(!translationEnabled)}
                          className={translationEnabled ? 'text-blue-600' : 'text-gray-500'}
                        >
                          {translationEnabled ? 'Activado' : 'Desactivado'}
                        </Button>
                      </div>
                      
                      {translationEnabled && (
                        <div className="space-y-2">
                          <span className="text-sm text-gray-600">Idioma objetivo:</span>
                          {availableLanguages.filter(l => l.code !== selectedLanguage).slice(0, 5).map((language) => (
                            <Button
                              key={language.code}
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start"
                              onClick={() => {
                                setSelectedLanguage(language.code);
                                setLanguageSelectorOpen(false);
                              }}
                            >
                              <span className="mr-2">{language.flag}</span>
                              {language.name}
                            </Button>
                          ))}
                        </div>
                      )}
                      
                      <div className="border-t pt-2">
                        <span className="text-xs text-gray-500">
                          Idioma actual: {availableLanguages.find(l => l.code === selectedLanguage)?.name}
                        </span>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Send Button */}
                <Button 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  size="sm"
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
            <div className="text-center">
              <MessageCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Selecciona un chat</h3>
              <p className="text-gray-500">Elige una conversación para comenzar a chatear</p>
            </div>
          </div>
        )}
      </div>

      {/* Assignment Dialog */}
      {selectedChat && (
        <Dialog open={assignmentDialogOpen} onOpenChange={setAssignmentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Asignar Chat</DialogTitle>
            </DialogHeader>
            <p>Funcionalidad de asignación para {selectedChat.name}</p>
            <DialogFooter>
              <Button onClick={() => setAssignmentDialogOpen(false)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Comments Dialog */}
      {selectedChat && (
        <Dialog open={commentsDialogOpen} onOpenChange={setCommentsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Comentarios del Chat</DialogTitle>
            </DialogHeader>
            <p>Comentarios para {selectedChat.name}</p>
            <DialogFooter>
              <Button onClick={() => setCommentsDialogOpen(false)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Auto-click Configuration Dialog */}
      <Dialog open={showAutoClickConfig} onOpenChange={setShowAutoClickConfig}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configuración de Auto-click</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Configuración de auto-click para automatización</p>
          </div>
          <DialogFooter>
            <Button onClick={() => saveAutoClickSettings(autoClickSettings)}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}