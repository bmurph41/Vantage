/**
 * Tenant isolation / IDOR security test suite.
 *
 * Creates two isolated test organisations, seeds one record per entity type
 * under Org A, then probes every read/write/delete endpoint from Org B's
 * authenticated session.  Any 2xx response is reported as a LEAK and causes
 * the process to exit with code 1.
 *
 * Usage:
 *   npm run test:isolation
 *
 * The server must already be running on PORT (default 5000).
 */

import { db } from "../server/db.js";
import {
  organizations,
  users,
  crmContacts,
  projects,
  modelingProjects,
} from "../shared/schema.js";
import { eq, inArray, ilike, sql as sqlTag } from "drizzle-orm";
import bcrypt from "bcrypt";

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = `http://localhost:${process.env.PORT ?? 5000}`;
const TEST_PASSWORD = "IsolationTest#9!";
const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";

// ─────────────────────────────────────────────────────────────────────────────
// Result tracking
// ─────────────────────────────────────────────────────────────────────────────

type TestResult = { label: string; method: string; path: string; status: number; pass: boolean };
const results: TestResult[] = [];

function record(label: string, method: string, path: string, status: number) {
  const pass = status === 403 || status === 404;
  results.push({ label, method, path, status, pass });
  const icon = pass ? "✓" : "✗ LEAK";
  console.log(`  ${icon}  [${status}] ${method} ${path}  (${label})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Session state
// ─────────────────────────────────────────────────────────────────────────────

class Session {
  sessionToken: string;
  csrfToken: string = "";

  constructor(sessionToken: string) {
    this.sessionToken = sessionToken;
  }

  cookieHeader(): string {
    let h = `sessionToken=${this.sessionToken}`;
    if (this.csrfToken) h += `; ${CSRF_COOKIE_NAME}=${this.csrfToken}`;
    return h;
  }

  updateFromResponse(res: Response) {
    const raw = res.headers.get("set-cookie") ?? "";
    const csrfMatch = raw.match(/csrf_token=([^;]+)/);
    if (csrfMatch) this.csrfToken = csrfMatch[1];
    const sessMatch = raw.match(/sessionToken=([^;]+)/);
    if (sessMatch) this.sessionToken = sessMatch[1];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP helpers
// ─────────────────────────────────────────────────────────────────────────────

async function login(email: string, password: string): Promise<Session> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Login failed for ${email}: ${res.status} ${body}`);
  }
  const setCookie = res.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/sessionToken=([^;]+)/);
  if (!match) throw new Error(`No sessionToken cookie in login response for ${email}`);
  const sess = new Session(match[1]);
  sess.updateFromResponse(res);
  return sess;
}

async function initCsrf(session: Session): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/health`, {
    headers: { Cookie: session.cookieHeader() },
  });
  session.updateFromResponse(res);
}

async function apiPost(
  session: Session,
  path: string,
  body: Record<string, unknown>,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: session.cookieHeader(),
      [CSRF_HEADER_NAME]: session.csrfToken,
    },
    body: JSON.stringify(body),
  });
  session.updateFromResponse(res);
  let json: any = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

async function probe(
  method: string,
  path: string,
  session: Session,
  body?: Record<string, unknown>,
): Promise<number> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: session.cookieHeader(),
      [CSRF_HEADER_NAME]: session.csrfToken,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  session.updateFromResponse(res);
  return res.status;
}

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers
// ─────────────────────────────────────────────────────────────────────────────

async function createTestOrg(suffix: string) {
  const [org] = await db
    .insert(organizations)
    .values({ name: `__test_isolation_org_${suffix}` })
    .returning();
  return org;
}

async function createTestUser(orgId: string, suffix: string) {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  const [user] = await db
    .insert(users)
    .values({
      orgId,
      email: `__test_isolation_${suffix.toLowerCase()}@vantage-test.invalid`,
      name: `Test User ${suffix}`,
      passwordHash,
      role: "owner",
      isActive: true,
      dataBenchmarkingConsent: true,
      consentTimestamp: new Date(),
      consentVersion: "1.0",
      tosAcceptedAt: new Date(),
      tosVersion: "1.0",
      benchmarkingOptOut: false,
    })
    .returning();
  return user;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cleanup helpers
// ─────────────────────────────────────────────────────────────────────────────

async function purgeTestOrgs(testOrgIds: string[]) {
  if (testOrgIds.length === 0) return;

  await db.delete(modelingProjects).where(inArray(modelingProjects.orgId, testOrgIds));
  await db.delete(projects).where(inArray(projects.orgId, testOrgIds));

  for (const oid of testOrgIds) {
    await db.execute(sqlTag`DELETE FROM crm_deals WHERE org_id = ${oid}`);
    await db.execute(sqlTag`DELETE FROM crm_contacts WHERE org_id = ${oid}`);
  }

  const orgUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.orgId, testOrgIds));
  for (const u of orgUsers) {
    await db.execute(sqlTag`DELETE FROM user_sessions WHERE user_id = ${u.id}`);
    await db.execute(sqlTag`DELETE FROM audit_logs WHERE user_id = ${u.id}`);
    await db.execute(sqlTag`DELETE FROM vdr_audit_logs WHERE user_id = ${u.id}`);
  }

  await db.delete(users).where(inArray(users.orgId, testOrgIds));
  await db.delete(organizations).where(inArray(organizations.id, testOrgIds));
}

async function preCleanup() {
  try {
    const testOrgs = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(ilike(organizations.name, "__test_isolation_org_%"));
    const testOrgIds = testOrgs.map((o) => o.id);
    if (testOrgIds.length === 0) return;
    await purgeTestOrgs(testOrgIds);
    console.log(`[pre-cleanup] removed ${testOrgIds.length} leftover test org(s).`);
  } catch (err) {
    console.warn("[pre-cleanup] warning (non-fatal):", (err as any).message ?? err);
  }
}

async function cleanup(orgAId: string, orgBId: string) {
  console.log("\n[cleanup] removing test data…");
  try {
    await purgeTestOrgs([orgAId, orgBId]);
    console.log("[cleanup] done.\n");
  } catch (err) {
    console.error("[cleanup] error (non-fatal):", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("  Vantage — Tenant Isolation / IDOR Test Suite");
  console.log("=".repeat(60));
  console.log(`  Server : ${BASE_URL}\n`);

  await preCleanup();

  // ── 1. Provision two test orgs ───────────────────────────────────────────
  console.log("[setup] creating test orgs and users…");
  const orgA = await createTestOrg("A");
  const orgB = await createTestOrg("B");
  const userA = await createTestUser(orgA.id, "A");
  await createTestUser(orgB.id, "B");

  // ── 2. Login and acquire CSRF tokens ─────────────────────────────────────
  console.log("[setup] logging in and acquiring CSRF tokens…");
  const sessionA = await login(userA.email, TEST_PASSWORD);
  const sessionB = await login(`__test_isolation_b@vantage-test.invalid`, TEST_PASSWORD);
  await initCsrf(sessionA);
  await initCsrf(sessionB);

  // ── 3. Create Org A records ───────────────────────────────────────────────
  console.log("[setup] creating Org A records…\n");

  // CRM Deal
  const dealResult = await apiPost(sessionA, "/api/crm/deals", {
    title: "__test_isolation_deal",
    orgId: orgA.id,
    stage: "lead",
  });
  if (dealResult.status >= 300) {
    console.warn(`  [warn] CRM deal creation failed (${dealResult.status}):`, JSON.stringify(dealResult.json));
  }
  const deal = dealResult.status < 300 ? dealResult.json : null;

  // CRM Contact
  const contactResult = await apiPost(sessionA, "/api/crm/contacts", {
    firstName: "__test",
    lastName: "isolation_contact",
    orgId: orgA.id,
  });
  if (contactResult.status >= 300) {
    console.warn(`  [warn] CRM contact creation failed (${contactResult.status}):`, JSON.stringify(contactResult.json));
  }
  const contact = contactResult.status < 300 ? contactResult.json : null;

  // DD Project
  const ddResult = await apiPost(sessionA, "/api/dd/projects", {
    name: "__test_isolation_dd_project",
  });
  if (ddResult.status >= 300) {
    console.warn(`  [warn] DD project creation failed (${ddResult.status}):`, JSON.stringify(ddResult.json));
  }
  const ddProjectRaw = ddResult.status < 300 ? ddResult.json : null;
  const ddProjectId = ddProjectRaw?.project?.id ?? ddProjectRaw?.id ?? null;

  // Modeling Project — inserted directly (avoids asset-class entitlement check)
  const [modelingProject] = await db
    .insert(modelingProjects)
    .values({
      name: "__test_isolation_modeling_project",
      marinaName: "__test_isolation",
      orgId: orgA.id,
      createdBy: userA.id,
      assetClass: "marina",
    })
    .returning();

  // ── 4. Cross-tenant probes from Org B ────────────────────────────────────
  console.log("[probes] cross-tenant access from Org B:\n");

  // ── CRM Deals (/api/crm/deals/:id)
  if (deal?.id) {
    console.log("  ── CRM Deals (/api/crm/deals)");
    record("crm-deal PUT", "PUT", `/api/crm/deals/${deal.id}`, await probe("PUT", `/api/crm/deals/${deal.id}`, sessionB, { name: "INJECTED" }));
    record("crm-deal DELETE", "DELETE", `/api/crm/deals/${deal.id}`, await probe("DELETE", `/api/crm/deals/${deal.id}`, sessionB));

    console.log("  ── Deals (/api/deals)");
    record("deal GET", "GET", `/api/deals/${deal.id}`, await probe("GET", `/api/deals/${deal.id}`, sessionB));
    record("deal PUT", "PUT", `/api/deals/${deal.id}`, await probe("PUT", `/api/deals/${deal.id}`, sessionB, { name: "INJECTED" }));
    record("deal DELETE", "DELETE", `/api/deals/${deal.id}`, await probe("DELETE", `/api/deals/${deal.id}`, sessionB));
  } else {
    console.log("  [skip] CRM deal probes — creation failed");
  }

  // ── CRM Contacts (/api/crm/contacts/:id & /api/contacts/:id)
  if (contact?.id) {
    console.log("  ── CRM Contacts (/api/crm/contacts)");
    record("crm-contact PUT", "PUT", `/api/crm/contacts/${contact.id}`, await probe("PUT", `/api/crm/contacts/${contact.id}`, sessionB, { firstName: "INJECTED" }));
    record("crm-contact DELETE", "DELETE", `/api/crm/contacts/${contact.id}`, await probe("DELETE", `/api/crm/contacts/${contact.id}`, sessionB));

    console.log("  ── Contacts (/api/contacts)");
    record("contact GET", "GET", `/api/contacts/${contact.id}`, await probe("GET", `/api/contacts/${contact.id}`, sessionB));
    record("contact PUT", "PUT", `/api/contacts/${contact.id}`, await probe("PUT", `/api/contacts/${contact.id}`, sessionB, { firstName: "INJECTED" }));
    record("contact DELETE", "DELETE", `/api/contacts/${contact.id}`, await probe("DELETE", `/api/contacts/${contact.id}`, sessionB));
  } else {
    console.log("  [skip] CRM contact probes — creation failed");
  }

  // ── DD Projects (/api/dd/projects/:id)
  if (ddProjectId) {
    console.log("  ── DD Projects (/api/dd/projects)");
    record("dd-project GET", "GET", `/api/dd/projects/${ddProjectId}`, await probe("GET", `/api/dd/projects/${ddProjectId}`, sessionB));
    record("dd-project PATCH", "PATCH", `/api/dd/projects/${ddProjectId}`, await probe("PATCH", `/api/dd/projects/${ddProjectId}`, sessionB, { name: "INJECTED" }));
    record("dd-project DELETE", "DELETE", `/api/dd/projects/${ddProjectId}`, await probe("DELETE", `/api/dd/projects/${ddProjectId}`, sessionB));
  } else {
    console.log("  [skip] DD project probes — creation failed");
  }

  // ── Modeling Projects (/api/modeling/projects/:id)
  if (modelingProject?.id) {
    const mpId = modelingProject.id;
    console.log("  ── Modeling Projects (/api/modeling/projects)");
    record("modeling-project GET", "GET", `/api/modeling/projects/${mpId}`, await probe("GET", `/api/modeling/projects/${mpId}`, sessionB));
    record("modeling-project PATCH", "PATCH", `/api/modeling/projects/${mpId}`, await probe("PATCH", `/api/modeling/projects/${mpId}`, sessionB, { name: "INJECTED" }));
    record("modeling-project DELETE", "DELETE", `/api/modeling/projects/${mpId}`, await probe("DELETE", `/api/modeling/projects/${mpId}`, sessionB));
  } else {
    console.log("  [skip] Modeling project probes — creation failed");
  }

  // ── 5. Cleanup ────────────────────────────────────────────────────────────
  await cleanup(orgA.id, orgB.id);

  // ── 6. Summary ────────────────────────────────────────────────────────────
  const leaks = results.filter((r) => !r.pass);
  const passed = results.filter((r) => r.pass).length;

  console.log("=".repeat(60));
  console.log(`  Results: ${passed} / ${results.length} passed`);
  if (leaks.length === 0) {
    console.log("  ALL CROSS-TENANT PROBES BLOCKED — no IDOR leaks found.");
  } else {
    console.log(`  FAILED — ${leaks.length} IDOR leak(s) detected:\n`);
    for (const r of leaks) {
      console.log(`    ✗  [${r.status}] ${r.method} ${r.path}  (${r.label})`);
    }
  }
  console.log("=".repeat(60));

  process.exit(leaks.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
