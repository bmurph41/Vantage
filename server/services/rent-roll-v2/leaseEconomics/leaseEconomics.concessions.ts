/**
 * Lease Economics Concessions Module
 * 
 * Handles concession calculations: free rent, one-time credits, amortized concessions.
 */

import { 
  startOfMonth, 
  endOfMonth, 
  isBefore, 
  isAfter, 
  isEqual,
  differenceInMonths,
  addMonths
} from 'date-fns';
import type { LeaseConcession, ConcessionType } from '@shared/schema';
import type { AppliedConcession, CompiledConcessionEntry } from './leaseEconomics.types';

/**
 * Concession calculation result for a period
 */
export interface ConcessionResult {
  totalConcession: number;
  appliedConcessions: AppliedConcession[];
  remainingRent: number;
}

/**
 * Calculate concessions for a given period
 */
export function calculateConcessions(
  baseRent: number,
  periodDate: Date,
  concessions: LeaseConcession[]
): ConcessionResult {
  if (concessions.length === 0) {
    return {
      totalConcession: 0,
      appliedConcessions: [],
      remainingRent: baseRent,
    };
  }

  let totalConcession = 0;
  const appliedConcessions: AppliedConcession[] = [];
  const periodStart = startOfMonth(periodDate);

  for (const concession of concessions) {
    const result = applyConcession(baseRent, periodStart, concession);
    
    if (result.applied) {
      totalConcession += result.amount;
      appliedConcessions.push({
        concessionId: concession.id,
        type: concession.concessionType,
        amount: result.amount,
      });
    }
  }

  // Concession cannot exceed base rent
  const effectiveConcession = Math.min(totalConcession, baseRent);
  
  return {
    totalConcession: effectiveConcession,
    appliedConcessions,
    remainingRent: Math.max(0, baseRent - effectiveConcession),
  };
}

/**
 * Apply a single concession to a period
 */
function applyConcession(
  baseRent: number,
  periodDate: Date,
  concession: LeaseConcession
): { applied: boolean; amount: number } {
  const amount = parseFloat(concession.amount);
  
  switch (concession.concessionType) {
    case 'free_rent':
      return applyFreeRent(baseRent, periodDate, concession);
      
    case 'one_time_credit':
      return applyOneTimeCredit(amount, periodDate, concession);
      
    case 'amortized_concession':
      return applyAmortizedConcession(amount, periodDate, concession);
      
    default:
      return { applied: false, amount: 0 };
  }
}

/**
 * Apply free rent concession
 * Free rent = 100% reduction during the concession period
 */
function applyFreeRent(
  baseRent: number,
  periodDate: Date,
  concession: LeaseConcession
): { applied: boolean; amount: number } {
  if (!isWithinConcessionPeriod(periodDate, concession)) {
    return { applied: false, amount: 0 };
  }
  
  // Free rent reduces rent by 100% (or by specified amount if provided)
  const amount = parseFloat(concession.amount);
  const reductionAmount = amount > 0 ? Math.min(amount, baseRent) : baseRent;
  
  return { applied: true, amount: reductionAmount };
}

/**
 * Apply one-time credit
 * Credit applied only in the first month of the concession period
 */
function applyOneTimeCredit(
  creditAmount: number,
  periodDate: Date,
  concession: LeaseConcession
): { applied: boolean; amount: number } {
  if (!concession.startDate) {
    return { applied: false, amount: 0 };
  }
  
  const creditMonth = startOfMonth(new Date(concession.startDate));
  const currentMonth = startOfMonth(periodDate);
  
  // One-time credit applies only in the specified month
  if (isEqual(creditMonth, currentMonth)) {
    return { applied: true, amount: creditAmount };
  }
  
  return { applied: false, amount: 0 };
}

/**
 * Apply amortized concession
 * Total concession spread evenly over specified months
 */
function applyAmortizedConcession(
  totalAmount: number,
  periodDate: Date,
  concession: LeaseConcession
): { applied: boolean; amount: number } {
  if (!concession.startDate || !concession.amortizeOverMonths) {
    return { applied: false, amount: 0 };
  }
  
  const startMonth = startOfMonth(new Date(concession.startDate));
  const endMonth = addMonths(startMonth, concession.amortizeOverMonths - 1);
  const currentMonth = startOfMonth(periodDate);
  
  // Check if current period is within amortization window
  if (isBefore(currentMonth, startMonth) || isAfter(currentMonth, endMonth)) {
    return { applied: false, amount: 0 };
  }
  
  // Spread evenly over the amortization period
  const monthlyAmount = totalAmount / concession.amortizeOverMonths;
  
  return { applied: true, amount: monthlyAmount };
}

/**
 * Check if a period is within a concession's date range
 */
function isWithinConcessionPeriod(
  periodDate: Date,
  concession: LeaseConcession
): boolean {
  const periodStart = startOfMonth(periodDate);
  
  if (concession.startDate) {
    const concessionStart = startOfMonth(new Date(concession.startDate));
    if (isBefore(periodStart, concessionStart)) {
      return false;
    }
  }
  
  if (concession.endDate) {
    const concessionEnd = endOfMonth(new Date(concession.endDate));
    if (isAfter(periodStart, concessionEnd)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Compile concessions into a monthly schedule
 */
export function compileConcessionSchedule(
  concessions: LeaseConcession[],
  leaseStart: Date,
  leaseEnd: Date | null
): CompiledConcessionEntry[] {
  const schedule: CompiledConcessionEntry[] = [];
  
  for (const concession of concessions) {
    const amount = parseFloat(concession.amount);
    
    switch (concession.concessionType) {
      case 'free_rent':
        schedule.push({
          type: 'free_rent',
          startDate: concession.startDate ? new Date(concession.startDate) : leaseStart,
          endDate: concession.endDate ? new Date(concession.endDate) : null,
          monthlyAmount: amount,
          totalAmount: amount,
          sourceId: concession.id,
        });
        break;
        
      case 'one_time_credit':
        schedule.push({
          type: 'one_time_credit',
          startDate: concession.startDate ? new Date(concession.startDate) : leaseStart,
          endDate: concession.startDate ? new Date(concession.startDate) : leaseStart,
          monthlyAmount: amount,
          totalAmount: amount,
          sourceId: concession.id,
        });
        break;
        
      case 'amortized_concession':
        const months = concession.amortizeOverMonths || 12;
        const monthlyAmount = amount / months;
        schedule.push({
          type: 'amortized_concession',
          startDate: concession.startDate ? new Date(concession.startDate) : leaseStart,
          endDate: concession.startDate 
            ? addMonths(new Date(concession.startDate), months - 1) 
            : addMonths(leaseStart, months - 1),
          monthlyAmount,
          totalAmount: amount,
          sourceId: concession.id,
        });
        break;
    }
  }
  
  return schedule;
}

/**
 * Calculate total concession impact over a date range
 */
export function calculateTotalConcessionImpact(
  baseRent: number,
  startDate: Date,
  endDate: Date,
  concessions: LeaseConcession[]
): number {
  let totalImpact = 0;
  let currentDate = startOfMonth(startDate);
  
  while (isBefore(currentDate, endDate) || isEqual(currentDate, endDate)) {
    const result = calculateConcessions(baseRent, currentDate, concessions);
    totalImpact += result.totalConcession;
    currentDate = addMonths(currentDate, 1);
  }
  
  return totalImpact;
}
