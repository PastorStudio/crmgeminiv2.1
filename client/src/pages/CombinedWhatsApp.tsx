import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const CombinedWhatsApp = () => {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [allChats, setAllChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');
  
  // Obtener cuentas de WhatsApp
  const { data: accountsData, isLoading: isLoadingAccounts } = useQuery({
    queryKey: ['/api/whatsapp-accounts'],
    enabled: true,
  });

  // Efecto para cargar cuentas
  useEffect(() => {
    if (accountsData && Array.isArray(accountsData)) {
      setAccounts(accountsData);
      setLoading(false);
    }
  }, [accountsData]);

  // Obtener chats para todas las cuentas
  useEffect(() => {
    const fetchAllChats = async () => {
      if (!accounts || accounts.length === 0) return;
      
      try {
        const allChatsResponse = await Promise.all(
          accounts.map(async (account) => {
            const response = await fetch(`/api/whatsapp/${account.id}/chats`);
            const chats = await response.json();
            return chats.map((chat: any) => ({
              ...chat,
              accountId: account.id,
              accountName: account.name
            }));
          })
        );
        
        // Combinar todos los chats y organizarlos por ID de cuenta
        const combinedChats = allChatsResponse.flat().sort((a, b) => {
          // Primero ordenar por ID de cuenta
          if (a.accountId !== b.accountId) {
            return a.accountId - b.accountId;
          }
          // Luego por timestamp si está disponible
          if (a.timestamp && b.timestamp) {
            return b.timestamp - a.timestamp;
          }
          return 0;
        });
        
        setAllChats(combinedChats);
      } catch (error) {
        console.error('Error al obtener chats:', error);
      }
    };
    
    fetchAllChats();
    // Refrescar cada 30 segundos
    const interval = setInterval(fetchAllChats, 30000);
    
    return () => clearInterval(interval);
  }, [accounts]);

  // Obtener mensajes cuando se selecciona un chat
  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedChat) return;
      
      try {
        // Extraer ID de cuenta y chat ID del formato "accountId-chatId"
        const [accountId, chatId] = selectedChat.split('-');
        
        const response = await fetch(`/api/whatsapp/${accountId}/chats/${encodeURIComponent(chatId)}/messages`);
        const data = await response.json();
        
        setMessages(data);
      } catch (error) {
        console.error('Error al obtener mensajes:', error);
      }
    };
    
    fetchMessages();
    // Refrescar mensajes cada 5 segundos
    const interval = setInterval(fetchMessages, 5000);
    
    return () => clearInterval(interval);
  }, [selectedChat]);

  // Enviar mensaje
  const sendMessage = async () => {
    if (!selectedChat || !messageText.trim()) return;
    
    try {
      // Extraer ID de cuenta y chat ID
      const [accountId, chatId] = selectedChat.split('-');
      
      await fetch(`/api/whatsapp/${accountId}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          chatId, 
          message: messageText 
        }),
      });
      
      // Limpiar campo de mensaje
      setMessageText('');
      
      // Refrescar mensajes inmediatamente
      const response = await fetch(`/api/whatsapp/${accountId}/chats/${encodeURIComponent(chatId)}/messages`);
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
    }
  };

  // Manejar envío con Enter
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Panel lateral de chats */}
      <div className="w-1/3 border-r border-gray-300 bg-white overflow-y-auto">
        <div className="p-4 border-b border-gray-300 bg-green-600 text-white">
          <h2 className="text-xl font-semibold">Todas las Cuentas WhatsApp</h2>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        ) : allChats.length > 0 ? (
          <div>
            {allChats.map((chat) => (
              <div
                key={`${chat.accountId}-${chat.id}`}
                className={`p-3 border-b border-gray-200 hover:bg-gray-100 cursor-pointer ${
                  selectedChat === `${chat.accountId}-${chat.id}` ? 'bg-gray-200' : ''
                }`}
                onClick={() => setSelectedChat(`${chat.accountId}-${chat.id}`)}
              >
                <div className="flex items-center">
                  {/* Indicador de ID de cuenta */}
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs mr-3">
                    {chat.accountId}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between">
                      <span className="font-medium truncate">
                        {chat.name || 'Chat sin nombre'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {chat.timestamp ? format(new Date(chat.timestamp * 1000), 'HH:mm') : ''}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <p className="text-sm text-gray-600 truncate">
                        {chat.lastMessage || 'No hay mensajes'}
                      </p>
                      <span className="text-xs text-gray-500 italic">
                        {chat.accountName}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-gray-500">
            <p>No hay chats disponibles</p>
            <p className="text-sm mt-2">Conecta tus cuentas de WhatsApp para ver los chats</p>
          </div>
        )}
      </div>
      
      {/* Área de mensajes */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Cabecera del chat */}
            <div className="p-4 border-b border-gray-300 bg-white flex items-center">
              {(() => {
                const selectedChatObj = allChats.find(
                  (chat) => `${chat.accountId}-${chat.id}` === selectedChat
                );
                const [accountId] = selectedChat.split('-');
                
                return (
                  <>
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs mr-3">
                      {accountId}
                    </div>
                    <div>
                      <h3 className="font-semibold">
                        {selectedChatObj?.name || 'Chat seleccionado'}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {accounts.find(acc => acc.id === parseInt(accountId))?.name || 'Cuenta WhatsApp'}
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>
            
            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {messages.length > 0 ? (
                <div className="space-y-3">
                  {messages.map((message, index) => (
                    <div
                      key={`${message.id || index}-${message.timestamp}`}
                      className={`max-w-[80%] p-3 rounded-lg ${
                        message.fromMe
                          ? 'ml-auto bg-green-100 text-gray-800'
                          : 'bg-white text-gray-800 border border-gray-200'
                      }`}
                    >
                      <div className="text-sm">{message.body}</div>
                      <div className="text-right mt-1">
                        <span className="text-xs text-gray-500">
                          {message.timestamp
                            ? format(new Date(message.timestamp * 1000), 'HH:mm')
                            : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <p>No hay mensajes en este chat</p>
                    <p className="text-sm mt-2">Envía un mensaje para iniciar la conversación</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Área de entrada de mensaje */}
            <div className="p-3 bg-white border-t border-gray-300">
              <div className="flex items-center">
                <textarea
                  className="flex-1 border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  placeholder="Escribe un mensaje..."
                  rows={2}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyPress}
                ></textarea>
                <button
                  className="ml-2 bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 focus:outline-none"
                  onClick={sendMessage}
                >
                  Enviar
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="text-xl">Selecciona un chat para ver los mensajes</p>
              <p className="mt-2">Los chats están organizados por ID de cuenta</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CombinedWhatsApp;