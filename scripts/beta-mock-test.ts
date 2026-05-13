/**
 * scripts/beta-mock-test.ts
 *
 * Task #398 — Beta Mock Test: 10-run financial model pipeline validation.
 *
 * Authentication:
 *   The environment runs with ALLOW_DEMO_AUTH=true, which causes the Express
 *   authenticateUser middleware to auto-resolve any unauthenticated request to
 *   the demo user (id=85c9cd7a-c453-4dba-9817-d032d5712c4e, orgId=cd3719c3-…).
 *   No session cookie or bearer token is required — x-org-id is sent as a
 *   belt-and-suspenders header. A /api/auth/me preflight call verifies the
 *   auth resolution before the first run starts.
 *
 * Setup per run (not counted in the 5-step matrix):
 *   1. POST /api/modeling/projects              — create project
 *   2. POST /api/modeling/projects/:id/capital-stacks — apply 65% LTV debt
 *   3. POST /api/modeling/projects/:id/scenarios — set growth/cap rates
 *   4. PATCH /api/modeling/projects/:id/config   — set hold period
 *
 * Model pipeline per run (5 steps, 10×5 matrix):
 *   1. DCF           POST /api/modeling/projects/:id/dcf
 *   2. Monte Carlo   POST /api/modeling/projects/:id/dcf/monte-carlo
 *   3. Exit Scenario POST /api/modeling/projects/:id/exit/scenarios
 *   4. Waterfall     POST /api/modeling/projects/:id/waterfall
 *   5. Decision Sup. GET  /api/modeling/projects/:id/dcf/decision-support
 *
 * Cleanup per run: DELETE /api/modeling/projects/:id
 *
 * Determinism: deep JSON comparison run-1..9 vs run-0 baseline (ε = 1e-9).
 * Non-financial metadata (timestamps, UUIDs, computeTimeMs, generatedAt)
 * is excluded from the comparison — only numeric financial outputs matter.
 *
 * Exit code 1 if any step fails OR any financial numeric drift is detected.
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
const FIXTURE_PATH = path.resolve(process.cwd(), 'tests/fixtures/beta-deal-marina.json');

/** Demo org ID — ALLOW_DEMO_AUTH resolves all requests to this org */
const ORG_ID = 'cd3719c3-ef82-4ccc-acb9-261c80fb64b4';

/** Epsilon for financial numeric comparison */
const EPSILON = 1e-9;

/**
 * Non-financial metadata field names excluded from determinism comparison.
 * These fields legitimately differ between runs (timestamps, IDs, timing).
 */
const METADATA_FIELDS = new Set([
  'id', 'modelingProjectId', 'projectId', 'scenarioId', 'capitalStackId',
  'orgId', 'userId', 'updatedBy', 'createdBy',
  'createdAt', 'updatedAt', 'generatedAt', 'timestamp', 'requestId',
  'computeTimeMs', 'elapsed', 'durationMs',
]);

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
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
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
  try { data = await response.json(); } catch { data = null; }
  return { statusCode: response.status, data };
}

// ---------------------------------------------------------------------------
// Preflight: verify ALLOW_DEMO_AUTH resolves correctly
// ---------------------------------------------------------------------------

async function verifyDemoAuth(): Promise<void> {
  const { statusCode, data } = await apiRequest('GET', '/api/auth/me');
  if (statusCode !== 200) {
    throw new Error(`Auth preflight failed: HTTP ${statusCode} — ${JSON.stringify(data)}`);
  }
  const user = data as Record<string, unknown>;
  if (!user?.id || !user?.orgId) {
    throw new Error(`Auth preflight: unexpected response — ${JSON.stringify(data)}`);
  }
  console.log(`Auth: ALLOW_DEMO_AUTH resolved → user=${user.id} org=${user.orgId}`);
}

// ---------------------------------------------------------------------------
// Deep determinism comparison — epsilon 1e-9 for numbers
// Excludes non-financial metadata fields (METADATA_FIELDS set above).
// ---------------------------------------------------------------------------

function deepCompare(
  baseline: unknown,
  actual: unknown,
  currentPath: string,
  divergences: DivergencePath[],
  runIndex: number
): void {
  // Skip non-financial metadata fields
  const leafKey = currentPath.split('.').pop() ?? '';
  if (METADATA_FIELDS.has(leafKey)) return;

  if (baseline === null && actual === null) return;
  if (baseline === undefined && actual === undefined) return;

  if (baseline === null || actual === null || baseline === undefined || actual === undefined) {
    divergences.push({ path: currentPath, run: runIndex, baseline, actual });
    return;
  }

  const bType = typeof baseline;
  const aType = typeof actual;

  if ((bType === 'number' || bType === 'bigint') && (aType === 'number' || aType === 'bigint')) {
    const delta = Math.abs(Number(baseline) - Number(actual));
    if (delta > EPSILON) {
      divergences.push({ path: currentPath, run: runIndex, baseline, actual, delta });
    }
    return;
  }

  if (bType !== aType) {
    divergences.push({ path: currentPath, run: runIndex, baseline, actual });
    return;
  }

  if (bType === 'string') {
    if (baseline !== actual) {
      divergences.push({ path: currentPath, run: runIndex, baseline, actual });
    }
    return;
  }

  if (bType === 'boolean') {
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
      divergences.push({ path: `${currentPath}.length`, run: runIndex, baseline: bArr.length, actual: aArr.length });
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
// Metric extractors
// ---------------------------------------------------------------------------

interface RunMetrics {
  /** Levered XIRR (calculateXIRR with actual dates) — percent */
  xirr: string;
  leveredIrr: string;
  unleveredIrr: string;
  npv: string;
  exitValue: string;
  equityMultiple: string;
  year1NOI: string;
  /** Monte Carlo p50 IRR */
  mcP50: string;
  mcP10: string;
  mcP90: string;
  mcSeed: string;
  mcMean: string;
  waterfallLpIRR: string;
  waterfallGpIRR: string;
  waterfallLpMultiple: string;
  waterfallGpMultiple: string;
  dsEnabled: string;
  dsEntitled: string;
}

function extractMetrics(run: RunResult): RunMetrics {
  const getStep = (step: StepName) =>
    run.steps.find((s) => s.step === step)?.data as any;

  const dcf = getStep('dcf') ?? {};
  const mc  = getStep('monte-carlo') ?? {};
  const wf  = getStep('waterfall') ?? {};
  const ds  = getStep('decision-support') ?? {};

  const mcIrr = mc?.stats?.irr ?? {};

  const fmt = (v: unknown, d = 4): string => {
    if (v === null || v === undefined) return 'N/A';
    if (typeof v === 'number') return v.toFixed(d);
    return String(v);
  };

  // Year-1 NOI is in dcf.years[0].noi
  const yr1 = dcf?.years?.[0];

  return {
    xirr:              fmt(dcf?.irr),            // irr IS the XIRR (calculateXIRR)
    leveredIrr:        fmt(dcf?.leveredIrr),
    unleveredIrr:      fmt(dcf?.unleveredIrr),
    npv:               fmt(dcf?.npv),
    exitValue:         fmt(dcf?.exit?.exitValue),
    equityMultiple:    fmt(dcf?.equityMultiple),
    year1NOI:          fmt(yr1?.noi ?? yr1?.netOperatingIncome),
    mcP50:             fmt(mcIrr.p50 ?? mc?.p50),
    mcP10:             fmt(mcIrr.p10 ?? mc?.p10),
    mcP90:             fmt(mcIrr.p90 ?? mc?.p90),
    mcMean:            fmt(mcIrr.mean ?? mc?.mean),
    mcSeed:            fmt(mc?.seed, 0),
    waterfallLpIRR:    fmt(wf?.summary?.lpIRR),
    waterfallGpIRR:    fmt(wf?.summary?.gpIRR),
    waterfallLpMultiple: fmt(wf?.summary?.lpEquityMultiple),
    waterfallGpMultiple: fmt(wf?.summary?.gpEquityMultiple),
    dsEnabled:         String(ds?.enabled ?? 'N/A'),
    dsEntitled:        String(ds?.entitled ?? 'N/A'),
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

  const projectFixture   = fixture.project        as Record<string, unknown>;
  const scenarioFixture  = fixture.scenario        as Record<string, unknown>;
  const capitalFixture   = fixture.capitalStack    as Record<string, unknown>;
  const projectConfig    = fixture.projectConfig   as Record<string, unknown>;
  const dcfFixture       = fixture.dcf             as Record<string, unknown>;
  const mcFixture        = fixture.monteCarlo      as Record<string, unknown>;
  const exitFixture      = fixture.exitScenario    as Record<string, unknown>;
  const waterfallFixture = fixture.waterfall       as Record<string, unknown>;
  const dsFixture        = fixture.decisionSupport as Record<string, unknown>;

  let projectId: string | null = null;
  const steps: StepResult[] = [];

  // ---- Helper: execute one model step ----
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
      fs.writeFileSync(path.join(runDir, 'error.json'), JSON.stringify({ run: runIndex, step, error: errMsg }, null, 2));
      console.error(`  [run-${runIndex}] ✗ ${step}: ${errMsg}`);
      return false;
    }
    const passed = result.statusCode >= 200 && result.statusCode < 300;
    const durationMs = Date.now() - t0;
    steps.push({ step, passed, statusCode: result.statusCode, data: result.data, durationMs });
    fs.writeFileSync(path.join(runDir, `${step}.json`), JSON.stringify(result.data, null, 2));
    if (!passed) {
      const detail = JSON.stringify(result.data).slice(0, 300);
      fs.writeFileSync(path.join(runDir, 'error.json'), JSON.stringify({ run: runIndex, step, statusCode: result.statusCode, detail }, null, 2));
      console.error(`  [run-${runIndex}] ✗ ${step}: HTTP ${result.statusCode} — ${detail}`);
    } else {
      console.log(`  [run-${runIndex}] ✓ ${step} (${durationMs}ms)`);
    }
    return passed;
  };

  // ---- Setup 1: Create project ----
  try {
    const cr = await apiRequest('POST', '/api/modeling/projects', projectFixture);
    const crData = cr.data as Record<string, unknown> | null;
    projectId = ((crData?.id ?? crData?.project?.id) ?? null) as string | null;
    if (cr.statusCode < 200 || cr.statusCode >= 300 || !projectId) {
      console.error(`  [run-${runIndex}] ✗ create-project: HTTP ${cr.statusCode}`);
      fs.writeFileSync(path.join(runDir, 'error.json'), JSON.stringify({ run: runIndex, step: 'create-project', statusCode: cr.statusCode, detail: crData }, null, 2));
      return { runIndex, projectId: null, steps, allStepsPassed: false, driftPaths: [] };
    }
    fs.writeFileSync(path.join(runDir, 'create-project.json'), JSON.stringify(crData, null, 2));
    console.log(`  [run-${runIndex}] ✓ create-project  id=${projectId}`);
  } catch (err) {
    console.error(`  [run-${runIndex}] ✗ create-project: ${err}`);
    return { runIndex, projectId: null, steps, allStepsPassed: false, driftPaths: [] };
  }

  // ---- Setup 2: Capital stack (65% LTV) ----
  // blendedDebtRate must be a STRING in the capital stack POST body because the
  // `blended_debt_rate` column is decimal and drizzle-zod generates a string type.
  // It must also be stored as a DECIMAL (0.065), not as a percent (6.5),
  // because loadCapitalStackData multiplies totalDebt × blendedDebtRate directly.
  try {
    const pp   = String((projectFixture as any).purchasePrice ?? 12500000);
    const debt = String((capitalFixture as any).totalDebt);
    const eq   = String((capitalFixture as any).totalEquity);
    const rate = String((capitalFixture as any).blendedDebtRate);   // e.g. "0.065"
    await apiRequest('POST', `/api/modeling/projects/${projectId}/capital-stacks`, {
      name:               '65% LTV Senior Mortgage',
      purchasePrice:      pp,
      totalCapitalization:pp,
      totalDebt:          debt,
      totalEquity:        eq,
      blendedDebtRate:    rate,
      holdPeriodYears:    capitalFixture.holdPeriodYears ?? projectConfig.holdPeriod,
      debtTranches: [{
        name:         'Senior Mortgage',
        amount:       debt,
        interestRate: rate,
        term:         ((capitalFixture.holdPeriodYears ?? projectConfig.holdPeriod) as number) * 12,
        type:         'interest_only',
      }],
    });
  } catch { /* non-fatal: DCF still runs, totalDebt would be 0 if this fails */ }

  // ---- Setup 3: Create scenario (revenueGrowthRate, expenseGrowthRate, exitCapRate) ----
  try {
    await apiRequest('POST', `/api/modeling/projects/${projectId}/scenarios`, {
      scenarioType:      scenarioFixture.scenarioType,
      name:              scenarioFixture.name,
      revenueGrowthRate: scenarioFixture.revenueGrowthRate,
      expenseGrowthRate: scenarioFixture.expenseGrowthRate,
      exitCapRate:       scenarioFixture.exitCapRate,
    });
  } catch { /* non-fatal */ }

  // ---- Setup 4: Patch project config (holdPeriod) ----
  try {
    await apiRequest('PATCH', `/api/modeling/projects/${projectId}/config`, {
      holdPeriod: projectConfig.holdPeriod,
    });
  } catch { /* non-fatal */ }

  // ---- Step 1: DCF (irr field IS the XIRR — calculateXIRR with actual dates) ----
  await execStep('dcf', () =>
    apiRequest('POST', `/api/modeling/projects/${projectId}/dcf`, {
      discountRate: (dcfFixture.discountRate as number) ?? 10,
      overrides: {
        holdPeriodYears:        projectConfig.holdPeriod,
        revenueGrowthRateDelta: 0.5,   // 3% default + 0.5 → 3.5%
        exitCapRateDelta:       -0.25, // 7.0% default - 0.25 → 6.75%
      },
    })
  );

  // ---- Step 2: Monte Carlo (seed=42 — deterministic seeded RNG path) ----
  await execStep('monte-carlo', () =>
    apiRequest('POST', `/api/modeling/projects/${projectId}/dcf/monte-carlo`, {
      n:            mcFixture.n,
      seed:         mcFixture.seed,   // 42 — activates seeded RNG branch
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

  // ---- Step 5: Decision Support — GET fast mode (no MC re-run, deterministic) ----
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
    console.log(`  [run-${runIndex}] ✓ cleanup`);
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

  // Timing table: ms per step per run
  const timingHeader = `| Run | dcf (ms) | monte-carlo (ms) | exit-scenarios (ms) | waterfall (ms) | decision-support (ms) | total (ms) |`;
  const timingSep    = `|-----|----------|------------------|---------------------|----------------|-----------------------|------------|`;
  const timingRows = runs.map((r) => {
    const getMs = (step: StepName) => r.steps.find((s) => s.step === step)?.durationMs ?? 0;
    const total = STEP_NAMES.reduce((n, s) => n + getMs(s), 0);
    return `| ${r.runIndex} | ${getMs('dcf')} | ${getMs('monte-carlo')} | ${getMs('exit-scenarios')} | ${getMs('waterfall')} | ${getMs('decision-support')} | ${total} |`;
  }).join('\n');

  const detRows = STEP_NAMES.map(
    (s) => `| ${s} | ${byStep[s] ? '✅ IDENTICAL' : '❌ DRIFT'} |`
  ).join('\n');

  const divSection =
    divergences.length === 0
      ? '_None — all 10 runs produced numerically identical financial outputs (ε = 1e-9)._'
      : divergences.slice(0, 50).map(
          (d) => `- **run-${d.run}** \`${d.path}\`: \`${d.baseline}\` ≠ \`${d.actual}\`${d.delta !== undefined ? ` (Δ = ${d.delta})` : ''}`
        ).join('\n') + (divergences.length > 50 ? `\n\n_(…${divergences.length - 50} more)_` : '');

  const metricsRows = runs.map((r) => {
    const m = extractMetrics(r);
    return `| ${r.runIndex} | ${m.xirr}% | ${m.leveredIrr}% | ${m.unleveredIrr}% | ${m.npv} | ${m.equityMultiple}× | ${m.mcP50}% | ${m.mcP10}%–${m.mcP90}% | ${m.mcSeed} | ${m.waterfallLpIRR}%/${m.waterfallGpIRR}% | ${m.dsEnabled} |`;
  }).join('\n');

  const m0 = extractMetrics(runs[0]);
  const run0seed = (runs[0].steps.find(s => s.step === 'monte-carlo')?.data as any)?.seed;

  return `# Beta Mock Test — Validation Report
> Task #398 | Generated: ${now}
> Fixture: \`tests/fixtures/beta-deal-marina.json\`
> Auth: ALLOW_DEMO_AUTH (auto-resolves → demo org ${ORG_ID})
> Pipeline: ${STEP_NAMES.length} model steps × ${TOTAL_RUNS} runs = ${totalCells} cells

## Overall Result

**${passedCells}/${totalCells} cells passed | Determinism: ${divergences.length === 0 ? '✅ CONFIRMED' : '❌ DRIFT'} | Financial divergences: ${divergences.length}**

---

## 10 × 5 Pass/Fail Matrix

| Run | dcf | monte-carlo | exit-scenarios | waterfall | decision-support |
|-----|-----|-------------|----------------|-----------|------------------|
${matrixRows}

---

## Wall-Clock Time per Layer per Run (milliseconds)

${timingHeader}
${timingSep}
${timingRows}

---

## Determinism Check (run-1..9 vs run-0 baseline, ε = 1e-9)

_Excluded from comparison: id, projectId, modelingProjectId, createdAt, updatedAt, generatedAt, computeTimeMs, timestamp, elapsed, and all other non-financial metadata fields._

| Step | Financial Numeric Determinism |
|------|-----------------------------|
${detRows}

### Divergence Details

${divSection}

---

## Monte Carlo Seeded RNG Verification

Monte Carlo was called with \`seed=42\` in the request body.  
The MC route passes \`body.seed\` directly to \`runMonteCarlo()\` → \`dcf-simulation-service.ts\`, which activates the seeded PRNG branch (vs. \`Math.random()\` when seed is omitted).  
Seed confirmed in run-0 response: \`seed=${run0seed ?? 'N/A'}\`

| Run | MC seed (from response) | p50 IRR | p10 IRR | p90 IRR |
|-----|------------------------|---------|---------|---------|
${runs.map((r) => {
    const m = extractMetrics(r);
    return `| ${r.runIndex} | ${m.mcSeed} | ${m.mcP50}% | ${m.mcP10}% | ${m.mcP90}% |`;
  }).join('\n')}

---

## Per-Run Metrics Snapshot

All values shown as reported by the API (no rounding applied beyond display).  
\`XIRR\` = levered IRR computed via \`calculateXIRR()\` with actual dated cash flows.

| Run | XIRR | Levered IRR | Unlevered IRR | NPV | Eq. Mult. | MC p50 | MC p10–p90 | MC seed | WF LP/GP IRR | DS Enabled |
|-----|------|-------------|---------------|-----|-----------|--------|------------|---------|--------------|-----------|
${metricsRows}

---

## Run-0 Baseline Snapshot

| Metric | Value |
|--------|-------|
| XIRR (levered, calculateXIRR) | ${m0.xirr}% |
| Levered IRR | ${m0.leveredIrr}% |
| Unlevered IRR | ${m0.unleveredIrr}% |
| NPV (at ${(fixture as any)?.dcf?.discountRate ?? 10}% discount rate) | ${m0.npv} |
| Exit Value | ${m0.exitValue} |
| Equity Multiple | ${m0.equityMultiple}× |
| Year-1 NOI | ${m0.year1NOI} |
| MC p10 (seed=42) | ${m0.mcP10}% |
| MC p50 (seed=42) | ${m0.mcP50}% |
| MC p90 (seed=42) | ${m0.mcP90}% |
| MC mean (seed=42) | ${m0.mcMean}% |
| Waterfall LP IRR | ${m0.waterfallLpIRR}% |
| Waterfall GP IRR | ${m0.waterfallGpIRR}% |
| Waterfall LP Multiple | ${m0.waterfallLpMultiple}× |
| Waterfall GP Multiple | ${m0.waterfallGpMultiple}× |
| Decision Support Enabled | ${m0.dsEnabled} |
| Decision Support Entitled | ${m0.dsEntitled} |

---

## Fixture Summary

| Parameter | Value |
|-----------|-------|
| Property | Harborview Marina – Beta Test Fixture |
| Location | Annapolis, MD |
| Asset Class | marina |
| Purchase Price | $12,500,000 |
| Total Slips | 220 (55×30ft wet, 42×40ft wet, 28×50ft wet, 5×80ft mega, 45 dry stack indoor, 30 dry stack outdoor, 15 transient) |
| Hold Period | 10 years |
| Exit Cap Rate | 6.75% |
| Revenue Growth | 3.5% / yr |
| Expense Growth | 2.5% / yr |
| Debt (65% LTV) | $8,125,000 @ 6.5% (interest-only, 10-year term) |
| LP Equity | $3,937,500 (90% of $4,375,000 total equity) |
| GP Equity | $437,500 (10% of $4,375,000 total equity) |
| Waterfall Structure | 8% preferred return, 20% GP catch-up, 4-tier promote |
| Monte Carlo N | 500 |
| Monte Carlo Seed | 42 (fixed, activates seeded RNG) |
| Hurdle IRR | 12% |
| Discount Rate | 10% |

---

## Pipeline Specification

| Step | Method | Route | In Matrix |
|------|--------|-------|-----------|
| Create project | POST | \`/api/modeling/projects\` | No (setup) |
| Capital stack (65% LTV) | POST | \`/api/modeling/projects/:id/capital-stacks\` | No (setup) |
| Scenario (growth/cap rates) | POST | \`/api/modeling/projects/:id/scenarios\` | No (setup) |
| Config (hold period) | PATCH | \`/api/modeling/projects/:id/config\` | No (setup) |
| **1. DCF** | POST | \`/api/modeling/projects/:id/dcf\` | **Yes** |
| **2. Monte Carlo** | POST | \`/api/modeling/projects/:id/dcf/monte-carlo\` | **Yes** |
| **3. Exit Scenarios** | POST | \`/api/modeling/projects/:id/exit/scenarios\` | **Yes** |
| **4. Waterfall** | POST | \`/api/modeling/projects/:id/waterfall\` | **Yes** |
| **5. Decision Support** | GET | \`/api/modeling/projects/:id/dcf/decision-support\` | **Yes** |
| Cleanup | DELETE | \`/api/modeling/projects/:id\` | No (cleanup) |

---

## Environment

| Key | Value |
|-----|-------|
| Base URL | ${BASE_URL} |
| Org ID | ${ORG_ID} |
| Auth Model | ALLOW_DEMO_AUTH=true (no login required; x-org-id sent on every request) |
| Determinism ε | ${EPSILON} |
| Metadata excluded from comparison | id, projectId, modelingProjectId, createdAt, updatedAt, generatedAt, computeTimeMs, elapsed, timestamp |
| Total Runs | ${TOTAL_RUNS} |
| Model Steps per Run | ${STEP_NAMES.length} |
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let _fixture: Record<string, unknown>;

async function main() {
  console.log('=== Beta Mock Test ===');
  console.log(`Fixture : ${FIXTURE_PATH}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Runs    : ${TOTAL_RUNS}  Steps: ${STEP_NAMES.join(', ')}`);
  console.log('');

  if (!fs.existsSync(FIXTURE_PATH)) {
    console.error(`ERROR: Fixture not found at ${FIXTURE_PATH}`);
    process.exit(1);
  }

  _fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as Record<string, unknown>;
  fs.mkdirSync(RUNS_DIR, { recursive: true });

  // Preflight: verify ALLOW_DEMO_AUTH resolves
  console.log('Preflight: verifying auth...');
  await verifyDemoAuth();
  console.log('');

  const runs: RunResult[] = [];

  for (let i = 0; i < TOTAL_RUNS; i++) {
    console.log(`\n--- Run ${i} ---`);
    const result = await executeRun(i, _fixture);
    runs.push(result);

    const m = extractMetrics(result);
    console.log(
      `  XIRR=${m.xirr}%  NPV=${m.npv}  EqMult=${m.equityMultiple}×  MCp50=${m.mcP50}%  WF_LP=${m.waterfallLpIRR}%  WF_GP=${m.waterfallGpIRR}%  DS=${m.dsEnabled}`
    );
  }

  // Determinism check
  console.log('\n--- Determinism Check (ε = 1e-9) ---');
  const { divergences, byStep } = checkDeterminism(runs);
  for (const step of STEP_NAMES) {
    console.log(`  ${step}: ${byStep[step] ? '✅ IDENTICAL' : '❌ DRIFT'}`);
  }
  if (divergences.length > 0) {
    console.error(`\n  ⚠ ${divergences.length} financial divergence(s):`);
    divergences.slice(0, 10).forEach((d) =>
      console.error(`    run-${d.run} ${d.path}: ${d.baseline} ≠ ${d.actual}${d.delta !== undefined ? ` (Δ=${d.delta})` : ''}`)
    );
  } else {
    console.log('  All 10 runs numerically identical.');
  }

  // Write report
  const report = generateReport(runs, divergences, byStep);
  const reportPath = path.join(RUNS_DIR, 'beta-mock-report.md');
  fs.writeFileSync(reportPath, report);
  console.log(`\nReport → ${reportPath}`);

  const allStepsPassed = runs.every((r) => r.allStepsPassed);
  const deterministic   = divergences.length === 0;
  const overallPass     = allStepsPassed && deterministic;
  const passed = runs.reduce((n, r) => n + r.steps.filter((s) => s.passed).length, 0);
  const total  = TOTAL_RUNS * STEP_NAMES.length;

  console.log(
    `\n=== ${passed}/${total} cells | determinism: ${deterministic ? 'OK' : 'DRIFT'} | ${overallPass ? 'OVERALL PASS ✅' : 'OVERALL FAIL ❌'} ===`
  );

  process.exit(overallPass ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
