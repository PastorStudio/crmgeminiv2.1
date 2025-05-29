import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';

interface DeepSeekConfig {
  id: string;
  accountId: number;
  isEnabled: boolean;
  chatUrl: string;
  temperature: number;
  responseStyle: 'analytical' | 'creative' | 'balanced' | 'detailed';
  maxRecommendations: number;
}

interface DeepSeekRecommendationsProps {
  accountId: number;
  accountName: string;
}

export function DeepSeekRecommendations({ accountId, accountName }: DeepSeekRecommendationsProps) {
  const { toast } = useToast();
  const [config, setConfig] = useState<DeepSeekConfig>({
    id: `deepseek_${accountId}`,
    accountId,
    isEnabled: false,
    chatUrl: '',
    temperature: 0.7,
    responseStyle: 'balanced',
    maxRecommendations: 3
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, [accountId]);

  const loadConfig = async () => {
    try {
      const response = await fetch(`/api/deepseek-recommendations/status/${accountId}`);
      const data = await response.json();
      
      if (data.success && data.config) {
        setConfig(data.config);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const saveConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/deepseek-recommendations/config/${accountId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Configuración guardada",
          description: "Los cambios se han aplicado correctamente.",
        });
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRecommendations = async () => {
    if (!config.chatUrl && !config.isEnabled) {
      toast({
        title: "URL requerida",
        description: "Debe proporcionar la URL del chat de DeepSeek antes de activar.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const endpoint = config.isEnabled 
        ? `/api/deepseek-recommendations/deactivate/${accountId}`
        : `/api/deepseek-recommendations/activate/${accountId}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      const data = await response.json();
      
      if (data.success) {
        setConfig(prev => ({ ...prev, isEnabled: !prev.isEnabled }));
        toast({
          title: config.isEnabled ? "Desactivado" : "Activado",
          description: `Recomendaciones DeepSeek ${config.isEnabled ? 'desactivadas' : 'activadas'} para ${accountName}`,
        });
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cambiar el estado de las recomendaciones.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recomendaciones DeepSeek</CardTitle>
          <CardDescription>Cargando configuración...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Recomendaciones DeepSeek
          <div className="flex items-center space-x-2">
            <Switch
              checked={config.isEnabled}
              onCheckedChange={toggleRecommendations}
              disabled={loading}
            />
            <Label>
              {config.isEnabled ? 'Activado' : 'Desactivado'}
            </Label>
          </div>
        </CardTitle>
        <CardDescription>
          Configuración para la cuenta: {accountName}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="chatUrl">URL del Chat DeepSeek *</Label>
          <Input
            id="chatUrl"
            value={config.chatUrl}
            onChange={(e) => setConfig(prev => ({ ...prev, chatUrl: e.target.value }))}
            placeholder="https://chat.deepseek.com/c/..."
            type="url"
          />
          <p className="text-xs text-muted-foreground">
            Copie la URL completa de su conversación en DeepSeek
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="responseStyle">Estilo de Análisis</Label>
            <Select
              value={config.responseStyle}
              onValueChange={(value: 'analytical' | 'creative' | 'balanced' | 'detailed') => 
                setConfig(prev => ({ ...prev, responseStyle: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="analytical">Analítico</SelectItem>
                <SelectItem value="creative">Creativo</SelectItem>
                <SelectItem value="balanced">Equilibrado</SelectItem>
                <SelectItem value="detailed">Detallado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxRecommendations">Máx. Recomendaciones</Label>
            <Input
              id="maxRecommendations"
              type="number"
              value={config.maxRecommendations}
              onChange={(e) => setConfig(prev => ({ ...prev, maxRecommendations: parseInt(e.target.value) || 3 }))}
              min="1"
              max="5"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Creatividad: {config.temperature}</Label>
          <Slider
            value={[config.temperature]}
            onValueChange={(value) => setConfig(prev => ({ ...prev, temperature: value[0] }))}
            max={1}
            min={0}
            step={0.1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Conservadora</span>
            <span>Creativa</span>
          </div>
        </div>

        <div className="bg-blue-50 p-3 rounded-lg text-sm">
          <h4 className="font-medium text-blue-900">Cómo usar DeepSeek:</h4>
          <ol className="list-decimal list-inside text-blue-800 mt-1 space-y-1">
            <li>Vaya a <a href="https://chat.deepseek.com" target="_blank" rel="noopener noreferrer" className="underline">chat.deepseek.com</a></li>
            <li>Inicie una nueva conversación</li>
            <li>Copie la URL completa de la conversación</li>
            <li>Pegue la URL en el campo de arriba</li>
          </ol>
        </div>

        <Button 
          onClick={saveConfig} 
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Guardando...' : 'Guardar Configuración'}
        </Button>
      </CardContent>
    </Card>
  );
}