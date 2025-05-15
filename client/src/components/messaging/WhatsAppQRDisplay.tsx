import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface WhatsAppQRDisplayProps {
  status: {
    initialized?: boolean;
    ready?: boolean;
    authenticated?: boolean;
  };
  isLoading: boolean;
  onRefresh: () => void;
}

export function WhatsAppQRDisplay({ status, isLoading, onRefresh }: WhatsAppQRDisplayProps) {
  const { toast } = useToast();
  const [imgError, setImgError] = useState(false);
  const [timestamp, setTimestamp] = useState(new Date().getTime());

  // Refresh timestamp every 30 seconds to refresh the QR code
  useEffect(() => {
    const interval = setInterval(() => {
      setTimestamp(new Date().getTime());
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const handleImageError = () => {
    setImgError(true);
    console.error('Error cargando la imagen del código QR');
    toast({
      title: 'Error al cargar el código QR',
      description: 'No se pudo cargar la imagen del código QR. Intente recargar.',
      variant: 'destructive',
    });
  };

  const refreshQR = () => {
    setImgError(false);
    setTimestamp(new Date().getTime());
    onRefresh();
  };

  if (isLoading) {
    return (
      <div className="h-64 w-64 bg-gray-100 animate-pulse rounded-md flex items-center justify-center">
        <p className="text-gray-400">Generando código QR...</p>
      </div>
    );
  }

  if (status?.authenticated) {
    return (
      <div className="h-64 w-64 bg-green-50 border-2 border-green-500 rounded-md flex flex-col items-center justify-center p-4">
        <CheckCircle className="w-16 h-16 text-green-500 mb-3" />
        <p className="font-medium text-green-800 text-center">¡WhatsApp conectado correctamente!</p>
        <p className="text-sm text-green-600 text-center mt-2">La sesión está activa y lista para usarse</p>
      </div>
    );
  }

  if (status?.initialized && !status?.authenticated && !imgError) {
    return (
      <div className="border p-4 rounded-md bg-white flex flex-col items-center">
        <div className="relative">
          <img 
            src={`/api/integrations/whatsapp/qr-image?t=${timestamp}`}
            alt="Código QR de WhatsApp" 
            className="h-64 w-64"
            onError={handleImageError}
          />
          <div className="absolute top-2 right-2">
            <div className="px-2 py-1 bg-green-500 text-white text-xs font-bold rounded-md">
              QR OFICIAL
            </div>
          </div>
        </div>
        <div className="mt-2 px-3 py-1 bg-green-100 text-green-800 text-xs rounded-md">
          Escanea este código QR con la aplicación de WhatsApp en tu teléfono
        </div>
      </div>
    );
  }

  return (
    <div className="h-64 w-64 bg-gray-100 rounded-md flex flex-col items-center justify-center p-4">
      <AlertCircle className="w-12 h-12 text-amber-500 mb-3" />
      <p className="text-gray-600 text-center">No hay código QR disponible</p>
      <Button 
        variant="outline" 
        onClick={refreshQR}
        className="mt-4"
      >
        <RefreshCw className="mr-2 h-4 w-4" /> Generar código QR
      </Button>
    </div>
  );
}