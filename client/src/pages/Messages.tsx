import { useState } from "react";
import { Helmet } from "react-helmet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WhatsAppInterface } from "@/components/messaging/WhatsAppInterface";
import { MessageSquare, Smartphone, Send, BrainCircuit } from "lucide-react";

export default function Messages() {
  const [selectedLeadId, setSelectedLeadId] = useState<number | undefined>(undefined);
  const [activeTab, setActiveTab] = useState("whatsapp");

  return (
    <>
      <Helmet>
        <title>Sistema de Mensajería | GeminiCRM</title>
        <meta name="description" content="Comunícate con tus clientes a través de WhatsApp y Telegram directamente desde tu CRM" />
      </Helmet>

      <div className="mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-green-400 bg-clip-text text-transparent">
          Sistema de Mensajería
        </h1>
        <p className="text-gray-500 mt-1">
          Comunícate con tus clientes a través de múltiples canales sin salir del CRM
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 w-[400px] mb-6">
          <TabsTrigger value="whatsapp" className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" /> WhatsApp
          </TabsTrigger>
          <TabsTrigger value="telegram" className="flex items-center gap-2">
            <Send className="h-4 w-4" /> Telegram
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="whatsapp" className="mt-0">
          <div className="flex flex-col">
            <WhatsAppInterface selectedLeadId={selectedLeadId} onSelectLead={setSelectedLeadId} />
          </div>
        </TabsContent>
        
        <TabsContent value="telegram" className="mt-0">
          <Card className="border-2 border-dashed p-8">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="rounded-full bg-primary-50 p-3">
                <Send className="h-8 w-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-medium">Integración con Telegram</h3>
              <p className="text-gray-500 max-w-md">
                La integración con Telegram está en desarrollo y estará disponible próximamente.
                Podrás comunicarte con tus clientes usando el bot oficial de tu negocio.
              </p>
              <Button variant="outline" className="mt-4" disabled>
                <BrainCircuit className="mr-2 h-4 w-4" />
                Próximamente
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
