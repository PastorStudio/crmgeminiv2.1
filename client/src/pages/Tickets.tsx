import { useState } from "react";
import { Helmet } from "react-helmet";
import { PageContainer } from "@/components/ui/page-container";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, PlusCircle, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

// Estados de ticket con sus traducciones y colores
const ticketStatusMap = {
  nuevo: { label: "Nuevo", color: "bg-blue-500" },
  en_progreso: { label: "En Progreso", color: "bg-yellow-500" },
  resuelto: { label: "Resuelto", color: "bg-green-500" },
  cancelado: { label: "Cancelado", color: "bg-red-500" },
  sin_asignar: { label: "Sin Asignar", color: "bg-gray-500" },
};

// Prioridades con sus traducciones y colores
const priorityMap = {
  baja: { label: "Baja", color: "bg-green-200 text-green-800" },
  media: { label: "Media", color: "bg-yellow-200 text-yellow-800" },
  alta: { label: "Alta", color: "bg-orange-200 text-orange-800" },
  critica: { label: "Crítica", color: "bg-red-200 text-red-800" },
};

// Categorías con sus traducciones
const categoryMap = {
  soporte: "Soporte",
  ventas: "Ventas",
  facturacion: "Facturación",
  tecnico: "Técnico",
  consulta: "Consulta",
};

export default function Tickets() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [newTicket, setNewTicket] = useState({
    title: "",
    description: "",
    priority: "media",
    category: "consulta",
    status: "nuevo",
  });

  // Consulta para obtener todos los tickets
  const {
    data: tickets,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["/api/tickets"],
    queryFn: async () => {
      const response = await fetch("/api/tickets");
      if (!response.ok) {
        throw new Error("No se pudieron cargar los tickets");
      }
      return response.json();
    },
  });

  // Consulta para obtener agentes/usuarios para asignación
  const { data: agents } = useQuery({
    queryKey: ["/api/agents"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/agents");
        if (!response.ok) {
          return [];
        }
        return response.json();
      } catch (error) {
        console.error("Error al cargar agentes:", error);
        return [];
      }
    },
  });

  // Mutación para crear un nuevo ticket
  const createTicketMutation = useMutation({
    mutationFn: async (ticketData) => {
      const response = await apiRequest("POST", "/api/tickets", ticketData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      setIsCreateDialogOpen(false);
      setNewTicket({
        title: "",
        description: "",
        priority: "media",
        category: "consulta",
        status: "nuevo",
      });
      toast({
        title: "Ticket creado",
        description: "El ticket ha sido creado exitosamente",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo crear el ticket: " + error.message,
        variant: "destructive",
      });
    },
  });

  // Mutación para actualizar un ticket existente
  const updateTicketMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await apiRequest("PATCH", `/api/tickets/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      setIsUpdateDialogOpen(false);
      setSelectedTicket(null);
      toast({
        title: "Ticket actualizado",
        description: "El ticket ha sido actualizado exitosamente",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el ticket: " + error.message,
        variant: "destructive",
      });
    },
  });

  // Mutación para actualizar el estado de un ticket
  const updateTicketStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const response = await apiRequest("PATCH", `/api/tickets/${id}/status`, {
        status,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      toast({
        title: "Estado actualizado",
        description: "El estado del ticket ha sido actualizado",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado: " + error.message,
        variant: "destructive",
      });
    },
  });

  // Mutación para asignar un ticket a un agente
  const assignTicketMutation = useMutation({
    mutationFn: async ({ id, agentId }) => {
      const response = await apiRequest("PATCH", `/api/tickets/${id}/assign`, {
        agentId,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      toast({
        title: "Ticket asignado",
        description: "El ticket ha sido asignado correctamente",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo asignar el ticket: " + error.message,
        variant: "destructive",
      });
    },
  });

  // Función para manejar la creación de tickets
  const handleCreateTicket = (e) => {
    e.preventDefault();
    createTicketMutation.mutate(newTicket);
  };

  // Función para manejar la actualización de tickets
  const handleUpdateTicket = (e) => {
    e.preventDefault();
    if (!selectedTicket) return;

    const updatedData = {
      title: selectedTicket.title,
      description: selectedTicket.description,
      priority: selectedTicket.priority,
      category: selectedTicket.category,
    };

    updateTicketMutation.mutate({ id: selectedTicket.id, data: updatedData });
  };

  // Función para abrir el diálogo de edición con un ticket específico
  const openUpdateDialog = (ticket) => {
    setSelectedTicket({ ...ticket });
    setIsUpdateDialogOpen(true);
  };

  // Formatear fecha para mostrar
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return format(new Date(dateString), "dd/MM/yyyy HH:mm");
    } catch (error) {
      return "Fecha inválida";
    }
  };

  // Estado de carga
  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Cargando tickets...</span>
        </div>
      </PageContainer>
    );
  }

  // Estado de error
  if (isError) {
    return (
      <PageContainer>
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <h3 className="text-lg font-medium text-red-600">
              Error al cargar tickets
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              No se pudieron cargar los tickets. Intente nuevamente.
            </p>
            <Button onClick={() => refetch()} className="mt-4">
              <RefreshCw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <>
      <Helmet>
        <title>Sistema de Tickets | WhatsApp CRM</title>
        <meta
          name="description"
          content="Gestión de tickets de soporte y solicitudes de clientes"
        />
      </Helmet>

      <PageContainer>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">Sistema de Tickets</h2>
            <p className="text-gray-500">
              Gestión de tickets de soporte y solicitudes de clientes
            </p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nuevo Ticket
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tickets</CardTitle>
            <CardDescription>
              Lista de tickets ordenados por fecha de creación
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Asignado a</TableHead>
                  <TableHead>Fecha Creación</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets && tickets.length > 0 ? (
                  tickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell>{ticket.id}</TableCell>
                      <TableCell>{ticket.title}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            ticketStatusMap[ticket.status]?.color || "bg-gray-500"
                          }
                        >
                          {ticketStatusMap[ticket.status]?.label || ticket.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            priorityMap[ticket.priority]?.color || "bg-gray-200"
                          }
                        >
                          {priorityMap[ticket.priority]?.label || ticket.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {categoryMap[ticket.category] || ticket.category}
                      </TableCell>
                      <TableCell>
                        {ticket.assignedToName ? (
                          <span className="font-medium">{ticket.assignedToName}</span>
                        ) : (
                          <span className="text-gray-500 italic">Sin asignar</span>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(ticket.createdAt)}</TableCell>
                      <TableCell className="space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openUpdateDialog(ticket)}
                        >
                          Editar
                        </Button>
                        <Select
                          onValueChange={(value) =>
                            updateTicketStatusMutation.mutate({
                              id: ticket.id,
                              status: value,
                            })
                          }
                          defaultValue={ticket.status}
                        >
                          <SelectTrigger className="w-[130px]">
                            <SelectValue placeholder="Cambiar estado" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nuevo">Nuevo</SelectItem>
                            <SelectItem value="en_progreso">
                              En Progreso
                            </SelectItem>
                            <SelectItem value="resuelto">Resuelto</SelectItem>
                            <SelectItem value="cancelado">Cancelado</SelectItem>
                            <SelectItem value="sin_asignar">
                              Sin Asignar
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6">
                      No hay tickets registrados
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Diálogo para crear un nuevo ticket */}
        <Dialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
        >
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Ticket</DialogTitle>
              <DialogDescription>
                Complete la información para crear un nuevo ticket de soporte
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateTicket}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título</Label>
                  <Input
                    id="title"
                    value={newTicket.title}
                    onChange={(e) =>
                      setNewTicket({ ...newTicket, title: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={newTicket.description}
                    onChange={(e) =>
                      setNewTicket({
                        ...newTicket,
                        description: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="priority">Prioridad</Label>
                    <Select
                      defaultValue={newTicket.priority}
                      onValueChange={(value) =>
                        setNewTicket({ ...newTicket, priority: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione prioridad" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baja">Baja</SelectItem>
                        <SelectItem value="media">Media</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="critica">Crítica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoría</Label>
                    <Select
                      defaultValue={newTicket.category}
                      onValueChange={(value) =>
                        setNewTicket({ ...newTicket, category: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="soporte">Soporte</SelectItem>
                        <SelectItem value="ventas">Ventas</SelectItem>
                        <SelectItem value="facturacion">Facturación</SelectItem>
                        <SelectItem value="tecnico">Técnico</SelectItem>
                        <SelectItem value="consulta">Consulta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createTicketMutation.isPending}
                >
                  {createTicketMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Crear Ticket
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Diálogo para editar un ticket existente */}
        <Dialog
          open={isUpdateDialogOpen}
          onOpenChange={setIsUpdateDialogOpen}
        >
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Editar Ticket</DialogTitle>
              <DialogDescription>
                Modifique la información del ticket
              </DialogDescription>
            </DialogHeader>
            {selectedTicket && (
              <form onSubmit={handleUpdateTicket}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-title">Título</Label>
                    <Input
                      id="edit-title"
                      value={selectedTicket.title}
                      onChange={(e) =>
                        setSelectedTicket({
                          ...selectedTicket,
                          title: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-description">Descripción</Label>
                    <Textarea
                      id="edit-description"
                      value={selectedTicket.description}
                      onChange={(e) =>
                        setSelectedTicket({
                          ...selectedTicket,
                          description: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-priority">Prioridad</Label>
                      <Select
                        defaultValue={selectedTicket.priority}
                        onValueChange={(value) =>
                          setSelectedTicket({
                            ...selectedTicket,
                            priority: value,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione prioridad" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="baja">Baja</SelectItem>
                          <SelectItem value="media">Media</SelectItem>
                          <SelectItem value="alta">Alta</SelectItem>
                          <SelectItem value="critica">Crítica</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-category">Categoría</Label>
                      <Select
                        defaultValue={selectedTicket.category}
                        onValueChange={(value) =>
                          setSelectedTicket({
                            ...selectedTicket,
                            category: value,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione categoría" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="soporte">Soporte</SelectItem>
                          <SelectItem value="ventas">Ventas</SelectItem>
                          <SelectItem value="facturacion">
                            Facturación
                          </SelectItem>
                          <SelectItem value="tecnico">Técnico</SelectItem>
                          <SelectItem value="consulta">Consulta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-agent">Asignar a</Label>
                    <Select
                      defaultValue={selectedTicket.assignedTo?.toString()}
                      onValueChange={(value) => {
                        const agentId = value === "unassign" ? null : parseInt(value);
                        assignTicketMutation.mutate({
                          id: selectedTicket.id,
                          agentId,
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione agente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassign">Sin asignar</SelectItem>
                        {agents &&
                          agents.map((agent) => (
                            <SelectItem
                              key={agent.id}
                              value={agent.id.toString()}
                            >
                              {agent.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsUpdateDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateTicketMutation.isPending}
                  >
                    {updateTicketMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Actualizar Ticket
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </PageContainer>
    </>
  );
}