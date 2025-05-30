import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  // Sistema de asignación de agentes interno - Usa agentes reales del sistema
  
  // Estado local para usar agentes reales del sistema
  const [agentsList, setAgentsList] = useState<User[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [existingAssignment, setExistingAssignment] = useState<ChatAssignment | null>(null);
  
  // Sistema de asignación INTERNO - No requiere conexión de WhatsApp
  // Las cuentas están disponibles como sistema interno independiente
  
  // Cargar asignación existente del chat
  const { data: assignment, isLoading: checkingAssignment } = useQuery<ChatAssignment>({
    queryKey: [`/api/chat-assignments/${chatId}`],
    queryFn: async () => {
      const response = await fetch(`/api/chat-assignments/${chatId}`);
      if (!response.ok) {
        return null;
      }
      return response.json();
    },
    enabled: open && !!chatId,
  });
  
  // Ya no usamos agentes precargados, sino que mostramos un error si no se pueden cargar

  // Agentes internos predeterminados del sistema - SIEMPRE DISPONIBLES
  const systemAgents: User[] = [
    { id: 1, username: 'admin', fullName: 'Administrador del Sistema', role: 'admin', status: 'active' },
    { id: 2, username: 'supervisor1', fullName: 'Supervisor Principal', role: 'supervisor', status: 'active' },
    { id: 3, username: 'agente1', fullName: 'Agente de Ventas', role: 'agent', status: 'active' },
    { id: 4, username: 'agente2', fullName: 'Agente de Soporte', role: 'agent', status: 'active' },
    { id: 5, username: 'agente3', fullName: 'Agente Senior', role: 'agent', status: 'active' },
  ];

  // Cargar usuarios del sistema (con fallback a agentes predeterminados)
  const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      console.log('🔄 Cargando agentes del sistema de usuarios...');
      
      const response = await fetch('/api/users');
      if (!response.ok) {
        throw new Error('No se pudieron cargar los usuarios');
      }
      
      const data = await response.json();
      if (data.success && Array.isArray(data.users)) {
        const activeAgents = data.users.filter((user: User) => 
          user.status === 'active' && 
          ['agent', 'supervisor', 'admin'].includes(user.role.toLowerCase())
        );
        
        console.log('✅ Agentes del sistema cargados:', activeAgents.map(a => ({ id: a.id, username: a.username, role: a.role })));
        return activeAgents;
      }
      
      throw new Error('Formato de respuesta inválido');
    },
    enabled: open,
    staleTime: 0, // Sin cache para datos frescos siempre
  });

  // Estados de leads disponibles
  const leadStates = [
    { id: 'nuevos', name: 'Nuevos', color: 'bg-blue-100 text-blue-800' },
    { id: 'interesados', name: 'Interesados', color: 'bg-green-100 text-green-800' },
    { id: 'no_leidos', name: 'No Leidos', color: 'bg-yellow-100 text-yellow-800' },
    { id: 'pendiente_demo', name: 'Pendiente Demo', color: 'bg-purple-100 text-purple-800' },
    { id: 'completados', name: 'Completados', color: 'bg-gray-100 text-gray-800' },
    { id: 'no_interesados', name: 'No Interesados', color: 'bg-red-100 text-red-800' }
  ];
  
  // Sistema interno de cuentas - No requiere WhatsApp conectado
  const internalAccounts = [
    { id: 1, name: 'Sistema Interno Principal', status: 'active' },
    { id: 2, name: 'Sistema Interno Secundario', status: 'active' }
  ];

  // Formulario para crear/actualizar asignación con valores seguros
  const form = useForm<z.infer<typeof assignmentSchema>>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      accountId: accountId || 1,
      chatId: chatId || '',
      assignedToId: 0,
      category: '',
    },
  });

  // Actualizar formulario cuando se carga la asignación existente
  useEffect(() => {
    if (assignment && open) {
      console.log('🔄 Cargando asignación existente:', assignment);
      form.reset({
        accountId: assignment.accountId || accountId || 1,
        chatId: chatId,
        assignedToId: assignment.assignedToId || 0,
        category: assignment.category || '',
      });
    } else if (open && !assignment) {
      // Si no hay asignación, usar valores por defecto
      form.reset({
        accountId: accountId || 1,
        chatId: chatId || '',
        assignedToId: 0,
        category: '',
      });
    }
  }, [assignment, open, accountId, chatId, form]);
  
  // Para depuración
  console.log('Estado actual del formulario:', form.getValues());

  // Mutation para crear asignación Y ticket al mismo tiempo
  const createAssignmentMutation = useMutation({
    mutationFn: async (data: z.infer<typeof assignmentSchema>) => {
      console.log('Enviando datos para crear asignación:', data);
      
      // Primero crear la asignación de agente usando endpoint directo
      const assignmentResponse = await apiRequest('/api/direct/chat-assignment', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      
      // Si hay categoría (ticket), crear también la categoría
      if (data.category && data.category !== '') {
        try {
          await apiRequest('/api/chat-categories', {
            method: 'POST',
            body: JSON.stringify({
              chatId: data.chatId,
              accountId: data.accountId,
              status: data.category,
              notes: `Ticket asignado junto con agente`
            }),
          });
          console.log('✅ Ticket creado junto con asignación:', data.category);
        } catch (error) {
          console.error('❌ Error creando ticket:', error);
        }
      }
      
      return assignmentResponse;
    },
    onSuccess: (response) => {
      console.log('Asignación creada exitosamente:', response);
      
      // Obtener el nombre del agente para el mensaje
      const assignedAgent = agentsList.find(agent => agent.id === response.assignedToId);
      const agentName = assignedAgent ? assignedAgent.username : 'Agente';
      
      toast({
        title: 'Chat asignado exitosamente',
        description: `El chat ha sido asignado a ${agentName}`,
      });
      
      // Invalidar las consultas específicas para este chat
      queryClient.invalidateQueries({ queryKey: [`/api/chat-assignments/${chatId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat-assignments', chatId] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat-categories', chatId] });
      
      // También invalidar las consultas generales para refrescar la lista de chats
      queryClient.invalidateQueries({ queryKey: ['/api/chat-assignments'] });
      
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

  // Mutation para actualizar asignación Y ticket al mismo tiempo
  const updateAssignmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<z.infer<typeof assignmentSchema>> }) => {
      console.log('Actualizando asignación:', id, 'con datos:', data);
      
      // Actualizar la asignación
      const assignmentResponse = await apiRequest(`/api/chat-assignments/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      
      // Si hay categoría (ticket), actualizar también la categoría
      if (data.category && data.category !== '') {
        try {
          await apiRequest('/api/chat-categories', {
            method: 'POST',
            body: JSON.stringify({
              chatId: data.chatId,
              accountId: data.accountId,
              status: data.category,
              notes: `Ticket actualizado junto con agente`
            }),
          });
          console.log('✅ Ticket actualizado junto con asignación:', data.category);
        } catch (error) {
          console.error('❌ Error actualizando ticket:', error);
        }
      }
      
      return assignmentResponse;
    },
    onSuccess: (response) => {
      console.log('Asignación actualizada exitosamente:', response);
      
      // Obtener el nombre del agente para el mensaje
      const assignedAgent = agentsList.find(agent => agent.id === response.assignedToId);
      const agentName = assignedAgent ? assignedAgent.username : 'Agente';
      
      toast({
        title: 'Chat actualizado exitosamente',
        description: `El chat ha sido asignado a ${agentName}`,
      });
      
      // Invalidar las consultas específicas para este chat
      queryClient.invalidateQueries({ queryKey: [`/api/chat-assignments/${chatId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat-assignments', chatId] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat-categories', chatId] });
      
      // También invalidar las consultas generales para refrescar la lista de chats
      queryClient.invalidateQueries({ queryKey: ['/api/chat-assignments'] });
      
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

  // Cargar y actualizar formulario con asignación existente
  useEffect(() => {
    if (open && assignment) {
      console.log('🔄 Cargando asignación existente en formulario:', assignment);
      setExistingAssignment(assignment);
      form.reset({
        accountId: assignment.accountId || 1,
        chatId: chatId || '',
        assignedToId: assignment.assignedToId || 0,
        category: assignment.category || '',
      });
    } else if (open && !assignment) {
      console.log('🆕 Inicializando formulario para nueva asignación');
      setExistingAssignment(null);
      form.reset({
        accountId: 1,
        chatId: chatId || '',
        assignedToId: 0,
        category: '',
      });
    }
  }, [open, assignment, form, chatId]);

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
    
    // Encontrar el agente seleccionado para mostrar su nombre
    const selectedAgent = agentsList.find(agent => agent.id === data.assignedToId);
    const agentName = selectedAgent ? selectedAgent.fullName : 'Agente desconocido';
    
    console.log('✅ Asignando chat a:', agentName);
    
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

  // Actualizar la lista de agentes con datos reales del sistema
  useEffect(() => {
    if (users && users.length > 0) {
      setAgentsList(users);
      console.log('✅ Agentes del sistema cargados:', users.length);
    }
  }, [users]);

  // Determinar si hay un agente asignado actualmente
  const currentAgent = existingAssignment?.assignedTo 
    ? `${existingAssignment.assignedTo.fullName} (${existingAssignment.assignedTo.username})`
    : 'Sin asignar';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>
              {existingAssignment ? 'Actualizar Asignación Interna' : 'Asignación Interna de Chat'}
            </span>
          </DialogTitle>
          <DialogDescription>
            <div className="space-y-1">
              <p className="text-sm text-blue-600 font-medium">
                🔒 Sistema de Asignación Interno - Invisible para WhatsApp
              </p>
              {existingAssignment 
                ? <p>Este chat está asignado internamente a: <strong>{currentAgent}</strong></p>
                : <p>Selecciona un agente del sistema para la gestión interna de este chat</p>
              }
            </div>
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
              {/* Campo oculto para accountId - Sistema interno */}
              <input type="hidden" {...form.register('accountId')} value={1} />
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-blue-800">
                    Sistema Interno Activo - ID: {chatId}
                  </span>
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  Asignación interna independiente de WhatsApp
                </p>
              </div>

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
                      value={field.value && field.value > 0 ? field.value.toString() : ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar agente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingUsers ? (
                          <SelectItem value="loading" disabled>
                            🔄 Cargando agentes del sistema...
                          </SelectItem>
                        ) : agentsList.length > 0 ? (
                          agentsList.map((agent) => (
                            <SelectItem
                              key={agent.id}
                              value={agent.id.toString()}
                            >
                              <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="font-medium">{agent.username}</span>
                                <Badge variant="secondary" className="text-xs">
                                  {agent.role}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="none" disabled>
                            ⚠️ No hay agentes disponibles en el sistema
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
                    <FormLabel>Ticket</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar ticket" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {leadStates.map((state) => (
                          <SelectItem
                            key={state.id}
                            value={state.id}
                          >
                            <div className="flex items-center space-x-2">
                              <Badge className={`text-xs ${state.color}`}>
                                {state.name}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
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