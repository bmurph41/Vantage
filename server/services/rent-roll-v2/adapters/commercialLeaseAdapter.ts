/**
 * Commercial Lease Adapter
 *
 * Maps the institutional-grade commercialTenants system (172 columns) into the
 * rent-roll-v2 LeaseWithTenant shape, enabling CRE asset classes (Retail, Office,
 * Industrial, Medical Office) to use the rent roll dashboard, analytics, and reports.
 *
 * This is a READ adapter — it queries commercialTenants and transforms the results.
 * CRUD operations for CRE leases still go through commercial-tenants-routes.ts.
 */

import { db } from "../../db";
import { eq, and, gte, lte, sql, desc, asc, inArray } from "drizzle-orm";
import {
  commercialTenants,
  commercialTenantRentSchedule,
  type CommercialTenant,
} from "@shared/schema";

// ============================================================================
// Types matching rent-roll-v2 shapes
// ============================================================================

export interface CRELeaseWithTenant {
  id: string;
  tenantId: string;
  locationId: string | null;
  leaseCommencement: string | null;
  leaseExpiration: string | null;
  leaseAmount: string | null;       // Monthly base rent
  baseRent2: string | null;
  baseRent3: string | null;
  rateType: string | null;          // NNN, Gross, Modified Gross
  contractTerm: string | null;
  storageType: string;              // Maps to unit type (suite type)
  unitTypeCustom: string | null;    // Suite/space type
  unitDimension1: string | null;    // Square footage
  unitLocation: string | null;      // Suite number
  unitNumber: string | null;
  slipStatus: string | null;        // Mapped from tenantStatus
  isActive: boolean;
  isIncomplete: boolean;
  leaseKey: string;
  numMonths: number | null;
  totalContractValue: string | null;
  createdAt: Date;
  updatedAt: Date;
  // CRE-specific fields
  leaseType: string | null;
  escalationType: string | null;
  escalationRate: string | null;
  squareFootage: string | null;
  baseRentPerSF: string | null;
  totalEstimatedNNN: string | null;
  renewalOptions: number | null;
  percentageRentRate: string | null;
  // Tenant
  tenant: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    tradeName: string | null;
    contactName: string | null;
    industry: string | null;
  };
}

export interface CREDashboardMetrics {
  totalRevenue: number;
  activeLeases: number;
  totalSF: number;
  occupiedSF: number;
  occupancyRate: number;
  avgRentPerSF: number;
  walt: number;                    // Weighted Average Lease Term (years)
  expiringNext12Months: number;
  totalNNNRecoveries: number;
}

export interface CRERentScheduleRow {
  tenantId: string;
  tenantName: string;
  periodStart: string;
  periodEnd: string;
  yearNumber: number;
  baseRentAnnual: number;
  baseRentMonthly: number;
  baseRentPerSF: number;
  estimatedPercentageRent: number;
  estimatedNNNAnnual: number;
  totalRentAnnual: number;
}

// ============================================================================
// Status Mapping
// ============================================================================

function mapTenantStatus(status: string | null): string {
  switch (status) {
    case 'active': return 'Occupied';
    case 'future': return 'Leased - Not Occupied';
    case 'expired': return 'Vacant';
    case 'inactive': return 'Vacant';
    default: return 'Occupied';
  }
}

// ============================================================================
// Core Adapter Functions
// ============================================================================

/**
 * Get CRE leases for a location (modeling project), adapted to rent-roll shape.
 */
export async function getCRELeases(options: {
  orgId: string;
  locationId?: string;     // rraMarinaLocations.id — we look up the linked modelingProjectId
  modelingProjectId?: string;
  marinaId?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<{ leases: CRELeaseWithTenant[]; total: number }> {
  const conditions = [eq(commercialTenants.orgId, options.orgId)];

  if (options.modelingProjectId) {
    conditions.push(eq(commercialTenants.modelingProjectId, options.modelingProjectId));
  }
  if (options.marinaId) {
    conditions.push(eq(commercialTenants.marinaId, options.marinaId));
  }
  if (options.isActive !== undefined) {
    conditions.push(
      options.isActive
        ? eq(commercialTenants.tenantStatus, 'active')
        : sql`${commercialTenants.tenantStatus} != 'active'`
    );
  }

  const allTenants = await db
    .select()
    .from(commercialTenants)
    .where(and(...conditions))
    .orderBy(asc(commercialTenants.tenantName));

  const total = allTenants.length;
  const page = options.page || 1;
  const pageSize = options.pageSize || 200;
  const paginated = allTenants.slice((page - 1) * pageSize, page * pageSize);

  const leases: CRELeaseWithTenant[] = paginated.map(ct => adaptCommercialTenant(ct, options.locationId));

  return { leases, total };
}

/**
 * Adapt a single CommercialTenant record to the rent-roll LeaseWithTenant shape.
 */
function adaptCommercialTenant(ct: CommercialTenant, locationId?: string | null): CRELeaseWithTenant {
  const sf = parseFloat(ct.squareFootage?.toString() || '0');
  const annualRent = parseFloat(ct.currentBaseRent?.toString() || '0');
  const monthlyRent = annualRent / 12;

  const commencement = ct.leaseCommencementDate;
  const expiration = ct.leaseExpirationDate;
  let numMonths: number | null = null;
  if (commencement && expiration) {
    const start = new Date(commencement);
    const end = new Date(expiration);
    numMonths = Math.max(1, Math.round((end.getTime() - start.getTime()) / (30.44 * 24 * 60 * 60 * 1000)));
  }

  return {
    id: ct.id,
    tenantId: ct.id, // CRE tenant IS the lease record
    locationId: locationId || ct.marinaId || null,
    leaseCommencement: commencement,
    leaseExpiration: expiration,
    leaseAmount: monthlyRent > 0 ? monthlyRent.toFixed(2) : null,
    baseRent2: null,
    baseRent3: null,
    rateType: ct.leaseType || null,
    contractTerm: numMonths ? (numMonths >= 12 ? 'Annual' : 'Monthly') : null,
    storageType: 'Other' as any,
    unitTypeCustom: ct.permittedUse || 'Office',
    unitDimension1: sf > 0 ? sf.toFixed(2) : null,
    unitLocation: ct.suiteNumber || null,
    unitNumber: ct.suiteNumber || null,
    slipStatus: mapTenantStatus(ct.tenantStatus),
    isActive: ct.tenantStatus === 'active',
    isIncomplete: !commencement || annualRent <= 0,
    leaseKey: `CRE|${ct.tenantName}|${ct.id}`,
    numMonths,
    totalContractValue: numMonths && monthlyRent > 0 ? (monthlyRent * numMonths).toFixed(2) : null,
    createdAt: ct.createdAt || new Date(),
    updatedAt: ct.updatedAt || new Date(),
    // CRE-specific
    leaseType: ct.leaseType || null,
    escalationType: ct.escalationType || null,
    escalationRate: ct.escalationRate?.toString() || null,
    squareFootage: ct.squareFootage?.toString() || null,
    baseRentPerSF: ct.baseRentPerSF?.toString() || null,
    totalEstimatedNNN: ct.totalEstimatedNNN?.toString() || null,
    renewalOptions: ct.renewalOptions || null,
    percentageRentRate: ct.percentageRentRate?.toString() || null,
    tenant: {
      id: ct.id,
      name: ct.tenantName,
      email: ct.contactEmail || null,
      phone: ct.contactPhone || null,
      tradeName: ct.tradeName || null,
      contactName: ct.contactName || null,
      industry: (ct as any).industry || null,
    },
  };
}

/**
 * Get CRE dashboard metrics for a set of commercial tenants.
 */
export async function getCREDashboardMetrics(options: {
  orgId: string;
  modelingProjectId?: string;
  marinaId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<CREDashboardMetrics> {
  const conditions = [eq(commercialTenants.orgId, options.orgId)];
  if (options.modelingProjectId) {
    conditions.push(eq(commercialTenants.modelingProjectId, options.modelingProjectId));
  }
  if (options.marinaId) {
    conditions.push(eq(commercialTenants.marinaId, options.marinaId));
  }

  const tenants = await db
    .select()
    .from(commercialTenants)
    .where(and(...conditions));

  const activeTenants = tenants.filter(t => t.tenantStatus === 'active');
  const now = new Date();
  const oneYearOut = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  let totalRevenue = 0;
  let totalSF = 0;
  let occupiedSF = 0;
  let totalNNN = 0;
  let weightedTermSum = 0;
  let weightedTermDenom = 0;
  let expiringCount = 0;

  for (const t of tenants) {
    const sf = parseFloat(t.squareFootage?.toString() || '0');
    const annualRent = parseFloat(t.currentBaseRent?.toString() || '0');
    const nnn = parseFloat(t.totalEstimatedNNN?.toString() || '0');
    totalSF += sf;

    if (t.tenantStatus === 'active') {
      occupiedSF += sf;
      totalRevenue += annualRent;
      totalNNN += nnn;

      // WALT calculation: remaining term weighted by rent
      if (t.leaseExpirationDate && annualRent > 0) {
        const expDate = new Date(t.leaseExpirationDate);
        const remainingYears = Math.max(0, (expDate.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        weightedTermSum += remainingYears * annualRent;
        weightedTermDenom += annualRent;
      }
    }

    // Count expirations in next 12 months
    if (t.leaseExpirationDate) {
      const expDate = new Date(t.leaseExpirationDate);
      if (expDate >= now && expDate <= oneYearOut) {
        expiringCount++;
      }
    }
  }

  const walt = weightedTermDenom > 0 ? weightedTermSum / weightedTermDenom : 0;
  const occupancyRate = totalSF > 0 ? (occupiedSF / totalSF) * 100 : 0;
  const avgRentPerSF = occupiedSF > 0 ? totalRevenue / occupiedSF : 0;

  return {
    totalRevenue,
    activeLeases: activeTenants.length,
    totalSF,
    occupiedSF,
    occupancyRate: Math.round(occupancyRate * 10) / 10,
    avgRentPerSF: Math.round(avgRentPerSF * 100) / 100,
    walt: Math.round(walt * 10) / 10,
    expiringNext12Months: expiringCount,
    totalNNNRecoveries: totalNNN,
  };
}

/**
 * Get rent schedule (annual cash flow projection) for CRE tenants.
 */
export async function getCRERentSchedule(options: {
  orgId: string;
  modelingProjectId?: string;
  marinaId?: string;
}): Promise<CRERentScheduleRow[]> {
  const conditions = [eq(commercialTenants.orgId, options.orgId)];
  if (options.modelingProjectId) {
    conditions.push(eq(commercialTenants.modelingProjectId, options.modelingProjectId));
  }

  const rows = await db
    .select({
      tenantId: commercialTenantRentSchedule.tenantId,
      tenantName: commercialTenants.tenantName,
      periodStart: commercialTenantRentSchedule.periodStart,
      periodEnd: commercialTenantRentSchedule.periodEnd,
      yearNumber: commercialTenantRentSchedule.yearNumber,
      baseRentAnnual: commercialTenantRentSchedule.baseRentAnnual,
      baseRentMonthly: commercialTenantRentSchedule.baseRentMonthly,
      baseRentPerSF: commercialTenantRentSchedule.baseRentPerSF,
      estimatedPercentageRent: commercialTenantRentSchedule.estimatedPercentageRent,
      estimatedNNNAnnual: commercialTenantRentSchedule.estimatedNNNAnnual,
      totalRentAnnual: commercialTenantRentSchedule.totalRentAnnual,
    })
    .from(commercialTenantRentSchedule)
    .innerJoin(commercialTenants, eq(commercialTenantRentSchedule.tenantId, commercialTenants.id))
    .where(and(...conditions))
    .orderBy(asc(commercialTenantRentSchedule.yearNumber));

  return rows.map(r => ({
    tenantId: r.tenantId,
    tenantName: r.tenantName,
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    yearNumber: r.yearNumber,
    baseRentAnnual: parseFloat(r.baseRentAnnual?.toString() || '0'),
    baseRentMonthly: parseFloat(r.baseRentMonthly?.toString() || '0'),
    baseRentPerSF: parseFloat(r.baseRentPerSF?.toString() || '0'),
    estimatedPercentageRent: parseFloat(r.estimatedPercentageRent?.toString() || '0'),
    estimatedNNNAnnual: parseFloat(r.estimatedNNNAnnual?.toString() || '0'),
    totalRentAnnual: parseFloat(r.totalRentAnnual?.toString() || '0'),
  }));
}

/**
 * Get revenue breakdown by tenant for CRE (equivalent of getRevenueByStorageType for marina).
 */
export async function getCRERevenueByTenant(options: {
  orgId: string;
  modelingProjectId?: string;
  marinaId?: string;
}): Promise<Array<{ tenantName: string; annualRent: number; squareFootage: number; rentPerSF: number; leaseType: string }>> {
  const conditions = [
    eq(commercialTenants.orgId, options.orgId),
    eq(commercialTenants.tenantStatus, 'active'),
  ];
  if (options.modelingProjectId) {
    conditions.push(eq(commercialTenants.modelingProjectId, options.modelingProjectId));
  }

  const tenants = await db
    .select({
      tenantName: commercialTenants.tenantName,
      currentBaseRent: commercialTenants.currentBaseRent,
      squareFootage: commercialTenants.squareFootage,
      baseRentPerSF: commercialTenants.baseRentPerSF,
      leaseType: commercialTenants.leaseType,
    })
    .from(commercialTenants)
    .where(and(...conditions))
    .orderBy(desc(commercialTenants.currentBaseRent));

  return tenants.map(t => ({
    tenantName: t.tenantName,
    annualRent: parseFloat(t.currentBaseRent?.toString() || '0'),
    squareFootage: parseFloat(t.squareFootage?.toString() || '0'),
    rentPerSF: parseFloat(t.baseRentPerSF?.toString() || '0'),
    leaseType: t.leaseType || 'nnn',
  }));
}

/**
 * Get lease rollover schedule (expiration distribution by year).
 */
export async function getCRELeaseRollover(options: {
  orgId: string;
  modelingProjectId?: string;
  marinaId?: string;
}): Promise<Array<{ year: number; expiringLeases: number; expiringSF: number; expiringRent: number }>> {
  const conditions = [
    eq(commercialTenants.orgId, options.orgId),
    eq(commercialTenants.tenantStatus, 'active'),
  ];
  if (options.modelingProjectId) {
    conditions.push(eq(commercialTenants.modelingProjectId, options.modelingProjectId));
  }

  const tenants = await db
    .select({
      expirationDate: commercialTenants.leaseExpirationDate,
      squareFootage: commercialTenants.squareFootage,
      currentBaseRent: commercialTenants.currentBaseRent,
    })
    .from(commercialTenants)
    .where(and(...conditions));

  const rolloverMap = new Map<number, { count: number; sf: number; rent: number }>();

  for (const t of tenants) {
    if (!t.expirationDate) continue;
    const year = new Date(t.expirationDate).getFullYear();
    const existing = rolloverMap.get(year) || { count: 0, sf: 0, rent: 0 };
    existing.count += 1;
    existing.sf += parseFloat(t.squareFootage?.toString() || '0');
    existing.rent += parseFloat(t.currentBaseRent?.toString() || '0');
    rolloverMap.set(year, existing);
  }

  return Array.from(rolloverMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, data]) => ({
      year,
      expiringLeases: data.count,
      expiringSF: Math.round(data.sf),
      expiringRent: Math.round(data.rent),
    }));
}
