import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';

interface AutoResponseConfig {
  id: string;
  accountId: number;
  isEnabled: boolean;
  prompt: string;
  temperature: number;
  responseStyle: 'professional' | 'friendly' | 'casual' | 'humorous';
  responseDelay: number;
  maxTokens: number;
}

interface AutoResponseOpenAIProps {
  accountId: number;
  accountName: string;
}

export function AutoResponseOpenAI({ accountId, accountName }: AutoResponseOpenAIProps) {
  const { toast } = useToast();
  const [config, setConfig] = useState<AutoResponseConfig>({
    id: `config_${accountId}`,
    accountId,
    isEnabled: false,
    prompt: 'Eres un asistente virtual profesional. Responde de manera útil y cortés.',
    temperature: 0.7,
    responseStyle: 'professional',
    responseDelay: 3,
    maxTokens: 150
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, [accountId]);

  const loadConfig = async () => {
    try {
      const response = await fetch(`/api/auto-response-openai/status/${accountId}`);
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
      const response = await fetch(`/api/auto-response-openai/config/${accountId}`, {
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

  const toggleAutoResponse = async () => {
    setLoading(true);
    try {
      const endpoint = config.isEnabled 
        ? `/api/auto-response-openai/deactivate/${accountId}`
        : `/api/auto-response-openai/activate/${accountId}`;

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
          description: `Respuestas automáticas ${config.isEnabled ? 'desactivadas' : 'activadas'} para ${accountName}`,
        });
      } else {
        throw new Error(data.error || 'Error desconocido');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cambiar el estado de las respuestas automáticas.",
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
          <CardTitle>Respuestas Automáticas OpenAI</CardTitle>
          <CardDescription>Cargando configuración...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Respuestas Automáticas OpenAI
          <div className="flex items-center space-x-2">
            <Switch
              checked={config.isEnabled}
              onCheckedChange={toggleAutoResponse}
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
          <Label htmlFor="prompt">Prompt del Sistema</Label>
          <Textarea
            id="prompt"
            value={config.prompt}
            onChange={(e) => setConfig(prev => ({ ...prev, prompt: e.target.value }))}
            placeholder="Eres un asistente virtual profesional..."
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="responseStyle">Estilo de Respuesta</Label>
            <Select
              value={config.responseStyle}
              onValueChange={(value: 'professional' | 'friendly' | 'casual' | 'humorous') => 
                setConfig(prev => ({ ...prev, responseStyle: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Profesional</SelectItem>
                <SelectItem value="friendly">Amigable</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="humorous">Humorístico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="responseDelay">Retraso (segundos)</Label>
            <Input
              id="responseDelay"
              type="number"
              value={config.responseDelay}
              onChange={(e) => setConfig(prev => ({ ...prev, responseDelay: parseInt(e.target.value) || 3 }))}
              min="1"
              max="60"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Temperatura: {config.temperature}</Label>
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

        <div className="space-y-2">
          <Label htmlFor="maxTokens">Máximo de Tokens</Label>
          <Input
            id="maxTokens"
            type="number"
            value={config.maxTokens}
            onChange={(e) => setConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) || 150 }))}
            min="50"
            max="500"
          />
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