/**
 * scripts/beta-mock-test.ts
 *
 * Task #398 — Beta Mock Test: 10-run financial model pipeline validation.
 *
 * SCOPE: This script is a test harness only. No production service or route
 * files are modified. The test exercises the existing pipeline as-is.
 *
 * Authentication:
 *   The environment runs with ALLOW_DEMO_AUTH=true, which causes the Express
 *   authenticateUser middleware to auto-resolve any unauthenticated request to
 *   the demo user (id=85c9cd7a-c453-4dba-9817-d032d5712c4e,
 *   orgId=cd3719c3-ef82-4ccc-acb9-261c80fb64b4).
 *   A /api/auth/me preflight call verifies the resolution before runs start.
 *   x-org-id is sent on every request as belt-and-suspenders.
 *
 * Setup per run (not counted in the 5-step matrix):
 *   1. POST /api/modeling/projects              — create project
 *   2. POST /api/modeling/projects/:id/capital-stacks — create capital stack
 *      (Note: DCF pipeline uses totalDebt=0 as existing production behavior;
 *       capital stack is created in DB but loadCapitalStackData does not
 *       return totalDebt/blendedDebtRate in the current codebase.)
 *   3. POST /api/modeling/projects/:id/scenarios — set growth/cap rates
 *   4. PATCH /api/modeling/projects/:id/config   — set hold period
 *
 * Model pipeline per run (5 steps, 10×5 matrix):
 *   1. DCF           POST /api/modeling/projects/:id/dcf
 *   2. Monte Carlo   POST /api/modeling/projects/:id/dcf/monte-carlo
 *                    (seed=42 → dcf-simulation-service uses request.seed ?? Date.now();
 *                     with seed=42 the PRNG is deterministic; without seed, Date.now()
 *                     is used as the seed making results non-deterministic)
 *   3. Exit Scenarios POST ×3 (cash_sale, exchange_1031, dst_investment)
 *                    — results collected into array, saved as exit-scenarios.json
 *   4. Waterfall     POST /api/modeling/projects/:id/waterfall
 *   5. Decision Sup. GET  /api/modeling/projects/:id/dcf/decision-support
 *
 * Cleanup per run: DELETE /api/modeling/projects/:id
 *
 * Failure handling:
 *   - Setup step failures: logged with details, written to ERROR.json, run
 *     continues (non-fatal) — setup steps create data but do not gate pipeline.
 *   - Pipeline step failures: logged, written to ERROR.json, run marked failed.
 *   - Both types surface HTTP status and response body for debugging.
 *
 * Determinism: deep JSON comparison run-1..9 vs run-0 baseline (ε = 1e-9).
 * Non-financial metadata (timestamps, UUIDs, computeTimeMs, generatedAt)
 * is excluded from the comparison — only numeric financial outputs matter.
 *
 * Exit code 1 if any pipeline step fails OR any financial numeric drift detected.
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
 * Financial numeric fields are always compared.
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
  setupWarnings: string[];
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
  console.log(`Auth: ALLOW_DEMO_AUTH → user=${user.id} org=${user.orgId}`);
}

// ---------------------------------------------------------------------------
// Deep determinism comparison — epsilon 1e-9 for numbers.
// Excludes METADATA_FIELDS by key name (see declaration above).
// ---------------------------------------------------------------------------

function deepCompare(
  baseline: unknown,
  actual: unknown,
  currentPath: string,
  divergences: DivergencePath[],
  runIndex: number
): void {
  const leafKey = currentPath.split('.').pop()?.replace(/\[\d+\]$/, '') ?? '';
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
      divergences.push({ path: `${currentPath}.length`, run: runIndex, baseline: bArr.length, actual: aArr.length });
      return;
    }
    for (let i = 0; i < bArr.length; i++) {
      deepCompare(bArr[i], aArr[i], `${currentPath}[${i}]`, divergences, runIndex);
    }
    return;
  }

  if (bType === 'object') {
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
  /** Levered XIRR = irr = leveredIrr (calculateXIRR with actual dates) — pct */
  xirr: string;
  leveredIrr: string;
  unleveredIrr: string;
  npv: string;
  equityMultiple: string;
  totalDebt: string;
  equityInvested: string;
  mcP10: string;
  mcP50: string;
  mcP90: string;
  mcMean: string;
  mcSeed: string;
  waterfallLpIRR: string;
  waterfallGpIRR: string;
  waterfallLpMultiple: string;
  waterfallGpMultiple: string;
  dsEnabled: string;
  dsEntitled: string;
  exitScenarioCount: string;
}

function extractMetrics(run: RunResult): RunMetrics {
  const getStep = (step: StepName) =>
    run.steps.find((s) => s.step === step)?.data as any;

  const dcf = getStep('dcf') ?? {};
  const mc  = getStep('monte-carlo') ?? {};
  const wf  = getStep('waterfall') ?? {};
  const ds  = getStep('decision-support') ?? {};
  const es  = getStep('exit-scenarios');

  const mcIrr = mc?.stats?.irr ?? {};

  const fmt = (v: unknown, d = 4): string => {
    if (v === null || v === undefined) return 'N/A';
    if (typeof v === 'number') return v.toFixed(d);
    return String(v);
  };

  const esCount = Array.isArray(es) ? es.length : (es ? 1 : 0);

  return {
    xirr:           fmt(dcf?.irr),          // irr IS the XIRR (calculateXIRR)
    leveredIrr:     fmt(dcf?.leveredIrr),
    unleveredIrr:   fmt(dcf?.unleveredIrr),
    npv:            fmt(dcf?.npv),
    equityMultiple: fmt(dcf?.equityMultiple),
    totalDebt:      fmt(dcf?.totalDebt, 0),
    equityInvested: fmt(dcf?.equityInvested, 0),
    mcP10:  fmt(mcIrr.p10  ?? mc?.p10),
    mcP50:  fmt(mcIrr.p50  ?? mc?.p50),
    mcP90:  fmt(mcIrr.p90  ?? mc?.p90),
    mcMean: fmt(mcIrr.mean ?? mc?.mean),
    mcSeed: fmt(mc?.seed, 0),
    waterfallLpIRR:     fmt(wf?.summary?.lpIRR),
    waterfallGpIRR:     fmt(wf?.summary?.gpIRR),
    waterfallLpMultiple: fmt(wf?.summary?.lpEquityMultiple),
    waterfallGpMultiple: fmt(wf?.summary?.gpEquityMultiple),
    dsEnabled:  String(ds?.enabled  ?? 'N/A'),
    dsEntitled: String(ds?.entitled ?? 'N/A'),
    exitScenarioCount: String(esCount),
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
  const exitFixtures     = fixture.exitScenarios   as Record<string, unknown>[];
  const waterfallFixture = fixture.waterfall       as Record<string, unknown>;
  const dsFixture        = fixture.decisionSupport as Record<string, unknown>;

  let projectId: string | null = null;
  const steps: StepResult[] = [];
  const setupWarnings: string[] = [];

  /** Write ERROR.json (uppercase) on any failure */
  const writeError = (context: string, detail: unknown) => {
    fs.writeFileSync(
      path.join(runDir, 'ERROR.json'),
      JSON.stringify({ run: runIndex, context, detail }, null, 2)
    );
  };

  /** Execute one pipeline step */
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
      const durationMs = Date.now() - t0;
      steps.push({ step, passed: false, statusCode: 0, data: null, error: errMsg, durationMs });
      writeError(`pipeline:${step}`, { message: errMsg });
      console.error(`  [run-${runIndex}] ✗ ${step}: ${errMsg}`);
      return false;
    }
    const passed = result.statusCode >= 200 && result.statusCode < 300;
    const durationMs = Date.now() - t0;
    steps.push({ step, passed, statusCode: result.statusCode, data: result.data, durationMs });
    const fileName = `${step}.json`;
    fs.writeFileSync(path.join(runDir, fileName), JSON.stringify(result.data, null, 2));
    if (!passed) {
      const detail = JSON.stringify(result.data).slice(0, 400);
      writeError(`pipeline:${step}`, { statusCode: result.statusCode, body: detail });
      console.error(`  [run-${runIndex}] ✗ ${step}: HTTP ${result.statusCode} — ${detail}`);
    } else {
      console.log(`  [run-${runIndex}] ✓ ${step} (${durationMs}ms)`);
    }
    return passed;
  };

  // ── SETUP: Create project ────────────────────────────────────────────────
  try {
    const cr = await apiRequest('POST', '/api/modeling/projects', projectFixture);
    const crData = cr.data as Record<string, unknown> | null;
    projectId = ((crData?.id ?? crData?.project?.id) ?? null) as string | null;
    if (cr.statusCode < 200 || cr.statusCode >= 300 || !projectId) {
      const detail = `HTTP ${cr.statusCode}: ${JSON.stringify(crData).slice(0, 300)}`;
      const warn = `create-project failed — ${detail}`;
      setupWarnings.push(warn);
      writeError('setup:create-project', { statusCode: cr.statusCode, body: crData });
      console.error(`  [run-${runIndex}] ✗ setup:create-project — ${detail}`);
      return { runIndex, projectId: null, steps, setupWarnings, allStepsPassed: false, driftPaths: [] };
    }
    fs.writeFileSync(path.join(runDir, 'create-project.json'), JSON.stringify(crData, null, 2));
    console.log(`  [run-${runIndex}] ✓ setup:create-project  id=${projectId}`);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    setupWarnings.push(`create-project threw: ${errMsg}`);
    writeError('setup:create-project', { message: errMsg });
    console.error(`  [run-${runIndex}] ✗ setup:create-project: ${errMsg}`);
    return { runIndex, projectId: null, steps, setupWarnings, allStepsPassed: false, driftPaths: [] };
  }

  // ── SETUP: Capital stack ─────────────────────────────────────────────────
  // Note: blendedDebtRate must be sent as a string (drizzle-zod decimal type).
  // It is stored as a decimal (0.065 = 6.5%). The current DCF pipeline reads
  // totalDebt=0 because loadCapitalStackData does not return totalDebt/blendedDebtRate
  // (existing production behavior — not changed by this test script).
  try {
    const pp   = String((projectFixture as any).purchasePrice ?? 12500000);
    const debt = String((capitalFixture as any).totalDebt);
    const eq   = String((capitalFixture as any).totalEquity ?? 4375000);
    const rate = String((capitalFixture as any).blendedDebtRate); // e.g. "0.065"
    const csBody = {
      name:               '65% LTV Senior Mortgage',
      purchasePrice:      pp,
      totalCapitalization: pp,
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
    };
    const csResp = await apiRequest('POST', `/api/modeling/projects/${projectId}/capital-stacks`, csBody);
    if (csResp.statusCode >= 200 && csResp.statusCode < 300) {
      fs.writeFileSync(path.join(runDir, 'capital-stack.json'), JSON.stringify(csResp.data, null, 2));
      console.log(`  [run-${runIndex}] ✓ setup:capital-stack  (totalDebt visible in DB, not in DCF — existing behavior)`);
    } else {
      const warn = `setup:capital-stack HTTP ${csResp.statusCode}`;
      setupWarnings.push(warn);
      console.warn(`  [run-${runIndex}] ⚠ ${warn}`);
    }
  } catch (err: unknown) {
    const warn = `setup:capital-stack threw: ${err instanceof Error ? err.message : String(err)}`;
    setupWarnings.push(warn);
    console.warn(`  [run-${runIndex}] ⚠ ${warn}`);
  }

  // ── SETUP: Scenario ──────────────────────────────────────────────────────
  try {
    const scResp = await apiRequest('POST', `/api/modeling/projects/${projectId}/scenarios`, {
      scenarioType:      scenarioFixture.scenarioType,
      name:              scenarioFixture.name,
      revenueGrowthRate: scenarioFixture.revenueGrowthRate,
      expenseGrowthRate: scenarioFixture.expenseGrowthRate,
      exitCapRate:       scenarioFixture.exitCapRate,
    });
    if (scResp.statusCode < 200 || scResp.statusCode >= 300) {
      const warn = `setup:scenario HTTP ${scResp.statusCode}`;
      setupWarnings.push(warn);
      console.warn(`  [run-${runIndex}] ⚠ ${warn}`);
    } else {
      console.log(`  [run-${runIndex}] ✓ setup:scenario`);
    }
  } catch (err: unknown) {
    const warn = `setup:scenario threw: ${err instanceof Error ? err.message : String(err)}`;
    setupWarnings.push(warn);
    console.warn(`  [run-${runIndex}] ⚠ ${warn}`);
  }

  // ── SETUP: Config ────────────────────────────────────────────────────────
  try {
    const cfResp = await apiRequest('PATCH', `/api/modeling/projects/${projectId}/config`, {
      holdPeriod: projectConfig.holdPeriod,
    });
    if (cfResp.statusCode < 200 || cfResp.statusCode >= 300) {
      const warn = `setup:config HTTP ${cfResp.statusCode}`;
      setupWarnings.push(warn);
      console.warn(`  [run-${runIndex}] ⚠ ${warn}`);
    } else {
      console.log(`  [run-${runIndex}] ✓ setup:config`);
    }
  } catch (err: unknown) {
    const warn = `setup:config threw: ${err instanceof Error ? err.message : String(err)}`;
    setupWarnings.push(warn);
    console.warn(`  [run-${runIndex}] ⚠ ${warn}`);
  }

  // ── STEP 1: DCF ──────────────────────────────────────────────────────────
  // irr/leveredIrr = XIRR computed via calculateXIRR() with actual dated cash flows.
  // Note: totalDebt=0 in response is current production behavior (loadCapitalStackData
  // does not return totalDebt/blendedDebtRate — existing code, not changed here).
  await execStep('dcf', () =>
    apiRequest('POST', `/api/modeling/projects/${projectId}/dcf`, {
      discountRate: (dcfFixture.discountRate as number) ?? 10,
      overrides: {
        holdPeriodYears:        projectConfig.holdPeriod,
        revenueGrowthRateDelta: 0.5,
        exitCapRateDelta:       -0.25,
      },
    })
  );

  // ── STEP 2: Monte Carlo ──────────────────────────────────────────────────
  // seed=42 → dcf-simulation-service uses `request.seed ?? Date.now()`.
  // With seed=42: seeded PRNG branch → bit-identical across all 10 runs.
  // Without seed: Date.now() is used → non-deterministic results.
  await execStep('monte-carlo', () =>
    apiRequest('POST', `/api/modeling/projects/${projectId}/dcf/monte-carlo`, {
      n:            mcFixture.n,
      seed:         mcFixture.seed,   // 42 — activates deterministic seeded PRNG
      hurdleIRR:    mcFixture.hurdleIRR,
      discountRate: mcFixture.discountRate,
    })
  );

  // ── STEP 3: Exit Scenarios — three scenario types ─────────────────────────
  // Posts cash_sale, exchange_1031, and dst_investment; collects into array.
  await execStep('exit-scenarios', async () => {
    const results: unknown[] = [];
    let lastStatus = 201;
    for (const esFixture of exitFixtures) {
      try {
        const r = await apiRequest(
          'POST',
          `/api/modeling/projects/${projectId}/exit/scenarios`,
          esFixture
        );
        results.push(r.data);
        if (r.statusCode < 200 || r.statusCode >= 300) lastStatus = r.statusCode;
      } catch (err: unknown) {
        results.push({ error: err instanceof Error ? err.message : String(err) });
        lastStatus = 500;
      }
    }
    return { statusCode: lastStatus, data: results };
  });

  // ── STEP 4: Waterfall ────────────────────────────────────────────────────
  await execStep('waterfall', () =>
    apiRequest('POST', `/api/modeling/projects/${projectId}/waterfall`, waterfallFixture)
  );

  // ── STEP 5: Decision Support — GET (deterministic, no MC re-run) ──────────
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

  // ── Cleanup ──────────────────────────────────────────────────────────────
  try {
    await apiRequest('DELETE', `/api/modeling/projects/${projectId}`);
    console.log(`  [run-${runIndex}] ✓ cleanup`);
  } catch {
    console.warn(`  [run-${runIndex}] ⚠ cleanup failed (non-fatal)`);
  }

  const allStepsPassed = steps.length === STEP_NAMES.length && steps.every((s) => s.passed);
  return { runIndex, projectId, steps, setupWarnings, allStepsPassed, driftPaths: [] };
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
  fixture: Record<string, unknown>,
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
        ).join('\n');

  const metricsRows = runs.map((r) => {
    const m = extractMetrics(r);
    return `| ${r.runIndex} | ${m.xirr}% | ${m.leveredIrr}% | ${m.unleveredIrr}% | ${m.npv} | ${m.equityMultiple}× | ${m.totalDebt} | ${m.mcP50}% | ${m.mcSeed} | ${m.waterfallLpIRR}%/${m.waterfallGpIRR}% | ${m.exitScenarioCount} |`;
  }).join('\n');

  const mcRows = runs.map((r) => {
    const m = extractMetrics(r);
    return `| ${r.runIndex} | ${m.mcSeed} | ${m.mcP10}% | ${m.mcP50}% | ${m.mcP90}% |`;
  }).join('\n');

  const m0 = extractMetrics(runs[0]);
  const skipList = [...METADATA_FIELDS].sort().join(', ');

  return `# Beta Mock Test — Validation Report
> Task #398 | Generated: ${now}
> Fixture: \`tests/fixtures/beta-deal-marina.json\`
> Auth: \`ALLOW_DEMO_AUTH=true\` — Express \`authenticateUser\` auto-resolves unauthenticated requests → demo org ${ORG_ID}; \`x-org-id\` sent on every call.
> Pipeline: ${STEP_NAMES.length} model steps × ${TOTAL_RUNS} runs = ${totalCells} cells

## Overall Result

**${passedCells}/${totalCells} cells passed | Determinism: ${divergences.length === 0 ? '✅ CONFIRMED' : '❌ DRIFT'} | Financial divergences: ${divergences.length}**

**Note on capital stack and totalDebt:** The setup step creates a capital stack in the DB
(\`POST /api/modeling/projects/:id/capital-stacks\`), but the current production code in
\`loadCapitalStackData\` does not return \`totalDebt\` or \`blendedDebtRate\` in its object.
As a result, all DCF responses show \`totalDebt=0\` — this is existing production behavior
and was not modified by this test script.  The XIRR reported is therefore the unlevered IRR.

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

_Excluded from comparison: ${skipList}._

| Step | Financial Numeric Determinism |
|------|-----------------------------|
${detRows}

### Divergence Details

${divSection}

---

## Monte Carlo Seeded RNG Verification

Requests include \`"seed": 42\` in the POST body.
Implementation: \`dcf-simulation-service.ts\` line 119: \`const seed = request.seed ?? Date.now();\`
- **With \`seed=42\`** (this test): seeded PRNG → bit-identical p10/p50/p90 across all runs.
- **Without seed**: \`Date.now()\` is used → non-deterministic (different each run).

| Run | seed (response) | p10 IRR | p50 IRR | p90 IRR |
|-----|----------------|---------|---------|---------|
${mcRows}

---

## Per-Run Metrics Snapshot

\`XIRR\` (= \`irr\` = \`leveredIrr\`) is computed via \`calculateXIRR()\` with actual dated
cash flows (\`shared/finance/xirr.ts\`).  \`totalDebt=0\` in all runs — see note above.

| Run | XIRR | Levered IRR | Unlevered IRR | NPV | Eq. Mult. | DCF totalDebt | MC p50 | MC seed | WF LP/GP IRR | Exit Scenarios |
|-----|------|-------------|---------------|-----|-----------|---------------|--------|---------|--------------|---------------|
${metricsRows}

---

## Run-0 Baseline Snapshot

| Metric | Value |
|--------|-------|
| XIRR / Levered IRR (\`calculateXIRR\`) | ${m0.xirr}% |
| Unlevered IRR | ${m0.unleveredIrr}% |
| DCF totalDebt (production behavior) | ${m0.totalDebt} |
| DCF equityInvested | ${m0.equityInvested} |
| NPV (10% discount rate) | ${m0.npv} |
| Equity Multiple | ${m0.equityMultiple}× |
| MC p10 (seed=42) | ${m0.mcP10}% |
| MC p50 (seed=42) | ${m0.mcP50}% |
| MC p90 (seed=42) | ${m0.mcP90}% |
| MC mean (seed=42) | ${m0.mcMean}% |
| MC seed confirmed in response | ${m0.mcSeed} |
| Waterfall LP IRR | ${m0.waterfallLpIRR}% |
| Waterfall GP IRR | ${m0.waterfallGpIRR}% |
| Waterfall LP Multiple | ${m0.waterfallLpMultiple}× |
| Waterfall GP Multiple | ${m0.waterfallGpMultiple}× |
| Exit scenario count | ${m0.exitScenarioCount} |
| Decision Support Enabled | ${m0.dsEnabled} |
| Decision Support Entitled | ${m0.dsEntitled} |

---

## Exit Scenario Set

Each run posts three exit scenario types to \`POST /api/modeling/projects/:id/exit/scenarios\`:

| Scenario Type | Name | Exit Year | Exit Cap Rate | Selling Cost |
|---------------|------|-----------|---------------|--------------|
| cash_sale | Base Sale – Year 10 | 10 | 6.75% | 3.0% |
| exchange_1031 | 1031 Exchange – Year 10 | 10 | 6.75% | 3.0% |
| dst_investment | DST Investment – Year 10 | 10 | 6.75% | 3.0% |

Results are collected into an array and saved as \`exit-scenarios.json\` per run.

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
| Scenario Exit Cap Rate | 6.75% |
| Revenue Growth | 3.5% / yr |
| Expense Growth | 2.5% / yr |
| Capital Stack (DB only) | $8,125,000 totalDebt @ 6.5% IO (blendedDebtRate=0.065 decimal) |
| LP Equity | $3,937,500 (90%) |
| GP Equity | $437,500 (10%) |
| Waterfall | 8% pref, 20% GP catch-up, 4-tier promote |
| MC N | 500 |
| MC Seed | 42 → \`request.seed ?? Date.now()\` — deterministic path |
| Hurdle IRR | 12% |
| Discount Rate | 10% |

---

## Pipeline Specification

| Step | Method | Route | Matrix | Notes |
|------|--------|-------|--------|-------|
| Create project | POST | \`/api/modeling/projects\` | No (setup) | Fatal if fails |
| Capital stack | POST | \`/api/modeling/projects/:id/capital-stacks\` | No (setup) | Non-fatal; logged |
| Scenario | POST | \`/api/modeling/projects/:id/scenarios\` | No (setup) | Non-fatal; logged |
| Config | PATCH | \`/api/modeling/projects/:id/config\` | No (setup) | Non-fatal; logged |
| **1. DCF** | POST | \`/api/modeling/projects/:id/dcf\` | **Yes** | XIRR = irr |
| **2. Monte Carlo** | POST | \`/api/modeling/projects/:id/dcf/monte-carlo\` | **Yes** | seed=42 |
| **3. Exit Scenarios** | POST ×3 | \`/api/modeling/projects/:id/exit/scenarios\` | **Yes** | cash_sale, exchange_1031, dst_investment |
| **4. Waterfall** | POST | \`/api/modeling/projects/:id/waterfall\` | **Yes** | 4-tier promote |
| **5. Decision Support** | GET | \`/api/modeling/projects/:id/dcf/decision-support\` | **Yes** | Fast mode |
| Cleanup | DELETE | \`/api/modeling/projects/:id\` | No | Non-fatal |

---

## Environment

| Key | Value |
|-----|-------|
| Base URL | ${BASE_URL} |
| Org ID | ${ORG_ID} |
| Auth model | \`ALLOW_DEMO_AUTH=true\` |
| Scope | Test harness only — zero production service/route modifications |
| Determinism ε | ${EPSILON} |
| METADATA_FIELDS excluded | ${skipList} |
| Runs | ${TOTAL_RUNS} |
| Steps | ${STEP_NAMES.length} |
| Total cells | ${totalCells} |
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

  console.log('Preflight: verifying auth (ALLOW_DEMO_AUTH)...');
  await verifyDemoAuth();
  console.log('');

  const runs: RunResult[] = [];

  for (let i = 0; i < TOTAL_RUNS; i++) {
    console.log(`\n--- Run ${i} ---`);
    const result = await executeRun(i, _fixture);
    runs.push(result);

    const m = extractMetrics(result);
    console.log(
      `  XIRR=${m.xirr}%  NPV=${m.npv}  EqMult=${m.equityMultiple}×  ` +
      `MCp50=${m.mcP50}%  WF_LP=${m.waterfallLpIRR}%  WF_GP=${m.waterfallGpIRR}%  DS=${m.dsEnabled}`
    );
    if (result.setupWarnings.length > 0) {
      console.warn(`  ⚠ Setup warnings: ${result.setupWarnings.join('; ')}`);
    }
  }

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

  const report = generateReport(runs, _fixture, divergences, byStep);
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
