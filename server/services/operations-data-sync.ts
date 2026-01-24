/**
 * Operations Data Sync Service
 * 
 * Connects Operations modules (Fuel Sales, Rent Roll, Ship Store) to external
 * marina management systems via the MarinaIntegrationAdapter framework.
 * 
 * Data Flow:
 * [Marina Management System] → [MarinaIntegrationAdapter] → [Operations Tables]
 * 
 * Supported Systems: DockMaster, Dockwa, Storable Marine, Marina Office, etc.
 */

import { db } from '../db';
import { 
  userIntegrations, 
  integrationSyncHistory,
  fuelSales,
  rentRolls,
  rentRollEntries,
  shipStoreTransactions,
  shipStoreProducts,
  fuelDeliveries,
  storageLocations,
  marinaProjects
} from '@shared/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { 
  MarinaIntegrationAdapter, 
  DockMasterAdapter, 
  DockwaAdapter,
  StorableMarineAdapter,
  MarinaOfficeAdapter,
  IntegrationAdapterFactory,
  type MarinaSlip,
  type MarinaTenant,
  type MarinaTransaction,
  type SyncResult
} from './marina-integration-adapter';

export interface OperationsSyncConfig {
  integrationKey: string;
  userId: string;
  orgId: string;
  entityTypes?: ('slips' | 'tenants' | 'transactions')[];
  fullSync?: boolean;
  since?: Date;
}

export interface ModuleSyncConfig {
  userId: string;
  orgId: string;
  integrationKey?: string;
  fullSync?: boolean;
  since?: Date;
}

export interface OperationsSyncResult {
  success: boolean;
  integrationKey: string;
  syncId: string;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  duration: number;
  errors: Array<{ code: string; message: string; entity?: string }>;
  summary: {
    slips?: { processed: number; created: number; updated: number };
    tenants?: { processed: number; created: number; updated: number };
    fuelTransactions?: { processed: number; created: number; updated: number };
    storeTransactions?: { processed: number; created: number; updated: number };
  };
}

export interface ModuleSyncResult {
  success: boolean;
  module: 'fuel_sales' | 'rent_roll' | 'ship_store';
  syncId: string;
  integrations: string[];
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  duration: number;
  errors: Array<{ code: string; message: string; integrationKey?: string }>;
}

export interface OperationsSyncStatus {
  integrationKey: string;
  integrationName: string;
  isConnected: boolean;
  lastSyncAt: Date | null;
  lastSyncStatus: 'completed' | 'failed' | 'partial' | null;
  lastSyncRecords: number;
  nextScheduledSync: Date | null;
  healthScore: number;
  supportedModules: string[];
}

export interface IntegrationInfo {
  key: string;
  name: string;
  isConnected: boolean;
  supportedModules: string[];
  lastSyncAt: Date | null;
}

const ADAPTER_REGISTRY: Record<string, new (userId: string, orgId: string) => MarinaIntegrationAdapter> = {
  'dockmaster': DockMasterAdapter,
  'dockwa': DockwaAdapter,
  'storable_marine': StorableMarineAdapter,
  'marina_office': MarinaOfficeAdapter,
};

const INTEGRATION_MODULES: Record<string, string[]> = {
  'dockmaster': ['fuel_sales', 'rent_roll', 'ship_store'],
  'dockwa': ['rent_roll', 'fuel_sales'],
  'storable_marine': ['rent_roll', 'fuel_sales'],
  'marina_office': ['rent_roll', 'fuel_sales', 'ship_store'],
  'marinago': ['fuel_sales', 'rent_roll'],
  'molo': ['rent_roll'],
  'piers': ['rent_roll', 'fuel_sales'],
  'harbour_assist': ['rent_roll'],
  'marinacloud': ['rent_roll', 'ship_store'],
  'anchor': ['rent_roll'],
};

export class OperationsDataSyncService {
  /**
   * Sync fuel sales data from all connected marina integrations
   */
  async syncFuelSales(config: ModuleSyncConfig): Promise<ModuleSyncResult> {
    const startTime = Date.now();
    const syncId = crypto.randomUUID();
    
    const result: ModuleSyncResult = {
      success: false,
      module: 'fuel_sales',
      syncId,
      integrations: [],
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      duration: 0,
      errors: [],
    };

    try {
      const integrations = await this.getConnectedIntegrations(config.userId, config.orgId, 'fuel_sales');
      
      if (config.integrationKey) {
        const filtered = integrations.filter(i => i.integrationKey === config.integrationKey);
        if (filtered.length === 0) {
          result.errors.push({
            code: 'INTEGRATION_NOT_FOUND',
            message: `Integration ${config.integrationKey} not connected or doesn't support fuel sales`,
          });
          result.duration = Date.now() - startTime;
          return result;
        }
      }

      const targetIntegrations = config.integrationKey 
        ? integrations.filter(i => i.integrationKey === config.integrationKey)
        : integrations;

      for (const integration of targetIntegrations) {
        result.integrations.push(integration.integrationKey);
        
        try {
          const adapter = this.getAdapter(integration.integrationKey, config.userId, config.orgId);
          if (!adapter) {
            result.errors.push({
              code: 'ADAPTER_NOT_FOUND',
              message: `No adapter for ${integration.integrationKey}`,
              integrationKey: integration.integrationKey,
            });
            continue;
          }

          const initialized = await adapter.initialize();
          if (!initialized) {
            result.errors.push({
              code: 'ADAPTER_INIT_FAILED',
              message: `Failed to initialize ${integration.integrationKey}`,
              integrationKey: integration.integrationKey,
            });
            continue;
          }

          const transactions = await adapter.getTransactions(config.since);
          const fuelTxns = transactions.filter(t => t.type === 'fuel');
          
          for (const txn of fuelTxns) {
            result.recordsProcessed++;
            const syncResult = await this.syncFuelTransaction(txn, config, integration.integrationKey);
            if (syncResult.created) result.recordsCreated++;
            if (syncResult.updated) result.recordsUpdated++;
            if (syncResult.failed) result.recordsFailed++;
          }
        } catch (err) {
          result.errors.push({
            code: 'SYNC_ERROR',
            message: err instanceof Error ? err.message : 'Unknown error',
            integrationKey: integration.integrationKey,
          });
        }
      }

      result.success = result.errors.length === 0 || result.recordsCreated > 0 || result.recordsUpdated > 0;
      result.duration = Date.now() - startTime;

      await this.recordModuleSyncHistory(config, syncId, 'fuel_sales', result);
      return result;
    } catch (err) {
      result.errors.push({
        code: 'SYNC_FAILED',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
      result.duration = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Sync rent roll data from all connected marina integrations
   */
  async syncRentRoll(config: ModuleSyncConfig): Promise<ModuleSyncResult> {
    const startTime = Date.now();
    const syncId = crypto.randomUUID();
    
    const result: ModuleSyncResult = {
      success: false,
      module: 'rent_roll',
      syncId,
      integrations: [],
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      duration: 0,
      errors: [],
    };

    try {
      const integrations = await this.getConnectedIntegrations(config.userId, config.orgId, 'rent_roll');
      
      if (config.integrationKey) {
        const filtered = integrations.filter(i => i.integrationKey === config.integrationKey);
        if (filtered.length === 0) {
          result.errors.push({
            code: 'INTEGRATION_NOT_FOUND',
            message: `Integration ${config.integrationKey} not connected or doesn't support rent roll`,
          });
          result.duration = Date.now() - startTime;
          return result;
        }
      }

      const targetIntegrations = config.integrationKey 
        ? integrations.filter(i => i.integrationKey === config.integrationKey)
        : integrations;

      for (const integration of targetIntegrations) {
        result.integrations.push(integration.integrationKey);
        
        try {
          const adapter = this.getAdapter(integration.integrationKey, config.userId, config.orgId);
          if (!adapter) continue;

          const initialized = await adapter.initialize();
          if (!initialized) continue;

          const slips = await adapter.getSlips();
          const tenants = await adapter.getTenants();

          const slipResult = await this.syncSlipsToRentRoll(slips, {
            ...config,
            integrationKey: integration.integrationKey,
          } as OperationsSyncConfig);
          
          result.recordsProcessed += slipResult.processed;
          result.recordsCreated += slipResult.created;
          result.recordsUpdated += slipResult.updated;

          const tenantResult = await this.syncTenantsToRentRoll(tenants, {
            ...config,
            integrationKey: integration.integrationKey,
          } as OperationsSyncConfig);
          
          result.recordsProcessed += tenantResult.processed;
          result.recordsCreated += tenantResult.created;
          result.recordsUpdated += tenantResult.updated;

        } catch (err) {
          result.errors.push({
            code: 'SYNC_ERROR',
            message: err instanceof Error ? err.message : 'Unknown error',
            integrationKey: integration.integrationKey,
          });
        }
      }

      result.success = result.errors.length === 0 || result.recordsCreated > 0 || result.recordsUpdated > 0;
      result.duration = Date.now() - startTime;

      await this.recordModuleSyncHistory(config, syncId, 'rent_roll', result);
      return result;
    } catch (err) {
      result.errors.push({
        code: 'SYNC_FAILED',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
      result.duration = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Sync ship store data from all connected marina integrations
   */
  async syncShipStore(config: ModuleSyncConfig): Promise<ModuleSyncResult> {
    const startTime = Date.now();
    const syncId = crypto.randomUUID();
    
    const result: ModuleSyncResult = {
      success: false,
      module: 'ship_store',
      syncId,
      integrations: [],
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      duration: 0,
      errors: [],
    };

    try {
      const integrations = await this.getConnectedIntegrations(config.userId, config.orgId, 'ship_store');
      
      if (config.integrationKey) {
        const filtered = integrations.filter(i => i.integrationKey === config.integrationKey);
        if (filtered.length === 0) {
          result.errors.push({
            code: 'INTEGRATION_NOT_FOUND',
            message: `Integration ${config.integrationKey} not connected or doesn't support ship store`,
          });
          result.duration = Date.now() - startTime;
          return result;
        }
      }

      const targetIntegrations = config.integrationKey 
        ? integrations.filter(i => i.integrationKey === config.integrationKey)
        : integrations;

      for (const integration of targetIntegrations) {
        result.integrations.push(integration.integrationKey);
        
        try {
          const adapter = this.getAdapter(integration.integrationKey, config.userId, config.orgId);
          if (!adapter) continue;

          const initialized = await adapter.initialize();
          if (!initialized) continue;

          const transactions = await adapter.getTransactions(config.since);
          const storeTxns = transactions.filter(t => t.type === 'merchandise');
          
          for (const txn of storeTxns) {
            result.recordsProcessed++;
            const syncResult = await this.syncShipStoreTransaction(txn, config, integration.integrationKey);
            if (syncResult.created) result.recordsCreated++;
            if (syncResult.updated) result.recordsUpdated++;
            if (syncResult.failed) result.recordsFailed++;
          }
        } catch (err) {
          result.errors.push({
            code: 'SYNC_ERROR',
            message: err instanceof Error ? err.message : 'Unknown error',
            integrationKey: integration.integrationKey,
          });
        }
      }

      result.success = result.errors.length === 0 || result.recordsCreated > 0 || result.recordsUpdated > 0;
      result.duration = Date.now() - startTime;

      await this.recordModuleSyncHistory(config, syncId, 'ship_store', result);
      return result;
    } catch (err) {
      result.errors.push({
        code: 'SYNC_FAILED',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
      result.duration = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Trigger a sync from a specific marina integration to operations modules
   */
  async syncFromIntegration(config: OperationsSyncConfig): Promise<OperationsSyncResult> {
    const startTime = Date.now();
    const syncId = crypto.randomUUID();
    
    const result: OperationsSyncResult = {
      success: false,
      integrationKey: config.integrationKey,
      syncId,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      duration: 0,
      errors: [],
      summary: {},
    };

    try {
      const [integration] = await db
        .select()
        .from(userIntegrations)
        .where(and(
          eq(userIntegrations.userId, config.userId),
          eq(userIntegrations.integrationKey, config.integrationKey),
          eq(userIntegrations.isConnected, true)
        ))
        .limit(1);

      if (!integration) {
        result.errors.push({ 
          code: 'INTEGRATION_NOT_FOUND', 
          message: `No connected integration found for ${config.integrationKey}` 
        });
        return result;
      }

      const adapter = this.getAdapter(config.integrationKey, config.userId, config.orgId);
      if (!adapter) {
        result.errors.push({ 
          code: 'UNSUPPORTED_ADAPTER', 
          message: `No adapter available for ${config.integrationKey}` 
        });
        return result;
      }

      const initialized = await adapter.initialize();
      
      if (!initialized) {
        result.errors.push({ 
          code: 'ADAPTER_INIT_FAILED', 
          message: 'Failed to initialize integration adapter' 
        });
        return result;
      }

      await this.recordSyncStart(config, syncId);

      const entityTypes = config.entityTypes || ['slips', 'tenants', 'transactions'];

      if (entityTypes.includes('slips')) {
        try {
          const slips = await adapter.getSlips();
          result.summary.slips = await this.syncSlipsToRentRoll(slips, config);
          result.recordsProcessed += slips.length;
          result.recordsCreated += result.summary.slips.created;
          result.recordsUpdated += result.summary.slips.updated;
        } catch (err) {
          result.errors.push({ 
            code: 'SLIPS_SYNC_FAILED', 
            message: err instanceof Error ? err.message : 'Unknown error',
            entity: 'slips'
          });
        }
      }

      if (entityTypes.includes('tenants')) {
        try {
          const tenants = await adapter.getTenants();
          result.summary.tenants = await this.syncTenantsToRentRoll(tenants, config);
          result.recordsProcessed += tenants.length;
          result.recordsCreated += result.summary.tenants.created;
          result.recordsUpdated += result.summary.tenants.updated;
        } catch (err) {
          result.errors.push({ 
            code: 'TENANTS_SYNC_FAILED', 
            message: err instanceof Error ? err.message : 'Unknown error',
            entity: 'tenants'
          });
        }
      }

      if (entityTypes.includes('transactions')) {
        try {
          const transactions = await adapter.getTransactions(config.since);
          const { fuel, store } = await this.syncTransactionsToOperations(transactions, config);
          result.summary.fuelTransactions = fuel;
          result.summary.storeTransactions = store;
          result.recordsProcessed += transactions.length;
          result.recordsCreated += fuel.created + store.created;
          result.recordsUpdated += fuel.updated + store.updated;
        } catch (err) {
          result.errors.push({ 
            code: 'TRANSACTIONS_SYNC_FAILED', 
            message: err instanceof Error ? err.message : 'Unknown error',
            entity: 'transactions'
          });
        }
      }

      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;

      await this.recordSyncComplete(config, syncId, result);
      
      return result;
    } catch (err) {
      result.errors.push({ 
        code: 'SYNC_FAILED', 
        message: err instanceof Error ? err.message : 'Unknown error' 
      });
      result.duration = Date.now() - startTime;
      await this.recordSyncComplete(config, syncId, result);
      return result;
    }
  }

  /**
   * Get list of available integrations for the user
   */
  async getAvailableIntegrations(userId: string, orgId: string): Promise<IntegrationInfo[]> {
    const connectedIntegrations = await db
      .select({
        integrationKey: userIntegrations.integrationKey,
        isConnected: userIntegrations.isConnected,
        lastSyncAt: userIntegrations.lastSyncAt,
      })
      .from(userIntegrations)
      .where(and(
        eq(userIntegrations.userId, userId),
        eq(userIntegrations.orgId, orgId)
      ));

    const allIntegrations = IntegrationAdapterFactory.getSupportedIntegrations();
    
    return allIntegrations.map(key => {
      const connected = connectedIntegrations.find(i => i.integrationKey === key);
      return {
        key,
        name: this.getIntegrationDisplayName(key),
        isConnected: connected?.isConnected || false,
        supportedModules: INTEGRATION_MODULES[key] || [],
        lastSyncAt: connected?.lastSyncAt || null,
      };
    });
  }

  /**
   * Get connected integrations that support a specific module
   */
  private async getConnectedIntegrations(
    userId: string, 
    orgId: string, 
    module: 'fuel_sales' | 'rent_roll' | 'ship_store'
  ) {
    const connectedIntegrations = await db
      .select({
        integrationKey: userIntegrations.integrationKey,
        isConnected: userIntegrations.isConnected,
        lastSyncAt: userIntegrations.lastSyncAt,
      })
      .from(userIntegrations)
      .where(and(
        eq(userIntegrations.userId, userId),
        eq(userIntegrations.orgId, orgId),
        eq(userIntegrations.isConnected, true)
      ));

    return connectedIntegrations.filter(i => {
      const modules = INTEGRATION_MODULES[i.integrationKey] || [];
      return modules.includes(module);
    });
  }

  /**
   * Get adapter instance for an integration
   */
  private getAdapter(integrationKey: string, userId: string, orgId: string): MarinaIntegrationAdapter | null {
    const AdapterClass = ADAPTER_REGISTRY[integrationKey];
    if (AdapterClass) {
      return new AdapterClass(userId, orgId);
    }
    return IntegrationAdapterFactory.getAdapter(integrationKey, userId, orgId);
  }

  /**
   * Sync a single fuel transaction
   */
  private async syncFuelTransaction(
    txn: MarinaTransaction,
    config: ModuleSyncConfig,
    integrationKey: string
  ): Promise<{ created: boolean; updated: boolean; failed: boolean }> {
    try {
      const existing = await db.query.fuelSales.findFirst({
        where: and(
          eq(fuelSales.orgId, config.orgId),
          eq(fuelSales.externalId, txn.externalId)
        )
      });

      if (existing) {
        await db.update(fuelSales)
          .set({
            totalAmount: txn.amount.toString(),
            notes: txn.description,
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(fuelSales.id, existing.id));
        return { created: false, updated: true, failed: false };
      } else {
        await db.insert(fuelSales).values({
          orgId: config.orgId,
          transactionDate: txn.date,
          fuelType: 'diesel',
          quantityGallons: '0',
          pricePerGallon: '0',
          totalAmount: txn.amount.toString(),
          customerName: null,
          boatName: null,
          slipNumber: null,
          pumpId: null,
          paymentMethod: txn.paymentMethod as any || 'credit_card',
          notes: txn.description,
          externalId: txn.externalId,
          integrationSource: integrationKey,
          lastSyncedAt: new Date(),
        });
        return { created: true, updated: false, failed: false };
      }
    } catch (err) {
      console.error('[syncFuelTransaction] Error:', err);
      return { created: false, updated: false, failed: true };
    }
  }

  /**
   * Sync a single ship store transaction
   * Note: Ship store transactions are matched by paymentIntentId since externalId is not available
   */
  private async syncShipStoreTransaction(
    txn: MarinaTransaction,
    config: ModuleSyncConfig,
    integrationKey: string
  ): Promise<{ created: boolean; updated: boolean; failed: boolean }> {
    try {
      const existing = await db.query.shipStoreTransactions.findFirst({
        where: and(
          eq(shipStoreTransactions.orgId, config.orgId),
          eq(shipStoreTransactions.paymentIntentId, `sync_${txn.externalId}`)
        )
      });

      if (existing) {
        await db.update(shipStoreTransactions)
          .set({
            total: txn.amount.toString(),
            status: txn.status,
          })
          .where(eq(shipStoreTransactions.id, existing.id));
        return { created: false, updated: true, failed: false };
      } else {
        await db.insert(shipStoreTransactions).values({
          orgId: config.orgId,
          total: txn.amount.toString(),
          subtotal: txn.amount.toString(),
          tax: '0',
          paymentMethod: txn.paymentMethod || 'credit_card',
          paymentIntentId: `sync_${txn.externalId}`,
          status: txn.status,
          items: [],
        });
        return { created: true, updated: false, failed: false };
      }
    } catch (err) {
      console.error('[syncShipStoreTransaction] Error:', err);
      return { created: false, updated: false, failed: true };
    }
  }

  /**
   * Sync slips data to rent roll tables
   */
  private async syncSlipsToRentRoll(
    slips: MarinaSlip[], 
    config: OperationsSyncConfig
  ): Promise<{ processed: number; created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    const [existingRentRoll] = await db
      .select()
      .from(rentRolls)
      .where(eq(rentRolls.orgId, config.orgId))
      .orderBy(desc(rentRolls.effectiveDate))
      .limit(1);

    let rentRollId = existingRentRoll?.id;

    if (!rentRollId) {
      const [newRentRoll] = await db.insert(rentRolls).values({
        orgId: config.orgId,
        name: `Synced from ${config.integrationKey}`,
        effectiveDate: new Date().toISOString().split('T')[0],
        notes: `Auto-created from ${config.integrationKey} integration sync`,
      }).returning();
      rentRollId = newRentRoll.id;
      created++;
    }

    for (const slip of slips) {
      const existingEntry = await db.query.rentRollEntries.findFirst({
        where: and(
          eq(rentRollEntries.rentRollId, rentRollId),
          eq(rentRollEntries.unitNumber, slip.name)
        )
      });

      const entryData = {
        unitNumber: slip.name,
        entryType: 'slip' as const,
        status: slip.status === 'occupied' ? 'active' as const : 'expired' as const,
        monthlyRate: slip.monthlyRate?.toString() || '0',
        notes: `Synced from ${config.integrationKey} | External ID: ${slip.externalId}`,
      };

      if (existingEntry) {
        await db.update(rentRollEntries)
          .set({ ...entryData, updatedAt: new Date() })
          .where(eq(rentRollEntries.id, existingEntry.id));
        updated++;
      } else {
        await db.insert(rentRollEntries).values({
          orgId: config.orgId,
          rentRollId,
          ...entryData,
        });
        created++;
      }
    }

    return { processed: slips.length, created, updated };
  }

  /**
   * Sync tenant/lease data to rent roll entries
   */
  private async syncTenantsToRentRoll(
    tenants: MarinaTenant[], 
    config: OperationsSyncConfig
  ): Promise<{ processed: number; created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    const [existingRentRoll] = await db
      .select()
      .from(rentRolls)
      .where(eq(rentRolls.orgId, config.orgId))
      .orderBy(desc(rentRolls.effectiveDate))
      .limit(1);

    if (!existingRentRoll) {
      return { processed: tenants.length, created: 0, updated: 0 };
    }

    for (const tenant of tenants) {
      if (!tenant.slipId) continue;

      const allEntries = await db
        .select()
        .from(rentRollEntries)
        .where(eq(rentRollEntries.rentRollId, existingRentRoll.id));

      const existingEntry = allEntries.find(e => 
        e.notes?.includes(`External ID: ${tenant.slipId}`) ||
        e.unitNumber === tenant.slipId
      );

      if (existingEntry) {
        await db.update(rentRollEntries)
          .set({
            tenantName: `${tenant.firstName} ${tenant.lastName}`.trim(),
            startDate: tenant.leaseStart?.toISOString().split('T')[0],
            endDate: tenant.leaseEnd?.toISOString().split('T')[0],
            monthlyRate: tenant.monthlyRate?.toString() || existingEntry.monthlyRate,
            status: tenant.status === 'active' ? 'active' as const : 'expired' as const,
            updatedAt: new Date(),
          })
          .where(eq(rentRollEntries.id, existingEntry.id));
        updated++;
      }
    }

    return { processed: tenants.length, created, updated };
  }

  /**
   * Sync transactions to fuel sales and ship store tables
   */
  private async syncTransactionsToOperations(
    transactions: MarinaTransaction[], 
    config: OperationsSyncConfig
  ): Promise<{ 
    fuel: { processed: number; created: number; updated: number }; 
    store: { processed: number; created: number; updated: number } 
  }> {
    const fuelResult = { processed: 0, created: 0, updated: 0 };
    const storeResult = { processed: 0, created: 0, updated: 0 };

    for (const txn of transactions) {
      if (txn.type === 'fuel') {
        fuelResult.processed++;
        const existing = await db.query.fuelSales.findFirst({
          where: and(
            eq(fuelSales.orgId, config.orgId),
            eq(fuelSales.externalId, txn.externalId)
          )
        });

        if (existing) {
          await db.update(fuelSales)
            .set({
              totalAmount: txn.amount.toString(),
              notes: txn.description,
              lastSyncedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(fuelSales.id, existing.id));
          fuelResult.updated++;
        } else {
          await db.insert(fuelSales).values({
            orgId: config.orgId,
            transactionDate: txn.date,
            fuelType: 'diesel',
            quantityGallons: '0',
            pricePerGallon: '0',
            totalAmount: txn.amount.toString(),
            customerName: null,
            boatName: null,
            slipNumber: null,
            pumpId: null,
            paymentMethod: txn.paymentMethod as any || 'credit_card',
            notes: txn.description,
            externalId: txn.externalId,
            integrationSource: config.integrationKey,
            lastSyncedAt: new Date(),
          });
          fuelResult.created++;
        }
      } else if (txn.type === 'merchandise') {
        storeResult.processed++;
        const existing = await db.query.shipStoreTransactions.findFirst({
          where: and(
            eq(shipStoreTransactions.orgId, config.orgId),
            eq(shipStoreTransactions.paymentIntentId, `sync_${txn.externalId}`)
          )
        });

        if (existing) {
          await db.update(shipStoreTransactions)
            .set({
              total: txn.amount.toString(),
              status: txn.status,
            })
            .where(eq(shipStoreTransactions.id, existing.id));
          storeResult.updated++;
        } else {
          await db.insert(shipStoreTransactions).values({
            orgId: config.orgId,
            total: txn.amount.toString(),
            subtotal: txn.amount.toString(),
            tax: '0',
            paymentMethod: txn.paymentMethod || 'credit_card',
            paymentIntentId: `sync_${txn.externalId}`,
            status: txn.status,
            items: [],
          });
          storeResult.created++;
        }
      }
    }

    return { fuel: fuelResult, store: storeResult };
  }

  /**
   * Get sync status for all connected integrations
   */
  async getSyncStatus(userId: string, orgId: string): Promise<OperationsSyncStatus[]> {
    const connectedIntegrations = await db
      .select({
        integrationKey: userIntegrations.integrationKey,
        isConnected: userIntegrations.isConnected,
        lastSyncAt: userIntegrations.lastSyncAt,
        errorMessage: userIntegrations.errorMessage,
      })
      .from(userIntegrations)
      .where(and(
        eq(userIntegrations.userId, userId),
        eq(userIntegrations.orgId, orgId),
        eq(userIntegrations.isConnected, true)
      ));

    const statusList: OperationsSyncStatus[] = [];

    for (const integration of connectedIntegrations) {
      const [lastSync] = await db
        .select({
          status: integrationSyncHistory.status,
          recordsProcessed: integrationSyncHistory.recordsProcessed,
          completedAt: integrationSyncHistory.completedAt,
        })
        .from(integrationSyncHistory)
        .where(and(
          eq(integrationSyncHistory.userId, userId),
          eq(integrationSyncHistory.integrationKey, integration.integrationKey)
        ))
        .orderBy(desc(integrationSyncHistory.completedAt))
        .limit(1);

      statusList.push({
        integrationKey: integration.integrationKey,
        integrationName: this.getIntegrationDisplayName(integration.integrationKey),
        isConnected: integration.isConnected,
        lastSyncAt: integration.lastSyncAt,
        lastSyncStatus: lastSync?.status as any || null,
        lastSyncRecords: lastSync?.recordsProcessed || 0,
        nextScheduledSync: null,
        healthScore: integration.errorMessage ? 50 : 100,
        supportedModules: INTEGRATION_MODULES[integration.integrationKey] || [],
      });
    }

    return statusList;
  }

  /**
   * Get detailed sync history for a specific integration
   */
  async getSyncHistory(userId: string, integrationKey: string, limit = 10) {
    return db
      .select()
      .from(integrationSyncHistory)
      .where(and(
        eq(integrationSyncHistory.userId, userId),
        eq(integrationSyncHistory.integrationKey, integrationKey)
      ))
      .orderBy(desc(integrationSyncHistory.startedAt))
      .limit(limit);
  }

  private async recordSyncStart(config: OperationsSyncConfig, syncId: string): Promise<void> {
    await db.insert(integrationSyncHistory).values({
      id: syncId,
      userId: config.userId,
      orgId: config.orgId,
      integrationKey: config.integrationKey,
      syncType: config.fullSync ? 'full_sync' : 'incremental',
      status: 'in_progress',
      startedAt: new Date(),
      triggeredBy: 'manual',
    });
  }

  private async recordSyncComplete(
    config: OperationsSyncConfig, 
    syncId: string, 
    result: OperationsSyncResult
  ): Promise<void> {
    const status = result.success ? 'completed' : (result.errors.length > 0 && result.recordsCreated > 0 ? 'partial' : 'failed');
    
    await db.update(integrationSyncHistory)
      .set({
        status: status as any,
        completedAt: new Date(),
        recordsProcessed: result.recordsProcessed,
        recordsCreated: result.recordsCreated,
        recordsUpdated: result.recordsUpdated,
        recordsFailed: result.recordsFailed,
        errorCount: result.errors.length,
        errors: result.errors.map(e => ({ ...e, timestamp: new Date().toISOString() })),
        metadata: { 
          duration: result.duration,
          summary: result.summary,
        },
      })
      .where(eq(integrationSyncHistory.id, syncId));

    await db.update(userIntegrations)
      .set({ 
        lastSyncAt: new Date(),
        errorMessage: result.success ? null : result.errors[0]?.message,
        updatedAt: new Date(),
      })
      .where(and(
        eq(userIntegrations.userId, config.userId),
        eq(userIntegrations.integrationKey, config.integrationKey)
      ));
  }

  private async recordModuleSyncHistory(
    config: ModuleSyncConfig,
    syncId: string,
    module: string,
    result: ModuleSyncResult
  ): Promise<void> {
    const integrationKey = config.integrationKey || `multi_${result.integrations.join('_')}`;
    
    await db.insert(integrationSyncHistory).values({
      id: syncId,
      userId: config.userId,
      orgId: config.orgId,
      integrationKey: integrationKey,
      syncType: config.fullSync ? 'full_sync' : 'incremental',
      status: result.success ? 'completed' : (result.errors.length > 0 && result.recordsCreated > 0 ? 'partial' : 'failed'),
      startedAt: new Date(Date.now() - result.duration),
      completedAt: new Date(),
      recordsProcessed: result.recordsProcessed,
      recordsCreated: result.recordsCreated,
      recordsUpdated: result.recordsUpdated,
      recordsFailed: result.recordsFailed,
      errorCount: result.errors.length,
      errors: result.errors.map(e => ({ ...e, timestamp: new Date().toISOString() })),
      metadata: { 
        module,
        integrations: result.integrations,
        duration: result.duration,
      },
      triggeredBy: 'manual',
    });
  }

  private getIntegrationDisplayName(key: string): string {
    const names: Record<string, string> = {
      'dockmaster': 'DockMaster',
      'dockwa': 'Dockwa',
      'storable_marine': 'Storable Marine',
      'marina_office': 'Marina Office',
      'marinago': 'MarinaGo',
      'molo': 'Molo',
      'piers': 'PIERS',
      'harbour_assist': 'Harbour Assist',
      'marinacloud': 'Marinacloud',
      'anchor': 'Anchor',
    };
    return names[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
  }
}

export const operationsDataSync = new OperationsDataSyncService();
