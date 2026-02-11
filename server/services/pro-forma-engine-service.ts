/**
 * Pro Forma Engine Service - Institutional Grade
 * 
 * Phase 1 Update:
 * - Uses timeline utility (no hardcoded years)
 * - Monthly-first projections with annual rollups
 * - Removes placeholder line items (validation errors instead)
 * - Supports stabilized NOI definition
 * - Prepares for seasonality support
 * 
 * Phase 2 Update:
 * - P&L waterfall: separate COGS from Operating Expenses
 * - Below-the-line cash flow items (management fee, capex, reserves, debt service)
 * - Exit year waterfall (selling fees, loan payoff, working capital recovery)
 * - IRR on levered cash flows
 * - Historical P&L COGS separation
 */

import { db } from '../db';
import { 
  modelingProjects,
  modelingScenarioVersions,
  modelingActuals,
  modelingProjectConfig,
  seasonalityProfiles,
  seasonalityProfileMonths,
  asmpFuel,
  asmpShipStore,
  asmpService,
  asmpBoatRentals,
  asmpBoatClub,
  asmpBoatSales,
  asmpCommercialTenants,
  asmpBookkeeping
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
  cogs: number;
  grossProfit: number;
  expenses: number;
  noi: number;
  capex: number;
  cashFlow: number;
  managementFee: number;
  reserves: number;
  debtService: number;
  leveredCashFlow: number;
}

export interface AnnualProjection {
  year: number;
  yearIndex: number;
  label: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  noi: number;
  capex: number;
  cashFlow: number;
  managementFee: number;
  reserves: number;
  debtService: number;
  leveredCashFlow: number;
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
  latestHistoricalYear: number;
  granularAssumptionsApplied: boolean;
  
  // Revenue
  revenue: {
    lineItems: LineItem[];
    totals: number[];  // Annual totals (legacy)
    totalsMonthly: Record<string, number>;
  };
  
  // COGS
  cogs: {
    lineItems: LineItem[];
    totals: number[];
    totalsMonthly: Record<string, number>;
  };
  
  // Gross Profit
  grossProfit: number[];
  grossProfitMonthly: Record<string, number>;
  
  // Expenses (Operating Expenses only)
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
  cashFlow: number[];  // Backward compat: populated with levered cash flow
  cashFlowMonthly: Record<string, number>;
  
  // Below-the-line items
  managementFee: number[];
  managementFeeMonthly: Record<string, number>;
  reserves: number[];
  reservesMonthly: Record<string, number>;
  debtService: number[];
  debtServiceMonthly: Record<string, number>;
  leveredCashFlow: number[];
  leveredCashFlowMonthly: Record<string, number>;
  
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
    // Exit waterfall
    netExitProceeds: number;
    sellingFees: number;
    loanPayoff: number;
    loanExitFees: number;
    workingCapitalRecovery: number;
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
    // 3. PARSE SCENARIO ASSUMPTIONS (Granular)
    // ========================================
    
    const flatRevenueGrowthRate = parseFloat(scenario?.revenueGrowthRate?.toString() || '3') / 100;
    const flatExpenseGrowthRate = parseFloat(scenario?.expenseGrowthRate?.toString() || '2.5') / 100;
    const exitCapRate = parseFloat(scenario?.exitCapRate?.toString() || '7.5') / 100;
    const purchasePrice = parseFloat(project.purchasePrice?.toString() || '0');
    
    const stabilizedNoiMode = (config?.stabilizedNoiMode as StabilizedNoiMode) || 'fixed_year';
    const stabilizedNoiYear = config?.stabilizedNoiYear || 3;
    const irrDisplayPreference = (config?.irrDisplayPreference as IrrDisplayPreference) || 'monthly';
    
    const assumptions = (scenario?.assumptions as any) || {};
    const granularGrowthRates: Record<string, number> = assumptions.growthRates || {};
    const granularExpenseGrowth: Record<string, number> = assumptions.expenseGrowth || {};
    const granularOccupancy: Record<string, Record<string, number>> = assumptions.occupancy || {};
    const granularMargins: Record<string, { historical: number; projected: number }> = assumptions.margins || {};
    const storageGrowthData: {
      mode: string;
      universalRate: number;
      typeRates: Record<string, number>;
      locationRates: Record<string, number>;
    } = assumptions.storageGrowth || { mode: 'universal', universalRate: flatRevenueGrowthRate * 100, typeRates: {}, locationRates: {} };
    
    const yearlyGrowthRates: Record<string, Record<string, number>> = assumptions.yearlyGrowthRates?.revenue || {};
    const yearlyExpenseGrowth: Record<string, Record<string, number>> = assumptions.yearlyGrowthRates?.expenses || {};
    const lineItemOverrides: Record<string, Record<string, number>> = assumptions.lineItemOverrides || {};
    
    const hasGranularAssumptions = Object.keys(granularGrowthRates).length > 0 || Object.keys(granularExpenseGrowth).length > 0;
    const hasYearlyGrowthRates = Object.keys(yearlyGrowthRates).length > 0 || Object.keys(yearlyExpenseGrowth).length > 0;
    
    const { inferDepartment, departmentToAssumptionKey, storageSubcategoryToTypeKey } = await import('../utils/department-mapping');
    
    // Below-the-line assumptions
    const belowTheLine = assumptions.belowTheLine || {};
    const managementFeePct = (belowTheLine.managementFeePct || 0) / 100;
    const capexPct = (belowTheLine.capexPct ?? 2) / 100;
    const capexAmount = belowTheLine.capexAmount || 0;
    const reservesPct = (belowTheLine.reservesPct || 0) / 100;
    const reservesAmount = belowTheLine.reservesAmount || 0;
    
    // Exit assumptions
    const exitAssumptions = assumptions.exitAssumptions || {};
    const sellingFeePct = (exitAssumptions.sellingFeePct ?? 2) / 100;
    const loanExitFeePct = (exitAssumptions.loanExitFeePct || 0) / 100;
    const workingCapitalRecoveryPct = (exitAssumptions.workingCapitalRecoveryPct ?? 100) / 100;
    const workingCapitalAmount = exitAssumptions.workingCapitalAmount || 0;
    
    // ========================================
    // 4. AGGREGATE BASE AMOUNTS FROM ACTUALS (by latest historical year)
    // ========================================
    
    interface ActualEntry { amount: number; category: string; subcategory: string; department?: string; year: number }
    const revenueBySubcat: Record<string, ActualEntry> = {};
    const cogsBySubcat: Record<string, ActualEntry> = {};
    const expensesBySubcat: Record<string, ActualEntry> = {};
    
    const actualsYears = Array.from(new Set(actuals.map(a => a.year))).sort((a, b) => b - a);
    const latestHistoricalYear = actualsYears[0] || baseYear - 1;
    const historicalYears = actualsYears.filter(y => y < baseYear || actualsYears.length === 1 ? true : y <= latestHistoricalYear);

    for (const actual of actuals) {
      if (actual.year !== latestHistoricalYear) continue;
      
      const amount = parseFloat(actual.amount?.toString() || '0');
      const subcat = actual.subcategory || (actual as any).lineItem || 'Other';
      const category = actual.category || 'Other';
      const dept = (actual as any).department || inferDepartment(subcat, category);
      
      if (category === 'Revenue' || (actual as any).isRevenue) {
        if (!revenueBySubcat[subcat]) {
          revenueBySubcat[subcat] = { amount: 0, category, subcategory: subcat, department: dept, year: actual.year };
        }
        revenueBySubcat[subcat].amount += amount;
      } else if (category === 'COGS') {
        if (!cogsBySubcat[subcat]) {
          cogsBySubcat[subcat] = { amount: 0, category, subcategory: subcat, department: dept, year: actual.year };
        }
        cogsBySubcat[subcat].amount += amount;
      } else if (['Expenses', 'Operating Expenses', 'OpEx', 'Payroll'].includes(category)) {
        if (!expensesBySubcat[subcat]) {
          expensesBySubcat[subcat] = { amount: 0, category, subcategory: subcat, department: dept, year: actual.year };
        }
        expensesBySubcat[subcat].amount += amount;
      }
    }

    // ========================================
    // 4b. ENRICH WITH PROFIT CENTERS DATA
    // ========================================
    
    await this.enrichFromProfitCenters(projectId, revenueBySubcat, cogsBySubcat, expensesBySubcat);

    // ========================================
    // 5. VALIDATION: Require actuals or base amounts
    // ========================================
    
    const hasRevenueData = Object.keys(revenueBySubcat).length > 0;
    const hasExpenseData = Object.keys(expensesBySubcat).length > 0 || Object.keys(cogsBySubcat).length > 0;
    
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

    if (hasGranularAssumptions) {
      warnings.push({
        code: 'GRANULAR_ASSUMPTIONS_ACTIVE',
        message: 'Department-level growth rates and occupancy assumptions are being applied.',
        fieldPath: 'assumptions'
      });
    }
    
    // ========================================
    // 6. BUILD MONTHLY PROJECTIONS (Granular)
    // ========================================
    
    const getRevenueGrowthForDept = (department: string, subcategory: string, year?: number): number => {
      const assumptionKey = departmentToAssumptionKey(department);
      
      if (year !== undefined && lineItemOverrides[subcategory]?.[String(year)] !== undefined) {
        return lineItemOverrides[subcategory][String(year)] / 100;
      }
      
      if (year !== undefined && yearlyGrowthRates[String(year)]?.[assumptionKey] !== undefined) {
        return yearlyGrowthRates[String(year)][assumptionKey] / 100;
      }
      
      if (!hasGranularAssumptions) return flatRevenueGrowthRate;
      
      if (department === 'Storage') {
        const storageTypeKey = storageSubcategoryToTypeKey(subcategory);
        if (storageGrowthData.mode === 'per_type' && storageTypeKey && storageGrowthData.typeRates[storageTypeKey] !== undefined) {
          return storageGrowthData.typeRates[storageTypeKey] / 100;
        }
        if (storageGrowthData.mode === 'granular' && storageTypeKey && storageGrowthData.locationRates) {
          const locationRate = Object.entries(storageGrowthData.locationRates)
            .find(([key]) => key.startsWith(storageTypeKey || ''));
          if (locationRate) return locationRate[1] / 100;
        }
        return (storageGrowthData.universalRate ?? flatRevenueGrowthRate * 100) / 100;
      }
      
      if (granularGrowthRates[assumptionKey] !== undefined) {
        return granularGrowthRates[assumptionKey] / 100;
      }
      
      return flatRevenueGrowthRate;
    };
    
    const getExpenseGrowthForCategory = (subcategory: string, department: string, year?: number): number => {
      const key = departmentToAssumptionKey(department);
      
      if (year !== undefined && lineItemOverrides[subcategory]?.[String(year)] !== undefined) {
        return lineItemOverrides[subcategory][String(year)] / 100;
      }
      
      if (year !== undefined && yearlyExpenseGrowth[String(year)]?.[key] !== undefined) {
        return yearlyExpenseGrowth[String(year)][key] / 100;
      }
      
      if (!hasGranularAssumptions) return flatExpenseGrowthRate;
      
      if (granularExpenseGrowth[key] !== undefined) {
        return granularExpenseGrowth[key] / 100;
      }
      
      const lowerSubcat = subcategory.toLowerCase();
      for (const [expKey, rate] of Object.entries(granularExpenseGrowth)) {
        if (lowerSubcat.includes(expKey.replace(/_/g, ' '))) {
          return rate / 100;
        }
      }
      
      return flatExpenseGrowthRate;
    };
    
    const getOccupancyAdjustment = (department: string, subcategory: string, year: number): number => {
      if (department !== 'Storage') return 1.0;
      
      const storageTypeKey = storageSubcategoryToTypeKey(subcategory);
      if (!storageTypeKey || Object.keys(granularOccupancy).length === 0) return 1.0;
      
      const typeOccupancy = granularOccupancy[storageTypeKey];
      if (!typeOccupancy) return 1.0;
      
      const currentOccPct = typeOccupancy[String(year)] ?? 85;
      const baseOccPct = typeOccupancy[String(latestHistoricalYear)] ?? 85;
      
      if (baseOccPct <= 0) return 1.0;
      return currentOccPct / baseOccPct;
    };
    
    const revenueLineItems: LineItem[] = Object.entries(revenueBySubcat).map(([name, data], idx) => {
      const department = data.department || inferDepartment(name, data.category);
      const annualGrowthRate = getRevenueGrowthForDept(department, name);
      const baseMonthly = data.amount / 12;
      const projectionsMonthly: Record<string, number> = {};
      
      let cumulativeGrowth = 1.0;
      let prevYear: number | null = null;
      let currentMonthlyRate = annualToMonthlyRate(annualGrowthRate);
      
      for (const period of monthlyPeriods) {
        if (hasYearlyGrowthRates && period.year !== prevYear) {
          const yearRate = getRevenueGrowthForDept(department, name, period.year);
          currentMonthlyRate = annualToMonthlyRate(yearRate);
          prevYear = period.year;
        }
        
        if (period.index > 0) {
          cumulativeGrowth *= (1 + currentMonthlyRate);
        }
        
        let projectedAmount = baseMonthly * cumulativeGrowth;
        
        const occAdj = getOccupancyAdjustment(department, name, period.year);
        projectedAmount *= occAdj;
        
        projectionsMonthly[period.key] = Math.round(projectedAmount);
      }
      
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
        department,
        baseAmount: data.amount,
        growthRate: annualGrowthRate * 100,
        projections,
        projectionsMonthly,
        isRevenue: true
      };
    });

    const cogsLineItems: LineItem[] = Object.entries(cogsBySubcat).map(([name, data], idx) => {
      const department = data.department || inferDepartment(name, data.category);
      const annualGrowthRate = getExpenseGrowthForCategory(name, department);
      const baseMonthly = data.amount / 12;
      const projectionsMonthly: Record<string, number> = {};
      
      if (granularMargins[departmentToAssumptionKey(department)]) {
        const marginData = granularMargins[departmentToAssumptionKey(department)];
        const projectedMarginPct = marginData.projected / 100;
        const revenueKey = department === 'Fuel' ? 'fuel_dock' : departmentToAssumptionKey(department);
        const matchingRevenue = Object.entries(revenueBySubcat).find(([_, rd]) =>
          departmentToAssumptionKey(rd.department || inferDepartment(rd.subcategory)) === revenueKey
        );
        
        if (matchingRevenue) {
          const revBase = matchingRevenue[1].amount;
          let revCumGrowth = 1.0;
          let revPrevYear: number | null = null;
          let revMonthlyRate = annualToMonthlyRate(getRevenueGrowthForDept(department, matchingRevenue[0]));
          
          for (const period of monthlyPeriods) {
            if (hasYearlyGrowthRates && period.year !== revPrevYear) {
              revMonthlyRate = annualToMonthlyRate(getRevenueGrowthForDept(department, matchingRevenue[0], period.year));
              revPrevYear = period.year;
            }
            if (period.index > 0) revCumGrowth *= (1 + revMonthlyRate);
            const projectedRevMonth = (revBase / 12) * revCumGrowth;
            projectionsMonthly[period.key] = Math.round(projectedRevMonth * (1 - projectedMarginPct));
          }
        } else {
          let cumGrowth = 1.0;
          let pYear: number | null = null;
          let mRate = annualToMonthlyRate(annualGrowthRate);
          for (const period of monthlyPeriods) {
            if (hasYearlyGrowthRates && period.year !== pYear) {
              mRate = annualToMonthlyRate(getExpenseGrowthForCategory(name, department, period.year));
              pYear = period.year;
            }
            if (period.index > 0) cumGrowth *= (1 + mRate);
            projectionsMonthly[period.key] = Math.round(baseMonthly * cumGrowth);
          }
        }
      } else {
        let cumGrowth = 1.0;
        let pYear: number | null = null;
        let mRate = annualToMonthlyRate(annualGrowthRate);
        for (const period of monthlyPeriods) {
          if (hasYearlyGrowthRates && period.year !== pYear) {
            mRate = annualToMonthlyRate(getExpenseGrowthForCategory(name, department, period.year));
            pYear = period.year;
          }
          if (period.index > 0) cumGrowth *= (1 + mRate);
          projectionsMonthly[period.key] = Math.round(baseMonthly * cumGrowth);
        }
      }
      
      const projections = annualPeriods.map(year => {
        return year.monthIndices.reduce((sum, mi) => {
          const period = monthlyPeriods[mi];
          return sum + (projectionsMonthly[period.key] || 0);
        }, 0);
      });
      
      return {
        id: `cogs-${idx}`,
        name,
        category: data.category,
        subcategory: data.subcategory,
        department,
        baseAmount: data.amount,
        growthRate: annualGrowthRate * 100,
        projections,
        projectionsMonthly,
        isRevenue: false
      };
    });

    const expenseLineItems: LineItem[] = Object.entries(expensesBySubcat).map(([name, data], idx) => {
      const department = data.department || inferDepartment(name, data.category);
      const annualGrowthRate = getExpenseGrowthForCategory(name, department);
      const baseMonthly = data.amount / 12;
      const projectionsMonthly: Record<string, number> = {};
      
      if (granularMargins[departmentToAssumptionKey(department)]) {
        const marginData = granularMargins[departmentToAssumptionKey(department)];
        const projectedMarginPct = marginData.projected / 100;
        const revenueKey = department === 'Fuel' ? 'fuel_dock' : 'ship_store';
        const matchingRevenue = Object.entries(revenueBySubcat).find(([_, rd]) =>
          departmentToAssumptionKey(rd.department || inferDepartment(rd.subcategory)) === revenueKey
        );
        
        if (matchingRevenue) {
          const revBase = matchingRevenue[1].amount;
          let revCumGrowth = 1.0;
          let revPrevYear: number | null = null;
          let revMonthlyRate = annualToMonthlyRate(getRevenueGrowthForDept(department, matchingRevenue[0]));
          
          for (const period of monthlyPeriods) {
            if (hasYearlyGrowthRates && period.year !== revPrevYear) {
              revMonthlyRate = annualToMonthlyRate(getRevenueGrowthForDept(department, matchingRevenue[0], period.year));
              revPrevYear = period.year;
            }
            if (period.index > 0) revCumGrowth *= (1 + revMonthlyRate);
            const projectedRevMonth = (revBase / 12) * revCumGrowth;
            projectionsMonthly[period.key] = Math.round(projectedRevMonth * (1 - projectedMarginPct));
          }
        } else {
          let cumGrowth = 1.0;
          let pYear: number | null = null;
          let mRate = annualToMonthlyRate(annualGrowthRate);
          for (const period of monthlyPeriods) {
            if (hasYearlyGrowthRates && period.year !== pYear) {
              mRate = annualToMonthlyRate(getExpenseGrowthForCategory(name, department, period.year));
              pYear = period.year;
            }
            if (period.index > 0) cumGrowth *= (1 + mRate);
            projectionsMonthly[period.key] = Math.round(baseMonthly * cumGrowth);
          }
        }
      } else {
        let cumGrowth = 1.0;
        let pYear: number | null = null;
        let mRate = annualToMonthlyRate(annualGrowthRate);
        for (const period of monthlyPeriods) {
          if (hasYearlyGrowthRates && period.year !== pYear) {
            mRate = annualToMonthlyRate(getExpenseGrowthForCategory(name, department, period.year));
            pYear = period.year;
          }
          if (period.index > 0) cumGrowth *= (1 + mRate);
          projectionsMonthly[period.key] = Math.round(baseMonthly * cumGrowth);
        }
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
        department,
        baseAmount: data.amount,
        growthRate: annualGrowthRate * 100,
        projections,
        projectionsMonthly,
        isRevenue: false
      };
    });

    // ========================================
    // 7. AGGREGATE TOTALS (Monthly + Annual)
    // ========================================
    
    const revenueTotalsMonthly: Record<string, number> = {};
    const cogsTotalsMonthly: Record<string, number> = {};
    const grossProfitMonthly: Record<string, number> = {};
    const expenseTotalsMonthly: Record<string, number> = {};
    const noiMonthly: Record<string, number> = {};
    const capexMonthly: Record<string, number> = {};
    const managementFeeMonthly: Record<string, number> = {};
    const reservesMonthly: Record<string, number> = {};
    const debtServiceMonthly: Record<string, number> = {};
    const leveredCashFlowMonthly: Record<string, number> = {};
    const cashFlowMonthly: Record<string, number> = {};
    
    for (const period of monthlyPeriods) {
      const revTotal = revenueLineItems.reduce((sum, item) => sum + (item.projectionsMonthly[period.key] || 0), 0);
      const cogsTotal = cogsLineItems.reduce((sum, item) => sum + (item.projectionsMonthly[period.key] || 0), 0);
      const expTotal = expenseLineItems.reduce((sum, item) => sum + (item.projectionsMonthly[period.key] || 0), 0);
      
      const gp = revTotal - cogsTotal;
      const noiVal = gp - expTotal;
      const mgmtFee = Math.round(revTotal * managementFeePct);
      const capexVal = capexAmount > 0 ? Math.round(capexAmount / 12) : Math.round(revTotal * capexPct);
      const reserveVal = reservesAmount > 0 ? Math.round(reservesAmount / 12) : Math.round(revTotal * reservesPct);
      const debtSvc = 0; // Will be updated after debt integration
      const levCf = noiVal - mgmtFee - capexVal - reserveVal - debtSvc;
      
      revenueTotalsMonthly[period.key] = revTotal;
      cogsTotalsMonthly[period.key] = cogsTotal;
      grossProfitMonthly[period.key] = gp;
      expenseTotalsMonthly[period.key] = expTotal;
      noiMonthly[period.key] = noiVal;
      capexMonthly[period.key] = capexVal;
      managementFeeMonthly[period.key] = mgmtFee;
      reservesMonthly[period.key] = reserveVal;
      debtServiceMonthly[period.key] = debtSvc;
      leveredCashFlowMonthly[period.key] = levCf;
      cashFlowMonthly[period.key] = levCf;
    }
    
    // Annual rollups
    const revenueTotals = annualPeriods.map(year => 
      year.monthIndices.reduce((sum, mi) => sum + (revenueTotalsMonthly[monthlyPeriods[mi].key] || 0), 0)
    );
    
    const cogsTotals = annualPeriods.map(year =>
      year.monthIndices.reduce((sum, mi) => sum + (cogsTotalsMonthly[monthlyPeriods[mi].key] || 0), 0)
    );
    
    const grossProfit = revenueTotals.map((rev, i) => rev - cogsTotals[i]);
    
    const expenseTotals = annualPeriods.map(year => 
      year.monthIndices.reduce((sum, mi) => sum + (expenseTotalsMonthly[monthlyPeriods[mi].key] || 0), 0)
    );
    
    const noi = grossProfit.map((gp, i) => gp - expenseTotals[i]);
    const capex = annualPeriods.map(year =>
      year.monthIndices.reduce((sum, mi) => sum + (capexMonthly[monthlyPeriods[mi].key] || 0), 0)
    );
    const managementFeeArr = annualPeriods.map(year =>
      year.monthIndices.reduce((sum, mi) => sum + (managementFeeMonthly[monthlyPeriods[mi].key] || 0), 0)
    );
    const reservesArr = annualPeriods.map(year =>
      year.monthIndices.reduce((sum, mi) => sum + (reservesMonthly[monthlyPeriods[mi].key] || 0), 0)
    );
    const debtServiceArr = annualPeriods.map(() => 0); // Updated after debt integration
    const leveredCashFlow = annualPeriods.map(year =>
      year.monthIndices.reduce((sum, mi) => sum + (leveredCashFlowMonthly[monthlyPeriods[mi].key] || 0), 0)
    );
    const cashFlow = leveredCashFlow.slice(); // Backward compat
    const noiBelowLine = annualPeriods.map((_, i) => managementFeeArr[i] + capex[i] + reservesArr[i] + debtServiceArr[i]);
    
    // ========================================
    // 8. BUILD PROJECTION DETAIL ARRAYS
    // ========================================
    
    const monthlyProjections: MonthlyProjection[] = monthlyPeriods.map(period => ({
      periodKey: period.key,
      periodIndex: period.index,
      year: period.year,
      month: period.month,
      revenue: revenueTotalsMonthly[period.key] || 0,
      cogs: cogsTotalsMonthly[period.key] || 0,
      grossProfit: grossProfitMonthly[period.key] || 0,
      expenses: expenseTotalsMonthly[period.key] || 0,
      noi: noiMonthly[period.key] || 0,
      capex: capexMonthly[period.key] || 0,
      cashFlow: cashFlowMonthly[period.key] || 0,
      managementFee: managementFeeMonthly[period.key] || 0,
      reserves: reservesMonthly[period.key] || 0,
      debtService: debtServiceMonthly[period.key] || 0,
      leveredCashFlow: leveredCashFlowMonthly[period.key] || 0,
    }));
    
    const annualProjections: AnnualProjection[] = annualPeriods.map((year, i) => ({
      year: year.year,
      yearIndex: year.yearIndex,
      label: year.label,
      revenue: revenueTotals[i] || 0,
      cogs: cogsTotals[i] || 0,
      grossProfit: grossProfit[i] || 0,
      expenses: expenseTotals[i] || 0,
      noi: noi[i] || 0,
      capex: capex[i] || 0,
      cashFlow: cashFlow[i] || 0,
      managementFee: managementFeeArr[i] || 0,
      reserves: reservesArr[i] || 0,
      debtService: debtServiceArr[i] || 0,
      leveredCashFlow: leveredCashFlow[i] || 0,
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
    
    // Stabilized NOI calculation
    const stabilizedNoiPeriodIndex = getStabilizedNoiPeriodIndex(
      stabilizedNoiMode,
      { fixedYear: stabilizedNoiYear },
      monthlyPeriods
    );
    
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
          dscrMetrics = debtScheduleService.calculateDSCR(noiMonthly, debtSchedule);
          minDscr = dscrMetrics.minDscr;
          avgDscr = dscrMetrics.avgDscr;
          
          totalDebtService = Object.values(debtSchedule.annualDebtService).reduce((a, b) => a + b, 0);
          
          debtYield = debtScheduleService.calculateDebtYield(year1Noi, debtSchedule.totalDebtAtClose);
          ltv = purchasePrice > 0 ? (debtSchedule.totalDebtAtClose / purchasePrice) * 100 : 0;
          
          // Update monthly and annual debt service + levered cash flow
          for (const period of monthlyPeriods) {
            const ds = debtScheduleService.getDebtServiceForPeriod(debtSchedule, period.key);
            debtServiceMonthly[period.key] = Math.round(ds.payment);
            const noiVal = noiMonthly[period.key] || 0;
            const mgmtFee = managementFeeMonthly[period.key] || 0;
            const capexVal = capexMonthly[period.key] || 0;
            const reserveVal = reservesMonthly[period.key] || 0;
            const newLevCf = noiVal - mgmtFee - capexVal - reserveVal - Math.round(ds.payment);
            leveredCashFlowMonthly[period.key] = newLevCf;
            cashFlowMonthly[period.key] = newLevCf;
          }
          
          // Recompute annual rollups with debt service
          for (let i = 0; i < annualPeriods.length; i++) {
            const year = annualPeriods[i];
            debtServiceArr[i] = year.monthIndices.reduce((sum, mi) => sum + (debtServiceMonthly[monthlyPeriods[mi].key] || 0), 0);
            leveredCashFlow[i] = year.monthIndices.reduce((sum, mi) => sum + (leveredCashFlowMonthly[monthlyPeriods[mi].key] || 0), 0);
            cashFlow[i] = leveredCashFlow[i];
            noiBelowLine[i] = managementFeeArr[i] + capex[i] + reservesArr[i] + debtServiceArr[i];
          }
          
          // Update projection detail arrays with debt service
          for (const mp of monthlyProjections) {
            mp.debtService = debtServiceMonthly[mp.periodKey] || 0;
            mp.leveredCashFlow = leveredCashFlowMonthly[mp.periodKey] || 0;
            mp.cashFlow = cashFlowMonthly[mp.periodKey] || 0;
          }
          for (let i = 0; i < annualProjections.length; i++) {
            annualProjections[i].debtService = debtServiceArr[i] || 0;
            annualProjections[i].leveredCashFlow = leveredCashFlow[i] || 0;
            annualProjections[i].cashFlow = cashFlow[i] || 0;
          }
        }
      }
    } catch (debtError) {
      console.warn('Debt integration skipped:', debtError);
    }
    
    // ========================================
    // 9b. EXIT WATERFALL & IRR CALCULATION
    // ========================================
    
    // Exit waterfall
    const sellingFees = Math.round(exitValue * sellingFeePct);
    const lastScheduleEntry = debtSchedule?.schedule?.[debtSchedule.schedule.length - 1];
    const loanPayoff = Math.round(lastScheduleEntry?.totalBalance || 0);
    const loanExitFees = Math.round(loanPayoff * loanExitFeePct);
    const workingCapitalRecovery = Math.round(workingCapitalAmount * workingCapitalRecoveryPct);
    const netExitProceeds = exitValue - sellingFees - loanPayoff - loanExitFees + workingCapitalRecovery;
    
    // IRR calculation using monthly levered cash flows
    const totalEquityInvested = purchasePrice + workingCapitalAmount;
    const monthlyCashFlows = [-totalEquityInvested];
    for (let i = 0; i < monthlyPeriods.length; i++) {
      const period = monthlyPeriods[i];
      let cf = leveredCashFlowMonthly[period.key] || 0;
      
      if (i === monthlyPeriods.length - 1) {
        cf += netExitProceeds;
      }
      
      monthlyCashFlows.push(cf);
    }
    
    const monthlyIrr = this.calculateIRR(monthlyCashFlows, 0.01);
    const annualizedIrr = monthlyIrrToAnnualized(monthlyIrr / 100) * 100;
    
    // Total return & equity multiple
    const totalDistributions = monthlyCashFlows.slice(1).reduce((sum, cf) => sum + cf, 0);
    const equityMultiple = totalEquityInvested > 0 ? (totalDistributions / totalEquityInvested) : 0;
    
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
      latestHistoricalYear,
      granularAssumptionsApplied: hasGranularAssumptions,
      
      revenue: {
        lineItems: revenueLineItems,
        totals: revenueTotals,
        totalsMonthly: revenueTotalsMonthly
      },
      
      cogs: {
        lineItems: cogsLineItems,
        totals: cogsTotals,
        totalsMonthly: cogsTotalsMonthly
      },
      
      grossProfit,
      grossProfitMonthly,
      
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
      
      managementFee: managementFeeArr,
      managementFeeMonthly,
      reserves: reservesArr,
      reservesMonthly,
      debtService: debtServiceArr,
      debtServiceMonthly,
      leveredCashFlow,
      leveredCashFlowMonthly,
      
      monthlyProjections,
      annualProjections,
      
      metrics: {
        goingInCapRate,
        exitCapRate: exitCapRate * 100,
        revenueGrowthRate: flatRevenueGrowthRate * 100,
        expenseGrowthRate: flatExpenseGrowthRate * 100,
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
        // Exit waterfall
        netExitProceeds,
        sellingFees,
        loanPayoff,
        loanExitFees,
        workingCapitalRecovery,
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
   * Enrich revenue/expense maps with data from Profit Centers assumptions tables.
   * Annualizes monthly assumptions data and merges into existing actuals-based aggregation.
   * Only adds data for modules that have assumption rows — does not overwrite actuals.
   */
  private async enrichFromProfitCenters(
    projectId: string,
    revenueBySubcat: Record<string, { amount: number; category: string; subcategory: string; department?: string }>,
    cogsBySubcat: Record<string, { amount: number; category: string; subcategory: string; department?: string }>,
    expensesBySubcat: Record<string, { amount: number; category: string; subcategory: string; department?: string }>
  ): Promise<void> {
    const addRevenue = (name: string, amount: number, dept?: string) => {
      if (amount <= 0) return;
      const key = `PC: ${name}`;
      if (!revenueBySubcat[key]) {
        revenueBySubcat[key] = { amount: 0, category: 'Revenue', subcategory: key, department: dept };
      }
      revenueBySubcat[key].amount += amount;
    };

    const addCOGS = (name: string, amount: number, dept?: string) => {
      if (amount <= 0) return;
      const key = `PC: ${name} COGS`;
      if (!cogsBySubcat[key]) {
        cogsBySubcat[key] = { amount: 0, category: 'COGS', subcategory: key, department: dept };
      }
      cogsBySubcat[key].amount += amount;
    };

    try {
      const [fuelRows, storeRows, serviceRows, rentalRows, clubRows, salesRows, tenantRows, bkRows] = await Promise.all([
        db.select().from(asmpFuel).where(eq(asmpFuel.projectId, projectId)),
        db.select().from(asmpShipStore).where(eq(asmpShipStore.projectId, projectId)),
        db.select().from(asmpService).where(eq(asmpService.projectId, projectId)),
        db.select().from(asmpBoatRentals).where(eq(asmpBoatRentals.projectId, projectId)),
        db.select().from(asmpBoatClub).where(eq(asmpBoatClub.projectId, projectId)),
        db.select().from(asmpBoatSales).where(eq(asmpBoatSales.projectId, projectId)),
        db.select().from(asmpCommercialTenants).where(eq(asmpCommercialTenants.projectId, projectId)),
        db.select().from(asmpBookkeeping).where(eq(asmpBookkeeping.projectId, projectId)),
      ]);

      if (fuelRows.length > 0) {
        const totalRev = fuelRows.reduce((s, r) => s + Number(r.revenue || 0), 0);
        const totalCogs = fuelRows.reduce((s, r) => s + Number(r.cogs || 0), 0);
        addRevenue('Fuel Sales', totalRev, 'Fuel');
        addCOGS('Fuel Sales', totalCogs, 'Fuel');
      }

      if (storeRows.length > 0) {
        const totalRev = storeRows.reduce((s, r) => s + Number(r.revenue || 0), 0);
        const totalCogs = storeRows.reduce((s, r) => s + Number(r.cogs || 0), 0);
        addRevenue('Ship Store', totalRev, 'Ship Store');
        addCOGS('Ship Store', totalCogs, 'Ship Store');
      }

      if (serviceRows.length > 0) {
        const totalRev = serviceRows.reduce((s, r) => s + Number(r.totalRevenue || 0), 0);
        const totalCogs = serviceRows.reduce((s, r) => s + Number(r.cogs || 0), 0);
        addRevenue('Service Department', totalRev, 'Service');
        addCOGS('Service Department', totalCogs, 'Service');
      }

      if (rentalRows.length > 0) {
        const totalRev = rentalRows.reduce((s, r) => s + Number(r.revenue || 0), 0);
        addRevenue('Boat Rentals', totalRev, 'Boat Rentals');
      }

      if (clubRows.length > 0) {
        const totalRev = clubRows.reduce((s, r) => s + Number(r.monthlyRecurringRevenue || 0), 0);
        addRevenue('Boat Club', totalRev, 'Boat Club');
      }

      if (salesRows.length > 0) {
        const totalRev = salesRows.reduce((s, r) => s + Number(r.revenue || 0), 0);
        const totalCogs = salesRows.reduce((s, r) => s + Number(r.cogs || 0), 0);
        addRevenue('Boat Sales', totalRev, 'Boat Sales');
        addCOGS('Boat Sales', totalCogs, 'Boat Sales');
      }

      if (tenantRows.length > 0) {
        const totalRev = tenantRows.reduce((s, r) => s + Number(r.totalRevenue || 0), 0);
        addRevenue('Commercial Tenants', totalRev, 'Commercial');
      }

      if (bkRows.length > 0) {
        const totalRevOverride = bkRows.reduce((s, r) => s + Number(r.revenueTotalOverride || 0), 0);
        const totalExpOverride = bkRows.reduce((s, r) => s + Number(r.expenseTotalOverride || 0), 0);
        if (totalRevOverride > 0) addRevenue('Bookkeeping Revenue', totalRevOverride, 'Bookkeeping');
        if (totalExpOverride > 0) addCOGS('Bookkeeping Expenses', totalExpOverride, 'Bookkeeping');
      }
    } catch (err) {
      console.warn('Profit Centers enrichment skipped:', err);
    }
  }

  /**
   * Calculate IRR using Newton-Raphson method.
   * Works for both monthly and annual cash flows.
   */
  private calculateIRR(cashFlows: number[], guess: number = 0.1): number {
    const maxIterations = 100;
    const precision = 0.00001;
    let rate = guess;

    if (cashFlows.length < 2) return 0;
    if (cashFlows[0] >= 0) return 0;
    
    const totalInflows = cashFlows.slice(1).reduce((sum, cf) => sum + cf, 0);
    if (totalInflows <= 0) return -100;

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
    const cogsItems: any[] = [];
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
      } else if (categories[name] === 'COGS') {
        cogsItems.push(item);
      } else {
        expenseItems.push(item);
      }
    }

    const totalRevenue = revenueItems.reduce((sum, item) => sum + item.total, 0);
    const totalCOGS = cogsItems.reduce((sum, item) => sum + item.total, 0);
    const totalExpenses = expenseItems.reduce((sum, item) => sum + item.total, 0);
    const grossProfit = totalRevenue - totalCOGS;
    const netNoi = grossProfit - totalExpenses;

    return {
      year: year || new Date().getFullYear(),
      revenue: {
        lineItems: revenueItems,
        total: totalRevenue
      },
      cogs: {
        lineItems: cogsItems,
        total: totalCOGS
      },
      grossProfit,
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
