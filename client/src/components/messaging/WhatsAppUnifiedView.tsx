import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LayoutGrid, Smartphone, RefreshCw, User } from 'lucide-react';
import { WhatsAppSimple } from './WhatsAppSimple';
import { useToast } from '@/hooks/use-toast';

// Interfaz para chat de WhatsApp
interface WhatsAppChat {
  id: string;
  name: string;
  isGroup: boolean;
  timestamp: number;
  unreadCount: number;
  lastMessage?: string;
  profilePicUrl?: string;
  accountId?: number;
}

// Interfaz para cuenta de WhatsApp
interface WhatsAppAccount {
  id: number;
  name: string;
  status: string;
}

// Interfaz para estado de WhatsApp
interface WhatsAppStatus {
  id: number;
  name: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING';
  qrCode?: string;
}

export function WhatsAppUnifiedView({ onSelectChat }: { onSelectChat: (chatId: string, accountId: number) => void }) {
  const { toast } = useToast();
  const [chatFilter, setChatFilter] = useState('');
  
  // Consulta para obtener las cuentas WhatsApp
  const { data: whatsappAccounts = [] } = useQuery<WhatsAppAccount[]>({
    queryKey: ['/api/whatsapp-accounts'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/whatsapp-accounts');
        if (!response.ok) throw new Error("Error al obtener cuentas de WhatsApp");
        const data = await response.json();
        return data;
      } catch (error) {
        console.error("Error obteniendo cuentas WhatsApp:", error);
        return [];
      }
    }
  });
  
  // Consulta para obtener el estado de conexión de las cuentas WhatsApp
  const { 
    data: whatsappStatuses = [], 
    isLoading: isLoadingStatus, 
    refetch: refetchStatus 
  } = useQuery<WhatsAppStatus[]>({
    queryKey: ['/api/direct/whatsapp/status'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/direct/whatsapp/status');
        if (!response.ok) throw new Error("Error al obtener estado de WhatsApp");
        const data = await response.json();
        // Si recibimos un solo objeto, lo convertimos en array
        if (!Array.isArray(data)) {
          return data.ready ? [{ 
            id: 1, 
            name: "WhatsApp", 
            status: data.authenticated ? 'CONNECTED' : 'DISCONNECTED'
          }] : [];
        }
        return data;
      } catch (error) {
        console.error("Error obteniendo estado WhatsApp:", error);
        return [];
      }
    },
    refetchInterval: 5000 // Actualizar cada 5 segundos
  });

  // Estado para almacenar chats de todas las cuentas
  const [allChats, setAllChats] = useState<WhatsAppChat[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);

  // Función para cargar los chats de todas las cuentas
  const loadAllChats = async () => {
    setIsLoadingChats(true);
    try {
      const allChatsData: WhatsAppChat[] = [];
      
      // Iterar sobre todas las cuentas disponibles
      for (const account of whatsappAccounts) {
        const accountId = account.id;
        
        // Verificar si la cuenta está conectada
        const accountStatus = whatsappStatuses.find(status => status.id === accountId);
        if (!accountStatus || accountStatus.status !== 'CONNECTED') continue;
        
        // Obtener los chats para esta cuenta
        const response = await fetch(`/api/direct/whatsapp/chats?accountId=${accountId}`);
        if (!response.ok) continue;
        
        const accountChats = await response.json();
        
        // Añadir el ID de la cuenta a cada chat para identificar su origen
        const chatsWithAccountId = accountChats.map((chat: WhatsAppChat) => ({
          ...chat,
          accountId
        }));
        
        // Añadir al array de todos los chats
        allChatsData.push(...chatsWithAccountId);
      }
      
      // Actualizar estado
      setAllChats(allChatsData);
    } catch (error) {
      console.error("Error cargando todos los chats:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los chats de todas las cuentas",
        variant: "destructive"
      });
    } finally {
      setIsLoadingChats(false);
    }
  };

  // Cargar los chats cuando cambian las cuentas o sus estados
  useEffect(() => {
    if (whatsappAccounts.length > 0 && whatsappStatuses.length > 0) {
      loadAllChats();
    }
  }, [whatsappAccounts, whatsappStatuses]);

  // Filtrar chats según el término de búsqueda
  const filteredChats = chatFilter
    ? allChats.filter(chat => 
        chat.name.toLowerCase().includes(chatFilter.toLowerCase()) || 
        (chat.lastMessage && chat.lastMessage.toLowerCase().includes(chatFilter.toLowerCase()))
      )
    : allChats;

  // Agrupar chats por cuenta
  const groupedChats = filteredChats.reduce((acc, chat) => {
    const accountId = chat.accountId || 0;
    if (!acc[accountId]) {
      acc[accountId] = [];
    }
    acc[accountId].push(chat);
    return acc;
  }, {} as Record<number, WhatsAppChat[]>);

  // Obtener el nombre de la cuenta para un ID dado
  const getAccountName = (accountId: number) => {
    const account = whatsappAccounts.find(acc => acc.id === accountId);
    return account ? account.name : `Cuenta ${accountId}`;
  };

  // Formatear fecha para los chats
  const formatChatDate = (timestamp: number) => {
    try {
      const date = new Date(timestamp * 1000);
      const now = new Date();
      
      // Si es hoy, mostrar hora (formato 24h)
      if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      
      // Si es esta semana, mostrar día
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: 'long' });
      }
      
      // En otros casos, mostrar fecha
      return date.toLocaleDateString();
    } catch (error) {
      return "Fecha desconocida";
    }
  };

  // Verificar si hay cuentas conectadas
  const hasConnectedAccounts = whatsappStatuses.some(status => status.status === 'CONNECTED');

  return (
    <div className="flex flex-col h-full border rounded-md overflow-hidden">
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Vista Unificada</h2>
          <Button 
            variant="outline"
            size="sm"
            onClick={loadAllChats}
            disabled={isLoadingChats}
          >
            {isLoadingChats ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Actualizar</span>
          </Button>
        </div>
        
        <Input
          placeholder="Buscar en todos los chats..."
          value={chatFilter}
          onChange={(e) => setChatFilter(e.target.value)}
          className="mb-2"
        />
      </div>
      
      <ScrollArea className="flex-1">
        {isLoadingChats ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
            <span className="ml-3">Cargando chats...</span>
          </div>
        ) : !hasConnectedAccounts ? (
          <div className="p-8 text-center">
            <p className="mb-2 text-gray-600">No hay cuentas conectadas</p>
            <p className="text-sm text-gray-500">
              Conecta al menos una cuenta de WhatsApp para ver los chats
            </p>
          </div>
        ) : Object.keys(groupedChats).length === 0 ? (
          <div className="p-8 text-center">
            <p className="mb-2 text-gray-600">No hay chats disponibles</p>
            <p className="text-sm text-gray-500">
              No se encontraron chats en las cuentas conectadas
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {Object.entries(groupedChats).map(([accountId, chats]) => {
              const numericAccountId = parseInt(accountId);
              return (
                <div key={accountId} className="account-section">
                  <div className="sticky top-0 bg-gray-100 p-2 z-10 border-y">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">
                        {getAccountName(numericAccountId)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {chats.length} chats
                      </span>
                    </div>
                  </div>
                  
                  {chats.map(chat => (
                    <div
                      key={chat.id}
                      className="p-3 hover:bg-gray-100 cursor-pointer"
                      onClick={() => onSelectChat(chat.id, numericAccountId)}
                    >
                      <div className="flex items-start">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-300 mr-3 flex items-center justify-center overflow-hidden">
                          {chat.profilePicUrl ? (
                            <img src={chat.profilePicUrl} alt={chat.name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="h-6 w-6 text-gray-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between">
                            <h4 className="text-sm font-medium text-gray-900 truncate">
                              {chat.name}
                            </h4>
                            <span className="text-xs text-gray-500">
                              {formatChatDate(chat.timestamp)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {chat.lastMessage}
                          </p>
                        </div>
                        {chat.unreadCount > 0 && (
                          <div className="ml-2 bg-green-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                            {chat.unreadCount}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}