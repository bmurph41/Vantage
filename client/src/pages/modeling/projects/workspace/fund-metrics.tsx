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

interface CapitalEvent {
  date: string;
  amount: number;
}

interface FundMetricsInputs {
  vintageYear: number;
  capitalCommitments: number;
  capitalCalls: CapitalEvent[];
  distributions: CapitalEvent[];
  currentNAV: number;
  managementFeePct: number;
  carryPct: number;
  hurdleRate: number;
}

interface FundMetricsResult {
  moic: number;
  dpi: number;
  rvpi: number;
  tvpi: number;
  grossIrr: number;
  netIrr: number;
  fundAge: number;
  jCurveData: { quarter: string; netCashPosition: number }[];
  tvpiOverTime: { quarter: string; tvpi: number }[];
  benchmarkQuartiles: {
    metric: string;
    fundValue: number;
    topQuartile: number;
    median: number;
    bottomQuartile: number;
    percentileRank: number;
  }[];
  feeWaterfall: { category: string; amount: number; color: string }[];
}

const defaultInputs: FundMetricsInputs = {
  vintageYear: 2022,
  capitalCommitments: 100000000,
  capitalCalls: [
    { date: '2022-03-15', amount: 25000000 },
    { date: '2022-09-01', amount: 20000000 },
    { date: '2023-03-15', amount: 15000000 },
    { date: '2023-09-01', amount: 10000000 },
    { date: '2024-03-15', amount: 10000000 },
  ],
  distributions: [
    { date: '2024-06-15', amount: 8000000 },
    { date: '2025-01-15', amount: 12000000 },
    { date: '2025-06-15', amount: 18000000 },
  ],
  currentNAV: 72000000,
  managementFeePct: 2.0,
  carryPct: 20.0,
  hurdleRate: 8.0,
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

function formatMultiple(value: number): string {
  return `${value.toFixed(2)}x`;
}

export function FundMetrics({ projectId, onTabChange }: { projectId: string; onTabChange?: (tab: string) => void }) {
  const [inputs, setInputs] = useState<FundMetricsInputs>(defaultInputs);
  const [submitted, setSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState('inputs');

  const { data: result, isLoading, refetch } = useQuery<FundMetricsResult>({
    queryKey: ['fund-metrics', projectId, submitted],
    queryFn: async () => {
      const res = await apiRequest('POST', '/api/institutional-analysis/fund-metrics', {
        projectId,
        ...inputs,
      });
      return res.json();
    },
    enabled: submitted,
  });

  const handleSubmit = () => {
    setSubmitted(true);
    refetch();
    setActiveTab('results');
  };

  const updateCapitalCall = (index: number, field: keyof CapitalEvent, value: string) => {
    const updated = [...inputs.capitalCalls];
    if (field === 'amount') {
      updated[index] = { ...updated[index], amount: parseFloat(value) || 0 };
    } else {
      updated[index] = { ...updated[index], date: value };
    }
    setInputs({ ...inputs, capitalCalls: updated });
  };

  const updateDistribution = (index: number, field: keyof CapitalEvent, value: string) => {
    const updated = [...inputs.distributions];
    if (field === 'amount') {
      updated[index] = { ...updated[index], amount: parseFloat(value) || 0 };
    } else {
      updated[index] = { ...updated[index], date: value };
    }
    setInputs({ ...inputs, distributions: updated });
  };

  const addCapitalCall = () => {
    setInputs({ ...inputs, capitalCalls: [...inputs.capitalCalls, { date: '', amount: 0 }] });
  };

  const removeCapitalCall = (index: number) => {
    setInputs({ ...inputs, capitalCalls: inputs.capitalCalls.filter((_, i) => i !== index) });
  };

  const addDistribution = () => {
    setInputs({ ...inputs, distributions: [...inputs.distributions, { date: '', amount: 0 }] });
  };

  const removeDistribution = (index: number) => {
    setInputs({ ...inputs, distributions: inputs.distributions.filter((_, i) => i !== index) });
  };

  const localMetrics = useMemo(() => {
    const totalCalled = inputs.capitalCalls.reduce((s, c) => s + c.amount, 0);
    const totalDistributed = inputs.distributions.reduce((s, d) => s + d.amount, 0);
    if (totalCalled === 0) return null;
    const dpi = totalDistributed / totalCalled;
    const rvpi = inputs.currentNAV / totalCalled;
    const tvpi = dpi + rvpi;
    const moic = (totalDistributed + inputs.currentNAV) / totalCalled;
    const currentYear = new Date().getFullYear();
    const fundAge = currentYear - inputs.vintageYear;
    return { moic, dpi, rvpi, tvpi, fundAge, totalCalled, totalDistributed };
  }, [inputs]);

  const waterfallColors = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981'];

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Fund Performance Metrics</h2>
          <p className="text-muted-foreground">MOIC, DPI, RVPI, TVPI analysis with J-Curve visualization</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="inputs">Inputs</TabsTrigger>
          <TabsTrigger value="results" disabled={!result && !localMetrics}>Results</TabsTrigger>
          <TabsTrigger value="jcurve" disabled={!result}>J-Curve</TabsTrigger>
          <TabsTrigger value="benchmarks" disabled={!result}>Benchmarks</TabsTrigger>
          <TabsTrigger value="waterfall" disabled={!result}>Fee Waterfall</TabsTrigger>
        </TabsList>

        <TabsContent value="inputs" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Vintage Year</Label>
              <Input type="number" value={inputs.vintageYear} onChange={(e) => setInputs({ ...inputs, vintageYear: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Capital Commitments ($)</Label>
              <Input type="number" value={inputs.capitalCommitments} onChange={(e) => setInputs({ ...inputs, capitalCommitments: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Current NAV ($)</Label>
              <Input type="number" value={inputs.currentNAV} onChange={(e) => setInputs({ ...inputs, currentNAV: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Management Fee (%)</Label>
              <Input type="number" step="0.1" value={inputs.managementFeePct} onChange={(e) => setInputs({ ...inputs, managementFeePct: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Carry (%)</Label>
              <Input type="number" step="0.1" value={inputs.carryPct} onChange={(e) => setInputs({ ...inputs, carryPct: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Hurdle Rate (%)</Label>
              <Input type="number" step="0.1" value={inputs.hurdleRate} onChange={(e) => setInputs({ ...inputs, hurdleRate: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Capital Calls</CardTitle>
              <Button variant="outline" size="sm" onClick={addCapitalCall}>Add Call</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount ($)</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inputs.capitalCalls.map((call, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Input type="date" value={call.date} onChange={(e) => updateCapitalCall(idx, 'date', e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={call.amount} onChange={(e) => updateCapitalCall(idx, 'amount', e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => removeCapitalCall(idx)}>X</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Distributions</CardTitle>
              <Button variant="outline" size="sm" onClick={addDistribution}>Add Distribution</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount ($)</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inputs.distributions.map((dist, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Input type="date" value={dist.date} onChange={(e) => updateDistribution(idx, 'date', e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <Input type="number" value={dist.amount} onChange={(e) => updateDistribution(idx, 'amount', e.target.value)} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => removeDistribution(idx)}>X</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Button onClick={handleSubmit} disabled={isLoading} className="w-full md:w-auto">
            {isLoading ? 'Calculating...' : 'Calculate Fund Metrics'}
          </Button>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {[
              { label: 'MOIC', value: formatMultiple(result?.moic ?? localMetrics?.moic ?? 0) },
              { label: 'DPI', value: formatMultiple(result?.dpi ?? localMetrics?.dpi ?? 0) },
              { label: 'RVPI', value: formatMultiple(result?.rvpi ?? localMetrics?.rvpi ?? 0) },
              { label: 'TVPI', value: formatMultiple(result?.tvpi ?? localMetrics?.tvpi ?? 0) },
              { label: 'Gross IRR', value: result ? formatPct(result.grossIrr) : '--' },
              { label: 'Net IRR', value: result ? formatPct(result.netIrr) : '--' },
              { label: 'Fund Age', value: `${result?.fundAge ?? localMetrics?.fundAge ?? 0} yrs` },
            ].map((kpi) => (
              <Card key={kpi.label}>
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                  <p className="text-2xl font-bold mt-1">{kpi.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {result?.tvpiOverTime && (
            <Card>
              <CardHeader>
                <CardTitle>TVPI Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={result.tvpiOverTime}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="quarter" />
                    <YAxis domain={[0, 'auto']} tickFormatter={(v: number) => `${v.toFixed(1)}x`} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(2)}x`} />
                    <Line type="monotone" dataKey="tvpi" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="jcurve" className="space-y-6">
          {result?.jCurveData && (
            <Card>
              <CardHeader>
                <CardTitle>J-Curve: Net Cash Position Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={result.jCurveData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="quarter" />
                    <YAxis tickFormatter={(v: number) => formatCurrency(v)} />
                    <Tooltip formatter={(v: number) => formatCurrency(v as number)} />
                    <Legend />
                    <Line type="monotone" dataKey="netCashPosition" name="Net Cash Position" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-sm text-muted-foreground mt-4">
                  The J-Curve illustrates the typical pattern where fund returns are negative early on due to capital calls and fees, then inflect upward as portfolio companies mature and exits generate distributions.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="benchmarks" className="space-y-6">
          {result?.benchmarkQuartiles && (
            <Card>
              <CardHeader>
                <CardTitle>Benchmark Quartile Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Metric</TableHead>
                      <TableHead className="text-right">Fund Value</TableHead>
                      <TableHead className="text-right">Top Quartile</TableHead>
                      <TableHead className="text-right">Median</TableHead>
                      <TableHead className="text-right">Bottom Quartile</TableHead>
                      <TableHead className="text-right">Percentile Rank</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.benchmarkQuartiles.map((row) => (
                      <TableRow key={row.metric}>
                        <TableCell className="font-medium">{row.metric}</TableCell>
                        <TableCell className="text-right font-semibold">{row.metric.includes('IRR') ? formatPct(row.fundValue) : formatMultiple(row.fundValue)}</TableCell>
                        <TableCell className="text-right">{row.metric.includes('IRR') ? formatPct(row.topQuartile) : formatMultiple(row.topQuartile)}</TableCell>
                        <TableCell className="text-right">{row.metric.includes('IRR') ? formatPct(row.median) : formatMultiple(row.median)}</TableCell>
                        <TableCell className="text-right">{row.metric.includes('IRR') ? formatPct(row.bottomQuartile) : formatMultiple(row.bottomQuartile)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={row.percentileRank >= 75 ? 'default' : row.percentileRank >= 50 ? 'secondary' : 'destructive'}>
                            {row.percentileRank}th
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="waterfall" className="space-y-6">
          {result?.feeWaterfall && (
            <Card>
              <CardHeader>
                <CardTitle>Fee Waterfall: Gross to Net Returns</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={result.feeWaterfall} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v: number) => formatCurrency(v)} />
                    <YAxis dataKey="category" type="category" width={140} />
                    <Tooltip formatter={(v: number) => formatCurrency(v as number)} />
                    <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                      {result.feeWaterfall.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || waterfallColors[index % waterfallColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  {result.feeWaterfall.map((item, idx) => (
                    <div key={idx} className="text-center">
                      <div className="w-3 h-3 rounded-full mx-auto mb-1" style={{ backgroundColor: item.color || waterfallColors[idx % waterfallColors.length] }} />
                      <p className="text-xs text-muted-foreground">{item.category}</p>
                      <p className="text-sm font-semibold">{formatCurrency(item.amount)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default FundMetrics;
