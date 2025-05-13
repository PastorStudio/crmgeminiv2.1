import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Message, Lead } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useGemini } from "@/hooks/useGemini";

interface WhatsAppInterfaceProps {
  leadId?: number;
}

export default function WhatsAppInterface({ leadId }: WhatsAppInterfaceProps) {
  const [inputValue, setInputValue] = useState("");
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { generateMessage, isLoading: isGenerating } = useGemini();
  
  interface WhatsAppStatus {
    initialized: boolean;
    ready: boolean;
    authenticated: boolean;
  }
  
  interface QRCodeResponse {
    data: string;
  }
  
  // Consultar estado de WhatsApp
  const { 
    data: whatsappStatus, 
    isLoading: statusLoading,
  } = useQuery<WhatsAppStatus>({
    queryKey: ["/api/integrations/whatsapp/status"],
    refetchInterval: 10000, // Recargar cada 10 segundos
  });
  
  // Consultar código QR si no está autenticado
  const { 
    data: qrCode,
    isLoading: qrLoading,
  } = useQuery<QRCodeResponse>({
    queryKey: ["/api/integrations/whatsapp/qrcode"],
    enabled: !!whatsappStatus && !whatsappStatus.authenticated && !whatsappStatus.ready,
    refetchInterval: !!whatsappStatus && !whatsappStatus.authenticated && !whatsappStatus.ready ? 5000 : false,
  });
  
  // Fetch messages for the selected lead
  const { 
    data: messages, 
    isLoading: messagesLoading 
  } = useQuery<Message[]>({
    queryKey: ["/api/messages", { leadId, channel: "whatsapp" }],
    enabled: !!leadId
  });
  
  // Fetch lead information
  const { 
    data: lead,
    isLoading: leadLoading
  } = useQuery<Lead>({
    queryKey: [`/api/leads/${leadId}`],
    enabled: !!leadId
  });
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  // Mutación para enviar mensaje por WhatsApp
  const { mutate: sendWhatsAppMessage, isPending: isSending } = useMutation({
    mutationFn: async (content: string) => {
      if (!leadId || !lead) throw new Error("No lead selected");
      
      // Verificar que el lead tenga un número de teléfono para WhatsApp
      const phone = lead.whatsappPhone || lead.phone;
      if (!phone) throw new Error("Lead doesn't have a phone number for WhatsApp");
      
      const messageData = {
        phone,
        message: content,
        leadId
      };
      
      return apiRequest("POST", "/api/integrations/whatsapp/send", messageData);
    },
    onSuccess: () => {
      setInputValue("");
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      toast({
        title: "Message sent",
        description: "Your WhatsApp message has been sent successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to send message: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Mutación para reiniciar WhatsApp
  const { mutate: restartWhatsApp, isPending: isRestarting } = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/integrations/whatsapp/restart");
    },
    onSuccess: () => {
      toast({
        title: "WhatsApp connection restarted",
        description: "Please scan the QR code with your phone",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/whatsapp/qrcode"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to restart WhatsApp: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Handle sending a message
  const handleSendMessage = () => {
    const content = inputValue.trim();
    if (!content || isSending) return;
    sendWhatsAppMessage(content);
  };
  
  // Handle pressing Enter in the input field
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };
  
  // Handle generating a message with AI
  const handleGenerateMessage = async () => {
    if (!leadId) return;
    
    try {
      const generatedContent = await generateMessage(leadId, "follow-up");
      setInputValue(generatedContent);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to generate message",
        variant: "destructive",
      });
    }
  };
  
  // Format timestamp for display
  const formatMessageTime = (timestamp?: Date | string | null) => {
    if (!timestamp) return "";
    
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } catch (error) {
      return "";
    }
  };
  
  // Renderizar la pantalla de QR code si no está autenticado
  if (whatsappStatus && !whatsappStatus?.authenticated && !whatsappStatus?.ready) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 bg-green-50">
        <div className="mb-4 text-center">
          <h2 className="text-2xl font-bold text-green-600 mb-2">WhatsApp Web</h2>
          <p className="text-gray-600 mb-6">Para usar WhatsApp en tu CRM:</p>
          
          <div className="bg-white p-6 rounded-lg shadow-md text-left">
            <ol className="list-decimal list-inside space-y-2 mb-4">
              <li className="text-gray-700">Abre WhatsApp en tu teléfono</li>
              <li className="text-gray-700">Toca <span className="font-medium">Menú</span> o <span className="font-medium">Configuración</span> y selecciona <span className="font-medium">Dispositivos vinculados</span></li>
              <li className="text-gray-700">Toca <span className="font-medium">Vincular un dispositivo</span></li>
              <li className="text-gray-700">Apunta tu teléfono hacia esta pantalla para escanear el código QR</li>
            </ol>
          </div>
        </div>
        
        {qrLoading ? (
          <div className="animate-pulse w-64 h-64 bg-gray-200 flex items-center justify-center">
            <span className="material-icons text-gray-400 text-4xl">qr_code_scanner</span>
          </div>
        ) : qrCode ? (
          <div className="border-8 border-white bg-white rounded-lg shadow-lg p-4">
            <img 
              src={qrCode.data} 
              alt="WhatsApp QR Code" 
              className="w-64 h-64"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <p className="text-red-500 mb-4">No se pudo generar el código QR</p>
            <Button 
              onClick={() => restartWhatsApp()}
              disabled={isRestarting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isRestarting ? (
                <span className="material-icons animate-spin mr-2">refresh</span>
              ) : (
                <span className="material-icons mr-2">refresh</span>
              )}
              Reintentar
            </Button>
          </div>
        )}
      </div>
    );
  }
  
  // Back to chat list function for mobile
  const handleBackToList = () => {
    if (leadId) {
      // Create a new Event and dispatch it
      const event = new CustomEvent('backToChats', { bubbles: true });
      document.dispatchEvent(event);
    }
  };

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center p-3 bg-green-600 text-white">
        <div className="flex-1 flex items-center">
          {lead ? (
            <>
              <button 
                onClick={handleBackToList}
                className="md:hidden w-9 h-9 rounded-full flex items-center justify-center mr-1 hover:bg-white/20"
              >
                <span className="material-icons text-white">arrow_back</span>
              </button>
              <div className="w-10 h-10 bg-white/30 rounded-full flex items-center justify-center mr-3">
                <span className="material-icons text-white">person</span>
              </div>
              <div>
                <h3 className="font-medium">{lead.fullName}</h3>
                <p className="text-xs text-white/80">
                  {lead.phone || lead.whatsappPhone || "No phone number"}
                </p>
              </div>
            </>
          ) : (
            <p>Select a lead to start messaging</p>
          )}
        </div>
        <div className="flex gap-2">
          <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/20">
            <span className="material-icons text-white">search</span>
          </button>
          <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/20">
            <span className="material-icons text-white">more_vert</span>
          </button>
        </div>
      </div>
      
      {/* Chat area */}
      <div className="flex-1 bg-[#e5ded8] p-4 overflow-y-auto">
        <ScrollArea className="h-full pr-2">
          {!leadId ? (
            <div className="h-full flex items-center justify-center text-gray-500">
              Select a lead to start messaging
            </div>
          ) : messagesLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div 
                  key={i} 
                  className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
                >
                  <div className="animate-pulse flex flex-col max-w-xs">
                    <div className={`h-8 w-32 ${i % 2 === 0 ? "bg-white" : "bg-green-100"} rounded-lg mb-1`}></div>
                    <div className="h-3 w-16 bg-white/50 rounded self-end"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : messages && messages.length > 0 ? (
            <div className="space-y-4">
              {messages
                .filter(msg => msg.channel === "whatsapp")
                .map((message) => (
                  <div 
                    key={message.id} 
                    className={`flex ${message.direction === "outgoing" ? "justify-end" : "justify-start"}`}
                  >
                    <div 
                      className={`py-2 px-3 rounded-lg max-w-xs ${
                        message.direction === "outgoing" 
                          ? "bg-[#dcf8c6] rounded-tr-none" 
                          : "bg-white rounded-tl-none"
                      }`}
                    >
                      <p className="text-sm text-gray-800">{message.content}</p>
                      <p className="text-[10px] text-gray-500 text-right mt-1 flex justify-end items-center">
                        {formatMessageTime(message.sentAt)}
                        {message.direction === "outgoing" && (
                          <span className="material-icons text-[12px] ml-1 text-green-600">
                            {message.read ? "done_all" : "done"}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mb-4">
                <span className="material-icons text-gray-400 text-xl">chat</span>
              </div>
              <p className="font-medium">No messages yet</p>
              <p className="text-sm">Start a conversation with {lead?.fullName}</p>
            </div>
          )}
        </ScrollArea>
      </div>
      
      {/* Input area */}
      <div className="p-2 bg-[#f0f2f5] flex items-end">
        <div className="flex items-center gap-2 w-full">
          <button className="w-10 h-10 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200">
            <span className="material-icons">emoji_emotions</span>
          </button>
          <button className="w-10 h-10 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-200">
            <span className="material-icons">attach_file</span>
          </button>
          <div className="flex-1 bg-white rounded-lg flex items-center overflow-hidden pl-4">
            <Input 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message"
              disabled={isSending || isGenerating || !leadId}
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-gray-500"
            />
            <button 
              onClick={handleGenerateMessage}
              disabled={isGenerating || !leadId}
              className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100"
            >
              {isGenerating ? (
                <span className="material-icons animate-spin">refresh</span>
              ) : (
                <span className="material-icons">auto_awesome</span>
              )}
            </button>
          </div>
          <button 
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isSending || !leadId}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-green-600 text-white hover:bg-green-700"
          >
            {isSending ? (
              <span className="material-icons animate-spin">refresh</span>
            ) : inputValue.trim() ? (
              <span className="material-icons">send</span>
            ) : (
              <span className="material-icons">mic</span>
            )}
          </button>
        </div>
      </div>
    </Card>
  );
}