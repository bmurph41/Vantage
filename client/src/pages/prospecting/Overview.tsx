import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Target, TrendingUp, TrendingDown, Phone, Mail, Calendar, Users, 
  ArrowUpRight, ArrowDownRight, Minus, RefreshCcw, Download,
  Briefcase, DollarSign, Handshake, ExternalLink
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Link } from "wouter";

type KpiCardProps = {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  color: string;
  isLoading?: boolean;
};

function KpiCard({ title, value, change, changeLabel, icon: Icon, color, isLoading }: KpiCardProps) {
  const getTrendIcon = () => {
    if (change === undefined) return null;
    if (change > 0) return <ArrowUpRight className="w-3 h-3" />;
    if (change < 0) return <ArrowDownRight className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
  };

  const getTrendColor = () => {
    if (change === undefined) return "text-gray-500";
    if (change > 0) return "text-green-600";
    if (change < 0) return "text-red-600";
    return "text-gray-500";
  };

  return (
    <Card className="bg-white" data-testid={`kpi-card-${title.toLowerCase().replace(/ /g, '-')}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            {isLoading ? (
              <Skeleton className="h-8 w-20 mt-1" />
            ) : (
              <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            )}
            {change !== undefined && (
              <div className={`flex items-center mt-1 text-xs ${getTrendColor()}`}>
                {getTrendIcon()}
                <span className="ml-1">{change > 0 ? '+' : ''}{change}% {changeLabel || 'vs last week'}</span>
              </div>
            )}
          </div>
          <div className={`w-12 h-12 ${color} rounded-full flex items-center justify-center`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type FunnelStage = {
  name: string;
  value: number;
  percentage: number;
  color: string;
};

const sourceData = [
  { source: 'Cold Call', leads: 85, deals: 12, conversion: '14.1%' },
  { source: 'Email Campaign', leads: 120, deals: 8, conversion: '6.7%' },
  { source: 'LoopNet', leads: 45, deals: 6, conversion: '13.3%' },
  { source: 'Crexi', leads: 38, deals: 5, conversion: '13.2%' },
  { source: 'Broker Referral', leads: 28, deals: 8, conversion: '28.6%' },
  { source: 'Direct Owner', leads: 22, deals: 3, conversion: '13.6%' },
];

export default function ProspectingOverview() {
  const [timeRange, setTimeRange] = useState('month');
  const queryClient = useQueryClient();
  
  const { data: stats, isLoading: isLoadingStats, refetch: refetchStats } = useQuery<{
    callsMade: number;
    emailsSent: number;
    leadsGenerated: number;
    meetingsBooked: number;
    callsChange: number;
    emailsChange: number;
    leadsChange: number;
    meetingsChange: number;
  }>({
    queryKey: ['/api/prospecting/dashboard-stats'],
  });

  const { data: leads } = useQuery<any[]>({
    queryKey: ['/api/leads'],
  });

  const { data: deals } = useQuery<any[]>({
    queryKey: ['/api/deals'],
  });

  const handleRefresh = () => {
    refetchStats();
    queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
    queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
  };

  const leadsArray = Array.isArray(leads) ? leads : [];
  const dealsArray = Array.isArray(deals) ? deals : [];
  const leadsCount = leadsArray.length;
  
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const newLeadsThisWeek = leadsArray.filter((l: any) => {
    const createdAt = new Date(l.createdAt);
    return createdAt >= weekAgo;
  }).length;

  const currentCalls = stats?.callsMade || 0;
  const currentEmails = stats?.emailsSent || 0;
  const totalTouches = currentCalls + currentEmails;
  
  const conversations = leadsArray.filter((l: any) => 
    l.status === 'contacted' || l.status === 'qualified' || l.status === 'converted'
  ).length;
  const qualified = leadsArray.filter((l: any) => 
    l.status === 'qualified' || l.status === 'converted'
  ).length;
  const dealsCreated = dealsArray.length;
  const dealsClosed = dealsArray.filter((d: any) => d.stage === 'closed_won').length;

  const pipelineValue = dealsArray.reduce((sum: number, deal: any) => sum + (deal.amount || 0), 0);

  const funnelData: FunnelStage[] = [
    { name: 'Total Touches', value: totalTouches, percentage: 100, color: 'bg-blue-500' },
    { name: 'Conversations', value: conversations, percentage: totalTouches > 0 ? Math.round((conversations / totalTouches) * 100) : 0, color: 'bg-green-500' },
    { name: 'Qualified Leads', value: qualified, percentage: totalTouches > 0 ? Math.round((qualified / totalTouches) * 100) : 0, color: 'bg-yellow-500' },
    { name: 'Deals Created', value: dealsCreated, percentage: totalTouches > 0 ? Math.round((dealsCreated / totalTouches) * 100) : 0, color: 'bg-purple-500' },
    { name: 'Deals Closed', value: dealsClosed, percentage: totalTouches > 0 ? Math.round((dealsClosed / totalTouches) * 100) : 0, color: 'bg-orange-500' },
  ];

  return (
    <div className="flex-1 overflow-auto p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">Prospecting Overview</h1>
            <p className="text-gray-500 mt-1">Track your outreach performance and conversion metrics</p>
          </div>
          <div className="flex items-center space-x-3">
            <Link href="/prospecting/workroom" className="inline-flex">
              <Button variant="default" size="sm" className="flex items-center gap-2" data-testid="button-go-to-workroom">
                <Target className="w-4 h-4" />
                Open Workroom
                <ExternalLink className="w-3 h-3" />
              </Button>
            </Link>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-40" data-testid="select-time-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleRefresh} data-testid="button-refresh">
              <RefreshCcw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" data-testid="button-export">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard
            title="Total Leads"
            value={leadsCount}
            change={stats?.leadsChange}
            icon={Users}
            color="bg-blue-500"
            isLoading={isLoadingStats}
          />
          <KpiCard
            title="Total Touches"
            value={totalTouches.toLocaleString()}
            change={stats?.callsChange}
            icon={Phone}
            color="bg-green-500"
            isLoading={isLoadingStats}
          />
          <KpiCard
            title="Deals Created"
            value={dealsCreated}
            icon={Target}
            color="bg-purple-500"
            isLoading={isLoadingStats}
          />
          <KpiCard
            title="Pipeline Value"
            value={`$${(pipelineValue / 1000000).toFixed(1)}M`}
            icon={DollarSign}
            color="bg-orange-500"
            isLoading={isLoadingStats}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-lg">Conversion Funnel</CardTitle>
              <CardDescription>Track leads through your pipeline stages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {funnelData.map((stage, index) => (
                  <div key={stage.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">{stage.name}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">{stage.value.toLocaleString()}</span>
                        <Badge variant="secondary" className="text-xs">{stage.percentage}%</Badge>
                      </div>
                    </div>
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${stage.color} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.max(stage.percentage, 2)}%` }}
                      />
                    </div>
                    {index < funnelData.length - 1 && stage.value > 0 && (
                      <div className="flex justify-center my-1">
                        <div className="text-xs text-gray-400">
                          {Math.round((funnelData[index + 1].value / stage.value) * 100)}% conversion
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-lg">Activity Breakdown</CardTitle>
              <CardDescription>Distribution of prospecting activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center">
                    <Phone className="w-5 h-5 text-blue-600 mr-3" />
                    <span className="font-medium">Calls Made</span>
                  </div>
                  <span className="text-xl font-bold text-blue-600">{currentCalls}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center">
                    <Mail className="w-5 h-5 text-green-600 mr-3" />
                    <span className="font-medium">Emails Sent</span>
                  </div>
                  <span className="text-xl font-bold text-green-600">{currentEmails}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center">
                    <Calendar className="w-5 h-5 text-purple-600 mr-3" />
                    <span className="font-medium">Meetings Held</span>
                  </div>
                  <span className="text-xl font-bold text-purple-600">{stats?.meetingsBooked || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div className="flex items-center">
                    <Handshake className="w-5 h-5 text-orange-600 mr-3" />
                    <span className="font-medium">Deals Won</span>
                  </div>
                  <span className="text-xl font-bold text-orange-600">{dealsClosed}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-lg">Lead Source Performance</CardTitle>
            <CardDescription>Compare conversion rates by lead source</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Source</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Leads</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Deals</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Conversion</th>
                    <th className="py-3 px-4 text-sm font-medium text-gray-500">Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceData.map((row) => (
                    <tr key={row.source} className="border-b last:border-b-0">
                      <td className="py-3 px-4">
                        <span className="font-medium text-gray-900">{row.source}</span>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600">{row.leads}</td>
                      <td className="py-3 px-4 text-right text-gray-600">{row.deals}</td>
                      <td className="py-3 px-4 text-right">
                        <Badge variant={parseFloat(row.conversion) > 15 ? "default" : "secondary"}>
                          {row.conversion}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              parseFloat(row.conversion) > 20 ? 'bg-green-500' :
                              parseFloat(row.conversion) > 10 ? 'bg-blue-500' :
                              'bg-yellow-500'
                            }`}
                            style={{ width: `${Math.min(parseFloat(row.conversion) * 3, 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
