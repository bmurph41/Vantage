import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Target, TrendingUp, Phone, Mail, Calendar, Users, 
  ArrowUpRight, ArrowDownRight, Minus, RefreshCcw, Loader2
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { format, formatDistanceToNow } from "date-fns";

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
                <span className="ml-1">{Math.abs(change)}% {changeLabel || 'vs last week'}</span>
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

export default function ProspectingDashboard() {
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

  const { data: settings } = useQuery<{
    weeklyCallsGoal?: number;
    weeklyEmailsGoal?: number;
    weeklyLeadsGoal?: number;
    weeklyDealsGoal?: number;
  }>({
    queryKey: ['/api/prospecting/settings'],
  });

  const { data: leads } = useQuery<any[]>({
    queryKey: ['/api/leads'],
  });

  const { data: deals } = useQuery<any[]>({
    queryKey: ['/api/deals'],
  });

  const { data: activities, isLoading: isLoadingActivities } = useQuery<any[]>({
    queryKey: ['/api/activities'],
  });

  const handleRefresh = () => {
    refetchStats();
    queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
    queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
    queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
  };

  const leadsArray = Array.isArray(leads) ? leads : [];
  const dealsArray = Array.isArray(deals) ? deals : [];
  const activitiesArray = Array.isArray(activities) ? activities : [];
  
  const leadsCount = leadsArray.length;
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const newLeadsThisWeek = leadsArray.filter((l: any) => {
    const createdAt = new Date(l.createdAt);
    return createdAt >= weekAgo;
  }).length;

  const newDealsThisWeek = dealsArray.filter((d: any) => {
    const createdAt = new Date(d.createdAt);
    return createdAt >= weekAgo;
  }).length;

  const callsGoal = settings?.weeklyCallsGoal || 50;
  const emailsGoal = settings?.weeklyEmailsGoal || 100;
  const leadsGoal = settings?.weeklyLeadsGoal || 20;
  const dealsGoal = settings?.weeklyDealsGoal || 5;

  const currentCalls = stats?.callsMade || 0;
  const currentEmails = stats?.emailsSent || 0;

  const totalTouches = currentCalls + currentEmails;
  const conversations = leadsArray.filter((l: any) => l.status === 'contacted' || l.status === 'qualified' || l.status === 'converted').length;
  const qualified = leadsArray.filter((l: any) => l.status === 'qualified' || l.status === 'converted').length;
  const dealsCreated = dealsArray.length;

  const conversationsRate = totalTouches > 0 ? Math.round((conversations / totalTouches) * 100) : 0;
  const qualifiedRate = totalTouches > 0 ? Math.round((qualified / totalTouches) * 100) : 0;
  const dealsRate = totalTouches > 0 ? Math.round((dealsCreated / totalTouches) * 100) : 0;

  const recentActivities = activitiesArray
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="flex-1 overflow-auto p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">Prospecting Dashboard</h1>
            <p className="text-gray-500 mt-1">Track your outreach velocity and lead generation</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} data-testid="button-refresh">
            <RefreshCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
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
            title="New This Week"
            value={newLeadsThisWeek}
            change={stats?.leadsChange}
            icon={Target}
            color="bg-green-500"
            isLoading={isLoadingStats}
          />
          <KpiCard
            title="Calls Made"
            value={currentCalls}
            change={stats?.callsChange}
            icon={Phone}
            color="bg-purple-500"
            isLoading={isLoadingStats}
          />
          <KpiCard
            title="Emails Sent"
            value={currentEmails}
            change={stats?.emailsChange}
            icon={Mail}
            color="bg-orange-500"
            isLoading={isLoadingStats}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-lg">Conversion Funnel</CardTitle>
              <CardDescription>Track leads through your pipeline</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Touches ({totalTouches})</span>
                  <div className="flex items-center">
                    <div className="w-48 h-2 bg-gray-200 rounded-full mr-3">
                      <div className="w-full h-full bg-blue-500 rounded-full" />
                    </div>
                    <span className="text-sm font-medium">100%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Conversations ({conversations})</span>
                  <div className="flex items-center">
                    <div className="w-48 h-2 bg-gray-200 rounded-full mr-3">
                      <div 
                        className="h-full bg-green-500 rounded-full" 
                        style={{ width: `${conversationsRate}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{conversationsRate}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Qualified ({qualified})</span>
                  <div className="flex items-center">
                    <div className="w-48 h-2 bg-gray-200 rounded-full mr-3">
                      <div 
                        className="h-full bg-yellow-500 rounded-full" 
                        style={{ width: `${qualifiedRate}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{qualifiedRate}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Deals Created ({dealsCreated})</span>
                  <div className="flex items-center">
                    <div className="w-48 h-2 bg-gray-200 rounded-full mr-3">
                      <div 
                        className="h-full bg-purple-500 rounded-full" 
                        style={{ width: `${dealsRate}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{dealsRate}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-lg">Weekly Goals</CardTitle>
              <CardDescription>Your progress this week</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Calls</span>
                    <span className="font-medium">{currentCalls} / {callsGoal}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all" 
                      style={{ width: `${Math.min((currentCalls / callsGoal) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Emails</span>
                    <span className="font-medium">{currentEmails} / {emailsGoal}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full">
                    <div 
                      className="h-full bg-green-500 rounded-full transition-all" 
                      style={{ width: `${Math.min((currentEmails / emailsGoal) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">New Leads</span>
                    <span className="font-medium">{newLeadsThisWeek} / {leadsGoal}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full">
                    <div 
                      className="h-full bg-purple-500 rounded-full transition-all" 
                      style={{ width: `${Math.min((newLeadsThisWeek / leadsGoal) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Deals Created</span>
                    <span className="font-medium">{newDealsThisWeek} / {dealsGoal}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full">
                    <div 
                      className="h-full bg-orange-500 rounded-full transition-all" 
                      style={{ width: `${Math.min((newDealsThisWeek / dealsGoal) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            <CardDescription>Your latest prospecting activities</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingActivities ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : recentActivities.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No recent activities found.</p>
                <p className="text-sm mt-1">Start making calls and sending emails to see your activity here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivities.map((activity: any) => (
                  <div key={activity.id} className="flex items-center justify-between py-3 border-b last:border-b-0">
                    <div className="flex items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                        activity.type === 'call' ? 'bg-blue-100' : 
                        activity.type === 'email' ? 'bg-green-100' : 'bg-purple-100'
                      }`}>
                        {activity.type === 'call' ? <Phone className="w-4 h-4 text-blue-600" /> :
                         activity.type === 'email' ? <Mail className="w-4 h-4 text-green-600" /> :
                         <Calendar className="w-4 h-4 text-purple-600" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {activity.subject || activity.description || `${activity.type} activity`}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">{activity.status || 'Logged'}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
