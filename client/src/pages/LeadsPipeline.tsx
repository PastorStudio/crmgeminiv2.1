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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  User, 
  Phone, 
  Mail, 
  Building, 
  DollarSign, 
  Calendar, 
  Tag, 
  Edit, 
  Eye,
  MessageSquare,
  TrendingUp,
  Star,
  Clock,
  Target,
  Users,
  ArrowRight,
  Plus,
  Filter,
  Search
} from "lucide-react";

interface Lead {
  id: number;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: string;
  stage: string;
  value: number;
  estimatedValue: number;
  source: string;
  assignedTo: number;
  assignedToName?: string;
  lastContact: string;
  createdAt: string;
  tags: string[];
  notes: string;
  chatId?: string;
  interestLevel?: string;
  nextFollowUp?: string;
  priority?: string;
}

const LEAD_STAGES = [
  { id: 'prospect', name: 'Prospecto', color: 'bg-blue-500' },
  { id: 'qualified', name: 'Calificado', color: 'bg-yellow-500' },
  { id: 'proposal', name: 'Propuesta', color: 'bg-orange-500' },
  { id: 'negotiation', name: 'Negociación', color: 'bg-purple-500' },
  { id: 'closed_won', name: 'Ganado', color: 'bg-green-500' },
  { id: 'closed_lost', name: 'Perdido', color: 'bg-red-500' }
];

const INTEREST_LEVELS = [
  { value: 'very_high', label: 'Muy Alto', color: 'text-red-600' },
  { value: 'high', label: 'Alto', color: 'text-orange-600' },
  { value: 'medium', label: 'Medio', color: 'text-yellow-600' },
  { value: 'low', label: 'Bajo', color: 'text-blue-600' },
  { value: 'unknown', label: 'Desconocido', color: 'text-gray-600' }
];

export default function LeadsPipeline() {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("pipeline");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Obtener leads
  const { data: leadsData = [], isLoading } = useQuery({
    queryKey: ['/api/leads'],
    refetchInterval: 5000 // Actualizar cada 5 segundos para mostrar chats convertidos automáticamente
  });

  // Obtener estadísticas del pipeline
  const { data: pipelineStats } = useQuery({
    queryKey: ['/api/leads/pipeline-stats']
  });

  // Mutación para actualizar lead
  const updateLeadMutation = useMutation({
    mutationFn: async (leadData: Partial<Lead>) => {
      return await apiRequest(`/api/leads/${leadData.id}`, {
        method: 'PUT',
        body: JSON.stringify(leadData)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/leads/pipeline-stats'] });
      toast({
        title: "Lead actualizado",
        description: "El lead ha sido actualizado exitosamente"
      });
      setIsEditDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el lead",
        variant: "destructive"
      });
    }
  });

  // Filtrar leads
  const filteredLeads = leadsData.filter((lead: Lead) => {
    const matchesSearch = lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.phone.includes(searchTerm);
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    const matchesStage = stageFilter === "all" || lead.stage === stageFilter;
    return matchesSearch && matchesStatus && matchesStage;
  });

  // Agrupar leads por etapa para vista pipeline
  const leadsByStage = LEAD_STAGES.reduce((acc, stage) => {
    acc[stage.id] = filteredLeads.filter((lead: Lead) => lead.stage === stage.id);
    return acc;
  }, {} as Record<string, Lead[]>);

  const handleUpdateLead = (leadData: Partial<Lead>) => {
    updateLeadMutation.mutate(leadData);
  };

  const getInterestColor = (level: string) => {
    const interest = INTEREST_LEVELS.find(i => i.value === level);
    return interest?.color || 'text-gray-600';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const LeadCard = ({ lead, isDraggable = false }: { lead: Lead; isDraggable?: boolean }) => (
    <Card className="mb-3 hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-sm">{lead.name}</h3>
          <Badge variant="secondary" className={getInterestColor(lead.interestLevel || 'unknown')}>
            {INTEREST_LEVELS.find(i => i.value === lead.interestLevel)?.label || 'Desconocido'}
          </Badge>
        </div>
        
        <div className="space-y-1 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <Phone className="w-3 h-3" />
            {lead.phone}
          </div>
          {lead.email && (
            <div className="flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {lead.email}
            </div>
          )}
          <div className="flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            {formatCurrency(lead.estimatedValue || 0)}
          </div>
          {lead.chatId && (
            <div className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              <span className="text-green-600">Chat activo</span>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center mt-3">
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedLead(lead);
                setIsDetailDialogOpen(true);
              }}
            >
              <Eye className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedLead(lead);
                setIsEditDialogOpen(true);
              }}
            >
              <Edit className="w-3 h-3" />
            </Button>
          </div>
          <span className="text-xs text-gray-500">
            {new Date(lead.createdAt).toLocaleDateString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando leads...</p>
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
          <h1 className="text-3xl font-bold">Leads & Pipeline de Ventas</h1>
          <p className="text-gray-600 mt-1">
            Gestiona tus leads y supervisa el pipeline de ventas en tiempo real
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-green-50">
            <MessageSquare className="w-3 h-3 mr-1" />
            Conversión automática activa
          </Badge>
        </div>
      </div>

      {/* Estadísticas */}
      {pipelineStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Leads</p>
                  <p className="text-2xl font-bold">{pipelineStats.totalLeads || 0}</p>
                </div>
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Valor Total</p>
                  <p className="text-2xl font-bold">{formatCurrency(pipelineStats.totalValue || 0)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Tasa Conversión</p>
                  <p className="text-2xl font-bold">{pipelineStats.conversionRate || 0}%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Chats Hoy</p>
                  <p className="text-2xl font-bold">{pipelineStats.chatsToday || 0}</p>
                </div>
                <MessageSquare className="w-8 h-8 text-orange-600" />
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
            placeholder="Buscar leads..."
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
            <SelectItem value="active">Activo</SelectItem>
            <SelectItem value="contacted">Contactado</SelectItem>
            <SelectItem value="qualified">Calificado</SelectItem>
            <SelectItem value="unqualified">No calificado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por etapa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las etapas</SelectItem>
            {LEAD_STAGES.map(stage => (
              <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pipeline">Vista Pipeline</TabsTrigger>
          <TabsTrigger value="list">Vista Lista</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-6">
          {/* Vista Pipeline */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {LEAD_STAGES.map(stage => (
              <div key={stage.id} className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-sm">{stage.name}</h3>
                  <Badge className={`${stage.color} text-white`}>
                    {leadsByStage[stage.id]?.length || 0}
                  </Badge>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {leadsByStage[stage.id]?.map(lead => (
                    <LeadCard key={lead.id} lead={lead} isDraggable />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="list" className="mt-6">
          {/* Vista Lista */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLeads.map((lead: Lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog para ver detalles */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles del Lead</DialogTitle>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nombre</Label>
                  <p className="font-medium">{selectedLead.name}</p>
                </div>
                <div>
                  <Label>Teléfono</Label>
                  <p>{selectedLead.phone}</p>
                </div>
                <div>
                  <Label>Email</Label>
                  <p>{selectedLead.email}</p>
                </div>
                <div>
                  <Label>Empresa</Label>
                  <p>{selectedLead.company}</p>
                </div>
                <div>
                  <Label>Valor Estimado</Label>
                  <p className="text-green-600 font-semibold">
                    {formatCurrency(selectedLead.estimatedValue || 0)}
                  </p>
                </div>
                <div>
                  <Label>Nivel de Interés</Label>
                  <Badge className={getInterestColor(selectedLead.interestLevel || 'unknown')}>
                    {INTEREST_LEVELS.find(i => i.value === selectedLead.interestLevel)?.label || 'Desconocido'}
                  </Badge>
                </div>
              </div>
              <div>
                <Label>Notas</Label>
                <p className="text-sm text-gray-600 mt-1">{selectedLead.notes}</p>
              </div>
              <div>
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedLead.tags?.map((tag, index) => (
                    <Badge key={index} variant="outline">{tag}</Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog para editar */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Lead</DialogTitle>
          </DialogHeader>
          {selectedLead && (
            <EditLeadForm 
              lead={selectedLead} 
              onSave={handleUpdateLead}
              onCancel={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditLeadForm({ lead, onSave, onCancel }: {
  lead: Lead;
  onSave: (data: Partial<Lead>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    estimatedValue: lead.estimatedValue || 0,
    stage: lead.stage,
    status: lead.status,
    interestLevel: lead.interestLevel || 'unknown',
    notes: lead.notes || '',
    tags: lead.tags?.join(', ') || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: lead.id,
      ...formData,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="company">Empresa</Label>
          <Input
            id="company"
            value={formData.company}
            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="estimatedValue">Valor Estimado</Label>
          <Input
            id="estimatedValue"
            type="number"
            min="0"
            step="0.01"
            value={formData.estimatedValue}
            onChange={(e) => setFormData({ ...formData, estimatedValue: parseFloat(e.target.value) })}
          />
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
          <Label htmlFor="stage">Etapa</Label>
          <Select value={formData.stage} onValueChange={(value) => setFormData({ ...formData, stage: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_STAGES.map(stage => (
                <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
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
              <SelectItem value="active">Activo</SelectItem>
              <SelectItem value="contacted">Contactado</SelectItem>
              <SelectItem value="qualified">Calificado</SelectItem>
              <SelectItem value="unqualified">No calificado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="tags">Tags (separados por coma)</Label>
        <Input
          id="tags"
          value={formData.tags}
          onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
          placeholder="ventas, potencial, nuevo"
        />
      </div>
      <div>
        <Label htmlFor="notes">Notas</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit">
          Guardar
        </Button>
      </div>
    </form>
  );
}