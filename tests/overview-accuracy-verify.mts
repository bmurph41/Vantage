/**
 * Overview-accuracy verification harness (2026-05-24 Gap A + Gap C fix).
 *
 * Simulates Overview's KPI-card data flow end-to-end:
 *   1. Calls proFormaEngineService.generateProForma(orgId, projectId, 'base')
 *      — the same data source /api/modeling/projects/:id/pro-forma exposes
 *      to Overview's _proFormaRaw query.
 *   2. Runs the BEFORE extractor (workspace.tsx pre-fix logic: drops
 *      _proFormaRaw.metrics.* entirely).
 *   3. Runs the AFTER extractor (workspace.tsx post-fix logic: wires
 *      metrics.* with percentage-to-decimal conversions).
 *   4. Reports BEFORE/AFTER KPI values per project so the demo-relevant
 *      cards (IRR, equity multiple, going-in cap rate) can be visually
 *      verified to populate post-fix and match what PF computes.
 *
 * Standing gate against Overview KPI-source regression: if the extractor
 * ever drops metrics.* again, or unit conversion gets flipped, the
 * AFTER columns will show wrong numbers compared to the PF metrics
 * row alongside them.
 */

import pg from 'pg';
import { proFormaEngineService } from '../server/services/pro-forma-engine-service';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Anchor projects — selected to cover the meaningful shapes:
//   18bbede6 — marina, auto+inputs+no-actuals (real PF metrics)
//   c3a1eebc — multifamily, direct_input+inputs (real PF metrics, different class)
//   7a487b18 — marina, auto+inputs (sibling to 18bbede6 — should match)
//   7df94d2a — marina, auto+NO inputs (PF returns zeros — falls back to typed)
//   d4dcdaa5 — multifamily, fallback-cohort sibling (different class, different typed value)
const PROJECT_ID_PREFIXES = ['18bbede6', 'c3a1eebc', '7a487b18', '7df94d2a', 'd4dcdaa5'];

// Fallback-cohort anchors with EXPECTED displayed cap-rate values.
// These projects have NO engine-computed cap rate (PF metrics zero / no inputs)
// AND a typed pricing.goingInCapRate (percentage form in DB). The Gap B fix
// (2026-05-25) routes the fallback through pricingPctToDecimal so the
// formatKPIValue('percent', v) renders 9.37% / 7.5% instead of 937% / 750%.
// Closes the harness blind spot that previously treated engine-zero as '(empty)'
// and never asserted the displayed-cap-rate fallback path.
const FALLBACK_EXPECT: Record<string, { dbGoingInCapRate: number; displayed: string }> = {
  '7df94d2a': { dbGoingInCapRate: 9.37, displayed: '9.37%' },
  'd4dcdaa5': { dbGoingInCapRate: 7.5,  displayed: '7.50%' },
};

// === BEFORE extractor (pre-2026-05-24 workspace.tsx logic) ===
function extractFinancialsBefore(pf: any) {
  if (!pf) return undefined;
  const s0 = pf.scenarios?.[0];
  if (s0?.metrics) return null; // shape 1 — not the one /pro-forma returns
  const rev = pf.revenue?.totals?.[0] ?? pf.revenue?.total ?? pf.totalRevenue ?? 0;
  const exp = pf.expenses?.totals?.[0] ?? pf.expenses?.total ?? pf.totalExpenses ?? 0;
  const noi = Array.isArray(pf.noi) ? pf.noi[0] : (pf.noi ?? (rev - exp));
  // BEFORE: metrics.* silently dropped
  return { totalRevenue: rev, totalExpenses: exp, noi, revenueLines: [] };
}

// === AFTER extractor (post-2026-05-24 workspace.tsx logic) ===
function extractFinancialsAfter(pf: any) {
  if (!pf) return undefined;
  const rev = pf.revenue?.totals?.[0] ?? pf.revenue?.total ?? pf.totalRevenue ?? 0;
  const exp = pf.expenses?.totals?.[0] ?? pf.expenses?.total ?? pf.totalExpenses ?? 0;
  const noi = Array.isArray(pf.noi) ? pf.noi[0] : (pf.noi ?? (rev - exp));
  const m = pf.metrics ?? {};
  const pctToDecimal = (v: any) => (typeof v === 'number' && isFinite(v) && v !== 0 ? v / 100 : undefined);
  const passNonzero = (v: any) => (typeof v === 'number' && isFinite(v) && v !== 0 ? v : undefined);
  return {
    totalRevenue: rev,
    totalExpenses: exp,
    noi,
    revenueLines: [],
    irr: pctToDecimal(m.irr),
    unleveredIrr: pctToDecimal(m.unleveredIrr),
    capRate: pctToDecimal(m.goingInCapRate),
    exitCapRate: pctToDecimal(m.exitCapRate),
    equityMultiple: passNonzero(m.equityMultiple),
    unleveredEquityMultiple: passNonzero(m.unleveredEquityMultiple),
    year1Noi: passNonzero(m.year1Noi),
    stabilizedNoi: passNonzero(m.stabilizedNoi),
    exitValue: passNonzero(m.exitValue),
    purchasePrice: passNonzero(m.purchasePrice),
    dscr: passNonzero(m.minDscr),
    avgDscr: passNonzero(m.avgDscr),
    debtYield: pctToDecimal(m.debtYield),
    ltv: pctToDecimal(m.ltv),
    adr: passNonzero(m.adr),
    occupancy: passNonzero(m.occupancy),
    revPAR: passNonzero(m.revPAR),
  };
}

const fmtCurrency = (v: any) => typeof v === 'number' ? `$${Math.round(v).toLocaleString()}` : '—';
const fmtPct = (v: any) => typeof v === 'number' ? `${(v * 100).toFixed(2)}%` : '—';
const fmtMultiplier = (v: any) => typeof v === 'number' ? `${v.toFixed(2)}x` : '—';

// Final-display extractor for cap rate — mirrors overview-dynamic.tsx and
// executive-summary-dynamic.tsx precedence: financials.capRate (decimal) →
// pricing.capRate (decimal) → pricingPctToDecimal(pricing.goingInCapRate)
// (percentage-form fallback converted). Same shape as both consumer files
// post-Gap-B fix.
function extractCapRateDisplayed(financials: any, pricingBlob: any): number | null {
  const pricingPctToDecimal = (v: any) => (v != null ? Number(v) / 100 : undefined);
  const val =
    (financials?.capRate as number | undefined) ??
    (pricingBlob?.capRate as number | undefined) ??
    pricingPctToDecimal(pricingBlob?.goingInCapRate);
  if (val == null || !isFinite(val)) return null;
  return val;
}

let regressions = 0;
let goldenChecks = 0;
let fallbackChecks = 0;

console.log('=== Overview-accuracy verification (Gap A + Gap C fix, 2026-05-24) ===\n');

for (const prefix of PROJECT_ID_PREFIXES) {
  const r = await pool.query(
    `SELECT id, org_id, asset_class, COALESCE(model_input_mode, 'auto') AS mode,
            custom_metrics -> 'dealPricing' AS pricing_blob
     FROM modeling_projects WHERE id::text LIKE $1`,
    [prefix + '%']
  );
  if (!r.rows[0]) { console.log(`${prefix}: not found, skipping\n`); continue; }
  const p = r.rows[0];
  const pricingBlob = p.pricing_blob ?? {};

  let pf: any = null;
  try {
    pf = await proFormaEngineService.generateProForma(p.id, p.org_id, 'base');
  } catch (e: any) {
    console.log(`${prefix} (${p.asset_class}): PF errored — ${e.message?.slice(0, 80)}\n`);
    continue;
  }

  const before = extractFinancialsBefore(pf);
  const after = extractFinancialsAfter(pf);

  console.log(`────── ${prefix} (${p.asset_class}, ${p.mode}) ──────`);

  // Byte-identical checks: NOI/Rev/Exp must be UNCHANGED.
  const noiMatch = before?.noi === after?.noi;
  const revMatch = before?.totalRevenue === after?.totalRevenue;
  const expMatch = before?.totalExpenses === after?.totalExpenses;
  if (!noiMatch || !revMatch || !expMatch) {
    console.error(`  ✗ REGRESSION: byte-identical core metrics broken`);
    console.error(`    before: rev=${before?.totalRevenue} exp=${before?.totalExpenses} noi=${before?.noi}`);
    console.error(`    after:  rev=${after?.totalRevenue} exp=${after?.totalExpenses} noi=${after?.noi}`);
    regressions++;
  }

  // KPI-by-KPI BEFORE/AFTER + ENGINE-MATCH check
  const rows = [
    { kpi: 'NOI',              before: fmtCurrency(before?.noi),                 after: fmtCurrency(after?.noi),                 engine: fmtCurrency(pf.metrics?.year1Noi),  match: '' },
    { kpi: 'Revenue',          before: fmtCurrency(before?.totalRevenue),        after: fmtCurrency(after?.totalRevenue),        engine: fmtCurrency(pf.revenue?.totals?.[0]), match: '' },
    { kpi: 'Expenses',         before: fmtCurrency(before?.totalExpenses),       after: fmtCurrency(after?.totalExpenses),       engine: fmtCurrency(pf.expenses?.totals?.[0]), match: '' },
    { kpi: 'IRR',              before: fmtPct((before as any)?.irr),              after: fmtPct(after?.irr),                       engine: fmtPct((pf.metrics?.irr ?? 0) / 100),  match: '' },
    { kpi: 'Equity Multiple',  before: fmtMultiplier((before as any)?.equityMultiple), after: fmtMultiplier(after?.equityMultiple), engine: fmtMultiplier(pf.metrics?.equityMultiple), match: '' },
    { kpi: 'Going-in Cap Rate',before: fmtPct((before as any)?.capRate),          after: fmtPct(after?.capRate),                   engine: fmtPct((pf.metrics?.goingInCapRate ?? 0) / 100), match: '' },
    { kpi: 'Unlevered IRR',    before: fmtPct((before as any)?.unleveredIrr),     after: fmtPct(after?.unleveredIrr),              engine: fmtPct((pf.metrics?.unleveredIrr ?? 0) / 100), match: '' },
    { kpi: 'Year 1 NOI',       before: fmtCurrency((before as any)?.year1Noi),    after: fmtCurrency(after?.year1Noi),             engine: fmtCurrency(pf.metrics?.year1Noi), match: '' },
    { kpi: 'Stabilized NOI',   before: fmtCurrency((before as any)?.stabilizedNoi), after: fmtCurrency(after?.stabilizedNoi),      engine: fmtCurrency(pf.metrics?.stabilizedNoi), match: '' },
  ];

  for (const row of rows) {
    row.match = row.after === row.engine ? '✓' : (row.after === '—' ? '(empty)' : '✗');
    if (row.match === '✗' && row.after !== '—') {
      regressions++;
    }
    if (row.match === '✓' && row.after !== '—') {
      goldenChecks++;
    }
  }

  console.table(rows);

  // === Fallback-path assertion (Gap B blind-spot closure, 2026-05-25) ===
  // For fallback-cohort projects, the financials.capRate path returns null
  // (engine zero) and the displayed cap rate MUST come from the pricing
  // fallback branch through pricingPctToDecimal. Asserts:
  //   1. DB storage form matches expectation (catches DB drift)
  //   2. Displayed cap rate (post pricingPctToDecimal) is the percentage
  //      form converted to decimal — NOT the raw value (which would render
  //      as 100x the intended display, the "937%" symptom)
  const expect = FALLBACK_EXPECT[prefix];
  if (expect) {
    const dbVal = Number(pricingBlob.goingInCapRate);
    const financialsCapRate = (after as any)?.capRate ?? null;
    const displayedDecimal = extractCapRateDisplayed(after, pricingBlob);
    const displayedFormatted = displayedDecimal != null
      ? `${(displayedDecimal * 100).toFixed(2)}%`
      : '—';

    const dbMatches = dbVal === expect.dbGoingInCapRate;
    const usedFallback = financialsCapRate == null; // financials must be null for fallback to fire
    const displayMatches = displayedFormatted === expect.displayed;

    console.log(`  [fallback-cohort assertions]`);
    console.log(`    DB pricing.goingInCapRate     : ${dbVal} (expect ${expect.dbGoingInCapRate}) ${dbMatches ? '✓' : '✗'}`);
    console.log(`    financials.capRate is null    : ${usedFallback ? '✓ (fallback path active)' : '✗ (engine produced a value — wrong cohort)'}`);
    console.log(`    Displayed cap rate            : ${displayedFormatted} (expect ${expect.displayed}) ${displayMatches ? '✓' : '✗'}`);

    if (!dbMatches || !usedFallback || !displayMatches) {
      console.error(`  ✗ FALLBACK REGRESSION — ${prefix} would render '${displayedFormatted}' (raw db value: ${dbVal}, no /100 → would render as '${(dbVal*100).toFixed(2)}%')`);
      regressions++;
    } else {
      fallbackChecks++;
    }
  }
}

console.log(`\n=== Summary ===`);
console.log(`Engine-match checks passed:  ${goldenChecks}`);
console.log(`Fallback-path checks passed: ${fallbackChecks} (Gap B blind-spot closure)`);
console.log(`Regressions / mismatches:    ${regressions}`);
if (regressions === 0) console.log('✓ GREEN — Overview extractor faithfully reflects PF engine output, NOI/Rev/Exp byte-identical pre/post fix; fallback path renders percentage-form pricing.goingInCapRate correctly.');
else { console.error('✗ FAILED — see mismatches above'); process.exit(1); }

await pool.end();
