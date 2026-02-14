// ============================================================
// Master Scenario Types — Top-Level Contracts
// ============================================================
import type {
  USD, Percent, Years, ISODateString, ISOTimestamp,
  AssetClass, ScenarioStatus, DealType,
  ExitStrategy, Explanation, Warning,
} from './01-enums-and-primitives';
import type {
  BasisLedgerInput, BasisLedgerOutput, AllocationLockState,
} from './02-basis-ledger';
import type {
  SaleTermsInput, SaleComputation, GainCharacterization,
  ProceedsTimeline,
} from './03-sale-and-gain';
import type {
  Exchange1031Input, Exchange1031Result,
  SellerFinancingInput, SellerFinancingResult,
  EarnoutInput, EarnoutResult,
} from './04-strategy-inputs';
import type {
  CapitalStackInput, WaterfallInput, WaterfallResult,
  TaxProfileInput, TaxSchedule,
} from './05-waterfall-tax';
import type { StrategyInteractionPolicy } from './06-strategy-interactions';

// ============================================================
// ExitScenarioInput — Everything the orchestrator needs
// ============================================================
export interface ExitScenarioInput {
  // --- Schema + Version ---
  schemaVersion: '1.0';

  // --- Scenario Metadata ---
  scenarioId?: string;
  name: string;
  assetClass: AssetClass;
  projectId?: string | null;
  assetId?: string | null;
  status: ScenarioStatus;

  // --- Deal Structure ---
  dealType: DealType;
  saleCloseDate: ISODateString;
  holdPeriodYears?: Years;
  ownershipPercent: Percent;       // default 100
  partialInterestSale: boolean;

  /** DLOM/DLOC placeholders (advisory only until fully modeled) */
  valuationAdjustments?: {
    dlocPercent?: Percent;
    dlomPercent?: Percent;
    applyTo: 'price' | 'equity';
  };

  /** Is there an operating business component? */
  operatingBusinessInvolved: boolean;

  // --- Sale Terms ---
  saleTerms: SaleTermsInput;

  // --- Allocation Wizard Payload ---
  allocation: BasisLedgerInput;
  allocationLock: AllocationLockState;

  // --- Tax Profile ---
  taxProfile: TaxProfileInput;

  // --- Strategy Modules (all optional, mix-and-match) ---
  exchange1031?: Exchange1031Input;
  sellerFinancing?: SellerFinancingInput;
  earnout?: EarnoutInput;

  // --- Waterfall & Capital Stack ---
  capitalStack?: CapitalStackInput;
  waterfall?: WaterfallInput;

  // --- Asset-Class Specialist Inputs ---
  /** Extensible: each asset class can add typed specialist fields */
  specialistInputs?: AssetClassSpecialistInputs;
}

// ============================================================
// Asset-Class Specialist Inputs (extensible union)
// ============================================================
export type AssetClassSpecialistInputs =
  | HotelSpecialistInputs
  | STRSpecialistInputs
  | MarinaSpecialistInputs
  | GolfSpecialistInputs
  | RetailMallSpecialistInputs
  | IndustrialSpecialistInputs
  | DataCenterSpecialistInputs
  | SFRDuplexSpecialistInputs
  | MultifamilyOfficeMOBSpecialistInputs;

export interface HotelSpecialistInputs {
  assetClass: 'hotel';
  adr: USD;
  occupancyRate: Percent;
  revpar: USD;
  gop: USD;
  goppar: USD;
  brandFeePercent?: Percent;
  managementFeePercent?: Percent;
  /** Hotel helper: which metric is the "NOI proxy"? */
  noiProxyMetric: 'noi' | 'gop' | 'ebitda';
}

export interface STRSpecialistInputs {
  assetClass: 'str';
  adr: USD;
  occupancyRate: Percent;
  revpar: USD;
  seasonalityToggle: boolean;
  cleaningCostPerTurn?: USD;
  turnoverRate?: number;
}

export interface MarinaSpecialistInputs {
  assetClass: 'marina';
  wetSlipRevenue: USD;
  dryStorageRevenue: USD;
  fuelRevenue: USD;
  fuelMargin: Percent;
  shipStoreRevenue?: USD;
  serviceRepairRevenue?: USD;
  transientRevenue?: USD;
}

export interface GolfSpecialistInputs {
  assetClass: 'golf';
  duesRevenue: USD;
  greenFeeRevenue: USD;
  cartFeeRevenue: USD;
  fnbRevenue: USD;
  proShopRevenue?: USD;
  eventRevenue?: USD;
  roundsPlayed?: number;
  membershipRetentionRate?: Percent;
  landAlternativeUseValue?: USD;
}

export interface RetailMallSpecialistInputs {
  assetClass: 'retail' | 'mall';
  tenantSalesPSF: USD;
  occupancyCostPercent: Percent;
  anchorTenantCount: number;
  anchorOccupancyRate: Percent;
  percentRentEnabled: boolean;
}

export interface IndustrialSpecialistInputs {
  assetClass: 'industrial';
  walt: Years;
  rentPSF: USD;
  tenantCreditRating?: string;
  outdoorStorageComponent: boolean;
  outdoorStorageRevenue?: USD;
  heavyImprovementsToggle: boolean;
}

export interface DataCenterSpecialistInputs {
  assetClass: 'data_center';
  pricingModel: 'colocation' | 'metered_power' | 'managed_services';
  totalMWCapacity: number;
  contractedKW: number;
  utilizationRate: Percent;
  powerCostPassThrough: boolean;
  powerAvailabilityRisk: 'low' | 'medium' | 'high';
}

export interface SFRDuplexSpecialistInputs {
  assetClass: 'sfr' | 'duplex';
  units: { unitId: string; monthlyRent: USD; vacancyRate: Percent }[];
  capexReservePerUnit?: USD;
}

export interface MultifamilyOfficeMOBSpecialistInputs {
  assetClass: 'multifamily' | 'office' | 'mob';
  leaseRolloverSchedule?: { year: number; sfExpiring: number; percentOfNRA: Percent }[];
  tiLcSpendPerSF?: USD;
  downtime?: number;           // months
  capRateSensitivity?: { low: Percent; base: Percent; high: Percent };
  exitMultipleSensitivity?: { low: number; base: number; high: number };
  /** MOB stability flag */
  mobStabilityFlag?: boolean;
}

// ============================================================
// ExitScenarioResult — Everything the orchestrator returns
// ============================================================
export interface ExitScenarioResult {
  // --- Engine Metadata ---
  engineVersion: string;
  inputsChecksum: string;
  computedAt: ISOTimestamp;

  // --- Pipeline Stage Results ---
  basisLedger: BasisLedgerOutput;
  saleComputation: SaleComputation;
  gainCharacterization: GainCharacterization;
  strategyInteractions: StrategyInteractionPolicy;
  proceedsTimeline: ProceedsTimeline;
  taxSchedule: TaxSchedule;

  // --- Strategy-Specific Results ---
  exchange1031Result?: Exchange1031Result;
  sellerFinancingResult?: SellerFinancingResult;
  earnoutResult?: EarnoutResult;
  waterfallResult?: WaterfallResult;

  // --- Materialized KPIs ---
  kpis: ExitScenarioKPIs;

  // --- Aggregate Outputs ---
  summary: ResultsSummary;
  warnings: Warning[];
  explanations: Explanation[];
}

// ============================================================
// ResultsSummary — The "headline numbers" panel
// ============================================================
export interface ResultsSummary {
  adjustedBasis: USD;
  amountRealized: USD;
  realizedGain: USD;
  recognizedGain: USD;
  deferredGain: USD;

  totalBoot: USD;
  bootCash: USD;
  bootMortgage: USD;
  bootNonLikeKind: USD;

  totalTax: USD;
  taxFederal: USD;
  taxState: USD;
  taxNIIT: USD;

  afterTaxCashNow: USD;
  afterTaxCashTotal: USD;
  afterTaxNPV: USD;
}

// ============================================================
// ExitScenarioKPIs — Required Read Model (CQRS-lite)
// ============================================================
export interface ExitScenarioKPIs {
  scenarioId: string;
  computedAt: ISOTimestamp;

  // --- Sale ---
  salePrice: USD;
  amountRealized: USD;
  adjustedBasis: USD;

  // --- Gain ---
  realizedGain: USD;
  recognizedGain: USD;
  deferredGain: USD;

  // --- Boot ---
  bootTotal: USD;
  bootCash: USD;
  bootMortgage: USD;
  bootNonLikeKind: USD;

  // --- Tax ---
  taxTotal: USD;
  taxFederal: USD;
  taxState: USD;
  taxNIIT: USD;

  // --- Proceeds ---
  afterTaxCashNow: USD;
  afterTaxCashTotal: USD;
  afterTaxNPV: USD;

  // --- Waterfall (nullable) ---
  lpIRR: Percent | null;
  gpIRR: Percent | null;
  lpEquityMultiple: number | null;
  gpEquityMultiple: number | null;
  promoteEarned: USD | null;

  // --- Timing ---
  weightedAverageTimingYears: number | null;

  // --- Strategies Active ---
  strategiesActive: ExitStrategy[];

  // --- Flags ---
  hasRecaptureExposure: boolean;
  hasTradeDown: boolean;
  advisorReviewRequired: boolean;
}

// ============================================================
// DB Row Types (for Drizzle schema alignment)
// ============================================================
export interface ExitScenarioRow {
  id: string;
  ownerUserId: string;
  projectId: string | null;
  assetId: string | null;
  assetClass: AssetClass;
  name: string;
  status: ScenarioStatus;
  engineVersion: string;
  inputsJson: ExitScenarioInput;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}

export interface ExitScenarioResultRow {
  scenarioId: string;
  computedAt: ISOTimestamp;
  inputsChecksum: string;
  outputsJson: ExitScenarioResult;
  engineVersion: string;
}

export interface ExitScenarioEventRow {
  id: string;
  scenarioId: string;
  eventType:
    | 'create'
    | 'update_inputs'
    | 'recompute'
    | 'export'
    | 'lock'
    | 'unlock'
    | 'compare'
    | 'allocation_recompute'
    | 'migration';
  payloadJson: Record<string, unknown>;
  createdAt: ISOTimestamp;
}

export interface ExitScenarioKPIRow extends ExitScenarioKPIs {
  // Inherits all KPI fields; stored as flat columns for indexing
}
