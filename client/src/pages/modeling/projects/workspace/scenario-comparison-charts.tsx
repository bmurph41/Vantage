import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  GitCompare,
  RefreshCw,
  Download,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Info,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';
import type { ScenarioComparisonData, ScenarioComparisonScenario, ScenarioComparisonMetric } from '@/types/modeling';

interface ScenarioComparisonChartsProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

const SCENARIO_COLORS: Record<string, string> = {
  base: '#3b82f6',
  aggressive: '#10b981',
  conservative: '#ef4444',
  custom: '#8b5cf6',
};

const SEVERITY_CONFIG: Record<string, { icon: any; bg: string; border: string; text: string }> = {
  high: { icon: ShieldAlert, bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-400' },
  medium: { icon: AlertTriangle, bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400' },
  low: { icon: Info, bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-400' },
};

export default function ScenarioComparisonCharts({ projectId, onTabChange }: ScenarioComparisonChartsProps) {
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>(['base', 'aggressive', 'conservative']);
  const [activeTab, setActiveTab] = useState('overview');

  const { data: comparisonData, isLoading, isError, refetch } = useQuery<ScenarioComparisonData>({
    queryKey: ['/api/modeling/projects', projectId, 'scenario-comparison'],
  });

  const scenarios = useMemo(() => {
    if (!comparisonData?.scenarios) return [];
    return comparisonData.scenarios.filter((s: any) => selectedScenarios.includes(s.id));
  }, [comparisonData, selectedScenarios]);

  const allScenarios = comparisonData?.scenarios || [];

  const toggleScenario = (scenarioId: string) => {
    setSelectedScenarios(prev => {
      if (prev.includes(scenarioId)) {
        if (prev.length === 1) return prev;
        return prev.filter(s => s !== scenarioId);
      }
      return [...prev, scenarioId];
    });
  };

  const metricsComparisonData = useMemo(() => {
    if (!comparisonData?.comparisonMetrics) return [];
    return comparisonData.comparisonMetrics;
  }, [comparisonData]);

  const yearlyComparisonData = useMemo(() => {
    if (!scenarios.length) return [];
    const maxYears = Math.max(...scenarios.map((s: any) => s.yearlyData?.length || 0));
    return Array.from({ length: maxYears }, (_, i) => {
      const dataPoint: any = { year: i + 1 };
      scenarios.forEach((scenario: any) => {
        const yearData = scenario.yearlyData?.[i];
        if (yearData) {
          dataPoint[`${scenario.id}_revenue`] = yearData.revenue;
          dataPoint[`${scenario.id}_noi`] = yearData.noi;
          dataPoint[`${scenario.id}_cashFlow`] = yearData.cashFlow;
        }
      });
      return dataPoint;
    });
  }, [scenarios]);

  const radarData = useMemo(() => {
    if (!scenarios.length) return [];
    const allValues: Record<string, number[]> = {
      revenue: [], noi: [], noiMargin: [], irr: [], equityMultiple: [],
    };
    scenarios.forEach((s: any) => {
      allValues.revenue.push(s.metrics.totalRevenue);
      allValues.noi.push(s.metrics.noi);
      allValues.noiMargin.push(s.metrics.noiMargin);
      allValues.irr.push(s.metrics.irr);
      allValues.equityMultiple.push(s.metrics.equityMultiple);
    });

    const metrics = [
      { key: 'revenue', label: 'Revenue', max: Math.max(...allValues.revenue, 1) * 1.2 },
      { key: 'noi', label: 'NOI', max: Math.max(...allValues.noi, 1) * 1.2 },
      { key: 'noiMargin', label: 'NOI Margin', max: Math.max(...allValues.noiMargin, 1) * 1.2 },
      { key: 'irr', label: 'IRR', max: Math.max(...allValues.irr, 1) * 1.2 },
      { key: 'equityMultiple', label: 'Equity Multiple', max: Math.max(...allValues.equityMultiple, 1) * 1.2 },
    ];

    return metrics.map(metric => {
      const dataPoint: any = { metric: metric.label };
      scenarios.forEach((scenario: any) => {
        const value = metric.key === 'revenue' ? scenario.metrics.totalRevenue :
                     metric.key === 'noi' ? scenario.metrics.noi :
                     metric.key === 'noiMargin' ? scenario.metrics.noiMargin :
                     metric.key === 'irr' ? scenario.metrics.irr :
                     scenario.metrics.equityMultiple;
        dataPoint[scenario.id] = metric.max > 0 ? (value / metric.max) * 100 : 0;
      });
      return dataPoint;
    });
  }, [scenarios]);

  const revenueComparisonData = useMemo(() => {
    if (!scenarios.length) return [];
    const categorySet = new Set<string>();
    scenarios.forEach((s: any) => s.revenueBreakdown?.forEach((r: any) => categorySet.add(r.name)));
    return Array.from(categorySet).map(category => {
      const dataPoint: any = { category };
      scenarios.forEach((scenario: any) => {
        const item = scenario.revenueBreakdown?.find((r: any) => r.name === category);
        dataPoint[scenario.id] = item?.value || 0;
      });
      return dataPoint;
    });
  }, [scenarios]);

  const allRisks = useMemo(() => {
    return allScenarios.flatMap((s: any) =>
      (s.risks || []).map((r: any) => ({ ...r, scenarioId: s.id, scenarioName: s.name }))
    );
  }, [allScenarios]);

  const getVariance = (scenarioValue: number, baseValue: number) => {
    if (!baseValue) return 0;
    return ((scenarioValue - baseValue) / Math.abs(baseValue)) * 100;
  };

  const formatMetricValue = (value: number, unit: string) => {
    if (unit === 'currency') return formatCurrency(value);
    if (unit === 'percent') return `${value.toFixed(1)}%`;
    if (unit === 'multiple') return `${value.toFixed(2)}x`;
    return value.toFixed(2);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-32" />)}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (isError || !comparisonData?.scenarios?.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <GitCompare className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Scenario Data Available</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
            Configure your project with financial data and scenario assumptions to see side-by-side comparisons.
          </p>
          <Button variant="outline" onClick={() => onTabChange?.('case-config')}>
            Configure Scenarios
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <GitCompare className="h-6 w-6 text-primary" />
            Scenario Comparison
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Side-by-side financial projections and risk analysis
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        {allScenarios.map((scenario: any) => {
          const isSelected = selectedScenarios.includes(scenario.id);
          const riskCount = scenario.risks?.length || 0;
          return (
            <div
              key={scenario.id}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg border cursor-pointer transition-all ${
                isSelected ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'
              }`}
              onClick={() => toggleScenario(scenario.id)}
            >
              <Checkbox checked={isSelected} />
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: scenario.color || SCENARIO_COLORS[scenario.id] }}
              />
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{scenario.name}</p>
                  {riskCount > 0 && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0 text-amber-600 border-amber-300">
                      {riskCount} risk{riskCount > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{scenario.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Mix</TabsTrigger>
          <TabsTrigger value="risks" className="relative">
            Risks
            {allRisks.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                {allRisks.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Performance Radar</CardTitle>
                <CardDescription>Normalized comparison across key metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    {scenarios.map((scenario: any) => (
                      <Radar
                        key={scenario.id}
                        name={scenario.name}
                        dataKey={scenario.id}
                        stroke={scenario.color || SCENARIO_COLORS[scenario.id]}
                        fill={scenario.color || SCENARIO_COLORS[scenario.id]}
                        fillOpacity={0.2}
                      />
                    ))}
                    <Legend />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Key Metrics Comparison</CardTitle>
                <CardDescription>Side-by-side scenario metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metricsComparisonData.slice(0, 5).map((metric: any) => {
                    const baseValue = metric.scenarios.find((s: any) => s.id === 'base')?.value || 0;
                    return (
                      <div key={metric.id || metric.metric} className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">{metric.name || metric.metric}</p>
                        <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${scenarios.length}, minmax(0, 1fr))` }}>
                          {scenarios.map((scenario: any) => {
                            const metricScenario = metric.scenarios.find((s: any) => s.id === scenario.id);
                            const value = metricScenario?.value || 0;
                            const variance = scenario.id !== 'base' ? getVariance(value, baseValue) : 0;
                            return (
                              <div
                                key={scenario.id}
                                className="p-3 rounded-lg border"
                                style={{ borderColor: (scenario.color || SCENARIO_COLORS[scenario.id]) + '40' }}
                              >
                                <p className="text-xs text-muted-foreground">{scenario.name}</p>
                                <p className="font-bold tabular-nums">{formatMetricValue(value, metric.unit)}</p>
                                {scenario.id !== 'base' && variance !== 0 && (
                                  <p className={`text-xs flex items-center gap-1 ${
                                    variance >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {variance >= 0 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                    {Math.abs(variance).toFixed(1)}%
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">NOI Trend Comparison</CardTitle>
              <CardDescription>Year-over-year NOI by scenario</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={yearlyComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="year" tickFormatter={(v) => `Yr ${v}`} />
                  <YAxis tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => `Year ${label}`}
                  />
                  <Legend />
                  {scenarios.map((scenario: any) => (
                    <Line
                      key={scenario.id}
                      type="monotone"
                      dataKey={`${scenario.id}_noi`}
                      name={`${scenario.name} NOI`}
                      stroke={scenario.color || SCENARIO_COLORS[scenario.id]}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {allRisks.filter((r: any) => r.severity === 'high').length > 0 && (
            <Card className="border-red-200 dark:border-red-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-red-700 dark:text-red-400">
                  <ShieldAlert className="h-5 w-5" />
                  Critical Risk Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {allRisks.filter((r: any) => r.severity === 'high').map((risk: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                      <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-red-800 dark:text-red-300">{risk.scenarioName}</p>
                        <p className="text-xs text-red-700 dark:text-red-400">{risk.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="metrics" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Detailed Metrics Comparison</CardTitle>
              <CardDescription>All key performance indicators across scenarios</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Metric</TableHead>
                    {scenarios.map((scenario: any) => (
                      <TableHead key={scenario.id} className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: scenario.color || SCENARIO_COLORS[scenario.id] }}
                          />
                          {scenario.name}
                        </div>
                      </TableHead>
                    ))}
                    {scenarios.length > 1 && (
                      <TableHead className="text-center">Variance (vs Base)</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metricsComparisonData.map((metric: any) => {
                    const baseValue = metric.scenarios.find((s: any) => s.id === 'base')?.value || 0;
                    return (
                      <TableRow key={metric.id || metric.metric}>
                        <TableCell className="font-medium">{metric.name || metric.metric}</TableCell>
                        {scenarios.map((scenario: any) => {
                          const value = metric.scenarios.find((s: any) => s.id === scenario.id)?.value || 0;
                          return (
                            <TableCell key={scenario.id} className="text-center tabular-nums">
                              {formatMetricValue(value, metric.unit)}
                            </TableCell>
                          );
                        })}
                        {scenarios.length > 1 && (
                          <TableCell className="text-center">
                            <div className="flex justify-center gap-2">
                              {scenarios.filter((s: any) => s.id !== 'base').map((scenario: any) => {
                                const value = metric.scenarios.find((s: any) => s.id === scenario.id)?.value || 0;
                                const variance = getVariance(value, baseValue);
                                return (
                                  <Badge
                                    key={scenario.id}
                                    variant={variance >= 0 ? 'default' : 'destructive'}
                                    className="min-w-[60px] tabular-nums"
                                  >
                                    {variance >= 0 ? '+' : ''}{variance.toFixed(1)}%
                                  </Badge>
                                );
                              })}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className={`grid gap-6`} style={{ gridTemplateColumns: `repeat(${Math.min(scenarios.length, 3)}, minmax(0, 1fr))` }}>
            {scenarios.map((scenario: any) => (
              <Card key={scenario.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: scenario.color || SCENARIO_COLORS[scenario.id] }}
                    />
                    <CardTitle className="text-lg">{scenario.name}</CardTitle>
                  </div>
                  <CardDescription>{scenario.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                      <span className="text-sm">Revenue Growth</span>
                      <span className="font-bold tabular-nums">{(scenario.assumptions?.revenueGrowth ?? 0).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                      <span className="text-sm">Expense Growth</span>
                      <span className="font-bold tabular-nums">{(scenario.assumptions?.expenseGrowth ?? 0).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                      <span className="text-sm">Exit Cap Rate</span>
                      <span className="font-bold tabular-nums">{(scenario.assumptions?.exitCapRate ?? 0).toFixed(1)}%</span>
                    </div>
                    {scenario.metrics?.minDscr != null && (
                      <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                        <span className="text-sm">Min DSCR</span>
                        <span className="font-bold tabular-nums">{scenario.metrics.minDscr.toFixed(2)}x</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6 mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Revenue Trend</CardTitle>
                <CardDescription>Annual revenue projection by scenario</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={yearlyComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="year" tickFormatter={(v) => `Yr ${v}`} />
                    <YAxis tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    {scenarios.map((scenario: any) => (
                      <Bar
                        key={scenario.id}
                        dataKey={`${scenario.id}_revenue`}
                        name={scenario.name}
                        fill={scenario.color || SCENARIO_COLORS[scenario.id]}
                        maxBarSize={40}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Cash Flow Trend</CardTitle>
                <CardDescription>Levered cash flow projection by scenario</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={yearlyComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="year" tickFormatter={(v) => `Yr ${v}`} />
                    <YAxis tickFormatter={(val) => `$${(val / 1000000).toFixed(2)}M`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    {scenarios.map((scenario: any) => (
                      <Line
                        key={scenario.id}
                        type="monotone"
                        dataKey={`${scenario.id}_cashFlow`}
                        name={`${scenario.name} Cash Flow`}
                        stroke={scenario.color || SCENARIO_COLORS[scenario.id]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">NOI Comparison Over Time</CardTitle>
              <CardDescription>Net Operating Income trajectory across scenarios</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={yearlyComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="year" tickFormatter={(v) => `Yr ${v}`} />
                  <YAxis tickFormatter={(val) => `$${(val / 1000000).toFixed(2)}M`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  {scenarios.map((scenario: any) => (
                    <Bar
                      key={scenario.id}
                      dataKey={`${scenario.id}_noi`}
                      name={`${scenario.name} NOI`}
                      fill={scenario.color || SCENARIO_COLORS[scenario.id]}
                      maxBarSize={40}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6 mt-6">
          {revenueComparisonData.length > 0 ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Revenue Mix by Scenario</CardTitle>
                  <CardDescription>Revenue breakdown comparison across scenarios</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={revenueComparisonData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                      <XAxis type="number" tickFormatter={(val) => `$${(val / 1000).toFixed(0)}K`} />
                      <YAxis type="category" dataKey="category" width={120} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      {scenarios.map((scenario: any) => (
                        <Bar
                          key={scenario.id}
                          dataKey={scenario.id}
                          name={scenario.name}
                          fill={scenario.color || SCENARIO_COLORS[scenario.id]}
                          maxBarSize={40}
                          radius={[0, 4, 4, 0]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className={`grid gap-6`} style={{ gridTemplateColumns: `repeat(${Math.min(scenarios.length, 3)}, minmax(0, 1fr))` }}>
                {scenarios.map((scenario: any) => (
                  <Card key={scenario.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: scenario.color || SCENARIO_COLORS[scenario.id] }}
                        />
                        <CardTitle className="text-lg">{scenario.name}</CardTitle>
                      </div>
                      <CardDescription>Revenue breakdown</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {(scenario.revenueBreakdown || []).map((item: any) => (
                          <div key={item.name} className="flex items-center justify-between">
                            <span className="text-sm truncate mr-2">{item.name}</span>
                            <span className="font-medium tabular-nums shrink-0">{formatCurrency(item.value)}</span>
                          </div>
                        ))}
                        <div className="pt-2 border-t flex justify-between">
                          <span className="font-medium">Total</span>
                          <span className="font-bold tabular-nums">
                            {formatCurrency((scenario.revenueBreakdown || []).reduce((sum: number, r: any) => sum + r.value, 0))}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No revenue breakdown data available.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="risks" className="space-y-6 mt-6">
          {allRisks.length > 0 ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                {['high', 'medium', 'low'].map(severity => {
                  const count = allRisks.filter((r: any) => r.severity === severity).length;
                  const config = SEVERITY_CONFIG[severity];
                  const Icon = config.icon;
                  return (
                    <Card key={severity} className={`${config.border}`}>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${config.bg}`}>
                            <Icon className={`h-5 w-5 ${config.text}`} />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{count}</p>
                            <p className="text-sm text-muted-foreground capitalize">{severity} Severity</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {allScenarios.map((scenario: any) => {
                const scenarioRisks = scenario.risks || [];
                if (scenarioRisks.length === 0) return null;
                return (
                  <Card key={scenario.id}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: scenario.color || SCENARIO_COLORS[scenario.id] }}
                        />
                        {scenario.name}
                        <Badge variant="outline" className="ml-2">
                          {scenarioRisks.length} risk{scenarioRisks.length > 1 ? 's' : ''}
                        </Badge>
                      </CardTitle>
                      <CardDescription>{scenario.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {scenarioRisks.map((risk: any, i: number) => {
                          const config = SEVERITY_CONFIG[risk.severity] || SEVERITY_CONFIG.low;
                          const Icon = config.icon;
                          return (
                            <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${config.bg} ${config.border}`}>
                              <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.text}`} />
                              <div>
                                <p className={`text-sm font-medium ${config.text}`}>{risk.message}</p>
                                <p className="text-xs text-muted-foreground mt-1 capitalize">{risk.severity} severity</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {allScenarios.some((s: any) => !s.risks?.length) && (
                <Card className="border-green-200 dark:border-green-800">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-medium text-green-700 dark:text-green-400">No Risks Detected</p>
                        <p className="text-sm text-muted-foreground">
                          {allScenarios.filter((s: any) => !s.risks?.length).map((s: any) => s.name).join(', ')} — all metrics within acceptable thresholds
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="border-green-200 dark:border-green-800">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <ShieldCheck className="h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">All Clear</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  No risk flags detected across any scenario. All key metrics (IRR, NOI margin, equity multiple, DSCR) are within acceptable thresholds.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
