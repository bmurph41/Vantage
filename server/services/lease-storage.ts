/**
 * Commercial Lease Storage Service
 * =================================
 * Wraps Drizzle queries for CRUD and cashflow recomputation.
 * 
 * INTEGRATION NOTE: Import `db` from your existing Drizzle instance.
 * Replace `import { db } from "../../db"` with your actual path.
 */

import { eq, and, gte, lte, desc, asc, sql, inArray } from "drizzle-orm";
// ADJUST THIS IMPORT to match your project's DB instance path:
// import { db } from "../../db";
import {
  commercialLeases,
  leaseTerms,
  leaseChargeLines,
  leaseAbatements,
  leaseSales,
  leasePercentRentRules,
  leaseTiPrograms,
  leaseTiDraws,
  leaseRecoveryModels,
  leaseRecoveryCategories,
  leaseMonthlyCashflows,
} from "@shared/commercial-lease-schema";
import {
  computeLeaseMonthlyCashflows,
  type LeaseComputeInput,
} from "./lease-engine";
import type {
  CommercialLease,
  LeaseTerm,
  LeaseChargeLine,
  LeaseAbatement,
  LeaseSale,
  LeasePercentRentRule,
  LeaseTiProgram,
  LeaseTiDraw,
  LeaseRecoveryModel,
  LeaseRecoveryCategoryRow,
  LeaseDetail,
  LeaseRollupMonth,
  ProjectLeaseRollup,
} from "@shared/commercial-lease-types";

// ─── TYPE for db parameter (adjust to your Drizzle instance type) ─────────

type DB = any; // Replace with: typeof db

// ─── LEASE CRUD ──────────────────────────────────────────────────────────────

export interface LeaseListResult {
  data: any[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export async function listLeases(
  db: DB,
  projectId: string,
  opts: { limit?: number; offset?: number; search?: string; leaseType?: string; active?: boolean; sortBy?: string; sortDir?: 'asc' | 'desc' } = {}
): Promise<LeaseListResult> {
  const { limit = 50, offset = 0, search, leaseType, active, sortBy = 'tenantName', sortDir = 'asc' } = opts;

  // Build filter conditions — all pushed to SQL, never post-filter
  const conditions: any[] = [eq(commercialLeases.projectId, projectId)];
  if (active !== undefined) conditions.push(eq(commercialLeases.active, active));
  if (leaseType) conditions.push(eq(commercialLeases.leaseType, leaseType as any));
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      sql`(${commercialLeases.tenantName} ILIKE ${pattern} OR ${commercialLeases.suite} ILIKE ${pattern})`
    );
  }

  const whereClause = and(...conditions);

  // Total count (for pagination metadata)
  const [{ count: totalCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(commercialLeases)
    .where(whereClause);

  // Determine sort column
  const sortColumn = sortBy === 'sf' ? commercialLeases.sf
    : sortBy === 'commencementDate' ? commercialLeases.commencementDate
    : sortBy === 'expirationDate' ? commercialLeases.expirationDate
    : sortBy === 'leaseType' ? commercialLeases.leaseType
    : commercialLeases.tenantName;
  const orderFn = sortDir === 'desc' ? desc : asc;

  // Paginated data query
  const data = await db
    .select()
    .from(commercialLeases)
    .where(whereClause)
    .orderBy(orderFn(sortColumn))
    .limit(limit)
    .offset(offset);

  return {
    data,
    total: totalCount,
    limit,
    offset,
    hasMore: offset + data.length < totalCount,
  };
}

export async function getLeaseById(db: DB, leaseId: string) {
  const rows = await db
    .select()
    .from(commercialLeases)
    .where(eq(commercialLeases.id, leaseId))
    .limit(1);
  return rows[0] || null;
}

export async function getLeaseDetail(db: DB, leaseId: string): Promise<LeaseDetail | null> {
  const lease = await getLeaseById(db, leaseId);
  if (!lease) return null;

  const [terms, charges, abats, salesRows, pctRules, tiProgs, recModels] =
    await Promise.all([
      db.select().from(leaseTerms).where(eq(leaseTerms.leaseId, leaseId)).orderBy(asc(leaseTerms.termIndex)),
      db.select().from(leaseChargeLines).where(eq(leaseChargeLines.leaseId, leaseId)),
      db.select().from(leaseAbatements).where(eq(leaseAbatements.leaseId, leaseId)),
      db.select().from(leaseSales).where(eq(leaseSales.leaseId, leaseId)).orderBy(asc(leaseSales.monthEnd)),
      db.select().from(leasePercentRentRules).where(eq(leasePercentRentRules.leaseId, leaseId)),
      db.select().from(leaseTiPrograms).where(eq(leaseTiPrograms.leaseId, leaseId)),
      db.select().from(leaseRecoveryModels).where(eq(leaseRecoveryModels.leaseId, leaseId)),
    ]);

  // Load TI draws for each program
  const tiProgWithDraws = await Promise.all(
    tiProgs.map(async (prog: any) => {
      const draws = await db
        .select()
        .from(leaseTiDraws)
        .where(eq(leaseTiDraws.tiProgramId, prog.id));
      return { ...prog, draws };
    })
  );

  // Load recovery categories for each model
  const recModelsWithCats = await Promise.all(
    recModels.map(async (model: any) => {
      const cats = await db
        .select()
        .from(leaseRecoveryCategories)
        .where(eq(leaseRecoveryCategories.recoveryModelId, model.id));
      return { ...model, categories: cats };
    })
  );

  return {
    ...lease,
    terms,
    chargeLines: charges,
    abatements: abats,
    sales: salesRows,
    percentRentRules: pctRules,
    tiPrograms: tiProgWithDraws,
    recoveryModels: recModelsWithCats,
  };
}

export async function createLease(db: DB, data: Partial<CommercialLease>) {
  const rows = await db.insert(commercialLeases).values(data).returning();
  return rows[0];
}

export async function updateLease(
  db: DB,
  leaseId: string,
  data: Partial<CommercialLease>
) {
  const rows = await db
    .update(commercialLeases)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(commercialLeases.id, leaseId))
    .returning();
  return rows[0];
}

export async function deleteLease(db: DB, leaseId: string) {
  // Soft delete: set active = false
  return updateLease(db, leaseId, { active: false } as any);
}

export async function restoreLeases(db: DB, ids: string[]) {
  if (!ids.length) return [];
  const rows = await db
    .update(commercialLeases)
    .set({ active: true, updatedAt: new Date() } as any)
    .where(inArray(commercialLeases.id, ids))
    .returning();
  return rows;
}

// ─── TERMS CRUD ──────────────────────────────────────────────────────────────

export async function upsertTerm(db: DB, data: Partial<LeaseTerm> & { leaseId: string }) {
  if (data.id) {
    const rows = await db
      .update(leaseTerms)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(leaseTerms.id, data.id))
      .returning();
    return rows[0];
  }
  const rows = await db.insert(leaseTerms).values(data).returning();
  return rows[0];
}

export async function deleteTerm(db: DB, termId: string) {
  await db.delete(leaseTerms).where(eq(leaseTerms.id, termId));
}

// ─── CHARGE LINES CRUD ──────────────────────────────────────────────────────

export async function upsertChargeLine(
  db: DB,
  data: Partial<LeaseChargeLine> & { leaseId: string }
) {
  if (data.id) {
    const rows = await db
      .update(leaseChargeLines)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(leaseChargeLines.id, data.id))
      .returning();
    return rows[0];
  }
  const rows = await db.insert(leaseChargeLines).values(data).returning();
  return rows[0];
}

export async function deleteChargeLine(db: DB, id: string) {
  await db.delete(leaseChargeLines).where(eq(leaseChargeLines.id, id));
}

// ─── ABATEMENTS CRUD ─────────────────────────────────────────────────────────

export async function upsertAbatement(
  db: DB,
  data: Partial<LeaseAbatement> & { leaseId: string }
) {
  if (data.id) {
    const rows = await db
      .update(leaseAbatements)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(leaseAbatements.id, data.id))
      .returning();
    return rows[0];
  }
  const rows = await db.insert(leaseAbatements).values(data).returning();
  return rows[0];
}

export async function deleteAbatement(db: DB, id: string) {
  await db.delete(leaseAbatements).where(eq(leaseAbatements.id, id));
}

// ─── SALES CRUD ──────────────────────────────────────────────────────────────

export async function upsertSale(
  db: DB,
  data: Partial<LeaseSale> & { leaseId: string }
) {
  if (data.id) {
    const rows = await db
      .update(leaseSales)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(leaseSales.id, data.id))
      .returning();
    return rows[0];
  }
  const rows = await db.insert(leaseSales).values(data).returning();
  return rows[0];
}

export async function deleteSale(db: DB, id: string) {
  await db.delete(leaseSales).where(eq(leaseSales.id, id));
}

// ─── PERCENT RENT RULES CRUD ─────────────────────────────────────────────────

export async function upsertPercentRentRule(
  db: DB,
  data: Partial<LeasePercentRentRule> & { leaseId: string }
) {
  if (data.id) {
    const rows = await db
      .update(leasePercentRentRules)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(leasePercentRentRules.id, data.id))
      .returning();
    return rows[0];
  }
  const rows = await db.insert(leasePercentRentRules).values(data).returning();
  return rows[0];
}

export async function deletePercentRentRule(db: DB, id: string) {
  await db
    .delete(leasePercentRentRules)
    .where(eq(leasePercentRentRules.id, id));
}

// ─── TI PROGRAM + DRAWS CRUD ────────────────────────────────────────────────

export async function upsertTiProgram(
  db: DB,
  data: Partial<LeaseTiProgram> & { leaseId: string }
) {
  if (data.id) {
    const rows = await db
      .update(leaseTiPrograms)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(leaseTiPrograms.id, data.id))
      .returning();
    return rows[0];
  }
  const rows = await db.insert(leaseTiPrograms).values(data).returning();
  return rows[0];
}

export async function upsertTiDraw(
  db: DB,
  data: Partial<LeaseTiDraw> & { tiProgramId: string }
) {
  if (data.id) {
    const rows = await db
      .update(leaseTiDraws)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(leaseTiDraws.id, data.id))
      .returning();
    return rows[0];
  }
  const rows = await db.insert(leaseTiDraws).values(data).returning();
  return rows[0];
}

export async function deleteTiDraw(db: DB, id: string) {
  await db.delete(leaseTiDraws).where(eq(leaseTiDraws.id, id));
}

// ─── RECOVERY MODEL + CATEGORIES CRUD ────────────────────────────────────────

export async function upsertRecoveryModel(
  db: DB,
  data: Partial<LeaseRecoveryModel> & { leaseId: string }
) {
  if (data.id) {
    const rows = await db
      .update(leaseRecoveryModels)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(leaseRecoveryModels.id, data.id))
      .returning();
    return rows[0];
  }
  const rows = await db.insert(leaseRecoveryModels).values(data).returning();
  return rows[0];
}

export async function upsertRecoveryCategory(
  db: DB,
  data: Partial<LeaseRecoveryCategoryRow> & { recoveryModelId: string }
) {
  if (data.id) {
    const rows = await db
      .update(leaseRecoveryCategories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(leaseRecoveryCategories.id, data.id))
      .returning();
    return rows[0];
  }
  const rows = await db
    .insert(leaseRecoveryCategories)
    .values(data)
    .returning();
  return rows[0];
}

export async function deleteRecoveryCategory(db: DB, id: string) {
  await db
    .delete(leaseRecoveryCategories)
    .where(eq(leaseRecoveryCategories.id, id));
}

// ─── CASHFLOW RECOMPUTATION ──────────────────────────────────────────────────

/**
 * Recompute all cashflows for a lease and upsert into cache table.
 * Call after any input changes.
 */
export async function recomputeAndStoreCashflows(
  db: DB,
  leaseId: string,
  horizonStart?: string,
  horizonEnd?: string
) {
  const detail = await getLeaseDetail(db, leaseId);
  if (!detail) throw new Error(`Lease ${leaseId} not found`);

  const start = horizonStart || detail.commencementDate;
  // Default horizon: 25 years from commencement (300 months)
  const defaultEnd = new Date(
    new Date(detail.commencementDate).getTime() + 25 * 365.25 * 86400000
  )
    .toISOString()
    .slice(0, 10);
  const end = horizonEnd || detail.expirationDate || defaultEnd;

  // Gather TI draws across all programs
  const allDraws: LeaseTiDraw[] = [];
  for (const prog of detail.tiPrograms) {
    if ((prog as any).draws) allDraws.push(...(prog as any).draws);
  }

  // Gather recovery categories across all models
  const allRecCats: LeaseRecoveryCategoryRow[] = [];
  for (const model of detail.recoveryModels) {
    if (model.categories) allRecCats.push(...model.categories);
  }

  const input: LeaseComputeInput = {
    lease: detail,
    terms: detail.terms,
    chargeLines: detail.chargeLines,
    abatements: detail.abatements,
    sales: detail.sales,
    percentRentRules: detail.percentRentRules,
    tiPrograms: detail.tiPrograms,
    tiDraws: allDraws,
    recoveryModels: detail.recoveryModels,
    recoveryCategories: allRecCats,
  };

  const rows = computeLeaseMonthlyCashflows(input, start, end);

  // Delete existing cashflows for this lease in the range
  await db
    .delete(leaseMonthlyCashflows)
    .where(eq(leaseMonthlyCashflows.leaseId, leaseId));

  // Batch insert
  if (rows.length > 0) {
    // Insert in chunks of 500 for safety
    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize).map((r) => ({
        leaseId: r.leaseId,
        monthEnd: r.monthEnd,
        baseRent: String(r.baseRent),
        recoveriesCam: String(r.recoveriesCam),
        recoveriesTax: String(r.recoveriesTax),
        recoveriesInsurance: String(r.recoveriesInsurance),
        recoveriesUtilities: String(r.recoveriesUtilities),
        miscIncome: String(r.miscIncome),
        discounts: String(r.discounts),
        percentRent: String(r.percentRent),
        tiLandlordCapex: String(r.tiLandlordCapex),
        tiTenantContribution: String(r.tiTenantContribution),
        tiAmortizationCharge: String(r.tiAmortizationCharge),
        totalRent: String(r.totalRent),
        meta: r.meta,
      }));
      await db.insert(leaseMonthlyCashflows).values(chunk);
    }
  }

  return rows;
}

// ─── CASHFLOW QUERY ──────────────────────────────────────────────────────────

export async function getCashflows(
  db: DB,
  leaseId: string,
  from?: string,
  to?: string
) {
  const conditions: any[] = [eq(leaseMonthlyCashflows.leaseId, leaseId)];
  if (from) conditions.push(gte(leaseMonthlyCashflows.monthEnd, from));
  if (to) conditions.push(lte(leaseMonthlyCashflows.monthEnd, to));

  return db
    .select()
    .from(leaseMonthlyCashflows)
    .where(and(...conditions))
    .orderBy(asc(leaseMonthlyCashflows.monthEnd));
}

// ─── PROJECT ROLLUP (for Historical + Pro Forma integration) ─────────────────

export async function getProjectLeaseRollup(
  db: DB,
  projectId: string,
  from?: string,
  to?: string
): Promise<ProjectLeaseRollup> {
  // Get all active leases for the project
  const leases = await db
    .select()
    .from(commercialLeases)
    .where(
      and(
        eq(commercialLeases.projectId, projectId),
        eq(commercialLeases.active, true)
      )
    );

  const leaseIds = leases.map((l: any) => l.id);
  if (!leaseIds.length) {
    return { projectId, months: [], byLease: [] };
  }

  const conditions: any[] = [inArray(leaseMonthlyCashflows.leaseId, leaseIds)];
  if (from) conditions.push(gte(leaseMonthlyCashflows.monthEnd, from));
  if (to) conditions.push(lte(leaseMonthlyCashflows.monthEnd, to));

  const allCf = await db
    .select()
    .from(leaseMonthlyCashflows)
    .where(and(...conditions))
    .orderBy(asc(leaseMonthlyCashflows.monthEnd));

  // Aggregate by month
  const monthAgg = new Map<string, LeaseRollupMonth>();
  const leaseAgg = new Map<string, Map<string, LeaseRollupMonth>>();

  for (const cf of allCf) {
    // Project-level
    if (!monthAgg.has(cf.monthEnd)) {
      monthAgg.set(cf.monthEnd, {
        monthEnd: cf.monthEnd,
        baseRent: 0,
        recoveriesCam: 0,
        recoveriesTax: 0,
        recoveriesInsurance: 0,
        recoveriesUtilities: 0,
        miscIncome: 0,
        discounts: 0,
        percentRent: 0,
        tiLandlordCapex: 0,
        tiAmortizationCharge: 0,
        totalRent: 0,
      });
    }
    const ma = monthAgg.get(cf.monthEnd)!;
    ma.baseRent += Number(cf.baseRent);
    ma.recoveriesCam += Number(cf.recoveriesCam);
    ma.recoveriesTax += Number(cf.recoveriesTax);
    ma.recoveriesInsurance += Number(cf.recoveriesInsurance);
    ma.recoveriesUtilities += Number(cf.recoveriesUtilities);
    ma.miscIncome += Number(cf.miscIncome);
    ma.discounts += Number(cf.discounts);
    ma.percentRent += Number(cf.percentRent);
    ma.tiLandlordCapex += Number(cf.tiLandlordCapex);
    ma.tiAmortizationCharge += Number(cf.tiAmortizationCharge);
    ma.totalRent += Number(cf.totalRent);

    // Per-lease
    if (!leaseAgg.has(cf.leaseId)) leaseAgg.set(cf.leaseId, new Map());
    const la = leaseAgg.get(cf.leaseId)!;
    if (!la.has(cf.monthEnd)) {
      la.set(cf.monthEnd, {
        monthEnd: cf.monthEnd,
        baseRent: 0,
        recoveriesCam: 0,
        recoveriesTax: 0,
        recoveriesInsurance: 0,
        recoveriesUtilities: 0,
        miscIncome: 0,
        discounts: 0,
        percentRent: 0,
        tiLandlordCapex: 0,
        tiAmortizationCharge: 0,
        totalRent: 0,
      });
    }
    const lm = la.get(cf.monthEnd)!;
    lm.baseRent += Number(cf.baseRent);
    lm.recoveriesCam += Number(cf.recoveriesCam);
    lm.recoveriesTax += Number(cf.recoveriesTax);
    lm.recoveriesInsurance += Number(cf.recoveriesInsurance);
    lm.recoveriesUtilities += Number(cf.recoveriesUtilities);
    lm.miscIncome += Number(cf.miscIncome);
    lm.discounts += Number(cf.discounts);
    lm.percentRent += Number(cf.percentRent);
    lm.tiLandlordCapex += Number(cf.tiLandlordCapex);
    lm.tiAmortizationCharge += Number(cf.tiAmortizationCharge);
    lm.totalRent += Number(cf.totalRent);
  }

  const leaseNameMap = new Map<string, string>();
  for (const l of leases) leaseNameMap.set(l.id, l.tenantName);

  return {
    projectId,
    months: Array.from(monthAgg.values()).sort((a, b) =>
      a.monthEnd.localeCompare(b.monthEnd)
    ),
    byLease: Array.from(leaseAgg.entries()).map(([leaseId, months]) => ({
      leaseId,
      tenantName: leaseNameMap.get(leaseId) || "Unknown",
      months: Array.from(months.values()).sort((a, b) =>
        a.monthEnd.localeCompare(b.monthEnd)
      ),
    })),
  };
}

// ─── PROJECT STATS (for KPIs independent of pagination) ─────────────────────

export interface ProjectLeaseStats {
  totalLeases: number;
  activeLeases: number;
  totalSf: number;
  avgRentPerSf: number;
  totalMonthlyBaseRent: number;
  leaseTypeBreakdown: Record<string, number>;
  expiringWithin12Months: number;
}

export async function getProjectLeaseStats(
  db: DB,
  projectId: string
): Promise<ProjectLeaseStats> {
  // Single query for aggregate stats
  const [stats] = await db
    .select({
      totalLeases: sql<number>`count(*)::int`,
      activeLeases: sql<number>`count(*) FILTER (WHERE active = true)::int`,
      totalSf: sql<number>`coalesce(sum(sf::numeric) FILTER (WHERE active = true), 0)::numeric`,
      expiringWithin12Months: sql<number>`count(*) FILTER (WHERE active = true AND expiration_date <= current_date + interval '12 months')::int`,
    })
    .from(commercialLeases)
    .where(eq(commercialLeases.projectId, projectId));

  // Lease type breakdown
  const typeRows = await db
    .select({
      leaseType: commercialLeases.leaseType,
      count: sql<number>`count(*)::int`,
    })
    .from(commercialLeases)
    .where(and(eq(commercialLeases.projectId, projectId), eq(commercialLeases.active, true)))
    .groupBy(commercialLeases.leaseType);

  const leaseTypeBreakdown: Record<string, number> = {};
  for (const row of typeRows) {
    leaseTypeBreakdown[row.leaseType] = row.count;
  }

  // Current month total base rent from cashflows
  const now = new Date();
  const currentMonthEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0))
    .toISOString().slice(0, 10);
  
  const [rentStats] = await db
    .select({
      totalBaseRent: sql<number>`coalesce(sum(base_rent::numeric), 0)::numeric`,
    })
    .from(leaseMonthlyCashflows)
    .where(
      sql`lease_id IN (SELECT id FROM commercial_leases WHERE project_id = ${projectId} AND active = true) AND month_end = ${currentMonthEnd}`
    );

  const totalSf = Number(stats.totalSf) || 0;
  const monthlyBase = Number(rentStats?.totalBaseRent) || 0;

  return {
    totalLeases: stats.totalLeases,
    activeLeases: stats.activeLeases,
    totalSf,
    avgRentPerSf: totalSf > 0 ? (monthlyBase * 12) / totalSf : 0,
    totalMonthlyBaseRent: monthlyBase,
    leaseTypeBreakdown,
    expiringWithin12Months: stats.expiringWithin12Months,
  };
}

// ─── BULK RECOMPUTE (all leases in a project) ──────────────────────────────

export async function bulkRecomputeProject(
  db: DB,
  projectId: string,
  horizonStart?: string,
  horizonEnd?: string
): Promise<{ recomputed: number; errors: string[] }> {
  const leases = await db
    .select({ id: commercialLeases.id })
    .from(commercialLeases)
    .where(and(eq(commercialLeases.projectId, projectId), eq(commercialLeases.active, true)));

  let recomputed = 0;
  const errors: string[] = [];

  // Process in parallel batches of 10 to avoid overwhelming the DB
  const batchSize = 10;
  for (let i = 0; i < leases.length; i += batchSize) {
    const batch = leases.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((l: any) => recomputeAndStoreCashflows(db, l.id, horizonStart, horizonEnd))
    );
    for (let j = 0; j < results.length; j++) {
      if (results[j].status === 'fulfilled') {
        recomputed++;
      } else {
        errors.push(`Lease ${batch[j].id}: ${(results[j] as PromiseRejectedResult).reason?.message || 'Unknown error'}`);
      }
    }
  }

  return { recomputed, errors };
}

// ─── SQL-AGGREGATED PROJECT ROLLUP (for bridge, avoids loading all rows) ────

export async function getProjectRollupAggregated(
  db: DB,
  projectId: string,
  from?: string,
  to?: string
): Promise<{ monthEnd: string; totalRevenue: number }[]> {
  const conditions = [
    sql`cl.project_id = ${projectId}`,
    sql`cl.active = true`,
  ];
  if (from) conditions.push(sql`cf.month_end >= ${from}`);
  if (to) conditions.push(sql`cf.month_end <= ${to}`);

  const rows = await db.execute(sql`
    SELECT
      cf.month_end AS "monthEnd",
      SUM(cf.base_rent::numeric + cf.recoveries_cam::numeric + cf.recoveries_tax::numeric
        + cf.recoveries_insurance::numeric + cf.recoveries_utilities::numeric
        + cf.misc_income::numeric + cf.percent_rent::numeric) AS "totalRevenue"
    FROM lease_monthly_cashflows cf
    JOIN commercial_leases cl ON cl.id = cf.lease_id
    WHERE ${sql.join(conditions, sql` AND `)}
    GROUP BY cf.month_end
    ORDER BY cf.month_end
  `);

  return (rows.rows || rows).map((r: any) => ({
    monthEnd: r.monthEnd,
    totalRevenue: Number(r.totalRevenue) || 0,
  }));
}
