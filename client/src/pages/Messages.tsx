import React from "react";
import { Helmet } from "react-helmet";
import { RealWhatsAppChats } from "@/components/messaging/RealWhatsAppChats";

export default function Messages() {
  return (
    <>
      <Helmet>
        <title>WhatsApp | GeminiCRM</title>
        <meta name="description" content="Comunícate con tus clientes a través de WhatsApp directamente desde tu CRM" />
      </Helmet>

      {/* Nueva interfaz de WhatsApp completamente reescrita */}
      <div className="w-full h-screen flex p-0 m-0 overflow-hidden">
        <RealWhatsAppChats />
      </div>
    </>
  );
}
