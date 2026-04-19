#!/usr/bin/env node
/**
 * Beta invite code CLI.
 *
 * Usage:
 *   node scripts/beta-invite.mjs generate [--count=N] [--max-uses=N] [--note="..."] [--expires-days=N]
 *   node scripts/beta-invite.mjs list
 *   node scripts/beta-invite.mjs revoke <CODE>
 *
 * Examples:
 *   node scripts/beta-invite.mjs generate --count=5 --note="Friends & Family"
 *   node scripts/beta-invite.mjs generate --max-uses=10 --note="Marina Asset Mgmt cohort"
 *   node scripts/beta-invite.mjs list
 *   node scripts/beta-invite.mjs revoke FMBETA-AB12CD
 */

import pg from 'pg';
import crypto from 'crypto';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Readable codes. Omit 0/O/1/I to prevent typos.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode(len = 6) {
  let out = 'FMBETA-';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

function parseFlags(argv) {
  const flags = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
  }
  return flags;
}

async function cmdGenerate(flags) {
  const count = parseInt(flags.count || '1', 10);
  const maxUses = parseInt(flags['max-uses'] || '1', 10);
  const note = flags.note || null;
  const expiresDays = flags['expires-days'] ? parseInt(flags['expires-days'], 10) : null;
  const expiresAt = expiresDays ? new Date(Date.now() + expiresDays * 86400 * 1000) : null;

  const rows = [];
  for (let i = 0; i < count; i++) {
    const code = generateCode();
    await pool.query(
      `INSERT INTO beta_invite_codes (code, note, max_uses, use_count, expires_at)
       VALUES ($1, $2, $3, 0, $4)`,
      [code, note, maxUses, expiresAt],
    );
    rows.push({ code, maxUses, note, expiresAt });
  }
  console.log(`Generated ${count} code(s):`);
  console.table(rows);
}

async function cmdList() {
  const { rows } = await pool.query(`
    SELECT
      c.code,
      c.note,
      c.max_uses,
      c.use_count,
      c.expires_at,
      c.created_at,
      (SELECT COUNT(*) FROM beta_invite_redemptions r WHERE r.code = c.code) AS redemptions
    FROM beta_invite_codes c
    ORDER BY c.created_at DESC
  `);
  if (rows.length === 0) {
    console.log('No invite codes issued yet.');
  } else {
    console.table(rows);
  }
}

async function cmdRevoke(code) {
  if (!code) {
    console.error('Usage: revoke <CODE>');
    process.exit(2);
  }
  // Revoke by forcing use_count to max_uses; preserves audit trail.
  const { rowCount } = await pool.query(
    `UPDATE beta_invite_codes SET use_count = max_uses WHERE code = $1`,
    [code.toUpperCase()],
  );
  if (rowCount === 0) {
    console.error(`Code not found: ${code}`);
    process.exit(1);
  }
  console.log(`Revoked ${code.toUpperCase()} (use_count forced to max_uses).`);
}

const [, , cmd, ...rest] = process.argv;
const flags = parseFlags(rest);

try {
  switch (cmd) {
    case 'generate': await cmdGenerate(flags); break;
    case 'list':     await cmdList(); break;
    case 'revoke':   await cmdRevoke(rest[0]); break;
    default:
      console.log('Usage: node scripts/beta-invite.mjs <generate|list|revoke> [flags]');
      process.exit(2);
  }
} finally {
  await pool.end();
}
