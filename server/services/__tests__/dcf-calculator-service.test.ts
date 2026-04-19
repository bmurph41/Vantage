/**
 * Tests for SCHEDULE escalation logic in dcf-calculator-service.ts
 *
 * Covers:
 *   - findActiveRentStep
 *   - convertRentStepToAnnual (PSF_YEAR, PER_YEAR, PER_MONTH)
 *   - computeLeaseIncomeByYear with SCHEDULE-type leases
 *   - computeLeaseEGIForMonth (from cash-flow-forecasting-routes.ts) SCHEDULE path
 */

import { describe, it, expect } from 'vitest';
import {
  findActiveRentStep,
  convertRentStepToAnnual,
  computeLeaseIncomeByYear,
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
