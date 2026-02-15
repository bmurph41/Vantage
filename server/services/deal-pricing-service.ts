import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { modelingProjects, modelingActuals } from '@shared/schema';
import { proFormaEngineService } from './pro-forma-engine-service';

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
    
    if (baseRevenue !== undefined && baseExpenses !== undefined) {
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

  calculateFromPurchasePrice(
    purchasePrice: number,
    year1NOI: number,
    holdPeriod: number,
    exitCapRate: number,
    noiProjections: number[],
    options?: {
      leveredCashFlows?: number[];
      netExitProceeds?: number;
      workingCapitalAmount?: number;
      loanProceeds?: number;
      usedProFormaData?: boolean;
    }
  ): PricingResult {
    const year1CapRate = purchasePrice > 0 ? (year1NOI / purchasePrice) * 100 : 0;
    const exitNOI = noiProjections[holdPeriod - 1] || year1NOI * Math.pow(1.03, holdPeriod);
    const exitValue = exitCapRate > 0 ? exitNOI / (exitCapRate / 100) : 0;
    
    const loanProceeds = options?.loanProceeds || 0;
    const workingCapital = options?.workingCapitalAmount || 0;
    const totalEquityInvested = purchasePrice - loanProceeds + workingCapital;
    const useLevered = options?.leveredCashFlows && options.leveredCashFlows.length >= holdPeriod;
    const netExitProceeds = options?.netExitProceeds ?? exitValue;
    
    const cashFlows = [-totalEquityInvested];
    for (let i = 0; i < holdPeriod - 1; i++) {
      cashFlows.push(useLevered ? options!.leveredCashFlows![i] : (noiProjections[i] || year1NOI * Math.pow(1.03, i + 1)));
    }
    const lastYearCf = useLevered ? options!.leveredCashFlows![holdPeriod - 1] : (noiProjections[holdPeriod - 1] || exitNOI);
    cashFlows.push(lastYearCf + netExitProceeds);
    
    const irr = this.calculateIRR(cashFlows) * 100;
    
    const totalInflows = cashFlows.slice(1).reduce((sum, cf) => sum + cf, 0);
    const equityMultiple = totalEquityInvested > 0 ? totalInflows / totalEquityInvested : 0;
    const moic = equityMultiple;
    
    const annualCashOnCash = noiProjections.map(noi => (purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0));
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

  solveForPriceFromCapRate(
    year1NOI: number,
    targetCapRate: number
  ): number {
    return year1NOI / (targetCapRate / 100);
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
    return targetNOI / (targetCapRate / 100);
  }

  solveForPriceFromIRR(
    targetIRR: number,
    year1NOI: number,
    holdPeriod: number,
    exitCapRate: number,
    noiProjections: number[],
    options?: {
      leveredCashFlows?: number[];
      netExitProceeds?: number;
      workingCapitalAmount?: number;
      loanProceeds?: number;
    }
  ): number {
    const irrDecimal = targetIRR / 100;
    const exitNOI = noiProjections[holdPeriod - 1] || year1NOI * Math.pow(1.03, holdPeriod);
    const exitValue = exitCapRate > 0 ? exitNOI / (exitCapRate / 100) : 0;
    const useLevered = options?.leveredCashFlows && options.leveredCashFlows.length >= holdPeriod;
    const netExitProceeds = options?.netExitProceeds ?? exitValue;
    const workingCapital = options?.workingCapitalAmount || 0;
    const loanProceeds = options?.loanProceeds || 0;
    
    const totalCashInflows = (() => {
      let sum = 0;
      for (let j = 0; j < holdPeriod - 1; j++) {
        sum += useLevered ? options!.leveredCashFlows![j] : (noiProjections[j] || year1NOI * Math.pow(1.03, j + 1));
      }
      const lastYearCf = useLevered ? options!.leveredCashFlows![holdPeriod - 1] : (noiProjections[holdPeriod - 1] || exitNOI);
      sum += lastYearCf + netExitProceeds;
      return sum;
    })();

    let low = 1000;
    let high = Math.max(
      exitValue * 3,
      netExitProceeds * 2,
      totalCashInflows * 2,
      year1NOI * 30,
      1000000
    );
    let price = 0;
    let bestPrice = 0;
    let bestDiff = Infinity;
    
    for (let i = 0; i < 300; i++) {
      price = (low + high) / 2;
      const totalEquity = price - loanProceeds + workingCapital;
      if (totalEquity <= 0) { low = price; continue; }
      
      const cashFlows = [-totalEquity];
      for (let j = 0; j < holdPeriod - 1; j++) {
        cashFlows.push(useLevered ? options!.leveredCashFlows![j] : (noiProjections[j] || year1NOI * Math.pow(1.03, j + 1)));
      }
      const lastYearCf = useLevered ? options!.leveredCashFlows![holdPeriod - 1] : (noiProjections[holdPeriod - 1] || exitNOI);
      cashFlows.push(lastYearCf + netExitProceeds);
      
      const calculatedIRR = this.calculateIRR(cashFlows);
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
    
    return bestPrice;
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

    if (totalRevenue === 0) {
      totalRevenue = 1909000;
      totalExpenses = 1109000;
    }
    
    const year1NOI = totalRevenue - totalExpenses;
    const purchasePrice = project.purchasePrice ? Number(project.purchasePrice) : null;
    
    return {
      year1NOI,
      baseRevenue: totalRevenue,
      baseExpenses: totalExpenses,
      purchasePrice,
    };
  }

  async getProFormaData(projectId: string, orgId: string): Promise<{
    noiProjections: number[];
    leveredCashFlows: number[];
    netExitProceeds: number;
    exitValue: number;
    workingCapitalAmount: number;
    loanProceeds: number;
    year1NOI: number;
    baseRevenue: number;
    baseExpenses: number;
    holdPeriod: number;
    exitCapRate: number;
  } | null> {
    try {
      const proForma = await proFormaEngineService.generateProForma(projectId, orgId, 'base');
      if (!proForma || proForma.errors.length > 0 || proForma.noi.length === 0) {
        return null;
      }

      return {
        noiProjections: proForma.noi,
        leveredCashFlows: proForma.leveredCashFlow,
        netExitProceeds: proForma.metrics.netExitProceeds,
        exitValue: proForma.metrics.exitValue,
        workingCapitalAmount: proForma.metrics.workingCapitalRecovery > 0 ? 
          Math.round(proForma.metrics.workingCapitalRecovery / ((proForma as any)?.exitAssumptions?.workingCapitalRecoveryPct || 1)) : 0,
        loanProceeds: proForma.metrics.debtSchedule?.totalDebtAtClose || 0,
        year1NOI: proForma.metrics.year1Noi,
        baseRevenue: proForma.revenue.totals[0] || 0,
        baseExpenses: (proForma.cogs.totals[0] || 0) + (proForma.expenses.totals[0] || 0),
        holdPeriod: proForma.holdPeriod,
        exitCapRate: proForma.metrics.exitCapRate,
      };
    } catch (err) {
      console.warn('Pro Forma data not available for deal pricing:', err);
      return null;
    }
  }

  private buildFinancialsAndProjections(
    baseFinancials: { year1NOI: number; baseRevenue: number; baseExpenses: number; purchasePrice: number | null },
    proFormaData: Awaited<ReturnType<typeof this.getProFormaData>>,
    inputs: {
      holdPeriod: number;
      exitCapRate: number;
      revenueGrowthRate?: number;
      expenseGrowthRate?: number;
      periodLabel?: string;
      periodNOI?: number;
      periodRevenue?: number;
      periodExpenses?: number;
    }
  ) {
    const revenueGrowth = inputs.revenueGrowthRate ?? 0.03;
    const expenseGrowth = inputs.expenseGrowthRate ?? 0.02;
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
      netExitProceeds: proFormaData!.netExitProceeds,
      workingCapitalAmount: proFormaData!.workingCapitalAmount,
      loanProceeds: proFormaData!.loanProceeds,
      usedProFormaData: true,
    } : undefined;

    const exitNOI = noiProjections[inputs.holdPeriod - 1] || financials.year1NOI;
    const exitValue = inputs.exitCapRate > 0 ? exitNOI / (inputs.exitCapRate / 100) : 0;
    const netExitProceeds = proFormaOptions?.netExitProceeds ?? exitValue;

    return { financials, noiProjections, proFormaOptions, useProForma, exitValue, netExitProceeds };
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
      revenueGrowthRate?: number;
      expenseGrowthRate?: number;
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
  }> {
    const baseFinancials = await this.getProjectFinancials(projectId, orgId);
    const proFormaData = await this.getProFormaData(projectId, orgId);
    const { financials, noiProjections, proFormaOptions, useProForma, exitValue, netExitProceeds } =
      this.buildFinancialsAndProjections(baseFinancials, proFormaData, inputs);

    let resolvedPrice: number = 0;
    const driver = inputs.pricingDriver;

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
    const { financials, noiProjections, proFormaOptions, useProForma, exitValue, netExitProceeds } =
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
