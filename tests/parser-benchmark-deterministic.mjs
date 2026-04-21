// Deterministic parser benchmark.
// Tests the file-routing + Excel/CSV extraction layers WITHOUT calling Claude.
// Always runs (no API key required). Catches regressions in the extraction
// pipeline before Claude even sees the text.
//
// For AI-level accuracy, see parser-benchmark-ai.mjs (calls Claude, gated on
// ANTHROPIC_API_KEY).
//
//   npx tsx tests/parser-benchmark-deterministic.mjs

import fs from 'fs';
import path from 'path';
import { extractExcel } from '/home/runner/workspace/server/services/document-parser/excel-extractor.ts';

const FIXTURE_DIR = '/home/runner/workspace/tests/extraction-fixtures';
const EXPECTED_DIR = path.join(FIXTURE_DIR, 'expected');

const results = [];

// CSVs are routed through the same extractExcel code path in production
// (XLSX can parse CSVs), so the benchmark uses extractExcel for both.

// ── Checks ─────────────────────────────────────────────────────────────────
function addCheck(fixture, name, pass, detail = '') {
  results.push({ fixture, name, pass, detail });
  const tag = pass ? 'PASS' : 'FAIL';
  console.log(`    [${tag}] ${name}${detail ? '  ' + detail : ''}`);
}

// ── Run each fixture ───────────────────────────────────────────────────────
async function runFixture(expectedFile) {
  const meta = JSON.parse(fs.readFileSync(path.join(EXPECTED_DIR, expectedFile), 'utf8'));
  const id = meta.id;

  // Find the fixture file (xlsx OR csv)
  const candidates = [`${id}.xlsx`, `${id}.csv`];
  const fixtureFile = candidates.find(f => fs.existsSync(path.join(FIXTURE_DIR, f)));
  if (!fixtureFile) {
    console.log(`  [SKIP] ${id} — no fixture file found`);
    return;
  }
  const fixturePath = path.join(FIXTURE_DIR, fixtureFile);
  const isCSV = fixtureFile.endsWith('.csv');

  console.log(`\n  === ${id} (${fixtureFile}) ===`);

  // ── Tier 1: File ingestion (Excel/CSV → structured sheet data) ──────────
  let extracted;
  try {
    const xl = await extractExcel(fixturePath);
    extracted = { ...xl, fullText: xl.fullText };
    addCheck(id, 'extractExcel() ingests without error', true);
    addCheck(id, 'at least one sheet found', xl.sheets.length > 0, `(${xl.sheets.length} sheets)`);
    addCheck(id, 'primarySheet has rows', xl.primarySheet.rows.length > 0,
      `(${xl.primarySheet.rows.length} rows)`);
  } catch (e) {
    addCheck(id, 'extraction did not throw', false, e.message);
    return;
  }

  // ── Tier 2: fullText contains every expected dollar amount ───────────────
  // If a number is in the document, the fullText payload sent to Claude must
  // contain it. This is the floor below which Claude cannot possibly succeed.
  // Skip fields tagged as "derived" in expected (totals not in source doc).
  const expected = meta.expected;
  const derivedFields = new Set(meta.derivedFields ?? ['total_potential_rent']);
  const numericFields = Object.entries(expected).filter(([k, v]) =>
    typeof v === 'number' && v > 0 && !k.includes('count') && !derivedFields.has(k)
  );

  // Normalize fullText for searching: strip $, commas, parens (treat as positive).
  const normalizedText = extracted.fullText.replace(/[$,()]/g, '');

  let containedCount = 0;
  const missingFields = [];
  for (const [field, value] of numericFields) {
    const raw = String(value);
    const commaFmt = value.toLocaleString('en-US');
    const found =
      extracted.fullText.includes(raw) ||
      extracted.fullText.includes(commaFmt) ||
      normalizedText.includes(raw);
    if (found) containedCount++;
    else missingFields.push(`${field}=${raw}`);
  }

  const fullTextCoverage = numericFields.length > 0
    ? containedCount / numericFields.length
    : 1;
  addCheck(id, `fullText covers ${(fullTextCoverage * 100).toFixed(0)}% of expected numerics`,
    fullTextCoverage >= 0.95,
    `(${containedCount}/${numericFields.length}${missingFields.length ? '; missing: ' + missingFields.slice(0, 3).join(', ') : ''})`);

  // ── Tier 3: fullText contains key labels ─────────────────────────────────
  // Tests that headers + line-item labels survive the Excel → text conversion.
  if (expected.property_name) {
    const found = extracted.fullText.toLowerCase().includes(expected.property_name.toLowerCase());
    addCheck(id, `fullText contains property name "${expected.property_name}"`, found);
  }
  if (meta.docClass === 'pl' || meta.docClass === 't12') {
    // Accept any of: Revenue, Income, Inc., Expense, Expenses, OpEx, NOI
    const haystack = extracted.fullText.toLowerCase();
    const found = ['revenue', 'income', 'inc.', 'expense', 'expenses', 'opex', 'noi'].some(l =>
      haystack.includes(l)
    );
    addCheck(id, `fullText contains a P&L line label`, found);
  }

  // ── Tier 4: Sanity (no empty output) ─────────────────────────────────────
  addCheck(id, 'fullText is non-empty', extracted.fullText.length > 50,
    `(${extracted.fullText.length} chars)`);
}

async function main() {
  console.log('=== Deterministic Parser Benchmark ===');
  console.log('Tests extraction pipeline without calling Claude.');

  const expectedFiles = fs.readdirSync(EXPECTED_DIR).filter(f => f.endsWith('.json'));
  for (const f of expectedFiles) {
    await runFixture(f);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const total = results.length;
  const pass = results.filter(r => r.pass).length;
  const fail = total - pass;
  console.log(`\n=== SUMMARY ===\n${pass}/${total} checks passed across ${expectedFiles.length} fixtures\n`);
  if (fail > 0) {
    console.log('FAILURES:');
    for (const r of results.filter(r => !r.pass)) {
      console.log(`  ${r.fixture} — ${r.name}${r.detail ? '  ' + r.detail : ''}`);
    }
    process.exit(1);
  }
  process.exit(0);
}

main().catch(e => { console.error('Benchmark crashed:', e); process.exit(2); });
