import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DragDropContext, Droppable, Draggable, DropResult } from "react-beautiful-dnd";
import { Eye, MessageSquare, Calendar } from "lucide-react";
import { Lead } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

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

  const [columns, setColumns] = useState<PipelineColumn[]>([]);

  // Organize leads into columns by status
  useEffect(() => {
    if (allLeads) {
      const statusColumns: PipelineColumn[] = [
        {
          id: "new",
          title: "New Leads",
          color: "bg-blue-100 border-blue-200",
          leads: allLeads.filter(lead => lead.status === "new")
        },
        {
          id: "contacted",
          title: "Contacted",
          color: "bg-yellow-100 border-yellow-200",
          leads: allLeads.filter(lead => lead.status === "contacted")
        },
        {
          id: "meeting",
          title: "Meeting Scheduled",
          color: "bg-purple-100 border-purple-200",
          leads: allLeads.filter(lead => lead.status === "meeting")
        },
        {
          id: "proposal",
          title: "Proposal Sent",
          color: "bg-orange-100 border-orange-200",
          leads: allLeads.filter(lead => lead.status === "proposal")
        },
        {
          id: "negotiation",
          title: "Negotiation",
          color: "bg-indigo-100 border-indigo-200",
          leads: allLeads.filter(lead => lead.status === "negotiation")
        },
        {
          id: "closed-won",
          title: "Won",
          color: "bg-green-100 border-green-200",
          leads: allLeads.filter(lead => lead.status === "closed-won")
        },
        {
          id: "closed-lost",
          title: "Lost",
          color: "bg-red-100 border-red-200",
          leads: allLeads.filter(lead => lead.status === "closed-lost")
        }
      ];
      setColumns(statusColumns);
    }
  }, [allLeads]);

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    // TODO: Implement API call to update lead status
    console.log(`Moving lead ${draggableId} from ${source.droppableId} to ${destination.droppableId}`);
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
                                  <h4 className="font-medium text-sm text-gray-900 line-clamp-2">
                                    {lead.title}
                                  </h4>
                                  <Badge variant={getStatusBadgeVariant(lead.status)} className="text-xs ml-2">
                                    {lead.status}
                                  </Badge>
                                </div>
                                
                                <div className="text-xs text-gray-600 space-y-1">
                                  <div className="flex items-center space-x-1">
                                    <span>Value: {lead.value} {lead.currency}</span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>{formatDistanceToNow(new Date(lead.updatedAt), { addSuffix: true })}</span>
                                  </div>
                                  <div className="flex items-center space-x-1">
                                    <span>Priority: {lead.priority}</span>
                                  </div>
                                </div>
                                
                                <div className="flex items-center justify-between pt-1">
                                  <div className="flex items-center space-x-2">
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                      <Eye className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                      <MessageSquare className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {lead.probability}%
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
    </Card>
  );
}