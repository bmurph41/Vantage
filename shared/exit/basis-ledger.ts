export interface BasisLedgerInput {
  originalPurchasePrice: number;
  acquisitionCosts: number;
  landValueAtAcquisition: number;
  improvementValueAtAcquisition: number;
  personalPropertyValue?: number;
  depreciationScheduleYears: number; // 39 for commercial, 27.5 for residential
  holdingPeriodYears: number;
  capitalAdditionsByYear?: Record<number, number>;
  hasCostSegregation?: boolean;
  costSegregationBonus?: number;
  costSegregationYear?: number;
  prior1031DeferredGain?: number;
  prior1031CarryoverBasis?: number;
  suspendedPassiveLossesByYear?: Record<number, number>;
  partialSalesProceeds?: number;
}

export interface BasisCalculationResult {
  initialBasis: number;
  improvementBasis: number;
  annualDepreciation: number;
  costRecoveryByYear: Record<number, number>;
  accumulatedCostRecovery: number;
  capitalAdditions: number;
  totalBasisBeforeAdjustments: number;
  adjustedBasis: number;
  straightLineRecapture: number; // Amount subject to 25% rate
  section1245Recapture: number; // Personal property subject to ordinary rates
  suspendedLossesTotal: number;
  partialSalesAdjustment: number;
  basisBreakdown: BasisBreakdownItem[];
}

export interface BasisBreakdownItem {
  description: string;
  amount: number;
  isAddition: boolean;
  year?: number;
  category: 'acquisition' | 'improvement' | 'depreciation' | 'partial_sale' | '1031_carryover' | 'cost_seg';
}

export function calculateBasisLedger(input: BasisLedgerInput): BasisCalculationResult {
  const basisBreakdown: BasisBreakdownItem[] = [];
  
  const initialBasis = input.originalPurchasePrice + input.acquisitionCosts;
  basisBreakdown.push({
    description: 'Original Purchase Price',
    amount: input.originalPurchasePrice,
    isAddition: true,
    category: 'acquisition'
  });
  
  if (input.acquisitionCosts > 0) {
    basisBreakdown.push({
      description: 'Acquisition Costs',
      amount: input.acquisitionCosts,
      isAddition: true,
      category: 'acquisition'
    });
  }
  
  let improvementBasis = input.improvementValueAtAcquisition;
  const personalPropertyValue = input.personalPropertyValue || 0;
  
  // Guard: depreciationScheduleYears=0 would cause Infinity
  let improvementAnnualDepreciation = 0;
  if (input.depreciationScheduleYears > 0) {
    improvementAnnualDepreciation = improvementBasis / input.depreciationScheduleYears;
  } else if (improvementBasis > 0) {
    basisBreakdown.push({
      description: 'WARNING: Depreciation schedule years is 0 — no depreciation computed',
      amount: 0,
      isAddition: false,
      category: 'depreciation'
    });
  }
  const personalPropertyDepreciation = personalPropertyValue > 0 ? personalPropertyValue / 5 : 0;
  const annualDepreciation = improvementAnnualDepreciation + personalPropertyDepreciation;
  
  const costRecoveryByYear: Record<number, number> = {};
  let accumulatedCostRecovery = 0;
  let accumulatedPersonalPropertyDepreciation = 0;
  
  for (let year = 1; year <= input.holdingPeriodYears; year++) {
    let yearlyDepreciation = improvementAnnualDepreciation;
    
    if (year <= 5 && personalPropertyValue > 0) {
      yearlyDepreciation += personalPropertyDepreciation;
      accumulatedPersonalPropertyDepreciation += personalPropertyDepreciation;
    }
    
    if (input.hasCostSegregation && 
        input.costSegregationYear && 
        year === input.costSegregationYear && 
        input.costSegregationBonus) {
      yearlyDepreciation += input.costSegregationBonus;
      basisBreakdown.push({
        description: `Cost Segregation Bonus (Year ${year})`,
        amount: input.costSegregationBonus,
        isAddition: false,
        year,
        category: 'cost_seg'
      });
    }
    
    costRecoveryByYear[year] = yearlyDepreciation;
    accumulatedCostRecovery += yearlyDepreciation;
    
    basisBreakdown.push({
      description: `Depreciation Year ${year}`,
      amount: yearlyDepreciation,
      isAddition: false,
      year,
      category: 'depreciation'
    });
  }
  
  let capitalAdditions = 0;
  if (input.capitalAdditionsByYear) {
    for (const [year, amount] of Object.entries(input.capitalAdditionsByYear)) {
      capitalAdditions += amount;
      improvementBasis += amount;
      
      basisBreakdown.push({
        description: `Capital Improvement (Year ${year})`,
        amount,
        isAddition: true,
        year: parseInt(year),
        category: 'improvement'
      });
      
      const remainingYears = input.depreciationScheduleYears - (parseInt(year) - 1);
      if (remainingYears > 0) {
        const additionDepreciation = amount / remainingYears;
        for (let y = parseInt(year); y <= input.holdingPeriodYears; y++) {
          costRecoveryByYear[y] = (costRecoveryByYear[y] || 0) + additionDepreciation;
          accumulatedCostRecovery += additionDepreciation;
        }
      }
    }
  }
  
  let partialSalesAdjustment = 0;
  if (input.partialSalesProceeds && input.partialSalesProceeds > 0) {
    partialSalesAdjustment = input.partialSalesProceeds * 0.8;
    basisBreakdown.push({
      description: 'Partial Sale Basis Reduction',
      amount: partialSalesAdjustment,
      isAddition: false,
      category: 'partial_sale'
    });
  }
  
  let totalBasisBeforeAdjustments = initialBasis + capitalAdditions;
  
  if (input.prior1031CarryoverBasis) {
    const carryoverAdjustment = initialBasis - input.prior1031CarryoverBasis;
    if (carryoverAdjustment > 0) {
      totalBasisBeforeAdjustments -= carryoverAdjustment;
      basisBreakdown.push({
        description: 'Prior 1031 Exchange Basis Adjustment',
        amount: carryoverAdjustment,
        isAddition: false,
        category: '1031_carryover'
      });
    }
  }
  
  const adjustedBasis = totalBasisBeforeAdjustments - accumulatedCostRecovery - partialSalesAdjustment;
  
  const straightLineRecapture = accumulatedCostRecovery - accumulatedPersonalPropertyDepreciation;
  const section1245Recapture = Math.min(accumulatedPersonalPropertyDepreciation, personalPropertyValue);
  
  let suspendedLossesTotal = 0;
  if (input.suspendedPassiveLossesByYear) {
    for (const [_, loss] of Object.entries(input.suspendedPassiveLossesByYear)) {
      suspendedLossesTotal += loss;
    }
  }
  
  return {
    initialBasis,
    improvementBasis,
    annualDepreciation,
    costRecoveryByYear,
    accumulatedCostRecovery,
    capitalAdditions,
    totalBasisBeforeAdjustments,
    adjustedBasis,
    straightLineRecapture,
    section1245Recapture,
    suspendedLossesTotal,
    partialSalesAdjustment,
    basisBreakdown,
  };
}

export interface CapitalGainBreakdown {
  grossSalePrice: number;
  costsOfSale: number;
  netSalePrice: number;
  adjustedBasis: number;
  totalGain: number;
  
  longTermCapitalGain: number;
  shortTermCapitalGain: number;
  unrecapturedSection1250: number; // 25% rate
  section1245Recapture: number; // Ordinary income
  
  suspendedLossesUtilized: number;
  netGainAfterSuspendedLosses: number;
  
  participationPayments: number;
  totalTaxableAmount: number;
}

export interface CapitalGainInput {
  grossSalePrice: number;
  costsOfSale: number;
  basisResult: BasisCalculationResult;
  holdingPeriodMonths: number;
  participationPayments?: number;
}

export function calculateCapitalGainBreakdown(input: CapitalGainInput): CapitalGainBreakdown {
  const netSalePrice = input.grossSalePrice - input.costsOfSale;
  const totalGain = netSalePrice - input.basisResult.adjustedBasis;
  
  const isLongTerm = input.holdingPeriodMonths >= 12;
  
  let longTermCapitalGain = 0;
  let shortTermCapitalGain = 0;
  
  const unrecapturedSection1250 = Math.min(
    input.basisResult.straightLineRecapture,
    Math.max(0, totalGain)
  );
  
  const section1245Recapture = Math.min(
    input.basisResult.section1245Recapture,
    Math.max(0, totalGain - unrecapturedSection1250)
  );
  
  const remainingGain = totalGain - unrecapturedSection1250 - section1245Recapture;
  
  if (isLongTerm) {
    longTermCapitalGain = Math.max(0, remainingGain);
    shortTermCapitalGain = 0;
  } else {
    shortTermCapitalGain = Math.max(0, remainingGain);
    longTermCapitalGain = 0;
  }
  
  const suspendedLossesUtilized = Math.min(
    input.basisResult.suspendedLossesTotal,
    Math.max(0, totalGain)
  );
  
  const netGainAfterSuspendedLosses = totalGain - suspendedLossesUtilized;
  
  const participationPayments = input.participationPayments || 0;
  const totalTaxableAmount = netGainAfterSuspendedLosses + participationPayments;
  
  return {
    grossSalePrice: input.grossSalePrice,
    costsOfSale: input.costsOfSale,
    netSalePrice,
    adjustedBasis: input.basisResult.adjustedBasis,
    totalGain,
    longTermCapitalGain,
    shortTermCapitalGain,
    unrecapturedSection1250,
    section1245Recapture,
    suspendedLossesUtilized,
    netGainAfterSuspendedLosses,
    participationPayments,
    totalTaxableAmount,
  };
}

export interface CCIMACSWResult {
  line1_acquisitionCost: number;
  line2_acquisitionFees: number;
  line3_totalAcquisitionCost: number;
  line4_capitalAdditions: number;
  line5_costRecoveryTaken: number;
  line6_straightLineRecapture: number;
  line7_partialSales: number;
  line8_adjustedBasis: number;
  
  line9_salePrice: number;
  line10_costsOfSale: number;
  line11_netSalePrice: number;
  line12_participationPayments: number;
  line13_totalAmountRealized: number;
  
  line14_suspendedLosses: number;
  line15_netCapitalGain: number;
  
  line16_section1250Recapture: number;
  line17_section1245Recapture: number;
  line18_longTermCapitalGain: number;
  
  line19_section1250Tax: number;
  line20_section1245Tax: number;
  line21_federalCapitalGainsTax: number;
  line22_niitTax: number;
  line23_stateTax: number;
  line24_totalTaxLiability: number;
  
  line25_afterTaxProceeds: number;
}

export interface CCIMACSWInput {
  basisInput: BasisLedgerInput;
  grossSalePrice: number;
  costsOfSale: number;
  participationPayments?: number;
  
  federalLongTermRate: number; // e.g., 0.20
  niitRate: number; // 0.038
  stateTaxRate: number;
  
  applyNiit: boolean;
  holdingPeriodMonths: number;
}

export function generateCCIMACSW(input: CCIMACSWInput): CCIMACSWResult {
  const basisResult = calculateBasisLedger(input.basisInput);
  
  const line1 = input.basisInput.originalPurchasePrice;
  const line2 = input.basisInput.acquisitionCosts;
  const line3 = line1 + line2;
  const line4 = basisResult.capitalAdditions;
  const line5 = basisResult.accumulatedCostRecovery;
  const line6 = basisResult.straightLineRecapture;
  const line7 = basisResult.partialSalesAdjustment;
  const line8 = basisResult.adjustedBasis;
  
  const line9 = input.grossSalePrice;
  const line10 = input.costsOfSale;
  const line11 = line9 - line10;
  const line12 = input.participationPayments || 0;
  const line13 = line11 + line12;
  
  const gainInput: CapitalGainInput = {
    grossSalePrice: input.grossSalePrice,
    costsOfSale: input.costsOfSale,
    basisResult,
    holdingPeriodMonths: input.holdingPeriodMonths,
    participationPayments: input.participationPayments,
  };
  
  const gainBreakdown = calculateCapitalGainBreakdown(gainInput);
  
  const line14 = gainBreakdown.suspendedLossesUtilized;
  const line15 = gainBreakdown.netGainAfterSuspendedLosses;
  
  const line16 = gainBreakdown.unrecapturedSection1250;
  const line17 = gainBreakdown.section1245Recapture;
  const line18 = gainBreakdown.longTermCapitalGain;
  
  const line19 = line16 * 0.25; // 25% rate for section 1250
  const line20 = line17 * 0.37; // Ordinary income rate for section 1245
  const line21 = line18 * input.federalLongTermRate;
  const line22 = input.applyNiit ? (line15 > 0 ? line15 * input.niitRate : 0) : 0;
  const line23 = gainBreakdown.totalGain * input.stateTaxRate;
  const line24 = line19 + line20 + line21 + line22 + line23;
  
  const line25 = line11 - line24;
  
  return {
    line1_acquisitionCost: line1,
    line2_acquisitionFees: line2,
    line3_totalAcquisitionCost: line3,
    line4_capitalAdditions: line4,
    line5_costRecoveryTaken: line5,
    line6_straightLineRecapture: line6,
    line7_partialSales: line7,
    line8_adjustedBasis: line8,
    
    line9_salePrice: line9,
    line10_costsOfSale: line10,
    line11_netSalePrice: line11,
    line12_participationPayments: line12,
    line13_totalAmountRealized: line13,
    
    line14_suspendedLosses: line14,
    line15_netCapitalGain: line15,
    
    line16_section1250Recapture: line16,
    line17_section1245Recapture: line17,
    line18_longTermCapitalGain: line18,
    
    line19_section1250Tax: line19,
    line20_section1245Tax: line20,
    line21_federalCapitalGainsTax: line21,
    line22_niitTax: line22,
    line23_stateTax: line23,
    line24_totalTaxLiability: line24,
    
    line25_afterTaxProceeds: line25,
  };
}

export function projectBasisAtYear(
  input: BasisLedgerInput,
  targetYear: number
): { adjustedBasis: number; accumulatedDepreciation: number } {
  const modifiedInput = { ...input, holdingPeriodYears: targetYear };
  const result = calculateBasisLedger(modifiedInput);
  
  return {
    adjustedBasis: result.adjustedBasis,
    accumulatedDepreciation: result.accumulatedCostRecovery,
  };
}
