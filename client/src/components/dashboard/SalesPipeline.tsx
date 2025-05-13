import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lead } from "@shared/schema";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import LeadForm from "../leads/LeadForm";

export default function SalesPipeline() {
  const { toast } = useToast();
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  // Fetch leads by status
  const { data: newLeads, isLoading: loadingNewLeads } = useQuery<Lead[]>({
    queryKey: ["/api/leads", { status: "new" }]
  });

  const { data: contactedLeads, isLoading: loadingContactedLeads } = useQuery<Lead[]>({
    queryKey: ["/api/leads", { status: "contacted" }]
  });

  const { data: meetingLeads, isLoading: loadingMeetingLeads } = useQuery<Lead[]>({
    queryKey: ["/api/leads", { status: "meeting" }]
  });

  const { data: closedLeads, isLoading: loadingClosedLeads } = useQuery<Lead[]>({
    queryKey: ["/api/leads", { status: "closed-won" }],
  });

  // Update lead status
  const moveLead = async (leadId: number, newStatus: string) => {
    try {
      await apiRequest('PATCH', `/api/leads/${leadId}/status`, { status: newStatus });
      toast({
        title: "Lead updated",
        description: "Lead moved to " + newStatus,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update lead status",
        variant: "destructive",
      });
    }
  };

  // Render a lead card with drag-and-drop functionality
  const renderLeadCard = (lead: Lead) => (
    <div 
      key={lead.id}
      className="bg-white p-3 rounded-lg shadow-sm mb-3 cursor-pointer"
      onClick={() => setEditingLead(lead)}
    >
      <div className="flex justify-between">
        <span className="text-sm font-medium">{lead.fullName}</span>
        <Badge variant={getStatusBadgeVariant(lead.status)}>
          {formatStatus(lead.status)}
        </Badge>
      </div>
      <div className="mt-2 text-xs text-gray-500">Company: {lead.company || 'N/A'}</div>
      <div className="text-xs text-gray-500">Email: {lead.email}</div>
      <div className="mt-2 flex justify-between">
        <span className="text-xs text-gray-500">
          Added: {formatDate(lead.createdAt)}
        </span>
        {lead.matchPercentage && (
          <span className="text-xs font-medium text-green-600">
            {lead.matchPercentage}% Match
          </span>
        )}
      </div>
    </div>
  );

  // Format date to "2d ago" or similar
  const formatDate = (dateString?: string | Date) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffTime / (1000 * 60));
        return `${diffMinutes}m ago`;
      }
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else {
      return `${diffDays}d ago`;
    }
  };

  // Format status for display
  const formatStatus = (status?: string) => {
    if (!status) return 'New';
    
    switch (status) {
      case 'new': return 'New';
      case 'contacted': return 'Contacted';
      case 'meeting': return 'Meeting';
      case 'closed-won': return 'Won';
      case 'closed-lost': return 'Lost';
      default: return status;
    }
  };

  // Get badge variant based on status
  const getStatusBadgeVariant = (status?: string) => {
    if (!status) return 'default';
    
    switch (status) {
      case 'new': return 'default';
      case 'contacted': return 'secondary';
      case 'meeting': return 'warning';
      case 'closed-won': return 'success';
      case 'closed-lost': return 'destructive';
      default: return 'default';
    }
  };

  return (
    <>
      <Card className="mb-6">
        <CardHeader className="px-4 py-5 sm:px-6 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Sales Pipeline</CardTitle>
            <CardDescription>
              Lead progression through sales funnel
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon">
            <span className="material-icons">more_vert</span>
          </Button>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <div className="inline-block min-w-full align-middle">
            <div className="p-4 min-w-full grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* New Leads Column */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-medium text-gray-900">New Leads</h4>
                  <Badge variant="outline">{newLeads?.length || 0}</Badge>
                </div>
                
                {loadingNewLeads ? (
                  <div className="space-y-2">
                    <div className="bg-white p-3 rounded-lg shadow-sm mb-3">
                      <div className="animate-pulse flex flex-col space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  newLeads?.map(lead => renderLeadCard(lead))
                )}
                
                <Button 
                  variant="link" 
                  className="w-full mt-2 justify-center text-primary-600"
                  onClick={() => setEditingLead({ status: 'new' } as Lead)}
                >
                  <span className="material-icons text-sm mr-1">add</span>
                  Add lead
                </Button>
              </div>
              
              {/* Contacted Column */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-medium text-gray-900">Contacted</h4>
                  <Badge variant="outline">{contactedLeads?.length || 0}</Badge>
                </div>
                
                {loadingContactedLeads ? (
                  <div className="space-y-2">
                    <div className="bg-white p-3 rounded-lg shadow-sm mb-3">
                      <div className="animate-pulse flex flex-col space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  contactedLeads?.map(lead => renderLeadCard(lead))
                )}
                
                <Button 
                  variant="link" 
                  className="w-full mt-2 justify-center text-primary-600"
                  onClick={() => setEditingLead({ status: 'contacted' } as Lead)}
                >
                  <span className="material-icons text-sm mr-1">add</span>
                  Add contact
                </Button>
              </div>
              
              {/* Meeting Column */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-medium text-gray-900">Meeting Scheduled</h4>
                  <Badge variant="outline">{meetingLeads?.length || 0}</Badge>
                </div>
                
                {loadingMeetingLeads ? (
                  <div className="space-y-2">
                    <div className="bg-white p-3 rounded-lg shadow-sm mb-3">
                      <div className="animate-pulse flex flex-col space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  meetingLeads?.map(lead => renderLeadCard(lead))
                )}
                
                <Button 
                  variant="link" 
                  className="w-full mt-2 justify-center text-primary-600"
                  onClick={() => setEditingLead({ status: 'meeting' } as Lead)}
                >
                  <span className="material-icons text-sm mr-1">add</span>
                  Add meeting
                </Button>
              </div>
              
              {/* Closed Column */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-medium text-gray-900">Closed</h4>
                  <Badge variant="outline">{closedLeads?.length || 0}</Badge>
                </div>
                
                {loadingClosedLeads ? (
                  <div className="space-y-2">
                    <div className="bg-white p-3 rounded-lg shadow-sm mb-3">
                      <div className="animate-pulse flex flex-col space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  closedLeads?.map(lead => renderLeadCard(lead))
                )}
                
                <Button 
                  variant="link" 
                  className="w-full mt-2 justify-center text-primary-600"
                  onClick={() => setEditingLead({ status: 'closed-won' } as Lead)}
                >
                  <span className="material-icons text-sm mr-1">add</span>
                  Add deal
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {editingLead && (
        <LeadForm 
          open={!!editingLead} 
          onClose={() => setEditingLead(null)} 
          initialData={editingLead}
        />
      )}
    </>
  );
}
