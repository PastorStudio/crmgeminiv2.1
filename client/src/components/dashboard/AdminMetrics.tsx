import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { MessageSquare, Bot, Users, Activity, Wifi, CheckCircle, AlertCircle, Clock } from "lucide-react";

export default function AdminMetrics() {
  const { data: adminMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['/api/admin/metrics'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const { data: agentPerformance, isLoading: agentLoading } = useQuery({
    queryKey: ['/api/admin/agent-performance'],
    refetchInterval: 30000
  });

  const { data: systemHealth, isLoading: healthLoading } = useQuery({
    queryKey: ['/api/admin/system-health'],
    refetchInterval: 15000 // More frequent health checks
  });

  if (metricsLoading || agentLoading || healthLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="space-y-0 pb-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-6 bg-gray-200 rounded w-1/2 mt-2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-3 bg-gray-200 rounded w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <div className="space-y-6">
      {/* System Health Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">WhatsApp Connection</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Badge variant={systemHealth?.whatsappConnected ? "default" : "destructive"}>
                {systemHealth?.whatsappConnected ? "Connected" : "Disconnected"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {systemHealth?.connectedAccounts || 0} accounts
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Processor</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Badge variant={systemHealth?.aiProcessorActive ? "default" : "secondary"}>
                {systemHealth?.aiProcessorActive ? "Active" : "Inactive"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {systemHealth?.processedToday || 0} processed today
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-bold">{systemHealth?.activeAgents || 0}</span>
              <span className="text-sm text-muted-foreground">
                of {systemHealth?.totalAgents || 0} total
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Communication Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Today</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{adminMetrics?.messagesReceivedToday || 0}</div>
            <p className="text-xs text-muted-foreground">
              +{adminMetrics?.messagesSentToday || 0} sent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI vs Human</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {adminMetrics?.aiResponseRate ? `${Math.round(adminMetrics.aiResponseRate)}%` : '0%'}
            </div>
            <p className="text-xs text-muted-foreground">
              AI handling rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {adminMetrics?.averageResponseTime ? `${Math.round(adminMetrics.averageResponseTime)}s` : '0s'}
            </div>
            <p className="text-xs text-muted-foreground">
              Average response
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {adminMetrics?.conversionRate ? `${Math.round(adminMetrics.conversionRate)}%` : '0%'}
            </div>
            <p className="text-xs text-muted-foreground">
              Chat to lead conversion
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Performance Chart */}
      {agentPerformance && agentPerformance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Agent Performance</CardTitle>
            <CardDescription>Messages handled and response times by agent</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={agentPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="agentName" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="messagesHandled" fill="#8884d8" name="Messages Handled" />
                <Bar dataKey="averageResponseTime" fill="#82ca9d" name="Avg Response Time (s)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Message Distribution */}
      {adminMetrics?.messageChannels && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Message Channels</CardTitle>
              <CardDescription>Distribution of messages by channel</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={adminMetrics.messageChannels}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {adminMetrics.messageChannels.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Daily Activity Trend</CardTitle>
              <CardDescription>Messages over the last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={adminMetrics?.dailyActivity || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="messages" stroke="#8884d8" strokeWidth={2} />
                  <Line type="monotone" dataKey="leads" stroke="#82ca9d" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}