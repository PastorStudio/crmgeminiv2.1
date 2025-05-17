import { useState } from "react";
import { Helmet } from "react-helmet";
import { WhatsAppSimple } from "@/components/messaging/WhatsAppSimple";

export default function Messages() {
  const [selectedLeadId, setSelectedLeadId] = useState<number | undefined>(undefined);

  return (
    <>
      <Helmet>
        <title>WhatsApp | GeminiCRM</title>
        <meta name="description" content="Comunícate con tus clientes a través de WhatsApp directamente desde tu CRM" />
      </Helmet>

      <div className="absolute top-0 left-0 right-0 bottom-0 w-full h-full flex p-0 m-0 overflow-hidden">
        <WhatsAppSimple selectedLeadId={selectedLeadId} onSelectLead={setSelectedLeadId} />
      </div>
    </>
  );
}
