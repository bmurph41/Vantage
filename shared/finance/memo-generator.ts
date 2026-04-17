/**
 * shared/finance/memo-generator.ts
 * 
 * Layer 4 — Deterministic IC memo generator.
 * Produces structured memos from scenario results, Monte Carlo stats,
 * tornado drivers, and attribution analysis.
 * 
 * Three tones:
 *   - 'concise': Quick summary for internal review
 *   - 'ic': Full investment committee memo
 *   - 'lender': Debt-focused risk analysis
 * 
 * Template mode is deterministic — same inputs produce identical output.
 * Optional AI-enhanced mode can be layered on top later.
 */

import type { DistributionStats, RiskMetrics } from './distributions';
import type { TornadoResult } from './tornado';
import type { AttributionResult } from './attribution';

// Inlined from server/services/dcf-scenario-layer.ts to keep `shared` self-contained.
// Keep these in sync with the exports there.
export interface ScenarioResult {
  name: string;
  irr: number;
  leveredIrr: number;
  equityMultiple: number;
  npv: number;
  terminalValue: number;
  netSaleProceeds: number;
  cashFlows: Array<{ date: string | Date; amount: number; [key: string]: unknown }>;
  overridesApplied: {
    exitCapRateDelta: number;
    saleCostRateDelta?: number;
    [key: string]: unknown;
  };
}

export interface ExpectedCaseResult {
  expectedIRR: number;
  expectedEM: number;
  expectedNPV: number;
  expectedTerminalValue: number;
  expectedNetSaleProceeds: number;
  probIRRBelowHurdle: number;
  probLosingMoney: number;
  weights: { base: number; upside: number; downside: number };
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type MemoTone = 'concise' | 'ic' | 'lender';

export interface MemoSection {
  title: string;
  bullets: string[];
}

export interface MemoResult {
  tone: MemoTone;
  headline: string;
  executiveSummary: string;
  sections: MemoSection[];
  appendix?: {
    assumptions: Record<string, string | number>;
    keyStats: Record<string, number>;
  };
}

export interface MemoInput {
  projectName?: string;
  assetClass?: string;
  base: ScenarioResult;
  upside: ScenarioResult;
  downside: ScenarioResult;
  expectedCase: ExpectedCaseResult;
  mcStats?: {
    irr: DistributionStats;
    equityMultiple: DistributionStats;
    npv: DistributionStats;
  };
  risks?: RiskMetrics;
  tornado?: TornadoResult;
  attribution?: AttributionResult;
  purchasePrice: number;
  equityInvested: number;
  holdPeriodYears: number;
  totalDebt: number;
  hurdleIRR: number;
  discountRate: number;
}

// ─── Generator ───────────────────────────────────────────────────────────────

export function generateMemo(input: MemoInput, tone: MemoTone = 'concise'): MemoResult {
  switch (tone) {
    case 'concise': return generateConciseMemo(input);
    case 'ic': return generateICMemo(input);
    case 'lender': return generateLenderMemo(input);
    default: return generateConciseMemo(input);
  }
}

// ─── Concise Memo ────────────────────────────────────────────────────────────

function generateConciseMemo(input: MemoInput): MemoResult {
  const { base, expectedCase, tornado, risks } = input;
  const name = input.projectName ?? 'Subject Property';
  const irrLabel = base.irr >= 0 ? `${fmt(base.irr)}%` : `(${fmt(Math.abs(base.irr))}%)`;

  const headline = `${name} — Base Case ${irrLabel} IRR, ${fmt(base.equityMultiple, 2)}x EM`;

  const exec = [
    `The base case projects a levered IRR of ${irrLabel} and an equity multiple of ${fmt(base.equityMultiple, 2)}x`,
    `over a ${input.holdPeriodYears}-year hold on ${fmtCurrency(input.purchasePrice)} total capitalization.`,
    expectedCase.probIRRBelowHurdle > 0
      ? `Probability-weighted analysis indicates a ${fmt(expectedCase.probIRRBelowHurdle * 100)}% chance of underperforming the ${fmt(input.hurdleIRR)}% hurdle.`
      : `Weighted expected IRR of ${fmt(expectedCase.expectedIRR)}% exceeds the ${fmt(input.hurdleIRR)}% hurdle.`,
  ].join(' ');

  const sections: MemoSection[] = [
    {
      title: 'Key Metrics',
      bullets: [
        `Base IRR: ${fmt(base.irr)}% | Upside: ${fmt(input.upside.irr)}% | Downside: ${fmt(input.downside.irr)}%`,
        `Equity Multiple: ${fmt(base.equityMultiple, 2)}x`,
        `NPV at ${fmt(input.discountRate)}%: ${fmtCurrency(base.npv)}`,
        `Net Sale Proceeds: ${fmtCurrency(base.netSaleProceeds)}`,
      ],
    },
  ];

  if (tornado && tornado.drivers.length > 0) {
    const top3 = tornado.drivers.slice(0, 3);
    sections.push({
      title: 'Top Drivers (Sensitivity)',
      bullets: top3.map(d =>
        `${d.driver}: ${fmt(d.low)}% → ${fmt(d.high)}% IRR (${d.delta})`
      ),
    });
  }

  if (risks) {
    sections.push({
      title: 'Key Risks',
      bullets: [
        `P(IRR < ${fmt(input.hurdleIRR)}%): ${fmt(risks.probIrrBelowHurdle * 100, 1)}%`,
        `P(Loss of capital): ${fmt(risks.probMultipleBelow1 * 100, 1)}%`,
        `Expected shortfall (P10 IRR): ${fmt(risks.expectedShortfallIrrP10)}%`,
      ],
    });
  }

  return {
    tone: 'concise',
    headline,
    executiveSummary: exec,
    sections,
    appendix: buildAppendix(input),
  };
}

// ─── IC Memo ─────────────────────────────────────────────────────────────────

function generateICMemo(input: MemoInput): MemoResult {
  const { base, upside, downside, expectedCase, tornado, attribution, risks, mcStats } = input;
  const name = input.projectName ?? 'Subject Property';
  const hasDebt = input.totalDebt > 0;
  const ltv = input.purchasePrice > 0
    ? (input.totalDebt / input.purchasePrice * 100)
    : 0;

  const headline = `Investment Committee Memo — ${name}`;

  const exec = [
    `Recommending a ${fmtCurrency(input.purchasePrice)} acquisition of ${name} (${input.assetClass ?? 'multi-asset'})`,
    `with ${fmtCurrency(input.equityInvested)} equity and ${hasDebt ? `${fmt(ltv)}% LTV` : 'all-cash'} capitalization.`,
    `Base case projects ${fmt(base.irr)}% levered IRR and ${fmt(base.equityMultiple, 2)}x equity multiple over ${input.holdPeriodYears} years.`,
    `Probability-weighted expected IRR is ${fmt(expectedCase.expectedIRR)}%.`,
  ].join(' ');

  const sections: MemoSection[] = [];

  // Investment Thesis
  sections.push({
    title: 'Investment Thesis',
    bullets: [
      `${input.holdPeriodYears}-year value-add/stabilized hold targeting ${fmt(base.irr)}%+ IRR`,
      `Going-in cap rate of ${fmt(base.irr > 0 ? (base.overridesApplied ? 'N/A' : 'see appendix') : 'N/A')}`,
      `Exit at ${fmt(base.overridesApplied.exitCapRateDelta === 0 ? 'base' : 'adjusted')} cap rate with ${fmtCurrency(base.netSaleProceeds)} net proceeds`,
    ],
  });

  // Returns & Risk Distribution
  const returnsBullets = [
    `Base: ${fmt(base.irr)}% IRR, ${fmt(base.equityMultiple, 2)}x EM`,
    `Upside: ${fmt(upside.irr)}% IRR, ${fmt(upside.equityMultiple, 2)}x EM`,
    `Downside: ${fmt(downside.irr)}% IRR, ${fmt(downside.equityMultiple, 2)}x EM`,
    `Expected (weighted): ${fmt(expectedCase.expectedIRR)}% IRR, ${fmt(expectedCase.expectedEM, 2)}x EM`,
  ];

  if (mcStats) {
    returnsBullets.push(
      `Monte Carlo P10/P50/P90 IRR: ${fmt(mcStats.irr.p10)}% / ${fmt(mcStats.irr.p50)}% / ${fmt(mcStats.irr.p90)}%`
    );
  }
  sections.push({ title: 'Returns & Risk Distribution', bullets: returnsBullets });

  // Key Sensitivities
  if (tornado && tornado.drivers.length > 0) {
    sections.push({
      title: 'Key Sensitivities',
      bullets: tornado.drivers.slice(0, 5).map(d =>
        `${d.driver} (${d.delta}): IRR range ${fmt(d.low)}% to ${fmt(d.high)}% (spread: ${fmt(d.spread)} bps)`
      ),
    });
  }

  // Driver Attribution
  if (attribution && attribution.drivers.length > 0) {
    sections.push({
      title: 'Driver Attribution',
      bullets: [
        `Model R²: ${fmt(attribution.r2 * 100)}%`,
        ...attribution.drivers.slice(0, 4).map(d =>
          `${d.driver}: ${fmt(d.importance * 100)}% of variance (${d.direction})`
        ),
        ...attribution.notes,
      ],
    });
  }

  // Downside Protection
  const downsideBullets = [
    `Downside scenario IRR: ${fmt(downside.irr)}%`,
    `P(IRR < hurdle): ${fmt((risks?.probIrrBelowHurdle ?? expectedCase.probIRRBelowHurdle) * 100)}%`,
    `P(Loss): ${fmt((risks?.probMultipleBelow1 ?? expectedCase.probLosingMoney) * 100)}%`,
  ];
  if (risks) {
    downsideBullets.push(
      `Expected shortfall (P10): ${fmt(risks.expectedShortfallIrrP10)}% IRR`
    );
  }
  sections.push({ title: 'Downside Protections', bullets: downsideBullets });

  // Recommended Next Steps
  sections.push({
    title: 'Recommended Next Diligence',
    bullets: generateDiligenceChecklist(input),
  });

  return {
    tone: 'ic',
    headline,
    executiveSummary: exec,
    sections,
    appendix: buildAppendix(input),
  };
}

// ─── Lender Memo ─────────────────────────────────────────────────────────────

function generateLenderMemo(input: MemoInput): MemoResult {
  const { base, downside, risks, tornado } = input;
  const name = input.projectName ?? 'Subject Property';
  const hasDebt = input.totalDebt > 0;
  const ltv = input.purchasePrice > 0
    ? (input.totalDebt / input.purchasePrice * 100)
    : 0;

  const headline = `Lender Analysis — ${name}`;

  const exec = hasDebt
    ? `Debt of ${fmtCurrency(input.totalDebt)} at ${fmt(ltv)}% LTV on a ${fmtCurrency(input.purchasePrice)} acquisition. ` +
      `Base NOI provides coverage; downside scenario projects ${fmt(downside.irr)}% levered IRR.`
    : `All-cash acquisition of ${fmtCurrency(input.purchasePrice)} — no debt in capital stack.`;

  const sections: MemoSection[] = [];

  // Debt Summary
  if (hasDebt) {
    sections.push({
      title: 'Debt & Coverage Summary',
      bullets: [
        `Total Debt: ${fmtCurrency(input.totalDebt)}`,
        `LTV: ${fmt(ltv)}%`,
        `Equity: ${fmtCurrency(input.equityInvested)}`,
      ],
    });
  }

  // Exit Cap Sensitivity
  if (tornado) {
    const exitCapDriver = tornado.drivers.find(d => d.driver.toLowerCase().includes('exit cap'));
    if (exitCapDriver) {
      sections.push({
        title: 'Sensitivity to Exit Cap & NOI',
        bullets: [
          `Exit cap sensitivity (${exitCapDriver.delta}): IRR ${fmt(exitCapDriver.low)}% to ${fmt(exitCapDriver.high)}%`,
          `Spread: ${fmt(exitCapDriver.spread)} bps`,
        ],
      });
    }
  }

  // Downside Risk
  sections.push({
    title: 'Liquidity & Downside Risk',
    bullets: [
      `Downside IRR: ${fmt(downside.irr)}%`,
      `Downside EM: ${fmt(downside.equityMultiple, 2)}x`,
      `P(Loss): ${fmt((risks?.probMultipleBelow1 ?? 0) * 100)}%`,
      risks ? `Expected shortfall (P10 NPV): ${fmtCurrency(risks.expectedShortfallNpvP10)}` : 'Monte Carlo not run',
    ],
  });

  // Refi Risk
  if (hasDebt) {
    sections.push({
      title: 'Refinance / Balloon Risk',
      bullets: [
        `Hold period: ${input.holdPeriodYears} years`,
        `Remaining balance at exit: review debt schedule for balloon exposure`,
        `Coverage trend: verify NOI growth supports refinance at maturity`,
      ],
    });
  }

  return {
    tone: 'lender',
    headline,
    executiveSummary: exec,
    sections,
    appendix: buildAppendix(input),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateDiligenceChecklist(input: MemoInput): string[] {
  const items: string[] = [];

  items.push('Verify trailing-12 actuals against underwritten Year 1');

  if (input.tornado) {
    const topDriver = input.tornado.drivers[0];
    if (topDriver) {
      items.push(`Stress-test ${topDriver.driver} (highest sensitivity driver)`);
    }
  }

  if (input.totalDebt > 0) {
    items.push('Confirm debt terms and prepayment provisions');
  }

  items.push('Review CapEx reserve adequacy');
  items.push('Assess market comps for exit cap rate assumption');
  items.push('Confirm lease/contract rollover exposure during hold');

  return items;
}

function buildAppendix(input: MemoInput): MemoResult['appendix'] {
  return {
    assumptions: {
      purchasePrice: input.purchasePrice,
      equityInvested: input.equityInvested,
      totalDebt: input.totalDebt,
      holdPeriodYears: input.holdPeriodYears,
      hurdleIRR: `${input.hurdleIRR}%`,
      discountRate: `${input.discountRate}%`,
    },
    keyStats: {
      baseIRR: input.base.irr,
      upsideIRR: input.upside.irr,
      downsideIRR: input.downside.irr,
      expectedIRR: input.expectedCase.expectedIRR,
      baseEM: input.base.equityMultiple,
      baseNPV: input.base.npv,
    },
  };
}

function fmt(n: number, decimals: number = 1): string {
  return Number(n).toFixed(decimals);
}

function fmtCurrency(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(1)}M`;
  }
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}
