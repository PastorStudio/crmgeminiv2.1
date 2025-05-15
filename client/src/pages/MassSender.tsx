import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { TemplateSelector } from "@/components/message-templates/TemplateSelector";
import { TemplatePreview } from "@/components/message-templates/TemplatePreview";
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
import { Loader2, Send, Pause, Play, PlusCircle, Settings, AlertTriangle, Info, Calendar, User, Users, CheckCheck, XCircle, Upload, Database, FileText, FileSpreadsheet } from "lucide-react";
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";

// Tipos para las campañas de envío masivo
interface ContactGroup {
  id: string;
  name: string;
  count: number;
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
}

export default function MassSender() {
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({
    phoneNumber: '',
    name: '',
    company: '',
    email: '',
    tags: ''
  });
  const [importedData, setImportedData] = useState<any>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  
  // Consulta para obtener los grupos de contactos
  const { data: contactGroups = [], isLoading: loadingGroups } = useQuery<ContactGroup[]>({
    queryKey: ['/api/whatsapp/contact-groups'],
    retry: false
  });
  
  // Consulta para obtener las etiquetas disponibles
  const { data: contactTags = [], isLoading: loadingTags } = useQuery<any[]>({
    queryKey: ['/api/whatsapp/contact-tags'],
    retry: false
  });
  
  // Consulta para obtener todas las campañas
  const { 
    data: campaigns = [], 
    isLoading: loadingCampaigns,
    refetch: refetchCampaigns
  } = useQuery<Campaign[]>({
    queryKey: ['/api/mass-sender/campaigns'],
    retry: false
  });
  
  // Mutación para crear una nueva campaña
  const createCampaignMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/mass-sender/campaigns", { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mass-sender/campaigns'] });
      toast({
        title: "Campaña creada",
        description: "La campaña de mensajes se ha creado correctamente.",
      });
      // Limpiar el formulario
      setCampaignName("");
      setMessageTemplate("");
      setSelectedGroups([]);
      setSelectedTags([]);
      setCurrentConfig({
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
      // Cambiar a la pestaña de campañas
      setTab("campaigns");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo crear la campaña de mensajes.",
        variant: "destructive",
      });
    }
  });
  
  // Mutación para iniciar una campaña
  const startCampaignMutation = useMutation({
    mutationFn: (campaignId: string) => 
      apiRequest(`/api/mass-sender/campaigns/${campaignId}/start`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mass-sender/campaigns'] });
      toast({
        title: "Campaña iniciada",
        description: "La campaña de mensajes se ha iniciado correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo iniciar la campaña de mensajes.",
        variant: "destructive",
      });
    }
  });
  
  // Mutación para pausar una campaña
  const pauseCampaignMutation = useMutation({
    mutationFn: (campaignId: string) => 
      apiRequest(`/api/mass-sender/campaigns/${campaignId}/pause`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mass-sender/campaigns'] });
      toast({
        title: "Campaña pausada",
        description: "La campaña de mensajes se ha pausado correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo pausar la campaña de mensajes.",
        variant: "destructive",
      });
    }
  });
  
  // Mutación para reanudar una campaña
  const resumeCampaignMutation = useMutation({
    mutationFn: (campaignId: string) => 
      apiRequest(`/api/mass-sender/campaigns/${campaignId}/resume`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mass-sender/campaigns'] });
      toast({
        title: "Campaña reanudada",
        description: "La campaña de mensajes se ha reanudado correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo reanudar la campaña de mensajes.",
        variant: "destructive",
      });
    }
  });
  
  // Mutación para cargar archivo Excel
  const uploadExcelMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/excel/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Error al cargar el archivo Excel');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Archivo cargado",
        description: "El archivo Excel ha sido cargado correctamente.",
      });
      
      // Obtener las columnas del archivo
      analyzeExcelMutation.mutate(data.filename);
    },
    onError: (error) => {
      console.error("Error uploading Excel file:", error);
      toast({
        title: "Error al cargar archivo",
        description: "No se pudo cargar el archivo Excel. Intente nuevamente.",
        variant: "destructive",
      });
    }
  });
  
  // Mutación para analizar archivo Excel
  const analyzeExcelMutation = useMutation({
    mutationFn: async (filename: string) => {
      const response = await fetch(`/api/excel/analyze/${filename}`);
      
      if (!response.ok) {
        throw new Error('Error al analizar el archivo Excel');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setExcelColumns(data);
      setIsFieldMappingOpen(true);
    },
    onError: (error) => {
      console.error("Error analyzing Excel file:", error);
      toast({
        title: "Error al analizar archivo",
        description: "No se pudo analizar el archivo Excel. Intente nuevamente.",
        variant: "destructive",
      });
    }
  });
  
  // Mutación para importar datos de Excel
  const importExcelMutation = useMutation({
    mutationFn: async (data: { filename: string, fieldMapping: Record<string, string>}) => {
      const response = await fetch('/api/excel/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error('Error al importar datos de Excel');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setImportedData(data);
      toast({
        title: "Datos importados",
        description: `Se importaron ${data.validRows} contactos correctamente.`,
      });
      
      // Si hay una campaña seleccionada, continuar con la importación
      if (selectedCampaignId) {
        importContactsToCampaignMutation.mutate({
          campaignId: selectedCampaignId,
          importId: data.id
        });
      } else {
        setIsFieldMappingOpen(false);
        setIsImportDialogOpen(false);
      }
    },
    onError: (error) => {
      console.error("Error importing Excel data:", error);
      toast({
        title: "Error al importar datos",
        description: "No se pudieron importar los datos de Excel. Intente nuevamente.",
        variant: "destructive",
      });
    }
  });
  
  // Mutación para importar contactos a una campaña
  const importContactsToCampaignMutation = useMutation({
    mutationFn: async ({campaignId, importId}: {campaignId: number, importId: string}) => {
      const response = await fetch(`/api/mass-sender/campaigns/${campaignId}/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ importId })
      });
      
      if (!response.ok) {
        throw new Error('Error al importar contactos a la campaña');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mass-sender/campaigns'] });
      toast({
        title: "Contactos importados",
        description: "Los contactos han sido importados a la campaña correctamente.",
      });
      setIsImportDialogOpen(false);
      setIsFieldMappingOpen(false);
    },
    onError: (error) => {
      console.error("Error importing contacts to campaign:", error);
      toast({
        title: "Error al importar contactos",
        description: "No se pudieron importar los contactos a la campaña. Intente nuevamente.",
        variant: "destructive",
      });
    }
  });
  
  // Mutación para importar contactos usando plantilla de mensaje
  const importWithTemplateMutation = useMutation({
    mutationFn: async ({campaignId, data}: {campaignId: number, data: any}) => {
      const response = await fetch(`/api/mass-sender/campaigns/${campaignId}/import-with-template`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error('Error al importar contactos con plantilla');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mass-sender/campaigns'] });
      toast({
        title: "Plantilla aplicada",
        description: "Los contactos se han importado con la plantilla seleccionada.",
      });
      setIsImportDialogOpen(false);
      setIsFieldMappingOpen(false);
    },
    onError: (error) => {
      console.error("Error importing with template:", error);
      toast({
        title: "Error al aplicar plantilla",
        description: "No se pudo aplicar la plantilla a los contactos importados.",
        variant: "destructive",
      });
    }
  });
  
  // Función para manejar el envío del formulario de nueva campaña
  const handleCreateCampaign = () => {
    if (!campaignName.trim()) {
      toast({
        title: "Nombre requerido",
        description: "Debes proporcionar un nombre para la campaña.",
        variant: "destructive",
      });
      return;
    }
    
    if (!messageTemplate.trim()) {
      toast({
        title: "Mensaje requerido",
        description: "Debes proporcionar un mensaje para la campaña.",
        variant: "destructive",
      });
      return;
    }
    
    if ((selectedGroups || []).length === 0 && (selectedTags || []).length === 0) {
      toast({
        title: "Destinatarios requeridos",
        description: "Debes seleccionar al menos un grupo o etiqueta de destinatarios.",
        variant: "destructive",
      });
      return;
    }
    
    createCampaignMutation.mutate({
      name: campaignName,
      messageTemplate,
      targetGroups: selectedGroups,
      targetTags: selectedTags,
      config: currentConfig
    });
  };
  
  // Función para manejar el inicio, pausa o reanudación de una campaña
  const handleCampaignAction = (campaign: Campaign) => {
    if (campaign.status === 'pending' || campaign.status === 'failed') {
      startCampaignMutation.mutate(campaign.id);
    } else if (campaign.status === 'running') {
      pauseCampaignMutation.mutate(campaign.id);
    } else if (campaign.status === 'paused') {
      resumeCampaignMutation.mutate(campaign.id);
    }
  };
  
  // Función para manejar la carga de un archivo Excel
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      uploadExcelMutation.mutate(file);
    }
  };
  
  // Función para abrir el selector de archivos
  const handleSelectFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Función para importar contactos desde Excel a una campaña
  const handleImportExcel = (campaignId: string) => {
    setSelectedCampaignId(parseInt(campaignId, 10));
    setIsImportDialogOpen(true);
  };
  
  // Función para manejar el cambio en el mapeo de campos
  const handleFieldMappingChange = (field: string, value: string) => {
    setFieldMapping(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Función para procesar la importación de datos
  const handleProcessImport = () => {
    if (!selectedFile) {
      toast({
        title: "Error",
        description: "No hay ningún archivo seleccionado.",
        variant: "destructive",
      });
      return;
    }
    
    // Verificar que los campos obligatorios estén mapeados
    if (!fieldMapping.phoneNumber) {
      toast({
        title: "Campo requerido",
        description: "Debe seleccionar la columna que contiene los números de teléfono.",
        variant: "destructive",
      });
      return;
    }
    
    // Importar los datos de Excel
    importExcelMutation.mutate({
      filename: selectedFile.name,
      fieldMapping
    });
  };
  
  // Actualizar automáticamente el estado de las campañas
  useEffect(() => {
    const interval = setInterval(() => {
      if (tab === "campaigns") {
        refetchCampaigns();
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [tab, refetchCampaigns]);
  
  return (
    <div className="container mx-auto py-6">
      {/* Input oculto para cargar archivo Excel */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept=".xlsx,.xls,.csv" 
        onChange={handleFileUpload} 
      />
      
      <div className="flex flex-col space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Envío Masivo de Mensajes</h1>
            <p className="text-muted-foreground mt-1">
              Envía mensajes a múltiples contactos de forma segura y efectiva
            </p>
          </div>
          <div className="flex space-x-3">
            <Button onClick={handleSelectFile} variant="outline">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Importar Excel
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Nueva Campaña
            </Button>
          </div>
        </div>
        
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid grid-cols-2 w-[400px]">
            <TabsTrigger value="new-campaign">Nueva Campaña</TabsTrigger>
            <TabsTrigger value="campaigns">Campañas Activas</TabsTrigger>
          </TabsList>
          
          {/* Pestaña para crear una nueva campaña */}
          <TabsContent value="new-campaign">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Formulario de creación de campaña */}
              <Card>
                <CardHeader>
                  <CardTitle>Crear Nueva Campaña</CardTitle>
                  <CardDescription>
                    Configure los detalles de su campaña de mensajes
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="campaign-name">Nombre de Campaña</Label>
                    <Input 
                      id="campaign-name" 
                      placeholder="Ej: Promoción Verano 2023" 
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-4">
                    <TemplateSelector 
                      onChange={(template) => {
                        setSelectedTemplate(template);
                        if (template) {
                          setMessageTemplate(template.content);
                        }
                      }}
                    />
                    
                    {!selectedTemplate && (
                      <div className="space-y-2 mt-4">
                        <Label htmlFor="message-template">Mensaje Personalizado</Label>
                        <Textarea 
                          id="message-template" 
                          placeholder={"Hola " + "{{"+"nombre"+"}}" + ", tenemos una oferta especial para ti..."} 
                          className="min-h-32"
                          value={messageTemplate}
                          onChange={(e) => setMessageTemplate(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Usa {"{{"+"nombre"+"}}"} para personalizar el mensaje con el nombre del contacto.
                        </p>
                      </div>
                    )}
                    
                    {selectedTemplate && (
                      <TemplatePreview 
                        template={selectedTemplate}
                        contactData={previewContact}
                      />
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Grupos de Destinatarios</Label>
                    <ScrollArea className="h-32 border rounded-md p-2">
                      {loadingGroups ? (
                        <div className="flex items-center justify-center h-full">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : Array.isArray(contactGroups) && contactGroups && contactGroups.length > 0 ? (
                        <div className="space-y-2">
                          {contactGroups.map((group: ContactGroup) => (
                            <div key={group.id} className="flex items-center space-x-2">
                              <input 
                                type="checkbox"
                                id={`group-${group.id}`}
                                checked={selectedGroups.includes(group.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedGroups([...selectedGroups, group.id]);
                                  } else {
                                    setSelectedGroups(selectedGroups.filter(id => id !== group.id));
                                  }
                                }}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                              <Label htmlFor={`group-${group.id}`} className="font-normal">
                                {group.name} <span className="text-xs text-muted-foreground">({group.count})</span>
                              </Label>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                          No hay grupos disponibles
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Etiquetas de Destinatarios</Label>
                    <ScrollArea className="h-32 border rounded-md p-2">
                      {loadingTags ? (
                        <div className="flex items-center justify-center h-full">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : Array.isArray(contactTags) && contactTags && contactTags.length > 0 ? (
                        <div className="space-y-2">
                          {contactTags.map((tag: any) => (
                            <div key={tag.id} className="flex items-center space-x-2">
                              <input 
                                type="checkbox"
                                id={`tag-${tag.id}`}
                                checked={selectedTags.includes(tag.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedTags([...selectedTags, tag.id]);
                                  } else {
                                    setSelectedTags(selectedTags.filter(id => id !== tag.id));
                                  }
                                }}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                              <Label htmlFor={`tag-${tag.id}`} className="font-normal">
                                {tag.name} <span className="text-xs text-muted-foreground">({tag.count})</span>
                              </Label>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                          No hay etiquetas disponibles
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                  
                  {/* Configuración avanzada */}
                  <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
                    <div className="flex items-center justify-between">
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Settings className="h-4 w-4 mr-2" />
                          Configuración Avanzada
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="mt-4 space-y-4">
                      <div className="grid gap-4 grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="delay-between-messages">Tiempo entre mensajes (segundos)</Label>
                          <Input 
                            id="delay-between-messages" 
                            type="number" 
                            min="1" 
                            defaultValue="8"
                            onChange={(e) => setCurrentConfig({
                              ...currentConfig,
                              delayBetweenMessages: parseInt(e.target.value) * 1000
                            })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="chunk-size">Tamaño de lote</Label>
                          <Input 
                            id="chunk-size" 
                            type="number" 
                            min="1" 
                            defaultValue="15"
                            onChange={(e) => setCurrentConfig({
                              ...currentConfig,
                              chunkSize: parseInt(e.target.value)
                            })}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="pause-between-chunks">Pausa entre lotes (minutos)</Label>
                        <Input 
                          id="pause-between-chunks" 
                          type="number" 
                          min="1" 
                          defaultValue="3"
                          onChange={(e) => setCurrentConfig({
                            ...currentConfig,
                            pauseBetweenChunks: parseInt(e.target.value) * 60000
                          })}
                        />
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id="simulate-typing" 
                          defaultChecked={true}
                          onCheckedChange={(checked) => setCurrentConfig({
                            ...currentConfig,
                            simulateTyping: checked
                          })}
                        />
                        <Label htmlFor="simulate-typing">Simular escritura</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id="personalize-messages" 
                          defaultChecked={true}
                          onCheckedChange={(checked) => setCurrentConfig({
                            ...currentConfig,
                            personalizeMessages: checked
                          })}
                        />
                        <Label htmlFor="personalize-messages">Personalizar mensajes</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id="message-variations" 
                          defaultChecked={true}
                          onCheckedChange={(checked) => setCurrentConfig({
                            ...currentConfig,
                            messageVariations: checked
                          })}
                        />
                        <Label htmlFor="message-variations">Usar variaciones de mensaje</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id="restrict-recipients" 
                          defaultChecked={true}
                          onCheckedChange={(checked) => setCurrentConfig({
                            ...currentConfig,
                            restrictRepeatedRecipients: checked
                          })}
                        />
                        <Label htmlFor="restrict-recipients">Limitar frecuencia de envío</Label>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Switch 
                          id="respect-hours" 
                          defaultChecked={true}
                          onCheckedChange={(checked) => setCurrentConfig({
                            ...currentConfig,
                            respectBusinessHours: checked
                          })}
                        />
                        <Label htmlFor="respect-hours">Respetar horario laboral</Label>
                      </div>
                      
                      <div className="grid gap-4 grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="business-hours-start">Hora de inicio</Label>
                          <Select 
                            defaultValue="9"
                            onValueChange={(value) => setCurrentConfig({
                              ...currentConfig,
                              businessHoursStart: parseInt(value)
                            })}
                          >
                            <SelectTrigger id="business-hours-start">
                              <SelectValue placeholder="Seleccionar hora" />
                            </SelectTrigger>
                            <SelectContent>
                              {[...Array(24)].map((_, i) => (
                                <SelectItem key={i} value={i.toString()}>
                                  {i}:00
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="business-hours-end">Hora de fin</Label>
                          <Select 
                            defaultValue="18"
                            onValueChange={(value) => setCurrentConfig({
                              ...currentConfig,
                              businessHoursEnd: parseInt(value)
                            })}
                          >
                            <SelectTrigger id="business-hours-end">
                              <SelectValue placeholder="Seleccionar hora" />
                            </SelectTrigger>
                            <SelectContent>
                              {[...Array(24)].map((_, i) => (
                                <SelectItem key={i} value={i.toString()}>
                                  {i}:00
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Días laborales</Label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { value: 1, label: "Lun" },
                            { value: 2, label: "Mar" },
                            { value: 3, label: "Mié" },
                            { value: 4, label: "Jue" },
                            { value: 5, label: "Vie" },
                            { value: 6, label: "Sáb" },
                            { value: 0, label: "Dom" }
                          ].map((day) => (
                            <Badge 
                              key={day.value} 
                              variant={currentConfig.businessDays?.includes(day.value) ? "default" : "outline"}
                              className="cursor-pointer"
                              onClick={() => {
                                const days = currentConfig.businessDays || [1, 2, 3, 4, 5];
                                if (days.includes(day.value)) {
                                  setCurrentConfig({
                                    ...currentConfig,
                                    businessDays: days.filter(d => d !== day.value)
                                  });
                                } else {
                                  setCurrentConfig({
                                    ...currentConfig,
                                    businessDays: [...days, day.value].sort()
                                  });
                                }
                              }}
                            >
                              {day.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" onClick={() => setTab("campaigns")}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleCreateCampaign}
                    disabled={createCampaignMutation.isPending}
                  >
                    {createCampaignMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      <>
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Crear Campaña
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
              
              {/* Vista previa y verificación */}
              <Card>
                <CardHeader>
                  <CardTitle>Vista Previa</CardTitle>
                  <CardDescription>
                    Previsualiza cómo verán tu mensaje los contactos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-muted/50 p-4 rounded-lg border">
                    <div className="flex items-center space-x-2 mb-3">
                      <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center">
                        <User className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium">Ejemplo de contacto</h4>
                        <p className="text-xs text-muted-foreground">+1234567890</p>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm text-sm">
                      {messageTemplate ? (
                        messageTemplate.replace(new RegExp(`{{nombre}}`, 'g'), "Juan")
                      ) : (
                        <span className="text-muted-foreground italic">
                          La vista previa del mensaje aparecerá aquí...
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center">
                      <Info className="h-4 w-4 mr-1" />
                      Verificación de seguridad
                    </h4>
                    <ul className="space-y-1 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCheck className="h-4 w-4 text-green-500" />
                        <span>Usa intervalos variables entre mensajes</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCheck className="h-4 w-4 text-green-500" />
                        <span>Incluye personalización de mensajes</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCheck className="h-4 w-4 text-green-500" />
                        <span>Respeta límites de mensajes por día</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCheck className="h-4 w-4 text-green-500" />
                        <span>Implementa pausas entre lotes</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCheck className="h-4 w-4 text-green-500" />
                        <span>Simula patrones de escritura humana</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-amber-100 p-3 rounded-lg text-amber-800 dark:bg-amber-900 dark:text-amber-100 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">Recomendaciones de seguridad</span>
                    </div>
                    <p className="text-xs">
                      Para evitar que tu cuenta sea bloqueada por WhatsApp, se recomienda:
                    </p>
                    <ul className="text-xs list-disc pl-4 mt-1 space-y-1">
                      <li>No enviar el mismo mensaje a muchos contactos</li>
                      <li>Limitar envíos a 50-100 contactos por día</li>
                      <li>Personalizar cada mensaje</li>
                      <li>Evitar URLs sospechosas o acortadas</li>
                      <li>Usar una cuenta con historial (más de 6 meses)</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* Pestaña para gestionar campañas existentes */}
          <TabsContent value="campaigns">
            <Card>
              <CardHeader>
                <CardTitle>Campañas de Envío Masivo</CardTitle>
                <CardDescription>
                  Gestiona y monitoriza tus campañas de envío de mensajes
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingCampaigns ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : Array.isArray(campaigns) && campaigns && campaigns.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Progreso</TableHead>
                        <TableHead>Creada</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns.map((campaign: Campaign) => (
                        <TableRow key={campaign.id}>
                          <TableCell className="font-medium">{campaign.name}</TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                campaign.status === 'running' ? "default" :
                                campaign.status === 'completed' ? "secondary" :
                                campaign.status === 'paused' ? "outline" :
                                campaign.status === 'failed' ? "destructive" : "secondary"
                              }
                            >
                              {campaign.status === 'running' ? "En ejecución" :
                               campaign.status === 'pending' ? "Pendiente" :
                               campaign.status === 'paused' ? "Pausada" :
                               campaign.status === 'completed' ? "Completada" : "Error"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="w-full flex items-center gap-2">
                              <Progress 
                                value={
                                  campaign.totalContacts > 0 
                                    ? (campaign.processedContacts / campaign.totalContacts) * 100 
                                    : 0
                                }
                                className="h-2"
                              />
                              <span className="text-xs whitespace-nowrap">
                                {campaign.processedContacts}/{campaign.totalContacts}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {new Date(campaign.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button 
                                size="sm" 
                                variant={
                                  campaign.status === 'running' ? "outline" : 
                                  campaign.status === 'completed' ? "secondary" : "default"
                                }
                                disabled={campaign.status === 'completed'}
                                onClick={() => handleCampaignAction(campaign)}
                              >
                                {campaign.status === 'running' ? (
                                  <>
                                    <Pause className="h-4 w-4 mr-1" />
                                    Pausar
                                  </>
                                ) : campaign.status === 'paused' ? (
                                  <>
                                    <Play className="h-4 w-4 mr-1" />
                                    Reanudar
                                  </>
                                ) : campaign.status === 'completed' ? (
                                  "Completada"
                                ) : (
                                  <>
                                    <Play className="h-4 w-4 mr-1" />
                                    Iniciar
                                  </>
                                )}
                              </Button>
                              
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleImportExcel(campaign.id)}
                                disabled={campaign.status === 'running' || campaign.status === 'completed'}
                              >
                                <FileSpreadsheet className="h-4 w-4 mr-1" />
                                Importar
                              </Button>
                              
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="outline">
                                    <Info className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-3xl">
                                  <DialogHeader>
                                    <DialogTitle>Detalles de Campaña</DialogTitle>
                                  </DialogHeader>
                                  <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                      <h3 className="text-sm font-medium mb-2">Información general</h3>
                                      <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Nombre:</span>
                                          <span>{campaign.name}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Estado:</span>
                                          <Badge 
                                            variant={
                                              campaign.status === 'running' ? "default" :
                                              campaign.status === 'completed' ? "secondary" :
                                              campaign.status === 'paused' ? "outline" :
                                              campaign.status === 'failed' ? "destructive" : "secondary"
                                            }
                                          >
                                            {campaign.status}
                                          </Badge>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Creada:</span>
                                          <span>{new Date(campaign.createdAt).toLocaleString()}</span>
                                        </div>
                                        {campaign.startedAt && (
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">Iniciada:</span>
                                            <span>{new Date(campaign.startedAt).toLocaleString()}</span>
                                          </div>
                                        )}
                                        {campaign.completedAt && (
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">Completada:</span>
                                            <span>{new Date(campaign.completedAt).toLocaleString()}</span>
                                          </div>
                                        )}
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Total contactos:</span>
                                          <span>{campaign.totalContacts}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Procesados:</span>
                                          <span>{campaign.processedContacts}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Exitosos:</span>
                                          <span className="text-green-600">{campaign.successfulSends}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Fallidos:</span>
                                          <span className="text-red-600">{campaign.failedSends}</span>
                                        </div>
                                      </div>
                                      
                                      <h3 className="text-sm font-medium mt-4 mb-2">Plantilla de mensaje</h3>
                                      <div className="bg-muted p-3 rounded-md text-sm">
                                        {campaign.messageTemplate}
                                      </div>
                                    </div>
                                    
                                    <div>
                                      <h3 className="text-sm font-medium mb-2">Configuración de envío</h3>
                                      <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Intervalo entre mensajes:</span>
                                          <span>{campaign.sendingConfig && campaign.sendingConfig.minIntervalMs ? campaign.sendingConfig.minIntervalMs / 1000 : 5}s</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Tamaño de lote:</span>
                                          <span>{campaign.sendingConfig && campaign.sendingConfig.batchSize ? campaign.sendingConfig.batchSize : 10} mensajes</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Pausa entre lotes:</span>
                                          <span>{campaign.sendingConfig && campaign.sendingConfig.pauseBetweenBatchesMs ? campaign.sendingConfig.pauseBetweenBatchesMs / 60000 : 1}min</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Simular escritura:</span>
                                          <span>{campaign.sendingConfig && campaign.sendingConfig.simulateTyping ? "Sí" : "No"}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Personalización:</span>
                                          <span>{campaign.config && campaign.config.personalizeMessages ? "Sí" : "No"}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Variaciones de mensaje:</span>
                                          <span>{campaign.config && campaign.config.messageVariations ? "Sí" : "No"}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Respeta horario:</span>
                                          <span>{campaign.sendingConfig && campaign.sendingConfig.respectBusinessHours ? "Sí" : "No"}</span>
                                        </div>
                                        {campaign.sendingConfig && campaign.sendingConfig.respectBusinessHours && (
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">Horario:</span>
                                            <span>{campaign.sendingConfig.businessHoursStart}:00 - {campaign.sendingConfig.businessHoursEnd}:00</span>
                                          </div>
                                        )}
                                      </div>
                                      
                                      <h3 className="text-sm font-medium mt-4 mb-2">Destinatarios</h3>
                                      {campaign.targetGroups && campaign.targetGroups.length > 0 && (
                                        <div className="mb-2">
                                          <p className="text-xs text-muted-foreground mb-1">Grupos:</p>
                                          <div className="flex flex-wrap gap-1">
                                            {campaign.targetGroups.map(group => (
                                              <Badge key={group} variant="outline">{group}</Badge>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      
                                      {campaign.targetTags && campaign.targetTags.length > 0 && (
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-1">Etiquetas:</p>
                                          <div className="flex flex-wrap gap-1">
                                            {campaign.targetTags.map(tag => (
                                              <Badge key={tag} variant="outline">{tag}</Badge>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 space-y-4">
                    <div className="bg-muted rounded-full p-3">
                      <Send className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-lg font-medium">No hay campañas</h3>
                      <p className="text-sm text-muted-foreground">
                        Crea tu primera campaña de envío masivo de mensajes
                      </p>
                    </div>
                    <Button onClick={() => setTab("new-campaign")}>
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Nueva Campaña
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Diálogo para importar Excel */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Importar Contactos desde Excel</DialogTitle>
            <DialogDescription>
              Seleccione un archivo Excel para importar contactos a la campaña.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col gap-4 py-4">
            {selectedFile ? (
              <div className="flex items-center p-3 border rounded-md">
                <FileSpreadsheet className="h-8 w-8 mr-2 text-green-500" />
                <div className="flex-1">
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => {
                    setSelectedFile(null);
                    setExcelColumns([]);
                  }}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div 
                className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={handleSelectFile}
              >
                <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Haga clic para seleccionar un archivo</p>
                <p className="text-xs text-muted-foreground mt-1">
                  O arrastre y suelte un archivo Excel aquí
                </p>
              </div>
            )}
            
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsImportDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                disabled={!selectedFile}
                onClick={handleSelectFile}
              >
                {selectedFile ? "Seleccionar otro archivo" : "Seleccionar archivo"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo para mapeo de campos */}
      <Dialog open={isFieldMappingOpen} onOpenChange={setIsFieldMappingOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Mapeo de Campos</DialogTitle>
            <DialogDescription>
              Seleccione qué columnas del archivo Excel corresponden a cada campo requerido.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-4">
              <FormItem>
                <FormLabel>Número de Teléfono (requerido)</FormLabel>
                <Select 
                  value={fieldMapping.phoneNumber} 
                  onValueChange={(value) => handleFieldMappingChange('phoneNumber', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione la columna" />
                  </SelectTrigger>
                  <SelectContent>
                    {excelColumns.map((column) => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Debe incluir código de país, ej: +521234567890
                </FormDescription>
              </FormItem>
              
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <Select 
                  value={fieldMapping.name} 
                  onValueChange={(value) => handleFieldMappingChange('name', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione la columna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No mapear</SelectItem>
                    {excelColumns.map((column) => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
              
              <FormItem>
                <FormLabel>Empresa</FormLabel>
                <Select 
                  value={fieldMapping.company} 
                  onValueChange={(value) => handleFieldMappingChange('company', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione la columna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No mapear</SelectItem>
                    {excelColumns.map((column) => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            </div>
            
            <div className="space-y-4">
              <FormItem>
                <FormLabel>Correo Electrónico</FormLabel>
                <Select 
                  value={fieldMapping.email} 
                  onValueChange={(value) => handleFieldMappingChange('email', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione la columna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No mapear</SelectItem>
                    {excelColumns.map((column) => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
              
              <FormItem>
                <FormLabel>Etiquetas</FormLabel>
                <Select 
                  value={fieldMapping.tags} 
                  onValueChange={(value) => handleFieldMappingChange('tags', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione la columna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No mapear</SelectItem>
                    {excelColumns.map((column) => (
                      <SelectItem key={column} value={column}>
                        {column}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  Etiquetas separadas por comas (ej: cliente,importante,pendiente)
                </FormDescription>
              </FormItem>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFieldMappingOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleProcessImport}
              disabled={!fieldMapping.phoneNumber}
            >
              Importar Contactos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
    </div>
  );
}
