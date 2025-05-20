import React from 'react';

interface WhatsAppChat {
  id: string;
  name: string;
  isGroup: boolean;
  timestamp: number;
  unreadCount: number;
  lastMessage?: string;
  profilePicUrl?: string;
  accountId?: number;
  accountName?: string;
}

/**
 * Componente para renderizar los chats de todas las cuentas
 */
export const AllAccountsChats: React.FC<{
  chats: WhatsAppChat[];
  selectedChatId: string | null;
  onSelectChat: (chat: WhatsAppChat) => void;
}> = ({ chats, selectedChatId, onSelectChat }) => {
  return (
    <div className="divide-y">
      {chats.map((chat) => (
        <div
          key={chat.id}
          className={`p-3 hover:bg-gray-50 cursor-pointer ${
            selectedChatId === chat.id ? 'bg-green-50 border-l-4 border-l-green-500' : ''
          }`}
          onClick={() => onSelectChat(chat)}
        >
          {chat.accountId && (
            <div className="text-xs font-medium bg-blue-100 text-blue-800 rounded-full h-5 w-5 flex items-center justify-center absolute right-1 top-1">
              {chat.accountId}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};