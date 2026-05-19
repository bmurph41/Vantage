#!/usr/bin/env node
/**
 * Multifamily test fixture — permanent reusable seed for MF-week verification.
 *
 * Creates a synthetic 100-unit Class B garden-style multifamily project
 * (__mf_fixture_beta_test) with:
 *   - asset_class='multifamily', model_input_mode='direct_input'
 *   - canonical MULTIFAMILY_COA-name customMetrics.inputAssumptions (the
 *     names the compute engine reads), so non-zero NOI is produced
 *     (~$1.4M/yr target on $22.5M acquisition, 6.25% exit cap)
 *   - empty modeling_actuals (forces direct_input compute path; mirrors STR)
 *   - base-case scenario_version + canonical scenario_assumption_payload
 *
 * Plus: after seeding, runs an inline department-routing spot-check feeding
 * 25 representative MF line items through inferDepartment(name, cat,
 * 'multifamily') and logs whether all 7 MF departments (Rental, Other
 * Income, Mgmt Fee, Payroll, Utilities, R&M, Operating) are hit.
 *
 * Fixed UUID (cross-session reference): c3a1eebc-2cf8-4bd0-8a9b-6e9f0d3e1b02
 *
 * Idempotent: re-running this script DELETEs the prior fixture rows
 * (CASCADE handles scenario_versions + scenario_assumption_payloads via
 * the FK chain) and re-INSERTs cleanly.
 *
 * Scoped to the test org (cd3719c3-ef82-4ccc-acb9-261c80fb64b4) by default.
 *
 * Usage:
 *   node scripts/seed-mf-fixture.mjs
 *   node scripts/seed-mf-fixture.mjs --org=<uuid>
 *
 * Pairs with seed-str-fixture.mjs as the canonical MVP-class fixtures.
 * Marina coverage is via Keystone Point (d8a0df1e-...) for now.
 */

import pg from 'pg';
import { inferDepartment } from '../server/utils/department-mapping.ts';

const TEST_ORG_ID = 'cd3719c3-ef82-4ccc-acb9-261c80fb64b4';
const FIXTURE_ID = 'c3a1eebc-2cf8-4bd0-8a9b-6e9f0d3e1b02';
const FIXTURE_NAME = '__mf_fixture_beta_test';
// Reused from project 6b3a9021's created_by — known-valid user in the test org.
const CREATED_BY = '85c9cd7a-c453-4dba-9817-d032d5712c4e';

const args = process.argv.slice(2).reduce((acc, a) => {
  const m = a.match(/^--([^=]+)=(.*)$/);
  if (m) acc[m[1]] = m[2];
  return acc;
}, {});
const orgId = args.org || TEST_ORG_ID;

// Canonical MULTIFAMILY_COA-name customMetrics. These names match the
// inputKeys declared in server/services/direct-input-engine.ts MULTIFAMILY_COA.
// Property: 100-unit Class B garden-style, weighted avg rent $2,075/mo.
const inputAssumptions = {
  // Revenue formula inputs (MULTIFAMILY_COA reads these via num()/pct() helpers)
  // NOTE: pct() helper is `n > 1 ? n / 100 : n`, so a value of exactly 1 is
  // ambiguous (treated as 100%). Bad debt 1% would hit that edge case, so we
  // omit badDebtPct and rely on the engine's default of 0.01 (1%) instead.
  totalUnits: 100,
  avgInPlaceRent: 2075,        // 100 units × $2,075/mo × 12 = $2,490,000 GPR
  vacancyPct: 6,
  concessionPct: 5,

  // Revenue direct (other income, ~$120K total)
  annualUtilityReimbursements: 48000,  // ~$40/unit/mo RUBS
  annualParkingIncome: 24000,
  annualLaundryIncome: 18000,
  annualPetFees: 18000,
  annualOtherIncome: 12000,            // misc (storage, application fees)

  // Mgmt Fee (pct_of_egi)
  propertyManagementPct: 4,            // ~$92K (4% of EGI ~$2.31M)

  // Direct expenses (target ~$900K operating)
  annualPayroll: 180000,
  annualPropertyTax: 240000,
  annualInsurance: 80000,
  annualUtilities: 5000,               // monthly_x12 → $60K/yr
  annualMaintenance: 120000,
  annualAdmin: 25000,
  annualMarketing: 50000,
  annualContractServices: 35000,
  annualTrash: 18000,
  annualPestControl: 12000,
  annualCapEx: 50000,                  // capital reserves

  // Unit mix metadata (engine doesn't read this; stored for UI consumption)
  unitMix: [
    { type: '1br_1ba', count: 30, avgSF: 700,  monthlyRent: 1750 },
    { type: '2br_2ba', count: 50, avgSF: 1000, monthlyRent: 2100 },
    { type: '3br_2ba', count: 20, avgSF: 1300, monthlyRent: 2500 },
  ],
};

// 25 representative MF P&L line items, designed to exercise all 7 MF
// departments (Rental, Other Income, Mgmt Fee, Payroll, Utilities, R&M,
// Operating). Used for the post-seed routing spot-check below.
const SAMPLE_LINE_ITEMS = [
  // Rental (6)
  { name: 'Gross Potential Rent',  cat: 'revenue', expected: 'Rental' },
  { name: 'Vacancy Loss',          cat: 'revenue', expected: 'Rental' },
  { name: 'Concessions',           cat: 'revenue', expected: 'Rental' },
  { name: 'Bad Debt',              cat: 'revenue', expected: 'Rental' },
  { name: 'Loss to Lease',         cat: 'revenue', expected: 'Rental' },
  { name: 'Apartment Rent Income', cat: 'revenue', expected: 'Rental' },
  // Other Income (5)
  { name: 'Pet Rent',                       cat: 'revenue', expected: 'Other Income' },
  { name: 'Storage Rent',                   cat: 'revenue', expected: 'Other Income' },
  { name: 'Parking Income',                 cat: 'revenue', expected: 'Other Income' },
  { name: 'Laundry Revenue',                cat: 'revenue', expected: 'Other Income' },
  { name: 'Utility Reimbursement (RUBS)',   cat: 'revenue', expected: 'Other Income' },
  // Mgmt Fee (1)
  { name: 'Property Management Fee', cat: 'expense', expected: 'Mgmt Fee' },
  // Payroll (4)
  { name: 'On-site Manager Wages',     cat: 'expense', expected: 'Payroll' },
  { name: 'Maintenance Tech Wages',    cat: 'expense', expected: 'Payroll' },
  { name: 'Workers Comp Insurance',    cat: 'expense', expected: 'Payroll' },
  { name: 'Health Insurance Benefits', cat: 'expense', expected: 'Payroll' },
  // Utilities (4)
  { name: 'Electric (Common Areas)', cat: 'expense', expected: 'Utilities' },
  { name: 'Water and Sewer',         cat: 'expense', expected: 'Utilities' },
  { name: 'Trash Removal',           cat: 'expense', expected: 'Utilities' },
  { name: 'Natural Gas',             cat: 'expense', expected: 'Utilities' },
  // R&M (3)
  { name: 'Repairs and Maintenance', cat: 'expense', expected: 'R&M' },
  { name: 'Make-Ready Costs',        cat: 'expense', expected: 'R&M' },
  { name: 'HVAC Service Contract',   cat: 'expense', expected: 'R&M' },
  // Operating (2)
  { name: 'Property Tax',             cat: 'expense', expected: 'Operating' },
  { name: 'Professional Services',    cat: 'expense', expected: 'Operating' },
];

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  await client.query('BEGIN');

  // ── Wipe prior fixture rows ────────────────────────────────────────────
  const dPay = await client.query(
    `DELETE FROM scenario_assumption_payloads WHERE project_id = $1`,
    [FIXTURE_ID],
  );
  const dVer = await client.query(
    `DELETE FROM modeling_scenario_versions WHERE modeling_project_id = $1`,
    [FIXTURE_ID],
  );
  const dAct = await client.query(
    `DELETE FROM modeling_actuals WHERE modeling_project_id = $1`,
    [FIXTURE_ID],
  );
  const dPrj = await client.query(
    `DELETE FROM modeling_projects WHERE id = $1`,
    [FIXTURE_ID],
  );
  console.log(
    `[fixture] wiped prior rows: payloads=${dPay.rowCount} versions=${dVer.rowCount} ` +
    `actuals=${dAct.rowCount} projects=${dPrj.rowCount}`,
  );

  // ── 1. modeling_projects ───────────────────────────────────────────────
  await client.query(
    `INSERT INTO modeling_projects (
       id, org_id, marina_name, asset_class, purchase_price,
       deal_outcome, model_input_mode, adjustments_master_state,
       primary_valuation_metric, custom_metrics, created_by
     ) VALUES (
       $1, $2, $3, 'multifamily', 22500000.00,
       'active', 'direct_input', 'all_off',
       'cap_rate', $4::jsonb, $5
     )`,
    [
      FIXTURE_ID,
      orgId,
      FIXTURE_NAME,
      JSON.stringify({ inputAssumptions }),
      CREATED_BY,
    ],
  );
  console.log(`[fixture] modeling_projects: ${FIXTURE_ID}`);

  // ── 2. modeling_scenario_versions ──────────────────────────────────────
  const svRes = await client.query(
    `INSERT INTO modeling_scenario_versions (
       id, org_id, modeling_project_id, scenario_type, name,
       version, is_current_version,
       revenue_growth_rate, expense_growth_rate, exit_cap_rate,
       assumptions, status, created_by
     ) VALUES (
       gen_random_uuid(), $1, $2, 'base', 'Base Case',
       1, true,
       3.00, 2.50, 6.25,
       '{}'::jsonb, 'draft', $3
     )
     RETURNING id`,
    [orgId, FIXTURE_ID, CREATED_BY],
  );
  const scenarioVersionId = svRes.rows[0].id;
  console.log(`[fixture] modeling_scenario_versions: ${scenarioVersionId}`);

  // ── 3. scenario_assumption_payloads ────────────────────────────────────
  const payload = {
    revenueGrowthRate: 3,
    expenseGrowthRate: 2.5,
    exitAssumptions: {
      sellingFeePct: 2,
      loanExitFeePct: 0,
      workingCapitalRecoveryPct: 100,
    },
    belowTheLine: {
      basis: 'revenue',
      managementFeePct: 0,    // already captured via MULTIFAMILY_COA propertyManagementPct
      capexPct: 5,
      reservesPct: 0,
    },
  };
  await client.query(
    `INSERT INTO scenario_assumption_payloads (
       id, org_id, project_id, scenario_id, scenario_version_id,
       payload, payload_schema_version
     ) VALUES (
       gen_random_uuid()::text, $1, $2, 'base', $3,
       $4::jsonb, 1
     )`,
    [orgId, FIXTURE_ID, scenarioVersionId, JSON.stringify(payload)],
  );
  console.log(`[fixture] scenario_assumption_payloads: 1 row`);

  await client.query('COMMIT');
  console.log(`\n✓ MF fixture seeded`);
  console.log(`  project_id = ${FIXTURE_ID}`);
  console.log(`  org_id     = ${orgId}`);
  console.log(`  expected NOI ≈ $1.4M/yr (EGI ~$2.31M − opex ~$905K)`);
  console.log(`\nSmoke: curl http://localhost:5000/api/modeling/projects/${FIXTURE_ID}/pro-forma`);
} catch (err) {
  await client.query('ROLLBACK');
  console.error('Seed failed, rolled back:', err);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}

// ── Department-routing spot-check ─────────────────────────────────────────
// Feed the 25 sample line items through inferDepartment(name, cat,
// 'multifamily') and report which of the 7 MF departments were hit.
console.log(`\n=== Department-routing spot-check (multifamily) ===`);
const hits = new Map();
const misses = [];
for (const item of SAMPLE_LINE_ITEMS) {
  const actual = inferDepartment(item.name, item.cat, 'multifamily');
  const ok = actual === item.expected;
  if (!ok) misses.push({ ...item, actual });
  hits.set(actual, (hits.get(actual) ?? 0) + 1);
  console.log(`  ${ok ? '✓' : '✗'} ${item.name.padEnd(36)} → ${actual}${ok ? '' : `  (expected ${item.expected})`}`);
}

const EXPECTED_DEPTS = ['Rental', 'Other Income', 'Mgmt Fee', 'Payroll', 'Utilities', 'R&M', 'Operating'];
console.log(`\nDepartment coverage:`);
for (const d of EXPECTED_DEPTS) {
  const count = hits.get(d) ?? 0;
  console.log(`  ${count > 0 ? '✓' : '✗'} ${d.padEnd(14)} ${count} hit${count === 1 ? '' : 's'}`);
}

const missingDepts = EXPECTED_DEPTS.filter((d) => !hits.has(d));
if (missingDepts.length > 0 || misses.length > 0) {
  console.log(`\n⚠ Routing issues:`);
  if (missingDepts.length > 0) console.log(`  missing departments: ${missingDepts.join(', ')}`);
  if (misses.length > 0) console.log(`  mis-routed items: ${misses.length}`);
  process.exit(1);
}
console.log(`\n✓ All 7 MF departments hit; all 25 items routed as expected.`);
