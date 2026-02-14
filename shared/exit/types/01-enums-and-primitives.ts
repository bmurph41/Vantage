// ============================================================
// Exit Strategy Studio — Core Enums & Primitives
// Version: 1.0.0
// ============================================================

// --- Asset Classes ---
export const ASSET_CLASSES = [
  'marina', 'golf', 'multifamily', 'retail', 'office', 'mob',
  'str', 'hotel', 'sfr', 'duplex', 'mall', 'industrial',
  'data_center', 'business',
] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

// --- Scenario Lifecycle ---
export type ScenarioStatus = 'draft' | 'final' | 'locked';

// --- Deal Structure ---
export type DealType = 'asset_sale' | 'entity_sale';
export type AllocationMethod = 'percent' | 'dollars' | 'asset_class_defaults';

// --- Depreciation Character ---
export type DepreciationCharacter = '1245' | '1250';
export type GainCharacterType = 'ordinary_1245' | 'unrecaptured_1250' | 'ltcg';

// --- Strategy Identifiers ---
export type ExitStrategy = 'cash_sale' | 'exchange_1031' | 'seller_financing' | 'earnout';

// --- Tax Profile ---
export type FilingStatus = 'single' | 'mfj' | 'mfs' | 'hoh' | 'qss';

// --- Earnout Metric Types (asset-class aware) ---
export const EARNOUT_METRICS = [
  // Universal
  'gross_revenue', 'gross_profit', 'ebitda', 'noi',
  // Hotel / STR
  'revpar', 'adr', 'occupancy', 'gop', 'goppar',
  // Retail / Mall
  'sales_psf',
  // Data Center
  'power_mw', 'leased_kw',
  // Marina
  'fuel_margin', 'storage_utilization',
  // Golf
  'rounds_played', 'membership_retention',
] as const;
export type EarnoutMetric = (typeof EARNOUT_METRICS)[number];

export type EarnoutPayoutType = 'fixed_dollars' | 'percent_of_metric' | 'percent_of_excess_over_threshold';
export type EarnoutPaymentTiming = 'annual' | 'end_of_period' | 'quarterly';
export type EarnoutTaxTreatment = 'purchase_price' | 'compensation' | 'mixed';

// --- Earnout in Exchange Policy (1031 interaction) ---
export type EarnoutInExchangePolicy =
  | 'treat_as_boot_when_received'
  | 'exclude_from_1031_model'
  | 'model_as_contingent_purchase_price';

// --- Waterfall ---
export type WaterfallStructure = 'deal_by_deal' | 'whole_fund';
export type HurdleType = 'irr' | 'equity_multiple';
export type PaymentFrequency = 'monthly' | 'quarterly' | 'semi_annual' | 'annual';

// --- Capital Stack ---
export type CapitalStackMode = 'linked' | 'override';

// --- Allocation Lock ---
export type AllocationLockPolicy = 'soft' | 'hard';

// --- Engine Versioning ---
export interface EngineVersion {
  major: number;
  minor: number;
  patch: number;
  toString(): string;
}

// --- Currency / Numeric Helpers ---
/** All monetary values stored as cents (integer) or as number with 2-decimal precision */
export type USD = number;
export type Percent = number; // 0–100 scale (e.g., 5.25 = 5.25%)
export type BasisPoints = number;
export type Years = number;

// --- Temporal ---
export type ISODateString = string; // YYYY-MM-DD
export type ISOTimestamp = string;  // full ISO 8601

// --- Explanation Objects ---
export interface Explanation {
  field: string;
  label: string;
  plainEnglish: string;
  formula?: string;
  citations?: string[]; // e.g., "IRC § 453(i)", "Form 8824 Line 18"
}

// --- Warning System ---
export type WarningSeverity = 'info' | 'caution' | 'warning' | 'critical';
export interface Warning {
  code: string;
  severity: WarningSeverity;
  title: string;
  message: string;
  relatedFields?: string[];
  actionRequired?: boolean;
}
