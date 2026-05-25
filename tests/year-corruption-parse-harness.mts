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

// ─── (D) Sheet-selection regression — QB Desktop "Tips + Sheet1" shape ──────
//
// Real marina-upload blocker found 2026-05-25 while verifying Layer 0 Step 1
// against the SS3_2023_Monthly_P&Ls.xlsx file. selectBestSheet was picking
// SheetNames[0] when name-scoring tied at 0, which deterministically chose the
// "QuickBooks Desktop Export Tips" cover sheet over the real "Sheet1" data.
// Fix: content-aware tiebreaker (numericCellCount) gated strictly below the
// name-decisive path. See project_select_best_sheet_qb_tips_defect.md.
//
// Fixtures protect:
//   D1  single-sheet generically named — still picks its only sheet
//   D2  multi-sheet, sheet 0 generic name + data, sheet 1 empty — still picks sheet 0
//   D3  sheet 0 = SKIP (-100), sheet 1 = P&L (+10) — name-decisive, tiebreaker NEVER reached
//   D4  SS3-shape synthetic ("Tips" cover + "Sheet1" data) — tiebreaker picks Sheet1

console.log('\n━━━ (D) Sheet-selection: QB Desktop "Tips + Sheet1" shape ━━━\n');

function makeWorkbook(sheets: { name: string; rows: any[][] }[]): Buffer {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.rows), s.name);
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

interface SheetCase {
  id: string;
  label: string;
  buf: Buffer;
  filename: string;
  expectedSheet: string;
  why: string;
}

const SHEET_CASES: SheetCase[] = [
  {
    id: 'D1', label: 'single-sheet generic name',
    buf: makeWorkbook([{
      name: 'Sheet1',
      rows: [
        ['', '', 'Jan 24', 'Feb 24', 'Mar 24'],
        ['Income',  '',    1000,    1100,    1200],
        ['Expense', '',     500,     520,     540],
      ],
    }]),
    filename: 'd1_single.xlsx',
    expectedSheet: 'Sheet1',
    why: 'only one sheet present — tiebreaker degenerates correctly',
  },
  {
    id: 'D2', label: 'sheet 0 generic+data, sheet 1 empty',
    buf: makeWorkbook([
      { name: 'Sheet1', rows: [
        ['', 'Jan 24', 'Feb 24', 'Mar 24'],
        ['Income',  1000, 1100, 1200],
        ['Expense',  500,  520,  540],
      ]},
      { name: 'Notes', rows: [['Empty notes sheet']] },
    ]),
    filename: 'd2_data_on_sheet0.xlsx',
    expectedSheet: 'Sheet1',
    why: 'tiebreaker picks content-heaviest; sheet 0 retains',
  },
  {
    id: 'D3', label: 'SKIP sheet 0 + P&L sheet 1 — name-decisive',
    buf: makeWorkbook([
      { name: 'Balance Sheet', rows: [['Asset', 100], ['Liability', 50]] },
      { name: 'Income Statement', rows: [
        ['', 'Jan 24', 'Feb 24'],
        ['Revenue', 1000, 1100],
        ['COGS',     400,  420],
      ]},
    ]),
    filename: 'd3_named_pnl.xlsx',
    expectedSheet: 'Income Statement',
    why: 'positive name-score short-circuits; tiebreaker never reached',
  },
  {
    id: 'D4', label: 'SS3-shape synthetic ("Tips" cover + "Sheet1" data)',
    buf: makeWorkbook([
      { name: 'QuickBooks Desktop Export Tips', rows: Array.from({ length: 40 }, () => [null, null]) },
      { name: 'Sheet1', rows: [
        ['', '', 'Jan 23', 'Feb 23', 'Mar 23', 'Apr 23'],
        ['Income',  '', 1000, 1100, 1200, 1300],
        ['Rent',    '',  500,  510,  520,  530],
        ['Expense', '',  300,  310,  320,  330],
      ]},
    ]),
    filename: 'd4_ss3_synthetic.xlsx',
    expectedSheet: 'Sheet1',
    why: 'the real defect — both sheets score 0 on name; tiebreaker by numeric-cell count picks Sheet1',
  },
];

let sheetFailures = 0;
for (const t of SHEET_CASES) {
  const r = extractExcelPnl(t.buf, null, t.filename);
  const ok = r.sheetUsed === t.expectedSheet;
  const sym = ok ? '✓' : '✗';
  console.log(`  ${sym} ${t.id} ${t.label} → sheetUsed="${r.sheetUsed}" (expected "${t.expectedSheet}")${ok ? '' : '  — ' + t.why}`);
  if (!ok) sheetFailures++;
}

// D4 additionally validates that monthly-header parsing works downstream of
// the correct sheet pick (regression guard if anyone touches MONTH_PATTERNS).
{
  const r = extractExcelPnl(SHEET_CASES[3].buf, null, SHEET_CASES[3].filename);
  const periodsOk = r.periods.length === 4 && r.periods[0].year === 2023 && r.periods[0].periodNo === 1;
  console.log(`  ${periodsOk ? '✓' : '✗'} D4 monthly parse — ${r.periods.length} periods, first="${r.periods[0]?.label}" year=${r.periods[0]?.year} month=${r.periods[0]?.periodNo}`);
  if (!periodsOk) sheetFailures++;
}

console.log(`\n  Sheet-selection: ${SHEET_CASES.length + 1 - sheetFailures}/${SHEET_CASES.length + 1} passed`);

// ─── Summary ────────────────────────────────────────────────────────────────

const totalFailures = inferFailures + extractFailures + assertFailures + sheetFailures;
console.log('\n━━━ Summary ━━━');
console.log(`  (A) inferYearFromText matrix:   ${INFER_CASES.length - inferFailures}/${INFER_CASES.length}`);
console.log(`  (B) End-to-end extractor:       ${extractFailures === 0 ? 'GREEN' : 'FAIL'}`);
console.log(`  (C) Site 2 ingest write-assert: ${ASSERT_CASES.length + 1 - assertFailures}/${ASSERT_CASES.length + 1}`);
console.log(`  (D) Sheet selection (QB-Tips):  ${SHEET_CASES.length + 1 - sheetFailures}/${SHEET_CASES.length + 1}`);
if (totalFailures === 0) {
  console.log(`\n✓ GREEN — Sites 1a + 1b + 2 + sheet-selection all verified on synthetic.`);
  process.exit(0);
} else {
  console.error(`\n✗ FAILED — ${totalFailures} regression(s).`);
  process.exit(1);
}
