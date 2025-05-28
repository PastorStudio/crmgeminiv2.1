import React from 'react';
import { WhatsAppTwoColumnClean } from '@/components/messaging/WhatsAppTwoColumnClean';

export default function UIShowcase() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            🎨 Mejoras de Interfaz Implementadas
          </h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-800 mb-2">✅ Prefijo "Agente:" Removido</h3>
              <p className="text-green-700 text-sm">Ahora solo muestra el nombre del agente directamente (ej: "Smart Legal Bot")</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2">✅ Burbujas de Mensaje al 80%</h3>
              <p className="text-blue-700 text-sm">Las burbujas verdes y azules ahora tienen mejor proporción visual</p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="font-semibold text-purple-800 mb-2">✅ Iconos de Comentarios Condicionales</h3>
              <p className="text-purple-700 text-sm">Solo aparecen cuando realmente hay comentarios en el chat</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h3 className="font-semibold text-orange-800 mb-2">✅ Iconos de Tickets Condicionales</h3>
              <p className="text-orange-700 text-sm">Solo aparecen cuando hay tickets asignados al chat específico</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gray-800 text-white p-3">
            <h2 className="font-semibold">Vista Previa de la Interfaz Mejorada</h2>
          </div>
          <div className="h-screen">
            <WhatsAppTwoColumnClean />
          </div>
        </div>
      </div>
    </div>
  );
}