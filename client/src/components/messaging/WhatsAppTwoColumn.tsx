import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  Send, 
  MessageCircle, 
  Search, 
  MoreVertical, 
  Phone, 
  Video, 
  Settings,
  User,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  FileText,
  Download,
  Upload,
  RefreshCw,
  Users,
  MessageSquare,
  Calendar,
  Target,
  TrendingUp,
  BarChart3,
  Activity,
  Zap,
  Star,
  AlertCircle,
  Info,
  CheckCheck,
  Mic,
  Image as ImageIcon,
  Paperclip,
  Smile,
  RotateCcw,
  Plus,
  Minus,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Globe,
  Languages,
  Bot,
  Cpu,
  Sparkles,
  Filter,
  SortAsc,
  MoreHorizontal,
  Copy,
  Trash2,
  Edit3,
  Archive,
  Tag,
  Flag,
  Share2,
  Bookmark,
  Heart,
  ThumbsUp,
  Reply,
  Forward,
  Download as DownloadIcon
} from 'lucide-react';

import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getRealNow, formatNYTime } from '@/lib/timeSync';

// Import components
import { AccountSelector } from './AccountSelector';
import ChatAssignmentDialog from './ChatAssignmentDialog';
import { ChatCommentsDialog } from './ChatCommentsDialog';
import { AgentSelector } from './AgentSelector';
import { VoiceNoteMessage } from './VoiceNoteMessage';

interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  isGroup: boolean;
  avatar?: string;
  isOnline?: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
  phone?: string;
}

interface Message {
  id: string;
  text: string;
  timestamp: string;
  fromMe: boolean;
  sender?: string;
  status?: 'sent' | 'delivered' | 'read';
  type?: 'text' | 'image' | 'voice' | 'document';
  media?: {
    url: string;
    filename?: string;
    mimetype?: string;
  };
}

interface WhatsAppAccount {
  id: number;
  name: string;
  status: string;
  qrCode?: string;
  isConnected: boolean;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

export function WhatsAppTwoColumn() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Estados principales
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [message, setMessage] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<number>(1);
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [commentsDialogOpen, setCommentsDialogOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [translatorEnabled, setTranslatorEnabled] = useState(false);
  
  // Referencias
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatListRef = useRef<HTMLDivElement>(null);

  // Configurar fecha sincronizada
  useEffect(() => {
    // Time sync initialized automatically by import
  }, []);

  // Queries principales
  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['/api/whatsapp/accounts'],
    refetchInterval: 5000,
  });

  const { data: chats = [], isLoading: chatsLoading } = useQuery({
    queryKey: ['/api/whatsapp-accounts', selectedAccount, 'chats'],
    enabled: !!selectedAccount,
    refetchInterval: 30000,
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['/api/whatsapp-accounts', selectedAccount, 'messages', selectedChat?.id],
    enabled: !!selectedAccount && !!selectedChat?.id,
    refetchInterval: 5000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
  });

  // Mutations
  const sendMessageMutation = useMutation({
    mutationFn: async ({ accountId, chatId, message }: { accountId: number; chatId: string; message: string }) => {
      const response = await fetch(`/api/whatsapp-accounts/${accountId}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message }),
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-accounts', selectedAccount, 'messages', selectedChat?.id] });
      setMessage('');
      toast({
        title: "Mensaje enviado",
        description: "El mensaje se ha enviado correctamente",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `No se pudo enviar el mensaje: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Funciones principales
  const sendMessage = useCallback(() => {
    if (!message.trim() || !selectedChat || !selectedAccount) return;
    
    sendMessageMutation.mutate({
      accountId: selectedAccount,
      chatId: selectedChat.id,
      message: message.trim(),
    });
  }, [message, selectedChat, selectedAccount, sendMessageMutation]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Scroll automático a mensajes nuevos
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Filtrar chats
  const filteredChats = chats.filter((chat: Chat) =>
    chat.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Panel izquierdo - Lista de chats */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">WhatsApp CRM</h2>
            <div className="flex items-center gap-2">
              <AccountSelector
                accounts={accounts || []}
                selectedAccounts={selectedAccount ? [selectedAccount] : []}
                onAccountsChange={(ids) => setSelectedAccount(ids[0] || null)}
                onAccountClick={(id) => setSelectedAccount(id)}
              />
            </div>
          </div>
          
          {/* Búsqueda */}
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

        {/* Lista de chats */}
        <ScrollArea className="flex-1">
          <div ref={chatListRef} className="p-2">
            {chatsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Cargando chats...</span>
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No hay chats disponibles</p>
              </div>
            ) : (
              filteredChats.map((chat: Chat) => (
                <Card
                  key={chat.id}
                  className={cn(
                    "mb-2 cursor-pointer hover:bg-gray-50 transition-colors",
                    selectedChat?.id === chat.id && "bg-blue-50 border-blue-200"
                  )}
                  onClick={() => setSelectedChat(chat)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-blue-500 text-white">
                          {chat.name?.charAt(0)?.toUpperCase() || 'C'}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-gray-900 truncate">
                            {chat.name || 'Chat sin nombre'}
                          </h3>
                          <span className="text-xs text-gray-500">
                            {chat.timestamp}
                          </span>
                        </div>
                        
                        <p className="text-sm text-gray-600 truncate mt-1">
                          {chat.lastMessage || 'Sin mensajes'}
                        </p>
                        
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1">
                            {chat.isGroup && (
                              <Users className="h-3 w-3 text-gray-400" />
                            )}
                            {chat.isPinned && (
                              <Star className="h-3 w-3 text-yellow-500" />
                            )}
                          </div>
                          
                          {chat.unreadCount > 0 && (
                            <Badge variant="default" className="bg-green-500">
                              {chat.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Panel derecho - Chat */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Header del chat */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-blue-500 text-white">
                      {selectedChat.name?.charAt(0)?.toUpperCase() || 'C'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {selectedChat.name || 'Chat sin nombre'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {selectedChat.isOnline ? 'En línea' : 'Desconectado'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm">
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Video className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Mensajes */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="ml-2">Cargando mensajes...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No hay mensajes en este chat</p>
                  </div>
                ) : (
                  messages.map((msg: Message) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex",
                        msg.fromMe ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-xs lg:max-w-md px-4 py-2 rounded-lg",
                          msg.fromMe
                            ? "bg-blue-500 text-white"
                            : "bg-gray-200 text-gray-900"
                        )}
                      >
                        {msg.type === 'voice' ? (
                          <VoiceNoteMessage message={msg} />
                        ) : (
                          <p className="text-sm">{msg.text}</p>
                        )}
                        
                        <div className={cn(
                          "flex items-center justify-end gap-1 mt-1",
                          msg.fromMe ? "text-blue-100" : "text-gray-500"
                        )}>
                          <span className="text-xs">
                            {new Date(msg.timestamp).toLocaleTimeString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                          {msg.fromMe && (
                            <div className="text-xs">
                              {msg.status === 'read' && <CheckCheck className="h-3 w-3" />}
                              {msg.status === 'delivered' && <CheckCircle className="h-3 w-3" />}
                              {msg.status === 'sent' && <Check className="h-3 w-3" />}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input de mensaje */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm">
                  <Paperclip className="h-4 w-4" />
                </Button>
                
                <div className="flex-1 relative">
                  <Input
                    placeholder="Escribe un mensaje..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={sendMessageMutation.isPending}
                  />
                </div>
                
                <Button variant="ghost" size="sm">
                  <Smile className="h-4 w-4" />
                </Button>
                
                <Button 
                  onClick={sendMessage}
                  disabled={!message.trim() || sendMessageMutation.isPending}
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
          // Pantalla de bienvenida
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Bienvenido a WhatsApp CRM
              </h3>
              <p className="text-gray-600">
                Selecciona un chat para comenzar a conversar
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <ChatAssignmentDialog
        open={assignmentDialogOpen}
        onOpenChange={setAssignmentDialogOpen}
        selectedAccounts={selectedAccounts}
        users={users}
      />
      
      <ChatCommentsDialog
        open={commentsDialogOpen}
        onOpenChange={setCommentsDialogOpen}
        selectedChat={selectedChat}
      />
    </div>
  );
}