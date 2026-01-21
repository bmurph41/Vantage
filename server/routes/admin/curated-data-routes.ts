import { Router } from "express";
import { db } from "../../db";
import { 
  salesComps, 
  rateComps, 
  industryStandards,
  users,
  marinaListings,
  marinaScrapeources
} from "../../../shared/schema";
import { eq, and, desc, sql, or, isNull } from "drizzle-orm";
import { seedGlobalBrokerSources, GLOBAL_BROKER_SOURCES } from "../../marinamatch/services/global-broker-sources";
import { 
  runScheduledScrape, 
  runSingleSourceScrape, 
  getSchedulerStatus,
  startScheduler,
  stopScheduler
} from "../../marinamatch/services/listing-scheduler";

export const curatedDataRouter = Router();

// Middleware to check if user is admin/owner
const requireAdmin = (req: any, res: any, next: any) => {
  const user = req.user;
  if (!user || (user.role !== 'owner' && !user.isAdmin)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

// Apply admin check to all routes
curatedDataRouter.use(requireAdmin);

// =====================================================
// CURATED SALES COMPS
// =====================================================

// Get all global/curated sales comps
curatedDataRouter.get("/sales-comps", async (req, res) => {
  try {
    const comps = await db
      .select({
        id: salesComps.id,
        marina: salesComps.marina,
        city: salesComps.city,
        state: salesComps.state,
        salePrice: salesComps.salePrice,
        saleYear: salesComps.saleYear,
        saleMonth: salesComps.saleMonth,
        wetSlips: salesComps.wetSlips,
        dryRacks: salesComps.dryRacks,
        capRate: salesComps.capRate,
        scope: salesComps.scope,
        requiredPack: salesComps.requiredPack,
        isCurated: salesComps.isCurated,
        curatedAt: salesComps.curatedAt,
        createdAt: salesComps.createdAt,
      })
      .from(salesComps)
      .where(eq(salesComps.scope, "global"))
      .orderBy(desc(salesComps.createdAt))
      .limit(500);

    res.json(comps);
  } catch (error) {
    console.error("Error fetching curated sales comps:", error);
    res.status(500).json({ error: "Failed to fetch curated sales comps" });
  }
});

// Create a new global sales comp
curatedDataRouter.post("/sales-comps", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const data = req.body;

    const [comp] = await db
      .insert(salesComps)
      .values({
        ...data,
        orgId: req.tenant?.orgId || data.orgId,
        createdBy: userId,
        scope: "global",
        isCurated: true,
        curatedByUserId: userId,
        curatedAt: new Date(),
        requiredPack: data.requiredPack || "analysis",
      })
      .returning();

    res.json(comp);
  } catch (error) {
    console.error("Error creating curated sales comp:", error);
    res.status(500).json({ error: "Failed to create curated sales comp" });
  }
});

// Update a global sales comp
curatedDataRouter.patch("/sales-comps/:id", async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const updates = req.body;

    const [comp] = await db
      .update(salesComps)
      .set({
        ...updates,
        updatedBy: userId,
        updatedAt: new Date(),
        curatedByUserId: userId,
        curatedAt: new Date(),
      })
      .where(and(eq(salesComps.id, id), eq(salesComps.scope, "global")))
      .returning();

    if (!comp) {
      return res.status(404).json({ error: "Curated sales comp not found" });
    }

    res.json(comp);
  } catch (error) {
    console.error("Error updating curated sales comp:", error);
    res.status(500).json({ error: "Failed to update curated sales comp" });
  }
});

// Promote an org comp to global
curatedDataRouter.post("/sales-comps/:id/promote", async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { requiredPack } = req.body;

    const [comp] = await db
      .update(salesComps)
      .set({
        scope: "global",
        isCurated: true,
        curatedByUserId: userId,
        curatedAt: new Date(),
        requiredPack: requiredPack || "analysis",
      })
      .where(eq(salesComps.id, id))
      .returning();

    if (!comp) {
      return res.status(404).json({ error: "Sales comp not found" });
    }

    res.json(comp);
  } catch (error) {
    console.error("Error promoting sales comp:", error);
    res.status(500).json({ error: "Failed to promote sales comp" });
  }
});

// =====================================================
// CURATED RATE COMPS
// =====================================================

// Get all global/curated rate comps
curatedDataRouter.get("/rate-comps", async (req, res) => {
  try {
    const comps = await db
      .select({
        id: rateComps.id,
        marina: rateComps.marina,
        city: rateComps.city,
        state: rateComps.state,
        rateType: rateComps.rateType,
        rateAmount: rateComps.rateAmount,
        wetSlips: rateComps.wetSlips,
        dryRacks: rateComps.dryRacks,
        scope: rateComps.scope,
        requiredPack: rateComps.requiredPack,
        isCurated: rateComps.isCurated,
        curatedAt: rateComps.curatedAt,
        createdAt: rateComps.createdAt,
      })
      .from(rateComps)
      .where(eq(rateComps.scope, "global"))
      .orderBy(desc(rateComps.createdAt))
      .limit(500);

    res.json(comps);
  } catch (error) {
    console.error("Error fetching curated rate comps:", error);
    res.status(500).json({ error: "Failed to fetch curated rate comps" });
  }
});

// Create a new global rate comp
curatedDataRouter.post("/rate-comps", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const data = req.body;

    const [comp] = await db
      .insert(rateComps)
      .values({
        ...data,
        orgId: req.tenant?.orgId || data.orgId,
        createdBy: userId,
        scope: "global",
        isCurated: true,
        curatedByUserId: userId,
        curatedAt: new Date(),
        requiredPack: data.requiredPack || "analysis",
      })
      .returning();

    res.json(comp);
  } catch (error) {
    console.error("Error creating curated rate comp:", error);
    res.status(500).json({ error: "Failed to create curated rate comp" });
  }
});

// Update a global rate comp
curatedDataRouter.patch("/rate-comps/:id", async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const updates = req.body;

    const [comp] = await db
      .update(rateComps)
      .set({
        ...updates,
        updatedBy: userId,
        updatedAt: new Date(),
        curatedByUserId: userId,
        curatedAt: new Date(),
      })
      .where(and(eq(rateComps.id, id), eq(rateComps.scope, "global")))
      .returning();

    if (!comp) {
      return res.status(404).json({ error: "Curated rate comp not found" });
    }

    res.json(comp);
  } catch (error) {
    console.error("Error updating curated rate comp:", error);
    res.status(500).json({ error: "Failed to update curated rate comp" });
  }
});

// =====================================================
// INDUSTRY STANDARDS
// =====================================================

// Get all industry standards
curatedDataRouter.get("/industry-standards", async (req, res) => {
  try {
    const { category, region, year } = req.query;
    
    let query = db.select().from(industryStandards);
    
    const conditions = [eq(industryStandards.scope, "global")];
    
    if (category) {
      conditions.push(eq(industryStandards.category, category as string));
    }
    if (region) {
      conditions.push(eq(industryStandards.region, region as string));
    }
    if (year) {
      conditions.push(eq(industryStandards.effectiveYear, parseInt(year as string)));
    }

    const standards = await db
      .select()
      .from(industryStandards)
      .where(and(...conditions))
      .orderBy(desc(industryStandards.effectiveYear), industryStandards.category);

    res.json(standards);
  } catch (error) {
    console.error("Error fetching industry standards:", error);
    res.status(500).json({ error: "Failed to fetch industry standards" });
  }
});

// Create a new industry standard
curatedDataRouter.post("/industry-standards", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const data = req.body;

    const [standard] = await db
      .insert(industryStandards)
      .values({
        ...data,
        scope: "global",
        isCurated: true,
        createdBy: userId,
        requiredPack: data.requiredPack || "analytics_pro",
      })
      .returning();

    res.json(standard);
  } catch (error) {
    console.error("Error creating industry standard:", error);
    res.status(500).json({ error: "Failed to create industry standard" });
  }
});

// Update an industry standard
curatedDataRouter.patch("/industry-standards/:id", async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const updates = req.body;

    const [standard] = await db
      .update(industryStandards)
      .set({
        ...updates,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(industryStandards.id, id))
      .returning();

    if (!standard) {
      return res.status(404).json({ error: "Industry standard not found" });
    }

    res.json(standard);
  } catch (error) {
    console.error("Error updating industry standard:", error);
    res.status(500).json({ error: "Failed to update industry standard" });
  }
});

// Delete an industry standard
curatedDataRouter.delete("/industry-standards/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [deleted] = await db
      .delete(industryStandards)
      .where(eq(industryStandards.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Industry standard not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting industry standard:", error);
    res.status(500).json({ error: "Failed to delete industry standard" });
  }
});

// =====================================================
// ANALYTICS
// =====================================================

// Get curated data stats
curatedDataRouter.get("/stats", async (req, res) => {
  try {
    const [salesStats] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(salesComps)
      .where(eq(salesComps.scope, "global"));

    const [rateStats] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(rateComps)
      .where(eq(rateComps.scope, "global"));

    const [standardsStats] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(industryStandards);

    const [listingsStats] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(marinaListings)
      .where(eq(marinaListings.scope, "global"));

    const [sourcesStats] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(marinaScrapeources)
      .where(eq(marinaScrapeources.isGlobalSource, true));

    res.json({
      salesComps: salesStats?.count || 0,
      rateComps: rateStats?.count || 0,
      industryStandards: standardsStats?.count || 0,
      globalListings: listingsStats?.count || 0,
      globalSources: sourcesStats?.count || 0,
    });
  } catch (error) {
    console.error("Error fetching curated data stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// =====================================================
// GLOBAL MARINA LISTINGS
// =====================================================

// Get all global/curated marina listings
curatedDataRouter.get("/listings", async (req, res) => {
  try {
    const { status, state, limit = "100", offset = "0" } = req.query;
    
    const conditions: any[] = [eq(marinaListings.scope, "global")];
    
    if (status && status !== "all") {
      conditions.push(eq(marinaListings.status, status as string));
    }
    if (state && state !== "all") {
      conditions.push(eq(marinaListings.state, state as string));
    }

    const listings = await db
      .select()
      .from(marinaListings)
      .where(and(...conditions))
      .orderBy(desc(marinaListings.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(marinaListings)
      .where(and(...conditions));

    res.json({
      listings,
      total: countResult?.count || 0,
      page: Math.floor(parseInt(offset as string) / parseInt(limit as string)) + 1,
      pageSize: parseInt(limit as string),
    });
  } catch (error) {
    console.error("Error fetching global listings:", error);
    res.status(500).json({ error: "Failed to fetch global listings" });
  }
});

// Promote org listing to global
curatedDataRouter.post("/listings/:id/promote", async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { requiredPack = "analysis" } = req.body;

    const [listing] = await db
      .update(marinaListings)
      .set({
        scope: "global",
        isCurated: true,
        curatedByUserId: userId,
        curatedAt: new Date(),
        requiredPack,
        updatedAt: new Date(),
      })
      .where(eq(marinaListings.id, id))
      .returning();

    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    res.json(listing);
  } catch (error) {
    console.error("Error promoting listing to global:", error);
    res.status(500).json({ error: "Failed to promote listing" });
  }
});

// Demote global listing back to org-scoped
curatedDataRouter.post("/listings/:id/demote", async (req, res) => {
  try {
    const { id } = req.params;

    const [listing] = await db
      .update(marinaListings)
      .set({
        scope: "org",
        isCurated: false,
        requiredPack: null,
        updatedAt: new Date(),
      })
      .where(eq(marinaListings.id, id))
      .returning();

    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    res.json(listing);
  } catch (error) {
    console.error("Error demoting listing:", error);
    res.status(500).json({ error: "Failed to demote listing" });
  }
});

// Update global listing
curatedDataRouter.patch("/listings/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const [listing] = await db
      .update(marinaListings)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(
        eq(marinaListings.id, id),
        eq(marinaListings.scope, "global")
      ))
      .returning();

    if (!listing) {
      return res.status(404).json({ error: "Global listing not found" });
    }

    res.json(listing);
  } catch (error) {
    console.error("Error updating global listing:", error);
    res.status(500).json({ error: "Failed to update listing" });
  }
});

// Delete global listing
curatedDataRouter.delete("/listings/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [deleted] = await db
      .delete(marinaListings)
      .where(and(
        eq(marinaListings.id, id),
        eq(marinaListings.scope, "global")
      ))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Global listing not found" });
    }

    res.json({ success: true, deleted });
  } catch (error) {
    console.error("Error deleting global listing:", error);
    res.status(500).json({ error: "Failed to delete listing" });
  }
});

// =====================================================
// GLOBAL SCRAPE SOURCES
// =====================================================

// Get all global scrape sources
curatedDataRouter.get("/scrape-sources", async (req, res) => {
  try {
    const sources = await db
      .select()
      .from(marinaScrapeources)
      .where(eq(marinaScrapeources.isGlobalSource, true))
      .orderBy(desc(marinaScrapeources.createdAt));

    res.json(sources);
  } catch (error) {
    console.error("Error fetching global scrape sources:", error);
    res.status(500).json({ error: "Failed to fetch global sources" });
  }
});

// Create a new global scrape source
curatedDataRouter.post("/scrape-sources", async (req, res) => {
  try {
    const orgId = (req as any).user?.orgId || (req as any).tenant?.orgId;
    const data = req.body;

    const [source] = await db
      .insert(marinaScrapeources)
      .values({
        ...data,
        orgId: orgId || "system",
        scope: "global",
        isGlobalSource: true,
        isManaged: true,
      })
      .returning();

    res.json(source);
  } catch (error) {
    console.error("Error creating global scrape source:", error);
    res.status(500).json({ error: "Failed to create global source" });
  }
});

// Update a global scrape source
curatedDataRouter.patch("/scrape-sources/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const [source] = await db
      .update(marinaScrapeources)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(
        eq(marinaScrapeources.id, id),
        eq(marinaScrapeources.isGlobalSource, true)
      ))
      .returning();

    if (!source) {
      return res.status(404).json({ error: "Global source not found" });
    }

    res.json(source);
  } catch (error) {
    console.error("Error updating global scrape source:", error);
    res.status(500).json({ error: "Failed to update source" });
  }
});

// Delete a global scrape source
curatedDataRouter.delete("/scrape-sources/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [deleted] = await db
      .delete(marinaScrapeources)
      .where(and(
        eq(marinaScrapeources.id, id),
        eq(marinaScrapeources.isGlobalSource, true)
      ))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Global source not found" });
    }

    res.json({ success: true, deleted });
  } catch (error) {
    console.error("Error deleting global scrape source:", error);
    res.status(500).json({ error: "Failed to delete source" });
  }
});

// Trigger scrape for a global source
curatedDataRouter.post("/scrape-sources/:id/scrape", async (req, res) => {
  try {
    const { id } = req.params;
    
    const [source] = await db
      .select()
      .from(marinaScrapeources)
      .where(and(
        eq(marinaScrapeources.id, id),
        eq(marinaScrapeources.isGlobalSource, true)
      ));

    if (!source) {
      return res.status(404).json({ error: "Global source not found" });
    }

    res.json({ 
      success: true, 
      message: "Scrape initiated - running in background",
      sourceId: id,
      sourceName: source.name,
    });

    runSingleSourceScrape(id).then(result => {
      console.log(`[Admin] Scrape completed for ${source.name}:`, result);
    }).catch(err => {
      console.error(`[Admin] Background scrape failed for ${source.name}:`, err);
    });
  } catch (error) {
    console.error("Error triggering scrape:", error);
    res.status(500).json({ error: "Failed to trigger scrape" });
  }
});

curatedDataRouter.post("/scrape-sources/run-all", async (req, res) => {
  try {
    res.json({ 
      success: true, 
      message: "Full scrape initiated - running in background",
    });

    runScheduledScrape().then(result => {
      console.log("[Admin] Full scrape completed:", result);
    }).catch(err => {
      console.error("[Admin] Full scrape failed:", err);
    });
  } catch (error) {
    console.error("Error triggering full scrape:", error);
    res.status(500).json({ error: "Failed to trigger full scrape" });
  }
});

curatedDataRouter.get("/scheduler/status", async (req, res) => {
  try {
    const status = await getSchedulerStatus();
    res.json(status);
  } catch (error) {
    console.error("Error getting scheduler status:", error);
    res.status(500).json({ error: "Failed to get scheduler status" });
  }
});

curatedDataRouter.post("/scheduler/start", async (req, res) => {
  try {
    startScheduler();
    const status = await getSchedulerStatus();
    res.json({ success: true, message: "Scheduler started", status });
  } catch (error) {
    console.error("Error starting scheduler:", error);
    res.status(500).json({ error: "Failed to start scheduler" });
  }
});

curatedDataRouter.post("/scheduler/stop", async (req, res) => {
  try {
    stopScheduler();
    const status = await getSchedulerStatus();
    res.json({ success: true, message: "Scheduler stopped", status });
  } catch (error) {
    console.error("Error stopping scheduler:", error);
    res.status(500).json({ error: "Failed to stop scheduler" });
  }
});

// Seed global broker sources (marina-specific brokers)
curatedDataRouter.post("/scrape-sources/seed", async (req, res) => {
  try {
    const orgId = req.tenant?.orgId;
    if (!orgId) {
      return res.status(400).json({ error: "Organization required" });
    }

    const result = await seedGlobalBrokerSources(orgId);
    
    res.json({
      success: true,
      message: `Seeded ${result.created} new sources, updated ${result.updated} existing sources`,
      ...result,
      totalAvailable: GLOBAL_BROKER_SOURCES.length,
    });
  } catch (error) {
    console.error("Error seeding global broker sources:", error);
    res.status(500).json({ error: "Failed to seed global broker sources" });
  }
});

// Get available broker sources (not yet seeded)
curatedDataRouter.get("/scrape-sources/available", async (req, res) => {
  try {
    const existingSources = await db
      .select({ platform: marinaScrapeources.platform })
      .from(marinaScrapeources)
      .where(eq(marinaScrapeources.isGlobalSource, true));

    const existingPlatforms = new Set(existingSources.map(s => s.platform));
    
    const available = GLOBAL_BROKER_SOURCES.map(source => ({
      platform: source.platform,
      name: source.name,
      baseUrl: source.baseUrl,
      searchUrl: source.searchUrl,
      isSeeded: existingPlatforms.has(source.platform),
      capabilityNotes: source.capabilityNotes,
    }));

    res.json({
      total: GLOBAL_BROKER_SOURCES.length,
      seeded: existingPlatforms.size,
      available,
    });
  } catch (error) {
    console.error("Error getting available sources:", error);
    res.status(500).json({ error: "Failed to get available sources" });
  }
});

export default curatedDataRouter;
