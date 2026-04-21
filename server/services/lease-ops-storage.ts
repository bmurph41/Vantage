/**
 * Operations Lease Storage
 * ========================
 * Org-scoped queries for the Operations → Commercial Tenants page.
 * Uses the same `commercial_leases` table as Valuator, filtered by
 * lease_context = 'operations'.
 */

import { eq, and, or, ilike, sql, desc, asc, gte, lte, isNull, inArray } from "drizzle-orm";
import {
  commercialLeases,
  leaseTerms,
  leaseMonthlyCashflows,
  LEASE_TYPE_VALUES,
  type OpsLeaseType,
} from "@shared/commercial-lease-schema";
import type {
  OperationsLeaseListParams,
  OperationsLeaseStats,
} from "@shared/lease-context-types";

type DB = any; // Use your actual Drizzle db type

// ─── List Lease IDs only (for "select all matching" — no pagination, no enrichment) ──

export async function listOperationsLeaseIds(
  db: DB,
  orgId: string,
  params: Pick<OperationsLeaseListParams, "propertyId" | "status" | "leaseType" | "search">
): Promise<{ ids: string[]; total: number }> {
  const { propertyId, search, status = "all", leaseType } = params;

  const conditions: any[] = [
    eq(commercialLeases.orgId, orgId),
    eq(commercialLeases.leaseContext, "operations"),
  ];

  if (propertyId) conditions.push(eq(commercialLeases.propertyId, propertyId));
  if (status === "active") conditions.push(eq(commercialLeases.active, true));
  else if (status === "inactive") conditions.push(eq(commercialLeases.active, false));
  if (leaseType && leaseType !== "all" && (LEASE_TYPE_VALUES as readonly string[]).includes(leaseType)) {
    conditions.push(eq(commercialLeases.leaseType, leaseType as OpsLeaseType));
  }
  if (search && search.trim()) {
    const pattern = `%${search.trim()}%`;
    conditions.push(or(ilike(commercialLeases.tenantName, pattern), ilike(commercialLeases.suite, pattern))!);
  }

  const where = and(...conditions);
  const rows = await db
    .select({ id: commercialLeases.id })
    .from(commercialLeases)
    .where(where)
    .orderBy(asc(commercialLeases.tenantName));

  return { ids: rows.map((r: { id: string }) => r.id), total: rows.length };
}

// ─── List Leases (Operations) ─────────────────────────────────────────────────

export async function listOperationsLeases(
  db: DB,
  orgId: string,
  params: OperationsLeaseListParams
) {
  const {
    propertyId,
    search,
    status = "all",
    leaseType,
    limit = 25,
    offset = 0,
    sortBy = "tenantName",
    sortDir = "asc",
  } = params;

  // Build WHERE conditions
  const conditions: any[] = [
    eq(commercialLeases.orgId, orgId),
    eq(commercialLeases.leaseContext, "operations"),
  ];

  if (propertyId) {
    conditions.push(eq(commercialLeases.propertyId, propertyId));
  }

  if (status === "active") {
    conditions.push(eq(commercialLeases.active, true));
  } else if (status === "inactive") {
    conditions.push(eq(commercialLeases.active, false));
  }

  if (leaseType && leaseType !== "all") {
    if ((LEASE_TYPE_VALUES as readonly string[]).includes(leaseType)) {
      conditions.push(eq(commercialLeases.leaseType, leaseType as OpsLeaseType));
    }
  }

  if (search && search.trim()) {
    const pattern = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(commercialLeases.tenantName, pattern),
        ilike(commercialLeases.suite, pattern)
      )!
    );
  }

  const where = and(...conditions);

  // Sort
  const sortColumnMap: Record<string, any> = {
    tenantName: commercialLeases.tenantName,
    leaseType: commercialLeases.leaseType,
    sf: commercialLeases.sf,
    commencementDate: commercialLeases.commencementDate,
    expirationDate: commercialLeases.expirationDate,
    createdAt: commercialLeases.createdAt,
  };
  const sortCol = sortColumnMap[sortBy] || commercialLeases.tenantName;
  const orderFn = sortDir === "desc" ? desc : asc;

  // Data query
  const data = await db
    .select()
    .from(commercialLeases)
    .where(where)
    .orderBy(orderFn(sortCol))
    .limit(limit)
    .offset(offset);

  // Total count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(commercialLeases)
    .where(where);

  // Attach first-term rent data for PSF display in list views
  let enrichedData = data;
  if (data.length > 0) {
    const leaseIds = data.map((l: any) => l.id);
    const firstTerms = await db
      .select({
        leaseId: leaseTerms.leaseId,
        baseRentValue: leaseTerms.baseRentValue,
        baseRentMode: leaseTerms.baseRentMode,
        termIndex: leaseTerms.termIndex,
      })
      .from(leaseTerms)
      .where(inArray(leaseTerms.leaseId, leaseIds))
      .orderBy(asc(leaseTerms.leaseId), asc(leaseTerms.termIndex));

    // Build a map: leaseId -> first term rent info
    const firstTermMap: Record<string, { baseRentValue: string; baseRentMode: string }> = {};
    for (const t of firstTerms) {
      if (!firstTermMap[t.leaseId]) {
        firstTermMap[t.leaseId] = { baseRentValue: t.baseRentValue, baseRentMode: t.baseRentMode };
      }
    }

    enrichedData = data.map((l: any) => ({
      ...l,
      firstTermRent: firstTermMap[l.id] || null,
    }));
  }

  return {
    data: enrichedData,
    total: count,
    limit,
    offset,
    hasMore: offset + enrichedData.length < count,
  };
}

// ─── Operations Stats (KPIs) ─────────────────────────────────────────────────

export async function getOperationsStats(
  db: DB,
  orgId: string,
  propertyId?: string
): Promise<OperationsLeaseStats> {
  const conditions: any[] = [
    eq(commercialLeases.orgId, orgId),
    eq(commercialLeases.leaseContext, "operations"),
  ];

  if (propertyId) {
    conditions.push(eq(commercialLeases.propertyId, propertyId));
  }

  const where = and(...conditions);

  const [stats] = await db
    .select({
      totalLeases: sql<number>`count(*)::int`,
      activeLeases: sql<number>`count(*) FILTER (WHERE active = true)::int`,
      totalSf: sql<number>`coalesce(sum(sf::numeric) FILTER (WHERE active = true), 0)::numeric`,
    })
    .from(commercialLeases)
    .where(where);

  // Expiration counts
  const now = new Date().toISOString().split("T")[0];
  const ninetyDays = new Date();
  ninetyDays.setDate(ninetyDays.getDate() + 90);
  const twelveMonths = new Date();
  twelveMonths.setDate(twelveMonths.getDate() + 365);

  const [expirations] = await db
    .select({
      within90: sql<number>`count(*) FILTER (WHERE expiration_date >= ${now} AND expiration_date <= ${ninetyDays.toISOString().split("T")[0]})::int`,
      within12mo: sql<number>`count(*) FILTER (WHERE expiration_date >= ${now} AND expiration_date <= ${twelveMonths.toISOString().split("T")[0]})::int`,
    })
    .from(commercialLeases)
    .where(and(...conditions, eq(commercialLeases.active, true)));

  // Lease type breakdown
  const typeBreakdown = await db
    .select({
      leaseType: commercialLeases.leaseType,
      count: sql<number>`count(*)::int`,
    })
    .from(commercialLeases)
    .where(where)
    .groupBy(commercialLeases.leaseType);

  const leaseTypeBreakdown: Record<string, number> = {};
  for (const row of typeBreakdown) {
    leaseTypeBreakdown[row.leaseType] = row.count;
  }

  // Get total monthly base rent from first terms
  const [rentStats] = await db
    .select({
      totalMonthly: sql<number>`coalesce(sum(
        CASE
          WHEN ${leaseTerms.baseRentMode} = 'PER_SF_YEAR' THEN (${leaseTerms.baseRentValue}::numeric * ${commercialLeases.sf}::numeric) / 12
          WHEN ${leaseTerms.baseRentMode} = 'PER_MONTH' THEN ${leaseTerms.baseRentValue}::numeric
          WHEN ${leaseTerms.baseRentMode} = 'PER_YEAR' THEN ${leaseTerms.baseRentValue}::numeric / 12
          ELSE 0
        END
      ), 0)::numeric`,
    })
    .from(commercialLeases)
    .innerJoin(
      leaseTerms,
      and(
        eq(leaseTerms.leaseId, commercialLeases.id),
        eq(leaseTerms.termIndex, 0)
      )
    )
    .where(and(...conditions, eq(commercialLeases.active, true)));

  const totalSf = Number(stats.totalSf) || 0;
  const totalMonthly = Number(rentStats.totalMonthly) || 0;

  return {
    totalLeases: stats.totalLeases,
    activeLeases: stats.activeLeases,
    totalSf,
    avgRentPerSf: totalSf > 0 ? (totalMonthly * 12) / totalSf : 0,
    totalMonthlyBaseRent: totalMonthly,
    expiringWithin90Days: expirations.within90,
    expiringWithin12Months: expirations.within12mo,
    leaseTypeBreakdown,
  };
}

// ─── Get Leases Available for Import ──────────────────────────────────────────

export async function getAvailableForImport(
  db: DB,
  orgId: string,
  projectId: string,
  propertyId?: string
) {
  const conditions: any[] = [
    eq(commercialLeases.orgId, orgId),
    eq(commercialLeases.leaseContext, "operations"),
  ];

  if (propertyId) {
    conditions.push(eq(commercialLeases.propertyId, propertyId));
  }

  // Get operations leases
  const opsLeases = await db
    .select()
    .from(commercialLeases)
    .where(and(...conditions))
    .orderBy(asc(commercialLeases.tenantName));

  // Get already-imported lease IDs for this project
  const imported = await db
    .select({
      sourceLeaseId: commercialLeases.sourceLeaseId,
      id: commercialLeases.id,
    })
    .from(commercialLeases)
    .where(
      and(
        eq(commercialLeases.projectId, projectId),
        eq(commercialLeases.leaseContext, "valuator"),
        sql`${commercialLeases.sourceLeaseId} IS NOT NULL`
      )
    );

  const importedMap = new Map(
    imported.map((r: any) => [r.sourceLeaseId, r.id])
  );

  return opsLeases.map((lease: any) => ({
    id: lease.id,
    tenantName: lease.tenantName,
    suite: lease.suite,
    sf: Number(lease.sf),
    leaseType: lease.leaseType,
    commencementDate: lease.commencementDate,
    expirationDate: lease.expirationDate,
    active: lease.active,
    alreadyImported: importedMap.has(lease.id),
    importedLeaseId: importedMap.get(lease.id) || undefined,
  }));
}
