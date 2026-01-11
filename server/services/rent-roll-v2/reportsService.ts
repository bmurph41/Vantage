import { db } from "./db";
import { marinaLocations, leases, tenants, storageLocations, leaseTerms, leaseRentSteps, orgFeatureFlags, projectDetailsConfig } from "@shared/schema";
import { eq, and, inArray, sql, gte, lte, or } from "drizzle-orm";
import type {
  ReportFilters,
  ReportMetrics,
  ReportProjectBreakdown,
  ReportStorageTypeBreakdown,
  ReportLeaseDetail,
  ReportData,
  ReportOptions,
} from "@shared/schema";
import { generateReportNarrative } from "./aiReportNarratives";
import { calculateContractTermOccupancy, getContractTermGroup, type ContractTermOccupancyCounts } from "@shared/contractTermGroups";
import { generateLeaseEconomicsCashFlows } from "./services/leaseEconomics/leaseEconomics.engine";

function classifyContractTerm(term: string | null | undefined): 'annual' | 'seasonal' | 'winter' | 'shortTerm' | 'unclassified' {
  const group = getContractTermGroup(term);
  if (!group) return 'unclassified';
  const groupLower = group.toLowerCase();
  if (groupLower === 'annual') return 'annual';
  if (groupLower === 'seasonal') return 'seasonal';
  if (groupLower === 'winter') return 'winter';
  if (groupLower === 'shortterm' || groupLower === 'short_term') return 'shortTerm';
  return 'unclassified';
}

/**
 * Check if rate type indicates the stored value is a period total (not monthly)
 * $/season, $/yr = stored value is total for the period
 * $/mo., flat fee, etc. = stored value is monthly
 */
function isSeasonalOrAnnualRateType(rateType: string | null | undefined): boolean {
  if (!rateType) return false;
  const rt = rateType.toLowerCase();
  return rt.includes('/season') || rt.includes('/yr') || rt.includes('/year') || 
         rt.includes('per season') || rt.includes('per year') || rt === 'annual' ||
         rt.includes('$/ft/season') || rt.includes('$/ft/yr');
}

/**
 * Calculate effective number of months based on contract term
 */
function calculateEffectiveNumMonths(lease: { contractTerm?: string | null; numMonths?: number | null; leaseCommencement?: string | null; leaseExpiration?: string | null }): number {
  const contractTerm = lease.contractTerm?.toLowerCase() || '';
  
  // Annual contracts = 12 months
  if (contractTerm === 'annual' || contractTerm === 'yearly' || contractTerm === '12 month' || contractTerm === '12 months') {
    return 12;
  }
  
  // Use stored numMonths if valid
  if (lease.numMonths && lease.numMonths > 0) {
    return lease.numMonths;
  }
  
  // Calculate from lease dates if available
  if (lease.leaseCommencement && lease.leaseExpiration) {
    const start = new Date(lease.leaseCommencement);
    const end = new Date(lease.leaseExpiration);
    const yearDiff = end.getFullYear() - start.getFullYear();
    const monthDiff = end.getMonth() - start.getMonth();
    let months = yearDiff * 12 + monthDiff;
    if (end.getDate() >= start.getDate()) {
      months += 1;
    }
    return Math.max(1, months);
  }
  
  // Default to 6 months for seasonal if no data available
  if (contractTerm.includes('summer') || contractTerm.includes('winter') || contractTerm.includes('seasonal')) {
    return 6;
  }
  
  return 0;
}

/**
 * Calculate total contract value based on rate type semantics
 * - For seasonal/annual rate types: Total = leaseAmount (as stored)
 * - For monthly rate types: Total = leaseAmount × numMonths
 */
function calculateLeaseTotalValue(lease: { leaseAmount?: string | null; rateType?: string | null; contractTerm?: string | null; numMonths?: number | null; leaseCommencement?: string | null; leaseExpiration?: string | null }): number {
  const baseRent = lease.leaseAmount ? parseFloat(lease.leaseAmount) : 0;
  const numMonths = calculateEffectiveNumMonths(lease);
  
  // For seasonal/annual rate types, the stored value IS the total
  if (isSeasonalOrAnnualRateType(lease.rateType)) {
    return baseRent;
  }
  
  // For monthly rate types, multiply by months to get total
  return baseRent * numMonths;
}

/**
 * Check if a lease has V2 economics data (terms or rent steps)
 */
async function hasV2Economics(leaseId: string): Promise<boolean> {
  const [termCount, stepCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(leaseTerms).where(eq(leaseTerms.leaseId, leaseId)),
    db.select({ count: sql<number>`count(*)` }).from(leaseRentSteps).where(eq(leaseRentSteps.leaseId, leaseId)),
  ]);
  
  return (termCount[0]?.count || 0) > 0 || (stepCount[0]?.count || 0) > 0;
}

/**
 * Check if V2 economics feature flag is enabled for an organization
 */
async function isV2EconomicsEnabled(organizationId: string): Promise<boolean> {
  const [flag] = await db
    .select()
    .from(orgFeatureFlags)
    .where(and(
      eq(orgFeatureFlags.organizationId, organizationId),
      eq(orgFeatureFlags.key, 'RENTROLL_ECONOMICS_V2')
    ))
    .limit(1);
  return flag?.enabled ?? false;
}

/**
 * Calculate lease total value using V2 economics if available, otherwise fall back to legacy
 * @param lease - The lease data
 * @param organizationId - The organization ID to check feature flags
 * @param useV2 - Whether to attempt V2 calculation (from feature flag check)
 * @returns The total contract value for the lease
 */
async function calculateLeaseValueWithV2(
  lease: { id: string; leaseAmount?: string | null; rateType?: string | null; contractTerm?: string | null; numMonths?: number | null; leaseCommencement?: string | null; leaseExpiration?: string | null },
  useV2: boolean
): Promise<{ totalValue: number; usedV2: boolean }> {
  // If V2 not enabled or no lease ID, use legacy
  if (!useV2 || !lease.id) {
    return { totalValue: calculateLeaseTotalValue(lease), usedV2: false };
  }
  
  // Check if this lease has V2 data
  const hasV2 = await hasV2Economics(lease.id);
  if (!hasV2) {
    return { totalValue: calculateLeaseTotalValue(lease), usedV2: false };
  }
  
  try {
    // Generate cash flows using V2 engine
    const result = await generateLeaseEconomicsCashFlows(lease.id, { yearsToProject: 1 });
    
    // Sum up the total revenue from all periods
    const totalValue = result.periods.reduce((sum, period) => sum + period.totalRevenue, 0);
    
    return { totalValue, usedV2: true };
  } catch (error) {
    console.error(`V2 economics calculation failed for lease ${lease.id}, falling back to legacy:`, error);
    return { totalValue: calculateLeaseTotalValue(lease), usedV2: false };
  }
}

export async function getReportOptions(organizationId: string): Promise<ReportOptions> {
  const projects = await db
    .select({
      id: marinaLocations.id,
      name: marinaLocations.name,
      type: marinaLocations.projectType,
    })
    .from(marinaLocations)
    .where(eq(marinaLocations.organizationId, organizationId))
    .orderBy(marinaLocations.name);

  const storageLocationsList = await db
    .select({
      id: storageLocations.id,
      name: storageLocations.name,
      projectId: storageLocations.projectId,
    })
    .from(storageLocations)
    .innerJoin(marinaLocations, eq(storageLocations.projectId, marinaLocations.id))
    .where(eq(marinaLocations.organizationId, organizationId))
    .orderBy(storageLocations.name);

  const leasesData = await db
    .select({
      storageType: leases.storageType,
      contractTerm: leases.contractTerm,
      commencementDate: leases.leaseCommencement,
    })
    .from(leases)
    .innerJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
    .where(eq(marinaLocations.organizationId, organizationId));

  const storageTypes = Array.from(new Set(leasesData.map(l => l.storageType).filter(Boolean))) as string[];
  const contractTerms = Array.from(new Set(leasesData.map(l => l.contractTerm).filter(Boolean))) as string[];
  
  const years = Array.from(new Set(leasesData
    .map(l => l.commencementDate ? new Date(l.commencementDate).getFullYear() : null)
    .filter((y): y is number => y !== null)));
  years.sort((a, b) => b - a);

  return {
    projects: projects.map(p => ({ id: p.id, name: p.name, type: p.type || 'OWNED' })),
    storageTypes: storageTypes.sort(),
    storageLocations: storageLocationsList.map(s => ({ id: s.id, name: s.name, projectId: s.projectId })),
    contractTerms: contractTerms.sort(),
    years: years.length > 0 ? years : [new Date().getFullYear()],
  };
}

export async function generateReport(
  organizationId: string,
  filters: ReportFilters,
  includeAINarrative: boolean = true
): Promise<ReportData> {
  const projectConditions = [eq(marinaLocations.organizationId, organizationId)];
  
  if (filters.projectIds && filters.projectIds.length > 0) {
    projectConditions.push(inArray(marinaLocations.id, filters.projectIds));
  }

  const projects = await db
    .select()
    .from(marinaLocations)
    .where(and(...projectConditions));

  const projectIds = projects.map(p => p.id);

  if (projectIds.length === 0) {
    return createEmptyReport(filters);
  }

  // Fetch storage locations with capacity and storage type for dual-season capacity calculation
  const projectStorageLocations = await db
    .select({
      projectId: storageLocations.projectId,
      storageType: storageLocations.storageType,
      capacity: storageLocations.capacity,
      isActive: storageLocations.isActive,
    })
    .from(storageLocations)
    .where(inArray(storageLocations.projectId, projectIds));

  // Fetch project details config for dual-season storage types
  const projectConfigs = await db
    .select({
      projectId: projectDetailsConfig.projectId,
      dualSeasonStorageTypes: projectDetailsConfig.dualSeasonStorageTypes,
    })
    .from(projectDetailsConfig)
    .where(inArray(projectDetailsConfig.projectId, projectIds));

  // Create a map of projectId -> dualSeasonStorageTypes
  const dualSeasonTypesMap = new Map<string, string[]>();
  for (const config of projectConfigs) {
    dualSeasonTypesMap.set(config.projectId, config.dualSeasonStorageTypes || []);
  }

  // Calculate raw capacity (sum of storage locations, no multiplier) 
  // Used for occupancy calculation - calculateContractTermOccupancy handles seasonal doubling
  const rawCapacityMap = new Map<string, number>();
  // Calculate effective capacity (with dual-season multiplier) for display purposes
  const projectCapacityMap = new Map<string, number>();
  
  for (const projectId of projectIds) {
    const dualSeasonTypes = dualSeasonTypesMap.get(projectId) || [];
    const projectLocations = projectStorageLocations.filter(loc => loc.projectId === projectId && loc.isActive);
    const project = projects.find(p => p.id === projectId);
    
    let rawCapacity = 0;
    let effectiveCapacity = 0;
    
    for (const loc of projectLocations) {
      const baseCapacity = loc.capacity || 0;
      const storageType = loc.storageType || '';
      rawCapacity += baseCapacity;
      // Double capacity for dual-season storage types (display only)
      const multiplier = dualSeasonTypes.includes(storageType) ? 2 : 1;
      effectiveCapacity += baseCapacity * multiplier;
    }
    
    // Fall back to project.capacity if no storage locations
    if (rawCapacity === 0 && project?.capacity) {
      rawCapacity = project.capacity;
      effectiveCapacity = project.capacity;
    }
    
    rawCapacityMap.set(projectId, rawCapacity);
    projectCapacityMap.set(projectId, effectiveCapacity);
  }

  const leaseConditions = [inArray(leases.locationId, projectIds)];
  
  if (filters.storageTypes && filters.storageTypes.length > 0) {
    leaseConditions.push(inArray(leases.storageType, filters.storageTypes as any));
  }

  if (filters.year) {
    const yearStart = new Date(filters.year, 0, 1).toISOString().split('T')[0];
    const yearEnd = new Date(filters.year, 11, 31).toISOString().split('T')[0];
    
    leaseConditions.push(lte(leases.leaseCommencement, yearEnd));
    leaseConditions.push(
      or(
        gte(leases.leaseExpiration, yearStart),
        sql`${leases.leaseExpiration} IS NULL`
      )!
    );
  }

  if (filters.startDate) {
    leaseConditions.push(
      or(
        gte(leases.leaseExpiration, filters.startDate),
        sql`${leases.leaseExpiration} IS NULL`
      )!
    );
  }

  if (filters.endDate) {
    leaseConditions.push(lte(leases.leaseCommencement, filters.endDate));
  }

  const leasesWithTenants = await db
    .select({
      lease: leases,
      tenant: tenants,
      project: marinaLocations,
    })
    .from(leases)
    .innerJoin(tenants, eq(leases.tenantId, tenants.id))
    .innerJoin(marinaLocations, eq(leases.locationId, marinaLocations.id))
    .where(and(...leaseConditions));

  const activeLeases = leasesWithTenants.filter(l => l.lease.isActive);

  // Check if V2 economics is enabled for this organization
  const useV2Economics = await isV2EconomicsEnabled(organizationId);

  // Calculate revenue for all leases - use V2 economics when available, otherwise fall back to legacy
  // Cache all lease values for reuse in breakdowns
  const leaseValueCache = new Map<string, number>();
  let totalRevenue = 0;
  let v2LeaseCount = 0;
  
  if (useV2Economics) {
    // Calculate revenues in parallel batches for V2 leases
    const revenueResults = await Promise.all(
      activeLeases.map(async (l) => {
        const result = await calculateLeaseValueWithV2(l.lease, true);
        return { leaseId: l.lease.id, ...result };
      })
    );
    
    for (const r of revenueResults) {
      leaseValueCache.set(r.leaseId, r.totalValue);
      totalRevenue += r.totalValue;
      if (r.usedV2) v2LeaseCount++;
    }
  } else {
    // Use legacy calculation for all leases
    for (const l of activeLeases) {
      const value = calculateLeaseTotalValue(l.lease);
      leaseValueCache.set(l.lease.id, value);
      totalRevenue += value;
    }
  }
  
  // Helper to get cached lease value
  const getLeaseValue = (leaseId: string) => leaseValueCache.get(leaseId) || 0;

  const avgLeaseValue = activeLeases.length > 0 ? totalRevenue / activeLeases.length : 0;

  let totalNumerator = 0;
  let totalDenominator = 0;

  for (const project of projects) {
    const projectLeases = activeLeases.filter(l => l.project.id === project.id);
    // Use raw capacity for occupancy calculation - calculateContractTermOccupancy handles seasonal doubling
    const capacity = rawCapacityMap.get(project.id) || project.capacity || 0;
    
    if (capacity === 0) continue;

    const counts: ContractTermOccupancyCounts = {
      annual: 0,
      seasonal: 0,
      winter: 0,
      shortTerm: 0,
      unclassified: 0,
      total: 0,
    };

    for (const l of projectLeases) {
      const classification = classifyContractTerm(l.lease.contractTerm || '');
      counts[classification]++;
      counts.total++;
    }

    const seasonType = project.seasonType || 'ANNUAL';
    const metrics = calculateContractTermOccupancy(counts, capacity, seasonType as 'ANNUAL' | 'SEASONAL');
    
    totalNumerator += metrics.occupancy.overall.numerator;
    totalDenominator += metrics.occupancy.overall.denominator;
  }

  // Total capacity using effective capacity with dual-season multiplier (for display)
  const totalCapacity = projects.reduce((sum, p) => sum + (projectCapacityMap.get(p.id) || p.capacity || 0), 0);
  const occupancyRate = totalDenominator > 0 ? Math.min((totalNumerator / totalDenominator) * 100, 100) : 0;

  let potentialRevenue = 0;
  let economicVacancy = 0;
  
  if (occupancyRate > 0 && occupancyRate < 100) {
    potentialRevenue = totalRevenue / (occupancyRate / 100);
    economicVacancy = potentialRevenue - totalRevenue;
  } else if (occupancyRate === 0 && activeLeases.length === 0 && totalCapacity > 0) {
    const avgRentPerSlip = 1000;
    potentialRevenue = totalCapacity * avgRentPerSlip * 12;
    economicVacancy = potentialRevenue;
  } else {
    potentialRevenue = totalRevenue;
    economicVacancy = 0;
  }

  const currentYear = filters.year || new Date().getFullYear();
  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd = new Date(currentYear, 11, 31);

  const moveIns = activeLeases.filter(l => {
    if (!l.lease.leaseCommencement) return false;
    const date = new Date(l.lease.leaseCommencement);
    return date >= yearStart && date <= yearEnd;
  }).length;

  const moveOuts = leasesWithTenants.filter(l => {
    if (!l.lease.leaseExpiration || l.lease.isActive) return false;
    const date = new Date(l.lease.leaseExpiration);
    return date >= yearStart && date <= yearEnd;
  }).length;

  const avgLOA = activeLeases.length > 0
    ? activeLeases.reduce((sum, l) => {
        const size = l.tenant.boatSize ? parseFloat(l.tenant.boatSize) : 0;
        return sum + size;
      }, 0) / activeLeases.length
    : 0;

  // ============================================================================
  // CONTRACT EXPIRATION ANALYSIS
  // ============================================================================
  // Normalize today to start of day for consistent date comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Non-overlapping windows (distinct ranges)
  const expirationWindows = [
    { startDays: 0, endDays: 30, label: 'Next 30 days' },
    { startDays: 31, endDays: 60, label: '31-60 days' },
    { startDays: 61, endDays: 90, label: '61-90 days' },
    { startDays: 91, endDays: 180, label: '91-180 days' },
  ];

  const contractExpirations = expirationWindows.map(window => {
    const windowStart = new Date(today);
    windowStart.setDate(windowStart.getDate() + window.startDays);
    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + window.endDays);
    // Set end of day for windowEnd to include leases expiring on that day
    windowEnd.setHours(23, 59, 59, 999);
    
    const expiringLeases = activeLeases.filter(l => {
      if (!l.lease.leaseExpiration) return false;
      const expDate = new Date(l.lease.leaseExpiration);
      // Normalize expiration date for comparison
      expDate.setHours(12, 0, 0, 0);
      return expDate >= windowStart && expDate <= windowEnd;
    });

    return {
      window: window.label,
      count: expiringLeases.length,
      revenueAtRisk: expiringLeases.reduce((sum, l) => sum + getLeaseValue(l.lease.id), 0),
      leases: expiringLeases.slice(0, 10).map(l => ({
        tenantName: l.tenant.name || 'Unknown',
        projectName: l.project.name,
        expirationDate: l.lease.leaseExpiration!,
        leaseAmount: getLeaseValue(l.lease.id),
      })),
    };
  });

  // ============================================================================
  // TENANT LTV (LIFETIME VALUE) ANALYSIS
  // ============================================================================
  // Group all leases by tenant to calculate lifetime value
  const tenantLeaseMap = new Map<string, {
    tenantName: string;
    leases: typeof leasesWithTenants;
    totalRevenue: number;
    firstLeaseDate: Date | null;
    lastLeaseDate: Date | null;
  }>();

  for (const l of leasesWithTenants) {
    const tenantId = l.tenant.id;
    const existing = tenantLeaseMap.get(tenantId) || {
      tenantName: l.tenant.name || 'Unknown',
      leases: [],
      totalRevenue: 0,
      firstLeaseDate: null,
      lastLeaseDate: null,
    };
    
    existing.leases.push(l);
    existing.totalRevenue += getLeaseValue(l.lease.id);
    
    if (l.lease.leaseCommencement) {
      const commDate = new Date(l.lease.leaseCommencement);
      if (!existing.firstLeaseDate || commDate < existing.firstLeaseDate) {
        existing.firstLeaseDate = commDate;
      }
      if (!existing.lastLeaseDate || commDate > existing.lastLeaseDate) {
        existing.lastLeaseDate = commDate;
      }
    }
    
    tenantLeaseMap.set(tenantId, existing);
  }

  // Calculate LTV statistics
  const tenantLTVs = Array.from(tenantLeaseMap.values());
  const ltvValues = tenantLTVs.map(t => t.totalRevenue).sort((a, b) => a - b);
  const totalLTV = ltvValues.reduce((sum, v) => sum + v, 0);
  const avgLTV = tenantLTVs.length > 0 ? totalLTV / tenantLTVs.length : 0;
  const medianLTV = ltvValues.length > 0 
    ? ltvValues.length % 2 === 0 
      ? (ltvValues[ltvValues.length / 2 - 1] + ltvValues[ltvValues.length / 2]) / 2
      : ltvValues[Math.floor(ltvValues.length / 2)]
    : 0;

  // Top tenants by LTV
  const topTenants = tenantLTVs
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 10)
    .map(t => {
      let tenureMonths = 0;
      if (t.firstLeaseDate) {
        const endDate = t.lastLeaseDate || new Date();
        tenureMonths = Math.round(
          (endDate.getTime() - t.firstLeaseDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
        );
      }
      return {
        tenantName: t.tenantName,
        totalRevenue: t.totalRevenue,
        leaseCount: t.leases.length,
        tenureMonths: Math.max(tenureMonths, 1),
      };
    });

  // LTV distribution buckets
  const ltvBuckets = [
    { label: '$0-$5k', min: 0, max: 5000 },
    { label: '$5k-$25k', min: 5000, max: 25000 },
    { label: '$25k-$100k', min: 25000, max: 100000 },
    { label: '$100k+', min: 100000, max: Infinity },
  ];

  const ltvDistribution = ltvBuckets.map(bucket => {
    const tenantsInBucket = tenantLTVs.filter(
      t => t.totalRevenue >= bucket.min && t.totalRevenue < bucket.max
    );
    return {
      bucket: bucket.label,
      count: tenantsInBucket.length,
      totalRevenue: tenantsInBucket.reduce((sum, t) => sum + t.totalRevenue, 0),
    };
  });

  const tenantLTV = {
    averageLTV: avgLTV,
    medianLTV: medianLTV,
    totalLTV: totalLTV,
    topTenants,
    ltvDistribution,
  };

  // ============================================================================
  // REPEAT CUSTOMER ANALYSIS
  // ============================================================================
  const repeatTenants = tenantLTVs.filter(t => t.leases.length > 1);
  const totalCustomerCount = tenantLTVs.length;
  const repeatCustomerCount = repeatTenants.length;
  const repeatCustomerRevenue = repeatTenants.reduce((sum, t) => sum + t.totalRevenue, 0);

  const repeatCustomers = {
    repeatCustomerCount,
    totalCustomerCount,
    repeatRate: totalCustomerCount > 0 ? (repeatCustomerCount / totalCustomerCount) * 100 : 0,
    repeatCustomerRevenue,
    repeatRevenuePercentage: totalLTV > 0 ? (repeatCustomerRevenue / totalLTV) * 100 : 0,
    repeatCustomers: repeatTenants
      .sort((a, b) => b.leases.length - a.leases.length)
      .slice(0, 10)
      .map(t => ({
        tenantName: t.tenantName,
        leaseCount: t.leases.length,
        totalRevenue: t.totalRevenue,
        projects: Array.from(new Set(t.leases.map(l => l.project.name))),
      })),
  };

  const metrics: ReportMetrics = {
    totalLeases: leasesWithTenants.length,
    activeLeases: activeLeases.length,
    totalRevenue,
    averageLeaseValue: avgLeaseValue,
    occupancyRate: Math.round(occupancyRate * 10) / 10,
    occupancyNumerator: totalNumerator,
    occupancyDenominator: totalDenominator,
    economicVacancy,
    potentialRevenue,
    moveIns,
    moveOuts,
    netChange: moveIns - moveOuts,
    averageLOA: Math.round(avgLOA * 10) / 10,
    contractExpirations,
    tenantLTV,
    repeatCustomers,
  };

  const projectBreakdown: ReportProjectBreakdown[] = projects.map(p => {
    const projectLeases = activeLeases.filter(l => l.project.id === p.id);
    // Use cached lease values (V2 or legacy as appropriate)
    const revenue = projectLeases.reduce((sum, l) => {
      return sum + getLeaseValue(l.lease.id);
    }, 0);

    // Use raw capacity for occupancy calculation - calculateContractTermOccupancy handles seasonal doubling
    const rawCapacity = rawCapacityMap.get(p.id) || p.capacity || 0;
    // Use effective capacity for display (includes dual-season multiplier)
    const displayCapacity = projectCapacityMap.get(p.id) || p.capacity || 0;
    
    let occRate = 0;
    if (rawCapacity > 0) {
      const counts: ContractTermOccupancyCounts = {
        annual: 0, seasonal: 0, winter: 0, shortTerm: 0, unclassified: 0, total: 0,
      };
      for (const l of projectLeases) {
        const classification = classifyContractTerm(l.lease.contractTerm || '');
        counts[classification]++;
        counts.total++;
      }
      const seasonType = p.seasonType || 'ANNUAL';
      const m = calculateContractTermOccupancy(counts, rawCapacity, seasonType as 'ANNUAL' | 'SEASONAL');
      occRate = m.occupancy.overall.percentage;
    }

    return {
      projectId: p.id,
      projectName: p.name,
      projectType: p.projectType || 'OWNED',
      seasonType: p.seasonType || 'ANNUAL',
      capacity: displayCapacity, // Use effective capacity for display (includes dual-season multiplier)
      activeLeases: projectLeases.length,
      revenue,
      occupancyRate: occRate,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const storageTypeMap = new Map<string, { count: number; revenue: number }>();
  for (const l of activeLeases) {
    const type = l.lease.storageType || 'Unknown';
    const current = storageTypeMap.get(type) || { count: 0, revenue: 0 };
    current.count++;
    // Use cached lease values (V2 or legacy as appropriate)
    current.revenue += getLeaseValue(l.lease.id);
    storageTypeMap.set(type, current);
  }

  const storageTypeBreakdown: ReportStorageTypeBreakdown[] = Array.from(storageTypeMap.entries())
    .map(([type, data]) => ({
      storageType: type,
      leaseCount: data.count,
      revenue: data.revenue,
      percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const leaseDetails: ReportLeaseDetail[] = activeLeases.map(l => {
    // Use cached lease values (V2 or legacy as appropriate)
    const totalValue = getLeaseValue(l.lease.id);
    return {
      tenantName: l.tenant.name || 'Unknown',
      projectName: l.project.name,
      storageType: l.lease.storageType,
      unitLocation: l.lease.unitLocation,
      contractTerm: l.lease.contractTerm,
      leaseAmount: totalValue > 0 ? totalValue : null,
      rateType: l.lease.rateType,
      commencementDate: l.lease.leaseCommencement,
      expirationDate: l.lease.leaseExpiration,
      boatSize: l.tenant.boatSize ? parseFloat(l.tenant.boatSize) : null,
      isActive: l.lease.isActive ?? true,
    };
  }).sort((a, b) => (b.leaseAmount || 0) - (a.leaseAmount || 0));

  let aiNarrative: string | undefined;
  if (includeAINarrative && activeLeases.length > 0 && totalRevenue > 0) {
    try {
      aiNarrative = await generateReportNarrative(metrics, projectBreakdown, storageTypeBreakdown, filters);
    } catch (error) {
      console.error("Failed to generate AI narrative:", error);
      aiNarrative = undefined;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    filters,
    metrics,
    projectBreakdown,
    storageTypeBreakdown,
    leaseDetails,
    aiNarrative,
  };
}

function createEmptyReport(filters: ReportFilters): ReportData {
  return {
    generatedAt: new Date().toISOString(),
    filters,
    metrics: {
      totalLeases: 0,
      activeLeases: 0,
      totalRevenue: 0,
      averageLeaseValue: 0,
      occupancyRate: 0,
      occupancyNumerator: 0,
      occupancyDenominator: 0,
      economicVacancy: 0,
      potentialRevenue: 0,
      moveIns: 0,
      moveOuts: 0,
      netChange: 0,
      averageLOA: 0,
    },
    projectBreakdown: [],
    storageTypeBreakdown: [],
    leaseDetails: [],
  };
}
