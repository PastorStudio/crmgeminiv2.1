import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Search, Phone, MoreVertical, Send, Paperclip, Smile, Users, Languages, MessageSquare, MessageCircle } from "lucide-react";
import { apiRequest } from '@/lib/queryClient';

export default function WhatsAppInterface() {
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAgentDialog, setShowAgentDialog] = useState(false);
  const [showTranslationDialog, setShowTranslationDialog] = useState(false);
  const [showCommentsDialog, setShowCommentsDialog] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [translationText, setTranslationText] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("es");
  const [translatedText, setTranslatedText] = useState("");
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<any[]>([]);

  // Obtener agentes reales del sistema
  const { data: agents } = useQuery({
    queryKey: ['/api/internal-agents'],
    queryFn: () => apiRequest('/api/internal-agents')
  });

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

  // Función para asignar agente
  const handleAssignAgent = () => {
    if (selectedAgent && selectedChat) {
      console.log(`Agente ${selectedAgent} asignado al chat ${selectedChat.name}`);
      setShowAgentDialog(false);
      setSelectedAgent("");
    }
  };

  // Función para traducir burbujas de mensajes
  const handleTranslateMessage = async (messageText: string, messageType: 'sent' | 'received') => {
    try {
      const response = await apiRequest('/api/translate-message', {
        method: 'POST',
        body: {
          text: messageText,
          targetLanguage: targetLanguage,
          messageType: messageType
        }
      });
      
      if (response.translatedText) {
        setTranslatedText(response.translatedText);
      }
    } catch (error) {
      console.error('Error translating message:', error);
      setTranslatedText("Error en la traducción. Verifica la configuración del servicio.");
    }
  };

  // Función para traducir texto manual
  const handleTranslateText = async () => {
    if (translationText.trim()) {
      await handleTranslateMessage(translationText, 'sent');
    }
  };

  // Función para agregar comentario
  const handleAddComment = () => {
    if (commentText.trim() && selectedChat) {
      const newComment = {
        id: Date.now(),
        text: commentText,
        author: "Agente Actual",
        timestamp: new Date().toLocaleTimeString(),
        chatId: selectedChat.id
      };
      setComments([...comments, newComment]);
      setCommentText("");
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
        {/* Botón Agregar Agente */}
        <Dialog open={showAgentDialog} onOpenChange={setShowAgentDialog}>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-transparent border-white text-white hover:bg-white hover:text-black text-xs flex items-center gap-1"
            >
              <Users className="h-3 w-3" />
              Agregar Agente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Asignar Agente al Chat</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Chat seleccionado:</label>
                <p className="text-sm text-gray-600">{selectedChat?.name || "Ningún chat seleccionado"}</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Seleccionar Agente:</label>
                <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un agente" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents && Array.isArray(agents) ? (
                      agents.map((agent: any) => (
                        <SelectItem key={agent.id} value={agent.id.toString()}>
                          {agent.name} - {agent.role || 'Agente'}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-agents">No hay agentes disponibles</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowAgentDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleAssignAgent} disabled={!selectedAgent}>
                  Asignar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Botón Traducción */}
        <Dialog open={showTranslationDialog} onOpenChange={setShowTranslationDialog}>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-transparent border-white text-white hover:bg-white hover:text-black text-xs flex items-center gap-1"
            >
              <Languages className="h-3 w-3" />
              Traducción de Mensaje
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Traducir Mensaje</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <h4 className="font-medium text-sm mb-2">Opciones de Traducción:</h4>
                <div className="text-xs text-gray-600 space-y-1">
                  <p>• <span className="font-medium">Burbujas Azules</span>: Mensajes enviados por tu empresa</p>
                  <p>• <span className="font-medium">Burbujas Verdes</span>: Mensajes recibidos de clientes</p>
                  <p>• Haz clic en el ícono de traducción en cualquier burbuja para traducir directamente</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Texto a traducir:</label>
                <Textarea
                  placeholder="Escribe o pega el texto que deseas traducir..."
                  value={translationText}
                  onChange={(e) => setTranslationText(e.target.value)}
                  rows={3}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Idioma destino:</label>
                <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="en">Inglés</SelectItem>
                    <SelectItem value="fr">Francés</SelectItem>
                    <SelectItem value="de">Alemán</SelectItem>
                    <SelectItem value="pt">Portugués</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {translatedText && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <label className="text-sm font-medium mb-1 block">Traducción:</label>
                  <p className="text-sm">{translatedText}</p>
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => {
                  setShowTranslationDialog(false);
                  setTranslationText("");
                  setTranslatedText("");
                }}>
                  Cerrar
                </Button>
                <Button onClick={handleTranslateText} disabled={!translationText.trim()}>
                  Traducir
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Botón Comentarios */}
        <Dialog open={showCommentsDialog} onOpenChange={setShowCommentsDialog}>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-transparent border-white text-white hover:bg-white hover:text-black text-xs flex items-center gap-1"
            >
              <MessageSquare className="h-3 w-3" />
              Comentarios
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Comentarios del Chat</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Chat:</label>
                <p className="text-sm text-gray-600">{selectedChat?.name || "Ningún chat seleccionado"}</p>
              </div>
              
              {/* Lista de comentarios */}
              <div className="max-h-40 overflow-y-auto space-y-2">
                {comments.filter(c => c.chatId === selectedChat?.id).length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No hay comentarios aún</p>
                ) : (
                  comments.filter(c => c.chatId === selectedChat?.id).map(comment => (
                    <div key={comment.id} className="bg-gray-50 p-2 rounded">
                      <div className="flex justify-between items-start mb-1">
                        <Badge variant="secondary" className="text-xs">{comment.author}</Badge>
                        <span className="text-xs text-gray-500">{comment.timestamp}</span>
                      </div>
                      <p className="text-sm">{comment.text}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Agregar nuevo comentario */}
              <div>
                <label className="text-sm font-medium mb-2 block">Agregar comentario:</label>
                <Textarea
                  placeholder="Escribe tu comentario..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => {
                  setShowCommentsDialog(false);
                  setCommentText("");
                }}>
                  Cerrar
                </Button>
                <Button onClick={handleAddComment} disabled={!commentText.trim()}>
                  Agregar Comentario
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
                    <div className="flex items-center gap-1">
                      {chat.unreadCount > 0 && (
                        <div className="bg-[#00a884] text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center font-medium">
                          {chat.unreadCount}
                        </div>
                      )}
                      {comments.filter(c => c.chatId === chat.id).length > 0 && (
                        <div className="bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
                          <MessageCircle className="h-2 w-2" />
                        </div>
                      )}
                    </div>
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
                    <div className="group relative">
                      <div
                        className={`max-w-[65%] px-3 py-2 rounded-lg ${
                          message.sender === 'business'
                            ? 'bg-[#005c4b] text-white rounded-br-none shadow-sm'
                            : 'bg-white text-[#111b21] rounded-bl-none shadow-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[14px] leading-[1.4] break-words flex-1">{message.text}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 ${
                              message.sender === 'business' ? 'text-white hover:bg-white/20' : 'text-gray-600 hover:bg-gray-100'
                            }`}
                            onClick={() => {
                              setTranslationText(message.text);
                              setShowTranslationDialog(true);
                              handleTranslateMessage(message.text, message.sender === 'business' ? 'sent' : 'received');
                            }}
                          >
                            <Languages className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className={`text-[11px] mt-1 text-right ${
                          message.sender === 'business' ? 'text-white/70' : 'text-[#667781]'
                        }`}>
                          {message.timestamp}
                        </p>
                      </div>
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