/**
 * shared/finance/tornado.ts
 * 
 * Layer 4 — Tornado chart (driver sensitivity decomposition).
 * For each driver, perturbs ±delta while holding others constant,
 * measures impact on target outcome (IRR, NPV, EM).
 * Returns drivers sorted by absolute impact magnitude.
 */

import { calculateXIRR, calculateNPV, calculateEquityMultiple, DatedCashFlow } from './xirr';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TornadoDriverImpact {
  driver: string;
  low: number;         // outcome at -delta
  base: number;        // base outcome
  high: number;        // outcome at +delta
  delta: string;       // human label e.g. "±50 bps"
  spread: number;      // abs(high - low)
  unit: 'percent' | 'currency' | 'multiple';
}

export interface TornadoResult {
  target: 'irr' | 'npv' | 'equityMultiple';
  drivers: TornadoDriverImpact[];
}

export interface TornadoConfig {
  drivers: TornadoDriverDef[];
  target: 'irr' | 'npv' | 'equityMultiple';
  discountRate: number;  // percent (for NPV)
}

export interface TornadoDriverDef {
  name: string;
  key: string;
  delta: number;         // absolute delta value
  deltaLabel: string;    // e.g. "±50 bps", "±5%"
  unit: 'percent' | 'currency' | 'multiple';
  apply: (
    baseConfig: any,
    baseEquity: any,
    direction: -1 | 1,
    delta: number,
  ) => { configOverride: any; equityOverride: any };
}

// ─── Default Drivers ─────────────────────────────────────────────────────────

export function getDefaultDrivers(): TornadoDriverDef[] {
  return [
    {
      name: 'Purchase Price',
      key: 'purchasePrice',
      delta: 0.05,
      deltaLabel: '±5%',
      unit: 'percent',
      apply: (bc, eq, dir, d) => ({
        configOverride: { ...bc },
        equityOverride: {
          ...eq,
          purchasePrice: eq.purchasePrice * (1 + dir * d),
          equityInvested: eq.purchasePrice * (1 + dir * d) - (eq.purchasePrice - eq.equityInvested),
        },
      }),
    },
    {
      name: 'Exit Cap Rate',
      key: 'exitCapRate',
      delta: 0.005,
      deltaLabel: '±50 bps',
      unit: 'percent',
      apply: (bc, eq, dir, d) => ({
        configOverride: { ...bc, exitCapRate: bc.exitCapRate + dir * d },
        equityOverride: eq,
      }),
    },
    {
      name: 'Revenue Growth',
      key: 'revenueGrowth',
      delta: 0.01,
      deltaLabel: '±100 bps',
      unit: 'percent',
      apply: (bc, eq, dir, d) => ({
        configOverride: { ...bc, revenueGrowthRate: bc.revenueGrowthRate + dir * d },
        equityOverride: eq,
      }),
    },
    {
      name: 'Selling Costs',
      key: 'sellingCosts',
      delta: 0.005,
      deltaLabel: '±50 bps',
      unit: 'percent',
      apply: (bc, eq, dir, d) => ({
        configOverride: { ...bc, sellingCostPct: Math.max(0, bc.sellingCostPct + dir * d) },
        equityOverride: eq,
      }),
    },
    {
      name: 'Hold Period',
      key: 'holdPeriod',
      delta: 1,
      deltaLabel: '±1 year',
      unit: 'percent',
      apply: (bc, eq, dir, d) => ({
        configOverride: {
          ...bc,
          holdPeriod: Math.max(1, Math.round(bc.holdPeriod + dir * d)),
        },
        equityOverride: {
          ...eq,
          annualDebtService: adjustDebtServiceLength(
            eq.annualDebtService,
            Math.max(1, Math.round(bc.holdPeriod + dir * d))
          ),
        },
      }),
    },
  ];
}

function adjustDebtServiceLength(ds: number[], newLength: number): number[] {
  if (ds.length === 0) return new Array(newLength).fill(0);
  const lastVal = ds[ds.length - 1] ?? 0;
  const result = [...ds];
  while (result.length < newLength) result.push(lastVal);
  return result.slice(0, newLength);
}

// ─── Tornado Computation ─────────────────────────────────────────────────────

export function computeTornado(
  year1: any,
  computeMultiYearProjection: (y1: any, config: any) => any,
  baseConfig: {
    holdPeriod: number;
    revenueGrowthRate: number;
    expenseGrowthRate: number;
    exitCapRate: number;
    sellingCostPct: number;
  },
  equity: {
    equityInvested: number;
    acquisitionDate: string;
    annualDebtService: number[];
    debtBalanceAtExit: number;
    purchasePrice: number;
  },
  config: TornadoConfig
): TornadoResult {
  // Compute base outcome
  const baseOutcome = computeOutcome(
    year1, computeMultiYearProjection, baseConfig, equity, config
  );

  const drivers: TornadoDriverImpact[] = config.drivers.map(driver => {
    // Low scenario (-delta)
    const { configOverride: lowConfig, equityOverride: lowEquity } =
      driver.apply(baseConfig, equity, -1, driver.delta);
    const low = computeOutcome(
      year1, computeMultiYearProjection, lowConfig, lowEquity, config
    );

    // High scenario (+delta)
    const { configOverride: highConfig, equityOverride: highEquity } =
      driver.apply(baseConfig, equity, 1, driver.delta);
    const high = computeOutcome(
      year1, computeMultiYearProjection, highConfig, highEquity, config
    );

    return {
      driver: driver.name,
      low,
      base: baseOutcome,
      high,
      delta: driver.deltaLabel,
      spread: Math.abs(high - low),
      unit: driver.unit,
    };
  });

  // Sort by spread descending
  drivers.sort((a, b) => b.spread - a.spread);

  return { target: config.target, drivers };
}

function computeOutcome(
  year1: any,
  computeMultiYearProjection: (y1: any, config: any) => any,
  projConfig: any,
  equity: any,
  tornadoConfig: TornadoConfig,
): number {
  const proj = computeMultiYearProjection(year1, projConfig);
  const flows = buildFlows(
    equity.acquisitionDate,
    equity.equityInvested,
    proj.years,
    equity.annualDebtService,
    proj.exit,
    equity.debtBalanceAtExit
  );

  switch (tornadoConfig.target) {
    case 'irr':
      return calculateXIRR(flows).irr;
    case 'npv':
      return calculateNPV(flows, tornadoConfig.discountRate);
    case 'equityMultiple':
      return calculateEquityMultiple(flows);
    default:
      return calculateXIRR(flows).irr;
  }
}

function buildFlows(
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
    const lev = years[i].ncf - ds;
    const isLast = i === years.length - 1;
    const exitAmt = isLast ? (exit.netSaleProceeds - debtPayoff) : 0;
    const d = new Date(acquisitionDate);
    d.setFullYear(d.getFullYear() + years[i].year);
    flows.push({ date: d.toISOString().split('T')[0], amount: lev + exitAmt });
  }
  return flows;
}
