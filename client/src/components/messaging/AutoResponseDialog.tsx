import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, MessageCircle, Save, Zap } from 'lucide-react';

interface AutoResponseConfig {
  enabled: boolean;
  template: string;
  triggerKeywords: string[];
  schedule: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };
}

interface AutoResponseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: AutoResponseConfig;
  chatId: string;
  accountId: number;
}

export function AutoResponseDialog({
  open,
  onOpenChange,
  config,
  chatId,
  accountId
}: AutoResponseDialogProps) {
  const [enabled, setEnabled] = useState(config?.enabled || false);
  const [template, setTemplate] = useState(config?.template || '');
  const [keywords, setKeywords] = useState(config?.triggerKeywords?.join(', ') || '');
  const [scheduleEnabled, setScheduleEnabled] = useState(config?.schedule?.enabled || false);
  const [startTime, setStartTime] = useState(config?.schedule?.startTime || '09:00');
  const [endTime, setEndTime] = useState(config?.schedule?.endTime || '18:00');

  const queryClient = useQueryClient();

  const updateConfigMutation = useMutation({
    mutationFn: async (data: AutoResponseConfig) => {
      const response = await fetch(`/api/auto-response/config/${chatId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update config');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auto-response/config', chatId] });
      toast({
        title: "Configuración actualizada",
        description: "La configuración de respuesta automática se ha guardado exitosamente"
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la configuración",
        variant: "destructive"
      });
    }
  });

  const handleSave = () => {
    const newConfig: AutoResponseConfig = {
      enabled,
      template,
      triggerKeywords: keywords.split(',').map(k => k.trim()).filter(k => k),
      schedule: {
        enabled: scheduleEnabled,
        startTime,
        endTime,
        timezone: 'America/Bogota'
      }
    };

    updateConfigMutation.mutate(newConfig);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-green-600" />
            <span>Configuración de Respuestas Automáticas</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Enable/Disable */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <MessageCircle className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Estado de Respuestas Automáticas</span>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={setEnabled}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-gray-600">
                {enabled 
                  ? "Las respuestas automáticas están activadas para este chat"
                  : "Las respuestas automáticas están desactivadas"
                }
              </p>
            </CardContent>
          </Card>

          {/* Template Message */}
          <div className="space-y-2">
            <Label htmlFor="template">Mensaje de Respuesta Automática</Label>
            <Textarea
              id="template"
              placeholder="Ej: Gracias por contactarnos. En este momento no estamos disponibles, pero te responderemos pronto."
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="min-h-20"
              disabled={!enabled}
            />
            <p className="text-xs text-gray-500">
              Este mensaje se enviará automáticamente cuando se cumplan las condiciones
            </p>
          </div>

          {/* Trigger Keywords */}
          <div className="space-y-2">
            <Label htmlFor="keywords">Palabras Clave de Activación</Label>
            <Input
              id="keywords"
              placeholder="Ej: hola, información, precio, ayuda"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              disabled={!enabled}
            />
            <p className="text-xs text-gray-500">
              Separa las palabras con comas. La respuesta se enviará cuando se detecten estas palabras
            </p>
          </div>

          <Separator />

          {/* Schedule Settings */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-orange-600" />
                  <span className="font-medium">Programación de Horarios</span>
                </div>
                <Switch
                  checked={scheduleEnabled}
                  onCheckedChange={setScheduleEnabled}
                  disabled={!enabled}
                />
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <p className="text-sm text-gray-600">
                {scheduleEnabled 
                  ? "Las respuestas automáticas solo se enviarán durante el horario configurado"
                  : "Las respuestas automáticas se enviarán en cualquier momento"
                }
              </p>

              {scheduleEnabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Hora de Inicio</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      disabled={!enabled}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">Hora de Fin</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      disabled={!enabled}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview */}
          {enabled && template && (
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader className="pb-3">
                <span className="font-medium text-blue-900">Vista Previa del Mensaje</span>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="bg-white p-3 rounded-lg border">
                  <p className="text-sm">{template}</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {keywords.split(',').map(keyword => keyword.trim()).filter(k => k).map((keyword, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave}
            disabled={updateConfigMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {updateConfigMutation.isPending ? 'Guardando...' : 'Guardar Configuración'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}