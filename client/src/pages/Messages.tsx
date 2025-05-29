import React from "react";
import { Helmet } from "react-helmet";
import { WhatsAppTwoColumn } from "@/components/messaging/WhatsAppTwoColumn";

export default function Messages() {
  return (
    <>
      <Helmet>
        <title>WhatsApp | GeminiCRM</title>
        <meta name="description" content="Comunícate con tus clientes a través de WhatsApp directamente desde tu CRM" />
      </Helmet>

      {/* Interfaz de WhatsApp con diseño de dos columnas */}
      <div className="w-full h-screen overflow-hidden">
        <WhatsAppTwoColumn />
      </div>
    </>
  );
}
