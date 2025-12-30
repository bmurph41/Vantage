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
    const result = await db.delete(rraMarinaLocations)
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
}

export const rraService = new RRAService();
