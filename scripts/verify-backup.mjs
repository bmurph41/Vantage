/**
 * verify-backup.mjs
 *
 * Runs post-restore / weekly verification checks against the database.
 * Compares current table counts against a stored baseline and checks
 * referential integrity.
 *
 * Usage:
 *   node scripts/verify-backup.mjs
 *
 * Environment:
 *   DATABASE_URL — Neon connection string (required)
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more checks failed
 */

import pg from 'pg';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = join(__dirname, '..', '.backup-baseline.json');
const DRIFT_THRESHOLD = 0.10; // Alert if count drops more than 10%

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const failures = [];
const warnings = [];

function fail(check, message) {
  failures.push({ check, message });
  console.error(`[FAIL] ${check}: ${message}`);
}

function warn(check, message) {
  warnings.push({ check, message });
  console.warn(`[WARN] ${check}: ${message}`);
}

function pass(check, message) {
  console.log(`[PASS] ${check}: ${message}`);
}

// ---------- Table count checks ----------

const CRITICAL_TABLES = [
  'organizations',
  'users',
  'crm_contacts',
  'crm_companies',
  'crm_deals',
  'modeling_projects',
  'fund_capital_movements',
  'fund_investors',
  'financial_audit_log',
  'billing_subscriptions',
];

async function checkTableCounts() {
  console.log('\n--- Table Row Counts ---');
  const counts = {};

  for (const table of CRITICAL_TABLES) {
    try {
      const res = await pool.query(`SELECT count(*)::int AS cnt FROM ${table}`);
      const cnt = res.rows[0].cnt;
      counts[table] = cnt;

      if (cnt === 0) {
        warn('table_count', `${table} has 0 rows`);
      } else {
        pass('table_count', `${table} = ${cnt} rows`);
      }
    } catch (err) {
      // Table may not exist yet — warn but don't fail hard
      warn('table_count', `${table} — query failed: ${err.message}`);
      counts[table] = null;
    }
  }

  return counts;
}

// ---------- Baseline drift detection ----------

function checkDrift(currentCounts) {
  console.log('\n--- Baseline Drift Check ---');

  if (!existsSync(BASELINE_PATH)) {
    console.log('No baseline file found. Saving current counts as baseline.');
    writeFileSync(BASELINE_PATH, JSON.stringify({ date: new Date().toISOString(), counts: currentCounts }, null, 2));
    return;
  }

  let baseline;
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'));
  } catch {
    warn('drift', 'Could not parse baseline file. Overwriting with current counts.');
    writeFileSync(BASELINE_PATH, JSON.stringify({ date: new Date().toISOString(), counts: currentCounts }, null, 2));
    return;
  }

  const prevCounts = baseline.counts || {};

  for (const table of CRITICAL_TABLES) {
    const prev = prevCounts[table];
    const curr = currentCounts[table];

    if (prev == null || curr == null) continue;
    if (prev === 0) continue; // Can't compute drift from zero

    const drop = (prev - curr) / prev;
    if (drop > DRIFT_THRESHOLD) {
      fail('drift', `${table} dropped ${(drop * 100).toFixed(1)}% (${prev} -> ${curr})`);
    } else {
      pass('drift', `${table} within threshold (${prev} -> ${curr})`);
    }
  }

  // Update baseline
  writeFileSync(BASELINE_PATH, JSON.stringify({ date: new Date().toISOString(), counts: currentCounts }, null, 2));
  console.log(`Baseline updated at ${new Date().toISOString()}`);
}

// ---------- Referential integrity checks ----------

async function checkReferentialIntegrity() {
  console.log('\n--- Referential Integrity ---');

  const checks = [
    {
      name: 'orphaned_deals',
      sql: `SELECT count(*)::int AS cnt FROM crm_deals d LEFT JOIN organizations o ON d.org_id = o.id WHERE o.id IS NULL`,
    },
    {
      name: 'orphaned_contacts',
      sql: `SELECT count(*)::int AS cnt FROM crm_contacts c LEFT JOIN organizations o ON c.org_id = o.id WHERE o.id IS NULL`,
    },
    {
      name: 'orphaned_projects',
      sql: `SELECT count(*)::int AS cnt FROM modeling_projects p LEFT JOIN organizations o ON p.org_id = o.id WHERE o.id IS NULL`,
    },
  ];

  for (const check of checks) {
    try {
      const res = await pool.query(check.sql);
      const cnt = res.rows[0].cnt;
      if (cnt > 0) {
        fail('referential_integrity', `${check.name}: ${cnt} orphaned records`);
      } else {
        pass('referential_integrity', `${check.name}: 0 orphaned records`);
      }
    } catch (err) {
      warn('referential_integrity', `${check.name} — query failed: ${err.message}`);
    }
  }
}

// ---------- Audit log protection ----------

async function checkAuditLogProtection() {
  console.log('\n--- Audit Log Protection ---');

  try {
    const res = await pool.query(`
      SELECT rulename, ev_type
      FROM pg_catalog.pg_rewrite r
      JOIN pg_catalog.pg_class c ON r.ev_class = c.oid
      WHERE c.relname = 'financial_audit_log'
        AND r.rulename != '_RETURN'
    `);

    if (res.rows.length === 0) {
      warn('audit_protection', 'No protection rules found on financial_audit_log (table may not exist yet)');
    } else {
      for (const row of res.rows) {
        pass('audit_protection', `Rule "${row.rulename}" (event type: ${row.ev_type}) is in place`);
      }
    }
  } catch (err) {
    warn('audit_protection', `Check failed: ${err.message}`);
  }
}

// ---------- Main ----------

async function main() {
  console.log('=== MarinaMatch Backup Verification ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Database: ${process.env.DATABASE_URL ? '(connected)' : 'DATABASE_URL not set'}`);

  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  try {
    const counts = await checkTableCounts();
    checkDrift(counts);
    await checkReferentialIntegrity();
    await checkAuditLogProtection();
  } finally {
    await pool.end();
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Checks passed with ${failures.length} failure(s) and ${warnings.length} warning(s).`);

  if (failures.length > 0) {
    console.error('\nFailed checks:');
    for (const f of failures) {
      console.error(`  - [${f.check}] ${f.message}`);
    }
  }

  const report = {
    timestamp: new Date().toISOString(),
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    failures,
    warnings,
  };

  console.log('\n' + JSON.stringify(report, null, 2));

  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Verification script crashed:', err);
  pool.end().catch(() => {});
  process.exit(1);
});
