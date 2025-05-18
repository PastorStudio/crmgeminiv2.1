import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { RefreshCw, XCircle, Users } from 'lucide-react';

// Componente para mostrar el código QR de WhatsApp
export function WhatsAppQRCode({ accountId }: { accountId: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Query para obtener el código QR
  const { data: qrData, isLoading: isQrLoading, refetch: refetchQr } = useQuery({
    queryKey: ['/api/whatsapp-accounts', accountId, 'qrcode'],
    queryFn: async () => {
      try {
        const response = await apiRequest(`/api/whatsapp-accounts/${accountId}/qrcode`);
        return response.success ? response : null;
      } catch (error) {
        console.error('Error fetching QR code:', error);
        return null;
      }
    },
    refetchInterval: 5000 // Actualizar cada 5 segundos
  });
  
  // Generar el código QR cuando cambian los datos
  useEffect(() => {
    if (!canvasRef.current || !qrData?.qrcode) return;
    
    const generateQR = async () => {
      try {
        // Usar el texto del QR directamente como viene del servidor
        await QRCode.toCanvas(canvasRef.current, qrData.qrcode, {
          width: 256,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });
      } catch (error) {
        console.error('Error al generar el código QR:', error);
      }
    };
    
    generateQR();
  }, [qrData]);
  
  return (
    <div className="flex flex-col items-center">
      {isQrLoading ? (
        <div className="flex items-center justify-center bg-white p-4 rounded-lg mb-4 w-64 h-64">
          <Spinner />
        </div>
      ) : qrData?.qrcode ? (
        <div className="bg-white p-4 rounded-lg mb-4 shadow-md">
          <canvas
            ref={canvasRef}
            className="w-64 h-64 border rounded"
            aria-label="Código QR para conectar WhatsApp"
          />
        </div>
      ) : (
        <div className="flex items-center justify-center bg-white p-4 rounded-lg mb-4 w-64 h-64 border border-red-300">
          <div className="text-center text-red-500">
            <XCircle className="h-16 w-16 mx-auto mb-2" />
            <p>Error al cargar el código QR</p>
          </div>
        </div>
      )}
      
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetchQr()}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar QR
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.href = '/whatsapp-accounts'}
        >
          <Users className="h-4 w-4 mr-2" />
          Ver cuentas
        </Button>
      </div>
    </div>
  );
}