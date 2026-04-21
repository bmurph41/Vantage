// AI parser accuracy benchmark.
// Calls Claude Opus on each fixture and measures field-level extraction
// accuracy. Requires ANTHROPIC_API_KEY. Costs ~$0.10-0.30 per full run.
//
//   npx tsx tests/parser-benchmark-ai.mjs                         # all fixtures
//   npx tsx tests/parser-benchmark-ai.mjs 01-multifamily-pl-clean # one fixture
//
// Output: per-field PASS/MISS, overall accuracy %, average confidence on hits,
// and a "ground-truth divergence" table for any non-trivial mismatch.

import fs from 'fs';
import path from 'path';
import { extractExcel } from '/home/runner/workspace/server/services/document-parser/excel-extractor.ts';
import { extractPL, extractRentRoll } from '/home/runner/workspace/server/services/document-parser/claude-extractor.ts';

const FIXTURE_DIR = '/home/runner/workspace/tests/extraction-fixtures';
const EXPECTED_DIR = path.join(FIXTURE_DIR, 'expected');

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY not set — benchmark cannot run.');
  console.error('For deterministic checks (no API), use parser-benchmark-deterministic.mjs');
  process.exit(2);
}

const filterId = process.argv[2];
const TOLERANCE = 0.005; // 0.5% relative tolerance for numeric comparison

// ── Per-fixture accuracy scoring ────────────────────────────────────────────
function scoreField(fieldName, actual, expected) {
  // Skip fields that aren't in the expected ground truth
  if (expected === undefined || expected === null) return null;

  // Numeric comparison
  if (typeof expected === 'number') {
    if (typeof actual !== 'number') {
      return { pass: false, reason: `type mismatch: expected number, got ${typeof actual}` };
    }
    const diff = Math.abs(actual - expected);
    const relDiff = expected !== 0 ? diff / Math.abs(expected) : diff;
    return {
      pass: relDiff <= TOLERANCE || diff < 1, // pass if within 0.5% OR within $1
      reason: relDiff <= TOLERANCE ? null : `actual=${actual} expected=${expected} diff=${diff.toFixed(2)}`,
    };
  }

  // String comparison (case-insensitive contains)
  if (typeof expected === 'string') {
    if (typeof actual !== 'string') {
      return { pass: false, reason: `type mismatch: expected string, got ${typeof actual}` };
    }
    const a = actual.toLowerCase().trim();
    const e = expected.toLowerCase().trim();
    return {
      pass: a === e || a.includes(e) || e.includes(a),
      reason: a === e ? null : `actual="${actual}" expected="${expected}"`,
    };
  }

  return null;
}

async function runFixture(expectedFile) {
  const meta = JSON.parse(fs.readFileSync(path.join(EXPECTED_DIR, expectedFile), 'utf8'));
  const id = meta.id;
  if (filterId && id !== filterId) return null;

  const candidates = [`${id}.xlsx`, `${id}.csv`];
  const fixtureFile = candidates.find(f => fs.existsSync(path.join(FIXTURE_DIR, f)));
  if (!fixtureFile) {
    console.log(`  [SKIP] ${id}`);
    return null;
  }

  console.log(`\n  === ${id} (${fixtureFile}, class=${meta.docClass}) ===`);

  // Step 1: Extract text payload
  let xl;
  try {
    xl = await extractExcel(path.join(FIXTURE_DIR, fixtureFile));
  } catch (e) {
    console.log(`    [ERR] extractExcel failed: ${e.message}`);
    return { id, score: 0, total: 0 };
  }

  // Step 2: Send to Claude
  let extraction;
  const t0 = Date.now();
  try {
    if (meta.docClass === 'rent_roll') {
      extraction = await extractRentRoll(xl.fullText, '', fixtureFile);
    } else {
      // Treat 't12' the same as 'pl' for extraction (Claude understands monthly cols)
      extraction = await extractPL(xl.fullText, '', fixtureFile);
    }
  } catch (e) {
    console.log(`    [ERR] Claude extraction failed: ${e.message}`);
    return { id, score: 0, total: 0 };
  }
  const elapsedMs = Date.now() - t0;

  // Step 3: Score each expected field
  const data = extraction.data ?? {};
  const conf = extraction.confidence_scores ?? {};
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  const confidences = [];

  for (const [field, expectedValue] of Object.entries(meta.expected)) {
    if (field.endsWith('_count')) continue; // structural assertions, handled separately
    const actualValue = data[field];
    const result = scoreField(field, actualValue, expectedValue);
    if (result === null) { skipped++; continue; }
    if (result.pass) {
      pass++;
      if (typeof conf[field] === 'number') confidences.push(conf[field]);
    } else {
      fail++;
      failures.push({ field, ...result, claudeConfidence: conf[field] });
    }
  }

  // Structural checks (e.g. monthly_breakdown_count)
  if (typeof meta.expected.monthly_breakdown_count === 'number') {
    const actualCount = (data.monthly_breakdown ?? []).length;
    const ok = actualCount >= meta.expected.monthly_breakdown_count;
    if (ok) pass++; else { fail++; failures.push({ field: 'monthly_breakdown.length', reason: `got ${actualCount}, expected ≥ ${meta.expected.monthly_breakdown_count}` }); }
  }
  if (typeof meta.expected.units_count === 'number') {
    const actualCount = (data.units ?? []).length;
    const ok = actualCount === meta.expected.units_count;
    if (ok) pass++; else { fail++; failures.push({ field: 'units.length', reason: `got ${actualCount}, expected ${meta.expected.units_count}` }); }
  }

  const total = pass + fail;
  const accuracy = total > 0 ? (pass / total * 100).toFixed(1) : '—';
  const avgConf = confidences.length > 0
    ? (confidences.reduce((s, c) => s + c, 0) / confidences.length).toFixed(2)
    : '—';

  console.log(`    Accuracy: ${pass}/${total} (${accuracy}%)  | avg confidence on hits: ${avgConf}  | latency: ${elapsedMs}ms`);
  if (failures.length > 0) {
    console.log(`    Failures:`);
    for (const f of failures) {
      console.log(`      - ${f.field}: ${f.reason}${f.claudeConfidence !== undefined ? ` [Claude conf=${f.claudeConfidence}]` : ''}`);
    }
  }

  return { id, pass, fail, total, accuracy: parseFloat(accuracy), avgConf: parseFloat(avgConf) || 0, elapsedMs };
}

async function main() {
  console.log('=== AI Parser Accuracy Benchmark ===');
  console.log(`Tolerance: ±${(TOLERANCE * 100).toFixed(2)}% (or ±$1) for numeric fields\n`);

  const expectedFiles = fs.readdirSync(EXPECTED_DIR).filter(f => f.endsWith('.json')).sort();
  const allResults = [];
  for (const f of expectedFiles) {
    const r = await runFixture(f);
    if (r) allResults.push(r);
  }

  if (allResults.length === 0) {
    console.log('\nNo fixtures matched.');
    process.exit(1);
  }

  // ── Aggregate summary ────────────────────────────────────────────────────
  const totalPass = allResults.reduce((s, r) => s + r.pass, 0);
  const totalChecks = allResults.reduce((s, r) => s + r.total, 0);
  const overallAccuracy = totalChecks > 0 ? (totalPass / totalChecks * 100).toFixed(1) : '—';
  const totalLatency = allResults.reduce((s, r) => s + (r.elapsedMs || 0), 0);

  console.log(`\n=== SUMMARY ===`);
  console.log(`Overall accuracy: ${totalPass}/${totalChecks} (${overallAccuracy}%)  across ${allResults.length} fixtures`);
  console.log(`Total latency:    ${(totalLatency / 1000).toFixed(1)}s`);
  console.log(`\nPer-fixture breakdown:`);
  for (const r of allResults) {
    const tag = r.accuracy >= 95 ? '✓' : r.accuracy >= 85 ? '~' : '✗';
    console.log(`  ${tag} ${r.id.padEnd(40)} ${r.accuracy}%  (conf ${r.avgConf}, ${r.elapsedMs}ms)`);
  }

  // Exit code: 0 if overall ≥ 90%, 1 otherwise
  process.exit(parseFloat(overallAccuracy) >= 90 ? 0 : 1);
}

main().catch(e => { console.error('Benchmark crashed:', e); process.exit(2); });
