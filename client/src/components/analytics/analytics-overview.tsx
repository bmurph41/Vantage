import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Target, 
  Users, 
  Building, 
  CheckCircle,
  Handshake,
  Calendar,
  Activity,
  PieChart,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  AlertCircle
} from "lucide-react";

interface AnalyticsOverview {
  totalDeals: number;
  wonDeals: number;
  lostDeals: number;
  activeDeals: number;
  totalRevenue: number;
  conversionRate: number;
  averageDealSize: number;
  totalContacts: number;
  totalCompanies: number;
  totalTasks: number;
  completedTasks: number;
}

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: string;
  trendUp?: boolean;
  subtitle?: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
  gradient?: string;
}

function MetricCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendUp, 
  subtitle, 
  badge, 
  badgeVariant = "default",
  gradient = "from-blue-500 to-blue-600"
}: MetricCardProps) {
  const trendDescription = trend ? `${trendUp ? 'increased' : 'decreased'} by ${trend} compared to last month` : '';
  
  return (
    <Card 
      className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 group focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2"
      role="article"
      aria-labelledby={`metric-${title.replace(/\s+/g, '-').toLowerCase()}`}
      tabIndex={0}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-5 group-hover:opacity-10 transition-opacity`} />
      <CardContent className="p-4 sm:p-6 relative">
        <div className="flex items-start justify-between mb-3 sm:mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <p 
                id={`metric-${title.replace(/\s+/g, '-').toLowerCase()}`}
                className="text-sm font-medium text-muted-foreground truncate"
              >
                {title}
              </p>
              {badge && (
                <Badge 
                  variant={badgeVariant} 
                  className="text-xs px-2 py-0.5 shrink-0"
                  aria-label={`Status: ${badge}`}
                >
                  {badge}
                </Badge>
              )}
            </div>
            <p 
              className="text-2xl sm:text-3xl font-bold text-foreground mb-1 break-all"
              aria-label={`${title} value: ${value}`}
            >
              {value}
            </p>
            {subtitle && (
              <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2" aria-label={`Description: ${subtitle}`}>
                {subtitle}
              </p>
            )}
          </div>
          <div 
            className={`p-2 sm:p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg shrink-0 ml-2`}
            aria-hidden="true"
          >
            <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
        </div>
        
        {trend && (
          <div 
            className={`flex items-center gap-1 text-xs sm:text-sm font-medium ${
              trendUp ? 'text-green-600' : 'text-red-600'
            }`}
            aria-label={trendDescription}
          >
            {trendUp ? (
              <ArrowUpRight className="w-3 h-3 sm:w-4 sm:h-4" aria-hidden="true" />
            ) : (
              <ArrowDownRight className="w-3 h-3 sm:w-4 sm:h-4" aria-hidden="true" />
            )}
            <span aria-hidden="true">{trend}</span>
            <span className="text-muted-foreground ml-1 hidden sm:inline" aria-hidden="true">vs last month</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface AnalyticsInsights {
  activityScore: number;
}

interface AnalyticsOverviewProps {
  dateRange?: {
    from: Date | undefined;
    to: Date | undefined;
  };
}

export default function AnalyticsOverview({ dateRange }: AnalyticsOverviewProps) {
  const { toast } = useToast();
  const { data: overview, isLoading, error, refetch } = useQuery<AnalyticsOverview>({
    queryKey: ['/api/analytics/overview', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange?.from) {
        params.append('startDate', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        params.append('endDate', dateRange.to.toISOString());
      }
      
      const response = await fetch(`/api/analytics/overview?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics overview: ${response.status} ${response.statusText}`);
      }
      return response.json();
    },
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
  });

  // Fetch insights data
  const { data: insights } = useQuery<AnalyticsInsights>({
    queryKey: ['/api/analytics/insights', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange?.from) {
        params.append('startDate', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        params.append('endDate', dateRange.to.toISOString());
      }
      
      const response = await fetch(`/api/analytics/insights?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics insights: ${response.status} ${response.statusText}`);
      }
      return response.json();
    },
    retry: 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
  });

  // Handle errors with toast
  if (error && !isLoading) {
    toast({
      title: "Failed to load analytics overview",
      description: error instanceof Error ? error.message : "Please try again later.",
      variant: "destructive",
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        {/* Primary KPIs Loading */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="relative overflow-hidden border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                      <div className="h-8 bg-gray-200 rounded w-20 mb-1"></div>
                      <div className="h-3 bg-gray-200 rounded w-16"></div>
                    </div>
                    <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
                  </div>
                  <div className="h-4 bg-gray-200 rounded w-28"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Secondary Metrics Loading */}
        <div>
          <div className="h-6 bg-gray-200 rounded w-40 mb-4"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="relative overflow-hidden border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="animate-pulse">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
                        <div className="h-8 bg-gray-200 rounded w-16 mb-1"></div>
                        <div className="h-3 bg-gray-200 rounded w-14"></div>
                      </div>
                      <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Operational Metrics Loading */}
        <div>
          <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="relative overflow-hidden border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="animate-pulse">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                        <div className="h-8 bg-gray-200 rounded w-18 mb-1"></div>
                        <div className="h-3 bg-gray-200 rounded w-20"></div>
                      </div>
                      <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
                    </div>
                    <div className="h-4 bg-gray-200 rounded w-16"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="flex flex-col items-center gap-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <div>
            <p className="text-gray-900 font-medium">Failed to load analytics data</p>
            <p className="text-gray-500 text-sm mt-1">
              {error instanceof Error ? error.message : "Something went wrong"}
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No analytics data available</p>
      </div>
    );
  }

  const taskCompletionRate = overview.totalTasks > 0 ? Math.round((overview.completedTasks / overview.totalTasks) * 100) : 0;
  const winRate = overview.totalDeals > 0 ? Math.round((overview.wonDeals / overview.totalDeals) * 100) : 0;

  return (
          <div className="space-y-6 lg:space-y-8">
        {/* Primary KPIs - QuickBooks style hero metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <MetricCard
          title="Total Revenue"
          value={`$${overview.totalRevenue.toLocaleString()}`}
          subtitle="All-time closed won deals"
          icon={DollarSign}
          gradient="from-green-500 to-emerald-600"
          trend="+12.5%"
          trendUp={true}
          badge="YTD"
          badgeVariant="secondary"
        />
        
        <MetricCard
          title="Pipeline Value"
          value={`$${(overview.activeDeals * overview.averageDealSize).toLocaleString()}`}
          subtitle="Active opportunities"
          icon={PieChart}
          gradient="from-blue-500 to-blue-600"
          trend="+8.3%"
          trendUp={true}
          badge="Active"
        />
        
        <MetricCard
          title="Win Rate"
          value={`${winRate}%`}
          subtitle="Deals closed successfully"
          icon={Target}
          gradient="from-purple-500 to-purple-600"
          trend="+2.1%"
          trendUp={true}
        />
        
        <MetricCard
          title="Average Deal Size"
          value={`$${overview.averageDealSize.toLocaleString()}`}
          subtitle="Per closed opportunity"
          icon={BarChart3}
          gradient="from-orange-500 to-orange-600"
          trend="-5.2%"
          trendUp={false}
        />
      </div>

      {/* Secondary Metrics - Sales Performance */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Sales Performance
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <MetricCard
            title="Active Deals"
            value={overview.activeDeals.toString()}
            subtitle="In pipeline"
            icon={Handshake}
            gradient="from-blue-500 to-blue-600"
            badge="Open"
            badgeVariant="outline"
          />
          
          <MetricCard
            title="Won Deals"
            value={overview.wonDeals.toString()}
            subtitle="Successfully closed"
            icon={CheckCircle}
            gradient="from-green-500 to-green-600"
            trend="+15"
            trendUp={true}
          />
          
          <MetricCard
            title="Lost Deals"
            value={overview.lostDeals.toString()}
            subtitle="Closed unsuccessful"
            icon={TrendingDown}
            gradient="from-red-500 to-red-600"
            trend="-3"
            trendUp={true}
          />
          
          <MetricCard
            title="Conversion Rate"
            value={`${overview.conversionRate.toFixed(2)}%`}
            subtitle="Lead to customer"
            icon={TrendingUp}
            gradient="from-indigo-500 to-indigo-600"
            trend="+1.8%"
            trendUp={true}
          />
        </div>
      </div>

      {/* Operational Metrics */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Customer & Operations
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <MetricCard
            title="Total Contacts"
            value={overview.totalContacts.toString()}
            subtitle="In CRM database"
            icon={Users}
            gradient="from-blue-500 to-blue-600"
            trend="+24"
            trendUp={true}
          />
          
          <MetricCard
            title="Companies"
            value={overview.totalCompanies.toString()}
            subtitle="Active accounts"
            icon={Building}
            gradient="from-slate-500 to-slate-600"
            trend="+7"
            trendUp={true}
          />
          
          <MetricCard
            title="Task Completion"
            value={`${taskCompletionRate}%`}
            subtitle={`${overview.completedTasks}/${overview.totalTasks} completed`}
            icon={Calendar}
            gradient="from-violet-500 to-violet-600"
            badge={taskCompletionRate >= 80 ? "Excellent" : taskCompletionRate >= 60 ? "Good" : "Needs Attention"}
            badgeVariant={taskCompletionRate >= 80 ? "default" : taskCompletionRate >= 60 ? "secondary" : "destructive"}
          />
          
          <MetricCard
            title="Activity Score"
            value={insights?.activityScore?.toString() || "0"}
            subtitle="Team productivity index"
            icon={Activity}
            gradient="from-pink-500 to-pink-600"
            trend="+5 pts"
            trendUp={true}
            badge={insights?.activityScore && insights.activityScore >= 80 ? "High" : insights?.activityScore && insights.activityScore >= 60 ? "Medium" : "Low"}
          />
        </div>
      </div>
    </div>
  );
}

