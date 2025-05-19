import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, User } from 'lucide-react';
import { format } from 'date-fns';

// Interfaces
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

interface WhatsAppAccount {
  id: number;
  name: string;
  status: string;
}

interface Props {
  showAllAccounts?: boolean;
  onChatSelect: (chat: WhatsAppChat) => void;
  selectedAccountId?: number;
  selectedChatId?: string;
  filterText?: string;
}

export function WhatsAppChatsList({ 
  showAllAccounts = false, 
  onChatSelect, 
  selectedAccountId,
  selectedChatId,
  filterText = '' 
}: Props) {
  const [allChats, setAllChats] = useState<WhatsAppChat[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);

  // Consulta para obtener las cuentas de WhatsApp
  const { data: whatsappAccounts = [] } = useQuery<WhatsAppAccount[]>({
    queryKey: ['/api/whatsapp-accounts'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/whatsapp-accounts');
        if (!response.ok) throw new Error('Error obteniendo cuentas de WhatsApp');
        return await response.json();
      } catch (error) {
        console.error('Error obteniendo cuentas de WhatsApp:', error);
        return [];
      }
    }
  });

  // Cargar los chats de todas las cuentas o solo de la cuenta seleccionada
  const loadChats = async () => {
    setIsLoadingChats(true);
    try {
      // Si estamos mostrando todos los chats de todas las cuentas
      if (showAllAccounts) {
        const allChatsData: WhatsAppChat[] = [];
        
        // Iterar sobre todas las cuentas disponibles
        for (const account of whatsappAccounts) {
          try {
            const response = await fetch(`/api/direct/whatsapp/chats?accountId=${account.id}`);
            if (!response.ok) continue;
            
            const accountChats = await response.json();
            
            // Añadir el ID de la cuenta a cada chat para identificar su origen
            const chatsWithAccountId = accountChats.map((chat: WhatsAppChat) => ({
              ...chat,
              accountId: account.id
            }));
            
            // Añadir al array de todos los chats
            allChatsData.push(...chatsWithAccountId);
          } catch (error) {
            console.error(`Error cargando chats para cuenta ${account.id}:`, error);
          }
        }
        
        setAllChats(allChatsData);
      } 
      // Si solo estamos mostrando los chats de una cuenta específica
      else if (selectedAccountId) {
        const response = await fetch(`/api/direct/whatsapp/chats?accountId=${selectedAccountId}`);
        if (!response.ok) throw new Error('Error obteniendo chats');
        
        const chats = await response.json();
        
        // Añadir el ID de la cuenta a cada chat
        const chatsWithAccountId = chats.map((chat: WhatsAppChat) => ({
          ...chat,
          accountId: selectedAccountId
        }));
        
        setAllChats(chatsWithAccountId);
      }
    } catch (error) {
      console.error('Error cargando chats:', error);
    } finally {
      setIsLoadingChats(false);
    }
  };

  // Cargar los chats cuando cambian las dependencias
  useEffect(() => {
    if (whatsappAccounts.length > 0) {
      loadChats();
    }
  }, [whatsappAccounts, selectedAccountId, showAllAccounts]);

  // Filtrar chats según texto de búsqueda
  const filteredChats = filterText
    ? allChats.filter(chat => 
        chat.name.toLowerCase().includes(filterText.toLowerCase()) || 
        (chat.lastMessage && chat.lastMessage.toLowerCase().includes(filterText.toLowerCase()))
      )
    : allChats;

  // Agrupar chats por cuenta si estamos mostrando todos
  const groupedChats = showAllAccounts 
    ? filteredChats.reduce((acc, chat) => {
        const accountId = chat.accountId || 0;
        if (!acc[accountId]) {
          acc[accountId] = [];
        }
        acc[accountId].push(chat);
        return acc;
      }, {} as Record<number, WhatsAppChat[]>)
    : { [selectedAccountId || 0]: filteredChats };

  // Ordenar las cuentas para mostrarlas
  const sortedAccountIds = Object.keys(groupedChats)
    .map(Number)
    .sort((a, b) => {
      const accountA = whatsappAccounts.find(acc => acc.id === a);
      const accountB = whatsappAccounts.find(acc => acc.id === b);
      return (accountA?.name || '').localeCompare(accountB?.name || '');
    });

  // Obtener el nombre de la cuenta
  const getAccountName = (accountId: number) => {
    const account = whatsappAccounts.find(acc => acc.id === accountId);
    return account?.name || `Cuenta ${accountId}`;
  };

  // Formatear fecha del chat
  const formatChatTime = (timestamp: number) => {
    try {
      const date = new Date(timestamp * 1000);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      
      // Si es hoy, mostrar la hora
      if (date.toDateString() === now.toDateString()) {
        return format(date, 'HH:mm');
      }
      
      // Si es esta semana, mostrar el día
      if (diffDays < 7) {
        return format(date, 'EEEE');
      }
      
      // Si es más antigua, mostrar la fecha
      return format(date, 'dd/MM/yyyy');
    } catch (error) {
      return '';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {isLoadingChats ? (
        <div className="flex items-center justify-center p-4">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          <span>Cargando chats...</span>
        </div>
      ) : allChats.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-4 text-gray-500">
          <p className="text-sm">No hay chats disponibles</p>
          {showAllAccounts && (
            <p className="text-xs mt-1">Conecta al menos una cuenta de WhatsApp</p>
          )}
        </div>
      ) : (
        <ScrollArea className="flex-1">
          {sortedAccountIds.map(accountId => {
            const chats = groupedChats[accountId] || [];
            if (chats.length === 0) return null;
            
            return (
              <div key={accountId} className="mb-2">
                {/* Mostrar el separador de cuenta solo si estamos en modo de todas las cuentas */}
                {showAllAccounts && (
                  <div className="sticky top-0 z-10 bg-gray-100 py-1 px-3 border-y">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">{getAccountName(accountId)}</span>
                      <Badge variant="outline" className="text-xs">
                        {chats.length} {chats.length === 1 ? 'chat' : 'chats'}
                      </Badge>
                    </div>
                  </div>
                )}
                
                {chats.map(chat => (
                  <div key={chat.id}>
                    <div 
                      className={`p-2 hover:bg-gray-100 cursor-pointer ${
                        selectedChatId === chat.id ? 'bg-gray-100' : ''
                      }`}
                      onClick={() => onChatSelect(chat)}
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          <AvatarImage src={chat.profilePicUrl} alt={chat.name} />
                          <AvatarFallback>
                            <User className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <h4 className="text-sm font-medium truncate">{chat.name}</h4>
                            <span className="text-xs text-gray-500 flex-shrink-0">
                              {formatChatTime(chat.timestamp)}
                            </span>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <p className="text-xs text-gray-500 truncate">
                              {chat.lastMessage || 'No hay mensajes'}
                            </p>
                            
                            {chat.unreadCount > 0 && (
                              <Badge className="ml-2 bg-green-500 hover:bg-green-600">
                                {chat.unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <Separator />
                  </div>
                ))}
              </div>
            );
          })}
        </ScrollArea>
      )}
    </div>
  );
}