import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const key = process.env.MARINA_INTEGRATION_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!key || key.length < 16) {
    throw new Error('MARINA_INTEGRATION_ENCRYPTION_KEY or JWT_SECRET must be set (minimum 16 characters)');
  }
  return crypto.scryptSync(key, 'marina-integrations-salt', 32);
}

export function encryptCredentials(credentials: Record<string, string>): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const jsonData = JSON.stringify(credentials);
  const encrypted = Buffer.concat([
    cipher.update(jsonData, 'utf8'),
    cipher.final()
  ]);
  
  const authTag = cipher.getAuthTag();
  
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

export function decryptCredentials(encryptedData: string): Record<string, string> {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, 'base64');
  
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
  
  return JSON.parse(decrypted.toString('utf8'));
}

export function validateCredentials(
  credentials: Record<string, string>,
  requiredFields: string[]
): { valid: boolean; missingFields: string[] } {
  const missingFields = requiredFields.filter(field => !credentials[field] || credentials[field].trim() === '');
  return {
    valid: missingFields.length === 0,
    missingFields
  };
}

export function maskCredential(value: string, visibleChars: number = 4): string {
  if (!value || value.length <= visibleChars) {
    return '****';
  }
  return '*'.repeat(value.length - visibleChars) + value.slice(-visibleChars);
}

export function generateIntegrationNonce(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashCredentialForComparison(credential: string): string {
  return crypto.createHash('sha256').update(credential).digest('hex');
}
