/**
 * Covenant Monitor — shared/debt/covenant-monitor.ts
 */
import type { AnnualDebtSummary } from './debt-engine';
import { computeDSCR, computeLTV, computeDebtYield } from './debt-engine';

export type CovenantStatus = 'green' | 'yellow' | 'red';

export interface CovenantThresholds {
  minDscr: number;
  dscrCautionBuffer: number;
  maxLtv: number;
  ltvCautionBuffer: number;
  minDebtYield?: number;
}

export interface CovenantCheckResult {
  overall: CovenantStatus;
  dscr: { value: number; status: CovenantStatus; threshold: number; cushion: number; cushionPct: number };
  ltv: { value: number; status: CovenantStatus; threshold: number; headroom: number; headroomPct: number };
  debtYield?: { value: number; status: CovenantStatus; threshold: number };
  warnings: string[];
}

export interface CovenantTimeline {
  years: Array<{ year: number; dscr: number; dscrStatus: CovenantStatus; ltv: number; ltvStatus: CovenantStatus; debtYield: number; debtYieldStatus: CovenantStatus; overall: CovenantStatus }>;
  firstBreachYear: number | null;
  overallStatus: CovenantStatus;
}

export const DEFAULT_THRESHOLDS: CovenantThresholds = {
  minDscr: 1.25, dscrCautionBuffer: 0.10, maxLtv: 0.75, ltvCautionBuffer: 0.05, minDebtYield: 0.08,
};

export function checkCovenants(
  noi: number, annualDebtService: number, loanBalance: number, propertyValue: number,
  thresholds: CovenantThresholds = DEFAULT_THRESHOLDS,
): CovenantCheckResult {
  const warnings: string[] = [];

  const dscrValue = computeDSCR(noi, annualDebtService);
  const dscrCushion = dscrValue - thresholds.minDscr;
  const dscrCushionPct = thresholds.minDscr > 0 ? dscrCushion / thresholds.minDscr : 0;
  let dscrStatus: CovenantStatus = 'green';
  if (dscrValue < thresholds.minDscr) { dscrStatus = 'red'; warnings.push(`DSCR ${dscrValue.toFixed(2)}x breaches min ${thresholds.minDscr.toFixed(2)}x`); }
  else if (dscrValue < thresholds.minDscr + thresholds.dscrCautionBuffer) { dscrStatus = 'yellow'; warnings.push(`DSCR ${dscrValue.toFixed(2)}x in caution zone`); }

  const ltvValue = computeLTV(loanBalance, propertyValue);
  const ltvHeadroom = thresholds.maxLtv - ltvValue;
  const ltvHrPct = thresholds.maxLtv > 0 ? ltvHeadroom / thresholds.maxLtv : 0;
  let ltvStatus: CovenantStatus = 'green';
  if (ltvValue > thresholds.maxLtv) { ltvStatus = 'red'; warnings.push(`LTV ${(ltvValue*100).toFixed(1)}% breaches max ${(thresholds.maxLtv*100).toFixed(1)}%`); }
  else if (ltvValue > thresholds.maxLtv - thresholds.ltvCautionBuffer) { ltvStatus = 'yellow'; warnings.push(`LTV ${(ltvValue*100).toFixed(1)}% in caution zone`); }

  let debtYieldResult: CovenantCheckResult['debtYield'];
  if (thresholds.minDebtYield != null) {
    const dy = computeDebtYield(noi, loanBalance);
    let dyStatus: CovenantStatus = 'green';
    if (dy < thresholds.minDebtYield) { dyStatus = 'red'; warnings.push(`Debt yield ${(dy*100).toFixed(2)}% below min ${(thresholds.minDebtYield*100).toFixed(2)}%`); }
    debtYieldResult = { value: dy, status: dyStatus, threshold: thresholds.minDebtYield };
  }

  const statuses = [dscrStatus, ltvStatus]; if (debtYieldResult) statuses.push(debtYieldResult.status);
  const overall: CovenantStatus = statuses.includes('red') ? 'red' : statuses.includes('yellow') ? 'yellow' : 'green';

  return {
    overall,
    dscr: { value: dscrValue === Infinity ? 99.99 : Math.round(dscrValue*100)/100, status: dscrStatus, threshold: thresholds.minDscr, cushion: Math.round(dscrCushion*100)/100, cushionPct: Math.round(dscrCushionPct*10000)/10000 },
    ltv: { value: Math.round(ltvValue*10000)/10000, status: ltvStatus, threshold: thresholds.maxLtv, headroom: Math.round(ltvHeadroom*10000)/10000, headroomPct: Math.round(ltvHrPct*10000)/10000 },
    debtYield: debtYieldResult,
    warnings,
  };
}

export function buildCovenantTimeline(
  annualSummary: AnnualDebtSummary[], baseNoi: number, noiGrowthRate: number,
  propertyValue: number, propertyAppreciationRate: number,
  thresholds: CovenantThresholds = DEFAULT_THRESHOLDS,
): CovenantTimeline {
  const years: CovenantTimeline['years'] = [];
  let firstBreachYear: number | null = null;
  let worstStatus: CovenantStatus = 'green';

  for (const yr of annualSummary) {
    const noi = baseNoi * Math.pow(1 + noiGrowthRate, yr.year - 1);
    const pv = propertyValue * Math.pow(1 + propertyAppreciationRate, yr.year - 1);
    const check = checkCovenants(noi, yr.totalDebtService, yr.endingBalance, pv, thresholds);
    years.push({ year: yr.year, dscr: check.dscr.value, dscrStatus: check.dscr.status, ltv: check.ltv.value, ltvStatus: check.ltv.status, debtYield: check.debtYield?.value ?? 0, debtYieldStatus: check.debtYield?.status ?? 'green', overall: check.overall });
    if (check.overall === 'red' && firstBreachYear === null) firstBreachYear = yr.year;
    if (check.overall === 'red') worstStatus = 'red';
    else if (check.overall === 'yellow' && worstStatus === 'green') worstStatus = 'yellow';
  }

  return { years, firstBreachYear, overallStatus: worstStatus };
}
