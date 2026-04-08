import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Clock, 
  AlertTriangle, 
  CheckCircle2,
  BarChart3,
  Activity,
  Zap,
  DollarSign,
  PieChart as PieChartIcon,
  XCircle,
  Users,
  Mail
} from "lucide-react";
import { EmailTrackingStats } from "./EmailTrackingStats";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

interface VelocityMetrics {
  averageStageDuration: Record<string, number>;
  stageDurationTrend: Array<{ stageId: string; stageName: string; avgDays: number; count: number }>;
  bottleneckStages: Array<{ stageId: string; stageName: string; avgDays: number; dealCount: number }>;
  fastestDealCycleDays: number;
  slowestDealCycleDays: number;
  averageCycleDays: number;
}

interface SalesVelocity {
  opportunities: number;
  avgValue: number;
  winRate: number;
  avgCycleDays: number;
  salesVelocity: number;
}

interface PipelineHealth {
  totalDeals: number;
  totalPipelineValue: number;
  weightedPipelineValue: number;
  atRiskDeals: number;
  healthyDeals: number;
  stageDistribution: Array<{ stage: string; count: number; value: number; avgProbability: number }>;
}

interface SuccessPredictors {
  topIndicators: Array<{ factor: string; correlation: number; description: string }>;
  riskFactors: Array<{ factor: string; impact: number; description: string }>;
}

interface WinProbabilityDistribution {
  distribution: {
    low: number;
    medium: number;
    high: number;
    veryHigh: number;
  };
  averageWinProbability: number;
}

interface WinLossAnalysis {
  summary: {
    totalDeals: number;
    wonDeals: number;
    lostDeals: number;
    activeDeals: number;
    overallWinRate: number;
    wonValue: number;
    lostValue: number;
  };
  bySource: Array<{ source: string; won: number; lost: number; total: number; winRate: number; value: number }>;
  bySize: Array<{ label: string; won: number; lost: number; total: number; winRate: number; totalValue: number }>;
  byUser: Array<{ userId: string; name: string; won: number; lost: number; total: number; winRate: number; value: number }>;
  byPeriod: Array<{ period: string; won: number; lost: number; total: number; winRate: number }>;
  lostReasons: Array<{ reason: string; count: number }>;
}

interface DealVelocity {
  averageStageDuration: Record<string, number>;
  stageDurationTrend: Array<{ stageId: string; stageName: string; avgDays: number; count: number }>;
  bottleneckStages: Array<{ stageId: string; stageName: string; avgDays: number; dealCount: number }>;
  fastestDealCycleDays: number;
  slowestDealCycleDays: number;
  averageCycleDays: number;
  velocityTrend: Array<{ period: string; avgDays: number; dealCount: number }>;
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function KPICard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  isLoading 
}: { 
  title: string; 
  value: string | number; 
  subtitle?: string; 
  icon: typeof TrendingUp;
  trend?: "up" | "down" | "neutral";
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-16 mb-1" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{title}</span>
          <Icon className={`h-4 w-4 ${
            trend === "up" ? "text-green-500" : 
            trend === "down" ? "text-red-500" : 
            "text-muted-foreground"
          }`} />
        </div>
        <div className="text-2xl font-bold mt-1">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function DealAnalyticsDashboard() {
  const { data: velocityData, isLoading: velocityLoading } = useQuery<VelocityMetrics>({
    queryKey: ["/api/crm/analytics/velocity"],
  });

  const { data: salesVelocity, isLoading: salesLoading } = useQuery<SalesVelocity>({
    queryKey: ["/api/crm/analytics/sales-velocity"],
  });

  const { data: pipelineHealth, isLoading: healthLoading } = useQuery<PipelineHealth>({
    queryKey: ["/api/crm/analytics/pipeline-health"],
  });

  const { data: predictors, isLoading: predictorsLoading } = useQuery<SuccessPredictors>({
    queryKey: ["/api/crm/analytics/success-predictors"],
  });

  const { data: winDistribution, isLoading: distributionLoading } = useQuery<WinProbabilityDistribution>({
    queryKey: ["/api/crm/analytics/win-probability-distribution"],
  });

  const { data: winLossData, isLoading: winLossLoading } = useQuery<WinLossAnalysis>({
    queryKey: ["/api/crm/analytics/win-loss"],
  });

  const { data: dealVelocity, isLoading: dealVelocityLoading } = useQuery<DealVelocity>({
    queryKey: ["/api/crm/analytics/deal-velocity"],
  });

  const isLoading = velocityLoading || salesLoading || healthLoading || predictorsLoading || distributionLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Deal Analytics</h2>
          <p className="text-muted-foreground">
            Pipeline performance metrics and predictive insights
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Sales Velocity"
          value={salesVelocity ? formatCurrency(salesVelocity.salesVelocity) : "$0"}
          subtitle="Per day pipeline velocity"
          icon={Zap}
          trend="up"
          isLoading={salesLoading}
        />
        <KPICard
          title="Win Rate"
          value={salesVelocity ? `${salesVelocity.winRate}%` : "0%"}
          subtitle={`${salesVelocity?.opportunities || 0} opportunities`}
          icon={Target}
          trend={salesVelocity && salesVelocity.winRate > 30 ? "up" : "down"}
          isLoading={salesLoading}
        />
        <KPICard
          title="Avg Cycle Days"
          value={velocityData?.averageCycleDays || 0}
          subtitle={`Fastest: ${velocityData?.fastestDealCycleDays || 0} days`}
          icon={Clock}
          trend="neutral"
          isLoading={velocityLoading}
        />
        <KPICard
          title="Weighted Pipeline"
          value={pipelineHealth ? formatCurrency(pipelineHealth.weightedPipelineValue) : "$0"}
          subtitle={`${pipelineHealth?.totalDeals || 0} active deals`}
          icon={DollarSign}
          trend="up"
          isLoading={healthLoading}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Pipeline Health
            </CardTitle>
            <CardDescription>Deal distribution and risk assessment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {healthLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : pipelineHealth ? (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Healthy Deals</span>
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    {pipelineHealth.healthyDeals}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm">At-Risk Deals</span>
                  </div>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    {pipelineHealth.atRiskDeals}
                  </Badge>
                </div>
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-medium mb-3">Stage Distribution</h4>
                  <div className="space-y-2">
                    {pipelineHealth.stageDistribution.slice(0, 5).map((stage) => (
                      <div key={stage.stage} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="capitalize">{stage.stage.replace(/_/g, " ")}</span>
                          <span className="text-muted-foreground">
                            {stage.count} deals • {formatCurrency(stage.value)}
                          </span>
                        </div>
                        <Progress value={stage.avgProbability} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">No pipeline data available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Win Probability
            </CardTitle>
            <CardDescription>Deal scoring distribution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {distributionLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : winDistribution ? (
              <>
                <div className="text-center pb-4 border-b">
                  <div className="text-4xl font-bold text-primary">
                    {winDistribution.averageWinProbability}%
                  </div>
                  <p className="text-sm text-muted-foreground">Average Win Probability</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-2 rounded bg-red-50">
                    <div className="text-lg font-semibold text-red-600">
                      {winDistribution.distribution.low}
                    </div>
                    <div className="text-xs text-red-500">Low</div>
                  </div>
                  <div className="p-2 rounded bg-amber-50">
                    <div className="text-lg font-semibold text-amber-600">
                      {winDistribution.distribution.medium}
                    </div>
                    <div className="text-xs text-amber-500">Medium</div>
                  </div>
                  <div className="p-2 rounded bg-blue-50">
                    <div className="text-lg font-semibold text-blue-600">
                      {winDistribution.distribution.high}
                    </div>
                    <div className="text-xs text-blue-500">High</div>
                  </div>
                  <div className="p-2 rounded bg-green-50">
                    <div className="text-lg font-semibold text-green-600">
                      {winDistribution.distribution.veryHigh}
                    </div>
                    <div className="text-xs text-green-500">Very High</div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">No probability data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Success Indicators
            </CardTitle>
            <CardDescription>Factors correlated with winning deals</CardDescription>
          </CardHeader>
          <CardContent>
            {predictorsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : predictors?.topIndicators ? (
              <div className="space-y-3">
                {predictors.topIndicators.map((indicator, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-100">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{indicator.factor}</span>
                        <Badge variant="outline" className="text-xs bg-white">
                          +{Math.round(indicator.correlation * 100)}%
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {indicator.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No indicator data available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              Risk Factors
            </CardTitle>
            <CardDescription>Warning signs that may impact deal success</CardDescription>
          </CardHeader>
          <CardContent>
            {predictorsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : predictors?.riskFactors ? (
              <div className="space-y-3">
                {predictors.riskFactors.map((factor, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-100">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{factor.factor}</span>
                        <Badge variant="outline" className="text-xs bg-white text-red-600">
                          {factor.impact}%
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {factor.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No risk factor data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {dealVelocity?.stageDurationTrend && dealVelocity.stageDurationTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              Stage Velocity Analysis
            </CardTitle>
            <CardDescription>
              Average days spent in each pipeline stage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={dealVelocity.stageDurationTrend.map(s => ({
                    ...s,
                    stageName: s.stageName.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())
                  }))}
                  layout="vertical"
                  margin={{ left: 100 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis 
                    dataKey="stageName" 
                    type="category" 
                    tick={{ fontSize: 12 }}
                    width={90}
                  />
                  <Tooltip 
                    contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    formatter={(value: number, name: string) => [
                      name === 'avgDays' ? `${value} days` : `${value} deals`,
                      name === 'avgDays' ? 'Avg Duration' : 'Deal Count'
                    ]}
                  />
                  <Bar 
                    dataKey="avgDays" 
                    name="Avg Duration"
                    radius={[0, 4, 4, 0]}
                  >
                    {dealVelocity.stageDurationTrend.map((_, idx) => (
                      <Cell 
                        key={`cell-${idx}`} 
                        fill={[
                          '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', 
                          '#f59e0b', '#ef4444', '#ec4899', '#6366f1'
                        ][idx % 8]} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4 text-sm text-muted-foreground">
              <div>Fastest Cycle: <span className="font-medium text-green-600">{dealVelocity.fastestDealCycleDays} days</span></div>
              <div>Average Cycle: <span className="font-medium text-blue-600">{dealVelocity.averageCycleDays} days</span></div>
              <div>Slowest Cycle: <span className="font-medium text-red-600">{dealVelocity.slowestDealCycleDays} days</span></div>
            </div>
          </CardContent>
        </Card>
      )}

      {velocityData?.bottleneckStages && velocityData.bottleneckStages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Pipeline Bottlenecks
            </CardTitle>
            <CardDescription>
              Stages where deals are spending the most time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
              {velocityData.bottleneckStages.map((stage) => (
                <div 
                  key={stage.stageId} 
                  className="p-4 rounded-lg border bg-amber-50 border-amber-200"
                >
                  <div className="font-medium capitalize text-sm">
                    {stage.stageName.replace(/_/g, " ")}
                  </div>
                  <div className="text-2xl font-bold text-amber-600 mt-1">
                    {stage.avgDays} days
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {stage.dealCount} deals affected
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Win/Loss Analysis
          </CardTitle>
          <CardDescription>
            Breakdown of deal outcomes by various dimensions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {winLossLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : winLossData ? (
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="flex w-full overflow-x-auto scrollbar-hide sm:grid sm:grid-cols-5">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="source">By Source</TabsTrigger>
                <TabsTrigger value="size">By Size</TabsTrigger>
                <TabsTrigger value="user">By User</TabsTrigger>
                <TabsTrigger value="reasons">Lost Reasons</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium mb-3">Win/Loss Ratio</h4>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Won', value: winLossData.summary.wonDeals, color: '#22c55e' },
                              { name: 'Lost', value: winLossData.summary.lostDeals, color: '#ef4444' },
                              { name: 'Active', value: winLossData.summary.activeDeals, color: '#3b82f6' }
                            ]}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={75}
                            paddingAngle={2}
                            label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                            labelLine={false}
                          >
                            <Cell fill="#22c55e" />
                            <Cell fill="#ef4444" />
                            <Cell fill="#3b82f6" />
                          </Pie>
                          <Tooltip 
                            formatter={(value: number, name: string) => [`${value} deals`, name]}
                            contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-center">
                      <div className="text-2xl font-bold text-green-600">{winLossData.summary.wonDeals}</div>
                      <div className="text-sm text-green-700">Won</div>
                      <div className="text-xs text-muted-foreground mt-1">{formatCurrency(winLossData.summary.wonValue)}</div>
                    </div>
                    <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-center">
                      <div className="text-2xl font-bold text-red-600">{winLossData.summary.lostDeals}</div>
                      <div className="text-sm text-red-700">Lost</div>
                      <div className="text-xs text-muted-foreground mt-1">{formatCurrency(winLossData.summary.lostValue)}</div>
                    </div>
                    <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-center">
                      <div className="text-2xl font-bold text-blue-600">{winLossData.summary.activeDeals}</div>
                      <div className="text-sm text-blue-700">Active</div>
                    </div>
                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-center">
                      <div className="text-2xl font-bold text-primary">{winLossData.summary.overallWinRate}%</div>
                      <div className="text-sm text-primary">Win Rate</div>
                    </div>
                  </div>
                </div>
                {winLossData.byPeriod && winLossData.byPeriod.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-medium mb-3">Win Rate Trend</h4>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {winLossData.byPeriod.slice(-6).map((period) => (
                        <div key={period.period} className="flex-shrink-0 p-3 rounded border bg-muted/50 min-w-[100px] text-center">
                          <div className="text-xs text-muted-foreground">{period.period}</div>
                          <div className="text-lg font-semibold">{period.winRate}%</div>
                          <div className="text-xs text-muted-foreground">{period.won}W / {period.lost}L</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="source" className="mt-4">
                <div className="space-y-3">
                  {winLossData.bySource.map((source) => (
                    <div key={source.source} className="p-3 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{source.source}</span>
                        <Badge variant={source.winRate >= 50 ? "default" : "secondary"}>
                          {source.winRate}% win rate
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-500" /> {source.won} won
                        </span>
                        <span className="flex items-center gap-1">
                          <XCircle className="h-3 w-3 text-red-500" /> {source.lost} lost
                        </span>
                        <span>{formatCurrency(source.value)} total</span>
                      </div>
                      <Progress value={source.winRate} className="h-1.5 mt-2" />
                    </div>
                  ))}
                  {winLossData.bySource.length === 0 && (
                    <p className="text-muted-foreground text-sm text-center py-4">No source data available</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="size" className="mt-4">
                <div className="space-y-3">
                  {winLossData.bySize.filter(s => s.total > 0).map((size) => (
                    <div key={size.label} className="p-3 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{size.label}</span>
                        <Badge variant={size.winRate >= 50 ? "default" : "secondary"}>
                          {size.winRate}% win rate
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-500" /> {size.won} won
                        </span>
                        <span className="flex items-center gap-1">
                          <XCircle className="h-3 w-3 text-red-500" /> {size.lost} lost
                        </span>
                        <span>{size.total} total deals</span>
                      </div>
                      <Progress value={size.winRate} className="h-1.5 mt-2" />
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="user" className="mt-4">
                <div className="space-y-3">
                  {winLossData.byUser.map((user) => (
                    <div key={user.userId} className="p-3 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {user.name}
                        </span>
                        <Badge variant={user.winRate >= 50 ? "default" : "secondary"}>
                          {user.winRate}% win rate
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-500" /> {user.won} won
                        </span>
                        <span className="flex items-center gap-1">
                          <XCircle className="h-3 w-3 text-red-500" /> {user.lost} lost
                        </span>
                        <span>{formatCurrency(user.value)} total</span>
                      </div>
                      <Progress value={user.winRate} className="h-1.5 mt-2" />
                    </div>
                  ))}
                  {winLossData.byUser.length === 0 && (
                    <p className="text-muted-foreground text-sm text-center py-4">No user data available</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="reasons" className="mt-4">
                {winLossData.lostReasons.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={winLossData.lostReasons}
                            dataKey="count"
                            nameKey="reason"
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={90}
                            paddingAngle={2}
                            label={({ reason, percent }) => `${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {winLossData.lostReasons.map((_, idx) => (
                              <Cell 
                                key={`cell-${idx}`} 
                                fill={[
                                  '#ef4444', '#f97316', '#eab308', '#84cc16', 
                                  '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
                                  '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e'
                                ][idx % 12]} 
                              />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number, name: string) => [`${value} deals`, name]}
                            contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">
                      {winLossData.lostReasons.map((reason, idx) => (
                        <div key={reason.reason} className="flex items-center justify-between p-2 rounded-lg border bg-red-50/50">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: [
                                '#ef4444', '#f97316', '#eab308', '#84cc16', 
                                '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
                                '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e'
                              ][idx % 12] }}
                            />
                            <span className="text-sm">{reason.reason}</span>
                          </div>
                          <Badge variant="outline" className="text-red-600">
                            {reason.count} deal{reason.count !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm text-center py-4">No loss reasons recorded</p>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-4">No win/loss data available</p>
          )}
        </CardContent>
      </Card>

      {dealVelocity?.velocityTrend && dealVelocity.velocityTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Velocity Trend Over Time
            </CardTitle>
            <CardDescription>
              Average stage duration and deal volume by period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dealVelocity.velocityTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="period" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => value.slice(-5)}
                  />
                  <YAxis 
                    yAxisId="left"
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Avg Days', angle: -90, position: 'insideLeft', fontSize: 12 }}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 12 }}
                    label={{ value: 'Deal Count', angle: 90, position: 'insideRight', fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    formatter={(value: number, name: string) => [
                      name === 'avgDays' ? `${value} days` : value,
                      name === 'avgDays' ? 'Avg Duration' : 'Deal Count'
                    ]}
                  />
                  <Legend />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="avgDays" 
                    name="Avg Duration"
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 4 }}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="dealCount" 
                    name="Deal Count"
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={{ fill: '#10b981', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <EmailTrackingStats />
    </div>
  );
}
