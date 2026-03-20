import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { apiRequest } from '@/lib/queryClient';
import { Save, Plus, Trash2, Target, Scale } from 'lucide-react';

interface Comp {
  id: string;
  name: string;
  salePrice: number;
  adjustments: Record<string, number>;
  weight: number;
}

interface SubjectProperty {
  name: string;
  address: string;
  slips: number;
  yearBuilt: number;
  occupancy: number;
  salePrice?: number;
}

interface GridResult {
  comps: Array<{
    id: string;
    name: string;
    salePrice: number;
    totalAdjustment: number;
    adjustedPrice: number;
    grossAdjustmentPct: number;
    weight: number;
  }>;
  weightedIndicatedValue: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  confidenceScore: number;
  valueLow: number;
  valueHigh: number;
}

interface CompAdjustmentGridProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

const ADJUSTMENT_FACTORS = [
  'Location',
  'Size',
  'Age/Condition',
  'Amenities',
  'Market Conditions',
  'Access/Visibility',
  'Occupancy',
];

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

const confidenceColors: Record<string, string> = {
  high: 'bg-green-100 text-green-800 border-green-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  low: 'bg-red-100 text-red-800 border-red-300',
};

export function CompAdjustmentGrid({ projectId, onTabChange }: CompAdjustmentGridProps) {
  const [subject, setSubject] = useState<SubjectProperty>({
    name: '',
    address: '',
    slips: 0,
    yearBuilt: 2000,
    occupancy: 0.9,
  });

  const [comps, setComps] = useState<Comp[]>([
    {
      id: 'comp-1',
      name: 'Comp 1',
      salePrice: 0,
      adjustments: Object.fromEntries(ADJUSTMENT_FACTORS.map(f => [f, 0])),
      weight: 0.33,
    },
    {
      id: 'comp-2',
      name: 'Comp 2',
      salePrice: 0,
      adjustments: Object.fromEntries(ADJUSTMENT_FACTORS.map(f => [f, 0])),
      weight: 0.34,
    },
    {
      id: 'comp-3',
      name: 'Comp 3',
      salePrice: 0,
      adjustments: Object.fromEntries(ADJUSTMENT_FACTORS.map(f => [f, 0])),
      weight: 0.33,
    },
  ]);

  const [results, setResults] = useState<GridResult | null>(null);
  const [saving, setSaving] = useState(false);

  const addComp = () => {
    const newId = `comp-${Date.now()}`;
    const count = comps.length + 1;
    setComps(prev => [
      ...prev,
      {
        id: newId,
        name: `Comp ${count}`,
        salePrice: 0,
        adjustments: Object.fromEntries(ADJUSTMENT_FACTORS.map(f => [f, 0])),
        weight: 0,
      },
    ]);
  };

  const removeComp = (id: string) => {
    setComps(prev => prev.filter(c => c.id !== id));
  };

  const updateCompField = (id: string, field: string, value: string | number) => {
    setComps(prev =>
      prev.map(c => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const updateAdjustment = (compId: string, factor: string, value: number) => {
    setComps(prev =>
      prev.map(c =>
        c.id === compId
          ? { ...c, adjustments: { ...c.adjustments, [factor]: value } }
          : c
      )
    );
  };

  const computedComps = useMemo(() => {
    return comps.map(c => {
      const totalAdj = Object.values(c.adjustments).reduce((sum, v) => sum + v, 0);
      const adjustedPrice = c.salePrice + totalAdj;
      const grossPct = c.salePrice > 0 ? Math.abs(totalAdj) / c.salePrice : 0;
      return {
        ...c,
        totalAdjustment: totalAdj,
        adjustedPrice,
        grossAdjustmentPct: grossPct,
      };
    });
  }, [comps]);

  const weightedValue = useMemo(() => {
    const totalWeight = comps.reduce((s, c) => s + c.weight, 0);
    if (totalWeight === 0) return 0;
    return computedComps.reduce((sum, c) => sum + c.adjustedPrice * (c.weight / totalWeight), 0);
  }, [computedComps, comps]);

  const localConfidence = useMemo(() => {
    const maxGross = Math.max(...computedComps.map(c => c.grossAdjustmentPct));
    if (maxGross <= 0.15) return 'high';
    if (maxGross <= 0.25) return 'medium';
    return 'low';
  }, [computedComps]);

  const saveGrid = async () => {
    setSaving(true);
    try {
      const res = await apiRequest('POST', '/api/institutional-analysis/comp-adjustment-grid', {
        projectId,
        subject,
        comps: comps.map(c => ({
          id: c.id,
          name: c.name,
          salePrice: c.salePrice,
          adjustments: c.adjustments,
          weight: c.weight,
        })),
      });
      const data = await res.json() as GridResult;
      setResults(data);
    } catch (err) {
      console.error('Failed to save comp grid:', err);
    } finally {
      setSaving(false);
    }
  };

  const adjustedPrices = computedComps.map(c => c.adjustedPrice).filter(p => p > 0);
  const rangeLow = adjustedPrices.length > 0 ? Math.min(...adjustedPrices) : 0;
  const rangeHigh = adjustedPrices.length > 0 ? Math.max(...adjustedPrices) : 0;
  const rangeSpread = rangeHigh - rangeLow;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Comp Adjustment Grid</h2>
          <p className="text-muted-foreground">Institutional sales comparison approach with quantified adjustments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={addComp}>
            <Plus className="h-4 w-4 mr-2" /> Add Comp
          </Button>
          <Button onClick={saveGrid} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save & Analyze'}
          </Button>
        </div>
      </div>

      {/* Subject Property */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" /> Subject Property
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4">
            <div>
              <Label>Property Name</Label>
              <Input value={subject.name} onChange={e => setSubject(p => ({ ...p, name: e.target.value }))} placeholder="Subject marina" />
            </div>
            <div>
              <Label>Address</Label>
              <Input value={subject.address} onChange={e => setSubject(p => ({ ...p, address: e.target.value }))} placeholder="123 Harbor Dr" />
            </div>
            <div>
              <Label>Slips</Label>
              <Input type="number" value={subject.slips} onChange={e => setSubject(p => ({ ...p, slips: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <Label>Year Built</Label>
              <Input type="number" value={subject.yearBuilt} onChange={e => setSubject(p => ({ ...p, yearBuilt: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <Label>Occupancy (%)</Label>
              <Input type="number" value={(subject.occupancy * 100).toFixed(0)} onChange={e => setSubject(p => ({ ...p, occupancy: (parseFloat(e.target.value) || 0) / 100 }))} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Adjustment Grid Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" /> Adjustment Grid
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[160px] sticky left-0 bg-background z-10">Factor</TableHead>
                {comps.map(c => (
                  <TableHead key={c.id} className="min-w-[150px] text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Input
                        value={c.name}
                        onChange={e => updateCompField(c.id, 'name', e.target.value)}
                        className="h-7 text-xs text-center w-24"
                      />
                      {comps.length > 1 && (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeComp(c.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Sale Price Row */}
              <TableRow className="bg-muted/30">
                <TableCell className="font-medium sticky left-0 bg-muted/30">Sale Price</TableCell>
                {comps.map(c => (
                  <TableCell key={c.id} className="text-center">
                    <Input
                      type="number"
                      value={c.salePrice}
                      onChange={e => updateCompField(c.id, 'salePrice', parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs text-center"
                    />
                  </TableCell>
                ))}
              </TableRow>

              {/* Adjustment Factor Rows */}
              {ADJUSTMENT_FACTORS.map(factor => (
                <TableRow key={factor}>
                  <TableCell className="font-medium sticky left-0 bg-background">{factor}</TableCell>
                  {comps.map(c => (
                    <TableCell key={c.id} className="text-center">
                      <Input
                        type="number"
                        value={c.adjustments[factor] || 0}
                        onChange={e => updateAdjustment(c.id, factor, parseFloat(e.target.value) || 0)}
                        className={`h-8 text-xs text-center ${
                          (c.adjustments[factor] || 0) > 0
                            ? 'text-green-700 bg-green-50'
                            : (c.adjustments[factor] || 0) < 0
                            ? 'text-red-700 bg-red-50'
                            : ''
                        }`}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

              {/* Total Adjustments */}
              <TableRow className="border-t-2 font-semibold">
                <TableCell className="sticky left-0 bg-background">Total Adjustments</TableCell>
                {computedComps.map(c => (
                  <TableCell key={c.id} className={`text-center ${c.totalAdjustment >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {c.totalAdjustment >= 0 ? '+' : ''}{formatCurrency(c.totalAdjustment)}
                  </TableCell>
                ))}
              </TableRow>

              {/* Adjusted Price */}
              <TableRow className="font-semibold bg-muted/30">
                <TableCell className="sticky left-0 bg-muted/30">Adjusted Price</TableCell>
                {computedComps.map(c => (
                  <TableCell key={c.id} className="text-center">
                    {formatCurrency(c.adjustedPrice)}
                  </TableCell>
                ))}
              </TableRow>

              {/* Gross Adjustment % */}
              <TableRow>
                <TableCell className="sticky left-0 bg-background text-muted-foreground">Gross Adj. %</TableCell>
                {computedComps.map(c => (
                  <TableCell key={c.id} className={`text-center text-xs ${
                    c.grossAdjustmentPct > 0.25 ? 'text-red-600' : c.grossAdjustmentPct > 0.15 ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {(c.grossAdjustmentPct * 100).toFixed(1)}%
                  </TableCell>
                ))}
              </TableRow>

              {/* Weight */}
              <TableRow className="border-t-2">
                <TableCell className="font-medium sticky left-0 bg-background">Weight</TableCell>
                {comps.map(c => (
                  <TableCell key={c.id} className="text-center">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      value={c.weight}
                      onChange={e => updateCompField(c.id, 'weight', parseFloat(e.target.value) || 0)}
                      className="h-8 text-xs text-center"
                    />
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Weighted Indicated Value */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-1">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground mb-1">Weighted Indicated Value</p>
            <p className="text-3xl font-bold">{formatCurrency(weightedValue)}</p>
            <div className="mt-3">
              <Badge className={`${confidenceColors[localConfidence]} border`}>
                {localConfidence.charAt(0).toUpperCase() + localConfidence.slice(1)} Confidence
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Value Range Indicator</CardTitle>
          </CardHeader>
          <CardContent>
            {adjustedPrices.length > 0 ? (
              <div className="space-y-3">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{formatCurrency(rangeLow)}</span>
                  <span>{formatCurrency(rangeHigh)}</span>
                </div>
                <div className="relative h-6 bg-gradient-to-r from-blue-100 via-blue-200 to-blue-100 rounded-full">
                  {/* Indicated value marker */}
                  <div
                    className="absolute top-0 h-6 w-1 bg-blue-600 rounded"
                    style={{
                      left: rangeSpread > 0
                        ? `${((weightedValue - rangeLow) / rangeSpread) * 100}%`
                        : '50%',
                    }}
                  />
                  {/* Comp markers */}
                  {computedComps.map(c => (
                    c.adjustedPrice > 0 && (
                      <div
                        key={c.id}
                        className="absolute top-1 h-4 w-4 -ml-2 rounded-full border-2 border-white bg-gray-500 opacity-60"
                        style={{
                          left: rangeSpread > 0
                            ? `${((c.adjustedPrice - rangeLow) / rangeSpread) * 100}%`
                            : '50%',
                        }}
                        title={`${c.name}: ${formatCurrency(c.adjustedPrice)}`}
                      />
                    )
                  ))}
                </div>
                <div className="text-center text-sm">
                  <span className="font-medium">Indicated: </span>
                  <span className="text-blue-600 font-bold">{formatCurrency(weightedValue)}</span>
                  <span className="text-muted-foreground ml-2">
                    (Range spread: {rangeSpread > 0 ? formatCurrency(rangeSpread) : 'N/A'})
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Enter comp sale prices to see the value range.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Server Results */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Server Indicated Value</p>
                <p className="text-2xl font-bold">{formatCurrency(results.weightedIndicatedValue)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Confidence</p>
                <Badge className={`${confidenceColors[results.confidenceLevel]} border mt-1`}>
                  {results.confidenceLevel.charAt(0).toUpperCase() + results.confidenceLevel.slice(1)} ({results.confidenceScore.toFixed(0)}%)
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Value Range Low</p>
                <p className="text-xl font-semibold">{formatCurrency(results.valueLow)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Value Range High</p>
                <p className="text-xl font-semibold">{formatCurrency(results.valueHigh)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default CompAdjustmentGrid;
