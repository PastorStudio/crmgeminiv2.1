import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lead } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { User, Calendar, DollarSign, Phone } from "lucide-react";

interface PipelineColumn {
  id: string;
  title: string;
  color: string;
  leads: Lead[];
}

export default function SalesPipelineKanban() {
  const { toast } = useToast();
  
  const { data: allLeads, isLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
    refetchInterval: 30000
  });

  const [columns, setColumns] = useState<PipelineColumn[]>([]);

  // Organize leads into columns by status
  useEffect(() => {
    if (allLeads) {
      const statusColumns: PipelineColumn[] = [
        {
          id: "new",
          title: "New Leads",
          color: "bg-blue-50 border-blue-200",
          leads: allLeads.filter(lead => lead.status === "new")
        },
        {
          id: "contacted",
          title: "Contacted",
          color: "bg-yellow-50 border-yellow-200", 
          leads: allLeads.filter(lead => lead.status === "contacted")
        },
        {
          id: "qualified",
          title: "Qualified",
          color: "bg-green-50 border-green-200",
          leads: allLeads.filter(lead => lead.status === "qualified")
        },
        {
          id: "proposal",
          title: "Proposal Sent",
          color: "bg-purple-50 border-purple-200",
          leads: allLeads.filter(lead => lead.status === "proposal")
        },
        {
          id: "negotiation",
          title: "Negotiation",
          color: "bg-orange-50 border-orange-200",
          leads: allLeads.filter(lead => lead.status === "negotiation")
        },
        {
          id: "closed-won",
          title: "Closed Won",
          color: "bg-emerald-50 border-emerald-200",
          leads: allLeads.filter(lead => lead.status === "closed-won")
        },
        {
          id: "closed-lost",
          title: "Closed Lost",
          color: "bg-red-50 border-red-200",
          leads: allLeads.filter(lead => lead.status === "closed-lost")
        }
      ];
      setColumns(statusColumns);
    }
  }, [allLeads]);

  const handleDragEnd = async (result: any) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const leadId = parseInt(draggableId);
    const newStatus = destination.droppableId;

    try {
      await apiRequest(`/api/leads/${leadId}/status`, {
        method: 'PATCH',
        body: { status: newStatus }
      });

      // Update local state optimistically
      const updatedColumns = columns.map(column => {
        if (column.id === source.droppableId) {
          return {
            ...column,
            leads: column.leads.filter(lead => lead.id !== leadId)
          };
        }
        if (column.id === destination.droppableId) {
          const lead = allLeads?.find(l => l.id === leadId);
          if (lead) {
            return {
              ...column,
              leads: [...column.leads, { ...lead, status: newStatus as any }]
            };
          }
        }
        return column;
      });
      
      setColumns(updatedColumns);
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });

      toast({
        title: "Lead Updated",
        description: `Lead moved to ${destination.droppableId.replace('-', ' ')}`
      });

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update lead status",
        variant: "destructive"
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {[...Array(7)].map((_, i) => (
          <Card key={i} className="animate-pulse h-64">
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 bg-gray-200 rounded"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="text-lg font-semibold">Sales Pipeline</div>
          </CardTitle>
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
                    className={`
                      ${column.color} 
                      rounded-lg p-3 border-2 transition-colors
                      ${snapshot.isDraggingOver ? 'border-blue-400 bg-blue-100' : ''}
                    `}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-sm">{column.title}</h3>
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
                              className={`
                                bg-white p-3 rounded-md shadow-sm border cursor-move
                                hover:shadow-md transition-shadow
                                ${snapshot.isDragging ? 'shadow-lg rotate-3' : ''}
                              `}
                            >
                              <div className="space-y-2">
                                <div className="flex items-start justify-between">
                                  <h4 className="font-medium text-sm line-clamp-2">
                                    {lead.title}
                                  </h4>
                                  <Badge 
                                    variant={lead.priority === 'high' ? 'destructive' : 
                                            lead.priority === 'medium' ? 'default' : 'secondary'}
                                    className="text-xs"
                                  >
                                    {lead.priority}
                                  </Badge>
                                </div>
                                
                                <div className="text-xs text-gray-600 space-y-1">
                                  <div className="flex items-center space-x-1">
                                    <User className="h-3 w-3" />
                                    <span className="truncate">{lead.company || 'No company'}</span>
                                  </div>
                                  
                                  {lead.value && (
                                    <div className="flex items-center space-x-1">
                                      <DollarSign className="h-3 w-3" />
                                      <span className="font-medium text-green-600">
                                        {formatCurrency(lead.value)}
                                      </span>
                                    </div>
                                  )}
                                  
                                  <div className="flex items-center space-x-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>{formatDate(lead.createdAt)}</span>
                                  </div>
                                  
                                  {lead.phone && (
                                    <div className="flex items-center space-x-1">
                                      <Phone className="h-3 w-3" />
                                      <span className="truncate">{lead.phone}</span>
                                    </div>
                                  )}
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
    </Card>
  );
}