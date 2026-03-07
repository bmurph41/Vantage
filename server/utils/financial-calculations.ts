
// ─── Canonical XIRR also available from shared/finance/xirr.ts ───
// New code should import from '../../shared/finance/xirr' directly.
// This file's calculateXIRR is kept for backward compatibility.
/**
 * PE-Grade Financial Calculation Utilities
 * 
 * Provides XIRR/XNPV calculations that account for exact cash flow timing,
 * essential for institutional-quality investment analysis.
 */

export interface DatedCashFlow {
  date: Date;
  amount: number;
}

/**
 * Calculate XNPV (Extended Net Present Value)
 * NPV that accounts for exact cash flow dates rather than equal periods
 * 
 * @param rate - Annual discount rate (e.g., 0.10 for 10%)
 * @param cashFlows - Array of cash flows with dates
 * @returns Net present value
 */
export function calculateXNPV(rate: number, cashFlows: DatedCashFlow[]): number {
  if (cashFlows.length === 0) return 0;
  
  const sortedFlows = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const baseDate = sortedFlows[0].date;
  
  return sortedFlows.reduce((npv, cf) => {
    const yearFraction = (cf.date.getTime() - baseDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    return npv + cf.amount / Math.pow(1 + rate, yearFraction);
  }, 0);
}

/**
 * Calculate XIRR (Extended Internal Rate of Return)
 * IRR that accounts for exact cash flow dates using Newton-Raphson method.
 * 
 * Unified with shared/exit/irr-calculator.ts — same algorithm, tolerance,
 * iteration count, and rate bounds. This version returns 0 instead of null
 * on failure since downstream consumers (pro forma engine) expect a number.
 * 
 * Standard: 365.25-day year fraction, Newton-Raphson with derivative guard,
 * rate clamped to [-0.99, 100], tolerance 1e-7, max 1000 iterations.
 * 
 * @param cashFlows - Array of cash flows with dates (must have at least one positive and one negative)
 * @param guess - Initial guess for IRR (default 0.1 = 10%)
 * @param maxIterations - Maximum iterations for convergence (default 1000)
 * @param tolerance - Convergence tolerance (default 1e-7)
 * @returns Annual IRR as decimal (e.g., 0.15 for 15%), or 0 if unsolvable
 */
export function calculateXIRR(
  cashFlows: DatedCashFlow[],
  guess: number = 0.1,
  maxIterations: number = 1000,
  tolerance: number = 0.0000001
): number {
  if (cashFlows.length < 2) return 0;
  
  const hasPositive = cashFlows.some(cf => cf.amount > 0);
  const hasNegative = cashFlows.some(cf => cf.amount < 0);
  if (!hasPositive || !hasNegative) return 0;
  
  const sortedFlows = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const baseDate = sortedFlows[0].date;
  
  const yearFractions = sortedFlows.map(cf => 
    (cf.date.getTime() - baseDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );
  
  let rate = guess;
  
  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let npvDerivative = 0;
    
    for (let j = 0; j < sortedFlows.length; j++) {
      const t = yearFractions[j];
      const cf = sortedFlows[j].amount;
      const factor = Math.pow(1 + rate, t);
      
      npv += cf / factor;
      npvDerivative -= t * cf / (factor * (1 + rate));
    }
    
    if (Math.abs(npv) < tolerance) {
      return rate;
    }
    
    if (Math.abs(npvDerivative) < tolerance) {
      return 0;
    }
    
    const newRate = rate - npv / npvDerivative;
    
    if (Math.abs(newRate - rate) < tolerance) {
      return newRate;
    }
    
    if (newRate < -0.99 || newRate > 100) {
      return 0;
    }
    
    rate = newRate;
  }
  
  return 0;
}

/**
 * Generate monthly period dates from a start date over a hold period
 * 
 * @param startDate - Start date of investment
 * @param holdPeriodYears - Number of years to hold
 * @returns Array of monthly dates starting from startDate
 */
export function generateMonthlyPeriods(startDate: Date, holdPeriodYears: number): Date[] {
  const periods: Date[] = [];
  const totalMonths = holdPeriodYears * 12;
  
  for (let i = 0; i <= totalMonths; i++) {
    const periodDate = new Date(startDate);
    periodDate.setMonth(periodDate.getMonth() + i);
    periods.push(periodDate);
  }
  
  return periods;
}

/**
 * Generate annual period dates from a start date over a hold period
 * 
 * @param startDate - Start date of investment
 * @param holdPeriodYears - Number of years to hold
 * @returns Array of annual dates starting from startDate
 */
export function generateAnnualPeriods(startDate: Date, holdPeriodYears: number): Date[] {
  const periods: Date[] = [];
  
  for (let i = 0; i <= holdPeriodYears; i++) {
    const periodDate = new Date(startDate);
    periodDate.setFullYear(periodDate.getFullYear() + i);
    periods.push(periodDate);
  }
  
  return periods;
}

/**
 * Roll up monthly cash flows to annual totals
 * 
 * @param monthlyCashFlows - Array of monthly dated cash flows
 * @returns Array of annual cash flows (grouped by year)
 */
export function rollUpToAnnual(monthlyCashFlows: DatedCashFlow[]): DatedCashFlow[] {
  if (monthlyCashFlows.length === 0) return [];
  
  const sorted = [...monthlyCashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const yearMap = new Map<number, { date: Date; amount: number }>();
  
  for (const cf of sorted) {
    const year = cf.date.getFullYear();
    if (!yearMap.has(year)) {
      yearMap.set(year, { date: new Date(cf.date), amount: 0 });
    }
    const entry = yearMap.get(year)!;
    entry.amount += cf.amount;
  }
  
  return Array.from(yearMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Convert period-based cash flows to dated cash flows
 * Maintains backward compatibility with existing period-based calculations
 * 
 * @param cashFlows - Array of cash flow amounts (index = period)
 * @param startDate - Start date for period 0
 * @param granularity - 'monthly' or 'annual'
 * @returns Array of dated cash flows
 */
export function periodsToDatedCashFlows(
  cashFlows: number[],
  startDate: Date,
  granularity: 'monthly' | 'annual' = 'annual'
): DatedCashFlow[] {
  return cashFlows.map((amount, index) => {
    const date = new Date(startDate);
    if (granularity === 'monthly') {
      date.setMonth(date.getMonth() + index);
    } else {
      date.setFullYear(date.getFullYear() + index);
    }
    return { date, amount };
  });
}

/**
 * Calculate payback period with dated cash flows
 * Returns fractional years to payback
 * 
 * @param cashFlows - Array of dated cash flows (first should be negative investment)
 * @returns Years to payback (fractional), or Infinity if never
 */
export function calculatePaybackPeriod(cashFlows: DatedCashFlow[]): number {
  if (cashFlows.length === 0) return Infinity;
  
  const sorted = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const baseDate = sorted[0].date;
  
  let cumulative = 0;
  
  for (let i = 0; i < sorted.length; i++) {
    cumulative += sorted[i].amount;
    
    if (cumulative >= 0 && i > 0) {
      const prevCumulative = cumulative - sorted[i].amount;
      const yearFraction = (sorted[i].date.getTime() - baseDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      const prevYearFraction = (sorted[i - 1].date.getTime() - baseDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      
      const interpFraction = Math.abs(prevCumulative) / (Math.abs(prevCumulative) + cumulative);
      return prevYearFraction + interpFraction * (yearFraction - prevYearFraction);
    }
  }
  
  return Infinity;
}
