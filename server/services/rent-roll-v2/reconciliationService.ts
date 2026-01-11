import { db } from "../../db";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  glAccounts,
  glMappings,
  reconciliationRecords,
  reconciliationLineItems,
  leases,
  marinaLocations,
  leaseCashFlows,
  periods,
  InsertGlAccount,
  InsertGlMapping,
  InsertReconciliationRecord,
  GlAccount,
  GlMapping,
  ReconciliationRecord,
  ReconciliationLineItem,
} from "@shared/schema";
import { startOfMonth, endOfMonth, format } from "date-fns";

export interface ReconciliationSummary {
  id: string;
  projectId: string | null;
  projectName: string | null;
  periodYear: number;
  periodMonth: number;
  status: string;
  rentRollTotal: number;
  glTotal: number | null;
  varianceAmount: number | null;
  variancePercent: number | null;
  reconciledBy: string | null;
  reconciledAt: Date | null;
}

export interface ReconciliationBreakdown {
  glAccountId: string;
  glAccountCode: string;
  glAccountName: string;
  category: string;
  rentRollAmount: number;
  glAmount: number | null;
  varianceAmount: number;
  lineItems: ReconciliationLineItem[];
}

export class ReconciliationService {
  async createGlAccount(data: InsertGlAccount): Promise<GlAccount> {
    const [account] = await db.insert(glAccounts).values(data).returning();
    return account;
  }

  async getGlAccounts(organizationId: string): Promise<GlAccount[]> {
    return db
      .select()
      .from(glAccounts)
      .where(
        and(
          eq(glAccounts.organizationId, organizationId),
          eq(glAccounts.isActive, true)
        )
      )
      .orderBy(glAccounts.accountCode);
  }

  async getGlAccountById(id: string, organizationId: string): Promise<GlAccount | null> {
    const [account] = await db
      .select()
      .from(glAccounts)
      .where(
        and(
          eq(glAccounts.id, id),
          eq(glAccounts.organizationId, organizationId)
        )
      );
    return account || null;
  }

  async updateGlAccount(id: string, organizationId: string, data: Partial<InsertGlAccount>): Promise<GlAccount | null> {
    const [account] = await db
      .update(glAccounts)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(glAccounts.id, id),
          eq(glAccounts.organizationId, organizationId)
        )
      )
      .returning();
    return account || null;
  }

  async deleteGlAccount(id: string, organizationId: string): Promise<boolean> {
    const result = await db
      .delete(glAccounts)
      .where(
        and(
          eq(glAccounts.id, id),
          eq(glAccounts.organizationId, organizationId)
        )
      );
    return true;
  }

  async createGlMapping(data: InsertGlMapping): Promise<GlMapping> {
    const [mapping] = await db.insert(glMappings).values(data).returning();
    return mapping;
  }

  async getGlMappings(organizationId: string): Promise<GlMapping[]> {
    return db
      .select()
      .from(glMappings)
      .where(
        and(
          eq(glMappings.organizationId, organizationId),
          eq(glMappings.isActive, true)
        )
      )
      .orderBy(desc(glMappings.priority));
  }

  async updateGlMapping(id: string, organizationId: string, data: Partial<InsertGlMapping>): Promise<GlMapping | null> {
    const [mapping] = await db
      .update(glMappings)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(glMappings.id, id),
          eq(glMappings.organizationId, organizationId)
        )
      )
      .returning();
    return mapping || null;
  }

  async deleteGlMapping(id: string, organizationId: string): Promise<boolean> {
    await db
      .delete(glMappings)
      .where(
        and(
          eq(glMappings.id, id),
          eq(glMappings.organizationId, organizationId)
        )
      );
    return true;
  }

  async getReconciliationRecords(organizationId: string, projectId?: string): Promise<ReconciliationSummary[]> {
    let query = db
      .select({
        id: reconciliationRecords.id,
        projectId: reconciliationRecords.projectId,
        projectName: marinaLocations.name,
        periodYear: reconciliationRecords.periodYear,
        periodMonth: reconciliationRecords.periodMonth,
        status: reconciliationRecords.status,
        rentRollTotal: reconciliationRecords.rentRollTotal,
        glTotal: reconciliationRecords.glTotal,
        varianceAmount: reconciliationRecords.varianceAmount,
        variancePercent: reconciliationRecords.variancePercent,
        reconciledBy: reconciliationRecords.reconciledBy,
        reconciledAt: reconciliationRecords.reconciledAt,
      })
      .from(reconciliationRecords)
      .leftJoin(marinaLocations, eq(reconciliationRecords.projectId, marinaLocations.id))
      .where(eq(reconciliationRecords.organizationId, organizationId))
      .orderBy(desc(reconciliationRecords.periodYear), desc(reconciliationRecords.periodMonth));

    const results = await query;
    return results.map(r => ({
      ...r,
      rentRollTotal: Number(r.rentRollTotal) || 0,
      glTotal: r.glTotal ? Number(r.glTotal) : null,
      varianceAmount: r.varianceAmount ? Number(r.varianceAmount) : null,
      variancePercent: r.variancePercent ? Number(r.variancePercent) : null,
    }));
  }

  async getOrCreateReconciliationRecord(
    organizationId: string,
    projectId: string | null,
    year: number,
    month: number
  ): Promise<ReconciliationRecord> {
    const [existing] = await db
      .select()
      .from(reconciliationRecords)
      .where(
        and(
          eq(reconciliationRecords.organizationId, organizationId),
          projectId 
            ? eq(reconciliationRecords.projectId, projectId)
            : sql`${reconciliationRecords.projectId} IS NULL`,
          eq(reconciliationRecords.periodYear, year),
          eq(reconciliationRecords.periodMonth, month)
        )
      );

    if (existing) {
      return existing;
    }

    const [record] = await db
      .insert(reconciliationRecords)
      .values({
        organizationId,
        projectId,
        periodYear: year,
        periodMonth: month,
        status: "pending",
      })
      .returning();

    return record;
  }

  async calculateRentRollTotal(
    organizationId: string,
    projectId: string | null,
    year: number,
    month: number
  ): Promise<{ total: number; breakdown: Map<string, number> }> {
    const cashFlowsQuery = db
      .select({
        leaseId: leaseCashFlows.leaseId,
        rentAmount: leaseCashFlows.rentAmount,
        isActiveInPeriod: leaseCashFlows.isActiveInPeriod,
        storageType: leases.storageType,
      })
      .from(leaseCashFlows)
      .innerJoin(periods, eq(leaseCashFlows.periodId, periods.id))
      .innerJoin(leases, eq(leaseCashFlows.leaseId, leases.id))
      .innerJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
      .where(
        and(
          eq(marinaLocations.organizationId, organizationId),
          projectId ? eq(leases.locationId, projectId) : sql`1=1`,
          eq(periods.year, year),
          eq(periods.month, month),
          eq(leaseCashFlows.isActiveInPeriod, true)
        )
      );

    const cashFlows = await cashFlowsQuery;

    let total = 0;
    const breakdown = new Map<string, number>();

    for (const cf of cashFlows) {
      const amount = Number(cf.rentAmount) || 0;
      total += amount;

      const storageType = cf.storageType || "Wet Slip";
      breakdown.set(storageType, (breakdown.get(storageType) || 0) + amount);
    }

    return { total, breakdown };
  }

  async runReconciliation(
    organizationId: string,
    recordId: string,
    glTotals: Map<string, number>
  ): Promise<ReconciliationRecord> {
    const [record] = await db
      .select()
      .from(reconciliationRecords)
      .where(
        and(
          eq(reconciliationRecords.id, recordId),
          eq(reconciliationRecords.organizationId, organizationId)
        )
      );

    if (!record) {
      throw new Error("Reconciliation record not found");
    }

    const rentRollData = await this.calculateRentRollTotal(
      organizationId,
      record.projectId,
      record.periodYear,
      record.periodMonth
    );

    let glTotal = 0;
    glTotals.forEach((amount) => {
      glTotal += amount;
    });

    const varianceAmount = rentRollData.total - glTotal;
    const variancePercent = glTotal !== 0 ? (varianceAmount / glTotal) * 100 : 0;

    const status = Math.abs(varianceAmount) < 0.01 ? "reconciled" : "variance_identified";

    const [updated] = await db
      .update(reconciliationRecords)
      .set({
        rentRollTotal: rentRollData.total.toFixed(2),
        glTotal: glTotal.toFixed(2),
        varianceAmount: varianceAmount.toFixed(2),
        variancePercent: variancePercent.toFixed(2),
        status,
        updatedAt: new Date(),
      })
      .returning();

    return updated;
  }

  async updateReconciliationStatus(
    organizationId: string,
    recordId: string,
    status: "pending" | "in_progress" | "reconciled" | "variance_identified" | "closed",
    userId?: string
  ): Promise<ReconciliationRecord | null> {
    const updates: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === "reconciled" || status === "closed") {
      updates.reconciledBy = userId || null;
      updates.reconciledAt = new Date();
    }

    const [updated] = await db
      .update(reconciliationRecords)
      .set(updates)
      .where(
        and(
          eq(reconciliationRecords.id, recordId),
          eq(reconciliationRecords.organizationId, organizationId)
        )
      )
      .returning();

    return updated || null;
  }

  async getReconciliationBreakdown(
    organizationId: string,
    recordId: string
  ): Promise<ReconciliationBreakdown[]> {
    const [record] = await db
      .select()
      .from(reconciliationRecords)
      .where(
        and(
          eq(reconciliationRecords.id, recordId),
          eq(reconciliationRecords.organizationId, organizationId)
        )
      );

    if (!record) {
      return [];
    }

    const lineItems = await db
      .select({
        lineItem: reconciliationLineItems,
        glAccount: glAccounts,
      })
      .from(reconciliationLineItems)
      .leftJoin(glAccounts, eq(reconciliationLineItems.glAccountId, glAccounts.id))
      .where(eq(reconciliationLineItems.reconciliationRecordId, recordId));

    const breakdownMap = new Map<string, ReconciliationBreakdown>();

    for (const { lineItem, glAccount } of lineItems) {
      const accountId = lineItem.glAccountId || "unmapped";
      
      if (!breakdownMap.has(accountId)) {
        breakdownMap.set(accountId, {
          glAccountId: accountId,
          glAccountCode: glAccount?.accountCode || "N/A",
          glAccountName: glAccount?.accountName || "Unmapped",
          category: glAccount?.category || "revenue",
          rentRollAmount: 0,
          glAmount: null,
          varianceAmount: 0,
          lineItems: [],
        });
      }

      const breakdown = breakdownMap.get(accountId)!;
      breakdown.rentRollAmount += Number(lineItem.rentRollAmount) || 0;
      breakdown.varianceAmount += Number(lineItem.varianceAmount) || 0;
      breakdown.lineItems.push(lineItem);
    }

    return Array.from(breakdownMap.values());
  }
}

export const reconciliationService = new ReconciliationService();
