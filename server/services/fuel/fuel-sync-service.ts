import type { FuelProvider } from "./fuel-provider-interface";
import { fuelProviderRegistry } from "./fuel-provider-interface";
import { FuelCloudProvider } from "./fuelcloud-provider";
import type { IStorage } from "../../storage";
import type { InsertFuelSale, InsertFuelImportLog } from "@shared/schema";
import { db } from "../../db";
import { fuelSales } from "@shared/schema";
import { eq, and } from "drizzle-orm";

// Register providers
fuelProviderRegistry.register('fuelcloud', FuelCloudProvider);
fuelProviderRegistry.register('fuelcloud_api', FuelCloudProvider);

/**
 * Fuel Sync Service
 * 
 * Orchestrates the complete sync workflow:
 * 1. Create provider instance
 * 2. Fetch transactions with pagination
 * 3. Deduplicate using external IDs
 * 4. Insert/update transactions
 * 5. Create import log with detailed results
 * 6. Update integration lastSyncAt
 */

export class FuelSyncService {
  constructor(private storage: IStorage) {}

  /**
   * Execute a full sync for a fuel integration
   * 
   * @param integrationId - Integration ID
   * @param userId - User who triggered the sync (for audit)
   * @param maxPages - Maximum number of pages to fetch (safety limit)
   */
  async syncIntegration(
    integrationId: string,
    userId: string,
    maxPages = 50
  ): Promise<{
    success: boolean;
    importLogId: string;
    summary: {
      totalFetched: number;
      imported: number;
      updated: number;
      skipped: number;
      failed: number;
    };
  }> {
    const integration = await this.storage.getFuelIntegrationById(integrationId);
    
    if (!integration) {
      throw new Error('Integration not found');
    }

    if (!integration.isEnabled) {
      throw new Error('Integration is disabled');
    }

    // Create import log
    const importLog = await this.storage.createFuelImportLog({
      orgId: integration.orgId,
      integrationId: integration.id,
      source: `${integration.provider}_api`,
      importType: 'api_sync',
      status: 'pending',
      createdBy: userId
    });

    const startTime = Date.now();
    const allErrors: any[] = [];
    const allTransactions: Array<Omit<InsertFuelSale, 'id' | 'createdAt' | 'updatedAt'> & { externalId: string }> = [];

    try {
      // Create provider instance
      const provider = fuelProviderRegistry.create(integration.provider, {
        apiUrl: integration.apiUrl || '',
        accessToken: integration.accessToken || '',
        refreshToken: integration.refreshToken || undefined,
        tokenExpiresAt: integration.tokenExpiresAt || undefined,
        fieldMapping: integration.fieldMapping as any,
        orgId: integration.orgId
      });

      if (!provider) {
        throw new Error(`Unsupported provider: ${integration.provider}`);
      }

      // Calculate sync start date (last sync or 30 days ago)
      const startDate = integration.lastSyncAt 
        ? integration.lastSyncAt.toISOString()
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch all pages
      let cursor: string | undefined;
      let hasMore = true;
      let pageCount = 0;

      while (hasMore && pageCount < maxPages) {
        pageCount++;
        
        try {
          const result = await provider.syncTransactions(
            startDate,
            undefined,
            cursor,
            100
          );

          allTransactions.push(...result.transactions);
          allErrors.push(...result.errors);

          cursor = result.cursor;
          hasMore = result.hasMore;

          // Safety check: prevent infinite loops
          if (!result.totalFetched || result.totalFetched === 0) {
            break;
          }

          // Respect rate limits
          if (hasMore) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.error(`Error fetching page ${pageCount}:`, error);
          allErrors.push({
            page: pageCount,
            error: error instanceof Error ? error.message : 'Page fetch failed'
          });
          
          // Continue with partial results
          break;
        }
      }

      if (pageCount >= maxPages && hasMore) {
        allErrors.push({
          warning: `Sync stopped at ${maxPages} pages. Manual sync may be needed.`
        });
      }

      // Deduplicate and insert transactions
      const { imported, updated, skipped } = await this.upsertTransactions(
        allTransactions,
        integration.orgId
      );

      // Update import log
      const duration = Date.now() - startTime;
      const status = allErrors.length > 0 ? 'partial' : 'completed';
      
      await this.storage.updateFuelImportLog(importLog.id, {
        status,
        recordsProcessed: allTransactions.length,
        recordsImported: imported,
        recordsSkipped: skipped + updated, // Count updates as skips for now
        recordsFailed: allErrors.length,
        errorLog: allErrors,
        completedAt: new Date(),
        importData: {
          duration,
          pageCount,
          startDate,
          hasMore: hasMore && pageCount >= maxPages
        }
      });

      // Update integration last sync time
      await this.storage.updateFuelIntegration(integration.id, {
        lastSyncAt: new Date()
      });

      // If token was refreshed, update it
      if ('getUpdatedTokenInfo' in provider) {
        const tokenInfo = (provider as any).getUpdatedTokenInfo();
        if (tokenInfo.accessToken !== integration.accessToken) {
          await this.storage.updateFuelIntegration(integration.id, {
            accessToken: tokenInfo.accessToken,
            refreshToken: tokenInfo.refreshToken,
            tokenExpiresAt: tokenInfo.expiresAt
          });
        }
      }

      return {
        success: status === 'completed',
        importLogId: importLog.id,
        summary: {
          totalFetched: allTransactions.length,
          imported,
          updated,
          skipped,
          failed: allErrors.length
        }
      };
    } catch (error) {
      console.error('Fatal error during sync:', error);
      
      // Update import log with failure
      await this.storage.updateFuelImportLog(importLog.id, {
        status: 'failed',
        recordsProcessed: allTransactions.length,
        recordsFailed: allErrors.length + 1,
        errorLog: [...allErrors, {
          fatal: true,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }],
        completedAt: new Date()
      });

      throw error;
    }
  }

  /**
   * Insert or update transactions, using externalId for deduplication
   */
  private async upsertTransactions(
    transactions: Array<Omit<InsertFuelSale, 'id' | 'createdAt' | 'updatedAt'> & { externalId: string }>,
    orgId: string
  ): Promise<{ imported: number; updated: number; skipped: number }> {
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const transaction of transactions) {
      try {
        // Check if transaction already exists by externalId
        const existing = await db.query.fuelSales.findFirst({
          where: and(
            eq(fuelSales.orgId, orgId),
            eq(fuelSales.externalId, transaction.externalId)
          )
        });

        if (existing) {
          // Update existing transaction
          await db.update(fuelSales)
            .set({
              transactionDate: transaction.transactionDate,
              fuelType: transaction.fuelType,
              quantityGallons: transaction.quantityGallons,
              pricePerGallon: transaction.pricePerGallon,
              totalAmount: transaction.totalAmount,
              customerName: transaction.customerName,
              boatName: transaction.boatName,
              slipNumber: transaction.slipNumber,
              pumpNumber: transaction.pumpNumber,
              paymentMethod: transaction.paymentMethod,
              status: transaction.status,
              notes: transaction.notes,
              processedBy: transaction.processedBy,
              updatedAt: new Date()
            })
            .where(eq(fuelSales.id, existing.id));
          
          updated++;
        } else {
          // Insert new transaction
          const { externalId, ...insertData } = transaction;
          await this.storage.createFuelSale({
            ...insertData,
            externalId
          });
          imported++;
        }
      } catch (error) {
        console.error('Error upserting transaction:', error);
        skipped++;
      }
    }

    return { imported, updated, skipped };
  }

  /**
   * Test connection for an integration
   */
  async testConnection(integrationId: string): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    const integration = await this.storage.getFuelIntegrationById(integrationId);
    
    if (!integration) {
      throw new Error('Integration not found');
    }

    const provider = fuelProviderRegistry.create(integration.provider, {
      apiUrl: integration.apiUrl || '',
      accessToken: integration.accessToken || '',
      refreshToken: integration.refreshToken || undefined,
      tokenExpiresAt: integration.tokenExpiresAt || undefined,
      fieldMapping: integration.fieldMapping as any,
      orgId: integration.orgId
    });

    if (!provider) {
      return {
        success: false,
        message: `Unsupported provider: ${integration.provider}`
      };
    }

    return await provider.testConnection();
  }
}
