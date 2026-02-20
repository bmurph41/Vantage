/**
 * Debt Schedule Service - Monthly Amortization for Pro Forma Integration
 * 
 * Phase 4: Capital Stack Integration
 * 
 * Generates monthly debt service schedules that integrate with:
 * - Pro Forma Engine (monthly cash flows)
 * - Capital Stack Service (debt tranches)
 * - Sensitivity Matrix (DSCR metrics)
 */

import { db } from '../db';
import { 
  capitalStacks,
  debtTranches,
  type DebtTranche,
  type ForwardCurvePoint,
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { getStoredForwardCurve, calculateForwardCurve } from './capital-markets/fred-service';

// ============================================
// TYPES
// ============================================

export interface MonthlyDebtPayment {
  periodKey: string;       // YYYY-MM
  periodIndex: number;     // 0-based month index
  year: number;
  month: number;
  
  // Per tranche breakdown
  tranchePayments: TrancheMonthlyPayment[];
  
  // Totals across all tranches
  totalPayment: number;
  totalPrincipal: number;
  totalInterest: number;
  totalBalance: number;
}

export interface TrancheMonthlyPayment {
  trancheId: string;
  trancheName: string;
  
  payment: number;          // Monthly P&I or IO payment
  principal: number;        // Principal portion
  interest: number;         // Interest portion
  balance: number;          // Remaining balance
  effectiveRate?: number;   // Effective annual rate (may vary for floating)
  
  isInterestOnly: boolean;  // Whether in IO period
  ioPeriodsRemaining: number;
}

export interface DebtSchedule {
  capitalStackId: string;
  tranches: DebtTranche[];
  schedule: MonthlyDebtPayment[];
  
  // Summary metrics
  totalDebtAtClose: number;
  blendedRate: number;
  weightedAvgTermMonths: number;
  
  // Annual rollups
  annualDebtService: Record<number, number>;  // year -> total debt service
  annualInterest: Record<number, number>;
  annualPrincipal: Record<number, number>;
}

export interface DSCRMetrics {
  monthlyDscr: Record<string, number>;   // YYYY-MM -> DSCR
  annualDscr: Record<number, number>;    // year -> avg DSCR
  minDscr: number;
  avgDscr: number;
  breachMonths: string[];  // Months where DSCR < 1.0
}

// ============================================
// SERVICE CLASS
// ============================================

export class DebtScheduleService {

  /**
   * Generate monthly debt schedule for a capital stack.
   */
  async generateSchedule(
    orgId: string,
    capitalStackId: string,
    holdPeriodMonths: number = 60,
    startYear: number = new Date().getFullYear()
  ): Promise<DebtSchedule | null> {
    // Get capital stack and tranches
    const [stack] = await db.select()
      .from(capitalStacks)
      .where(and(
        eq(capitalStacks.id, capitalStackId),
        eq(capitalStacks.orgId, orgId)
      ))
      .limit(1);
    
    if (!stack) return null;
    
    const tranches = await db.select()
      .from(debtTranches)
      .where(eq(debtTranches.capitalStackId, capitalStackId));
    
    if (tranches.length === 0) {
      // No debt - return empty schedule
      return {
        capitalStackId,
        tranches: [],
        schedule: this.generateEmptySchedule(holdPeriodMonths, startYear),
        totalDebtAtClose: 0,
        blendedRate: 0,
        weightedAvgTermMonths: 0,
        annualDebtService: {},
        annualInterest: {},
        annualPrincipal: {},
      };
    }
    
    const hasFloatingTranches = tranches.some(t => t.indexRate && t.spreadBps);
    let forwardCurveYearRates: Record<number, number> = {};

    if (hasFloatingTranches) {
      try {
        const holdYears = Math.ceil(holdPeriodMonths / 12);
        const maxMonths = holdYears * 12;
        let points = await getStoredForwardCurve('sofr');
        if (points.length === 0) {
          points = await calculateForwardCurve('sofr', maxMonths);
        }
        if (points.length > 0) {
          for (let yr = 0; yr < holdYears; yr++) {
            const midpointMonth = yr * 12 + 6;
            const closest = points.reduce((prev, curr) =>
              Math.abs(curr.forwardMonths - midpointMonth) < Math.abs(prev.forwardMonths - midpointMonth) ? curr : prev
            );
            forwardCurveYearRates[startYear + yr] = closest.forwardRate / 100;
          }
        }
      } catch (err) {
        console.warn('[DebtSchedule] Forward curve fetch failed, using fixed rates:', err);
      }
    }

    // Initialize tranche states
    const trancheStates = tranches.map(t => {
      const isFloating = !!(t.indexRate && t.spreadBps);
      const baseRate = parseFloat(t.interestRate?.toString() || '0') / 100;
      const spreadDecimal = (t.spreadBps || 0) / 10000;
      const floorRate = t.floorRate ? parseFloat(t.floorRate.toString()) / 100 : 0;

      return {
        tranche: t,
        balance: parseFloat(t.principal?.toString() || '0'),
        ioPeriodsRemaining: (t.interestOnlyMonths || 0),
        baseRate,
        rate: baseRate,
        isFloating,
        spreadDecimal,
        floorRate,
        amortMonths: (t.amortizationYears || 30) * 12,
        termMonths: (t.termYears || 10) * 12,
      };
    });
    
    const schedule: MonthlyDebtPayment[] = [];
    const annualDebtService: Record<number, number> = {};
    const annualInterest: Record<number, number> = {};
    const annualPrincipal: Record<number, number> = {};
    
    // Generate monthly schedule
    for (let i = 0; i < holdPeriodMonths; i++) {
      const date = new Date(startYear, i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const periodKey = `${year}-${String(month).padStart(2, '0')}`;
      
      const tranchePayments: TrancheMonthlyPayment[] = [];
      let totalPayment = 0;
      let totalPrincipal = 0;
      let totalInterest = 0;
      let totalBalance = 0;
      
      for (const state of trancheStates) {
        if (state.balance <= 0) continue;

        if (state.isFloating && forwardCurveYearRates[year] !== undefined) {
          let allInRate = forwardCurveYearRates[year] + state.spreadDecimal;
          if (state.floorRate > 0) {
            allInRate = Math.max(allInRate, state.floorRate);
          }
          state.rate = allInRate;
        }
        
        const monthlyRate = state.rate / 12;
        let payment = 0;
        let principal = 0;
        let interest = 0;
        const isInterestOnly = state.ioPeriodsRemaining > 0;
        
        if (isInterestOnly) {
          interest = state.balance * monthlyRate;
          payment = interest;
          principal = 0;
          state.ioPeriodsRemaining--;
        } else {
          if (state.rate === 0) {
            payment = state.balance / Math.max(state.amortMonths - i, 1);
            principal = payment;
            interest = 0;
          } else {
            const remainingPayments = state.amortMonths - (i - ((state.tranche.interestOnlyMonths || 0)));
            if (remainingPayments > 0) {
              payment = (state.balance * monthlyRate * Math.pow(1 + monthlyRate, remainingPayments)) /
                        (Math.pow(1 + monthlyRate, remainingPayments) - 1);
              interest = state.balance * monthlyRate;
              principal = payment - interest;
            }
          }
          
          principal = Math.min(principal, state.balance);
          state.balance -= principal;
        }
        
        tranchePayments.push({
          trancheId: state.tranche.id,
          trancheName: state.tranche.name || `Tranche ${state.tranche.seniority || 1}`,
          payment: Math.round(payment * 100) / 100,
          principal: Math.round(principal * 100) / 100,
          interest: Math.round(interest * 100) / 100,
          balance: Math.round(state.balance * 100) / 100,
          effectiveRate: Math.round(state.rate * 10000) / 10000,
          isInterestOnly,
          ioPeriodsRemaining: state.ioPeriodsRemaining,
        });
        
        totalPayment += payment;
        totalPrincipal += principal;
        totalInterest += interest;
        totalBalance += state.balance;
      }
      
      schedule.push({
        periodKey,
        periodIndex: i,
        year,
        month,
        tranchePayments,
        totalPayment: Math.round(totalPayment * 100) / 100,
        totalPrincipal: Math.round(totalPrincipal * 100) / 100,
        totalInterest: Math.round(totalInterest * 100) / 100,
        totalBalance: Math.round(totalBalance * 100) / 100,
      });
      
      // Annual rollups
      annualDebtService[year] = (annualDebtService[year] || 0) + totalPayment;
      annualInterest[year] = (annualInterest[year] || 0) + totalInterest;
      annualPrincipal[year] = (annualPrincipal[year] || 0) + totalPrincipal;
    }
    
    // Calculate summary metrics
    const totalDebtAtClose = tranches.reduce(
      (sum, t) => sum + parseFloat(t.principal?.toString() || '0'), 0
    );
    
    const blendedRate = totalDebtAtClose > 0
      ? tranches.reduce((sum, t) => {
          const amount = parseFloat(t.principal?.toString() || '0');
          const rate = parseFloat(t.interestRate?.toString() || '0');
          return sum + (amount * rate);
        }, 0) / totalDebtAtClose
      : 0;
    
    const weightedAvgTermMonths = totalDebtAtClose > 0
      ? tranches.reduce((sum, t) => {
          const amount = parseFloat(t.principal?.toString() || '0');
          const termMonths = (t.termYears || 10) * 12;
          return sum + (amount * termMonths);
        }, 0) / totalDebtAtClose
      : 0;
    
    return {
      capitalStackId,
      tranches,
      schedule,
      totalDebtAtClose,
      blendedRate,
      weightedAvgTermMonths,
      annualDebtService,
      annualInterest,
      annualPrincipal,
    };
  }

  /**
   * Generate empty schedule (for all-equity deals).
   */
  private generateEmptySchedule(
    holdPeriodMonths: number,
    startYear: number
  ): MonthlyDebtPayment[] {
    const schedule: MonthlyDebtPayment[] = [];
    
    for (let i = 0; i < holdPeriodMonths; i++) {
      const date = new Date(startYear, i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const periodKey = `${year}-${String(month).padStart(2, '0')}`;
      
      schedule.push({
        periodKey,
        periodIndex: i,
        year,
        month,
        tranchePayments: [],
        totalPayment: 0,
        totalPrincipal: 0,
        totalInterest: 0,
        totalBalance: 0,
      });
    }
    
    return schedule;
  }

  /**
   * Calculate DSCR metrics from NOI and debt schedule.
   */
  calculateDSCR(
    monthlyNoi: Record<string, number>,  // YYYY-MM -> NOI
    debtSchedule: DebtSchedule
  ): DSCRMetrics {
    const monthlyDscr: Record<string, number> = {};
    const annualNoi: Record<number, number> = {};
    const breachMonths: string[] = [];
    
    // Calculate monthly DSCR
    for (const payment of debtSchedule.schedule) {
      const noi = monthlyNoi[payment.periodKey] || 0;
      const dscr = payment.totalPayment > 0 
        ? noi / payment.totalPayment 
        : (noi > 0 ? Infinity : 0);
      
      monthlyDscr[payment.periodKey] = Math.round(dscr * 100) / 100;
      
      if (dscr < 1.0 && payment.totalPayment > 0) {
        breachMonths.push(payment.periodKey);
      }
      
      // Sum NOI by year for annual DSCR calc
      annualNoi[payment.year] = (annualNoi[payment.year] || 0) + noi;
    }
    
    // Calculate annual DSCR
    const annualDscr: Record<number, number> = {};
    for (const [year, noi] of Object.entries(annualNoi)) {
      const debtService = debtSchedule.annualDebtService[parseInt(year)] || 0;
      annualDscr[parseInt(year)] = debtService > 0 
        ? Math.round((noi / debtService) * 100) / 100
        : (noi > 0 ? Infinity : 0);
    }
    
    // Calculate min and avg DSCR
    const dscrValues = Object.values(monthlyDscr).filter(d => isFinite(d) && d > 0);
    const minDscr = dscrValues.length > 0 ? Math.min(...dscrValues) : 0;
    const avgDscr = dscrValues.length > 0 
      ? Math.round((dscrValues.reduce((a, b) => a + b, 0) / dscrValues.length) * 100) / 100
      : 0;
    
    return {
      monthlyDscr,
      annualDscr,
      minDscr,
      avgDscr,
      breachMonths,
    };
  }

  /**
   * Get debt service for a specific period.
   * Used by Pro Forma Engine for monthly cash flow calculations.
   */
  getDebtServiceForPeriod(
    debtSchedule: DebtSchedule,
    periodKey: string
  ): { payment: number; principal: number; interest: number } {
    const payment = debtSchedule.schedule.find(p => p.periodKey === periodKey);
    
    if (!payment) {
      return { payment: 0, principal: 0, interest: 0 };
    }
    
    return {
      payment: payment.totalPayment,
      principal: payment.totalPrincipal,
      interest: payment.totalInterest,
    };
  }

  /**
   * Calculate debt yield for a period.
   */
  calculateDebtYield(
    annualNoi: number,
    outstandingDebt: number
  ): number {
    if (outstandingDebt <= 0) return 0;
    return Math.round((annualNoi / outstandingDebt) * 10000) / 100; // As percentage
  }
}

export const debtScheduleService = new DebtScheduleService();
