/**
 * Backfill: encrypt existing contact PII on broker_portal_submissions.
 *
 * Safe to re-run. Uses the `enc:` sentinel on the ciphertext so already-
 * encrypted rows are skipped. Reads PII_ENCRYPTION_KEY (preferred) or
 * QB_ENCRYPTION_KEY from env. Aborts if neither is set so we don't silently
 * leave PII in plaintext.
 *
 * Usage: node scripts/backfill_encrypt_broker_submissions.mjs
 */

import pg from 'pg';
import crypto from 'crypto';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const KEY_SOURCE = process.env.PII_ENCRYPTION_KEY || process.env.QB_ENCRYPTION_KEY;
if (!KEY_SOURCE) {
  console.error('ERROR: PII_ENCRYPTION_KEY (or QB_ENCRYPTION_KEY) must be set. Aborting.');
  process.exit(1);
}

const key =
  KEY_SOURCE.length === 64 && /^[0-9a-fA-F]+$/.test(KEY_SOURCE)
    ? Buffer.from(KEY_SOURCE, 'hex')
    : crypto.scryptSync(KEY_SOURCE, 'marinalytics-pii-salt', 32);

function encrypt(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') return plaintext;
  if (plaintext.startsWith('enc:')) return plaintext;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function redactPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const out = { ...payload };
  for (const k of ['contactName', 'contactEmail', 'contactPhone', 'contact_name', 'contact_email', 'contact_phone']) {
    if (k in out) delete out[k];
  }
  return out;
}

async function run() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, contact_name, contact_email, contact_phone, raw_payload
         FROM broker_portal_submissions
        WHERE contact_name IS NOT NULL
           OR contact_email IS NOT NULL
           OR contact_phone IS NOT NULL
           OR raw_payload IS NOT NULL`,
    );

    let touched = 0;
    let skipped = 0;
    await client.query('BEGIN');
    for (const row of rows) {
      const name = encrypt(row.contact_name);
      const email = encrypt(row.contact_email);
      const phone = encrypt(row.contact_phone);
      const payload = redactPayload(row.raw_payload);

      const nothingChanged =
        name === row.contact_name &&
        email === row.contact_email &&
        phone === row.contact_phone &&
        JSON.stringify(payload) === JSON.stringify(row.raw_payload);

      if (nothingChanged) {
        skipped += 1;
        continue;
      }

      await client.query(
        `UPDATE broker_portal_submissions
            SET contact_name = $1,
                contact_email = $2,
                contact_phone = $3,
                raw_payload = $4,
                updated_at = now()
          WHERE id = $5`,
        [name, email, phone, payload, row.id],
      );
      touched += 1;
    }
    await client.query('COMMIT');
    console.log(
      `Backfill complete. Encrypted ${touched} row(s). Skipped ${skipped} row(s) that were already encrypted.`,
    );
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
