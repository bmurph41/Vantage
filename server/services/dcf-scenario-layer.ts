/**
 * server/services/dcf-scenario-layer.ts
 * 
 * Layer 3 — Deterministic scenario analysis.
 * Produces base/upside/downside results by applying controlled overrides
 * to the canonical Multi-Year Projection Engine.
 * 
 * NOT a parallel model. All cash flows come from computeMultiYearProjection().
 */

import {
  calculateXIRR,
  calculateNPV,
  calculateEquityMultiple,
  DatedCashFlow,
} from '../../shared/finance/xirr';

import { weightedAverage } from '../../shared/finance/distributions';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScenarioDefinition {
  name: string;
  revenueGrowthRateDelta: number;  // pct points
  exitCapRateDelta: number;        // pct points
  saleCostRateDelta: number;       // pct points
  weight: number;                  // probability weight (0..1)
}

export interface ScenarioResult {
  name: string;
  irr: number;                     // percent
  leveredIrr: number;              // percent
  equityMultiple: number;
  npv: number;
  terminalValue: number;
  netSaleProceeds: number;
  cashFlows: DatedCashFlow[];
  overridesApplied: ScenarioDefinition;
}

export interface ExpectedCaseResult {
  expectedIRR: number;
  expectedEM: number;
  expectedNPV: number;
  expectedTerminalValue: number;
  expectedNetSaleProceeds: number;
  probIRRBelowHurdle: number;      // 0..1 (based on discrete scenarios)
  probLosingMoney: number;         // 0..1 (EM < 1.0)
  weights: { base: number; upside: number; downside: number };
}

export interface ScenarioAnalysisResult {
  base: ScenarioResult;
  upside: ScenarioResult;
  downside: ScenarioResult;
  expectedCase: ExpectedCaseResult;
}

// ─── Default Scenario Definitions ────────────────────────────────────────────

export const DEFAULT_SCENARIOS: Record<string, ScenarioDefinition> = {
  base: {
    name: 'Base',
    revenueGrowthRateDelta: 0,
    exitCapRateDelta: 0,
    saleCostRateDelta: 0,
    weight: 0.50,
  },
  upside: {
    name: 'Upside',
    revenueGrowthRateDelta: 1.0,   // +100 bps growth
    exitCapRateDelta: -0.25,        // -25 bps exit cap (higher valuation)
    saleCostRateDelta: 0,
    weight: 0.25,
  },
  downside: {
    name: 'Downside',
    revenueGrowthRateDelta: -1.0,  // -100 bps growth
    exitCapRateDelta: 0.50,         // +50 bps exit cap (lower valuation)
    saleCostRateDelta: 0,
    weight: 0.25,
  },
};

// ─── Main Analysis ───────────────────────────────────────────────────────────

export function runScenarioAnalysis(
  year1: any,
  computeMultiYearProjection: (y1: any, config: any) => any,
  baseConfig: {
    holdPeriod: number;
    revenueGrowthRate: number;    // decimal (e.g. 0.03)
    expenseGrowthRate: number;    // decimal
    exitCapRate: number;          // decimal
    sellingCostPct: number;       // decimal
  },
  equity: {
    equityInvested: number;
    acquisitionDate: string;
    annualDebtService: number[];
    debtBalanceAtExit: number;
    purchasePrice: number;
  },
  discountRate: number,           // percent
  customScenarios?: Record<string, ScenarioDefinition>,
  hurdleIRR: number = 12,        // percent
): ScenarioAnalysisResult {
  const scenarios = customScenarios ?? DEFAULT_SCENARIOS;

  const results: Record<string, ScenarioResult> = {};

  for (const [key, scenario] of Object.entries(scenarios)) {
    const growth = baseConfig.revenueGrowthRate + scenario.revenueGrowthRateDelta / 100;
    const exitCap = baseConfig.exitCapRate + scenario.exitCapRateDelta / 100;
    const sellCost = baseConfig.sellingCostPct + scenario.saleCostRateDelta / 100;

    const projection = computeMultiYearProjection(year1, {
      holdPeriod: baseConfig.holdPeriod,
      revenueGrowthRate: growth,
      expenseGrowthRate: baseConfig.expenseGrowthRate,
      exitCapRate: exitCap,
      sellingCostPct: sellCost,
    });

    const flows = buildLeveredFlows(
      equity.acquisitionDate,
      equity.equityInvested,
      projection.years,
      equity.annualDebtService,
      projection.exit,
      equity.debtBalanceAtExit
    );

    const irr = calculateXIRR(flows);
    const npv = calculateNPV(flows, discountRate);
    const em = calculateEquityMultiple(flows);

    results[key] = {
      name: scenario.name,
      irr: irr.irr,
      leveredIrr: irr.irr,
      equityMultiple: em,
      npv,
      terminalValue: projection.exit.exitValue,
      netSaleProceeds: projection.exit.netSaleProceeds,
      cashFlows: flows,
      overridesApplied: scenario,
    };
  }

  const base = results.base!;
  const upside = results.upside!;
  const downside = results.downside!;

  // Probability-weighted expected case
  const scenarioList = [base, upside, downside];
  const weights = [
    scenarios.base?.weight ?? 0.5,
    scenarios.upside?.weight ?? 0.25,
    scenarios.downside?.weight ?? 0.25,
  ];

  const expectedCase: ExpectedCaseResult = {
    expectedIRR: weightedAverage(scenarioList.map(s => s.irr), weights),
    expectedEM: weightedAverage(scenarioList.map(s => s.equityMultiple), weights),
    expectedNPV: weightedAverage(scenarioList.map(s => s.npv), weights),
    expectedTerminalValue: weightedAverage(scenarioList.map(s => s.terminalValue), weights),
    expectedNetSaleProceeds: weightedAverage(scenarioList.map(s => s.netSaleProceeds), weights),
    probIRRBelowHurdle: weights.reduce((sum, w, i) =>
      sum + (scenarioList[i].irr < hurdleIRR ? w : 0), 0
    ),
    probLosingMoney: weights.reduce((sum, w, i) =>
      sum + (scenarioList[i].equityMultiple < 1.0 ? w : 0), 0
    ),
    weights: {
      base: weights[0],
      upside: weights[1],
      downside: weights[2],
    },
  };

  return { base, upside, downside, expectedCase };
}

// ─── Flow Builder ────────────────────────────────────────────────────────────

function buildLeveredFlows(
  acquisitionDate: string,
  equityInvested: number,
  years: Array<{ year: number; ncf: number }>,
  annualDS: number[],
  exit: { netSaleProceeds: number },
  debtPayoff: number
): DatedCashFlow[] {
  const flows: DatedCashFlow[] = [
    { date: acquisitionDate, amount: -Math.abs(equityInvested) },
  ];

  for (let i = 0; i < years.length; i++) {
    const ds = annualDS[i] ?? 0;
    const levered = years[i].ncf - ds;
    const isLast = i === years.length - 1;
    const exitAmt = isLast ? (exit.netSaleProceeds - debtPayoff) : 0;
    const d = new Date(acquisitionDate);
    d.setFullYear(d.getFullYear() + years[i].year);

    flows.push({
      date: d.toISOString().split('T')[0],
      amount: levered + exitAmt,
    });
  }

  return flows;
}
