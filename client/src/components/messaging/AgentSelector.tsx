import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Bot, Loader2, Power, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Agent {
  id: string;
  name: string;
  agentUrl: string;
  status: string;
}

interface AgentSelectorProps {
  chatId: string;
  accountId: number;
  onAgentChange?: (agentId: string | null) => void;
}

export function AgentSelector({ chatId, accountId, onAgentChange }: AgentSelectorProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Cargar agentes externos
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const response = await fetch('/api/external-agents');
        const data = await response.json();
        
        if (data.success && data.agents) {
          setAgents(data.agents);
          console.log('🤖 Agentes cargados:', data.agents.length);
        }
      } catch (error) {
        console.error('Error cargando agentes:', error);
      }
    };

    loadAgents();
  }, []);

  // Cargar configuración actual
  useEffect(() => {
    const loadConfig = async () => {
      if (!chatId || !accountId) return;
      
      try {
        const response = await fetch(`/api/whatsapp-accounts/${accountId}/agent-config`);
        const data = await response.json();
        
        if (data.success && data.config) {
          setSelectedAgentId(data.config.assignedExternalAgentId);
          setIsActive(data.config.autoResponseEnabled && data.config.assignedExternalAgentId);
          console.log('📊 Configuración cargada:', data.config);
        }
      } catch (error) {
        console.error('Error cargando configuración:', error);
      }
    };

    loadConfig();
  }, [chatId, accountId]);

  // Activar/desactivar respuesta automática
  const toggleAutoResponse = async (agentId: string | null) => {
    if (!chatId || !accountId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/whatsapp-accounts/${accountId}/assign-external-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalAgentId: agentId,
          autoResponseEnabled: !!agentId
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setIsActive(!!agentId);
        setSelectedAgentId(agentId);
        
        const selectedAgent = agents.find(a => a.id === agentId);
        
        toast({
          title: agentId ? '🤖 Agente Activado' : '🔴 Agente Desactivado',
          description: agentId 
            ? `${selectedAgent?.name} responderá automáticamente a mensajes`
            : 'Respuesta automática desactivada',
        });
        
        onAgentChange?.(agentId);
      } else {
        toast({
          title: 'Error',
          description: result.message || 'No se pudo cambiar la configuración',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar con el servidor',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  return (
    <div className="flex items-center gap-2">
      {/* Selector de agente */}
      <Select
        value={selectedAgentId || "none"}
        onValueChange={(value) => {
          const agentId = value === "none" ? null : value;
          toggleAutoResponse(agentId);
        }}
        disabled={loading}
      >
        <SelectTrigger className="w-48 h-8 text-xs">
          <SelectValue placeholder="Seleccionar agente" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Sin agente</SelectItem>
          {agents.map((agent) => (
            <SelectItem key={agent.id} value={agent.id}>
              <div className="flex items-center gap-2">
                <Bot className="h-3 w-3" />
                {agent.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Indicador de estado */}
      {selectedAgent && (
        <Badge 
          variant={isActive ? "default" : "outline"} 
          className={`${
            isActive 
              ? "bg-green-600 text-white" 
              : "border-gray-300 text-gray-600"
          } text-xs`}
        >
          <div className={`w-2 h-2 rounded-full mr-1 ${
            isActive ? "bg-white animate-pulse" : "bg-gray-400"
          }`} />
          {isActive ? "Activo" : "Inactivo"}
        </Badge>
      )}

      {/* Botón de prueba (solo si está activo) */}
      {isActive && selectedAgent && (
        <Button
          size="sm"
          variant="outline"
          className="h-8 px-2 text-xs border-green-600 text-green-600 hover:bg-green-50"
          onClick={async () => {
            try {
              const response = await fetch('/api/test-agent-intermediary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  agentUrl: selectedAgent.agentUrl,
                  testMessage: "Hola, esto es una prueba del sistema de respuesta automática."
                })
              });

              const result = await response.json();
              
              if (result.success && result.response) {
                toast({
                  title: '🧪 Prueba exitosa',
                  description: `${selectedAgent.name}: "${result.response.substring(0, 60)}..."`,
                });
              } else {
                toast({
                  title: 'Error en prueba',
                  description: result.message || 'No se pudo generar respuesta',
                  variant: 'destructive',
                });
              }
            } catch (error) {
              toast({
                title: 'Error de conexión',
                description: 'No se pudo probar el agente',
                variant: 'destructive',
              });
            }
          }}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Settings className="h-3 w-3" />
          )}
          Probar
        </Button>
      )}
    </div>
  );
}