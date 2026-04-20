/**
 * Tests for SCHEDULE escalation logic in dcf-calculator-service.ts
 *
 * Covers:
 *   - findActiveRentStep
 *   - convertRentStepToAnnual (PSF_YEAR, PER_YEAR, PER_MONTH)
 *   - computeLeaseIncomeByYear with SCHEDULE-type leases
 *   - computeLeaseEGIForMonth (from cash-flow-forecasting-routes.ts) SCHEDULE path
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  findActiveRentStep,
  convertRentStepToAnnual,
  computeLeaseIncomeByYear,
  performDCFAnalysis,
  computeQuickIRR,
  type RentStepEntry,
  type LeaseBreakdownEntry,
} from '../dcf-calculator-service';
import { computeLeaseEGIForMonth } from '../../routes/cash-flow-forecasting-routes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeScheduleLease(
  overrides: Partial<LeaseBreakdownEntry> = {}
): LeaseBreakdownEntry {
  return {
    leaseId: 'test-lease-1',
    tenantName: 'Test Tenant',
    sf: 1000,
    leaseType: 'NNN',
    baseRentAnnual: 12000,
    recoveryAnnual: 2400,
    escalationType: 'SCHEDULE',
    escalationRate: 0,
    leaseEndDate: '2030-01-01',
    leaseStartDate: '2024-01-01',
    rentCommencementDate: '2024-01-01',
    freeRentMonths: 0,
    scheduleJson: [],
    ...overrides,
  };
}

// ─── findActiveRentStep ───────────────────────────────────────────────────────

describe('findActiveRentStep', () => {
  const schedule: RentStepEntry[] = [
    { effectiveDate: '2024-01-01', value: 1000, unit: 'PER_MONTH' },
    { effectiveDate: '2025-01-01', value: 1200, unit: 'PER_MONTH' },
    { effectiveDate: '2026-01-01', value: 1400, unit: 'PER_MONTH' },
  ];

  it('returns null when no steps have taken effect yet', () => {
    const result = findActiveRentStep(schedule, new Date('2023-12-31'));
    expect(result).toBeNull();
  });

  it('returns the first step when date exactly matches effectiveDate', () => {
    const result = findActiveRentStep(schedule, new Date('2024-01-01'));
    expect(result).not.toBeNull();
    expect(result!.value).toBe(1000);
  });

  it('returns the first step when date is mid-first-year', () => {
    const result = findActiveRentStep(schedule, new Date('2024-06-15'));
    expect(result!.value).toBe(1000);
  });

  it('returns the second step at the start of year 2', () => {
    const result = findActiveRentStep(schedule, new Date('2025-01-01'));
    expect(result!.value).toBe(1200);
  });

  it('returns the last step when date is after all effective dates', () => {
    const result = findActiveRentStep(schedule, new Date('2027-06-01'));
    expect(result!.value).toBe(1400);
  });

  it('returns null for an empty schedule', () => {
    const result = findActiveRentStep([], new Date('2024-01-01'));
    expect(result).toBeNull();
  });

  it('returns the correct step just one day before a transition', () => {
    const result = findActiveRentStep(schedule, new Date('2024-12-31'));
    expect(result!.value).toBe(1000);
  });
});

// ─── convertRentStepToAnnual ──────────────────────────────────────────────────

describe('convertRentStepToAnnual', () => {
  const sf = 2000;

  it('converts PSF_YEAR correctly (value × sf)', () => {
    const step: RentStepEntry = { effectiveDate: '2024-01-01', value: 20, unit: 'PSF_YEAR' };
    expect(convertRentStepToAnnual(step, sf)).toBe(40000);
  });

  it('converts PER_YEAR correctly (value as-is)', () => {
    const step: RentStepEntry = { effectiveDate: '2024-01-01', value: 36000, unit: 'PER_YEAR' };
    expect(convertRentStepToAnnual(step, sf)).toBe(36000);
  });

  it('converts PER_MONTH correctly (value × 12)', () => {
    const step: RentStepEntry = { effectiveDate: '2024-01-01', value: 3000, unit: 'PER_MONTH' };
    expect(convertRentStepToAnnual(step, sf)).toBe(36000);
  });

  it('treats unknown unit as annual pass-through', () => {
    const step: RentStepEntry = { effectiveDate: '2024-01-01', value: 24000, unit: 'UNKNOWN' };
    expect(convertRentStepToAnnual(step, sf)).toBe(24000);
  });
});

// ─── computeLeaseIncomeByYear — SCHEDULE escalation ──────────────────────────

describe('computeLeaseIncomeByYear — SCHEDULE type', () => {
  const acquisitionDate = '2024-01-01';

  describe('step amount applied in each projection year', () => {
    const steps: RentStepEntry[] = [
      { effectiveDate: '2024-01-01', value: 1000, unit: 'PER_MONTH' },  // 12 000/yr
      { effectiveDate: '2025-01-01', value: 1500, unit: 'PER_MONTH' },  // 18 000/yr
      { effectiveDate: '2026-01-01', value: 2000, unit: 'PER_MONTH' },  // 24 000/yr
    ];

    const lease = makeScheduleLease({
      baseRentAnnual: 12000,
      scheduleJson: steps,
    });

    it('applies step 1 (1 000/mo → 12 000/yr) in Year 1', () => {
      const result = computeLeaseIncomeByYear([lease], 3, acquisitionDate);
      expect(result[0].year).toBe(1);
      expect(result[0].baseRentAnnual).toBe(12000);
    });

    it('applies step 2 (1 500/mo → 18 000/yr) in Year 2', () => {
      const result = computeLeaseIncomeByYear([lease], 3, acquisitionDate);
      expect(result[1].year).toBe(2);
      expect(result[1].baseRentAnnual).toBe(18000);
    });

    it('applies step 3 (2 000/mo → 24 000/yr) in Year 3', () => {
      const result = computeLeaseIncomeByYear([lease], 3, acquisitionDate);
      expect(result[2].year).toBe(3);
      expect(result[2].baseRentAnnual).toBe(24000);
    });

    it('activeStepRentAnnual reflects the step active at year-start', () => {
      const result = computeLeaseIncomeByYear([lease], 3, acquisitionDate);
      expect(result[0].leaseDetail[0].activeStepRentAnnual).toBe(12000);
      expect(result[1].leaseDetail[0].activeStepRentAnnual).toBe(18000);
      expect(result[2].leaseDetail[0].activeStepRentAnnual).toBe(24000);
    });

    it('produces a result for each hold year', () => {
      const result = computeLeaseIncomeByYear([lease], 5, acquisitionDate);
      expect(result).toHaveLength(5);
      result.forEach((yr, i) => expect(yr.year).toBe(i + 1));
    });
  });

  describe('fallback to baseRentAnnual when no step is yet active', () => {
    it('uses baseRentAnnual if first step effective date is in the future', () => {
      const steps: RentStepEntry[] = [
        { effectiveDate: '2027-01-01', value: 2000, unit: 'PER_MONTH' }, // far future
      ];
      const lease = makeScheduleLease({
        baseRentAnnual: 12000,
        scheduleJson: steps,
      });
      const result = computeLeaseIncomeByYear([lease], 2, acquisitionDate);
      // Both years are before 2027, so base rent should be used
      expect(result[0].baseRentAnnual).toBe(12000);
      expect(result[1].baseRentAnnual).toBe(12000);
    });

    it('uses baseRentAnnual when scheduleJson is empty', () => {
      const lease = makeScheduleLease({
        baseRentAnnual: 15000,
        scheduleJson: [],
      });
      const result = computeLeaseIncomeByYear([lease], 2, acquisitionDate);
      expect(result[0].baseRentAnnual).toBe(15000);
    });

    it('uses baseRentAnnual when scheduleJson is null', () => {
      const lease = makeScheduleLease({
        baseRentAnnual: 15000,
        scheduleJson: null,
        escalationType: 'SCHEDULE',
      });
      const result = computeLeaseIncomeByYear([lease], 1, acquisitionDate);
      expect(result[0].baseRentAnnual).toBe(15000);
    });

    it('activeStepRentAnnual falls back to baseRentAnnual when no step active', () => {
      const steps: RentStepEntry[] = [
        { effectiveDate: '2030-01-01', value: 2000, unit: 'PER_MONTH' },
      ];
      const lease = makeScheduleLease({
        baseRentAnnual: 12000,
        scheduleJson: steps,
      });
      const result = computeLeaseIncomeByYear([lease], 1, acquisitionDate);
      expect(result[0].leaseDetail[0].activeStepRentAnnual).toBe(12000);
    });
  });

  describe('PSF_YEAR unit steps', () => {
    it('applies PSF_YEAR correctly: value × sf per year', () => {
      const steps: RentStepEntry[] = [
        { effectiveDate: '2024-01-01', value: 18, unit: 'PSF_YEAR' }, // 18 × 1000 = 18 000
        { effectiveDate: '2025-01-01', value: 20, unit: 'PSF_YEAR' }, // 20 × 1000 = 20 000
      ];
      const lease = makeScheduleLease({
        sf: 1000,
        baseRentAnnual: 18000,
        scheduleJson: steps,
      });
      const result = computeLeaseIncomeByYear([lease], 2, acquisitionDate);
      expect(result[0].baseRentAnnual).toBe(18000);
      expect(result[1].baseRentAnnual).toBe(20000);
    });
  });

  describe('PER_YEAR unit steps', () => {
    it('applies PER_YEAR correctly: value is the annual rent', () => {
      const steps: RentStepEntry[] = [
        { effectiveDate: '2024-01-01', value: 24000, unit: 'PER_YEAR' },
        { effectiveDate: '2025-01-01', value: 30000, unit: 'PER_YEAR' },
      ];
      const lease = makeScheduleLease({
        baseRentAnnual: 24000,
        scheduleJson: steps,
      });
      const result = computeLeaseIncomeByYear([lease], 2, acquisitionDate);
      expect(result[0].baseRentAnnual).toBe(24000);
      expect(result[1].baseRentAnnual).toBe(30000);
    });
  });

  describe('PER_MONTH unit steps', () => {
    it('applies PER_MONTH correctly: value × 12 per year', () => {
      const steps: RentStepEntry[] = [
        { effectiveDate: '2024-01-01', value: 2000, unit: 'PER_MONTH' }, // 24 000/yr
        { effectiveDate: '2025-01-01', value: 2500, unit: 'PER_MONTH' }, // 30 000/yr
      ];
      const lease = makeScheduleLease({
        baseRentAnnual: 24000,
        scheduleJson: steps,
      });
      const result = computeLeaseIncomeByYear([lease], 2, acquisitionDate);
      expect(result[0].baseRentAnnual).toBe(24000);
      expect(result[1].baseRentAnnual).toBe(30000);
    });
  });

  describe('mid-hold step transitions', () => {
    it('applies the correct step mid-hold when transition happens mid-year (boundary check)', () => {
      // Step effective 2024-07-01 transitions mid-way through year 1
      const steps: RentStepEntry[] = [
        { effectiveDate: '2024-01-01', value: 1000, unit: 'PER_MONTH' },
        { effectiveDate: '2024-07-01', value: 2000, unit: 'PER_MONTH' },
      ];
      const lease = makeScheduleLease({
        baseRentAnnual: 12000,
        scheduleJson: steps,
      });
      const result = computeLeaseIncomeByYear([lease], 1, acquisitionDate);
      // Year 1: 6 months × 1 000 + 6 months × 2 000 = 18 000
      expect(result[0].baseRentAnnual).toBeCloseTo(18000, -2);
    });
  });

  describe('SCHEDULE leases do not compound using escalationRate', () => {
    it('ignores escalationRate entirely for SCHEDULE leases', () => {
      const steps: RentStepEntry[] = [
        { effectiveDate: '2024-01-01', value: 1000, unit: 'PER_MONTH' },
      ];
      const leaseWithRate = makeScheduleLease({
        baseRentAnnual: 12000,
        escalationRate: 0.1, // 10% — should be ignored
        scheduleJson: steps,
      });
      const result = computeLeaseIncomeByYear([leaseWithRate], 3, acquisitionDate);
      // All 3 years should stay at step value (12 000), not compound at 10%
      expect(result[0].baseRentAnnual).toBe(12000);
      expect(result[1].baseRentAnnual).toBe(12000);
      expect(result[2].baseRentAnnual).toBe(12000);
    });
  });

  describe('multiple leases mixed types', () => {
    it('sums SCHEDULE and PERCENT leases correctly in Year 1', () => {
      const scheduleSteps: RentStepEntry[] = [
        { effectiveDate: '2024-01-01', value: 1000, unit: 'PER_MONTH' }, // 12 000/yr
      ];
      const scheduleLease = makeScheduleLease({
        leaseId: 'lease-a',
        baseRentAnnual: 12000,
        scheduleJson: scheduleSteps,
      });
      const percentLease: LeaseBreakdownEntry = {
        leaseId: 'lease-b',
        tenantName: 'Percent Tenant',
        sf: 500,
        leaseType: 'FS',
        baseRentAnnual: 10000,
        recoveryAnnual: 1000,
        escalationType: 'PERCENT',
        escalationRate: 0.03,
        leaseEndDate: '2030-01-01',
        leaseStartDate: '2024-01-01',
        rentCommencementDate: '2024-01-01',
        freeRentMonths: 0,
        scheduleJson: null,
      };
      const result = computeLeaseIncomeByYear([scheduleLease, percentLease], 1, acquisitionDate);
      // SCHEDULE: 12 000; PERCENT year 1 (0 years elapsed): 10 000 × (1.03)^0 = 10 000
      expect(result[0].baseRentAnnual).toBe(22000);
    });
  });
});

// ─── computeLeaseEGIForMonth — SCHEDULE path ──────────────────────────────────

describe('computeLeaseEGIForMonth — SCHEDULE step resolution', () => {
  describe('returns step-based rent for a SCHEDULE lease', () => {
    const steps: RentStepEntry[] = [
      { effectiveDate: '2024-01-01', value: 1000, unit: 'PER_MONTH' },
      { effectiveDate: '2025-01-01', value: 1500, unit: 'PER_MONTH' },
    ];
    const lease = makeScheduleLease({
      baseRentAnnual: 12000,
      recoveryAnnual: 0,
      scheduleJson: steps,
    });

    it('returns 1 000/mo when forecast date is within step 1', () => {
      const jan2024 = new Date('2024-06-01');
      // monthsOut=0 means current date; forecastDate overrides monthDate
      const result = computeLeaseEGIForMonth([lease], 0, jan2024);
      expect(result).toBeCloseTo(1000, 0);
    });

    it('returns 1 500/mo when forecast date falls in step 2', () => {
      const jan2025 = new Date('2025-03-01');
      const result = computeLeaseEGIForMonth([lease], 0, jan2025);
      expect(result).toBeCloseTo(1500, 0);
    });
  });

  describe('falls back to baseRentAnnual/12 when no step is yet active', () => {
    it('uses baseRentAnnual when no step effectiveDate has arrived', () => {
      const steps: RentStepEntry[] = [
        { effectiveDate: '2030-01-01', value: 2000, unit: 'PER_MONTH' },
      ];
      const lease = makeScheduleLease({
        baseRentAnnual: 12000,
        recoveryAnnual: 0,
        scheduleJson: steps,
      });
      const earlyDate = new Date('2024-01-01');
      const result = computeLeaseEGIForMonth([lease], 0, earlyDate);
      expect(result).toBeCloseTo(1000, 0); // 12 000 / 12
    });
  });

  describe('PSF_YEAR step unit in computeLeaseEGIForMonth', () => {
    it('applies PSF_YEAR correctly (value × sf / 12)', () => {
      const steps: RentStepEntry[] = [
        { effectiveDate: '2024-01-01', value: 24, unit: 'PSF_YEAR' }, // 24 × 1000 / 12 = 2 000/mo
      ];
      const lease = makeScheduleLease({
        sf: 1000,
        baseRentAnnual: 24000,
        recoveryAnnual: 0,
        scheduleJson: steps,
      });
      const result = computeLeaseEGIForMonth([lease], 0, new Date('2024-06-01'));
      expect(result).toBeCloseTo(2000, 0);
    });
  });

  describe('recovery income grows at 2.5%/yr independent of SCHEDULE escalation', () => {
    it('applies 2.5%/yr recovery growth factor to recovery portion', () => {
      const steps: RentStepEntry[] = [
        { effectiveDate: '2024-01-01', value: 1000, unit: 'PER_MONTH' },
      ];
      const lease = makeScheduleLease({
        baseRentAnnual: 12000,
        recoveryAnnual: 1200, // 100/mo
        scheduleJson: steps,
      });
      const forecastDate = new Date('2024-01-01');
      // monthsOut = 12 → 1 year out → recovery factor = 1.025
      const result = computeLeaseEGIForMonth([lease], 12, forecastDate);
      const expectedBase = 1000;
      const expectedRecovery = (1200 * Math.pow(1.025, 1)) / 12;
      expect(result).toBeCloseTo(expectedBase + expectedRecovery, 0);
    });
  });

  describe('SCHEDULE lease does not apply compounding rent growth factor', () => {
    it('monthsOut does not compound base rent for SCHEDULE leases', () => {
      const steps: RentStepEntry[] = [
        { effectiveDate: '2024-01-01', value: 1000, unit: 'PER_MONTH' },
      ];
      const lease = makeScheduleLease({
        baseRentAnnual: 12000,
        recoveryAnnual: 0,
        escalationRate: 0.1, // should be ignored for SCHEDULE
        scheduleJson: steps,
      });
      const forecastDate = new Date('2024-06-01');
      // Even with monthsOut=24 (2 years), SCHEDULE rent stays at step value
      const result = computeLeaseEGIForMonth([lease], 24, forecastDate);
      expect(result).toBeCloseTo(1000, 0);
    });
  });
});

// ─── use_lease_income_for_dcf flag — IRR consistency tests ───────────────────
//
// These tests exercise performDCFAnalysis and computeQuickIRR through a
// fully-mocked database pool so no real DB connection is required.
// The mock pool routes each SQL query to canned data based on the table name
// present in the query string.
//
// Scenarios covered:
//   1. flag=null  → lease income NOT injected (backwards-compatible default)
//   2. flag=true  → lease income IS injected, NOI overrides are passed
//   3. flag=false → lease income NOT injected even when leases are present
//   4. computeQuickIRR returns the same IRR as performDCFAnalysis for the same input

// ── Shared fixture data ───────────────────────────────────────────────────────

const ACQUISITION_DATE = '2024-01-01';
const HOLD_PERIOD = 5;
const PURCHASE_PRICE = 5_000_000;
const TOTAL_DEBT = 3_000_000;
const BLENDED_RATE = 0.05;

/**
 * Returns a fake db pool whose .query() method resolves with canned rows
 * based on which table the SQL string references.
 *
 * @param useLeaseIncomeForDcf  The flag value stored in modeling_project_config
 * @param hasLeases             Whether to return tenant lease rows
 */
function makeMockPool(
  useLeaseIncomeForDcf: boolean | null,
  hasLeases: boolean
) {
  return {
    query: vi.fn(async (sql: string) => {
      // ── modeling_projects ──────────────────────────────────────────────────
      if (sql.includes('modeling_projects')) {
        return {
          rows: [{
            modeling_project_id: 'model-proj-1',
            asset_class: 'mf',
            custom_metrics: {
              inputAssumptions: {
                grossRevenue: 500_000,
                noi: 350_000,
                occupancy: 95,
              },
              unitMix: [],
            },
            purchase_price: PURCHASE_PRICE,
          }],
        };
      }

      // ── modeling_scenario_versions ─────────────────────────────────────────
      if (sql.includes('modeling_scenario_versions')) {
        return {
          rows: [{
            revenue_growth_rate: 3,
            expense_growth_rate: 2.5,
            exit_cap_rate: 7,
            assumptions: {},
          }],
        };
      }

      // ── modeling_project_config ────────────────────────────────────────────
      if (sql.includes('modeling_project_config')) {
        return {
          rows: [{
            hold_period: HOLD_PERIOD,
            acquisition_close_date: ACQUISITION_DATE,
            cash_flow_granularity: 'annual',
            use_lease_income_for_dcf: useLeaseIncomeForDcf,
          }],
        };
      }

      // ── capital_stacks ─────────────────────────────────────────────────────
      if (sql.includes('capital_stacks')) {
        return {
          rows: [{
            hold_period_years: HOLD_PERIOD,
            noi_growth_rate: 3,
            exit_cap_rate: 7,
            total_equity: PURCHASE_PRICE - TOTAL_DEBT,
            purchase_price: PURCHASE_PRICE,
            total_debt: TOTAL_DEBT,
            blended_debt_rate: BLENDED_RATE,
          }],
        };
      }

      // ── tenant_leases ──────────────────────────────────────────────────────
      if (sql.includes('tenant_leases')) {
        if (!hasLeases) return { rows: [] };
        return {
          rows: [{
            id: 'lease-001',
            tenant_name: 'Acme Corp',
            sf: 5000,
            lease_type: 'NNN',
            lease_end_date: '2030-06-01',
            lease_start_date: '2024-01-01',
            rent_commencement_date: '2024-01-01',
            status: 'ACTIVE',
          }],
        };
      }

      // ── tenant_rent_terms ──────────────────────────────────────────────────
      if (sql.includes('tenant_rent_terms')) {
        return {
          rows: [{
            lease_id: 'lease-001',
            base_rent_input_unit: 'PSF_YEAR',
            base_rent_input_value: '30',      // $30 × 5 000 sf = $150 000/yr
            escalation_type: 'PERCENT',
            escalation_value: '0.03',
            escalation_frequency_months: 12,
            schedule_json: null,
          }],
        };
      }

      // ── tenant_recoveries ─────────────────────────────────────────────────
      if (sql.includes('tenant_recoveries')) {
        return {
          rows: [{
            lease_id: 'lease-001',
            method: 'FIXED_ANNUAL',
            amount: '12000',
            psf_amount: null,
          }],
        };
      }

      // Fallback — no rows
      return { rows: [] };
    }),
  };
}

/**
 * Minimal computeDirectInputFinancials stub.
 * Returns a year-1 financial object consistent with the fixture assumptions.
 */
function makeYear1(_assetClass: string, assumptions: any, _unitMix: any) {
  return {
    grossRevenue: assumptions.leaseEGIAnnual ?? 500_000,
    effectiveGrossIncome: assumptions.leaseEGIAnnual ?? 500_000,
    noi: assumptions.leaseEGIAnnual
      ? assumptions.leaseEGIAnnual * 0.7
      : 350_000,
    operatingExpenses: 150_000,
    occupancy: 95,
  };
}

/**
 * Minimal computeMultiYearProjection stub.
 * Honors noiOverrides if passed (simulating the production engine's behaviour).
 */
function makeProjection(year1: any, config: any) {
  const baseNOI = year1.noi ?? 350_000;
  const growthRate = config.revenueGrowthRate ?? 0.03;
  const exitCapRate = config.exitCapRate ?? 0.07;
  const holdPeriod = config.holdPeriod ?? HOLD_PERIOD;

  const years = Array.from({ length: holdPeriod }, (_, i) => {
    const yr = i + 1;
    const noi = config.noiOverrides?.[i] ?? Math.round(baseNOI * Math.pow(1 + growthRate, i));
    return {
      year: yr,
      label: `Year ${yr}`,
      noi,
      capex: 0,
      ncf: noi,
    };
  });

  const exitNOI = config.noiOverrides
    ? Math.round(config.noiOverrides[holdPeriod - 1] * (1 + growthRate))
    : Math.round(baseNOI * Math.pow(1 + growthRate, holdPeriod));

  const exitValue = Math.round(exitNOI / exitCapRate);
  const sellingCosts = Math.round(exitValue * 0.03);
  const netSaleProceeds = exitValue - sellingCosts;

  return { years, exit: { exitNOI, exitCapRate, exitValue, sellingCosts, netSaleProceeds } };
}

/** Default deps shared across flag tests */
const baseDeps = {
  computeDirectInputFinancials: makeYear1,
  computeMultiYearProjection: makeProjection,
};

// ── Test suite ────────────────────────────────────────────────────────────────

describe('performDCFAnalysis — use_lease_income_for_dcf flag behavior', () => {
  describe('flag = null (unset / legacy default)', () => {
    it('does NOT inject lease income into assumptions', async () => {
      const pool = makeMockPool(null, true /* leases exist */);
      const result = await performDCFAnalysis(
        { projectId: 'proj-1', orgId: 'org-1' },
        { pool, ...baseDeps }
      );
      expect(result.meta.leaseIncomeInjected).toBe(false);
    });

    it('records useLeaseIncomeForDcf as null in meta', async () => {
      const pool = makeMockPool(null, true);
      const result = await performDCFAnalysis(
        { projectId: 'proj-1', orgId: 'org-1' },
        { pool, ...baseDeps }
      );
      expect(result.meta.useLeaseIncomeForDcf).toBeNull();
    });

    it('returns a valid IRR even without lease injection', async () => {
      const pool = makeMockPool(null, true);
      const result = await performDCFAnalysis(
        { projectId: 'proj-1', orgId: 'org-1' },
        { pool, ...baseDeps }
      );
      expect(typeof result.irr).toBe('number');
      expect(isFinite(result.irr)).toBe(true);
    });
  });

  describe('flag = false (user explicitly opted out)', () => {
    it('does NOT inject lease income even when leases exist', async () => {
      const pool = makeMockPool(false, true /* leases exist */);
      const result = await performDCFAnalysis(
        { projectId: 'proj-1', orgId: 'org-1' },
        { pool, ...baseDeps }
      );
      expect(result.meta.leaseIncomeInjected).toBe(false);
    });

    it('records useLeaseIncomeForDcf as false in meta', async () => {
      const pool = makeMockPool(false, true);
      const result = await performDCFAnalysis(
        { projectId: 'proj-1', orgId: 'org-1' },
        { pool, ...baseDeps }
      );
      expect(result.meta.useLeaseIncomeForDcf).toBe(false);
    });

    it('produces the same IRR as flag=null for the same inputs', async () => {
      const poolNull = makeMockPool(null, true);
      const poolFalse = makeMockPool(false, true);

      const [resultNull, resultFalse] = await Promise.all([
        performDCFAnalysis({ projectId: 'proj-1', orgId: 'org-1' }, { pool: poolNull, ...baseDeps }),
        performDCFAnalysis({ projectId: 'proj-1', orgId: 'org-1' }, { pool: poolFalse, ...baseDeps }),
      ]);

      expect(resultFalse.irr).toBeCloseTo(resultNull.irr, 6);
    });
  });

  describe('flag = true (user explicitly opted in)', () => {
    it('DOES inject lease income into assumptions', async () => {
      const pool = makeMockPool(true, true /* leases exist */);
      const result = await performDCFAnalysis(
        { projectId: 'proj-1', orgId: 'org-1' },
        { pool, ...baseDeps }
      );
      expect(result.meta.leaseIncomeInjected).toBe(true);
    });

    it('records useLeaseIncomeForDcf as true in meta', async () => {
      const pool = makeMockPool(true, true);
      const result = await performDCFAnalysis(
        { projectId: 'proj-1', orgId: 'org-1' },
        { pool, ...baseDeps }
      );
      expect(result.meta.useLeaseIncomeForDcf).toBe(true);
    });

    it('does NOT inject lease income when no leases exist, even with flag=true', async () => {
      const pool = makeMockPool(true, false /* no leases */);
      const result = await performDCFAnalysis(
        { projectId: 'proj-1', orgId: 'org-1' },
        { pool, ...baseDeps }
      );
      expect(result.meta.leaseIncomeInjected).toBe(false);
    });

    it('passes noiOverrides to computeMultiYearProjection when leases exist', async () => {
      const pool = makeMockPool(true, true);
      const projectionSpy = vi.fn(makeProjection);

      await performDCFAnalysis(
        { projectId: 'proj-1', orgId: 'org-1' },
        { pool, computeDirectInputFinancials: makeYear1, computeMultiYearProjection: projectionSpy }
      );

      // The spy should have been called at least once (main projection + sensitivity matrix)
      expect(projectionSpy).toHaveBeenCalled();

      // The FIRST call (main DCF projection) must carry noiOverrides
      const firstCallConfig = projectionSpy.mock.calls[0][1];
      expect(firstCallConfig).toHaveProperty('noiOverrides');
      expect(Array.isArray(firstCallConfig.noiOverrides)).toBe(true);
      expect(firstCallConfig.noiOverrides.length).toBe(HOLD_PERIOD);
    });

    it('produces a different IRR than flag=null because NOI overrides change cash flows', async () => {
      const poolTrue = makeMockPool(true, true);
      const poolNull = makeMockPool(null, true);

      const [resultTrue, resultNull] = await Promise.all([
        performDCFAnalysis({ projectId: 'proj-1', orgId: 'org-1' }, { pool: poolTrue, ...baseDeps }),
        performDCFAnalysis({ projectId: 'proj-1', orgId: 'org-1' }, { pool: poolNull, ...baseDeps }),
      ]);

      // IRRs may differ because lease EGI ($162 000/yr) differs from
      // the generic growth-based NOI ($350 000) — the key check is that both
      // are numerically valid and that the flag actually changed something.
      expect(isFinite(resultTrue.irr)).toBe(true);
      expect(isFinite(resultNull.irr)).toBe(true);
      // When injected lease EGI ($162 000) < generic NOI ($350 000), IRR will be lower
      expect(resultTrue.irr).not.toBeCloseTo(resultNull.irr, 2);
    });
  });
});

describe('computeQuickIRR — delegates to performDCFAnalysis and returns identical IRR', () => {
  it('returns the same leveredIrr as performDCFAnalysis for flag=null', async () => {
    const pool1 = makeMockPool(null, false);
    const pool2 = makeMockPool(null, false);

    const [fullResult, quickResult] = await Promise.all([
      performDCFAnalysis({ projectId: 'proj-1', orgId: 'org-1' }, { pool: pool1, ...baseDeps }),
      computeQuickIRR({ projectId: 'proj-1', orgId: 'org-1' }, { pool: pool2, ...baseDeps }),
    ]);

    expect(quickResult.irr).toBeCloseTo(fullResult.leveredIrr, 6);
  });

  it('returns the same leveredIrr as performDCFAnalysis for flag=false (with leases)', async () => {
    const pool1 = makeMockPool(false, true);
    const pool2 = makeMockPool(false, true);

    const [fullResult, quickResult] = await Promise.all([
      performDCFAnalysis({ projectId: 'proj-1', orgId: 'org-1' }, { pool: pool1, ...baseDeps }),
      computeQuickIRR({ projectId: 'proj-1', orgId: 'org-1' }, { pool: pool2, ...baseDeps }),
    ]);

    expect(quickResult.irr).toBeCloseTo(fullResult.leveredIrr, 6);
  });

  it('returns the same leveredIrr as performDCFAnalysis for flag=true (with leases)', async () => {
    const pool1 = makeMockPool(true, true);
    const pool2 = makeMockPool(true, true);

    const [fullResult, quickResult] = await Promise.all([
      performDCFAnalysis({ projectId: 'proj-1', orgId: 'org-1' }, { pool: pool1, ...baseDeps }),
      computeQuickIRR({ projectId: 'proj-1', orgId: 'org-1' }, { pool: pool2, ...baseDeps }),
    ]);

    expect(quickResult.irr).toBeCloseTo(fullResult.leveredIrr, 6);
  });

  it('exposes the same NPV and equityMultiple as the full analysis', async () => {
    const pool1 = makeMockPool(null, false);
    const pool2 = makeMockPool(null, false);

    const [fullResult, quickResult] = await Promise.all([
      performDCFAnalysis({ projectId: 'proj-1', orgId: 'org-1' }, { pool: pool1, ...baseDeps }),
      computeQuickIRR({ projectId: 'proj-1', orgId: 'org-1' }, { pool: pool2, ...baseDeps }),
    ]);

    expect(quickResult.npv).toBeCloseTo(fullResult.npv, 0);
    expect(quickResult.equityMultiple).toBeCloseTo(fullResult.equityMultiple, 4);
  });

  it('IRR is the same whether flag is false or null (no lease injection in both)', async () => {
    const poolNull = makeMockPool(null, true);
    const poolFalse = makeMockPool(false, true);

    const [quickNull, quickFalse] = await Promise.all([
      computeQuickIRR({ projectId: 'proj-1', orgId: 'org-1' }, { pool: poolNull, ...baseDeps }),
      computeQuickIRR({ projectId: 'proj-1', orgId: 'org-1' }, { pool: poolFalse, ...baseDeps }),
    ]);

    expect(quickNull.irr).toBeCloseTo(quickFalse.irr, 6);
  });
});

// ─── computeLeaseIncomeByYear — free-rent concession logic ────────────────────
//
// Tests verifying that the freeRentReduction path is correct:
//   - months before rentCommencementDate earn $0 rent
//   - freeRentReduction equals the dollar value of the concession window
//   - SCHEDULE leases honour free-rent even when a step is active
//   - free-rent windows spanning more than one projection year are handled year by year
//   - null rentCommencementDate (no free-rent) leaves freeRentReduction at 0

describe('computeLeaseIncomeByYear — free-rent concessions', () => {
  const acquisitionDate = '2024-01-01';

  // Helper: a plain PERCENT/NONE lease with predictable $1 000/month rent,
  // used so tests can focus on the free-rent logic without SCHEDULE complexity.
  function makePlainLease(overrides: Partial<LeaseBreakdownEntry> = {}): LeaseBreakdownEntry {
    return {
      leaseId: 'free-rent-lease',
      tenantName: 'Free Rent Tenant',
      sf: 1000,
      leaseType: 'NNN',
      baseRentAnnual: 12000,   // $1 000/month
      recoveryAnnual: 0,
      escalationType: 'NONE',
      escalationRate: 0,
      leaseStartDate: '2024-01-01',
      leaseEndDate: '2030-01-01',
      rentCommencementDate: '2024-01-01', // no free rent by default
      freeRentMonths: 0,
      scheduleJson: null,
      ...overrides,
    };
  }

  // ── 1. Basic 3-month free-rent window ─────────────────────────────────────

  describe('3-month free-rent at lease start', () => {
    // Lease starts Jan 1, rent commences Apr 1 → Jan / Feb / Mar are rent-free.
    const lease = makePlainLease({
      leaseStartDate: '2024-01-01',
      rentCommencementDate: '2024-04-01',
      freeRentMonths: 3,
    });

    it('Year 1 baseRentAnnual reflects only the 9 paying months ($9 000)', () => {
      const result = computeLeaseIncomeByYear([lease], 1, acquisitionDate);
      // Jan–Mar: free; Apr–Dec: 9 × $1 000 = $9 000
      expect(result[0].baseRentAnnual).toBe(9000);
    });

    it('Year 1 leaseDetail freeRentReduction equals the 3 free months ($3 000)', () => {
      const result = computeLeaseIncomeByYear([lease], 1, acquisitionDate);
      expect(result[0].leaseDetail[0].freeRentReduction).toBe(3000);
    });

    it('Year 2 has no free-rent reduction (commencement is in Year 1)', () => {
      const result = computeLeaseIncomeByYear([lease], 2, acquisitionDate);
      expect(result[1].leaseDetail[0].freeRentReduction).toBe(0);
      // Year 2 earns full 12 months × $1 000 = $12 000
      expect(result[1].baseRentAnnual).toBe(12000);
    });

    it('baseRentAnnual + freeRentReduction equals full-year rent ($12 000) in Year 1', () => {
      const result = computeLeaseIncomeByYear([lease], 1, acquisitionDate);
      const detail = result[0].leaseDetail[0];
      expect(detail.baseRent + detail.freeRentReduction).toBe(12000);
    });
  });

  // ── 2. No free-rent (rentCommencementDate === leaseStartDate) ──────────────

  describe('no free-rent period when commencement equals lease start', () => {
    const lease = makePlainLease({
      leaseStartDate: '2024-01-01',
      rentCommencementDate: '2024-01-01',
      freeRentMonths: 0,
    });

    it('freeRentReduction is 0 in Year 1', () => {
      const result = computeLeaseIncomeByYear([lease], 1, acquisitionDate);
      expect(result[0].leaseDetail[0].freeRentReduction).toBe(0);
    });

    it('full year rent ($12 000) collected in Year 1', () => {
      const result = computeLeaseIncomeByYear([lease], 1, acquisitionDate);
      expect(result[0].baseRentAnnual).toBe(12000);
    });
  });

  // ── 3. null rentCommencementDate falls back to leaseStartDate → no free-rent

  describe('null rentCommencementDate', () => {
    const lease = makePlainLease({
      leaseStartDate: '2024-01-01',
      rentCommencementDate: null,   // should fall back to leaseStartDate
      freeRentMonths: 0,
    });

    it('freeRentReduction is 0 when rentCommencementDate is null', () => {
      const result = computeLeaseIncomeByYear([lease], 1, acquisitionDate);
      expect(result[0].leaseDetail[0].freeRentReduction).toBe(0);
    });

    it('collects full year rent ($12 000) when rentCommencementDate is null', () => {
      const result = computeLeaseIncomeByYear([lease], 1, acquisitionDate);
      expect(result[0].baseRentAnnual).toBe(12000);
    });
  });

  // ── 4. SCHEDULE-type lease: free-rent overrides active step ───────────────
  // A step that is already active during the free-rent window must not generate
  // rent — the isFreePeriod guard must fire even when escalatedMonthlyRent > 0.

  describe('SCHEDULE-type lease during free-rent window', () => {
    const steps: RentStepEntry[] = [
      // Step active from Jan 1, 2024 — falls entirely within the free-rent window
      { effectiveDate: '2024-01-01', value: 2000, unit: 'PER_MONTH' },  // $24 000/yr
    ];
    const lease = makeScheduleLease({
      leaseStartDate: '2024-01-01',
      rentCommencementDate: '2024-04-01',   // 3 months free
      freeRentMonths: 3,
      baseRentAnnual: 24000,                 // fallback (unused since step covers whole year)
      scheduleJson: steps,
    });

    it('Year 1 earns only the 9 paying months at the step rate ($18 000)', () => {
      const result = computeLeaseIncomeByYear([lease], 1, acquisitionDate);
      // Jan–Mar: step at $2 000/mo but free; Apr–Dec: 9 × $2 000 = $18 000
      expect(result[0].baseRentAnnual).toBe(18000);
    });

    it('freeRentReduction equals 3 free months at the active step rate ($6 000)', () => {
      const result = computeLeaseIncomeByYear([lease], 1, acquisitionDate);
      expect(result[0].leaseDetail[0].freeRentReduction).toBe(6000);
    });

    it('baseRent + freeRentReduction equals full-year step rent ($24 000)', () => {
      const result = computeLeaseIncomeByYear([lease], 1, acquisitionDate);
      const detail = result[0].leaseDetail[0];
      expect(detail.baseRent + detail.freeRentReduction).toBe(24000);
    });

    it('Year 2 has zero free-rent reduction (commencement already passed)', () => {
      const result = computeLeaseIncomeByYear([lease], 2, acquisitionDate);
      expect(result[1].leaseDetail[0].freeRentReduction).toBe(0);
    });
  });

  // ── 5. Free-rent window spanning two projection years ─────────────────────
  // rentCommencementDate = 2025-04-01 (15 months after leaseStartDate)
  //   Year 1 (Jan–Dec 2024): entirely free   → netBaseRent = $0, freeRentReduction = $12 000
  //   Year 2 (Jan–Dec 2025): Jan/Feb/Mar free, Apr–Dec paying
  //                          → netBaseRent = $9 000, freeRentReduction = $3 000

  describe('free-rent period spanning two projection years', () => {
    const lease = makePlainLease({
      leaseStartDate: '2024-01-01',
      rentCommencementDate: '2025-04-01',   // 15 months of free rent
      freeRentMonths: 15,
    });

    it('Year 1 collects $0 rent (all 12 months are inside the free-rent window)', () => {
      const result = computeLeaseIncomeByYear([lease], 2, acquisitionDate);
      expect(result[0].baseRentAnnual).toBe(0);
    });

    it('Year 1 freeRentReduction equals a full year of rent ($12 000)', () => {
      const result = computeLeaseIncomeByYear([lease], 2, acquisitionDate);
      expect(result[0].leaseDetail[0].freeRentReduction).toBe(12000);
    });

    it('Year 2 collects 9 months of rent ($9 000, Jan–Mar still free)', () => {
      const result = computeLeaseIncomeByYear([lease], 2, acquisitionDate);
      expect(result[1].baseRentAnnual).toBe(9000);
    });

    it('Year 2 freeRentReduction equals the 3 remaining free months ($3 000)', () => {
      const result = computeLeaseIncomeByYear([lease], 2, acquisitionDate);
      expect(result[1].leaseDetail[0].freeRentReduction).toBe(3000);
    });

    it('Year 3 has no free-rent reduction (commencement is in Year 2)', () => {
      const result = computeLeaseIncomeByYear([lease], 3, acquisitionDate);
      expect(result[2].leaseDetail[0].freeRentReduction).toBe(0);
      expect(result[2].baseRentAnnual).toBe(12000);
    });
  });

  // ── 6. SCHEDULE-type lease with free-rent spanning multiple years ──────────

  describe('SCHEDULE-type lease with free-rent spanning Year 1 and Year 2', () => {
    const steps: RentStepEntry[] = [
      { effectiveDate: '2024-01-01', value: 1000, unit: 'PER_MONTH' },  // $12 000/yr
      { effectiveDate: '2025-01-01', value: 1500, unit: 'PER_MONTH' },  // $18 000/yr
    ];
    // Free-rent: Jan 2024 – Mar 2025 (15 months)
    // Year 1: all months at $1 000/mo → freeRentReduction = $12 000, netBaseRent = $0
    // Year 2: Jan $1 500, Feb $1 500, Mar $1 500 (free); Apr–Dec at $1 500 = 9 × $1 500 = $13 500
    //         freeRentReduction = 3 × $1 500 = $4 500
    const lease = makeScheduleLease({
      leaseStartDate: '2024-01-01',
      rentCommencementDate: '2025-04-01',
      freeRentMonths: 15,
      baseRentAnnual: 12000,
      scheduleJson: steps,
    });

    it('Year 1 collects $0 rent (all months are inside free-rent window)', () => {
      const result = computeLeaseIncomeByYear([lease], 2, acquisitionDate);
      expect(result[0].baseRentAnnual).toBe(0);
    });

    it('Year 1 freeRentReduction equals 12 months × step-1 rate ($12 000)', () => {
      const result = computeLeaseIncomeByYear([lease], 2, acquisitionDate);
      expect(result[0].leaseDetail[0].freeRentReduction).toBe(12000);
    });

    it('Year 2 collects 9 paying months at step-2 rate ($13 500)', () => {
      const result = computeLeaseIncomeByYear([lease], 2, acquisitionDate);
      expect(result[1].baseRentAnnual).toBe(13500);
    });

    it('Year 2 freeRentReduction equals 3 months × step-2 rate ($4 500)', () => {
      const result = computeLeaseIncomeByYear([lease], 2, acquisitionDate);
      expect(result[1].leaseDetail[0].freeRentReduction).toBe(4500);
    });
  });
});
