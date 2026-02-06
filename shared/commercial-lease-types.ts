/**
 * Commercial Lease Engine — Shared Types
 * Used by both backend engine and frontend components.
 */

// ─── Enum Types ──────────────────────────────────────────────────────────────

export type LeaseType = "retail" | "office" | "industrial" | "other";
export type BaseRentMode = "PER_SF_YEAR" | "PER_MONTH" | "PER_YEAR";
export type EscalationType = "NONE" | "FIXED_DOLLAR" | "FIXED_PER_SF" | "PERCENT" | "CPI";
export type ChargeLineType =
  | "RECOVERY_CAM" | "RECOVERY_TAX" | "RECOVERY_INSURANCE"
  | "RECOVERY_UTILITIES" | "MISC_INCOME" | "DISCOUNT" | "TI_AMORTIZATION";
export type ChargeAmountMode = "FIXED_MONTHLY" | "PER_SF_MONTHLY";
export type AbatementType = "FREE_RENT" | "PERCENT_DISCOUNT" | "FIXED_CREDIT";
export type AbatementAppliesTo = "BASE_ONLY" | "BASE_PLUS_RECOVERIES" | "ALL_CHARGES";
export type SalesSource = "ACTUAL" | "FORECAST";
export type PercentRentTiming = "MONTHLY" | "QUARTERLY" | "ANNUAL_TRUEUP";
export type BreakpointType = "NATURAL" | "ARTIFICIAL";
export type YearBasis = "CALENDAR" | "TENANT_FISCAL";
export type TiAllowanceMode = "PER_SF" | "FIXED_TOTAL";
export type TiParticipationMode = "NONE" | "PERCENT_ABOVE_ALLOWANCE" | "FIXED_CONTRIBUTION" | "COMBO";
export type TiAmortizeBasis = "LANDLORD_ONLY" | "LANDLORD_PLUS_TENANT";
export type TenantShareMode = "BY_SF" | "FIXED_PERCENT";
export type BillingTiming = "MONTHLY_ESTIMATE" | "MONTHLY_WITH_ANNUAL_TRUEUP";
export type RecoveryStopType = "NONE" | "BASE_YEAR_STOP" | "EXPENSE_STOP_PER_SF";
export type RecoveryCategory = "CAM" | "TAX" | "INSURANCE" | "UTILITIES" | "OTHER";

// ─── Data Types ──────────────────────────────────────────────────────────────

export interface PercentRentTier {
  threshold: number; // annual sales breakpoint
  rate: number;      // 0..1
}

export interface AnnualExpenseForecast {
  [year: string]: number; // e.g. { "2025": 123000, "2026": 127000 }
}

// ─── Row Types (matching DB) ─────────────────────────────────────────────────

export interface CommercialLease {
  id: string;
  projectId: string;
  tenantName: string;
  leaseType: LeaseType;
  suite: string | null;
  sf: string;
  units: number;
  active: boolean;
  commencementDate: string;
  rentCommencementDate: string | null;
  expirationDate: string;
  securityDeposit: string | null;
  fiscalYearEndMonth: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeaseTerm {
  id: string;
  leaseId: string;
  termIndex: number;
  startDate: string;
  endDate: string;
  baseRentMode: BaseRentMode;
  baseRentValue: string;
  escalationType: EscalationType;
  escalationValue: string;
  escalationCycleMonths: number;
}

export interface LeaseChargeLine {
  id: string;
  leaseId: string;
  lineName: string;
  lineType: ChargeLineType;
  amountMode: ChargeAmountMode;
  amountValue: string;
  startDate: string;
  endDate: string | null;
  escalationType: EscalationType | null;
  escalationValue: string | null;
  escalationCycleMonths: number | null;
}

export interface LeaseAbatement {
  id: string;
  leaseId: string;
  startDate: string;
  endDate: string;
  abatementType: AbatementType;
  value: string;
  appliesTo: AbatementAppliesTo;
}

export interface LeaseSale {
  id: string;
  leaseId: string;
  monthEnd: string;
  salesAmount: string;
  source: SalesSource;
}

export interface LeasePercentRentRule {
  id: string;
  leaseId: string;
  timing: PercentRentTiming;
  breakpointType: BreakpointType;
  artificialBreakpointAmount: string | null;
  tiersJson: PercentRentTier[];
  trueupYearBasis: YearBasis;
  salesGrowthRate: string | null;
}

export interface LeaseTiProgram {
  id: string;
  leaseId: string;
  allowanceMode: TiAllowanceMode;
  allowanceValue: string;
  landlordCapTotal: string | null;
  tenantParticipationMode: TiParticipationMode;
  tenantParticipationValue: string | null;
  tenantFixedContribution: string | null;
  amortizeEnabled: boolean;
  amortizeAmountBasis: TiAmortizeBasis;
  amortizeRateAnnual: string | null;
  amortizeTermMonths: number | null;
  amortizeStartMonthEnd: string | null;
}

export interface LeaseTiDraw {
  id: string;
  tiProgramId: string;
  drawDate: string;
  amount: string;
}

export interface LeaseRecoveryModel {
  id: string;
  leaseId: string;
  totalPropertyNraSf: string | null;
  tenantShareMode: TenantShareMode;
  tenantSharePercent: string | null;
  billingTiming: BillingTiming;
  stopYearBasis: YearBasis;
  baseYear: number | null;
  grossupEnabled: boolean;
  grossupOccupancyThreshold: string | null;
}

export interface LeaseRecoveryCategoryRow {
  id: string;
  recoveryModelId: string;
  category: RecoveryCategory;
  stopType: RecoveryStopType;
  baseYearAmountTotal: string | null;
  expenseStopPerSf: string | null;
  annualExpenseForecast: AnnualExpenseForecast | null;
  annualGrowthRate: string | null;
}

export interface LeaseMonthlyCashflow {
  id: string;
  leaseId: string;
  monthEnd: string;
  baseRent: string;
  recoveriesCam: string;
  recoveriesTax: string;
  recoveriesInsurance: string;
  recoveriesUtilities: string;
  miscIncome: string;
  discounts: string;
  percentRent: string;
  tiLandlordCapex: string;
  tiTenantContribution: string;
  tiAmortizationCharge: string;
  totalRent: string;
  meta: Record<string, unknown> | null;
}

// ─── Full Lease Detail (API response) ────────────────────────────────────────

export interface LeaseDetail extends CommercialLease {
  terms: LeaseTerm[];
  chargeLines: LeaseChargeLine[];
  abatements: LeaseAbatement[];
  sales: LeaseSale[];
  percentRentRules: LeasePercentRentRule[];
  tiPrograms: LeaseTiProgram[];
  recoveryModels: (LeaseRecoveryModel & { categories: LeaseRecoveryCategoryRow[] })[];
}

// ─── Cashflow Summary ────────────────────────────────────────────────────────

export interface CashflowSummary {
  totalBaseRent: number;
  totalRecoveries: number;
  totalPercentRent: number;
  totalMiscIncome: number;
  totalDiscounts: number;
  totalTiCapex: number;
  totalTiAmortization: number;
  netTotalRent: number;
  monthlyRows: LeaseMonthlyCashflow[];
}

// ─── Rollup Types (for Historical + Pro Forma integration) ──────────────────

export interface LeaseRollupMonth {
  monthEnd: string;
  baseRent: number;
  recoveriesCam: number;
  recoveriesTax: number;
  recoveriesInsurance: number;
  recoveriesUtilities: number;
  miscIncome: number;
  discounts: number;
  percentRent: number;
  tiLandlordCapex: number;
  tiAmortizationCharge: number;
  totalRent: number;
}

export interface ProjectLeaseRollup {
  projectId: string;
  months: LeaseRollupMonth[];
  byLease: { leaseId: string; tenantName: string; months: LeaseRollupMonth[] }[];
}
