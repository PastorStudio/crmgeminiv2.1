import React from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function DirectAccess() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Acceso Directo a Funcionalidades</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Tarjeta para Todas las Cuentas */}
        <Card className="shadow-lg border-2 border-blue-100">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardTitle className="text-xl font-bold text-blue-800">Todas las Cuentas</CardTitle>
            <CardDescription>Gestión unificada de todas las cuentas de WhatsApp</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-gray-600 mb-4">
              Visualiza y gestiona los chats de todas tus cuentas de WhatsApp juntas, 
              organizadas por ID secuencial para mejor accesibilidad.
            </p>
            <ul className="list-disc pl-5 text-sm text-gray-500 mb-4">
              <li>Muestra chats ordenados por ID de cuenta</li>
              <li>Indicador visual del número de cuenta</li>
              <li>Envío de mensajes desde cualquier cuenta</li>
              <li>Vista unificada de toda la comunicación</li>
            </ul>
          </CardContent>
          <CardFooter className="flex justify-center bg-gradient-to-r from-blue-50 to-indigo-50 py-4">
            <Link href="/combined-whatsapp">
              <Button className="bg-blue-600 hover:bg-blue-700">
                Acceder a Todas las Cuentas
              </Button>
            </Link>
          </CardFooter>
        </Card>
        
        {/* Tarjeta para Cuentas WhatsApp */}
        <Card className="shadow-lg border-2 border-green-100">
          <CardHeader className="bg-gradient-to-r from-green-50 to-teal-50">
            <CardTitle className="text-xl font-bold text-green-800">Cuentas WhatsApp</CardTitle>
            <CardDescription>Gestión de cuentas individuales</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-gray-600 mb-4">
              Administra tus cuentas de WhatsApp de forma individual, 
              conecta nuevas cuentas y gestiona las existentes.
            </p>
            <ul className="list-disc pl-5 text-sm text-gray-500 mb-4">
              <li>Conexión mediante código QR</li>
              <li>Asignación de nombres descriptivos</li>
              <li>Gestión de sesiones activas</li>
              <li>IDs secuenciales del 1 al 10</li>
            </ul>
          </CardContent>
          <CardFooter className="flex justify-center bg-gradient-to-r from-green-50 to-teal-50 py-4">
            <Link href="/whatsapp-accounts">
              <Button className="bg-green-600 hover:bg-green-700">
                Gestionar Cuentas
              </Button>
            </Link>
          </CardFooter>
        </Card>
        
        {/* Tarjeta para WhatsApp Simple */}
        <Card className="shadow-lg border-2 border-purple-100">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
            <CardTitle className="text-xl font-bold text-purple-800">Chat Simple</CardTitle>
            <CardDescription>Interfaz de chat simplificada</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-gray-600 mb-4">
              Una versión simplificada de la interfaz de chat de WhatsApp,
              enfocada en la comunicación directa con tus contactos.
            </p>
            <ul className="list-disc pl-5 text-sm text-gray-500 mb-4">
              <li>Interfaz minimalista</li>
              <li>Carga rápida de mensajes</li>
              <li>Enfoque en la conversación</li>
              <li>Ideal para atención al cliente</li>
            </ul>
          </CardContent>
          <CardFooter className="flex justify-center bg-gradient-to-r from-purple-50 to-pink-50 py-4">
            <Link href="/ultra-whatsapp">
              <Button className="bg-purple-600 hover:bg-purple-700">
                Abrir Chat Simple
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}