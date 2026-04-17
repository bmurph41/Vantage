#!/usr/bin/env bash
# Stripe webhook tier-flip integration test.
# Posts synthetic events; verifies DB state after each.

set -u
BASE="http://127.0.0.1:5000"
ORG="cd3719c3-ef82-4ccc-acb9-261c80fb64b4"
USER_ID="85c9cd7a-c453-4dba-9817-d032d5712c4e"

post_event() {
  local name="$1"
  local payload="$2"
  local code
  code=$(curl -sS -o /tmp/r.json -w "%{http_code}" -X POST "$BASE/api/stripe/webhook" \
    -H "Content-Type: application/json" --data "$payload" --max-time 20)
  printf "  webhook[%s]: HTTP %s  resp=%s\n" "$name" "$code" "$(head -c 80 /tmp/r.json)"
}

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
echo "TEST 1: platform pack — checkout.session.completed (modeling_tools)"
echo "==================================================================="
SUB_1="sub_test_pack_$(date +%s)"
CUS_1="cus_test_pack_$(date +%s)"

post_event "platform-pack-checkout" "$(cat <<JSON
{"type":"checkout.session.completed","data":{"object":{
  "id":"cs_test_$SUB_1","customer":"$CUS_1","subscription":"$SUB_1",
  "metadata":{"orgId":"$ORG","packType":"modeling_tools","billingCycle":"monthly","userId":"$USER_ID"}
}}}
JSON
)"
verify "organization_packs status=active, sub_id=$SUB_1" \
  "SELECT status || '|' || COALESCE(stripe_subscription_id,'nil') AS v FROM organization_packs WHERE org_id='$ORG' AND pack_type='modeling_tools'" \
  "active|$SUB_1"
verify "billing_subscriptions.tier=modeling_tools, status=active" \
  "SELECT tier || '|' || status AS v FROM billing_subscriptions WHERE org_id='$ORG'" \
  "modeling_tools|active"

echo ""
echo "==================================================================="
echo "TEST 2: invoice.payment_failed → status=expired/past_due"
echo "==================================================================="
post_event "payment-failed" "$(cat <<JSON
{"type":"invoice.payment_failed","data":{"object":{
  "id":"in_test_$SUB_1","customer":"$CUS_1","subscription":"$SUB_1",
  "metadata":{"orgId":"$ORG"}
}}}
JSON
)"
verify "organization_packs status=expired after payment failure" \
  "SELECT status AS v FROM organization_packs WHERE org_id='$ORG' AND pack_type='modeling_tools'" \
  "expired"
verify "billing_subscriptions status=past_due" \
  "SELECT status AS v FROM billing_subscriptions WHERE org_id='$ORG'" \
  "past_due"

echo ""
echo "==================================================================="
echo "TEST 3: invoice.payment_succeeded → reactivation"
echo "==================================================================="
post_event "payment-succeeded" "$(cat <<JSON
{"type":"invoice.payment_succeeded","data":{"object":{
  "id":"in_test2_$SUB_1","customer":"$CUS_1","subscription":"$SUB_1",
  "metadata":{"orgId":"$ORG"}
}}}
JSON
)"
verify "organization_packs reactivated" \
  "SELECT status AS v FROM organization_packs WHERE org_id='$ORG' AND pack_type='modeling_tools'" \
  "active"
verify "billing_subscriptions reactivated" \
  "SELECT status AS v FROM billing_subscriptions WHERE org_id='$ORG'" \
  "active"

echo ""
echo "==================================================================="
echo "TEST 4: customer.subscription.deleted → downgrade to starter"
echo "==================================================================="
post_event "subscription-deleted" "$(cat <<JSON
{"type":"customer.subscription.deleted","data":{"object":{
  "id":"$SUB_1","customer":"$CUS_1",
  "metadata":{"orgId":"$ORG"}
}}}
JSON
)"
verify "organization_packs status=cancelled after subscription deletion" \
  "SELECT status AS v FROM organization_packs WHERE org_id='$ORG' AND pack_type='modeling_tools' AND stripe_subscription_id='$SUB_1'" \
  "cancelled"
verify "billing_subscriptions downgraded to starter, canceled" \
  "SELECT tier || '|' || status AS v FROM billing_subscriptions WHERE org_id='$ORG'" \
  "starter|canceled"

echo ""
echo "==================================================================="
echo "TEST 5: broker_plan checkout → broker_profiles.broker_tier"
echo "==================================================================="
# First we need a broker_profile for the test user
node --input-type=module <<'SCRIPT'
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const ORG='cd3719c3-ef82-4ccc-acb9-261c80fb64b4';
const USER='85c9cd7a-c453-4dba-9817-d032d5712c4e';
// Ensure a registration exists (required FK)
await pool.query(`
  INSERT INTO broker_registrations (id, user_id, org_id, legal_name, company_name, email, phone, license_number, license_state, years_experience, status, submitted_at, created_at, updated_at)
  VALUES ('reg_smoke_test', $1, $2, 'Smoke Test Broker', 'Smoke Test LLC', 'smoke@test.local', '555-0100', 'LIC-000', 'CA', 5, 'approved', NOW(), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING
`, [USER, ORG]);
// Ensure profile exists
await pool.query(`
  INSERT INTO broker_profiles (id, registration_id, user_id, org_id, slug, display_name, company_name, is_publishable, broker_tier, created_at, updated_at)
  VALUES ('prof_smoke_test', 'reg_smoke_test', $1, $2, 'smoke-test-broker', 'Smoke Test Broker', 'Smoke Test LLC', false, 'starter', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING
`, [USER, ORG]);
await pool.end();
SCRIPT

post_event "broker-plan-checkout" "$(cat <<JSON
{"type":"checkout.session.completed","data":{"object":{
  "id":"cs_test_broker","customer":"cus_test_broker","subscription":"sub_test_broker",
  "metadata":{"sku":"broker_plan","tier":"pro","brokerUserId":"$USER_ID"}
}}}
JSON
)"
verify "broker_profiles.broker_tier=pro" \
  "SELECT broker_tier AS v FROM broker_profiles WHERE user_id='$USER_ID' AND id='prof_smoke_test'" \
  "pro"

echo ""
echo "==================================================================="
echo "TEST 6: marketplace_plus checkout → org_marketplace_entitlements"
echo "==================================================================="
post_event "marketplace-plus-checkout" "$(cat <<JSON
{"type":"checkout.session.completed","data":{"object":{
  "id":"cs_test_mplus","customer":"cus_test_mplus","subscription":"sub_test_mplus",
  "metadata":{"sku":"marketplace_plus","tier":"pro","userId":"$USER_ID","orgId":"$ORG"}
}}}
JSON
)"
verify "org_marketplace_entitlements.marketplace_plus_tier=pro" \
  "SELECT marketplace_plus_tier AS v FROM org_marketplace_entitlements WHERE org_id='$ORG'" \
  "pro"

echo ""
echo "==================================================================="
echo "CLEANUP: test rows"
echo "==================================================================="
node --input-type=module <<'SCRIPT'
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const ORG='cd3719c3-ef82-4ccc-acb9-261c80fb64b4';
// Restore test org's packs + billing_sub to known state
await pool.query(`UPDATE organization_packs SET status='active', stripe_subscription_id=NULL WHERE org_id=$1 AND pack_type='modeling_tools'`, [ORG]);
await pool.query(`DELETE FROM billing_subscriptions WHERE org_id=$1`, [ORG]);
await pool.query(`DELETE FROM broker_profiles WHERE id='prof_smoke_test'`);
await pool.query(`DELETE FROM broker_registrations WHERE id='reg_smoke_test'`);
// Leave org_marketplace_entitlements — just downgrade to free
await pool.query(`UPDATE org_marketplace_entitlements SET marketplace_plus_tier='free' WHERE org_id=$1`, [ORG]);
console.log('  cleanup done');
await pool.end();
SCRIPT
