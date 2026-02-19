export interface CashflowPeriod {
  periodIndex: number;
  periodStart: Date;
  periodEnd: Date;
  noiCents: bigint;
  interestCents: bigint;
  debtServiceCents: bigint;
  capexCents: bigint;
  reservesCents: bigint;
  cashAvailableCents: bigint;
  saleEvent?: SaleEvent;
  warnings: string[];
}

export interface SaleEvent {
  netSaleProceedsCents: bigint;
  saleCostsCents: bigint;
}

export interface PartnerInfo {
  partnerId: string;
  name: string;
  role: 'lp' | 'gp' | 'co_gp' | 'mezz' | 'other';
  ownershipPercent: number;
  taxProfile: TaxProfileInfo | null;
  equityContributedCents: bigint;
}

export interface TaxProfileInfo {
  id: string;
  filingType: string;
  effectiveTaxRate: number | null;
  ordinaryRate: number | null;
  ltcgRate: number | null;
  recaptureRate: number | null;
  niitRate: number | null;
  stateRate: number | null;
  localRate: number | null;
}

export interface TaxInputs {
  annualDepreciationCents: bigint;
  depreciationMethod: string;
  amortizationAnnualCents: bigint;
  interestDeductible: boolean;
  saleCostBasisCents: bigint;
  accumulatedDepreciationCents: bigint;
}

export type TaxMode = 'flat' | 'split' | 'advanced';
export type TaxTiming = 'monthly' | 'quarterly' | 'annual';
export type TaxInteractionMode = 'waterfall_pre_tax' | 'waterfall_after_tax' | 'tax_distribution_layer';

export interface TaxSettings {
  enabled: boolean;
  taxMode: TaxMode;
  taxTiming: TaxTiming;
  taxInteractionMode: TaxInteractionMode;
  defaultTaxProfileId: string | null;
}

export interface TaxBuckets {
  ordinaryCents: bigint;
  capGainCents: bigint;
  recaptureCents: bigint;
  lossCents: bigint;
}

export interface PartnerTaxResult {
  partnerId: string;
  taxDueCents: bigint;
  ordinaryTaxCents: bigint;
  capGainTaxCents: bigint;
  recaptureTaxCents: bigint;
  allocatedBuckets: TaxBuckets;
}

export interface TaxEngineResult {
  totalTaxBuckets: TaxBuckets;
  partnerTaxes: PartnerTaxResult[];
  warnings: string[];
}

export type WaterfallTierType = 'return_of_capital' | 'preferred_return' | 'catch_up' | 'split' | 'tax_distribution';

export interface WaterfallTierConfig {
  tierOrder: number;
  tierType: WaterfallTierType;
  prefRate: number | null;
  catchUpTargetGpShare: number | null;
  irrHurdle: number | null;
  equityMultipleHurdle: number | null;
  lpSplit: number | null;
  gpSplit: number | null;
  notes: string | null;
}

export interface TierAllocation {
  partnerId: string;
  amountCents: bigint;
}

export interface WaterfallTierResult {
  tierOrder: number;
  tierType: WaterfallTierType;
  allocations: TierAllocation[];
}

export interface WaterfallState {
  unreturnedCapitalByPartner: Map<string, bigint>;
  accruedPrefByPartner: Map<string, bigint>;
  cumulativeDistributionsByPartner: Map<string, bigint>;
  cumulativeProfitByPartner: Map<string, bigint>;
}

export interface WaterfallEngineResult {
  distributionsByPartner: Map<string, bigint>;
  tierBreakdown: WaterfallTierResult[];
  remainingCashCents: bigint;
  warnings: string[];
}

export interface PeriodResult {
  periodIndex: number;
  periodStart: string;
  periodEnd: string;
  cashAvailableCents: string;
  taxableBucketsCents: {
    ordinary: string;
    capGain: string;
    recapture: string;
  };
  taxesByPartner: Array<{
    partnerId: string;
    taxDueCents: string;
    ordinaryTaxCents: string;
    capGainTaxCents: string;
    recaptureTaxCents: string;
  }>;
  distributionsPreTaxByPartner: Array<{
    partnerId: string;
    amountCents: string;
  }>;
  distributionsAfterTaxByPartner: Array<{
    partnerId: string;
    amountCents: string;
  }>;
  waterfallBreakdown: Array<{
    tierOrder: number;
    tierType: string;
    allocations: Array<{
      partnerId: string;
      amountCents: string;
    }>;
  }>;
  warnings: string[];
}

export interface PartnerMetric {
  partnerId: string;
  value: number | null;
}

export interface CalculateResult {
  ok: true;
  periodResults: PeriodResult[];
  summary: {
    preTaxIRRByPartner: PartnerMetric[];
    afterTaxIRRByPartner: PartnerMetric[];
    preTaxMOICByPartner: PartnerMetric[];
    afterTaxMOICByPartner: PartnerMetric[];
    taxDragByPartner: PartnerMetric[];
  };
}
