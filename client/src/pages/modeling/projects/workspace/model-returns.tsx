import { useState, useMemo, useRef, useCallback } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  TrendingUp, TrendingDown, DollarSign, BarChart3, Plus, Pencil, Trash2,
  ArrowUpRight, ArrowDownRight, Activity, Target, Percent, Wallet, Landmark,
  Database, RefreshCw, GitCompareArrows, Layers, Building2, Scale, ChevronRight
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
  ComposedChart, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
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

const COMPARE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatCurrencyCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e6) return `${value < 0 ? '-' : ''}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${value < 0 ? '-' : ''}$${(abs / 1e3).toFixed(0)}K`;
  return `${value < 0 ? '-' : ''}$${abs.toFixed(0)}`;
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  return `${(value).toFixed(2)}%`;
}

function formatPercentDecimal(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  return `${(value * 100).toFixed(2)}%`;
}

function formatMultiple(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
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

function ComparisonTab({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: allProjects, isLoading: loadingProjects } = useQuery<any[]>({
    queryKey: ['/api/modeling/projects'],
  });

  const otherProjects = useMemo(() => {
    if (!allProjects) return [];
    return allProjects.filter((p: any) => p.id !== projectId);
  }, [allProjects, projectId]);

  const compareIds = useMemo(() => [projectId, ...selectedIds], [projectId, selectedIds]);

  const { data: comparisonData, isLoading: loadingComparison, refetch: refetchComparison } = useQuery<any[]>({
    queryKey: ['/api/returns/compare-models', compareIds],
    queryFn: async () => {
      if (compareIds.length < 2) return null;
      const res = await fetch('/api/returns/compare-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectIds: compareIds }),
      });
      if (!res.ok) throw new Error('Failed to compare');
      return res.json();
    },
    enabled: compareIds.length >= 2,
  });

  const toggleProject = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id].slice(0, 9)
    );
  };

  const currentModel = comparisonData?.find((d: any) => d.projectId === projectId);
  const comparedModels = comparisonData?.filter((d: any) => d.projectId !== projectId) || [];

  const noiChartData = useMemo(() => {
    if (!comparisonData || comparisonData.length < 2) return [];
    const maxYears = Math.max(...comparisonData.filter((d: any) => d.years).map((d: any) => d.years.length));
    const data: any[] = [];
    for (let i = 0; i < maxYears; i++) {
      const point: any = { year: comparisonData[0]?.years?.[i] || `Y${i + 1}` };
      comparisonData.forEach((model: any, idx: number) => {
        if (!model.error && model.noiByYear) {
          point[model.projectName || `Model ${idx + 1}`] = model.noiByYear[i] || 0;
        }
      });
      data.push(point);
    }
    return data;
  }, [comparisonData]);

  const metricRows = [
    { label: 'Purchase Price', key: 'purchasePrice', format: formatCurrency },
    { label: 'Exit Value', key: 'exitValue', format: formatCurrency },
    { label: 'Capital Appreciation', key: 'capitalAppreciation', format: formatCurrency },
    { label: 'Capital Appreciation %', key: 'capitalAppreciationPct', format: formatPercent },
    { label: 'Total Equity', key: 'totalEquity', format: formatCurrency },
    { label: 'Levered IRR', key: 'leveredIRR', format: formatPercent },
    { label: 'Unlevered IRR', key: 'unleveredIRR', format: formatPercent },
    { label: 'Equity Multiple', key: 'equityMultiple', format: formatMultiple },
    { label: 'Unlevered Equity Multiple', key: 'unleveredEquityMultiple', format: formatMultiple },
    { label: 'Gain on Sale', key: 'gainOnSale', format: formatCurrency },
    { label: 'Total Return', key: 'totalReturn', format: formatCurrency },
    { label: 'Cash-on-Cash (Y1)', key: 'cashOnCashY1', format: formatPercent },
    { label: 'Going-In Cap Rate', key: 'goingInCapRate', format: formatPercent },
    { label: 'Exit Cap Rate', key: 'exitCapRate', format: formatPercent },
    { label: 'Year 1 NOI', key: 'year1Noi', format: formatCurrency },
    { label: 'Stabilized NOI', key: 'stabilizedNoi', format: formatCurrency },
    { label: 'LTV', key: 'ltv', format: formatPercent },
    { label: 'DSCR', key: 'dscr', format: formatMultiple },
    { label: 'Net Exit Proceeds', key: 'netExitProceeds', format: formatCurrency },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <GitCompareArrows className="h-4 w-4" /> Select Models to Compare
          </CardTitle>
          <CardDescription>Choose other models to compare against "{projectName}"</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingProjects ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : otherProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No other models available for comparison.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {otherProjects.map((p: any) => (
                <label key={p.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                  selectedIds.includes(p.id) ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                }`}>
                  <Checkbox
                    checked={selectedIds.includes(p.id)}
                    onCheckedChange={() => toggleProject(p.id)}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.marinaName || p.name}</p>
                    {p.purchasePrice && (
                      <p className="text-xs text-muted-foreground">{formatCurrencyCompact(parseFloat(p.purchasePrice))}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {compareIds.length < 2 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Scale className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Select at least one other model to compare</p>
          </CardContent>
        </Card>
      )}

      {loadingComparison && compareIds.length >= 2 && (
        <div className="space-y-4">
          <Skeleton className="h-[400px]" />
        </div>
      )}

      {comparisonData && comparisonData.length >= 2 && (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Side-by-Side Return Metrics</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10 min-w-[180px]">Metric</TableHead>
                      {comparisonData.map((model: any, idx: number) => (
                        <TableHead key={model.projectId} className="text-center min-w-[140px]">
                          <div className="flex items-center justify-center gap-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COMPARE_COLORS[idx % COMPARE_COLORS.length] }} />
                            <span className="truncate max-w-[120px]">{model.projectName}</span>
                            {model.projectId === projectId && (
                              <Badge variant="outline" className="text-[10px] px-1 ml-1">Current</Badge>
                            )}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metricRows.map((row) => {
                      const values = comparisonData.map((m: any) => m[row.key]);
                      const numericValues = values.filter((v: any) => typeof v === 'number' && !isNaN(v));
                      const best = (row.key.includes('IRR') || row.key.includes('Multiple') || row.key === 'cashOnCashY1' || row.key === 'capitalAppreciationPct')
                        && numericValues.length > 0
                        ? Math.max(...numericValues)
                        : null;

                      return (
                        <TableRow key={row.key}>
                          <TableCell className="sticky left-0 bg-background z-10 font-medium text-sm">{row.label}</TableCell>
                          {comparisonData.map((model: any) => {
                            const val = model[row.key];
                            const isBest = best !== null && val === best && comparisonData.filter((m: any) => m[row.key] === best).length === 1;
                            return (
                              <TableCell key={model.projectId} className={`text-center text-sm ${isBest ? 'text-emerald-600 font-semibold dark:text-emerald-400' : ''}`}>
                                {model.error ? '—' : row.format(val)}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {noiChartData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">NOI Growth Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={noiChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="year" fontSize={11} />
                    <YAxis fontSize={10} tickFormatter={(v) => formatCurrencyCompact(v)} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    {comparisonData.filter((m: any) => !m.error).map((model: any, idx: number) => (
                      <Line
                        key={model.projectId}
                        type="monotone"
                        dataKey={model.projectName}
                        stroke={COMPARE_COLORS[idx % COMPARE_COLORS.length]}
                        strokeWidth={model.projectId === projectId ? 3 : 2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">IRR Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={comparisonData.filter((m: any) => !m.error).map((m: any, idx: number) => ({
                    name: m.projectName,
                    levered: m.leveredIRR,
                    unlevered: m.unleveredIRR,
                    fill: COMPARE_COLORS[idx % COMPARE_COLORS.length],
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" fontSize={10} />
                    <YAxis fontSize={10} tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
                    <Legend />
                    <Bar dataKey="levered" name="Levered IRR" fill="#3b82f6" />
                    <Bar dataKey="unlevered" name="Unlevered IRR" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Equity Multiple Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={comparisonData.filter((m: any) => !m.error).map((m: any, idx: number) => ({
                    name: m.projectName,
                    levered: m.equityMultiple,
                    unlevered: m.unleveredEquityMultiple,
                    fill: COMPARE_COLORS[idx % COMPARE_COLORS.length],
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" fontSize={10} />
                    <YAxis fontSize={10} tickFormatter={(v) => `${v}x`} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(2)}x`} />
                    <Legend />
                    <Bar dataKey="levered" name="Levered" fill="#3b82f6" />
                    <Bar dataKey="unlevered" name="Unlevered" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function PortfolioSimulationTab({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([projectId]);

  const { data: allProjects, isLoading: loadingProjects } = useQuery<any[]>({
    queryKey: ['/api/modeling/projects'],
  });

  const { data: simulationData, isLoading: loadingSim, refetch } = useQuery<any>({
    queryKey: ['/api/returns/portfolio-simulation', selectedIds],
    queryFn: async () => {
      if (selectedIds.length === 0) return null;
      const res = await fetch('/api/returns/portfolio-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeProjectIds: selectedIds }),
      });
      if (!res.ok) throw new Error('Failed to simulate');
      return res.json();
    },
    enabled: selectedIds.length > 0,
  });

  const toggleProject = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const portfolio = simulationData?.portfolio;
  const assets = simulationData?.assets || [];

  const allocationData = useMemo(() => {
    return assets
      .filter((a: any) => !a.error && a.weight > 0)
      .map((a: any, idx: number) => ({
        name: a.projectName,
        value: a.totalEquity,
        weight: a.weight,
        fill: COMPARE_COLORS[idx % COMPARE_COLORS.length],
      }));
  }, [assets]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Layers className="h-4 w-4" /> Portfolio Asset Selection
          </CardTitle>
          <CardDescription>Toggle assets on/off to simulate portfolio impact</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingProjects ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : !allProjects || allProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No models available.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {allProjects.map((p: any) => (
                <label key={p.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                  selectedIds.includes(p.id) ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                }`}>
                  <Checkbox
                    checked={selectedIds.includes(p.id)}
                    onCheckedChange={() => toggleProject(p.id)}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {p.marinaName || p.name}
                      {p.id === projectId && (
                        <Badge variant="outline" className="text-[10px] px-1 ml-1">Current</Badge>
                      )}
                    </p>
                    {p.purchasePrice && (
                      <p className="text-xs text-muted-foreground">{formatCurrencyCompact(parseFloat(p.purchasePrice))}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedIds.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Layers className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Select at least one model to simulate</p>
          </CardContent>
        </Card>
      )}

      {loadingSim && selectedIds.length > 0 && (
        <div className="space-y-4">
          <Skeleton className="h-[200px]" />
        </div>
      )}

      {portfolio && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <KpiCard
              title="Total Equity"
              value={formatCurrencyCompact(portfolio.totalEquity)}
              subtitle={`${portfolio.assetCount} asset${portfolio.assetCount > 1 ? 's' : ''}`}
              icon={Wallet}
              trend="neutral"
            />
            <KpiCard
              title="Weighted IRR"
              value={formatPercent(portfolio.weightedIRR)}
              subtitle="Equity-weighted"
              icon={TrendingUp}
              trend={portfolio.weightedIRR > 0 ? 'up' : 'neutral'}
            />
            <KpiCard
              title="Equity Multiple"
              value={formatMultiple(portfolio.equityMultiple)}
              icon={Target}
              trend={portfolio.equityMultiple > 1 ? 'up' : 'neutral'}
            />
            <KpiCard
              title="Capital Appreciation"
              value={formatCurrencyCompact(portfolio.capitalAppreciation)}
              subtitle={formatPercent(portfolio.capitalAppreciationPct)}
              icon={ArrowUpRight}
              trend={portfolio.capitalAppreciation > 0 ? 'up' : 'down'}
            />
            <KpiCard
              title="Total Gain on Sale"
              value={formatCurrencyCompact(portfolio.totalGainOnSale)}
              icon={DollarSign}
              trend={portfolio.totalGainOnSale > 0 ? 'up' : 'down'}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Portfolio Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Total Purchase Price</TableCell>
                      <TableCell className="text-right">{formatCurrency(portfolio.totalPurchasePrice)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Total Exit Value</TableCell>
                      <TableCell className="text-right">{formatCurrency(portfolio.totalExitValue)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Total Equity Invested</TableCell>
                      <TableCell className="text-right">{formatCurrency(portfolio.totalEquity)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Total Return</TableCell>
                      <TableCell className="text-right">{formatCurrency(portfolio.totalReturn)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Year 1 Portfolio NOI</TableCell>
                      <TableCell className="text-right">{formatCurrency(portfolio.totalNOIY1)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Blended Going-In Cap Rate</TableCell>
                      <TableCell className="text-right">{formatPercent(portfolio.goingInCapRate)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Equity Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                {allocationData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={allocationData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis type="number" fontSize={10} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                      <YAxis type="category" dataKey="name" fontSize={10} width={100} />
                      <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                      <Bar dataKey="weight" name="Weight">
                        {allocationData.map((d: any, i: number) => (
                          <Cell key={i} fill={d.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">No allocation data</div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Asset-Level Detail</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead className="text-right">Purchase Price</TableHead>
                      <TableHead className="text-right">Total Equity</TableHead>
                      <TableHead className="text-right">Weight</TableHead>
                      <TableHead className="text-right">Levered IRR</TableHead>
                      <TableHead className="text-right">Unlevered IRR</TableHead>
                      <TableHead className="text-right">Equity Multiple</TableHead>
                      <TableHead className="text-right">Gain on Sale</TableHead>
                      <TableHead className="text-right">Year 1 NOI</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets.map((asset: any) => (
                      <TableRow key={asset.projectId} className={asset.projectId === projectId ? 'bg-primary/5' : ''}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1">
                            {asset.projectName}
                            {asset.projectId === projectId && (
                              <Badge variant="outline" className="text-[10px] px-1">Current</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{asset.error ? '—' : formatCurrencyCompact(asset.purchasePrice)}</TableCell>
                        <TableCell className="text-right">{asset.error ? '—' : formatCurrencyCompact(asset.totalEquity)}</TableCell>
                        <TableCell className="text-right">{asset.error ? '—' : `${asset.weight.toFixed(1)}%`}</TableCell>
                        <TableCell className="text-right">{asset.error ? '—' : formatPercent(asset.leveredIRR)}</TableCell>
                        <TableCell className="text-right">{asset.error ? '—' : formatPercent(asset.unleveredIRR)}</TableCell>
                        <TableCell className="text-right">{asset.error ? '—' : formatMultiple(asset.equityMultiple)}</TableCell>
                        <TableCell className="text-right">{asset.error ? '—' : formatCurrencyCompact(asset.gainOnSale)}</TableCell>
                        <TableCell className="text-right">{asset.error ? '—' : formatCurrencyCompact(asset.year1Noi)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
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

  const { data: proFormaData } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'executive-summary', 'base'],
    queryFn: async () => {
      const res = await fetch(`/api/modeling/projects/${projectId}/executive-summary/base`);
      if (!res.ok) return null;
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

  const pf = proFormaData;
  const capitalAppreciation = pf ? (pf.exitYear?.exitValue || 0) - (pf.purchasePrice || 0) : null;
  const capitalAppreciationPct = pf && pf.purchasePrice > 0
    ? ((capitalAppreciation || 0) / pf.purchasePrice) * 100 : null;

  const filteredEntries = useMemo(() => {
    let entries = [...ledgerEntries];
    if (bucketFilter !== 'all') entries = entries.filter((e: any) => e.bucket === bucketFilter);
    if (sourceFilter !== 'all') entries = entries.filter((e: any) => e.source === sourceFilter);
    return entries;
  }, [ledgerEntries, bucketFilter, sourceFilter]);

  const cumulativeSpend = spendToggle === 'equity'
    ? (effectiveMetrics?.cumulativeSpendEquity ?? metrics?.cumulativeSpendEquity)
    : (effectiveMetrics?.cumulativeSpendAllIn ?? metrics?.cumulativeSpendAllIn);

  const hasData = ledgerEntries.length > 0;

  // Bridge: derive dashboard-compatible metrics from pro forma when no ledger data
  const effectiveMetrics = useMemo(() => {
    if (hasData && metrics) return { ...metrics, source: 'ledger' as const };
    if (!pf) return null;
    
    const m = pf.metrics || {};
    const purchasePrice = pf.purchasePrice || 0;
    const loanProceeds = m.debtSchedule?.totalDebtAtClose || 0;
    const totalEquity = purchasePrice - loanProceeds;
    const exitVal = pf.exitYear?.exitValue || m.exitValue || 0;
    const totalReturn = m.totalReturn || 0;
    const leveredCF1 = pf.yearOne?.noi || 0; // Approximate
    
    // Pro forma IRR values are already percentages — convert to decimal for formatPercentDecimal
    const leveredIrrDecimal = (m.irr || 0) / 100;
    const unleveredIrrDecimal = (m.unleveredIrr || 0) / 100;
    
    // Capital appreciation
    const capAppreciation = exitVal - purchasePrice;
    
    // Gross leveraged gain = net exit proceeds - equity invested
    const netExitProceeds = m.netExitProceeds || (exitVal - (exitVal * 0.02) - (m.debtSchedule?.schedule?.[m.debtSchedule.schedule.length-1]?.totalBalance || 0));
    const grossLeveredGain = netExitProceeds - totalEquity + totalReturn;
    
    return {
      cumulativeOperatingCF: totalReturn,
      cumulativeCashIn: totalReturn > 0 ? totalReturn + Math.max(0, netExitProceeds) : 0,
      cumulativeSpendEquity: -totalEquity,
      cumulativeSpendAllIn: -purchasePrice,
      grossGain: grossLeveredGain,
      moic: totalEquity > 0 ? (m.equityMultiple || 0) : null,
      roi: totalEquity > 0 ? ((m.equityMultiple || 1) - 1) : null,
      irr: view === 'levered' ? leveredIrrDecimal : unleveredIrrDecimal,
      loanBalanceMissing: !m.debtSchedule,
      source: 'pro_forma' as const,
    };
  }, [hasData, metrics, pf, view]);

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

      {!hasData && !pf && !seedMutation.isPending && activeTab === 'dashboard' && (
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="attribution">Attribution</TabsTrigger>
          <TabsTrigger value="compare">
            <GitCompareArrows className="h-3.5 w-3.5 mr-1" /> Compare
          </TabsTrigger>
          <TabsTrigger value="portfolio">
            <Layers className="h-3.5 w-3.5 mr-1" /> Portfolio Sim
          </TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 mt-4">
          {pf && (
            <Card className="bg-gradient-to-r from-primary/5 to-transparent border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Pro Forma Return Metrics</CardTitle>
                <CardDescription>Institutional-grade metrics from the Pro Forma Engine</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Levered IRR</p>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatPercent(pf.leveredIRR)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Unlevered IRR</p>
                    <p className="text-lg font-bold">{formatPercent(pf.unleveredIRR)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Equity Multiple</p>
                    <p className="text-lg font-bold">{formatMultiple(pf.equityMultiple)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Unlevered Multiple</p>
                    <p className="text-lg font-bold">{formatMultiple(pf.unleveredEquityMultiple)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Capital Appreciation</p>
                    <p className="text-lg font-bold">{capitalAppreciation !== null ? formatCurrencyCompact(capitalAppreciation) : 'N/A'}</p>
                    {capitalAppreciationPct !== null && (
                      <p className="text-xs text-muted-foreground">{formatPercent(capitalAppreciationPct)}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Return</p>
                    <p className="text-lg font-bold">{pf.metrics?.totalReturn ? formatCurrencyCompact(pf.metrics.totalReturn) : 'N/A'}</p>
                  </div>
                </div>
                <Separator className="my-4" />
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Purchase Price</p>
                    <p className="text-sm font-semibold">{formatCurrency(pf.purchasePrice || 0)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Exit Value</p>
                    <p className="text-sm font-semibold">{formatCurrency(pf.exitYear?.exitValue || 0)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Going-In Cap Rate</p>
                    <p className="text-sm font-semibold">{formatPercent(pf.metrics?.goingInCapRate)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Exit Cap Rate</p>
                    <p className="text-sm font-semibold">{formatPercent(pf.metrics?.exitCapRate)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Year 1 NOI</p>
                    <p className="text-sm font-semibold">{formatCurrency(pf.yearOne?.noi || 0)}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Exit Year NOI</p>
                    <p className="text-sm font-semibold">{formatCurrency(pf.exitYear?.noi || 0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {effectiveMetrics && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <KpiCard
                  title="Cumulative Op CF"
                  value={formatCurrencyCompact(effectiveMetrics.cumulativeOperatingCF || 0)}
                  icon={Activity}
                  trend={(effectiveMetrics.cumulativeOperatingCF || 0) >= 0 ? 'up' : 'down'}
                />
                <KpiCard
                  title="Cash In"
                  value={formatCurrencyCompact(effectiveMetrics.cumulativeCashIn || 0)}
                  icon={ArrowUpRight}
                  trend="up"
                />
                <KpiCard
                  title={spendToggle === 'equity' ? 'Equity Invested' : 'All-In Spend'}
                  value={formatCurrencyCompact(Math.abs(
                    spendToggle === 'equity'
                      ? (effectiveMetrics.cumulativeSpendEquity || 0)
                      : (effectiveMetrics.cumulativeSpendAllIn || 0)
                  ))}
                  icon={Wallet}
                  trend="down"
                />
                <KpiCard
                  title="Gross Gain"
                  value={formatCurrencyCompact(effectiveMetrics.grossGain || 0)}
                  icon={TrendingUp}
                  trend={(effectiveMetrics.grossGain || 0) >= 0 ? 'up' : 'down'}
                />
                <KpiCard
                  title="MOIC"
                  value={formatMultiple(effectiveMetrics.moic)}
                  icon={Target}
                  trend={effectiveMetrics.moic && effectiveMetrics.moic > 1 ? 'up' : 'neutral'}
                />
                <KpiCard
                  title="ROI"
                  value={formatPercentDecimal(effectiveMetrics.roi)}
                  icon={Percent}
                  trend={effectiveMetrics.roi && effectiveMetrics.roi > 0 ? 'up' : 'neutral'}
                />
                <KpiCard
                  title="IRR"
                  value={formatPercentDecimal(effectiveMetrics.irr)}
                  subtitle={view === 'levered' ? 'Levered' : 'Unlevered'}
                  icon={TrendingUp}
                  trend={effectiveMetrics.irr && effectiveMetrics.irr > 0 ? 'up' : 'neutral'}
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

              {effectiveMetrics?.loanBalanceMissing && view === 'levered' && (
                <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
                  <CardContent className="p-3 flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
                    <Landmark className="h-4 w-4 shrink-0" />
                    Loan balance data not found — equity value shown as market value only. Seed demo data or add entries to include debt.
                  </CardContent>
                </Card>
              )}
            </>
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

        <TabsContent value="compare" className="space-y-6 mt-4">
          <ComparisonTab projectId={projectId} projectName={projectName} />
        </TabsContent>

        <TabsContent value="portfolio" className="space-y-6 mt-4">
          <PortfolioSimulationTab projectId={projectId} projectName={projectName} />
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
    </div>
  );
}