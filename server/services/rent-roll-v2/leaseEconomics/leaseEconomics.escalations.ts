/**
 * Lease Economics Escalations Module
 * 
 * Handles rent escalation calculations: fixed percent, fixed amount, CPI-linked.
 */

import { 
  addYears, 
  addMonths, 
  isBefore, 
  isAfter, 
  isEqual,
  differenceInMonths,
  startOfMonth
} from 'date-fns';
import type { LeaseEscalation, EscalationType, EscalationFrequency } from '@shared/schema';
import type { AppliedEscalation } from './leaseEconomics.types';

/**
 * Escalation calculation result
 */
export interface EscalationResult {
  newBaseRent: number;
  escalationAmount: number;
  appliedEscalations: AppliedEscalation[];
}

/**
 * Calculate escalated rent for a given period
 */
export function calculateEscalatedRent(
  baseRent: number,
  periodDate: Date,
  leaseStartDate: Date,
  escalations: LeaseEscalation[],
  cpiRate?: number
): EscalationResult {
  if (escalations.length === 0) {
    return {
      newBaseRent: baseRent,
      escalationAmount: 0,
      appliedEscalations: [],
    };
  }

  let currentRent = baseRent;
  let totalEscalation = 0;
  const appliedEscalations: AppliedEscalation[] = [];

  // Sort escalations by effective date or calculation order
  const sortedEscalations = [...escalations].sort((a, b) => {
    if (a.effectiveDate && b.effectiveDate) {
      return new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime();
    }
    return 0;
  });

  for (const escalation of sortedEscalations) {
    const result = applyEscalation(
      currentRent,
      periodDate,
      leaseStartDate,
      escalation,
      cpiRate
    );

    if (result.applied) {
      totalEscalation += result.escalationAmount;
      currentRent = result.newRent;
      appliedEscalations.push({
        escalationId: escalation.id,
        type: escalation.escalationType,
        value: parseFloat(escalation.value),
        calculatedAmount: result.escalationAmount,
      });
    }
  }

  return {
    newBaseRent: currentRent,
    escalationAmount: totalEscalation,
    appliedEscalations,
  };
}

/**
 * Apply a single escalation rule
 */
function applyEscalation(
  baseRent: number,
  periodDate: Date,
  leaseStartDate: Date,
  escalation: LeaseEscalation,
  cpiRate?: number
): { applied: boolean; newRent: number; escalationAmount: number } {
  const value = parseFloat(escalation.value);
  const cap = escalation.cap ? parseFloat(escalation.cap) : undefined;
  const floor = escalation.floor ? parseFloat(escalation.floor) : undefined;

  // Check if escalation applies to this period
  if (!shouldApplyEscalation(periodDate, leaseStartDate, escalation)) {
    return { applied: false, newRent: baseRent, escalationAmount: 0 };
  }

  // Calculate the number of escalation periods that have occurred
  const periodsElapsed = getEscalationPeriodsElapsed(
    periodDate,
    leaseStartDate,
    escalation.effectiveDate ? new Date(escalation.effectiveDate) : null,
    escalation.frequency
  );

  if (periodsElapsed <= 0) {
    return { applied: false, newRent: baseRent, escalationAmount: 0 };
  }

  let escalationAmount = 0;

  switch (escalation.escalationType) {
    case 'fixed_percent':
      // Compound the escalation for each period
      const compoundedRate = Math.pow(1 + value, periodsElapsed) - 1;
      escalationAmount = baseRent * compoundedRate;
      break;

    case 'fixed_amount':
      // Simple multiplication for fixed amount
      escalationAmount = value * periodsElapsed;
      break;

    case 'cpi_linked':
      // Use provided CPI rate or default to 0
      const effectiveCpiRate = cpiRate || 0;
      const compoundedCpi = Math.pow(1 + effectiveCpiRate, periodsElapsed) - 1;
      escalationAmount = baseRent * compoundedCpi;
      break;

    default:
      return { applied: false, newRent: baseRent, escalationAmount: 0 };
  }

  // Apply cap and floor
  if (cap !== undefined && escalationAmount > baseRent * cap) {
    escalationAmount = baseRent * cap;
  }
  if (floor !== undefined && escalationAmount < baseRent * floor) {
    escalationAmount = baseRent * floor;
  }

  return {
    applied: true,
    newRent: baseRent + escalationAmount,
    escalationAmount,
  };
}

/**
 * Determine if an escalation should apply to a given period
 */
function shouldApplyEscalation(
  periodDate: Date,
  leaseStartDate: Date,
  escalation: LeaseEscalation
): boolean {
  const periodStart = startOfMonth(periodDate);

  // For ON_DATE frequency, check if we've passed the effective date
  if (escalation.frequency === 'on_date' && escalation.effectiveDate) {
    const effectiveDate = new Date(escalation.effectiveDate);
    return !isBefore(periodStart, effectiveDate);
  }

  // For periodic escalations, check if at least one period has elapsed
  return getEscalationPeriodsElapsed(
    periodDate,
    leaseStartDate,
    escalation.effectiveDate ? new Date(escalation.effectiveDate) : null,
    escalation.frequency
  ) > 0;
}

/**
 * Calculate how many escalation periods have elapsed
 */
function getEscalationPeriodsElapsed(
  periodDate: Date,
  leaseStartDate: Date,
  effectiveDate: Date | null,
  frequency: EscalationFrequency
): number {
  const startDate = effectiveDate || leaseStartDate;
  const periodStart = startOfMonth(periodDate);
  
  if (isBefore(periodStart, startDate)) {
    return 0;
  }

  const monthsElapsed = differenceInMonths(periodStart, startDate);

  switch (frequency) {
    case 'annual':
      return Math.floor(monthsElapsed / 12);
    case 'monthly':
      return monthsElapsed;
    case 'on_date':
      return 1; // Single application
    default:
      return 0;
  }
}

/**
 * Calculate the total escalation impact over a date range
 */
export function calculateTotalEscalationImpact(
  baseRent: number,
  startDate: Date,
  endDate: Date,
  escalations: LeaseEscalation[],
  cpiRate?: number
): number {
  let totalImpact = 0;
  let currentDate = startOfMonth(startDate);
  
  while (isBefore(currentDate, endDate) || isEqual(currentDate, endDate)) {
    const result = calculateEscalatedRent(
      baseRent,
      currentDate,
      startDate,
      escalations,
      cpiRate
    );
    totalImpact += result.escalationAmount;
    currentDate = addMonths(currentDate, 1);
  }
  
  return totalImpact;
}
