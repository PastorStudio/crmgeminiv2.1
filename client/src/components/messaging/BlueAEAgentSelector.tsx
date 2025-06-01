import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Bot, Zap } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  agentUrl: string;
  status: string;
}

interface BlueAEAgentSelectorProps {
  onAgentSelect: (agentId: string | null) => void;
  selectedAgentId: string | null;
}

export function BlueAEAgentSelector({ onAgentSelect, selectedAgentId }: BlueAEAgentSelectorProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);

  // Cargar agentes externos
  useEffect(() => {
    const loadAgents = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/external-agents');
        const data = await response.json();
        
        if (data.success && data.agents) {
          setAgents(data.agents);
          console.log('🎯 SELECTOR AZUL A.E. - Agentes cargados:', data.agents.length);
        }
      } catch (error) {
        console.error('Error cargando agentes para selector azul A.E.:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAgents();
  }, []);

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  return (
    <div className="flex items-center gap-2">
      {/* Icono del selector */}
      <Zap className="h-4 w-4 text-blue-500" />
      
      {/* Selector de agente para botón azul A.E. */}
      <Select
        value={selectedAgentId || "none"}
        onValueChange={(value) => {
          const agentId = value === "none" ? null : value;
          onAgentSelect(agentId);
          console.log('🎯 SELECTOR AZUL A.E. - Agente seleccionado:', agentId);
        }}
        disabled={loading}
      >
        <SelectTrigger className="w-40 h-7 text-xs border-blue-300 focus:border-blue-500">
          <SelectValue placeholder="Agente A.E." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">
            <div className="flex items-center gap-2 text-gray-500">
              <Bot className="h-3 w-3" />
              Sin agente
            </div>
          </SelectItem>
          {agents.map((agent) => (
            <SelectItem key={agent.id} value={agent.id}>
              <div className="flex items-center gap-2">
                <Bot className="h-3 w-3 text-blue-500" />
                <span className="text-xs">{agent.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Indicador del agente seleccionado */}
      {selectedAgent && (
        <Badge 
          variant="outline" 
          className="bg-blue-50 border-blue-300 text-blue-700 text-xs px-2 py-0"
        >
          <Bot className="h-3 w-3 mr-1" />
          {selectedAgent.name}
        </Badge>
      )}
    </div>
  );
}