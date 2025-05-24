import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Smartphone, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QRResponse {
  success: boolean;
  qrCode?: string;
  accountId?: number;
  accountName?: string;
  message?: string;
}

interface WhatsAppAccount {
  id: number;
  name: string;
  description?: string;
  qrCode?: string;
  connected: boolean;
}

export default function WhatsAppConnection() {
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Obtener códigos QR para todas las cuentas existentes del sistema
  const fetchQRCodes = async () => {
    setLoading(true);
    try {
      // Obtener las cuentas existentes del sistema
      const accountsResponse = await fetch('/api/whatsapp-accounts');
      const systemAccounts = await accountsResponse.json();
      
      // Obtener códigos QR para cada cuenta
      const accountsWithQR: WhatsAppAccount[] = await Promise.all(
        systemAccounts.map(async (account: any) => {
          try {
            const qrResponse = await fetch(`/api/whatsapp/qr/${account.id}`);
            const qrData: QRResponse = await qrResponse.json();
            
            return {
              id: account.id,
              name: account.name,
              description: account.description,
              qrCode: qrData.success ? qrData.qrCode : null,
              connected: false // Se actualizará en checkConnectionStatus
            };
          } catch {
            return {
              id: account.id,
              name: account.name,
              description: account.description,
              qrCode: null,
              connected: false
            };
          }
        })
      );
      
      setAccounts(accountsWithQR);
      
      toast({
        title: "Códigos QR actualizados",
        description: `${accountsWithQR.length} cuenta(s) listas para conectar`,
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

  // Verificar estado de conexión para todas las cuentas
  const checkConnectionStatus = async () => {
    try {
      const response = await fetch('/api/direct/whatsapp/status');
      const status = await response.json();
      
      // Actualizar estado de conexión para todas las cuentas
      setAccounts(prev => prev.map(account => ({
        ...account,
        connected: status.authenticated // Por ahora todas las cuentas tienen el mismo estado
      })));
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
          Escanea los códigos QR con tu teléfono para conectar las cuentas de WhatsApp al CRM
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {accounts.map((account) => (
          <Card key={account.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{account.name} (ID: {account.id})</span>
                {account.connected ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {account.qrCode ? (
                <div className="text-center">
                  <div className="bg-white p-4 inline-block rounded-lg border">
                    <img 
                      src={generateQRImageUrl(account.qrCode)} 
                      alt={`QR Code ${account.name}`} 
                      className="w-64 h-64"
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Estado: {account.connected ? 'Conectado' : 'Esperando escaneo'}
                  </p>
                  {account.description && (
                    <p className="text-xs text-gray-400 mt-1">
                      {account.description}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">Código QR no disponible</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Esperando generación del código QR...
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        
        {accounts.length === 0 && !loading && (
          <div className="col-span-2 text-center py-8">
            <p className="text-gray-500">No hay cuentas WhatsApp configuradas</p>
            <p className="text-xs text-gray-400 mt-1">
              Agrega cuentas desde la sección "Cuentas WhatsApp"
            </p>
          </div>
        )}
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
              asignar agentes como Carlos López y utilizar todas las funciones del CRM WhatsApp.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}