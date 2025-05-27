import React from "react";
import { Helmet } from "react-helmet";
import { WhatsAppSimple } from "@/components/messaging/WhatsAppSimple";

export default function Messages() {
  return (
    <>
      <Helmet>
        <title>WhatsApp | GeminiCRM</title>
        <meta name="description" content="Comunícate con tus clientes a través de WhatsApp directamente desde tu CRM" />
      </Helmet>

      {/* Tu interfaz original de WhatsApp */}
      <div className="w-full h-screen overflow-hidden">
        <WhatsAppSimple />
      </div>
    </>
  );
}
