// PropertyRecordTabs.tsx — Sales Comps, Rate Comps, Market Intel, Activities, Leases tabs

import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  MapPin, DollarSign, TrendingUp, Activity, Clock, ExternalLink,
  ChevronRight, Phone, Mail, Calendar, FileText, BarChart3,
  Newspaper, CheckCircle2, Circle, AlertCircle, MessageSquare,
  Anchor, Building2, ArrowUpRight, Scale, Home, Building, Users,
  RefreshCw, Tag, Layers, Plus, Pencil, X, Save, Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, LineChart, Line, ReferenceLine,
} from 'recharts';

function fmtCurrency(v: string | number | null): string {
  if (!v) return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  try { return format(new Date(d), 'MM/dd/yyyy'); } catch { return '—'; }
}
function fmtLabel(str: string): string {
  return str.split(/[_-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
function EmptyState({ icon: Icon, title, subtitle, action }: { icon: any; title: string; subtitle?: string; action?: { label: string; href: string } }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-gray-100 p-4 mb-4"><Icon className="h-8 w-8 text-gray-400" /></div>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1 max-w-xs">{subtitle}</p>}
      {action && (
        <a href={action.href}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors">
          {action.label} →
        </a>
      )}
    </div>
  );
}

// ── Sales Comps Tab ───────────────────────────────────────────────────
export function PropertySalesCompsTab({ state, city, propertyType }: { state?: string | null; city?: string | null; propertyType?: string }) {
  const [scope, setScope] = useState<'org' | 'all'>('all');
  const { data, isLoading } = useQuery<{ comps: any[]; total: number }>({
    queryKey: ['sales-comps-property', state, city, scope],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: '25', includeGlobal: 'true', scope });
      if (state) params.set('state', state);
      if (city) params.set('city', city);
      const res = await apiRequest('GET', `/api/sales-comps?${params}`);
      return res.json();
    },
  });

  const comps = data?.comps || [];

  // Build chart data — sale price by year
  const priceByYear = comps
    .filter(c => c.saleYear && c.salePrice)
    .reduce((acc: any, c: any) => {
      const yr = c.saleYear;
      if (!acc[yr]) acc[yr] = { year: yr, prices: [], count: 0 };
      acc[yr].prices.push(parseFloat(c.salePrice));
      acc[yr].count++;
      return acc;
    }, {});
  const chartData = Object.values(priceByYear)
    .map((d: any) => ({ year: d.year, avgPrice: d.prices.reduce((a: number, b: number) => a + b, 0) / d.prices.length, count: d.count }))
    .sort((a: any, b: any) => a.year - b.year);

  // Stats
  const prices = comps.filter(c => c.salePrice).map(c => parseFloat(c.salePrice));
  const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const capRates = comps.filter(c => c.capRate).map(c => parseFloat(c.capRate));
  const avgCapRate = capRates.length ? capRates.reduce((a, b) => a + b, 0) / capRates.length : 0;

  return (
    <div className="space-y-4">
      {/* Scope toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['all', 'org'] as const).map(s => (
            <button key={s} onClick={() => setScope(s)}
              className={cn('text-xs px-3 py-1.5 rounded-full border transition-colors',
                scope === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50')}>
              {s === 'all' ? 'All (incl. Global)' : 'Your Comps'}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400">{comps.length} comps{state ? ` in ${state}` : ''}</span>
      </div>

      {/* Summary KPIs */}
      {comps.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl bg-blue-50 p-3 text-center">
            <p className="text-xs text-blue-400 mb-0.5">Avg Sale Price</p>
            <p className="text-lg font-bold text-blue-700">{fmtCurrency(avgPrice)}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3 text-center">
            <p className="text-xs text-emerald-400 mb-0.5">Avg Cap Rate</p>
            <p className="text-lg font-bold text-emerald-700">{avgCapRate ? `${avgCapRate.toFixed(2)}%` : '—'}</p>
          </div>
          <div className="rounded-xl bg-purple-50 p-3 text-center">
            <p className="text-xs text-purple-400 mb-0.5">Total Comps</p>
            <p className="text-lg font-bold text-purple-700">{comps.length}</p>
          </div>
        </div>
      )}

      {/* Price trend chart */}
      {chartData.length > 1 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm">Sale Price Trend by Year</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={chartData} barSize={28}>
                <XAxis dataKey="year" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip formatter={(v: number) => fmtCurrency(v)} labelFormatter={(l) => `Year: ${l}`} />
                <Bar dataKey="avgPrice" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Avg Price" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Card key={i}><CardContent className="p-3"><Skeleton className="h-14 w-full" /></CardContent></Card>)}
        </div>
      )}
      {!isLoading && !comps.length && (
        <EmptyState icon={Scale}
        title="No sales comps yet"
        subtitle={state ? `No comparable sales found in ${state}. Import your comp set to populate this view.` : 'Import or manually add sales comps to populate this view.'}
        action={{ label: 'Import Sales Comps', href: '/analysis/sales-comps/upload' }}
      />
      )}

      {/* Comp list */}
      <div className="space-y-2">
        {comps.map((comp: any, i: number) => (
          <Card key={comp.id || i} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {comp.marina || comp.propertyName || comp.name || 'Comp'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {[comp.city, comp.state].filter(Boolean).join(', ')}
                    {comp.saleMonth && comp.saleYear ? ` · ${comp.saleMonth}/${comp.saleYear}` : comp.saleYear ? ` · ${comp.saleYear}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {comp.salePrice && <p className="text-sm font-bold text-gray-800">{fmtCurrency(comp.salePrice)}</p>}
                  {comp.capRate && <p className="text-xs text-emerald-600">{parseFloat(comp.capRate).toFixed(2)}% cap</p>}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
                {comp.wetSlips && <span><Anchor className="h-3 w-3 inline mr-0.5" />{comp.wetSlips} wet</span>}
                {comp.totalSlips && <span>{comp.totalSlips} total slips</span>}
                {comp.pricePerSlip && <span>${parseFloat(comp.pricePerSlip).toLocaleString()}/slip</span>}
                {comp._source && <Badge variant="outline" className="text-[9px] ml-auto capitalize">{comp._source}</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Rate Comps Tab ────────────────────────────────────────────────────
export function PropertyRateCompsTab({ state, city }: { state?: string | null; city?: string | null }) {
  const [scope, setScope] = useState<'org' | 'all'>('all');
  const { data, isLoading } = useQuery<{ comps: any[]; total: number }>({
    queryKey: ['rate-comps-property', state, city, scope],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: '30', includeGlobal: 'true', scope });
      if (state) params.set('state', state);
      if (city) params.set('city', city);
      const res = await apiRequest('GET', `/api/rate-comps?${params}`);
      return res.json();
    },
  });

  const comps = data?.comps || [];

  // Rate statistics
  const wetRates = comps.filter(c => c.wetSlipRateAvg || c.landRate).map(c => parseFloat(c.wetSlipRateAvg || c.landRate || '0')).filter(Boolean);
  const dryRates = comps.filter(c => c.drySlipRateAvg || c.wetRate).map(c => parseFloat(c.drySlipRateAvg || c.wetRate || '0')).filter(Boolean);
  const avgWet = wetRates.length ? wetRates.reduce((a, b) => a + b, 0) / wetRates.length : 0;
  const avgDry = dryRates.length ? dryRates.reduce((a, b) => a + b, 0) / dryRates.length : 0;

  // Chart data: rates by state
  const rateByState = comps.reduce((acc: any, c: any) => {
    const st = c.state || 'Unknown';
    const rate = parseFloat(c.wetSlipRateAvg || c.landRate || '0');
    if (!acc[st] && rate) acc[st] = { state: st, rates: [] };
    if (acc[st] && rate) acc[st].rates.push(rate);
    return acc;
  }, {});
  const rateChartData = Object.values(rateByState)
    .map((d: any) => ({ state: d.state, avg: d.rates.reduce((a: number, b: number) => a + b, 0) / d.rates.length }))
    .sort((a: any, b: any) => b.avg - a.avg)
    .slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['all', 'org'] as const).map(s => (
            <button key={s} onClick={() => setScope(s)}
              className={cn('text-xs px-3 py-1.5 rounded-full border transition-colors',
                scope === s ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50')}>
              {s === 'all' ? 'All (incl. Global)' : 'Your Comps'}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400">{comps.length} rate comps{state ? ` in ${state}` : ''}</span>
      </div>

      {comps.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl bg-emerald-50 p-3 text-center">
            <p className="text-xs text-emerald-400 mb-0.5">Avg Wet Rate</p>
            <p className="text-lg font-bold text-emerald-700">{avgWet ? `$${avgWet.toFixed(0)}/mo` : '—'}</p>
          </div>
          <div className="rounded-xl bg-blue-50 p-3 text-center">
            <p className="text-xs text-blue-400 mb-0.5">Avg Dry Rate</p>
            <p className="text-lg font-bold text-blue-700">{avgDry ? `$${avgDry.toFixed(0)}/mo` : '—'}</p>
          </div>
          <div className="rounded-xl bg-purple-50 p-3 text-center">
            <p className="text-xs text-purple-400 mb-0.5">Total Comps</p>
            <p className="text-lg font-bold text-purple-700">{comps.length}</p>
          </div>
        </div>
      )}

      {rateChartData.length > 1 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm">Avg Wet Rate by State</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={rateChartData} barSize={22} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={(v: number) => `$${v}`} />
                <YAxis dataKey="state" type="category" tick={{ fontSize: 10 }} width={25} />
                <Tooltip formatter={(v: number) => `$${v.toFixed(0)}/mo`} />
                <Bar dataKey="avg" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Card key={i}><CardContent className="p-3"><Skeleton className="h-14 w-full" /></CardContent></Card>)}
        </div>
      )}
      {!isLoading && !comps.length && (
        <EmptyState icon={BarChart3}
        title="No rate comps yet"
        subtitle="Import or manually add rate comps to see market rate benchmarks for this area."
        action={{ label: 'Import Rate Comps', href: '/analysis/rate-comps' }}
      />
      )}

      <div className="space-y-2">
        {comps.map((comp: any, i: number) => (
          <Card key={comp.id || i} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {comp.marina || comp.propertyName || comp.name || 'Rate Comp'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {[comp.city, comp.state].filter(Boolean).join(', ')}
                  </p>
                </div>
                <div className="text-right shrink-0 space-y-0.5">
                  {(comp.wetSlipRateAvg || comp.landRate) && (
                    <p className="text-sm font-bold text-emerald-700">${parseFloat(comp.wetSlipRateAvg || comp.landRate).toFixed(0)}/mo wet</p>
                  )}
                  {(comp.drySlipRateAvg || comp.wetRate) && (
                    <p className="text-xs text-blue-600">${parseFloat(comp.drySlipRateAvg || comp.wetRate).toFixed(0)}/mo dry</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
                {comp.totalSlips && <span>{comp.totalSlips} slips</span>}
                {comp.occupancyRate && <span>{comp.occupancyRate}% occ.</span>}
                {comp.qualityTier && <Badge variant="outline" className="text-[9px] capitalize">{comp.qualityTier}</Badge>}
                {comp._source && <Badge variant="outline" className="text-[9px] ml-auto capitalize">{comp._source}</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Market Intel Tab ──────────────────────────────────────────────────
export function PropertyIntelTab({ state, city }: { state?: string | null; city?: string | null }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ['docket-articles-property', state],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '15', status: 'approved' });
      if (state) params.set('state', state);
      const res = await apiRequest('GET', `/api/docket/articles?${params}`);
      return res.json();
    },
  });
  const articles: any[] = Array.isArray(data) ? data : data?.articles || [];
  const sentimentCounts = articles.reduce((acc: any, a: any) => {
    if (a.sentiment) acc[a.sentiment] = (acc[a.sentiment] || 0) + 1;
    return acc;
  }, {});

  if (isLoading) return <div className="space-y-3">{[...Array(4)].map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)}</div>;
  if (!articles.length) return <EmptyState icon={Newspaper} title="No market intel" subtitle={state ? `No recent marina news for ${state}` : 'No articles available'} />;

  return (
    <div className="space-y-4">
      {Object.keys(sentimentCounts).length > 0 && (
        <Card><CardContent className="p-3">
          <p className="text-xs font-medium text-gray-600 mb-2">Market Sentiment — {articles.length} articles</p>
          <div className="flex gap-2">
            {Object.entries(sentimentCounts).map(([s, count]: any) => (
              <div key={s} className={cn('flex-1 rounded-lg p-2 text-center', s === 'positive' ? 'bg-green-100 text-green-700' : s === 'negative' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600')}>
                <p className="text-lg font-bold">{count}</p>
                <p className="text-[10px] capitalize">{s}</p>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}
      {articles.map((a: any) => {
        const sentCls = a.sentiment === 'positive' ? 'bg-green-100 text-green-700' : a.sentiment === 'negative' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600';
        return (
          <Card key={a.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {a.sentiment && <Badge className={`text-[10px] ${sentCls}`}>{a.sentiment}</Badge>}
                    {a.category && <Badge variant="outline" className="text-[10px]">{fmtLabel(a.category)}</Badge>}
                  </div>
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-gray-900 hover:text-blue-600 line-clamp-2 transition-colors">{a.title}</a>
                  {a.summary && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{a.summary}</p>}
                  <div className="flex gap-3 mt-2 text-[10px] text-gray-400">
                    {a.source && <span className="font-medium">{a.source}</span>}
                    <span>{fmtDate(a.publishedAt)}</span>
                  </div>
                </div>
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-gray-100 shrink-0"><ExternalLink className="h-3.5 w-3.5 text-gray-400" /></a>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Rent Roll KPI Tab ─────────────────────────────────────────────────
export function PropertyRentRollKpiTab({ propertyId }: { propertyId: string }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ['rra-projects-property', propertyId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/rra/projects?propertyId=${propertyId}&limit=5`);
      return res.json();
    },
    enabled: !!propertyId,
  });

  const projects: any[] = Array.isArray(data) ? data : data?.projects || data?.data || [];

  if (isLoading) return <div className="space-y-2">{[...Array(3)].map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)}</div>;
  if (!projects.length) return <EmptyState icon={BarChart3} title="No Rent Roll Analyses" subtitle="Link a Rent Roll Analysis project to this property to see KPIs." />;

  const latest = projects[0];
  const kpis: { label: string; value: any; fmt?: (v: any) => string }[] = [
    { label: 'Total Units', value: latest?.summary?.totalUnits ?? latest?.totalUnits },
    { label: 'Occupied', value: latest?.summary?.occupiedUnits ?? latest?.occupiedUnits },
    { label: 'Occupancy Rate', value: latest?.summary?.occupancyRate ?? latest?.occupancyRate, fmt: v => `${parseFloat(v).toFixed(1)}%` },
    { label: 'Avg Monthly Rent', value: latest?.summary?.avgMonthlyRent ?? latest?.avgMonthlyRent, fmt: v => `$${parseFloat(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
    { label: 'Gross Potential Rent', value: latest?.summary?.grossPotentialRent ?? latest?.grossPotentialRent, fmt: v => `$${(parseFloat(v) / 1000).toFixed(0)}K/mo` },
    { label: 'Economic Vacancy', value: latest?.summary?.vacancyLoss ?? latest?.vacancyLoss, fmt: v => `$${(parseFloat(v) / 1000).toFixed(0)}K` },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {kpis.filter(k => k.value != null).map((k) => (
          <div key={k.label} className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-400 mb-1">{k.label}</p>
            <p className="text-lg font-bold text-gray-900">{k.fmt ? k.fmt(k.value) : k.value}</p>
          </div>
        ))}
      </div>
      {projects.length > 1 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4"><CardTitle className="text-sm">Recent Analyses</CardTitle></CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {projects.slice(1).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                <span className="text-gray-700 truncate">{p.name || p.title || 'Analysis'}</span>
                <span className="text-gray-400 text-xs shrink-0 ml-2">{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : ''}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Demographics Tab ───────────────────────────────────────────────────
export function PropertyDemographicsTab({ propertyId, city, state }: { propertyId: string; city?: string | null; state?: string | null }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ['property-demographics', propertyId, city, state],
    queryFn: async () => {
      const locationStr = [city, state].filter(Boolean).join(', ');
      if (!locationStr) return null;
      const res = await apiRequest('POST', '/api/demographics/location', { location: locationStr, propertyId });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!(city || state),
  });

  const demo = data?.data || data?.demographics || data;

  if (!city && !state) return <EmptyState icon={MapPin} title="No location set" subtitle="Add a city and state to this property to auto-load demographics." />;
  if (isLoading) return <div className="space-y-2">{[...Array(4)].map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>)}</div>;
  if (!demo) return <EmptyState icon={MapPin} title="Demographics unavailable" subtitle={`No data available for ${[city, state].filter(Boolean).join(', ')}.`} />;

  const items: { label: string; value: any }[] = [
    { label: 'Population', value: demo.population?.toLocaleString() },
    { label: 'Median HH Income', value: demo.medianHouseholdIncome ? `$${demo.medianHouseholdIncome.toLocaleString()}` : null },
    { label: 'Median Age', value: demo.medianAge },
    { label: 'Owner Occupied %', value: demo.ownerOccupiedRate ? `${demo.ownerOccupiedRate.toFixed(1)}%` : null },
    { label: 'Renter Occupied %', value: demo.renterOccupiedRate ? `${demo.renterOccupiedRate.toFixed(1)}%` : null },
    { label: 'Unemployment %', value: demo.unemploymentRate ? `${demo.unemploymentRate.toFixed(1)}%` : null },
    { label: 'College Educated %', value: demo.collegeEducatedRate ? `${demo.collegeEducatedRate.toFixed(1)}%` : null },
  ].filter(i => i.value != null);

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm">Demographics — {[city, state].filter(Boolean).join(', ')}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 gap-3">
            {items.map(item => (
              <div key={item.label} className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                <p className="text-sm font-bold text-gray-900">{item.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {demo.source && <p className="text-[10px] text-gray-400 text-right">Source: {demo.source}</p>}
    </div>
  );
}

// ── Activities Tab ────────────────────────────────────────────────────
const activityTypeConfig: Record<string, { icon: any; color: string; bg: string }> = {
  call: { icon: Phone, color: 'text-blue-600', bg: 'bg-blue-50' },
  email: { icon: Mail, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  meeting: { icon: Calendar, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  note: { icon: MessageSquare, color: 'text-gray-600', bg: 'bg-gray-50' },
  follow_up: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  task: { icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50' },
  site_visit: { icon: MapPin, color: 'text-rose-600', bg: 'bg-rose-50' },
};

// ── Commercial Leases Tab ─────────────────────────────────────────────────────

function fmtRentPsf(firstTermRent: { baseRentValue: string; baseRentMode: string } | null): string {
  if (!firstTermRent?.baseRentValue) return '—';
  const val = parseFloat(firstTermRent.baseRentValue);
  if (isNaN(val) || val === 0) return '—';
  const mode = firstTermRent.baseRentMode || 'PER_SF_YEAR';
  if (mode === 'PER_SF_YEAR') return `$${val.toFixed(2)} PSF/yr`;
  if (mode === 'PER_MONTH') return `$${val.toFixed(2)}/mo`;
  return `$${val.toFixed(2)}/yr`;
}

function fmtSf(v: string | number | null): string {
  if (!v) return '—';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' SF';
}

const leaseTypeColors: Record<string, string> = {
  retail: 'bg-pink-50 text-pink-700 border-pink-200',
  office: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  industrial: 'bg-gray-50 text-gray-700 border-gray-200',
  other: 'bg-purple-50 text-purple-700 border-purple-200',
};

// ── Lease form type definitions ───────────────────────────────────────────────

interface LeaseFormState {
  tenantName: string;
  suite: string;
  sf: string;
  leaseType: string;
  commencementDate: string;
  expirationDate: string;
  rentCommencementDate: string;
  active: boolean;
  notes: string;
}

interface RentTermFormState {
  baseRentValue: string;
  baseRentMode: string;
  escalationType: string;
  escalationValue: string;
  escalationCycleMonths: string;
}

interface LeaseApiBody {
  lease: Omit<LeaseFormState, 'sf'> & { sf: string; propertyId?: string };
  initialTerm?: {
    termStartDate: string;
    termEndDate: string;
    baseRentInputValue: number;
    baseRentInputUnit: string;
    escalationType: string;
    escalationValue: number;
    escalationFrequencyMonths: number;
  };
}

// ── Add Lease Sheet ───────────────────────────────────────────────────────────

interface AddLeaseSheetProps {
  propertyId: string;
  open: boolean;
  onClose: () => void;
}

const EMPTY_LEASE_FORM: LeaseFormState = {
  tenantName: '', suite: '', sf: '', leaseType: 'retail',
  commencementDate: '', expirationDate: '', rentCommencementDate: '',
  active: true, notes: '',
};
const EMPTY_TERM_FORM: RentTermFormState = {
  baseRentValue: '', baseRentMode: 'PER_SF_YEAR',
  escalationType: 'NONE', escalationValue: '', escalationCycleMonths: '12',
};

function buildInitialTermPayload(
  term: RentTermFormState,
  startDate: string,
  endDate: string,
): LeaseApiBody['initialTerm'] | undefined {
  if (!term.baseRentValue) return undefined;
  return {
    termStartDate: startDate,
    termEndDate: endDate,
    baseRentInputValue: parseFloat(term.baseRentValue),
    baseRentInputUnit: term.baseRentMode,
    escalationType: term.escalationType,
    escalationValue: term.escalationValue ? parseFloat(term.escalationValue) : 0,
    escalationFrequencyMonths: parseInt(term.escalationCycleMonths) || 12,
  };
}

function AddLeaseSheet({ propertyId, open, onClose }: AddLeaseSheetProps) {
  const [form, setForm] = useState<LeaseFormState>(EMPTY_LEASE_FORM);
  const [initialTerm, setInitialTerm] = useState<RentTermFormState>(EMPTY_TERM_FORM);
  const [error, setError] = useState<string | null>(null);

  function resetAndClose() {
    setForm(EMPTY_LEASE_FORM);
    setInitialTerm(EMPTY_TERM_FORM);
    setError(null);
    onClose();
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const body: LeaseApiBody = {
        lease: {
          ...form,
          propertyId,
          sf: form.sf ? String(form.sf) : '0',
          rentCommencementDate: form.rentCommencementDate || '',
        },
        initialTerm: buildInitialTermPayload(initialTerm, form.commencementDate, form.expirationDate),
      };
      const res = await apiRequest('POST', '/api/commercial-leases/operations/leases', body);
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error || 'Failed to create lease');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-leases', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['property-lease-stats', propertyId] });
      resetAndClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.tenantName || !form.commencementDate || !form.expirationDate) {
      setError('Tenant name, commencement date, and expiration date are required.');
      return;
    }
    setError(null);
    mutation.mutate();
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && resetAndClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-lg font-semibold flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Lease
          </SheetTitle>
          <SheetDescription>Create a new commercial lease linked to this property.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Tenant Info */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tenant Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label htmlFor="add-tenantName" className="text-xs">Tenant Name <span className="text-red-500">*</span></Label>
                <Input
                  id="add-tenantName"
                  value={form.tenantName}
                  onChange={(e) => setForm(f => ({ ...f, tenantName: e.target.value }))}
                  placeholder="e.g. Acme Corp"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="add-suite" className="text-xs">Suite</Label>
                <Input
                  id="add-suite"
                  value={form.suite}
                  onChange={(e) => setForm(f => ({ ...f, suite: e.target.value }))}
                  placeholder="e.g. 101"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="add-sf" className="text-xs">Square Footage</Label>
                <Input
                  id="add-sf"
                  type="number"
                  value={form.sf}
                  onChange={(e) => setForm(f => ({ ...f, sf: e.target.value }))}
                  placeholder="e.g. 2500"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Lease Type</Label>
                <Select value={form.leaseType} onValueChange={(v) => setForm(f => ({ ...f, leaseType: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="office">Office</SelectItem>
                    <SelectItem value="industrial">Industrial</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 flex items-center gap-2 pt-5">
                <Switch
                  id="add-active"
                  checked={form.active}
                  onCheckedChange={(v) => setForm(f => ({ ...f, active: v }))}
                />
                <Label htmlFor="add-active" className="text-xs cursor-pointer">Active</Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Dates */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Lease Dates</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="add-commencementDate" className="text-xs">Commencement <span className="text-red-500">*</span></Label>
                <Input
                  id="add-commencementDate"
                  type="date"
                  value={form.commencementDate}
                  onChange={(e) => setForm(f => ({ ...f, commencementDate: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="add-expirationDate" className="text-xs">Expiration <span className="text-red-500">*</span></Label>
                <Input
                  id="add-expirationDate"
                  type="date"
                  value={form.expirationDate}
                  onChange={(e) => setForm(f => ({ ...f, expirationDate: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="add-rentCommencementDate" className="text-xs">Rent Start (optional)</Label>
                <Input
                  id="add-rentCommencementDate"
                  type="date"
                  value={form.rentCommencementDate}
                  onChange={(e) => setForm(f => ({ ...f, rentCommencementDate: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Initial Rent Term */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Initial Rent Term (optional)</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="add-baseRentValue" className="text-xs">Base Rent</Label>
                <Input
                  id="add-baseRentValue"
                  type="number"
                  step="0.01"
                  value={initialTerm.baseRentValue}
                  onChange={(e) => setInitialTerm(t => ({ ...t, baseRentValue: e.target.value }))}
                  placeholder="e.g. 28.50"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rent Mode</Label>
                <Select value={initialTerm.baseRentMode} onValueChange={(v) => setInitialTerm(t => ({ ...t, baseRentMode: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PER_SF_YEAR">Per SF / Year</SelectItem>
                    <SelectItem value="PER_MONTH">Per Month</SelectItem>
                    <SelectItem value="PER_YEAR">Per Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Escalation</Label>
                <Select value={initialTerm.escalationType} onValueChange={(v) => setInitialTerm(t => ({ ...t, escalationType: v }))}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">None</SelectItem>
                    <SelectItem value="PERCENT">Percent</SelectItem>
                    <SelectItem value="FIXED_DOLLAR">Fixed Dollar</SelectItem>
                    <SelectItem value="CPI">CPI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {initialTerm.escalationType !== 'NONE' && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="add-escalationValue" className="text-xs">
                      {initialTerm.escalationType === 'PERCENT' ? 'Rate (%)' : 'Amount ($)'}
                    </Label>
                    <Input
                      id="add-escalationValue"
                      type="number"
                      step="0.01"
                      value={initialTerm.escalationValue}
                      onChange={(e) => setInitialTerm(t => ({ ...t, escalationValue: e.target.value }))}
                      placeholder="e.g. 3.0"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="add-escalationCycle" className="text-xs">Cycle (months)</Label>
                    <Input
                      id="add-escalationCycle"
                      type="number"
                      value={initialTerm.escalationCycleMonths}
                      onChange={(e) => setInitialTerm(t => ({ ...t, escalationCycleMonths: e.target.value }))}
                      placeholder="12"
                      className="h-8 text-sm"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <Separator />

          {/* Notes */}
          <div className="space-y-1">
            <Label htmlFor="add-notes" className="text-xs">Notes</Label>
            <Textarea
              id="add-notes"
              value={form.notes}
              onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any additional notes..."
              className="text-sm min-h-[70px] resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-1 pb-6">
            <Button type="submit" disabled={mutation.isPending} className="flex-1 h-9">
              {mutation.isPending ? 'Saving...' : 'Create Lease'}
            </Button>
            <Button type="button" variant="outline" onClick={resetAndClose} className="h-9 px-4">
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ── Lease Detail / Edit Sheet ─────────────────────────────────────────────────

interface LeaseDetail {
  tenantName: string;
  suite?: string;
  sf?: string;
  leaseType?: string;
  commencementDate?: string;
  expirationDate?: string;
  rentCommencementDate?: string;
  active?: boolean;
  notes?: string;
  terms?: Array<{
    id: string;
    startDate?: string;
    endDate?: string;
    baseRentValue?: string;
    baseRentMode?: string;
    escalationType?: string;
    escalationValue?: string;
    escalationCycleMonths?: number;
  }>;
  chargeLines?: Array<Record<string, unknown>>;
  abatements?: Array<Record<string, unknown>>;
  tiPrograms?: Array<Record<string, unknown>>;
  recoveryModels?: Array<Record<string, unknown>>;
  orgId?: string;
  projectId?: string;
}

interface NewTermForm {
  startDate: string;
  endDate: string;
  baseRentValue: string;
  baseRentMode: string;
  escalationType: string;
  escalationValue: string;
  escalationCycleMonths: string;
}
interface NewChargeLineForm {
  lineName: string;
  lineType: string;
  amountValue: string;
  amountMode: string;
  startDate: string;
  endDate: string;
}
interface NewAbatementForm {
  abatementType: string;
  startDate: string;
  endDate: string;
  appliesTo: string;
  value: string;
}

const BLANK_TERM: NewTermForm = {
  startDate: '', endDate: '', baseRentValue: '', baseRentMode: 'PER_SF_YEAR',
  escalationType: 'NONE', escalationValue: '', escalationCycleMonths: '12',
};
const BLANK_CHARGE_LINE: NewChargeLineForm = {
  lineName: '', lineType: 'RECOVERY_CAM', amountValue: '', amountMode: 'FIXED_MONTHLY',
  startDate: '', endDate: '',
};
const BLANK_ABATEMENT: NewAbatementForm = {
  abatementType: 'FREE_RENT', startDate: '', endDate: '', appliesTo: 'BASE_ONLY', value: '',
};

function LeaseDetailSheet({ leaseId, propertyId, open, onClose }: { leaseId: string; propertyId: string; open: boolean; onClose: () => void }) {
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<LeaseFormState | null>(null);
  const [editTerm, setEditTerm] = useState<RentTermFormState | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [addingTerm, setAddingTerm] = useState(false);
  const [newTerm, setNewTerm] = useState<NewTermForm>(BLANK_TERM);
  const [editingTermId, setEditingTermId] = useState<string | null>(null);
  const [editTermForm, setEditTermForm] = useState<NewTermForm>(BLANK_TERM);
  const [addingChargeLine, setAddingChargeLine] = useState(false);
  const [newChargeLine, setNewChargeLine] = useState<NewChargeLineForm>(BLANK_CHARGE_LINE);
  const [editingChargeLineId, setEditingChargeLineId] = useState<string | null>(null);
  const [editChargeLineForm, setEditChargeLineForm] = useState<NewChargeLineForm>(BLANK_CHARGE_LINE);
  const [addingAbatement, setAddingAbatement] = useState(false);
  const [newAbatement, setNewAbatement] = useState<NewAbatementForm>(BLANK_ABATEMENT);
  const [editingAbatementId, setEditingAbatementId] = useState<string | null>(null);
  const [editAbatementForm, setEditAbatementForm] = useState<NewAbatementForm>(BLANK_ABATEMENT);

  const { data: detail, isLoading } = useQuery<LeaseDetail>({
    queryKey: ['lease-detail', leaseId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/commercial-leases/leases/${leaseId}`);
      return res.json() as Promise<LeaseDetail>;
    },
    enabled: open && !!leaseId,
  });

  function startEdit() {
    if (!detail) return;
    setEditForm({
      tenantName: detail.tenantName || '',
      suite: detail.suite || '',
      sf: detail.sf || '',
      leaseType: detail.leaseType || 'retail',
      commencementDate: detail.commencementDate?.slice(0, 10) || '',
      expirationDate: detail.expirationDate?.slice(0, 10) || '',
      rentCommencementDate: detail.rentCommencementDate?.slice(0, 10) || '',
      active: detail.active !== false,
      notes: detail.notes || '',
    });
    const term0 = detail.terms?.[0];
    setEditTerm({
      baseRentValue: term0?.baseRentValue || '',
      baseRentMode: term0?.baseRentMode || 'PER_SF_YEAR',
      escalationType: term0?.escalationType || 'NONE',
      escalationValue: term0?.escalationValue || '',
      escalationCycleMonths: term0?.escalationCycleMonths != null ? String(term0.escalationCycleMonths) : '12',
    });
    setSaveError(null);
    setConfirmingDelete(false);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setEditForm(null);
    setEditTerm(null);
    setSaveError(null);
    setConfirmingDelete(false);
    setDeleteError(null);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editForm) throw new Error('No form data');
      const body: LeaseApiBody = {
        lease: {
          ...editForm,
          sf: editForm.sf ? String(editForm.sf) : '0',
          rentCommencementDate: editForm.rentCommencementDate || '',
        },
        initialTerm: editTerm
          ? buildInitialTermPayload(editTerm, editForm.commencementDate, editForm.expirationDate)
          : undefined,
      };
      const res = await apiRequest('PATCH', `/api/commercial-leases/operations/leases/${leaseId}`, body);
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error || 'Failed to save changes');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lease-detail', leaseId] });
      queryClient.invalidateQueries({ queryKey: ['property-leases', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['property-lease-stats', propertyId] });
      setEditing(false);
      setEditForm(null);
      setEditTerm(null);
      setSaveError(null);
    },
    onError: (e: Error) => setSaveError(e.message),
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editForm?.tenantName || !editForm?.commencementDate || !editForm?.expirationDate) {
      setSaveError('Tenant name, commencement date, and expiration date are required.');
      return;
    }
    saveMutation.mutate();
  }

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('DELETE', `/api/commercial-leases/leases/${leaseId}`);
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error || 'Failed to delete lease');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['property-leases', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['property-lease-stats', propertyId] });
      onClose();
    },
    onError: (e: Error) => setDeleteError(e.message),
  });

  function invalidateLeaseData() {
    queryClient.invalidateQueries({ queryKey: ['lease-detail', leaseId] });
    queryClient.invalidateQueries({ queryKey: ['property-leases', propertyId] });
    queryClient.invalidateQueries({ queryKey: ['property-lease-stats', propertyId] });
  }

  function buildTermPayload(data: NewTermForm) {
    return {
      startDate: data.startDate,
      endDate: data.endDate,
      baseRentValue: data.baseRentValue || '0',
      baseRentMode: data.baseRentMode,
      escalationType: data.escalationType,
      escalationValue: data.escalationType !== 'NONE' && data.escalationValue ? data.escalationValue : '0',
      escalationCycleMonths: data.escalationType !== 'NONE' && data.escalationCycleMonths ? parseInt(data.escalationCycleMonths) : 12,
    };
  }

  function buildChargeLinePayload(data: NewChargeLineForm) {
    return {
      lineName: data.lineName,
      lineType: data.lineType,
      amountValue: data.amountValue || '0',
      amountMode: data.amountMode,
      startDate: data.startDate,
      endDate: data.endDate || null,
    };
  }

  function buildAbatementPayload(data: NewAbatementForm) {
    return {
      abatementType: data.abatementType,
      startDate: data.startDate,
      endDate: data.endDate,
      appliesTo: data.appliesTo,
      value: data.abatementType === 'FREE_RENT' ? '0' : (data.value || '0'),
    };
  }

  const addTermMutation = useMutation({
    mutationFn: async (data: NewTermForm) => {
      const res = await apiRequest('POST', `/api/commercial-leases/leases/${leaseId}/terms`, buildTermPayload(data));
      if (!res.ok) { const e = await res.json() as { error?: string }; throw new Error(e.error || 'Failed to add term'); }
      return res.json();
    },
    onSuccess: () => { invalidateLeaseData(); setAddingTerm(false); setNewTerm(BLANK_TERM); },
  });

  const updateTermMutation = useMutation({
    mutationFn: async ({ termId, data }: { termId: string; data: NewTermForm }) => {
      const res = await apiRequest('PUT', `/api/commercial-leases/leases/${leaseId}/terms/${termId}`, buildTermPayload(data));
      if (!res.ok) { const e = await res.json() as { error?: string }; throw new Error(e.error || 'Failed to update term'); }
      return res.json();
    },
    onSuccess: () => { invalidateLeaseData(); setEditingTermId(null); },
  });

  const deleteTermMutation = useMutation({
    mutationFn: async (termId: string) => {
      const res = await apiRequest('DELETE', `/api/commercial-leases/leases/${leaseId}/terms/${termId}`);
      if (!res.ok) { const e = await res.json() as { error?: string }; throw new Error(e.error || 'Failed to delete term'); }
    },
    onSuccess: () => invalidateLeaseData(),
  });

  const addChargeLineMutation = useMutation({
    mutationFn: async (data: NewChargeLineForm) => {
      const res = await apiRequest('POST', `/api/commercial-leases/leases/${leaseId}/charge-lines`, buildChargeLinePayload(data));
      if (!res.ok) { const e = await res.json() as { error?: string }; throw new Error(e.error || 'Failed to add charge line'); }
      return res.json();
    },
    onSuccess: () => { invalidateLeaseData(); setAddingChargeLine(false); setNewChargeLine(BLANK_CHARGE_LINE); },
  });

  const updateChargeLineMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: NewChargeLineForm }) => {
      const res = await apiRequest('PUT', `/api/commercial-leases/leases/${leaseId}/charge-lines/${id}`, buildChargeLinePayload(data));
      if (!res.ok) { const e = await res.json() as { error?: string }; throw new Error(e.error || 'Failed to update charge line'); }
      return res.json();
    },
    onSuccess: () => { invalidateLeaseData(); setEditingChargeLineId(null); },
  });

  const deleteChargeLineMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/commercial-leases/leases/${leaseId}/charge-lines/${id}`);
      if (!res.ok) { const e = await res.json() as { error?: string }; throw new Error(e.error || 'Failed to delete charge line'); }
    },
    onSuccess: () => invalidateLeaseData(),
  });

  const addAbatementMutation = useMutation({
    mutationFn: async (data: NewAbatementForm) => {
      const res = await apiRequest('POST', `/api/commercial-leases/leases/${leaseId}/abatements`, buildAbatementPayload(data));
      if (!res.ok) { const e = await res.json() as { error?: string }; throw new Error(e.error || 'Failed to add abatement'); }
      return res.json();
    },
    onSuccess: () => { invalidateLeaseData(); setAddingAbatement(false); setNewAbatement(BLANK_ABATEMENT); },
  });

  const updateAbatementMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: NewAbatementForm }) => {
      const res = await apiRequest('PUT', `/api/commercial-leases/leases/${leaseId}/abatements/${id}`, buildAbatementPayload(data));
      if (!res.ok) { const e = await res.json() as { error?: string }; throw new Error(e.error || 'Failed to update abatement'); }
      return res.json();
    },
    onSuccess: () => { invalidateLeaseData(); setEditingAbatementId(null); },
  });

  const deleteAbatementMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest('DELETE', `/api/commercial-leases/leases/${leaseId}/abatements/${id}`);
      if (!res.ok) { const e = await res.json() as { error?: string }; throw new Error(e.error || 'Failed to delete abatement'); }
    },
    onSuccess: () => invalidateLeaseData(),
  });

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) { cancelEdit(); onClose(); } }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        {isLoading ? (
          <div className="space-y-4 mt-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : detail ? (
          <>
            <SheetHeader className="pb-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-lg font-semibold">{detail.tenantName}</SheetTitle>
                  <SheetDescription className="flex items-center gap-2 flex-wrap mt-1">
                    {detail.suite && <span className="text-gray-600">Suite {detail.suite}</span>}
                    {detail.sf && <><span>·</span><span>{fmtSf(detail.sf)}</span></>}
                    {detail.leaseType && (
                      <Badge variant="outline" className={cn('text-[10px]', leaseTypeColors[detail.leaseType] || '')}>
                        {detail.leaseType}
                      </Badge>
                    )}
                    <Badge variant="outline" className={detail.active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600'}>
                      {detail.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </SheetDescription>
                </div>
                {!editing && !confirmingDelete && (
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" onClick={startEdit} className="shrink-0 h-8 gap-1.5 text-xs">
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmingDelete(true)}
                      className="shrink-0 h-8 gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </Button>
                  </div>
                )}
                {!editing && confirmingDelete && (
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-red-600 font-medium">Delete this lease?</span>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => { setDeleteError(null); deleteMutation.mutate(); }}
                        disabled={deleteMutation.isPending}
                        className="h-8 text-xs"
                      >
                        {deleteMutation.isPending ? 'Deleting…' : 'Confirm'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setConfirmingDelete(false); setDeleteError(null); }}
                        disabled={deleteMutation.isPending}
                        className="h-8 text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                    {deleteError && (
                      <p className="text-xs text-red-600">{deleteError}</p>
                    )}
                  </div>
                )}
              </div>
            </SheetHeader>

            {/* Edit Form */}
            {editing && editForm && editTerm ? (
              <form onSubmit={handleSave} className="space-y-5">
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tenant Details</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Tenant Name <span className="text-red-500">*</span></Label>
                      <Input
                        value={editForm.tenantName}
                        onChange={(e) => setEditForm((f) => f ? { ...f, tenantName: e.target.value } : f)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Suite</Label>
                      <Input
                        value={editForm.suite}
                        onChange={(e) => setEditForm((f) => f ? { ...f, suite: e.target.value } : f)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Square Footage</Label>
                      <Input
                        type="number"
                        value={editForm.sf}
                        onChange={(e) => setEditForm((f) => f ? { ...f, sf: e.target.value } : f)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Lease Type</Label>
                      <Select value={editForm.leaseType} onValueChange={(v) => setEditForm((f) => f ? { ...f, leaseType: v } : f)}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="retail">Retail</SelectItem>
                          <SelectItem value="office">Office</SelectItem>
                          <SelectItem value="industrial">Industrial</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 flex items-center gap-2 pt-5">
                      <Switch
                        checked={editForm.active}
                        onCheckedChange={(v) => setEditForm((f) => f ? { ...f, active: v } : f)}
                      />
                      <Label className="text-xs cursor-pointer">Active</Label>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Lease Dates</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Commencement <span className="text-red-500">*</span></Label>
                      <Input
                        type="date"
                        value={editForm.commencementDate}
                        onChange={(e) => setEditForm((f) => f ? { ...f, commencementDate: e.target.value } : f)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Expiration <span className="text-red-500">*</span></Label>
                      <Input
                        type="date"
                        value={editForm.expirationDate}
                        onChange={(e) => setEditForm((f) => f ? { ...f, expirationDate: e.target.value } : f)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Rent Start (optional)</Label>
                      <Input
                        type="date"
                        value={editForm.rentCommencementDate}
                        onChange={(e) => setEditForm((f) => f ? { ...f, rentCommencementDate: e.target.value } : f)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Rent Term Editing */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" /> Rent Term (Term 1)
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Base Rent</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editTerm.baseRentValue}
                        onChange={(e) => setEditTerm((t) => t ? { ...t, baseRentValue: e.target.value } : t)}
                        placeholder="e.g. 28.50"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Rent Mode</Label>
                      <Select value={editTerm.baseRentMode} onValueChange={(v) => setEditTerm((t) => t ? { ...t, baseRentMode: v } : t)}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PER_SF_YEAR">Per SF / Year</SelectItem>
                          <SelectItem value="PER_MONTH">Per Month</SelectItem>
                          <SelectItem value="PER_YEAR">Per Year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Escalation</Label>
                      <Select value={editTerm.escalationType} onValueChange={(v) => setEditTerm((t) => t ? { ...t, escalationType: v } : t)}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">None</SelectItem>
                          <SelectItem value="PERCENT">Percent</SelectItem>
                          <SelectItem value="FIXED_DOLLAR">Fixed Dollar</SelectItem>
                          <SelectItem value="CPI">CPI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {editTerm.escalationType !== 'NONE' && (
                      <>
                        <div className="space-y-1">
                          <Label className="text-xs">
                            {editTerm.escalationType === 'PERCENT' ? 'Rate (%)' : 'Amount ($)'}
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={editTerm.escalationValue}
                            onChange={(e) => setEditTerm((t) => t ? { ...t, escalationValue: e.target.value } : t)}
                            placeholder="e.g. 3.0"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Cycle (months)</Label>
                          <Input
                            type="number"
                            value={editTerm.escalationCycleMonths}
                            onChange={(e) => setEditTerm((t) => t ? { ...t, escalationCycleMonths: e.target.value } : t)}
                            placeholder="12"
                            className="h-8 text-sm"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-1">
                  <Label className="text-xs">Notes</Label>
                  <Textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm((f) => f ? { ...f, notes: e.target.value } : f)}
                    className="text-sm min-h-[70px] resize-none"
                  />
                </div>

                {saveError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{saveError}</p>
                )}

                <div className="flex gap-2 pb-6">
                  <Button type="submit" disabled={saveMutation.isPending} className="h-9 gap-1.5">
                    <Save className="h-3.5 w-3.5" />
                    {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button type="button" variant="outline" onClick={cancelEdit} className="h-9 gap-1.5">
                    <X className="h-3.5 w-3.5" /> Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <>
                {/* Core Dates */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Commencement</p>
                    <p className="text-sm font-medium">{fmtDate(detail.commencementDate)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Rent Start</p>
                    <p className="text-sm font-medium">{fmtDate(detail.rentCommencementDate || detail.commencementDate)}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Expiration</p>
                    <p className="text-sm font-medium">{fmtDate(detail.expirationDate)}</p>
                  </div>
                </div>

                {/* Rent Terms */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5" /> Rent Terms
                    </h3>
                    <Button
                      variant="ghost" size="sm"
                      className="h-6 px-2 text-xs gap-1"
                      onClick={() => { setAddingTerm(true); setNewTerm(BLANK_TERM); }}
                      disabled={addingTerm}
                    >
                      <Plus className="h-3 w-3" /> Add
                    </Button>
                  </div>
                  {(detail.terms?.length > 0 || addingTerm) && (
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 dark:bg-gray-800">
                            <TableHead className="text-[10px] font-medium text-gray-500 uppercase">#</TableHead>
                            <TableHead className="text-[10px] font-medium text-gray-500 uppercase">Period</TableHead>
                            <TableHead className="text-[10px] font-medium text-gray-500 uppercase">Base Rent</TableHead>
                            <TableHead className="text-[10px] font-medium text-gray-500 uppercase">Escalation</TableHead>
                            <TableHead className="w-8" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detail.terms?.map((term: any, i: number) => (
                            editingTermId === term.id ? (
                              <TableRow key={term.id}>
                                <TableCell colSpan={5} className="p-3">
                                  <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="space-y-1">
                                        <Label className="text-[10px]">Start Date</Label>
                                        <Input type="date" className="h-7 text-xs" value={editTermForm.startDate} onChange={(e) => setEditTermForm(t => ({ ...t, startDate: e.target.value }))} />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-[10px]">End Date</Label>
                                        <Input type="date" className="h-7 text-xs" value={editTermForm.endDate} onChange={(e) => setEditTermForm(t => ({ ...t, endDate: e.target.value }))} />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-[10px]">Base Rent</Label>
                                        <Input type="number" step="0.01" className="h-7 text-xs" value={editTermForm.baseRentValue} onChange={(e) => setEditTermForm(t => ({ ...t, baseRentValue: e.target.value }))} />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-[10px]">Rent Mode</Label>
                                        <Select value={editTermForm.baseRentMode} onValueChange={(v) => setEditTermForm(t => ({ ...t, baseRentMode: v }))}>
                                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="PER_SF_YEAR">Per SF / Year</SelectItem>
                                            <SelectItem value="PER_MONTH">Per Month</SelectItem>
                                            <SelectItem value="PER_YEAR">Per Year</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-[10px]">Escalation</Label>
                                        <Select value={editTermForm.escalationType} onValueChange={(v) => setEditTermForm(t => ({ ...t, escalationType: v }))}>
                                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="NONE">None</SelectItem>
                                            <SelectItem value="PERCENT">Percent</SelectItem>
                                            <SelectItem value="FIXED_DOLLAR">Fixed Dollar</SelectItem>
                                            <SelectItem value="CPI">CPI</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      {editTermForm.escalationType !== 'NONE' && (
                                        <>
                                          <div className="space-y-1">
                                            <Label className="text-[10px]">{editTermForm.escalationType === 'PERCENT' ? 'Rate (%)' : 'Amount ($)'}</Label>
                                            <Input type="number" step="0.01" className="h-7 text-xs" value={editTermForm.escalationValue} onChange={(e) => setEditTermForm(t => ({ ...t, escalationValue: e.target.value }))} />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-[10px]">Cycle (months)</Label>
                                            <Input type="number" className="h-7 text-xs" value={editTermForm.escalationCycleMonths} onChange={(e) => setEditTermForm(t => ({ ...t, escalationCycleMonths: e.target.value }))} />
                                          </div>
                                        </>
                                      )}
                                    </div>
                                    <div className="flex gap-2 pt-1">
                                      <Button size="sm" className="h-7 text-xs gap-1" disabled={updateTermMutation.isPending || !editTermForm.startDate || !editTermForm.endDate || !editTermForm.baseRentValue || (editTermForm.escalationType !== 'NONE' && !editTermForm.escalationValue)} onClick={() => updateTermMutation.mutate({ termId: term.id, data: editTermForm })}>
                                        <Save className="h-3 w-3" /> {updateTermMutation.isPending ? 'Saving…' : 'Save'}
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingTermId(null)}>Cancel</Button>
                                    </div>
                                    {updateTermMutation.isError && <p className="text-[10px] text-red-600">{(updateTermMutation.error as Error)?.message}</p>}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : (
                              <TableRow key={term.id || i}>
                                <TableCell className="text-xs text-gray-500">{i + 1}</TableCell>
                                <TableCell className="text-xs">{fmtDate(term.startDate)} – {fmtDate(term.endDate)}</TableCell>
                                <TableCell className="text-xs font-medium">
                                  ${parseFloat(term.baseRentValue || '0').toFixed(2)}
                                  <span className="text-gray-400 ml-1 text-[10px]">
                                    {term.baseRentMode === 'PER_SF_YEAR' ? 'PSF/yr' : term.baseRentMode === 'PER_MONTH' ? '/mo' : '/yr'}
                                  </span>
                                </TableCell>
                                <TableCell className="text-xs text-gray-500">
                                  {term.escalationType === 'NONE' ? 'None'
                                    : term.escalationType === 'FIXED_DOLLAR' ? `+$${parseFloat(term.escalationValue || '0').toFixed(2)} every ${term.escalationCycleMonths}mo`
                                    : term.escalationType === 'PERCENT' ? `+${parseFloat(term.escalationValue || '0').toFixed(2)}% every ${term.escalationCycleMonths}mo`
                                    : term.escalationType === 'CPI' ? `CPI every ${term.escalationCycleMonths}mo`
                                    : term.escalationType}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost" size="sm"
                                      className="h-6 w-6 p-0 text-gray-400 hover:text-blue-500"
                                      onClick={() => {
                                        setEditingTermId(term.id);
                                        setEditTermForm({
                                          startDate: term.startDate?.slice(0, 10) || '',
                                          endDate: term.endDate?.slice(0, 10) || '',
                                          baseRentValue: term.baseRentValue || '',
                                          baseRentMode: term.baseRentMode || 'PER_SF_YEAR',
                                          escalationType: term.escalationType || 'NONE',
                                          escalationValue: term.escalationValue || '',
                                          escalationCycleMonths: term.escalationCycleMonths != null ? String(term.escalationCycleMonths) : '12',
                                        });
                                      }}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost" size="sm"
                                      className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                                      disabled={deleteTermMutation.isPending}
                                      onClick={() => term.id && deleteTermMutation.mutate(term.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          ))}
                          {addingTerm && (
                            <TableRow>
                              <TableCell colSpan={5} className="p-3">
                                <div className="space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                      <Label className="text-[10px]">Start Date</Label>
                                      <Input type="date" className="h-7 text-xs" value={newTerm.startDate} onChange={(e) => setNewTerm(t => ({ ...t, startDate: e.target.value }))} />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px]">End Date</Label>
                                      <Input type="date" className="h-7 text-xs" value={newTerm.endDate} onChange={(e) => setNewTerm(t => ({ ...t, endDate: e.target.value }))} />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px]">Base Rent</Label>
                                      <Input type="number" step="0.01" className="h-7 text-xs" placeholder="e.g. 28.50" value={newTerm.baseRentValue} onChange={(e) => setNewTerm(t => ({ ...t, baseRentValue: e.target.value }))} />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px]">Rent Mode</Label>
                                      <Select value={newTerm.baseRentMode} onValueChange={(v) => setNewTerm(t => ({ ...t, baseRentMode: v }))}>
                                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="PER_SF_YEAR">Per SF / Year</SelectItem>
                                          <SelectItem value="PER_MONTH">Per Month</SelectItem>
                                          <SelectItem value="PER_YEAR">Per Year</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px]">Escalation</Label>
                                      <Select value={newTerm.escalationType} onValueChange={(v) => setNewTerm(t => ({ ...t, escalationType: v }))}>
                                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="NONE">None</SelectItem>
                                          <SelectItem value="PERCENT">Percent</SelectItem>
                                          <SelectItem value="FIXED_DOLLAR">Fixed Dollar</SelectItem>
                                          <SelectItem value="CPI">CPI</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    {newTerm.escalationType !== 'NONE' && (
                                      <>
                                        <div className="space-y-1">
                                          <Label className="text-[10px]">{newTerm.escalationType === 'PERCENT' ? 'Rate (%)' : 'Amount ($)'}</Label>
                                          <Input type="number" step="0.01" className="h-7 text-xs" placeholder="e.g. 3.0" value={newTerm.escalationValue} onChange={(e) => setNewTerm(t => ({ ...t, escalationValue: e.target.value }))} />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-[10px]">Cycle (months)</Label>
                                          <Input type="number" className="h-7 text-xs" placeholder="12" value={newTerm.escalationCycleMonths} onChange={(e) => setNewTerm(t => ({ ...t, escalationCycleMonths: e.target.value }))} />
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  <div className="flex gap-2 pt-1">
                                    <Button size="sm" className="h-7 text-xs gap-1" disabled={addTermMutation.isPending || !newTerm.startDate || !newTerm.endDate || !newTerm.baseRentValue || (newTerm.escalationType !== 'NONE' && !newTerm.escalationValue)} onClick={() => addTermMutation.mutate(newTerm)}>
                                      <Save className="h-3 w-3" /> {addTermMutation.isPending ? 'Saving…' : 'Save Term'}
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAddingTerm(false)}>
                                      Cancel
                                    </Button>
                                  </div>
                                  {addTermMutation.isError && (
                                    <p className="text-[10px] text-red-600">{(addTermMutation.error as Error)?.message}</p>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {!detail.terms?.length && !addingTerm && (
                    <p className="text-xs text-gray-400 italic">No rent terms — click Add to create one.</p>
                  )}
                </div>

                {/* Charge Lines (Recoveries) */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5" /> Recoveries & Charges
                    </h3>
                    <Button
                      variant="ghost" size="sm"
                      className="h-6 px-2 text-xs gap-1"
                      onClick={() => { setAddingChargeLine(true); setNewChargeLine(BLANK_CHARGE_LINE); }}
                      disabled={addingChargeLine}
                    >
                      <Plus className="h-3 w-3" /> Add
                    </Button>
                  </div>
                  {(detail.chargeLines?.length > 0 || addingChargeLine) && (
                    <div className="rounded-lg border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50 dark:bg-gray-800">
                            <TableHead className="text-[10px] font-medium text-gray-500 uppercase">Name</TableHead>
                            <TableHead className="text-[10px] font-medium text-gray-500 uppercase">Type</TableHead>
                            <TableHead className="text-[10px] font-medium text-gray-500 uppercase">Amount</TableHead>
                            <TableHead className="text-[10px] font-medium text-gray-500 uppercase">Period</TableHead>
                            <TableHead className="w-8" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detail.chargeLines?.map((cl: any) => (
                            editingChargeLineId === cl.id ? (
                              <TableRow key={cl.id}>
                                <TableCell colSpan={5} className="p-3">
                                  <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="space-y-1">
                                        <Label className="text-[10px]">Name</Label>
                                        <Input className="h-7 text-xs" value={editChargeLineForm.lineName} onChange={(e) => setEditChargeLineForm(c => ({ ...c, lineName: e.target.value }))} />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-[10px]">Type</Label>
                                        <Select value={editChargeLineForm.lineType} onValueChange={(v) => setEditChargeLineForm(c => ({ ...c, lineType: v }))}>
                                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="RECOVERY_CAM">CAM Recovery</SelectItem>
                                            <SelectItem value="RECOVERY_TAX">Tax Recovery</SelectItem>
                                            <SelectItem value="RECOVERY_INSURANCE">Insurance Recovery</SelectItem>
                                            <SelectItem value="RECOVERY_UTILITIES">Utilities Recovery</SelectItem>
                                            <SelectItem value="MISC_INCOME">Misc Income</SelectItem>
                                            <SelectItem value="DISCOUNT">Discount</SelectItem>
                                            <SelectItem value="TI_AMORTIZATION">TI Amortization</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-[10px]">Amount</Label>
                                        <Input type="number" step="0.01" className="h-7 text-xs" value={editChargeLineForm.amountValue} onChange={(e) => setEditChargeLineForm(c => ({ ...c, amountValue: e.target.value }))} />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-[10px]">Mode</Label>
                                        <Select value={editChargeLineForm.amountMode} onValueChange={(v) => setEditChargeLineForm(c => ({ ...c, amountMode: v }))}>
                                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="PER_SF_MONTHLY">Per SF / Month</SelectItem>
                                            <SelectItem value="FIXED_MONTHLY">Flat / Month</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-[10px]">Start Date</Label>
                                        <Input type="date" className="h-7 text-xs" value={editChargeLineForm.startDate} onChange={(e) => setEditChargeLineForm(c => ({ ...c, startDate: e.target.value }))} />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-[10px]">End Date (optional)</Label>
                                        <Input type="date" className="h-7 text-xs" value={editChargeLineForm.endDate} onChange={(e) => setEditChargeLineForm(c => ({ ...c, endDate: e.target.value }))} />
                                      </div>
                                    </div>
                                    <div className="flex gap-2 pt-1">
                                      <Button size="sm" className="h-7 text-xs gap-1" disabled={updateChargeLineMutation.isPending || !editChargeLineForm.lineName || !editChargeLineForm.amountValue || !editChargeLineForm.startDate} onClick={() => updateChargeLineMutation.mutate({ id: cl.id, data: editChargeLineForm })}>
                                        <Save className="h-3 w-3" /> {updateChargeLineMutation.isPending ? 'Saving…' : 'Save'}
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingChargeLineId(null)}>Cancel</Button>
                                    </div>
                                    {updateChargeLineMutation.isError && <p className="text-[10px] text-red-600">{(updateChargeLineMutation.error as Error)?.message}</p>}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : (
                              <TableRow key={cl.id}>
                                <TableCell className="text-xs font-medium">{cl.lineName}</TableCell>
                                <TableCell className="text-[10px] text-gray-500">{cl.lineType?.replace(/_/g, ' ')}</TableCell>
                                <TableCell className="text-xs">
                                  ${parseFloat(cl.amountValue || '0').toFixed(2)}
                                  <span className="text-gray-400 ml-1 text-[10px]">{cl.amountMode === 'PER_SF_MONTHLY' ? 'PSF/mo' : '/mo'}</span>
                                </TableCell>
                                <TableCell className="text-xs text-gray-500">{fmtDate(cl.startDate)}{cl.endDate ? ` – ${fmtDate(cl.endDate)}` : ''}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost" size="sm"
                                      className="h-6 w-6 p-0 text-gray-400 hover:text-blue-500"
                                      onClick={() => {
                                        setEditingChargeLineId(cl.id);
                                        setEditChargeLineForm({
                                          lineName: cl.lineName || '',
                                          lineType: cl.lineType || 'RECOVERY_CAM',
                                          amountValue: cl.amountValue || '',
                                          amountMode: cl.amountMode || 'FIXED_MONTHLY',
                                          startDate: cl.startDate?.slice(0, 10) || '',
                                          endDate: cl.endDate?.slice(0, 10) || '',
                                        });
                                      }}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost" size="sm"
                                      className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                                      disabled={deleteChargeLineMutation.isPending}
                                      onClick={() => cl.id && deleteChargeLineMutation.mutate(cl.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          ))}
                          {addingChargeLine && (
                            <TableRow>
                              <TableCell colSpan={5} className="p-3">
                                <div className="space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                      <Label className="text-[10px]">Name</Label>
                                      <Input className="h-7 text-xs" placeholder="e.g. CAM Recovery" value={newChargeLine.lineName} onChange={(e) => setNewChargeLine(c => ({ ...c, lineName: e.target.value }))} />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px]">Type</Label>
                                      <Select value={newChargeLine.lineType} onValueChange={(v) => setNewChargeLine(c => ({ ...c, lineType: v }))}>
                                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="RECOVERY_CAM">CAM Recovery</SelectItem>
                                          <SelectItem value="RECOVERY_TAX">Tax Recovery</SelectItem>
                                          <SelectItem value="RECOVERY_INSURANCE">Insurance Recovery</SelectItem>
                                          <SelectItem value="RECOVERY_UTILITIES">Utilities Recovery</SelectItem>
                                          <SelectItem value="MISC_INCOME">Misc Income</SelectItem>
                                          <SelectItem value="DISCOUNT">Discount</SelectItem>
                                          <SelectItem value="TI_AMORTIZATION">TI Amortization</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px]">Amount</Label>
                                      <Input type="number" step="0.01" className="h-7 text-xs" placeholder="e.g. 2.50" value={newChargeLine.amountValue} onChange={(e) => setNewChargeLine(c => ({ ...c, amountValue: e.target.value }))} />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px]">Mode</Label>
                                      <Select value={newChargeLine.amountMode} onValueChange={(v) => setNewChargeLine(c => ({ ...c, amountMode: v }))}>
                                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="PER_SF_MONTHLY">Per SF / Month</SelectItem>
                                          <SelectItem value="FIXED_MONTHLY">Flat / Month</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px]">Start Date</Label>
                                      <Input type="date" className="h-7 text-xs" value={newChargeLine.startDate} onChange={(e) => setNewChargeLine(c => ({ ...c, startDate: e.target.value }))} />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px]">End Date (optional)</Label>
                                      <Input type="date" className="h-7 text-xs" value={newChargeLine.endDate} onChange={(e) => setNewChargeLine(c => ({ ...c, endDate: e.target.value }))} />
                                    </div>
                                  </div>
                                  <div className="flex gap-2 pt-1">
                                    <Button size="sm" className="h-7 text-xs gap-1" disabled={addChargeLineMutation.isPending || !newChargeLine.lineName || !newChargeLine.amountValue || !newChargeLine.startDate} onClick={() => addChargeLineMutation.mutate(newChargeLine)}>
                                      <Save className="h-3 w-3" /> {addChargeLineMutation.isPending ? 'Saving…' : 'Save Line'}
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAddingChargeLine(false)}>
                                      Cancel
                                    </Button>
                                  </div>
                                  {addChargeLineMutation.isError && (
                                    <p className="text-[10px] text-red-600">{(addChargeLineMutation.error as Error)?.message}</p>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {!detail.chargeLines?.length && !addingChargeLine && (
                    <p className="text-xs text-gray-400 italic">No charge lines — click Add to create one.</p>
                  )}
                </div>

                {/* Abatements / Concessions */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5" /> Abatements & Concessions
                    </h3>
                    <Button
                      variant="ghost" size="sm"
                      className="h-6 px-2 text-xs gap-1"
                      onClick={() => { setAddingAbatement(true); setNewAbatement(BLANK_ABATEMENT); }}
                      disabled={addingAbatement}
                    >
                      <Plus className="h-3 w-3" /> Add
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {detail.abatements?.map((ab: any) => (
                      editingAbatementId === ab.id ? (
                        <div key={ab.id} className="rounded-lg border p-3 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[10px]">Type</Label>
                              <Select value={editAbatementForm.abatementType} onValueChange={(v) => setEditAbatementForm(a => ({ ...a, abatementType: v }))}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="FREE_RENT">Free Rent</SelectItem>
                                  <SelectItem value="PERCENT_DISCOUNT">Percent Discount</SelectItem>
                                  <SelectItem value="FIXED_CREDIT">Fixed Dollar Credit</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">Applies To</Label>
                              <Select value={editAbatementForm.appliesTo} onValueChange={(v) => setEditAbatementForm(a => ({ ...a, appliesTo: v }))}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="BASE_ONLY">Base Rent Only</SelectItem>
                                  <SelectItem value="BASE_PLUS_RECOVERIES">Base + Recoveries</SelectItem>
                                  <SelectItem value="ALL_CHARGES">All Charges</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">Start Date</Label>
                              <Input type="date" className="h-7 text-xs" value={editAbatementForm.startDate} onChange={(e) => setEditAbatementForm(a => ({ ...a, startDate: e.target.value }))} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">End Date</Label>
                              <Input type="date" className="h-7 text-xs" value={editAbatementForm.endDate} onChange={(e) => setEditAbatementForm(a => ({ ...a, endDate: e.target.value }))} />
                            </div>
                            {editAbatementForm.abatementType !== 'FREE_RENT' && (
                              <div className="space-y-1 col-span-2">
                                <Label className="text-[10px]">{editAbatementForm.abatementType === 'PERCENT_DISCOUNT' ? 'Discount (%)' : 'Credit Amount ($)'}</Label>
                                <Input type="number" step="0.01" className="h-7 text-xs" value={editAbatementForm.value} onChange={(e) => setEditAbatementForm(a => ({ ...a, value: e.target.value }))} />
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" className="h-7 text-xs gap-1" disabled={updateAbatementMutation.isPending || !editAbatementForm.startDate || !editAbatementForm.endDate || (editAbatementForm.abatementType !== 'FREE_RENT' && !editAbatementForm.value)} onClick={() => updateAbatementMutation.mutate({ id: ab.id, data: editAbatementForm })}>
                              <Save className="h-3 w-3" /> {updateAbatementMutation.isPending ? 'Saving…' : 'Save'}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingAbatementId(null)}>Cancel</Button>
                          </div>
                          {updateAbatementMutation.isError && <p className="text-[10px] text-red-600">{(updateAbatementMutation.error as Error)?.message}</p>}
                        </div>
                      ) : (
                        <div key={ab.id} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-medium capitalize">{ab.abatementType?.replace(/_/g, ' ')}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                {fmtDate(ab.startDate)} – {fmtDate(ab.endDate)} · Applies to: {ab.appliesTo?.replace(/_/g, ' ')}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {ab.abatementType === 'FREE_RENT' ? 'Free Rent'
                                  : ab.abatementType === 'PERCENT_DISCOUNT' ? `${parseFloat(ab.value || '0').toFixed(1)}% discount`
                                  : `$${parseFloat(ab.value || '0').toFixed(2)} credit`}
                              </Badge>
                              <Button
                                variant="ghost" size="sm"
                                className="h-6 w-6 p-0 text-gray-400 hover:text-blue-500"
                                onClick={() => {
                                  setEditingAbatementId(ab.id);
                                  setEditAbatementForm({
                                    abatementType: ab.abatementType || 'FREE_RENT',
                                    startDate: ab.startDate?.slice(0, 10) || '',
                                    endDate: ab.endDate?.slice(0, 10) || '',
                                    appliesTo: ab.appliesTo || 'BASE_ONLY',
                                    value: ab.value || '',
                                  });
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                                disabled={deleteAbatementMutation.isPending}
                                onClick={() => ab.id && deleteAbatementMutation.mutate(ab.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    ))}
                    {addingAbatement && (
                      <div className="rounded-lg border p-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px]">Type</Label>
                            <Select value={newAbatement.abatementType} onValueChange={(v) => setNewAbatement(a => ({ ...a, abatementType: v }))}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="FREE_RENT">Free Rent</SelectItem>
                                <SelectItem value="PERCENT_DISCOUNT">Percent Discount</SelectItem>
                                <SelectItem value="FIXED_CREDIT">Fixed Dollar Credit</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">Applies To</Label>
                            <Select value={newAbatement.appliesTo} onValueChange={(v) => setNewAbatement(a => ({ ...a, appliesTo: v }))}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="BASE_ONLY">Base Rent Only</SelectItem>
                                <SelectItem value="BASE_PLUS_RECOVERIES">Base + Recoveries</SelectItem>
                                <SelectItem value="ALL_CHARGES">All Charges</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">Start Date</Label>
                            <Input type="date" className="h-7 text-xs" value={newAbatement.startDate} onChange={(e) => setNewAbatement(a => ({ ...a, startDate: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px]">End Date</Label>
                            <Input type="date" className="h-7 text-xs" value={newAbatement.endDate} onChange={(e) => setNewAbatement(a => ({ ...a, endDate: e.target.value }))} />
                          </div>
                          {newAbatement.abatementType !== 'FREE_RENT' && (
                            <div className="space-y-1 col-span-2">
                              <Label className="text-[10px]">{newAbatement.abatementType === 'PERCENT_DISCOUNT' ? 'Discount (%)' : 'Credit Amount ($)'} <span className="text-red-500">*</span></Label>
                              <Input type="number" step="0.01" className="h-7 text-xs" placeholder="e.g. 5.0" value={newAbatement.value} onChange={(e) => setNewAbatement(a => ({ ...a, value: e.target.value }))} />
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" className="h-7 text-xs gap-1" disabled={addAbatementMutation.isPending || !newAbatement.startDate || !newAbatement.endDate || (newAbatement.abatementType !== 'FREE_RENT' && !newAbatement.value)} onClick={() => addAbatementMutation.mutate(newAbatement)}>
                            <Save className="h-3 w-3" /> {addAbatementMutation.isPending ? 'Saving…' : 'Save Abatement'}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAddingAbatement(false)}>
                            Cancel
                          </Button>
                        </div>
                        {addAbatementMutation.isError && (
                          <p className="text-[10px] text-red-600">{(addAbatementMutation.error as Error)?.message}</p>
                        )}
                      </div>
                    )}
                    {!detail.abatements?.length && !addingAbatement && (
                      <p className="text-xs text-gray-400 italic">No abatements — click Add to create one.</p>
                    )}
                  </div>
                </div>

                {/* TI Programs */}
                {detail.tiPrograms?.length > 0 && (
                  <div className="mb-5">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Building className="h-3.5 w-3.5" /> Tenant Improvement (TI)
                    </h3>
                    {detail.tiPrograms.map((ti: any) => (
                      <div key={ti.id} className="rounded-lg border p-3 space-y-2">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Allowance</p>
                            <p className="text-sm font-medium">
                              ${parseFloat(ti.allowanceValue || '0').toFixed(2)}
                              <span className="text-xs text-gray-400 ml-1">{ti.allowanceMode === 'PER_SF' ? 'PSF' : 'total'}</span>
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Amortization</p>
                            <p className="text-sm font-medium">
                              {ti.amortizeEnabled
                                ? `${ti.amortizeTermMonths}mo @ ${parseFloat(ti.amortizeRateAnnual || '0').toFixed(2)}%`
                                : 'None'}
                            </p>
                          </div>
                        </div>
                        {ti.draws?.length > 0 && (
                          <div>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Draws ({ti.draws.length})</p>
                            <div className="space-y-1">
                              {ti.draws.map((draw: any) => (
                                <div key={draw.id} className="flex justify-between text-xs">
                                  <span className="text-gray-500">{fmtDate(draw.drawDate)}</span>
                                  <span className="font-medium">${parseFloat(draw.amount || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Recovery Models */}
                {detail.recoveryModels?.length > 0 && (
                  <div className="mb-5">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5" /> Recovery Model
                    </h3>
                    {detail.recoveryModels.map((rm: any) => (
                      <div key={rm.id} className="rounded-lg border p-3 space-y-2">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Tenant Share</p>
                            <p className="text-xs font-medium">
                              {rm.tenantShareMode === 'BY_SF' ? 'Pro-rata by SF' : `${parseFloat(rm.tenantSharePercent || '0').toFixed(2)}% fixed`}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Billing</p>
                            <p className="text-xs font-medium">{rm.billingTiming?.replace(/_/g, ' ')}</p>
                          </div>
                          {rm.baseYear && (
                            <div>
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Base Year</p>
                              <p className="text-xs font-medium">{rm.baseYear}</p>
                            </div>
                          )}
                          {rm.grossupEnabled && (
                            <div>
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Gross-up</p>
                              <p className="text-xs font-medium">{parseFloat(rm.grossupOccupancyThreshold || '0.95') * 100}% threshold</p>
                            </div>
                          )}
                        </div>
                        {rm.categories?.length > 0 && (
                          <div>
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Categories</p>
                            <div className="flex flex-wrap gap-1">
                              {rm.categories.map((cat: any) => (
                                <Badge key={cat.id} variant="outline" className="text-[10px]">
                                  {cat.category} — {cat.stopType?.replace(/_/g, ' ') || 'None'}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Notes */}
                {detail.notes && (
                  <div className="mb-5">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" /> Notes
                    </h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{detail.notes}</p>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-64">
            <p className="text-sm text-gray-500">Lease details unavailable</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function PropertyLeasesTab({ propertyId }: { propertyId: string }) {
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  const { data, isLoading } = useQuery<{ data: any[]; total: number }>({
    queryKey: ['property-leases', propertyId, showInactive],
    queryFn: async () => {
      const params = new URLSearchParams({
        propertyId,
        limit: '100',
        sortBy: 'tenantName',
        sortDir: 'asc',
        ...(showInactive ? {} : { status: 'active' }),
      });
      const res = await apiRequest('GET', `/api/commercial-leases/operations/leases?${params}`);
      return res.json();
    },
    enabled: !!propertyId,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalLeases: number;
    activeLeases: number;
    totalSf: number;
    avgRentPerSf: number;
  }>({
    queryKey: ['property-lease-stats', propertyId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/commercial-leases/operations/stats?propertyId=${propertyId}`);
      return res.json();
    },
    enabled: !!propertyId,
  });

  const leases = data?.data || [];

  const occupancyPct = stats && stats.totalLeases > 0
    ? Math.round((stats.activeLeases / stats.totalLeases) * 100)
    : null;

  return (
    <div className="space-y-3">
      {/* Rent Roll Summary Card */}
      {statsLoading && (
        <Card className="shadow-sm">
          <CardContent className="p-4">
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      )}
      {!statsLoading && stats && (
        <Card className="shadow-sm border-blue-100 dark:border-blue-900 bg-gradient-to-r from-blue-50/60 to-white dark:from-blue-950/30 dark:to-gray-900">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Total Tenants</span>
                <span className="text-xl font-bold text-gray-900 dark:text-gray-100">{stats.activeLeases}</span>
                <span className="text-[10px] text-gray-400">{stats.totalLeases} total leases</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Total SF</span>
                <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.totalSf != null
                    ? stats.totalSf.toLocaleString('en-US', { maximumFractionDigits: 0 })
                    : '—'}
                </span>
                <span className="text-[10px] text-gray-400">leased square feet</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Occupancy</span>
                <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {occupancyPct !== null ? `${occupancyPct}%` : '—'}
                </span>
                <span className="text-[10px] text-gray-400">active / total leases</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Avg Rent PSF</span>
                <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {stats.avgRentPerSf != null
                    ? `$${Number(stats.avgRentPerSf).toFixed(2)}`
                    : '—'}
                </span>
                <span className="text-[10px] text-gray-400">per sq ft / year</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {showInactive ? 'All Leases' : 'Active Leases'}
          </span>
          {data && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{data.total}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowInactive(!showInactive)}
            className="text-xs text-gray-500 h-7"
          >
            {showInactive ? 'Hide inactive' : 'Show all'}
          </Button>
          <Button
            size="sm"
            onClick={() => setAddSheetOpen(true)}
            className="h-7 gap-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" /> Add Lease
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-3"><Skeleton className="h-12 w-full" /></CardContent></Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && leases.length === 0 && (
        <EmptyState
          icon={Building2}
          title="No leases on record"
          subtitle="Lease data will appear here once leases are added for this property."
        />
      )}

      {/* Lease Table */}
      {!isLoading && leases.length > 0 && (
        <Card className="shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                <TableHead className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Tenant</TableHead>
                <TableHead className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Suite</TableHead>
                <TableHead className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">SF</TableHead>
                <TableHead className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Type</TableHead>
                <TableHead className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Term</TableHead>
                <TableHead className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Rent PSF</TableHead>
                <TableHead className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leases.map((lease: any) => (
                <TableRow
                  key={lease.id}
                  className="cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors"
                  onClick={() => setSelectedLeaseId(lease.id)}
                >
                  <TableCell className="font-medium text-sm py-2.5">{lease.tenantName}</TableCell>
                  <TableCell className="text-xs text-gray-500 py-2.5">{lease.suite || '—'}</TableCell>
                  <TableCell className="text-xs py-2.5">{fmtSf(lease.sf)}</TableCell>
                  <TableCell className="py-2.5">
                    {lease.leaseType ? (
                      <Badge variant="outline" className={cn('text-[10px] capitalize', leaseTypeColors[lease.leaseType] || '')}>
                        {lease.leaseType}
                      </Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500 py-2.5">
                    {fmtDate(lease.commencementDate)} – {fmtDate(lease.expirationDate)}
                  </TableCell>
                  <TableCell className="text-xs font-medium py-2.5">
                    {fmtRentPsf(lease.firstTermRent || null)}
                  </TableCell>
                  <TableCell className="py-2.5">
                    <Badge
                      variant="outline"
                      className={lease.active
                        ? 'text-[10px] bg-green-50 text-green-700 border-green-200'
                        : 'text-[10px] bg-gray-50 text-gray-500'
                      }
                    >
                      {lease.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add Lease Sheet */}
      <AddLeaseSheet
        propertyId={propertyId}
        open={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
      />

      {/* Lease Detail / Edit Sheet */}
      {selectedLeaseId && (
        <LeaseDetailSheet
          leaseId={selectedLeaseId}
          propertyId={propertyId}
          open={!!selectedLeaseId}
          onClose={() => setSelectedLeaseId(null)}
        />
      )}
    </div>
  );
}

export function PropertyActivitiesTab({ propertyId }: { propertyId: string }) {
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('all');
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ['property-activities', propertyId, filter],
    queryFn: async () => {
      const params = new URLSearchParams({ entityType: 'property', entityId: propertyId, limit: '50' });
      if (filter !== 'all') params.set('status', filter);
      const res = await apiRequest('GET', `/api/crm/activities?${params}`);
      const arr = await res.json();
      return Array.isArray(arr) ? arr : arr.activities || [];
    },
  });
  const activities = data || [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['all', 'open', 'done'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('text-xs px-3 py-1.5 rounded-full border transition-colors',
                filter === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50')}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400">{activities.length} total</span>
      </div>
      {isLoading && <div className="space-y-2">{[...Array(4)].map((_, i) => <Card key={i}><CardContent className="p-3"><Skeleton className="h-10 w-full" /></CardContent></Card>)}</div>}
      {!isLoading && !activities.length && <EmptyState icon={Activity} title="No activities yet" subtitle="Log a site visit, call, or note to track activity on this property" />}
      {activities.map((act: any) => {
        const cfg = activityTypeConfig[act.type] || activityTypeConfig.note;
        const Icon = cfg.icon;
        const isDone = act.status === 'completed';
        const isOverdue = !isDone && act.scheduledAt && new Date(act.scheduledAt) < new Date();
        return (
          <Card key={act.id} className={cn(isDone && 'opacity-60')}>
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className={cn('rounded-lg p-2 shrink-0', cfg.bg)}><Icon className={cn('h-3.5 w-3.5', cfg.color)} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{act.subject}</p>
                    {isDone ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : isOverdue ? <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" /> : <Circle className="h-3.5 w-3.5 text-gray-300 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-400">
                    <span className="capitalize">{act.type?.replace(/_/g, ' ')}</span>
                    {act.scheduledAt && <span className={isOverdue ? 'text-red-500 font-medium' : ''}>{fmtDate(act.scheduledAt)}</span>}
                    {act.completedAt && <span className="text-emerald-500">Done {fmtDate(act.completedAt)}</span>}
                  </div>
                  {act.notes && <p className="text-xs text-gray-500 mt-1 line-clamp-1">{act.notes}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
