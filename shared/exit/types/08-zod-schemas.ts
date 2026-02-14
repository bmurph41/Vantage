// ============================================================
// Zod Schemas — Runtime Validation + Normalization
// Version: 1.0.0
// ============================================================
import { z } from 'zod';

// --- Shared Primitives ---
const usd = z.number().finite();
const percent = z.number().min(0).max(100);
const years = z.number().min(0).max(100);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoTimestamp = z.string().datetime();

// --- Enums ---
export const AssetClassSchema = z.enum([
  'marina', 'golf', 'multifamily', 'retail', 'office', 'mob',
  'str', 'hotel', 'sfr', 'duplex', 'mall', 'industrial',
  'data_center', 'business',
]);

export const ScenarioStatusSchema = z.enum(['draft', 'final', 'locked']);
export const DealTypeSchema = z.enum(['asset_sale', 'entity_sale']);
export const AllocationMethodSchema = z.enum(['percent', 'dollars', 'asset_class_defaults']);
export const FilingStatusSchema = z.enum(['single', 'mfj', 'mfs', 'hoh', 'qss']);
export const PaymentFrequencySchema = z.enum(['monthly', 'quarterly', 'semi_annual', 'annual']);
export const ExitStrategySchema = z.enum(['cash_sale', 'exchange_1031', 'seller_financing', 'earnout']);
export const HurdleTypeSchema = z.enum(['irr', 'equity_multiple']);
export const CapitalStackModeSchema = z.enum(['linked', 'override']);

export const EarnoutMetricSchema = z.enum([
  'gross_revenue', 'gross_profit', 'ebitda', 'noi',
  'revpar', 'adr', 'occupancy', 'gop', 'goppar',
  'sales_psf', 'power_mw', 'leased_kw',
  'fuel_margin', 'storage_utilization',
  'rounds_played', 'membership_retention',
]);
export const EarnoutPayoutTypeSchema = z.enum([
  'fixed_dollars', 'percent_of_metric', 'percent_of_excess_over_threshold',
]);
export const EarnoutTaxTreatmentSchema = z.enum(['purchase_price', 'compensation', 'mixed']);
export const EarnoutInExchangePolicySchema = z.enum([
  'treat_as_boot_when_received', 'exclude_from_1031_model', 'model_as_contingent_purchase_price',
]);

// --- Allocation Bucket ---
const AllocationBucketKeySchema = z.enum([
  'land', 'building', 'site_improvements', 'ffe', 'intangibles', 'goodwill',
]);

const AllocationBucketSchema = z.object({
  key: AllocationBucketKeySchema,
  label: z.string(),
  allocatedAmount: usd,
  allocatedPercent: percent,
  depreciationCharacter: z.enum(['1245', '1250', 'non_depreciable']),
  usefulLifeYears: years.nullable(),
  accumulatedDepreciation: usd,
  costSegGroup: z.string().optional(),
  bonusDepreciationTaken: usd.optional(),
  section179Taken: usd.optional(),
});

const CapexEntrySchema = z.object({
  date: isoDate,
  amount: usd,
  bucket: AllocationBucketKeySchema,
  description: z.string().optional(),
  treatment: z.enum(['capitalized', 'expensed']),
});

// ============================================================
// BasisLedgerInput Schema
// ============================================================
export const BasisLedgerInputSchema = z.object({
  schemaVersion: z.literal('1.0'),
  purchasePrice: usd.positive(),
  allocationMethod: AllocationMethodSchema,
  assetClass: AssetClassSchema,
  buckets: z.array(AllocationBucketSchema).min(1),
  capexSchedule: z.array(CapexEntrySchema),
  costSegGroups: z.array(z.object({
    groupName: z.string(),
    originalAmount: usd,
    depreciationLife: years,
    method: z.enum(['straight_line', 'macrs_gds', 'macrs_ads']),
    accumulatedDepreciation: usd,
    bonusEligible: z.boolean(),
    bonusTaken: usd,
  })).optional(),
  bonusDepreciationEnabled: z.boolean().optional(),
  section179Enabled: z.boolean().optional(),
  acquisitionDate: isoDate,
  dispositionDate: isoDate,
}).refine(
  (data) => {
    const total = data.buckets.reduce((sum, b) => sum + b.allocatedAmount, 0);
    return Math.abs(total - data.purchasePrice) < 0.01;
  },
  { message: 'Allocation bucket amounts must sum to purchase price' }
);

// ============================================================
// Sale Terms Schema
// ============================================================
const SellingExpenseSchema = z.object({
  category: z.enum([
    'broker_commission', 'legal', 'transfer_tax', 'title_insurance',
    'due_diligence_reimbursement', 'marketing', 'other',
  ]),
  label: z.string(),
  amount: usd.nullable(),
  percentOfSale: percent.nullable(),
  computedAmount: usd,
});

export const SaleTermsInputSchema = z.object({
  salePrice: usd.positive(),
  sellingExpenses: z.array(SellingExpenseSchema),
  closingCosts: z.array(SellingExpenseSchema),
  creditsToBuyer: usd.default(0),
  prorationsNetToSeller: usd.default(0),
  escrowsReleased: usd.default(0),
  debtPayoff: usd.default(0),
  prepaymentPenalty: usd.default(0),
  defeasanceCost: usd.default(0),
  workingCapitalAdjustment: usd.optional(),
  inventoryIncluded: z.boolean().optional(),
  inventoryValue: usd.optional(),
});

// ============================================================
// Tax Profile Schema
// ============================================================
export const TaxProfileInputSchema = z.object({
  filingStatus: FilingStatusSchema,
  stateCode: z.string().length(2),
  niitEnabled: z.boolean(),
  otherOrdinaryIncome: usd.optional(),
  otherCapitalGains: usd.optional(),
  suspendedPassiveLosses: usd.optional(),
  passiveLossEnabled: z.boolean().optional(),
  stateCapitalGainsRate: percent.optional(),
  stateSurchargeRate: percent.optional(),
});

// ============================================================
// 1031 Exchange Schema
// ============================================================
export const Exchange1031InputSchema = z.object({
  enabled: z.boolean(),
  replacementProperties: z.array(z.object({
    id: z.string(),
    name: z.string().optional(),
    purchasePrice: usd.positive(),
    closingDate: isoDate.optional(),
    replacementDebtPlaced: usd,
    closingCosts: usd,
    capitalizedCostPolicy: z.enum(['capitalize', 'expense']),
  })).min(1),
  qi: z.object({
    qiFee: usd,
    cashHeldByQI: z.boolean(),
    sellerNoteAssignedToQI: z.boolean(),
  }),
  boot: z.object({
    cashKeptOut: usd.default(0),
    additionalCashIn: usd.default(0),
    nonLikeKindPropertyRetainedValue: usd.default(0),
  }),
  identificationDeadline: isoDate.optional(),
  exchangeDeadline: isoDate.optional(),
});

// ============================================================
// Seller Financing Schema
// ============================================================
export const SellerFinancingInputSchema = z.object({
  enabled: z.boolean(),
  downPayment: usd,
  downPaymentPercent: percent.optional(),
  noteAmount: usd.optional(),
  interestRate: percent.positive(),
  termYears: years.positive(),
  amortizationYears: years.positive(),
  paymentFrequency: PaymentFrequencySchema,
  interestOnlyYears: years.optional(),
  hasBalloon: z.boolean(),
  balloonAtYear: years.optional(),
  originationFee: usd.optional(),
  prepaymentPenalty: percent.optional(),
  defaultProbability: percent.optional(),
  recoveryRate: percent.optional(),
  noteReceivedAtClose: z.boolean(),
  assignedToQI: z.boolean(),
}).refine(
  (data) => !data.hasBalloon || data.balloonAtYear !== undefined,
  { message: 'balloonAtYear required when hasBalloon is true' }
);

// ============================================================
// Earnout Schema
// ============================================================
const EarnoutServiceConditionsSchema = z.object({
  requiresEmployment: z.boolean(),
  requiresConsulting: z.boolean(),
  nonCompeteLinked: z.boolean(),
  covenantLinked: z.boolean(),
});

const EarnoutDefinitionsTier1Schema = z.object({
  definitionText: z.string().optional(),
  inclusions: z.array(z.string()),
  exclusions: z.array(z.string()),
  ebitdaAddbacks: z.array(z.string()).optional(),
  addbacksCap: usd.optional(),
  workingCapitalNormalization: z.enum(['target_peg', 'dollar_for_dollar', 'none']).optional(),
  extraordinaryItemsTreatment: z.enum(['exclude', 'include', 'normalize']).optional(),
  revenueRecognitionPolicy: z.string().optional(),
  managementFeeTreatment: z.enum(['above_line', 'below_line', 'excluded']).optional(),
  repairsCapexPolicy: z.string().optional(),
});

const EarnoutDefinitionsTier2Schema = z.object({
  auditRightsEnabled: z.boolean().optional(),
  reportingCadence: z.enum(['monthly', 'quarterly', 'annual']).optional(),
  accountingPolicyLockEnabled: z.boolean().optional(),
  disputeResolutionMethod: z.enum(['arbitration', 'litigation', 'independent_accountant']).optional(),
  independentAccountantSelection: z.string().optional(),
  buyerControlAdjustmentFlag: z.boolean().optional(),
  completionScore: percent.optional(),
});

const EarnoutScenarioCaseSchema = z.object({
  label: z.enum(['low', 'base', 'high', 'custom']),
  metricValue: usd,
  probability: percent,
  computedPayout: usd.optional(),
});

const EarnoutTrancheSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  order: z.number().int().min(0),
  metricType: EarnoutMetricSchema,
  payoutType: EarnoutPayoutTypeSchema,
  threshold: usd.optional(),
  payoutPercent: percent.optional(),
  payoutFixedAmount: usd.optional(),
  capAmount: usd.optional(),
  floorAmount: usd.optional(),
  measurementPeriodStart: isoDate,
  measurementPeriodEnd: isoDate,
  paymentTiming: z.enum(['annual', 'end_of_period', 'quarterly']),
  scenarios: z.array(EarnoutScenarioCaseSchema).min(1),
  taxTreatment: EarnoutTaxTreatmentSchema,
  serviceConditions: EarnoutServiceConditionsSchema,
  definitions: EarnoutDefinitionsTier1Schema,
  dealHygiene: EarnoutDefinitionsTier2Schema,
}).refine(
  (data) => {
    const totalProb = data.scenarios.reduce((sum, s) => sum + s.probability, 0);
    return Math.abs(totalProb - 100) < 0.01;
  },
  { message: 'Scenario probabilities must sum to 100%' }
);

export const EarnoutInputSchema = z.object({
  enabled: z.boolean(),
  tranches: z.array(EarnoutTrancheSchema).min(1),
  discountRate: percent,
  exchangePolicy: EarnoutInExchangePolicySchema.optional(),
});

// ============================================================
// Waterfall Schema
// ============================================================
const WaterfallTierSchema = z.object({
  id: z.string(),
  name: z.string(),
  order: z.number().int().min(0),
  hurdleType: HurdleTypeSchema,
  hurdleValue: z.number().positive(),
  lpSplitPercent: percent,
  gpSplitPercent: percent,
  catchUpPercent: percent.optional(),
}).refine(
  (data) => Math.abs(data.lpSplitPercent + data.gpSplitPercent - 100) < 0.01,
  { message: 'LP + GP split must equal 100%' }
);

const CapitalEventSchema = z.object({
  id: z.string(),
  date: isoDate,
  amount: usd.positive(),
  description: z.string().optional(),
});

export const WaterfallInputSchema = z.object({
  enabled: z.boolean(),
  structureType: z.enum(['deal_by_deal', 'whole_fund']),
  preferredReturnRate: percent,
  preferredReturnCompounding: z.enum(['simple', 'compound']),
  gpCommitPercent: percent,
  catchUpEnabled: z.boolean(),
  catchUpPercent: percent.optional(),
  clawbackEnabled: z.boolean(),
  tiers: z.array(WaterfallTierSchema).min(1),
  capitalCalls: z.array(CapitalEventSchema),
  distributions: z.array(CapitalEventSchema),
});

// ============================================================
// Capital Stack Schema
// ============================================================
export const CapitalStackInputSchema = z.object({
  mode: CapitalStackModeSchema,
  overrideSnapshot: z.object({
    debtTranches: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum(['senior', 'mezzanine', 'preferred_equity', 'seller_note']),
      principal: usd,
      interestRate: percent,
      termYears: years,
      ioCovenant: z.boolean().optional(),
      retiredAtSale: z.boolean(),
    })),
    equityLayers: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum(['lp_common', 'lp_preferred', 'gp_coinvest', 'promote']),
      commitAmount: usd,
      ownershipPercent: percent,
    })),
    fees: z.array(z.object({
      type: z.enum(['acquisition', 'asset_management', 'disposition', 'promote_true_up']),
      amount: usd,
      percentBasis: z.enum(['purchase_price', 'equity', 'gross_revenue', 'distributable_cash']).optional(),
      percentRate: percent.optional(),
      recipient: z.enum(['gp', 'manager', 'other']),
    })).optional(),
  }),
  linkedProjectId: z.string().optional(),
});

// ============================================================
// Allocation Lock State Schema
// ============================================================
export const AllocationLockStateSchema = z.object({
  lockedAt: isoDate.nullable(),
  lockPolicy: z.enum(['soft', 'hard']),
  dependencyFingerprint: z.string(),
  isStale: z.boolean(),
  staleReasons: z.array(z.string()).optional(),
});

// ============================================================
// MASTER: ExitScenarioInput Schema
// ============================================================
export const ExitScenarioInputSchema = z.object({
  schemaVersion: z.literal('1.0'),

  // Metadata
  scenarioId: z.string().optional(),
  name: z.string().min(1).max(200),
  assetClass: AssetClassSchema,
  projectId: z.string().nullable().optional(),
  assetId: z.string().nullable().optional(),
  status: ScenarioStatusSchema,

  // Deal Structure
  dealType: DealTypeSchema,
  saleCloseDate: isoDate,
  holdPeriodYears: years.optional(),
  ownershipPercent: percent.default(100),
  partialInterestSale: z.boolean().default(false),
  valuationAdjustments: z.object({
    dlocPercent: percent.optional(),
    dlomPercent: percent.optional(),
    applyTo: z.enum(['price', 'equity']),
  }).optional(),
  operatingBusinessInvolved: z.boolean().default(false),

  // Core Inputs
  saleTerms: SaleTermsInputSchema,
  allocation: BasisLedgerInputSchema,
  allocationLock: AllocationLockStateSchema,
  taxProfile: TaxProfileInputSchema,

  // Strategy Modules
  exchange1031: Exchange1031InputSchema.optional(),
  sellerFinancing: SellerFinancingInputSchema.optional(),
  earnout: EarnoutInputSchema.optional(),

  // Capital Stack & Waterfall
  capitalStack: CapitalStackInputSchema.optional(),
  waterfall: WaterfallInputSchema.optional(),

  // Specialist inputs (validated separately per asset class)
  specialistInputs: z.any().optional(),
});

// ============================================================
// Normalizer — Apply defaults before orchestration
// ============================================================
export function normalizeExitScenarioInput(
  raw: unknown
): z.infer<typeof ExitScenarioInputSchema> {
  return ExitScenarioInputSchema.parse(raw);
}
