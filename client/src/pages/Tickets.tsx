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
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  Ticket, 
  User, 
  Phone, 
  Mail, 
  MessageSquare, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Eye, 
  Edit, 
  Trash2, 
  Plus, 
  Search, 
  Filter,
  Star,
  Flag,
  Target,
  TrendingUp,
  Users,
  DollarSign,
  BarChart3,
  Settings,
  HeadphonesIcon,
  Zap,
  Activity,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from "lucide-react";

interface TicketType {
  id: number;
  uuid: string;
  chatId: string;
  contactId: number;
  whatsappAccountId: number;
  userId: number;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  interestLevel: 'unknown' | 'low' | 'medium' | 'high' | 'very_high';
  estimatedValue: number;
  assignedTo?: number;
  assignedToName?: string;
  contactName?: string;
  contactPhone?: string;
  source: string;
  tags: string[];
  metadata: any;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  dueDate?: string;
  lastMessageAt?: string;
  responseTime?: number;
  resolutionTime?: number;
}

const TICKET_STATUSES = [
  { value: 'open', label: 'Abierto', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: Ticket },
  { value: 'in_progress', label: 'En Progreso', color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: Activity },
  { value: 'pending', label: 'Pendiente', color: 'text-orange-600', bgColor: 'bg-orange-100', icon: Clock },
  { value: 'resolved', label: 'Resuelto', color: 'text-green-600', bgColor: 'bg-green-100', icon: CheckCircle },
  { value: 'closed', label: 'Cerrado', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: XCircle }
];

const PRIORITY_LEVELS = [
  { value: 'low', label: 'Baja', color: 'text-green-600', bgColor: 'bg-green-100', icon: ArrowDownRight },
  { value: 'medium', label: 'Media', color: 'text-yellow-600', bgColor: 'bg-yellow-100', icon: Minus },
  { value: 'high', label: 'Alta', color: 'text-orange-600', bgColor: 'bg-orange-100', icon: ArrowUpRight },
  { value: 'urgent', label: 'Urgente', color: 'text-red-600', bgColor: 'bg-red-100', icon: AlertTriangle }
];

const INTEREST_LEVELS = [
  { value: 'very_high', label: 'Muy Alto', color: 'text-red-600', bgColor: 'bg-red-100' },
  { value: 'high', label: 'Alto', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  { value: 'medium', label: 'Medio', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  { value: 'low', label: 'Bajo', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  { value: 'unknown', label: 'Desconocido', color: 'text-gray-600', bgColor: 'bg-gray-100' }
];

const TICKET_CATEGORIES = [
  { id: 'consultation', name: 'Consulta', icon: MessageSquare, color: 'bg-blue-500' },
  { id: 'sales_interest', name: 'Interés de Venta', icon: DollarSign, color: 'bg-green-500' },
  { id: 'support', name: 'Soporte Técnico', icon: HeadphonesIcon, color: 'bg-purple-500' },
  { id: 'complaint', name: 'Queja', icon: AlertTriangle, color: 'bg-red-500' },
  { id: 'information', name: 'Información', icon: FileText, color: 'bg-indigo-500' },
  { id: 'follow_up', name: 'Seguimiento', icon: Target, color: 'bg-orange-500' },
  { id: 'general', name: 'General', icon: Settings, color: 'bg-gray-500' }
];

export default function Tickets() {
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Obtener tickets
  const { data: ticketsData = [], isLoading } = useQuery({
    queryKey: ['/api/tickets'],
    refetchInterval: 5000 // Actualizar cada 5 segundos para mostrar tickets nuevos
  });

  // Obtener estadísticas de tickets
  const { data: ticketStats } = useQuery({
    queryKey: ['/api/tickets/stats']
  });

  // Actualizar ticket
  const updateTicketMutation = useMutation({
    mutationFn: async (ticketData: Partial<TicketType>) => {
      return await apiRequest(`/api/tickets/${ticketData.id}`, {
        method: 'PUT',
        body: JSON.stringify(ticketData)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets/stats'] });
      toast({
        title: "Ticket actualizado",
        description: "El ticket ha sido actualizado exitosamente"
      });
      setIsEditDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el ticket",
        variant: "destructive"
      });
    }
  });

  // Eliminar ticket
  const deleteTicketMutation = useMutation({
    mutationFn: async (ticketId: number) => {
      return await apiRequest(`/api/tickets/${ticketId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tickets/stats'] });
      toast({
        title: "Ticket eliminado",
        description: "El ticket ha sido eliminado exitosamente"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el ticket",
        variant: "destructive"
      });
    }
  });

  // Filtrar tickets
  const filteredTickets = ticketsData.filter((ticket: TicketType) => {
    const matchesSearch = ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.contactName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.contactPhone?.includes(searchTerm);
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
    const matchesCategory = categoryFilter === "all" || ticket.category === categoryFilter;
    
    if (activeTab === "urgent") {
      return matchesSearch && matchesStatus && matchesPriority && matchesCategory && ticket.priority === 'urgent';
    }
    
    if (activeTab === "high_interest") {
      return matchesSearch && matchesStatus && matchesPriority && matchesCategory && 
             (ticket.interestLevel === 'high' || ticket.interestLevel === 'very_high');
    }
    
    if (activeTab === "open") {
      return matchesSearch && matchesPriority && matchesCategory && ticket.status === 'open';
    }

    return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
  });

  const handleUpdateTicket = (ticketData: Partial<TicketType>) => {
    updateTicketMutation.mutate(ticketData);
  };

  const handleDeleteTicket = (ticketId: number) => {
    if (confirm('¿Estás seguro de que quieres eliminar este ticket?')) {
      deleteTicketMutation.mutate(ticketId);
    }
  };

  const getStatusInfo = (status: string) => {
    return TICKET_STATUSES.find(s => s.value === status) || TICKET_STATUSES[0];
  };

  const getPriorityInfo = (priority: string) => {
    return PRIORITY_LEVELS.find(p => p.value === priority) || PRIORITY_LEVELS[1];
  };

  const getInterestInfo = (level: string) => {
    return INTEREST_LEVELS.find(i => i.value === level) || INTEREST_LEVELS[4];
  };

  const getCategoryInfo = (categoryId: string) => {
    return TICKET_CATEGORIES.find(c => c.id === categoryId) || TICKET_CATEGORIES[6];
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `hace ${diffInMinutes} min`;
    } else if (diffInMinutes < 1440) {
      return `hace ${Math.floor(diffInMinutes / 60)} h`;
    } else {
      return `hace ${Math.floor(diffInMinutes / 1440)} días`;
    }
  };

  const TicketCard = ({ ticket }: { ticket: TicketType }) => {
    const statusInfo = getStatusInfo(ticket.status);
    const priorityInfo = getPriorityInfo(ticket.priority);
    const interestInfo = getInterestInfo(ticket.interestLevel);
    const categoryInfo = getCategoryInfo(ticket.category);
    const StatusIcon = statusInfo.icon;
    const PriorityIcon = priorityInfo.icon;
    const CategoryIcon = categoryInfo.icon;

    const isHighPriority = ticket.priority === 'urgent' || ticket.priority === 'high';
    const isHighInterest = ticket.interestLevel === 'high' || ticket.interestLevel === 'very_high';

    return (
      <Card className={`mb-3 hover:shadow-md transition-shadow cursor-pointer ${
        isHighPriority ? 'border-orange-200 bg-orange-50' : ''
      } ${isHighInterest ? 'border-l-4 border-l-green-500' : ''}`}>
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-sm">{ticket.title}</h3>
                <Badge className={`${statusInfo.bgColor} ${statusInfo.color} text-xs`}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {statusInfo.label}
                </Badge>
              </div>
              <p className="text-xs text-gray-600 mb-2 line-clamp-2">{ticket.description}</p>
            </div>
            <div className="flex flex-col gap-1">
              <Badge className={`${priorityInfo.bgColor} ${priorityInfo.color} text-xs`}>
                <PriorityIcon className="w-3 h-3 mr-1" />
                {priorityInfo.label}
              </Badge>
              {isHighInterest && (
                <Badge className={`${interestInfo.bgColor} ${interestInfo.color} text-xs`}>
                  <Star className="w-3 h-3 mr-1" />
                  {interestInfo.label}
                </Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
            <div className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {ticket.contactName || 'Sin nombre'}
            </div>
            <div className="flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {ticket.contactPhone}
            </div>
            <div className="flex items-center gap-1">
              <CategoryIcon className="w-3 h-3" />
              {categoryInfo.name}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {getTimeAgo(ticket.createdAt)}
            </div>
          </div>

          {ticket.estimatedValue > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">Valor Estimado:</span>
                <span className="font-semibold text-green-600">
                  {formatCurrency(ticket.estimatedValue)}
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center">
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedTicket(ticket);
                  setIsDetailDialogOpen(true);
                }}
              >
                <Eye className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedTicket(ticket);
                  setIsEditDialogOpen(true);
                }}
              >
                <Edit className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDeleteTicket(ticket.id)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
            <div className="flex gap-1">
              {ticket.tags.slice(0, 2).map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {ticket.tags.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{ticket.tags.length - 2}
                </Badge>
              )}
            </div>
          </div>

          {ticket.chatId && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-green-600">
                  <MessageSquare className="w-3 h-3" />
                  <span>Chat activo</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    // Navegar al chat correspondiente
                    window.open(`/messages?chat=${ticket.chatId}`, '_blank');
                  }}
                >
                  Ver Chat
                </Button>
              </div>
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
            <p className="mt-4 text-gray-600">Cargando tickets...</p>
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
          <h1 className="text-3xl font-bold">Gestión de Tickets</h1>
          <p className="text-gray-600 mt-1">
            Tickets generados automáticamente desde conversaciones de WhatsApp con análisis de interés
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-green-50">
            <Zap className="w-3 h-3 mr-1" />
            Generación automática activa
          </Badge>
        </div>
      </div>

      {/* Estadísticas */}
      {ticketStats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Tickets</p>
                  <p className="text-2xl font-bold">{ticketStats.total || 0}</p>
                </div>
                <Ticket className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Abiertos</p>
                  <p className="text-2xl font-bold text-blue-600">{ticketStats.open || 0}</p>
                </div>
                <Activity className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Urgentes</p>
                  <p className="text-2xl font-bold text-red-600">{ticketStats.urgent || 0}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Alto Interés</p>
                  <p className="text-2xl font-bold text-green-600">{ticketStats.highInterest || 0}</p>
                </div>
                <Star className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Valor Potencial</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {formatCurrency(ticketStats.totalValue || 0)}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-purple-600" />
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
            placeholder="Buscar tickets..."
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
            {TICKET_STATUSES.map(status => (
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
            {TICKET_CATEGORIES.map(category => (
              <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="open">Abiertos</TabsTrigger>
          <TabsTrigger value="urgent">Urgentes</TabsTrigger>
          <TabsTrigger value="high_interest">Alto Interés</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTickets.map((ticket: TicketType) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
          
          {filteredTickets.length === 0 && (
            <div className="text-center py-12">
              <Ticket className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No hay tickets</h3>
              <p className="text-gray-500 mb-4">
                {activeTab === "all" ? "No se encontraron tickets que coincidan con los filtros" :
                 activeTab === "open" ? "No hay tickets abiertos" :
                 activeTab === "urgent" ? "No hay tickets urgentes" :
                 "No hay tickets de alto interés"}
              </p>
              <p className="text-sm text-gray-400">
                Los tickets se generan automáticamente cuando hay conversaciones en WhatsApp
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog para ver detalles */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalles del Ticket</DialogTitle>
          </DialogHeader>
          {selectedTicket && <TicketDetails ticket={selectedTicket} />}
        </DialogContent>
      </Dialog>

      {/* Dialog para editar */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Ticket</DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <TicketEditForm 
              ticket={selectedTicket} 
              onSave={handleUpdateTicket}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TicketDetails({ ticket }: { ticket: TicketType }) {
  const statusInfo = getStatusInfo(ticket.status);
  const priorityInfo = getPriorityInfo(ticket.priority);
  const interestInfo = getInterestInfo(ticket.interestLevel);
  const categoryInfo = getCategoryInfo(ticket.category);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const getStatusInfo = (status: string) => {
    return TICKET_STATUSES.find(s => s.value === status) || TICKET_STATUSES[0];
  };

  const getPriorityInfo = (priority: string) => {
    return PRIORITY_LEVELS.find(p => p.value === priority) || PRIORITY_LEVELS[1];
  };

  const getInterestInfo = (level: string) => {
    return INTEREST_LEVELS.find(i => i.value === level) || INTEREST_LEVELS[4];
  };

  const getCategoryInfo = (categoryId: string) => {
    return TICKET_CATEGORIES.find(c => c.id === categoryId) || TICKET_CATEGORIES[6];
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium text-gray-600">Título</Label>
            <p className="text-lg font-semibold">{ticket.title}</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-600">Descripción</Label>
            <p className="text-sm text-gray-700">{ticket.description}</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-600">Contacto</Label>
            <div className="space-y-1">
              <p className="font-medium">{ticket.contactName || 'Sin nombre'}</p>
              <p className="text-sm text-gray-600">{ticket.contactPhone}</p>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-600">Estado</Label>
              <Badge className={`${statusInfo.bgColor} ${statusInfo.color} mt-1`}>
                {statusInfo.label}
              </Badge>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-600">Prioridad</Label>
              <Badge className={`${priorityInfo.bgColor} ${priorityInfo.color} mt-1`}>
                {priorityInfo.label}
              </Badge>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-600">Categoría</Label>
              <p className="text-sm font-medium">{categoryInfo.name}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-600">Nivel de Interés</Label>
              <Badge className={`${interestInfo.bgColor} ${interestInfo.color} mt-1`}>
                {interestInfo.label}
              </Badge>
            </div>
          </div>
          
          {ticket.estimatedValue > 0 && (
            <div>
              <Label className="text-sm font-medium text-gray-600">Valor Estimado</Label>
              <p className="text-lg font-semibold text-green-600">
                {formatCurrency(ticket.estimatedValue)}
              </p>
            </div>
          )}
          
          <div>
            <Label className="text-sm font-medium text-gray-600">Fechas</Label>
            <div className="space-y-1 text-sm">
              <p>Creado: {format(new Date(ticket.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
              <p>Actualizado: {format(new Date(ticket.updatedAt), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
              {ticket.closedAt && (
                <p>Cerrado: {format(new Date(ticket.closedAt), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {ticket.tags.length > 0 && (
        <div>
          <Label className="text-sm font-medium text-gray-600">Tags</Label>
          <div className="flex flex-wrap gap-1 mt-2">
            {ticket.tags.map((tag, index) => (
              <Badge key={index} variant="outline">{tag}</Badge>
            ))}
          </div>
        </div>
      )}

      {ticket.chatId && (
        <div>
          <Label className="text-sm font-medium text-gray-600">Chat Relacionado</Label>
          <div className="mt-2">
            <Button
              variant="outline"
              onClick={() => {
                window.open(`/messages?chat=${ticket.chatId}`, '_blank');
              }}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Ver Conversación Completa
            </Button>
          </div>
        </div>
      )}

      {ticket.metadata && Object.keys(ticket.metadata).length > 0 && (
        <div>
          <Label className="text-sm font-medium text-gray-600">Metadatos</Label>
          <pre className="text-xs bg-gray-50 p-2 rounded mt-2 overflow-auto">
            {JSON.stringify(ticket.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function TicketEditForm({ 
  ticket, 
  onSave, 
  onCancel 
}: {
  ticket: TicketType;
  onSave: (data: Partial<TicketType>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    category: ticket.category,
    interestLevel: ticket.interestLevel,
    estimatedValue: ticket.estimatedValue,
    assignedTo: ticket.assignedTo || '',
    tags: ticket.tags.join(', '),
    dueDate: ticket.dueDate ? new Date(ticket.dueDate).toISOString().split('T')[0] : ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: ticket.id,
      ...formData,
      assignedTo: formData.assignedTo ? Number(formData.assignedTo) : undefined,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined
    });
  };

  return (
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
          <Label htmlFor="status">Estado</Label>
          <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TICKET_STATUSES.map(status => (
                <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
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
          <Label htmlFor="category">Categoría</Label>
          <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TICKET_CATEGORIES.map(category => (
                <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="interestLevel">Nivel de Interés</Label>
          <Select value={formData.interestLevel} onValueChange={(value) => setFormData({ ...formData, interestLevel: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTEREST_LEVELS.map(level => (
                <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="estimatedValue">Valor Estimado</Label>
          <Input
            id="estimatedValue"
            type="number"
            min="0"
            step="0.01"
            value={formData.estimatedValue}
            onChange={(e) => setFormData({ ...formData, estimatedValue: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label htmlFor="dueDate">Fecha Límite</Label>
          <Input
            id="dueDate"
            type="date"
            value={formData.dueDate}
            onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="tags">Tags (separados por coma)</Label>
          <Input
            id="tags"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            placeholder="urgente, venta, seguimiento"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">
          Guardar Cambios
        </Button>
      </div>
    </form>
  );
}