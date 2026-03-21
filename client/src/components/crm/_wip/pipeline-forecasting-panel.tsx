import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  Calendar,
  Clock,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Loader2
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface ForecastPeriod {
  dealCount: number;
  totalValue: number;
  weightedValue: number;
  deals: Array<{
    id: string;
    title: string;
    value: number;
    probability: number;
    weightedValue: number;
    expectedCloseDate: string;
    stage: string;
  }>;
}

interface ForecastSummary {
  summary: {
    openDeals: number;
    totalOpenValue: number;
    totalWeightedValue: number;
    averageProbability: number;
  };
  thisMonth: ForecastPeriod;
  thisQuarter: ForecastPeriod;
  thisYear: ForecastPeriod;
  byCategory: Record<string, { dealCount: number; totalValue: number; weightedValue: number }>;
}

interface CloseRates {
  summary: {
    totalClosed: number;
    wonCount: number;
    lostCount: number;
    closeRate: number;
    wonValue: number;
    lostValue: number;
    valueCloseRate: number;
    avgDaysToClose: number;
    periodMonths: number;
  };
  monthlyTrend: Array<{
    month: string;
    won: number;
    lost: number;
    wonValue: number;
    lostValue: number;
    closeRate: number;
  }>;
  benchmarks: {
    industryAvgCloseRate: number;
    industryAvgDaysToClose: number;
    targetCloseRate: number;
    performanceVsTarget: number;
  };
}

interface StageAnalysis {
  stages: Array<{
    id: string;
    name: string;
    stageOrder: number;
    defaultProbability: number;
    color: string;
    dealCount: number;
    totalValue: number;
    weightedValue: number;
    avgDaysInStage: number;
    dealsAtRisk: number;
  }>;
  summary: {
    totalStages: number;
    totalDeals: number;
    totalPipelineValue: number;
    totalWeightedValue: number;
  };
}

interface VelocityMetrics {
  metrics: {
    avgDaysToClose: number;
    avgDealSize: number;
    avgValuePerDay: number;
    monthlyVelocity: number;
    dealsClosed: number;
    totalWonValue: number;
    periodMonths: number;
  };
  distribution: {
    fast: number;
    medium: number;
    slow: number;
  };
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
};

const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6'];

interface PipelineForecastingPanelProps {
  pipelineId?: string;
}

export function PipelineForecastingPanel({ pipelineId }: PipelineForecastingPanelProps) {
  const { data: forecast, isLoading: forecastLoading } = useQuery<ForecastSummary>({
    queryKey: ['/api/crm/forecasting/summary', pipelineId],
  });

  const { data: closeRates, isLoading: closeRatesLoading } = useQuery<CloseRates>({
    queryKey: ['/api/crm/forecasting/close-rates', pipelineId],
  });

  const { data: stageAnalysis, isLoading: stageLoading } = useQuery<StageAnalysis>({
    queryKey: ['/api/crm/forecasting/stage-analysis', pipelineId],
  });

  const { data: velocity, isLoading: velocityLoading } = useQuery<VelocityMetrics>({
    queryKey: ['/api/crm/forecasting/velocity', pipelineId],
  });

  const isLoading = forecastLoading || closeRatesLoading || stageLoading || velocityLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="forecasting-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="pipeline-forecasting-panel">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="stat-card-open-pipeline">
          <CardHeader className="pb-2">
            <CardDescription>Open Pipeline</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(forecast?.summary.totalOpenValue || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4 mr-1" />
              {forecast?.summary.openDeals || 0} deals
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-card-weighted-forecast">
          <CardHeader className="pb-2">
            <CardDescription>Weighted Forecast</CardDescription>
            <CardTitle className="text-2xl text-green-600">
              {formatCurrency(forecast?.summary.totalWeightedValue || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <Target className="h-4 w-4 mr-1" />
              {forecast?.summary.averageProbability || 0}% avg probability
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-card-close-rate">
          <CardHeader className="pb-2">
            <CardDescription>Close Rate</CardDescription>
            <CardTitle className="text-2xl">
              {closeRates?.summary.closeRate || 0}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm">
              {(closeRates?.benchmarks.performanceVsTarget || 0) >= 0 ? (
                <>
                  <ArrowUpRight className="h-4 w-4 mr-1 text-green-600" />
                  <span className="text-green-600">
                    +{closeRates?.benchmarks.performanceVsTarget}% vs target
                  </span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="h-4 w-4 mr-1 text-red-600" />
                  <span className="text-red-600">
                    {closeRates?.benchmarks.performanceVsTarget}% vs target
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-card-velocity">
          <CardHeader className="pb-2">
            <CardDescription>Monthly Velocity</CardDescription>
            <CardTitle className="text-2xl">
              {formatCurrency(velocity?.metrics.monthlyVelocity || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <Clock className="h-4 w-4 mr-1" />
              {velocity?.metrics.avgDaysToClose || 0} days avg to close
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="forecast" className="w-full">
        <TabsList data-testid="forecasting-tabs">
          <TabsTrigger value="forecast" data-testid="tab-forecast">Forecast</TabsTrigger>
          <TabsTrigger value="closerates" data-testid="tab-closerates">Close Rates</TabsTrigger>
          <TabsTrigger value="stages" data-testid="tab-stages">Stage Analysis</TabsTrigger>
          <TabsTrigger value="velocity" data-testid="tab-velocity">Velocity</TabsTrigger>
        </TabsList>

        <TabsContent value="forecast" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card data-testid="forecast-this-month">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  This Month
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Total Value</div>
                    <div className="text-xl font-semibold">
                      {formatCurrency(forecast?.thisMonth.totalValue || 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Weighted Value</div>
                    <div className="text-xl font-semibold text-green-600">
                      {formatCurrency(forecast?.thisMonth.weightedValue || 0)}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {forecast?.thisMonth.dealCount || 0} deals expected to close
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="forecast-this-quarter">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  This Quarter
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Total Value</div>
                    <div className="text-xl font-semibold">
                      {formatCurrency(forecast?.thisQuarter.totalValue || 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Weighted Value</div>
                    <div className="text-xl font-semibold text-green-600">
                      {formatCurrency(forecast?.thisQuarter.weightedValue || 0)}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {forecast?.thisQuarter.dealCount || 0} deals expected to close
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="forecast-this-year">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  This Year
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Total Value</div>
                    <div className="text-xl font-semibold">
                      {formatCurrency(forecast?.thisYear.totalValue || 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Weighted Value</div>
                    <div className="text-xl font-semibold text-green-600">
                      {formatCurrency(forecast?.thisYear.weightedValue || 0)}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {forecast?.thisYear.dealCount || 0} deals expected to close
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {forecast?.byCategory && Object.keys(forecast.byCategory).length > 0 && (
            <Card data-testid="forecast-by-category">
              <CardHeader>
                <CardTitle className="text-lg">By Forecast Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(forecast.byCategory).map(([category, data]) => (
                    <div key={category} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Badge variant="outline" className="mr-3 capitalize">{category}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {data.dealCount} deals
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(data.totalValue)}</div>
                        <div className="text-sm text-green-600">
                          {formatCurrency(data.weightedValue)} weighted
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="closerates" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card data-testid="close-rate-summary">
              <CardHeader>
                <CardTitle className="text-lg">Close Rate Summary</CardTitle>
                <CardDescription>
                  Last {closeRates?.summary.periodMonths || 12} months
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Won Deals</span>
                    <Badge variant="default" className="bg-green-600">
                      {closeRates?.summary.wonCount || 0}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Lost Deals</span>
                    <Badge variant="destructive">
                      {closeRates?.summary.lostCount || 0}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Close Rate (Count)</span>
                    <span className="font-semibold">{closeRates?.summary.closeRate || 0}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Close Rate (Value)</span>
                    <span className="font-semibold">{closeRates?.summary.valueCloseRate || 0}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Avg Days to Close</span>
                    <span className="font-semibold">{closeRates?.summary.avgDaysToClose || 0} days</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="close-rate-benchmarks">
              <CardHeader>
                <CardTitle className="text-lg">Benchmarks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Your Close Rate</span>
                      <span className="text-sm font-semibold">{closeRates?.summary.closeRate || 0}%</span>
                    </div>
                    <Progress value={closeRates?.summary.closeRate || 0} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Industry Average</span>
                      <span className="text-sm font-semibold">{closeRates?.benchmarks.industryAvgCloseRate || 25}%</span>
                    </div>
                    <Progress value={closeRates?.benchmarks.industryAvgCloseRate || 25} className="h-2 bg-muted" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Target</span>
                      <span className="text-sm font-semibold">{closeRates?.benchmarks.targetCloseRate || 30}%</span>
                    </div>
                    <Progress value={closeRates?.benchmarks.targetCloseRate || 30} className="h-2 bg-muted" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {closeRates?.monthlyTrend && closeRates.monthlyTrend.length > 0 && (
            <Card data-testid="close-rate-trend">
              <CardHeader>
                <CardTitle className="text-lg">Monthly Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={closeRates.monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tickFormatter={(v) => v.slice(5)} />
                      <YAxis />
                      <RechartsTooltip />
                      <Bar dataKey="won" fill="#10B981" name="Won" stackId="a" />
                      <Bar dataKey="lost" fill="#EF4444" name="Lost" stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="stages" className="space-y-4">
          <Card data-testid="stage-analysis">
            <CardHeader>
              <CardTitle className="text-lg">Pipeline Stage Analysis</CardTitle>
              <CardDescription>
                {stageAnalysis?.summary.totalDeals || 0} deals across {stageAnalysis?.summary.totalStages || 0} stages
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stageAnalysis?.stages.map((stage) => (
                  <div key={stage.id} className="border rounded-lg p-4" data-testid={`stage-row-${stage.id}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: stage.color }}
                        />
                        <span className="font-medium">{stage.name}</span>
                        <Badge variant="outline" className="ml-2">
                          {stage.defaultProbability}% probability
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatCurrency(stage.totalValue)}</div>
                        <div className="text-sm text-green-600">
                          {formatCurrency(stage.weightedValue)} weighted
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{stage.dealCount} deals</span>
                      <span>{stage.avgDaysInStage} avg days in stage</span>
                      {stage.dealsAtRisk > 0 && (
                        <Badge variant="destructive">
                          {stage.dealsAtRisk} at risk
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="velocity" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card data-testid="velocity-avg-days">
              <CardHeader className="pb-2">
                <CardDescription>Avg Days to Close</CardDescription>
                <CardTitle className="text-2xl">
                  {velocity?.metrics.avgDaysToClose || 0} days
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  Industry avg: {closeRates?.benchmarks.industryAvgDaysToClose || 90} days
                </div>
              </CardContent>
            </Card>

            <Card data-testid="velocity-avg-deal">
              <CardHeader className="pb-2">
                <CardDescription>Avg Deal Size</CardDescription>
                <CardTitle className="text-2xl">
                  {formatCurrency(velocity?.metrics.avgDealSize || 0)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  {velocity?.metrics.dealsClosed || 0} deals closed
                </div>
              </CardContent>
            </Card>

            <Card data-testid="velocity-total-won">
              <CardHeader className="pb-2">
                <CardDescription>Total Won Value</CardDescription>
                <CardTitle className="text-2xl text-green-600">
                  {formatCurrency(velocity?.metrics.totalWonValue || 0)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  Last {velocity?.metrics.periodMonths || 6} months
                </div>
              </CardContent>
            </Card>
          </div>

          <Card data-testid="velocity-distribution">
            <CardHeader>
              <CardTitle className="text-lg">Deal Velocity Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {velocity?.distribution.fast || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Fast (&lt; 30 days)</div>
                </div>
                <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">
                    {velocity?.distribution.medium || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Medium (30-90 days)</div>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">
                    {velocity?.distribution.slow || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Slow (&gt; 90 days)</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PipelineForecastingPanel;
