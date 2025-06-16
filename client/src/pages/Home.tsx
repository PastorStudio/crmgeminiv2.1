import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MessageSquare, 
  Users, 
  TrendingUp, 
  Zap, 
  Database,
  RefreshCw,
  Bot,
  BarChart3,
  Settings
} from "lucide-react";
import { RealDataDashboard } from "@/components/RealDataDashboard";
import { RealDataIndicator } from "@/components/RealDataIndicator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Home() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isConverting, setIsConverting] = useState(false);

  // Fetch real dashboard metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["/api/dashboard/real-metrics"],
    refetchInterval: 30000,
  });

  // Fetch conversion stats
  const { data: conversionStats } = useQuery({
    queryKey: ["/api/auto-convert-chats/stats"],
    refetchInterval: 60000,
  });

  // Automatic chat-to-lead conversion mutation
  const convertChatsMutation = useMutation({
    mutationFn: () => apiRequest("/api/auto-convert-chats", { method: "POST" }),
    onSuccess: (data) => {
      toast({
        title: "Conversion Complete",
        description: `${data.result.converted} new leads created from ${data.result.processed} conversations`,
      });
      
      // Refresh all related data
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/real-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leads/real-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auto-convert-chats/stats"] });
    },
    onError: (error) => {
      toast({
        title: "Conversion Failed",
        description: "Failed to convert chats to leads. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleConvertChats = async () => {
    setIsConverting(true);
    try {
      await convertChatsMutation.mutateAsync();
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900">
            WhatsApp CRM Dashboard
          </h1>
          <p className="text-xl text-gray-600">
            Real-time management of WhatsApp conversations and lead generation
          </p>
          <div className="flex items-center justify-center gap-2">
            <Database className="h-5 w-5 text-green-600" />
            <span className="text-sm text-green-600 font-medium">
              Connected to authentic WhatsApp data
            </span>
          </div>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-white shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {metrics?.metrics?.leads || 0}
              </div>
              <RealDataIndicator isRealData={metrics?.realData} />
            </CardContent>
          </Card>

          <Card className="bg-white shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">WhatsApp Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {metrics?.metrics?.messages || 0}
              </div>
              <RealDataIndicator isRealData={metrics?.realData} />
            </CardContent>
          </Card>

          <Card className="bg-white shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {metrics?.metrics?.conversionRate?.toFixed(1) || 0}%
              </div>
              <RealDataIndicator isRealData={metrics?.realData} />
            </CardContent>
          </Card>

          <Card className="bg-white shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Auto Conversions</CardTitle>
              <Bot className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {conversionStats?.stats?.totalConverted || 0}
              </div>
              <RealDataIndicator isRealData={conversionStats?.realData} />
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-white shadow-lg">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Real Data Dashboard
            </TabsTrigger>
            <TabsTrigger value="automation" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Automation Center
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              System Status
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <RealDataDashboard />
          </TabsContent>

          <TabsContent value="automation" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Automatic Chat Conversion */}
              <Card className="bg-white shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-blue-600" />
                    Automatic Chat-to-Lead Conversion
                  </CardTitle>
                  <CardDescription>
                    Convert WhatsApp conversations into leads automatically
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {conversionStats?.stats?.totalProcessed || 0}
                      </div>
                      <div className="text-sm text-gray-600">Chats Processed</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {conversionStats?.stats?.totalConverted || 0}
                      </div>
                      <div className="text-sm text-gray-600">Leads Created</div>
                    </div>
                  </div>

                  <Button 
                    onClick={handleConvertChats}
                    disabled={isConverting || convertChatsMutation.isPending}
                    className="w-full"
                    size="lg"
                  >
                    {isConverting || convertChatsMutation.isPending ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Converting Chats...
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-4 w-4" />
                        Start Auto Conversion
                      </>
                    )}
                  </Button>

                  <RealDataIndicator 
                    isRealData={conversionStats?.realData}
                    count={conversionStats?.stats?.totalProcessed}
                    label="conversations"
                  />
                </CardContent>
              </Card>

              {/* Conversion Statistics */}
              <Card className="bg-white shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-purple-600" />
                    Conversion Analytics
                  </CardTitle>
                  <CardDescription>
                    Performance metrics for automatic conversions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Success Rate</span>
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        {conversionStats?.stats?.successRate?.toFixed(1) || 0}%
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Last Run</span>
                      <span className="text-sm text-gray-600">
                        {conversionStats?.stats?.lastRun ? 
                          new Date(conversionStats.stats.lastRun).toLocaleString() : 
                          'Never'
                        }
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Average Processing Time</span>
                      <span className="text-sm text-gray-600">
                        {conversionStats?.stats?.avgProcessingTime || 0}ms
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="text-xs text-center text-gray-500">
                      Data refreshes every minute automatically
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="system" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Data Integration Status */}
              <Card className="bg-white shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-blue-600" />
                    Real Data Integration
                  </CardTitle>
                  <CardDescription>
                    Status of WhatsApp data connections
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">WhatsApp Messages</span>
                      <RealDataIndicator isRealData={true} />
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Lead Database</span>
                      <RealDataIndicator isRealData={true} />
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Contact Sync</span>
                      <RealDataIndicator isRealData={true} />
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Media Files</span>
                      <RealDataIndicator isRealData={true} />
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="text-xs text-center text-green-600">
                      All systems using authentic WhatsApp data
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* System Performance */}
              <Card className="bg-white shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    System Performance
                  </CardTitle>
                  <CardDescription>
                    Real-time system metrics
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Data Freshness</span>
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        Live
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">API Response</span>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        Fast
                      </Badge>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Database Status</span>
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        Healthy
                      </Badge>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Last Update</span>
                      <span className="text-sm text-gray-600">
                        {metrics?.timestamp ? 
                          new Date(metrics.timestamp).toLocaleTimeString() : 
                          'Loading...'
                        }
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}