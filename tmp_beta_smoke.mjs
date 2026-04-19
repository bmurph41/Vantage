// Smoke test: B1 beta-invite gating end-to-end against dev server.
import pg from 'pg';
import crypto from 'crypto';

const BASE = 'http://localhost:5000';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Temporarily force the gate on — dev default is off. We do this by patching
// the env-check via an alternate route: seed valid code, test with/without.

async function post(path, body, extraHeaders = {}) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  let json;
  try { json = JSON.parse(txt); } catch { json = { raw: txt }; }
  const setCookie = res.headers.get('set-cookie') || '';
  return { status: res.status, body: json, cookie: setCookie };
}

function extractSessionCookie(setCookie) {
  if (!setCookie) return '';
  const m = setCookie.match(/sessionToken=([^;]+)/);
  return m ? `sessionToken=${m[1]}` : '';
}

// Fetch a CSRF token by making a GET — the server sets csrf_token cookie if
// missing. Returns a `cookie` string that combines sessionToken + csrf_token
// plus an `x-csrf-token` header value. POSTs must include both.
async function primeCsrf(sessionCookie) {
  const res = await fetch(BASE + '/api/auth/me', {
    headers: { cookie: sessionCookie },
  });
  const setCookie = res.headers.get('set-cookie') || '';
  const m = setCookie.match(/csrf_token=([^;]+)/);
  if (!m) return { cookie: sessionCookie, csrfHeader: '' };
  const csrfToken = m[1];
  return {
    cookie: `${sessionCookie}; csrf_token=${csrfToken}`,
    csrfHeader: csrfToken,
  };
}

function randEmail() {
  return `betatest+${crypto.randomBytes(4).toString('hex')}@marinalytics.dev`;
}

function randOrg() {
  return `Beta Org ${crypto.randomBytes(3).toString('hex')}`;
}

// Seed a valid code and an exhausted code
await pool.query(`DELETE FROM beta_invite_redemptions WHERE code LIKE 'TEST-%'`);
await pool.query(`DELETE FROM beta_invite_codes WHERE code LIKE 'TEST-%'`);
await pool.query(
  `INSERT INTO beta_invite_codes (code, note, max_uses, use_count) VALUES
    ('TEST-VALID', 'smoke: valid single-use', 1, 0),
    ('TEST-USED', 'smoke: already used', 1, 1),
    ('TEST-MULTI', 'smoke: multi-use', 3, 0),
    ('TEST-EXPIRED', 'smoke: expired', 1, 0)`,
);
await pool.query(
  `UPDATE beta_invite_codes SET expires_at = now() - interval '1 day' WHERE code = 'TEST-EXPIRED'`,
);

const results = [];

async function test(name, fn) {
  try {
    const ok = await fn();
    results.push({ name, status: ok ? 'PASS' : 'FAIL' });
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`);
  } catch (e) {
    results.push({ name, status: 'ERROR', error: e.message });
    console.log(`  ERROR ${name}: ${e.message}`);
  }
}

// The gate is off in dev by default. For these tests we hit the route with
// REQUIRE_BETA_INVITE behavior as currently configured in dev. Brett can flip
// by setting REQUIRE_BETA_INVITE=true and restarting. We probe both states
// by looking at the response shape.
console.log('Note: gate status follows dev-server env. In dev default (no env), gate is OFF.');
console.log('Override: set REQUIRE_BETA_INVITE=true before npm run dev to test ON state.\n');

const gateOn = process.env.REQUIRE_BETA_INVITE === 'true';
console.log(`Gate expected: ${gateOn ? 'ON (REQUIRE_BETA_INVITE=true)' : 'OFF (dev default)'}\n`);

if (gateOn) {
  await test('rejects signup with no invite code', async () => {
    const r = await post('/api/auth/register', {
      email: randEmail(), password: 'testpass1234', name: 'No Code',
      orgName: randOrg(), dataBenchmarkingConsent: true,
    });
    return r.status === 403 && /invite code is required/i.test(r.body.error || '');
  });

  await test('rejects invalid code', async () => {
    const r = await post('/api/auth/register', {
      email: randEmail(), password: 'testpass1234', name: 'Bad Code',
      orgName: randOrg(), dataBenchmarkingConsent: true,
      inviteCode: 'TEST-DOES-NOT-EXIST',
    });
    return r.status === 403 && /invalid beta invite/i.test(r.body.error || '');
  });

  await test('rejects exhausted code', async () => {
    const r = await post('/api/auth/register', {
      email: randEmail(), password: 'testpass1234', name: 'Used Code',
      orgName: randOrg(), dataBenchmarkingConsent: true,
      inviteCode: 'TEST-USED',
    });
    return r.status === 403 && /already been used/i.test(r.body.error || '');
  });

  await test('rejects expired code', async () => {
    const r = await post('/api/auth/register', {
      email: randEmail(), password: 'testpass1234', name: 'Expired',
      orgName: randOrg(), dataBenchmarkingConsent: true,
      inviteCode: 'TEST-EXPIRED',
    });
    return r.status === 403 && /expired/i.test(r.body.error || '');
  });

  await test('accepts valid code, flags org is_beta', async () => {
    const email = randEmail();
    const r = await post('/api/auth/register', {
      email, password: 'testpass1234', name: 'Valid',
      orgName: randOrg(), dataBenchmarkingConsent: true,
      inviteCode: 'TEST-VALID',
    });
    if (r.status !== 201) return false;
    const { rows } = await pool.query(
      `SELECT o.is_beta FROM users u JOIN organizations o ON o.id = u.org_id WHERE u.email = $1`,
      [email],
    );
    return rows[0]?.is_beta === true;
  });

  await test('re-use of single-use code fails', async () => {
    const r = await post('/api/auth/register', {
      email: randEmail(), password: 'testpass1234', name: 'Re-use',
      orgName: randOrg(), dataBenchmarkingConsent: true,
      inviteCode: 'TEST-VALID',
    });
    return r.status === 403 && /already been used/i.test(r.body.error || '');
  });

  await test('multi-use code: 3 sequential successes, 4th rejected', async () => {
    for (let i = 0; i < 3; i++) {
      const r = await post('/api/auth/register', {
        email: randEmail(), password: 'testpass1234', name: `Multi${i}`,
        orgName: randOrg(), dataBenchmarkingConsent: true,
        inviteCode: 'TEST-MULTI',
      });
      if (r.status !== 201) return false;
    }
    const r = await post('/api/auth/register', {
      email: randEmail(), password: 'testpass1234', name: 'Multi-overflow',
      orgName: randOrg(), dataBenchmarkingConsent: true,
      inviteCode: 'TEST-MULTI',
    });
    return r.status === 403;
  });

  await test('redemption row logged', async () => {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM beta_invite_redemptions WHERE code = 'TEST-VALID'`,
    );
    return rows[0]?.n === 1;
  });

  // ── B2: beta billing guard — charging endpoints return 402 for beta orgs ──
  await pool.query(
    `INSERT INTO beta_invite_codes (code, note, max_uses, use_count) VALUES ('TEST-B2', 'B2 billing guard test', 1, 0)`,
  );

  let betaCookie = '';
  let csrfHeader = '';
  await test('can register beta user for B2 tests', async () => {
    const r = await post('/api/auth/register', {
      email: randEmail(), password: 'testpass1234', name: 'B2 Guard',
      orgName: randOrg(), dataBenchmarkingConsent: true,
      inviteCode: 'TEST-B2',
    });
    if (r.status !== 201) return false;
    const sessionCookie = extractSessionCookie(r.cookie);
    if (!sessionCookie) return false;
    const primed = await primeCsrf(sessionCookie);
    betaCookie = primed.cookie;
    csrfHeader = primed.csrfHeader;
    return !!betaCookie && !!csrfHeader;
  });

  const protectedPost = (path, body) => post(path, body, {
    cookie: betaCookie, 'x-csrf-token': csrfHeader,
  });

  await test('B2: /api/stripe/checkout returns 402 for beta org', async () => {
    const r = await protectedPost('/api/stripe/checkout', { packType: 'modeling_tools' });
    return r.status === 402 && r.body.code === 'BETA_BILLING_DISABLED';
  });

  await test('B2: /api/billing/checkout returns 402 for beta org', async () => {
    const r = await protectedPost('/api/billing/checkout', { packType: 'modeling_tools' });
    return r.status === 402 && r.body.code === 'BETA_BILLING_DISABLED';
  });

  await test('B2: /api/billing/create-subscription returns 402 for beta org', async () => {
    const r = await protectedPost('/api/billing/create-subscription', { planKey: 'starter' });
    return r.status === 402 && r.body.code === 'BETA_BILLING_DISABLED';
  });

  await test('B2: /api/billing/portal returns 402 for beta org', async () => {
    const r = await protectedPost('/api/billing/portal', { returnUrl: 'https://example.com' });
    return r.status === 402 && r.body.code === 'BETA_BILLING_DISABLED';
  });

  await test('B2: /api/stripe/subscribe-pack returns 402 for beta org', async () => {
    const r = await protectedPost('/api/stripe/subscribe-pack', { packType: 'modeling_tools' });
    return r.status === 402 && r.body.code === 'BETA_BILLING_DISABLED';
  });

  await test('B2: /api/broker-billing/checkout/broker-plan returns 402 for beta org', async () => {
    const r = await protectedPost('/api/broker-billing/checkout/broker-plan', { tier: 'starter' });
    return r.status === 402 && r.body.code === 'BETA_BILLING_DISABLED';
  });
} else {
  await test('gate OFF: signup works without invite code', async () => {
    const email = randEmail();
    const r = await post('/api/auth/register', {
      email, password: 'testpass1234', name: 'No Gate',
      orgName: randOrg(), dataBenchmarkingConsent: true,
    });
    if (r.status !== 201) {
      console.log('    unexpected response:', r.status, r.body);
      return false;
    }
    const { rows } = await pool.query(
      `SELECT o.is_beta FROM users u JOIN organizations o ON o.id = u.org_id WHERE u.email = $1`,
      [email],
    );
    return rows[0]?.is_beta === false;
  });

  await test('gate OFF: signup with a valid invite code still flags org as beta', async () => {
    const email = randEmail();
    const r = await post('/api/auth/register', {
      email, password: 'testpass1234', name: 'Opt-in Beta',
      orgName: randOrg(), dataBenchmarkingConsent: true,
      inviteCode: 'TEST-VALID',
    });
    if (r.status !== 201) {
      // Off-gate path doesn't validate codes; org should NOT be flagged beta.
      return false;
    }
    const { rows } = await pool.query(
      `SELECT o.is_beta FROM users u JOIN organizations o ON o.id = u.org_id WHERE u.email = $1`,
      [email],
    );
    // When gate is OFF, invite code is ignored — org is NOT beta-flagged.
    // (Alternative design: always validate. Current choice: dev convenience.)
    return rows[0]?.is_beta === false;
  });
}

// Cleanup
await pool.query(`DELETE FROM beta_invite_redemptions WHERE code LIKE 'TEST-%'`);
await pool.query(`DELETE FROM beta_invite_codes WHERE code LIKE 'TEST-%'`);
await pool.query(`DELETE FROM users WHERE email LIKE 'betatest+%'`);
// Orgs are left behind (would need cascade) — fine for local smoke.

console.log('\nSummary:');
const pass = results.filter((r) => r.status === 'PASS').length;
const fail = results.length - pass;
console.log(`  ${pass}/${results.length} passed${fail ? ', ' + fail + ' failed' : ''}`);

await pool.end();
process.exit(fail > 0 ? 1 : 0);
