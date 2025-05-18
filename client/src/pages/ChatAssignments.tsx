import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, UserPlus, UserX, MessageSquare, Filter, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/authContext';

// Esquema para asignar un chat a un agente
const assignChatSchema = z.object({
  chatId: z.string().min(1, { message: 'El ID del chat es obligatorio' }),
  accountId: z.string().min(1, { message: 'La cuenta de WhatsApp es obligatoria' }),
  assignedToId: z.string().min(1, { message: 'Debe seleccionar un agente' }),
  category: z.string().optional(),
  notes: z.string().optional(),
});

type AssignChatFormValues = z.infer<typeof assignChatSchema>;

const ChatAssignments = () => {
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedChat, setSelectedChat] = useState(null);
  const [filterAccount, setFilterAccount] = useState('all');
  const [filterAgent, setFilterAgent] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();
  
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // Obtener las asignaciones de chat
  const { data: assignments, isLoading: isLoadingAssignments } = useQuery({
    queryKey: ['/api/chat-assignments', filterAccount, filterAgent, filterCategory, searchQuery],
    queryFn: async () => {
      let url = '/api/chat-assignments';
      const params = new URLSearchParams();
      
      if (filterAccount !== 'all') params.append('accountId', filterAccount);
      if (filterAgent !== 'all') params.append('agentId', filterAgent);
      if (filterCategory !== 'all') params.append('category', filterCategory);
      if (searchQuery) params.append('query', searchQuery);
      
      if (params.toString()) url += `?${params.toString()}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Error al cargar las asignaciones de chat');
      }
      return response.json();
    }
  });

  // Obtener los agentes disponibles
  const { data: agents, isLoading: isLoadingAgents } = useQuery({
    queryKey: ['/api/users/agents'],
    queryFn: async () => {
      const response = await fetch('/api/users/agents');
      if (!response.ok) {
        throw new Error('Error al cargar los agentes');
      }
      return response.json();
    }
  });

  // Obtener las cuentas de WhatsApp
  const { data: accounts, isLoading: isLoadingAccounts } = useQuery({
    queryKey: ['/api/whatsapp-accounts'],
    queryFn: async () => {
      const response = await fetch('/api/whatsapp-accounts');
      if (!response.ok) {
        throw new Error('Error al cargar las cuentas de WhatsApp');
      }
      return response.json();
    }
  });

  // Obtener las categorías de chat
  const { data: categories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['/api/chat-categories'],
    queryFn: async () => {
      const response = await fetch('/api/chat-categories');
      if (!response.ok) {
        throw new Error('Error al cargar las categorías');
      }
      return response.json();
    }
  });

  // Obtener los chats disponibles para asignar
  const { data: availableChats, isLoading: isLoadingChats, refetch: refetchChats } = useQuery({
    queryKey: ['/api/whatsapp/chats/available', filterAccount],
    queryFn: async () => {
      let url = '/api/whatsapp/chats/available';
      if (filterAccount !== 'all') {
        url += `?accountId=${filterAccount}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Error al cargar los chats disponibles');
      }
      return response.json();
    },
    enabled: isAssignDialogOpen
  });

  const form = useForm<AssignChatFormValues>({
    resolver: zodResolver(assignChatSchema),
    defaultValues: {
      chatId: '',
      accountId: '',
      assignedToId: '',
      category: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (accounts?.length > 0 && form.getValues('accountId') === '') {
      form.setValue('accountId', accounts[0].id.toString());
    }
  }, [accounts, form]);

  // Mutación para asignar chat
  const assignChatMutation = useMutation({
    mutationFn: async (data: AssignChatFormValues) => {
      const response = await apiRequest('POST', '/api/chat-assignments', {
        chatId: data.chatId,
        accountId: parseInt(data.accountId),
        assignedToId: parseInt(data.assignedToId),
        category: data.category || null,
        notes: data.notes || null,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Chat asignado',
        description: 'El chat ha sido asignado exitosamente al agente seleccionado',
      });
      setIsAssignDialogOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['/api/chat-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats/available'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `No se pudo asignar el chat: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Mutación para reasignar chat
  const reassignChatMutation = useMutation({
    mutationFn: async ({ id, assignedToId }: { id: number, assignedToId: number }) => {
      const response = await apiRequest('PATCH', `/api/chat-assignments/${id}`, { assignedToId });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Chat reasignado',
        description: 'El chat ha sido reasignado exitosamente',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/chat-assignments'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `No se pudo reasignar el chat: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Mutación para desasignar chat
  const unassignChatMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/chat-assignments/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Chat desasignado',
        description: 'El chat ha sido desasignado exitosamente',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/chat-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats/available'] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `No se pudo desasignar el chat: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: AssignChatFormValues) => {
    assignChatMutation.mutate(data);
  };

  const handleUnassignChat = (assignment) => {
    if (window.confirm('¿Está seguro de que desea desasignar este chat?')) {
      unassignChatMutation.mutate(assignment.id);
    }
  };

  const handleReassignChat = (assignment, agentId) => {
    reassignChatMutation.mutate({ id: assignment.id, assignedToId: agentId });
  };

  const handleTabChange = (value) => {
    setActiveTab(value);
    if (value === 'mine') {
      setFilterAgent(user?.id.toString() || 'all');
    } else {
      setFilterAgent('all');
    }
  };

  const filteredAssignments = () => {
    if (!assignments) return [];
    
    return assignments.filter(assignment => {
      // Filtro por pestaña activa
      if (activeTab === 'mine' && assignment.assignedToId !== user?.id) {
        return false;
      }
      
      return true;
    });
  };

  const getAgentName = (agentId) => {
    if (!agents) return 'Desconocido';
    const agent = agents.find(a => a.id === agentId);
    return agent ? agent.fullName || agent.username : 'Desconocido';
  };

  const getAccountName = (accountId) => {
    if (!accounts) return 'Desconocida';
    const account = accounts.find(a => a.id === accountId);
    return account ? account.name : 'Desconocida';
  };

  const getCategoryLabel = (categoryId) => {
    if (!categories || !categoryId) return 'Sin categoría';
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Sin categoría';
  };

  const isLoading = isLoadingAssignments || isLoadingAgents || isLoadingAccounts || isLoadingCategories;

  return (
    <div className="container p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Asignación de Chats</h1>
          <p className="text-gray-600">Asigne conversaciones de WhatsApp a agentes específicos</p>
        </div>
        <Button onClick={() => setIsAssignDialogOpen(true)} className="flex items-center">
          <UserPlus className="mr-2 h-4 w-4" />
          Asignar Chat
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Cuenta de WhatsApp</label>
              <Select value={filterAccount} onValueChange={setFilterAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las cuentas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las cuentas</SelectItem>
                  {accounts?.map(account => (
                    <SelectItem key={account.id} value={account.id.toString()}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Agente</label>
              <Select value={filterAgent} onValueChange={setFilterAgent}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los agentes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los agentes</SelectItem>
                  {agents?.map(agent => (
                    <SelectItem key={agent.id} value={agent.id.toString()}>
                      {agent.fullName || agent.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Categoría</label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las categorías" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories?.map(category => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Buscar</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Buscar por nombre..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">Todos los Chats</TabsTrigger>
          <TabsTrigger value="mine">Mis Chats</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-gray-600">Cargando asignaciones...</span>
            </div>
          ) : filteredAssignments().length > 0 ? (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chat</TableHead>
                    <TableHead>Cuenta WhatsApp</TableHead>
                    <TableHead>Agente</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Fecha de asignación</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments().map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">{assignment.chatId}</TableCell>
                      <TableCell>{getAccountName(assignment.accountId)}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span>{getAgentName(assignment.assignedToId)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {assignment.category ? (
                          <Badge variant="outline">{getCategoryLabel(assignment.category)}</Badge>
                        ) : (
                          <span className="text-gray-400">Sin categoría</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(assignment.assignedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <span className="sr-only">Abrir menú</span>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => setLocation(`/messages?chatId=${encodeURIComponent(assignment.chatId)}`)}
                              className="cursor-pointer"
                            >
                              <MessageSquare className="mr-2 h-4 w-4" />
                              Ver Conversación
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setSelectedChat(assignment)}
                              className="cursor-pointer"
                            >
                              <UserPlus className="mr-2 h-4 w-4" />
                              Reasignar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleUnassignChat(assignment)}
                              className="cursor-pointer text-red-500"
                            >
                              <UserX className="mr-2 h-4 w-4" />
                              Desasignar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <Card className="border-dashed border-2 border-gray-300 p-6">
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-700">No hay asignaciones de chat</h3>
                <p className="text-gray-500 mt-1">Asigne chats a agentes para empezar</p>
                <Button onClick={() => setIsAssignDialogOpen(true)} className="mt-4">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Asignar Chat
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="mine" className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-gray-600">Cargando tus chats...</span>
            </div>
          ) : filteredAssignments().length > 0 ? (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chat</TableHead>
                    <TableHead>Cuenta WhatsApp</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Fecha de asignación</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments().map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">{assignment.chatId}</TableCell>
                      <TableCell>{getAccountName(assignment.accountId)}</TableCell>
                      <TableCell>
                        {assignment.category ? (
                          <Badge variant="outline">{getCategoryLabel(assignment.category)}</Badge>
                        ) : (
                          <span className="text-gray-400">Sin categoría</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(assignment.assignedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setLocation(`/messages?chatId=${encodeURIComponent(assignment.chatId)}`)}
                        >
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Ver Conversación
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <Card className="border-dashed border-2 border-gray-300 p-6">
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-700">No tienes chats asignados</h3>
                <p className="text-gray-500 mt-1">Contacta a un administrador para que te asigne conversaciones</p>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog para asignar chat */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar Chat a un Agente</DialogTitle>
            <DialogDescription>
              Seleccione un chat y asígnelo a un agente para su gestión.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="accountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cuenta de WhatsApp</FormLabel>
                    <Select 
                      value={field.value} 
                      onValueChange={field.onChange}
                      disabled={isLoadingAccounts}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar cuenta" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accounts?.map(account => (
                          <SelectItem key={account.id} value={account.id.toString()}>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetchChats()}
                  disabled={isLoadingChats}
                >
                  {isLoadingChats ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Actualizar Chats
                </Button>
              </div>
              
              <FormField
                control={form.control}
                name="chatId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chat</FormLabel>
                    <Select 
                      value={field.value} 
                      onValueChange={field.onChange}
                      disabled={isLoadingChats || !availableChats?.length}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar chat" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableChats?.map(chat => (
                          <SelectItem key={chat.id} value={chat.id}>
                            {chat.name || chat.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!availableChats?.length && !isLoadingChats && (
                      <p className="text-sm text-gray-500 mt-1">
                        No hay chats disponibles para asignar
                      </p>
                    )}
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
                      value={field.value} 
                      onValueChange={field.onChange}
                      disabled={isLoadingAgents}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar agente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {agents?.map(agent => (
                          <SelectItem key={agent.id} value={agent.id.toString()}>
                            {agent.fullName || agent.username}
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
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría (opcional)</FormLabel>
                    <Select 
                      value={field.value} 
                      onValueChange={field.onChange}
                      disabled={isLoadingCategories}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar categoría" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Sin categoría</SelectItem>
                        {categories?.map(category => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            {category.name}
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
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas (opcional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Notas adicionales sobre esta asignación"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAssignDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={assignChatMutation.isPending}
                >
                  {assignChatMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Asignar Chat
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog para reasignar chat */}
      <Dialog open={!!selectedChat} onOpenChange={(open) => !open && setSelectedChat(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reasignar Chat</DialogTitle>
            <DialogDescription>
              Seleccione un nuevo agente para este chat.
            </DialogDescription>
          </DialogHeader>
          {selectedChat && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium">Chat:</h3>
                <p>{selectedChat.chatId}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium">Cuenta de WhatsApp:</h3>
                <p>{getAccountName(selectedChat.accountId)}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium">Actualmente asignado a:</h3>
                <p>{getAgentName(selectedChat.assignedToId)}</p>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="text-sm font-medium mb-2">Seleccionar nuevo agente:</h3>
                <Select 
                  onValueChange={(value) => handleReassignChat(selectedChat, parseInt(value))}
                  disabled={reassignChatMutation.isPending || isLoadingAgents}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar agente" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents?.map(agent => (
                      agent.id !== selectedChat.assignedToId && (
                        <SelectItem key={agent.id} value={agent.id.toString()}>
                          {agent.fullName || agent.username}
                        </SelectItem>
                      )
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setSelectedChat(null)}
                >
                  Cancelar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatAssignments;