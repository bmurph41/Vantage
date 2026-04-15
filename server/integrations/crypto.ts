import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const ENC_PREFIX = 'enc';

function getEncryptionKey(): Buffer {
  const key = process.env.CREDENTIAL_ENCRYPTION_KEY
    || process.env.ENCRYPTION_KEY
    || process.env.JWT_SECRET;
  if (!key || key.length < 32) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY must be set with at least 32 characters');
  }
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Stored format: enc:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${ENC_PREFIX}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a string produced by encrypt().
 * Canonical format: enc:<iv_hex>:<authTag_hex>:<ciphertext_hex> (4 parts).
 * Legacy compat: also accepts old 3-part <iv_hex>:<authTag_hex>:<ciphertext_hex>
 * format that may have been stored before the enc: prefix was introduced.
 * Any other format is rejected to prevent ciphertext leakage.
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(':');

  let iv: Buffer, authTag: Buffer, encrypted: string;

  if (parts.length === 4 && parts[0] === ENC_PREFIX) {
    // Canonical format: enc:<iv>:<authTag>:<ciphertext>
    iv = Buffer.from(parts[1], 'hex');
    authTag = Buffer.from(parts[2], 'hex');
    encrypted = parts[3];
  } else if (parts.length === 3) {
    // Legacy 3-part format: <iv>:<authTag>:<ciphertext> (pre enc: prefix)
    iv = Buffer.from(parts[0], 'hex');
    authTag = Buffer.from(parts[1], 'hex');
    encrypted = parts[2];
  } else {
    throw new Error('Invalid encrypted data format — expected enc:<iv>:<authTag>:<ciphertext>');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function encryptIfSecret(value: string, fieldType: string): string {
  if (fieldType === 'secret') {
    return encrypt(value);
  }
  return value;
}

export function decryptIfSecret(value: string, fieldType: string): string {
  if (fieldType === 'secret' && value.startsWith(`${ENC_PREFIX}:`)) {
    try {
      return decrypt(value);
    } catch {
      return value;
    }
  }
  return value;
}
