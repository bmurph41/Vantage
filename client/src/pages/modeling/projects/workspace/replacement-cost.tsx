import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { apiRequest } from '@/lib/queryClient';

interface ReplacementCostInputs {
  landValue: number;
  floatingDockCostPerLF: number;
  totalDockLinearFeet: number;
  pilingCost: number;
  pilingCount: number;
  electricalCostPerSlip: number;
  waterCostPerSlip: number;
  totalSlips: number;
  dryRackCostPerUnit: number;
  dryRackUnits: number;
  buildingCostPerSF: number;
  totalBuildingSF: number;
  softCostPct: number;
  developerProfitPct: number;
  acquisitionPrice: number;
}

interface CostComponent {
  category: string;
  amount: number;
  color: string;
}

interface ReplacementCostResult {
  totalReplacementCost: number;
  discountToReplacement: number;
  replacementMultiple: number;
  costPerSlip: number;
  components: CostComponent[];
  componentDetails: {
    category: string;
    unitCost: string;
    quantity: string;
    total: number;
    pctOfTotal: number;
  }[];
}

const defaultInputs: ReplacementCostInputs = {
  landValue: 8000000,
  floatingDockCostPerLF: 450,
  totalDockLinearFeet: 6000,
  pilingCost: 12000,
  pilingCount: 120,
  electricalCostPerSlip: 4500,
  waterCostPerSlip: 2500,
  totalSlips: 200,
  dryRackCostPerUnit: 8000,
  dryRackUnits: 80,
  buildingCostPerSF: 185,
  totalBuildingSF: 12000,
  softCostPct: 15,
  developerProfitPct: 12,
  acquisitionPrice: 18000000,
};

const componentColors: Record<string, string> = {
  'Land': '#3b82f6',
  'Floating Docks': '#06b6d4',
  'Pilings': '#8b5cf6',
  'Electrical': '#f59e0b',
  'Water': '#14b8a6',
  'Dry Racks': '#ec4899',
  'Buildings': '#6366f1',
  'Soft Costs': '#94a3b8',
  'Developer Profit': '#78716c',
};

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function ReplacementCost({ projectId, onTabChange }: { projectId: string; onTabChange?: (tab: string) => void }) {
  const [inputs, setInputs] = useState<ReplacementCostInputs>(defaultInputs);
  const [submitted, setSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState('inputs');

  const { data: result, isLoading, refetch } = useQuery<ReplacementCostResult>({
    queryKey: ['replacement-cost', projectId, submitted],
    queryFn: async () => {
      const res = await apiRequest('POST', '/api/institutional-analysis/replacement-cost', {
        projectId,
        ...inputs,
      });
      return res.json();
    },
    enabled: submitted,
  });

  const localCalc = useMemo(() => {
    const dockCost = inputs.floatingDockCostPerLF * inputs.totalDockLinearFeet;
    const pilingTotal = inputs.pilingCost * inputs.pilingCount;
    const electricalTotal = inputs.electricalCostPerSlip * inputs.totalSlips;
    const waterTotal = inputs.waterCostPerSlip * inputs.totalSlips;
    const dryRackTotal = inputs.dryRackCostPerUnit * inputs.dryRackUnits;
    const buildingTotal = inputs.buildingCostPerSF * inputs.totalBuildingSF;
    const hardCosts = dockCost + pilingTotal + electricalTotal + waterTotal + dryRackTotal + buildingTotal;
    const subtotal = inputs.landValue + hardCosts;
    const softCosts = subtotal * (inputs.softCostPct / 100);
    const devProfit = (subtotal + softCosts) * (inputs.developerProfitPct / 100);
    const totalReplacementCost = subtotal + softCosts + devProfit;
    const totalSlipEquiv = inputs.totalSlips + inputs.dryRackUnits;

    const components: CostComponent[] = [
      { category: 'Land', amount: inputs.landValue, color: componentColors['Land'] },
      { category: 'Floating Docks', amount: dockCost, color: componentColors['Floating Docks'] },
      { category: 'Pilings', amount: pilingTotal, color: componentColors['Pilings'] },
      { category: 'Electrical', amount: electricalTotal, color: componentColors['Electrical'] },
      { category: 'Water', amount: waterTotal, color: componentColors['Water'] },
      { category: 'Dry Racks', amount: dryRackTotal, color: componentColors['Dry Racks'] },
      { category: 'Buildings', amount: buildingTotal, color: componentColors['Buildings'] },
      { category: 'Soft Costs', amount: softCosts, color: componentColors['Soft Costs'] },
      { category: 'Developer Profit', amount: devProfit, color: componentColors['Developer Profit'] },
    ];

    const componentDetails = [
      { category: 'Land', unitCost: 'Lump Sum', quantity: '--', total: inputs.landValue, pctOfTotal: inputs.landValue / totalReplacementCost },
      { category: 'Floating Docks', unitCost: `$${inputs.floatingDockCostPerLF}/LF`, quantity: `${inputs.totalDockLinearFeet.toLocaleString()} LF`, total: dockCost, pctOfTotal: dockCost / totalReplacementCost },
      { category: 'Pilings', unitCost: `$${inputs.pilingCost.toLocaleString()}/ea`, quantity: `${inputs.pilingCount}`, total: pilingTotal, pctOfTotal: pilingTotal / totalReplacementCost },
      { category: 'Electrical', unitCost: `$${inputs.electricalCostPerSlip.toLocaleString()}/slip`, quantity: `${inputs.totalSlips} slips`, total: electricalTotal, pctOfTotal: electricalTotal / totalReplacementCost },
      { category: 'Water', unitCost: `$${inputs.waterCostPerSlip.toLocaleString()}/slip`, quantity: `${inputs.totalSlips} slips`, total: waterTotal, pctOfTotal: waterTotal / totalReplacementCost },
      { category: 'Dry Racks', unitCost: `$${inputs.dryRackCostPerUnit.toLocaleString()}/unit`, quantity: `${inputs.dryRackUnits} units`, total: dryRackTotal, pctOfTotal: dryRackTotal / totalReplacementCost },
      { category: 'Buildings', unitCost: `$${inputs.buildingCostPerSF}/SF`, quantity: `${inputs.totalBuildingSF.toLocaleString()} SF`, total: buildingTotal, pctOfTotal: buildingTotal / totalReplacementCost },
      { category: 'Soft Costs', unitCost: `${inputs.softCostPct}%`, quantity: 'of subtotal', total: softCosts, pctOfTotal: softCosts / totalReplacementCost },
      { category: 'Developer Profit', unitCost: `${inputs.developerProfitPct}%`, quantity: 'of total', total: devProfit, pctOfTotal: devProfit / totalReplacementCost },
    ];

    return {
      totalReplacementCost,
      discountToReplacement: (totalReplacementCost - inputs.acquisitionPrice) / totalReplacementCost,
      replacementMultiple: totalReplacementCost / inputs.acquisitionPrice,
      costPerSlip: totalSlipEquiv > 0 ? totalReplacementCost / totalSlipEquiv : 0,
      components,
      componentDetails,
    };
  }, [inputs]);

  const displayData = result || localCalc;

  const handleSubmit = () => {
    setSubmitted(true);
    refetch();
    setActiveTab('results');
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const gaugePercent = useMemo(() => {
    if (!displayData) return 0;
    return Math.min((inputs.acquisitionPrice / displayData.totalReplacementCost) * 100, 100);
  }, [inputs.acquisitionPrice, displayData]);

  const inputFields: { label: string; key: keyof ReplacementCostInputs; prefix?: string; suffix?: string }[] = [
    { label: 'Land Value', key: 'landValue', prefix: '$' },
    { label: 'Floating Dock Cost', key: 'floatingDockCostPerLF', prefix: '$', suffix: '/LF' },
    { label: 'Total Dock Linear Feet', key: 'totalDockLinearFeet', suffix: 'LF' },
    { label: 'Piling Cost', key: 'pilingCost', prefix: '$', suffix: '/ea' },
    { label: 'Piling Count', key: 'pilingCount' },
    { label: 'Electrical Cost', key: 'electricalCostPerSlip', prefix: '$', suffix: '/slip' },
    { label: 'Water Cost', key: 'waterCostPerSlip', prefix: '$', suffix: '/slip' },
    { label: 'Total Wet Slips', key: 'totalSlips' },
    { label: 'Dry Rack Cost', key: 'dryRackCostPerUnit', prefix: '$', suffix: '/unit' },
    { label: 'Dry Rack Units', key: 'dryRackUnits' },
    { label: 'Building Cost', key: 'buildingCostPerSF', prefix: '$', suffix: '/SF' },
    { label: 'Total Building SF', key: 'totalBuildingSF', suffix: 'SF' },
    { label: 'Soft Cost %', key: 'softCostPct', suffix: '%' },
    { label: 'Developer Profit %', key: 'developerProfitPct', suffix: '%' },
    { label: 'Acquisition Price', key: 'acquisitionPrice', prefix: '$' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Replacement Cost Analysis</h2>
        <p className="text-muted-foreground">Estimate cost to rebuild and compare against acquisition price</p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="inputs">Inputs</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="details">Component Details</TabsTrigger>
        </TabsList>

        <TabsContent value="inputs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Marina Cost Inputs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {inputFields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label className="text-xs">{field.label}</Label>
                    <div className="relative">
                      {field.prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{field.prefix}</span>}
                      <Input
                        type="number"
                        value={inputs[field.key]}
                        onChange={(e) => setInputs({ ...inputs, [field.key]: parseFloat(e.target.value) || 0 })}
                        className={field.prefix ? 'pl-7' : ''}
                      />
                      {field.suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">{field.suffix}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Button onClick={handleSubmit} disabled={isLoading} className="w-full md:w-auto">
            {isLoading ? 'Calculating...' : 'Calculate Replacement Cost'}
          </Button>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Replacement Cost</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(displayData.totalReplacementCost)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Discount to Replacement</p>
                <p className="text-2xl font-bold mt-1 text-green-600">{formatPct(displayData.discountToReplacement)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Replacement Multiple</p>
                <p className="text-2xl font-bold mt-1">{displayData.replacementMultiple.toFixed(2)}x</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Cost / Slip</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(displayData.costPerSlip)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Cost Components Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={displayData.components}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" angle={-35} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v: number) => formatCurrency(v)} />
                  <Tooltip formatter={(v: number) => formatCurrency(v as number)} />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {displayData.components.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Acquisition vs Replacement Cost</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span>Acquisition Price: {formatCurrency(inputs.acquisitionPrice)}</span>
                <span>Replacement Cost: {formatCurrency(displayData.totalReplacementCost)}</span>
              </div>
              <div className="relative w-full h-8 bg-muted rounded-full overflow-hidden">
                <div
                  className="absolute h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${gaugePercent}%`,
                    backgroundColor: gaugePercent < 70 ? '#10b981' : gaugePercent < 90 ? '#f59e0b' : '#ef4444',
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
                  {gaugePercent.toFixed(0)}% of Replacement Cost
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                {displayData.discountToReplacement > 0
                  ? `Acquiring at a ${formatPct(displayData.discountToReplacement)} discount to replacement cost provides a significant margin of safety.`
                  : `Acquisition price exceeds estimated replacement cost, suggesting limited replacement cost protection.`}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Component Detail Table</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Unit Cost</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">% of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayData.componentDetails.map((row) => (
                    <TableRow key={row.category}>
                      <TableCell className="font-medium">{row.category}</TableCell>
                      <TableCell>{row.unitCost}</TableCell>
                      <TableCell>{row.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.total)}</TableCell>
                      <TableCell className="text-right">{formatPct(row.pctOfTotal)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell colSpan={3}>Total Replacement Cost</TableCell>
                    <TableCell className="text-right">{formatCurrency(displayData.totalReplacementCost)}</TableCell>
                    <TableCell className="text-right">100.0%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ReplacementCost;
