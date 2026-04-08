import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { apiRequest } from '@/lib/queryClient';
import { formatCurrency, formatPercent } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Download,
  RefreshCw,
  DollarSign,
  Calendar,
  Building,
  Landmark,
  ArrowUpRight,
  BarChart3,
} from 'lucide-react';

interface HoldPeriodSummaryProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

interface AcquisitionSummary {
  purchasePrice: number;
  closingCosts: number;
  totalEquity: number;
  loanAmount: number;
  ltv: number;
}

interface DispositionSummary {
  exitNOI: number;
  exitCapRate: number;
  grossSalePrice: number;
  dispositionCosts: number;
  loanPayoff: number;
  netProceeds: number;
}

interface AnnualRow {
  year: number;
  noi: number;
  debtService: number;
  cfAfterDebt: number;
  capEx: number;
  netCF: number;
  dscr: number;
  debtYield: number;
  cashOnCash: number;
  cumulativeCF: number;
  loanBalance: number;
}

interface ReturnMetrics {
  leveredIRR: number;
  unleveredIRR: number;
  equityMultiple: number;
  avgCashOnCash: number;
  avgDSCR: number;
  npv: number;
  paybackPeriod: number;
}

interface HoldPeriodResult {
  acquisition: AcquisitionSummary;
  disposition: DispositionSummary;
  annualCashFlows: AnnualRow[];
  returnMetrics: ReturnMetrics;
}

function HoldPeriodSummary({ projectId, onTabChange }: HoldPeriodSummaryProps) {
  const [activeTab, setActiveTab] = useState('table');

  const { data: result, isLoading, refetch } = useQuery<HoldPeriodResult>({
    queryKey: ['hold-period-cf', projectId],
    queryFn: async () => {
      const res = await apiRequest('POST', '/api/institutional-analysis/hold-period-cf', {
        projectId,
      });
      return res.json();
    },
  });

  const chartData = useMemo(() => {
    if (!result?.annualCashFlows) return [];
    return result.annualCashFlows.map((row) => ({
      year: `Year ${row.year}`,
      NOI: row.noi,
      'Debt Service': row.debtService,
      'Net CF': row.netCF,
    }));
  }, [result]);

  const handleExcelExport = async () => {
    if (!result) return;
    try {
      const res = await apiRequest('POST', '/api/institutional-analysis/hold-period-cf/export', {
        projectId,
        data: result,
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hold-period-summary-${projectId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Export failed silently
    }
  };

  const metricsCards = useMemo(() => {
    if (!result?.returnMetrics) return [];
    const m = result.returnMetrics;
    return [
      { label: 'Levered IRR', value: formatPercent(m.leveredIRR), icon: TrendingUp, color: 'text-green-600' },
      { label: 'Unlevered IRR', value: formatPercent(m.unleveredIRR), icon: TrendingUp, color: 'text-blue-600' },
      { label: 'Equity Multiple', value: `${m.equityMultiple.toFixed(2)}x`, icon: ArrowUpRight, color: 'text-purple-600' },
      { label: 'Avg Cash-on-Cash', value: formatPercent(m.avgCashOnCash), icon: DollarSign, color: 'text-amber-600' },
      { label: 'Avg DSCR', value: m.avgDSCR.toFixed(2) + 'x', icon: Landmark, color: 'text-indigo-600' },
      { label: 'NPV', value: formatCurrency(m.npv), icon: BarChart3, color: 'text-teal-600' },
      { label: 'Payback Period', value: `${m.paybackPeriod.toFixed(1)} yrs`, icon: Calendar, color: 'text-rose-600' },
    ];
  }, [result]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Hold Period Cash Flow Summary</h2>
          <p className="text-muted-foreground">
            Annual cash flow projections with acquisition and disposition analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExcelExport} disabled={!result}>
            <Download className="mr-2 h-4 w-4" />
            Export Excel
          </Button>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Return Metrics Banner */}
      {result?.returnMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {metricsCards.map((card) => (
            <Card key={card.label}>
              <CardContent className="pt-3 pb-2 px-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
                  <span className="text-[11px] text-muted-foreground leading-tight">{card.label}</span>
                </div>
                <p className="text-base font-bold">{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Acquisition Summary */}
      {result?.acquisition && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building className="h-4 w-4" />
              Acquisition
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Purchase Price</p>
                <p className="text-lg font-semibold">{formatCurrency(result.acquisition.purchasePrice)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Closing Costs</p>
                <p className="text-lg font-semibold">{formatCurrency(result.acquisition.closingCosts)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Equity</p>
                <p className="text-lg font-semibold text-blue-600">{formatCurrency(result.acquisition.totalEquity)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Loan Amount</p>
                <p className="text-lg font-semibold">{formatCurrency(result.acquisition.loanAmount)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">LTV</p>
                <p className="text-lg font-semibold">{formatPercent(result.acquisition.ltv)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="table">Annual Summary</TabsTrigger>
          <TabsTrigger value="chart">Cash Flow Chart</TabsTrigger>
        </TabsList>

        <TabsContent value="table" className="mt-4">
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              <div className="overflow-x-auto w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Year</TableHead>
                    <TableHead className="text-right whitespace-nowrap">NOI</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Debt Service</TableHead>
                    <TableHead className="text-right whitespace-nowrap">CF After Debt</TableHead>
                    <TableHead className="text-right whitespace-nowrap">CapEx</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Net CF</TableHead>
                    <TableHead className="text-right whitespace-nowrap">DSCR</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Debt Yield</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Cash-on-Cash</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Cumulative CF</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Loan Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(result?.annualCashFlows ?? []).map((row) => (
                    <TableRow key={row.year} className={row.year === 0 ? 'bg-muted/50 font-medium' : ''}>
                      <TableCell>
                        <Badge variant={row.year === 0 ? 'default' : 'outline'}>
                          {row.year === 0 ? 'Acq' : `Yr ${row.year}`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(row.noi)}</TableCell>
                      <TableCell className="text-right font-mono text-red-600">
                        {row.debtService > 0 ? `(${formatCurrency(row.debtService)})` : '-'}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${row.cfAfterDebt >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(row.cfAfterDebt)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-amber-600">
                        {row.capEx > 0 ? `(${formatCurrency(row.capEx)})` : '-'}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${row.netCF >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {formatCurrency(row.netCF)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.dscr > 0 ? (
                          <span className={row.dscr >= 1.25 ? 'text-green-600' : row.dscr >= 1.0 ? 'text-amber-600' : 'text-red-600'}>
                            {row.dscr.toFixed(2)}x
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.debtYield > 0 ? formatPercent(row.debtYield) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.cashOnCash !== 0 ? formatPercent(row.cashOnCash) : '-'}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${row.cumulativeCF >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(row.cumulativeCF)}
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(row.loanBalance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chart" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">NOI vs Debt Service vs Net CF</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => [formatCurrency(value), undefined]} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="NOI"
                      stackId="1"
                      stroke="#6366f1"
                      fill="#6366f1"
                      fillOpacity={0.6}
                    />
                    <Area
                      type="monotone"
                      dataKey="Debt Service"
                      stackId="2"
                      stroke="#ef4444"
                      fill="#ef4444"
                      fillOpacity={0.4}
                    />
                    <Area
                      type="monotone"
                      dataKey="Net CF"
                      stackId="3"
                      stroke="#22c55e"
                      fill="#22c55e"
                      fillOpacity={0.5}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Disposition Summary */}
      {result?.disposition && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4" />
              Disposition
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Exit NOI</p>
                <p className="text-lg font-semibold">{formatCurrency(result.disposition.exitNOI)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Exit Cap Rate</p>
                <p className="text-lg font-semibold">{formatPercent(result.disposition.exitCapRate)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gross Sale Price</p>
                <p className="text-lg font-semibold">{formatCurrency(result.disposition.grossSalePrice)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Disposition Costs</p>
                <p className="text-lg font-semibold text-red-600">
                  ({formatCurrency(result.disposition.dispositionCosts)})
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Loan Payoff</p>
                <p className="text-lg font-semibold text-red-600">
                  ({formatCurrency(result.disposition.loanPayoff)})
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Net Proceeds</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(result.disposition.netProceeds)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!result && !isLoading && (
        <Card>
          <CardContent className="py-16 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Cash Flow Data Available</h3>
            <p className="text-muted-foreground mb-4">
              Ensure the project has debt inputs and pro forma configured to generate the hold period summary.
            </p>
            <Button onClick={() => onTabChange?.('debt-inputs')}>
              Configure Debt Inputs
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default HoldPeriodSummary;
