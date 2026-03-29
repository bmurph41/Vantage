import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, ReferenceLine,
} from 'recharts';
import { DollarSign, TrendingUp, ArrowDownCircle, Landmark } from 'lucide-react';

interface FundCashFlowDetailProps {
  projectId: string;
  onTabChange?: (tab: string) => void;
}

interface ProFormaYear {
  year: number;
  revenue?: number;
  effectiveGrossIncome?: number;
  totalRevenue?: number;
  operatingExpenses?: number;
  totalExpenses?: number;
  noi?: number;
  netOperatingIncome?: number;
  debtService?: number;
  capex?: number;
  capitalExpenditures?: number;
}

interface ProFormaData {
  annual?: ProFormaYear[];
  monthly?: Array<{
    month: number;
    year: number;
    revenue?: number;
    effectiveGrossIncome?: number;
    totalRevenue?: number;
    operatingExpenses?: number;
    totalExpenses?: number;
    noi?: number;
    netOperatingIncome?: number;
    debtService?: number;
  }>;
  holdPeriod?: number;
  holdPeriodYears?: number;
}

interface DealPricingInputs {
  purchasePrice?: number;
  acquisitionPrice?: number;
  closingCostsPct?: number;
  closingCosts?: number;
  capexReserve?: number;
  capexReserves?: number;
  exitCapRate?: number;
  saleCostsPct?: number;
  saleCosts?: number;
  managementFeePct?: number;
  loanAmount?: number;
  ltvRatio?: number;
  interestRate?: number;
}

interface GnAMonthlyEntry {
  month: number;
  total: number;
  partnerComp?: number;
  staffComp?: number;
  overhead?: number;
}

interface FundGnAData {
  partners?: any[];
  staff?: any[];
  overhead?: any[];
  benefitsRate?: number;
  annualSalaryGrowth?: number;
}

const COLORS = {
  capitalCalls: '#DC2626',
  capexCalls: '#EA580C',
  netOpCF: '#16A34A',
  noiLine: '#1B4D5C',
  saleProceeds: '#2563EB',
} as const;

/**
 * Normalize a cap rate value to decimal form.
 * If value < 1, treat as already decimal (e.g., 0.065 = 6.5%).
 * If value >= 1, treat as percentage (e.g., 6.5 = 6.5%).
 */
function normalizeCapRateToDecimal(value: number): number {
  if (value < 1) return value;
  return value / 100;
}

function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="mb-1 text-sm font-medium">{label}</p>
      {payload.map((entry: any, idx: number) => (
        <p key={idx} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {formatCurrencyFull(entry.value)}
        </p>
      ))}
    </div>
  );
}

/**
 * Compute G&A monthly totals from saved FundGnAData (mirrors fund-gna-model.tsx logic).
 */
function computeGnAMonthly(data: FundGnAData, holdMonths: number): GnAMonthlyEntry[] {
  const { partners = [], staff = [], overhead = [], benefitsRate = 0.28, annualSalaryGrowth = 0.03 } = data;
  const months: GnAMonthlyEntry[] = [];

  for (let m = 1; m <= holdMonths; m++) {
    let partnerComp = 0;
    for (const p of partners) {
      if (m >= (p.startMonth ?? 1)) {
        const elapsed = m - (p.startMonth ?? 1) + 1;
        const yearsElapsed = Math.floor((elapsed - 1) / 12);
        const grown = (p.annualSalary ?? 0) * Math.pow(1 + annualSalaryGrowth, yearsElapsed);
        partnerComp += (grown * (1 + benefitsRate)) / 12;
      }
    }

    let staffComp = 0;
    for (const s of staff) {
      if (m >= (s.hireMonth ?? 1)) {
        const elapsed = m - (s.hireMonth ?? 1) + 1;
        const yearsElapsed = Math.floor((elapsed - 1) / 12);
        const grown = (s.annualSalary ?? 0) * Math.pow(1 + annualSalaryGrowth, yearsElapsed);
        const raw = (grown * (1 + benefitsRate)) / 12;
        staffComp += raw * ((s.gnaAllocPct ?? 100) / 100);
      }
    }

    let overheadTotal = 0;
    for (const o of overhead) {
      const startMonth = o.startMonth ?? 1;
      const rampUpMonths = o.rampUpMonths ?? 0;
      if (m >= startMonth) {
        let factor = 1;
        if (rampUpMonths > 0) {
          const elapsed = m - startMonth + 1;
          factor = elapsed >= rampUpMonths ? 1 : elapsed / rampUpMonths;
        }
        overheadTotal += (o.monthlyBudget ?? 0) * factor;
      }
    }

    months.push({
      month: m,
      total: partnerComp + staffComp + overheadTotal,
      partnerComp,
      staffComp,
      overhead: overheadTotal,
    });
  }

  return months;
}

export default function FundCashFlowDetail({ projectId, onTabChange }: FundCashFlowDetailProps) {
  const [activeView, setActiveView] = useState<string>('charts');

  const { data: proFormaData, isLoading: proFormaLoading } = useQuery<ProFormaData>({
    queryKey: ['/api/modeling/projects', projectId, 'pro-forma'],
  });

  const { data: dealPricing, isLoading: pricingLoading } = useQuery<DealPricingInputs>({
    queryKey: ['/api/modeling/projects', projectId, 'deal-pricing', 'inputs'],
  });

  const { data: project, isLoading: projectLoading } = useQuery<any>({
    queryKey: ['modeling-project', projectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/modeling/projects/${projectId}`);
      return res.json();
    },
  });

  const isLoading = proFormaLoading || pricingLoading || projectLoading;

  const computed = useMemo(() => {
    if (!proFormaData || !dealPricing) return null;

    const annual = proFormaData.annual ?? [];
    const monthly = proFormaData.monthly ?? [];
    const cm = project?.customMetrics ?? {};

    // Hold period: pro-forma first, then project customMetrics fallback
    const holdPeriod = proFormaData.holdPeriod
      ?? proFormaData.holdPeriodYears
      ?? cm?.fundAssumptions?.holdPeriod
      ?? (annual.length || 5);

    const purchasePrice = dealPricing.purchasePrice ?? dealPricing.acquisitionPrice ?? 0;
    const closingCosts = dealPricing.closingCosts ??
      (dealPricing.closingCostsPct ? purchasePrice * (dealPricing.closingCostsPct / 100) : purchasePrice * 0.02);
    const capexReserve = dealPricing.capexReserve ?? dealPricing.capexReserves ?? 0;
    const rawExitCapRate = dealPricing.exitCapRate ?? 6.5;
    const exitCapRateDecimal = normalizeCapRateToDecimal(rawExitCapRate);
    const saleCostsPct = dealPricing.saleCostsPct ?? 2;
    const managementFeePct = dealPricing.managementFeePct ?? 1.5;
    const loanAmount = dealPricing.loanAmount ??
      (dealPricing.ltvRatio ? purchasePrice * (dealPricing.ltvRatio / 100) : purchasePrice * 0.65);

    // Fund G&A from project.customMetrics.fundGnA
    const fundGnAData: FundGnAData | undefined = cm?.fundGnA;
    const holdMonths = holdPeriod * 12;
    const gnAMonthly = fundGnAData ? computeGnAMonthly(fundGnAData, holdMonths) : null;

    // Pre-compute annual G&A totals from the monthly G&A data
    const annualGnA: number[] = [];
    if (gnAMonthly) {
      for (let yr = 0; yr < holdPeriod; yr++) {
        const start = yr * 12;
        const end = Math.min(start + 12, gnAMonthly.length);
        let total = 0;
        for (let m = start; m < end; m++) {
          total += gnAMonthly[m]?.total ?? 0;
        }
        annualGnA.push(total);
      }
    }

    // Annual capital calls and operating CF
    const annualData = annual.map((yr, idx) => {
      const noi = yr.noi ?? yr.netOperatingIncome ?? 0;
      const ds = yr.debtService ?? 0;
      const capex = yr.capex ?? yr.capitalExpenditures ?? 0;

      // Use G&A from fund model if available, otherwise fall back to managementFeePct
      const mgmtFee = annualGnA[idx] !== undefined ? annualGnA[idx] : noi * (managementFeePct / 100);

      const acquisitionCapitalCall = idx === 0 ? purchasePrice + closingCosts : 0;
      const capexCapitalCall = idx === 0 ? capexReserve : capex;
      const netOpCF = noi - ds - mgmtFee;

      return {
        year: yr.year ?? idx + 1,
        label: `Yr ${idx + 1}`,
        noi,
        debtService: ds,
        mgmtFee,
        acquisitionCapitalCall,
        capexCapitalCall,
        totalCapitalCall: acquisitionCapitalCall + capexCapitalCall,
        netOpCF,
      };
    });

    // Fill in if no annual data
    const years = annualData.length > 0 ? annualData : Array.from({ length: holdPeriod }, (_, i) => ({
      year: i + 1,
      label: `Yr ${i + 1}`,
      noi: 0,
      debtService: 0,
      mgmtFee: annualGnA[i] ?? 0,
      acquisitionCapitalCall: i === 0 ? purchasePrice + closingCosts : 0,
      capexCapitalCall: i === 0 ? capexReserve : 0,
      totalCapitalCall: i === 0 ? purchasePrice + closingCosts + capexReserve : 0,
      netOpCF: 0 - (annualGnA[i] ?? 0),
    }));

    // Sale proceeds from last year's NOI — use normalized decimal cap rate
    const lastYearNOI = years[years.length - 1]?.noi ?? 0;
    const exitValue = lastYearNOI > 0 && exitCapRateDecimal > 0 ? lastYearNOI / exitCapRateDecimal : 0;
    const saleCosts = exitValue * (saleCostsPct / 100);
    const saleProceeds = exitValue - saleCosts - loanAmount;

    // Totals
    const totalLPCalled = years.reduce((sum, yr) => sum + yr.totalCapitalCall, 0);
    const totalOpCF = years.reduce((sum, yr) => sum + yr.netOpCF, 0);
    const totalPool = totalLPCalled + totalOpCF + Math.max(saleProceeds, 0);

    // Monthly operating CF data
    const monthlyData = monthly.length > 0
      ? monthly.map((m, idx) => {
          const rev = m.revenue ?? m.effectiveGrossIncome ?? m.totalRevenue ?? 0;
          const exp = m.operatingExpenses ?? m.totalExpenses ?? 0;
          const noi = m.noi ?? m.netOperatingIncome ?? (rev - exp);
          const ds = m.debtService ?? 0;
          // Use G&A monthly if available
          const mgmtFee = gnAMonthly?.[idx]?.total ?? (noi * (managementFeePct / 100));
          const netCF = noi - ds - mgmtFee;
          return {
            month: idx + 1,
            label: `M${idx + 1}`,
            noi,
            debtService: ds,
            netCF,
          };
        })
      : Array.from({ length: holdPeriod * 12 }, (_, i) => {
          // Interpolate from annual data
          const yrIdx = Math.floor(i / 12);
          const yr = years[yrIdx] ?? years[years.length - 1];
          const monthlyNOI = (yr?.noi ?? 0) / 12;
          const monthlyDS = (yr?.debtService ?? 0) / 12;
          const monthlyMgmt = (yr?.mgmtFee ?? 0) / 12;
          return {
            month: i + 1,
            label: `M${i + 1}`,
            noi: monthlyNOI,
            debtService: monthlyDS,
            netCF: monthlyNOI - monthlyDS - monthlyMgmt,
          };
        });

    // Quarterly aggregation with improved capital call distribution
    const quarterlyData: Array<{
      quarter: string;
      capitalCalled: number;
      operatingIncome: number;
      debtService: number;
      netCF: number;
      cumulative: number;
    }> = [];
    let cumulative = 0;
    const totalMonths = monthlyData.length;
    const totalQuarters = Math.ceil(totalMonths / 3);

    for (let q = 0; q < totalQuarters; q++) {
      const startMonth = q * 3;
      const endMonth = Math.min(startMonth + 3, totalMonths);
      const slice = monthlyData.slice(startMonth, endMonth);

      const qNOI = slice.reduce((s, m) => s + m.noi, 0);
      const qDS = slice.reduce((s, m) => s + m.debtService, 0);
      const qNetCF = slice.reduce((s, m) => s + m.netCF, 0);

      // Improved capital call distribution:
      // Year 1: acquisition capital in Q1, capex reserves spread over Q1-Q3
      // Subsequent years: capex spread over Q1-Q2 of that year
      const yrIdx = Math.floor(startMonth / 12);
      const qInYear = Math.floor((startMonth % 12) / 3); // 0-based quarter within year

      let capitalCalled = 0;
      if (yrIdx === 0) {
        // Year 1: acquisition in Q1; capex reserves spread over Q1-Q3
        if (qInYear === 0) {
          capitalCalled = (years[0]?.acquisitionCapitalCall ?? 0) + (capexReserve * 0.5);
        } else if (qInYear === 1) {
          capitalCalled = capexReserve * 0.3;
        } else if (qInYear === 2) {
          capitalCalled = capexReserve * 0.2;
        }
      } else if (yrIdx < years.length) {
        // Subsequent years: spread capex over Q1 (60%) and Q2 (40%)
        const yearCapex = years[yrIdx]?.capexCapitalCall ?? 0;
        if (qInYear === 0) {
          capitalCalled = yearCapex * 0.6;
        } else if (qInYear === 1) {
          capitalCalled = yearCapex * 0.4;
        }
      }

      cumulative += qNetCF - capitalCalled;

      quarterlyData.push({
        quarter: `Q${(q % 4) + 1} Yr ${Math.floor(q / 4) + 1}`,
        capitalCalled,
        operatingIncome: qNOI,
        debtService: qDS,
        netCF: qNetCF,
        cumulative,
      });
    }

    // Charts data — include sale proceeds as a bar in the last year
    const annualChartData = years.map((yr, idx) => ({
      name: yr.label,
      'Acquisition Capital Calls': -yr.acquisitionCapitalCall,
      'CapEx Capital Calls': -yr.capexCapitalCall,
      'Net Operating CF': yr.netOpCF,
      'Sale Proceeds': idx === years.length - 1 ? Math.max(saleProceeds, 0) : 0,
    }));

    const noiChartData = years.map((yr) => ({
      name: yr.label,
      NOI: yr.noi,
    }));

    const monthlyBarData = monthlyData.map((m) => ({
      name: m.label,
      'Net CF': m.netCF,
    }));

    return {
      totalLPCalled,
      totalOpCF,
      saleProceeds,
      totalPool,
      annualChartData,
      noiChartData,
      monthlyBarData,
      quarterlyData,
      holdPeriod,
      totalMonths: monthlyData.length,
    };
  }, [proFormaData, dealPricing, project]);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="space-y-2">
          <div className="h-8 w-64 animate-pulse rounded bg-muted" />
          <div className="h-4 w-96 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!computed) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <p>No pro forma or deal pricing data available. Configure inputs to generate fund cash flows.</p>
      </div>
    );
  }

  const {
    totalLPCalled,
    totalOpCF,
    saleProceeds,
    totalPool,
    annualChartData,
    noiChartData,
    monthlyBarData,
    quarterlyData,
    holdPeriod,
    totalMonths,
  } = computed;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Fund Cash Flow</h2>
        <p className="text-sm text-muted-foreground">
          LP capital calls, operating CF, and monthly distribution detail
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total LP Called</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalLPCalled)}</div>
            <p className="text-xs text-muted-foreground">Investment period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Op CF</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalOpCF >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalOpCF)}
            </div>
            <p className="text-xs text-muted-foreground">Net of DS + G&A</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-200">Sale Proceeds</CardTitle>
            <Landmark className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(saleProceeds)}</div>
            <p className="text-xs text-slate-400">All exits</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pool</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(totalPool)}</div>
            <p className="text-xs text-muted-foreground">Available for distribution</p>
          </CardContent>
        </Card>
      </div>

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={setActiveView}>
        <TabsList>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Detail</TabsTrigger>
        </TabsList>

        {/* Charts View */}
        <TabsContent value="charts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Annual Capital Calls & Net Operating CF</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={annualChartData} stackOffset="sign">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis tickFormatter={(v: number) => formatCurrency(v)} className="text-xs" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <ReferenceLine y={0} stroke="#888" />
                  <Bar
                    dataKey="Acquisition Capital Calls"
                    stackId="stack"
                    fill={COLORS.capitalCalls}
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="CapEx Capital Calls"
                    stackId="stack"
                    fill={COLORS.capexCalls}
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="Net Operating CF"
                    stackId="stack"
                    fill={COLORS.netOpCF}
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="Sale Proceeds"
                    stackId="stack"
                    fill={COLORS.saleProceeds}
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Portfolio NOI by Year</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={noiChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis tickFormatter={(v: number) => formatCurrency(v)} className="text-xs" />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="NOI"
                    stroke={COLORS.noiLine}
                    fill={COLORS.noiLine}
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quarterly View */}
        <TabsContent value="quarterly">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quarterly Fund Cash Flow Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quarter</TableHead>
                      <TableHead className="text-right">Capital Called</TableHead>
                      <TableHead className="text-right">Operating Income</TableHead>
                      <TableHead className="text-right">Debt Service</TableHead>
                      <TableHead className="text-right">Net CF</TableHead>
                      <TableHead className="text-right">Cumulative</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quarterlyData.map((q, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{q.quarter}</TableCell>
                        <TableCell className="text-right">
                          {q.capitalCalled > 0 ? (
                            <span className="text-red-600">{formatCurrencyFull(q.capitalCalled)}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={q.operatingIncome >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrencyFull(q.operatingIncome)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-orange-600">
                            {formatCurrencyFull(q.debtService)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={q.netCF >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                            {formatCurrencyFull(q.netCF)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={q.cumulative >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrencyFull(q.cumulative)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monthly Detail View */}
        <TabsContent value="monthly">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Monthly Fund Operating CF</CardTitle>
                <Badge variant="secondary">{`All ${totalMonths} Months`}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div style={{ minWidth: Math.max(800, totalMonths * 16) }}>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={monthlyBarData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="name"
                        className="text-xs"
                        interval={totalMonths > 60 ? 5 : totalMonths > 24 ? 2 : 0}
                        angle={-45}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis tickFormatter={(v: number) => formatCurrency(v)} className="text-xs" />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={0} stroke="#888" />
                      <Bar dataKey="Net CF" radius={[1, 1, 0, 0]}>
                        {monthlyBarData.map((entry, idx) => (
                          <Cell
                            key={idx}
                            fill={entry['Net CF'] >= 0 ? COLORS.netOpCF : COLORS.capitalCalls}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
