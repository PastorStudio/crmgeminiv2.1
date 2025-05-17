import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import {
  AlertCircle,
  CheckCircle,
  QrCode,
  RefreshCw,
  Info,
  Smartphone
} from 'lucide-react';

interface ImprovedQRDisplayProps {
  status: any;
  isLoading: boolean;
  onRefresh: () => void;
}

export function ImprovedQRDisplay({ status, isLoading, onRefresh }: ImprovedQRDisplayProps) {
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [lastQrUpdate, setLastQrUpdate] = useState(Date.now());
  const [retryCount, setRetryCount] = useState(0);
  const { toast } = useToast();

  // Generar QR cuando cambia el código o al montar componente
  useEffect(() => {
    if (status && status.qrCode && !status.authenticated) {
      fetchQRImage();
    }
  }, [status?.qrCode, status?.authenticated]);

  // Si hay un nuevo código QR disponible
  useEffect(() => {
    if (status?.qrCode && status?.qrGeneratedAt) {
      // Verificar si el código QR es nuevo
      const qrTimestamp = new Date(status.qrGeneratedAt).getTime();
      if (qrTimestamp > lastQrUpdate) {
        setLastQrUpdate(qrTimestamp);
        fetchQRImage();
      }
    }
  }, [status?.qrCode, status?.qrGeneratedAt]);

  // Auto-refresco cada 30 segundos si no estamos autenticados
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    
    if (!status?.authenticated && !isLoading) {
      timer = setTimeout(() => {
        console.log('Auto-refrescando estado de WhatsApp...');
        onRefresh();
        setRetryCount(prev => prev + 1);
      }, 30000);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [status, isLoading, onRefresh]);

  // Mostrar alerta si hay varios reintentos sin éxito
  useEffect(() => {
    if (retryCount === 3) {
      toast({
        title: "Problemas de conexión",
        description: "Estamos teniendo dificultades para conectar WhatsApp. Intente escanear el código QR nuevamente.",
        variant: "destructive"
      });
    }
  }, [retryCount]);

  const fetchQRImage = async () => {
    if (!status?.qrCode) return;
    
    try {
      setIsGeneratingQR(true);
      
      // Si ya tenemos la URL de datos para el QR, usarla directamente
      if (status.qrDataUrl) {
        setQrImage(status.qrDataUrl);
        return;
      }
      
      // Generar QR a partir del código
      const QRCode = await import('qrcode');
      const url = await QRCode.toDataURL(status.qrCode, {
        margin: 2,
        width: 300,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      setQrImage(url);
    } catch (err) {
      console.error('Error generando QR:', err);
      toast({
        title: "Error al generar código QR",
        description: "No se pudo generar la imagen del código QR. Intente refrescar.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingQR(false);
    }
  };
  
  // Mostrar spinner mientras carga
  if (isLoading) {
    return (
      <Card className="w-full bg-white shadow-md">
        <CardContent className="flex flex-col items-center justify-center p-8 min-h-[380px]">
          <Spinner className="w-12 h-12 text-green-500 mb-4" />
          <p className="text-center text-gray-600">Cargando estado de WhatsApp...</p>
        </CardContent>
      </Card>
    );
  }
  
  // Estado sin inicializar
  if (!status?.initialized) {
    return (
      <Card className="w-full bg-white shadow-md">
        <CardContent className="flex flex-col items-center justify-center p-8 min-h-[380px]">
          <AlertCircle className="h-16 w-16 text-amber-500 mb-4" />
          <p className="text-xl font-medium text-gray-800 mb-2">Servicio no iniciado</p>
          <p className="text-sm text-gray-600 mb-6 text-center">
            El servicio de WhatsApp no está inicializado. Es posible que necesite reiniciar la aplicación.
          </p>
          <Button 
            onClick={onRefresh} 
            className="w-48"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Intentar inicializar
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  // Estado autenticado
  if (status?.authenticated) {
    return (
      <Card className="w-full bg-white shadow-md">
        <CardContent className="flex flex-col items-center justify-center p-8 min-h-[380px]">
          <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
          <p className="text-xl font-medium text-green-800 mb-2">¡WhatsApp conectado!</p>
          <p className="text-center text-gray-600 mb-6">
            La conexión con WhatsApp se ha establecido correctamente. Puede enviar y recibir mensajes.
          </p>
          <div className="grid grid-cols-2 gap-4 w-full max-w-md">
            <div className="bg-gray-50 p-4 rounded-md">
              <p className="text-sm font-medium mb-1">Estado</p>
              <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700">
                Conectado
              </Badge>
            </div>
            <div className="bg-gray-50 p-4 rounded-md">
              <p className="text-sm font-medium mb-1">Modo</p>
              <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700">
                Sesión persistente
              </Badge>
            </div>
          </div>
          <Button 
            onClick={onRefresh} 
            variant="outline"
            className="mt-6"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Verificar estado
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  // Estado con QR code para escanear
  if (status?.qrCode && qrImage) {
    return (
      <Card className="w-full bg-white shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center">
            <QrCode className="mr-2 h-5 w-5 text-green-600" />
            Conecta tu WhatsApp
          </CardTitle>
          <CardDescription>
            Escanea este código QR con tu teléfono para conectar WhatsApp al CRM
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-6">
          <div className="bg-white p-3 border-2 border-green-100 rounded-lg shadow-sm mb-4">
            {isGeneratingQR ? (
              <div className="w-[300px] h-[300px] flex items-center justify-center">
                <Spinner className="h-8 w-8 text-green-500" />
              </div>
            ) : (
              <img 
                src={qrImage} 
                alt="Código QR para conectar WhatsApp" 
                className="w-[300px] h-[300px]"
              />
            )}
          </div>
          
          <div className="bg-green-50 border border-green-100 rounded-md p-4 w-full max-w-md mb-4">
            <div className="flex items-start">
              <Info className="h-5 w-5 text-green-600 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <p className="text-sm text-green-800 font-medium">Cómo conectar:</p>
                <ol className="text-xs text-green-700 mt-1 ml-4 space-y-1 list-decimal">
                  <li>Abre WhatsApp en tu teléfono</li>
                  <li>Toca Menú o Configuración</li>
                  <li>Selecciona WhatsApp Web</li>
                  <li>Apunta tu teléfono a esta pantalla para escanear el código</li>
                </ol>
              </div>
            </div>
          </div>
          
          <Button 
            onClick={onRefresh} 
            variant="outline"
            className="w-full max-w-md"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar QR
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  // Mostrar estado de error o loading cuando no hay QR
  return (
    <Card className="w-full bg-white shadow-md">
      <CardContent className="flex flex-col items-center justify-center p-8 min-h-[380px]">
        <div className="flex flex-col items-center">
          <Smartphone className="h-16 w-16 text-gray-400 mb-4" />
          <p className="text-xl font-medium text-gray-700 mb-2">Preparando conexión</p>
          <p className="text-center text-gray-600 mb-6">
            Estamos preparando el código QR para conectar WhatsApp.
            Esto puede tomar unos momentos...
          </p>
          <Button 
            onClick={onRefresh} 
            variant="default"
            className="w-48"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refrescar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}