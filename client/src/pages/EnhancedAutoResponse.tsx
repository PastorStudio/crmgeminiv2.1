import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Languages, 
  Bot, 
  UserCheck, 
  MessageSquare, 
  Settings, 
  Play, 
  Pause,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface TranslatorConfig {
  accountId: number;
  enabled: boolean;
  targetLanguage: string;
}

interface ChatControl {
  chatId: string;
  accountId: number;
  status: 'active' | 'paused';
  lastActivity: string;
}

export default function EnhancedAutoResponse() {
  const [translatorConfigs, setTranslatorConfigs] = useState<TranslatorConfig[]>([]);
  const [chatControls, setChatControls] = useState<ChatControl[]>([]);
  const [loading, setLoading] = useState(false);
  const [newChatId, setNewChatId] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<number>(1);
  const { toast } = useToast();

  // Cargar configuraciones iniciales
  useEffect(() => {
    loadConfigurations();
  }, []);

  const loadConfigurations = async () => {
    setLoading(true);
    try {
      // Cargar configuraciones del traductor y chats activos
      // En implementación real, estos datos vendrían de la API
      setTranslatorConfigs([
        { accountId: 1, enabled: true, targetLanguage: 'es' }
      ]);
      
      setChatControls([
        { chatId: '12016671859@c.us', accountId: 1, status: 'active', lastActivity: '2 minutos' }
      ]);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las configuraciones",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleTranslator = async (accountId: number, enabled: boolean, targetLanguage: string = 'es') => {
    setLoading(true);
    try {
      const response = await fetch('/api/auto-response/toggle-translator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, enabled, targetLanguage })
      });

      const data = await response.json();

      if (data.success) {
        setTranslatorConfigs(prev => 
          prev.map(config => 
            config.accountId === accountId 
              ? { ...config, enabled, targetLanguage }
              : config
          )
        );

        toast({
          title: "Traductor actualizado",
          description: data.message
        });
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el traductor",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const pauseChatResponses = async (chatId: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/auto-response/pause-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId })
      });

      const data = await response.json();

      if (data.success) {
        setChatControls(prev =>
          prev.map(chat =>
            chat.chatId === chatId
              ? { ...chat, status: 'paused' }
              : chat
          )
        );

        toast({
          title: "Chat pausado",
          description: data.message
        });
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo pausar el chat",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const resumeChatResponses = async (chatId: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/auto-response/resume-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId })
      });

      const data = await response.json();

      if (data.success) {
        setChatControls(prev =>
          prev.map(chat =>
            chat.chatId === chatId
              ? { ...chat, status: 'active' }
              : chat
          )
        );

        toast({
          title: "Chat reanudado",
          description: data.message
        });
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo reanudar el chat",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const detectManualIntervention = async (chatId: string, accountId: number) => {
    setLoading(true);
    try {
      const response = await fetch('/api/auto-response/detect-intervention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, accountId })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Detección ejecutada",
          description: data.message
        });
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo ejecutar la detección",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const addChatControl = () => {
    if (!newChatId) {
      toast({
        title: "Error",
        description: "Ingresa un Chat ID válido",
        variant: "destructive"
      });
      return;
    }

    const newChat: ChatControl = {
      chatId: newChatId,
      accountId: selectedAccountId,
      status: 'active',
      lastActivity: 'Ahora'
    };

    setChatControls(prev => [...prev, newChat]);
    setNewChatId('');
    
    toast({
      title: "Chat agregado",
      description: `Chat ${newChatId} agregado al control`
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Bot className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Sistema de Respuestas Automáticas Mejorado</h1>
      </div>

      {/* Configuración del Traductor */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Languages className="h-5 w-5" />
            <CardTitle>Configuración del Traductor</CardTitle>
          </div>
          <CardDescription>
            Controla la traducción automática de mensajes y respuestas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {translatorConfigs.map((config) => (
            <div key={config.accountId} className="space-y-4 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Cuenta WhatsApp #{config.accountId}
                </Label>
                <Badge variant={config.enabled ? "default" : "secondary"}>
                  {config.enabled ? "Activo" : "Inactivo"}
                </Badge>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(enabled) => 
                    toggleTranslator(config.accountId, enabled, config.targetLanguage)
                  }
                  disabled={loading}
                />
                <Label htmlFor="translator-enabled">Traductor activado</Label>
              </div>

              {config.enabled && (
                <div className="space-y-2">
                  <Label htmlFor="target-language">Idioma objetivo</Label>
                  <Select
                    value={config.targetLanguage}
                    onValueChange={(value) => 
                      toggleTranslator(config.accountId, config.enabled, value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar idioma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="en">Inglés</SelectItem>
                      <SelectItem value="pt">Portugués</SelectItem>
                      <SelectItem value="fr">Francés</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Control de Chats */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            <CardTitle>Control de Chats</CardTitle>
          </div>
          <CardDescription>
            Pausa o reanuda respuestas automáticas para chats específicos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Agregar nuevo chat */}
          <div className="flex gap-2">
            <Input
              placeholder="Chat ID (ej: 12016671859@c.us)"
              value={newChatId}
              onChange={(e) => setNewChatId(e.target.value)}
              className="flex-1"
            />
            <Select value={selectedAccountId.toString()} onValueChange={(value) => setSelectedAccountId(Number(value))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Cuenta 1</SelectItem>
                <SelectItem value="2">Cuenta 2</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={addChatControl} disabled={loading}>
              Agregar
            </Button>
          </div>

          <Separator />

          {/* Lista de chats controlados */}
          <div className="space-y-3">
            {chatControls.map((chat) => (
              <div key={chat.chatId} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-1">
                  <div className="font-mono text-sm">{chat.chatId}</div>
                  <div className="text-xs text-muted-foreground">
                    Cuenta {chat.accountId} • Última actividad: {chat.lastActivity}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge variant={chat.status === 'active' ? "default" : "secondary"}>
                    {chat.status === 'active' ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Activo
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3 mr-1" />
                        Pausado
                      </>
                    )}
                  </Badge>
                  
                  {chat.status === 'active' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => pauseChatResponses(chat.chatId)}
                      disabled={loading}
                    >
                      <Pause className="h-4 w-4 mr-1" />
                      Pausar
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => resumeChatResponses(chat.chatId)}
                      disabled={loading}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Reanudar
                    </Button>
                  )}
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => detectManualIntervention(chat.chatId, chat.accountId)}
                    disabled={loading}
                  >
                    <UserCheck className="h-4 w-4 mr-1" />
                    Detectar intervención
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Información del Sistema */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle>Estado del Sistema</CardTitle>
          </div>
          <CardDescription>
            Información sobre las características avanzadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Traducción Automática</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Detecta idiomas y traduce mensajes automáticamente
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-green-500" />
                <span className="font-medium">Historial Contextual</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Respuestas basadas en el historial de conversación
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-orange-500" />
                <span className="font-medium">Detección de Intervención</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Pausa automáticamente cuando un agente humano responde
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}