/**
 * Canonical Debt Engine — Phase 1 (Single Loan)
 * 
 * All debt math lives here. No local one-off math in pages/components.
 * Monthly schedule as the atomic period for debt service and loan balance.
 */

export interface LoanInput {
  loanAmount: number;
  termMonths: number;
  amortMonths: number;
  interestOnlyMonths: number;
  rateType: 'fixed' | 'floating';
  fixedRate?: number;        // annual rate as decimal (e.g., 0.0675 for 6.75%)
  initialIndexBps?: number;  // basis points
  spreadBps?: number;        // basis points
  indexFloorBps?: number;    // basis points
  capitalizeOriginationFees: boolean;
  originationFeePct?: number; // as decimal (e.g., 0.01 for 1%)
  underwritingFee?: number;
  legalFee?: number;
  appraisalFee?: number;
  otherClosingCosts?: number;
  annualServicingFee?: number;
  exitFeePct?: number;       // as decimal
  prepayType: 'none' | 'stepdown' | 'yield_maint' | 'defeasance';
  stepdownSchedule?: number[]; // annual prepay penalty percentages
}

export interface MonthMeta {
  monthIndex: number;
  year: number;
  month: number;
}

export interface LoanScheduleRow {
  monthIndex: number;
  beginBal: number;
  rateBps: number;
  interest: number;
  principal: number;
  debtService: number;
  endBal: number;
}

export interface LoanFeesAtClose {
  originationFee: number;
  totalClosingFees: number;
  financedFees: number;
  cashFees: number;
}

export interface LoanPayoffAtExit {
  payoffBalance: number;
  exitFees: number;
  prepayPenalty: number;
  totalPayoff: number;
}

function getMonthlyRate(input: LoanInput): number {
  if (input.rateType === 'fixed') {
    return (input.fixedRate || 0) / 12;
  }
  const indexBps = Math.max(input.initialIndexBps || 0, input.indexFloorBps || 0);
  const totalBps = indexBps + (input.spreadBps || 0);
  return (totalBps / 10000) / 12;
}

function getRateBps(input: LoanInput): number {
  if (input.rateType === 'fixed') {
    return Math.round((input.fixedRate || 0) * 10000);
  }
  const indexBps = Math.max(input.initialIndexBps || 0, input.indexFloorBps || 0);
  return indexBps + (input.spreadBps || 0);
}

function computePMT(rate: number, nPeriods: number, presentValue: number): number {
  if (rate === 0) return nPeriods > 0 ? presentValue / nPeriods : 0;
  const factor = Math.pow(1 + rate, nPeriods);
  return (presentValue * rate * factor) / (factor - 1);
}

export function computeLoanFeesAtClose(input: LoanInput): LoanFeesAtClose {
  const originationFee = input.loanAmount * (input.originationFeePct || 0);
  const totalClosingFees =
    originationFee +
    (input.underwritingFee || 0) +
    (input.legalFee || 0) +
    (input.appraisalFee || 0) +
    (input.otherClosingCosts || 0);

  if (input.capitalizeOriginationFees) {
    return {
      originationFee,
      totalClosingFees,
      financedFees: totalClosingFees,
      cashFees: 0,
    };
  }
  return {
    originationFee,
    totalClosingFees,
    financedFees: 0,
    cashFees: totalClosingFees,
  };
}

export function computeLoanSchedule(input: LoanInput): LoanScheduleRow[] {
  const fees = computeLoanFeesAtClose(input);
  let balance = input.loanAmount + fees.financedFees;
  const monthlyRate = getMonthlyRate(input);
  const rateBps = getRateBps(input);
  const schedule: LoanScheduleRow[] = [];

  for (let m = 0; m < input.termMonths; m++) {
    const interest = balance * monthlyRate;

    let principal: number;
    let debtService: number;

    if (m < input.interestOnlyMonths) {
      principal = 0;
      debtService = interest;
    } else {
      const remainingAmortPeriods = input.amortMonths - (m - input.interestOnlyMonths);
      if (remainingAmortPeriods <= 1) {
        principal = balance;
        debtService = interest + principal;
      } else {
        const pmt = computePMT(monthlyRate, remainingAmortPeriods, balance);
        principal = pmt - interest;
        debtService = pmt;
      }
    }

    if (principal > balance) {
      principal = balance;
      debtService = interest + principal;
    }

    const endBal = Math.max(0, balance - principal);

    schedule.push({
      monthIndex: m,
      beginBal: round2(balance),
      rateBps,
      interest: round2(interest),
      principal: round2(principal),
      debtService: round2(debtService),
      endBal: round2(endBal),
    });

    balance = endBal;
  }

  return schedule;
}

export function computeLoanPayoffAtExit(
  input: LoanInput,
  schedule: LoanScheduleRow[],
  exitMonthIndex: number
): LoanPayoffAtExit {
  const lastRow = schedule.find(r => r.monthIndex === exitMonthIndex) ||
                  schedule[schedule.length - 1];
  const payoffBalance = lastRow ? lastRow.endBal : 0;
  const exitFees = payoffBalance * (input.exitFeePct || 0);

  let prepayPenalty = 0;
  if (input.prepayType === 'stepdown' && input.stepdownSchedule) {
    const exitYear = Math.floor(exitMonthIndex / 12);
    const penaltyPct = input.stepdownSchedule[exitYear] ?? 0;
    prepayPenalty = payoffBalance * (penaltyPct / 100);
  }

  return {
    payoffBalance: round2(payoffBalance),
    exitFees: round2(exitFees),
    prepayPenalty: round2(prepayPenalty),
    totalPayoff: round2(payoffBalance + exitFees + prepayPenalty),
  };
}

export function computeAnnualDebtService(schedule: LoanScheduleRow[]): {
  year: number;
  interest: number;
  principal: number;
  totalDebtService: number;
  endingBalance: number;
}[] {
  const yearMap = new Map<number, { interest: number; principal: number; totalDS: number; endBal: number }>();
  
  for (const row of schedule) {
    const year = Math.floor(row.monthIndex / 12);
    if (!yearMap.has(year)) {
      yearMap.set(year, { interest: 0, principal: 0, totalDS: 0, endBal: 0 });
    }
    const y = yearMap.get(year)!;
    y.interest += row.interest;
    y.principal += row.principal;
    y.totalDS += row.debtService;
    y.endBal = row.endBal;
  }
  
  return Array.from(yearMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, data]) => ({
      year,
      interest: round2(data.interest),
      principal: round2(data.principal),
      totalDebtService: round2(data.totalDS),
      endingBalance: round2(data.endBal),
    }));
}

export function computeDSCR(noi: number, annualDebtService: number): number {
  if (annualDebtService <= 0) return 0;
  return round2(noi / annualDebtService);
}

export function computeLTV(loanBalance: number, propertyValue: number): number {
  if (propertyValue <= 0) return 0;
  return round2((loanBalance / propertyValue) * 100);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
