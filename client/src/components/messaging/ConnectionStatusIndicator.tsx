import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ConnectionStatusIndicatorProps {
  status: any;
  onReconnect?: () => void;
}

export function ConnectionStatusIndicator({ status, onReconnect }: ConnectionStatusIndicatorProps) {
  const [reconnecting, setReconnecting] = useState(false);
  const [lastCheck, setLastCheck] = useState(Date.now());

  // Manejo de reconexión
  const handleReconnect = async () => {
    if (!onReconnect) return;
    
    setReconnecting(true);
    try {
      await onReconnect();
    } catch (error) {
      console.error('Error al intentar reconectar:', error);
    } finally {
      setLastCheck(Date.now());
      setReconnecting(false);
    }
  };

  // Auto chequeo cada 5 minutos
  useEffect(() => {
    const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos
    const timer = setInterval(() => {
      const now = Date.now();
      if (now - lastCheck > CHECK_INTERVAL && onReconnect && !status?.authenticated) {
        handleReconnect();
      }
    }, 60000); // Verificar cada minuto si es tiempo de refrescar
    
    return () => clearInterval(timer);
  }, [status, lastCheck, onReconnect]);

  // Si está autenticado, mostrar badge verde
  if (status?.authenticated) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center">
              <CheckCircle className="h-3 w-3 mr-1" />
              Conectado
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">WhatsApp conectado correctamente</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Si tiene QR pero no está autenticado
  if (status?.qrCode && !status?.authenticated) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 flex items-center">
              <Info className="h-3 w-3 mr-1" />
              Esperando escaneo
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Pendiente de escanear código QR</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Si hay un error o no está inicializado
  if (!status?.initialized || status?.error) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 flex items-center">
                <AlertCircle className="h-3 w-3 mr-1" />
                Desconectado
              </Badge>
              
              {onReconnect && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-6 px-2 text-xs"
                  onClick={handleReconnect}
                  disabled={reconnecting}
                >
                  {reconnecting ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Reconectando...
                    </>
                  ) : (
                    'Reconectar'
                  )}
                </Button>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">
              {status?.error 
                ? `Error de conexión: ${status.error.substring(0, 50)}${status.error.length > 50 ? '...' : ''}` 
                : 'WhatsApp no inicializado'}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Estado por defecto (cargando o desconocido)
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 flex items-center">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Conectando...
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Estableciendo conexión con WhatsApp</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}