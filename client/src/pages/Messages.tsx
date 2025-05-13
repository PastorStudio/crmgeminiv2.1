import { useState, useEffect } from "react";
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
import WhatsAppInterface from "@/components/messaging/WhatsAppInterface";
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
        <title>WhatsApp Web | GeminiCRM</title>
        <meta name="description" content="Send and receive WhatsApp messages directly from your CRM" />
      </Helmet>

      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold text-green-600">WhatsApp Web</h1>
          <p className="text-sm text-gray-500">
            Send and receive WhatsApp messages directly from your CRM
          </p>
        </div>
        <div>
          <ConnectionStatus platform="whatsapp" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-14rem)]">
        {/* Leads list - WhatsApp style */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow-md overflow-hidden flex flex-col border border-gray-200">
          <div className="bg-[#f0f2f5] p-3 flex items-center">
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center mr-2">
              <span className="material-icons text-gray-600">account_circle</span>
            </div>
            <div className="flex-1"></div>
            <div className="flex gap-4 text-gray-600">
              <span className="material-icons">refresh</span>
              <span className="material-icons">more_vert</span>
            </div>
          </div>
          
          <div className="bg-[#f6f6f6] p-2">
            <div className="bg-white rounded-lg flex items-center px-3 py-1">
              <span className="material-icons text-gray-400 mr-3">search</span>
              <Input
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          </div>
          
          <ScrollArea className="flex-1 bg-white pr-1">
            {leadsLoading || messagesLoading ? (
              <div className="animate-pulse space-y-3 p-2">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 py-3 px-2 border-b border-gray-100">
                    <div className="h-12 w-12 rounded-full bg-gray-100"></div>
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-100 rounded w-full"></div>
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
              <div>
                {filteredLeads?.map(lead => {
                  const recentMessage = getRecentMessageForLead(lead.id);
                  const hasUnread = recentMessage && recentMessage.direction === "incoming" && !recentMessage.read;
                  
                  return (
                    <div
                      key={lead.id}
                      className={`flex items-center px-3 py-3 cursor-pointer border-b border-gray-100 ${
                        selectedLeadId === lead.id ? "bg-[#f0f2f5]" : "hover:bg-[#f5f5f5]"
                      }`}
                      onClick={() => setSelectedLeadId(lead.id)}
                    >
                      <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center mr-3">
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
                          <div className="flex items-center">
                            {recentMessage && recentMessage.direction === "outgoing" && (
                              <span className="material-icons text-xs text-gray-400 mr-1">done_all</span>
                            )}
                            <p className="text-xs text-gray-500 truncate">
                              {recentMessage ? recentMessage.content : "No messages yet"}
                            </p>
                          </div>
                          {hasUnread && (
                            <span className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-xs ml-1">
                              1
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* WhatsApp interface */}
        <div className="lg:col-span-2 h-full">
          <WhatsAppInterface leadId={selectedLeadId} />
        </div>
      </div>
    </>
  );
}
