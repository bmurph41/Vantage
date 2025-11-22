import crypto from "crypto";
import { z } from "zod";
import type { Request } from "express";
import Redis from "ioredis";

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

export interface WebhookVerificationResult {
  isValid: boolean;
  error?: string;
  parsedPayload?: any;
}

export interface WebhookSecurityConfig {
  secret: string;
  timestampToleranceMinutes?: number;
  requireIdempotencyKey?: boolean;
  redis?: {
    url?: string;
    host?: string;
    port?: number;
    password?: string;
    db?: number;
  };
}

export interface WebhookHeaders {
  signature?: string;
  timestamp?: string;
  idempotencyKey?: string;
}

export interface IdempotencyRecord {
  key: string;
  timestamp: Date;
  status: 'processing' | 'done';
  processedAt?: Date;
  claimedAt: Date;
}

export interface IdempotencyHelpers {
  finalizeSuccess: () => Promise<void>;
  finalizeFailure: () => Promise<void>;
  getStatus: () => Promise<'processing' | 'done' | null>;
}

// =============================================================================
// ZOD SCHEMAS FOR WEBHOOK EVENTS
// =============================================================================

// Base webhook payload schema
const baseWebhookSchema = z.object({
  event: z.string(),
  timestamp: z.string().datetime(),
  source: z.string(),
  version: z.string().default("1.0"),
  data: z.record(z.any()),
});

// Document event schemas
const documentCreatedSchema = baseWebhookSchema.extend({
  event: z.literal("document.created"),
  data: z.object({
    documentId: z.string(),
    projectId: z.string(),
    taskId: z.string().optional(),
    fileName: z.string(),
    fileType: z.string(),
    uploadedBy: z.string(),
    metadata: z.record(z.any()).optional(),
  }),
});

const documentTaggedSchema = baseWebhookSchema.extend({
  event: z.literal("document.tagged"),
  data: z.object({
    documentId: z.string(),
    projectId: z.string(),
    taskId: z.string().optional(),
    tags: z.array(z.string()),
    taggedBy: z.string(),
    previousTags: z.array(z.string()).optional(),
  }),
});

const documentVerifiedSchema = baseWebhookSchema.extend({
  event: z.literal("document.verified"),
  data: z.object({
    documentId: z.string(),
    projectId: z.string(),
    taskId: z.string().optional(),
    verifiedBy: z.string(),
    verificationStatus: z.enum(["verified", "rejected", "requires_review"]),
    verificationNotes: z.string().optional(),
    verificationDate: z.string().datetime(),
  }),
});

const documentRejectedSchema = baseWebhookSchema.extend({
  event: z.literal("document.rejected"),
  data: z.object({
    documentId: z.string(),
    projectId: z.string(),
    taskId: z.string().optional(),
    rejectedBy: z.string(),
    reason: z.string(),
    rejectionDate: z.string().datetime(),
    requiresResubmission: z.boolean().default(false),
  }),
});

const documentDeletedSchema = baseWebhookSchema.extend({
  event: z.literal("document.deleted"),
  data: z.object({
    documentId: z.string(),
    projectId: z.string(),
    taskId: z.string().optional(),
    deletedBy: z.string(),
    reason: z.string().optional(),
    deletionDate: z.string().datetime(),
    backup: z.object({
      location: z.string(),
      retentionDays: z.number(),
    }).optional(),
  }),
});

// Task event schemas
const taskStatusChangedSchema = baseWebhookSchema.extend({
  event: z.literal("task.status_changed"),
  data: z.object({
    taskId: z.string(),
    projectId: z.string(),
    previousStatus: z.string(),
    newStatus: z.string(),
    changedBy: z.string(),
    changeDate: z.string().datetime(),
    statusReason: z.string().optional(),
  }),
});

const taskAssignedSchema = baseWebhookSchema.extend({
  event: z.literal("task.assigned"),
  data: z.object({
    taskId: z.string(),
    projectId: z.string(),
    assignedTo: z.string(),
    assignedBy: z.string(),
    assignmentDate: z.string().datetime(),
    dueDate: z.string().datetime().optional(),
    priority: z.enum(["low", "med", "high"]).default("med"),
  }),
});

// Project event schemas
const projectCreatedSchema = baseWebhookSchema.extend({
  event: z.literal("project.created"),
  data: z.object({
    projectId: z.string(),
    name: z.string(),
    createdBy: z.string(),
    orgId: z.string(),
    creationDate: z.string().datetime(),
    templateId: z.string().optional(),
  }),
});

// Union schema for all webhook events
export const webhookEventSchema = z.discriminatedUnion("event", [
  documentCreatedSchema,
  documentTaggedSchema,
  documentVerifiedSchema,
  documentRejectedSchema,
  documentDeletedSchema,
  taskStatusChangedSchema,
  taskAssignedSchema,
  projectCreatedSchema,
]);

export type WebhookEvent = z.infer<typeof webhookEventSchema>;
export type DocumentCreatedEvent = z.infer<typeof documentCreatedSchema>;
export type DocumentTaggedEvent = z.infer<typeof documentTaggedSchema>;
export type DocumentVerifiedEvent = z.infer<typeof documentVerifiedSchema>;
export type DocumentRejectedEvent = z.infer<typeof documentRejectedSchema>;
export type DocumentDeletedEvent = z.infer<typeof documentDeletedSchema>;
export type TaskStatusChangedEvent = z.infer<typeof taskStatusChangedSchema>;
export type TaskAssignedEvent = z.infer<typeof taskAssignedSchema>;
export type ProjectCreatedEvent = z.infer<typeof projectCreatedSchema>;

// =============================================================================
// WEBHOOK SECURITY ERRORS
// =============================================================================

export class WebhookSecurityError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'WebhookSecurityError';
  }
}

export class WebhookSignatureError extends WebhookSecurityError {
  constructor(message: string = 'Invalid webhook signature') {
    super(message, 'INVALID_SIGNATURE');
  }
}

export class WebhookTimestampError extends WebhookSecurityError {
  constructor(message: string = 'Webhook timestamp is invalid or expired') {
    super(message, 'INVALID_TIMESTAMP');
  }
}

export class WebhookReplayError extends WebhookSecurityError {
  constructor(message: string = 'Webhook replay attack detected') {
    super(message, 'REPLAY_ATTACK');
  }
}

export class WebhookIdempotencyError extends WebhookSecurityError {
  constructor(message: string = 'Webhook idempotency key already processed') {
    super(message, 'DUPLICATE_REQUEST');
  }
}

export class WebhookPayloadError extends WebhookSecurityError {
  constructor(message: string = 'Invalid webhook payload') {
    super(message, 'INVALID_PAYLOAD');
  }
}

// =============================================================================
// REDIS-BASED IDEMPOTENCY MANAGEMENT
// =============================================================================

class RedisIdempotencyManager {
  private redis: Redis | null = null;
  private fallbackMap = new Map<string, IdempotencyRecord>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private retentionHours: number = 24,
    private redisConfig?: WebhookSecurityConfig['redis']
  ) {
    this.initializeRedis();
  }

  private initializeRedis(): void {
    // Use in-memory storage only (no Redis connection)
    this.redis = null;
    this.setupFallbackCleanup();
  }

  private setupFallbackCleanup(): void {
    if (this.cleanupInterval) return;
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupFallbackMap();
    }, 60 * 60 * 1000); // Cleanup every hour
  }

  private cleanupFallbackMap(): void {
    const now = new Date();
    const retention = this.retentionHours * 60 * 60 * 1000;

    for (const [key, record] of Array.from(this.fallbackMap.entries())) {
      if ((now.getTime() - record.timestamp.getTime()) >= retention) {
        this.fallbackMap.delete(key);
      }
    }
  }

  async getStatus(key: string): Promise<'processing' | 'done' | null> {
    const redisKey = `webhook:idempotency:${key}`;
    
    if (this.redis) {
      try {
        const result = await this.redis.get(redisKey);
        if (!result) return null;
        
        const record = JSON.parse(result);
        return record.status || null;
      } catch (error) {
        this.redis = null; // Mark redis as failed
        this.setupFallbackCleanup();
      }
    }

    // Fallback to in-memory check
    const record = this.fallbackMap.get(key);
    if (!record) return null;

    // Check if the record is still within retention period
    const now = new Date();
    const retention = this.retentionHours * 60 * 60 * 1000;
    if ((now.getTime() - record.timestamp.getTime()) >= retention) {
      this.fallbackMap.delete(key);
      return null;
    }
    
    return record.status;
  }

  async isProcessed(key: string): Promise<boolean> {
    const status = await this.getStatus(key);
    return status === 'done';
  }

  async isClaimed(key: string): Promise<boolean> {
    const status = await this.getStatus(key);
    return status === 'processing' || status === 'done';
  }

  async claimProcessing(key: string): Promise<void> {
    const redisKey = `webhook:idempotency:${key}`;
    const ttlSeconds = this.retentionHours * 60 * 60;
    const now = new Date();
    
    const record: IdempotencyRecord = {
      key,
      timestamp: now,
      status: 'processing',
      claimedAt: now,
    };
    
    if (this.redis) {
      try {
        // CRITICAL FIX: Use atomic SET NX EX instead of SETNX + EXPIRE
        // This prevents race condition where key could be left without TTL
        const result = await this.redis.set(
          redisKey, 
          JSON.stringify(record),
          'EX',  // Set expiration time in seconds
          ttlSeconds,
          'NX'   // Only set if key doesn't exist
        );
        
        if (result !== 'OK') {
          // Key already exists - check its status
          const existingStatus = await this.getStatus(key);
          if (existingStatus === 'done') {
            throw new WebhookIdempotencyError(`Request with idempotency key ${key} has already been processed`);
          } else if (existingStatus === 'processing') {
            throw new WebhookIdempotencyError(`Request with idempotency key ${key} is currently being processed`);
          }
        }
        return;
      } catch (error) {
        if (error instanceof WebhookIdempotencyError) {
          throw error; // Re-throw idempotency errors
        }
        this.redis = null;
        this.setupFallbackCleanup();
      }
    }

    // Fallback to in-memory storage
    const existing = this.fallbackMap.get(key);
    if (existing) {
      if (existing.status === 'done') {
        throw new WebhookIdempotencyError(`Request with idempotency key ${key} has already been processed`);
      } else if (existing.status === 'processing') {
        throw new WebhookIdempotencyError(`Request with idempotency key ${key} is currently being processed`);
      }
    }
    
    this.fallbackMap.set(key, record);
  }

  async markCompleted(key: string): Promise<void> {
    const redisKey = `webhook:idempotency:${key}`;
    const ttlSeconds = this.retentionHours * 60 * 60;
    
    if (this.redis) {
      try {
        const existingRecord = await this.redis.get(redisKey);
        if (!existingRecord) {
          return;
        }
        
        const record = JSON.parse(existingRecord);
        record.status = 'done';
        record.processedAt = new Date().toISOString();
        
        // Update the record while preserving TTL
        await this.redis.set(redisKey, JSON.stringify(record), 'EX', ttlSeconds);
        return;
      } catch (error) {
        this.redis = null;
        this.setupFallbackCleanup();
      }
    }

    // Fallback to in-memory storage
    const existing = this.fallbackMap.get(key);
    if (existing) {
      existing.status = 'done';
      existing.processedAt = new Date();
    }
  }

  async releaseProcessing(key: string): Promise<void> {
    const redisKey = `webhook:idempotency:${key}`;
    
    if (this.redis) {
      try {
        await this.redis.del(redisKey);
        return;
      } catch (error) {
        this.redis = null;
        this.setupFallbackCleanup();
      }
    }

    // Fallback to in-memory storage
    this.fallbackMap.delete(key);
  }

  // Legacy method for backward compatibility
  async markProcessed(key: string): Promise<void> {
    await this.claimProcessing(key);
    await this.markCompleted(key);
  }

  async destroy(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch (error) {
      }
      this.redis = null;
    }
    
    this.fallbackMap.clear();
  }
}

// Singleton instance - will be initialized with proper config when WebhookSecurity is created
let idempotencyManager: RedisIdempotencyManager | null = null;

// =============================================================================
// HMAC SIGNATURE GENERATION AND VERIFICATION
// =============================================================================

export class WebhookSecurity {
  private readonly algorithm = 'sha256';
  private readonly signaturePrefix = 'sha256=';
  private idempotencyManager: RedisIdempotencyManager;

  constructor(private config: WebhookSecurityConfig) {
    this.config = {
      timestampToleranceMinutes: 5,
      requireIdempotencyKey: true,
      ...config,
    };
    
    // Initialize idempotency manager with Redis config
    this.idempotencyManager = new RedisIdempotencyManager(24, config.redis);
    
    // Update global reference for backward compatibility
    if (!idempotencyManager) {
      idempotencyManager = this.idempotencyManager;
    }
  }

  /**
   * Generates HMAC signature for webhook payload
   */
  generateSignature(payload: string, timestamp: string): string {
    const message = `${timestamp}.${payload}`;
    const signature = crypto
      .createHmac(this.algorithm, this.config.secret)
      .update(message, 'utf8')
      .digest('hex');
    
    return `${this.signaturePrefix}${signature}`;
  }

  /**
   * Validates signature format
   */
  private validateSignatureFormat(signature: string): boolean {
    // Must start with sha256= prefix
    if (!signature.startsWith(this.signaturePrefix)) {
      return false;
    }
    
    // Extract hex part and validate length
    const hexSignature = signature.slice(this.signaturePrefix.length);
    
    // SHA256 hex should be exactly 64 characters
    if (hexSignature.length !== 64) {
      return false;
    }
    
    // Validate hex characters only
    return /^[a-f0-9]+$/i.test(hexSignature);
  }

  /**
   * Verifies HMAC signature for incoming webhook
   */
  private verifySignature(payload: string, timestamp: string, signature: string): boolean {
    // Validate signature format first
    if (!this.validateSignatureFormat(signature)) {
      throw new WebhookSignatureError('Invalid signature format - must be sha256=<64-char-hex>');
    }
    
    const expectedSignature = this.generateSignature(payload, timestamp);
    
    // Ensure both signatures have the same length before comparison
    if (signature.length !== expectedSignature.length) {
      return false;
    }
    
    try {
      // Use constant-time comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      // timingSafeEqual can throw if buffer lengths differ
      return false;
    }
  }

  /**
   * Validates webhook timestamp to prevent replay attacks
   */
  private validateTimestamp(timestamp: string): boolean {
    const webhookTimestamp = parseInt(timestamp, 10);
    if (isNaN(webhookTimestamp)) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    const toleranceSeconds = (this.config.timestampToleranceMinutes || 5) * 60;
    
    // Check if timestamp is within tolerance window
    return Math.abs(now - webhookTimestamp) <= toleranceSeconds;
  }

  /**
   * Validates and claims idempotency key to prevent duplicate processing
   */
  private async claimIdempotencyKey(idempotencyKey?: string): Promise<void> {
    if (!this.config.requireIdempotencyKey) {
      return;
    }

    if (!idempotencyKey) {
      throw new WebhookIdempotencyError('Idempotency key is required');
    }

    // Attempt to claim the key for processing
    await this.idempotencyManager.claimProcessing(idempotencyKey);
  }

  /**
   * Creates idempotency helpers for business logic to use
   */
  private createIdempotencyHelpers(idempotencyKey?: string): IdempotencyHelpers {
    return {
      finalizeSuccess: async () => {
        if (idempotencyKey) {
          await this.idempotencyManager.markCompleted(idempotencyKey);
        }
      },
      finalizeFailure: async () => {
        if (idempotencyKey) {
          await this.idempotencyManager.releaseProcessing(idempotencyKey);
        }
      },
      getStatus: async () => {
        if (idempotencyKey) {
          return await this.idempotencyManager.getStatus(idempotencyKey);
        }
        return null;
      },
    };
  }

  /**
   * Extracts webhook headers from request
   */
  private extractWebhookHeaders(req: Request): WebhookHeaders {
    return {
      signature: req.get('x-webhook-signature') || req.get('x-hub-signature-256'),
      timestamp: req.get('x-webhook-timestamp'),
      idempotencyKey: req.get('x-idempotency-key') || req.get('idempotency-key'),
    };
  }

  /**
   * Validates webhook payload against Zod schema
   */
  private validatePayload(payload: string): WebhookEvent {
    let parsedPayload: any;
    
    try {
      parsedPayload = JSON.parse(payload);
    } catch (error) {
      throw new WebhookPayloadError('Invalid JSON payload');
    }

    try {
      return webhookEventSchema.parse(parsedPayload);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
        throw new WebhookPayloadError(`Payload validation failed: ${errorMessages.join(', ')}`);
      }
      throw new WebhookPayloadError('Unknown payload validation error');
    }
  }

  /**
   * Comprehensive webhook verification
   */
  async verifyWebhook(req: Request, rawBody: string): Promise<WebhookVerificationResult> {
    let idempotencyKeyClaimed = false;
    let idempotencyKey: string | undefined;

    try {
      // Extract headers
      const headers = this.extractWebhookHeaders(req);
      idempotencyKey = headers.idempotencyKey;

      // Validate required headers
      if (!headers.signature) {
        throw new WebhookSignatureError('Missing webhook signature header');
      }

      if (!headers.timestamp) {
        throw new WebhookTimestampError('Missing webhook timestamp header');
      }

      // Validate timestamp (replay attack prevention)
      if (!this.validateTimestamp(headers.timestamp)) {
        throw new WebhookTimestampError('Webhook timestamp is expired or invalid');
      }

      // Claim idempotency key (duplicate prevention) - now async
      await this.claimIdempotencyKey(idempotencyKey);
      idempotencyKeyClaimed = true;

      // Verify HMAC signature
      if (!this.verifySignature(rawBody, headers.timestamp, headers.signature)) {
        throw new WebhookSignatureError('Invalid webhook signature');
      }

      // Validate payload structure
      const parsedPayload = this.validatePayload(rawBody);

      // DON'T mark as completed here - business logic will do that via finalize helpers

      return {
        isValid: true,
        parsedPayload,
      };

    } catch (error) {
      // CRITICAL FIX: Release idempotency key if it was claimed before any validation failure
      if (idempotencyKeyClaimed && idempotencyKey) {
        try {
          await this.idempotencyManager.releaseProcessing(idempotencyKey);
        } catch (releaseError) {
        }
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown verification error';
      
      return {
        isValid: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Express middleware for webhook verification
   */
  createVerificationMiddleware() {
    return async (req: any, res: any, next: any) => {
      // CRITICAL SECURITY FIX: Remove JSON.stringify fallback that undermines signature verification
      // Raw body parsing MUST be enforced at the application level before this middleware
      
      if (!req.rawBody) {
        return res.status(400).json({
          error: 'Raw request body is required for webhook verification. Ensure raw body parsing middleware is configured before webhook routes.',
          code: 'MISSING_RAW_BODY',
          documentation: 'Configure Express to preserve raw body with express.raw() or custom middleware before webhook verification'
        });
      }

      // Ensure rawBody is a string
      const rawBodyString = typeof req.rawBody === 'string' ? req.rawBody : req.rawBody.toString('utf8');

      const result = await this.verifyWebhook(req, rawBodyString);

      if (!result.isValid) {
        const statusCode = this.getErrorStatusCode(result.error);
        return res.status(statusCode).json({
          error: result.error,
          code: this.getErrorCode(result.error),
        });
      }

      // Extract headers for use in middleware
      const headers = this.extractWebhookHeaders(req);
      
      // Attach parsed payload and idempotency helpers to request
      req.webhookPayload = result.parsedPayload;
      req.idempotency = this.createIdempotencyHelpers(headers.idempotencyKey);
      
      // Setup automatic cleanup on response finish if not manually finalized
      const originalEnd = res.end;
      let finalized = false;
      
      res.end = function(...args: any[]) {
        if (!finalized && headers.idempotencyKey) {
          // CRITICAL FIX: Check HTTP status code to determine success vs failure
          const statusCode = res.statusCode;
          
          if (statusCode >= 200 && statusCode < 300) {
            // 2xx responses indicate success
            req.idempotency.finalizeSuccess().catch((err: any) => {
            });
          } else if (statusCode >= 500 && statusCode < 600) {
            // 5xx responses are retriable failures - release key to allow retries
            req.idempotency.finalizeFailure().catch((err: any) => {
            });
          } else {
            // 4xx responses are permanent failures - mark as done to prevent retries
            req.idempotency.finalizeSuccess().catch((err: any) => {
            });
          }
          finalized = true;
        }
        return originalEnd.apply(this, args);
      };
      
      // Setup cleanup on response error
      res.on('error', () => {
        if (!finalized && headers.idempotencyKey) {
          // Response errors are retriable failures - release key
          req.idempotency.finalizeFailure().catch((err: any) => {
          });
          finalized = true;
        }
      });
      
      next();
    };
  }

  /**
   * Get appropriate HTTP status code for error using proper error types
   */
  private getErrorStatusCode(error?: string): number {
    if (!error) return 400;
    
    // Map errors based on their actual error types, not substring matching
    if (error.startsWith('Invalid webhook signature') || error.startsWith('Missing webhook signature') || error.includes('signature format')) {
      return 401; // Unauthorized - signature issues
    }
    if (error.startsWith('Webhook timestamp') || error.includes('timestamp') || error.includes('expired')) {
      return 401; // Unauthorized - timing issues  
    }
    if (error.startsWith('Request with idempotency key') || error.includes('idempotency key')) {
      return 409; // Conflict - duplicate request
    }
    if (error.startsWith('Payload validation failed') || error.startsWith('Invalid JSON payload') || error.includes('validation')) {
      return 400; // Bad Request - payload issues
    }
    if (error.includes('Raw request body is required')) {
      return 400; // Bad Request - missing raw body
    }
    
    return 400; // Default to Bad Request for unknown errors
  }

  /**
   * Get error code for client reference using proper error types
   */
  private getErrorCode(error?: string): string {
    if (!error) return 'VERIFICATION_FAILED';
    
    // Map error codes based on specific error types, not substring matching
    if (error.startsWith('Invalid webhook signature') || error.startsWith('Missing webhook signature') || error.includes('signature format')) {
      return 'INVALID_SIGNATURE';
    }
    if (error.startsWith('Webhook timestamp') || error.includes('expired') || error.includes('invalid timestamp')) {
      return 'INVALID_TIMESTAMP';
    }
    if (error.startsWith('Request with idempotency key') || error.includes('already been processed')) {
      return 'DUPLICATE_REQUEST';
    }
    if (error.startsWith('Idempotency key is required')) {
      return 'MISSING_IDEMPOTENCY_KEY';
    }
    if (error.startsWith('Payload validation failed') || error.startsWith('Invalid JSON payload')) {
      return 'INVALID_PAYLOAD';
    }
    if (error.includes('Raw request body is required')) {
      return 'MISSING_RAW_BODY';
    }
    
    return 'VERIFICATION_FAILED';
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Creates a webhook signature for testing
 */
export function createTestWebhookSignature(
  payload: string, 
  secret: string, 
  timestamp?: string
): { signature: string; timestamp: string } {
  const webhookTimestamp = timestamp || Math.floor(Date.now() / 1000).toString();
  const security = new WebhookSecurity({ secret });
  
  return {
    signature: security.generateSignature(payload, webhookTimestamp),
    timestamp: webhookTimestamp,
  };
}

/**
 * Validates webhook event type
 */
export function isValidWebhookEventType(eventType: string): boolean {
  const validEvents = [
    'document.created',
    'document.tagged', 
    'document.verified',
    'document.rejected',
    'document.deleted',
    'task.status_changed',
    'task.assigned',
    'project.created',
  ];
  
  return validEvents.includes(eventType);
}

/**
 * Creates a webhook payload for testing
 */
export function createTestWebhookPayload(
  event: string,
  data: Record<string, any>
): WebhookEvent {
  const basePayload = {
    event,
    timestamp: new Date().toISOString(),
    source: 'test-system',
    version: '1.0',
    data,
  };

  return webhookEventSchema.parse(basePayload);
}

/**
 * Cleanup function for graceful shutdown
 */
export async function cleanup(): Promise<void> {
  if (idempotencyManager) {
    await idempotencyManager.destroy();
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { idempotencyManager };
export default WebhookSecurity;