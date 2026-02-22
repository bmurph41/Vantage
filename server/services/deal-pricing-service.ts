import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { modelingProjects, modelingActuals } from '@shared/schema';
import { proFormaEngineService } from './pro-forma-engine-service';

function roundDownToThousand(value: number): number {
  return Math.floor(value / 1000) * 1000;
}

export interface CashFlow {
  year: number;
  noi: number;
  exitValue?: number;
}

export interface PricingInputs {
  projectId: string;
  holdPeriod: number;
  exitCapRate: number;
  cashFlows: CashFlow[];
  revenueGrowthRate?: number;
  expenseGrowthRate?: number;
}

export interface PricingResult {
  purchasePrice: number;
  year1CapRate: number;
  exitCapRate: number;
  irr: number;
  equityMultiple: number;
  moic: number;
  averageCashOnCash: number;
  noiByYear: number[];
  cashFlowsByYear: number[];
  exitValue: number;
  totalProfit: number;
  netExitProceeds: number;
  totalEquityInvested: number;
  usedProFormaData: boolean;
}

export interface SolveForPriceResult {
  purchasePrice: number;
  achievedMetric: number;
  metricType: 'irr' | 'cap_rate' | 'year_cap_rate';
  year1CapRate: number;
  irr: number;
  equityMultiple: number;
  moic: number;
}

interface ProFormaCashFlowData {
  noiProjections: number[];
  leveredCashFlows: number[];
  loanProceeds: number;
  loanPayoffAtExit: number;
  sellingFeePct: number;
  workingCapitalAmount: number;
  workingCapitalRecoveryPct: number;
  year1NOI: number;
  baseRevenue: number;
  baseExpenses: number;
  holdPeriod: number;
}

class DealPricingService {
  calculateIRR(cashFlows: number[]): number {
    if (cashFlows.length < 2) return 0;

    const hasPositive = cashFlows.some(cf => cf > 0);
    const hasNegative = cashFlows.some(cf => cf < 0);
    if (!hasPositive || !hasNegative) return 0;

    let low = -0.99;
    let high = 10;
    let irr = 0;

    for (let i = 0; i < 200; i++) {
      irr = (low + high) / 2;
      let npv = 0;
      for (let j = 0; j < cashFlows.length; j++) {
        npv += cashFlows[j] / Math.pow(1 + irr, j);
      }
      if (Math.abs(npv) < 0.01) break;
      if (npv > 0) low = irr;
      else high = irr;
    }

    return irr;
  }

  calculateNPV(cashFlows: number[], discountRate: number): number {
    let npv = 0;
    for (let i = 0; i < cashFlows.length; i++) {
      npv += cashFlows[i] / Math.pow(1 + discountRate, i);
    }
    return npv;
  }

  projectNOI(
    baseNOI: number,
    holdPeriod: number,
    revenueGrowthRate: number = 0.03,
    expenseGrowthRate: number = 0.02,
    baseRevenue?: number,
    baseExpenses?: number
  ): number[] {
    const noiByYear: number[] = [];

    if (baseRevenue !== undefined && baseExpenses !== undefined && baseRevenue > 0) {
      for (let year = 1; year <= holdPeriod; year++) {
        const projectedRevenue = baseRevenue * Math.pow(1 + revenueGrowthRate, year);
        const projectedExpenses = baseExpenses * Math.pow(1 + expenseGrowthRate, year);
        noiByYear.push(projectedRevenue - projectedExpenses);
      }
    } else {
      const impliedGrowth = (revenueGrowthRate + expenseGrowthRate) / 2;
      for (let year = 1; year <= holdPeriod; year++) {
        noiByYear.push(baseNOI * Math.pow(1 + impliedGrowth, year));
      }
    }

    return noiByYear;
  }

  private computeExitValue(terminalNOI: number, exitCapRatePercent: number): number {
    if (exitCapRatePercent <= 0 || terminalNOI <= 0) return 0;
    return terminalNOI / (exitCapRatePercent / 100);
  }

  private computeNetExitProceeds(
    exitValue: number,
    sellingFeePct: number,
    loanPayoffAtExit: number,
    workingCapitalAmount: number,
    workingCapitalRecoveryPct: number
  ): number {
    const sellingFees = Math.round(exitValue * sellingFeePct);
    const loanExitFees = Math.round(loanPayoffAtExit * 0.01);
    const workingCapitalRecovery = Math.round(workingCapitalAmount * workingCapitalRecoveryPct);
    return exitValue - sellingFees - loanPayoffAtExit - loanExitFees + workingCapitalRecovery;
  }

  private buildCashFlowSeries(
    purchasePrice: number,
    holdPeriod: number,
    exitCapRatePercent: number,
    noiProjections: number[],
    year1NOI: number,
    options?: {
      leveredCashFlows?: number[];
      loanProceeds?: number;
      loanPayoffAtExit?: number;
      sellingFeePct?: number;
      workingCapitalAmount?: number;
      workingCapitalRecoveryPct?: number;
    }
  ): {
    cashFlows: number[];
    exitValue: number;
    netExitProceeds: number;
    totalEquityInvested: number;
  } {
    const loanProceeds = options?.loanProceeds || 0;
    const workingCapital = options?.workingCapitalAmount || 0;
    const totalEquityInvested = Math.max(0, purchasePrice - loanProceeds + workingCapital);

    const terminalNOI = noiProjections[holdPeriod - 1] || year1NOI * Math.pow(1.03, holdPeriod);
    const exitValue = this.computeExitValue(terminalNOI, exitCapRatePercent);
    const netExitProceeds = this.computeNetExitProceeds(
      exitValue,
      options?.sellingFeePct || 0.02,
      options?.loanPayoffAtExit || 0,
      options?.workingCapitalAmount || 0,
      options?.workingCapitalRecoveryPct || 0.9
    );

    const useLevered = options?.leveredCashFlows && options.leveredCashFlows.length >= holdPeriod;

    const cashFlows = [-totalEquityInvested];
    for (let i = 0; i < holdPeriod - 1; i++) {
      const operatingCF = useLevered
        ? options!.leveredCashFlows![i]
        : (noiProjections[i] || year1NOI * Math.pow(1.03, i + 1));
      cashFlows.push(operatingCF);
    }

    const lastYearOperatingCF = useLevered
      ? options!.leveredCashFlows![holdPeriod - 1]
      : (noiProjections[holdPeriod - 1] || terminalNOI);
    cashFlows.push(lastYearOperatingCF + netExitProceeds);

    return { cashFlows, exitValue, netExitProceeds, totalEquityInvested };
  }

  calculateFromPurchasePrice(
    purchasePrice: number,
    year1NOI: number,
    holdPeriod: number,
    exitCapRate: number,
    noiProjections: number[],
    options?: {
      leveredCashFlows?: number[];
      loanProceeds?: number;
      loanPayoffAtExit?: number;
      sellingFeePct?: number;
      workingCapitalAmount?: number;
      workingCapitalRecoveryPct?: number;
      usedProFormaData?: boolean;
    }
  ): PricingResult {
    const year1CapRate = purchasePrice > 0 ? (year1NOI / purchasePrice) * 100 : 0;

    const { cashFlows, exitValue, netExitProceeds, totalEquityInvested } = this.buildCashFlowSeries(
      purchasePrice, holdPeriod, exitCapRate, noiProjections, year1NOI, options
    );

    const irr = this.calculateIRR(cashFlows) * 100;

    const totalInflows = cashFlows.slice(1).reduce((sum, cf) => sum + cf, 0);
    const equityMultiple = totalEquityInvested > 0 ? totalInflows / totalEquityInvested : 0;
    const moic = equityMultiple;

    const useLevered = options?.leveredCashFlows && options.leveredCashFlows.length >= holdPeriod;
    const operatingCFs = useLevered ? options!.leveredCashFlows!.slice(0, holdPeriod) : noiProjections;
    const annualCashOnCash = operatingCFs.map(cf => (totalEquityInvested > 0 ? (cf / totalEquityInvested) * 100 : 0));
    const averageCashOnCash = annualCashOnCash.length > 0 ? annualCashOnCash.reduce((sum, coc) => sum + coc, 0) / annualCashOnCash.length : 0;

    const totalProfit = totalInflows - totalEquityInvested;

    return {
      purchasePrice,
      year1CapRate,
      exitCapRate,
      irr,
      equityMultiple,
      moic,
      averageCashOnCash,
      noiByYear: noiProjections,
      cashFlowsByYear: cashFlows.slice(1),
      exitValue,
      totalProfit,
      netExitProceeds,
      totalEquityInvested,
      usedProFormaData: options?.usedProFormaData || false,
    };
  }


  /**
   * Solve for purchase price using ACTUAL Pro Forma cash flows.
   * Bisection finds price where IRR matches target.
   */
  solveForPriceFromProForma(
    proFormaData: ProFormaCashFlowData,
    targetIRR: number,
    exitValue: number
  ): PricingResult {
    const { noiProjections, leveredCashFlows, loanProceeds, loanPayoffAtExit,
            sellingFeePct, workingCapitalAmount, workingCapitalRecoveryPct,
            year1NOI, baseRevenue, baseExpenses, holdPeriod } = proFormaData;

    let low = 100_000;
    let high = exitValue * 3;
    let bestPrice = (low + high) / 2;
    let bestIRR = 0;

    for (let iter = 0; iter < 200; iter++) {
      const testPrice = Math.round((low + high) / 2);
      const equity = testPrice - loanProceeds;
      if (equity <= 0) { low = testPrice; continue; }

      const cashFlows: number[] = [-equity];
      for (let yr = 0; yr < holdPeriod; yr++) {
        const annualCF = leveredCashFlows[yr] || 0;
        if (yr === holdPeriod - 1) {
          const sellingFees = exitValue * sellingFeePct;
          const workingCapRecovery = workingCapitalAmount * workingCapitalRecoveryPct;
          const netExit = exitValue - sellingFees - loanPayoffAtExit + workingCapRecovery;
          cashFlows.push(annualCF + netExit);
        } else {
          cashFlows.push(annualCF);
        }
      }

      const irr = this.calculateIRR(cashFlows);
      bestIRR = irr;
      bestPrice = testPrice;
      if (Math.abs(irr - targetIRR) < 0.0005) break;
      if (irr > targetIRR) low = testPrice; else high = testPrice;
    }

    bestPrice = roundDownToThousand(bestPrice);
    const equity = bestPrice - loanProceeds;
    const year1CapRate = bestPrice > 0 ? (year1NOI / bestPrice) * 100 : 0;
    const sellingFees = exitValue * sellingFeePct;
    const netExitProceeds = exitValue - sellingFees - loanPayoffAtExit;
    const totalCFs = leveredCashFlows.reduce((s, cf) => s + cf, 0);
    const totalProfit = netExitProceeds - equity + totalCFs;
    const equityMultiple = equity > 0 ? (totalProfit + equity) / equity : 0;
    const avgCashOnCash = equity > 0 ? (totalCFs / holdPeriod / equity) * 100 : 0;

    return {
      purchasePrice: bestPrice,
      year1CapRate,
      exitCapRate: exitValue > 0 && noiProjections[holdPeriod - 1] ? (noiProjections[holdPeriod - 1] / exitValue) * 100 : 0,
      irr: bestIRR * 100,
      equityMultiple: Math.round(equityMultiple * 100) / 100,
      moic: Math.round(equityMultiple * 100) / 100,
      averageCashOnCash: Math.round(avgCashOnCash * 100) / 100,
      noiByYear: noiProjections,
      cashFlowsByYear: leveredCashFlows,
      exitValue,
      totalProfit: Math.round(totalProfit),
      netExitProceeds: Math.round(netExitProceeds),
      totalEquityInvested: Math.round(equity),
      usedProFormaData: true,
    };
  }

  solveForPriceFromCapRate(
    year1NOI: number,
    targetCapRate: number
  ): number {
    if (targetCapRate <= 0) return 0;
    return roundDownToThousand(year1NOI / (targetCapRate / 100));
  }

  solveForPriceFromYearCapRate(
    noiProjections: number[],
    targetYear: number,
    targetCapRate: number
  ): number {
    const targetNOI = noiProjections[targetYear - 1];
    if (!targetNOI) {
      throw new Error(`No NOI projection available for year ${targetYear}`);
    }
    if (targetCapRate <= 0) return 0;
    return roundDownToThousand(targetNOI / (targetCapRate / 100));
  }

  solveForPriceFromIRR(
    targetIRR: number,
    year1NOI: number,
    holdPeriod: number,
    exitCapRatePercent: number,
    noiProjections: number[],
    options?: {
      leveredCashFlows?: number[];
      loanProceeds?: number;
      loanPayoffAtExit?: number;
      sellingFeePct?: number;
      workingCapitalAmount?: number;
      workingCapitalRecoveryPct?: number;
    }
  ): number {
    if (targetIRR <= 0) return 0;
    const irrDecimal = targetIRR / 100;

    const terminalNOI = noiProjections[holdPeriod - 1] || year1NOI * Math.pow(1.03, holdPeriod);
    const exitValue = this.computeExitValue(terminalNOI, exitCapRatePercent);
    const netExitProceeds = this.computeNetExitProceeds(
      exitValue,
      options?.sellingFeePct || 0.02,
      options?.loanPayoffAtExit || 0,
      options?.workingCapitalAmount || 0,
      options?.workingCapitalRecoveryPct || 0.9
    );

    const useLevered = options?.leveredCashFlows && options.leveredCashFlows.length >= holdPeriod;
    const loanProceeds = options?.loanProceeds || 0;
    const workingCapital = options?.workingCapitalAmount || 0;

    const futureCFs: number[] = [];
    for (let j = 0; j < holdPeriod - 1; j++) {
      futureCFs.push(useLevered ? options!.leveredCashFlows![j] : (noiProjections[j] || year1NOI * Math.pow(1.03, j + 1)));
    }
    const lastYearCF = useLevered ? options!.leveredCashFlows![holdPeriod - 1] : (noiProjections[holdPeriod - 1] || terminalNOI);
    futureCFs.push(lastYearCF + netExitProceeds);

    let pvFutureCFs = 0;
    for (let t = 0; t < futureCFs.length; t++) {
      pvFutureCFs += futureCFs[t] / Math.pow(1 + irrDecimal, t + 1);
    }

    const totalEquity = pvFutureCFs;
    const purchasePrice = totalEquity + loanProceeds - workingCapital;

    if (purchasePrice <= 0) {
      return this.solveForPriceFromIRRBisection(
        targetIRR, year1NOI, holdPeriod, exitCapRatePercent,
        noiProjections, options
      );
    }

    const verificationResult = this.buildCashFlowSeries(
      purchasePrice, holdPeriod, exitCapRatePercent, noiProjections, year1NOI, options
    );
    const verifiedIRR = this.calculateIRR(verificationResult.cashFlows) * 100;
    if (Math.abs(verifiedIRR - targetIRR) > 0.5) {
      return this.solveForPriceFromIRRBisection(
        targetIRR, year1NOI, holdPeriod, exitCapRatePercent,
        noiProjections, options
      );
    }

    return roundDownToThousand(purchasePrice);
  }

  private solveForPriceFromIRRBisection(
    targetIRR: number,
    year1NOI: number,
    holdPeriod: number,
    exitCapRatePercent: number,
    noiProjections: number[],
    options?: {
      leveredCashFlows?: number[];
      loanProceeds?: number;
      loanPayoffAtExit?: number;
      sellingFeePct?: number;
      workingCapitalAmount?: number;
      workingCapitalRecoveryPct?: number;
    }
  ): number {
    const irrDecimal = targetIRR / 100;

    const terminalNOI = noiProjections[holdPeriod - 1] || year1NOI * Math.pow(1.03, holdPeriod);
    const exitValue = this.computeExitValue(terminalNOI, exitCapRatePercent);

    let low = 1000;
    let high = Math.max(exitValue * 2, year1NOI * 30, 10000000);
    let bestPrice = 0;
    let bestDiff = Infinity;

    for (let i = 0; i < 300; i++) {
      const price = (low + high) / 2;
      const result = this.buildCashFlowSeries(
        price, holdPeriod, exitCapRatePercent, noiProjections, year1NOI, options
      );
      if (result.totalEquityInvested <= 0) { low = price; continue; }

      const calculatedIRR = this.calculateIRR(result.cashFlows);
      const diff = Math.abs(calculatedIRR - irrDecimal);

      if (diff < bestDiff) {
        bestDiff = diff;
        bestPrice = price;
      }

      if (diff < 0.0001) break;

      if (calculatedIRR > irrDecimal) {
        low = price;
      } else {
        high = price;
      }
    }

    return roundDownToThousand(bestPrice);
  }

  async getProjectFinancials(projectId: string, orgId: string): Promise<{
    year1NOI: number;
    baseRevenue: number;
    baseExpenses: number;
    purchasePrice: number | null;
  }> {
    const [project] = await db
      .select()
      .from(modelingProjects)
      .where(and(
        eq(modelingProjects.id, projectId),
        eq(modelingProjects.orgId, orgId)
      ));

    if (!project) {
      throw new Error('Project not found');
    }

    const actuals = await db
      .select()
      .from(modelingActuals)
      .where(eq(modelingActuals.modelingProjectId, projectId));

    let totalRevenue = 0;
    let totalExpenses = 0;

    const actualsYears = Array.from(new Set(actuals.map(a => a.year))).sort((a, b) => b - a);
    const latestYear = actualsYears[0];

    for (const actual of actuals) {
      if (latestYear && actual.year !== latestYear) continue;
      const amount = Number(actual.amount) || 0;
      if (actual.category === 'Revenue' || actual.category === 'revenue') {
        totalRevenue += amount;
      } else if (actual.category === 'Expenses' || actual.category === 'expense' || actual.category === 'Operating Expenses' || actual.category === 'OpEx' || actual.category === 'Payroll' || actual.category === 'COGS' || actual.category === 'cogs') {
        totalExpenses += amount;
      }
    }

    // No hardcoded fallback — if no actuals exist, financials stay at $0
    // Direct Input P&L computation will be added in Phase 2

    const year1NOI = totalRevenue - totalExpenses;
    const purchasePrice = project.purchasePrice ? Number(project.purchasePrice) : null;

    return {
      year1NOI,
      baseRevenue: totalRevenue,
      baseExpenses: totalExpenses,
      purchasePrice,
    };
  }

  async getProFormaData(projectId: string, orgId: string): Promise<ProFormaCashFlowData | null> {
    try {
      const proForma = await proFormaEngineService.generateProForma(projectId, orgId, 'base');
      if (!proForma || proForma.errors.length > 0 || proForma.noi.length === 0) {
        return null;
      }

      const lastScheduleEntry = proForma.metrics.debtSchedule?.schedule?.[
        (proForma.metrics.debtSchedule?.schedule?.length || 1) - 1
      ];
      const loanPayoffAtExit = Math.round(lastScheduleEntry?.totalBalance || 0);

      const exitAssumptions = (proForma as any)?.exitAssumptions || {};
      const sellingFeePct = exitAssumptions.sellingFeePct ?? 0.02;
      const workingCapitalRecoveryPct = exitAssumptions.workingCapitalRecoveryPct ?? 0.9;

      const workingCapitalAmount = proForma.metrics.workingCapitalRecovery > 0
        ? Math.round(proForma.metrics.workingCapitalRecovery / (workingCapitalRecoveryPct || 1))
        : 0;

      return {
        noiProjections: proForma.noi,
        leveredCashFlows: proForma.leveredCashFlow,
        loanProceeds: proForma.metrics.debtSchedule?.totalDebtAtClose || 0,
        loanPayoffAtExit,
        sellingFeePct,
        workingCapitalAmount,
        workingCapitalRecoveryPct,
        year1NOI: proForma.metrics.year1Noi,
        baseRevenue: proForma.revenue.totals[0] || 0,
        baseExpenses: (proForma.cogs.totals[0] || 0) + (proForma.expenses.totals[0] || 0),
        holdPeriod: proForma.holdPeriod,
      };
    } catch (err) {
      console.warn('Pro Forma data not available for deal pricing:', err);
      return null;
    }
  }

  buildFinancialsAndProjections(
    baseFinancials: { year1NOI: number; baseRevenue: number; baseExpenses: number; purchasePrice: number | null },
    proFormaData: ProFormaCashFlowData | null,
    inputs: {
      holdPeriod: number;
      exitCapRate: number;
      periodLabel?: string;
      periodNOI?: number;
      periodRevenue?: number;
      periodExpenses?: number;
    }
  ) {
    const revenueGrowth = 0.03;
    const expenseGrowth = 0.02;
    const useProForma = proFormaData !== null && !inputs.periodLabel;

    const financials = {
      ...baseFinancials,
      year1NOI: inputs.periodNOI ?? (useProForma ? proFormaData!.year1NOI : baseFinancials.year1NOI),
      baseRevenue: inputs.periodRevenue ?? (useProForma ? proFormaData!.baseRevenue : baseFinancials.baseRevenue),
      baseExpenses: inputs.periodExpenses ?? (useProForma ? proFormaData!.baseExpenses : baseFinancials.baseExpenses),
    };

    const noiProjections = useProForma && proFormaData!.noiProjections.length >= inputs.holdPeriod
      ? proFormaData!.noiProjections.slice(0, inputs.holdPeriod)
      : this.projectNOI(
          financials.year1NOI,
          inputs.holdPeriod,
          revenueGrowth,
          expenseGrowth,
          financials.baseRevenue,
          financials.baseExpenses
        );

    const proFormaOptions = useProForma ? {
      leveredCashFlows: proFormaData!.leveredCashFlows.slice(0, inputs.holdPeriod),
      loanProceeds: proFormaData!.loanProceeds,
      loanPayoffAtExit: proFormaData!.loanPayoffAtExit,
      sellingFeePct: proFormaData!.sellingFeePct,
      workingCapitalAmount: proFormaData!.workingCapitalAmount,
      workingCapitalRecoveryPct: proFormaData!.workingCapitalRecoveryPct,
      usedProFormaData: true,
    } : undefined;

    const terminalNOI = noiProjections[inputs.holdPeriod - 1] || financials.year1NOI;
    const exitValue = this.computeExitValue(terminalNOI, inputs.exitCapRate);

    return { financials, noiProjections, proFormaOptions, useProForma, exitValue };
  }

  async calculateUnified(
    projectId: string,
    orgId: string,
    inputs: {
      pricingDriver: 'price' | 'targetIRR' | 'goingInCap' | 'targetYearCap' | 'exitCap' | 'holdPeriod';
      purchasePrice?: number;
      targetIRR?: number;
      goingInCapRate?: number;
      targetYearCapRate?: number;
      targetYear?: number;
      holdPeriod: number;
      exitCapRate: number;
      lockedInputs?: string[];
      periodLabel?: string;
      periodNOI?: number;
      periodRevenue?: number;
      periodExpenses?: number;
    }
  ): Promise<{
    driver: string;
    purchasePrice: number;
    year1CapRate: number;
    goingInCapRate: number;
    exitCapRate: number;
    irr: number;
    equityMultiple: number;
    moic: number;
    averageCashOnCash: number;
    noiByYear: number[];
    cashFlowsByYear: number[];
    exitValue: number;
    totalProfit: number;
    netExitProceeds: number;
    totalEquityInvested: number;
    usedProFormaData: boolean;
    projectFinancials: {
      year1NOI: number;
      baseRevenue: number;
      baseExpenses: number;
      storedPurchasePrice: number | null;
    };
    noiProjections: number[];
    proFormaIntegrated: boolean;
    stabilizedCapRate: number;
    npv: number;
    discountRate: number;
  }> {
    const baseFinancials = await this.getProjectFinancials(projectId, orgId);
    const proFormaData = await this.getProFormaData(projectId, orgId);
    const { financials, noiProjections, proFormaOptions, useProForma, exitValue } =
      this.buildFinancialsAndProjections(baseFinancials, proFormaData, inputs);

    let resolvedPrice: number = 0;
    const locked = new Set(inputs.lockedInputs || []);
    let effectiveDriver = inputs.pricingDriver;

    const nonPriceDrivers = ['exitCap', 'holdPeriod', 'targetYearCap'];
    if (nonPriceDrivers.includes(effectiveDriver)) {
      if (locked.has('targetIRR') && inputs.targetIRR && inputs.targetIRR > 0) {
        effectiveDriver = 'targetIRR';
      } else if (locked.has('goingInCap') && inputs.goingInCapRate && inputs.goingInCapRate > 0) {
        effectiveDriver = 'goingInCap';
      } else if (locked.has('price') && inputs.purchasePrice && inputs.purchasePrice > 0) {
        effectiveDriver = 'price';
      }
    }

    const driver = effectiveDriver;

    if (driver === 'targetIRR') {
      const targetIRR = inputs.targetIRR ?? 15;
      if (targetIRR > 0) {
        resolvedPrice = this.solveForPriceFromIRR(
          targetIRR, financials.year1NOI, inputs.holdPeriod,
          inputs.exitCapRate, noiProjections, proFormaOptions
        );
      }
    } else if (driver === 'goingInCap') {
      const capRate = inputs.goingInCapRate ?? 7.5;
      if (capRate > 0) {
        resolvedPrice = this.solveForPriceFromCapRate(financials.year1NOI, capRate);
      }
    } else if (driver === 'targetYearCap') {
      const capRate = inputs.targetYearCapRate ?? 7.0;
      const year = inputs.targetYear ?? 3;
      if (capRate > 0) {
        try {
          resolvedPrice = this.solveForPriceFromYearCapRate(noiProjections, year, capRate);
        } catch {
          resolvedPrice = inputs.purchasePrice || baseFinancials.purchasePrice || 0;
        }
      }
    } else {
      resolvedPrice = inputs.purchasePrice || baseFinancials.purchasePrice || 0;
    }

    if (!resolvedPrice || resolvedPrice <= 0) {
      resolvedPrice = inputs.purchasePrice || baseFinancials.purchasePrice || 0;
    }

    const result = this.calculateFromPurchasePrice(
      resolvedPrice, financials.year1NOI, inputs.holdPeriod,
      inputs.exitCapRate, noiProjections, proFormaOptions
    );

    const goingInCapRate = resolvedPrice > 0 ? (financials.year1NOI / resolvedPrice) * 100 : 0;
    const stabilizedNOI = noiProjections[Math.min(2, noiProjections.length - 1)] || financials.year1NOI;
    const stabilizedCapRate = resolvedPrice > 0 ? (stabilizedNOI / resolvedPrice) * 100 : 0;

    const discountRate = (inputs.targetIRR ?? 15) / 100;
    const npvCashFlows = [-result.totalEquityInvested, ...result.cashFlowsByYear];
    const npv = this.calculateNPV(npvCashFlows, discountRate);

    return {
      driver,
      purchasePrice: resolvedPrice,
      year1CapRate: result.year1CapRate,
      goingInCapRate,
      exitCapRate: inputs.exitCapRate,
      irr: result.irr,
      equityMultiple: result.equityMultiple,
      moic: result.moic,
      averageCashOnCash: result.averageCashOnCash,
      noiByYear: result.noiByYear,
      cashFlowsByYear: result.cashFlowsByYear,
      exitValue: result.exitValue,
      totalProfit: result.totalProfit,
      netExitProceeds: result.netExitProceeds,
      totalEquityInvested: result.totalEquityInvested,
      usedProFormaData: result.usedProFormaData,
      projectFinancials: {
        year1NOI: financials.year1NOI,
        baseRevenue: financials.baseRevenue,
        baseExpenses: financials.baseExpenses,
        storedPurchasePrice: baseFinancials.purchasePrice,
      },
      noiProjections,
      proFormaIntegrated: useProForma,
      stabilizedCapRate,
      npv,
      discountRate: inputs.targetIRR ?? 15,
    };
  }

  async calculateAllPricingModes(
    projectId: string,
    orgId: string,
    inputs: {
      manualPurchasePrice?: number;
      targetIRR?: number;
      goingInCapRate?: number;
      targetYearCapRate?: number;
      targetYear?: number;
      holdPeriod: number;
      exitCapRate: number;
      revenueGrowthRate?: number;
      expenseGrowthRate?: number;
      periodLabel?: string;
      periodNOI?: number;
      periodRevenue?: number;
      periodExpenses?: number;
    }
  ): Promise<{
    fromPurchasePrice: PricingResult | null;
    fromTargetIRR: SolveForPriceResult | null;
    fromGoingInCapRate: SolveForPriceResult | null;
    fromTargetYearCapRate: SolveForPriceResult | null;
    projectFinancials: {
      year1NOI: number;
      baseRevenue: number;
      baseExpenses: number;
      storedPurchasePrice: number | null;
      selectedPeriod?: string;
    };
    noiProjections: number[];
    proFormaIntegrated: boolean;
    exitValue: number;
    netExitProceeds: number;
  }> {
    const baseFinancials = await this.getProjectFinancials(projectId, orgId);
    const proFormaData = await this.getProFormaData(projectId, orgId);
    const { financials, noiProjections, proFormaOptions, useProForma, exitValue } =
      this.buildFinancialsAndProjections(baseFinancials, proFormaData, inputs);

    let fromPurchasePrice: PricingResult | null = null;
    let fromTargetIRR: SolveForPriceResult | null = null;
    let fromGoingInCapRate: SolveForPriceResult | null = null;
    let fromTargetYearCapRate: SolveForPriceResult | null = null;

    const purchasePrice = inputs.manualPurchasePrice ?? financials.purchasePrice;
    if (purchasePrice && purchasePrice > 0) {
      fromPurchasePrice = this.calculateFromPurchasePrice(
        purchasePrice, financials.year1NOI, inputs.holdPeriod,
        inputs.exitCapRate, noiProjections, proFormaOptions
      );
    }

    if (inputs.targetIRR !== undefined && inputs.targetIRR > 0) {
      const solvedPrice = this.solveForPriceFromIRR(
        inputs.targetIRR, financials.year1NOI, inputs.holdPeriod,
        inputs.exitCapRate, noiProjections, proFormaOptions
      );
      const verification = this.calculateFromPurchasePrice(
        solvedPrice, financials.year1NOI, inputs.holdPeriod,
        inputs.exitCapRate, noiProjections, proFormaOptions
      );
      fromTargetIRR = {
        purchasePrice: solvedPrice, achievedMetric: verification.irr,
        metricType: 'irr', year1CapRate: verification.year1CapRate,
        irr: verification.irr, equityMultiple: verification.equityMultiple,
        moic: verification.moic,
      };
    }

    if (inputs.goingInCapRate !== undefined && inputs.goingInCapRate > 0) {
      const solvedPrice = this.solveForPriceFromCapRate(financials.year1NOI, inputs.goingInCapRate);
      const verification = this.calculateFromPurchasePrice(
        solvedPrice, financials.year1NOI, inputs.holdPeriod,
        inputs.exitCapRate, noiProjections, proFormaOptions
      );
      fromGoingInCapRate = {
        purchasePrice: solvedPrice, achievedMetric: inputs.goingInCapRate,
        metricType: 'cap_rate', year1CapRate: verification.year1CapRate,
        irr: verification.irr, equityMultiple: verification.equityMultiple,
        moic: verification.moic,
      };
    }

    if (inputs.targetYearCapRate !== undefined && inputs.targetYearCapRate > 0 && inputs.targetYear) {
      try {
        const solvedPrice = this.solveForPriceFromYearCapRate(noiProjections, inputs.targetYear, inputs.targetYearCapRate);
        const verification = this.calculateFromPurchasePrice(
          solvedPrice, financials.year1NOI, inputs.holdPeriod,
          inputs.exitCapRate, noiProjections, proFormaOptions
        );
        fromTargetYearCapRate = {
          purchasePrice: solvedPrice, achievedMetric: inputs.targetYearCapRate,
          metricType: 'year_cap_rate', year1CapRate: verification.year1CapRate,
          irr: verification.irr, equityMultiple: verification.equityMultiple,
          moic: verification.moic,
        };
      } catch (e) {
      }
    }

    const terminalNOI = noiProjections[inputs.holdPeriod - 1] || financials.year1NOI;
    const netExitProceeds = this.computeNetExitProceeds(
      exitValue,
      proFormaOptions?.sellingFeePct || 0.02,
      proFormaOptions?.loanPayoffAtExit || 0,
      proFormaOptions?.workingCapitalAmount || 0,
      proFormaOptions?.workingCapitalRecoveryPct || 0.9
    );

    return {
      fromPurchasePrice, fromTargetIRR, fromGoingInCapRate, fromTargetYearCapRate,
      projectFinancials: {
        year1NOI: financials.year1NOI, baseRevenue: financials.baseRevenue,
        baseExpenses: financials.baseExpenses, storedPurchasePrice: baseFinancials.purchasePrice,
        selectedPeriod: inputs.periodLabel,
      },
      noiProjections, proFormaIntegrated: useProForma, exitValue, netExitProceeds,
    };
  }
}

export const dealPricingService = new DealPricingService();
