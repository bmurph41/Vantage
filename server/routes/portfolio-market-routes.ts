import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import {
  marketBenchmarks,
  portfolioAlerts,
  capRateFeed,
  rentComps,
  propertyZoning,
  entitlements,
  crmDeals,
} from "@shared/schema";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";

export const portfolioMarketRouter = Router();

// ─── 3.1 Portfolio Snapshot ──────────────────────────────────────────────────

portfolioMarketRouter.get("/portfolio/snapshot", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;

    const [summary] = await db
      .select({
        totalDeals: sql<number>`count(*)::int`,
        totalValue: sql<string>`coalesce(sum(${crmDeals.value}::numeric), 0)`,
      })
      .from(crmDeals)
      .where(eq(crmDeals.orgId, orgId));

    const stagesBreakdown = await db
      .select({
        stage: crmDeals.stage,
        count: sql<number>`count(*)::int`,
        totalValue: sql<string>`coalesce(sum(${crmDeals.value}::numeric), 0)`,
      })
      .from(crmDeals)
      .where(eq(crmDeals.orgId, orgId))
      .groupBy(crmDeals.stage);

    res.json({
      totalDeals: summary.totalDeals,
      totalValue: summary.totalValue,
      stages: stagesBreakdown,
    });
  } catch (error) {
    next(error);
  }
});

// ─── 3.3 Portfolio Alerts ────────────────────────────────────────────────────

portfolioMarketRouter.get("/portfolio/alerts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;

    const alerts = await db
      .select()
      .from(portfolioAlerts)
      .where(eq(portfolioAlerts.orgId, orgId))
      .orderBy(desc(portfolioAlerts.createdAt));

    res.json(alerts);
  } catch (error) {
    next(error);
  }
});

portfolioMarketRouter.post("/portfolio/alerts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;

    const [alert] = await db
      .insert(portfolioAlerts)
      .values({ ...req.body, orgId })
      .returning();

    res.status(201).json(alert);
  } catch (error) {
    next(error);
  }
});

portfolioMarketRouter.patch("/portfolio/alerts/:id/acknowledge", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;
    const userId = (req as any).user.id;
    const { id } = req.params;

    const [alert] = await db
      .update(portfolioAlerts)
      .set({ acknowledgedAt: new Date(), acknowledgedBy: userId })
      .where(and(eq(portfolioAlerts.id, id), eq(portfolioAlerts.orgId, orgId)))
      .returning();

    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }
    res.json(alert);
  } catch (error) {
    next(error);
  }
});

portfolioMarketRouter.patch("/portfolio/alerts/:id/resolve", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;
    const { id } = req.params;

    const [alert] = await db
      .update(portfolioAlerts)
      .set({ resolvedAt: new Date() })
      .where(and(eq(portfolioAlerts.id, id), eq(portfolioAlerts.orgId, orgId)))
      .returning();

    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }
    res.json(alert);
  } catch (error) {
    next(error);
  }
});

// ─── 3.5 Vintage Analysis ────────────────────────────────────────────────────

portfolioMarketRouter.get("/portfolio/vintage", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;

    const vintageData = await db
      .select({
        acquisitionYear: sql<number>`extract(year from ${crmDeals.closedAt})::int`,
        dealCount: sql<number>`count(*)::int`,
        totalValue: sql<string>`coalesce(sum(${crmDeals.value}::numeric), 0)`,
        avgValue: sql<string>`coalesce(avg(${crmDeals.value}::numeric), 0)`,
      })
      .from(crmDeals)
      .where(and(eq(crmDeals.orgId, orgId), eq(crmDeals.isClosed, true)))
      .groupBy(sql`extract(year from ${crmDeals.closedAt})`)
      .orderBy(sql`extract(year from ${crmDeals.closedAt})`);

    res.json(vintageData);
  } catch (error) {
    next(error);
  }
});

// ─── 4.1 Market Benchmarks ──────────────────────────────────────────────────

portfolioMarketRouter.get("/benchmarks", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;
    const { assetClass, market } = req.query;

    const conditions = [eq(marketBenchmarks.orgId, orgId)];
    if (assetClass) conditions.push(eq(marketBenchmarks.assetClass, assetClass as string));
    if (market) conditions.push(eq(marketBenchmarks.market, market as string));

    const results = await db
      .select()
      .from(marketBenchmarks)
      .where(and(...conditions))
      .orderBy(desc(marketBenchmarks.createdAt));

    res.json(results);
  } catch (error) {
    next(error);
  }
});

portfolioMarketRouter.post("/benchmarks", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;

    const [benchmark] = await db
      .insert(marketBenchmarks)
      .values({ ...req.body, orgId })
      .returning();

    res.status(201).json(benchmark);
  } catch (error) {
    next(error);
  }
});

portfolioMarketRouter.put("/benchmarks/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;
    const { id } = req.params;

    const [benchmark] = await db
      .update(marketBenchmarks)
      .set(req.body)
      .where(and(eq(marketBenchmarks.id, id), eq(marketBenchmarks.orgId, orgId)))
      .returning();

    if (!benchmark) {
      return res.status(404).json({ error: "Benchmark not found" });
    }
    res.json(benchmark);
  } catch (error) {
    next(error);
  }
});

portfolioMarketRouter.delete("/benchmarks/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;
    const { id } = req.params;

    const [deleted] = await db
      .delete(marketBenchmarks)
      .where(and(eq(marketBenchmarks.id, id), eq(marketBenchmarks.orgId, orgId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Benchmark not found" });
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ─── 4.1 Cap Rate Feed ─────────────────────────────────────────────────────

portfolioMarketRouter.get("/cap-rates", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;
    const { assetClass, market } = req.query;

    const conditions = [eq(capRateFeed.orgId, orgId)];
    if (assetClass) conditions.push(eq(capRateFeed.assetClass, assetClass as string));
    if (market) conditions.push(eq(capRateFeed.market, market as string));

    const results = await db
      .select()
      .from(capRateFeed)
      .where(and(...conditions))
      .orderBy(desc(capRateFeed.asOfDate));

    res.json(results);
  } catch (error) {
    next(error);
  }
});

portfolioMarketRouter.post("/cap-rates", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;

    const [entry] = await db
      .insert(capRateFeed)
      .values({ ...req.body, orgId })
      .returning();

    res.status(201).json(entry);
  } catch (error) {
    next(error);
  }
});

portfolioMarketRouter.get("/cap-rates/lookup", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;
    const { assetClass, market } = req.query;

    if (!assetClass || !market) {
      return res.status(400).json({ error: "assetClass and market are required" });
    }

    const [latest] = await db
      .select()
      .from(capRateFeed)
      .where(
        and(
          eq(capRateFeed.orgId, orgId),
          eq(capRateFeed.assetClass, assetClass as string),
          eq(capRateFeed.market, market as string),
        )
      )
      .orderBy(desc(capRateFeed.asOfDate))
      .limit(1);

    if (!latest) {
      return res.status(404).json({ error: "No cap rate data found" });
    }
    res.json(latest);
  } catch (error) {
    next(error);
  }
});

// ─── 4.2 Rent Comps ─────────────────────────────────────────────────────────

portfolioMarketRouter.get("/rent-comps", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;
    const { dealId, assetClass } = req.query;

    const conditions = [eq(rentComps.orgId, orgId)];
    if (dealId) conditions.push(eq(rentComps.dealId, dealId as string));
    if (assetClass) conditions.push(eq(rentComps.assetClass, assetClass as string));

    const results = await db
      .select()
      .from(rentComps)
      .where(and(...conditions))
      .orderBy(desc(rentComps.createdAt));

    res.json(results);
  } catch (error) {
    next(error);
  }
});

portfolioMarketRouter.post("/rent-comps", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;

    const [comp] = await db
      .insert(rentComps)
      .values({ ...req.body, orgId })
      .returning();

    res.status(201).json(comp);
  } catch (error) {
    next(error);
  }
});

portfolioMarketRouter.put("/rent-comps/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;
    const { id } = req.params;

    const [comp] = await db
      .update(rentComps)
      .set(req.body)
      .where(and(eq(rentComps.id, id), eq(rentComps.orgId, orgId)))
      .returning();

    if (!comp) {
      return res.status(404).json({ error: "Rent comp not found" });
    }
    res.json(comp);
  } catch (error) {
    next(error);
  }
});

portfolioMarketRouter.delete("/rent-comps/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;
    const { id } = req.params;

    const [deleted] = await db
      .delete(rentComps)
      .where(and(eq(rentComps.id, id), eq(rentComps.orgId, orgId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Rent comp not found" });
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

portfolioMarketRouter.get("/rent-comps/analysis/:dealId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;
    const { dealId } = req.params;

    const analysis = await db
      .select({
        unitType: rentComps.unitType,
        count: sql<number>`count(*)::int`,
        avgRentPerUnit: sql<string>`round(avg(${rentComps.rentPerUnit}::numeric), 2)`,
        minRentPerUnit: sql<string>`min(${rentComps.rentPerUnit}::numeric)`,
        maxRentPerUnit: sql<string>`max(${rentComps.rentPerUnit}::numeric)`,
        medianRentPerUnit: sql<string>`percentile_cont(0.5) within group (order by ${rentComps.rentPerUnit}::numeric)`,
        avgOccupancy: sql<string>`round(avg(${rentComps.occupancy}::numeric), 2)`,
      })
      .from(rentComps)
      .where(and(eq(rentComps.orgId, orgId), eq(rentComps.dealId, dealId)))
      .groupBy(rentComps.unitType);

    res.json(analysis);
  } catch (error) {
    next(error);
  }
});

// ─── 4.4 Zoning ─────────────────────────────────────────────────────────────

portfolioMarketRouter.get("/zoning/:dealId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;
    const { dealId } = req.params;

    const [zoning] = await db
      .select()
      .from(propertyZoning)
      .where(and(eq(propertyZoning.dealId, dealId), eq(propertyZoning.orgId, orgId)));

    if (!zoning) {
      return res.status(404).json({ error: "Zoning record not found" });
    }
    res.json(zoning);
  } catch (error) {
    next(error);
  }
});

portfolioMarketRouter.post("/zoning", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;

    const [zoning] = await db
      .insert(propertyZoning)
      .values({ ...req.body, orgId })
      .returning();

    res.status(201).json(zoning);
  } catch (error) {
    next(error);
  }
});

portfolioMarketRouter.put("/zoning/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;
    const { id } = req.params;

    const [zoning] = await db
      .update(propertyZoning)
      .set(req.body)
      .where(and(eq(propertyZoning.id, id), eq(propertyZoning.orgId, orgId)))
      .returning();

    if (!zoning) {
      return res.status(404).json({ error: "Zoning record not found" });
    }
    res.json(zoning);
  } catch (error) {
    next(error);
  }
});

// ─── 4.5 Entitlements ───────────────────────────────────────────────────────

portfolioMarketRouter.get("/entitlements/:dealId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;
    const { dealId } = req.params;

    const results = await db
      .select()
      .from(entitlements)
      .where(and(eq(entitlements.dealId, dealId), eq(entitlements.orgId, orgId)))
      .orderBy(desc(entitlements.createdAt));

    res.json(results);
  } catch (error) {
    next(error);
  }
});

portfolioMarketRouter.post("/entitlements", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;

    const [entitlement] = await db
      .insert(entitlements)
      .values({ ...req.body, orgId })
      .returning();

    res.status(201).json(entitlement);
  } catch (error) {
    next(error);
  }
});

portfolioMarketRouter.put("/entitlements/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;
    const { id } = req.params;

    const [entitlement] = await db
      .update(entitlements)
      .set(req.body)
      .where(and(eq(entitlements.id, id), eq(entitlements.orgId, orgId)))
      .returning();

    if (!entitlement) {
      return res.status(404).json({ error: "Entitlement not found" });
    }
    res.json(entitlement);
  } catch (error) {
    next(error);
  }
});

portfolioMarketRouter.delete("/entitlements/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user.orgId;
    const { id } = req.params;

    const [deleted] = await db
      .delete(entitlements)
      .where(and(eq(entitlements.id, id), eq(entitlements.orgId, orgId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: "Entitlement not found" });
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
