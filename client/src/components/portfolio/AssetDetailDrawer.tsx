import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Building2, TrendingUp, DollarSign, FileText, Layers,
  ExternalLink, MapPin, Calendar, Percent, Landmark,
} from 'lucide-react';
import { Link } from 'wouter';

function fmt(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${n < 0 ? '-' : ''}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${n < 0 ? '-' : ''}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${n < 0 ? '-' : ''}$${(abs / 1e3).toFixed(0)}K`;
  return `${n < 0 ? '-' : ''}$${abs.toLocaleString()}`;
}

function pct(n: number): string {
  if (!n && n !== 0) return '—';
  return `${(n * 100).toFixed(2)}%`;
}

function mult(n: number): string {
  if (!n && n !== 0) return '—';
  return `${n.toFixed(2)}x`;
}

const ASSET_CLASS_COLORS: Record<string, string> = {
  marina: '#3b82f6', str: '#8b5cf6', multifamily: '#10b981',
  self_storage: '#f59e0b', laundromat: '#06b6d4', car_wash: '#06b6d4',
  retail: '#ec4899', office: '#64748b', hotel: '#f97316',
  mixed_use: '#84cc16', other: '#94a3b8',
};

function getAssetClassLabel(ac: string): string {
  const map: Record<string, string> = {
    marina: 'Marina', str: 'STR', multifamily: 'Multifamily',
    self_storage: 'Self Storage', laundromat: 'Laundromat', car_wash: 'Car Wash',
    retail: 'Retail', office: 'Office', hotel: 'Hotel',
    mixed_use: 'Mixed Use', other: 'Other',
  };
  return map[ac] || ac;
}

function getStatusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
    won: 'bg-emerald-100 text-emerald-800',
    under_contract: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
    pipeline: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    disposed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };
  return map[status] || map.active;
}

function KV({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-semibold ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
    </div>
  );
}

function OverviewTab({ data }: { data: any }) {
  const { project, t12, capitalStack, returns } = data;
  const holdElapsed = project.createdAt
    ? ((Date.now() - new Date(project.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 365)).toFixed(1)
    : '—';

  const valueHistory = returns.snapshots?.map((s: any) => ({
    date: new Date(s.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    value: s.value,
  })) || [];

  return (
    <div className="space-y-4">
      {/* Asset Snapshot */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Asset Snapshot</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <KV label="Status" value={project.status?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} />
            <KV label="Location" value={[project.city, project.state].filter(Boolean).join(', ')} />
            <KV label="Region" value={project.region} />
            <KV label="Purchase Price" value={fmt(project.purchasePrice)} mono />
            <KV label="Current Value" value={fmt(project.currentValue)} mono />
            <KV label="Unrealized Gain" value={`${fmt(project.unrealizedGain)} (${pct(project.gainPct)})`} />
            <KV label="Annual NOI (T12)" value={fmt(t12.noi)} mono />
            <KV label="EBITDA Margin" value={pct(t12.ebitdaMargin)} />
            <KV label="Cap Rate" value={pct(project.capRate / 100)} />
            <KV label="Units / Slips" value={project.totalUnits > 0 ? String(project.totalUnits) : '—'} />
            <KV label="Hold Elapsed" value={`${holdElapsed} yrs`} />
            <KV label="Asset Class" value={getAssetClassLabel(project.assetClass)} />
          </div>
        </CardContent>
      </Card>

      {/* Value History */}
      {valueHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Valuation History</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={valueHistory}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" fontSize={10} />
                <YAxis fontSize={10} tickFormatter={fmt} width={60} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Area type="monotone" dataKey="value" name="Est. Value"
                  stroke={ASSET_CLASS_COLORS[project.assetClass] || '#3b82f6'}
                  fill={ASSET_CLASS_COLORS[project.assetClass] || '#3b82f6'}
                  fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Recent Extractions */}
      {data.documents?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Recent AI Extractions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {data.documents.slice(0, 4).map((doc: any) => (
                <div key={doc.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{doc.filename}</p>
                    <p className="text-[10px] text-muted-foreground">{doc.docType?.replace(/_/g, ' ')} · {new Date(doc.uploadedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {doc.keyMetric && (
                      <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 rounded">
                        {doc.keyMetric}
                      </span>
                    )}
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                      {doc.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FinancialsTab({ data }: { data: any }) {
  const { t12, scenarios } = data;

  const lineItems = t12.lineItems || [];
  const revenue = lineItems.filter((r: any) => r.category === 'Revenue');
  const expenses = lineItems.filter((r: any) => r.category !== 'Revenue');

  const scenarioChartData = scenarios?.map((s: any) => ({
    scenario: s.type?.charAt(0).toUpperCase() + s.type?.slice(1),
    revGrowth: (s.revenueGrowthRate * 100).toFixed(1),
    exitCap: (s.exitCapRate * 100).toFixed(1),
    holdPeriod: s.holdPeriod,
  })) || [];

  return (
    <div className="space-y-4">
      {/* T12 Income Statement */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">T12 Income Statement</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {lineItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No actuals data. Upload a P&L document to populate.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Line Item</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                  <TableHead className="text-xs text-right">% Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revenue.map((r: any, i: number) => (
                  <TableRow key={i} className="text-xs">
                    <TableCell className="py-1.5">{r.label || r.category}</TableCell>
                    <TableCell className="text-right py-1.5 font-mono text-emerald-700 dark:text-emerald-400">{fmt(r.amount)}</TableCell>
                    <TableCell className="text-right py-1.5 text-muted-foreground">{pct(r.pctOfRevenue)}</TableCell>
                  </TableRow>
                ))}
                {expenses.map((r: any, i: number) => (
                  <TableRow key={i} className="text-xs">
                    <TableCell className="py-1.5 text-muted-foreground">{r.label || r.category}</TableCell>
                    <TableCell className="text-right py-1.5 font-mono text-red-600 dark:text-red-400">{fmt(-Math.abs(r.amount))}</TableCell>
                    <TableCell className="text-right py-1.5 text-muted-foreground">{pct(r.pctOfRevenue)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="text-xs font-semibold border-t-2">
                  <TableCell className="py-2">Net Operating Income</TableCell>
                  <TableCell className={`text-right py-2 font-mono ${t12.noi >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'}`}>{fmt(t12.noi)}</TableCell>
                  <TableCell className="text-right py-2 text-muted-foreground">{pct(t12.ebitdaMargin)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Scenario Assumptions */}
      {scenarioChartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Scenario Assumptions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Scenario</TableHead>
                  <TableHead className="text-xs text-right">Rev Growth</TableHead>
                  <TableHead className="text-xs text-right">Exit Cap</TableHead>
                  <TableHead className="text-xs text-right">Hold Period</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scenarioChartData.map((s: any, i: number) => (
                  <TableRow key={i} className="text-xs">
                    <TableCell className="py-1.5 font-medium">{s.scenario}</TableCell>
                    <TableCell className="text-right py-1.5 font-mono">{s.revGrowth}%</TableCell>
                    <TableCell className="text-right py-1.5 font-mono">{s.exitCap}%</TableCell>
                    <TableCell className="text-right py-1.5">{s.holdPeriod} yrs</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReturnsTab({ data }: { data: any }) {
  const { returns, project } = data;

  const purchasePrice = project.purchasePrice;
  const currentValue = project.currentValue;
  const totalEquity = data.capitalStack?.totalEquity || purchasePrice * 0.35;

  const dpi = 0;
  const rvpi = totalEquity > 0 ? (currentValue - (data.capitalStack?.totalDebt || 0)) / totalEquity : 0;
  const tvpi = dpi + rvpi;

  const kpis = [
    { label: 'Levered IRR', value: pct(returns.irr) },
    { label: 'Equity Multiple (MOIC)', value: mult(returns.moic) },
    { label: 'Cash-on-Cash', value: pct(returns.cashOnCash) },
    { label: 'RVPI', value: mult(rvpi), tip: 'Residual Value to Paid-In' },
    { label: 'TVPI', value: mult(tvpi), tip: 'Total Value to Paid-In' },
    { label: 'DPI', value: mult(dpi), tip: 'Distributions to Paid-In' },
    { label: 'Unrealized Gain', value: fmt(project.unrealizedGain) },
    { label: 'Return %', value: pct(project.gainPct) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{k.label}</p>
              <p className="text-base font-bold mt-0.5 font-mono">{k.value}</p>
              {k.tip && <p className="text-[10px] text-muted-foreground">{k.tip}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {returns.snapshots?.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">IRR Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={returns.snapshots.map((s: any) => ({
                date: new Date(s.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
                irr: (s.irr * 100),
              }))}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" fontSize={10} />
                <YAxis fontSize={10} tickFormatter={(v) => `${v.toFixed(1)}%`} width={40} />
                <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
                <Area type="monotone" dataKey="irr" name="IRR %" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CapitalStackTab({ data }: { data: any }) {
  const cs = data.capitalStack;

  if (!cs) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <Landmark className="h-10 w-10 mb-3 opacity-40" />
        <p className="font-medium text-sm">No capital stack</p>
        <p className="text-xs mt-1">Build a capital stack in the project workspace to see it here.</p>
        <Link href={`/modeling/projects/${data.project.id}`}>
          <Button size="sm" variant="outline" className="mt-3">Open Project →</Button>
        </Link>
      </div>
    );
  }

  const totalCap = cs.totalCapitalization || cs.purchasePrice || 1;

  const stackBars = [
    { label: 'Senior Debt', value: cs.tranches?.find((t: any) => t.trancheType === 'senior')?.principal || 0, color: '#ef4444' },
    { label: 'Mezz / Pref', value: cs.tranches?.find((t: any) => ['mezz', 'preferred'].includes(t.trancheType))?.principal || 0, color: '#f59e0b' },
    { label: 'Total Equity', value: cs.totalEquity || 0, color: '#10b981' },
  ].filter((b) => b.value > 0);

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total Debt', value: fmt(cs.totalDebt) },
          { label: 'Total Equity', value: fmt(cs.totalEquity) },
          { label: 'LTV', value: pct(cs.ltv) },
          { label: 'Blended Rate', value: pct(cs.blendedRate) },
          { label: 'Debt Yield / DSCR', value: cs.debtYield ? `${cs.debtYield.toFixed(2)}x` : '—' },
          { label: 'Hold Period', value: `${cs.holdPeriodYears} yrs` },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{k.label}</p>
              <p className="text-sm font-bold mt-0.5 font-mono">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stack Visual */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Capital Structure</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {stackBars.map((bar) => (
              <div key={bar.label}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="font-medium">{bar.label}</span>
                  <span className="font-mono">{fmt(bar.value)} ({pct(bar.value / totalCap)})</span>
                </div>
                <div className="h-3 rounded-full overflow-hidden bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, (bar.value / totalCap) * 100)}%`, backgroundColor: bar.color }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Debt Tranches Table */}
      {cs.tranches?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Debt Tranches</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Lender</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs text-right">Balance</TableHead>
                  <TableHead className="text-xs text-right">Rate</TableHead>
                  <TableHead className="text-xs text-right">Term</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cs.tranches.map((t: any, i: number) => (
                  <TableRow key={i} className="text-xs">
                    <TableCell className="py-1.5">{t.lenderName || 'Unknown'}</TableCell>
                    <TableCell className="py-1.5 capitalize">{t.trancheType}</TableCell>
                    <TableCell className="text-right py-1.5 font-mono">{fmt(t.principal)}</TableCell>
                    <TableCell className="text-right py-1.5 font-mono">
                      {pct(t.interestRate)}
                      {t.rateType === 'floating' && <span className="ml-1 text-[9px] text-amber-600">FLOAT</span>}
                    </TableCell>
                    <TableCell className="text-right py-1.5">{t.termYears}y</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DocumentsTab({ data }: { data: any }) {
  const docs = data.documents || [];

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <FileText className="h-10 w-10 mb-3 opacity-40" />
        <p className="font-medium text-sm">No documents yet</p>
        <p className="text-xs mt-1">Upload documents in the project workspace to see them here.</p>
        <Link href={`/modeling/projects/${data.project.id}`}>
          <Button size="sm" variant="outline" className="mt-3">Open Project →</Button>
        </Link>
      </div>
    );
  }

  const groups: Record<string, any[]> = {};
  for (const doc of docs) {
    const g = doc.docType || 'other';
    if (!groups[g]) groups[g] = [];
    groups[g].push(doc);
  }

  return (
    <div className="space-y-3">
      {Object.entries(groups).map(([type, typeDocs]) => (
        <Card key={type}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {type.replace(/_/g, ' ')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {typeDocs.map((doc) => (
                <div key={doc.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{doc.filename}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(doc.uploadedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {doc.keyMetric && (
                      <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400">
                        {doc.keyMetric}
                      </span>
                    )}
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize">
                      {doc.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface AssetDetailDrawerProps {
  projectId: string | null;
  onClose: () => void;
}

export function AssetDetailDrawer({ projectId, onClose }: AssetDetailDrawerProps) {
  const { data, isLoading, isError } = useQuery<any>({
    queryKey: ['/api/portfolio/assets', projectId, 'detail'],
    queryFn: async () => {
      const res = await fetch(`/api/portfolio/assets/${projectId}/detail`);
      if (!res.ok) throw new Error('Failed to fetch asset detail');
      return res.json();
    },
    enabled: !!projectId,
  });

  return (
    <Sheet open={!!projectId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:w-[680px] sm:max-w-[680px] overflow-y-auto p-0">
        {isLoading && (
          <div className="p-6 space-y-4">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-40" />
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
            <Skeleton className="h-48 w-full" />
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <Building2 className="h-10 w-10 opacity-40" />
            <p className="text-sm">Failed to load asset details</p>
            <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
          </div>
        )}

        {data && !isLoading && (
          <>
            <SheetHeader className="px-6 py-4 border-b sticky top-0 bg-background z-10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <SheetTitle className="text-base font-semibold leading-tight">
                    {data.project.name}
                  </SheetTitle>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge
                      className={`text-xs ${getStatusBadge(data.project.status)}`}
                      variant="outline"
                    >
                      {data.project.status?.replace(/_/g, ' ')}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                      <MapPin className="h-3 w-3" />
                      {[data.project.city, data.project.state].filter(Boolean).join(', ') || '—'}
                    </span>
                    <span
                      className="text-xs inline-block px-1.5 py-0.5 rounded-full text-white text-[10px] font-medium"
                      style={{ backgroundColor: ASSET_CLASS_COLORS[data.project.assetClass] || '#94a3b8' }}
                    >
                      {getAssetClassLabel(data.project.assetClass)}
                    </span>
                  </div>
                </div>
                <Link href={`/modeling/projects/${data.project.id}`} onClick={onClose}>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0">
                    <ExternalLink className="h-3 w-3" /> Full Model
                  </Button>
                </Link>
              </div>
            </SheetHeader>

            <div className="px-6 pb-6">
              <Tabs defaultValue="overview" className="mt-4">
                <TabsList className="mb-4 h-8">
                  <TabsTrigger value="overview" className="text-xs h-7">Overview</TabsTrigger>
                  <TabsTrigger value="financials" className="text-xs h-7">Financials</TabsTrigger>
                  <TabsTrigger value="returns" className="text-xs h-7">Returns</TabsTrigger>
                  <TabsTrigger value="capital" className="text-xs h-7">Capital Stack</TabsTrigger>
                  <TabsTrigger value="documents" className="text-xs h-7">Documents</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-0">
                  <OverviewTab data={data} />
                </TabsContent>
                <TabsContent value="financials" className="mt-0">
                  <FinancialsTab data={data} />
                </TabsContent>
                <TabsContent value="returns" className="mt-0">
                  <ReturnsTab data={data} />
                </TabsContent>
                <TabsContent value="capital" className="mt-0">
                  <CapitalStackTab data={data} />
                </TabsContent>
                <TabsContent value="documents" className="mt-0">
                  <DocumentsTab data={data} />
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
