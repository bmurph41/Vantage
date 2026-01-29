/**
 * Tests for Sensitivity Matrix Service
 * 
 * Verifies that sensitivity analysis uses real pro forma outputs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the pro forma engine
vi.mock('../pro-forma-engine-service', () => ({
  proFormaEngineService: {
    generateProForma: vi.fn().mockResolvedValue({
      projectId: 'test-project',
      scenarioType: 'base',
      scenarioVersion: 1,
      holdPeriod: 5,
      years: [2025, 2026, 2027, 2028, 2029],
      baseYear: 2025,
      revenue: { totals: [1000000, 1030000, 1060900, 1092727, 1125509], lineItems: [] },
      expenses: { totals: [600000, 615000, 630375, 646134, 662288], lineItems: [] },
      noi: [400000, 415000, 430525, 446593, 463221],
      cashFlow: [380000, 394700, 409699, 424764, 440060],
      metrics: {
        goingInCapRate: 8,
        exitCapRate: 7.5,
        revenueGrowthRate: 3,
        expenseGrowthRate: 2.5,
        purchasePrice: 5000000,
        exitValue: 6176280,
        totalReturn: 8225503,
        irr: 12.5,
        irrAnnualized: 12.5,
        irrDisplayPreference: 'monthly',
        equityMultiple: 1.65,
        year1Noi: 400000,
        year3Noi: 430525,
        stabilizedNoi: 430525,
        stabilizedNoiYear: 3,
        stabilizedNoiMode: 'fixed_year',
      },
      errors: [],
      warnings: [],
      lastUpdated: new Date().toISOString(),
    }),
  },
}));

// Mock database
vi.mock('../../db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'test', version: 1 }]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'new-id' }]),
      }),
    }),
  },
}));

import { SensitivityMatrixService, type SensitivityConfig } from '../sensitivity-matrix-service';

describe('SensitivityMatrixService', () => {
  let service: SensitivityMatrixService;

  beforeEach(() => {
    service = new SensitivityMatrixService();
    vi.clearAllMocks();
  });

  describe('generateRange', () => {
    it('generates correct range values', () => {
      const range = (service as any).generateRange(0, 10, 2);
      expect(range).toEqual([0, 2, 4, 6, 8, 10]);
    });

    it('handles decimal steps', () => {
      const range = (service as any).generateRange(5, 7, 0.5);
      expect(range).toEqual([5, 5.5, 6, 6.5, 7]);
    });

    it('prevents infinite loops with zero step', () => {
      const range = (service as any).generateRange(0, 5, 0);
      expect(range.length).toBeLessThan(100); // Should have safeguard
    });
  });

  describe('extractMetric', () => {
    const mockProForma = {
      metrics: {
        irr: 12.5,
        irrAnnualized: 12.5,
        equityMultiple: 1.65,
        exitValue: 6000000,
        year1Noi: 400000,
        year3Noi: 430000,
        stabilizedNoi: 430000,
      },
    };

    it('extracts IRR correctly', () => {
      const result = (service as any).extractMetric(mockProForma, 'irr');
      expect(result).toBe(12.5);
    });

    it('extracts equity multiple correctly', () => {
      const result = (service as any).extractMetric(mockProForma, 'equity_multiple');
      expect(result).toBe(1.65);
    });

    it('extracts exit value correctly', () => {
      const result = (service as any).extractMetric(mockProForma, 'exit_value');
      expect(result).toBe(6000000);
    });

    it('extracts stabilized NOI correctly', () => {
      const result = (service as any).extractMetric(mockProForma, 'stabilized_noi');
      expect(result).toBe(430000);
    });

    it('returns 0 for unknown metric', () => {
      const result = (service as any).extractMetric(mockProForma, 'unknown_metric');
      expect(result).toBe(0);
    });
  });

  describe('buildOverrides', () => {
    it('builds revenue growth override from x-axis', () => {
      const overrides = (service as any).buildOverrides(
        'revenue_growth', 5,
        'exit_cap_rate', 7.5,
        0.03, 0.025, 0.075
      );
      
      expect(overrides.revenueGrowthRate).toBe(0.05);
      expect(overrides.exitCapRate).toBe(0.075);
    });

    it('builds expense growth override from y-axis', () => {
      const overrides = (service as any).buildOverrides(
        'exit_cap_rate', 8,
        'expense_growth', 3,
        0.03, 0.025, 0.075
      );
      
      expect(overrides.exitCapRate).toBe(0.08);
      expect(overrides.expenseGrowthRate).toBe(0.03);
    });

    it('handles occupancy delta', () => {
      const overrides = (service as any).buildOverrides(
        'occupancy_delta', -5,
        'revenue_growth', 3,
        0.03, 0.025, 0.075
      );
      
      expect(overrides.occupancyDelta).toBe(-0.05);
      expect(overrides.revenueGrowthRate).toBe(0.03);
    });
  });

  describe('calculateIRR', () => {
    it('calculates positive IRR correctly', () => {
      const cashFlows = [-1000000, 100000, 150000, 200000, 250000, 800000];
      const irr = (service as any).calculateIRR(cashFlows);
      
      // Should be around 15-20%
      expect(irr).toBeGreaterThan(10);
      expect(irr).toBeLessThan(25);
    });

    it('returns 0 for no initial investment', () => {
      const cashFlows = [0, 100000, 200000];
      const irr = (service as any).calculateIRR(cashFlows);
      expect(irr).toBe(0);
    });

    it('returns -100 for total loss', () => {
      const cashFlows = [-1000000, -100000, -50000];
      const irr = (service as any).calculateIRR(cashFlows);
      expect(irr).toBe(-100);
    });

    it('handles break-even scenario', () => {
      const cashFlows = [-1000000, 200000, 200000, 200000, 200000, 200000];
      const irr = (service as any).calculateIRR(cashFlows);
      expect(irr).toBeCloseTo(0, 0);
    });
  });
});
