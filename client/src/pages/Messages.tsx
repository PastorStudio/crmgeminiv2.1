import React, { useState } from "react";
import { Helmet } from "react-helmet";
import { WhatsAppCategorized } from "@/components/messaging/WhatsAppCategorized";

export default function Messages() {
  const [selectedAccounts] = useState<number[]>([1, 2]); // Default accounts

  return (
    <>
      <Helmet>
        <title>WhatsApp | GeminiCRM</title>
        <meta name="description" content="Comunícate con tus clientes a través de WhatsApp directamente desde tu CRM" />
      </Helmet>

      {/* Interfaz de WhatsApp con sistema de categorización */}
      <div className="w-full h-screen overflow-hidden">
        <WhatsAppCategorized selectedAccounts={selectedAccounts} />
      </div>
    </>
  );
}
