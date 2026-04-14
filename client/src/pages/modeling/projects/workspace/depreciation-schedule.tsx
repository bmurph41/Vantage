import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart, Bar } from 'recharts';
import { apiRequest } from '@/lib/queryClient';
import { Plus, Trash2, Calculator, DollarSign, Building2, ArrowRightLeft } from 'lucide-react';

interface Allocation {
  id: string;
  assetClass: string;
  amount: number;
  lifetimeYears: number;
  method: 'straight_line' | 'macrs';
}

interface BackendScheduleItem {
  assetClass: string;
  basisAmount: number;
  method: string;
  lifetimeYears: number;
  annualDepreciation: number[];
  cumulativeDepreciation: number[];
  remainingBasis: number[];
}

interface BackendDepreciationResult {
  schedules: BackendScheduleItem[];
  totalBasis: number;
  landValue: number;
  depreciableBasis: number;
  annualTotalDepreciation: number[];
  cumulativeTotalDepreciation: number[];
  taxShieldPerYear: number[];
  totalTaxShield: number;
  adjustedBasis: number;
  deferredGain: number;
  depreciationRecapture: number;
  capitalGain: number;
}

interface YearScheduleRow {
  year: number;
  depreciationByClass: Record<string, number>;
  totalDepreciation: number;
  cumulativeDepreciation: number;
  remainingBasis: number;
}

interface MappedResult {
  totalBasis: number;
  depreciableBasis: number;
  totalTaxShield: number;
  adjustedBasisAtExit: number;
  depreciationRecapture: number;
  capitalGain: number;
  taxRate: number;
  holdPeriod: number;
  assetClasses: string[];
  schedule: YearScheduleRow[];
  exchange1031: {
    deferredGain: number;
    newBasis: number;
    bootReceived: number;
    taxDeferred: number;
  };
}

interface DepreciationScheduleProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

const DEFAULT_ASSET_CLASSES = [
  'Building/Structure',
  'Land Improvements',
  'Personal Property',
  'Dock Systems',
  'Mechanical/HVAC',
  'Electrical Systems',
];

const DISPLAY_LABELS: Record<string, string> = {
  straight_line: 'Straight-Line',
  macrs: 'MACRS',
};

const ASSET_COLORS: Record<string, string> = {
  'Building/Structure': '#3b82f6',
  'Land Improvements': '#22c55e',
  'Personal Property': '#f59e0b',
  'Dock Systems': '#8b5cf6',
  'Mechanical/HVAC': '#ec4899',
  'Electrical Systems': '#06b6d4',
};

function mapBackendResult(
  raw: BackendDepreciationResult,
  taxRate: number,
  holdPeriodYears: number,
  exitValue: number,
): MappedResult {
  const assetClasses = raw.schedules.map(s => s.assetClass);

  const schedule: YearScheduleRow[] = raw.annualTotalDepreciation.map((totalDep, idx) => {
    const depreciationByClass: Record<string, number> = {};
    raw.schedules.forEach(s => {
      depreciationByClass[s.assetClass] = s.annualDepreciation[idx] ?? 0;
    });
    return {
      year: idx + 1,
      depreciationByClass,
      totalDepreciation: totalDep,
      cumulativeDepreciation: raw.cumulativeTotalDepreciation[idx] ?? 0,
      remainingBasis: raw.totalBasis - (raw.cumulativeTotalDepreciation[idx] ?? 0),
    };
  });

  const taxDeferred =
    raw.depreciationRecapture * Math.min(taxRate, 0.25) +
    raw.capitalGain * 0.20;

  return {
    totalBasis: raw.totalBasis,
    depreciableBasis: raw.depreciableBasis,
    totalTaxShield: raw.totalTaxShield,
    adjustedBasisAtExit: raw.adjustedBasis,
    depreciationRecapture: raw.depreciationRecapture,
    capitalGain: raw.capitalGain,
    taxRate,
    holdPeriod: holdPeriodYears,
    assetClasses,
    schedule,
    exchange1031: {
      deferredGain: raw.deferredGain,
      newBasis: exitValue,
      bootReceived: 0,
      taxDeferred,
    },
  };
}

export function DepreciationSchedule({ projectId, onTabChange }: DepreciationScheduleProps) {
  const [purchasePrice, setPurchasePrice] = useState<number>(5_000_000);
  const [landValue, setLandValue] = useState<number>(1_000_000);
  const [holdPeriodYears, setHoldPeriodYears] = useState<number>(10);
  const [taxRate, setTaxRate] = useState<number>(0.37);
  const [exitValue, setExitValue] = useState<number>(7_000_000);
  const [allocations, setAllocations] = useState<Allocation[]>([
    { id: '1', assetClass: 'Building/Structure', amount: 3_000_000, lifetimeYears: 39, method: 'straight_line' },
    { id: '2', assetClass: 'Land Improvements', amount: 500_000, lifetimeYears: 15, method: 'macrs' },
    { id: '3', assetClass: 'Personal Property', amount: 500_000, lifetimeYears: 7, method: 'macrs' },
  ]);
  const [results, setResults] = useState<MappedResult | null>(null);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalAllocated = useMemo(() => {
    return landValue + allocations.reduce((sum, a) => sum + a.amount, 0);
  }, [landValue, allocations]);

  const unallocated = purchasePrice - totalAllocated;

  const addAllocation = () => {
    setAllocations(prev => [
      ...prev,
      {
        id: `alloc-${Date.now()}`,
        assetClass: '',
        amount: 0,
        lifetimeYears: 15,
        method: 'macrs',
      },
    ]);
  };

  const removeAllocation = (id: string) => {
    setAllocations(prev => prev.filter(a => a.id !== id));
  };

  const updateAllocation = (id: string, field: keyof Allocation, value: string | number) => {
    setAllocations(prev =>
      prev.map(a => (a.id === id ? { ...a, [field]: value } : a))
    );
  };

  const computeSchedule = async () => {
    setError(null);
    setComputing(true);
    try {
      const validAllocations = allocations.filter(a => a.assetClass && a.amount > 0);
      if (validAllocations.length === 0) {
        setError('Add at least one improvement allocation with an asset class and amount.');
        return;
      }

      const res = await apiRequest('POST', '/api/institutional-analysis/depreciation', {
        purchasePrice,
        landValue,
        improvementAllocations: validAllocations.map(a => ({
          assetClass: a.assetClass,
          amount: a.amount,
          lifetimeYears: a.lifetimeYears,
          method: a.method,
        })),
        holdPeriodYears,
        taxRate,
        exitValue,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as any).error || `Server error ${res.status}`);
      }

      const raw = await res.json() as BackendDepreciationResult;
      setResults(mapBackendResult(raw, taxRate, holdPeriodYears, exitValue));
    } catch (err: any) {
      console.error('Depreciation calculation failed:', err);
      setError(err.message || 'Calculation failed. Check inputs and try again.');
    } finally {
      setComputing(false);
    }
  };

  const areaChartData = useMemo(() => {
    if (!results) return [];
    return results.schedule.map(row => ({
      year: `Y${row.year}`,
      ...row.depreciationByClass,
      total: row.totalDepreciation,
    }));
  }, [results]);

  const cumulativeChartData = useMemo(() => {
    if (!results) return [];
    return results.schedule.map(row => ({
      year: `Y${row.year}`,
      cumulative: row.cumulativeDepreciation,
      remaining: row.remainingBasis,
    }));
  }, [results]);

  const canCompute = unallocated >= 0 && allocations.some(a => a.assetClass && a.amount > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Depreciation Schedule</h2>
          <p className="text-muted-foreground">Cost segregation analysis and tax depreciation modeling</p>
        </div>
        <Button onClick={computeSchedule} disabled={computing || !canCompute}>
          <Calculator className="h-4 w-4 mr-2" />
          {computing ? 'Computing...' : 'Compute Schedule'}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Inputs */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase &amp; Scenario Inputs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Row 1 — price / land / unallocated */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <Label>Purchase Price ($)</Label>
              <Input
                type="number"
                min={0}
                value={purchasePrice}
                onChange={e => setPurchasePrice(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Land Value ($)</Label>
              <Input
                type="number"
                min={0}
                value={landValue}
                onChange={e => setLandValue(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Hold Period (years)</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={holdPeriodYears}
                onChange={e => setHoldPeriodYears(parseInt(e.target.value) || 1)}
              />
            </div>
            <div>
              <Label>Tax Rate (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={(taxRate * 100).toFixed(1)}
                onChange={e => setTaxRate((parseFloat(e.target.value) || 0) / 100)}
              />
            </div>
            <div>
              <Label>Projected Exit Value ($)</Label>
              <Input
                type="number"
                min={0}
                value={exitValue}
                onChange={e => setExitValue(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Unallocated indicator */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Unallocated:</span>
            <span className={`text-base font-semibold ${unallocated < 0 ? 'text-red-600' : unallocated > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
              {formatCurrency(unallocated)}
            </span>
            {unallocated < 0 && (
              <span className="text-xs text-red-500">Allocations exceed purchase price</span>
            )}
            {unallocated > 0 && (
              <span className="text-xs text-yellow-600">Some basis is unallocated — add more rows or adjust amounts</span>
            )}
          </div>

          {/* Improvement allocations */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Improvement Allocations</h4>
              <Button variant="outline" size="sm" onClick={addAllocation}>
                <Plus className="h-4 w-4 mr-1" /> Add Row
              </Button>
            </div>

            {/* Header row */}
            <div className="hidden sm:grid sm:grid-cols-5 gap-3 text-xs font-medium text-muted-foreground px-1">
              <span>Asset Class</span>
              <span>Amount ($)</span>
              <span>Lifetime (yrs)</span>
              <span>Method</span>
              <span></span>
            </div>

            {allocations.map(a => (
              <div key={a.id} className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
                <div>
                  <Label className="sm:hidden text-xs">Asset Class</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={a.assetClass}
                    onChange={e => updateAllocation(a.id, 'assetClass', e.target.value)}
                  >
                    <option value="">Select class…</option>
                    {DEFAULT_ASSET_CLASSES.map(ac => (
                      <option key={ac} value={ac}>{ac}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="sm:hidden text-xs">Amount ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={a.amount}
                    onChange={e => updateAllocation(a.id, 'amount', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label className="sm:hidden text-xs">Lifetime (yrs)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={a.lifetimeYears}
                    onChange={e => updateAllocation(a.id, 'lifetimeYears', parseInt(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <Label className="sm:hidden text-xs">Method</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={a.method}
                    onChange={e => updateAllocation(a.id, 'method', e.target.value as 'straight_line' | 'macrs')}
                  >
                    <option value="straight_line">Straight-Line</option>
                    <option value="macrs">MACRS (200% DB)</option>
                  </select>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeAllocation(a.id)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      {results && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total Basis', value: formatCurrency(results.totalBasis), icon: Building2 },
            { label: 'Depreciable Basis', value: formatCurrency(results.depreciableBasis), icon: DollarSign },
            { label: 'Total Tax Shield', value: formatCurrency(results.totalTaxShield), icon: DollarSign },
            { label: 'Adj. Basis at Exit', value: formatCurrency(results.adjustedBasisAtExit), icon: DollarSign },
            { label: 'Dep. Recapture', value: formatCurrency(results.depreciationRecapture), icon: DollarSign },
            { label: 'Capital Gain', value: formatCurrency(results.capitalGain), icon: DollarSign },
          ].map((kpi, i) => (
            <Card key={i}>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <kpi.icon className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
                <p className="text-lg font-bold">{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Charts */}
      {results && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Annual Depreciation by Asset Class</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={areaChartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" fontSize={11} />
                  <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  {results.assetClasses.map(ac => (
                    <Area
                      key={ac}
                      type="monotone"
                      dataKey={ac}
                      stackId="1"
                      fill={ASSET_COLORS[ac] || '#94a3b8'}
                      stroke={ASSET_COLORS[ac] || '#94a3b8'}
                      fillOpacity={0.7}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cumulative Depreciation vs Remaining Basis</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={cumulativeChartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" fontSize={11} />
                  <YAxis tickFormatter={v => `$${(v / 1_000_000).toFixed(1)}M`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="remaining" name="Remaining Basis" fill="#e2e8f0" radius={[2, 2, 0, 0]} />
                  <Line type="monotone" dataKey="cumulative" name="Cumulative Depreciation" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Schedule Table */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Year-by-Year Depreciation Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Year</TableHead>
                    {results.assetClasses.map(ac => (
                      <TableHead key={ac} className="text-right">{ac}</TableHead>
                    ))}
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Cumulative</TableHead>
                    <TableHead className="text-right">Remaining Basis</TableHead>
                    <TableHead className="text-right">Tax Shield</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.schedule.map((row, idx) => (
                    <TableRow key={row.year}>
                      <TableCell className="font-medium">{row.year}</TableCell>
                      {results.assetClasses.map(ac => (
                        <TableCell key={ac} className="text-right">
                          {row.depreciationByClass[ac] ? formatCurrency(row.depreciationByClass[ac]) : '—'}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-medium">{formatCurrency(row.totalDepreciation)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.cumulativeDepreciation)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.remainingBasis)}</TableCell>
                      <TableCell className="text-right text-green-600 dark:text-green-400">
                        {formatCurrency(row.totalDepreciation * results.taxRate)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 1031 Exchange Summary */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              1031 Exchange Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Assumes full like-kind exchange (no boot received, replacement property basis equals exit value).
              Recapture taxed at the lesser of your marginal rate or 25%; capital gain at 20%.
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Deferred Gain</p>
                <p className="text-xl font-bold">{formatCurrency(results.exchange1031.deferredGain)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">New Basis (Replacement)</p>
                <p className="text-xl font-bold">{formatCurrency(results.exchange1031.newBasis)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Boot Received</p>
                <p className="text-xl font-bold">{formatCurrency(results.exchange1031.bootReceived)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tax Deferred</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(results.exchange1031.taxDeferred)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!results && !computing && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Calculator className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p className="text-lg font-medium">No depreciation schedule computed</p>
            <p className="text-sm mt-1">
              Configure your purchase details, scenario inputs, and improvement allocations above, then click "Compute Schedule".
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default DepreciationSchedule;
