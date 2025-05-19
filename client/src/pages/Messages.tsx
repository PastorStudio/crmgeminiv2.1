import { useState } from "react";
import { Helmet } from "react-helmet";
import { SimplifiedWhatsApp } from "@/components/messaging/SimplifiedWhatsApp";
import { WhatsAppUnifiedView } from "@/components/messaging/WhatsAppUnifiedView";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Smartphone } from "lucide-react";

export default function Messages() {
  const [selectedLeadId, setSelectedLeadId] = useState<number | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'single' | 'unified'>('single');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  const handleChatSelect = (chatId: string, accountId: number) => {
    setSelectedChatId(chatId);
    setSelectedAccountId(accountId);
    setViewMode('single'); // Cambiar a vista individual al seleccionar un chat
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === 'single' ? 'unified' : 'single');
  };

  return (
    <>
      <Helmet>
        <title>WhatsApp | GeminiCRM</title>
        <meta name="description" content="Comunícate con tus clientes a través de WhatsApp directamente desde tu CRM" />
      </Helmet>

      <div className="w-full h-screen flex flex-col p-0 m-0 overflow-hidden">
        {/* Header con botón para alternar vista */}
        <div className="p-2 border-b bg-white flex justify-between items-center">
          <h1 className="text-xl font-bold">WhatsApp {viewMode === 'unified' ? '- Vista Unificada' : ''}</h1>
          <Button 
            variant="outline"
            size="sm"
            onClick={toggleViewMode}
            className="flex items-center gap-2"
          >
            {viewMode === 'single' ? (
              <>
                <LayoutGrid className="h-4 w-4" />
                <span>Vista Unificada</span>
              </>
            ) : (
              <>
                <Smartphone className="h-4 w-4" />
                <span>Vista Individual</span>
              </>
            )}
          </Button>
        </div>

        {/* Contenido principal */}
        <div className="flex-1 overflow-hidden">
          {viewMode === 'unified' ? (
            <WhatsAppUnifiedView onSelectChat={handleChatSelect} />
          ) : (
            <SimplifiedWhatsApp 
              selectedLeadId={selectedLeadId} 
              onSelectLead={setSelectedLeadId}
              initialChatId={selectedChatId}
              initialAccountId={selectedAccountId}
            />
          )}
        </div>
      </div>
    </>
  );
}
