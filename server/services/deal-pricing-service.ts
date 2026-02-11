import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { modelingProjects, modelingActuals } from '@shared/schema';

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
  averageCashOnCash: number;
  noiByYear: number[];
  cashFlowsByYear: number[];
  exitValue: number;
  totalProfit: number;
}

export interface SolveForPriceResult {
  purchasePrice: number;
  achievedMetric: number;
  metricType: 'irr' | 'cap_rate' | 'year_cap_rate';
  year1CapRate: number;
  irr: number;
  equityMultiple: number;
}

class DealPricingService {
  calculateIRR(cashFlows: number[]): number {
    if (cashFlows.length < 2) return 0;
    
    let low = -0.99;
    let high = 10;
    let irr = 0;
    
    for (let i = 0; i < 100; i++) {
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
    }
  ): PricingResult {
    const year1CapRate = (year1NOI / purchasePrice) * 100;
    const exitNOI = noiProjections[holdPeriod - 1] || year1NOI * Math.pow(1.03, holdPeriod);
    const exitValue = exitNOI / (exitCapRate / 100);
    
    const totalEquity = purchasePrice + (options?.workingCapitalAmount || 0);
    const useLevered = options?.leveredCashFlows && options.leveredCashFlows.length >= holdPeriod;
    const exitProceeds = options?.netExitProceeds ?? exitValue;
    
    const cashFlows = [-totalEquity];
    for (let i = 0; i < holdPeriod - 1; i++) {
      cashFlows.push(useLevered ? options!.leveredCashFlows![i] : (noiProjections[i] || year1NOI * Math.pow(1.03, i + 1)));
    }
    const lastYearCf = useLevered ? options!.leveredCashFlows![holdPeriod - 1] : (noiProjections[holdPeriod - 1] || exitNOI);
    cashFlows.push(lastYearCf + exitProceeds);
    
    const irr = this.calculateIRR(cashFlows) * 100;
    
    const totalInflows = cashFlows.slice(1).reduce((sum, cf) => sum + cf, 0);
    const equityMultiple = totalEquity > 0 ? totalInflows / totalEquity : 0;
    
    const annualCashOnCash = noiProjections.map(noi => (purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0));
    const averageCashOnCash = annualCashOnCash.length > 0 ? annualCashOnCash.reduce((sum, coc) => sum + coc, 0) / annualCashOnCash.length : 0;
    
    const totalProfit = totalInflows - totalEquity;
    
    return {
      purchasePrice,
      year1CapRate,
      exitCapRate,
      irr,
      equityMultiple,
      averageCashOnCash,
      noiByYear: noiProjections,
      cashFlowsByYear: cashFlows.slice(1),
      exitValue,
      totalProfit,
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
    }
  ): number {
    const irrDecimal = targetIRR / 100;
    const exitNOI = noiProjections[holdPeriod - 1] || year1NOI * Math.pow(1.03, holdPeriod);
    const exitValue = exitNOI / (exitCapRate / 100);
    const useLevered = options?.leveredCashFlows && options.leveredCashFlows.length >= holdPeriod;
    const exitProceeds = options?.netExitProceeds ?? exitValue;
    const workingCapital = options?.workingCapitalAmount || 0;
    
    let low = 1000;
    let high = exitValue * 2;
    let price = 0;
    
    for (let i = 0; i < 100; i++) {
      price = (low + high) / 2;
      const totalEquity = price + workingCapital;
      
      const cashFlows = [-totalEquity];
      for (let j = 0; j < holdPeriod - 1; j++) {
        cashFlows.push(useLevered ? options!.leveredCashFlows![j] : (noiProjections[j] || year1NOI * Math.pow(1.03, j + 1)));
      }
      const lastYearCf = useLevered ? options!.leveredCashFlows![holdPeriod - 1] : (noiProjections[holdPeriod - 1] || exitNOI);
      cashFlows.push(lastYearCf + exitProceeds);
      
      const calculatedIRR = this.calculateIRR(cashFlows);
      
      if (Math.abs(calculatedIRR - irrDecimal) < 0.0001) break;
      
      if (calculatedIRR > irrDecimal) {
        low = price;
      } else {
        high = price;
      }
    }
    
    return price;
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
    
    for (const actual of actuals) {
      const amount = Number(actual.amount) || 0;
      if (actual.category === 'revenue') {
        totalRevenue += amount;
      } else if (actual.category === 'expense' || actual.category === 'cogs') {
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
  }> {
    const baseFinancials = await this.getProjectFinancials(projectId, orgId);
    const revenueGrowth = inputs.revenueGrowthRate ?? 0.03;
    const expenseGrowth = inputs.expenseGrowthRate ?? 0.02;
    
    const financials = {
      ...baseFinancials,
      year1NOI: inputs.periodNOI ?? baseFinancials.year1NOI,
      baseRevenue: inputs.periodRevenue ?? baseFinancials.baseRevenue,
      baseExpenses: inputs.periodExpenses ?? baseFinancials.baseExpenses,
    };
    
    const noiProjections = this.projectNOI(
      financials.year1NOI,
      inputs.holdPeriod,
      revenueGrowth,
      expenseGrowth,
      financials.baseRevenue,
      financials.baseExpenses
    );

    let fromPurchasePrice: PricingResult | null = null;
    let fromTargetIRR: SolveForPriceResult | null = null;
    let fromGoingInCapRate: SolveForPriceResult | null = null;
    let fromTargetYearCapRate: SolveForPriceResult | null = null;

    const purchasePrice = inputs.manualPurchasePrice ?? financials.purchasePrice;
    if (purchasePrice && purchasePrice > 0) {
      fromPurchasePrice = this.calculateFromPurchasePrice(
        purchasePrice,
        financials.year1NOI,
        inputs.holdPeriod,
        inputs.exitCapRate,
        noiProjections
      );
    }

    if (inputs.targetIRR !== undefined && inputs.targetIRR > 0) {
      const solvedPrice = this.solveForPriceFromIRR(
        inputs.targetIRR,
        financials.year1NOI,
        inputs.holdPeriod,
        inputs.exitCapRate,
        noiProjections
      );
      
      const verification = this.calculateFromPurchasePrice(
        solvedPrice,
        financials.year1NOI,
        inputs.holdPeriod,
        inputs.exitCapRate,
        noiProjections
      );
      
      fromTargetIRR = {
        purchasePrice: solvedPrice,
        achievedMetric: verification.irr,
        metricType: 'irr',
        year1CapRate: verification.year1CapRate,
        irr: verification.irr,
        equityMultiple: verification.equityMultiple,
      };
    }

    if (inputs.goingInCapRate !== undefined && inputs.goingInCapRate > 0) {
      const solvedPrice = this.solveForPriceFromCapRate(
        financials.year1NOI,
        inputs.goingInCapRate
      );
      
      const verification = this.calculateFromPurchasePrice(
        solvedPrice,
        financials.year1NOI,
        inputs.holdPeriod,
        inputs.exitCapRate,
        noiProjections
      );
      
      fromGoingInCapRate = {
        purchasePrice: solvedPrice,
        achievedMetric: inputs.goingInCapRate,
        metricType: 'cap_rate',
        year1CapRate: verification.year1CapRate,
        irr: verification.irr,
        equityMultiple: verification.equityMultiple,
      };
    }

    if (inputs.targetYearCapRate !== undefined && inputs.targetYearCapRate > 0 && inputs.targetYear) {
      try {
        const solvedPrice = this.solveForPriceFromYearCapRate(
          noiProjections,
          inputs.targetYear,
          inputs.targetYearCapRate
        );
        
        const verification = this.calculateFromPurchasePrice(
          solvedPrice,
          financials.year1NOI,
          inputs.holdPeriod,
          inputs.exitCapRate,
          noiProjections
        );
        
        fromTargetYearCapRate = {
          purchasePrice: solvedPrice,
          achievedMetric: inputs.targetYearCapRate,
          metricType: 'year_cap_rate',
          year1CapRate: verification.year1CapRate,
          irr: verification.irr,
          equityMultiple: verification.equityMultiple,
        };
      } catch (e) {
      }
    }

    return {
      fromPurchasePrice,
      fromTargetIRR,
      fromGoingInCapRate,
      fromTargetYearCapRate,
      projectFinancials: {
        year1NOI: financials.year1NOI,
        baseRevenue: financials.baseRevenue,
        baseExpenses: financials.baseExpenses,
        storedPurchasePrice: baseFinancials.purchasePrice,
        selectedPeriod: inputs.periodLabel,
      },
      noiProjections,
    };
  }
}

export const dealPricingService = new DealPricingService();
