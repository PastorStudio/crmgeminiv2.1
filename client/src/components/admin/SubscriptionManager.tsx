import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle, XCircle, Clock, Users, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { subscriptionService, type SubscriptionPlan } from '@/services/subscriptionService';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface UserSubscription {
  id: number;
  userId: number;
  planId: number;
  startDate: string;
  endDate: string;
  status: string;
  autoRenewal: boolean;
  notes: string;
  plan: SubscriptionPlan;
  user: { id: number; username: string; email: string; };
}

export function SubscriptionManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState('');

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['/api/subscription-plans'],
    queryFn: async () => {
      const response = await subscriptionService.getAllPlans();
      return response;
    }
  });

  const { data: userSubscriptions = [], isLoading: subscriptionsLoading } = useQuery({
    queryKey: ['/api/user-subscriptions'],
    queryFn: async () => {
      const response = await apiRequest<{ success: boolean; subscriptions: UserSubscription[] }>('/api/user-subscriptions');
      return response.success ? response.subscriptions : [];
    }
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await apiRequest<any[]>('/api/users');
      return response;
    }
  });

  const assignPlanMutation = useMutation({
    mutationFn: async (data: { userId: number; planId: number; durationDays: number; notes: string }) => {
      return await subscriptionService.assignPlanToUser(data.userId, data.planId, data.durationDays, data.notes);
    },
    onSuccess: () => {
      toast({
        title: "Plan asignado",
        description: "El plan de suscripción se ha asignado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user-subscriptions'] });
      setSelectedUserId(null);
      setSelectedPlanId(null);
      setNotes('');
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo asignar el plan de suscripción",
        variant: "destructive",
      });
    }
  });

  const handleAssignPlan = () => {
    if (!selectedUserId || !selectedPlanId) {
      toast({
        title: "Error",
        description: "Selecciona un usuario y un plan",
        variant: "destructive",
      });
      return;
    }

    assignPlanMutation.mutate({
      userId: selectedUserId,
      planId: selectedPlanId,
      durationDays: duration,
      notes
    });
  };

  const getStatusBadge = (status: string, endDate: string) => {
    const now = new Date();
    const end = new Date(endDate);
    const isExpired = end < now;
    const isExpiringSoon = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24) <= 7;

    if (status === 'active' && !isExpired) {
      if (isExpiringSoon) {
        return <Badge variant="outline" className="text-yellow-600"><Clock className="w-3 h-3 mr-1" />Expira pronto</Badge>;
      }
      return <Badge variant="outline" className="text-green-600"><CheckCircle className="w-3 h-3 mr-1" />Activo</Badge>;
    }
    return <Badge variant="outline" className="text-red-600"><XCircle className="w-3 h-3 mr-1" />Expirado</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (plansLoading || subscriptionsLoading || usersLoading) {
    return <div className="p-6">Cargando gestión de suscripciones...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Gestión de Suscripciones</h2>
      </div>

      {/* Assign Plan Section */}
      <Card>
        <CardHeader>
          <CardTitle>Asignar Plan a Usuario</CardTitle>
          <CardDescription>
            Asigna un plan de suscripción a un usuario específico
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="user">Usuario</Label>
              <Select value={selectedUserId?.toString() || ""} onValueChange={(value) => setSelectedUserId(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar usuario" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.username} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan">Plan de Suscripción</Label>
              <Select value={selectedPlanId?.toString() || ""} onValueChange={(value) => setSelectedPlanId(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id.toString()}>
                      {plan.name} - ${plan.price}/{plan.duration_days} días
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duración (días)</Label>
              <Input
                id="duration"
                type="number"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                min="1"
                max="365"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales sobre la asignación..."
              rows={2}
            />
          </div>

          <Button 
            onClick={handleAssignPlan} 
            disabled={assignPlanMutation.isPending || !selectedUserId || !selectedPlanId}
            className="w-full md:w-auto"
          >
            {assignPlanMutation.isPending ? 'Asignando...' : 'Asignar Plan'}
          </Button>
        </CardContent>
      </Card>

      {/* Active Subscriptions */}
      <Card>
        <CardHeader>
          <CardTitle>Suscripciones Activas</CardTitle>
          <CardDescription>
            Gestiona las suscripciones de todos los usuarios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {userSubscriptions.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No hay suscripciones registradas</p>
            ) : (
              userSubscriptions.map((subscription) => (
                <div key={subscription.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div>
                        <h4 className="font-semibold">{subscription.user?.username || `Usuario ${subscription.userId}`}</h4>
                        <p className="text-sm text-gray-600">{subscription.user?.email}</p>
                      </div>
                      {getStatusBadge(subscription.status, subscription.endDate)}
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{subscription.plan?.name}</p>
                      <p className="text-sm text-gray-600">${subscription.plan?.price}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span>Inicio: {formatDate(subscription.startDate)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span>Fin: {formatDate(subscription.endDate)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span>{subscription.plan?.max_users} usuarios</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MessageSquare className="w-4 h-4 text-gray-400" />
                      <span>{subscription.plan?.max_whatsapp_accounts} cuentas</span>
                    </div>
                  </div>

                  {subscription.notes && (
                    <div className="bg-gray-50 p-2 rounded text-sm">
                      <strong>Notas:</strong> {subscription.notes}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}