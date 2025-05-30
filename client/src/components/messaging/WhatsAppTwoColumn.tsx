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
  Bot
} from 'lucide-react';

// Import components
import { AccountSelector } from './AccountSelector';
import ChatAssignmentDialog from './ChatAssignmentDialog';

// Translation functionality
function MessageTranslation({ text, messageId, translationEnabled, messages }: { 
  text: string; 
  messageId: string; 
  translationEnabled: boolean;
  messages: WhatsAppMessage[];
}) {
  const [translatedText, setTranslatedText] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  const handleTranslate = async () => {
    if (!translationEnabled) {
      toast({
        title: "Translation disabled",
        description: "Enable translation in settings to use this feature.",
        variant: "default"
      });
      return;
    }

    setIsTranslating(true);
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, target: 'es' })
      });
      
      if (response.ok) {
        const data = await response.json();
        setTranslatedText(data.translatedText);
        setShowTranslation(true);
      }
    } catch (error) {
      console.error('Translation error:', error);
      toast({
        title: "Translation failed",
        description: "Could not translate message.",
        variant: "destructive"
      });
    } finally {
      setIsTranslating(false);
    }
  };

  if (!translationEnabled) return null;

  return (
    <div className="mt-1">
      <Button
        size="sm"
        variant="ghost"
        onClick={handleTranslate}
        disabled={isTranslating}
        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        {isTranslating ? (
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
        ) : (
          <Languages className="h-3 w-3 mr-1" />
        )}
        Translate
      </Button>
      
      {showTranslation && (
        <div className="mt-1 p-2 bg-muted rounded text-sm text-muted-foreground">
          {translatedText}
        </div>
      )}
    </div>
  );
}

function ChatAssignmentBadge({ chatId, accountId }: { chatId: string; accountId: number }) {
  const { data: assignment } = useQuery({
    queryKey: ['/api/chat-assignments', chatId],
    enabled: !!chatId
  });

  if (!assignment?.users || assignment.users.length === 0) {
    return null;
  }

  return (
    <Badge variant="secondary" className="text-xs">
      <User className="h-3 w-3 mr-1" />
      {assignment.users.length} assigned
    </Badge>
  );
}

function AgentAssignmentDisplay({ chatId }: { chatId: string }) {
  const { data: assignment } = useQuery({
    queryKey: ['/api/chat-assignments', chatId],
    enabled: !!chatId
  });

  if (!assignment?.data?.users || assignment.data.users.length === 0) {
    return (
      <Badge variant="outline" className="text-xs">
        <UserPlus className="h-3 w-3 mr-1" />
        Unassigned
      </Badge>
    );
  }

  return (
    <Badge variant="default" className="text-xs">
      <User className="h-3 w-3 mr-1" />
      {assignment.data.users.length} agent{assignment.data.users.length !== 1 ? 's' : ''}
    </Badge>
  );
}

function ChatCategorizationBadge({ chatId, accountId }: { chatId: string; accountId: number }) {
  const { data: assignment } = useQuery({
    queryKey: ['/api/chat-assignments', chatId],
    enabled: !!chatId
  });

  if (!assignment?.data?.status) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-500';
      case 'in_progress': return 'bg-yellow-500';
      case 'resolved': return 'bg-green-500';
      case 'closed': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <Badge variant="secondary" className="text-xs">
      <div className={`w-2 h-2 rounded-full mr-1 ${getStatusColor(assignment.data.status)}`} />
      {assignment.data.status.replace('_', ' ')}
    </Badge>
  );
}

function TicketStatusBadge({ chatId }: { chatId: string }) {
  const { data: assignment } = useQuery({
    queryKey: ['/api/chat-assignments', chatId],
    enabled: !!chatId
  });

  if (!assignment?.data?.category) {
    return null;
  }

  return (
    <Badge variant="outline" className="text-xs">
      <Tag className="h-3 w-3 mr-1" />
      {assignment.data.category}
    </Badge>
  );
}

function ChatCommentsIndicator({ chatId }: { chatId: string }) {
  const { data: comments } = useQuery({
    queryKey: ['/api/chat-comments', chatId],
    enabled: !!chatId
  });

  if (!comments?.data?.length || comments.data.length === 0) {
    return null;
  }

  return (
    <Badge variant="secondary" className="text-xs">
      <MessageSquareMore className="h-3 w-3 mr-1" />
      {comments.data.length} comment{comments.data.length !== 1 ? 's' : ''}
    </Badge>
  );
}

function WhatsAppAccountBadge({ accountId }: { accountId: number }) {
  const { data: accounts } = useQuery({ queryKey: ['/api/whatsapp-accounts'] });

  if (!accounts || typeof accounts !== 'object') {
    return null;
  }

  const account = (accounts as any[]).find((acc: any) => acc.id === accountId);
  if (!account) return null;

  return (
    <Badge variant="outline" className="text-xs">
      <Smartphone className="h-3 w-3 mr-1" />
      {account.name}
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
  // Core component states
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [selectedChat, setSelectedChat] = useState<WhatsAppChat | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [translatorEnabled, setTranslatorEnabled] = useState(false);
  
  // Assignment dialog states
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [assignmentChatId, setAssignmentChatId] = useState<string>('');
  const [assignmentAccountId, setAssignmentAccountId] = useState<number>(0);
  
  // Estado para almacenar mensajes originales de envíos traducidos
  const [sentMessageOrigins, setSentMessageOrigins] = useState<Record<string, string>>({});

  // Setup query client and WebSocket
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Setup WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('WebSocket connected');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'new_message') {
          queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-chats'] });
          queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-messages'] });
        }
        
        if (data.type === 'chat_assignment') {
          queryClient.invalidateQueries({ queryKey: ['/api/chat-assignments'] });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
    };

    return () => {
      socket.close();
    };
  }, [queryClient]);

  // Event listeners for dialog management
  useEffect(() => {
    const handleOpenAssignmentDialog = (event: CustomEvent) => {
      const { chatId, accountId } = event.detail;
      setAssignmentChatId(chatId);
      setAssignmentAccountId(accountId);
      setAssignmentDialogOpen(true);
    };

    window.addEventListener('openAssignmentDialog', handleOpenAssignmentDialog as EventListener);
    return () => {
      window.removeEventListener('openAssignmentDialog', handleOpenAssignmentDialog as EventListener);
    };
  }, []);

  // Data fetching
  const { data: accounts } = useQuery({ queryKey: ['/api/whatsapp-accounts'] });
  const { data: chats } = useQuery({ queryKey: ['/api/whatsapp/chats'] });
  
  const { data: messages } = useQuery({
    queryKey: ['/api/whatsapp/messages', selectedChat?.id],
    enabled: !!selectedChat
  });

  // Chat selection handler
  const handleChatSelect = async (chat: WhatsAppChat) => {
    setSelectedChat(chat);
    setNewMessage('');
  };

  // Message sending mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: { chatId: string; body: string; accountId: number }) => {
      const response = await fetch('/api/whatsapp-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData)
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-chats'] });
      
      // Store original message before translation
      setSentMessageOrigins(prev => ({
        ...prev,
        [Date.now().toString()]: newMessage
      }));

      setNewMessage('');
      
      if (selectedChat) {
        // Update chat timestamp and last message
        queryClient.setQueryData(['/api/whatsapp-chats'], (oldData: any) => {
          if (!oldData) return oldData;
          return oldData.map((chat: WhatsAppChat) => 
            chat.id === selectedChat.id 
              ? { ...chat, timestamp: Date.now(), lastMessage: newMessage }
              : chat
          );
        });
      }
    }
  });

  // Handle message sending
  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedChat) return;

    sendMessageMutation.mutate({
      chatId: selectedChat.id,
      body: newMessage,
      accountId: selectedChat.accountId
    });
  };

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Message formatting
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString();
    }
  };

  // Contact online status
  const isContactOnline = (chat: WhatsAppChat) => {
    if (chat.isOnline) return true;
    if (chat.lastSeen) {
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      return chat.lastSeen > fiveMinutesAgo;
    }
    return false;
  };

  // Account filtering
  const getSelectedAccount = () => {
    if (!accounts || typeof accounts !== 'object') return null;
    return (accounts as any[]).find((acc: any) => selectedAccounts.includes(acc.id));
  };

  // Message filtering and display logic
  const filteredChats = useMemo(() => {
    if (!chats || !Array.isArray(chats)) return [];
    
    let filtered = chats as WhatsAppChat[];
    
    if (selectedAccounts.length > 0) {
      filtered = filtered.filter(chat => selectedAccounts.includes(chat.accountId));
    }
    
    if (searchQuery) {
      filtered = filtered.filter(chat => 
        chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }, [chats, selectedAccounts, searchQuery]);

  return (
    <div className="flex h-full bg-gray-50">
      {/* Left Column - Chat List */}
      <div className="w-1/3 border-r bg-white flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-green-600 text-white">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center">
              <MessageCircle className="h-5 w-5 mr-2" />
              WhatsApp Chats
            </h2>
            <AccountSelector 
              accounts={accounts as WhatsAppAccount[] || []}
              selectedAccounts={selectedAccounts}
              onAccountsChange={setSelectedAccounts}
              onAccountClick={(accountId) => console.log('Account clicked:', accountId)}
            />
          </div>
          
          {/* Search */}
          <Input
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-white text-black"
          />
        </div>

        {/* Chat List */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {filteredChats.map((chat) => (
              <Card
                key={chat.id}
                className={`mb-2 cursor-pointer transition-colors hover:bg-gray-50 ${
                  selectedChat?.id === chat.id ? 'ring-2 ring-green-500 bg-green-50' : ''
                }`}
                onClick={() => handleChatSelect(chat)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start space-x-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={chat.profilePicUrl} />
                      <AvatarFallback>
                        {chat.isGroup ? <Users className="h-4 w-4" /> : chat.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-sm truncate">
                          {chat.name}
                        </h4>
                        <div className="flex items-center space-x-1">
                          {isContactOnline(chat) ? (
                            <Wifi className="h-3 w-3 text-green-500" />
                          ) : (
                            <WifiOff className="h-3 w-3 text-gray-400" />
                          )}
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(chat.timestamp)}
                          </span>
                        </div>
                      </div>
                      
                      <p className="text-xs text-gray-600 truncate mb-2">
                        {chat.lastMessage}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                          <WhatsAppAccountBadge accountId={chat.accountId} />
                          <ChatAssignmentBadge chatId={chat.id} accountId={chat.accountId} />
                          <ChatCategorizationBadge chatId={chat.id} accountId={chat.accountId} />
                          <TicketStatusBadge chatId={chat.id} />
                          <ChatCommentsIndicator chatId={chat.id} />
                        </div>
                        
                        {chat.unreadCount > 0 && (
                          <Badge variant="destructive" className="text-xs">
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
        </ScrollArea>
      </div>

      {/* Right Column - Messages */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b bg-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedChat.profilePicUrl} />
                  <AvatarFallback>
                    {selectedChat.isGroup ? <Users className="h-4 w-4" /> : selectedChat.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                
                <div>
                  <h3 className="font-semibold">{selectedChat.name}</h3>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    {isContactOnline(selectedChat) ? (
                      <span className="flex items-center">
                        <Wifi className="h-3 w-3 mr-1 text-green-500" />
                        Online
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <WifiOff className="h-3 w-3 mr-1 text-gray-400" />
                        {selectedChat.lastSeen ? `Last seen ${formatTimestamp(selectedChat.lastSeen)}` : 'Offline'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <AgentAssignmentDisplay chatId={selectedChat.id} />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setAssignmentChatId(selectedChat.id);
                    setAssignmentAccountId(selectedChat.accountId);
                    setAssignmentDialogOpen(true);
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Assign
                </Button>
              </div>
            </div>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages && Array.isArray(messages) && messages.map((message: WhatsAppMessage) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[45%] p-3 rounded-lg ${
                      message.fromMe 
                        ? 'bg-green-500 text-white' 
                        : 'bg-white border'
                    }`}>
                      {!message.fromMe && message.author && (
                        <div className="text-xs font-medium mb-1 text-gray-600">
                          {message.author}
                        </div>
                      )}
                      
                      <div className="text-sm">
                        {message.body}
                      </div>
                      
                      <div className={`text-xs mt-1 ${
                        message.fromMe ? 'text-green-100' : 'text-gray-500'
                      }`}>
                        {formatTimestamp(message.timestamp)}
                      </div>
                      
                      <MessageTranslation 
                        text={message.body}
                        messageId={message.id}
                        translationEnabled={translatorEnabled}
                        messages={messages}
                      />
                    </div>
                  </motion.div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t bg-white">
              <div className="flex space-x-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  size="icon"
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
          /* No Chat Selected */
          <div className="flex-1 flex items-center justify-center text-center">
            <div>
              <MessageCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Select a chat to start messaging
              </h3>
              <p className="text-gray-500">
                Choose a conversation from the chat list to view and send messages
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Assignment Dialog */}
      <ChatAssignmentDialog
        open={assignmentDialogOpen}
        onOpenChange={setAssignmentDialogOpen}
        chatId={assignmentChatId}
        accountId={assignmentAccountId}
      />
    </div>
  );
}