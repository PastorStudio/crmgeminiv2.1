import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  CheckCircle, 
  Circle, 
  Clock, 
  AlertTriangle, 
  User, 
  Calendar as CalendarIcon, 
  Plus, 
  Edit, 
  Trash2, 
  Filter, 
  Search,
  Target,
  Zap,
  MessageSquare,
  Phone,
  Mail,
  FileText,
  TrendingUp,
  Users,
  DollarSign,
  BarChart3,
  Settings,
  Star,
  Flag
} from "lucide-react";

interface Task {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  assignedTo: number;
  assignedToName?: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  leadId?: number;
  contactId?: number;
  ticketId?: number;
  estimatedHours?: number;
  actualHours?: number;
  tags: string[];
  notes: string;
  isRecurring: boolean;
  recurringType?: 'daily' | 'weekly' | 'monthly';
  parentTaskId?: number;
  progress: number;
}

const TASK_CATEGORIES = [
  { id: 'follow_up', name: 'Seguimiento', icon: Phone, color: 'bg-blue-500' },
  { id: 'sales', name: 'Ventas', icon: DollarSign, color: 'bg-green-500' },
  { id: 'support', name: 'Soporte', icon: MessageSquare, color: 'bg-yellow-500' },
  { id: 'marketing', name: 'Marketing', icon: TrendingUp, color: 'bg-purple-500' },
  { id: 'admin', name: 'Administración', icon: Settings, color: 'bg-gray-500' },
  { id: 'analysis', name: 'Análisis', icon: BarChart3, color: 'bg-orange-500' },
  { id: 'content', name: 'Contenido', icon: FileText, color: 'bg-indigo-500' },
  { id: 'training', name: 'Capacitación', icon: Users, color: 'bg-pink-500' }
];

const PRIORITY_LEVELS = [
  { value: 'low', label: 'Baja', color: 'text-green-600', bgColor: 'bg-green-100' },
  { value: 'medium', label: 'Media', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  { value: 'high', label: 'Alta', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  { value: 'urgent', label: 'Urgente', color: 'text-red-600', bgColor: 'bg-red-100' }
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente', color: 'text-gray-600' },
  { value: 'in_progress', label: 'En Progreso', color: 'text-blue-600' },
  { value: 'completed', label: 'Completada', color: 'text-green-600' },
  { value: 'cancelled', label: 'Cancelada', color: 'text-red-600' }
];

// Tareas predefinidas que siempre estarán disponibles
const DEFAULT_TASKS = [
  {
    title: "Revisar leads nuevos del día",
    description: "Analizar y calificar todos los leads generados automáticamente desde WhatsApp",
    category: "sales",
    priority: "high",
    recurringType: "daily",
    estimatedHours: 1
  },
  {
    title: "Seguimiento a leads calificados",
    description: "Contactar leads que han mostrado interés alto o muy alto",
    category: "follow_up",
    priority: "high",
    recurringType: "daily",
    estimatedHours: 2
  },
  {
    title: "Responder tickets de soporte abiertos",
    description: "Atender y resolver tickets pendientes de clientes",
    category: "support",
    priority: "medium",
    recurringType: "daily",
    estimatedHours: 1.5
  },
  {
    title: "Actualizar pipeline de ventas",
    description: "Revisar y actualizar el estado de oportunidades en el pipeline",
    category: "sales",
    priority: "medium",
    recurringType: "daily",
    estimatedHours: 0.5
  },
  {
    title: "Análisis de conversaciones WhatsApp",
    description: "Revisar conversaciones para identificar oportunidades y mejoras",
    category: "analysis",
    priority: "medium",
    recurringType: "weekly",
    estimatedHours: 2
  },
  {
    title: "Reporte semanal de actividades",
    description: "Generar reporte de métricas y actividades de la semana",
    category: "admin",
    priority: "low",
    recurringType: "weekly",
    estimatedHours: 1
  }
];

export default function Tasks() {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Obtener tareas
  const { data: tasksData = [], isLoading } = useQuery({
    queryKey: ['/api/tasks'],
    refetchInterval: 10000
  });

  // Obtener estadísticas de tareas
  const { data: taskStats } = useQuery({
    queryKey: ['/api/tasks/stats']
  });

  // Crear tarea
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: Partial<Task>) => {
      return await apiRequest('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/stats'] });
      toast({
        title: "Tarea creada",
        description: "La tarea ha sido creada exitosamente"
      });
      setIsCreateDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear la tarea",
        variant: "destructive"
      });
    }
  });

  // Actualizar tarea
  const updateTaskMutation = useMutation({
    mutationFn: async (taskData: Partial<Task>) => {
      return await apiRequest(`/api/tasks/${taskData.id}`, {
        method: 'PUT',
        body: JSON.stringify(taskData)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/stats'] });
      toast({
        title: "Tarea actualizada",
        description: "La tarea ha sido actualizada exitosamente"
      });
      setIsEditDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la tarea",
        variant: "destructive"
      });
    }
  });

  // Eliminar tarea
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return await apiRequest(`/api/tasks/${taskId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/stats'] });
      toast({
        title: "Tarea eliminada",
        description: "La tarea ha sido eliminada exitosamente"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar la tarea",
        variant: "destructive"
      });
    }
  });

  // Generar tareas automáticas al cargar
  useEffect(() => {
    const initializeDefaultTasks = async () => {
      if (tasksData.length === 0) {
        // Crear tareas predefinidas si no hay ninguna
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        for (const defaultTask of DEFAULT_TASKS) {
          const dueDate = defaultTask.recurringType === 'daily' ? tomorrow : 
                         defaultTask.recurringType === 'weekly' ? 
                         new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) :
                         new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

          createTaskMutation.mutate({
            ...defaultTask,
            status: 'pending',
            dueDate: dueDate.toISOString(),
            assignedTo: 1, // Asignar al usuario actual
            progress: 0,
            isRecurring: true,
            tags: ['automática', defaultTask.category],
            notes: 'Tarea generada automáticamente por el sistema'
          });
        }
      }
    };

    if (!isLoading && tasksData.length === 0) {
      initializeDefaultTasks();
    }
  }, [tasksData, isLoading]);

  // Filtrar tareas
  const filteredTasks = tasksData.filter((task: Task) => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
    const matchesCategory = categoryFilter === "all" || task.category === categoryFilter;
    
    if (activeTab === "today") {
      const today = new Date().toDateString();
      const taskDate = new Date(task.dueDate).toDateString();
      return matchesSearch && matchesStatus && matchesPriority && matchesCategory && taskDate === today;
    }
    
    if (activeTab === "overdue") {
      const today = new Date();
      const taskDate = new Date(task.dueDate);
      return matchesSearch && matchesStatus && matchesPriority && matchesCategory && 
             taskDate < today && task.status !== 'completed';
    }
    
    if (activeTab === "completed") {
      return matchesSearch && matchesPriority && matchesCategory && task.status === 'completed';
    }

    return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
  });

  const handleCreateTask = (taskData: Partial<Task>) => {
    createTaskMutation.mutate(taskData);
  };

  const handleUpdateTask = (taskData: Partial<Task>) => {
    updateTaskMutation.mutate(taskData);
  };

  const handleDeleteTask = (taskId: number) => {
    if (confirm('¿Estás seguro de que quieres eliminar esta tarea?')) {
      deleteTaskMutation.mutate(taskId);
    }
  };

  const handleToggleComplete = (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    const updateData: Partial<Task> = {
      id: task.id,
      status: newStatus,
      progress: newStatus === 'completed' ? 100 : task.progress,
      completedAt: newStatus === 'completed' ? new Date().toISOString() : undefined
    };
    handleUpdateTask(updateData);
  };

  const getPriorityInfo = (priority: string) => {
    return PRIORITY_LEVELS.find(p => p.value === priority) || PRIORITY_LEVELS[1];
  };

  const getCategoryInfo = (categoryId: string) => {
    return TASK_CATEGORIES.find(c => c.id === categoryId) || TASK_CATEGORIES[0];
  };

  const TaskCard = ({ task }: { task: Task }) => {
    const priorityInfo = getPriorityInfo(task.priority);
    const categoryInfo = getCategoryInfo(task.category);
    const IconComponent = categoryInfo.icon;
    const isOverdue = new Date(task.dueDate) < new Date() && task.status !== 'completed';

    return (
      <Card className={`mb-3 hover:shadow-md transition-shadow ${isOverdue ? 'border-red-200 bg-red-50' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-start gap-3 flex-1">
              <Checkbox
                checked={task.status === 'completed'}
                onCheckedChange={() => handleToggleComplete(task)}
                className="mt-1"
              />
              <div className="flex-1">
                <h3 className={`font-semibold text-sm ${task.status === 'completed' ? 'line-through text-gray-500' : ''}`}>
                  {task.title}
                </h3>
                <p className="text-xs text-gray-600 mt-1">{task.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`${priorityInfo.bgColor} ${priorityInfo.color} text-xs`}>
                {priorityInfo.label}
              </Badge>
              {isOverdue && (
                <Badge className="bg-red-100 text-red-600 text-xs">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Vencida
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <IconComponent className="w-3 h-3" />
                {categoryInfo.name}
              </div>
              <div className="flex items-center gap-1">
                <CalendarIcon className="w-3 h-3" />
                {format(new Date(task.dueDate), 'dd/MM/yyyy', { locale: es })}
              </div>
              {task.estimatedHours && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {task.estimatedHours}h
                </div>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedTask(task);
                  setIsEditDialogOpen(true);
                }}
              >
                <Edit className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDeleteTask(task.id)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {task.progress > 0 && task.progress < 100 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Progreso</span>
                <span>{task.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${task.progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {task.tags.map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando tareas...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Tareas</h1>
          <p className="text-gray-600 mt-1">
            Organiza y gestiona todas tus tareas y actividades clave del sistema
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Tarea
        </Button>
      </div>

      {/* Estadísticas */}
      {taskStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Tareas</p>
                  <p className="text-2xl font-bold">{taskStats.total || 0}</p>
                </div>
                <Target className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Completadas</p>
                  <p className="text-2xl font-bold text-green-600">{taskStats.completed || 0}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pendientes</p>
                  <p className="text-2xl font-bold text-yellow-600">{taskStats.pending || 0}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Vencidas</p>
                  <p className="text-2xl font-bold text-red-600">{taskStats.overdue || 0}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-500" />
          <Input
            placeholder="Buscar tareas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {STATUS_OPTIONS.map(status => (
              <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por prioridad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las prioridades</SelectItem>
            {PRIORITY_LEVELS.map(priority => (
              <SelectItem key={priority.value} value={priority.value}>{priority.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {TASK_CATEGORIES.map(category => (
              <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="today">Hoy</TabsTrigger>
          <TabsTrigger value="overdue">Vencidas</TabsTrigger>
          <TabsTrigger value="completed">Completadas</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTasks.map((task: Task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
          
          {filteredTasks.length === 0 && (
            <div className="text-center py-12">
              <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No hay tareas</h3>
              <p className="text-gray-500 mb-4">
                {activeTab === "all" ? "No se encontraron tareas que coincidan con los filtros" :
                 activeTab === "today" ? "No hay tareas programadas para hoy" :
                 activeTab === "overdue" ? "No hay tareas vencidas" :
                 "No hay tareas completadas"}
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Crear primera tarea
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <TaskFormDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateTask}
        title="Crear Nueva Tarea"
      />

      <TaskFormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSubmit={handleUpdateTask}
        title="Editar Tarea"
        task={selectedTask}
      />
    </div>
  );
}

function TaskFormDialog({ 
  open, 
  onOpenChange, 
  onSubmit, 
  title, 
  task 
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<Task>) => void;
  title: string;
  task?: Task | null;
}) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'follow_up',
    priority: 'medium',
    status: 'pending',
    dueDate: new Date(),
    estimatedHours: 1,
    progress: 0,
    isRecurring: false,
    recurringType: 'weekly',
    tags: '',
    notes: ''
  });

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description,
        category: task.category,
        priority: task.priority,
        status: task.status,
        dueDate: new Date(task.dueDate),
        estimatedHours: task.estimatedHours || 1,
        progress: task.progress,
        isRecurring: task.isRecurring,
        recurringType: task.recurringType || 'weekly',
        tags: task.tags.join(', '),
        notes: task.notes
      });
    } else {
      setFormData({
        title: '',
        description: '',
        category: 'follow_up',
        priority: 'medium',
        status: 'pending',
        dueDate: new Date(),
        estimatedHours: 1,
        progress: 0,
        isRecurring: false,
        recurringType: 'weekly',
        tags: '',
        notes: ''
      });
    }
  }, [task, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const taskData = {
      ...formData,
      dueDate: formData.dueDate.toISOString(),
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      ...(task ? { id: task.id } : {})
    };
    onSubmit(taskData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="category">Categoría</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_CATEGORIES.map(category => (
                    <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="priority">Prioridad</Label>
              <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_LEVELS.map(priority => (
                    <SelectItem key={priority.value} value={priority.value}>{priority.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Estado</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(status => (
                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="estimatedHours">Horas Estimadas</Label>
              <Input
                id="estimatedHours"
                type="number"
                min="0.5"
                step="0.5"
                value={formData.estimatedHours}
                onChange={(e) => setFormData({ ...formData, estimatedHours: parseFloat(e.target.value) })}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="dueDate">Fecha de Vencimiento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(formData.dueDate, 'dd/MM/yyyy', { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.dueDate}
                    onSelect={(date) => date && setFormData({ ...formData, dueDate: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="col-span-2">
              <Label htmlFor="tags">Tags (separados por coma)</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="urgente, cliente, seguimiento"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              {task ? 'Actualizar' : 'Crear'} Tarea
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}