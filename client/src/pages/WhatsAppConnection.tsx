import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Smartphone, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QRResponse {
  success: boolean;
  qrCode?: string;
  accountId?: number;
  message?: string;
}

export default function WhatsAppConnection() {
  const [qrCode1, setQrCode1] = useState<string | null>(null);
  const [qrCode2, setQrCode2] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [connected1, setConnected1] = useState(false);
  const [connected2, setConnected2] = useState(false);
  const { toast } = useToast();

  // Obtener códigos QR para ambas cuentas
  const fetchQRCodes = async () => {
    setLoading(true);
    try {
      // Obtener QR para cuenta 1 (Ventas)
      const response1 = await fetch('/api/whatsapp/qr/1');
      const data1: QRResponse = await response1.json();
      if (data1.success && data1.qrCode) {
        setQrCode1(data1.qrCode);
      }

      // Obtener QR para cuenta 2 (com)
      const response2 = await fetch('/api/whatsapp/qr/2');
      const data2: QRResponse = await response2.json();
      if (data2.success && data2.qrCode) {
        setQrCode2(data2.qrCode);
      }

      toast({
        title: "Códigos QR actualizados",
        description: "Los códigos QR están listos para escanear",
      });
    } catch (error) {
      console.error('Error al obtener códigos QR:', error);
      toast({
        title: "Error",
        description: "No se pudieron obtener los códigos QR",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Verificar estado de conexión
  const checkConnectionStatus = async () => {
    try {
      const response = await fetch('/api/direct/whatsapp/status');
      const status = await response.json();
      setConnected1(status.authenticated);
      setConnected2(status.authenticated);
    } catch (error) {
      console.error('Error al verificar estado:', error);
    }
  };

  // Cargar códigos QR al montar el componente
  useEffect(() => {
    fetchQRCodes();
    checkConnectionStatus();
    
    // Verificar estado cada 5 segundos
    const interval = setInterval(checkConnectionStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Generar URL de imagen QR
  const generateQRImageUrl = (qrCode: string) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrCode)}`;
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Conexión WhatsApp</h1>
        <p className="text-gray-600">
          Escanea los códigos QR con tu teléfono para conectar las cuentas de WhatsApp
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Cuenta 1 - Ventas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Cuenta Ventas</span>
              {connected1 ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-orange-500" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {qrCode1 ? (
              <div className="text-center">
                <div className="bg-white p-4 inline-block rounded-lg border">
                  <img 
                    src={generateQRImageUrl(qrCode1)} 
                    alt="QR Code Cuenta Ventas" 
                    className="w-64 h-64"
                  />
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Estado: {connected1 ? 'Conectado' : 'Esperando escaneo'}
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">Código QR no disponible</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cuenta 2 - com */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Cuenta com</span>
              {connected2 ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-orange-500" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {qrCode2 ? (
              <div className="text-center">
                <div className="bg-white p-4 inline-block rounded-lg border">
                  <img 
                    src={generateQRImageUrl(qrCode2)} 
                    alt="QR Code Cuenta com" 
                    className="w-64 h-64"
                  />
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Estado: {connected2 ? 'Conectado' : 'Esperando escaneo'}
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">Código QR no disponible</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Botón para actualizar */}
      <div className="text-center mb-6">
        <Button onClick={fetchQRCodes} disabled={loading} className="mr-4">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar códigos QR
        </Button>
      </div>

      {/* Instrucciones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Smartphone className="mr-2 h-5 w-5" />
            Instrucciones de conexión
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>Abre WhatsApp en tu teléfono</li>
            <li>Ve a Configuración → Dispositivos vinculados</li>
            <li>Toca "Vincular un dispositivo"</li>
            <li>Escanea el código QR de la cuenta que desees conectar</li>
            <li>Espera a que aparezca el estado "Conectado"</li>
          </ol>
          
          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700">
              <strong>Importante:</strong> Una vez conectadas las cuentas, podrás gestionar los chats, 
              asignar agentes y utilizar todas las funciones del CRM WhatsApp.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}