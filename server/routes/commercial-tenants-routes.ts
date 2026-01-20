import { Router, Request, Response } from "express";
import { db } from "../db";
import { 
  commercialTenants, 
  commercialTenantRentSchedule, 
  commercialTenantAmendments,
  commercialTenantScenarios,
  insertCommercialTenantSchema,
  insertCommercialTenantRentScheduleSchema,
  insertCommercialTenantAmendmentSchema,
  insertCommercialTenantScenarioSchema,
} from "@shared/schema";
import { eq, and, desc, sql, gte, lte, isNull, or, ilike } from "drizzle-orm";
import { commercialLeaseParser } from "../services/commercial-lease-parser";
import multer from "multer";

const router = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Note: Authentication is applied via app.use in routes.ts

// GET /api/commercial-tenants - List all commercial tenants
router.get("/", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.auth!;
    const { 
      modelingProjectId, 
      marinaId, 
      ddProjectId,
      status, 
      search,
      expiringWithinDays 
    } = req.query;

    let query = db.select().from(commercialTenants).where(eq(commercialTenants.orgId, orgId));

    const conditions = [eq(commercialTenants.orgId, orgId)];
    
    if (modelingProjectId) {
      conditions.push(eq(commercialTenants.modelingProjectId, String(modelingProjectId)));
    }
    
    if (marinaId) {
      conditions.push(eq(commercialTenants.marinaId, String(marinaId)));
    }
    
    if (ddProjectId) {
      conditions.push(eq(commercialTenants.ddProjectId, String(ddProjectId)));
    }
    
    if (status) {
      conditions.push(eq(commercialTenants.tenantStatus, status as any));
    }
    
    if (search) {
      conditions.push(
        or(
          ilike(commercialTenants.tenantName, `%${search}%`),
          ilike(commercialTenants.tradeName, `%${search}%`),
          ilike(commercialTenants.suiteNumber, `%${search}%`)
        )!
      );
    }
    
    if (expiringWithinDays) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + Number(expiringWithinDays));
      conditions.push(lte(commercialTenants.leaseExpirationDate, futureDate.toISOString().split('T')[0]));
      conditions.push(gte(commercialTenants.leaseExpirationDate, new Date().toISOString().split('T')[0]));
    }

    const tenants = await db.select()
      .from(commercialTenants)
      .where(and(...conditions))
      .orderBy(desc(commercialTenants.createdAt));

    res.json(tenants);
  } catch (error: any) {
    console.error("[CommercialTenants] Error fetching tenants:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/commercial-tenants/:id - Get single tenant with full details
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.auth!;
    const { id } = req.params;

    const [tenant] = await db.select()
      .from(commercialTenants)
      .where(and(
        eq(commercialTenants.id, id),
        eq(commercialTenants.orgId, orgId)
      ));

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    // Get rent schedule
    const rentSchedule = await db.select()
      .from(commercialTenantRentSchedule)
      .where(eq(commercialTenantRentSchedule.tenantId, id))
      .orderBy(commercialTenantRentSchedule.yearNumber);

    // Get amendments
    const amendments = await db.select()
      .from(commercialTenantAmendments)
      .where(eq(commercialTenantAmendments.tenantId, id))
      .orderBy(desc(commercialTenantAmendments.effectiveDate));

    // Get scenarios
    const scenarios = await db.select()
      .from(commercialTenantScenarios)
      .where(eq(commercialTenantScenarios.tenantId, id));

    res.json({
      ...tenant,
      rentSchedule,
      amendments,
      scenarios,
    });
  } catch (error: any) {
    console.error("[CommercialTenants] Error fetching tenant:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/commercial-tenants - Create new tenant
router.post("/", async (req: Request, res: Response) => {
  try {
    const { orgId, userId } = req.auth!;
    
    const validated = insertCommercialTenantSchema.parse({
      ...req.body,
      orgId,
      createdBy: userId,
    });

    const [tenant] = await db.insert(commercialTenants)
      .values(validated)
      .returning();

    // Auto-generate rent schedule if we have the data
    if (tenant.currentBaseRent && tenant.leaseCommencementDate && tenant.leaseExpirationDate) {
      await generateRentSchedule(tenant);
    }

    res.status(201).json(tenant);
  } catch (error: any) {
    console.error("[CommercialTenants] Error creating tenant:", error);
    res.status(400).json({ error: error.message });
  }
});

// PATCH /api/commercial-tenants/:id - Update tenant
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { orgId, userId } = req.auth!;
    const { id } = req.params;

    const [existing] = await db.select()
      .from(commercialTenants)
      .where(and(
        eq(commercialTenants.id, id),
        eq(commercialTenants.orgId, orgId)
      ));

    if (!existing) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const [updated] = await db.update(commercialTenants)
      .set({
        ...req.body,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(commercialTenants.id, id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    console.error("[CommercialTenants] Error updating tenant:", error);
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/commercial-tenants/:id - Delete tenant
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.auth!;
    const { id } = req.params;

    const [existing] = await db.select()
      .from(commercialTenants)
      .where(and(
        eq(commercialTenants.id, id),
        eq(commercialTenants.orgId, orgId)
      ));

    if (!existing) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    await db.delete(commercialTenants).where(eq(commercialTenants.id, id));
    res.status(204).send();
  } catch (error: any) {
    console.error("[CommercialTenants] Error deleting tenant:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/commercial-tenants/:id/rent-schedule - Regenerate rent schedule
router.post("/:id/rent-schedule", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.auth!;
    const { id } = req.params;

    const [tenant] = await db.select()
      .from(commercialTenants)
      .where(and(
        eq(commercialTenants.id, id),
        eq(commercialTenants.orgId, orgId)
      ));

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    // Delete existing schedule
    await db.delete(commercialTenantRentSchedule)
      .where(eq(commercialTenantRentSchedule.tenantId, id));

    // Generate new schedule
    const schedule = await generateRentSchedule(tenant);
    res.json(schedule);
  } catch (error: any) {
    console.error("[CommercialTenants] Error generating rent schedule:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/commercial-tenants/:id/amendments - Add amendment
router.post("/:id/amendments", async (req: Request, res: Response) => {
  try {
    const { orgId, userId } = req.auth!;
    const { id } = req.params;

    const [tenant] = await db.select()
      .from(commercialTenants)
      .where(and(
        eq(commercialTenants.id, id),
        eq(commercialTenants.orgId, orgId)
      ));

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    // Get next amendment number
    const existingAmendments = await db.select()
      .from(commercialTenantAmendments)
      .where(eq(commercialTenantAmendments.tenantId, id));

    const validated = insertCommercialTenantAmendmentSchema.parse({
      ...req.body,
      tenantId: id,
      amendmentNumber: existingAmendments.length + 1,
      createdBy: userId,
    });

    const [amendment] = await db.insert(commercialTenantAmendments)
      .values(validated)
      .returning();

    res.status(201).json(amendment);
  } catch (error: any) {
    console.error("[CommercialTenants] Error creating amendment:", error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/commercial-tenants/:id/scenarios - Add modeling scenario
router.post("/:id/scenarios", async (req: Request, res: Response) => {
  try {
    const { orgId, userId } = req.auth!;
    const { id } = req.params;

    const [tenant] = await db.select()
      .from(commercialTenants)
      .where(and(
        eq(commercialTenants.id, id),
        eq(commercialTenants.orgId, orgId)
      ));

    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const validated = insertCommercialTenantScenarioSchema.parse({
      ...req.body,
      tenantId: id,
      createdBy: userId,
    });

    const [scenario] = await db.insert(commercialTenantScenarios)
      .values(validated)
      .returning();

    res.status(201).json(scenario);
  } catch (error: any) {
    console.error("[CommercialTenants] Error creating scenario:", error);
    res.status(400).json({ error: error.message });
  }
});

// PATCH /api/commercial-tenants/scenarios/:scenarioId - Update scenario
router.patch("/scenarios/:scenarioId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.auth!;
    const { scenarioId } = req.params;

    const [updated] = await db.update(commercialTenantScenarios)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(commercialTenantScenarios.id, scenarioId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Scenario not found" });
    }

    res.json(updated);
  } catch (error: any) {
    console.error("[CommercialTenants] Error updating scenario:", error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/commercial-tenants/parse - Parse lease document
router.post("/parse", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const useAI = req.query.useAI !== 'false';
    const result = await commercialLeaseParser.parseDocument(
      req.file.buffer,
      req.file.originalname,
      { useAI }
    );

    res.json(result);
  } catch (error: any) {
    console.error("[CommercialTenants] Error parsing document:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/commercial-tenants/bulk-import - Bulk import from parsed document
router.post("/bulk-import", async (req: Request, res: Response) => {
  try {
    const { orgId, userId } = req.auth!;
    const { leases, modelingProjectId, marinaId, ddProjectId } = req.body;

    if (!Array.isArray(leases) || leases.length === 0) {
      return res.status(400).json({ error: "No leases to import" });
    }

    const imported: any[] = [];
    const errors: string[] = [];

    for (const lease of leases) {
      try {
        const tenantData = {
          orgId,
          createdBy: userId,
          modelingProjectId,
          marinaId,
          ddProjectId,
          importSource: 'document_parse',
          needsReview: true,
          ...lease,
        };

        const [tenant] = await db.insert(commercialTenants)
          .values(tenantData)
          .returning();

        imported.push(tenant);

        // Generate rent schedule if possible
        if (tenant.currentBaseRent && tenant.leaseCommencementDate && tenant.leaseExpirationDate) {
          await generateRentSchedule(tenant);
        }
      } catch (err: any) {
        errors.push(`Failed to import tenant ${lease.tenantName}: ${err.message}`);
      }
    }

    res.json({
      success: true,
      imported: imported.length,
      errors,
      tenants: imported,
    });
  } catch (error: any) {
    console.error("[CommercialTenants] Error bulk importing:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/commercial-tenants/analytics/summary - Get portfolio summary
router.get("/analytics/summary", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.auth!;
    const { modelingProjectId, marinaId } = req.query;

    const conditions = [eq(commercialTenants.orgId, orgId)];
    
    if (modelingProjectId) {
      conditions.push(eq(commercialTenants.modelingProjectId, String(modelingProjectId)));
    }
    
    if (marinaId) {
      conditions.push(eq(commercialTenants.marinaId, String(marinaId)));
    }

    const tenants = await db.select()
      .from(commercialTenants)
      .where(and(...conditions));

    const now = new Date();
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

    const summary = {
      totalTenants: tenants.length,
      activeTenants: tenants.filter(t => t.tenantStatus === 'active').length,
      totalSquareFootage: tenants.reduce((sum, t) => sum + (parseFloat(t.squareFootage || '0') || 0), 0),
      totalAnnualRent: tenants.reduce((sum, t) => sum + (parseFloat(t.currentBaseRent || '0') || 0), 0),
      totalAnnualNNN: tenants.reduce((sum, t) => sum + (parseFloat(t.totalEstimatedNNN || '0') || 0), 0),
      avgRentPerSF: 0,
      expiringWithin90Days: tenants.filter(t => {
        if (!t.leaseExpirationDate) return false;
        const expDate = new Date(t.leaseExpirationDate);
        return expDate >= now && expDate <= ninetyDaysFromNow;
      }).length,
      byLeaseType: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
    };

    if (summary.totalSquareFootage > 0) {
      summary.avgRentPerSF = summary.totalAnnualRent / summary.totalSquareFootage;
    }

    tenants.forEach(t => {
      summary.byLeaseType[t.leaseType || 'unknown'] = (summary.byLeaseType[t.leaseType || 'unknown'] || 0) + 1;
      summary.byStatus[t.tenantStatus] = (summary.byStatus[t.tenantStatus] || 0) + 1;
    });

    res.json(summary);
  } catch (error: any) {
    console.error("[CommercialTenants] Error getting summary:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/commercial-tenants/analytics/expirations - Get lease expiration schedule
router.get("/analytics/expirations", async (req: Request, res: Response) => {
  try {
    const { orgId } = req.auth!;
    const { modelingProjectId, marinaId, years = 5 } = req.query;

    const conditions = [eq(commercialTenants.orgId, orgId)];
    
    if (modelingProjectId) {
      conditions.push(eq(commercialTenants.modelingProjectId, String(modelingProjectId)));
    }
    
    if (marinaId) {
      conditions.push(eq(commercialTenants.marinaId, String(marinaId)));
    }

    const tenants = await db.select()
      .from(commercialTenants)
      .where(and(...conditions));

    const currentYear = new Date().getFullYear();
    const expirations: Record<number, { count: number; sqft: number; rent: number }> = {};

    for (let i = 0; i <= Number(years); i++) {
      expirations[currentYear + i] = { count: 0, sqft: 0, rent: 0 };
    }

    tenants.forEach(t => {
      if (!t.leaseExpirationDate) return;
      const expYear = new Date(t.leaseExpirationDate).getFullYear();
      if (expirations[expYear]) {
        expirations[expYear].count++;
        expirations[expYear].sqft += parseFloat(t.squareFootage || '0') || 0;
        expirations[expYear].rent += parseFloat(t.currentBaseRent || '0') || 0;
      }
    });

    res.json(Object.entries(expirations).map(([year, data]) => ({
      year: Number(year),
      ...data,
    })));
  } catch (error: any) {
    console.error("[CommercialTenants] Error getting expirations:", error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to generate rent schedule
async function generateRentSchedule(tenant: any) {
  if (!tenant.currentBaseRent || !tenant.leaseCommencementDate || !tenant.leaseExpirationDate) {
    return [];
  }

  const startDate = new Date(tenant.leaseCommencementDate);
  const endDate = new Date(tenant.leaseExpirationDate);
  const years = Math.ceil((endDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  
  let currentRent = parseFloat(tenant.currentBaseRent);
  const escalationRate = parseFloat(tenant.escalationRate || '0.03') || 0.03;
  const escalationAmount = parseFloat(tenant.escalationAmount || '0') || 0;
  const sqft = parseFloat(tenant.squareFootage || '0') || 1;
  const nnnPerSF = (parseFloat(tenant.estimatedCamPerSF || '0') || 0) + 
                   (parseFloat(tenant.estimatedTaxPerSF || '0') || 0) + 
                   (parseFloat(tenant.estimatedInsurancePerSF || '0') || 0);
  
  const scheduleRows = [];
  
  for (let year = 1; year <= years; year++) {
    const periodStart = new Date(startDate);
    periodStart.setFullYear(startDate.getFullYear() + year - 1);
    
    const periodEnd = new Date(startDate);
    periodEnd.setFullYear(startDate.getFullYear() + year);
    periodEnd.setDate(periodEnd.getDate() - 1);
    
    if (periodEnd > endDate) {
      periodEnd.setTime(endDate.getTime());
    }

    // Apply escalation for years after first
    if (year > 1) {
      if (tenant.escalationType === 'fixed_percent') {
        currentRent = currentRent * (1 + escalationRate);
      } else if (tenant.escalationType === 'fixed_dollar') {
        currentRent = currentRent + (escalationAmount * sqft);
      }
    }

    const nnnAnnual = nnnPerSF * sqft;
    const percentageRent = parseFloat(tenant.percentageRentRate || '0') > 0 ? currentRent * 0.1 : 0; // Estimate

    scheduleRows.push({
      tenantId: tenant.id,
      periodStart: periodStart.toISOString().split('T')[0],
      periodEnd: periodEnd.toISOString().split('T')[0],
      yearNumber: year,
      baseRentAnnual: currentRent.toFixed(2),
      baseRentMonthly: (currentRent / 12).toFixed(2),
      baseRentPerSF: (currentRent / sqft).toFixed(2),
      estimatedPercentageRent: percentageRent.toFixed(2),
      estimatedNNNAnnual: nnnAnnual.toFixed(2),
      totalRentAnnual: (currentRent + nnnAnnual + percentageRent).toFixed(2),
    });
  }

  if (scheduleRows.length > 0) {
    await db.insert(commercialTenantRentSchedule).values(scheduleRows);
  }

  return scheduleRows;
}

export default router;
