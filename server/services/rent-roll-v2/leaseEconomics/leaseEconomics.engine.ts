/**
 * Lease Economics Engine
 * 
 * Main engine that generates periodized cash flows from compiled lease economics plans.
 * Supports backward compatibility with legacy calculation when no V2 data exists.
 */

import { 
  startOfMonth, 
  endOfMonth, 
  addMonths, 
  format, 
  getYear, 
  getMonth,
  isBefore,
  isAfter,
  differenceInMonths
} from 'date-fns';
import { db } from '../../db';
import { 
  leases, 
  leaseTerms, 
  leaseRentSteps, 
  leaseEscalations, 
  leaseConcessions,
  leaseBillingRules,
  tenants
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import type { 
  LeaseEconomicsInput,
  LeaseEconomicsPlan,
  LeaseCashFlowResult,
  CashFlowPeriodResult,
  CashFlowWarning,
  CashFlowLineage,
  LeaseEconomicsEngineOptions,
  LeaseEconomicsAssumptions,
  DEFAULT_ENGINE_OPTIONS,
  DEFAULT_ASSUMPTIONS,
  ENGINE_VERSION
} from './leaseEconomics.types';
import { compileLeaseEconomicsPlan, generateInputHash, getRentForDate } from './leaseEconomics.compiler';
import { calculateProration } from './leaseEconomics.proration';
import { calculateEscalatedRent } from './leaseEconomics.escalations';
import { calculateConcessions } from './leaseEconomics.concessions';

/**
 * Generate cash flows for a lease using the V2 economics engine
 */
export async function generateLeaseEconomicsCashFlows(
  leaseId: string,
  options: LeaseEconomicsEngineOptions = DEFAULT_ENGINE_OPTIONS
): Promise<LeaseCashFlowResult> {
  // Fetch all economics data
  const input = await fetchLeaseEconomicsInput(leaseId);
  
  // Compile into plan
  const plan = compileLeaseEconomicsPlan(input);
  
  // Execute the plan
  return executePlan(plan, input, options);
}

/**
 * Fetch all economics input data for a lease
 */
async function fetchLeaseEconomicsInput(leaseId: string): Promise<LeaseEconomicsInput> {
  // Fetch lease with tenant
  const leaseData = await db.query.leases.findFirst({
    where: eq(leases.id, leaseId),
    with: { tenant: true },
  });
  
  if (!leaseData) {
    throw new Error(`Lease not found: ${leaseId}`);
  }
  
  // Fetch economics data in parallel
  const [terms, rentSteps, escalationsData, concessionsData, billingRulesData] = await Promise.all([
    db.select().from(leaseTerms).where(eq(leaseTerms.leaseId, leaseId)),
    db.select().from(leaseRentSteps).where(eq(leaseRentSteps.leaseId, leaseId)),
    db.select().from(leaseEscalations).where(eq(leaseEscalations.leaseId, leaseId)),
    db.select().from(leaseConcessions).where(eq(leaseConcessions.leaseId, leaseId)),
    db.select().from(leaseBillingRules).where(eq(leaseBillingRules.leaseId, leaseId)),
  ]);
  
  return {
    lease: leaseData,
    terms,
    rentSteps,
    escalations: escalationsData,
    concessions: concessionsData,
    billingRules: billingRulesData,
    assumptions: DEFAULT_ASSUMPTIONS,
  };
}

/**
 * Execute the compiled plan to generate cash flows
 */
function executePlan(
  plan: LeaseEconomicsPlan,
  input: LeaseEconomicsInput,
  options: LeaseEconomicsEngineOptions
): LeaseCashFlowResult {
  const warnings: CashFlowWarning[] = [];
  const periods: CashFlowPeriodResult[] = [];
  
  // Determine date range
  const startDate = options.startDate || plan.leaseStart;
  const endDate = options.endDate || plan.leaseEnd || 
    addMonths(plan.leaseStart, (options.yearsToProject || 1) * 12);
  
  // Validate dates
  if (isBefore(endDate, startDate)) {
    warnings.push({
      code: 'INVALID_DATE_RANGE',
      message: 'End date is before start date',
      severity: 'error',
    });
    return createEmptyResult(input, warnings, plan);
  }
  
  // Generate monthly periods
  let currentDate = startOfMonth(startDate);
  
  while (!isAfter(currentDate, endDate)) {
    const period = generatePeriod(currentDate, plan, input);
    periods.push(period);
    currentDate = addMonths(currentDate, 1);
  }
  
  // Add warnings for edge cases
  if (plan.useLegacyCalculation) {
    warnings.push({
      code: 'LEGACY_CALCULATION',
      message: 'Using legacy calculation - no V2 economics data found',
      severity: 'info',
    });
  }
  
  // Calculate aggregates
  const aggregates = calculateAggregates(periods);
  
  // Build lineage
  const lineage: CashFlowLineage = {
    sourceLeaseId: plan.leaseId,
    sourceTermId: input.terms[0]?.id,
    calculatedAt: new Date(),
    engineVersion: ENGINE_VERSION,
    usedLegacyFallback: plan.useLegacyCalculation,
    inputHash: generateInputHash(input),
  };
  
  return {
    leaseId: plan.leaseId,
    tenantName: input.lease.tenant?.name || 'Unknown',
    periods,
    ...aggregates,
    warnings,
    lineage,
  };
}

/**
 * Generate a single period's cash flow
 */
function generatePeriod(
  periodDate: Date,
  plan: LeaseEconomicsPlan,
  input: LeaseEconomicsInput
): CashFlowPeriodResult {
  const periodStart = startOfMonth(periodDate);
  const periodEnd = endOfMonth(periodDate);
  
  // Get base rent for this period
  const contractBaseRent = getRentForDate(periodDate, plan.rentSchedule);
  
  // Calculate proration
  const proration = calculateProration(
    periodStart,
    periodEnd,
    plan.leaseStart,
    plan.leaseEnd,
    contractBaseRent,
    plan.dayCountConvention
  );
  
  // Calculate escalations (if V2)
  let escalatedRent = contractBaseRent;
  let escalationAmount = 0;
  let appliedEscalations: any[] = [];
  
  if (!plan.useLegacyCalculation && input.escalations.length > 0) {
    const escalationResult = calculateEscalatedRent(
      contractBaseRent,
      periodDate,
      plan.leaseStart,
      input.escalations,
      input.assumptions.cpiRate
    );
    escalatedRent = escalationResult.newBaseRent;
    escalationAmount = escalationResult.escalationAmount;
    appliedEscalations = escalationResult.appliedEscalations;
  }
  
  // Calculate concessions (if V2)
  let concessionsApplied = 0;
  let appliedConcessions: any[] = [];
  
  if (!plan.useLegacyCalculation && input.concessions.length > 0) {
    const concessionResult = calculateConcessions(
      escalatedRent,
      periodDate,
      input.concessions
    );
    concessionsApplied = concessionResult.totalConcession;
    appliedConcessions = concessionResult.appliedConcessions;
  }
  
  // Apply proration to all amounts
  const proratedContractRent = contractBaseRent * proration.factor;
  const proratedEscalatedRent = escalatedRent * proration.factor;
  const proratedEscalationAmount = escalationAmount * proration.factor;
  const proratedConcessions = concessionsApplied * proration.factor;
  
  // Calculate effective rent
  const effectiveBaseRent = proratedEscalatedRent - proratedConcessions;
  
  // TODO: Integrate other income from existing contract charges system
  const otherIncome = 0;
  
  // Total revenue
  const totalRevenue = effectiveBaseRent + otherIncome;
  
  return {
    periodStart,
    periodEnd,
    year: getYear(periodDate),
    month: getMonth(periodDate) + 1,
    label: format(periodDate, 'MMM yyyy'),
    
    accruedBaseRent: proratedEscalatedRent,
    billedBaseRent: proratedEscalatedRent, // Same for now; differs with billing timing
    contractBaseRent: proratedContractRent,
    
    escalationAmount: proratedEscalationAmount,
    concessionsApplied: proratedConcessions,
    effectiveBaseRent,
    
    otherIncome,
    totalRevenue,
    
    proRataFactor: proration.factor,
    isPartialPeriod: proration.isPartial,
    daysInPeriod: proration.activeDays,
    
    activeRentStep: undefined, // TODO: Add rent step tracking
    appliedEscalations,
    appliedConcessions,
  };
}

/**
 * Calculate aggregate metrics from periods
 */
function calculateAggregates(periods: CashFlowPeriodResult[]) {
  const totalAccruedRent = periods.reduce((sum, p) => sum + p.accruedBaseRent, 0);
  const totalBilledRent = periods.reduce((sum, p) => sum + p.billedBaseRent, 0);
  const totalEffectiveRent = periods.reduce((sum, p) => sum + p.effectiveBaseRent, 0);
  const totalOtherIncome = periods.reduce((sum, p) => sum + p.otherIncome, 0);
  const totalRevenue = periods.reduce((sum, p) => sum + p.totalRevenue, 0);
  const totalConcessions = periods.reduce((sum, p) => sum + p.concessionsApplied, 0);
  
  // Calculate annualized metrics (average monthly * 12)
  const monthCount = periods.length || 1;
  const annualizedInPlaceRent = (totalAccruedRent / monthCount) * 12;
  const annualizedEffectiveRent = (totalEffectiveRent / monthCount) * 12;
  
  return {
    totalAccruedRent,
    totalBilledRent,
    totalEffectiveRent,
    totalOtherIncome,
    totalRevenue,
    totalConcessions,
    annualizedInPlaceRent,
    annualizedEffectiveRent,
  };
}

/**
 * Create empty result for error cases
 */
function createEmptyResult(
  input: LeaseEconomicsInput,
  warnings: CashFlowWarning[],
  plan: LeaseEconomicsPlan
): LeaseCashFlowResult {
  return {
    leaseId: input.lease.id,
    tenantName: input.lease.tenant?.name || 'Unknown',
    periods: [],
    totalAccruedRent: 0,
    totalBilledRent: 0,
    totalEffectiveRent: 0,
    totalOtherIncome: 0,
    totalRevenue: 0,
    totalConcessions: 0,
    annualizedInPlaceRent: 0,
    annualizedEffectiveRent: 0,
    warnings,
    lineage: {
      sourceLeaseId: plan.leaseId,
      calculatedAt: new Date(),
      engineVersion: ENGINE_VERSION,
      usedLegacyFallback: plan.useLegacyCalculation,
      inputHash: generateInputHash(input),
    },
  };
}

/**
 * Batch generate cash flows for multiple leases
 */
export async function batchGenerateLeaseEconomicsCashFlows(
  leaseIds: string[],
  options: LeaseEconomicsEngineOptions = DEFAULT_ENGINE_OPTIONS
): Promise<Map<string, LeaseCashFlowResult>> {
  const results = new Map<string, LeaseCashFlowResult>();
  
  // Process in batches to avoid memory issues
  const batchSize = 50;
  for (let i = 0; i < leaseIds.length; i += batchSize) {
    const batch = leaseIds.slice(i, i + batchSize);
    const batchPromises = batch.map(id => 
      generateLeaseEconomicsCashFlows(id, options)
        .then(result => ({ id, result }))
        .catch(error => ({ id, result: null, error }))
    );
    
    const batchResults = await Promise.all(batchPromises);
    for (const { id, result } of batchResults) {
      if (result) {
        results.set(id, result);
      }
    }
  }
  
  return results;
}

/**
 * Check if lease has V2 economics data
 */
export async function hasEconomicsV2Data(leaseId: string): Promise<boolean> {
  const [terms, steps, escalations, concessions] = await Promise.all([
    db.select({ id: leaseTerms.id }).from(leaseTerms).where(eq(leaseTerms.leaseId, leaseId)).limit(1),
    db.select({ id: leaseRentSteps.id }).from(leaseRentSteps).where(eq(leaseRentSteps.leaseId, leaseId)).limit(1),
    db.select({ id: leaseEscalations.id }).from(leaseEscalations).where(eq(leaseEscalations.leaseId, leaseId)).limit(1),
    db.select({ id: leaseConcessions.id }).from(leaseConcessions).where(eq(leaseConcessions.leaseId, leaseId)).limit(1),
  ]);
  
  return terms.length > 0 || steps.length > 0 || escalations.length > 0 || concessions.length > 0;
}
