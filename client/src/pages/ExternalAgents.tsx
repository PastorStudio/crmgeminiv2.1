import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Bot, Plus, Settings, MessageSquare, BarChart3, Power, PowerOff } from 'lucide-react';

interface ExternalAgent {
  id: string;
  name: string;
  url: string;
  apiKey?: string;
  headers?: Record<string, string>;
  requestFormat?: 'openai' | 'custom';
  isActive: boolean;
}

interface AgentStats {
  totalAgents: number;
  activeAgents: number;
  agentList: Array<{
    id: string;
    name: string;
    isActive: boolean;
  }>;
}

export default function ExternalAgents() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [newAgent, setNewAgent] = useState({
    id: '',
    name: '',
    url: '',
    apiKey: '',
    requestFormat: 'custom' as 'openai' | 'custom'
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Obtener lista de agentes
  const { data: agentsResponse, isLoading: loadingAgents } = useQuery({
    queryKey: ['/api/external-agents'],
  });
  
  const agents = agentsResponse?.agents || [];

  // Obtener estadísticas
  const { data: stats } = useQuery<AgentStats>({
    queryKey: ['/api/external-agents/stats'],
  });

  // Mutation para agregar agente
  const addAgentMutation = useMutation({
    mutationFn: (agent: any) => apiRequest('/api/external-agents', {
      method: 'POST',
      body: JSON.stringify(agent)
    }),
    onSuccess: () => {
      toast({
        title: "¡Agente agregado!",
        description: "El agente externo se ha configurado exitosamente.",
      });
      setIsAddDialogOpen(false);
      setNewAgent({ id: '', name: '', url: '', apiKey: '', requestFormat: 'custom' });
      queryClient.invalidateQueries({ queryKey: ['/api/external-agents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/external-agents/stats'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo agregar el agente",
        variant: "destructive",
      });
    }
  });

  // Mutation para toggle agente
  const toggleAgentMutation = useMutation({
    mutationFn: ({ agentId, activate }: { agentId: string; activate: boolean }) => 
      apiRequest(`/api/external-agents/${agentId}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ activate })
      }),
    onSuccess: (_, { activate }) => {
      toast({
        title: activate ? "Agente activado" : "Agente desactivado",
        description: activate ? "El agente está ahora disponible para usar" : "El agente está desactivado",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/external-agents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/external-agents/stats'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo cambiar el estado del agente",
        variant: "destructive",
      });
    }
  });

  // Mutation para probar agente
  const testAgentMutation = useMutation({
    mutationFn: ({ agentId, message }: { agentId: string; message: string }) => 
      apiRequest(`/api/external-agents/${agentId}/send`, {
        method: 'POST',
        body: JSON.stringify({ 
          message,
          userInfo: { name: 'Usuario de prueba' }
        })
      }),
    onSuccess: (response) => {
      if (response.success) {
        setTestResponse(response.response);
        toast({
          title: "¡Prueba exitosa!",
          description: "El agente respondió correctamente.",
        });
      } else {
        toast({
          title: "Error en prueba",
          description: response.error || "El agente no pudo responder",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo probar el agente",
        variant: "destructive",
      });
    }
  });

  const handleAddAgent = () => {
    if (!newAgent.id || !newAgent.name || !newAgent.url) {
      toast({
        title: "Campos requeridos",
        description: "Por favor completa ID, nombre y URL",
        variant: "destructive",
      });
      return;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (newAgent.apiKey) {
      if (newAgent.requestFormat === 'openai') {
        headers['Authorization'] = `Bearer ${newAgent.apiKey}`;
      } else {
        headers['X-API-Key'] = newAgent.apiKey;
      }
    }

    addAgentMutation.mutate({
      ...newAgent,
      headers
    });
  };

  const handleTestAgent = () => {
    if (!selectedAgent || !testMessage.trim()) {
      toast({
        title: "Campos requeridos",
        description: "Selecciona un agente y escribe un mensaje de prueba",
        variant: "destructive",
      });
      return;
    }

    testAgentMutation.mutate({
      agentId: selectedAgent,
      message: testMessage
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bot className="h-8 w-8" />
            Agentes Externos
          </h1>
          <p className="text-muted-foreground">
            Configura y gestiona agentes externos para respuestas automatizadas
          </p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Agregar Agente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Agregar Agente Externo</DialogTitle>
              <DialogDescription>
                Configura un nuevo agente externo para integrar con el sistema
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="agent-id">ID del Agente</Label>
                <Input
                  id="agent-id"
                  value={newAgent.id}
                  onChange={(e) => setNewAgent(prev => ({ ...prev, id: e.target.value }))}
                  placeholder="mi-agente-personalizado"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="agent-name">Nombre</Label>
                <Input
                  id="agent-name"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Mi Agente Personalizado"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="agent-url">URL del Endpoint</Label>
                <Input
                  id="agent-url"
                  value={newAgent.url}
                  onChange={(e) => setNewAgent(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://api.mi-agente.com/chat"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="agent-format">Formato de Request</Label>
                <Select
                  value={newAgent.requestFormat}
                  onValueChange={(value: 'openai' | 'custom') => 
                    setNewAgent(prev => ({ ...prev, requestFormat: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">Compatible con OpenAI</SelectItem>
                    <SelectItem value="custom">Formato Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="agent-key">API Key (Opcional)</Label>
                <Input
                  id="agent-key"
                  type="password"
                  value={newAgent.apiKey}
                  onChange={(e) => setNewAgent(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="sk-..."
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                type="submit" 
                onClick={handleAddAgent}
                disabled={addAgentMutation.isPending}
              >
                {addAgentMutation.isPending ? 'Agregando...' : 'Agregar Agente'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="agents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="agents">Agentes</TabsTrigger>
          <TabsTrigger value="test">Probar Agentes</TabsTrigger>
          <TabsTrigger value="stats">Estadísticas</TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="space-y-4">
          {loadingAgents ? (
            <div className="text-center py-8">Cargando agentes...</div>
          ) : agents.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No hay agentes configurados</h3>
                <p className="text-muted-foreground mb-4">
                  Agrega tu primer agente externo para comenzar
                </p>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Agente
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {agents.map((agent: ExternalAgent) => (
                <Card key={agent.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{agent.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant={agent.isActive ? "default" : "secondary"}>
                          {agent.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                        <Switch
                          checked={agent.isActive}
                          onCheckedChange={(checked) => 
                            toggleAgentMutation.mutate({ 
                              agentId: agent.id, 
                              activate: checked 
                            })
                          }
                          disabled={toggleAgentMutation.isPending}
                        />
                      </div>
                    </div>
                    <CardDescription>ID: {agent.id}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">URL:</span> 
                        <br />
                        <span className="text-muted-foreground break-all">{agent.url}</span>
                      </div>
                      <div>
                        <span className="font-medium">Formato:</span> 
                        <Badge variant="outline" className="ml-1">
                          {agent.requestFormat || 'custom'}
                        </Badge>
                      </div>
                      <div>
                        <span className="font-medium">API Key:</span> 
                        <span className="text-muted-foreground ml-1">
                          {agent.apiKey ? '••••••••' : 'No configurada'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Probar Agente
              </CardTitle>
              <CardDescription>
                Envía un mensaje de prueba a un agente para verificar su funcionamiento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="test-agent">Seleccionar Agente</Label>
                <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un agente para probar" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.filter((agent: ExternalAgent) => agent.isActive).map((agent: ExternalAgent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="test-message">Mensaje de Prueba</Label>
                <Textarea
                  id="test-message"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Escribe un mensaje para probar el agente..."
                  rows={3}
                />
              </div>
              
              <Button 
                onClick={handleTestAgent}
                disabled={testAgentMutation.isPending || !selectedAgent || !testMessage.trim()}
              >
                {testAgentMutation.isPending ? 'Enviando...' : 'Probar Agente'}
              </Button>
              
              {testResponse && (
                <div className="grid gap-2">
                  <Label>Respuesta del Agente</Label>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="whitespace-pre-wrap">{testResponse}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Agentes</CardTitle>
                <Bot className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalAgents || 0}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Agentes Activos</CardTitle>
                <Power className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats?.activeAgents || 0}</div>
              </CardContent>
            </Card>
          </div>
          
          {stats?.agentList && stats.agentList.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Lista de Agentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats.agentList.map((agent) => (
                    <div key={agent.id} className="flex items-center justify-between p-2 border rounded">
                      <span className="font-medium">{agent.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">ID: {agent.id}</span>
                        {agent.isActive ? (
                          <Power className="h-4 w-4 text-green-600" />
                        ) : (
                          <PowerOff className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}