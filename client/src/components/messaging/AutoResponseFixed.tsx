import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Bot, Loader2 } from 'lucide-react';

interface AutoResponseFixedProps {
  accountId: number;
}

export function AutoResponseFixed({ accountId }: AutoResponseFixedProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Verificar estado inicial desde DeepSeek
  useEffect(() => {
    checkStatus();
  }, [accountId]);

  const checkStatus = async () => {
    try {
      const response = await fetch(`/api/deepseek/status/${accountId}`);
      const data = await response.json();
      
      console.log('📊 Estado DeepSeek cargado:', data);
      
      if (data.success) {
        setIsEnabled(data.isActive || false);
      }
    } catch (error) {
      console.error('❌ Error verificando estado:', error);
    }
  };

  const toggleAutoResponse = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      const endpoint = isEnabled 
        ? '/bypass/deepseek-deactivate'
        : '/bypass/deepseek-activate';
      
      console.log(`🚀 ${isEnabled ? 'Desactivando' : 'Activando'} DeepSeek para cuenta ${accountId}`);
      console.log('🔗 Usando endpoint bypass:', endpoint);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId,
          companyName: 'Mi Empresa',
          responseDelay: 3,
          systemPrompt: 'Eres un asistente profesional que ayuda a los clientes'
        })
      });

      console.log('📊 Status de respuesta:', response.status);
      console.log('📊 Response OK:', response.ok);

      if (!response.ok) {
        console.error('❌ Respuesta no exitosa:', response.status, response.statusText);
        throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
      }

      const responseText = await response.text();
      console.log('📊 Respuesta como texto:', responseText);

      const data = JSON.parse(responseText);
      console.log('📊 Respuesta parseada:', data);

      if (data.success) {
        setIsEnabled(!isEnabled);
        
        // Mostrar toast de éxito
        toast({
          title: `✅ ${isEnabled ? 'Desactivado' : 'Activado'}`,
          description: data.message || 'Estado cambiado correctamente',
        });
        
        console.log(`✅ ${isEnabled ? 'Desactivado' : 'Activado'} correctamente`);
      } else {
        console.error('❌ Error del servidor:', data.error);
        toast({
          title: "Error",
          description: data.error || "No se pudo cambiar el estado",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('❌ Error completo:', error);
      toast({
        title: "Error de conexión", 
        description: `Error: ${(error as Error).message || 'No se pudo conectar con el servidor'}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
      <div className="flex items-center gap-2">
        <Bot className="h-5 w-5 text-blue-600" />
        <span className="font-medium text-sm text-gray-700">DeepSeek AI</span>
      </div>
      
      <div className="flex items-center gap-2">
        <Switch
          checked={isEnabled}
          onCheckedChange={toggleAutoResponse}
          disabled={isLoading}
        />
        
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
        
        <Badge variant={isEnabled ? "default" : "secondary"} className={isEnabled ? "bg-green-500" : ""}>
          {isEnabled ? "Activo" : "Inactivo"}
        </Badge>
      </div>
      
      {isEnabled && (
        <div className="text-xs text-green-600 font-medium">
          ✨ Respondiendo automáticamente
        </div>
      )}
    </div>
  );
}