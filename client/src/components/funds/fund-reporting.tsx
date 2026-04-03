/**
 * Fund Reporting Dashboard
 * PME (Public Market Equivalent), Return Attribution, J-Curve, Vintage Cohorts
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Target, BarChart3, Activity, ArrowUp, ArrowDown,
} from 'lucide-react';

// ── Formatting ──────────────────────────────────────────────────────────

function fmtCurrency(n: number | null | undefined): string {
  if (n == null) return '\u2014';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '\u2014';
  return `${(n * 100).toFixed(1)}%`;
}

function fmtMultiple(n: number | null | undefined): string {
  if (n == null) return '\u2014';
  return `${n.toFixed(2)}x`;
}

function fmtBps(n: number): string {
  return `${n > 0 ? '+' : ''}${n} bps`;
}

// ── PME Card ────────────────────────────────────────────────────────────

function PMECard({ fundId }: { fundId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['fund-pme', fundId],
    queryFn: () => fetch(`/api/fund-management/funds/${fundId}/pme`).then(r => r.json()),
    enabled: !!fundId,
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!data) return null;

  const outperformed = data.ksPme > 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Target className="h-4 w-4 text-teal-500" />
          Public Market Equivalent (vs {data.benchmarkIndex})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div>
            <div className={`text-2xl font-bold font-mono ${outperformed ? 'text-emerald-600' : 'text-red-500'}`}>
              {fmtMultiple(data.ksPme)}
            </div>
            <div className="text-xs text-gray-500">KS-PME</div>
            <Badge variant={outperformed ? 'default' : 'destructive'} className="mt-1 text-xs">
              {outperformed ? 'Outperformed' : 'Underperformed'}
            </Badge>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-gray-900">
              {fmtPct(data.directAlpha)}
            </div>
            <div className="text-xs text-gray-500">Direct Alpha</div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-gray-900">
              {fmtPct(data.fundIrr)}
            </div>
            <div className="text-xs text-gray-500">Fund Net IRR</div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-gray-900">
              {fmtPct(data.benchmarkReturn)}
            </div>
            <div className="text-xs text-gray-500">{data.benchmarkIndex} Ann. Return</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm border-t pt-3">
          <div className="flex justify-between">
            <span className="text-gray-500">Total Contributions</span>
            <span className="font-mono font-medium">{fmtCurrency(data.summary.totalContributions)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Total Distributions</span>
            <span className="font-mono font-medium">{fmtCurrency(data.summary.totalDistributions)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">FV Contributions (@ benchmark)</span>
            <span className="font-mono font-medium">{fmtCurrency(data.summary.fvContributions)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">FV Distributions + NAV</span>
            <span className="font-mono font-medium">{fmtCurrency(data.summary.fvDistributions + data.summary.nav)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Return Attribution Card ─────────────────────────────────────────────

function ReturnAttributionCard({ fundId }: { fundId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['fund-attribution', fundId],
    queryFn: () => fetch(`/api/fund-management/funds/${fundId}/attribution`).then(r => r.json()),
    enabled: !!fundId,
  });

  if (isLoading) return <Skeleton className="h-80 w-full" />;
  if (!data) return null;

  const chartData = data.allDeals
    .sort((a: any, b: any) => b.contributionToFundReturn - a.contributionToFundReturn)
    .slice(0, 10)
    .map((d: any) => ({
      name: d.projectName.length > 18 ? d.projectName.substring(0, 15) + '...' : d.projectName,
      contribution: d.contributionToFundReturn,
      multiple: d.multiple,
    }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-500" />
            Return Attribution
          </CardTitle>
          <div className="text-sm text-gray-500">
            Fund Multiple: <span className="font-bold text-gray-900">{fmtMultiple(data.fundMultiple)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 && (
          <div className="h-48 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `${v} bps`} />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${v} bps`, 'Contribution']} />
                <Bar
                  dataKey="contribution"
                  fill="#3B82F6"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-semibold text-emerald-600 mb-2 flex items-center gap-1">
              <ArrowUp className="h-3 w-3" /> Top 5 Contributors
            </div>
            <Table>
              <TableBody>
                {data.topDeals.slice(0, 5).map((d: any) => (
                  <TableRow key={d.allocationId} className="text-xs">
                    <TableCell className="py-1 font-medium">{d.projectName}</TableCell>
                    <TableCell className="py-1 text-right font-mono">{fmtMultiple(d.multiple)}</TableCell>
                    <TableCell className="py-1 text-right font-mono text-emerald-600">{fmtBps(d.contributionToFundReturn)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div>
            <div className="text-xs font-semibold text-red-500 mb-2 flex items-center gap-1">
              <ArrowDown className="h-3 w-3" /> Bottom 5 Detractors
            </div>
            <Table>
              <TableBody>
                {data.bottomDeals.slice(0, 5).map((d: any) => (
                  <TableRow key={d.allocationId} className="text-xs">
                    <TableCell className="py-1 font-medium">{d.projectName}</TableCell>
                    <TableCell className="py-1 text-right font-mono">{fmtMultiple(d.multiple)}</TableCell>
                    <TableCell className="py-1 text-right font-mono text-red-500">{fmtBps(d.contributionToFundReturn)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── J-Curve Card ────────────────────────────────────────────────────────

function JCurveCard({ fundId }: { fundId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['fund-jcurve', fundId],
    queryFn: () => fetch(`/api/fund-management/funds/${fundId}/j-curve`).then(r => r.json()),
    enabled: !!fundId,
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!data || data.dataPoints.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-purple-500" />
            J-Curve Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">No cash flow data available for J-curve analysis.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-purple-500" />
            J-Curve Analysis
          </CardTitle>
          <div className="flex gap-4 text-xs text-gray-500">
            {data.nadir && (
              <span>Nadir: <span className="font-mono text-red-500">{fmtCurrency(data.nadir.value)}</span> ({data.nadir.quarter})</span>
            )}
            {data.breakeven && (
              <span>Breakeven: <span className="font-mono text-emerald-600">{data.breakeven}</span></span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.dataPoints}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="quarter" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tickFormatter={(v) => fmtCurrency(v)} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(v: number, name: string) => [
                  fmtCurrency(v),
                  name === 'cumulativeCashFlow' ? 'Net Cash Flow' : name,
                ]}
              />
              <ReferenceLine y={0} stroke="#94A3B8" strokeDasharray="3 3" />
              <defs>
                <linearGradient id="jcurveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="cumulativeCashFlow"
                stroke="#8B5CF6"
                fill="url(#jcurveGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Vintage Cohort Card ─────────────────────────────────────────────────

function VintageCohortCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['vintage-cohorts'],
    queryFn: () => fetch('/api/fund-management/vintage-cohorts').then(r => r.json()),
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!data?.cohorts?.length) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Vintage Year Cohorts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">No vintage cohort data available yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Vintage Year Cohorts</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vintage</TableHead>
              <TableHead className="text-right">Funds</TableHead>
              <TableHead className="text-right">Committed</TableHead>
              <TableHead className="text-right">Avg TVPI</TableHead>
              <TableHead className="text-right">Avg Net IRR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.cohorts.map((c: any) => (
              <TableRow key={c.vintageYear}>
                <TableCell className="font-medium">{c.vintageYear}</TableCell>
                <TableCell className="text-right">{c.fundCount}</TableCell>
                <TableCell className="text-right font-mono">{fmtCurrency(c.totalCommitted)}</TableCell>
                <TableCell className="text-right font-mono">{fmtMultiple(c.avgTvpi)}</TableCell>
                <TableCell className="text-right font-mono">{fmtPct(c.avgNetIrr)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Main Export ──────────────────────────────────────────────────────────

export default function FundReporting({ fundId }: { fundId: string }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        <PMECard fundId={fundId} />
        <ReturnAttributionCard fundId={fundId} />
      </div>
      <div className="grid grid-cols-1 gap-6">
        <JCurveCard fundId={fundId} />
        <VintageCohortCard />
      </div>
    </div>
  );
}
