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
  Zap,
  Ticket,
  Bot,
  Play,
  RefreshCw,
  Plus,
  Filter,
  Palette,
  X,
  Check
} from 'lucide-react';

// Import components
import { AccountSelector } from './AccountSelector';
import ChatAssignmentDialog from './ChatAssignmentDialog';
import { AutoResponseFixed } from './AutoResponseFixed';
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

  // Cargar lista de agentes para obtener el nombre
  const { data: usersResponse } = useQuery({
    queryKey: ['/api/users'],
    staleTime: 60000, // Cache por 1 minuto
  });

  console.log('🔍 Debug Badge - Assignment:', assignmentResponse);
  console.log('🔍 Debug Badge - Users:', usersResponse);

  const users = Array.isArray(usersResponse?.users) ? usersResponse.users : 
                Array.isArray(usersResponse) ? usersResponse : [];
  const assignment = assignmentResponse;

  // Si no hay asignación, mostrar solo el muñequito sin texto
  if (!assignment || !assignment.assignedToId) {
    return (
      <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs">
        <UserPlus className="h-3 w-3" />
      </Badge>
    );
  }

  // Si hay asignación, encontrar el agente y mostrar el nombre de usuario
  const assignedAgent = users.find((user: any) => user.id === assignment.assignedToId);
  
  console.log('🔍 Debug Badge - Assigned Agent:', assignedAgent);
  console.log('🔍 Debug Badge - Assignment ID:', assignment.assignedToId);

  // Si no se encuentra el agente, mostrar solo el icono
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

  // Cargar lista de agentes para obtener el nombre
  const { data: usersResponse } = useQuery({
    queryKey: ['/api/users'],
    staleTime: 60000, // Cache por 1 minuto
  });

  console.log('🔍 Debug Header - Assignment:', assignmentResponse);
  console.log('🔍 Debug Header - Users:', usersResponse);

  const users = Array.isArray(usersResponse?.users) ? usersResponse.users : 
                Array.isArray(usersResponse) ? usersResponse : [];
  const assignment = assignmentResponse;

  // Si no hay asignación, mostrar "Desconectado"
  if (!assignment || !assignment.assignedToId) {
    return <span>Desconectado</span>;
  }

  // Si hay asignación, encontrar el agente y mostrar el nombre
  const assignedAgent = users.find((user: any) => user.id === assignment.assignedToId);
  
  console.log('🔍 Debug Header - Assigned Agent:', assignedAgent);
  console.log('🔍 Debug Header - Assignment ID:', assignment.assignedToId);

  if (!assignedAgent) {
    return <span>Desconectado</span>;
  }

  return (
    <span className="text-blue-600 font-medium">
      {assignedAgent.username}
    </span>
  );
}

function ChatCategorizationBadge({ chatId, accountId }: { chatId: string; accountId: number }) {
  const { data: category, error } = useQuery({
    queryKey: ['/api/chat-categories', chatId],
    enabled: !!chatId,
    retry: 1,
    refetchOnWindowFocus: false
  });

  // Debug para verificar qué está recibiendo
  console.log('🎫 Debug Badge Category - chatId:', chatId, 'data:', category, 'error:', error);

  // Solo mostrar si hay un ticket real (no mostrar "Sin ticket")
  if (!category) {
    return null;
  }

  const getTicketColor = (status: string) => {
    switch (status) {
      case 'nuevos': return 'bg-green-50 text-green-700 border-green-200';
      case 'interesados': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'no-leidos': return 'bg-red-50 text-red-700 border-red-200';
      case 'pendiente-demo': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'completados': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'no-interesados': return 'bg-gray-50 text-gray-700 border-gray-200';
      default: return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const getTicketIcon = (status: string) => {
    switch (status) {
      case 'nuevos': return '📋';
      case 'interesados': return '💡';
      case 'no-leidos': return '📧';
      case 'pendiente-demo': return '🎯';
      case 'completados': return '✅';
      case 'no-interesados': return '❌';
      default: return '📋';
    }
  };

  const status = category?.status || 'sin-ticket';

  return (
    <Badge variant="outline" className={`text-xs ${getTicketColor(status)}`}>
      <span className="mr-1">{getTicketIcon(status)}</span>
      {status === 'nuevos' ? 'Nuevos' :
       status === 'interesados' ? 'Interesados' :
       status === 'no-leidos' ? 'No Leidos' :
       status === 'pendiente-demo' ? 'Pendiente Demo' :
       status === 'completados' ? 'Completados' :
       status === 'no-interesados' ? 'No Interesados' :
       'Sin ticket'}
    </Badge>
  );
}

function ChatCommentsIndicator({ chatId }: { chatId: string }) {
  const { data: comments = [] } = useQuery({
    queryKey: ['/api/chat-comments', chatId],
    enabled: !!chatId
  });

  // Solo mostrar si hay comentarios
  if (!comments || comments.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center relative">
      <MessageSquareMore className="h-4 w-4 text-orange-600" />
      <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-[10px] rounded-full h-5 w-5 flex items-center justify-center font-bold border-2 border-white">
        {comments.length > 99 ? '99+' : comments.length}
      </div>
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [showCreateCategoryDialog, setShowCreateCategoryDialog] = useState(false);
  const [newCategoryData, setNewCategoryData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    icon: 'MessageCircle'
  });
  const [chatTypeFilter, setChatTypeFilter] = useState<'all' | 'individual' | 'groups'>('all');
  const [categoryLoadingChat, setCategoryLoadingChat] = useState<string | null>(null);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [translatorEnabled, setTranslatorEnabled] = useState(false);
  const [smartBotsEnabled, setSmartBotsEnabled] = useState(false);
  const [selectedExternalAgent, setSelectedExternalAgent] = useState<string>('');
  
  // Estados para auto-envío con delay de 5 segundos
  const [autoSendTimer, setAutoSendTimer] = useState<NodeJS.Timeout | null>(null);
  const [isAutoSending, setIsAutoSending] = useState(false);
  
  // Estados para R.A. AI
  const [raAiEnabled, setRaAiEnabled] = useState(false);
  const [raAiProcessing, setRaAiProcessing] = useState(false);

  // Estados para Auto-Click con configuración personalizada
  const [autoClickTimers, setAutoClickTimers] = useState<{ ae: NodeJS.Timeout | null; send: NodeJS.Timeout | null }>({ ae: null, send: null });
  const [autoClickEnabled, setAutoClickEnabled] = useState(false);
  const [showAutoClickConfig, setShowAutoClickConfig] = useState(false);
  const [autoClickSettings, setAutoClickSettings] = useState({
    aeWaitTime: 4000,  // Tiempo de espera después del clic A.E (milisegundos)
    sendWaitTime: 8000, // Tiempo entre ciclos de auto-clic (milisegundos)
    enabled: false
  });
  
  // Estados para auto-clics (ya definidos arriba con configuración)
  const [autoClickActive, setAutoClickActive] = useState(false);
  const [autoClickStopFunction, setAutoClickStopFunction] = useState<(() => void) | null>(null);

  // Función DIRECTA: CLIC A.E → ESPERAR → CLIC ENVIAR
  // VERSIÓN SIMPLIFICADA SIN VALIDACIONES RESTRICTIVAS
  const startAutoClicks = () => {
    console.log('🚀 INICIANDO AUTO-CLIC SIMPLIFICADO');
    
    const timer = setInterval(() => {
      console.log('🔄 Ejecutando auto-clic simplificado...');
      
      // Solo verificar que hay un chat seleccionado y SmartBots habilitado
      console.log('🔍 DEBUG Auto-click:', {
        selectedChat: selectedChat ? selectedChat.id : 'NULL',
        smartBotsEnabled,
        autoClickEnabled
      });
      
      if (!selectedChat || !smartBotsEnabled) {
        console.log('⚠️ No hay chat seleccionado o SmartBots deshabilitado', {
          hasSelectedChat: !!selectedChat,
          smartBotsEnabled,
          chatId: selectedChat?.id || 'none'
        });
        return;
      }

      // Verificar si hay texto "ÚLTIMO RECIBIDO" en la página
      const bodyText = document.body.innerText || '';
      const hasLastReceived = bodyText.includes('ÚLTIMO RECIBIDO') || bodyText.includes('último recibido');
      
      if (!hasLastReceived) {
        console.log('⚠️ No hay indicador "ÚLTIMO RECIBIDO" visible');
        return;
      }
      
      console.log('✅ Condiciones cumplidas, ejecutando auto-click (sin validación de timestamp)...');
      
      // BUSCAR Y HACER CLIC EN BOTÓN A.E
      const aeButtons = document.querySelectorAll('button');
      let aeButtonFound = false;
      
      aeButtons.forEach(button => {
        if (button.textContent?.includes('🤖 A.E') && !button.disabled) {
          console.log('✅ Haciendo clic en botón A.E...');
          aeButtonFound = true;
          button.click();
          
          // ESPERAR Y BUSCAR BOTÓN ENVIAR CON MÚLTIPLES MÉTODOS
          setTimeout(() => {
            console.log('⏱️ Buscando botón Enviar con múltiples métodos...');
            let sendButtonFound = false;
            
            // MÉTODO 1: Buscar por texto
            const textButtons = Array.from(document.querySelectorAll('button')).filter(btn => 
              (btn.textContent?.includes('Enviar') || btn.textContent?.includes('Send')) && !btn.disabled
            );
            
            if (textButtons.length > 0) {
              console.log('🔴 MÉTODO 1 - Encontrado botón por texto, haciendo clic...');
              textButtons[0].click();
              sendButtonFound = true;
            }
            
            // MÉTODO 2: Buscar por clase CSS (botón verde)
            if (!sendButtonFound) {
              const greenButtons = Array.from(document.querySelectorAll('button')).filter(btn => 
                btn.className?.includes('bg-green') && !btn.disabled
              );
              
              if (greenButtons.length > 0) {
                console.log('🔴 MÉTODO 2 - Encontrado botón verde, haciendo clic...');
                greenButtons[0].click();
                sendButtonFound = true;
              }
            }
            
            // MÉTODO 3: Buscar por ícono SVG (Send icon)
            if (!sendButtonFound) {
              const svgButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
                const svg = btn.querySelector('svg');
                return svg && !btn.disabled;
              });
              
              // Tomar el último botón con SVG (probablemente el Send)
              if (svgButtons.length > 0) {
                const lastSvgButton = svgButtons[svgButtons.length - 1];
                console.log('🔴 MÉTODO 3 - Encontrado botón con ícono, haciendo clic...');
                lastSvgButton.click();
                sendButtonFound = true;
              }
            }
            
            // MÉTODO 4: Buscar en el área de input específicamente
            if (!sendButtonFound) {
              const inputArea = document.querySelector('.flex.space-x-2') || document.querySelector('[class*="input"]');
              if (inputArea) {
                const inputButtons = inputArea.querySelectorAll('button');
                if (inputButtons.length > 0) {
                  const sendButton = inputButtons[inputButtons.length - 1]; // Último botón del área de input
                  if (!sendButton.disabled) {
                    console.log('🔴 MÉTODO 4 - Encontrado botón en área de input, haciendo clic...');
                    sendButton.click();
                    sendButtonFound = true;
                  }
                }
              }
            }
            
            if (sendButtonFound) {
              console.log('✅ SECUENCIA COMPLETADA: A.E → Enviar');
            } else {
              console.log('❌ No se encontró botón Enviar con ningún método');
            }
          }, autoClickSettings.aeWaitTime); // Tiempo configurable para que se genere la respuesta
        }
      });
      
      if (!aeButtonFound) {
        console.log('❌ No se encontró botón A.E');
      }
      
    }, 8000); // Cada 8 segundos

    setAutoClickTimers({ ae: timer, send: null });
    setAutoClickEnabled(true);
    
    console.log("✅ Auto-Clic simplificado activado");
    
    /*
    const timer = setInterval(() => {
      console.log('⏰ Timer ejecutándose cada 4 segundos...');
      
      // Buscar todos los botones
      const allButtons = document.querySelectorAll('button');
      console.log(`🔍 Total botones encontrados: ${allButtons.length}`);
      
      // 1. BUSCAR Y HACER CLIC EN A.E
      let aeButtonFound = false;
      allButtons.forEach((btn, index) => {
        const buttonText = btn.textContent || '';
        console.log(`Botón ${index}: "${buttonText}"`);
        
        if (buttonText.includes('A.E')) {
          console.log('🎯 ENCONTRADO BOTÓN A.E - HACIENDO CLIC');
          aeButtonFound = true;
          btn.click();
          
          // 2. ESPERAR 2 SEGUNDOS Y BUSCAR ENVIAR
          setTimeout(() => {
            console.log('⏱️ Buscando botón Enviar...');
            const sendButtons = document.querySelectorAll('button');
            let sendButtonFound = false;
            
            sendButtons.forEach(sendBtn => {
              const sendText = sendBtn.textContent || '';
              if (sendText.includes('Enviar')) {
                console.log('📤 ENCONTRADO BOTÓN ENVIAR - HACIENDO CLIC');
                sendButtonFound = true;
                sendBtn.click();
              }
            });
            
            if (!sendButtonFound) {
              console.log('❌ No se encontró botón Enviar');
            }
          }, 2000);
        }
      });
      
      if (!aeButtonFound) {
        console.log('❌ No se encontró botón A.E');
      }
      
    }, autoClickSettings.sendWaitTime); // Intervalo configurable entre ciclos

    setAutoClickTimers({ ae: timer, send: null });
    setAutoClickEnabled(true);
    
    console.log("✅ Auto-Clic configurado y activado");
    */
  };

  // Función para detener auto-clics
  const stopAutoClicks = () => {
    console.log('🛑 DETENIENDO AUTO-CLICS');
    
    if (autoClickTimers.ae) {
      clearInterval(autoClickTimers.ae);
    }
    if (autoClickTimers.send) {
      clearInterval(autoClickTimers.send);
    }
    
    setAutoClickTimers({ ae: null, send: null });
    setAutoClickEnabled(false);
    
    // toast desactivado para evitar errores
    console.log("🛑 Auto-Clics Desactivados - Sistema manual reactivado");
  };

  // Función para configurar auto-click
  const configureAutoClick = () => {
    if (autoClickEnabled) {
      console.log('⏹️ Deteniendo auto-clic...');
      stopAutoClicks();
    } else {
      console.log('▶️ Iniciando auto-clic...');
      startAutoClicks();
    }
  };

  // Función para guardar configuración de auto-click
  const saveAutoClickSettings = (newSettings: typeof autoClickSettings) => {
    setAutoClickSettings(newSettings);
    setShowAutoClickConfig(false);
    
    // Si auto-click está activo, reiniciarlo con nueva configuración
    if (autoClickEnabled) {
      stopAutoClicks();
      setTimeout(() => startAutoClicks(), 500);
    }
  };

  // Estados para A.E AI (Agentes Externos)
  const [externalAgentActive, setExternalAgentActive] = useState(false);
  const [externalAgentProcessing, setExternalAgentProcessing] = useState(false);
  const [externalAgentUrl, setExternalAgentUrl] = useState<string>('');

  // Cargar estado del agente externo al seleccionar chat
  useEffect(() => {
    const loadAgentStatus = async () => {
      if (!selectedChat) return;
      
      try {
        const response = await fetch(`/api/whatsapp-accounts/${selectedChat.accountId}/agent-config`);
        const data = await response.json();
        
        if (data.success && data.config) {
          const isActive = data.config.autoResponseEnabled && data.config.assignedExternalAgentId;
          setExternalAgentActive(isActive);
          console.log(`📊 Estado A.E AI cargado: ${isActive ? 'ACTIVO' : 'INACTIVO'}`);
        }
      } catch (error) {
        console.error('Error cargando estado A.E AI:', error);
      }
    };

    loadAgentStatus();
  }, [selectedChat]);

  // Función para alternar A.E AI (Agentes Externos)
  const toggleExternalAgent = async () => {
    console.log('🚀 USUARIO PRESIONÓ BOTÓN A.E AI');
    
    if (!selectedChat) {
      console.log('❌ No hay chat seleccionado');
      toast({
        title: "Error",
        description: "Selecciona un chat primero",
        variant: "destructive"
      });
      return;
    }

    try {
      setExternalAgentProcessing(true);
      const newState = !externalAgentActive;
      
      console.log('📤 Enviando solicitud A.E AI:', {
        chatId: selectedChat.id,
        accountId: selectedChat.accountId,
        active: newState
      });
      
      const response = await fetch('/api/ae-ai/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chatId: selectedChat.id,
          accountId: selectedChat.accountId,
          active: newState
        })
      });
      
      console.log('📥 Respuesta del servidor:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Error HTTP:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }
      
      const result = await response.json();
      console.log('✅ Resultado procesado:', result);
      
      if (result.success) {
        setExternalAgentActive(result.active);
        setExternalAgentUrl(result.agentUrl || '');
        
        // Si se activó, abrir el enlace del agente externo
        if (result.active && result.agentUrl) {
          window.open(result.agentUrl, '_blank');
        }
        
        toast({
          title: `🤖 A.E AI ${result.active ? 'Activado' : 'Desactivado'}`,
          description: result.active 
            ? `Agente externo conectado para ${selectedChat.name}`
            : `Agente externo desconectado`,
        });
      } else {
        console.log('❌ Respuesta sin éxito:', result);
        toast({
          title: "Error",
          description: result.message || "No se pudo activar el agente externo",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('💥 ERROR CRÍTICO A.E AI:', error);
      toast({
        title: "Error de Conexión",
        description: "No se pudo conectar con el servidor. Verifica tu conexión.",
        variant: "destructive"
      });
      setExternalAgentActive(false);
      setExternalAgentUrl('');
    } finally {
      setExternalAgentProcessing(false);
    }
  };

  // Función para alternar R.A. AI
  const toggleRaAi = async () => {
    try {
      setRaAiProcessing(true);
      const newState = !raAiEnabled;
      
      const response = await fetch('/api/ra-ai/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: newState })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setRaAiEnabled(result.active);
        toast({
          title: `🤖 R.A. AI ${result.active ? 'Activado' : 'Desactivado'}`,
          description: result.message,
        });
      } else {
        toast({
          title: "Error",
          description: "No se pudo cambiar el estado de R.A. AI",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error toggle R.A. AI:', error);
      toast({
        title: "Error",
        description: "Error de conexión con R.A. AI",
        variant: "destructive"
      });
    } finally {
      setRaAiProcessing(false);
    }
  };

  // Función para procesar mensaje con R.A. AI
  const processWithRaAi = async () => {
    if (!selectedChat) {
      toast({
        title: "Error",
        description: "Selecciona un chat primero",
        variant: "destructive"
      });
      return;
    }

    try {
      setRaAiProcessing(true);
      
      const response = await fetch('/api/ra-ai/process-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chatId: selectedChat.id, 
          accountId: selectedChat.accountId 
        })
      });
      
      const result = await response.json();
      
      if (result.success && result.response) {
        if (result.sent) {
          toast({
            title: "🤖 R.A. AI Respondió",
            description: "Respuesta enviada automáticamente",
          });
        } else {
          // Mostrar la respuesta en el campo de texto para que el usuario pueda editarla
          setNewMessage(result.response);
          toast({
            title: "🤖 R.A. AI Generó Respuesta",
            description: "Puedes editarla antes de enviar",
          });
        }
      } else {
        toast({
          title: "R.A. AI",
          description: result.error || "No se pudo generar respuesta",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error procesando con R.A. AI:', error);
      toast({
        title: "Error",
        description: "Error al procesar con R.A. AI",
        variant: "destructive"
      });
    } finally {
      setRaAiProcessing(false);
    }
  };
  
  // Estados para respuestas automáticas a mensajes recibidos
  const [lastProcessedMessageId, setLastProcessedMessageId] = useState<string | null>(null);
  const [lastMessageCount, setLastMessageCount] = useState(0);



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

  // Función para manejar mensajes de audio con traducción
  const handleAudioMessageWithTranslation = async (audioMessage: any) => {
    if (!selectedChat) return;
    
    try {
      console.log('🎤 Procesando mensaje de audio...');
      
      // Verificar si el mensaje tiene URL de audio
      if (!audioMessage.mediaUrl && !audioMessage._data?.mediaUrl) {
        console.log('⚠️ Mensaje de audio sin URL disponible');
        return;
      }
      
      const audioUrl = audioMessage.mediaUrl || audioMessage._data?.mediaUrl;
      
      // Transcribir el audio usando OpenAI Whisper
      const transcriptionResponse = await fetch('/api/audio/transcribe-whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioUrl: audioUrl,
          chatId: selectedChat.id,
          accountId: selectedChat.accountId,
          messageId: audioMessage.id
        })
      });

      if (transcriptionResponse.ok) {
        const transcriptionData = await transcriptionResponse.json();
        console.log('✅ Audio transcrito exitosamente:', transcriptionData.transcription);
        
        // Mostrar la transcripción al usuario
        toast({
          title: "🎤 Audio transcrito",
          description: `Transcripción: "${transcriptionData.transcription}"`,
          duration: 5000
        });
        
        // Si SmartBots está habilitado, generar respuesta automática basada en la transcripción
        if (smartBotsEnabled) {
          console.log('🤖 Generando respuesta automática para audio transcrito...');
          
          setTimeout(async () => {
            try {
              // Auto response functionality removed
              console.log('Audio transcription completed - auto response disabled');
            } catch (error) {
              console.error('❌ Error generando respuesta para audio:', error);
            }
          }, 2000);
        }
        
      } else {
        const errorData = await transcriptionResponse.json();
        console.error('❌ Error transcribiendo audio:', errorData);
        
        toast({
          title: "❌ Error transcribiendo audio",
          description: errorData.error || "No se pudo transcribir el mensaje de audio",
          variant: "destructive"
        });
      }
      
    } catch (error) {
      console.error('❌ Error procesando mensaje de audio:', error);
      
      toast({
        title: "❌ Error procesando audio",
        description: "No se pudo procesar el mensaje de audio",
        variant: "destructive"
      });
    }
  };

  // Función para generar respuesta manual con SmartBots
  const generateSmartBotsResponse = async (userMessage: string, contactName: string, isIncomingMessage = false) => {
    try {
      console.log('🤖 Generando respuesta SmartBots para:', userMessage);
      console.log('🔍 Agente seleccionado:', selectedExternalAgent);
      
      // Usar agente específico si está seleccionado, o endpoint genérico si no
      const endpoint = selectedExternalAgent && selectedExternalAgent !== 'none'
        ? '/api/external-agents/chat'
        : '/api/smartbots/generate-response';
      
      const requestBody = selectedExternalAgent && selectedExternalAgent !== 'none' 
        ? {
            agentId: selectedExternalAgent,
            message: userMessage,
            context: `Conversación de WhatsApp con ${contactName}`
          }
        : {
            message: userMessage,
            contactName: contactName,
            context: `Conversación de WhatsApp con ${contactName}`
          };

      console.log('🔗 Usando endpoint:', endpoint);
      console.log('📦 Datos enviados:', requestBody);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
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

  // Fetch custom categories
  const { data: categories = [] } = useQuery({
    queryKey: ['/api/chat-categories'],
    enabled: true
  });

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: (categoryData: any) => 
      fetch('/api/chat-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(categoryData)
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat-categories'] });
      setShowCreateCategoryDialog(false);
      setNewCategoryData({ name: '', description: '', color: '#3B82F6', icon: 'MessageCircle' });
    }
  });

  // Assign category mutation
  const assignCategoryMutation = useMutation({
    mutationFn: ({ chatId, accountId, categoryId }: { chatId: string; accountId: number; categoryId: number }) =>
      fetch('/api/chat-categories/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, accountId, categoryId })
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat-categories'] });
      setCategoryLoadingChat(null);
    }
  });

  // Fetch WhatsApp accounts
  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ['/api/whatsapp/accounts'],
    refetchInterval: 5000 // Refresh every 5 seconds to check status
  });

  // Fetch external agents for AI selection
  const { data: externalAgentsResponse } = useQuery({
    queryKey: ['/api/external-agents'],
    enabled: smartBotsEnabled,
    retry: false,
    staleTime: 60000
  });

  const externalAgents = (externalAgentsResponse as any)?.agents || [];

  // Debug logs for AI selector
  console.log('🔍 Debug AI Selector:', {
    smartBotsEnabled,
    externalAgentsResponse,
    externalAgents,
    agentsCount: externalAgents.length
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
  // Función para identificar el último mensaje recibido (no enviado por nosotros)
  const getLastIncomingMessageId = (messages: WhatsAppMessage[]): string | null => {
    if (!messages || messages.length === 0) return null;
    
    // Buscar el último mensaje que NO fue enviado por nosotros (fromMe: false)
    for (let i = messages.length - 1; i >= 0; i--) {
      if (!messages[i].fromMe) {
        return messages[i].id;
      }
    }
    return null;
  };

  const handleChatSelect = async (chat: WhatsAppChat) => {
    setSelectedChat(chat);
    setNewMessage(''); // Clear input when switching chats
    
    // Cargar estado del agente externo A.E AI para el chat seleccionado
    try {
      const response = await fetch(`/api/external-agents/status/${encodeURIComponent(chat.id)}/${chat.accountId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setExternalAgentActive(data.active || false);
        setExternalAgentUrl(data.agentUrl || '');
      } else {
        setExternalAgentActive(false);
        setExternalAgentUrl('');
      }
    } catch (error) {
      console.error('Error cargando estado A.E AI:', error);
      setExternalAgentActive(false);
      setExternalAgentUrl('');
    }
    
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

  // Estados para traducción mejorada
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [languageSelectorOpen, setLanguageSelectorOpen] = useState(false);
  
  // Estados para grabación de notas de voz
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  // Idiomas disponibles para traducción
  const availableLanguages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
    { code: 'pt', name: 'Português', flag: '🇵🇹' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' },
    { code: 'zh', name: '中文', flag: '🇨🇳' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: '한국어', flag: '🇰🇷' }
  ];

  // Función para traducir texto usando OpenAI
  const translateMessage = async (text: string, targetLanguage: string) => {
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          targetLanguage: targetLanguage,
          sourceLanguage: 'auto'
        }),
      });

      if (response.ok) {
        const result = await response.json();
        return result.translatedText;
      }
      throw new Error('Translation failed');
    } catch (error) {
      console.warn('Traducción fallida, usando texto original:', error);
      return text;
    }
  };

  // Funciones para grabación de voz
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setAudioChunks(prev => [...prev, event.data]);
        }
      };
      
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
      };
      
      setMediaRecorder(recorder);
      setIsRecording(true);
      setAudioChunks([]);
      recorder.start();
      
      toast({
        title: "🎤 Grabando nota de voz",
        description: "Haz clic en el botón otra vez para detener la grabación",
      });
    } catch (error) {
      console.error('Error al acceder al micrófono:', error);
      toast({
        title: "Error al acceder al micrófono",
        description: "Verifica que hayas dado permisos para usar el micrófono",
        variant: "destructive"
      });
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        
        // Crear FormData para enviar el archivo de audio
        const formData = new FormData();
        formData.append('audio', audioBlob, 'voice_note.wav');
        formData.append('chatId', selectedChat?.id || '');
        formData.append('accountId', selectedChat?.accountId.toString() || '');
        
        try {
          const response = await fetch('/api/whatsapp/send-voice-note', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            },
            body: formData
          });
          
          if (response.ok) {
            toast({
              title: "✅ Nota de voz enviada",
              description: "Tu nota de voz se ha enviado correctamente",
            });
            
            // Actualizar mensajes del chat
            queryClient.invalidateQueries({
              queryKey: ['/api/whatsapp-accounts', selectedChat?.accountId, 'chats', selectedChat?.id, 'messages']
            });
          } else {
            throw new Error('Error al enviar nota de voz');
          }
        } catch (error) {
          console.error('Error enviando nota de voz:', error);
          toast({
            title: "Error al enviar nota de voz",
            description: "No se pudo enviar la nota de voz. Inténtalo de nuevo.",
            variant: "destructive"
          });
        }
        
        setAudioChunks([]);
      };
      
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };



  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Detectar mensajes nuevos y activar SmartBots automáticamente
  useEffect(() => {
    console.log('🔍 Estado SmartBots:', {
      messages: !!messages,
      smartBotsEnabled,
      selectedChat: !!selectedChat,
      messagesLength: Array.isArray(messages) ? messages.length : 0
    });
    
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
        
        // Verificar si es un mensaje de audio
        if (lastIncomingMessage.type === 'ptt' || lastIncomingMessage.type === 'audio') {
          console.log('🎤 Mensaje de audio detectado:', lastIncomingMessage);
          handleAudioMessage(lastIncomingMessage);
        } else {
          console.log('🤖 Mensaje entrante detectado:', lastIncomingMessage.body);
        }
        
        // Solo procesar si no hemos procesado este mensaje antes
        if (lastIncomingMessage.id !== lastProcessedMessageId) {
          console.log('🔄 Procesando nuevo mensaje ID:', lastIncomingMessage.id);
          
          // Reordenar chats para mostrar este chat al principio
          handleNewMessageReceived(selectedChat.id);
          
          // Generar y enviar respuesta automática para el mensaje entrante
          setTimeout(async () => {
            try {
              console.log('🤖 Generando respuesta automática directa con OpenAI...');
              
              // Importar las funciones directas
              const { generateExternalAgentResponse } = await import('@/lib/directAutoResponse');
              
              // Generar respuesta automática usando agente externo REAL
              // Necesitamos obtener el ID del agente externo asignado
              const configResponse = await fetch(`/api/whatsapp-accounts/${selectedChat.accountId}/agent-config`);
              const configData = await configResponse.json();
              
              if (configData.success && configData.config?.assignedExternalAgentId) {
                let autoResponse = await generateExternalAgentResponse(lastIncomingMessage.body, configData.config.assignedExternalAgentId);
              } else {
                console.log('❌ No hay agente externo asignado para respuesta automática');
                return;
              }
              
              // Si la traducción está habilitada, traducir la respuesta
              if (autoResponse && translationEnabled && selectedLanguage !== 'es') {
                console.log(`🌐 Traduciendo respuesta automática al ${selectedLanguage}...`);
                autoResponse = await translateMessage(autoResponse, selectedLanguage);
              }
              
              if (autoResponse) {
                console.log('📤 Enviando respuesta automática:', autoResponse);
                await sendAutoMessage(autoResponse);
                
                // Notificación indicando si fue traducida
                toast({
                  title: "🤖 Respuesta automática enviada",
                  description: translationEnabled ? `Traducida al ${selectedLanguage.toUpperCase()}` : "SmartBots respondió automáticamente al último mensaje recibido",
                  duration: 3000
                });
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





  // Función para manejar mensajes de audio (transcripción)
  const handleAudioMessage = async (message: any) => {
    try {
      toast({
        title: "🎧 Procesando audio...",
        description: "Transcribiendo mensaje de voz...",
      });

      const response = await fetch('/api/audio/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId: message.id,
          audioUrl: message.mediaUrl || message._data?.mediaUrl
        }),
      });

      if (response.ok) {
        const result = await response.json();
        toast({
          title: "✅ Audio transcrito",
          description: `Transcripción: "${result.text}"`,
          duration: 5000
        });
      } else {
        throw new Error('Error en la transcripción');
      }
    } catch (error) {
      console.error('Error transcribiendo audio:', error);
      toast({
        title: "Error",
        description: "No se pudo transcribir el audio",
        variant: "destructive"
      });
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;
    
    let finalMessage = newMessage.trim();
    
    // Si el traductor está activado, traducir el mensaje antes de enviarlo
    if (translationEnabled) {
      try {
        console.log('🌐 Traduciendo mensaje al:', selectedLanguage);
        
        // Usar el idioma seleccionado del dropdown
        const sourceLanguage = 'auto'; // Detección automática
        const targetLanguage = selectedLanguage;
        
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
    // WhatsApp envía timestamps en segundos Unix, convertir a milisegundos para JavaScript
    return new Date(timestamp * 1000).toLocaleTimeString('es-ES', { 
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
    return Array.isArray(accounts) ? accounts.find(acc => acc.id === selectedChat?.accountId) : null;
  };

  // Sort chats by activity: unread messages first, then by most recent timestamp
  const sortedChats = useMemo(() => {
    if (!Array.isArray(chats)) return [];
    
    return [...chats].sort((a, b) => {
      // Priority 1: Chats with unread messages first
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
      
      // Priority 2: Currently selected chat should stay visible but not necessarily at top
      // Priority 3: Most recent activity (highest timestamp first)
      const timestampA = a.timestamp || 0;
      const timestampB = b.timestamp || 0;
      return timestampB - timestampA;
    });
  }, [chats]);

  // Function to reorder chats when new message arrives
  const handleNewMessageReceived = useCallback((chatId: string) => {
    // Force chat list refresh to reorder by latest activity
    queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
    
    // Also refresh the chat list for specific accounts to ensure real-time updates
    if (selectedAccounts.length > 0) {
      selectedAccounts.forEach(accountId => {
        queryClient.invalidateQueries({ queryKey: [`/api/whatsapp-accounts/${accountId}/chats`] });
      });
    }
  }, [queryClient, selectedAccounts]);

  // Enhanced filtering logic for your category system
  const filteredChats = useMemo(() => {
    let filtered = sortedChats;
    
    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(chat => 
        chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Filter by chat type (Individual/Groups)
    if (chatTypeFilter === 'individual') {
      filtered = filtered.filter(chat => !chat.isGroup);
    } else if (chatTypeFilter === 'groups') {
      filtered = filtered.filter(chat => chat.isGroup);
    }
    
    // Filter by selected category
    if (selectedCategory) {
      // This would need to be implemented based on your category assignment data
      // For now, return all chats
    }
    
    return filtered;
  }, [sortedChats, searchQuery, chatTypeFilter, selectedCategory]);

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
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-red-600 via-black to-red-600 pt-[0px] pb-[0px] text-[14px] mt-[6px] mb-[6px] ml-[0px] mr-[0px] pl-[6px] pr-[6px]">
          <div className="space-y-3">
            <div className="flex items-center justify-center">
              <h2 className="text-lg font-semibold text-white">WhatsApp Business</h2>
            </div>
          </div>
        </div>

        {/* Category and Type Filter */}
        <div className="border-b border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700">Filtros</h3>
            
            {/* Botón para crear nueva categoría */}
            <Button 
              size="sm" 
              variant="outline" 
              className="text-blue-600 border-blue-600 hover:bg-blue-50"
              onClick={() => setShowCreateCategoryDialog(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Nueva Categoría
            </Button>
          </div>

          {/* Filtro por tipo de chat */}
          <div className="mb-3">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={chatTypeFilter === 'all' ? "default" : "outline"}
                onClick={() => setChatTypeFilter('all')}
                className="flex items-center space-x-1"
              >
                <MessageCircle className="h-3 w-3" />
                <span>Todos</span>
              </Button>
              <Button
                size="sm"
                variant={chatTypeFilter === 'individual' ? "default" : "outline"}
                onClick={() => setChatTypeFilter('individual')}
                className="flex items-center space-x-1"
              >
                <User className="h-3 w-3" />
                <span>Individual</span>
              </Button>
              <Button
                size="sm"
                variant={chatTypeFilter === 'groups' ? "default" : "outline"}
                onClick={() => setChatTypeFilter('groups')}
                className="flex items-center space-x-1"
              >
                <Users className="h-3 w-3" />
                <span>Grupos</span>
              </Button>
            </div>
          </div>

          {/* Lista de categorías personalizadas */}
          <div className="flex flex-wrap gap-2">
            {/* Opción "Todas las categorías" */}
            <Button
              size="sm"
              variant={selectedCategory === null ? "default" : "outline"}
              onClick={() => setSelectedCategory(null)}
              className="flex items-center space-x-1"
            >
              <Filter className="h-3 w-3" />
              <span>Todas</span>
            </Button>

            {/* Categorías personalizadas */}
            {Array.isArray(categories) && categories.map((category: any) => (
              <Button
                key={category.id}
                size="sm"
                variant={selectedCategory === category.id ? "default" : "outline"}
                onClick={() => setSelectedCategory(category.id)}
                className="flex items-center space-x-1"
                style={{ 
                  backgroundColor: selectedCategory === category.id ? category.color : 'transparent',
                  borderColor: category.color 
                }}
              >
                <Tag className="h-3 w-3" />
                <span>{category.name}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <Input
            placeholder="Buscar chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Chat List */}
        <ScrollArea className="flex-1">
          <div className="space-y-1">
            {filteredChats.map((chat) => (
              <ChatListItem 
                key={chat.id} 
                chat={chat} 
                isSelected={selectedChat?.id === chat.id}
                onClick={() => setSelectedChat(chat)}
                categories={Array.isArray(categories) ? categories : []}
                onCategoryChange={(categoryId) => {
                  setCategoryLoadingChat(chat.id);
                  assignCategoryMutation.mutate({
                    chatId: chat.id,
                    accountId: chat.accountId,
                    categoryId
                  });
                }}
                categoryLoading={categoryLoadingChat === chat.id}
              />
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel - Chat Interface */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <ChatInterface chat={selectedChat} />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Selecciona un chat</h3>
              <p className="text-gray-500">Elige una conversación para comenzar</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Category Dialog */}
      <Dialog open={showCreateCategoryDialog} onOpenChange={setShowCreateCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nueva Categoría</DialogTitle>
            <DialogDescription>
              Crea una categoría personalizada para organizar tus chats
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <Input
                value={newCategoryData.name}
                onChange={(e) => setNewCategoryData({ ...newCategoryData, name: e.target.value })}
                placeholder="Nombre de la categoría"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Descripción</label>
              <Input
                value={newCategoryData.description}
                onChange={(e) => setNewCategoryData({ ...newCategoryData, description: e.target.value })}
                placeholder="Descripción opcional"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Color</label>
              <div className="flex gap-2 mt-2">
                {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'].map((color) => (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded-full border-2 ${
                      newCategoryData.color === color ? 'border-gray-800' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewCategoryData({ ...newCategoryData, color })}
                  />
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateCategoryDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => createCategoryMutation.mutate(newCategoryData)}
              disabled={!newCategoryData.name || createCategoryMutation.isPending}
            >
              {createCategoryMutation.isPending ? 'Creando...' : 'Crear Categoría'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ChatListItem component with category management
function ChatListItem({ 
  chat, 
  isSelected, 
  onClick, 
  categories, 
  onCategoryChange, 
  categoryLoading 
}: {
  chat: any;
  isSelected: boolean;
  onClick: () => void;
  categories: any[];
  onCategoryChange: (categoryId: number) => void;
  categoryLoading: boolean;
}) {
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);

  return (
    <div 
      className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 relative ${
        isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center mb-1">
            <div className="flex items-center space-x-2">
              {chat.isGroup ? <Users className="h-4 w-4 text-gray-500" /> : <User className="h-4 w-4 text-gray-500" />}
              <span className="font-medium text-gray-900 truncate">{chat.name}</span>
            </div>
          </div>
          
          <p className="text-sm text-gray-600 truncate">{chat.lastMessage}</p>
          
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">
              {new Date(chat.timestamp).toLocaleTimeString('es-ES', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
            
            {chat.unreadCount > 0 && (
              <Badge variant="default" className="bg-green-500">
                {chat.unreadCount}
              </Badge>
            )}
          </div>
        </div>
        
        {/* Category Management Button */}
        <Popover open={showCategoryMenu} onOpenChange={setShowCategoryMenu}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 ml-2"
              onClick={(e) => {
                e.stopPropagation();
                setShowCategoryMenu(true);
              }}
            >
              {categoryLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Tag className="h-3 w-3" />
              )}
            </Button>
          </PopoverTrigger>
          
          <PopoverContent className="w-48 p-2" align="end">
            <div className="space-y-1">
              <div className="text-xs font-medium text-gray-500 px-2 py-1">
                Asignar categoría
              </div>
              
              {categories.map((category: any) => (
                <Button
                  key={category.id}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-auto p-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCategoryChange(category.id);
                    setShowCategoryMenu(false);
                  }}
                >
                  <div 
                    className="w-3 h-3 rounded-full mr-2" 
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="text-sm">{category.name}</span>
                </Button>
              ))}
              
              {categories.length === 0 && (
                <div className="text-xs text-gray-500 px-2 py-1">
                  No hay categorías disponibles
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

// Simple Chat Interface component
function ChatInterface({ chat }: { chat: any }) {
  return (
    <div className="flex-1 flex flex-col">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-3">
          {chat.isGroup ? <Users className="h-5 w-5 text-gray-500" /> : <User className="h-5 w-5 text-gray-500" />}
          <div>
            <h2 className="font-medium text-gray-900">{chat.name}</h2>
            <p className="text-sm text-gray-500">
              {chat.isGroup ? 'Grupo' : 'Chat individual'}
            </p>
          </div>
        </div>
      </div>
      
      {/* Messages Area */}
      <div className="flex-1 bg-gray-50 p-4">
        <div className="text-center text-gray-500">
          <MessageCircle className="h-8 w-8 mx-auto mb-2" />
          <p>Conversación con {chat.name}</p>
        </div>
      </div>
      
      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-200">
        <div className="flex items-center space-x-2">
          <Input 
            placeholder="Escribe un mensaje..." 
            className="flex-1"
          />
          <Button size="sm">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
