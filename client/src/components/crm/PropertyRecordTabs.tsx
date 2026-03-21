// PropertyRecordTabs.tsx — Sales Comps, Rate Comps, Market Intel, Activities tabs

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  MapPin, DollarSign, TrendingUp, Activity, Clock, ExternalLink,
  ChevronRight, Phone, Mail, Calendar, FileText, BarChart3,
  Newspaper, CheckCircle2, Circle, AlertCircle, MessageSquare,
  Anchor, Building2, ArrowUpRight, Scale, Home,
} from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
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
  try { return format(new Date(d), 'MMM d, yyyy'); } catch { return '—'; }
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
