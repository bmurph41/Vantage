/**
 * Tenant isolation / IDOR security test suite.
 *
 * Creates two isolated test organisations, seeds one record per entity type
 * under Org A, then probes every read/write/delete endpoint from Org B's
 * authenticated session.  Any 2xx response is reported as a LEAK and causes
 * the process to exit with code 1.
 *
 * Setup failures are treated as hard errors — the run exits non-zero
 * immediately rather than skipping probes that would mask coverage gaps.
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
  cddDocuments,
  rentRolls,
  projects,
  modelingProjects,
} from "../shared/schema.js";
import { inArray, ilike, sql as sqlTag } from "drizzle-orm";
import bcrypt from "bcrypt";

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = `http://localhost:${process.env.PORT ?? 5000}`;
const TEST_PASSWORD = "IsolationTest#9!";
const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Minimum number of probes that must execute before we trust the results.
 * Raising this forces the test to fail if large chunks of setup silently skipped.
 */
const MIN_EXPECTED_PROBES = 18;

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
// Strict setup helper — creation failure exits immediately
// ─────────────────────────────────────────────────────────────────────────────

async function mustCreate(
  label: string,
  session: Session,
  path: string,
  body: Record<string, unknown>,
): Promise<any> {
  const result = await apiPost(session, path, body);
  if (result.status >= 300) {
    throw new Error(
      `[setup] FATAL: ${label} creation failed (${result.status}): ${JSON.stringify(result.json)}`
    );
  }
  return result.json;
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

  await db.delete(cddDocuments).where(
    sqlTag`project_id IN (SELECT id FROM projects WHERE org_id = ANY(ARRAY[${sqlTag.join(testOrgIds.map(id => sqlTag`${id}::text`), sqlTag`, `)}]))`
  );
  await db.delete(modelingProjects).where(inArray(modelingProjects.orgId, testOrgIds));
  await db.delete(projects).where(inArray(projects.orgId, testOrgIds));
  await db.delete(rentRolls).where(inArray(rentRolls.orgId, testOrgIds));

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

  // ── 3. Create Org A records (strict — any failure aborts the run) ─────────
  console.log("[setup] creating Org A records…\n");

  // CRM Deal
  const deal = await mustCreate("CRM deal", sessionA, "/api/crm/deals", {
    title: "__test_isolation_deal",
    orgId: orgA.id,
    stage: "lead",
  });

  // CRM Contact
  const contact = await mustCreate("CRM contact", sessionA, "/api/crm/contacts", {
    firstName: "__test",
    lastName: "isolation_contact",
    orgId: orgA.id,
  });

  // DD Project
  const ddProjectRaw = await mustCreate("DD project", sessionA, "/api/dd/projects", {
    name: "__test_isolation_dd_project",
  });
  const ddProjectId = ddProjectRaw?.project?.id ?? ddProjectRaw?.id;
  if (!ddProjectId) throw new Error("[setup] FATAL: DD project response missing id field");

  // DD Document — inserted directly (avoids multipart file-upload requirement)
  const [cddDoc] = await db
    .insert(cddDocuments)
    .values({
      projectId: ddProjectId,
      filename: "__test_isolation_document.pdf",
      mimeType: "application/pdf",
      size: 0,
      storagePath: "/dev/null",
      uploadedBy: userA.id,
    })
    .returning();
  if (!cddDoc?.id) throw new Error("[setup] FATAL: CDD document insert failed");

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
  if (!modelingProject?.id) throw new Error("[setup] FATAL: Modeling project insert failed");

  // Rent Roll — inserted directly (avoids pack-guard middleware)
  const [rentRoll] = await db
    .insert(rentRolls)
    .values({
      orgId: orgA.id,
      name: "__test_isolation_rent_roll",
      effectiveDate: "2024-01-01",
    })
    .returning();
  if (!rentRoll?.id) throw new Error("[setup] FATAL: Rent roll insert failed");

  // ── 4. Cross-tenant probes from Org B ────────────────────────────────────
  console.log("[probes] cross-tenant access from Org B:\n");

  // ── CRM Deals
  console.log("  ── CRM Deals (/api/crm/deals)");
  record("crm-deal PUT", "PUT", `/api/crm/deals/${deal.id}`, await probe("PUT", `/api/crm/deals/${deal.id}`, sessionB, { title: "INJECTED" }));
  record("crm-deal DELETE", "DELETE", `/api/crm/deals/${deal.id}`, await probe("DELETE", `/api/crm/deals/${deal.id}`, sessionB));

  console.log("  ── Deals (/api/deals)");
  record("deal GET", "GET", `/api/deals/${deal.id}`, await probe("GET", `/api/deals/${deal.id}`, sessionB));
  record("deal PUT", "PUT", `/api/deals/${deal.id}`, await probe("PUT", `/api/deals/${deal.id}`, sessionB, { title: "INJECTED" }));
  record("deal DELETE", "DELETE", `/api/deals/${deal.id}`, await probe("DELETE", `/api/deals/${deal.id}`, sessionB));

  // ── CRM Contacts
  console.log("  ── CRM Contacts (/api/crm/contacts)");
  record("crm-contact PUT", "PUT", `/api/crm/contacts/${contact.id}`, await probe("PUT", `/api/crm/contacts/${contact.id}`, sessionB, { firstName: "INJECTED" }));
  record("crm-contact DELETE", "DELETE", `/api/crm/contacts/${contact.id}`, await probe("DELETE", `/api/crm/contacts/${contact.id}`, sessionB));

  console.log("  ── Contacts (/api/contacts)");
  record("contact GET", "GET", `/api/contacts/${contact.id}`, await probe("GET", `/api/contacts/${contact.id}`, sessionB));
  record("contact PUT", "PUT", `/api/contacts/${contact.id}`, await probe("PUT", `/api/contacts/${contact.id}`, sessionB, { firstName: "INJECTED" }));
  record("contact DELETE", "DELETE", `/api/contacts/${contact.id}`, await probe("DELETE", `/api/contacts/${contact.id}`, sessionB));

  // ── DD Projects
  console.log("  ── DD Projects (/api/dd/projects)");
  record("dd-project GET", "GET", `/api/dd/projects/${ddProjectId}`, await probe("GET", `/api/dd/projects/${ddProjectId}`, sessionB));
  record("dd-project PATCH", "PATCH", `/api/dd/projects/${ddProjectId}`, await probe("PATCH", `/api/dd/projects/${ddProjectId}`, sessionB, { name: "INJECTED" }));
  record("dd-project DELETE", "DELETE", `/api/dd/projects/${ddProjectId}`, await probe("DELETE", `/api/dd/projects/${ddProjectId}`, sessionB));

  // ── DD Documents
  console.log("  ── DD Documents (/api/dd/documents)");
  record("dd-document GET", "GET", `/api/dd/documents/${cddDoc.id}`, await probe("GET", `/api/dd/documents/${cddDoc.id}`, sessionB));
  record("dd-document DELETE", "DELETE", `/api/dd/documents/${cddDoc.id}`, await probe("DELETE", `/api/dd/documents/${cddDoc.id}`, sessionB));

  // ── Modeling Projects
  console.log("  ── Modeling Projects (/api/modeling/projects)");
  record("modeling-project GET", "GET", `/api/modeling/projects/${modelingProject.id}`, await probe("GET", `/api/modeling/projects/${modelingProject.id}`, sessionB));
  record("modeling-project PATCH", "PATCH", `/api/modeling/projects/${modelingProject.id}`, await probe("PATCH", `/api/modeling/projects/${modelingProject.id}`, sessionB, { name: "INJECTED" }));
  record("modeling-project DELETE", "DELETE", `/api/modeling/projects/${modelingProject.id}`, await probe("DELETE", `/api/modeling/projects/${modelingProject.id}`, sessionB));

  // ── Rent Rolls
  console.log("  ── Rent Rolls (/api/operations/rent-rolls)");
  record("rent-roll GET", "GET", `/api/operations/rent-rolls/${rentRoll.id}`, await probe("GET", `/api/operations/rent-rolls/${rentRoll.id}`, sessionB));
  record("rent-roll PATCH", "PATCH", `/api/operations/rent-rolls/${rentRoll.id}`, await probe("PATCH", `/api/operations/rent-rolls/${rentRoll.id}`, sessionB, { name: "INJECTED" }));
  record("rent-roll DELETE", "DELETE", `/api/operations/rent-rolls/${rentRoll.id}`, await probe("DELETE", `/api/operations/rent-rolls/${rentRoll.id}`, sessionB));

  // ── 5. Cleanup ────────────────────────────────────────────────────────────
  await cleanup(orgA.id, orgB.id);

  // ── 6. Summary ────────────────────────────────────────────────────────────
  const leaks = results.filter((r) => !r.pass);
  const passed = results.filter((r) => r.pass).length;

  console.log("=".repeat(60));
  console.log(`  Results: ${passed} / ${results.length} passed`);

  if (results.length < MIN_EXPECTED_PROBES) {
    console.log(`  FAILED — only ${results.length} probes ran (expected ≥ ${MIN_EXPECTED_PROBES}).`);
    console.log("  This likely means setup fixtures were created but probes were skipped.");
    console.log("=".repeat(60));
    process.exit(1);
  }

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
