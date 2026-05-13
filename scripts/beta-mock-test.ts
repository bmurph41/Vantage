/**
 * scripts/beta-mock-test.ts
 *
 * Task #398 — Beta Mock Test: 10-run financial model pipeline validation.
 *
 * Pipeline per run (5 model steps):
 *   1. DCF           POST /api/modeling/projects/:id/dcf/run
 *   2. Monte Carlo   POST /api/modeling/projects/:id/dcf/monte-carlo
 *   3. Exit Scenario POST /api/modeling/projects/:id/exit/scenarios
 *   4. Waterfall     POST /api/modeling/projects/:id/waterfall
 *   5. Decision Sup. GET  /api/modeling/projects/:id/dcf/decision-support
 *
 * Setup per run:   POST   /api/modeling/projects   (create project)
 * Cleanup per run: DELETE /api/modeling/projects/:id
 *
 * Determinism: deep JSON comparison run-1..9 vs run-0 baseline, epsilon=1e-9.
 * Exit code 1 if any step fails OR any determinism drift is detected.
 *
 * Usage:
 *   npx tsx scripts/beta-mock-test.ts [--base-url http://localhost:5000]
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = (() => {
  const idx = process.argv.indexOf('--base-url');
  return idx !== -1 ? process.argv[idx + 1] : 'http://localhost:5000';
})();

const TOTAL_RUNS = 10;
const RUNS_DIR = path.resolve(process.cwd(), 'runs');

const FIXTURE_PATH = path.resolve(
  process.cwd(),
  'tests/fixtures/beta-deal-marina.json'
);

const ORG_ID = 'cd3719c3-ef82-4ccc-acb9-261c80fb64b4';
const EPSILON = 1e-9;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StepName =
  | 'dcf'
  | 'monte-carlo'
  | 'exit-scenarios'
  | 'waterfall'
  | 'decision-support';

const STEP_NAMES: StepName[] = [
  'dcf',
  'monte-carlo',
  'exit-scenarios',
  'waterfall',
  'decision-support',
];

interface StepResult {
  step: StepName;
  passed: boolean;
  statusCode: number;
  data: unknown;
  error?: string;
  durationMs: number;
}

interface RunResult {
  runIndex: number;
  projectId: string | null;
  steps: StepResult[];
  allStepsPassed: boolean;
  driftPaths: string[];
}

interface DivergencePath {
  path: string;
  run: number;
  baseline: unknown;
  actual: unknown;
  delta?: number;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function apiRequest(
  method: 'GET' | 'POST' | 'DELETE',
  urlPath: string,
  body?: unknown
): Promise<{ statusCode: number; data: unknown }> {
  const url = `${BASE_URL}${urlPath}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-org-id': ORG_ID,
  };

  const options: RequestInit = {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  const response = await fetch(url, options);
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { statusCode: response.status, data };
}

// ---------------------------------------------------------------------------
// Deep determinism comparison — epsilon 1e-9 for floats, ordered array check
// ---------------------------------------------------------------------------

function deepCompare(
  baseline: unknown,
  actual: unknown,
  currentPath: string,
  divergences: DivergencePath[],
  runIndex: number
): void {
  if (baseline === null && actual === null) return;
  if (baseline === undefined && actual === undefined) return;

  const bType = typeof baseline;
  const aType = typeof actual;

  if (bType !== aType) {
    divergences.push({ path: currentPath, run: runIndex, baseline, actual });
    return;
  }

  if (bType === 'number') {
    const delta = Math.abs((baseline as number) - (actual as number));
    if (delta > EPSILON) {
      divergences.push({ path: currentPath, run: runIndex, baseline, actual, delta });
    }
    return;
  }

  if (bType === 'string' || bType === 'boolean') {
    if (baseline !== actual) {
      divergences.push({ path: currentPath, run: runIndex, baseline, actual });
    }
    return;
  }

  if (Array.isArray(baseline)) {
    if (!Array.isArray(actual)) {
      divergences.push({ path: currentPath, run: runIndex, baseline, actual });
      return;
    }
    const bArr = baseline as unknown[];
    const aArr = actual as unknown[];
    if (bArr.length !== aArr.length) {
      divergences.push({
        path: `${currentPath}.length`,
        run: runIndex,
        baseline: bArr.length,
        actual: aArr.length,
      });
      return;
    }
    for (let i = 0; i < bArr.length; i++) {
      deepCompare(bArr[i], aArr[i], `${currentPath}[${i}]`, divergences, runIndex);
    }
    return;
  }

  if (bType === 'object' && baseline !== null) {
    const bObj = baseline as Record<string, unknown>;
    const aObj = actual as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(bObj), ...Object.keys(aObj)]);
    for (const key of allKeys) {
      deepCompare(bObj[key], aObj[key], `${currentPath}.${key}`, divergences, runIndex);
    }
  }
}

// ---------------------------------------------------------------------------
// Metric extractors (for per-run stdout and report table)
// ---------------------------------------------------------------------------

interface RunMetrics {
  irr: string;
  npv: string;
  exitValue: string;
  equityMultiple: string;
  mcP50: string;
  mcP10: string;
  mcP90: string;
  waterfallLpIRR: string;
  waterfallGpIRR: string;
  dsRating: string;
}

function extractMetrics(run: RunResult): RunMetrics {
  const get = (step: StepName) =>
    run.steps.find((s) => s.step === step)?.data as any;

  const dcf = get('dcf');
  const mc = get('monte-carlo');
  const wf = get('waterfall');
  const ds = get('decision-support');

  const fmt = (v: unknown): string => {
    if (v === null || v === undefined) return 'N/A';
    if (typeof v === 'number') return v.toFixed(4);
    return String(v);
  };

  return {
    irr:           fmt(dcf?.irr ?? dcf?.metrics?.irr ?? dcf?.results?.irr),
    npv:           fmt(dcf?.npv ?? dcf?.metrics?.npv ?? dcf?.results?.npv),
    exitValue:     fmt(dcf?.exitValue ?? dcf?.metrics?.exitValue ?? dcf?.results?.exitValue),
    equityMultiple:fmt(dcf?.equityMultiple ?? dcf?.metrics?.equityMultiple ?? dcf?.results?.equityMultiple),
    mcP50:         fmt(mc?.percentiles?.p50 ?? mc?.p50 ?? mc?.results?.p50),
    mcP10:         fmt(mc?.percentiles?.p10 ?? mc?.p10 ?? mc?.results?.p10),
    mcP90:         fmt(mc?.percentiles?.p90 ?? mc?.p90 ?? mc?.results?.p90),
    waterfallLpIRR:fmt(wf?.summary?.lpIRR),
    waterfallGpIRR:fmt(wf?.summary?.gpIRR),
    dsRating:      String(ds?.rating ?? ds?.recommendation?.rating ?? ds?.verdict ?? 'N/A'),
  };
}

// ---------------------------------------------------------------------------
// Single run execution
// ---------------------------------------------------------------------------

async function executeRun(
  runIndex: number,
  fixture: Record<string, unknown>
): Promise<RunResult> {
  const runDir = path.join(RUNS_DIR, `run-${runIndex}`);
  fs.mkdirSync(runDir, { recursive: true });

  const projectFixture  = fixture.project        as Record<string, unknown>;
  const scenarioFixture = fixture.scenario        as Record<string, unknown>;
  const dcfFixture      = fixture.dcf             as Record<string, unknown>;
  const mcFixture       = fixture.monteCarlo      as Record<string, unknown>;
  const exitFixture     = fixture.exitScenario    as Record<string, unknown>;
  const waterfallFixture= fixture.waterfall       as Record<string, unknown>;
  const dsFixture       = fixture.decisionSupport as Record<string, unknown>;

  let projectId: string | null = null;
  const steps: StepResult[] = [];

  // ---- Helper: execute one step, save file, record result ----
  const execStep = async (
    step: StepName,
    fn: () => Promise<{ statusCode: number; data: unknown }>
  ): Promise<boolean> => {
    const t0 = Date.now();
    let result: { statusCode: number; data: unknown };
    try {
      result = await fn();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      steps.push({ step, passed: false, statusCode: 0, data: null, error: errMsg, durationMs: Date.now() - t0 });
      fs.writeFileSync(
        path.join(runDir, 'error.json'),
        JSON.stringify({ run: runIndex, step, error: errMsg }, null, 2)
      );
      console.error(`  [run-${runIndex}] ✗ ${step}: ${errMsg}`);
      return false;
    }

    const passed = result.statusCode >= 200 && result.statusCode < 300;
    steps.push({ step, passed, statusCode: result.statusCode, data: result.data, durationMs: Date.now() - t0 });
    fs.writeFileSync(path.join(runDir, `${step}.json`), JSON.stringify(result.data, null, 2));

    if (!passed) {
      const detail = JSON.stringify(result.data).slice(0, 300);
      fs.writeFileSync(
        path.join(runDir, 'error.json'),
        JSON.stringify({ run: runIndex, step, statusCode: result.statusCode, detail }, null, 2)
      );
      console.error(`  [run-${runIndex}] ✗ ${step}: HTTP ${result.statusCode} — ${detail}`);
    } else {
      console.log(`  [run-${runIndex}] ✓ ${step} (${Date.now() - t0}ms)`);
    }
    return passed;
  };

  // ---- Setup: create project ----
  try {
    const cr = await apiRequest('POST', '/api/modeling/projects', projectFixture);
    const crData = cr.data as Record<string, unknown> | null;
    projectId = ((crData?.id ?? crData?.project?.id) ?? null) as string | null;

    if (cr.statusCode < 200 || cr.statusCode >= 300 || !projectId) {
      console.error(`  [run-${runIndex}] ✗ create-project: HTTP ${cr.statusCode}`);
      fs.writeFileSync(
        path.join(runDir, 'error.json'),
        JSON.stringify({ run: runIndex, step: 'create-project', statusCode: cr.statusCode, detail: crData }, null, 2)
      );
      return { runIndex, projectId: null, steps, allStepsPassed: false, driftPaths: [] };
    }
    fs.writeFileSync(path.join(runDir, 'create-project.json'), JSON.stringify(crData, null, 2));
    console.log(`  [run-${runIndex}] ✓ create-project  projectId=${projectId}`);
  } catch (err) {
    console.error(`  [run-${runIndex}] ✗ create-project: ${err}`);
    return { runIndex, projectId: null, steps, allStepsPassed: false, driftPaths: [] };
  }

  // ---- Setup: create scenario (saves revenueGrowthRate, expenseGrowthRate, exitCapRate to DB) ----
  try {
    await apiRequest('POST', `/api/modeling/projects/${projectId}/scenarios`, {
      scenarioType:      scenarioFixture.scenarioType,
      name:              scenarioFixture.name,
      revenueGrowthRate: scenarioFixture.revenueGrowthRate,
      expenseGrowthRate: scenarioFixture.expenseGrowthRate,
      exitCapRate:       scenarioFixture.exitCapRate,
    });
  } catch {
    // non-fatal — DCF overrides below provide a fallback
  }

  // ---- Setup: patch project config (saves holdPeriod=10 to DB) ----
  try {
    const cfg = fixture.projectConfig as Record<string, unknown>;
    await apiRequest('PATCH', `/api/modeling/projects/${projectId}/config`, {
      holdPeriod: cfg.holdPeriod,
    });
  } catch {
    // non-fatal — DCF overrides below provide a fallback
  }

  // ---- Step 1: DCF (POST /api/modeling/projects/:id/dcf) ----
  // overrides serve as fallback if DB scenario/config is not yet applied.
  await execStep('dcf', () =>
    apiRequest('POST', `/api/modeling/projects/${projectId}/dcf`, {
      discountRate: (dcfFixture.discountRate as number) ?? 10,
      overrides: {
        holdPeriodYears:         (fixture.projectConfig as any).holdPeriod,
        revenueGrowthRateDelta:  0.5,   // default 3% + 0.5 = 3.5%
        exitCapRateDelta:        -0.25, // default 7.0% - 0.25 = 6.75%
      },
    })
  );

  // ---- Step 2: Monte Carlo ----
  await execStep('monte-carlo', () =>
    apiRequest('POST', `/api/modeling/projects/${projectId}/dcf/monte-carlo`, {
      n:            mcFixture.n,
      seed:         mcFixture.seed,
      hurdleIRR:    mcFixture.hurdleIRR,
      discountRate: mcFixture.discountRate,
    })
  );

  // ---- Step 3: Exit Scenarios ----
  await execStep('exit-scenarios', () =>
    apiRequest('POST', `/api/modeling/projects/${projectId}/exit/scenarios`, exitFixture)
  );

  // ---- Step 4: Waterfall ----
  await execStep('waterfall', () =>
    apiRequest('POST', `/api/modeling/projects/${projectId}/waterfall`, waterfallFixture)
  );

  // ---- Step 5: Decision Support — GET (fast mode, deterministic, no MC re-run) ----
  await execStep('decision-support', () => {
    const { hurdleIRR, discountRate, memoTone } = dsFixture as {
      hurdleIRR: number; discountRate: number; memoTone: string;
    };
    const qs = new URLSearchParams({
      hurdleIRR:    String(hurdleIRR),
      discountRate: String(discountRate),
      memoTone:     String(memoTone),
    });
    return apiRequest('GET', `/api/modeling/projects/${projectId}/dcf/decision-support?${qs}`);
  });

  // ---- Cleanup: delete project ----
  try {
    await apiRequest('DELETE', `/api/modeling/projects/${projectId}`);
    console.log(`  [run-${runIndex}] ✓ cleanup — deleted project ${projectId}`);
  } catch {
    console.warn(`  [run-${runIndex}] ⚠ cleanup failed (non-fatal)`);
  }

  const allStepsPassed = steps.length === STEP_NAMES.length && steps.every((s) => s.passed);
  return { runIndex, projectId, steps, allStepsPassed, driftPaths: [] };
}

// ---------------------------------------------------------------------------
// Determinism check — deep JSON comparison run-1..9 vs run-0
// ---------------------------------------------------------------------------

function checkDeterminism(runs: RunResult[]): {
  divergences: DivergencePath[];
  byStep: Record<StepName, boolean>;
} {
  const baseline = runs[0];
  const allDivergences: DivergencePath[] = [];
  const byStep: Record<StepName, boolean> = {
    'dcf': true, 'monte-carlo': true, 'exit-scenarios': true,
    'waterfall': true, 'decision-support': true,
  };

  for (let r = 1; r < runs.length; r++) {
    for (const stepName of STEP_NAMES) {
      const bStep = baseline.steps.find((s) => s.step === stepName);
      const aStep = runs[r].steps.find((s) => s.step === stepName);
      if (!bStep?.passed || !aStep?.passed) continue;

      const divs: DivergencePath[] = [];
      deepCompare(bStep.data, aStep.data, stepName, divs, r);
      if (divs.length > 0) {
        byStep[stepName] = false;
        allDivergences.push(...divs);
      }
    }
  }

  return { divergences: allDivergences, byStep };
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

function generateReport(
  runs: RunResult[],
  divergences: DivergencePath[],
  byStep: Record<StepName, boolean>
): string {
  const now = new Date().toISOString();
  const totalCells = runs.length * STEP_NAMES.length;
  const passedCells = runs.reduce((n, r) => n + r.steps.filter((s) => s.passed).length, 0);

  const cell = (run: RunResult, step: StepName) => {
    const s = run.steps.find((st) => st.step === step);
    if (!s) return '—';
    return s.passed ? 'PASS' : `FAIL(${s.statusCode})`;
  };

  const matrixRows = runs.map((r) =>
    `| ${r.runIndex} | ${cell(r,'dcf')} | ${cell(r,'monte-carlo')} | ${cell(r,'exit-scenarios')} | ${cell(r,'waterfall')} | ${cell(r,'decision-support')} |`
  ).join('\n');

  const detRows = STEP_NAMES.map(
    (s) => `| ${s} | ${byStep[s] ? '✅ IDENTICAL' : '❌ DRIFT'} |`
  ).join('\n');

  const divSection =
    divergences.length === 0
      ? '_None — all 10 runs produced numerically identical outputs (ε = 1e-9)._'
      : divergences.slice(0, 50).map(
          (d) => `- **run-${d.run}** \`${d.path}\`: baseline \`${d.baseline}\` ≠ actual \`${d.actual}\`${d.delta !== undefined ? ` (Δ = ${d.delta})` : ''}`
        ).join('\n') + (divergences.length > 50 ? `\n\n_(…${divergences.length - 50} more omitted)_` : '');

  const metricsRows = runs.map((r) => {
    const m = extractMetrics(r);
    return `| ${r.runIndex} | ${m.irr} | ${m.npv} | ${m.equityMultiple} | ${m.mcP50} | ${m.mcP10}–${m.mcP90} | ${m.waterfallLpIRR}/${m.waterfallGpIRR} | ${m.dsRating} |`;
  }).join('\n');

  return `# Beta Mock Test — Validation Report
> Task #398 | Generated: ${now}
> Fixture: \`tests/fixtures/beta-deal-marina.json\`
> Pipeline: ${STEP_NAMES.length} model steps × ${TOTAL_RUNS} runs = ${totalCells} cells

## Results

**Overall: ${passedCells}/${totalCells} cells passed**

### 10 × 5 Pass/Fail Matrix

| Run | dcf | monte-carlo | exit-scenarios | waterfall | decision-support |
|-----|-----|-------------|----------------|-----------|------------------|
${matrixRows}

### Determinism (run-1..9 vs run-0 baseline, ε = 1e-9)

| Step | Result |
|------|--------|
${detRows}

### Divergence Details

${divSection}

### Per-Run Metrics Snapshot

| Run | IRR | NPV | Eq. Multiple | MC p50 | MC p10–p90 | WF LP/GP IRR | DS Rating |
|-----|-----|-----|--------------|--------|------------|--------------|-----------|
${metricsRows}

## Fixture Summary

| Parameter | Value |
|-----------|-------|
| Property | Harborview Marina – Beta Test Fixture |
| Location | Annapolis, MD |
| Purchase Price | $12,500,000 |
| Total Slips | 220 (55×30ft wet, 42×40ft wet, 28×50ft wet, 5×80ft mega, 45 dry stack indoor, 30 dry stack outdoor, 15 transient) |
| Hold Period | 10 years |
| Exit Cap Rate | 6.75% |
| Revenue Growth | 3.5% / yr |
| Expense Growth | 2.5% / yr |
| Debt (65% LTV) | $8,125,000 @ 6.5% |
| LP / GP Equity | $3,937,500 / $437,500 (90% / 10% of $4,375,000) |
| Monte Carlo N | 500 (seed=42) |
| Hurdle IRR | 12% |
| Discount Rate | 10% |
| Waterfall Pref. | 8% preferred return, 20% GP catch-up, 4-tier |

## Environment

| Key | Value |
|-----|-------|
| Base URL | ${BASE_URL} |
| Org ID | ${ORG_ID} |
| Determinism ε | ${EPSILON} |
| Runs | ${TOTAL_RUNS} |
| Steps per run | ${STEP_NAMES.length} |
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Beta Mock Test ===');
  console.log(`Fixture : ${FIXTURE_PATH}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Runs    : ${TOTAL_RUNS}  Steps: ${STEP_NAMES.length} (dcf, monte-carlo, exit-scenarios, waterfall, decision-support)\n`);

  if (!fs.existsSync(FIXTURE_PATH)) {
    console.error(`ERROR: Fixture not found at ${FIXTURE_PATH}`);
    process.exit(1);
  }

  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as Record<string, unknown>;
  fs.mkdirSync(RUNS_DIR, { recursive: true });

  const runs: RunResult[] = [];

  for (let i = 0; i < TOTAL_RUNS; i++) {
    console.log(`\n--- Run ${i} ---`);
    const result = await executeRun(i, fixture);
    runs.push(result);

    const m = extractMetrics(result);
    console.log(
      `  Metrics → IRR=${m.irr}  NPV=${m.npv}  EqMult=${m.equityMultiple}  MCp50=${m.mcP50}  WF_LP_IRR=${m.waterfallLpIRR}  WF_GP_IRR=${m.waterfallGpIRR}  DS=${m.dsRating}`
    );
  }

  // Determinism check
  console.log('\n--- Determinism Check (ε = 1e-9) ---');
  const { divergences, byStep } = checkDeterminism(runs);
  for (const step of STEP_NAMES) {
    console.log(`  ${step}: ${byStep[step] ? '✅ IDENTICAL' : '❌ DRIFT'}`);
  }
  if (divergences.length > 0) {
    console.error(`\n  ⚠ ${divergences.length} divergence(s) detected:`);
    divergences.slice(0, 10).forEach((d) =>
      console.error(`    run-${d.run} ${d.path}: ${d.baseline} ≠ ${d.actual}${d.delta !== undefined ? ` (Δ=${d.delta})` : ''}`)
    );
  } else {
    console.log('  All runs numerically identical.');
  }

  // Write report
  const report = generateReport(runs, divergences, byStep);
  const reportPath = path.join(RUNS_DIR, 'beta-mock-report.md');
  fs.writeFileSync(reportPath, report);
  console.log(`\nReport → ${reportPath}`);

  // Final verdict
  const allStepsPassed = runs.every((r) => r.allStepsPassed);
  const deterministic   = divergences.length === 0;
  const overallPass     = allStepsPassed && deterministic;
  const passed = runs.reduce((n, r) => n + r.steps.filter((s) => s.passed).length, 0);
  const total  = TOTAL_RUNS * STEP_NAMES.length;

  console.log(
    `\n=== ${passed}/${total} cells passed | determinism: ${deterministic ? 'OK' : 'DRIFT'} | ${overallPass ? 'OVERALL PASS ✅' : 'OVERALL FAIL ❌'} ===`
  );

  process.exit(overallPass ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
