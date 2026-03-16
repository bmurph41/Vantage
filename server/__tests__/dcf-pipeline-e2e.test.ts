/**
 * E2E Test: Direct Input → Multi-Year Projection → DCF → Monte Carlo Pipeline
 * 
 * Verifies the complete refactored data flow:
 * 1. Direct input engine computes Year 1 financials
 * 2. Multi-year projection engine produces canonical NCF array
 * 3. DCF calculator consumes projection (not independent modeling)
 * 4. Monte Carlo runs on canonical flows
 * 5. Decision support (tornado, scenarios) uses same base
 * 
 * Run: npx vitest run server/__tests__/dcf-pipeline-e2e.test.ts
 */

import { describe, it, expect } from 'vitest';
import { computeDirectInputFinancials } from '../services/direct-input-engine';
import { computeMultiYearProjection } from '../services/multi-year-projection-engine';
import { calculateXIRR, calculateNPV, calculateEquityMultiple } from '../../shared/finance/xirr';
import { fromProjection } from '../services/finance/cashflow-parity';
import { runScenarioAnalysis } from '../services/dcf-scenario-layer';
import { runMonteCarlo } from '../services/dcf-simulation-service';
import { computeTornado, getDefaultDrivers } from '../../shared/finance/tornado';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const STR_ASSUMPTIONS = {
  grossRentalIncome: 52195,
  other_income: 0,
  property_management: 3,
  insurance: 500,
  property_taxes: 565.85,
  repairs_maintenance: 500,
  utilities: 0,
  admin_general: 0,
};

const STR_UNIT_MIX = [
  { label: 'Primary Unit', count: 1, monthlyRent: 4349.58, occupancy: 0.95 },
];

const PROJECTION_CONFIG = {
  holdPeriod: 5,
  revenueGrowthRate: 0.03,
  expenseGrowthRate: 0.025,
  exitCapRate: 0.065,
  sellingCostPct: 0.03,
};

// ─── Pipeline Tests ──────────────────────────────────────────────────────────

describe('DCF Pipeline E2E', () => {
  // Step 1: Direct Input
  const year1 = computeDirectInputFinancials('str', STR_ASSUMPTIONS, STR_UNIT_MIX);

  it('Step 1: Direct input produces valid Year 1 financials', () => {
    expect(year1).toBeDefined();
    expect(year1.noi).toBeGreaterThan(0);
    expect(year1.totalRevenue).toBeGreaterThan(0);
    expect(year1.totalExpenses).toBeGreaterThanOrEqual(0);
  });

  // Step 2: Multi-Year Projection
  const projection = computeMultiYearProjection(year1, PROJECTION_CONFIG);

  it('Step 2: Multi-year projection produces correct number of years', () => {
    expect(projection.years).toHaveLength(5);
    expect(projection.years[0].year).toBe(1);
    expect(projection.years[4].year).toBe(5);
  });

  it('Step 2: Year 1 projection matches direct input', () => {
    // Year 1 should be direct input verbatim
    expect(projection.years[0].noi).toBeCloseTo(year1.noi, 0);
  });

  it('Step 2: NOI grows year over year', () => {
    for (let i = 1; i < projection.years.length; i++) {
      expect(projection.years[i].noi).toBeGreaterThan(projection.years[i - 1].noi);
    }
  });

  it('Step 2: Exit metrics are computed', () => {
    expect(projection.exit).toBeDefined();
    expect(projection.exit.exitNOI).toBeGreaterThan(0);
    expect(projection.exit.exitValue).toBeGreaterThan(0);
    expect(projection.exit.netSaleProceeds).toBeGreaterThan(0);
    expect(projection.exit.netSaleProceeds).toBeLessThan(projection.exit.exitValue);
  });

  // Step 3: DCF consumes projection (canonical flows)
  it('Step 3: Canonical cash flows from projection produce valid IRR', () => {
    const purchasePrice = 541000;
    const equityInvested = purchasePrice; // unlevered

    const canonical = fromProjection({
      acquisitionDate: '2026-01-01',
      equityInvested,
      years: projection.years.map(y => ({ year: y.year, ncf: y.ncf })),
      annualDebtService: new Array(5).fill(0),
      exit: projection.exit,
      debtBalanceAtExit: 0,
    });

    expect(canonical.flows).toHaveLength(6); // t0 + 5 years
    expect(canonical.flows[0].amount).toBeLessThan(0); // equity outflow

    const irr = calculateXIRR(canonical.flows);
    expect(irr.converged).toBe(true);
    expect(irr.irr).toBeGreaterThan(0);
    expect(irr.irr).toBeLessThan(100);

    const npv = calculateNPV(canonical.flows, 10);
    expect(npv).toBeGreaterThan(0); // positive NPV at 10% = good deal

    const em = calculateEquityMultiple(canonical.flows);
    expect(em).toBeGreaterThan(1); // profitable
  });

  // Step 4: Scenario analysis on same projection
  it('Step 4: Scenario analysis produces monotonic results', () => {
    const equity = {
      equityInvested: 541000,
      acquisitionDate: '2026-01-01',
      annualDebtService: new Array(5).fill(0),
      debtBalanceAtExit: 0,
      purchasePrice: 541000,
    };

    const scenarios = runScenarioAnalysis(
      year1, computeMultiYearProjection,
      PROJECTION_CONFIG, equity, 10, undefined, 12
    );

    expect(scenarios.base).toBeDefined();
    expect(scenarios.upside).toBeDefined();
    expect(scenarios.downside).toBeDefined();

    // Monotonic: upside >= base >= downside
    expect(scenarios.upside.irr).toBeGreaterThanOrEqual(scenarios.base.irr - 0.5);
    expect(scenarios.base.irr).toBeGreaterThanOrEqual(scenarios.downside.irr - 0.5);

    // Expected case is weighted average
    expect(scenarios.expectedCase.expectedIRR).toBeGreaterThanOrEqual(scenarios.downside.irr);
    expect(scenarios.expectedCase.expectedIRR).toBeLessThanOrEqual(scenarios.upside.irr);
  });

  // Step 5: Monte Carlo on same base
  it('Step 5: Monte Carlo produces valid distribution', () => {
    const equity = {
      equityInvested: 541000,
      acquisitionDate: '2026-01-01',
      annualDebtService: new Array(5).fill(0),
      debtBalanceAtExit: 0,
      purchasePrice: 541000,
    };

    const mc = runMonteCarlo(
      year1, computeMultiYearProjection, PROJECTION_CONFIG, equity,
      { projectId: 'test', orgId: 'test', n: 200, seed: 42, mode: 'fast', hurdleIRR: 12 }
    );

    expect(mc.n).toBe(200);
    expect(mc.stats.irr.p95).toBeGreaterThanOrEqual(mc.stats.irr.p50);
    expect(mc.stats.irr.p50).toBeGreaterThanOrEqual(mc.stats.irr.p5);
    expect(mc.stats.irr.stdDev).toBeGreaterThan(0);
    expect(mc.risks.probIrrBelowHurdle).toBeGreaterThanOrEqual(0);
    expect(mc.risks.probIrrBelowHurdle).toBeLessThanOrEqual(1);
  });

  // Step 6: Tornado on same base
  it('Step 6: Tornado produces ranked drivers', () => {
    const equity = {
      equityInvested: 541000,
      acquisitionDate: '2026-01-01',
      annualDebtService: new Array(5).fill(0),
      debtBalanceAtExit: 0,
      purchasePrice: 541000,
    };

    const tornado = computeTornado(
      year1, computeMultiYearProjection, PROJECTION_CONFIG, equity,
      { drivers: getDefaultDrivers(), target: 'irr', discountRate: 10 }
    );

    expect(tornado.drivers.length).toBeGreaterThan(0);
    // Sorted by spread descending
    for (let i = 1; i < tornado.drivers.length; i++) {
      expect(tornado.drivers[i - 1].spread).toBeGreaterThanOrEqual(tornado.drivers[i].spread);
    }
  });

  // Step 7: Consistency — DCF IRR matches MC base case P50
  it('Step 7: DCF IRR is consistent with MC P50 (within 1%)', () => {
    const equity = {
      equityInvested: 541000,
      acquisitionDate: '2026-01-01',
      annualDebtService: new Array(5).fill(0),
      debtBalanceAtExit: 0,
      purchasePrice: 541000,
    };

    // DCF base IRR
    const canonical = fromProjection({
      acquisitionDate: '2026-01-01',
      equityInvested: 541000,
      years: projection.years.map(y => ({ year: y.year, ncf: y.ncf })),
      annualDebtService: new Array(5).fill(0),
      exit: projection.exit,
      debtBalanceAtExit: 0,
    });
    const dcfIRR = calculateXIRR(canonical.flows).irr;

    // MC P50 (should be very close to base since deltas center around 0)
    const mc = runMonteCarlo(
      year1, computeMultiYearProjection, PROJECTION_CONFIG, equity,
      { projectId: 'test', orgId: 'test', n: 500, seed: 42, mode: 'fast' }
    );

    const diff = Math.abs(dcfIRR - mc.stats.irr.p50);
    expect(diff).toBeLessThan(1.0); // within 100bps
  });
});
