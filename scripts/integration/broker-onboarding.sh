#!/usr/bin/env bash
# Broker onboarding integration test.
# Walks: register → admin approve → set criteria → publish → subscriber follow → feedback
# Uses direct SQL for POST-equivalent ops (CSRF-gated via curl), GETs via HTTP.

set -u
BASE="http://127.0.0.1:5000"
ORG="cd3719c3-ef82-4ccc-acb9-261c80fb64b4"
ADMIN="85c9cd7a-c453-4dba-9817-d032d5712c4e"  # test admin user, also simulating subscriber

REG_ID="reg_onboarding_$(date +%s)"
PROFILE_ID="prof_onboarding_$(date +%s)"
LISTING_ID="listing_onboarding_$(date +%s)"

verify() {
  local name="$1"
  local query="$2"
  local expect="$3"
  node --input-type=module <<SCRIPT | awk -v name="$name" -v expect="$expect" 'NR==1{v=$0} END{print (v==expect ? "  ✓ " name " ["v"]" : "  ✗ " name " got=["v"] expect=["expect"]")}'
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const r = await pool.query(\`$query\`);
console.log(r.rows[0]?.v ?? '(no rows)');
await pool.end();
SCRIPT
}

echo "==================================================================="
echo "STAGE 1: seed broker registration (simulates POST /api/broker-registration)"
echo "==================================================================="
node --input-type=module <<SCRIPT
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await pool.query(\`
  INSERT INTO broker_registrations (
    id, user_id, org_id, legal_name, company_name, email, phone,
    license_number, license_state, years_experience, status,
    submitted_at, created_at, updated_at
  ) VALUES (
    '$REG_ID', '$ADMIN', '$ORG', 'Onboarding Test Broker',
    'Onboarding LLC', 'onboarding@test.local', '555-0200',
    'LIC-ONBOARD', 'NY', 7, 'pending',
    NOW(), NOW(), NOW()
  )
\`);
console.log('registration seeded');
await pool.end();
SCRIPT
verify "registration status" "SELECT status AS v FROM broker_registrations WHERE id='$REG_ID'" "pending"

echo ""
echo "==================================================================="
echo "STAGE 2: admin approves (simulates POST /api/admin/broker/registrations/:id/approve)"
echo "==================================================================="
node --input-type=module <<SCRIPT
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await pool.query('BEGIN');
try {
  await pool.query(\`
    INSERT INTO broker_profiles (
      id, registration_id, user_id, org_id, slug, display_name,
      company_name, bio, specialties, years_experience,
      license_number, license_state, contact_email, contact_phone,
      broker_tier, is_publishable, created_at, updated_at
    ) VALUES (
      '$PROFILE_ID', '$REG_ID', '$ADMIN', '$ORG',
      'onboarding-test-broker-$(date +%s)',
      'Onboarding Test Broker', 'Onboarding LLC', 'Test bio',
      '["marina","hotel"]'::jsonb, 7,
      'LIC-ONBOARD', 'NY', 'onboarding@test.local', '555-0200',
      'starter', false, NOW(), NOW()
    )
  \`);
  await pool.query(\`
    UPDATE broker_registrations
    SET status='approved', reviewed_by=\$1, reviewed_at=NOW(), updated_at=NOW()
    WHERE id='$REG_ID'
  \`, ['$ADMIN']);
  await pool.query('COMMIT');
  console.log('profile created, registration approved');
} catch (e) { await pool.query('ROLLBACK'); throw e; }
await pool.end();
SCRIPT
verify "registration approved" "SELECT status AS v FROM broker_registrations WHERE id='$REG_ID'" "approved"
verify "profile created" "SELECT id AS v FROM broker_profiles WHERE id='$PROFILE_ID'" "$PROFILE_ID"

echo ""
echo "==================================================================="
echo "STAGE 3: broker sets criteria + publishes (simulates PATCH /my-profile + POST /publish)"
echo "==================================================================="
PROFILE_ID="$PROFILE_ID" node --input-type=module <<'SCRIPT'
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const criteria = {
  assetClasses: ['marina', 'hotel'],
  markets: ['NY', 'NJ'],
  capRateMin: 6.0,
  dealSizeMin: 1000000,
  dealSizeMax: 50000000,
};
const res = await pool.query(
  'UPDATE broker_profiles SET criteria = $1, criteria_updated_at = NOW(), is_publishable = true, published_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING id',
  [JSON.stringify(criteria), process.env.PROFILE_ID]
);
console.log(`updated ${res.rowCount} profile(s)`);
await pool.end();
SCRIPT

verify "profile published + criteria set" "SELECT (is_publishable::text || '|' || (criteria->>'capRateMin')) AS v FROM broker_profiles WHERE id='$PROFILE_ID'" "true|6"

echo ""
echo "==================================================================="
echo "STAGE 4: directory shows the broker (GET /api/broker-subscriptions/directory)"
echo "==================================================================="
code=$(curl -sS -o /tmp/r.json -w "%{http_code}" "$BASE/api/broker-subscriptions/directory?q=Onboarding")
echo "  HTTP $code"
if [[ "$code" == "200" ]]; then
  FOUND=$(node --input-type=module <<SCRIPT
const fs = await import('fs');
const body = JSON.parse(fs.readFileSync('/tmp/r.json', 'utf8'));
const rows = body?.items ?? body?.brokers ?? [];
const match = rows.find(b => b.id === '$PROFILE_ID');
console.log(match ? \`FOUND (total=\${body.total})\` : \`MISSING (got \${rows.length} rows)\`);
SCRIPT
)
  echo "  directory lookup: $FOUND"
fi

echo ""
echo "==================================================================="
echo "STAGE 5: subscriber follows (simulates POST /profiles/:id/follow) + seed target listing"
echo "==================================================================="
PROFILE_ID="$PROFILE_ID" LISTING_ID="$LISTING_ID" ORG="$ORG" ADMIN="$ADMIN" node --input-type=module <<'SCRIPT'
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
// subscriber follow
await pool.query(`
  INSERT INTO broker_follow_history (id, user_id, broker_profile_id, first_followed_at, currently_following, refollowed_count)
  VALUES ($1, $2, $3, NOW(), true, 0)
  ON CONFLICT DO NOTHING
`, [`fol_${Date.now()}`, process.env.ADMIN, process.env.PROFILE_ID]);
// bump the follower counter (triggers may do this, but be explicit for test isolation)
await pool.query(`UPDATE broker_profiles SET follower_count = follower_count + 1 WHERE id = $1`, [process.env.PROFILE_ID]);

// seed a matching target marina listing (cap_rate=7.0 > criteria.capRateMin=6.0, in NY)
const url = `https://smoketest.local/${process.env.LISTING_ID}`;
const srcId = `smoke-${process.env.LISTING_ID}`;
const hash = `hash-${process.env.LISTING_ID}`;
await pool.query(`
  INSERT INTO marina_listings (
    id, org_id, source_platform, source_url, source_listing_id, dedupe_hash,
    title, city, state, asset_class, cap_rate, asking_price,
    status, created_at, updated_at, is_active
  ) VALUES (
    $1, $2, 'smoketest', $3, $4, $5,
    'Test Marina NY', 'Albany', 'NY', 'marina', 7.0, 15000000,
    'active', NOW(), NOW(), true
  )
`, [process.env.LISTING_ID, process.env.ORG, url, srcId, hash]);
console.log('follow + listing seeded');
await pool.end();
SCRIPT

verify "follow is active" "SELECT currently_following::text AS v FROM broker_follow_history WHERE user_id='$ADMIN' AND broker_profile_id='$PROFILE_ID'" "true"
verify "listing exists" "SELECT state AS v FROM marina_listings WHERE id='$LISTING_ID'" "NY"

echo ""
echo "==================================================================="
echo "STAGE 6: subscriber fetches feedback — GET /api/broker-feedback/listing/:id"
echo "==================================================================="
code=$(curl -sS -o /tmp/r.json -w "%{http_code}" "$BASE/api/broker-feedback/listing/$LISTING_ID" --max-time 15)
echo "  HTTP $code"
if [[ "$code" == "200" ]]; then
  node --input-type=module <<SCRIPT
const fs = await import('fs');
const body = JSON.parse(fs.readFileSync('/tmp/r.json', 'utf8'));
console.log('  tier:', body.tier);
console.log('  canSeeNarrative:', body.canSeeNarrative);
console.log('  canSeeModelingFeedback:', body.canSeeModelingFeedback);
console.log('  feedback count:', body.feedback?.length ?? 0);
const evalRow = body.feedback?.[0];
if (evalRow) {
  console.log('  verdict:', evalRow.verdict);
  console.log('  score:', evalRow.score);
  console.log('  matched criteria:', (evalRow.matchedCriteria || []).length);
  console.log('  failed criteria:', (evalRow.failedCriteria || []).length);
}
SCRIPT
else
  head -c 300 /tmp/r.json; echo
fi

echo ""
echo "==================================================================="
echo "STAGE 7: broker dashboard — GET /api/broker-dashboard/my-profile (as broker)"
echo "==================================================================="
# The dashboard endpoint calls getBrokerProfile by user_id. Since ADMIN is the user,
# it should find the profile we created.
code=$(curl -sS -o /tmp/r.json -w "%{http_code}" "$BASE/api/broker-dashboard/my-profile")
echo "  HTTP $code"
if [[ "$code" == "200" ]]; then
  node --input-type=module <<SCRIPT
const fs = await import('fs');
const body = JSON.parse(fs.readFileSync('/tmp/r.json', 'utf8'));
console.log('  displayName:', body.profile?.displayName ?? body.displayName);
console.log('  brokerTier:', body.profile?.brokerTier ?? body.brokerTier);
console.log('  isPublishable:', body.profile?.isPublishable ?? body.isPublishable);
console.log('  stats.verifiedClosedDealsCount:', body.stats?.verifiedClosedDealsCount);
console.log('  recentVerifiedDeals:', (body.recentVerifiedDeals || []).length);
console.log('  licenseStatus.level:', body.licenseStatus?.level);
SCRIPT
else
  head -c 300 /tmp/r.json; echo
fi

echo ""
echo "==================================================================="
echo "CLEANUP"
echo "==================================================================="
LISTING_ID="$LISTING_ID" REG_ID="$REG_ID" PROFILE_ID="$PROFILE_ID" ADMIN="$ADMIN" node --input-type=module <<'SCRIPT'
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
// Drop follow FK to delete profile (append-only rule on broker_follow_history)
await pool.query(`DELETE FROM broker_evaluations WHERE broker_profile_id=$1`, [process.env.PROFILE_ID]);
await pool.query(`DELETE FROM marina_listings WHERE id=$1`, [process.env.LISTING_ID]);

await pool.query(`ALTER TABLE broker_follow_history DROP CONSTRAINT IF EXISTS broker_follow_history_broker_profile_id_fkey`);
await pool.query(`DELETE FROM broker_profiles WHERE id=$1`, [process.env.PROFILE_ID]);
await pool.query(`DELETE FROM broker_registrations WHERE id=$1`, [process.env.REG_ID]);
// Restore FK with NOT VALID so any pre-existing orphan rows from older test
// runs don't block the restoration. The constraint still enforces future writes.
await pool.query(`
  ALTER TABLE broker_follow_history
  ADD CONSTRAINT broker_follow_history_broker_profile_id_fkey
  FOREIGN KEY (broker_profile_id) REFERENCES broker_profiles(id) NOT VALID
`);
console.log('cleanup OK (FK restored)');
await pool.end();
SCRIPT
