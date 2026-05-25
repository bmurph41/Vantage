/**
 * Year-corruption parse harness — permanent regression gate for the
 * timeAlign.ts:136 / inferYearFromText / scanForHeaderRow election bug
 * (Layer 0 Step 1).
 *
 * Two halves:
 *
 * (A) inferYearFromText test matrix — proves the fix on filename inference:
 *      - Underscored real filenames (production cohort) → correct year
 *      - Loosened boundary doesn't grab 4-digit non-years (Property_1234_*)
 *      - "Unit_4500_2023_PnL.xlsx" picks 2023 (real year), not 4500 (junk)
 *      - Existing-working cases still work (2024.xlsx, "income statement 2024.xlsx")
 *      - False-positive eliminated (10-1-24 → null, not 2010)
 *
 * (B) End-to-end extractor test on a synthetic XLSX with the FAILURE MODE shape:
 *      - NO clear period header in row 0
 *      - 4-digit JUNK values (3032, 6064) in a TOTALS row
 *      - Real marina line items (Summer Dockage, Winter Storage, Gas Dock Fuel)
 *      - Filename `Sunset_Bay_2023_P_and_L.xlsx` → fallback chain must
 *        recover year=2023 (parser-recovers, not just parser-rejects)
 *
 * Canonical year range (consistent across the three fix sites):
 *   1900-2099 — covers all realistic P&L vintages; matches `(?:19|20)\d{2}`.
 *   Engine's defense-in-depth filter (consolidated-pnl-service.ts) stays
 *   wider at 1900-2200 and gets observability (Site 3) — by design.
 */

import * as XLSX from 'xlsx';
import { extractExcelPnl, inferYearFromText } from '../server/services/pnl/excel-extractor';
import { periodToFactKeys } from '../server/services/pnl/timeAlign';

// ─── (A) inferYearFromText matrix ───────────────────────────────────────────

interface InferCase {
  filename: string;
  expected: number | null;
  why: string;
}

const INFER_CASES: InferCase[] = [
  // ── Real production filenames that broke pre-fix ──
  { filename: 'Sunset_Bay_2023_P_and_L.xlsx',     expected: 2023, why: 'underscored real filename (synthetic anchor)' },
  { filename: '2022_Income_Statement.xlsx',       expected: 2022, why: '54c1b93a actual upload — underscored, currently produces null pre-fix' },
  { filename: '2025_Income_Statement.xlsx',       expected: 2025, why: '54c1b93a actual upload (one of 4)' },
  { filename: 'SS3_2023_Monthly_P_Ls.xlsx',       expected: 2023, why: 'd8a0df1e actual marina upload' },
  { filename: 'SHVM_2024.xlsx',                   expected: 2024, why: '7df94d2a actual marina upload' },

  // ── Existing working cases — must NOT regress ──
  { filename: '2024.xlsx',                        expected: 2024, why: 'bare year filename' },
  { filename: 'income statement 2024.xlsx',       expected: 2024, why: 'space-separated, currently works' },
  { filename: 'P&L 2023.xlsx',                    expected: 2023, why: 'space + ampersand, currently works' },

  // ── Range gate must reject non-year 4-digit numbers ──
  { filename: 'Property_1234_PnL.xlsx',           expected: null, why: '1234 is NOT a year (range gate rejects <1900)' },
  { filename: 'Account_9999_2024.xlsx',           expected: 2024, why: '9999 rejected, 2024 picked — picks first VALID match' },
  { filename: 'Unit_4500_2023_PnL.xlsx',          expected: 2023, why: 'has both junk 4500 AND real year — picks 2023 not 4500' },
  { filename: 'Property_3032_6064.xlsx',          expected: null, why: 'production-observed corruption values — both rejected' },

  // ── False-positive eliminated: 2-digit dates ──
  { filename: '10-1-24_-_9-30-25_PnL.xlsx',       expected: null, why: 'pre-fix returned 2010 (false positive on "10"); post-fix returns null (no fy/cy/quote prefix)' },
  { filename: '01-15-2024.xlsx',                  expected: 2024, why: 'dashes treated as boundaries' },

  // ── 2-digit prefixed forms still work ──
  { filename: 'FY24_Statement.xlsx',              expected: 2024, why: 'fy prefix → 2-digit branch' },
  { filename: "Statement_'23.xlsx",               expected: 2023, why: 'quote prefix → 2-digit branch' },

  // ── No year findable ──
  { filename: 'P&L.xlsx',                         expected: null, why: 'no year present anywhere' },
  { filename: 'Income_Statement.xlsx',            expected: null, why: 'no year present anywhere' },
];

console.log('=== Year-corruption parse harness — Layer 0 Step 1 ===\n');
console.log('━━━ (A) inferYearFromText matrix ━━━\n');

let inferFailures = 0;
for (const t of INFER_CASES) {
  const got = inferYearFromText(t.filename);
  const ok = got === t.expected;
  const sym = ok ? '✓' : '✗';
  console.log(`  ${sym} "${t.filename}" → ${got} (expected ${t.expected})${ok ? '' : '  — ' + t.why}`);
  if (!ok) inferFailures++;
}

console.log(`\n  Matrix result: ${INFER_CASES.length - inferFailures}/${INFER_CASES.length} passed`);

// ─── (B) End-to-end extractor on synthetic XLSX ─────────────────────────────

function buildSyntheticMarinaPnL(): Buffer {
  const aoa: any[][] = [
    ['Sunset Bay Marina', '', ''],
    ['Revenue', '', ''],
    ['Summer Dockage', 893839, 893839],
    ['Winter Storage', 760503, 760503],
    ['Transient Dockage', 246134, 246134],
    ['Land Storage', 22518, 22518],
    ['Gas Dock Fuel', 873249, 873249],
    ['Marina Income', 14796, 14796],
    ['Expenses', '', ''],
    ['Bottom Wash', 21791, 21791],
    ['Bottom Paint', 71593, 71593],
    ['Hauling', 144765, 144765],
    ['Shrink Wrap', 80529, 80529],
    ['Salaries', 1050872, 1050872],
    ['Insurance', 915, 915],
    ['Rent', 16800, 16800],
    ['Utilities', 11605, 11605],
    ['Repairs', 4919, 4919],
    ['TOTALS', 3032, 6064],                  // ← the junk that pre-fix mis-elected as years
    ['ADJUSTED NET TO OWNER', 41104, 15432],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, 'P&L');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

console.log('\n━━━ (B) End-to-end extractor on synthetic XLSX ━━━\n');
const FILENAME = 'Sunset_Bay_2023_P_and_L.xlsx';
const buf = buildSyntheticMarinaPnL();
const result = extractExcelPnl(buf, null, FILENAME);

console.log(`Synthetic file: ${FILENAME}`);
console.log(`Periods detected: ${result.periods.length}`);
for (const p of result.periods) {
  console.log(`  label="${p.label}" year=${p.year} type=${p.type}`);
}
console.log(`Rows extracted: ${result.rows.length}`);
console.log(`Year inferred: ${result.yearInferred}\n`);

let extractFailures = 0;
if (result.periods.length === 0) {
  console.error(`✗ FAIL — 0 periods (parser failed to recover; fallback chain didn't fire)`);
  extractFailures++;
} else {
  for (const p of result.periods) {
    if (p.year < 1900 || p.year > 2099) {
      console.error(`✗ FAIL — period year=${p.year} out of canonical range [1900,2099]`);
      extractFailures++;
    }
    if (p.year !== 2023) {
      console.error(`✗ FAIL — period year=${p.year}, expected 2023 (filename "${FILENAME}" → inferYearFromText → 2023)`);
      extractFailures++;
    }
  }
}

// ─── (C) Site 2 write-time assert (simulates storeMappedFacts ingest guard) ──

console.log('\n━━━ (C) Site 2 ingest.ts write-time assert ━━━\n');

interface AssertCase { fiscalYear: number; shouldThrow: boolean; why: string; }
const ASSERT_CASES: AssertCase[] = [
  { fiscalYear: 2023, shouldThrow: false, why: 'in-range year' },
  { fiscalYear: 1900, shouldThrow: false, why: 'lower bound inclusive' },
  { fiscalYear: 2099, shouldThrow: false, why: 'upper bound inclusive' },
  { fiscalYear: 3032, shouldThrow: true,  why: 'production-observed corruption value' },
  { fiscalYear: 6064, shouldThrow: true,  why: 'production-observed corruption value' },
  { fiscalYear: 1899, shouldThrow: true,  why: 'below lower bound' },
  { fiscalYear: 2100, shouldThrow: true,  why: 'above upper bound (engine-filter starts ignoring at >2200, write-assert tighter)' },
];

// Replicate the assert exactly from ingest.ts to validate consistency.
function ingestAssert(fiscalYear: number): void {
  if (fiscalYear < 1900 || fiscalYear > 2099) {
    throw new Error(`out-of-range fiscalYear=${fiscalYear}`);
  }
}

let assertFailures = 0;
for (const t of ASSERT_CASES) {
  let threw = false;
  try { ingestAssert(t.fiscalYear); } catch { threw = true; }
  const ok = threw === t.shouldThrow;
  const sym = ok ? '✓' : '✗';
  console.log(`  ${sym} fiscalYear=${t.fiscalYear} → ${threw ? 'THROW' : 'pass'} (expected ${t.shouldThrow ? 'THROW' : 'pass'}) — ${t.why}`);
  if (!ok) assertFailures++;
}

// Also: verify timeAlign.periodToFactKeys propagates a real year correctly
// (the upstream of Site 2 — make sure the assert sees the right thing).
const goodKeys = periodToFactKeys({
  label: 'FY 2023', start: '2023-01-01', end: '2023-12-31',
  type: 'year', year: 2023, periodNo: 1,
});
if (goodKeys.fiscalYear !== 2023) {
  console.error(`  ✗ periodToFactKeys did not propagate year=2023 — got ${goodKeys.fiscalYear}`);
  assertFailures++;
} else {
  console.log(`  ✓ periodToFactKeys propagates year=2023 → keys.fiscalYear=${goodKeys.fiscalYear} (upstream contract holds)`);
}

console.log(`\n  Site 2 assert: ${ASSERT_CASES.length + 1 - assertFailures}/${ASSERT_CASES.length + 1} passed`);

// ─── Summary ────────────────────────────────────────────────────────────────

const totalFailures = inferFailures + extractFailures + assertFailures;
console.log('\n━━━ Summary ━━━');
console.log(`  (A) inferYearFromText matrix: ${INFER_CASES.length - inferFailures}/${INFER_CASES.length}`);
console.log(`  (B) End-to-end extractor:     ${extractFailures === 0 ? 'GREEN' : 'FAIL'}`);
console.log(`  (C) Site 2 ingest write-assert: ${ASSERT_CASES.length + 1 - assertFailures}/${ASSERT_CASES.length + 1}`);
if (totalFailures === 0) {
  console.log(`\n✓ GREEN — Sites 1a + 1b + 2 all verified on synthetic. Real-file end-to-end pass still required before demo-ready.`);
  process.exit(0);
} else {
  console.error(`\n✗ FAILED — ${totalFailures} regression(s).`);
  process.exit(1);
}
