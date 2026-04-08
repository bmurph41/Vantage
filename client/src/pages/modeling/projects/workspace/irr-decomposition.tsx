import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  TrendingUp,
  TrendingDown,
  Download,
  RefreshCw,
  BarChart3,
  Layers,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  DollarSign,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { cn, formatCurrency, formatPercent } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';

interface IRRDecompositionData {
  unleveredIRR: number;
  leveredIRR: number;
  leverageEffect: number;
  equityMultiple: number;
  avgCashOnCash: number;
  attribution: {
    goingInYield: number;
    noiGrowth: number;
    capRateCompression: number;
    debtPaydown: number;
    leverageEffect: number;
  };
  annualCashOnCash: {
    year: number;
    cashOnCash: number;
    leveredCashFlow: number;
    equityInvested: number;
  }[];
  unleveredVsLevered: {
    metric: string;
    unlevered: number;
    levered: number;
    unit: string;
  }[];
  detailedAttribution: {
    component: string;
    bps: number;
    percentage: number;
    description: string;
  }[];
}

interface IRRDecompositionProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

const WATERFALL_COLORS: Record<string, string> = {
  'Going-in Yield': '#3b82f6',
  'NOI Growth': '#10b981',
  'Cap Rate Compression': '#8b5cf6',
  'Debt Paydown': '#f59e0b',
  'Leverage Effect': '#ec4899',
  'Levered IRR': '#059669',
};

function formatBps(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(0)} bps`;
}

export default function IRRDecomposition({ projectId, onTabChange }: IRRDecompositionProps) {
  const [activeTab, setActiveTab] = useState('bridge');

  const { data: project, isLoading: projectLoading } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId],
    enabled: !!projectId,
  });

  const {
    data: decomposition,
    isLoading: decompositionLoading,
    isError,
    error: decompositionError,
    refetch,
  } = useQuery<IRRDecompositionData>({
    queryKey: ['irr-decomposition', projectId],
    queryFn: async () => {
      const res = await apiRequest('POST', '/api/institutional-analysis/irr-decomposition', {
        projectId,
      });
      return res.json();
    },
    enabled: !!projectId,
    retry: false,
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/institutional-analysis/export/excel', {
        projectId,
        analysisType: 'irr-decomposition',
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `irr-decomposition-${projectId}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    },
  });

  const waterfallData = useMemo(() => {
    if (!decomposition) return [];
    const { attribution } = decomposition;

    const items = [
      { name: 'Going-in Yield', value: attribution.goingInYield, isTotal: false },
      { name: 'NOI Growth', value: attribution.noiGrowth, isTotal: false },
      { name: 'Cap Rate Compression', value: attribution.capRateCompression, isTotal: false },
      { name: 'Debt Paydown', value: attribution.debtPaydown, isTotal: false },
      { name: 'Leverage Effect', value: attribution.leverageEffect, isTotal: false },
    ];

    let cumulative = 0;
    const chartData = items.map((item) => {
      const start = cumulative;
      cumulative += item.value;
      return {
        name: item.name,
        value: item.value,
        start,
        end: cumulative,
        fill: WATERFALL_COLORS[item.name] || '#6b7280',
      };
    });

    chartData.push({
      name: 'Levered IRR',
      value: decomposition.leveredIRR,
      start: 0,
      end: decomposition.leveredIRR,
      fill: WATERFALL_COLORS['Levered IRR'],
    });

    return chartData;
  }, [decomposition]);

  const cashOnCashChartData = useMemo(() => {
    if (!decomposition?.annualCashOnCash) return [];
    return decomposition.annualCashOnCash.map((item) => ({
      year: `Year ${item.year}`,
      cashOnCash: item.cashOnCash,
      leveredCF: item.leveredCashFlow,
    }));
  }, [decomposition]);

  const isLoading = projectLoading || decompositionLoading;

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-72" />
        <div className="grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (isError) {
    const errMsg = (decompositionError as any)?.message ?? '';
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8 text-center space-y-4">
        <div className="rounded-full bg-amber-100 dark:bg-amber-950 p-4">
          <AlertCircle className="h-8 w-8 text-amber-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-1">IRR Decomposition Unavailable</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {errMsg || 'Unable to compute IRR decomposition. Ensure the project has complete assumptions and cash flow data.'}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
          {onTabChange && (
            <Button size="sm" onClick={() => onTabChange('inputs')}>
              Go to Inputs
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (!decomposition) return null;

  const kpis = [
    {
      label: 'Unlevered IRR',
      value: formatPercent(decomposition.unleveredIRR),
      icon: TrendingUp,
      accent: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950',
    },
    {
      label: 'Levered IRR',
      value: formatPercent(decomposition.leveredIRR),
      icon: ArrowUpRight,
      accent: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      label: 'Leverage Effect',
      value: formatBps(decomposition.leverageEffect),
      icon: decomposition.leverageEffect >= 0 ? ArrowUpRight : ArrowDownRight,
      accent: decomposition.leverageEffect >= 0
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-red-600 dark:text-red-400',
      bg: decomposition.leverageEffect >= 0
        ? 'bg-emerald-50 dark:bg-emerald-950'
        : 'bg-red-50 dark:bg-red-950',
    },
    {
      label: 'Equity Multiple',
      value: `${decomposition.equityMultiple.toFixed(2)}x`,
      icon: Layers,
      accent: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-950',
    },
    {
      label: 'Avg Cash-on-Cash',
      value: formatPercent(decomposition.avgCashOnCash),
      icon: Percent,
      accent: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950',
    },
  ];

  return (
    <div className="space-y-6" data-testid="irr-decomposition-page">
      {/* Header */}
      <div className="fm-header">
        <div>
          <div className="fm-header-title">IRR Decomposition</div>
          <div className="fm-header-sub">
            Return attribution and leverage analysis
            {project?.name ? ` -- ${project.name}` : ''}
          </div>
        </div>
        <div className="fm-header-actions">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
          >
            <Download className="h-4 w-4 mr-2" />
            {exportMutation.isPending ? 'Exporting...' : 'Export Excel'}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className={cn('border', kpi.bg)}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={cn('h-4 w-4', kpi.accent)} />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {kpi.label}
                  </span>
                </div>
                <p className={cn('text-2xl font-bold tabular-nums', kpi.accent)}>{kpi.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="bridge" data-testid="tab-bridge">
            <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
            Attribution Bridge
          </TabsTrigger>
          <TabsTrigger value="cash-on-cash" data-testid="tab-coc">
            <DollarSign className="h-3.5 w-3.5 mr-1.5" />
            Cash-on-Cash
          </TabsTrigger>
          <TabsTrigger value="detail" data-testid="tab-detail">
            <Layers className="h-3.5 w-3.5 mr-1.5" />
            Detail
          </TabsTrigger>
        </TabsList>

        {/* Attribution Bridge Tab */}
        <TabsContent value="bridge" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Return Attribution Bridge</CardTitle>
              <CardDescription>
                Decomposition of levered IRR into contributing factors
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={waterfallData} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    opacity={0.4}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `${v.toFixed(1)}%`}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartTooltip
                    formatter={(value: number, name: string) => [
                      `${value.toFixed(2)}%`,
                      name,
                    ]}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 6,
                      border: '1px solid hsl(var(--border))',
                    }}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {waterfallData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Side-by-side: Unlevered vs Levered */}
          <Card>
            <CardHeader>
              <CardTitle>Unlevered vs Levered Comparison</CardTitle>
              <CardDescription>
                Impact of financing on return metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full">
                <div className="overflow-x-auto w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">Metric</TableHead>
                      <TableHead className="text-right">Unlevered</TableHead>
                      <TableHead className="text-right">Levered</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {decomposition.unleveredVsLevered.map((row) => {
                      const diff = row.levered - row.unlevered;
                      const formatVal = (v: number) => {
                        if (row.unit === '%') return formatPercent(v);
                        if (row.unit === 'x') return `${v.toFixed(2)}x`;
                        if (row.unit === '$') return formatCurrency(v);
                        return v.toFixed(2);
                      };
                      return (
                        <TableRow key={row.metric}>
                          <TableCell className="font-medium">{row.metric}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatVal(row.unlevered)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-semibold">
                            {formatVal(row.levered)}
                          </TableCell>
                          <TableCell
                            className={cn(
                              'text-right tabular-nums',
                              diff > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : diff < 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-muted-foreground'
                            )}
                          >
                            {diff > 0 ? '+' : ''}
                            {formatVal(diff)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cash-on-Cash Tab */}
        <TabsContent value="cash-on-cash" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Annual Cash-on-Cash Return</CardTitle>
              <CardDescription>
                Year-by-year levered cash yield on invested equity
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cashOnCashChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={cashOnCashChartData}
                    margin={{ top: 10, right: 20, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                      opacity={0.4}
                    />
                    <XAxis
                      dataKey="year"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => `${v.toFixed(1)}%`}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartTooltip
                      formatter={(value: number, name: string) => [
                        `${value.toFixed(2)}%`,
                        name === 'cashOnCash' ? 'Cash-on-Cash' : 'Levered CF',
                      ]}
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 6,
                        border: '1px solid hsl(var(--border))',
                      }}
                    />
                    <ReferenceLine
                      y={decomposition.avgCashOnCash}
                      stroke="#f59e0b"
                      strokeDasharray="6 3"
                      label={{
                        value: `Avg ${formatPercent(decomposition.avgCashOnCash)}`,
                        position: 'right',
                        fontSize: 11,
                        fill: '#f59e0b',
                      }}
                    />
                    <Bar dataKey="cashOnCash" fill="#3b82f6" radius={[4, 4, 0, 0]} name="cashOnCash">
                      {cashOnCashChartData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={entry.cashOnCash >= decomposition.avgCashOnCash ? '#10b981' : '#3b82f6'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-muted-foreground">
                  No annual cash flow data available
                </div>
              )}

              {/* Summary table beneath chart */}
              {decomposition.annualCashOnCash.length > 0 && (
                <div className="mt-6 border-t pt-4">
                  <ScrollArea className="w-full">
                    <div className="overflow-x-auto w-full">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Year</TableHead>
                          <TableHead className="text-right">Levered Cash Flow</TableHead>
                          <TableHead className="text-right">Equity Invested</TableHead>
                          <TableHead className="text-right">Cash-on-Cash</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {decomposition.annualCashOnCash.map((row) => (
                          <TableRow key={row.year}>
                            <TableCell className="font-medium">Year {row.year}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(row.leveredCashFlow)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(row.equityInvested)}
                            </TableCell>
                            <TableCell
                              className={cn(
                                'text-right tabular-nums font-semibold',
                                row.cashOnCash >= decomposition.avgCashOnCash
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-muted-foreground'
                              )}
                            >
                              {formatPercent(row.cashOnCash)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Detail Tab */}
        <TabsContent value="detail" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Return Attribution</CardTitle>
              <CardDescription>
                Granular breakdown of each return component with basis-point contribution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="w-full">
                <div className="overflow-x-auto w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[240px]">Component</TableHead>
                      <TableHead className="text-right">Contribution (bps)</TableHead>
                      <TableHead className="text-right">% of Levered IRR</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {decomposition.detailedAttribution.map((row) => (
                      <TableRow key={row.component}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2.5 w-2.5 rounded-full"
                              style={{
                                backgroundColor:
                                  WATERFALL_COLORS[row.component] || '#6b7280',
                              }}
                            />
                            <span className="font-medium">{row.component}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <Badge
                            variant={row.bps >= 0 ? 'default' : 'destructive'}
                            className="font-mono text-xs"
                          >
                            {formatBps(row.bps)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.percentage.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[300px]">
                          {row.description}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 font-semibold">
                      <TableCell>Total Levered IRR</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <Badge className="font-mono text-xs">
                          {(decomposition.leveredIRR * 100).toFixed(0)} bps
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">100.0%</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
