import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { z } from "zod";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import {
  modelingRentRollUnits,
  modelingRentRollConfig,
  insertModelingRentRollUnitSchema,
  updateModelingRentRollUnitSchema,
  insertModelingRentRollConfigSchema,
  updateModelingRentRollConfigSchema,
  modelingProjects,
  rraLeases,
  rraTenants,
  rraMarinaLocations,
} from "@shared/schema";
import { AuthenticatedRequest } from "../middleware/auth-resolver";

const router = Router();

function getOrgId(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  if (authReq.validatedOrgId) {
    return authReq.validatedOrgId;
  }
  return (req as any).tenantId || (req as any).user?.orgId || (req as any).session?.orgId || 'org-1';
}

function getUserId(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  if (authReq.validatedUserId) {
    return authReq.validatedUserId;
  }
  return (req as any).session?.userId || (req as any).user?.id || 'user-1';
}

// Get config for a modeling project
router.get("/projects/:projectId/config", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;

    const project = await db.query.modelingProjects.findFirst({
      where: and(
        eq(modelingProjects.orgId, orgId),
        eq(modelingProjects.id, projectId)
      ),
    });

    if (!project) {
      return res.status(404).json({ error: "Modeling project not found" });
    }

    let config = await db.query.modelingRentRollConfig.findFirst({
      where: and(
        eq(modelingRentRollConfig.orgId, orgId),
        eq(modelingRentRollConfig.modelingProjectId, projectId)
      ),
    });

    if (!config) {
      const [newConfig] = await db.insert(modelingRentRollConfig).values({
        orgId,
        modelingProjectId: projectId,
        dataSourceMode: "standalone",
      }).returning();
      config = newConfig;
    }

    res.json(config);
  } catch (error) {
    next(error);
  }
});

// Update config for a modeling project
router.patch("/projects/:projectId/config", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;
    const updates = updateModelingRentRollConfigSchema.parse(req.body);

    let existing = await db.query.modelingRentRollConfig.findFirst({
      where: and(
        eq(modelingRentRollConfig.orgId, orgId),
        eq(modelingRentRollConfig.modelingProjectId, projectId)
      ),
    });

    if (!existing) {
      const [newConfig] = await db.insert(modelingRentRollConfig).values({
        orgId,
        modelingProjectId: projectId,
        ...updates,
      }).returning();
      return res.json(newConfig);
    }

    const [updated] = await db
      .update(modelingRentRollConfig)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(modelingRentRollConfig.id, existing.id))
      .returning();

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Get all units for a modeling project
router.get("/projects/:projectId/units", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;

    const units = await db.query.modelingRentRollUnits.findMany({
      where: and(
        eq(modelingRentRollUnits.orgId, orgId),
        eq(modelingRentRollUnits.modelingProjectId, projectId)
      ),
      orderBy: [asc(modelingRentRollUnits.unitNumber)],
    });

    res.json(units);
  } catch (error) {
    next(error);
  }
});

// Get metrics for a modeling project's rent roll (for modeling assumptions)
router.get("/projects/:projectId/metrics", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;

    const config = await db.query.modelingRentRollConfig.findFirst({
      where: and(
        eq(modelingRentRollConfig.orgId, orgId),
        eq(modelingRentRollConfig.modelingProjectId, projectId)
      ),
    });

    const units = await db.query.modelingRentRollUnits.findMany({
      where: and(
        eq(modelingRentRollUnits.orgId, orgId),
        eq(modelingRentRollUnits.modelingProjectId, projectId)
      ),
    });

    const totalUnits = units.length;
    const occupiedUnits = units.filter(u => u.status === 'occupied').length;
    const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

    const totalMonthlyRent = units.reduce((sum, u) => {
      return sum + parseFloat(u.monthlyRent || '0');
    }, 0);
    const totalAnnualRevenue = totalMonthlyRent * 12;
    const averageRentPerUnit = totalUnits > 0 ? totalMonthlyRent / totalUnits : 0;

    const activeLeaseCount = units.filter(u => u.status === 'occupied').length;

    const now = new Date();
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const expiringLeases90Days = units.filter(u => {
      if (!u.leaseEndDate || u.isMonthToMonth) return false;
      const endDate = new Date(u.leaseEndDate);
      return endDate >= now && endDate <= ninetyDaysFromNow;
    }).length;

    const unitsByType: Record<string, { count: number; totalRent: number }> = {};
    units.forEach(u => {
      const type = u.storageType || 'Other';
      if (!unitsByType[type]) {
        unitsByType[type] = { count: 0, totalRent: 0 };
      }
      unitsByType[type].count += 1;
      unitsByType[type].totalRent += parseFloat(u.monthlyRent || '0');
    });

    res.json({
      dataSourceMode: config?.dataSourceMode || 'standalone',
      occupancyRate,
      totalUnits,
      occupiedUnits,
      totalAnnualRevenue,
      totalMonthlyRevenue: totalMonthlyRent,
      averageRentPerUnit,
      activeLeaseCount,
      expiringLeases90Days,
      unitsByType,
      assumedOccupancyRate: parseFloat(config?.assumedOccupancyRate || '90'),
      assumedAnnualRentGrowth: parseFloat(config?.assumedAnnualRentGrowth || '3'),
    });
  } catch (error) {
    next(error);
  }
});

// Create a new unit
router.post("/projects/:projectId/units", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const { projectId } = req.params;

    const project = await db.query.modelingProjects.findFirst({
      where: and(
        eq(modelingProjects.orgId, orgId),
        eq(modelingProjects.id, projectId)
      ),
    });

    if (!project) {
      return res.status(404).json({ error: "Modeling project not found" });
    }

    const data = insertModelingRentRollUnitSchema.parse({
      ...req.body,
      orgId,
      modelingProjectId: projectId,
      createdBy: userId,
    });

    const [unit] = await db.insert(modelingRentRollUnits).values(data).returning();

    res.status(201).json(unit);
  } catch (error) {
    next(error);
  }
});

// Update a unit
router.patch("/projects/:projectId/units/:unitId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { projectId, unitId } = req.params;
    const updates = updateModelingRentRollUnitSchema.parse(req.body);

    const existing = await db.query.modelingRentRollUnits.findFirst({
      where: and(
        eq(modelingRentRollUnits.orgId, orgId),
        eq(modelingRentRollUnits.modelingProjectId, projectId),
        eq(modelingRentRollUnits.id, unitId)
      ),
    });

    if (!existing) {
      return res.status(404).json({ error: "Unit not found" });
    }

    const [updated] = await db
      .update(modelingRentRollUnits)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(modelingRentRollUnits.id, unitId))
      .returning();

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Delete a unit
router.delete("/projects/:projectId/units/:unitId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { projectId, unitId } = req.params;

    const existing = await db.query.modelingRentRollUnits.findFirst({
      where: and(
        eq(modelingRentRollUnits.orgId, orgId),
        eq(modelingRentRollUnits.modelingProjectId, projectId),
        eq(modelingRentRollUnits.id, unitId)
      ),
    });

    if (!existing) {
      return res.status(404).json({ error: "Unit not found" });
    }

    await db.delete(modelingRentRollUnits).where(eq(modelingRentRollUnits.id, unitId));

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Bulk create units
router.post("/projects/:projectId/units/bulk", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const { projectId } = req.params;
    const { units } = req.body;

    if (!Array.isArray(units) || units.length === 0) {
      return res.status(400).json({ error: "Units array is required" });
    }

    const project = await db.query.modelingProjects.findFirst({
      where: and(
        eq(modelingProjects.orgId, orgId),
        eq(modelingProjects.id, projectId)
      ),
    });

    if (!project) {
      return res.status(404).json({ error: "Modeling project not found" });
    }

    const validatedUnits = units.map((u: any) =>
      insertModelingRentRollUnitSchema.parse({
        ...u,
        orgId,
        modelingProjectId: projectId,
        createdBy: userId,
      })
    );

    const created = await db.insert(modelingRentRollUnits).values(validatedUnits).returning();

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

// Import from Operations RRA location (copy data to standalone)
router.post("/projects/:projectId/import-from-rra/:rraLocationId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    const { projectId, rraLocationId } = req.params;
    const { clearExisting } = req.body;

    const project = await db.query.modelingProjects.findFirst({
      where: and(
        eq(modelingProjects.orgId, orgId),
        eq(modelingProjects.id, projectId)
      ),
    });

    if (!project) {
      return res.status(404).json({ error: "Modeling project not found" });
    }

    const rraLocation = await db.query.rraMarinaLocations.findFirst({
      where: and(
        eq(rraMarinaLocations.orgId, orgId),
        eq(rraMarinaLocations.id, rraLocationId)
      ),
    });

    if (!rraLocation) {
      return res.status(404).json({ error: "RRA location not found" });
    }

    if (clearExisting) {
      await db.delete(modelingRentRollUnits).where(
        and(
          eq(modelingRentRollUnits.orgId, orgId),
          eq(modelingRentRollUnits.modelingProjectId, projectId)
        )
      );
    }

    const rraLeasesData = await db.query.rraLeases.findMany({
      where: and(
        eq(rraLeases.orgId, orgId),
        eq(rraLeases.locationId, rraLocationId),
        eq(rraLeases.isActive, true)
      ),
      with: {
        tenant: true,
      },
    });

    const unitsToInsert = rraLeasesData.map((lease, index) => ({
      orgId,
      modelingProjectId: projectId,
      unitNumber: lease.unitNumber || lease.unitLocation || `Unit-${index + 1}`,
      storageType: mapRraStorageType(lease.storageType),
      status: lease.slipStatus === 'Occupied' ? 'occupied' : 'vacant',
      length: lease.slipLength ? parseFloat(lease.slipLength) : null,
      width: lease.slipWidth ? parseFloat(lease.slipWidth) : null,
      monthlyRent: lease.leaseAmount ? String(parseFloat(lease.leaseAmount) / 12) : '0',
      annualRent: lease.leaseAmount || null,
      tenantName: lease.tenant?.name || null,
      boatName: null,
      boatLength: null,
      boatType: lease.boatType || null,
      leaseStartDate: lease.leaseCommencement || null,
      leaseEndDate: lease.leaseExpiration || null,
      isMonthToMonth: lease.contractTerm?.toLowerCase().includes('month') || false,
      electricCharge: String(parseFloat(lease.additionalCharge1 || '0')),
      waterCharge: String(parseFloat(lease.additionalCharge2 || '0')),
      otherCharges: String(parseFloat(lease.additionalCharge3 || '0')),
      notes: `Imported from RRA: ${rraLocation.name}`,
      createdBy: userId,
    }));

    let imported = [];
    if (unitsToInsert.length > 0) {
      imported = await db.insert(modelingRentRollUnits).values(unitsToInsert as any).returning();
    }

    await db
      .update(modelingRentRollConfig)
      .set({
        linkedRraLocationId: rraLocationId,
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(modelingRentRollConfig.orgId, orgId),
          eq(modelingRentRollConfig.modelingProjectId, projectId)
        )
      );

    res.json({
      success: true,
      importedCount: imported.length,
      sourceLocation: rraLocation.name,
    });
  } catch (error) {
    next(error);
  }
});

function mapRraStorageType(rraType: string | null): string {
  const mapping: Record<string, string> = {
    'Wet Slip': 'Wet Slip',
    'Dry Storage': 'Dry Storage',
    'Dry Rack': 'Dry Rack',
    'Dry Stack': 'Dry Stack',
    'Mooring': 'Mooring',
    'Trailer Storage': 'Trailer Storage',
    'Lift Storage': 'Lift Storage',
  };
  return mapping[rraType || ''] || 'Other';
}

// Get analysis dashboard data for a modeling project's rent roll
router.get("/projects/:projectId/analysis", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    const { projectId } = req.params;

    const config = await db.query.modelingRentRollConfig.findFirst({
      where: and(
        eq(modelingRentRollConfig.orgId, orgId),
        eq(modelingRentRollConfig.modelingProjectId, projectId)
      ),
    });

    const units = await db.query.modelingRentRollUnits.findMany({
      where: and(
        eq(modelingRentRollUnits.orgId, orgId),
        eq(modelingRentRollUnits.modelingProjectId, projectId)
      ),
    });

    const project = await db.query.modelingProjects.findFirst({
      where: and(
        eq(modelingProjects.orgId, orgId),
        eq(modelingProjects.id, projectId)
      ),
    });

    const totalUnits = units.length;
    const occupiedUnits = units.filter(u => u.status === 'occupied').length;
    const vacantUnits = totalUnits - occupiedUnits;
    const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

    const totalMonthlyRent = units.reduce((sum, u) => sum + parseFloat(u.monthlyRent || '0'), 0);
    const totalAnnualRevenue = totalMonthlyRent * 12;
    const averageRentPerUnit = occupiedUnits > 0 ? totalMonthlyRent / occupiedUnits : 0;
    const grossPotentialRent = totalUnits > 0 ? (totalMonthlyRent / (occupiedUnits || 1)) * totalUnits : 0;
    const vacancyLoss = grossPotentialRent - totalMonthlyRent;

    const activeLeaseCount = units.filter(u => u.status === 'occupied' && (u.leaseStartDate || u.tenantName)).length;
    const monthToMonthCount = units.filter(u => u.isMonthToMonth).length;

    const now = new Date();
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const expiringLeases90Days = units.filter(u => {
      if (!u.leaseEndDate || u.isMonthToMonth) return false;
      const endDate = new Date(u.leaseEndDate);
      return endDate >= now && endDate <= ninetyDaysFromNow;
    }).length;

    const leaseExpirations: { month: string; count: number; rent: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);
      const monthName = monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const expiring = units.filter(u => {
        if (!u.leaseEndDate || u.isMonthToMonth) return false;
        const endDate = new Date(u.leaseEndDate);
        return endDate >= monthStart && endDate <= monthEnd;
      });
      if (expiring.length > 0) {
        leaseExpirations.push({
          month: monthName,
          count: expiring.length,
          rent: expiring.reduce((sum, u) => sum + parseFloat(u.monthlyRent || '0'), 0),
        });
      }
    }

    const storageTypeBreakdown: Record<string, { 
      count: number; occupied: number; vacant: number; totalRent: number; avgRent: number; occupancyRate: number 
    }> = {};
    units.forEach(u => {
      const type = u.storageType || 'Other';
      if (!storageTypeBreakdown[type]) {
        storageTypeBreakdown[type] = { count: 0, occupied: 0, vacant: 0, totalRent: 0, avgRent: 0, occupancyRate: 0 };
      }
      storageTypeBreakdown[type].count += 1;
      if (u.status === 'occupied') {
        storageTypeBreakdown[type].occupied += 1;
      } else {
        storageTypeBreakdown[type].vacant += 1;
      }
      storageTypeBreakdown[type].totalRent += parseFloat(u.monthlyRent || '0');
    });
    Object.values(storageTypeBreakdown).forEach(item => {
      item.avgRent = item.occupied > 0 ? item.totalRent / item.occupied : 0;
      item.occupancyRate = item.count > 0 ? (item.occupied / item.count) * 100 : 0;
    });

    const dockBreakdown: Record<string, { count: number; occupied: number; totalRent: number }> = {};
    units.forEach(u => {
      const dock = u.dock || 'Unassigned';
      if (!dockBreakdown[dock]) {
        dockBreakdown[dock] = { count: 0, occupied: 0, totalRent: 0 };
      }
      dockBreakdown[dock].count += 1;
      if (u.status === 'occupied') dockBreakdown[dock].occupied += 1;
      dockBreakdown[dock].totalRent += parseFloat(u.monthlyRent || '0');
    });

    const recentActivity: { type: string; description: string; date: string }[] = [];
    const sortedByCreated = [...units].sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    sortedByCreated.slice(0, 5).forEach(u => {
      recentActivity.push({
        type: 'lease',
        description: `${u.tenantName || 'Unknown'} - ${u.unitNumber} (${u.storageType})`,
        date: u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Unknown',
      });
    });

    res.json({
      projectName: project?.marinaName || 'Unknown',
      dataSourceMode: config?.dataSourceMode || 'standalone',
      linkedRraLocationId: config?.linkedRraLocationId || null,
      totalUnits,
      occupiedUnits,
      vacantUnits,
      occupancyRate,
      totalMonthlyRent,
      totalAnnualRevenue,
      averageRentPerUnit,
      grossPotentialRent,
      vacancyLoss,
      activeLeaseCount,
      monthToMonthCount,
      expiringLeases90Days,
      leaseExpirations,
      storageTypeBreakdown,
      dockBreakdown,
      recentActivity,
    });
  } catch (error) {
    next(error);
  }
});

// Get available RRA locations for import
router.get("/available-rra-locations", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);

    const locations = await db.query.rraMarinaLocations.findMany({
      where: eq(rraMarinaLocations.orgId, orgId),
      orderBy: [asc(rraMarinaLocations.name)],
    });

    res.json(locations);
  } catch (error) {
    next(error);
  }
});

export default router;
