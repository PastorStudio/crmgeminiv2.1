import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, AlertTriangle, QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WhatsAppQRAuthProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: number;
  onQRScanned?: () => void;
}

export function WhatsAppQRAuth({ 
  open, 
  onOpenChange, 
  accountId,
  onQRScanned 
}: WhatsAppQRAuthProps) {
  const { toast } = useToast();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Consulta para obtener el código QR
  const { 
    data: qrData, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['/api/whatsapp-accounts', accountId, 'qrcode', refreshTrigger],
    queryFn: async () => {
      if (!accountId) throw new Error('No se ha especificado un ID de cuenta');
      
      try {
        const response = await fetch(`/api/whatsapp-accounts/${accountId}/qrcode`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Código QR no disponible para esta cuenta');
          }
          throw new Error(`Error al obtener código QR: ${response.statusText}`);
        }
        
        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Error obteniendo QR:', error);
        throw error;
      }
    },
    enabled: open && !!accountId,
    refetchInterval: open ? 5000 : false,
    retry: 3
  });
  
  // Refrescar QR
  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    refetch();
  };
  
  // Verificar el estado de conexión periódicamente
  useEffect(() => {
    if (!open) return;
    
    const checkInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/whatsapp-accounts/${accountId}`);
        const data = await response.json();
        
        // Si el estado de la cuenta muestra que ya está autenticada
        if (data && data.authenticated === true) {
          toast({
            title: 'WhatsApp autenticado',
            description: 'La cuenta ha sido conectada correctamente',
            variant: 'default'
          });
          
          // Cerrar el diálogo
          onOpenChange(false);
          
          // Llamar al callback si existe
          if (onQRScanned) {
            onQRScanned();
          }
          
          clearInterval(checkInterval);
        }
      } catch (error) {
        console.error('Error verificando estado de autenticación:', error);
      }
    }, 3000);
    
    return () => clearInterval(checkInterval);
  }, [open, accountId, onOpenChange, onQRScanned, toast]);
  
  // Extraer el código QR de la respuesta
  const qrCode = qrData?.qrCode || qrData?.qrcode || null;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escanear código QR de WhatsApp</DialogTitle>
          <DialogDescription>
            Abre WhatsApp en tu teléfono, ve a Configuración &gt; WhatsApp Web/Escritorio y escanea este código.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center p-6">
          {isLoading ? (
            <div className="flex flex-col items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p>Cargando código QR...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center py-12">
              <AlertTriangle className="h-8 w-8 text-yellow-500 mb-4" />
              <p className="text-center">
                {error instanceof Error ? error.message : 'Error obteniendo código QR'}
              </p>
            </div>
          ) : qrCode ? (
            <div className="flex flex-col items-center">
              <img 
                src={`data:image/png;base64,${qrCode}`} 
                alt="Código QR para WhatsApp" 
                className="w-64 h-64 border p-2"
              />
              <p className="text-sm text-center mt-4">
                El código se actualizará automáticamente. Si expira, haz clic en "Refrescar QR".
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center py-12">
              <QrCode className="h-8 w-8 mb-4" />
              <p>No hay código QR disponible para esta cuenta.</p>
            </div>
          )}
        </div>
        
        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refrescar QR
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}