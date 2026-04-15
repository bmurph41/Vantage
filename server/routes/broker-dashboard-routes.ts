/**
 * Broker Dashboard — broker-facing management routes
 *
 * Every route enforces ownership: the caller must own the broker profile being
 * modified (brokerProfiles.userId === req.user.id). Ownership is enforced via
 * requireProfileOwnership(profileId, userId), which throws a 403 error.
 *
 * Covers: profile CRUD, advisory package CRUD, advisory content CRUD + publish,
 * subscriber management (grant/revoke advisory access), and analytics.
 */

import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import {
  brokerProfiles,
  brokerAdvisoryPackages,
  brokerAdvisoryContent,
  brokerSubscriptions,
  brokerFollowHistory,
  marinaListings,
} from "@shared/schema";
import { and, desc, eq, sql, gte } from "drizzle-orm";
import { getBrokerTierDefinition } from "../services/broker-tiers";
import billingService from "../services/billing-service";
import {
  backfillClaimsForProfile,
  releaseUnpublishedProfileClaims,
} from "../services/broker-claim-service";

const router = Router();

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function getUserContext(req: Request): { userId: string; orgId: string } | null {
  const user = (req as any).user || (req as any).session?.user;
  if (!user?.id || !user?.orgId) return null;
  return { userId: user.id, orgId: user.orgId };
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function requireProfileOwnership(profileId: string, userId: string) {
  const [profile] = await db
    .select()
    .from(brokerProfiles)
    .where(eq(brokerProfiles.id, profileId));
  if (!profile) throw new HttpError(404, "Broker profile not found");
  if (profile.userId !== userId) {
    throw new HttpError(403, "You do not own this broker profile");
  }
  return profile;
}

async function getOwnedProfile(userId: string) {
  const [profile] = await db
    .select()
    .from(brokerProfiles)
    .where(eq(brokerProfiles.userId, userId));
  return profile || null;
}

function handleError(err: unknown, res: Response) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error("Broker dashboard error:", err);
  return res.status(500).json({ error: "Internal server error" });
}

// ────────────────────────────────────────────────────────────────────────────
// Profile Management
// ────────────────────────────────────────────────────────────────────────────

router.get("/my-profile", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });

    const profile = await getOwnedProfile(ctx.userId);
    if (!profile) return res.status(404).json({ error: "No broker profile found" });

    const [{ pkgCount } = { pkgCount: 0 }] = await db
      .select({ pkgCount: sql<number>`COUNT(*)::int` })
      .from(brokerAdvisoryPackages)
      .where(
        and(
          eq(brokerAdvisoryPackages.brokerProfileId, profile.id),
          eq(brokerAdvisoryPackages.isActive, true),
        ),
      );

    const [{ contentCount } = { contentCount: 0 }] = await db
      .select({ contentCount: sql<number>`COUNT(*)::int` })
      .from(brokerAdvisoryContent)
      .where(eq(brokerAdvisoryContent.brokerProfileId, profile.id));

    const [{ listingsCount } = { listingsCount: 0 }] = await db
      .select({ listingsCount: sql<number>`COUNT(*)::int` })
      .from(marinaListings)
      .where(eq(marinaListings.brokerProfileId, profile.id));

    const tierDef = profile.brokerTier ? getBrokerTierDefinition(profile.brokerTier) : null;

    res.json({
      profile,
      stats: {
        packageCount: Number(pkgCount || 0),
        contentCount: Number(contentCount || 0),
        listingsCount: Number(listingsCount || 0),
        followerCount: profile.followerCount,
        advisorySubscriberCount: profile.advisorySubscriberCount,
      },
      tierDefinition: tierDef,
    });
  } catch (err) {
    handleError(err, res);
  }
});

const EDITABLE_PROFILE_FIELDS = [
  "displayName",
  "companyName",
  "headshotUrl",
  "coverImageUrl",
  "bio",
  "specialties",
  "languages",
  "contactEmail",
  "contactPhone",
  "website",
  "linkedinUrl",
  "criteria",
  "autoLearnEnabled",
] as const;

router.patch("/my-profile", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });

    const profile = await getOwnedProfile(ctx.userId);
    if (!profile) return res.status(404).json({ error: "No broker profile found" });

    const updates: Record<string, unknown> = {};
    for (const field of EDITABLE_PROFILE_FIELDS) {
      if (field in req.body) updates[field] = (req.body as any)[field];
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No editable fields provided" });
    }
    updates.updatedAt = new Date();
    if ("criteria" in updates) {
      updates.criteriaUpdatedAt = new Date();
    }

    const [updated] = await db
      .update(brokerProfiles)
      .set(updates as any)
      .where(eq(brokerProfiles.id, profile.id))
      .returning();

    res.json({ profile: updated });
  } catch (err) {
    handleError(err, res);
  }
});

router.post("/my-profile/publish", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });

    const profile = await getOwnedProfile(ctx.userId);
    if (!profile) return res.status(404).json({ error: "No broker profile found" });

    const planCheck = await billingService.hasActiveBrokerPlan(ctx.userId);
    if (!planCheck.active) {
      return res.status(403).json({
        error: "no_active_broker_plan",
        message:
          "You must have an active broker plan to publish your profile.",
      });
    }
    if (planCheck.tier && planCheck.tier !== profile.brokerTier) {
      await db
        .update(brokerProfiles)
        .set({ brokerTier: planCheck.tier, updatedAt: new Date() })
        .where(eq(brokerProfiles.id, profile.id));
    }

    const published = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(brokerProfiles)
        .set({
          isPublishable: true,
          publishedAt: profile.publishedAt ?? new Date(),
          updatedAt: new Date(),
        })
        .where(eq(brokerProfiles.id, profile.id))
        .returning();
      return updated;
    });

    // Run backfill outside the txn since it opens its own transactions.
    const backfillResult = await backfillClaimsForProfile(profile.id);

    res.json({ profile: published, backfill: backfillResult });
  } catch (err) {
    handleError(err, res);
  }
});

router.post("/my-profile/unpublish", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });

    const profile = await getOwnedProfile(ctx.userId);
    if (!profile) return res.status(404).json({ error: "No broker profile found" });

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(brokerProfiles)
        .set({ isPublishable: false, updatedAt: new Date() })
        .where(eq(brokerProfiles.id, profile.id))
        .returning();
      return row;
    });

    await releaseUnpublishedProfileClaims(profile.id);

    res.json({ profile: updated });
  } catch (err) {
    handleError(err, res);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Advisory Packages
// ────────────────────────────────────────────────────────────────────────────

router.get("/advisory-packages", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });
    const profile = await getOwnedProfile(ctx.userId);
    if (!profile) return res.status(404).json({ error: "No broker profile found" });

    const packages = await db
      .select()
      .from(brokerAdvisoryPackages)
      .where(eq(brokerAdvisoryPackages.brokerProfileId, profile.id))
      .orderBy(brokerAdvisoryPackages.sortOrder, desc(brokerAdvisoryPackages.createdAt));

    const tierDef = profile.brokerTier ? getBrokerTierDefinition(profile.brokerTier) : null;
    res.json({
      packages,
      limits: {
        maxAdvisoryPackages: tierDef?.maxAdvisoryPackages ?? 1,
        tier: profile.brokerTier,
        current: packages.filter((p) => p.isActive).length,
      },
    });
  } catch (err) {
    handleError(err, res);
  }
});

router.post("/advisory-packages", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });
    const profile = await getOwnedProfile(ctx.userId);
    if (!profile) return res.status(404).json({ error: "No broker profile found" });

    const tierDef = profile.brokerTier ? getBrokerTierDefinition(profile.brokerTier) : null;
    const limit = tierDef?.maxAdvisoryPackages ?? 1;
    if (limit !== -1) {
      const [{ c } = { c: 0 }] = await db
        .select({ c: sql<number>`COUNT(*)::int` })
        .from(brokerAdvisoryPackages)
        .where(
          and(
            eq(brokerAdvisoryPackages.brokerProfileId, profile.id),
            eq(brokerAdvisoryPackages.isActive, true),
          ),
        );
      if (Number(c || 0) >= limit) {
        return res.status(403).json({
          error: "package_limit_reached",
          message: `Your ${profile.brokerTier} tier allows up to ${limit} advisory package(s).`,
          limit,
          current: Number(c || 0),
        });
      }
    }

    const {
      name,
      tagline,
      description,
      deliverables,
      priceMonthlyCents,
      priceAnnualCents,
      currency,
      cadence,
      externalPaymentUrl,
      maxSubscribers,
      sortOrder,
    } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: "name required" });

    const [pkg] = await db
      .insert(brokerAdvisoryPackages)
      .values({
        brokerProfileId: profile.id,
        name: name.trim(),
        tagline,
        description,
        deliverables: deliverables ?? null,
        priceMonthlyCents,
        priceAnnualCents,
        currency: currency || "USD",
        cadence: cadence || "monthly",
        externalPaymentUrl,
        maxSubscribers,
        sortOrder: sortOrder ?? 0,
        isActive: true,
      })
      .returning();

    res.json({ package: pkg });
  } catch (err) {
    handleError(err, res);
  }
});

router.patch("/advisory-packages/:id", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });
    const profile = await getOwnedProfile(ctx.userId);
    if (!profile) return res.status(404).json({ error: "No broker profile found" });

    const [existing] = await db
      .select()
      .from(brokerAdvisoryPackages)
      .where(eq(brokerAdvisoryPackages.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Package not found" });
    if (existing.brokerProfileId !== profile.id) {
      return res.status(403).json({ error: "Not your package" });
    }

    const allowed = [
      "name",
      "tagline",
      "description",
      "deliverables",
      "priceMonthlyCents",
      "priceAnnualCents",
      "currency",
      "cadence",
      "externalPaymentUrl",
      "maxSubscribers",
      "sortOrder",
      "isActive",
    ];
    const updates: Record<string, unknown> = {};
    for (const k of allowed) {
      if (k in req.body) updates[k] = (req.body as any)[k];
    }
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(brokerAdvisoryPackages)
      .set(updates as any)
      .where(eq(brokerAdvisoryPackages.id, req.params.id))
      .returning();

    res.json({ package: updated });
  } catch (err) {
    handleError(err, res);
  }
});

router.delete("/advisory-packages/:id", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });
    const profile = await getOwnedProfile(ctx.userId);
    if (!profile) return res.status(404).json({ error: "No broker profile found" });

    const [existing] = await db
      .select()
      .from(brokerAdvisoryPackages)
      .where(eq(brokerAdvisoryPackages.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Package not found" });
    if (existing.brokerProfileId !== profile.id) {
      return res.status(403).json({ error: "Not your package" });
    }

    await db
      .update(brokerAdvisoryPackages)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(brokerAdvisoryPackages.id, req.params.id));

    res.json({ success: true });
  } catch (err) {
    handleError(err, res);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Advisory Content
// ────────────────────────────────────────────────────────────────────────────

router.get("/content", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });
    const profile = await getOwnedProfile(ctx.userId);
    if (!profile) return res.status(404).json({ error: "No broker profile found" });

    const items = await db
      .select()
      .from(brokerAdvisoryContent)
      .where(eq(brokerAdvisoryContent.brokerProfileId, profile.id))
      .orderBy(desc(brokerAdvisoryContent.createdAt));

    res.json({ items });
  } catch (err) {
    handleError(err, res);
  }
});

router.post("/content", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });
    const profile = await getOwnedProfile(ctx.userId);
    if (!profile) return res.status(404).json({ error: "No broker profile found" });

    const {
      title,
      excerpt,
      body,
      contentType,
      attachedListingIds,
      visibility,
      teaserExcerpt,
    } = req.body;

    if (!title?.trim()) return res.status(400).json({ error: "title required" });

    const [row] = await db
      .insert(brokerAdvisoryContent)
      .values({
        brokerProfileId: profile.id,
        title: title.trim(),
        excerpt,
        body,
        contentType: contentType || "note",
        attachedListingIds: attachedListingIds ?? null,
        visibility: visibility || "advisory_only",
        teaserExcerpt,
      })
      .returning();

    res.json({ content: row });
  } catch (err) {
    handleError(err, res);
  }
});

router.patch("/content/:id", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });
    const profile = await getOwnedProfile(ctx.userId);
    if (!profile) return res.status(404).json({ error: "No broker profile found" });

    const [existing] = await db
      .select()
      .from(brokerAdvisoryContent)
      .where(eq(brokerAdvisoryContent.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Content not found" });
    if (existing.brokerProfileId !== profile.id) {
      return res.status(403).json({ error: "Not your content" });
    }

    const allowed = [
      "title",
      "excerpt",
      "body",
      "contentType",
      "attachedListingIds",
      "visibility",
      "teaserExcerpt",
      "isPinned",
    ];
    const updates: Record<string, unknown> = {};
    for (const k of allowed) {
      if (k in req.body) updates[k] = (req.body as any)[k];
    }
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(brokerAdvisoryContent)
      .set(updates as any)
      .where(eq(brokerAdvisoryContent.id, req.params.id))
      .returning();

    res.json({ content: updated });
  } catch (err) {
    handleError(err, res);
  }
});

router.post("/content/:id/publish", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });
    const profile = await getOwnedProfile(ctx.userId);
    if (!profile) return res.status(404).json({ error: "No broker profile found" });

    const [existing] = await db
      .select()
      .from(brokerAdvisoryContent)
      .where(eq(brokerAdvisoryContent.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Content not found" });
    if (existing.brokerProfileId !== profile.id) {
      return res.status(403).json({ error: "Not your content" });
    }
    if (!existing.title?.trim() || !existing.body?.trim()) {
      return res.status(400).json({
        error: "validation_failed",
        message: "Title and body are required to publish.",
      });
    }

    const [updated] = await db
      .update(brokerAdvisoryContent)
      .set({ publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(brokerAdvisoryContent.id, req.params.id))
      .returning();

    res.json({ content: updated });
  } catch (err) {
    handleError(err, res);
  }
});

router.post("/content/:id/unpublish", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });
    const profile = await getOwnedProfile(ctx.userId);
    if (!profile) return res.status(404).json({ error: "No broker profile found" });

    const [existing] = await db
      .select()
      .from(brokerAdvisoryContent)
      .where(eq(brokerAdvisoryContent.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Content not found" });
    if (existing.brokerProfileId !== profile.id) {
      return res.status(403).json({ error: "Not your content" });
    }

    const [updated] = await db
      .update(brokerAdvisoryContent)
      .set({ publishedAt: null, updatedAt: new Date() })
      .where(eq(brokerAdvisoryContent.id, req.params.id))
      .returning();

    res.json({ content: updated });
  } catch (err) {
    handleError(err, res);
  }
});

router.delete("/content/:id", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });
    const profile = await getOwnedProfile(ctx.userId);
    if (!profile) return res.status(404).json({ error: "No broker profile found" });

    const [existing] = await db
      .select()
      .from(brokerAdvisoryContent)
      .where(eq(brokerAdvisoryContent.id, req.params.id));
    if (!existing) return res.status(404).json({ error: "Content not found" });
    if (existing.brokerProfileId !== profile.id) {
      return res.status(403).json({ error: "Not your content" });
    }

    await db.delete(brokerAdvisoryContent).where(eq(brokerAdvisoryContent.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    handleError(err, res);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Subscribers
// ────────────────────────────────────────────────────────────────────────────

router.get("/subscribers", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });
    const profile = await getOwnedProfile(ctx.userId);
    if (!profile) return res.status(404).json({ error: "No broker profile found" });

    const { status, tier, page = "1", pageSize = "50" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10));
    const size = Math.min(200, Math.max(1, parseInt(pageSize, 10)));
    const offset = (pageNum - 1) * size;

    const conds = [eq(brokerSubscriptions.brokerProfileId, profile.id)];
    if (status) conds.push(eq(brokerSubscriptions.status, status));
    if (tier) conds.push(eq(brokerSubscriptions.tier, tier));

    const rows = await db
      .select()
      .from(brokerSubscriptions)
      .where(and(...conds))
      .orderBy(desc(brokerSubscriptions.subscribedAt))
      .limit(size)
      .offset(offset);

    const [{ cnt } = { cnt: 0 }] = await db
      .select({ cnt: sql<number>`COUNT(*)::int` })
      .from(brokerSubscriptions)
      .where(and(...conds));

    res.json({
      items: rows,
      total: Number(cnt || 0),
      page: pageNum,
      pageSize: size,
      totalPages: Math.ceil(Number(cnt || 0) / size),
    });
  } catch (err) {
    handleError(err, res);
  }
});

router.post("/subscribers/:subscriptionId/grant-advisory", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });
    const profile = await getOwnedProfile(ctx.userId);
    if (!profile) return res.status(404).json({ error: "No broker profile found" });

    const { paymentReference } = req.body as { paymentReference?: string };

    const [sub] = await db
      .select()
      .from(brokerSubscriptions)
      .where(eq(brokerSubscriptions.id, req.params.subscriptionId));
    if (!sub) return res.status(404).json({ error: "Subscription not found" });
    if (sub.brokerProfileId !== profile.id) {
      return res.status(403).json({ error: "Not your subscriber" });
    }
    if (sub.status !== "pending_payment") {
      return res.status(400).json({
        error: "invalid_state",
        message: `Subscription is ${sub.status}, cannot grant.`,
      });
    }

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(brokerSubscriptions)
        .set({
          status: "active",
          advisoryStartedAt: new Date(),
          grantedBy: ctx.userId,
          externalPaymentReference: paymentReference ?? null,
          updatedAt: new Date(),
        })
        .where(eq(brokerSubscriptions.id, sub.id))
        .returning();
      await tx
        .update(brokerProfiles)
        .set({ advisorySubscriberCount: sql`${brokerProfiles.advisorySubscriberCount} + 1` })
        .where(eq(brokerProfiles.id, profile.id));
      return row;
    });

    res.json({ subscription: updated });
  } catch (err) {
    handleError(err, res);
  }
});

router.post("/subscribers/:subscriptionId/revoke", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });
    const profile = await getOwnedProfile(ctx.userId);
    if (!profile) return res.status(404).json({ error: "No broker profile found" });

    const [sub] = await db
      .select()
      .from(brokerSubscriptions)
      .where(eq(brokerSubscriptions.id, req.params.subscriptionId));
    if (!sub) return res.status(404).json({ error: "Subscription not found" });
    if (sub.brokerProfileId !== profile.id) {
      return res.status(403).json({ error: "Not your subscriber" });
    }

    const wasActiveAdvisory = sub.status === "active" && sub.tier === "advisory";

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(brokerSubscriptions)
        .set({ status: "canceled", canceledAt: new Date(), updatedAt: new Date() })
        .where(eq(brokerSubscriptions.id, sub.id))
        .returning();
      if (wasActiveAdvisory) {
        await tx
          .update(brokerProfiles)
          .set({
            advisorySubscriberCount: sql`GREATEST(${brokerProfiles.advisorySubscriberCount} - 1, 0)`,
          })
          .where(eq(brokerProfiles.id, profile.id));
      }
      return row;
    });

    res.json({ subscription: updated });
  } catch (err) {
    handleError(err, res);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Analytics
// ────────────────────────────────────────────────────────────────────────────

router.get("/analytics/overview", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });
    const profile = await getOwnedProfile(ctx.userId);
    if (!profile) return res.status(404).json({ error: "No broker profile found" });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [{ pending } = { pending: 0 }] = await db
      .select({ pending: sql<number>`COUNT(*)::int` })
      .from(brokerSubscriptions)
      .where(
        and(
          eq(brokerSubscriptions.brokerProfileId, profile.id),
          eq(brokerSubscriptions.status, "pending_payment"),
          eq(brokerSubscriptions.tier, "advisory"),
        ),
      );

    const [{ listingsPublished } = { listingsPublished: 0 }] = await db
      .select({ listingsPublished: sql<number>`COUNT(*)::int` })
      .from(marinaListings)
      .where(
        and(eq(marinaListings.brokerProfileId, profile.id), eq(marinaListings.isActive, true)),
      );

    const [{ contentPublished } = { contentPublished: 0 }] = await db
      .select({ contentPublished: sql<number>`COUNT(*)::int` })
      .from(brokerAdvisoryContent)
      .where(
        and(
          eq(brokerAdvisoryContent.brokerProfileId, profile.id),
          sql`${brokerAdvisoryContent.publishedAt} IS NOT NULL`,
        ),
      );

    const [{ newFollowers } = { newFollowers: 0 }] = await db
      .select({ newFollowers: sql<number>`COUNT(*)::int` })
      .from(brokerFollowHistory)
      .where(
        and(
          eq(brokerFollowHistory.brokerProfileId, profile.id),
          gte(brokerFollowHistory.firstFollowedAt, thirtyDaysAgo),
        ),
      );

    const recentActivity = await db
      .select()
      .from(brokerSubscriptions)
      .where(eq(brokerSubscriptions.brokerProfileId, profile.id))
      .orderBy(desc(brokerSubscriptions.subscribedAt))
      .limit(10);

    res.json({
      totalFollowers: profile.followerCount,
      totalAdvisorySubscribers: profile.advisorySubscriberCount,
      pendingAdvisoryRequests: Number(pending || 0),
      listingsPublished: Number(listingsPublished || 0),
      contentPublished: Number(contentPublished || 0),
      newFollowersLast30Days: Number(newFollowers || 0),
      recentActivity,
    });
  } catch (err) {
    handleError(err, res);
  }
});

router.get("/analytics/followers-over-time", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "Authentication required" });
    const profile = await getOwnedProfile(ctx.userId);
    if (!profile) return res.status(404).json({ error: "No broker profile found" });

    const days = Math.min(365, Math.max(1, parseInt((req.query.days as string) || "30", 10)));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await db
      .select({
        date: sql<string>`DATE(${brokerFollowHistory.firstFollowedAt})::text`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(brokerFollowHistory)
      .where(
        and(
          eq(brokerFollowHistory.brokerProfileId, profile.id),
          gte(brokerFollowHistory.firstFollowedAt, since),
        ),
      )
      .groupBy(sql`DATE(${brokerFollowHistory.firstFollowedAt})`)
      .orderBy(sql`DATE(${brokerFollowHistory.firstFollowedAt})`);

    res.json({
      series: rows.map((r) => ({ date: r.date, count: Number(r.count || 0) })),
      days,
    });
  } catch (err) {
    handleError(err, res);
  }
});

export default router;
