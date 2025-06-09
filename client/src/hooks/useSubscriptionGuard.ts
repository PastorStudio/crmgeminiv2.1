import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { subscriptionService } from '@/services/subscriptionService';
import { useQuery } from '@tanstack/react-query';

export function useSubscriptionGuard() {
  const { toast } = useToast();
  const [hasShownWarning, setHasShownWarning] = useState(false);

  const { data: subscriptionStatus, isLoading } = useQuery({
    queryKey: ['/api/subscription-status'],
    queryFn: () => subscriptionService.getSubscriptionStatus(),
    refetchInterval: 60000, // Check every minute
    staleTime: 30000, // Consider data stale after 30 seconds
  });

  const canAccessWhatsApp = subscriptionStatus?.hasActivePlan || false;
  const canAccessMessaging = subscriptionStatus?.hasActivePlan || false;
  const isExpiringSoon = (subscriptionStatus?.daysRemaining || 0) <= 7;
  const isExpiredSoon = (subscriptionStatus?.daysRemaining || 0) <= 1;

  useEffect(() => {
    if (!isLoading && subscriptionStatus) {
      // Show warning toast for expiring subscriptions
      if (isExpiredSoon && !hasShownWarning) {
        toast({
          title: "¡Suscripción expirando!",
          description: `Tu plan expira en ${subscriptionStatus.daysRemaining} día${subscriptionStatus.daysRemaining !== 1 ? 's' : ''}. El acceso a WhatsApp se deshabilitará.`,
          variant: "destructive",
        });
        setHasShownWarning(true);
      } else if (isExpiringSoon && !isExpiredSoon && !hasShownWarning) {
        toast({
          title: "Suscripción expirando pronto",
          description: `Tu plan ${subscriptionStatus.planName} expira en ${subscriptionStatus.daysRemaining} días.`,
          variant: "default",
        });
        setHasShownWarning(true);
      }

      // Show access blocked notification
      if (!subscriptionStatus.hasActivePlan && !hasShownWarning) {
        toast({
          title: "Acceso restringido",
          description: "Tu suscripción ha expirado. El acceso a WhatsApp y mensajería está bloqueado.",
          variant: "destructive",
        });
        setHasShownWarning(true);
      }
    }
  }, [subscriptionStatus, isLoading, isExpiringSoon, isExpiredSoon, hasShownWarning, toast]);

  // Reset warning flag when subscription status changes significantly
  useEffect(() => {
    if (subscriptionStatus?.hasActivePlan && hasShownWarning) {
      setHasShownWarning(false);
    }
  }, [subscriptionStatus?.hasActivePlan, hasShownWarning]);

  const blockAccess = (feature: string) => {
    toast({
      title: "Acceso bloqueado",
      description: `Tu suscripción no permite acceso a ${feature}. Contacta al administrador para actualizar tu plan.`,
      variant: "destructive",
    });
  };

  const checkWhatsAppAccess = () => {
    if (!canAccessWhatsApp) {
      blockAccess("WhatsApp");
      return false;
    }
    return true;
  };

  const checkMessagingAccess = () => {
    if (!canAccessMessaging) {
      blockAccess("funciones de mensajería");
      return false;
    }
    return true;
  };

  return {
    subscriptionStatus,
    isLoading,
    canAccessWhatsApp,
    canAccessMessaging,
    isExpiringSoon,
    isExpiredSoon,
    checkWhatsAppAccess,
    checkMessagingAccess,
    blockAccess,
  };
}