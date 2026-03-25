import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { billingFeatureFlags, billingSubscriptions, billingUsageMetrics, crmDeals, users } from "@shared/schema";
import { eq, and, sql, count } from "drizzle-orm";
import { SUBSCRIPTION_TIERS } from "../services/billing-service";

/**
 * Middleware: require a specific billing feature to be enabled for the org.
 * Checks billingFeatureFlags table. Returns 403 with upgrade info if not enabled.
 *
 * Usage:
 *   router.get('/api/lp/dashboard', authenticate, requireFeature('lp_portal'), handler);
 */
export function requireFeature(feature: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user?.orgId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Dev bypass: if no subscription exists and NODE_ENV=development, allow
      if (process.env.NODE_ENV === "development") {
        const [sub] = await db.select().from(billingSubscriptions).where(eq(billingSubscriptions.orgId, user.orgId));
        if (!sub) return next();
      }

      const [flag] = await db
        .select()
        .from(billingFeatureFlags)
        .where(
          and(
            eq(billingFeatureFlags.orgId, user.orgId),
            eq(billingFeatureFlags.feature, feature),
            eq(billingFeatureFlags.isEnabled, true),
          ),
        );

      if (!flag) {
        // Find which tier includes this feature
        const requiredTier = Object.entries(SUBSCRIPTION_TIERS).find(
          ([, tier]) => tier.features.includes(feature) || tier.features.includes("everything"),
        );

        return res.status(403).json({
          error: "feature_not_available",
          message: "This feature requires a higher subscription tier.",
          feature,
          requiredTier: requiredTier?.[0] || "institutional",
          upgradeUrl: `/settings/billing?upgrade=true&feature=${feature}`,
        });
      }

      // Check if override has expired
      if (flag.isOverride && flag.overrideExpiresAt && new Date(flag.overrideExpiresAt) < new Date()) {
        return res.status(403).json({
          error: "feature_not_available",
          message: "Your trial access to this feature has expired.",
          feature,
          upgradeUrl: `/settings/billing?upgrade=true&feature=${feature}`,
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

type LimitType = "deals" | "seats" | "ai_queries" | "storage";

/**
 * Middleware: check usage limits for the org's subscription tier.
 * Returns 429 if limit is reached. Adds X-Usage-Warning header at 80%.
 *
 * Usage:
 *   router.post('/api/crm/deals', authenticate, checkUsageLimit('deals'), handler);
 */
export function checkUsageLimit(limitType: LimitType) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      if (!user?.orgId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Dev bypass
      if (process.env.NODE_ENV === "development") {
        const [sub] = await db.select().from(billingSubscriptions).where(eq(billingSubscriptions.orgId, user.orgId));
        if (!sub) return next();
      }

      const [sub] = await db
        .select()
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.orgId, user.orgId));

      if (!sub) return next(); // No subscription = no limits enforced

      const tierDef = SUBSCRIPTION_TIERS[sub.tier as keyof typeof SUBSCRIPTION_TIERS];
      if (!tierDef) return next();

      let limit: number;
      let current: number;

      switch (limitType) {
        case "deals": {
          limit = tierDef.limits.deals;
          const [result] = await db.select({ cnt: count() }).from(crmDeals).where(eq(crmDeals.orgId, user.orgId));
          current = result?.cnt || 0;
          break;
        }
        case "seats": {
          limit = tierDef.limits.seats;
          const [result] = await db.select({ cnt: count() }).from(users).where(eq(users.orgId, user.orgId));
          current = result?.cnt || 0;
          break;
        }
        case "ai_queries": {
          limit = tierDef.limits.aiQueries;
          const period = new Date().toISOString().slice(0, 7); // YYYY-MM
          const [result] = await db
            .select({ total: sql<number>`COALESCE(SUM(${billingUsageMetrics.value}), 0)` })
            .from(billingUsageMetrics)
            .where(
              and(
                eq(billingUsageMetrics.orgId, user.orgId),
                eq(billingUsageMetrics.metricType, "ai_query"),
                eq(billingUsageMetrics.period, period),
              ),
            );
          current = Number(result?.total) || 0;
          break;
        }
        case "storage": {
          limit = tierDef.limits.storageGb;
          current = 0; // Storage tracking not yet implemented
          break;
        }
        default:
          return next();
      }

      // -1 means unlimited
      if (limit === -1) return next();

      const pct = limit > 0 ? (current / limit) * 100 : 0;

      if (current >= limit) {
        return res.status(429).json({
          error: "usage_limit_reached",
          message: `You've reached your ${limitType} limit (${current}/${limit}).`,
          current,
          limit,
          upgradeUrl: "/settings/billing",
        });
      }

      // Warn at 80%
      if (pct >= 80) {
        res.setHeader("X-Usage-Warning", `${limitType}:${Math.round(pct)}%`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
