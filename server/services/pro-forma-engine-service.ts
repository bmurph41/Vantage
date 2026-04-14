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

import Decimal from 'decimal.js';
import { db } from '../db';
import { calculateXIRR, type DatedCashFlow } from '../utils/financial-calculations';
import { 
  modelingProjects,
  modelingScenarioVersions,
  modelingActuals,
  modelingProjectConfig,
  seasonalityProfiles,
  seasonalityProfileMonths,
  capitalStacks,
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
import { generateCanonicalDebtSchedule } from './canonical-debt-adapter';
import {
  buildModelingPeriods,
  buildT12AwarePeriods,
  annualToMonthlyRate,
  getStabilizedNoiPeriodIndex,
  type TimelineConfig,
  type MonthlyPeriod,
  type AnnualPeriod,
  type ProjectionStartRule,
  type StabilizedNoiMode,
  type IrrDisplayPreference,
  type Year1Mode,
  type T12Context
} from '../utils/modeling-periods';
import { loadCanonicalActuals } from './canonical-actuals-loader';
import { computeDirectInputFinancials } from './direct-input-engine';

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
  cashFlowBeforeDebtService: number;
  leveredCashFlow: number;
  isActual?: boolean;
  isForecast?: boolean;
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
  cashFlowBeforeDebtService: number;
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
    t12Context?: T12Context;
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
  cashFlowBeforeDebtService: number[];
  cashFlowBeforeDebtServiceMonthly: Record<string, number>;
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
    irr: number;  // Levered XIRR-based annualized IRR as percentage (e.g., 15 for 15%)
    irrAnnualized: number;  // Same as irr (always XIRR annualized)
    irrDisplayPreference: IrrDisplayPreference;
    unleveredIrr: number;  // Unlevered XIRR - IRR on total purchase price using pre-debt cash flows
    equityMultiple: number;
    unleveredEquityMultiple: number;  // Equity multiple on total investment (no leverage)
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

    const allActuals = await db.select()
      .from(modelingActuals)
      .where(eq(modelingActuals.modelingProjectId, projectId));

    const { modelingPnlOverrides } = await import('@shared/schema');
    const pnlOverrides = await db.select()
      .from(modelingPnlOverrides)
      .where(and(eq(modelingPnlOverrides.projectId, projectId), eq(modelingPnlOverrides.orgId, orgId)));
    const excludeSet = new Set(
      pnlOverrides.filter(o => o.overrideType === 'exclude' && o.isActive).map(o => o.lineItemKey)
    );
    const deptOverrideMap: Record<string, string> = {};
    pnlOverrides.filter(o => o.overrideType === 'department' && o.isActive && o.overrideDepartment)
      .forEach(o => { deptOverrideMap[o.lineItemKey] = o.overrideDepartment!; });
    const categoryOverrideMap: Record<string, string> = {};
    pnlOverrides.filter(o => o.overrideType === 'department' && o.isActive && o.overrideCategory)
      .forEach(o => { categoryOverrideMap[o.lineItemKey] = o.overrideCategory!; });
    const actuals = allActuals
      .filter(a => !excludeSet.has(a.subcategory || ''))
      .map(a => {
        const catOverride = categoryOverrideMap[a.subcategory || ''];
        if (catOverride) {
          return { ...a, category: catOverride };
        }
        return a;
      });
    
    // ========================================
    // 2. BUILD TIMELINE (no more hardcoded years!)
    // ========================================
    
    const projectConfig = (project.customMetrics as any)?.config || {};
    const effectiveHoldPeriod = projectConfig.holdPeriod || config?.holdPeriod || 5;
    
    const { docIntelUploads, modelingDisplayPreferences } = await import('@shared/schema');
    
    const t12Docs = await db.select()
      .from(docIntelUploads)
      .where(and(
        eq(docIntelUploads.modelingProjectId, projectId),
        eq(docIntelUploads.isT12, true)
      ));
    
    const latestT12 = t12Docs
      .filter(d => d.periodMetadata?.t12StartMonth && d.periodMetadata?.t12EndMonth)
      .sort((a, b) => {
        const aEnd = (a.periodMetadata?.t12EndYear || 0) * 12 + (a.periodMetadata?.t12EndMonth || 0);
        const bEnd = (b.periodMetadata?.t12EndYear || 0) * 12 + (b.periodMetadata?.t12EndMonth || 0);
        return bEnd - aEnd;
      })[0];
    
    let t12Context: T12Context | undefined;
    
    if (latestT12?.periodMetadata) {
      const pm = latestT12.periodMetadata;
      const [orgPrefs] = await db.select()
        .from(modelingDisplayPreferences)
        .where(eq(modelingDisplayPreferences.orgId, orgId))
        .limit(1);
      
      const year1Mode = ((orgPrefs as any)?.year1Mode as Year1Mode) || 'calendar_year_end';
      
      t12Context = {
        t12StartMonth: pm.t12StartMonth!,
        t12StartYear: pm.t12StartYear!,
        t12EndMonth: pm.t12EndMonth!,
        t12EndYear: pm.t12EndYear!,
        year1Mode,
      };
    }
    
    const timelineConfig: TimelineConfig = {
      acquisitionCloseDate: config?.acquisitionCloseDate || projectConfig.acquisitionCloseDate || null,
      ttmEndDate: config?.ttmEndDate || projectConfig.ttmEndDate || null,
      projectionStartRule: (config?.projectionStartRule as ProjectionStartRule) || 'acq_close_year',
      holdPeriodMonths: effectiveHoldPeriod * 12,
      holdPeriodYears: effectiveHoldPeriod,
      t12Context,
    };
    
    const periods = t12Context ? buildT12AwarePeriods(timelineConfig) : buildModelingPeriods(timelineConfig);
    const { monthlyPeriods, annualPeriods, projectionStartDate, projectionEndDate } = periods;
    
    // Legacy compatibility: extract years array
    const years = annualPeriods.map(p => p.year);
    const baseYear = years[0] || new Date().getFullYear();
    const holdPeriod = annualPeriods.length;
    
    // ========================================
    // 3. PARSE SCENARIO ASSUMPTIONS (Granular)
    // ========================================
    
    const flatRevenueGrowthRate = new Decimal(scenario?.revenueGrowthRate?.toString() || '3').dividedBy(100);
    const flatExpenseGrowthRate = new Decimal(scenario?.expenseGrowthRate?.toString() || '2.5').dividedBy(100);
    const exitCapRate = new Decimal(scenario?.exitCapRate?.toString() || '7.5').dividedBy(100);
    const purchasePrice = new Decimal(project.purchasePrice?.toString() || '0');
    
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
    } = assumptions.storageGrowth || { mode: 'universal', universalRate: flatRevenueGrowthRate.times(100).toNumber(), typeRates: {}, locationRates: {} };
    
    const yearlyGrowthRates: Record<string, Record<string, number>> = assumptions.yearlyGrowthRates?.revenue || {};
    const yearlyExpenseGrowth: Record<string, Record<string, number>> = assumptions.yearlyGrowthRates?.expenses || {};
    const lineItemOverrides: Record<string, Record<string, number>> = assumptions.lineItemOverrides || {};
    
    const hasGranularAssumptions = Object.keys(granularGrowthRates).length > 0 || Object.keys(granularExpenseGrowth).length > 0;
    const hasYearlyGrowthRates = Object.keys(yearlyGrowthRates).length > 0 || Object.keys(yearlyExpenseGrowth).length > 0;
    
    const { inferDepartment, departmentToAssumptionKey, storageSubcategoryToTypeKey } = await import('../utils/department-mapping');
    
    // Below-the-line assumptions
    // belowTheLineBasis: 'revenue' (default, industry standard) or 'noi'
    // - 'revenue': management fee, capex reserves as % of gross revenue
    // - 'noi': management fee, capex reserves as % of NOI
    const belowTheLine = assumptions.belowTheLine || {};
    const belowTheLineBasis: 'revenue' | 'noi' = belowTheLine.basis || 'revenue';
    const managementFeePct = new Decimal(belowTheLine.managementFeePct || 0).dividedBy(100);
    const capexPct = new Decimal(belowTheLine.capexPct ?? 2).dividedBy(100);
    const capexAmount = new Decimal(belowTheLine.capexAmount || 0);
    const reservesPct = new Decimal(belowTheLine.reservesPct || 0).dividedBy(100);
    const reservesAmount = new Decimal(belowTheLine.reservesAmount || 0);
    
    // Above/below line position for each item (default: 'below' = after NOI)
    const mgmtFeeLinePos: 'above' | 'below' = belowTheLine.managementFeeLinePosition || 'below';
    const capexLinePos: 'above' | 'below' = belowTheLine.capexLinePosition || 'below';
    const reservesLinePos: 'above' | 'below' = belowTheLine.reservesLinePosition || 'below';
    
    // Exit assumptions
    const exitAssumptions = assumptions.exitAssumptions || {};
    const sellingFeePct = new Decimal(exitAssumptions.sellingFeePct ?? 2).dividedBy(100);
    const loanExitFeePct = new Decimal(exitAssumptions.loanExitFeePct || 0).dividedBy(100);

    // Property tax assumptions
    const propertyTaxConfig = assumptions.propertyTax || null;
    const workingCapitalRecoveryPct = new Decimal(exitAssumptions.workingCapitalRecoveryPct ?? 100).dividedBy(100);
    const workingCapitalAmount = new Decimal(exitAssumptions.workingCapitalAmount || 0);
    
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

    // FIX: Use shared canonical actuals loader for baseline aggregation.
    // Guarantees identical category/department as getHistoricalPL().
    const { items: baselineItems } = await loadCanonicalActuals(projectId, orgId, latestHistoricalYear);
    
    for (const item of baselineItems) {
      const entry: ActualEntry = {
        amount: item.total,
        category: item.category,
        subcategory: item.key,
        department: item.department,
        year: latestHistoricalYear,
      };
      
      if (item.category === 'Revenue') {
        revenueBySubcat[item.key] = entry;
      } else if (item.category === 'COGS') {
        cogsBySubcat[item.key] = entry;
      } else {
        expensesBySubcat[item.key] = entry;
      }
    }

    // ========================================
    // 4b. ENRICH WITH PROFIT CENTERS DATA
    // ========================================
    
    await this.enrichFromProfitCenters(projectId, revenueBySubcat, cogsBySubcat, expensesBySubcat);

    // ========================================
    // 4c. DIRECT INPUT FALLBACK
    // If no uploaded actuals, check for direct-input assumptions
    // Modes: direct_input = use only computed, auto = fallback if no actuals,
    //        hybrid = merge computed lines that don't exist from actuals
    // ========================================
    const inputMode = (project as any).modelInputMode || 'auto';
    const inputAssumptions = (project.customMetrics as any)?.inputAssumptions;
    const hasUploadedActuals = Object.keys(revenueBySubcat).length > 0 || Object.keys(expensesBySubcat).length > 0;
    const hasInputAssumptions = inputAssumptions && Object.keys(inputAssumptions).length > 0;

    const shouldUseDirectInput =
      (inputMode === 'direct_input' && hasInputAssumptions) ||
      (inputMode === 'auto' && !hasUploadedActuals && hasInputAssumptions);

    if (shouldUseDirectInput) {
      const assetClass = (project as any).assetClass || 'marina';
      const directResult = computeDirectInputFinancials(assetClass, inputAssumptions);
      if (directResult) {
        for (const line of directResult.revenueLines) {
          revenueBySubcat[line.label] = {
            amount: line.amount,
            category: 'Revenue',
            subcategory: line.label,
            department: 'Revenue',
            year: latestHistoricalYear,
          };
        }
        for (const line of directResult.expenseLines) {
          expensesBySubcat[line.label] = {
            amount: line.amount,
            category: 'Expense',
            subcategory: line.label,
            department: 'Operating Expenses',
            year: latestHistoricalYear,
          };
        }
      }
    } else if (inputMode === 'hybrid' && hasInputAssumptions) {
      // Hybrid: only add direct-input lines that DON'T already exist from actuals
      const assetClass = (project as any).assetClass || 'marina';
      const directResult = computeDirectInputFinancials(assetClass, inputAssumptions);
      if (directResult) {
        for (const line of directResult.revenueLines) {
          if (!revenueBySubcat[line.label]) {
            revenueBySubcat[line.label] = {
              amount: line.amount,
              category: 'Revenue',
              subcategory: line.label,
              department: 'Revenue',
              year: latestHistoricalYear,
            };
          }
        }
        for (const line of directResult.expenseLines) {
          if (!expensesBySubcat[line.label]) {
            expensesBySubcat[line.label] = {
              amount: line.amount,
              category: 'Expense',
              subcategory: line.label,
              department: 'Operating Expenses',
              year: latestHistoricalYear,
            };
          }
        }
      }
    }


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
    
    const getRevenueGrowthForDept = (department: string, subcategory: string, year?: number): Decimal => {
      const assumptionKey = departmentToAssumptionKey(department);

      if (year !== undefined && lineItemOverrides[subcategory]?.[String(year)] !== undefined) {
        return new Decimal(lineItemOverrides[subcategory][String(year)]).dividedBy(100);
      }

      if (year !== undefined && yearlyGrowthRates[String(year)]?.[assumptionKey] !== undefined) {
        return new Decimal(yearlyGrowthRates[String(year)][assumptionKey]).dividedBy(100);
      }

      if (!hasGranularAssumptions) return flatRevenueGrowthRate;

      if (department === 'Storage') {
        const storageTypeKey = storageSubcategoryToTypeKey(subcategory);
        if (storageGrowthData.mode === 'per_type' && storageTypeKey && storageGrowthData.typeRates[storageTypeKey] !== undefined) {
          return new Decimal(storageGrowthData.typeRates[storageTypeKey]).dividedBy(100);
        }
        if (storageGrowthData.mode === 'granular' && storageTypeKey && storageGrowthData.locationRates) {
          const locationRate = Object.entries(storageGrowthData.locationRates)
            .find(([key]) => key.startsWith(storageTypeKey || ''));
          if (locationRate) return new Decimal(locationRate[1]).dividedBy(100);
        }
        return new Decimal(storageGrowthData.universalRate ?? flatRevenueGrowthRate.times(100).toNumber()).dividedBy(100);
      }

      if (granularGrowthRates[assumptionKey] !== undefined) {
        return new Decimal(granularGrowthRates[assumptionKey]).dividedBy(100);
      }

      return flatRevenueGrowthRate;
    };
    
    const getExpenseGrowthForCategory = (subcategory: string, department: string, year?: number): Decimal => {
      const key = departmentToAssumptionKey(department);

      if (year !== undefined && lineItemOverrides[subcategory]?.[String(year)] !== undefined) {
        return new Decimal(lineItemOverrides[subcategory][String(year)]).dividedBy(100);
      }

      if (year !== undefined && yearlyExpenseGrowth[String(year)]?.[key] !== undefined) {
        return new Decimal(yearlyExpenseGrowth[String(year)][key]).dividedBy(100);
      }

      if (!hasGranularAssumptions) return flatExpenseGrowthRate;

      if (granularExpenseGrowth[key] !== undefined) {
        return new Decimal(granularExpenseGrowth[key]).dividedBy(100);
      }

      const lowerSubcat = subcategory.toLowerCase();
      for (const [expKey, rate] of Object.entries(granularExpenseGrowth)) {
        if (lowerSubcat.includes(expKey.replace(/_/g, ' '))) {
          return new Decimal(rate).dividedBy(100);
        }
      }

      return flatExpenseGrowthRate;
    };
    
    const getOccupancyAdjustment = (department: string, subcategory: string, year: number): Decimal => {
      if (department !== 'Storage') return new Decimal(1);

      const storageTypeKey = storageSubcategoryToTypeKey(subcategory);
      if (!storageTypeKey || Object.keys(granularOccupancy).length === 0) return new Decimal(1);

      const typeOccupancy = granularOccupancy[storageTypeKey];
      if (!typeOccupancy) return new Decimal(1);

      const currentOccPct = new Decimal(typeOccupancy[String(year)] ?? 85);
      const baseOccPct = new Decimal(typeOccupancy[String(latestHistoricalYear)] ?? 85);

      if (baseOccPct.lte(0)) return new Decimal(1);
      return currentOccPct.dividedBy(baseOccPct);
    };
    
    const actualsMonthlyLookup: Record<string, Record<string, number>> = {};
    const actualsMonthsPerYearPerSubcat: Record<string, Record<number, Set<number>>> = {};
    for (const actual of actuals) {
      const subcat = actual.subcategory || actual.category || 'Other';
      const key = `${actual.year}-${String(actual.month).padStart(2, '0')}`;
      if (!actualsMonthlyLookup[subcat]) {
        actualsMonthlyLookup[subcat] = {};
      }
      actualsMonthlyLookup[subcat][key] = new Decimal(actualsMonthlyLookup[subcat][key] || 0).plus(new Decimal(actual.amount?.toString() || '0')).toNumber();
      if (!actualsMonthsPerYearPerSubcat[subcat]) actualsMonthsPerYearPerSubcat[subcat] = {};
      if (!actualsMonthsPerYearPerSubcat[subcat][actual.year]) actualsMonthsPerYearPerSubcat[subcat][actual.year] = new Set();
      actualsMonthsPerYearPerSubcat[subcat][actual.year].add(actual.month);
    }

    const isAnnualOnlyData = (subcat: string, year: number): boolean => {
      const months = actualsMonthsPerYearPerSubcat[subcat]?.[year];
      if (!months) return false;
      return months.size === 1 && months.has(1);
    };

    const revenueLineItems: LineItem[] = Object.entries(revenueBySubcat).map(([name, data], idx) => {
      const department = data.department || inferDepartment(name, data.category);
      const annualGrowthRate = getRevenueGrowthForDept(department, name);
      const baseMonthly = new Decimal(data.amount).dividedBy(12);
      const projectionsMonthly: Record<string, number> = {};

      let cumulativeGrowth = new Decimal(1);
      let prevYear: number | null = null;
      let currentMonthlyRate = new Decimal(annualToMonthlyRate(annualGrowthRate.toNumber()));

      for (const period of monthlyPeriods) {
        if (hasYearlyGrowthRates && period.year !== prevYear) {
          const yearRate = getRevenueGrowthForDept(department, name, period.year);
          currentMonthlyRate = new Decimal(annualToMonthlyRate(yearRate.toNumber()));
          prevYear = period.year;
        }

        if (period.index > 0) {
          cumulativeGrowth = cumulativeGrowth.times(new Decimal(1).plus(currentMonthlyRate));
        }

        if (period.isActual && actualsMonthlyLookup[name]?.[period.key] && !isAnnualOnlyData(name, period.year)) {
          projectionsMonthly[period.key] = Math.round(actualsMonthlyLookup[name][period.key]);
          continue;
        }

        let projectedAmount = baseMonthly.times(cumulativeGrowth);

        const occAdj = getOccupancyAdjustment(department, name, period.year);
        projectedAmount = projectedAmount.times(occAdj);

        projectionsMonthly[period.key] = projectedAmount.round().toNumber();
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
        growthRate: annualGrowthRate.times(100).toNumber(),
        projections,
        projectionsMonthly,
        isRevenue: true
      };
    });

    const cogsLineItems: LineItem[] = Object.entries(cogsBySubcat).map(([name, data], idx) => {
      const department = data.department || inferDepartment(name, data.category);
      const annualGrowthRate = getExpenseGrowthForCategory(name, department);
      const baseMonthly = new Decimal(data.amount).dividedBy(12);
      const projectionsMonthly: Record<string, number> = {};

      for (const period of monthlyPeriods) {
        if (period.isActual && actualsMonthlyLookup[name]?.[period.key] && !isAnnualOnlyData(name, period.year)) {
          projectionsMonthly[period.key] = Math.round(actualsMonthlyLookup[name][period.key]);
        }
      }

      if (granularMargins[departmentToAssumptionKey(department)]) {
        const marginData = granularMargins[departmentToAssumptionKey(department)];
        const projectedMarginPct = new Decimal(marginData.projected).dividedBy(100);
        const revenueKey = department === 'Fuel' ? 'fuel_dock' : departmentToAssumptionKey(department);
        const matchingRevenue = Object.entries(revenueBySubcat).find(([_, rd]) =>
          departmentToAssumptionKey(rd.department || inferDepartment(rd.subcategory)) === revenueKey
        );

        if (matchingRevenue) {
          const revBase = new Decimal(matchingRevenue[1].amount);
          let revCumGrowth = new Decimal(1);
          let revPrevYear: number | null = null;
          let revMonthlyRate = new Decimal(annualToMonthlyRate(getRevenueGrowthForDept(department, matchingRevenue[0]).toNumber()));

          for (const period of monthlyPeriods) {
            if (hasYearlyGrowthRates && period.year !== revPrevYear) {
              revMonthlyRate = new Decimal(annualToMonthlyRate(getRevenueGrowthForDept(department, matchingRevenue[0], period.year).toNumber()));
              revPrevYear = period.year;
            }
            if (period.index > 0) revCumGrowth = revCumGrowth.times(new Decimal(1).plus(revMonthlyRate));
            if (projectionsMonthly[period.key] !== undefined) continue;
            const projectedRevMonth = revBase.dividedBy(12).times(revCumGrowth);
            projectionsMonthly[period.key] = projectedRevMonth.times(new Decimal(1).minus(projectedMarginPct)).round().toNumber();
          }
        } else {
          let cumGrowth = new Decimal(1);
          let pYear: number | null = null;
          let mRate = new Decimal(annualToMonthlyRate(annualGrowthRate.toNumber()));
          for (const period of monthlyPeriods) {
            if (hasYearlyGrowthRates && period.year !== pYear) {
              mRate = new Decimal(annualToMonthlyRate(getExpenseGrowthForCategory(name, department, period.year).toNumber()));
              pYear = period.year;
            }
            if (period.index > 0) cumGrowth = cumGrowth.times(new Decimal(1).plus(mRate));
            if (projectionsMonthly[period.key] !== undefined) continue;
            projectionsMonthly[period.key] = baseMonthly.times(cumGrowth).round().toNumber();
          }
        }
      } else {
        let cumGrowth = new Decimal(1);
        let pYear: number | null = null;
        let mRate = new Decimal(annualToMonthlyRate(annualGrowthRate.toNumber()));
        for (const period of monthlyPeriods) {
          if (hasYearlyGrowthRates && period.year !== pYear) {
            mRate = new Decimal(annualToMonthlyRate(getExpenseGrowthForCategory(name, department, period.year).toNumber()));
            pYear = period.year;
          }
          if (period.index > 0) cumGrowth = cumGrowth.times(new Decimal(1).plus(mRate));
          if (projectionsMonthly[period.key] !== undefined) continue;
          projectionsMonthly[period.key] = baseMonthly.times(cumGrowth).round().toNumber();
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
        growthRate: annualGrowthRate.times(100).toNumber(),
        projections,
        projectionsMonthly,
        isRevenue: false
      };
    });

    const isPropertyTaxLine = (name: string): boolean => {
      const lower = name.toLowerCase().replace(/[^a-z\s]/g, '').trim();
      return lower.includes('property tax') || lower.includes('real estate tax')
        || lower === 'property taxes' || lower === 'real estate taxes'
        || lower.includes('taxes property') || lower.includes('tax assessment')
        || lower === 'ad valorem tax' || lower === 'ad valorem taxes';
    };

    const getPropertyTaxMonthly = (yearIndex: number): number | null => {
      if (!propertyTaxConfig || !propertyTaxConfig.millageRate) return null;
      const baseTaxableValue = new Decimal(
        propertyTaxConfig.taxableValueMode === 'purchase_price'
          ? (propertyTaxConfig.purchasePrice || 0)
          : (propertyTaxConfig.taxableValue || 0)
      );
      if (baseTaxableValue.lte(0)) return null;

      let currentTaxable = baseTaxableValue;

      if (yearIndex === 0) {
        if (propertyTaxConfig.reassessOnSale && propertyTaxConfig.year1TaxJumpPct > 0) {
          currentTaxable = baseTaxableValue.times(new Decimal(1).plus(new Decimal(propertyTaxConfig.year1TaxJumpPct).dividedBy(100)));
        }
      } else {
        if (propertyTaxConfig.reassessOnSale && propertyTaxConfig.year1TaxJumpPct > 0) {
          currentTaxable = baseTaxableValue.times(new Decimal(1).plus(new Decimal(propertyTaxConfig.year1TaxJumpPct).dividedBy(100)));
        }
        const growthRate = new Decimal(propertyTaxConfig.standardGrowthRate || 2).dividedBy(100);
        currentTaxable = currentTaxable.times(new Decimal(1).plus(growthRate).pow(yearIndex));
      }

      const divisor = new Decimal(propertyTaxConfig.millageRatePer || 1000);
      const annualTax = currentTaxable.dividedBy(divisor).times(propertyTaxConfig.millageRate);
      return annualTax.dividedBy(12).round().toNumber();
    };

    const expenseLineItems: LineItem[] = Object.entries(expensesBySubcat).map(([name, data], idx) => {
      const department = data.department || inferDepartment(name, data.category);
      const annualGrowthRate = getExpenseGrowthForCategory(name, department);
      const baseMonthly = new Decimal(data.amount).dividedBy(12);
      const projectionsMonthly: Record<string, number> = {};

      for (const period of monthlyPeriods) {
        if (period.isActual && actualsMonthlyLookup[name]?.[period.key] && !isAnnualOnlyData(name, period.year)) {
          projectionsMonthly[period.key] = Math.round(actualsMonthlyLookup[name][period.key]);
        }
      }

      if (isPropertyTaxLine(name) && propertyTaxConfig && propertyTaxConfig.millageRate > 0) {
        for (const period of monthlyPeriods) {
          if (projectionsMonthly[period.key] !== undefined) continue;
          const yearIndex = period.year - baseYear;
          const taxMonthly = getPropertyTaxMonthly(yearIndex);
          if (taxMonthly !== null) {
            projectionsMonthly[period.key] = taxMonthly;
          } else {
            projectionsMonthly[period.key] = baseMonthly.round().toNumber();
          }
        }
      } else if (granularMargins[departmentToAssumptionKey(department)]) {
        const marginData = granularMargins[departmentToAssumptionKey(department)];
        const projectedMarginPct = new Decimal(marginData.projected).dividedBy(100);
        const revenueKey = department === 'Fuel' ? 'fuel_dock' : 'ship_store';
        const matchingRevenue = Object.entries(revenueBySubcat).find(([_, rd]) =>
          departmentToAssumptionKey(rd.department || inferDepartment(rd.subcategory)) === revenueKey
        );

        if (matchingRevenue) {
          const revBase = new Decimal(matchingRevenue[1].amount);
          let revCumGrowth = new Decimal(1);
          let revPrevYear: number | null = null;
          let revMonthlyRate = new Decimal(annualToMonthlyRate(getRevenueGrowthForDept(department, matchingRevenue[0]).toNumber()));

          for (const period of monthlyPeriods) {
            if (hasYearlyGrowthRates && period.year !== revPrevYear) {
              revMonthlyRate = new Decimal(annualToMonthlyRate(getRevenueGrowthForDept(department, matchingRevenue[0], period.year).toNumber()));
              revPrevYear = period.year;
            }
            if (period.index > 0) revCumGrowth = revCumGrowth.times(new Decimal(1).plus(revMonthlyRate));
            if (projectionsMonthly[period.key] !== undefined) continue;
            const projectedRevMonth = revBase.dividedBy(12).times(revCumGrowth);
            projectionsMonthly[period.key] = projectedRevMonth.times(new Decimal(1).minus(projectedMarginPct)).round().toNumber();
          }
        } else {
          let cumGrowth = new Decimal(1);
          let pYear: number | null = null;
          let mRate = new Decimal(annualToMonthlyRate(annualGrowthRate.toNumber()));
          for (const period of monthlyPeriods) {
            if (hasYearlyGrowthRates && period.year !== pYear) {
              mRate = new Decimal(annualToMonthlyRate(getExpenseGrowthForCategory(name, department, period.year).toNumber()));
              pYear = period.year;
            }
            if (period.index > 0) cumGrowth = cumGrowth.times(new Decimal(1).plus(mRate));
            if (projectionsMonthly[period.key] !== undefined) continue;
            projectionsMonthly[period.key] = baseMonthly.times(cumGrowth).round().toNumber();
          }
        }
      } else {
        let cumGrowth = new Decimal(1);
        let pYear: number | null = null;
        let mRate = new Decimal(annualToMonthlyRate(annualGrowthRate.toNumber()));
        for (const period of monthlyPeriods) {
          if (hasYearlyGrowthRates && period.year !== pYear) {
            mRate = new Decimal(annualToMonthlyRate(getExpenseGrowthForCategory(name, department, period.year).toNumber()));
            pYear = period.year;
          }
          if (period.index > 0) cumGrowth = cumGrowth.times(new Decimal(1).plus(mRate));
          if (projectionsMonthly[period.key] !== undefined) continue;
          projectionsMonthly[period.key] = baseMonthly.times(cumGrowth).round().toNumber();
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
        growthRate: annualGrowthRate.times(100).toNumber(),
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
    const cashFlowBeforeDebtServiceMonthly: Record<string, number> = {};
    const leveredCashFlowMonthly: Record<string, number> = {};
    const cashFlowMonthly: Record<string, number> = {};
    
    for (const period of monthlyPeriods) {
      const revTotal = new Decimal(revenueLineItems.reduce((sum, item) => sum + (item.projectionsMonthly[period.key] || 0), 0));
      const cogsTotal = new Decimal(cogsLineItems.reduce((sum, item) => sum + (item.projectionsMonthly[period.key] || 0), 0));
      const expTotal = new Decimal(expenseLineItems.reduce((sum, item) => sum + (item.projectionsMonthly[period.key] || 0), 0));

      const gp = revTotal.minus(cogsTotal);
      const rawNoi = gp.minus(expTotal);
      const pctBasis = belowTheLineBasis === 'noi' ? rawNoi : revTotal;
      const mgmtFee = pctBasis.times(managementFeePct).round();
      const capexVal = capexAmount.gt(0) ? capexAmount.dividedBy(12).round() : pctBasis.times(capexPct).round();
      const reserveVal = reservesAmount.gt(0) ? reservesAmount.dividedBy(12).round() : pctBasis.times(reservesPct).round();

      // Items marked 'above' are deducted before NOI; 'below' items deducted after
      const aboveLineMgmt = mgmtFeeLinePos === 'above' ? mgmtFee : new Decimal(0);
      const aboveLineCapex = capexLinePos === 'above' ? capexVal : new Decimal(0);
      const aboveLineReserves = reservesLinePos === 'above' ? reserveVal : new Decimal(0);
      const noiVal = rawNoi.minus(aboveLineMgmt).minus(aboveLineCapex).minus(aboveLineReserves);

      const belowLineMgmt = mgmtFeeLinePos === 'below' ? mgmtFee : new Decimal(0);
      const belowLineCapex = capexLinePos === 'below' ? capexVal : new Decimal(0);
      const belowLineReserves = reservesLinePos === 'below' ? reserveVal : new Decimal(0);
      const debtSvc = 0; // Will be updated after debt integration
      const cfBeforeDebt = noiVal.minus(belowLineMgmt).minus(belowLineCapex).minus(belowLineReserves);
      const levCf = cfBeforeDebt.minus(debtSvc);

      revenueTotalsMonthly[period.key] = revTotal.toNumber();
      cogsTotalsMonthly[period.key] = cogsTotal.toNumber();
      grossProfitMonthly[period.key] = gp.toNumber();
      expenseTotalsMonthly[period.key] = expTotal.toNumber();
      noiMonthly[period.key] = noiVal.toNumber();
      capexMonthly[period.key] = capexVal.toNumber();
      managementFeeMonthly[period.key] = mgmtFee.toNumber();
      reservesMonthly[period.key] = reserveVal.toNumber();
      debtServiceMonthly[period.key] = debtSvc;
      cashFlowBeforeDebtServiceMonthly[period.key] = cfBeforeDebt.toNumber();
      leveredCashFlowMonthly[period.key] = levCf.toNumber();
      cashFlowMonthly[period.key] = levCf.toNumber();
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
    
    // Roll up from noiMonthly (which already reflects above-the-line deductions)
    const noi = annualPeriods.map(year =>
      year.monthIndices.reduce((sum, mi) => sum + (noiMonthly[monthlyPeriods[mi].key] || 0), 0)
    );
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
    const cashFlowBeforeDebtService = annualPeriods.map(year =>
      year.monthIndices.reduce((sum, mi) => sum + (cashFlowBeforeDebtServiceMonthly[monthlyPeriods[mi].key] || 0), 0)
    );
    const leveredCashFlow = annualPeriods.map(year =>
      year.monthIndices.reduce((sum, mi) => sum + (leveredCashFlowMonthly[monthlyPeriods[mi].key] || 0), 0)
    );
    const cashFlow = leveredCashFlow.slice(); // Backward compat
    const noiBelowLine = annualPeriods.map((_, i) => {
      const belMgmt = mgmtFeeLinePos === 'below' ? managementFeeArr[i] : 0;
      const belCapex = capexLinePos === 'below' ? capex[i] : 0;
      const belReserves = reservesLinePos === 'below' ? reservesArr[i] : 0;
      return belMgmt + belCapex + belReserves + debtServiceArr[i];
    });
    
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
      cashFlowBeforeDebtService: cashFlowBeforeDebtServiceMonthly[period.key] || 0,
      leveredCashFlow: leveredCashFlowMonthly[period.key] || 0,
      isActual: period.isActual ?? false,
      isForecast: period.isForecast ?? true,
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
      cashFlowBeforeDebtService: cashFlowBeforeDebtService[i] || 0,
      leveredCashFlow: leveredCashFlow[i] || 0,
      monthCount: year.monthCount,
    }));
    
    // ========================================
    // 9. CALCULATE METRICS
    // ========================================
    
    // Exit value based on terminal NOI
    const exitNoiD = new Decimal(noi[noi.length - 1] || 0);
    const exitValueD = exitCapRate.gt(0) ? exitNoiD.dividedBy(exitCapRate).round() : new Decimal(0);
    const exitValue = exitValueD.toNumber();

    // Going-in cap rate
    const goingInCapRate = purchasePrice.gt(0) ? new Decimal(noi[0] || 0).dividedBy(purchasePrice).times(100).toNumber() : 0;
    
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
      const activeCapitalStack = await db.select()
        .from(capitalStacks)
        .where(and(
          eq(capitalStacks.modelingProjectId, projectId),
          eq(capitalStacks.orgId, orgId)
        ))
        .limit(1);
      
      const capitalStackId = activeCapitalStack[0]?.id;
      
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
          ltv = purchasePrice.gt(0) ? new Decimal(debtSchedule.totalDebtAtClose).dividedBy(purchasePrice).times(100).toNumber() : 0;
          
          // Update monthly and annual debt service + levered cash flow
          for (const period of monthlyPeriods) {
            const ds = debtScheduleService.getDebtServiceForPeriod(debtSchedule, period.key);
            debtServiceMonthly[period.key] = Math.round(ds.payment);
            const noiVal = noiMonthly[period.key] || 0;
            // Only subtract below-the-line items (above-line already in noiVal)
            const belMgmt = mgmtFeeLinePos === 'below' ? (managementFeeMonthly[period.key] || 0) : 0;
            const belCapex = capexLinePos === 'below' ? (capexMonthly[period.key] || 0) : 0;
            const belReserves = reservesLinePos === 'below' ? (reservesMonthly[period.key] || 0) : 0;
            const newLevCf = noiVal - belMgmt - belCapex - belReserves - Math.round(ds.payment);
            leveredCashFlowMonthly[period.key] = newLevCf;
            cashFlowMonthly[period.key] = newLevCf;
          }
          
          // Recompute annual rollups with debt service
          for (let i = 0; i < annualPeriods.length; i++) {
            const year = annualPeriods[i];
            debtServiceArr[i] = year.monthIndices.reduce((sum, mi) => sum + (debtServiceMonthly[monthlyPeriods[mi].key] || 0), 0);
            leveredCashFlow[i] = year.monthIndices.reduce((sum, mi) => sum + (leveredCashFlowMonthly[monthlyPeriods[mi].key] || 0), 0);
            cashFlow[i] = leveredCashFlow[i];
            const belMgmtD = mgmtFeeLinePos === 'below' ? managementFeeArr[i] : 0;
            const belCapexD = capexLinePos === 'below' ? capex[i] : 0;
            const belReservesD = reservesLinePos === 'below' ? reservesArr[i] : 0;
            noiBelowLine[i] = belMgmtD + belCapexD + belReservesD + debtServiceArr[i];
          }
          
          // Update projection detail arrays with debt service
          for (const mp of monthlyProjections) {
            mp.debtService = debtServiceMonthly[mp.periodKey] || 0;
            mp.cashFlowBeforeDebtService = cashFlowBeforeDebtServiceMonthly[mp.periodKey] || 0;
            mp.leveredCashFlow = leveredCashFlowMonthly[mp.periodKey] || 0;
            mp.cashFlow = cashFlowMonthly[mp.periodKey] || 0;
          }
          for (let i = 0; i < annualProjections.length; i++) {
            annualProjections[i].debtService = debtServiceArr[i] || 0;
            annualProjections[i].cashFlowBeforeDebtService = cashFlowBeforeDebtService[i] || 0;
            annualProjections[i].leveredCashFlow = leveredCashFlow[i] || 0;
            annualProjections[i].cashFlow = cashFlow[i] || 0;
          }
        }
      }
    } catch (debtError) {
      console.warn('Debt integration skipped:', debtError);
    }

    // ── Canonical fallback: if bridge path failed or returned $0, try direct ──
    if (!debtSchedule || debtSchedule.totalDebtAtClose === 0) {
      try {
        const canonicalSchedule = await generateCanonicalDebtSchedule(projectId, orgId, periods.holdPeriodMonths, projectionStartDate.getFullYear());
        if (canonicalSchedule && canonicalSchedule.totalDebtAtClose > 0) {
          debtSchedule = canonicalSchedule;
          dscrMetrics = debtScheduleService.calculateDSCR(noiMonthly, debtSchedule);
          minDscr = dscrMetrics.minDscr;
          avgDscr = dscrMetrics.avgDscr;
          totalDebtService = Object.values(debtSchedule.annualDebtService).reduce((a, b) => a + b, 0);
          debtYield = debtScheduleService.calculateDebtYield(year1Noi, debtSchedule.totalDebtAtClose);
          ltv = purchasePrice.gt(0) ? new Decimal(debtSchedule.totalDebtAtClose).dividedBy(purchasePrice).times(100).toNumber() : 0;
          for (const period of monthlyPeriods) {
            const ds = debtScheduleService.getDebtServiceForPeriod(debtSchedule, period.key);
            debtServiceMonthly[period.key] = Math.round(ds.payment);
            const noiVal = noiMonthly[period.key] || 0;
            const belMgmt = mgmtFeeLinePos === 'below' ? (managementFeeMonthly[period.key] || 0) : 0;
            const belCapex = capexLinePos === 'below' ? (capexMonthly[period.key] || 0) : 0;
            const belReserves = reservesLinePos === 'below' ? (reservesMonthly[period.key] || 0) : 0;
            leveredCashFlowMonthly[period.key] = Math.round(noiVal - belMgmt - belCapex - belReserves - ds.payment);
          }
          console.log("[Pro Forma] Canonical debt engine used (direct from loans)");
        }
      } catch (canonicalError) {
        console.warn("[Pro Forma] Canonical debt fallback also failed:", canonicalError);
      }
    }
    
    // ========================================
    // 9b. EXIT WATERFALL & IRR CALCULATION
    // ========================================
    
    // Exit waterfall
    const sellingFeesD = exitValueD.times(sellingFeePct).round();
    const sellingFees = sellingFeesD.toNumber();
    const lastProjectionPeriodKey = monthlyPeriods[monthlyPeriods.length - 1]?.key;
    const exitPeriodDebt = debtSchedule?.schedule?.find(p => p.periodKey === lastProjectionPeriodKey);
    const lastScheduleEntry = exitPeriodDebt || debtSchedule?.schedule?.[debtSchedule.schedule.length - 1];
    const loanPayoffD = new Decimal(lastScheduleEntry?.totalBalance || 0).round();
    const loanPayoff = loanPayoffD.toNumber();
    const loanExitFeesD = loanPayoffD.times(loanExitFeePct).round();
    const loanExitFees = loanExitFeesD.toNumber();
    const workingCapitalRecoveryD = workingCapitalAmount.times(workingCapitalRecoveryPct).round();
    const workingCapitalRecovery = workingCapitalRecoveryD.toNumber();
    const netExitProceedsD = exitValueD.minus(sellingFeesD).minus(loanPayoffD).minus(loanExitFeesD).plus(workingCapitalRecoveryD);
    const netExitProceeds = netExitProceedsD.toNumber();

    // LEVERED XIRR: Uses equity invested and cash flows after debt service
    const loanProceedsD = new Decimal(debtSchedule?.totalDebtAtClose || 0);
    const totalEquityInvestedD = purchasePrice.minus(loanProceedsD).plus(workingCapitalAmount);
    const totalEquityInvested = totalEquityInvestedD.toNumber();
    const leveredDatedCashFlows: DatedCashFlow[] = [
      { date: projectionStartDate, amount: -totalEquityInvested }
    ];
    let totalLeveredDistD = new Decimal(0);
    for (let i = 0; i < monthlyPeriods.length; i++) {
      const period = monthlyPeriods[i];
      let cfD = new Decimal(leveredCashFlowMonthly[period.key] || 0);

      if (i === monthlyPeriods.length - 1) {
        cfD = cfD.plus(netExitProceedsD);
      }

      totalLeveredDistD = totalLeveredDistD.plus(cfD);
      leveredDatedCashFlows.push({ date: period.date, amount: cfD.toNumber() });
    }
    const totalLeveredDistributions = totalLeveredDistD.toNumber();

    const leveredXirrResult = calculateXIRR(leveredDatedCashFlows, 0.1);
    const annualizedIrr = new Decimal(leveredXirrResult).times(10000).round().dividedBy(100).toNumber();

    // Levered equity multiple
    const equityMultiple = totalEquityInvestedD.gt(0) ? totalLeveredDistD.dividedBy(totalEquityInvestedD).toNumber() : 0;

    // UNLEVERED XIRR: Uses total purchase price and cash flows before debt service (NOI - MgmtFee - CapEx - Reserves)
    const totalUnleveredInvestmentD = purchasePrice.plus(workingCapitalAmount);
    const totalUnleveredInvestment = totalUnleveredInvestmentD.toNumber();
    const unleveredNetExitProceedsD = exitValueD.minus(sellingFeesD).plus(workingCapitalRecoveryD);
    const unleveredDatedCashFlows: DatedCashFlow[] = [
      { date: projectionStartDate, amount: -totalUnleveredInvestment }
    ];
    let totalUnleveredDistD = new Decimal(0);
    for (let i = 0; i < monthlyPeriods.length; i++) {
      const period = monthlyPeriods[i];
      let cfD = new Decimal(cashFlowBeforeDebtServiceMonthly[period.key] || 0);

      if (i === monthlyPeriods.length - 1) {
        cfD = cfD.plus(unleveredNetExitProceedsD);
      }

      totalUnleveredDistD = totalUnleveredDistD.plus(cfD);
      unleveredDatedCashFlows.push({ date: period.date, amount: cfD.toNumber() });
    }
    const totalUnleveredDistributions = totalUnleveredDistD.toNumber();

    const unleveredXirrResult = calculateXIRR(unleveredDatedCashFlows, 0.1);
    const unleveredIrr = new Decimal(unleveredXirrResult).times(10000).round().dividedBy(100).toNumber();

    // Unlevered equity multiple
    const unleveredEquityMultiple = totalUnleveredInvestmentD.gt(0) ? totalUnleveredDistD.dividedBy(totalUnleveredInvestmentD).toNumber() : 0;
    
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
        t12Context: t12Context || undefined,
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
      cashFlowBeforeDebtService,
      cashFlowBeforeDebtServiceMonthly,
      leveredCashFlow,
      leveredCashFlowMonthly,
      
      monthlyProjections,
      annualProjections,
      
      metrics: {
        goingInCapRate,
        exitCapRate: exitCapRate.times(100).toNumber(),
        revenueGrowthRate: flatRevenueGrowthRate.times(100).toNumber(),
        expenseGrowthRate: flatExpenseGrowthRate.times(100).toNumber(),
        purchasePrice: purchasePrice.toNumber(),
        exitValue,
        totalReturn: totalLeveredDistributions,
        irr: annualizedIrr,
        irrAnnualized: annualizedIrr,
        irrDisplayPreference: 'annualized' as IrrDisplayPreference,
        unleveredIrr,
        equityMultiple,
        unleveredEquityMultiple,
        year1Noi,
        year3Noi,
        stabilizedNoi,
        stabilizedNoiYear: stabilizedYearIndex + 1,
        stabilizedNoiMode,
        // Line position configuration
        linePositions: {
          managementFee: mgmtFeeLinePos,
          capex: capexLinePos,
          reserves: reservesLinePos,
        },
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
    // ── Read per-department revenue source toggle ──────────────
    let revenueSourceByDept: Record<string, string> = {};
    try {
      const [proj] = await db.select({ customMetrics: modelingProjects.customMetrics })
        .from(modelingProjects)
        .where(eq(modelingProjects.id, projectId));
      const cfg = (proj?.customMetrics as any) || {};
      revenueSourceByDept = cfg.revenueSourceByDept || {};
    } catch {}

    const useProfitCenter = (dept: string): boolean => {
      return revenueSourceByDept[dept] !== 'pnl_actuals';
    };

    const removePnlActualsForDept = (dept: string) => {
      for (const [key, entry] of Object.entries(revenueBySubcat)) {
        if (entry.department === dept && !key.startsWith('PC: ')) delete revenueBySubcat[key];
      }
      for (const [key, entry] of Object.entries(cogsBySubcat)) {
        if (entry.department === dept && !key.startsWith('PC: ')) delete cogsBySubcat[key];
      }
      for (const [key, entry] of Object.entries(expensesBySubcat)) {
        if (entry.department === dept && !key.startsWith('PC: ')) delete expensesBySubcat[key];
      }
    };

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

      if (fuelRows.length > 0 && useProfitCenter('Fuel')) {
        removePnlActualsForDept('Fuel');
        const totalRev = fuelRows.reduce((s, r) => s + Number(r.revenue || 0), 0);
        const totalCogs = fuelRows.reduce((s, r) => s + Number(r.cogs || 0), 0);
        addRevenue('Fuel Sales', totalRev, 'Fuel');
        addCOGS('Fuel Sales', totalCogs, 'Fuel');
      }

      if (storeRows.length > 0 && useProfitCenter('Ship Store')) {
        removePnlActualsForDept('Ship Store');
        const totalRev = storeRows.reduce((s, r) => s + Number(r.revenue || 0), 0);
        const totalCogs = storeRows.reduce((s, r) => s + Number(r.cogs || 0), 0);
        addRevenue('Ship Store', totalRev, 'Ship Store');
        addCOGS('Ship Store', totalCogs, 'Ship Store');
      }

      if (serviceRows.length > 0 && useProfitCenter('Service')) {
        removePnlActualsForDept('Service');
        const totalRev = serviceRows.reduce((s, r) => s + Number(r.totalRevenue || 0), 0);
        const totalCogs = serviceRows.reduce((s, r) => s + Number(r.cogs || 0), 0);
        addRevenue('Service Department', totalRev, 'Service');
        addCOGS('Service Department', totalCogs, 'Service');
      }

      if (rentalRows.length > 0 && useProfitCenter('Boat Rentals')) {
        removePnlActualsForDept('Boat Rentals');
        const totalRev = rentalRows.reduce((s, r) => s + Number(r.revenue || 0), 0);
        addRevenue('Boat Rentals', totalRev, 'Boat Rentals');
      }

      if (clubRows.length > 0 && useProfitCenter('Boat Club')) {
        removePnlActualsForDept('Boat Club');
        const totalRev = clubRows.reduce((s, r) => s + Number(r.monthlyRecurringRevenue || 0), 0);
        addRevenue('Boat Club', totalRev, 'Boat Club');
      }

      if (salesRows.length > 0 && useProfitCenter('Boat Sales')) {
        removePnlActualsForDept('Boat Sales');
        const totalRev = salesRows.reduce((s, r) => s + Number(r.revenue || 0), 0);
        const totalCogs = salesRows.reduce((s, r) => s + Number(r.cogs || 0), 0);
        addRevenue('Boat Sales', totalRev, 'Boat Sales');
        addCOGS('Boat Sales', totalCogs, 'Boat Sales');
      }

      if (tenantRows.length > 0 && useProfitCenter('Commercial')) {
        removePnlActualsForDept('Commercial');
        const totalRev = tenantRows.reduce((s, r) => s + Number(r.totalRevenue || 0), 0);
        addRevenue('Commercial Tenants', totalRev, 'Commercial');
      }

      if (bkRows.length > 0 && useProfitCenter('Bookkeeping')) {
        removePnlActualsForDept('Bookkeeping');
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
   * Get all available historical years for a project, sorted chronologically.
   */
  async getHistoricalYears(projectId: string, orgId: string): Promise<number[]> {
    const results = await db.selectDistinct({ year: modelingActuals.year })
      .from(modelingActuals)
      .where(and(
        eq(modelingActuals.modelingProjectId, projectId),
        eq(modelingActuals.orgId, orgId)
      ));
    return results.map(r => r.year).filter((y): y is number => y !== null).sort((a, b) => a - b);
  }

  /**
   * Get multi-year historical P&L data for a project.
   * Returns all available years with line items, chronologically ordered.
   */
  async getMultiYearHistoricalPL(projectId: string, orgId: string): Promise<any> {
    const years = await this.getHistoricalYears(projectId, orgId);
    if (years.length === 0) {
      return { years: [], yearData: {}, mostRecentYear: null };
    }
    const yearData: Record<number, any> = {};
    for (const y of years) {
      yearData[y] = await this.getHistoricalPL(projectId, orgId, y);
    }
    return {
      years,
      yearData,
      mostRecentYear: years[years.length - 1]
    };
  }

  /**
   * Get historical P&L data for a project.
   * Used for base year determination and actuals display.
   *
   * FIX: Now uses shared canonical-actuals-loader to guarantee identical
   * category/department resolution as generateProForma() baseline year.
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

    const { categorized } = await loadCanonicalActuals(projectId, orgId, year);

    const toItems = (list: typeof categorized.revenueItems) =>
      list.map(item => ({
        name: item.key,
        category: item.category,
        department: item.department,
        monthlyAmounts: Array.from({ length: 12 }, (_, i) => item.monthlyAmounts[i + 1] || 0),
        total: item.total,
      }));

    return {
      year: year || new Date().getFullYear(),
      revenue: { lineItems: toItems(categorized.revenueItems), total: categorized.totalRevenue },
      cogs: { lineItems: toItems(categorized.cogsItems), total: categorized.totalCOGS },
      grossProfit: categorized.grossProfit,
      expenses: { lineItems: toItems(categorized.expenseItems), total: categorized.totalExpenses },
      noi: categorized.noi,
      lastUpdated: new Date().toISOString(),
    };
  }
}

export const proFormaEngineService = new ProFormaEngineService();
