import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardFooter 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { useToast } from '@/hooks/use-toast';
import {
  QrCode,
  Plus,
  RefreshCw,
  Trash,
  Settings,
  Power,
  PowerOff,
  Phone,
  ChevronRight,
  UserPlus,
  CheckCircle,
  XCircle,
  Smartphone,
  Heart,
  Square,
  Activity,
  Trash2,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { AgentConfigSection } from '@/components/AgentConfigSection';
import { AutoResponseConfig } from '@/components/AutoResponseConfig';

// Importar componente de conexión por teléfono
import { WhatsAppPhoneConnect } from '@/components/messaging/WhatsAppPhoneConnect';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { apiRequest } from '../lib/queryClient';

// Componente para mostrar el código QR
function QRCodeDisplay({ qrData }: { qrData: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!canvasRef.current || !qrData) return;
    
    const generateQR = async () => {
      try {
        // Para WhatsApp, debemos usar el texto tal como viene, sin modificar
        // La biblioteca de WhatsApp Web espera este formato específico
        await QRCode.toCanvas(canvasRef.current, qrData, {
          width: 256,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });
      } catch (error) {
        console.error('Error al generar el código QR:', error);
      }
    };
    
    generateQR();
  }, [qrData]);
  
  return (
    <canvas 
      ref={canvasRef} 
      className="w-64 h-64 border rounded"
      aria-label="Código QR para conectar WhatsApp"
    />
  );
}

// Esquema para creación de cuentas
const accountSchema = z.object({
  name: z.string().min(3, { message: 'El nombre debe tener al menos 3 caracteres' }),
  description: z.string().optional(),
  ownerName: z.string().optional(),
  ownerPhone: z.string().optional(),
});

// Interface para el estado de ping/keep-alive
interface PingStatus {
  isActive: boolean;
  lastPing: number;
  pingCount: number;
  nextPing: number;
  timeSinceLastPing?: number;
  timeToNextPing?: number;
}

// Tipo para cuenta de WhatsApp con estado
type WhatsAppAccount = {
  id: number;
  name: string;
  description?: string | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  status: string;
  adminId?: number | null;
  createdAt: string;
  lastActiveAt?: string | null;
  sessionData?: any;
  pingStatus?: PingStatus;
  currentStatus?: {
    initialized: boolean;
    ready: boolean;
    authenticated: boolean;
    error?: string;
    qrCode?: string;
    qrDataUrl?: string;
  };
};

const WhatsAppAccounts = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAccount, setSelectedAccount] = useState<WhatsAppAccount | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newlyCreatedAccountId, setNewlyCreatedAccountId] = useState<number | null>(null);
  const [authMethod, setAuthMethod] = useState<'qrcode' | 'phone'>('qrcode');
  const [agentConfigDialogOpen, setAgentConfigDialogOpen] = useState(false);
  const [selectedAccountForAgent, setSelectedAccountForAgent] = useState<WhatsAppAccount | null>(null);
  const [qrAutoRefreshStatus, setQrAutoRefreshStatus] = useState<{[key: number]: boolean}>({});
  const [isCleanupLoading, setIsCleanupLoading] = useState(false);
  const [cleanupResults, setCleanupResults] = useState<{
    show: boolean;
    type: 'quick' | 'complete';
    success: boolean;
    message: string;
    cleanedItems?: string[];
    totalCleaned?: number;
    errors?: string[];
  }>({ show: false, type: 'quick', success: false, message: '' });
  
  // Effect to automatically close QR dialog when connection becomes authenticated
  useEffect(() => {
    if (selectedAccount?.currentStatus?.authenticated && qrDialogOpen) {
      console.log('🔗 Cuenta conectada exitosamente, cerrando diálogo QR automáticamente');
      setQrDialogOpen(false);
      toast({
        title: "Conexión exitosa",
        description: `La cuenta ${selectedAccount.name} se ha conectado correctamente`,
      });
    }
  }, [selectedAccount?.currentStatus?.authenticated, qrDialogOpen, selectedAccount?.name, toast]);
  
  // Consulta para obtener agentes externos
  const { data: externalAgents = [] } = useQuery({
    queryKey: ['/api/external-agents'],
    queryFn: async () => {
      console.log('🔍 Obteniendo lista de agentes externos...');
      const response = await apiRequest('/api/external-agents');
      console.log('✅ Agentes externos encontrados:', response.agents?.length || 0);
      return response.agents || [];
    }
  });

  // Consulta para obtener configuración del agente para cada cuenta
  const getAgentConfig = (accountId: number) => useQuery({
    queryKey: [`/api/whatsapp-accounts/${accountId}/agent-config`],
    queryFn: async () => {
      console.log('🔍 Configuración recibida del servidor:', await apiRequest(`/api/whatsapp-accounts/${accountId}/agent-config`));
      return await apiRequest(`/api/whatsapp-accounts/${accountId}/agent-config`);
    },
    enabled: !!accountId
  });
  
  // Consulta para obtener cuentas
  const { data: accountsResponse, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/whatsapp-accounts'],
    queryFn: async () => {
      return await apiRequest('/api/whatsapp-accounts');
    }
  });

  const accounts = accountsResponse?.accounts || [];

  // Consulta para obtener estado de ping de todas las cuentas
  const { data: pingStatusData } = useQuery({
    queryKey: ['/api/whatsapp/ping-status/all'],
    queryFn: async () => {
      try {
        return await apiRequest('/api/whatsapp/ping-status/all');
      } catch (error) {
        console.error('Error obteniendo estado de ping:', error);
        return { success: false, accounts: [] };
      }
    },
    refetchInterval: 5000, // Actualizar cada 5 segundos
  });
  
  // Consulta para obtener código QR
  const { data: qrData, isLoading: isQrLoading, refetch: refetchQr } = useQuery({
    queryKey: ['/api/whatsapp-accounts', selectedAccount?.id, 'qrcode'],
    queryFn: async () => {
      if (!selectedAccount) return null;
      try {
        const data = await apiRequest(`/api/whatsapp-accounts/${selectedAccount.id}/qrcode`);
        return data.success ? data : null;
      } catch (error) {
        console.error('Error fetching QR code:', error);
        return null;
      }
    },
    enabled: !!selectedAccount && qrDialogOpen && 
             ['inactive', 'pending_auth'].includes(selectedAccount.status || ''),
    refetchInterval: qrDialogOpen ? 5000 : false // Refrescar cada 5 segundos si el diálogo está abierto
  });
  
  // Mutation para crear cuenta
  const createAccountMutation = useMutation({
    mutationFn: async (data: z.infer<typeof accountSchema>) => {
      return await apiRequest('/api/whatsapp-accounts', {
        method: 'POST',
        body: data
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'Cuenta creada',
        description: 'La cuenta de WhatsApp se ha creado correctamente.',
        variant: 'default',
      });
      
      // Guardar el ID de la cuenta recién creada para mostrar automáticamente el QR
      if (data && data.id) {
        setNewlyCreatedAccountId(data.id);
        
        // Usar directamente los datos devueltos por la API en lugar de buscar en accounts
        setSelectedAccount(data);
        setQrDialogOpen(true);
        
        // También refrescar las cuentas para actualizar la lista
        queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-accounts'] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-accounts'] });
      }
      
      setAddDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: 'No se pudo crear la cuenta de WhatsApp.',
        variant: 'destructive',
      });
    }
  });
  
  // Mutation para inicializar cuenta
  const initializeAccountMutation = useMutation({
    mutationFn: async (accountId: number) => {
      return await apiRequest(`/api/whatsapp-accounts/${accountId}/initialize`, {
        method: 'POST'
      });
    },
    onSuccess: (data, accountId) => {
      toast({
        title: 'Cuenta inicializada',
        description: 'La cuenta se ha inicializado correctamente.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-accounts', accountId, 'qrcode'] });
    },
    onError: (error, accountId) => {
      toast({
        title: 'Error',
        description: 'No se pudo inicializar la cuenta.',
        variant: 'destructive',
      });
    }
  });
  
  // Mutation para desconectar cuenta
  const disconnectAccountMutation = useMutation({
    mutationFn: async (accountId: number) => {
      return await apiRequest(`/api/whatsapp-accounts/${accountId}/disconnect`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      toast({
        title: 'Cuenta desconectada',
        description: 'La cuenta se ha desconectado correctamente.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-accounts'] });
      setQrDialogOpen(false);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo desconectar la cuenta.',
        variant: 'destructive',
      });
    }
  });
  
  // Mutation para eliminar cuenta
  const deleteAccountMutation = useMutation({
    mutationFn: async (accountId: number) => {
      return await apiRequest(`/api/whatsapp-accounts/${accountId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      toast({
        title: 'Cuenta eliminada',
        description: 'La cuenta se ha eliminado correctamente.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-accounts'] });
      setSelectedAccount(null);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la cuenta.',
        variant: 'destructive',
      });
    }
  });

  // Mutation para eliminar todas las cuentas
  const deleteAllAccountsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/whatsapp-accounts/delete-all', {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      toast({
        title: 'Todas las cuentas eliminadas',
        description: 'Se han eliminado todas las cuentas y reiniciado el contador de IDs.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-accounts'] });
      setSelectedAccount(null);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudieron eliminar todas las cuentas.',
        variant: 'destructive',
      });
    }
  });

  // Mutation para asignar agente externo
  const assignExternalAgentMutation = useMutation({
    mutationFn: async ({ accountId, externalAgentId, autoResponseEnabled }: { 
      accountId: number; 
      externalAgentId: string | null; 
      autoResponseEnabled: boolean; 
    }) => {
      return await apiRequest(`/api/whatsapp-accounts/${accountId}/assign-external-agent`, {
        method: 'POST',
        body: { externalAgentId, autoResponseEnabled }
      });
    },
    onSuccess: () => {
      toast({
        title: 'Agente asignado',
        description: 'El agente externo se ha asignado correctamente.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-accounts'] });
      queryClient.invalidateQueries({ queryKey: [`/api/whatsapp-accounts/${selectedAccountForAgent?.id}/agent-config`] });
      setAgentConfigDialogOpen(false);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo asignar el agente externo.',
        variant: 'destructive',
      });
    }
  });
  
  // Formulario para crear cuenta
  const form = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: '',
      description: '',
      ownerName: '',
      ownerPhone: '',
    },
  });
  
  // Manejador de envío del formulario
  const onSubmit = (data: z.infer<typeof accountSchema>) => {
    createAccountMutation.mutate(data);
  };
  
  // Abrir diálogo para mostrar código QR
  const handleShowQR = (account: WhatsAppAccount) => {
    setSelectedAccount(account);
    setQrDialogOpen(true);
    
    // Si la cuenta no está inicializada, iniciarla
    if (account.status === 'inactive') {
      initializeAccountMutation.mutate(account.id);
    }
  };
  
  // Reconectar cuenta
  const handleReconnect = () => {
    if (selectedAccount) {
      initializeAccountMutation.mutate(selectedAccount.id);
    }
  };
  
  // Actualizar QR code - usar endpoint de force refresh
  const handleRefreshQR = async () => {
    if (!selectedAccount) return;
    
    try {
      toast({
        title: "Generando nuevo QR",
        description: "Solicitando un código QR completamente nuevo...",
      });
      
      // Llamar al endpoint de force refresh que creé
      const response = await apiRequest(`/api/whatsapp/qr/${selectedAccount.id}/refresh`, {
        method: 'POST'
      });
      
      if (response.success) {
        // Esperar 2 segundos para que el nuevo QR se genere completamente
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Refrescar el QR después del force refresh
        refetchQr();
        toast({
          title: "QR actualizado",
          description: "Se ha generado un nuevo código QR",
        });
      } else {
        throw new Error(response.message || 'Error al actualizar QR');
      }
    } catch (error) {
      console.error('Error al forzar refresh del QR:', error);
      toast({
        title: "Error",
        description: "No se pudo generar un nuevo código QR",
        variant: "destructive",
      });
    }
  };
  
  // Desconectar cuenta
  const handleDisconnect = () => {
    if (selectedAccount) {
      disconnectAccountMutation.mutate(selectedAccount.id);
    }
  };
  
  // Eliminar cuenta
  const handleDelete = (account: WhatsAppAccount) => {
    // Confirmar eliminación
    if (window.confirm(`¿Está seguro de que desea eliminar la cuenta ${account.name}?`)) {
      deleteAccountMutation.mutate(account.id);
    }
  };

  // Eliminar todas las cuentas
  const handleDeleteAll = () => {
    // Confirmar eliminación con doble verificación
    if (window.confirm('⚠️ ATENCIÓN: Esta acción eliminará TODAS las cuentas de WhatsApp y reiniciará el contador de IDs desde 1.\n\n¿Está completamente seguro de que desea continuar?')) {
      if (window.confirm('Esta acción es IRREVERSIBLE. Se perderán todos los datos de las cuentas.\n\n¿Confirma que desea eliminar TODAS las cuentas?')) {
        deleteAllAccountsMutation.mutate();
      }
    }
  };

  // Activar keep-alive para una cuenta específica
  const startKeepAlive = async (accountId: number) => {
    try {
      const response = await apiRequest(`/api/whatsapp/${accountId}/start-keepalive`, {
        method: 'POST'
      });
      
      if (response.success) {
        toast({
          title: "Keep-alive activado",
          description: `Ping automático iniciado para cuenta ${accountId}`,
        });
        // Actualizar datos
        queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/ping-status/all'] });
      } else {
        toast({
          title: "Error",
          description: response.error || "No se pudo activar el keep-alive",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error activando keep-alive:', error);
      toast({
        title: "Error",
        description: "Error al activar keep-alive",
        variant: "destructive",
      });
    }
  };

  // Desactivar keep-alive para una cuenta específica
  const stopKeepAlive = async (accountId: number) => {
    try {
      const response = await apiRequest(`/api/whatsapp/${accountId}/stop-keepalive`, {
        method: 'POST'
      });
      
      if (response.success) {
        toast({
          title: "Keep-alive desactivado",
          description: `Ping automático detenido para cuenta ${accountId}`,
        });
        // Actualizar datos
        queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/ping-status/all'] });
      } else {
        toast({
          title: "Error",
          description: response.error || "No se pudo desactivar el keep-alive",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error desactivando keep-alive:', error);
      toast({
        title: "Error",
        description: "Error al desactivar keep-alive",
        variant: "destructive",
      });
    }
  };

  // Función para forzar el estado ready y activar respuestas automáticas
  const forceReadyState = async (accountId: number) => {
    try {
      const response = await apiRequest(`/api/whatsapp/${accountId}/force-ready`, {
        method: 'POST'
      });
      
      if (response.success) {
        toast({
          title: "¡Sistema activado!",
          description: `WhatsApp cuenta ${accountId} ahora está completamente activa para respuestas automáticas`,
        });
        
        // Actualizar todos los datos
        refetch();
        queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/ping-status/all'] });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al activar el sistema",
        variant: "destructive",
      });
    }
  };

  // Formatear tiempo transcurrido
  const formatTimeAgo = (timestamp: number) => {
    if (!timestamp) return 'Nunca';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h`;
  };

  // System Cleanup Handlers
  const handleQuickCleanup = async () => {
    setIsCleanupLoading(true);
    try {
      const response = await apiRequest('/api/system/quick-cleanup', {
        method: 'POST'
      });
      
      setCleanupResults({
        show: true,
        type: 'quick',
        success: response.success,
        message: response.message,
        totalCleaned: 1
      });
      
      if (response.success) {
        toast({
          title: "Limpieza rápida completada",
          description: response.message,
        });
        refetch(); // Refresh accounts after cleanup
      }
    } catch (error) {
      setCleanupResults({
        show: true,
        type: 'quick',
        success: false,
        message: `Error en limpieza rápida: ${error.message}`
      });
      toast({
        title: "Error en limpieza rápida",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsCleanupLoading(false);
    }
  };

  const handleCompleteCleanup = async () => {
    setIsCleanupLoading(true);
    try {
      const response = await apiRequest('/api/system/complete-cleanup', {
        method: 'POST'
      });
      
      setCleanupResults({
        show: true,
        type: 'complete',
        success: response.success,
        message: response.message,
        cleanedItems: response.cleanedItems || [],
        totalCleaned: response.totalCleaned || 0,
        errors: response.errors || []
      });
      
      if (response.success) {
        toast({
          title: "Limpieza completa realizada",
          description: `${response.totalCleaned} elementos limpiados exitosamente`,
        });
        refetch(); // Refresh accounts after cleanup
      } else {
        toast({
          title: "Limpieza con advertencias",
          description: `${response.totalCleaned} elementos limpiados, ${response.errors?.length || 0} errores`,
          variant: "destructive"
        });
      }
    } catch (error) {
      setCleanupResults({
        show: true,
        type: 'complete',
        success: false,
        message: `Error en limpieza completa: ${error.message}`
      });
      toast({
        title: "Error en limpieza completa",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsCleanupLoading(false);
    }
  };
  
  // Renderizar badge de estado
  const renderStatusBadge = (status: string, isAuthenticated?: boolean) => {
    if (isAuthenticated) {
      return <Badge className="bg-green-500">Conectada</Badge>;
    }
    
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Activa</Badge>;
      case 'pending_auth':
        return <Badge className="bg-yellow-500">Esperando autenticación</Badge>;
      case 'inactive':
        return <Badge className="bg-gray-500">Inactiva</Badge>;
      default:
        return <Badge className="bg-gray-500">{status}</Badge>;
    }
  };
  
  // Combinar datos de cuentas con información de ping y estado de conexión
  const accountsWithPing = accounts.map(account => {
    let enhancedAccount = { ...account };
    
    // Agregar información de estado de conexión desde sessionData si existe
    if (account.sessionData) {
      enhancedAccount.currentStatus = {
        initialized: true,
        authenticated: account.sessionData.authenticated || false,
        ready: account.sessionData.ready || false,
        error: account.sessionData.error || null
      };
    } else if (account.currentStatus) {
      // Si la información viene directamente desde el servidor
      enhancedAccount.currentStatus = {
        initialized: true,
        ...account.currentStatus
      };
    } else {
      // Estado por defecto
      enhancedAccount.currentStatus = {
        initialized: false,
        authenticated: false,
        ready: false,
        error: null
      };
    }
    
    // Agregar información de ping si está disponible
    if (pingStatusData?.success && pingStatusData.accounts) {
      const pingInfo = pingStatusData.accounts.find((acc: any) => acc.accountId === account.id);
      enhancedAccount.pingStatus = pingInfo?.pingStatus || {
        isActive: false,
        lastPing: 0,
        pingCount: 0,
        nextPing: 0
      };
      
      // Si hay pings activos, considerar la cuenta como autenticada
      if (pingInfo?.pingStatus?.isActive && pingInfo?.pingStatus?.pingCount > 0) {
        enhancedAccount.currentStatus = {
          ...enhancedAccount.currentStatus,
          authenticated: true,
          ready: true,
          initialized: true
        };
      }
    }
    
    return enhancedAccount;
  });

  // Auto-refrescar la lista de cuentas cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [refetch]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-800"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-red-500 mb-4">Error al cargar las cuentas de WhatsApp</div>
        <Button onClick={() => refetch()}>Reintentar</Button>
      </div>
    );
  }

  // Componente simple para mostrar solo el agente asignado
  const SimpleAgentDisplay = ({ accountId }: { accountId: number }) => {
    const { data: agentConfig } = getAgentConfig(accountId);
    
    // Cargar agentes reales desde la base de datos
    const { data: externalAgentsData } = useQuery({
      queryKey: ['/api/external-agents']
    });

    const externalAgents = (externalAgentsData as any)?.agents || [];
    
    if (!agentConfig?.success) {
      return <div className="text-xs text-gray-500">Cargando configuración...</div>;
    }

    const config = agentConfig.config;
    const assignedAgent = Array.isArray(externalAgents) ? externalAgents.find((agent: any) => agent.id === config.assignedExternalAgentId) : null;
    
    if (!assignedAgent) {
      return (
        <div className="text-xs text-gray-600">
          <span className="text-gray-500">Sin agente asignado</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-sm">
        <div className={`w-3 h-3 rounded-full ${config.autoResponseEnabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
        <span className="text-gray-700 font-medium">{assignedAgent.name}</span>
        <span className={`px-2 py-1 rounded text-xs ${config.autoResponseEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
          {config.autoResponseEnabled ? 'Activo' : 'Inactivo'}
        </span>
      </div>
    );
  };

  return (
    <div className="container mx-auto py-6 mt-[-10px] mb-[-10px] pt-[47px] pb-[47px] ml-[3px] mr-[3px] pl-[-6px] pr-[-6px]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Cuentas de WhatsApp</h1>
          <p className="text-muted-foreground">
            Gestione sus cuentas de WhatsApp conectadas al sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetch()} size="sm" variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" /> Actualizar
          </Button>
          
          {/* System Cleanup Controls */}
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-50">
                <Zap className="mr-2 h-4 w-4" /> Limpieza Rápida
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-orange-500" />
                  Limpieza Rápida del Sistema
                </DialogTitle>
                <DialogDescription>
                  Elimina sesiones activas y resetea conexiones WhatsApp para resolver problemas de conectividad.
                  Esta operación es segura y no afecta los datos permanentes.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2 pt-4">
                <DialogClose asChild>
                  <Button variant="outline">Cancelar</Button>
                </DialogClose>
                <Button 
                  onClick={handleQuickCleanup}
                  disabled={isCleanupLoading}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {isCleanupLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Limpiando...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Ejecutar Limpieza Rápida
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50">
                <Trash2 className="mr-2 h-4 w-4" /> Limpieza Completa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Limpieza Completa del Sistema
                </DialogTitle>
                <DialogDescription>
                  Elimina todas las cachés, archivos temporales, sesiones de navegador y residuos de conexiones.
                  Esta operación garantiza un sistema completamente limpio para nuevas conexiones WhatsApp.
                </DialogDescription>
              </DialogHeader>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 my-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                  <div className="text-sm text-red-700">
                    <p className="font-medium">Advertencia:</p>
                    <ul className="mt-1 list-disc list-inside text-xs">
                      <li>Se cerrarán todas las conexiones activas</li>
                      <li>Se eliminarán archivos temporales y cachés</li>
                      <li>Será necesario reconectar las cuentas</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <DialogClose asChild>
                  <Button variant="outline">Cancelar</Button>
                </DialogClose>
                <Button 
                  onClick={handleCompleteCleanup}
                  disabled={isCleanupLoading}
                  variant="destructive"
                >
                  {isCleanupLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Limpiando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Ejecutar Limpieza Completa
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button 
            onClick={handleDeleteAll} 
            size="sm" 
            variant="destructive"
            disabled={deleteAllAccountsMutation.isPending || accounts.length === 0}
          >
            <Trash className="mr-2 h-4 w-4" /> 
            {deleteAllAccountsMutation.isPending ? 'Eliminando...' : 'Eliminar Todo'}
          </Button>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Añadir cuenta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Añadir nueva cuenta de WhatsApp</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre de la cuenta *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej. Ventas" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descripción</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej. Línea principal de atención al cliente" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="ownerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre del propietario</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej. Juan Pérez" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="ownerPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej. +51999999999" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end gap-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setAddDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createAccountMutation.isPending}
                    >
                      {createAccountMutation.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Creando...
                        </>
                      ) : 'Crear cuenta'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      {/* Lista de posiciones fijas del 1 al 10 */}
      <div className="mb-6 p-4 bg-gray-50 border rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Posiciones disponibles</h2>
        <p className="text-sm text-gray-600 mb-4">
          Las cuentas de WhatsApp se asignan a posiciones fijas del 1 al 10. Seleccione una posición vacía para crear una nueva cuenta o administre las existentes.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {/* Generar 10 posiciones fijas */}
          {Array.from({ length: 10 }, (_, index) => {
            const position = index + 1;
            const existingAccount = accounts.find(acc => acc.id === position);
            const isOccupied = !!existingAccount;
            
            return (
              <div 
                key={position}
                className={`
                  relative p-3 border rounded-md flex flex-col items-center justify-center
                  ${isOccupied ? 'bg-white shadow-sm cursor-pointer hover:shadow' : 'bg-gray-100 border-dashed'}
                  transition-all
                `}
                onClick={() => {
                  if (isOccupied && existingAccount) {
                    // Si hay una cuenta en esta posición, abre su QR
                    handleShowQR(existingAccount);
                  } else {
                    // Si está vacía, abre el diálogo para crear cuenta
                    form.reset();
                    // Muestra un mensaje para que el usuario sepa qué posición está seleccionando
                    toast({
                      title: `Posición ${position} seleccionada`,
                      description: 'Crear una nueva cuenta de WhatsApp para esta posición',
                      duration: 3000
                    });
                    setAddDialogOpen(true);
                  }
                }}
              >
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center mb-2
                  ${isOccupied ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}
                  font-semibold text-lg
                `}>
                  {position}
                </div>
                
                {isOccupied ? (
                  <>
                    <div className="font-medium text-sm line-clamp-1 text-center mb-1">{existingAccount.name}</div>
                    <div className="absolute top-2 right-2">
                      {existingAccount.currentStatus?.authenticated ? (
                        <div className="w-3 h-3 bg-green-500 rounded-full" title="Conectada"></div>
                      ) : (
                        <div className="w-3 h-3 bg-red-500 rounded-full" title="Desconectada"></div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-gray-500 text-xs font-medium">Disponible</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {/* Lista de cuentas actuales */}
      <h2 className="text-xl font-semibold mb-4">Detalles de cuentas</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accountsWithPing.length > 0 ? (
          accountsWithPing.map((account) => (
            <Card key={account.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs border border-blue-300">
                      {account.id}
                    </div>
                    <CardTitle className="text-xl">{account.name}</CardTitle>
                  </div>
                  {renderStatusBadge(account.status, account.currentStatus?.authenticated)}
                </div>
                <CardDescription className="line-clamp-2">
                  {account.description || 'Sin descripción'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="grid grid-cols-2 gap-1 text-sm my-2">
                  <div className="text-muted-foreground">Propietario:</div>
                  <div>{account.ownerName || 'No especificado'}</div>
                  <div className="text-muted-foreground">Teléfono:</div>
                  <div>{account.ownerPhone || 'No especificado'}</div>
                  <div className="text-muted-foreground">Última actividad:</div>
                  <div>
                    {account.lastActiveAt 
                      ? new Date(account.lastActiveAt).toLocaleString() 
                      : 'Nunca'}
                  </div>
                </div>

                {/* Sección de Keep-Alive/Ping */}
                {account.currentStatus?.authenticated && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-700">Keep-Alive</h4>
                      <div className="flex items-center gap-2">
                        {account.pingStatus?.isActive ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                            <Heart className="w-3 h-3 mr-1" />
                            Activo
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-800 border-gray-200">
                            <Square className="w-3 h-3 mr-1" />
                            Inactivo
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {account.pingStatus?.isActive && (
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-2">
                        <div>Pings: {account.pingStatus.pingCount || 0}</div>
                        <div>Último: {formatTimeAgo(account.pingStatus.lastPing)}</div>
                      </div>
                    )}

                    <div className="flex gap-1">
                      {account.pingStatus?.isActive ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50 text-xs h-7"
                          onClick={() => stopKeepAlive(account.id)}
                        >
                          <Square className="w-3 h-3 mr-1" />
                          Desactivar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 border-green-200 hover:bg-green-50 text-xs h-7"
                          onClick={() => startKeepAlive(account.id)}
                        >
                          <Heart className="w-3 h-3 mr-1" />
                          Activar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-blue-600 border-blue-200 hover:bg-blue-50 text-xs h-7"
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/ping-status/all'] })}
                      >
                        <Activity className="w-3 h-3 mr-1" />
                        Estado
                      </Button>
                    </div>
                  </div>
                )}

                {/* Sección de configuración de respuestas automáticas */}
                <div className="mt-3 border-t pt-3">
                  <AutoResponseConfig 
                    accountId={account.id} 
                    accountName={account.name} 
                  />
                </div>

              </CardContent>
              <CardFooter className="flex justify-between border-t p-4">
                <div className="flex gap-1">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleDelete(account)}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    disabled
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-1">
                  {account.currentStatus?.authenticated ? (
                    <>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-green-600 border-green-500 hover:bg-green-50"
                        onClick={() => forceReadyState(account.id)}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Activar
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-red-500 border-red-500 hover:bg-red-50"
                        onClick={() => {
                          setSelectedAccount(account);
                          disconnectAccountMutation.mutate(account.id);
                        }}
                      >
                        <PowerOff className="h-4 w-4 mr-2" />
                        Desconectar
                      </Button>
                    </>
                  ) : (
                    <Button 
                      size="sm" 
                      onClick={() => handleShowQR(account)}
                    >
                      <QrCode className="h-4 w-4 mr-2" />
                      Conectar
                    </Button>
                  )}
                </div>
              </CardFooter>
            </Card>
          ))
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center bg-muted p-12 rounded-lg">
            <Phone className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-medium mb-2">No hay cuentas</h3>
            <p className="text-muted-foreground text-center mb-4">
              Aún no has añadido ninguna cuenta de WhatsApp al sistema.
            </p>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Añadir cuenta
            </Button>
          </div>
        )}
      </div>
      {/* Diálogo de código QR */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedAccount?.currentStatus?.authenticated 
                ? `Cuenta conectada: ${selectedAccount?.name}` 
                : `Conectar cuenta: ${selectedAccount?.name}`}
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            {selectedAccount?.currentStatus?.authenticated ? (
              <div className="flex flex-col items-center justify-center p-6">
                <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                <h3 className="text-xl font-medium mb-2">Cuenta conectada</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Esta cuenta de WhatsApp está activa y conectada al sistema.
                </p>
                <Button 
                  variant="outline" 
                  className="text-red-500 border-red-500 hover:bg-red-50"
                  onClick={handleDisconnect}
                >
                  <PowerOff className="h-4 w-4 mr-2" />
                  Desconectar
                </Button>
              </div>
            ) : isQrLoading || initializeAccountMutation.isPending ? (
              <div className="flex flex-col items-center justify-center p-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-800 mb-4"></div>
                <p className="text-center text-muted-foreground">
                  {initializeAccountMutation.isPending 
                    ? 'Inicializando cuenta...' 
                    : 'Preparando conexión...'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col space-y-4">
                {/* Pestañas para elegir método de conexión */}
                <Tabs 
                  defaultValue={authMethod} 
                  onValueChange={(value) => setAuthMethod(value as 'qrcode' | 'phone')} 
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="qrcode" className="flex items-center justify-center">
                      <QrCode className="h-4 w-4 mr-2" />
                      Código QR
                    </TabsTrigger>
                    <TabsTrigger value="phone" className="flex items-center justify-center">
                      <Smartphone className="h-4 w-4 mr-2" />
                      Teléfono
                    </TabsTrigger>
                  </TabsList>
                  
                  {/* Contenido de la pestaña Código QR */}
                  <TabsContent value="qrcode" className="mt-4">
                    {qrData?.qrcode ? (
                      <div className="flex flex-col items-center">
                        <div className="bg-white p-4 rounded-lg mb-4">
                          <div 
                            id="qrcode-display"
                            className="qr-container w-64 h-64 flex items-center justify-center"
                          >
                            <QRCodeDisplay qrData={qrData.qrcode} />
                          </div>
                        </div>
                        <p className="text-center text-sm text-muted-foreground mb-4">
                          Escanee este código QR con WhatsApp en su teléfono para conectar la cuenta.
                          <br />
                          El código se actualizará automáticamente.
                        </p>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleRefreshQR}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Actualizar QR
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleReconnect}
                          >
                            <Power className="h-4 w-4 mr-2" />
                            Reinicializar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-6">
                        <XCircle className="h-16 w-16 text-red-500 mb-4" />
                        <h3 className="text-xl font-medium mb-2">Error</h3>
                        <p className="text-muted-foreground text-center mb-4">
                          No se pudo generar el código QR. Intente reinicializar la cuenta.
                        </p>
                        <Button onClick={handleReconnect}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Reintentar
                        </Button>
                      </div>
                    )}
                  </TabsContent>
                  
                  {/* Contenido de la pestaña Teléfono */}
                  <TabsContent value="phone" className="mt-4">
                    {selectedAccount && (
                      <WhatsAppPhoneConnect 
                        accountId={selectedAccount.id}
                        onSuccess={() => {
                          toast({
                            title: "Conexión exitosa",
                            description: "Tu cuenta de WhatsApp ha sido conectada correctamente",
                          });
                          queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-accounts'] });
                          setQrDialogOpen(false);
                        }}
                      />
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de configuración de agente externo */}
      <Dialog open={agentConfigDialogOpen} onOpenChange={setAgentConfigDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Configurar Agente Externo A.E AI
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Selecciona qué agente externo usar para respuestas automáticas en <strong>{selectedAccountForAgent?.name}</strong>
            </p>
          </DialogHeader>
          
          <ExternalAgentConfigForm 
            accountId={selectedAccountForAgent?.id || 0}
            onSuccess={() => {
              setAgentConfigDialogOpen(false);
              queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-accounts'] });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Componente para configurar agente externo
const ExternalAgentConfigForm = ({ accountId, onSuccess }: { accountId: number; onSuccess: () => void }) => {
  const { toast } = useToast();
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [autoResponseEnabled, setAutoResponseEnabled] = useState(false);
  
  // Obtener agentes externos usando el mismo sistema que funciona en la página de agentes
  const { data: externalAgentsResponse, refetch: refetchAgents } = useQuery({
    queryKey: ['/api/bypass/agents-list'],
    queryFn: async () => {
      console.log('🔍 Obteniendo lista de agentes externos...');
      
      try {
        // Intentar primero el endpoint bypass que funciona
        const response = await fetch('/api/bypass/agents-list');
        const text = await response.text();
        
        let data;
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          console.warn('Respuesta no es JSON válido, usando agentes predefinidos...');
          throw new Error('Parse error');
        }
        
        if (data.success && Array.isArray(data.agents)) {
          console.log('✅ Agentes externos encontrados:', data.agents.length);
          return data;
        }
      } catch (error) {
        console.warn('Error en bypass endpoint, usando agentes predefinidos:', error);
      }
      
      // Fallback: usar los 5 agentes predefinidos
      const defaultAgents = [
        {
          id: 'smartbots-001',
          name: 'Smartbots',
          agentUrl: 'https://chatgpt.com/g/g-682ceb8bfa4c81918b3ff66abe6f3480-smartbots',
          isActive: true,
          responseCount: 0
        },
        {
          id: 'smartplanner-001',
          name: 'Smartplanner IA',
          agentUrl: 'https://chatgpt.com/g/g-682e61ce2364819196df9641616414b1-smartplanner-ia',
          isActive: true,
          responseCount: 0
        },
        {
          id: 'smartflyer-001',
          name: 'Smartflyer IA',
          agentUrl: 'https://chatgpt.com/g/g-682f551bee70819196aeb603eb638762-smartflyer-ia',
          isActive: true,
          responseCount: 0
        },
        {
          id: 'telca-001',
          name: 'Agente de Ventas de Telca Panama',
          agentUrl: 'https://chatgpt.com/g/g-682f9b5208988191b08215b3d8f65333-agente-de-ventas-de-telca-panama',
          isActive: true,
          responseCount: 0
        },
        {
          id: 'tecnico-001',
          name: 'Asistente Técnico en Gestión en Campo',
          agentUrl: 'https://chatgpt.com/g/g-682bb98fedf881918e0c4ed5fcf592e4-asistente-tecnico-en-gestion-en-campo',
          isActive: true,
          responseCount: 0
        }
      ];
      
      console.log('✅ Agentes predefinidos cargados:', defaultAgents.length);
      return { success: true, agents: defaultAgents };
    }
  });

  const externalAgents = externalAgentsResponse?.agents || [];

  // Obtener configuración actual
  const { data: currentConfig } = useQuery({
    queryKey: [`/api/whatsapp-accounts/${accountId}/agent-config`],
    queryFn: async () => {
      const response = await apiRequest(`/api/whatsapp-accounts/${accountId}/agent-config`);
      console.log('🔍 Configuración recibida del servidor:', response);
      return response;
    },
    enabled: !!accountId
  });

  // Inicializar valores
  useEffect(() => {
    if (currentConfig?.success) {
      const config = currentConfig.config;
      setSelectedAgentId(config.assignedExternalAgentId || '');
      setAutoResponseEnabled(config.autoResponseEnabled || false);
    }
  }, [currentConfig]);

  // Refrescar agentes al abrir
  useEffect(() => {
    if (accountId) {
      refetchAgents();
    }
  }, [accountId, refetchAgents]);

  // Mutation para asignar agente
  const assignMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/whatsapp-accounts/${accountId}/assign-external-agent`, {
        method: 'POST',
        body: { 
          externalAgentId: selectedAgentId || null, 
          autoResponseEnabled 
        }
      });
    },
    onSuccess: () => {
      toast({
        title: '✅ Configuración guardada',
        description: 'El agente externo se ha configurado correctamente.',
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: '❌ Error',
        description: 'No se pudo guardar la configuración.',
        variant: 'destructive',
      });
    }
  });

  const handleSave = () => {
    assignMutation.mutate();
  };

  const selectedAgent = externalAgents.find((agent: any) => agent.id === selectedAgentId);

  return (
    <div className="space-y-4 pt-4">
      <div>
        <label className="text-sm font-medium mb-2 block">Agente Externo</label>
        <select 
          value={selectedAgentId} 
          onChange={(e) => setSelectedAgentId(e.target.value)}
          className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Sin agente asignado</option>
          {externalAgents.map((agent: any) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
        
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {externalAgents.length === 0 
              ? 'No hay agentes externos disponibles' 
              : `${externalAgents.length} agente(s) disponible(s)`}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetchAgents()}
            className="text-xs h-6"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Actualizar
          </Button>
        </div>
        
        {externalAgents.length === 0 && (
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
            ⚠️ No hay agentes externos disponibles. Crea uno primero en la página de Agentes Externos.
          </div>
        )}
      </div>

      {selectedAgent && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md">
          <p className="text-xs text-green-700 mb-1">✅ Agente seleccionado:</p>
          <p className="font-medium text-sm text-green-800">{selectedAgent.name}</p>
          <p className="text-xs text-green-600 mt-1 break-all">{selectedAgent.agentUrl}</p>
        </div>
      )}

      <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
        <div>
          <label className="text-sm font-medium text-blue-800">Respuestas automáticas</label>
          <p className="text-xs text-blue-600">Activar respuestas automáticas con este agente</p>
        </div>
        <input
          type="checkbox"
          checked={autoResponseEnabled}
          onChange={(e) => setAutoResponseEnabled(e.target.checked)}
          className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
        />
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button 
          variant="outline" 
          onClick={() => onSuccess()}
          disabled={assignMutation.isPending}
        >
          Cancelar
        </Button>
        <Button 
          onClick={handleSave}
          disabled={assignMutation.isPending}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {assignMutation.isPending ? (
            <>
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
              Guardando...
            </>
          ) : 'Guardar configuración'}
        </Button>
      </div>
    </div>
  );
};

export default WhatsAppAccounts;