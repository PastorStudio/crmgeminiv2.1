import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Clock, User, Calendar, CheckCircle, XCircle, ArrowRight, Plus, Eye, LogIn, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DemoUser {
  id: number;
  customerName: string;
  phoneNumber: string;
  username: string;
  password: string;
  chatId?: string;
  requestedAt: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'converted' | 'cancelled';
  convertedToUserId?: number;
  convertedAt?: string;
  createdBy: string;
  notes?: string;
  lastLoginAt?: string;
  loginCount: number;
  daysRemaining: number;
  isExpired: boolean;
}

interface SubscriptionPlan {
  id: number;
  name: string;
  description: string;
  price: string;
  currency: string;
  durationDays: number;
  features: string[];
}

export function DemoManagement() {
  const [selectedDemo, setSelectedDemo] = useState<DemoUser | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [manualCreateDialogOpen, setManualCreateDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [newDemoName, setNewDemoName] = useState('');
  const [newDemoPhone, setNewDemoPhone] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch demo users
  const { data: demos, isLoading: demosLoading } = useQuery({
    queryKey: ['/api/direct/demo/list'],
    queryFn: () => apiRequest('/api/direct/demo/list')
  });

  // Fetch subscription plans
  const { data: plans } = useQuery({
    queryKey: ['/api/subscription-plans'],
    queryFn: () => apiRequest('/api/subscription-plans')
  });

  // Convert demo mutation
  const convertMutation = useMutation({
    mutationFn: async ({ demoId, planId, fullName, email }: {
      demoId: number;
      planId?: number;
      fullName: string;
      email: string;
    }) => {
      return apiRequest(`/api/direct/demo/convert/${demoId}`, {
        method: 'POST',
        body: JSON.stringify({ planId, fullName, email })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/direct/demo/list'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setConvertDialogOpen(false);
      setSelectedDemo(null);
      setSelectedPlan('');
      setFullName('');
      setEmail('');
      toast({
        title: 'Demo convertido',
        description: 'El demo ha sido convertido exitosamente a usuario completo',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Error al convertir el demo',
        variant: 'destructive',
      });
    }
  });

  // Manual demo creation mutation
  const createDemoMutation = useMutation({
    mutationFn: async ({ customerName, phoneNumber }: {
      customerName: string;
      phoneNumber: string;
    }) => {
      return apiRequest('/api/direct/demo/create-manual', {
        method: 'POST',
        body: JSON.stringify({ customerName, phoneNumber })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/direct/demo/list'] });
      setManualCreateDialogOpen(false);
      setNewDemoName('');
      setNewDemoPhone('');
      toast({
        title: 'Demo creado',
        description: 'El demo ha sido creado exitosamente',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Error al crear el demo',
        variant: 'destructive',
      });
    }
  });

  // Demo login function
  const handleDemoLogin = async (demo: DemoUser) => {
    try {
      const response = await apiRequest('/api/demo/login', {
        method: 'POST',
        body: JSON.stringify({
          username: demo.username,
          password: demo.password
        })
      });

      if (response.success && response.token) {
        // Store the demo token
        localStorage.setItem('auth-token', response.token);
        localStorage.setItem('user-role', 'demo');
        localStorage.setItem('demo-user-id', demo.id.toString());
        
        // Redirect to dashboard
        window.location.href = '/';
        
        toast({
          title: 'Acceso iniciado',
          description: `Sesión iniciada como ${demo.customerName}`,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error de acceso',
        description: error.message || 'No se pudo iniciar sesión',
        variant: 'destructive',
      });
    }
  };

  const handleConvert = () => {
    if (!selectedDemo) return;
    
    convertMutation.mutate({
      demoId: selectedDemo.id,
      planId: selectedPlan ? parseInt(selectedPlan) : undefined,
      fullName: fullName || selectedDemo.customerName,
      email
    });
  };

  const getStatusBadge = (demo: DemoUser) => {
    if (demo.isExpired) {
      return <Badge variant="destructive">Expirado</Badge>;
    }
    
    switch (demo.status) {
      case 'active':
        return <Badge variant="default">Activo</Badge>;
      case 'converted':
        return <Badge variant="secondary">Convertido</Badge>;
      case 'cancelled':
        return <Badge variant="outline">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{demo.status}</Badge>;
    }
  };

  const activeDemos = demos?.demos?.filter((demo: DemoUser) => demo.status === 'active' && !demo.isExpired) || [];
  const expiredDemos = demos?.demos?.filter((demo: DemoUser) => demo.isExpired || demo.status === 'expired') || [];
  const convertedDemos = demos?.demos?.filter((demo: DemoUser) => demo.status === 'converted') || [];

  if (demosLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Cargando demos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Manual Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Gestión de Demos</h2>
          <p className="text-muted-foreground">
            Administra las cuentas de demostración creadas automáticamente por el agente
          </p>
        </div>
        <Button 
          onClick={() => setManualCreateDialogOpen(true)}
          className="flex items-center space-x-2"
        >
          <UserPlus className="h-4 w-4" />
          <span>Crear Demo Manual</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Demos Activos</p>
                <p className="text-2xl font-bold text-blue-600">{activeDemos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-orange-600" />
              <div>
                <p className="text-sm font-medium">Expirados</p>
                <p className="text-2xl font-bold text-orange-600">{expiredDemos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-sm font-medium">Convertidos</p>
                <p className="text-2xl font-bold text-green-600">{convertedDemos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-purple-600" />
              <div>
                <p className="text-sm font-medium">Total</p>
                <p className="text-2xl font-bold text-purple-600">{demos?.demos?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Demo Tabs */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="active">Activos ({activeDemos.length})</TabsTrigger>
          <TabsTrigger value="expired">Expirados ({expiredDemos.length})</TabsTrigger>
          <TabsTrigger value="converted">Convertidos ({convertedDemos.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Demos Activos</CardTitle>
              <CardDescription>
                Usuarios de prueba con acceso activo al sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DemoTable demos={activeDemos} onConvert={(demo) => {
                setSelectedDemo(demo);
                setFullName(demo.customerName);
                setConvertDialogOpen(true);
              }} onLogin={handleDemoLogin} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expired" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Demos Expirados</CardTitle>
              <CardDescription>
                Usuarios cuyo periodo de prueba ha terminado
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DemoTable demos={expiredDemos} onConvert={(demo) => {
                setSelectedDemo(demo);
                setFullName(demo.customerName);
                setConvertDialogOpen(true);
              }} onLogin={handleDemoLogin} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="converted" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Demos Convertidos</CardTitle>
              <CardDescription>
                Usuarios que se convirtieron en clientes completos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DemoTable demos={convertedDemos} showConvertedInfo />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Convert Dialog */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convertir Demo a Usuario Completo</DialogTitle>
            <DialogDescription>
              Convierte este demo en un usuario completo con acceso permanente al sistema
            </DialogDescription>
          </DialogHeader>
          
          {selectedDemo && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="fullName">Nombre Completo</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nombre completo del usuario"
                />
              </div>
              
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@ejemplo.com"
                />
              </div>
              
              <div>
                <Label htmlFor="plan">Plan de Suscripción</Label>
                <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar plan (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans?.map((plan: SubscriptionPlan) => (
                      <SelectItem key={plan.id} value={plan.id.toString()}>
                        {plan.name} - ${plan.price} / {plan.durationDays} días
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Cliente:</strong> {selectedDemo.customerName}<br />
                  <strong>Teléfono:</strong> {selectedDemo.phoneNumber}<br />
                  <strong>Usuario Demo:</strong> {selectedDemo.username}
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleConvert}
              disabled={convertMutation.isPending || !fullName}
            >
              {convertMutation.isPending ? 'Convirtiendo...' : 'Convertir a Usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Demo Creation Dialog */}
      <Dialog open={manualCreateDialogOpen} onOpenChange={setManualCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Demo Manual</DialogTitle>
            <DialogDescription>
              Crea una cuenta de demostración manual para un cliente específico
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="newDemoName">Nombre del Cliente</Label>
              <Input
                id="newDemoName"
                value={newDemoName}
                onChange={(e) => setNewDemoName(e.target.value)}
                placeholder="Nombre completo del cliente"
              />
            </div>
            
            <div>
              <Label htmlFor="newDemoPhone">Número de Teléfono</Label>
              <Input
                id="newDemoPhone"
                value={newDemoPhone}
                onChange={(e) => setNewDemoPhone(e.target.value)}
                placeholder="+1234567890"
              />
            </div>
            
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Información:</strong><br />
                • Se creará un usuario demo con acceso de 3 días<br />
                • Se generará automáticamente una cuenta de WhatsApp aislada<br />
                • Las credenciales se mostrarán después de la creación
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => {
                if (newDemoName && newDemoPhone) {
                  createDemoMutation.mutate({
                    customerName: newDemoName,
                    phoneNumber: newDemoPhone
                  });
                }
              }}
              disabled={createDemoMutation.isPending || !newDemoName || !newDemoPhone}
            >
              {createDemoMutation.isPending ? 'Creando...' : 'Crear Demo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface DemoTableProps {
  demos: DemoUser[];
  onConvert?: (demo: DemoUser) => void;
  showConvertedInfo?: boolean;
}

function DemoTable({ demos, onConvert, showConvertedInfo }: DemoTableProps) {
  if (demos.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>No hay demos en esta categoría</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cliente</TableHead>
          <TableHead>Usuario</TableHead>
          <TableHead>Teléfono</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Expira</TableHead>
          <TableHead>Logins</TableHead>
          {showConvertedInfo && <TableHead>Convertido</TableHead>}
          {onConvert && <TableHead>Acciones</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {demos.map((demo) => (
          <TableRow key={demo.id}>
            <TableCell className="font-medium">{demo.customerName}</TableCell>
            <TableCell>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                {demo.username}
              </code>
            </TableCell>
            <TableCell>{demo.phoneNumber}</TableCell>
            <TableCell>
              <div className="flex items-center space-x-2">
                {demo.status === 'active' && !demo.isExpired ? (
                  <Badge variant="default">Activo</Badge>
                ) : demo.isExpired ? (
                  <Badge variant="destructive">Expirado</Badge>
                ) : demo.status === 'converted' ? (
                  <Badge variant="secondary">Convertido</Badge>
                ) : (
                  <Badge variant="outline">{demo.status}</Badge>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div className="text-sm">
                {demo.isExpired ? (
                  <span className="text-red-600">Expirado</span>
                ) : (
                  <span className="text-green-600">
                    {demo.daysRemaining} día{demo.daysRemaining !== 1 ? 's' : ''}
                  </span>
                )}
                <div className="text-xs text-gray-500">
                  {new Date(demo.expiresAt).toLocaleDateString('es-ES')}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="text-sm">
                {demo.loginCount} veces
                {demo.lastLoginAt && (
                  <div className="text-xs text-gray-500">
                    Último: {new Date(demo.lastLoginAt).toLocaleDateString('es-ES')}
                  </div>
                )}
              </div>
            </TableCell>
            {showConvertedInfo && (
              <TableCell>
                {demo.convertedAt && (
                  <div className="text-sm text-green-600">
                    {new Date(demo.convertedAt).toLocaleDateString('es-ES')}
                  </div>
                )}
              </TableCell>
            )}
            {onConvert && (
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onConvert(demo)}
                  className="flex items-center space-x-1"
                >
                  <ArrowRight className="h-3 w-3" />
                  <span>Convertir</span>
                </Button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}