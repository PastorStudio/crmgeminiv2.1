/**
 * Componente para configurar respuestas automáticas con agentes externos
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Bot, Settings, TestTube } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ExternalAgent {
  id: string;
  name: string;
  agentUrl: string;
  isActive: boolean;
  responseCount: number;
}

interface AutoResponseConfig {
  accountId: number;
  assignedExternalAgentId: string | null;
  autoResponseEnabled: boolean;
  responseDelay: number;
  agentInfo?: ExternalAgent;
}

interface AutoResponseConfigProps {
  accountId: number;
  accountName: string;
}

export function AutoResponseConfig({ accountId, accountName }: AutoResponseConfigProps) {
  const [config, setConfig] = useState<AutoResponseConfig>({
    accountId,
    assignedExternalAgentId: null,
    autoResponseEnabled: false,
    responseDelay: 3
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Obtener agentes externos disponibles
  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ['/api/external-agents'],
    queryFn: async () => {
      console.log('🔍 Cargando agentes externos para AutoResponseConfig...');
      try {
        const response = await apiRequest('/api/external-agents');
        console.log('✅ Agentes cargados:', response);
        return response;
      } catch (error) {
        console.error('❌ Error cargando agentes:', error);
        throw error;
      }
    }
  });

  // Obtener configuración actual
  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: [`/api/external-agents/auto-response-config/${accountId}`],
    queryFn: () => apiRequest(`/api/external-agents/auto-response-config/${accountId}`)
  });

  // Actualizar configuración local cuando se carga la configuración del servidor
  useEffect(() => {
    if (configData?.success && configData.config) {
      setConfig(configData.config);
    }
  }, [configData]);

  // Mutation para habilitar respuesta automática
  const enableMutation = useMutation({
    mutationFn: async (data: { accountId: number; agentId: string; delay: number }) => {
      console.log('🔄 Habilitando respuesta automática:', data);
      try {
        const response = await apiRequest('/api/external-agents/enable-auto-response', {
          method: 'POST',
          body: data
        });
        console.log('✅ Respuesta del servidor:', response);
        return response;
      } catch (error) {
        console.error('❌ Error en enableMutation:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('✅ Respuesta automática habilitada exitosamente:', data);
      setConfig(prev => ({ ...prev, autoResponseEnabled: true }));
      queryClient.invalidateQueries({ queryKey: [`/api/external-agents/auto-response-config/${accountId}`] });
      toast({
        title: 'Respuesta automática habilitada',
        description: `Se habilitaron las respuestas automáticas para ${accountName}`
      });
    },
    onError: (error: any) => {
      console.error('❌ Error al habilitar respuesta automática:', error);
      toast({
        title: 'Error al habilitar',
        description: error.message || 'Error habilitando respuesta automática',
        variant: 'destructive'
      });
    }
  });

  // Mutation para deshabilitar respuesta automática
  const disableMutation = useMutation({
    mutationFn: (data: { accountId: number }) =>
      apiRequest('/api/external-agents/disable-auto-response', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/external-agents/auto-response-config/${accountId}`] });
      toast({
        title: 'Respuesta automática deshabilitada',
        description: `Se deshabilitaron las respuestas automáticas para ${accountName}`
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Error deshabilitando respuesta automática',
        variant: 'destructive'
      });
    }
  });

  // Mutation para probar agente
  const testMutation = useMutation({
    mutationFn: (data: { agentId: string; testMessage?: string }) =>
      apiRequest('/api/external-agents/test', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    onSuccess: (data) => {
      toast({
        title: 'Agente probado exitosamente',
        description: `Respuesta: ${data.test?.response?.substring(0, 100)}...`
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error probando agente',
        description: error.message || 'Error al probar el agente externo',
        variant: 'destructive'
      });
    }
  });

  const handleToggleAutoResponse = () => {
    if (config.autoResponseEnabled) {
      // Deshabilitar
      disableMutation.mutate({ accountId });
    } else {
      // Habilitar - requiere agente seleccionado
      if (!config.assignedExternalAgentId) {
        toast({
          title: 'Agente requerido',
          description: 'Selecciona un agente externo antes de habilitar respuestas automáticas',
          variant: 'destructive'
        });
        return;
      }
      
      enableMutation.mutate({
        accountId,
        agentId: config.assignedExternalAgentId,
        delay: config.responseDelay
      });
    }
  };

  const handleAgentChange = (agentId: string) => {
    setConfig(prev => ({ ...prev, assignedExternalAgentId: agentId }));
  };

  const handleDelayChange = (delay: string) => {
    const numericDelay = parseInt(delay) || 3;
    setConfig(prev => ({ ...prev, responseDelay: numericDelay }));
  };

  const handleTestAgent = () => {
    if (!config.assignedExternalAgentId) {
      toast({
        title: 'Agente requerido',
        description: 'Selecciona un agente para probar',
        variant: 'destructive'
      });
      return;
    }

    testMutation.mutate({
      agentId: config.assignedExternalAgentId,
      testMessage: 'Hola, ¿cómo estás? Esta es una prueba de conectividad.'
    });
  };

  if (configLoading || agentsLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Cargando configuración...</span>
        </CardContent>
      </Card>
    );
  }

  const agents = agentsData?.success ? agentsData.agents : [];
  const selectedAgent = agents.find((agent: ExternalAgent) => agent.id === config.assignedExternalAgentId);
  
  console.log('📊 Agentes disponibles:', agents);
  console.log('🔧 Configuración actual:', config);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Respuestas Automáticas
        </CardTitle>
        <CardDescription>
          Configura respuestas automáticas con agentes externos para {accountName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Estado actual */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="auto-response-toggle">Respuestas Automáticas</Label>
            <p className="text-sm text-muted-foreground">
              {config.autoResponseEnabled ? 'Activadas' : 'Desactivadas'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="auto-response-toggle"
              checked={config.autoResponseEnabled}
              onCheckedChange={handleToggleAutoResponse}
              disabled={enableMutation.isPending || disableMutation.isPending}
            />
            {config.autoResponseEnabled && (
              <Badge variant="default" className="bg-green-500">
                Activo
              </Badge>
            )}
          </div>
        </div>

        {/* Selección de agente */}
        <div className="space-y-2">
          <Label htmlFor="agent-select">Agente Externo</Label>
          <Select value={config.assignedExternalAgentId || ''} onValueChange={handleAgentChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un agente externo" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent: ExternalAgent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  <div className="flex items-center justify-between w-full">
                    <span>{agent.name}</span>
                    <div className="flex items-center gap-2 ml-2">
                      {agent.isActive ? (
                        <Badge variant="default" className="bg-green-500 text-xs">
                          Activo
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Inactivo
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {agent.responseCount} respuestas
                      </span>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {selectedAgent && (
            <div className="text-sm text-muted-foreground">
              <p>URL: {selectedAgent.agentUrl}</p>
              <p>Respuestas enviadas: {selectedAgent.responseCount}</p>
            </div>
          )}
        </div>

        {/* Configuración de delay */}
        <div className="space-y-2">
          <Label htmlFor="response-delay">Delay de Respuesta (segundos)</Label>
          <Input
            id="response-delay"
            type="number"
            min="1"
            max="30"
            value={config.responseDelay}
            onChange={(e) => handleDelayChange(e.target.value)}
            className="w-24"
          />
          <p className="text-sm text-muted-foreground">
            Tiempo de espera antes de enviar la respuesta automática
          </p>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestAgent}
            disabled={!config.assignedExternalAgentId || testMutation.isPending}
          >
            {testMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <TestTube className="h-4 w-4 mr-2" />
            )}
            Probar Agente
          </Button>
          
          {config.autoResponseEnabled && selectedAgent && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                enableMutation.mutate({
                  accountId,
                  agentId: config.assignedExternalAgentId!,
                  delay: config.responseDelay
                });
              }}
              disabled={enableMutation.isPending}
            >
              {enableMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Settings className="h-4 w-4 mr-2" />
              )}
              Actualizar Configuración
            </Button>
          )}
        </div>

        {/* Información adicional */}
        {config.autoResponseEnabled && (
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Estado:</strong> Las respuestas automáticas están activas. 
              Los mensajes entrantes serán procesados por {selectedAgent?.name} 
              con un delay de {config.responseDelay} segundos.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}