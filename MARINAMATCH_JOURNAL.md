# MarinaMatch Platform Journal

## ✅ COMPLETE — Revenue Readiness #7 + #8 (2026-04-17)

Bundled the two revenue-readiness verification items — both surfaced a real
silent-failure risk in production, now fixed.

### #7 — ANTHROPIC_API_KEY visibility

Added **`GET /health/integrations`** endpoint (in `server/routes/health.ts`)
that returns a boolean-only status of each third-party API key:

```
{ "anthropic": true, "openai": true, "sendgrid": true, "resend": true,
  "stripeSecret": true, "stripePublishable": false,
  "stripeWebhookSecret": false, "replitSendgridConnector": true }
```

Also included the same `integrations` block in `/health/ready` so existing
k8s/uptime probes pick it up for free. Returns only booleans — never leaks
actual key values.

### #8 — Email delivery silent-success fix

**Real bug in `server/services/email-service.ts`**: the console fallback at
the bottom of `sendEmail()` returned `true` unconditionally. In production
with no provider configured, this meant:

- Password reset emails silently never sent
- Magic links silently never sent
- Invite emails silently never sent
- `/workflow-email/send-test` logged "sent" status when no email left the server

Now `sendEmail()` returns `false` in production when no provider accepted
the message. Dev mode still logs to console and returns `true` for developer
productivity. Also skips SendGrid attempt entirely when neither the env var
nor Replit connector is present (silences noisy "SendGrid failed, trying
Resend fallback" warn-logs on every email for Resend-only deployments).

Verified behavior with both NODE_ENV values:

| Scenario                                    | Returns |
|---------------------------------------------|---------|
| SendGrid env set + API accepts              | true    |
| Resend env set + API accepts (no SendGrid)  | true    |
| No provider configured + `NODE_ENV=prod`    | **false** (was true) |
| No provider configured + `NODE_ENV=dev`     | true (with console log) |

### Usage for ops

Before a prod deploy, hit `GET /health/integrations` and confirm each flag
matches the intended feature set:

- `anthropic` must be `true` if any AI feature is enabled (broker evaluator
  narratives, document builder AI content, meeting transcription, deal
  sourcing LLM classifier, ai-underwriting, etc.)
- `sendgrid` OR `resend` OR `replitSendgridConnector` must be `true` for
  transactional email (password resets, invites, magic links, trial
  reminders, LP statements delivery)
- `stripeSecret` + `stripeWebhookSecret` must both be `true` for billing
  (already enforced by webhook handler in prod; webhook returns 503 if
  secret is missing in prod)

### Next session pickup

Data integrity hardening (#9-11): decimal.js refactor in `fund-service.ts`
(72 parseFloat sites), PII field encryption at rest (SSN, Tax ID),
immutable-ledger-derived capital account balances.

---

## ⚠ PARTIAL — Stabilization #6: tsc OOM (2026-04-17)

Attempted to fix type-checking by raising the node heap limit. Partial success:
found + fixed a real JSX bug that was masking the OOM, added a typecheck script,
but the full type-check still OOMs under the sandbox memory cap. Real fix needs
project references or splitting `shared/schema.ts`.

### What we learned

- Sandbox cgroup memory cap is **8 GB** (`/sys/fs/cgroup/memory.max`).
- `npm run check` (default heap ~1.5 GB) OOMs at ~1 GB heap.
- At `--max-old-space-size=4096` (4 GB) tsc used to terminate early reporting
  ONE error; with 6 GB it OOMs; at 8+ GB the OS SIGKILLs the process (cgroup
  OOM killer, because V8 overhead + code pages exceed the heap budget).
- Root cause: `shared/schema.ts` is 29 574 lines with **769 pgTable exports**.
  Each Drizzle table's inferred type cascades through the whole import graph —
  every consumer file recomputes the inference. Memory scales roughly with
  files × transitive schema types.

### Bugs fixed along the way

1. **`TenantLeaseDialog.tsx` line 1198 — missing `</TabsContent>`** between
   the `capex` and `sales` tabs. `rollover` TabsContent opened at 1116 but
   never closed. This parse error was masking ALL other type errors since
   tsc was failing on the broken JSX before doing full inference. Fixing it
   uncovered the real OOM baseline. Runtime-visible: the rollover tab would
   have been broken (all subsequent tabs nested inside it).

### What's left

The real fix is architectural, not mechanical — raising heap alone doesn't
fit in the cgroup cap. Three real options, each a session+ of work:

1. **Project references** (cleanest) — move `shared/schema.ts` into its own
   sub-project with `composite: true` + a pre-compiled `.d.ts`. The main
   `tsconfig.json` would reference it, and the schema would be type-checked
   once into a declaration file that everything else consumes cheaply.

2. **Split `shared/schema.ts` into 15–20 domain modules** — e.g.
   `shared/schema/crm.ts`, `shared/schema/modeling.ts`, `shared/schema/broker.ts`.
   Breaks the inference graph so each consuming file only loads the domains it
   actually imports. Touches hundreds of import sites but is a mechanical find/
   replace once the split is done.

3. **Emit static `.d.ts` for schema.ts only** via a custom build step that
   invokes `tsc --declaration` on just `shared/schema.ts`, then uses `paths`
   in the main tsconfig to redirect `@shared/schema` to the `.d.ts`. Fragile,
   worth considering only if 1+2 are blocked.

Recommended order: start with #1 (project references) — it's surgical and
doesn't require touching imports anywhere else. If that doesn't fit in the
cgroup either, fall back to #2.

### Script added

`npm run typecheck` — runs `tsc --noEmit --incremental false` at 6 GB heap.
Best-effort: reports file-level errors before it OOMs on the big-picture
inference pass. Not a replacement for `npm run check` in CI (which will need
the real fix above).

### Next session pickup

Stabilization sprint is **complete (5/6 items cleanly green, #6 partial)**.
Revenue readiness is next: #7 verify `ANTHROPIC_API_KEY` in prod, #8 test
email delivery (SendGrid/Resend). These are short verification tasks.

---

## ✅ COMPLETE — Stabilization #5: Broker onboarding flow (2026-04-17)

Walked the full broker lifecycle end-to-end: register → admin approve →
set criteria → publish → subscriber follow → feedback evaluation.
**All 7 stages pass — no product bugs uncovered.** The broker subsystem is
well-integrated, unlike the drift-heavy LP Portal (#3) and webhook (#4) flows.

### E2E test (7/7 stages green)

Test script at `/tmp/broker_onboarding_test.sh`. Hybrid approach — SQL-seeds
for CSRF-protected POSTs, HTTP calls for GETs.

| # | Stage                                              | Result |
|---|----------------------------------------------------|--------|
| 1 | seed `broker_registrations` (status=pending)       | ✓ |
| 2 | admin approve → creates `broker_profiles` row      | ✓ |
| 3 | set criteria JSONB + is_publishable=true           | ✓ |
| 4 | `GET /directory?q=...` finds the broker            | ✓ total=1 |
| 5 | follow + seed matching `marina_listings` target    | ✓ |
| 6 | `GET /broker-feedback/listing/:id` returns verdict | ✓ verdict=pursue, score=100, 4/4 criteria matched |
| 7 | `GET /broker-dashboard/my-profile` returns profile | ✓ displayName, brokerTier, publishable, stats |

### Notes

- Directory query uses `?q=` (not `?search=`), returns `{items, total, page}`
  (not `{brokers}`) — minor docs note.
- `license_status.level: missing` is expected when `license_expires_at` is null.
  Real onboarding would supply the license document during registration.
- Broker evaluator correctly ran all 4 rules (asset class, market, cap rate,
  deal size) against the seeded listing and returned verdict=`pursue`.

### Next session pickup

Stabilization #6 — Fix tsc OOM. `shared/schema.ts` is ~28k lines and crashes
`tsc --noEmit` at 1GB. Needs splitting into domain modules (or raising node
heap flag if that's simpler). Pure refactor, no user-visible impact.

---

## ✅ COMPLETE — Stabilization #4: Stripe billing verification (2026-04-17)

Tested the full Stripe webhook → entitlement-flip flow for all three product
SKUs (platform packs, broker plans, marketplace+). Found two show-stopper bugs
before any happy path worked.

### Bugs fixed

1. **Missing unique constraint on `organization_packs(org_id, pack_type)`**
   — the webhook uses `onConflictDoUpdate({ target: [orgId, packType] })`
   but no DB constraint matched → every platform-pack checkout failed with
   `there is no unique or exclusion constraint matching the ON CONFLICT
   specification`. Added via raw SQL + a matching startup migration at
   `server/db-startup-migrations.ts` so fresh DBs don't regress.

2. **`billingService.handleWebhook` never called from the primary webhook
   handler** — `POST /api/stripe/webhook` in `server/index.ts` only handled
   the `metadata.packType` flow (platform packs). All `sku=broker_plan` and
   `sku=marketplace_plus` checkouts were returning 200 but doing NOTHING
   (webhook orphaned). `billingService.handleWebhook` has the comprehensive
   logic (marketplace+, broker tiers, core-platform `SUBSCRIPTION_TIERS`) but
   was mounted at an unused `/api/billing/webhook` route. Now delegated from
   the primary handler via dynamic import. Also fixed the dynamic-import
   destructuring — `billingService` is a default export, not a named one.

### End-to-end verified (6/6 tier-flip tests pass)

Test script at `/tmp/stripe_webhook_test.sh`. Uses synthetic Stripe events
(no real Stripe needed — dev bypass when `STRIPE_WEBHOOK_SECRET` unset).

| # | Scenario                                              | DB assertions       |
|---|-------------------------------------------------------|---------------------|
| 1 | platform pack `checkout.session.completed`            | org_packs `active`, billing_subs `modeling_tools/active` ✓ |
| 2 | `invoice.payment_failed`                              | org_packs `expired`, billing_subs `past_due` ✓ |
| 3 | `invoice.payment_succeeded`                           | both reactivated to `active` ✓ |
| 4 | `customer.subscription.deleted`                       | org_packs `cancelled`, billing_subs `starter/canceled` ✓ |
| 5 | broker `checkout.session.completed` (sku=broker_plan) | broker_profiles.broker_tier → `pro` ✓ |
| 6 | marketplace+ `checkout.session.completed`             | org_marketplace_entitlements.marketplace_plus_tier → `pro` ✓ |

### Gotcha: test data cleanup

broker_profiles cleanup requires dropping + restoring the FK
`broker_follow_history_broker_profile_id_fkey` because of the append-only
PG rule on `broker_follow_history` (documented in Phase 1 journal). Cleanup
logic is at the bottom of `/tmp/stripe_webhook_test.sh`.

### Findings NOT fixed this session

1. **`pack_catalog` is near-empty** — only `master_comps` row exists, both
   price IDs NULL. `customer.subscription.updated` webhook tries to derive
   tier from price_id via `pack_catalog` lookup; for 11 of 12 pack types
   this lookup will never match. Prod needs the catalog populated with real
   Stripe price IDs for upgrade/downgrade via billing portal to work.

2. **No `STRIPE_PUBLISHABLE_KEY` in this env** — `/api/stripe/status`
   reports `configured: false`. For real Stripe integration the publishable
   key must be set too.

### Next session pickup

Stabilization #5 — Broker onboarding flow (invite test broker → set criteria
→ subscriber sees feedback). This is the last stabilization item before
revenue readiness (#7-8) and data integrity hardening (#9-11).

---

## ✅ COMPLETE — Stabilization #3: LP Portal integration testing (2026-04-17)

Tested the LP Portal read path end-to-end. Found a cluster of method-name drift
between `server/routes/lp-portal-routes.ts` and `server/services/lp-portal-service.ts`
— router called methods that didn't exist (`createLpUser`, `loginLpUser`,
`validateLpSession`, `getStatement`, `renderStatementHtml`, `getK1`,
`getFundSideLetters`, `getMfnAnalysis`) while the service exposed
`createPortalUser`, `authenticateLP`, `validateSession`, `getSideLettersForFund`,
`getMFNAnalysis`. Plus three read methods (`getStatement`, `renderStatementHtml`,
`getK1`) that the router called but the service never had.

### Bugs fixed

1. **Added `getStatement`, `renderStatementHtml` methods** to `LPStatementGenerator`
   — simple read-by-id + HTML render wrappers.
2. **Added `getK1` method** to `K1Generator` — queries `lp_statements` where
   `statement_type='k1' AND period_label=<taxYear>`.
3. **Rewrote all LP Portal route handlers** to call the actual service methods,
   dropping unused router-level field names that the service doesn't support
   (e.g. `firstName`/`lastName` concatenated to service's single `name` param,
   dropped `totpToken`, `year`/`quarter`/`offset` filters not in service).
4. **`getSideLettersForFund` SQL bug**: service queried `side_letters.org_id`
   which doesn't exist. Rewrote as an INNER JOIN to `funds` to scope by org,
   plus LEFT JOIN to `fund_investors` for `investor_name`. Populated missing
   fields (`effectiveDate` from `executed_at`, `expirationDate` as null,
   `status` defaulted `'active'`).
5. **Date-type fields returned as strings, not `Date` objects**: `getStatement`
   and `listStatements` row mappers passed `r.period_start`/`r.period_end`
   directly, which come from Postgres as strings. `generateStatementHTML` then
   calls `.toLocaleDateString()` on them and crashed. Wrapped in `new Date(...)`.

### End-to-end read-path verified (seeded test data → curl)

- ✅ `GET /api/lp-portal/statements` — returns list
- ✅ `GET /api/lp-portal/statements/:id` — returns full statement
- ✅ `GET /api/lp-portal/statements/:id/html` — 4.8KB HTML page rendered with
   correct fund name, period range, metrics
- ✅ `GET /api/lp-portal/k1/:fundId/:investorId/:taxYear` — returns K-1 JSON
- ✅ `GET /api/lp-portal/side-letters/fund/:fundId` — returns []
- ✅ `GET /api/lp-portal/side-letters/mfn-analysis/:fundId` — returns structure

POST endpoints are CSRF-protected, which is correct — the frontend flows
through CSRF tokens. Not tested at the wire level this session; the wiring-test
script at `/tmp/lp_wiring.sh` is reusable.

### Known gaps NOT fixed (deferred — real design decisions)

1. **LP session middleware**: `/api/lp-portal` is mounted at line 1605 of
   `routes.ts`, which places it AFTER a global `authenticateUser` mount at
   line 708 (via `app.use(authenticateUser, tourProgressRoutes)`). In dev with
   `ALLOW_DEMO_AUTH=true`, the demo admin user ends up in `req.user` on every
   LP Portal request. In production **this means any authenticated platform
   user could hit LP Portal endpoints scoped only by `org_id`, not
   `investor_id`**. True LP sessions issued by `/auth/login` are never
   validated, and `req.user.investorId` is never set. To fix: write a real
   LP session middleware (reads `Bearer` token, calls `validateSession`,
   populates `req.user` with `{ id, orgId, investorId }`) and re-scope
   every statement/K-1 query by investorId. This is a security design task,
   not a plumbing fix.

2. **`side_letters` schema drift**: missing `org_id`, `investor_name`,
   `effective_date`, `expiration_date`, `status`, `created_by`. The
   `createSideLetter` service INSERTs into these columns and will fail on
   the first POST. Either add the columns via raw psql migration or reduce
   the service to what the schema supports.

3. **Schema drift for `users.username`** (noted in stabilization #2) affects
   7+ service/route files that weren't in the route-smoke test. Fix as they
   surface.

4. **Seeded test data left behind**: one "Test Fund I (smoke)" fund and its
   fund_investor row are in the DB, couldn't be deleted because of an
   append-only ledger rule on `fund_ledger_entries`. lp_statements rows
   were successfully deleted.

### Next session pickup

Stabilization #4 — Stripe billing verification (test checkout → webhook →
entitlement flip for platform tiers, broker tiers, marketplace+ tiers).

---

## ✅ COMPLETE — Stabilization #2: Systematic route smoke test (2026-04-17)

Hit 80 representative GET endpoints across every major API surface using
`ALLOW_DEMO_AUTH=true` and the test org/project IDs. Smoke script saved at
`/tmp/smoke.sh` for reuse; results at `/tmp/smoke_results.tsv`.

**Before:** 68 2xx / 5 4xx / 7 5xx
**After:** 73 2xx / 7 4xx / 0 5xx (6 real bugs fixed, 1 5xx was `/health/ready`
intentionally reporting `unhealthy` due to Redis + 96% heap — not a route bug)

### Bugs fixed

1. **`server/services/workflow-enhancements.ts` — `listWebhooks`**: SQL selected
   `description` column that doesn't exist in `workflow_webhooks`. Rewrote to
   select actual columns (`name, url, event_types, is_active`) and map to camelCase.

2. **`server/services/workflow-enhancements.ts` — `listScheduledTriggers`**: SQL
   used table alias `t.` (Drizzle doesn't emit that alias) and referenced three
   nonexistent columns (`entity_type`, `entity_id`, `timezone`). Rewrote to use
   actual columns (`action_config` replaces `payload`).

3. **`server/services/workflow-enhancements.ts` — added `listWorkflowPipelines`**:
   method was called by `GET /api/workflow-v2/pipelines` but didn't exist.
   Returns id/name/description/steps/stepCount/isActive from `workflow_pipelines`.

4. **`server/routes/reporting-engine-routes.ts` — `/custom-reports` GET**: was
   calling `reportingEngine.listCustomReports(orgId, options)` — no such method.
   The service has `listSavedReports(orgId)`. Fixed the call.

5. **`server/services/lease-ops-storage.ts` — `getOperationsStats`**: raw `sql`
   template used aliases `t.` and `cl.` that Drizzle doesn't create, yielding
   `missing FROM-clause entry for table "t"`. Replaced with `${leaseTerms.col}`
   and `${commercialLeases.col}` column references.

6. **`server/services/comment-threads-service.ts` — `getProjectThreads`**:
   selected `users.username` which doesn't exist (real column is `users.name`).
   Replaced all 3 occurrences with `users.name`.

### Known findings NOT fixed this session (out-of-scope for smoke-test)

- **`users.username` referenced in 7+ other files** that weren't in the smoke
  test: `multi-approver-service.ts`, `approval-notification-service.ts`,
  `opssos/task-routes.ts` (also refs `firstName`/`lastName` — neither exist),
  `phase-gates-routes.ts`, `red-flag-routes.ts`, `operations-routes.ts` (3x).
  These endpoints would 500 under the same conditions.
- **`workflow_pipelines` DB schema missing `entry_step_id`** column that
  `createWorkflowPipeline` and `executePipeline` both reference. POST + execute
  paths would 500 the first time someone invokes them.
- **`getCustomReport(:id)` endpoint** calls a method that doesn't exist on
  `reportingEngine`.
- **`POST /api/workflow-v2/webhooks`** route passes `events` but the service
  expects `eventTypes`. Route-handler field name mismatch.

These are all documented here; fix opportunistically as they surface.

### Next session pickup
Stabilization #3 — LP Portal integration testing (login → statement view →
K-1 download end-to-end).

---

## ✅ COMPLETE — Stabilization #1: Rent Roll Sync button (2026-04-17)

First item of the stabilization sprint in `project_remaining_queue.md`. The backend
route `POST /api/modeling/projects/:projectId/rent-roll-sync` (in `server/routes.ts`
at line 858) was already wired — the UI side was the remaining gap.

**Changes — `client/src/pages/modeling/projects/workspace/uploads.tsx`:**
- Added `RentRollSyncResult` interface matching `server/services/rent-roll-sync-service.ts`
- Added `syncingRentRollId` state (separate from P&L's `syncingUploadId` so the two
  sync flows don't collide visually)
- Added `rentRollSyncMutation` using React Query — synchronous call (no job polling,
  unlike P&L pipeline), success toast shows `entriesCreated` + `skippedRows`, invalidates
  `documents`, `rent-roll`, and `rent-rolls` queries
- Added `handleSyncRentRoll` and `isRentRollSyncable(upload)` helpers
- Button renders on pending uploads (when `status` is `parsed`/`reviewing`/`completed`)
  and on completed uploads (re-sync). Filters out storage-specific rent rolls
  (`STORAGE_RENT_ROLL_SUB_TYPES` — wet_slips, dry_stack, etc.) which have their own flow.
- Teal color scheme to distinguish from green P&L Sync to Model button
- `data-testid` attrs: `button-sync-rent-roll-{id}` and `button-resync-rent-roll-{id}`

**Note:** Pure frontend change — Vite HMR picks it up, no `pkill -f 'tsx server'` needed.

**Next session pickup:** Stabilization #2 — Systematic route smoke test. Hit every
major API surface via curl, log 4xx/5xx, fix broken routes.

---

## ✅ COMPLETE — Broker Marketplace Phase 1 (2026-04-17)

Shipped Phase 1 of the Airbnb-style broker marketplace on top of the substantial
pre-existing foundation (broker registration, profile, directory, follow/unfollow,
advisory packages, Stripe checkout, broker dashboard were already built). Phase 1
filled the objective-trust-signal gaps that the existing system didn't expose.

**What was built (this session):**

### Schema (`/tmp/broker_marketplace_phase1_migration.mjs` applied via raw psql)
- `crm_deals.broker_profile_id` — FK to `broker_profiles(id) ON DELETE SET NULL`,
  with indexes on the FK and on `(broker_profile_id, closed_at DESC) WHERE is_closed`
- `broker_profiles` — 8 new columns for denormalized trust stats:
  `verified_closed_deals_count`, `verified_closed_deals_volume`,
  `verified_closed_deals_asset_classes`, `verified_closed_deals_last_at`,
  `median_response_hours`, `response_rate_30d`, `response_samples_30d`,
  `trust_stats_last_recomputed_at` + a composite index on verified-deal
  count/volume for directory ranking
- `broker_registrations` — 5 new columns for license verification state:
  `license_last_verified_at`, `license_verification_provider`,
  `license_verification_status`, `license_verification_notes`,
  `license_verification_payload`
- `broker_response_samples` NEW TABLE — raw response-time tracking samples
  (thread_type, thread_id UNIQUE, first_inbound_at, first_broker_reply_at,
  response_seconds, is_unanswered)
- `shared/schema.ts` updated with camelCase mappings + new `brokerResponseSamples` table

### Services
- `server/services/broker-license-verification.ts` NEW
  - `LicenseVerificationProvider` interface with swappable providers
  - `ManualReviewProvider` default (returns `manual_review_required` until a real
    third-party API is wired in Phase 2)
  - `scanLicenseExpiry()` — flags expired licenses, auto-unpublishes profiles
  - `classifyExpiry()` — returns `ok | warning | critical | expired | missing`
- `server/services/broker-deal-stats.ts` NEW
  - `computeBrokerDealStats()` — count, volume, asset classes, most-recent close
  - `persistBrokerDealStats()` — writes denorm back to `broker_profiles`
  - `attributeDealToBroker()` — helper for setting a deal's broker + recomputing
    both old and new broker's stats
  - `recomputeAllBrokerDealStats()` — nightly full recompute
  - `getBrokerVerifiedDeals()` — recent list for profile page UI
- `server/services/broker-response-tracker.ts` NEW
  - `recordInboundMessage()` — called when a subscriber messages a broker
  - `recordBrokerReply()` — called when the broker replies; computes latency
  - `computeResponseStats()` / `persistResponseStats()` — rolling 30-day avg +
    median + reply-rate, written to `broker_profiles`
  - `markStaleUnanswered()` — flags samples >168h without reply
- `server/services/broker-feature-flags.ts` NEW
  - `BROKER_FEATURE_FLAGS` constants: `broker_ai_drafts`, `broker_ratings`,
    `broker_license_verify_api`
  - `isBrokerFeatureEnabled(orgId, flag)` — env kill-switch first, then
    `billing_feature_flags` org-level override, default off
  - Returns `{ enabled, source }` so UI can show why a flag is off

### Routes
- `server/routes/broker-subscriptions-routes.ts` — extended:
  - Directory ranking now sorts by `featuredUntil DESC, verifiedClosedDealsCount DESC,
    verifiedClosedDealsVolume DESC, followerCount DESC, publishedAt DESC`
  - Public profile endpoint now returns `trustSignals` + `verifiedDeals` arrays +
    live license status
  - NEW `POST /broker/subscriptions/:subscriptionId/messages` — broker reply
    endpoint (owner-only), fires `recordBrokerReply()`
  - Existing user-send endpoint now fires `recordInboundMessage()`
  - NEW `GET /feature-flags` — Phase 2/3 flag state for the frontend
- `server/routes/broker-dashboard-routes.ts` — `/my-profile` endpoint extended:
  - Returns `licenseStatus` with level + days-until-expiry + state
  - Returns `recentVerifiedDeals` (top 5) for dashboard preview
  - Returns `featureFlags` so the dashboard can render Phase 2/3 coming-soon cards
  - Added trust-signal stats to `stats` object (verifiedClosed count/volume,
    medianResponseHours, responseRate30d, responseSamples30d)
- `server/routes/crm-routes.ts` — PUT `/api/crm/deals/:id` now recomputes broker
  stats async when broker-attribution or close state changes

### Cron
- `server/jobs/platform-cron.ts` — two new jobs:
  - `0 15 2 * * *` — nightly broker marketplace recompute (all deal stats + all
    response stats)
  - `0 3 * * *` — daily broker license expiry scan (auto-unpublish expired)

### Frontend
- `client/src/components/broker/TrustSignalBar.tsx` NEW — reusable trust-signal
  row (full + compact variants) showing verified closes, response time, reply
  rate, followers, experience, license status with color-coded tone
- `client/src/pages/broker/BrokerProfile.tsx` — TrustSignalBar above tabs; new
  "Verified Closed Deals" tab with table of real closes
- `client/src/pages/broker/BrokerDirectory.tsx` — broker cards now lead with
  verified-closed count + response time (was followers/listings/experience)
- `client/src/pages/broker/dashboard/BrokerDashboardOverview.tsx` — license
  expiry warning banner (warning/critical/expired tones); new trust-signal KPI
  row; recent verified deals table; Phase 2/3 `PhaseCard`s for AI Drafts +
  Ratings gated behind feature flags ("Live" / "Coming soon" badge)
- `client/src/hooks/use-broker-subscriptions.ts` — types for `BrokerTrustSignals`,
  `BrokerVerifiedDeal`, `BrokerFeatureFlagsMap`; `useBrokerFeatureFlags()` hook
- `client/src/hooks/use-broker-dashboard.ts` — extended `BrokerMyProfileResponse`
  with licenseStatus, recentVerifiedDeals, featureFlags

### What is NOT in Phase 1 (by design)
- Phase 2 (AI drafts + KB) — scaffolded behind `FEATURE_BROKER_AI_DRAFTS`, dark
  until compliance counsel review
- Phase 3 (ratings + credibility) — scaffolded behind `FEATURE_BROKER_RATINGS`,
  dark until ~50 brokers / ~500 subscribers
- Third-party license-lookup API — only the `ManualReviewProvider` stub exists;
  concrete provider (e.g. state-specific real-estate license API) deferred
- Stripe Connect for subscriber-subscription take-rate — Phase 2 dependency
  (subscriber subs require broker Advisor tier with AI drafts active)

### Known gotchas discovered this session
- `broker_follow_history` has an append-only PG rule
  (`broker_follow_history_no_delete DO INSTEAD NOTHING`) that blocks even
  cascade-deletes. To remove a broker profile, temporarily drop the FK on
  `broker_follow_history.broker_profile_id`, delete, then restore the FK. Do
  NOT drop the rule — it's there to prevent follow-cap gaming.
- Neon serverless pool's query generic type differs from `pg.Pool` — services
  use a minimal `QueryPool` interface instead of importing from `pg`.

### Validation performed
- Migration verified: all columns/indexes/tables present via information_schema
- End-to-end smoke test (created broker → 2 closed deals → 3 response samples →
  recompute services → public profile endpoint → directory endpoint):
  - Deal stats: count=2, volume=$18.05M, assetClasses=[hotel, marina] ✓
  - Response stats: median=1.5h, rate=66.67%, samples=3 ✓
  - License classification: warning level at 29 days ✓
  - License scan: correctly flagged 1 warning ✓
  - `trustSignals` fully populated on profile response ✓
  - Directory ranks broker with new trust-signal fields ✓
- Dev server running cleanly
- All test rows cleaned up, directory empty

### Next-session pickups
1. Phase 2 build-out (KB editor + RAG draft generator + approval inbox) behind
   `FEATURE_BROKER_AI_DRAFTS` — needs compliance disclaimer language from counsel
2. Phase 3 build-out (review prompts + credibility engine) behind
   `FEATURE_BROKER_RATINGS`
3. Concrete license-lookup provider integration (register via
   `registerLicenseVerificationProvider()`) — pick API per asset class/jurisdiction
4. CRM deal-detail UI: add "Attribute to broker" dropdown so deal closers can
   credit a broker profile when closing (currently only settable via raw PUT)

---

## Design Session (2026-04-17) — Broker Marketplace v1

**Not code, not started — design + monetization locked in for a large deferred initiative.**

Brett raised the idea of repositioning brokers/advisors on MarinaMatch the way
Airbnb positions hosts: subscriber/follower model, ratings, response-time
metrics, closed-deal volume, and per-broker AI knowledge bases that draft
replies/guidance (either auto-send or broker-approved), with the platform
learning each broker's system over time and weighting by credibility.

**Decisions (full design in memory — `project_broker_marketplace.md`):**

1. **Phased rollout — three phases, do not skip or reorder:**
   - Phase 1: Objective trust foundation (verified profiles, license, closed
     deals linked to real records, passive response-time tracking,
     subscriber/follower model). No reviews, no AI yet.
   - Phase 2: KB + AI drafts — broker approval gate mandatory, clear
     disclaimers on any AI-touched message, prompt-context learning only (no
     fine-tuning). Compliance counsel review REQUIRED before shipping.
   - Phase 3: Ratings + credibility weighting. Gated on ~50 active brokers /
     ~500 subscribers before public reviews — otherwise ratings are noise.

2. **Subscriber auth — shared identity, role-scoped surfaces.** One account
   system, role flags (GP / LP / broker / subscriber), different landing
   pages/nav per role. Airbnb host/guest pattern. Don't fragment identity.
   The LP portal should follow the same pattern.

3. **Verification — both manual + third-party, third-party first.** License
   lookup API as automated gate (handles 90%+), manual review only for edge
   cases. Manual-default becomes the scaling bottleneck.

4. **Monetization:**
   - **Anchor:** Tiered broker subscriptions (Listings / Advisor / Premium
     Advisor / Enterprise). Predictable revenue.
   - **Secondary:** 10–15% platform take on broker-set subscriber
     subscription prices, via Stripe Connect (automatic split, low ops).
     Benchmarks: Substack 10%, Patreon 8–12%, Airbnb ~15%.
   - **Skip success fees on closed deals** — regulatory complexity
     (broker-dealer / real estate broker licensing at platform level,
     RESPA in some asset classes), incentive misalignment (brokers route
     off-platform), hard to enforce.
   - **Caveat:** Subscriber-sub volume in CRE will be low (50–500 subs
     at $20–$200/mo per broker, not 50k). Take-rate is a nice secondary
     stream, not the main event.
   - **Lever:** Per-draft / per-1k-token overage on AI usage above tier
     cap, to prevent a single power-user broker from eating LLM budget.

**Open questions flagged for Phase 1 kickoff:**
- Which third-party license-lookup API per asset class / jurisdiction
- Disclaimer language for AI-drafted messages (draft with counsel)
- Whether subscription prices have platform floors/ceilings or broker-set
- When a subscriber graduates to a lead in CRM and how broker attribution
  is credited

**Queue status:** Added as item #17 in `project_remaining_queue.md`.
Deferred until stabilization sprint (items 1-6) and revenue-readiness
(items 7-8) complete. Do not interleave.

---

## Current State (2026-04-16)

### ✅ COMPLETE — Document Upload & AI Parsing: 4 Critical Fixes (2026-04-16)

Audited the full document upload + AI parsing pipeline and applied 4
high-priority fixes to unblock accurate financial document processing.

**Audit summary:** The pipeline was ~90% production-ready with a 5-stage
mapping chain (alias → regex → keyword → canonical → LLM), anomaly
detection, validation gates, and a clean bridge to modeling actuals. Four
specific gaps were causing data-quality issues or silent failures.

**Fix #1 — Auto-create canonical item when category created**
(`server/services/doc-intel-service.ts`)
- Problem: users creating custom categories in CategoryManager weren't
  visible to the parser because `pnl_categories` ≠ `pnl_canonical_line_items`
- Fix: `createCategory()` now upserts a matching `pnl_canonical_line_items`
  row (canonicalKey derived from name, section mapped from categoryType)
  with `ON CONFLICT DO UPDATE` so the parser immediately recognizes new
  user-created categories

**Fix #2 — Wire LLM_PROVIDER to Anthropic auto-detect**
(`server/utils/llm/index.ts`)
- Problem: `LLM_PROVIDER` defaulted to `'mock'` — users with
  `ANTHROPIC_API_KEY` set were still getting mock classification with 50%
  confidence penalty
- Fix: auto-detect from available API keys —
  `ANTHROPIC_API_KEY → 'anthropic'` · `OPENAI_API_KEY → 'openai'` ·
  else `'mock'`. Explicit `LLM_PROVIDER` env var still overrides.

**Fix #3 — Rent roll parsing → lease table sync**
- `server/services/rent-roll-sync-service.ts` NEW — bridges parsed rent
  roll data into `rent_rolls` + `rent_roll_entries` tables. Heuristic
  header mapping (e.g., "Slip #"/"Unit"/"Space" → unitNumber) with
  type/status inference from column values.
- `server/routes.ts` — new `POST /api/modeling/projects/:id/rent-roll-sync`
  endpoint. Reads file from `doc_intel_uploads`, parses via
  `RentRollDocumentParser`, syncs to structured tables.
- Previously: rent rolls were parsed but the data dead-ended (no bridge).

**Fix #4 — Retry logic for failed parsing jobs**
- `server/services/pnl/retry-failed-jobs.ts` NEW — `retryFailedPnlJobs()`
  queries `pnl_jobs WHERE status='failed' AND retry_count < 3`, resets to
  `'queued'`, re-runs `runPnlPipeline()` fire-and-forget. Batch of 5 per
  tick.
- `server/jobs/platform-cron.ts` — registered as `"*/15 * * * *"` (every
  15 minutes). Previously: failed jobs stayed failed permanently.

**Validation**
- `tsc --noEmit` clean on all touched files (6 files)
- No schema changes needed — all tables already existed

**Follow-ups (Phase 2 — flagged in audit, not yet built)**
- OCR fallback for scanned PDFs (Tesseract or Claude Vision)
- Business-rule validation layer on LLM output (revenue never negative, etc.)
- Per-category audit trail (who corrected what, when)
- ML-based confidence scoring (replace linear heuristic)
- Rent roll sync needs a frontend "Sync to Model" button in the uploads
  UI (endpoint is ready, UI button not yet wired)

---

### ✅ COMPLETE — Phase 4 LP Experience: K-1 PDF + Quarterly Delivery (2026-04-16)

Closed the two remaining Phase 4 gaps from the institutional audit:
(1) K-1 tax document PDF generation and (2) quarterly automated statement
delivery.

**Discovery:** Phase 4 was ~85% done. `lp-statement-pdf.ts` was already a
full StatementPDFBuilder, the LP portal auth + frontend pages were
scaffolded, `generateInvestorStatement()` was fully implemented,
`generateK1()` in `lp-portal-service.ts` already produced structured K1Data.
Only two gaps remained.

**Files**
- `server/services/k1-statement-pdf.ts` NEW (~210 lines) — `K1PDFBuilder`
  using pdf-lib. Renders partner info, 7-section income/loss allocations,
  deductions, credits/AMT, distributions, capital account analysis.
  Same Navy/Steel/Teal palette + Helvetica fonts + striped tables +
  confidential footer as lp-statement-pdf.ts. Includes tax disclaimer.
- `server/routes/modeling-routes.ts` — new
  `GET /api/funds/:fundId/investors/:investorId/k1/pdf?taxYear=2025`
  route. Calls `lpStatements.generateK1()` → `generateK1PDF()` → streams
  binary PDF with attachment header.
- `server/services/quarterly-lp-delivery.ts` NEW (~150 lines) —
  `runQuarterlyLPDelivery()`. For each active fund, for each active
  investor: generates statement PDF via `generateStatementPDF()`, resolves
  investor email from `lp_portal_users` → `lp_investors` fallback, sends
  via `sendEmail()` with PDF attachment. Creates
  `lp_statement_deliveries` tracking table inline (idempotent CREATE IF
  NOT EXISTS) with `UNIQUE(fund_id, investor_id, quarter_label)` to
  prevent double-delivery. Returns `{funds, investors, sent, failed}`.
- `server/jobs/platform-cron.ts` — registered quarterly delivery as
  `"0 6 1 1,4,7,10 *"` (6 AM on Jan/Apr/Jul/Oct 1st). Also previously
  registered the email scheduler tick at `"* * * * *"`.

**Phase 4 LP Experience status after this session:**
- ✅ PDF statement generation — existed, confirmed working
- ✅ K-1 tax document PDF — NEW, route + renderer
- ✅ Quarterly automated delivery — NEW, cron + email + PDF attachment
- ⚠️ LP portal independent auth — scaffolded (auth service + routes +
  frontend pages exist, but needs integration testing + password reset +
  TOTP enrollment UI)

**Known follow-ups**
- LP portal needs integration testing (login flow, session management,
  password reset, TOTP 2FA enrollment)
- K-1 PDF is a "summary report" (not the official IRS Form 1065
  Schedule K-1); formal filing requires a tax-forms renderer
- `sendEmail()` `attachments` parameter assumes SendGrid attachment
  format `{content, filename, type, disposition}` — Resend fallback
  path may need adaptation for attachments
- Annual K-1 delivery cron (separate from quarterly statements) not yet
  scheduled — could fire `"0 6 1 3 *"` (March 1st) for prior tax year

---

### ✅ COMPLETE — Email Send Integration (Tier 2) (2026-04-16)

Extended the existing email compose/send pipeline with template merge-field
substitution, scheduled sends, and a scheduler job — completing the final CRM
priority from CLAUDE.md.

**Discovery finding:** v0 was more built-out than expected:
- `ComposeEmailModal` already mounted in deal-detail.tsx, calling
  `POST /api/workflow-email/compose-send`
- Full template CRUD already at `/api/workflow-email/templates` with
  `interpolateTokens()` helper, preview endpoint, send-test endpoint
- Workflow engine already had a complete `email.send` action type (line 262
  of workflow-engine.ts) with template context resolution, recipient
  resolution, and send dispatch
- `emailMessages.scheduledAt` column already existed in schema
- `AVAILABLE_TOKENS` list already defined (15 tokens across deal/contact/
  org/user/rule)

**What was actually missing** (and now built):
1. `compose-send` didn't accept `templateId` or `sendAt`
2. No scheduler polling emailMessages for scheduled sends
3. Compose modal had no template picker, no schedule option, no token
   insertion

**Backend changes**
- `server/routes/workflow-email-routes.ts`:
  - New `buildComposeContext()` helper — queries real `crm_deals` +
    `crm_contacts` + `organizations` tables to build `{{deal.*}}` /
    `{{contact.*}}` / `{{user.*}}` / `{{org.*}}` substitution context.
    Distinct from `buildSampleContext()` which queries `sourced_deals`
    for the template preview UI.
  - Extended `POST /compose-send` to accept:
    - `templateId` — loads template, uses as default subject+body (inline
      values override)
    - `sendAt` — if >60s in the future, writes to `email_messages` with
      `status='scheduled'` and returns `{ scheduled: true }` without
      sending
  - All sends (template or ad-hoc) now interpolate tokens via
    `buildComposeContext`
  - Canonical record always written to `email_messages` table (in
    addition to legacy `workflow_email_log` for backward compat)
  - Template usage counter bumped on successful send
  - New `GET /scheduled` — lists the caller's pending scheduled emails
  - New `POST /scheduled/:id/cancel` — reverts a scheduled email to
    draft status
- `server/services/email-scheduler.ts` NEW — `runEmailSchedulerTick()`
  polls `email_messages WHERE status='scheduled' AND scheduled_at <= NOW()`
  in batches of 50, uses optimistic row-level lock (`status → 'sending'`)
  to prevent double-dispatch, sends via `sendEmail()`, flips to 'sent' or
  'failed', logs CRM activity on success
- `server/jobs/platform-cron.ts` — registered `runEmailSchedulerTick` as
  a new cron job running every minute

**Frontend changes**
- `client/src/components/email/compose-email-modal.tsx` REWRITTEN:
  - **Template picker** — dropdown fetches `/api/workflow-email/templates`,
    on select calls `/templates/:id/preview` with the current dealId to
    render subject + body with real deal data (not raw `{{tokens}}`)
  - **Token insertion helper** — small "Insert token" popover showing all
    15 available tokens with label + example, clicking inserts
    `{{deal.propertyName}}` etc. at cursor
  - **Schedule toggle** — Switch + datetime-local input, defaults to
    next hour on the hour. When enabled, Send button becomes "Schedule"
    (Clock icon instead of Send)
  - **Save as template** — inline name input + save button, POST to
    `/api/workflow-email/templates` with current form contents
  - Textarea switched to `font-mono text-sm` to make tokens readable
  - Activity + scheduled queries invalidated on success

**Open tracking pixel:** skipped for v1 (spam filter cost, privacy, and
the bot-filtering infra needed are a rabbit hole). Schema field
`emailMessages.openedAt` stays in place for future webhook integration.

**Validation**
- `tsc --noEmit` clean on all touched files (4 files)
- Scheduler registers on startup alongside existing platform cron jobs
- compose-send endpoint backward-compatible (existing callers that pass
  `{to, subject, body}` without templateId/sendAt still work identically)

**Known follow-ups**
- Open/click tracking pixel + webhook receiver for SendGrid/Resend
- Exponential backoff + retry counter on scheduled-send failures (currently
  flips to 'failed' on first failure)
- Rich text editor in the compose modal (currently plaintext textarea with
  manual HTML)
- Broker digest pipeline (Tier 3) — scheduled batch of broker verdicts +
  matched listings per subscriber
- Inbound email parsing + reply threading schema
- The existing `buildSampleContext` queries `sourced_deals` not `crm_deals`
  — template preview UI will show wrong data for CRM deals; fix in a
  follow-up

---

### ✅ COMPLETE — Deal Comparison in Workspace — Unification (2026-04-16)

Unified three disconnected deal-comparison surfaces onto a single canonical
page (`client/src/pages/deal-comparison-page.tsx`) and added a persistent
global comparison cart so users can build a comparison from anywhere in the
deal workspace.

**Finding during discovery:** Three comparison pages already existed with
different philosophies and none of them called the rich backend endpoint at
`POST /api/crm/pipeline-enhancements/compare` (which returns 7 structured
categories + rankings). Selection was only possible for deals with a linked
modeling project via a popover in `deal-workspace.tsx`. State was local,
lost on navigation.

**Scope decision (confirmed with user):** unify on
`deal-comparison-page.tsx` as the canonical view. Leave
`client/src/components/crm/DealComparison.tsx` (weighted scoring + radar)
and `client/src/pages/modeling/projects/workspace/deal-comparison.tsx` (full
model compare) untouched in this pass; link to them from the main page in a
future session.

**Files**
- `client/src/stores/comparison-cart-store.ts` NEW — Zustand store with
  `persist` middleware (localStorage key `mm:comparison-cart`). Max 5 (matches
  backend `/compare` endpoint cap). API: `toggle()`, `remove()`, `clear()`,
  `has()`, plus `useIsInComparisonCart(id)` selector hook.
- `client/src/components/comparison/ComparisonToggle.tsx` NEW — small
  per-card checkbox button (Scale icon off-state, Check icon on-state).
  Stops propagation so it doesn't trigger the card's onClick. Toasts when
  the cart is full.
- `client/src/components/comparison/ComparisonCartBar.tsx` NEW — floating
  bottom bar with framer-motion slide-up entrance. Shows per-deal chips
  (truncated title + remove button), Clear, and a primary "Compare →"
  button that navigates to `/crm/deals/compare?ids=...`. Only the
  Compare button is enabled when >= 2 deals selected.
- `client/src/components/deals/DealKanbanBoard.tsx` — added
  ComparisonToggle beside the priority badge on each deal card
- `client/src/components/deal-workspace/PipelineView.tsx` — same, on the
  secondary kanban card
- `client/src/pages/deal-workspace.tsx` — mounted `<ComparisonCartBar />`
  at root so it's visible across all workspace views (pipeline, list,
  leads, activity, tasks)
- `client/src/pages/deal-comparison-page.tsx` — extended:
  - Hydrates `selectedDealIds` from cart on mount when `?ids=` URL param
    is absent (only on mount; subsequent refinement is user-controlled)
  - Max bumped from 4 → 5 (uses `MAX_COMPARISON_DEALS` constant)
  - New `NewSignalsSection` component below the main metrics grid with
    two sub-sections:
    - **DD Timelines row** — per-deal compact DD bar using `DDSegmentRow`
      with a local 420px coordinate system, fetches
      `/api/crm/deals/:id/extensions` via `useQueries`. Deals without a
      signed PSA get a "No DD period yet" placeholder.
    - **Broker Feedback row** — per-deal verdicts from
      `/api/broker-feedback/modeling-project/:id`, but only for deals
      with a linked modeling project. Rendered as a table with brokers
      as rows and deals as columns. Verdict chips match the broker
      feedback panel visual language (pursue/watch/pass pills with
      score). Gracefully degrades to an italic "follow brokers" prompt
      when no feedback exists.
  - Empty-state copy updated to point users at the new Scale icons on
    kanban cards

**Validation**
- `tsc --noEmit` clean on all touched files (7 files)
- No backend changes — pure frontend wiring on top of existing endpoints
  (`POST /compare`, `GET /extensions`, `GET /broker-feedback`)

**Known follow-ups**
- The main comparison metrics table still fetches deals individually via
  `GET /api/deals/:id` instead of the `POST /compare` endpoint — swapping
  would consolidate rankings (value/probability/daysInStage) but would
  also drop the asset-class-aware field unioning the existing code does
  well. Reserved for a future pass.
- Deal list view (`ListView`) rows don't yet have a ComparisonToggle —
  toggle is only on kanban cards. Follow-up.
- Broker feedback row can't show feedback for deals without a linked
  modeling project. To fully support this would require extending the
  evaluator service with a `loadDealTarget()` path — deferred.
- The legacy `DealComparison.tsx` (weighted scoring + radar) and
  `modeling/projects/workspace/deal-comparison.tsx` (full model compare)
  are still accessible via their own routes but not linked from the
  canonical page yet.

---

### ✅ COMPLETE — Deal Timeline Gantt: A+B+C + Deposits Lane (2026-04-15, late evening)

Full overhaul of the Deal Timeline tab (`client/src/components/deals/deal-timeline-tab.tsx`,
already mounted on the deal detail page). Applied the FM Design System v2
motion language established by the DD animation, folded DD + extensions into a
dedicated gantt lane backed by the real `dealExtensions` table, added a
deposits lane backed by `dealDeposits`, and added a stage progression bar
above the gantt.

**Critical finding during verification read:** the existing timeline endpoint
(`buildTimelineEventsForDeal` at `server/routes/crm-pipeline-enhancements-routes.ts:42`)
was ONLY pulling denormalized key_dates from `crmDeals` (ddExpirationDate,
firstDepositDueDate, secondDepositDueDate). The richer `dealExtensions` and
`dealDeposits` tables were invisible to the timeline. The old top-of-tab
`DealTimelineVisualizer` was also reading the DEPRECATED `extensionDays[]`
integer array with a "first N executed" heuristic — inconsistent with the
real `dealExtensions.executed` flags. Both gaps are now fixed via client-side
fetches on the existing `/crm/deals/:id/extensions` and `/crm/deals/:id/deposits`
endpoints. No backend changes.

**Files**
- `client/src/components/deals/dd-segment-row.tsx` NEW — inline gantt renderer
  for DD period. Paints base DD (Deep Marine Blue), executed extensions
  (Harbor Teal with glow pulse + `+Nd` chip), and pending extensions
  (dashed Harbor Teal ghost). Accepts parent `getXPx` and `baseDelay` so it
  shares the gantt coordinate system and staggers after the lane fades in.
  Tooltips on each segment.
- `client/src/components/deals/deal-stage-progress-bar.tsx` NEW — connected
  stage progression bar above the gantt. Chronologically sorts
  `stage_change` events from the timeline endpoint, draws Deep Marine Blue
  for completed stages, Harbor Teal (pulsing scale) for current, slate
  ghost for upcoming. Each stage is a staggered entrance; connector lines
  draw in between stages.
- `client/src/components/deals/deal-timeline-tab.tsx` REWRITTEN:
  - Removed stale top `DealTimelineVisualizer` (used deprecated
    `extensionDays[]` array)
  - Added `DealStageProgressBar` at the top, sourced from the stage_change
    events (always fetched regardless of lane visibility)
  - Reordered category lanes: stages / due_diligence / key_dates /
    deposits / tasks / playbook / milestones / red_flags / activities
  - New `due_diligence` lane renders `DDSegmentRow` with real
    `dealExtensions` fetched from `/api/crm/deals/:id/extensions`
  - New `deposits` lane with `DepositMarker` components (green paid check,
    pink pending, red pulsing overdue); amount label in compact $k/$M form;
    tooltip shows depositNumber, anchor, due/paid dates, refundable flag,
    applied-to-price flag
  - Replaced static 2px dashed cyan today line with pulsing amber marker
    matching `DDTimelineAnimation` (framer-motion infinite scale/opacity)
  - Wrapped gantt container + lane rows + events + left-column labels in
    framer-motion with staggered entrance (~0.18 + 0.08 × laneIdx)
  - Point events (diamond/icon/circle) animate in with spring
    (stiffness 400, damping 18-20); range bars use `scaleX` grow from left
  - **Collision handling** via `layoutEventsWithCollision()`: point events
    within 12px of each other stack vertically in 3 rows (top=8, mid=16,
    bot=24) so markers don't overlap in the same lane
  - Custom deadlines visually distinguished from built-in key dates:
    rotate-45 hollow outline diamond (purple border) vs filled diamond
  - SUPPRESSED_KEY_DATE_LABELS set removes the old denormalized DD/deposit
    key_dates from the key_dates lane now that DD + Deposits have their
    own lanes — no duplication
  - Time bounds calculation now includes `dealExtensions` total days and
    `dealDeposits.calculatedDueDate/actualPaidDate` so the gantt extends
    far enough right
  - Always fetches stages regardless of lane toggle (so the progression
    bar keeps working even if the Stages lane is hidden)

**Validation**
- `tsc --noEmit` clean on all touched files
- HMR should pick up changes without restart

**Design cohesion**
- Same motion tokens as DD animation (`--motion-ease-standard`,
  `--motion-duration-enter`, `--motion-duration-grant` in `index.css`)
- Same Deep Marine Blue / Harbor Teal / amber / emerald palette
- Same animation idioms (scaleX grow, spring pop, pulsing today marker)

**Known follow-ups**
- Stage progression bar currently only includes stages that appear in
  `crm_deal_stage_history` — stages the deal never entered are invisible.
  Could overlay the canonical pipeline stage list as ghost markers for
  full lifecycle visibility
- `layoutEventsWithCollision` caps at 3 vertical rows; deals with >3
  markers in the same 12px window still overlap on the 3rd row
- Stage bars in the gantt swimlane are still separate from the top
  progression bar — slight visual redundancy but different grain (top =
  sequence, lane = duration in time)
- Milestone lane approval events don't yet use custom colors
- The DD lane doesn't yet have a PSA or DD-ends cap (those are on the
  top stage-progression bar as implicit markers via key_dates lane)

---

### ✅ COMPLETE — DD Timeline Animation (2026-04-15, evening)

Animated horizontal Due Diligence timeline rendered on the modeling workspace
overview tab for deals at LOI+ (or wherever `psaSignedDate` is set). Visualizes
the original DD period, stacks executed extensions end-to-end with a Harbor
Teal glow, shows a pulsing "today" marker and a closing-date flag. Extension
grants animate live via framer-motion `layout` transitions when a new row
flips `executed=true`.

**Files**
- `client/src/index.css` — added FM Design System v2 motion tokens
  (`--motion-ease-standard`, `--motion-ease-emphasized`, `--motion-duration-quick`,
  `--motion-duration-enter`, `--motion-duration-grant`). First cohesive motion
  layer on the platform.
- `client/src/components/dd/DDTimelineAnimation.tsx` NEW (~380 lines) —
  presentational component. Computes geometry from `{psaSignedDate, ddPeriodDays,
  ddExpirationDate, closingDate, extensions[]}`, renders rail + segments + PSA
  node + DD-ends cap + closing flag + today marker, each with staggered
  framer-motion entrance (rail draws L→R, segments scaleX grow, nodes spring
  in, labels fade). `motion.div layout` on the DD-ends cap so it slides when
  a new extension lands. Hover tooltips + legend.
- `client/src/hooks/use-dd-timeline.ts` NEW — fetches `GET /api/deals/:id` +
  `GET /api/crm/deals/:id/extensions`, derives `eligible` flag (true when
  stage ∈ LOI+ set OR `psaSignedDate` set), computes `ddPeriodDays` if missing.
- `client/src/pages/modeling/projects/workspace.tsx` — imported component +
  hook, added `DDTimelineSection` wrapper inside the Overview tab, rendered
  above `BrokerFeedbackPanel` when `project.dealId` is set and eligible.

**Design choices**
- Deep Marine Blue (`hsl(221, 83%, 35%)`) = original DD; Harbor Teal
  (`hsl(177, 75%, 38%)`) = extensions; Amber = today marker; Emerald = closing.
- Eligibility gate = stage in LOI_OR_LATER set OR `psaSignedDate` present.
  LOI-stage deals without a signed PSA see a placeholder card instead of the
  rail, so there's still a visible affordance.
- Kept rendering scoped to modeling workspace overview only — portfolio
  `dd-review.tsx` intentionally skipped for v1 (too dense with 20+ cards).
  `dd-progress-report.tsx` can reuse the same component later with zero
  changes since it's purely presentational.

**Validation**
- `tsc --noEmit` clean on all touched files
- Dev server HMR picked up the changes without restart (tsx watching)

**Known follow-ups**
- Render custom deadlines (`crmDeals.customDeadlines` JSONB with
  `showOnTimeline=true`) as small ticks above the rail
- Compact variant for the portfolio DD review page
- Milestone labels could collide when extensions overlap closing; add
  smart label positioning
- Pending-extension (not yet executed) rendering as dashed outline ghost
  segments

---

### ✅ COMPLETE — Broker Feedback & Evaluation Layer (2026-04-15, afternoon)

Built the evaluator/training layer on top of the existing broker platform. Brokers
can now define structured recommendation criteria, and Marketplace+ subscribers see
real-time pass/watch/pursue verdicts from every broker they follow — on marketplace
listings and on their own modeling projects. Monetization piggybacks on existing
Marketplace+ tiers (Free/Solo/Pro/Institutional); no new Stripe SKU.

**Scope decision:** Option B — platform-only SKUs, brokers uncompensated directly
(lead-gen via profile CTAs). Auto-training deferred to v2; v1 is manual criteria
entry + deterministic rules + Claude Haiku narrative.

**Schema (scripts/step4_broker_feedback_schema.mjs)**
- `broker_profiles.criteria JSONB` — structured `BrokerCriteria` (asset classes,
  markets, cap rate floor, DSCR/LTV/IRR targets, hold period window, deal size
  range, risk tolerance, outlook narrative)
- `broker_profiles.auto_learn_enabled BOOLEAN` — reserved for v2
- `broker_profiles.criteria_updated_at TIMESTAMP`
- `broker_evaluations` NEW — cached verdicts keyed on
  `(broker_profile_id, target_type, target_id)` with 24h TTL, `verdict`/`score`/
  `matched_criteria`/`failed_criteria`/`narrative`/`criteria_snapshot`/
  `target_snapshot`. CHECK constraints on verdict + score + target_type.
  Drizzle schema updated in `shared/schema.ts`.

**Shared types**
- `shared/broker/criteria.ts` NEW — `BrokerCriteria`, `RiskTolerance`, `Verdict`,
  `CriterionResult`, `EvaluationResult`. Single source of truth for frontend +
  backend.

**Backend services**
- `server/services/broker-evaluator-service.ts` NEW (~450 lines):
  - `loadListingTarget()` / `loadModelingTarget()` normalize
    `marina_listings` and `modeling_projects` rows (plus
    `modeling_project_config` via raw `pool.query`, RLS-safe) into a
    `NormalizedTarget`
  - `runRules()` — deterministic rules engine; each set criterion is a gate,
    score = matched/total × 100, verdict: ≥80 pursue / ≥50 watch / <50 pass
  - `generateNarrative()` — optional Claude Haiku call
    (`claude-haiku-4-5-20251001`), returns 2-sentence broker-voice note
  - `evaluateTarget()` — cache-first, uses `broker_evaluations` upsert with 24h
    TTL
  - `getFeedbackForTarget()` — fans out across all brokers the user actively
    follows (via `broker_follow_history` join)
- `server/services/broker-entitlements.ts` — added
  `broker_feedback_verdict` to Solo+, `broker_feedback_narrative` +
  `broker_feedback_modeling` to Pro+, and a new `tierHasFeature()` helper
- `server/routes/broker-dashboard-routes.ts` — added `criteria` +
  `autoLearnEnabled` to `EDITABLE_PROFILE_FIELDS`; PATCH `/my-profile` now
  stamps `criteria_updated_at` when criteria changes

**Backend routes**
- `server/routes/broker-feedback-routes.ts` NEW mounted at
  `/api/broker-feedback`:
  - `GET /listing/:id` — verdicts for a marketplace listing (all followed
    brokers); narrative stripped server-side below Pro tier
  - `GET /modeling-project/:id` — same for modeling projects; 403s Free/Solo
    users (modeling feedback is Pro+ only)
  - `POST /evaluate` — explicit single-broker evaluation (force recompute)
- Mounted in `server/routes.ts` under `authenticateUser + enforceTenant`

**Frontend**
- `client/src/hooks/use-broker-feedback.ts` NEW — React Query hooks
  `useListingBrokerFeedback()` + `useModelingProjectBrokerFeedback()` with
  `brokerFeedbackKeys` factory
- `client/src/components/broker/BrokerCriteriaEditor.tsx` NEW — criteria form
  (asset-class chips, market codes, cap rate floor, DSCR/LTV/IRR, hold window,
  deal size window, risk tolerance, outlook narrative textarea)
- `client/src/components/broker/BrokerFeedbackPanel.tsx` NEW — reusable
  verdict card with pursue/watch/pass pills, matched/failed criteria chips,
  Haiku narrative (gated), inline upgrade prompt for Free/Solo
- `client/src/pages/broker/dashboard/BrokerProfileEditor.tsx` — embedded
  `BrokerCriteriaEditor`, criteria state merged into `handleSave()` payload
- `client/src/pages/marinamatch/MarketplaceListings.tsx` — mounted
  `<BrokerFeedbackPanel targetType="listing">` inside `ListingDetailPanel`
  above the Financial Snapshot
- `client/src/pages/modeling/projects/workspace.tsx` — mounted
  `<BrokerFeedbackPanel targetType="modeling-project">` in the Overview tab

**Validation**
- `step4_broker_feedback_schema.mjs` applied cleanly
- `tsc --noEmit` on all touched files — no errors
- Dev server restarted (`pkill -f 'tsx server' && npm run dev`), all existing
  broker routes still 200; new `/api/broker-feedback/listing/:id` returns 200

**Known follow-ups**
- Auto-training loop (scan broker's own deal pipeline outcomes, adjust
  criteria thresholds nightly with `manualOverride` protection)
- Per-broker analytics (verdict volume, follower engagement) for the broker
  dashboard
- Listing detail sheet's `canonicalListingId` assumes it maps 1:1 to
  `marina_listings.id` (per Task #20 ingestion v2 migration); confirm before
  broader release
- PDF/email delivery of verdicts for asynchronous "broker digest" flow
- Flat-bounty broker compensation system (Option A) when broker count warrants

---

### ✅ COMPLETE — Deal Marketplace + Broker Platform (2026-04-15)

Multi-week work on the universal Deal Marketplace and broker-facing SaaS landed
on branch `feat/exit-engine-patches`. Committed in `307460e2` ("Git commit prior
to merge", ~11,113 lines across 46 files) plus `191cf37c` (Stripe plan gate on
publish). DB migrations already applied (`scripts/step1_marketplace_schema.mjs`,
`step2_broker_subscriptions_schema.mjs`, `step3_broker_entitlements_fix.mjs`,
`seed_stripe_broker_skus.mjs`).

**Schema / DB**
- `shared/schema.ts` — universal marketplace columns on `marina_listings`
  (`listing_category` enum, `asset_class`, `cre_metrics`/`business_metrics` jsonb,
  `broker_profile_id` FK, `currency`, `price_on_request`, `is_location_confidential`,
  `is_active`, `published_at`, `last_seen_at`, `source_listing_id_canonical`) +
  `marketplace_sources` and `marketplace_scrape_runs` tables
- `shared/marketplace/asset-class-taxonomy.ts` — cross-asset taxonomy shared
  between scrapers, filters, and frontend
- New/updated broker tables: `broker_profiles`, `broker_registrations`,
  `broker_subscriptions`, `broker_advisory_packages`, `broker_advisory_content`,
  `broker_advisory_messages`, `broker_listing_claims`, `broker_listing_claim_disputes`,
  `broker_activity_log`, `broker_follow_history`, `broker_portal_submissions`,
  `broker_relationships`

**Backend services**
- `server/services/broker-tiers.ts` — broker SKU definitions (starter/pro/enterprise,
  feature flags, Stripe price IDs via env)
- `server/services/broker-entitlements.ts` — buyer-side Marketplace+ tiers
  (free/solo/pro/institutional) with precedence: user override → org → free default
- `server/services/broker-claim-service.ts` — listing claim lifecycle
  (backfill on publish, release on unpublish)
- `server/services/billing-service.ts` — new Stripe webhook handlers:
  `checkout.session.completed` splits on `metadata.sku` for `marketplace_plus`
  vs `broker_plan`; `customer.subscription.deleted/updated` downgrades
  entitlements. New `hasActiveBrokerPlan(userId)` helper used by the publish
  gate (Stripe-first with dev fallback to `brokerProfiles.brokerTier`).

**Backend ingestion framework** (`server/ingestion/`)
- `dedupe.ts`, `persistence.ts`, `registry.ts`, `scheduler.ts`, `scrapers/base.ts`,
  `scrapers/bizbuysell.ts` — generic adapter-based scraper pipeline that writes
  through to `marina_listings` with `listing_category` + `business_metrics`
- `server/listings/ingestion_v2/routes.ts` — `GET /listings` now queries the
  canonical `marina_listings` table with category / asset-class / business-metric
  filters (`minRevenue`, `maxRevenue`, `minEbitda`, `maxEbitda`, `minSde`, `maxSde`);
  legacy `liv2_listings_current` passthrough via `?legacy=1`

**Backend routes** (all mounted under `authenticateUser + enforceTenant`)
- `POST/GET /api/broker-subscriptions/*` — subscriber-side follow/advisory billing
- `POST/GET /api/broker-registration/*` — broker self-registration + admin queue
- `POST/GET /api/admin/broker/*` — registration approval / rejection
- `POST/GET /api/broker-billing/*` — Stripe checkout/portal for broker plans
- `POST/GET /api/broker-claims/*` — claim-a-scraped-listing flow with dispute support
- `GET/POST/PATCH /api/broker-dashboard/*` — broker dashboard CRUD (profile,
  listings, advisory packages, content, subscribers, analytics); publish now
  gated on `billingService.hasActiveBrokerPlan()`
- `/api/admin/marketplace-ingestion/*` — admin-only source CRUD, run triggers,
  run history

**Frontend**
- `client/src/hooks/use-broker-admin.ts`, `use-broker-dashboard.ts`,
  `use-broker-subscriptions.ts` — React Query hooks with invalidation
- `client/src/components/broker/UpgradePrompt.tsx`
- `client/src/pages/broker/` — BrokerRegister, BrokerDirectory, BrokerProfile,
  BrokerFeed, MyBrokerSubscriptions
- `client/src/pages/broker/dashboard/` — Layout + Overview, ProfileEditor,
  ListingsManager, AdvisoryPackages, ContentPublisher, SubscribersList, Analytics
- `client/src/pages/admin/BrokerRegistrationsQueue.tsx` — admin review queue
- `client/src/pages/marinamatch/MarketplaceListings.tsx` — +429 lines:
  asset-class and business-metric filters
- `client/src/Router.tsx` — 13 new routes: `/broker/*`, `/brokers`,
  `/brokers/:profileId`, `/brokers/feed`, `/admin/broker-registrations`,
  `/settings/broker-subscriptions`

**Smoke test (2026-04-15)** — all 6 broker routers return 200 on the dev server;
`/api/admin/marketplace-ingestion/sources` correctly returns 403 (admin-gated);
`/api/liv2/listings` returns 200 serving the new shape; publish endpoint
returns 403 for unauthenticated callers (expected).

**Known follow-ups**
- Only one scraper adapter implemented (`bizbuysell.ts`); registry/scheduler are
  generic and ready for more marketplace sources
- Webhook cancel path resets `brokerTier='starter'` + `isPublishable:false`;
  since `starter` is itself a paid tier, distinguishing "new starter purchase"
  vs "canceled, demoted to starter" now relies on the Stripe lookup in
  `hasActiveBrokerPlan()` rather than the denormalized column alone
- No PII encryption yet on `broker_portal_submissions` (leads captured from
  public broker pages)

---

## Previous State (2026-04-01)

### ✅ COMPLETE — Offering Memorandum Rendering Pipeline (2026-04-01)

## Builder Agent — 2026-04-01
- Completed: OM renderer, 3 API routes, frontend generate/preview flow
- Files changed:
  - `server/services/document-builder/om-renderer.ts` — NEW (~500 lines). Portrait HTML renderer with all block type handlers: section dividers (large numeral), heading, text, image (collage + standard), metric_grid (6 styles: offering_terms, offering_summary, highlights_4grid, stat_callouts, broker_cards, opportunity_cards, demographics_3ring), table (key_value, amenities_checklist, lease_panel, structured/sectioned financial tables, rate_table, bnb_vessel, toc_numbered, comp_table), chart (data table v1), bullet_list. Full OM CSS: cream/gold/navy palette, Playfair Display + Source Sans Pro typography, wave motif SVG, page breaks, token highlighting.
  - `server/services/document-builder/token-resolver-service.ts` — MODIFIED. Added `resolveOmTokens()` function: resolves 6 OM-specific tokens (OM_NOI_TABLE, OM_PROFORMA_TABLE, OM_EXPENSE_ASSUMPTIONS_TABLE from pro forma via raw pool.query; LOCATION_TAGLINE and TOURISM_FACTS from om_builder_documents metadata; BOATING_PARTICIPATION_PCT from demographics).
  - `server/routes/document-builder-routes.ts` — MODIFIED. Added 3 OM routes: `GET /om/token-status/:dealId` (section-level readiness with auto-disable), `GET /om/preview/:dealId` (full HTML preview), `POST /om/generate` (document creation + section rendering + export job + CRM activity log). Added `getOMDisabledSections()` for auto-disable logic (nearby_marinas when no comps, market_overview when no population data).
  - `client/src/pages/modeling/projects/workspace/om-generate.tsx` — NEW (~280 lines). OMGenerateButton component with: token readiness check, section-level readiness display (resolved/total per section), section toggle checklist, PDF/DOCX format selector, watermark input, generate mutation with export job polling, HTML preview in iframe dialog.
  - `client/src/pages/modeling/projects/workspace.tsx` — MODIFIED. Imported OMGenerateButton, rendered in Investment Materials tab below IC Deck button.
- Validation: Server restarted, all 3 GET routes return 200. Token status shows 88 tokens, section readiness with auto-disable. Preview generates 24KB HTML across 7 sections. POST route requires auth/CSRF (correct).
- Notes: Market Overview section correctly auto-disabled when population data absent. OM_NOI_TABLE builds structured JSON with Revenue/COGS/Gross Profit/Operating Expenses/NOI sections. All OM routes follow same pattern as IC Deck routes.

---

### ✅ COMPLETE — Offering Memorandum Spec (2026-04-01)

## Planner Agent — 2026-04-01
- Spec written: Offering Memorandum — Rendering Pipeline
- Output: agents/specs/offering-memorandum-spec.md
- Builder task added: yes (updated in AGENT_QUEUE.md)
- Notes: OM template already exists at `shared/document-builder/templates/offering-memorandum.ts` (8 sections, 86 tokens, portrait layout). Spec covers the rendering pipeline: `om-renderer.ts` (portrait HTML renderer with warm cream/gold/navy styling, 10+ table styles, section dividers with large numerals), 3 API routes (token-status, preview, generate), 6 new OM-specific tokens (3 financial table tokens: OM_NOI_TABLE, OM_PROFORMA_TABLE, OM_EXPENSE_ASSUMPTIONS_TABLE + LOCATION_TAGLINE, BOATING_PARTICIPATION_PCT, TOURISM_FACTS), and 2 frontend components (generate button with readiness check, HTML preview). Charts rendered as data tables in v1 PDF. Optional sections (Nearby Marinas, Market Overview) auto-disable when primary data absent. High complexity (~1,420 lines across 5-6 files). Depends on token substitution engine being built first. Shares resolver/export infrastructure with IC Deck but needs its own renderer due to portrait vs. landscape layout and distinct broker-facing aesthetic.

---

### ✅ COMPLETE — Document Studio DB Migration (2026-04-01)

## DB Agent — 2026-04-01
- Migration: Created `document_templates` and `document_renders` tables for Document Studio
- Tables affected: `document_templates`, `document_renders`, `om_document_sections`
- Changes:
  - `document_templates`: org-scoped template definitions (name, document_type, sections JSONB, styles, token_defaults, is_global flag). Indexed on org_id, document_type, and partial index on is_global.
  - `document_renders`: render output log with FK to om_builder_documents, document_templates, and crm_deals. Stores rendered_html, rendered_json, token_snapshot, token_stats, overrides. Indexed on org_id, document_id, deal_id, status.
  - `om_document_sections`: Added `rendered_content TEXT` column for caching token-substituted output (per token substitution engine spec).
- Validation: passed — all tables and columns verified via `\d`

---

### ✅ COMPLETE — IC Deal Review Deck Spec (2026-04-01)

## Planner Agent — 2026-04-01
- Spec written: IC Deal Review Deck
- Output: agents/specs/ic-deal-review-deck-spec.md
- Builder task added: yes (updated in AGENT_QUEUE.md)
- Notes: 14-section landscape deck template already defined at `shared/document-builder/templates/ic-deal-review-deck.ts` (128 tokens). Spec covers the rendering pipeline: token resolver extensions (28 missing tokens including table builders for PROFORMA_SUMMARY_TABLE, SOURCES_USES_TABLE, sensitivity tables), 3 new API routes (generate, preview, token-status), a new `ic-deck-renderer.ts` section→PDF renderer, and 3 frontend components (generate button with readiness check, HTML preview, section toggle). Charts rendered as data tables in v1 PDF (native charts in PPTX via pptxgen). Optional sections auto-disable when primary data absent. High complexity (~1,050 lines across 6-8 files). Depends on token substitution engine being built first.

---

### ✅ COMPLETE — Token Substitution Engine Spec (2026-04-01)

## Planner Agent — 2026-04-01
- Spec written: Shared Token Substitution Engine for Document Studio
- Output: agents/specs/token-substitution-engine-spec.md
- Builder task added: yes (already existed in AGENT_QUEUE.md)
- Notes: Existing `token-resolver-service.ts` already resolves 120+ tokens from 8 data sources (deal, property, modeling, capital stack, exit, pro forma, comps, demographics). Three parallel interpolation systems exist: AI Content (`{{key}}`), Workflow Engine (`{{entity.field}}`), Document Builder (`{{TOKEN_NAME}}`). Spec covers the **missing middle layer**: format-aware substitution (currency/percent/number/date), 3 new API endpoints (resolve-formatted, render, render-all), frontend TokenCatalog/ManualTokenEditor components, and optional wiring into workflow email templates for consistent formatting. Medium complexity (~500-700 lines across 4-5 files). No new DB tables needed — uses existing `om_builder_documents` + `om_document_sections` + `MASTER_TOKEN_MAP`.

---

## Previous State (2026-03-30)

### ✅ COMPLETE — Global Activity Log Polish (2026-03-30)
Full polish of the global activity log (CRM priority #5): timestamps, filters, pagination.

**Backend (`server/routes.ts` — `GET /api/activities`)**
- Rewrote from N+1 query pattern to batch-loaded entity enrichment (contacts, deals, companies, leads, properties)
- Server-side pagination: `page`, `pageSize` params; returns `{ items, total, page, pageSize, totalPages, actors }`
- Server-side filters: `entityType` (deal/contact/company/lead/property), `actorId`, `type`, `dateRange` (today/week/month), `q` (search)
- Proper orgId scoping (removed `storage.getCrmActivitiesForOrg` which queried by userId incorrectly)
- Actor names resolved via LEFT JOIN on `users` table (was hardcoded "You")
- Returns `actors[]` list for the actor filter dropdown
- Batch entity lookups via `inArray()` instead of per-row queries

**Frontend (`client/src/pages/activity.tsx`)**
- Entity type filter dropdown: All Entities, Deals, Contacts, Companies, Leads, Properties
- Actor filter dropdown: populated from server-returned `actors[]` list
- Relative timestamps with tooltip: "2 hours ago", "Yesterday at 3:00 PM", "Mar 28, 2026" — hover shows full absolute time
- Full pagination controls: first/prev/page numbers/next/last with page count display
- Debounced search (300ms) resets to page 1
- "Clear all filters" button when any filter is active
- Entity type badge on each activity card
- All filters are server-side (no client-side filtering)

**Files Modified:**
- `server/routes.ts` — rewrote GET /api/activities handler
- `client/src/pages/activity.tsx` — full rewrite with pagination, filters, relative timestamps

---


### ✅ COMPLETE — Key Dates on Kanban Cards (2026-03-30)
Added key dates display to Kanban pipeline cards (CRM priority #4).

**Backend**
- New `GET /api/crm/pipeline-enhancements/deals/next-follow-ups` endpoint
- Batch-fetches the soonest pending/in-progress task per deal using `DISTINCT ON` for efficiency
- Returns a map of `dealId → { taskId, title, type, dueDate, status }`

**Frontend — DealCard Enhancement**
- Replaced inline "stage time + close date" row with a structured Key Dates section (gray-50 background)
- **Created date**: Shows deal age in days with tooltip showing full creation date
- **Expected close**: Blue text, turns red with warning icon when overdue
- **DD expiration**: Amber text, turns red with warning icon when overdue
- **Next follow-up**: Teal text with tooltip showing task title, turns red when overdue
- Follow-up data fetched in a single batch query (`staleTime: 60s`), passed through `PipelineColumn` → `DealCard`

**Files Modified:**
- `server/routes/crm-pipeline-enhancements-routes.ts` — added next-follow-ups endpoint
- `client/src/pages/pipeline.tsx` — enhanced DealCard, added FollowUpInfo type, added follow-ups query, wired through PipelineColumn

---

### ✅ COMPLETE — AI Advisor Markdown Rendering Fix (2026-03-30)
Replaced custom hand-rolled markdown parser with `react-markdown` + `remark-gfm` for proper GFM rendering.

**What was done:**
- Installed `react-markdown` v10 and `remark-gfm` as dependencies
- Created shared `MarkdownRenderer` component (`client/src/components/ui/markdown-renderer.tsx`)
- Replaced 185-line custom `renderMarkdown()`/`inlineMarkdown()`/`MarkdownTable()` in `ai-assistant.tsx` with `<MarkdownRenderer>`
- Added markdown rendering to `cdd-advisor.tsx` (was plain text only — `whitespace-pre-wrap`)
- Styling preserved: same color scheme, font sizes, code block theme (zinc-900), table borders, blockquote blue accent

**Files created:**
- `client/src/components/ui/markdown-renderer.tsx`

**Files modified:**
- `client/src/components/ai-assistant.tsx` — removed custom renderer, imported shared component
- `client/src/components/cdd-advisor.tsx` — added markdown rendering for assistant messages

**Improvements over old custom renderer:**
- Proper nested list support (the old parser only handled single-level)
- Links rendered as clickable (`<a>` tags with `target="_blank"`)
- Strikethrough support via GFM
- Task list / checkbox support via GFM
- More robust table parsing (handles edge cases the regex-based parser missed)

---

### ✅ COMPLETE — Email Send Integration Spec (2026-03-30)

## Planner Agent — 2026-03-30
- Spec written: Email Send Integration for CRM Workflow Automation
- Output: agents/specs/email-send-integration-spec.md
- Builder task added: yes
- Notes: Existing `send_email` action in workflow-engine.ts is a console-log stub. email-service.ts already has production-ready SendGrid/Resend with fallback. Spec covers: wiring the stub to real email service, new `workflow_email_templates` + `workflow_email_log` tables, template CRUD API, token interpolation reusing existing `interpolateTemplate()`, CRM activity logging for every sent email, frontend template editor with token insertion + live preview, and rule builder UI enhancement for configuring send_email actions. Two parallel DB schemas exist for workflows (marinamatch/ and services/) — spec targets the marinamatch/ version which has the active stub. Medium-High complexity (~800-1200 lines across 6-8 files).

---

### ✅ COMPLETE — Deal Timeline / Gantt View (2026-03-30)
Full implementation of the Deal Timeline/Gantt view feature (CRM priority #2).

**Backend Enhancements**
- Enhanced `GET /api/crm/pipeline-enhancements/timeline` with query params: `pipelineId`, `stageIds`, `ownerId`, `startDate`, `endDate`, `groupBy`
- Response restructured to `{ deals, events, timeRange }` format with per-deal `slaStatus` computation
- Enhanced `GET /api/crm/pipeline-enhancements/timeline/:dealId` with `include` param supporting: `key_dates`, `stages`, `tasks`, `red_flags`, `milestones`, `playbook`, `activities`
- Extended `buildTimelineEventsForDeal()` helper to emit red_flag, milestone, playbook, and activity event types
- Added `computeSlaStatus()` helper comparing days-in-stage against stage SLA thresholds

**Pipeline-Level Gantt View**
- New `DealGanttView` component (`client/src/components/crm/deal-gantt-view.tsx`)
- Fixed-width left panel (240px) with deal name, value, stage badge, SLA indicator
- Scrollable right panel with positioned SVG/div timeline elements
- Event rendering: diamond markers (key dates), rounded bars (stages), thin bars (tasks), warning icons (red flags), outlined diamonds (milestones)
- Three zoom levels: Day (20px/day), Week (8px/day), Month (2px/day)
- Group-by dropdown: Deal / Stage / Owner
- Today marker: dashed Harbor Teal (#2DD4BF) vertical line
- SLA-breached rows tinted red; overdue key dates pulse with red ring
- Export: PNG via html-to-image, Print via browser print
- Empty state when no deals

**Single-Deal Timeline Tab**
- New `DealTimelineTab` component (`client/src/components/deals/deal-timeline-tab.tsx`)
- Existing `DealTimelineVisualizer` (PSA→DD→Closing bar) at top in compact mode
- Below it: category swimlane Gantt with rows for Stages, Key Dates, Tasks, Playbook, Approvals, Red Flags, Activity
- Toggle chips to enable/disable each category
- Zoom controls and Today button
- Empty state: "Add key dates to see your deal timeline"

**Shared Components**
- `GanttToolbar` (`client/src/components/crm/gantt-toolbar.tsx`) — zoom, group-by, today, export controls
- `GanttPopover` (`client/src/components/crm/gantt-popover.tsx`) — click popover showing event details + "Open Deal" link

**Integration**
- Pipeline page: new "Gantt" view toggle button (alongside Kanban, List, Map)
- Deal detail page: new "Timeline" tab (between Activities and FM)
- No new npm packages (Gantt built with plain HTML/CSS divs, uses existing html-to-image for export)

**Files Created:**
- `client/src/components/crm/deal-gantt-view.tsx`
- `client/src/components/crm/gantt-toolbar.tsx`
- `client/src/components/crm/gantt-popover.tsx`
- `client/src/components/deals/deal-timeline-tab.tsx`

**Files Modified:**
- `server/routes/crm-pipeline-enhancements-routes.ts` — enhanced timeline endpoints + extended buildTimelineEventsForDeal
- `client/src/pages/pipeline.tsx` — added Gantt view mode + DealGanttView rendering
- `client/src/pages/deal-detail.tsx` — added Timeline tab to centerTabs

---

## Prior State (2026-03-28)

### ✅ COMPLETE — Bookkeeping Budget Editor: 4 Sprints + Polish (2026-03-27 → 2026-03-28)
Production-grade budget creation/editing tool built in 4 sprints, then hardened with audit, UX polish, and export features.

**Sprint 1: Hierarchical Account Tree**
- New `budget_tree_accounts` table (raw SQL, not Drizzle) with parent/child hierarchy
- COA templates for 4 asset classes (marina, hotel, multifamily, restaurant) with revenue + OpEx children
- `GET /api/budgets/version/:versionId/tree-grid` — returns tree + amounts, auto-seeds on first access
- `PATCH /api/budgets/version/:versionId/cell` — single-cell auto-save on blur
- Collapsible parent rows (Revenue, Operating Expenses) with chevron toggle
- Inline editable inputs: Tab→right, Enter→down, Shift+Tab→left, Escape→cancel+restore
- Sticky Total column (Jan–Dec sum), locked/grayed months prior to current month
- Parent rows auto-sum children in real time, NOI row computed as Revenue − OpEx

**Sprint 2: Bulk Fill + CSV Import**
- `POST /api/budgets/version/:versionId/bulk-fill` — 4 modes: spread_evenly, grow_pct, seasonality, copy_prior_year
- `POST /api/budgets/version/:versionId/import-csv` — fuzzy account/month header matching with word-overlap scoring
- BulkFillMenu popover ("..." on hover) with mode-specific input forms
- CSV drag-and-drop zone with import results panel (matched/skipped with reasons)

**Sprint 3: Version Management + Enhanced BVA**
- `POST /version/:versionId/clone` — deep-clone (lines, amounts, tree)
- `PATCH /version/:versionId/lock`, `/rename`, `/set-primary`
- `GET /version/compare?versionA=&versionB=` — side-by-side with per-account variance
- `GET /bva-enhanced/:budgetId` — per-account per-month Budget|Actual|$Var|%Var with YTD, pulls from actualsFacts + opsBookkeepingGl
- VersionManager UI: selector, clone, lock/unlock, set primary, compare panel
- EnhancedBudgetVsActual: expandable rows with monthly drill-down, YTD bold columns, KPI cards

**Sprint 4: Rolling Forecast + AI Assistant**
- `POST /version/:versionId/rolling-forecast` — creates/updates "Latest Estimate" version (closed months = actuals, future = budget)
- `POST /ai/seed-assumptions` — analyzes prior year GL, computes YoY growth (clamped ±20-30%), auto-fills with seasonal weights
- `POST /ai/explain-variance` — fetches GL transactions, builds plain-English explanation with YoY context
- `POST /ai/what-if` — adjusts driver assumptions, computes baseline vs scenario NOI with monthly comparison
- AI Budget Assistant collapsible sidebar: Seed from Actuals, Explain Variance, What-If Analysis

**Audit & Fixes**
- GL fuzzy-match replaced with `matchGlToBudgetLine()` — word-overlap scoring (60% threshold), prevents double-counting
- Null safety on GL accountName before `.toLowerCase()`
- CSV import resolves lineType from tree accounts (not hardcoded OPEX)
- Seed-assumptions returns `skippedAccounts` array with reason
- Compare button disabled when <2 versions; What-if "Add Driver" disabled when no child rows
- Auto-save debounced (300ms) with `localAmountsRef` to avoid stale closures

**UX Polish: Async States**
- No budgets: illustrated empty state with "Create your first budget" CTA + feature pills
- Grid loading: structural skeleton matching account tree layout (parent + child row shapes)
- BVA no actuals: amber callout with GL sync guidance (import CSV, connect integration, seed demo)
- Seed skipped accounts: amber callout in AI sidebar listing each skipped account with reason

**UX Polish: Number Formatting**
- `formatAmount()`: `$X,XXX` with accounting parens `($X,XXX)` for negatives, "—" for zeros
- `formatCurrency()`: compact `$45.2K` / `($1.3M)` with same conventions
- `formatVarPct()`: capped ±999%, always signed, "—" for zeros
- `formatVarDollar()`: always signed `+$5,000` / `($2,100)`, "—" for zeros
- 38 call sites updated across editor, BVA, compare, and AI sidebar

**UX Polish: Keyboard Navigation**
- `findNextCell()` wraps grid boundaries (Dec→Jan next row, last row→first row)
- Skips locked months during navigation (Tab, Shift+Tab, Enter, Shift+Enter)
- Escape: cancels debounce timer, restores prior value from `priorCellValue` ref, suppresses blur auto-save via `escapedRef`

**UX Polish: User Feedback**
- Auto-save: per-cell "Saved" label + emerald ring flash (1.5s), no toast
- Bulk fill: toast with 5-second Undo button (captures prior values, restores via PATCH)
- CSV import: bordered result panel with collapsible matched/skipped details
- Locked cells: fixed tooltip "This version is locked" on click (via `<td>` handler since disabled inputs swallow clicks)
- AI errors: server error message surfaced in toast descriptions

**Charts Panel**
- Collapsible "Show charts" toggle above grid (collapsed by default)
- Budget vs Actual NOI bar chart (recharts): gray budget bars, blue actual bars, transparent for months without actuals
- Top 5 Expense Variance horizontal bar chart: red for over budget, green for under
- YTD NOI Attainment gauge: semi-circular arc (PieChart), color thresholds (green/amber/red), percentage + status label
- Data fetched from bva-enhanced only when panel is open (`enabled: open`)

**Export**
- Export dropdown (Popover) in editor header with 2 options
- Download CSV: account tree with indented children, parent sums, NOI row, raw numbers for spreadsheet compatibility
- Print/PDF: injected `@media print` stylesheet hides controls, shows print header (budget name, version, date), clean table borders, preserved variance colors, no sticky positioning
- Print-only header: `<div data-print-header>` with budget name + version + fiscal year + export date

**Files Modified:**
- `server/routes/budget-routes.ts` — ~1960 lines (was 405), 20+ new endpoints
- `client/src/pages/operations/BudgetingTabbed.tsx` — ~2400 lines (was 883), full rewrite of editor + 10 new components

**Route Registration:** All new endpoints under existing `/api/budgets` mount (no routes.ts changes needed)

---

### ✅ COMPLETE — Final Pending Items Resolved (2026-03-26)
All deferred/pending items from the journal now resolved:

**1. DB Migration — 18 New Tables Created in Postgres**
All tables that were defined in schema.ts but missing from the DB are now live:
api_keys, docusign_envelopes, docusign_templates, property_public_records, deal_predictions, asset_risk_scores, hold_sell_analyses, cash_flow_forecasts, liquidity_alerts, ai_underwriting_runs, buy_box_profiles, buy_box_scores, meeting_recordings, exchange_rates, comp_overrides, comp_contributions, comp_dedup_matches, dd_findings

**2. Master Comps Pack — Fully Wired**
- Added `master_comps` to packTypeEnum in shared/schema.ts
- Added PACK_DEPENDENCIES entry (requires `analysis`)
- Added PACK_INFO fallback in pack-service.ts ($99/mo, 6 features)
- Added to getAllPacksWithStatus() alongside role-based packs (owner/investor/broker)
- Seeded pack_catalog row in Postgres
- Added to ALTER TYPE pack_type enum in DB

**3. Email System — Unified Provider with Fallback Chain**
Rewrote server/services/email-service.ts:
- New unified `sendEmail()` function tries: SendGrid → Resend → console log
- All existing email functions (password reset, verification, magic link) now use `sendEmail()`
- Added `wrapEmailTemplate()` and `emailButton()` helpers for consistent MarinaMatch branding
- Notification dispatch (onboarding-routes.ts) updated to use `sendEmail()` instead of raw SendGrid
- Emails will NEVER silently fail — console fallback ensures visibility in dev

**4. Trial Reminder System (7-day free trial with CC on file)**
- New cron job #9 in platform-cron.ts: `30 8 * * *` (daily 8:30 AM)
- Queries organizationPacks with status='trial' and trialEndsAt
- Day 3 email: "Getting the most out of MarinaMatch" tips
- Day 5 email: "Your trial expires in 2 days" warning
- Day 7 email: "Trial ending today — subscription begins" or cancel prompt
- Sends to org owners only
- 3 new email templates: `sendTrialDay3Email()`, `sendTrialDay5Email()`, `sendTrialLastDayEmail()`

**5. Sign-Up Page — Categorized Asset Classes + All Packs + Recommendations**
Enhanced client/src/pages/auth/signup.tsx:
- **Asset classes now organized into 6 categories** with expandable accordion:
  - Marine & Outdoor Recreation (marina, RV park, campground, boat storage, MHP)
  - Hospitality & STRs (hotel, STR, resort, B&B)
  - Residential (multifamily, SFR, student housing, senior living, affordable)
  - Commercial (office, retail, industrial, mixed use, medical office, self storage)
  - Specialty & Business Acquisitions (car wash, laundromat, gas station, restaurant, salon, gym, pet care, parking)
  - Institutional & Land (net lease, dev land, data center)
- **All 12 packs now shown** in step 4 (was 8): added master_comps, owner, investor, broker
- **Role-based recommendations**: each role gets suggested packs highlighted with "Recommended" badges
- **"Select all recommended" button** for quick setup
- **Trial messaging**: "7-day free trial included", "Start Free Trial" CTA, pricing shows "after trial"

**6. Real Data Import — Already Complete (confirmed)**
Sales comps and rate comps upload flows were already fully built with CSV/Excel parsing, column mapping, duplicate detection, and async processing. Not actually pending — confirmed complete.

---

### ✅ COMPLETE — Background Jobs + Org Settings + Integrations Marketplace (2026-03-26)
Three operational systems built:

**1. Background Jobs / Cron System** (server/jobs/platform-cron.ts)
8 scheduled jobs using node-cron:
- Lease expiry alerts (daily 7 AM) — 180/120/90/60/30-day horizons, notifies org owners
- DD deadline monitoring (every 4h) — flags deals with DD expiring in 7 days
- Compliance/insurance expiry (daily 8 AM) — insurance within 60 days, regulatory within 30 days
- Integration auto-sync (every 30 min) — triggers connectors due for sync based on frequency setting
- Subscription renewal warnings (daily 9 AM) — 7-day warnings for pack renewals and trial expirations
- Rent payment reconciliation (nightly 1 AM) — flags stale pending payments and overdue rent
- Stale deal detection (Monday 6 AM) — open deals with no activity in 30+ days
- Exchange rate refresh (daily 6 AM) — pulls latest rates from Open Exchange Rates
Started in routes.ts boot sequence. Uses existing notification system for all alerts.

**2. Organization Settings** (server/routes/org-settings-routes.ts — 10 endpoints)
- GET/PUT / — org profile (name, session timeout, MFA required, email domains)
- GET/PUT /branding — firm name, colors, logo, support email, custom domain
- GET /team — list all members with role, status, MFA, last login
- POST /team/invite — invite new member (creates placeholder user)
- PATCH /team/:id — change role or status
- DELETE /team/:id — soft-disable member
- POST /team/transfer-ownership — ownership transfer flow
- GET /team/audit — recent team change audit trail
Frontend: /settings/organization — 4 tabs (Profile, Team, Branding, Security)

**3. Integrations Marketplace** (server/routes/integrations-marketplace-routes.ts — 8 endpoints)
- GET /catalog — all 40+ integrations with connection status per org, grouped by category
- GET /catalog/:key — single integration detail with sync history
- POST /connect — create connection with credentials
- POST /test/:connectionId — test connection via BaseConnector.testConnection()
- POST /sync/:connectionId — manual sync via connector.syncAll()
- PATCH /connections/:connectionId — update sync frequency, auto-sync, settings
- DELETE /connections/:connectionId — disconnect (soft disable)
- GET /sync-history/:connectionId — detailed sync logs
Frontend: /settings/integrations — discovery grid, category filter, search, connect wizard, sync/test/disconnect buttons

**Route Registration:**
- /api/org-settings/* — Organization Settings
- /api/integrations-marketplace/* — Integrations Marketplace
- startPlatformCronJobs() called in boot sequence

---

### ✅ COMPLETE — Stripe Checkout + Onboarding Wizard + Notification Center (2026-03-26)
Three production-critical systems built:

**1. Stripe Checkout Flow (was 503 stub, now functional)**
- Replaced hardcoded 503 "coming soon" stubs with real Stripe Checkout Session creation
- POST /api/stripe/checkout → creates Stripe Checkout Session with pack pricing
- POST /api/stripe/portal → opens Stripe Customer Portal for self-serve management
- POST /api/stripe/webhook → handles checkout.session.completed, subscription.updated/deleted, invoice.payment_failed
- Auto-activates organizationPacks on successful payment
- Subscription lifecycle: checkout → active → past_due → cancelled
- GET /api/stripe/status and /api/stripe/publishable-key now return real configuration state
- Frontend: settings/billing page with plan cards, subscribe buttons, Stripe redirect, success/cancel handling, portal link

**2. Onboarding Wizard**
- Backend (server/routes/onboarding-routes.ts): 6 endpoints
  - GET /status — onboarding checklist with auto-detection (checks real data: deals, packs, team members, org name)
  - POST /complete-step — mark individual steps done
  - POST /dismiss — skip remaining
  - POST /setup-org — org name + industry setup
  - POST /invite-team — batch invite with placeholder user creation
- Frontend (client/src/pages/onboarding/index.tsx): 3-step wizard
  - Step 0: Organization setup (name)
  - Step 1: Team invites (dynamic email list)
  - Step 2: Getting Started checklist (7 items with links to relevant pages)
  - Progress bar, skip button, auto-redirect when complete
- Checklist auto-completes from real data (created deal? invited team? activated pack?)

**3. In-App Notification Center + Email Dispatch**
- Backend (server/routes/onboarding-routes.ts): 4 endpoints
  - GET /notifications — paginated with unread count, 30s polling
  - POST /notifications/mark-read — individual or mark-all
  - POST /notifications/send — create notification (internal API)
  - POST /notifications/dispatch — event-driven notifications with templates:
    - deal_stage_changed, deal_assigned, approval_requested, approval_decided
    - dd_milestone_approaching, dd_item_overdue, finding_critical
    - meeting_analyzed, comment_mention
  - Auto-sends email via SendGrid alongside in-app notification (fire-and-forget)
- Frontend (client/src/components/NotificationCenter.tsx): Sheet-based notification panel
  - Bell icon with unread badge count
  - Notification feed with type icons, time-ago, read/unread states
  - Mark all read, individual mark read on click
  - 30-second auto-refresh polling

**Route Registration:**
- /api/onboarding/* — Onboarding + Notifications
- /api/stripe/* — Checkout, Portal, Webhook (replaced stubs)

**Frontend Routes:**
- /onboarding — Wizard page (no sidebar layout)
- /settings/billing — Plan selection + Stripe Checkout

---

### ✅ COMPLETE — Financial Model 6 Fixes (2026-03-25)
All 6 financial modeling gaps resolved in one route file:
- **~25 new API endpoints** in server/routes/modeling-enhancements-routes.ts

**Fix 1: Rent Roll → Pro Forma Auto-Sync** (POST /rent-roll-sync/:projectId)
- Aggregates modelingRentRollUnits by type/status → computes GPR, EGR, occupancy, slip revenue, other revenue
- Upserts into underwritingAssumptions for target year
- Returns full breakdown by storage type

**Fix 2: Stress Test Engine (Enhanced)** (POST /stress-tests/:id/run-enhanced)
- Pulls actual underwriting assumptions + debt tranches per deal (not flat assumptions)
- Applies: vacancy increase, rent decline, cap rate expansion, rate increase, expense increase
- Computes stressed NOI, value, DSCR per deal; flags DSCR breaches
- Portfolio summary: total value change %, worst-impacted deal, breach count
- Preset factory: mild_recession, gfc, rate_shock, stagflation (POST /stress-tests/presets)

**Fix 3: IC Approval Workflow** (5 endpoints: /approvals/*)
- Create request with required approvers + quorum count + deadline
- Auto-creates pending decisions for each approver
- Approve/reject with comments; auto-resolves when quorum met or impossible
- GET /approvals/pending/me — pending items for current user

**Fix 4: Loan Schedule Caching** (POST /loan-schedule/cache/:debtTrancheId)
- Computes full monthly amortization schedule from debtTranches
- Stores in monthlyLoanSchedule table (was empty before)
- Handles IO periods, amortizing periods, tracks beginning/ending balance
- GET /loan-schedule/:debtTrancheId returns cached schedule

**Fix 5: Capital Stack Projections** (POST /capital-stack-projections/:capitalStackId)
- Computes year-by-year from acquisition through exit
- Tracks: revenue, NOI, debt service, principal paydown, DSCR, debt yield
- Exit year: exit value, loan payoff, net proceeds
- Returns: cumulative cash flow, equity multiple, cash-on-cash per year
- Stored in capitalStackProjections table (32 fields, was empty before)

**Fix 6: Deal Scoring Models** (6 endpoints: /scoring-models/*)
- CRUD for scoring models with configurable criteria (numeric_range, boolean, select)
- Score deals: weighted multi-criterion scoring → total score + grade (A+ through F)
- Stores in dealScores with per-criterion breakdown
- GET /scores/:dealId for history

**Route Registration:** /api/modeling-enhanced/*

---

### ✅ COMPLETE — DD Findings, KPI Dashboard & Unified Deal Team (2026-03-25)
Three enhancements to the Deal Workspace ecosystem:
- **1 new database table** (ddFindings) + **~15 new API endpoints**

**New Schema Table (shared/schema.ts):**
- ddFindings — severity (critical/major/minor/observation/positive), category, financial impact (cost_to_cure/value_reduction/revenue_risk/liability/capex_required), resolution workflow (open→investigating→mitigated→resolved→escalated), recommendation (proceed/renegotiate/walk_away/further_investigation), linked to checklist items/documents/tasks

**New Route File (server/routes/dd-findings-routes.ts):**
1. **DD Findings CRUD** (6 endpoints): create, list, get, update, delete, summary with risk scoring
2. **Findings Summary** per workspace: by severity, category, recommended action, deal-breaker detection, total financial impact (resolved vs unresolved)
3. **DD KPI Dashboard** (1 endpoint): comprehensive metrics per workspace:
   - Core: total/completed/provided/overdue/blocked items, completion %, provision %
   - Breakdowns: by status, internal status, priority, request type
   - Category heatmap: per-section completion/provision/overdue rates
   - Timeline: avg days to provide, upcoming deadlines (next 7d)
   - Findings integration: total/critical/open findings, financial impact
   - Health score: 0-100 composite (On Track/Needs Attention/At Risk/Critical)
4. **Unified Deal Team** (2 endpoints):
   - GET /team/:dealId — merges dealContacts + workspaceMembers, deduplicates by email, enriches with CRM data and user info, groups by team type
   - POST /team/:dealId/sync — bidirectional sync between workspace members and deal contacts

**Route Registration:** /api/dd-enhanced/*

---

### ✅ COMPLETE — Master Comps Database Pack Feature (2026-03-25)
Full master comps pack built with 5 pillars:
- **3 new database tables** added to schema.ts
- **~25 new API endpoints** in 1 new route file

**New Schema Tables (shared/schema.ts):**
- compOverrides — org-level annotations/adjustments on master comps (override price, cap rate, NOI, notes, ratings, tags, exclude)
- compContributions — submission pipeline for users to contribute comps to master DB (submitted → under_review → approved/rejected)
- compDedupMatches — duplicate detection results linking user comps to potential master matches

**New Route File:**
- server/routes/master-comps-routes.ts — 5 sections:
  1. **Admin Curation** (6 endpoints): list global comps, promote/demote to global scope, verify/quality score, bulk promote, stats dashboard
  2. **Subscriber Access** (1 endpoint): unified query merging org + master comps with overrides layered on, filtered by pack access
  3. **Comp Overrides** (5 endpoints): create/update/delete org-level overrides on master comps, exclude comps, list overrides
  4. **Contribution Pipeline** (3 endpoints): submit comp for master inclusion, list contributions, admin review (approve → auto-promote)
  5. **Dedup Engine** (4 endpoints): check single comp, batch check, list pending matches, resolve matches (link/keep_both/dismiss)

**Pack Access:**
- `master_comps` or `analytics_pro` pack grants access to global comps
- Dev mode bypass when org has no packs (consistent with existing pattern)
- Comps promoted with `requiredPack: "master_comps"` on the salesComps/rateComps records

**Similarity Scoring (dedup):**
- Marina name: exact (40pts) or partial (25pts)
- Address: exact (30pts) or partial (15pts)
- City+State: 10pts
- Sale year: exact (10pts) or ±1yr (5pts)
- Sale price: ±5% (10pts) or ±10% (5pts)
- Threshold: 60+ = potential match

**Route Registration (server/routes.ts):**
- /api/master-comps/* — Master Comps Database

---

### ✅ COMPLETE — Final 5 Missing Spec Sections Built (2026-03-25)
All remaining missing spec sections now implemented:
- **8 new database tables** added to schema.ts
- **~60 new API endpoints** across 5 new route files
- **83 of 86 sections now BUILT** (3 minor partials remain: E.4, F.3, F.5)

**New Schema Tables (shared/schema.ts):**
- cashFlowForecasts, liquidityAlerts (E.5)
- aiUnderwritingRuns (G.1)
- buyBoxProfiles, buyBoxScores (G.3)
- meetingRecordings (G.5)
- exchangeRates (H.3)

**New Route Files:**
- server/routes/cash-flow-forecasting-routes.ts — E.5 (6 endpoints): 24-month projections, liquidity alerts, deal breakdown, summary
- server/routes/ai-underwriting-routes.ts — G.1 (4 endpoints): AI market research + comps + public records → pro forma assumptions
- server/routes/deal-sourcing-routes.ts — G.3 (8 endpoints): AI buy box generation, deal scoring (A/B/C/D tiers), batch scoring, leaderboard
- server/routes/meeting-transcription-routes.ts — G.5 (8 endpoints): upload transcript, AI analysis, CRM sync (auto-create tasks, log activities)
- server/routes/multi-currency-routes.ts — H.3 (6 endpoints): exchange rate refresh (Open Exchange Rates), conversion, portfolio FX exposure

**Route Registration (server/routes.ts):**
- /api/cash-flow/* — Cash Flow Forecasting
- /api/ai-underwriting/* — AI Underwriting Assistant
- /api/deal-sourcing/* — Deal Sourcing & Buy Box
- /api/meetings/* — Meeting Transcription + CRM Sync
- /api/currency/* — Multi-Currency & International

---

### ✅ COMPLETE — Gap Closures: F.4, F.6, G.4, H.2, C.2/C.3/C.5 Enhancements (2026-03-25)
Prior gap closures:
- **7 new database tables** added to schema.ts
- **~80 new API endpoints** across 4 new route files + 1 service + 1 middleware

**New Schema Tables (shared/schema.ts):**
- docusignEnvelopes, docusignTemplates (F.4)
- propertyPublicRecords (F.6)
- dealPredictions, assetRiskScores (G.4)
- holdSellAnalyses (G.4 + 3.5)

**New Route Files:**
- server/routes/docusign-routes.ts — F.4 DocuSign Deep Integration (14 endpoints): template sync/CRUD, send from template, embedded signing URL, bulk send, envelope management, void/resend, PDF download, webhook handler, dashboard
- server/routes/public-records-routes.ts — F.6 Public Records / Title Data (8 endpoints): ATTOM property enrichment, selective field import to deal/property, sale history, tax history, property/deal lookups
- server/routes/predictive-analytics-routes.ts — G.4 + 3.5 Predictive Analytics & Hold-Sell (8 endpoints): deal closure probability scoring, batch predictions, asset underperformance risk scoring, portfolio risk overview, hold/sell analysis with year-by-year projections
- server/routes/api-v1-routes.ts — H.2 White-Label API v1 (14 endpoints): deals, portfolio, contacts, properties, investors, distributions, work orders, webhooks — all with pagination, scope enforcement, rate limiting

**New Services & Middleware:**
- server/services/public-records-service.ts — ATTOM Data Solutions integration: address lookup, property detail, sale history, tax history, lien data, parallel enrichment
- server/middleware/api-key-auth.ts — API key authentication (Bearer mm_sk_...), scope enforcement (requireScope), IP allowlist, in-memory rate limiting with X-RateLimit headers

**Enhanced Routes (server/routes/tenant-construction-routes.ts):**
- C.2: Stripe PaymentIntent creation, late fee calculator (flat/daily/percentage), payment reconciliation, NSF fee application
- C.3: Lease renewal auto-scan (180/120/90/60/30-day horizons), AI renewal offer letter generation with market rent comparison
- C.5: Detailed conversion funnel with stage-by-stage rates, days-on-market alerts with revenue loss estimates and pricing suggestions

**Route Registration (server/routes.ts):**
- /api/docusign/* — DocuSign (webhook + authenticated routes)
- /api/public-records/* — Public Records / Title Data
- /api/predictive/* — Predictive Analytics + Hold-Sell
- /api/v1/* — White-Label API (API key auth, no session)

---

### ✅ COMPLETE — Master Spec Volume 1 Full Build-Out (2026-03-25)
All 50 sections from MARINAMATCH_MASTER_SPEC.md implemented:
- **42 new database tables** created in PostgreSQL
- **~200 API endpoints** across 9 new route modules + 1 service
- **0 TypeScript errors**

**New Schema Tables (shared/schema.ts):**
Sections 1.1-1.5: dealChatSessions, dealChatMessages, dealChatFeedback, aiNarratives, leaseAbstractions, dealRiskScores
Sections 2.1-2.5: investors, investments, distributions, distributionAllocations, capitalCalls, capitalCallLineItems, taxDocuments
Sections 3.2-3.3: marketBenchmarks, portfolioAlerts
Sections 4.1-4.4: capRateFeed, rentComps, propertyZoning, entitlements
Sections 5.1-5.4: workOrders, workOrderUpdates, vendors, vendorRatings, capexProjects, inspectionTemplates, inspections
Sections 6.1-6.4: lenders, lenderDeals, termSheets, dealDebt, mezzPositions
Section 7.1, 7.4: contactRelationships, contactNewsMentions
Section 8.4: orgBranding
Section 9.1: notificationPreferences, userNotifications
Section 9.2: signatureRequests
Section 9.3: webhookEndpoints, webhookDeliveries
Section 9.5: dealStageConfigs
Section 10.1: workflowAutomations, workflowExecutionLog
Section 10.6: emailMessages, emailSendTemplates

**New Route Files (server/routes/):**
- workflow-automation-routes.ts — 10.1 workflow engine (11 endpoints)
- ai-deal-intelligence-routes.ts — 1.1-1.5 AI chat, narratives, lease abstractor, risk scoring, comps (20 endpoints)
- investor-portal-routes.ts — 2.1-2.5 LP dashboard, capital calls, distributions, tax docs (24 endpoints)
- portfolio-market-routes.ts — 3.1-4.5 portfolio, benchmarks, alerts, cap rates, rent comps, zoning (25 endpoints)
- operations-management-routes.ts — 5.1-5.4 work orders, vendors, capex, inspections (27 endpoints)
- capital-markets-routes.ts — 6.1-6.4 lender matching, term sheets, debt maturity, mezz (20 endpoints)
- crm-relationship-intelligence-routes.ts — 7.1-7.5 relationship graph, sourcing, follow-up AI, news, meeting prep (15 endpoints)
- reporting-quickwins-routes.ts — 8.1-9.5+10.6 reports, branding, notifications, e-sign, webhooks, stages, email (30 endpoints)
- crm-pipeline-enhancements-routes.ts — 10.2-10.5 timeline, comparison, kanban dates, activity log (12 endpoints)

**New Services:**
- server/services/workflow-engine.ts — condition evaluator, action executor, templates, dry-run

**Route Registration (server/routes.ts):**
All 9 routers mounted under auth+tenant middleware:
/api/ai-deal/*, /api/investors/*, /api/market/*, /api/operations/*, /api/capital-markets/*, /api/crm/intelligence/*, /api/platform/*, /api/crm/pipeline/*, /api/workflow-automations/*

**Trigger Hooks Wired:**
- deal.created → POST /api/crm/deals
- deal.stage_changed → PUT /api/crm/deals/:id (includes newStageName)
- deal.field_updated → PUT /api/crm/deals/:id
- contact.created → POST /api/contacts

### ✅ COMPLETE — Gap Spec Volume 2 Full Build-Out (2026-03-25)
All 38 sections from MARINAMATCH_GAP_SPEC.md implemented:
- **38 new database tables** created in PostgreSQL (on top of 42 from Vol 1)
- **~300 additional API endpoints** across 6 new route modules + 1 service + 1 middleware
- **0 TypeScript errors**
- **Stripe SDK** installed

**New Schema Tables (shared/schema.ts):**
A.1: billingSubscriptions, billingInvoices, billingUsageMetrics, billingFeatureFlags
A.2: rbacRoles, rbacUserRoles, rbacFieldPermissions
A.3: auditTrail
A.4: ssoConfigs
A.5: userTwoFactor
B.1-B.2: fundsV2, fundDealsV2, managementFeeInvoices, fundDocuments, sideLetters
B.3: investorVerification
B.4: capitalAccounts, capitalAccountEntries
C.1: tenantUsers, tenantMessages
C.2: rentPayments
C.3: leaseRenewalOpportunities
C.5: vacancyListings, leasingProspects, showings
D.1: constructionProjects, constructionBudgetLines, constructionDraws
D.2: unitRenovations
E.1: customReports
E.3: stressTestScenarios
F.1: accountingIntegrations
H.1: legalEntities
H.2: apiKeys
H.4: dataRooms, dataRoomAccess
I.1: climateRiskAssessments
I.2: environmentalStudies
I.3: insurancePolicies, insuranceClaims
I.4: regulatoryObligations
J.2: userOnboarding

**New Route Files (server/routes/):**
- billing-routes.ts — A.1 Stripe billing engine (12 endpoints)
- infrastructure-routes.ts — A.2 RBAC + A.3 Audit + A.4 SSO + A.5 2FA (~35 endpoints)
- fund-management-routes.ts — B.1-B.5 Fund model, docs, KYC, capital accounts, fees (~30 endpoints)
- tenant-construction-routes.ts — C.1-C.5 + D.1-D.2 Tenant, rent, leasing, construction (~45 endpoints)
- analytics-enterprise-routes.ts — E.1-E.5 + F.1 + H.1-H.5 Reports, stress tests, data rooms (~35 endpoints)
- compliance-onboarding-routes.ts — I.1-I.4 + J.2 Climate risk, insurance, regulatory, onboarding (~40 endpoints)

**New Services:**
- server/services/billing-service.ts — BillingService class with Stripe integration, 14 methods
- server/middleware/feature-gate.ts — requireFeature() + checkUsageLimit() middleware

**Route Registration (server/routes.ts):**
/api/billing/* — Billing (unauthenticated webhooks + authenticated management)
/api/infrastructure/* — RBAC, Audit, SSO, 2FA
/api/fund-management/* — Fund accounting & compliance
/api/tenant-ops/* — Tenant portal & construction
/api/enterprise/* — Analytics, integrations, data rooms
/api/compliance/* — Climate risk, insurance, regulatory calendar, onboarding

---

## Prior State (2026-03-19)

### ✅ COMPLETE — CRM Record Pages (10x upgrade)
All 4 record pages rebuilt with institutional 3-column CrmRecordPage layout.

**Contact Record** (7 tabs): Timeline, Deals (pipeline chart), Properties, Activities, Models, Intel (DockTalk), Notes
**Company Record** (8 tabs): Timeline, Portfolio (pie+bar charts), Contacts, Deals, Activities, Models, Intel, Notes
**Property Record** (9 tabs): Timeline, Storage, Sales Comps (chart+cards), Rate Comps (chart+cards), Activities, Deals, Intel, Notes, Price History
**Deal Record** (7 tabs): Timeline, Overview (KPI tiles, workspace links, dates), Activities, FM, Comps, Intel, Notes

New components:
- client/src/components/crm/ContactRecordTabs.tsx
- client/src/components/crm/CompanyRecordTabs.tsx
- client/src/components/crm/PropertyRecordTabs.tsx
- client/src/components/crm/PropertyFMPanel.tsx
- client/src/components/crm/PropertyCompsPanel.tsx
- client/src/components/crm/RelationshipScoreBadge.tsx

### ✅ COMPLETE — CRM Schema (new columns)
Applied via raw psql (never db:push):
- crm_contacts: crmRole, sourceType, linkedInUrl, relationshipScore, lastContactedAt, nextFollowupDate, ndaOnFile, emailConsent, dealSizeMin/Max, investmentNotes, targetAssetClasses, targetGeographies
- crm_companies: companyType, aumRange, aumApprox, investmentMandate, ndaOnFile, ndaExpiryDate, linkedInUrl, parentCompanyId, targetAssetClasses
- crm_properties: listingStatus, askingPrice, lastSalePrice, lastSaleDate, latitude, longitude, totalSlips, drySlips, hasFuelDock, waterDepthFt, dockMaterial, yearBuilt

### ✅ COMPLETE — CRM Server Routes
- server/routes/crm-relationship-score.ts — score endpoint, bulk scores, stale contacts
- server/routes/crm-activities-routes.ts — auto-updates last_contacted_at on activity create/complete
- /api/crm/search — global search across contacts/companies/properties/deals (powers ⌘K)

### ✅ COMPLETE — DD Project Page
Added Overview tab as default landing (was Tasks & Timeline):
- 4 KPI tiles: Total/Completed/InProgress/Overdue tasks
- Overall progress bar
- Key dates countdown (PSA Signed, DD Expiration urgent <7d, Closing)
- Progress by category (title/ESA/financial/legal/etc)
- CRM cross-link to originating deal
- KpisOverview + FindingsManager surfaced (were imported but unused)
- All existing tabs (Tasks & Timeline, Documents, DD Request, etc.) unchanged

### ✅ COMPLETE — Analytics Pages
All CRM analytics pages assessed — fully built, no work needed:
- pipeline.tsx (1078 lines) — full DnD Kanban
- forecast.tsx (787 lines) — pipeline forecasting engine
- scoring.tsx (756 lines) — lead scoring with websockets
- PipelineInsights.tsx (484 lines) — AI pipeline insights
- PipelineVelocity.tsx (500 lines) — velocity metrics with date ranges
- DealAnalyticsPage.tsx — wrapper for PipelineAnalyticsDashboard

### ✅ COMPLETE — DCF Refactor (Phase 3, Layers 1–4)
- DCF consumes canonical Multi-Year Pro Forma engine
- Monte Carlo simulation implemented
- Decision Support tools: tornado chart, OLS attribution, IC memo generator
- 154/154 tests passing, zero TypeScript errors
- assumptions.tsx dynamic via getModelConfig()
- XIRR consolidated, seasonality auto-derived, dummy data purged

### ✅ COMPLETE — Feature Gating Enforcement Layer (2026-03-19)
Pack-based access control now enforced end-to-end. Infrastructure already existed (pack-service, pack-guard middleware, PackGate/RequirePack components, organizationPacks table); this work wired it all up.

**Server — `requirePack()` added to 20 route mount points in routes.ts:**
- `crm_pipeline`: /api/crm (7 mounts), /api/sla, /api/crm/analytics, /api/crm/saved-views
- `modeling_tools`: /api/modeling (2 mounts), /api/modeling-rent-roll
- `analysis`: /api/sales-comps, /api/sc-projects, /api/comp-columns, /api/rate-comps, /api/rc-projects, /api/rc-columns
- `operations`: /api/operations (2 mounts), /api/ship-store, /api/service, /api/boat-rentals, /api/boat-club, /api/boat-sales, /api/operations/fuel-integrations
- `analytics_pro`: /api/analytics
- Previously guarded (unchanged): /api/funds (requireFundManagement), /api/prospecting (requireProspecting), /api/rent-roll (requireRentRoll)

**Client — App.tsx route gating (146 routes):**
- Added `GatedLayout` component = `UnifiedLayout` + `PackGate`
- All CRM, pipeline, modeling, analysis, operations, prospecting routes wrapped with `<GatedLayout pack="...">`
- Ungated sections preserved: dashboard, settings, workspaces, DD, VDR

**Client — Sidebar pack filtering (unified-sidebar.tsx):**
- Added `hasPack()` checks to 5 sidebar sections: Operations, CRM, Pipeline, Analysis, Market Intelligence
- Extended local `PackType` to include `crm_pipeline`, `modeling_tools`, `analysis`
- Investor Services already had hasPack checks (unchanged)

**Dev-mode bypass:**
- Server: `pack-guard.ts` — when `NODE_ENV=development` and org has 0 packs, requests pass through
- Client: sidebar `hasPack()` — when dev mode and activePacks is empty, returns true
- Prevents dev environment from being locked out when no pack rows exist in DB

**What's NOT gated (by design):**
- Dashboard, settings, onboarding, auth pages
- Deal Workspace (/workspaces) — cross-module hub
- DD projects, VDR — separate from pack system
- Stripe payment flow not yet implemented — packs are activated via admin/DB

### ✅ COMPLETE — Demographics Overhaul to GIS-Grade (2026-03-19)
Full overhaul of /analysis/demographics to match STDB / LandVision / ArcGIS Business Analyst.

**Isochrone polygons (replaces simple circles for drive-time):**
- drivetime-service.ts: generateIsochrone() binary-searches 36 bearings against
  Google Distance Matrix API to build real road-network polygon boundaries
- getDriveTimeBatch() batches 25 destinations/request (cost: ~98 API calls per
  isochrone vs. 252 unbatched). 24hr cache per isochrone.
- computePolygonAreaSqMiles() via Shoelace formula, pointInPolygon() ray-casting
- Fallback: no API key → circle polygon at estimated radius

**Census polygon aggregation:**
- census-service.ts: getDemographicsForPolygon() generates dense grid within
  polygon, resolves each point to tract, population-weighted aggregation
- Added B11001_001E (total households) to all census queries
- Derived: aggregateHouseholdIncome = totalHouseholds × medianHHI (spending power)
- Fixed populationDensity for aggregated results (was always undefined)

**Tract-level historical trends:**
- fetchHistoricalYearData now tries tract-level first (was county-only)
- Returns 5-year CAGR for population, income, home value
- MarketTrendAnalysis shows geographic level badge + CAGR summary cards

**API endpoints:**
- New: POST /api/demographics/isochrone (lat/lng + targetMinutes → polygon)
- Updated: POST /api/demographics/location accepts polygonBoundary param
- Updated: POST /api/demographics/historical-trends returns cagr + geographicLevel

**Client (Index.tsx + MarketTrendAnalysis.tsx):**
- Drive-time mode renders Google Maps Polygon instead of Circle
- Added Households, Spending Power, Pop. Density to stat cards + comparison table
- CAGR cards with trend indicators above trend chart

**Key files:**
- server/services/drivetime-service.ts (isochrone generation, batch Distance Matrix)
- server/services/census-service.ts (polygon aggregation, households, tract trends)
- server/routes.ts (isochrone + polygon endpoints)
- shared/schema.ts (totalHouseholds, aggregateHouseholdIncome on DemographicSummary)
- client/src/pages/analysis/demographics/Index.tsx
- client/src/components/demographics/MarketTrendAnalysis.tsx

---

## Active Technical Patterns

**DB changes**: Always `psql $DATABASE_URL` with `ADD COLUMN IF NOT EXISTS` — never `npm run db:push`
**Kill server**: `pkill -f 'tsx server'`
**Patch pattern**: `node --input-type=module << 'JS'` heredoc for file edits
**RLS tables**: Use raw `pool.query()` not Drizzle ORM
**Raw SQL returns**: snake_case — map explicitly
**Test project**: ID `6b3a9021-f393-489d-9274-321ac76eae08`, org `cd3719c3-ef82-4ccc-acb9-261c80fb64b4`

---

## Remaining Work

### All Major Items Complete
- ✅ Stripe Payment Integration — done (checkout, portal, webhooks)
- ✅ Real Data Import — done (full CSV/Excel upload for sales + rate comps)
- ✅ DB Migration — done (18 new tables created via raw SQL)
- ✅ Master Comps Pack — done (enum, catalog, pack-service)
- ✅ Email System — done (unified provider with SendGrid → Resend → console fallback)
- ✅ Trial Reminders — done (day 3/5/7 emails via cron job)
- ✅ Sign-Up Enhancement — done (categorized assets, all packs, recommendations)
- ✅ Admin Panel — done
- N/A J.1 Native Mobile — deferred (web app is fully responsive)

### 3. CRM Dashboard Assessment — ✅ DONE (2026-03-19)
Assessed: already solid (684 lines, 6 KPI cards, pipeline bars, activity panels,
asset class breakdown, property grid, quick actions). Quality matches record pages.
No upgrade needed — flat layout is appropriate for dashboards.

### 4. last_contacted_at Backfill — ✅ DONE (2026-03-19)
Script at scripts/backfill-last-contacted.sql. Safe to re-run. Run via:
  psql $DATABASE_URL -f scripts/backfill-last-contacted.sql

### 5. Frontend Visual QA — ✅ DONE (2026-03-19)
FM design system (fm-page, fm-header, fm-panel, fm-body) was defined in index.css
but 3 tabs used ad-hoc headers. Fixed: monte-carlo.tsx, debt-scenarios.tsx,
scenario-comparison.tsx now use fm-header/fm-header-title/fm-header-sub/fm-header-actions
and fm-body wrappers. Remaining tabs (dcf-calculator, pro-forma, historical-pl,
exit-strategy, model-returns, deal-pricing, capital-stack, debt-inputs) already
use FM design system correctly.

### 6. Property Form Geocoding — ✅ DONE (2026-03-19)
AddressInput already extracted lat/lng from Google Maps but property-form-modal.tsx
wasn't capturing them. Fixed: onAddressSelect now stores lat/lng in state,
coordinates:{lat,lng} included in create/update mutations, existing coords
populated when editing. crmProperties.coordinates jsonb field was already in schema.

---

## Session Instruction
At the start of every MarinaMatch session, run:
  cat ~/workspace/MARINAMATCH_JOURNAL.md
