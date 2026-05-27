// =============================================================================
// scripts/seed-pnl-keyword-bank.mjs
//
// B3 step 2 — seed pnl_keyword_rules with high-confidence short-circuits.
//
// Rules are GLOBAL (org_id=null) so every org benefits. The mapping pipeline
// resolves canonical_coa_code → org-specific canonical_line_item_id at match
// time, so a single global row applies to every seeded canonical.
//
// Two classes of rules:
//   1. AUTO-MAP HIGH-CONF: payroll-tax aliases (FUTA/SUI/FICA/Workers Comp/
//      Medicare) → annualPayrollTaxesExpense; income-tax aliases (NYS Corp/
//      PTET/State Income Tax) → annualIncomeTax (non_operating, NOT payroll).
//   2. FUEL/COGS aliases that the trace flagged as auto-map miscarriages
//      ("COGS - Fuel" must go to expense.fuel_cogs, never revenue.fuel).
//
// Idempotent — re-running upserts on (org_id IS NULL, keyword, department, bucket).
// =============================================================================

import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// (keyword, department, bucket, canonical_coa_code, match_type, priority)
const SEEDS = [
  // ── Payroll-tax aliases → annualPayrollTaxesExpense ──
  ['futa',                       'Payroll', 'Expense', 'annualPayrollTaxesExpense', 'exact',  10],
  ['sui',                        'Payroll', 'Expense', 'annualPayrollTaxesExpense', 'exact',  10],
  ['fica',                       'Payroll', 'Expense', 'annualPayrollTaxesExpense', 'exact',  10],
  ['workers comp',               'Payroll', 'Expense', 'annualPayrollTaxesExpense', 'phrase', 10],
  ['workers compensation',       'Payroll', 'Expense', 'annualPayrollTaxesExpense', 'phrase', 10],
  ['workmens comp',              'Payroll', 'Expense', 'annualPayrollTaxesExpense', 'phrase', 10],
  ['workmens compensation',      'Payroll', 'Expense', 'annualPayrollTaxesExpense', 'phrase', 10],
  ['social security tax',        'Payroll', 'Expense', 'annualPayrollTaxesExpense', 'phrase', 10],
  ['medicare tax',               'Payroll', 'Expense', 'annualPayrollTaxesExpense', 'phrase', 10],
  ['payroll taxes',              'Payroll', 'Expense', 'annualPayrollTaxesExpense', 'phrase', 15],
  ['payroll tax',                'Payroll', 'Expense', 'annualPayrollTaxesExpense', 'phrase', 15],

  // ── Income-tax aliases → annualIncomeTax (non_operating, NOT payroll) ──
  ['income tax',                 'General', 'Expense', 'annualIncomeTax',           'phrase', 10],
  ['income taxes',               'General', 'Expense', 'annualIncomeTax',           'phrase', 10],
  ['corporate income tax',       'General', 'Expense', 'annualIncomeTax',           'phrase', 10],
  ['corp income tax',            'General', 'Expense', 'annualIncomeTax',           'phrase', 10],
  ['state income tax',           'General', 'Expense', 'annualIncomeTax',           'phrase', 10],
  ['federal income tax',         'General', 'Expense', 'annualIncomeTax',           'phrase', 10],
  ['nys corp tax',               'General', 'Expense', 'annualIncomeTax',           'phrase', 10],
  ['ptet',                       'General', 'Expense', 'annualIncomeTax',           'exact',  10],
  ['pass through entity tax',    'General', 'Expense', 'annualIncomeTax',           'phrase', 10],
  ['pass-through entity tax',    'General', 'Expense', 'annualIncomeTax',           'phrase', 10],

  // ── Depreciation / interest aliases (above-NOI corruption shield) ──
  ['depreciation',               'General', 'Expense', 'annualDepreciation',        'phrase', 10],
  ['depreciation expense',       'General', 'Expense', 'annualDepreciation',        'phrase', 10],
  ['amortization',               'General', 'Expense', 'annualDepreciation',        'phrase', 10],
  ['interest expense',           'General', 'Expense', 'annualInterestExpense',     'phrase', 10],
  ['mortgage interest',          'General', 'Expense', 'annualInterestExpense',     'phrase', 10],

  // ── Fuel COGS aliases ("COGS - Fuel" must NOT auto-map to fuel revenue) ──
  ['cogs fuel',                  'Fuel',    'COGS',    'annualFuelCOGS',            'phrase', 10],
  ['cogs - fuel',                'Fuel',    'COGS',    'annualFuelCOGS',            'phrase', 10],
  ['cost of fuel',               'Fuel',    'COGS',    'annualFuelCOGS',            'phrase', 10],
  ['fuel purchases',             'Fuel',    'COGS',    'annualFuelCOGS',            'phrase', 10],
];

async function ensureColumns() {
  // The live table already has canonical_coa_code (per shared/schema.ts), but be
  // defensive — verify before insert.
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'pnl_keyword_rules' AND column_name = 'canonical_coa_code'`
  );
  if (rows.length === 0) {
    throw new Error('pnl_keyword_rules.canonical_coa_code missing — schema drift');
  }
}

async function seed() {
  await ensureColumns();

  let inserted = 0;
  let updated = 0;

  for (const [keyword, department, bucket, coaCode, matchType, priority] of SEEDS) {
    // Look for existing global rule on the same (keyword, department, bucket).
    const existing = await pool.query(
      `SELECT id FROM pnl_keyword_rules
       WHERE org_id IS NULL AND keyword = $1 AND department = $2 AND bucket = $3
       LIMIT 1`,
      [keyword, department, bucket]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE pnl_keyword_rules
         SET canonical_coa_code = $1, match_type = $2, priority = $3,
             confidence = 0.95, is_active = true, source = 'seed_b3_step2',
             updated_at = now()
         WHERE id = $4`,
        [coaCode, matchType, priority, existing.rows[0].id]
      );
      updated += 1;
    } else {
      await pool.query(
        `INSERT INTO pnl_keyword_rules
           (org_id, keyword, department, bucket, canonical_coa_code, match_type,
            priority, confidence, is_active, source, times_matched)
         VALUES (NULL, $1, $2, $3, $4, $5, $6, 0.95, true, 'seed_b3_step2', 0)`,
        [keyword, department, bucket, coaCode, matchType, priority]
      );
      inserted += 1;
    }
  }

  console.log(`[seed-pnl-keyword-bank] inserted=${inserted} updated=${updated} total=${SEEDS.length}`);
  await pool.end();
}

seed().catch(e => {
  console.error(e);
  process.exit(1);
});
