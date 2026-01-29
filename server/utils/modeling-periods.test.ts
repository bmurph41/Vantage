/**
 * Tests for Modeling Periods Utility
 * 
 * Verifies timeline derivation, period generation, and rate conversions.
 */

import { describe, it, expect } from 'vitest';
import {
  deriveProjectionStartDate,
  buildMonthlyPeriods,
  buildAnnualPeriods,
  buildModelingPeriods,
  annualToMonthlyRate,
  monthlyToAnnualRate,
  monthlyIrrToAnnualized,
  getStabilizedNoiPeriodIndex,
  type TimelineConfig,
} from './modeling-periods';

describe('deriveProjectionStartDate', () => {
  it('returns start of acquisition year for acq_close_year rule', () => {
    const config: TimelineConfig = {
      acquisitionCloseDate: '2025-06-15',
      ttmEndDate: null,
      projectionStartRule: 'acq_close_year',
      holdPeriodMonths: 60,
    };
    
    const result = deriveProjectionStartDate(config);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(0); // January
    expect(result.getDate()).toBe(1);
  });

  it('returns January 1 of next year for next_full_calendar_year rule', () => {
    const config: TimelineConfig = {
      acquisitionCloseDate: '2025-06-15',
      ttmEndDate: null,
      projectionStartRule: 'next_full_calendar_year',
      holdPeriodMonths: 60,
    };
    
    const result = deriveProjectionStartDate(config);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(1);
  });

  it('returns month after TTM end for ttm_plus_one_month rule', () => {
    const config: TimelineConfig = {
      acquisitionCloseDate: null,
      ttmEndDate: '2025-03-31',
      projectionStartRule: 'ttm_plus_one_month',
      holdPeriodMonths: 60,
    };
    
    const result = deriveProjectionStartDate(config);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(3); // April
    expect(result.getDate()).toBe(1);
  });

  it('handles year boundary for ttm_plus_one_month', () => {
    const config: TimelineConfig = {
      acquisitionCloseDate: null,
      ttmEndDate: '2025-12-31',
      projectionStartRule: 'ttm_plus_one_month',
      holdPeriodMonths: 60,
    };
    
    const result = deriveProjectionStartDate(config);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0); // January
  });

  it('falls back to current year if no dates provided', () => {
    const config: TimelineConfig = {
      acquisitionCloseDate: null,
      ttmEndDate: null,
      projectionStartRule: 'acq_close_year',
      holdPeriodMonths: 60,
    };
    
    const result = deriveProjectionStartDate(config);
    expect(result.getFullYear()).toBe(new Date().getFullYear());
  });
});

describe('buildMonthlyPeriods', () => {
  it('generates correct number of periods', () => {
    const startDate = new Date(2025, 0, 1); // Jan 1, 2025
    const periods = buildMonthlyPeriods(startDate, 60);
    
    expect(periods).toHaveLength(60);
  });

  it('generates correct period keys', () => {
    const startDate = new Date(2025, 0, 1);
    const periods = buildMonthlyPeriods(startDate, 12);
    
    expect(periods[0].key).toBe('2025-01');
    expect(periods[11].key).toBe('2025-12');
  });

  it('generates correct labels', () => {
    const startDate = new Date(2025, 0, 1);
    const periods = buildMonthlyPeriods(startDate, 3);
    
    expect(periods[0].label).toBe('Jan 2025');
    expect(periods[1].label).toBe('Feb 2025');
    expect(periods[2].label).toBe('Mar 2025');
  });

  it('calculates yearIndex correctly', () => {
    const startDate = new Date(2025, 0, 1);
    const periods = buildMonthlyPeriods(startDate, 24);
    
    // Year 1 (index 0) = months 0-11
    expect(periods[0].yearIndex).toBe(0);
    expect(periods[11].yearIndex).toBe(0);
    
    // Year 2 (index 1) = months 12-23
    expect(periods[12].yearIndex).toBe(1);
    expect(periods[23].yearIndex).toBe(1);
  });

  it('handles quarter index correctly', () => {
    const startDate = new Date(2025, 0, 1);
    const periods = buildMonthlyPeriods(startDate, 12);
    
    expect(periods[0].quarterIndex).toBe(0);  // Q1
    expect(periods[3].quarterIndex).toBe(1);  // Q2
    expect(periods[6].quarterIndex).toBe(2);  // Q3
    expect(periods[9].quarterIndex).toBe(3);  // Q4
  });
});

describe('buildAnnualPeriods', () => {
  it('groups monthly periods into annual periods', () => {
    const startDate = new Date(2025, 0, 1);
    const monthlyPeriods = buildMonthlyPeriods(startDate, 60);
    const annualPeriods = buildAnnualPeriods(monthlyPeriods);
    
    expect(annualPeriods).toHaveLength(5);
    expect(annualPeriods[0].yearIndex).toBe(0);
    expect(annualPeriods[0].label).toBe('Year 1 (2025)');
  });

  it('maps correct month indices to each year', () => {
    const startDate = new Date(2025, 0, 1);
    const monthlyPeriods = buildMonthlyPeriods(startDate, 24);
    const annualPeriods = buildAnnualPeriods(monthlyPeriods);
    
    expect(annualPeriods[0].monthIndices).toEqual([0,1,2,3,4,5,6,7,8,9,10,11]);
    expect(annualPeriods[1].monthIndices).toEqual([12,13,14,15,16,17,18,19,20,21,22,23]);
  });
});

describe('buildModelingPeriods', () => {
  it('returns complete period structure', () => {
    const config: TimelineConfig = {
      acquisitionCloseDate: '2025-01-01',
      ttmEndDate: null,
      projectionStartRule: 'acq_close_year',
      holdPeriodMonths: 60,
    };
    
    const result = buildModelingPeriods(config);
    
    expect(result.projectionStartDate).toBeDefined();
    expect(result.projectionEndDate).toBeDefined();
    expect(result.monthlyPeriods).toHaveLength(60);
    expect(result.annualPeriods).toHaveLength(5);
    expect(result.holdPeriodMonths).toBe(60);
    expect(result.holdPeriodYears).toBe(5);
  });

  it('converts holdPeriodYears to months', () => {
    const config: TimelineConfig = {
      acquisitionCloseDate: '2025-01-01',
      ttmEndDate: null,
      projectionStartRule: 'acq_close_year',
      holdPeriodMonths: 0,
      holdPeriodYears: 7,
    };
    
    const result = buildModelingPeriods(config);
    expect(result.holdPeriodMonths).toBe(84);
    expect(result.monthlyPeriods).toHaveLength(84);
  });

  it('defaults to 60 months if no hold period specified', () => {
    const config: TimelineConfig = {
      acquisitionCloseDate: '2025-01-01',
      ttmEndDate: null,
      projectionStartRule: 'acq_close_year',
      holdPeriodMonths: 0,
    };
    
    const result = buildModelingPeriods(config);
    expect(result.holdPeriodMonths).toBe(60);
  });
});

describe('Rate Conversions', () => {
  it('converts annual rate to monthly correctly', () => {
    const annual = 0.12; // 12% annual
    const monthly = annualToMonthlyRate(annual);
    
    // (1 + 0.12)^(1/12) - 1 ≈ 0.00949
    expect(monthly).toBeCloseTo(0.00949, 4);
    
    // Verify round-trip
    const backToAnnual = monthlyToAnnualRate(monthly);
    expect(backToAnnual).toBeCloseTo(annual, 6);
  });

  it('converts monthly IRR to annualized correctly', () => {
    const monthlyIrr = 0.01; // 1% monthly
    const annualized = monthlyIrrToAnnualized(monthlyIrr);
    
    // (1 + 0.01)^12 - 1 ≈ 0.1268
    expect(annualized).toBeCloseTo(0.1268, 3);
  });

  it('handles zero rates', () => {
    expect(annualToMonthlyRate(0)).toBe(0);
    expect(monthlyToAnnualRate(0)).toBe(0);
    expect(monthlyIrrToAnnualized(0)).toBe(0);
  });
});

describe('getStabilizedNoiPeriodIndex', () => {
  const startDate = new Date(2025, 0, 1);
  const monthlyPeriods = buildMonthlyPeriods(startDate, 60);

  it('returns end of Year 3 for fixed_year mode (default)', () => {
    const index = getStabilizedNoiPeriodIndex('fixed_year', { fixedYear: 3 }, monthlyPeriods);
    
    // Year 3 = months 24-35, end = index 35
    expect(index).toBe(35);
  });

  it('returns user-specified month for user_set mode', () => {
    const index = getStabilizedNoiPeriodIndex('user_set', { userSetMonth: 48 }, monthlyPeriods);
    expect(index).toBe(48);
  });

  it('handles Year 1 for fixed_year mode', () => {
    const index = getStabilizedNoiPeriodIndex('fixed_year', { fixedYear: 1 }, monthlyPeriods);
    expect(index).toBe(11); // End of Year 1
  });

  it('falls back to last period if year exceeds hold period', () => {
    const shortPeriods = buildMonthlyPeriods(startDate, 24); // Only 2 years
    const index = getStabilizedNoiPeriodIndex('fixed_year', { fixedYear: 5 }, shortPeriods);
    expect(index).toBe(23); // Last available period
  });
});
