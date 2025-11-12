import { db } from '../db';
import {
  ownedAssets,
  assetPerformanceSnapshots,
  crmProperties,
  projects,
  users,
  fuelSales,
  rentRolls,
  rentRollEntries,
  marketingCampaigns,
  marketingExpenses,
} from '@shared/schema';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import type {
  OwnedAsset,
  InsertOwnedAsset,
  UpdateOwnedAsset,
  AssetPerformanceSnapshot,
  InsertAssetPerformanceSnapshot,
} from '@shared/schema';

export class OwnedAssetsService {
  // ================================================================================
  // OWNED ASSETS
  // ================================================================================

  /**
   * Get all owned assets for an organization
   */
  async getOwnedAssets(
    orgId: string,
    filters?: {
      status?: string;
      holdStrategy?: string;
      propertyId?: string;
    }
  ): Promise<OwnedAsset[]> {
    let conditions = eq(ownedAssets.orgId, orgId);

    if (filters?.status) {
      conditions = and(conditions, eq(ownedAssets.status, filters.status as any));
    }
    if (filters?.holdStrategy) {
      conditions = and(conditions, eq(ownedAssets.holdStrategy, filters.holdStrategy as any));
    }
    if (filters?.propertyId) {
      conditions = and(conditions, eq(ownedAssets.propertyId, filters.propertyId));
    }

    const assets = await db
      .select()
      .from(ownedAssets)
      .where(conditions)
      .orderBy(desc(ownedAssets.acquisitionDate));

    return assets;
  }

  /**
   * Get owned asset by ID
   */
  async getOwnedAssetById(id: string, orgId: string): Promise<OwnedAsset | null> {
    const [asset] = await db
      .select()
      .from(ownedAssets)
      .where(and(eq(ownedAssets.id, id), eq(ownedAssets.orgId, orgId)))
      .limit(1);

    return asset || null;
  }

  /**
   * Get owned asset with property and project details
   */
  async getOwnedAssetWithDetails(id: string, orgId: string) {
    const [result] = await db
      .select({
        asset: ownedAssets,
        property: crmProperties,
        project: projects,
        createdBy: users,
      })
      .from(ownedAssets)
      .leftJoin(crmProperties, eq(ownedAssets.propertyId, crmProperties.id))
      .leftJoin(projects, eq(ownedAssets.projectId, projects.id))
      .leftJoin(users, eq(ownedAssets.createdBy, users.id))
      .where(and(eq(ownedAssets.id, id), eq(ownedAssets.orgId, orgId)))
      .limit(1);

    return result || null;
  }

  /**
   * Create a new owned asset
   */
  async createOwnedAsset(orgId: string, createdBy: string, data: InsertOwnedAsset): Promise<OwnedAsset> {
    const [asset] = await db
      .insert(ownedAssets)
      .values({
        ...data,
        orgId,
        createdBy,
      })
      .returning();

    return asset;
  }

  /**
   * Update owned asset
   */
  async updateOwnedAsset(
    id: string,
    orgId: string,
    data: UpdateOwnedAsset
  ): Promise<OwnedAsset | null> {
    const [asset] = await db
      .update(ownedAssets)
      .set({
        ...data,
        orgId,
        updatedAt: new Date(),
      })
      .where(and(eq(ownedAssets.id, id), eq(ownedAssets.orgId, orgId)))
      .returning();

    return asset || null;
  }

  /**
   * Update asset status
   */
  async updateAssetStatus(
    id: string,
    orgId: string,
    status: string
  ): Promise<OwnedAsset | null> {
    return this.updateOwnedAsset(id, orgId, { status: status as any });
  }

  /**
   * Delete owned asset
   */
  async deleteOwnedAsset(id: string, orgId: string): Promise<boolean> {
    const result = await db
      .delete(ownedAssets)
      .where(and(eq(ownedAssets.id, id), eq(ownedAssets.orgId, orgId)));

    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ================================================================================
  // ASSET PERFORMANCE SNAPSHOTS
  // ================================================================================

  /**
   * Get performance snapshots for an asset
   */
  async getAssetPerformanceSnapshots(
    ownedAssetId: string,
    filters?: {
      startDate?: string;
      endDate?: string;
      limit?: number;
    }
  ): Promise<AssetPerformanceSnapshot[]> {
    let conditions = eq(assetPerformanceSnapshots.ownedAssetId, ownedAssetId);

    if (filters?.startDate) {
      conditions = and(conditions, gte(assetPerformanceSnapshots.snapshotDate, filters.startDate));
    }
    if (filters?.endDate) {
      conditions = and(conditions, lte(assetPerformanceSnapshots.snapshotDate, filters.endDate));
    }

    let query = db
      .select()
      .from(assetPerformanceSnapshots)
      .where(conditions)
      .orderBy(desc(assetPerformanceSnapshots.snapshotDate));

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const snapshots = await query;
    return snapshots;
  }

  /**
   * Create performance snapshot
   */
  async createPerformanceSnapshot(
    ownedAssetId: string,
    data: InsertAssetPerformanceSnapshot
  ): Promise<AssetPerformanceSnapshot> {
    const [snapshot] = await db
      .insert(assetPerformanceSnapshots)
      .values({
        ownedAssetId,
        ...data,
      })
      .returning();

    return snapshot;
  }

  /**
   * Get or create performance snapshot for a date
   */
  async getOrCreateSnapshot(
    ownedAssetId: string,
    snapshotDate: string
  ): Promise<AssetPerformanceSnapshot> {
    // Check if snapshot exists
    const [existing] = await db
      .select()
      .from(assetPerformanceSnapshots)
      .where(and(
        eq(assetPerformanceSnapshots.ownedAssetId, ownedAssetId),
        eq(assetPerformanceSnapshots.snapshotDate, snapshotDate)
      ))
      .limit(1);

    if (existing) {
      return existing;
    }

    // Create new snapshot
    return this.createPerformanceSnapshot(ownedAssetId, {
      snapshotDate,
      metrics: {},
    });
  }

  /**
   * Update performance snapshot metrics
   */
  async updateSnapshotMetrics(
    ownedAssetId: string,
    snapshotDate: string,
    metrics: any
  ): Promise<AssetPerformanceSnapshot> {
    const [updated] = await db
      .update(assetPerformanceSnapshots)
      .set({ metrics })
      .where(and(
        eq(assetPerformanceSnapshots.ownedAssetId, ownedAssetId),
        eq(assetPerformanceSnapshots.snapshotDate, snapshotDate)
      ))
      .returning();

    if (!updated) {
      // Create if doesn't exist
      return this.createPerformanceSnapshot(ownedAssetId, {
        snapshotDate,
        metrics,
      });
    }

    return updated;
  }

  // ================================================================================
  // PERFORMANCE AGGREGATION & ANALYTICS
  // ================================================================================

  /**
   * Calculate current asset performance metrics by aggregating operational data
   */
  async getAssetPerformance(id: string, orgId: string): Promise<any> {
    const asset = await this.getOwnedAssetWithDetails(id, orgId);
    
    if (!asset) {
      return null;
    }

    const propertyId = asset.asset.propertyId;
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];

    // Aggregate fuel sales metrics
    const fuelMetrics = await this.getFuelMetrics(propertyId, startOfMonth, endOfMonth);

    // Aggregate rent roll metrics
    const rentRollMetrics = await this.getRentRollMetrics(orgId, propertyId);

    // Aggregate marketing metrics
    const marketingMetrics = await this.getMarketingMetrics(orgId, startOfMonth, endOfMonth);

    // Calculate ROI and other financial metrics
    const financialMetrics = this.calculateFinancialMetrics(asset.asset, {
      fuelRevenue: fuelMetrics.totalRevenue,
      rentRollRevenue: rentRollMetrics.monthlyRevenue,
    });

    return {
      asset: asset.asset,
      property: asset.property,
      project: asset.project,
      metrics: {
        fuel: fuelMetrics,
        rentRoll: rentRollMetrics,
        marketing: marketingMetrics,
        financial: financialMetrics,
      },
      lastUpdated: new Date(),
    };
  }

  /**
   * Get fuel sales metrics for a property
   */
  private async getFuelMetrics(propertyId: string, startDate: string, endDate: string): Promise<any> {
    const result = await db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(${fuelSales.totalPrice}), 0)`,
        totalVolume: sql<number>`COALESCE(SUM(${fuelSales.gallons}), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(fuelSales)
      .where(and(
        eq(fuelSales.facilityId, propertyId),
        gte(fuelSales.saleDate, startDate),
        lte(fuelSales.saleDate, endDate)
      ));

    const metrics = result[0] || { totalRevenue: 0, totalVolume: 0, transactionCount: 0 };

    return {
      totalRevenue: Number(metrics.totalRevenue) || 0,
      totalVolume: Number(metrics.totalVolume) || 0,
      transactionCount: Number(metrics.transactionCount) || 0,
      avgRevenuePerTransaction: metrics.transactionCount > 0 
        ? Number(metrics.totalRevenue) / Number(metrics.transactionCount) 
        : 0,
    };
  }

  /**
   * Get rent roll metrics for a property
   */
  private async getRentRollMetrics(orgId: string, propertyId: string): Promise<any> {
    // Find rent rolls associated with this property (via facilityId or other linkage)
    // Note: This assumes rent rolls have a facilityId field linking to properties
    const rentRollsList = await db
      .select()
      .from(rentRolls)
      .where(and(
        eq(rentRolls.orgId, orgId),
        eq(rentRolls.facilityId, propertyId)
      ));

    if (rentRollsList.length === 0) {
      return {
        totalUnits: 0,
        occupiedUnits: 0,
        occupancyRate: 0,
        monthlyRevenue: 0,
        avgRatePerUnit: 0,
      };
    }

    // Aggregate entries across all rent rolls for this property
    const rentRollIds = rentRollsList.map(rr => rr.id);
    
    const result = await db
      .select({
        totalUnits: sql<number>`COUNT(*)`,
        occupiedUnits: sql<number>`COUNT(CASE WHEN ${rentRollEntries.status} = 'occupied' THEN 1 END)`,
        totalRevenue: sql<number>`COALESCE(SUM(${rentRollEntries.monthlyRate}), 0)`,
      })
      .from(rentRollEntries)
      .where(sql`${rentRollEntries.rentRollId} = ANY(${rentRollIds})`);

    const metrics = result[0] || { totalUnits: 0, occupiedUnits: 0, totalRevenue: 0 };
    const totalUnits = Number(metrics.totalUnits) || 0;
    const occupiedUnits = Number(metrics.occupiedUnits) || 0;
    const monthlyRevenue = Number(metrics.totalRevenue) || 0;

    return {
      totalUnits,
      occupiedUnits,
      occupancyRate: totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0,
      monthlyRevenue,
      avgRatePerUnit: totalUnits > 0 ? monthlyRevenue / totalUnits : 0,
    };
  }

  /**
   * Get marketing metrics for an organization
   */
  private async getMarketingMetrics(orgId: string, startDate: string, endDate: string): Promise<any> {
    const result = await db
      .select({
        totalSpend: sql<number>`COALESCE(SUM(${marketingExpenses.amount}), 0)`,
        activeCampaigns: sql<number>`COUNT(DISTINCT ${marketingCampaigns.id})`,
      })
      .from(marketingExpenses)
      .leftJoin(marketingCampaigns, eq(marketingExpenses.campaignId, marketingCampaigns.id))
      .where(and(
        eq(marketingExpenses.orgId, orgId),
        gte(marketingExpenses.expenseDate, startDate),
        lte(marketingExpenses.expenseDate, endDate)
      ));

    const metrics = result[0] || { totalSpend: 0, activeCampaigns: 0 };

    return {
      totalSpend: Number(metrics.totalSpend) || 0,
      activeCampaigns: Number(metrics.activeCampaigns) || 0,
    };
  }

  /**
   * Calculate financial metrics (ROI, Cash-on-Cash, etc.)
   */
  private calculateFinancialMetrics(asset: OwnedAsset, operationalData: any): any {
    const acquisitionPrice = asset.acquisitionPrice || 0;
    const monthlyRevenue = (operationalData.fuelRevenue || 0) + (operationalData.rentRollRevenue || 0);
    const annualRevenue = monthlyRevenue * 12;

    // Simple NOI calculation (revenue - assumed 35% operating expenses)
    const noi = annualRevenue * 0.65;

    // Cash-on-Cash Return (annual NOI / total investment)
    const cashOnCash = acquisitionPrice > 0 ? (noi / acquisitionPrice) * 100 : 0;

    // Cap Rate
    const capRate = acquisitionPrice > 0 ? (noi / acquisitionPrice) * 100 : 0;

    return {
      acquisitionPrice,
      monthlyRevenue,
      annualRevenue,
      estimatedNOI: noi,
      cashOnCashReturn: cashOnCash,
      capRate,
    };
  }

  // ================================================================================
  // HELPER METHODS
  // ================================================================================

  /**
   * Get portfolio summary for an organization
   */
  async getPortfolioSummary(orgId: string): Promise<any> {
    const assets = await this.getOwnedAssets(orgId);

    const summary = {
      totalAssets: assets.length,
      byStatus: {} as Record<string, number>,
      byHoldStrategy: {} as Record<string, number>,
      totalAcquisitionValue: 0,
    };

    assets.forEach(asset => {
      // Count by status
      summary.byStatus[asset.status] = (summary.byStatus[asset.status] || 0) + 1;

      // Count by hold strategy
      if (asset.holdStrategy) {
        summary.byHoldStrategy[asset.holdStrategy] = (summary.byHoldStrategy[asset.holdStrategy] || 0) + 1;
      }

      // Sum acquisition prices
      summary.totalAcquisitionValue += asset.acquisitionPrice || 0;
    });

    return summary;
  }

  /**
   * Convert CRM deal to owned asset
   */
  async convertDealToOwnedAsset(
    orgId: string,
    userId: string,
    dealData: {
      propertyId: string;
      projectId?: string;
      acquisitionPrice?: number;
      acquisitionDate: string;
      holdStrategy?: string;
    }
  ): Promise<OwnedAsset> {
    return this.createOwnedAsset(orgId, userId, {
      propertyId: dealData.propertyId,
      projectId: dealData.projectId || null,
      acquisitionDate: dealData.acquisitionDate,
      acquisitionPrice: dealData.acquisitionPrice || null,
      status: 'under_management',
      holdStrategy: (dealData.holdStrategy as any) || null,
      keyMetrics: {},
    });
  }
}

export const ownedAssetsService = new OwnedAssetsService();
