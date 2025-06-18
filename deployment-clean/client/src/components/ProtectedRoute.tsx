import { ReactNode } from 'react';

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
  // SUBSCRIPTION RESTRICTIONS COMPLETELY DISABLED
  // All users have full access to all features
  return <>{children}</>;
}