/**
 * Integration Data Pipeline Service
 * 
 * This service manages the flow of data from connected integrations (Operations modules)
 * to the Modeling/Valuator module. It ensures that only data from "owned marinas" 
 * (dealSource === 'owned_marina') is synced for live valuation modeling.
 * 
 * Architecture:
 * 1. Operations modules (Dockit, Boat Rentals, Fuel, Ship Store, Service, Bookkeeping)
 *    have integrations that sync external data into canonical tables
 * 2. Data mappings define how external entities map to MarinaMatch entities
 * 3. When a modeling project is linked to an owned marina, the Valuator can
 *    pull live operational data for real-time valuation updates
 * 4. Valuation snapshots can be triggered by operational data changes
 * 
 * Data Flow:
 *   [External System] → [Integration Sync] → [Canonical Tables] → [Modeling/Valuator]
 *                                              ↓
 *                                     [Valuation Snapshots]
 */

import { db } from "../db";
import { eq, and, desc } from "drizzle-orm";
import {
  modelingProjects,
  valuationSnapshots,
  userIntegrations,
  integrations,
} from "@shared/schema";

export interface IntegrationSyncResult {
  integrationKey: string;
  entitiesSynced: number;
  lastSyncAt: Date;
  status: "success" | "partial" | "failed";
  errors?: string[];
}

export interface OperationsDataSummary {
  fuelSales?: {
    monthlyRevenue: number;
    gallonsSold: number;
    lastUpdated: Date | null;
  };
  shipStore?: {
    monthlyRevenue: number;
    transactionCount: number;
    lastUpdated: Date | null;
  };
  boatRentals?: {
    monthlyRevenue: number;
    reservationCount: number;
    utilizationRate: number;
    lastUpdated: Date | null;
  };
  service?: {
    monthlyRevenue: number;
    workOrderCount: number;
    lastUpdated: Date | null;
  };
  slipOccupancy?: {
    totalSlips: number;
    occupiedSlips: number;
    occupancyRate: number;
    monthlyRentRoll: number;
    lastUpdated: Date | null;
  };
  financials?: {
    monthlyRevenue: number;
    monthlyExpenses: number;
    ebitda: number;
    lastSyncAt: Date | null;
    source: string;
  };
}

export interface LiveDataAvailability {
  integrationKey: string;
  integrationName: string;
  isConnected: boolean;
  lastSyncAt: Date | null;
  dataTypes: string[];
  targetModules: string[];
}

export class IntegrationDataPipelineService {
  private orgId: string;
  private userId: string;

  constructor(orgId: string, userId: string) {
    this.orgId = orgId;
    this.userId = userId;
  }

  /**
   * Check if a modeling project is eligible for live data sync
   * Only projects with dealSource = 'owned_marina' can have live data
   */
  async isProjectEligibleForLiveData(projectId: string): Promise<boolean> {
    const [project] = await db
      .select({ dealSource: modelingProjects.dealSource })
      .from(modelingProjects)
      .where(
        and(
          eq(modelingProjects.id, projectId),
          eq(modelingProjects.orgId, this.orgId)
        )
      )
      .limit(1);

    return project?.dealSource === "owned_marina";
  }

  /**
   * Get connected integrations that can provide live data to Modeling
   */
  async getConnectedIntegrationsForModeling(): Promise<LiveDataAvailability[]> {
    const userIntegrationsList = await db
      .select({
        integrationKey: userIntegrations.integrationKey,
        isConnected: userIntegrations.isConnected,
        lastSyncAt: userIntegrations.lastSyncAt,
      })
      .from(userIntegrations)
      .where(
        and(
          eq(userIntegrations.userId, this.userId),
          eq(userIntegrations.orgId, this.orgId),
          eq(userIntegrations.isConnected, true)
        )
      );

    const result: LiveDataAvailability[] = [];

    for (const ui of userIntegrationsList) {
      const [integration] = await db
        .select({
          name: integrations.name,
          dataMappings: integrations.dataMappings,
        })
        .from(integrations)
        .where(eq(integrations.key, ui.integrationKey))
        .limit(1);

      if (integration) {
        const mappings = (integration.dataMappings as any[]) || [];
        const dataTypes = [...new Set(mappings.map((m) => m.sourceEntity))];
        const targetModules = [...new Set(mappings.map((m) => m.targetModule))];

        result.push({
          integrationKey: ui.integrationKey,
          integrationName: integration.name,
          isConnected: true,
          lastSyncAt: ui.lastSyncAt,
          dataTypes,
          targetModules,
        });
      }
    }

    return result;
  }

  /**
   * Get aggregated operations data for a modeling project
   * This would pull from the synced canonical tables
   * 
   * Note: In production, this would query actual synced data tables.
   * This is the architectural contract for how data flows to Valuator.
   */
  async getOperationsDataForProject(
    projectId: string
  ): Promise<OperationsDataSummary | null> {
    const isEligible = await this.isProjectEligibleForLiveData(projectId);
    
    if (!isEligible) {
      return null; // Only owned marinas get live data
    }

    const connectedIntegrations = await this.getConnectedIntegrationsForModeling();
    
    // Build summary based on which integrations are connected
    // In production, this would query actual synced data tables
    const summary: OperationsDataSummary = {};

    for (const integration of connectedIntegrations) {
      if (integration.targetModules.includes("fuelSales")) {
        summary.fuelSales = {
          monthlyRevenue: 0,
          gallonsSold: 0,
          lastUpdated: integration.lastSyncAt,
        };
      }
      if (integration.targetModules.includes("shipStore")) {
        summary.shipStore = {
          monthlyRevenue: 0,
          transactionCount: 0,
          lastUpdated: integration.lastSyncAt,
        };
      }
      if (integration.targetModules.includes("boatRentals")) {
        summary.boatRentals = {
          monthlyRevenue: 0,
          reservationCount: 0,
          utilizationRate: 0,
          lastUpdated: integration.lastSyncAt,
        };
      }
      if (integration.targetModules.includes("financials")) {
        summary.financials = {
          monthlyRevenue: 0,
          monthlyExpenses: 0,
          ebitda: 0,
          lastSyncAt: integration.lastSyncAt,
          source: integration.integrationName,
        };
      }
    }

    return summary;
  }

  /**
   * Check if a data change should trigger a valuation snapshot
   * This can be called after integration syncs to optionally
   * create a point-in-time valuation record
   */
  async shouldTriggerValuationSnapshot(
    projectId: string,
    changeType: string
  ): Promise<boolean> {
    const isEligible = await this.isProjectEligibleForLiveData(projectId);
    if (!isEligible) return false;

    // Check when the last snapshot was taken
    const [lastSnapshot] = await db
      .select({ createdAt: valuationSnapshots.createdAt })
      .from(valuationSnapshots)
      .where(eq(valuationSnapshots.modelingProjectId, projectId))
      .orderBy(desc(valuationSnapshots.createdAt))
      .limit(1);

    if (!lastSnapshot) return true; // No snapshots yet, create one

    // If the last snapshot was more than 24 hours ago, trigger a new one
    const hoursSinceLastSnapshot =
      (Date.now() - lastSnapshot.createdAt.getTime()) / (1000 * 60 * 60);

    return hoursSinceLastSnapshot > 24;
  }

  /**
   * Get the data sync status for display in the Bookkeeping dashboard
   */
  async getBookkeepingSyncStatus(): Promise<{
    pnlConnected: boolean;
    chartOfAccountsConnected: boolean;
    arConnected: boolean;
    bankTransactionsConnected: boolean;
    lastSyncAt: Date | null;
    syncSource: string | null;
  }> {
    const qbIntegration = await db
      .select({
        isConnected: userIntegrations.isConnected,
        lastSyncAt: userIntegrations.lastSyncAt,
      })
      .from(userIntegrations)
      .where(
        and(
          eq(userIntegrations.userId, this.userId),
          eq(userIntegrations.orgId, this.orgId),
          eq(userIntegrations.integrationKey, "quickbooks")
        )
      )
      .limit(1);

    const isConnected = qbIntegration[0]?.isConnected || false;

    return {
      pnlConnected: isConnected,
      chartOfAccountsConnected: isConnected,
      arConnected: isConnected,
      bankTransactionsConnected: isConnected,
      lastSyncAt: qbIntegration[0]?.lastSyncAt || null,
      syncSource: isConnected ? "QuickBooks Online" : null,
    };
  }
}

/**
 * Data Mapping Contract
 * 
 * Each integration defines dataMappings that specify:
 * - sourceEntity: The entity type from the external system
 * - targetModule: Which MarinaMatch module receives the data
 * - targetEntity: The specific entity/table within that module
 * - fields: Field-level mapping with optional transforms
 * - syncDirection: read, write, or bidirectional
 * - frequency: realtime, hourly, daily, weekly, manual
 * 
 * Example flow for QuickBooks → Valuator:
 * 1. QuickBooks integration syncs P&L data to financials.pnl
 * 2. When a modeling project with dealSource='owned_marina' is loaded
 * 3. The Valuator queries the canonical pnl table for live financial data
 * 4. Changes in operational data can trigger valuation snapshots
 */

export const DATA_FLOW_CONTRACTS = {
  fuelSales: {
    canonicalTable: "fuel_transactions",
    modelingFields: ["monthlyRevenue", "gallonsSold", "costOfGoodsSold"],
  },
  shipStore: {
    canonicalTable: "ship_store_transactions",
    modelingFields: ["monthlyRevenue", "grossMargin"],
  },
  boatRentals: {
    canonicalTable: "boat_rentals",
    modelingFields: ["monthlyRevenue", "utilizationRate"],
  },
  service: {
    canonicalTable: "service_work_orders",
    modelingFields: ["laborRevenue", "partsRevenue"],
  },
  rentRoll: {
    canonicalTable: "rent_roll_leases",
    modelingFields: ["monthlyRentRoll", "occupancyRate", "averageSlipRate"],
  },
  financials: {
    canonicalTable: "quickbooks_synced_data",
    modelingFields: ["revenue", "expenses", "ebitda", "netIncome"],
  },
};
