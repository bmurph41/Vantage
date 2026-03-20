import { IntegrationDataTransformer } from '../../services/integration-data-transformer';
import { logger } from '../../lib/logger';

export type SyncDirection = 'read' | 'write' | 'bidirectional';
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{ field: string; message: string }>;
  warnings: Array<{ field: string; message: string }>;
}

export interface ConnectorCredentials {
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  siteId?: string;
  companyId?: string;
  [key: string]: string | undefined;
}

export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errors: Array<{
    record?: any;
    error: string;
    field?: string;
  }>;
  failedRecords: Array<{
    record: any;
    error: string;
    entityType?: string;
  }>;
  duration: number;
  syncedAt: Date;
}

export interface EntitySyncConfig {
  sourceEntity: string;
  targetEntity: string;
  targetModule: string;
  syncDirection: SyncDirection;
  batchSize?: number;
  includeDeleted?: boolean;
}

export interface ConnectorConfig {
  integrationKey: string;
  credentials: ConnectorCredentials;
  settings: Record<string, any>;
  userId: string;
  orgId: string;
  /** Max requests per second for rate limiting (default: 10) */
  maxRequestsPerSecond?: number;
  /** Request timeout in milliseconds (default: 30000) */
  requestTimeoutMs?: number;
  /** Max retry attempts for failed requests (default: 3) */
  maxRetries?: number;
}

/** Retryable HTTP status codes */
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

/** Base delay in ms for exponential backoff */
const BASE_BACKOFF_MS = 1000;

export abstract class BaseConnector {
  protected config: ConnectorConfig;
  protected transformer: IntegrationDataTransformer;
  protected integrationKey: string;

  // Rate limiter state (token bucket)
  private rateLimitTokens: number;
  private rateLimitMax: number;
  private rateLimitRefillRate: number; // tokens per ms
  private rateLimitLastRefill: number;

  // Retry config
  private maxRetries: number;
  private requestTimeoutMs: number;

  constructor(config: ConnectorConfig) {
    this.config = config;
    this.integrationKey = config.integrationKey;
    this.transformer = new IntegrationDataTransformer(config.integrationKey);

    // Initialize rate limiter (token bucket)
    const maxRps = config.maxRequestsPerSecond ?? 10;
    this.rateLimitMax = maxRps;
    this.rateLimitTokens = maxRps;
    this.rateLimitRefillRate = maxRps / 1000; // tokens per ms
    this.rateLimitLastRefill = Date.now();

    // Retry and timeout config
    this.maxRetries = config.maxRetries ?? 3;
    this.requestTimeoutMs = config.requestTimeoutMs ?? 30000;
  }

  abstract testConnection(): Promise<{ connected: boolean; message: string; details?: any }>;

  abstract getSupportedEntities(): EntitySyncConfig[];

  abstract fetchEntities(entityType: string, options?: {
    since?: Date;
    limit?: number;
    offset?: number;
    filters?: Record<string, any>;
  }): Promise<{ data: any[]; hasMore: boolean; total?: number }>;

  async syncEntity(entityConfig: EntitySyncConfig): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      success: true,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      errors: [],
      failedRecords: [],
      duration: 0,
      syncedAt: new Date(),
    };

    try {
      const batchSize = entityConfig.batchSize || 100;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, hasMore: more } = await this.fetchEntities(entityConfig.sourceEntity, {
          limit: batchSize,
          offset,
        });

        for (const record of data) {
          try {
            const transformed = this.transformer.transform(
              record,
              entityConfig.targetEntity,
              { includeMetadata: true }
            );

            const validation = this.transformer.validateEntity(
              transformed,
              entityConfig.targetEntity
            );

            if (!validation.isValid) {
              const errorMsg = validation.errors.map(e => e.message).join('; ');
              result.errors.push({
                record,
                error: errorMsg,
              });
              result.failedRecords.push({
                record,
                error: errorMsg,
                entityType: entityConfig.sourceEntity,
              });
              result.recordsSkipped++;
              continue;
            }

            const saveResult = await this.saveEntity(entityConfig.targetEntity, transformed);
            result.recordsProcessed++;

            if (saveResult.created) {
              result.recordsCreated++;
            } else if (saveResult.updated) {
              result.recordsUpdated++;
            } else {
              result.recordsSkipped++;
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push({
              record,
              error: errorMsg,
            });
            result.failedRecords.push({
              record,
              error: errorMsg,
              entityType: entityConfig.sourceEntity,
            });
            result.recordsSkipped++;
          }
        }

        hasMore = more;
        offset += batchSize;
      }
    } catch (error) {
      result.success = false;
      result.errors.push({
        error: error instanceof Error ? error.message : 'Sync failed',
      });
    }

    // Mark as partial success if some records failed but others succeeded
    if (result.failedRecords.length > 0 && result.recordsProcessed > 0) {
      result.success = true; // partial success — some records went through
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  async syncAll(): Promise<Map<string, SyncResult>> {
    const results = new Map<string, SyncResult>();
    const entities = this.getSupportedEntities();

    for (const entity of entities) {
      if (entity.syncDirection === 'read' || entity.syncDirection === 'bidirectional') {
        const result = await this.syncEntity(entity);
        results.set(entity.sourceEntity, result);
      }
    }

    return results;
  }

  protected abstract saveEntity(
    entityType: string,
    data: any
  ): Promise<{ created: boolean; updated: boolean; id?: string }>;

  protected getCredential(key: string): string {
    const value = this.config.credentials[key];
    if (!value) {
      throw new Error(`Missing required credential: ${key}`);
    }
    return value;
  }

  protected getSetting<T>(key: string, defaultValue?: T): T {
    return (this.config.settings[key] as T) ?? (defaultValue as T);
  }

  /**
   * Wait for a rate limit token to become available (token bucket algorithm).
   * Refills tokens based on elapsed time, then consumes one. If no tokens
   * are available, sleeps until one is refilled.
   */
  private async acquireRateLimitToken(): Promise<void> {
    while (true) {
      const now = Date.now();
      const elapsed = now - this.rateLimitLastRefill;

      // Refill tokens based on elapsed time
      this.rateLimitTokens = Math.min(
        this.rateLimitMax,
        this.rateLimitTokens + elapsed * this.rateLimitRefillRate
      );
      this.rateLimitLastRefill = now;

      if (this.rateLimitTokens >= 1) {
        this.rateLimitTokens -= 1;
        return;
      }

      // Calculate wait time until one token is available
      const waitMs = Math.ceil((1 - this.rateLimitTokens) / this.rateLimitRefillRate);
      await this.sleep(waitMs);
    }
  }

  /**
   * Calculate backoff delay with jitter for a given retry attempt.
   * Uses exponential backoff: base * 2^attempt, with random jitter of +/- 25%.
   */
  private getBackoffDelay(attempt: number): number {
    const exponentialDelay = BASE_BACKOFF_MS * Math.pow(2, attempt);
    const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1); // +/- 25%
    return Math.max(0, exponentialDelay + jitter);
  }

  /**
   * Parse the Retry-After header value into milliseconds.
   * Supports both delta-seconds and HTTP-date formats.
   */
  private parseRetryAfter(headerValue: string | null): number | null {
    if (!headerValue) return null;

    // Try parsing as integer seconds first
    const seconds = parseInt(headerValue, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }

    // Try parsing as HTTP-date
    const date = new Date(headerValue);
    if (!isNaN(date.getTime())) {
      const delayMs = date.getTime() - Date.now();
      return Math.max(0, delayMs);
    }

    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected async makeRequest<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Wait for rate limit token before making the request
    await this.acquireRateLimitToken();

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      // Set up abort controller for request timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          return response.json();
        }

        // Check if this status code is retryable
        if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < this.maxRetries) {
          const errorText = await response.text();
          lastError = new Error(`API request failed (${response.status}): ${errorText}`);

          // Determine delay: use Retry-After header for 429, otherwise exponential backoff
          let delayMs: number;
          if (response.status === 429) {
            const retryAfterMs = this.parseRetryAfter(response.headers.get('Retry-After'));
            delayMs = retryAfterMs ?? this.getBackoffDelay(attempt);
          } else {
            delayMs = this.getBackoffDelay(attempt);
          }

          logger.warn({
            connector: this.integrationKey,
            url,
            status: response.status,
            attempt: attempt + 1,
            maxRetries: this.maxRetries,
            delayMs,
          }, `Request failed with status ${response.status}, retrying in ${delayMs}ms (attempt ${attempt + 1}/${this.maxRetries})`);

          await this.sleep(delayMs);

          // Re-acquire rate limit token for retry
          await this.acquireRateLimitToken();
          continue;
        }

        // Non-retryable error or exhausted retries
        const errorText = await response.text();
        throw new Error(`API request failed (${response.status}): ${errorText}`);

      } catch (error) {
        clearTimeout(timeoutId);

        // Handle abort/timeout
        if (error instanceof DOMException && error.name === 'AbortError') {
          lastError = new Error(
            `Request to ${url} timed out after ${this.requestTimeoutMs}ms`
          );

          if (attempt < this.maxRetries) {
            const delayMs = this.getBackoffDelay(attempt);
            logger.warn({
              connector: this.integrationKey,
              url,
              attempt: attempt + 1,
              maxRetries: this.maxRetries,
              delayMs,
            }, `Request timed out, retrying in ${delayMs}ms (attempt ${attempt + 1}/${this.maxRetries})`);

            await this.sleep(delayMs);
            await this.acquireRateLimitToken();
            continue;
          }

          throw lastError;
        }

        // Re-throw non-retryable errors (e.g. network errors that aren't timeouts)
        if (error instanceof Error && !RETRYABLE_STATUS_CODES.has(0)) {
          // Network errors are retryable
          if (attempt < this.maxRetries && !(error.message.startsWith('API request failed'))) {
            lastError = error;
            const delayMs = this.getBackoffDelay(attempt);

            logger.warn({
              connector: this.integrationKey,
              url,
              error: error.message,
              attempt: attempt + 1,
              maxRetries: this.maxRetries,
              delayMs,
            }, `Request failed with network error, retrying in ${delayMs}ms (attempt ${attempt + 1}/${this.maxRetries})`);

            await this.sleep(delayMs);
            await this.acquireRateLimitToken();
            continue;
          }
        }

        throw error;
      }
    }

    // Should not reach here, but just in case
    throw lastError ?? new Error(`Request to ${url} failed after ${this.maxRetries} retries`);
  }
}

export class ConnectorFactory {
  private static connectors = new Map<string, new (config: ConnectorConfig) => BaseConnector>();

  static register(key: string, connectorClass: new (config: ConnectorConfig) => BaseConnector): void {
    this.connectors.set(key, connectorClass);
  }

  static create(config: ConnectorConfig): BaseConnector {
    const ConnectorClass = this.connectors.get(config.integrationKey);
    if (!ConnectorClass) {
      throw new Error(`No connector registered for integration: ${config.integrationKey}`);
    }
    return new ConnectorClass(config);
  }

  static isRegistered(key: string): boolean {
    return this.connectors.has(key);
  }

  static getRegisteredKeys(): string[] {
    return Array.from(this.connectors.keys());
  }
}
