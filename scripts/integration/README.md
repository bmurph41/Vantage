# Integration Test Scripts

Hybrid shell + node smoke tests produced during the 2026-04-17 stabilization
sprint. They exercise the full HTTP → DB flow for the platform's three
highest-risk surfaces: general route reachability, Stripe webhook tier flips,
and broker onboarding end-to-end.

## Prerequisites

The dev server must be running with these env vars:

```bash
ALLOW_DEMO_AUTH=true \
STRIPE_SECRET_KEY=sk_test_anything \
PII_ENCRYPTION_KEY="$(node -e 'console.log(require(\"crypto\").randomBytes(32).toString(\"hex\"))')" \
NODE_ENV=development \
npm run dev
```

`ALLOW_DEMO_AUTH=true` bypasses auth so curl can hit authenticated endpoints
as the test admin user. `STRIPE_SECRET_KEY=sk_test_anything` is required to
activate the webhook handler's dev-bypass mode (when `STRIPE_WEBHOOK_SECRET`
is unset, it parses unsigned payloads). `PII_ENCRYPTION_KEY` must be set for
anything touching investor PII.

All three scripts hardcode `BASE=http://127.0.0.1:5000`. The test org
(`cd3719c3-...`) and test user (`85c9cd7a-...`) IDs match `CLAUDE.md`.

## Scripts

| Script                    | What it does                                                                 | Expected result         |
|---------------------------|------------------------------------------------------------------------------|-------------------------|
| `smoke.sh`                | Hits ~80 representative GET endpoints across every major API surface         | 73 2xx / 7 4xx / 0 5xx  |
| `stripe-webhook.sh`       | Posts synthetic Stripe webhook events; verifies DB entitlement flips         | 6/6 tier flips pass     |
| `broker-onboarding.sh`    | Walks register → admin approve → criteria → publish → follow → feedback      | 7/7 stages pass         |

7 4xx on `smoke.sh` are expected — missing-required-param validation errors
and "no broker profile found" for an org that doesn't have a broker profile.

## Running

```bash
scripts/integration/smoke.sh
scripts/integration/stripe-webhook.sh
scripts/integration/broker-onboarding.sh
```

Each script leaves behind its own cleanup logic. `broker-onboarding.sh` drops
and restores `broker_follow_history_broker_profile_id_fkey` to work around
the append-only PG rule on that table (documented in the broker marketplace
Phase 1 journal entry).

## When to run

- After any change to `server/routes.ts`, `server/index.ts`, or a route
  module — `smoke.sh`.
- After any change to `server/index.ts` webhook handler or
  `server/services/billing-service.ts` — `stripe-webhook.sh`.
- After any change to `broker_*` routes/services, or `broker_profiles`
  schema — `broker-onboarding.sh`.
- Before a prod deploy — all three.
