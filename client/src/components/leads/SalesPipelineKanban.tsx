import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DragDropContext, Droppable, Draggable, DropResult } from "react-beautiful-dnd";
import { Eye, MessageSquare, Calendar, Plus, Edit, Trash2, X } from "lucide-react";
import { Lead } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface PipelineColumn {
  id: string;
  title: string;
  color: string;
  leads: Lead[];
}

export default function SalesPipelineKanban() {
  const { data: allLeads, isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  // Fetch real WhatsApp contacts for accurate phone numbers
  const { data: contacts } = useQuery({
    queryKey: ["/api/contacts"],
  });

  // Fetch active chats to get real phone numbers
  const { data: activeChats } = useQuery({
    queryKey: ["/api/direct/whatsapp/chats"],
  });

  const [columns, setColumns] = useState<PipelineColumn[]>([]);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [previewLead, setPreviewLead] = useState<Lead | null>(null);
  const [commentsLead, setCommentsLead] = useState<Lead | null>(null);
  const queryClient = useQueryClient();

  // Function to calculate probability based on customer interest
  const calculateProbability = (lead: Lead) => {
    let probability = 0;
    
    // Base probability based on stage
    switch (lead.status) {
      case 'nuevo': probability = 10; break;
      case 'contactado': probability = 25; break;
      case 'calificado': probability = 50; break;
      case 'propuesta': probability = 70; break;
      case 'negociacion': probability = 85; break;
      case 'ganado': probability = 100; break;
      case 'perdido': probability = 0; break;
      default: probability = 5;
    }

    // Adjust based on interests
    if (lead.interests && lead.interests.length > 0) {
      probability += lead.interests.length * 5;
    }

    // Adjust based on lead score
    if (lead.leadScore && lead.leadScore > 0) {
      probability += Math.floor(lead.leadScore / 5);
    }

    // Adjust based on activity recency
    if (lead.lastContactDate) {
      const daysSinceContact = Math.floor((Date.now() - new Date(lead.lastContactDate).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceContact < 7) probability += 10;
      else if (daysSinceContact > 30) probability -= 15;
    }

    // Adjust based on priority
    switch (lead.priority) {
      case 'urgente': probability += 15; break;
      case 'alto': probability += 10; break;
      case 'medio': probability += 5; break;
      case 'bajo': probability -= 5; break;
    }

    return Math.min(Math.max(probability, 0), 100);
  };

  // Function to get real contact information
  const getContactInfo = (lead: Lead) => {
    // First try to find contact by phone in active chats
    const chatsData = activeChats as any;
    let activeChat = null;
    
    if (chatsData?.chats && Array.isArray(chatsData.chats)) {
      activeChat = chatsData.chats.find((chat: any) => 
        chat.id?.user && (
          chat.id.user === lead.phone?.replace(/\D/g, '') ||
          chat.id.user.includes(lead.phone?.replace(/\D/g, '')) ||
          lead.phone?.includes(chat.id.user)
        )
      );
    }

    if (activeChat) {
      const phoneNumber = activeChat.id.user.includes('@') 
        ? activeChat.id.user.split('@')[0] 
        : activeChat.id.user;
      
      return {
        name: activeChat.name || activeChat.pushname || lead.name || 'Sin nombre',
        phone: `+${phoneNumber}`,
        isActive: true
      };
    }

    // Then try contacts database
    let contact = null;
    if (contacts && Array.isArray(contacts)) {
      contact = contacts.find((c: any) => 
        c.phone === lead.phone || 
        c.phone?.replace(/\D/g, '') === lead.phone?.replace(/\D/g, '') ||
        lead.phone?.replace(/\D/g, '').includes(c.phone?.replace(/\D/g, ''))
      );
    }

    if (contact) {
      return {
        name: contact.name || lead.name || 'Sin nombre',
        phone: contact.phone,
        isActive: contact.isActive
      };
    }

    // Extract phone from WhatsApp email format if available
    let extractedPhone = lead.phone;
    if (lead.email?.includes('@whatsapp.contact')) {
      extractedPhone = lead.email.split('@')[0].replace('whatsapp-', '+');
    } else if (lead.notes?.match(/Phone: (.+)/)) {
      extractedPhone = lead.notes.match(/Phone: (.+)/)?.[1];
    } else if (lead.notes?.match(/WhatsApp: (.+)/)) {
      extractedPhone = lead.notes.match(/WhatsApp: (.+)/)?.[1];
    }

    // Fall back to lead data
    return {
      name: lead.name || lead.fullName || 'Cliente Potencial',
      phone: extractedPhone || lead.email || 'Sin teléfono',
      isActive: false
    };
  };

  // Mutation for updating lead status
  const updateLeadMutation = useMutation({
    mutationFn: async ({ leadId, status }: { leadId: number; status: string }) => {
      return await apiRequest(`/api/leads/${leadId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
        headers: { "Content-Type": "application/json" }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({
        title: "Lead actualizado",
        description: "El estado del lead se ha actualizado correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado del lead.",
        variant: "destructive",
      });
    },
  });

  // Mutation for deleting leads
  const deleteLeadMutation = useMutation({
    mutationFn: async (leadId: number) => {
      return await apiRequest(`/api/leads/${leadId}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      toast({
        title: "Lead eliminado",
        description: "El lead se ha eliminado correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el lead.",
        variant: "destructive",
      });
    },
  });

  // Mutation for updating lead details
  const updateLeadDetailsMutation = useMutation({
    mutationFn: async ({ leadId, data }: { leadId: number; data: Partial<Lead> }) => {
      return await apiRequest(`/api/leads/${leadId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      setEditingLead(null);
      toast({
        title: "Lead actualizado",
        description: "Los detalles del lead se han actualizado correctamente.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudieron actualizar los detalles del lead.",
        variant: "destructive",
      });
    },
  });

  // Organize leads into columns by status - 5-step pipeline
  useEffect(() => {
    if (allLeads) {
      const statusColumns: PipelineColumn[] = [
        {
          id: "new",
          title: "Nuevo",
          color: "bg-blue-100 border-blue-200",
          leads: allLeads.filter(lead => lead.status === "new")
        },
        {
          id: "assigned",
          title: "Asignado",
          color: "bg-purple-100 border-purple-200",
          leads: allLeads.filter(lead => lead.status === "assigned")
        },
        {
          id: "contacted",
          title: "Contactado",
          color: "bg-yellow-100 border-yellow-200",
          leads: allLeads.filter(lead => lead.status === "contacted")
        },
        {
          id: "negotiation",
          title: "Negociación",
          color: "bg-orange-100 border-orange-200",
          leads: allLeads.filter(lead => lead.status === "negotiation")
        },
        {
          id: "completed",
          title: "Completado",
          color: "bg-green-100 border-green-200",
          leads: allLeads.filter(lead => lead.status === "completed" || lead.status === "closed-won")
        },
        {
          id: "not-interested",
          title: "No Interesado",
          color: "bg-red-100 border-red-200",
          leads: allLeads.filter(lead => lead.status === "not-interested" || lead.status === "closed-lost")
        }
      ];
      setColumns(statusColumns);
    }
  }, [allLeads]);

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    // Update lead status based on the destination column
    const leadId = parseInt(draggableId);
    const newStatus = destination.droppableId;

    // Optimistically update the UI
    setColumns(prevColumns => {
      const newColumns = [...prevColumns];
      const sourceColumnIndex = newColumns.findIndex(col => col.id === source.droppableId);
      const destColumnIndex = newColumns.findIndex(col => col.id === destination.droppableId);

      const sourceLead = newColumns[sourceColumnIndex].leads[source.index];
      newColumns[sourceColumnIndex].leads.splice(source.index, 1);
      newColumns[destColumnIndex].leads.splice(destination.index, 0, { ...sourceLead, status: newStatus });

      return newColumns;
    });

    // Make API call to update the lead status in the database
    updateLeadMutation.mutate({ leadId, status: newStatus });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "new": return "default";
      case "contacted": return "secondary";
      case "meeting": return "outline";
      case "proposal": return "outline";
      case "negotiation": return "outline";
      case "closed-won": return "default";
      case "closed-lost": return "destructive";
      default: return "default";
    }
  };

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <div className="h-8 bg-gray-200 rounded"></div>
                  <div className="space-y-2">
                    {[...Array(3)].map((_, j) => (
                      <div key={j} className="h-20 bg-gray-100 rounded"></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <div className="text-lg font-semibold">Sales Pipeline</div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4 min-h-[500px]">
            {columns.map((column) => (
              <Droppable key={column.id} droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`${column.color} rounded-lg border-2 border-dashed p-3 transition-colors ${
                      snapshot.isDraggingOver ? "border-blue-400 bg-blue-50" : ""
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-medium text-sm text-gray-700">{column.title}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {column.leads.length}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      {column.leads.map((lead, index) => (
                        <Draggable
                          key={lead.id.toString()}
                          draggableId={lead.id.toString()}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`bg-white rounded-lg border p-3 shadow-sm cursor-move transition-shadow ${
                                snapshot.isDragging ? "shadow-lg" : "hover:shadow-md"
                              }`}
                            >
                              <div className="space-y-2">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h4 className="font-medium text-sm text-gray-900 line-clamp-1">
                                      {getContactInfo(lead).name}
                                    </h4>
                                    {lead.company && (
                                      <p className="text-xs text-gray-500 mt-0.5">
                                        {lead.company}
                                      </p>
                                    )}
                                    <p className="text-xs text-gray-600 mt-1 flex items-center space-x-1">
                                      {lead.source === 'whatsapp' && (
                                        <span className="text-green-600 font-medium">📱</span>
                                      )}
                                      <span>
                                        {getContactInfo(lead).phone}
                                      </span>
                                      {getContactInfo(lead).isActive && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                          Activo
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-lg font-bold text-blue-600">
                                      {calculateProbability(lead)}%
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      Probabilidad
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="text-xs text-gray-600 space-y-1">
                                  <div className="flex items-center space-x-1">
                                    <span>Valor: ${lead.value || 0} {lead.currency}</span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>{formatDistanceToNow(new Date(lead.updatedAt), { addSuffix: true })}</span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <span>Prioridad: {lead.priority}</span>
                                  </div>
                                </div>
                                
                                <div className="flex items-center justify-between pt-1">
                                  <div className="flex items-center space-x-1">
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-6 w-6 p-0 text-gray-600 hover:text-blue-600"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPreviewLead(lead);
                                      }}
                                    >
                                      <Eye className="h-3 w-3" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-6 w-6 p-0 text-gray-600 hover:text-green-600"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCommentsLead(lead);
                                      }}
                                    >
                                      <MessageSquare className="h-3 w-3" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingLead(lead);
                                      }}
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-6 w-6 p-0 text-red-600 hover:text-red-800"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm('¿Estás seguro de que quieres eliminar este lead?')) {
                                          deleteLeadMutation.mutate(lead.id);
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                    </div>
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      </CardContent>

      {/* Lead Preview Modal */}
      <Dialog open={!!previewLead} onOpenChange={() => setPreviewLead(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Vista Previa - {getContactInfo(previewLead!).name}</DialogTitle>
          </DialogHeader>
          {previewLead && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Nombre</Label>
                  <p className="text-sm">{getContactInfo(previewLead).name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Teléfono</Label>
                  <p className="text-sm">{getContactInfo(previewLead).phone}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Email</Label>
                  <p className="text-sm">{previewLead.email || 'No disponible'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Estado</Label>
                  <Badge variant="outline">{previewLead.status}</Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium">Valor</Label>
                  <p className="text-sm">${previewLead.value || 0} {previewLead.currency}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Probabilidad</Label>
                  <p className="text-sm text-blue-600 font-medium">{calculateProbability(previewLead)}%</p>
                </div>
              </div>
              {previewLead.notes && (
                <div>
                  <Label className="text-sm font-medium">Notas</Label>
                  <p className="text-sm bg-gray-50 p-3 rounded-md">{previewLead.notes}</p>
                </div>
              )}
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                <Calendar className="h-3 w-3" />
                <span>Creado: {formatDistanceToNow(new Date(previewLead.createdAt), { addSuffix: true })}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Lead Comments Modal */}
      <Dialog open={!!commentsLead} onOpenChange={() => setCommentsLead(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Comentarios - {commentsLead && getContactInfo(commentsLead).name}</DialogTitle>
          </DialogHeader>
          {commentsLead && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-md">
                <h4 className="font-medium text-sm mb-2">Información del Lead</h4>
                <p className="text-sm"><strong>Teléfono:</strong> {getContactInfo(commentsLead).phone}</p>
                <p className="text-sm"><strong>Estado:</strong> {commentsLead.status}</p>
                <p className="text-sm"><strong>Probabilidad:</strong> {calculateProbability(commentsLead)}%</p>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Agregar Comentario</Label>
                <Textarea 
                  placeholder="Escribe un comentario sobre este lead..."
                  className="mt-1"
                />
                <Button className="mt-2" size="sm">
                  Guardar Comentario
                </Button>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Historial de Comentarios</Label>
                <div className="space-y-2 mt-2">
                  <div className="text-sm text-gray-500 italic">
                    No hay comentarios disponibles para este lead.
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Lead Edit Modal */}
      <Dialog open={!!editingLead} onOpenChange={() => setEditingLead(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar Lead - {editingLead && getContactInfo(editingLead).name}</DialogTitle>
          </DialogHeader>
          {editingLead && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Nombre</Label>
                  <Input 
                    defaultValue={editingLead.name || ''} 
                    placeholder="Nombre del lead"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Teléfono</Label>
                  <Input 
                    defaultValue={editingLead.phone || ''} 
                    placeholder="Número de teléfono"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Email</Label>
                  <Input 
                    defaultValue={editingLead.email || ''} 
                    placeholder="Correo electrónico"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Valor</Label>
                  <Input 
                    type="number"
                    defaultValue={editingLead.value || 0} 
                    placeholder="Valor estimado"
                  />
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Notas</Label>
                <Textarea 
                  defaultValue={editingLead.notes || ''} 
                  placeholder="Notas adicionales..."
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditingLead(null)}>
                  Cancelar
                </Button>
                <Button onClick={() => {
                  toast({
                    title: "Lead actualizado",
                    description: "Los cambios se han guardado correctamente"
                  });
                  setEditingLead(null);
                }}>
                  Guardar Cambios
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}