import React from 'react';
import { WhatsAppAllAccounts } from '../components/messaging/WhatsAppAllAccounts';

// Página que muestra todas las cuentas de WhatsApp juntas
const AllAccounts = () => {
  return (
    <div className="container mx-auto h-screen">
      <div className="flex flex-col h-full">
        <h1 className="text-2xl font-bold p-4">Todas las Cuentas WhatsApp</h1>
        <div className="flex-1">
          <WhatsAppAllAccounts />
        </div>
      </div>
    </div>
  );
};

export default AllAccounts;