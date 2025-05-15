import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WhatsAppStatus {
  initialized: boolean;
  ready: boolean;
  authenticated: boolean;
  errorMessage?: string;
  qrCode?: string;
}

interface QRCodeResponse {
  data: string;
}

export function WhatsAppQRCode() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await apiRequest<WhatsAppStatus>('/api/integrations/whatsapp/status');
      setStatus(response);
      
      if (response?.qrCode) {
        setQrCode(response.qrCode);
      } else if (response && !response.authenticated) {
        fetchQRCode();
      }
    } catch (error) {
      console.error('Error fetching WhatsApp status:', error);
      toast({
        title: 'Error',
        description: 'No se pudo obtener el estado de WhatsApp',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchQRCode = async () => {
    try {
      const response = await apiRequest<QRCodeResponse>('/api/integrations/whatsapp/qrcode');
      if (response?.data) {
        setQrCode(response.data);
      }
    } catch (error) {
      console.error('Error fetching WhatsApp QR code:', error);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await apiRequest('/api/integrations/whatsapp/restart', {
        method: 'POST',
        body: {}
      });
      
      // Esperar un momento para que se genere el nuevo código QR
      setTimeout(async () => {
        await fetchStatus();
        setRefreshing(false);
      }, 2000);
      
      toast({
        title: 'WhatsApp reiniciado',
        description: 'Generando nuevo código QR...',
      });
    } catch (error) {
      console.error('Error restarting WhatsApp:', error);
      toast({
        title: 'Error',
        description: 'No se pudo reiniciar WhatsApp',
        variant: 'destructive',
      });
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    
    // Actualizar el estado cada 30 segundos
    const interval = setInterval(() => {
      fetchStatus();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Conectar WhatsApp</CardTitle>
        <CardDescription>
          Escanea el código QR con tu teléfono para conectar WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Cargando WhatsApp...</p>
          </div>
        ) : qrCode ? (
          <div className="flex flex-col items-center">
            <div className="bg-white p-3 rounded-lg mb-4">
              <img 
                src={qrCode} 
                alt="WhatsApp QR Code" 
                className="w-64 h-64"
              />
            </div>
            <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-3 text-xs text-green-800">
              Este código QR abrirá WhatsApp directamente en tu dispositivo móvil
            </div>
            
            <p className="text-sm text-muted-foreground mb-2">
              {status?.authenticated 
                ? '¡WhatsApp conectado exitosamente!' 
                : '1. Abre la cámara en tu teléfono'
              }
            </p>
            {!status?.authenticated && (
              <>
                <p className="text-sm text-muted-foreground mb-2">
                  2. Enfoca el código QR para escanearlo
                </p>
                <p className="text-sm text-muted-foreground mb-2">
                  3. Se abrirá WhatsApp automáticamente
                </p>
                <p className="text-sm text-muted-foreground">
                  4. Confirma la conexión en la app
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8">
            <p className="text-sm text-muted-foreground mb-4">
              No hay código QR disponible. Intenta refrescar.
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-center">
        <Button 
          onClick={handleRefresh} 
          disabled={refreshing || loading}
          variant="outline"
          className="gap-2"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {refreshing ? 'Generando código...' : 'Generar nuevo código QR'}
        </Button>
      </CardFooter>
    </Card>
  );
}