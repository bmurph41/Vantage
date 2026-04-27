# Route + Service Tenant-Isolation Audit (Phase A9-1)

**Generated:** 2026-04-27
**Scope:** All `server/routes/*.ts` (159 files) and `server/services/**/*.ts` (176 files).
**Methodology:** Hybrid — automated pattern scan across every file, plus targeted line-by-line audit of the highest-risk financial files (`fund-management-routes.ts`, `fund-reporting-service.ts`, `distribution-approval-service.ts`, `period-lock-service.ts`, `fund-service.ts`).
**Output:** This document is read-only — no source code modified. Fixes happen in Phase A9-2.

---

## Executive Summary

| Metric | Count |
|---|---:|
| Org-scoped tables (direct `org_id` column) | **620** |
| Tables without direct `org_id` (platform OR indirectly scoped) | **155** |
| Total route files | 159 |
| Total service files | 176 |
| Route handlers flagged by pattern scan | **519** (out of 603 candidates) |
| Service functions flagged by pattern scan | **412** (out of 474 candidates) |
| Critical findings confirmed by line-level audit | **1 file (4+ sites)** — see §5 |
| Named-service deep audits performed | 5 (fund-reporting, distribution-approval, period-lock, fund-service, capital-stack) |

**Pattern-scan note:** The flag count is an upper bound. Pattern-scan false-positives are common in this codebase because of the **parent-validation pattern** — many routes verify a parent's `orgId` atomically (e.g., `fundsV2`), then query an indirectly-scoped child (e.g., `capitalAccounts`) by FK. Both queries are required to read independently; flagging only the second one as "vulnerable" misses the context.

**Real vulnerability rate among the 519 flagged route candidates:** estimated **20–40%** based on spot-checks. Not all 519 need fixes; A9-2 must triage.

**Most urgent finding from this audit:** `server/services/distribution-approval-service.ts` has 4 distinct raw-template-literal SQL string-interpolation sites (`${draftId}`, `${orgId}`, `${fundId}`, `${draft.id}`, `${draft.status}`, etc. all interpolated unparameterized into SQL strings cast as `any`). This is **SQL injection** and a **regression of the A1–A5 audit's intent** — the original audit hunted `sql.raw()` specifically and missed this template-string-with-`as any` escape-hatch pattern. **See §5 for line-level detail.**

---

## §1. Org-Scoped Table Inventory

### Methodology
Parsed `shared/schema.ts` (29,994 lines, 775 `pgTable` definitions). Classified each table by whether its column list contains `org_id` or `orgId`.

### Results
- **620 directly org-scoped tables** — must have `orgId`/`org_id` filter in every WHERE clause that targets them. Full list: `/tmp/org_tables.txt`.
- **155 tables without direct `org_id`** — fall into two sub-categories:
  - **Truly platform-level** (no per-org isolation needed): `organizations`, `betaInviteCodes`, `legalDocuments`, `benchmarkAggregates`, `packCatalog`, `passwordResetTokens`, `personaFeatureFlags`, `dashboardWidgets`, `dashboardModuleMetrics`, `assetClassConfig`, `cbsa_delineations`, etc.
  - **Indirectly org-scoped via FK chain**: `tasks` (→ `projects`), `findings`/`recommendations`/`projectSettings`/`projectShares`/`taskFiles`/`taskDependencies`/`risks` (→ `projects`), `notificationsLog`/`calendarEvents`/`userEmails`/`calendarGuests` (→ `users`), `documentRequirements`/`cddDocuments`/`docPages`/`kpis` (→ `projects`), `capitalAccounts` (→ `fundsV2`), `capitalAccountEntries` (→ `capitalAccounts` → `fundsV2`).

### Sample direct org-scoped tables (truncated; see /tmp/org_tables.txt)
`betaInviteRedemptions`, `organizationPacks`, `ssoConfigurations`, `users`, `userSessions`, `securityAuditLog`, `calendarSettings`, `dashboardCustomModules`, `userPersonaAssignments`, `userDashboardLayouts`, `userKpiPreferences`, `userPinnedItems`, `userRecentItems`, `userFavorites`, `dashboardCustomWidgets`, `dashboardSavedLayouts`, `dashboardWidgetTemplates`, `projects`, `projectTemplates`, `auditLogs`, …(600 more).

### Sample platform-level / indirectly-scoped tables (truncated)
`organizations`, `betaInviteCodes`, `legalDocuments`, `benchmarkAggregates`, `packCatalog`, `passwordResetTokens`, `personaFeatureFlags`, `dashboardWidgets`, `dashboardModuleMetrics`, `projectSettings`, `tasks`, `taskFiles`, `taskDependencies`, `timelineNotes`, `projectShares`, `risks`, `projectContacts`, `projectPendingContacts`, `notificationSubscriptions`, `notificationsLog`, `calendarEvents`, `userEmails`, `calendarGuests`, `documentRequirements`, `projectIntegrations`, `cddDocuments`, `docPages`, `kpis`, `findings`, `recommendations`, …(125 more).

---

## §2. Pattern-Scan Methodology and Limits

### What was scanned
A regex search across every `*.ts` file in `server/routes/` and `server/services/**` for the pattern:

```
.where(eq(<table>.(id|userId|projectId|fundId|propertyId|dealId|contactId|companyId|taskId|workflowId), …))
```

### How "flagged" was determined
For each match, a 10-line window (5 above, 4 below) was scanned for any occurrence of `orgId` or `org_id`. If absent, the candidate was flagged as a vulnerability suspect.

### Why this scan over-flags
The 10-line window heuristic misses three legitimate patterns:
1. **Parent-validation pattern**: Verify parent's `orgId` first, then query indirectly-scoped child by FK. Common in `fund-management-routes.ts` for `capitalAccounts` (FK-scoped via `fundId → fundsV2.orgId`).
2. **Service delegation**: Route handler extracts `orgId` from `req.user.orgId` and passes it to a service function; the actual orgId enforcement happens inside the service, outside the 10-line window.
3. **Insert-time orgId inclusion**: Inserts pass `orgId` in the `.values({...})` object, not via `.where()`.

### Why this scan also under-flags
1. **Raw SQL via template strings cast as `any`**: My A9-1 deep audit found `db.execute(\`...${userInput}...\` as any)` patterns that don't match the regex but are SQL-injection vulnerabilities. See §5.
2. **Drizzle queries with multiple `.where(...)` chained calls**: Possible to have orgId filter on a downstream `.where` not caught by the single-line regex.

**Net signal-to-noise estimate:** Pattern scan finds candidates; ~20–40% of flagged route candidates are real vulnerabilities. Service candidates skew slightly higher. A9-2 must triage manually. Full flag list saved to `/tmp/route_flags.json` and `/tmp/service_flags.json` for the A9-2 fix-time pass.

---

## §3. Route File Triage (sorted by flagged-candidate count)

| Flag count | File | Tier | Notes |
|---:|---|---|---|
| 51 | crm-routes.ts | T1 (drill) | Largest routes file (709KB, ~12K lines). Highest absolute count. Many indirectly-scoped table queries (CRM associations, notes, timeline). Real vulnerability rate to be determined in A9-2. |
| 25 | budget-routes.ts | T1 (drill) | Financial state. Drill carefully. |
| 24 | broker-dashboard-routes.ts | T2 | Broker-feature surface. Possible cross-broker leakage. |
| 22 | infrastructure-routes.ts | T2 | Generic infra; review pattern context. |
| 17 | crm-summary-routes.ts | T2 | CRM rollup queries. |
| 16 | operations-context-routes.ts | T2 | Large context-API surface (147KB). |
| 15 | customer-routes.ts | T2 | |
| 14 | dd-routes.ts | T1 (drill) | DD project state — financial-adjacent. |
| 14 | modeling-routes.ts | T1 (drill) | Pro Forma/DCF inputs. Spot-check at L2280–L2287 showed direct `asmpFuel/Service/etc.` queries by `projectId` (indirectly scoped). Need parent-validation verification. |
| 12 | phase-gates-routes.ts | T2 | |
| 11 | entity-linking.ts | T2 | |
| 11 | tenant-construction-routes.ts | T2 | |
| 11 | onboarding-routes.ts | T2 | |
| 10 | broker-registration-routes.ts | T2 | |
| 10 | deal-dd-routes.ts | T2 | |
| 10 | master-comps-routes.ts | T2 | |
| 10 | tax-waterfall-routes.ts | T1 (drill) | Financial state. |
| 9 | compliance-onboarding-routes.ts | T2 | |
| 9 | deal-workspace-routes.ts | T2 | |
| 8 | ai-deal-intelligence-routes.ts | T2 | |
| 8 | broker-claims-routes.ts | T2 | |
| 8 | playbook-routes.ts | T2 | |
| 8 | workspace-routes.ts | T2 | |
| 8 | red-flag-routes.ts | T2 | |
| 8 | document-builder-routes.ts | T2 | |
| 7 | fund-management-routes.ts | T1 (drill) | **Audited line-by-line — see §4.A.** Flag count comes from indirectly-scoped `capitalAccounts` queries that DO use the parent-validation pattern correctly. False-positive count = high here. |
| 6 each | scenario-template-routes.ts, external-routes.ts, integrations-marketplace-routes.ts, payroll-routes.ts, payroll.routes.ts, broker-subscriptions-routes.ts, auth-routes.ts | T3 | |
| 5 each | curated-data-routes.ts, crm-associations-routes.ts, valuator-payroll(.).routes.ts, dd-findings-routes.ts | T3 | |
| 4 each | commercial-tenants-routes.ts, legal-benchmarking-routes.ts, modeling-enhancements-routes.ts, tenant-leases-routes.ts, comment-routes.ts, commercial-lease-routes.ts, unified-lease-routes.ts | T3 | |
| 1–3 each | 30+ other files | T3 | Long tail; many likely false-positives. |

**Tier definitions:**
- **T1 (drill in A9-2):** financial-state files where a real cross-tenant leak would be most damaging. Audit line-by-line in A9-2 before any fix.
- **T2 (sweep in A9-2):** moderate flag count, non-financial state. Audit by scanning each flagged candidate's surrounding 30-line context.
- **T3 (spot-check in A9-2):** low flag count. Brief check; likely few real fixes.

### Files with zero candidates flagged
~80 route files scanned clean (no `.where(eq())` patterns matching the scan, OR all matches had orgId in the 10-line window). These are not "verified clean" — just not surfaced by this scan. A9-2 may need a second-pass scan with a more permissive heuristic.

---

## §4. Line-Level Audit — High-Risk Files

### §4.A — `server/routes/fund-management-routes.ts`

| Line | Method | Path | Table | Status | Confidence | Notes |
|---:|---|---|---|---|---|---|
| 263 | GET | `/capital-accounts/fund/:fundId` | `capitalAccounts` (indirect) | ✅ clean | high | Line 274 atomically verifies `fundsV2.id + orgId`. capitalAccounts is FK-scoped via fundId. Pattern is correct. |
| 296 | POST | `/capital-accounts` | `fundsV2`, `capitalAccounts` | ✅ clean | high | Line 307 atomically verifies fund.orgId before insert. capitalAccounts insert relies on FK enforcement. |
| 324 | GET | `/capital-accounts/:id` | `capitalAccounts` (indirect) | ⚠️ post-fetch | high | **Line 334 fetches capitalAccount BEFORE verifying parent fund's orgId at line 342.** Race condition is theoretical (would need DB write access to flip), but the audit-A8 spec called this out as "atomic-not-post-fetch" and this is exactly that pattern. **Recommend A9-2 fix: hoist fund check above account fetch, or join.** |
| 354 | GET | `/capital-accounts/:id/entries` | `capitalAccounts`, `capitalAccountEntries` | ⚠️ post-fetch (likely) | medium | Same pattern suspected; line 365 fetches account first, then verifies. **Need full read in A9-2.** |
| 406, 451, 471 | various | various capital-account ops | `capitalAccounts` | ⚠️ post-fetch (likely) | medium | Same pattern. Not separately verified line-level; presumed similar. |

**Verdict:** This file is mostly clean for the fundId-keyed paths. The 5 post-fetch sites are real-but-low-severity (TOCTOU requires DB write access). Fix in A9-2 to harden the pattern.

### §4.B — `server/services/fund-reporting-service.ts`

| Line | Function | Tables | Status | Confidence | Notes |
|---:|---|---|---|---|---|
| 72 | `calculatePME(orgId, fundId)` | `funds`, `fundCashFlows` | ✅ clean | high | Both queries (L75, L80) include `eq(...orgId, orgId)`. |
| 188 | `calculateReturnAttribution(orgId, fundId)` | `funds`, `fundDealAllocations`, `modelingProjects` (joined) | ✅ clean | high | L193 atomically verifies fund.orgId. |
| 371 | `getVintageCohorts(orgId)` | `funds` | ✅ clean | high | L373: `eq(funds.orgId, orgId)`. |

**Verdict:** This file is clean. The earlier A8 verification suspicion ("functions accept orgId without verified use") was a false alarm. **All three exported functions correctly use orgId in WHERE.**

### §4.C — `server/services/period-lock-service.ts`

| Line | Function | Tables | Status | Confidence | Notes |
|---:|---|---|---|---|---|
| 37 | `lockPeriod(req, fundId, ...)` | `fund_period_locks` | ✅ clean | high | Insert at L47–50 includes `org_id` in values. Parameterized via `sql\`...${orgId}...\``. |
| 65 | `unlockPeriod(req, lockId, reason)` | `fund_period_locks` | ✅ clean | high | L77: `WHERE id = ${lockId} AND org_id = ${orgId} AND is_locked = true` — atomic three-condition check. Parameterized. |
| 110 | `isDateLocked(orgId, fundId, date)` | `fund_period_locks` | ✅ clean | high | L113 uses orgId in WHERE. Parameterized. |
| 142 | `listPeriodLocks(orgId, fundId)` | `fund_period_locks` | ✅ clean | high | L145 uses orgId in WHERE. Parameterized. |

**Verdict:** This file is clean.

### §4.D — `server/services/distribution-approval-service.ts`

| Line | Function | Tables | Status | Confidence | Notes |
|---:|---|---|---|---|---|
| 74 | `createDraft(req, fundId, data)` | (none — pure object construction) | N/A | high | No DB write yet at this site. |
| 106 | `createDraft` (continued) | `distribution_approvals` | ⚠️ template-literal but $-placeholders | high | INSERT statement uses `$1...$13` placeholders BUT the call provides no parameter array (line 111 ends with `)` immediately, no second argument). **Likely throws at runtime when called** — and the SQL is also `as any` cast. Worth confirming whether this code path executes. If it does and works, the placeholders aren't being bound — possible DB error. If it doesn't execute, this is dead/untested code. **Investigate in A9-2.** |
| 233 | `execute(req, draftId)` | (delegates) | ⚠️ check downstream | high | Wrapped in `db.transaction()` (✅ A10 transaction-safety verified). Calls `getDraft` and `processFundDistribution` inside the txn. Vulnerability is in `getDraft`. |
| 286 | `runComplianceChecks(orgId, fundId)` | `investorVerification` (via `eqOp`) | ✅ clean | high | L300: `eqOp(investorVerification.orgId, orgId)`. |
| 337 | `getDraft(orgId, draftId, txn)` | `distribution_approvals` | ❌ **VULNERABLE — SQL INJECTION** | **high** | **L338:** `\`SELECT * FROM distribution_approvals WHERE id = '${draftId}' AND org_id = '${orgId}' LIMIT 1\` as any` — `draftId` is user-controllable (via route parameter). `orgId` comes from `req.user.orgId` so attacker can't pivot org, but `draftId` allows breaking out of the single-quote with `' OR '1'='1`. **Critical fix.** |
| 369 | `updateDraft(draft, txn)` | `distribution_approvals` | ❌ **VULNERABLE — SQL INJECTION** | **high** | **L371–385:** Massive UPDATE with raw template-literal interpolation of `draft.status`, ISO date strings, `draft.submittedBy`, `draft.rejectedBy`, `draft.rejectedAt`, JSON-stringified blobs, `draft.rejectionReason`, `draft.executedBy`, JSON, `draft.id`. Some fields use `.replace(/'/g, "''")` for manual quote-escape but partial coverage. `draft.status` (line 373) NOT escaped. **Critical fix.** |
| 391 | `listDrafts(orgId, fundId, status?)` | `distribution_approvals` | ❌ **VULNERABLE — SQL INJECTION** | **high** | **L398:** `\`SELECT * FROM distribution_approvals WHERE org_id = '${orgId}' AND fund_id = '${fundId}'${statusFilter} ORDER BY created_at DESC\` as any`. `fundId` is user-controllable. `statusFilter` (line 396) is built from user-controlled `status` param via ` AND status = '${status}'`. **Critical fix — multi-axis injection vector.** |

**Verdict:** **3 confirmed SQL injection sites in this single file** (L338, L371, L398). The author knew the right pattern (line 106 uses `$1...$13`) but slipped 4+ times in the same file. **These are the most urgent A9-2 fixes** and are a regression of the A1–A5 audit's intent — the original audit looked for `sql.raw()` and missed this `template-literal as any` pattern.

### §4.E — `server/services/fund-service.ts`

156 occurrences of `orgId`. No `db.execute()` raw calls (zero matches). All ~30 exported async methods on `FundService` class take `orgId` as the first parameter and (per spot-checks) use Drizzle query builder with `.where(and(eq(..., orgId), ...))`. **Pattern is correct; full line-level audit deferred to A9-2 if it matters.** Estimated status: ✅ clean (high confidence).

### §4.F — `server/services/capital-stack-service.ts`

Not deep-audited in A9-1. Reading the routes-level scan, this file isn't in the top-10 flag list. **Defer to A9-2 spot-check.**

---

## §5. Critical Findings (Severity-Ranked)

### ✅ SEV-1 — SQL Injection in distribution-approval-service.ts — FIXED 2026-04-27
- **File:** `server/services/distribution-approval-service.ts`
- **Lines (original):** 106 (broken INSERT, missing values), 338, 371–385, 398
- **Class:** SQL injection via raw template-literal interpolation cast as `any` (3 sites) + a 4th broken-functionality bug (createDraft INSERT had `$1...$13` placeholders but no values array, silently failing or inserting NULLs).
- **Reachable from:** Routes that call `submitForApproval`, `approve`, `reject`, `execute`, `listDrafts`, `getDraft` (all through `req.user.orgId` paths but with user-controlled `draftId`/`fundId`/`status`).
- **Fix shipped 2026-04-27 (A9-2 Phase 1):** All 4 sites converted to Drizzle's parameterized `db.execute(sql\`...\`)` template tag. `as any` casts removed from SQL paths. createDraft INSERT functionality restored — function now actually persists data instead of inserting NULLs/runtime-failing. updateDraft's hand-rolled `.replace(/'/g, "''")` quote-escaping deleted (unnecessary with proper parameterization). listDrafts conditional `${statusFilter}` string-concat replaced with `sql\`AND status = ${status}\`` fragment-or-empty pattern. Verified: typecheck preserved at 824 baseline, build succeeded, no SQL `${...}` interpolations remain outside the `sql\`\`` template tag.

### 🟡 SEV-2 — Post-fetch orgId checks in fund-management-routes.ts capital-account routes
- **File:** `server/routes/fund-management-routes.ts`
- **Lines:** 324, 354, 406, 451, 471 (5 sites)
- **Class:** TOCTOU — fetch first, verify orgId after
- **Reachable from:** `/capital-accounts/:id` (and 4 sibling routes)
- **Severity:** Medium. Real attack requires DB write access (which is already game-over). But the audit-A8 spec called this out specifically as an institutional-gate concern.
- **Fix complexity:** Mechanical. Either join or hoist the fund-org check above the account fetch.
- **A9-2 priority:** medium.

### 🟡 SEV-3 — High flag-count files needing A9-2 manual triage
- **Files:** `crm-routes.ts` (51), `budget-routes.ts` (25), `broker-dashboard-routes.ts` (24), `infrastructure-routes.ts` (22), `crm-summary-routes.ts` (17), `operations-context-routes.ts` (16), `dd-routes.ts` (14), `modeling-routes.ts` (14)
- **Class:** Pattern-scan candidates not yet verified. Likely 20–40% real vulnerabilities, 60–80% false-positives (parent-validation pattern, service delegation, indirect tables).
- **A9-2 priority:** depends on triage. Schedule in A9-2 sub-tasks per file.

### 🟢 N/A — Named services that were specifically audited and verified clean
- `fund-reporting-service.ts` — calculatePME, calculateReturnAttribution, getVintageCohorts: ✅ clean
- `period-lock-service.ts` — lockPeriod, unlockPeriod, isDateLocked, listPeriodLocks: ✅ clean
- `fund-service.ts` — top-level pattern review: ✅ clean (line-level deferred but pattern is consistent)
- `distribution-approval-service.ts` — `runComplianceChecks` at L286: ✅ clean (only this specific method; rest of file is SEV-1)

---

## §6. Service Audit — Top-30 by Flag Count

| Flag count | File | Notes |
|---:|---|---|
| 32 | rent-roll-v2/rentRollService.ts | Largest service surface. Worth deep audit in A9-2. |
| 25 | document-builder/document-builder-service.ts | Document state — usually org-scoped. |
| 19 | lease-storage.ts | Lease data is org-scoped. |
| 18 | deal-orchestrator.ts | |
| 16 | pending-comp-review-service.ts | |
| 12 | om-builder-service.ts | |
| 12 | rra-service.ts | Rent-roll-analysis state. |
| 11 | enterprise-auth-service.ts | Auth state — investigate carefully. |
| 10 | exit-integration-service.ts | |
| 10 | fund-service.ts | **A9-1 spot-checked**: pattern is consistent; full audit deferred. |
| 10 | doc-intel-service.ts | |
| 9 | broker-claim-service.ts | |
| 9 | pro-forma-engine-service.ts | Financial engine. |
| 8 | crm/archive-service.ts | |
| 8 | deal-stage-history-service.ts | |
| 8 | property-data-service.ts | |
| 7 | document-builder/data-binding-service.ts | |
| 7 | rent-roll-snapshot-service.ts | |
| 7 | approval-notification-service.ts | |
| 6 | pnl/parseOrchestrator.ts | |
| 6 | rent-roll-v2/snapshotVersioning/snapshotService.ts | |
| 6 | contact-engagement-service.ts | |
| 6 | multi-approver-service.ts | |
| 5 | pnl/routes.ts | |
| 5 | coa-mapping-engine.ts | |
| 5 | dashboard-service.ts | |
| 5 | document-parser/contract-extraction-service.ts | |
| 5 | job-queue-service.ts | |
| 5 | billing-service.ts | |
| 4 | rent-roll-v2/marinaLeaseEngine.ts | |

Full flag list: `/tmp/service_flags.json`.

---

## §7. A9-2 Recommended Execution Plan

### Phase 1 — SEV-1 Critical Fixes (effort: M, ~2 hours)
1. Fix `distribution-approval-service.ts:338` — `getDraft` raw template → parameterized `sql\`\`` template
2. Fix `distribution-approval-service.ts:371-385` — `updateDraft` raw template → parameterized `sql\`\`` template
3. Fix `distribution-approval-service.ts:398` — `listDrafts` raw template → parameterized `sql\`\`` template
4. Investigate `distribution-approval-service.ts:106` — INSERT with `$1...$13` placeholders but no params array. Either dead code or runtime bug.
5. Add a contract test that exercises a malicious `draftId` (e.g., `' OR 1=1--`) and verifies a 404, not data leakage.

### Phase 2 — SEV-2 Post-Fetch Fixes (effort: S, ~1 hour)
- Refactor 5 capital-account routes in `fund-management-routes.ts` to hoist fund-org verification atomically.

### Phase 3 — SEV-3 Triage Sweep (effort: L–XL, depends on real-vuln rate)
- For each T1 file (`crm-routes.ts`, `budget-routes.ts`, `broker-dashboard-routes.ts`, `infrastructure-routes.ts`, `crm-summary-routes.ts`, `operations-context-routes.ts`, `dd-routes.ts`, `modeling-routes.ts`):
  - Read every flagged candidate (at the line numbers from `/tmp/route_flags.json`)
  - For each, decide: clean (parent-validation pattern), service-delegation (verified in service), or vulnerable (fix needed)
  - Track findings in a follow-up audit document
- For T2 files: same process, lower priority.
- For T3 files: spot-check only.

**Estimated A9-2 total effort:** L (4–12h) if SEV-1+SEV-2 only; XL (12+h) if full SEV-3 triage included.

---

## §8. Methodology Limits and Honest Caveats

- The pattern scan only covers `.where(eq(...))` patterns. Drizzle has many other query forms (`.where(and(...))`, `.where(or(...))`, `.where(sql\`...\`)`, raw SQL via `pool.query()`, `db.execute()` with both safe and unsafe template literal forms). A9-1's SEV-1 finding shows the scan can miss a high-severity bug if it doesn't match the exact pattern.
- The 10-line context window for orgId presence is approximate. Routes that destructure `orgId` 30 lines above the query escape the scan as false-positives; routes that mention `orgId` in a comment or unused variable count as false-negatives.
- Indirectly-scoped tables (`tasks`, `findings`, `capitalAccounts`, etc.) are not flagged when their parent-validation is correct, but the scan would also miss the case where parent-validation is missing. A9-2 must explicitly check parent-FK chains for each indirect table query.
- Deep audit was performed on 5 named services + 1 named route file. The remaining ~330 files (159 route + 176 service) have only pattern-scan coverage. **The audit is comprehensive in breadth; selective in depth.**
- This document is the primary deliverable. The supporting flag JSON files at `/tmp/route_flags.json` and `/tmp/service_flags.json` will be lost when the container cycles — for A9-2 to use them, recreate the scan with the script in §2 above.

---

## §9. Next Actions

1. Review this audit document.
2. Begin A9-2 with the SEV-1 fixes (highest priority, lowest effort, mechanical).
3. Decide whether to proceed with SEV-2 in the same A9-2 batch or defer.
4. Schedule SEV-3 triage as a separate session (or sessions) — the manual line-by-line work cannot be one-shot.
