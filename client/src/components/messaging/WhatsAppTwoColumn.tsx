import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  MessageSquare, 
  Send, 
  Phone, 
  Video, 
  MoreHorizontal, 
  Search,
  Paperclip,
  Smile,
  Mic,
  MicOff,
  Download,
  Eye,
  EyeOff,
  Users,
  User,
  UserPlus,
  MessageCircle,
  Clock,
  CheckCheck,
  Check,
  Volume2,
  VolumeX,
  Loader2,
  Wifi,
  WifiOff,
  Circle,
  Settings,
  Bot,
  UserCheck,
  MessageSquareText,
  RefreshCw,
  Zap,
  Brain,
  Sparkles,
  Target,
  TrendingUp,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import ChatAssignmentDialog from './ChatAssignmentDialog';
import { ChatCommentsDialog } from './ChatCommentsDialog';
// import { IndependentAgentSelector } from './IndependentAgentSelector';

// Chat Assignment Badge Component
function ChatAssignmentBadge({ chatId, accountId }: { chatId: string; accountId: number }) {
  const { data: assignment } = useQuery({
    queryKey: ['/api/chat-assignments', chatId, accountId],
    enabled: !!chatId && !!accountId
  });

  if (!assignment) return null;

  return (
    <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 border-blue-200">
      <UserCheck className="h-3 w-3 mr-1" />
      {assignment.agentName}
    </Badge>
  );
}

// Agent Assignment Display Component
function AgentAssignmentDisplay({ chatId }: { chatId: string }) {
  const { data: assignment } = useQuery({
    queryKey: ['/api/chat-assignments', chatId],
    enabled: !!chatId
  });

  if (!assignment) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
      <UserCheck className="h-4 w-4 text-blue-600" />
      <span className="text-sm font-medium text-blue-800">
        Asignado a: {assignment.agentName}
      </span>
    </div>
  );
}

// Chat Categorization Badge Component
function ChatCategorizationBadge({ chatId, accountId }: { chatId: string; accountId: number }) {
  const { data: categorization } = useQuery({
    queryKey: ['/api/chat-categorizations', chatId, accountId],
    enabled: !!chatId && !!accountId
  });

  if (!categorization) return null;

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'hot_lead': return 'bg-red-100 text-red-800 border-red-200';
      case 'warm_lead': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'cold_lead': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'customer': return 'bg-green-100 text-green-800 border-green-200';
      case 'support': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Badge className={`text-xs ${getCategoryColor(categorization.category)}`}>
      <Target className="h-3 w-3 mr-1" />
      {categorization.category.replace('_', ' ').toUpperCase()}
    </Badge>
  );
}

// Chat Comments Indicator Component
function ChatCommentsIndicator({ chatId }: { chatId: string }) {
  const { data: comments = [] } = useQuery({
    queryKey: ['/api/chat-comments', chatId],
    enabled: !!chatId
  });

  if (comments.length === 0) return null;

  return (
    <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
      <MessageSquareText className="h-3 w-3 mr-1" />
      {comments.length} comentario{comments.length !== 1 ? 's' : ''}
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

function WhatsAppTwoColumn() {
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);
  const [selectedChat, setSelectedChat] = useState<WhatsAppChat | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [commentsDialogOpen, setCommentsDialogOpen] = useState(false);
  const [showIndependentSelector, setShowIndependentSelector] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch WhatsApp accounts
  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ['/api/whatsapp-accounts'],
  });

  // Fetch chats for selected account
  const { data: chats = [], isLoading: loadingChats } = useQuery({
    queryKey: ['/api/whatsapp-chats', selectedAccount],
    enabled: !!selectedAccount,
  });

  // Fetch messages for selected chat
  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ['/api/whatsapp-messages', selectedChat?.id],
    enabled: !!selectedChat?.id,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: { chatId: string; message: string; accountId: number }) => {
      const response = await fetch('/api/whatsapp-send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-messages', selectedChat?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-chats', selectedAccount] });
      setNewMessage('');
      toast({ title: 'Mensaje enviado', description: 'El mensaje se ha enviado correctamente' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo enviar el mensaje', variant: 'destructive' });
    },
  });

  // Handle chat selection
  const handleChatSelect = async (chat: WhatsAppChat) => {
    setSelectedChat(chat);
    
    // Mark chat as read
    try {
      await fetch(`/api/whatsapp-chats/${chat.id}/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: chat.accountId }),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-chats', selectedAccount] });
    } catch (error) {
      console.error('Error marking chat as read:', error);
    }
  };

  // Handle send message
  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedChat) return;
    
    sendMessageMutation.mutate({
      chatId: selectedChat.id,
      message: newMessage.trim(),
      accountId: selectedChat.accountId,
    });
  };

  // Check if contact is online
  const isContactOnline = (chat: WhatsAppChat) => {
    if (chat.isOnline) return true;
    if (chat.lastSeen) {
      const lastSeenTime = new Date(chat.lastSeen * 1000);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastSeenTime.getTime()) / (1000 * 60);
      return diffMinutes < 5; // Consider online if last seen within 5 minutes
    }
    return false;
  };

  // Filter chats based on search term
  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.lastMessage.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar - Accounts */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Cuentas WhatsApp</h2>
          
          {loadingAccounts ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map((account: WhatsAppAccount) => (
                <motion.div
                  key={account.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer transition-all duration-200",
                    selectedAccount === account.id
                      ? "bg-blue-50 border-blue-200 shadow-sm"
                      : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                  )}
                  onClick={() => setSelectedAccount(account.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={account.profilePicUrl} />
                          <AvatarFallback className="bg-blue-500 text-white">
                            {account.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className={cn(
                          "absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white",
                          account.status === 'connected' ? 'bg-green-500' : 'bg-gray-400'
                        )} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{account.name}</p>
                        <p className="text-sm text-gray-500">{account.phone}</p>
                      </div>
                    </div>
                    <Badge
                      variant={account.status === 'connected' ? 'default' : 'secondary'}
                      className={account.status === 'connected' ? 'bg-green-500' : ''}
                    >
                      {account.status === 'connected' ? 'Conectado' : 'Desconectado'}
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Chat List */}
        {selectedAccount && (
          <div className="flex-1 flex flex-col">
            <div className="p-3 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar conversaciones..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <ScrollArea className="flex-1">
              {loadingChats ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : filteredChats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <MessageCircle className="h-12 w-12 text-gray-300 mb-3" />
                  <p className="text-gray-500">No hay conversaciones</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredChats.map((chat) => (
                    <motion.div
                      key={chat.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        "p-3 rounded-lg cursor-pointer transition-all duration-200 hover:bg-gray-50",
                        selectedChat?.id === chat.id ? "bg-blue-50 shadow-sm" : ""
                      )}
                      onClick={() => handleChatSelect(chat)}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="relative flex-shrink-0">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={chat.profilePicUrl} />
                            <AvatarFallback className="bg-purple-500 text-white">
                              {chat.isGroup ? <Users className="h-6 w-6" /> : chat.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          {isContactOnline(chat) && (
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-medium text-gray-900 truncate flex items-center">
                              {chat.name}
                              {chat.isGroup && <Users className="h-3 w-3 ml-1 text-gray-400" />}
                            </h3>
                            <span className="text-xs text-gray-500">
                              {formatTime(chat.timestamp)}
                            </span>
                          </div>
                          
                          <p className="text-sm text-gray-600 truncate mb-2">{chat.lastMessage}</p>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1">
                              <ChatAssignmentBadge chatId={chat.id} accountId={chat.accountId} />
                              <ChatCategorizationBadge chatId={chat.id} accountId={chat.accountId} />
                              <ChatCommentsIndicator chatId={chat.id} />
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              {chat.unreadCount > 0 && (
                                <Badge className="bg-green-500 text-white text-xs">
                                  {chat.unreadCount}
                                </Badge>
                              )}
                              {chat.messageRead ? (
                                <CheckCheck className="h-4 w-4 text-blue-500" />
                              ) : (
                                <Check className="h-4 w-4 text-gray-400" />
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
        )}
      </div>

      {/* Main Chat Area */}
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
                      <AvatarFallback className="bg-purple-500 text-white">
                        {selectedChat.isGroup ? <Users className="h-5 w-5" /> : selectedChat.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    {isContactOnline(selectedChat) && (
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h2 className="font-semibold text-gray-900 flex items-center">
                      {selectedChat.name}
                      {selectedChat.isGroup && <Users className="h-4 w-4 ml-2 text-gray-400" />}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {isContactOnline(selectedChat) ? (
                        <span className="flex items-center">
                          <Circle className="h-2 w-2 text-green-500 mr-1 fill-current" />
                          En línea
                        </span>
                      ) : selectedChat.lastSeen ? (
                        `Visto ${formatTime(selectedChat.lastSeen)}`
                      ) : (
                        'Sin conexión'
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Independent Agent Selector Button */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-purple-600 text-purple-600 hover:bg-purple-50 shadow-sm transition-all duration-300"
                      onClick={() => setShowIndependentSelector(true)}
                    >
                      <Brain className="h-4 w-4 mr-2" />
                      Agente IA
                    </Button>
                  </motion.div>

                  {/* Assignment Button */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
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

            {/* Agent Assignment Display */}
            <AgentAssignmentDisplay chatId={selectedChat.id} />

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
                    const isConsecutive = index > 0 && 
                      messages[index - 1].fromMe === message.fromMe &&
                      (message.timestamp - messages[index - 1].timestamp) < 300;

                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className={cn(
                          "flex",
                          message.fromMe ? "justify-end" : "justify-start"
                        )}
                      >
                        <div className={cn(
                          "flex space-x-2 max-w-xs lg:max-w-md",
                          message.fromMe ? "flex-row-reverse space-x-reverse" : ""
                        )}>
                          {showAvatar && !isConsecutive && (
                            <Avatar className="h-8 w-8 flex-shrink-0">
                              <AvatarImage src={message.authorProfilePic} />
                              <AvatarFallback className="bg-gray-500 text-white text-xs">
                                {message.author?.charAt(0) || 'U'}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          
                          <div className={cn(
                            "px-4 py-2 rounded-lg",
                            message.fromMe
                              ? "bg-blue-500 text-white"
                              : "bg-white border border-gray-200",
                            showAvatar && !isConsecutive ? "" : "ml-10"
                          )}>
                            {showAvatar && !isConsecutive && (
                              <p className="text-xs font-medium mb-1 opacity-70">
                                {message.author || message.authorNumber}
                              </p>
                            )}
                            
                            <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                            
                            <div className={cn(
                              "flex items-center justify-end mt-1 space-x-1",
                              message.fromMe ? "text-blue-100" : "text-gray-400"
                            )}>
                              <span className="text-xs">
                                {formatTime(message.timestamp)}
                              </span>
                              {message.fromMe && (
                                <CheckCheck className="h-3 w-3" />
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
              <div ref={messagesEndRef} />
            </ScrollArea>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm">
                  <Paperclip className="h-4 w-4" />
                </Button>
                
                <div className="flex-1 relative">
                  <Input
                    placeholder="Escribe un mensaje..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="pr-10"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2"
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "transition-colors",
                    isRecording ? "text-red-500" : ""
                  )}
                  onClick={() => setIsRecording(!isRecording)}
                >
                  {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>

                <Button 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  className="bg-blue-500 hover:bg-blue-600"
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
              <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Selecciona una conversación
              </h3>
              <p className="text-gray-500">
                Elige un chat de la lista para ver y enviar mensajes
              </p>
            </div>
          </div>
        )}

        {/* Chat Assignment Dialog */}
        {assignmentDialogOpen && selectedChat && (
          <ChatAssignmentDialog
            chatId={selectedChat.id}
            accountId={selectedChat.accountId}
            onClose={() => setAssignmentDialogOpen(false)}
          />
        )}

        {/* Chat Comments Dialog */}
        {commentsDialogOpen && selectedChat && (
          <ChatCommentsDialog
            chatId={selectedChat.id}
            accountId={selectedChat.accountId}
            onClose={() => setCommentsDialogOpen(false)}
          />
        )}

        {/* Independent Agent Selector */}
        {showIndependentSelector && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-600" />
                Selector de Agentes IA
              </h3>
              <p className="text-gray-600 mb-4">
                El selector de agentes independiente está siendo preparado. Esta funcionalidad te permitirá elegir entre 5 agentes IA preconfigurados para generar respuestas inteligentes.
              </p>
              <Button 
                onClick={() => setShowIndependentSelector(false)}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                Entendido
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to format time
function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default WhatsAppTwoColumn;