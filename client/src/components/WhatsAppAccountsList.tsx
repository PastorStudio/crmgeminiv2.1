import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Plus, Settings } from 'lucide-react';

interface WhatsAppAccount {
  id: number;
  name: string;
  description?: string;
  ownerName?: string;
  ownerPhone?: string;
  status: string;
  authenticated?: boolean;
  ready?: boolean;
  autoResponseEnabled?: boolean;
}

export function WhatsAppAccountsList() {
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use correct endpoint that works
      const response = await fetch('/api/whatsapp/accounts', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && Array.isArray(data.accounts)) {
        setAccounts(data.accounts);
        console.log(`✅ Loaded ${data.accounts.length} WhatsApp accounts successfully`);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('❌ Error fetching WhatsApp accounts:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const getStatusBadge = (account: WhatsAppAccount) => {
    if (account.authenticated && account.ready) {
      return <Badge variant="default" className="bg-green-500">Conectado</Badge>;
    } else if (account.authenticated) {
      return <Badge variant="secondary">Autenticando</Badge>;
    } else {
      return <Badge variant="destructive">Desconectado</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cargando cuentas...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Obteniendo cuentas de WhatsApp...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Error al cargar cuentas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchAccounts} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Cuentas de WhatsApp ({accounts.length})</h2>
        <div className="flex gap-2">
          <Button onClick={fetchAccounts} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
          <Button size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Añadir cuenta
          </Button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">No hay cuentas de WhatsApp configuradas</p>
            <Button className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Crear primera cuenta
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <h3 className="font-semibold text-lg">{account.name}</h3>
                      {account.description && (
                        <p className="text-sm text-muted-foreground">{account.description}</p>
                      )}
                      {account.ownerName && (
                        <p className="text-sm">Propietario: {account.ownerName}</p>
                      )}
                      {account.ownerPhone && (
                        <p className="text-sm">Teléfono: {account.ownerPhone}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {getStatusBadge(account)}
                    {account.autoResponseEnabled && (
                      <Badge variant="outline">Auto-respuesta</Badge>
                    )}
                    <Button variant="outline" size="sm">
                      <Settings className="w-4 h-4 mr-2" />
                      Configurar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}