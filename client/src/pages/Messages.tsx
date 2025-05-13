import { useState } from "react";
import { Helmet } from "react-helmet";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Lead, Message } from "@shared/schema";
import ChatInterface from "@/components/messaging/ChatInterface";
import ConnectionStatus from "@/components/messaging/ConnectionStatus";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

export default function Messages() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<number | undefined>(undefined);

  // Fetch all leads
  const { data: leads, isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });

  // Fetch recent messages for each lead
  const { data: messages, isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages", { recent: true }],
  });

  // Filter leads based on search term
  const filteredLeads = leads?.filter(lead => 
    !searchTerm || 
    lead.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (lead.company && lead.company.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Get the most recent message for a lead
  const getRecentMessageForLead = (leadId: number) => {
    if (!messages) return undefined;
    
    try {
      const leadMessages = messages.filter(message => message.leadId === leadId);
      if (leadMessages.length === 0) return undefined;
      
      return leadMessages.sort((a, b) => {
        const dateA = a.sentAt ? new Date(a.sentAt).getTime() : 0;
        const dateB = b.sentAt ? new Date(b.sentAt).getTime() : 0;
        return dateB - dateA;
      })[0];
    } catch (error) {
      console.error("Error getting recent message:", error);
      return undefined;
    }
  };

  // Format message timestamp
  const formatMessageTime = (timestamp?: Date | string | null) => {
    if (!timestamp) return "";
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (error) {
      return "";
    }
  };

  // Get channel icon and color
  const getChannelInfo = (channel: string) => {
    switch (channel) {
      case "whatsapp":
        return { icon: "whatsapp", color: "text-green-500" };
      case "email":
        return { icon: "email", color: "text-blue-500" };
      case "chat":
        return { icon: "chat", color: "text-indigo-500" };
      case "system":
        return { icon: "integration_instructions", color: "text-purple-500" };
      default:
        return { icon: "message", color: "text-gray-500" };
    }
  };

  return (
    <>
      <Helmet>
        <title>Messages | GeminiCRM</title>
        <meta name="description" content="Manage and view your conversations with leads and customers" />
      </Helmet>

      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 md:hidden">Messages</h1>
          <p className="text-sm text-gray-500">
            Communicate with your leads and customers
          </p>
        </div>
        <div className="space-y-2">
          <ConnectionStatus platform="whatsapp" />
          <ConnectionStatus platform="telegram" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leads list */}
        <Card className="lg:col-span-1">
          <CardContent className="p-4">
            <div className="mb-4">
              <Input
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <ScrollArea className="h-[calc(100vh-16rem)] pr-3">
              {leadsLoading || messagesLoading ? (
                <div className="animate-pulse space-y-3">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4 py-2">
                      <div className="h-10 w-10 rounded-full bg-gray-200"></div>
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-full"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredLeads?.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <div className="text-lg font-medium mb-2">No contacts found</div>
                  <p className="text-sm">Try adjusting your search criteria</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredLeads?.map(lead => {
                    const recentMessage = getRecentMessageForLead(lead.id);
                    const hasUnread = recentMessage && recentMessage.direction === "incoming" && !recentMessage.read;
                    
                    return (
                      <div
                        key={lead.id}
                        className={`flex items-center p-2 rounded-md cursor-pointer ${
                          selectedLeadId === lead.id ? "bg-primary-50" : "hover:bg-gray-100"
                        }`}
                        onClick={() => setSelectedLeadId(lead.id)}
                      >
                        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                          <span className="material-icons text-gray-500">person</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline">
                            <h3 className="text-sm font-medium truncate">
                              {lead.fullName}
                            </h3>
                            {recentMessage?.sentAt && (
                              <span className="text-xs text-gray-500">
                                {formatMessageTime(recentMessage.sentAt)}
                              </span>
                            )}
                          </div>
                          <div className="flex justify-between items-center">
                            <p className="text-xs text-gray-500 truncate">
                              {recentMessage ? recentMessage.content : "No messages yet"}
                            </p>
                            {hasUnread && (
                              <Badge className="ml-1 bg-primary-600">New</Badge>
                            )}
                          </div>
                          {recentMessage && (
                            <div className="flex items-center mt-1">
                              <span className={`material-icons ${getChannelInfo(recentMessage.channel).color} text-xs mr-1`}>
                                {getChannelInfo(recentMessage.channel).icon}
                              </span>
                              <span className="text-xs text-gray-500">
                                {recentMessage.channel}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat interface */}
        <div className="lg:col-span-2 h-[calc(100vh-16rem)]">
          <ChatInterface leadId={selectedLeadId} />
        </div>
      </div>
    </>
  );
}
