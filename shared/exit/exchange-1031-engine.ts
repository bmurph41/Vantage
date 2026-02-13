export interface Exchange1031EngineInput {
  relinquishedProperty: {
    salePrice: number;
    adjustedBasis: number;
    accumulatedDepreciation: number;
    mortgageBalance: number;
    closingCosts: number;
  };
  saleDate: string;
  replacementProperties: ReplacementPropertyInput[];
  qualifiedIntermediaryFee: number;
  additionalCashInvested: number;
  isTicOrDst?: boolean;
  isReverseExchange?: boolean;
  isImprovementExchange?: boolean;
}

export interface ReplacementPropertyInput {
  name: string;
  purchasePrice: number;
  newMortgage: number;
  closingCosts: number;
  identificationPriority: 'primary' | 'secondary' | 'backup';
}

export interface TimelineDeadline {
  label: string;
  date: string;
  daysFromSale: number;
  status: 'upcoming' | 'active' | 'expired';
  description: string;
}

export interface IdentificationRule {
  name: string;
  limit: string;
  currentValue: string;
  satisfied: boolean;
  description: string;
}

export interface ReplacementPropertyResult {
  name: string;
  purchasePrice: number;
  newMortgage: number;
  equityRequired: number;
  basisCarryover: number;
  deferredGain: number;
}

export interface BootAnalysis {
  cashBootReceived: number;
  mortgageBoot: number;
  totalBoot: number;
  bootTaxable: boolean;
  recognizedGain: number;
  taxOnBoot: number;
}

export interface QIChecklist {
  item: string;
  required: boolean;
  status: 'complete' | 'pending' | 'na';
  notes: string;
}

export interface Exchange1031EngineResult {
  timeline: TimelineDeadline[];
  identificationRules: IdentificationRule[];
  replacementResults: ReplacementPropertyResult[];
  bootAnalysis: BootAnalysis;
  qiChecklist: QIChecklist[];
  totalRealizedGain: number;
  totalDeferredGain: number;
  totalRecognizedGain: number;
  newAggregatedBasis: number;
  isFullyDeferred: boolean;
  warnings: Exchange1031Warning[];
}

export interface Exchange1031Warning {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
}

export function calculate1031ExchangeEngine(input: Exchange1031EngineInput): Exchange1031EngineResult {
  const warnings: Exchange1031Warning[] = [];

  const timeline = buildTimeline(input.saleDate, input.isReverseExchange || false);

  const identificationRules = evaluateIdentificationRules(input);

  // IRS formula: Amount Realized = Sale Price − Selling Expenses
  // Realized Gain = Amount Realized − Adjusted Basis
  const realizedGain = input.relinquishedProperty.salePrice
    - input.relinquishedProperty.closingCosts
    - input.relinquishedProperty.adjustedBasis;

  // Guard: empty replacement properties → no deferral possible, all gain recognized
  if (input.replacementProperties.length === 0) {
    warnings.push({
      code: 'NO_REPLACEMENT_PROPERTIES',
      severity: 'error',
      message: 'No replacement properties identified. All gain will be recognized — no deferral benefit.',
    });

    const qiChecklist = buildQIChecklist(input);
    return {
      timeline,
      identificationRules,
      replacementResults: [],
      bootAnalysis: {
        cashBootReceived: 0,
        mortgageBoot: 0,
        totalBoot: 0,
        bootTaxable: realizedGain > 0,
        recognizedGain: Math.max(0, realizedGain),
        taxOnBoot: 0,
      },
      qiChecklist,
      totalRealizedGain: realizedGain,
      totalDeferredGain: 0,
      totalRecognizedGain: Math.max(0, realizedGain),
      newAggregatedBasis: 0,
      isFullyDeferred: false,
      warnings,
    };
  }

  const totalReplacementValue = input.replacementProperties.reduce((sum, p) => sum + p.purchasePrice, 0);
  const totalReplacementMortgage = input.replacementProperties.reduce((sum, p) => sum + p.newMortgage, 0);

  const netEquityRelinquished = input.relinquishedProperty.salePrice
    - input.relinquishedProperty.closingCosts
    - input.relinquishedProperty.mortgageBalance
    - input.qualifiedIntermediaryFee;

  const netEquityNeeded = totalReplacementValue
    - totalReplacementMortgage
    + input.replacementProperties.reduce((sum, p) => sum + p.closingCosts, 0);

  const cashBootReceived = Math.max(0, netEquityRelinquished - netEquityNeeded - input.additionalCashInvested);
  const mortgageBoot = Math.max(0, input.relinquishedProperty.mortgageBalance - totalReplacementMortgage);
  const totalBoot = cashBootReceived + mortgageBoot;

  const recognizedGain = Math.min(Math.max(0, realizedGain), totalBoot);
  const deferredGain = Math.max(0, realizedGain - recognizedGain);

  const bootTaxable = totalBoot > 0;

  // Boot tax is now computed by the orchestrator through the tax engine, which
  // accounts for filing status, income brackets, state tax, and NIIT eligibility.
  // We set taxOnBoot = 0 here; the orchestrator pro-rates full tax to recognized gain.
  const taxOnBoot = 0;

  const bootAnalysis: BootAnalysis = {
    cashBootReceived,
    mortgageBoot,
    totalBoot,
    bootTaxable,
    recognizedGain,
    taxOnBoot,
  };

  const replacementResults: ReplacementPropertyResult[] = input.replacementProperties.map(prop => {
    const shareOfRelinquished = totalReplacementValue > 0
      ? prop.purchasePrice / totalReplacementValue
      : 1 / input.replacementProperties.length;

    const allocatedDeferredGain = deferredGain * shareOfRelinquished;
    const basisCarryover = prop.purchasePrice - allocatedDeferredGain;
    const equityRequired = prop.purchasePrice - prop.newMortgage + prop.closingCosts;

    return {
      name: prop.name,
      purchasePrice: prop.purchasePrice,
      newMortgage: prop.newMortgage,
      equityRequired,
      basisCarryover,
      deferredGain: allocatedDeferredGain,
    };
  });

  const newAggregatedBasis = replacementResults.reduce((sum, r) => sum + r.basisCarryover, 0);
  const isFullyDeferred = recognizedGain === 0;

  const qiChecklist = buildQIChecklist(input);

  if (!isFullyDeferred) {
    warnings.push({
      code: 'BOOT_RECEIVED',
      severity: 'warning',
      message: `Boot of ${formatCurrency(totalBoot)} will result in ${formatCurrency(recognizedGain)} of recognized gain.`,
    });
  }

  if (realizedGain <= 0) {
    warnings.push({
      code: 'NO_GAIN_TO_DEFER',
      severity: 'warning',
      message: 'No gain to defer — a 1031 exchange provides no tax benefit when selling at a loss.',
    });
  }

  if (totalReplacementValue < input.relinquishedProperty.salePrice) {
    warnings.push({
      code: 'TRADING_DOWN',
      severity: 'warning',
      message: 'Trading down: replacement property value is less than relinquished property sale price.',
    });
  }

  if (totalReplacementMortgage < input.relinquishedProperty.mortgageBalance) {
    warnings.push({
      code: 'MORTGAGE_RELIEF',
      severity: 'warning',
      message: 'Mortgage relief boot: new mortgage is less than relinquished mortgage.',
    });
  }

  if (input.replacementProperties.length > 3) {
    warnings.push({
      code: 'MANY_REPLACEMENTS',
      severity: 'info',
      message: 'Identifying more than 3 replacement properties requires meeting the 200% or 95% rule.',
    });
  }

  if (input.isReverseExchange) {
    warnings.push({
      code: 'REVERSE_EXCHANGE',
      severity: 'info',
      message: 'Reverse exchange (Rev. Proc. 2000-37): replacement property acquired before relinquished property is sold. Exchange Accommodation Titleholder (EAT) required.',
    });
  }

  if (input.isTicOrDst) {
    warnings.push({
      code: 'DST_TIC',
      severity: 'info',
      message: 'Replacement property is a DST/TIC interest. Ensure compliance with Rev. Rul. 2004-86.',
    });
  }

  return {
    timeline,
    identificationRules,
    replacementResults,
    bootAnalysis,
    qiChecklist,
    totalRealizedGain: realizedGain,
    totalDeferredGain: deferredGain,
    totalRecognizedGain: recognizedGain,
    newAggregatedBasis,
    isFullyDeferred,
    warnings,
  };
}

function buildTimeline(saleDate: string, isReverse: boolean): TimelineDeadline[] {
  const sale = new Date(saleDate);
  const now = new Date();

  function addDays(d: Date, days: number): Date {
    const result = new Date(d);
    result.setDate(result.getDate() + days);
    return result;
  }

  function getStatus(deadline: Date): 'upcoming' | 'active' | 'expired' {
    if (now > deadline) return 'expired';
    const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 14) return 'active';
    return 'upcoming';
  }

  const id45 = addDays(sale, 45);
  const close180 = addDays(sale, 180);

  const deadlines: TimelineDeadline[] = [
    {
      label: 'Sale Closing',
      date: sale.toISOString().split('T')[0],
      daysFromSale: 0,
      status: now >= sale ? 'expired' : 'upcoming',
      description: 'Relinquished property sale closes. QI takes custody of proceeds.',
    },
    {
      label: '45-Day Identification Deadline',
      date: id45.toISOString().split('T')[0],
      daysFromSale: 45,
      status: getStatus(id45),
      description: 'Written identification of replacement property(ies) must be delivered to QI.',
    },
    {
      label: '180-Day Exchange Deadline',
      date: close180.toISOString().split('T')[0],
      daysFromSale: 180,
      status: getStatus(close180),
      description: 'All replacement property acquisitions must close.',
    },
  ];

  if (isReverse) {
    deadlines.push({
      label: '180-Day Reverse Exchange Deadline',
      date: close180.toISOString().split('T')[0],
      daysFromSale: 180,
      status: getStatus(close180),
      description: 'EAT must transfer replacement property and relinquished property must be sold within 180 days.',
    });
  }

  return deadlines;
}

function evaluateIdentificationRules(input: Exchange1031EngineInput): IdentificationRule[] {
  const props = input.replacementProperties;
  const relinquishedFmv = input.relinquishedProperty.salePrice;

  const totalReplacementFmv = props.reduce((sum, p) => sum + p.purchasePrice, 0);

  const threePropertySatisfied = props.length <= 3;
  const twoHundredPercentSatisfied = totalReplacementFmv <= relinquishedFmv * 2;
  const ninetyFivePercentSatisfied = true;

  return [
    {
      name: '3-Property Rule',
      limit: '≤ 3 properties',
      currentValue: `${props.length} properties`,
      satisfied: threePropertySatisfied,
      description: 'Identify up to 3 replacement properties regardless of value.',
    },
    {
      name: '200% Rule',
      limit: `≤ ${formatCurrency(relinquishedFmv * 2)}`,
      currentValue: formatCurrency(totalReplacementFmv),
      satisfied: twoHundredPercentSatisfied,
      description: 'Total FMV of identified properties ≤ 200% of relinquished property FMV.',
    },
    {
      name: '95% Rule',
      limit: '≥ 95% of identified value acquired',
      currentValue: 'N/A (evaluated at close)',
      satisfied: ninetyFivePercentSatisfied,
      description: 'Must acquire ≥ 95% of the aggregate FMV of all identified properties.',
    },
  ];
}

function buildQIChecklist(input: Exchange1031EngineInput): QIChecklist[] {
  return [
    {
      item: 'Qualified Intermediary engaged',
      required: true,
      status: 'pending',
      notes: 'QI must not be a disqualified person (agent, attorney, accountant of taxpayer).',
    },
    {
      item: 'Exchange Agreement executed',
      required: true,
      status: 'pending',
      notes: 'Written agreement between taxpayer and QI before closing.',
    },
    {
      item: 'Direct deed (not through QI)',
      required: true,
      status: 'pending',
      notes: 'Deed goes directly from seller to buyer, not through QI.',
    },
    {
      item: 'Proceeds held by QI (not taxpayer)',
      required: true,
      status: 'pending',
      notes: 'Taxpayer must not have actual or constructive receipt of exchange proceeds.',
    },
    {
      item: '45-day identification letter prepared',
      required: true,
      status: 'pending',
      notes: 'Written, signed identification of replacement property within 45 days.',
    },
    {
      item: 'Like-kind property verification',
      required: true,
      status: 'pending',
      notes: 'Both properties must be held for investment or productive use in trade/business.',
    },
    {
      item: 'Related party check',
      required: true,
      status: 'pending',
      notes: 'Exchanges with related parties have a 2-year holding requirement.',
    },
    {
      item: 'State conformity verified',
      required: false,
      status: 'pending',
      notes: 'Some states (e.g., CA) require separate 1031 filing.',
    },
  ];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
