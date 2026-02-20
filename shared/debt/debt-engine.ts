/**
 * Canonical Debt Engine — shared/debt/debt-engine.ts
 */

export interface DebtEngineInput {
  loanAmount: number;
  termMonths: number;
  amortMonths: number;
  interestOnlyMonths: number;
  rateType: 'fixed' | 'floating';
  fixedRate?: number;
  initialIndexBps?: number;
  spreadBps?: number;
  indexFloorBps?: number;
  capitalizeOriginationFees: boolean;
  originationFeePct?: number;
  underwritingFee?: number;
  legalFee?: number;
  appraisalFee?: number;
  otherClosingCosts?: number;
  annualServicingFee?: number;
  exitFeePct?: number;
  prepayType: 'none' | 'stepdown' | 'yield_maint' | 'defeasance';
  stepdownSchedule?: number[];
}

export interface MonthlyScheduleRow {
  monthIndex: number;
  beginBal: number;
  rateBps: number;
  interest: number;
  principal: number;
  debtService: number;
  endBal: number;
  isIO: boolean;
}

export interface LoanFeesResult {
  originationFee: number;
  underwritingFee: number;
  legalFee: number;
  appraisalFee: number;
  otherClosingCosts: number;
  totalClosingFees: number;
  financedFees: number;
  cashFees: number;
}

export interface LoanPayoffResult {
  payoffBalance: number;
  exitFees: number;
  prepayPenalty: number;
  totalPayoff: number;
}

export interface AnnualDebtSummary {
  year: number;
  interest: number;
  principal: number;
  totalDebtService: number;
  endingBalance: number;
  averageBalance: number;
}

export interface CapitalStackSummary {
  totalUses: number;
  totalDebt: number;
  totalEquity: number;
  debtPct: number;
  equityPct: number;
  ltv: number;
  dscr: number | null;
  debtYield: number | null;
  monthlyDebtService: number;
  annualDebtService: number;
  year1EndingBalance: number;
  blendedRate: number;
  feesAtClose: LoanFeesResult;
}

function pmt(principal: number, monthlyRate: number, numPayments: number): number {
  if (numPayments <= 0 || principal <= 0) return 0;
  if (monthlyRate <= 0) return principal / numPayments;
  return principal *
    (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);
}

function r2(val: number): number {
  return Math.round(val * 100) / 100;
}

function getEffectiveAnnualRate(input: DebtEngineInput): number {
  if (input.rateType === 'fixed') {
    return input.fixedRate ?? 0;
  }
  const indexRate = (input.initialIndexBps ?? 0) / 10000;
  const spread = (input.spreadBps ?? 0) / 10000;
  const floor = (input.indexFloorBps ?? 0) / 10000;
  const allIn = indexRate + spread;
  return Math.max(allIn, floor);
}

export function computeLoanSchedule(input: DebtEngineInput): MonthlyScheduleRow[] {
  const fees = computeLoanFeesAtClose(input);
  const startingBalance = input.capitalizeOriginationFees
    ? input.loanAmount + fees.financedFees
    : input.loanAmount;

  if (startingBalance <= 0 || input.termMonths <= 0) return [];

  const annualRate = getEffectiveAnnualRate(input);
  const monthlyRate = annualRate / 12;
  const rateBps = Math.round(annualRate * 10000);
  const ioMonths = Math.min(input.interestOnlyMonths, input.termMonths);
  const amortPayments = Math.max(input.amortMonths - ioMonths, 1);

  const schedule: MonthlyScheduleRow[] = [];
  let balance = startingBalance;
  let amortPmt = 0;

  for (let i = 0; i < input.termMonths; i++) {
    const beginBal = balance;
    const interest = r2(balance * monthlyRate);
    let principal: number;
    let payment: number;
    const isIO = i < ioMonths;

    if (isIO) {
      principal = 0;
      payment = interest;
    } else {
      if (i === ioMonths) {
        amortPmt = pmt(balance, monthlyRate, amortPayments);
      }
      if (amortPmt <= 0) {
        const remaining = input.termMonths - i;
        amortPmt = balance / Math.max(remaining, 1);
      }
      payment = r2(amortPmt);
      principal = r2(payment - interest);
      principal = Math.min(principal, balance);
      payment = principal + interest;
    }

    balance = r2(Math.max(0, beginBal - principal));

    schedule.push({
      monthIndex: i,
      beginBal: r2(beginBal),
      rateBps,
      interest,
      principal,
      debtService: r2(interest + principal),
      endBal: balance,
      isIO,
    });
  }

  return schedule;
}

export function computeLoanFeesAtClose(input: DebtEngineInput): LoanFeesResult {
  const originationFee = r2(input.loanAmount * (input.originationFeePct ?? 0));
  const underwritingFee = r2(input.underwritingFee ?? 0);
  const legalFee = r2(input.legalFee ?? 0);
  const appraisalFee = r2(input.appraisalFee ?? 0);
  const otherClosingCosts = r2(input.otherClosingCosts ?? 0);
  const totalClosingFees = r2(originationFee + underwritingFee + legalFee + appraisalFee + otherClosingCosts);
  const financedFees = input.capitalizeOriginationFees ? originationFee : 0;
  const cashFees = totalClosingFees - financedFees;

  return {
    originationFee, underwritingFee, legalFee, appraisalFee,
    otherClosingCosts, totalClosingFees, financedFees, cashFees,
  };
}

export function computeLoanPayoffAtExit(
  input: DebtEngineInput,
  schedule: MonthlyScheduleRow[],
  exitMonthIndex: number
): LoanPayoffResult {
  const clampedIndex = Math.min(exitMonthIndex, schedule.length - 1);
  const payoffBalance = clampedIndex >= 0 && schedule[clampedIndex]
    ? schedule[clampedIndex].endBal
    : input.loanAmount;
  const exitFees = r2(payoffBalance * (input.exitFeePct ?? 0));
  const exitYear = Math.ceil((exitMonthIndex + 1) / 12);
  const prepayPenalty = computePrepayPenalty(input, payoffBalance, exitYear);

  return {
    payoffBalance: r2(payoffBalance),
    exitFees,
    prepayPenalty,
    totalPayoff: r2(payoffBalance + exitFees + prepayPenalty),
  };
}

function computePrepayPenalty(
  input: DebtEngineInput, payoffBalance: number, exitYear: number
): number {
  if (input.prepayType === 'none' || payoffBalance <= 0) return 0;

  if (input.prepayType === 'stepdown' && input.stepdownSchedule) {
    const yearIdx = exitYear - 1;
    const penaltyPct = yearIdx < input.stepdownSchedule.length
      ? input.stepdownSchedule[yearIdx] : 0;
    return r2(payoffBalance * penaltyPct);
  }

  if (input.prepayType === 'yield_maint') {
    const rate = getEffectiveAnnualRate(input);
    const treasuryRate = 0.04;
    const rateDiff = Math.max(0, rate - treasuryRate);
    if (rateDiff <= 0) return 0;
    const remainingMonths = input.termMonths - (exitYear * 12);
    if (remainingMonths <= 0) return 0;
    const monthlyRate = rate / 12;
    const amortRemaining = Math.max(input.amortMonths - (exitYear * 12), remainingMonths);
    const monthlyPmt = pmt(payoffBalance, monthlyRate, amortRemaining);
    let pvLostInterest = 0;
    for (let m = 1; m <= remainingMonths; m++) {
      pvLostInterest += (monthlyPmt * rateDiff / rate) / Math.pow(1 + monthlyRate, m);
    }
    return r2(pvLostInterest);
  }

  if (input.prepayType === 'defeasance') {
    return r2(payoffBalance * 0.02);
  }
  return 0;
}

export function computeAnnualDebtService(schedule: MonthlyScheduleRow[]): AnnualDebtSummary[] {
  if (schedule.length === 0) return [];
  const totalYears = Math.ceil(schedule.length / 12);
  const result: AnnualDebtSummary[] = [];

  for (let y = 0; y < totalYears; y++) {
    const startIdx = y * 12;
    const endIdx = Math.min(startIdx + 12, schedule.length);
    const yearRows = schedule.slice(startIdx, endIdx);
    if (yearRows.length === 0) continue;

    const interest = r2(yearRows.reduce((s, r) => s + r.interest, 0));
    const principal = r2(yearRows.reduce((s, r) => s + r.principal, 0));
    const totalDebtService = r2(interest + principal);
    const endingBalance = yearRows[yearRows.length - 1].endBal;
    const averageBalance = r2(yearRows.reduce((s, r) => s + r.beginBal, 0) / yearRows.length);

    result.push({ year: y + 1, interest, principal, totalDebtService, endingBalance, averageBalance });
  }
  return result;
}

export function computeDSCR(noi: number, annualDebtService: number): number {
  if (annualDebtService <= 0) return noi > 0 ? Infinity : 0;
  return r2((noi / annualDebtService) * 100) / 100;
}

export function computeLTV(loanBalance: number, propertyValue: number): number {
  if (propertyValue <= 0) return 0;
  return r2((loanBalance / propertyValue) * 10000) / 10000;
}

export function computeDebtYield(noi: number, loanBalance: number): number {
  if (loanBalance <= 0) return 0;
  return r2((noi / loanBalance) * 10000) / 10000;
}

export function computeCapitalStackSummary(
  loans: DebtEngineInput[],
  purchasePrice: number,
  closingCosts: number = 0,
  capexReserves: number = 0,
  workingCapital: number = 0,
  annualNoi?: number,
): CapitalStackSummary {
  const totalUses = purchasePrice + closingCosts + capexReserves + workingCapital;

  let totalDebt = 0;
  let totalMonthlyDS = 0;
  let totalAnnualDS = 0;
  let weightedRate = 0;
  let year1EndBal = 0;
  let aggregateFees: LoanFeesResult = {
    originationFee: 0, underwritingFee: 0, legalFee: 0,
    appraisalFee: 0, otherClosingCosts: 0, totalClosingFees: 0,
    financedFees: 0, cashFees: 0,
  };

  for (const loan of loans) {
    const fees = computeLoanFeesAtClose(loan);
    totalDebt += loan.loanAmount;
    const rate = getEffectiveAnnualRate(loan);
    weightedRate += loan.loanAmount * rate;

    const schedule = computeLoanSchedule(loan);
    if (schedule.length > 0) {
      const yr1 = schedule.slice(0, Math.min(12, schedule.length));
      const yr1DS = yr1.reduce((s, r) => s + r.debtService, 0);
      totalAnnualDS += yr1DS;
      totalMonthlyDS += yr1DS / yr1.length;
      year1EndBal += yr1[yr1.length - 1].endBal;
    }

    aggregateFees.originationFee += fees.originationFee;
    aggregateFees.underwritingFee += fees.underwritingFee;
    aggregateFees.legalFee += fees.legalFee;
    aggregateFees.appraisalFee += fees.appraisalFee;
    aggregateFees.otherClosingCosts += fees.otherClosingCosts;
    aggregateFees.totalClosingFees += fees.totalClosingFees;
    aggregateFees.financedFees += fees.financedFees;
    aggregateFees.cashFees += fees.cashFees;
  }

  const totalEquity = Math.max(0, totalUses - totalDebt);
  const blendedRate = totalDebt > 0 ? weightedRate / totalDebt : 0;

  return {
    totalUses: r2(totalUses),
    totalDebt: r2(totalDebt),
    totalEquity: r2(totalEquity),
    debtPct: totalUses > 0 ? r2(totalDebt / totalUses) : 0,
    equityPct: totalUses > 0 ? r2(totalEquity / totalUses) : 0,
    ltv: purchasePrice > 0 ? r2(totalDebt / purchasePrice) : 0,
    dscr: annualNoi != null && totalAnnualDS > 0
      ? computeDSCR(annualNoi, totalAnnualDS) : null,
    debtYield: annualNoi != null && totalDebt > 0
      ? computeDebtYield(annualNoi, totalDebt) : null,
    monthlyDebtService: r2(totalMonthlyDS),
    annualDebtService: r2(totalAnnualDS),
    year1EndingBalance: r2(year1EndBal),
    blendedRate: r2(blendedRate * 10000) / 10000,
    feesAtClose: aggregateFees,
  };
}
