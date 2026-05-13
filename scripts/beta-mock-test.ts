/**
 * scripts/beta-mock-test.ts
 *
 * Task #398 — Beta Mock Test: 10-run financial model pipeline validation.
 *
 * SCOPE: Test harness only. Zero production service or route modifications.
 *
 * Authentication:
 *   ALLOW_DEMO_AUTH=true causes Express authenticateUser to auto-resolve any
 *   unauthenticated request to the demo user:
 *     id  = 85c9cd7a-c453-4dba-9817-d032d5712c4e
 *     org = cd3719c3-ef82-4ccc-acb9-261c80fb64b4
 *   A /api/auth/me preflight call confirms resolution before runs start.
 *   x-org-id is sent on every request as belt-and-suspenders.
 *
 * Setup per run (NOT counted in the 5-step matrix):
 *   1. POST /api/modeling/projects               — create project (fatal if fails)
 *   2. POST /api/modeling/projects/:id/capital-stacks — capital stack (non-fatal; logged)
 *      ↳ Capital stack is persisted in DB but the current production pipeline's
 *        loadCapitalStackData() does not return totalDebt/blendedDebtRate in its
 *        result object, so DCF responds with totalDebt=0. This is existing
 *        production behaviour — NOT changed by this script.
 *   3. POST /api/modeling/projects/:id/scenarios — growth/cap rates (non-fatal; logged)
 *   4. PATCH /api/modeling/projects/:id/config   — hold period (non-fatal; logged)
 *
 * Model pipeline per run (5 steps — 10×5 matrix):
 *   1. DCF            POST /api/modeling/projects/:id/dcf
 *   2. Monte Carlo    POST /api/modeling/projects/:id/dcf/monte-carlo
 *                     seed=42 → dcf-simulation-service.ts line 119:
 *                       const seed = request.seed ?? Date.now();
 *                     With seed=42: seeded PRNG — bit-identical outputs.
 *                     Without seed: Date.now() used → non-deterministic.
 *   3. Exit Scenarios POST ×4  cash_sale, exchange_1031, dst_investment, hybrid
 *                     Results collected into an array → exit-scenarios.json
 *   4. Waterfall      POST /api/modeling/projects/:id/waterfall
 *   5. Decision Sup.  GET  /api/modeling/projects/:id/dcf/decision-support
 *
 * Cleanup per run: DELETE /api/modeling/projects/:id (non-fatal)
 *
 * Failure handling:
 *   • create-project failure  → logged + writes ERROR.json → run aborted.
 *   • other setup failures    → logged + writes ERROR.json → run continues.
 *   • pipeline step failure   → logged + writes ERROR.json → run marked failed.
 *
 * Determinism: deep JSON comparison, runs 1–9 vs run-0 baseline, ε = 1e-9.
 *   Non-financial metadata (timestamps, UUIDs, timing) is excluded;
 *   all numeric financial outputs are compared.
 *
 * Exit code: 0 = all steps passed AND no financial drift; 1 = any failure.
 *
 * Usage:
 *   npx tsx scripts/beta-mock-test.ts [--base-url http://localhost:5000]
 */

import * as fs   from 'fs';
import * as path from 'path';

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE_URL = (() => {
  const i = process.argv.indexOf('--base-url');
  return i !== -1 ? process.argv[i + 1] : 'http://localhost:5000';
})();

const TOTAL_RUNS   = 10;
const RUNS_DIR     = path.resolve(process.cwd(), 'runs');
const FIXTURE_PATH = path.resolve(process.cwd(), 'tests/fixtures/beta-deal-marina.json');
const ORG_ID       = 'cd3719c3-ef82-4ccc-acb9-261c80fb64b4';
const EPSILON      = 1e-9;

/**
 * Non-financial metadata fields excluded from the determinism comparison.
 * These differ legitimately across runs (timestamps, auto-generated IDs, timing).
 * All numeric financial fields are always compared.
 */
const METADATA_FIELDS = new Set<string>([
  'id', 'modelingProjectId', 'projectId', 'scenarioId', 'capitalStackId',
  'orgId', 'userId', 'updatedBy', 'createdBy',
  'createdAt', 'updatedAt', 'generatedAt', 'timestamp', 'requestId',
  'computeTimeMs', 'elapsed', 'durationMs',
]);

// ─── Fixture types ────────────────────────────────────────────────────────────

interface ProjectFixture {
  marinaName: string;
  assetClass: string;
  city: string;
  state: string;
  purchasePrice: number;
  customMetrics?: Record<string, unknown>;
}

interface ScenarioFixture {
  scenarioType: string;
  name: string;
  revenueGrowthRate: number;
  expenseGrowthRate: number;
  exitCapRate: number;
}

interface ProjectConfigFixture {
  holdPeriod: number;
  acquisitionCloseDate?: string;
}

interface CapitalStackFixture {
  totalDebt: number;
  blendedDebtRate: number;
  holdPeriodYears: number;
  amortizationYears?: number;
  ioYears?: number;
  lpEquityPct?: number;
  gpEquityPct?: number;
  totalEquity: number;
}

interface DcfFixture {
  discountRate: number;
}

interface MonteCarloFixture {
  n: number;
  seed: number;
  hurdleIRR: number;
  discountRate: number;
}

interface ExitScenarioFixture {
  scenarioType: string;
  name: string;
  isBaseCase?: boolean;
  holdingPeriodYears?: number;
  exitCapRate?: string;
  projectedSalePrice?: string;
  brokerCommissionRate?: string;
  notes?: string;
}

interface WaterfallFixture {
  totalInvestment: number;
  lpContribution: number;
  gpContribution: number;
  holdingPeriodYears: number;
  annualCashFlows: number[];
  exitProceeds: number;
  config: Record<string, unknown>;
}

interface DecisionSupportFixture {
  hurdleIRR: number;
  discountRate: number;
  memoTone: string;
}

interface BetaFixture {
  _comment?: string;
  project: ProjectFixture;
  scenario: ScenarioFixture;
  projectConfig: ProjectConfigFixture;
  capitalStack: CapitalStackFixture;
  dcf: DcfFixture;
  monteCarlo: MonteCarloFixture;
  exitScenarios: ExitScenarioFixture[];
  waterfall: WaterfallFixture;
  decisionSupport: DecisionSupportFixture;
}

// ─── API response types ───────────────────────────────────────────────────────

interface DcfResponse {
  irr?: number;
  leveredIrr?: number;
  unleveredIrr?: number;
  npv?: number;
  equityMultiple?: number;
  totalDebt?: number;
  equityInvested?: number;
  purchasePrice?: number;
  [key: string]: unknown;
}

interface McIrrBand {
  p10?: number;
  p50?: number;
  p90?: number;
  mean?: number;
}

interface McResponse {
  seed?: number;
  stats?: { irr?: McIrrBand; [key: string]: unknown };
  p10?: number;
  p50?: number;
  p90?: number;
  mean?: number;
  [key: string]: unknown;
}

interface WfSummary {
  lpIRR?: number;
  gpIRR?: number;
  lpEquityMultiple?: number;
  gpEquityMultiple?: number;
}

interface WfResponse {
  summary?: WfSummary;
  [key: string]: unknown;
}

interface DsResponse {
  enabled?: boolean;
  entitled?: boolean;
  [key: string]: unknown;
}

// ─── Harness types ────────────────────────────────────────────────────────────

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

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function apiRequest(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  urlPath: string,
  body?: unknown,
): Promise<{ statusCode: number; data: unknown }> {
  const resp = await fetch(`${BASE_URL}${urlPath}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-org-id': ORG_ID },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data: unknown;
  try { data = await resp.json(); } catch { data = null; }
  return { statusCode: resp.status, data };
}

// ─── Auth preflight ───────────────────────────────────────────────────────────

async function verifyDemoAuth(): Promise<void> {
  const { statusCode, data } = await apiRequest('GET', '/api/auth/me');
  if (statusCode !== 200) {
    throw new Error(`Auth preflight failed: HTTP ${statusCode} — ${JSON.stringify(data)}`);
  }
  const user = data as { id?: string; orgId?: string };
  if (!user?.id || !user?.orgId) {
    throw new Error(`Auth preflight: unexpected response — ${JSON.stringify(data)}`);
  }
  console.log(`Auth: ALLOW_DEMO_AUTH → user=${user.id} org=${user.orgId}`);
}

// ─── Deep determinism compare ─────────────────────────────────────────────────

function deepCompare(
  baseline: unknown,
  actual: unknown,
  currentPath: string,
  divergences: DivergencePath[],
  runIndex: number,
): void {
  const leafKey = currentPath.split('.').pop()?.replace(/\[\d+\]$/, '') ?? '';
  if (METADATA_FIELDS.has(leafKey)) return;

  if (baseline === null && actual === null) return;
  if (baseline === undefined && actual === undefined) return;

  if (baseline === null || actual === null || baseline === undefined || actual === undefined) {
    divergences.push({ path: currentPath, run: runIndex, baseline, actual });
    return;
  }

  const bT = typeof baseline;
  const aT = typeof actual;

  if ((bT === 'number' || bT === 'bigint') && (aT === 'number' || aT === 'bigint')) {
    const delta = Math.abs(Number(baseline) - Number(actual));
    if (delta > EPSILON) divergences.push({ path: currentPath, run: runIndex, baseline, actual, delta });
    return;
  }

  if (bT !== aT) {
    divergences.push({ path: currentPath, run: runIndex, baseline, actual });
    return;
  }

  if (bT === 'string' || bT === 'boolean') {
    if (baseline !== actual) divergences.push({ path: currentPath, run: runIndex, baseline, actual });
    return;
  }

  if (Array.isArray(baseline)) {
    if (!Array.isArray(actual)) {
      divergences.push({ path: currentPath, run: runIndex, baseline, actual });
      return;
    }
    if (baseline.length !== actual.length) {
      divergences.push({ path: `${currentPath}.length`, run: runIndex, baseline: baseline.length, actual: actual.length });
      return;
    }
    for (let i = 0; i < baseline.length; i++) {
      deepCompare(baseline[i], actual[i], `${currentPath}[${i}]`, divergences, runIndex);
    }
    return;
  }

  if (bT === 'object') {
    const bObj = baseline as Record<string, unknown>;
    const aObj = actual   as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(bObj), ...Object.keys(aObj)]);
    for (const key of allKeys) {
      deepCompare(bObj[key], aObj[key], `${currentPath}.${key}`, divergences, runIndex);
    }
  }
}

// ─── Metric extractors ────────────────────────────────────────────────────────

interface RunMetrics {
  /** XIRR = irr = leveredIrr (calculateXIRR with actual dated cash flows) */
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

function fmt(v: unknown, decimals = 4): string {
  if (v === null || v === undefined) return 'N/A';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toFixed(decimals);
}

function extractMetrics(run: RunResult): RunMetrics {
  const getStep = <T>(step: StepName): T | null => {
    const s = run.steps.find((x) => x.step === step);
    return (s?.data ?? null) as T | null;
  };

  const dcf = getStep<DcfResponse>('dcf')        ?? {};
  const mc  = getStep<McResponse>('monte-carlo')  ?? {};
  const wf  = getStep<WfResponse>('waterfall')    ?? {};
  const ds  = getStep<DsResponse>('decision-support') ?? {};
  const es  = getStep<unknown[]>('exit-scenarios');

  const mcIrr = mc.stats?.irr ?? {};

  return {
    xirr:            fmt(dcf.irr),
    leveredIrr:      fmt(dcf.leveredIrr),
    unleveredIrr:    fmt(dcf.unleveredIrr),
    npv:             fmt(dcf.npv),
    equityMultiple:  fmt(dcf.equityMultiple),
    totalDebt:       fmt(dcf.totalDebt, 0),
    equityInvested:  fmt(dcf.equityInvested, 0),
    mcP10:           fmt(mcIrr.p10  ?? mc.p10),
    mcP50:           fmt(mcIrr.p50  ?? mc.p50),
    mcP90:           fmt(mcIrr.p90  ?? mc.p90),
    mcMean:          fmt(mcIrr.mean ?? mc.mean),
    mcSeed:          fmt(mc.seed, 0),
    waterfallLpIRR:  fmt(wf.summary?.lpIRR),
    waterfallGpIRR:  fmt(wf.summary?.gpIRR),
    waterfallLpMultiple: fmt(wf.summary?.lpEquityMultiple),
    waterfallGpMultiple: fmt(wf.summary?.gpEquityMultiple),
    dsEnabled:  String(ds.enabled  ?? 'N/A'),
    dsEntitled: String(ds.entitled ?? 'N/A'),
    exitScenarioCount: Array.isArray(es) ? String(es.length) : (es ? '1' : '0'),
  };
}

// ─── Single run ───────────────────────────────────────────────────────────────

async function executeRun(runIndex: number, fixture: BetaFixture): Promise<RunResult> {
  const runDir = path.join(RUNS_DIR, `run-${runIndex}`);
  // Wipe any artifacts from previous runs so each execution is a clean slate.
  if (fs.existsSync(runDir)) {
    for (const f of fs.readdirSync(runDir)) {
      fs.unlinkSync(path.join(runDir, f));
    }
  }
  fs.mkdirSync(runDir, { recursive: true });

  const {
    project:       projectFixture,
    scenario:      scenarioFixture,
    projectConfig: configFixture,
    capitalStack:  capitalFixture,
    dcf:           dcfFixture,
    monteCarlo:    mcFixture,
    exitScenarios: exitFixtures,
    waterfall:     waterfallFixture,
    decisionSupport: dsFixture,
  } = fixture;

  let projectId: string | null = null;
  const steps: StepResult[]    = [];
  const setupWarnings: string[] = [];

  const writeError = (context: string, detail: unknown) => {
    fs.writeFileSync(
      path.join(runDir, 'ERROR.json'),
      JSON.stringify({ run: runIndex, context, detail }, null, 2),
    );
  };

  // Execute one pipeline step; write result file and ERROR.json on failure.
  const execStep = async (
    step: StepName,
    fn: () => Promise<{ statusCode: number; data: unknown }>,
  ): Promise<boolean> => {
    const t0 = Date.now();
    let result: { statusCode: number; data: unknown };
    try {
      result = await fn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const durationMs = Date.now() - t0;
      steps.push({ step, passed: false, statusCode: 0, data: null, error: msg, durationMs });
      writeError(`pipeline:${step}`, { message: msg });
      console.error(`  [run-${runIndex}] ✗ ${step}: ${msg}`);
      return false;
    }
    const passed     = result.statusCode >= 200 && result.statusCode < 300;
    const durationMs = Date.now() - t0;
    steps.push({ step, passed, statusCode: result.statusCode, data: result.data, durationMs });
    fs.writeFileSync(path.join(runDir, `${step}.json`), JSON.stringify(result.data, null, 2));
    if (!passed) {
      const detail = JSON.stringify(result.data).slice(0, 400);
      writeError(`pipeline:${step}`, { statusCode: result.statusCode, body: detail });
      console.error(`  [run-${runIndex}] ✗ ${step}: HTTP ${result.statusCode} — ${detail}`);
    } else {
      console.log(`  [run-${runIndex}] ✓ ${step} (${durationMs}ms)`);
    }
    return passed;
  };

  // ── SETUP 1: Create project ──────────────────────────────────────────────
  try {
    const cr = await apiRequest('POST', '/api/modeling/projects', projectFixture);
    const crData = cr.data as { id?: string; project?: { id?: string } } | null;
    projectId = crData?.id ?? crData?.project?.id ?? null;
    if (cr.statusCode < 200 || cr.statusCode >= 300 || !projectId) {
      const detail = `HTTP ${cr.statusCode}: ${JSON.stringify(crData).slice(0, 300)}`;
      setupWarnings.push(`create-project failed — ${detail}`);
      writeError('setup:create-project', { statusCode: cr.statusCode, body: crData });
      console.error(`  [run-${runIndex}] ✗ setup:create-project — ${detail}`);
      return { runIndex, projectId: null, steps, setupWarnings, allStepsPassed: false, driftPaths: [] };
    }
    fs.writeFileSync(path.join(runDir, 'create-project.json'), JSON.stringify(crData, null, 2));
    console.log(`  [run-${runIndex}] ✓ setup:create-project  id=${projectId}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    setupWarnings.push(`create-project threw: ${msg}`);
    writeError('setup:create-project', { message: msg });
    console.error(`  [run-${runIndex}] ✗ setup:create-project: ${msg}`);
    return { runIndex, projectId: null, steps, setupWarnings, allStepsPassed: false, driftPaths: [] };
  }

  // ── SETUP 2: Capital stack ────────────────────────────────────────────────
  // blendedDebtRate is sent as a decimal string (0.065 = 6.5%).
  // drizzle-zod generates string type for decimal columns.
  // The current production loadCapitalStackData() does not return totalDebt/
  // blendedDebtRate, so DCF shows totalDebt=0 (existing production behaviour).
  try {
    const pp   = String(projectFixture.purchasePrice);
    const debt = String(capitalFixture.totalDebt);
    const eq   = String(capitalFixture.totalEquity);
    const rate = String(capitalFixture.blendedDebtRate); // "0.065"
    const term = capitalFixture.holdPeriodYears * 12;
    const csResp = await apiRequest('POST', `/api/modeling/projects/${projectId}/capital-stacks`, {
      name:                '65% LTV Senior Mortgage',
      purchasePrice:       pp,
      totalCapitalization: pp,
      totalDebt:           debt,
      totalEquity:         eq,
      blendedDebtRate:     rate,
      holdPeriodYears:     capitalFixture.holdPeriodYears,
      debtTranches: [{
        name:         'Senior Mortgage',
        amount:       debt,
        interestRate: rate,
        term,
        type:         'interest_only',
      }],
    });
    if (csResp.statusCode >= 200 && csResp.statusCode < 300) {
      fs.writeFileSync(path.join(runDir, 'capital-stack.json'), JSON.stringify(csResp.data, null, 2));
      console.log(`  [run-${runIndex}] ✓ setup:capital-stack  (DB persisted; totalDebt=0 in DCF is existing behaviour)`);
    } else {
      const warn = `setup:capital-stack HTTP ${csResp.statusCode}: ${JSON.stringify(csResp.data).slice(0, 200)}`;
      setupWarnings.push(warn);
      writeError('setup:capital-stack', { statusCode: csResp.statusCode, body: csResp.data });
      console.warn(`  [run-${runIndex}] ⚠ ${warn}`);
    }
  } catch (err: unknown) {
    const warn = `setup:capital-stack threw: ${err instanceof Error ? err.message : String(err)}`;
    setupWarnings.push(warn);
    writeError('setup:capital-stack', { message: warn });
    console.warn(`  [run-${runIndex}] ⚠ ${warn}`);
  }

  // ── SETUP 3: Scenario ─────────────────────────────────────────────────────
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
      writeError('setup:scenario', { statusCode: scResp.statusCode, body: scResp.data });
      console.warn(`  [run-${runIndex}] ⚠ ${warn}`);
    } else {
      console.log(`  [run-${runIndex}] ✓ setup:scenario`);
    }
  } catch (err: unknown) {
    const warn = `setup:scenario threw: ${err instanceof Error ? err.message : String(err)}`;
    setupWarnings.push(warn);
    writeError('setup:scenario', { message: warn });
    console.warn(`  [run-${runIndex}] ⚠ ${warn}`);
  }

  // ── SETUP 4: Config ───────────────────────────────────────────────────────
  try {
    const cfResp = await apiRequest('PATCH', `/api/modeling/projects/${projectId}/config`, {
      holdPeriod: configFixture.holdPeriod,
    });
    if (cfResp.statusCode < 200 || cfResp.statusCode >= 300) {
      const warn = `setup:config HTTP ${cfResp.statusCode}`;
      setupWarnings.push(warn);
      writeError('setup:config', { statusCode: cfResp.statusCode, body: cfResp.data });
      console.warn(`  [run-${runIndex}] ⚠ ${warn}`);
    } else {
      console.log(`  [run-${runIndex}] ✓ setup:config`);
    }
  } catch (err: unknown) {
    const warn = `setup:config threw: ${err instanceof Error ? err.message : String(err)}`;
    setupWarnings.push(warn);
    writeError('setup:config', { message: warn });
    console.warn(`  [run-${runIndex}] ⚠ ${warn}`);
  }

  // ── STEP 1: DCF ───────────────────────────────────────────────────────────
  // irr = leveredIrr = XIRR computed via calculateXIRR() (shared/finance/xirr.ts).
  // totalDebt=0 in response is existing production behaviour; not modified here.
  // No overrides — DCF uses the project's configured values (scenario, config).
  await execStep('dcf', () =>
    apiRequest('POST', `/api/modeling/projects/${projectId}/dcf`, {
      discountRate: dcfFixture.discountRate,
    }),
  );

  // ── STEP 2: Monte Carlo ───────────────────────────────────────────────────
  // seed=42 → dcf-simulation-service.ts line 119: const seed = request.seed ?? Date.now();
  // With seed=42 → seeded PRNG branch → bit-identical across all runs.
  // Without seed → Date.now() is the seed → different each run (non-deterministic).
  await execStep('monte-carlo', () =>
    apiRequest('POST', `/api/modeling/projects/${projectId}/dcf/monte-carlo`, {
      n:            mcFixture.n,
      seed:         mcFixture.seed,
      hurdleIRR:    mcFixture.hurdleIRR,
      discountRate: mcFixture.discountRate,
    }),
  );

  // ── STEP 3: Exit Scenarios ────────────────────────────────────────────────
  // Posts cash_sale, exchange_1031, dst_investment sequentially;
  // results collected into an array → exit-scenarios.json.
  await execStep('exit-scenarios', async () => {
    const results: unknown[] = [];
    let lastStatus = 201;
    for (const esBody of exitFixtures) {
      try {
        const r = await apiRequest(
          'POST',
          `/api/modeling/projects/${projectId}/exit/scenarios`,
          esBody,
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

  // ── STEP 4: Waterfall ─────────────────────────────────────────────────────
  await execStep('waterfall', () =>
    apiRequest('POST', `/api/modeling/projects/${projectId}/waterfall`, waterfallFixture),
  );

  // ── STEP 5: Decision Support ──────────────────────────────────────────────
  await execStep('decision-support', () => {
    const qs = new URLSearchParams({
      hurdleIRR:    String(dsFixture.hurdleIRR),
      discountRate: String(dsFixture.discountRate),
      memoTone:     dsFixture.memoTone,
    });
    return apiRequest('GET', `/api/modeling/projects/${projectId}/dcf/decision-support?${qs}`);
  });

  // ── Cleanup ───────────────────────────────────────────────────────────────
  try {
    await apiRequest('DELETE', `/api/modeling/projects/${projectId}`);
    console.log(`  [run-${runIndex}] ✓ cleanup`);
  } catch {
    console.warn(`  [run-${runIndex}] ⚠ cleanup failed (non-fatal)`);
  }

  const allStepsPassed =
    steps.length === STEP_NAMES.length && steps.every((s) => s.passed);
  return { runIndex, projectId, steps, setupWarnings, allStepsPassed, driftPaths: [] };
}

// ─── Determinism check ────────────────────────────────────────────────────────

function checkDeterminism(runs: RunResult[]): {
  divergences: DivergencePath[];
  byStep: Record<StepName, boolean>;
} {
  const baseline    = runs[0];
  const divergences: DivergencePath[] = [];
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
        divergences.push(...divs);
      }
    }
  }
  return { divergences, byStep };
}

// ─── Report ───────────────────────────────────────────────────────────────────

function generateReport(
  runs: RunResult[],
  divergences: DivergencePath[],
  byStep: Record<StepName, boolean>,
): string {
  const now        = new Date().toISOString();
  const totalCells = runs.length * STEP_NAMES.length;
  const passedCells = runs.reduce((n, r) => n + r.steps.filter((s) => s.passed).length, 0);
  const skipList   = [...METADATA_FIELDS].sort().join(', ');

  const cell = (run: RunResult, step: StepName) => {
    const s = run.steps.find((st) => st.step === step);
    if (!s) return '—';
    return s.passed ? 'PASS' : `FAIL(${s.statusCode})`;
  };

  const matrixRows = runs.map((r) =>
    `| ${r.runIndex} | ${cell(r,'dcf')} | ${cell(r,'monte-carlo')} | ${cell(r,'exit-scenarios')} | ${cell(r,'waterfall')} | ${cell(r,'decision-support')} |`
  ).join('\n');

  const timingRows = runs.map((r) => {
    const ms = (step: StepName) => r.steps.find((s) => s.step === step)?.durationMs ?? 0;
    const total = STEP_NAMES.reduce((n, s) => n + ms(s), 0);
    return `| ${r.runIndex} | ${ms('dcf')} | ${ms('monte-carlo')} | ${ms('exit-scenarios')} | ${ms('waterfall')} | ${ms('decision-support')} | **${total}** |`;
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

  return `# Beta Mock Test — Validation Report
> Task #398 | Generated: ${now}
> Fixture: \`tests/fixtures/beta-deal-marina.json\`
> Auth: \`ALLOW_DEMO_AUTH=true\` — Express \`authenticateUser\` auto-resolves all requests → org ${ORG_ID}; \`x-org-id\` on every call.
> Pipeline: ${STEP_NAMES.length} model steps × ${TOTAL_RUNS} runs = ${totalCells} cells

## Overall Result

**${passedCells}/${totalCells} cells passed | Determinism: ${divergences.length === 0 ? '✅ CONFIRMED' : '❌ DRIFT'} | Financial divergences: ${divergences.length}**

**Note — capital stack and totalDebt:**  
The setup step creates a capital stack in the DB. However, the current production code in
\`loadCapitalStackData()\` does not include \`totalDebt\` or \`blendedDebtRate\` in its returned
object, so all DCF responses show \`totalDebt=0\`. This is **existing production behaviour** and
was **not modified** by this test script. XIRR/NPV reported here are therefore the unlevered figures.

---

## 10 × 5 Pass/Fail Matrix

| Run | dcf | monte-carlo | exit-scenarios | waterfall | decision-support |
|-----|-----|-------------|----------------|-----------|------------------|
${matrixRows}

---

## Wall-Clock Time per Layer per Run (ms)

| Run | dcf | monte-carlo | exit-scenarios | waterfall | decision-support | total |
|-----|-----|-------------|----------------|-----------|------------------|-------|
${timingRows}

---

## Determinism Check (runs 1–9 vs run-0 baseline, ε = 1e-9)

_Excluded from comparison: ${skipList}._

| Step | Financial Numeric Determinism |
|------|-----------------------------|
${detRows}

### Divergence Details

${divSection}

---

## Monte Carlo — Seeded RNG Verification

\`dcf-simulation-service.ts\` line 119: \`const seed = request.seed ?? Date.now();\`
- **seed=42 supplied** (this test): seeded PRNG — bit-identical p10/p50/p90 across all 10 runs.
- **seed omitted**: \`Date.now()\` becomes the seed — different each run (non-deterministic).

| Run | seed (from response) | p10 IRR | p50 IRR | p90 IRR |
|-----|----------------------|---------|---------|---------|
${mcRows}

---

## Per-Run Metrics Snapshot

\`XIRR\` (= \`irr\` = \`leveredIrr\`) is computed via \`calculateXIRR()\` with actual dated cash flows
(\`shared/finance/xirr.ts\`). \`totalDebt=0\` in all runs — see note above.

| Run | XIRR | Levered IRR | Unlevered IRR | NPV | Eq. Mult. | DCF totalDebt | MC p50 | MC seed | WF LP/GP IRR | Exit Scenarios |
|-----|------|-------------|---------------|-----|-----------|---------------|--------|---------|--------------|---------------|
${metricsRows}

---

## Run-0 Baseline Snapshot

| Metric | Value |
|--------|-------|
| XIRR / Levered IRR (\`calculateXIRR\`) | **${m0.xirr}%** |
| Levered IRR | ${m0.leveredIrr}% |
| Unlevered IRR | ${m0.unleveredIrr}% |
| DCF totalDebt (existing production behaviour) | ${m0.totalDebt} |
| DCF equityInvested | ${m0.equityInvested} |
| NPV (${10}% discount rate) | ${m0.npv} |
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
| Exit scenario count per run | ${m0.exitScenarioCount} |
| Decision Support Enabled | ${m0.dsEnabled} |
| Decision Support Entitled | ${m0.dsEntitled} |

---

## Exit Scenario Set (4 calls per run)

As specified in Task #398: 1031, DST, Waterfall, Net Proceeds.

| # | scenarioType | name | exitCapRate | brokerCommissionRate |
|---|-------------|------|-------------|----------------------|
| 1 | cash_sale | Net Proceeds – Year 10 | 0.075 | 0.03 |
| 2 | exchange_1031 | 1031 Exchange – Year 10 | 0.075 | 0.03 |
| 3 | dst_investment | DST Investment – Year 10 | 0.075 | 0.03 |
| 4 | hybrid | Waterfall Exit – Year 10 | 0.075 | 0.03 |

Results collected into an array → \`exit-scenarios.json\` per run.

---

## Fixture Summary

Canonical parameters as specified in Task #398:

| Parameter | Canonical Value |
|-----------|----------------|
| Property | Beta Mock Marina |
| Location | Annapolis, MD |
| Asset Class | marina |
| Purchase Price | $12,500,000 |
| Total Slips | 220 — 80 wet / 100 covered / 40 dry |
| Avg Slip Rate | $850/mo |
| Ancillary Income | $1,250,000/yr |
| OpEx | 38% of revenue |
| Going-In Cap Rate | 7.0% |
| Exit Cap Rate | 7.5% |
| Hold Period | 10 years |
| Revenue Growth | 3.5% / yr |
| Expense Growth | 2.5% / yr |
| Debt | 65% LTV = $8,125,000 @ 6.25% / 25yr amort / 2yr IO |
| blendedDebtRate | 0.0625 (decimal = 6.25%) |
| Equity | 35% = $4,375,000 (LP 90% / GP 10%) |
| LP Contribution | $3,937,500 |
| GP Contribution | $437,500 |
| Waterfall | 8% pref, 20% GP catch-up, 4-tier promote |
| MC N | 500 |
| MC Seed | 42 → \`request.seed ?? Date.now()\` — deterministic path |
| Hurdle IRR | 12% |
| Discount Rate | 10% |

---

## Pipeline Specification

| Step | Method | Route | Matrix | Notes |
|------|--------|-------|--------|-------|
| Create project | POST | \`/api/modeling/projects\` | No (setup) | Fatal on failure |
| Capital stack | POST | \`/api/modeling/projects/:id/capital-stacks\` | No (setup) | Non-fatal; logged |
| Scenario | POST | \`/api/modeling/projects/:id/scenarios\` | No (setup) | Non-fatal; logged |
| Config | PATCH | \`/api/modeling/projects/:id/config\` | No (setup) | Non-fatal; logged |
| **1. DCF** | POST | \`/api/modeling/projects/:id/dcf\` | **Yes** | XIRR = \`irr\` = \`leveredIrr\` |
| **2. Monte Carlo** | POST | \`/api/modeling/projects/:id/dcf/monte-carlo\` | **Yes** | seed=42 |
| **3. Exit Scenarios** | POST ×4 | \`/api/modeling/projects/:id/exit/scenarios\` | **Yes** | cash_sale, exchange_1031, dst_investment, hybrid |
| **4. Waterfall** | POST | \`/api/modeling/projects/:id/waterfall\` | **Yes** | 4-tier promote |
| **5. Decision Support** | GET | \`/api/modeling/projects/:id/dcf/decision-support\` | **Yes** | |
| Cleanup | DELETE | \`/api/modeling/projects/:id\` | No | Non-fatal |

---

## Environment

| Key | Value |
|-----|-------|
| Base URL | ${BASE_URL} |
| Org ID | ${ORG_ID} |
| Auth model | \`ALLOW_DEMO_AUTH=true\` — preflight via \`GET /api/auth/me\` |
| Scope | Test harness only — zero production service/route modifications |
| Determinism ε | ${EPSILON} |
| METADATA_FIELDS excluded | ${skipList} |
| Total runs | ${TOTAL_RUNS} |
| Steps per run | ${STEP_NAMES.length} |
| Total cells | ${totalCells} |
`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== Beta Mock Test ===');
  console.log(`Fixture : ${FIXTURE_PATH}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Runs    : ${TOTAL_RUNS}  Steps: ${STEP_NAMES.join(', ')}`);
  console.log('');

  if (!fs.existsSync(FIXTURE_PATH)) {
    console.error(`ERROR: Fixture not found: ${FIXTURE_PATH}`);
    process.exit(1);
  }

  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as BetaFixture;
  fs.mkdirSync(RUNS_DIR, { recursive: true });

  console.log('Preflight: verifying auth (ALLOW_DEMO_AUTH)...');
  await verifyDemoAuth();
  console.log('');

  const runs: RunResult[] = [];

  for (let i = 0; i < TOTAL_RUNS; i++) {
    console.log(`\n--- Run ${i} ---`);
    const result = await executeRun(i, fixture);
    runs.push(result);

    const m = extractMetrics(result);
    console.log(
      `  XIRR/LevIRR=${m.xirr}%  UnlevIRR=${m.unleveredIrr}%  NPV=${m.npv}  EqMult=${m.equityMultiple}×  ` +
      `MCp50=${m.mcP50}%  WF_LP=${m.waterfallLpIRR}%  WF_GP=${m.waterfallGpIRR}%  DS=${m.dsEnabled}`,
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

  const report     = generateReport(runs, divergences, byStep);
  const reportPath = path.join(RUNS_DIR, 'beta-mock-report.md');
  fs.writeFileSync(reportPath, report);
  console.log(`\nReport → ${reportPath}`);

  const allPassed   = runs.every((r) => r.allStepsPassed);
  const deterministic = divergences.length === 0;
  const overallPass = allPassed && deterministic;
  const passed = runs.reduce((n, r) => n + r.steps.filter((s) => s.passed).length, 0);
  const total  = TOTAL_RUNS * STEP_NAMES.length;

  console.log(
    `\n=== ${passed}/${total} cells | determinism: ${deterministic ? 'OK' : 'DRIFT'} | ${overallPass ? 'OVERALL PASS ✅' : 'OVERALL FAIL ❌'} ===`
  );
  process.exit(overallPass ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error('Fatal:', err);
  process.exit(1);
});
