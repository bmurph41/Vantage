#!/usr/bin/env node
/**
 * Tax Waterfall write-path smoke test.
 *
 * Today's FK fix (2026-04-19) wired the reads, but the writes have never been
 * exercised with real data. This script drives a full round-trip:
 *   settings → 2 partners → 3 equity contributions → tax inputs
 *   → waterfall config → 3-tier tier definition → GET back everything
 *
 * Must run against a dev server (localhost:5000) with an authenticated
 * session cookie. Uses the first modeling_projects row in the test org.
 *
 *   node scripts/smoke-tax-waterfall-writes.mjs
 */

import pg from 'pg';
import crypto from 'crypto';

const BASE = 'http://localhost:5000';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function http(method, path, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  let json;
  try { json = JSON.parse(txt); } catch { json = { raw: txt }; }
  const setCookie = res.headers.get('set-cookie') || '';
  return { status: res.status, body: json, setCookie };
}

function extractCookie(setCookie, name) {
  const m = setCookie && setCookie.match(new RegExp(`${name}=([^;]+)`));
  return m ? m[1] : null;
}

const results = [];
function record(name, ok, detail = '') {
  results.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

// 1) Find the test org + first modeling project.
const orgRow = await pool.query(`SELECT id FROM organizations WHERE id = 'cd3719c3-ef82-4ccc-acb9-261c80fb64b4' LIMIT 1`);
if (orgRow.rowCount === 0) {
  console.error('Test org not found (cd3719c3-ef82-4ccc-acb9-261c80fb64b4). Seed first.');
  process.exit(2);
}
const testOrgId = orgRow.rows[0].id;

const projRow = await pool.query(
  `SELECT id, marina_name FROM modeling_projects WHERE org_id = $1 ORDER BY created_at LIMIT 1`,
  [testOrgId],
);
if (projRow.rowCount === 0) {
  console.error('No modeling project exists in test org. Seed first.');
  process.exit(2);
}
const projectId = projRow.rows[0].id;
console.log(`Testing against project ${projectId} (${projRow.rows[0].marina_name || 'unnamed'})\n`);

// 2) Create a test user + sign them in to get a session + CSRF cookie pair.
// We need a user that passes the tenant middleware for this org.
const existingUserRow = await pool.query(
  `SELECT id FROM users WHERE org_id = $1 AND is_active = true ORDER BY created_at LIMIT 1`,
  [testOrgId],
);
let userId, sessionToken;

if (existingUserRow.rowCount > 0) {
  // Create a session directly in DB for an existing user (skip password auth).
  userId = existingUserRow.rows[0].id;
  sessionToken = crypto.randomUUID();
  await pool.query(
    `INSERT INTO user_sessions (id, user_id, org_id, session_token, expires_at, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, now() + interval '1 hour', now())`,
    [userId, testOrgId, sessionToken],
  );
  console.log(`Using existing user ${userId} with fresh session\n`);
} else {
  console.error('No active user in test org. Seed first.');
  process.exit(2);
}

// Prime CSRF via a GET.
const meRes = await fetch(BASE + '/api/auth/me', { headers: { cookie: `sessionToken=${sessionToken}` } });
const csrfToken = extractCookie(meRes.headers.get('set-cookie') || '', 'csrf_token');
if (!csrfToken) {
  console.error('Failed to obtain CSRF token.');
  process.exit(2);
}
const cookie = `sessionToken=${sessionToken}; csrf_token=${csrfToken}`;
const authHeaders = { cookie, 'x-csrf-token': csrfToken };

// 3) Clean any prior test data in this project so the smoke is deterministic.
console.log('Cleaning prior test-run data…');
await pool.query(`DELETE FROM waterfall_tiers WHERE waterfall_config_id IN (SELECT id FROM waterfall_configs WHERE project_id = $1)`, [projectId]);
await pool.query(`DELETE FROM waterfall_configs WHERE project_id = $1`, [projectId]);
await pool.query(`DELETE FROM project_equity_contributions WHERE project_id = $1`, [projectId]);
await pool.query(`DELETE FROM project_partners WHERE project_id = $1`, [projectId]);
await pool.query(`DELETE FROM project_tax_inputs WHERE project_id = $1`, [projectId]);
await pool.query(`DELETE FROM project_tax_settings WHERE project_id = $1`, [projectId]);
console.log('Cleaned.\n');

// ── Round-trip tests ───────────────────────────────────────────────────────
const base = `/api/tax-waterfall/projects/${projectId}`;

// A. PUT settings
{
  const r = await http('PUT', `${base}/settings`, {
    enabled: true,
    taxMode: 'flat',
    taxTiming: 'annual',
    taxInteractionMode: 'waterfall_pre_tax',
  }, authHeaders);
  record('PUT settings', r.status === 200 && r.body.enabled === true,
    r.status !== 200 ? `status=${r.status} body=${JSON.stringify(r.body).slice(0, 150)}` : '');
}

// B. Verify GET settings round-trip
{
  const r = await http('GET', `${base}/settings`, null, authHeaders);
  record('GET settings round-trip', r.status === 200 && r.body.enabled === true && r.body.taxMode === 'flat',
    r.status !== 200 ? `status=${r.status}` : '');
}

// C. POST partner x2
let lpPartnerId, gpPartnerId;
{
  const r1 = await http('POST', `${base}/partners`, {
    name: 'Smoke LP Investors', role: 'lp', entityType: 'entity', ownershipPercent: '80',
  }, authHeaders);
  lpPartnerId = r1.body?.id;
  record('POST partner (LP)', r1.status === 201 && !!lpPartnerId,
    r1.status !== 201 ? `status=${r1.status} body=${JSON.stringify(r1.body).slice(0, 150)}` : '');

  const r2 = await http('POST', `${base}/partners`, {
    name: 'Smoke GP Sponsor', role: 'gp', entityType: 'entity', ownershipPercent: '20',
  }, authHeaders);
  gpPartnerId = r2.body?.id;
  record('POST partner (GP)', r2.status === 201 && !!gpPartnerId);
}

// D. GET partners list
{
  const r = await http('GET', `${base}/partners`, null, authHeaders);
  record('GET partners list returns 2 rows', r.status === 200 && Array.isArray(r.body) && r.body.length === 2);
}

// E. POST equity contributions x3 (initial LP, initial GP, follow-on LP)
{
  const r1 = await http('POST', `${base}/equity-contributions`, {
    partnerId: lpPartnerId, date: '2024-01-01', amountCents: '800000000', // $8M
  }, authHeaders);
  record('POST equity-contribution 1 (LP initial)', r1.status === 201 && !!r1.body?.id,
    r1.status !== 201 ? `status=${r1.status} body=${JSON.stringify(r1.body).slice(0, 200)}` : '');

  const r2 = await http('POST', `${base}/equity-contributions`, {
    partnerId: gpPartnerId, date: '2024-01-01', amountCents: '200000000', // $2M
  }, authHeaders);
  record('POST equity-contribution 2 (GP initial)', r2.status === 201);

  const r3 = await http('POST', `${base}/equity-contributions`, {
    partnerId: lpPartnerId, date: '2024-07-01', amountCents: '150000000', // $1.5M
  }, authHeaders);
  record('POST equity-contribution 3 (LP follow-on)', r3.status === 201);
}

// F. GET equity contributions
{
  const r = await http('GET', `${base}/equity-contributions`, null, authHeaders);
  record('GET equity-contributions returns 3 rows', r.status === 200 && Array.isArray(r.body) && r.body.length === 3);
}

// G. PUT tax inputs
{
  const r = await http('PUT', `${base}/tax-inputs`, {
    depreciationMethod: 'simple_building_life',
    buildingBasisCents: '4000000000', // $40M
    buildingLifeYears: 39,
    interestDeductible: true,
    bonusDepreciationPercent: '0.6',
  }, authHeaders);
  record('PUT tax-inputs', r.status === 200 && r.body?.depreciationMethod === 'simple_building_life',
    r.status !== 200 ? `status=${r.status} body=${JSON.stringify(r.body).slice(0, 200)}` : '');
}

// H. POST waterfall config
let configId;
{
  const r = await http('POST', `${base}/waterfall`, {
    name: 'Smoke Pref + Catch-up + 80/20',
    templateType: 'pref_catchup',
    isActive: true,
  }, authHeaders);
  configId = r.body?.id;
  record('POST waterfall config', r.status === 201 && !!configId,
    r.status !== 201 ? `status=${r.status} body=${JSON.stringify(r.body).slice(0, 200)}` : '');
}

// I. PUT waterfall tiers (3 tiers: RoC → Pref 8% → 80/20 split)
if (configId) {
  const r = await http('PUT', `${base}/waterfall/${configId}/tiers`, [
    { tierOrder: 1, tierType: 'return_of_capital' },
    { tierOrder: 2, tierType: 'preferred_return', prefRate: '0.08' },
    { tierOrder: 3, tierType: 'split', lpSplit: '80', gpSplit: '20' },
  ], authHeaders);
  record('PUT 3-tier waterfall', r.status === 200 && Array.isArray(r.body) && r.body.length === 3,
    r.status !== 200 ? `status=${r.status} body=${JSON.stringify(r.body).slice(0, 200)}` : '');
}

// J. GET full waterfall with tiers and validate round-trip.
// NOTE: enabling settings auto-seeds a "Default Straight Split" config, so we
// expect 2 configs: the default + our smoke-created one. We validate by name.
{
  const r = await http('GET', `${base}/waterfall`, null, authHeaders);
  const smoke = Array.isArray(r.body) && r.body.find(c => c.name === 'Smoke Pref + Catch-up + 80/20');
  const ok = r.status === 200
    && Array.isArray(r.body)
    && r.body.length >= 1
    && !!smoke
    && smoke.tiers?.length === 3
    && smoke.tiers[1].tierType === 'preferred_return'
    && smoke.tiers[1].prefRate === '0.080000';
  record('GET waterfall with tiers round-trip', ok,
    !ok ? `status=${r.status} body=${JSON.stringify(r.body).slice(0, 400)}` : '');
}

// K. Reject invalid tier split (validation path)
if (configId) {
  const r = await http('PUT', `${base}/waterfall/${configId}/tiers`, [
    { tierOrder: 1, tierType: 'split', lpSplit: '70', gpSplit: '40' }, // sums to 110 — invalid
  ], authHeaders);
  record('PUT waterfall rejects split ≠ 100', r.status === 400);
}

// Cleanup session
await pool.query(`DELETE FROM user_sessions WHERE session_token = $1`, [sessionToken]);

// Summary
const pass = results.filter((r) => r.status === 'PASS').length;
console.log(`\nSummary: ${pass}/${results.length} passed`);
await pool.end();
process.exit(pass === results.length ? 0 : 1);
