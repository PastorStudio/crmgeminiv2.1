import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Bot, Zap, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface AutoResponseToggleProps {
  accountId: number;
  agentName?: string;
}

export function AutoResponseToggle({ accountId, agentName = "Smart Assistant" }: AutoResponseToggleProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<any>(null);

  // Verificar estado inicial
  useEffect(() => {
    checkStatus();
  }, [accountId]);

  const checkStatus = async () => {
    try {
      const response = await fetch(`/bypass/deepseek-status/${accountId}`);
      const data = await response.json();
      
      if (data.success) {
        setStatus(data);
        setIsEnabled(data.isActive || false);
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  };

  const toggleAutoResponse = async () => {
    setIsLoading(true);
    
    try {
      const endpoint = isEnabled 
        ? `/bypass/deepseek-deactivate`
        : `/bypass/deepseek-activate`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accountId })
      });

      const data = await response.json();

      if (data.success) {
        setIsEnabled(!isEnabled);
        toast({
          title: isEnabled ? "Respuestas automáticas desactivadas" : "Respuestas automáticas activadas",
          description: data.message,
        });
        
        // Actualizar estado
        await checkStatus();
      } else {
        toast({
          title: "Error",
          description: data.error || "No se pudo cambiar el estado",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error toggling auto response:', error);
      toast({
        title: "Error",
        description: "Error de conexión",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
      <div className="flex items-center gap-2">
        <Bot className="h-5 w-5 text-blue-600" />
        <span className="font-medium text-sm">Respuestas Automáticas</span>
      </div>
      
      <div className="flex items-center gap-2">
        <Switch
          checked={isEnabled}
          onCheckedChange={toggleAutoResponse}
          disabled={isLoading}
        />
        
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        
        <Badge variant={isEnabled ? "default" : "secondary"}>
          {isEnabled ? "Activo" : "Inactivo"}
        </Badge>
      </div>

      {isEnabled && (
        <div className="flex items-center gap-1 text-xs text-green-600">
          <Zap className="h-3 w-3" />
          <span>Con {agentName}</span>
        </div>
      )}

      {status && status.running && (
        <Badge variant="outline" className="text-xs">
          {status.activeAccounts} cuenta(s) activa(s)
        </Badge>
      )}
    </div>
  );
}