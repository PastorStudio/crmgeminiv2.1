import React from 'react';
import { WhatsAppTwoColumnClean } from '@/components/messaging/WhatsAppTwoColumnClean';

export function UIDemo() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Mejoras de Interfaz WhatsApp</h1>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-blue-800 mb-2">✅ Cambios Implementados:</h3>
          <ul className="text-blue-700 space-y-1 text-sm">
            <li>• <strong>Removido prefijo "Agente:"</strong> - Ahora solo muestra el nombre del agente directamente</li>
            <li>• <strong>Burbujas limitadas al 80%</strong> - Las burbujas de mensajes (verdes y azules) tienen mejor proporción</li>
            <li>• <strong>Iconos de comentarios condicionales</strong> - Solo aparecen cuando realmente hay comentarios</li>
            <li>• <strong>Iconos de tickets condicionales</strong> - Solo aparecen cuando hay tickets/categorías asignadas</li>
          </ul>
        </div>
      </div>
      
      <WhatsAppTwoColumnClean />
    </div>
  );
}