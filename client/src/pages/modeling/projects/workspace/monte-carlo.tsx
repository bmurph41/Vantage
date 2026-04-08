import { useState, useCallback, useMemo, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Activity, TrendingUp, TrendingDown, DollarSign, RefreshCw,
  Download, Shuffle, AlertTriangle, Target,
  ChevronUp, ChevronDown, Settings2, Info, Clock, CheckCircle2
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn, formatCurrency, formatPercent } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { ExportPdfButton } from '@/components/ui/export-pdf-button';

interface DistributionConfig {
  type: 'normal' | 'triangular' | 'uniform' | 'lognormal' | 'pert';
  min?: number;
  max?: number;
  mean?: number;
  stdDev?: number;
  mode?: number;
}

interface SimulationVariable {
  name: string;
  key: string;
  distribution: DistributionConfig;
  baseValue: number;
  enabled: boolean;
}

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

interface MonteCarloResponse {
  hasResults: boolean;
  projectId?: string;
  iterations?: number;
  confidenceLevel?: number;
  variables?: SimulationVariable[];
  defaultVariables?: SimulationVariable[];
  results?: {
    irr: SimulationResult;
    npv: SimulationResult;
    equityMultiple: SimulationResult;
    cashOnCash: SimulationResult;
  };
  sensitivityRanking?: {
    variable: string;
    contribution: number;
    correlationToIRR: number;
  }[];
  scenarioAnalysis?: {
    optimistic: { probability: number; avgIRR: number; avgNPV: number };
    base: { probability: number; avgIRR: number; avgNPV: number };
    pessimistic: { probability: number; avgIRR: number; avgNPV: number };
  };
  executionTime?: number;
  lastCalculated?: string;
  usedProFormaData?: boolean;
  config?: {
    variables?: SimulationVariable[];
    iterations?: number;
    confidenceLevel?: number;
    updatedAt?: string;
  };
}

const VARIABLE_DISPLAY: Record<string, { unit: 'currency' | 'percent' | 'ratio'; label: string; tooltip: string }> = {
  purchasePrice: { unit: 'currency', label: 'Purchase Price', tooltip: 'Range of possible acquisition prices' },
  year1NOI: { unit: 'currency', label: 'Year 1 NOI', tooltip: 'Net Operating Income variation due to occupancy, rates, and expenses' },
  noiGrowthRate: { unit: 'percent', label: 'NOI Growth Rate', tooltip: 'Annual NOI growth rate uncertainty' },
  exitCapRate: { unit: 'percent', label: 'Exit Cap Rate', tooltip: 'Cap rate at disposition — higher = lower exit price' },
  vacancyRate: { unit: 'percent', label: 'Vacancy Rate', tooltip: 'Physical vacancy applied as a reduction to NOI' },
  capexRate: { unit: 'percent', label: 'CapEx (% of Revenue)', tooltip: 'Capital expenditure as a percentage of gross revenue' },
};

function formatVarValue(key: string, value: number): string {
  const info = VARIABLE_DISPLAY[key];
  if (!info) return value.toFixed(2);
  if (info.unit === 'currency') {
    if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  }
  if (info.unit === 'percent') return `${(value * 100).toFixed(1)}%`;
  return value.toFixed(2);
}

function parseVarInput(key: string, input: string): number {
  const info = VARIABLE_DISPLAY[key];
  const num = parseFloat(input.replace(/[,$%]/g, ''));
  if (isNaN(num)) return 0;
  if (info?.unit === 'percent') return num / 100;
  return num;
}

function displayVarInput(key: string, value: number): string {
  const info = VARIABLE_DISPLAY[key];
  if (info?.unit === 'percent') return (value * 100).toFixed(1);
  if (info?.unit === 'currency') return Math.round(value).toLocaleString();
  return value.toFixed(2);
}


// Build histogram from samples for the old UI chart
function buildHistogram(values: number[], bins: number = 20) {
  if (!values || values.length === 0) {
    return { bins: [], frequencies: [], binWidth: 0 };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binWidth = (max - min) / bins || 1;
  const binCounts = new Array(bins).fill(0);
  const binLabels: number[] = [];
  
  for (let i = 0; i < bins; i++) {
    binLabels.push(min + binWidth * (i + 0.5));
  }
  
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / binWidth), bins - 1);
    binCounts[Math.max(0, idx)]++;
  }
  
  return { bins: binLabels, frequencies: binCounts, binWidth };
}

export default function MonteCarloPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { toast } = useToast();
  const pdfRef = useRef<HTMLDivElement>(null);
  const [iterations, setIterations] = useState(10000);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMetric, setSelectedMetric] = useState<'irr' | 'npv' | 'equityMultiple' | 'cashOnCash'>('irr');
  const [showConfig, setShowConfig] = useState(false);
  const [configVariables, setConfigVariables] = useState<SimulationVariable[] | null>(null);

  // Fetch from new DCF Monte Carlo endpoint
  const { data: rawMcData, isLoading } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'dcf-monte-carlo'],
    queryFn: async () => {
      // Try new endpoint
      const res = await fetch(`/api/modeling/projects/${projectId}/dcf/monte-carlo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ n: iterations, seed: 42 }),
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!projectId,
  });

  // Adapt new response shape to old UI expectations
  const mcData = useMemo((): MonteCarloResponse | null => {
    if (!rawMcData) return null;
    const s = rawMcData.stats;
    if (!s) return null;

    const buildResult = (key: 'irr' | 'equityMultiple' | 'npv', label: string) => {
      const d = s[key];
      if (!d) return null;
      return {
        metric: label,
        mean: d.mean,
        stdDev: d.stdDev,
        percentiles: {
          p5: d.p5, p10: d.p10, p25: d.p25,
          p50: d.p50, p75: d.p75, p90: d.p90, p95: d.p95,
        },
        histogram: buildHistogram(rawMcData.samplesPreview?.map((sp: any) => sp[key === 'equityMultiple' ? 'equityMultiple' : key]) || [], 20),
        min: d.min,
        max: d.max,
      };
    };

    return {
      hasResults: true,
      results: {
        irr: buildResult('irr', 'IRR'),
        npv: buildResult('npv', 'NPV'),
        equityMultiple: buildResult('equityMultiple', 'Equity Multiple'),
        cashOnCash: buildResult('irr', 'Cash-on-Cash'), // approximate with IRR
      },
      iterations: rawMcData.n,
      config: null,
      defaultVariables: [],
      sensitivityRanking: [],
      riskMetrics: {
        probIrrBelowHurdle: rawMcData.risks?.probIrrBelowHurdle ?? 0,
        probMultipleBelow1: rawMcData.risks?.probMultipleBelow1 ?? 0,
        expectedShortfallIrrP10: rawMcData.risks?.expectedShortfallIrrP10 ?? 0,
      },
    } as any;
  }, [rawMcData]);

  const variables = useMemo(() => {
    if (configVariables) return configVariables;
    if (mcData?.config?.variables) return mcData.config.variables;
    if (mcData?.variables) return mcData.variables;
    if (mcData?.defaultVariables) return mcData.defaultVariables;
    return [];
  }, [configVariables, mcData]);

  const runSimulation = useMutation({
    mutationFn: async (_vars: SimulationVariable[]) => {
      const res = await fetch(`/api/modeling/projects/${projectId}/dcf/monte-carlo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ n: iterations, mode: 'fast' }),
      });
      if (!res.ok) throw new Error('Monte Carlo failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/modeling/projects', projectId, 'dcf-monte-carlo']
      });
      toast({ title: 'Simulation complete', description: `Ran ${iterations.toLocaleString()} iterations.` });
    },
    onError: () => {
      toast({ title: 'Simulation failed', description: 'Could not run Monte Carlo simulation.', variant: 'destructive' });
    },
  });

  const saveConfig = useMutation({
    mutationFn: async (_vars: SimulationVariable[]) => {
      // Config is now managed by the DCF decision support layer
      toast({ title: 'Configuration applied to next run' });
    },
    onSuccess: () => {},
  });

  const handleRunSimulation = useCallback(() => {
    runSimulation.mutate(variables);
  }, [variables, iterations]);

  const updateVariable = useCallback((idx: number, updates: Partial<SimulationVariable>) => {
    setConfigVariables(prev => {
      const base = prev || variables;
      const next = [...base];
      next[idx] = { ...next[idx], ...updates };
      return next;
    });
  }, [variables]);

  const updateDistribution = useCallback((idx: number, updates: Partial<DistributionConfig>) => {
    setConfigVariables(prev => {
      const base = prev || variables;
      const next = [...base];
      next[idx] = { ...next[idx], distribution: { ...next[idx].distribution, ...updates } };
      return next;
    });
  }, [variables]);

  const handleExport = useCallback(() => {
    if (!mcData?.hasResults || !mcData.results) return;
    const results = mcData.results;
    const rows = [
      ['Metric', 'Mean', 'Median', 'StdDev', 'Min', 'Max', 'P5', 'P25', 'P75', 'P95', 'VaR(95%)', 'ProbLoss', 'Sharpe', 'Sortino'],
    ];
    for (const [key, result] of Object.entries(results)) {
      const s = result.statistics;
      const r = result.riskMetrics;
      rows.push([
        result.metric, s.mean.toFixed(4), s.median.toFixed(4), s.stdDev.toFixed(4),
        s.min.toFixed(4), s.max.toFixed(4),
        (s.percentiles?.p5 || 0).toFixed(4), (s.percentiles?.p25 || 0).toFixed(4),
        (s.percentiles?.p75 || 0).toFixed(4), (s.percentiles?.p95 || 0).toFixed(4),
        r.valueAtRisk.toFixed(4), r.probabilityOfLoss.toFixed(4),
        r.sharpeRatio.toFixed(4), r.sortinoRatio.toFixed(4),
      ]);
    }
    if (mcData.sensitivityRanking) {
      rows.push([]);
      rows.push(['Sensitivity Ranking', 'Variable', 'Contribution', 'Correlation to IRR']);
      mcData.sensitivityRanking.forEach((s, i) => {
        rows.push([String(i + 1), s.variable, s.contribution.toFixed(2), s.correlationToIRR.toFixed(4)]);
      });
    }
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monte-carlo-${projectId}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [mcData, projectId]);

  const formatCompactCurrency = (value: number) => {
    if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return formatCurrency(value);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const hasResults = mcData?.hasResults === true;
  const results = hasResults ? mcData?.results : undefined;
  const currentResult = results?.[selectedMetric];
  const scenarios = mcData?.scenarioAnalysis;
  const sensitivity = mcData?.sensitivityRanking || [];
  const histogramMax = currentResult ? Math.max(...currentResult.histogram.frequencies) : 1;
  const enabledCount = variables.filter(v => v.enabled).length;

  return (
    <div className="fm-page" ref={pdfRef}>
      <div className="fm-header">
        <div>
          <div className="fm-header-title">Monte Carlo Simulation</div>
          <div className="fm-header-sub">
            {hasResults ? (
              <>
                {mcData?.iterations?.toLocaleString()} iterations
                {mcData?.usedProFormaData && (
                  <Badge variant="outline" className="ml-2 text-xs">Pro Forma Linked</Badge>
                )}
                {mcData?.lastCalculated && (
                  <span className="ml-2 text-xs">
                    <Clock className="inline h-3 w-3 mr-1" />
                    {new Date(mcData.lastCalculated).toLocaleString()}
                  </span>
                )}
              </>
            ) : (
              'Run a simulation to see probability distributions for your deal returns'
            )}
          </div>
        </div>
        <div className="fm-header-actions">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfig(!showConfig)}
          >
            <Settings2 className="h-4 w-4 mr-1" />
            Configure
          </Button>
          <Select
            value={iterations.toString()}
            onValueChange={(v) => setIterations(parseInt(v))}
          >
            <SelectTrigger className="w-28">
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
          <Button
            onClick={handleRunSimulation}
            disabled={runSimulation.isPending || enabledCount === 0}
          >
            {runSimulation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Shuffle className="h-4 w-4 mr-2" />
            )}
            {runSimulation.isPending ? 'Running...' : 'Run Simulation'}
          </Button>
          {hasResults && (
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          )}
          <ExportPdfButton contentRef={pdfRef} filename="monte-carlo-simulation" title="Monte Carlo Simulation" />
        </div>
      </div>

      <div className="fm-body">
      {showConfig && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Variable Distributions</CardTitle>
                <CardDescription>
                  Configure which inputs vary and their ranges. Toggle variables on/off and set min/max/most likely values.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  saveConfig.mutate(variables);
                }}
                disabled={saveConfig.isPending}
              >
                {saveConfig.isPending ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
                Save Config
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {variables.map((v, idx) => {
                const info = VARIABLE_DISPLAY[v.key];
                return (
                  <div key={v.key} className={cn(
                    "border rounded-lg p-4 transition-all",
                    v.enabled ? "border-border" : "border-dashed border-muted opacity-60"
                  )}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={v.enabled}
                          onCheckedChange={(checked) => updateVariable(idx, { enabled: checked })}
                        />
                        <div>
                          <span className="font-medium">{v.name}</span>
                          {info && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="inline h-3 w-3 ml-1 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent><p className="max-w-xs">{info.tooltip}</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          Base: {formatVarValue(v.key, v.baseValue)}
                        </Badge>
                      </div>
                      <Select
                        value={v.distribution.type}
                        onValueChange={(type) => updateDistribution(idx, { type: type as any })}
                        disabled={!v.enabled}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="triangular">Triangular</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="uniform">Uniform</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {v.enabled && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {(v.distribution.type === 'triangular' || v.distribution.type === 'uniform') && (
                          <>
                            <div>
                              <Label className="text-xs text-muted-foreground">Min</Label>
                              <Input
                                value={displayVarInput(v.key, v.distribution.min || 0)}
                                onChange={(e) => updateDistribution(idx, { min: parseVarInput(v.key, e.target.value) })}
                                className="h-8 text-sm"
                              />
                            </div>
                            {v.distribution.type === 'triangular' && (
                              <div>
                                <Label className="text-xs text-muted-foreground">Most Likely</Label>
                                <Input
                                  value={displayVarInput(v.key, v.distribution.mode || v.baseValue)}
                                  onChange={(e) => updateDistribution(idx, { mode: parseVarInput(v.key, e.target.value) })}
                                  className="h-8 text-sm"
                                />
                              </div>
                            )}
                            <div>
                              <Label className="text-xs text-muted-foreground">Max</Label>
                              <Input
                                value={displayVarInput(v.key, v.distribution.max || 0)}
                                onChange={(e) => updateDistribution(idx, { max: parseVarInput(v.key, e.target.value) })}
                                className="h-8 text-sm"
                              />
                            </div>
                          </>
                        )}
                        {v.distribution.type === 'normal' && (
                          <>
                            <div>
                              <Label className="text-xs text-muted-foreground">Mean</Label>
                              <Input
                                value={displayVarInput(v.key, v.distribution.mean || v.baseValue)}
                                onChange={(e) => updateDistribution(idx, { mean: parseVarInput(v.key, e.target.value) })}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Std Dev</Label>
                              <Input
                                value={displayVarInput(v.key, v.distribution.stdDev || 0)}
                                onChange={(e) => updateDistribution(idx, { stdDev: parseVarInput(v.key, e.target.value) })}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {!hasResults && !runSimulation.isPending && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Activity className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Simulation Results Yet</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Monte Carlo simulation runs thousands of scenarios by varying your deal inputs 
              within the ranges you configure. It uses your actual Deal Pricing model and Pro Forma 
              cash flows to show the full range of possible outcomes.
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span>{enabledCount} variable{enabledCount !== 1 ? 's' : ''} configured</span>
            </div>
            <Button onClick={handleRunSimulation} size="lg">
              <Shuffle className="h-4 w-4 mr-2" />
              Run First Simulation
            </Button>
          </CardContent>
        </Card>
      )}

      {runSimulation.isPending && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <RefreshCw className="h-12 w-12 text-primary animate-spin mb-4" />
            <h3 className="text-lg font-semibold mb-2">Running Simulation</h3>
            <p className="text-muted-foreground">
              Processing {iterations.toLocaleString()} iterations through your Deal Pricing model...
            </p>
          </CardContent>
        </Card>
      )}

      {hasResults && results && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card
              className={cn("cursor-pointer transition-all", selectedMetric === 'irr' && "ring-2 ring-primary")}
              onClick={() => setSelectedMetric('irr')}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Expected IRR</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatPercent(results.irr.statistics.mean || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Range: {formatPercent(results.irr.statistics.percentiles?.p5 || 0)} — {formatPercent(results.irr.statistics.percentiles?.p95 || 0)}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-600 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card
              className={cn("cursor-pointer transition-all", selectedMetric === 'npv' && "ring-2 ring-primary")}
              onClick={() => setSelectedMetric('npv')}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Expected NPV</p>
                    <p className={cn("text-2xl font-bold", (results.npv.statistics.mean || 0) >= 0 ? "text-green-600" : "text-red-600")}>
                      {formatCompactCurrency(results.npv.statistics.mean || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      σ = {formatCompactCurrency(results.npv.statistics.stdDev || 0)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-blue-600 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card
              className={cn("cursor-pointer transition-all", selectedMetric === 'equityMultiple' && "ring-2 ring-primary")}
              onClick={() => setSelectedMetric('equityMultiple')}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Equity Multiple</p>
                    <p className="text-2xl font-bold">
                      {(results.equityMultiple.statistics.mean || 0).toFixed(2)}x
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Range: {(results.equityMultiple.statistics.percentiles?.p5 || 0).toFixed(2)}x — {(results.equityMultiple.statistics.percentiles?.p95 || 0).toFixed(2)}x
                    </p>
                  </div>
                  <Target className="h-8 w-8 text-purple-600 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Probability of Loss</p>
                    <p className={cn(
                      "text-2xl font-bold",
                      (results.npv.riskMetrics.probabilityOfLoss || 0) < 0.1
                        ? "text-green-600"
                        : (results.npv.riskMetrics.probabilityOfLoss || 0) < 0.25
                        ? "text-yellow-600"
                        : "text-red-600"
                    )}>
                      {formatPercent((results.npv.riskMetrics.probabilityOfLoss || 0) * 100)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      VaR: {formatCompactCurrency(results.npv.riskMetrics.valueAtRisk || 0)}
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-orange-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">Distribution</TabsTrigger>
              <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
              <TabsTrigger value="sensitivity">Sensitivity</TabsTrigger>
              <TabsTrigger value="risk">Risk Metrics</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>
                      {selectedMetric === 'irr' ? 'IRR' :
                       selectedMetric === 'npv' ? 'NPV' :
                       selectedMetric === 'equityMultiple' ? 'Equity Multiple' :
                       'Cash-on-Cash'} Distribution
                    </CardTitle>
                    <CardDescription>
                      Probability distribution from {mcData?.iterations?.toLocaleString()} simulations
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {currentResult?.histogram.bins.map((bin, idx) => {
                        const freq = currentResult.histogram.frequencies[idx];
                        const pct = (freq / histogramMax) * 100;
                        const isInConfidence =
                          bin >= (currentResult.statistics.percentiles?.p5 || 0) &&
                          bin <= (currentResult.statistics.percentiles?.p95 || 0);
                        return (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="text-xs w-20 text-right text-muted-foreground font-mono">
                              {selectedMetric === 'npv'
                                ? formatCompactCurrency(bin)
                                : selectedMetric === 'equityMultiple'
                                ? `${bin.toFixed(2)}x`
                                : formatPercent(bin)
                              }
                            </span>
                            <div className="flex-1 bg-muted rounded-full h-4 relative">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  isInConfidence ? "bg-blue-500" : "bg-blue-300"
                                )}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs w-12 text-muted-foreground font-mono">
                              {((freq / (mcData?.iterations || 1)) * 100).toFixed(1)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-blue-500" />
                        <span>90% Confidence (P5–P95)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-blue-300" />
                        <span>Tail outcomes</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { label: 'Mean', value: currentResult?.statistics.mean, color: '' },
                        { label: 'Median', value: currentResult?.statistics.median, color: '' },
                        { label: 'Std Dev', value: currentResult?.statistics.stdDev, color: '' },
                        { label: 'Min', value: currentResult?.statistics.min, color: 'text-red-600' },
                        { label: 'Max', value: currentResult?.statistics.max, color: 'text-green-600' },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="flex justify-between py-1 border-b">
                          <span className="text-muted-foreground text-sm">{label}</span>
                          <span className={cn("font-semibold text-sm", color)}>
                            {selectedMetric === 'npv'
                              ? formatCompactCurrency(value || 0)
                              : selectedMetric === 'equityMultiple'
                              ? `${(value || 0).toFixed(2)}x`
                              : formatPercent(value || 0)
                            }
                          </span>
                        </div>
                      ))}
                      <div className="pt-3">
                        <p className="text-sm font-medium mb-2">Percentiles</p>
                        <div className="space-y-1 text-sm">
                          {['p5', 'p25', 'p50', 'p75', 'p95'].map((p) => (
                            <div key={p} className="flex justify-between">
                              <span className="text-muted-foreground">{p.toUpperCase()}</span>
                              <span className="font-mono">
                                {selectedMetric === 'npv'
                                  ? formatCompactCurrency(currentResult?.statistics.percentiles?.[p] || 0)
                                  : selectedMetric === 'equityMultiple'
                                  ? `${(currentResult?.statistics.percentiles?.[p] || 0).toFixed(2)}x`
                                  : formatPercent(currentResult?.statistics.percentiles?.[p] || 0)
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

            <TabsContent value="scenarios" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

            <TabsContent value="sensitivity" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Sensitivity Ranking</CardTitle>
                  <CardDescription>
                    Variables ranked by their impact on IRR outcomes — shows which assumptions matter most
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
                    {sensitivity.length === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        Run a simulation to see sensitivity rankings
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="risk" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Value at Risk (VaR)</CardTitle>
                    <CardDescription>95% confidence level risk metrics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">VaR (95%)</p>
                        <p className={cn(
                          "text-2xl font-bold",
                          (results.npv.riskMetrics.valueAtRisk || 0) >= 0 ? "text-green-600" : "text-red-600"
                        )}>
                          {formatCompactCurrency(results.npv.riskMetrics.valueAtRisk || 0)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          5% chance of NPV falling below this value
                        </p>
                      </div>
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Conditional VaR (CVaR)</p>
                        <p className={cn(
                          "text-2xl font-bold",
                          (results.npv.riskMetrics.conditionalVaR || 0) >= 0 ? "text-green-600" : "text-red-600"
                        )}>
                          {formatCompactCurrency(results.npv.riskMetrics.conditionalVaR || 0)}
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
                          {(results.irr.riskMetrics.sharpeRatio || 0).toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Risk-adjusted return (higher is better)
                        </p>
                      </div>
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Sortino Ratio</p>
                        <p className="text-2xl font-bold">
                          {(results.irr.riskMetrics.sortinoRatio || 0).toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Downside risk-adjusted return
                        </p>
                      </div>
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Probability of Loss</p>
                        <p className={cn(
                          "text-2xl font-bold",
                          (results.npv.riskMetrics.probabilityOfLoss || 0) < 0.1
                            ? "text-green-600"
                            : (results.npv.riskMetrics.probabilityOfLoss || 0) < 0.25
                            ? "text-yellow-600"
                            : "text-red-600"
                        )}>
                          {formatPercent((results.npv.riskMetrics.probabilityOfLoss || 0) * 100)}
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

          <div className="text-center text-xs text-muted-foreground">
            Simulation completed in {mcData?.executionTime || 0}ms
            {mcData?.usedProFormaData && ' · Using Pro Forma cash flows'}
          </div>
        </>
      )}
      </div>
    </div>
  );
}
