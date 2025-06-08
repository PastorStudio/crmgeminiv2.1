import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { QrCode, Smartphone, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

interface WhatsAppAccount {
  id: number;
  name: string;
  status: string;
  authenticated?: boolean;
  ready?: boolean;
  qrCode?: string;
}

interface WhatsAppAuthStatusProps {
  onAuthenticationChange?: (accountId: number, authenticated: boolean) => void;
}

export function WhatsAppAuthStatus({ onAuthenticationChange }: WhatsAppAuthStatusProps) {
  const [selectedAccount, setSelectedAccount] = useState<number | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);

  // Query para obtener cuentas de WhatsApp
  const { data: accounts = [], isLoading, refetch } = useQuery<WhatsAppAccount[]>({
    queryKey: ['/api/whatsapp-accounts'],
    queryFn: async () => {
      const response = await fetch('/api/whatsapp-accounts');
      if (!response.ok) throw new Error('Failed to fetch accounts');
      const result = await response.json();
      return result.success ? result.accounts : [];
    },
    refetchInterval: 5000 // Actualizar cada 5 segundos
  });

  // Query para obtener QR code de cuenta específica
  const { data: qrData, refetch: refetchQR } = useQuery({
    queryKey: ['/api/whatsapp-accounts', selectedAccount, 'qr'],
    queryFn: async () => {
      if (!selectedAccount) return null;
      const response = await fetch(`/api/whatsapp-accounts/${selectedAccount}/qr`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!selectedAccount,
    refetchInterval: 10000 // Actualizar QR cada 10 segundos
  });

  useEffect(() => {
    if (qrData?.qrDataUrl) {
      setQrCodeData(qrData.qrDataUrl);
    }
  }, [qrData]);

  useEffect(() => {
    accounts.forEach(account => {
      onAuthenticationChange?.(account.id, account.authenticated || false);
    });
  }, [accounts, onAuthenticationChange]);

  const handleGenerateQR = async (accountId: number) => {
    try {
      const response = await fetch(`/api/whatsapp-accounts/${accountId}/qr`, {
        method: 'POST'
      });
      if (response.ok) {
        setSelectedAccount(accountId);
        refetchQR();
      }
    } catch (error) {
      console.error('Error generating QR:', error);
    }
  };

  const getStatusColor = (account: WhatsAppAccount) => {
    if (account.authenticated && account.ready) return 'bg-green-500';
    if (account.authenticated) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusText = (account: WhatsAppAccount) => {
    if (account.authenticated && account.ready) return 'Conectado';
    if (account.authenticated) return 'Autenticando...';
    return 'Desconectado';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Estado de WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Cargando estado de conexión...
          </div>
        </CardContent>
      </Card>
    );
  }

  const authenticatedAccounts = accounts.filter(acc => acc.authenticated && acc.ready);
  const needsAuth = accounts.filter(acc => !acc.authenticated);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Estado de Cuentas WhatsApp
          </CardTitle>
          <CardDescription>
            Gestiona la autenticación de tus cuentas de WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {accounts.length === 0 ? (
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                No hay cuentas de WhatsApp configuradas
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-3">
              {accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(account)}`} />
                    <div>
                      <div className="font-medium">{account.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Cuenta ID: {account.id}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={account.authenticated ? 'default' : 'destructive'}>
                      {getStatusText(account)}
                    </Badge>
                    {!account.authenticated && (
                      <Button
                        size="sm"
                        onClick={() => handleGenerateQR(account.id)}
                        variant="outline"
                      >
                        <QrCode className="w-4 h-4 mr-1" />
                        Conectar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {authenticatedAccounts.length > 0 && (
            <Alert>
              <CheckCircle className="w-4 h-4" />
              <AlertDescription>
                {authenticatedAccounts.length} cuenta(s) conectada(s) y lista(s) para usar
              </AlertDescription>
            </Alert>
          )}

          {needsAuth.length > 0 && (
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                {needsAuth.length} cuenta(s) requiere(n) autenticación para acceder a chats reales
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {selectedAccount && qrCodeData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Código QR - Cuenta {selectedAccount}
            </CardTitle>
            <CardDescription>
              Escanea este código con WhatsApp Web para autenticar la cuenta
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="flex justify-center">
              <img 
                src={qrCodeData} 
                alt="QR Code for WhatsApp authentication"
                className="max-w-64 w-full h-auto border rounded-lg"
              />
            </div>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>1. Abre WhatsApp en tu teléfono</p>
              <p>2. Ve a Configuración → Dispositivos vinculados</p>
              <p>3. Toca "Vincular un dispositivo"</p>
              <p>4. Escanea este código QR</p>
            </div>
            <Button 
              onClick={() => refetchQR()} 
              variant="outline"
              size="sm"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Actualizar QR
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}