/**
 * Asset Class Context API
 *
 * Returns asset classes grouped by source (portfolio, pipeline, models)
 * so the UI can display dynamic, context-aware dropdowns.
 *
 *   GET /api/asset-classes/context
 *
 * Add to server/routes.ts:
 *   import { assetClassContextRouter } from './routes/asset-class-context-routes';
 *   app.use('/api/asset-classes', authenticateUser, assetClassContextRouter);
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import {
  ownedAssets,
  crmProperties,
  crmDeals,
  modelingProjects,
  platformAssetClasses,
} from "@shared/schema";
import { eq, ne, sql, and, isNotNull } from "drizzle-orm";

export const assetClassContextRouter = Router();

/** Human-readable label for a raw asset class key */
function labelForKey(key: string): string {
  const MAP: Record<string, string> = {
    marina: "Marina",
    multifamily: "Multifamily",
    retail: "Retail",
    office: "Office",
    industrial: "Industrial",
    self_storage: "Self-Storage",
    mixed_use: "Mixed-Use",
    hotel: "Hotel",
    str: "Short-Term Rental",
    str_airbnb: "Short-Term Rental",
    rv_park: "RV Park",
    mobile_home: "Mobile Home Park",
    mobile_home_park: "Mobile Home Park",
    sfr: "Single Family",
    duplex: "Duplex",
    triplex: "Triplex",
    quadplex: "Quadplex",
    land: "Land",
    medical_office: "Medical Office",
    laundromat: "Laundromat",
    car_wash: "Car Wash",
    business: "Business Acquisition",
    other: "Other",
  };
  return MAP[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

assetClassContextRouter.get("/context", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.orgId;

    // 1. Portfolio — asset classes from owned assets
    const portfolioRows = orgId
      ? await db
          .selectDistinct({ type: crmProperties.type })
          .from(ownedAssets)
          .innerJoin(crmProperties, eq(ownedAssets.propertyId, crmProperties.id))
          .where(eq(ownedAssets.orgId, orgId))
      : [];
    const portfolio = portfolioRows
      .map((r) => r.type)
      .filter(Boolean) as string[];

    // 2. Pipeline — asset classes from active deals
    const pipelineRows = orgId
      ? await db
          .selectDistinct({ assetClass: crmDeals.assetClass })
          .from(crmDeals)
          .where(
            and(
              eq(crmDeals.orgId, orgId),
              ne(crmDeals.stage, "closed_lost"),
              isNotNull(crmDeals.assetClass)
            )
          )
      : [];
    const pipeline = pipelineRows
      .map((r) => r.assetClass)
      .filter(Boolean) as string[];

    // 3. Financial Models — asset classes from modeling projects
    const modelRows = orgId
      ? await db
          .selectDistinct({ assetClass: modelingProjects.assetClass })
          .from(modelingProjects)
          .where(
            and(
              eq(modelingProjects.orgId, orgId),
              isNotNull(modelingProjects.assetClass)
            )
          )
      : [];
    const models = modelRows
      .map((r) => r.assetClass)
      .filter(Boolean) as string[];

    // 4. Platform master list (enabled asset classes)
    const platformRows = await db
      .select({
        key: platformAssetClasses.key,
        label: platformAssetClasses.label,
        category: platformAssetClasses.category,
      })
      .from(platformAssetClasses)
      .where(eq(platformAssetClasses.enabled, true))
      .orderBy(platformAssetClasses.sortOrder);

    // Deduplicate all
    const allSet = new Set([...portfolio, ...pipeline, ...models]);
    const all = Array.from(allSet);

    res.json({
      portfolio,
      pipeline,
      models,
      all,
      platform: platformRows.map((r) => ({
        key: r.key,
        label: r.label || labelForKey(r.key),
        category: r.category,
      })),
      labels: Object.fromEntries(
        [...allSet, ...platformRows.map((r) => r.key)].map((k) => [
          k,
          platformRows.find((p) => p.key === k)?.label || labelForKey(k),
        ])
      ),
    });
  } catch (error) {
    console.error("Error fetching asset class context:", error);
    res.status(500).json({ error: "Failed to fetch asset class context" });
  }
});
