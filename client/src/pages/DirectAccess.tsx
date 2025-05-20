import React from 'react';
import { Link } from 'wouter';

const DirectAccess = () => {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Acceso Directo a Funcionalidades</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Tarjetas de Acceso */}
        <Card 
          title="WhatsApp: Todas las Cuentas" 
          description="Vista unificada que muestra los chats de todas las cuentas conectadas"
          url="/combined-whatsapp"
          primaryColor="bg-green-600"
        />
        
        <Card 
          title="Gestión de Cuentas" 
          description="Administrar todas las cuentas de WhatsApp registradas"
          url="/whatsapp-accounts"
          primaryColor="bg-blue-600"
        />
        
        <Card 
          title="Chat Simple" 
          description="Interfaz simplificada de chat de WhatsApp"
          url="/simple-whatsapp"
          primaryColor="bg-purple-600"
        />
        
        <Card 
          title="Demo Simple" 
          description="Versión de demostración simplificada"
          url="/simple-whatsapp-demo"
          primaryColor="bg-indigo-600"
        />
        
        <Card 
          title="WhatsApp Manager" 
          description="Administración avanzada de cuentas y mensajes"
          url="/whatsapp-manager"
          primaryColor="bg-teal-600"
        />
        
        <Card 
          title="Chat Ultra Simple" 
          description="Versión minimalista de chat de WhatsApp"
          url="/ultra-simple-chat"
          primaryColor="bg-cyan-600"
        />
      </div>
    </div>
  );
};

// Componente Card reutilizable
const Card = ({ title, description, url, primaryColor }: { 
  title: string; 
  description: string; 
  url: string;
  primaryColor: string;
}) => {
  return (
    <div className="border rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <div className={`${primaryColor} text-white p-4 rounded-t-lg`}>
        <h3 className="font-bold text-xl">{title}</h3>
      </div>
      <div className="p-4">
        <p className="text-gray-600 mb-4">{description}</p>
        <Link href={url}>
          <a className={`${primaryColor} text-white px-4 py-2 rounded-md inline-block hover:opacity-90 transition-opacity`}>
            Acceder
          </a>
        </Link>
      </div>
    </div>
  );
};

export default DirectAccess;