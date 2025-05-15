import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { GeminiAssistant } from './GeminiAssistant';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';

// Interfaz para los chats de WhatsApp
interface WhatsAppChat {
  id: string;
  name: string;
  isGroup: boolean;
  timestamp: number;
  unreadCount: number;
  lastMessage?: string;
  profilePicUrl?: string;
  participants?: string[];
  numericId?: number; // ID numérico temporal para compatibilidad
}

// Interfaz para los mensajes de WhatsApp
interface WhatsAppMessage {
  id: string;
  body: string;
  from: string;
  to: string;
  fromMe: boolean;
  timestamp: number;
  hasMedia: boolean;
  type: string;
  isStatus: boolean;
  isForwarded: boolean;
  isStarred: boolean;
  mediaUrl?: string;
  caption?: string;
  containsEmoji: boolean;
}

// Interfaz para leads del CRM
interface Lead {
  id: number;
  fullName: string;
  email: string;
  phone?: string;
  company?: string;
  lastActive?: string;
  avatar?: string;
  status: string;
}

// Interfaz para mensajes del CRM
interface Message {
  id: number;
  leadId: number;
  content: string;
  direction: 'incoming' | 'outgoing';
  timestamp: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  channel: 'whatsapp' | 'telegram' | 'email' | 'sms';
  attachment?: string;
  aiGenerated?: boolean;
}

import {
  Search,
  Send,
  Paperclip,
  User,
  Phone,
  Video,
  MoreVertical,
  Smile,
  Mic,
  Image,
  ChevronDown,
  ChevronRight,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  RefreshCw,
  BrainCircuit
} from 'lucide-react';

interface WhatsAppInterfaceProps {
  selectedLeadId?: number;
  onSelectLead?: (leadId: number) => void;
}

export function WhatsAppInterface({ selectedLeadId, onSelectLead }: WhatsAppInterfaceProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [messageText, setMessageText] = useState('');
  const [activeTab, setActiveTab] = useState('chats');
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [selectedLeadData, setSelectedLeadData] = useState<Lead | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Consulta para obtener estado de WhatsApp (usando endpoint directo)
  const { data: whatsappStatus, isLoading: isLoadingWhatsappStatus } = useQuery({
    queryKey: ['whatsapp-status-direct'],
    queryFn: async () => {
      try {
        // Usar directamente fetch para evitar interceptación
        const timestamp = Date.now();
        const response = await fetch(`/api/direct/whatsapp/status?t=${timestamp}`, {
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Estado WhatsApp recibido (endpoint directo):', data);
        return data;
      } catch (error) {
        console.error('Error obteniendo estado de WhatsApp:', error);
        return {
          initialized: false,
          ready: false,
          authenticated: false,
          error: 'Error de conexión'
        };
      }
    },
    refetchInterval: 5000 // Refrescar cada 5 segundos
  });
  
  // Consulta para obtener chats de WhatsApp reales
  const { data: whatsappChats = [], isLoading: isLoadingChats } = useQuery({
    queryKey: ['whatsapp-chats-direct'],
    queryFn: async () => {
      try {
        const timestamp = Date.now();
        const response = await fetch(`/api/direct/whatsapp/chats?t=${timestamp}`, {
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Chats de WhatsApp recibidos:', data);
        
        // Convertir chat IDs en leadIds para compatibilidad
        if (Array.isArray(data)) {
          data.forEach((chat, index) => {
            // Usar el índice + 1 como ID numérico temporal
            chat.numericId = index + 1;
          });
        }
        
        return data;
      } catch (error) {
        console.error('Error obteniendo chats de WhatsApp:', error);
        return [];
      }
    },
    enabled: whatsappStatus?.authenticated === true,
    refetchInterval: whatsappStatus?.authenticated ? 10000 : false, // Refrescar cada 10 segundos si está autenticado
  });
  
  // Consulta para obtener mensajes de un chat específico
  const {
    data: whatsappMessages = [],
    isLoading: isLoadingWhatsappMessages
  } = useQuery({
    queryKey: ['whatsapp-messages-direct', selectedChatId],
    queryFn: async () => {
      if (!selectedChatId) return [];
      
      try {
        const timestamp = Date.now();
        const response = await fetch(`/api/direct/whatsapp/messages/${selectedChatId}?t=${timestamp}&limit=50`, {
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`Mensajes de WhatsApp para ${selectedChatId} recibidos:`, data);
        return data;
      } catch (error) {
        console.error(`Error obteniendo mensajes de WhatsApp para ${selectedChatId}:`, error);
        return [];
      }
    },
    enabled: !!selectedChatId && whatsappStatus?.authenticated === true,
    refetchInterval: selectedChatId && whatsappStatus?.authenticated ? 5000 : false,
  });
  
  // Consulta para obtener leads (contactos)
  const { data: leads = [], isLoading: isLoadingLeads } = useQuery({
    queryKey: ['/api/leads'],
    queryFn: async () => {
      return await apiRequest('/api/leads');
    },
  });

  // Filtrar leads según término de búsqueda
  const filteredLeads = leads.filter((lead: Lead) => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      lead.fullName?.toLowerCase().includes(searchLower) ||
      lead.email?.toLowerCase().includes(searchLower) ||
      lead.company?.toLowerCase().includes(searchLower) ||
      lead.phone?.includes(searchTerm)
    );
  });

  // Filtrar chats según término de búsqueda
  const filteredChats = Array.isArray(whatsappChats) 
    ? whatsappChats.filter((chat: WhatsAppChat) => {
        if (!searchTerm) return true;
        
        const searchLower = searchTerm.toLowerCase();
        return (
          chat.name?.toLowerCase().includes(searchLower) ||
          chat.lastMessage?.toLowerCase().includes(searchLower)
        );
      })
    : [];

  // Consulta para obtener mensajes del lead seleccionado (modo fallback)
  const { 
    data: messages = [], 
    isLoading: isLoadingMessages 
  } = useQuery({
    queryKey: ['/api/messages', { leadId: selectedLeadId }],
    queryFn: async () => {
      return await apiRequest(
        selectedLeadId ? `/api/messages?leadId=${selectedLeadId}` : '/api/messages/recent'
      );
    },
    enabled: activeTab === 'chats' && !whatsappStatus?.authenticated,
  });

  // Consulta para obtener detalles del lead seleccionado
  const { 
    data: leadDetails,
    isLoading: isLoadingLeadDetails 
  } = useQuery({
    queryKey: ['/api/leads', selectedLeadId],
    queryFn: async () => {
      return await apiRequest(`/api/leads/${selectedLeadId}`);
    },
    enabled: !!selectedLeadId && !whatsappStatus?.authenticated
  });
  
  // Usar useEffect para establecer selectedLeadData cuando cambie leadDetails
  React.useEffect(() => {
    if (leadDetails) {
      setSelectedLeadData(leadDetails);
    }
  }, [leadDetails]);

  // Mutación para enviar un mensaje
  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: { content: string }) => {
      // Si WhatsApp está autenticado y hay un chat seleccionado, enviar por WhatsApp directo
      if (whatsappStatus?.authenticated && selectedChatId) {
        const timestamp = Date.now();
        const response = await fetch(`/api/direct/whatsapp/send-message?t=${timestamp}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            to: selectedChatId,
            message: messageData.content
          })
        });
        
        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }
        
        return response.json();
      } else {
        // Modo fallback para CRM tradicional
        return await fetch('/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            leadId: selectedLeadId,
            content: messageData.content,
            direction: 'outgoing',
            channel: 'whatsapp'
          })
        }).then(response => {
          if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
          }
          return response.json();
        });
      }
    },
    onSuccess: () => {
      setMessageText('');
      toast({
        title: "Mensaje enviado",
        description: "El mensaje ha sido enviado correctamente."
      });
      
      if (whatsappStatus?.authenticated && selectedChatId) {
        queryClient.invalidateQueries({ queryKey: ['whatsapp-messages-direct', selectedChatId] });
      } else if (selectedLeadId) {
        queryClient.invalidateQueries({ queryKey: ['/api/messages', { leadId: selectedLeadId }] });
      }
    }
  });

  // Verificar estado de integración con WhatsApp (endpoint estándar como respaldo)
  const { 
    data: whatsappStatusAPI, 
    isLoading: isLoadingWhatsappStatusAPI 
  } = useQuery({
    queryKey: ['/api/integrations/whatsapp/status'],
    queryFn: async () => {
      return await apiRequest('/api/integrations/whatsapp/status');
    },
    refetchInterval: 10000, // Verificar cada 10 segundos
  });

  // Reiniciar WhatsApp
  const restartWhatsAppMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/integrations/whatsapp/restart', {
        method: 'POST'
      });
    },
    onSuccess: () => {
      toast({
        title: "WhatsApp reiniciado",
        description: "Se ha reiniciado la conexión con WhatsApp. Por favor, escanee el nuevo código QR."
      });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-status-direct'] });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/whatsapp/status'] });
    }
  });

  // Manejar envío de mensaje
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!messageText.trim()) return;
    
    sendMessageMutation.mutate({
      content: messageText
    });
  };

  // Manejar click en chat de WhatsApp
  const handleChatSelect = (chat: WhatsAppChat) => {
    setSelectedChatId(chat.id);
    if (onSelectLead && chat.numericId) {
      onSelectLead(chat.numericId);
    }
  };
  
  // Manejar click en lead (modo tradicional)
  const handleLeadSelect = (leadId: number) => {
    if (onSelectLead) {
      onSelectLead(leadId);
    }
  };

  // Obtener iniciales para avatar
  const getInitials = (name: string | undefined) => {
    if (!name) return 'UN'; // Unknown/Usuario No identificado
    
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Renderizar el estado del mensaje
  const renderMessageStatus = (status: string, timestamp: string) => {
    const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    switch (status) {
      case 'sent':
        return (
          <div className="flex items-center text-xs text-gray-400 gap-1">
            <Check size={14} />
            <span>{time}</span>
          </div>
        );
      case 'delivered':
        return (
          <div className="flex items-center text-xs text-gray-400 gap-1">
            <CheckCheck size={14} />
            <span>{time}</span>
          </div>
        );
      case 'read':
        return (
          <div className="flex items-center text-xs text-green-500 gap-1">
            <CheckCheck size={14} />
            <span>{time}</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center text-xs text-red-500 gap-1">
            <AlertCircle size={14} />
            <span>{time}</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center text-xs text-gray-400 gap-1">
            <Clock size={14} />
            <span>{time}</span>
          </div>
        );
    }
  };

  // Hacer scroll a la última mensaje cuando se cargan o envían mensajes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [whatsappMessages, messages]);
  
  // Mostrar el QR de WhatsApp y pantalla de configuración si no está autenticado y tenemos el estado
  if (whatsappStatus && whatsappStatus.initialized && !whatsappStatus.authenticated) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="mb-6 p-3 bg-green-100 rounded-full">
          <div className="w-16 h-16 flex items-center justify-center">
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/767px-WhatsApp.svg.png" 
              alt="WhatsApp Logo"
              className="w-full h-full"
            />
          </div>
        </div>
        
        <h3 className="text-xl font-semibold mb-2">Conectar WhatsApp</h3>
        <p className="text-sm text-gray-600 mb-6 text-center">
          Para usar WhatsApp en tu CRM, escanea el código QR con tu teléfono
        </p>
        
        {whatsappStatus?.initialized && !whatsappStatus?.authenticated && whatsappStatus?.qrDataUrl ? (
          <div className="border p-4 rounded-lg mb-6">
            <img 
              src={whatsappStatus.qrDataUrl}
              alt="QR Code para WhatsApp"
              className="w-64 h-64"
            />
          </div>
        ) : (
          <div className="border p-8 rounded-lg mb-6 flex items-center justify-center">
            <Spinner size="lg" />
          </div>
        )}
        
        <ol className="text-sm text-gray-600 space-y-2 mb-6">
          <li className="flex items-start gap-2">
            <span className="font-medium">1.</span>
            <span>Abre WhatsApp en tu teléfono</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-medium">2.</span>
            <span>Toca en <strong>Menu</strong> o <strong>Configuración</strong> y selecciona <strong>Dispositivos vinculados</strong></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-medium">3.</span>
            <span>Toca en <strong>Vincular un dispositivo</strong></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-medium">4.</span>
            <span>Apunta tu teléfono hacia esta pantalla para escanear el código QR</span>
          </li>
        </ol>
        
        <Button
          variant="outline"
          className="w-full"
          onClick={() => restartWhatsAppMutation.mutate()}
          disabled={restartWhatsAppMutation.isPending}
        >
          {restartWhatsAppMutation.isPending ? (
            <Spinner size="sm" className="mr-2" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Generar nuevo QR
        </Button>
      </div>
    );
  }

  // Modo WhatsApp autenticado o modo fallback
  return (
    <div className="bg-white rounded-lg shadow-sm border h-[calc(100vh-12rem)] flex overflow-hidden">
      {/* Panel de chats/contactos */}
      <div className="w-1/3 border-r flex flex-col">
        <div className="border-b p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 h-4 w-4" />
            <Input
              placeholder="Buscar o iniciar nuevo chat"
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col"
        >
          <TabsList className="px-2 pt-2 justify-start border-b rounded-none gap-1">
            <TabsTrigger value="chats" className="flex-1">Chats</TabsTrigger>
            <TabsTrigger value="contacts" className="flex-1">Contactos</TabsTrigger>
          </TabsList>
          
          <TabsContent value="chats" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              {whatsappStatus?.authenticated ? (
                // Modo WhatsApp autenticado - Mostrar chats reales de WhatsApp
                isLoadingChats ? (
                  <div className="flex justify-center p-4">
                    <Spinner />
                  </div>
                ) : filteredChats.length > 0 ? (
                  <div className="space-y-0.5">
                    {filteredChats.map((chat: WhatsAppChat) => (
                      <div
                        key={chat.id}
                        className={`p-3 hover:bg-gray-100 cursor-pointer flex items-start gap-3 ${
                          selectedChatId === chat.id ? 'bg-gray-100' : ''
                        }`}
                        onClick={() => handleChatSelect(chat)}
                      >
                        <Avatar className="h-12 w-12">
                          {chat.profilePicUrl ? (
                            <AvatarImage src={chat.profilePicUrl} alt={chat.name} />
                          ) : null}
                          <AvatarFallback className="bg-green-500 text-white">
                            {getInitials(chat.name)}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between">
                            <div className="font-medium text-sm truncate">{chat.name}</div>
                            <div className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(chat.timestamp), { 
                                addSuffix: true,
                                locale: es
                              })}
                            </div>
                          </div>
                          
                          <div className="text-xs text-gray-500 truncate mt-1">{chat.lastMessage}</div>
                          
                          <div className="flex mt-1 gap-1">
                            {chat.unreadCount > 0 && (
                              <Badge variant="default" className="rounded-full bg-green-500 text-[10px] h-5 min-w-5 flex items-center justify-center px-1.5">
                                {chat.unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No hay chats disponibles
                  </div>
                )
              ) : (
                // Modo fallback para leads del CRM
                isLoadingLeads ? (
                  <div className="flex justify-center p-4">
                    <Spinner />
                  </div>
                ) : filteredLeads.length > 0 ? (
                  <div className="space-y-0.5">
                    {filteredLeads.map((lead: Lead) => (
                      <div
                        key={lead.id}
                        className={`p-3 hover:bg-gray-100 cursor-pointer flex items-start gap-3 ${
                          selectedLeadId === lead.id ? 'bg-gray-100' : ''
                        }`}
                        onClick={() => handleLeadSelect(lead.id)}
                      >
                        <Avatar className="h-12 w-12">
                          {lead.avatar ? (
                            <AvatarImage src={lead.avatar} alt={lead.fullName} />
                          ) : null}
                          <AvatarFallback className="bg-green-500 text-white">
                            {getInitials(lead.fullName)}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between">
                            <div className="font-medium text-sm truncate">{lead.fullName}</div>
                            <div className="text-xs text-gray-500">
                              {lead.lastActive ? formatDistanceToNow(new Date(lead.lastActive), { 
                                addSuffix: true,
                                locale: es
                              }) : 'Nunca'}
                            </div>
                          </div>
                          
                          <div className="text-xs text-gray-500 truncate mt-1">{lead.phone || lead.email}</div>
                          
                          <div className="flex mt-1 gap-1">
                            {lead.status === 'prospect' && <Badge variant="outline" className="rounded-full text-[10px] border-yellow-500 text-yellow-700">Prospecto</Badge>}
                            {lead.status === 'qualified' && <Badge variant="outline" className="rounded-full text-[10px] border-blue-500 text-blue-700">Calificado</Badge>}
                            {lead.status === 'customer' && <Badge variant="outline" className="rounded-full text-[10px] border-green-500 text-green-700">Cliente</Badge>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No hay contactos disponibles
                  </div>
                )
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="contacts" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              {isLoadingLeads ? (
                <div className="flex justify-center p-4">
                  <Spinner />
                </div>
              ) : filteredLeads.length > 0 ? (
                <div className="space-y-0.5">
                  {filteredLeads.map((lead: Lead) => (
                    <div
                      key={lead.id}
                      className={`p-3 hover:bg-gray-100 cursor-pointer flex items-start gap-3 ${
                        selectedLeadId === lead.id ? 'bg-gray-100' : ''
                      }`}
                      onClick={() => handleLeadSelect(lead.id)}
                    >
                      <Avatar className="h-12 w-12">
                        {lead.avatar ? (
                          <AvatarImage src={lead.avatar} alt={lead.fullName} />
                        ) : null}
                        <AvatarFallback className="bg-blue-500 text-white">
                          {getInitials(lead.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between">
                          <div className="font-medium text-sm truncate">{lead.fullName}</div>
                          <div className="text-xs text-gray-500">
                            {lead.lastActive ? formatDistanceToNow(new Date(lead.lastActive), { 
                              addSuffix: true,
                              locale: es
                            }) : 'Nunca'}
                          </div>
                        </div>
                        
                        <div className="text-xs text-gray-500 truncate mt-1">{lead.company || lead.email}</div>
                        
                        <div className="flex mt-1 gap-1">
                          {lead.status === 'prospect' && <Badge variant="outline" className="rounded-full text-[10px] border-yellow-500 text-yellow-700">Prospecto</Badge>}
                          {lead.status === 'qualified' && <Badge variant="outline" className="rounded-full text-[10px] border-blue-500 text-blue-700">Calificado</Badge>}
                          {lead.status === 'customer' && <Badge variant="outline" className="rounded-full text-[10px] border-green-500 text-green-700">Cliente</Badge>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No hay contactos disponibles
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Área de chat */}
      <div className="flex-1 flex flex-col">
        {(selectedChatId || selectedLeadData) ? (
          <>
            <div className="p-3 border-b flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  {selectedLeadData?.avatar ? (
                    <AvatarImage src={selectedLeadData.avatar} alt={selectedLeadData.fullName} />
                  ) : null}
                  <AvatarFallback className="bg-green-500 text-white">
                    {whatsappStatus?.authenticated && selectedChatId
                      ? getInitials((filteredChats.find((c: WhatsAppChat) => c.id === selectedChatId) || {}).name)
                      : selectedLeadData 
                        ? getInitials(selectedLeadData.fullName)
                        : 'UN'
                    }
                  </AvatarFallback>
                </Avatar>
                
                <div>
                  <div className="font-medium text-sm">
                    {whatsappStatus?.authenticated && selectedChatId
                      ? (filteredChats.find((c: WhatsAppChat) => c.id === selectedChatId) || {}).name || 'Chat'
                      : selectedLeadData 
                        ? selectedLeadData.fullName
                        : 'Contacto'
                    }
                  </div>
                  <div className="text-xs text-gray-500">
                    {selectedLeadData?.phone || selectedChatId || ''}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button className="h-9 w-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500" aria-label="Llamar">
                  <Phone size={20} />
                </button>
                <button className="h-9 w-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500" aria-label="Videollamada">
                  <Video size={20} />
                </button>
                <button 
                  className={`h-9 w-9 rounded-full hover:bg-gray-100 flex items-center justify-center ${showAiAssistant ? 'text-primary-600' : 'text-gray-500'}`} 
                  aria-label="Asistente IA"
                  onClick={() => setShowAiAssistant(!showAiAssistant)}
                >
                  <BrainCircuit size={20} />
                </button>
                <button className="h-9 w-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500" aria-label="Más opciones">
                  <MoreVertical size={20} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden flex">
              <div className={`flex-1 flex flex-col ${showAiAssistant ? 'w-2/3' : 'w-full'}`}>
                <ScrollArea className="flex-1 p-4 bg-gray-50">
                  <div className="space-y-3 pb-4">
                    {whatsappStatus?.authenticated && selectedChatId ? (
                      // Mostrar mensajes de WhatsApp reales
                      isLoadingWhatsappMessages ? (
                        <div className="flex justify-center py-8">
                          <Spinner size="lg" />
                        </div>
                      ) : Array.isArray(whatsappMessages) && whatsappMessages.length > 0 ? (
                        whatsappMessages.map((msg: WhatsAppMessage) => (
                          <div 
                            key={msg.id}
                            className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}
                          >
                            <div 
                              className={`max-w-[70%] rounded-lg p-3 ${
                                msg.fromMe 
                                  ? 'bg-green-100 text-gray-800' 
                                  : 'bg-white border text-gray-800'
                              }`}
                            >
                              <div className="text-sm whitespace-pre-wrap">{msg.body}</div>
                              <div className="flex justify-end items-center mt-1 text-xs text-gray-500">
                                {format(new Date(msg.timestamp), 'HH:mm')}
                                {msg.fromMe && (
                                  <div className="ml-1">
                                    <CheckCheck size={14} className="text-green-500" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          No hay mensajes para mostrar
                        </div>
                      )
                    ) : (
                      // Modo fallback para mensajes del CRM
                      isLoadingMessages ? (
                        <div className="flex justify-center py-8">
                          <Spinner size="lg" />
                        </div>
                      ) : messages.length > 0 ? (
                        messages.map((message: Message) => (
                          <div 
                            key={message.id}
                            className={`flex ${message.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div 
                              className={`max-w-[70%] rounded-lg p-3 ${
                                message.direction === 'outgoing' 
                                  ? 'bg-green-100 text-gray-800' 
                                  : 'bg-white border text-gray-800'
                              }`}
                            >
                              <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                              <div className="flex justify-end items-center mt-1">
                                {message.direction === 'outgoing' && renderMessageStatus(message.status, message.timestamp)}
                                {message.direction === 'incoming' && (
                                  <div className="text-xs text-gray-500">
                                    {new Date(message.timestamp).toLocaleTimeString([], { 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}
                                  </div>
                                )}
                              </div>
                              {message.aiGenerated && (
                                <div className="text-xs text-right mt-1 text-primary-500 flex items-center justify-end gap-1">
                                  <BrainCircuit size={12} />
                                  <span>IA</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          No hay mensajes para mostrar
                        </div>
                      )
                    )}
                  </div>
                  <div ref={messagesEndRef} />
                </ScrollArea>
                
                <div className="border-t p-3">
                  <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <button 
                      type="button"
                      className="text-gray-400 hover:text-gray-600"
                      aria-label="Adjuntar archivo"
                    >
                      <Paperclip size={20} />
                    </button>
                    
                    <Input 
                      type="text"
                      placeholder="Escribe un mensaje"
                      className="flex-1"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      disabled={sendMessageMutation.isPending}
                    />
                    
                    <button 
                      type="button"
                      className="text-gray-400 hover:text-gray-600"
                      aria-label="Insertar emoji"
                    >
                      <Smile size={20} />
                    </button>
                    
                    <button 
                      type="button"
                      className="text-gray-400 hover:text-gray-600 hidden md:block"
                      aria-label="Grabar audio"
                    >
                      <Mic size={20} />
                    </button>
                    
                    <Button 
                      type="submit" 
                      size="icon" 
                      variant="ghost"
                      disabled={!messageText.trim() || sendMessageMutation.isPending}
                      className={messageText.trim() ? "text-primary-600" : "text-gray-400"}
                    >
                      {sendMessageMutation.isPending ? (
                        <Spinner size="sm" />
                      ) : (
                        <Send size={20} />
                      )}
                    </Button>
                  </form>
                </div>
              </div>
              
              {showAiAssistant && (
                <div className="w-1/3 border-l flex flex-col">
                  <GeminiAssistant 
                    leadId={selectedLeadId} 
                    onMessageGenerated={(message) => {
                      setMessageText(message);
                    }}
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">WhatsApp Web</h3>
              <p className="text-gray-500 max-w-sm">
                Selecciona un contacto de la lista o busca para comenzar a chatear
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageSquare(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}