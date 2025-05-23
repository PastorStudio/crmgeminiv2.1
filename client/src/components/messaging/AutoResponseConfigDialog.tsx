import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Clock, MessageSquare, User, Zap } from "lucide-react";

interface AutoResponseConfig {
  enabled: boolean;
  provider: "gemini" | "openai" | "smartbots";
  responseDelay: number; // en segundos
  languageStyle: "precise" | "dynamic";
  humanityLevel: number; // 1-5 (1=formal, 5=muy humano)
  messageLength: "short" | "medium" | "long";
  customPrompt?: string;
  businessHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

interface AutoResponseConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentConfig?: AutoResponseConfig;
  onSave: (config: AutoResponseConfig) => void;
  chatId: string;
  accountId: number;
}

export function AutoResponseConfigDialog({
  open,
  onOpenChange,
  currentConfig,
  onSave,
  chatId,
  accountId
}: AutoResponseConfigDialogProps) {
  const [config, setConfig] = useState<AutoResponseConfig>({
    enabled: true,
    provider: "smartbots",
    responseDelay: 30,
    languageStyle: "dynamic",
    humanityLevel: 3,
    messageLength: "medium",
    customPrompt: "",
    businessHours: {
      enabled: true,
      start: "09:00",
      end: "18:00"
    }
  });

  useEffect(() => {
    if (currentConfig) {
      setConfig(currentConfig);
    }
  }, [currentConfig]);

  const handleSave = () => {
    onSave(config);
    onOpenChange(false);
  };

  const getProviderDescription = (provider: string) => {
    switch (provider) {
      case "gemini":
        return "Google Gemini - Respuestas rápidas y precisas";
      case "openai":
        return "OpenAI GPT-4o - Conversaciones muy naturales";
      case "smartbots":
        return "SmartBots - Especializado en atención al cliente";
      default:
        return "";
    }
  };

  const getHumanityDescription = (level: number) => {
    switch (level) {
      case 1:
        return "Muy formal y profesional";
      case 2:
        return "Formal pero amigable";
      case 3:
        return "Equilibrado y natural";
      case 4:
        return "Casual y cercano";
      case 5:
        return "Muy humano y expresivo";
      default:
        return "Equilibrado";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-600" />
            Configuración de Respuestas Automáticas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Estado general */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Estado General
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Label htmlFor="enabled" className="text-sm font-medium">
                  Activar respuestas automáticas
                </Label>
                <Switch
                  id="enabled"
                  checked={config.enabled}
                  onCheckedChange={(enabled) => setConfig({ ...config, enabled })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Proveedor de AI */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Bot className="w-4 h-4" />
                Proveedor de Inteligencia Artificial
              </CardTitle>
              <CardDescription>
                Selecciona el motor de AI que generará las respuestas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={config.provider}
                onValueChange={(provider: "gemini" | "openai" | "smartbots") =>
                  setConfig({ ...config, provider })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="smartbots">
                    SmartBots - Especializado en atención al cliente
                  </SelectItem>
                  <SelectItem value="gemini">
                    Google Gemini - Respuestas rápidas y precisas
                  </SelectItem>
                  <SelectItem value="openai">
                    OpenAI GPT-4o - Conversaciones muy naturales
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-2">
                {getProviderDescription(config.provider)}
              </p>
            </CardContent>
          </Card>

          {/* Tiempo de respuesta */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Tiempo de Respuesta
              </CardTitle>
              <CardDescription>
                Demora antes de enviar la respuesta automática
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={config.responseDelay.toString()}
                onValueChange={(delay) =>
                  setConfig({ ...config, responseDelay: parseInt(delay) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">Inmediato (5 segundos)</SelectItem>
                  <SelectItem value="30">Rápido (30 segundos)</SelectItem>
                  <SelectItem value="60">Normal (1 minuto)</SelectItem>
                  <SelectItem value="120">Pausado (2 minutos)</SelectItem>
                  <SelectItem value="300">Lento (5 minutos)</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Estilo de lenguaje */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Estilo de Comunicación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-3 block">
                  Tipo de Lenguaje
                </Label>
                <Select
                  value={config.languageStyle}
                  onValueChange={(style: "precise" | "dynamic") =>
                    setConfig({ ...config, languageStyle: style })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="precise">
                      Preciso - Respuestas directas y concisas
                    </SelectItem>
                    <SelectItem value="dynamic">
                      Dinámico - Respuestas variadas y conversacionales
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium mb-3 block">
                  Longitud de Mensaje
                </Label>
                <Select
                  value={config.messageLength}
                  onValueChange={(length: "short" | "medium" | "long") =>
                    setConfig({ ...config, messageLength: length })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">
                      Corto - 1-2 oraciones máximo
                    </SelectItem>
                    <SelectItem value="medium">
                      Medio - 2-4 oraciones
                    </SelectItem>
                    <SelectItem value="long">
                      Largo - Respuestas detalladas
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Nivel de humanidad */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-4 h-4" />
                Nivel de Humanidad
              </CardTitle>
              <CardDescription>
                Qué tan humanas y expresivas serán las respuestas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="px-2">
                  <Slider
                    value={[config.humanityLevel]}
                    onValueChange={([value]) =>
                      setConfig({ ...config, humanityLevel: value })
                    }
                    max={5}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Formal</span>
                  <span>Equilibrado</span>
                  <span>Muy Humano</span>
                </div>
                <p className="text-sm text-center font-medium">
                  {getHumanityDescription(config.humanityLevel)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Horario comercial */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Horario Comercial</CardTitle>
              <CardDescription>
                Limitar respuestas automáticas a horarios específicos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="business-hours" className="text-sm font-medium">
                  Respetar horario comercial
                </Label>
                <Switch
                  id="business-hours"
                  checked={config.businessHours.enabled}
                  onCheckedChange={(enabled) =>
                    setConfig({
                      ...config,
                      businessHours: { ...config.businessHours, enabled }
                    })
                  }
                />
              </div>

              {config.businessHours.enabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">Hora de inicio</Label>
                    <Select
                      value={config.businessHours.start}
                      onValueChange={(start) =>
                        setConfig({
                          ...config,
                          businessHours: { ...config.businessHours, start }
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => {
                          const hour = i.toString().padStart(2, "0");
                          return (
                            <SelectItem key={hour} value={`${hour}:00`}>
                              {hour}:00
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm">Hora de fin</Label>
                    <Select
                      value={config.businessHours.end}
                      onValueChange={(end) =>
                        setConfig({
                          ...config,
                          businessHours: { ...config.businessHours, end }
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => {
                          const hour = i.toString().padStart(2, "0");
                          return (
                            <SelectItem key={hour} value={`${hour}:00`}>
                              {hour}:00
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Prompt personalizado */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Instrucciones Personalizadas</CardTitle>
              <CardDescription>
                Instrucciones adicionales para personalizar las respuestas (opcional)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Ej: Siempre mencionar que somos una empresa de tecnología. Ofrecer una demo gratuita en cada respuesta..."
                value={config.customPrompt || ""}
                onChange={(e) =>
                  setConfig({ ...config, customPrompt: e.target.value })
                }
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Botones de acción */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
              Guardar Configuración
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}