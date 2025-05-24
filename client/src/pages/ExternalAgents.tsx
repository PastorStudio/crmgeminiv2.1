import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Settings, Trash2, Bot, CheckCircle, XCircle, MessageSquare, Users, Clock, Brain } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ExternalAgent {
  id: string;
  name: string;
  description: string;
  chatId: string;
  accountId: number;
  triggerKeywords?: string[];
  specialization?: string;
  isActive: boolean;
  responseDelay?: number;
}

interface AgentStats {
  totalAgents: number;
  activeAgents: number;
  agentsBySpecialization: Record<string, number>;
}

export default function ExternalAgents() {
  const [agents, setAgents] = useState<ExternalAgent[]>([]);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAgent, setNewAgent] = useState<Partial<ExternalAgent>>({
    name: '',
    description: '',
    chatId: '',
    accountId: 1,
    triggerKeywords: [],
    specialization: 'general',
    isActive: true,
    responseDelay: 2
  });
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

  const addAgent = async () => {
    if (!newAgent.name || !newAgent.description || !newAgent.chatId) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos requeridos",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch('/api/external-agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newAgent,
          id: `agent-${Date.now()}`,
          triggerKeywords: typeof newAgent.triggerKeywords === 'string' 
            ? newAgent.triggerKeywords.split(',').map(k => k.trim()).filter(k => k)
            : newAgent.triggerKeywords
        }),
      });

      if (response.ok) {
        toast({
          title: "Éxito",
          description: "Agente intermediario creado exitosamente"
        });
        setShowAddForm(false);
        setNewAgent({
          name: '',
          description: '',
          chatId: '',
          accountId: 1,
          triggerKeywords: [],
          specialization: 'general',
          isActive: true,
          responseDelay: 2
        });
        fetchAgents();
        fetchStats();
      } else {
        throw new Error('Error al crear agente');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo crear el agente intermediario",
        variant: "destructive"
      });
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

  const getSpecializationColor = (specialization?: string) => {
    switch (specialization) {
      case 'ventas': return 'bg-green-100 text-green-800';
      case 'soporte': return 'bg-blue-100 text-blue-800';
      case 'informacion': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSpecializationIcon = (specialization?: string) => {
    switch (specialization) {
      case 'ventas': return '💰';
      case 'soporte': return '🔧';
      case 'informacion': return '📋';
      default: return '🤖';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Agentes Intermediarios</h1>
          <p className="text-gray-600 mt-2">
            Gestiona agentes conversacionales que responden automáticamente a mensajes específicos
          </p>
        </div>
        <Button onClick={() => setShowAddForm(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nuevo Agente
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
                  <p className="text-sm font-medium text-gray-600">Especializaciones</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {Object.keys(stats.agentsBySpecialization).length}
                  </p>
                </div>
                <Brain className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Formulario para agregar agente */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Configurar Nuevo Agente Intermediario</CardTitle>
            <CardDescription>
              Los agentes intermediarios responden automáticamente a mensajes basándose en palabras clave
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nombre del Agente *</Label>
                <Input
                  id="name"
                  placeholder="Ej: Asistente de Ventas"
                  value={newAgent.name || ''}
                  onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="chatId">ID del Chat *</Label>
                <Input
                  id="chatId"
                  placeholder="Ej: ventas@empresa.com"
                  value={newAgent.chatId || ''}
                  onChange={(e) => setNewAgent({ ...newAgent, chatId: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Descripción *</Label>
              <Textarea
                id="description"
                placeholder="Describe las funciones y especialidad de este agente"
                value={newAgent.description || ''}
                onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="specialization">Especialización</Label>
                <Select
                  value={newAgent.specialization || 'general'}
                  onValueChange={(value) => setNewAgent({ ...newAgent, specialization: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ventas">💰 Ventas</SelectItem>
                    <SelectItem value="soporte">🔧 Soporte Técnico</SelectItem>
                    <SelectItem value="informacion">📋 Información General</SelectItem>
                    <SelectItem value="general">🤖 General</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="accountId">Cuenta WhatsApp</Label>
                <Select
                  value={newAgent.accountId?.toString() || '1'}
                  onValueChange={(value) => setNewAgent({ ...newAgent, accountId: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Cuenta 1</SelectItem>
                    <SelectItem value="2">Cuenta 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="responseDelay">Delay de Respuesta (seg)</Label>
                <Input
                  id="responseDelay"
                  type="number"
                  min="1"
                  max="10"
                  value={newAgent.responseDelay || 2}
                  onChange={(e) => setNewAgent({ ...newAgent, responseDelay: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="keywords">Palabras Clave (separadas por comas)</Label>
              <Input
                id="keywords"
                placeholder="Ej: precio, comprar, venta, cotización"
                value={Array.isArray(newAgent.triggerKeywords) 
                  ? newAgent.triggerKeywords.join(', ') 
                  : newAgent.triggerKeywords || ''}
                onChange={(e) => setNewAgent({ 
                  ...newAgent, 
                  triggerKeywords: e.target.value.split(',').map(k => k.trim()).filter(k => k)
                })}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowAddForm(false)}
              >
                Cancelar
              </Button>
              <Button onClick={addAgent}>
                Crear Agente
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
                  <div className="text-2xl">
                    {getSpecializationIcon(agent.specialization)}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {agent.description}
                    </CardDescription>
                  </div>
                </div>
                <Switch
                  checked={agent.isActive}
                  onCheckedChange={(checked) => toggleAgent(agent.id, checked)}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge className={getSpecializationColor(agent.specialization)}>
                  {agent.specialization || 'general'}
                </Badge>
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
              </div>

              <div className="text-sm text-gray-600 space-y-1">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  <span>Chat ID: {agent.chatId}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>Cuenta WhatsApp: {agent.accountId}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Delay: {agent.responseDelay || 2}s</span>
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
                  Crea tu primer agente intermediario para comenzar a automatizar respuestas
                </p>
                <Button onClick={() => setShowAddForm(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Primer Agente
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}