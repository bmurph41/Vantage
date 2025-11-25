export interface CashFlow {
  period: number;
  date?: Date;
  amount: number;
  type: 'investment' | 'distribution' | 'intermediate';
  description?: string;
}

export interface IrrResult {
  irr: number;
  moic: number;
  cashFlows: CashFlow[];
  totalInvested: number;
  totalDistributed: number;
  netProfit: number;
  holdingPeriodYears: number;
}

export function calculateIRR(
  cashFlows: CashFlow[],
  maxIterations: number = 1000,
  tolerance: number = 0.0000001
): number | null {
  if (cashFlows.length < 2) return null;

  const values = cashFlows
    .sort((a, b) => a.period - b.period)
    .map(cf => cf.type === 'investment' ? -Math.abs(cf.amount) : cf.amount);

  if (values.length === 0) return null;

  const hasPositive = values.some(v => v > 0);
  const hasNegative = values.some(v => v < 0);
  if (!hasPositive || !hasNegative) return null;

  let low = -0.99;
  let high = 10.0;
  let mid = 0;

  for (let i = 0; i < maxIterations; i++) {
    mid = (low + high) / 2;
    const npv = calculateNPV(values, mid);

    if (Math.abs(npv) < tolerance) {
      return mid;
    }

    if (npv > 0) {
      low = mid;
    } else {
      high = mid;
    }

    if (high - low < tolerance) {
      return mid;
    }
  }

  return mid;
}

export function calculateNPV(values: number[], rate: number): number {
  return values.reduce((sum, value, index) => {
    return sum + value / Math.pow(1 + rate, index);
  }, 0);
}

export function calculateXIRR(
  cashFlows: { date: Date; amount: number }[],
  guess: number = 0.1,
  maxIterations: number = 1000,
  tolerance: number = 0.0000001
): number | null {
  if (cashFlows.length < 2) return null;

  const sorted = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const startDate = sorted[0].date;

  const hasPositive = sorted.some(cf => cf.amount > 0);
  const hasNegative = sorted.some(cf => cf.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  let rate = guess;

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let dnpv = 0;

    for (const cf of sorted) {
      const years = (cf.date.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      const discountFactor = Math.pow(1 + rate, years);
      npv += cf.amount / discountFactor;
      dnpv -= (years * cf.amount) / (discountFactor * (1 + rate));
    }

    if (Math.abs(npv) < tolerance) {
      return rate;
    }

    if (Math.abs(dnpv) < tolerance) {
      return null;
    }

    const newRate = rate - npv / dnpv;

    if (Math.abs(newRate - rate) < tolerance) {
      return newRate;
    }

    rate = newRate;

    if (rate < -0.99 || rate > 100) {
      return null;
    }
  }

  return null;
}

export function calculateMOIC(
  totalInvested: number,
  totalDistributed: number
): number {
  if (totalInvested === 0) return 0;
  return totalDistributed / totalInvested;
}

export function calculateFullIrrAnalysis(cashFlows: CashFlow[]): IrrResult {
  const sorted = [...cashFlows].sort((a, b) => a.period - b.period);
  
  const totalInvested = sorted
    .filter(cf => cf.type === 'investment')
    .reduce((sum, cf) => sum + Math.abs(cf.amount), 0);
  
  const totalDistributed = sorted
    .filter(cf => cf.type === 'distribution' || cf.type === 'intermediate')
    .reduce((sum, cf) => sum + cf.amount, 0);

  const netProfit = totalDistributed - totalInvested;
  const moic = calculateMOIC(totalInvested, totalDistributed);
  
  const firstPeriod = sorted[0]?.period ?? 0;
  const lastPeriod = sorted[sorted.length - 1]?.period ?? 0;
  const holdingPeriodYears = lastPeriod - firstPeriod;

  const irr = calculateIRR(sorted) ?? 0;

  return {
    irr,
    moic,
    cashFlows: sorted,
    totalInvested,
    totalDistributed,
    netProfit,
    holdingPeriodYears,
  };
}

export function generateAnnualCashFlows(
  initialInvestment: number,
  holdingPeriodYears: number,
  annualCashFlows: number[],
  exitProceeds: number
): CashFlow[] {
  const cashFlows: CashFlow[] = [
    {
      period: 0,
      amount: initialInvestment,
      type: 'investment',
      description: 'Initial Investment',
    },
  ];

  annualCashFlows.forEach((amount, index) => {
    if (amount !== 0) {
      cashFlows.push({
        period: index + 1,
        amount,
        type: 'intermediate',
        description: `Year ${index + 1} Cash Flow`,
      });
    }
  });

  cashFlows.push({
    period: holdingPeriodYears,
    amount: exitProceeds,
    type: 'distribution',
    description: 'Exit Proceeds',
  });

  return cashFlows;
}

export function annualizedReturn(
  totalReturn: number,
  holdingPeriodYears: number
): number {
  if (holdingPeriodYears <= 0) return 0;
  if (totalReturn <= -1) return -1;
  return Math.pow(1 + totalReturn, 1 / holdingPeriodYears) - 1;
}

export function formatIrrPercent(irr: number, decimals: number = 1): string {
  return `${(irr * 100).toFixed(decimals)}%`;
}

export function formatMoic(moic: number, decimals: number = 2): string {
  return `${moic.toFixed(decimals)}x`;
}
