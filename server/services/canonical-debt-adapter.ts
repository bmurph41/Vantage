/**
 * Canonical Debt Adapter — server/services/canonical-debt-adapter.ts
 * 
 * Produces a DebtSchedule (same shape as DebtScheduleService output)
 * directly from the loans table + canonical engine.
 * Bypasses capitalStacks/debtTranches entirely.
 */
import { db } from '../db';
import { loans } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { computeLoanSchedule, computeAnnualDebtService, computeCapitalStackSummary } from '@shared/debt/debt-engine';
import type { DebtEngineInput } from '@shared/debt/debt-engine';
import type { DebtSchedule } from './debt-schedule-service';

export async function generateCanonicalDebtSchedule(
  projectId: string,
  orgId: string,
  holdPeriodMonths: number = 60,
  startYear: number = new Date().getFullYear(),
): Promise<DebtSchedule | null> {
  const projectLoans = await db.select()
    .from(loans)
    .where(and(eq(loans.projectId, projectId), eq(loans.orgId, orgId)))
    .orderBy(loans.ordinal);

  if (projectLoans.length === 0) return null;

  const inputs: DebtEngineInput[] = projectLoans.map((loan: any) => ({
    loanAmount: parseFloat(loan.loanAmount?.toString() || '0'),
    termMonths: loan.termMonths,
    amortMonths: loan.amortMonths,
    interestOnlyMonths: loan.interestOnlyMonths,
    rateType: loan.rateType as 'fixed' | 'floating',
    fixedRate: loan.fixedRate ? parseFloat(loan.fixedRate) : undefined,
    initialIndexBps: loan.initialIndexBps ?? undefined,
    spreadBps: loan.spreadBps ?? undefined,
    indexFloorBps: loan.indexFloorBps ?? undefined,
    capitalizeOriginationFees: loan.capitalizeOriginationFees,
    originationFeePct: loan.originationFeePct ? parseFloat(loan.originationFeePct) : undefined,
    exitFeePct: loan.exitFeePct ? parseFloat(loan.exitFeePct) : undefined,
    prepayType: (loan.prepayType || 'none') as any,
    stepdownSchedule: loan.stepdownScheduleJson as number[] | undefined,
  }));

  // Compute per-loan schedules and merge
  const loanSchedules = inputs.map(input => computeLoanSchedule(input));
  const maxLen = Math.min(holdPeriodMonths, Math.max(...loanSchedules.map(s => s.length)));

  // Build tranches (for shape compatibility)
  const tranches = projectLoans.map((loan: any, i: number) => ({
    id: loan.id,
    name: loan.loanName || `Loan ${i + 1}`,
    trancheType: 'senior',
    principal: parseFloat(loan.loanAmount?.toString() || '0'),
    interestRate: loan.fixedRate ? parseFloat(loan.fixedRate) * 100 : ((loan.initialIndexBps ?? 0) + (loan.spreadBps ?? 0)) / 100,
    amortizationYears: Math.round(loan.amortMonths / 12),
    termYears: Math.round(loan.termMonths / 12),
    interestOnlyMonths: loan.interestOnlyMonths,
  }));

  // Merge monthly schedules
  const schedule: DebtSchedule['schedule'] = [];
  for (let m = 0; m < maxLen; m++) {
    let totalPayment = 0, totalInterest = 0, totalPrincipal = 0, totalBalance = 0;
    for (const sched of loanSchedules) {
      if (m < sched.length) {
        totalPayment += sched[m].debtService;
        totalInterest += sched[m].interest;
        totalPrincipal += sched[m].principal;
        totalBalance += sched[m].endBal;
      }
    }

    const date = new Date(startYear, m);
    const periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    schedule.push({
      periodKey,
      month: m + 1,
      year: date.getFullYear(),
      payment: Math.round(totalPayment),
      interest: Math.round(totalInterest),
      principal: Math.round(totalPrincipal),
      totalBalance: Math.round(totalBalance),
    } as any);
  }

  // Annual rollups
  const annualDebtService: Record<number, number> = {};
  const annualInterest: Record<number, number> = {};
  const annualPrincipal: Record<number, number> = {};

  for (const entry of schedule) {
    const yr = (entry as any).year;
    annualDebtService[yr] = (annualDebtService[yr] || 0) + (entry as any).payment;
    annualInterest[yr] = (annualInterest[yr] || 0) + (entry as any).interest;
    annualPrincipal[yr] = (annualPrincipal[yr] || 0) + (entry as any).principal;
  }

  const totalDebt = inputs.reduce((s, i) => s + i.loanAmount, 0);
  const summary = computeCapitalStackSummary(inputs, totalDebt);

  return {
    capitalStackId: 'canonical',
    tranches: tranches as any,
    schedule,
    totalDebtAtClose: Math.round(totalDebt),
    blendedRate: summary.blendedRate,
    weightedAvgTermMonths: inputs.reduce((s, i) => s + i.termMonths * i.loanAmount, 0) / (totalDebt || 1),
    annualDebtService,
    annualInterest,
    annualPrincipal,
  };
}
