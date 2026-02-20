/**
 * Stress Test Engine — shared/debt/stress-test-engine.ts
 */
import type { DebtEngineInput, MonthlyScheduleRow, AnnualDebtSummary } from './debt-engine';
import { computeLoanSchedule, computeAnnualDebtService, computeDSCR, computeLTV, computeDebtYield } from './debt-engine';

export interface StressTestConfig {
  rateShocksBps: number[];
  noiDrops: number[];
  ioExtensionMonths?: number[];
  altAmortMonths?: number[];
  minDscrThreshold?: number;
  maxLtvThreshold?: number;
  baseNoi: number;
  noiGrowthRate?: number;
  propertyValue: number;
  exitMonthIndex?: number;
}

export interface StressScenario {
  label: string;
  rateShockBps: number;
  noiDrop: number;
  ioExtensionMonths: number;
  amortMonths: number;
}

export interface YearMetrics {
  year: number; noi: number; debtService: number; dscr: number;
  ltv: number; debtYield: number; endingBalance: number; cashFlowAfterDebt: number;
}

export interface StressResult {
  scenario: StressScenario;
  year1: YearMetrics;
  year3: YearMetrics | null;
  year5: YearMetrics | null;
  exitBalance: number;
  totalInterest: number;
  breachesMinDscr: boolean;
  breachesMaxLtv: boolean;
  annualSummary: AnnualDebtSummary[];
}

export interface StressMatrix {
  rateShocksBps: number[];
  noiDrops: number[];
  dscrValues: number[][];
  ltvValues: number[][];
  breaches: boolean[][];
}

export interface BreachSummary {
  totalScenarios: number;
  breachedScenarios: number;
  worstDscr: number;
  worstDscrScenario: string;
  worstLtv: number;
  worstLtvScenario: string;
  breakEvenNoiDrop: number | null;
  breakEvenRateShock: number | null;
}

export interface StressTestResult {
  baseCase: StressResult;
  scenarios: StressResult[];
  matrix: StressMatrix;
  breachSummary: BreachSummary;
}

function applyScenario(loan: DebtEngineInput, s: StressScenario): DebtEngineInput {
  const a = { ...loan };
  if (s.rateShockBps !== 0) {
    if (a.rateType === 'fixed' && a.fixedRate != null) a.fixedRate += s.rateShockBps / 10000;
    else if (a.rateType === 'floating') a.initialIndexBps = (a.initialIndexBps ?? 0) + s.rateShockBps;
  }
  if (s.ioExtensionMonths > 0) a.interestOnlyMonths += s.ioExtensionMonths;
  if (s.amortMonths !== loan.amortMonths) a.amortMonths = s.amortMonths;
  return a;
}

function runScenario(loans: DebtEngineInput[], scenario: StressScenario, config: StressTestConfig, exitMonth: number, minDscr: number, maxLtv: number): StressResult {
  const adjusted = loans.map(l => applyScenario(l, scenario));
  const schedules = adjusted.map(l => computeLoanSchedule(l));
  const maxLen = Math.max(...schedules.map(s => s.length), 0);

  const merged: MonthlyScheduleRow[] = [];
  for (let m = 0; m < maxLen; m++) {
    let ti = 0, tp = 0, tb = 0, te = 0;
    for (const s of schedules) { if (m < s.length) { ti += s[m].interest; tp += s[m].principal; tb += s[m].beginBal; te += s[m].endBal; } }
    merged.push({ monthIndex: m, beginBal: Math.round(tb*100)/100, rateBps: schedules[0]?.[m]?.rateBps??0, interest: Math.round(ti*100)/100, principal: Math.round(tp*100)/100, debtService: Math.round((ti+tp)*100)/100, endBal: Math.round(te*100)/100, isIO: false });
  }

  const annual = computeAnnualDebtService(merged);
  const ng = config.noiGrowthRate ?? 0;

  function ym(yr: number): YearMetrics | null {
    const a = annual.find(x => x.year === yr);
    if (!a) return null;
    const noi = config.baseNoi * (1 + scenario.noiDrop) * Math.pow(1 + ng, yr - 1);
    const dscr = a.totalDebtService > 0 ? Math.round((noi / a.totalDebtService)*100)/100 : 99.99;
    return { year: yr, noi: Math.round(noi*100)/100, debtService: a.totalDebtService, dscr, ltv: computeLTV(a.endingBalance, config.propertyValue), debtYield: computeDebtYield(noi, a.endingBalance), endingBalance: a.endingBalance, cashFlowAfterDebt: Math.round((noi - a.totalDebtService)*100)/100 };
  }

  const y1 = ym(1)!;
  const eb = exitMonth < merged.length ? merged[exitMonth].endBal : (merged[merged.length-1]?.endBal ?? 0);

  return {
    scenario, year1: y1, year3: ym(3), year5: ym(5),
    exitBalance: Math.round(eb*100)/100,
    totalInterest: Math.round(merged.reduce((s,r) => s+r.interest, 0)*100)/100,
    breachesMinDscr: y1.dscr < minDscr, breachesMaxLtv: y1.ltv > maxLtv,
    annualSummary: annual,
  };
}

function buildMatrix(config: StressTestConfig, loans: DebtEngineInput[], minDscr: number, maxLtv: number): StressMatrix {
  const dscr: number[][] = []; const ltv: number[][] = []; const br: boolean[][] = [];
  for (let ri = 0; ri < config.rateShocksBps.length; ri++) {
    dscr[ri] = []; ltv[ri] = []; br[ri] = [];
    for (let ni = 0; ni < config.noiDrops.length; ni++) {
      const adj = loans.map(l => { const a={...l}; const sh=config.rateShocksBps[ri]; if(a.rateType==='fixed'&&a.fixedRate!=null) a.fixedRate+=sh/10000; else if(a.rateType==='floating') a.initialIndexBps=(a.initialIndexBps??0)+sh; return a; });
      const scheds = adj.map(l => computeLoanSchedule(l));
      const yr1DS = scheds.reduce((sum, s) => sum + s.slice(0,Math.min(12,s.length)).reduce((x,r)=>x+r.debtService,0), 0);
      const yr1Bal = scheds.reduce((sum, s) => sum + (s[11]?.endBal ?? s[s.length-1]?.endBal ?? 0), 0);
      const noi = config.baseNoi * (1 + config.noiDrops[ni]);
      const d = yr1DS > 0 ? Math.round((noi/yr1DS)*100)/100 : 99.99;
      const l = config.propertyValue > 0 ? Math.round((yr1Bal/config.propertyValue)*10000)/10000 : 0;
      dscr[ri][ni] = d; ltv[ri][ni] = l; br[ri][ni] = d < minDscr || l > maxLtv;
    }
  }
  return { rateShocksBps: config.rateShocksBps, noiDrops: config.noiDrops, dscrValues: dscr, ltvValues: ltv, breaches: br };
}

export function computeStressTest(loans: DebtEngineInput[], config: StressTestConfig): StressTestResult {
  const minD = config.minDscrThreshold ?? 1.20;
  const maxL = config.maxLtvThreshold ?? 0.75;
  const exit = config.exitMonthIndex ?? 59;

  const scenarios: StressScenario[] = [];
  for (const rs of config.rateShocksBps) for (const nd of config.noiDrops) {
    scenarios.push({ label: `Rate +${rs}bps / NOI ${nd>=0?'+':''}${(nd*100).toFixed(0)}%`, rateShockBps: rs, noiDrop: nd, ioExtensionMonths: 0, amortMonths: loans[0]?.amortMonths ?? 300 });
  }
  if (config.ioExtensionMonths) for (const ext of config.ioExtensionMonths) scenarios.push({ label: `IO +${ext}mo`, rateShockBps: 0, noiDrop: 0, ioExtensionMonths: ext, amortMonths: loans[0]?.amortMonths ?? 300 });
  if (config.altAmortMonths) for (const am of config.altAmortMonths) scenarios.push({ label: `${Math.round(am/12)}yr amort`, rateShockBps: 0, noiDrop: 0, ioExtensionMonths: 0, amortMonths: am });

  const base = runScenario(loans, { label:'Base Case', rateShockBps:0, noiDrop:0, ioExtensionMonths:0, amortMonths: loans[0]?.amortMonths??300 }, config, exit, minD, maxL);
  const results = scenarios.map(s => runScenario(loans, s, config, exit, minD, maxL));
  const matrix = buildMatrix(config, loans, minD, maxL);

  const all = [base, ...results];
  let wD = Infinity, wDs = '', wL = 0, wLs = '';
  for (const r of all) { if(r.year1.dscr<wD){wD=r.year1.dscr;wDs=r.scenario.label;} if(r.year1.ltv>wL){wL=r.year1.ltv;wLs=r.scenario.label;} }

  // Break-even NOI
  const scheds = loans.map(l=>computeLoanSchedule(l));
  const yr1DS = scheds.reduce((s,sc)=>s+sc.slice(0,Math.min(12,sc.length)).reduce((x,r)=>x+r.debtService,0),0);
  const beNoi = yr1DS > 0 ? Math.round(((minD*yr1DS/config.baseNoi)-1)*10000)/10000 : null;

  // Break-even rate (binary search)
  let beRate: number|null = null;
  let lo=0, hi=1000;
  for(let i=0;i<30;i++){
    const mid=(lo+hi)/2;
    const adj=loans.map(l=>{const a={...l};if(a.rateType==='fixed'&&a.fixedRate!=null)a.fixedRate+=mid/10000;else if(a.rateType==='floating')a.initialIndexBps=(a.initialIndexBps??0)+mid;return a;});
    const ds=adj.map(l=>computeLoanSchedule(l)).reduce((s,sc)=>s+sc.slice(0,Math.min(12,sc.length)).reduce((x,r)=>x+r.debtService,0),0);
    const d=ds>0?config.baseNoi/ds:99;
    if(Math.abs(d-minD)<0.005){beRate=Math.round(mid);break;}
    if(d>minD)lo=mid;else hi=mid;
  }
  if(beRate===null&&hi<999)beRate=Math.round((lo+hi)/2);

  return {
    baseCase: base, scenarios: results, matrix,
    breachSummary: {
      totalScenarios: all.length, breachedScenarios: all.filter(r=>r.breachesMinDscr||r.breachesMaxLtv).length,
      worstDscr: wD===Infinity?0:Math.round(wD*100)/100, worstDscrScenario: wDs,
      worstLtv: Math.round(wL*10000)/10000, worstLtvScenario: wLs,
      breakEvenNoiDrop: beNoi, breakEvenRateShock: beRate,
    },
  };
}
