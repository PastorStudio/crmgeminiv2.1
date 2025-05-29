import React from "react";
import { Helmet } from "react-helmet";
import WhatsAppInterface from "@/components/messaging/WhatsAppInterface";

export default function Messages() {
  return (
    <>
      <Helmet>
        <title>WhatsApp | GeminiCRM</title>
        <meta name="description" content="Comunícate con tus clientes a través de WhatsApp directamente desde tu CRM" />
      </Helmet>

      {/* Interfaz de WhatsApp con diseño idéntico a WhatsApp Web */}
      <div className="w-full h-screen">
        <WhatsAppInterface />
      </div>
    </>
  );
}
