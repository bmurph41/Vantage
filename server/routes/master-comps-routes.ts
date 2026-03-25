/**
 * Master Comps Database Routes
 *
 * Four pillars:
 *   1. ADMIN CURATION — manage global comps (verify, quality score, bulk ops)
 *   2. SUBSCRIBER ACCESS — query master + org comps, with overrides layered on
 *   3. COMP OVERRIDES — org-level annotations without touching master records
 *   4. CONTRIBUTION PIPELINE — users submit comps for master inclusion
 *   5. DEDUP ENGINE — detect when user comps match master records
 *
 * Access controlled by `master_comps` pack (add-on to `analysis`).
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import {
  salesComps,
  rateComps,
  compOverrides,
  compContributions,
  compDedupMatches,
  packCatalog,
  organizationPacks,
} from "@shared/schema";
import { eq, and, desc, sql, ilike, count, inArray, or, gte } from "drizzle-orm";

export const masterCompsRouter = Router();

// ═══════════════════════════════════════════════════════════════════════════
// 1. ADMIN CURATION (platform operator manages global comps)
// ═══════════════════════════════════════════════════════════════════════════

// GET /admin/global-comps — list all global comps with filters
masterCompsRouter.get("/admin/global-comps", async (req: Request, res: Response) => {
  try {
    const { compType = "sales", verified, search, page = "1", limit = "50" } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    if (compType === "rate") {
      const conditions = [eq(rateComps.scope, "global")];
      if (verified === "true") conditions.push(eq(rateComps.verificationStatus, "verified"));
      if (verified === "false") conditions.push(eq(rateComps.verificationStatus, "unverified"));
      if (search) conditions.push(ilike(rateComps.marina, `%${search}%`));

      const [{ total }] = await db
        .select({ total: count() })
        .from(rateComps)
        .where(and(...conditions));

      const comps = await db
        .select()
        .from(rateComps)
        .where(and(...conditions))
        .orderBy(desc(rateComps.createdAt))
        .limit(parseInt(limit as string))
        .offset(offset);

      return res.json({ comps, total, page: parseInt(page as string) });
    }

    // Sales comps (default)
    const conditions = [eq(salesComps.scope, "global")];
    if (verified === "true") conditions.push(eq(salesComps.verificationStatus, "verified"));
    if (verified === "false") conditions.push(eq(salesComps.verificationStatus, "unverified"));
    if (search) conditions.push(ilike(salesComps.marina, `%${search}%`));

    const [{ total }] = await db
      .select({ total: count() })
      .from(salesComps)
      .where(and(...conditions));

    const comps = await db
      .select()
      .from(salesComps)
      .where(and(...conditions))
      .orderBy(desc(salesComps.createdAt))
      .limit(parseInt(limit as string))
      .offset(offset);

    res.json({ comps, total, page: parseInt(page as string) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /admin/promote — promote an org comp to global (master) scope
masterCompsRouter.post("/admin/promote", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { compId, compType = "sales", requiredPack = "master_comps" } = req.body;

    if (!compId) return res.status(400).json({ error: "compId is required" });

    const table = compType === "rate" ? rateComps : salesComps;
    const [updated] = await db
      .update(table)
      .set({
        scope: "global",
        requiredPack,
        isCurated: true,
        curatedByUserId: userId,
        curatedAt: new Date(),
      })
      .where(eq(table.id, compId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Comp not found" });
    res.json({ promoted: true, comp: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /admin/demote — remove a comp from global scope (back to org)
masterCompsRouter.post("/admin/demote", async (req: Request, res: Response) => {
  try {
    const { compId, compType = "sales" } = req.body;
    const table = compType === "rate" ? rateComps : salesComps;

    const [updated] = await db
      .update(table)
      .set({
        scope: "org",
        requiredPack: null,
        isCurated: false,
      })
      .where(eq(table.id, compId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Comp not found" });
    res.json({ demoted: true, comp: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /admin/verify/:compId — verify or update quality of a global comp
masterCompsRouter.patch("/admin/verify/:compId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { compType = "sales", verificationStatus, dataQualityScore, verificationNotes } = req.body;
    const table = compType === "rate" ? rateComps : salesComps;

    const updateData: Record<string, any> = {};
    if (verificationStatus) updateData.verificationStatus = verificationStatus;
    if (dataQualityScore !== undefined) updateData.dataQualityScore = dataQualityScore;
    if (verificationNotes) updateData.verificationNotes = verificationNotes;
    updateData.lastVerifiedAt = new Date();
    updateData.lastVerifiedBy = userId;

    const [updated] = await db
      .update(table)
      .set(updateData)
      .where(eq(table.id, req.params.compId))
      .returning();

    if (!updated) return res.status(404).json({ error: "Comp not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /admin/bulk-promote — promote multiple comps at once
masterCompsRouter.post("/admin/bulk-promote", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { compIds, compType = "sales", requiredPack = "master_comps" } = req.body;

    if (!compIds?.length) return res.status(400).json({ error: "compIds[] required" });

    const table = compType === "rate" ? rateComps : salesComps;

    await db
      .update(table)
      .set({
        scope: "global",
        requiredPack,
        isCurated: true,
        curatedByUserId: userId,
        curatedAt: new Date(),
      })
      .where(inArray(table.id, compIds));

    res.json({ promoted: compIds.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /admin/stats — master database statistics
masterCompsRouter.get("/admin/stats", async (req: Request, res: Response) => {
  try {
    const [salesStats] = await db
      .select({
        total: count(),
        verified: sql<number>`count(*) filter (where ${salesComps.verificationStatus} = 'verified')`,
        unverified: sql<number>`count(*) filter (where ${salesComps.verificationStatus} = 'unverified')`,
        avgQuality: sql<number>`avg(${salesComps.dataQualityScore})`,
      })
      .from(salesComps)
      .where(eq(salesComps.scope, "global"));

    const [rateStats] = await db
      .select({
        total: count(),
        verified: sql<number>`count(*) filter (where ${rateComps.verificationStatus} = 'verified')`,
        unverified: sql<number>`count(*) filter (where ${rateComps.verificationStatus} = 'unverified')`,
        avgQuality: sql<number>`avg(${rateComps.dataQualityScore})`,
      })
      .from(rateComps)
      .where(eq(rateComps.scope, "global"));

    const [contributionStats] = await db
      .select({
        total: count(),
        submitted: sql<number>`count(*) filter (where ${compContributions.status} = 'submitted')`,
        approved: sql<number>`count(*) filter (where ${compContributions.status} = 'approved')`,
        rejected: sql<number>`count(*) filter (where ${compContributions.status} = 'rejected')`,
      })
      .from(compContributions);

    // Count subscribing orgs
    const [subStats] = await db
      .select({ subscribers: count() })
      .from(organizationPacks)
      .where(
        and(
          eq(organizationPacks.packType, "master_comps"),
          eq(organizationPacks.status, "active"),
        ),
      );

    res.json({
      salesComps: salesStats,
      rateComps: rateStats,
      contributions: contributionStats,
      subscribers: subStats?.subscribers || 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. SUBSCRIBER ACCESS (query master + org comps with overrides)
// ═══════════════════════════════════════════════════════════════════════════

// GET /comps — unified query: org comps + master comps (with overrides layered)
masterCompsRouter.get("/comps", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const {
      compType = "sales",
      source, // 'all' | 'org' | 'master'
      state,
      city,
      minPrice,
      maxPrice,
      minYear,
      maxYear,
      search,
      page = "1",
      limit = "50",
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const sourceFilter = (source as string) || "all";
    const table = compType === "rate" ? rateComps : salesComps;

    // Build conditions for org comps
    const orgConditions = [eq(table.orgId, orgId), eq(table.scope, "org")];
    // Build conditions for global comps
    const globalConditions = [eq(table.scope, "global")];

    // Shared filters
    const sharedFilters = (conditions: any[]) => {
      if (state) conditions.push(eq(table.state, state as string));
      if (city) conditions.push(ilike(table.city, `%${city}%`));
      if (search) conditions.push(ilike(table.marina, `%${search}%`));
      if (minPrice) conditions.push(gte(table.salePrice, parseInt(minPrice as string)));
      if (minYear) conditions.push(gte(table.saleYear, parseInt(minYear as string)));
    };

    sharedFilters(orgConditions);
    sharedFilters(globalConditions);

    let orgComps: any[] = [];
    let globalComps: any[] = [];

    // Fetch org comps
    if (sourceFilter !== "master") {
      orgComps = await db
        .select()
        .from(table)
        .where(and(...orgConditions))
        .orderBy(desc(table.saleYear))
        .limit(limitNum)
        .offset(offset);

      orgComps = orgComps.map((c) => ({ ...c, _source: "org" }));
    }

    // Fetch global/master comps (if org has master_comps pack or analysis pack)
    if (sourceFilter !== "org") {
      const hasMasterPack = await checkMasterCompsAccess(orgId);

      if (hasMasterPack) {
        globalComps = await db
          .select()
          .from(table)
          .where(and(...globalConditions))
          .orderBy(desc(table.saleYear))
          .limit(limitNum);

        // Load overrides for this org
        const overrides = await db
          .select()
          .from(compOverrides)
          .where(
            and(
              eq(compOverrides.orgId, orgId),
              eq(compOverrides.compType, compType as string),
            ),
          );

        const overrideMap = new Map(overrides.map((o) => [o.compId, o]));

        // Apply overrides
        globalComps = globalComps
          .map((comp) => {
            const override = overrideMap.get(comp.id);
            if (override?.isExcluded) return null; // Skip excluded

            return {
              ...comp,
              _source: "master",
              _override: override
                ? {
                    overrideId: override.id,
                    salePrice: override.overrideSalePrice ?? comp.salePrice,
                    capRate: override.overrideCapRate ?? comp.capRate,
                    noi: override.overrideNoi ?? comp.noi,
                    notes: override.overrideNotes,
                    internalRating: override.internalRating,
                    internalTags: override.internalTags,
                    customOverrides: override.customOverrides,
                  }
                : null,
            };
          })
          .filter(Boolean);
      }
    }

    // Merge and sort
    const allComps = [...orgComps, ...globalComps].sort((a, b) => {
      return (b.saleYear || 0) - (a.saleYear || 0);
    });

    res.json({
      comps: allComps.slice(0, limitNum),
      total: allComps.length,
      orgCount: orgComps.length,
      masterCount: globalComps.length,
      page: pageNum,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. COMP OVERRIDES (org-level annotations on master comps)
// ═══════════════════════════════════════════════════════════════════════════

// POST /overrides — create or update an override for a master comp
masterCompsRouter.post("/overrides", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const userId = (req as any).user.id;
    const { compId, compType, ...overrideData } = req.body;

    if (!compId || !compType) {
      return res.status(400).json({ error: "compId and compType are required" });
    }

    // Check if override already exists
    const [existing] = await db
      .select()
      .from(compOverrides)
      .where(
        and(
          eq(compOverrides.orgId, orgId),
          eq(compOverrides.compId, compId),
          eq(compOverrides.compType, compType),
        ),
      );

    if (existing) {
      // Update existing
      const [updated] = await db
        .update(compOverrides)
        .set({
          ...overrideData,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(compOverrides.id, existing.id))
        .returning();
      return res.json(updated);
    }

    // Create new
    const [created] = await db
      .insert(compOverrides)
      .values({
        orgId,
        compId,
        compType,
        ...overrideData,
        createdBy: userId,
      })
      .returning();

    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /overrides — list all overrides for this org
masterCompsRouter.get("/overrides", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { compType } = req.query;

    const conditions = [eq(compOverrides.orgId, orgId)];
    if (compType) conditions.push(eq(compOverrides.compType, compType as string));

    const overrides = await db
      .select()
      .from(compOverrides)
      .where(and(...conditions))
      .orderBy(desc(compOverrides.updatedAt));

    res.json(overrides);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /overrides/:compId — get override for a specific comp
masterCompsRouter.get("/overrides/:compId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const [override] = await db
      .select()
      .from(compOverrides)
      .where(
        and(eq(compOverrides.orgId, orgId), eq(compOverrides.compId, req.params.compId)),
      );
    if (!override) return res.status(404).json({ error: "No override found" });
    res.json(override);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /overrides/:compId — remove an override (revert to master values)
masterCompsRouter.delete("/overrides/:compId", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const [deleted] = await db
      .delete(compOverrides)
      .where(
        and(eq(compOverrides.orgId, orgId), eq(compOverrides.compId, req.params.compId)),
      )
      .returning();
    if (!deleted) return res.status(404).json({ error: "No override found" });
    res.json({ deleted: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /overrides/exclude — exclude a master comp from org's view
masterCompsRouter.post("/overrides/exclude", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const userId = (req as any).user.id;
    const { compId, compType, reason } = req.body;

    const [existing] = await db
      .select()
      .from(compOverrides)
      .where(
        and(
          eq(compOverrides.orgId, orgId),
          eq(compOverrides.compId, compId),
        ),
      );

    if (existing) {
      const [updated] = await db
        .update(compOverrides)
        .set({ isExcluded: true, excludeReason: reason, updatedBy: userId, updatedAt: new Date() })
        .where(eq(compOverrides.id, existing.id))
        .returning();
      return res.json(updated);
    }

    const [created] = await db
      .insert(compOverrides)
      .values({
        orgId,
        compId,
        compType: compType || "sales",
        isExcluded: true,
        excludeReason: reason,
        createdBy: userId,
      })
      .returning();

    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. CONTRIBUTION PIPELINE (users submit comps for master inclusion)
// ═══════════════════════════════════════════════════════════════════════════

// POST /contributions — submit a comp for master database consideration
masterCompsRouter.post("/contributions", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const userId = (req as any).user.id;
    const { compId, compType, submitterNotes, dataSource, confidenceLevel } = req.body;

    if (!compId || !compType) {
      return res.status(400).json({ error: "compId and compType are required" });
    }

    // Verify comp belongs to this org
    const table = compType === "rate" ? rateComps : salesComps;
    const [comp] = await db
      .select()
      .from(table)
      .where(and(eq(table.id, compId), eq(table.orgId, orgId)));

    if (!comp) return res.status(404).json({ error: "Comp not found in your organization" });
    if (comp.scope === "global") {
      return res.status(400).json({ error: "This comp is already in the master database" });
    }

    // Check for existing pending submission
    const [existing] = await db
      .select()
      .from(compContributions)
      .where(
        and(
          eq(compContributions.compId, compId),
          eq(compContributions.status, "submitted"),
        ),
      );

    if (existing) {
      return res.status(409).json({ error: "This comp already has a pending submission" });
    }

    const [contribution] = await db
      .insert(compContributions)
      .values({
        orgId,
        compId,
        compType,
        submittedBy: userId,
        submitterNotes,
        dataSource: dataSource || "direct_knowledge",
        confidenceLevel: confidenceLevel || "medium",
      })
      .returning();

    res.status(201).json(contribution);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /contributions — list contributions (admin: all, user: own org's)
masterCompsRouter.get("/contributions", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { status, all } = req.query;

    // If admin requests all, don't filter by org (admin check would be done by middleware)
    const conditions = [];
    if (!all) conditions.push(eq(compContributions.orgId, orgId));
    if (status) conditions.push(eq(compContributions.status, status as string));

    const contributions = await db
      .select()
      .from(compContributions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(compContributions.createdAt))
      .limit(100);

    res.json(contributions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /contributions/:id/review — admin reviews a contribution
masterCompsRouter.patch("/contributions/:id/review", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { status, reviewNotes } = req.body; // approved | rejected

    if (!["approved", "rejected", "under_review"].includes(status)) {
      return res.status(400).json({ error: "status must be approved, rejected, or under_review" });
    }

    const [contribution] = await db
      .select()
      .from(compContributions)
      .where(eq(compContributions.id, req.params.id));

    if (!contribution) return res.status(404).json({ error: "Contribution not found" });

    const updateData: Record<string, any> = {
      status,
      reviewedBy: userId,
      reviewedAt: new Date(),
      reviewNotes,
    };

    // If approved, promote the comp to global scope
    if (status === "approved") {
      const table = contribution.compType === "rate" ? rateComps : salesComps;

      const [promoted] = await db
        .update(table)
        .set({
          scope: "global",
          requiredPack: "master_comps",
          isCurated: true,
          curatedByUserId: userId,
          curatedAt: new Date(),
        })
        .where(eq(table.id, contribution.compId))
        .returning();

      if (promoted) {
        updateData.promotedCompId = promoted.id;
      }
    }

    const [updated] = await db
      .update(compContributions)
      .set(updateData)
      .where(eq(compContributions.id, req.params.id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. DEDUP ENGINE (detect matching comps on upload)
// ═══════════════════════════════════════════════════════════════════════════

// POST /dedup/check — check a comp against master database for duplicates
masterCompsRouter.post("/dedup/check", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { compId, compType = "sales" } = req.body;

    if (!compId) return res.status(400).json({ error: "compId is required" });

    const table = compType === "rate" ? rateComps : salesComps;

    // Get the source comp
    const [sourceComp] = await db
      .select()
      .from(table)
      .where(eq(table.id, compId));

    if (!sourceComp) return res.status(404).json({ error: "Comp not found" });

    // Search for potential matches in global comps
    const globalComps = await db
      .select()
      .from(table)
      .where(eq(table.scope, "global"));

    const matches: any[] = [];

    for (const masterComp of globalComps) {
      if (masterComp.id === sourceComp.id) continue;

      const { score, matchedFields } = computeSimilarity(sourceComp, masterComp);

      if (score >= 60) {
        matches.push({
          masterCompId: masterComp.id,
          masterMarina: masterComp.marina,
          masterAddress: masterComp.address,
          masterSaleYear: masterComp.saleYear,
          masterSalePrice: masterComp.salePrice,
          similarityScore: score,
          matchFields: matchedFields,
        });
      }
    }

    // Sort by similarity
    matches.sort((a, b) => b.similarityScore - a.similarityScore);

    // Store matches
    for (const match of matches.slice(0, 10)) {
      // Check if already recorded
      const [existing] = await db
        .select()
        .from(compDedupMatches)
        .where(
          and(
            eq(compDedupMatches.sourceCompId, compId),
            eq(compDedupMatches.matchedCompId, match.masterCompId),
          ),
        );

      if (!existing) {
        await db.insert(compDedupMatches).values({
          orgId,
          sourceCompId: compId,
          matchedCompId: match.masterCompId,
          compType,
          similarityScore: String(match.similarityScore),
          matchFields: match.matchFields,
          resolution: "pending",
        });
      }
    }

    res.json({
      sourceCompId: compId,
      potentialMatches: matches.length,
      matches: matches.slice(0, 10),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /dedup/batch-check — check multiple comps at once
masterCompsRouter.post("/dedup/batch-check", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { compIds, compType = "sales" } = req.body;

    if (!compIds?.length) return res.status(400).json({ error: "compIds[] required" });

    const table = compType === "rate" ? rateComps : salesComps;

    // Get all global comps once
    const globalComps = await db
      .select()
      .from(table)
      .where(eq(table.scope, "global"));

    const results: any[] = [];

    for (const compId of compIds.slice(0, 100)) {
      const [sourceComp] = await db
        .select()
        .from(table)
        .where(eq(table.id, compId));

      if (!sourceComp) continue;

      const topMatch = globalComps
        .filter((gc) => gc.id !== sourceComp.id)
        .map((gc) => {
          const { score, matchedFields } = computeSimilarity(sourceComp, gc);
          return { masterCompId: gc.id, masterMarina: gc.marina, score, matchedFields };
        })
        .filter((m) => m.score >= 60)
        .sort((a, b) => b.score - a.score)[0];

      results.push({
        compId,
        marina: sourceComp.marina,
        hasPotentialMatch: !!topMatch,
        topMatch: topMatch || null,
      });
    }

    const withMatches = results.filter((r) => r.hasPotentialMatch);

    res.json({
      checked: results.length,
      withMatches: withMatches.length,
      noMatches: results.length - withMatches.length,
      results,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /dedup/matches — list pending dedup matches for org
masterCompsRouter.get("/dedup/matches", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const { resolution } = req.query;

    const conditions = [eq(compDedupMatches.orgId, orgId)];
    if (resolution) conditions.push(eq(compDedupMatches.resolution, resolution as string));

    const matches = await db
      .select()
      .from(compDedupMatches)
      .where(and(...conditions))
      .orderBy(desc(compDedupMatches.createdAt))
      .limit(100);

    res.json(matches);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /dedup/matches/:id/resolve — resolve a dedup match
masterCompsRouter.patch("/dedup/matches/:id/resolve", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const orgId = (req as any).user.orgId;
    const { resolution } = req.body; // link | keep_both | dismiss

    if (!["link", "keep_both", "dismiss"].includes(resolution)) {
      return res.status(400).json({ error: "resolution must be link, keep_both, or dismiss" });
    }

    const [updated] = await db
      .update(compDedupMatches)
      .set({
        resolution,
        resolvedBy: userId,
        resolvedAt: new Date(),
      })
      .where(
        and(eq(compDedupMatches.id, req.params.id), eq(compDedupMatches.orgId, orgId)),
      )
      .returning();

    if (!updated) return res.status(404).json({ error: "Match not found" });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PACK ACCESS CHECK
// ═══════════════════════════════════════════════════════════════════════════

// GET /access — check if org has master comps access
masterCompsRouter.get("/access", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;
    const hasAccess = await checkMasterCompsAccess(orgId);

    res.json({
      hasAccess,
      packType: "master_comps",
      message: hasAccess
        ? "Master Comps database access is active"
        : "Subscribe to the Master Comps pack to access the curated database",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

async function checkMasterCompsAccess(orgId: string): Promise<boolean> {
  // Check for master_comps pack OR analytics_pro pack (either grants access)
  const [pack] = await db
    .select()
    .from(organizationPacks)
    .where(
      and(
        eq(organizationPacks.orgId, orgId),
        eq(organizationPacks.status, "active"),
        or(
          eq(organizationPacks.packType, "master_comps"),
          eq(organizationPacks.packType, "analytics_pro"),
        ),
      ),
    )
    .limit(1);

  if (pack) return true;

  // Dev mode bypass: if no packs at all, allow access
  if (process.env.NODE_ENV === "development") {
    const [anyPack] = await db
      .select({ count: count() })
      .from(organizationPacks)
      .where(eq(organizationPacks.orgId, orgId));

    if ((anyPack?.count || 0) === 0) return true;
  }

  return false;
}

function computeSimilarity(
  a: any,
  b: any,
): { score: number; matchedFields: string[] } {
  let score = 0;
  const matchedFields: string[] = [];

  // Marina name match (fuzzy)
  if (a.marina && b.marina) {
    const aName = (a.marina as string).toLowerCase().replace(/[^a-z0-9]/g, "");
    const bName = (b.marina as string).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (aName === bName) {
      score += 40;
      matchedFields.push("marina (exact)");
    } else if (aName.includes(bName) || bName.includes(aName)) {
      score += 25;
      matchedFields.push("marina (partial)");
    }
  }

  // Address match
  if (a.address && b.address) {
    const aAddr = (a.address as string).toLowerCase().replace(/[^a-z0-9]/g, "");
    const bAddr = (b.address as string).toLowerCase().replace(/[^a-z0-9]/g, "");
    if (aAddr === bAddr) {
      score += 30;
      matchedFields.push("address");
    } else if (aAddr.includes(bAddr) || bAddr.includes(aAddr)) {
      score += 15;
      matchedFields.push("address (partial)");
    }
  }

  // City + State match
  if (a.city && b.city && a.state && b.state) {
    if (
      (a.city as string).toLowerCase() === (b.city as string).toLowerCase() &&
      (a.state as string).toLowerCase() === (b.state as string).toLowerCase()
    ) {
      score += 10;
      matchedFields.push("city_state");
    }
  }

  // Sale year match
  if (a.saleYear && b.saleYear) {
    if (a.saleYear === b.saleYear) {
      score += 10;
      matchedFields.push("saleYear");
    } else if (Math.abs(a.saleYear - b.saleYear) <= 1) {
      score += 5;
      matchedFields.push("saleYear (±1)");
    }
  }

  // Sale price proximity (within 10%)
  if (a.salePrice && b.salePrice && a.salePrice > 0 && b.salePrice > 0) {
    const ratio = Math.min(a.salePrice, b.salePrice) / Math.max(a.salePrice, b.salePrice);
    if (ratio >= 0.95) {
      score += 10;
      matchedFields.push("salePrice (±5%)");
    } else if (ratio >= 0.90) {
      score += 5;
      matchedFields.push("salePrice (±10%)");
    }
  }

  return { score: Math.min(100, score), matchedFields };
}
