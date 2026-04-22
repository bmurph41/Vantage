#!/usr/bin/env node
// Sibling to parser-audit for the contract parser. Reads the synthetic LOI/PSA/ASA
// text fixtures in tests/extraction-fixtures/contracts/, calls extractContract()
// directly, and compares against the hand-labeled expected JSON.
//
// Usage:
//   ANTHROPIC_API_KEY=xxx node tests/contract-parser-audit.mjs
//   ANTHROPIC_API_KEY=xxx node tests/contract-parser-audit.mjs --only 07
//
// Pass criteria (per field):
//   - exact match on parties.{buyer,seller,property_address,apn}
//   - exact match on money.{purchase_price,earnest_money}
//   - exact match on dates.{effective_date,closing_date,...} when present
//   - flags.assignment_allowed must match expected value (true/false/null)
//
// Confidence ≥0.7 on any populated field (lower is a soft warning, not a fail).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIX_DIR = path.join(__dirname, 'extraction-fixtures', 'contracts');
const EXPECTED_DIR = path.join(__dirname, 'extraction-fixtures', 'expected');

const argv = process.argv.slice(2);
const onlyIdx = argv.indexOf('--only');
const only = onlyIdx >= 0 ? argv[onlyIdx + 1] : null;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is required.');
  process.exit(1);
}

// Import the extractor via tsx (the service is TypeScript and uses path-mapped imports).
const { extractContract } = await import('../server/services/document-parser/contract-extractor.ts');

const fixtures = fs
  .readdirSync(FIX_DIR)
  .filter((f) => f.endsWith('.txt') && (!only || f.startsWith(only)))
  .sort();

let total = 0;
let pass = 0;
const failureSummary = [];

for (const fixtureFile of fixtures) {
  const id = fixtureFile.replace(/\.txt$/, '');
  const fullText = fs.readFileSync(path.join(FIX_DIR, fixtureFile), 'utf-8');
  const expectedPath = path.join(EXPECTED_DIR, `${id}.json`);
  if (!fs.existsSync(expectedPath)) {
    console.log(`[skip] ${id}: no expected JSON`);
    continue;
  }
  const { docClass, expected } = JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));

  console.log(`\n=== ${id} (${docClass}) ===`);
  let envelope;
  try {
    envelope = await extractContract(fullText, fixtureFile, docClass);
  } catch (err) {
    console.log(`  FAIL: extractor threw — ${err.message}`);
    failureSummary.push({ id, reason: err.message });
    continue;
  }

  const data = envelope.data ?? {};
  const fails = [];
  const warns = [];

  const check = (pathStr, expectedVal) => {
    const actual = pathStr.split('.').reduce((obj, k) => obj?.[k], data);
    total += 1;
    const match =
      (expectedVal == null && actual == null) ||
      (typeof expectedVal === 'string' && typeof actual === 'string' &&
        actual.toLowerCase().includes(expectedVal.toLowerCase())) ||
      actual === expectedVal;
    if (match) {
      pass += 1;
    } else {
      fails.push({ pathStr, expected: expectedVal, actual });
    }
    const confidence = envelope.confidence_scores?.[pathStr] ?? 0;
    if (actual != null && confidence > 0 && confidence < 0.7) {
      warns.push({ pathStr, confidence });
    }
  };

  for (const [k, v] of Object.entries(expected.parties ?? {})) check(`parties.${k}`, v);
  for (const [k, v] of Object.entries(expected.money ?? {})) check(`money.${k}`, v);
  for (const [k, v] of Object.entries(expected.dates ?? {})) check(`dates.${k}`, v);
  for (const [k, v] of Object.entries(expected.flags ?? {})) check(`flags.${k}`, v);

  if (fails.length === 0) {
    console.log(`  PASS (${warns.length} low-confidence warnings)`);
  } else {
    console.log(`  FAIL: ${fails.length} mismatches`);
    for (const f of fails) {
      console.log(`    ${f.pathStr}: expected=${JSON.stringify(f.expected)} actual=${JSON.stringify(f.actual)}`);
    }
    failureSummary.push({ id, mismatches: fails.length });
  }
  for (const w of warns) {
    console.log(`    [warn] ${w.pathStr} confidence=${w.confidence.toFixed(2)}`);
  }
}

console.log(`\n── Summary ────────────────────────`);
console.log(`  Pass rate: ${pass}/${total} (${((pass / total) * 100).toFixed(1)}%)`);
console.log(`  Failed fixtures: ${failureSummary.length}`);
if (failureSummary.length > 0) {
  for (const f of failureSummary) console.log(`    ${f.id}`);
}
process.exit(failureSummary.length > 0 ? 1 : 0);
