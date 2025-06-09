import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Users, Shield, Database, Eye, Settings, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UserProfile {
  id: number;
  username: string;
  role: string;
  canAccessAll: boolean;
  assignedAccountsCount: number;
}

interface AccountData {
  id: number;
  name: string;
  status: string;
  organizationId?: number;
}

interface LeadData {
  id: number;
  name: string;
  status: string;
  whatsappAccountId: number;
}

interface DashboardStats {
  totalAccounts: number;
  totalLeads: number;
  totalConversations: number;
  activeConversations: number;
}

const UserDataIsolationDemo: React.FC = () => {
  const { toast } = useToast();
  
  const [selectedUser, setSelectedUser] = useState<string>('superadmin');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);

  const testUsers = [
    { value: 'superadmin', label: 'DJP (Superadmin)', role: 'superadmin' },
    { value: 'admin', label: 'Admin', role: 'admin' },
    { value: 'manager', label: 'Manager1', role: 'manager' },
    { value: 'agent', label: 'Agent1', role: 'agent' },
    { value: 'agent2', label: 'Agent2', role: 'agent' },
    { value: 'demo', label: 'Demo User', role: 'supervisor' }
  ];

  const fetchUserData = async (userType: string) => {
    setLoading(true);
    try {
      // Fetch user profile
      const profileResponse = await fetch(`/api/isolated/profile?testUser=${userType}`);
      const profileData = await profileResponse.json();
      
      if (profileData.success) {
        setUserProfile({
          id: profileData.profile.id,
          username: profileData.profile.username,
          role: profileData.profile.role,
          canAccessAll: profileData.profile.accessLevel?.canAccessAll || false,
          assignedAccountsCount: profileData.profile.accessLevel?.assignedAccountsCount || 0
        });
      }

      // Fetch accounts accessible to user
      const accountsResponse = await fetch(`/api/isolated/accounts?testUser=${userType}`);
      const accountsData = await accountsResponse.json();
      
      if (accountsData.success) {
        setAccounts(accountsData.accounts || []);
      }

      // Fetch leads accessible to user
      const leadsResponse = await fetch(`/api/isolated/leads?testUser=${userType}`);
      const leadsData = await leadsResponse.json();
      
      if (leadsData.success) {
        setLeads(leadsData.leads || []);
      }

      // Fetch dashboard stats
      const statsResponse = await fetch(`/api/isolated/dashboard/stats?testUser=${userType}`);
      const statsData = await statsResponse.json();
      
      if (statsData.success) {
        setStats(statsData.stats);
      }

      toast({
        title: "Datos cargados",
        description: `Información del usuario ${userType} cargada correctamente`,
      });
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos del usuario",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData(selectedUser);
  }, [selectedUser]);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'superadmin': return 'bg-purple-100 text-purple-800';
      case 'admin': return 'bg-red-100 text-red-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      case 'agent': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const currentUser = testUsers.find(u => u.value === selectedUser);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Demo: Aislamiento de Datos por Usuario</h1>
          <p className="text-gray-500">Comprueba cómo cada usuario ve solo sus datos asignados</p>
        </div>
        <Badge variant="outline" className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Sistema Multi-Tenant Activo
        </Badge>
      </div>

      {/* User Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Seleccionar Usuario de Prueba
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Seleccionar usuario" />
              </SelectTrigger>
              <SelectContent>
                {testUsers.map((user) => (
                  <SelectItem key={user.value} value={user.value}>
                    {user.label} ({user.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              onClick={() => fetchUserData(selectedUser)} 
              disabled={loading}
              variant="outline"
            >
              {loading ? 'Cargando...' : 'Recargar Datos'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* User Profile Summary */}
      {userProfile && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Perfil del Usuario: {currentUser?.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Usuario</p>
                <p className="text-lg font-semibold">{userProfile.username}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Rol</p>
                <Badge className={getRoleBadgeColor(userProfile.role)}>{userProfile.role}</Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Acceso</p>
                <Badge variant={userProfile.canAccessAll ? "default" : "secondary"}>
                  {userProfile.canAccessAll ? "Completo" : "Limitado"}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Cuentas Asignadas</p>
                <p className="text-lg font-semibold">{userProfile.assignedAccountsCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Access Demonstration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Accounts Access */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Cuentas WhatsApp Accesibles
              <Badge variant="outline">{accounts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {accounts.length > 0 ? (
              <div className="space-y-3">
                {accounts.map((account) => (
                  <div key={account.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{account.name}</h4>
                        <p className="text-xs text-gray-500">ID: {account.id}</p>
                      </div>
                      <Badge 
                        variant={account.status === 'active' ? 'default' : 'secondary'}
                        size="sm"
                      >
                        {account.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                <p>Sin cuentas asignadas</p>
                <p className="text-xs">Este usuario no tiene acceso a ninguna cuenta WhatsApp</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leads Access */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Leads Accesibles
              <Badge variant="outline">{leads.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leads.length > 0 ? (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {leads.slice(0, 5).map((lead) => (
                  <div key={lead.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{lead.name}</h4>
                        <p className="text-xs text-gray-500">Cuenta ID: {lead.whatsappAccountId}</p>
                      </div>
                      <Badge variant="outline" size="sm">
                        {lead.status}
                      </Badge>
                    </div>
                  </div>
                ))}
                {leads.length > 5 && (
                  <p className="text-xs text-gray-500 text-center">
                    ... y {leads.length - 5} más
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                <p>Sin leads asignados</p>
                <p className="text-xs">Este usuario no tiene acceso a ningún lead</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dashboard Stats */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Estadísticas del Dashboard (Filtradas por Usuario)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{stats.totalAccounts}</p>
                <p className="text-sm text-gray-500">Cuentas Totales</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{stats.totalLeads}</p>
                <p className="text-sm text-gray-500">Leads Totales</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{stats.totalConversations}</p>
                <p className="text-sm text-gray-500">Conversaciones</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{stats.activeConversations}</p>
                <p className="text-sm text-gray-500">Activas (24h)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Notice */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-800">Sistema de Seguridad Activo</h4>
              <p className="text-sm text-yellow-700 mt-1">
                Cada usuario ve únicamente los datos a los que tiene acceso según sus asignaciones. 
                Los superadministradores y administradores pueden ver todos los datos del sistema, 
                mientras que los usuarios regulares solo ven sus datos asignados.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserDataIsolationDemo;