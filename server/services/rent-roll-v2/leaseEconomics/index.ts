/**
 * Lease Economics Module
 * 
 * Institutional-grade lease economics engine supporting:
 * - Rent steps by effective date
 * - Escalations (fixed %, fixed $, CPI placeholder)
 * - Concessions (free rent, one-time credit, amortized)
 * - Billing frequency separate from accrual
 * - Partial-month proration
 * - Backward compatibility with legacy calculation
 */

// Types
export * from './leaseEconomics.types';

// Core modules
export { compileLeaseEconomicsPlan, generateInputHash } from './leaseEconomics.compiler';
export { calculateProration, prorateFirstMonth, prorateLastMonth } from './leaseEconomics.proration';
export { calculateEscalatedRent, calculateTotalEscalationImpact } from './leaseEconomics.escalations';
export { calculateConcessions, compileConcessionSchedule, calculateTotalConcessionImpact } from './leaseEconomics.concessions';

// Main engine
export { 
  generateLeaseEconomicsCashFlows, 
  batchGenerateLeaseEconomicsCashFlows,
  hasEconomicsV2Data 
} from './leaseEconomics.engine';
