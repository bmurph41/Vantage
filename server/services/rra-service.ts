import { db } from "../db";
import { eq, and, desc, asc, sql, ilike, or, between, isNull } from "drizzle-orm";
import {
  rraMarinaLocations,
  rraStorageLocations,
  rraTenants,
  rraLeases,
  rraLeaseLineItems,
  rraContractCharges,
  rraLeaseTerms,
  rraLeaseRentSteps,
  rraLeaseEscalations,
  rraLeaseConcessions,
  rraLeaseCashFlows,
  rraMoveEvents,
  rraSnapshotVersions,
  rraLeaseSnapshots,
  rraModelingProjectLinks,
  rraDealLinks,
  rraLeaseDocumentBindings,
  rraBudgetCashFlowMap,
  marinaBudgetLineItems,
  InsertRraMarinaLocation,
  InsertRraStorageLocation,
  InsertRraTenant,
  InsertRraLease,
  InsertRraLeaseLineItem,
  InsertRraContractCharge,
  InsertRraLeaseTerm,
  InsertRraLeaseCashFlow,
  InsertRraSnapshotVersion,
  InsertRraModelingProjectLink,
  RraMarinaLocation,
  RraStorageLocation,
  RraTenant,
  RraLease,
  RraLeaseLineItem,
  RraContractCharge,
  RraLeaseCashFlow,
  RraSnapshotVersion,
} from "@shared/schema";

export interface RraLocationWithStats extends RraMarinaLocation {
  leaseCount?: number;
  totalRevenue?: number;
  occupancyRate?: number;
}

export interface RraLeaseWithDetails extends RraLease {
  tenant?: RraTenant;
  location?: RraMarinaLocation;
  lineItems?: RraLeaseLineItem[];
  contractCharges?: RraContractCharge[];
}

export interface RraDashboardMetrics {
  totalLocations: number;
  totalLeases: number;
  totalTenants: number;
  totalAnnualRevenue: number;
  averageOccupancy: number;
  expiringLeases30Days: number;
  moveInsLast30Days: number;
  moveOutsLast30Days: number;
}

export class RRAService {
  async getLocations(orgId: string): Promise<RraLocationWithStats[]> {
    const locations = await db.select()
      .from(rraMarinaLocations)
      .where(eq(rraMarinaLocations.orgId, orgId))
      .orderBy(asc(rraMarinaLocations.name));
    
    const locationsWithStats: RraLocationWithStats[] = [];
    
    for (const location of locations) {
      const leases = await db.select()
        .from(rraLeases)
        .where(and(
          eq(rraLeases.locationId, location.id),
          eq(rraLeases.isActive, true)
        ));
      
      const cashFlows = await db.select()
        .from(rraLeaseCashFlows)
        .where(eq(rraLeaseCashFlows.locationId, location.id));
      
      const totalRevenue = cashFlows.reduce((sum, cf) => 
        sum + parseFloat(cf.amount || '0'), 0);
      
      const occupancyRate = location.capacity && location.capacity > 0
        ? (leases.length / location.capacity) * 100
        : 0;
      
      locationsWithStats.push({
        ...location,
        leaseCount: leases.length,
        totalRevenue,
        occupancyRate: Math.round(occupancyRate * 100) / 100,
      });
    }
    
    return locationsWithStats;
  }

  async getLocationById(orgId: string, locationId: string): Promise<RraMarinaLocation | null> {
    const [location] = await db.select()
      .from(rraMarinaLocations)
      .where(and(
        eq(rraMarinaLocations.id, locationId),
        eq(rraMarinaLocations.orgId, orgId)
      ));
    return location || null;
  }

  async getIncludedProjects(orgId: string): Promise<{ locationId: string; name: string; projectType: string; includeInExecutive: boolean }[]> {
    const locations = await db.select({
      locationId: rraMarinaLocations.id,
      name: rraMarinaLocations.name,
      projectType: rraMarinaLocations.projectType,
      includeInExecutive: rraMarinaLocations.includeInExecutive
    })
      .from(rraMarinaLocations)
      .where(and(
        eq(rraMarinaLocations.orgId, orgId),
        eq(rraMarinaLocations.includeInExecutive, true)
      ))
      .orderBy(asc(rraMarinaLocations.name));
    
    return locations;
  }

  async createLocation(data: InsertRraMarinaLocation): Promise<RraMarinaLocation> {
    const [location] = await db.insert(rraMarinaLocations)
      .values(data)
      .returning();
    return location;
  }

  async updateLocation(orgId: string, locationId: string, data: Partial<InsertRraMarinaLocation>): Promise<RraMarinaLocation | null> {
    const [location] = await db.update(rraMarinaLocations)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(rraMarinaLocations.id, locationId),
        eq(rraMarinaLocations.orgId, orgId)
      ))
      .returning();
    return location || null;
  }

  async deleteLocation(orgId: string, locationId: string): Promise<boolean> {
    // SECURITY: First verify the location belongs to the caller's organization
    const [location] = await db.select()
      .from(rraMarinaLocations)
      .where(and(
        eq(rraMarinaLocations.id, locationId),
        eq(rraMarinaLocations.orgId, orgId)
      ));
    
    if (!location) {
      throw new Error('Location not found or access denied');
    }
    
    // Cascade delete all related data before deleting the location
    // Delete in order of dependencies (children first)
    
    // 1. Delete budget cash flow mappings for this location's cash flows
    const cashFlows = await db.select({ id: rraLeaseCashFlows.id })
      .from(rraLeaseCashFlows)
      .where(and(
        eq(rraLeaseCashFlows.locationId, locationId),
        eq(rraLeaseCashFlows.orgId, orgId)
      ));
    
    if (cashFlows.length > 0) {
      const cashFlowIds = cashFlows.map(cf => cf.id);
      for (const cfId of cashFlowIds) {
        await db.delete(rraBudgetCashFlowMap)
          .where(eq(rraBudgetCashFlowMap.rraCashFlowId, cfId));
      }
    }
    
    // 2. Delete lease cash flows
    await db.delete(rraLeaseCashFlows)
      .where(eq(rraLeaseCashFlows.locationId, locationId));
    
    // 3. Delete move events
    await db.delete(rraMoveEvents)
      .where(eq(rraMoveEvents.locationId, locationId));
    
    // 4. Delete snapshot versions and lease snapshots
    const snapshots = await db.select({ id: rraSnapshotVersions.id })
      .from(rraSnapshotVersions)
      .where(eq(rraSnapshotVersions.locationId, locationId));
    
    if (snapshots.length > 0) {
      const snapshotIds = snapshots.map(s => s.id);
      for (const snapId of snapshotIds) {
        await db.delete(rraLeaseSnapshots)
          .where(eq(rraLeaseSnapshots.snapshotId, snapId));
      }
    }
    
    await db.delete(rraSnapshotVersions)
      .where(eq(rraSnapshotVersions.locationId, locationId));
    
    // 5. Get all leases for this location to delete their children
    const leases = await db.select({ id: rraLeases.id })
      .from(rraLeases)
      .where(eq(rraLeases.locationId, locationId));
    
    if (leases.length > 0) {
      const leaseIds = leases.map(l => l.id);
      for (const leaseId of leaseIds) {
        // Delete lease line items
        await db.delete(rraLeaseLineItems)
          .where(eq(rraLeaseLineItems.leaseId, leaseId));
        
        // Delete contract charges
        await db.delete(rraContractCharges)
          .where(eq(rraContractCharges.leaseId, leaseId));
        
        // Delete lease terms
        await db.delete(rraLeaseTerms)
          .where(eq(rraLeaseTerms.leaseId, leaseId));
        
        // Delete lease rent steps
        await db.delete(rraLeaseRentSteps)
          .where(eq(rraLeaseRentSteps.leaseId, leaseId));
        
        // Delete lease escalations
        await db.delete(rraLeaseEscalations)
          .where(eq(rraLeaseEscalations.leaseId, leaseId));
        
        // Delete lease concessions
        await db.delete(rraLeaseConcessions)
          .where(eq(rraLeaseConcessions.leaseId, leaseId));
        
        // Delete lease document bindings
        await db.delete(rraLeaseDocumentBindings)
          .where(eq(rraLeaseDocumentBindings.leaseId, leaseId));
      }
    }
    
    // 6. Delete leases
    await db.delete(rraLeases)
      .where(eq(rraLeases.locationId, locationId));
    
    // 7. Delete storage locations
    await db.delete(rraStorageLocations)
      .where(eq(rraStorageLocations.projectId, locationId));
    
    // 8. Delete modeling project links
    await db.delete(rraModelingProjectLinks)
      .where(eq(rraModelingProjectLinks.rraLocationId, locationId));
    
    // 9. Delete deal links
    await db.delete(rraDealLinks)
      .where(eq(rraDealLinks.rraLocationId, locationId));
    
    // 10. Finally delete the location itself
    await db.delete(rraMarinaLocations)
      .where(and(
        eq(rraMarinaLocations.id, locationId),
        eq(rraMarinaLocations.orgId, orgId)
      ));
    
    return true;
  }

  async getStorageLocations(projectId: string): Promise<RraStorageLocation[]> {
    return db.select()
      .from(rraStorageLocations)
      .where(eq(rraStorageLocations.projectId, projectId))
      .orderBy(asc(rraStorageLocations.name));
  }

  async getStorageLocationById(id: string): Promise<RraStorageLocation | null> {
    const [location] = await db.select()
      .from(rraStorageLocations)
      .where(eq(rraStorageLocations.id, id));
    return location || null;
  }

  async createStorageLocation(data: InsertRraStorageLocation): Promise<RraStorageLocation> {
    const [location] = await db.insert(rraStorageLocations)
      .values(data)
      .returning();
    return location;
  }

  async updateStorageLocation(id: string, data: Partial<InsertRraStorageLocation>): Promise<RraStorageLocation | null> {
    const [location] = await db.update(rraStorageLocations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rraStorageLocations.id, id))
      .returning();
    return location || null;
  }

  async deleteStorageLocation(id: string): Promise<boolean> {
    await db.delete(rraStorageLocations)
      .where(eq(rraStorageLocations.id, id));
    return true;
  }

  async getTenants(orgId: string, search?: string): Promise<RraTenant[]> {
    let query = db.select()
      .from(rraTenants)
      .where(eq(rraTenants.orgId, orgId));
    
    if (search) {
      query = db.select()
        .from(rraTenants)
        .where(and(
          eq(rraTenants.orgId, orgId),
          or(
            ilike(rraTenants.name, `%${search}%`),
            ilike(rraTenants.email, `%${search}%`)
          )
        ));
    }
    
    return query.orderBy(asc(rraTenants.name));
  }

  async getTenantById(orgId: string, tenantId: string): Promise<RraTenant | null> {
    const [tenant] = await db.select()
      .from(rraTenants)
      .where(and(
        eq(rraTenants.id, tenantId),
        eq(rraTenants.orgId, orgId)
      ));
    return tenant || null;
  }

  async createTenant(data: InsertRraTenant): Promise<RraTenant> {
    const [tenant] = await db.insert(rraTenants)
      .values(data)
      .returning();
    return tenant;
  }

  async updateTenant(orgId: string, tenantId: string, data: Partial<InsertRraTenant>): Promise<RraTenant | null> {
    const [tenant] = await db.update(rraTenants)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(rraTenants.id, tenantId),
        eq(rraTenants.orgId, orgId)
      ))
      .returning();
    return tenant || null;
  }

  async deleteTenant(orgId: string, tenantId: string): Promise<boolean> {
    await db.delete(rraTenants)
      .where(and(
        eq(rraTenants.id, tenantId),
        eq(rraTenants.orgId, orgId)
      ));
    return true;
  }

  async getLeases(orgId: string, filters?: {
    locationId?: string;
    tenantId?: string;
    isActive?: boolean;
    storageType?: string;
  }): Promise<RraLeaseWithDetails[]> {
    let conditions = [eq(rraLeases.orgId, orgId)];
    
    if (filters?.locationId) {
      conditions.push(eq(rraLeases.locationId, filters.locationId));
    }
    if (filters?.tenantId) {
      conditions.push(eq(rraLeases.tenantId, filters.tenantId));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(rraLeases.isActive, filters.isActive));
    }
    
    const leases = await db.select()
      .from(rraLeases)
      .where(and(...conditions))
      .orderBy(desc(rraLeases.createdAt));
    
    const leasesWithDetails: RraLeaseWithDetails[] = [];
    
    for (const lease of leases) {
      const [tenant] = await db.select()
        .from(rraTenants)
        .where(eq(rraTenants.id, lease.tenantId));
      
      let location: RraMarinaLocation | undefined;
      if (lease.locationId) {
        const [loc] = await db.select()
          .from(rraMarinaLocations)
          .where(eq(rraMarinaLocations.id, lease.locationId));
        location = loc;
      }
      
      const lineItems = await db.select()
        .from(rraLeaseLineItems)
        .where(eq(rraLeaseLineItems.leaseId, lease.id));
      
      const contractCharges = await db.select()
        .from(rraContractCharges)
        .where(eq(rraContractCharges.leaseId, lease.id));
      
      leasesWithDetails.push({
        ...lease,
        tenant,
        location,
        lineItems,
        contractCharges,
      });
    }
    
    return leasesWithDetails;
  }

  async getLeaseById(orgId: string, leaseId: string): Promise<RraLeaseWithDetails | null> {
    const [lease] = await db.select()
      .from(rraLeases)
      .where(and(
        eq(rraLeases.id, leaseId),
        eq(rraLeases.orgId, orgId)
      ));
    
    if (!lease) return null;
    
    const [tenant] = await db.select()
      .from(rraTenants)
      .where(eq(rraTenants.id, lease.tenantId));
    
    let location: RraMarinaLocation | undefined;
    if (lease.locationId) {
      const [loc] = await db.select()
        .from(rraMarinaLocations)
        .where(eq(rraMarinaLocations.id, lease.locationId));
      location = loc;
    }
    
    const lineItems = await db.select()
      .from(rraLeaseLineItems)
      .where(eq(rraLeaseLineItems.leaseId, lease.id));
    
    const contractCharges = await db.select()
      .from(rraContractCharges)
      .where(eq(rraContractCharges.leaseId, lease.id));
    
    return {
      ...lease,
      tenant,
      location,
      lineItems,
      contractCharges,
    };
  }

  async createLease(data: InsertRraLease): Promise<RraLease> {
    const [lease] = await db.insert(rraLeases)
      .values(data)
      .returning();
    return lease;
  }

  async updateLease(orgId: string, leaseId: string, data: Partial<InsertRraLease>): Promise<RraLease | null> {
    const [lease] = await db.update(rraLeases)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(rraLeases.id, leaseId),
        eq(rraLeases.orgId, orgId)
      ))
      .returning();
    return lease || null;
  }

  async deleteLease(orgId: string, leaseId: string): Promise<boolean> {
    await db.delete(rraLeases)
      .where(and(
        eq(rraLeases.id, leaseId),
        eq(rraLeases.orgId, orgId)
      ));
    return true;
  }

  async createLeaseLineItem(data: InsertRraLeaseLineItem): Promise<RraLeaseLineItem> {
    const [item] = await db.insert(rraLeaseLineItems)
      .values(data)
      .returning();
    return item;
  }

  async updateLeaseLineItem(id: string, data: Partial<InsertRraLeaseLineItem>): Promise<RraLeaseLineItem | null> {
    const [item] = await db.update(rraLeaseLineItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rraLeaseLineItems.id, id))
      .returning();
    return item || null;
  }

  async deleteLeaseLineItem(id: string): Promise<boolean> {
    await db.delete(rraLeaseLineItems)
      .where(eq(rraLeaseLineItems.id, id));
    return true;
  }

  async createContractCharge(data: InsertRraContractCharge): Promise<RraContractCharge> {
    const [charge] = await db.insert(rraContractCharges)
      .values(data)
      .returning();
    return charge;
  }

  async updateContractCharge(id: string, data: Partial<InsertRraContractCharge>): Promise<RraContractCharge | null> {
    const [charge] = await db.update(rraContractCharges)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rraContractCharges.id, id))
      .returning();
    return charge || null;
  }

  async deleteContractCharge(id: string): Promise<boolean> {
    await db.delete(rraContractCharges)
      .where(eq(rraContractCharges.id, id));
    return true;
  }

  async getCashFlows(orgId: string, filters?: {
    locationId?: string;
    leaseId?: string;
    year?: number;
    month?: number;
    isProjected?: boolean;
  }): Promise<RraLeaseCashFlow[]> {
    let conditions = [eq(rraLeaseCashFlows.orgId, orgId)];
    
    if (filters?.locationId) {
      conditions.push(eq(rraLeaseCashFlows.locationId, filters.locationId));
    }
    if (filters?.leaseId) {
      conditions.push(eq(rraLeaseCashFlows.leaseId, filters.leaseId));
    }
    if (filters?.year) {
      conditions.push(eq(rraLeaseCashFlows.year, filters.year));
    }
    if (filters?.month) {
      conditions.push(eq(rraLeaseCashFlows.month, filters.month));
    }
    if (filters?.isProjected !== undefined) {
      conditions.push(eq(rraLeaseCashFlows.isProjected, filters.isProjected));
    }
    
    return db.select()
      .from(rraLeaseCashFlows)
      .where(and(...conditions))
      .orderBy(asc(rraLeaseCashFlows.year), asc(rraLeaseCashFlows.month));
  }

  async createCashFlow(data: InsertRraLeaseCashFlow): Promise<RraLeaseCashFlow> {
    const [cashFlow] = await db.insert(rraLeaseCashFlows)
      .values(data)
      .returning();
    return cashFlow;
  }

  async getSnapshotVersions(orgId: string, locationId?: string): Promise<RraSnapshotVersion[]> {
    let conditions = [eq(rraSnapshotVersions.orgId, orgId)];
    
    if (locationId) {
      conditions.push(eq(rraSnapshotVersions.locationId, locationId));
    }
    
    return db.select()
      .from(rraSnapshotVersions)
      .where(and(...conditions))
      .orderBy(desc(rraSnapshotVersions.versionNumber));
  }

  async createSnapshotVersion(data: InsertRraSnapshotVersion): Promise<RraSnapshotVersion> {
    const [existingVersions] = await db.select({ maxVersion: sql<number>`COALESCE(MAX(version_number), 0)` })
      .from(rraSnapshotVersions)
      .where(eq(rraSnapshotVersions.locationId, data.locationId));
    
    const nextVersion = (existingVersions?.maxVersion || 0) + 1;
    
    const [snapshot] = await db.insert(rraSnapshotVersions)
      .values({ ...data, versionNumber: nextVersion })
      .returning();
    return snapshot;
  }

  async publishSnapshot(orgId: string, snapshotId: string, userId: string): Promise<RraSnapshotVersion | null> {
    const [snapshot] = await db.update(rraSnapshotVersions)
      .set({
        status: 'published',
        publishedAt: new Date(),
        publishedBy: userId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(rraSnapshotVersions.id, snapshotId),
        eq(rraSnapshotVersions.orgId, orgId)
      ))
      .returning();
    return snapshot || null;
  }

  async getDashboardMetrics(orgId: string): Promise<RraDashboardMetrics> {
    const locations = await db.select()
      .from(rraMarinaLocations)
      .where(and(
        eq(rraMarinaLocations.orgId, orgId),
        eq(rraMarinaLocations.isActive, true)
      ));
    
    const leases = await db.select()
      .from(rraLeases)
      .where(and(
        eq(rraLeases.orgId, orgId),
        eq(rraLeases.isActive, true)
      ));
    
    const tenants = await db.select()
      .from(rraTenants)
      .where(eq(rraTenants.orgId, orgId));
    
    const currentYear = new Date().getFullYear();
    const cashFlows = await db.select()
      .from(rraLeaseCashFlows)
      .where(and(
        eq(rraLeaseCashFlows.orgId, orgId),
        eq(rraLeaseCashFlows.year, currentYear)
      ));
    
    const totalAnnualRevenue = cashFlows.reduce((sum, cf) => 
      sum + parseFloat(cf.amount || '0'), 0);
    
    const totalCapacity = locations.reduce((sum, loc) => 
      sum + (loc.capacity || 0), 0);
    const averageOccupancy = totalCapacity > 0 
      ? (leases.length / totalCapacity) * 100 
      : 0;
    
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiringLeases = leases.filter(l => {
      if (!l.leaseExpiration) return false;
      const expDate = new Date(l.leaseExpiration);
      return expDate <= thirtyDaysFromNow && expDate >= new Date();
    });
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const moveEvents = await db.select()
      .from(rraMoveEvents)
      .where(and(
        eq(rraMoveEvents.orgId, orgId),
        sql`${rraMoveEvents.eventDate} >= ${thirtyDaysAgo.toISOString().split('T')[0]}`
      ));
    
    const moveIns = moveEvents.filter(e => e.direction === 'IN').length;
    const moveOuts = moveEvents.filter(e => e.direction === 'OUT').length;
    
    return {
      totalLocations: locations.length,
      totalLeases: leases.length,
      totalTenants: tenants.length,
      totalAnnualRevenue,
      averageOccupancy: Math.round(averageOccupancy * 100) / 100,
      expiringLeases30Days: expiringLeases.length,
      moveInsLast30Days: moveIns,
      moveOutsLast30Days: moveOuts,
    };
  }

  async linkToModelingProject(data: InsertRraModelingProjectLink): Promise<void> {
    await db.insert(rraModelingProjectLinks)
      .values(data)
      .onConflictDoNothing();
  }

  async unlinkFromModelingProject(rraLocationId: string, modelingProjectId: string): Promise<void> {
    await db.delete(rraModelingProjectLinks)
      .where(and(
        eq(rraModelingProjectLinks.rraLocationId, rraLocationId),
        eq(rraModelingProjectLinks.modelingProjectId, modelingProjectId)
      ));
  }

  async getLinkedModelingProjects(rraLocationId: string): Promise<any[]> {
    return db.select()
      .from(rraModelingProjectLinks)
      .where(eq(rraModelingProjectLinks.rraLocationId, rraLocationId));
  }

  async getLocationsByModelingProject(modelingProjectId: string): Promise<RraMarinaLocation[]> {
    const links = await db.select()
      .from(rraModelingProjectLinks)
      .where(eq(rraModelingProjectLinks.modelingProjectId, modelingProjectId));
    
    if (links.length === 0) return [];
    
    const locationIds = links.map(l => l.rraLocationId);
    return db.select()
      .from(rraMarinaLocations)
      .where(sql`${rraMarinaLocations.id} IN (${sql.join(locationIds.map(id => sql`${id}`), sql`, `)})`);
  }

  async mapCashFlowToBudget(
    orgId: string,
    cashFlowId: string,
    budgetLineItemId: string,
    syncType: string = 'auto'
  ): Promise<void> {
    await db.insert(rraBudgetCashFlowMap)
      .values({
        orgId,
        rraCashFlowId: cashFlowId,
        budgetLineItemId,
        syncType,
      })
      .onConflictDoNothing();
  }

  async unmapCashFlowFromBudget(cashFlowId: string, budgetLineItemId: string): Promise<void> {
    await db.delete(rraBudgetCashFlowMap)
      .where(and(
        eq(rraBudgetCashFlowMap.rraCashFlowId, cashFlowId),
        eq(rraBudgetCashFlowMap.budgetLineItemId, budgetLineItemId)
      ));
  }

  async getCashFlowBudgetMappings(cashFlowId: string): Promise<any[]> {
    return db.select()
      .from(rraBudgetCashFlowMap)
      .where(eq(rraBudgetCashFlowMap.rraCashFlowId, cashFlowId));
  }

  async getBudgetLineItemCashFlows(budgetLineItemId: string): Promise<any[]> {
    return db.select()
      .from(rraBudgetCashFlowMap)
      .where(eq(rraBudgetCashFlowMap.budgetLineItemId, budgetLineItemId));
  }

  async syncCashFlowsToBudget(
    orgId: string,
    locationId: string,
    budgetId: string,
    fiscalYear: number
  ): Promise<{ synced: number; skipped: number; errors: string[] }> {
    const errors: string[] = [];
    let synced = 0;
    let skipped = 0;
    
    const cashFlows = await db.select()
      .from(rraLeaseCashFlows)
      .innerJoin(rraLeaseLineItems, eq(rraLeaseCashFlows.lineItemId, rraLeaseLineItems.id))
      .innerJoin(rraLeases, eq(rraLeaseLineItems.leaseId, rraLeases.id))
      .where(and(
        eq(rraLeases.projectId, locationId),
        eq(rraLeaseCashFlows.fiscalYear, fiscalYear)
      ));
    
    const budgetLineItems = await db.select()
      .from(marinaBudgetLineItems)
      .where(eq(marinaBudgetLineItems.budgetId, budgetId));
    
    if (budgetLineItems.length === 0) {
      return { synced: 0, skipped: cashFlows.length, errors: ['No budget line items found for budgetId: ' + budgetId] };
    }
    
    const rentalIncomeLineItem = budgetLineItems.find(li => li.category === 'storage_revenue');
    
    for (const cf of cashFlows) {
      try {
        if (rentalIncomeLineItem) {
          await this.mapCashFlowToBudget(
            orgId,
            cf.rra_lease_cash_flows.id,
            rentalIncomeLineItem.id,
            'auto'
          );
          synced++;
        } else {
          skipped++;
        }
      } catch (error) {
        errors.push(`Failed to sync cash flow ${cf.rra_lease_cash_flows.id}: ${error}`);
      }
    }
    
    return { synced, skipped, errors };
  }

  // ============================================================================
  // MODELING PROJECT LINKS
  // ============================================================================

  async getModelingProjectLinks(orgId: string, rraLocationId?: string, modelingProjectId?: string): Promise<any[]> {
    let query = db.select()
      .from(rraModelingProjectLinks)
      .where(eq(rraModelingProjectLinks.orgId, orgId));
    
    if (rraLocationId) {
      query = query.where(and(
        eq(rraModelingProjectLinks.orgId, orgId),
        eq(rraModelingProjectLinks.rraLocationId, rraLocationId)
      )) as any;
    }
    
    if (modelingProjectId) {
      query = query.where(and(
        eq(rraModelingProjectLinks.orgId, orgId),
        eq(rraModelingProjectLinks.modelingProjectId, modelingProjectId)
      )) as any;
    }
    
    return query;
  }

  async getLinkedRraLocations(orgId: string, modelingProjectId: string): Promise<RraLocationWithStats[]> {
    const links = await db.select()
      .from(rraModelingProjectLinks)
      .innerJoin(rraMarinaLocations, eq(rraModelingProjectLinks.rraLocationId, rraMarinaLocations.id))
      .where(and(
        eq(rraModelingProjectLinks.orgId, orgId),
        eq(rraModelingProjectLinks.modelingProjectId, modelingProjectId)
      ));
    
    return links.map(link => ({
      ...link.rra_marina_locations,
      isPrimary: link.rra_modeling_project_links.isPrimary,
      syncEnabled: link.rra_modeling_project_links.syncEnabled,
      lastSyncAt: link.rra_modeling_project_links.lastSyncAt,
      linkId: link.rra_modeling_project_links.id,
    })) as any;
  }

  async getLinkedModelingProjects(orgId: string, rraLocationId: string): Promise<any[]> {
    const links = await db.select()
      .from(rraModelingProjectLinks)
      .where(and(
        eq(rraModelingProjectLinks.orgId, orgId),
        eq(rraModelingProjectLinks.rraLocationId, rraLocationId)
      ));
    
    return links;
  }

  async createModelingProjectLink(
    orgId: string,
    rraLocationId: string,
    modelingProjectId: string,
    options?: { isPrimary?: boolean; syncEnabled?: boolean }
  ): Promise<any> {
    const [link] = await db.insert(rraModelingProjectLinks)
      .values({
        orgId,
        rraLocationId,
        modelingProjectId,
        isPrimary: options?.isPrimary ?? false,
        syncEnabled: options?.syncEnabled ?? true,
      })
      .returning();
    return link;
  }

  async updateModelingProjectLink(
    linkId: string,
    updates: { isPrimary?: boolean; syncEnabled?: boolean; lastSyncAt?: Date }
  ): Promise<any> {
    const [updated] = await db.update(rraModelingProjectLinks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(rraModelingProjectLinks.id, linkId))
      .returning();
    return updated;
  }

  async deleteModelingProjectLink(linkId: string): Promise<void> {
    await db.delete(rraModelingProjectLinks)
      .where(eq(rraModelingProjectLinks.id, linkId));
  }

  async getRraMetricsForModeling(orgId: string, rraLocationId: string): Promise<{
    occupancyRate: number;
    totalUnits: number;
    occupiedUnits: number;
    totalAnnualRevenue: number;
    averageRentPerUnit: number;
    activeLeaseCount: number;
    expiringLeases90Days: number;
    cashFlowByMonth: { month: string; amount: number }[];
  }> {
    const location = await this.getLocation(orgId, rraLocationId);
    const leases = await db.select()
      .from(rraLeases)
      .where(and(
        eq(rraLeases.projectId, rraLocationId),
        eq(rraLeases.status, 'active')
      ));
    
    const totalUnits = location?.capacity || location?.totalUnits || 0;
    const occupiedUnits = leases.length;
    const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;
    
    let totalAnnualRevenue = 0;
    for (const lease of leases) {
      totalAnnualRevenue += parseFloat(String(lease.annualRent || 0));
    }
    
    const averageRentPerUnit = occupiedUnits > 0 ? totalAnnualRevenue / occupiedUnits : 0;
    
    const now = new Date();
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    
    const expiringLeases90Days = leases.filter(l => {
      if (!l.endDate) return false;
      const endDate = new Date(l.endDate);
      return endDate > now && endDate <= ninetyDaysFromNow;
    }).length;
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const cashFlowByMonth = months.map((month, idx) => ({
      month,
      amount: Math.round(totalAnnualRevenue / 12),
    }));
    
    return {
      occupancyRate,
      totalUnits,
      occupiedUnits,
      totalAnnualRevenue,
      averageRentPerUnit,
      activeLeaseCount: leases.length,
      expiringLeases90Days,
      cashFlowByMonth,
    };
  }

  async syncRraToModeling(orgId: string, linkId: string): Promise<{ success: boolean; syncedFields: string[] }> {
    const [link] = await db.select()
      .from(rraModelingProjectLinks)
      .where(eq(rraModelingProjectLinks.id, linkId));
    
    if (!link) {
      throw new Error('Link not found');
    }
    
    const metrics = await this.getRraMetricsForModeling(orgId, link.rraLocationId);
    
    await db.update(rraModelingProjectLinks)
      .set({ lastSyncAt: new Date(), updatedAt: new Date() })
      .where(eq(rraModelingProjectLinks.id, linkId));
    
    return {
      success: true,
      syncedFields: ['occupancyRate', 'totalUnits', 'occupiedUnits', 'totalAnnualRevenue', 'averageRentPerUnit'],
    };
  }

  async getProjectHubMetrics(orgId: string): Promise<any[]> {
    const locations = await db.select()
      .from(rraMarinaLocations)
      .where(eq(rraMarinaLocations.orgId, orgId))
      .orderBy(asc(rraMarinaLocations.name));

    const results = [];
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    for (const location of locations) {
      const allLeases = await db.select()
        .from(rraLeases)
        .where(eq(rraLeases.locationId, location.id));
      
      const activeLeases = allLeases.filter(l => l.isActive);
      
      const currentMonthCashFlows = await db.select()
        .from(rraLeaseCashFlows)
        .where(and(
          eq(rraLeaseCashFlows.locationId, location.id),
          eq(rraLeaseCashFlows.year, now.getFullYear()),
          eq(rraLeaseCashFlows.month, now.getMonth() + 1)
        ));
      
      const monthlyRevenue = currentMonthCashFlows.reduce((sum, cf) => 
        sum + parseFloat(cf.amount || '0'), 0);
      
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      const currentPeriod = now.getFullYear() * 12 + (now.getMonth() + 1);
      const startPeriod = twelveMonthsAgo.getFullYear() * 12 + (twelveMonthsAgo.getMonth() + 1);
      const trailing12CashFlows = await db.select()
        .from(rraLeaseCashFlows)
        .where(and(
          eq(rraLeaseCashFlows.locationId, location.id),
          sql`(${rraLeaseCashFlows.year} * 12 + ${rraLeaseCashFlows.month}) >= ${startPeriod}`,
          sql`(${rraLeaseCashFlows.year} * 12 + ${rraLeaseCashFlows.month}) <= ${currentPeriod}`
        ));
      
      const trailing12MonthRevenue = trailing12CashFlows.reduce((sum, cf) => 
        sum + parseFloat(cf.amount || '0'), 0);
      
      const expiringLeases = activeLeases.filter(l => {
        if (!l.leaseExpiration) return false;
        const expDate = new Date(l.leaseExpiration);
        return expDate >= now && expDate <= thirtyDaysFromNow;
      });
      
      const upcomingExpirations = expiringLeases.length;
      const nextExpirationDate = activeLeases
        .filter(l => l.leaseExpiration && new Date(l.leaseExpiration) >= now)
        .sort((a, b) => new Date(a.leaseExpiration!).getTime() - new Date(b.leaseExpiration!).getTime())[0]?.leaseExpiration || null;
      
      const capacity = location.capacity || 0;
      const occupancyRate = capacity > 0 ? activeLeases.length / capacity : 0;

      results.push({
        locationId: location.id,
        name: location.name,
        code: location.code || null,
        description: location.description || null,
        projectType: location.projectType,
        status: location.status || null,
        targetNOI: location.targetNOI || null,
        capacity: location.capacity || null,
        activeLeaseCount: activeLeases.length,
        totalLeaseCount: allLeases.length,
        occupancyRate,
        monthlyRevenue: monthlyRevenue.toFixed(2),
        trailing12MonthRevenue: trailing12MonthRevenue.toFixed(2),
        nextExpirationDate: nextExpirationDate ? new Date(nextExpirationDate).toISOString().split('T')[0] : null,
        upcomingExpirations,
        includeInExecutive: location.includeInExecutive,
      });
    }

    return results;
  }
}

export const rraService = new RRAService();
