/**
 * Broker Subscriptions — user-facing routes
 *
 * Covers:
 *   - Broker directory and profile browsing
 *   - Follow / unfollow (free tier, subject to cap)
 *   - Request advisory subscription (pending_payment state)
 *   - List current user's subscriptions
 *   - List advisory content with visibility gating
 *
 * Broker-side management routes (profile CRUD, grant advisory access,
 * publish content) live in server/routes/broker-dashboard-routes.ts.
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import {
  brokerProfiles,
  brokerSubscriptions,
  brokerAdvisoryPackages,
  brokerAdvisoryContent,
  brokerAdvisoryMessages,
  marinaListings,
} from "@shared/schema";
import { and, desc, eq, inArray, ilike, or, sql } from "drizzle-orm";
import {
  canFollowBroker,
  canSubscribeAdvisory,
  getEffectiveBrokerEntitlement,
  markUnfollowedInHistory,
  recordFollowInHistory,
} from "../services/broker-entitlements";
import { pool } from "../db";
import {
  recordInboundMessage,
  recordBrokerReply,
} from "../services/broker-response-tracker";

const router = Router();

function getUserContext(req: Request): { userId: string; orgId: string } | null {
  const user = (req as any).user || (req as any).session?.user;
  if (!user?.id || !user?.orgId) return null;
  return { userId: user.id, orgId: user.orgId };
}

// ────────────────────────────────────────────────────────────────────────────
// Directory — browse publishable broker profiles
// ────────────────────────────────────────────────────────────────────────────

router.get("/directory", async (req: Request, res: Response) => {
  try {
    const { q, specialty, state, tier, page = "1", pageSize = "24" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10));
    const size = Math.min(100, Math.max(1, parseInt(pageSize, 10)));
    const offset = (pageNum - 1) * size;

    const conditions = [eq(brokerProfiles.isPublishable, true)];
    if (q) {
      conditions.push(
        or(
          ilike(brokerProfiles.displayName, `%${q}%`),
          ilike(brokerProfiles.companyName, `%${q}%`),
          ilike(brokerProfiles.bio, `%${q}%`),
        )!,
      );
    }
    if (tier) conditions.push(eq(brokerProfiles.brokerTier, tier));
    if (state) conditions.push(eq(brokerProfiles.licenseState, state));
    if (specialty) {
      conditions.push(sql`${brokerProfiles.specialties} @> ${JSON.stringify({ asset_classes: [specialty] })}::jsonb`);
    }

    const rows = await db
      .select()
      .from(brokerProfiles)
      .where(and(...conditions))
      .orderBy(
        desc(brokerProfiles.brokerTier),
        desc(brokerProfiles.followerCount),
        desc(brokerProfiles.publishedAt),
      )
      .limit(size)
      .offset(offset);

    const [{ cnt } = { cnt: 0 }] = await db
      .select({ cnt: sql<number>`COUNT(*)::int` })
      .from(brokerProfiles)
      .where(and(...conditions));

    res.json({
      items: rows,
      total: Number(cnt || 0),
      page: pageNum,
      pageSize: size,
      totalPages: Math.ceil(Number(cnt || 0) / size),
    });
  } catch (err) {
    console.error("Broker directory error:", err);
    res.status(500).json({ error: "Failed to fetch broker directory" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Broker profile detail + listings + packages + content teasers
// ────────────────────────────────────────────────────────────────────────────

router.get("/profiles/:profileId", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    const { profileId } = req.params;

    const [profile] = await db
      .select()
      .from(brokerProfiles)
      .where(and(eq(brokerProfiles.id, profileId), eq(brokerProfiles.isPublishable, true)));

    if (!profile) return res.status(404).json({ error: "Broker profile not found" });

    const packages = await db
      .select()
      .from(brokerAdvisoryPackages)
      .where(and(eq(brokerAdvisoryPackages.brokerProfileId, profileId), eq(brokerAdvisoryPackages.isActive, true)))
      .orderBy(brokerAdvisoryPackages.sortOrder);

    const listings = await db
      .select()
      .from(marinaListings)
      .where(and(eq(marinaListings.brokerProfileId, profileId), eq(marinaListings.isActive, true)))
      .orderBy(desc(marinaListings.publishedAt))
      .limit(24);

    // Pull up to 10 recent content items; hide bodies unless user is an active advisory subscriber.
    const rawContent = await db
      .select()
      .from(brokerAdvisoryContent)
      .where(eq(brokerAdvisoryContent.brokerProfileId, profileId))
      .orderBy(desc(brokerAdvisoryContent.publishedAt))
      .limit(10);

    let isAdvisorySubscriber = false;
    let existingSubscription: typeof brokerSubscriptions.$inferSelect | null = null;
    if (ctx) {
      const [sub] = await db
        .select()
        .from(brokerSubscriptions)
        .where(
          and(
            eq(brokerSubscriptions.userId, ctx.userId),
            eq(brokerSubscriptions.brokerProfileId, profileId),
          ),
        );
      existingSubscription = sub || null;
      isAdvisorySubscriber = sub?.tier === "advisory" && sub.status === "active";
    }

    const content = rawContent.map((item) => {
      if (item.visibility === "public" || isAdvisorySubscriber) return item;
      return {
        ...item,
        body: null,
        excerpt: item.teaserExcerpt || item.excerpt,
        isLocked: true,
      };
    });

    res.json({
      profile,
      packages,
      listings,
      content,
      viewerContext: {
        isFollowing: existingSubscription?.tier === "follow" || isAdvisorySubscriber,
        isAdvisorySubscriber,
        subscription: existingSubscription,
      },
    });
  } catch (err) {
    console.error("Broker profile fetch error:", err);
    res.status(500).json({ error: "Failed to fetch broker profile" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Follow / unfollow
// ────────────────────────────────────────────────────────────────────────────

router.post("/profiles/:profileId/follow", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });
    const { profileId } = req.params;

    const [profile] = await db.select().from(brokerProfiles).where(eq(brokerProfiles.id, profileId));
    if (!profile) return res.status(404).json({ error: "Broker profile not found" });

    const check = await canFollowBroker(ctx.userId, ctx.orgId, profileId);
    if (!check.allowed) {
      if (check.reason === "already_followed") {
        return res.status(409).json({ error: "already_following" });
      }
      return res.status(403).json({
        error: "follow_cap_reached",
        message: `You've used ${check.current} of ${check.limit} broker follow slots on your ${check.tier} tier. Upgrade to Marketplace+ to follow more.`,
        current: check.current,
        limit: check.limit,
        tier: check.tier,
        upgradeUrl: check.upgradeUrl,
      });
    }

    // Upsert subscription at tier='follow'
    const [existing] = await db
      .select()
      .from(brokerSubscriptions)
      .where(
        and(
          eq(brokerSubscriptions.userId, ctx.userId),
          eq(brokerSubscriptions.brokerProfileId, profileId),
        ),
      );

    let subscription: typeof brokerSubscriptions.$inferSelect;
    if (existing) {
      const [updated] = await db
        .update(brokerSubscriptions)
        .set({ status: "active", canceledAt: null, updatedAt: new Date() })
        .where(eq(brokerSubscriptions.id, existing.id))
        .returning();
      subscription = updated;
    } else {
      const [inserted] = await db
        .insert(brokerSubscriptions)
        .values({
          userId: ctx.userId,
          orgId: ctx.orgId,
          brokerProfileId: profileId,
          tier: "follow",
          status: "active",
        })
        .returning();
      subscription = inserted;
    }

    await recordFollowInHistory(ctx.userId, profileId);
    await db
      .update(brokerProfiles)
      .set({ followerCount: sql`${brokerProfiles.followerCount} + 1` })
      .where(eq(brokerProfiles.id, profileId));

    res.json({ subscription, entitlement: await getEffectiveBrokerEntitlement(ctx.userId, ctx.orgId) });
  } catch (err) {
    console.error("Follow error:", err);
    res.status(500).json({ error: "Failed to follow broker" });
  }
});

router.delete("/profiles/:profileId/follow", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });
    const { profileId } = req.params;

    const [sub] = await db
      .select()
      .from(brokerSubscriptions)
      .where(
        and(
          eq(brokerSubscriptions.userId, ctx.userId),
          eq(brokerSubscriptions.brokerProfileId, profileId),
        ),
      );

    if (!sub) return res.status(404).json({ error: "Not subscribed" });

    // Don't actually delete — mark canceled so the history row stays intact.
    await db
      .update(brokerSubscriptions)
      .set({ status: "canceled", canceledAt: new Date(), updatedAt: new Date() })
      .where(eq(brokerSubscriptions.id, sub.id));

    await markUnfollowedInHistory(ctx.userId, profileId);
    await db
      .update(brokerProfiles)
      .set({
        followerCount: sql`GREATEST(${brokerProfiles.followerCount} - 1, 0)`,
      })
      .where(eq(brokerProfiles.id, profileId));

    res.json({ success: true });
  } catch (err) {
    console.error("Unfollow error:", err);
    res.status(500).json({ error: "Failed to unfollow broker" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Advisory subscription request
// Platform stores metadata + redirects user to broker's external payment URL.
// Broker then grants access manually from their dashboard.
// ────────────────────────────────────────────────────────────────────────────

router.post("/profiles/:profileId/advisory/request", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });
    const { profileId } = req.params;
    const { packageId } = req.body as { packageId: string };

    if (!packageId) return res.status(400).json({ error: "packageId required" });

    const check = await canSubscribeAdvisory(ctx.userId, ctx.orgId);
    if (!check.allowed) {
      return res.status(403).json({
        error: check.reason,
        message:
          check.reason === "tier_required"
            ? "Advisory subscriptions require Marketplace+ Solo or higher."
            : `You've used ${check.current} of ${check.limit} advisory slots.`,
        tier: check.tier,
        upgradeUrl: check.upgradeUrl,
      });
    }

    const [pkg] = await db
      .select()
      .from(brokerAdvisoryPackages)
      .where(
        and(
          eq(brokerAdvisoryPackages.id, packageId),
          eq(brokerAdvisoryPackages.brokerProfileId, profileId),
          eq(brokerAdvisoryPackages.isActive, true),
        ),
      );
    if (!pkg) return res.status(404).json({ error: "Advisory package not found" });

    // Upsert subscription at pending_payment until broker grants access.
    const [existing] = await db
      .select()
      .from(brokerSubscriptions)
      .where(
        and(
          eq(brokerSubscriptions.userId, ctx.userId),
          eq(brokerSubscriptions.brokerProfileId, profileId),
        ),
      );

    let subscription: typeof brokerSubscriptions.$inferSelect;
    if (existing) {
      const [updated] = await db
        .update(brokerSubscriptions)
        .set({
          tier: "advisory",
          advisoryPackageId: packageId,
          status: "pending_payment",
          updatedAt: new Date(),
        })
        .where(eq(brokerSubscriptions.id, existing.id))
        .returning();
      subscription = updated;
    } else {
      const [inserted] = await db
        .insert(brokerSubscriptions)
        .values({
          userId: ctx.userId,
          orgId: ctx.orgId,
          brokerProfileId: profileId,
          tier: "advisory",
          advisoryPackageId: packageId,
          status: "pending_payment",
        })
        .returning();
      subscription = inserted;
      await recordFollowInHistory(ctx.userId, profileId);
    }

    res.json({
      subscription,
      package: pkg,
      externalPaymentUrl: pkg.externalPaymentUrl,
      nextStep:
        "Complete payment on the broker's site. The broker will grant you access from their dashboard once payment is confirmed.",
    });
  } catch (err) {
    console.error("Advisory request error:", err);
    res.status(500).json({ error: "Failed to request advisory subscription" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Current user's subscriptions + entitlement summary
// ────────────────────────────────────────────────────────────────────────────

router.get("/me/subscriptions", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });

    const subs = await db
      .select()
      .from(brokerSubscriptions)
      .where(eq(brokerSubscriptions.userId, ctx.userId))
      .orderBy(desc(brokerSubscriptions.subscribedAt));

    const profileIds = subs.map((s) => s.brokerProfileId);
    const profiles = profileIds.length
      ? await db.select().from(brokerProfiles).where(inArray(brokerProfiles.id, profileIds))
      : [];
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    const entitlement = await getEffectiveBrokerEntitlement(ctx.userId, ctx.orgId);

    res.json({
      subscriptions: subs.map((s) => ({ ...s, brokerProfile: profileMap.get(s.brokerProfileId) })),
      entitlement,
    });
  } catch (err) {
    console.error("Me subscriptions error:", err);
    res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
});

router.get("/me/entitlement", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });
    const entitlement = await getEffectiveBrokerEntitlement(ctx.userId, ctx.orgId);
    res.json(entitlement);
  } catch (err) {
    console.error("Entitlement error:", err);
    res.status(500).json({ error: "Failed to fetch entitlement" });
  }
});

router.patch("/me/subscriptions/:subscriptionId/notifications", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });
    const { subscriptionId } = req.params;
    const { notifyNewListings, notifyAdvisoryContent, notifyMarketUpdates } = req.body;

    const [updated] = await db
      .update(brokerSubscriptions)
      .set({
        ...(notifyNewListings !== undefined && { notifyNewListings }),
        ...(notifyAdvisoryContent !== undefined && { notifyAdvisoryContent }),
        ...(notifyMarketUpdates !== undefined && { notifyMarketUpdates }),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(brokerSubscriptions.id, subscriptionId),
          eq(brokerSubscriptions.userId, ctx.userId),
        ),
      )
      .returning();

    if (!updated) return res.status(404).json({ error: "Subscription not found" });
    res.json(updated);
  } catch (err) {
    console.error("Notification prefs error:", err);
    res.status(500).json({ error: "Failed to update notification preferences" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Feed — listings from all of user's followed brokers
// ────────────────────────────────────────────────────────────────────────────

router.get("/me/feed/listings", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });
    const { limit = "50" } = req.query as Record<string, string>;
    const size = Math.min(200, Math.max(1, parseInt(limit, 10)));

    const subs = await db
      .select({ brokerProfileId: brokerSubscriptions.brokerProfileId })
      .from(brokerSubscriptions)
      .where(and(eq(brokerSubscriptions.userId, ctx.userId), eq(brokerSubscriptions.status, "active")));

    if (!subs.length) return res.json({ items: [], total: 0 });

    const profileIds = subs.map((s) => s.brokerProfileId);
    const listings = await db
      .select()
      .from(marinaListings)
      .where(and(inArray(marinaListings.brokerProfileId, profileIds), eq(marinaListings.isActive, true)))
      .orderBy(desc(marinaListings.publishedAt))
      .limit(size);

    res.json({ items: listings, total: listings.length });
  } catch (err) {
    console.error("Broker feed error:", err);
    res.status(500).json({ error: "Failed to fetch broker feed" });
  }
});

router.get("/me/feed/content", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });
    const { limit = "25" } = req.query as Record<string, string>;
    const size = Math.min(100, Math.max(1, parseInt(limit, 10)));

    // Find advisory subs (unlock full content) and follow subs (teasers only).
    const subs = await db
      .select()
      .from(brokerSubscriptions)
      .where(and(eq(brokerSubscriptions.userId, ctx.userId), eq(brokerSubscriptions.status, "active")));

    if (!subs.length) return res.json({ items: [] });

    const advisoryProfileIds = new Set(
      subs.filter((s) => s.tier === "advisory").map((s) => s.brokerProfileId),
    );
    const allProfileIds = subs.map((s) => s.brokerProfileId);

    const rows = await db
      .select()
      .from(brokerAdvisoryContent)
      .where(
        and(
          inArray(brokerAdvisoryContent.brokerProfileId, allProfileIds),
          sql`${brokerAdvisoryContent.publishedAt} IS NOT NULL`,
        ),
      )
      .orderBy(desc(brokerAdvisoryContent.publishedAt))
      .limit(size);

    const items = rows.map((item) => {
      const hasAdvisory = advisoryProfileIds.has(item.brokerProfileId);
      if (item.visibility === "public" || hasAdvisory) return item;
      return {
        ...item,
        body: null,
        excerpt: item.teaserExcerpt || item.excerpt,
        isLocked: true,
      };
    });

    res.json({ items });
  } catch (err) {
    console.error("Content feed error:", err);
    res.status(500).json({ error: "Failed to fetch content feed" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Advisory messaging (Marketplace+ Pro feature — gated by allow_broker_messaging)
// ────────────────────────────────────────────────────────────────────────────

router.get("/me/subscriptions/:subscriptionId/messages", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });
    const { subscriptionId } = req.params;

    const [sub] = await db
      .select()
      .from(brokerSubscriptions)
      .where(
        and(
          eq(brokerSubscriptions.id, subscriptionId),
          eq(brokerSubscriptions.userId, ctx.userId),
        ),
      );
    if (!sub) return res.status(404).json({ error: "Subscription not found" });

    const messages = await db
      .select()
      .from(brokerAdvisoryMessages)
      .where(eq(brokerAdvisoryMessages.subscriptionId, subscriptionId))
      .orderBy(brokerAdvisoryMessages.createdAt);

    res.json({ messages });
  } catch (err) {
    console.error("Messages fetch error:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/me/subscriptions/:subscriptionId/messages", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });
    const { subscriptionId } = req.params;
    const { body } = req.body as { body: string };
    if (!body?.trim()) return res.status(400).json({ error: "Message body required" });

    const entitlement = await getEffectiveBrokerEntitlement(ctx.userId, ctx.orgId);
    if (!entitlement.allowBrokerMessaging) {
      return res.status(403).json({
        error: "messaging_not_included",
        message: "Direct broker messaging requires Marketplace+ Pro.",
        upgradeUrl: "/settings/billing?upgrade=marketplace_plus_pro",
      });
    }

    const [sub] = await db
      .select()
      .from(brokerSubscriptions)
      .where(
        and(
          eq(brokerSubscriptions.id, subscriptionId),
          eq(brokerSubscriptions.userId, ctx.userId),
          eq(brokerSubscriptions.tier, "advisory"),
          eq(brokerSubscriptions.status, "active"),
        ),
      );
    if (!sub) return res.status(404).json({ error: "Active advisory subscription required" });

    const [msg] = await db
      .insert(brokerAdvisoryMessages)
      .values({
        subscriptionId,
        senderUserId: ctx.userId,
        senderRole: "user",
        body: body.trim(),
      })
      .returning();

    res.json(msg);
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

export default router;
