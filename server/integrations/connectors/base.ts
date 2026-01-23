import { IntegrationDataTransformer } from '../../services/integration-data-transformer';

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
}

export abstract class BaseConnector {
  protected config: ConnectorConfig;
  protected transformer: IntegrationDataTransformer;
  protected integrationKey: string;

  constructor(config: ConnectorConfig) {
    this.config = config;
    this.integrationKey = config.integrationKey;
    this.transformer = new IntegrationDataTransformer(config.integrationKey);
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
              result.errors.push({
                record,
                error: validation.errors.map(e => e.message).join('; '),
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
            result.errors.push({
              record,
              error: error instanceof Error ? error.message : 'Unknown error',
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

  protected async makeRequest<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed (${response.status}): ${errorText}`);
    }

    return response.json();
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
