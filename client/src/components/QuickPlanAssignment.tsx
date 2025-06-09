import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Crown, Shield, Zap, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface SubscriptionPlan {
  id: number;
  name: string;
  description: string;
  price: string;
  currency: string;
  duration_days: number;
  features: string[];
  max_users: number;
  max_whatsapp_accounts: number;
  max_chats_per_month: number;
  is_active: boolean;
}

interface QuickPlanAssignmentProps {
  userId: number;
  userName: string;
  currentPlanName?: string;
  currentPlanId?: number;
  daysRemaining?: number;
  onPlanChanged?: () => void;
}

export function QuickPlanAssignment({ 
  userId, 
  userName, 
  currentPlanName, 
  currentPlanId,
  daysRemaining,
  onPlanChanged 
}: QuickPlanAssignmentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch subscription plans
  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['/api/subscription-plans'],
    queryFn: async () => {
      const response = await fetch('/api/subscription-plans', {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('crm_auth_token')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch plans');
      
      const text = await response.text();
      if (!text.trim()) return [];
      
      const data = JSON.parse(text);
      return data.plans || [];
    }
  });

  // Plan assignment mutation
  const assignPlanMutation = useMutation({
    mutationFn: async ({ planId, password }: { planId: number; password: string }) => {
      // First verify admin credentials
      const authResponse = await fetch('/api/auth/verify-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('crm_auth_token')}`
        },
        body: JSON.stringify({ password })
      });

      if (!authResponse.ok) {
        throw new Error('Credenciales de administrador incorrectas');
      }

      // Then assign the plan
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30); // Default 30 days

      const response = await fetch('/api/user-subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('crm_auth_token')}`
        },
        body: JSON.stringify({
          user_id: userId,
          plan_id: planId,
          end_date: endDate.toISOString(),
          notes: `Plan cambiado mediante asignación rápida por administrador`
        })
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Error asignando plan: ${text}`);
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate multiple cache keys to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/subscription-plans'] });
      
      // Force refetch to update UI immediately
      queryClient.refetchQueries({ queryKey: ['/api/users'] });
      
      setIsOpen(false);
      setSelectedPlanId(null);
      setAdminPassword('');
      onPlanChanged?.();
      toast({
        title: "Plan asignado exitosamente",
        description: `El plan ha sido actualizado para ${userName}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleAssignPlan = () => {
    if (!selectedPlanId || !adminPassword) {
      toast({
        title: "Error",
        description: "Selecciona un plan e ingresa la contraseña de administrador",
        variant: "destructive",
      });
      return;
    }

    assignPlanMutation.mutate({ planId: selectedPlanId, password: adminPassword });
  };

  const getPlanIcon = (planName: string) => {
    if (planName.toLowerCase().includes('enterprise')) return Crown;
    if (planName.toLowerCase().includes('pro')) return Shield;
    return Zap;
  };

  const getPlanColor = (planName: string) => {
    if (planName.toLowerCase().includes('enterprise')) return 'bg-purple-500';
    if (planName.toLowerCase().includes('pro')) return 'bg-blue-500';
    return 'bg-green-500';
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 px-2 text-xs min-w-[100px]">
          <div className="flex flex-col items-start">
            <span className="font-medium">{currentPlanName || 'Sin plan'}</span>
            {daysRemaining && (
              <span className="text-xs text-gray-500">
                {daysRemaining === 27233 ? 'Permanente' : `${daysRemaining} días`}
              </span>
            )}
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Cambiar Plan de Suscripción - {userName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Plan */}
          {currentPlanName && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-sm text-gray-700 mb-2">Plan Actual:</h3>
              <Badge variant="secondary" className="text-sm">
                {currentPlanName}
              </Badge>
            </div>
          )}

          {/* Available Plans */}
          <div>
            <h3 className="font-medium text-sm text-gray-700 mb-4">Seleccionar Nuevo Plan:</h3>
            {plansLoading ? (
              <div className="text-center py-8">Cargando planes...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {plans.map((plan: SubscriptionPlan) => {
                  const Icon = getPlanIcon(plan.name);
                  const isSelected = selectedPlanId === plan.id;
                  const isCurrent = currentPlanId === plan.id;
                  
                  return (
                    <Card 
                      key={plan.id} 
                      className={`cursor-pointer transition-all duration-200 ${
                        isSelected 
                          ? 'ring-2 ring-blue-500 shadow-lg' 
                          : isCurrent
                          ? 'ring-2 ring-green-500 opacity-75'
                          : 'hover:shadow-md'
                      }`}
                      onClick={() => !isCurrent && setSelectedPlanId(plan.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full ${getPlanColor(plan.name)} flex items-center justify-center`}>
                              <Icon className="h-4 w-4 text-white" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm">{plan.name}</h4>
                              <p className="text-xs text-gray-500">${plan.price}/{plan.duration_days}d</p>
                            </div>
                          </div>
                          {isCurrent && (
                            <Badge variant="default" className="text-xs">Actual</Badge>
                          )}
                        </div>
                        
                        <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                          {plan.description}
                        </p>
                        
                        <div className="space-y-1">
                          <div className="text-xs text-gray-500">
                            {plan.max_users} usuarios • {plan.max_whatsapp_accounts} cuentas WA
                          </div>
                          <div className="text-xs text-gray-500">
                            {plan.max_chats_per_month.toLocaleString()} mensajes/mes
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Admin Authentication */}
          {selectedPlanId && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="h-4 w-4 text-red-600" />
                <h3 className="font-medium text-sm text-red-800">Autenticación de Administrador Requerida</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="admin-password" className="text-sm text-red-700">
                    Contraseña de Administrador
                  </Label>
                  <Input
                    id="admin-password"
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Ingresa tu contraseña de administrador"
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleAssignPlan}
                    disabled={assignPlanMutation.isPending || !adminPassword}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {assignPlanMutation.isPending ? 'Asignando...' : 'Confirmar Cambio'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedPlanId(null);
                      setAdminPassword('');
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}