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

      <div className="absolute inset-0 flex">
        <WhatsAppSimple selectedLeadId={selectedLeadId} onSelectLead={setSelectedLeadId} />
      </div>
    </>
  );
}
