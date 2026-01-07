import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Building2, 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Users, 
  Percent,
  AlertCircle,
  Calendar,
  ArrowRight,
  FileText,
  Clock,
  ChevronRight
} from "lucide-react";
import { Link } from "wouter";
import { formatCurrency, formatPercent } from "@/lib/utils";

type DashboardMetrics = {
  totalGrossRent: number;
  totalNetRent: number;
  occupancyRate: number;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  averageRentPerUnit: number;
  leaseExpirations: { month: string; count: number; rent: number }[];
  recentActivity: { type: string; description: string; date: string }[];
  projectCount: number;
  tenantCount: number;
  activeLeaseCount: number;
  pendingRenewalCount: number;
};

function MetricCard({ 
  title, 
  value, 
  subValue, 
  icon: Icon, 
  trend,
  loading 
}: { 
  title: string; 
  value: string; 
  subValue?: string; 
  icon: any;
  trend?: { direction: 'up' | 'down'; value: string };
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card data-testid={`metric-card-${title.toLowerCase().replace(/\s/g, '-')}`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subValue && (
              <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            {trend && (
              <div className={`flex items-center text-xs ${
                trend.direction === 'up' ? 'text-green-500' : 'text-red-500'
              }`}>
                {trend.direction === 'up' ? (
                  <TrendingUp className="h-3 w-3 mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-1" />
                )}
                {trend.value}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ExpirationTimeline({ data, loading }: { data: DashboardMetrics['leaseExpirations']; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="lease-expiration-timeline">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Upcoming Lease Expirations
        </CardTitle>
        <CardDescription>Next 12 months by rental revenue at risk</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No lease expirations in the next 12 months
          </p>
        ) : (
          <div className="space-y-3">
            {data.slice(0, 6).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <Badge variant={item.count > 5 ? "destructive" : "secondary"}>
                    {item.count}
                  </Badge>
                  <span className="text-sm font-medium">{item.month}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {formatCurrency(item.rent)} at risk
                </span>
              </div>
            ))}
          </div>
        )}
        <Link href="/operations/rent-roll/leases?filter=expiring">
          <Button variant="ghost" className="w-full mt-4" size="sm" data-testid="btn-view-all-expirations">
            View All Expirations
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function RecentActivity({ data, loading }: { data: DashboardMetrics['recentActivity']; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'lease': return FileText;
      case 'tenant': return Users;
      case 'payment': return DollarSign;
      default: return Clock;
    }
  };

  return (
    <Card data-testid="recent-activity">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent activity
          </p>
        ) : (
          <div className="space-y-3">
            {data.slice(0, 5).map((activity, idx) => {
              const ActivityIcon = getActivityIcon(activity.type);
              return (
                <div key={idx} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <ActivityIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">{activity.date}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function RentRollDashboard() {
  const { data: metrics, isLoading, error } = useQuery<DashboardMetrics>({
    queryKey: ['/api/rent-roll/dashboard'],
    staleTime: 60 * 1000,
  });

  const defaultMetrics: DashboardMetrics = {
    totalGrossRent: 0,
    totalNetRent: 0,
    occupancyRate: 0,
    totalUnits: 0,
    occupiedUnits: 0,
    vacantUnits: 0,
    averageRentPerUnit: 0,
    leaseExpirations: [],
    recentActivity: [],
    projectCount: 0,
    tenantCount: 0,
    activeLeaseCount: 0,
    pendingRenewalCount: 0,
  };

  const data = metrics || defaultMetrics;

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">Failed to load dashboard metrics. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-rent-roll-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="heading-rent-roll-dashboard">
            Rent Roll Dashboard
          </h1>
          <p className="text-muted-foreground">
            Portfolio-wide occupancy, revenue metrics, and lease analytics
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/operations/rent-roll/projects">
            <Button variant="outline" data-testid="btn-view-projects">
              View Projects
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Gross Rent"
          value={formatCurrency(data.totalGrossRent)}
          subValue="Monthly scheduled rent"
          icon={DollarSign}
          loading={isLoading}
        />
        <MetricCard
          title="Occupancy Rate"
          value={formatPercent(data.occupancyRate)}
          subValue={`${data.occupiedUnits ?? 0} of ${data.totalUnits ?? 0} units`}
          icon={Percent}
          loading={isLoading}
        />
        <MetricCard
          title="Active Tenants"
          value={(data.tenantCount ?? 0).toString()}
          subValue={`${data.activeLeaseCount ?? 0} active leases`}
          icon={Users}
          loading={isLoading}
        />
        <MetricCard
          title="Avg Rent/Unit"
          value={formatCurrency(data.averageRentPerUnit)}
          subValue="Per occupied unit"
          icon={Building2}
          loading={isLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card data-testid="quick-stats">
            <CardHeader>
              <CardTitle className="text-lg">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Projects</p>
                  <p className="text-2xl font-bold">{isLoading ? '-' : (data.projectCount ?? 0)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Vacant Units</p>
                  <p className="text-2xl font-bold">{isLoading ? '-' : (data.vacantUnits ?? 0)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Pending Renewals</p>
                  <p className="text-2xl font-bold">{isLoading ? '-' : (data.pendingRenewalCount ?? 0)}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Net Rent</p>
                  <p className="text-2xl font-bold">{isLoading ? '-' : formatCurrency(data.totalNetRent ?? 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <RecentActivity data={data.recentActivity ?? []} loading={isLoading} />
        </div>

        <ExpirationTimeline data={data.leaseExpirations ?? []} loading={isLoading} />
      </div>
    </div>
  );
}
