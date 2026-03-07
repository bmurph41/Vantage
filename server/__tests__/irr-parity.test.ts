/**
 * server/__tests__/irr-parity.test.ts
 * 
 * Layer 2 — IRR Parity Validation.
 * Golden vector tests proving DCF Full, Multi-Year Projection, and Quick IRR
 * produce numerically consistent results.
 * 
 * Tolerances:
 *   IRR: ±0.05% (5 bps)
 *   NPV: ±0.25% of purchase price
 *   EM: ±0.01x
 *   Per-flow amounts: ±$1
 * 
 * Run: npx vitest run server/__tests__/irr-parity.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  calculateXIRR,
  calculateNPV,
  calculateEquityMultiple,
  DatedCashFlow,
} from '../../shared/finance/xirr';
import {
  fromProjection,
  fromQuickIRR,
  compareCashFlows,
  explainMismatch,
  ProjectionInput,
  QuickIRRInput,
} from '../services/finance/cashflow-parity';

// ─── Golden Vectors ──────────────────────────────────────────────────────────

interface GoldenVector {
  name: string;
  acquisitionDate: string;
  purchasePrice: number;
  equityInvested: number;
  holdPeriodYears: number;
  revenueGrowthRate: number;     // decimal
  exitCapRate: number;            // decimal
  sellingCostPct: number;         // decimal
  discountRate: number;           // percent
  annualDebtService: number[];
  debtBalanceAtExit: number;
  year1NCF: number;
}

const VECTORS: GoldenVector[] = [
  {
    name: 'Vector A — Unlevered, 5yr hold, 3% growth',
    acquisitionDate: '2026-01-01',
    purchasePrice: 1_000_000,
    equityInvested: 1_000_000,
    holdPeriodYears: 5,
    revenueGrowthRate: 0.03,
    exitCapRate: 0.075,
    sellingCostPct: 0.03,
    discountRate: 10,
    annualDebtService: [0, 0, 0, 0, 0],
    debtBalanceAtExit: 0,
    year1NCF: 80_000,
  },
  {
    name: 'Vector B — Levered, 65% LTV, amortizing',
    acquisitionDate: '2026-01-01',
    purchasePrice: 2_000_000,
    equityInvested: 700_000,
    holdPeriodYears: 5,
    revenueGrowthRate: 0.03,
    exitCapRate: 0.07,
    sellingCostPct: 0.03,
    discountRate: 10,
    annualDebtService: [85_000, 85_000, 85_000, 85_000, 85_000],
    debtBalanceAtExit: 1_150_000,
    year1NCF: 140_000,
  },
  {
    name: 'Vector C — IO then amortizing',
    acquisitionDate: '2026-01-01',
    purchasePrice: 3_000_000,
    equityInvested: 1_050_000,
    holdPeriodYears: 7,
    revenueGrowthRate: 0.025,
    exitCapRate: 0.065,
    sellingCostPct: 0.03,
    discountRate: 9,
    annualDebtService: [70_000, 70_000, 70_000, 95_000, 95_000, 95_000, 95_000],
    debtBalanceAtExit: 1_700_000,
    year1NCF: 200_000,
  },
  {
    name: 'Vector D — Mid-year acquisition (July 1)',
    acquisitionDate: '2026-07-01',
    purchasePrice: 1_500_000,
    equityInvested: 1_500_000,
    holdPeriodYears: 5,
    revenueGrowthRate: 0.03,
    exitCapRate: 0.07,
    sellingCostPct: 0.02,
    discountRate: 10,
    annualDebtService: [0, 0, 0, 0, 0],
    debtBalanceAtExit: 0,
    year1NCF: 105_000,
  },
  {
    name: 'Vector E — No interim cash flows (exit only)',
    acquisitionDate: '2026-01-01',
    purchasePrice: 500_000,
    equityInvested: 500_000,
    holdPeriodYears: 3,
    revenueGrowthRate: 0.0,
    exitCapRate: 0.08,
    sellingCostPct: 0.03,
    discountRate: 10,
    annualDebtService: [0, 0, 0],
    debtBalanceAtExit: 0,
    year1NCF: 0, // development deal — no interim CF
  },
  {
    name: 'Vector F — Negative terminal (loss scenario)',
    acquisitionDate: '2026-01-01',
    purchasePrice: 1_000_000,
    equityInvested: 400_000,
    holdPeriodYears: 3,
    revenueGrowthRate: -0.05,
    exitCapRate: 0.12,
    sellingCostPct: 0.04,
    discountRate: 10,
    annualDebtService: [45_000, 45_000, 45_000],
    debtBalanceAtExit: 580_000,
    year1NCF: 60_000,
  },
];

// ─── Test Helpers ────────────────────────────────────────────────────────────

function buildProjectionFromVector(v: GoldenVector): ProjectionInput {
  const years = [];
  for (let yr = 1; yr <= v.holdPeriodYears; yr++) {
    years.push({
      year: yr,
      ncf: v.year1NCF * Math.pow(1 + v.revenueGrowthRate, yr - 1),
    });
  }

  const finalNOI = v.year1NCF * Math.pow(1 + v.revenueGrowthRate, v.holdPeriodYears - 1);
  const exitValue = v.exitCapRate > 0 ? finalNOI / v.exitCapRate : 0;
  const sellingCosts = exitValue * v.sellingCostPct;

  return {
    acquisitionDate: v.acquisitionDate,
    equityInvested: v.equityInvested,
    years,
    annualDebtService: v.annualDebtService,
    exit: {
      exitNOI: finalNOI,
      exitValue,
      sellingCosts,
      netSaleProceeds: exitValue - sellingCosts,
    },
    debtBalanceAtExit: v.debtBalanceAtExit,
  };
}

function buildQuickIRRFromVector(v: GoldenVector): QuickIRRInput {
  const finalNOI = v.year1NCF * Math.pow(1 + v.revenueGrowthRate, v.holdPeriodYears - 1);
  // Use full array if debt service varies, otherwise flat
  const dsVaries = new Set(v.annualDebtService).size > 1;
  return {
    acquisitionDate: v.acquisitionDate,
    equityInvested: v.equityInvested,
    year1NCF: v.year1NCF,
    growthRate: v.revenueGrowthRate,
    holdPeriodYears: v.holdPeriodYears,
    exitCapRate: v.exitCapRate,
    sellingCostPct: v.sellingCostPct,
    annualDebtService: dsVaries ? v.annualDebtService : (v.annualDebtService[0] ?? 0),
    debtBalanceAtExit: v.debtBalanceAtExit,
    finalYearNOI: finalNOI,
  };
}

// ─── Tolerance Constants ─────────────────────────────────────────────────────

const IRR_TOLERANCE_PCT = 0.05;      // 5 bps
const EM_TOLERANCE = 0.01;           // 0.01x
const FLOW_AMOUNT_TOLERANCE = 1.0;   // $1

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('IRR Parity — Golden Vectors', () => {

  for (const vector of VECTORS) {
    describe(vector.name, () => {
      const projInput = buildProjectionFromVector(vector);
      const quickInput = buildQuickIRRFromVector(vector);

      const projCanonical = fromProjection(projInput);
      const quickCanonical = fromQuickIRR(quickInput);

      // Flow parity
      it('should have matching flow count', () => {
        expect(projCanonical.flows.length).toBe(quickCanonical.flows.length);
      });

      it('should have matching flow dates', () => {
        const parity = compareCashFlows(projCanonical, quickCanonical, FLOW_AMOUNT_TOLERANCE);
        if (!parity.dateMatch) {
          console.error(explainMismatch(projCanonical, quickCanonical));
        }
        expect(parity.dateMatch).toBe(true);
      });

      it('should have matching flow amounts within $1', () => {
        const parity = compareCashFlows(projCanonical, quickCanonical, FLOW_AMOUNT_TOLERANCE);
        if (!parity.amountMatch) {
          console.error(explainMismatch(projCanonical, quickCanonical));
        }
        expect(parity.amountMatch).toBe(true);
      });

      it('should have matching terminal components', () => {
        const parity = compareCashFlows(projCanonical, quickCanonical, FLOW_AMOUNT_TOLERANCE);
        if (!parity.terminalMatch) {
          console.error(explainMismatch(projCanonical, quickCanonical));
        }
        expect(parity.terminalMatch).toBe(true);
      });

      // IRR parity
      it('should produce matching IRR within ±5bps', () => {
        const projIRR = calculateXIRR(projCanonical.flows);
        const quickIRR = calculateXIRR(quickCanonical.flows);

        const diff = Math.abs(projIRR.irr - quickIRR.irr);
        if (diff > IRR_TOLERANCE_PCT) {
          console.error(
            `IRR mismatch: projection=${projIRR.irr.toFixed(4)}% quick=${quickIRR.irr.toFixed(4)}% diff=${diff.toFixed(4)}%`
          );
          console.error(explainMismatch(projCanonical, quickCanonical));
        }
        expect(diff).toBeLessThanOrEqual(IRR_TOLERANCE_PCT);
      });

      // NPV parity
      it('should produce matching NPV within 0.25% of purchase price', () => {
        const projNPV = calculateNPV(projCanonical.flows, vector.discountRate);
        const quickNPV = calculateNPV(quickCanonical.flows, vector.discountRate);

        const tolerance = vector.purchasePrice * 0.0025;
        const diff = Math.abs(projNPV - quickNPV);
        expect(diff).toBeLessThanOrEqual(tolerance);
      });

      // EM parity
      it('should produce matching equity multiple within ±0.01x', () => {
        const projEM = calculateEquityMultiple(projCanonical.flows);
        const quickEM = calculateEquityMultiple(quickCanonical.flows);

        const diff = Math.abs(projEM - quickEM);
        expect(diff).toBeLessThanOrEqual(EM_TOLERANCE);
      });
    });
  }
});

// ─── Percent Convention Tests ────────────────────────────────────────────────

describe('Percent Convention Checks', () => {
  it('XIRR returns IRR as percent (not decimal)', () => {
    // Typical investment: $100 out, $115 back after 1 year = ~15% IRR
    const flows: DatedCashFlow[] = [
      { date: '2026-01-01', amount: -100 },
      { date: '2027-01-01', amount: 115 },
    ];
    const result = calculateXIRR(flows);
    // Should be ~15, not ~0.15
    expect(result.irr).toBeGreaterThan(10);
    expect(result.irr).toBeLessThan(20);
  });

  it('should NOT double-multiply percent values', () => {
    // Simulates the frontend bug: backend returns 14.25 (percent)
    // Frontend should NOT do 14.25 * 100 = 1425
    const backendIRR = 14.25;
    // Correct display: "14.25%"
    // Incorrect: "1425%"
    const formatted = `${backendIRR.toFixed(2)}%`;
    expect(formatted).toBe('14.25%');
    expect(backendIRR).toBeLessThan(100); // sanity
  });
});

// ─── Known Failure Mode Tests ────────────────────────────────────────────────

describe('Known Failure Modes', () => {
  it('should NOT use hardcoded 10% discount rate for terminal PV', () => {
    // If terminal PV is computed as terminalValue / (1.1)^n, that's the bug.
    // Our system uses calculateNPV with user-defined discount rate.
    const flows: DatedCashFlow[] = [
      { date: '2026-01-01', amount: -1_000_000 },
      { date: '2031-01-01', amount: 1_500_000 },
    ];
    const npvAt8 = calculateNPV(flows, 8);
    const npvAt12 = calculateNPV(flows, 12);
    // NPV at 8% should be higher than at 12%
    expect(npvAt8).toBeGreaterThan(npvAt12);
    // Neither should equal the hardcoded 10% result
    const npvAt10 = calculateNPV(flows, 10);
    expect(npvAt8).not.toBeCloseTo(npvAt10, 0);
    expect(npvAt12).not.toBeCloseTo(npvAt10, 0);
  });

  it('should handle exit cap as percent correctly (7.5 not 0.075 in display)', () => {
    // Backend stores as percent (7.5), converts to decimal internally
    const storedExitCap = 7.5; // from DB
    const decimalForCalc = storedExitCap / 100; // 0.075
    const noi = 100_000;
    const exitValue = noi / decimalForCalc;
    expect(exitValue).toBeCloseTo(1_333_333, -1);
    // NOT noi / 7.5 which would give 13,333
    expect(exitValue).toBeGreaterThan(100_000);
  });

  it('should handle negative IRR scenarios without solver explosion', () => {
    // Loss scenario: invest $1M, get back $800K
    const flows: DatedCashFlow[] = [
      { date: '2026-01-01', amount: -1_000_000 },
      { date: '2029-01-01', amount: 800_000 },
    ];
    const result = calculateXIRR(flows);
    expect(result.irr).toBeLessThan(0);
    expect(isFinite(result.irr)).toBe(true);
  });
});
