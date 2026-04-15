/**
 * WorkspaceDealComparison
 * Side-by-side financial model comparison for 2-6 deals.
 * Used in the workspace Analysis group and as a standalone page.
 */

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Plus, X, Copy, Check, Scale, BarChart3, TrendingUp, Layers, FileText, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { Deal } from '@shared/schema';
import { getAssetClassConfig } from '@/components/crm/asset-class-fields';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DealComparisonDeal {
  dealId: string;
  dealName: string;
  assetClass: string;
  stage: string;
  amount: number | null;
  closeDate: string | null;
  modelingProjectId: string | null;
  crmMetrics: Record<string, unknown>;
  proForma: {
    purchasePrice: number;
    noi: number[];
    totalRevenue: number[];
    totalExpenses: number[];
    capRate: number;
    indicatedValue: number;
  } | null;
  returns: {
    irr: number;
    equityMultiple: number;
    cashOnCash: number;
    indicatedValue: number;
  } | null;
  capitalStack: {
    totalCapitalization: number;
    totalDebt: number;
    totalEquity: number;
    ltv: number;
    blendedDebtRate: number;
    debtYield: number;
    holdPeriodYears: number;
    exitCapRate: number;
    tranches: { name: string; principal: number; interestRate: number; termYears: number }[];
  } | null;
  exitStrategy: {
    scenarioType: string | null;
    holdingPeriodYears: number;
    exitCapRate: number;
    projectedSalePrice: number;
    totalTaxLiability: number;
    irr: number;
    moic: number;
  } | null;
}

interface Props {
  projectId?: string;
  initialDealIds?: string[];
  onTabChange?: (tab: string) => void;
  pinnedDealId?: string;
}

// ─── Color Palette ────────────────────────────────────────────────────────────

const DEAL_COLORS = [
  '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#f59e0b', '#06b6d4',
];

const DEAL_BG = [
  'bg-blue-500/10 border-blue-400',
  'bg-emerald-500/10 border-emerald-400',
  'bg-red-500/10 border-red-400',
  'bg-violet-500/10 border-violet-400',
  'bg-amber-500/10 border-amber-400',
  'bg-cyan-500/10 border-cyan-400',
];

// ─── Metric Definitions ───────────────────────────────────────────────────────

const HIGHER_IS_BETTER_METRICS = new Set([
  'irr', 'equityMultiple', 'cashOnCash', 'indicatedValue',
  'debtYield', 'noi1', 'totalRevenue1', 'moic',
]);
const LOWER_IS_BETTER_METRICS = new Set([
  'purchasePrice', 'ltv', 'blendedDebtRate', 'exitCapRate', 'totalTaxLiability',
]);

// ─── Utilities ────────────────────────────────────────────────────────────────

function fmtCurrency(val: number | null | undefined, compact = false): string {
  if (val == null || isNaN(val)) return '—';
  if (compact) {
    if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
    return `$${val.toFixed(0)}`;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
}

function fmtPct(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return '—';
  return `${(val * 100).toFixed(2)}%`;
}

function fmtMultiple(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return '—';
  return `${val.toFixed(2)}x`;
}

function fmtNum(val: number | null | undefined, decimals = 2): string {
  if (val == null || isNaN(val)) return '—';
  return val.toFixed(decimals);
}

function computeBestWorst(
  values: (number | null)[],
  higherIsBetter: boolean,
): { bestIdx: number | null; worstIdx: number | null } {
  const valid = values.map((v, i) => ({ v, i })).filter((x) => x.v != null && !isNaN(x.v!));
  if (valid.length < 2) return { bestIdx: null, worstIdx: null };
  let best = valid[0], worst = valid[0];
  valid.forEach((x) => {
    if (higherIsBetter) {
      if (x.v! > best.v!) best = x;
      if (x.v! < worst.v!) worst = x;
    } else {
      if (x.v! < best.v!) best = x;
      if (x.v! > worst.v!) worst = x;
    }
  });
  if (best.v === worst.v) return { bestIdx: null, worstIdx: null };
  return { bestIdx: best.i, worstIdx: worst.i };
}

function normalizeForRadar(values: (number | null)[]): number[] {
  const valid = values.filter((v) => v != null && !isNaN(v!)) as number[];
  if (valid.length === 0) return values.map(() => 50);
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  if (max === min) return values.map(() => 50);
  return values.map((v) => (v == null || isNaN(v) ? 0 : ((v - min) / (max - min)) * 100));
}

// ─── Metric Row ───────────────────────────────────────────────────────────────

function MetricRow({
  label,
  values,
  format,
  higherIsBetter,
  neutral,
}: {
  label: string;
  values: (number | null)[];
  format: (v: number | null) => string;
  higherIsBetter?: boolean;
  neutral?: boolean;
}) {
  const { bestIdx, worstIdx } = neutral
    ? { bestIdx: null, worstIdx: null }
    : computeBestWorst(values, higherIsBetter ?? true);

  return (
    <tr className="border-t hover:bg-muted/20">
      <td className="py-2.5 px-4 text-xs text-muted-foreground font-medium whitespace-nowrap">{label}</td>
      {values.map((v, i) => (
        <td
          key={i}
          className={cn(
            'py-2.5 px-4 text-xs font-mono font-semibold text-right tabular-nums',
            bestIdx === i && v != null && 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30',
            worstIdx === i && v != null && 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30',
          )}
        >
          {format(v)}
          {bestIdx === i && v != null && <span className="ml-1 text-[9px] text-green-500">★</span>}
        </td>
      ))}
    </tr>
  );
}

function MetricSection({
  title,
  rows,
  deals,
}: {
  title: string;
  rows: { label: string; values: (number | null)[]; format: (v: number | null) => string; higherIsBetter?: boolean; neutral?: boolean }[];
  deals: DealComparisonDeal[];
}) {
  const hasData = rows.some((r) => r.values.some((v) => v != null));
  if (!hasData) return null;
  return (
    <Card>
      <CardHeader className="py-2.5 px-4 bg-muted/30">
        <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="py-2 px-4 text-left text-[10px] font-medium text-muted-foreground uppercase w-[180px]">Metric</th>
              {deals.map((d, i) => (
                <th key={d.dealId} className="py-2 px-4 text-right text-[10px] font-medium uppercase" style={{ color: DEAL_COLORS[i] }}>
                  {d.dealName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <MetricRow key={ri} {...row} />
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ─── Deal Selector ────────────────────────────────────────────────────────────

function getDealDisplayName(deal: DealComparisonDeal | Deal | { dealId: string; dealName: string }): string {
  if ('dealName' in deal && deal.dealName) return deal.dealName;
  if ('title' in deal && deal.title) return deal.title;
  if ('name' in deal && (deal as { name?: string }).name) return (deal as { name?: string }).name!;
  return 'Untitled';
}

interface FallbackDeal {
  dealId: string;
  dealName: string;
}

function DealChip({
  deal,
  index,
  pinned,
  onRemove,
}: {
  deal: DealComparisonDeal | Deal | FallbackDeal;
  index: number;
  pinned?: boolean;
  onRemove?: () => void;
}) {
  const name = getDealDisplayName(deal);
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium',
        DEAL_BG[index % DEAL_BG.length],
      )}
    >
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: DEAL_COLORS[index % DEAL_COLORS.length] }} />
      <span className="max-w-[120px] truncate">{name}</span>
      {pinned && <span className="text-[9px] text-muted-foreground">(current)</span>}
      {!pinned && onRemove && (
        <button onClick={onRemove} className="ml-0.5 hover:text-destructive transition-colors">
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WorkspaceDealComparison({ projectId, initialDealIds, onTabChange, pinnedDealId }: Props) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>(initialDealIds || []);
  const [addOpen, setAddOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [copied, setCopied] = useState(false);
  const [compareData, setCompareData] = useState<DealComparisonDeal[] | null>(null);
  const [comparing, setComparing] = useState(false);

  // Sync when initialDealIds prop changes (e.g., from URL query params or workspace project lookup)
  useEffect(() => {
    if (initialDealIds && initialDealIds.length > 0) {
      setSelectedIds((prev) => {
        const merged = [...new Set([...initialDealIds, ...prev])].slice(0, 6);
        return merged;
      });
    }
  }, [initialDealIds?.join(',')]);

  const { data: allDeals = [] } = useQuery<Deal[]>({ queryKey: ['/api/deals'] });

  const canCompare = selectedIds.length >= 2;

  const addDeal = (id: string) => {
    if (selectedIds.length >= 6) {
      toast({ title: 'Maximum 6 deals', description: 'Remove one before adding another.', variant: 'destructive' });
      return;
    }
    if (!selectedIds.includes(id)) setSelectedIds([...selectedIds, id]);
    setAddOpen(false);
  };

  const removeDeal = (id: string) => {
    if (id === pinnedDealId) return;
    setSelectedIds(selectedIds.filter((d) => d !== id));
    setCompareData(null);
  };

  const handleCompare = async () => {
    if (!canCompare) return;
    setComparing(true);
    try {
      const res = await apiRequest('POST', '/api/crm-v2/deals/compare-full', { dealIds: selectedIds });
      const json = await res.json();
      setCompareData(json.deals || []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not load deal data.';
      toast({ title: 'Comparison failed', description: msg, variant: 'destructive' });
    } finally {
      setComparing(false);
    }
  };

  const handleCopy = () => {
    if (!compareData) return;
    const header = ['Metric', ...compareData.map((d) => d.dealName)].join('\t');
    const rows = [
      ['IRR', ...compareData.map((d) => d.returns ? fmtPct(d.returns.irr) : '—')].join('\t'),
      ['Equity Multiple', ...compareData.map((d) => d.returns ? fmtMultiple(d.returns.equityMultiple) : '—')].join('\t'),
      ['Cash-on-Cash', ...compareData.map((d) => d.returns ? fmtPct(d.returns.cashOnCash) : '—')].join('\t'),
      ['LTV', ...compareData.map((d) => d.capitalStack ? fmtPct(d.capitalStack.ltv) : '—')].join('\t'),
      ['Indicated Value', ...compareData.map((d) => d.returns ? fmtCurrency(d.returns.indicatedValue) : '—')].join('\t'),
      ['Exit Cap Rate', ...compareData.map((d) => d.capitalStack ? fmtPct(d.capitalStack.exitCapRate) : '—')].join('\t'),
    ];
    navigator.clipboard.writeText([header, ...rows].join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Copied to clipboard', description: 'Paste into Excel or your IC deck.' });
  };

  const notInList = allDeals.filter((d) => !selectedIds.includes(String(d.id)));

  return (
    <div className="space-y-4">
      {/* Selector bar */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 py-3 px-4">
          <Scale className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-medium mr-1">Compare deals:</span>

          {selectedIds.map((id, i) => {
            const d = allDeals.find((x) => String(x.id) === id);
            const fallback: FallbackDeal = { dealId: id, dealName: id };
            if (!d) return <DealChip key={id} deal={fallback} index={i} pinned={id === pinnedDealId} onRemove={() => removeDeal(id)} />;
            return <DealChip key={id} deal={d} index={i} pinned={id === pinnedDealId} onRemove={() => removeDeal(id)} />;
          })}

          {selectedIds.length < 6 && (
            <Popover open={addOpen} onOpenChange={setAddOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                  <Plus className="h-3.5 w-3.5" /> Add Deal
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search deals…" />
                  <CommandList>
                    <CommandEmpty>No deals found.</CommandEmpty>
                    <CommandGroup>
                      {notInList.slice(0, 30).map((deal) => {
                        const ac = deal.assetClass || 'marina';
                        const cfg = getAssetClassConfig(ac);
                        const hasModel = !!deal.modelingProjectId;
                        return (
                          <CommandItem
                            key={deal.id}
                            value={`${deal.name} ${deal.id}`}
                            onSelect={() => hasModel ? addDeal(String(deal.id)) : undefined}
                            className={cn('gap-2', hasModel ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed')}
                            disabled={!hasModel}
                          >
                            <Badge className={cn('text-[9px] px-1 py-0', cfg.color, cfg.textColor)}>
                              {cfg.label.slice(0, 3)}
                            </Badge>
                            <span className="flex-1 truncate text-sm">{deal.name || 'Untitled'}</span>
                            {!hasModel && (
                              <Badge variant="outline" className="text-[9px] px-1">No Model</Badge>
                            )}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}

          <div className="ml-auto flex items-center gap-2">
            {compareData && (
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={handleCopy}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy Table'}
              </Button>
            )}
            <Button
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={handleCompare}
              disabled={!canCompare || comparing}
            >
              {comparing ? 'Loading…' : 'Compare'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Empty state */}
      {!compareData && !comparing && (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-lg">
          <Scale className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="font-medium text-muted-foreground">Select 2–6 deals to compare</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            Add deals above, then click Compare to see side-by-side financial metrics
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {comparing && (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}

      {/* Comparison tabs */}
      {compareData && compareData.length >= 1 && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-4 max-w-2xl">
            <TabsTrigger value="overview" className="gap-1.5 text-xs">
              <BarChart3 className="h-3.5 w-3.5" /> Overview
            </TabsTrigger>
            <TabsTrigger value="proforma" className="gap-1.5 text-xs">
              <TrendingUp className="h-3.5 w-3.5" /> Pro Forma
            </TabsTrigger>
            <TabsTrigger value="capital" className="gap-1.5 text-xs">
              <Layers className="h-3.5 w-3.5" /> Capital & Returns
            </TabsTrigger>
            <TabsTrigger value="details" className="gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" /> Deal Details
            </TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Overview ─────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-6 mt-4">
            <OverviewTab deals={compareData} />
          </TabsContent>

          {/* ── Tab 2: Pro Forma ────────────────────────────────────── */}
          <TabsContent value="proforma" className="space-y-6 mt-4">
            <ProFormaTab deals={compareData} />
          </TabsContent>

          {/* ── Tab 3: Capital & Returns ────────────────────────────── */}
          <TabsContent value="capital" className="space-y-6 mt-4">
            <CapitalReturnsTab deals={compareData} />
          </TabsContent>

          {/* ── Tab 4: Deal Details ─────────────────────────────────── */}
          <TabsContent value="details" className="space-y-6 mt-4">
            <DealDetailsTab deals={compareData} navigate={navigate} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ deals }: { deals: DealComparisonDeal[] }) {
  const radarData = useMemo(() => {
    const axes = [
      { key: 'irr', label: 'IRR', vals: deals.map((d) => d.returns?.irr ?? null) },
      { key: 'equityMultiple', label: 'Equity Multiple', vals: deals.map((d) => d.returns?.equityMultiple ?? null) },
      { key: 'cashOnCash', label: 'Cash-on-Cash', vals: deals.map((d) => d.returns?.cashOnCash ?? null) },
      { key: 'debtYield', label: 'Debt Yield', vals: deals.map((d) => d.capitalStack?.debtYield ?? null) },
      { key: 'capRate', label: 'Cap Rate', vals: deals.map((d) => d.proForma?.capRate ?? null) },
      { key: 'noi', label: 'NOI', vals: deals.map((d) => d.proForma?.noi?.[0] ?? null) },
    ];
    return axes.map((axis) => {
      const normalized = normalizeForRadar(axis.vals);
      const entry: Record<string, number | string> = { metric: axis.label };
      deals.forEach((d, i) => { entry[d.dealName] = normalized[i]; });
      return entry;
    });
  }, [deals]);

  const hasReturns = deals.some((d) => d.returns);

  return (
    <>
      {/* Radar chart */}
      {hasReturns && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Performance Overview (Normalized 0–100)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                {deals.map((d, i) => (
                  <Radar
                    key={d.dealId}
                    name={d.dealName}
                    dataKey={d.dealName}
                    stroke={DEAL_COLORS[i]}
                    fill={DEAL_COLORS[i]}
                    fillOpacity={0.15}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Key metrics grid */}
      <MetricSection
        title="Returns"
        deals={deals}
        rows={[
          { label: 'IRR', values: deals.map((d) => d.returns?.irr ?? null), format: fmtPct, higherIsBetter: true },
          { label: 'Equity Multiple', values: deals.map((d) => d.returns?.equityMultiple ?? null), format: fmtMultiple, higherIsBetter: true },
          { label: 'Cash-on-Cash', values: deals.map((d) => d.returns?.cashOnCash ?? null), format: fmtPct, higherIsBetter: true },
          { label: 'Indicated Value', values: deals.map((d) => d.returns?.indicatedValue ?? null), format: (v) => fmtCurrency(v), higherIsBetter: true },
        ]}
      />

      <MetricSection
        title="Property & Financing"
        deals={deals}
        rows={[
          { label: 'Purchase Price', values: deals.map((d) => d.proForma?.purchasePrice ?? null), format: (v) => fmtCurrency(v), higherIsBetter: false },
          { label: 'Year 1 NOI', values: deals.map((d) => d.proForma?.noi?.[0] ?? null), format: (v) => fmtCurrency(v), higherIsBetter: true },
          { label: 'Going-In Cap Rate', values: deals.map((d) => d.proForma?.capRate ?? null), format: fmtPct, higherIsBetter: true },
          { label: 'LTV', values: deals.map((d) => d.capitalStack?.ltv ?? null), format: fmtPct, higherIsBetter: false },
          { label: 'Debt Yield', values: deals.map((d) => d.capitalStack?.debtYield ?? null), format: fmtPct, higherIsBetter: true },
        ]}
      />

      <MetricSection
        title="Exit"
        deals={deals}
        rows={[
          { label: 'Exit Cap Rate', values: deals.map((d) => d.exitStrategy?.exitCapRate ?? d.capitalStack?.exitCapRate ?? null), format: fmtPct, higherIsBetter: false },
          { label: 'Hold Period (yrs)', values: deals.map((d) => d.exitStrategy?.holdingPeriodYears ?? d.capitalStack?.holdPeriodYears ?? null), format: (v) => fmtNum(v, 0), neutral: true },
          { label: 'Projected Sale Price', values: deals.map((d) => d.exitStrategy?.projectedSalePrice ?? null), format: (v) => fmtCurrency(v), higherIsBetter: true },
          { label: 'Exit IRR', values: deals.map((d) => d.exitStrategy?.irr ?? null), format: fmtPct, higherIsBetter: true },
        ]}
      />

      {/* Deal cards */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(deals.length, 3)}, 1fr)` }}>
        {deals.map((d, i) => {
          const cfg = getAssetClassConfig(d.assetClass || 'marina');
          const Icon = cfg.icon;
          return (
            <Card key={d.dealId} className={cn('border-t-2', DEAL_BG[i % DEAL_BG.length])}>
              <CardContent className="pt-3 pb-3 px-4 space-y-2">
                <div className="flex items-start gap-2">
                  <div className={cn('w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0', cfg.color)}>
                    <Icon className={cn('h-3.5 w-3.5', cfg.textColor)} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight">{d.dealName}</p>
                    <p className="text-xs text-muted-foreground">{d.amount ? fmtCurrency(d.amount, true) : '—'}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge className={cn('text-[9px] px-1.5', cfg.color, cfg.textColor)}>{cfg.label}</Badge>
                  <Badge variant="outline" className="text-[9px] px-1.5 capitalize">{d.stage || 'Open'}</Badge>
                  {!d.modelingProjectId && (
                    <Badge variant="secondary" className="text-[9px] px-1.5">No Model</Badge>
                  )}
                </div>
                {d.closeDate && (
                  <p className="text-[10px] text-muted-foreground">Close: {d.closeDate}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}

// ─── Pro Forma Tab ────────────────────────────────────────────────────────────

function ProFormaTab({ deals }: { deals: DealComparisonDeal[] }) {
  const maxYears = useMemo(() =>
    Math.max(...deals.map((d) => d.proForma?.noi?.length ?? 0)), [deals]
  );

  const noiTrendData = useMemo(() => {
    if (maxYears === 0) return [];
    return Array.from({ length: maxYears }, (_, yi) => {
      const entry: Record<string, number | string | null> = { year: `Y${yi + 1}` };
      deals.forEach((d) => {
        entry[d.dealName] = d.proForma?.noi?.[yi] ?? null;
      });
      return entry;
    });
  }, [deals, maxYears]);

  const hasPF = deals.some((d) => d.proForma);

  if (!hasPF) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-30" />
        <p>No pro forma data available for the selected deals.</p>
      </div>
    );
  }

  return (
    <>
      {/* NOI Trend */}
      {noiTrendData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">NOI Trend by Year</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={noiTrendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => fmtCurrency(v, true)} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number | string) => fmtCurrency(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {deals.map((d, i) => (
                  <Line
                    key={d.dealId}
                    type="monotone"
                    dataKey={d.dealName}
                    stroke={DEAL_COLORS[i]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Revenue & Expense Comparison */}
      <MetricSection
        title="Pro Forma Snapshot"
        deals={deals}
        rows={[
          { label: 'Purchase Price', values: deals.map((d) => d.proForma?.purchasePrice ?? null), format: (v) => fmtCurrency(v), higherIsBetter: false },
          { label: 'Year 1 Revenue', values: deals.map((d) => d.proForma?.totalRevenue?.[0] ?? null), format: (v) => fmtCurrency(v), higherIsBetter: true },
          { label: 'Year 1 Expenses', values: deals.map((d) => d.proForma?.totalExpenses?.[0] ?? null), format: (v) => fmtCurrency(v), higherIsBetter: false },
          { label: 'Year 1 NOI', values: deals.map((d) => d.proForma?.noi?.[0] ?? null), format: (v) => fmtCurrency(v), higherIsBetter: true },
          { label: 'Going-In Cap Rate', values: deals.map((d) => d.proForma?.capRate ?? null), format: fmtPct, higherIsBetter: true },
          { label: 'Indicated Value', values: deals.map((d) => d.proForma?.indicatedValue ?? null), format: (v) => fmtCurrency(v), higherIsBetter: true },
          ...(maxYears >= 3 ? [
            { label: 'Year 3 NOI', values: deals.map((d) => d.proForma?.noi?.[2] ?? null), format: (v: number | null) => fmtCurrency(v), higherIsBetter: true as const },
          ] : []),
          ...(maxYears >= 5 ? [
            { label: 'Year 5 NOI', values: deals.map((d) => d.proForma?.noi?.[4] ?? null), format: (v: number | null) => fmtCurrency(v), higherIsBetter: true as const },
          ] : []),
        ]}
      />
    </>
  );
}

// ─── Capital & Returns Tab ────────────────────────────────────────────────────

function CapitalReturnsTab({ deals }: { deals: DealComparisonDeal[] }) {
  const capitalStackData = useMemo(() => deals.map((d) => ({
    name: d.dealName,
    Equity: d.capitalStack?.totalEquity ?? 0,
    Debt: d.capitalStack?.totalDebt ?? 0,
  })), [deals]);

  const hasCS = deals.some((d) => d.capitalStack);
  const hasReturns = deals.some((d) => d.returns);

  return (
    <>
      {/* Capital stack chart */}
      {hasCS && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Capital Structure</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={capitalStackData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tickFormatter={(v) => fmtCurrency(v, true)} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(v: number | string) => fmtCurrency(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Equity" stackId="a" fill="#3b82f6" />
                <Bar dataKey="Debt" stackId="a" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {hasReturns && (
        <MetricSection
          title="Returns"
          deals={deals}
          rows={[
            { label: 'IRR', values: deals.map((d) => d.returns?.irr ?? null), format: fmtPct, higherIsBetter: true },
            { label: 'Equity Multiple', values: deals.map((d) => d.returns?.equityMultiple ?? null), format: fmtMultiple, higherIsBetter: true },
            { label: 'Cash-on-Cash', values: deals.map((d) => d.returns?.cashOnCash ?? null), format: fmtPct, higherIsBetter: true },
            { label: 'Indicated Value', values: deals.map((d) => d.returns?.indicatedValue ?? null), format: (v) => fmtCurrency(v), higherIsBetter: true },
          ]}
        />
      )}

      {hasCS && (
        <MetricSection
          title="Debt & Capital Stack"
          deals={deals}
          rows={[
            { label: 'Total Capitalization', values: deals.map((d) => d.capitalStack?.totalCapitalization ?? null), format: (v) => fmtCurrency(v), neutral: true },
            { label: 'Total Debt', values: deals.map((d) => d.capitalStack?.totalDebt ?? null), format: (v) => fmtCurrency(v), higherIsBetter: false },
            { label: 'Total Equity', values: deals.map((d) => d.capitalStack?.totalEquity ?? null), format: (v) => fmtCurrency(v), higherIsBetter: true },
            { label: 'LTV', values: deals.map((d) => d.capitalStack?.ltv ?? null), format: fmtPct, higherIsBetter: false },
            { label: 'Blended Rate', values: deals.map((d) => d.capitalStack?.blendedDebtRate ?? null), format: fmtPct, higherIsBetter: false },
            { label: 'Debt Yield', values: deals.map((d) => d.capitalStack?.debtYield ?? null), format: fmtPct, higherIsBetter: true },
            { label: 'Hold Period (yrs)', values: deals.map((d) => d.capitalStack?.holdPeriodYears ?? null), format: (v) => fmtNum(v, 0), neutral: true },
          ]}
        />
      )}

      {!hasCS && !hasReturns && (
        <div className="text-center py-16 text-muted-foreground">
          <Layers className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p>No capital stack or returns data available for the selected deals.</p>
        </div>
      )}
    </>
  );
}

// ─── Deal Details Tab ─────────────────────────────────────────────────────────

function DealDetailsTab({ deals, navigate }: { deals: DealComparisonDeal[]; navigate: (path: string) => void }) {
  return (
    <>
      <MetricSection
        title="CRM Overview"
        deals={deals}
        rows={[
          { label: 'Deal Value', values: deals.map((d) => d.amount), format: (v) => fmtCurrency(v), neutral: true },
          { label: 'Stage', values: [], format: () => '', neutral: true },
        ].filter((r) => r.values.length > 0 || r.label !== 'Stage')}
      />

      {/* Stage & links */}
      <Card>
        <CardHeader className="py-2.5 px-4 bg-muted/30">
          <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Stage & Links</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="py-2 px-4 text-left text-[10px] font-medium text-muted-foreground uppercase w-[180px]">Item</th>
                {deals.map((d, i) => (
                  <th key={d.dealId} className="py-2 px-4 text-right text-[10px] font-medium uppercase" style={{ color: DEAL_COLORS[i] }}>
                    {d.dealName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="py-2.5 px-4 text-xs text-muted-foreground font-medium">Pipeline Stage</td>
                {deals.map((d) => (
                  <td key={d.dealId} className="py-2.5 px-4 text-xs text-right">
                    <Badge variant="outline" className="text-[9px] px-1.5 capitalize">{d.stage || '—'}</Badge>
                  </td>
                ))}
              </tr>
              <tr className="border-t">
                <td className="py-2.5 px-4 text-xs text-muted-foreground font-medium">Close Date</td>
                {deals.map((d) => (
                  <td key={d.dealId} className="py-2.5 px-4 text-xs text-right tabular-nums">{d.closeDate || '—'}</td>
                ))}
              </tr>
              <tr className="border-t">
                <td className="py-2.5 px-4 text-xs text-muted-foreground font-medium">Model Linked</td>
                {deals.map((d) => (
                  <td key={d.dealId} className="py-2.5 px-4 text-xs text-right">
                    {d.modelingProjectId ? (
                      <button
                        onClick={() => navigate(`/modeling/projects/${d.modelingProjectId}`)}
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs"
                      >
                        Open <ExternalLink className="h-3 w-3" />
                      </button>
                    ) : (
                      <Badge variant="secondary" className="text-[9px]">No Model</Badge>
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-t">
                <td className="py-2.5 px-4 text-xs text-muted-foreground font-medium">Asset Class</td>
                {deals.map((d) => {
                  const cfg = getAssetClassConfig(d.assetClass || 'marina');
                  return (
                    <td key={d.dealId} className="py-2.5 px-4 text-xs text-right">
                      <Badge className={cn('text-[9px] px-1.5', cfg.color, cfg.textColor)}>{cfg.label}</Badge>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Exit strategy details */}
      <MetricSection
        title="Exit Strategy"
        deals={deals}
        rows={[
          { label: 'Scenario Type', values: [], format: () => '', neutral: true },
          { label: 'Hold Period (yrs)', values: deals.map((d) => d.exitStrategy?.holdingPeriodYears ?? null), format: (v) => fmtNum(v, 0), neutral: true },
          { label: 'Exit Cap Rate', values: deals.map((d) => d.exitStrategy?.exitCapRate ?? null), format: fmtPct, higherIsBetter: false },
          { label: 'Projected Sale Price', values: deals.map((d) => d.exitStrategy?.projectedSalePrice ?? null), format: (v) => fmtCurrency(v), higherIsBetter: true },
          { label: 'Tax Liability', values: deals.map((d) => d.exitStrategy?.totalTaxLiability ?? null), format: (v) => fmtCurrency(v), higherIsBetter: false },
          { label: 'Exit IRR', values: deals.map((d) => d.exitStrategy?.irr ?? null), format: fmtPct, higherIsBetter: true },
          { label: 'MOIC', values: deals.map((d) => d.exitStrategy?.moic ?? null), format: fmtMultiple, higherIsBetter: true },
        ].filter((r) => r.values.length > 0)}
      />
    </>
  );
}
