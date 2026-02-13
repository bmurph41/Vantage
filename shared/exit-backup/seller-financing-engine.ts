import { STATE_CAPITAL_GAINS_RATES, getTaxYearConfig } from './tax-engine';
import type { FilingStatus } from './tax-engine';
import { calculateIRR as canonicalBisectionIRR } from './irr-calculator';
import type { CashFlow } from './irr-calculator';

export interface SellerFinancingEngineInput {
  salePrice: number;
  adjustedBasis: number;
  accumulatedDepreciation: number;

  downPaymentPercent: number;
  noteInterestRate: number;
  noteTermYears: number;
  amortizationYears: number;
  balloonAtYear?: number;

  afrRate?: number;

  buyerCreditProfile: BuyerCreditProfile;
  collateral: CollateralInfo;

  taxProfile: {
    filingStatus: 'single' | 'married' | 'head_of_household';
    otherOrdinaryIncome: number;
    stateOfResidence: string;
    taxYear?: number;
  };
}

export interface BuyerCreditProfile {
  creditScore: number;
  debtToIncomeRatio: number;
  liquidReserves: number;
  yearsInBusiness: number;
  hasBankruptcy: boolean;
  hasForeclosure: boolean;
  personalGuarantee: boolean;
}

export interface CollateralInfo {
  appraisedValue: number;
  lienPosition: 'first' | 'second' | 'subordinated';
  hasUccFiling: boolean;
  hasPersonalGuarantee: boolean;
}

export interface NoteAmortizationEntry {
  period: number;
  beginningBalance: number;
  payment: number;
  principal: number;
  interest: number;
  endingBalance: number;
  cumulativePrincipal: number;
  cumulativeInterest: number;
}

export interface InstallmentTaxEntry {
  year: number;
  principalReceived: number;
  interestIncome: number;
  installmentGain: number;
  recaptureGain: number;
  ltcgGain: number;
  federalTax: number;
  stateTax: number;
  totalTax: number;
  netAfterTax: number;
}

export interface CreditLossScenario {
  label: string;
  probability: number;
  defaultYear: number;
  recoveryRate: number;
  lossAmount: number;
  expectedLoss: number;
}

export interface CreditLossEV {
  scenarios: CreditLossScenario[];
  expectedLoss: number;
  expectedNetProceeds: number;
  riskAdjustedIRR: number | null;
  creditReserveRecommended: number;
}

export interface SellerFinancingEngineResult {
  noteTerms: {
    faceValue: number;
    interestRate: number;
    termYears: number;
    amortizationYears: number;
    hasBalloon: boolean;
    balloonYear: number | null;
    balloonAmount: number;
    monthlyPayment: number;
    totalInterestIncome: number;
  };

  amortization: NoteAmortizationEntry[];
  installmentTaxSchedule: InstallmentTaxEntry[];

  cashFlowSummary: {
    downPayment: number;
    totalPrincipalReceived: number;
    totalInterestReceived: number;
    totalCashReceived: number;
    totalTaxPaid: number;
    netAfterTax: number;
    npvAtDiscount: number;
  };

  afrCompliance: {
    afrRate: number;
    noteRate: number;
    isCompliant: boolean;
    imputedInterest: number;
  };

  creditLossAnalysis: CreditLossEV;
  buyerRiskScore: number;

  warnings: SellerFinancingWarning[];
}

export interface SellerFinancingWarning {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

export function calculateSellerFinancing(input: SellerFinancingEngineInput): SellerFinancingEngineResult {
  const warnings: SellerFinancingWarning[] = [];

  const downPayment = input.salePrice * input.downPaymentPercent;
  const faceValue = input.salePrice - downPayment;

  // Guard: 100% down payment means no note — return cash-sale-equivalent
  if (faceValue <= 0) {
    warnings.push({
      code: 'CASH_SALE_EQUIVALENT',
      severity: 'info',
      message: '100% down payment — this is equivalent to a cash sale. No installment note created.',
    });

    const grossProfit = input.salePrice - input.adjustedBasis;
    const buyerRiskScore = scoreBuyerRisk(input.buyerCreditProfile);

    return {
      noteTerms: {
        faceValue: 0,
        interestRate: input.noteInterestRate,
        termYears: input.noteTermYears,
        amortizationYears: input.amortizationYears || input.noteTermYears,
        hasBalloon: false,
        balloonYear: null,
        balloonAmount: 0,
        monthlyPayment: 0,
        totalInterestIncome: 0,
      },
      amortization: [],
      installmentTaxSchedule: [{
        year: 0,
        principalReceived: downPayment,
        interestIncome: 0,
        installmentGain: grossProfit,
        recaptureGain: Math.min(input.accumulatedDepreciation, Math.max(0, grossProfit)),
        ltcgGain: Math.max(0, grossProfit - input.accumulatedDepreciation),
        federalTax: 0,
        stateTax: 0,
        totalTax: 0,
        netAfterTax: downPayment,
      }],
      cashFlowSummary: {
        downPayment,
        totalPrincipalReceived: downPayment,
        totalInterestReceived: 0,
        totalCashReceived: downPayment,
        totalTaxPaid: 0,
        netAfterTax: downPayment,
        npvAtDiscount: downPayment,
      },
      afrCompliance: {
        afrRate: input.afrRate || 0.04,
        noteRate: input.noteInterestRate,
        isCompliant: true,
        imputedInterest: 0,
      },
      creditLossAnalysis: {
        scenarios: [],
        expectedLoss: 0,
        expectedNetProceeds: downPayment,
        riskAdjustedIRR: null,
        creditReserveRecommended: 0,
      },
      buyerRiskScore,
      warnings,
    };
  }

  const amortYears = input.amortizationYears || input.noteTermYears;
  const monthlyRate = input.noteInterestRate / 12;
  const amortPayments = amortYears * 12;

  const monthlyPayment = faceValue > 0 && monthlyRate > 0
    ? faceValue * (monthlyRate * Math.pow(1 + monthlyRate, amortPayments)) / (Math.pow(1 + monthlyRate, amortPayments) - 1)
    : faceValue > 0 ? faceValue / amortPayments : 0;

  const hasBalloon = (input.balloonAtYear !== undefined && input.balloonAtYear < amortYears) ||
    (input.noteTermYears < amortYears);
  const balloonYear = hasBalloon ? (input.balloonAtYear || input.noteTermYears) : null;

  const amortization: NoteAmortizationEntry[] = [];
  let balance = faceValue;
  let cumPrincipal = 0;
  let cumInterest = 0;
  let totalInterestIncome = 0;
  let balloonAmount = 0;

  const totalPeriods = hasBalloon ? (balloonYear! * 12) : amortPayments;

  for (let period = 1; period <= totalPeriods; period++) {
    const beginningBalance = balance;
    const interest = balance * monthlyRate;
    const principal = Math.min(monthlyPayment - interest, balance);
    balance -= principal;
    cumPrincipal += principal;
    cumInterest += interest;
    totalInterestIncome += interest;

    amortization.push({
      period,
      beginningBalance,
      payment: monthlyPayment,
      principal,
      interest,
      endingBalance: Math.max(0, balance),
      cumulativePrincipal: cumPrincipal,
      cumulativeInterest: cumInterest,
    });
  }

  if (hasBalloon && balance > 0) {
    balloonAmount = balance;
  }

  const grossProfit = input.salePrice - input.adjustedBasis;
  const grossProfitRatio = grossProfit / input.salePrice;

  const installmentTaxSchedule: InstallmentTaxEntry[] = [];
  let remainingRecapture = input.accumulatedDepreciation;

  // Use canonical state rates from tax-engine (51 jurisdictions) instead of hardcoded 12-state table
  const residenceCode = input.taxProfile.stateOfResidence.toUpperCase();
  const stateInfo = STATE_CAPITAL_GAINS_RATES[residenceCode];
  const stateRate = stateInfo ? stateInfo.rate : 0;

  // Use bracket-based LTCG rate from tax-engine based on filing status + income
  const taxConfig = getTaxYearConfig(input.taxProfile.taxYear || 2025);
  const filingStatus = input.taxProfile.filingStatus as FilingStatus;
  const taxableIncome = input.taxProfile.otherOrdinaryIncome + grossProfit;
  const brackets = taxConfig.federalLtcgBrackets[filingStatus];
  let computedLtcgRate = 0.20; // fallback
  for (const bracket of brackets) {
    if (taxableIncome >= bracket.min && taxableIncome < bracket.max) {
      computedLtcgRate = bracket.rate;
      break;
    }
  }

  const yearlyPrincipal: number[] = [];
  const yearlyInterest: number[] = [];
  const years = hasBalloon ? balloonYear! : amortYears;

  yearlyPrincipal.push(downPayment);
  yearlyInterest.push(0);

  for (let year = 1; year <= years; year++) {
    let yPrin = 0, yInt = 0;
    const startMonth = (year - 1) * 12;
    const endMonth = Math.min(year * 12, amortization.length);
    for (let m = startMonth; m < endMonth; m++) {
      yPrin += amortization[m].principal;
      yInt += amortization[m].interest;
    }
    if (year === years && balloonAmount > 0) {
      yPrin += balloonAmount;
    }
    yearlyPrincipal.push(yPrin);
    yearlyInterest.push(yInt);
  }

  for (let i = 0; i < yearlyPrincipal.length; i++) {
    const principalReceived = yearlyPrincipal[i];
    const interestIncome = yearlyInterest[i];
    const installmentGain = principalReceived * grossProfitRatio;

    let recaptureGain = 0;
    // IRS §453(d)(1): ALL depreciation recapture must be recognized in year of sale
    if (i === 0 && remainingRecapture > 0) {
      recaptureGain = remainingRecapture; // Full amount, NOT capped by installmentGain
      remainingRecapture = 0;
    }

    const ltcgGain = Math.max(0, installmentGain - recaptureGain);

    const ltcgRate = computedLtcgRate;
    const recaptureRate = taxConfig.section1250Rate;
    const ordinaryRate = taxConfig.ordinaryTopRate;

    const federalTax =
      (ltcgGain * ltcgRate) +
      (recaptureGain * recaptureRate) +
      (interestIncome * ordinaryRate);

    const stateTax = (installmentGain + interestIncome) * stateRate;
    const totalTax = federalTax + stateTax;
    const netAfterTax = principalReceived + interestIncome - totalTax;

    installmentTaxSchedule.push({
      year: i,
      principalReceived,
      interestIncome,
      installmentGain,
      recaptureGain,
      ltcgGain,
      federalTax,
      stateTax,
      totalTax,
      netAfterTax,
    });
  }

  const totalPrincipalReceived = downPayment + faceValue;
  const totalCashReceived = totalPrincipalReceived + totalInterestIncome;
  const totalTaxPaid = installmentTaxSchedule.reduce((sum, e) => sum + e.totalTax, 0);
  const netAfterTaxTotal = totalCashReceived - totalTaxPaid;

  const discountRate = 0.06;
  let npv = 0;
  for (const entry of installmentTaxSchedule) {
    const netCf = entry.principalReceived + entry.interestIncome - entry.totalTax;
    npv += netCf / Math.pow(1 + discountRate, entry.year);
  }

  const afrRate = input.afrRate || 0.04;
  const isCompliant = input.noteInterestRate >= afrRate;
  let imputedInterest = 0;
  if (!isCompliant) {
    const impliedRate = afrRate;
    const impliedMonthlyPayment = faceValue > 0
      ? faceValue * ((impliedRate / 12) * Math.pow(1 + impliedRate / 12, amortPayments)) / (Math.pow(1 + impliedRate / 12, amortPayments) - 1)
      : 0;
    imputedInterest = (impliedMonthlyPayment - monthlyPayment) * totalPeriods;

    warnings.push({
      code: 'AFR_VIOLATION',
      severity: 'error',
      message: `Note rate (${(input.noteInterestRate * 100).toFixed(2)}%) is below AFR (${(afrRate * 100).toFixed(2)}%). IRS will impute interest, creating phantom income.`,
    });
  }

  const buyerRiskScore = scoreBuyerRisk(input.buyerCreditProfile);

  if (buyerRiskScore >= 7) {
    warnings.push({
      code: 'HIGH_BUYER_RISK',
      severity: 'warning',
      message: `Buyer risk score of ${buyerRiskScore}/10 indicates elevated default risk.`,
    });
  }

  if (input.downPaymentPercent < 0.10) {
    warnings.push({
      code: 'LOW_DOWN_PAYMENT',
      severity: 'warning',
      message: `Down payment of ${(input.downPaymentPercent * 100).toFixed(0)}% is below recommended minimum of 10%.`,
    });
  }

  if (input.collateral.lienPosition !== 'first') {
    warnings.push({
      code: 'SUBORDINATE_LIEN',
      severity: 'warning',
      message: 'Note is not in first lien position. Recovery may be limited in default.',
    });
  }

  const creditLossAnalysis = buildCreditLossModel(
    faceValue,
    input.noteInterestRate,
    monthlyPayment,
    balloonYear || input.noteTermYears,
    buyerRiskScore,
    input.collateral
  );

  return {
    noteTerms: {
      faceValue,
      interestRate: input.noteInterestRate,
      termYears: input.noteTermYears,
      amortizationYears: amortYears,
      hasBalloon,
      balloonYear,
      balloonAmount,
      monthlyPayment,
      totalInterestIncome,
    },
    amortization,
    installmentTaxSchedule,
    cashFlowSummary: {
      downPayment,
      totalPrincipalReceived,
      totalInterestReceived: totalInterestIncome,
      totalCashReceived,
      totalTaxPaid,
      netAfterTax: netAfterTaxTotal,
      npvAtDiscount: npv,
    },
    afrCompliance: {
      afrRate,
      noteRate: input.noteInterestRate,
      isCompliant,
      imputedInterest,
    },
    creditLossAnalysis,
    buyerRiskScore,
    warnings,
  };
}

function scoreBuyerRisk(profile: BuyerCreditProfile): number {
  let score = 0;
  if (profile.creditScore < 620) score += 3;
  else if (profile.creditScore < 680) score += 2;
  else if (profile.creditScore < 720) score += 1;

  if (profile.debtToIncomeRatio > 0.50) score += 2;
  else if (profile.debtToIncomeRatio > 0.43) score += 1;

  if (profile.liquidReserves < profile.creditScore * 10) score += 1;
  if (profile.yearsInBusiness < 2) score += 1;
  if (profile.hasBankruptcy) score += 2;
  if (profile.hasForeclosure) score += 2;
  if (!profile.personalGuarantee) score += 1;

  return Math.min(10, score);
}

function buildCreditLossModel(
  noteBalance: number,
  interestRate: number,
  monthlyPayment: number,
  termYears: number,
  buyerRiskScore: number,
  collateral: CollateralInfo
): CreditLossEV {
  const baseDefaultProb = buyerRiskScore / 20;
  const recoveryBase = collateral.lienPosition === 'first' ? 0.70
    : collateral.lienPosition === 'second' ? 0.40
    : 0.20;

  const recoveryBonus = collateral.hasPersonalGuarantee ? 0.10 : 0;
  const baseRecovery = Math.min(1.0, recoveryBase + recoveryBonus);

  const scenarios: CreditLossScenario[] = [];

  const noDefaultProb = 1 - baseDefaultProb;
  scenarios.push({
    label: 'No Default',
    probability: noDefaultProb,
    defaultYear: 0,
    recoveryRate: 1.0,
    lossAmount: 0,
    expectedLoss: 0,
  });

  const earlyDefaultProb = baseDefaultProb * 0.4;
  const earlyDefaultYear = Math.min(2, termYears);
  let earlyBalance = noteBalance;
  {
    let bal = noteBalance;
    for (let m = 0; m < earlyDefaultYear * 12; m++) {
      const interest = bal * (interestRate / 12);
      const principal = monthlyPayment - interest;
      bal -= Math.min(principal, bal);
    }
    earlyBalance = bal;
  }
  const earlyRecovery = baseRecovery * 0.85;
  const earlyLoss = earlyBalance * (1 - earlyRecovery);
  scenarios.push({
    label: 'Early Default (Year 1-2)',
    probability: earlyDefaultProb,
    defaultYear: earlyDefaultYear,
    recoveryRate: earlyRecovery,
    lossAmount: earlyLoss,
    expectedLoss: earlyLoss * earlyDefaultProb,
  });

  const midDefaultProb = baseDefaultProb * 0.35;
  const midDefaultYear = Math.min(Math.ceil(termYears / 2), termYears);
  let midBalance = noteBalance;
  {
    let bal = noteBalance;
    for (let m = 0; m < midDefaultYear * 12; m++) {
      const interest = bal * (interestRate / 12);
      const principal = monthlyPayment - interest;
      bal -= Math.min(principal, bal);
    }
    midBalance = bal;
  }
  const midRecovery = baseRecovery;
  const midLoss = midBalance * (1 - midRecovery);
  scenarios.push({
    label: `Mid-Term Default (Year ${midDefaultYear})`,
    probability: midDefaultProb,
    defaultYear: midDefaultYear,
    recoveryRate: midRecovery,
    lossAmount: midLoss,
    expectedLoss: midLoss * midDefaultProb,
  });

  const lateDefaultProb = baseDefaultProb * 0.25;
  const lateDefaultYear = termYears;
  let lateBalance = noteBalance;
  {
    let bal = noteBalance;
    for (let m = 0; m < (lateDefaultYear - 1) * 12; m++) {
      const interest = bal * (interestRate / 12);
      const principal = monthlyPayment - interest;
      bal -= Math.min(principal, bal);
    }
    lateBalance = bal;
  }
  const lateRecovery = baseRecovery * 1.10;
  const lateLoss = lateBalance * (1 - Math.min(1.0, lateRecovery));
  scenarios.push({
    label: `Late Default (Year ${lateDefaultYear})`,
    probability: lateDefaultProb,
    defaultYear: lateDefaultYear,
    recoveryRate: Math.min(1.0, lateRecovery),
    lossAmount: lateLoss,
    expectedLoss: lateLoss * lateDefaultProb,
  });

  const expectedLoss = scenarios.reduce((sum, s) => sum + s.expectedLoss, 0);
  const expectedNetProceeds = noteBalance - expectedLoss;

  const riskAdjustedIrrFlows: CashFlow[] = [
    { period: 0, amount: noteBalance * (1 - baseDefaultProb), type: 'investment' },
  ];
  for (let year = 1; year <= termYears; year++) {
    riskAdjustedIrrFlows.push({
      period: year,
      amount: monthlyPayment * 12 * (1 - baseDefaultProb * 0.5),
      type: year === termYears ? 'distribution' : 'intermediate',
    });
  }
  const riskAdjustedIRR = canonicalBisectionIRR(riskAdjustedIrrFlows);

  const creditReserveRecommended = expectedLoss * 1.5;

  return {
    scenarios,
    expectedLoss,
    expectedNetProceeds,
    riskAdjustedIRR,
    creditReserveRecommended,
  };
}

// bisectionIRR removed — using canonical calculateIRR from irr-calculator.ts
