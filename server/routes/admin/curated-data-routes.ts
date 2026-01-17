import { Router } from "express";
import { db } from "../../db";
import { 
  salesComps, 
  rateComps, 
  industryStandards,
  users
} from "../../../shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

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

    res.json({
      salesComps: salesStats?.count || 0,
      rateComps: rateStats?.count || 0,
      industryStandards: standardsStats?.count || 0,
    });
  } catch (error) {
    console.error("Error fetching curated data stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export default curatedDataRouter;
