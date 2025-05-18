import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/authContext';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Loader2, MoreHorizontal, PlusCircle, UserPlus, UserX, Edit, Trash } from 'lucide-react';

// Definir tipo para usuarios
interface User {
  id: number;
  username: string;
  fullName?: string;
  email?: string;
  role?: string;
  status?: string;
  department?: string;
  avatar?: string;
  lastLoginAt?: string;
}

// Definir esquema para validar formularios
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const userFormSchema = z.object({
  username: z.string().min(3, "El nombre de usuario debe tener al menos 3 caracteres"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  fullName: z.string().min(3, "El nombre completo debe tener al menos 3 caracteres"),
  email: z.string().email("Debe ser un correo electrónico válido"),
  role: z.string().refine(val => ['admin', 'agent', 'supervisor'].includes(val), {
    message: "El rol debe ser admin, agent o supervisor"
  }),
  department: z.string().optional(),
  status: z.string().refine(val => ['active', 'inactive', 'suspended'].includes(val), {
    message: "El estado debe ser active, inactive o suspended"
  }),
});

type UserFormValues = z.infer<typeof userFormSchema>;

const defaultValues: Partial<UserFormValues> = {
  role: "agent",
  status: "active",
  department: "ventas",
};

export default function UserManagement() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Form para crear/editar usuarios
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues,
  });

  // Obtener lista de usuarios
  const { data: users, isLoading } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('crm_auth_token')}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'No se pudo obtener la lista de usuarios');
      }
      
      const data = await response.json();
      return data.success && data.users ? data.users : [];
    },
    enabled: !!currentUser // Solo cargar si hay un usuario autenticado
  });

  // Mutación para crear usuario
  const createUserMutation = useMutation({
    mutationFn: async (userData: UserFormValues) => {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('crm_auth_token')}`
        },
        body: JSON.stringify(userData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al crear usuario');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsDialogOpen(false);
      form.reset(defaultValues);
      toast({
        title: "Usuario creado",
        description: data.message || "El usuario ha sido creado exitosamente",
      });
    },
    onError: (error: Error) => {
      console.error('Error al crear usuario:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el usuario",
        variant: "destructive",
      });
    }
  });

  // Mutación para actualizar usuario
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, userData }: { id: number, userData: Partial<UserFormValues> }) => {
      const response = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('crm_auth_token')}`
        },
        body: JSON.stringify(userData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al actualizar usuario');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsDialogOpen(false);
      setSelectedUser(null);
      form.reset(defaultValues);
      toast({
        title: "Usuario actualizado",
        description: data.message || "El usuario ha sido actualizado exitosamente",
      });
    },
    onError: (error: Error) => {
      console.error('Error al actualizar usuario:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el usuario",
        variant: "destructive",
      });
    }
  });

  // Mutación para eliminar usuario
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('crm_auth_token')}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al eliminar usuario');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
      toast({
        title: "Usuario eliminado",
        description: data.message || "El usuario ha sido eliminado exitosamente",
      });
    },
    onError: (error: Error) => {
      console.error('Error al eliminar usuario:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el usuario",
        variant: "destructive",
      });
    }
  });

  // Función para abrir formulario de edición
  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    form.reset({
      username: user.username,
      fullName: user.fullName || '',
      email: user.email || '',
      role: user.role || 'agent',
      department: user.department || '',
      status: user.status || 'active',
      // No incluimos la contraseña, para no sobrescribirla si no se cambia
      password: '', // Campo vacío para no forzar cambio de contraseña
    });
    setIsDialogOpen(true);
  };

  // Función para abrir diálogo de eliminación
  const openDeleteDialog = (user: User) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  // Submit del formulario
  const onSubmit = (values: UserFormValues) => {
    if (selectedUser) {
      // Si no se proporciona contraseña, creamos un objeto nuevo sin ella
      const userData: Partial<UserFormValues> = {};
      
      // Copiar solo los campos con valores válidos
      Object.keys(values).forEach(key => {
        // No incluir contraseña vacía
        if (key === 'password' && (!values[key as keyof typeof values] || (values[key as keyof typeof values] as string).trim() === '')) {
          return;
        }
        // Utilizar tipado seguro para acceder a las propiedades
        if (key in values) {
          (userData as any)[key] = values[key as keyof typeof values];
        }
      });
      
      updateUserMutation.mutate({ id: selectedUser.id, userData });
    } else {
      createUserMutation.mutate(values);
    }
  };

  // Determinar si el usuario actual puede gestionar usuarios
  const canManageUsers = currentUser?.role === 'admin' || currentUser?.role === 'supervisor';

  // Renderizado condicional basado en permisos
  if (!canManageUsers) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Acceso Denegado</CardTitle>
            <CardDescription>
              No tienes permisos para acceder a la gestión de usuarios.
              Esta funcionalidad está reservada para administradores y supervisores.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestión de Agentes</h1>
          <p className="text-muted-foreground">
            Administra los agentes que atenderán los chats de WhatsApp
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/users'] })}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualizar Lista
          </Button>
          <Button onClick={() => {
            setSelectedUser(null);
            form.reset({
              ...defaultValues,
              role: "agent", // Por defecto, crear un agente
              status: "active", // Activo por defecto
              department: "ventas" // Departamento por defecto
            });
            setIsDialogOpen(true);
          }}>
            <UserPlus className="mr-2 h-4 w-4" />
            Nuevo Agente
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users && users.length > 0 ? (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>{user.fullName || '-'}</TableCell>
                      <TableCell>{user.email || '-'}</TableCell>
                      <TableCell>
                        <Badge
                          variant={user.role === 'admin' ? 'destructive' : user.role === 'supervisor' ? 'default' : 'outline'}
                        >
                          {user.role === 'admin' ? 'Administrador' : 
                           user.role === 'supervisor' ? 'Supervisor' : 
                           'Agente'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.status === 'active' ? 'default' : user.status === 'inactive' ? 'secondary' : 'destructive'}
                          className={user.status === 'active' ? 'bg-green-500 hover:bg-green-600' : ''}
                        >
                          {user.status === 'active' ? 'Activo' : 
                           user.status === 'inactive' ? 'Inactivo' : 
                           'Suspendido'}
                        </Badge>
                      </TableCell>
                      <TableCell>{user.department || '-'}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openEditDialog(user)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => openDeleteDialog(user)}
                              className="text-destructive focus:text-destructive"
                              disabled={user.id === currentUser?.id} // No permitir eliminar al usuario actual
                            >
                              <Trash className="mr-2 h-4 w-4" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6">
                      No hay usuarios registrados
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Diálogo para crear/editar usuario */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedUser ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
            </DialogTitle>
            <DialogDescription>
              {selectedUser 
                ? 'Modifica los datos del usuario seleccionado.' 
                : 'Completa el formulario para crear un nuevo usuario.'}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de Usuario</FormLabel>
                    <FormControl>
                      <Input placeholder="usuario" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{selectedUser ? 'Nueva Contraseña (opcional)' : 'Contraseña'}</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="••••••••" 
                        {...field} 
                      />
                    </FormControl>
                    {selectedUser && (
                      <FormDescription>
                        Deja en blanco para mantener la contraseña actual.
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Juan Pérez" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo Electrónico</FormLabel>
                    <FormControl>
                      <Input placeholder="usuario@ejemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rol</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un rol" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">Administrador</SelectItem>
                          <SelectItem value="supervisor">Supervisor</SelectItem>
                          <SelectItem value="agent">Agente</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un estado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Activo</SelectItem>
                          <SelectItem value="inactive">Inactivo</SelectItem>
                          <SelectItem value="suspended">Suspendido</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Departamento</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      value={field.value || ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un departamento" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ventas">Ventas</SelectItem>
                        <SelectItem value="soporte">Soporte</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="administracion">Administración</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  disabled={createUserMutation.isPending || updateUserMutation.isPending}
                >
                  {(createUserMutation.isPending || updateUserMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {selectedUser ? 'Actualizar' : 'Crear'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo de confirmación para eliminar */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar al usuario <strong>{selectedUser?.username}</strong>?
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => selectedUser && deleteUserMutation.mutate(selectedUser.id)}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}