import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { apiRequest } from '@/lib/queryClient';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  RefreshCw,
  DollarSign,
  Percent,
  Target,
  Info,
} from 'lucide-react';

interface WaterfallSensitivityProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

interface WaterfallParams {
  lpEquity: number;
  gpEquity: number;
  prefRate: number;
  catchUpPct: number;
  carryPct: number;
}

interface WaterfallRow {
  irr: number;
  totalDistribution: number;
  lpDistribution: number;
  gpDistribution: number;
  gpPromotePct: number;
  lpMultiple: number;
  gpMultiple: number;
}

const DEFAULT_PARAMS: WaterfallParams = {
  lpEquity: 9000000,
  gpEquity: 1000000,
  prefRate: 8,
  catchUpPct: 50,
  carryPct: 20,
};

const IRR_LEVELS = Array.from({ length: 16 }, (_, i) => i * 2);

function computeWaterfall(params: WaterfallParams, irr: number): WaterfallRow {
  const totalEquity = params.lpEquity + params.gpEquity;
  const holdPeriod = 5;
  const totalDistribution = totalEquity * Math.pow(1 + irr / 100, holdPeriod);
  const profit = totalDistribution - totalEquity;

  const lpShare = params.lpEquity / totalEquity;
  const gpShare = params.gpEquity / totalEquity;

  // Tier 1: Return of capital
  let lpDist = params.lpEquity;
  let gpDist = params.gpEquity;
  let remaining = profit;

  // Tier 2: Preferred return to LP
  const prefAmount = params.lpEquity * (params.prefRate / 100) * holdPeriod;
  const prefActual = Math.min(remaining, prefAmount);
  lpDist += prefActual;
  remaining -= prefActual;

  // Tier 3: GP catch-up
  if (remaining > 0 && prefActual >= prefAmount) {
    const catchUpTarget = (prefActual * params.catchUpPct) / (100 - params.catchUpPct);
    const catchUpActual = Math.min(remaining, catchUpTarget);
    gpDist += catchUpActual;
    remaining -= catchUpActual;
  }

  // Tier 4: Carried interest split
  if (remaining > 0) {
    const gpCarry = remaining * (params.carryPct / 100);
    const lpRemainder = remaining - gpCarry;
    gpDist += gpCarry;
    lpDist += lpRemainder;
  }

  const gpPromote = gpDist - params.gpEquity;
  const gpPromotePct = totalDistribution > 0 ? (gpPromote / totalDistribution) * 100 : 0;

  return {
    irr,
    totalDistribution,
    lpDistribution: lpDist,
    gpDistribution: gpDist,
    gpPromotePct: Math.max(0, gpPromotePct),
    lpMultiple: lpDist / params.lpEquity,
    gpMultiple: gpDist / params.gpEquity,
  };
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatMultiple(value: number): string {
  return `${value.toFixed(2)}x`;
}

function WaterfallSensitivity({ projectId, onTabChange }: WaterfallSensitivityProps) {
  const queryClient = useQueryClient();

  const [params, setParams] = useState<WaterfallParams>(DEFAULT_PARAMS);
  const [editParams, setEditParams] = useState<WaterfallParams>(DEFAULT_PARAMS);
  const [isEditing, setIsEditing] = useState(false);

  const { data: savedParams } = useQuery({
    queryKey: ['/api/modeling/projects', projectId, 'waterfall-params'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/modeling/projects/${projectId}/waterfall-params`);
      return res.json();
    },
    enabled: !!projectId,
  });

  const waterfallData = useMemo(() => {
    return IRR_LEVELS.map((irr) => computeWaterfall(params, irr));
  }, [params]);

  const chartData = useMemo(() => {
    return waterfallData.map((row) => ({
      irr: `${row.irr}%`,
      irrValue: row.irr,
      lpDistribution: row.lpDistribution,
      gpDistribution: row.gpDistribution,
      gpPromotePct: row.gpPromotePct,
    }));
  }, [waterfallData]);

  // Breakeven analysis
  const breakeven = useMemo(() => {
    const prefHurdle = waterfallData.find(
      (r) => r.gpPromotePct > 0
    );
    const catchUpComplete = waterfallData.find(
      (r, i) => i > 0 && r.gpPromotePct > waterfallData[i - 1].gpPromotePct + 0.5
    );
    const maxPromoteRow = waterfallData.reduce((max, r) =>
      r.gpPromotePct > max.gpPromotePct ? r : max
    );

    return {
      prefHurdleIRR: prefHurdle?.irr ?? null,
      catchUpIRR: catchUpComplete?.irr ?? null,
      maxPromoteIRR: maxPromoteRow.irr,
      maxPromotePct: maxPromoteRow.gpPromotePct,
    };
  }, [waterfallData]);

  const handleApplyParams = () => {
    setParams(editParams);
    setIsEditing(false);
  };

  const handleReset = () => {
    setEditParams(DEFAULT_PARAMS);
    setParams(DEFAULT_PARAMS);
    setIsEditing(false);
  };

  const updateParam = (key: keyof WaterfallParams, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setEditParams((prev) => ({ ...prev, [key]: num }));
    }
  };

  return (
    <div className="space-y-6 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Waterfall Sensitivity</h2>
          <p className="text-muted-foreground">
            Analyze how GP promote changes as deal IRR varies across the waterfall structure.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? 'Cancel' : 'Edit Parameters'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Reset
          </Button>
        </div>
      </div>

      {/* Parameter Inputs */}
      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Waterfall Parameters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lpEquity">LP Equity ($)</Label>
                <Input
                  id="lpEquity"
                  type="number"
                  value={editParams.lpEquity}
                  onChange={(e) => updateParam('lpEquity', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gpEquity">GP Equity ($)</Label>
                <Input
                  id="gpEquity"
                  type="number"
                  value={editParams.gpEquity}
                  onChange={(e) => updateParam('gpEquity', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prefRate">Pref Rate (%)</Label>
                <Input
                  id="prefRate"
                  type="number"
                  step="0.5"
                  value={editParams.prefRate}
                  onChange={(e) => updateParam('prefRate', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="catchUpPct">Catch-Up (%)</Label>
                <Input
                  id="catchUpPct"
                  type="number"
                  step="5"
                  value={editParams.catchUpPct}
                  onChange={(e) => updateParam('catchUpPct', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="carryPct">Carry (%)</Label>
                <Input
                  id="carryPct"
                  type="number"
                  step="1"
                  value={editParams.carryPct}
                  onChange={(e) => updateParam('carryPct', e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={handleApplyParams}>Apply Parameters</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Critical Threshold Callouts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pref Hurdle</p>
                <p className="text-xl font-bold">
                  {breakeven.prefHurdleIRR !== null
                    ? `${breakeven.prefHurdleIRR}% IRR`
                    : 'Not Reached'}
                </p>
                <p className="text-xs text-muted-foreground">
                  GP starts earning carry
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Catch-Up Completion</p>
                <p className="text-xl font-bold">
                  {breakeven.catchUpIRR !== null
                    ? `${breakeven.catchUpIRR}% IRR`
                    : 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground">
                  GP catch-up tier fully satisfied
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 text-green-700">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Max Promote</p>
                <p className="text-xl font-bold">
                  {formatPct(breakeven.maxPromotePct)}
                </p>
                <p className="text-xs text-muted-foreground">
                  At {breakeven.maxPromoteIRR}% IRR
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stacked Area Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">LP vs GP Distributions by IRR</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="irr" tick={{ fontSize: 12 }} />
                <YAxis
                  tickFormatter={(v) => formatCurrency(v)}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === 'lpDistribution' ? 'LP Distribution' : 'GP Distribution',
                  ]}
                  labelFormatter={(label) => `Deal IRR: ${label}`}
                />
                <Legend
                  formatter={(value) =>
                    value === 'lpDistribution' ? 'LP Distribution' : 'GP Distribution'
                  }
                />
                <Area
                  type="monotone"
                  dataKey="lpDistribution"
                  stackId="1"
                  stroke="#3b82f6"
                  fill="#93c5fd"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="gpDistribution"
                  stackId="1"
                  stroke="#10b981"
                  fill="#6ee7b7"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* GP Promote % Line Overlay */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">GP Promote % Across IRR Levels</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="irr" tick={{ fontSize: 12 }} />
                <YAxis
                  tickFormatter={(v) => `${v.toFixed(1)}%`}
                  tick={{ fontSize: 12 }}
                  domain={[0, 'auto']}
                />
                <Tooltip
                  formatter={(value: number) => [formatPct(value), 'GP Promote %']}
                  labelFormatter={(label) => `Deal IRR: ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="gpPromotePct"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Distribution Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Waterfall Distribution Table</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">IRR</TableHead>
                  <TableHead className="text-right">LP Distribution</TableHead>
                  <TableHead className="text-right">GP Distribution</TableHead>
                  <TableHead className="text-right">GP Promote %</TableHead>
                  <TableHead className="text-right">LP Multiple</TableHead>
                  <TableHead className="text-right">GP Multiple</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {waterfallData.map((row) => {
                  const isAbovePref = breakeven.prefHurdleIRR !== null && row.irr >= breakeven.prefHurdleIRR;
                  return (
                    <TableRow
                      key={row.irr}
                      className={isAbovePref ? 'bg-green-50/50' : ''}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1">
                          {row.irr}%
                          {row.irr === breakeven.prefHurdleIRR && (
                            <Badge variant="outline" className="text-xs ml-1">
                              Pref
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(row.lpDistribution)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(row.gpDistribution)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={row.gpPromotePct > 0 ? 'text-green-600 font-semibold' : ''}>
                          {formatPct(row.gpPromotePct)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMultiple(row.lpMultiple)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatMultiple(row.gpMultiple)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
        </CardContent>
      </Card>

      {/* Breakeven Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Breakeven Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">Total Equity</span>
                <span className="font-mono font-medium">
                  {formatCurrency(params.lpEquity + params.gpEquity)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">LP / GP Split</span>
                <span className="font-mono font-medium">
                  {((params.lpEquity / (params.lpEquity + params.gpEquity)) * 100).toFixed(0)}% /{' '}
                  {((params.gpEquity / (params.lpEquity + params.gpEquity)) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">Preferred Return</span>
                <span className="font-mono font-medium">{params.prefRate}%</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-muted-foreground">GP Catch-Up</span>
                <span className="font-mono font-medium">{params.catchUpPct}%</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-muted-foreground">Carried Interest</span>
                <span className="font-mono font-medium">{params.carryPct}%</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Key Insights</span>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    GP begins earning promote at{' '}
                    <span className="font-medium text-foreground">
                      {breakeven.prefHurdleIRR !== null
                        ? `${breakeven.prefHurdleIRR}% IRR`
                        : 'above modeled range'}
                    </span>
                  </li>
                  <li>
                    At 20% IRR, GP earns{' '}
                    <span className="font-medium text-foreground">
                      {formatPct(
                        waterfallData.find((r) => r.irr === 20)?.gpPromotePct ?? 0
                      )}{' '}
                      promote
                    </span>
                  </li>
                  <li>
                    Max GP multiple of{' '}
                    <span className="font-medium text-foreground">
                      {formatMultiple(
                        waterfallData.reduce((max, r) =>
                          r.gpMultiple > max ? r.gpMultiple : max, 0
                        )
                      )}
                    </span>{' '}
                    at {breakeven.maxPromoteIRR}% IRR
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default WaterfallSensitivity;
