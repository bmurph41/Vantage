import { db } from '../../../db';
import { modelingProjects, modelingScenarioVersions, modelingActuals, modelingProjectConfig, capitalStacks } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { CashflowPeriod, SaleEvent } from '../types';
import { toCents, ZERO } from '../money';

export interface CashflowTimelineOptions {
  timeframe: 'annual' | 'monthly' | 'quarterly';
  holdYears?: number;
}

export async function getProjectCashflowTimeline(
  projectId: string,
  options: CashflowTimelineOptions = { timeframe: 'annual' },
): Promise<CashflowPeriod[]> {
  const [project] = await db.select().from(modelingProjects)
    .where(eq(modelingProjects.id, projectId));

  if (!project) {
    throw new Error(`Modeling project ${projectId} not found`);
  }

  const [config] = await db.select().from(modelingProjectConfig)
    .where(eq(modelingProjectConfig.modelingProjectId, projectId));

  const holdYears = options.holdYears || (config as any)?.holdPeriodYears || 5;

  const versions = await db.select().from(modelingScenarioVersions)
    .where(eq(modelingScenarioVersions.modelingProjectId, projectId))
    .orderBy(desc(modelingScenarioVersions.createdAt));

  const actuals = await db.select().from(modelingActuals)
    .where(eq(modelingActuals.modelingProjectId, projectId));

  const [capitalStack] = await db.select().from(capitalStacks)
    .where(eq(capitalStacks.modelingProjectId, projectId));

  const periods: CashflowPeriod[] = [];
  const warnings: string[] = [];

  const purchasePrice = project.purchasePrice ? parseFloat(project.purchasePrice) : 0;
  const ebitda = project.ebitda ? parseFloat(project.ebitda) : 0;

  let baseNoi = ebitda;
  if (actuals.length > 0) {
    const latest = actuals.sort((a, b) =>
      (b.year ?? 0) - (a.year ?? 0)
    )[0];
    if (latest && (latest as any).noi) {
      baseNoi = parseFloat(String((latest as any).noi));
    } else if (latest && (latest as any).revenue && (latest as any).operatingExpenses) {
      baseNoi = parseFloat(String((latest as any).revenue)) - parseFloat(String((latest as any).operatingExpenses));
    }
  }

  if (baseNoi === 0 && ebitda > 0) {
    baseNoi = ebitda;
  }

  let interestRate = 0.05;
  let loanAmount = 0;
  if (capitalStack) {
    const meta = capitalStack.metadata as any;
    if (meta?.interestRate) interestRate = parseFloat(meta.interestRate) / 100;
    if (meta?.loanAmount) loanAmount = parseFloat(meta.loanAmount);
    if ((capitalStack as any).interestRate) interestRate = parseFloat(String((capitalStack as any).interestRate)) / 100;
    if ((capitalStack as any).loanAmount) loanAmount = parseFloat(String((capitalStack as any).loanAmount));
  }

  if (loanAmount === 0 && purchasePrice > 0) {
    loanAmount = purchasePrice * 0.65;
    warnings.push('Loan amount not found; estimated at 65% LTV.');
  }

  const annualInterest = loanAmount * interestRate;
  const annualDebtService = annualInterest * 1.25;
  const annualCapex = purchasePrice > 0 ? purchasePrice * 0.01 : baseNoi * 0.05;
  const annualReserves = purchasePrice > 0 ? purchasePrice * 0.005 : 0;

  const noiGrowthRate = 0.03;

  const tf = options.timeframe;
  const periodsPerYear = tf === 'monthly' ? 12 : tf === 'quarterly' ? 4 : 1;
  const numPeriods = holdYears * periodsPerYear;

  for (let i = 0; i < numPeriods; i++) {
    const yearIndex = tf === 'annual' ? i : Math.floor(i / periodsPerYear);
    const growthFactor = Math.pow(1 + noiGrowthRate, yearIndex);

    const periodNoi = (baseNoi * growthFactor) / periodsPerYear;
    const periodInterest = annualInterest / periodsPerYear;
    const periodDebtService = annualDebtService / periodsPerYear;
    const periodCapex = annualCapex / periodsPerYear;
    const periodReserves = annualReserves / periodsPerYear;

    const cashAvailable = Math.max(0, periodNoi - periodDebtService - periodCapex - periodReserves);

    let periodStart: Date;
    let periodEnd: Date;

    if (tf === 'annual') {
      periodStart = new Date(2025 + i, 0, 1);
      periodEnd = new Date(2025 + i, 11, 31);
    } else if (tf === 'quarterly') {
      const quarterInYear = i % 4;
      const startMonth = quarterInYear * 3;
      periodStart = new Date(2025 + yearIndex, startMonth, 1);
      periodEnd = new Date(2025 + yearIndex, startMonth + 3, 0);
    } else {
      // monthly
      periodStart = new Date(2025, i % 12, 1);
      periodStart.setFullYear(2025 + Math.floor(i / 12));
      periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      periodEnd.setDate(periodEnd.getDate() - 1);
    }

    let saleEvent: SaleEvent | undefined;
    if (i === numPeriods - 1) {
      const exitCapRate = 0.07;
      const exitNoi = baseNoi * Math.pow(1 + noiGrowthRate, holdYears);
      const salePrice = exitNoi / exitCapRate;
      const saleCosts = salePrice * 0.03;
      saleEvent = {
        netSaleProceedsCents: toCents(salePrice - saleCosts),
        saleCostsCents: toCents(saleCosts),
      };
    }

    const periodWarnings = [...warnings];
    if (i === 0 && baseNoi === 0) {
      periodWarnings.push('NOI is zero; cashflow may be inaccurate. Check project actuals or EBITDA.');
    }

    periods.push({
      periodIndex: i,
      periodStart,
      periodEnd,
      noiCents: toCents(periodNoi),
      interestCents: toCents(periodInterest),
      debtServiceCents: toCents(periodDebtService),
      capexCents: toCents(periodCapex),
      reservesCents: toCents(periodReserves),
      cashAvailableCents: toCents(cashAvailable),
      saleEvent,
      warnings: periodWarnings,
    });
  }

  return periods;
}
