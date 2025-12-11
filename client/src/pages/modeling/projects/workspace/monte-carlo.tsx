import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Activity,
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  RefreshCw,
  Download,
  Shuffle,
  AlertTriangle,
  CheckCircle,
  Target,
  Percent,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

interface Statistics {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  skewness: number;
  kurtosis: number;
  percentiles: Record<string, number>;
}

interface Histogram {
  bins: number[];
  frequencies: number[];
  binWidth: number;
}

interface RiskMetrics {
  valueAtRisk: number;
  conditionalVaR: number;
  probabilityOfLoss: number;
  sharpeRatio: number;
  sortinoRatio: number;
}

interface SimulationResult {
  metric: string;
  values: number[];
  statistics: Statistics;
  histogram: Histogram;
  riskMetrics: RiskMetrics;
}

interface MonteCarloAnalysis {
  projectId: string;
  iterations: number;
  confidenceLevel: number;
  variables: { name: string; key: string; baseValue: number }[];
  results: {
    irr: SimulationResult;
    npv: SimulationResult;
    equityMultiple: SimulationResult;
    cashOnCash: SimulationResult;
  };
  sensitivityRanking: {
    variable: string;
    contribution: number;
    correlationToIRR: number;
  }[];
  scenarioAnalysis: {
    optimistic: { probability: number; avgIRR: number; avgNPV: number };
    base: { probability: number; avgIRR: number; avgNPV: number };
    pessimistic: { probability: number; avgIRR: number; avgNPV: number };
  };
  executionTime: number;
}

export default function MonteCarloPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [iterations, setIterations] = useState(10000);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMetric, setSelectedMetric] = useState<'irr' | 'npv' | 'equityMultiple' | 'cashOnCash'>('irr');

  const { data: analysis, isLoading, refetch } = useQuery<MonteCarloAnalysis>({
    queryKey: ['/api/modeling/projects', projectId, 'monte-carlo'],
    enabled: !!projectId,
  });

  const runSimulation = useMutation({
    mutationFn: (iters: number) =>
      apiRequest(`/api/modeling/projects/${projectId}/monte-carlo/run`, {
        method: 'POST',
        body: JSON.stringify({ iterations: iters }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/modeling/projects', projectId, 'monte-carlo'] 
      });
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const formatCompactCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (Math.abs(value) >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return formatCurrency(value);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const results = analysis?.results;
  const currentResult = results?.[selectedMetric];
  const scenarios = analysis?.scenarioAnalysis;
  const sensitivity = analysis?.sensitivityRanking || [];

  // Calculate histogram max for scaling
  const histogramMax = currentResult 
    ? Math.max(...currentResult.histogram.frequencies) 
    : 1;

  return (
    <div className="space-y-6 p-6" data-testid="monte-carlo-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Monte Carlo Simulation</h1>
          <p className="text-muted-foreground">
            Stochastic analysis with {analysis?.iterations.toLocaleString() || 10000} iterations
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="text-sm">Iterations:</Label>
            <Select 
              value={iterations.toString()} 
              onValueChange={(v) => setIterations(parseInt(v))}
            >
              <SelectTrigger className="w-28" data-testid="iterations-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1000">1,000</SelectItem>
                <SelectItem value="5000">5,000</SelectItem>
                <SelectItem value="10000">10,000</SelectItem>
                <SelectItem value="25000">25,000</SelectItem>
                <SelectItem value="50000">50,000</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={() => runSimulation.mutate(iterations)}
            disabled={runSimulation.isPending}
            data-testid="run-simulation-btn"
          >
            {runSimulation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Shuffle className="h-4 w-4 mr-2" />
            )}
            Run Simulation
          </Button>
          <Button variant="outline" data-testid="export-btn">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Results Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card 
          className={cn("cursor-pointer transition-all", selectedMetric === 'irr' && "ring-2 ring-primary")}
          onClick={() => setSelectedMetric('irr')}
          data-testid="card-irr"
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Expected IRR</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatPercent(results?.irr.statistics.mean || 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  σ = {formatPercent(results?.irr.statistics.stdDev || 0)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className={cn("cursor-pointer transition-all", selectedMetric === 'npv' && "ring-2 ring-primary")}
          onClick={() => setSelectedMetric('npv')}
          data-testid="card-npv"
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Expected NPV</p>
                <p className={cn(
                  "text-2xl font-bold",
                  (results?.npv.statistics.mean || 0) >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {formatCompactCurrency(results?.npv.statistics.mean || 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  σ = {formatCompactCurrency(results?.npv.statistics.stdDev || 0)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className={cn("cursor-pointer transition-all", selectedMetric === 'equityMultiple' && "ring-2 ring-primary")}
          onClick={() => setSelectedMetric('equityMultiple')}
          data-testid="card-em"
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Equity Multiple</p>
                <p className="text-2xl font-bold">
                  {(results?.equityMultiple.statistics.mean || 0).toFixed(2)}x
                </p>
                <p className="text-xs text-muted-foreground">
                  σ = {(results?.equityMultiple.statistics.stdDev || 0).toFixed(2)}x
                </p>
              </div>
              <Target className="h-8 w-8 text-purple-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-risk">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Probability of Loss</p>
                <p className={cn(
                  "text-2xl font-bold",
                  (results?.npv.riskMetrics.probabilityOfLoss || 0) < 0.1 
                    ? "text-green-600" 
                    : (results?.npv.riskMetrics.probabilityOfLoss || 0) < 0.25
                    ? "text-yellow-600"
                    : "text-red-600"
                )}>
                  {formatPercent((results?.npv.riskMetrics.probabilityOfLoss || 0) * 100)}
                </p>
                <p className="text-xs text-muted-foreground">
                  VaR: {formatCompactCurrency(results?.npv.riskMetrics.valueAtRisk || 0)}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Distribution</TabsTrigger>
          <TabsTrigger value="scenarios" data-testid="tab-scenarios">Scenarios</TabsTrigger>
          <TabsTrigger value="sensitivity" data-testid="tab-sensitivity">Sensitivity</TabsTrigger>
          <TabsTrigger value="risk" data-testid="tab-risk">Risk Metrics</TabsTrigger>
        </TabsList>

        {/* Distribution Tab */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Histogram */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>
                  {selectedMetric === 'irr' ? 'IRR' : 
                   selectedMetric === 'npv' ? 'NPV' :
                   selectedMetric === 'equityMultiple' ? 'Equity Multiple' :
                   'Cash-on-Cash'} Distribution
                </CardTitle>
                <CardDescription>
                  Probability distribution from {analysis?.iterations.toLocaleString()} simulations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {currentResult?.histogram.bins.map((bin, idx) => {
                    const freq = currentResult.histogram.frequencies[idx];
                    const pct = (freq / histogramMax) * 100;
                    const isInConfidence = 
                      bin >= currentResult.statistics.percentiles['p5'] &&
                      bin <= currentResult.statistics.percentiles['p95'];
                    
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs w-20 text-right text-muted-foreground">
                          {selectedMetric === 'npv' 
                            ? formatCompactCurrency(bin)
                            : selectedMetric === 'equityMultiple'
                            ? `${bin.toFixed(2)}x`
                            : formatPercent(bin)
                          }
                        </span>
                        <div className="flex-1 bg-muted rounded-full h-5 relative">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all",
                              isInConfidence 
                                ? "bg-blue-500" 
                                : "bg-blue-300"
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs w-12 text-muted-foreground">
                          {((freq / (analysis?.iterations || 1)) * 100).toFixed(1)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Mean</span>
                    <span className="font-semibold">
                      {selectedMetric === 'npv'
                        ? formatCompactCurrency(currentResult?.statistics.mean || 0)
                        : selectedMetric === 'equityMultiple'
                        ? `${(currentResult?.statistics.mean || 0).toFixed(2)}x`
                        : formatPercent(currentResult?.statistics.mean || 0)
                      }
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Median</span>
                    <span className="font-semibold">
                      {selectedMetric === 'npv'
                        ? formatCompactCurrency(currentResult?.statistics.median || 0)
                        : selectedMetric === 'equityMultiple'
                        ? `${(currentResult?.statistics.median || 0).toFixed(2)}x`
                        : formatPercent(currentResult?.statistics.median || 0)
                      }
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Std Dev</span>
                    <span className="font-semibold">
                      {selectedMetric === 'npv'
                        ? formatCompactCurrency(currentResult?.statistics.stdDev || 0)
                        : selectedMetric === 'equityMultiple'
                        ? `${(currentResult?.statistics.stdDev || 0).toFixed(2)}x`
                        : formatPercent(currentResult?.statistics.stdDev || 0)
                      }
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Min</span>
                    <span className="font-semibold text-red-600">
                      {selectedMetric === 'npv'
                        ? formatCompactCurrency(currentResult?.statistics.min || 0)
                        : selectedMetric === 'equityMultiple'
                        ? `${(currentResult?.statistics.min || 0).toFixed(2)}x`
                        : formatPercent(currentResult?.statistics.min || 0)
                      }
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Max</span>
                    <span className="font-semibold text-green-600">
                      {selectedMetric === 'npv'
                        ? formatCompactCurrency(currentResult?.statistics.max || 0)
                        : selectedMetric === 'equityMultiple'
                        ? `${(currentResult?.statistics.max || 0).toFixed(2)}x`
                        : formatPercent(currentResult?.statistics.max || 0)
                      }
                    </span>
                  </div>
                  
                  <div className="pt-4">
                    <p className="text-sm font-medium mb-2">Percentiles</p>
                    <div className="space-y-2 text-sm">
                      {['p5', 'p25', 'p50', 'p75', 'p95'].map((p) => (
                        <div key={p} className="flex justify-between">
                          <span className="text-muted-foreground">{p.toUpperCase()}</span>
                          <span>
                            {selectedMetric === 'npv'
                              ? formatCompactCurrency(currentResult?.statistics.percentiles[p] || 0)
                              : selectedMetric === 'equityMultiple'
                              ? `${(currentResult?.statistics.percentiles[p] || 0).toFixed(2)}x`
                              : formatPercent(currentResult?.statistics.percentiles[p] || 0)
                            }
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Scenarios Tab */}
        <TabsContent value="scenarios" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pessimistic */}
            <Card className="border-red-200 dark:border-red-900">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-red-600">Pessimistic Case</CardTitle>
                  <Badge variant="outline" className="text-red-600">
                    {((scenarios?.pessimistic.probability || 0) * 100).toFixed(0)}% probability
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                    <TrendingDown className="h-8 w-8 text-red-600 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Expected IRR</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatPercent(scenarios?.pessimistic.avgIRR || 0)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Expected NPV</p>
                    <p className="text-xl font-semibold">
                      {formatCompactCurrency(scenarios?.pessimistic.avgNPV || 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Base */}
            <Card className="border-blue-200 dark:border-blue-900">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-blue-600">Base Case</CardTitle>
                  <Badge variant="outline" className="text-blue-600">
                    {((scenarios?.base.probability || 0) * 100).toFixed(0)}% probability
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <Activity className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Expected IRR</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatPercent(scenarios?.base.avgIRR || 0)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Expected NPV</p>
                    <p className="text-xl font-semibold">
                      {formatCompactCurrency(scenarios?.base.avgNPV || 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Optimistic */}
            <Card className="border-green-200 dark:border-green-900">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg text-green-600">Optimistic Case</CardTitle>
                  <Badge variant="outline" className="text-green-600">
                    {((scenarios?.optimistic.probability || 0) * 100).toFixed(0)}% probability
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                    <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Expected IRR</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatPercent(scenarios?.optimistic.avgIRR || 0)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Expected NPV</p>
                    <p className="text-xl font-semibold">
                      {formatCompactCurrency(scenarios?.optimistic.avgNPV || 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sensitivity Tab */}
        <TabsContent value="sensitivity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Sensitivity Ranking</CardTitle>
              <CardDescription>
                Variables ranked by their impact on IRR outcomes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sensitivity.map((s, idx) => (
                  <div key={s.variable} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-muted-foreground w-6">
                          #{idx + 1}
                        </span>
                        <span className="font-medium">{s.variable}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          {s.correlationToIRR > 0 ? (
                            <ChevronUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-red-600" />
                          )}
                          <span className={cn(
                            "text-sm font-medium",
                            s.correlationToIRR > 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {s.correlationToIRR > 0 ? '+' : ''}{s.correlationToIRR.toFixed(3)}
                          </span>
                        </div>
                        <Badge variant="outline">
                          {s.contribution.toFixed(1)}% contribution
                        </Badge>
                      </div>
                    </div>
                    <Progress 
                      value={s.contribution} 
                      className={cn(
                        "h-2",
                        s.correlationToIRR > 0 
                          ? "[&>div]:bg-green-500" 
                          : "[&>div]:bg-red-500"
                      )}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Risk Metrics Tab */}
        <TabsContent value="risk" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Value at Risk (VaR)</CardTitle>
                <CardDescription>
                  95% confidence level risk metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">VaR (95%)</p>
                    <p className={cn(
                      "text-2xl font-bold",
                      (results?.npv.riskMetrics.valueAtRisk || 0) >= 0 
                        ? "text-green-600" 
                        : "text-red-600"
                    )}>
                      {formatCompactCurrency(results?.npv.riskMetrics.valueAtRisk || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      5% chance of NPV falling below this value
                    </p>
                  </div>
                  
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Conditional VaR (CVaR)</p>
                    <p className={cn(
                      "text-2xl font-bold",
                      (results?.npv.riskMetrics.conditionalVaR || 0) >= 0 
                        ? "text-green-600" 
                        : "text-red-600"
                    )}>
                      {formatCompactCurrency(results?.npv.riskMetrics.conditionalVaR || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Expected loss when VaR is breached
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Risk-Adjusted Returns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Sharpe Ratio</p>
                    <p className="text-2xl font-bold">
                      {(results?.irr.riskMetrics.sharpeRatio || 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Risk-adjusted return (higher is better)
                    </p>
                  </div>
                  
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Sortino Ratio</p>
                    <p className="text-2xl font-bold">
                      {(results?.irr.riskMetrics.sortinoRatio || 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Downside risk-adjusted return
                    </p>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Probability of Loss</p>
                    <p className={cn(
                      "text-2xl font-bold",
                      (results?.npv.riskMetrics.probabilityOfLoss || 0) < 0.1 
                        ? "text-green-600" 
                        : (results?.npv.riskMetrics.probabilityOfLoss || 0) < 0.25
                        ? "text-yellow-600"
                        : "text-red-600"
                    )}>
                      {formatPercent((results?.npv.riskMetrics.probabilityOfLoss || 0) * 100)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Chance of negative NPV
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Execution Info */}
      <div className="text-center text-xs text-muted-foreground">
        Simulation completed in {analysis?.executionTime || 0}ms
      </div>
    </div>
  );
}
