import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AutoResponseOpenAI } from '@/components/messaging/AutoResponseOpenAI';
import { DeepSeekRecommendations } from '@/components/messaging/DeepSeekRecommendations';
import { useQuery } from '@tanstack/react-query';

interface WhatsAppAccount {
  id: number;
  name: string;
  status: string;
}

export default function AIConfiguration() {
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  const { data: accounts, isLoading } = useQuery<WhatsAppAccount[]>({
    queryKey: ['/api/whatsapp-accounts'],
  });

  useEffect(() => {
    if (accounts && accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  const selectedAccount = accounts?.find(acc => acc.id === selectedAccountId);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando configuración de IA...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuración de IA</h1>
          <p className="text-muted-foreground">
            Configure los sistemas de respuestas automáticas y recomendaciones
          </p>
        </div>
      </div>

      {accounts && accounts.length > 0 ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Seleccionar Cuenta WhatsApp</CardTitle>
              <CardDescription>
                Seleccione la cuenta para configurar los sistemas de IA
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Label htmlFor="account-select">Cuenta:</Label>
                <Select
                  value={selectedAccountId?.toString() || ''}
                  onValueChange={(value) => setSelectedAccountId(parseInt(value))}
                >
                  <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder="Seleccionar cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id.toString()}>
                        {account.name} ({account.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {selectedAccount && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-6">
                <AutoResponseOpenAI 
                  accountId={selectedAccount.id}
                  accountName={selectedAccount.name}
                />
              </div>
              
              <div className="space-y-6">
                <DeepSeekRecommendations
                  accountId={selectedAccount.id}
                  accountName={selectedAccount.name}
                />
              </div>
            </div>
          )}

          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-900">Información Importante</CardTitle>
            </CardHeader>
            <CardContent className="text-blue-800 space-y-2">
              <p>
                <strong>Sistema OpenAI:</strong> Genera respuestas automáticas usando GPT-4 basadas en prompts configurables.
              </p>
              <p>
                <strong>Sistema DeepSeek:</strong> Proporciona recomendaciones de respuesta basadas en análisis de conversaciones.
              </p>
              <p>
                <strong>Nota:</strong> Ambos sistemas funcionan independientemente y pueden estar activos al mismo tiempo.
              </p>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No hay cuentas disponibles</CardTitle>
            <CardDescription>
              No se encontraron cuentas de WhatsApp configuradas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Primero debe configurar al menos una cuenta de WhatsApp para poder usar los sistemas de IA.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}