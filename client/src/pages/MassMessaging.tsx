import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageSquare, 
  Send, 
  Users, 
  Filter, 
  CheckCircle, 
  XCircle, 
  Clock,
  BarChart3,
  Settings,
  Target
} from "lucide-react";
import type { MassCampaign, ContactDatabase } from "@shared/schema";

interface CampaignForm {
  name: string;
  message: string;
  targetCount: number;
  filterColumn: string;
  filterValue: string;
  whatsappAccountId?: number;
}

interface FilteredContacts {
  contacts: ContactDatabase[];
  count: number;
}

interface CampaignStats {
  campaignStats: {
    totalCampaigns: number;
    totalMessagesSent: number;
    totalMessagesFailed: number;
    activeCampaigns: number;
  };
  contactStats: {
    totalContacts: number;
    usedContacts: number;
    pendingContacts: number;
  };
}

export default function MassMessaging() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [campaignForm, setCampaignForm] = useState<CampaignForm>({
    name: "",
    message: "",
    targetCount: 10,
    filterColumn: "",
    filterValue: "",
    whatsappAccountId: 1
  });
  
  const [previewContacts, setPreviewContacts] = useState<ContactDatabase[]>([]);
  const [selectedTab, setSelectedTab] = useState("create");

  // Obtener estadísticas
  const { data: stats } = useQuery<CampaignStats>({
    queryKey: ["/api/mass-campaigns/stats"],
  });

  // Obtener campañas existentes
  const { data: campaignsData, isLoading: campaignsLoading } = useQuery<{campaigns: MassCampaign[]}>({
    queryKey: ["/api/mass-campaigns"],
  });

  // Obtener cuentas de WhatsApp
  const { data: whatsappAccounts } = useQuery({
    queryKey: ["/api/whatsapp-accounts"],
  });

  // Mutación para crear campaña
  const createCampaignMutation = useMutation({
    mutationFn: async (campaignData: CampaignForm) => {
      const response = await fetch("/api/mass-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...campaignData,
          createdBy: 999 // Usuario demo
        }),
      });
      
      if (!response.ok) {
        throw new Error("Error creando campaña");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Campaña creada",
        description: "La campaña de mensajería masiva ha sido creada exitosamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mass-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mass-campaigns/stats"] });
      setCampaignForm({
        name: "",
        message: "",
        targetCount: 10,
        filterColumn: "",
        filterValue: "",
        whatsappAccountId: 1
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo crear la campaña",
        variant: "destructive",
      });
    },
  });

  // Mutación para enviar campaña
  const sendCampaignMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      const response = await fetch(`/api/mass-campaigns/${campaignId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) {
        throw new Error("Error enviando campaña");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Campaña enviada",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/mass-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/mass-campaigns/stats"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo enviar la campaña",
        variant: "destructive",
      });
    },
  });

  // Función para obtener vista previa de contactos
  const previewContactsMutation = useMutation({
    mutationFn: async (filterData: {filterColumn: string, filterValue: string, limit: number}) => {
      const response = await fetch("/api/mass-campaigns/filter-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filterData),
      });
      
      if (!response.ok) {
        throw new Error("Error obteniendo contactos");
      }
      
      return response.json();
    },
    onSuccess: (data: FilteredContacts) => {
      setPreviewContacts(data.contacts);
    },
  });

  // Función para previsualizar contactos
  const handlePreviewContacts = () => {
    previewContactsMutation.mutate({
      filterColumn: campaignForm.filterColumn,
      filterValue: campaignForm.filterValue,
      limit: campaignForm.targetCount
    });
  };

  // Función para crear campaña
  const handleCreateCampaign = () => {
    if (!campaignForm.name || !campaignForm.message) {
      toast({
        title: "Campos requeridos",
        description: "Por favor completa el nombre y mensaje de la campaña",
        variant: "destructive",
      });
      return;
    }
    
    createCampaignMutation.mutate(campaignForm);
  };

  // Función para enviar campaña
  const handleSendCampaign = (campaignId: number) => {
    sendCampaignMutation.mutate(campaignId);
  };

  // Función para obtener el estado visual
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pendiente</Badge>;
      case 'running':
        return <Badge variant="default"><Send className="w-3 h-3 mr-1" />Enviando</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Completada</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Fallida</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mensajería Masiva</h1>
          <p className="text-muted-foreground">
            Gestiona campañas de mensajes masivos de WhatsApp con filtros y seguimiento
          </p>
        </div>
        <MessageSquare className="h-8 w-8 text-primary" />
      </div>

      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Campañas</p>
                  <p className="text-2xl font-bold">{stats.campaignStats.totalCampaigns}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Mensajes Enviados</p>
                  <p className="text-2xl font-bold">{stats.campaignStats.totalMessagesSent || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Contactos</p>
                  <p className="text-2xl font-bold">{stats.contactStats.totalContacts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Contactos Disponibles</p>
                  <p className="text-2xl font-bold">{stats.contactStats.pendingContacts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="create">Crear Campaña</TabsTrigger>
          <TabsTrigger value="campaigns">Campañas</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Nueva Campaña de Mensajería Masiva
              </CardTitle>
              <CardDescription>
                Configura los filtros, mensaje y cantidad para tu campaña
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre de la Campaña</Label>
                  <Input
                    id="name"
                    value={campaignForm.name}
                    onChange={(e) => setCampaignForm(prev => ({...prev, name: e.target.value}))}
                    placeholder="Ej: Promoción Enero 2025"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="targetCount">Cantidad Objetivo</Label>
                  <Input
                    id="targetCount"
                    type="number"
                    value={campaignForm.targetCount}
                    onChange={(e) => setCampaignForm(prev => ({...prev, targetCount: parseInt(e.target.value) || 0}))}
                    placeholder="10"
                    min="1"
                    max="1000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="filterColumn">Filtrar por Columna</Label>
                  <Select value={campaignForm.filterColumn} onValueChange={(value) => setCampaignForm(prev => ({...prev, filterColumn: value}))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar filtro" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sin filtro</SelectItem>
                      <SelectItem value="genero">Género</SelectItem>
                      <SelectItem value="nivel_socioeconomico">Nivel Socioeconómico</SelectItem>
                      <SelectItem value="grupo_edad">Grupo de Edad</SelectItem>
                      <SelectItem value="militante">Militante</SelectItem>
                      <SelectItem value="tipo_contratacion">Tipo de Contratación</SelectItem>
                      <SelectItem value="escolaridad">Escolaridad</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="filterValue">Valor del Filtro</Label>
                  <Input
                    id="filterValue"
                    value={campaignForm.filterValue}
                    onChange={(e) => setCampaignForm(prev => ({...prev, filterValue: e.target.value}))}
                    placeholder="Ej: Femenino, Bajo, etc."
                    disabled={!campaignForm.filterColumn}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Mensaje</Label>
                <Textarea
                  id="message"
                  value={campaignForm.message}
                  onChange={(e) => setCampaignForm(prev => ({...prev, message: e.target.value}))}
                  placeholder="Escribe tu mensaje aquí..."
                  rows={4}
                />
                <p className="text-sm text-muted-foreground">
                  Caracteres: {campaignForm.message.length}
                </p>
              </div>

              <div className="flex space-x-2">
                <Button 
                  onClick={handlePreviewContacts}
                  variant="outline"
                  disabled={previewContactsMutation.isPending}
                  className="flex-1"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Vista Previa Contactos
                </Button>
                
                <Button 
                  onClick={handleCreateCampaign}
                  disabled={createCampaignMutation.isPending || !campaignForm.name || !campaignForm.message}
                  className="flex-1"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Crear Campaña
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Vista previa de contactos */}
          {previewContacts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Vista Previa de Contactos ({previewContacts.length})</CardTitle>
                <CardDescription>
                  Contactos que recibirán el mensaje con los filtros aplicados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {previewContacts.map((contact) => (
                    <div key={contact.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center space-x-3">
                        <div>
                          <p className="font-medium">
                            {contact.nombrePila} {contact.apellidoPaterno}
                          </p>
                          <p className="text-sm text-muted-foreground">{contact.telefono}</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        {contact.genero && <Badge variant="outline">{contact.genero}</Badge>}
                        {contact.nivelSocioeconomico && <Badge variant="outline">{contact.nivelSocioeconomico}</Badge>}
                        {contact.massMessageStatus === 'sent' && <CheckCircle className="w-4 h-4 text-green-500" />}
                        {contact.massMessageStatus === 'failed' && <XCircle className="w-4 h-4 text-red-500" />}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Campañas de Mensajería Masiva</CardTitle>
              <CardDescription>
                Gestiona y monitorea tus campañas existentes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {campaignsLoading ? (
                <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {campaignsData?.campaigns?.map((campaign) => (
                    <div key={campaign.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{campaign.name}</h3>
                        {getStatusBadge(campaign.status)}
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3">
                        {campaign.message}
                      </p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Objetivo:</span>
                          <p className="font-medium">{campaign.targetCount}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Enviados:</span>
                          <p className="font-medium text-green-600">{campaign.successCount || 0}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Fallidos:</span>
                          <p className="font-medium text-red-600">{campaign.failedCount || 0}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Filtro:</span>
                          <p className="font-medium">
                            {campaign.filterColumn ? `${campaign.filterColumn}: ${campaign.filterValue}` : 'Sin filtro'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center mt-4">
                        <p className="text-xs text-muted-foreground">
                          Creada: {new Date(campaign.createdAt).toLocaleDateString()}
                        </p>
                        
                        {campaign.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => handleSendCampaign(campaign.id)}
                            disabled={sendCampaignMutation.isPending}
                          >
                            <Send className="w-3 h-3 mr-1" />
                            Enviar
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {(!campaignsData?.campaigns || campaignsData.campaigns.length === 0) && (
                    <div className="text-center p-8">
                      <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium">No hay campañas</h3>
                      <p className="text-muted-foreground">Crea tu primera campaña de mensajería masiva</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}