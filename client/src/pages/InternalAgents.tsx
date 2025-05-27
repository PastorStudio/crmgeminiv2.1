import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Shield, 
  Activity, 
  Calendar, 
  Clock,
  Eye,
  BarChart3,
  UserCheck,
  Settings,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface InternalAgent {
  id: number;
  name: string;
  email: string;
  department?: string;
  status: string;
  role: string;
  specialization?: string;
  maxChats: number;
  currentChats: number;
  permissions?: string[];
  avatar?: string;
  workSchedule?: any;
  skills?: string[];
  language: string;
  createdAt: string;
  updatedAt?: string;
  lastLogin?: string;
  totalLogins?: number;
  lastActivity?: string;
}

interface AgentActivity {
  id: number;
  agentId: number;
  action: string;
  page: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionToken?: string;
  timestamp: string;
}

interface ActivityStats {
  totalSessions: number;
  lastLogin: string;
  totalPageViews: number;
  mostVisitedPages: string[];
  averageSessionTime: number;
}

export default function InternalAgents() {
  const [agents, setAgents] = useState<InternalAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState<InternalAgent | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<InternalAgent | null>(null);
  const [showActivities, setShowActivities] = useState(false);
  const [agentActivities, setAgentActivities] = useState<AgentActivity[]>([]);
  const [activityStats, setActivityStats] = useState<ActivityStats | null>(null);
  const [loadingActivities, setLoadingActivities] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    department: '',
    role: 'agent',
    specialization: '',
    maxChats: 5,
    skills: '',
    language: 'es'
  });

  const { toast } = useToast();

  // Roles disponibles
  const roles = {
    superadmin: { name: 'Superadministrador', color: 'bg-red-500', level: 6 },
    admin: { name: 'Administrador', color: 'bg-red-400', level: 5 },
    supervisor: { name: 'Supervisor', color: 'bg-orange-500', level: 4 },
    senior_agent: { name: 'Agente Senior', color: 'bg-yellow-500', level: 3 },
    agent: { name: 'Agente', color: 'bg-green-500', level: 2 },
    viewer: { name: 'Visualizador', color: 'bg-blue-500', level: 1 }
  };

  const departments = [
    'Ventas', 'Soporte', 'Técnico', 'Administración', 'Marketing', 'Desarrollo'
  ];

  const specializations = [
    'Sales', 'Support', 'Technical', 'Consultation', 'Marketing', 'Training'
  ];

  const statusOptions = [
    { value: 'active', label: 'Activo', color: 'bg-green-500' },
    { value: 'inactive', label: 'Inactivo', color: 'bg-gray-500' },
    { value: 'busy', label: 'Ocupado', color: 'bg-yellow-500' },
    { value: 'offline', label: 'Desconectado', color: 'bg-red-500' }
  ];

  // Cargar agentes
  const fetchAgents = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/internal-agents');
      if (!response.ok) throw new Error('Error obteniendo agentes');
      
      const data = await response.json();
      if (data.success) {
        setAgents(data.agents || []);
      }
    } catch (error) {
      console.error('Error cargando agentes:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los agentes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Obtener actividades de un agente
  const fetchAgentActivities = async (agentId: number) => {
    try {
      setLoadingActivities(true);
      const response = await fetch(`/api/agent-activity/${agentId}`);
      if (!response.ok) throw new Error('Error obteniendo actividades');
      
      const data = await response.json();
      if (data.success) {
        setAgentActivities(data.activities || []);
        setActivityStats(data.stats || null);
      }
    } catch (error) {
      console.error('Error cargando actividades:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las actividades",
        variant: "destructive"
      });
    } finally {
      setLoadingActivities(false);
    }
  };

  // Crear o actualizar agente
  const saveAgent = async () => {
    try {
      const skillsArray = formData.skills.split(',').map(s => s.trim()).filter(Boolean);
      
      const agentData = {
        ...formData,
        skills: skillsArray,
        maxChats: Number(formData.maxChats)
      };

      const url = editingAgent 
        ? `/api/internal-agents/${editingAgent.id}`
        : '/api/internal-agents';
        
      const method = editingAgent ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentData)
      });

      if (!response.ok) throw new Error('Error guardando agente');

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Éxito",
          description: editingAgent ? "Agente actualizado correctamente" : "Agente creado correctamente"
        });
        
        setShowAddForm(false);
        setEditingAgent(null);
        setFormData({
          name: '',
          email: '',
          department: '',
          role: 'agent',
          specialization: '',
          maxChats: 5,
          skills: '',
          language: 'es'
        });
        fetchAgents();
      }
    } catch (error) {
      console.error('Error guardando agente:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar el agente",
        variant: "destructive"
      });
    }
  };

  // Eliminar agente
  const deleteAgent = async (agentId: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este agente?')) return;

    try {
      const response = await fetch(`/api/internal-agents/${agentId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Error eliminando agente');

      toast({
        title: "Éxito",
        description: "Agente eliminado correctamente"
      });
      
      fetchAgents();
    } catch (error) {
      console.error('Error eliminando agente:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el agente",
        variant: "destructive"
      });
    }
  };

  // Cambiar rol de agente
  const changeAgentRole = async (agentId: number, newRole: string) => {
    try {
      const response = await fetch(`/api/agent-roles/${agentId}/assign-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });

      if (!response.ok) throw new Error('Error cambiando rol');

      const data = await response.json();
      if (data.success) {
        toast({
          title: "Éxito",
          description: `Rol cambiado a ${roles[newRole as keyof typeof roles].name}`
        });
        fetchAgents();
      }
    } catch (error) {
      console.error('Error cambiando rol:', error);
      toast({
        title: "Error",
        description: "No se pudo cambiar el rol",
        variant: "destructive"
      });
    }
  };

  // Editar agente
  const editAgent = (agent: InternalAgent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      email: agent.email,
      department: agent.department || '',
      role: agent.role,
      specialization: agent.specialization || '',
      maxChats: agent.maxChats,
      skills: agent.skills?.join(', ') || '',
      language: agent.language
    });
    setShowAddForm(true);
  };

  // Ver actividades
  const viewAgentActivities = (agent: InternalAgent) => {
    setSelectedAgent(agent);
    setShowActivities(true);
    fetchAgentActivities(agent.id);
  };

  // Formatear fecha
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Nunca';
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Formatear tiempo relativo
  const timeAgo = (dateString: string) => {
    if (!dateString) return 'Nunca';
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 30) return `Hace ${diffDays} días`;
    return formatDate(dateString);
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-2 text-lg">Cargando agentes...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-8 h-8 text-blue-600" />
            Agentes Internos
          </h1>
          <p className="text-gray-600 mt-1">
            Gestión de agentes internos con roles y rastreo de actividades
          </p>
        </div>
        <Button onClick={() => setShowAddForm(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Agregar Agente
        </Button>
      </div>

      {/* Estadísticas generales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Agentes</p>
                <p className="text-2xl font-bold text-gray-900">{agents.length}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Agentes Activos</p>
                <p className="text-2xl font-bold text-green-600">
                  {agents.filter(a => a.status === 'active').length}
                </p>
              </div>
              <UserCheck className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Superadmins</p>
                <p className="text-2xl font-bold text-red-600">
                  {agents.filter(a => a.role === 'superadmin').length}
                </p>
              </div>
              <Shield className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">En Línea</p>
                <p className="text-2xl font-bold text-blue-600">
                  {agents.filter(a => a.status === 'active' || a.status === 'busy').length}
                </p>
              </div>
              <Activity className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de agentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {agents.map((agent) => (
          <Card key={agent.id} className="relative hover:shadow-md transition-shadow">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold">{agent.name}</CardTitle>
                    <CardDescription className="text-sm">{agent.email}</CardDescription>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editAgent(agent)}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteAgent(agent.id)}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Rol y estado */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={`${roles[agent.role as keyof typeof roles]?.color} text-white`}>
                    {roles[agent.role as keyof typeof roles]?.name || agent.role}
                  </Badge>
                  <Select
                    value={agent.role}
                    onValueChange={(newRole) => changeAgentRole(agent.id, newRole)}
                  >
                    <SelectTrigger className="w-32 h-6 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(roles).map(([key, role]) => (
                        <SelectItem key={key} value={key}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Badge 
                  variant="outline" 
                  className={`${statusOptions.find(s => s.value === agent.status)?.color} text-white border-0`}
                >
                  {statusOptions.find(s => s.value === agent.status)?.label || agent.status}
                </Badge>
              </div>

              {/* Información del agente */}
              <div className="space-y-2 text-sm">
                {agent.department && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Departamento:</span>
                    <span className="font-medium">{agent.department}</span>
                  </div>
                )}
                
                {agent.specialization && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Especialización:</span>
                    <span className="font-medium">{agent.specialization}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Chats:</span>
                  <span className="font-medium">{agent.currentChats}/{agent.maxChats}</span>
                </div>
              </div>

              {/* Estadísticas de actividad */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>Última conexión:</span>
                  </div>
                  <span className="font-medium text-gray-900">
                    {timeAgo(agent.lastLogin || agent.updatedAt || agent.createdAt)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <BarChart3 className="w-4 h-4" />
                    <span>Total entradas:</span>
                  </div>
                  <span className="font-bold text-blue-600">
                    {agent.totalLogins || 0} veces
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Activity className="w-4 h-4" />
                    <span>Última actividad:</span>
                  </div>
                  <span className="font-medium text-gray-900">
                    {timeAgo(agent.lastActivity || agent.updatedAt || agent.createdAt)}
                  </span>
                </div>
              </div>

              {/* Botón para ver todas las actividades */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => viewAgentActivities(agent)}
                className="w-full mt-4"
              >
                <Eye className="w-4 h-4 mr-2" />
                Ver Todas las Actividades
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Mensaje cuando no hay agentes */}
      {agents.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No hay agentes internos
            </h3>
            <p className="text-gray-600 mb-4">
              Crea tu primer agente interno para comenzar a gestionar el sistema
            </p>
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Agregar Primer Agente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dialog para agregar/editar agente */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAgent ? 'Editar Agente' : 'Agregar Nuevo Agente'}
            </DialogTitle>
            <DialogDescription>
              {editingAgent 
                ? 'Modifica la información del agente interno'
                : 'Crea un nuevo agente interno para el sistema'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre Completo</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Juan Pérez"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="juan@empresa.com"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="department">Departamento</Label>
              <Select value={formData.department} onValueChange={(value) => setFormData({...formData, department: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar departamento" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">Rol</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({...formData, role: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roles).map(([key, role]) => (
                    <SelectItem key={key} value={key}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="specialization">Especialización</Label>
              <Select value={formData.specialization} onValueChange={(value) => setFormData({...formData, specialization: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar especialización" />
                </SelectTrigger>
                <SelectContent>
                  {specializations.map((spec) => (
                    <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="maxChats">Máximo de Chats</Label>
              <Input
                id="maxChats"
                type="number"
                value={formData.maxChats}
                onChange={(e) => setFormData({...formData, maxChats: parseInt(e.target.value) || 5})}
                min="1"
                max="20"
              />
            </div>
            
            <div className="space-y-2 col-span-2">
              <Label htmlFor="skills">Habilidades (separadas por comas)</Label>
              <Input
                id="skills"
                value={formData.skills}
                onChange={(e) => setFormData({...formData, skills: e.target.value})}
                placeholder="ventas, soporte técnico, consultoría"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAddForm(false)}>
              Cancelar
            </Button>
            <Button onClick={saveAgent}>
              {editingAgent ? 'Actualizar' : 'Crear'} Agente
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para ver actividades */}
      <Dialog open={showActivities} onOpenChange={setShowActivities}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Actividades de {selectedAgent?.name}
            </DialogTitle>
            <DialogDescription>
              Historial completo de actividades y accesos al sistema
            </DialogDescription>
          </DialogHeader>
          
          {loadingActivities ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              Cargando actividades...
            </div>
          ) : (
            <div className="space-y-6">
              {/* Estadísticas del agente */}
              {activityStats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">{activityStats.totalSessions}</p>
                        <p className="text-sm text-gray-600">Total Sesiones</p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{activityStats.totalPageViews}</p>
                        <p className="text-sm text-gray-600">Páginas Visitadas</p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-600">Última Conexión</p>
                        <p className="text-sm text-gray-900">{formatDate(activityStats.lastLogin)}</p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="pt-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-purple-600">{Math.round(activityStats.averageSessionTime)}</p>
                        <p className="text-sm text-gray-600">Min/Sesión</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
              
              {/* Lista de actividades */}
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900">Actividades Recientes</h4>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {agentActivities.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{activity.action}</p>
                        <p className="text-sm text-gray-600">{activity.page}</p>
                        {activity.details && (
                          <p className="text-xs text-gray-500">{activity.details}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {formatDate(activity.timestamp)}
                        </p>
                        {activity.ipAddress && (
                          <p className="text-xs text-gray-500">{activity.ipAddress}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {agentActivities.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No hay actividades registradas
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}