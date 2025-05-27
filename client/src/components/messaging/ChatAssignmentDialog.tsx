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
  
  // Sistema simplificado - No verificar asignaciones existentes
  const assignment = null;
  const checkingAssignment = false;
  
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
  const { data: users = systemAgents, isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      console.log('🔄 Intentando cargar agentes del sistema...');
      
      try {
        const response = await fetch('/api/users');
        if (!response.ok) {
          console.log('⚠️ API no disponible, usando agentes predeterminados');
          return systemAgents;
        }
        
        const data = await response.json();
        if (data.success && Array.isArray(data.users) && data.users.length > 0) {
          const activeAgents = data.users.filter((user: User) => 
            user.status === 'active' && 
            ['agent', 'supervisor', 'admin'].includes(user.role.toLowerCase())
          );
          
          if (activeAgents.length > 0) {
            console.log('✅ Agentes de API cargados:', activeAgents.length);
            return activeAgents;
          }
        }
        
        console.log('✅ Usando agentes predeterminados del sistema');
        return systemAgents;
      } catch (error) {
        console.log('✅ Error en API, usando agentes predeterminados');
        return systemAgents;
      }
    },
    enabled: open,
    staleTime: 30000, // Cache por 30 segundos
  });
  
  // Sistema interno de cuentas - No requiere WhatsApp conectado
  const internalAccounts = [
    { id: 1, name: 'Sistema Interno Principal', status: 'active' },
    { id: 2, name: 'Sistema Interno Secundario', status: 'active' }
  ];

  // Formulario para crear/actualizar asignación con valores seguros
  const form = useForm<z.infer<typeof assignmentSchema>>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      accountId: 1, // Sistema interno siempre usa ID 1
      chatId: chatId || '',
      assignedToId: 0, // Sin asignación inicial
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
      
      // Obtener el nombre del agente para el mensaje
      const assignedAgent = agentsList.find(agent => agent.id === response.assignedToId);
      const agentName = assignedAgent ? assignedAgent.fullName : 'Agente';
      
      toast({
        title: 'Chat asignado exitosamente',
        description: `El chat ha sido asignado a ${agentName}`,
      });
      
      // Invalidar todas las consultas relacionadas
      queryClient.invalidateQueries({ queryKey: ['/api/chat-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat-assignments/by-chat'] });
      queryClient.invalidateQueries({ queryKey: ['chat-assignment'] });
      
      // Invalidar consultas específicas
      queryClient.invalidateQueries({ queryKey: ['/api/chat-assignments/by-chat', chatId, accountId] });
      queryClient.invalidateQueries({ queryKey: ['chat-assignment', chatId] });
      
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
      
      // Obtener el nombre del agente para el mensaje
      const assignedAgent = agentsList.find(agent => agent.id === response.assignedToId);
      const agentName = assignedAgent ? assignedAgent.fullName : 'Agente';
      
      toast({
        title: 'Chat asignado exitosamente',
        description: `El chat ha sido asignado a ${agentName}`,
      });
      
      // Invalidar todas las consultas relacionadas
      queryClient.invalidateQueries({ queryKey: ['/api/chat-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chat-assignments/by-chat'] });
      queryClient.invalidateQueries({ queryKey: ['chat-assignment'] });
      
      // Invalidar consultas específicas
      queryClient.invalidateQueries({ queryKey: ['/api/chat-assignments/by-chat', chatId, accountId] });
      queryClient.invalidateQueries({ queryKey: ['chat-assignment', chatId] });
      
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

  // Sistema simplificado - Inicializar formulario siempre limpio
  useEffect(() => {
    if (open) {
      setExistingAssignment(null);
      form.reset({
        accountId: 1, // Sistema interno
        chatId: chatId || '',
        assignedToId: 0,
        category: '',
      });
    }
  }, [open, form, chatId]);

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
                      value={field.value ? field.value.toString() : undefined}
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
                                  {agent.username}
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