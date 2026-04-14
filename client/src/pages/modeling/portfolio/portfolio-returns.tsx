import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  TrendingUp, Activity, Target, Percent, Wallet, ArrowUpRight,
  BarChart3, Landmark, Building2, RefreshCw
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
  ComposedChart
} from 'recharts';
import { queryClient } from '@/lib/queryClient';
import { ExportPdfButton } from '@/components/ui/export-pdf-button';
import { useDisplayPreferences } from '@/hooks/use-display-preferences';

function formatCurrencyCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e6) return `${value < 0 ? '-' : ''}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${value < 0 ? '-' : ''}$${(abs / 1e3).toFixed(0)}K`;
  return `${value < 0 ? '-' : ''}$${abs.toFixed(0)}`;
}

function formatPercent(value: number | null): string {
  if (value === null) return 'N/A';
  return `${(value * 100).toFixed(2)}%`;
}

function formatMultiple(value: number | null): string {
  if (value === null) return 'N/A';
  return `${value.toFixed(2)}x`;
}

function KpiCard({ title, value, icon: Icon, trend }: {
  title: string; value: string; icon: any; trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-xl font-bold">{value}</p>
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

export default function PortfolioReturns() {
  const [view, setView] = useState<'levered' | 'unlevered'>('levered');
  const [activeTab, setActiveTab] = useState('dashboard');
  const pdfRef = useRef<HTMLDivElement>(null);
  useDisplayPreferences(); // Sync global rounding from Model Settings

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ['/api/returns/portfolio', view],
    queryFn: async () => {
      const res = await fetch(`/api/returns/portfolio?view=${view}`);
      if (!res.ok) throw new Error('Failed to fetch portfolio returns');
      return res.json();
    },
  });

  const { data: debtData, isLoading: debtLoading } = useQuery<any>({
    queryKey: ['/api/returns/portfolio/debt'],
    queryFn: async () => {
      const res = await fetch('/api/returns/portfolio/debt');
      if (!res.ok) throw new Error('Failed to fetch portfolio debt');
      return res.json();
    },
  });

  const metrics = data?.aggregate?.metrics;
  const attribution = data?.aggregate?.attribution;
  const cumulativeSeries = data?.aggregate?.cumulativeSeries;
  const valueSeries = data?.aggregate?.valueSeries;
  const byProperty = data?.byProperty || [];

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
    }));
  }, [valueSeries]);

  const sortedProperties = useMemo(() => {
    return [...byProperty].sort((a: any, b: any) =>
      (b.metrics?.grossGain || 0) - (a.metrics?.grossGain || 0)
    );
  }, [byProperty]);

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

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const hasData = byProperty.length > 0;

  return (
    <div className="space-y-6 p-6" ref={pdfRef}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" /> Portfolio Returns
          </h1>
          <p className="text-sm text-muted-foreground">Aggregate return analysis across all owned properties</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportPdfButton contentRef={pdfRef} filename="portfolio-returns" title="Portfolio Returns" />
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
          <Button size="sm" variant="ghost" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!hasData && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No Portfolio Data</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mt-2">
              Start by seeding returns data for individual models in the Returns tab of each project workspace.
            </p>
          </CardContent>
        </Card>
      )}

      {!hasData && debtData?.assets?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Landmark className="h-4 w-4" /> Portfolio Debt Summary
            </CardTitle>
            <CardDescription>Aggregated across {debtData.portfolio.assetCount} asset{debtData.portfolio.assetCount !== 1 ? 's' : ''} with debt</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Debt</p>
                <p className="text-xl font-bold">{formatCurrencyCompact(debtData.portfolio.totalDebt)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Blended LTV</p>
                <p className="text-xl font-bold">{(debtData.portfolio.ltv * 100).toFixed(1)}%</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Wtd Avg Rate</p>
                <p className="text-xl font-bold">{(debtData.portfolio.blendedRate * 100).toFixed(2)}%</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Portfolio DSCR</p>
                <p className="text-xl font-bold">{debtData.portfolio.dscr != null ? `${debtData.portfolio.dscr.toFixed(2)}x` : 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {hasData && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="attribution">Attribution</TabsTrigger>
            <TabsTrigger value="properties">Properties</TabsTrigger>
            <TabsTrigger value="debt">
              <Landmark className="h-3.5 w-3.5 mr-1.5" />Debt
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <KpiCard title="Cumulative Op CF" value={formatCurrencyCompact(metrics?.cumulativeOperatingCF || 0)} icon={Activity} trend={(metrics?.cumulativeOperatingCF || 0) >= 0 ? 'up' : 'down'} />
              <KpiCard title="Cash In" value={formatCurrencyCompact(metrics?.cumulativeCashIn || 0)} icon={ArrowUpRight} trend="up" />
              <KpiCard title="Equity Invested" value={formatCurrencyCompact(Math.abs(metrics?.cumulativeSpendEquity || 0))} icon={Wallet} trend="down" />
              <KpiCard title="Gross Gain" value={formatCurrencyCompact(metrics?.grossGain || 0)} icon={TrendingUp} trend={(metrics?.grossGain || 0) >= 0 ? 'up' : 'down'} />
              <KpiCard title="MOIC" value={formatMultiple(metrics?.moic)} icon={Target} trend={metrics?.moic && metrics.moic > 1 ? 'up' : 'neutral'} />
              <KpiCard title="ROI" value={formatPercent(metrics?.roi)} icon={Percent} trend={metrics?.roi && metrics.roi > 0 ? 'up' : 'neutral'} />
              <KpiCard title="IRR" value={formatPercent(metrics?.irr)} icon={TrendingUp} trend={metrics?.irr && metrics.irr > 0 ? 'up' : 'neutral'} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Portfolio Value Timeline</CardTitle>
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
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">No data</div>
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
                    <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">No data</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="attribution" className="space-y-6 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Portfolio Return Attribution</CardTitle>
                <CardDescription>What drove portfolio returns</CardDescription>
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
          </TabsContent>

          <TabsContent value="properties" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Top Contributors</CardTitle>
                <CardDescription>Properties ranked by gross gain</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property</TableHead>
                      <TableHead className="text-right">Gross Gain</TableHead>
                      <TableHead className="text-right">MOIC</TableHead>
                      <TableHead className="text-right">ROI</TableHead>
                      <TableHead className="text-right">IRR</TableHead>
                      <TableHead className="text-right">Op CF</TableHead>
                      <TableHead className="text-right">Market Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedProperties.map((prop: any, i: number) => (
                      <TableRow key={prop.propertyId}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs w-6 h-6 flex items-center justify-center rounded-full p-0">
                              {i + 1}
                            </Badge>
                            <span className="text-sm">{prop.propertyId}</span>
                          </div>
                        </TableCell>
                        <TableCell className={`text-right font-mono text-sm ${(prop.metrics?.grossGain || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatCurrencyCompact(prop.metrics?.grossGain || 0)}
                        </TableCell>
                        <TableCell className="text-right text-sm">{formatMultiple(prop.metrics?.moic)}</TableCell>
                        <TableCell className="text-right text-sm">{formatPercent(prop.metrics?.roi)}</TableCell>
                        <TableCell className="text-right text-sm">{formatPercent(prop.metrics?.irr)}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrencyCompact(prop.metrics?.cumulativeOperatingCF || 0)}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrencyCompact(prop.metrics?.endingMarketValue || 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="debt" className="space-y-6 mt-4">
            {debtLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
              </div>
            ) : !debtData?.assets?.length ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Landmark className="h-10 w-10 text-muted-foreground mb-3" />
                  <h3 className="text-base font-semibold">No Debt Recorded</h3>
                  <p className="text-sm text-muted-foreground text-center max-w-sm mt-1">
                    Add loans in the Debt Inputs tab of each project workspace to see portfolio-level debt analytics here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard
                    title="Total Portfolio Debt"
                    value={formatCurrencyCompact(debtData.portfolio.totalDebt)}
                    icon={Landmark}
                    trend="down"
                  />
                  <KpiCard
                    title="Blended LTV"
                    value={`${(debtData.portfolio.ltv * 100).toFixed(1)}%`}
                    icon={Percent}
                    trend={debtData.portfolio.ltv > 0.75 ? 'down' : 'neutral'}
                  />
                  <KpiCard
                    title="Wtd Avg Rate"
                    value={`${(debtData.portfolio.blendedRate * 100).toFixed(2)}%`}
                    icon={TrendingUp}
                    trend="neutral"
                  />
                  <KpiCard
                    title="Portfolio DSCR"
                    value={debtData.portfolio.dscr != null ? `${debtData.portfolio.dscr.toFixed(2)}x` : 'N/A'}
                    icon={Activity}
                    trend={debtData.portfolio.dscr != null && debtData.portfolio.dscr >= 1.25 ? 'up' : 'down'}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">Debt vs Equity by Asset</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={debtData.assets} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 10 }}
                            angle={-35}
                            textAnchor="end"
                            interval={0}
                            height={55}
                          />
                          <YAxis tickFormatter={(v: number) => formatCurrencyCompact(v)} tick={{ fontSize: 10 }} />
                          <Tooltip
                            formatter={(val: number, name: string) => [formatCurrencyCompact(val), name]}
                            labelStyle={{ fontSize: 12 }}
                          />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="totalDebt" name="Debt" fill="#ef4444" radius={[3, 3, 0, 0]} />
                          <Bar dataKey="equity" name="Equity" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold">Annual Debt Service by Asset</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={debtData.assets} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 10 }}
                            angle={-35}
                            textAnchor="end"
                            interval={0}
                            height={55}
                          />
                          <YAxis tickFormatter={(v: number) => formatCurrencyCompact(v)} tick={{ fontSize: 10 }} />
                          <Tooltip
                            formatter={(val: number, name: string) => [formatCurrencyCompact(val), name]}
                            labelStyle={{ fontSize: 12 }}
                          />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="annualDebtService" name="Annual Debt Service" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                          <Bar dataKey="annualNOI" name="NOI" fill="#10b981" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Asset-Level Debt Detail</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="pl-4">Asset</TableHead>
                            <TableHead className="text-right">Purchase Price</TableHead>
                            <TableHead className="text-right">Total Debt</TableHead>
                            <TableHead className="text-right">Equity</TableHead>
                            <TableHead className="text-right">LTV</TableHead>
                            <TableHead className="text-right">Rate</TableHead>
                            <TableHead className="text-right">Annual DS</TableHead>
                            <TableHead className="text-right">DSCR</TableHead>
                            <TableHead className="text-right">Debt Yield</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {debtData.assets.map((asset: any) => (
                            <TableRow key={asset.projectId}>
                              <TableCell className="pl-4 font-medium text-sm">{asset.name}</TableCell>
                              <TableCell className="text-right text-sm">{formatCurrencyCompact(asset.purchasePrice)}</TableCell>
                              <TableCell className="text-right text-sm text-red-600 dark:text-red-400">{formatCurrencyCompact(asset.totalDebt)}</TableCell>
                              <TableCell className="text-right text-sm text-blue-600 dark:text-blue-400">{formatCurrencyCompact(asset.equity)}</TableCell>
                              <TableCell className="text-right text-sm">{(asset.ltv * 100).toFixed(1)}%</TableCell>
                              <TableCell className="text-right text-sm">{(asset.blendedRate * 100).toFixed(2)}%</TableCell>
                              <TableCell className="text-right text-sm">{formatCurrencyCompact(asset.annualDebtService)}</TableCell>
                              <TableCell className="text-right text-sm">
                                <span className={asset.dscr != null && asset.dscr >= 1.25 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : asset.dscr != null && asset.dscr < 1.0 ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                                  {asset.dscr != null ? `${asset.dscr.toFixed(2)}x` : '—'}
                                </span>
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {asset.debtYield != null ? `${(asset.debtYield * 100).toFixed(2)}%` : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <tfoot>
                          <TableRow className="border-t-2 font-semibold bg-muted/40">
                            <TableCell className="pl-4 text-sm">Portfolio Total</TableCell>
                            <TableCell className="text-right text-sm">{formatCurrencyCompact(debtData.portfolio.totalPurchasePrice)}</TableCell>
                            <TableCell className="text-right text-sm text-red-600 dark:text-red-400">{formatCurrencyCompact(debtData.portfolio.totalDebt)}</TableCell>
                            <TableCell className="text-right text-sm text-blue-600 dark:text-blue-400">{formatCurrencyCompact(debtData.portfolio.totalEquity)}</TableCell>
                            <TableCell className="text-right text-sm">{(debtData.portfolio.ltv * 100).toFixed(1)}%</TableCell>
                            <TableCell className="text-right text-sm">{(debtData.portfolio.blendedRate * 100).toFixed(2)}%</TableCell>
                            <TableCell className="text-right text-sm">{formatCurrencyCompact(debtData.portfolio.annualDebtService)}</TableCell>
                            <TableCell className="text-right text-sm">
                              {debtData.portfolio.dscr != null ? `${debtData.portfolio.dscr.toFixed(2)}x` : '—'}
                            </TableCell>
                            <TableCell className="text-right text-sm">—</TableCell>
                          </TableRow>
                        </tfoot>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
