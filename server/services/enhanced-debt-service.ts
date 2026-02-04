/**
 * Enhanced Debt Modeling Service
 * 
 * Comprehensive multi-loan structures with:
 * - Blended loan calculations (combine multiple loans into weighted average)
 * - Loan comparison engine (side-by-side analysis)
 * - Monthly debt application with running balances
 * - DSCR covenant testing with pass/fail tracking
 * - Cash flow integration
 * - Loan lifecycle management (bridge to perm, refinancing)
 */

import { db } from '../db';
import {
  debtTranches,
  capitalStacks,
  loanStructures,
  loanDetails,
  monthlyLoanSchedule,
  dscrTestResults,
  loanComparisonScenarios,
  type DebtTranche,
  type CapitalStack,
  type LoanStructure,
  type LoanDetails,
  type MonthlyLoanSchedule,
  type DscrTestResult,
  type LoanComparisonScenario,
} from '@shared/schema';
import { eq, and, desc, asc } from 'drizzle-orm';

// ============================================================================
// TYPES
// ============================================================================

export interface LoanInputs {
  name: string;
  principal: number;
  interestRate: number; // Annual rate as decimal (e.g., 0.065 for 6.5%)
  termMonths: number;
  amortizationMonths: number;
  interestOnlyMonths: number;
  loanPurpose: 'acquisition' | 'construction' | 'bridge' | 'permanent' | 'refinancing' | 'mezzanine' | 'preferred_equity' | 'line_of_credit';
  lenderName?: string;
  ltvAtOrigination?: number;
  exitFeePct?: number;
  exitFeeAmount?: number;
  prepaymentPenaltyType?: 'none' | 'declining_balance' | 'yield_maintenance' | 'defeasance' | 'step_down' | 'lockout' | 'custom';
  prepaymentSchedule?: { yearStart: number; yearEnd: number; penaltyPct: number }[];
  dscrMinimum?: number;
  dscrTestFrequency?: 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'at_closing' | 'at_maturity';
  dscrTestStartMonth?: number;
  isFloatingRate?: boolean;
  floatingRateIndex?: string;
  floatingRateSpreadBps?: number;
  rateCap?: number;
  rateFloor?: number;
}

export interface BlendedLoanMetrics {
  totalDebtAmount: number;
  blendedInterestRate: number; // Weighted average
  blendedTermMonths: number; // Weighted average
  combinedLtv: number;
  totalAnnualDebtService: number;
  totalMonthlyDebtService: number;
  weightedAvgAmortization: number;
  debtYield: number;
  blendedDscr: number;
  loans: {
    id: string;
    name: string;
    principal: number;
    rate: number;
    weight: number; // % of total debt
    annualDebtService: number;
    monthlyPayment: number;
  }[];
}

export interface LoanComparisonResult {
  loanId: string;
  loanName: string;
  totalInterestPaid: number;
  totalPayments: number;
  effectiveRate: number;
  monthlyPayment: number;
  breakEvenMonth: number | null;
  totalCostOfDebt: number; // Principal + Interest + Fees
  annualDebtService: number;
  endingBalance: number;
  averageDscr: number;
}

export interface MonthlyPaymentSchedule {
  periodMonth: number;
  periodYear: number;
  periodDate: string;
  beginningBalance: number;
  endingBalance: number;
  scheduledPayment: number;
  principalPayment: number;
  interestPayment: number;
  interestRate: number;
  isInterestOnly: boolean;
  cumulativePrincipal: number;
  cumulativeInterest: number;
  noi?: number;
  dscr?: number;
  dscrPassFail?: boolean;
}

export interface DscrTestInput {
  testDate: Date;
  testPeriod: string;
  trailingNoi: number;
  annualDebtService: number;
  requiredDscr: number;
}

// ============================================================================
// ENHANCED DEBT SERVICE CLASS
// ============================================================================

export class EnhancedDebtService {
  
  // ============================================================================
  // BLENDED LOAN CALCULATIONS
  // ============================================================================

  /**
   * Calculate blended metrics for multiple loans combined
   */
  calculateBlendedMetrics(
    loans: LoanInputs[],
    purchasePrice: number,
    noi: number
  ): BlendedLoanMetrics {
    const totalDebtAmount = loans.reduce((sum, loan) => sum + loan.principal, 0);
    
    // Calculate weighted averages
    let weightedRateSum = 0;
    let weightedTermSum = 0;
    let weightedAmortSum = 0;
    let totalAnnualDebtService = 0;
    
    const loanDetails: BlendedLoanMetrics['loans'] = loans.map(loan => {
      const weight = loan.principal / totalDebtAmount;
      const monthlyPayment = this.calculateMonthlyPayment(
        loan.principal,
        loan.interestRate,
        loan.amortizationMonths,
        loan.interestOnlyMonths > 0
      );
      const annualDebtService = monthlyPayment * 12;
      
      weightedRateSum += loan.interestRate * weight;
      weightedTermSum += loan.termMonths * weight;
      weightedAmortSum += loan.amortizationMonths * weight;
      totalAnnualDebtService += annualDebtService;
      
      return {
        id: `loan_${loans.indexOf(loan)}`,
        name: loan.name,
        principal: loan.principal,
        rate: loan.interestRate,
        weight,
        annualDebtService,
        monthlyPayment,
      };
    });
    
    const combinedLtv = purchasePrice > 0 ? (totalDebtAmount / purchasePrice) * 100 : 0;
    const debtYield = totalDebtAmount > 0 ? (noi / totalDebtAmount) * 100 : 0;
    const blendedDscr = totalAnnualDebtService > 0 ? noi / totalAnnualDebtService : 0;
    
    return {
      totalDebtAmount,
      blendedInterestRate: weightedRateSum,
      blendedTermMonths: Math.round(weightedTermSum),
      combinedLtv,
      totalAnnualDebtService,
      totalMonthlyDebtService: totalAnnualDebtService / 12,
      weightedAvgAmortization: Math.round(weightedAmortSum),
      debtYield,
      blendedDscr,
      loans: loanDetails,
    };
  }

  /**
   * Calculate monthly payment (P&I or IO)
   */
  private calculateMonthlyPayment(
    principal: number,
    annualRate: number,
    amortMonths: number,
    isInterestOnly: boolean = false
  ): number {
    if (principal <= 0) return 0;
    
    const monthlyRate = annualRate / 12;
    
    if (isInterestOnly || monthlyRate === 0) {
      return principal * monthlyRate;
    }
    
    // Standard amortization formula
    const payment = (principal * monthlyRate * Math.pow(1 + monthlyRate, amortMonths)) /
                    (Math.pow(1 + monthlyRate, amortMonths) - 1);
    
    return Math.round(payment * 100) / 100;
  }

  // ============================================================================
  // LOAN COMPARISON ENGINE
  // ============================================================================

  /**
   * Compare multiple loan scenarios side-by-side
   */
  compareLoanScenarios(
    loans: LoanInputs[],
    noi: number,
    holdPeriodMonths: number = 60
  ): LoanComparisonResult[] {
    return loans.map(loan => {
      const schedule = this.generateAmortizationSchedule(loan, holdPeriodMonths, noi);
      
      const totalInterestPaid = schedule.reduce((sum, p) => sum + p.interestPayment, 0);
      const totalPayments = schedule.reduce((sum, p) => sum + p.scheduledPayment, 0);
      const lastPeriod = schedule[schedule.length - 1];
      const monthlyPayment = schedule[0]?.scheduledPayment || 0;
      const annualDebtService = monthlyPayment * 12;
      
      // Calculate effective rate (total interest / average balance / years)
      const avgBalance = schedule.reduce((sum, p) => sum + p.beginningBalance, 0) / schedule.length;
      const years = holdPeriodMonths / 12;
      const effectiveRate = avgBalance > 0 ? (totalInterestPaid / avgBalance / years) : 0;
      
      // Calculate break-even (when principal paid equals initial fees)
      const fees = (loan.principal * (loan.exitFeePct || 0));
      let cumulativePrincipal = 0;
      let breakEvenMonth: number | null = null;
      for (const period of schedule) {
        cumulativePrincipal += period.principalPayment;
        if (cumulativePrincipal >= fees && breakEvenMonth === null) {
          breakEvenMonth = period.periodMonth;
        }
      }
      
      // Average DSCR
      const dscrValues = schedule.filter(p => p.dscr !== undefined).map(p => p.dscr!);
      const averageDscr = dscrValues.length > 0 
        ? dscrValues.reduce((sum, d) => sum + d, 0) / dscrValues.length 
        : 0;
      
      const totalCostOfDebt = totalPayments + fees;
      
      return {
        loanId: `loan_${loans.indexOf(loan)}`,
        loanName: loan.name,
        totalInterestPaid: Math.round(totalInterestPaid * 100) / 100,
        totalPayments: Math.round(totalPayments * 100) / 100,
        effectiveRate: Math.round(effectiveRate * 10000) / 10000,
        monthlyPayment: Math.round(monthlyPayment * 100) / 100,
        breakEvenMonth,
        totalCostOfDebt: Math.round(totalCostOfDebt * 100) / 100,
        annualDebtService: Math.round(annualDebtService * 100) / 100,
        endingBalance: lastPeriod?.endingBalance || 0,
        averageDscr: Math.round(averageDscr * 100) / 100,
      };
    });
  }

  // ============================================================================
  // MONTHLY AMORTIZATION SCHEDULE
  // ============================================================================

  /**
   * Generate complete monthly amortization schedule with DSCR tracking
   */
  generateAmortizationSchedule(
    loan: LoanInputs,
    holdPeriodMonths: number,
    annualNoi?: number,
    startYear: number = new Date().getFullYear()
  ): MonthlyPaymentSchedule[] {
    const schedule: MonthlyPaymentSchedule[] = [];
    let balance = loan.principal;
    let cumulativePrincipal = 0;
    let cumulativeInterest = 0;
    const monthlyRate = loan.interestRate / 12;
    
    // Calculate amortizing payment
    const amortPayment = this.calculateMonthlyPayment(
      loan.principal,
      loan.interestRate,
      loan.amortizationMonths,
      false
    );
    
    const monthlyNoi = annualNoi ? annualNoi / 12 : undefined;
    
    for (let i = 0; i < holdPeriodMonths; i++) {
      const periodMonth = (i % 12) + 1;
      const periodYear = startYear + Math.floor(i / 12);
      const periodDate = new Date(periodYear, periodMonth - 1, 1);
      const isInterestOnly = i < loan.interestOnlyMonths;
      
      const beginningBalance = balance;
      let interestPayment = balance * monthlyRate;
      let principalPayment = 0;
      let scheduledPayment = 0;
      
      if (isInterestOnly) {
        scheduledPayment = interestPayment;
      } else {
        scheduledPayment = amortPayment;
        principalPayment = Math.min(scheduledPayment - interestPayment, balance);
      }
      
      balance = Math.max(0, balance - principalPayment);
      cumulativePrincipal += principalPayment;
      cumulativeInterest += interestPayment;
      
      // DSCR calculation
      let dscr: number | undefined;
      let dscrPassFail: boolean | undefined;
      if (monthlyNoi !== undefined && scheduledPayment > 0) {
        dscr = monthlyNoi / scheduledPayment;
        dscrPassFail = dscr >= (loan.dscrMinimum || 1.20);
      }
      
      schedule.push({
        periodMonth,
        periodYear,
        periodDate: periodDate.toISOString().split('T')[0],
        beginningBalance: Math.round(beginningBalance * 100) / 100,
        endingBalance: Math.round(balance * 100) / 100,
        scheduledPayment: Math.round(scheduledPayment * 100) / 100,
        principalPayment: Math.round(principalPayment * 100) / 100,
        interestPayment: Math.round(interestPayment * 100) / 100,
        interestRate: loan.interestRate,
        isInterestOnly,
        cumulativePrincipal: Math.round(cumulativePrincipal * 100) / 100,
        cumulativeInterest: Math.round(cumulativeInterest * 100) / 100,
        noi: monthlyNoi,
        dscr: dscr !== undefined ? Math.round(dscr * 100) / 100 : undefined,
        dscrPassFail,
      });
    }
    
    return schedule;
  }

  // ============================================================================
  // DSCR COVENANT TESTING
  // ============================================================================

  /**
   * Run DSCR covenant test and return result
   */
  runDscrTest(input: DscrTestInput): {
    passed: boolean;
    calculatedDscr: number;
    cushionAmount: number;
    cushionPct: number;
  } {
    const calculatedDscr = input.annualDebtService > 0 
      ? input.trailingNoi / input.annualDebtService 
      : 0;
    
    const passed = calculatedDscr >= input.requiredDscr;
    const cushionAmount = input.trailingNoi - (input.annualDebtService * input.requiredDscr);
    const cushionPct = input.requiredDscr > 0 
      ? ((calculatedDscr - input.requiredDscr) / input.requiredDscr) * 100 
      : 0;
    
    return {
      passed,
      calculatedDscr: Math.round(calculatedDscr * 100) / 100,
      cushionAmount: Math.round(cushionAmount * 100) / 100,
      cushionPct: Math.round(cushionPct * 100) / 100,
    };
  }

  /**
   * Generate DSCR test schedule based on frequency
   */
  generateDscrTestSchedule(
    loan: LoanInputs,
    holdPeriodMonths: number,
    annualNoi: number,
    noiGrowthRate: number = 0.02,
    startYear: number = new Date().getFullYear()
  ): DscrTestInput[] {
    const tests: DscrTestInput[] = [];
    const frequency = loan.dscrTestFrequency || 'quarterly';
    const testStartMonth = loan.dscrTestStartMonth || 1;
    
    let intervalMonths: number;
    switch (frequency) {
      case 'monthly': intervalMonths = 1; break;
      case 'quarterly': intervalMonths = 3; break;
      case 'semi_annual': intervalMonths = 6; break;
      case 'annual': intervalMonths = 12; break;
      case 'at_closing': return [{
        testDate: new Date(startYear, 0, 1),
        testPeriod: 'At Closing',
        trailingNoi: annualNoi,
        annualDebtService: this.calculateMonthlyPayment(loan.principal, loan.interestRate, loan.amortizationMonths, loan.interestOnlyMonths > 0) * 12,
        requiredDscr: loan.dscrMinimum || 1.20,
      }];
      case 'at_maturity': return [{
        testDate: new Date(startYear + Math.floor(holdPeriodMonths / 12), holdPeriodMonths % 12, 1),
        testPeriod: 'At Maturity',
        trailingNoi: annualNoi * Math.pow(1 + noiGrowthRate, holdPeriodMonths / 12),
        annualDebtService: this.calculateMonthlyPayment(loan.principal, loan.interestRate, loan.amortizationMonths, false) * 12,
        requiredDscr: loan.dscrMinimum || 1.20,
      }];
      default: intervalMonths = 3;
    }
    
    const annualDebtService = this.calculateMonthlyPayment(
      loan.principal, 
      loan.interestRate, 
      loan.amortizationMonths, 
      loan.interestOnlyMonths > 0
    ) * 12;
    
    for (let month = testStartMonth; month <= holdPeriodMonths; month += intervalMonths) {
      const yearOffset = Math.floor(month / 12);
      const growthFactor = Math.pow(1 + noiGrowthRate, yearOffset);
      const testDate = new Date(startYear, month - 1, 1);
      const quarterOrPeriod = frequency === 'quarterly' 
        ? `Q${Math.ceil(((month - 1) % 12 + 1) / 3)} ${startYear + yearOffset}`
        : `${testDate.toLocaleString('default', { month: 'short' })} ${startYear + yearOffset}`;
      
      tests.push({
        testDate,
        testPeriod: quarterOrPeriod,
        trailingNoi: annualNoi * growthFactor,
        annualDebtService,
        requiredDscr: loan.dscrMinimum || 1.20,
      });
    }
    
    return tests;
  }

  // ============================================================================
  // PREPAYMENT PENALTY CALCULATIONS
  // ============================================================================

  /**
   * Calculate prepayment penalty at a given month
   */
  calculatePrepaymentPenalty(
    loan: LoanInputs,
    prepaymentMonth: number,
    outstandingBalance: number
  ): {
    penaltyAmount: number;
    penaltyPct: number;
    description: string;
    isLockoutPeriod: boolean;
  } {
    const type = loan.prepaymentPenaltyType || 'none';
    const year = Math.ceil(prepaymentMonth / 12);
    
    if (type === 'none') {
      return { penaltyAmount: 0, penaltyPct: 0, description: 'No prepayment penalty', isLockoutPeriod: false };
    }
    
    // Check lockout period
    const lockoutMonths = 12; // Typical 1-year lockout for step-down
    if (type === 'lockout' && prepaymentMonth <= lockoutMonths) {
      return {
        penaltyAmount: outstandingBalance, // Cannot prepay during lockout
        penaltyPct: 100,
        description: `Lockout period - prepayment not allowed until month ${lockoutMonths + 1}`,
        isLockoutPeriod: true,
      };
    }
    
    let penaltyPct = 0;
    let description = '';
    
    if (type === 'step_down' && loan.prepaymentSchedule) {
      const schedule = loan.prepaymentSchedule.find(
        s => year >= s.yearStart && year <= s.yearEnd
      );
      penaltyPct = schedule?.penaltyPct || 0;
      description = `Step-down penalty: ${penaltyPct}% in year ${year}`;
    } else if (type === 'declining_balance') {
      // Typical 5-4-3-2-1 declining
      penaltyPct = Math.max(0, 6 - year);
      description = `Declining balance: ${penaltyPct}% in year ${year}`;
    } else if (type === 'yield_maintenance') {
      // Simplified yield maintenance calculation
      const remainingMonths = loan.termMonths - prepaymentMonth;
      const treasuryRate = 0.04; // Would fetch real treasury rate
      const yieldDiff = Math.max(0, loan.interestRate - treasuryRate);
      penaltyPct = yieldDiff * (remainingMonths / 12) * 100;
      description = `Yield maintenance: ${penaltyPct.toFixed(2)}% (${remainingMonths} months remaining)`;
    } else if (type === 'defeasance') {
      description = 'Defeasance required - consult lender for specific costs';
      penaltyPct = 2; // Typical estimate
    }
    
    const penaltyAmount = outstandingBalance * (penaltyPct / 100);
    
    return {
      penaltyAmount: Math.round(penaltyAmount * 100) / 100,
      penaltyPct,
      description,
      isLockoutPeriod: false,
    };
  }

  // ============================================================================
  // EXIT FEE CALCULATIONS
  // ============================================================================

  /**
   * Calculate exit fees at a given month
   */
  calculateExitFees(
    loan: LoanInputs,
    exitMonth: number,
    outstandingBalance: number
  ): {
    exitFeeAmount: number;
    description: string;
    isWaived: boolean;
  } {
    const exitFeePct = loan.exitFeePct || 0;
    const exitFeeAmount = loan.exitFeeAmount || 0;
    
    // Check if exit fee has expired (some loans waive after certain period)
    const expirationMonth = loan.termMonths; // Default to full term
    if (exitMonth >= expirationMonth) {
      return {
        exitFeeAmount: 0,
        description: 'Exit fee waived - loan at maturity',
        isWaived: true,
      };
    }
    
    // Calculate fee (percentage or flat, whichever is greater)
    const percentageFee = outstandingBalance * exitFeePct;
    const totalFee = Math.max(percentageFee, exitFeeAmount);
    
    return {
      exitFeeAmount: Math.round(totalFee * 100) / 100,
      description: percentageFee >= exitFeeAmount 
        ? `Exit fee: ${(exitFeePct * 100).toFixed(2)}% of balance`
        : `Flat exit fee: $${exitFeeAmount.toLocaleString()}`,
      isWaived: false,
    };
  }

  // ============================================================================
  // CASH FLOW INTEGRATION
  // ============================================================================

  /**
   * Generate annual cash flow with debt service integration
   */
  generateAnnualCashFlowWithDebt(
    loans: LoanInputs[],
    annualNoi: number,
    noiGrowthRate: number,
    holdPeriodYears: number,
    startYear: number = new Date().getFullYear()
  ): {
    year: number;
    noi: number;
    totalDebtService: number;
    cashFlowAfterDebt: number;
    dscr: number;
    principalPaydown: number;
    interestExpense: number;
    outstandingBalance: number;
    debtYield: number;
  }[] {
    const results = [];
    
    // Generate schedules for all loans
    const schedules = loans.map(loan => 
      this.generateAmortizationSchedule(loan, holdPeriodYears * 12, annualNoi)
    );
    
    let totalBalance = loans.reduce((sum, loan) => sum + loan.principal, 0);
    
    for (let yearIndex = 0; yearIndex < holdPeriodYears; yearIndex++) {
      const year = startYear + yearIndex;
      const noi = annualNoi * Math.pow(1 + noiGrowthRate, yearIndex);
      
      let totalDebtService = 0;
      let totalPrincipal = 0;
      let totalInterest = 0;
      let yearEndBalance = 0;
      
      // Sum up debt service from all loans for this year
      for (let loanIdx = 0; loanIdx < loans.length; loanIdx++) {
        const schedule = schedules[loanIdx];
        const yearStart = yearIndex * 12;
        const yearEnd = Math.min((yearIndex + 1) * 12, schedule.length);
        
        for (let month = yearStart; month < yearEnd; month++) {
          if (schedule[month]) {
            totalDebtService += schedule[month].scheduledPayment;
            totalPrincipal += schedule[month].principalPayment;
            totalInterest += schedule[month].interestPayment;
          }
        }
        
        // Get year-end balance
        const lastMonthOfYear = Math.min((yearIndex + 1) * 12 - 1, schedule.length - 1);
        if (schedule[lastMonthOfYear]) {
          yearEndBalance += schedule[lastMonthOfYear].endingBalance;
        }
      }
      
      totalBalance = yearEndBalance;
      const cashFlowAfterDebt = noi - totalDebtService;
      const dscr = totalDebtService > 0 ? noi / totalDebtService : 0;
      const debtYield = totalBalance > 0 ? (noi / totalBalance) * 100 : 0;
      
      results.push({
        year,
        noi: Math.round(noi * 100) / 100,
        totalDebtService: Math.round(totalDebtService * 100) / 100,
        cashFlowAfterDebt: Math.round(cashFlowAfterDebt * 100) / 100,
        dscr: Math.round(dscr * 100) / 100,
        principalPaydown: Math.round(totalPrincipal * 100) / 100,
        interestExpense: Math.round(totalInterest * 100) / 100,
        outstandingBalance: Math.round(totalBalance * 100) / 100,
        debtYield: Math.round(debtYield * 100) / 100,
      });
    }
    
    return results;
  }

  // ============================================================================
  // LOAN LIFECYCLE MANAGEMENT
  // ============================================================================

  /**
   * Handle loan transition (bridge to perm, refinancing)
   */
  calculateLoanTransition(
    currentLoan: LoanInputs,
    newLoan: LoanInputs,
    transitionMonth: number,
    noi: number
  ): {
    currentLoanPayoff: number;
    prepaymentPenalty: number;
    exitFees: number;
    newLoanProceeds: number;
    netCashFlow: number;
    monthlyPaymentChange: number;
    newDscr: number;
  } {
    // Get balance at transition
    const currentSchedule = this.generateAmortizationSchedule(currentLoan, transitionMonth + 1, noi);
    const transitionPeriod = currentSchedule[transitionMonth - 1];
    const currentBalance = transitionPeriod?.endingBalance || currentLoan.principal;
    
    // Calculate payoff costs
    const prepaymentPenalty = this.calculatePrepaymentPenalty(currentLoan, transitionMonth, currentBalance);
    const exitFees = this.calculateExitFees(currentLoan, transitionMonth, currentBalance);
    const totalPayoff = currentBalance + prepaymentPenalty.penaltyAmount + exitFees.exitFeeAmount;
    
    // Calculate new loan metrics
    const newMonthlyPayment = this.calculateMonthlyPayment(
      newLoan.principal,
      newLoan.interestRate,
      newLoan.amortizationMonths,
      newLoan.interestOnlyMonths > 0
    );
    const oldMonthlyPayment = transitionPeriod?.scheduledPayment || 0;
    const newAnnualDebtService = newMonthlyPayment * 12;
    const newDscr = newAnnualDebtService > 0 ? noi / newAnnualDebtService : 0;
    
    return {
      currentLoanPayoff: Math.round(currentBalance * 100) / 100,
      prepaymentPenalty: prepaymentPenalty.penaltyAmount,
      exitFees: exitFees.exitFeeAmount,
      newLoanProceeds: newLoan.principal,
      netCashFlow: Math.round((newLoan.principal - totalPayoff) * 100) / 100,
      monthlyPaymentChange: Math.round((newMonthlyPayment - oldMonthlyPayment) * 100) / 100,
      newDscr: Math.round(newDscr * 100) / 100,
    };
  }

  // ============================================================================
  // DATABASE OPERATIONS
  // ============================================================================

  /**
   * Save loan structure to database
   */
  async saveLoanStructure(
    orgId: string,
    userId: string,
    capitalStackId: string,
    data: {
      name: string;
      description?: string;
      structureType: 'single' | 'combined' | 'sequential' | 'layered';
      loans: LoanInputs[];
      purchasePrice: number;
      noi: number;
    }
  ): Promise<LoanStructure> {
    const blendedMetrics = this.calculateBlendedMetrics(data.loans, data.purchasePrice, data.noi);
    
    const [structure] = await db.insert(loanStructures).values({
      orgId,
      capitalStackId,
      name: data.name,
      description: data.description,
      structureType: data.structureType,
      totalDebtAmount: String(blendedMetrics.totalDebtAmount),
      blendedInterestRate: String(blendedMetrics.blendedInterestRate),
      blendedTermMonths: blendedMetrics.blendedTermMonths,
      combinedLtv: String(blendedMetrics.combinedLtv),
      totalAnnualDebtService: String(blendedMetrics.totalAnnualDebtService),
      createdBy: userId,
    }).returning();
    
    return structure;
  }

  /**
   * Get loan structures for a capital stack
   */
  async getLoanStructures(orgId: string, capitalStackId: string): Promise<LoanStructure[]> {
    return db.select()
      .from(loanStructures)
      .where(and(
        eq(loanStructures.orgId, orgId),
        eq(loanStructures.capitalStackId, capitalStackId),
        eq(loanStructures.isActive, true)
      ))
      .orderBy(desc(loanStructures.createdAt));
  }

  /**
   * Save DSCR test result
   */
  async saveDscrTestResult(
    orgId: string,
    debtTrancheId: string,
    capitalStackId: string,
    input: DscrTestInput
  ): Promise<DscrTestResult> {
    const result = this.runDscrTest(input);
    
    const [saved] = await db.insert(dscrTestResults).values({
      orgId,
      debtTrancheId,
      capitalStackId,
      testDate: input.testDate.toISOString().split('T')[0],
      testPeriod: input.testPeriod,
      trailingNoi: String(input.trailingNoi),
      annualDebtService: String(input.annualDebtService),
      calculatedDscr: String(result.calculatedDscr),
      requiredDscr: String(input.requiredDscr),
      passedTest: result.passed,
      cushionAmount: String(result.cushionAmount),
      cushionPct: String(result.cushionPct),
    }).returning();
    
    return saved;
  }

  /**
   * Get DSCR test results for a debt tranche
   */
  async getDscrTestResults(orgId: string, debtTrancheId: string): Promise<DscrTestResult[]> {
    return db.select()
      .from(dscrTestResults)
      .where(and(
        eq(dscrTestResults.orgId, orgId),
        eq(dscrTestResults.debtTrancheId, debtTrancheId)
      ))
      .orderBy(asc(dscrTestResults.testDate));
  }

  // ============================================================================
  // EQUITY WATERFALL INTEGRATION
  // ============================================================================

  /**
   * Calculate exit proceeds after debt payoff and waterfall distribution
   */
  calculateExitWaterfall(
    loans: LoanInputs[],
    holdPeriodMonths: number,
    noi: number,
    noiGrowthRate: number,
    exitCapRate: number,
    purchasePrice: number,
    equityInvested: number,
    promoteTiers: { irrHurdle: number; gpSplit: number; lpSplit: number }[],
    gpContribution: number = 0.10 // GP contributed 10% of equity by default
  ): {
    exitNoi: number;
    exitValuation: number;
    outstandingDebt: number;
    prepaymentPenalties: number;
    exitFees: number;
    totalDebtPayoff: number;
    grossEquityProceeds: number;
    netEquityProceeds: number;
    equityMultiple: number;
    projectIrr: number;
    lpDistribution: number;
    gpDistribution: number;
    gpPromote: number;
    distributionTiers: {
      tierIndex: number;
      irrHurdle: number;
      amountDistributed: number;
      lpShare: number;
      gpShare: number;
    }[];
  } {
    // Calculate exit NOI (grown over hold period)
    const yearsHeld = holdPeriodMonths / 12;
    const exitNoi = noi * Math.pow(1 + noiGrowthRate, yearsHeld);
    
    // Calculate exit valuation
    const exitValuation = exitCapRate > 0 ? exitNoi / exitCapRate : 0;
    
    // Get outstanding debt at exit
    let totalOutstandingDebt = 0;
    let totalPrepaymentPenalties = 0;
    let totalExitFees = 0;
    
    for (const loan of loans) {
      const schedule = this.generateAmortizationSchedule(loan, holdPeriodMonths, noi);
      const lastPeriod = schedule[schedule.length - 1];
      const balance = lastPeriod?.endingBalance || loan.principal;
      totalOutstandingDebt += balance;
      
      const prepayment = this.calculatePrepaymentPenalty(loan, holdPeriodMonths, balance);
      totalPrepaymentPenalties += prepayment.penaltyAmount;
      
      const exitFee = this.calculateExitFees(loan, holdPeriodMonths, balance);
      totalExitFees += exitFee.exitFeeAmount;
    }
    
    const totalDebtPayoff = totalOutstandingDebt + totalPrepaymentPenalties + totalExitFees;
    const grossEquityProceeds = exitValuation;
    const netEquityProceeds = exitValuation - totalDebtPayoff;
    
    // Calculate equity metrics
    const equityMultiple = equityInvested > 0 ? netEquityProceeds / equityInvested : 0;
    
    // Calculate IRR approximation (simplified)
    const projectIrr = yearsHeld > 0 ? (Math.pow(equityMultiple, 1 / yearsHeld) - 1) : 0;
    
    // Calculate waterfall distribution
    const distributionTiers: {
      tierIndex: number;
      irrHurdle: number;
      amountDistributed: number;
      lpShare: number;
      gpShare: number;
    }[] = [];
    
    let remainingProceeds = netEquityProceeds;
    let totalLpDistribution = 0;
    let totalGpDistribution = 0;
    let totalGpPromote = 0;
    
    // First: Return of capital
    const lpCapital = equityInvested * (1 - gpContribution);
    const gpCapital = equityInvested * gpContribution;
    
    if (remainingProceeds > 0) {
      const capitalReturn = Math.min(remainingProceeds, equityInvested);
      totalLpDistribution += Math.min(capitalReturn * (1 - gpContribution), lpCapital);
      totalGpDistribution += Math.min(capitalReturn * gpContribution, gpCapital);
      remainingProceeds -= capitalReturn;
    }
    
    // Then: Waterfall tiers
    for (let i = 0; i < promoteTiers.length && remainingProceeds > 0; i++) {
      const tier = promoteTiers[i];
      const nextTier = promoteTiers[i + 1];
      
      // Calculate amount available for this tier
      const tierHurdleReturn = equityInvested * tier.irrHurdle * yearsHeld;
      const nextHurdleReturn = nextTier ? equityInvested * nextTier.irrHurdle * yearsHeld : Infinity;
      const tierAmount = nextTier 
        ? Math.min(remainingProceeds, nextHurdleReturn - tierHurdleReturn)
        : remainingProceeds;
      
      const lpShareOfTier = tierAmount * (tier.lpSplit || 0.80);
      const gpShareOfTier = tierAmount * (tier.gpSplit || 0.20);
      
      // GP promote is the excess above their pro-rata share
      const gpProRataOfTier = tierAmount * gpContribution;
      const promoteInTier = Math.max(0, gpShareOfTier - gpProRataOfTier);
      
      totalLpDistribution += lpShareOfTier;
      totalGpDistribution += gpShareOfTier;
      totalGpPromote += promoteInTier;
      remainingProceeds -= tierAmount;
      
      distributionTiers.push({
        tierIndex: i,
        irrHurdle: tier.irrHurdle,
        amountDistributed: Math.round(tierAmount * 100) / 100,
        lpShare: Math.round(lpShareOfTier * 100) / 100,
        gpShare: Math.round(gpShareOfTier * 100) / 100,
      });
    }
    
    return {
      exitNoi: Math.round(exitNoi * 100) / 100,
      exitValuation: Math.round(exitValuation * 100) / 100,
      outstandingDebt: Math.round(totalOutstandingDebt * 100) / 100,
      prepaymentPenalties: Math.round(totalPrepaymentPenalties * 100) / 100,
      exitFees: Math.round(totalExitFees * 100) / 100,
      totalDebtPayoff: Math.round(totalDebtPayoff * 100) / 100,
      grossEquityProceeds: Math.round(grossEquityProceeds * 100) / 100,
      netEquityProceeds: Math.round(netEquityProceeds * 100) / 100,
      equityMultiple: Math.round(equityMultiple * 100) / 100,
      projectIrr: Math.round(projectIrr * 10000) / 10000,
      lpDistribution: Math.round(totalLpDistribution * 100) / 100,
      gpDistribution: Math.round(totalGpDistribution * 100) / 100,
      gpPromote: Math.round(totalGpPromote * 100) / 100,
      distributionTiers,
    };
  }

  /**
   * Generate capital stack summary report
   */
  generateCapitalStackReport(
    loans: LoanInputs[],
    purchasePrice: number,
    noi: number,
    holdPeriodMonths: number,
    noiGrowthRate: number = 0.02,
    exitCapRate: number = 0.07,
    equityInvested?: number
  ): {
    sources: {
      type: 'debt' | 'equity';
      name: string;
      amount: number;
      percentage: number;
      terms?: string;
    }[];
    uses: {
      category: string;
      amount: number;
      percentage: number;
    }[];
    keyMetrics: {
      name: string;
      value: string | number;
      format: 'currency' | 'percent' | 'ratio' | 'years';
    }[];
    debtMetrics: BlendedLoanMetrics;
    cashFlow: any[];
    exitAnalysis: any;
  } {
    const blendedMetrics = this.calculateBlendedMetrics(loans, purchasePrice, noi);
    const totalDebt = blendedMetrics.totalDebtAmount;
    const totalEquity = equityInvested || (purchasePrice - totalDebt);
    const totalCapitalization = totalDebt + totalEquity;
    
    // Sources
    const sources = [
      ...loans.map(loan => ({
        type: 'debt' as const,
        name: loan.name,
        amount: loan.principal,
        percentage: (loan.principal / totalCapitalization) * 100,
        terms: `${(loan.interestRate * 100).toFixed(2)}%, ${loan.termMonths / 12}yr term`,
      })),
      {
        type: 'equity' as const,
        name: 'Common Equity',
        amount: totalEquity,
        percentage: (totalEquity / totalCapitalization) * 100,
      },
    ];
    
    // Uses
    const uses = [
      { category: 'Purchase Price', amount: purchasePrice, percentage: (purchasePrice / totalCapitalization) * 100 },
      { category: 'Closing Costs', amount: purchasePrice * 0.02, percentage: (purchasePrice * 0.02 / totalCapitalization) * 100 },
      { category: 'Reserves', amount: totalCapitalization - purchasePrice - purchasePrice * 0.02, percentage: ((totalCapitalization - purchasePrice - purchasePrice * 0.02) / totalCapitalization) * 100 },
    ];
    
    // Key Metrics
    const keyMetrics = [
      { name: 'Total Capitalization', value: totalCapitalization, format: 'currency' as const },
      { name: 'LTV', value: `${blendedMetrics.combinedLtv.toFixed(1)}%`, format: 'percent' as const },
      { name: 'Blended Rate', value: `${(blendedMetrics.blendedInterestRate * 100).toFixed(2)}%`, format: 'percent' as const },
      { name: 'Annual Debt Service', value: blendedMetrics.totalAnnualDebtService, format: 'currency' as const },
      { name: 'DSCR', value: `${blendedMetrics.blendedDscr.toFixed(2)}x`, format: 'ratio' as const },
      { name: 'Debt Yield', value: `${blendedMetrics.debtYield.toFixed(2)}%`, format: 'percent' as const },
      { name: 'Going-In Cap Rate', value: `${((noi / purchasePrice) * 100).toFixed(2)}%`, format: 'percent' as const },
    ];
    
    // Cash Flow
    const holdPeriodYears = Math.ceil(holdPeriodMonths / 12);
    const cashFlow = this.calculateCashFlowWithDebt(loans, noi, noiGrowthRate, holdPeriodYears);
    
    // Exit Analysis
    const exitAnalysis = this.calculateExitWaterfall(
      loans,
      holdPeriodMonths,
      noi,
      noiGrowthRate,
      exitCapRate,
      purchasePrice,
      totalEquity,
      [
        { irrHurdle: 0.08, gpSplit: 0.20, lpSplit: 0.80 },
        { irrHurdle: 0.12, gpSplit: 0.30, lpSplit: 0.70 },
        { irrHurdle: 0.15, gpSplit: 0.35, lpSplit: 0.65 },
      ]
    );
    
    return {
      sources,
      uses,
      keyMetrics,
      debtMetrics: blendedMetrics,
      cashFlow,
      exitAnalysis,
    };
  }
}

// Export singleton instance
export const enhancedDebtService = new EnhancedDebtService();
