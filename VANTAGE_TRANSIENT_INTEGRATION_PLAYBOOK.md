# VANTAGE TRANSIENT RENT ROLL — INTEGRATION & CLAUDE CODE HANDOFF PLAYBOOK

**Purpose:** Step-by-step procedure for safely integrating the Transient Rent Roll spec into the existing Vantage codebase without breaking the Phase 3 DCF refactor, and accurately prompting Claude Code to execute each phase.

**Pair with:** `VANTAGE_TRANSIENT_RENT_ROLL_SPEC.md`

---

## PART 1 — PRE-FLIGHT (DO THIS BEFORE YOU OPEN CLAUDE CODE)

### 1.1 Create a Long-Lived Feature Branch

Every line of transient rent roll work happens on one branch. Do not merge to `main` until Phase 4 is complete and all 154 DCF tests still pass.

```bash
git checkout main
git pull
git checkout -b feature/transient-rent-roll
git push -u origin feature/transient-rent-roll
```

Open a **draft PR immediately** against `main` so you can see the diff accumulate and catch scope creep. Title it `[DRAFT] Transient Rent Roll — Phases 1–7`. Update the PR body as each phase lands.

### 1.2 Capture a Baseline Snapshot

Before writing any new code, freeze the current state so you can prove "no regressions":

```bash
# Capture current test pass count
npx vitest run 2>&1 | tee baseline-tests.txt

# Capture current TS error count (should be 0)
npx tsc --noEmit 2>&1 | tee baseline-tsc.txt

# Capture current DCF output for the test project as a golden file
curl -X POST 'http://localhost:3000/api/v1/dcf/run' \
  -H 'Content-Type: application/json' \
  -H "X-Org-Id: cd3719c3-ef82-4ccc-acb9-261c80fb64b4" \
  -d '{"projectId":"6b3a9021-f393-489d-9274-321ac76eae08"}' \
  > test/golden/dcf-baseline.json
```

Commit the golden file. After Phase 4 (Pro Forma integration), you'll diff the new DCF output against this baseline. **Any change** needs justification in the PR.

### 1.3 Copy the Spec Into the Repo

```bash
mkdir -p docs/specs
cp ~/Downloads/VANTAGE_TRANSIENT_RENT_ROLL_SPEC.md docs/specs/
cp ~/Downloads/VANTAGE_TRANSIENT_RENT_ROLL_SPEC.md ~/workspace/VANTAGE_TRANSIENT_RENT_ROLL_SPEC.md
git add docs/specs/VANTAGE_TRANSIENT_RENT_ROLL_SPEC.md
git commit -m "docs: add transient rent roll spec"
```

The workspace copy is so Claude Code can `cat` it directly without navigating into `docs/`. The repo copy is the archival version.

### 1.4 Add a Journal Entry for the New Workstream

Append a new section to `MARINAMATCH_JOURNAL.md`:

```markdown
## Transient Rent Roll — Active Workstream
- Branch: feature/transient-rent-roll
- Spec: VANTAGE_TRANSIENT_RENT_ROLL_SPEC.md (root of workspace)
- Baseline: 154/154 DCF tests, 0 TS errors, golden file at test/golden/dcf-baseline.json
- Current Phase: [update as you progress]
- Parallel-safe: Phases 2 and 3 may start in parallel once Phase 1 lands
- Do not merge to main until Phase 4 completes with baseline DCF parity
```

### 1.5 Register the Feature Flag (This Is the Biggest De-Risker)

The single most important anti-breakage move: **gate every new code path behind a feature flag** that defaults to OFF. This means `main` can safely contain transient-rent-roll code that isn't doing anything yet, so you can merge in smaller chunks without waiting for the whole feature.

Add to your existing feature-flag module (or create one if you don't have it):

```ts
// server/config/featureFlags.ts
export const featureFlags = {
  transientRentRoll: {
    enabled: process.env.FF_TRANSIENT_RENT_ROLL === '1',
    phases: {
      schema: process.env.FF_TRANSIENT_SCHEMA === '1',
      ingestion: process.env.FF_TRANSIENT_INGESTION === '1',
      analytics: process.env.FF_TRANSIENT_ANALYTICS === '1',
      proForma: process.env.FF_TRANSIENT_PRO_FORMA === '1',
      ui: process.env.FF_TRANSIENT_UI === '1',
    },
  },
};
```

In Replit: set `FF_TRANSIENT_RENT_ROLL=0` on production, `=1` on your dev environment. Phase-specific flags let you turn Phase 4 on in dev while keeping Phase 6 UI off.

Every new route, every new UI tab, every Pro Forma emitter branch checks this flag. The pattern:

```ts
// server/routes/transient/index.ts
import { featureFlags } from '../../config/featureFlags.js';

router.use((req, res, next) => {
  if (!featureFlags.transientRentRoll.enabled) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
});
```

```tsx
// client/src/pages/property/rent-roll/RentRollTabs.tsx
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

export function RentRollTabs({ property }) {
  const transientEnabled = useFeatureFlag('transientRentRoll');
  const hasTransient = property.assetClass.transient?.enabled;
  return (
    <Tabs>
      <Tab label="Traditional">{/* existing */}</Tab>
      {transientEnabled && hasTransient && (
        <Tab label="Transient">{/* new */}</Tab>
      )}
    </Tabs>
  );
}
```

### 1.6 Two Safety Nets for the DCF

The DCF integration (Phase 4) is where things can genuinely break. Two guardrails:

**Guardrail 1 — Keep the existing `RevenueModel` interface dormant until Phase 4.** In Phase 1, you'll write the Drizzle schema and tables but NOT touch any DCF code. The DCF continues to call the traditional rent-roll path. The transient engine produces Pro Forma rows but they go nowhere until you wire them up.

**Guardrail 2 — Snapshot-test the DCF.** Add a `test/regression/dcf-parity.test.ts` that runs the DCF on 3 different properties (one pure traditional, one pure transient, one mixed) and compares the output to a committed golden JSON. Run this on every commit. If it diverges, the PR is blocked.

```ts
// test/regression/dcf-parity.test.ts
import { readFileSync } from 'fs';
import { runDcf } from '../../server/dcf/engine.js';

describe('DCF regression parity', () => {
  it('produces byte-identical DCF for baseline property', async () => {
    const baseline = JSON.parse(readFileSync('test/golden/dcf-baseline.json', 'utf8'));
    const current = await runDcf({
      projectId: '6b3a9021-f393-489d-9274-321ac76eae08',
      orgId: 'cd3719c3-ef82-4ccc-acb9-261c80fb64b4',
    });
    // Compare to 4 decimal places to avoid float noise
    expect(roundDeep(current, 4)).toEqual(roundDeep(baseline, 4));
  });
});
```

This test runs before every `git push` (add a husky pre-push hook if you don't already have one).

### 1.7 Answer the Open Questions From Section 12 of the Spec

Before Phase 1 starts, resolve these in the PR description. Recommended defaults:

- **StayMate sync**: defer to follow-up sprint; Phase 3 is file-based ingestion only
- **Compset data**: user-uploaded STR reports only in v1
- **Billing gating**: Operator tier ($499/mo) for the transient module
- **Multi-currency**: USD-only in v1
- **Waitlist**: Phase 7 only
- **PII**: hash guest emails for dedup, don't store plaintext
- **Rate recommendations**: compset benchmarks displayed read-only; no dynamic pricing

Putting these answers in writing removes ambiguity that Claude Code will otherwise try to guess at.

---

## PART 2 — HOW TO PROMPT CLAUDE CODE ACCURATELY

### 2.1 The Four Rules of Prompting Claude Code on This Feature

1. **Always give it the journal + the spec + the phase number.** Never let it infer context.
2. **Scope to one file or one section at a time.** Don't say "build Phase 1." Say "build the `transient_inventory_group` and `transient_unit_type` tables per Section 3.2."
3. **Demand a pre-flight and a post-flight.** Pre-flight: summarize what you're about to do and confirm. Post-flight: run tsc, run tests, update journal.
4. **Never let it run `npm run db:push`.** Repeat this in every session-opener prompt. If it tries, stop the session and restart.

### 2.2 The Session-Opener Template

Paste this at the start of **every** Claude Code session on this feature:

```
You are working on the Vantage Transient Rent Roll feature on branch
feature/transient-rent-roll. Before you write any code:

1. Run: cat ~/workspace/MARINAMATCH_JOURNAL.md
2. Run: cat ~/workspace/VANTAGE_TRANSIENT_RENT_ROLL_SPEC.md | head -200
3. Confirm you see the "Transient Rent Roll — Active Workstream" section
   in the journal and the spec's Section 0.
4. Tell me the current phase from the journal, and the specific section
   of the spec we are implementing today.

HARD RULES (restate these back to me before proceeding):
- Never run `npm run db:push`. Use raw SQL migrations + pool.query() for
  RLS tables.
- All imports use .js extensions (ESM).
- All API routes under /api/v1/.
- Auth middleware sets req.currentHost. Respect it.
- Test org: cd3719c3-ef82-4ccc-acb9-261c80fb64b4
- Test project: 6b3a9021-f393-489d-9274-321ac76eae08
- Every new code path must be gated by featureFlags.transientRentRoll.
- Never modify existing DCF code in Phases 1, 2, or 3.
- Run `npx tsc --noEmit` before declaring a task complete; 0 errors required.
- Run the 154 DCF test suite before declaring a task complete.

Now wait for my task-specific prompt. Do not start coding until I give
you a specific section number and acceptance criteria.
```

### 2.3 The Task-Specific Prompt Template

Once the session is opened, every task follows this shape:

```
TASK: [short name, e.g. "Phase 1 — Inventory schema (Section 3.2 tables A-C)"]

SPEC REFERENCE: VANTAGE_TRANSIENT_RENT_ROLL_SPEC.md, Section [X.Y], covering
the following tables/entities: [list them]

SCOPE (what to build):
- [explicit list]

OUT OF SCOPE (do not touch):
- [explicit list — e.g., "do not modify any existing DCF file"]

FILES TO CREATE:
- server/db/schema/transient.ts (new)
- migrations/020_transient_inventory.sql (new)
- test/transient/schema.test.ts (new)

FILES TO EDIT (if any):
- server/db/schema/index.ts — add re-export only
- (nothing else)

ACCEPTANCE CRITERIA:
1. `npx tsc --noEmit` returns 0 errors
2. `npx vitest run` returns 154/154 DCF tests passing
3. New schema tests pass
4. Migration file uses raw SQL (no drizzle-kit push)
5. RLS policies applied to every transient_* table
6. Journal updated with session-start and session-end state

PROCESS:
1. Pre-flight: state what you will do in 5 bullets. Wait for my "go".
2. Implement.
3. Run tsc, run tests, show me the output.
4. Update MARINAMATCH_JOURNAL.md.
5. Stop. Do not move to the next task without explicit approval.
```

### 2.4 Ready-to-Paste Phase Kickoff Prompts

The seven phase-opener prompts below. Copy, paste, add any project-specific details at the top.

#### Phase 1 Kickoff

```
TASK: Phase 1 — Schema & Core CRUD

SPEC REFERENCE: VANTAGE_TRANSIENT_RENT_ROLL_SPEC.md Sections 3.1–3.5
and Sections 6.1–6.3.

SCOPE:
- Create all Drizzle schema tables from Section 3.2 in
  server/db/schema/transient.ts
- Create raw SQL migration at migrations/020_transient_rent_roll.sql
  (do NOT use drizzle-kit push; hand-author the SQL using the Drizzle
  schema as reference)
- Apply the migration using psql or pool.query() (document which in
  the journal)
- Apply RLS policies per Section 3.3 — every transient_* table
- Implement the booking_night trigger function per Section 3.5
- Implement `validateUnitTypeDimensions` helper per Section 3.4
- Extend ASSET_REGISTRY with the transient block for: marina, hotel_
  limited_service, str, rv_park (use entries in Section 2.8 verbatim
  as starting point; add other asset classes as stubs with
  transient.enabled=false)
- Implement CRUD endpoints for groups, unit-types, units, rate plans,
  channels per Section 6.1–6.3 under server/routes/transient/
- Mount under /api/v1/transient with feature flag gate
- Write unit tests:
  * Explosion trigger correctness (N-night stay → N rows; cancellation
    clears rows)
  * Dimension validation for marina and hotel dimensions
  * RLS isolation (org A cannot read org B rows)

OUT OF SCOPE:
- Do not touch any existing DCF, Pro Forma, or rent-roll code
- Do not create KPI, ingestion, or UI code
- Do not create booking endpoints yet (Phase 1 ends at inventory CRUD)

ACCEPTANCE CRITERIA:
1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run test/regression/dcf-parity.test.ts` → still passes
3. `npx vitest run` → 154/154 DCF tests + new schema tests pass
4. Can POST a unit type + units via curl and see rows
5. Can POST a booking via raw SQL and see booking_night rows populate
6. Journal updated with migration command actually used

Begin with the pre-flight. Do not write code until I say go.
```

#### Phase 2 Kickoff (Analytics)

```
TASK: Phase 2 — Analytics Engine

SPEC REFERENCE: VANTAGE_TRANSIENT_RENT_ROLL_SPEC.md Sections 5.1–5.3
and 6.4–6.5.

SCOPE:
- KPI calculation module at server/transient/kpi/ with the policy
  system from Section 5.1
- All analytics endpoints from Section 6.5, mounted under
  /api/v1/transient/
- Booking CRUD endpoints from Section 6.4
- kpi_snapshot materialization: on-demand recompute endpoint + nightly
  cron stub (the cron can log only; scheduling is handled by Replit's
  existing scheduler config if any, otherwise leave a TODO)
- Seasonality auto-derivation per Section 5.3
- LOS distribution and booking-window distribution endpoints
- Compset CRUD + snapshot endpoints
- Seed script at scripts/seed-transient-fixtures.ts creating one
  marina fixture (60 slips, 24 months history) — per Section 9.5

OUT OF SCOPE:
- Ingestion pipeline (Phase 3)
- Pro Forma emitter (Phase 4)
- Monte Carlo (Phase 5)
- UI (Phase 6)

ACCEPTANCE CRITERIA:
1. `npx tsc --noEmit` → 0 errors
2. DCF regression test still passes (154/154)
3. Given the marina fixture, the KPI endpoint returns monthly Occ/ADR/
   RevPAR within 0.1% of hand-calculated values (write this as a test)
4. Toggling `includeCompsInOccupancy` changes occupancy in a measurable
   way (write this as a test)
5. Seasonality derivation produces 12 month indices that sum to ~12.0
   (write this as a test)

Pre-flight first, wait for go.
```

#### Phase 3 Kickoff (Ingestion)

```
TASK: Phase 3 — Document Ingestion Pipeline

SPEC REFERENCE: VANTAGE_TRANSIENT_RENT_ROLL_SPEC.md Section 4 entirely.

SCOPE:
- Classifier service at server/transient/ingestion/classify.ts with
  fingerprint registry per Section 4.2 Step 1
- Deterministic parsers for Hostaway CSV and Dockwa CSV (most common)
- LLM parser using claude-opus-4-6 for PDFs and generic/unknown CSVs,
  reusing the existing Vantage document-intelligence PDF pipeline
  (pdfjs-dist geometry-based; see existing P&L Parser v2)
- Validation + confidence scoring per Section 4.2 Steps 4–5
- Ingestion API endpoints from Section 6.6
- Commit flow that upserts channels and unit types; inserts bookings;
  relies on booking_night trigger (built in Phase 1) to populate nights
- Reconciliation report per Section 4.2 Step 8
- Review UI (cell-by-cell) for transient bookings at
  client/src/pages/property/document-intel/transient-review/

OUT OF SCOPE:
- Pro Forma emitter (Phase 4)
- StayMate direct sync (deferred per Open Question 1)
- Monte Carlo (Phase 5)
- Any UI outside of the review screen (Phase 6)

TEST FIXTURES: place in test/fixtures/transient/. You need:
- hostaway-sample.csv (create a realistic 100-row sample)
- dockwa-sample.csv (create a realistic 50-row sample)
- str-report-sample.pdf (if not available, create a mock XLSX with the
  expected columns and parse as XLSX)

ACCEPTANCE CRITERIA:
1. tsc + DCF regression both clean
2. Uploading hostaway-sample.csv produces 100 bookings with >= 95%
   avg confidence (test)
3. Uploading dockwa-sample.csv produces 50 bookings with >= 95% avg
   confidence (test)
4. STR report ingestion creates compset_snapshot rows (test)
5. Reconciliation report surfaces variance when parsed room revenue
   differs from a seeded P&L value by > 2% (test)

Pre-flight first, wait for go.
```

#### Phase 4 Kickoff (Pro Forma & DCF — THE HIGH-RISK PHASE)

```
TASK: Phase 4 — Pro Forma & DCF Integration

SPEC REFERENCE: VANTAGE_TRANSIENT_RENT_ROLL_SPEC.md Sections 5.4–5.6
and 6.7.

CRITICAL: This is the phase where DCF regressions can happen. Take
extra care. Before writing any code, re-read Section 5.5 "Pro Forma
Roll-Up — The Critical Integration" and Section 11 "Vantage Dev Rules
Reminder".

SCOPE:
- Define the RevenueModel interface (Section 5.5) — new file
  server/proForma/RevenueModel.ts
- Refactor the existing traditional rent roll code to IMPLEMENT
  RevenueModel without changing its public behavior. This is a
  pure refactor. Snapshot-test it to prove no diff.
- Implement TransientRentRollModel implementing RevenueModel
- Implement MixedModel for properties with both
- Implement emit-pro-forma endpoint per Section 6.7
- Wire the Pro Forma emitter output into the existing DCF pipeline
  such that a transient-enabled property produces a full DCF
- Expense template library: USALI hotel, marina, RV park, STR (stored
  as seed data in a new `transient_expense_template` table or as
  static TypeScript constants — your call, document in journal)
- Apply stabilization ramp per Section 5.4
- Implement transient_uw_assumption_set read/write via raw pool.query()
  (RLS-protected — see Section 3.3 and rules in Section 11)

OUT OF SCOPE:
- Monte Carlo variables (Phase 5)
- UI (Phase 6)

ACCEPTANCE CRITERIA — ALL MUST PASS:
1. tsc clean
2. DCF regression test still passes BYTE-IDENTICALLY for the baseline
   property. This is non-negotiable.
3. A transient-enabled property with a populated assumption_set
   produces a DCF whose Year 1 NOI matches a hand-computed Excel
   reference within 0.5% (write this test; I will supply the Excel
   reference numbers in a file test/fixtures/transient/hotel-uw-
   reference.json)
4. A mixed property (marina with 120 annual + 60 transient slips)
   produces Pro Forma rows where annual-tenant rent appears in the
   rent roll line items and transient revenue appears in GPR with
   vacancy loss — each verifiable in the emitted rows
5. transient_uw_assumption_set is ONLY accessed via pool.query() —
   grep the diff to confirm no Drizzle access

STOP CRITERIA: If the DCF regression test fails at any point during
this phase, STOP IMMEDIATELY, do not try to "fix forward." Roll back
the last change and examine what introduced the drift.

Pre-flight first, wait for go. Then pre-flight again before the
refactor step and before the wire-up step. Three pre-flights on this
phase, not one.
```

#### Phase 5 Kickoff (Monte Carlo)

```
TASK: Phase 5 — Monte Carlo & Decision Support

SPEC REFERENCE: VANTAGE_TRANSIENT_RENT_ROLL_SPEC.md Sections 5.8–5.9.

SCOPE:
- Register all variables from Section 5.8 in the existing Monte Carlo
  variable registry
- Ensure the MC engine picks them up and mutates assumption_set
  correctly via the impactPath field
- Tornado chart: verify it automatically includes the new variables
- Memo generator: add transient narrative template per Section 5.9

OUT OF SCOPE:
- UI beyond the existing MC/tornado/memo screens
- Any Pro Forma changes

ACCEPTANCE CRITERIA:
1. tsc + DCF regression clean
2. 10,000-draw MC run on a seeded hotel deal completes in <15s (test)
3. Tornado chart output identifies top 5 variables with signs that
   match common sense (occupancy positive, commission negative)
4. Memo generator output for a transient deal mentions
   stabilized RevPAR and ADR in prose

Pre-flight first.
```

#### Phase 6 Kickoff (UI)

```
TASK: Phase 6 — UI Polish

SPEC REFERENCE: VANTAGE_TRANSIENT_RENT_ROLL_SPEC.md Section 7 entirely.

SCOPE:
- Transient Rent Roll page (Section 7.2) with calendar, table, analytics
- Inventory management page (Section 7.3)
- Rate plan / calendar editor (Section 7.5)
- Seasonality editor (Section 7.6)
- Underwriting assumptions panel (Section 7.7)
- Compset view (Section 7.8)

All gated by featureFlags.transientRentRoll.phases.ui.

Build in this order. After each page, show me a screenshot or running
demo before starting the next.

OUT OF SCOPE:
- Document review UI (built in Phase 3)
- Advanced analytics (Phase 7)

ACCEPTANCE CRITERIA:
- All pages functional at 1440px desktop
- Calendar renders 50 units × 90 days in <300ms (measure with
  React Profiler; attach screenshot)
- Mobile fallback (day-list view) present
- No new TS errors
- All existing tests pass

Pre-flight first, one page at a time.
```

#### Phase 7 Kickoff (Advanced)

```
TASK: Phase 7 — Advanced Analytics & Polish

SPEC REFERENCE: VANTAGE_TRANSIENT_RENT_ROLL_SPEC.md Section 8 Phase 7.

SCOPE:
- YoY overlay on charts
- Pace / pickup analytics (forward BOB)
- Channel-commission optimizer
- Rate-recommendation sidebar (compset benchmark display only — no
  dynamic pricing, per Open Question 7)
- Excel/PDF exports

ACCEPTANCE CRITERIA as per Section 8 Phase 7.

Pre-flight first.
```

### 2.5 Mid-Task Correction Prompts

When Claude Code goes off the rails, the fastest recovery:

**If it's about to run `db:push`:**
```
STOP. Do not run npm run db:push. Per the spec Section 11 and our
session-opener rules, RLS-protected tables must be migrated via raw
SQL. Generate the SQL from the Drizzle schema using `drizzle-kit
generate --dialect postgresql` if needed, then apply via psql or
pool.query(). Revert any schema changes that went through db:push.
```

**If it's modifying existing DCF code in Phases 1–3:**
```
STOP. You are modifying [file]. Per the phase scope, the DCF code is
out of scope until Phase 4. Revert that change. If you believe a
change is necessary, surface it as a TODO in the journal and
continue without it.
```

**If it's skipping the tsc / test check:**
```
Before declaring this complete, run:
  npx tsc --noEmit
  npx vitest run test/regression/dcf-parity.test.ts
  npx vitest run [the relevant new test path]
Paste the output. Do not mark the task done until all three are clean.
```

**If it's guessing at a spec detail:**
```
Before proceeding, quote the exact sentence or code block from the
spec that supports what you're about to do. If the spec is ambiguous
on this point, stop and ask me.
```

### 2.6 End-of-Session Prompt

Close every session with:

```
Before ending this session:
1. Run `npx tsc --noEmit` — confirm 0 errors
2. Run the DCF regression test — confirm it passes
3. Run any new tests you wrote — confirm they pass
4. Update MARINAMATCH_JOURNAL.md with:
   - Date/time session ended
   - Current phase and what was completed in this session
   - Any TODOs or open questions
   - The specific section(s) of the spec that are now implemented
5. Stage the journal update in git but DO NOT commit
6. Summarize in 10 bullets or fewer: what was done, what's next,
   and any risks you want me to know about.
```

---

## PART 3 — INTEGRATION ORDER & DE-RISKING CHECKLIST

### 3.1 The Merge Cadence

Every phase lands as its own PR off the feature branch, using the same **draft-until-ready** pattern. Only after Phase 4 (Pro Forma integration) passes baseline DCF parity do you merge any of it to `main`. Before that point, the feature branch can be wiped and restarted without losing production.

Sequence:

1. Phase 1 → PR #1 against `feature/transient-rent-roll` → review → merge
2. Phase 2 → PR #2 → review → merge  (can parallel with Phase 3 start)
3. Phase 3 → PR #3 → review → merge
4. Phase 4 → PR #4 → review → merge **← decision point: after this, you have the option to merge feature branch to main**
5. Phase 5 → PR #5 → review → merge
6. Phase 6 → PR #6 (may be multiple sub-PRs per page) → review → merge
7. Phase 7 → PR #7 → review → merge
8. Feature flag flipped ON in production → final PR that removes the `phases.ui` sub-flags

### 3.2 The Pre-Merge Checklist (Every PR)

Paste this into each PR's description:

```
## Pre-merge checklist
- [ ] `npx tsc --noEmit` clean
- [ ] 154/154 DCF tests passing
- [ ] DCF regression parity test passing (baseline byte-identical)
- [ ] New tests added for new functionality
- [ ] No new code paths unprotected by featureFlags.transientRentRoll
- [ ] No `npm run db:push` in any commit in this PR
- [ ] Journal updated
- [ ] Spec sections implemented listed below:
  -
- [ ] Open questions surfaced:
  -
```

### 3.3 Rollback Protocol

If production breaks after merge:

1. Flip `FF_TRANSIENT_RENT_ROLL=0` on production — this disables all new code paths immediately
2. If that doesn't fix it, `git revert` the PR that introduced the regression
3. File a journal entry explaining the failure before re-attempting

Because every new code path is feature-flagged, flipping the env var should restore behavior to pre-feature state without a redeploy.

### 3.4 Concrete De-Risking Tactics Specific to Your Codebase

Given what's in your journal:

- **Don't touch the Phase 3 DCF Refactor files.** Your DCF just stabilized at 154/154. The transient engine consumes the DCF's output contract, not its internals. Anything you do in `server/dcf/**` outside of Phase 4's explicit refactor is out of scope.
- **Don't touch `modeling_project_config` or `modeling_scenario_versions`.** The transient assumption set is a *new* table alongside them, not a modification.
- **The P&L Parser v2 is shared infrastructure.** Reuse its pdfjs-dist pipeline in ingestion, but do not refactor it. If you find a bug in it during Phase 3, file it separately and work around it.
- **FM Design System v2.** All new UI components use FM tokens only. If Claude Code reaches for shadcn/ui defaults or fresh Tailwind classes instead, correct it and point to the design system.
- **The `ASSET_REGISTRY`.** Extending it is fine (the spec calls for this). Modifying existing entries beyond adding a `transient` block is not.

### 3.5 What to Do When You Hit an Ambiguity

The spec doesn't cover every edge case. When Claude Code surfaces an ambiguity:

1. Have it write a brief "Decision needed" entry in the journal
2. Resolve it yourself, explicitly, in writing
3. Back-fill the spec with an addendum (`VANTAGE_TRANSIENT_RENT_ROLL_SPEC_ADDENDUM_v1.md`) rather than editing the main spec
4. Include the addendum in the next session-opener prompt

This keeps the spec clean and gives future-you an audit trail.

---

## PART 4 — WHAT TO DO IN THE FIRST HOUR

If you want to start today, here is the exact sequence:

1. Open a terminal in your Replit workspace
2. `git checkout -b feature/transient-rent-roll && git push -u origin feature/transient-rent-roll`
3. Save the two documents to the repo: `VANTAGE_TRANSIENT_RENT_ROLL_SPEC.md` and this playbook (`VANTAGE_TRANSIENT_INTEGRATION_PLAYBOOK.md`)
4. Commit the docs, open the draft PR
5. Add the `featureFlags.transientRentRoll` block to your feature-flags module; commit
6. Set `FF_TRANSIENT_RENT_ROLL=1` in your Replit dev secrets
7. Write the baseline DCF parity test + commit the golden JSON
8. Update `MARINAMATCH_JOURNAL.md` with the new workstream block
9. Open Claude Code in the Replit workspace
10. Paste the session-opener prompt (Section 2.2 above)
11. After it confirms rules, paste the Phase 1 kickoff prompt (Section 2.4)
12. After pre-flight, give it the green light for Phase 1 Table A only (`transient_inventory_group`). Ship that PR. Then Table B. Then Table C. Small merges, high confidence.

You should land Phase 1's schema within a few focused Claude Code sessions. Phase 4 is the phase you slow down for.

---

*End of playbook. Pair with the main spec. Keep the journal current.*
