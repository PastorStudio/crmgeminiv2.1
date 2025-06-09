import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Clock, Crown, MessageSquare, Users, Calendar, AlertTriangle } from 'lucide-react';
import { subscriptionService, type SubscriptionStatus } from '@/services/subscriptionService';
import { useQuery } from '@tanstack/react-query';

interface SubscriptionStatusProps {
  userId?: number;
  showUpgradeButton?: boolean;
  compact?: boolean;
}

export function SubscriptionStatusComponent({ userId, showUpgradeButton = true, compact = false }: SubscriptionStatusProps) {
  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['/api/subscription-status', userId],
    queryFn: async () => {
      return await subscriptionService.getSubscriptionStatus(userId);
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  useEffect(() => {
    if (status) {
      subscriptionService.clearCache();
    }
  }, [status]);

  if (isLoading) {
    return (
      <Card className={compact ? "p-4" : ""}>
        <CardContent className={compact ? "p-0" : ""}>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-gray-200 rounded animate-pulse"></div>
            <span className="text-sm text-gray-500">Cargando estado de suscripción...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!status?.hasActivePlan) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <XCircle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          <div className="flex items-center justify-between">
            <div>
              <strong>Sin suscripción activa</strong>
              <p className="text-sm mt-1">Tu acceso a WhatsApp y mensajería está limitado</p>
            </div>
            {showUpgradeButton && (
              <Button size="sm" variant="destructive">
                Actualizar Plan
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  const isExpiringSoon = status.daysRemaining !== undefined && status.daysRemaining <= 7;
  const isExpiredSoon = status.daysRemaining !== undefined && status.daysRemaining <= 1;

  if (compact) {
    return (
      <div className="flex items-center space-x-2 text-sm">
        {isExpiredSoon ? (
          <XCircle className="h-4 w-4 text-red-500" />
        ) : isExpiringSoon ? (
          <Clock className="h-4 w-4 text-yellow-500" />
        ) : (
          <CheckCircle className="h-4 w-4 text-green-500" />
        )}
        <span className={isExpiredSoon ? "text-red-600" : isExpiringSoon ? "text-yellow-600" : "text-green-600"}>
          {status.planName} - {status.daysRemaining} días restantes
        </span>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2">
          <Crown className="h-5 w-5 text-yellow-500" />
          <span>Estado de Suscripción</span>
        </CardTitle>
        <CardDescription>
          Información actual de tu plan y acceso
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Plan Status */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold">{status.planName}</h4>
            <p className="text-sm text-gray-600">Plan activo</p>
          </div>
          {isExpiredSoon ? (
            <Badge variant="destructive" className="flex items-center space-x-1">
              <XCircle className="w-3 h-3" />
              <span>Expira en {status.daysRemaining} día{status.daysRemaining !== 1 ? 's' : ''}</span>
            </Badge>
          ) : isExpiringSoon ? (
            <Badge variant="outline" className="text-yellow-600 border-yellow-600 flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>Expira en {status.daysRemaining} días</span>
            </Badge>
          ) : (
            <Badge variant="outline" className="text-green-600 border-green-600 flex items-center space-x-1">
              <CheckCircle className="w-3 h-3" />
              <span>Activo ({status.daysRemaining} días)</span>
            </Badge>
          )}
        </div>

        {/* Expiration Warning */}
        {isExpiringSoon && (
          <Alert className={isExpiredSoon ? "border-red-200 bg-red-50" : "border-yellow-200 bg-yellow-50"}>
            <AlertTriangle className={`h-4 w-4 ${isExpiredSoon ? "text-red-600" : "text-yellow-600"}`} />
            <AlertDescription className={isExpiredSoon ? "text-red-800" : "text-yellow-800"}>
              <strong>¡Atención!</strong> Tu suscripción expira en {status.daysRemaining} día{status.daysRemaining !== 1 ? 's' : ''}. 
              {isExpiredSoon && " El acceso a WhatsApp se deshabilitará automáticamente."}
            </AlertDescription>
          </Alert>
        )}

        {/* Plan Limits */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
            <MessageSquare className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-sm font-medium">{status.maxWhatsappAccounts} Cuentas WhatsApp</p>
              <p className="text-xs text-gray-600">Límite del plan</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
            <Users className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-sm font-medium">{status.maxUsers} Usuarios</p>
              <p className="text-xs text-gray-600">Máximo permitido</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
            <Calendar className="h-4 w-4 text-purple-500" />
            <div>
              <p className="text-sm font-medium">{status.maxChatsPerMonth?.toLocaleString()} Chats/mes</p>
              <p className="text-xs text-gray-600">Límite mensual</p>
            </div>
          </div>
        </div>

        {/* Features */}
        {status.planFeatures && status.planFeatures.length > 0 && (
          <div>
            <h5 className="font-medium mb-2">Funciones incluidas:</h5>
            <div className="flex flex-wrap gap-2">
              {status.planFeatures.map((feature, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {feature}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Expiration Date */}
        <div className="pt-3 border-t">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Expira el:</span>
            <span className="font-medium">
              {status.expiresAt ? new Date(status.expiresAt).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }) : 'N/A'}
            </span>
          </div>
        </div>

        {/* Upgrade Button */}
        {showUpgradeButton && isExpiringSoon && (
          <Button className="w-full" variant={isExpiredSoon ? "destructive" : "default"}>
            {isExpiredSoon ? "Renovar Ahora" : "Extender Suscripción"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}