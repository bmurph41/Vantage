/**
 * Vantage Multi-Currency Modeling Engine
 * Deal-level currency, FX rates, LP statements in investor's base currency
 */

import Decimal from 'decimal.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CurrencyRate {
  baseCurrency: string;
  quoteCurrency: string;
  rate: Decimal;
  date: Date;
  source: string;
}

export interface FXGainLoss {
  period: string;
  openingRate: Decimal;
  closingRate: Decimal;
  localAmount: Decimal;
  openingBaseAmount: Decimal;
  closingBaseAmount: Decimal;
  realizedGainLoss: Decimal;
  unrealizedGainLoss: Decimal;
}

export interface MultiCurrencyResult {
  localCurrency: string;
  baseCurrency: string;
  localAmount: Decimal;
  baseAmount: Decimal;
  fxRate: Decimal;
  fxDate: Date;
}

export interface CurrencyExposure {
  currency: string;
  localAmount: Decimal;
  baseAmount: Decimal;
  percentOfTotal: Decimal;
  hedgedPercent: Decimal;
  unhedgedExposure: Decimal;
}

// ─── Exchange Rate Store ─────────────────────────────────────────────────────

// Major FX rates as of a recent snapshot (would be updated from live feed)
const STATIC_FX_RATES: Record<string, Record<string, number>> = {
  USD: { EUR: 0.92, GBP: 0.79, CAD: 1.36, JPY: 149.5, AUD: 1.53, CHF: 0.88, SGD: 1.34, HKD: 7.82, MXN: 17.1, BRL: 4.97 },
  EUR: { USD: 1.087, GBP: 0.858, CAD: 1.478, JPY: 162.5, AUD: 1.663, CHF: 0.957 },
  GBP: { USD: 1.266, EUR: 1.166, CAD: 1.723, JPY: 189.4 },
  CAD: { USD: 0.735, EUR: 0.677, GBP: 0.581 },
};

export function getExchangeRate(from: string, to: string, date?: Date): Decimal {
  if (from === to) return new Decimal(1);

  const fromRates = STATIC_FX_RATES[from];
  if (fromRates && fromRates[to] !== undefined) {
    return new Decimal(fromRates[to]);
  }

  // Try inverse
  const toRates = STATIC_FX_RATES[to];
  if (toRates && toRates[from] !== undefined) {
    return new Decimal(1).dividedBy(new Decimal(toRates[from]));
  }

  // Try through USD
  if (from !== 'USD' && to !== 'USD') {
    const fromToUsd = getExchangeRate(from, 'USD');
    const usdToTo = getExchangeRate('USD', to);
    return fromToUsd.times(usdToTo);
  }

  throw new Error(`No exchange rate available for ${from}/${to}`);
}

// ─── Conversion Functions ────────────────────────────────────────────────────

export function convertAmount(amount: Decimal | number | string, fromCurrency: string, toCurrency: string, date?: Date): MultiCurrencyResult {
  const localAmount = new Decimal(amount.toString());
  const rate = getExchangeRate(fromCurrency, toCurrency, date);
  const baseAmount = localAmount.times(rate);

  return {
    localCurrency: fromCurrency,
    baseCurrency: toCurrency,
    localAmount,
    baseAmount,
    fxRate: rate,
    fxDate: date || new Date(),
  };
}

export function convertCashFlows(
  cashFlows: { date: Date; amount: Decimal | number; currency: string }[],
  targetCurrency: string,
  rateSource?: (from: string, to: string, date: Date) => Decimal
): { date: Date; localAmount: Decimal; convertedAmount: Decimal; rate: Decimal }[] {
  return cashFlows.map(cf => {
    const amount = new Decimal(cf.amount.toString());
    const rate = rateSource
      ? rateSource(cf.currency, targetCurrency, cf.date)
      : getExchangeRate(cf.currency, targetCurrency, cf.date);
    return {
      date: cf.date,
      localAmount: amount,
      convertedAmount: amount.times(rate),
      rate,
    };
  });
}

// ─── FX Gain/Loss Calculations ───────────────────────────────────────────────

export function calculateFXGainLoss(
  periods: {
    label: string;
    openingBalance: Decimal;
    closingBalance: Decimal;
    openingRate: Decimal;
    closingRate: Decimal;
    cashFlowsDuringPeriod?: { amount: Decimal; rate: Decimal }[];
  }[]
): FXGainLoss[] {
  return periods.map(period => {
    const openingBaseAmount = period.openingBalance.times(period.openingRate);
    const closingBaseAmount = period.closingBalance.times(period.closingRate);

    // Realized: FX gain/loss on cash flows settled during the period
    let realizedGainLoss = new Decimal(0);
    if (period.cashFlowsDuringPeriod) {
      for (const cf of period.cashFlowsDuringPeriod) {
        const atHistorical = cf.amount.times(cf.rate);
        const atClosing = cf.amount.times(period.closingRate);
        realizedGainLoss = realizedGainLoss.plus(atClosing.minus(atHistorical));
      }
    }

    // Unrealized: FX gain/loss on outstanding balance
    const balanceChange = closingBaseAmount.minus(openingBaseAmount);
    const unrealizedGainLoss = balanceChange.minus(realizedGainLoss);

    return {
      period: period.label,
      openingRate: period.openingRate,
      closingRate: period.closingRate,
      localAmount: period.closingBalance,
      openingBaseAmount,
      closingBaseAmount,
      realizedGainLoss,
      unrealizedGainLoss,
    };
  });
}

// ─── Portfolio Currency Exposure ─────────────────────────────────────────────

export function calculateCurrencyExposure(
  positions: { currency: string; localAmount: Decimal | number; hedgedPercent?: number }[],
  baseCurrency: string
): CurrencyExposure[] {
  const byCurrency: Map<string, { localTotal: Decimal; baseTotal: Decimal; hedgedPct: Decimal }> = new Map();

  for (const pos of positions) {
    const localAmt = new Decimal(pos.localAmount.toString());
    const rate = getExchangeRate(pos.currency, baseCurrency);
    const baseAmt = localAmt.times(rate);
    const hedgedPct = new Decimal(pos.hedgedPercent || 0);

    const existing = byCurrency.get(pos.currency) || { localTotal: new Decimal(0), baseTotal: new Decimal(0), hedgedPct: new Decimal(0) };
    existing.localTotal = existing.localTotal.plus(localAmt);
    existing.baseTotal = existing.baseTotal.plus(baseAmt);
    // Weighted average hedge percent
    const totalLocal = existing.localTotal;
    existing.hedgedPct = totalLocal.isZero() ? new Decimal(0) :
      existing.hedgedPct.times(existing.localTotal.minus(localAmt)).plus(hedgedPct.times(localAmt)).dividedBy(totalLocal);
    byCurrency.set(pos.currency, existing);
  }

  const grandTotal = Array.from(byCurrency.values()).reduce((s, v) => s.plus(v.baseTotal), new Decimal(0));

  return Array.from(byCurrency.entries()).map(([currency, data]) => ({
    currency,
    localAmount: data.localTotal,
    baseAmount: data.baseTotal,
    percentOfTotal: grandTotal.isZero() ? new Decimal(0) : data.baseTotal.dividedBy(grandTotal).times(100),
    hedgedPercent: data.hedgedPct,
    unhedgedExposure: data.baseTotal.times(new Decimal(100).minus(data.hedgedPct)).dividedBy(100),
  }));
}

// ─── Construction Pro Forma ──────────────────────────────────────────────────

export interface ConstructionDrawSchedule {
  month: number;
  hardCosts: Decimal;
  softCosts: Decimal;
  contingency: Decimal;
  totalDraw: Decimal;
  cumulativeDraw: Decimal;
  percentComplete: Decimal;
  loanDraw: Decimal;
  equityDraw: Decimal;
  interestReserve: Decimal;
}

export interface ConstructionBudget {
  hardCosts: { category: string; amount: Decimal; percentComplete: Decimal }[];
  softCosts: { category: string; amount: Decimal }[];
  contingencyPercent: Decimal;
  totalBudget: Decimal;
  ltc: Decimal;
  equityRequired: Decimal;
  loanAmount: Decimal;
  constructionMonths: number;
  interestRate: Decimal;
}

export function generateConstructionDrawSchedule(budget: ConstructionBudget): ConstructionDrawSchedule[] {
  const schedule: ConstructionDrawSchedule[] = [];
  const totalHard = budget.hardCosts.reduce((s, c) => s.plus(c.amount), new Decimal(0));
  const totalSoft = budget.softCosts.reduce((s, c) => s.plus(c.amount), new Decimal(0));
  const contingency = totalHard.plus(totalSoft).times(budget.contingencyPercent).dividedBy(100);

  let cumulativeDraw = new Decimal(0);
  let cumulativeInterest = new Decimal(0);
  const monthlyRate = budget.interestRate.dividedBy(12).dividedBy(100);

  for (let month = 1; month <= budget.constructionMonths; month++) {
    const progress = new Decimal(month).dividedBy(budget.constructionMonths);
    // S-curve draw pattern: slower start/end, faster middle
    const sCurve = sCurveProgress(progress.toNumber());
    const prevSCurve = month > 1 ? sCurveProgress(new Decimal(month - 1).dividedBy(budget.constructionMonths).toNumber()) : 0;
    const drawPct = new Decimal(sCurve - prevSCurve);

    const hardDraw = totalHard.times(drawPct);
    const softDraw = totalSoft.times(drawPct);
    const contingencyDraw = contingency.times(drawPct);
    const totalDraw = hardDraw.plus(softDraw).plus(contingencyDraw);

    cumulativeDraw = cumulativeDraw.plus(totalDraw);

    // Interest on outstanding loan balance
    const loanBalance = Decimal.min(cumulativeDraw.times(budget.ltc).dividedBy(100), budget.loanAmount);
    const monthlyInterest = loanBalance.times(monthlyRate);
    cumulativeInterest = cumulativeInterest.plus(monthlyInterest);

    const loanDraw = totalDraw.times(budget.ltc).dividedBy(100);
    const equityDraw = totalDraw.minus(loanDraw);

    schedule.push({
      month,
      hardCosts: hardDraw,
      softCosts: softDraw,
      contingency: contingencyDraw,
      totalDraw,
      cumulativeDraw,
      percentComplete: new Decimal(sCurve * 100),
      loanDraw,
      equityDraw,
      interestReserve: monthlyInterest,
    });
  }

  return schedule;
}

function sCurveProgress(t: number): number {
  // Sigmoid S-curve for construction draw pattern
  return 1 / (1 + Math.exp(-10 * (t - 0.5)));
}

// ─── Expense Escalation Matrix ───────────────────────────────────────────────

export interface EscalationSchedule {
  year: number;
  lineItems: {
    name: string;
    baseAmount: Decimal;
    escalationRate: Decimal;
    escalatedAmount: Decimal;
    cumulativeGrowth: Decimal;
  }[];
  totalEscalatedExpenses: Decimal;
}

export function generateExpenseEscalationMatrix(
  baseExpenses: { name: string; amount: Decimal | number; annualEscalation: number; escalationType: 'flat' | 'compound' | 'cpi_plus' | 'step' }[],
  holdPeriodYears: number,
  cpiRate: number = 2.5
): EscalationSchedule[] {
  const schedules: EscalationSchedule[] = [];

  for (let year = 0; year < holdPeriodYears; year++) {
    const items = baseExpenses.map(exp => {
      const base = new Decimal(exp.amount.toString());
      let rate: Decimal;
      let escalated: Decimal;

      switch (exp.escalationType) {
        case 'compound':
          rate = new Decimal(exp.annualEscalation);
          escalated = base.times(new Decimal(1).plus(rate.dividedBy(100)).pow(year));
          break;
        case 'cpi_plus':
          rate = new Decimal(cpiRate + exp.annualEscalation);
          escalated = base.times(new Decimal(1).plus(rate.dividedBy(100)).pow(year));
          break;
        case 'step':
          // Step increase every 3 years
          const steps = Math.floor(year / 3);
          rate = new Decimal(exp.annualEscalation);
          escalated = base.times(new Decimal(1).plus(rate.dividedBy(100).times(steps)));
          break;
        case 'flat':
        default:
          rate = new Decimal(exp.annualEscalation);
          escalated = base.plus(base.times(rate).dividedBy(100).times(year));
          break;
      }

      const cumulativeGrowth = base.isZero() ? new Decimal(0) : escalated.minus(base).dividedBy(base).times(100);

      return {
        name: exp.name,
        baseAmount: base,
        escalationRate: rate,
        escalatedAmount: escalated,
        cumulativeGrowth,
      };
    });

    const totalEscalated = items.reduce((s, i) => s.plus(i.escalatedAmount), new Decimal(0));

    schedules.push({
      year: year + 1,
      lineItems: items,
      totalEscalatedExpenses: totalEscalated,
    });
  }

  return schedules;
}

// ─── DLOM/DLOC Application ───────────────────────────────────────────────────

export interface DiscountResult {
  grossValue: Decimal;
  dlomPercent: Decimal;
  dlomAmount: Decimal;
  dlocPercent: Decimal;
  dlocAmount: Decimal;
  combinedDiscount: Decimal;
  netValue: Decimal;
}

export function applyValuationDiscounts(
  grossValue: Decimal | number,
  options: {
    dlomPercent?: number;  // Discount for Lack of Marketability (typically 15-35%)
    dlocPercent?: number;  // Discount for Lack of Control (typically 10-40%)
    restrictedStockMethod?: boolean; // Use restricted stock study benchmarks
    ownershipPercent?: number; // For DLOC calibration
  }
): DiscountResult {
  const gross = new Decimal(grossValue.toString());

  let dlom = new Decimal(options.dlomPercent || 0);
  let dloc = new Decimal(options.dlocPercent || 0);

  // Auto-calibrate DLOM if using restricted stock method
  if (options.restrictedStockMethod) {
    // Based on Silber (1991) restricted stock studies: median 33.75%
    // Adjusted for holding period and revenue size
    dlom = new Decimal(25); // Conservative median
  }

  // Auto-calibrate DLOC based on ownership percentage
  if (options.ownershipPercent !== undefined && options.dlocPercent === undefined) {
    const ownership = options.ownershipPercent;
    if (ownership >= 51) dloc = new Decimal(0); // Controlling interest
    else if (ownership >= 30) dloc = new Decimal(10); // Significant minority
    else if (ownership >= 10) dloc = new Decimal(25); // Minority
    else dloc = new Decimal(35); // Small minority
  }

  const dlomAmount = gross.times(dlom).dividedBy(100);
  const afterDlom = gross.minus(dlomAmount);
  const dlocAmount = afterDlom.times(dloc).dividedBy(100);
  const netValue = afterDlom.minus(dlocAmount);
  const combinedDiscount = gross.isZero() ? new Decimal(0) : gross.minus(netValue).dividedBy(gross).times(100);

  return {
    grossValue: gross,
    dlomPercent: dlom,
    dlomAmount,
    dlocPercent: dloc,
    dlocAmount,
    combinedDiscount,
    netValue,
  };
}
