import { describe, it, expect } from 'vitest';
import { computeLoanSchedule, computeLoanFeesAtClose, computeAnnualDebtService, computeDSCR, computeLTV, computeDebtYield } from '../debt-engine';
import type { DebtEngineInput } from '../debt-engine';
import { canonicalToLoanScheduleResult, computeProjectExitDebt, convertLoansToDebtSchedules } from '../exit-adapter';
import { computeRefiPlan, compareRefiVsHold } from '../refi-engine';
import { computeStressTest } from '../stress-test-engine';
import { computeSimpleWaterfall } from '../fund-waterfall-adapter';
import { checkCovenants, buildCovenantTimeline, DEFAULT_THRESHOLDS } from '../covenant-monitor';
import { projectForwardRates, computeLoanScheduleWithCurve, analyzeFloatingRateScenarios } from '../forward-curve-engine';

const STD: DebtEngineInput = { loanAmount: 5e6, termMonths: 120, amortMonths: 300, interestOnlyMonths: 24, rateType: 'fixed', fixedRate: 0.065, capitalizeOriginationFees: false, originationFeePct: 0.01, prepayType: 'none' };
const FLT: DebtEngineInput = { loanAmount: 3e6, termMonths: 60, amortMonths: 360, interestOnlyMonths: 12, rateType: 'floating', initialIndexBps: 425, spreadBps: 200, indexFloorBps: 300, capitalizeOriginationFees: false, prepayType: 'none' };
const PV = 7.5e6;

describe('Phase 3: Exit Adapter', () => {
  it('converts to LoanScheduleResult', () => {
    const r = canonicalToLoanScheduleResult(STD);
    expect(r.schedule).toHaveLength(120);
    expect(r.schedule[0].period).toBe(1);
    expect(r.hasBalloon).toBe(true);
    expect(r.balloonAmount).toBeGreaterThan(0);
    expect(Object.keys(r.principalBalancesByYear)).toHaveLength(10);
  });
  it('multi-loan exit payoff', () => {
    const p = computeProjectExitDebt([STD, FLT], 59);
    expect(p.loanPayoffs).toHaveLength(2);
    expect(p.totalPayoff).toBeGreaterThanOrEqual(p.outstandingBalance);
  });
  it('convertLoansToDebtSchedules', () => {
    const s = convertLoansToDebtSchedules([STD, FLT]);
    expect(s).toHaveLength(2);
    expect(s[0].schedule.length).toBe(120);
    expect(s[1].schedule.length).toBe(60);
  });
});

describe('Phase 4: Refinance', () => {
  it('basic refi plan', () => {
    const p = computeRefiPlan(STD, { triggerMonthIndex: 36, newLoanTerms: { rateType: 'fixed', fixedRate: 0.055, termMonths: 120, amortMonths: 300, interestOnlyMonths: 0 }, cashOutAllowed: false });
    expect(p.existingLoanPayoff.payoffBalance).toBeGreaterThan(0);
    expect(p.newLoan.effectiveRate).toBe(0.055);
    expect(p.refiCashflow.isTaxFree).toBe(true);
    expect(p.mergedSchedule.length).toBeGreaterThan(120);
  });
  it('LTV cap', () => {
    const p = computeRefiPlan(STD, { triggerMonthIndex: 36, newLoanTerms: { loanAmount: 10e6, rateType: 'fixed', fixedRate: 0.055, termMonths: 120, amortMonths: 300, interestOnlyMonths: 0 }, maxLtvPct: 0.75, propertyValueAtRefi: 8e6, cashOutAllowed: true });
    expect(p.newLoan.loanAmount).toBe(6e6);
    expect(p.warnings.length).toBeGreaterThan(0);
  });
  it('cash-out positive', () => {
    const p = computeRefiPlan(STD, { triggerMonthIndex: 36, newLoanTerms: { loanAmount: 6e6, rateType: 'fixed', fixedRate: 0.055, termMonths: 120, amortMonths: 300, interestOnlyMonths: 0 }, cashOutAllowed: true });
    expect(p.refiCashflow.netCashOut).toBeGreaterThan(0);
  });
  it('hold vs refi savings', () => {
    const c = compareRefiVsHold(STD, { triggerMonthIndex: 36, newLoanTerms: { rateType: 'fixed', fixedRate: 0.045, termMonths: 120, amortMonths: 300, interestOnlyMonths: 0 }, cashOutAllowed: false }, 119);
    expect(c.savings.interestSaved).toBeGreaterThan(0);
  });
});

describe('Phase 5: Stress Test', () => {
  it('matrix dimensions', () => {
    const r = computeStressTest([STD], { rateShocksBps: [0, 100, 200], noiDrops: [0, -0.10, -0.20], baseNoi: 525e3, propertyValue: PV });
    expect(r.matrix.dscrValues).toHaveLength(3);
    expect(r.matrix.dscrValues[0]).toHaveLength(3);
    expect(r.breachSummary.totalScenarios).toBeGreaterThan(0);
  });
  it('rate shock lowers DSCR', () => {
    const r = computeStressTest([STD], { rateShocksBps: [0, 200], noiDrops: [0], baseNoi: 525e3, propertyValue: PV });
    expect(r.matrix.dscrValues[1][0]).toBeLessThan(r.matrix.dscrValues[0][0]);
  });
  it('NOI drop lowers DSCR', () => {
    const r = computeStressTest([STD], { rateShocksBps: [0], noiDrops: [0, -0.20], baseNoi: 525e3, propertyValue: PV });
    expect(r.matrix.dscrValues[0][1]).toBeLessThan(r.matrix.dscrValues[0][0]);
  });
  it('break-even NOI is negative', () => {
    const r = computeStressTest([STD], { rateShocksBps: [0], noiDrops: [0], baseNoi: 525e3, propertyValue: PV, minDscrThreshold: 1.20 });
    if (r.breachSummary.breakEvenNoiDrop !== null) expect(r.breachSummary.breakEvenNoiDrop).toBeLessThan(0);
  });
});

describe('Phase 6: Fund Waterfall', () => {
  const cf = {
    equityInvested: 2.5e6, investmentDate: '2024-01-01',
    annualCashFlows: [1,2,3,4,5].map(y => ({ year: y, date: `${2023+y}-12-31`, amount: 180e3 + y * 20e3 })),
    exitProceeds: { date: '2028-12-31', grossSalePrice: 9e6, loanPayoff: 4.5e6, sellingFees: 360e3, prepayPenalty: 45e3, netProceeds: 4.095e6 },
  };
  const cfg = { preferredReturn: 0.08, preferredReturnCompounding: 'annual' as const, catchUpPercent: 1.0, catchUpTarget: 0.20, structureType: 'deal_by_deal' as const, clawbackEnabled: false, promoteTiers: [{ name: 'T1', irrHurdle: 0.08, gpSplit: 0.20, lpSplit: 0.80 }], gpCommitmentPercent: 0.05 };

  it('GP/LP equity split', () => {
    const r = computeSimpleWaterfall(cf, cfg);
    expect(r.gpEquity).toBe(125e3);
    expect(r.lpEquity).toBe(2.375e6);
  });
  it('LP absolute > GP', () => {
    const r = computeSimpleWaterfall(cf, cfg);
    expect(r.metrics.lpTotalDistributed).toBeGreaterThan(r.metrics.gpTotalDistributed);
  });
  it('GP multiple >= LP (promote)', () => {
    const r = computeSimpleWaterfall(cf, cfg);
    expect(r.metrics.gpEquityMultiple).toBeGreaterThanOrEqual(r.metrics.lpEquityMultiple);
  });
});

describe('Item 6: Covenant Monitor', () => {
  it('green when healthy', () => {
    const r = checkCovenants(600e3, 400e3, 5e6, 10e6);
    expect(r.overall).toBe('green');
    expect(r.dscr.value).toBeCloseTo(1.5, 1);
    expect(r.ltv.value).toBeCloseTo(0.5, 2);
  });
  it('red when DSCR breached', () => {
    const r = checkCovenants(400e3, 400e3, 5e6, 10e6);
    expect(r.dscr.status).toBe('red');
    expect(r.overall).toBe('red');
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it('red when LTV breached', () => {
    const r = checkCovenants(600e3, 400e3, 8e6, 10e6);
    expect(r.ltv.status).toBe('red');
  });
  it('yellow caution zone', () => {
    const r = checkCovenants(510e3, 400e3, 5e6, 10e6); // DSCR=1.275
    expect(r.dscr.status).toBe('yellow');
  });
  it('timeline tracks yearly status', () => {
    const sched = computeAnnualDebtService(computeLoanSchedule(STD));
    const tl = buildCovenantTimeline(sched, 525e3, 0.02, PV, 0.02);
    expect(tl.years.length).toBe(10);
    expect(tl.years[0].dscr).toBeGreaterThan(0);
  });
});

describe('Item 8: Forward Curves', () => {
  it('flat returns uniform rates', () => {
    const r = projectForwardRates({ source: 'flat' }, 60, 425);
    expect(r).toHaveLength(60);
    expect(r.every(x => x === 425)).toBe(true);
  });
  it('custom interpolates', () => {
    const r = projectForwardRates({ source: 'custom', customPoints: [{ monthIndex: 0, indexRateBps: 400 }, { monthIndex: 24, indexRateBps: 300 }] }, 36, 400);
    expect(r[0]).toBe(400);
    expect(r[12]).toBe(350);
    expect(r[24]).toBe(300);
    expect(r[30]).toBe(300); // holds flat after last point
  });
  it('parallel shift', () => {
    const base = projectForwardRates({ source: 'flat' }, 12, 400);
    const shifted = projectForwardRates({ source: 'flat', parallelShiftBps: 50 }, 12, 400);
    shifted.forEach((v, i) => expect(v).toBe(base[i] + 50));
  });
  it('cap enforced', () => {
    const r = projectForwardRates({ source: 'flat', parallelShiftBps: 200, indexCapBps: 500 }, 12, 425);
    expect(r.every(x => x <= 500)).toBe(true);
  });
  it('curve schedule has varying rates', () => {
    const s = computeLoanScheduleWithCurve(FLT, { source: 'custom', customPoints: [{ monthIndex: 0, indexRateBps: 425 }, { monthIndex: 48, indexRateBps: 275 }] });
    expect(s).toHaveLength(60);
    expect(s[0].rateBps).toBeGreaterThan(s[48].rateBps);
  });
  it('floor enforced on curve', () => {
    const s = computeLoanScheduleWithCurve(FLT, { source: 'custom', customPoints: [{ monthIndex: 0, indexRateBps: 100 }, { monthIndex: 59, indexRateBps: 100 }] });
    expect(s[0].rateBps).toBeGreaterThanOrEqual(500); // floor 300 + spread 200
  });
  it('multi-scenario analysis', () => {
    const a = analyzeFloatingRateScenarios(FLT, [
      { name: 'Base', curve: { source: 'flat' } },
      { name: '+100', curve: { source: 'flat', parallelShiftBps: 100 } },
    ]);
    expect(a.scenarios).toHaveLength(2);
    expect(a.rateRange.worstCaseYear1DS).toBeGreaterThan(a.rateRange.bestCaseYear1DS);
  });
});
