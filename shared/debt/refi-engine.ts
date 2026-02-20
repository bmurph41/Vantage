/**
 * Refinance Engine — shared/debt/refi-engine.ts
 */
import type { DebtEngineInput, MonthlyScheduleRow, AnnualDebtSummary } from './debt-engine';
import { computeLoanSchedule, computeLoanPayoffAtExit, computeAnnualDebtService, computeLoanFeesAtClose } from './debt-engine';

export interface RefiConfig {
  triggerMonthIndex: number;
  newLoanTerms: {
    loanAmount?: number;
    rateType: 'fixed' | 'floating';
    fixedRate?: number;
    initialIndexBps?: number;
    spreadBps?: number;
    indexFloorBps?: number;
    termMonths: number;
    amortMonths: number;
    interestOnlyMonths: number;
    originationFeePct?: number;
    capitalizeOriginationFees?: boolean;
    prepayType?: 'none' | 'stepdown' | 'yield_maint' | 'defeasance';
    stepdownSchedule?: number[];
  };
  maxLtvPct?: number;
  propertyValueAtRefi?: number;
  refiFees?: number;
  cashOutAllowed: boolean;
  maxCashOut?: number;
}

export interface RefiResult {
  existingLoanPayoff: { payoffBalance: number; prepayPenalty: number; exitFees: number; totalPayoff: number };
  newLoan: { loanAmount: number; effectiveRate: number; termMonths: number; feesAtClose: number };
  refiCashflow: {
    newLoanProceeds: number; lessTotalPayoff: number; lessRefiFees: number;
    lessNewLoanFees: number; netCashOut: number; isTaxFree: boolean;
  };
  mergedSchedule: MonthlyScheduleRow[];
  annualSummary: AnnualDebtSummary[];
  warnings: string[];
}

export function computeRefiPlan(existingLoan: DebtEngineInput, refi: RefiConfig): RefiResult {
  const warnings: string[] = [];
  const existingSchedule = computeLoanSchedule(existingLoan);

  if (refi.triggerMonthIndex >= existingSchedule.length) {
    warnings.push('Refi trigger month beyond loan term. Using last month.');
  }

  const payoff = computeLoanPayoffAtExit(existingLoan, existingSchedule, refi.triggerMonthIndex);

  let newLoanAmount = refi.newLoanTerms.loanAmount ?? payoff.payoffBalance;

  if (refi.maxLtvPct && refi.propertyValueAtRefi) {
    const maxLoan = refi.propertyValueAtRefi * refi.maxLtvPct;
    if (newLoanAmount > maxLoan) {
      warnings.push(`Loan capped at ${(refi.maxLtvPct * 100).toFixed(0)}% LTV: $${maxLoan.toLocaleString()}`);
      newLoanAmount = maxLoan;
    }
  }

  const newLoanInput: DebtEngineInput = {
    loanAmount: newLoanAmount,
    termMonths: refi.newLoanTerms.termMonths,
    amortMonths: refi.newLoanTerms.amortMonths,
    interestOnlyMonths: refi.newLoanTerms.interestOnlyMonths,
    rateType: refi.newLoanTerms.rateType,
    fixedRate: refi.newLoanTerms.fixedRate,
    initialIndexBps: refi.newLoanTerms.initialIndexBps,
    spreadBps: refi.newLoanTerms.spreadBps,
    indexFloorBps: refi.newLoanTerms.indexFloorBps,
    capitalizeOriginationFees: refi.newLoanTerms.capitalizeOriginationFees ?? false,
    originationFeePct: refi.newLoanTerms.originationFeePct,
    prepayType: refi.newLoanTerms.prepayType ?? 'none',
    stepdownSchedule: refi.newLoanTerms.stepdownSchedule,
  };

  const newLoanFees = computeLoanFeesAtClose(newLoanInput);
  const newSchedule = computeLoanSchedule(newLoanInput);
  const refiFees = refi.refiFees ?? 0;

  let netCashOut = newLoanAmount - payoff.totalPayoff - refiFees - newLoanFees.cashFees;
  if (refi.maxCashOut != null && netCashOut > refi.maxCashOut) netCashOut = refi.maxCashOut;
  if (!refi.cashOutAllowed && netCashOut > 0) netCashOut = 0;

  const preRefiMonths = existingSchedule.slice(0, refi.triggerMonthIndex);
  const mergedSchedule: MonthlyScheduleRow[] = [
    ...preRefiMonths,
    ...newSchedule.map(row => ({ ...row, monthIndex: row.monthIndex + refi.triggerMonthIndex })),
  ];

  const effectiveRate = newLoanInput.rateType === 'fixed'
    ? (newLoanInput.fixedRate ?? 0)
    : ((newLoanInput.initialIndexBps ?? 0) + (newLoanInput.spreadBps ?? 0)) / 10000;

  return {
    existingLoanPayoff: { payoffBalance: payoff.payoffBalance, prepayPenalty: payoff.prepayPenalty, exitFees: payoff.exitFees, totalPayoff: payoff.totalPayoff },
    newLoan: { loanAmount: newLoanAmount, effectiveRate, termMonths: refi.newLoanTerms.termMonths, feesAtClose: newLoanFees.totalClosingFees },
    refiCashflow: { newLoanProceeds: newLoanAmount, lessTotalPayoff: payoff.totalPayoff, lessRefiFees: refiFees, lessNewLoanFees: newLoanFees.cashFees, netCashOut, isTaxFree: true },
    mergedSchedule,
    annualSummary: computeAnnualDebtService(mergedSchedule),
    warnings,
  };
}

export interface RefiComparison {
  holdToMaturity: { totalInterest: number; totalDebtService: number; exitBalance: number };
  withRefi: { totalInterest: number; totalDebtService: number; exitBalance: number; netCashOut: number };
  savings: { interestSaved: number; debtServiceSaved: number; breakEvenMonths: number | null };
}

export function compareRefiVsHold(existingLoan: DebtEngineInput, refi: RefiConfig, exitMonthIndex: number): RefiComparison {
  const holdSchedule = computeLoanSchedule(existingLoan);
  const holdInt = holdSchedule.filter(r => r.monthIndex < exitMonthIndex).reduce((s, r) => s + r.interest, 0);
  const holdDS = holdSchedule.filter(r => r.monthIndex < exitMonthIndex).reduce((s, r) => s + r.debtService, 0);
  const holdBal = exitMonthIndex <= holdSchedule.length ? (holdSchedule[exitMonthIndex - 1]?.endBal ?? 0) : 0;

  const refiResult = computeRefiPlan(existingLoan, refi);
  const refiInt = refiResult.mergedSchedule.filter(r => r.monthIndex < exitMonthIndex).reduce((s, r) => s + r.interest, 0);
  const refiDS = refiResult.mergedSchedule.filter(r => r.monthIndex < exitMonthIndex).reduce((s, r) => s + r.debtService, 0);
  const refiBal = refiResult.mergedSchedule.find(r => r.monthIndex === exitMonthIndex - 1)?.endBal ?? 0;

  const refiCosts = refiResult.refiCashflow.lessRefiFees + refiResult.refiCashflow.lessNewLoanFees + refiResult.existingLoanPayoff.prepayPenalty;
  let breakEvenMonths: number | null = null;
  const preDS = holdSchedule[refi.triggerMonthIndex]?.debtService ?? 0;
  const postDS = refiResult.mergedSchedule[refi.triggerMonthIndex]?.debtService ?? 0;
  const saving = preDS - postDS;
  if (saving > 0 && refiCosts > 0) breakEvenMonths = Math.ceil(refiCosts / saving);

  const r2 = (v: number) => Math.round(v * 100) / 100;
  return {
    holdToMaturity: { totalInterest: r2(holdInt), totalDebtService: r2(holdDS), exitBalance: r2(holdBal) },
    withRefi: { totalInterest: r2(refiInt), totalDebtService: r2(refiDS), exitBalance: r2(refiBal), netCashOut: refiResult.refiCashflow.netCashOut },
    savings: { interestSaved: r2(holdInt - refiInt), debtServiceSaved: r2(holdDS - refiDS), breakEvenMonths },
  };
}
