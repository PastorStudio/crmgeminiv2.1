import { useQuery } from "@tanstack/react-query";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Message, Lead } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function RecentConversations() {
  // Fetch recent messages
  const { data: messages, isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages", { recent: true, limit: 5 }],
    queryFn: async () => {
      const response = await fetch(`/api/messages?recent=true&limit=5`);
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }
      return response.json();
    }
  });

  // For each message, fetch the associated lead
  const { data: leads, isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
    enabled: !!messages
  });

  // Get associated lead for a message
  const getLeadForMessage = (leadId: number) => {
    return leads?.find(lead => lead.id === leadId);
  };

  // Format the time for display (e.g., "10:23 AM" or "Yesterday")
  const formatMessageTime = (timestamp?: Date | string) => {
    if (!timestamp) return "";
    
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      });
    } else {
      return formatDistanceToNow(date, { addSuffix: false });
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between px-4 py-5 sm:px-6">
        <div>
          <CardTitle className="text-lg">Recent Conversations</CardTitle>
          <CardDescription>
            Latest messages from leads and clients
          </CardDescription>
        </div>
        <Button variant="link" className="text-primary-600 flex items-center p-0">
          <span className="material-icons mr-1">message</span>
          <span className="text-sm">View All</span>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border-t border-gray-200">
          {messagesLoading || leadsLoading ? (
            <div className="animate-pulse space-y-4 p-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex space-x-4">
                  <div className="rounded-full bg-gray-200 h-10 w-10"></div>
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded"></div>
                    <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : messages && messages.length > 0 ? (
            <ul className="divide-y divide-gray-200">
              {messages.map((message) => {
                const lead = getLeadForMessage(message.leadId);
                const { icon, color } = getChannelInfo(message.channel);
                const isAI = message.userId === 0 || message.aiGenerated;
                
                return (
                  <li key={message.id}>
                    <div className="px-4 py-4 sm:px-6 hover:bg-gray-50 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          {isAI ? (
                            <div className="h-10 w-10 rounded-full mr-4 bg-secondary-100 flex items-center justify-center">
                              <span className="material-icons text-secondary-600">smart_toy</span>
                            </div>
                          ) : lead?.avatar ? (
                            <img 
                              className="h-10 w-10 rounded-full mr-4" 
                              src={lead.avatar} 
                              alt={`${lead.fullName} avatar`} 
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full mr-4 bg-gray-200 flex items-center justify-center">
                              <span className="material-icons text-gray-500">person</span>
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {isAI ? "AI Assistant" : lead?.fullName || `Lead #${message.leadId}`}
                            </p>
                            <p className="text-sm text-gray-500 truncate">
                              {message.content}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-xs text-gray-500">
                            {formatMessageTime(message.sentAt)}
                          </span>
                          {!message.read && message.direction === "incoming" && (
                            <Badge className="mt-1 bg-primary-600">New</Badge>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 flex justify-between">
                        <div className="flex items-center">
                          <span className="material-icons text-gray-400 text-sm mr-1">business</span>
                          <p className="text-xs text-gray-500">
                            {lead?.company || "Unknown Company"}
                          </p>
                        </div>
                        <div className="flex items-center">
                          <span className={`material-icons ${color} text-sm mr-1`}>{icon}</span>
                          <p className="text-xs text-gray-500">{message.channel}</p>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="p-4 text-center text-gray-500">
              No recent conversations
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
