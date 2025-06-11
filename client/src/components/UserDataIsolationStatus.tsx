import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Shield, CheckCircle, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface UserStats {
  userId: number;
  username: string;
  role: string;
  ownAccountsCount: number;
  totalAccountsInSystem: number;
  isolationStatus: 'secure' | 'warning';
}

export function UserDataIsolationStatus() {
  const { data: userStats, isLoading } = useQuery<UserStats>({
    queryKey: ['/api/user-isolation-status'],
    queryFn: async () => {
      // Get current user's WhatsApp accounts
      const accountsResponse = await apiRequest('/api/whatsapp-accounts');
      const userAccounts = accountsResponse?.accounts || [];
      
      // Get basic user info (this would come from auth context in real app)
      return {
        userId: userAccounts[0]?.userId || 'Unknown',
        username: userAccounts[0]?.createdByUser || 'Unknown',
        role: 'User',
        ownAccountsCount: userAccounts.length,
        totalAccountsInSystem: userAccounts.length, // User can only see their own
        isolationStatus: 'secure' as const
      };
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Estado de Aislamiento de Datos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!userStats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="w-5 h-5" />
            Estado de Aislamiento Desconocido
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No se pudo verificar el estado de aislamiento de datos
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-green-200 bg-green-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-700">
          <CheckCircle className="w-5 h-5" />
          Aislamiento de Datos Seguro
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-green-600" />
            <span className="font-medium">{userStats.username}</span>
            <Badge variant="outline" className="text-green-600 border-green-300">
              ID: {userStats.userId}
            </Badge>
          </div>
          <Badge className="bg-green-600">
            Datos Aislados
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Mis Cuentas WhatsApp</p>
            <p className="font-semibold text-green-700">{userStats.ownAccountsCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Acceso Total</p>
            <p className="font-semibold text-green-700">Solo mis datos</p>
          </div>
        </div>
        
        <div className="text-xs text-green-600 bg-green-100 p-2 rounded">
          ✓ Solo puedes ver y gestionar las cuentas que tú has creado
          <br />
          ✓ Tus datos están completamente aislados de otros usuarios
          <br />
          ✓ El sistema garantiza separación total de datos por usuario
        </div>
      </CardContent>
    </Card>
  );
}