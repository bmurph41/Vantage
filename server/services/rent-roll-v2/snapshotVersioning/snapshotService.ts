import { db } from "../../db";
import { 
  snapshotVersions, 
  leaseSnapshots, 
  cashFlowSnapshots,
  leases,
  tenants,
  marinaLocations,
  leaseTerms,
  type InsertSnapshotVersion,
  type SnapshotVersion,
  type InsertLeaseSnapshot,
  type InsertCashFlowSnapshot
} from "@shared/schema";
import { eq, and, desc, max, sql } from "drizzle-orm";
import { generateLeaseEconomicsCashFlows } from "../leaseEconomics/leaseEconomics.engine";

export interface CreateSnapshotOptions {
  projectId: string;
  name: string;
  description?: string;
  asOfDate: Date;
  yearsToProject?: number;
  createdBy?: string;
}

export interface SnapshotSummary {
  id: string;
  versionNumber: number;
  name: string;
  asOfDate: string;
  status: string;
  totalActiveLeases: number;
  totalMonthlyRevenue: string | null;
  createdAt: Date;
}

/**
 * Creates a new snapshot version for a project
 * Captures all lease data and cash flow projections at point in time
 */
export async function createSnapshot(options: CreateSnapshotOptions): Promise<SnapshotVersion> {
  const { projectId, name, description, asOfDate, yearsToProject = 5, createdBy } = options;

  // Get the next version number for this project
  const [maxVersionResult] = await db
    .select({ maxVersion: max(snapshotVersions.versionNumber) })
    .from(snapshotVersions)
    .where(eq(snapshotVersions.projectId, projectId));

  const nextVersion = (maxVersionResult?.maxVersion || 0) + 1;

  // Get all active leases for the project as of the given date
  const activeLeases = await db
    .select({
      lease: leases,
      tenant: tenants,
    })
    .from(leases)
    .innerJoin(tenants, eq(leases.tenantId, tenants.id))
    .where(
      and(
        eq(leases.locationId, projectId),
        eq(leases.isActive, true)
      )
    );

  // Filter leases that are active as of the asOfDate
  const asOfDateStr = asOfDate.toISOString().split('T')[0];
  const filteredLeases = activeLeases.filter(({ lease }) => {
    const commencement = lease.leaseCommencement;
    const expiration = lease.leaseExpiration || '2099-12-31';
    
    if (!commencement) return true; // Include leases without dates
    
    return commencement <= asOfDateStr && expiration >= asOfDateStr;
  });

  // Calculate summary metrics
  let totalMonthlyRevenue = 0;
  for (const { lease } of filteredLeases) {
    const amount = parseFloat(lease.leaseAmount || '0');
    totalMonthlyRevenue += amount;
  }

  // Create the snapshot version
  const [snapshotVersion] = await db
    .insert(snapshotVersions)
    .values({
      projectId,
      versionNumber: nextVersion,
      name,
      description,
      asOfDate: asOfDateStr,
      status: 'draft',
      trigger: 'manual',
      totalActiveLeases: filteredLeases.length,
      totalMonthlyRevenue: totalMonthlyRevenue.toFixed(2),
      totalAnnualRevenue: (totalMonthlyRevenue * 12).toFixed(2),
      yearsProjected: yearsToProject,
      projectionStartDate: asOfDateStr,
      projectionEndDate: new Date(asOfDate.getFullYear() + yearsToProject, asOfDate.getMonth(), asOfDate.getDate()).toISOString().split('T')[0],
      createdBy,
    } as InsertSnapshotVersion)
    .returning();

  // Create lease snapshots and cash flow snapshots
  for (const { lease, tenant } of filteredLeases) {
    // Check if lease has V2 economics
    const [hasTerms] = await db
      .select({ id: leaseTerms.id })
      .from(leaseTerms)
      .where(eq(leaseTerms.leaseId, lease.id))
      .limit(1);

    // Create lease snapshot
    const [leaseSnapshot] = await db
      .insert(leaseSnapshots)
      .values({
        snapshotVersionId: snapshotVersion.id,
        originalLeaseId: lease.id,
        tenantName: tenant.name,
        tenantBoatMake: tenant.boatMake,
        tenantBoatYear: tenant.boatYear,
        tenantBoatLength: tenant.boatLength,
        tenantBoatWidth: tenant.boatWidth,
        leaseCommencement: lease.leaseCommencement,
        leaseExpiration: lease.leaseExpiration,
        leaseAmount: lease.leaseAmount,
        baseRent2: lease.baseRent2,
        baseRent3: lease.baseRent3,
        rateType: lease.rateType,
        contractTerm: lease.contractTerm,
        storageType: lease.storageType,
        unitLocation: lease.unitLocation,
        unitNumber: lease.unitNumber,
        slipLength: lease.slipLength,
        slipWidth: lease.slipWidth,
        slipStatus: lease.slipStatus,
        monthlyRent: lease.leaseAmount,
        totalContractValue: lease.totalContractValue,
        hasDiscount: lease.hasDiscount || false,
        discountType: lease.discountType,
        discountValue: lease.discountValue,
        isActive: lease.isActive,
        isIncomplete: lease.isIncomplete,
        usesDefaultDates: lease.usesDefaultDates,
        hasV2Economics: !!hasTerms,
      } as InsertLeaseSnapshot)
      .returning();

    // Generate and store cash flows
    try {
      const endDate = new Date(asOfDate.getFullYear() + yearsToProject, asOfDate.getMonth(), asOfDate.getDate());
      const result = await generateLeaseEconomicsCashFlows(lease.id, {
        startDate: asOfDate,
        endDate: endDate,
        yearsToProject: yearsToProject,
      });

      // Insert cash flow snapshots from the periods array
      for (const cf of result.periods) {
        await db.insert(cashFlowSnapshots).values({
          snapshotVersionId: snapshotVersion.id,
          leaseSnapshotId: leaseSnapshot.id,
          year: cf.year,
          month: cf.month,
          baseRent: cf.contractBaseRent?.toFixed(2) || '0',
          escalationAmount: cf.escalationAmount?.toFixed(2) || '0',
          concessionAmount: cf.concessionsApplied?.toFixed(2) || '0',
          additionalCharges: cf.otherIncome?.toFixed(2) || '0',
          totalAmount: cf.totalRevenue.toFixed(2),
          source: result.lineage?.usedLegacyFallback ? 'legacy' : 'v2_economics',
        } as InsertCashFlowSnapshot);
      }
    } catch (error) {
      console.error(`Error generating cash flows for lease ${lease.id}:`, error);
      // Continue with next lease even if cash flow generation fails
    }
  }

  return snapshotVersion;
}

/**
 * Get all snapshots for a project
 */
export async function getProjectSnapshots(projectId: string): Promise<SnapshotSummary[]> {
  const snapshots = await db
    .select()
    .from(snapshotVersions)
    .where(eq(snapshotVersions.projectId, projectId))
    .orderBy(desc(snapshotVersions.versionNumber));

  return snapshots.map(s => ({
    id: s.id,
    versionNumber: s.versionNumber,
    name: s.name,
    asOfDate: s.asOfDate,
    status: s.status,
    totalActiveLeases: s.totalActiveLeases || 0,
    totalMonthlyRevenue: s.totalMonthlyRevenue,
    createdAt: s.createdAt,
  }));
}

/**
 * Get a single snapshot with full details
 */
export async function getSnapshotDetails(snapshotId: string) {
  const [snapshot] = await db
    .select()
    .from(snapshotVersions)
    .where(eq(snapshotVersions.id, snapshotId));

  if (!snapshot) {
    return null;
  }

  // Get all lease snapshots for this version
  const leaseSnapshotData = await db
    .select()
    .from(leaseSnapshots)
    .where(eq(leaseSnapshots.snapshotVersionId, snapshotId));

  return {
    ...snapshot,
    leases: leaseSnapshotData,
  };
}

/**
 * Get cash flows for a snapshot
 */
export async function getSnapshotCashFlows(snapshotId: string) {
  const cashFlows = await db
    .select()
    .from(cashFlowSnapshots)
    .where(eq(cashFlowSnapshots.snapshotVersionId, snapshotId))
    .orderBy(cashFlowSnapshots.year, cashFlowSnapshots.month);

  return cashFlows;
}

/**
 * Finalize a snapshot (lock it for audit trail)
 */
export async function finalizeSnapshot(snapshotId: string, userId: string): Promise<SnapshotVersion | null> {
  const [updated] = await db
    .update(snapshotVersions)
    .set({
      status: 'finalized',
      finalizedBy: userId,
      finalizedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(snapshotVersions.id, snapshotId))
    .returning();

  return updated || null;
}

/**
 * Compare two snapshots
 */
export async function compareSnapshots(baseSnapshotId: string, compareSnapshotId: string) {
  // Get lease snapshots for both versions
  const [baseLeases, compareLeases] = await Promise.all([
    db.select().from(leaseSnapshots).where(eq(leaseSnapshots.snapshotVersionId, baseSnapshotId)),
    db.select().from(leaseSnapshots).where(eq(leaseSnapshots.snapshotVersionId, compareSnapshotId)),
  ]);

  // Create maps by original lease ID
  const baseLeaseMap = new Map(baseLeases.map(l => [l.originalLeaseId, l]));
  const compareLeaseMap = new Map(compareLeases.map(l => [l.originalLeaseId, l]));

  // Find added, removed, and modified leases
  const added: string[] = [];
  const removed: string[] = [];
  const modified: Array<{ leaseId: string; changes: string[] }> = [];

  // Check for removed and modified leases
  for (const baseLease of baseLeases) {
    const compareLease = compareLeaseMap.get(baseLease.originalLeaseId);
    if (!compareLease) {
      removed.push(baseLease.originalLeaseId);
    } else {
      // Check for modifications
      const changes: string[] = [];
      if (baseLease.leaseAmount !== compareLease.leaseAmount) {
        changes.push(`Amount: ${baseLease.leaseAmount} -> ${compareLease.leaseAmount}`);
      }
      if (baseLease.leaseExpiration !== compareLease.leaseExpiration) {
        changes.push(`Expiration: ${baseLease.leaseExpiration} -> ${compareLease.leaseExpiration}`);
      }
      if (changes.length > 0) {
        modified.push({ leaseId: baseLease.originalLeaseId, changes });
      }
    }
  }

  // Check for added leases
  for (const compareLease of compareLeases) {
    if (!baseLeaseMap.has(compareLease.originalLeaseId)) {
      added.push(compareLease.originalLeaseId);
    }
  }

  // Calculate revenue change
  const baseRevenue = baseLeases.reduce((sum, l) => sum + parseFloat(l.monthlyRent || '0'), 0);
  const compareRevenue = compareLeases.reduce((sum, l) => sum + parseFloat(l.monthlyRent || '0'), 0);
  const revenueChange = compareRevenue - baseRevenue;
  const revenueChangePercent = baseRevenue > 0 ? (revenueChange / baseRevenue) * 100 : 0;

  return {
    leasesAdded: added.length,
    leasesRemoved: removed.length,
    leasesModified: modified.length,
    revenueChange: revenueChange.toFixed(2),
    revenueChangePercent: revenueChangePercent.toFixed(4),
    details: {
      added,
      removed,
      modified,
    },
  };
}

/**
 * Delete a draft snapshot
 */
export async function deleteSnapshot(snapshotId: string): Promise<boolean> {
  // Only allow deleting draft snapshots
  const [snapshot] = await db
    .select()
    .from(snapshotVersions)
    .where(eq(snapshotVersions.id, snapshotId));

  if (!snapshot || snapshot.status !== 'draft') {
    return false;
  }

  await db.delete(snapshotVersions).where(eq(snapshotVersions.id, snapshotId));
  return true;
}
