/**
 * Broker Subscription Entitlements
 *
 * Resolves the effective Marketplace+ tier for a user and enforces broker
 * follow / advisory caps. The follow cap is intentionally ungameable: it
 * counts distinct brokers a user has ever followed (via broker_follow_history),
 * not currently-active follows. Users cannot unfollow broker A and follow
 * broker C to skirt the cap — once they've followed 2 brokers on Free,
 * that slot is used forever until they upgrade.
 */

import { db } from "../db";
import {
  brokerFollowHistory,
  brokerSubscriptions,
  orgMarketplaceEntitlements,
  userBrokerEntitlements,
} from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";

export type MarketplacePlusTier = "free" | "solo" | "pro" | "institutional";

export interface MarketplaceTierDefinition {
  tier: MarketplacePlusTier;
  label: string;
  priceMonthlyCents: number;
  priceAnnualCents: number;
  brokerFollowLimit: number; // -1 = unlimited
  brokerAdvisoryLimit: number; // -1 = unlimited
  savedSearchLimit: number;
  listingExportLimitMonthly: number;
  earlyAccessHours: number;
  allowBrokerMessaging: boolean;
  allowOffMarketAlerts: boolean;
  features: string[];
}

export const MARKETPLACE_PLUS_TIERS: Record<MarketplacePlusTier, MarketplaceTierDefinition> = {
  free: {
    tier: "free",
    label: "Marketplace (Free)",
    priceMonthlyCents: 0,
    priceAnnualCents: 0,
    brokerFollowLimit: 2,
    brokerAdvisoryLimit: 0,
    savedSearchLimit: 3,
    listingExportLimitMonthly: 0,
    earlyAccessHours: 0,
    allowBrokerMessaging: false,
    allowOffMarketAlerts: false,
    features: ["browse", "basic_filters", "basic_bookmarks"],
  },
  solo: {
    tier: "solo",
    label: "Marketplace+ Solo",
    priceMonthlyCents: 2400,
    priceAnnualCents: 24000,
    brokerFollowLimit: 10,
    brokerAdvisoryLimit: -1,
    savedSearchLimit: 25,
    listingExportLimitMonthly: 50,
    earlyAccessHours: 0,
    allowBrokerMessaging: false,
    allowOffMarketAlerts: false,
    features: [
      "browse",
      "basic_filters",
      "advanced_filters",
      "saved_searches",
      "listing_alerts",
      "broker_recommendations",
      "broker_feedback_verdict",
      "csv_export_limited",
    ],
  },
  pro: {
    tier: "pro",
    label: "Marketplace+ Pro",
    priceMonthlyCents: 6900,
    priceAnnualCents: 69000,
    brokerFollowLimit: -1,
    brokerAdvisoryLimit: -1,
    savedSearchLimit: -1,
    listingExportLimitMonthly: -1,
    earlyAccessHours: 24,
    allowBrokerMessaging: true,
    allowOffMarketAlerts: true,
    features: [
      "browse",
      "basic_filters",
      "advanced_filters",
      "saved_searches",
      "listing_alerts",
      "broker_recommendations",
      "broker_feedback_verdict",
      "broker_feedback_narrative",
      "broker_feedback_modeling",
      "csv_export_unlimited",
      "comp_set_builder",
      "early_access_24h",
      "broker_messaging",
      "off_market_alerts",
    ],
  },
  institutional: {
    tier: "institutional",
    label: "Institutional",
    priceMonthlyCents: -1, // handled by core platform subscription
    priceAnnualCents: -1,
    brokerFollowLimit: -1,
    brokerAdvisoryLimit: -1,
    savedSearchLimit: -1,
    listingExportLimitMonthly: -1,
    earlyAccessHours: 24,
    allowBrokerMessaging: true,
    allowOffMarketAlerts: true,
    features: [
      "everything",
      "broker_feedback_verdict",
      "broker_feedback_narrative",
      "broker_feedback_modeling",
    ],
  },
};

/**
 * Check if a given tier includes a named feature flag. Used by the feedback
 * endpoints to gate narrative + modeling project feedback behind Pro+.
 */
export function tierHasFeature(tier: MarketplacePlusTier, feature: string): boolean {
  const def = MARKETPLACE_PLUS_TIERS[tier];
  if (!def) return false;
  if (def.features.includes("everything")) return true;
  return def.features.includes(feature);
}

export interface EffectiveBrokerEntitlement {
  tier: MarketplacePlusTier;
  label: string;
  brokerFollowLimit: number;
  brokerAdvisoryLimit: number;
  savedSearchLimit: number;
  listingExportLimitMonthly: number;
  earlyAccessHours: number;
  allowBrokerMessaging: boolean;
  allowOffMarketAlerts: boolean;
  source: "default" | "subscription" | "admin_override" | "trial";
}

/**
 * Resolve the effective entitlement for a user.
 *
 * Precedence:
 *   1. user_broker_entitlements row (per-user override from Stripe checkout)
 *   2. org_marketplace_entitlements row (org-level plan)
 *   3. MARKETPLACE_PLUS_TIERS.free (hard default)
 */
export async function getEffectiveBrokerEntitlement(
  userId: string,
  orgId: string,
): Promise<EffectiveBrokerEntitlement> {
  const [userRow] = await db
    .select()
    .from(userBrokerEntitlements)
    .where(eq(userBrokerEntitlements.userId, userId));

  if (userRow) {
    const tier = (userRow.tier as MarketplacePlusTier) || "free";
    const def = MARKETPLACE_PLUS_TIERS[tier] || MARKETPLACE_PLUS_TIERS.free;
    return {
      tier,
      label: def.label,
      brokerFollowLimit: userRow.brokerFollowLimit,
      brokerAdvisoryLimit: userRow.brokerAdvisoryLimit,
      savedSearchLimit: def.savedSearchLimit,
      listingExportLimitMonthly: def.listingExportLimitMonthly,
      earlyAccessHours: def.earlyAccessHours,
      allowBrokerMessaging: def.allowBrokerMessaging,
      allowOffMarketAlerts: def.allowOffMarketAlerts,
      source: (userRow.source as EffectiveBrokerEntitlement["source"]) || "subscription",
    };
  }

  const [orgRow] = await db
    .select()
    .from(orgMarketplaceEntitlements)
    .where(eq(orgMarketplaceEntitlements.orgId, orgId));

  if (orgRow) {
    const tier = (orgRow.marketplacePlusTier as MarketplacePlusTier) || "free";
    const def = MARKETPLACE_PLUS_TIERS[tier] || MARKETPLACE_PLUS_TIERS.free;
    // Check expiry
    if (orgRow.expiresAt && new Date(orgRow.expiresAt) < new Date()) {
      return toEntitlement("free", "default");
    }
    return {
      tier,
      label: def.label,
      brokerFollowLimit: orgRow.brokerFollowLimit,
      brokerAdvisoryLimit: orgRow.brokerAdvisoryLimit,
      savedSearchLimit: orgRow.savedSearchLimit,
      listingExportLimitMonthly: orgRow.listingExportLimitMonthly,
      earlyAccessHours: orgRow.earlyAccessHours,
      allowBrokerMessaging: orgRow.allowBrokerMessaging,
      allowOffMarketAlerts: orgRow.allowOffMarketAlerts,
      source: (orgRow.source as EffectiveBrokerEntitlement["source"]) || "subscription",
    };
  }

  return toEntitlement("free", "default");
}

function toEntitlement(
  tier: MarketplacePlusTier,
  source: EffectiveBrokerEntitlement["source"],
): EffectiveBrokerEntitlement {
  const def = MARKETPLACE_PLUS_TIERS[tier];
  return {
    tier,
    label: def.label,
    brokerFollowLimit: def.brokerFollowLimit,
    brokerAdvisoryLimit: def.brokerAdvisoryLimit,
    savedSearchLimit: def.savedSearchLimit,
    listingExportLimitMonthly: def.listingExportLimitMonthly,
    earlyAccessHours: def.earlyAccessHours,
    allowBrokerMessaging: def.allowBrokerMessaging,
    allowOffMarketAlerts: def.allowOffMarketAlerts,
    source,
  };
}

export interface FollowCheckResult {
  allowed: boolean;
  reason?: "cap_reached" | "already_followed";
  current: number;
  limit: number;
  tier: MarketplacePlusTier;
  upgradeUrl?: string;
}

/**
 * Check whether a user can follow a new broker.
 *
 * The cap counts DISTINCT brokers in broker_follow_history (append-only),
 * not currently-active follows. This prevents the unfollow-and-refollow game.
 *
 * If the user is already in history for this specific broker, the refollow
 * is free — they've already used that slot.
 */
export async function canFollowBroker(
  userId: string,
  orgId: string,
  brokerProfileId: string,
): Promise<FollowCheckResult> {
  const entitlement = await getEffectiveBrokerEntitlement(userId, orgId);
  const limit = entitlement.brokerFollowLimit;

  // Unlimited
  if (limit === -1) {
    return { allowed: true, current: 0, limit: -1, tier: entitlement.tier };
  }

  // Already used a slot on this broker? Refollow is free.
  const [existing] = await db
    .select()
    .from(brokerFollowHistory)
    .where(
      and(
        eq(brokerFollowHistory.userId, userId),
        eq(brokerFollowHistory.brokerProfileId, brokerProfileId),
      ),
    );

  if (existing) {
    if (existing.currentlyFollowing) {
      return {
        allowed: false,
        reason: "already_followed",
        current: 0,
        limit,
        tier: entitlement.tier,
      };
    }
    // Refollow — doesn't consume a new slot.
    return { allowed: true, current: 0, limit, tier: entitlement.tier };
  }

  // Count distinct brokers ever followed (lifetime).
  const [result] = await db
    .select({ cnt: sql<number>`COUNT(*)::int` })
    .from(brokerFollowHistory)
    .where(eq(brokerFollowHistory.userId, userId));
  const current = Number(result?.cnt || 0);

  if (current >= limit) {
    return {
      allowed: false,
      reason: "cap_reached",
      current,
      limit,
      tier: entitlement.tier,
      upgradeUrl: `/settings/billing?upgrade=marketplace_plus&feature=broker_follow_limit`,
    };
  }

  return { allowed: true, current, limit, tier: entitlement.tier };
}

export interface AdvisoryCheckResult {
  allowed: boolean;
  reason?: "tier_required" | "cap_reached";
  current: number;
  limit: number;
  tier: MarketplacePlusTier;
  upgradeUrl?: string;
}

export async function canSubscribeAdvisory(
  userId: string,
  orgId: string,
): Promise<AdvisoryCheckResult> {
  const entitlement = await getEffectiveBrokerEntitlement(userId, orgId);
  const limit = entitlement.brokerAdvisoryLimit;

  if (limit === 0) {
    return {
      allowed: false,
      reason: "tier_required",
      current: 0,
      limit: 0,
      tier: entitlement.tier,
      upgradeUrl: `/settings/billing?upgrade=marketplace_plus&feature=advisory_subscriptions`,
    };
  }

  if (limit === -1) {
    return { allowed: true, current: 0, limit: -1, tier: entitlement.tier };
  }

  const [result] = await db
    .select({ cnt: sql<number>`COUNT(*)::int` })
    .from(brokerSubscriptions)
    .where(
      and(
        eq(brokerSubscriptions.userId, userId),
        eq(brokerSubscriptions.tier, "advisory"),
        eq(brokerSubscriptions.status, "active"),
      ),
    );
  const current = Number(result?.cnt || 0);

  if (current >= limit) {
    return {
      allowed: false,
      reason: "cap_reached",
      current,
      limit,
      tier: entitlement.tier,
      upgradeUrl: `/settings/billing?upgrade=marketplace_plus&feature=advisory_subscriptions`,
    };
  }

  return { allowed: true, current, limit, tier: entitlement.tier };
}

/**
 * Record a follow in broker_follow_history. This is the only place that
 * marks a slot as consumed. Safe to call repeatedly — upserts.
 */
export async function recordFollowInHistory(userId: string, brokerProfileId: string): Promise<void> {
  await db
    .insert(brokerFollowHistory)
    .values({
      userId,
      brokerProfileId,
      currentlyFollowing: true,
      firstFollowedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [brokerFollowHistory.userId, brokerFollowHistory.brokerProfileId],
      set: {
        currentlyFollowing: true,
        unfollowedAt: null,
        refollowedCount: sql`${brokerFollowHistory.refollowedCount} + 1`,
      },
    });
}

export async function markUnfollowedInHistory(
  userId: string,
  brokerProfileId: string,
): Promise<void> {
  await db
    .update(brokerFollowHistory)
    .set({ currentlyFollowing: false, unfollowedAt: new Date() })
    .where(
      and(
        eq(brokerFollowHistory.userId, userId),
        eq(brokerFollowHistory.brokerProfileId, brokerProfileId),
      ),
    );
}

/**
 * Upsert a user's entitlement (called from Stripe webhook after successful
 * Marketplace+ checkout, or from admin override endpoint).
 */
export async function setUserBrokerEntitlement(params: {
  userId: string;
  orgId: string;
  tier: MarketplacePlusTier;
  source?: EffectiveBrokerEntitlement["source"];
}): Promise<void> {
  const def = MARKETPLACE_PLUS_TIERS[params.tier];
  await db
    .insert(userBrokerEntitlements)
    .values({
      userId: params.userId,
      orgId: params.orgId,
      tier: params.tier,
      brokerFollowLimit: def.brokerFollowLimit,
      brokerAdvisoryLimit: def.brokerAdvisoryLimit,
      source: params.source || "subscription",
    })
    .onConflictDoUpdate({
      target: userBrokerEntitlements.userId,
      set: {
        tier: params.tier,
        brokerFollowLimit: def.brokerFollowLimit,
        brokerAdvisoryLimit: def.brokerAdvisoryLimit,
        source: params.source || "subscription",
        updatedAt: new Date(),
      },
    });
}
