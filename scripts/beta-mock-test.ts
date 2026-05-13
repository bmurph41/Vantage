/**
 * scripts/beta-mock-test.ts
 *
 * Beta Mock Test — 10-pass financial model pipeline validation
 *
 * Runs 10 identical passes through the full modeling pipeline using the
 * fixed marina fixture in tests/fixtures/beta-deal-marina.json. Verifies
 * deterministic output across all runs and produces:
 *   runs/run-{0..9}/  — full JSON response files per step per run
 *   runs/beta-mock-report.md — 10×5 pass/fail matrix with key metrics
 *
 * Usage:
 *   npx tsx scripts/beta-mock-test.ts
 *   BASE_URL=http://localhost:5000 npx tsx scripts/beta-mock-test.ts
 */

import fs from 'fs';
import path from 'path';

// ─── Configuration ────────────────────────────────────────────────────────────

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5000';
const RUNS = 10;
const FIXTURE_PATH = path.resolve('tests/fixtures/beta-deal-marina.json');
const RUNS_DIR = path.resolve('runs');

// Pipeline step labels (columns in the report matrix)
const STEPS = ['createProject', 'dcf', 'monteCarlo', 'exitScenario', 'decisionSupport'] as const;
type Step = (typeof STEPS)[number];

// ─── Types ────────────────────────────────────────────────────────────────────

interface StepResult {
  step: Step;
  pass: boolean;
  status: number;
  durationMs: number;
  error?: string;
  key?: Record<string, number | string | null>;
}

interface RunResult {
  runIndex: number;
  projectId: string | null;
  steps: Record<Step, StepResult>;
  totalMs: number;
}

// ─── HTTP Helper ──────────────────────────────────────────────────────────────

async function apiRequest(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown
): Promise<{ status: number; data: any; durationMs: number }> {
  const start = Date.now();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const durationMs = Date.now() - start;
  let data: any;
  try {
    data = await res.json();
  } catch {
    data = { _raw: await res.text().catch(() => '') };
  }
  return { status: res.status, data, durationMs };
}

// ─── Metric Extractors ────────────────────────────────────────────────────────
// Pull a small set of scalar values we can compare across runs for determinism.

function extractDcfMetrics(data: any): Record<string, number | string | null> {
  if (!data || data.error) return {};
  return {
    irr:       num(data.leveragedIRR ?? data.irr ?? data.returns?.leveragedIRR ?? data.returns?.irr),
    npv:       num(data.npv ?? data.returns?.npv),
    year1Noi:  num(data.year1?.noi ?? data.yearlyProjections?.[0]?.noi ?? data.noi),
    exitValue: num(data.exitValue ?? data.exit?.grossSalePrice),
  };
}

function extractMcMetrics(data: any): Record<string, number | string | null> {
  if (!data || data.error) return {};
  return {
    p50Irr:    num(data.p50?.irr ?? data.percentiles?.p50?.irr ?? data.summary?.p50Irr),
    p10Irr:    num(data.p10?.irr ?? data.percentiles?.p10?.irr ?? data.summary?.p10Irr),
    p90Irr:    num(data.p90?.irr ?? data.percentiles?.p90?.irr ?? data.summary?.p90Irr),
    simCount:  num(data.n ?? data.simulationCount ?? data.runs),
  };
}

function extractExitMetrics(data: any): Record<string, number | string | null> {
  if (!data || data.error) return {};
  return {
    id:         str(data.id),
    exitYear:   num(data.exitYear),
    exitCapRate: num(data.exitCapRate),
  };
}

function extractDsMetrics(data: any): Record<string, number | string | null> {
  if (!data || data.error) return {};
  return {
    recommendation: str(data.recommendation ?? data.verdict ?? data.decision),
    score:          num(data.score ?? data.compositeScore),
    p50Irr:         num(data.monteCarlo?.p50?.irr ?? data.monteCarlo?.summary?.p50Irr),
  };
}

function num(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : Math.round(n * 10000) / 10000;
}

function str(v: any): string | null {
  if (v === null || v === undefined) return null;
  return String(v).substring(0, 80);
}

// ─── Single Run ───────────────────────────────────────────────────────────────

async function runOnce(runIndex: number, fixture: any): Promise<RunResult> {
  const runDir = path.join(RUNS_DIR, `run-${runIndex}`);
  fs.mkdirSync(runDir, { recursive: true });

  const steps = {} as Record<Step, StepResult>;
  const runStart = Date.now();
  let projectId: string | null = null;

  // ── Step 1: Create project ────────────────────────────────────────────────
  {
    const step: Step = 'createProject';
    const { status, data, durationMs } = await apiRequest('POST', '/api/modeling/projects', fixture.project);
    fs.writeFileSync(path.join(runDir, 'createProject.json'), JSON.stringify(data, null, 2));

    const pass = status >= 200 && status < 300 && !!data?.id;
    if (pass) projectId = data.id;
    steps[step] = {
      step,
      pass,
      status,
      durationMs,
      error: pass ? undefined : (data?.error ?? data?.message ?? `HTTP ${status}`),
      key: pass ? { projectId: str(data.id), marinaName: str(data.marinaName) } : {},
    };
  }

  // Abort remaining steps if project creation failed — no projectId to use
  if (!projectId) {
    for (const step of STEPS.slice(1)) {
      steps[step as Step] = { step: step as Step, pass: false, status: 0, durationMs: 0, error: 'skipped — no projectId' };
    }
    return { runIndex, projectId, steps, totalMs: Date.now() - runStart };
  }

  // ── Step 2: Full DCF Analysis ─────────────────────────────────────────────
  {
    const step: Step = 'dcf';
    const { status, data, durationMs } = await apiRequest('POST', `/api/modeling/projects/${projectId}/dcf`, fixture.dcf);
    fs.writeFileSync(path.join(runDir, 'dcf.json'), JSON.stringify(data, null, 2));

    const pass = status >= 200 && status < 300 && !data?.error;
    steps[step] = { step, pass, status, durationMs, error: pass ? undefined : (data?.error ?? `HTTP ${status}`), key: extractDcfMetrics(data) };
  }

  // ── Step 3: Monte Carlo (seeded) ──────────────────────────────────────────
  {
    const step: Step = 'monteCarlo';
    const { status, data, durationMs } = await apiRequest('POST', `/api/modeling/projects/${projectId}/dcf/monte-carlo`, fixture.monteCarlo);
    fs.writeFileSync(path.join(runDir, 'monteCarlo.json'), JSON.stringify(data, null, 2));

    const pass = status >= 200 && status < 300 && !data?.error;
    steps[step] = { step, pass, status, durationMs, error: pass ? undefined : (data?.error ?? `HTTP ${status}`), key: extractMcMetrics(data) };
  }

  // ── Step 4: Exit Scenario ─────────────────────────────────────────────────
  {
    const step: Step = 'exitScenario';
    const { status, data, durationMs } = await apiRequest('POST', `/api/modeling/projects/${projectId}/exit/scenarios`, fixture.exitScenario);
    fs.writeFileSync(path.join(runDir, 'exitScenario.json'), JSON.stringify(data, null, 2));

    const pass = status >= 200 && status < 300 && !!data?.id;
    steps[step] = { step, pass, status, durationMs, error: pass ? undefined : (data?.error ?? `HTTP ${status}`), key: extractExitMetrics(data) };
  }

  // ── Step 5: Decision Support (seeded Monte Carlo) ─────────────────────────
  {
    const step: Step = 'decisionSupport';
    const { status, data, durationMs } = await apiRequest('POST', `/api/modeling/projects/${projectId}/dcf/decision-support`, fixture.decisionSupport);
    fs.writeFileSync(path.join(runDir, 'decisionSupport.json'), JSON.stringify(data, null, 2));

    const pass = status >= 200 && status < 300 && !data?.error;
    steps[step] = { step, pass, status, durationMs, error: pass ? undefined : (data?.error ?? `HTTP ${status}`), key: extractDsMetrics(data) };
  }

  return { runIndex, projectId, steps, totalMs: Date.now() - runStart };
}

// ─── Determinism Check ────────────────────────────────────────────────────────

function checkDeterminism(results: RunResult[]): Record<Step, { deterministic: boolean; note: string }> {
  const out = {} as Record<Step, { deterministic: boolean; note: string }>;

  for (const step of STEPS) {
    const passedRuns = results.filter(r => r.steps[step]?.pass);
    if (passedRuns.length < 2) {
      out[step] = { deterministic: false, note: 'not enough passing runs to compare' };
      continue;
    }

    // Skip determinism check for steps that produce unique IDs per run (createProject, exitScenario)
    if (step === 'createProject' || step === 'exitScenario') {
      out[step] = { deterministic: true, note: 'n/a — produces unique IDs by design' };
      continue;
    }

    const keys = passedRuns[0].steps[step]?.key ?? {};
    const numericKeys = Object.keys(keys).filter(k => typeof keys[k] === 'number');

    if (numericKeys.length === 0) {
      out[step] = { deterministic: true, note: 'no numeric metrics to compare' };
      continue;
    }

    const mismatches: string[] = [];
    for (const k of numericKeys) {
      const vals = passedRuns.map(r => r.steps[step]?.key?.[k]);
      const distinct = new Set(vals.map(v => String(v)));
      if (distinct.size > 1) {
        mismatches.push(`${k}: [${[...distinct].join(', ')}]`);
      }
    }

    if (mismatches.length === 0) {
      out[step] = { deterministic: true, note: `all ${numericKeys.join(', ')} values match across ${passedRuns.length} runs` };
    } else {
      out[step] = { deterministic: false, note: `drift in: ${mismatches.join(' | ')}` };
    }
  }

  return out;
}

// ─── Report Generator ─────────────────────────────────────────────────────────

function buildReport(results: RunResult[], determinism: Record<Step, { deterministic: boolean; note: string }>): string {
  const now = new Date().toISOString();
  const totalPasses = results.reduce((s, r) => s + STEPS.filter(step => r.steps[step]?.pass).length, 0);
  const totalCells = results.length * STEPS.length;

  const colW = 16;
  const runW = 6;
  const pad = (s: string, w: number) => s.substring(0, w).padEnd(w);

  // Header row
  const headerCols = ['Run', ...STEPS.map(s => s.substring(0, colW))];
  const sepLine = ['-'.repeat(runW), ...STEPS.map(() => '-'.repeat(colW))].join(' | ');
  const headerLine = [pad('Run', runW), ...STEPS.map(s => pad(s, colW))].join(' | ');

  // Matrix rows
  const matrixRows = results.map(r => {
    const cells = STEPS.map(step => {
      const s = r.steps[step];
      if (!s) return pad('—', colW);
      const icon = s.pass ? '✓' : '✗';
      const detail = s.pass ? `${s.durationMs}ms` : (s.error?.substring(0, 10) ?? 'err');
      return pad(`${icon} ${detail}`, colW);
    });
    return [pad(`#${r.runIndex}`, runW), ...cells].join(' | ');
  });

  // Metrics summary per step (across passing runs)
  const metricsSummary = STEPS.filter(s => s !== 'createProject' && s !== 'exitScenario').map(step => {
    const passing = results.filter(r => r.steps[step]?.pass);
    if (!passing.length) return `### ${step}\n_No passing runs._`;
    const sample = passing[0].steps[step]?.key ?? {};
    const metricLines = Object.entries(sample).map(([k, v]) => `- **${k}**: \`${v ?? 'null'}\``);
    return `### ${step}\n${metricLines.join('\n') || '_No metrics extracted._'}`;
  }).join('\n\n');

  // Determinism summary
  const detRows = STEPS.map(step => {
    const d = determinism[step];
    return `| ${step} | ${d.deterministic ? '✓ Yes' : '✗ No'} | ${d.note} |`;
  }).join('\n');

  // Per-run project IDs
  const projectIds = results.map(r => `- Run ${r.runIndex}: \`${r.projectId ?? 'n/a'}\``).join('\n');

  // Errors table
  const errors: string[] = [];
  for (const r of results) {
    for (const step of STEPS) {
      const s = r.steps[step];
      if (s && !s.pass) {
        errors.push(`| #${r.runIndex} | ${step} | HTTP ${s.status} | ${s.error ?? ''} |`);
      }
    }
  }
  const errorSection = errors.length
    ? `## Failures\n\n| Run | Step | Status | Error |\n|-----|------|--------|-------|\n${errors.join('\n')}`
    : '## Failures\n\n_None — all steps passed on all runs._';

  return `# Beta Mock Test Report

**Generated**: ${now}
**Fixture**: \`tests/fixtures/beta-deal-marina.json\`
**Runs**: ${results.length}
**Pass rate**: ${totalPasses}/${totalCells} cells (${Math.round(totalPasses / totalCells * 100)}%)

---

## Pass / Fail Matrix

| ${headerLine} |
| ${sepLine} |
${matrixRows.map(r => `| ${r} |`).join('\n')}

Legend: ✓ pass (with duration) · ✗ fail (error prefix)

---

## Determinism

| Step | Deterministic | Notes |
|------|---------------|-------|
${detRows}

---

## Sample Metrics (Run 0 baseline)

${metricsSummary}

---

${errorSection}

---

## Project IDs (one per run)

${projectIds}

---

## Environment

- Base URL: \`${BASE_URL}\`
- Auth: ALLOW_DEMO_AUTH demo user (orgId: cd3719c3-ef82-4ccc-acb9-261c80fb64b4)
- Monte Carlo seed: 42 (deterministic)
`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Vantage Beta Mock Test — Financial Model Pipeline');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Base URL : ${BASE_URL}`);
  console.log(`  Fixture  : ${FIXTURE_PATH}`);
  console.log(`  Runs     : ${RUNS}`);
  console.log('───────────────────────────────────────────────────\n');

  // Load fixture
  if (!fs.existsSync(FIXTURE_PATH)) {
    console.error(`Fixture not found: ${FIXTURE_PATH}`);
    process.exit(1);
  }
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));

  // Verify server is reachable
  try {
    const probe = await fetch(`${BASE_URL}/api/auth/me`);
    if (!probe.ok && probe.status !== 401) {
      throw new Error(`Unexpected status ${probe.status} on /api/auth/me`);
    }
    console.log(`  Server reachable (${probe.status})\n`);
  } catch (err: any) {
    console.error(`  Cannot reach server at ${BASE_URL}: ${err.message}`);
    console.error('  Start the app first: npm run dev');
    process.exit(1);
  }

  // Ensure runs/ directory exists
  fs.mkdirSync(RUNS_DIR, { recursive: true });

  // Execute all runs sequentially for clean determinism comparison
  const results: RunResult[] = [];
  for (let i = 0; i < RUNS; i++) {
    process.stdout.write(`  Run ${i.toString().padStart(2, '0')} `);
    const result = await runOnce(i, fixture);
    results.push(result);

    // Print per-step status dots
    for (const step of STEPS) {
      process.stdout.write(result.steps[step]?.pass ? '.' : 'F');
    }
    console.log(` (${result.totalMs}ms)  projectId=${result.projectId ?? 'none'}`);
  }

  console.log('\n───────────────────────────────────────────────────');

  // Check determinism
  const determinism = checkDeterminism(results);
  console.log('  Determinism check:');
  for (const [step, d] of Object.entries(determinism)) {
    const icon = d.deterministic ? '✓' : '✗';
    console.log(`    ${icon} ${step.padEnd(18)} ${d.note}`);
  }

  // Build and save report
  const report = buildReport(results, determinism);
  const reportPath = path.join(RUNS_DIR, 'beta-mock-report.md');
  fs.writeFileSync(reportPath, report);
  console.log(`\n  Report saved: ${reportPath}`);

  // Save a machine-readable summary alongside
  const summaryPath = path.join(RUNS_DIR, 'beta-mock-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify({ results, determinism }, null, 2));
  console.log(`  Summary JSON: ${summaryPath}`);

  // Exit code reflects overall pass/fail
  const allPassed = results.every(r => STEPS.every(step => r.steps[step]?.pass));
  const allDeterministic = Object.values(determinism).every(d => d.deterministic);
  console.log(`\n  Overall: ${allPassed ? '✓ ALL STEPS PASS' : '✗ SOME STEPS FAILED'}  |  Determinism: ${allDeterministic ? '✓ OK' : '✗ DRIFT DETECTED'}`);
  console.log('═══════════════════════════════════════════════════\n');

  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
