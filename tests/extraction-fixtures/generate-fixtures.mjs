// Generate deterministic XLSX + CSV P&L and rent roll fixtures with hand-labeled
// expected output. Run once to produce fixtures; benchmark harness reads them.
//
//   node tests/extraction-fixtures/generate-fixtures.mjs

import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const FIXTURE_DIR = '/home/runner/workspace/tests/extraction-fixtures';
const EXPECTED_DIR = path.join(FIXTURE_DIR, 'expected');
fs.mkdirSync(FIXTURE_DIR, { recursive: true });
fs.mkdirSync(EXPECTED_DIR, { recursive: true });

// ── Fixture catalog ─────────────────────────────────────────────────────────
// Each entry has:
//   id        : filename stem (e.g. "01-multifamily-pl")
//   format    : 'xlsx' | 'csv'
//   sheetName : tab name (xlsx only)
//   docClass  : 'pl' | 'rent_roll' | 't12'
//   rows      : 2D array — first row is headers, rest are data
//   expected  : ground-truth extraction (matches PLExtractionSchema or RentRollExtractionSchema)
const FIXTURES = [
  // ── 1. Standard multifamily P&L (clean labels, single column) ────────────
  {
    id: '01-multifamily-pl-clean',
    format: 'xlsx',
    sheetName: 'Income Statement',
    docClass: 'pl',
    rows: [
      ['Property: Lakeside Apartments', '', ''],
      ['Period: TTM ending 12/31/2025', '', ''],
      ['', '', ''],
      ['Line Item', 'Annual', 'Notes'],
      ['Gross Potential Rent', 5_280_000, '240 units × $1,833 avg × 12'],
      ['Vacancy Loss', 316_800, '6.0% vacancy'],
      ['Concessions', 79_200, '1.5%'],
      ['Bad Debt', 52_800, '1.0%'],
      ['Effective Gross Income', 4_831_200, ''],
      ['', '', ''],
      ['Other Income', '', ''],
      ['Parking Income', 145_000, ''],
      ['Laundry Income', 62_000, ''],
      ['Pet Fees', 48_000, ''],
      ['Late Fees', 28_500, ''],
      ['Utility Reimbursements', 380_000, ''],
      ['Total Other Income', 663_500, ''],
      ['', '', ''],
      ['Total Revenue', 5_494_700, ''],
      ['', '', ''],
      ['Operating Expenses', '', ''],
      ['Management Fees', 219_788, '4.0% of EGI'],
      ['Payroll & Benefits', 720_000, ''],
      ['Repairs & Maintenance', 425_000, ''],
      ['Contract Services', 165_000, ''],
      ['Utilities', 285_000, ''],
      ['Insurance', 195_000, ''],
      ['Real Estate Taxes', 685_000, ''],
      ['Landscaping', 48_000, ''],
      ['Administrative', 85_000, ''],
      ['Advertising & Marketing', 95_000, ''],
      ['Total Operating Expenses', 2_922_788, ''],
      ['', '', ''],
      ['Net Operating Income', 2_571_912, ''],
    ],
    expected: {
      property_name: 'Lakeside Apartments',
      reporting_period: 'TTM ending 12/31/2025',
      gross_potential_rent: 5_280_000,
      vacancy_loss: 316_800,
      concessions: 79_200,
      bad_debt: 52_800,
      effective_gross_income: 4_831_200,
      parking_income: 145_000,
      laundry_income: 62_000,
      late_fees: 28_500,
      pet_fees: 48_000,
      utility_reimbursements: 380_000,
      total_other_income: 663_500,
      total_revenue: 5_494_700,
      management_fees: 219_788,
      payroll: 720_000,
      repairs_maintenance: 425_000,
      contract_services: 165_000,
      utilities: 285_000,
      insurance: 195_000,
      real_estate_taxes: 685_000,
      landscaping: 48_000,
      administrative: 85_000,
      advertising_marketing: 95_000,
      total_operating_expenses: 2_922_788,
      net_operating_income: 2_571_912,
    },
  },

  // ── 2. P&L with abbreviated/unusual labels (tests aliasing) ─────────────
  {
    id: '02-multifamily-pl-aliased',
    format: 'xlsx',
    sheetName: 'P&L',
    docClass: 'pl',
    rows: [
      ['Description', 'Year 2025'],
      ['GPR', 3_600_000],
      ['Less: Vac.', 180_000],
      ['Concess.', 36_000],
      ['Bad debt', 18_000],
      ['EGI', 3_366_000],
      ['Other Inc.', 240_000],
      ['Total Inc.', 3_606_000],
      ['Mgmt Fee', 144_240],   // "Mgmt Fee" → management_fees
      ['P/R', 480_000],         // "P/R" → payroll
      ['R&M', 280_000],         // "R&M" → repairs_maintenance
      ['Util.', 195_000],       // "Util." → utilities
      ['Ins.', 125_000],
      ['RE Taxes', 425_000],    // → real_estate_taxes
      ['Landscape', 32_000],
      ['G&A', 65_000],          // "G&A" → administrative
      ['Marketing', 48_000],    // → advertising_marketing
      ['Total OpEx', 1_794_240],
      ['NOI', 1_811_760],
    ],
    expected: {
      gross_potential_rent: 3_600_000,
      vacancy_loss: 180_000,
      concessions: 36_000,
      bad_debt: 18_000,
      effective_gross_income: 3_366_000,
      total_other_income: 240_000,
      total_revenue: 3_606_000,
      management_fees: 144_240,
      payroll: 480_000,
      repairs_maintenance: 280_000,
      utilities: 195_000,
      insurance: 125_000,
      real_estate_taxes: 425_000,
      landscaping: 32_000,
      administrative: 65_000,
      advertising_marketing: 48_000,
      total_operating_expenses: 1_794_240,
      net_operating_income: 1_811_760,
    },
  },

  // ── 3. P&L with parenthesized negatives ──────────────────────────────────
  {
    id: '03-pl-parenthesized-negatives',
    format: 'csv',
    docClass: 'pl',
    rows: [
      ['Item', 'Amount'],
      ['Gross Potential Rent', '$2,400,000'],
      ['Vacancy Loss', '($120,000)'],
      ['Concessions', '($24,000)'],
      ['Bad Debt', '($12,000)'],
      ['Effective Gross Income', '$2,244,000'],
      ['Other Income', '$180,000'],
      ['Total Revenue', '$2,424,000'],
      ['Management Fees', '$96,960'],
      ['Total Operating Expenses', '$1,200,000'],
      ['Net Operating Income', '$1,224,000'],
    ],
    expected: {
      gross_potential_rent: 2_400_000,
      vacancy_loss: 120_000,
      concessions: 24_000,
      bad_debt: 12_000,
      effective_gross_income: 2_244_000,
      total_other_income: 180_000,
      total_revenue: 2_424_000,
      management_fees: 96_960,
      total_operating_expenses: 1_200_000,
      net_operating_income: 1_224_000,
    },
  },

  // ── 4. T-12 trailing twelve months with monthly columns ─────────────────
  {
    id: '04-t12-monthly-breakdown',
    format: 'xlsx',
    sheetName: 'T-12',
    docClass: 't12',
    rows: [
      ['Line Item', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Total'],
      ['Effective Gross Income', 200_000, 200_000, 200_000, 200_000, 200_000, 200_000, 200_000, 200_000, 200_000, 200_000, 200_000, 200_000, 2_400_000],
      ['Total Operating Expenses', 100_000, 100_000, 100_000, 100_000, 100_000, 100_000, 100_000, 100_000, 100_000, 100_000, 100_000, 100_000, 1_200_000],
      ['Net Operating Income', 100_000, 100_000, 100_000, 100_000, 100_000, 100_000, 100_000, 100_000, 100_000, 100_000, 100_000, 100_000, 1_200_000],
    ],
    expected: {
      effective_gross_income: 2_400_000,
      total_operating_expenses: 1_200_000,
      net_operating_income: 1_200_000,
      monthly_breakdown_count: 12, // assert at least 12 entries returned
    },
  },

  // ── 5. Rent roll — 8 units, mix of occupied/vacant ──────────────────────
  {
    id: '05-rent-roll-small',
    format: 'xlsx',
    sheetName: 'Rent Roll',
    docClass: 'rent_roll',
    rows: [
      ['Property: Maple Apartments', '', '', '', '', '', '', ''],
      ['Roll Date: 12/31/2025', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['Unit #', 'BD/BA', 'SQFT', 'Tenant', 'Status', 'Lease Start', 'Lease End', 'Market Rent', 'Actual Rent'],
      ['101', '1/1', 650, 'Smith, J', 'Occupied', '2024-06-01', '2026-05-31', 1450, 1450],
      ['102', '1/1', 650, 'Jones, M', 'Occupied', '2024-08-15', '2026-08-14', 1450, 1425],
      ['103', '2/1', 850, '', 'Vacant', '', '', 1750, 0],
      ['104', '2/1', 850, 'Brown, K', 'Occupied', '2025-01-01', '2026-12-31', 1750, 1750],
      ['201', '1/1', 650, 'Davis, L', 'Notice', '2023-09-01', '2025-12-31', 1450, 1400],
      ['202', '1/1', 650, 'Wilson, R', 'Occupied', '2024-11-01', '2026-10-31', 1450, 1450],
      ['203', '2/1', 850, 'Taylor, S', 'Occupied', '2024-03-15', '2026-03-14', 1750, 1700],
      ['204', '2/1', 850, '', 'Vacant', '', '', 1750, 0],
    ],
    expected: {
      property_name: 'Maple Apartments',
      total_units: 8,
      // CRE convention: "Notice" units count as occupied — tenant still paying rent
      // and physically present until move-out at lease-end.
      occupied_units: 6,
      vacant_units: 2,
      total_potential_rent: 1450*4 + 1750*4, // = 12,800 monthly
    },
  },
];

// ── Write fixtures + expected JSON ──────────────────────────────────────────
function writeXLSX(fixturePath, sheetName, rows) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fixturePath);
}

function writeCSV(fixturePath, rows) {
  const csv = rows.map(r => r.map(c => {
    if (c === null || c === undefined) return '';
    const s = String(c);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
  fs.writeFileSync(fixturePath, csv);
}

let written = 0;
for (const f of FIXTURES) {
  const ext = f.format === 'csv' ? 'csv' : 'xlsx';
  const fixturePath = path.join(FIXTURE_DIR, `${f.id}.${ext}`);
  const expectedPath = path.join(EXPECTED_DIR, `${f.id}.json`);

  if (f.format === 'csv') writeCSV(fixturePath, f.rows);
  else writeXLSX(fixturePath, f.sheetName, f.rows);

  fs.writeFileSync(expectedPath, JSON.stringify({
    id: f.id,
    docClass: f.docClass,
    expected: f.expected,
  }, null, 2));
  console.log(`  ✓ ${f.id}.${ext}  (+ expected/${f.id}.json)`);
  written++;
}

console.log(`\nGenerated ${written} fixtures in ${FIXTURE_DIR}`);
