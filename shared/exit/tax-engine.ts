import type { BasisCalculationResult } from './basis-ledger';
import type { FilingStatus } from './tax-calculations';
// FilingStatus is canonical in ./tax-calculations; do not re-export from this module
// (would collide with tax-calculations under shared/exit/index.ts wildcard re-exports).

export interface TaxYearConfig {
  year: number;
  federalLtcgBrackets: Record<FilingStatus, { min: number; max: number; rate: number }[]>;
  niitThresholds: Record<FilingStatus, number>;
  niitRate: number;
  section1250Rate: number;
  section1245MaxRate: number;
  ordinaryTopRate: number;
  qualifiedOpportunityZoneExclusion: number;
}

export const TAX_YEAR_2024: TaxYearConfig = {
  year: 2024,
  federalLtcgBrackets: {
    single: [
      { min: 0, max: 47025, rate: 0 },
      { min: 47025, max: 518900, rate: 0.15 },
      { min: 518900, max: Infinity, rate: 0.20 },
    ],
    married: [
      { min: 0, max: 94050, rate: 0 },
      { min: 94050, max: 583750, rate: 0.15 },
      { min: 583750, max: Infinity, rate: 0.20 },
    ],
    head_of_household: [
      { min: 0, max: 63000, rate: 0 },
      { min: 63000, max: 551350, rate: 0.15 },
      { min: 551350, max: Infinity, rate: 0.20 },
    ],
  },
  niitThresholds: { single: 200000, married: 250000, head_of_household: 200000 },
  niitRate: 0.038,
  section1250Rate: 0.25,
  section1245MaxRate: 0.37,
  ordinaryTopRate: 0.37,
  qualifiedOpportunityZoneExclusion: 0.10,
};

export const TAX_YEAR_2025: TaxYearConfig = {
  year: 2025,
  federalLtcgBrackets: {
    single: [
      { min: 0, max: 48350, rate: 0 },
      { min: 48350, max: 533400, rate: 0.15 },
      { min: 533400, max: Infinity, rate: 0.20 },
    ],
    married: [
      { min: 0, max: 96700, rate: 0 },
      { min: 96700, max: 600050, rate: 0.15 },
      { min: 600050, max: Infinity, rate: 0.20 },
    ],
    head_of_household: [
      { min: 0, max: 64750, rate: 0 },
      { min: 64750, max: 566700, rate: 0.15 },
      { min: 566700, max: Infinity, rate: 0.20 },
    ],
  },
  niitThresholds: { single: 200000, married: 250000, head_of_household: 200000 },
  niitRate: 0.038,
  section1250Rate: 0.25,
  section1245MaxRate: 0.37,
  ordinaryTopRate: 0.37,
  qualifiedOpportunityZoneExclusion: 0.10,
};

export const TAX_YEARS: Record<number, TaxYearConfig> = {
  2024: TAX_YEAR_2024,
  2025: TAX_YEAR_2025,
};

export function getTaxYearConfig(year: number): TaxYearConfig {
  if (TAX_YEARS[year]) return TAX_YEARS[year];
  const latest = Object.keys(TAX_YEARS).map(Number).sort((a, b) => b - a)[0];
  return TAX_YEARS[latest];
}

export const STATE_CAPITAL_GAINS_RATES: Record<string, { rate: number; hasExclusion: boolean; exclusionAmount: number; appliesToLtcg: boolean }> = {
  AL: { rate: 0.05, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  AK: { rate: 0, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: false },
  AZ: { rate: 0.025, hasExclusion: true, exclusionAmount: 0, appliesToLtcg: true },
  AR: { rate: 0.044, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  CA: { rate: 0.133, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  CO: { rate: 0.044, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  CT: { rate: 0.0699, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  DE: { rate: 0.066, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  FL: { rate: 0, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: false },
  GA: { rate: 0.0549, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  HI: { rate: 0.0725, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  ID: { rate: 0.058, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  IL: { rate: 0.0495, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  IN: { rate: 0.0315, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  IA: { rate: 0.06, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  KS: { rate: 0.057, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  KY: { rate: 0.04, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  LA: { rate: 0.0425, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  ME: { rate: 0.0715, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  MD: { rate: 0.0575, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  MA: { rate: 0.09, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  MI: { rate: 0.0425, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  MN: { rate: 0.0985, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  MS: { rate: 0.05, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  MO: { rate: 0.0495, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  MT: { rate: 0.0575, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  NE: { rate: 0.0584, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  NV: { rate: 0, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: false },
  NH: { rate: 0.05, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  NJ: { rate: 0.1075, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  NM: { rate: 0.059, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  NY: { rate: 0.109, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  NC: { rate: 0.0525, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  ND: { rate: 0.029, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  OH: { rate: 0.04, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  OK: { rate: 0.0475, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  OR: { rate: 0.099, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  PA: { rate: 0.0307, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  RI: { rate: 0.0599, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  SC: { rate: 0.07, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  SD: { rate: 0, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: false },
  TN: { rate: 0, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: false },
  TX: { rate: 0, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: false },
  UT: { rate: 0.0485, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  VT: { rate: 0.0875, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  VA: { rate: 0.0575, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  WA: { rate: 0.07, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  WV: { rate: 0.0575, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  WI: { rate: 0.0765, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
  WY: { rate: 0, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: false },
  DC: { rate: 0.0975, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true },
};

export interface TaxProfileInput {
  filingStatus: FilingStatus;
  otherOrdinaryIncome: number;
  otherInvestmentIncome: number;
  stateOfResidence: string;
  propertyState?: string;
  taxYear?: number;
  qualifiedOpportunityZone?: boolean;
  passiveActivitySuspendedLosses?: number;
  priorYear1231Losses?: number;
}

export interface GainAllocationInput {
  grossSalePrice: number;
  costsOfSale: number;
  basisResult: BasisCalculationResult;
  holdingPeriodMonths: number;
  installmentSale?: {
    enabled: boolean;
    downPaymentPercent: number;
    termYears: number;
    interestRate: number;
  };
}

export interface RecaptureBucket {
  label: string;
  amount: number;
  rate: number;
  taxAmount: number;
  irsSection: string;
}

export interface GainAllocation {
  netSalePrice: number;
  adjustedBasis: number;
  totalGain: number;
  isLongTerm: boolean;

  unrecapturedSection1250: number;
  section1245Recapture: number;
  longTermCapitalGain: number;
  shortTermCapitalGain: number;

  suspendedLossesApplied: number;
  section1231LookbackApplied: number;
  netTaxableGain: number;

  recaptureBuckets: RecaptureBucket[];
}

export interface FederalTaxBreakdown {
  ltcgRate: number;
  ltcgTax: number;
  section1250Tax: number;
  section1245Tax: number;
  niitApplies: boolean;
  niitMagi: number;
  niitThreshold: number;
  niitBase: number;
  niitTax: number;
  totalFederalTax: number;
}

export interface StateTaxBreakdown {
  state: string;
  rate: number;
  taxableGain: number;
  tax: number;
}

export interface DualStateTaxResult {
  residenceState: StateTaxBreakdown;
  propertyState: StateTaxBreakdown | null;
  creditForPropertyStateTax: number;
  netStateTax: number;
}

export interface InstallmentTaxSchedule {
  year: number;
  principalReceived: number;
  interestReceived: number;
  gainRecognized: number;
  section1250RecapturedThisYear: number;
  section1245RecapturedThisYear: number;
  ltcgThisYear: number;
  federalTax: number;
  stateTax: number;
  niitTax: number;
  totalTax: number;
  cumulativeTax: number;
}

export interface TaxEngineResult {
  gainAllocation: GainAllocation;
  federal: FederalTaxBreakdown;
  dualState: DualStateTaxResult;
  totalTaxLiability: number;
  effectiveTaxRate: number;
  afterTaxProceeds: number;
  installmentSchedule: InstallmentTaxSchedule[] | null;
  installmentTotalTax: number | null;
  installmentNpvSavings: number | null;
  warnings: TaxWarning[];
  auditTrail: AuditEntry[];
}

export interface TaxWarning {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

export interface AuditEntry {
  step: string;
  description: string;
  value: number;
  formula?: string;
}

export function allocateGains(
  input: GainAllocationInput,
  profile: TaxProfileInput
): GainAllocation {
  const netSalePrice = input.grossSalePrice - input.costsOfSale;
  const adjustedBasis = input.basisResult.adjustedBasis;
  const totalGain = netSalePrice - adjustedBasis;
  const isLongTerm = input.holdingPeriodMonths >= 12;

  const unrecapturedSection1250 = Math.min(
    input.basisResult.straightLineRecapture,
    Math.max(0, totalGain)
  );

  const section1245Recapture = Math.min(
    input.basisResult.section1245Recapture,
    Math.max(0, totalGain - unrecapturedSection1250)
  );

  const remainingGain = Math.max(0, totalGain - unrecapturedSection1250 - section1245Recapture);

  let longTermCapitalGain = 0;
  let shortTermCapitalGain = 0;
  if (isLongTerm) {
    longTermCapitalGain = remainingGain;
  } else {
    shortTermCapitalGain = remainingGain;
  }

  const suspendedLossesApplied = Math.min(
    profile.passiveActivitySuspendedLosses || 0,
    Math.max(0, totalGain)
  );

  let section1231LookbackApplied = 0;
  if (isLongTerm && (profile.priorYear1231Losses || 0) > 0) {
    section1231LookbackApplied = Math.min(
      profile.priorYear1231Losses || 0,
      longTermCapitalGain
    );
    longTermCapitalGain -= section1231LookbackApplied;
    shortTermCapitalGain += section1231LookbackApplied;
  }

  const netTaxableGain = Math.max(0, totalGain - suspendedLossesApplied);

  const recaptureBuckets: RecaptureBucket[] = [];
  const taxConfig = getTaxYearConfig(profile.taxYear || 2025);

  if (unrecapturedSection1250 > 0) {
    recaptureBuckets.push({
      label: 'Unrecaptured §1250 Gain (Real Property Depreciation)',
      amount: unrecapturedSection1250,
      rate: taxConfig.section1250Rate,
      taxAmount: unrecapturedSection1250 * taxConfig.section1250Rate,
      irsSection: '§1250',
    });
  }

  if (section1245Recapture > 0) {
    recaptureBuckets.push({
      label: '§1245 Recapture (Personal Property)',
      amount: section1245Recapture,
      rate: taxConfig.section1245MaxRate,
      taxAmount: section1245Recapture * taxConfig.section1245MaxRate,
      irsSection: '§1245',
    });
  }

  if (longTermCapitalGain > 0) {
    const taxableIncome = profile.otherOrdinaryIncome + longTermCapitalGain;
    const ltcgRate = getLtcgRate(profile.filingStatus, taxableIncome, taxConfig);
    recaptureBuckets.push({
      label: 'Long-Term Capital Gain',
      amount: longTermCapitalGain,
      rate: ltcgRate,
      taxAmount: longTermCapitalGain * ltcgRate,
      irsSection: '§1(h)',
    });
  }

  if (shortTermCapitalGain > 0) {
    recaptureBuckets.push({
      label: 'Short-Term Capital Gain (Ordinary Rate)',
      amount: shortTermCapitalGain,
      rate: taxConfig.ordinaryTopRate,
      taxAmount: shortTermCapitalGain * taxConfig.ordinaryTopRate,
      irsSection: '§1(a)',
    });
  }

  return {
    netSalePrice,
    adjustedBasis,
    totalGain,
    isLongTerm,
    unrecapturedSection1250,
    section1245Recapture,
    longTermCapitalGain,
    shortTermCapitalGain,
    suspendedLossesApplied,
    section1231LookbackApplied,
    netTaxableGain,
    recaptureBuckets,
  };
}

export function calculateFederalTax(
  allocation: GainAllocation,
  profile: TaxProfileInput
): FederalTaxBreakdown {
  const taxConfig = getTaxYearConfig(profile.taxYear || 2025);

  const taxableIncome = profile.otherOrdinaryIncome + allocation.longTermCapitalGain;
  const ltcgRate = getLtcgRate(profile.filingStatus, taxableIncome, taxConfig);
  const ltcgTax = allocation.longTermCapitalGain * ltcgRate;

  const section1250Tax = allocation.unrecapturedSection1250 * taxConfig.section1250Rate;
  const section1245Tax = allocation.section1245Recapture * taxConfig.section1245MaxRate;

  const stcgTax = allocation.shortTermCapitalGain * taxConfig.ordinaryTopRate;

  const niitThreshold = taxConfig.niitThresholds[profile.filingStatus];
  const niitMagi = profile.otherOrdinaryIncome + profile.otherInvestmentIncome + allocation.netTaxableGain;
  const niitApplies = niitMagi > niitThreshold;
  const magiExcess = Math.max(0, niitMagi - niitThreshold);
  const niitBase = Math.min(magiExcess, allocation.netTaxableGain + profile.otherInvestmentIncome);
  const niitTax = niitApplies ? niitBase * taxConfig.niitRate : 0;

  const totalFederalTax = ltcgTax + section1250Tax + section1245Tax + stcgTax + niitTax;

  return {
    ltcgRate,
    ltcgTax,
    section1250Tax,
    section1245Tax,
    niitApplies,
    niitMagi,
    niitThreshold,
    niitBase,
    niitTax,
    totalFederalTax,
  };
}

export function calculateDualStateTax(
  allocation: GainAllocation,
  profile: TaxProfileInput
): DualStateTaxResult {
  const residenceCode = profile.stateOfResidence.toUpperCase();
  const propertyCode = (profile.propertyState || '').toUpperCase();
  const hasDualState = propertyCode && propertyCode !== residenceCode;

  const residenceInfo = STATE_CAPITAL_GAINS_RATES[residenceCode] || { rate: 0, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true };

  const residenceTaxableGain = residenceInfo.hasExclusion
    ? Math.max(0, allocation.netTaxableGain - residenceInfo.exclusionAmount)
    : allocation.netTaxableGain;

  const residenceState: StateTaxBreakdown = {
    state: residenceCode,
    rate: residenceInfo.rate,
    taxableGain: residenceTaxableGain,
    tax: residenceTaxableGain * residenceInfo.rate,
  };

  let propertyState: StateTaxBreakdown | null = null;
  let creditForPropertyStateTax = 0;

  if (hasDualState) {
    const propInfo = STATE_CAPITAL_GAINS_RATES[propertyCode] || { rate: 0, hasExclusion: false, exclusionAmount: 0, appliesToLtcg: true };
    const propTaxableGain = propInfo.hasExclusion
      ? Math.max(0, allocation.netTaxableGain - propInfo.exclusionAmount)
      : allocation.netTaxableGain;

    propertyState = {
      state: propertyCode,
      rate: propInfo.rate,
      taxableGain: propTaxableGain,
      tax: propTaxableGain * propInfo.rate,
    };

    creditForPropertyStateTax = Math.min(propertyState.tax, residenceState.tax);
  }

  const netStateTax = residenceState.tax - creditForPropertyStateTax + (propertyState?.tax || 0);

  return {
    residenceState,
    propertyState,
    creditForPropertyStateTax,
    netStateTax,
  };
}

export function calculateInstallmentTaxSchedule(
  allocation: GainAllocation,
  profile: TaxProfileInput,
  installmentConfig: { downPaymentPercent: number; termYears: number; interestRate: number }
): InstallmentTaxSchedule[] {
  const taxConfig = getTaxYearConfig(profile.taxYear || 2025);
  const salePrice = allocation.netSalePrice;

  const grossProfit = allocation.totalGain;
  const grossProfitRatio = grossProfit / allocation.netSalePrice;

  const downPayment = allocation.netSalePrice * installmentConfig.downPaymentPercent;
  const financedAmount = allocation.netSalePrice - downPayment;

  const monthlyRate = installmentConfig.interestRate / 12;
  const numPayments = installmentConfig.termYears * 12;
  const monthlyPayment = financedAmount > 0
    ? financedAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
    : 0;

  const totalRecapture1250 = allocation.unrecapturedSection1250;
  const totalRecapture1245 = allocation.section1245Recapture;

  const schedule: InstallmentTaxSchedule[] = [];
  let balance = financedAmount;
  let cumulativeTax = 0;
  let remainingRecapture1250 = totalRecapture1250;
  let remainingRecapture1245 = totalRecapture1245;

  for (let year = 0; year <= installmentConfig.termYears; year++) {
    let principalReceived = 0;
    let interestReceived = 0;

    if (year === 0) {
      principalReceived = downPayment;
    } else {
      for (let month = 0; month < 12; month++) {
        if (balance <= 0) break;
        const interest = balance * monthlyRate;
        const principal = Math.min(monthlyPayment - interest, balance);
        interestReceived += interest;
        principalReceived += principal;
        balance -= principal;
      }
    }

    const gainRecognized = principalReceived * grossProfitRatio;

    // IRS §453(d)(1): ALL depreciation recapture is recognized in the year of sale,
    // regardless of installment treatment. Recapture is NOT limited by the
    // gross profit ratio of the down payment — it is frontloaded in full.
    let section1250RecapturedThisYear = 0;
    if (year === 0 && remainingRecapture1250 > 0) {
      section1250RecapturedThisYear = remainingRecapture1250; // Full amount, not capped by gainRecognized
      remainingRecapture1250 = 0;
    }

    let section1245RecapturedThisYear = 0;
    if (year === 0 && remainingRecapture1245 > 0) {
      section1245RecapturedThisYear = remainingRecapture1245; // Full amount
      remainingRecapture1245 = 0;
    }

    // In Year 0, total recognized = full recapture + any remaining LTCG from down payment
    // In subsequent years, recognized gain is pure LTCG (no recapture remaining)
    const totalRecaptureThisYear = section1250RecapturedThisYear + section1245RecapturedThisYear;
    const ltcgThisYear = Math.max(0, gainRecognized - totalRecaptureThisYear);

    const taxableIncome = profile.otherOrdinaryIncome + ltcgThisYear;
    const ltcgRateThisYear = getLtcgRate(profile.filingStatus, taxableIncome, taxConfig);
    const federalTax =
      (ltcgThisYear * ltcgRateThisYear) +
      (section1250RecapturedThisYear * taxConfig.section1250Rate) +
      (section1245RecapturedThisYear * taxConfig.section1245MaxRate) +
      (interestReceived * taxConfig.ordinaryTopRate);

    const residenceCode = profile.stateOfResidence.toUpperCase();
    const stateInfo = STATE_CAPITAL_GAINS_RATES[residenceCode] || { rate: 0 };
    const stateTax = (gainRecognized + interestReceived) * stateInfo.rate;

    const magiThisYear = profile.otherOrdinaryIncome + profile.otherInvestmentIncome + gainRecognized + interestReceived;
    const niitThreshold = taxConfig.niitThresholds[profile.filingStatus];
    let niitTax = 0;
    if (magiThisYear > niitThreshold) {
      const excess = Math.min(magiThisYear - niitThreshold, gainRecognized + interestReceived);
      niitTax = excess * taxConfig.niitRate;
    }

    const totalTax = federalTax + stateTax + niitTax;
    cumulativeTax += totalTax;

    schedule.push({
      year,
      principalReceived,
      interestReceived,
      gainRecognized,
      section1250RecapturedThisYear,
      section1245RecapturedThisYear,
      ltcgThisYear,
      federalTax,
      stateTax,
      niitTax,
      totalTax,
      cumulativeTax,
    });
  }

  return schedule;
}

export function runTaxEngine(
  gainInput: GainAllocationInput,
  profile: TaxProfileInput
): TaxEngineResult {
  const warnings: TaxWarning[] = [];
  const auditTrail: AuditEntry[] = [];

  const allocation = allocateGains(gainInput, profile);

  auditTrail.push(
    { step: 'sale', description: 'Gross Sale Price', value: gainInput.grossSalePrice },
    { step: 'sale', description: 'Costs of Sale', value: gainInput.costsOfSale },
    { step: 'sale', description: 'Net Sale Price', value: allocation.netSalePrice },
    { step: 'basis', description: 'Adjusted Basis', value: allocation.adjustedBasis },
    { step: 'gain', description: 'Total Gain', value: allocation.totalGain, formula: 'Net Sale Price - Adjusted Basis' },
    { step: 'gain', description: 'Unrecaptured §1250', value: allocation.unrecapturedSection1250 },
    { step: 'gain', description: '§1245 Recapture', value: allocation.section1245Recapture },
    { step: 'gain', description: 'LTCG', value: allocation.longTermCapitalGain },
    { step: 'gain', description: 'STCG', value: allocation.shortTermCapitalGain },
  );

  if (allocation.totalGain < 0) {
    warnings.push({ code: 'LOSS_SALE', severity: 'warning', message: 'Sale results in a loss. No tax liability on the loss. Tax treatment of losses may differ — consult a tax advisor.' });
  }

  if (!allocation.isLongTerm) {
    warnings.push({ code: 'SHORT_TERM', severity: 'warning', message: 'Holding period < 12 months — gain taxed at ordinary rates.' });
  }

  if (allocation.suspendedLossesApplied > 0) {
    warnings.push({ code: 'SUSPENDED_LOSSES', severity: 'info', message: `${formatCurrency(allocation.suspendedLossesApplied)} in suspended passive losses applied at disposition.` });
  }

  if (allocation.section1231LookbackApplied > 0) {
    warnings.push({ code: '1231_LOOKBACK', severity: 'warning', message: `§1231 lookback: ${formatCurrency(allocation.section1231LookbackApplied)} reclassified from LTCG to ordinary due to prior year §1231 losses.` });
  }

  const federal = calculateFederalTax(allocation, profile);

  auditTrail.push(
    { step: 'federal', description: 'LTCG Rate', value: federal.ltcgRate },
    { step: 'federal', description: 'LTCG Tax', value: federal.ltcgTax },
    { step: 'federal', description: '§1250 Tax', value: federal.section1250Tax },
    { step: 'federal', description: '§1245 Tax', value: federal.section1245Tax },
    { step: 'federal', description: 'NIIT', value: federal.niitTax },
    { step: 'federal', description: 'Total Federal', value: federal.totalFederalTax },
  );

  if (federal.niitApplies) {
    warnings.push({ code: 'NIIT_APPLIES', severity: 'info', message: `NIIT applies: MAGI of ${formatCurrency(federal.niitMagi)} exceeds ${formatCurrency(federal.niitThreshold)} threshold.` });
  }

  const dualState = calculateDualStateTax(allocation, profile);

  auditTrail.push(
    { step: 'state', description: `${dualState.residenceState.state} Tax`, value: dualState.residenceState.tax },
  );

  if (dualState.propertyState) {
    auditTrail.push(
      { step: 'state', description: `${dualState.propertyState.state} Tax (Property)`, value: dualState.propertyState.tax },
      { step: 'state', description: 'Credit for Property State', value: dualState.creditForPropertyStateTax },
    );
    warnings.push({ code: 'DUAL_STATE', severity: 'info', message: `Dual-state taxation: ${dualState.residenceState.state} (residence) + ${dualState.propertyState.state} (property) with credit applied.` });
  }

  const totalTaxLiability = federal.totalFederalTax + dualState.netStateTax;
  const effectiveTaxRate = allocation.totalGain > 0 ? totalTaxLiability / allocation.totalGain : 0;
  const afterTaxProceeds = allocation.netSalePrice - totalTaxLiability;

  auditTrail.push(
    { step: 'total', description: 'Net State Tax', value: dualState.netStateTax },
    { step: 'total', description: 'Total Tax Liability', value: totalTaxLiability },
    { step: 'total', description: 'Effective Tax Rate', value: effectiveTaxRate },
    { step: 'total', description: 'After-Tax Proceeds', value: afterTaxProceeds },
  );

  let installmentSchedule: InstallmentTaxSchedule[] | null = null;
  let installmentTotalTax: number | null = null;
  let installmentNpvSavings: number | null = null;

  if (gainInput.installmentSale?.enabled) {
    installmentSchedule = calculateInstallmentTaxSchedule(allocation, profile, {
      downPaymentPercent: gainInput.installmentSale.downPaymentPercent,
      termYears: gainInput.installmentSale.termYears,
      interestRate: gainInput.installmentSale.interestRate,
    });

    installmentTotalTax = installmentSchedule[installmentSchedule.length - 1]?.cumulativeTax || 0;

    const discountRate = 0.06;
    let npvInstallmentTax = 0;
    for (const entry of installmentSchedule) {
      npvInstallmentTax += entry.totalTax / Math.pow(1 + discountRate, entry.year);
    }
    const npvLumpSumTax = totalTaxLiability;
    installmentNpvSavings = npvLumpSumTax - npvInstallmentTax;

    if (installmentNpvSavings > 0) {
      warnings.push({ code: 'INSTALLMENT_SAVINGS', severity: 'info', message: `Installment sale saves ${formatCurrency(installmentNpvSavings)} on NPV basis vs. lump-sum sale.` });
    }

    const afrMinRate = 0.04;
    if (gainInput.installmentSale.interestRate < afrMinRate) {
      warnings.push({ code: 'AFR_WARNING', severity: 'warning', message: `Note interest rate (${(gainInput.installmentSale.interestRate * 100).toFixed(1)}%) may be below the AFR minimum. IRS may impute interest.` });
    }
  }

  if (profile.qualifiedOpportunityZone) {
    warnings.push({ code: 'QOZ_NOTE', severity: 'info', message: 'Qualified Opportunity Zone deferral may apply to recognized gain. Consult tax advisor for current QOZ rules.' });
  }

  return {
    gainAllocation: allocation,
    federal,
    dualState,
    totalTaxLiability,
    effectiveTaxRate,
    afterTaxProceeds,
    installmentSchedule,
    installmentTotalTax,
    installmentNpvSavings,
    warnings,
    auditTrail,
  };
}

function getLtcgRate(filingStatus: FilingStatus, taxableIncome: number, config: TaxYearConfig): number {
  const brackets = config.federalLtcgBrackets[filingStatus];
  for (const bracket of brackets) {
    if (taxableIncome >= bracket.min && taxableIncome < bracket.max) {
      return bracket.rate;
    }
  }
  return 0.20;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
