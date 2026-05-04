import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadialBarChart, RadialBar, ComposedChart,
} from 'recharts';
import {
  Building2, TrendingUp, DollarSign, Percent, MapPin, BarChart3,
  PieChartIcon, Landmark, Layers, AlertTriangle, ChevronDown, ChevronRight,
  ArrowUpRight, ArrowDownRight, Download, ExternalLink, Activity,
} from 'lucide-react';
import { Link } from 'wouter';
import SyncAllAssetsButton from '@/components/operations/SyncAllAssetsButton';
import { PortfolioFilterBar, PortfolioFilters, EMPTY_FILTERS } from '@/components/portfolio/PortfolioFilterBar';
import { AssetDetailDrawer } from '@/components/portfolio/AssetDetailDrawer';
import PortfolioReturns from './portfolio-returns';

// ─── Constants ───────────────────────────────────────────────────────────────

const AC_COLORS: Record<string, string> = {
  marina: '#3b82f6', str: '#8b5cf6', multifamily: '#10b981',
  self_storage: '#f59e0b', laundromat: '#06b6d4', car_wash: '#06b6d4',
  retail: '#ec4899', office: '#64748b', hotel: '#f97316',
  mixed_use: '#84cc16', other: '#94a3b8',
};

const AC_LABELS: Record<string, string> = {
  marina: 'Marina', str: 'STR', multifamily: 'Multifamily',
  self_storage: 'Self Storage', laundromat: 'Laundromat', car_wash: 'Car Wash',
  retail: 'Retail', office: 'Office', hotel: 'Hotel',
  mixed_use: 'Mixed Use', other: 'Other',
};

const PIE_PALETTE = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#06b6d4','#ec4899','#64748b','#f97316','#84cc16','#94a3b8'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtM(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${n < 0 ? '-' : ''}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${n < 0 ? '-' : ''}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${n < 0 ? '-' : ''}$${(abs / 1e3).toFixed(0)}K`;
  return `${n < 0 ? '-' : ''}$${abs.toLocaleString()}`;
}

function fmtPct(n: number, decimals = 2): string {
  return `${(n * 100).toFixed(decimals)}%`;
}

function fmtN(n: number): string {
  return n.toLocaleString();
}

function hhiLabel(hhi: number): { label: string; color: string } {
  if (hhi < 1500) return { label: 'Diversified', color: 'text-emerald-600' };
  if (hhi < 2500) return { label: 'Moderate', color: 'text-amber-600' };
  return { label: 'Concentrated', color: 'text-red-600' };
}

function ScoreGauge({ label, score, color }: { label: string; score: number; color: string }) {
  const data = [{ value: score }, { value: 100 - score }];
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-20 h-20">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%" cy="50%"
            innerRadius="65%" outerRadius="90%"
            data={[{ value: score, fill: color }]}
            startAngle={210} endAngle={-30}
          >
            <RadialBar dataKey="value" cornerRadius={4} background={{ fill: 'hsl(var(--muted))' }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold">{Math.round(score)}</span>
        </div>
      </div>
      <span className="text-[11px] font-medium text-center leading-tight text-muted-foreground">{label}</span>
    </div>
  );
}

function KpiCard({ title, value, sub, icon: Icon, trend, color }: {
  title: string; value: string; sub?: string; icon?: any;
  trend?: 'up' | 'down' | 'neutral'; color?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-2xl font-bold" style={color ? { color } : {}}>{value}</div>
        {sub && (
          <div className="flex items-center gap-1 mt-0.5">
            {trend === 'up' && <ArrowUpRight className="h-3 w-3 text-emerald-600" />}
            {trend === 'down' && <ArrowDownRight className="h-3 w-3 text-red-600" />}
            <span className="text-xs text-muted-foreground">{sub}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SkeletonGrid({ count = 4, h = 'h-[200px]' }: { count?: number; h?: string }) {
  return (
    <div className={`grid gap-4 md:grid-cols-2 ${count > 2 ? 'lg:grid-cols-4' : 'lg:grid-cols-2'}`}>
      {[...Array(count)].map((_, i) => (
        <Card key={i}><CardContent className={`${h} flex items-center justify-center`}><Skeleton className="h-full w-full" /></CardContent></Card>
      ))}
    </div>
  );
}

function EmptyState({ title, description, cta, ctaHref }: {
  title: string; description?: string; cta?: string; ctaHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
      <BarChart3 className="h-12 w-12 mb-3 opacity-30" />
      <p className="font-semibold text-sm text-foreground">{title}</p>
      {description && <p className="text-xs mt-1 max-w-xs">{description}</p>}
      {cta && ctaHref && (
        <Link href={ctaHref}>
          <Button size="sm" variant="outline" className="mt-3">{cta}</Button>
        </Link>
      )}
    </div>
  );
}

// ─── Tab 1: Overview ─────────────────────────────────────────────────────────

function OverviewTab() {
  const { data: summary, isLoading } = useQuery<any>({ queryKey: ['/api/portfolio/summary'] });

  const noiTrendData = useMemo(() =>
    (summary?.noiTrend || []).map((r: any) => ({
      month: r.month?.slice(5) || r.month,
      noi: Number(r.totalNoi || 0),
      aum: Number(r.totalAum || 0),
    })), [summary]);

  const byAssetClass = summary?.byAssetClass || [];

  if (isLoading) return <SkeletonGrid count={4} />;
  if (!summary) return <EmptyState title="No portfolio data" description="Create modeling projects to see portfolio analytics." cta="Go to Projects" ctaHref="/modeling/projects" />;

  return (
    <div className="space-y-6">
      {/* Hero KPIs */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard title="Total AUM" value={fmtM(summary.totalAum)} sub={`${summary.dealCount} deals`} icon={DollarSign} />
        <KpiCard title="Equity Deployed" value={fmtM(summary.totalEquity)} sub={`LTV: ${fmtPct(summary.avgLtv)}`} icon={Layers} />
        <KpiCard title="Total Debt" value={fmtM(summary.totalDebt)} icon={Landmark} />
        <KpiCard title="Aggregate NOI" value={fmtM(summary.aggregateNoi)} icon={TrendingUp} color="#10b981" />
        <KpiCard title="Avg Cap Rate" value={`${summary.avgCapRate?.toFixed(2)}%`} icon={Percent} />
        <KpiCard title="Avg Levered IRR" value={`${summary.avgLeveredIrr?.toFixed(1)}%`} icon={Activity} color="#8b5cf6" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Asset Class Composition */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Asset Class Mix</CardTitle>
            <CardDescription>By purchase price</CardDescription>
          </CardHeader>
          <CardContent>
            {byAssetClass.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs">No data</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={byAssetClass} dataKey="totalValue" nameKey="assetClass" cx="50%" cy="50%" outerRadius={75} innerRadius={40}>
                      {byAssetClass.map((entry: any, i: number) => (
                        <Cell key={i} fill={AC_COLORS[entry.assetClass] || PIE_PALETTE[i % PIE_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmtM(v)} labelFormatter={(l) => AC_LABELS[l] || l} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {byAssetClass.slice(0, 5).map((ac: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: AC_COLORS[ac.assetClass] || PIE_PALETTE[i] }} />
                        <span>{AC_LABELS[ac.assetClass] || ac.assetClass}</span>
                      </div>
                      <span className="font-medium font-mono">{fmtM(ac.totalValue)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* NOI & AUM Trend (Trailing 12M) */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Trailing 12-Month Activity</CardTitle>
            <CardDescription>NOI and AUM added per month</CardDescription>
          </CardHeader>
          <CardContent>
            {noiTrendData.every((d: any) => d.noi === 0 && d.aum === 0) ? (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-xs">No activity in trailing 12 months</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={noiTrendData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" fontSize={10} />
                  <YAxis yAxisId="left" fontSize={10} tickFormatter={fmtM} width={55} />
                  <YAxis yAxisId="right" orientation="right" fontSize={10} tickFormatter={fmtM} width={55} />
                  <Tooltip formatter={(v: number) => fmtM(v)} />
                  <Legend fontSize={11} />
                  <Bar yAxisId="left" dataKey="noi" name="NOI" fill="#10b981" fillOpacity={0.85} radius={[2, 2, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="aum" name="AUM" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Deal Status & Asset Class NOI */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Deal Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: 'Active', count: summary.activeCount, pct: summary.dealCount > 0 ? summary.activeCount / summary.dealCount : 0, color: '#10b981' },
                { label: 'Closed / Won', count: summary.closedCount, pct: summary.dealCount > 0 ? summary.closedCount / summary.dealCount : 0, color: '#3b82f6' },
                { label: 'Pipeline', count: summary.dealCount - summary.activeCount - summary.closedCount, pct: summary.dealCount > 0 ? (summary.dealCount - summary.activeCount - summary.closedCount) / summary.dealCount : 0, color: '#94a3b8' },
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="font-medium">{row.label}</span>
                    <span className="font-mono">{row.count} deals ({(row.pct * 100).toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, row.pct * 100)}%`, backgroundColor: row.color }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">NOI by Asset Class</CardTitle>
          </CardHeader>
          <CardContent>
            {byAssetClass.length === 0 ? (
              <div className="h-[140px] flex items-center justify-center text-muted-foreground text-xs">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={byAssetClass} layout="vertical">
                  <XAxis type="number" fontSize={10} tickFormatter={fmtM} />
                  <YAxis type="category" dataKey="assetClass" fontSize={10} width={72} tickFormatter={(v) => AC_LABELS[v] || v} />
                  <Tooltip formatter={(v: number) => fmtM(v)} labelFormatter={(l) => AC_LABELS[l] || l} />
                  <Bar dataKey="totalNoi" name="Total NOI" radius={[0, 3, 3, 0]}>
                    {byAssetClass.map((entry: any, i: number) => (
                      <Cell key={i} fill={AC_COLORS[entry.assetClass] || PIE_PALETTE[i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Tab 2: By Asset Class ───────────────────────────────────────────────────

function AssetClassPanel({ acKey, data, onOpenAsset }: {
  acKey: string; data: { count: number; totalValue: number; assets: any[] };
  onOpenAsset: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 rounded-lg border bg-card transition-colors">
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: AC_COLORS[acKey] || '#94a3b8' }} />
            <span className="font-semibold text-sm">{AC_LABELS[acKey] || acKey}</span>
            <Badge variant="secondary" className="text-xs h-5 px-1.5">{data.count} assets</Badge>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Value</p>
              <p className="font-semibold text-sm font-mono">{fmtM(data.totalValue)}</p>
            </div>
            <div className="text-right hidden md:block">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Cap Rate</p>
              <p className="font-semibold text-sm">
                {data.assets.length > 0
                  ? fmtPct(data.assets.filter((a) => a.capRate).reduce((s: number, a: any) => s + Number(a.capRate || 0), 0) / (data.assets.filter((a) => a.capRate).length || 1) / 100)
                  : '—'}
              </p>
            </div>
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 mb-3 border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Asset Name</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Value</TableHead>
                <TableHead className="text-xs text-right">Cap Rate</TableHead>
                <TableHead className="text-xs w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.assets.map((asset: any) => (
                <TableRow key={asset.id} className="text-xs cursor-pointer hover:bg-muted/50"
                  onClick={() => onOpenAsset(asset.id)}>
                  <TableCell className="py-2 font-medium">{asset.name}</TableCell>
                  <TableCell className="py-2">
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize">
                      {(asset.status || 'active').replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2 text-right font-mono">{fmtM(Number(asset.value || 0))}</TableCell>
                  <TableCell className="py-2 text-right">{asset.capRate ? fmtPct(Number(asset.capRate) / 100) : '—'}</TableCell>
                  <TableCell className="py-2">
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function AssetClassTab({ onOpenAsset }: { onOpenAsset: (id: string) => void }) {
  const { data, isLoading } = useQuery<any>({ queryKey: ['/api/portfolio/asset-class-breakdown'] });

  if (isLoading) return <SkeletonGrid count={2} h="h-16" />;

  const byAssetClass: Record<string, any> = data?.byAssetClass || {};
  const entries = Object.entries(byAssetClass).sort((a, b) => b[1].totalValue - a[1].totalValue);

  if (entries.length === 0) {
    return <EmptyState title="No assets yet" description="Create modeling projects with asset classes to see them grouped here." cta="Go to Projects" ctaHref="/modeling/projects" />;
  }

  return (
    <div className="space-y-2">
      {entries.map(([acKey, acData]) => (
        <AssetClassPanel key={acKey} acKey={acKey} data={acData} onOpenAsset={onOpenAsset} />
      ))}
    </div>
  );
}

// ─── Tab 4: Individual Assets ────────────────────────────────────────────────

type SortKey = 'name' | 'value' | 'noi' | 'capRate' | 'status';

function IndividualAssetsTab({
  filters, onOpenAsset,
}: { filters: PortfolioFilters; onOpenAsset: (id: string) => void }) {
  const { data: rawData, isLoading } = useQuery<any[]>({ queryKey: ['/api/portfolio/projects'] });
  const [sortKey, setSortKey] = useState<SortKey>('value');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');

  const data = useMemo(() => {
    let rows = rawData || [];

    if (filters.assetClasses.length) rows = rows.filter((r: any) => filters.assetClasses.includes(r.assetClass || 'marina'));
    if (filters.statuses.length) rows = rows.filter((r: any) => filters.statuses.includes(r.status || 'active'));
    if (filters.states.length) rows = rows.filter((r: any) => filters.states.includes(r.state));
    if (filters.regions.length) rows = rows.filter((r: any) => filters.regions.includes(r.region));
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r: any) => (r.marinaName || r.name || '').toLowerCase().includes(q));
    }

    return [...rows].sort((a: any, b: any) => {
      const getVal = (r: any) => {
        if (sortKey === 'name') return (r.marinaName || r.name || '').toLowerCase();
        if (sortKey === 'value') return Number(r.estimatedValue || r.purchasePrice || 0);
        if (sortKey === 'noi') return Number(r.noi || r.ebitda || 0);
        if (sortKey === 'capRate') return Number(r.capRate || r.year1CapRate || 0);
        if (sortKey === 'status') return (r.status || r.dealOutcome || '');
        return 0;
      };
      const av = getVal(a), bv = getVal(b);
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
  }, [rawData, filters, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortHead = ({ col, label }: { col: SortKey; label: string }) => (
    <TableHead className="text-xs cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort(col)}>
      <div className="flex items-center gap-0.5">
        {label}
        {sortKey === col && (sortDir === 'asc' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />)}
      </div>
    </TableHead>
  );

  if (isLoading) return <SkeletonGrid count={1} h="h-[400px]" />;

  const statusColor: Record<string, string> = {
    active: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300',
    won: 'text-emerald-700 bg-emerald-50',
    under_contract: 'text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300',
    pipeline: 'text-blue-700 bg-blue-50 dark:bg-blue-950 dark:text-blue-300',
    disposed: 'text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Search assets…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm px-3 rounded-md border bg-background w-48 focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <span className="text-xs text-muted-foreground">{data.length} asset{data.length !== 1 ? 's' : ''}</span>
      </div>

      {data.length === 0 ? (
        <EmptyState title="No assets match filters" description="Adjust your filters or create modeling projects." />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead col="name" label="Asset" />
                  <TableHead className="text-xs">Class</TableHead>
                  <TableHead className="text-xs">Location</TableHead>
                  <SortHead col="status" label="Status" />
                  <SortHead col="value" label="Value" />
                  <SortHead col="noi" label="NOI" />
                  <SortHead col="capRate" label="Cap Rate" />
                  <TableHead className="text-xs w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row: any) => {
                  const status = row.status || row.dealOutcome || 'active';
                  const assetClass = row.assetClass || 'marina';
                  return (
                    <TableRow key={row.id} className="cursor-pointer hover:bg-muted/50 text-xs"
                      onClick={() => onOpenAsset(row.id)}>
                      <TableCell className="py-2.5 font-medium max-w-[160px] truncate">{row.marinaName || row.name}</TableCell>
                      <TableCell className="py-2.5">
                        <span className="inline-flex items-center gap-1">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: AC_COLORS[assetClass] || '#94a3b8' }} />
                          {AC_LABELS[assetClass] || assetClass}
                        </span>
                      </TableCell>
                      <TableCell className="py-2.5 text-muted-foreground">
                        {[row.state, row.region].filter(Boolean).join(', ') || '—'}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Badge variant="outline" className={`text-[10px] h-4 px-1.5 border-0 ${statusColor[status] || statusColor.active}`}>
                          {status.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5 text-right font-mono">{fmtM(Number(row.estimatedValue || row.purchasePrice || 0))}</TableCell>
                      <TableCell className="py-2.5 text-right font-mono">{fmtM(Number(row.noi || row.ebitda || 0))}</TableCell>
                      <TableCell className="py-2.5 text-right">{row.capRate ? fmtPct(Number(row.capRate || row.year1CapRate || 0) / 100) : '—'}</TableCell>
                      <TableCell className="py-2.5 text-center">
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Tab 5: Capital & Debt ───────────────────────────────────────────────────

function CapitalDebtTab() {
  const { data, isLoading } = useQuery<any>({ queryKey: ['/api/portfolio/debt-maturity-wall'] });
  const { data: summary } = useQuery<any>({ queryKey: ['/api/portfolio/summary'] });

  if (isLoading) return <SkeletonGrid count={2} h="h-[300px]" />;

  const maturityWall = data?.maturityWall || [];
  const chartData = data?.chartData || [];
  const assetClasses = data?.assetClasses || [];

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <KpiCard title="Total Debt" value={fmtM(summary?.totalDebt || 0)} icon={Landmark} />
        <KpiCard title="Total Equity" value={fmtM(summary?.totalEquity || 0)} icon={DollarSign} />
        <KpiCard title="Avg LTV" value={fmtPct(summary?.avgLtv || 0)} icon={Percent} />
        <KpiCard title="Avg DSCR" value={summary?.avgDscr ? `${summary.avgDscr.toFixed(2)}x` : '—'} icon={Activity} />
      </div>

      {/* Debt Maturity Wall */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Debt Maturity Wall</CardTitle>
          <CardDescription>Loan maturities by year — total: {fmtM(data?.totalDebt || 0)}</CardDescription>
        </CardHeader>
        <CardContent>
          {maturityWall.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
              No debt data. Build capital stacks in project workspaces.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="year" fontSize={10} />
                <YAxis fontSize={10} tickFormatter={fmtM} width={58} />
                <Tooltip formatter={(v: number) => fmtM(v)} />
                <Legend fontSize={11} />
                {assetClasses.map((ac: string) => (
                  <Bar key={ac} dataKey={ac} name={AC_LABELS[ac] || ac} stackId="a"
                    fill={AC_COLORS[ac] || '#94a3b8'} radius={ac === assetClasses[assetClasses.length - 1] ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                ))}
                {assetClasses.length === 0 && (
                  <Bar dataKey="total" name="Total" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Loan-level Table */}
      {maturityWall.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Loan-Level Detail</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Asset</TableHead>
                  <TableHead className="text-xs">Lender</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs text-right">Balance</TableHead>
                  <TableHead className="text-xs text-right">Rate</TableHead>
                  <TableHead className="text-xs text-right">Maturity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maturityWall.flatMap((y: any) =>
                  y.tranches.map((t: any, ti: number) => (
                    <TableRow key={`${y.year}-${ti}`} className="text-xs">
                      <TableCell className="py-2 font-medium">{t.assetName}</TableCell>
                      <TableCell className="py-2 text-muted-foreground">{t.lender}</TableCell>
                      <TableCell className="py-2">
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                          {t.rateType === 'floating' ? '🔄 Float' : 'Fixed'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono">{fmtM(t.balance)}</TableCell>
                      <TableCell className="py-2 text-right font-mono">{fmtPct(Number(t.interestRate || 0))}</TableCell>
                      <TableCell className="py-2 text-right">
                        <span className={`font-medium ${t.maturityYear <= new Date().getFullYear() + 1 ? 'text-red-600' : t.maturityYear <= new Date().getFullYear() + 2 ? 'text-amber-600' : ''}`}>
                          {t.maturityYear}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Tab 6: Analytics ────────────────────────────────────────────────────────

const BENCHMARK_DATA = [
  { category: 'Cap Rate', portfolio: 0, marina: 6.5, national: 6.2 },
  { category: 'IRR', portfolio: 0, marina: 14.2, national: 12.8 },
  { category: 'Occupancy', portfolio: 0, marina: 88, national: 85 },
  { category: 'LTV', portfolio: 0, marina: 60, national: 65 },
];

function AnalyticsTab() {
  const { data: riskData, isLoading: riskLoading } = useQuery<any>({ queryKey: ['/api/portfolio/concentration-risk'] });
  const { data: scorecardData, isLoading: scorecardLoading } = useQuery<any>({ queryKey: ['/api/portfolio/scorecard'] });
  const { data: summary } = useQuery<any>({ queryKey: ['/api/portfolio/summary'] });

  const benchmarkData = useMemo(() => {
    if (!summary) return BENCHMARK_DATA;
    return BENCHMARK_DATA.map((b) => ({
      ...b,
      portfolio: b.category === 'Cap Rate' ? Number(summary.avgCapRate || 0)
        : b.category === 'IRR' ? Number(summary.avgLeveredIrr || 0)
        : b.category === 'LTV' ? Number((summary.avgLtv || 0) * 100)
        : 0,
    }));
  }, [summary]);

  const isLoading = riskLoading || scorecardLoading;

  if (isLoading) return <SkeletonGrid count={3} h="h-[240px]" />;

  const scores = scorecardData?.scores || {};
  const hhiAC = riskData?.hhiAssetClass || 0;
  const hhiGeo = riskData?.hhiGeography || 0;
  const hhiVintage = riskData?.hhiVintage || 0;

  const SCORE_DEFS = [
    { key: 'incomeQuality', label: 'Income Quality', color: '#10b981' },
    { key: 'returnPerformance', label: 'Return Performance', color: '#3b82f6' },
    { key: 'leverageSafety', label: 'Leverage Safety', color: '#8b5cf6' },
    { key: 'diversification', label: 'Diversification', color: '#f59e0b' },
    { key: 'growthTrajectory', label: 'Growth Trajectory', color: '#ec4899' },
  ];

  return (
    <div className="space-y-6">
      {/* Scorecard Gauges */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Portfolio Health Scorecard</CardTitle>
          <CardDescription>Five-factor assessment of portfolio quality (0–100)</CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(scores).length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Insufficient data to compute scores. Add more projects with capital stacks.</div>
          ) : (
            <div className="flex flex-wrap justify-around gap-6">
              {SCORE_DEFS.map((s) => (
                <ScoreGauge key={s.key} label={s.label} score={scores[s.key] || 0} color={s.color} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Concentration Risk */}
      <div className="grid gap-4 lg:grid-cols-3">
        {[
          { title: 'Asset Class', hhi: hhiAC, data: riskData?.byAssetClass || [], nameKey: 'name' },
          { title: 'Geography (State)', hhi: hhiGeo, data: riskData?.byGeography || [], nameKey: 'name' },
          { title: 'Vintage Year', hhi: hhiVintage, data: riskData?.byVintage || [], nameKey: 'name' },
        ].map(({ title, hhi, data, nameKey }) => {
          const { label, color } = hhiLabel(hhi);
          return (
            <Card key={title}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{title}</CardTitle>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">HHI</p>
                    <p className={`text-xs font-bold ${color}`}>{hhi.toLocaleString()} · {label}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {data.length === 0 ? (
                  <div className="h-[160px] flex items-center justify-center text-muted-foreground text-xs">No data</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={140}>
                      <PieChart>
                        <Pie data={data} dataKey="value" nameKey={nameKey} cx="50%" cy="50%" outerRadius={60} innerRadius={30}>
                          {data.map((_: any, i: number) => (
                            <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmtM(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1 mt-1">
                      {data.slice(0, 4).map((d: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_PALETTE[i % PIE_PALETTE.length] }} />
                            <span className="truncate max-w-[90px]">{d.name}</span>
                          </div>
                          <span className="font-mono">{(d.pct * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                      {data.length > 4 && <p className="text-[10px] text-muted-foreground">+ {data.length - 4} more</p>}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Benchmark Comparison */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Benchmark Comparison</CardTitle>
          <CardDescription>Portfolio vs. marina sector vs. national CRE averages</CardDescription>
        </CardHeader>
        <CardContent>
          {!summary ? (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={benchmarkData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="category" fontSize={10} />
                <YAxis fontSize={10} tickFormatter={(v) => `${v.toFixed(1)}`} width={36} />
                <Tooltip />
                <Legend fontSize={11} />
                <Bar dataKey="portfolio" name="Your Portfolio" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="marina" name="Marina Sector" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="national" name="National CRE" fill="#94a3b8" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* HHI Interpretation Guide */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Concentration Risk Guide (HHI)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-xs">
            {[
              { range: '< 1,500', label: 'Diversified', desc: 'Low concentration. Portfolio is well-spread across multiple positions.', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950' },
              { range: '1,500–2,500', label: 'Moderate', desc: 'Some concentration risk. Monitor largest positions for volatility.', color: 'text-amber-600 bg-amber-50 dark:bg-amber-950' },
              { range: '> 2,500', label: 'Concentrated', desc: 'High concentration. Single-point failures could have significant impact.', color: 'text-red-600 bg-red-50 dark:bg-red-950' },
            ].map((row) => (
              <div key={row.label} className={`rounded-lg p-3 ${row.color}`}>
                <p className="font-bold text-sm">{row.range}</p>
                <p className="font-semibold mt-0.5">{row.label}</p>
                <p className="mt-1 opacity-80 leading-snug">{row.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PortfolioAnalytics() {
  const [activeTab, setActiveTab] = useState('overview');
  const [filters, setFilters] = useState<PortfolioFilters>(EMPTY_FILTERS);
  const [drawerProjectId, setDrawerProjectId] = useState<string | null>(null);

  const { data: projectsData } = useQuery<any[]>({ queryKey: ['/api/portfolio/projects'] });
  const assetCount = projectsData?.length;

  const tabs = [
    { value: 'overview', label: 'Overview', icon: BarChart3 },
    { value: 'by-asset-class', label: 'By Asset Class', icon: Layers },
    { value: 'returns', label: 'Returns', icon: TrendingUp },
    { value: 'individual', label: 'Individual Assets', icon: Building2 },
    { value: 'capital', label: 'Capital & Debt', icon: Landmark },
    { value: 'analytics', label: 'Analytics', icon: PieChartIcon },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4 min-h-screen">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Portfolio Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Institutional-grade analytics across all modeled assets</p>
        </div>
        <div className="flex items-center gap-2">
          <SyncAllAssetsButton />
          <Link href="/modeling/projects">
            <Button variant="outline" size="sm">
              <Building2 className="h-3.5 w-3.5 mr-1.5" /> Projects
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => window.open('/api/portfolio/export', '_blank')}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export
          </Button>
        </div>
      </div>

      {/* Global Filter Bar */}
      <PortfolioFilterBar filters={filters} onChange={setFilters} assetCount={assetCount} />

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-9 flex-wrap">
          {tabs.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="text-xs gap-1.5 h-7">
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{label.split(' ')[0]}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <OverviewTab />
        </TabsContent>

        <TabsContent value="by-asset-class" className="mt-0">
          <AssetClassTab onOpenAsset={setDrawerProjectId} />
        </TabsContent>

        <TabsContent value="returns" className="mt-0">
          <PortfolioReturns />
        </TabsContent>

        <TabsContent value="individual" className="mt-0">
          <IndividualAssetsTab filters={filters} onOpenAsset={setDrawerProjectId} />
        </TabsContent>

        <TabsContent value="capital" className="mt-0">
          <CapitalDebtTab />
        </TabsContent>

        <TabsContent value="analytics" className="mt-0">
          <AnalyticsTab />
        </TabsContent>
      </Tabs>

      {/* Asset Detail Drawer */}
      <AssetDetailDrawer
        projectId={drawerProjectId}
        onClose={() => setDrawerProjectId(null)}
      />
    </div>
  );
}
