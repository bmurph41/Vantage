import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Remove the columns I mistakenly added to billing_feature_flags in Step 1.
    // That table uses a row-per-feature pattern, not wide columns.
    console.log('1. Dropping misplaced columns from billing_feature_flags...');
    await client.query(`
      ALTER TABLE billing_feature_flags
        DROP COLUMN IF EXISTS marketplace_plus_tier,
        DROP COLUMN IF EXISTS broker_follow_limit,
        DROP COLUMN IF EXISTS broker_advisory_limit,
        DROP COLUMN IF EXISTS marketplace_plus_features;
    `);

    // Create a dedicated org_marketplace_entitlements table — one row per org,
    // caches the effective Marketplace+ tier and caps resolved from subscriptions.
    console.log('2. Creating org_marketplace_entitlements...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS org_marketplace_entitlements (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        org_id varchar NOT NULL UNIQUE,
        marketplace_plus_tier varchar(20) NOT NULL DEFAULT 'free',
            -- free | solo | pro | institutional
        broker_follow_limit integer NOT NULL DEFAULT 2,
            -- -1 = unlimited
        broker_advisory_limit integer NOT NULL DEFAULT 0,
            -- -1 = unlimited (subject to broker's own package max_subscribers)
        saved_search_limit integer NOT NULL DEFAULT 3,
        listing_export_limit_monthly integer NOT NULL DEFAULT 0,
        early_access_hours integer NOT NULL DEFAULT 0,
            -- hours of early-access to new listings before free tier sees them
        allow_broker_messaging boolean NOT NULL DEFAULT false,
        allow_off_market_alerts boolean NOT NULL DEFAULT false,
        source varchar(30) NOT NULL DEFAULT 'default',
            -- default | subscription | admin_override | trial
        stripe_subscription_id varchar(255),
        effective_at timestamp NOT NULL DEFAULT now(),
        expires_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS org_marketplace_entitlements_tier_idx ON org_marketplace_entitlements(marketplace_plus_tier);`);

    // Also create a per-user broker entitlement table, since the follow cap
    // is user-level (not org-level) — multiple users in one org might each
    // follow up to their tier cap independently.
    console.log('3. Creating user_broker_entitlements...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_broker_entitlements (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id varchar NOT NULL UNIQUE,
        org_id varchar NOT NULL,
        tier varchar(20) NOT NULL DEFAULT 'free',
        broker_follow_limit integer NOT NULL DEFAULT 2,
        broker_advisory_limit integer NOT NULL DEFAULT 0,
        source varchar(30) NOT NULL DEFAULT 'default',
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS user_broker_entitlements_org_idx ON user_broker_entitlements(org_id);`);

    await client.query('COMMIT');
    console.log('\n✅ Entitlements schema corrected.');

    const cols = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'org_marketplace_entitlements' ORDER BY ordinal_position;
    `);
    console.table(cols.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}
run();
