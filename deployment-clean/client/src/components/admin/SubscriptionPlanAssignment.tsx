import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, CreditCard, Plus, Trash2, Clock, DollarSign, Users, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface SubscriptionPlan {
  id: number;
  name: string;
  description: string;
  price: string;
  currency: string;
  durationDays: number;
  features: string[];
  maxUsers: number;
  maxWhatsAppAccounts: number;
  maxChatsPerMonth: number;
  isActive: boolean;
}

interface UserSubscription {
  id: number;
  userId: number;
  planId: number;
  startDate: string;
  endDate: string;
  status: string;
  autoRenewal: boolean;
  notes: string;
  userName: string;
  userFullName: string;
  userEmail: string;
  planName: string;
  planPrice: string;
  planDurationDays: number;
}

interface User {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
}

const SubscriptionPlanAssignment: React.FC = () => {
  const { toast } = useToast();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [customDuration, setCustomDuration] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load subscription plans
      const plansResponse = await apiRequest('/api/subscription-plans');
      if (plansResponse.success) {
        setPlans(plansResponse.plans);
      }

      // Load user subscriptions
      const subscriptionsResponse = await apiRequest('/api/user-subscriptions');
      if (subscriptionsResponse.success) {
        setSubscriptions(subscriptionsResponse.subscriptions);
      }

      // Load users
      const usersResponse = await apiRequest('/api/users');
      if (usersResponse.success) {
        setUsers(usersResponse.users.filter((user: User) => user.role !== 'superadmin' && user.role !== 'super_admin'));
      }
    } catch (error) {
      console.error('Error loading subscription data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos de suscripciones",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssignPlan = async () => {
    if (!selectedUser || !selectedPlan) {
      toast({
        title: "Error",
        description: "Selecciona un usuario y un plan",
        variant: "destructive",
      });
      return;
    }

    const selectedPlanData = plans.find(p => p.id === parseInt(selectedPlan));
    const durationDays = customDuration || selectedPlanData?.durationDays?.toString() || '30';

    try {
      const response = await apiRequest('/api/assign-subscription', {
        method: 'POST',
        body: JSON.stringify({
          userId: parseInt(selectedUser),
          planId: parseInt(selectedPlan),
          durationDays: parseInt(durationDays),
          notes
        })
      });

      if (response.success) {
        toast({
          title: "Plan asignado",
          description: response.message,
        });
        setAssignDialogOpen(false);
        setSelectedUser('');
        setSelectedPlan('');
        setCustomDuration('');
        setNotes('');
        loadData(); // Reload data
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      console.error('Error assigning plan:', error);
      toast({
        title: "Error",
        description: "No se pudo asignar el plan",
        variant: "destructive",
      });
    }
  };

  const handleCancelSubscription = async (subscriptionId: number) => {
    try {
      const response = await apiRequest(`/api/cancel-subscription/${subscriptionId}`, {
        method: 'DELETE'
      });

      if (response.success) {
        toast({
          title: "Suscripción cancelada",
          description: response.message,
        });
        loadData(); // Reload data
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
      toast({
        title: "Error",
        description: "No se pudo cancelar la suscripción",
        variant: "destructive",
      });
    }
  };

  const calculateDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusBadgeColor = (status: string, endDate: string) => {
    const daysRemaining = calculateDaysRemaining(endDate);
    
    if (status === 'cancelled') return 'bg-red-100 text-red-800';
    if (status === 'expired' || daysRemaining <= 0) return 'bg-gray-100 text-gray-800';
    if (daysRemaining <= 7) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getStatusText = (status: string, endDate: string) => {
    const daysRemaining = calculateDaysRemaining(endDate);
    
    if (status === 'cancelled') return 'Cancelada';
    if (status === 'expired' || daysRemaining <= 0) return 'Expirada';
    if (daysRemaining <= 7) return `${daysRemaining} días restantes`;
    return `Activa (${daysRemaining} días)`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestión de Planes de Suscripción</h2>
          <p className="text-gray-600">Asigna y gestiona planes de suscripción para usuarios</p>
        </div>
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Asignar Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Asignar Plan de Suscripción</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Usuario</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar usuario" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.fullName} ({user.username}) - {user.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-700">Plan</Label>
                <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map(plan => (
                      <SelectItem key={plan.id} value={plan.id.toString()}>
                        {plan.name} - ${plan.price} ({plan.durationDays} días)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Duración personalizada (días)
                </Label>
                <Input
                  type="number"
                  value={customDuration}
                  onChange={(e) => setCustomDuration(e.target.value)}
                  placeholder="Dejar vacío para usar duración del plan"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700">Notas</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas adicionales (opcional)"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleAssignPlan} className="flex-1">
                  Asignar Plan
                </Button>
                <Button variant="outline" onClick={() => setAssignDialogOpen(false)} className="flex-1">
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Plans Overview */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {plans.map(plan => (
          <Card key={plan.id} className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                {plan.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="font-semibold">${plan.price} {plan.currency}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <span>{plan.durationDays} días</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-600" />
                  <span>Hasta {plan.maxUsers} usuarios</span>
                </div>
                <div className="text-sm text-gray-600">{plan.description}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Subscriptions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Suscripciones Activas
            <Badge variant="outline">{subscriptions.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-gray-600">Cargando suscripciones...</p>
            </div>
          ) : subscriptions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((subscription) => (
                  <TableRow key={subscription.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{subscription.userFullName}</p>
                        <p className="text-sm text-gray-500">@{subscription.userName}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{subscription.planName}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">${subscription.planPrice}</p>
                    </TableCell>
                    <TableCell>
                      {new Date(subscription.startDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {new Date(subscription.endDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeColor(subscription.status, subscription.endDate)}>
                        {getStatusText(subscription.status, subscription.endDate)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {subscription.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelSubscription(subscription.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No hay suscripciones activas</p>
              <p className="text-sm text-gray-500">Asigna un plan para empezar</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionPlanAssignment;