import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  TrendingUp, TrendingDown, Minus, Phone, Mail, Calendar, 
  Target, Handshake, Users, DollarSign, Download, RefreshCcw
} from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatNumber } from "@/lib/utils";

type MetricCardProps = {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  color: string;
};

function MetricCard({ title, value, change, changeLabel, icon: Icon, color }: MetricCardProps) {
  const getTrendIcon = () => {
    if (change === undefined) return null;
    if (change > 0) return <TrendingUp className="w-3 h-3" />;
    if (change < 0) return <TrendingDown className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
  };

  const getTrendColor = () => {
    if (change === undefined) return "text-gray-500";
    if (change > 0) return "text-green-600";
    if (change < 0) return "text-red-600";
    return "text-gray-500";
  };

  return (
    <Card className="bg-white">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
            {change !== undefined && (
              <div className={`flex items-center mt-1 text-xs ${getTrendColor()}`}>
                {getTrendIcon()}
                <span className="ml-1">{change > 0 ? '+' : ''}{change}% {changeLabel || 'vs last period'}</span>
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
  goal: number;
  percentage: number;
  color: string;
};

export default function DealSourcingAnalytics() {
  const [timeRange, setTimeRange] = useState('month');

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

  const { data: settings } = useQuery<{
    weeklyCallsGoal?: number;
    weeklyEmailsGoal?: number;
    weeklyLeadsGoal?: number;
    weeklyDealsGoal?: number;
    weeklyConversationsGoal?: number;
    weeklyQualifiedGoal?: number;
    weeklyDealsClosedGoal?: number;
  }>({
    queryKey: ['/api/prospecting/settings'],
  });

  const { data: leads } = useQuery<any[]>({
    queryKey: ['/api/leads'],
  });

  const { data: deals } = useQuery<any[]>({
    queryKey: ['/api/deals'],
  });

  const leadsArray = leads || [];
  const dealsArray = deals || [];

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

  const touchesGoal = (settings?.weeklyCallsGoal || 50) + (settings?.weeklyEmailsGoal || 100);
  const conversationsGoal = settings?.weeklyConversationsGoal || 25;
  const qualifiedGoal = settings?.weeklyQualifiedGoal || 10;
  const dealsGoal = settings?.weeklyDealsGoal || 5;
  const dealsClosedGoal = settings?.weeklyDealsClosedGoal || 2;

  const funnelData: FunnelStage[] = useMemo(() => [
    { name: 'Total Touches', value: totalTouches, goal: touchesGoal, percentage: Math.min(Math.round((totalTouches / touchesGoal) * 100), 100), color: 'bg-blue-500' },
    { name: 'Conversations', value: conversations, goal: conversationsGoal, percentage: Math.min(Math.round((conversations / conversationsGoal) * 100), 100), color: 'bg-green-500' },
    { name: 'Qualified Leads', value: qualified, goal: qualifiedGoal, percentage: Math.min(Math.round((qualified / qualifiedGoal) * 100), 100), color: 'bg-yellow-500' },
    { name: 'Deals Created', value: dealsCreated, goal: dealsGoal, percentage: Math.min(Math.round((dealsCreated / dealsGoal) * 100), 100), color: 'bg-purple-500' },
    { name: 'Deals Closed', value: dealsClosed, goal: dealsClosedGoal, percentage: Math.min(Math.round((dealsClosed / dealsClosedGoal) * 100), 100), color: 'bg-orange-500' },
  ], [totalTouches, touchesGoal, conversations, conversationsGoal, qualified, qualifiedGoal, dealsCreated, dealsGoal, dealsClosed, dealsClosedGoal]);

  const sourceData = useMemo(() => {
    const sourceStats: Record<string, { leads: number; deals: number }> = {};
    
    leadsArray.forEach((lead: any) => {
      const source = lead.source || 'Unknown';
      if (!sourceStats[source]) {
        sourceStats[source] = { leads: 0, deals: 0 };
      }
      sourceStats[source].leads += 1;
    });
    
    dealsArray.forEach((deal: any) => {
      const source = deal.source || deal.leadSource || 'Unknown';
      if (!sourceStats[source]) {
        sourceStats[source] = { leads: 0, deals: 0 };
      }
      sourceStats[source].deals += 1;
    });
    
    return Object.entries(sourceStats)
      .map(([source, stats]) => ({
        source,
        leads: stats.leads,
        deals: stats.deals,
        conversion: stats.leads > 0 ? `${((stats.deals / stats.leads) * 100).toFixed(1)}%` : '0%'
      }))
      .sort((a, b) => b.leads - a.leads);
  }, [leadsArray, dealsArray]);

  const pipelineValue = dealsArray.reduce((sum: number, deal: any) => sum + (deal.amount || 0), 0);
  const avgDealSize = dealsArray.length > 0 ? pipelineValue / dealsArray.length : 0;

  const handleRefresh = () => {
    refetchStats();
  };

  return (
    <div className="flex-1 overflow-auto p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">Deal Sourcing Analytics</h1>
            <p className="text-gray-500 mt-1">Track your prospecting performance and conversion metrics</p>
          </div>
          <div className="flex items-center space-x-3">
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
            <Button variant="outline" size="sm" data-testid="button-refresh" onClick={handleRefresh}>
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
          <MetricCard
            title="Total Touches"
            value={formatNumber(totalTouches)}
            change={stats?.callsChange}
            icon={Phone}
            color="bg-blue-500"
          />
          <MetricCard
            title="Conversations"
            value={formatNumber(conversations)}
            change={stats?.leadsChange}
            icon={Users}
            color="bg-green-500"
          />
          <MetricCard
            title="Deals Created"
            value={formatNumber(dealsCreated)}
            icon={Target}
            color="bg-purple-500"
          />
          <MetricCard
            title="Pipeline Value"
            value={`$${formatNumber(pipelineValue)}`}
            icon={DollarSign}
            color="bg-orange-500"
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
                        <span className="text-sm font-medium">{formatNumber(stage.value)} / {formatNumber(stage.goal)}</span>
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
                    <span className="font-medium">Deals Closed</span>
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
                  {sourceData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        No lead source data available yet. Start adding leads to see performance metrics.
                      </td>
                    </tr>
                  ) : (
                    sourceData.map((row) => (
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
