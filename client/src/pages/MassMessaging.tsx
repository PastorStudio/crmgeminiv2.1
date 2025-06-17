import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { TemplateSelector } from "@/components/message-templates/TemplateSelector";
import { TemplatePreview } from "@/components/message-templates/TemplatePreview";
import { SendImmediateDialog } from "@/components/messaging/SendImmediateDialog";
import { WhatsAppAuthStatus } from "@/components/whatsapp/WhatsAppAuthStatus";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select, 
  SelectContent, 
  SelectGroup, 
  SelectItem, 
  SelectLabel, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Loader2, 
  Send, 
  Pause, 
  Play, 
  PlusCircle, 
  Settings, 
  AlertTriangle, 
  Info, 
  Calendar, 
  User, 
  Users, 
  CheckCheck, 
  XCircle, 
  Upload, 
  Database, 
  FileText, 
  FileSpreadsheet, 
  CheckCircle, 
  Phone, 
  Clock, 
  AlertCircle, 
  Check, 
  Circle, 
  Plus, 
  RefreshCw, 
  Tag,
  MessageSquare,
  BarChart3,
  Target,
  Filter
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ContactCategorySelector } from "@/components/contacts/ContactCategorySelector";

// Tipos para las campañas de envío masivo
interface ContactGroup {
  id: string;
  name: string;
  count: number;
}

interface ContactStatus {
  id: string;
  phoneNumber: string;
  name?: string;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'verified';
  sentAt?: string;
  verifiedAt?: string;
  errorMessage?: string;
}

interface MassSendConfig {
  delayBetweenMessages: number;
  pauseBetweenChunks: number;
  chunkSize: number;
  markAsRead: boolean;
  simulateTyping: boolean;
  typingTime: number;
  randomFactor: number;
  personalizeMessages: boolean;
  useAIPersonalization: boolean;
  messageVariations: boolean;
  splitLongMessages: boolean;
  restrictRepeatedRecipients: boolean;
  restrictionPeriod: number;
  maxMessagesPerPeriod: number;
  respectBusinessHours: boolean;
  businessHoursStart: number;
  businessHoursEnd: number;
  businessDays: number[];
}

interface SendingConfig {
  minIntervalMs: number;
  maxIntervalMs: number;
  batchSize: number;
  pauseBetweenBatchesMs: number;
  simulateTyping: boolean;
  typingDurationMs: number;
  respectBusinessHours: boolean;
  businessHoursStart: number;
  businessHoursEnd: number;
}

interface Campaign {
  id: string;
  name: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  totalContacts: number;
  processedContacts: number;
  successfulSends: number;
  failedSends: number;
  messageTemplate: string;
  config?: MassSendConfig;
  sendingConfig?: SendingConfig;
  targetGroups: string[] | [];
  targetTags: string[] | [];
  excludedContacts: string[] | [];
  contacts?: ContactStatus[];
}

export default function MassMessaging() {
  const [tab, setTab] = useState("new-campaign");
  const [campaignName, setCampaignName] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<MassSendConfig>({
    delayBetweenMessages: 8000,
    pauseBetweenChunks: 180000,
    chunkSize: 15,
    markAsRead: true,
    simulateTyping: true,
    typingTime: 3000,
    randomFactor: 0.3,
    personalizeMessages: true,
    useAIPersonalization: false,
    messageVariations: true,
    splitLongMessages: true,
    restrictRepeatedRecipients: true,
    restrictionPeriod: 24,
    maxMessagesPerPeriod: 100,
    respectBusinessHours: true,
    businessHoursStart: 9,
    businessHoursEnd: 18,
    businessDays: [1, 2, 3, 4, 5]
  });
  const [previewContact, setPreviewContact] = useState<any>({
    name: "Juan Pérez",
    company: "Empresa Ejemplo S.A."
  });
  
  // Estados para la importación de Excel
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isFieldMappingOpen, setIsFieldMappingOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({
    phoneNumber: 'none',
    name: 'none',
    company: 'none',
    email: 'none',
    tags: 'none'
  });
  const [importedData, setImportedData] = useState<any>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [countryCode, setCountryCode] = useState<string>("507"); // Panamá por defecto
  const [selectedWhatsAppAccountId, setSelectedWhatsAppAccountId] = useState<number | null>(null);
  const [isTaggingDialogOpen, setIsTaggingDialogOpen] = useState<boolean>(false);
  const [selectedTagsToAdd, setSelectedTagsToAdd] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState<string>("");
  
  // Estados para envío inmediato
  const [showImmediateMessaging, setShowImmediateMessaging] = useState<boolean>(false);
  const [messageText, setMessageText] = useState<string>("");
  const [isSendingMessages, setIsSendingMessages] = useState<boolean>(false);
  const [selectedImportedContactIds, setSelectedImportedContactIds] = useState<string[]>([]);
  const [selectAllImported, setSelectAllImported] = useState<boolean>(false);
  
  // Estados para contactos individuales de WhatsApp
  const [showWhatsAppContacts, setShowWhatsAppContacts] = useState<boolean>(false);
  const [selectedWhatsAppContactIds, setSelectedWhatsAppContactIds] = useState<string[]>([]);
  const [selectAllWhatsAppContacts, setSelectAllWhatsAppContacts] = useState<boolean>(false);
  const [whatsAppContacts, setWhatsAppContacts] = useState<any[]>([]);
  
  // Estados para asistente Gemini
  const [isGeminiAssistantOpen, setIsGeminiAssistantOpen] = useState<boolean>(false);
  const [geminiResult, setGeminiResult] = useState<string>("");
  const [geminiPrompt, setGeminiPrompt] = useState<string>("");
  const [isGeneratingWithGemini, setIsGeneratingWithGemini] = useState<boolean>(false);
  
  // Estados para manejo de contactos y etiquetas
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectedTagFilters, setSelectedTagFilters] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedContactForTags, setSelectedContactForTags] = useState<any>(null);
  const [contactTagsDialog, setContactTagsDialog] = useState<boolean>(false);
  const [newContactTag, setNewContactTag] = useState<string>("");
  const [isSyncingContacts, setIsSyncingContacts] = useState<boolean>(false);
  
  // Estados para el selector de contactos por categorías
  const [showContactCategorySelector, setShowContactCategorySelector] = useState<boolean>(false);
  const [selectedCategoryContacts, setSelectedCategoryContacts] = useState<any[]>([]);
  const [categoryContactsSource, setCategoryContactsSource] = useState<'whatsapp' | 'database'>('database');

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
        filterColumn: "none",
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

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
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
                      <SelectItem value="none">Sin filtro</SelectItem>
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
                    disabled={campaignForm.filterColumn === "none"}
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