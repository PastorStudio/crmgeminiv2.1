import { useState } from "react";
import { Helmet } from "react-helmet";
import { WhatsAppSimple } from "@/components/messaging/WhatsAppSimple";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Users, Phone } from 'lucide-react';

export default function Messages() {
  const [selectedLeadId, setSelectedLeadId] = useState<number | undefined>(undefined);
  const [selectedAccount, setSelectedAccount] = useState<number>(1);
  const [multiAccountMode, setMultiAccountMode] = useState<boolean>(false);
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([1]);

  const availableAccounts = [
    { id: 1, name: 'WhatsApp Cuenta 1', description: 'Cuenta principal' },
    { id: 2, name: 'WhatsApp Cuenta 2', description: 'Cuenta secundaria' },
    { id: 3, name: 'WhatsApp Cuenta 3', description: 'Cuenta terciaria' }
  ];

  const handleAccountToggle = (accountId: number) => {
    if (multiAccountMode) {
      setSelectedAccounts(prev => 
        prev.includes(accountId) 
          ? prev.filter(id => id !== accountId)
          : [...prev, accountId]
      );
    } else {
      setSelectedAccount(accountId);
    }
  };

  return (
    <>
      <Helmet>
        <title>WhatsApp | GeminiCRM</title>
        <meta name="description" content="Comunícate con tus clientes a través de WhatsApp directamente desde tu CRM" />
      </Helmet>

      <div className="w-full h-screen flex flex-col p-0 m-0 overflow-hidden">
        {/* Panel de selección de cuentas */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <h1 className="text-2xl font-bold mb-4">Mensajes de WhatsApp</h1>
          
          <Tabs defaultValue="single" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single" onClick={() => setMultiAccountMode(false)}>
                <Phone className="w-4 h-4 mr-2" />
                Cuenta Individual
              </TabsTrigger>
              <TabsTrigger value="multi" onClick={() => setMultiAccountMode(true)}>
                <Users className="w-4 h-4 mr-2" />
                Multi-Cuenta
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="single" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Seleccionar Cuenta</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {availableAccounts.map((account) => (
                      <Button
                        key={account.id}
                        variant={selectedAccount === account.id ? "default" : "outline"}
                        className="h-auto p-4 justify-start"
                        onClick={() => handleAccountToggle(account.id)}
                      >
                        <div className="text-left">
                          <div className="font-medium">{account.name}</div>
                          <div className="text-xs opacity-70">{account.description}</div>
                          <Badge variant="secondary" className="mt-1">#{account.id}</Badge>
                        </div>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="multi" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Seleccionar Múltiples Cuentas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {availableAccounts.map((account) => (
                      <Button
                        key={account.id}
                        variant={selectedAccounts.includes(account.id) ? "default" : "outline"}
                        className="h-auto p-4 justify-start"
                        onClick={() => handleAccountToggle(account.id)}
                      >
                        <div className="text-left">
                          <div className="font-medium">{account.name}</div>
                          <div className="text-xs opacity-70">{account.description}</div>
                          <Badge variant="secondary" className="mt-1">#{account.id}</Badge>
                        </div>
                      </Button>
                    ))}
                  </div>
                  <div className="mt-3 text-sm text-gray-600">
                    Cuentas seleccionadas: {selectedAccounts.length}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Panel de chat */}
        <div className="flex-1 overflow-hidden">
          <WhatsAppSimple 
            selectedLeadId={selectedLeadId} 
            onSelectLead={setSelectedLeadId}
            currentAccountId={multiAccountMode ? selectedAccounts[0] || 1 : selectedAccount}
            multiAccountMode={multiAccountMode}
            selectedAccounts={multiAccountMode ? selectedAccounts : [selectedAccount]}
          />
        </div>
      </div>
    </>
  );
}
