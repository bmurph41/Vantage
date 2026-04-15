import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ────────────────────────────────────────────────────────────────────
    // 1. broker_registrations — application/approval queue for brokers
    //    who want a public profile on the platform.
    // ────────────────────────────────────────────────────────────────────
    console.log('1. Creating broker_registrations...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS broker_registrations (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id varchar NOT NULL,
        org_id varchar NOT NULL,
        legal_name varchar(255) NOT NULL,
        company_name varchar(255) NOT NULL,
        email varchar(255) NOT NULL,
        phone varchar(50),
        license_number varchar(100),
        license_state varchar(2),
        license_expires_at date,
        license_document_url text,
        years_experience integer,
        specialties jsonb,
        bio text,
        website text,
        linkedin_url text,
        status varchar(20) NOT NULL DEFAULT 'pending',
          -- pending | approved | rejected | suspended
        rejection_reason text,
        reviewed_by varchar,
        reviewed_at timestamp,
        submitted_at timestamp NOT NULL DEFAULT now(),
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS broker_registrations_user_idx ON broker_registrations(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS broker_registrations_status_idx ON broker_registrations(status);`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS broker_registrations_user_unique ON broker_registrations(user_id) WHERE status IN ('pending','approved');`);

    // ────────────────────────────────────────────────────────────────────
    // 2. broker_profiles — the public-facing broker presence.
    //    Created only after a broker_registration is approved AND the
    //    broker has an active platform-side broker subscription.
    // ────────────────────────────────────────────────────────────────────
    console.log('2. Creating broker_profiles...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS broker_profiles (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        registration_id varchar NOT NULL REFERENCES broker_registrations(id) ON DELETE CASCADE,
        user_id varchar NOT NULL,
        org_id varchar NOT NULL,
        slug varchar(100) NOT NULL UNIQUE,
        display_name varchar(255) NOT NULL,
        company_name varchar(255) NOT NULL,
        headshot_url text,
        cover_image_url text,
        bio text,
        specialties jsonb,
            -- { asset_classes: [...], geographies: [...] }
        languages jsonb,
        years_experience integer,
        license_number varchar(100),
        license_state varchar(2),
        contact_email varchar(255),
        contact_phone varchar(50),
        website text,
        linkedin_url text,
        is_publishable boolean NOT NULL DEFAULT false,
        published_at timestamp,
        broker_tier varchar(20) DEFAULT 'starter',
            -- starter | pro | enterprise (matches their billing SKU)
        follower_count integer NOT NULL DEFAULT 0,
        advisory_subscriber_count integer NOT NULL DEFAULT 0,
        total_listings_published integer NOT NULL DEFAULT 0,
        avg_listing_quality numeric(5,2),
        average_response_hours numeric(6,2),
        featured_until timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS broker_profiles_user_idx ON broker_profiles(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS broker_profiles_org_idx ON broker_profiles(org_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS broker_profiles_publishable_idx ON broker_profiles(is_publishable) WHERE is_publishable = true;`);
    await client.query(`CREATE INDEX IF NOT EXISTS broker_profiles_tier_idx ON broker_profiles(broker_tier);`);
    await client.query(`CREATE INDEX IF NOT EXISTS broker_profiles_specialties_idx ON broker_profiles USING gin(specialties);`);

    // FK from marina_listings.broker_profile_id (added in Step 1) → broker_profiles
    console.log('   Adding FK marina_listings.broker_profile_id → broker_profiles...');
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE marina_listings
          ADD CONSTRAINT marina_listings_broker_profile_fk
          FOREIGN KEY (broker_profile_id) REFERENCES broker_profiles(id) ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // ────────────────────────────────────────────────────────────────────
    // 3. broker_advisory_packages — paid SKU defined by the broker.
    //    Payment is collected by broker outside the platform; platform
    //    just stores metadata + manually-toggled access grants.
    // ────────────────────────────────────────────────────────────────────
    console.log('3. Creating broker_advisory_packages...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS broker_advisory_packages (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        broker_profile_id varchar NOT NULL REFERENCES broker_profiles(id) ON DELETE CASCADE,
        name varchar(255) NOT NULL,
        tagline varchar(500),
        description text,
        deliverables jsonb,
            -- [{ icon, title, description, frequency }]
        price_monthly_cents integer,
        price_annual_cents integer,
        currency varchar(3) DEFAULT 'USD',
        cadence varchar(20) DEFAULT 'monthly',
            -- weekly | monthly | quarterly
        external_payment_url text,
            -- broker's own payment link (Stripe Payment Link, Square, etc.)
        max_subscribers integer,
        sample_content_ids jsonb,
        is_active boolean NOT NULL DEFAULT true,
        sort_order integer DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS broker_advisory_packages_profile_idx ON broker_advisory_packages(broker_profile_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS broker_advisory_packages_active_idx ON broker_advisory_packages(is_active) WHERE is_active = true;`);

    // ────────────────────────────────────────────────────────────────────
    // 4. broker_subscriptions — the join table (user ↔ broker_profile).
    //    Two tiers: 'follow' (free) and 'advisory' (paid via broker).
    //    Advisory access is granted manually by the broker from their dashboard.
    // ────────────────────────────────────────────────────────────────────
    console.log('4. Creating broker_subscriptions...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS broker_subscriptions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id varchar NOT NULL,
        org_id varchar NOT NULL,
        broker_profile_id varchar NOT NULL REFERENCES broker_profiles(id) ON DELETE CASCADE,
        tier varchar(20) NOT NULL DEFAULT 'follow',
            -- follow | advisory
        advisory_package_id varchar REFERENCES broker_advisory_packages(id) ON DELETE SET NULL,
        status varchar(20) NOT NULL DEFAULT 'active',
            -- active | canceled | suspended | pending_payment
        notify_new_listings boolean NOT NULL DEFAULT true,
        notify_advisory_content boolean NOT NULL DEFAULT true,
        notify_market_updates boolean NOT NULL DEFAULT true,
        granted_by varchar,
            -- broker user_id who granted advisory access (null for self-follow)
        external_payment_reference varchar(255),
            -- reference broker can use to verify the user paid
        subscribed_at timestamp NOT NULL DEFAULT now(),
        advisory_started_at timestamp,
        canceled_at timestamp,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp DEFAULT now(),
        UNIQUE (user_id, broker_profile_id)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS broker_subscriptions_user_idx ON broker_subscriptions(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS broker_subscriptions_broker_idx ON broker_subscriptions(broker_profile_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS broker_subscriptions_tier_status_idx ON broker_subscriptions(tier, status);`);

    // ────────────────────────────────────────────────────────────────────
    // 5. broker_follow_history — append-only, ungameable cap counter.
    //    Records first time a user followed a broker; never deleted.
    // ────────────────────────────────────────────────────────────────────
    console.log('5. Creating broker_follow_history...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS broker_follow_history (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id varchar NOT NULL,
        broker_profile_id varchar NOT NULL REFERENCES broker_profiles(id) ON DELETE CASCADE,
        first_followed_at timestamp NOT NULL DEFAULT now(),
        currently_following boolean NOT NULL DEFAULT true,
        unfollowed_at timestamp,
        refollowed_count integer NOT NULL DEFAULT 0,
        UNIQUE (user_id, broker_profile_id)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS broker_follow_history_user_idx ON broker_follow_history(user_id);`);

    // Make broker_follow_history append-only (no DELETE, restricted UPDATE)
    await client.query(`
      DO $$ BEGIN
        CREATE RULE broker_follow_history_no_delete AS ON DELETE TO broker_follow_history DO INSTEAD NOTHING;
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    // ────────────────────────────────────────────────────────────────────
    // 6. broker_advisory_content — research notes, recommendations, market updates
    // ────────────────────────────────────────────────────────────────────
    console.log('6. Creating broker_advisory_content...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS broker_advisory_content (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        broker_profile_id varchar NOT NULL REFERENCES broker_profiles(id) ON DELETE CASCADE,
        title varchar(500) NOT NULL,
        slug varchar(255),
        excerpt text,
        body text,
            -- markdown
        content_type varchar(30) NOT NULL DEFAULT 'note',
            -- note | recommendation | market_update | deal_alert | quarterly_review
        attached_listing_ids jsonb,
        attached_attachments jsonb,
        visibility varchar(20) NOT NULL DEFAULT 'advisory_only',
            -- public | public_teaser | advisory_only
        teaser_excerpt text,
        published_at timestamp,
        is_pinned boolean DEFAULT false,
        view_count integer NOT NULL DEFAULT 0,
        like_count integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS broker_advisory_content_profile_idx ON broker_advisory_content(broker_profile_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS broker_advisory_content_published_idx ON broker_advisory_content(published_at DESC) WHERE published_at IS NOT NULL;`);
    await client.query(`CREATE INDEX IF NOT EXISTS broker_advisory_content_visibility_idx ON broker_advisory_content(visibility);`);

    // ────────────────────────────────────────────────────────────────────
    // 7. broker_listing_claims — single-owner attribution for listings.
    //    UNIQUE on listing_id enforces "only one broker can claim a listing".
    // ────────────────────────────────────────────────────────────────────
    console.log('7. Creating broker_listing_claims...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS broker_listing_claims (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        listing_id varchar NOT NULL UNIQUE,
            -- references marina_listings(id) — not FK because of mixed id types in some envs
        broker_profile_id varchar NOT NULL REFERENCES broker_profiles(id) ON DELETE CASCADE,
        claim_method varchar(30) NOT NULL,
            -- auto_email_match | auto_phone_match | manual_claim | admin_assigned
        verified boolean NOT NULL DEFAULT false,
        verification_evidence jsonb,
        claimed_at timestamp NOT NULL DEFAULT now(),
        verified_at timestamp,
        verified_by varchar,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS broker_listing_claims_broker_idx ON broker_listing_claims(broker_profile_id);`);

    // Disputes — for when a second broker tries to claim an already-claimed listing
    await client.query(`
      CREATE TABLE IF NOT EXISTS broker_listing_claim_disputes (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        listing_id varchar NOT NULL,
        existing_claim_id varchar REFERENCES broker_listing_claims(id) ON DELETE CASCADE,
        challenger_broker_profile_id varchar NOT NULL REFERENCES broker_profiles(id) ON DELETE CASCADE,
        reason text NOT NULL,
        evidence jsonb,
        status varchar(20) NOT NULL DEFAULT 'open',
            -- open | resolved_in_favor_of_existing | resolved_in_favor_of_challenger | withdrawn
        resolution_notes text,
        resolved_by varchar,
        resolved_at timestamp,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS broker_claim_disputes_status_idx ON broker_listing_claim_disputes(status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS broker_claim_disputes_listing_idx ON broker_listing_claim_disputes(listing_id);`);

    // ────────────────────────────────────────────────────────────────────
    // 8. broker_advisory_messages — direct messaging thread between
    //    advisory subscriber and broker (Marketplace+ Pro feature for users).
    // ────────────────────────────────────────────────────────────────────
    console.log('8. Creating broker_advisory_messages...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS broker_advisory_messages (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        subscription_id varchar NOT NULL REFERENCES broker_subscriptions(id) ON DELETE CASCADE,
        sender_user_id varchar NOT NULL,
        sender_role varchar(10) NOT NULL,
            -- broker | user
        body text NOT NULL,
        attachments jsonb,
        read_at timestamp,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS broker_advisory_messages_sub_idx ON broker_advisory_messages(subscription_id, created_at);`);

    await client.query('COMMIT');
    console.log('\n✅ Step 2 broker subscription schema complete.');

    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE 'broker_%'
        AND table_name NOT IN ('broker_relationships','broker_activity_log','broker_portal_submissions','brokers')
      ORDER BY table_name;
    `);
    console.log('\nNew broker_* tables:');
    console.table(tables.rows);
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
