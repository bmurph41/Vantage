import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('1. Adding listing_category enum + column...');
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE listing_category AS ENUM (
          'cre_property',
          'operating_business',
          'mixed_use_with_business',
          'franchise',
          'note_sale'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await client.query(`
      ALTER TABLE marina_listings
        ADD COLUMN IF NOT EXISTS listing_category listing_category NOT NULL DEFAULT 'cre_property',
        ADD COLUMN IF NOT EXISTS asset_class varchar(100),
        ADD COLUMN IF NOT EXISTS cre_metrics jsonb,
        ADD COLUMN IF NOT EXISTS business_metrics jsonb,
        ADD COLUMN IF NOT EXISTS broker_profile_id varchar,
        ADD COLUMN IF NOT EXISTS country varchar(2) DEFAULT 'US',
        ADD COLUMN IF NOT EXISTS currency varchar(3) DEFAULT 'USD',
        ADD COLUMN IF NOT EXISTS price_on_request boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS is_location_confidential boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS description text,
        ADD COLUMN IF NOT EXISTS published_at timestamp,
        ADD COLUMN IF NOT EXISTS last_seen_at timestamp DEFAULT now(),
        ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
        ADD COLUMN IF NOT EXISTS source_listing_id_canonical varchar(255),
        ADD COLUMN IF NOT EXISTS search_vector tsvector;
    `);

    console.log('2. Backfilling existing rows to cre_property + asset_class from marina_type...');
    await client.query(`
      UPDATE marina_listings
      SET asset_class = COALESCE(asset_class, marina_type, property_type, 'marina'),
          published_at = COALESCE(published_at, listing_date, created_at),
          last_seen_at = COALESCE(last_seen_at, last_scraped_at, updated_at),
          description = COALESCE(description, original_description)
      WHERE asset_class IS NULL OR published_at IS NULL;
    `);

    console.log('3. Building search_vector for existing rows...');
    await client.query(`
      UPDATE marina_listings
      SET search_vector =
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(property_name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(city, '') || ' ' || coalesce(state, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(asset_class, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'C')
      WHERE search_vector IS NULL;
    `);

    console.log('4. Creating trigger to maintain search_vector...');
    await client.query(`
      CREATE OR REPLACE FUNCTION marina_listings_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector :=
          setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(NEW.property_name, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(NEW.city, '') || ' ' || coalesce(NEW.state, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(NEW.asset_class, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C');
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql;
    `);
    await client.query(`DROP TRIGGER IF EXISTS marina_listings_search_vector_trg ON marina_listings;`);
    await client.query(`
      CREATE TRIGGER marina_listings_search_vector_trg
      BEFORE INSERT OR UPDATE OF title, property_name, city, state, asset_class, description
      ON marina_listings
      FOR EACH ROW EXECUTE FUNCTION marina_listings_search_vector_update();
    `);

    console.log('5. Adding indexes for new columns...');
    await client.query(`CREATE INDEX IF NOT EXISTS marina_listings_category_idx ON marina_listings(listing_category);`);
    await client.query(`CREATE INDEX IF NOT EXISTS marina_listings_asset_class_idx ON marina_listings(asset_class);`);
    await client.query(`CREATE INDEX IF NOT EXISTS marina_listings_broker_profile_idx ON marina_listings(broker_profile_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS marina_listings_active_idx ON marina_listings(is_active) WHERE is_active = true;`);
    await client.query(`CREATE INDEX IF NOT EXISTS marina_listings_published_idx ON marina_listings(published_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS marina_listings_search_vector_idx ON marina_listings USING gin(search_vector);`);
    await client.query(`CREATE INDEX IF NOT EXISTS marina_listings_cre_metrics_idx ON marina_listings USING gin(cre_metrics);`);
    await client.query(`CREATE INDEX IF NOT EXISTS marina_listings_business_metrics_idx ON marina_listings USING gin(business_metrics);`);

    console.log('6. Creating marketplace_sources table (extends liv2_sources concept)...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS marketplace_sources (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name varchar(255) NOT NULL,
        domain varchar(255) NOT NULL UNIQUE,
        category varchar(20) NOT NULL DEFAULT 'cre',
        scraper_type varchar(50) NOT NULL DEFAULT 'custom',
        enabled boolean NOT NULL DEFAULT true,
        rate_limit_per_min integer DEFAULT 30,
        last_run_at timestamp,
        last_success_at timestamp,
        success_rate numeric(5,2),
        total_listings_ingested integer DEFAULT 0,
        auth_config jsonb,
        respects_robots_txt boolean DEFAULT true,
        attribution_required boolean DEFAULT true,
        terms_of_service_url text,
        notes text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS marketplace_sources_category_idx ON marketplace_sources(category);`);
    await client.query(`CREATE INDEX IF NOT EXISTS marketplace_sources_enabled_idx ON marketplace_sources(enabled) WHERE enabled = true;`);

    console.log('7. Seeding canonical marketplace sources...');
    await client.query(`
      INSERT INTO marketplace_sources (name, domain, category, scraper_type) VALUES
        ('LoopNet', 'loopnet.com', 'cre', 'loopnet'),
        ('Crexi', 'crexi.com', 'cre', 'crexi'),
        ('CommercialCafe', 'commercialcafe.com', 'cre', 'custom'),
        ('Marina Brokers', 'marinabrokers.com', 'cre', 'marinabrokers'),
        ('BizBuySell', 'bizbuysell.com', 'business', 'bizbuysell'),
        ('BizQuest', 'bizquest.com', 'business', 'bizquest'),
        ('Flippa', 'flippa.com', 'business', 'flippa'),
        ('BusinessesForSale', 'businessesforsale.com', 'business', 'custom'),
        ('FranchiseGator', 'franchisegator.com', 'franchise', 'custom')
      ON CONFLICT (domain) DO NOTHING;
    `);

    console.log('8. Creating marketplace_scrape_runs table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS marketplace_scrape_runs (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        source_id varchar NOT NULL REFERENCES marketplace_sources(id) ON DELETE CASCADE,
        started_at timestamp NOT NULL DEFAULT now(),
        finished_at timestamp,
        status varchar(20) NOT NULL DEFAULT 'running',
        listings_found integer DEFAULT 0,
        listings_new integer DEFAULT 0,
        listings_updated integer DEFAULT 0,
        listings_failed integer DEFAULT 0,
        error_message text,
        run_metadata jsonb
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS marketplace_scrape_runs_source_idx ON marketplace_scrape_runs(source_id, started_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS marketplace_scrape_runs_status_idx ON marketplace_scrape_runs(status);`);

    console.log('9. Adding marketplace_plus entitlements columns to billing_feature_flags...');
    const flagsExists = await client.query(`SELECT to_regclass('billing_feature_flags') AS t;`);
    if (flagsExists.rows[0].t) {
      await client.query(`
        ALTER TABLE billing_feature_flags
          ADD COLUMN IF NOT EXISTS marketplace_plus_tier varchar(20) DEFAULT 'free',
          ADD COLUMN IF NOT EXISTS broker_follow_limit integer DEFAULT 2,
          ADD COLUMN IF NOT EXISTS broker_advisory_limit integer DEFAULT 0,
          ADD COLUMN IF NOT EXISTS marketplace_plus_features jsonb DEFAULT '{}'::jsonb;
      `);
    } else {
      console.log('  (billing_feature_flags table does not exist yet — will be added in Step 5)');
    }

    await client.query('COMMIT');
    console.log('\n✅ Step 1 schema migration complete.');

    const verify = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'marina_listings'
        AND column_name IN ('listing_category','asset_class','cre_metrics','business_metrics','broker_profile_id','search_vector','is_active','published_at')
      ORDER BY column_name;
    `);
    console.log('\nNew columns on marina_listings:');
    console.table(verify.rows);

    const sources = await client.query(`SELECT name, domain, category, scraper_type FROM marketplace_sources ORDER BY category, name;`);
    console.log('\nSeeded marketplace_sources:');
    console.table(sources.rows);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}
run();
