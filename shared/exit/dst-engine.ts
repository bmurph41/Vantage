import { calculateIRR as canonicalBisectionIRR } from './irr-calculator';
import type { CashFlow } from './irr-calculator';

export interface DstEngineInput {
  investmentAmount: number;
  totalOfferingSize: number;
  propertyPurchasePrice: number;
  propertyNoi: number;
  projectedAppreciation: number;
  holdingPeriodYears: number;

  upfrontFees: DstFees;
  ongoingFees: DstOngoingFees;

  loanToValue: number;
  debtInterestRate: number;
  debtTermYears: number;

  distributionYield: number;
  distributionFrequency: 'monthly' | 'quarterly';

  exitCapRate: number;
  exitCostsPercent: number;

  isSuitableFor1031: boolean;
  investorAccreditedStatus: 'accredited' | 'qualified_purchaser';
}

export interface DstFees {
  sellingCommissions: number;
  dealerManagerFee: number;
  organizationFee: number;
  acquisitionFee: number;
  financingFee: number;
  legalAndDueDiligence: number;
  otherUpfront: number;
}

export interface DstOngoingFees {
  assetManagementFeePercent: number;
  propertyManagementFeePercent: number;
  dispositionFeePercent: number;
}

export interface DstDistributionProjection {
  year: number;
  grossIncome: number;
  debtService: number;
  managementFees: number;
  netCashFlow: number;
  distributionAmount: number;
  cashOnCash: number;
  cumulativeDistributions: number;
}

export interface DstExitProjection {
  projectedSalePrice: number;
  dispositionFee: number;
  exitClosingCosts: number;
  loanPayoff: number;
  netProceeds: number;
  investorShare: number;
  totalReturnOfCapital: number;
  gain: number;
}

export interface DstRiskFlag {
  category: 'structural' | 'market' | 'regulatory' | 'fee' | 'liquidity';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
}

export interface DstEngineResult {
  investorOwnershipPercent: number;
  totalUpfrontFees: number;
  totalUpfrontFeesPercent: number;
  netInvestedCapital: number;

  distributionProjections: DstDistributionProjection[];
  totalDistributions: number;
  averageCashOnCash: number;

  exitProjection: DstExitProjection;

  totalReturn: number;
  irr: number | null;
  equityMultiple: number;

  depreciationBenefit: DstDepreciationBenefit;
  riskFlags: DstRiskFlag[];
  comparisonMetrics: DstComparisonMetrics;
}

export interface DstDepreciationBenefit {
  annualDepreciation: number;
  investorAnnualDepreciation: number;
  phantomIncomePossible: boolean;
  depreciationScheduleYears: number;
}

export interface DstComparisonMetrics {
  breakEvenYear: number | null;
  dstReturnVsDirectOwnership: number;
  feeDragPercent: number;
}

export function calculateDstAnalysis(input: DstEngineInput): DstEngineResult {
  const investorOwnershipPercent = input.investmentAmount / input.totalOfferingSize;

  const upfrontFees = input.upfrontFees;
  const totalUpfrontFees =
    upfrontFees.sellingCommissions +
    upfrontFees.dealerManagerFee +
    upfrontFees.organizationFee +
    upfrontFees.acquisitionFee +
    upfrontFees.financingFee +
    upfrontFees.legalAndDueDiligence +
    upfrontFees.otherUpfront;

  const totalUpfrontFeesPercent = totalUpfrontFees / input.investmentAmount;
  const netInvestedCapital = input.investmentAmount - totalUpfrontFees;

  const debtAmount = input.propertyPurchasePrice * input.loanToValue;
  const monthlyDebtRate = input.debtInterestRate / 12;
  const debtPayments = input.debtTermYears * 12;
  const monthlyDebtService = debtAmount > 0
    ? debtAmount * (monthlyDebtRate * Math.pow(1 + monthlyDebtRate, debtPayments)) / (Math.pow(1 + monthlyDebtRate, debtPayments) - 1)
    : 0;
  const annualDebtService = monthlyDebtService * 12;

  const distributionProjections: DstDistributionProjection[] = [];
  let cumulativeDistributions = 0;

  for (let year = 1; year <= input.holdingPeriodYears; year++) {
    const appreciationFactor = Math.pow(1 + input.projectedAppreciation, year - 1);
    const grossIncome = input.propertyNoi * appreciationFactor;

    const managementFees =
      (input.propertyPurchasePrice * input.ongoingFees.assetManagementFeePercent) +
      (grossIncome * input.ongoingFees.propertyManagementFeePercent);

    const netCashFlow = grossIncome - annualDebtService - managementFees;
    const distributionAmount = netCashFlow * investorOwnershipPercent;
    cumulativeDistributions += distributionAmount;

    const cashOnCash = input.investmentAmount > 0 ? distributionAmount / input.investmentAmount : 0;

    distributionProjections.push({
      year,
      grossIncome,
      debtService: annualDebtService,
      managementFees,
      netCashFlow,
      distributionAmount,
      cashOnCash,
      cumulativeDistributions,
    });
  }

  const totalDistributions = cumulativeDistributions;
  const averageCashOnCash = distributionProjections.length > 0
    ? distributionProjections.reduce((sum, d) => sum + d.cashOnCash, 0) / distributionProjections.length
    : 0;

  const appreciatedValue = input.propertyPurchasePrice * Math.pow(1 + input.projectedAppreciation, input.holdingPeriodYears);
  const projectedSalePrice = input.exitCapRate > 0
    ? (input.propertyNoi * Math.pow(1 + input.projectedAppreciation, input.holdingPeriodYears)) / input.exitCapRate
    : appreciatedValue;

  const dispositionFee = projectedSalePrice * input.ongoingFees.dispositionFeePercent;
  const exitClosingCosts = projectedSalePrice * input.exitCostsPercent;

  let loanPayoff = debtAmount;
  {
    let balance = debtAmount;
    for (let m = 0; m < input.holdingPeriodYears * 12; m++) {
      const interest = balance * monthlyDebtRate;
      const principal = monthlyDebtService - interest;
      balance -= Math.min(principal, balance);
    }
    loanPayoff = Math.max(0, balance);
  }

  const netProceeds = projectedSalePrice - dispositionFee - exitClosingCosts - loanPayoff;
  const investorShare = netProceeds * investorOwnershipPercent;
  const totalReturnOfCapital = investorShare;
  const gain = investorShare - input.investmentAmount;

  const exitProjection: DstExitProjection = {
    projectedSalePrice,
    dispositionFee,
    exitClosingCosts,
    loanPayoff,
    netProceeds,
    investorShare,
    totalReturnOfCapital,
    gain,
  };

  const totalReturn = totalDistributions + investorShare;

  const irrCashFlows: CashFlow[] = [{ period: 0, amount: input.investmentAmount, type: 'investment' }];
  for (let i = 0; i < distributionProjections.length; i++) {
    irrCashFlows.push({ period: i + 1, amount: distributionProjections[i].distributionAmount, type: 'intermediate' });
  }
  // Add exit proceeds to the last period
  irrCashFlows[irrCashFlows.length - 1] = {
    ...irrCashFlows[irrCashFlows.length - 1],
    amount: irrCashFlows[irrCashFlows.length - 1].amount + investorShare,
    type: 'distribution',
  };

  const irr = canonicalBisectionIRR(irrCashFlows);
  const equityMultiple = input.investmentAmount > 0 ? totalReturn / input.investmentAmount : 0;

  const depreciableValue = input.propertyPurchasePrice * 0.80;
  const annualDepreciation = depreciableValue / 39;
  const investorAnnualDepreciation = annualDepreciation * investorOwnershipPercent;

  const depreciationBenefit: DstDepreciationBenefit = {
    annualDepreciation,
    investorAnnualDepreciation,
    phantomIncomePossible: investorAnnualDepreciation < (distributionProjections[0]?.distributionAmount || 0),
    depreciationScheduleYears: 39,
  };

  let breakEvenYear: number | null = null;
  let cumReturn = 0;
  for (const dist of distributionProjections) {
    cumReturn += dist.distributionAmount;
    if (cumReturn >= input.investmentAmount) {
      breakEvenYear = dist.year;
      break;
    }
  }

  const totalFeeDrag = totalUpfrontFees + distributionProjections.reduce((sum, d) => sum + d.managementFees * investorOwnershipPercent, 0) + dispositionFee * investorOwnershipPercent;
  const feeDragPercent = totalReturn > 0 ? totalFeeDrag / (totalReturn + totalFeeDrag) : 0;

  const directOwnershipReturn = (input.propertyNoi * input.holdingPeriodYears + projectedSalePrice - input.propertyPurchasePrice) * investorOwnershipPercent;
  const dstReturnVsDirectOwnership = directOwnershipReturn > 0
    ? (totalReturn - input.investmentAmount) / directOwnershipReturn - 1
    : 0;

  const comparisonMetrics: DstComparisonMetrics = {
    breakEvenYear,
    dstReturnVsDirectOwnership,
    feeDragPercent,
  };

  const riskFlags = evaluateDstRisks(input, totalUpfrontFeesPercent, irr);

  return {
    investorOwnershipPercent,
    totalUpfrontFees,
    totalUpfrontFeesPercent,
    netInvestedCapital,
    distributionProjections,
    totalDistributions,
    averageCashOnCash,
    exitProjection,
    totalReturn,
    irr,
    equityMultiple,
    depreciationBenefit,
    riskFlags,
    comparisonMetrics,
  };
}

function evaluateDstRisks(
  input: DstEngineInput,
  upfrontFeesPercent: number,
  irr: number | null
): DstRiskFlag[] {
  const flags: DstRiskFlag[] = [];

  if (upfrontFeesPercent > 0.15) {
    flags.push({
      category: 'fee',
      severity: 'high',
      title: 'High Upfront Fees',
      description: `Upfront fees of ${(upfrontFeesPercent * 100).toFixed(1)}% exceed 15% of investment. Industry typical is 10-15%.`,
    });
  } else if (upfrontFeesPercent > 0.10) {
    flags.push({
      category: 'fee',
      severity: 'medium',
      title: 'Above-Average Upfront Fees',
      description: `Upfront fees of ${(upfrontFeesPercent * 100).toFixed(1)}% are above average.`,
    });
  }

  if (input.loanToValue > 0.65) {
    flags.push({
      category: 'structural',
      severity: 'high',
      title: 'High Leverage',
      description: `LTV of ${(input.loanToValue * 100).toFixed(0)}% exceeds typical DST leverage of 50-65%.`,
    });
  }

  flags.push({
    category: 'liquidity',
    severity: 'medium',
    title: 'Illiquid Investment',
    description: 'DST interests are illiquid. No secondary market guarantee. Holding period is typically 5-10 years.',
  });

  flags.push({
    category: 'structural',
    severity: 'low',
    title: 'No Management Control',
    description: 'DST beneficial owners cannot participate in management decisions or make material changes.',
  });

  if (input.distributionYield > 0.08) {
    flags.push({
      category: 'market',
      severity: 'medium',
      title: 'High Projected Yield',
      description: `Projected yield of ${(input.distributionYield * 100).toFixed(1)}% may be unsustainable. Verify assumptions.`,
    });
  }

  return flags;
}

// bisectionIRR removed — using canonical calculateIRR from irr-calculator.ts
