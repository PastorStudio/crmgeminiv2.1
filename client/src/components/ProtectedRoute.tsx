import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { XCircle, Lock, Crown } from 'lucide-react';
import { useSubscriptionGuard } from '@/hooks/useSubscriptionGuard';
import { SubscriptionStatusComponent } from '@/components/SubscriptionStatus';

interface ProtectedRouteProps {
  children: ReactNode;
  requireFeature?: 'whatsapp' | 'messaging' | 'admin';
  fallbackMessage?: string;
  showSubscriptionStatus?: boolean;
}

export function ProtectedRoute({ 
  children, 
  requireFeature, 
  fallbackMessage,
  showSubscriptionStatus = true 
}: ProtectedRouteProps) {
  const { 
    subscriptionStatus, 
    isLoading, 
    canAccessWhatsApp, 
    canAccessMessaging 
  } = useSubscriptionGuard();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-600">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  // Check specific feature access
  const hasAccess = () => {
    if (!requireFeature) return true;
    
    switch (requireFeature) {
      case 'whatsapp':
        return canAccessWhatsApp;
      case 'messaging':
        return canAccessMessaging;
      case 'admin':
        return subscriptionStatus?.hasActivePlan || false;
      default:
        return true;
    }
  };

  if (!hasAccess()) {
    const getFeatureName = () => {
      switch (requireFeature) {
        case 'whatsapp':
          return 'WhatsApp';
        case 'messaging':
          return 'Mensajería';
        case 'admin':
          return 'Administración';
        default:
          return 'esta función';
      }
    };

    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card className="border-red-200">
          <CardContent className="p-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <Lock className="w-8 h-8 text-red-600" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-gray-900">Acceso Restringido</h2>
              <p className="text-gray-600 max-w-md mx-auto">
                {fallbackMessage || `Tu plan actual no incluye acceso a ${getFeatureName()}. Necesitas una suscripción activa para continuar.`}
              </p>
            </div>

            <Alert className="border-red-200 bg-red-50 text-left max-w-md mx-auto">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Estado:</strong> {subscriptionStatus?.hasActivePlan ? 'Plan activo sin acceso a esta función' : 'Sin suscripción activa'}
              </AlertDescription>
            </Alert>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="outline" onClick={() => window.history.back()}>
                Volver
              </Button>
              <Button 
                className="flex items-center space-x-2"
                onClick={() => {
                  const message = encodeURIComponent('Hola, buenas necesito activar mi plan para utilizar el sistema completo');
                  window.open(`https://wa.me/15517270417?text=${message}`, '_blank');
                }}
              >
                <Crown className="w-4 h-4" />
                <span>Contactar Administrador</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {showSubscriptionStatus && (
          <div className="mt-6">
            <SubscriptionStatusComponent compact={false} showUpgradeButton={true} />
          </div>
        )}
      </div>
    );
  }

  return <>{children}</>;
}