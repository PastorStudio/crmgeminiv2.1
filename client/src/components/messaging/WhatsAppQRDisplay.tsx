import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface WhatsAppQRDisplayProps {
  status: {
    initialized?: boolean;
    ready?: boolean;
    authenticated?: boolean;
    qrCode?: string;
    error?: string;
  };
  isLoading: boolean;
  onRefresh: () => void;
}

export function WhatsAppQRDisplay({ status, isLoading, onRefresh }: WhatsAppQRDisplayProps) {
  const { toast } = useToast();
  const [imgError, setImgError] = useState(false);
  const [timestamp, setTimestamp] = useState(Date.now());
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  
  // Reiniciar el error de imagen cuando cambie el estado y generamos nuevo QR si es necesario
  useEffect(() => {
    setImgError(false);
    setTimestamp(Date.now());
    
    // Si el status.qrCode no es una dataURL, intentamos convertirlo a una
    if (status?.qrCode && !status.qrCode.startsWith('data:')) {
      try {
        console.log("Intentando generar QR en el cliente");
        // Importamos dinámicamente la librería qrcode
        import('qrcode').then(QRCode => {
          QRCode.toDataURL(status.qrCode!, {
            errorCorrectionLevel: 'H',
            margin: 1,
            scale: 8,
            color: {
              dark: '#128C7E',  // Color verde WhatsApp
              light: '#FFFFFF'  // Fondo blanco
            }
          }).then(url => {
            console.log("QR generado correctamente en el cliente");
            setQrDataUrl(url);
          }).catch(err => {
            console.error("Error al generar QR en el cliente:", err);
          });
        }).catch(err => {
          console.error("Error al importar qrcode:", err);
        });
      } catch (err) {
        console.error("Error intentando generar QR:", err);
      }
    } else if (status?.qrCode && status.qrCode.startsWith('data:')) {
      // Si ya es una dataURL, la usamos directamente
      setQrDataUrl(status.qrCode);
    }
  }, [status]);
  
  // Manejar errores al cargar la imagen
  const handleImageError = () => {
    console.error("Error al cargar la imagen QR");
    setImgError(true);
    
    toast({
      title: "Error al cargar código QR",
      description: "No se pudo cargar la imagen del código QR. Intenta refrescar la página.",
      variant: "destructive",
    });
  };
  
  // Estado de carga
  if (isLoading) {
    return (
      <div className="border p-4 rounded-md bg-white flex flex-col items-center">
        <div className="flex flex-col items-center justify-center h-64 w-64">
          <RefreshCw className="h-12 w-12 animate-spin text-gray-500" />
          <p className="mt-4 text-sm text-gray-500">Cargando estado de WhatsApp...</p>
        </div>
      </div>
    );
  }
  
  // Estado sin inicializar
  if (!status?.initialized) {
    return (
      <div className="border p-4 rounded-md bg-white flex flex-col items-center">
        <div className="flex flex-col items-center justify-center h-64 w-64">
          <AlertCircle className="h-12 w-12 text-gray-500" />
          <p className="mt-4 text-sm text-gray-600">Servicio de WhatsApp no inicializado</p>
          <Button 
            onClick={onRefresh} 
            variant="outline" 
            className="mt-4 w-full"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Intentar inicializar
          </Button>
        </div>
      </div>
    );
  }
  
  // Estado autenticado
  if (status?.authenticated) {
    return (
      <div className="border p-4 rounded-md bg-white flex flex-col items-center">
        <div className="flex flex-col items-center justify-center h-64 w-64">
          <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
          <p className="font-medium text-green-800 text-center">¡WhatsApp conectado correctamente!</p>
          <p className="text-sm text-green-600 text-center mt-2">La sesión está activa y lista para usarse</p>
        </div>
      </div>
    );
  }

  // Comprobar si el servidor está listo para generar códigos QR
  if (status?.initialized && !status?.authenticated && !imgError) {
    // Para depuración
    console.log("Intentando mostrar código QR, estado:", status);
    
    // Determinar qué fuente de QR usar
    let qrSource = null;
    
    // Prioridad 1: Usar el QR generado localmente si existe
    if (qrDataUrl) {
      console.log("Usando QR generado localmente");
      qrSource = qrDataUrl;
    } 
    // Prioridad 2: Usar el QR del status si es una dataURL
    else if (status?.qrCode && status.qrCode.startsWith('data:')) {
      console.log("Usando dataURL del QR directamente desde el servidor");
      qrSource = status.qrCode;
    } 
    // Prioridad 3: Usar el endpoint de imagen (podría fallar)
    else if (!qrDataUrl && status?.qrCode) {
      console.log("Usando endpoint de imagen (podría fallar)");
      qrSource = `/api/integrations/whatsapp/qr-image?t=${timestamp}&_=${Date.now()}`;
    }
    
    // Verificar si tenemos información de error
    if (status?.error) {
      console.warn("Estado con error:", status.error);
    }
    
    return (
      <div className="border p-4 rounded-md bg-white flex flex-col items-center">
        <div className="relative">
          {qrSource ? (
            <img 
              src={qrSource}
              alt="Código QR de WhatsApp" 
              className="h-64 w-64"
              onError={handleImageError}
              key={`qr-img-${timestamp}`} // Forzar recreación del componente img
              crossOrigin="anonymous" // Para evitar problemas CORS
            />
          ) : (
            <div className="h-64 w-64 flex flex-col items-center justify-center bg-gray-100">
              <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
              <p className="mt-4 text-sm text-gray-500 text-center">Generando código QR...</p>
            </div>
          )}
          <div className="absolute top-2 right-2">
            <div className="px-2 py-1 bg-green-500 text-white text-xs font-bold rounded-md">
              QR OFICIAL
            </div>
          </div>
        </div>
        <div className="mt-2 px-3 py-1 bg-green-100 text-green-800 text-xs rounded-md">
          Escanea este código QR con la aplicación de WhatsApp en tu teléfono
        </div>
        <Button 
          onClick={() => {
            setImgError(false);
            setQrDataUrl(null);
            setTimestamp(Date.now());
            onRefresh();
          }}
          variant="ghost" 
          size="sm"
          className="mt-2 text-xs"
        >
          <RefreshCw className="mr-1 h-3 w-3" />
          Actualizar QR
        </Button>
      </div>
    );
  }

  // Estado de conexión para depuración
  console.log("WhatsAppQRDisplay - estado actual:", status);
  
  // Por defecto mostrar estado de error
  return (
    <div className="border p-4 rounded-md bg-white flex flex-col items-center">
      <div className="flex flex-col items-center justify-center h-64 w-64">
        <AlertCircle className="h-12 w-12 text-amber-500" />
        <p className="mt-4 text-sm text-gray-600 text-center">
          {status?.error || "No se pudo conectar al servicio de WhatsApp"}
        </p>
        <Button 
          onClick={() => {
            setImgError(false);
            setQrDataUrl(null);
            setTimestamp(Date.now());
            onRefresh();
          }}
          variant="outline" 
          className="mt-4 w-full"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Intentar de nuevo
        </Button>
      </div>
    </div>
  );
}
