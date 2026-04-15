/**
 * Broker Feedback — schema migration
 *
 * Adds:
 *   1. broker_profiles.criteria JSONB — structured evaluator criteria
 *      (asset classes, cap rate floor, DSCR/LTV/IRR targets, hold period,
 *      deal size range, risk tolerance, outlook narrative)
 *   2. broker_profiles.auto_learn_enabled BOOLEAN — reserved for v2
 *      auto-training
 *   3. broker_evaluations table — cached verdicts for (broker, target) pairs
 *
 * Run:
 *   node scripts/step4_broker_feedback_schema.mjs
 */
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      ALTER TABLE broker_profiles
        ADD COLUMN IF NOT EXISTS criteria JSONB,
        ADD COLUMN IF NOT EXISTS auto_learn_enabled BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS criteria_updated_at TIMESTAMP
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS broker_profiles_criteria_idx
        ON broker_profiles USING gin (criteria)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS broker_evaluations (
        id                   VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        broker_profile_id    VARCHAR NOT NULL REFERENCES broker_profiles(id) ON DELETE CASCADE,
        org_id               VARCHAR NOT NULL,
        target_type          VARCHAR(32) NOT NULL,
        target_id            VARCHAR NOT NULL,
        verdict              VARCHAR(16) NOT NULL,
        score                INTEGER NOT NULL,
        matched_criteria     JSONB NOT NULL DEFAULT '[]'::jsonb,
        failed_criteria      JSONB NOT NULL DEFAULT '[]'::jsonb,
        narrative            TEXT,
        narrative_model      VARCHAR(64),
        criteria_snapshot    JSONB NOT NULL,
        target_snapshot      JSONB NOT NULL,
        created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
        expires_at           TIMESTAMP NOT NULL,
        CONSTRAINT broker_evaluations_verdict_chk
          CHECK (verdict IN ('pursue','watch','pass')),
        CONSTRAINT broker_evaluations_target_type_chk
          CHECK (target_type IN ('marina_listing','modeling_project')),
        CONSTRAINT broker_evaluations_score_chk
          CHECK (score >= 0 AND score <= 100),
        CONSTRAINT broker_evaluations_unique
          UNIQUE (broker_profile_id, target_type, target_id)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS broker_evaluations_target_idx
        ON broker_evaluations (target_type, target_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS broker_evaluations_broker_idx
        ON broker_evaluations (broker_profile_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS broker_evaluations_expires_idx
        ON broker_evaluations (expires_at)
    `);

    await client.query("COMMIT");
    console.log("[step4] broker feedback schema applied");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("[step4] migration failed:", err);
  process.exit(1);
});
