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
import { AlertTriangle, Plus, Trash2, Play, TrendingDown } from 'lucide-react';

interface StressScenario {
  id: string;
  name: string;
  description: string;
  assumptions: {
    occupancyShock?: number;
    revenueShock?: number;
    expenseShock?: number;
    capRateShift?: number;
    interestRateShift?: number;
    rentDecline?: number;
  };
  enabled: boolean;
}

interface StressResult {
  scenarioId: string;
  scenarioName: string;
  stressedNOI: number;
  stressedValue: number;
  dscr: number;
  ltv: number;
  irr: number;
  equityMultiple: number;
  covenantBreach: boolean;
  ltcExceeds100: boolean;
  valueLoss: number;
  valueLossPct: number;
}

interface StressTestResponse {
  baseCase: {
    noi: number;
    value: number;
    dscr: number;
    ltv: number;
    irr: number;
    equityMultiple: number;
  };
  results: StressResult[];
}

interface StressTestingProps {
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

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function getHeatColor(metric: string, value: number, baseValue: number): string {
  const ratio = value / baseValue;
  if (metric === 'ltv') {
    if (value > 0.8) return 'bg-red-100 text-red-800';
    if (value > 0.7) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  }
  if (metric === 'dscr') {
    if (value < 1.1) return 'bg-red-100 text-red-800';
    if (value < 1.25) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  }
  if (metric === 'irr' || metric === 'equityMultiple' || metric === 'stressedNOI' || metric === 'stressedValue') {
    if (ratio < 0.8) return 'bg-red-100 text-red-800';
    if (ratio < 0.95) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  }
  return '';
}

export function StressTesting({ projectId, onTabChange }: StressTestingProps) {
  const [scenarios, setScenarios] = useState<StressScenario[]>([]);
  const [presetsLoaded, setPresetsLoaded] = useState(false);
  const [results, setResults] = useState<StressTestResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customAssumptions, setCustomAssumptions] = useState({
    occupancyShock: -10,
    revenueShock: -15,
    expenseShock: 10,
    capRateShift: 50,
    interestRateShift: 100,
    rentDecline: -5,
  });

  const { data: presets } = useQuery({
    queryKey: ['/api/institutional-analysis/stress-test/presets', projectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/institutional-analysis/stress-test/presets?projectId=${projectId}`);
      return res.json() as Promise<StressScenario[]>;
    },
  });

  useMemo(() => {
    if (presets && !presetsLoaded) {
      setScenarios(presets.map(p => ({ ...p, enabled: true })));
      setPresetsLoaded(true);
    }
  }, [presets, presetsLoaded]);

  const toggleScenario = (id: string) => {
    setScenarios(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const removeScenario = (id: string) => {
    setScenarios(prev => prev.filter(s => s.id !== id));
  };

  const addCustomScenario = () => {
    if (!customName.trim()) return;
    const newScenario: StressScenario = {
      id: `custom-${Date.now()}`,
      name: customName,
      description: 'Custom scenario',
      assumptions: {
        occupancyShock: customAssumptions.occupancyShock / 100,
        revenueShock: customAssumptions.revenueShock / 100,
        expenseShock: customAssumptions.expenseShock / 100,
        capRateShift: customAssumptions.capRateShift,
        interestRateShift: customAssumptions.interestRateShift,
        rentDecline: customAssumptions.rentDecline / 100,
      },
      enabled: true,
    };
    setScenarios(prev => [...prev, newScenario]);
    setCustomName('');
  };

  const runStressTest = async () => {
    setRunning(true);
    try {
      const enabled = scenarios.filter(s => s.enabled);
      const res = await apiRequest('POST', '/api/institutional-analysis/stress-test', {
        projectId,
        scenarios: enabled,
      });
      const data = await res.json() as StressTestResponse;
      setResults(data);
    } catch (err) {
      console.error('Stress test failed:', err);
    } finally {
      setRunning(false);
    }
  };

  const irrChartData = useMemo(() => {
    if (!results) return [];
    const items = [
      { name: 'Base Case', irr: results.baseCase.irr * 100, fill: '#3b82f6' },
    ];
    results.results.forEach(r => {
      items.push({
        name: r.scenarioName.length > 15 ? r.scenarioName.slice(0, 15) + '...' : r.scenarioName,
        irr: r.irr * 100,
        fill: r.irr < results.baseCase.irr * 0.8 ? '#ef4444' : r.irr < results.baseCase.irr * 0.95 ? '#f59e0b' : '#22c55e',
      });
    });
    return items;
  }, [results]);

  const waterfallData = useMemo(() => {
    if (!results) return [];
    return results.results.map(r => ({
      name: r.scenarioName.length > 12 ? r.scenarioName.slice(0, 12) + '...' : r.scenarioName,
      valueLoss: Math.abs(r.valueLoss) / 1_000_000,
      valueLossPct: r.valueLossPct * 100,
    }));
  }, [results]);

  const breachCount = results ? results.results.filter(r => r.covenantBreach).length : 0;
  const ltcWarningCount = results ? results.results.filter(r => r.ltcExceeds100).length : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Macro Stress Testing</h2>
          <p className="text-muted-foreground">Evaluate portfolio resilience across adverse scenarios</p>
        </div>
        <Button onClick={runStressTest} disabled={running || scenarios.filter(s => s.enabled).length === 0}>
          <Play className="h-4 w-4 mr-2" />
          {running ? 'Running...' : 'Run Stress Test'}
        </Button>
      </div>

      {/* Scenario Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Scenarios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {scenarios.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={() => toggleScenario(s.id)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-sm text-muted-foreground">{s.description}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeScenario(s.id)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
            {scenarios.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No scenarios loaded. Add a custom scenario below.</p>
            )}
          </div>

          {/* Custom Scenario */}
          <div className="mt-6 border-t pt-4">
            <h4 className="font-medium mb-3">Add Custom Scenario</h4>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="col-span-2">
                <Label>Scenario Name</Label>
                <Input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="e.g., Severe Recession" />
              </div>
              <div>
                <Label>Occupancy Shock (%)</Label>
                <Input type="number" value={customAssumptions.occupancyShock} onChange={e => setCustomAssumptions(p => ({ ...p, occupancyShock: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Revenue Shock (%)</Label>
                <Input type="number" value={customAssumptions.revenueShock} onChange={e => setCustomAssumptions(p => ({ ...p, revenueShock: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Expense Shock (%)</Label>
                <Input type="number" value={customAssumptions.expenseShock} onChange={e => setCustomAssumptions(p => ({ ...p, expenseShock: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Cap Rate Shift (bps)</Label>
                <Input type="number" value={customAssumptions.capRateShift} onChange={e => setCustomAssumptions(p => ({ ...p, capRateShift: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Interest Rate Shift (bps)</Label>
                <Input type="number" value={customAssumptions.interestRateShift} onChange={e => setCustomAssumptions(p => ({ ...p, interestRateShift: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>Rent Decline (%)</Label>
                <Input type="number" value={customAssumptions.rentDecline} onChange={e => setCustomAssumptions(p => ({ ...p, rentDecline: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <Button className="mt-3" variant="outline" onClick={addCustomScenario} disabled={!customName.trim()}>
              <Plus className="h-4 w-4 mr-2" /> Add Scenario
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {results && (breachCount > 0 || ltcWarningCount > 0) && (
        <div className="flex gap-3">
          {breachCount > 0 && (
            <Badge variant="destructive" className="text-sm px-3 py-1">
              <AlertTriangle className="h-4 w-4 mr-1" />
              {breachCount} Covenant Breach{breachCount > 1 ? 'es' : ''}
            </Badge>
          )}
          {ltcWarningCount > 0 && (
            <Badge variant="destructive" className="text-sm px-3 py-1">
              <TrendingDown className="h-4 w-4 mr-1" />
              {ltcWarningCount} Scenario{ltcWarningCount > 1 ? 's' : ''} with LTC {'>'} 100%
            </Badge>
          )}
        </div>
      )}

      {/* Heatmap Results Table */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Stress Test Results</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="overflow-x-auto w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Scenario</TableHead>
                  <TableHead className="text-right">Stressed NOI</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">DSCR</TableHead>
                  <TableHead className="text-right">LTV</TableHead>
                  <TableHead className="text-right">IRR</TableHead>
                  <TableHead className="text-right">Equity Multiple</TableHead>
                  <TableHead className="text-center">Flags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Base Case Row */}
                <TableRow className="bg-blue-50 font-semibold">
                  <TableCell>Base Case</TableCell>
                  <TableCell className="text-right">{formatCurrency(results.baseCase.noi)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(results.baseCase.value)}</TableCell>
                  <TableCell className="text-right">{results.baseCase.dscr.toFixed(2)}x</TableCell>
                  <TableCell className="text-right">{formatPercent(results.baseCase.ltv)}</TableCell>
                  <TableCell className="text-right">{formatPercent(results.baseCase.irr)}</TableCell>
                  <TableCell className="text-right">{results.baseCase.equityMultiple.toFixed(2)}x</TableCell>
                  <TableCell className="text-center">-</TableCell>
                </TableRow>
                {/* Scenario Rows */}
                {results.results.map(r => (
                  <TableRow key={r.scenarioId}>
                    <TableCell className="font-medium">{r.scenarioName}</TableCell>
                    <TableCell className={`text-right ${getHeatColor('stressedNOI', r.stressedNOI, results.baseCase.noi)}`}>
                      {formatCurrency(r.stressedNOI)}
                    </TableCell>
                    <TableCell className={`text-right ${getHeatColor('stressedValue', r.stressedValue, results.baseCase.value)}`}>
                      {formatCurrency(r.stressedValue)}
                    </TableCell>
                    <TableCell className={`text-right ${getHeatColor('dscr', r.dscr, results.baseCase.dscr)}`}>
                      {r.dscr.toFixed(2)}x
                    </TableCell>
                    <TableCell className={`text-right ${getHeatColor('ltv', r.ltv, results.baseCase.ltv)}`}>
                      {formatPercent(r.ltv)}
                    </TableCell>
                    <TableCell className={`text-right ${getHeatColor('irr', r.irr, results.baseCase.irr)}`}>
                      {formatPercent(r.irr)}
                    </TableCell>
                    <TableCell className={`text-right ${getHeatColor('equityMultiple', r.equityMultiple, results.baseCase.equityMultiple)}`}>
                      {r.equityMultiple.toFixed(2)}x
                    </TableCell>
                    <TableCell className="text-center space-x-1">
                      {r.covenantBreach && (
                        <Badge variant="destructive" className="text-xs">Breach</Badge>
                      )}
                      {r.ltcExceeds100 && (
                        <Badge variant="destructive" className="text-xs">LTC{'>'}100%</Badge>
                      )}
                      {!r.covenantBreach && !r.ltcExceeds100 && (
                        <span className="text-muted-foreground text-xs">OK</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      {results && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* IRR Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>IRR Comparison Across Scenarios</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={irrChartData} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-35} textAnchor="end" fontSize={11} interval={0} />
                  <YAxis tickFormatter={v => `${v.toFixed(1)}%`} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
                  <Bar dataKey="irr" name="IRR" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                    {irrChartData.map((entry, idx) => (
                      <rect key={idx} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Value Loss Waterfall */}
          <Card>
            <CardHeader>
              <CardTitle>Value Loss Waterfall</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={waterfallData} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-35} textAnchor="end" fontSize={11} interval={0} />
                  <YAxis tickFormatter={v => `$${v.toFixed(1)}M`} />
                  <Tooltip
                    formatter={(v: number, name: string) => {
                      if (name === 'valueLoss') return [`$${v.toFixed(2)}M`, 'Value Loss'];
                      return [`${v.toFixed(1)}%`, 'Loss %'];
                    }}
                  />
                  <Bar dataKey="valueLoss" name="valueLoss" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {!results && !running && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <TrendingDown className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p className="text-lg font-medium">No stress test results yet</p>
            <p className="text-sm mt-1">Select scenarios above and click "Run Stress Test" to evaluate downside risks.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default StressTesting;
