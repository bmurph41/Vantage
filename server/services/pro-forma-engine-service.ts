/**
 * Pro Forma Engine Service - Institutional Grade
 * 
 * Phase 1 Update:
 * - Uses timeline utility (no hardcoded years)
 * - Monthly-first projections with annual rollups
 * - Removes placeholder line items (validation errors instead)
 * - Supports stabilized NOI definition
 * - Prepares for seasonality support
 */

import { db } from '../db';
import { 
  modelingProjects,
  modelingScenarioVersions,
  modelingActuals,
  modelingProjectConfig,
  seasonalityProfiles,
  seasonalityProfileMonths
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { debtScheduleService, type DebtSchedule, type DSCRMetrics } from './debt-schedule-service';
import {
  buildModelingPeriods,
  annualToMonthlyRate,
  monthlyIrrToAnnualized,
  getStabilizedNoiPeriodIndex,
  type TimelineConfig,
  type MonthlyPeriod,
  type AnnualPeriod,
  type ProjectionStartRule,
  type StabilizedNoiMode,
  type IrrDisplayPreference
} from '../utils/modeling-periods';

// ============================================
// TYPES
// ============================================

export interface LineItem {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  department?: string;
  baseAmount: number;
  growthRate: number;  // Annual rate as percentage (e.g., 3 for 3%)
  projections: number[];  // Annual totals for backward compatibility
  projectionsMonthly: Record<string, number>;  // Monthly: { 'YYYY-MM': amount }
  isRevenue: boolean;
}

export interface MonthlyProjection {
  periodKey: string;  // 'YYYY-MM'
  periodIndex: number;
  year: number;
  month: number;
  revenue: number;
  expenses: number;
  noi: number;
  capex: number;
  cashFlow: number;
}

export interface AnnualProjection {
  year: number;
  yearIndex: number;
  label: string;
  revenue: number;
  expenses: number;
  noi: number;
  capex: number;
  cashFlow: number;
  monthCount: number;
}

export interface ProFormaValidationError {
  code: string;
  message: string;
  fieldPath?: string;
}

export interface ProFormaData {
  projectId: string;
  scenarioType: string;
  scenarioVersion: number;
  
  // Timeline (from utility)
  timeline: {
    projectionStartDate: string;
    projectionEndDate: string;
    holdPeriodMonths: number;
    holdPeriodYears: number;
    projectionStartRule: ProjectionStartRule;
  };
  
  // Legacy compatibility
  holdPeriod: number;
  years: number[];
  baseYear: number;
  
  // Revenue
  revenue: {
    lineItems: LineItem[];
    totals: number[];  // Annual totals (legacy)
    totalsMonthly: Record<string, number>;
  };
  
  // Expenses
  expenses: {
    lineItems: LineItem[];
    totals: number[];  // Annual totals (legacy)
    totalsMonthly: Record<string, number>;
  };
  
  // NOI & Cash Flow
  noi: number[];  // Annual (legacy)
  noiMonthly: Record<string, number>;
  noiBelowLine: number[];
  capex: number[];
  capexMonthly: Record<string, number>;
  cashFlow: number[];
  cashFlowMonthly: Record<string, number>;
  
  // Monthly & Annual detail
  monthlyProjections: MonthlyProjection[];
  annualProjections: AnnualProjection[];
  
  // Metrics
  metrics: {
    goingInCapRate: number;
    exitCapRate: number;
    revenueGrowthRate: number;
    expenseGrowthRate: number;
    purchasePrice: number;
    exitValue: number;
    totalReturn: number;
    irr: number;  // Monthly IRR by default
    irrAnnualized: number;  // Annualized IRR
    irrDisplayPreference: IrrDisplayPreference;
    equityMultiple: number;
    year1Noi: number;
    year3Noi: number;
    stabilizedNoi: number;
    stabilizedNoiYear: number;
    stabilizedNoiMode: StabilizedNoiMode;
    // Debt metrics (from capital stack integration)
    debtSchedule?: DebtSchedule;
    dscrMetrics?: DSCRMetrics;
    totalDebtService?: number;
    minDscr?: number;
    avgDscr?: number;
    debtYield?: number;
    ltv?: number;
  };
  
  // Validation
  errors: ProFormaValidationError[];
  warnings: ProFormaValidationError[];
  
  lastUpdated: string;
}

// ============================================
// SERVICE CLASS
// ============================================

export class ProFormaEngineService {
  
  /**
   * Generate pro forma projections using timeline utility.
   * Monthly-first approach with annual rollups.
   */
  async generateProForma(
    projectId: string, 
    orgId: string, 
    scenarioType: string = 'base'
  ): Promise<ProFormaData> {
    const errors: ProFormaValidationError[] = [];
    const warnings: ProFormaValidationError[] = [];
    
    // ========================================
    // 1. LOAD PROJECT & CONFIG
    // ========================================
    
    const [project] = await db.select()
      .from(modelingProjects)
      .where(and(
        eq(modelingProjects.id, projectId),
        eq(modelingProjects.orgId, orgId)
      ))
      .limit(1);

    if (!project) {
      throw new Error('Project not found');
    }

    const [config] = await db.select()
      .from(modelingProjectConfig)
      .where(eq(modelingProjectConfig.modelingProjectId, projectId))
      .limit(1);

    const [scenario] = await db.select()
      .from(modelingScenarioVersions)
      .where(and(
        eq(modelingScenarioVersions.modelingProjectId, projectId),
        eq(modelingScenarioVersions.scenarioType, scenarioType),
        eq(modelingScenarioVersions.isCurrentVersion, true)
      ))
      .limit(1);

    const actuals = await db.select()
      .from(modelingActuals)
      .where(eq(modelingActuals.modelingProjectId, projectId));
    
    // ========================================
    // 2. BUILD TIMELINE (no more hardcoded years!)
    // ========================================
    
    const timelineConfig: TimelineConfig = {
      acquisitionCloseDate: config?.acquisitionCloseDate || null,
      ttmEndDate: config?.ttmEndDate || null,
      projectionStartRule: (config?.projectionStartRule as ProjectionStartRule) || 'acq_close_year',
      holdPeriodMonths: config?.holdPeriodMonths || (config?.holdPeriod ? config.holdPeriod * 12 : 60),
      holdPeriodYears: config?.holdPeriod || 5,
    };
    
    const periods = buildModelingPeriods(timelineConfig);
    const { monthlyPeriods, annualPeriods, projectionStartDate, projectionEndDate } = periods;
    
    // Legacy compatibility: extract years array
    const years = annualPeriods.map(p => p.year);
    const baseYear = years[0] || new Date().getFullYear();
    const holdPeriod = annualPeriods.length;
    
    // ========================================
    // 3. PARSE SCENARIO ASSUMPTIONS
    // ========================================
    
    const revenueGrowthRate = parseFloat(scenario?.revenueGrowthRate?.toString() || '3') / 100;
    const expenseGrowthRate = parseFloat(scenario?.expenseGrowthRate?.toString() || '2.5') / 100;
    const exitCapRate = parseFloat(scenario?.exitCapRate?.toString() || '7.5') / 100;
    const purchasePrice = parseFloat(project.purchasePrice?.toString() || '0');
    
    // Stabilized NOI config
    const stabilizedNoiMode = (config?.stabilizedNoiMode as StabilizedNoiMode) || 'fixed_year';
    const stabilizedNoiYear = config?.stabilizedNoiYear || 3;
    const irrDisplayPreference = (config?.irrDisplayPreference as IrrDisplayPreference) || 'monthly';
    
    // ========================================
    // 4. AGGREGATE BASE AMOUNTS FROM ACTUALS
    // ========================================
    
    const revenueBySubcat: Record<string, { amount: number; category: string; subcategory: string; department?: string }> = {};
    const expensesBySubcat: Record<string, { amount: number; category: string; subcategory: string; department?: string }> = {};

    for (const actual of actuals) {
      const amount = parseFloat(actual.amount?.toString() || '0');
      const subcat = actual.subcategory || actual.lineItem || 'Other';
      const category = actual.category || 'Other';
      const department = actual.department || undefined;
      
      if (category === 'Revenue' || actual.isRevenue) {
        if (!revenueBySubcat[subcat]) {
          revenueBySubcat[subcat] = { amount: 0, category, subcategory: subcat, department };
        }
        revenueBySubcat[subcat].amount += amount;
      } else if (['Expenses', 'COGS', 'Operating Expenses', 'OpEx'].includes(category)) {
        if (!expensesBySubcat[subcat]) {
          expensesBySubcat[subcat] = { amount: 0, category, subcategory: subcat, department };
        }
        expensesBySubcat[subcat].amount += amount;
      }
    }

    // ========================================
    // 5. VALIDATION: Require actuals or base amounts
    // ========================================
    
    const hasRevenueData = Object.keys(revenueBySubcat).length > 0;
    const hasExpenseData = Object.keys(expensesBySubcat).length > 0;
    
    if (!hasRevenueData) {
      errors.push({
        code: 'NO_REVENUE_DATA',
        message: 'No revenue data found. Upload actuals or enter base amounts in assumptions.',
        fieldPath: 'revenue'
      });
    }
    
    if (!hasExpenseData) {
      warnings.push({
        code: 'NO_EXPENSE_DATA',
        message: 'No expense data found. Expenses will be zero unless provided.',
        fieldPath: 'expenses'
      });
    }
    
    // ========================================
    // 6. BUILD MONTHLY PROJECTIONS
    // ========================================
    
    // Convert annual growth to monthly
    const monthlyRevGrowth = annualToMonthlyRate(revenueGrowthRate);
    const monthlyExpGrowth = annualToMonthlyRate(expenseGrowthRate);
    
    // Build line items with monthly projections
    const revenueLineItems: LineItem[] = Object.entries(revenueBySubcat).map(([name, data], idx) => {
      const baseMonthly = data.amount / 12;  // Annualize then monthlyize
      const projectionsMonthly: Record<string, number> = {};
      
      for (const period of monthlyPeriods) {
        // Apply compound growth from period 0
        const growthFactor = Math.pow(1 + monthlyRevGrowth, period.index);
        projectionsMonthly[period.key] = Math.round(baseMonthly * growthFactor);
      }
      
      // Roll up to annual for legacy compatibility
      const projections = annualPeriods.map(year => {
        return year.monthIndices.reduce((sum, mi) => {
          const period = monthlyPeriods[mi];
          return sum + (projectionsMonthly[period.key] || 0);
        }, 0);
      });
      
      return {
        id: `rev-${idx}`,
        name,
        category: data.category,
        subcategory: data.subcategory,
        department: data.department,
        baseAmount: data.amount,
        growthRate: revenueGrowthRate * 100,
        projections,
        projectionsMonthly,
        isRevenue: true
      };
    });

    const expenseLineItems: LineItem[] = Object.entries(expensesBySubcat).map(([name, data], idx) => {
      const baseMonthly = data.amount / 12;
      const projectionsMonthly: Record<string, number> = {};
      
      for (const period of monthlyPeriods) {
        const growthFactor = Math.pow(1 + monthlyExpGrowth, period.index);
        projectionsMonthly[period.key] = Math.round(baseMonthly * growthFactor);
      }
      
      const projections = annualPeriods.map(year => {
        return year.monthIndices.reduce((sum, mi) => {
          const period = monthlyPeriods[mi];
          return sum + (projectionsMonthly[period.key] || 0);
        }, 0);
      });
      
      return {
        id: `exp-${idx}`,
        name,
        category: data.category,
        subcategory: data.subcategory,
        department: data.department,
        baseAmount: data.amount,
        growthRate: expenseGrowthRate * 100,
        projections,
        projectionsMonthly,
        isRevenue: false
      };
    });

    // ========================================
    // 7. AGGREGATE TOTALS (Monthly + Annual)
    // ========================================
    
    const revenueTotalsMonthly: Record<string, number> = {};
    const expenseTotalsMonthly: Record<string, number> = {};
    const noiMonthly: Record<string, number> = {};
    const capexMonthly: Record<string, number> = {};
    const cashFlowMonthly: Record<string, number> = {};
    
    const capexRate = 0.02;  // 2% of revenue
    
    for (const period of monthlyPeriods) {
      const revTotal = revenueLineItems.reduce((sum, item) => sum + (item.projectionsMonthly[period.key] || 0), 0);
      const expTotal = expenseLineItems.reduce((sum, item) => sum + (item.projectionsMonthly[period.key] || 0), 0);
      
      revenueTotalsMonthly[period.key] = revTotal;
      expenseTotalsMonthly[period.key] = expTotal;
      noiMonthly[period.key] = revTotal - expTotal;
      capexMonthly[period.key] = Math.round(revTotal * capexRate);
      cashFlowMonthly[period.key] = noiMonthly[period.key] - capexMonthly[period.key];
    }
    
    // Annual rollups
    const revenueTotals = annualPeriods.map(year => 
      year.monthIndices.reduce((sum, mi) => sum + (revenueTotalsMonthly[monthlyPeriods[mi].key] || 0), 0)
    );
    
    const expenseTotals = annualPeriods.map(year => 
      year.monthIndices.reduce((sum, mi) => sum + (expenseTotalsMonthly[monthlyPeriods[mi].key] || 0), 0)
    );
    
    const noi = revenueTotals.map((rev, i) => rev - expenseTotals[i]);
    const capex = revenueTotals.map(rev => Math.round(rev * capexRate));
    const cashFlow = noi.map((n, i) => n - capex[i]);
    const noiBelowLine = annualPeriods.map(() => 0);
    
    // ========================================
    // 8. BUILD PROJECTION DETAIL ARRAYS
    // ========================================
    
    const monthlyProjections: MonthlyProjection[] = monthlyPeriods.map(period => ({
      periodKey: period.key,
      periodIndex: period.index,
      year: period.year,
      month: period.month,
      revenue: revenueTotalsMonthly[period.key] || 0,
      expenses: expenseTotalsMonthly[period.key] || 0,
      noi: noiMonthly[period.key] || 0,
      capex: capexMonthly[period.key] || 0,
      cashFlow: cashFlowMonthly[period.key] || 0,
    }));
    
    const annualProjections: AnnualProjection[] = annualPeriods.map((year, i) => ({
      year: year.year,
      yearIndex: year.yearIndex,
      label: year.label,
      revenue: revenueTotals[i] || 0,
      expenses: expenseTotals[i] || 0,
      noi: noi[i] || 0,
      capex: capex[i] || 0,
      cashFlow: cashFlow[i] || 0,
      monthCount: year.monthCount,
    }));
    
    // ========================================
    // 9. CALCULATE METRICS
    // ========================================
    
    // Exit value based on terminal NOI
    const exitNoi = noi[noi.length - 1] || 0;
    const exitValue = exitCapRate > 0 ? Math.round(exitNoi / exitCapRate) : 0;
    
    // Going-in cap rate
    const goingInCapRate = purchasePrice > 0 ? (noi[0] / purchasePrice) * 100 : 0;
    
    // IRR calculation using monthly cash flows
    const monthlyCashFlows = [-purchasePrice];
    for (let i = 0; i < monthlyPeriods.length; i++) {
      const period = monthlyPeriods[i];
      let cf = cashFlowMonthly[period.key] || 0;
      
      // Add exit proceeds at final month
      if (i === monthlyPeriods.length - 1) {
        cf += exitValue;
      }
      
      monthlyCashFlows.push(cf);
    }
    
    const monthlyIrr = this.calculateIRR(monthlyCashFlows, 0.01);  // Monthly IRR
    const annualizedIrr = monthlyIrrToAnnualized(monthlyIrr / 100) * 100;  // Convert to annual
    
    // Total return & equity multiple
    const totalDistributions = monthlyCashFlows.slice(1).reduce((sum, cf) => sum + cf, 0);
    const equityMultiple = purchasePrice > 0 ? (totalDistributions / purchasePrice) : 0;
    
    // Stabilized NOI calculation
    const stabilizedNoiPeriodIndex = getStabilizedNoiPeriodIndex(
      stabilizedNoiMode,
      { fixedYear: stabilizedNoiYear },
      monthlyPeriods
    );
    
    // Get annual NOI for stabilized year
    const stabilizedYearIndex = Math.floor(stabilizedNoiPeriodIndex / 12);
    const stabilizedNoi = noi[stabilizedYearIndex] || noi[noi.length - 1] || 0;
    
    const year1Noi = noi[0] || 0;
    const year3Noi = noi[2] || noi[noi.length - 1] || 0;
    
    
    // ========================================
    // 10a. DEBT INTEGRATION (Phase 4)
    // ========================================
    
    let debtSchedule: DebtSchedule | undefined;
    let dscrMetrics: DSCRMetrics | undefined;
    let totalDebtService = 0;
    let minDscr = 0;
    let avgDscr = 0;
    let debtYield = 0;
    let ltv = 0;
    
    // Try to get capital stack for this project
    try {
      const capitalStackResult = await db.select()
        .from(modelingProjectConfig)
        .where(eq(modelingProjectConfig.modelingProjectId, projectId))
        .limit(1);
      
      const capitalStackId = (capitalStackResult[0] as any)?.capitalStackId;
      
      if (capitalStackId) {
        debtSchedule = await debtScheduleService.generateSchedule(
          orgId,
          capitalStackId,
          periods.holdPeriodMonths,
          projectionStartDate.getFullYear()
        ) || undefined;
        
        if (debtSchedule && debtSchedule.totalDebtAtClose > 0) {
          // Calculate DSCR using monthly NOI
          dscrMetrics = debtScheduleService.calculateDSCR(noiMonthly, debtSchedule);
          minDscr = dscrMetrics.minDscr;
          avgDscr = dscrMetrics.avgDscr;
          
          // Sum annual debt service
          totalDebtService = Object.values(debtSchedule.annualDebtService).reduce((a, b) => a + b, 0);
          
          // Debt yield = Year 1 NOI / Total Debt
          debtYield = debtScheduleService.calculateDebtYield(year1Noi, debtSchedule.totalDebtAtClose);
          
          // LTV = Total Debt / Purchase Price
          ltv = purchasePrice > 0 ? (debtSchedule.totalDebtAtClose / purchasePrice) * 100 : 0;
        }
      }
    } catch (debtError) {
      // Debt integration is optional - log but do not fail
      console.warn('Debt integration skipped:', debtError);
    }
    // ========================================
    // 10. RETURN COMPLETE PRO FORMA
    // ========================================
    
    return {
      projectId,
      scenarioType,
      scenarioVersion: scenario?.version || 1,
      
      timeline: {
        projectionStartDate: projectionStartDate.toISOString().split('T')[0],
        projectionEndDate: projectionEndDate.toISOString().split('T')[0],
        holdPeriodMonths: periods.holdPeriodMonths,
        holdPeriodYears: periods.holdPeriodYears,
        projectionStartRule: timelineConfig.projectionStartRule,
      },
      
      // Legacy compatibility
      holdPeriod,
      years,
      baseYear,
      
      revenue: {
        lineItems: revenueLineItems,
        totals: revenueTotals,
        totalsMonthly: revenueTotalsMonthly
      },
      
      expenses: {
        lineItems: expenseLineItems,
        totals: expenseTotals,
        totalsMonthly: expenseTotalsMonthly
      },
      
      noi,
      noiMonthly,
      noiBelowLine,
      capex,
      capexMonthly,
      cashFlow,
      cashFlowMonthly,
      
      monthlyProjections,
      annualProjections,
      
      metrics: {
        goingInCapRate,
        exitCapRate: exitCapRate * 100,
        revenueGrowthRate: revenueGrowthRate * 100,
        expenseGrowthRate: expenseGrowthRate * 100,
        purchasePrice,
        exitValue,
        totalReturn: totalDistributions,
        irr: irrDisplayPreference === 'monthly' ? monthlyIrr : annualizedIrr,
        irrAnnualized: annualizedIrr,
        irrDisplayPreference,
        equityMultiple,
        year1Noi,
        year3Noi,
        stabilizedNoi,
        stabilizedNoiYear: stabilizedYearIndex + 1,
        stabilizedNoiMode,
        // Debt metrics
        debtSchedule,
        dscrMetrics,
        totalDebtService,
        minDscr,
        avgDscr,
        debtYield,
        ltv,
      },
      
      errors,
      warnings,
      
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Calculate IRR using Newton-Raphson method.
   * Works for both monthly and annual cash flows.
   */
  private calculateIRR(cashFlows: number[], guess: number = 0.1): number {
    const maxIterations = 100;
    const precision = 0.00001;
    let rate = guess;

    // Handle edge cases
    if (cashFlows.length < 2) return 0;
    if (cashFlows[0] >= 0) return 0;  // No initial investment
    
    const totalInflows = cashFlows.slice(1).reduce((sum, cf) => sum + cf, 0);
    if (totalInflows <= 0) return -100;  // Total loss

    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let dnpv = 0;

      for (let j = 0; j < cashFlows.length; j++) {
        const discountFactor = Math.pow(1 + rate, j);
        if (discountFactor === 0) continue;
        
        npv += cashFlows[j] / discountFactor;
        dnpv -= j * cashFlows[j] / (discountFactor * (1 + rate));
      }

      if (Math.abs(dnpv) < precision) break;

      const newRate = rate - npv / dnpv;
      
      // Bound the rate to prevent divergence
      const boundedRate = Math.max(-0.99, Math.min(10, newRate));
      
      if (Math.abs(boundedRate - rate) < precision) {
        return Math.round(boundedRate * 10000) / 100;
      }
      rate = boundedRate;
    }

    return Math.round(rate * 10000) / 100;
  }

  /**
   * Get historical P&L data for a project.
   * Used for base year determination and actuals display.
   */
  async getHistoricalPL(projectId: string, orgId: string, year?: number): Promise<any> {
    const [project] = await db.select()
      .from(modelingProjects)
      .where(and(
        eq(modelingProjects.id, projectId),
        eq(modelingProjects.orgId, orgId)
      ))
      .limit(1);

    if (!project) {
      throw new Error('Project not found');
    }

    const actuals = await db.select()
      .from(modelingActuals)
      .where(eq(modelingActuals.modelingProjectId, projectId));

    const relevantActuals = year 
      ? actuals.filter(a => a.year === year)
      : actuals;

    const lineItems: Record<string, Record<number, number>> = {};
    const categories: Record<string, string> = {};

    for (const actual of relevantActuals) {
      const key = actual.subcategory || actual.category || 'Other';
      const month = actual.month || 1;
      const amount = parseFloat(actual.amount?.toString() || '0');
      
      if (!lineItems[key]) {
        lineItems[key] = {};
        categories[key] = actual.category || 'Other';
      }
      
      lineItems[key][month] = (lineItems[key][month] || 0) + amount;
    }

    const revenueItems: any[] = [];
    const expenseItems: any[] = [];

    for (const [name, monthlyData] of Object.entries(lineItems)) {
      const monthlyAmounts = Array.from({ length: 12 }, (_, i) => monthlyData[i + 1] || 0);
      const total = monthlyAmounts.reduce((sum, v) => sum + v, 0);
      
      const item = {
        name,
        category: categories[name],
        monthlyAmounts,
        total
      };

      if (categories[name] === 'Revenue') {
        revenueItems.push(item);
      } else {
        expenseItems.push(item);
      }
    }

    const totalRevenue = revenueItems.reduce((sum, item) => sum + item.total, 0);
    const totalExpenses = expenseItems.reduce((sum, item) => sum + item.total, 0);
    const netNoi = totalRevenue - totalExpenses;

    return {
      year: year || new Date().getFullYear(),
      revenue: {
        lineItems: revenueItems,
        total: totalRevenue
      },
      expenses: {
        lineItems: expenseItems,
        total: totalExpenses
      },
      noi: netNoi,
      lastUpdated: new Date().toISOString()
    };
  }
}

export const proFormaEngineService = new ProFormaEngineService();
