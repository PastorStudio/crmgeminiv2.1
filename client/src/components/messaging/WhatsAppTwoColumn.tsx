import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageSquare, 
  Send, 
  Phone, 
  Video, 
  MoreHorizontal, 
  Search,
  Paperclip,
  Smile,
  Mic,
  Bot
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function WhatsAppTwoColumn() {
  const [selectedChatId, setSelectedChatId] = useState<string>("");
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  // Datos estáticos de ejemplo para los chats
  const mockChats = [
    {
      id: "1",
      name: "Juan Pérez",
      lastMessage: "Hola, ¿cómo estás?",
      timestamp: "10:30",
      unreadCount: 2,
      avatar: "",
    },
    {
      id: "2", 
      name: "María García",
      lastMessage: "Perfecto, nos vemos mañana",
      timestamp: "09:15",
      unreadCount: 0,
      avatar: "",
    },
    {
      id: "3",
      name: "Carlos López",
      lastMessage: "¿Tienes los documentos?",
      timestamp: "Ayer",
      unreadCount: 1,
      avatar: "",
    }
  ];

  // Datos estáticos de ejemplo para los mensajes
  const mockMessages = [
    {
      id: "1",
      body: "Hola, ¿cómo estás?",
      fromMe: false,
      timestamp: "10:25"
    },
    {
      id: "2", 
      body: "¡Muy bien! ¿Y tú?",
      fromMe: true,
      timestamp: "10:26"
    },
    {
      id: "3",
      body: "Todo perfecto, gracias por preguntar",
      fromMe: false,
      timestamp: "10:30"
    }
  ];

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    
    toast({
      title: "Mensaje enviado",
      description: `Mensaje: ${newMessage}`,
      variant: "default"
    });
    
    setNewMessage("");
  };

  const handleAgenteIA = () => {
    toast({
      title: "Agente IA Activado",
      description: "Los 5 agentes externos están listos para generar respuestas automáticas",
      variant: "default"
    });
  };

  const filteredChats = mockChats.filter(chat =>
    chat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.lastMessage.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedChat = mockChats.find(chat => chat.id === selectedChatId);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Lista de Chats */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-900">WhatsApp</h1>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar chats..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Lista de Chats */}
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            {filteredChats.map((chat) => (
              <div
                key={chat.id}
                className={`flex items-center p-3 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedChatId === chat.id ? "bg-blue-50 border-l-4 border-blue-500" : ""
                }`}
                onClick={() => setSelectedChatId(chat.id)}
              >
                <Avatar className="h-12 w-12">
                  <AvatarImage src={chat.avatar} />
                  <AvatarFallback className="bg-blue-500 text-white">
                    {chat.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="ml-3 flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {chat.name}
                    </h3>
                    <span className="text-xs text-gray-500">
                      {chat.timestamp}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm text-gray-600 truncate max-w-[200px]">
                      {chat.lastMessage}
                    </p>
                    {chat.unreadCount > 0 && (
                      <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Área Principal del Chat */}
      <div className="flex-1 flex flex-col">
        {selectedChatId ? (
          <>
            {/* Header del Chat */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selectedChat?.avatar} />
                    <AvatarFallback className="bg-blue-500 text-white">
                      {selectedChat?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">
                      {selectedChat?.name}
                    </h2>
                    <p className="text-sm text-gray-500">En línea</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm">
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Video className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Mensajes */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {mockMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.fromMe ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.fromMe
                          ? "bg-blue-500 text-white"
                          : "bg-white text-gray-900 border border-gray-200"
                      }`}
                    >
                      <p className="text-sm">{message.body}</p>
                      <div className={`flex items-center justify-end mt-1 space-x-1 ${
                        message.fromMe ? "text-blue-100" : "text-gray-400"
                      }`}>
                        <span className="text-xs">{message.timestamp}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Input de Mensajes */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm">
                  <Paperclip className="h-4 w-4" />
                </Button>
                
                <div className="flex-1 relative">
                  <Input
                    placeholder="Escribe un mensaje..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="pr-10"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 transform -translate-y-1/2"
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                </div>

                <Button variant="ghost" size="sm">
                  <Mic className="h-4 w-4" />
                </Button>

                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
                  onClick={handleAgenteIA}
                >
                  <Bot className="h-4 w-4" />
                </Button>

                <Button 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="bg-blue-500 hover:bg-blue-600"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Selecciona una conversación
              </h3>
              <p className="text-gray-500">
                Elige un chat de la lista para ver y enviar mensajes
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default WhatsAppTwoColumn;