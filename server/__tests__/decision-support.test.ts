/**
 * server/__tests__/decision-support.test.ts
 * 
 * Layer 4 — Decision Support tests.
 * Tests feature gating, tornado directional sanity, memo determinism.
 * 
 * Run: npx vitest run server/__tests__/decision-support.test.ts
 */

import { describe, it, expect } from 'vitest';
import { computeTornado, getDefaultDrivers, TornadoConfig } from '../../shared/finance/tornado';
import { computeAttribution, MCAttributionSample } from '../../shared/finance/attribution';
import { generateMemo, MemoInput, MemoTone } from '../../shared/finance/memo-generator';
import { runScenarioAnalysis } from '../services/dcf-scenario-layer';

// ─── Mock Engine ─────────────────────────────────────────────────────────────

function mockEngine(year1: any, config: any): any {
  const years = [];
  const base = year1.ncf ?? 50_000;
  for (let yr = 1; yr <= config.holdPeriod; yr++) {
    const ncf = base * Math.pow(1 + config.revenueGrowthRate, yr - 1);
    years.push({ year: yr, label: `Year ${yr}`, noi: ncf * 1.04, capex: ncf * 0.04, ncf });
  }
  const finalNOI = years[years.length - 1].noi;
  const exitValue = config.exitCapRate > 0 ? finalNOI / config.exitCapRate : 0;
  const sc = exitValue * config.sellingCostPct;
  return {
    years,
    exit: { exitNOI: finalNOI, exitValue, sellingCosts: sc, netSaleProceeds: exitValue - sc },
  };
}

const Y1 = { ncf: 50_000, noi: 52_000 };
const BC = {
  holdPeriod: 5, revenueGrowthRate: 0.03, expenseGrowthRate: 0.025,
  exitCapRate: 0.075, sellingCostPct: 0.03,
};
const EQ = {
  equityInvested: 400_000, acquisitionDate: '2026-01-01',
  annualDebtService: [30_000, 30_000, 30_000, 30_000, 30_000],
  debtBalanceAtExit: 500_000, purchasePrice: 900_000,
};

// ─── Tornado Tests ───────────────────────────────────────────────────────────

describe('Tornado Analysis', () => {
  const cfg: TornadoConfig = {
    drivers: getDefaultDrivers(),
    target: 'irr',
    discountRate: 10,
  };

  const tornado = computeTornado(Y1, mockEngine, BC, EQ, cfg);

  it('should return sorted drivers by spread', () => {
    for (let i = 1; i < tornado.drivers.length; i++) {
      expect(tornado.drivers[i - 1].spread).toBeGreaterThanOrEqual(tornado.drivers[i].spread);
    }
  });

  it('increasing purchase price should reduce IRR', () => {
    const ppDriver = tornado.drivers.find(d => d.driver === 'Purchase Price');
    expect(ppDriver).toBeDefined();
    // high = +5% price → lower IRR (more equity, same returns)
    // low = -5% price → higher IRR
    expect(ppDriver!.low).toBeGreaterThan(ppDriver!.high);
  });

  it('increasing exit cap should reduce IRR', () => {
    const ecDriver = tornado.drivers.find(d => d.driver === 'Exit Cap Rate');
    expect(ecDriver).toBeDefined();
    // Higher exit cap → lower exit value → lower IRR
    expect(ecDriver!.low).toBeGreaterThan(ecDriver!.high);
  });

  it('increasing revenue growth should increase IRR', () => {
    const rgDriver = tornado.drivers.find(d => d.driver === 'Revenue Growth');
    expect(rgDriver).toBeDefined();
    // Higher growth → higher NOI → higher IRR
    expect(rgDriver!.high).toBeGreaterThan(rgDriver!.low);
  });

  it('all drivers should have finite values', () => {
    for (const d of tornado.drivers) {
      expect(isFinite(d.low)).toBe(true);
      expect(isFinite(d.base)).toBe(true);
      expect(isFinite(d.high)).toBe(true);
    }
  });
});

// ─── Attribution Tests ───────────────────────────────────────────────────────

describe('Attribution Analysis', () => {
  // Generate synthetic MC samples with known relationships
  function generateSyntheticSamples(n: number): MCAttributionSample[] {
    const samples: MCAttributionSample[] = [];
    for (let i = 0; i < n; i++) {
      const growthDelta = (Math.random() - 0.5) * 4;
      const exitCapDelta = (Math.random() - 0.5) * 1.5;
      const saleCostDelta = (Math.random() - 0.5) * 1;
      const priceDelta = (Math.random() - 0.5) * 10;

      // IRR positively correlated with growth, negatively with exit cap and price
      const irr = 12 + growthDelta * 2 - exitCapDelta * 3 - priceDelta * 0.5 + saleCostDelta * 0.3;
      const npv = 50000 + growthDelta * 10000 - exitCapDelta * 20000 - priceDelta * 5000;

      samples.push({
        inputs: { revenueGrowthDelta: growthDelta, exitCapDelta, saleCostDelta, priceDelta },
        irr,
        npv,
      });
    }
    return samples;
  }

  const samples = generateSyntheticSamples(500);
  const attribution = computeAttribution(samples, 'irr');

  it('should return ranked drivers', () => {
    expect(attribution.drivers.length).toBe(4);
    for (let i = 1; i < attribution.drivers.length; i++) {
      expect(attribution.drivers[i - 1].importance).toBeGreaterThanOrEqual(attribution.drivers[i].importance);
    }
  });

  it('should have importances summing to ~1', () => {
    const total = attribution.drivers.reduce((s, d) => s + d.importance, 0);
    expect(total).toBeCloseTo(1, 1);
  });

  it('should have reasonable R²', () => {
    // With synthetic linear data, R² should be high
    expect(attribution.r2).toBeGreaterThan(0.5);
  });

  it('revenue growth should be positive direction', () => {
    const rg = attribution.drivers.find(d => d.driver === 'Revenue Growth');
    expect(rg?.direction).toBe('positive');
  });

  it('exit cap should be negative direction', () => {
    const ec = attribution.drivers.find(d => d.driver === 'Exit Cap Rate');
    expect(ec?.direction).toBe('negative');
  });

  it('should warn with too few samples', () => {
    const smallResult = computeAttribution(generateSyntheticSamples(10), 'irr');
    expect(smallResult.notes.some(n => n.includes('WARNING'))).toBe(true);
  });
});

// ─── Memo Generator Tests ────────────────────────────────────────────────────

describe('Memo Generator', () => {
  const scenarios = runScenarioAnalysis(Y1, mockEngine, BC, EQ, 10, undefined, 12);

  const memoInput: MemoInput = {
    projectName: 'Test Property',
    assetClass: 'str',
    base: scenarios.base,
    upside: scenarios.upside,
    downside: scenarios.downside,
    expectedCase: scenarios.expectedCase,
    purchasePrice: 900_000,
    equityInvested: 400_000,
    holdPeriodYears: 5,
    totalDebt: 500_000,
    hurdleIRR: 12,
    discountRate: 10,
  };

  const tones: MemoTone[] = ['concise', 'ic', 'lender'];

  for (const tone of tones) {
    describe(`Tone: ${tone}`, () => {
      const memo = generateMemo(memoInput, tone);

      it('should produce a headline', () => {
        expect(memo.headline).toBeTruthy();
        expect(memo.headline.length).toBeGreaterThan(0);
      });

      it('should produce an executive summary', () => {
        expect(memo.executiveSummary).toBeTruthy();
        expect(memo.executiveSummary.length).toBeGreaterThan(20);
      });

      it('should have sections', () => {
        expect(memo.sections.length).toBeGreaterThan(0);
        for (const section of memo.sections) {
          expect(section.title).toBeTruthy();
          expect(section.bullets.length).toBeGreaterThan(0);
        }
      });

      it('should set correct tone', () => {
        expect(memo.tone).toBe(tone);
      });
    });
  }

  it('should be deterministic (same inputs → identical memo)', () => {
    const memo1 = generateMemo(memoInput, 'concise');
    const memo2 = generateMemo(memoInput, 'concise');
    expect(memo1.headline).toBe(memo2.headline);
    expect(memo1.executiveSummary).toBe(memo2.executiveSummary);
    expect(memo1.sections.length).toBe(memo2.sections.length);
    for (let i = 0; i < memo1.sections.length; i++) {
      expect(memo1.sections[i].title).toBe(memo2.sections[i].title);
      expect(memo1.sections[i].bullets).toEqual(memo2.sections[i].bullets);
    }
  });

  it('IC memo should have more sections than concise', () => {
    const concise = generateMemo(memoInput, 'concise');
    const ic = generateMemo(memoInput, 'ic');
    expect(ic.sections.length).toBeGreaterThan(concise.sections.length);
  });

  it('appendix should contain key assumptions', () => {
    const memo = generateMemo(memoInput, 'ic');
    expect(memo.appendix).toBeDefined();
    expect(memo.appendix!.assumptions.purchasePrice).toBe(900_000);
    expect(memo.appendix!.keyStats.baseIRR).toBeDefined();
  });
});
