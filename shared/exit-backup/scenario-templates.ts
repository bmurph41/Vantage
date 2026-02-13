export type ExitScenarioCategory = 'direct_sale' | 'tax_deferred' | 'installment' | 'structured' | 'portfolio';

export interface ScenarioTemplateDefinition {
  code: string;
  name: string;
  description: string;
  category: ExitScenarioCategory;
  ccimWorksheetType?: 'ACSW' | 'CFAW' | 'both';
  supportsMultiYear: boolean;
  supportsMortgageTracking: boolean;
  supportsBasisLedger: boolean;
  supportsTaxDeferral: boolean;
  supportsWaterfall: boolean;
  requiredInputs: string[];
  optionalInputs: string[];
  calculators: string[];
}

export const EXIT_SCENARIO_TEMPLATES: ScenarioTemplateDefinition[] = [
  {
    code: 'cash_sale_standard',
    name: 'Standard Cash Sale',
    description: 'Outright sale with no tax deferral strategies',
    category: 'direct_sale',
    ccimWorksheetType: 'ACSW',
    supportsMultiYear: false,
    supportsMortgageTracking: true,
    supportsBasisLedger: true,
    supportsTaxDeferral: false,
    supportsWaterfall: false,
    requiredInputs: ['salePrice', 'adjustedBasis', 'holdingPeriodYears'],
    optionalInputs: ['brokerCommission', 'closingCosts', 'participationPayments'],
    calculators: ['basisLedger', 'taxCalculation', 'netProceeds'],
  },
  {
    code: 'cash_sale_earnout',
    name: 'Cash Sale with Earnout',
    description: 'Sale with contingent future payments based on performance',
    category: 'direct_sale',
    ccimWorksheetType: 'ACSW',
    supportsMultiYear: true,
    supportsMortgageTracking: true,
    supportsBasisLedger: true,
    supportsTaxDeferral: false,
    supportsWaterfall: false,
    requiredInputs: ['salePrice', 'adjustedBasis', 'earnoutMetrics', 'earnoutProbability'],
    optionalInputs: ['earnoutCap', 'earnoutFloor', 'earnoutTerm'],
    calculators: ['basisLedger', 'taxCalculation', 'earnoutPV', 'netProceeds'],
  },
  {
    code: '1031_full_exchange',
    name: '1031 Full Exchange',
    description: 'Complete like-kind exchange with no boot',
    category: 'tax_deferred',
    ccimWorksheetType: 'both',
    supportsMultiYear: true,
    supportsMortgageTracking: true,
    supportsBasisLedger: true,
    supportsTaxDeferral: true,
    supportsWaterfall: false,
    requiredInputs: ['relinquishedValue', 'relinquishedBasis', 'replacementValue'],
    optionalInputs: ['qiFees', 'identificationDeadline', 'exchangeDeadline', 'replacementProperties'],
    calculators: ['basisLedger', '1031Calculator', 'deferredGain', 'newBasis'],
  },
  {
    code: '1031_partial_exchange',
    name: '1031 Partial Exchange',
    description: 'Like-kind exchange with boot received or trading down',
    category: 'tax_deferred',
    ccimWorksheetType: 'both',
    supportsMultiYear: true,
    supportsMortgageTracking: true,
    supportsBasisLedger: true,
    supportsTaxDeferral: true,
    supportsWaterfall: false,
    requiredInputs: ['relinquishedValue', 'relinquishedBasis', 'replacementValue', 'bootReceived'],
    optionalInputs: ['mortgageBoot', 'qiFees'],
    calculators: ['basisLedger', '1031Calculator', 'bootTax', 'deferredGain'],
  },
  {
    code: '1031_reverse_exchange',
    name: '1031 Reverse Exchange',
    description: 'Purchase replacement property before selling relinquished',
    category: 'tax_deferred',
    ccimWorksheetType: 'both',
    supportsMultiYear: true,
    supportsMortgageTracking: true,
    supportsBasisLedger: true,
    supportsTaxDeferral: true,
    supportsWaterfall: false,
    requiredInputs: ['relinquishedValue', 'replacementValue', 'parkingArrangement'],
    optionalInputs: ['eatFees', 'parkingPeriod'],
    calculators: ['basisLedger', '1031Calculator', 'reverseExchangeCosts'],
  },
  {
    code: 'dst_single',
    name: 'DST Single Investment',
    description: 'Investment in a single Delaware Statutory Trust',
    category: 'tax_deferred',
    ccimWorksheetType: 'ACSW',
    supportsMultiYear: true,
    supportsMortgageTracking: false,
    supportsBasisLedger: true,
    supportsTaxDeferral: true,
    supportsWaterfall: false,
    requiredInputs: ['investmentAmount', 'dstName', 'projectedDistributionRate'],
    optionalInputs: ['sponsorFees', 'projectedHoldPeriod', 'leverageRatio'],
    calculators: ['dstReturn', 'depreciationPassthrough', 'taxDeferred'],
  },
  {
    code: 'dst_portfolio',
    name: 'DST Portfolio Allocation',
    description: 'Diversified investment across multiple DST offerings',
    category: 'tax_deferred',
    ccimWorksheetType: 'ACSW',
    supportsMultiYear: true,
    supportsMortgageTracking: false,
    supportsBasisLedger: true,
    supportsTaxDeferral: true,
    supportsWaterfall: false,
    requiredInputs: ['totalInvestmentAmount', 'dstAllocations'],
    optionalInputs: ['diversificationStrategy', 'riskTolerance'],
    calculators: ['portfolioReturn', 'weightedDistribution', 'diversificationAnalysis'],
  },
  {
    code: 'seller_financing_standard',
    name: 'Seller Financing (Installment Sale)',
    description: 'Carry a note with tax deferral on principal payments',
    category: 'installment',
    ccimWorksheetType: 'ACSW',
    supportsMultiYear: true,
    supportsMortgageTracking: true,
    supportsBasisLedger: true,
    supportsTaxDeferral: true,
    supportsWaterfall: false,
    requiredInputs: ['salePrice', 'downPayment', 'interestRate', 'termYears'],
    optionalInputs: ['amortizationYears', 'balloonYear', 'prepaymentTerms'],
    calculators: ['installmentSale', 'amortization', 'deferredTax', 'npvAnalysis'],
  },
  {
    code: 'seller_financing_balloon',
    name: 'Seller Financing with Balloon',
    description: 'Short-term note with balloon payment',
    category: 'installment',
    ccimWorksheetType: 'ACSW',
    supportsMultiYear: true,
    supportsMortgageTracking: true,
    supportsBasisLedger: true,
    supportsTaxDeferral: true,
    supportsWaterfall: false,
    requiredInputs: ['salePrice', 'downPayment', 'interestRate', 'termYears', 'balloonYear'],
    optionalInputs: ['collateralRequirements', 'defaultProvisions'],
    calculators: ['installmentSale', 'balloonAmortization', 'deferredTax'],
  },
  {
    code: 'waterfall_syndication',
    name: 'Syndication Waterfall',
    description: 'LP/GP distribution with preferred return and promote',
    category: 'structured',
    ccimWorksheetType: 'CFAW',
    supportsMultiYear: true,
    supportsMortgageTracking: true,
    supportsBasisLedger: true,
    supportsTaxDeferral: false,
    supportsWaterfall: true,
    requiredInputs: ['totalProceeds', 'totalCapitalContributed', 'holdingPeriodYears'],
    optionalInputs: ['preferredReturn', 'catchUpPercentage', 'carriedInterest', 'customTiers'],
    calculators: ['waterfall', 'lpDistribution', 'gpDistribution', 'irr', 'moic'],
  },
  {
    code: 'waterfall_fund',
    name: 'Fund Waterfall',
    description: 'Multi-asset fund distribution with capital calls',
    category: 'structured',
    ccimWorksheetType: 'CFAW',
    supportsMultiYear: true,
    supportsMortgageTracking: true,
    supportsBasisLedger: true,
    supportsTaxDeferral: false,
    supportsWaterfall: true,
    requiredInputs: ['fundSize', 'calledCapital', 'totalProceeds'],
    optionalInputs: ['managementFee', 'clawbackProvision', 'europeanWaterfall'],
    calculators: ['waterfall', 'capitalCallSchedule', 'fundMetrics', 'clawback'],
  },
  {
    code: 'hybrid_1031_dst',
    name: 'Hybrid 1031 + DST',
    description: 'Combine direct replacement property with DST allocation',
    category: 'portfolio',
    ccimWorksheetType: 'both',
    supportsMultiYear: true,
    supportsMortgageTracking: true,
    supportsBasisLedger: true,
    supportsTaxDeferral: true,
    supportsWaterfall: false,
    requiredInputs: ['relinquishedValue', 'directReplacementValue', 'dstAllocation'],
    optionalInputs: ['managementPreference', 'incomeRequirements'],
    calculators: ['1031Calculator', 'dstReturn', 'hybridAnalysis'],
  },
  {
    code: 'hybrid_cash_installment',
    name: 'Hybrid Cash + Installment',
    description: 'Partial cash at close with seller financing on balance',
    category: 'portfolio',
    ccimWorksheetType: 'ACSW',
    supportsMultiYear: true,
    supportsMortgageTracking: true,
    supportsBasisLedger: true,
    supportsTaxDeferral: true,
    supportsWaterfall: false,
    requiredInputs: ['salePrice', 'cashPortion', 'financedPortion', 'interestRate'],
    optionalInputs: ['termYears', 'taxOptimization'],
    calculators: ['basisLedger', 'taxCalculation', 'installmentSale', 'blendedProceeds'],
  },
  {
    code: 'opportunity_zone',
    name: 'Opportunity Zone Investment',
    description: 'Qualified Opportunity Fund investment for capital gain deferral',
    category: 'tax_deferred',
    ccimWorksheetType: 'ACSW',
    supportsMultiYear: true,
    supportsMortgageTracking: false,
    supportsBasisLedger: true,
    supportsTaxDeferral: true,
    supportsWaterfall: false,
    requiredInputs: ['gainAmount', 'investmentAmount', 'holdPeriodIntent'],
    optionalInputs: ['basisStepUp', 'originalGainDate'],
    calculators: ['ozDeferral', 'basisStepUp', 'permanentExclusion'],
  },
  {
    code: 'upreit',
    name: 'UPREIT Contribution',
    description: 'Contribute property to REIT operating partnership',
    category: 'tax_deferred',
    ccimWorksheetType: 'ACSW',
    supportsMultiYear: true,
    supportsMortgageTracking: false,
    supportsBasisLedger: true,
    supportsTaxDeferral: true,
    supportsWaterfall: false,
    requiredInputs: ['propertyValue', 'opUnitsReceived', 'reitDividendYield'],
    optionalInputs: ['lockupPeriod', 'conversionRatio'],
    calculators: ['upreitBasis', 'dividendProjection', 'liquidityAnalysis'],
  },
];

export function getTemplateByCode(code: string): ScenarioTemplateDefinition | undefined {
  return EXIT_SCENARIO_TEMPLATES.find(t => t.code === code);
}

export function getTemplatesByCategory(category: ExitScenarioCategory): ScenarioTemplateDefinition[] {
  return EXIT_SCENARIO_TEMPLATES.filter(t => t.category === category);
}

export function getTemplatesWithFeature(feature: keyof ScenarioTemplateDefinition): ScenarioTemplateDefinition[] {
  return EXIT_SCENARIO_TEMPLATES.filter(t => t[feature] === true);
}

export function getTaxDeferredTemplates(): ScenarioTemplateDefinition[] {
  return EXIT_SCENARIO_TEMPLATES.filter(t => t.supportsTaxDeferral);
}

export function getWaterfallTemplates(): ScenarioTemplateDefinition[] {
  return EXIT_SCENARIO_TEMPLATES.filter(t => t.supportsWaterfall);
}

export function getCCIMWorksheetTemplates(worksheetType: 'ACSW' | 'CFAW'): ScenarioTemplateDefinition[] {
  return EXIT_SCENARIO_TEMPLATES.filter(
    t => t.ccimWorksheetType === worksheetType || t.ccimWorksheetType === 'both'
  );
}

export interface ScenarioInputValidation {
  isValid: boolean;
  missingRequired: string[];
  warnings: string[];
}

export function validateScenarioInputs(
  templateCode: string,
  providedInputs: Record<string, unknown>
): ScenarioInputValidation {
  const template = getTemplateByCode(templateCode);
  
  if (!template) {
    return {
      isValid: false,
      missingRequired: [],
      warnings: [`Unknown template: ${templateCode}`],
    };
  }
  
  const missingRequired: string[] = [];
  const warnings: string[] = [];
  
  for (const required of template.requiredInputs) {
    if (!(required in providedInputs) || providedInputs[required] === null || providedInputs[required] === undefined) {
      missingRequired.push(required);
    }
  }
  
  const allKnownInputs = [...template.requiredInputs, ...template.optionalInputs];
  for (const key of Object.keys(providedInputs)) {
    if (!allKnownInputs.includes(key)) {
      warnings.push(`Unknown input field: ${key}`);
    }
  }
  
  return {
    isValid: missingRequired.length === 0,
    missingRequired,
    warnings,
  };
}

export function getCalculatorsForTemplate(templateCode: string): string[] {
  const template = getTemplateByCode(templateCode);
  return template?.calculators || [];
}

export function getScenarioCategories(): Array<{ value: ExitScenarioCategory; label: string; description: string }> {
  return [
    { value: 'direct_sale', label: 'Direct Sale', description: 'Outright sale with immediate tax recognition' },
    { value: 'tax_deferred', label: 'Tax Deferred', description: '1031 exchanges, DSTs, and other deferral strategies' },
    { value: 'installment', label: 'Installment Sale', description: 'Seller financing with deferred gain recognition' },
    { value: 'structured', label: 'Structured Exit', description: 'Waterfall distributions and syndication exits' },
    { value: 'portfolio', label: 'Portfolio/Hybrid', description: 'Combined strategies for complex exits' },
  ];
}
