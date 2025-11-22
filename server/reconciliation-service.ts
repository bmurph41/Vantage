import { storage } from './storage';
import { db } from './db';
import { type ProjectIntegration, type DocumentRequirement, type Project, type InsertDocumentRequirement } from '@shared/schema';
import { toZonedTime } from 'date-fns-tz';
import { addMinutes, differenceInMilliseconds } from 'date-fns';
import { sql } from 'drizzle-orm';

/**
 * Configuration for the reconciliation service
 */
interface ReconciliationConfig {
  syncIntervalMinutes: number;
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  healthCheckIntervalMs: number;
  requestTimeoutMs: number;
  batchSize: number;
  parallelSyncs: number;
}

/**
 * External document application response interface
 */
interface ExternalDocumentResponse {
  documents: ExternalDocument[];
  nextCursor?: string;
  hasMore: boolean;
}

interface ExternalDocument {
  id: string;
  name: string;
  status: 'requested' | 'received' | 'verified' | 'rejected' | 'outdated' | 'external_unavailable';
  taskId: string;
  projectId: string;
  description?: string;
  url?: string;
  lastModified: Date;
  metadata?: Record<string, any>;
}

/**
 * Sync result for tracking success/failure
 */
interface SyncResult {
  success: boolean;
  error?: string;
  documentsProcessed: number;
  nextCursor?: string;
  retryAfter?: Date;
}

/**
 * Sync status for health monitoring
 */
interface SyncStatus {
  projectId: string;
  provider: string;
  lastSyncAt?: Date;
  lastSyncSuccess?: boolean;
  lastError?: string;
  retryCount: number;
  nextRetryAt?: Date;
  documentsProcessed: number;
}

/**
 * Health check result
 */
interface HealthStatus {
  running: boolean;
  lastHealthCheck: Date;
  activeSyncs: number;
  totalIntegrations: number;
  healthyIntegrations: number;
  unhealthyIntegrations: number;
  errorRate: number;
  lastSuccessfulSyncAt?: Date;
}

/**
 * Background reconciliation service for syncing with external document applications
 * 
 * Features:
 * - Periodic sync jobs every 5-10 minutes
 * - Exponential backoff retry logic for failed API calls
 * - Cursor management to track sync state
 * - Comprehensive error handling and recovery
 * - Health monitoring and status reporting
 * - Configurable sync intervals and retry policies
 */
export class ReconciliationService {
  private isRunning: boolean = false;
  private syncIntervalId: NodeJS.Timeout | null = null;
  private healthCheckIntervalId: NodeJS.Timeout | null = null;
  private activeSyncs: Map<string, Promise<SyncResult>> = new Map();
  private syncStatuses: Map<string, SyncStatus> = new Map();
  private config: ReconciliationConfig;
  private lastHealthCheck: Date = new Date();
  private totalSyncAttempts: number = 0;
  private totalSyncErrors: number = 0;

  constructor(config?: Partial<ReconciliationConfig>) {
    this.config = {
      syncIntervalMinutes: parseInt(process.env.RECONCILIATION_SYNC_INTERVAL_MINUTES || '7', 10),
      maxRetries: parseInt(process.env.RECONCILIATION_MAX_RETRIES || '5', 10),
      baseDelayMs: parseInt(process.env.RECONCILIATION_BASE_DELAY_MS || '1000', 10),
      maxDelayMs: parseInt(process.env.RECONCILIATION_MAX_DELAY_MS || '300000', 10), // 5 minutes max
      healthCheckIntervalMs: parseInt(process.env.RECONCILIATION_HEALTH_CHECK_INTERVAL_MS || '60000', 10), // 1 minute
      requestTimeoutMs: parseInt(process.env.RECONCILIATION_REQUEST_TIMEOUT_MS || '30000', 10), // 30 seconds
      batchSize: parseInt(process.env.RECONCILIATION_BATCH_SIZE || '100', 10),
      parallelSyncs: parseInt(process.env.RECONCILIATION_PARALLEL_SYNCS || '3', 10),
      ...config,
    };

  }

  /**
   * Check if required database tables exist
   */
  private async checkRequiredTablesExist(): Promise<boolean> {
    try {
      // Check if document_requirements and project_integrations tables exist
      const result = await db.execute(sql`
        SELECT 
          to_regclass('public.document_requirements') as doc_req_exists,
          to_regclass('public.project_integrations') as proj_int_exists
      `);
      
      const row = result.rows[0] as any;
      const docReqExists = row.doc_req_exists !== null;
      const projIntExists = row.proj_int_exists !== null;
      
      if (!docReqExists || !projIntExists) {
        const missing = [];
        if (!docReqExists) missing.push('document_requirements');
        if (!projIntExists) missing.push('project_integrations');
        
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to check database table existence:', error);
      return false;
    }
  }

  /**
   * Start the reconciliation service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }


    // Check if required database tables exist before starting
    const tablesExist = await this.checkRequiredTablesExist();
    if (!tablesExist) {
      return;
    }

    this.isRunning = true;

    // Run initial sync
    this.performPeriodicSync().catch(error => {
      console.error('❌ Initial reconciliation sync failed:', error);
    });

    // Schedule periodic syncs
    this.syncIntervalId = setInterval(() => {
      this.performPeriodicSync().catch(error => {
        console.error('❌ Scheduled reconciliation sync failed:', error);
      });
    }, this.config.syncIntervalMinutes * 60 * 1000);

    // Start health check monitoring
    this.healthCheckIntervalId = setInterval(() => {
      this.performHealthCheck().catch(error => {
        console.error('❌ Health check failed:', error);
      });
    }, this.config.healthCheckIntervalMs);

  }

  /**
   * Stop the reconciliation service
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }

    if (this.healthCheckIntervalId) {
      clearInterval(this.healthCheckIntervalId);
      this.healthCheckIntervalId = null;
    }

  }

  /**
   * Get current health status
   */
  getHealthStatus(): HealthStatus {
    const activeSyncs = this.activeSyncs.size;
    const totalIntegrations = this.syncStatuses.size;
    const healthyIntegrations = Array.from(this.syncStatuses.values()).filter(s => s.lastSyncSuccess).length;
    const unhealthyIntegrations = totalIntegrations - healthyIntegrations;
    const errorRate = this.totalSyncAttempts > 0 ? (this.totalSyncErrors / this.totalSyncAttempts) * 100 : 0;
    
    const lastSuccessfulSync = Array.from(this.syncStatuses.values())
      .filter(s => s.lastSyncSuccess && s.lastSyncAt)
      .sort((a, b) => (b.lastSyncAt!.getTime() - a.lastSyncAt!.getTime()))[0];

    return {
      running: this.isRunning,
      lastHealthCheck: this.lastHealthCheck,
      activeSyncs,
      totalIntegrations,
      healthyIntegrations,
      unhealthyIntegrations,
      errorRate: Math.round(errorRate * 100) / 100,
      lastSuccessfulSyncAt: lastSuccessfulSync?.lastSyncAt,
    };
  }

  /**
   * Get sync status for all integrations
   */
  getSyncStatuses(): SyncStatus[] {
    return Array.from(this.syncStatuses.values());
  }

  /**
   * Manually trigger sync for a specific project integration
   */
  async triggerSync(projectId: string, provider: string): Promise<SyncResult> {
    const integrationKey = `${projectId}:${provider}`;
    
    // Check if sync is already running for this integration
    if (this.activeSyncs.has(integrationKey)) {
      return await this.activeSyncs.get(integrationKey)!;
    }

    return await this.syncProjectIntegration(projectId, provider);
  }

  /**
   * Main periodic sync orchestrator
   */
  private async performPeriodicSync(): Promise<void> {
    try {

      // Get all active project integrations
      const allProjects = await storage.getAllActiveProjects();
      const integrations: ProjectIntegration[] = [];

      for (const project of allProjects) {
        const projectIntegrations = await storage.getProjectIntegrationsByProject(project.id);
        integrations.push(...projectIntegrations.filter(i => this.isDocumentProvider(i.provider)));
      }


      if (integrations.length === 0) {
        return;
      }

      // Process integrations in parallel batches
      const batches = this.chunkArray(integrations, this.config.parallelSyncs);
      
      for (const batch of batches) {
        const syncPromises = batch.map(integration => 
          this.syncProjectIntegration(integration.projectId, integration.provider)
            .catch(error => {
              console.error(`❌ Failed to sync ${integration.projectId}:${integration.provider}:`, error);
              return { success: false, error: error.message, documentsProcessed: 0 };
            })
        );

        await Promise.all(syncPromises);
      }

    } catch (error) {
      console.error('❌ Periodic reconciliation sync failed:', error);
    }
  }

  /**
   * Sync a specific project integration with exponential backoff
   */
  private async syncProjectIntegration(projectId: string, provider: string): Promise<SyncResult> {
    const integrationKey = `${projectId}:${provider}`;
    
    // Check if sync is already running
    if (this.activeSyncs.has(integrationKey)) {
      return await this.activeSyncs.get(integrationKey)!;
    }

    // Create sync promise and track it
    const syncPromise = this.performSyncWithRetry(projectId, provider);
    this.activeSyncs.set(integrationKey, syncPromise);

    try {
      const result = await syncPromise;
      return result;
    } finally {
      // Clean up active sync tracking
      this.activeSyncs.delete(integrationKey);
    }
  }

  /**
   * Perform sync with exponential backoff retry logic
   */
  private async performSyncWithRetry(projectId: string, provider: string): Promise<SyncResult> {
    const integrationKey = `${projectId}:${provider}`;
    let retryCount = 0;
    let lastError: string | undefined;

    // Initialize sync status if not exists
    if (!this.syncStatuses.has(integrationKey)) {
      this.syncStatuses.set(integrationKey, {
        projectId,
        provider,
        retryCount: 0,
        documentsProcessed: 0,
      });
    }

    const status = this.syncStatuses.get(integrationKey)!;

    while (retryCount <= this.config.maxRetries) {
      try {
        this.totalSyncAttempts++;
        
        
        const result = await this.performSingleSync(projectId, provider);
        
        // Update sync status on success
        status.lastSyncAt = new Date();
        status.lastSyncSuccess = true;
        status.lastError = undefined;
        status.retryCount = 0;
        status.nextRetryAt = undefined;
        status.documentsProcessed += result.documentsProcessed;
        this.syncStatuses.set(integrationKey, status);

        return result;

      } catch (error: any) {
        retryCount++;
        lastError = error.message || 'Unknown error';
        this.totalSyncErrors++;

        console.error(`❌ Sync attempt ${retryCount} failed for ${integrationKey}:`, lastError);

        // Update sync status on failure
        status.lastSyncAt = new Date();
        status.lastSyncSuccess = false;
        status.lastError = lastError;
        status.retryCount = retryCount;

        // If we haven't exceeded max retries, calculate next retry time
        if (retryCount <= this.config.maxRetries) {
          const delayMs = this.calculateExponentialBackoff(retryCount);
          const nextRetryAt = addMinutes(new Date(), delayMs / (1000 * 60));
          status.nextRetryAt = nextRetryAt;
          
          
          // Wait before retrying
          await this.sleep(delayMs);
        } else {
          status.nextRetryAt = undefined;
        }

        this.syncStatuses.set(integrationKey, status);
      }
    }

    // All retries exhausted
    console.error(`💀 Max retries exhausted for ${integrationKey}. Last error: ${lastError}`);
    return {
      success: false,
      error: `Max retries exhausted. Last error: ${lastError}`,
      documentsProcessed: 0,
    };
  }

  /**
   * Perform a single sync operation
   */
  private async performSingleSync(projectId: string, provider: string): Promise<SyncResult> {
    // Get project integration configuration
    const integration = await storage.getProjectIntegrationByProvider(projectId, provider);
    if (!integration) {
      throw new Error(`Integration not found for project ${projectId} and provider ${provider}`);
    }

    const config = integration.config as any;
    const lastSyncCursor = config.lastSyncCursor || '';
    

    try {
      // Call external document application API
      const response = await this.fetchDocumentsFromExternalApp(provider, config, lastSyncCursor);
      
      if (response.documents.length === 0) {
        return { success: true, documentsProcessed: 0, nextCursor: response.nextCursor };
      }


      // Process documents in batches
      const batches = this.chunkArray(response.documents, this.config.batchSize);
      let totalProcessed = 0;

      for (const batch of batches) {
        const processed = await this.processBatchOfDocuments(projectId, batch);
        totalProcessed += processed;
      }

      // Update cursor for successful sync
      if (response.nextCursor && response.nextCursor !== lastSyncCursor) {
        await storage.updateLastSyncCursor(projectId, provider, response.nextCursor);
      }

      return {
        success: true,
        documentsProcessed: totalProcessed,
        nextCursor: response.nextCursor,
      };

    } catch (error: any) {
      // Handle different types of errors
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new Error(`External document service unavailable: ${error.message}`);
      } else if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        const retryAfterMs = retryAfter ? parseInt(retryAfter) * 1000 : 60000; // Default 1 minute
        throw new Error(`Rate limited by external service. Retry after: ${retryAfterMs}ms`);
      } else if (error.response?.status >= 400 && error.response?.status < 500) {
        throw new Error(`Client error from external service (${error.response.status}): ${error.message}`);
      } else if (error.response?.status >= 500) {
        throw new Error(`Server error from external service (${error.response.status}): ${error.message}`);
      } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        throw new Error(`Request timeout while connecting to external service: ${error.message}`);
      } else {
        throw new Error(`Unexpected error during sync: ${error.message}`);
      }
    }
  }

  /**
   * Fetch documents from external application API (simulated)
   */
  private async fetchDocumentsFromExternalApp(
    provider: string, 
    config: any, 
    cursor: string
  ): Promise<ExternalDocumentResponse> {
    // Simulate API call with timeout
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, this.config.requestTimeoutMs);

      // Simulate API call delay
      setTimeout(() => {
        clearTimeout(timeoutId);
        
        // Simulate different scenarios for testing
        const scenario = Math.random();
        
        if (scenario < 0.1) {
          // 10% chance of network error
          reject(new Error('ECONNREFUSED: Connection refused'));
        } else if (scenario < 0.15) {
          // 5% chance of rate limiting
          const error: any = new Error('Rate limited');
          error.response = { status: 429, headers: { 'retry-after': '60' } };
          reject(error);
        } else if (scenario < 0.2) {
          // 5% chance of server error
          const error: any = new Error('Internal server error');
          error.response = { status: 500 };
          reject(error);
        } else {
          // 80% chance of success
          const mockDocuments: ExternalDocument[] = this.generateMockDocuments(provider, cursor);
          resolve({
            documents: mockDocuments,
            nextCursor: `cursor_${Date.now()}_${Math.random()}`,
            hasMore: mockDocuments.length > 0,
          });
        }
      }, Math.random() * 2000 + 500); // 0.5-2.5s delay
    });
  }

  /**
   * Generate mock documents for testing
   */
  private generateMockDocuments(provider: string, cursor: string): ExternalDocument[] {
    // Simulate fewer documents if cursor exists (incremental sync)
    const count = cursor ? Math.floor(Math.random() * 3) : Math.floor(Math.random() * 10);
    const documents: ExternalDocument[] = [];

    for (let i = 0; i < count; i++) {
      documents.push({
        id: `doc_${Date.now()}_${i}`,
        name: `Document ${i + 1}`,
        status: ['requested', 'received', 'verified'][Math.floor(Math.random() * 3)] as any,
        taskId: `task_${Math.random().toString(36).substr(2, 9)}`,
        projectId: `project_${Math.random().toString(36).substr(2, 9)}`,
        description: `Document description for item ${i + 1}`,
        url: `https://external-app.com/documents/doc_${Date.now()}_${i}`,
        lastModified: new Date(),
        metadata: { provider, syncedAt: new Date().toISOString() },
      });
    }

    return documents;
  }

  /**
   * Process a batch of documents
   */
  private async processBatchOfDocuments(projectId: string, documents: ExternalDocument[]): Promise<number> {
    let processed = 0;

    for (const doc of documents) {
      try {
        // Check if document requirement already exists
        const existingRequirements = await storage.getDocumentRequirementsByTask(doc.taskId);
        const existingRequirement = existingRequirements.find(req => 
          req.metadata && (req.metadata as any).externalId === doc.id
        );

        if (existingRequirement) {
          // Update existing requirement
          await storage.updateDocumentRequirement(existingRequirement.id, {
            status: doc.status,
            description: doc.description,
            metadata: {
              ...(existingRequirement.metadata as any || {}),
              ...doc.metadata,
              url: doc.url,
              lastSynced: new Date().toISOString(),
            },
          });
        } else {
          // Create new document requirement
          const requirement: Partial<InsertDocumentRequirement> = {
            projectId: projectId,
            taskId: doc.taskId,
            requirementKey: doc.id, // Use external doc ID as requirement key
            title: doc.name,
            description: doc.description,
            provider: 'external', // Default provider name
            externalDocId: doc.id,
            status: doc.status,
            metadata: {
              externalId: doc.id,
              url: doc.url,
              ...doc.metadata,
              lastSynced: new Date().toISOString(),
            },
          };

          await storage.createDocumentRequirement(requirement as InsertDocumentRequirement);
        }

        processed++;
      } catch (error) {
        console.error(`❌ Failed to process document ${doc.id}:`, error);
        // Continue processing other documents
      }
    }

    return processed;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateExponentialBackoff(retryCount: number): number {
    const delay = this.config.baseDelayMs * Math.pow(2, retryCount - 1);
    const jitter = Math.random() * 0.1 * delay; // Add 10% jitter
    return Math.min(delay + jitter, this.config.maxDelayMs);
  }

  /**
   * Check if provider is a document provider
   */
  private isDocumentProvider(provider: string): boolean {
    const documentProviders = ['docusign', 'pandadoc', 'hellosign', 'adobe_sign', 'dropbox', 'sharepoint', 'google_drive'];
    return documentProviders.includes(provider.toLowerCase());
  }

  /**
   * Utility function to chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Utility function for sleeping/delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Perform health check and update status
   */
  private async performHealthCheck(): Promise<void> {
    try {
      this.lastHealthCheck = new Date();
      const healthStatus = this.getHealthStatus();
      
      
      // Log unhealthy integrations
      const unhealthyStatuses = this.getSyncStatuses().filter(s => !s.lastSyncSuccess && s.lastError);
      if (unhealthyStatuses.length > 0) {
      }
    } catch (error) {
      console.error('❌ Health check failed:', error);
    }
  }

  /**
   * Manual trigger for testing purposes
   */
  async triggerHealthCheck(): Promise<HealthStatus> {
    await this.performHealthCheck();
    return this.getHealthStatus();
  }

  /**
   * Get sync history for a specific integration (useful for debugging)
   */
  getSyncHistory(projectId: string, provider: string): SyncStatus | undefined {
    return this.syncStatuses.get(`${projectId}:${provider}`);
  }

  /**
   * Reset sync status for a specific integration (useful for recovery)
   */
  resetSyncStatus(projectId: string, provider: string): void {
    const integrationKey = `${projectId}:${provider}`;
    this.syncStatuses.delete(integrationKey);
  }

  /**
   * Get configuration
   */
  getConfig(): ReconciliationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration (requires restart to take effect for intervals)
   */
  updateConfig(newConfig: Partial<ReconciliationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Export singleton instance
export const reconciliationService = new ReconciliationService();

// Auto-start the reconciliation service in production
if (process.env.NODE_ENV === 'production' || process.env.AUTO_START_RECONCILIATION_SERVICE === 'true') {
  // Delay startup to allow other services to initialize
  setTimeout(() => {
    try {
      reconciliationService.start();
    } catch (error) {
      console.error('❌ Failed to auto-start ReconciliationService:', error);
    }
  }, 10000); // 10 second delay
}