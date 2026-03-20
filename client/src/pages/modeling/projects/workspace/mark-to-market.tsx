import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import { apiRequest } from '@/lib/queryClient';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Home,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Percent,
  BarChart3,
  Calendar,
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';

interface MarkToMarketProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

interface MtmUnit {
  unitId: string;
  unitNumber: string;
  unitType: string;
  currentRent: number;
  marketRent: number;
  variance: number;
  variancePercent: number;
  status: 'below_market' | 'at_market' | 'above_market';
  tenantName: string | null;
  leaseExpiry: string | null;
  leaseMonthsRemaining: number | null;
  sqft: number | null;
}

interface MtmTypeBreakdown {
  unitType: string;
  unitCount: number;
  avgCurrentRent: number;
  avgMarketRent: number;
  totalCurrentRent: number;
  totalMarketRent: number;
  totalVariance: number;
  avgVariancePercent: number;
}

interface LeaseExpiryBucket {
  quarter: string;
  expiringUnits: number;
  captureOpportunity: number;
  avgVariancePercent: number;
}

interface MtmAnalysis {
  totalLossToLease: number;
  totalGainToLease: number;
  netMtmOpportunity: number;
  mtmAsPercentOfRevenue: number;
  stabilizedRevenueUplift: number;
  impliedCapRateImpact: number;
  totalCurrentRevenue: number;
  totalMarketRevenue: number;
  units: MtmUnit[];
  typeBreakdown: MtmTypeBreakdown[];
  leaseExpiryBuckets: LeaseExpiryBucket[];
  compositionData: { name: string; value: number; color: string }[];
}

const STATUS_CONFIG = {
  below_market: { label: 'Below Market', variant: 'destructive' as const, className: 'bg-red-100 text-red-800 hover:bg-red-100' },
  at_market: { label: 'At Market', variant: 'secondary' as const, className: 'bg-gray-100 text-gray-700 hover:bg-gray-100' },
  above_market: { label: 'Above Market', variant: 'default' as const, className: 'bg-green-100 text-green-800 hover:bg-green-100' },
};

const CHART_COLORS = {
  current: '#6366f1',
  market: '#22c55e',
  loss: '#ef4444',
  gain: '#22c55e',
  neutral: '#94a3b8',
  capture: '#f59e0b',
};

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color,
  loading,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: any;
  trend?: { direction: 'up' | 'down'; value: string };
  color?: string;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={cn('text-2xl font-bold', color)}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            {trend && (
              <div className={`flex items-center text-xs ${trend.direction === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                {trend.direction === 'up' ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                {trend.value}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryTab({ data }: { data: MtmAnalysis }) {
  const barChartData = useMemo(() => {
    return data.typeBreakdown.map((tb) => ({
      name: tb.unitType,
      currentRent: Math.round(tb.avgCurrentRent),
      marketRent: Math.round(tb.avgMarketRent),
    }));
  }, [data.typeBreakdown]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Current vs Market Rent by Unit Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={barChartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} angle={-25} textAnchor="end" height={60} />
                <YAxis tickFormatter={(v) => `$${v.toLocaleString()}`} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Legend />
                <Bar dataKey="currentRent" name="Current Rent" fill={CHART_COLORS.current} radius={[4, 4, 0, 0]} />
                <Bar dataKey="marketRent" name="Market Rent" fill={CHART_COLORS.market} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Percent className="h-5 w-5" />
              MTM Composition
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={data.compositionData}
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  innerRadius={60}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                >
                  {data.compositionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Revenue Bridge</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Current Annual Revenue</p>
              <p className="text-xl font-bold mt-1">{formatCurrency(data.totalCurrentRevenue)}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg text-center">
              <p className="text-sm text-red-700">Loss-to-Lease</p>
              <p className="text-xl font-bold text-red-600 mt-1">-{formatCurrency(data.totalLossToLease)}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg text-center">
              <p className="text-sm text-green-700">Gain-to-Lease</p>
              <p className="text-xl font-bold text-green-600 mt-1">+{formatCurrency(data.totalGainToLease)}</p>
            </div>
            <div className="p-4 bg-primary/5 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Stabilized Market Revenue</p>
              <p className="text-xl font-bold mt-1">{formatCurrency(data.totalMarketRevenue)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UnitDetailTab({ units }: { units: MtmUnit[] }) {
  const [sortField, setSortField] = useState<keyof MtmUnit>('variancePercent');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    return [...units].sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [units, sortField, sortDir]);

  const handleSort = (field: keyof MtmUnit) => {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortIndicator = (field: keyof MtmUnit) => {
    if (field !== sortField) return null;
    return sortDir === 'asc' ? ' \u2191' : ' \u2193';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Home className="h-5 w-5" />
          Unit-Level Mark-to-Market Detail
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-auto max-h-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('unitNumber')}>
                  Unit{sortIndicator('unitNumber')}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('unitType')}>
                  Type{sortIndicator('unitType')}
                </TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('currentRent')}>
                  Current Rent{sortIndicator('currentRent')}
                </TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('marketRent')}>
                  Market Rent{sortIndicator('marketRent')}
                </TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('variance')}>
                  Variance{sortIndicator('variance')}
                </TableHead>
                <TableHead className="text-right cursor-pointer select-none" onClick={() => handleSort('variancePercent')}>
                  Var %{sortIndicator('variancePercent')}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('status')}>
                  Status{sortIndicator('status')}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('leaseExpiry')}>
                  Lease Expiry{sortIndicator('leaseExpiry')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((unit) => {
                const statusCfg = STATUS_CONFIG[unit.status];
                return (
                  <TableRow key={unit.unitId}>
                    <TableCell className="font-medium">{unit.unitNumber}</TableCell>
                    <TableCell>{unit.unitType}</TableCell>
                    <TableCell className="text-muted-foreground">{unit.tenantName || '--'}</TableCell>
                    <TableCell className="text-right">{formatCurrency(unit.currentRent)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(unit.marketRent)}</TableCell>
                    <TableCell className={cn('text-right font-medium', unit.variance < 0 ? 'text-red-600' : unit.variance > 0 ? 'text-green-600' : '')}>
                      {unit.variance >= 0 ? '+' : ''}{formatCurrency(unit.variance)}
                    </TableCell>
                    <TableCell className={cn('text-right', unit.variancePercent < 0 ? 'text-red-600' : unit.variancePercent > 0 ? 'text-green-600' : '')}>
                      {unit.variancePercent >= 0 ? '+' : ''}{unit.variancePercent.toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      <Badge className={statusCfg.className}>{statusCfg.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {unit.leaseExpiry
                        ? new Date(unit.leaseExpiry).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                        : 'MTM'}
                    </TableCell>
                  </TableRow>
                );
              })}
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No unit data available.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          Showing {sorted.length} units. Variance = Market Rent - Current Rent. Positive = below market (opportunity).
        </div>
      </CardContent>
    </Card>
  );
}

function LeaseExpiryTab({ buckets }: { buckets: LeaseExpiryBucket[] }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Lease Expirations and Capture Opportunity by Quarter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={buckets} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="quarter" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number, name: string) =>
                  name === 'Expiring Units' ? value : formatCurrency(value)
                }
              />
              <Legend />
              <Bar yAxisId="right" dataKey="expiringUnits" name="Expiring Units" fill={CHART_COLORS.neutral} radius={[4, 4, 0, 0]} />
              <Bar yAxisId="left" dataKey="captureOpportunity" name="Capture Opportunity" radius={[4, 4, 0, 0]}>
                {buckets.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.captureOpportunity >= 0 ? CHART_COLORS.capture : CHART_COLORS.loss} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quarterly Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quarter</TableHead>
                  <TableHead className="text-right">Expiring Units</TableHead>
                  <TableHead className="text-right">Capture Opportunity</TableHead>
                  <TableHead className="text-right">Avg Variance %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buckets.map((bucket) => (
                  <TableRow key={bucket.quarter}>
                    <TableCell className="font-medium">{bucket.quarter}</TableCell>
                    <TableCell className="text-right">{bucket.expiringUnits}</TableCell>
                    <TableCell className={cn('text-right font-medium', bucket.captureOpportunity >= 0 ? 'text-green-600' : 'text-red-600')}>
                      {bucket.captureOpportunity >= 0 ? '+' : ''}{formatCurrency(bucket.captureOpportunity)}
                    </TableCell>
                    <TableCell className={cn('text-right', bucket.avgVariancePercent >= 0 ? 'text-green-600' : 'text-red-600')}>
                      {bucket.avgVariancePercent >= 0 ? '+' : ''}{bucket.avgVariancePercent.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
                {buckets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No lease expiry data available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ByTypeTab({ typeBreakdown }: { typeBreakdown: MtmTypeBreakdown[] }) {
  const sorted = useMemo(() => {
    return [...typeBreakdown].sort((a, b) => Math.abs(b.totalVariance) - Math.abs(a.totalVariance));
  }, [typeBreakdown]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Home className="h-5 w-5" />
          Mark-to-Market by Unit Type
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit Type</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">Avg Current</TableHead>
                <TableHead className="text-right">Avg Market</TableHead>
                <TableHead className="text-right">Total Current</TableHead>
                <TableHead className="text-right">Total Market</TableHead>
                <TableHead className="text-right">Total Variance</TableHead>
                <TableHead className="text-right">Avg Var %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((tb) => (
                <TableRow key={tb.unitType}>
                  <TableCell className="font-medium">{tb.unitType}</TableCell>
                  <TableCell className="text-right">{tb.unitCount}</TableCell>
                  <TableCell className="text-right">{formatCurrency(tb.avgCurrentRent)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(tb.avgMarketRent)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(tb.totalCurrentRent)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(tb.totalMarketRent)}</TableCell>
                  <TableCell className={cn('text-right font-medium', tb.totalVariance > 0 ? 'text-green-600' : tb.totalVariance < 0 ? 'text-red-600' : '')}>
                    {tb.totalVariance >= 0 ? '+' : ''}{formatCurrency(tb.totalVariance)}
                  </TableCell>
                  <TableCell className={cn('text-right', tb.avgVariancePercent > 0 ? 'text-green-600' : tb.avgVariancePercent < 0 ? 'text-red-600' : '')}>
                    {tb.avgVariancePercent >= 0 ? '+' : ''}{tb.avgVariancePercent.toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No unit type data available.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {sorted.length > 0 && (
          <div className="mt-6">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={sorted} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="unitType" tick={{ fontSize: 12 }} angle={-25} textAnchor="end" height={60} />
                <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="totalVariance" name="Total MTM Variance" radius={[4, 4, 0, 0]}>
                  {sorted.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.totalVariance >= 0 ? CHART_COLORS.gain : CHART_COLORS.loss}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MarkToMarket({ projectId, onTabChange }: MarkToMarketProps) {
  const [activeTab, setActiveTab] = useState('summary');

  const { data: analysis, isLoading, error } = useQuery<MtmAnalysis>({
    queryKey: ['mark-to-market', projectId],
    queryFn: async () => {
      const res = await apiRequest('POST', '/api/institutional-analysis/mark-to-market', {
        projectId,
      });
      return res.json();
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const handleExport = async () => {
    try {
      const res = await apiRequest('POST', '/api/institutional-analysis/mark-to-market/export', {
        projectId,
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mark-to-market-${projectId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <p className="text-lg font-semibold">Unable to Load Mark-to-Market Analysis</p>
            <p className="text-sm text-muted-foreground max-w-md">
              {error instanceof Error ? error.message : 'An unexpected error occurred while fetching mark-to-market data.'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Mark-to-Market Analysis</h2>
          <p className="text-muted-foreground">
            Institutional rent roll analysis comparing in-place rents to current market rates
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={isLoading || !analysis}>
          <Download className="h-4 w-4 mr-2" />
          Export to Excel
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          title="Loss-to-Lease"
          value={analysis ? formatCurrency(analysis.totalLossToLease) : '--'}
          subtitle="Below market units"
          icon={TrendingDown}
          color="text-red-600"
          loading={isLoading}
        />
        <MetricCard
          title="Gain-to-Lease"
          value={analysis ? formatCurrency(analysis.totalGainToLease) : '--'}
          subtitle="Above market units"
          icon={TrendingUp}
          color="text-green-600"
          loading={isLoading}
        />
        <MetricCard
          title="Net MTM Opportunity"
          value={analysis ? formatCurrency(analysis.netMtmOpportunity) : '--'}
          subtitle="Annual revenue delta"
          icon={DollarSign}
          color={analysis && analysis.netMtmOpportunity >= 0 ? 'text-green-600' : 'text-red-600'}
          loading={isLoading}
          trend={analysis ? {
            direction: analysis.netMtmOpportunity >= 0 ? 'up' : 'down',
            value: `${Math.abs(analysis.mtmAsPercentOfRevenue).toFixed(1)}% of rev`,
          } : undefined}
        />
        <MetricCard
          title="MTM % of Revenue"
          value={analysis ? `${analysis.mtmAsPercentOfRevenue.toFixed(1)}%` : '--'}
          subtitle="Relative to in-place"
          icon={Percent}
          loading={isLoading}
        />
        <MetricCard
          title="Stabilized Uplift"
          value={analysis ? formatCurrency(analysis.stabilizedRevenueUplift) : '--'}
          subtitle="At full mark-to-market"
          icon={ArrowUpRight}
          color="text-primary"
          loading={isLoading}
        />
        <MetricCard
          title="Cap Rate Impact"
          value={analysis ? `${analysis.impliedCapRateImpact > 0 ? '+' : ''}${analysis.impliedCapRateImpact.toFixed(0)} bps` : '--'}
          subtitle="Implied change"
          icon={BarChart3}
          loading={isLoading}
          trend={analysis ? {
            direction: analysis.impliedCapRateImpact >= 0 ? 'up' : 'down',
            value: `${Math.abs(analysis.impliedCapRateImpact).toFixed(0)} bps`,
          } : undefined}
        />
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="unit-detail">Unit Detail</TabsTrigger>
          <TabsTrigger value="lease-expiry">Lease Expiry</TabsTrigger>
          <TabsTrigger value="by-type">By Type</TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="mt-6 space-y-4">
            <Skeleton className="h-[400px] w-full" />
            <Skeleton className="h-[200px] w-full" />
          </div>
        ) : analysis ? (
          <>
            <TabsContent value="summary" className="mt-6">
              <SummaryTab data={analysis} />
            </TabsContent>
            <TabsContent value="unit-detail" className="mt-6">
              <UnitDetailTab units={analysis.units} />
            </TabsContent>
            <TabsContent value="lease-expiry" className="mt-6">
              <LeaseExpiryTab buckets={analysis.leaseExpiryBuckets} />
            </TabsContent>
            <TabsContent value="by-type" className="mt-6">
              <ByTypeTab typeBreakdown={analysis.typeBreakdown} />
            </TabsContent>
          </>
        ) : null}
      </Tabs>
    </div>
  );
}

export default MarkToMarket;
