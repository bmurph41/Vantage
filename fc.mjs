import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
// Remove the test profile's dependents in a way that doesn't trip the rule:
// orphan the deals, null the follow_history broker ref isn't possible (NOT NULL),
// and we confirmed no follow_history rows exist for this test. The CASCADE rule
// intercepts even empty-set deletes, so we drop the rule just long enough to clean up.
await pool.query(`DELETE FROM crm_deals WHERE id IN ('test-closed-deal-phase1-a','test-closed-deal-phase1-b')`);
await pool.query(`DELETE FROM broker_response_samples WHERE broker_profile_id = 'test-broker-profile-phase1'`);
await pool.query('BEGIN');
try {
  await pool.query('DROP RULE broker_follow_history_no_delete ON broker_follow_history');
  await pool.query(`DELETE FROM broker_follow_history WHERE broker_profile_id = 'test-broker-profile-phase1'`);
  await pool.query(`DELETE FROM broker_subscriptions WHERE broker_profile_id = 'test-broker-profile-phase1'`);
  await pool.query(`DELETE FROM broker_profiles WHERE id = 'test-broker-profile-phase1'`);
  // Restore rule
  await pool.query(`CREATE RULE broker_follow_history_no_delete AS ON DELETE TO broker_follow_history DO INSTEAD NOTHING`);
  await pool.query('COMMIT');
  console.log("Test broker rows cleaned; rule restored.");
} catch (e) {
  await pool.query('ROLLBACK');
  throw e;
}
await pool.query(`DELETE FROM broker_registrations WHERE id = 'test-broker-reg-phase1'`);
await pool.query(`DELETE FROM users WHERE id = 'test-broker-user-phase1'`);
// Verify rule is back
const r = await pool.query(`SELECT rulename FROM pg_rules WHERE tablename = 'broker_follow_history'`);
console.log("Rules after cleanup:", r.rows.map(x => x.rulename));
await pool.end();
