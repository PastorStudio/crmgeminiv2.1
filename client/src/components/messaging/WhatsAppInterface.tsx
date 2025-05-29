import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Phone, MoreVertical, Send, Paperclip, Smile } from "lucide-react";

// Datos simulados de los chats de WhatsApp (basado en la base de datos real)
const whatsappChats = [
  {
    id: 1,
    name: "María González",
    phone: "+34 666 123 456",
    lastMessage: "¿Podrían enviarme más información sobre los productos?",
    timestamp: "6m",
    unreadCount: 2,
    avatar: "M",
    isOnline: true,
    messages: [
      { id: 1, text: "Hola, buenos días", timestamp: "2 min", sender: "contact", time: "14:20" },
      { id: 2, text: "Estoy buscando una solución de software para mi empresa", timestamp: "1 min", sender: "contact", time: "14:21" },
      { id: 3, text: "¡Hola! Buenos días, ¿en qué podemos ayudarte?", timestamp: "45s", sender: "business", time: "14:22" },
      { id: 4, text: "Perfecto, tenemos varias opciones. ¿Qué tipo de empresa es?", timestamp: "30s", sender: "business", time: "14:23" },
      { id: 5, text: "Somos una empresa de logística con 50 empleados", timestamp: "15s", sender: "contact", time: "14:24" },
      { id: 6, text: "Excelente, tenemos el software perfecto para logística. Le envío un catálogo", timestamp: "5s", sender: "business", time: "14:25" },
      { id: 7, text: "¿Podrían enviarme más información sobre los productos?", timestamp: "ahora", sender: "contact", time: "14:26" }
    ]
  },
  {
    id: 2,
    name: "Carlos Ruiz",
    phone: "+34 677 234 567",
    lastMessage: "Perfecto, muchas gracias por...",
    timestamp: "15m",
    unreadCount: 0,
    avatar: "C",
    isOnline: false,
    messages: []
  },
  {
    id: 3,
    name: "Laura Martín",
    phone: "+34 688 345 678",
    lastMessage: "Me interesa el paquete premium",
    timestamp: "35m",
    unreadCount: 1,
    avatar: "L",
    isOnline: true,
    messages: []
  },
  {
    id: 4,
    name: "Roberto Silva",
    phone: "+34 699 456 789",
    lastMessage: "¿Tienen soporte 24/7?",
    timestamp: "1h",
    unreadCount: 0,
    avatar: "R",
    isOnline: false,
    messages: []
  },
  {
    id: 5,
    name: "Ana Fernández",
    phone: "+34 687 567 890",
    lastMessage: "Si, por favor envíenme la prop...",
    timestamp: "2h",
    unreadCount: 1,
    avatar: "A",
    isOnline: true,
    messages: []
  },
  {
    id: 6,
    name: "Miguel Torres",
    phone: "+34 676 678 901",
    lastMessage: "Mañana a las 10:00 está perf...",
    timestamp: "3h",
    unreadCount: 0,
    avatar: "M",
    isOnline: false,
    messages: []
  },
  {
    id: 7,
    name: "Elena Rojas",
    phone: "+34 665 789 012",
    lastMessage: "¿Hay descuento por volumen?",
    timestamp: "4h",
    unreadCount: 1,
    avatar: "E",
    isOnline: true,
    messages: []
  }
];

export default function WhatsAppInterface() {
  const [selectedChat, setSelectedChat] = useState(whatsappChats[0]);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredChats = whatsappChats.filter(chat =>
    chat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.phone.includes(searchTerm)
  );

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      // Aquí iría la lógica para enviar el mensaje
      console.log("Enviando mensaje:", newMessage);
      setNewMessage("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Panel izquierdo - Lista de chats */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        {/* Header del panel izquierdo */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold text-gray-900">WhatsApp Business Demo</h1>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                10 chats activos
              </Badge>
            </div>
          </div>
          
          {/* Barra de búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar chats..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-50 border-gray-200"
            />
          </div>
        </div>

        {/* Lista de chats */}
        <div className="flex-1 overflow-y-auto">
          {filteredChats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => setSelectedChat(chat)}
              className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                selectedChat.id === chat.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-green-500 text-white font-semibold">
                      {chat.avatar}
                    </AvatarFallback>
                  </Avatar>
                  {chat.isOnline && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">{chat.name}</h3>
                    <span className="text-xs text-gray-500">{chat.timestamp}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600 truncate flex-1 mr-2">
                      {chat.lastMessage}
                    </p>
                    {chat.unreadCount > 0 && (
                      <Badge className="bg-green-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center">
                        {chat.unreadCount}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{chat.phone}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Panel derecho - Chat activo */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {selectedChat ? (
          <>
            {/* Header del chat */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-green-500 text-white font-semibold">
                      {selectedChat.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="font-semibold text-gray-900">{selectedChat.name}</h2>
                    <p className="text-sm text-gray-500">
                      {selectedChat.isOnline ? 'En línea' : 'Desconectado'}
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

            {/* Área de mensajes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedChat.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'business' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.sender === 'business'
                        ? 'bg-green-500 text-white rounded-br-none'
                        : 'bg-white text-gray-900 rounded-bl-none border border-gray-200'
                    }`}
                  >
                    <p className="text-sm">{message.text}</p>
                    <p className={`text-xs mt-1 ${
                      message.sender === 'business' ? 'text-green-100' : 'text-gray-500'
                    }`}>
                      {message.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Input para escribir mensaje */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <div className="flex-1 relative">
                  <Input
                    placeholder="Escribe un mensaje..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="pr-10"
                  />
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="absolute right-1 top-1/2 transform -translate-y-1/2"
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                </div>
                <Button 
                  onClick={handleSendMessage}
                  className="bg-green-500 hover:bg-green-600 text-white"
                  size="sm"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4 mx-auto">
                <Phone className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Selecciona un chat</h3>
              <p className="text-gray-600">Elige una conversación para comenzar a chatear</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}