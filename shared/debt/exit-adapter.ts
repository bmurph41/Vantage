/**
 * Debt-to-Exit Adapter — shared/debt/exit-adapter.ts
 * Bridges canonical debt engine output into exit engine formats.
 */

import type { AmortizationPayment, LoanScheduleResult } from '../exit/mortgage-amortization';
import type { DebtEngineInput, MonthlyScheduleRow } from './debt-engine';
import {
  computeLoanSchedule,
  computeLoanPayoffAtExit,
  computeAnnualDebtService,
} from './debt-engine';

export function canonicalToLoanScheduleResult(
  input: DebtEngineInput,
  schedule?: MonthlyScheduleRow[],
): LoanScheduleResult {
  const sched = schedule ?? computeLoanSchedule(input);

  if (sched.length === 0) {
    return {
      monthlyPayment: 0, annualDebtService: 0, totalPayments: 0,
      totalInterest: 0, totalPrincipal: 0, balloonAmount: 0,
      hasBalloon: false, schedule: [],
      principalBalancesByYear: {}, interestPaidByYear: {}, principalPaidByYear: {},
    };
  }

  let cumulativeInterest = 0;
  let cumulativePrincipal = 0;

  const amortPayments: AmortizationPayment[] = sched.map((row) => {
    cumulativeInterest += row.interest;
    cumulativePrincipal += row.principal;
    return {
      period: row.monthIndex + 1,
      beginningBalance: row.beginBal,
      payment: row.debtService,
      principal: row.principal,
      interest: row.interest,
      endingBalance: row.endBal,
      cumulativeInterest,
      cumulativePrincipal,
    };
  });

  const lastRow = sched[sched.length - 1];
  const balloonAmount = lastRow.endBal > 0.01 ? lastRow.endBal : 0;

  const yr1 = sched.slice(0, Math.min(12, sched.length));
  const monthlyPayment = yr1.reduce((s, r) => s + r.debtService, 0) / yr1.length;
  const annualDebtService = yr1.reduce((s, r) => s + r.debtService, 0);

  const principalBalancesByYear: Record<number, number> = {};
  const interestPaidByYear: Record<number, number> = {};
  const principalPaidByYear: Record<number, number> = {};

  for (const yr of computeAnnualDebtService(sched)) {
    principalBalancesByYear[yr.year] = yr.endingBalance;
    interestPaidByYear[yr.year] = yr.interest;
    principalPaidByYear[yr.year] = yr.principal;
  }

  return {
    monthlyPayment,
    annualDebtService,
    totalPayments: cumulativeInterest + cumulativePrincipal,
    totalInterest: cumulativeInterest,
    totalPrincipal: cumulativePrincipal,
    balloonAmount,
    hasBalloon: balloonAmount > 0,
    schedule: amortPayments,
    principalBalancesByYear,
    interestPaidByYear,
    principalPaidByYear,
  };
}

export interface ExitDebtPayoff {
  outstandingBalance: number;
  prepaymentPenalty: number;
  exitFees: number;
  totalPayoff: number;
  loanPayoffs: Array<{
    loanAmount: number;
    payoffBalance: number;
    prepayPenalty: number;
    exitFee: number;
    total: number;
  }>;
}

export function computeProjectExitDebt(
  loans: DebtEngineInput[],
  exitMonthIndex: number,
): ExitDebtPayoff {
  let totalBalance = 0;
  let totalPrepay = 0;
  let totalExitFees = 0;
  const loanPayoffs: ExitDebtPayoff['loanPayoffs'] = [];

  for (const loan of loans) {
    const schedule = computeLoanSchedule(loan);
    const payoff = computeLoanPayoffAtExit(loan, schedule, exitMonthIndex);
    totalBalance += payoff.payoffBalance;
    totalPrepay += payoff.prepayPenalty;
    totalExitFees += payoff.exitFees;
    loanPayoffs.push({
      loanAmount: loan.loanAmount,
      payoffBalance: payoff.payoffBalance,
      prepayPenalty: payoff.prepayPenalty,
      exitFee: payoff.exitFees,
      total: payoff.totalPayoff,
    });
  }

  const r2 = (v: number) => Math.round(v * 100) / 100;
  return {
    outstandingBalance: r2(totalBalance),
    prepaymentPenalty: r2(totalPrepay),
    exitFees: r2(totalExitFees),
    totalPayoff: r2(totalBalance + totalPrepay + totalExitFees),
    loanPayoffs,
  };
}

export function convertLoansToDebtSchedules(
  loans: DebtEngineInput[],
): LoanScheduleResult[] {
  return loans.map(loan => canonicalToLoanScheduleResult(loan));
}
