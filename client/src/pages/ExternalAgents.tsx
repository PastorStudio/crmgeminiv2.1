import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Link as LinkIcon, CheckCircle, XCircle, Bot, Trash2, Settings, Timer, MessageSquare, Eye, Send, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ExternalAgent {
  id: string;
  name: string;
  agentUrl: string;
  description?: string;
  triggerKeywords?: string[];
  isActive: boolean;
  responseDelay?: number;
  accountId?: number;
}

interface AgentStats {
  totalAgents: number;
  activeAgents: number;
  agentsByUrl: Record<string, number>;
}

interface PreviewResult {
  success: boolean;
  agent: string;
  agentUrl: string;
  previews: Array<{
    message: string;
    response: string;
    responseTime: number;
    success: boolean;
    confidence?: number;
  }>;
  totalTests: number;
  successfulTests: number;
}

export default function ExternalAgents() {
  const [agents, setAgents] = useState<ExternalAgent[]>([]);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAgentUrl, setNewAgentUrl] = useState('');
  const [newAgentKeywords, setNewAgentKeywords] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingAgent, setEditingAgent] = useState<ExternalAgent | null>(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewAgent, setPreviewAgent] = useState<ExternalAgent | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [testMessages, setTestMessages] = useState<string[]>([
    'Hola, ¿cómo estás?',
    '¿Podrías ayudarme con información sobre sus servicios?',
    'Gracias por tu ayuda',
    '¿Cuáles son sus horarios de atención?'
  ]);
  const { toast } = useToast();

  useEffect(() => {
    fetchAgents();
    fetchStats();
  }, []);

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/external-agents');
      const data = await response.json();
      setAgents(data.agents || []);
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los agentes intermediarios",
        variant: "destructive"
      });
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/external-agents/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const createAgentFromUrl = async () => {
    if (!newAgentUrl.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa la URL del agente",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const keywords = newAgentKeywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k);

      const response = await fetch('/api/external-agents/create-from-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentUrl: newAgentUrl.trim(),
          triggerKeywords: keywords
        }),
      });

      const data = await response.json();
      console.log('Respuesta del servidor:', data);

      if (data.success && data.agent) {
        toast({
          title: "¡Éxito!",
          description: `Agente "${data.agent.name}" creado exitosamente`
        });
        setShowAddForm(false);
        setNewAgentUrl('');
        setNewAgentKeywords('');
        fetchAgents();
        fetchStats();
      } else {
        console.error('Error en respuesta:', data);
        throw new Error(data.error || 'Error al crear agente');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el agente intermediario",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleAgent = async (agentId: string, isActive: boolean) => {
    try {
      const endpoint = isActive ? 'activate' : 'deactivate';
      const response = await fetch(`/api/external-agents/${agentId}/${endpoint}`, {
        method: 'POST',
      });

      if (response.ok) {
        toast({
          title: "Éxito",
          description: `Agente ${isActive ? 'activado' : 'desactivado'} exitosamente`
        });
        fetchAgents();
        fetchStats();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cambiar el estado del agente",
        variant: "destructive"
      });
    }
  };

  const deleteAgent = async (agentId: string) => {
    try {
      const response = await fetch(`/api/external-agents/${agentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: "Éxito",
          description: "Agente eliminado exitosamente"
        });
        fetchAgents();
        fetchStats();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el agente",
        variant: "destructive"
      });
    }
  };

  const updateAgentConfig = async (agentId: string, updates: Partial<ExternalAgent>) => {
    try {
      const response = await fetch(`/api/external-agents/${agentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        toast({
          title: "Éxito",
          description: "Configuración del agente actualizada exitosamente"
        });
        fetchAgents();
        fetchStats();
        setShowConfigDialog(false);
        setEditingAgent(null);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar la configuración del agente",
        variant: "destructive"
      });
    }
  };

  const openConfigDialog = (agent: ExternalAgent) => {
    setEditingAgent(agent);
    setShowConfigDialog(true);
  };

  const testAgent = async (agentId: string) => {
    try {
      const response = await fetch(`/api/external-agents/${agentId}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: "Hola, esta es una prueba del sistema de agentes",
          chatId: "test-chat",
          accountId: 1
        }),
      });

      if (response.ok) {
        toast({
          title: "Prueba exitosa",
          description: "El agente respondió correctamente"
        });
      }
    } catch (error) {
      toast({
        title: "Error en prueba",
        description: "No se pudo probar el agente",
        variant: "destructive"
      });
    }
  };

  const getUrlDomain = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return 'URL inválida';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Agentes Intermediarios</h1>
          <p className="text-gray-600 mt-2">
            Conecta agentes externos como ChatGPT, Claude, etc. como intermediarios automáticos
          </p>
        </div>
        <Button onClick={() => setShowAddForm(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Agregar Agente
        </Button>
      </div>

      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total de Agentes</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalAgents}</p>
                </div>
                <Bot className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Agentes Activos</p>
                  <p className="text-2xl font-bold text-green-600">{stats.activeAgents}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Plataformas</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {Object.keys(stats.agentsByUrl).length}
                  </p>
                </div>
                <LinkIcon className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Formulario para agregar agente */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Agregar Agente Intermediario</CardTitle>
            <CardDescription>
              Simplemente pega la URL de tu agente (ChatGPT, Claude, etc.) y el sistema lo configurará automáticamente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="agentUrl">URL del Agente *</Label>
              <Input
                id="agentUrl"
                placeholder="https://chatgpt.com/g/g-682ceb8bfa4c81918b3ff66abe6f3480-smartbots"
                value={newAgentUrl}
                onChange={(e) => setNewAgentUrl(e.target.value)}
                className="mt-1"
              />
              <p className="text-sm text-gray-500 mt-1">
                Ejemplos: ChatGPT GPTs, Claude, Gemini, etc.
              </p>
            </div>

            <div>
              <Label htmlFor="keywords">Palabras Clave (opcional)</Label>
              <Input
                id="keywords"
                placeholder="precio, venta, soporte, ayuda"
                value={newAgentKeywords}
                onChange={(e) => setNewAgentKeywords(e.target.value)}
                className="mt-1"
              />
              <p className="text-sm text-gray-500 mt-1">
                Separadas por comas. El agente responderá cuando detecte estas palabras.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowAddForm(false);
                  setNewAgentUrl('');
                  setNewAgentKeywords('');
                }}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button onClick={createAgentFromUrl} disabled={loading}>
                {loading ? 'Creando...' : 'Crear Agente'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de agentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {agents.map((agent) => (
          <Card key={agent.id} className="relative">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">🤖</div>
                  <div>
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {getUrlDomain(agent.agentUrl)}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={agent.isActive}
                    onCheckedChange={(checked) => toggleAgent(agent.id, checked)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openConfigDialog(agent)}
                    className="text-blue-600 hover:text-blue-700"
                    title="Configuración Avanzada"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => testAgent(agent.id)}
                    className="text-green-600 hover:text-green-700"
                    title="Probar Agente"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteAgent(agent.id)}
                    className="text-red-600 hover:text-red-700"
                    title="Eliminar Agente"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                {agent.isActive ? (
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Activo
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800">
                    <XCircle className="w-3 h-3 mr-1" />
                    Inactivo
                  </Badge>
                )}
                <Badge variant="outline">{getUrlDomain(agent.agentUrl)}</Badge>
              </div>

              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" />
                  <span className="truncate">{agent.agentUrl}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>⏱️</span>
                  <span>Delay: {agent.responseDelay || 3}s</span>
                </div>
              </div>

              {agent.triggerKeywords && agent.triggerKeywords.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Palabras Clave:</p>
                  <div className="flex flex-wrap gap-1">
                    {agent.triggerKeywords.slice(0, 4).map((keyword, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                    {agent.triggerKeywords.length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{agent.triggerKeywords.length - 4} más
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {agents.length === 0 && (
          <div className="col-span-full">
            <Card>
              <CardContent className="py-12 text-center">
                <Bot className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No hay agentes configurados
                </h3>
                <p className="text-gray-600 mb-4">
                  Conecta tu primer agente externo para comenzar a automatizar respuestas
                </p>
                <Button onClick={() => setShowAddForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Primer Agente
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Información adicional */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <h3 className="font-semibold text-blue-900 mb-2">💡 ¿Cómo funciona?</h3>
          <div className="text-blue-800 space-y-2 text-sm">
            <p>1. <strong>Mensaje entrante:</strong> Tu cliente envía un mensaje a WhatsApp (burbuja verde)</p>
            <p>2. <strong>Detección automática:</strong> El sistema detecta palabras clave y selecciona el agente apropiado</p>
            <p>3. <strong>Procesamiento:</strong> El mensaje se envía al agente externo como si fuera un usuario normal</p>
            <p>4. <strong>Respuesta automática:</strong> La respuesta del agente se envía al cliente como mensaje tuyo (burbuja azul)</p>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo de Configuración Avanzada */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Configuración Avanzada - {editingAgent?.name}
            </DialogTitle>
            <DialogDescription>
              Personaliza el comportamiento y configuraciones específicas de este agente
            </DialogDescription>
          </DialogHeader>
          
          {editingAgent && (
            <div className="space-y-6">
              {/* Tiempo de Respuesta */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Timer className="w-4 h-4" />
                  Tiempo de Respuesta (segundos)
                </Label>
                <Select
                  value={editingAgent.responseDelay?.toString() || "3"}
                  onValueChange={(value) => 
                    setEditingAgent({...editingAgent, responseDelay: parseInt(value)})
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tiempo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 segundo (Inmediato)</SelectItem>
                    <SelectItem value="2">2 segundos (Rápido)</SelectItem>
                    <SelectItem value="3">3 segundos (Normal)</SelectItem>
                    <SelectItem value="5">5 segundos (Pensando)</SelectItem>
                    <SelectItem value="8">8 segundos (Reflexivo)</SelectItem>
                    <SelectItem value="10">10 segundos (Detallado)</SelectItem>
                    <SelectItem value="15">15 segundos (Análisis profundo)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-600">
                  Tiempo que espera antes de enviar la respuesta automática
                </p>
              </div>

              {/* Palabras Clave */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Palabras Clave de Activación
                </Label>
                <Input
                  value={editingAgent.triggerKeywords?.join(', ') || ''}
                  onChange={(e) => 
                    setEditingAgent({
                      ...editingAgent, 
                      triggerKeywords: e.target.value.split(',').map(k => k.trim()).filter(k => k)
                    })
                  }
                  placeholder="ayuda, consulta, información, soporte..."
                />
                <p className="text-sm text-gray-600">
                  Palabras que activan este agente (separadas por comas)
                </p>
              </div>

              {/* Configuraciones Específicas */}
              <div className="space-y-3">
                <Label>Configuraciones Específicas</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={editingAgent.isActive}
                      onCheckedChange={(checked) => 
                        setEditingAgent({...editingAgent, isActive: checked})
                      }
                    />
                    <Label className="text-sm">Agente Activo</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={editingAgent.accountId === 1}
                      onCheckedChange={(checked) => 
                        setEditingAgent({...editingAgent, accountId: checked ? 1 : 2})
                      }
                    />
                    <Label className="text-sm">Cuenta Principal</Label>
                  </div>
                </div>
              </div>

              {/* Información del Agente */}
              <div className="space-y-3">
                <Label>Información del Agente</Label>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Nombre:</span>
                    <span>{editingAgent.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">URL:</span>
                    <span className="truncate max-w-[200px]">{editingAgent.agentUrl}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Estado:</span>
                    <Badge className={editingAgent.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                      {editingAgent.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="flex justify-between pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => testAgent(editingAgent.id)}
                  className="text-green-600 border-green-300 hover:bg-green-50"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Probar Agente
                </Button>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowConfigDialog(false);
                      setEditingAgent(null);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={() => updateAgentConfig(editingAgent.id, editingAgent)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Guardar Cambios
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}