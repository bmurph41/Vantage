import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Shield,
  Activity,
  Download,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { cn, formatPercent } from '@/lib/utils';

interface BenchmarkData {
  name: string;
  rate: number;
  category: string;
  description: string;
}

interface SpreadAnalysis {
  benchmark: string;
  benchmarkRate: number;
  dealIRR: number;
  spread: number;
  attractiveness: 'attractive' | 'neutral' | 'unattractive';
}

interface RiskAdjustedMetrics {
  excessReturn: number;
  volatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  treynorRatio: number;
  informationRatio: number;
}

interface BenchmarkOverlayResponse {
  dealIRR: number;
  dealVolatility: number;
  benchmarks: BenchmarkData[];
  spreadAnalysis: SpreadAnalysis[];
  riskAdjusted: RiskAdjustedMetrics;
}

interface BenchmarkOverlayProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

const BENCHMARK_COLORS: Record<string, string> = {
  '10Y Treasury': '#94a3b8',
  'S&P 500': '#3b82f6',
  'Infrastructure PE Median': '#8b5cf6',
  'Fund Hurdle Rate': '#f59e0b',
  'Opportunity Cost': '#ef4444',
  'Deal IRR': '#10b981',
};

const DEFAULT_BENCHMARKS: BenchmarkData[] = [
  { name: '10Y Treasury', rate: 4.25, category: 'Risk-Free', description: 'US 10-Year Treasury yield' },
  { name: 'S&P 500', rate: 10.5, category: 'Public Equity', description: 'Long-term S&P 500 total return' },
  { name: 'Infrastructure PE Median', rate: 14.0, category: 'Private Equity', description: 'Median infrastructure PE fund return' },
  { name: 'Fund Hurdle Rate', rate: 8.0, category: 'Fund Threshold', description: 'LP preferred return hurdle' },
  { name: 'Opportunity Cost', rate: 12.0, category: 'Alternative', description: 'Next best alternative investment' },
];

function getAttractivenessColor(attractiveness: string): string {
  switch (attractiveness) {
    case 'attractive': return 'text-emerald-600';
    case 'neutral': return 'text-amber-600';
    case 'unattractive': return 'text-red-600';
    default: return 'text-slate-600';
  }
}

function getAttractivenessVariant(attractiveness: string): 'default' | 'secondary' | 'destructive' {
  switch (attractiveness) {
    case 'attractive': return 'default';
    case 'neutral': return 'secondary';
    case 'unattractive': return 'destructive';
    default: return 'secondary';
  }
}

function BenchmarkOverlay({ projectId, onTabChange }: BenchmarkOverlayProps) {
  const [selectedView, setSelectedView] = useState<'chart' | 'table'>('chart');

  const { data, isLoading } = useQuery<BenchmarkOverlayResponse>({
    queryKey: ['/api/modeling/projects', projectId, 'benchmark-overlay'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/modeling/projects/${projectId}/benchmark-overlay`);
      return res.json();
    },
    enabled: !!projectId,
  });

  const dealIRR = data?.dealIRR ?? 16.5;
  const dealVolatility = data?.dealVolatility ?? 8.2;
  const benchmarks = data?.benchmarks ?? DEFAULT_BENCHMARKS;

  const spreadAnalysis: SpreadAnalysis[] = useMemo(() => {
    return data?.spreadAnalysis ?? benchmarks.map((b) => {
      const spread = dealIRR - b.rate;
      return {
        benchmark: b.name,
        benchmarkRate: b.rate,
        dealIRR,
        spread,
        attractiveness: spread > 3 ? 'attractive' as const : spread > 0 ? 'neutral' as const : 'unattractive' as const,
      };
    });
  }, [data, benchmarks, dealIRR]);

  const riskAdjusted: RiskAdjustedMetrics = useMemo(() => {
    if (data?.riskAdjusted) return data.riskAdjusted;
    const riskFreeRate = benchmarks.find(b => b.name === '10Y Treasury')?.rate ?? 4.25;
    const excessReturn = dealIRR - riskFreeRate;
    return {
      excessReturn,
      volatility: dealVolatility,
      sharpeRatio: excessReturn / dealVolatility,
      sortinoRatio: excessReturn / (dealVolatility * 0.7),
      treynorRatio: excessReturn / 1.1,
      informationRatio: (dealIRR - 10.5) / 5.0,
    };
  }, [data, dealIRR, dealVolatility, benchmarks]);

  const chartData = useMemo(() => {
    const items = benchmarks.map((b) => ({
      name: b.name,
      rate: b.rate,
      fill: BENCHMARK_COLORS[b.name] ?? '#94a3b8',
      isDeal: false,
    }));
    items.push({
      name: 'Deal IRR',
      rate: dealIRR,
      fill: BENCHMARK_COLORS['Deal IRR'],
      isDeal: true,
    });
    return items.sort((a, b) => a.rate - b.rate);
  }, [benchmarks, dealIRR]);

  const spreadToTreasuries = dealIRR - (benchmarks.find(b => b.name === '10Y Treasury')?.rate ?? 4.25);
  const spreadToPEMedian = dealIRR - (benchmarks.find(b => b.name === 'Infrastructure PE Median')?.rate ?? 14.0);
  const riskPremium = dealIRR - (benchmarks.find(b => b.name === 'Fund Hurdle Rate')?.rate ?? 8.0);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="p-6"><div className="h-24 bg-muted animate-pulse rounded" /></CardContent></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Deal IRR</div>
              <Target className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold mt-1">{dealIRR.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground mt-1">Levered project return</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Spread to Treasuries</div>
              {spreadToTreasuries > 0 ? <ArrowUpRight className="h-4 w-4 text-emerald-500" /> : <ArrowDownRight className="h-4 w-4 text-red-500" />}
            </div>
            <div className="text-2xl font-bold mt-1">{spreadToTreasuries > 0 ? '+' : ''}{spreadToTreasuries.toFixed(0)} bps</div>
            <div className="text-xs text-muted-foreground mt-1">vs 10Y UST {benchmarks.find(b => b.name === '10Y Treasury')?.rate ?? 4.25}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Spread to PE Median</div>
              {spreadToPEMedian > 0 ? <TrendingUp className="h-4 w-4 text-emerald-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
            </div>
            <div className="text-2xl font-bold mt-1">{spreadToPEMedian > 0 ? '+' : ''}{spreadToPEMedian.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground mt-1">vs Infrastructure PE 14.0%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Risk Premium</div>
              <Shield className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold mt-1">{riskPremium > 0 ? '+' : ''}{riskPremium.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground mt-1">Above fund hurdle rate</div>
          </CardContent>
        </Card>
      </div>

      {/* Chart / Table Toggle */}
      <div className="flex items-center gap-2">
        <Button variant={selectedView === 'chart' ? 'default' : 'outline'} size="sm" onClick={() => setSelectedView('chart')}>Chart View</Button>
        <Button variant={selectedView === 'table' ? 'default' : 'outline'} size="sm" onClick={() => setSelectedView('table')}>Table View</Button>
      </div>

      {/* Horizontal Bar Chart */}
      {selectedView === 'chart' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Deal IRR vs Benchmark Reference Points</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 140, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 'dataMax']} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 13 }} />
                  <RechartTooltip
                    formatter={(value: number) => [`${value.toFixed(2)}%`, 'Return']}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <ReferenceLine x={dealIRR} stroke="#10b981" strokeDasharray="5 5" strokeWidth={2} label={{ value: `Deal: ${dealIRR}%`, position: 'top', fill: '#10b981', fontSize: 12 }} />
                  <Bar dataKey="rate" radius={[0, 4, 4, 0]} barSize={28}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.fill}
                        fillOpacity={entry.isDeal ? 1 : 0.75}
                        stroke={entry.isDeal ? '#059669' : 'none'}
                        strokeWidth={entry.isDeal ? 2 : 0}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Spread Analysis Table */}
      {selectedView === 'table' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Spread Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Benchmark</TableHead>
                  <TableHead className="text-right">Benchmark Rate</TableHead>
                  <TableHead className="text-right">Deal IRR</TableHead>
                  <TableHead className="text-right">Spread</TableHead>
                  <TableHead className="text-center">Assessment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spreadAnalysis.map((row) => (
                  <TableRow key={row.benchmark}>
                    <TableCell className="font-medium">{row.benchmark}</TableCell>
                    <TableCell className="text-right">{row.benchmarkRate.toFixed(2)}%</TableCell>
                    <TableCell className="text-right">{row.dealIRR.toFixed(2)}%</TableCell>
                    <TableCell className={cn('text-right font-semibold', row.spread > 0 ? 'text-emerald-600' : 'text-red-600')}>
                      {row.spread > 0 ? '+' : ''}{row.spread.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={getAttractivenessVariant(row.attractiveness)}>
                        {row.attractiveness.charAt(0).toUpperCase() + row.attractiveness.slice(1)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Risk-Adjusted Return Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            Risk-Adjusted Return Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Sharpe Ratio</div>
              <div className="text-xl font-bold">{riskAdjusted.sharpeRatio.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">
                Excess return ({riskAdjusted.excessReturn.toFixed(1)}%) / Volatility ({riskAdjusted.volatility.toFixed(1)}%)
              </div>
              <Badge variant={riskAdjusted.sharpeRatio > 1.0 ? 'default' : 'secondary'}>
                {riskAdjusted.sharpeRatio > 1.5 ? 'Excellent' : riskAdjusted.sharpeRatio > 1.0 ? 'Good' : riskAdjusted.sharpeRatio > 0.5 ? 'Acceptable' : 'Below Average'}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Sortino Ratio</div>
              <div className="text-xl font-bold">{riskAdjusted.sortinoRatio.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">
                Penalizes only downside volatility
              </div>
              <Badge variant={riskAdjusted.sortinoRatio > 1.5 ? 'default' : 'secondary'}>
                {riskAdjusted.sortinoRatio > 2.0 ? 'Excellent' : riskAdjusted.sortinoRatio > 1.5 ? 'Good' : 'Moderate'}
              </Badge>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Treynor Ratio</div>
              <div className="text-xl font-bold">{riskAdjusted.treynorRatio.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">
                Excess return per unit of systematic risk
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Information Ratio</div>
              <div className="text-xl font-bold">{riskAdjusted.informationRatio.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">
                Active return vs tracking error
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Excess Return</div>
              <div className="text-xl font-bold text-emerald-600">+{riskAdjusted.excessReturn.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">
                Above risk-free rate
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Return Volatility</div>
              <div className="text-xl font-bold">{riskAdjusted.volatility.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground">
                Annualized standard deviation
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default BenchmarkOverlay;
