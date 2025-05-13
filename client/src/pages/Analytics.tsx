import { useState } from "react";
import { Helmet } from "react-helmet";
import { useQuery } from "@tanstack/react-query";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lead, Activity, Message, DashboardStats } from "@shared/schema";
import { 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  Cell 
} from "recharts";

export default function Analytics() {
  const [timeframe, setTimeframe] = useState("30days");
  
  // Fetch all leads
  const { data: leads, isLoading: leadsLoading } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
  });
  
  // Fetch all activities
  const { data: activities, isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
  });
  
  // Fetch all messages
  const { data: messages, isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages", { recent: true, limit: 1000 }],
  });
  
  // Fetch dashboard stats
  const { data: dashboardStats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard-stats"],
  });
  
  const isLoading = leadsLoading || activitiesLoading || messagesLoading || statsLoading;

  // Calculate leads by source
  const leadsBySource = leads ? calculateLeadsBySource(leads) : [];
  
  // Calculate leads by status
  const leadsByStatus = dashboardStats?.leadsByStatus ? 
    Object.entries(dashboardStats.leadsByStatus).map(([status, count]) => ({
      name: formatStatus(status),
      value: count,
    })) : [];
  
  // Calculate sales performance over time (mock data for now)
  const salesPerformance = generateSalesPerformanceData(timeframe);
  
  // Calculate lead score distribution
  const leadScoreDistribution = leads ? calculateLeadScoreDistribution(leads) : [];
  
  // Calculate message engagement
  const messageEngagement = messages ? calculateMessageEngagement(messages) : [];

  // Chart colors
  const COLORS = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'];

  // Helper function to format status
  function formatStatus(status: string): string {
    if (!status) return 'Unknown';
    
    switch (status) {
      case 'new': return 'New';
      case 'contacted': return 'Contacted';
      case 'meeting': return 'Meeting';
      case 'closed-won': return 'Won';
      case 'closed-lost': return 'Lost';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  }

  // Calculate leads by source
  function calculateLeadsBySource(leads: Lead[]) {
    const sourceMap = new Map<string, number>();
    
    leads.forEach(lead => {
      const source = lead.source || 'Unknown';
      sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
    });
    
    const totalLeads = leads.length;
    
    return Array.from(sourceMap.entries())
      .map(([source, count]) => ({
        name: source.charAt(0).toUpperCase() + source.slice(1),
        value: count,
        percentage: Math.round((count / totalLeads) * 100),
      }))
      .sort((a, b) => b.value - a.value);
  }

  // Calculate lead score distribution
  function calculateLeadScoreDistribution(leads: Lead[]) {
    const ranges = [
      { range: '0-20', min: 0, max: 20, count: 0 },
      { range: '21-40', min: 21, max: 40, count: 0 },
      { range: '41-60', min: 41, max: 60, count: 0 },
      { range: '61-80', min: 61, max: 80, count: 0 },
      { range: '81-100', min: 81, max: 100, count: 0 },
    ];
    
    leads.forEach(lead => {
      if (lead.score !== undefined && lead.score !== null) {
        const range = ranges.find(r => lead.score! >= r.min && lead.score! <= r.max);
        if (range) {
          range.count++;
        }
      }
    });
    
    return ranges.map(r => ({
      name: r.range,
      value: r.count,
    }));
  }

  // Calculate message engagement
  function calculateMessageEngagement(messages: Message[]) {
    const channelMap = new Map<string, number>();
    
    messages.forEach(message => {
      const channel = message.channel || 'Unknown';
      channelMap.set(channel, (channelMap.get(channel) || 0) + 1);
    });
    
    return Array.from(channelMap.entries())
      .map(([channel, count]) => ({
        name: channel.charAt(0).toUpperCase() + channel.slice(1),
        value: count,
      }))
      .sort((a, b) => b.value - a.value);
  }

  // Generate mock sales performance data
  function generateSalesPerformanceData(timeframe: string) {
    const data = [];
    const now = new Date();
    let totalDays;
    
    switch (timeframe) {
      case '7days':
        totalDays = 7;
        break;
      case '30days':
        totalDays = 30;
        break;
      case '90days':
        totalDays = 90;
        break;
      default:
        totalDays = 30;
    }
    
    // Use the actual leads data we have, but distribute them over time
    const totalLeads = leads?.length || 0;
    const leadsPerDay = Math.max(1, Math.ceil(totalLeads / totalDays));
    
    for (let i = totalDays - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      const leads = Math.floor(leadsPerDay * (0.8 + Math.random() * 0.4));
      const conversions = Math.floor(leads * (0.2 + Math.random() * 0.3));
      
      data.push({
        date: date.toISOString().split('T')[0],
        leads,
        conversions,
      });
    }
    
    return data;
  }

  return (
    <>
      <Helmet>
        <title>Analytics | GeminiCRM</title>
        <meta name="description" content="Analyze your CRM performance with detailed charts and metrics" />
      </Helmet>

      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 md:hidden">Analytics</h1>
          <p className="text-sm text-gray-500">
            Analyze your CRM performance and customer engagement
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">Timeframe:</span>
          <Select 
            value={timeframe} 
            onValueChange={setTimeframe}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Select timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">Last 7 days</SelectItem>
              <SelectItem value="30days">Last 30 days</SelectItem>
              <SelectItem value="90days">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <span className="material-icons mr-1 text-sm">download</span>
            Export
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="animate-pulse h-6 bg-gray-200 rounded w-1/3 mb-1"></div>
                <div className="animate-pulse h-4 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="animate-pulse h-60 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Leads by Source */}
            <Card>
              <CardHeader>
                <CardTitle>Leads by Source</CardTitle>
                <CardDescription>
                  Distribution of leads by acquisition channel
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={leadsBySource}
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percentage }) => `${name}: ${percentage}%`}
                      >
                        {leadsBySource.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} leads`, 'Count']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Leads by Status */}
            <Card>
              <CardHeader>
                <CardTitle>Pipeline Status</CardTitle>
                <CardDescription>
                  Distribution of leads by sales pipeline stage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={leadsByStatus}
                      layout="vertical"
                      margin={{ top: 20, right: 30, left: 60, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" />
                      <Tooltip formatter={(value) => [`${value} leads`, 'Count']} />
                      <Legend />
                      <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 mb-6">
            {/* Sales Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Sales Performance</CardTitle>
                <CardDescription>
                  Lead acquisition and conversion metrics over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={salesPerformance}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="leads" stroke="#3b82f6" activeDot={{ r: 8 }} />
                      <Line type="monotone" dataKey="conversions" stroke="#10b981" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Lead Score Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Lead Quality</CardTitle>
                <CardDescription>
                  Distribution of lead scores (AI-generated)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={leadScoreDistribution}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`${value} leads`, 'Count']} />
                      <Legend />
                      <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Message Engagement */}
            <Card>
              <CardHeader>
                <CardTitle>Communication Channels</CardTitle>
                <CardDescription>
                  Engagement across different messaging channels
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={messageEngagement}
                        innerRadius={0}
                        outerRadius={90}
                        paddingAngle={0}
                        dataKey="value"
                        nameKey="name"
                        label
                      >
                        {messageEngagement.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} messages`, 'Count']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
