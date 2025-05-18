import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, QrCode, RefreshCw, MoreVertical, Check, X, User, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
// Esquema para la creación de una nueva cuenta de WhatsApp
const createWhatsAppAccountSchema = z.object({
  name: z.string().min(1, { message: 'El nombre es obligatorio' }),
  description: z.string().optional(),
  ownerName: z.string().optional(),
  ownerPhone: z.string().optional(),
});

type CreateWhatsAppAccountFormValues = z.infer<typeof createWhatsAppAccountSchema>;

const WhatsAppAccounts = () => {
  const [, setLocation] = useLocation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [isAgentsDialogOpen, setIsAgentsDialogOpen] = useState(false);
  const { toast } = useToast();
  // Usando setLocation para navegación con wouter en lugar de useNavigate

  const { data: accounts, isLoading, refetch } = useQuery({
    queryKey: ['/api/whatsapp-accounts'],
    queryFn: async () => {
      const response = await fetch('/api/whatsapp-accounts');
      if (!response.ok) {
        throw new Error('Error al cargar las cuentas de WhatsApp');
      }
      return response.json();
    }
  });

  const form = useForm<CreateWhatsAppAccountFormValues>({
    resolver: zodResolver(createWhatsAppAccountSchema),
    defaultValues: {
      name: '',
      description: '',
      ownerName: '',
      ownerPhone: '',
    },
  });

  const createAccountMutation = useMutation({
    mutationFn: async (data: CreateWhatsAppAccountFormValues) => {
      const response = await apiRequest('POST', '/api/whatsapp-accounts', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Cuenta creada',
        description: 'La cuenta de WhatsApp ha sido creada exitosamente',
      });
      setIsCreateDialogOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-accounts'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `No se pudo crear la cuenta: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const updateAccountStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: string }) => {
      const response = await apiRequest('PATCH', `/api/whatsapp-accounts/${id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Estado actualizado',
        description: 'El estado de la cuenta ha sido actualizado exitosamente',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-accounts'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `No se pudo actualizar el estado: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/whatsapp-accounts/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Cuenta eliminada',
        description: 'La cuenta de WhatsApp ha sido eliminada exitosamente',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-accounts'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `No se pudo eliminar la cuenta: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const generateQRCodeMutation = useMutation({
    mutationFn: async (accountId: number) => {
      setIsQrLoading(true);
      const response = await apiRequest('POST', `/api/whatsapp-accounts/${accountId}/generate-qr`);
      if (!response.ok) {
        throw new Error('Error al generar código QR');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setQrCodeUrl(data.qrUrl);
      setIsQrLoading(false);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `No se pudo generar el código QR: ${error.message}`,
        variant: 'destructive',
      });
      setIsQrLoading(false);
    },
  });

  const onSubmit = (data: CreateWhatsAppAccountFormValues) => {
    createAccountMutation.mutate(data);
  };

  const handleConnectAccount = (account) => {
    setSelectedAccount(account);
    setIsConnectDialogOpen(true);
    generateQRCodeMutation.mutate(account.id);
  };

  const handleGenerateNewQR = () => {
    if (selectedAccount) {
      generateQRCodeMutation.mutate(selectedAccount.id);
    }
  };

  const handleManageAgents = (account) => {
    setSelectedAccount(account);
    setIsAgentsDialogOpen(true);
  };

  const renderStatus = (status) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Conectada</Badge>;
      case 'inactive':
        return <Badge className="bg-gray-500">Desconectada</Badge>;
      case 'pending_auth':
        return <Badge className="bg-yellow-500">Pendiente</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="container p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Cuentas de WhatsApp</h1>
          <p className="text-gray-600">Administre múltiples cuentas de WhatsApp para diferentes departamentos o equipos</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="flex items-center">
          <Plus className="mr-2 h-4 w-4" />
          Nueva Cuenta
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-gray-600">Cargando cuentas...</span>
        </div>
      ) : accounts && accounts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => (
            <Card key={account.id} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl">{account.name}</CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleConnectAccount(account)}>
                        <QrCode className="mr-2 h-4 w-4" />
                        Conectar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleManageAgents(account)}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Asignar Agentes
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {account.status === 'active' ? (
                        <DropdownMenuItem onClick={() => updateAccountStatusMutation.mutate({ id: account.id, status: 'inactive' })}>
                          <X className="mr-2 h-4 w-4" />
                          Desconectar
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => handleConnectAccount(account)}>
                          <Check className="mr-2 h-4 w-4" />
                          Reconectar
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-red-500"
                        onClick={() => {
                          if (window.confirm('¿Estás seguro de que deseas eliminar esta cuenta? Esta acción no se puede deshacer.')) {
                            deleteAccountMutation.mutate(account.id);
                          }
                        }}
                      >
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardDescription>{account.description || 'Sin descripción'}</CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-500">Estado:</span>
                    {renderStatus(account.status)}
                  </div>
                  {account.ownerName && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-500">Propietario:</span>
                      <span className="text-sm">{account.ownerName}</span>
                    </div>
                  )}
                  {account.lastActiveAt && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-500">Última actividad:</span>
                      <span className="text-sm">{new Date(account.lastActiveAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="pt-2 flex justify-between">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleConnectAccount(account)}
                  className="flex items-center"
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  Conectar
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleManageAgents(account)}
                  className="flex items-center"
                >
                  <User className="mr-2 h-4 w-4" />
                  Agentes
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed border-2 border-gray-300 p-6">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-700">No hay cuentas configuradas</h3>
            <p className="text-gray-500 mt-1">Agregue su primera cuenta de WhatsApp para comenzar</p>
            <Button onClick={() => setIsCreateDialogOpen(true)} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Agregar cuenta
            </Button>
          </div>
        </Card>
      )}

      {/* Dialog para crear nueva cuenta */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nueva Cuenta de WhatsApp</DialogTitle>
            <DialogDescription>
              Complete los siguientes datos para agregar una nueva cuenta de WhatsApp al sistema.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la cuenta</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Soporte Técnico" {...field} />
                    </FormControl>
                    <FormDescription>
                      Un nombre descriptivo para identificar esta cuenta
                    </FormDescription>
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
                      <Textarea 
                        placeholder="Ej: Cuenta principal de WhatsApp para el equipo de soporte"
                        {...field}
                      />
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
                    <FormLabel>Propietario</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Juan Pérez" {...field} />
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
                    <FormLabel>Número de Teléfono</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: +123456789" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createAccountMutation.isPending}
                >
                  {createAccountMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Crear Cuenta
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog para conectar cuenta (QR Code) */}
      <Dialog open={isConnectDialogOpen} onOpenChange={setIsConnectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar Cuenta de WhatsApp</DialogTitle>
            <DialogDescription>
              Escanee este código QR con su aplicación de WhatsApp para conectar la cuenta.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-4">
            {isQrLoading ? (
              <div className="flex flex-col items-center justify-center h-64">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <span className="mt-4 text-gray-500">Generando código QR...</span>
              </div>
            ) : qrCodeUrl ? (
              <div className="flex flex-col items-center">
                <img src={qrCodeUrl} alt="WhatsApp QR Code" className="w-64 h-64 object-contain" />
                <p className="mt-4 text-sm text-gray-500 text-center">
                  Este código expirará en 60 segundos. Si no puede escanearlo a tiempo, genere uno nuevo.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64">
                <p className="text-gray-500">No se pudo generar el código QR. Inténtelo nuevamente.</p>
              </div>
            )}
          </div>
          <DialogFooter className="flex justify-between">
            <Button 
              variant="outline" 
              onClick={() => setIsConnectDialogOpen(false)}
            >
              Cerrar
            </Button>
            <Button 
              onClick={handleGenerateNewQR} 
              disabled={isQrLoading}
              className="flex items-center"
            >
              {isQrLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <RefreshCw className={`mr-2 h-4 w-4 ${isQrLoading ? '' : 'animate-spin'}`} />
              Generar Nuevo QR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para gestionar agentes */}
      <Dialog open={isAgentsDialogOpen} onOpenChange={setIsAgentsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Asignar Agentes a {selectedAccount?.name}
            </DialogTitle>
            <DialogDescription>
              Seleccione qué agentes pueden acceder a esta cuenta de WhatsApp y qué permisos tendrán.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Button
              className="mb-4"
              onClick={() => setLocation('/chat-assignments')}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Asignar Agentes
            </Button>
            
            <Separator className="my-4" />
            
            <div className="text-center py-8">
              <p>La asignación de agentes y permisos detallados se puede configurar en la página de Asignar Chats.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setLocation('/chat-assignments')}
              >
                Ir a Asignación de Chats
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsAppAccounts;