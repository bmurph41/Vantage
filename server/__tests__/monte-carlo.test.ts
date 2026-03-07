/**
 * server/__tests__/monte-carlo.test.ts
 * 
 * Layer 3 — Monte Carlo simulation tests.
 * Tests seed determinism, stats sanity, scenario monotonicity, risk bounds.
 * 
 * Run: npx vitest run server/__tests__/monte-carlo.test.ts
 */

import { describe, it, expect } from 'vitest';
import { runMonteCarlo } from '../services/dcf-simulation-service';
import { runScenarioAnalysis, DEFAULT_SCENARIOS } from '../services/dcf-scenario-layer';
import {
  computeStats,
  createSeededRNG,
  sampleDistribution,
  DistributionConfig,
} from '../../shared/finance/distributions';

// ─── Mock Multi-Year Projection Engine ───────────────────────────────────────
// Simplified but structurally identical to real engine output

function mockComputeMultiYearProjection(year1: any, config: any): any {
  const years = [];
  const baseNCF = year1.ncf ?? 50_000;

  for (let yr = 1; yr <= config.holdPeriod; yr++) {
    const ncf = baseNCF * Math.pow(1 + config.revenueGrowthRate, yr - 1);
    years.push({
      year: yr,
      label: `Year ${yr}`,
      noi: ncf * 1.04, // NOI slightly above NCF (CapEx deduction)
      capex: ncf * 0.04,
      ncf,
    });
  }

  const finalNOI = years[years.length - 1].noi;
  const exitValue = config.exitCapRate > 0 ? finalNOI / config.exitCapRate : 0;
  const sellingCosts = exitValue * config.sellingCostPct;

  return {
    years,
    exit: {
      exitNOI: finalNOI,
      exitValue,
      sellingCosts,
      netSaleProceeds: exitValue - sellingCosts,
    },
  };
}

const MOCK_YEAR1 = { ncf: 50_000, noi: 52_000 };
const BASE_CONFIG = {
  holdPeriod: 5,
  revenueGrowthRate: 0.03,
  expenseGrowthRate: 0.025,
  exitCapRate: 0.075,
  sellingCostPct: 0.03,
};
const EQUITY = {
  equityInvested: 400_000,
  acquisitionDate: '2026-01-01',
  annualDebtService: [30_000, 30_000, 30_000, 30_000, 30_000],
  debtBalanceAtExit: 500_000,
  purchasePrice: 900_000,
};

// ─── Deterministic Scenario Tests ────────────────────────────────────────────

describe('Deterministic Scenarios', () => {
  const result = runScenarioAnalysis(
    MOCK_YEAR1,
    mockComputeMultiYearProjection,
    BASE_CONFIG,
    EQUITY,
    10, // discount rate
    undefined,
    12, // hurdle IRR
  );

  it('should produce base, upside, downside results', () => {
    expect(result.base).toBeDefined();
    expect(result.upside).toBeDefined();
    expect(result.downside).toBeDefined();
  });

  it('should have monotonic IRR: upside >= base >= downside (within tolerance)', () => {
    // Allow 50bps tolerance for rare ties
    expect(result.upside.irr).toBeGreaterThanOrEqual(result.base.irr - 0.5);
    expect(result.base.irr).toBeGreaterThanOrEqual(result.downside.irr - 0.5);
  });

  it('should have monotonic EM: upside >= base >= downside (within tolerance)', () => {
    expect(result.upside.equityMultiple).toBeGreaterThanOrEqual(result.base.equityMultiple - 0.01);
    expect(result.base.equityMultiple).toBeGreaterThanOrEqual(result.downside.equityMultiple - 0.01);
  });

  it('should produce valid expected case', () => {
    expect(result.expectedCase.expectedIRR).toBeDefined();
    expect(result.expectedCase.expectedEM).toBeGreaterThan(0);
    expect(result.expectedCase.weights.base).toBe(0.5);
    expect(result.expectedCase.weights.upside).toBe(0.25);
    expect(result.expectedCase.weights.downside).toBe(0.25);
  });

  it('expected IRR should be between downside and upside', () => {
    expect(result.expectedCase.expectedIRR).toBeGreaterThanOrEqual(result.downside.irr);
    expect(result.expectedCase.expectedIRR).toBeLessThanOrEqual(result.upside.irr);
  });

  it('probabilities should be between 0 and 1', () => {
    expect(result.expectedCase.probIRRBelowHurdle).toBeGreaterThanOrEqual(0);
    expect(result.expectedCase.probIRRBelowHurdle).toBeLessThanOrEqual(1);
    expect(result.expectedCase.probLosingMoney).toBeGreaterThanOrEqual(0);
    expect(result.expectedCase.probLosingMoney).toBeLessThanOrEqual(1);
  });
});

// ─── Monte Carlo Tests ───────────────────────────────────────────────────────

describe('Monte Carlo Simulation', () => {
  const mcResult = runMonteCarlo(
    MOCK_YEAR1,
    mockComputeMultiYearProjection,
    BASE_CONFIG,
    EQUITY,
    {
      projectId: 'test',
      orgId: 'test',
      n: 500,
      seed: 42,
      mode: 'fast',
      hurdleIRR: 12,
      discountRate: 10,
    }
  );

  it('should run requested number of simulations', () => {
    expect(mcResult.n).toBe(500);
  });

  it('should respect seed', () => {
    expect(mcResult.seed).toBe(42);
  });

  it('should return stats for IRR, EM, NPV', () => {
    expect(mcResult.stats.irr).toBeDefined();
    expect(mcResult.stats.equityMultiple).toBeDefined();
    expect(mcResult.stats.npv).toBeDefined();
  });

  it('should have monotonic percentiles: p95 >= p50 >= p5', () => {
    expect(mcResult.stats.irr.p95).toBeGreaterThanOrEqual(mcResult.stats.irr.p50);
    expect(mcResult.stats.irr.p50).toBeGreaterThanOrEqual(mcResult.stats.irr.p5);
  });

  it('should have positive stdDev for non-degenerate distributions', () => {
    expect(mcResult.stats.irr.stdDev).toBeGreaterThan(0);
    expect(mcResult.stats.equityMultiple.stdDev).toBeGreaterThan(0);
  });

  it('should have risk probabilities between 0 and 1', () => {
    expect(mcResult.risks.probIrrBelowHurdle).toBeGreaterThanOrEqual(0);
    expect(mcResult.risks.probIrrBelowHurdle).toBeLessThanOrEqual(1);
    expect(mcResult.risks.probMultipleBelow1).toBeGreaterThanOrEqual(0);
    expect(mcResult.risks.probMultipleBelow1).toBeLessThanOrEqual(1);
  });

  it('should return preview samples (max 50)', () => {
    expect(mcResult.samplesPreview.length).toBeLessThanOrEqual(50);
    expect(mcResult.samplesPreview.length).toBeGreaterThan(0);
  });

  it('should complete in reasonable time', () => {
    expect(mcResult.computeTimeMs).toBeLessThan(10_000); // 10s max
  });
});

// ─── Seed Determinism ────────────────────────────────────────────────────────

describe('Seed Determinism', () => {
  it('should produce identical first 10 samples with same seed', () => {
    const run1 = runMonteCarlo(
      MOCK_YEAR1, mockComputeMultiYearProjection, BASE_CONFIG, EQUITY,
      { projectId: 'test', orgId: 'test', n: 200, seed: 12345, mode: 'fast' }
    );
    const run2 = runMonteCarlo(
      MOCK_YEAR1, mockComputeMultiYearProjection, BASE_CONFIG, EQUITY,
      { projectId: 'test', orgId: 'test', n: 200, seed: 12345, mode: 'fast' }
    );

    for (let i = 0; i < 10; i++) {
      expect(run1.samplesPreview[i].irr).toBeCloseTo(run2.samplesPreview[i].irr, 6);
      expect(run1.samplesPreview[i].equityMultiple).toBeCloseTo(run2.samplesPreview[i].equityMultiple, 6);
    }
  });

  it('should produce different results with different seeds', () => {
    const run1 = runMonteCarlo(
      MOCK_YEAR1, mockComputeMultiYearProjection, BASE_CONFIG, EQUITY,
      { projectId: 'test', orgId: 'test', n: 200, seed: 100, mode: 'fast' }
    );
    const run2 = runMonteCarlo(
      MOCK_YEAR1, mockComputeMultiYearProjection, BASE_CONFIG, EQUITY,
      { projectId: 'test', orgId: 'test', n: 200, seed: 999, mode: 'fast' }
    );

    // At least some samples should differ
    const diffs = run1.samplesPreview.filter((s, i) =>
      Math.abs(s.irr - run2.samplesPreview[i].irr) > 0.01
    );
    expect(diffs.length).toBeGreaterThan(0);
  });
});

// ─── Distribution Sampling Tests ─────────────────────────────────────────────

describe('Distribution Sampling', () => {
  it('triangular samples should stay within bounds', () => {
    const rng = createSeededRNG(42);
    const config: DistributionConfig = { type: 'triangular', min: -2, mode: 0, max: 2 };

    for (let i = 0; i < 1000; i++) {
      const val = sampleDistribution(config, rng);
      expect(val).toBeGreaterThanOrEqual(-2);
      expect(val).toBeLessThanOrEqual(2);
    }
  });

  it('clamped normal should respect bounds', () => {
    const rng = createSeededRNG(42);
    const config: DistributionConfig = {
      type: 'normal', mean: 0, std: 1, clampMin: -2, clampMax: 2,
    };

    for (let i = 0; i < 1000; i++) {
      const val = sampleDistribution(config, rng);
      expect(val).toBeGreaterThanOrEqual(-2);
      expect(val).toBeLessThanOrEqual(2);
    }
  });

  it('uniform samples should be within range', () => {
    const rng = createSeededRNG(42);
    const config: DistributionConfig = { type: 'uniform', min: -0.5, max: 0.5 };

    for (let i = 0; i < 1000; i++) {
      const val = sampleDistribution(config, rng);
      expect(val).toBeGreaterThanOrEqual(-0.5);
      expect(val).toBeLessThanOrEqual(0.5);
    }
  });

  it('computeStats should produce valid stats', () => {
    const values = Array.from({ length: 100 }, (_, i) => i);
    const stats = computeStats(values);

    expect(stats.mean).toBeCloseTo(49.5, 0);
    expect(stats.median).toBeCloseTo(49.5, 0);
    expect(stats.p5).toBeLessThan(stats.p50);
    expect(stats.p50).toBeLessThan(stats.p95);
    expect(stats.min).toBe(0);
    expect(stats.max).toBe(99);
    expect(stats.stdDev).toBeGreaterThan(0);
  });
});
