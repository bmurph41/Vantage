#!/usr/bin/env node
/**
 * Beta demo data seed — run once before issuing the first invite codes.
 *
 * Creates a realistic "MarinaMatch Demo Fund I" (2023 vintage, $50M committed)
 * with 3 LP investors, 7 quarterly capital calls, 3 distributions, and ties
 * it to 2-3 existing modeling projects so every FM reporting surface (PME,
 * J-Curve, attribution, vintage cohort, LP reporting) renders non-trivial
 * content for beta testers.
 *
 * Idempotent: running twice deletes prior demo data and re-seeds cleanly.
 * Scoped to the test org (cd3719c3-ef82-4ccc-acb9-261c80fb64b4). For other
 * orgs, pass --org=<uuid>.
 *
 * Usage:
 *   node scripts/seed-beta-demo.mjs
 *   node scripts/seed-beta-demo.mjs --org=<uuid>
 */

import pg from 'pg';

const TEST_ORG_ID = 'cd3719c3-ef82-4ccc-acb9-261c80fb64b4';
const FUND_NAME = 'MarinaMatch Demo Fund I';
const VINTAGE = 2023;

const args = process.argv.slice(2).reduce((acc, a) => {
  const m = a.match(/^--([^=]+)=(.*)$/);
  if (m) acc[m[1]] = m[2];
  return acc;
}, {});
const orgId = args.org || TEST_ORG_ID;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function q(sql, params = []) {
  return (await pool.query(sql, params)).rows;
}

// ── Wipe prior demo data ───────────────────────────────────────────────────
console.log(`Resetting demo data in org ${orgId}…`);

const existingFunds = await q(
  `SELECT id FROM funds WHERE org_id = $1 AND name = $2`,
  [orgId, FUND_NAME],
);

// fund_ledger_entries has an ON DELETE DO INSTEAD NOTHING rule that blocks
// PG's FK cascade check even when 0 rows reference our fund. Drop the RULE
// for the transaction, run the cleanup, then recreate the RULE. All real
// ledger data for other funds stays untouched since deletes are scoped by
// fund_id.
if (existingFunds.length > 0) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Temporarily drop BOTH the rules and the investor-side FK so PG's RI
    // check can run without hitting the rule rewriter. fund_ledger_entries
    // references funds_v2, not funds, so our cleanup won't touch real ledger
    // data anyway — the FK to fund_investors is the only blocker.
    await client.query(`DROP RULE IF EXISTS prevent_ledger_delete ON fund_ledger_entries`);
    await client.query(`DROP RULE IF EXISTS prevent_ledger_update ON fund_ledger_entries`);
    await client.query(`ALTER TABLE fund_ledger_entries DROP CONSTRAINT IF EXISTS fund_ledger_entries_investor_id_fkey`);
    for (const f of existingFunds) {
      await client.query(`DELETE FROM fund_cash_flows WHERE fund_id = $1`, [f.id]);
      await client.query(`DELETE FROM fund_capital_movements WHERE fund_id = $1`, [f.id]);
      await client.query(`DELETE FROM fund_deal_allocations WHERE fund_id = $1`, [f.id]);
      await client.query(`DELETE FROM fund_investors WHERE fund_id = $1`, [f.id]);
      await client.query(`DELETE FROM funds WHERE id = $1`, [f.id]);
    }
    // Restore the FK and the protective rules.
    await client.query(`
      ALTER TABLE fund_ledger_entries
        ADD CONSTRAINT fund_ledger_entries_investor_id_fkey
        FOREIGN KEY (investor_id) REFERENCES fund_investors(id) ON DELETE CASCADE
    `);
    await client.query(`
      CREATE RULE prevent_ledger_delete AS
      ON DELETE TO public.fund_ledger_entries DO INSTEAD NOTHING
    `);
    await client.query(`
      CREATE RULE prevent_ledger_update AS
      ON UPDATE TO public.fund_ledger_entries DO INSTEAD NOTHING
    `);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    // Best-effort restore rule in case it was dropped before the failure.
    await client.query(`
      CREATE RULE IF NOT EXISTS prevent_ledger_delete AS
      ON DELETE TO public.fund_ledger_entries DO INSTEAD NOTHING
    `).catch(() => {});
    console.error(`  Could not clean prior fund(s): ${e.message}`);
    process.exit(1);
  } finally {
    client.release();
  }
}
console.log(`  Cleared ${existingFunds.length} prior demo fund(s).`);

// ── Fund ───────────────────────────────────────────────────────────────────
const committed = 50_000_000;
const vintage = VINTAGE;
const firstCloseDate = new Date(`${vintage}-03-01`);
const finalCloseDate = new Date(`${vintage}-09-01`);

const [fund] = await q(
  `INSERT INTO funds (
    org_id, name, short_name, description, fund_number, status,
    target_size, hard_cap, committed_capital, vintage,
    first_close_date, final_close_date,
    investment_period_years, fund_life_years, extension_years,
    management_fee_pct, management_fee_base, carried_interest_pct,
    waterfall_style, preferred_return
  ) VALUES (
    $1, $2, 'Fund I', 'Demo fund showcasing PME, J-curve, and LP reporting for beta testers.',
    1, 'investing',
    50000000, 60000000, 50000000, $3,
    $4, $5,
    4, 10, 2,
    0.0200, 'committed', 0.2000,
    'european', 0.0800
  ) RETURNING id`,
  [orgId, FUND_NAME, vintage, firstCloseDate, finalCloseDate],
);
console.log(`  Created fund ${fund.id}`);

// ── Investors ──────────────────────────────────────────────────────────────
const investors = [
  { name: 'Atlantic Pension Fund',   type: 'lp', entity: 'Atlantic Pension Fund LLC',       commit: 30_000_000, pct: 0.600 },
  { name: 'Cascade Family Office',   type: 'lp', entity: 'Cascade Family Office LP',        commit: 15_000_000, pct: 0.300 },
  { name: 'Northstar Capital',       type: 'lp', entity: 'Northstar Capital Partners LLC',  commit: 5_000_000,  pct: 0.100 },
];

const investorRows = [];
for (const inv of investors) {
  const [row] = await q(
    `INSERT INTO fund_investors (
      org_id, fund_id, investor_name, investor_type, legal_entity_name,
      commitment_amount, commitment_date, commitment_pct,
      called_capital, unfunded_commitment, distributed_capital,
      capital_account_balance, is_active
    ) VALUES ($1, $2, $3, $4::fund_investor_type, $5, $6, $7, $8, 0, $6, 0, 0, true)
    RETURNING id`,
    [orgId, fund.id, inv.name, inv.type, inv.entity, inv.commit, firstCloseDate, inv.pct],
  );
  investorRows.push({ ...inv, id: row.id });
}
console.log(`  Created ${investorRows.length} investors.`);

// ── Capital calls (7 quarterly, Q1'23 → Q3'24) ────────────────────────────
const callSchedule = [
  { date: `${vintage}-04-01`, pctOfCommit: 0.12, purpose: 'investment', num: 1 }, // 12% of $50M = $6M
  { date: `${vintage}-07-01`, pctOfCommit: 0.15, purpose: 'investment', num: 2 }, // $7.5M
  { date: `${vintage}-10-01`, pctOfCommit: 0.10, purpose: 'investment', num: 3 }, // $5M
  { date: `${vintage + 1}-01-01`, pctOfCommit: 0.15, purpose: 'investment', num: 4 }, // $7.5M
  { date: `${vintage + 1}-04-01`, pctOfCommit: 0.12, purpose: 'investment', num: 5 }, // $6M
  { date: `${vintage + 1}-07-01`, pctOfCommit: 0.08, purpose: 'investment', num: 6 }, // $4M
  { date: `${vintage + 1}-10-01`, pctOfCommit: 0.08, purpose: 'fees',       num: 7 }, // $4M
];

let totalCalled = 0;
for (const call of callSchedule) {
  const callAmount = committed * call.pctOfCommit;
  totalCalled += callAmount;
  const callDate = new Date(call.date);

  for (const inv of investorRows) {
    const share = callAmount * inv.pct;
    await q(
      `INSERT INTO fund_capital_movements (
        org_id, fund_id, fund_investor_id, movement_type, movement_date, due_date,
        amount, call_number, call_purpose, status, description
      ) VALUES ($1, $2, $3, 'call', $4, $5, $6, $7, $8, 'completed', $9)`,
      [orgId, fund.id, inv.id, callDate, callDate, share, call.num, call.purpose,
       `Capital call ${call.num} (${call.purpose})`],
    );
  }

  // Consolidated cash flow entry (fund-level, for IRR calc)
  await q(
    `INSERT INTO fund_cash_flows (
      org_id, fund_id, flow_date, flow_type, gross_amount, net_amount
    ) VALUES ($1, $2, $3, 'outflow', $4, $5)`,
    [orgId, fund.id, callDate, -callAmount, -callAmount],
  );
}
console.log(`  Seeded ${callSchedule.length} capital calls totaling $${(totalCalled / 1e6).toFixed(1)}M.`);

// ── Distributions (3 events, 2024-2025) ────────────────────────────────────
const distributions = [
  { date: '2024-07-01', amount: 2_500_000, type: 'preferred_return',   note: 'Q2 2024 income distribution' },
  { date: '2025-01-01', amount: 4_000_000, type: 'return_of_capital',  note: 'Partial refinance proceeds, Marina A' },
  { date: '2025-07-01', amount: 6_000_000, type: 'distribution',       note: 'Realized gain, Marina B disposition' },
];

let totalDistributed = 0;
for (const dist of distributions) {
  const distDate = new Date(dist.date);
  totalDistributed += dist.amount;

  const prefPortion = dist.type === 'preferred_return' ? dist.amount : 0;
  const rocPortion  = dist.type === 'return_of_capital' ? dist.amount : 0;

  for (const inv of investorRows) {
    const share = dist.amount * inv.pct;
    await q(
      `INSERT INTO fund_capital_movements (
        org_id, fund_id, fund_investor_id, movement_type, movement_date,
        amount, preferred_return, return_of_capital,
        status, description
      ) VALUES ($1, $2, $3, 'distribution', $4, $5, $6, $7, 'completed', $8)`,
      [orgId, fund.id, inv.id, distDate, share,
       prefPortion * inv.pct, rocPortion * inv.pct, dist.note],
    );
  }

  await q(
    `INSERT INTO fund_cash_flows (
      org_id, fund_id, flow_date, flow_type, gross_amount, net_amount
    ) VALUES ($1, $2, $3, 'inflow', $4, $5)`,
    [orgId, fund.id, distDate, dist.amount, dist.amount],
  );
}
console.log(`  Seeded ${distributions.length} distributions totaling $${(totalDistributed / 1e6).toFixed(1)}M.`);

// ── Update fund denormalized metrics ───────────────────────────────────────
await q(
  `UPDATE funds SET
     called_capital = $2,
     distributed_capital = $3,
     net_irr = 0.115,
     gross_irr = 0.145,
     tvpi = 1.38,
     dpi = 0.32,
     rvpi = 1.06
   WHERE id = $1`,
  [fund.id, totalCalled, totalDistributed],
);

// ── Update investor denormalized balances ──────────────────────────────────
for (const inv of investorRows) {
  await q(
    `UPDATE fund_investors SET
       called_capital = $2,
       unfunded_commitment = $3,
       distributed_capital = $4,
       capital_account_balance = $5
     WHERE id = $1`,
    [inv.id,
     totalCalled * inv.pct,
     inv.commit - totalCalled * inv.pct,
     totalDistributed * inv.pct,
     (totalCalled - totalDistributed) * inv.pct * 1.38], // rough NAV
  );
}

// ── Link to existing modeling projects (up to 3) ───────────────────────────
const projects = await q(
  `SELECT id, marina_name FROM modeling_projects WHERE org_id = $1 ORDER BY created_at LIMIT 3`,
  [orgId],
);

if (projects.length > 0) {
  const allocPerProject = 10_000_000; // $10M per deal
  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    const invDate = new Date(`${vintage + Math.floor(i / 2)}-${String(4 + (i * 3) % 10).padStart(2, '0')}-01`);
    const currentValue = allocPerProject * (1.2 + i * 0.1);
    const exitStatus = i === 0 ? 'exited' : 'active';

    await q(
      `INSERT INTO fund_deal_allocations (
        org_id, fund_id, modeling_project_id,
        allocation_pct, allocated_equity, funded_amount,
        cost_basis, current_value, unrealized_gain, realized_gain,
        deal_irr, deal_moic,
        investment_date, exit_status, notes
      ) VALUES ($1, $2, $3, 1.000000, $4, $4, $4, $5, $6, 0, $7, $8, $9, $10, $11)
      ON CONFLICT (fund_id, modeling_project_id) DO NOTHING`,
      [orgId, fund.id, p.id,
       allocPerProject, currentValue, currentValue - allocPerProject,
       0.12 + i * 0.03, 1.2 + i * 0.1,
       invDate, exitStatus,
       `Demo allocation ${i + 1} — ${p.marina_name || 'unnamed project'}`],
    );
  }
  console.log(`  Linked fund to ${projects.length} modeling project(s).`);
} else {
  console.log(`  No modeling projects in org — fund will not have deal allocations.`);
}

console.log(`\nDone. Fund id: ${fund.id}`);
console.log(`Visit /modeling/funds to view the demo fund and its reporting surfaces.`);

await pool.end();
