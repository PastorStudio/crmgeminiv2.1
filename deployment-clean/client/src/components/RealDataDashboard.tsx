import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, MessageSquare, Users, TrendingUp, Database } from "lucide-react";
import { RealDataIndicator } from "./RealDataIndicator";
import { useToast } from "@/hooks/use-toast";

interface RealDataDashboardProps {
  className?: string;
}

export function RealDataDashboard({ className }: RealDataDashboardProps) {
  const { toast } = useToast();

  // Fetch real dashboard metrics
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery({
    queryKey: ["/api/dashboard/real-metrics"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch real leads data
  const { data: leadsData, isLoading: leadsLoading, refetch: refetchLeads } = useQuery({
    queryKey: ["/api/leads/real-data"],
  });

  // Fetch real WhatsApp conversations
  const { data: conversationsData, isLoading: conversationsLoading, refetch: refetchConversations } = useQuery({
    queryKey: ["/api/whatsapp/real-conversations"],
  });

  // Fetch real sales pipeline
  const { data: pipelineData, isLoading: pipelineLoading, refetch: refetchPipeline } = useQuery({
    queryKey: ["/api/sales/real-pipeline"],
  });

  // Manual refresh all data
  const handleRefreshAll = async () => {
    try {
      await Promise.all([
        refetchMetrics(),
        refetchLeads(),
        refetchConversations(),
        refetchPipeline()
      ]);
      
      toast({
        title: "Data Refreshed",
        description: "All real WhatsApp data has been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh real data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const isLoading = metricsLoading || leadsLoading || conversationsLoading || pipelineLoading;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Real WhatsApp Data Dashboard</h2>
          <p className="text-muted-foreground">
            Live data from authenticated WhatsApp accounts
          </p>
        </div>
        <Button 
          onClick={handleRefreshAll} 
          disabled={isLoading}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh All
        </Button>
      </div>

      {/* Real Data Status Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.metrics?.leads || 0}
            </div>
            <RealDataIndicator 
              isRealData={metrics?.realData} 
              count={leadsData?.count}
              label="leads"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">WhatsApp Messages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.metrics?.messages || 0}
            </div>
            <RealDataIndicator 
              isRealData={metrics?.realData} 
              count={conversationsData?.count}
              label="conversations"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.metrics?.contacts || 0}
            </div>
            <RealDataIndicator 
              isRealData={metrics?.realData} 
              count={metrics?.metrics?.contacts}
              label="contacts"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.metrics?.conversionRate?.toFixed(1) || 0}%
            </div>
            <RealDataIndicator 
              isRealData={metrics?.realData} 
              label="conversion"
            />
          </CardContent>
        </Card>
      </div>

      {/* Real Data Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Real Data Integration Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Data Sources</h4>
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span>Leads Database:</span>
                  <RealDataIndicator isRealData={leadsData?.realData} />
                </div>
                <div className="flex items-center justify-between">
                  <span>WhatsApp Messages:</span>
                  <RealDataIndicator isRealData={conversationsData?.realData} />
                </div>
                <div className="flex items-center justify-between">
                  <span>Sales Pipeline:</span>
                  <RealDataIndicator isRealData={pipelineData?.realData} />
                </div>
                <div className="flex items-center justify-between">
                  <span>Dashboard Metrics:</span>
                  <RealDataIndicator isRealData={metrics?.realData} />
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Last Updated</h4>
              <div className="text-sm text-muted-foreground">
                {new Date().toLocaleString('en-US', {
                  timeZone: 'America/New_York',
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                })}
              </div>
              <div className="text-xs text-green-600">
                All data sourced from authenticated WhatsApp accounts - Live data
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Real Conversations Preview */}
      {conversationsData?.conversations && conversationsData.conversations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent WhatsApp Conversations</CardTitle>
            <RealDataIndicator 
              isRealData={conversationsData.realData} 
              count={conversationsData.count}
              label="conversations"
            />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {conversationsData.conversations.slice(0, 5).map((conversation: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <div className="font-medium">
                      {conversation.contactName || conversation.contactPhone}
                    </div>
                    <div className="text-sm text-muted-foreground truncate max-w-xs">
                      {conversation.lastMessage}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {conversation.messageCount} messages
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}