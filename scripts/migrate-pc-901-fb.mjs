// Phase 2B Session 1 (2026-05-28) — add PC-901 Food & Beverage to
// coa_profit_centers as a marina-pack profit center distinct from PC-900
// Hospitality (operator-run kitchen/bar vs lodging/rooms).
//
// Idempotent: ON CONFLICT (pack_id, code) DO NOTHING so re-runs are safe.
// Raw SQL per CLAUDE.md heredoc pattern (coa_profit_centers has potential RLS;
// Drizzle has been unreliable on related tables).

import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Confirm the marina pack exists before inserting.
const { rows: packs } = await pool.query(
  `SELECT id FROM coa_taxonomy_packs WHERE asset_class = 'MARINA' AND is_active = true LIMIT 1`
);
if (packs.length === 0) {
  console.error('[migrate-pc-901-fb] No active MARINA pack found in coa_taxonomy_packs. Aborting.');
  await pool.end();
  process.exit(1);
}
const packId = packs[0].id;
console.log(`[migrate-pc-901-fb] Found marina pack: ${packId}`);

// Check existing PC-901 row to make this idempotent without relying on a
// composite unique constraint that may or may not be present.
const { rows: existing } = await pool.query(
  `SELECT id FROM coa_profit_centers WHERE pack_id = $1 AND code = 'PC-901' LIMIT 1`,
  [packId]
);
if (existing.length > 0) {
  console.log(`[migrate-pc-901-fb] PC-901 already exists (id=${existing[0].id}). Skipping insert.`);
  await pool.end();
  process.exit(0);
}

// sort_order=92 places PC-901 between PC-900 Hospitality (sort=90) and
// PC-950 Amenities (sort=95). DB uses a compressed sort_order scheme — see
// shared/profit-center-id-map.ts for the canonical mapping.
const result = await pool.query(
  `INSERT INTO coa_profit_centers (pack_id, code, name, description, sort_order)
   VALUES ($1, 'PC-901', 'Food & Beverage',
           'Operator-run kitchen/bar/restaurant on the marina property. Distinct from PC-900 Hospitality (lodging/rooms).',
           92)
   RETURNING id, code, name`,
  [packId]
);
console.log(`[migrate-pc-901-fb] Inserted ${result.rows[0].code} ${result.rows[0].name} (id=${result.rows[0].id})`);

// Verify full marina PC list after insertion
const { rows: full } = await pool.query(
  `SELECT code, name, sort_order FROM coa_profit_centers WHERE pack_id = $1 ORDER BY sort_order`,
  [packId]
);
console.log(`\n[migrate-pc-901-fb] Marina pack now has ${full.length} profit centers:`);
for (const pc of full) console.log(`  ${pc.code.padEnd(10)} ${pc.name}`);

await pool.end();
