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

  const stateRates: Record<string, number> = {
    CA: 0.133, NY: 0.109, NJ: 0.1075, FL: 0, TX: 0, WA: 0.07, MA: 0.09,
    IL: 0.0495, PA: 0.0307, OH: 0.04, GA: 0.0549, NC: 0.0525,
  };
  const stateRate = stateRates[input.taxProfile.stateOfResidence.toUpperCase()] || 0.05;

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
    if (i === 0 && remainingRecapture > 0) {
      recaptureGain = Math.min(remainingRecapture, installmentGain);
      remainingRecapture -= recaptureGain;
    }

    const ltcgGain = Math.max(0, installmentGain - recaptureGain);

    const ltcgRate = 0.20;
    const recaptureRate = 0.25;
    const ordinaryRate = 0.37;

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

  const riskAdjustedCashFlows = [-noteBalance * (1 - baseDefaultProb)];
  for (let year = 1; year <= termYears; year++) {
    riskAdjustedCashFlows.push(monthlyPayment * 12 * (1 - baseDefaultProb * 0.5));
  }
  const riskAdjustedIRR = bisectionIRR(riskAdjustedCashFlows);

  const creditReserveRecommended = expectedLoss * 1.5;

  return {
    scenarios,
    expectedLoss,
    expectedNetProceeds,
    riskAdjustedIRR,
    creditReserveRecommended,
  };
}

function bisectionIRR(cashflows: number[], maxIter = 1000, tol = 1e-7): number | null {
  if (cashflows.length < 2) return null;
  const hasPos = cashflows.some(v => v > 0);
  const hasNeg = cashflows.some(v => v < 0);
  if (!hasPos || !hasNeg) return null;

  let lo = -0.99, hi = 10.0;
  for (let i = 0; i < maxIter; i++) {
    const mid = (lo + hi) / 2;
    const npv = cashflows.reduce((s, cf, t) => s + cf / Math.pow(1 + mid, t), 0);
    if (Math.abs(npv) < tol) return mid;
    if (npv > 0) lo = mid; else hi = mid;
    if (hi - lo < tol) return mid;
  }
  return (lo + hi) / 2;
}
