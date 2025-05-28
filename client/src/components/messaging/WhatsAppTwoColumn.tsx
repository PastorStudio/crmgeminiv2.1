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
  Tag,
  AlertCircle,
  CheckCircle2,
  Smile,
  Paperclip,
  Languages,
  Image,
  FileText,
  Video,
  File,
  Loader2,
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
      <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs">
        <UserPlus className="h-3 w-3" />
      </Badge>
    );
  }

  const assignedAgent = users.find((user: any) => user.id === assignment.assignedToId);
  
  if (!assignedAgent) {
    return (
      <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs">
        <UserPlus className="h-3 w-3" />
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs">
      <UserPlus className="h-3 w-3 mr-1" />
      {assignedAgent.username}
    </Badge>
  );
}

function AgentAssignmentDisplay({ chatId }: { chatId: string }) {
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
      <div className="flex items-center text-sm text-gray-500">
        <UserPlus className="h-4 w-4 mr-2" />
        Sin asignar
      </div>
    );
  }

  const assignedAgent = users.find((user: any) => user.id === assignment.assignedToId);
  
  if (!assignedAgent) {
    return (
      <div className="flex items-center text-sm text-gray-500">
        <UserPlus className="h-4 w-4 mr-2" />
        Sin asignar
      </div>
    );
  }

  const status = usersResponse?.status || 'offline';

  return (
    <div className="flex items-center text-sm">
      <div className="flex items-center mr-2">
        <div className={`w-2 h-2 rounded-full mr-1 ${status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
        <User className="h-4 w-4" />
      </div>
      <span className="font-medium">{assignedAgent.username}</span>
    </div>
  );
}

function ChatCategorizationBadge({ chatId, accountId }: { chatId: string; accountId: number }) {
  const statusColors = {
    'lead': 'bg-blue-100 text-blue-800',
    'customer': 'bg-green-100 text-green-800',
    'prospect': 'bg-yellow-100 text-yellow-800',
    'support': 'bg-red-100 text-red-800'
  };

  return (
    <Badge variant="secondary" className="bg-gray-100 text-gray-800 text-xs">
      <Tag className="h-3 w-3 mr-1" />
      Lead
    </Badge>
  );
}

function ChatCommentsIndicator({ chatId }: { chatId: string }) {
  const { data: chatComments } = useQuery({
    queryKey: ['/api/chat-comments', chatId],
    queryFn: () => fetch(`/api/chat-comments/${encodeURIComponent(chatId)}`).then(res => res.json()),
    enabled: !!chatId
  });

  const hasComments = Array.isArray(chatComments) && chatComments.length > 0;

  if (!hasComments) {
    return null;
  }

  return (
    <div className="flex items-center">
      <div className="w-3 h-3 bg-yellow-500 rounded-full border-2 border-white mr-1"></div>
      <MessageSquareMore className="h-4 w-4 text-yellow-600" />
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
  const [autoSendTimer, setAutoSendTimer] = useState<NodeJS.Timeout | null>(null);
  const [isAutoSending, setIsAutoSending] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('es');
  const [lastMessageCount, setLastMessageCount] = useState(0);

  const queryClient = useQueryClient();

  const { data: accounts, isLoading: loadingAccounts } = useQuery({
    queryKey: ['/api/whatsapp/accounts'],
    refetchInterval: 5000,
  });

  const { data: chats, isLoading: loadingChats } = useQuery({
    queryKey: ['/api/whatsapp/chats', selectedAccounts],
    enabled: selectedAccounts.length > 0,
    refetchInterval: 2000,
  });

  const { data: messages, isLoading: loadingMessages, refetch: refetchMessages } = useQuery({
    queryKey: [`/api/whatsapp-accounts/${selectedChat?.accountId}/messages/${selectedChat?.id}`],
    enabled: !!selectedChat,
    refetchInterval: 2000,
  });

  // Función para manejar selección de chat
  const handleChatSelect = async (chat: WhatsAppChat) => {
    setSelectedChat(chat);
    setNewMessage('');
  };

  // Función para enviar mensaje
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: { message: string; chatId: string; accountId: number }) => {
      const response = await fetch(`/api/whatsapp-accounts/${messageData.accountId}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: messageData.chatId,
          message: messageData.message,
        }),
      });

      if (!response.ok) {
        throw new Error('Error enviando mensaje');
      }

      return response.json();
    },
    onSuccess: () => {
      setNewMessage('');
      refetchMessages();
    },
    onError: (error) => {
      console.error('Error enviando mensaje:', error);
    },
  });

  const handleSendMessage = () => {
    if (!selectedChat || !newMessage.trim()) return;

    sendMessageMutation.mutate({
      message: newMessage,
      chatId: selectedChat.id,
      accountId: selectedChat.accountId,
    });
  };

  // Initialize with all accounts selected by default
  useEffect(() => {
    if ((accounts as any[])?.length > 0 && selectedAccounts.length === 0) {
      const allAccountIds = (accounts as any[]).map((acc: any) => acc.id);
      setSelectedAccounts(allAccountIds);
    }
  }, [accounts, selectedAccounts]);

  const sortedChats = useMemo(() => {
    if (!chats || !Array.isArray(chats)) return [];
    
    return chats
      .filter(chat => selectedAccounts.includes(chat.accountId))
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [chats, selectedAccounts]);

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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <MessageCircle className="h-5 w-5 mr-2 text-green-600" />
              WhatsApp
            </h2>
            
            <div className="flex items-center space-x-2">
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

          <AccountSelector
            accounts={accounts as any[]}
            selectedAccounts={selectedAccounts}
            onSelectionChange={setSelectedAccounts}
          />

          <div className="mt-4">
            <Input
              placeholder="Buscar chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
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
            <div className="flex flex-col items-center justify-center h-32 text-gray-500 p-4">
              <MessageCircle className="h-12 w-12 mb-3 text-gray-300" />
              <p className="text-center">No hay chats disponibles</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredChats.map((chat) => (
                <div
                  key={`${chat.accountId}-${chat.id}`}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedChat?.id === chat.id ? 'bg-blue-50 border-r-2 border-blue-500' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleChatSelect(chat)}
                >
                  <div className="flex items-start space-x-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={chat.profilePicUrl} />
                      <AvatarFallback className="bg-green-100 text-green-600">
                        {chat.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {chat.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(chat.timestamp * 1000).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>

                      <p className="text-sm text-gray-600 truncate mt-1">
                        {chat.lastMessage}
                      </p>

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center space-x-2">
                          <ChatAssignmentBadge chatId={chat.id} accountId={chat.accountId} />
                          <ChatCategorizationBadge chatId={chat.id} accountId={chat.accountId} />
                        </div>

                        <div className="flex items-center space-x-1">
                          <ChatCommentsIndicator chatId={chat.id} />
                          {chat.unreadCount > 0 && (
                            <Badge variant="default" className="bg-green-500 text-white text-xs">
                              {chat.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right Panel - Chat Messages */}
      <div className="flex-1 flex flex-col bg-white">
        {!selectedChat ? (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Selecciona un chat
              </h3>
              <p className="text-gray-500">
                Elige una conversación para comenzar a chatear
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedChat.profilePicUrl} />
                    <AvatarFallback className="bg-green-100 text-green-600">
                      {selectedChat.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {selectedChat.name}
                    </h3>
                    <AgentAssignmentDisplay chatId={selectedChat.id} />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <AgentSelector 
                    chatId={selectedChat.id}
                    accountId={selectedChat.accountId}
                  />
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAssignmentDialogOpen(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Asignar
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCommentsDialogOpen(true)}
                  >
                    <MessageSquareMore className="h-4 w-4 mr-2" />
                    Comentarios
                  </Button>

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
                  {messages.map((message: any) => (
                    <div
                      key={message.id}
                      className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-4 py-2 ${
                          message.fromMe
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-900'
                        }`}
                      >
                        {message.type === 'ptt' ? (
                          <VoiceNoteMessage message={message} />
                        ) : message.hasMedia ? (
                          <div className="flex items-center space-x-2">
                            {message.type === 'image' && <Image className="h-4 w-4" />}
                            {message.type === 'video' && <Video className="h-4 w-4" />}
                            {message.type === 'document' && <FileText className="h-4 w-4" />}
                            <span className="text-sm">Archivo multimedia</span>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                        )}
                        
                        <p className={`text-xs mt-1 ${
                          message.fromMe ? 'text-blue-100' : 'text-gray-500'
                        }`}>
                          {new Date(message.timestamp * 1000).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex space-x-2">
                <Button variant="ghost" size="sm">
                  <Paperclip className="h-4 w-4" />
                </Button>
                
                <Input
                  placeholder="Escribe un mensaje..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1"
                />

                <ExternalAgentButton 
                  chatId={selectedChat.id}
                  accountId={selectedChat.accountId}
                  onResponseGenerated={(response) => setNewMessage(response)}
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
        )}
      </div>

      {/* Dialogs */}
      <ChatAssignmentDialog
        isOpen={assignmentDialogOpen}
        onClose={() => setAssignmentDialogOpen(false)}
        chatId={selectedChat?.id || ''}
        accountId={selectedChat?.accountId || 0}
      />

      <ChatCommentsDialog
        isOpen={commentsDialogOpen}
        onClose={() => setCommentsDialogOpen(false)}
        chatId={selectedChat?.id || ''}
        accountId={selectedChat?.accountId || 0}
      />
    </div>
  );
}