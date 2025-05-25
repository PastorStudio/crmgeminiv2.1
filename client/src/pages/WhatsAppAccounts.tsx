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
} from 'lucide-react';
import { AgentConfigSection } from '@/components/AgentConfigSection';

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
  
  // Consulta para obtener cuentas
  const { data: accounts = [], isLoading, error, refetch } = useQuery<WhatsAppAccount[]>({
    queryKey: ['/api/whatsapp-accounts'],
    queryFn: async () => {
      return await apiRequest('/api/whatsapp-accounts');
    }
  });

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
  
  // Actualizar QR code
  const handleRefreshQR = () => {
    refetchQr();
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
  
  // Combinar datos de cuentas con información de ping
  const accountsWithPing = accounts.map(account => {
    if (pingStatusData?.success && pingStatusData.accounts) {
      const pingInfo = pingStatusData.accounts.find((acc: any) => acc.accountId === account.id);
      return {
        ...account,
        pingStatus: pingInfo?.pingStatus || {
          isActive: false,
          lastPing: 0,
          pingCount: 0,
          nextPing: 0
        }
      };
    }
    return account;
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

                {/* Sección de Configuración de Agentes Externos */}
                <AgentConfigSection accountId={account.id} />
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
    </div>
  );
};

export default WhatsAppAccounts;