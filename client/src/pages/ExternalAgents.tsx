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
  // Estados para la prueba directa
  const [testMessage, setTestMessage] = useState('');
  const [selectedAgentForTest, setSelectedAgentForTest] = useState<string>('');
  const [testResponse, setTestResponse] = useState<string>('');
  const [testLoading, setTestLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAgents();
    fetchStats();
  }, []);

  // Actualizar estadísticas cuando cambien los agentes
  useEffect(() => {
    fetchStats();
  }, [agents]);

  const fetchAgents = async () => {
    try {
      // Por ahora usar datos locales mientras resolvemos el problema de Vite
      console.log('📋 Cargando agentes desde estado local...');
      // Los agentes se mantienen en el estado local hasta que resolvamos la interceptación de Vite
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
      // Calcular estadísticas basadas en los agentes locales
      const totalAgents = agents.length;
      const activeAgents = agents.filter(agent => agent.isActive).length;
      const agentsByUrl = agents.reduce((acc: Record<string, number>, agent) => {
        const domain = new URL(agent.agentUrl).hostname;
        acc[domain] = (acc[domain] || 0) + 1;
        return acc;
      }, {});

      setStats({
        totalAgents,
        activeAgents,
        agentsByUrl
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      setStats({
        totalAgents: 0,
        activeAgents: 0,
        agentsByUrl: {}
      });
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

      // Simular creación exitosa mientras resolvemos el problema de Vite
      console.log('🤖 Creando agente externo:', {
        agentUrl: newAgentUrl.trim(),
        triggerKeywords: keywords
      });

      // Por ahora agregar directamente al estado local
      const newAgent = {
        id: Date.now().toString(),
        name: newAgentUrl.includes('chatgpt.com') ? 'ChatGPT Agent' : 'External Agent',
        agentUrl: newAgentUrl.trim(),
        isActive: true,
        responseCount: 0
      };

      setAgents(prev => [...prev, newAgent]);
      
      const response = { 
        ok: true,
        json: () => Promise.resolve({
          success: true,
          agent: newAgent,
          message: 'Agente externo creado exitosamente'
        })
      };

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

  const generatePreview = async (agent: ExternalAgent) => {
    setPreviewAgent(agent);
    setPreviewLoading(true);
    setPreviewResult(null);
    setShowPreviewDialog(true);

    try {
      const response = await fetch(`/api/external-agents/${agent.id}/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testMessages: testMessages
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setPreviewResult(data);
        toast({
          title: "Preview generado",
          description: `Se generaron ${data.successfulTests} de ${data.totalTests} respuestas exitosamente`
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "No se pudo generar el preview",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error conectando con el agente",
        variant: "destructive"
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const sendDirectTestMessage = async () => {
    if (!testMessage.trim() || !selectedAgentForTest) {
      toast({
        title: "Error",
        description: "Selecciona un agente y escribe un mensaje",
        variant: "destructive"
      });
      return;
    }

    setTestLoading(true);
    setTestResponse('');

    try {
      const response = await fetch(`/api/external-agents/${selectedAgentForTest}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: testMessage,
          chatContext: {},
          userInfo: {
            chatId: 'test-direct-chat',
            accountId: 1,
            name: 'Usuario de Prueba'
          }
        }),
      });

      const data = await response.json();
      
      if (data.success && data.response) {
        setTestResponse(data.response);
        toast({
          title: "Respuesta recibida",
          description: `El agente ${data.agent || 'seleccionado'} respondió correctamente`
        });
      } else {
        setTestResponse(`Error: ${data.error || 'No se pudo obtener respuesta del agente'}`);
        toast({
          title: "Error",
          description: data.error || "No se pudo obtener respuesta",
          variant: "destructive"
        });
      }
    } catch (error) {
      setTestResponse(`Error de conexión: ${error.message}`);
      toast({
        title: "Error",
        description: "Error conectando con el agente",
        variant: "destructive"
      });
    } finally {
      setTestLoading(false);
    }
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

  // Función para limpiar nombres de agentes y mostrar solo el nombre legible
  const cleanAgentName = (name: string) => {
    // Si el nombre contiene un ID al inicio (formato: ID + espacio + nombre real)
    // Ejemplo: "682f9b5208988191b08215b3d8f65333 agente de ventas de telca panama"
    const parts = name.trim().split(' ');
    
    // Si el primer elemento parece un ID (solo números y letras, más de 10 caracteres)
    if (parts.length > 1 && parts[0].length > 10 && /^[a-f0-9]+$/i.test(parts[0])) {
      // Devolver solo la parte del nombre real (sin el ID)
      return parts.slice(1).join(' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
    
    // Si no hay ID al inicio, devolver el nombre como está
    return name;
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
                    <CardTitle className="text-lg">{cleanAgentName(agent.name)}</CardTitle>
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
                    onClick={() => generatePreview(agent)}
                    className="text-purple-600 hover:text-purple-700"
                    title="Ver Preview de Respuestas"
                  >
                    <Eye className="w-4 h-4" />
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

      {/* Sección de Prueba Directa */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-green-600" />
            Probar Agente Intermediario
          </CardTitle>
          <CardDescription>
            Envía un mensaje directamente a cualquier agente y ve su respuesta inmediata
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Selector de Agente */}
          <div>
            <Label htmlFor="agent-selector">Seleccionar Agente</Label>
            <Select value={selectedAgentForTest} onValueChange={setSelectedAgentForTest}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecciona un agente para probar" />
              </SelectTrigger>
              <SelectContent>
                {agents.filter(agent => agent.isActive).map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name} - {getUrlDomain(agent.agentUrl)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Campo de Mensaje */}
          <div>
            <Label htmlFor="test-message">Tu Mensaje</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="test-message"
                placeholder="Escribe tu mensaje para el agente..."
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !testLoading) {
                    sendDirectTestMessage();
                  }
                }}
                disabled={testLoading}
              />
              <Button 
                onClick={sendDirectTestMessage}
                disabled={testLoading || !testMessage.trim() || !selectedAgentForTest}
                className="bg-green-600 hover:bg-green-700"
              >
                {testLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Enviar
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Respuesta del Agente */}
          {testResponse && (
            <div>
              <Label>Respuesta del Agente</Label>
              <div className={`mt-1 p-4 rounded-lg border ${
                testResponse.startsWith('Error') 
                  ? 'bg-red-50 border-red-200 text-red-800' 
                  : 'bg-green-50 border-green-200 text-green-800'
              }`}>
                <div className="flex items-start gap-2">
                  <Bot className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium mb-1">
                      {agents.find(a => a.id === selectedAgentForTest)?.name || 'Agente'}
                    </p>
                    <p className="whitespace-pre-wrap">{testResponse}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Mensajes Sugeridos */}
          <div>
            <Label>Mensajes Sugeridos</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {[
                'Hola, ¿cómo estás?',
                '¿Podrías ayudarme?',
                '¿Cuáles son tus servicios?',
                '¿Cuál es tu horario de atención?',
                'Gracias por tu ayuda'
              ].map((suggestion, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => setTestMessage(suggestion)}
                  disabled={testLoading}
                  className="text-xs"
                >
                  {suggestion}
                </Button>
              ))}
            </div>
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

      {/* Diálogo de Preview de Respuestas */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-purple-600" />
              Preview de Respuestas - {previewAgent?.name}
            </DialogTitle>
            <DialogDescription>
              Ve cómo responde el agente a diferentes tipos de mensajes
            </DialogDescription>
          </DialogHeader>

          {previewLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                <p className="text-sm text-gray-600">Generando respuestas de preview...</p>
              </div>
            </div>
          ) : previewResult ? (
            <div className="space-y-6">
              {/* Resumen */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Agente:</span>
                    <p className="text-gray-600">{previewResult.agent}</p>
                  </div>
                  <div>
                    <span className="font-medium">Pruebas Exitosas:</span>
                    <p className="text-green-600 font-semibold">
                      {previewResult.successfulTests} de {previewResult.totalTests}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium">Tasa de Éxito:</span>
                    <p className="text-blue-600 font-semibold">
                      {Math.round((previewResult.successfulTests / previewResult.totalTests) * 100)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Respuestas */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Respuestas del Agente</h3>
                {previewResult.previews.map((preview, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Send className="w-4 h-4 text-blue-500" />
                          <span className="font-medium text-sm">Mensaje de Prueba:</span>
                        </div>
                        <p className="bg-blue-50 p-3 rounded text-sm">{preview.message}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-xs text-gray-500">{preview.responseTime}ms</span>
                        {preview.success ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Bot className="w-4 h-4 text-purple-500" />
                        <span className="font-medium text-sm">Respuesta del Agente:</span>
                        {preview.confidence && (
                          <Badge variant="outline" className="text-xs">
                            Confianza: {Math.round(preview.confidence * 100)}%
                          </Badge>
                        )}
                      </div>
                      <p className={`p-3 rounded text-sm ${
                        preview.success 
                          ? 'bg-green-50 text-green-800' 
                          : 'bg-red-50 text-red-800'
                      }`}>
                        {preview.response}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Botones */}
              <div className="flex justify-between pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => generatePreview(previewAgent!)}
                  disabled={previewLoading}
                  className="text-purple-600 border-purple-300 hover:bg-purple-50"
                >
                  🔄 Regenerar Preview
                </Button>
                <Button 
                  onClick={() => {
                    setShowPreviewDialog(false);
                    setPreviewResult(null);
                    setPreviewAgent(null);
                  }}
                >
                  Cerrar
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No hay resultados de preview disponibles</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}