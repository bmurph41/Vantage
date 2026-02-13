import type { LoanScheduleResult } from './mortgage-amortization';
import { calculateIRR as canonicalIRR } from './irr-calculator';
import type { CashFlow } from './irr-calculator';

export interface CashflowProjectionInput {
  holdingPeriodYears: number;
  
  baseNoi: number;
  noiGrowthRate: number; // Annual NOI growth (e.g., 0.03 = 3%)
  
  managementFeeRate?: number; // As % of gross revenue
  vacancyRate?: number;
  
  capitalExpendituresByYear?: Record<number, number>;
  reserveFundingByYear?: Record<number, number>;
  leasingCommissionsByYear?: Record<number, number>;
  tenantImprovementsByYear?: Record<number, number>;
  
  debtSchedules?: LoanScheduleResult[];
  
  initialEquityInvestment: number;
  exitSalePrice?: number;
  exitClosingCosts?: number;
  exitYear?: number;
}

export interface YearlyCashflow {
  year: number;
  
  potentialRentalIncome: number;
  vacancyLoss: number;
  effectiveGrossIncome: number;
  operatingExpenses: number;
  noi: number;
  
  debtService: number;
  cashFlowBeforeCapex: number;
  
  capitalExpenditures: number;
  reserveFunding: number;
  leasingCommissions: number;
  tenantImprovements: number;
  totalBelowLine: number;
  
  netCashFlow: number;
  cumulativeCashFlow: number;
  
  dscr: number;
  cashOnCashReturn: number;
}

export interface ExitCashflow {
  year: number;
  grossSalePrice: number;
  closingCosts: number;
  netSalePrice: number;
  loanPayoff: number;
  netSaleProceeds: number;
}

export interface CashflowProjectionResult {
  yearlyCashflows: YearlyCashflow[];
  exitCashflow?: ExitCashflow;
  
  summary: {
    totalNoi: number;
    totalDebtService: number;
    totalNetCashFlow: number;
    averageDscr: number;
    averageCashOnCash: number;
  };
  
  investmentCashflows: number[];
  unleveredIrr: number | null;
  leveredIrr: number | null;
  equityMultiple: number;
  paybackPeriod: number | null;
}

export function projectCashflows(input: CashflowProjectionInput): CashflowProjectionResult {
  const yearlyCashflows: YearlyCashflow[] = [];
  let cumulativeCashFlow = 0;
  
  const investmentCashflows: number[] = [-input.initialEquityInvestment];
  
  for (let year = 1; year <= input.holdingPeriodYears; year++) {
    const noiGrowth = Math.pow(1 + input.noiGrowthRate, year - 1);
    const noi = input.baseNoi * noiGrowth;
    
    const vacancyRate = input.vacancyRate || 0.05;
    const potentialRentalIncome = noi / (1 - vacancyRate - (input.managementFeeRate || 0.03));
    const vacancyLoss = potentialRentalIncome * vacancyRate;
    const effectiveGrossIncome = potentialRentalIncome - vacancyLoss;
    const operatingExpenses = effectiveGrossIncome - noi;
    
    let debtService = 0;
    if (input.debtSchedules) {
      for (const schedule of input.debtSchedules) {
        const yearStart = (year - 1) * 12;
        const yearEnd = year * 12;
        const yearPayments = schedule.schedule.slice(yearStart, yearEnd);
        debtService += yearPayments.reduce((sum, p) => sum + p.payment, 0);
      }
    }
    
    const cashFlowBeforeCapex = noi - debtService;
    
    const capitalExpenditures = input.capitalExpendituresByYear?.[year] || 0;
    const reserveFunding = input.reserveFundingByYear?.[year] || 0;
    const leasingCommissions = input.leasingCommissionsByYear?.[year] || 0;
    const tenantImprovements = input.tenantImprovementsByYear?.[year] || 0;
    
    const totalBelowLine = capitalExpenditures + reserveFunding + leasingCommissions + tenantImprovements;
    const netCashFlow = cashFlowBeforeCapex - totalBelowLine;
    
    cumulativeCashFlow += netCashFlow;
    
    const dscr = debtService > 0 ? noi / debtService : 0;
    const cashOnCashReturn = input.initialEquityInvestment > 0 
      ? netCashFlow / input.initialEquityInvestment 
      : 0;
    
    yearlyCashflows.push({
      year,
      potentialRentalIncome,
      vacancyLoss,
      effectiveGrossIncome,
      operatingExpenses,
      noi,
      debtService,
      cashFlowBeforeCapex,
      capitalExpenditures,
      reserveFunding,
      leasingCommissions,
      tenantImprovements,
      totalBelowLine,
      netCashFlow,
      cumulativeCashFlow,
      dscr,
      cashOnCashReturn,
    });
    
    investmentCashflows.push(netCashFlow);
  }
  
  let exitCashflow: ExitCashflow | undefined;
  const exitYear = input.exitYear || input.holdingPeriodYears;
  
  if (input.exitSalePrice) {
    const closingCosts = input.exitClosingCosts || (input.exitSalePrice * 0.05);
    const netSalePrice = input.exitSalePrice - closingCosts;
    
    let loanPayoff = 0;
    if (input.debtSchedules) {
      for (const schedule of input.debtSchedules) {
        const exitMonth = exitYear * 12;
        if (exitMonth < schedule.schedule.length) {
          loanPayoff += schedule.schedule[exitMonth - 1].endingBalance;
        } else {
          loanPayoff += schedule.balloonAmount;
        }
      }
    }
    
    const netSaleProceeds = netSalePrice - loanPayoff;
    
    exitCashflow = {
      year: exitYear,
      grossSalePrice: input.exitSalePrice,
      closingCosts,
      netSalePrice,
      loanPayoff,
      netSaleProceeds,
    };
    
    investmentCashflows[investmentCashflows.length - 1] += netSaleProceeds;
  }
  
  const totalNoi = yearlyCashflows.reduce((sum, cf) => sum + cf.noi, 0);
  const totalDebtService = yearlyCashflows.reduce((sum, cf) => sum + cf.debtService, 0);
  const totalNetCashFlow = yearlyCashflows.reduce((sum, cf) => sum + cf.netCashFlow, 0);
  const averageDscr = yearlyCashflows.reduce((sum, cf) => sum + cf.dscr, 0) / yearlyCashflows.length;
  const averageCashOnCash = yearlyCashflows.reduce((sum, cf) => sum + cf.cashOnCashReturn, 0) / yearlyCashflows.length;
  
  const totalReturns = totalNetCashFlow + (exitCashflow?.netSaleProceeds || 0);
  const equityMultiple = input.initialEquityInvestment > 0 
    ? totalReturns / input.initialEquityInvestment 
    : 0;
  
  let paybackPeriod: number | null = null;
  let cumulative = 0;
  for (let i = 0; i < yearlyCashflows.length; i++) {
    cumulative += yearlyCashflows[i].netCashFlow;
    if (cumulative >= input.initialEquityInvestment) {
      paybackPeriod = i + 1;
      break;
    }
  }
  
  const leveredIrr = rawArrayIRR(investmentCashflows);
  
  const unleveredCashflows: number[] = [-input.initialEquityInvestment - (input.debtSchedules?.reduce((sum, s) => sum + s.schedule[0]?.beginningBalance || 0, 0) || 0)];
  for (const cf of yearlyCashflows) {
    unleveredCashflows.push(cf.noi - cf.totalBelowLine);
  }
  if (input.exitSalePrice) {
    unleveredCashflows[unleveredCashflows.length - 1] += input.exitSalePrice - (input.exitClosingCosts || 0);
  }
  const unleveredIrr = rawArrayIRR(unleveredCashflows);
  
  return {
    yearlyCashflows,
    exitCashflow,
    summary: {
      totalNoi,
      totalDebtService,
      totalNetCashFlow,
      averageDscr,
      averageCashOnCash,
    },
    investmentCashflows,
    unleveredIrr,
    leveredIrr,
    equityMultiple,
    paybackPeriod,
  };
}

// Thin adapter: converts number[] to CashFlow[] for the canonical IRR
function rawArrayIRR(cashflows: number[]): number | null {
  if (cashflows.length < 2) return null;
  const flows: CashFlow[] = cashflows.map((cf, i) => ({
    period: i,
    amount: Math.abs(cf),
    type: (cf < 0 ? 'investment' : (i === cashflows.length - 1 ? 'distribution' : 'intermediate')) as 'investment' | 'distribution' | 'intermediate',
  }));
  return canonicalIRR(flows);
}

export interface CCIMCFAWResult {
  propertyName: string;
  analysisDate: Date;
  holdingPeriodYears: number;
  
  yearlyOperations: Array<{
    year: number;
    potentialRentalIncome: number;
    vacancyLoss: number;
    effectiveGrossIncome: number;
    operatingExpenses: number;
    noi: number;
    debtService: number;
    cashFlowBeforeCapex: number;
    leasingCommissions: number;
    tenantImprovements: number;
    capitalExpenditures: number;
    reserves: number;
    netCashFlow: number;
  }>;
  
  loanSummary: Array<{
    loanName: string;
    originalAmount: number;
    interestRate: number;
    termYears: number;
    amortizationYears?: number;
    annualDebtService: number;
    principalBalanceByYear: Record<number, number>;
  }>;
  
  exitAnalysis: {
    salePrice: number;
    sellingCosts: number;
    netSalePrice: number;
    loanPayoff: number;
    beforeTaxProceeds: number;
  };
  
  investmentMetrics: {
    initialEquity: number;
    totalCashFlow: number;
    exitProceeds: number;
    totalReturn: number;
    equityMultiple: number;
    irr: number | null;
    averageCashOnCash: number;
    averageDscr: number;
  };
}

export function generateCCIMCFAW(
  input: CashflowProjectionInput,
  propertyName: string
): CCIMCFAWResult {
  const projection = projectCashflows(input);
  
  const yearlyOperations = projection.yearlyCashflows.map(cf => ({
    year: cf.year,
    potentialRentalIncome: cf.potentialRentalIncome,
    vacancyLoss: cf.vacancyLoss,
    effectiveGrossIncome: cf.effectiveGrossIncome,
    operatingExpenses: cf.operatingExpenses,
    noi: cf.noi,
    debtService: cf.debtService,
    cashFlowBeforeCapex: cf.cashFlowBeforeCapex,
    leasingCommissions: cf.leasingCommissions,
    tenantImprovements: cf.tenantImprovements,
    capitalExpenditures: cf.capitalExpenditures,
    reserves: cf.reserveFunding,
    netCashFlow: cf.netCashFlow,
  }));
  
  const loanSummary: CCIMCFAWResult['loanSummary'] = [];
  if (input.debtSchedules) {
    input.debtSchedules.forEach((schedule, index) => {
      loanSummary.push({
        loanName: `Loan ${index + 1}`,
        originalAmount: schedule.schedule[0]?.beginningBalance || 0,
        interestRate: 0,
        termYears: Math.ceil(schedule.schedule.length / 12),
        annualDebtService: schedule.annualDebtService,
        principalBalanceByYear: schedule.principalBalancesByYear,
      });
    });
  }
  
  const exitAnalysis = {
    salePrice: projection.exitCashflow?.grossSalePrice || 0,
    sellingCosts: projection.exitCashflow?.closingCosts || 0,
    netSalePrice: projection.exitCashflow?.netSalePrice || 0,
    loanPayoff: projection.exitCashflow?.loanPayoff || 0,
    beforeTaxProceeds: projection.exitCashflow?.netSaleProceeds || 0,
  };
  
  const investmentMetrics = {
    initialEquity: input.initialEquityInvestment,
    totalCashFlow: projection.summary.totalNetCashFlow,
    exitProceeds: projection.exitCashflow?.netSaleProceeds || 0,
    totalReturn: projection.summary.totalNetCashFlow + (projection.exitCashflow?.netSaleProceeds || 0),
    equityMultiple: projection.equityMultiple,
    irr: projection.leveredIrr,
    averageCashOnCash: projection.summary.averageCashOnCash,
    averageDscr: projection.summary.averageDscr,
  };
  
  return {
    propertyName,
    analysisDate: new Date(),
    holdingPeriodYears: input.holdingPeriodYears,
    yearlyOperations,
    loanSummary,
    exitAnalysis,
    investmentMetrics,
  };
}

export interface RentRollSyncData {
  totalAnnualRent: number;
  occupancyRate: number;
  averageRentPerUnit: number;
  expirationSchedule: Record<number, number>;
}

export interface ModelingProjectSyncData {
  purchasePrice: number;
  noi: number;
  loanAmount: number;
  interestRate: number;
  loanTermYears: number;
  equityInvested: number;
}

export function syncFromRentRoll(rentRollData: RentRollSyncData): Partial<CashflowProjectionInput> {
  return {
    baseNoi: rentRollData.totalAnnualRent * 0.65,
    vacancyRate: 1 - rentRollData.occupancyRate,
  };
}

export function syncFromModelingProject(modelingData: ModelingProjectSyncData): Partial<CashflowProjectionInput> {
  return {
    baseNoi: modelingData.noi,
    initialEquityInvestment: modelingData.equityInvested,
  };
}
