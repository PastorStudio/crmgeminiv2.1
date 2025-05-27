import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
  CheckCheck,
  Check,
  Loader2,
  Circle,
  Bot
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface WhatsAppMessage {
  id: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  hasMedia: boolean;
  mediaType?: string;
  mediaUrl?: string;
}

interface WhatsAppChat {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: number;
  unreadCount: number;
  avatar?: string;
  isGroup: boolean;
  isOnline?: boolean;
  lastSeen?: number;
}

function WhatsAppTwoColumn() {
  const [selectedChatId, setSelectedChatId] = useState<string>("");
  const [selectedAccountId, setSelectedAccountId] = useState<number>(1);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get WhatsApp accounts
  const { data: accounts = [] } = useQuery({
    queryKey: ['/api/whatsapp-accounts'],
  });

  // Get chats for selected account
  const { data: chats = [], isLoading: isLoadingChats } = useQuery({
    queryKey: ['/api/whatsapp-accounts', selectedAccountId, 'chats'],
    enabled: !!selectedAccountId,
  });

  // Get messages for selected chat
  const { data: messages = [], isLoading: isLoadingMessages } = useQuery({
    queryKey: ['/api/whatsapp-accounts', selectedAccountId, 'chats', selectedChatId, 'messages'],
    enabled: !!selectedChatId && !!selectedAccountId,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await fetch(`/api/whatsapp-accounts/${selectedAccountId}/chats/${selectedChatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      if (!response.ok) throw new Error('Error sending message');
      return response.json();
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({
        queryKey: ['/api/whatsapp-accounts', selectedAccountId, 'chats', selectedChatId, 'messages']
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/whatsapp-accounts', selectedAccountId, 'chats']
      });
    },
    onError: (error) => {
      toast({
        title: "Error al enviar mensaje",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive"
      });
    }
  });

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedChatId) return;
    sendMessageMutation.mutate(newMessage);
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp || timestamp <= 0) return '';
    try {
      const date = new Date(timestamp * 1000);
      if (isNaN(date.getTime())) return '';
      if (isToday(date)) {
        return format(date, 'HH:mm');
      } else if (isYesterday(date)) {
        return 'Ayer';
      } else {
        return format(date, 'dd/MM/yyyy');
      }
    } catch (error) {
      return '';
    }
  };

  const formatMessageTime = (timestamp: number) => {
    if (!timestamp || timestamp <= 0) return '';
    try {
      const date = new Date(timestamp * 1000);
      if (isNaN(date.getTime())) return '';
      return format(date, 'HH:mm');
    } catch (error) {
      return '';
    }
  };

  const getSelectedChat = () => {
    return Array.isArray(chats) ? chats.find(chat => chat.id === selectedChatId) : null;
  };

  const isOnline = (chat: WhatsAppChat) => {
    if (chat.lastSeen) {
      const lastSeenTime = new Date(chat.lastSeen * 1000);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastSeenTime.getTime()) / (1000 * 60);
      return diffMinutes < 5;
    }
    return false;
  };

  // Filter chats based on search term
  const filteredChats = (Array.isArray(chats) ? chats : []).filter(chat =>
    chat?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat?.lastMessage?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Chat List */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-900">WhatsApp</h1>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar chats..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Chat List */}
        <ScrollArea className="flex-1">
          {isLoadingChats ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {filteredChats.map((chat) => (
                <motion.div
                  key={chat.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex items-center p-3 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors",
                    selectedChatId === chat.id ? "bg-blue-50 border-l-4 border-blue-500" : ""
                  )}
                  onClick={() => setSelectedChatId(chat.id)}
                >
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={chat.avatar} />
                      <AvatarFallback className="bg-blue-500 text-white">
                        {chat.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {isOnline(chat) && (
                      <Circle className="absolute bottom-0 right-0 h-3 w-3 text-green-500 fill-current" />
                    )}
                  </div>
                  
                  <div className="ml-3 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {chat.name}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {formatTime(chat.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-sm text-gray-600 truncate max-w-[200px]">
                        {chat.lastMessage}
                      </p>
                      {chat.unreadCount > 0 && (
                        <Badge className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                          {chat.unreadCount}
                        </Badge>
                      )}
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
        {selectedChatId ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={getSelectedChat()?.avatar} />
                    <AvatarFallback className="bg-blue-500 text-white">
                      {getSelectedChat()?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">
                      {getSelectedChat()?.name}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {isOnline(getSelectedChat()!) ? "En línea" : "Desconectado"}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm">
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Video className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {isLoadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {Array.isArray(messages) && messages.map((message) => {
                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "flex",
                          message.fromMe ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "max-w-xs lg:max-w-md px-4 py-2 rounded-lg",
                            message.fromMe
                              ? "bg-blue-500 text-white"
                              : "bg-white text-gray-900 border border-gray-200"
                          )}
                        >
                          <p className="text-sm">{message.body}</p>
                          <div className={cn(
                            "flex items-center justify-end mt-1 space-x-1",
                            message.fromMe ? "text-blue-100" : "text-gray-400"
                          )}>
                            <span className="text-xs">
                              {formatMessageTime(message.timestamp)}
                            </span>
                            {message.fromMe && (
                              <CheckCheck className="h-3 w-3" />
                            )}
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
                  variant="outline" 
                  size="sm" 
                  className="bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
                  onClick={() => {
                    toast({
                      title: "Agente IA Activado",
                      description: "Los 5 agentes externos están listos para generar respuestas automáticas",
                      variant: "default"
                    });
                  }}
                >
                  <Bot className="h-4 w-4" />
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
      </div>
    </div>
  );
}

export default WhatsAppTwoColumn;