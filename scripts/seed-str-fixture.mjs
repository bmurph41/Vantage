#!/usr/bin/env node
/**
 * STR test fixture — permanent reusable seed for STR-week verification.
 *
 * Creates a synthetic STR project (__str_fixture_beta_test) with:
 *   - asset_class='str', model_input_mode='direct_input'
 *   - canonical STR_COA-name customMetrics.inputAssumptions (the names
 *     the compute engine actually reads), so non-zero output is produced
 *     even pre-Day-9
 *   - empty modeling_actuals (forces direct_input compute path)
 *   - base-case scenario_version + canonical scenario_assumption_payload
 *
 * Fixed UUID (cross-session reference): b1a0eebc-1be7-4ad0-9f8a-5f8e9c0d2a01
 *
 * Idempotent: re-running this script DELETEs the prior fixture rows
 * (CASCADE handles scenario_versions + scenario_assumption_payloads via
 * the FK chain) and re-INSERTs cleanly.
 *
 * Scoped to the test org (cd3719c3-ef82-4ccc-acb9-261c80fb64b4) by default.
 *
 * Usage:
 *   node scripts/seed-str-fixture.mjs
 *   node scripts/seed-str-fixture.mjs --org=<uuid>
 *
 * See project_str_coverage_audit_2026_05_19.md for the full coverage
 * audit + L1/L2/L3 layer framing this fixture is designed to exercise.
 */

import pg from 'pg';

const TEST_ORG_ID = 'cd3719c3-ef82-4ccc-acb9-261c80fb64b4';
const FIXTURE_ID = 'b1a0eebc-1be7-4ad0-9f8a-5f8e9c0d2a01';
const FIXTURE_NAME = '__str_fixture_beta_test';
// Reused from project 6b3a9021's created_by — known-valid user in the test org.
const CREATED_BY = '85c9cd7a-c453-4dba-9817-d032d5712c4e';

const args = process.argv.slice(2).reduce((acc, a) => {
  const m = a.match(/^--([^=]+)=(.*)$/);
  if (m) acc[m[1]] = m[2];
  return acc;
}, {});
const orgId = args.org || TEST_ORG_ID;

// Canonical STR_COA-name customMetrics. These names match the inputKeys
// declared in server/services/direct-input-engine.ts STR_COA (Day 8 audit
// L3 layer). Day 9 will extend STR_COA inputKeys to also accept UI variants
// (L1/L2 names) — at which point this fixture's same values would also be
// reachable from UI-facing key names.
const inputAssumptions = {
  // Revenue core (STR_COA.grossRentalIncome formula reads these)
  avgNightlyRate: 195,
  occupancy: 65,            // STR_COA reads `occupancy ?? occupancyRate`
  numberOfUnits: 1,

  // Cleaning fee income (annualized: $95/turnover × 8 turnovers/mo × 12)
  annualCleaningFeeIncome: 95 * 8 * 12,

  // Other / experience revenue
  annualOtherIncome: 2400,

  // Platform fees (% of revenue)
  platformFeePct: 3,

  // Cleaning expense (annualized: $75/turn × 8 × 12)
  annualCleaning: 75 * 8 * 12,

  // Property management (defaults to 0% per STR_COA defaultPct)
  propertyManagementPct: 0,

  // Annual fixed expenses (STR_COA reads these directly)
  annualPropertyTax: 5400,
  annualInsurance: 2800,
  annualHOA: 0,
  annualUtilities: 245 * 12,
  annualMaintenance: 3600,
  annualSupplies: 12 * 8 * 12,     // consumables: $12/turn × 8 × 12
  annualLandscaping: 175 * 12,     // lawn+pool monthly × 12
  annualInternet: 85 * 12,         // wifi monthly × 12
  annualPestControl: 45 * 12,
  annualAccounting: 0,
  annualCapEx: 0,

  // Properties carried as metadata (engine doesn't read these but they're
  // part of a realistic STR project shape for UI testing)
  totalBedrooms: 3,
  totalBathrooms: 2,
  totalSqFt: 1400,
  propertyType: 'single_family',
  maxGuestCapacity: 8,
};

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  await client.query('BEGIN');

  // ── Wipe prior fixture rows ────────────────────────────────────────────
  // Order matters even with CASCADE — explicit deletes make the script
  // legible and the row counts visible.
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
       $1, $2, $3, 'str', 425000.00,
       'active', 'direct_input', 'all_off',
       'grm', $4::jsonb, $5
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
       3.00, 2.50, NULL,
       '{}'::jsonb, 'draft', $3
     )
     RETURNING id`,
    [orgId, FIXTURE_ID, CREATED_BY],
  );
  const scenarioVersionId = svRes.rows[0].id;
  console.log(`[fixture] modeling_scenario_versions: ${scenarioVersionId}`);

  // ── 3. scenario_assumption_payloads ────────────────────────────────────
  // Mirrors the canonical-store pattern from Day 2-4. The payload is the
  // structured assumptions blob the Pro Forma engine reads via
  // readCanonicalPayload(scenarioVersionId).
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
      managementFeePct: 0,
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
  console.log(`\n✓ STR fixture seeded`);
  console.log(`  project_id = ${FIXTURE_ID}`);
  console.log(`  org_id     = ${orgId}`);
  console.log(`\nSmoke: curl http://localhost:5000/api/modeling/projects/${FIXTURE_ID}/pro-forma`);
} catch (err) {
  await client.query('ROLLBACK');
  console.error('Seed failed, rolled back:', err);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
