import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  TrendingUp, TrendingDown, DollarSign, BarChart3, Plus, Pencil, Trash2,
  ArrowUpRight, ArrowDownRight, Activity, Target, Percent, Wallet, Landmark,
  Database, RefreshCw
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
  ComposedChart
} from 'recharts';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { ExportPdfButton } from '@/components/ui/export-pdf-button';

interface ModelReturnsProps {
  projectId: string;
  projectName: string;
}

const BUCKET_LABELS: Record<string, string> = {
  ACQUISITION: 'Acquisition',
  EQUITY_CONTRIBUTION: 'Equity Contribution',
  LOAN_PROCEEDS: 'Loan Proceeds',
  OPERATING_CASHFLOW: 'Operating CF',
  CAPEX: 'CapEx',
  DEBT_SERVICE_INTEREST: 'Debt Service (Interest)',
  DEBT_SERVICE_PRINCIPAL: 'Debt Service (Principal)',
  REFI_PROCEEDS: 'Refi Proceeds',
  SALE_PROCEEDS: 'Sale Proceeds',
  SALE_COSTS: 'Sale Costs',
  LOAN_PAYOFF: 'Loan Payoff',
  FEES_OTHER: 'Fees / Other',
};

const SOURCE_LABELS: Record<string, string> = {
  MODEL: 'Model',
  QBO: 'QuickBooks',
  UPLOAD: 'Upload',
  MANUAL: 'Manual',
};

function formatCurrencyCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e6) return `${value < 0 ? '-' : ''}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${value < 0 ? '-' : ''}$${(abs / 1e3).toFixed(0)}K`;
  return `${value < 0 ? '-' : ''}$${abs.toFixed(0)}`;
}

function formatPercent(value: number | null): string {
  if (value === null) return 'N/A';
  return `${(value * 100).toFixed(2)}%`;
}

function formatMultiple(value: number | null): string {
  if (value === null) return 'N/A';
  return `${value.toFixed(2)}x`;
}

function KpiCard({ title, value, subtitle, icon: Icon, trend, className }: {
  title: string;
  value: string;
  subtitle?: string;
  icon: any;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={`p-2 rounded-lg ${
            trend === 'up' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400' :
            trend === 'down' ? 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400' :
            'bg-muted text-muted-foreground'
          }`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AddLedgerEntryDialog({ projectId, onSuccess }: { projectId: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [bucket, setBucket] = useState('OPERATING_CASHFLOW');
  const [amount, setAmount] = useState('');
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [memo, setMemo] = useState('');
  const [source, setSource] = useState('MANUAL');

  const mutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/returns/ledger', {
        method: 'POST',
        body: JSON.stringify({
          modelId: projectId,
          propertyId: `prop-${projectId}`,
          asOfDate,
          bucket,
          amount,
          source,
          memo,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      toast({ title: 'Entry added', description: 'Ledger entry created successfully.' });
      setOpen(false);
      setAmount('');
      setMemo('');
      onSuccess();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create ledger entry.', variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" /> Add Entry
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Ledger Entry</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Bucket</Label>
            <Select value={bucket} onValueChange={setBucket}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(BUCKET_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Amount (negative = outflow, positive = inflow)</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="-100000.00" />
          </div>
          <div className="space-y-2">
            <Label>As Of Date</Label>
            <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Memo</Label>
            <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Optional description..." />
          </div>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !amount} className="w-full">
            {mutation.isPending ? 'Saving...' : 'Add Entry'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ModelReturns({ projectId, projectName }: ModelReturnsProps) {
  const pdfRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<'levered' | 'unlevered'>('levered');
  const [spendToggle, setSpendToggle] = useState<'equity' | 'all_in'>('equity');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [bucketFilter, setBucketFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  const queryKey = ['/api/returns/model', projectId, view];
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/returns/model/${projectId}?view=${view}`);
      if (!res.ok) throw new Error('Failed to fetch returns');
      return res.json();
    },
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/returns/seed/${projectId}`, { method: 'POST' });
    },
    onSuccess: (result: any) => {
      if (result.seeded) {
        toast({ title: 'Demo Data Created', description: 'Sample returns data has been seeded for this model.' });
      } else {
        toast({ title: 'Already Seeded', description: 'Returns data already exists for this model.' });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/returns/model', projectId] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to seed demo data.', variant: 'destructive' });
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/returns/model', projectId] });
  };

  const metrics = data?.metrics;
  const attribution = data?.attribution;
  const cumulativeSeries = data?.cumulativeSeries;
  const valueSeries = data?.valueSeries;
  const ledgerEntries = data?.ledgerEntries || [];

  const filteredEntries = useMemo(() => {
    let entries = [...ledgerEntries];
    if (bucketFilter !== 'all') entries = entries.filter((e: any) => e.bucket === bucketFilter);
    if (sourceFilter !== 'all') entries = entries.filter((e: any) => e.source === sourceFilter);
    return entries;
  }, [ledgerEntries, bucketFilter, sourceFilter]);

  const cumulativeSpend = spendToggle === 'equity'
    ? metrics?.cumulativeSpendEquity
    : metrics?.cumulativeSpendAllIn;

  const hasData = ledgerEntries.length > 0;

  const waterfallData = useMemo(() => {
    if (!attribution) return [];
    return [
      { name: 'Operating CF', value: attribution.operatingCFContribution, fill: attribution.operatingCFContribution >= 0 ? '#10b981' : '#ef4444' },
      { name: 'CapEx', value: attribution.capexDrag, fill: attribution.capexDrag >= 0 ? '#10b981' : '#ef4444' },
      { name: 'Appreciation', value: attribution.appreciation, fill: attribution.appreciation >= 0 ? '#10b981' : '#ef4444' },
      { name: 'Debt Paydown', value: attribution.debtPaydownBenefit, fill: attribution.debtPaydownBenefit >= 0 ? '#10b981' : '#ef4444' },
      { name: 'Refi Proceeds', value: attribution.refiProceeds, fill: '#3b82f6' },
      { name: 'Fees/Costs', value: attribution.feesDrag, fill: attribution.feesDrag >= 0 ? '#10b981' : '#ef4444' },
    ].filter(d => d.value !== 0);
  }, [attribution]);

  const chartData = useMemo(() => {
    if (!cumulativeSeries?.cashIn) return [];
    return cumulativeSeries.cashIn.map((pt: any, i: number) => ({
      date: new Date(pt.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      cashIn: pt.value,
      cashOut: cumulativeSeries.cashOut[i]?.value || 0,
      netPosition: cumulativeSeries.netPosition[i]?.value || 0,
    }));
  }, [cumulativeSeries]);

  const valueChartData = useMemo(() => {
    if (!valueSeries?.marketValue) return [];
    return valueSeries.marketValue.map((pt: any, i: number) => ({
      date: new Date(pt.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      marketValue: pt.value,
      equityValue: valueSeries.equityValue[i]?.value || 0,
      loanBalance: valueSeries.loanBalance[i]?.value || 0,
    }));
  }, [valueSeries]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6" ref={pdfRef}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Returns Analysis
          </h2>
          <p className="text-sm text-muted-foreground">{projectName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ExportPdfButton contentRef={pdfRef} filename="model-returns" title="Model Returns" />
          <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
            <Button
              size="sm"
              variant={view === 'levered' ? 'default' : 'ghost'}
              onClick={() => setView('levered')}
              className="h-7 text-xs"
            >
              Levered
            </Button>
            <Button
              size="sm"
              variant={view === 'unlevered' ? 'default' : 'ghost'}
              onClick={() => setView('unlevered')}
              className="h-7 text-xs"
            >
              Unlevered
            </Button>
          </div>
          <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
            <Button
              size="sm"
              variant={spendToggle === 'equity' ? 'default' : 'ghost'}
              onClick={() => setSpendToggle('equity')}
              className="h-7 text-xs"
            >
              Equity
            </Button>
            <Button
              size="sm"
              variant={spendToggle === 'all_in' ? 'default' : 'ghost'}
              onClick={() => setSpendToggle('all_in')}
              className="h-7 text-xs"
            >
              All-In
            </Button>
          </div>
          {!hasData && (
            <Button size="sm" variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
              <Database className="h-4 w-4 mr-1" />
              {seedMutation.isPending ? 'Seeding...' : 'Seed Demo Data'}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!hasData && !seedMutation.isPending && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No Returns Data</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mt-2">
              Click "Seed Demo Data" to generate sample cash flows, valuations, and loan balances for this model.
              You can also add manual entries via the Ledger tab.
            </p>
          </CardContent>
        </Card>
      )}

      {hasData && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="charts">Charts</TabsTrigger>
            <TabsTrigger value="attribution">Attribution</TabsTrigger>
            <TabsTrigger value="ledger">Ledger</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <KpiCard
                title="Cumulative Op CF"
                value={formatCurrencyCompact(metrics?.cumulativeOperatingCF || 0)}
                icon={Activity}
                trend={(metrics?.cumulativeOperatingCF || 0) >= 0 ? 'up' : 'down'}
              />
              <KpiCard
                title="Cash In"
                value={formatCurrencyCompact(metrics?.cumulativeCashIn || 0)}
                icon={ArrowUpRight}
                trend="up"
              />
              <KpiCard
                title={spendToggle === 'equity' ? 'Equity Invested' : 'All-In Spend'}
                value={formatCurrencyCompact(Math.abs(cumulativeSpend || 0))}
                icon={Wallet}
                trend="down"
              />
              <KpiCard
                title="Gross Gain"
                value={formatCurrencyCompact(metrics?.grossGain || 0)}
                icon={TrendingUp}
                trend={(metrics?.grossGain || 0) >= 0 ? 'up' : 'down'}
              />
              <KpiCard
                title="MOIC"
                value={formatMultiple(metrics?.moic)}
                icon={Target}
                trend={metrics?.moic && metrics.moic > 1 ? 'up' : 'neutral'}
              />
              <KpiCard
                title="ROI"
                value={formatPercent(metrics?.roi)}
                icon={Percent}
                trend={metrics?.roi && metrics.roi > 0 ? 'up' : 'neutral'}
              />
              <KpiCard
                title="IRR"
                value={formatPercent(metrics?.irr)}
                subtitle={view === 'levered' ? 'Levered' : 'Unlevered'}
                icon={TrendingUp}
                trend={metrics?.irr && metrics.irr > 0 ? 'up' : 'neutral'}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Value & Equity Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  {valueChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <ComposedChart data={valueChartData}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="date" fontSize={10} />
                        <YAxis fontSize={10} tickFormatter={(v) => formatCurrencyCompact(v)} />
                        <Tooltip formatter={(v: number) => formatCurrencyCompact(v)} />
                        <Legend />
                        <Area type="monotone" dataKey="marketValue" name="Market Value" fill="#3b82f6" fillOpacity={0.1} stroke="#3b82f6" />
                        <Line type="monotone" dataKey="equityValue" name="Equity Value" stroke="#10b981" strokeWidth={2} dot={false} />
                        {view === 'levered' && (
                          <Line type="monotone" dataKey="loanBalance" name="Loan Balance" stroke="#f59e0b" strokeWidth={1} strokeDasharray="5 5" dot={false} />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">No valuation data</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Cumulative Net Position</CardTitle>
                </CardHeader>
                <CardContent>
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="date" fontSize={10} />
                        <YAxis fontSize={10} tickFormatter={(v) => formatCurrencyCompact(v)} />
                        <Tooltip formatter={(v: number) => formatCurrencyCompact(v)} />
                        <Legend />
                        <Area type="monotone" dataKey="cashIn" name="Cash In" fill="#10b981" fillOpacity={0.2} stroke="#10b981" />
                        <Area type="monotone" dataKey="cashOut" name="Cash Out" fill="#ef4444" fillOpacity={0.2} stroke="#ef4444" />
                        <Area type="monotone" dataKey="netPosition" name="Net Position" fill="#3b82f6" fillOpacity={0.1} stroke="#3b82f6" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">No cashflow data</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {metrics?.loanBalanceMissing && view === 'levered' && (
              <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
                <CardContent className="p-3 flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
                  <Landmark className="h-4 w-4 shrink-0" />
                  Loan balance data not found — equity value shown as market value only. Seed demo data or add entries to include debt.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="charts" className="space-y-6 mt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Cash Flows by Bucket</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={Object.entries(data?.cashflowsByBucket || {}).map(([k, v]) => ({
                      bucket: BUCKET_LABELS[k] || k,
                      amount: v as number,
                    }))} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis type="number" fontSize={10} tickFormatter={(v) => formatCurrencyCompact(v)} />
                      <YAxis type="category" dataKey="bucket" fontSize={10} width={120} />
                      <Tooltip formatter={(v: number) => formatCurrencyCompact(v)} />
                      <Bar dataKey="amount" name="Amount">
                        {Object.entries(data?.cashflowsByBucket || {}).map(([, v], i) => (
                          <Cell key={i} fill={(v as number) >= 0 ? '#10b981' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Value & Equity Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  {valueChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={valueChartData}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="date" fontSize={10} />
                        <YAxis fontSize={10} tickFormatter={(v) => formatCurrencyCompact(v)} />
                        <Tooltip formatter={(v: number) => formatCurrencyCompact(v)} />
                        <Legend />
                        <Line type="monotone" dataKey="marketValue" name="Market Value" stroke="#3b82f6" strokeWidth={2} />
                        <Line type="monotone" dataKey="equityValue" name="Equity Value" stroke="#10b981" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">No data</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="attribution" className="space-y-6 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Return Attribution Waterfall</CardTitle>
                <CardDescription>What drove returns over the selected period</CardDescription>
              </CardHeader>
              <CardContent>
                {waterfallData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={waterfallData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis fontSize={10} tickFormatter={(v) => formatCurrencyCompact(v)} />
                      <Tooltip formatter={(v: number) => formatCurrencyCompact(v)} />
                      <Bar dataKey="value" name="Contribution">
                        {waterfallData.map((d, i) => (
                          <Cell key={i} fill={d.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[350px] flex items-center justify-center text-muted-foreground text-sm">No attribution data</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Attribution Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Impact</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attribution && [
                      { label: 'Operating Cashflow', value: attribution.operatingCFContribution },
                      { label: 'CapEx Drag', value: attribution.capexDrag },
                      { label: 'Appreciation', value: attribution.appreciation },
                      ...(view === 'levered' ? [{ label: 'Debt Paydown Benefit', value: attribution.debtPaydownBenefit }] : []),
                      { label: 'Refi Proceeds', value: attribution.refiProceeds },
                      { label: 'Fees & Costs', value: attribution.feesDrag },
                    ].map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{row.label}</TableCell>
                        <TableCell className="text-right">{formatCurrencyCompact(row.value)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={row.value >= 0 ? 'default' : 'destructive'} className="text-xs">
                            {row.value >= 0 ? 'Positive' : 'Negative'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ledger" className="space-y-4 mt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Select value={bucketFilter} onValueChange={setBucketFilter}>
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <SelectValue placeholder="All Buckets" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Buckets</SelectItem>
                    {Object.entries(BUCKET_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue placeholder="All Sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <AddLedgerEntryDialog projectId={projectId} onSuccess={handleRefresh} />
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Bucket</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Memo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No entries found</TableCell>
                      </TableRow>
                    ) : (
                      filteredEntries.map((entry: any) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-xs">{new Date(entry.asOfDate).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{BUCKET_LABELS[entry.bucket] || entry.bucket}</Badge>
                          </TableCell>
                          <TableCell className={`text-right font-mono text-sm ${parseFloat(entry.amount) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatCurrencyCompact(parseFloat(entry.amount))}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{SOURCE_LABELS[entry.source] || entry.source}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{entry.memo || '—'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
