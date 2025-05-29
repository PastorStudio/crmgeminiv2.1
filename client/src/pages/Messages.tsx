import React from "react";
import { Helmet } from "react-helmet";
import { WhatsAppCategorized } from "@/components/messaging/WhatsAppCategorized";

export default function Messages() {
  return (
    <>
      <Helmet>
        <title>WhatsApp | GeminiCRM</title>
        <meta name="description" content="Comunícate con tus clientes a través de WhatsApp directamente desde tu CRM" />
      </Helmet>

      {/* Interfaz de WhatsApp con sistema de categorización */}
      <div className="w-full h-screen overflow-hidden">
        <WhatsAppCategorized />
      </div>
    </>
  );
}
