import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Phone, MoreVertical, Send, Paperclip, Smile } from "lucide-react";
import { apiRequest } from '@/lib/queryClient';

export default function WhatsAppInterface() {
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Datos de ejemplo basados en la imagen de WhatsApp Web
  const whatsappChats = [
    {
      id: 1,
      name: "María González",
      lastMessage: "¿Podrían enviarme más información sobre los productos?",
      timestamp: "6m",
      unreadCount: 2,
      avatar: "M",
      phone: "+34 666 123 456",
      isOnline: true,
      messages: [
        { id: 1, text: "Hola, buenos días", timestamp: "14:20", sender: "contact" },
        { id: 2, text: "Estoy buscando una solución de software para mi empresa", timestamp: "14:21", sender: "contact" },
        { id: 3, text: "¡Hola! Buenos días, ¿en qué podemos ayudarte?", timestamp: "14:22", sender: "business" },
        { id: 4, text: "Perfecto, tenemos varias opciones. ¿Qué tipo de empresa es?", timestamp: "14:23", sender: "business" },
        { id: 5, text: "Somos una empresa de logística con 50 empleados", timestamp: "14:24", sender: "contact" },
        { id: 6, text: "Excelente, tenemos el software perfecto para logística. Le envío un catálogo", timestamp: "14:25", sender: "business" },
        { id: 7, text: "¿Podrían enviarme más información sobre los productos?", timestamp: "14:26", sender: "contact" }
      ]
    },
    {
      id: 2,
      name: "Carlos Ruiz",
      lastMessage: "Perfecto, muchas gracias por...",
      timestamp: "15m",
      unreadCount: 0,
      avatar: "C",
      phone: "+34 677 234 567",
      isOnline: false,
      messages: []
    },
    {
      id: 3,
      name: "Laura Martín",
      lastMessage: "Me interesa el paquete premium",
      timestamp: "35m",
      unreadCount: 1,
      avatar: "L",
      phone: "+34 688 345 678",
      isOnline: true,
      messages: []
    },
    {
      id: 4,
      name: "Roberto Silva",
      lastMessage: "¿Tienen soporte 24/7?",
      timestamp: "1h",
      unreadCount: 0,
      avatar: "R",
      phone: "+34 699 456 789",
      isOnline: false,
      messages: []
    },
    {
      id: 5,
      name: "Ana Fernández",
      lastMessage: "Si, por favor envíenme la prop...",
      timestamp: "2h",
      unreadCount: 1,
      avatar: "A",
      phone: "+34 687 567 890",
      isOnline: true,
      messages: []
    },
    {
      id: 6,
      name: "Miguel Torres",
      lastMessage: "Mañana a las 10:00 está perf...",
      timestamp: "3h",
      unreadCount: 0,
      avatar: "M",
      phone: "+34 676 678 901",
      isOnline: false,
      messages: []
    },
    {
      id: 7,
      name: "Elena Rojas",
      lastMessage: "¿Hay descuento por volumen?",
      timestamp: "4h",
      unreadCount: 1,
      avatar: "E",
      phone: "+34 665 789 012",
      isOnline: true,
      messages: []
    }
  ];

  const filteredChats = whatsappChats.filter(chat =>
    chat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    chat.phone.includes(searchTerm)
  );

  const handleSendMessage = () => {
    if (newMessage.trim()) {
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

  // Seleccionar el primer chat por defecto
  React.useEffect(() => {
    if (!selectedChat && whatsappChats.length > 0) {
      setSelectedChat(whatsappChats[0]);
    }
  }, []);

  return (
    <div className="flex flex-col h-screen bg-[#f0f2f5]">
      {/* Primera franja negra con texto rojo */}
      <div className="bg-black text-red-500 px-4 py-2 text-center text-sm font-bold">
        WHATSAPP DEMO - SIMULACIÓN COMPLETA
      </div>
      
      {/* Segunda franja negra con botones */}
      <div className="bg-black text-white px-4 py-2 flex justify-center items-center gap-6">
        <Button 
          variant="outline" 
          size="sm" 
          className="bg-transparent border-white text-white hover:bg-white hover:text-black text-xs"
        >
          Agregar Agente
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="bg-transparent border-white text-white hover:bg-white hover:text-black text-xs"
        >
          Traducción de Mensaje
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="bg-transparent border-white text-white hover:bg-white hover:text-black text-xs"
        >
          Comentarios
        </Button>
      </div>
      
      {/* Contenedor principal */}
      <div className="flex flex-1 bg-[#f0f2f5]">
        {/* Panel izquierdo - Lista de chats */}
        <div className="w-[400px] bg-white border-r border-[#e9edef] flex flex-col">
        {/* Header del panel izquierdo */}
        <div className="px-4 py-[10px] bg-[#f0f2f5] border-b border-[#e9edef]">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-[19px] font-medium text-[#3b4a54]">WhatsApp Business Demo</h1>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-[#667781]">10 chats activos</span>
              </div>
            </div>
          </div>
          
          {/* Barra de búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#8696a0] h-4 w-4" />
            <Input
              placeholder="Buscar chats..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-[#f0f2f5] border-[#e9edef] text-[#3b4a54] placeholder:text-[#8696a0] rounded-lg h-9"
            />
          </div>
        </div>

        {/* Lista de chats */}
        <div className="flex-1 overflow-y-auto bg-white">
          {filteredChats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => setSelectedChat(chat)}
              className={`px-3 py-3 border-b border-[#e9edef] cursor-pointer hover:bg-[#f5f6f6] transition-colors ${
                selectedChat?.id === chat.id ? 'bg-[#e7f3ff]' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="h-[49px] w-[49px]">
                    <AvatarFallback className="bg-[#00a884] text-white font-medium text-lg">
                      {chat.avatar}
                    </AvatarFallback>
                  </Avatar>
                  {chat.isOnline && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#00a884] rounded-full border-2 border-white"></div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-[2px]">
                    <h3 className="font-normal text-[17px] text-[#111b21] truncate">
                      {chat.name}
                    </h3>
                    <span className="text-xs text-[#667781] min-w-fit">
                      {chat.timestamp}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[14px] text-[#667781] truncate flex-1 mr-2 leading-[1.3]">
                      {chat.lastMessage}
                    </p>
                    {chat.unreadCount > 0 && (
                      <div className="bg-[#00a884] text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center font-medium">
                        {chat.unreadCount}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-[#8696a0] mt-[1px]">{chat.phone}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Panel derecho - Chat activo */}
      <div className="flex-1 flex flex-col bg-[#efeae2]">
        {selectedChat ? (
          <>
            {/* Header del chat */}
            <div className="bg-[#f0f2f5] border-b border-[#e9edef] px-4 py-[10px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-[39px] w-[39px]">
                    <AvatarFallback className="bg-[#00a884] text-white font-medium">
                      {selectedChat.avatar}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="font-medium text-[18px] text-[#111b21]">
                      {selectedChat.name}
                    </h2>
                    <p className="text-[13px] text-[#667781]">
                      En línea
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="text-[#54656f] hover:bg-[#f5f6f6] h-10 w-10 p-0">
                    <Phone className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-[#54656f] hover:bg-[#f5f6f6] h-10 w-10 p-0">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Área de mensajes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {selectedChat.messages && selectedChat.messages.length > 0 ? (
                selectedChat.messages.map((message: any) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === 'business' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[65%] px-3 py-2 rounded-lg ${
                        message.sender === 'business'
                          ? 'bg-[#d9fdd3] text-[#111b21] rounded-br-none shadow-sm'
                          : 'bg-white text-[#111b21] rounded-bl-none shadow-sm'
                      }`}
                    >
                      <p className="text-[14px] leading-[1.4] break-words">{message.text}</p>
                      <p className={`text-[11px] mt-1 text-right ${
                        message.sender === 'business' ? 'text-[#667781]' : 'text-[#667781]'
                      }`}>
                        {message.timestamp}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-[#667781] mt-8">
                  <p>No hay mensajes en esta conversación</p>
                  <p className="text-sm mt-1">Escribe un mensaje para comenzar</p>
                </div>
              )}
            </div>

            {/* Input para escribir mensaje */}
            <div className="bg-[#f0f2f5] border-t border-[#e9edef] px-4 py-[10px]">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="text-[#54656f] hover:bg-[#f5f6f6] h-10 w-10 p-0">
                  <Paperclip className="h-5 w-5" />
                </Button>
                <div className="flex-1 relative">
                  <Input
                    placeholder="Escribe un mensaje..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="bg-white border-[#e9edef] text-[#111b21] placeholder:text-[#8696a0] rounded-lg pr-10 h-10"
                  />
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 text-[#54656f] hover:bg-[#f5f6f6] h-8 w-8 p-0"
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                </div>
                <Button 
                  onClick={handleSendMessage}
                  className="bg-[#00a884] hover:bg-[#00926c] text-white h-10 w-10 p-0"
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
              <div className="w-16 h-16 bg-[#d1d7db] rounded-full flex items-center justify-center mb-4 mx-auto">
                <Phone className="h-8 w-8 text-[#8696a0]" />
              </div>
              <h3 className="text-lg font-medium text-[#41525d] mb-2">Selecciona un chat</h3>
              <p className="text-[#667781]">Elige una conversación para comenzar a chatear</p>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}