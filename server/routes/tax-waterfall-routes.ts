import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import {
  taxProfiles, projectTaxSettings, projectPartners, projectEquityContributions,
  waterfallConfigs, waterfallTiers, projectTaxInputs, projects,
  insertTaxProfileSchema, insertProjectTaxSettingsSchema,
  insertProjectPartnerSchema, insertProjectEquityContributionSchema,
  insertWaterfallConfigSchema, insertWaterfallTierSchema, insertProjectTaxInputsSchema,
} from "@shared/schema";
import { AuthenticatedRequest } from "../middleware/auth-resolver";

const router = Router();

function getUserId(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  if (authReq.validatedUserId) return authReq.validatedUserId;
  return (req as any).session?.userId || (req as any).user?.id || 'user-1';
}

function getOrgId(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  if (authReq.validatedOrgId) return authReq.validatedOrgId;
  return (req as any).tenantId || (req as any).user?.orgId || (req as any).session?.orgId || 'org-1';
}

async function verifyProjectAccess(projectId: string, orgId: string): Promise<boolean> {
  const [project] = await db.select({ id: projects.id }).from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.orgId, orgId)));
  return !!project;
}

// ── Settings ────────────────────────────────────────────────────────────────

router.get("/projects/:projectId/settings", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const orgId = getOrgId(req);
    if (!await verifyProjectAccess(projectId, orgId)) return res.status(404).json({ error: "Project not found" });
    const [row] = await db.select().from(projectTaxSettings)
      .where(eq(projectTaxSettings.projectId, projectId));
    if (!row) {
      return res.json({
        projectId,
        enabled: false,
        taxMode: "flat",
        taxTiming: "annual",
        taxInteractionMode: "waterfall_pre_tax",
        defaultTaxProfileId: null,
      });
    }
    res.json(row);
  } catch (err) { next(err); }
});

router.put("/projects/:projectId/settings", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const orgId = getOrgId(req);
    if (!await verifyProjectAccess(projectId, orgId)) return res.status(404).json({ error: "Project not found" });
    const body = z.object({
      enabled: z.boolean().optional(),
      taxMode: z.enum(["flat", "split", "advanced"]).optional(),
      taxTiming: z.enum(["monthly", "quarterly", "annual"]).optional(),
      taxInteractionMode: z.enum(["waterfall_pre_tax", "waterfall_after_tax", "tax_distribution_layer"]).optional(),
      defaultTaxProfileId: z.string().nullable().optional(),
    }).parse(req.body);

    const [existing] = await db.select().from(projectTaxSettings)
      .where(eq(projectTaxSettings.projectId, projectId));

    let row;
    if (existing) {
      [row] = await db.update(projectTaxSettings)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(projectTaxSettings.projectId, projectId))
        .returning();
    } else {
      [row] = await db.insert(projectTaxSettings)
        .values({ projectId, ...body })
        .returning();

      if (body.enabled) {
        await seedDefaultWaterfall(projectId);
      }
    }

    if (!existing?.enabled && body.enabled) {
      const existingConfigs = await db.select().from(waterfallConfigs)
        .where(eq(waterfallConfigs.projectId, projectId));
      if (existingConfigs.length === 0) {
        await seedDefaultWaterfall(projectId);
      }
    }

    res.json(row);
  } catch (err) { next(err); }
});

async function seedDefaultWaterfall(projectId: string) {
  const [config] = await db.insert(waterfallConfigs).values({
    projectId,
    name: "Default Straight Split",
    templateType: "straight_split",
    isActive: true,
  }).returning();

  await db.insert(waterfallTiers).values({
    waterfallConfigId: config.id,
    tierOrder: 1,
    tierType: "split",
    lpSplit: "90",
    gpSplit: "10",
    notes: "Default 90/10 LP/GP split",
  });
}

// ── Tax Profiles ────────────────────────────────────────────────────────────

router.get("/tax-profiles", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const rows = await db.select().from(taxProfiles)
      .where(eq(taxProfiles.userId, userId))
      .orderBy(asc(taxProfiles.name));
    res.json(rows);
  } catch (err) { next(err); }
});

router.post("/tax-profiles", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const body = insertTaxProfileSchema.parse({ ...req.body, userId });
    const [row] = await db.insert(taxProfiles).values(body).returning();
    res.status(201).json(row);
  } catch (err) { next(err); }
});

router.put("/tax-profiles/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const allowed = z.object({
      name: z.string().optional(),
      filingType: z.enum(["individual", "corporation", "partnership", "trust", "reit", "other"]).optional(),
      jurisdictionCountry: z.string().optional(),
      jurisdictionState: z.string().nullable().optional(),
      effectiveTaxRate: z.string().nullable().optional(),
      ordinaryRate: z.string().nullable().optional(),
      ltcgRate: z.string().nullable().optional(),
      recaptureRate: z.string().nullable().optional(),
      niitRate: z.string().nullable().optional(),
      stateRate: z.string().nullable().optional(),
      localRate: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    }).parse(req.body);

    const [row] = await db.update(taxProfiles)
      .set({ ...allowed, updatedAt: new Date() })
      .where(and(eq(taxProfiles.id, req.params.id), eq(taxProfiles.userId, userId)))
      .returning();

    if (!row) return res.status(404).json({ error: "Tax profile not found" });
    res.json(row);
  } catch (err) { next(err); }
});

router.delete("/tax-profiles/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = getUserId(req);
    const [row] = await db.delete(taxProfiles)
      .where(and(eq(taxProfiles.id, req.params.id), eq(taxProfiles.userId, userId)))
      .returning();
    if (!row) return res.status(404).json({ error: "Tax profile not found" });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Partners ────────────────────────────────────────────────────────────────

router.get("/projects/:projectId/partners", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    if (!await verifyProjectAccess(req.params.projectId, orgId)) return res.status(404).json({ error: "Project not found" });
    const rows = await db.select().from(projectPartners)
      .where(eq(projectPartners.projectId, req.params.projectId))
      .orderBy(asc(projectPartners.name));
    res.json(rows);
  } catch (err) { next(err); }
});

router.post("/projects/:projectId/partners", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    if (!await verifyProjectAccess(req.params.projectId, orgId)) return res.status(404).json({ error: "Project not found" });
    const body = insertProjectPartnerSchema.parse({ ...req.body, projectId: req.params.projectId });
    const [row] = await db.insert(projectPartners).values(body).returning();
    res.status(201).json(row);
  } catch (err) { next(err); }
});

router.put("/projects/:projectId/partners/:partnerId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    if (!await verifyProjectAccess(req.params.projectId, orgId)) return res.status(404).json({ error: "Project not found" });
    const allowed = z.object({
      name: z.string().optional(),
      role: z.enum(["lp", "gp", "co_gp", "mezz", "other"]).optional(),
      entityType: z.enum(["individual", "entity"]).optional(),
      taxProfileId: z.string().nullable().optional(),
      ownershipPercent: z.string().nullable().optional(),
    }).parse(req.body);

    const [row] = await db.update(projectPartners)
      .set({ ...allowed, updatedAt: new Date() })
      .where(and(
        eq(projectPartners.id, req.params.partnerId),
        eq(projectPartners.projectId, req.params.projectId),
      ))
      .returning();

    if (!row) return res.status(404).json({ error: "Partner not found" });
    res.json(row);
  } catch (err) { next(err); }
});

router.delete("/projects/:projectId/partners/:partnerId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    if (!await verifyProjectAccess(req.params.projectId, orgId)) return res.status(404).json({ error: "Project not found" });
    const [row] = await db.delete(projectPartners)
      .where(and(
        eq(projectPartners.id, req.params.partnerId),
        eq(projectPartners.projectId, req.params.projectId),
      ))
      .returning();
    if (!row) return res.status(404).json({ error: "Partner not found" });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Equity Contributions ────────────────────────────────────────────────────

router.get("/projects/:projectId/equity-contributions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    if (!await verifyProjectAccess(req.params.projectId, orgId)) return res.status(404).json({ error: "Project not found" });
    const rows = await db.select().from(projectEquityContributions)
      .where(eq(projectEquityContributions.projectId, req.params.projectId))
      .orderBy(asc(projectEquityContributions.date));
    res.json(rows);
  } catch (err) { next(err); }
});

router.post("/projects/:projectId/equity-contributions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    if (!await verifyProjectAccess(req.params.projectId, orgId)) return res.status(404).json({ error: "Project not found" });
    const body = insertProjectEquityContributionSchema.parse({
      ...req.body,
      projectId: req.params.projectId,
    });
    const [row] = await db.insert(projectEquityContributions).values(body).returning();
    res.status(201).json(row);
  } catch (err) { next(err); }
});

router.delete("/projects/:projectId/equity-contributions/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    if (!await verifyProjectAccess(req.params.projectId, orgId)) return res.status(404).json({ error: "Project not found" });
    const [row] = await db.delete(projectEquityContributions)
      .where(and(
        eq(projectEquityContributions.id, req.params.id),
        eq(projectEquityContributions.projectId, req.params.projectId),
      ))
      .returning();
    if (!row) return res.status(404).json({ error: "Contribution not found" });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Waterfall Config + Tiers ────────────────────────────────────────────────

router.get("/projects/:projectId/waterfall", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    if (!await verifyProjectAccess(req.params.projectId, orgId)) return res.status(404).json({ error: "Project not found" });
    const configs = await db.select().from(waterfallConfigs)
      .where(eq(waterfallConfigs.projectId, req.params.projectId))
      .orderBy(asc(waterfallConfigs.name));

    const result = await Promise.all(configs.map(async (config) => {
      const tiers = await db.select().from(waterfallTiers)
        .where(eq(waterfallTiers.waterfallConfigId, config.id))
        .orderBy(asc(waterfallTiers.tierOrder));
      return { ...config, tiers };
    }));

    res.json(result);
  } catch (err) { next(err); }
});

router.post("/projects/:projectId/waterfall", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    if (!await verifyProjectAccess(req.params.projectId, orgId)) return res.status(404).json({ error: "Project not found" });
    const body = insertWaterfallConfigSchema.parse({
      ...req.body,
      projectId: req.params.projectId,
    });
    const [config] = await db.insert(waterfallConfigs).values(body).returning();
    res.status(201).json(config);
  } catch (err) { next(err); }
});

router.put("/projects/:projectId/waterfall/:configId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    if (!await verifyProjectAccess(req.params.projectId, orgId)) return res.status(404).json({ error: "Project not found" });
    const allowed = z.object({
      name: z.string().optional(),
      templateType: z.enum(["straight_split", "pref_catchup", "irr_hurdles", "custom"]).optional(),
      isActive: z.boolean().optional(),
    }).parse(req.body);

    const [row] = await db.update(waterfallConfigs)
      .set({ ...allowed, updatedAt: new Date() })
      .where(and(
        eq(waterfallConfigs.id, req.params.configId),
        eq(waterfallConfigs.projectId, req.params.projectId),
      ))
      .returning();

    if (!row) return res.status(404).json({ error: "Waterfall config not found" });
    res.json(row);
  } catch (err) { next(err); }
});

router.put("/projects/:projectId/waterfall/:configId/tiers", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    if (!await verifyProjectAccess(req.params.projectId, orgId)) return res.status(404).json({ error: "Project not found" });
    const tiersInput = z.array(z.object({
      tierOrder: z.number().int().min(1),
      tierType: z.enum(["return_of_capital", "preferred_return", "catch_up", "split", "tax_distribution"]),
      prefRate: z.string().nullable().optional(),
      catchUpTargetGpShare: z.string().nullable().optional(),
      irrHurdle: z.string().nullable().optional(),
      equityMultipleHurdle: z.string().nullable().optional(),
      lpSplit: z.string().nullable().optional(),
      gpSplit: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    })).parse(req.body);

    for (const tier of tiersInput) {
      if (tier.lpSplit && tier.gpSplit) {
        const lp = parseFloat(tier.lpSplit);
        const gp = parseFloat(tier.gpSplit);
        if (Math.abs(lp + gp - 100) > 0.01) {
          return res.status(400).json({ error: `Tier ${tier.tierOrder}: lp_split + gp_split must equal 100 (got ${lp + gp})` });
        }
      }
    }

    await db.delete(waterfallTiers)
      .where(eq(waterfallTiers.waterfallConfigId, req.params.configId));

    const rows = await db.insert(waterfallTiers)
      .values(tiersInput.map(t => ({ ...t, waterfallConfigId: req.params.configId })))
      .returning();

    res.json(rows);
  } catch (err) { next(err); }
});

// ── Tax Inputs ──────────────────────────────────────────────────────────────

router.get("/projects/:projectId/tax-inputs", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = getOrgId(req);
    if (!await verifyProjectAccess(req.params.projectId, orgId)) return res.status(404).json({ error: "Project not found" });
    const [row] = await db.select().from(projectTaxInputs)
      .where(eq(projectTaxInputs.projectId, req.params.projectId));
    if (!row) {
      return res.json({
        projectId: req.params.projectId,
        depreciationMethod: "manual",
        interestDeductible: true,
      });
    }
    res.json(row);
  } catch (err) { next(err); }
});

router.put("/projects/:projectId/tax-inputs", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const orgId = getOrgId(req);
    if (!await verifyProjectAccess(projectId, orgId)) return res.status(404).json({ error: "Project not found" });
    const body = z.object({
      annualDepreciationCents: z.string().nullable().optional(),
      depreciationMethod: z.enum(["manual", "simple_building_life", "schedule"]).optional(),
      buildingBasisCents: z.string().nullable().optional(),
      buildingLifeYears: z.number().int().nullable().optional(),
      bonusDepreciationPercent: z.string().nullable().optional(),
      amortizationAnnualCents: z.string().nullable().optional(),
      interestDeductible: z.boolean().optional(),
      saleCostBasisCents: z.string().nullable().optional(),
      accumulatedDepreciationCents: z.string().nullable().optional(),
    }).parse(req.body);

    const [existing] = await db.select().from(projectTaxInputs)
      .where(eq(projectTaxInputs.projectId, projectId));

    let row;
    if (existing) {
      [row] = await db.update(projectTaxInputs)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(projectTaxInputs.projectId, projectId))
        .returning();
    } else {
      [row] = await db.insert(projectTaxInputs)
        .values({ projectId, ...body })
        .returning();
    }
    res.json(row);
  } catch (err) { next(err); }
});

// ── Calculate (STUB — 501 Not Implemented) ──────────────────────────────────

router.post("/projects/:projectId/calculate", async (_req: Request, res: Response) => {
  res.status(501).json({
    ok: false,
    error: "NOT_IMPLEMENTED",
    message: "Tax & Waterfall engine not implemented yet.",
  });
});

export default router;
