/**
 * Lease Economics Compiler
 * 
 * Compiles lease data and economics inputs into a canonical plan
 * that can be processed by the engine to generate cash flows.
 */

import { startOfMonth, isBefore, isAfter, parseISO } from 'date-fns';
import type { 
  Lease, 
  LeaseTerm, 
  LeaseRentStep, 
  LeaseEscalation, 
  LeaseConcession,
  LeaseBillingRule 
} from '@shared/schema';
import type { 
  LeaseEconomicsInput, 
  LeaseEconomicsPlan,
  CompiledRentEntry,
  LeaseEconomicsAssumptions,
  DEFAULT_ASSUMPTIONS
} from './leaseEconomics.types';
import { compileConcessionSchedule } from './leaseEconomics.concessions';
import crypto from 'crypto';

/**
 * Compile lease economics input into an executable plan
 */
export function compileLeaseEconomicsPlan(
  input: LeaseEconomicsInput
): LeaseEconomicsPlan {
  const { lease, terms, rentSteps, escalations, concessions, billingRules, assumptions } = input;
  
  // Determine if we have V2 economics data
  const hasEconomicsV2 = terms.length > 0 || rentSteps.length > 0 || 
                          escalations.length > 0 || concessions.length > 0;
  
  // Get active term or use defaults
  const activeTerm = getActiveTerm(terms);
  
  // Parse dates
  const leaseStart = lease.leaseCommencement 
    ? parseISO(lease.leaseCommencement) 
    : new Date();
  const leaseEnd = lease.leaseExpiration 
    ? parseISO(lease.leaseExpiration) 
    : null;
  
  // Compile rent schedule
  const rentSchedule = compileRentSchedule(lease, rentSteps, escalations, leaseStart, leaseEnd);
  
  // Compile concession schedule
  const concessionSchedule = compileConcessionSchedule(concessions, leaseStart, leaseEnd);
  
  return {
    leaseId: lease.id,
    organizationId: lease.locationId || '',
    leaseStart,
    leaseEnd,
    billingFrequency: activeTerm?.billingFrequency || assumptions.defaultBillingFrequency,
    billingTiming: activeTerm?.billingTiming || assumptions.defaultBillingTiming,
    accrualFrequency: activeTerm?.accrualFrequency || 'monthly',
    dayCountConvention: activeTerm?.dayCountConvention || assumptions.prorationMode,
    rentSchedule,
    concessionSchedule,
    hasEconomicsV2,
    useLegacyCalculation: !hasEconomicsV2,
  };
}

/**
 * Get the active term for a lease
 */
function getActiveTerm(terms: LeaseTerm[]): LeaseTerm | null {
  if (terms.length === 0) return null;
  
  // Find active term
  const activeTerm = terms.find(t => t.status === 'active');
  if (activeTerm) return activeTerm;
  
  // Fall back to most recent term
  const sortedTerms = [...terms].sort((a, b) => {
    const dateA = new Date(a.startDate);
    const dateB = new Date(b.startDate);
    return dateB.getTime() - dateA.getTime();
  });
  
  return sortedTerms[0];
}

/**
 * Compile rent schedule from lease base rent and rent steps
 */
function compileRentSchedule(
  lease: Lease,
  rentSteps: LeaseRentStep[],
  escalations: LeaseEscalation[],
  leaseStart: Date,
  leaseEnd: Date | null
): CompiledRentEntry[] {
  const schedule: CompiledRentEntry[] = [];
  
  // Start with the base lease rent
  const baseRent = lease.leaseAmount ? parseFloat(lease.leaseAmount) : 0;
  
  if (rentSteps.length === 0) {
    // No rent steps - use base rent for entire lease
    schedule.push({
      effectiveDate: leaseStart,
      endDate: leaseEnd,
      monthlyBaseRent: normalizeToMonthlyRent(baseRent, lease.rateType || 'monthly'),
      sourceType: 'lease',
      sourceId: lease.id,
    });
    return schedule;
  }
  
  // Sort rent steps by effective date
  const sortedSteps = [...rentSteps].sort((a, b) => {
    return new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime();
  });
  
  // Add initial period from lease start to first rent step
  const firstStepDate = new Date(sortedSteps[0].effectiveDate);
  if (isAfter(firstStepDate, leaseStart)) {
    schedule.push({
      effectiveDate: leaseStart,
      endDate: new Date(firstStepDate.getTime() - 24 * 60 * 60 * 1000), // Day before first step
      monthlyBaseRent: normalizeToMonthlyRent(baseRent, lease.rateType || 'monthly'),
      sourceType: 'lease',
      sourceId: lease.id,
    });
  }
  
  // Add rent step entries
  for (let i = 0; i < sortedSteps.length; i++) {
    const step = sortedSteps[i];
    const nextStep = sortedSteps[i + 1];
    
    const stepAmount = parseFloat(step.baseRentAmount);
    const monthlyRent = normalizeToMonthlyRent(stepAmount, step.baseRentPeriod);
    
    schedule.push({
      effectiveDate: new Date(step.effectiveDate),
      endDate: nextStep ? new Date(new Date(nextStep.effectiveDate).getTime() - 24 * 60 * 60 * 1000) : leaseEnd,
      monthlyBaseRent: monthlyRent,
      sourceType: 'rent_step',
      sourceId: step.id,
    });
  }
  
  return schedule;
}

/**
 * Normalize rent amount to monthly equivalent
 */
function normalizeToMonthlyRent(amount: number, period: string): number {
  switch (period?.toLowerCase()) {
    case 'year':
    case 'annual':
      return amount / 12;
    case 'week':
    case 'weekly':
      return (amount * 52) / 12;
    case 'day':
    case 'daily':
      return amount * 30;
    case 'season':
    case 'seasonal':
      // Assume 6-month season
      return amount / 6;
    case 'month':
    case 'monthly':
    default:
      return amount;
  }
}

/**
 * Generate a hash of the lease economics input for version tracking
 */
export function generateInputHash(input: LeaseEconomicsInput): string {
  const normalized = {
    leaseId: input.lease.id,
    leaseAmount: input.lease.leaseAmount,
    leaseStart: input.lease.leaseCommencement,
    leaseEnd: input.lease.leaseExpiration,
    termIds: input.terms.map(t => t.id).sort(),
    stepIds: input.rentSteps.map(s => s.id).sort(),
    escalationIds: input.escalations.map(e => e.id).sort(),
    concessionIds: input.concessions.map(c => c.id).sort(),
  };
  
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex')
    .substring(0, 16);
}

/**
 * Check if a lease uses legacy calculation (no V2 data)
 */
export function usesLegacyCalculation(plan: LeaseEconomicsPlan): boolean {
  return plan.useLegacyCalculation;
}

/**
 * Get the rent amount for a specific date from the schedule
 */
export function getRentForDate(
  date: Date,
  schedule: CompiledRentEntry[]
): number {
  const targetDate = startOfMonth(date);
  
  // Find the applicable rent entry
  for (const entry of schedule) {
    const entryStart = startOfMonth(entry.effectiveDate);
    const entryEnd = entry.endDate ? startOfMonth(entry.endDate) : new Date(2099, 11, 31);
    
    if (!isBefore(targetDate, entryStart) && !isAfter(targetDate, entryEnd)) {
      return entry.monthlyBaseRent;
    }
  }
  
  // Default to last entry or 0
  return schedule.length > 0 ? schedule[schedule.length - 1].monthlyBaseRent : 0;
}
