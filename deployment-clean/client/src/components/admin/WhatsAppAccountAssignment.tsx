import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, Shield, Plus, Trash2, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface User {
  id: number;
  username: string;
  fullName: string;
  role: string;
  status: string;
}

interface WhatsAppAccount {
  id: number;
  name: string;
  status: string;
  ownerPhone: string;
}

interface Assignment {
  id: number;
  userId: number;
  whatsappAccountId: number;
  role: string;
  isActive: boolean;
  assignedAt: string;
  userName: string;
  userFullName: string;
  accountName: string;
}

const WhatsAppAccountAssignment: React.FC = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('operator');
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load users
      const usersResponse = await apiRequest('/api/users');
      if (usersResponse.success) {
        const regularUsers = usersResponse.users.filter((user: User) => 
          user.role !== 'superadmin' && user.role !== 'super_admin' && user.status === 'active'
        );
        setUsers(regularUsers);
      }

      // Load all WhatsApp accounts (only admins can access this)
      const accountsResponse = await fetch('/api/whatsapp-accounts');
      const accountsData = await accountsResponse.json();
      if (accountsData.success) {
        setAccounts(accountsData.accounts);
      }

      // Load current assignments
      const assignmentsResponse = await apiRequest('/api/user-account-assignments');
      if (assignmentsResponse.success) {
        setAssignments(assignmentsResponse.assignments);
      }
    } catch (error) {
      console.error('Error loading assignment data:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos de asignación",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssignAccount = async () => {
    if (!selectedUser || !selectedAccount) {
      toast({
        title: "Error",
        description: "Selecciona un usuario y una cuenta de WhatsApp",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await apiRequest('/api/assign-whatsapp-account', {
        method: 'POST',
        body: JSON.stringify({
          userId: parseInt(selectedUser),
          whatsappAccountId: parseInt(selectedAccount),
          role: selectedRole
        })
      });

      if (response.success) {
        toast({
          title: "Asignación exitosa",
          description: response.message,
        });
        setDialogOpen(false);
        setSelectedUser('');
        setSelectedAccount('');
        setSelectedRole('operator');
        loadData(); // Reload assignments
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      console.error('Error assigning account:', error);
      toast({
        title: "Error",
        description: "No se pudo asignar la cuenta de WhatsApp",
        variant: "destructive",
      });
    }
  };

  const handleRemoveAssignment = async (userId: number, accountId: number) => {
    try {
      const response = await apiRequest(`/api/assign-whatsapp-account/${userId}/${accountId}`, {
        method: 'DELETE'
      });

      if (response.success) {
        toast({
          title: "Asignación eliminada",
          description: response.message,
        });
        loadData(); // Reload assignments
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      console.error('Error removing assignment:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la asignación",
        variant: "destructive",
      });
    }
  };

  const getAvailableAccounts = () => {
    const assignedAccountIds = assignments.map(a => a.whatsappAccountId);
    return accounts.filter(account => !assignedAccountIds.includes(account.id));
  };

  const getAvailableUsers = () => {
    if (!selectedAccount) return users;
    const assignedUserIds = assignments
      .filter(a => a.whatsappAccountId === parseInt(selectedAccount))
      .map(a => a.userId);
    return users.filter(user => !assignedUserIds.includes(user.id));
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'manager': return 'bg-blue-100 text-blue-800';
      case 'operator': return 'bg-green-100 text-green-800';
      case 'supervisor': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Asignación de Cuentas WhatsApp</h2>
          <p className="text-gray-600">Gestiona qué usuarios pueden acceder a cada cuenta de WhatsApp</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nueva Asignación
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Asignar Cuenta WhatsApp</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Cuenta de WhatsApp
                </label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableAccounts().map(account => (
                      <SelectItem key={account.id} value={account.id.toString()}>
                        {account.name} ({account.ownerPhone})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Usuario
                </label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar usuario" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableUsers().map(user => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.fullName} ({user.username}) - {user.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Rol en la cuenta
                </label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operator">Operador</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleAssignAccount} className="flex-1">
                  Asignar Cuenta
                </Button>
                <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Asignaciones Actuales
            <Badge variant="outline">{assignments.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-gray-600">Cargando asignaciones...</p>
            </div>
          ) : assignments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Cuenta WhatsApp</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Fecha Asignación</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{assignment.userFullName}</p>
                        <p className="text-sm text-gray-500">@{assignment.userName}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{assignment.accountName}</p>
                    </TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(assignment.role)}>
                        {assignment.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(assignment.assignedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={assignment.isActive ? "default" : "secondary"}>
                        {assignment.isActive ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveAssignment(assignment.userId, assignment.whatsappAccountId)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No hay asignaciones configuradas</p>
              <p className="text-sm text-gray-500">Crea una nueva asignación para empezar</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-800">Gestión de Acceso</h4>
              <p className="text-sm text-yellow-700 mt-1">
                Solo los usuarios con cuentas asignadas pueden ver y gestionar conversaciones de esas cuentas específicas. 
                Los superadministradores y administradores mantienen acceso completo a todas las cuentas.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppAccountAssignment;