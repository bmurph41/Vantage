/**
 * Forward Curve Engine — shared/debt/forward-curve-engine.ts
 */
import type { DebtEngineInput, MonthlyScheduleRow } from './debt-engine';

export interface ForwardRatePoint { monthIndex: number; indexRateBps: number; }
export interface ForwardCurveConfig {
  source: 'flat' | 'custom' | 'sofr_futures';
  customPoints?: ForwardRatePoint[];
  futuresCurve?: ForwardRatePoint[];
  parallelShiftBps?: number;
  indexCapBps?: number;
}
export interface FloatingRateScenario { name: string; curve: ForwardCurveConfig; }

export function projectForwardRates(config: ForwardCurveConfig, termMonths: number, fallbackIndexBps: number): number[] {
  const shift = config.parallelShiftBps ?? 0;
  const cap = config.indexCapBps ?? Infinity;

  if (config.source === 'flat') return Array.from({ length: termMonths }, () => Math.min(fallbackIndexBps + shift, cap));

  let points: ForwardRatePoint[];
  if (config.source === 'custom' && config.customPoints?.length) points = [...config.customPoints].sort((a, b) => a.monthIndex - b.monthIndex);
  else if (config.source === 'sofr_futures' && config.futuresCurve?.length) points = [...config.futuresCurve].sort((a, b) => a.monthIndex - b.monthIndex);
  else return Array.from({ length: termMonths }, () => Math.min(fallbackIndexBps + shift, cap));

  const rates: number[] = [];
  for (let m = 0; m < termMonths; m++) {
    let rate: number;
    if (m <= points[0].monthIndex) rate = points[0].indexRateBps;
    else if (m >= points[points.length - 1].monthIndex) rate = points[points.length - 1].indexRateBps;
    else {
      let lo = points[0], hi = points[points.length - 1];
      for (let i = 0; i < points.length - 1; i++) { if (points[i].monthIndex <= m && points[i+1].monthIndex >= m) { lo = points[i]; hi = points[i+1]; break; } }
      const span = hi.monthIndex - lo.monthIndex;
      const t = span > 0 ? (m - lo.monthIndex) / span : 0;
      rate = lo.indexRateBps + t * (hi.indexRateBps - lo.indexRateBps);
    }
    rates.push(Math.min(Math.round(rate + shift), cap));
  }
  return rates;
}

export function computeLoanScheduleWithCurve(input: DebtEngineInput, curveConfig: ForwardCurveConfig): MonthlyScheduleRow[] {
  if (input.rateType !== 'floating') {
    const { computeLoanSchedule } = require('./debt-engine');
    return computeLoanSchedule(input);
  }

  const fallbackIndex = input.initialIndexBps ?? 0;
  const spread = input.spreadBps ?? 0;
  const floor = input.indexFloorBps ?? 0;
  const forwardRates = projectForwardRates(curveConfig, input.termMonths, fallbackIndex);

  let balance = input.loanAmount;
  if (input.capitalizeOriginationFees) {
    balance += input.loanAmount * (input.originationFeePct ?? 0.01);
    balance += (input.underwritingFee ?? 0) + (input.legalFee ?? 0) + (input.appraisalFee ?? 0) + (input.otherClosingCosts ?? 0);
  }

  const schedule: MonthlyScheduleRow[] = [];
  for (let m = 0; m < input.termMonths; m++) {
    const beginBal = balance;
    const isIO = m < input.interestOnlyMonths;
    const indexRate = Math.max(forwardRates[m], floor);
    const allInBps = indexRate + spread;
    const mr = allInBps / 10000 / 12;
    const interest = beginBal * mr;

    let principal: number, ds: number;
    if (isIO) { principal = 0; ds = interest; }
    else {
      const rem = input.amortMonths - (m - input.interestOnlyMonths);
      if (rem <= 1) { principal = beginBal; ds = principal + interest; }
      else if (mr === 0) { ds = beginBal / rem + interest; principal = ds - interest; }
      else { ds = beginBal * (mr * Math.pow(1+mr, rem)) / (Math.pow(1+mr, rem) - 1); principal = Math.max(0, ds - interest); }
    }

    const endBal = Math.max(0, beginBal - principal);
    schedule.push({ monthIndex: m, beginBal: Math.round(beginBal*100)/100, rateBps: allInBps, interest: Math.round(interest*100)/100, principal: Math.round(principal*100)/100, debtService: Math.round(ds*100)/100, endBal: Math.round(endBal*100)/100, isIO });
    balance = endBal;
  }
  return schedule;
}

export interface FloatingRateAnalysis {
  scenarios: Array<{ name: string; year1DebtService: number; year1WeightedRate: number; maxRate: number; minRate: number; totalInterest: number; exitBalance: number }>;
  rateRange: { bestCaseYear1DS: number; worstCaseYear1DS: number; spreadDollar: number };
}

export function analyzeFloatingRateScenarios(input: DebtEngineInput, scenarios: FloatingRateScenario[], exitMonthIndex?: number): FloatingRateAnalysis {
  const exit = exitMonthIndex ?? input.termMonths - 1;
  const results: FloatingRateAnalysis['scenarios'] = [];

  for (const s of scenarios) {
    const sched = computeLoanScheduleWithCurve(input, s.curve);
    const yr1 = sched.slice(0, Math.min(12, sched.length));
    const rates = sched.map(r => r.rateBps);
    results.push({
      name: s.name,
      year1DebtService: Math.round(yr1.reduce((x,r) => x+r.debtService, 0)*100)/100,
      year1WeightedRate: Math.round(yr1.reduce((x,r) => x+r.rateBps, 0) / yr1.length),
      maxRate: Math.max(...rates), minRate: Math.min(...rates),
      totalInterest: Math.round(sched.reduce((x,r) => x+r.interest, 0)*100)/100,
      exitBalance: exit < sched.length ? sched[exit].endBal : (sched[sched.length-1]?.endBal ?? 0),
    });
  }

  const yr1s = results.map(r => r.year1DebtService);
  return { scenarios: results, rateRange: { bestCaseYear1DS: Math.min(...yr1s), worstCaseYear1DS: Math.max(...yr1s), spreadDollar: Math.round((Math.max(...yr1s)-Math.min(...yr1s))*100)/100 } };
}
