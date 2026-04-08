import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
} from 'lucide-react';

interface BenchmarkConfig {
  id: string;
  name: string;
  returnRate: number;
  enabled: boolean;
}

interface ReturnsMetrics {
  irr: number | null;
  moic: number | null;
  roi: number | null;
  grossGain: number;
}

interface ReturnsData {
  metrics: ReturnsMetrics;
  cashflows?: any[];
}

interface ReturnsBenchmarkProps {
  modelId?: string;
  portfolioMode?: boolean;
}

const COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#6366f1', // indigo
];

const DEFAULT_BENCHMARKS: BenchmarkConfig[] = [
  {
    id: 'sp500',
    name: 'S&P 500',
    returnRate: 10,
    enabled: true,
  },
  {
    id: 'ncreif',
    name: 'NCREIF Property Index',
    returnRate: 8,
    enabled: true,
  },
  {
    id: 'hurdle1',
    name: 'Custom Hurdle Rate 1',
    returnRate: 12,
    enabled: false,
  },
  {
    id: 'hurdle2',
    name: 'Custom Hurdle Rate 2',
    returnRate: 15,
    enabled: false,
  },
];

export function ReturnsBenchmark({
  modelId,
  portfolioMode = false,
}: ReturnsBenchmarkProps) {
  const [benchmarks, setBenchmarks] = useState<BenchmarkConfig[]>(
    DEFAULT_BENCHMARKS
  );

  const queryKey = portfolioMode
    ? ['/api/returns/portfolio']
    : ['/api/returns/model', modelId];

  const { data: returnsData, isLoading } = useQuery<ReturnsData>({
    queryKey,
    enabled: !portfolioMode || !!modelId,
  });

  const dealIRR = returnsData?.metrics?.irr ?? null;
  const dealMOIC = returnsData?.metrics?.moic ?? null;

  const chartData = useMemo(() => {
    if (!dealIRR) return [];

    const enabledBenchmarks = benchmarks.filter((b) => b.enabled);
    return [
      {
        name: 'Deal/Portfolio',
        value: dealIRR,
        fill: COLORS[0],
      },
      ...enabledBenchmarks.map((b, idx) => ({
        name: b.name,
        value: b.returnRate,
        fill: COLORS[(idx + 1) % COLORS.length],
      })),
    ];
  }, [dealIRR, benchmarks]);

  const tableData = useMemo(() => {
    if (!dealIRR) return [];

    return benchmarks
      .filter((b) => b.enabled)
      .map((benchmark) => {
        const delta = dealIRR - benchmark.returnRate;
        const isOutperforming = delta > 0;

        return {
          benchmark,
          delta,
          isOutperforming,
        };
      });
  }, [dealIRR, benchmarks]);

  const handleBenchmarkChange = (
    id: string,
    field: 'name' | 'returnRate' | 'enabled',
    value: any
  ) => {
    setBenchmarks((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              [field]:
                field === 'returnRate' ? parseFloat(value) || 0 : value,
            }
          : b
      )
    );
  };

  const formatPercent = (value: number | null) => {
    if (value === null) return '—';
    return `${value.toFixed(2)}%`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Main Comparison Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Returns Benchmark Comparison
              </CardTitle>
              <CardDescription>
                Compare your{' '}
                {portfolioMode ? 'portfolio' : 'deal'} IRR against
                industry benchmarks
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Key Metrics */}
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950">
                <div className="text-sm font-medium text-muted-foreground">
                  Deal IRR
                </div>
                <div className="mt-1 text-2xl font-bold">
                  {dealIRR !== null ? `${dealIRR.toFixed(2)}%` : '—'}
                </div>
              </div>
              <div className="rounded-lg bg-purple-50 p-4 dark:bg-purple-950">
                <div className="text-sm font-medium text-muted-foreground">
                  Deal MOIC
                </div>
                <div className="mt-1 text-2xl font-bold">
                  {dealMOIC !== null ? `${dealMOIC.toFixed(2)}x` : '—'}
                </div>
              </div>
              <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-950">
                <div className="text-sm font-medium text-muted-foreground">
                  Gross Gain
                </div>
                <div className="mt-1 text-2xl font-bold">
                  {returnsData?.metrics?.grossGain
                    ? formatCurrency(
                        returnsData.metrics.grossGain
                      )
                    : '—'}
                </div>
              </div>
              <div className="rounded-lg bg-emerald-50 p-4 dark:bg-emerald-950">
                <div className="text-sm font-medium text-muted-foreground">
                  ROI
                </div>
                <div className="mt-1 text-2xl font-bold">
                  {returnsData?.metrics?.roi !== null
                    ? `${(returnsData?.metrics?.roi ?? 0).toFixed(
                        2
                      )}%`
                    : '—'}
                </div>
              </div>
            </div>
          )}

          {/* Bar Chart */}
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : chartData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis label={{ value: 'Return %', angle: -90, position: 'insideLeft' }} />
                  <Tooltip
                    formatter={(value) => `${(value as number).toFixed(2)}%`}
                    contentStyle={{
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#fff',
                    }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Benchmark Comparison Table */}
      {dealIRR !== null && tableData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4" />
              IRR vs Benchmarks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Benchmark</TableHead>
                    <TableHead className="text-right">
                      Annual Return
                    </TableHead>
                    <TableHead className="text-right">
                      vs Deal IRR
                    </TableHead>
                    <TableHead className="text-right">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.map((row) => (
                    <TableRow key={row.benchmark.id}>
                      <TableCell className="font-medium">
                        {row.benchmark.name}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPercent(row.benchmark.returnRate)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            row.isOutperforming
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-red-600 dark:text-red-400'
                          }
                        >
                          {row.isOutperforming ? '+' : ''}
                          {row.delta.toFixed(2)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {row.isOutperforming ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
                            <TrendingUp className="mr-1 h-3 w-3" />
                            Outperforming
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-200">
                            <TrendingDown className="mr-1 h-3 w-3" />
                            Underperforming
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
          </CardContent>
        </Card>
      )}

      {/* MOIC Comparison */}
      {dealMOIC !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">MOIC Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Deal MOIC:</span>
                <span className="text-lg font-bold">
                  {dealMOIC.toFixed(2)}x
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                Your deal returns {dealMOIC}x invested capital over its
                hold period.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Benchmark Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Benchmark Configuration
          </CardTitle>
          <CardDescription>
            Customize your benchmarks for comparison
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Enabled</TableHead>
                  <TableHead>Benchmark Name</TableHead>
                  <TableHead className="w-24 text-right">
                    Annual Return %
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {benchmarks.map((benchmark) => (
                  <TableRow key={benchmark.id}>
                    <TableCell>
                      <Checkbox
                        checked={benchmark.enabled}
                        onCheckedChange={(checked) =>
                          handleBenchmarkChange(
                            benchmark.id,
                            'enabled',
                            checked
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={benchmark.name}
                        onChange={(e) =>
                          handleBenchmarkChange(
                            benchmark.id,
                            'name',
                            e.target.value
                          )
                        }
                        placeholder="Benchmark name"
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={benchmark.returnRate}
                        onChange={(e) =>
                          handleBenchmarkChange(
                            benchmark.id,
                            'returnRate',
                            e.target.value
                          )
                        }
                        placeholder="0.00"
                        className="h-8 text-right"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
