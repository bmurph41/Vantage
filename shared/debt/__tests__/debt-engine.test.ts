import { describe, it, expect } from 'vitest';
import {
  computeLoanSchedule,
  computeLoanFeesAtClose,
  computeLoanPayoffAtExit,
  computeAnnualDebtService,
  computeDSCR,
  computeLTV,
  type DebtEngineInput as LoanInput,
} from '../debt-engine';

const baseLoan: LoanInput = {
  loanAmount: 1_000_000,
  termMonths: 60,
  amortMonths: 300,
  interestOnlyMonths: 0,
  rateType: 'fixed',
  fixedRate: 0.0675,
  capitalizeOriginationFees: false,
  originationFeePct: 0.01,
  underwritingFee: 5000,
  legalFee: 3000,
  appraisalFee: 2000,
  otherClosingCosts: 1000,
  exitFeePct: 0,
  prepayType: 'none',
};

describe('computeLoanFeesAtClose', () => {
  it('computes fees paid from cash at close', () => {
    const fees = computeLoanFeesAtClose(baseLoan);
    expect(fees.originationFee).toBe(10000);
    expect(fees.totalClosingFees).toBe(21000);
    expect(fees.financedFees).toBe(0);
    expect(fees.cashFees).toBe(21000);
  });

  it('capitalizes only the origination fee into loan balance', () => {
    const fees = computeLoanFeesAtClose({ ...baseLoan, capitalizeOriginationFees: true });
    expect(fees.financedFees).toBe(10000);
    expect(fees.cashFees).toBe(11000);
  });
});

describe('computeLoanSchedule — IO-only loan', () => {
  it('produces 12 months of IO with zero principal', () => {
    const ioLoan: LoanInput = {
      ...baseLoan,
      termMonths: 12,
      interestOnlyMonths: 12,
    };
    const schedule = computeLoanSchedule(ioLoan);
    expect(schedule).toHaveLength(12);
    schedule.forEach(row => {
      expect(row.principal).toBe(0);
      expect(row.endBal).toBe(1_000_000);
      expect(row.interest).toBeGreaterThan(0);
      expect(row.debtService).toBe(row.interest);
    });
  });
});

describe('computeLoanSchedule — Amortizing loan', () => {
  it('produces decreasing balance with stable payment', () => {
    const schedule = computeLoanSchedule(baseLoan);
    expect(schedule).toHaveLength(60);
    
    expect(schedule[0].beginBal).toBe(1_000_000);
    expect(schedule[schedule.length - 1].endBal).toBeGreaterThan(0);
    
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i].endBal).toBeLessThan(schedule[i - 1].endBal);
    }
    
    const firstPayment = schedule[0].debtService;
    const lastPayment = schedule[schedule.length - 1].debtService;
    expect(Math.abs(firstPayment - lastPayment)).toBeLessThan(0.02);
  });

  it('end balance never goes negative', () => {
    const schedule = computeLoanSchedule(baseLoan);
    schedule.forEach(row => {
      expect(row.endBal).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('computeLoanSchedule — Capitalized fees', () => {
  it('increases beginning balance by the financed origination fee', () => {
    const capLoan: LoanInput = { ...baseLoan, capitalizeOriginationFees: true };
    const schedule = computeLoanSchedule(capLoan);
    expect(schedule[0].beginBal).toBe(1_010_000);
  });

  it('non-capitalized starts at loan amount', () => {
    const schedule = computeLoanSchedule(baseLoan);
    expect(schedule[0].beginBal).toBe(1_000_000);
  });
});

describe('computeLoanSchedule — IO then Amort', () => {
  it('has IO for first 12 months, then amortizes', () => {
    const loan: LoanInput = { ...baseLoan, interestOnlyMonths: 12 };
    const schedule = computeLoanSchedule(loan);
    
    for (let i = 0; i < 12; i++) {
      expect(schedule[i].principal).toBe(0);
    }
    expect(schedule[12].principal).toBeGreaterThan(0);
  });
});

describe('computeLoanSchedule — Floating rate', () => {
  it('uses initialIndexBps + spreadBps for rate', () => {
    const floatingLoan: LoanInput = {
      ...baseLoan,
      rateType: 'floating',
      fixedRate: undefined,
      initialIndexBps: 500,
      spreadBps: 200,
    };
    const schedule = computeLoanSchedule(floatingLoan);
    expect(schedule[0].rateBps).toBe(700);
    const expectedMonthlyRate = 0.07 / 12;
    const expectedInterest = Math.round(1_000_000 * expectedMonthlyRate * 100) / 100;
    expect(schedule[0].interest).toBe(expectedInterest);
  });
});

describe('computeLoanPayoffAtExit', () => {
  it('returns correct payoff at month 36', () => {
    const schedule = computeLoanSchedule(baseLoan);
    const payoff = computeLoanPayoffAtExit(baseLoan, schedule, 36);
    
    expect(payoff.payoffBalance).toBe(schedule[36].endBal);
    expect(payoff.exitFees).toBe(0);
    expect(payoff.prepayPenalty).toBe(0);
    expect(payoff.totalPayoff).toBe(payoff.payoffBalance);
  });

  it('includes exit fee when set', () => {
    const loanWithExit: LoanInput = { ...baseLoan, exitFeePct: 0.01 };
    const schedule = computeLoanSchedule(loanWithExit);
    const payoff = computeLoanPayoffAtExit(loanWithExit, schedule, 36);
    
    expect(payoff.exitFees).toBeCloseTo(payoff.payoffBalance * 0.01, 1);
    expect(payoff.totalPayoff).toBeCloseTo(payoff.payoffBalance + payoff.exitFees, 1);
  });

  it('computes stepdown prepay penalty using the schedule as decimal fractions', () => {
    const stepdownLoan: LoanInput = {
      ...baseLoan,
      prepayType: 'stepdown',
      stepdownSchedule: [0.05, 0.04, 0.03, 0.02, 0.01],
    };
    const schedule = computeLoanSchedule(stepdownLoan);
    const payoff = computeLoanPayoffAtExit(stepdownLoan, schedule, 24);

    expect(payoff.prepayPenalty).toBeCloseTo(payoff.payoffBalance * 0.03, 1);
  });
});

describe('computeAnnualDebtService', () => {
  it('aggregates monthly to annual', () => {
    const schedule = computeLoanSchedule(baseLoan);
    const annual = computeAnnualDebtService(schedule);
    
    expect(annual.length).toBe(5);
    
    const totalInterest = schedule.reduce((s, r) => s + r.interest, 0);
    const annualInterest = annual.reduce((s, r) => s + r.interest, 0);
    expect(Math.abs(totalInterest - annualInterest)).toBeLessThan(1);
  });
});

describe('computeDSCR', () => {
  it('calculates DSCR correctly', () => {
    expect(computeDSCR(100000, 70000)).toBeCloseTo(1.43, 1);
    expect(computeDSCR(50000, 70000)).toBeCloseTo(0.71, 1);
  });

  it('returns Infinity for positive NOI with zero debt service', () => {
    expect(computeDSCR(100000, 0)).toBe(Infinity);
  });

  it('returns 0 when both NOI and debt service are zero', () => {
    expect(computeDSCR(0, 0)).toBe(0);
  });
});

describe('computeLTV', () => {
  it('returns a decimal ratio (not percent)', () => {
    expect(computeLTV(700000, 1000000)).toBe(0.7);
  });

  it('returns 0 for zero property value', () => {
    expect(computeLTV(700000, 0)).toBe(0);
  });
});
