import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  Building2,
  Home,
  Briefcase,
  FolderKanban,
  Calculator,
  Newspaper,
  Link2,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface UnifiedAnalytics {
  crm: {
    totalContacts: number;
    totalCompanies: number;
    totalProperties: number;
    totalDeals: number;
    dealsByStage: Record<string, number>;
    recentDeals: number;
    pipelineValue: number;
  };
  dueDiligence: {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    projectsByStatus: Record<string, number>;
  };
  modeling: {
    totalProjects: number;
    recentProjects: number;
  };
  intelligence: {
    totalArticles: number;
    recentArticles: number;
  };
  crossModule: {
    dealsWithDDProjects: number;
    dealsWithModelingProjects: number;
    propertiesWithDeals: number;
    contactsWithDeals: number;
  };
  lastUpdated: string;
}

interface TrendData {
  trends: Array<{
    month: string;
    label: string;
    deals: number;
    projects: number;
    articles: number;
  }>;
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export function UnifiedAnalyticsPanel() {
  const { data: analytics, isLoading: analyticsLoading } = useQuery<UnifiedAnalytics>({
    queryKey: ["/api/analytics/unified"],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: trends, isLoading: trendsLoading } = useQuery<TrendData>({
    queryKey: ["/api/analytics/unified/trends"],
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  if (analyticsLoading) {
    return <UnifiedAnalyticsSkeleton />;
  }

  if (!analytics) {
    return null;
  }

  const dealIntegrationRate = analytics.crm.totalDeals > 0
    ? Math.round((analytics.crossModule.dealsWithDDProjects / analytics.crm.totalDeals) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<Users className="h-5 w-5 text-blue-500" />}
          label="CRM Entities"
          value={analytics.crm.totalContacts + analytics.crm.totalCompanies + analytics.crm.totalProperties}
          breakdown={`${analytics.crm.totalContacts} contacts, ${analytics.crm.totalCompanies} companies, ${analytics.crm.totalProperties} properties`}
          testId="metric-crm-entities"
        />
        <MetricCard
          icon={<Briefcase className="h-5 w-5 text-green-500" />}
          label="Active Deals"
          value={analytics.crm.totalDeals}
          breakdown={`${analytics.crm.recentDeals} new this month`}
          testId="metric-deals"
        />
        <MetricCard
          icon={<DollarSign className="h-5 w-5 text-amber-500" />}
          label="Pipeline Value"
          value={formatCurrency(analytics.crm.pipelineValue)}
          isFormatted
          testId="metric-pipeline-value"
        />
        <MetricCard
          icon={<FolderKanban className="h-5 w-5 text-purple-500" />}
          label="Due Diligence"
          value={analytics.dueDiligence.totalProjects}
          breakdown={`${analytics.dueDiligence.activeProjects} active, ${analytics.dueDiligence.completedProjects} completed`}
          testId="metric-dd-projects"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card data-testid="cross-module-connections">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Cross-Module Connections
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Deals with Due Diligence</span>
                <span className="font-medium">{analytics.crossModule.dealsWithDDProjects}</span>
              </div>
              <Progress value={dealIntegrationRate} className="h-2" />
              <span className="text-xs text-muted-foreground">{dealIntegrationRate}% integration rate</span>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="text-center p-2 bg-muted/50 rounded">
                <div className="text-lg font-semibold">{analytics.crossModule.propertiesWithDeals}</div>
                <div className="text-xs text-muted-foreground">Properties in Deals</div>
              </div>
              <div className="text-center p-2 bg-muted/50 rounded">
                <div className="text-lg font-semibold">{analytics.crossModule.contactsWithDeals}</div>
                <div className="text-xs text-muted-foreground">Contacts in Deals</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="modeling-intelligence">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Modeling & Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <div className="text-2xl font-bold">{analytics.modeling.totalProjects}</div>
                  <div className="text-xs text-muted-foreground">Modeling Projects</div>
                </div>
                <div className="text-sm">
                  <Badge variant="secondary">{analytics.modeling.recentProjects} recent</Badge>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-2xl font-bold">{analytics.intelligence.totalArticles}</div>
                  <div className="text-xs text-muted-foreground">DockTalk Articles</div>
                </div>
                <div className="text-sm">
                  <Badge variant="secondary">{analytics.intelligence.recentArticles} this month</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="deal-stages">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Deals by Stage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(analytics.crm.dealsByStage).slice(0, 5).map(([stage, count]) => (
                <div key={stage} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{stage.replace(/_/g, ' ')}</span>
                  <Badge variant="outline">{count}</Badge>
                </div>
              ))}
              {Object.keys(analytics.crm.dealsByStage).length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No deals found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {trends && trends.trends && trends.trends.length > 0 && (
        <Card data-testid="activity-trends">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Activity Trends (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends.trends}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="deals" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    name="Deals"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="projects" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    name="Due Diligence"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="articles" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    name="Articles"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  breakdown?: string;
  isFormatted?: boolean;
  testId: string;
}

function MetricCard({ icon, label, value, breakdown, isFormatted, testId }: MetricCardProps) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted rounded-lg">{icon}</div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground truncate">{label}</div>
            <div className="text-xl font-bold">
              {isFormatted ? value : value.toLocaleString()}
            </div>
            {breakdown && (
              <div className="text-xs text-muted-foreground truncate">{breakdown}</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UnifiedAnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default UnifiedAnalyticsPanel;
