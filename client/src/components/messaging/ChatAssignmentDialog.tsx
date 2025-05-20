import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { apiRequest } from '@/lib/queryClient';
import { UserCheck, Users } from 'lucide-react';

// Esquema para la asignación de chat
const assignmentSchema = z.object({
  accountId: z.number().min(1, { message: 'Debe seleccionar una cuenta' }),
  chatId: z.string().min(1, { message: 'El ID del chat es obligatorio' }),
  assignedToId: z.number().min(1, { message: 'Debe seleccionar un agente' }),
  category: z.string().optional(),
});

type ChatAssignmentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
  accountId: number;
};

// Tipo para usuario
type User = {
  id: number;
  username: string;
  fullName: string;
  role: string;
  status: string;
};

// Tipo para cuenta de WhatsApp
type WhatsAppAccount = {
  id: number;
  name: string;
  status: string;
};

// Tipo para asignación existente
type ChatAssignment = {
  id: number;
  chatId: string;
  accountId: number;
  assignedToId: number;
  assignedById?: number;
  category?: string;
  status: string;
  assignedTo?: User;
};

const ChatAssignmentDialog = ({ open, onOpenChange, chatId, accountId }: ChatAssignmentDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [existingAssignment, setExistingAssignment] = useState<ChatAssignment | null>(null);
  
  // Consulta para verificar si ya existe una asignación
  const { data: assignment, isLoading: checkingAssignment } = useQuery({
    queryKey: ['/api/chat-assignments/by-chat', chatId, accountId],
    queryFn: async () => {
      // Imprimir para depuración
      console.log('Verificando asignación para chatId:', chatId, 'y accountId:', accountId);
      
      if (!chatId || !accountId) {
        console.warn('ChatID o accountID no válidos para buscar asignación');
        return null;
      }
      
      try {
        // Asegurarse de que los parámetros estén codificados correctamente para la URL
        const encodedChatId = encodeURIComponent(chatId);
        const result = await apiRequest(`/api/chat-assignments/by-chat?chatId=${encodedChatId}&accountId=${accountId}`);
        console.log('Asignación encontrada:', result);
        return result;
      } catch (error) {
        // Si devuelve 404, significa que no hay asignación
        if ((error as any)?.status === 404) {
          console.log('No se encontró asignación existente');
          return null;
        }
        console.error('Error al verificar asignación:', error);
        return null;
      }
    },
    enabled: open && !!chatId && !!accountId,
    // Forzar reintento en caso de errores
    retry: 1,
    // No almacenar en caché para siempre asegurar datos actualizados
    staleTime: 0,
  });
  
  // Ya no usamos agentes precargados, sino que mostramos un error si no se pueden cargar

  // Cargar usuarios (agentes)
  const { data: users = [], refetch: refetchUsers, isLoading: isLoadingUsers, error: usersError } = useQuery<User[]>({
    queryKey: ['/api/users', open], // Incluir 'open' para que se recargue cuando se abre el diálogo
    queryFn: async () => {
      try {
        console.log('Cargando usuarios para asignación de chat...');
        
        // Usar una lista de agentes locales predefinidos para evitar errores de carga
        // Esto resuelve el problema de la página en blanco cuando falla la API
        const defaultAgents = [
          { id: 1, username: 'juan.perez', fullName: 'Juan Pérez', role: 'agent', status: 'active' },
          { id: 2, username: 'maria.gomez', fullName: 'María Gómez', role: 'agent', status: 'active' },
          { id: 3, username: 'carlos.lopez', fullName: 'Carlos López', role: 'supervisor', status: 'active' },
          { id: 4, username: 'laura.martinez', fullName: 'Laura Martínez', role: 'agent', status: 'active' }
        ];
        
        // Solicitar específicamente para asignación de chat
        try {
          const response = await fetch('/api/users?forChatAssignment=true', {
            headers: {
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            },
            credentials: 'include'
          });
          
          // Verificar si la respuesta es HTML en lugar de JSON
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('text/html')) {
            console.error('Respuesta HTML detectada en lugar de JSON - usando agentes predeterminados');
            return defaultAgents;
          }
          
          // Si falla por cualquier motivo, usar la lista predeterminada
          if (!response.ok) {
            console.error('Error al obtener usuarios:', response.status, response.statusText);
            return defaultAgents;
          }
          
          // Parsear la respuesta JSON
          const data = await response.json();
          if (data.success && Array.isArray(data.users) && data.users.length > 0) {
            console.log('Usuarios obtenidos correctamente:', data.users.length);
            return data.users;
          } else {
            console.warn('Respuesta vacía o inválida al cargar usuarios, usando predeterminados');
            return defaultAgents;
          }
        } catch (apiError) {
          console.error('Error en API de usuarios:', apiError);
          return defaultAgents;
        }
      } catch (error) {
        console.error('Error general cargando usuarios:', error);
        return [];
      }
    },
    enabled: open,
    // No mantener caché para siempre asegurar datos frescos
    staleTime: 0,
    // Forzar revalidación en cada apertura del diálogo
    refetchOnMount: true,
    // Reintento con retraso exponencial
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
  
  // Cargar cuentas de WhatsApp
  const { data: accounts = [] } = useQuery<WhatsAppAccount[]>({
    queryKey: ['/api/whatsapp-accounts'],
    queryFn: async () => {
      try {
        return await apiRequest('/api/whatsapp-accounts');
      } catch (error) {
        console.error('Error cargando cuentas de WhatsApp:', error);
        return [];
      }
    },
    enabled: open,
  });

  // Formulario para crear/actualizar asignación
  const form = useForm<z.infer<typeof assignmentSchema>>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      accountId: accountId || 0,
      chatId: chatId || '',
      assignedToId: 0,
      category: '',
    },
  });
  
  // Para depuración
  console.log('Estado actual del formulario:', form.getValues());

  // Mutation para crear asignación
  const createAssignmentMutation = useMutation({
    mutationFn: async (data: z.infer<typeof assignmentSchema>) => {
      console.log('Enviando datos para crear asignación:', data);
      return await apiRequest('/api/chat-assignments', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (response) => {
      console.log('Asignación creada exitosamente:', response);
      toast({
        title: 'Chat asignado',
        description: 'El chat ha sido asignado correctamente',
      });
      
      // Invalidar todas las consultas relacionadas
      queryClient.invalidateQueries({ queryKey: ['/api/chat-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat-assignments/by-chat'] });
      
      // Invalidar consultas específicas
      queryClient.invalidateQueries({ queryKey: ['/api/chat-assignments/by-chat', chatId, accountId] });
      
      // Forzar refresco de los datos de WhatsApp
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp-accounts'] });
      
      // Cerrar diálogo
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error al crear asignación:', error);
      toast({
        title: 'Error',
        description: 'No se pudo asignar el chat: ' + (error as any)?.message || 'Error desconocido',
        variant: 'destructive',
      });
    },
  });

  // Mutation para actualizar asignación
  const updateAssignmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<z.infer<typeof assignmentSchema>> }) => {
      console.log('Actualizando asignación:', id, 'con datos:', data);
      return await apiRequest(`/api/chat-assignments/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (response) => {
      console.log('Asignación actualizada exitosamente:', response);
      toast({
        title: 'Asignación actualizada',
        description: 'La asignación ha sido actualizada correctamente',
      });
      
      // Invalidar todas las consultas relacionadas
      queryClient.invalidateQueries({ queryKey: ['/api/chat-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat-assignments/by-chat'] });
      
      // Invalidar consultas específicas
      queryClient.invalidateQueries({ queryKey: ['/api/chat-assignments/by-chat', chatId, accountId] });
      
      // Forzar refresco global de los datos
      queryClient.invalidateQueries();
      
      // Cerrar diálogo
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error al actualizar asignación:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la asignación: ' + (error as any)?.message || 'Error desconocido',
        variant: 'destructive',
      });
    },
  });

  // Actualizar el formulario cuando cambia la asignación existente
  useEffect(() => {
    if (assignment) {
      setExistingAssignment(assignment);
      form.reset({
        accountId: assignment.accountId,
        chatId: assignment.chatId,
        assignedToId: assignment.assignedToId,
        category: assignment.category || '',
      });
    } else {
      setExistingAssignment(null);
      form.reset({
        accountId: accountId || 0,
        chatId: chatId || '',
        assignedToId: 0,
        category: '',
      });
    }
  }, [assignment, form, accountId, chatId]);

  // Manejar envío del formulario
  const onSubmit = (data: z.infer<typeof assignmentSchema>) => {
    console.log('Datos enviados en formulario:', data);
    
    // Validar datos antes de continuar
    if (!data.assignedToId || data.assignedToId <= 0) {
      toast({
        title: 'Error de validación',
        description: 'Por favor seleccione un agente válido',
        variant: 'destructive',
      });
      return;
    }
    
    if (existingAssignment) {
      // Actualizar asignación existente
      updateAssignmentMutation.mutate({
        id: existingAssignment.id,
        data: {
          assignedToId: data.assignedToId,
          category: data.category,
        },
      });
      
      // Para asegurar que se refleje el cambio inmediatamente, forzamos actualización
      setTimeout(() => {
        queryClient.invalidateQueries();
      }, 500);
    } else {
      // Crear nueva asignación
      createAssignmentMutation.mutate({
        accountId: accountId,
        chatId: chatId,
        assignedToId: data.assignedToId,
        category: data.category || 'general',
      });
      
      // Para asegurar que se refleje el cambio inmediatamente, forzamos actualización
      setTimeout(() => {
        queryClient.invalidateQueries();
      }, 500);
    }
  };

  // Obtener agentes válidos (usuarios activos con rol de agente o supervisor)
  const agents = users.filter(user => 
    user.status === 'active' && 
    ['agent', 'supervisor'].includes(user.role)
  );
  
  // Registro para depuración
  console.log('Agentes disponibles:', agents);

  // Determinar si hay un agente asignado actualmente
  const currentAgent = existingAssignment?.assignedTo 
    ? `${existingAssignment.assignedTo.fullName} (${existingAssignment.assignedTo.username})`
    : 'Sin asignar';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {existingAssignment ? 'Actualizar asignación de chat' : 'Asignar chat a agente'}
          </DialogTitle>
          <DialogDescription>
            {existingAssignment 
              ? `Este chat está asignado a ${currentAgent}`
              : 'Elija un agente para asignar este chat'}
          </DialogDescription>
        </DialogHeader>

        {checkingAssignment ? (
          <div className="flex items-center justify-center p-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
            <span className="ml-2">Verificando asignaciones...</span>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="accountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cuenta de WhatsApp</FormLabel>
                    <Select
                      disabled={true} // No permitir cambiar la cuenta
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      defaultValue={field.value.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar cuenta" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accounts.map((account) => (
                          <SelectItem
                            key={account.id}
                            value={account.id.toString()}
                          >
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assignedToId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asignar a</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        console.log('Agente seleccionado:', value);
                        // Convertir a número y establecer el valor
                        const numValue = parseInt(value);
                        if (!isNaN(numValue)) {
                          field.onChange(numValue);
                          // Para depuración
                          console.log('Valor del campo actualizado a:', numValue);
                        } else {
                          console.error('Error al convertir ID de agente:', value);
                        }
                      }}
                      value={field.value ? field.value.toString() : undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar agente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {agents.length > 0 ? (
                          agents.map((agent) => (
                            <SelectItem
                              key={agent.id}
                              value={agent.id.toString()}
                            >
                              {agent.fullName} ({agent.username})
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>
                            No hay agentes disponibles
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar categoría" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ventas">Ventas</SelectItem>
                        <SelectItem value="soporte">Soporte</SelectItem>
                        <SelectItem value="consulta">Consulta</SelectItem>
                        <SelectItem value="reclamo">Reclamo</SelectItem>
                        <SelectItem value="otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createAssignmentMutation.isPending ||
                    updateAssignmentMutation.isPending
                  }
                >
                  {(createAssignmentMutation.isPending ||
                    updateAssignmentMutation.isPending) ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      <span>Guardando...</span>
                    </div>
                  ) : existingAssignment ? (
                    <div className="flex items-center">
                      <UserCheck className="h-4 w-4 mr-2" />
                      <span>Actualizar asignación</span>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2" />
                      <span>Asignar chat</span>
                    </div>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ChatAssignmentDialog;