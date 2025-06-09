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

  const canAccessWhatsApp = true; // UNRESTRICTED ACCESS
  const canAccessMessaging = true; // UNRESTRICTED ACCESS
  const isExpiringSoon = false; // NO EXPIRY WARNINGS
  const isExpiredSoon = false; // NO EXPIRY WARNINGS

  useEffect(() => {
    // SUBSCRIPTION WARNINGS DISABLED - NO TOASTS OR RESTRICTIONS
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
    return true; // UNRESTRICTED ACCESS
  };

  const checkMessagingAccess = () => {
    return true; // UNRESTRICTED ACCESS
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