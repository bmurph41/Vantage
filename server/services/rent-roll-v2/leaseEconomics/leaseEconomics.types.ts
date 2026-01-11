/**
 * Lease Economics Types
 * 
 * Type definitions for the institutional-grade lease economics engine.
 * Supports rent steps, escalations, concessions, proration, and billing vs accrual.
 */

import type {
  Lease,
  LeaseTerm,
  LeaseRentStep,
  LeaseEscalation,
  LeaseConcession,
  LeaseBillingRule,
  DayCountConvention,
  BillingFrequency,
  BillingTiming,
} from "@shared/schema";

// ============================================================================
// INPUT TYPES
// ============================================================================

/**
 * Complete lease economics input for cash flow generation
 */
export interface LeaseEconomicsInput {
  lease: Lease;
  terms: LeaseTerm[];
  rentSteps: LeaseRentStep[];
  escalations: LeaseEscalation[];
  concessions: LeaseConcession[];
  billingRules: LeaseBillingRule[];
  assumptions: LeaseEconomicsAssumptions;
}

/**
 * Assumptions for cash flow calculation
 */
export interface LeaseEconomicsAssumptions {
  prorationMode: DayCountConvention;
  defaultBillingFrequency: BillingFrequency;
  defaultBillingTiming: BillingTiming;
  projectionEndDate?: Date;
  includeEscalations: boolean;
  cpiRate?: number; // For CPI-linked escalations (future)
}

// ============================================================================
// OUTPUT TYPES
// ============================================================================

/**
 * Single period in the cash flow result
 */
export interface CashFlowPeriodResult {
  periodStart: Date;
  periodEnd: Date;
  year: number;
  month: number;
  label: string;
  
  // Rent amounts
  accruedBaseRent: number;     // Rent recognized for accounting
  billedBaseRent: number;      // Rent invoiced to tenant
  contractBaseRent: number;    // Original contract rent before adjustments
  
  // Adjustments
  escalationAmount: number;    // Amount added from escalations
  concessionsApplied: number;  // Amount reduced from concessions
  effectiveBaseRent: number;   // Net rent after all adjustments
  
  // Other income
  otherIncome: number;         // Additional charges (from existing logic)
  
  // Totals
  totalRevenue: number;        // effectiveBaseRent + otherIncome
  
  // Proration
  proRataFactor: number;       // 0-1, 1 = full period
  isPartialPeriod: boolean;
  daysInPeriod: number;
  
  // Metadata
  activeRentStep?: LeaseRentStep;
  appliedEscalations: AppliedEscalation[];
  appliedConcessions: AppliedConcession[];
}

/**
 * Escalation applied to a period
 */
export interface AppliedEscalation {
  escalationId: string;
  type: 'fixed_percent' | 'fixed_amount' | 'cpi_linked';
  value: number;
  calculatedAmount: number;
}

/**
 * Concession applied to a period
 */
export interface AppliedConcession {
  concessionId: string;
  type: 'free_rent' | 'one_time_credit' | 'amortized_concession';
  amount: number;
}

/**
 * Warning generated during cash flow calculation
 */
export interface CashFlowWarning {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  period?: { year: number; month: number };
}

/**
 * Lineage tracking for audit trail
 */
export interface CashFlowLineage {
  sourceLeaseId: string;
  sourceTermId?: string;
  calculatedAt: Date;
  engineVersion: string;
  usedLegacyFallback: boolean;
  inputHash: string;
}

/**
 * Complete cash flow result for a lease
 */
export interface LeaseCashFlowResult {
  leaseId: string;
  tenantName: string;
  periods: CashFlowPeriodResult[];
  
  // Aggregates
  totalAccruedRent: number;
  totalBilledRent: number;
  totalEffectiveRent: number;
  totalOtherIncome: number;
  totalRevenue: number;
  totalConcessions: number;
  
  // Annualized metrics
  annualizedInPlaceRent: number;
  annualizedEffectiveRent: number;
  
  // Metadata
  warnings: CashFlowWarning[];
  lineage: CashFlowLineage;
}

// ============================================================================
// COMPILED PLAN TYPES (Internal)
// ============================================================================

/**
 * Compiled rent schedule entry
 */
export interface CompiledRentEntry {
  effectiveDate: Date;
  endDate: Date | null;
  monthlyBaseRent: number;
  sourceType: 'lease' | 'rent_step' | 'escalation';
  sourceId?: string;
}

/**
 * Compiled concession entry
 */
export interface CompiledConcessionEntry {
  type: 'free_rent' | 'one_time_credit' | 'amortized_concession';
  startDate: Date;
  endDate: Date | null;
  monthlyAmount: number;
  totalAmount: number;
  sourceId: string;
}

/**
 * Compiled economics plan (intermediate representation)
 */
export interface LeaseEconomicsPlan {
  leaseId: string;
  organizationId: string;
  
  // Core dates
  leaseStart: Date;
  leaseEnd: Date | null;
  
  // Billing configuration
  billingFrequency: BillingFrequency;
  billingTiming: BillingTiming;
  accrualFrequency: BillingFrequency;
  dayCountConvention: DayCountConvention;
  
  // Compiled schedules
  rentSchedule: CompiledRentEntry[];
  concessionSchedule: CompiledConcessionEntry[];
  
  // Flags
  hasEconomicsV2: boolean;
  useLegacyCalculation: boolean;
}

// ============================================================================
// ENGINE OPTIONS
// ============================================================================

export interface LeaseEconomicsEngineOptions {
  startDate?: Date;
  endDate?: Date;
  includeProjections?: boolean;
  yearsToProject?: number;
}

export const DEFAULT_ENGINE_OPTIONS: LeaseEconomicsEngineOptions = {
  includeProjections: false,
  yearsToProject: 1,
};

export const DEFAULT_ASSUMPTIONS: LeaseEconomicsAssumptions = {
  prorationMode: 'actual_30',
  defaultBillingFrequency: 'monthly',
  defaultBillingTiming: 'in_advance',
  includeEscalations: true,
};

export const ENGINE_VERSION = '2.0.0';
