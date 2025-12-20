import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Target, TrendingUp, Phone, Mail, Calendar, Users, 
  ArrowUpRight, ArrowDownRight, Minus, RefreshCcw 
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

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
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['/api/prospecting/dashboard-stats'],
  });

  const { data: leads } = useQuery({
    queryKey: ['/api/leads'],
  });

  const { data: recentActivity } = useQuery({
    queryKey: ['/api/prospecting/recent-activity'],
  });

  const leadsCount = Array.isArray(leads) ? leads.length : 0;
  const newLeadsThisWeek = Array.isArray(leads) 
    ? leads.filter((l: any) => {
        const createdAt = new Date(l.createdAt);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return createdAt >= weekAgo;
      }).length 
    : 0;

  return (
    <div className="flex-1 overflow-auto p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">Prospecting Dashboard</h1>
            <p className="text-gray-500 mt-1">Track your outreach velocity and lead generation</p>
          </div>
          <Button variant="outline" size="sm" data-testid="button-refresh">
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
            value={stats?.leadsGenerated || 0}
            change={stats?.leadsChange}
            icon={Target}
            color="bg-green-500"
            isLoading={isLoadingStats}
          />
          <KpiCard
            title="Calls Made"
            value={stats?.callsMade || 0}
            change={stats?.callsChange}
            icon={Phone}
            color="bg-purple-500"
            isLoading={isLoadingStats}
          />
          <KpiCard
            title="Emails Sent"
            value={stats?.emailsSent || 0}
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
                  <span className="text-sm text-gray-600">Touches</span>
                  <div className="flex items-center">
                    <div className="w-48 h-2 bg-gray-200 rounded-full mr-3">
                      <div className="w-full h-full bg-blue-500 rounded-full" />
                    </div>
                    <span className="text-sm font-medium">100%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Conversations</span>
                  <div className="flex items-center">
                    <div className="w-48 h-2 bg-gray-200 rounded-full mr-3">
                      <div className="w-3/4 h-full bg-green-500 rounded-full" />
                    </div>
                    <span className="text-sm font-medium">42%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Qualified</span>
                  <div className="flex items-center">
                    <div className="w-48 h-2 bg-gray-200 rounded-full mr-3">
                      <div className="w-1/2 h-full bg-yellow-500 rounded-full" />
                    </div>
                    <span className="text-sm font-medium">28%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Deals Created</span>
                  <div className="flex items-center">
                    <div className="w-48 h-2 bg-gray-200 rounded-full mr-3">
                      <div className="w-1/4 h-full bg-purple-500 rounded-full" />
                    </div>
                    <span className="text-sm font-medium">12%</span>
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
                    <span className="font-medium">24 / 50</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full">
                    <div className="w-[48%] h-full bg-blue-500 rounded-full" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Emails</span>
                    <span className="font-medium">65 / 100</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full">
                    <div className="w-[65%] h-full bg-green-500 rounded-full" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">New Leads</span>
                    <span className="font-medium">{newLeadsThisWeek} / 20</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full">
                    <div 
                      className="h-full bg-purple-500 rounded-full" 
                      style={{ width: `${Math.min((newLeadsThisWeek / 20) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Deals Created</span>
                    <span className="font-medium">3 / 5</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full">
                    <div className="w-[60%] h-full bg-orange-500 rounded-full" />
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
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b last:border-b-0">
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                      i % 3 === 0 ? 'bg-blue-100' : i % 3 === 1 ? 'bg-green-100' : 'bg-purple-100'
                    }`}>
                      {i % 3 === 0 ? <Phone className="w-4 h-4 text-blue-600" /> :
                       i % 3 === 1 ? <Mail className="w-4 h-4 text-green-600" /> :
                       <Calendar className="w-4 h-4 text-purple-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {i % 3 === 0 ? 'Call with Marina Owner' : 
                         i % 3 === 1 ? 'Email sent to broker' : 
                         'Meeting scheduled'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {i} hour{i > 1 ? 's' : ''} ago
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">{i % 2 === 0 ? 'Completed' : 'Logged'}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
