/**
 * Static wiring assertion for the mode-switch flicker fix (2026-05-24).
 *
 * Proves the loading prop is structurally wired through workspace.tsx,
 * OverviewDynamic, ExecutiveSummaryDynamic, and the Skeleton render
 * branches.
 *
 * Implementation: source-text-pattern assertions. Why not SSR / React
 * Testing Library? The project's JSX uses the automatic runtime via
 * vite/esbuild; tsx-node's classic JSX transform does not propagate it
 * through cross-package imports, so renderToString crashes on imported
 * components ("React is not defined"). Adding RTL would require jsdom,
 * jsx-runtime, and happy-dom setup not currently in the repo. Static-
 * text checks are an honest proof of the wiring without dragging in
 * test infra.
 *
 * What this PROVES:
 *   - workspace.tsx destructures isFetching from the /pro-forma query
 *     and exposes it as `overviewLoading`.
 *   - Both consumers (Overview and ES) receive the loading prop.
 *   - OverviewDynamic and ExecutiveSummaryDynamic declare the loading prop.
 *   - Skeleton render branches exist on the value path (not just imported).
 *   - ES narrow-gating: skeleton appears in operating-metrics and revenue
 *     breakdown sections but NOT in the unconditional render path of
 *     Acquisition or Returns (mode-invariant sources — gating them
 *     would create loading-theater).
 *
 * What this does NOT prove:
 *   - The live React Query refetch timing (visual end-to-end verification
 *     belongs in a separate manual smoke or future RTL harness).
 *   - The shimmer animation itself (CSS-only concern).
 *
 * The steady-state correctness of the numbers shown when loading=false is
 * proved by tests/overview-accuracy-verify.mts which stays 30/30 green;
 * this fix adds a render branch, does not touch the financials extractor.
 */

import { readFileSync } from 'fs';

const root = '/home/runner/workspace';
const workspaceTsx = readFileSync(`${root}/client/src/pages/modeling/projects/workspace.tsx`, 'utf8');
const overviewTsx = readFileSync(`${root}/client/src/pages/modeling/projects/workspace/overview-dynamic.tsx`, 'utf8');
const esTsx = readFileSync(`${root}/client/src/pages/modeling/projects/workspace/executive-summary-dynamic.tsx`, 'utf8');

let passed = 0;
let failed = 0;

function assert(cond: boolean, label: string, detail?: string) {
  if (cond) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); failed++; }
}

console.log('\n=== workspace.tsx — isFetching destructure + loading prop wiring ===');
assert(
  /const\s*{\s*data:\s*_proFormaRaw,\s*isFetching:\s*isFetchingProForma\s*}\s*=\s*useQuery/.test(workspaceTsx),
  'isFetching destructured from _proFormaRaw query as isFetchingProForma',
);
assert(
  /const\s+overviewLoading\s*=\s*isFetchingProForma/.test(workspaceTsx),
  'overviewLoading computed from isFetchingProForma (single-source gate)',
);
assert(
  /<OverviewDynamic[^/]*loading=\{overviewLoading\}/.test(workspaceTsx),
  'OverviewDynamic receives loading={overviewLoading}',
);
assert(
  /<ExecutiveSummaryDynamic[^/]*loading=\{overviewLoading\}/.test(workspaceTsx),
  'ExecutiveSummaryDynamic receives loading={overviewLoading}',
);
assert(
  /the single\s*\n?\s*\/\/\s*mode-varying source/.test(workspaceTsx)
    || /single\s+mode-varying source/.test(workspaceTsx),
  'Single-source gate rationale documented in inline comment',
);

console.log('\n=== overview-dynamic.tsx — Skeleton wiring + loading branch ===');
assert(
  /import\s*{\s*Skeleton\s*}\s*from\s*['"]@\/components\/ui\/skeleton['"]/.test(overviewTsx),
  'Skeleton imported from @/components/ui/skeleton',
);
assert(
  /loading\?:\s*boolean/.test(overviewTsx),
  'OverviewDynamic props interface declares optional loading: boolean',
);
assert(
  /export function OverviewDynamic\([^)]*\bloading\b[^)]*\)/.test(overviewTsx),
  'OverviewDynamic component destructures loading from props',
);
assert(
  /<KPICard[\s\S]*?\bloading=\{loading\}/.test(overviewTsx),
  'KPICard receives loading={loading} from parent',
);
assert(
  /\{loading\s*\?\s*\(?[\s\S]{0,300}?<Skeleton[\s\S]{0,200}?data-testid="kpi-skeleton"/.test(overviewTsx),
  'KPICard renders Skeleton with data-testid="kpi-skeleton" in loading branch',
);
// Sanity: the formatted-value div is still present in the else branch
assert(
  /:\s*\(\s*\n?\s*<div className=\{`text-2xl font-bold tabular-nums/.test(overviewTsx),
  'Formatted-value div present in non-loading branch (steady-state render preserved)',
);

console.log('\n=== executive-summary-dynamic.tsx — narrow-gated Skeleton wiring ===');
assert(
  /import\s*{\s*Skeleton\s*}\s*from\s*['"]@\/components\/ui\/skeleton['"]/.test(esTsx),
  'Skeleton imported from @/components/ui/skeleton',
);
assert(
  /loading\?:\s*boolean/.test(esTsx),
  'ExecutiveSummaryDynamic props interface declares optional loading: boolean',
);
assert(
  /export function ExecutiveSummaryDynamic\(\{[\s\S]*?\bloading\b[\s\S]*?\}\s*:/.test(esTsx),
  'ExecutiveSummaryDynamic component destructures loading from props',
);
assert(
  /Year 1 Operating Performance[\s\S]{0,500}<SummaryMetric[\s\S]{0,200}\bloading=\{loading\}/.test(esTsx),
  'Operating-metrics section passes loading={loading} to SummaryMetric (mode-varying gate)',
);
assert(
  /Acquisition[\s\S]{0,500}<SummaryMetric(?![\s\S]{0,300}loading=\{loading\})/.test(esTsx),
  'Acquisition section does NOT pass loading (mode-invariant — no loading-theater)',
);
assert(
  /Investment Returns[\s\S]{0,500}<SummaryMetric(?![\s\S]{0,300}loading=\{loading\})/.test(esTsx),
  'Investment Returns section does NOT pass loading (mode-invariant — no loading-theater)',
);
assert(
  /\{loading\s*\?\s*\(?[\s\S]{0,200}?<Skeleton[\s\S]{0,200}?data-testid="es-revenue-skeleton"/.test(esTsx),
  'Revenue Breakdown values render Skeleton when loading (mode-varying gate)',
);
assert(
  /\{loading\s*\?\s*\(?[\s\S]{0,200}?<Skeleton[\s\S]{0,200}?data-testid="es-summary-skeleton"/.test(esTsx),
  'SummaryMetric sub-component renders Skeleton when loading',
);

console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
