import { Router, Request, Response } from "express";
import { db } from "../db";
import { 
  marinalyticsMetricDefinitions,
  marinalyticsOperatorProfiles,
  marinalyticsMetricSnapshots,
  marinalyticsBenchmarkSets,
  marinalyticsCapitalPartners,
  crmCompanies,
  MARINALYTICS_STANDARD_METRICS,
  insertMarinalyticsOperatorProfileSchema,
  insertMarinalyticsMetricSnapshotSchema,
  insertMarinalyticsBenchmarkSetSchema,
  insertMarinalyticsCapitalPartnerSchema,
} from "@shared/schema";
import { eq, and, desc, sql, or, isNull } from "drizzle-orm";
import { z } from "zod";

const router = Router();

function getOrgId(req: Request): string | null {
  return (req as any).user?.orgId || (req as any).session?.user?.orgId || (req as any).session?.orgId || null;
}

function getUserId(req: Request): string | null {
  return (req as any).session?.userId || (req as any).user?.id || null;
}

function requireOrg(req: Request, res: Response): string | null {
  const orgId = getOrgId(req);
  if (!orgId) {
    res.status(401).json({ error: "Organization context required" });
    return null;
  }
  return orgId;
}

router.get("/metrics/definitions", async (req: Request, res: Response) => {
  try {
    const definitions = await db.select().from(marinalyticsMetricDefinitions).orderBy(marinalyticsMetricDefinitions.displayOrder);
    res.json(definitions);
  } catch (error: any) {
    console.error('[Marinalytics] Error fetching metric definitions:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/metrics/definitions/seed", async (req: Request, res: Response) => {
  try {
    const existingCount = await db.select({ count: sql`count(*)` }).from(marinalyticsMetricDefinitions);
    
    if (Number(existingCount[0]?.count) > 0) {
      return res.json({ message: "Metrics already seeded", count: Number(existingCount[0]?.count) });
    }
    
    const metricsToInsert = MARINALYTICS_STANDARD_METRICS.map((m, idx) => ({
      metricKey: m.metricKey,
      name: m.name,
      category: m.category as any,
      unit: m.unit as any,
      displayOrder: idx,
      isSystem: true,
    }));
    
    await db.insert(marinalyticsMetricDefinitions).values(metricsToInsert);
    
    res.json({ message: "Metrics seeded successfully", count: metricsToInsert.length });
  } catch (error: any) {
    console.error('[Marinalytics] Error seeding metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/operators", async (req: Request, res: Response) => {
  try {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    
    const operators = await db
      .select()
      .from(marinalyticsOperatorProfiles)
      .where(eq(marinalyticsOperatorProfiles.orgId, orgId))
      .orderBy(desc(marinalyticsOperatorProfiles.createdAt));
    
    res.json(operators);
  } catch (error: any) {
    console.error('[Marinalytics] Error fetching operators:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/operators/:id", async (req: Request, res: Response) => {
  try {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    
    const { id } = req.params;
    const operator = await db
      .select()
      .from(marinalyticsOperatorProfiles)
      .where(and(
        eq(marinalyticsOperatorProfiles.id, id),
        eq(marinalyticsOperatorProfiles.orgId, orgId)
      ))
      .limit(1);
    
    if (!operator.length) {
      return res.status(404).json({ error: "Operator profile not found" });
    }
    
    res.json(operator[0]);
  } catch (error: any) {
    console.error('[Marinalytics] Error fetching operator:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/operators", async (req: Request, res: Response) => {
  try {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    
    const validation = insertMarinalyticsOperatorProfileSchema.safeParse({
      ...req.body,
      orgId,
    });
    
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.flatten() });
    }
    
    const [operator] = await db
      .insert(marinalyticsOperatorProfiles)
      .values(validation.data)
      .returning();
    
    res.status(201).json(operator);
  } catch (error: any) {
    console.error('[Marinalytics] Error creating operator:', error);
    res.status(500).json({ error: error.message });
  }
});

router.patch("/operators/:id", async (req: Request, res: Response) => {
  try {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    
    const { id } = req.params;
    
    const existing = await db
      .select()
      .from(marinalyticsOperatorProfiles)
      .where(and(
        eq(marinalyticsOperatorProfiles.id, id),
        eq(marinalyticsOperatorProfiles.orgId, orgId)
      ))
      .limit(1);
    
    if (!existing.length) {
      return res.status(404).json({ error: "Operator profile not found" });
    }
    
    const { orgId: _stripOrgId, id: _stripId, createdAt: _stripCreated, ...updateData } = req.body;
    
    const allowedFields = [
      'companyId', 'capitalPartner', 'focusSegments', 'primaryRegions',
      'totalMarinaCount', 'totalSlipCount', 'totalLinearFeet', 'acquisitionStartYear',
      'preferredBenchmarkCohorts', 'notes'
    ];
    
    const sanitizedData: Record<string, any> = {};
    for (const key of allowedFields) {
      if (key in updateData) {
        sanitizedData[key] = updateData[key];
      }
    }
    sanitizedData.updatedAt = new Date();
    
    const [operator] = await db
      .update(marinalyticsOperatorProfiles)
      .set(sanitizedData)
      .where(and(
        eq(marinalyticsOperatorProfiles.id, id),
        eq(marinalyticsOperatorProfiles.orgId, orgId)
      ))
      .returning();
    
    res.json(operator);
  } catch (error: any) {
    console.error('[Marinalytics] Error updating operator:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/snapshots", async (req: Request, res: Response) => {
  try {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    
    const { operatorId, propertyId, metricKey } = req.query;
    
    const conditions: any[] = [eq(marinalyticsMetricSnapshots.orgId, orgId)];
    
    if (operatorId) {
      conditions.push(eq(marinalyticsMetricSnapshots.operatorProfileId, operatorId as string));
    }
    if (propertyId) {
      conditions.push(eq(marinalyticsMetricSnapshots.propertyId, propertyId as string));
    }
    if (metricKey) {
      conditions.push(eq(marinalyticsMetricSnapshots.metricKey, metricKey as string));
    }
    
    const snapshots = await db
      .select()
      .from(marinalyticsMetricSnapshots)
      .where(and(...conditions))
      .orderBy(desc(marinalyticsMetricSnapshots.periodEnd));
    
    res.json(snapshots);
  } catch (error: any) {
    console.error('[Marinalytics] Error fetching snapshots:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/snapshots", async (req: Request, res: Response) => {
  try {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    
    const userId = getUserId(req);
    
    const validation = insertMarinalyticsMetricSnapshotSchema.safeParse({
      ...req.body,
      orgId,
      createdBy: userId,
    });
    
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.flatten() });
    }
    
    const [snapshot] = await db
      .insert(marinalyticsMetricSnapshots)
      .values(validation.data)
      .returning();
    
    res.status(201).json(snapshot);
  } catch (error: any) {
    console.error('[Marinalytics] Error creating snapshot:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/benchmarks", async (req: Request, res: Response) => {
  try {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    
    const { cohortType, metricKey, year } = req.query;
    
    const conditions: any[] = [
      or(
        eq(marinalyticsBenchmarkSets.orgId, orgId),
        isNull(marinalyticsBenchmarkSets.orgId),
        eq(marinalyticsBenchmarkSets.isSystem, true)
      )
    ];
    
    if (cohortType) {
      conditions.push(eq(marinalyticsBenchmarkSets.cohortType, cohortType as any));
    }
    if (metricKey) {
      conditions.push(eq(marinalyticsBenchmarkSets.metricKey, metricKey as string));
    }
    if (year) {
      conditions.push(eq(marinalyticsBenchmarkSets.periodYear, parseInt(year as string)));
    }
    
    const benchmarks = await db
      .select()
      .from(marinalyticsBenchmarkSets)
      .where(and(...conditions))
      .orderBy(marinalyticsBenchmarkSets.name);
    
    res.json(benchmarks);
  } catch (error: any) {
    console.error('[Marinalytics] Error fetching benchmarks:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/benchmarks", async (req: Request, res: Response) => {
  try {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    
    const validation = insertMarinalyticsBenchmarkSetSchema.safeParse({
      ...req.body,
      orgId,
    });
    
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.flatten() });
    }
    
    const [benchmark] = await db
      .insert(marinalyticsBenchmarkSets)
      .values(validation.data)
      .returning();
    
    res.status(201).json(benchmark);
  } catch (error: any) {
    console.error('[Marinalytics] Error creating benchmark:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/capital-partners", async (req: Request, res: Response) => {
  try {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    
    const partners = await db
      .select()
      .from(marinalyticsCapitalPartners)
      .where(eq(marinalyticsCapitalPartners.orgId, orgId))
      .orderBy(marinalyticsCapitalPartners.name);
    
    res.json(partners);
  } catch (error: any) {
    console.error('[Marinalytics] Error fetching capital partners:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/capital-partners", async (req: Request, res: Response) => {
  try {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    
    const validation = insertMarinalyticsCapitalPartnerSchema.safeParse({
      ...req.body,
      orgId,
    });
    
    if (!validation.success) {
      return res.status(400).json({ error: "Validation failed", details: validation.error.flatten() });
    }
    
    const [partner] = await db
      .insert(marinalyticsCapitalPartners)
      .values(validation.data)
      .returning();
    
    res.status(201).json(partner);
  } catch (error: any) {
    console.error('[Marinalytics] Error creating capital partner:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/portfolio-companies", async (req: Request, res: Response) => {
  try {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    
    const companies = await db
      .select()
      .from(crmCompanies)
      .where(and(
        eq(crmCompanies.orgId, orgId),
        eq(crmCompanies.isPortfolioCompany, true)
      ))
      .orderBy(crmCompanies.name);
    
    res.json(companies);
  } catch (error: any) {
    console.error('[Marinalytics] Error fetching portfolio companies:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/summary", async (req: Request, res: Response) => {
  try {
    const orgId = requireOrg(req, res);
    if (!orgId) return;
    
    const portfolioCount = await db
      .select({ count: sql`count(*)` })
      .from(crmCompanies)
      .where(and(
        eq(crmCompanies.orgId, orgId),
        eq(crmCompanies.isPortfolioCompany, true)
      ));
    
    const capitalPartnerCount = await db
      .select({ 
        partner: crmCompanies.capitalPartner,
        count: sql`count(*)` 
      })
      .from(crmCompanies)
      .where(and(
        eq(crmCompanies.orgId, orgId),
        eq(crmCompanies.isPortfolioCompany, true)
      ))
      .groupBy(crmCompanies.capitalPartner);
    
    res.json({
      portfolioCompanyCount: Number(portfolioCount[0]?.count || 0),
      capitalPartnerCount: capitalPartnerCount.filter(c => c.partner).length,
      capitalPartnerBreakdown: capitalPartnerCount,
    });
  } catch (error: any) {
    console.error('[Marinalytics] Error fetching summary:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
