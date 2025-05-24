import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  Smile,
  Paperclip,
  Languages,
  Image,
  FileText,
  Video,
  File,
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
  const [translatorEnabled, setTranslatorEnabled] = useState(false);
  const [smartBotsEnabled, setSmartBotsEnabled] = useState(false);
  
  // Estados para auto-envío con delay de 5 segundos
  const [autoSendTimer, setAutoSendTimer] = useState<NodeJS.Timeout | null>(null);
  const [isAutoSending, setIsAutoSending] = useState(false);
  
  // Estados para respuestas automáticas a mensajes recibidos
  const [lastProcessedMessageId, setLastProcessedMessageId] = useState<string | null>(null);
  const [lastMessageCount, setLastMessageCount] = useState(0);

  // Función específica para generar respuestas automáticas a mensajes recibidos (burbujas verdes)
  const generateSmartBotsAutoResponse = async (userMessage: string, contactName: string) => {
    try {
      console.log('🟢 Generando respuesta automática para mensaje recibido:', userMessage);
      
      const response = await fetch('/api/smartbots/generate-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          message: userMessage,
          contactName: contactName,
          context: `Respuesta automática para mensaje recibido de ${contactName}`,
          autoResponse: true
        })
      });

      const data = await response.json();
      
      if (data.success && data.response) {
        console.log('✅ Respuesta automática generada:', data.response);
        return data.response;
      } else {
        console.error('❌ Error generando respuesta automática:', data.error);
        return null;
      }
    } catch (error) {
      console.error('❌ Error en generación de respuesta automática:', error);
      return null;
    }
  };

  // Función para enviar mensaje automático
  const sendAutoMessage = async (message: string) => {
    if (!selectedChat) return;
    
    try {
      console.log('📤 Enviando respuesta automática:', message);
      
      const response = await fetch('/api/whatsapp/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: selectedChat.id,
          accountId: selectedChat.accountId,
          message: message
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Respuesta automática enviada exitosamente:', result);
        
        toast({
          title: "🤖 Respuesta automática enviada",
          description: "SmartBots ha respondido al mensaje recibido",
          duration: 3000
        });
        
        // Actualizar los mensajes del chat para mostrar el mensaje enviado
        queryClient.invalidateQueries({
          queryKey: ['/api/whatsapp-accounts', selectedChat.accountId, 'chats', selectedChat.id, 'messages']
        });
        
        // También actualizar la lista de chats
        queryClient.invalidateQueries({
          queryKey: ['/api/whatsapp-accounts', selectedChat.accountId, 'chats']
        });
        
      } else {
        const errorData = await response.json();
        console.error('❌ Error enviando respuesta automática:', errorData);
        
        toast({
          title: "❌ Error enviando respuesta",
          description: errorData.error || "No se pudo enviar la respuesta automática",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ Error en envío de respuesta automática:', error);
      
      toast({
        title: "❌ Error de conexión",
        description: "No se pudo conectar para enviar la respuesta",
        variant: "destructive"
      });
    }
  };

  // Función para generar respuesta manual con SmartBots
  const generateSmartBotsResponse = async (userMessage: string, contactName: string, isIncomingMessage = false) => {
    try {
      console.log('🤖 Generando respuesta SmartBots para:', userMessage);
      
      const response = await fetch('/api/smartbots/generate-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          contactName: contactName,
          context: `Conversación de WhatsApp con ${contactName}`
        })
      });

      const data = await response.json();
      
      if (data.success && data.response) {
        console.log('✅ Respuesta SmartBots:', data.response);
        
        if (isIncomingMessage) {
          // Para mensajes entrantes (burbujas verdes), enviar respuesta automática
          console.log('🟢 Mensaje recibido (burbuja verde) - enviando respuesta automática');
          
          // Enviar la respuesta automáticamente al servidor
          setTimeout(async () => {
            try {
              const response = await fetch(`/api/whatsapp-accounts/${selectedChat.accountId}/send-message`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                },
                body: JSON.stringify({
                  chatId: selectedChat.id,
                  message: data.response,
                  isAutoResponse: true
                })
              });

              if (response.ok) {
                console.log('✅ Respuesta automática enviada exitosamente');
                toast({
                  title: "Respuesta automática enviada",
                  description: "SmartBots ha respondido automáticamente al mensaje recibido",
                  duration: 3000
                });
                
                // Actualizar los mensajes del chat
                queryClient.invalidateQueries({
                  queryKey: ['/api/whatsapp-accounts', selectedChat.accountId, 'chats', selectedChat.id, 'messages']
                });
              } else {
                console.error('❌ Error enviando respuesta automática');
              }
            } catch (error) {
              console.error('❌ Error en respuesta automática:', error);
            }
          }, 2000); // Delay de 2 segundos para parecer más natural
          setNewMessage(data.response);
          
          toast({
            title: "🤖 Respuesta AI preparada",
            description: `SmartBots sugiere responder: "${data.response.substring(0, 50)}..."`,
          });
        } else {
          // Mostrar notificación de que se generó una respuesta
          toast({
            title: "🤖 Respuesta AI generada",
            description: `SmartBots sugiere: "${data.response.substring(0, 50)}..."`,
          });
        }
        
        return data.response;
      } else {
        console.error('❌ Error en SmartBots:', data.error);
        return null;
      }
    } catch (error) {
      console.error('❌ Error conectando con SmartBots:', error);
      return null;
    }
  };

  // Función para limpiar timer de auto-envío
  const clearAutoSendTimer = () => {
    if (autoSendTimer) {
      clearTimeout(autoSendTimer);
      setAutoSendTimer(null);
      setIsAutoSending(false);
    }
  };

  // Función para limpiar input después de auto-envío
  const clearInputAfterAutoSend = () => {
    setNewMessage('');
    clearAutoSendTimer();
  };

  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
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

  // Handle chat selection and mark messages as read
  const handleChatSelect = async (chat: WhatsAppChat) => {
    setSelectedChat(chat);
    setNewMessage(''); // Clear input when switching chats
    
    // Mark chat as read and reset unread count
    if (chat.unreadCount > 0) {
      try {
        console.log(`📖 Marcando chat ${chat.id} como leído (${chat.unreadCount} mensajes no leídos)`);
        
        // Call API to mark messages as read
        await fetch(`/api/whatsapp-accounts/${chat.accountId}/chats/${chat.id}/mark-read`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        // Update chat list to show zero unread count immediately
        queryClient.setQueryData(
          [`/api/whatsapp-accounts/${chat.accountId}/chats`],
          (oldChats: any) => {
            if (Array.isArray(oldChats)) {
              return oldChats.map((c: any) => 
                c.id === chat.id 
                  ? { ...c, unreadCount: 0, messageRead: true }
                  : c
              );
            }
            return oldChats;
          }
        );
        
        console.log(`✅ Chat ${chat.id} marcado como leído exitosamente`);
        
      } catch (error) {
        console.error('❌ Error marcando chat como leído:', error);
      }
    }
  };

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

  // Detectar mensajes nuevos y activar SmartBots automáticamente
  useEffect(() => {
    if (!messages || !smartBotsEnabled || !selectedChat) return;

    const currentMessages = Array.isArray(messages) ? messages : [];
    const currentCount = currentMessages.length;

    // Si hay mensajes nuevos
    if (currentCount > lastMessageCount && lastMessageCount > 0) {
      console.log(`🔍 Detectando mensajes: ${currentCount} actual vs ${lastMessageCount} anterior`);
      
      const newMessages = currentMessages.slice(lastMessageCount);
      console.log('📥 Mensajes nuevos encontrados:', newMessages.length);
      
      // Buscar mensajes entrantes (no enviados por nosotros)
      const incomingMessages = newMessages.filter((msg: any) => !msg.fromMe);
      
      if (incomingMessages.length > 0) {
        const lastIncomingMessage = incomingMessages[incomingMessages.length - 1];
        console.log('🤖 Mensaje entrante detectado:', lastIncomingMessage.body);
        
        // Solo procesar si no hemos procesado este mensaje antes
        if (lastIncomingMessage.id !== lastProcessedMessageId) {
          console.log('🔄 Procesando nuevo mensaje ID:', lastIncomingMessage.id);
          
          // Generar y enviar respuesta automática para el mensaje entrante
          setTimeout(async () => {
            try {
              console.log('🤖 Generando respuesta automática...');
              const response = await generateSmartBotsAutoResponse(lastIncomingMessage.body, selectedChat.name);
              if (response) {
                console.log('📤 Enviando respuesta automática:', response);
                await sendAutoMessage(response);
              } else {
                console.log('❌ No se pudo generar respuesta automática');
              }
            } catch (error) {
              console.error('❌ Error en respuesta automática:', error);
            }
          }, 2000);
          
          setLastProcessedMessageId(lastIncomingMessage.id);
        } else {
          console.log('⏭️ Mensaje ya procesado anteriormente');
        }
      } else {
        console.log('📤 Solo mensajes salientes detectados');
      }
    } else if (currentCount === lastMessageCount) {
      console.log('📊 Sin cambios en cantidad de mensajes');
    }

    setLastMessageCount(currentCount);
  }, [messages, smartBotsEnabled, selectedChat, lastMessageCount, lastProcessedMessageId]);

  // Detectar y traducir mensajes en inglés automáticamente
  useEffect(() => {
    if (!messages || !translatorEnabled) return;

    const currentMessages = Array.isArray(messages) ? messages : [];
    const currentCount = currentMessages.length;
    
    // Solo verificar los mensajes más recientes para evitar procesar repetidamente
    if (currentCount > lastMessageCount && lastMessageCount > 0) {
      const newMessages = currentMessages.slice(lastMessageCount);
      
      // Buscar mensajes en inglés que no son nuestros
      const englishMessages = newMessages.filter((msg: any) => 
        !msg.fromMe && 
        /\b(hello|hi|how|are|you|what|where|when|why|please|thank|thanks|good|morning|afternoon|evening|night|yes|no|ok|okay|can|can't|do|it|system)\b/i.test(msg.body)
      );

      if (englishMessages.length > 0) {
        const lastEnglishMessage = englishMessages[englishMessages.length - 1];
        
        // Mostrar traducción automática para mensajes nuevos
        if (lastEnglishMessage.body.length > 3) {
          console.log('🌐 Mensaje en inglés detectado:', lastEnglishMessage.body);
          
          // Traducción básica automática mejorada
          let spanishTranslation = lastEnglishMessage.body
            .replace(/hello|hi/gi, 'hola')
            .replace(/how are you/gi, 'cómo estás')
            .replace(/good morning/gi, 'buenos días')
            .replace(/good afternoon/gi, 'buenas tardes')
            .replace(/good evening|good night/gi, 'buenas noches')
            .replace(/thank you|thanks/gi, 'gracias')
            .replace(/please/gi, 'por favor')
            .replace(/what/gi, 'qué')
            .replace(/where/gi, 'dónde')
            .replace(/when/gi, 'cuándo')
            .replace(/why/gi, 'por qué')
            .replace(/how/gi, 'cómo')
            .replace(/yes/gi, 'sí')
            .replace(/\bno\b/gi, 'no')
            .replace(/ok|okay/gi, 'está bien')
            .replace(/can't/gi, 'no puedes')
            .replace(/can/gi, 'puedes')
            .replace(/\bdo\b/gi, 'hacer')
            .replace(/\bit\b/gi, 'eso')
            .replace(/system/gi, 'sistema')
            .replace(/\bor\b/gi, 'o');

          if (spanishTranslation !== lastEnglishMessage.body) {
            console.log('🌐 Traducción:', `"${lastEnglishMessage.body}" → "${spanishTranslation}"`);
            
            // Crear un mensaje de traducción interno (solo para nuestro sistema)
            const translationMessage = {
              id: `translation_${lastEnglishMessage.id}_${Date.now()}`,
              body: `🌐 Traducción: "${spanishTranslation}"`,
              fromMe: false,
              timestamp: new Date().toISOString(),
              isTranslation: true, // Marcador especial para mensajes de traducción
              originalMessageId: lastEnglishMessage.id
            };
            
            // Agregar el mensaje de traducción a la lista de mensajes localmente
            // (esto no se envía a WhatsApp, solo aparece en nuestra interfaz)
            if (Array.isArray(messages) && selectedChat) {
              const updatedMessages = [...messages, translationMessage];
              // Esto actualizará la vista local pero no enviará nada a WhatsApp
              queryClient.setQueryData(
                [`/api/whatsapp-accounts/${selectedChat.accountId}/messages/${selectedChat.id}`],
                updatedMessages
              );
            }
          }
        }
      }
    }
  }, [messages, translatorEnabled, lastMessageCount]);

  // Initialize with all accounts selected by default
  useEffect(() => {
    if ((accounts as any[])?.length > 0 && selectedAccounts.length === 0) {
      // Select all accounts by default
      const allAccountIds = (accounts as any[]).map((acc: any) => acc.id);
      setSelectedAccounts(allAccountIds);
    }
  }, [accounts, selectedAccounts]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;
    
    let finalMessage = newMessage.trim();
    
    // Si el traductor está activado, traducir el mensaje antes de enviarlo
    if (translatorEnabled) {
      try {
        console.log('🌐 Traduciendo mensaje:', finalMessage);
        
        // Detectar idioma
        const isSpanish = /[áéíóúñ¿¡]|hola|como|que|para|con|una|este|todo|pero|muy|cuando|hasta|donde|gracias|por favor|buenos días|buenas tardes|buenas noches/i.test(finalMessage);
        const sourceLanguage = isSpanish ? 'es' : 'en';
        const targetLanguage = isSpanish ? 'en' : 'es';
        
        // Usar Google Translate API directamente
        const googleTranslateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLanguage}&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(finalMessage)}`;
        
        const response = await fetch(googleTranslateUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          const translatedText = data[0]?.map((item: any) => item[0]).join('') || finalMessage;
          
          if (translatedText && translatedText !== finalMessage) {
            finalMessage = translatedText;
            console.log('✅ Mensaje traducido:', finalMessage);
            
            toast({
              title: "Mensaje traducido",
              description: `De ${sourceLanguage === 'es' ? 'Español' : 'Inglés'} a ${targetLanguage === 'es' ? 'Español' : 'Inglés'}`,
            });
          } else {
            throw new Error('No se pudo obtener traducción');
          }
        } else {
          throw new Error('Error en Google Translate API');
        }
        
      } catch (translateError) {
        console.warn('Google Translate falló, usando traducción básica:', translateError);
        
        // Traducción básica de respaldo
        const isSpanish = /[áéíóúñ¿¡]|hola|como|que|para|con|una|este|todo|pero|muy|cuando|hasta|donde|gracias|por favor/i.test(finalMessage);
        
        if (isSpanish) {
          finalMessage = finalMessage
            .replace(/hola/gi, 'hello')
            .replace(/como estas/gi, 'how are you')
            .replace(/como/gi, 'how')
            .replace(/que tal/gi, 'how are you')
            .replace(/que/gi, 'what')
            .replace(/donde/gi, 'where')
            .replace(/cuando/gi, 'when')
            .replace(/por favor/gi, 'please')
            .replace(/gracias/gi, 'thank you')
            .replace(/buenos días/gi, 'good morning')
            .replace(/buenas tardes/gi, 'good afternoon')
            .replace(/buenas noches/gi, 'good night');
        } else {
          finalMessage = finalMessage
            .replace(/hello/gi, 'hola')
            .replace(/how are you/gi, 'como estas')
            .replace(/how/gi, 'como')
            .replace(/what/gi, 'que')
            .replace(/where/gi, 'donde')
            .replace(/when/gi, 'cuando')
            .replace(/please/gi, 'por favor')
            .replace(/thank you/gi, 'gracias')
            .replace(/good morning/gi, 'buenos días')
            .replace(/good afternoon/gi, 'buenas tardes')
            .replace(/good night/gi, 'buenas noches');
        }
        
        toast({
          title: "Traducción básica aplicada",
          description: "Se usó traducción simplificada",
        });
      }
    }
    
    sendMessageMutation.mutate({
      chatId: selectedChat.id,
      accountId: selectedChat.accountId,
      message: finalMessage
    });
    
    // Si SmartBots está activado, generar respuesta automática sugerida
    if (smartBotsEnabled && selectedChat) {
      setTimeout(async () => {
        try {
          const aiResponse = await generateSmartBotsResponse(finalMessage, selectedChat.name);
          if (aiResponse) {
            // Mostrar la respuesta sugerida en el campo de texto
            setNewMessage(aiResponse);
            
            toast({
              title: "🤖 Respuesta AI lista",
              description: "SmartBots ha generado una respuesta sugerida. Puedes editarla antes de enviar.",
            });
          }
        } catch (error) {
          console.error('Error generando respuesta SmartBots:', error);
        }
      }, 1000); // Esperar 1 segundo después de enviar el mensaje
    }
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
                    onClick={() => handleChatSelect(chat)}
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
                  
                  {/* SmartBots AI Button */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                  >
                    <Button
                      size="sm"
                      variant={smartBotsEnabled ? "default" : "outline"}
                      className={`shadow-sm transition-all duration-300 ${
                        smartBotsEnabled 
                          ? "bg-purple-600 hover:bg-purple-700 text-white" 
                          : "border-purple-600 text-purple-600 hover:bg-purple-50"
                      }`}
                      onClick={() => {
                        setSmartBotsEnabled(!smartBotsEnabled);
                        toast({
                          title: smartBotsEnabled ? "SmartBots desactivado" : "SmartBots activado",
                          description: smartBotsEnabled 
                            ? "Las respuestas automáticas están desactivadas" 
                            : "Las respuestas se generarán automáticamente con IA",
                        });
                      }}
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      {smartBotsEnabled ? "AI ON" : "AI OFF"}
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
                            
                            <div className={`flex items-end gap-1 ${message.fromMe ? 'justify-end' : 'flex-row'}`}>
                              {message.fromMe && (
                                <div className="text-xs text-black pt-[10px] pb-[10px] ml-[2px] mr-[2px] flex-shrink-0">
                                  {formatTime(message.timestamp)}
                                </div>
                              )}
                              <div
                                className={`px-4 py-2 rounded-2xl ${
                                  message.fromMe
                                    ? 'bg-blue-100 text-black rounded-br-md'
                                    : 'bg-green-100 text-black rounded-bl-md'
                                }`}
                              >
                                <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                              </div>
                              {!message.fromMe && (
                                <div className="text-xs text-black pt-[10px] pb-[10px] ml-[2px] mr-[2px] flex-shrink-0">
                                  {formatTime(message.timestamp)}
                                </div>
                              )}
                              {message.fromMe && (
                                <div className="text-xs pt-[10px] pb-[10px] ml-[2px] mr-[8px] flex-shrink-0">
                                  <span className={`${
                                    message.messageRead 
                                      ? 'text-blue-500' 
                                      : message.type === 'delivered' 
                                        ? 'text-gray-500' 
                                        : 'text-gray-400'
                                  }`}>
                                    {message.messageRead 
                                      ? '✓✓' 
                                      : (message.type === 'delivered' || message.type === 'received') 
                                        ? '✓✓' 
                                        : '✓'}
                                  </span>
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

            {/* Enhanced Message Input with Tools */}
            <div className="p-4 border-t border-gray-200 bg-white">
              {/* Toolbar */}
              <div className="flex items-center space-x-2 mb-3">
                {/* Emoji Picker */}
                <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0"
                    >
                      <Smile className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="grid grid-cols-8 gap-2 p-2">
                      {['😊', '😂', '❤️', '👍', '👋', '🙏', '😘', '😍', '🤔', '😅', '👌', '🔥', '💯', '✨', '🎉', '🚀', '💪', '🙌', '👏', '💝', '🌟', '⭐', '💖', '💕'].map((emoji) => (
                        <Button
                          key={emoji}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-lg"
                          onClick={() => {
                            setNewMessage(prev => prev + emoji);
                            setEmojiPickerOpen(false);
                          }}
                        >
                          {emoji}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* File Attachment Menu */}
                <Popover open={fileMenuOpen} onOpenChange={setFileMenuOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48">
                    <div className="space-y-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => {
                          // Trigger file input for images
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              toast({
                                title: "Imagen seleccionada",
                                description: `${file.name} listo para enviar`,
                              });
                            }
                          };
                          input.click();
                          setFileMenuOpen(false);
                        }}
                      >
                        <Image className="h-4 w-4 mr-2" />
                        Imagen
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => {
                          // Trigger file input for videos
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'video/*';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              toast({
                                title: "Video seleccionado",
                                description: `${file.name} listo para enviar`,
                              });
                            }
                          };
                          input.click();
                          setFileMenuOpen(false);
                        }}
                      >
                        <Video className="h-4 w-4 mr-2" />
                        Video
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => {
                          // Trigger file input for documents
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = '.pdf,.doc,.docx,.txt,.xlsx,.pptx';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              toast({
                                title: "Documento seleccionado",
                                description: `${file.name} listo para enviar`,
                              });
                            }
                          };
                          input.click();
                          setFileMenuOpen(false);
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Documento
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => {
                          // Trigger file input for any file
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              toast({
                                title: "Archivo seleccionado",
                                description: `${file.name} listo para enviar`,
                              });
                            }
                          };
                          input.click();
                          setFileMenuOpen(false);
                        }}
                      >
                        <File className="h-4 w-4 mr-2" />
                        Archivo
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Translator Toggle */}
                <Button
                  variant={translatorEnabled ? "default" : "outline"}
                  size="sm"
                  className={`h-9 w-9 p-0 ${translatorEnabled ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                  onClick={() => {
                    setTranslatorEnabled(!translatorEnabled);
                    toast({
                      title: translatorEnabled ? "Traductor desactivado" : "Traductor activado",
                      description: translatorEnabled 
                        ? "Los mensajes se enviarán sin traducir" 
                        : "Los mensajes se traducirán automáticamente",
                    });
                  }}
                >
                  <Languages className="h-4 w-4" />
                </Button>

                {/* Translator Status Indicator */}
                {translatorEnabled && (
                  <div className="flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                    <Languages className="h-3 w-3" />
                    <span>Traductor ON</span>
                  </div>
                )}
              </div>

              {/* Message Input */}
              <div className="flex space-x-2">
                <Input
                  placeholder={translatorEnabled ? "Escribe un mensaje (se traducirá automáticamente)..." : isAutoSending ? "Auto-enviando en 5 segundos..." : "Escribe un mensaje..."}
                  value={newMessage}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNewMessage(value);
                    
                    // Auto-envío con delay de 5 segundos
                    if (autoSendTimer) {
                      clearTimeout(autoSendTimer);
                      setAutoSendTimer(null);
                      setIsAutoSending(false);
                    }
                    
                    if (value.trim().length > 0) {
                      setIsAutoSending(true);
                      const timer = setTimeout(() => {
                        if (newMessage.trim().length > 0) {
                          handleSendMessage();
                        }
                        setIsAutoSending(false);
                        setAutoSendTimer(null);
                      }, 5000);
                      setAutoSendTimer(timer);
                    }
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      // Cancelar auto-envío si el usuario presiona Enter manualmente
                      if (autoSendTimer) {
                        clearTimeout(autoSendTimer);
                        setAutoSendTimer(null);
                        setIsAutoSending(false);
                      }
                      handleSendMessage();
                    }
                  }}
                  className={`flex-1 ${isAutoSending ? 'border-orange-400 bg-orange-50' : ''}`}
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