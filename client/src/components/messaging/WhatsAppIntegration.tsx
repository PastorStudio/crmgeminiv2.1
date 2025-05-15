import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { WhatsAppQRDisplay } from './WhatsAppQRDisplay';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Smartphone, RefreshCw, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WhatsAppStatus {
  initialized?: boolean;
  ready?: boolean;
  authenticated?: boolean;
  qrCode?: string;
  qrDataUrl?: string;
  error?: string;
}

export default function WhatsAppIntegration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5 segundos

  // Consulta para obtener el estado actual de WhatsApp
  const { data: status, isLoading, isError, error } = useQuery<WhatsAppStatus>({
    queryKey: ['/api/integrations/whatsapp/status'],
    queryFn: async () => {
      console.log('Solicitando estado de WhatsApp...');
      try {
        return await apiRequest('/api/integrations/whatsapp/status');
      } catch (error) {
        // Si hay un error de tipo "DOCTYPE is not valid JSON", probablemente es Vite interceptando
        if (error instanceof Error && error.message.includes('DOCTYPE')) {
          console.error('La respuesta parece ser HTML en lugar de JSON');
          // Devolvemos un estado con error para que el frontend pueda manejarlo
          return {
            initialized: true,
            ready: false,
            authenticated: false,
            error: 'Interceptado por Vite - intenta recargar la página'
          };
        }
        throw error;
      }
    },
    refetchInterval: status?.authenticated ? 30000 : refreshInterval, // Actualizar más rápido si no está autenticado
    initialData: { initialized: false, ready: false } // Datos iniciales para evitar errores de tipo
  });

  // Función para reiniciar el servicio de WhatsApp (genera un nuevo QR)
  const handleRefresh = async () => {
    try {
      // Intentamos diferentes enfoques para evitar la intercepción de Vite
      // 1. Fetch normal con timestamp
      const timestamp = Date.now();
      const response = await fetch(`/api/integrations/whatsapp/restart?_t=${timestamp}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      // Si la respuesta no es JSON, probablemente Vite la interceptó
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Respuesta HTML detectada (interceptada por Vite):', '/api/integrations/whatsapp/restart');
        
        // Intentar con XMLHttpRequest como fallback
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/integrations/whatsapp/restart?_t=${Date.now()}`);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onload = () => {
          if (xhr.status === 200) {
            // Verificar si es HTML (intercepción de Vite)
            if (xhr.responseText.includes('<!DOCTYPE html>')) {
              console.error('XHR también devolvió HTML:', `/api/integrations/whatsapp/restart?_t=${timestamp}`);
              toast({
                title: 'Error de servidor',
                description: 'No se pudo reiniciar WhatsApp. Intenta recargar la página.',
                variant: 'destructive'
              });
            } else {
              // Aquí podríamos tener éxito, pero es improbable en este punto
              queryClient.invalidateQueries({ queryKey: ['/api/integrations/whatsapp/status'] });
              toast({
                title: 'WhatsApp reiniciado',
                description: 'Servicio reiniciado. Escanea el nuevo código QR.',
              });
            }
          } else {
            toast({
              title: 'Error al reiniciar',
              description: 'No se pudo reiniciar el servicio de WhatsApp.',
              variant: 'destructive'
            });
          }
        };
        xhr.onerror = () => {
          toast({
            title: 'Error de conexión',
            description: 'No se pudo conectar al servidor.',
            variant: 'destructive'
          });
        };
        xhr.send();
        
        // Forzar una actualización de la consulta independientemente
        queryClient.invalidateQueries({ queryKey: ['/api/integrations/whatsapp/status'] });
        return;
      }

      // Si llegamos aquí, la respuesta fue JSON
      await response.json();
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/whatsapp/status'] });
      toast({
        title: 'WhatsApp reiniciado',
        description: 'Servicio reiniciado. Escanea el nuevo código QR.',
      });
    } catch (error) {
      console.error('Error al reiniciar WhatsApp:', error);
      toast({
        title: 'Error al reiniciar',
        description: 'No se pudo reiniciar el servicio de WhatsApp.',
        variant: 'destructive'
      });
    }
  };

  // Función para cerrar sesión de WhatsApp
  const handleLogout = async () => {
    try {
      await apiRequest('/api/integrations/whatsapp/logout', {
        method: 'POST'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations/whatsapp/status'] });
      toast({
        title: 'Sesión cerrada',
        description: 'Has cerrado sesión en WhatsApp.',
      });
    } catch (error) {
      console.error('Error al cerrar sesión de WhatsApp:', error);
      toast({
        title: 'Error al cerrar sesión',
        description: 'No se pudo cerrar la sesión de WhatsApp.',
        variant: 'destructive'
      });
    }
  };

  // Cuando el estado cambia a autenticado, mostrar notificación
  useEffect(() => {
    if (status?.authenticated) {
      // Si acaba de autenticar, mostrar notificación
      toast({
        title: 'WhatsApp conectado',
        description: 'Tu cuenta de WhatsApp está conectada exitosamente.',
        variant: 'default'
      });
      
      // Reducir la frecuencia de actualización cuando está autenticado
      setRefreshInterval(30000); // 30 segundos
    } else {
      // Mayor frecuencia cuando no está autenticado
      setRefreshInterval(5000); // 5 segundos
    }
  }, [status?.authenticated, toast]);

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center text-green-600">
          <Smartphone className="mr-2 h-6 w-6" />
          Conexión con WhatsApp
        </CardTitle>
        <CardDescription>
          Escanea el código QR con tu teléfono para conectar tu cuenta de WhatsApp al CRM.
          {status?.authenticated && (
            <span className="text-green-600 font-medium block mt-1">
              ¡Conexión establecida! Tu cuenta de WhatsApp está conectada.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="flex flex-col items-center">
          {/* Mostrar el estado de WhatsApp y el código QR */}
          <WhatsAppQRDisplay 
            status={status || { initialized: false }} 
            isLoading={isLoading} 
            onRefresh={handleRefresh}
          />
          
          {/* Mostrar botones adicionales cuando está autenticado */}
          {status?.authenticated && (
            <div className="mt-4 w-full flex flex-col gap-2">
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={handleRefresh}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refrescar estado
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full text-red-500 hover:text-red-700 hover:bg-red-50" 
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar sesión
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}