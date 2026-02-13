export interface LoanInput {
  originalAmount: number;
  interestRate: number; // Annual rate as decimal (e.g., 0.055 = 5.5%)
  amortizationPeriodMonths?: number; // null for interest-only
  loanTermMonths: number;
  originationDate?: Date;
  isInterestOnly?: boolean;
  interestOnlyMonths?: number;
  loanFees?: number;
  loanCosts?: number;
  prepaymentPenaltyType?: 'defeasance' | 'yield_maintenance' | 'step_down' | 'none';
  prepaymentPenaltySchedule?: { year: number; penalty: number }[];
}

export interface AmortizationPayment {
  period: number;
  date?: Date;
  beginningBalance: number;
  payment: number;
  principal: number;
  interest: number;
  endingBalance: number;
  cumulativeInterest: number;
  cumulativePrincipal: number;
}

export interface LoanScheduleResult {
  monthlyPayment: number;
  annualDebtService: number;
  totalPayments: number;
  totalInterest: number;
  totalPrincipal: number;
  balloonAmount: number;
  hasBalloon: boolean;
  schedule: AmortizationPayment[];
  principalBalancesByYear: Record<number, number>;
  interestPaidByYear: Record<number, number>;
  principalPaidByYear: Record<number, number>;
}

export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  amortizationMonths: number
): number {
  if (amortizationMonths <= 0 || principal <= 0) return 0;
  if (annualRate <= 0) return principal / amortizationMonths;
  
  const monthlyRate = annualRate / 12;
  const payment = principal * 
    (monthlyRate * Math.pow(1 + monthlyRate, amortizationMonths)) / 
    (Math.pow(1 + monthlyRate, amortizationMonths) - 1);
  
  return payment;
}

export function generateAmortizationSchedule(input: LoanInput): LoanScheduleResult {
  const {
    originalAmount,
    interestRate,
    amortizationPeriodMonths,
    loanTermMonths,
    originationDate,
    isInterestOnly = false,
    interestOnlyMonths = 0,
  } = input;

  const monthlyRate = interestRate / 12;
  const schedule: AmortizationPayment[] = [];
  
  let balance = originalAmount;
  let cumulativeInterest = 0;
  let cumulativePrincipal = 0;
  
  const amortMonths = amortizationPeriodMonths || loanTermMonths;
  const monthlyPayment = isInterestOnly 
    ? balance * monthlyRate 
    : calculateMonthlyPayment(originalAmount, interestRate, amortMonths);
  
  const effectiveIOMonths = isInterestOnly ? loanTermMonths : interestOnlyMonths;
  
  for (let period = 1; period <= loanTermMonths; period++) {
    const beginningBalance = balance;
    const interest = balance * monthlyRate;
    
    let payment: number;
    let principal: number;
    
    if (period <= effectiveIOMonths) {
      payment = interest;
      principal = 0;
    } else {
      const remainingAmortMonths = amortMonths - (period - effectiveIOMonths - 1);
      if (remainingAmortMonths <= 0) {
        payment = beginningBalance + interest;
        principal = beginningBalance;
      } else if (period === effectiveIOMonths + 1 && effectiveIOMonths > 0) {
        payment = calculateMonthlyPayment(balance, interestRate, amortMonths - effectiveIOMonths);
        principal = payment - interest;
      } else {
        payment = monthlyPayment;
        principal = payment - interest;
      }
    }
    
    principal = Math.min(principal, balance);
    
    if (period === loanTermMonths && balance - principal > 0.01) {
      principal = balance;
      payment = principal + interest;
    }
    
    balance = Math.max(0, balance - principal);
    cumulativeInterest += interest;
    cumulativePrincipal += principal;
    
    let paymentDate: Date | undefined;
    if (originationDate) {
      paymentDate = new Date(originationDate);
      paymentDate.setMonth(paymentDate.getMonth() + period);
    }
    
    schedule.push({
      period,
      date: paymentDate,
      beginningBalance,
      payment,
      principal,
      interest,
      endingBalance: balance,
      cumulativeInterest,
      cumulativePrincipal,
    });
  }
  
  const principalBalancesByYear: Record<number, number> = {};
  const interestPaidByYear: Record<number, number> = {};
  const principalPaidByYear: Record<number, number> = {};
  
  for (let year = 1; year <= Math.ceil(loanTermMonths / 12); year++) {
    const startMonth = (year - 1) * 12;
    const endMonth = Math.min(year * 12, loanTermMonths);
    
    const yearPayments = schedule.slice(startMonth, endMonth);
    
    if (yearPayments.length > 0) {
      principalBalancesByYear[year] = yearPayments[yearPayments.length - 1].endingBalance;
      interestPaidByYear[year] = yearPayments.reduce((sum, p) => sum + p.interest, 0);
      principalPaidByYear[year] = yearPayments.reduce((sum, p) => sum + p.principal, 0);
    }
  }
  
  const lastPayment = schedule[schedule.length - 1];
  const balloonAmount = lastPayment ? lastPayment.endingBalance : 0;
  const hasBalloon = balloonAmount > 1;
  
  const annualDebtService = monthlyPayment * 12;
  const totalPayments = schedule.reduce((sum, p) => sum + p.payment, 0);
  
  return {
    monthlyPayment,
    annualDebtService,
    totalPayments,
    totalInterest: cumulativeInterest,
    totalPrincipal: cumulativePrincipal,
    balloonAmount: hasBalloon ? balloonAmount : 0,
    hasBalloon,
    schedule,
    principalBalancesByYear,
    interestPaidByYear,
    principalPaidByYear,
  };
}

export interface MultiLoanSummary {
  loans: Array<{
    name: string;
    schedule: LoanScheduleResult;
    priority: number;
  }>;
  totalMonthlyPayment: number;
  totalAnnualDebtService: number;
  combinedPrincipalByYear: Record<number, number>;
  combinedInterestByYear: Record<number, number>;
  combinedBalanceByYear: Record<number, number>;
  blendedInterestRate: number;
  totalOriginalDebt: number;
}

export function generateMultiLoanSchedule(
  loans: Array<{ name: string; input: LoanInput; priority: number }>
): MultiLoanSummary {
  const results = loans.map(loan => ({
    name: loan.name,
    schedule: generateAmortizationSchedule(loan.input),
    priority: loan.priority,
    originalAmount: loan.input.originalAmount,
    interestRate: loan.input.interestRate,
  }));
  
  results.sort((a, b) => a.priority - b.priority);
  
  const totalMonthlyPayment = results.reduce((sum, r) => sum + r.schedule.monthlyPayment, 0);
  const totalAnnualDebtService = results.reduce((sum, r) => sum + r.schedule.annualDebtService, 0);
  const totalOriginalDebt = results.reduce((sum, r) => sum + r.originalAmount, 0);
  
  const blendedInterestRate = totalOriginalDebt > 0
    ? results.reduce((sum, r) => sum + (r.interestRate * r.originalAmount), 0) / totalOriginalDebt
    : 0;
  
  const maxYears = Math.max(
    ...results.map(r => Object.keys(r.schedule.principalBalancesByYear).length)
  );
  
  const combinedPrincipalByYear: Record<number, number> = {};
  const combinedInterestByYear: Record<number, number> = {};
  const combinedBalanceByYear: Record<number, number> = {};
  
  for (let year = 1; year <= maxYears; year++) {
    combinedPrincipalByYear[year] = results.reduce(
      (sum, r) => sum + (r.schedule.principalPaidByYear[year] || 0), 0
    );
    combinedInterestByYear[year] = results.reduce(
      (sum, r) => sum + (r.schedule.interestPaidByYear[year] || 0), 0
    );
    combinedBalanceByYear[year] = results.reduce(
      (sum, r) => sum + (r.schedule.principalBalancesByYear[year] || 0), 0
    );
  }
  
  return {
    loans: results.map(r => ({
      name: r.name,
      schedule: r.schedule,
      priority: r.priority,
    })),
    totalMonthlyPayment,
    totalAnnualDebtService,
    combinedPrincipalByYear,
    combinedInterestByYear,
    combinedBalanceByYear,
    blendedInterestRate,
    totalOriginalDebt,
  };
}

export function calculatePrepaymentPenalty(
  input: LoanInput,
  payoffYear: number,
  payoffBalance: number
): number {
  if (!input.prepaymentPenaltyType || input.prepaymentPenaltyType === 'none') {
    return 0;
  }
  
  if (input.prepaymentPenaltyType === 'step_down' && input.prepaymentPenaltySchedule) {
    const yearPenalty = input.prepaymentPenaltySchedule.find(p => p.year === payoffYear);
    if (yearPenalty) {
      return payoffBalance * yearPenalty.penalty;
    }
    return 0;
  }
  
  if (input.prepaymentPenaltyType === 'yield_maintenance') {
    const remainingMonths = input.loanTermMonths - (payoffYear * 12);
    const monthlyRate = input.interestRate / 12;
    const treasuryRate = 0.04;
    const rateDiff = Math.max(0, input.interestRate - treasuryRate);
    
    if (remainingMonths <= 0 || rateDiff <= 0) return 0;
    
    const monthlyPayment = calculateMonthlyPayment(
      payoffBalance, 
      input.interestRate, 
      input.amortizationPeriodMonths || input.loanTermMonths
    );
    
    let pvLostInterest = 0;
    for (let m = 1; m <= remainingMonths; m++) {
      pvLostInterest += (monthlyPayment * rateDiff / input.interestRate) / Math.pow(1 + monthlyRate, m);
    }
    
    return pvLostInterest;
  }
  
  if (input.prepaymentPenaltyType === 'defeasance') {
    return payoffBalance * 0.02;
  }
  
  return 0;
}

export function calculateDSCR(noi: number, annualDebtService: number): number {
  if (annualDebtService <= 0) return 0;
  return noi / annualDebtService;
}

export function calculateLTV(loanBalance: number, propertyValue: number): number {
  if (propertyValue <= 0) return 0;
  return loanBalance / propertyValue;
}

export function calculateDebtYield(noi: number, loanBalance: number): number {
  if (loanBalance <= 0) return 0;
  return noi / loanBalance;
}

export function calculateLoanConstants(
  loanAmount: number,
  interestRate: number,
  amortizationYears: number
): {
  annualConstant: number;
  monthlyConstant: number;
} {
  const monthlyPayment = calculateMonthlyPayment(loanAmount, interestRate, amortizationYears * 12);
  const annualDebtService = monthlyPayment * 12;
  
  return {
    annualConstant: annualDebtService / loanAmount,
    monthlyConstant: monthlyPayment / loanAmount,
  };
}

export function projectLoanBalanceAtYear(
  schedule: LoanScheduleResult,
  year: number
): number {
  const month = year * 12;
  if (month >= schedule.schedule.length) {
    return schedule.balloonAmount;
  }
  return schedule.schedule[month - 1]?.endingBalance || 0;
}
