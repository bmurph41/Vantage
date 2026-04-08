import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { apiRequest } from '@/lib/queryClient';
import { formatCurrency, formatPercent } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  DollarSign,
  Percent,
  Building,
  ArrowRight,
  Clock,
} from 'lucide-react';

interface StabilizedNOIProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

interface StabilizedInputs {
  currentOccupancy: number;
  stabilizedOccupancy: number;
  lossToLease: number;
  newRevenueStreams: number;
  operationalSavings: number;
  managementFeeChange: number;
  insuranceChange: number;
  monthsToStabilize: number;
}

interface NOIResult {
  inPlaceNOI: number;
  stabilizedNOI: number;
  noiDelta: number;
  valueDelta: number;
  inPlaceCapRate: number;
  stabilizedCapRate: number;
  waterfall: WaterfallItem[];
  adjustments: AdjustmentRow[];
  revenueComparison: ComparisonItem[];
  expenseComparison: ComparisonItem[];
}

interface WaterfallItem {
  name: string;
  value: number;
  cumulative: number;
  isTotal?: boolean;
}

interface AdjustmentRow {
  category: string;
  description: string;
  amount: number;
  timing: string;
}

interface ComparisonItem {
  category: string;
  inPlace: number;
  stabilized: number;
  delta: number;
}

const WATERFALL_COLORS: Record<string, string> = {
  'In-Place NOI': '#6366f1',
  'Occupancy Gain': '#22c55e',
  'Rent Bumps': '#3b82f6',
  'New Revenue': '#8b5cf6',
  'Expense Savings': '#f59e0b',
  'Stabilized NOI': '#10b981',
};

const DEFAULT_INPUTS: StabilizedInputs = {
  currentOccupancy: 82,
  stabilizedOccupancy: 95,
  lossToLease: 8,
  newRevenueStreams: 75000,
  operationalSavings: 45000,
  managementFeeChange: -0.5,
  insuranceChange: 2.0,
  monthsToStabilize: 18,
};

function StabilizedNOI({ projectId, onTabChange }: StabilizedNOIProps) {
  const [inputs, setInputs] = useState<StabilizedInputs>(DEFAULT_INPUTS);
  const [activeTab, setActiveTab] = useState('overview');
  const [isComputing, setIsComputing] = useState(false);

  const { data: result, refetch, isLoading } = useQuery<NOIResult>({
    queryKey: ['stabilized-noi', projectId, inputs],
    queryFn: async () => {
      setIsComputing(true);
      try {
        const res = await apiRequest('POST', '/api/institutional-analysis/stabilized-noi', {
          projectId,
          ...inputs,
        });
        return res.json();
      } finally {
        setIsComputing(false);
      }
    },
    enabled: false,
  });

  const waterfallData = useMemo(() => {
    if (!result?.waterfall) return [];
    return result.waterfall.map((item) => ({
      ...item,
      fill: WATERFALL_COLORS[item.name] || '#94a3b8',
      displayValue: item.isTotal ? item.cumulative : item.value,
    }));
  }, [result]);

  const updateInput = <K extends keyof StabilizedInputs>(key: K, value: StabilizedInputs[K]) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const handleCompute = () => {
    refetch();
  };

  const kpiCards = useMemo(() => {
    if (!result) return [];
    return [
      { label: 'In-Place NOI', value: formatCurrency(result.inPlaceNOI), icon: DollarSign, color: 'text-blue-600' },
      { label: 'Stabilized NOI', value: formatCurrency(result.stabilizedNOI), icon: TrendingUp, color: 'text-green-600' },
      { label: 'NOI Delta', value: formatCurrency(result.noiDelta), icon: result.noiDelta >= 0 ? TrendingUp : TrendingDown, color: result.noiDelta >= 0 ? 'text-green-600' : 'text-red-600' },
      { label: 'Value Delta', value: formatCurrency(result.valueDelta), icon: Building, color: 'text-purple-600' },
      { label: 'In-Place Cap Rate', value: formatPercent(result.inPlaceCapRate), icon: Percent, color: 'text-amber-600' },
      { label: 'Stabilized Cap Rate', value: formatPercent(result.stabilizedCapRate), icon: Percent, color: 'text-emerald-600' },
    ];
  }, [result]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Stabilized vs In-Place NOI</h2>
          <p className="text-muted-foreground">
            Model the impact of operational improvements on NOI and property value
          </p>
        </div>
        <Button onClick={handleCompute} disabled={isComputing || isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isComputing ? 'animate-spin' : ''}`} />
          {isComputing ? 'Computing...' : 'Compute Analysis'}
        </Button>
      </div>

      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Stabilization Assumptions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-3">
              <Label>Current Occupancy: {inputs.currentOccupancy}%</Label>
              <Slider
                value={[inputs.currentOccupancy]}
                onValueChange={([v]) => updateInput('currentOccupancy', v)}
                min={0}
                max={100}
                step={1}
              />
            </div>
            <div className="space-y-3">
              <Label>Stabilized Occupancy: {inputs.stabilizedOccupancy}%</Label>
              <Slider
                value={[inputs.stabilizedOccupancy]}
                onValueChange={([v]) => updateInput('stabilizedOccupancy', v)}
                min={0}
                max={100}
                step={1}
              />
            </div>
            <div className="space-y-3">
              <Label>Loss-to-Lease: {inputs.lossToLease}%</Label>
              <Slider
                value={[inputs.lossToLease]}
                onValueChange={([v]) => updateInput('lossToLease', v)}
                min={0}
                max={30}
                step={0.5}
              />
            </div>
            <div className="space-y-3">
              <Label>Months to Stabilize</Label>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  value={inputs.monthsToStabilize}
                  onChange={(e) => updateInput('monthsToStabilize', parseInt(e.target.value) || 0)}
                  min={1}
                  max={60}
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label>New Revenue Streams ($)</Label>
              <Input
                type="number"
                value={inputs.newRevenueStreams}
                onChange={(e) => updateInput('newRevenueStreams', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-3">
              <Label>Operational Savings ($)</Label>
              <Input
                type="number"
                value={inputs.operationalSavings}
                onChange={(e) => updateInput('operationalSavings', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-3">
              <Label>Management Fee Change: {inputs.managementFeeChange}%</Label>
              <Slider
                value={[inputs.managementFeeChange]}
                onValueChange={([v]) => updateInput('managementFeeChange', v)}
                min={-5}
                max={5}
                step={0.25}
              />
            </div>
            <div className="space-y-3">
              <Label>Insurance Change: {inputs.insuranceChange}%</Label>
              <Slider
                value={[inputs.insuranceChange]}
                onValueChange={([v]) => updateInput('insuranceChange', v)}
                min={-10}
                max={20}
                step={0.5}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      {result && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {kpiCards.map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                  <span className="text-xs text-muted-foreground">{kpi.label}</span>
                </div>
                <p className="text-lg font-bold">{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Main Content Tabs */}
      {result && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Waterfall</TabsTrigger>
            <TabsTrigger value="adjustments">Adjustments</TabsTrigger>
            <TabsTrigger value="comparison">Revenue / Expense</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">NOI Waterfall</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={waterfallData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis
                        dataKey="name"
                        angle={-30}
                        textAnchor="end"
                        height={80}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        formatter={(value: number) => [formatCurrency(value), 'Amount']}
                        labelStyle={{ fontWeight: 'bold' }}
                      />
                      <Bar dataKey="displayValue" radius={[4, 4, 0, 0]}>
                        {waterfallData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-6 mt-4 text-sm">
                  {Object.entries(WATERFALL_COLORS).map(([name, color]) => (
                    <div key={name} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                      <span className="text-muted-foreground">{name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="adjustments" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Stabilization Adjustments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Timing</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(result.adjustments ?? []).map((adj, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Badge variant={adj.amount >= 0 ? 'default' : 'destructive'}>
                            {adj.category}
                          </Badge>
                        </TableCell>
                        <TableCell>{adj.description}</TableCell>
                        <TableCell className={`text-right font-mono ${adj.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {adj.amount >= 0 ? '+' : ''}{formatCurrency(adj.amount)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{adj.timing}</TableCell>
                      </TableRow>
                    ))}
                    {(result.adjustments ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No adjustments computed. Click Compute Analysis to generate.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                </div>
                {(result.adjustments ?? []).length > 0 && (
                  <div className="flex justify-end mt-4 pt-4 border-t">
                    <div className="text-right">
                      <span className="text-sm text-muted-foreground mr-4">Total NOI Impact</span>
                      <span className={`text-lg font-bold ${result.noiDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {result.noiDelta >= 0 ? '+' : ''}{formatCurrency(result.noiDelta)}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comparison" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue Comparison */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    Revenue Comparison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">In-Place</TableHead>
                        <TableHead className="text-right">Stabilized</TableHead>
                        <TableHead className="text-right">Delta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(result.revenueComparison ?? []).map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.category}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(item.inPlace)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(item.stabilized)}</TableCell>
                          <TableCell className={`text-right font-mono ${item.delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            <div className="flex items-center justify-end gap-1">
                              {item.delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {item.delta >= 0 ? '+' : ''}{formatCurrency(item.delta)}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Expense Comparison */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-600" />
                    Expense Comparison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">In-Place</TableHead>
                        <TableHead className="text-right">Stabilized</TableHead>
                        <TableHead className="text-right">Delta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(result.expenseComparison ?? []).map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.category}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(item.inPlace)}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(item.stabilized)}</TableCell>
                          <TableCell className={`text-right font-mono ${item.delta <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            <div className="flex items-center justify-end gap-1">
                              {item.delta <= 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                              {item.delta >= 0 ? '+' : ''}{formatCurrency(item.delta)}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Summary Row */}
            <Card className="mt-4">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-base py-1 px-3">
                      In-Place NOI: {formatCurrency(result.inPlaceNOI)}
                    </Badge>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    <Badge variant="default" className="text-base py-1 px-3 bg-green-600">
                      Stabilized NOI: {formatCurrency(result.stabilizedNOI)}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Value Uplift</p>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(result.valueDelta)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Empty state */}
      {!result && !isLoading && (
        <Card>
          <CardContent className="py-16 text-center">
            <Building className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Configure Stabilization Assumptions</h3>
            <p className="text-muted-foreground mb-4">
              Adjust the inputs above and click Compute Analysis to see the stabilized NOI impact
            </p>
            <Button onClick={handleCompute}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Compute Analysis
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default StabilizedNOI;
