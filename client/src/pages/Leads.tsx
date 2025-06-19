import { useState } from "react";
import { Helmet } from "react-helmet";
import { useQuery } from "@tanstack/react-query";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lead } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Type definitions for WhatsApp API responses
interface WhatsAppAccount {
  id: number;
  accountName: string;
  phoneNumber: string;
  authenticated: boolean;
  ready: boolean;
  status: string;
  autoResponseEnabled: boolean;
  name?: string;
}

interface WhatsAppStatusResponse {
  success: boolean;
  accounts: WhatsAppAccount[];
}
import { useToast } from "@/hooks/use-toast";
import LeadForm from "@/components/leads/LeadForm";
import { LeadDetail } from "@/components/leads/LeadDetail";
import { useGemini } from "@/hooks/useGemini";
import { Eye, BrainCircuit, Plus, MoreVertical, Kanban, MessageCircle, Database, Settings, Trash, RefreshCw } from "lucide-react";
import SalesPipelineKanban from "@/components/leads/SalesPipelineKanban";

export default function Leads() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [viewingLeadId, setViewingLeadId] = useState<number | null>(null);
  const { toast } = useToast();
  const { analyzeLead } = useGemini();

  // Fetch all leads
  const { data: allLeads, isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  // Check WhatsApp connection status
  const { data: whatsappStatus } = useQuery<WhatsAppStatusResponse>({
    queryKey: ["/api/whatsapp-accounts"],
    refetchInterval: 10000, // Check every 10 seconds
  });

  // Determine if WhatsApp is connected by checking nested authentication status
  const isWhatsAppConnected = Boolean(
    whatsappStatus?.success && 
    whatsappStatus?.accounts?.some((account: any) => {
      // Check authentication in nested sessionData and currentStatus objects
      const sessionAuthenticated = account.sessionData?.authenticated === true;
      const sessionReady = account.sessionData?.ready === true;
      const currentAuthenticated = account.currentStatus?.authenticated === true;
      const currentReady = account.currentStatus?.ready === true;
      
      // Also check top-level properties as fallback
      const topLevelAuth = account.authenticated === true;
      const topLevelReady = account.ready === true;
      const hasAutoResponse = account.autoResponseEnabled === true;
      const isActive = account.status === 'Conectado' || account.status === 'active';
      
      return sessionAuthenticated || sessionReady || currentAuthenticated || 
             currentReady || topLevelAuth || topLevelReady || hasAutoResponse || isActive;
    })
  );

  // Get detailed connection status with proper nested status checking
  const getConnectionStatus = () => {
    if (!whatsappStatus?.success) return { text: "Verificando...", connected: false };
    
    const connectedAccounts = whatsappStatus.accounts?.filter((account: any) => {
      const sessionAuth = account.sessionData?.authenticated || account.sessionData?.ready;
      const currentAuth = account.currentStatus?.authenticated || account.currentStatus?.ready;
      const topLevel = account.authenticated || account.ready || account.autoResponseEnabled;
      const isActive = account.status === 'Conectado' || account.status === 'active';
      
      return sessionAuth || currentAuth || topLevel || isActive;
    }) || [];
    
    if (connectedAccounts.length > 0) {
      const accountNames = connectedAccounts.map((acc: any) => acc.name || acc.accountName).join(', ');
      return { 
        text: `WhatsApp Conectado (${accountNames})`, 
        connected: true,
        accounts: connectedAccounts
      };
    }
    
    return { text: "WhatsApp Sin Autenticar", connected: false };
  };

  const connectionStatus = getConnectionStatus();

  // Filter leads based on search term and selected status
  const filteredLeads = allLeads?.filter(lead => {
    const matchesSearch = 
      !searchTerm || 
      lead.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.company && lead.company.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = !selectedStatus || lead.status === selectedStatus;
    
    return matchesSearch && matchesStatus;
  });

  // Handle lead status update
  const handleUpdateStatus = async (leadId: number, newStatus: string) => {
    try {
      await apiRequest(`/api/leads/${leadId}/status`, {
        method: 'PATCH',
        body: { status: newStatus }
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      
      toast({
        title: "Lead status updated",
        description: `Lead has been moved to ${newStatus}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update lead status",
        variant: "destructive",
      });
    }
  };

  // Handle lead deletion
  const handleDeleteLead = async (leadId: number) => {
    try {
      await apiRequest(`/api/leads/${leadId}`, {
        method: 'DELETE'
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      
      toast({
        title: "Lead deleted",
        description: "Lead has been permanently deleted",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete lead",
        variant: "destructive",
      });
    }
  };

  // Handle lead analysis with Gemini AI
  const handleAnalyzeWithAI = async (leadId: number) => {
    try {
      await analyzeLead(leadId);
      
      toast({
        title: "Análisis IA completado",
        description: "El lead ha sido analizado y enriquecido con Gemini AI",
      });
      
      // Refrescar la lista de leads
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo analizar el lead con IA",
        variant: "destructive",
      });
    }
  };

  // Handle convert all WhatsApp chats to leads
  const handleConvertWhatsAppChats = async () => {
    try {
      const response = await apiRequest('/api/convert-all-chats', {
        method: 'POST'
      });

      if (response.success) {
        toast({
          title: "Conversión automática completada",
          description: `${response.converted} leads creados de ${response.processed} chats procesados`,
        });
        
        // Refresh leads list
        queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      } else {
        throw new Error(response.error || 'Error en la conversión');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron convertir los chats a leads",
        variant: "destructive",
      });
    }
  };

  // Handle refresh real data from WhatsApp
  const handleRefreshRealData = async () => {
    try {
      const response = await apiRequest('/api/whatsapp-accounts/sync-real-chats', {
        method: 'POST'
      });
      
      if (response.success) {
        toast({
          title: "Sincronización completada",
          description: `${response.synced || 0} chats sincronizados desde WhatsApp`,
        });
        
        queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      } else {
        throw new Error(response.error || 'Sync failed');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron sincronizar los datos reales de WhatsApp",
        variant: "destructive",
      });
    }
  };

  // Handle create new status
  const handleCreateStatus = async () => {
    const statusName = prompt('Ingrese el nombre del nuevo estado:');
    if (!statusName) return;
    
    try {
      const response = await apiRequest('/api/lead-statuses', {
        method: 'POST',
        body: JSON.stringify({
          name: statusName.toLowerCase().replace(/\s+/g, '-'),
          displayName: statusName
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.success) {
        toast({
          title: "Estado creado",
          description: `El estado "${statusName}" se creó exitosamente`,
        });
      } else {
        throw new Error(response.error || 'Status creation failed');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo crear el nuevo estado",
        variant: "destructive",
      });
    }
  };

  // Handle clear database
  const handleClearDatabase = async () => {
    if (!confirm('¿Estás seguro de que quieres eliminar todos los leads de WhatsApp? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const response = await apiRequest('/api/leads/clear-whatsapp', {
        method: 'DELETE'
      });

      if (response.success) {
        toast({
          title: "Base de datos limpiada",
          description: `${response.deleted || 0} leads de WhatsApp eliminados`,
        });
        
        queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      } else {
        throw new Error(response.message || 'Error al limpiar la base de datos');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo limpiar la base de datos",
        variant: "destructive",
      });
    }
  };



  // Get badge variant based on status
  const getStatusBadgeVariant = (status?: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (status) {
      case 'new': return 'default';
      case 'contacted': return 'secondary';
      case 'meeting': return 'outline';
      case 'closed-won': return 'default';
      case 'closed-lost': return 'destructive';
      default: return 'default';
    }
  };

  // Format status for display
  const formatStatus = (status?: string) => {
    if (!status) return 'New';
    
    switch (status) {
      case 'new': return 'New';
      case 'contacted': return 'Contacted';
      case 'meeting': return 'Meeting';
      case 'closed-won': return 'Won';
      case 'closed-lost': return 'Lost';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  return (
    <>
      <Helmet>
        <title>Leads | GeminiCRM</title>
        <meta name="description" content="Manage your leads with intelligent AI-powered insights and tracking" />
      </Helmet>

      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 md:hidden">Leads</h1>
          <p className="text-sm text-gray-500">
            Manage and track your leads through the sales pipeline
          </p>
        </div>
        <Button 
          className="bg-primary-600 hover:bg-primary-700 text-white self-end"
          onClick={() => setEditingLead({ status: 'new' } as Lead)}
        >
          <span className="material-icons text-sm mr-1">add</span>
          New Lead
        </Button>
      </div>

      <Tabs defaultValue="pipeline" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="grid w-auto grid-cols-2">
            <TabsTrigger value="pipeline" className="flex items-center space-x-2">
              <Kanban className="h-4 w-4" />
              <span>Sales Pipeline</span>
            </TabsTrigger>
            <TabsTrigger value="table" className="flex items-center space-x-2">
              <span>Table View</span>
            </TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-3">
            <Button
              onClick={handleConvertWhatsAppChats}
              variant="outline"
              className="bg-green-50 hover:bg-green-100 border-green-200 text-green-700 font-medium"
              title="Convertir conversaciones reales de WhatsApp a leads"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Convertir Chats Reales
            </Button>
            
            <Button
              onClick={handleConvertWhatsAppChats}
              variant="default"
              className="bg-green-600 hover:bg-green-700 text-white"
              title="Convertir TODOS los chats de WhatsApp a leads automáticamente"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Convert All</span>
            </Button>
            
            <Button
              onClick={handleRefreshRealData}
              variant="outline"
              disabled={!connectionStatus.connected}
              className="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
              title="Actualizar datos reales de WhatsApp"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            
            <Button
              onClick={handleCreateStatus}
              variant="outline"
              className="bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-700"
              title="Crear nuevo estado"
            >
              <Settings className="h-4 w-4" />
            </Button>
            
            <Button
              onClick={handleClearDatabase}
              variant="outline"
              className="bg-red-50 hover:bg-red-100 border-red-200 text-red-700"
              title="Limpiar base de datos de WhatsApp"
            >
              <Trash className="h-4 w-4" />
            </Button>
            <Input
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
            <Select 
              value={selectedStatus || ""}
              onValueChange={(value) => setSelectedStatus(value === "all" ? null : value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="closed-won">Closed (Won)</SelectItem>
                <SelectItem value="closed-lost">Closed (Lost)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="pipeline">
          <SalesPipelineKanban />
        </TabsContent>

        <TabsContent value="table">
          <Card>
            <CardContent className="pt-6">
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded"></div>
              ))}
            </div>
          ) : filteredLeads?.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <div className="text-lg font-medium mb-2">No leads found</div>
              <p className="text-sm">Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead className="hidden md:table-cell">Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Source</TableHead>
                    <TableHead className="hidden lg:table-cell">Account</TableHead>
                    <TableHead className="hidden lg:table-cell">Match</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads?.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.fullName || lead.name}</TableCell>
                      <TableCell className="hidden md:table-cell">{lead.email}</TableCell>
                      <TableCell className="hidden md:table-cell">{lead.company || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(lead.status)}>
                          {formatStatus(lead.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">{lead.source || "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {lead.whatsappAccountId && (
                          <Badge variant="outline" className="text-xs">
                            WA-{lead.whatsappAccountId}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {lead.matchPercentage ? (
                          <span className="text-xs font-medium text-green-600">
                            {lead.matchPercentage}%
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setViewingLeadId(lead.id)}
                            title="Ver detalles"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleAnalyzeWithAI(lead.id)}
                            title="Analizar con IA"
                          >
                            <BrainCircuit className="h-4 w-4" />
                          </Button>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => setEditingLead(lead)}>
                                <span className="material-icons mr-2 text-sm">edit</span>
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setViewingLeadId(lead.id)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver detalles
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAnalyzeWithAI(lead.id)}>
                                <BrainCircuit className="h-4 w-4 mr-2" />
                                Analizar con IA
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel>Cambiar estado</DropdownMenuLabel>
                            {["new", "contacted", "meeting", "closed-won", "closed-lost"].map((status) => (
                              <DropdownMenuItem
                                key={status}
                                disabled={lead.status === status}
                                onClick={() => handleUpdateStatus(lead.id, status)}
                              >
                                <Badge 
                                  variant={getStatusBadgeVariant(status)}
                                  className="mr-2"
                                >
                                  {formatStatus(status)}
                                </Badge>
                                Move to {formatStatus(status)}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={() => handleDeleteLead(lead.id)}
                            >
                              <span className="material-icons mr-2 text-sm">delete</span>
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {editingLead && (
        <LeadForm 
          open={!!editingLead} 
          onClose={() => setEditingLead(null)} 
          initialData={editingLead}
        />
      )}
      
      {viewingLeadId && (
        <LeadDetail
          leadId={viewingLeadId}
          open={!!viewingLeadId}
          onClose={() => setViewingLeadId(null)}
        />
      )}
    </>
  );
}
