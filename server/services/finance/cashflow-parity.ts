/**
 * server/services/finance/cashflow-parity.ts
 * 
 * Produces canonical dated cash flow arrays from any of the three pipelines:
 *   - Multi-Year Projection Engine (canonical source)
 *   - DCF Full Analysis
 *   - Quick IRR
 * 
 * Used by:
 *   - IRR parity tests (Layer 2)
 *   - Monte Carlo simulation (Layer 3)
 *   - Decision support analytics (Layer 4)
 */

import { DatedCashFlow } from '../../shared/finance/xirr';

// ─── Types ───────────────────────────────────────────────────────────────────

export type CashFlowSource = 'projection' | 'dcfFull' | 'dcfQuick';

export interface CanonicalCashFlowSet {
  flows: DatedCashFlow[];
  debug: {
    equityAtClose: number;
    debtPayoffAtExit: number;
    salePriceGross: number;
    saleCosts: number;
    netSaleProceeds: number;
    interimNetCF: number;       // sum of all interim (non-exit) cash flows
    holdPeriodMonths: number;
    source: CashFlowSource;
  };
}

// ─── Projection Engine → Canonical ──────────────────────────────────────────

export interface ProjectionInput {
  acquisitionDate: string;      // ISO date
  equityInvested: number;       // positive number (will be negated in flows)
  years: Array<{
    year: number;
    ncf: number;                // unlevered net cash flow
  }>;
  annualDebtService: number[];  // per year, parallel to years array
  exit: {
    exitNOI: number;
    exitValue: number;
    sellingCosts: number;
    netSaleProceeds: number;
  };
  debtBalanceAtExit: number;    // remaining loan balance to pay off at sale
}

export function fromProjection(input: ProjectionInput): CanonicalCashFlowSet {
  const { acquisitionDate, equityInvested, years, annualDebtService, exit, debtBalanceAtExit } = input;
  const acqDate = new Date(acquisitionDate);

  const flows: DatedCashFlow[] = [];

  // T0: equity outflow (negative)
  flows.push({
    date: acqDate.toISOString().split('T')[0],
    amount: -Math.abs(equityInvested),
  });

  let interimNetCF = 0;

  for (let i = 0; i < years.length; i++) {
    const yearNum = years[i].year;
    const flowDate = addYears(acqDate, yearNum);
    const ds = annualDebtService[i] ?? 0;
    const leveredCF = years[i].ncf - ds;

    // Final year: add exit proceeds net of debt payoff
    const isLastYear = i === years.length - 1;
    const exitAmount = isLastYear
      ? (exit.netSaleProceeds - debtBalanceAtExit)
      : 0;

    const totalCF = leveredCF + exitAmount;
    interimNetCF += isLastYear ? leveredCF : totalCF;

    flows.push({
      date: flowDate.toISOString().split('T')[0],
      amount: totalCF,
    });
  }

  return {
    flows,
    debug: {
      equityAtClose: equityInvested,
      debtPayoffAtExit: debtBalanceAtExit,
      salePriceGross: exit.exitValue,
      saleCosts: exit.sellingCosts,
      netSaleProceeds: exit.netSaleProceeds,
      interimNetCF,
      holdPeriodMonths: years.length * 12,
      source: 'projection',
    },
  };
}

// ─── DCF Full Result → Canonical ─────────────────────────────────────────────

export interface DCFFullInput {
  cashFlows: DatedCashFlow[];   // already dated from the refactored DCF service
  equityInvested: number;
  exitValue: number;
  sellingCosts: number;
  netSaleProceeds: number;
  debtPayoffAtExit: number;
  holdPeriodYears: number;
}

export function fromDCFFull(input: DCFFullInput): CanonicalCashFlowSet {
  const interimFlows = input.cashFlows.filter(f => f.amount > 0 || f === input.cashFlows[0]);
  const interimNetCF = interimFlows
    .slice(1, -1) // exclude t0 and final
    .reduce((s, f) => s + f.amount, 0);

  return {
    flows: input.cashFlows,
    debug: {
      equityAtClose: input.equityInvested,
      debtPayoffAtExit: input.debtPayoffAtExit,
      salePriceGross: input.exitValue,
      saleCosts: input.sellingCosts,
      netSaleProceeds: input.netSaleProceeds,
      interimNetCF,
      holdPeriodMonths: input.holdPeriodYears * 12,
      source: 'dcfFull',
    },
  };
}

// ─── Quick IRR Input → Canonical ─────────────────────────────────────────────

export interface QuickIRRInput {
  acquisitionDate: string;
  equityInvested: number;
  year1NCF: number;
  growthRate: number;           // decimal (e.g. 0.03)
  holdPeriodYears: number;
  exitCapRate: number;          // decimal (e.g. 0.065)
  sellingCostPct: number;       // decimal (e.g. 0.03)
  annualDebtService: number | number[];  // flat or per-year array
  debtBalanceAtExit: number;
  finalYearNOI: number;
}

export function fromQuickIRR(input: QuickIRRInput): CanonicalCashFlowSet {
  const acqDate = new Date(input.acquisitionDate);
  const flows: DatedCashFlow[] = [];

  flows.push({
    date: acqDate.toISOString().split('T')[0],
    amount: -Math.abs(input.equityInvested),
  });

  let interimNetCF = 0;
  const exitValue = input.finalYearNOI / input.exitCapRate;
  const sellingCosts = exitValue * input.sellingCostPct;
  const netSaleProceeds = exitValue - sellingCosts;

  for (let yr = 1; yr <= input.holdPeriodYears; yr++) {
    const ncf = input.year1NCF * Math.pow(1 + input.growthRate, yr - 1);
    const ds = Array.isArray(input.annualDebtService)
      ? (input.annualDebtService[yr - 1] ?? 0)
      : input.annualDebtService;
    const leveredCF = ncf - ds;
    const flowDate = addYears(acqDate, yr);
    const isLast = yr === input.holdPeriodYears;
    const exitAmount = isLast ? (netSaleProceeds - input.debtBalanceAtExit) : 0;

    interimNetCF += leveredCF;
    flows.push({
      date: flowDate.toISOString().split('T')[0],
      amount: leveredCF + exitAmount,
    });
  }

  return {
    flows,
    debug: {
      equityAtClose: input.equityInvested,
      debtPayoffAtExit: input.debtBalanceAtExit,
      salePriceGross: exitValue,
      saleCosts: sellingCosts,
      netSaleProceeds,
      interimNetCF,
      holdPeriodMonths: input.holdPeriodYears * 12,
      source: 'dcfQuick',
    },
  };
}

// ─── Parity Comparison ──────────────────────────────────────────────────────

export interface ParityResult {
  match: boolean;
  flowCountMatch: boolean;
  dateMatch: boolean;
  amountMatch: boolean;
  terminalMatch: boolean;
  details: string[];
}

export function compareCashFlows(
  a: CanonicalCashFlowSet,
  b: CanonicalCashFlowSet,
  amountTolerance: number = 1.0  // $1 default
): ParityResult {
  const details: string[] = [];
  let match = true;

  // Flow count
  const flowCountMatch = a.flows.length === b.flows.length;
  if (!flowCountMatch) {
    match = false;
    details.push(`Flow count: ${a.debug.source}=${a.flows.length} vs ${b.debug.source}=${b.flows.length}`);
  }

  // Date alignment
  const minLen = Math.min(a.flows.length, b.flows.length);
  let dateMatch = true;
  let amountMatch = true;

  for (let i = 0; i < minLen; i++) {
    if (a.flows[i].date !== b.flows[i].date) {
      dateMatch = false;
      match = false;
      details.push(`Date mismatch at index ${i}: ${a.flows[i].date} vs ${b.flows[i].date}`);
      break; // first mismatch is enough
    }
    const diff = Math.abs(a.flows[i].amount - b.flows[i].amount);
    if (diff > amountTolerance) {
      amountMatch = false;
      match = false;
      details.push(
        `Amount mismatch at index ${i} (${a.flows[i].date}): ` +
        `${a.debug.source}=${a.flows[i].amount.toFixed(2)} vs ` +
        `${b.debug.source}=${b.flows[i].amount.toFixed(2)} (diff=${diff.toFixed(2)})`
      );
    }
  }

  // Terminal component parity
  const terminalFields: Array<keyof CanonicalCashFlowSet['debug']> = [
    'salePriceGross', 'saleCosts', 'netSaleProceeds', 'debtPayoffAtExit',
  ];
  let terminalMatch = true;
  for (const field of terminalFields) {
    const va = a.debug[field] as number;
    const vb = b.debug[field] as number;
    if (Math.abs(va - vb) > amountTolerance) {
      terminalMatch = false;
      match = false;
      details.push(`Terminal ${field}: ${a.debug.source}=${va.toFixed(2)} vs ${b.debug.source}=${vb.toFixed(2)}`);
    }
  }

  return { match, flowCountMatch, dateMatch, amountMatch, terminalMatch, details };
}

// ─── Diagnostic Explainer ────────────────────────────────────────────────────

export function explainMismatch(
  a: CanonicalCashFlowSet,
  b: CanonicalCashFlowSet
): string {
  const result = compareCashFlows(a, b);
  if (result.match) return `PARITY OK between ${a.debug.source} and ${b.debug.source}`;

  const lines = [
    `PARITY FAILURE: ${a.debug.source} vs ${b.debug.source}`,
    `  Flow count match: ${result.flowCountMatch}`,
    `  Date match: ${result.dateMatch}`,
    `  Amount match: ${result.amountMatch}`,
    `  Terminal match: ${result.terminalMatch}`,
    '',
    'Details:',
    ...result.details.map(d => `  - ${d}`),
    '',
    'Likely causes:',
  ];

  if (!result.dateMatch) {
    lines.push('  → Date misalignment: check annual vs monthly periodicity, or acquisition date offset');
  }
  if (!result.terminalMatch) {
    const saleDiff = Math.abs(
      (a.debug.netSaleProceeds - a.debug.debtPayoffAtExit) -
      (b.debug.netSaleProceeds - b.debug.debtPayoffAtExit)
    );
    if (saleDiff > 1) {
      lines.push(`  → Net exit proceeds differ by $${saleDiff.toFixed(2)} — check exit cap rate or sale cost pct`);
    }
  }
  if (!result.amountMatch && result.dateMatch) {
    lines.push('  → Amounts diverge at same dates: likely percent/decimal confusion or debt service mismatch');
  }

  return lines.join('\n');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}
