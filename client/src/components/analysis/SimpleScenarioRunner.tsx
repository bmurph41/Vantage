import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  SlidersHorizontal,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/utils';

/**
 * Newton-Raphson IRR solver over an array of cash flows.
 * cashFlows[0] is time-0 (typically negative equity), cashFlows[1..N] are periodic.
 */
function calculateIRR(cashFlows: number[], guess = 0.1, maxIterations = 100, tolerance = 0.00001): number {
  let rate = guess;
  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let dnpv = 0;
    for (let j = 0; j < cashFlows.length; j++) {
      npv += cashFlows[j] / Math.pow(1 + rate, j);
      dnpv -= j * cashFlows[j] / Math.pow(1 + rate, j + 1);
    }
    if (Math.abs(dnpv) < 1e-12) break;
    const newRate = rate - npv / dnpv;
    if (Math.abs(newRate - rate) < tolerance) return newRate;
    rate = newRate;
  }
  return rate;
}

/** Discount a series of cash flows at the given rate. */
function calculateNPV(rate: number, cashFlows: number[]): number {
  return cashFlows.reduce((npv, cf, i) => npv + cf / Math.pow(1 + rate, i), 0);
}

/**
 * Build a full DCF cash-flow vector for a hold period.
 * Returns an array of length holdYears + 1 (year 0 through year N).
 */
function buildCashFlows(params: {
  equity: number;
  baseRevenue: number;
  baseExpenses: number;
  revenueGrowthRate: number;
  expenseGrowthRate: number;
  debtService: number;
  holdYears: number;
  exitCapRateDecimal: number;
  loanBalance: number;
}): number[] {
  const {
    equity, baseRevenue, baseExpenses,
    revenueGrowthRate, expenseGrowthRate,
    debtService, holdYears, exitCapRateDecimal, loanBalance,
  } = params;

  const cfs: number[] = [-equity]; // Year 0: equity outlay

  let rev = baseRevenue;
  let exp = baseExpenses;

  for (let y = 1; y <= holdYears; y++) {
    rev *= 1 + revenueGrowthRate;
    exp *= 1 + expenseGrowthRate;
    const noi = rev - exp;
    let cf = noi - debtService;

    if (y === holdYears) {
      // Terminal year: add reversion (sale proceeds minus loan payoff)
      const terminalNoi = rev * (1 + revenueGrowthRate) - exp * (1 + expenseGrowthRate);
      const reversion = exitCapRateDecimal > 0 ? terminalNoi / exitCapRateDecimal : 0;
      cf += reversion - loanBalance;
    }

    cfs.push(cf);
  }

  return cfs;
}

interface SimpleScenarioRunnerProps {
  projectId: string;
}

interface BaseMetrics {
  noi: number;
  purchasePrice: number;
  capRate: number;
  irr: number;
  cashOnCash: number;
  vacancyRate: number;
  totalRevenue: number;
  totalExpenses: number;
  holdPeriod: number;
  exitCapRate: number;
  equityAmount: number;
  debtService: number;
  interestRate: number;
}

function DeltaBadge({ value, suffix = '' }: { value: number; suffix?: string }) {
  if (Math.abs(value) < 0.001) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />
        No change
      </span>
    );
  }
  const isPositive = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        isPositive ? 'text-green-600' : 'text-red-600'
      }`}
    >
      {isPositive ? (
        <ArrowUpRight className="h-3 w-3" />
      ) : (
        <ArrowDownRight className="h-3 w-3" />
      )}
      {isPositive ? '+' : ''}
      {value.toFixed(2)}
      {suffix}
    </span>
  );
}

function WhatIfCard({
  title,
  description,
  irrDelta,
  valueDelta,
}: {
  title: string;
  description: string;
  irrDelta: number;
  valueDelta: number;
}) {
  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <h4 className="text-sm font-semibold mb-1">{title}</h4>
        <p className="text-xs text-muted-foreground mb-3">{description}</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">IRR Impact</p>
            <DeltaBadge value={irrDelta} suffix="%" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Value Impact</p>
            <DeltaBadge value={valueDelta} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    </div>
  );
}

export default function SimpleScenarioRunner({ projectId }: SimpleScenarioRunnerProps) {
  const [revenueGrowth, setRevenueGrowth] = useState(3);
  const [expenseGrowth, setExpenseGrowth] = useState(2);
  const [exitCapRate, setExitCapRate] = useState(7);

  const { data: project } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId],
    enabled: !!projectId,
  });

  const { data: pricingRaw } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'deal-pricing', 'inputs'],
    enabled: !!projectId,
  });

  const { data: proFormaRaw, isLoading } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'pro-forma'],
    enabled: !!projectId,
  });

  const { data: capitalStackRaw } = useQuery<any>({
    queryKey: ['/api/modeling/projects', projectId, 'capital-stack'],
    enabled: !!projectId,
  });

  const base = useMemo<BaseMetrics | null>(() => {
    if (!project) return null;
    const pricing = pricingRaw?.dealPricingResults ?? pricingRaw?.dealPricing ?? pricingRaw ?? {};
    const s0 = proFormaRaw?.scenarios?.[0];
    const m = s0?.metrics ?? {};
    const pp = typeof project.purchasePrice === 'string' ? parseFloat(project.purchasePrice) : (project.purchasePrice ?? 0);
    const rev = m.totalRevenue ?? proFormaRaw?.revenue?.totals?.[0] ?? proFormaRaw?.totalRevenue ?? 0;
    const exp = m.totalExpenses ?? proFormaRaw?.expenses?.totals?.[0] ?? proFormaRaw?.totalExpenses ?? 0;
    const noi = m.noi ?? m.stabilizedNoi ?? (Array.isArray(proFormaRaw?.noi) ? proFormaRaw.noi[0] : proFormaRaw?.noi) ?? (rev - exp);
    const cs = capitalStackRaw ?? {};
    const loanAmount = cs.loanAmount ?? cs.totalDebt ?? 0;
    const equity = cs.equityAmount ?? cs.totalEquity ?? (pp - loanAmount);
    const ds = m.debtService ?? cs.annualDebtService ?? 0;

    return {
      noi: noi || 0,
      purchasePrice: pp,
      capRate: m.capRate ?? pricing.capRate ?? (pp > 0 ? noi / pp : 0),
      irr: (m.irr ?? pricing.irr ?? project.irr ?? 0),
      cashOnCash: m.cashOnCash ?? pricing.cashOnCash ?? 0,
      vacancyRate: m.vacancyRate ?? 0.05,
      totalRevenue: rev,
      totalExpenses: exp,
      holdPeriod: cs.holdPeriod ?? pricing.holdPeriod ?? project.customMetrics?.holdPeriod ?? 5,
      exitCapRate: pricing.exitCapRate ?? project.customMetrics?.exitCapRate ?? 0.07,
      equityAmount: equity,
      debtService: ds,
      interestRate: cs.interestRate ?? cs.rate ?? 0,
    };
  }, [project, pricingRaw, proFormaRaw, capitalStackRaw]);

  if (isLoading) return <LoadingSkeleton />;

  if (!base || !project) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Model Data</h2>
        <p className="text-muted-foreground">Complete your model inputs to use the scenario runner.</p>
      </Card>
    );
  }

  // Compute projected metrics based on slider values
  const holdYears = base.holdPeriod;
  const equity = base.equityAmount || base.purchasePrice;
  const loanBalance = base.purchasePrice - equity;

  const projectedNoi = (() => {
    let rev = base.totalRevenue;
    let exp = base.totalExpenses;
    for (let y = 0; y < holdYears; y++) {
      rev *= 1 + revenueGrowth / 100;
      exp *= 1 + expenseGrowth / 100;
    }
    return rev - exp;
  })();

  const projectedValue = exitCapRate > 0 ? projectedNoi / (exitCapRate / 100) : 0;

  // Full DCF cash-flow projection & Newton-Raphson IRR
  const cashFlows = buildCashFlows({
    equity,
    baseRevenue: base.totalRevenue,
    baseExpenses: base.totalExpenses,
    revenueGrowthRate: revenueGrowth / 100,
    expenseGrowthRate: expenseGrowth / 100,
    debtService: base.debtService,
    holdYears,
    exitCapRateDecimal: exitCapRate / 100,
    loanBalance,
  });

  const estimatedIrr = equity > 0 ? calculateIRR(cashFlows) : 0;

  // Total distributions = sum of all positive cash flows (years 1..N)
  const totalDistributions = cashFlows.slice(1).reduce((s, cf) => s + cf, 0);
  const totalReturn = totalDistributions - equity;
  const equityMultiple = equity > 0 ? totalDistributions / equity : 0;
  const cashOnCash = equity > 0 && cashFlows.length > 1 ? cashFlows[1] / equity : 0;

  // What-If scenarios — each builds a full DCF and computes IRR delta vs. the base case
  const whatIfs = useMemo(() => {
    if (!base) return [];
    const baseIrr = equity > 0 ? calculateIRR(cashFlows) : 0;
    const currentValue = base.capRate > 0 ? base.noi / base.capRate : base.purchasePrice;
    const baseExitCap = exitCapRate / 100;

    // Shared builder params (matches the slider state)
    const shared = {
      equity,
      baseRevenue: base.totalRevenue,
      baseExpenses: base.totalExpenses,
      revenueGrowthRate: revenueGrowth / 100,
      expenseGrowthRate: expenseGrowth / 100,
      debtService: base.debtService,
      holdYears: base.holdPeriod,
      exitCapRateDecimal: baseExitCap,
      loanBalance,
    };

    // --- What if vacancy increases 5%? ---
    // Reduce base revenue by 5% to simulate higher vacancy
    const vacancyCfs = buildCashFlows({
      ...shared,
      baseRevenue: base.totalRevenue * 0.95,
    });
    const vacancyIrr = equity > 0 ? calculateIRR(vacancyCfs) : 0;
    const vacancyNoi = base.noi - base.totalRevenue * 0.05;
    const vacancyValue = base.capRate > 0 ? vacancyNoi / base.capRate : 0;

    // --- What if rates go up 1%? ---
    // Additional annual debt service from 100bps rate increase on the loan
    const additionalDebtService = loanBalance * 0.01;
    const rateCfs = buildCashFlows({
      ...shared,
      debtService: base.debtService + additionalDebtService,
    });
    const rateIrr = equity > 0 ? calculateIRR(rateCfs) : 0;
    const rateNoi = base.noi - additionalDebtService;
    const rateValue = base.capRate > 0 ? rateNoi / base.capRate : 0;

    // --- What if I hold 2 more years? ---
    const extraYears = 2;
    const extendedCfs = buildCashFlows({
      ...shared,
      holdYears: base.holdPeriod + extraYears,
    });
    const extendedIrr = equity > 0 ? calculateIRR(extendedCfs) : 0;
    // Compute terminal value at the extended hold
    let extRev = base.totalRevenue;
    let extExp = base.totalExpenses;
    for (let y = 0; y < base.holdPeriod + extraYears; y++) {
      extRev *= 1 + revenueGrowth / 100;
      extExp *= 1 + expenseGrowth / 100;
    }
    const extTerminalNoi = extRev - extExp;
    const extValue = baseExitCap > 0 ? extTerminalNoi / baseExitCap : 0;

    return [
      {
        title: 'What if vacancy increases 5%?',
        description: 'Impact of 5 percentage points higher vacancy on returns',
        irrDelta: (vacancyIrr - baseIrr) * 100,
        valueDelta: vacancyValue - currentValue,
      },
      {
        title: 'What if rates go up 1%?',
        description: 'Impact of a 100bps increase in interest rates',
        irrDelta: (rateIrr - baseIrr) * 100,
        valueDelta: rateValue - currentValue,
      },
      {
        title: 'What if I hold 2 more years?',
        description: `Extending hold period from ${base.holdPeriod} to ${base.holdPeriod + extraYears} years`,
        irrDelta: (extendedIrr - baseIrr) * 100,
        valueDelta: extValue - currentValue,
      },
    ];
  }, [base, equity, cashFlows, exitCapRate, revenueGrowth, expenseGrowth, loanBalance]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-blue-600" />
          Quick Scenario Runner
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Adjust the sliders to instantly see how changes affect your returns
        </p>
      </div>

      {/* Three Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Revenue Growth */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Revenue Growth
            </CardTitle>
            <CardDescription className="text-xs">Annual revenue growth rate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">0%</span>
              <Badge variant="outline" className="text-sm font-bold">{revenueGrowth.toFixed(1)}%</Badge>
              <span className="text-xs text-muted-foreground">10%</span>
            </div>
            <Slider
              value={[revenueGrowth]}
              onValueChange={([v]) => setRevenueGrowth(v)}
              min={0}
              max={10}
              step={0.5}
              className="py-2"
            />
            <div className="pt-2 border-t space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Projected NOI</span>
                <span className="font-semibold">{formatCurrency(projectedNoi)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">vs Base NOI</span>
                <DeltaBadge value={projectedNoi - base.noi} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expense Growth */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              Expense Growth
            </CardTitle>
            <CardDescription className="text-xs">Annual expense growth rate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">0%</span>
              <Badge variant="outline" className="text-sm font-bold">{expenseGrowth.toFixed(1)}%</Badge>
              <span className="text-xs text-muted-foreground">10%</span>
            </div>
            <Slider
              value={[expenseGrowth]}
              onValueChange={([v]) => setExpenseGrowth(v)}
              min={0}
              max={10}
              step={0.5}
              className="py-2"
            />
            <div className="pt-2 border-t space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Projected Value</span>
                <span className="font-semibold">{formatCurrency(projectedValue)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">vs Purchase Price</span>
                <DeltaBadge value={projectedValue - base.purchasePrice} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Exit Cap Rate */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-indigo-600" />
              Exit Cap Rate
            </CardTitle>
            <CardDescription className="text-xs">Cap rate at time of sale</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">3%</span>
              <Badge variant="outline" className="text-sm font-bold">{exitCapRate.toFixed(1)}%</Badge>
              <span className="text-xs text-muted-foreground">10%</span>
            </div>
            <Slider
              value={[exitCapRate]}
              onValueChange={([v]) => setExitCapRate(v)}
              min={3}
              max={10}
              step={0.25}
              className="py-2"
            />
            <div className="pt-2 border-t space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Estimated IRR</span>
                <span className="font-semibold">{(estimatedIrr * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Equity Multiple</span>
                <span className="font-semibold">{equityMultiple.toFixed(2)}x</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Cash-on-Cash (Yr 1)</span>
                <span className="font-semibold">{(cashOnCash * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Total Return</span>
                <DeltaBadge value={totalReturn} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* What-If Cards */}
      <div>
        <h3 className="text-base font-semibold mb-3">Quick What-If Analysis</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {whatIfs.map((wif, i) => (
            <WhatIfCard key={i} {...wif} />
          ))}
        </div>
      </div>
    </div>
  );
}
