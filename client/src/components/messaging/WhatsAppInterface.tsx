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
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Consulta para obtener leads (contactos)
  const { data: leads = [], isLoading: isLoadingLeads } = useQuery({
    queryKey: ['/api/leads'],
    queryFn: async () => {
      const response = await apiRequest("GET", '/api/leads');
      return await response.json();
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

  // Consulta para obtener mensajes del lead seleccionado
  const { 
    data: messages = [], 
    isLoading: isLoadingMessages 
  } = useQuery({
    queryKey: ['/api/messages', { leadId: selectedLeadId }],
    queryFn: async () => {
      const response = await apiRequest(
        "GET", 
        selectedLeadId ? `/api/messages?leadId=${selectedLeadId}` : '/api/messages/recent'
      );
      return await response.json();
    },
    enabled: activeTab === 'chats',
  });

  // Consulta para obtener detalles del lead seleccionado
  const { 
    data: leadDetails,
    isLoading: isLoadingLeadDetails 
  } = useQuery({
    queryKey: ['/api/leads', selectedLeadId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/leads/${selectedLeadId}`);
      const data = await response.json();
      return data;
    },
    enabled: !!selectedLeadId,
    onSuccess: (data) => {
      setSelectedLeadData(data);
    }
  });

  // Mutación para enviar un mensaje
  const sendMessageMutation = useMutation({
    mutationFn: (newMessage: { leadId: number; content: string; channel: string }) => {
      return apiRequest({
        url: '/api/messages',
        method: 'POST',
        data: newMessage
      });
    },
    onSuccess: () => {
      setMessageText('');
      queryClient.invalidateQueries({ queryKey: ['/api/messages', { leadId: selectedLeadId }] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'No se pudo enviar el mensaje',
        variant: 'destructive'
      });
    }
  });

  // Mutación para marcar mensaje como leído
  const markAsReadMutation = useMutation({
    mutationFn: (messageId: number) => {
      return apiRequest({
        url: `/api/messages/${messageId}/read`,
        method: 'PATCH'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages', { leadId: selectedLeadId }] });
    }
  });

  // Verificar estado de integración con WhatsApp
  const { 
    data: whatsappStatus, 
    isLoading: isLoadingWhatsappStatus 
  } = useQuery({
    queryKey: ['/api/integrations/whatsapp/status'],
    queryFn: async () => {
      const response = await apiRequest("GET", '/api/integrations/whatsapp/status');
      return await response.json();
    },
    refetchInterval: 10000, // Verificar cada 10 segundos
  });

  // Consulta para obtener el código QR si es necesario
  const { 
    data: qrCodeData, 
    isLoading: isLoadingQrCode 
  } = useQuery({
    queryKey: ['/api/integrations/whatsapp/qrcode'],
    queryFn: async () => {
      const response = await apiRequest("GET", '/api/integrations/whatsapp/qrcode');
      return await response.json();
    },
    enabled: whatsappStatus?.qrNeeded === true,
    refetchInterval: whatsappStatus?.qrNeeded ? 5000 : false, // Actualizar cada 5 segundos si se necesita QR
  });

  // Reiniciar WhatsApp
  const restartWhatsAppMutation = useMutation({
    mutationFn: () => {
      return apiRequest({
        url: '/api/integrations/whatsapp/restart',
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/whatsapp/status'] });
      toast({
        title: 'WhatsApp reiniciado',
        description: 'La conexión con WhatsApp se está reiniciando',
      });
    }
  });

  // Manejar envío de mensaje
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!messageText.trim() || !selectedLeadId) return;
    
    sendMessageMutation.mutate({
      leadId: selectedLeadId,
      content: messageText,
      channel: 'whatsapp'
    });
  };

  // Marcar mensajes como leídos cuando se selecciona un lead
  useEffect(() => {
    if (selectedLeadId && messages.length > 0) {
      messages.forEach((msg: Message) => {
        if (msg.direction === 'incoming' && msg.status !== 'read') {
          markAsReadMutation.mutate(msg.id);
        }
      });
    }
  }, [selectedLeadId, messages]);

  // Scroll al fondo cuando se reciben nuevos mensajes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Manejar selección de un lead
  const handleLeadSelect = (leadId: number) => {
    if (onSelectLead) {
      onSelectLead(leadId);
    }
  };

  // Obtener iniciales para avatar
  const getInitials = (name: string) => {
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
    
    return (
      <div className="flex items-center text-xs text-gray-500 mt-1 justify-end gap-1">
        <span>{time}</span>
        {status === 'sent' && <Check size={14} />}
        {status === 'delivered' && <CheckCheck size={14} />}
        {status === 'read' && <CheckCheck size={14} className="text-blue-500" />}
        {status === 'failed' && <AlertCircle size={14} className="text-red-500" />}
      </div>
    );
  };

  // Renderizar la sección de conectar WhatsApp
  const renderConnectWhatsApp = () => {
    if (isLoadingWhatsappStatus) {
      return (
        <div className="flex flex-col items-center justify-center h-60">
          <Spinner size="lg" />
          <p className="text-sm mt-4 text-gray-500">Verificando el estado de WhatsApp...</p>
        </div>
      );
    }

    if (!whatsappStatus?.initialized) {
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
          
          {whatsappStatus?.qrNeeded && qrCodeData?.qrCode ? (
            <div className="border p-4 rounded-lg mb-6">
              <img 
                src={`data:image/png;base64,${qrCodeData.qrCode}`}
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
              <span>Toca Menú o Configuración y selecciona WhatsApp Web</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-medium">3.</span>
              <span>Apunta tu teléfono hacia esta pantalla para escanear el código</span>
            </li>
          </ol>
          
          <Button 
            variant="outline" 
            onClick={() => restartWhatsAppMutation.mutate()}
            disabled={restartWhatsAppMutation.isPending}
            className="w-full"
          >
            {restartWhatsAppMutation.isPending ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Reiniciando...
              </>
            ) : (
              <>
                <RefreshCw size={16} className="mr-2" />
                Reiniciar conexión
              </>
            )}
          </Button>
        </div>
      );
    }

    return null;
  };

  // Renderizar la lista de leads (contactos)
  const renderLeadsList = () => {
    if (isLoadingLeads) {
      return (
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      );
    }

    if (filteredLeads.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="bg-gray-100 p-3 rounded-full mb-4">
            <Search className="h-6 w-6 text-gray-500" />
          </div>
          <h3 className="font-medium text-gray-900">No se encontraron resultados</h3>
          <p className="text-sm text-gray-500 text-center mt-1">
            No hay contactos que coincidan con "{searchTerm}"
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-1 p-1">
        {filteredLeads.map((lead: Lead) => (
          <div
            key={lead.id}
            className={`flex items-start gap-3 p-2 rounded-md cursor-pointer transition-colors
              ${lead.id === selectedLeadId ? 'bg-primary-50' : 'hover:bg-gray-100'}`}
            onClick={() => handleLeadSelect(lead.id)}
          >
            <Avatar className="h-12 w-12 flex-shrink-0">
              {lead.avatar ? (
                <AvatarImage src={lead.avatar} alt={lead.fullName} />
              ) : (
                <AvatarFallback className="bg-primary-100 text-primary-800">
                  {getInitials(lead.fullName)}
                </AvatarFallback>
              )}
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <h4 className="font-medium text-sm truncate">{lead.fullName}</h4>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {lead.lastActive 
                    ? formatDistanceToNow(new Date(lead.lastActive), { 
                        addSuffix: true, 
                        locale: es 
                      })
                    : 'Sin actividad'}
                </span>
              </div>
              
              <div className="flex items-center text-xs text-gray-500 mt-0.5">
                <span className="truncate">
                  {lead.company || lead.email}
                </span>
              </div>
              
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-gray-400">
                  {lead.phone || 'Sin teléfono'}
                </span>
                
                {lead.status && (
                  <Badge 
                    variant="outline" 
                    className="text-xs px-1.5 py-0 h-5"
                  >
                    {lead.status}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Renderizar los mensajes del chat
  const renderMessages = () => {
    if (!selectedLeadId) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <div className="bg-gray-100 p-4 rounded-full mb-4">
            <MessageSquare className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">Tus mensajes</h3>
          <p className="text-sm text-gray-500 max-w-xs mt-2">
            Selecciona un contacto para ver la conversación o iniciar una nueva.
          </p>
        </div>
      );
    }

    if (isLoadingMessages) {
      return (
        <div className="flex justify-center items-center h-full">
          <Spinner size="lg" />
        </div>
      );
    }

    if (messages.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <div className="bg-gray-100 p-4 rounded-full mb-4">
            <MessageSquare className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No hay mensajes</h3>
          <p className="text-sm text-gray-500 max-w-xs mt-2">
            Inicia una conversación enviando un mensaje a este contacto.
          </p>
        </div>
      );
    }

    return (
      <div className="p-4 space-y-4">
        {messages.map((message: Message, index: number) => {
          const isOutgoing = message.direction === 'outgoing';
          
          return (
            <div
              key={message.id}
              className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-2 ${
                  isOutgoing
                    ? 'bg-green-50 text-green-900'
                    : 'bg-white border text-gray-800'
                }`}
              >
                <div className="text-sm">{message.content}</div>
                {renderMessageStatus(message.status, message.timestamp)}
                
                {message.aiGenerated && (
                  <div className="flex items-center text-xs text-gray-400 mt-1 gap-1">
                    <BrainCircuit size={12} />
                    <span>Generado por IA</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-gray-50 rounded-lg border shadow-sm">
      {/* Panel izquierdo (contactos) */}
      <div className="w-80 flex-shrink-0 border-r bg-white flex flex-col h-full">
        <div className="p-3 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary-100 text-primary-800">
                MG
              </AvatarFallback>
            </Avatar>
            
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <RefreshCw size={18} />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical size={18} />
              </Button>
            </div>
          </div>
          
          <div className="mt-3 relative">
            <Input
              placeholder="Buscar o iniciar un nuevo chat"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 py-5 bg-white"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          </div>
        </div>
        
        <Tabs defaultValue="chats" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="w-full grid grid-cols-2 mt-1 rounded-none border-b bg-transparent">
            <TabsTrigger value="chats" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              Chats
            </TabsTrigger>
            <TabsTrigger value="status" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              Estado
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="chats" className="flex-1 overflow-y-auto p-0 m-0">
            <ScrollArea className="h-full">
              {renderLeadsList()}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="status" className="flex-1 overflow-y-auto p-0 m-0">
            {renderConnectWhatsApp()}
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Panel central (chat) */}
      <div className="flex-1 flex flex-col bg-gray-100">
        {selectedLeadId && selectedLeadData ? (
          <>
            {/* Cabecera del chat */}
            <div className="p-3 border-b bg-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  {selectedLeadData.avatar ? (
                    <AvatarImage src={selectedLeadData.avatar} />
                  ) : (
                    <AvatarFallback className="bg-primary-100 text-primary-800">
                      {getInitials(selectedLeadData.fullName)}
                    </AvatarFallback>
                  )}
                </Avatar>
                
                <div>
                  <h3 className="font-medium text-sm">{selectedLeadData.fullName}</h3>
                  <p className="text-xs text-gray-500">
                    {selectedLeadData.lastActive ? (
                      `Activo ${formatDistanceToNow(new Date(selectedLeadData.lastActive), {
                        addSuffix: true,
                        locale: es
                      })}`
                    ) : (
                      'Sin actividad reciente'
                    )}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => setShowAiAssistant(!showAiAssistant)}
                >
                  <BrainCircuit size={18} className={showAiAssistant ? "text-primary-500" : ""} />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Search size={18} />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Phone size={18} />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical size={18} />
                </Button>
              </div>
            </div>
            
            {/* Área de mensajes */}
            <div className="flex-1 overflow-y-auto bg-messages-pattern relative">
              {showAiAssistant && (
                <div className="absolute top-4 right-4 z-10 w-80">
                  <Card className="shadow-lg">
                    <CardHeader className="p-3 pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <BrainCircuit size={16} className="text-primary-500" />
                        Asistente Gemini
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <GeminiAssistant 
                        leadId={selectedLeadId} 
                        compact={true}
                        onMessageGenerated={(message) => {
                          if (message) {
                            setMessageText(message);
                          }
                        }}
                      />
                    </CardContent>
                  </Card>
                </div>
              )}
              <ScrollArea className="h-full">
                {renderMessages()}
              </ScrollArea>
            </div>
            
            {/* Área de entrada de mensajes */}
            <div className="p-3 border-t bg-white">
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="icon" className="text-gray-500">
                  <Smile size={20} />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="text-gray-500">
                  <Paperclip size={20} />
                </Button>
                
                <Input
                  placeholder="Escribe un mensaje aquí"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="py-6"
                />
                
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