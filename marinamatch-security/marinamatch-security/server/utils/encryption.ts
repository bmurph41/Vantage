/**
 * MarinaMatch Encryption Utilities
 * 
 * Provides AES-256-GCM encryption for sensitive data like OAuth tokens.
 * Uses envelope encryption pattern for key management.
 * 
 * REQUIRED ENV VARS:
 * - ENCRYPTION_KEY: 32-byte hex string (64 chars) for AES-256
 * 
 * To generate a key:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import crypto from 'crypto';
import type { EncryptedToken } from '../types/security';

// ============================================================================
// CONFIGURATION
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recommended IV length
const TAG_LENGTH = 16; // GCM auth tag length
const KEY_LENGTH = 32; // 256 bits

// ============================================================================
// KEY MANAGEMENT
// ============================================================================

let encryptionKey: Buffer | null = null;

/**
 * Initialize encryption key from environment
 * Call this at app startup
 */
export function initializeEncryption(): void {
  const keyHex = process.env.ENCRYPTION_KEY;
  
  if (!keyHex) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is required. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  
  if (keyHex.length !== KEY_LENGTH * 2) {
    throw new Error(
      `ENCRYPTION_KEY must be a ${KEY_LENGTH * 2} character hex string (${KEY_LENGTH} bytes)`
    );
  }
  
  encryptionKey = Buffer.from(keyHex, 'hex');
  
  // Validate key by attempting a test encryption
  try {
    const testData = 'encryption-test';
    const encrypted = encryptString(testData);
    const decrypted = decryptString(encrypted);
    if (decrypted !== testData) {
      throw new Error('Encryption validation failed');
    }
  } catch (error) {
    encryptionKey = null;
    throw new Error('Invalid ENCRYPTION_KEY: encryption test failed');
  }
  
  console.log('✓ Encryption initialized successfully');
}

/**
 * Get the current encryption key
 * @throws Error if key not initialized
 */
function getKey(): Buffer {
  if (!encryptionKey) {
    throw new Error('Encryption not initialized. Call initializeEncryption() first.');
  }
  return encryptionKey;
}

// ============================================================================
// CORE ENCRYPTION FUNCTIONS
// ============================================================================

/**
 * Encrypt a string using AES-256-GCM
 * @param plaintext - String to encrypt
 * @returns Encrypted token object with ciphertext, iv, and auth tag
 */
export function encryptString(plaintext: string): EncryptedToken {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  
  const tag = cipher.getAuthTag();
  
  return {
    ciphertext,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

/**
 * Decrypt an encrypted token
 * @param encrypted - Encrypted token object
 * @returns Decrypted plaintext string
 * @throws Error if decryption fails (tampered data or wrong key)
 */
export function decryptString(encrypted: EncryptedToken): string {
  const key = getKey();
  
  const iv = Buffer.from(encrypted.iv, 'base64');
  const tag = Buffer.from(encrypted.tag, 'base64');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let plaintext = decipher.update(encrypted.ciphertext, 'base64', 'utf8');
  plaintext += decipher.final('utf8');
  
  return plaintext;
}

/**
 * Encrypt an object as JSON
 * @param data - Object to encrypt
 * @returns Encrypted token
 */
export function encryptObject<T>(data: T): EncryptedToken {
  const json = JSON.stringify(data);
  return encryptString(json);
}

/**
 * Decrypt to an object
 * @param encrypted - Encrypted token
 * @returns Decrypted object
 */
export function decryptObject<T>(encrypted: EncryptedToken): T {
  const json = decryptString(encrypted);
  return JSON.parse(json) as T;
}

// ============================================================================
// TOKEN ENCRYPTION (OAuth Tokens)
// ============================================================================

/**
 * Encrypt OAuth tokens for database storage
 * @param accessToken - Access token
 * @param refreshToken - Refresh token
 * @returns Object with encrypted token strings (JSON serialized)
 */
export function encryptTokens(
  accessToken: string,
  refreshToken: string
): { accessTokenEncrypted: string; refreshTokenEncrypted: string } {
  return {
    accessTokenEncrypted: JSON.stringify(encryptString(accessToken)),
    refreshTokenEncrypted: JSON.stringify(encryptString(refreshToken)),
  };
}

/**
 * Decrypt OAuth tokens from database
 * @param accessTokenEncrypted - JSON string of encrypted access token
 * @param refreshTokenEncrypted - JSON string of encrypted refresh token
 * @returns Decrypted token pair
 */
export function decryptTokens(
  accessTokenEncrypted: string,
  refreshTokenEncrypted: string
): { accessToken: string; refreshToken: string } {
  return {
    accessToken: decryptString(JSON.parse(accessTokenEncrypted)),
    refreshToken: decryptString(JSON.parse(refreshTokenEncrypted)),
  };
}

// ============================================================================
// HASHING UTILITIES
// ============================================================================

/**
 * Generate a SHA-256 hash of data
 * @param data - Data to hash
 * @returns Hex-encoded hash
 */
export function sha256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Hash a session token for storage
 * Tokens are stored hashed, never in plaintext
 */
export function hashSessionToken(token: string): string {
  return sha256(token);
}

/**
 * Generate a cryptographically secure random token
 * @param length - Number of bytes (default 32)
 * @returns Hex-encoded token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a CSRF token
 */
export function generateCsrfToken(): string {
  return generateSecureToken(32);
}

/**
 * Constant-time string comparison (prevents timing attacks)
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ============================================================================
// FILE CHECKSUM
// ============================================================================

/**
 * Calculate SHA-256 checksum of a file buffer
 * @param buffer - File contents
 * @returns Hex-encoded checksum
 */
export function calculateFileChecksum(buffer: Buffer): string {
  return sha256(buffer);
}

/**
 * Calculate checksum from a readable stream (for large files)
 * @param stream - Readable stream
 * @returns Promise resolving to hex-encoded checksum
 */
export function calculateStreamChecksum(
  stream: NodeJS.ReadableStream
): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// ============================================================================
// PKCE (Proof Key for Code Exchange)
// ============================================================================

/**
 * Generate PKCE code verifier
 * @returns Random 43-128 character string
 */
export function generateCodeVerifier(): string {
  // Generate 32 bytes = 43 chars in base64url
  return crypto.randomBytes(32)
    .toString('base64url')
    .slice(0, 43);
}

/**
 * Generate PKCE code challenge from verifier
 * @param verifier - Code verifier
 * @returns Base64url-encoded SHA-256 hash
 */
export function generateCodeChallenge(verifier: string): string {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

// ============================================================================
// PII MASKING
// ============================================================================

/**
 * Mask sensitive fields in objects for logging
 */
export function maskSensitiveData<T extends Record<string, unknown>>(
  data: T,
  sensitiveFields: string[] = ['password', 'token', 'secret', 'ssn', 'creditCard', 'accessToken', 'refreshToken']
): T {
  const masked = { ...data };
  
  for (const field of sensitiveFields) {
    if (field in masked && typeof masked[field] === 'string') {
      const value = masked[field] as string;
      if (value.length > 4) {
        masked[field] = `***${value.slice(-4)}` as T[keyof T];
      } else {
        masked[field] = '****' as T[keyof T];
      }
    }
  }
  
  return masked;
}

/**
 * Redact fields entirely (replace with [REDACTED])
 */
export function redactFields<T extends Record<string, unknown>>(
  data: T,
  fieldsToRedact: string[]
): T {
  const redacted = { ...data };
  
  for (const field of fieldsToRedact) {
    if (field in redacted) {
      redacted[field] = '[REDACTED]' as T[keyof T];
    }
  }
  
  return redacted;
}

// ============================================================================
// AUDIT LOG HASH CHAIN
// ============================================================================

/**
 * Generate hash for audit log entry (for tamper evidence)
 * @param entry - Audit log data
 * @param previousHash - Hash of previous entry (or empty string for first)
 * @returns Hash of current entry
 */
export function generateAuditLogHash(
  entry: {
    orgId?: string;
    actorUserId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    timestamp: Date;
  },
  previousHash: string = ''
): string {
  const dataToHash = JSON.stringify({
    previousHash,
    orgId: entry.orgId,
    actorUserId: entry.actorUserId,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    timestamp: entry.timestamp.toISOString(),
  });
  
  return sha256(dataToHash);
}
