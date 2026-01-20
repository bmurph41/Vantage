import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  DollarSign
} from "lucide-react";

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
                <div className="grid grid-cols-4 gap-2 text-center">
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
    </div>
  );
}
