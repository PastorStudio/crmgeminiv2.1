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
      console.log(`🚀 ${isEnabled ? 'Desactivando' : 'Activando'} DeepSeek para cuenta ${accountId}`);
      
      // Usar XMLHttpRequest para evitar problemas de CORS y interceptación
      const success = await new Promise<boolean>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const endpoint = isEnabled ? '/bypass/deepseek-deactivate' : '/bypass/deepseek-activate';
        
        console.log('🔗 Usando XHR para endpoint:', endpoint);
        
        xhr.open('POST', endpoint, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        
        xhr.onreadystatechange = function() {
          if (xhr.readyState === 4) {
            console.log('📊 XHR Status:', xhr.status);
            console.log('📊 XHR Response:', xhr.responseText);
            
            if (xhr.status === 200) {
              try {
                const data = JSON.parse(xhr.responseText);
                console.log('📊 Data parseada:', data);
                if (data.success) {
                  resolve(true);
                } else {
                  reject(new Error(data.error || 'Error del servidor'));
                }
              } catch (e) {
                console.error('❌ Error parseando JSON:', e);
                reject(new Error('Respuesta inválida del servidor'));
              }
            } else {
              reject(new Error(`Error HTTP: ${xhr.status}`));
            }
          }
        };
        
        xhr.onerror = function() {
          reject(new Error('Error de red'));
        };
        
        const requestData = {
          accountId,
          companyName: 'Mi Empresa',
          responseDelay: 3,
          systemPrompt: 'Eres un asistente profesional que ayuda a los clientes'
        };
        
        xhr.send(JSON.stringify(requestData));
      });

      if (success) {
        setIsEnabled(!isEnabled);
        
        // Mostrar toast de éxito
        toast({
          title: `✅ ${isEnabled ? 'Desactivado' : 'Activado'}`,
          description: 'Estado cambiado correctamente',
        });
        
        console.log(`✅ ${isEnabled ? 'Desactivado' : 'Activado'} correctamente`);
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