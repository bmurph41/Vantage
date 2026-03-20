import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, LineChart, Line, ComposedChart } from 'recharts';
import { apiRequest } from '@/lib/queryClient';
import { Plus, Trash2, Calculator, DollarSign, Building2, ArrowRightLeft } from 'lucide-react';

interface Allocation {
  id: string;
  assetClass: string;
  amount: number;
  lifetime: number;
  method: 'SL' | 'MACRS';
}

interface DepreciationResult {
  totalBasis: number;
  depreciableBasis: number;
  totalTaxShield: number;
  adjustedBasisAtExit: number;
  depreciationRecapture: number;
  capitalGain: number;
  taxRate: number;
  holdPeriod: number;
  schedule: YearScheduleRow[];
  assetClasses: string[];
  exchange1031: {
    deferredGain: number;
    newBasis: number;
    bootReceived: number;
    taxDeferred: number;
  };
}

interface YearScheduleRow {
  year: number;
  depreciationByClass: Record<string, number>;
  totalDepreciation: number;
  cumulativeDepreciation: number;
  remainingBasis: number;
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

export function DepreciationSchedule({ projectId, onTabChange }: DepreciationScheduleProps) {
  const [purchasePrice, setPurchasePrice] = useState<number>(5_000_000);
  const [landValue, setLandValue] = useState<number>(1_000_000);
  const [allocations, setAllocations] = useState<Allocation[]>([
    { id: '1', assetClass: 'Building/Structure', amount: 3_000_000, lifetime: 39, method: 'SL' },
    { id: '2', assetClass: 'Land Improvements', amount: 500_000, lifetime: 15, method: 'MACRS' },
    { id: '3', assetClass: 'Personal Property', amount: 500_000, lifetime: 7, method: 'MACRS' },
  ]);
  const [results, setResults] = useState<DepreciationResult | null>(null);
  const [computing, setComputing] = useState(false);

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
        lifetime: 15,
        method: 'SL',
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
    setComputing(true);
    try {
      const res = await apiRequest('POST', '/api/institutional-analysis/depreciation', {
        projectId,
        purchasePrice,
        landValue,
        allocations: allocations.map(a => ({
          assetClass: a.assetClass,
          amount: a.amount,
          lifetime: a.lifetime,
          method: a.method,
        })),
      });
      const data = await res.json() as DepreciationResult;
      setResults(data);
    } catch (err) {
      console.error('Depreciation calculation failed:', err);
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

  const assetColors: Record<string, string> = {
    'Building/Structure': '#3b82f6',
    'Land Improvements': '#22c55e',
    'Personal Property': '#f59e0b',
    'Dock Systems': '#8b5cf6',
    'Mechanical/HVAC': '#ec4899',
    'Electrical Systems': '#06b6d4',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Depreciation Schedule</h2>
          <p className="text-muted-foreground">Cost segregation analysis and tax depreciation modeling</p>
        </div>
        <Button onClick={computeSchedule} disabled={computing || unallocated < 0}>
          <Calculator className="h-4 w-4 mr-2" />
          {computing ? 'Computing...' : 'Compute Schedule'}
        </Button>
      </div>

      {/* Inputs */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase & Allocation Inputs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Purchase Price ($)</Label>
              <Input type="number" value={purchasePrice} onChange={e => setPurchasePrice(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Land Value ($)</Label>
              <Input type="number" value={landValue} onChange={e => setLandValue(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="flex items-end">
              <div>
                <Label>Unallocated</Label>
                <p className={`text-lg font-semibold ${unallocated < 0 ? 'text-red-600' : unallocated > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {formatCurrency(unallocated)}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Improvement Allocations</h4>
              <Button variant="outline" size="sm" onClick={addAllocation}>
                <Plus className="h-4 w-4 mr-1" /> Add Allocation
              </Button>
            </div>
            {allocations.map(a => (
              <div key={a.id} className="grid grid-cols-5 gap-3 items-end">
                <div>
                  <Label>Asset Class</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={a.assetClass}
                    onChange={e => updateAllocation(a.id, 'assetClass', e.target.value)}
                  >
                    <option value="">Select...</option>
                    {DEFAULT_ASSET_CLASSES.map(ac => (
                      <option key={ac} value={ac}>{ac}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Amount ($)</Label>
                  <Input type="number" value={a.amount} onChange={e => updateAllocation(a.id, 'amount', parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>Lifetime (years)</Label>
                  <Input type="number" value={a.lifetime} onChange={e => updateAllocation(a.id, 'lifetime', parseInt(e.target.value) || 1)} />
                </div>
                <div>
                  <Label>Method</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={a.method}
                    onChange={e => updateAllocation(a.id, 'method', e.target.value as 'SL' | 'MACRS')}
                  >
                    <option value="SL">Straight-Line</option>
                    <option value="MACRS">MACRS</option>
                  </select>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeAllocation(a.id)} className="mb-0.5">
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      {results && (
        <div className="grid grid-cols-6 gap-4">
          {[
            { label: 'Total Basis', value: formatCurrency(results.totalBasis), icon: Building2 },
            { label: 'Depreciable Basis', value: formatCurrency(results.depreciableBasis), icon: DollarSign },
            { label: 'Total Tax Shield', value: formatCurrency(results.totalTaxShield), icon: DollarSign },
            { label: 'Adj. Basis at Exit', value: formatCurrency(results.adjustedBasisAtExit), icon: DollarSign },
            { label: 'Depreciation Recapture', value: formatCurrency(results.depreciationRecapture), icon: DollarSign },
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
        <div className="grid grid-cols-2 gap-6">
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
                      fill={assetColors[ac] || '#94a3b8'}
                      stroke={assetColors[ac] || '#94a3b8'}
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
          <CardContent className="overflow-x-auto">
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.schedule.map(row => (
                  <TableRow key={row.year}>
                    <TableCell className="font-medium">{row.year}</TableCell>
                    {results.assetClasses.map(ac => (
                      <TableCell key={ac} className="text-right">
                        {row.depreciationByClass[ac] ? formatCurrency(row.depreciationByClass[ac]) : '-'}
                      </TableCell>
                    ))}
                    <TableCell className="text-right font-medium">{formatCurrency(row.totalDepreciation)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.cumulativeDepreciation)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.remainingBasis)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
            <div className="grid grid-cols-4 gap-6">
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
                <p className="text-xl font-bold text-green-600">{formatCurrency(results.exchange1031.taxDeferred)}</p>
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
            <p className="text-sm mt-1">Configure allocations above and click "Compute Schedule" to generate the analysis.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default DepreciationSchedule;
