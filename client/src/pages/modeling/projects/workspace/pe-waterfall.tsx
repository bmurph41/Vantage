import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { apiRequest } from '@/lib/queryClient';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import {
  TrendingUp,
  RefreshCw,
  DollarSign,
  Percent,
  Users,
  Briefcase,
  ArrowRight,
  Layers,
  Shield,
  Scale,
} from 'lucide-react';

interface PEWaterfallProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

interface WaterfallInputs {
  lpEquity: number;
  gpEquity: number;
  preferredRate: number;
  catchUpPercent: number;
  carryPercent: number;
  holdPeriod: number;
}

interface WaterfallTier {
  tierName: string;
  tierDescription: string;
  lpDistribution: number;
  gpDistribution: number;
  cumulativeLP: number;
  cumulativeGP: number;
  lpPercent: number;
  gpPercent: number;
}

interface WaterfallBarData {
  name: string;
  LP: number;
  GP: number;
}

interface WaterfallResult {
  totalToLP: number;
  totalToGP: number;
  lpIRR: number;
  gpIRR: number;
  lpMultiple: number;
  gpMultiple: number;
  gpPromoteShare: number;
  clawback: number;
  tiers: WaterfallTier[];
  waterfallBars: WaterfallBarData[];
  lpMetrics: PartnerMetrics;
  gpMetrics: PartnerMetrics;
}

interface PartnerMetrics {
  totalContribution: number;
  totalDistribution: number;
  netProfit: number;
  irr: number;
  multiple: number;
  profitShare: number;
  preferredReturn: number;
  excessReturn: number;
}

const LP_COLOR = '#6366f1';
const GP_COLOR = '#f59e0b';

const DEFAULT_INPUTS: WaterfallInputs = {
  lpEquity: 9000000,
  gpEquity: 1000000,
  preferredRate: 8.0,
  catchUpPercent: 50,
  carryPercent: 20,
  holdPeriod: 5,
};

function PEWaterfall({ projectId, onTabChange }: PEWaterfallProps) {
  const [inputs, setInputs] = useState<WaterfallInputs>(DEFAULT_INPUTS);
  const [activeTab, setActiveTab] = useState('visualization');
  const [isComputing, setIsComputing] = useState(false);

  const { data: result, refetch, isLoading } = useQuery<WaterfallResult>({
    queryKey: ['pe-waterfall', projectId, inputs],
    queryFn: async () => {
      setIsComputing(true);
      try {
        const res = await apiRequest('POST', '/api/institutional-analysis/pe-waterfall', {
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

  const updateInput = <K extends keyof WaterfallInputs>(key: K, value: WaterfallInputs[K]) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const handleCompute = () => {
    refetch();
  };

  const totalEquity = inputs.lpEquity + inputs.gpEquity;
  const lpPercent = totalEquity > 0 ? (inputs.lpEquity / totalEquity) * 100 : 0;

  const kpiCards = useMemo(() => {
    if (!result) return [];
    return [
      { label: 'Total to LP', value: formatCurrency(result.totalToLP), icon: Users, color: 'text-indigo-600' },
      { label: 'Total to GP', value: formatCurrency(result.totalToGP), icon: Briefcase, color: 'text-amber-600' },
      { label: 'LP IRR', value: formatPercent(result.lpIRR), icon: TrendingUp, color: 'text-indigo-600' },
      { label: 'GP IRR', value: formatPercent(result.gpIRR), icon: TrendingUp, color: 'text-amber-600' },
      { label: 'LP Multiple', value: `${result.lpMultiple.toFixed(2)}x`, icon: DollarSign, color: 'text-indigo-600' },
      { label: 'GP Multiple', value: `${result.gpMultiple.toFixed(2)}x`, icon: DollarSign, color: 'text-amber-600' },
      { label: 'GP Promote Share', value: formatPercent(result.gpPromoteShare), icon: Percent, color: 'text-green-600' },
      { label: 'Clawback', value: formatCurrency(result.clawback), icon: Shield, color: result.clawback > 0 ? 'text-red-600' : 'text-gray-400' },
    ];
  }, [result]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">PE Waterfall Distributions</h2>
          <p className="text-muted-foreground">
            Model LP/GP distribution waterfalls with preferred return, catch-up, and carried interest
          </p>
        </div>
        <Button onClick={handleCompute} disabled={isComputing || isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isComputing ? 'animate-spin' : ''}`} />
          {isComputing ? 'Computing...' : 'Compute Waterfall'}
        </Button>
      </div>

      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Waterfall Structure
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-3">
              <Label>LP Equity</Label>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  value={inputs.lpEquity}
                  onChange={(e) => updateInput('lpEquity', parseFloat(e.target.value) || 0)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {lpPercent.toFixed(1)}% of total equity ({formatCurrency(totalEquity)})
              </p>
            </div>
            <div className="space-y-3">
              <Label>GP Equity</Label>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  value={inputs.gpEquity}
                  onChange={(e) => updateInput('gpEquity', parseFloat(e.target.value) || 0)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {(100 - lpPercent).toFixed(1)}% of total equity
              </p>
            </div>
            <div className="space-y-3">
              <Label>Hold Period (years)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={inputs.holdPeriod}
                  onChange={(e) => updateInput('holdPeriod', parseInt(e.target.value) || 1)}
                  min={1}
                  max={15}
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label>Preferred Rate: {inputs.preferredRate.toFixed(1)}%</Label>
              <Slider
                value={[inputs.preferredRate]}
                onValueChange={([v]) => updateInput('preferredRate', v)}
                min={0}
                max={15}
                step={0.25}
              />
              <p className="text-xs text-muted-foreground">Hurdle rate before GP promote kicks in</p>
            </div>
            <div className="space-y-3">
              <Label>GP Catch-Up: {inputs.catchUpPercent}%</Label>
              <Slider
                value={[inputs.catchUpPercent]}
                onValueChange={([v]) => updateInput('catchUpPercent', v)}
                min={0}
                max={100}
                step={5}
              />
              <p className="text-xs text-muted-foreground">Percent of profits to GP until parity</p>
            </div>
            <div className="space-y-3">
              <Label>Carried Interest: {inputs.carryPercent}%</Label>
              <Slider
                value={[inputs.carryPercent]}
                onValueChange={([v]) => updateInput('carryPercent', v)}
                min={0}
                max={50}
                step={1}
              />
              <p className="text-xs text-muted-foreground">GP share of profits above pref after catch-up</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      {result && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {kpiCards.map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="pt-3 pb-2 px-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                  <span className="text-[11px] text-muted-foreground leading-tight">{kpi.label}</span>
                </div>
                <p className="text-sm font-bold">{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Main Content */}
      {result && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="visualization">Waterfall Chart</TabsTrigger>
            <TabsTrigger value="tiers">Tier Detail</TabsTrigger>
            <TabsTrigger value="comparison">LP vs GP</TabsTrigger>
          </TabsList>

          {/* Waterfall Visualization */}
          <TabsContent value="visualization" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Distribution Waterfall</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={result.waterfallBars}
                      layout="vertical"
                      margin={{ top: 10, right: 30, left: 120, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" horizontal={false} />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        width={110}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [formatCurrency(value), name]}
                        labelStyle={{ fontWeight: 'bold' }}
                      />
                      <Legend />
                      <Bar dataKey="LP" stackId="a" fill={LP_COLOR} radius={[0, 0, 0, 0]} name="LP" />
                      <Bar dataKey="GP" stackId="a" fill={GP_COLOR} radius={[0, 4, 4, 0]} name="GP" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-8 mt-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: LP_COLOR }} />
                    <span className="text-muted-foreground">LP Distributions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: GP_COLOR }} />
                    <span className="text-muted-foreground">GP Distributions</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tier Detail Table */}
          <TabsContent value="tiers" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Tier Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tier</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">LP Distribution</TableHead>
                      <TableHead className="text-right">GP Distribution</TableHead>
                      <TableHead className="text-right">LP %</TableHead>
                      <TableHead className="text-right">GP %</TableHead>
                      <TableHead className="text-right">Cumulative LP</TableHead>
                      <TableHead className="text-right">Cumulative GP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(result.tiers ?? []).map((tier, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Badge
                            variant={idx === 0 ? 'default' : 'outline'}
                            className={idx === 0 ? 'bg-indigo-600' : ''}
                          >
                            {tier.tierName}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{tier.tierDescription}</TableCell>
                        <TableCell className="text-right font-mono text-indigo-600">
                          {formatCurrency(tier.lpDistribution)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-amber-600">
                          {formatCurrency(tier.gpDistribution)}
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatPercent(tier.lpPercent)}</TableCell>
                        <TableCell className="text-right font-mono">{formatPercent(tier.gpPercent)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold text-indigo-700">
                          {formatCurrency(tier.cumulativeLP)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-amber-700">
                          {formatCurrency(tier.cumulativeGP)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(result.tiers ?? []).length > 0 && (
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell colSpan={2}>Total</TableCell>
                        <TableCell className="text-right font-mono text-indigo-600">
                          {formatCurrency(result.totalToLP)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-amber-600">
                          {formatCurrency(result.totalToGP)}
                        </TableCell>
                        <TableCell colSpan={2} />
                        <TableCell className="text-right font-mono text-indigo-700">
                          {formatCurrency(result.totalToLP)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-amber-700">
                          {formatCurrency(result.totalToGP)}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* LP vs GP Comparison */}
          <TabsContent value="comparison" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LP Summary */}
              <Card className="border-indigo-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-4 w-4 text-indigo-600" />
                    Limited Partner (LP)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {result.lpMetrics && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Contribution</p>
                          <p className="text-lg font-semibold">{formatCurrency(result.lpMetrics.totalContribution)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Distribution</p>
                          <p className="text-lg font-semibold text-indigo-600">
                            {formatCurrency(result.lpMetrics.totalDistribution)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Net Profit</p>
                          <p className={`text-lg font-semibold ${result.lpMetrics.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(result.lpMetrics.netProfit)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">IRR</p>
                          <p className="text-lg font-semibold">{formatPercent(result.lpMetrics.irr)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Equity Multiple</p>
                          <p className="text-lg font-semibold">{result.lpMetrics.multiple.toFixed(2)}x</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Profit Share</p>
                          <p className="text-lg font-semibold">{formatPercent(result.lpMetrics.profitShare)}</p>
                        </div>
                      </div>
                      <div className="pt-3 border-t space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Preferred Return</span>
                          <span className="font-mono">{formatCurrency(result.lpMetrics.preferredReturn)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Excess Return</span>
                          <span className="font-mono">{formatCurrency(result.lpMetrics.excessReturn)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* GP Summary */}
              <Card className="border-amber-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-amber-600" />
                    General Partner (GP)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {result.gpMetrics && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Contribution</p>
                          <p className="text-lg font-semibold">{formatCurrency(result.gpMetrics.totalContribution)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Distribution</p>
                          <p className="text-lg font-semibold text-amber-600">
                            {formatCurrency(result.gpMetrics.totalDistribution)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Net Profit</p>
                          <p className={`text-lg font-semibold ${result.gpMetrics.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(result.gpMetrics.netProfit)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">IRR</p>
                          <p className="text-lg font-semibold">{formatPercent(result.gpMetrics.irr)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Equity Multiple</p>
                          <p className="text-lg font-semibold">{result.gpMetrics.multiple.toFixed(2)}x</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Profit Share</p>
                          <p className="text-lg font-semibold">{formatPercent(result.gpMetrics.profitShare)}</p>
                        </div>
                      </div>
                      <div className="pt-3 border-t space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Preferred Return</span>
                          <span className="font-mono">{formatCurrency(result.gpMetrics.preferredReturn)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Excess Return (Promote)</span>
                          <span className="font-mono font-semibold text-amber-600">
                            {formatCurrency(result.gpMetrics.excessReturn)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Comparison Summary Bar */}
            <Card className="mt-4">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: LP_COLOR }} />
                      <span className="text-sm font-medium">LP: {formatCurrency(result.totalToLP)}</span>
                      <Badge variant="outline">{result.lpMultiple.toFixed(2)}x</Badge>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <Scale className="h-5 w-5 text-muted-foreground" />
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: GP_COLOR }} />
                      <span className="text-sm font-medium">GP: {formatCurrency(result.totalToGP)}</span>
                      <Badge variant="outline">{result.gpMultiple.toFixed(2)}x</Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">GP Promote as % of Profit</p>
                    <p className="text-lg font-bold text-amber-600">{formatPercent(result.gpPromoteShare)}</p>
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
            <Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Configure Waterfall Structure</h3>
            <p className="text-muted-foreground mb-4">
              Set LP/GP equity splits, preferred return, and promote terms, then click Compute Waterfall
            </p>
            <Button onClick={handleCompute}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Compute Waterfall
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default PEWaterfall;
