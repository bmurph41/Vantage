import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const ENCODING = 'hex' as const;

let _keyWarningLogged = false;

// Key from environment — must be 32 bytes (64 hex chars)
function getEncryptionKey(): Buffer | null {
  const key = process.env.PII_ENCRYPTION_KEY || process.env.QB_ENCRYPTION_KEY;
  if (!key) {
    if (!_keyWarningLogged) {
      console.warn('[encryption-service] PII_ENCRYPTION_KEY or QB_ENCRYPTION_KEY not set — PII encryption disabled');
      _keyWarningLogged = true;
    }
    return null;
  }
  // If key is hex-encoded (64 chars), decode it
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, 'hex');
  }
  // Otherwise derive a key from the string
  return crypto.scryptSync(key, 'marinalytics-pii-salt', 32);
}

export function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext;
  // Don't double-encrypt
  if (isEncrypted(plaintext)) return plaintext;

  const key = getEncryptionKey();
  if (!key) return plaintext; // gracefully pass through if no key configured

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', ENCODING);
  encrypted += cipher.final(ENCODING);
  const authTag = cipher.getAuthTag();
  // Format: enc:<iv>:<authTag>:<ciphertext>
  return `enc:${iv.toString(ENCODING)}:${authTag.toString(ENCODING)}:${encrypted}`;
}

export function decrypt(encryptedValue: string): string {
  if (!encryptedValue || !encryptedValue.startsWith('enc:')) return encryptedValue;
  const parts = encryptedValue.split(':');
  if (parts.length !== 4) throw new Error('Invalid encrypted value format');

  const key = getEncryptionKey();
  if (!key) {
    console.warn('[encryption-service] Cannot decrypt — no encryption key configured');
    return encryptedValue;
  }

  const [, ivHex, authTagHex, ciphertext] = parts;
  const iv = Buffer.from(ivHex, ENCODING);
  const authTag = Buffer.from(authTagHex, ENCODING);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext, ENCODING, 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function isEncrypted(value: string): boolean {
  return typeof value === 'string' && value.startsWith('enc:');
}

// Mask a value for display (e.g., SSN: ***-**-1234)
export function maskSSN(ssn: string): string {
  if (!ssn) return '';
  const clean = ssn.replace(/\D/g, '');
  if (clean.length < 4) return '***';
  return `***-**-${clean.slice(-4)}`;
}

export function maskTaxId(taxId: string): string {
  if (!taxId) return '';
  const clean = taxId.replace(/\D/g, '');
  if (clean.length < 4) return '***';
  return `**-***${clean.slice(-4)}`;
}

/**
 * Encrypt PII fields on a request body object (mutates in-place).
 * Handles ssn and taxId fields. Skips already-encrypted values.
 */
export function encryptPiiFields(body: Record<string, any>): void {
  if (body.ssn && !isEncrypted(body.ssn)) {
    body.ssn = encrypt(body.ssn);
  }
  if (body.taxId && !isEncrypted(body.taxId)) {
    body.taxId = encrypt(body.taxId);
  }
}

/**
 * Process an investor record for API response, handling PII decryption/masking.
 * - Admin/owner roles: decrypt and return full values
 * - Other roles: return masked values
 */
export function processInvestorPii(
  investor: Record<string, any>,
  userRole?: string
): Record<string, any> {
  if (!investor) return investor;

  const result = { ...investor };
  const isPrivileged = userRole === 'admin' || userRole === 'owner';

  if (result.taxId) {
    if (isEncrypted(result.taxId)) {
      if (isPrivileged) {
        try {
          result.taxId = decrypt(result.taxId);
        } catch (e) {
          console.error('[encryption-service] Failed to decrypt taxId:', e);
          result.taxId = maskTaxId('0000');
        }
      } else {
        // Decrypt to mask, but only show masked version
        try {
          const decrypted = decrypt(result.taxId);
          result.taxId = maskTaxId(decrypted);
        } catch (e) {
          result.taxId = '**-***----';
        }
      }
    } else if (!isPrivileged) {
      // Unencrypted but non-privileged user — still mask
      result.taxId = maskTaxId(result.taxId);
    }
  }

  if (result.ssn) {
    if (isEncrypted(result.ssn)) {
      if (isPrivileged) {
        try {
          result.ssn = decrypt(result.ssn);
        } catch (e) {
          console.error('[encryption-service] Failed to decrypt ssn:', e);
          result.ssn = maskSSN('0000');
        }
      } else {
        try {
          const decrypted = decrypt(result.ssn);
          result.ssn = maskSSN(decrypted);
        } catch (e) {
          result.ssn = '***-**-****';
        }
      }
    } else if (!isPrivileged) {
      result.ssn = maskSSN(result.ssn);
    }
  }

  return result;
}
