import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageCircle, Send, Phone, MoreVertical, Users, Clock } from 'lucide-react';

interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  isGroup: boolean;
  avatar?: string;
  isOnline: boolean;
}

interface Message {
  id: string;
  content: string;
  timestamp: string;
  isFromMe: boolean;
  sender?: string;
  type: 'text' | 'image' | 'document';
}

export default function WhatsAppTwoColumn() {
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');

  // Fetch chats
  const { data: chats = [], isLoading: chatsLoading } = useQuery({
    queryKey: ['/api/direct/whatsapp/chats'],
    refetchInterval: 5000,
  });

  // Fetch messages for selected chat
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['/api/direct/whatsapp/messages', selectedChat],
    enabled: !!selectedChat,
    refetchInterval: 2000,
  });

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return formatTime(timestamp);
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChat) return;

    try {
      await fetch('/api/direct/whatsapp/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: selectedChat,
          message: newMessage.trim()
        })
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Chat List */}
      <div className="w-1/4 border-r bg-white">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            WhatsApp Chats
          </h2>
          <div className="text-sm text-gray-500 mt-1">
            {chats.length} conversations
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-80px)]">
          {chatsLoading ? (
            <div className="p-4 text-center text-gray-500">
              Loading chats...
            </div>
          ) : chats.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No chats available</p>
              <p className="text-xs">Connect WhatsApp to see conversations</p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {chats.map((chat: any) => (
                <Card
                  key={chat.id}
                  className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                    selectedChat === chat.id ? 'bg-blue-50 border-blue-200' : ''
                  }`}
                  onClick={() => setSelectedChat(chat.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-green-100 text-green-700">
                            {chat.isGroup ? (
                              <Users className="h-6 w-6" />
                            ) : (
                              chat.name?.charAt(0)?.toUpperCase() || 'U'
                            )}
                          </AvatarFallback>
                        </Avatar>
                        {chat.isOnline && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-gray-900 truncate">
                            {chat.name || 'Unknown Contact'}
                          </h3>
                          <span className="text-xs text-gray-500">
                            {formatDate(chat.timestamp)}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-sm text-gray-600 truncate">
                            {chat.lastMessage || 'No messages yet'}
                          </p>
                          {chat.unreadCount > 0 && (
                            <Badge variant="default" className="bg-green-500 text-white text-xs">
                              {chat.unreadCount}
                            </Badge>
                          )}
                        </div>

                        {chat.isGroup && (
                          <div className="flex items-center gap-1 mt-1">
                            <Users className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-400">Group</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Message Area */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-green-100 text-green-700">
                      {chats.find((c: any) => c.id === selectedChat)?.isGroup ? (
                        <Users className="h-5 w-5" />
                      ) : (
                        chats.find((c: any) => c.id === selectedChat)?.name?.charAt(0)?.toUpperCase() || 'U'
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {chats.find((c: any) => c.id === selectedChat)?.name || 'Unknown Contact'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {chats.find((c: any) => c.id === selectedChat)?.isOnline ? 'Online' : 'Last seen recently'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm">
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {messagesLoading ? (
                <div className="flex justify-center items-center h-full">
                  <div className="text-gray-500">Loading messages...</div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex justify-center items-center h-full">
                  <div className="text-center text-gray-500">
                    <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No messages in this chat</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message: any, index: number) => (
                    <div
                      key={message.id || index}
                      className={`flex ${message.isFromMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-xs lg:max-w-md ${message.isFromMe ? 'order-1' : 'order-2'}`}>
                        {!message.isFromMe && chats.find((c: any) => c.id === selectedChat)?.isGroup && message.sender && (
                          <div className="text-xs text-gray-600 mb-1 px-2">
                            {message.sender}
                          </div>
                        )}
                        <div
                          className={`px-4 py-2 rounded-lg ${
                            message.isFromMe
                              ? 'bg-green-500 text-white'
                              : 'bg-white border shadow-sm'
                          }`}
                        >
                          <p className="text-sm">{message.content || message.body}</p>
                          <div className={`text-xs mt-1 flex items-center gap-1 ${
                            message.isFromMe ? 'text-green-100' : 'text-gray-500'
                          }`}>
                            <Clock className="h-3 w-3" />
                            {formatTime(message.timestamp)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t bg-white">
              <div className="flex items-center gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1"
                />
                <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-500">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Select a chat to start messaging</h3>
              <p className="text-sm">Choose a conversation from the list to view messages</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}