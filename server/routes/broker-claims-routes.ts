/**
 * Broker Listing Claims — routes
 *
 * Broker-facing: request a claim, open a dispute, list my claims/disputes,
 * browse unclaimed listings (with optional match hint).
 *
 * Admin-facing: verify/reject pending claims, view + resolve disputes.
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import {
  brokerListingClaims,
  brokerListingClaimDisputes,
  brokerProfiles,
  marinaListings,
} from "@shared/schema";
import { and, desc, eq, inArray, isNull, or, ilike, sql } from "drizzle-orm";
import {
  requestManualClaim,
  openDispute,
  resolveDispute,
} from "../services/broker-claim-service";

const router = Router();

function getUserContext(req: Request): { userId: string; orgId: string } | null {
  const user = (req as any).user || (req as any).session?.user;
  if (!user?.id || !user?.orgId) return null;
  return { userId: user.id, orgId: user.orgId };
}

function isAdmin(req: Request): boolean {
  const user = (req as any).user || (req as any).session?.user;
  const role = user?.role;
  return role === "admin" || role === "owner" || user?.isAdmin === true;
}

type OwnershipResult =
  | { ok: true }
  | { ok: false; code: number; error: string; message: string };

async function assertProfileOwnership(
  brokerProfileId: string,
  userId: string,
): Promise<OwnershipResult> {
  const [profile] = await db
    .select()
    .from(brokerProfiles)
    .where(eq(brokerProfiles.id, brokerProfileId));
  if (!profile) {
    return { ok: false, code: 404, error: "profile_not_found", message: "Broker profile not found" };
  }
  if (profile.userId !== userId) {
    return { ok: false, code: 403, error: "forbidden", message: "You do not own this broker profile" };
  }
  return { ok: true };
}

function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/\D+/g, "");
}

// ────────────────────────────────────────────────────────────────────────────
// Broker-facing
// ────────────────────────────────────────────────────────────────────────────

router.post("/claim", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    const { brokerProfileId, listingId } = req.body as {
      brokerProfileId?: string;
      listingId?: string;
    };
    if (!brokerProfileId || !listingId) {
      return res.status(400).json({ error: "bad_request", message: "brokerProfileId and listingId are required" });
    }
    const ownership = await assertProfileOwnership(brokerProfileId, ctx.userId);
    if (!ownership.ok) {
      return res.status(ownership.code).json({ error: ownership.error, message: ownership.message });
    }

    const result = await requestManualClaim({ listingId, brokerProfileId });
    res.json(result);
  } catch (err: any) {
    console.error("Claim request error:", err);
    res.status(500).json({ error: "claim_failed", message: err?.message || "Failed to process claim" });
  }
});

router.post("/dispute", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    const { brokerProfileId, listingId, reason, evidence } = req.body as {
      brokerProfileId?: string;
      listingId?: string;
      reason?: string;
      evidence?: unknown;
    };
    if (!brokerProfileId || !listingId || !reason) {
      return res
        .status(400)
        .json({ error: "bad_request", message: "brokerProfileId, listingId, and reason are required" });
    }
    const ownership = await assertProfileOwnership(brokerProfileId, ctx.userId);
    if (!ownership.ok) {
      return res.status(ownership.code).json({ error: ownership.error, message: ownership.message });
    }

    const dispute = await openDispute({
      listingId,
      challengerBrokerProfileId: brokerProfileId,
      reason,
      evidence,
    });
    res.json(dispute);
  } catch (err: any) {
    console.error("Dispute open error:", err);
    res.status(500).json({ error: "dispute_failed", message: err?.message || "Failed to open dispute" });
  }
});

router.get("/me/claims", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    const { brokerProfileId } = req.query as Record<string, string>;

    const myProfiles = await db
      .select({ id: brokerProfiles.id })
      .from(brokerProfiles)
      .where(eq(brokerProfiles.userId, ctx.userId));
    let profileIds = myProfiles.map((p) => p.id);
    if (brokerProfileId) profileIds = profileIds.filter((id) => id === brokerProfileId);

    if (!profileIds.length) return res.json({ items: [] });

    const claims = await db
      .select({
        claim: brokerListingClaims,
        listing: {
          id: marinaListings.id,
          title: marinaListings.title,
          city: marinaListings.city,
          state: marinaListings.state,
          publishedAt: marinaListings.publishedAt,
          askingPrice: marinaListings.askingPrice,
        },
      })
      .from(brokerListingClaims)
      .leftJoin(marinaListings, eq(marinaListings.id, brokerListingClaims.listingId))
      .where(inArray(brokerListingClaims.brokerProfileId, profileIds))
      .orderBy(desc(brokerListingClaims.claimedAt));

    res.json({ items: claims });
  } catch (err: any) {
    console.error("Me claims error:", err);
    res.status(500).json({ error: "fetch_failed", message: "Failed to fetch claims" });
  }
});

router.get("/me/disputes", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    const { brokerProfileId } = req.query as Record<string, string>;

    const myProfiles = await db
      .select({ id: brokerProfiles.id })
      .from(brokerProfiles)
      .where(eq(brokerProfiles.userId, ctx.userId));
    let profileIds = myProfiles.map((p) => p.id);
    if (brokerProfileId) profileIds = profileIds.filter((id) => id === brokerProfileId);

    if (!profileIds.length) return res.json({ filed: [], against: [] });

    // Disputes I filed as challenger
    const filed = await db
      .select()
      .from(brokerListingClaimDisputes)
      .where(inArray(brokerListingClaimDisputes.challengerBrokerProfileId, profileIds))
      .orderBy(desc(brokerListingClaimDisputes.createdAt));

    // Disputes against my existing claims
    const myClaims = await db
      .select({ id: brokerListingClaims.id })
      .from(brokerListingClaims)
      .where(inArray(brokerListingClaims.brokerProfileId, profileIds));
    const myClaimIds = myClaims.map((c) => c.id);

    const against = myClaimIds.length
      ? await db
          .select()
          .from(brokerListingClaimDisputes)
          .where(inArray(brokerListingClaimDisputes.existingClaimId, myClaimIds))
          .orderBy(desc(brokerListingClaimDisputes.createdAt))
      : [];

    res.json({ filed, against });
  } catch (err: any) {
    console.error("Me disputes error:", err);
    res.status(500).json({ error: "fetch_failed", message: "Failed to fetch disputes" });
  }
});

router.get("/unclaimed", async (req: Request, res: Response) => {
  try {
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    const { brokerProfileId, limit = "50", matchHint } = req.query as Record<string, string>;
    const size = Math.min(200, Math.max(1, parseInt(limit, 10)));

    if (!brokerProfileId) {
      return res.status(400).json({ error: "bad_request", message: "brokerProfileId is required" });
    }
    const ownership = await assertProfileOwnership(brokerProfileId, ctx.userId);
    if (!ownership.ok) {
      return res.status(ownership.code).json({ error: ownership.error, message: ownership.message });
    }

    const [profile] = await db
      .select()
      .from(brokerProfiles)
      .where(eq(brokerProfiles.id, brokerProfileId));

    const conditions = [isNull(marinaListings.brokerProfileId)];

    if (matchHint === "true" && profile) {
      const email = (profile.contactEmail || "").trim();
      const phone = normalizePhone(profile.contactPhone);
      const hintConds = [] as any[];
      if (email) hintConds.push(ilike(marinaListings.brokerEmail, email));
      if (phone) {
        hintConds.push(
          sql`regexp_replace(COALESCE(${marinaListings.brokerPhone}, ''), '\\D', '', 'g') = ${phone}`,
        );
      }
      if (hintConds.length) conditions.push(or(...hintConds)!);
    }

    const listings = await db
      .select()
      .from(marinaListings)
      .leftJoin(brokerListingClaims, eq(brokerListingClaims.listingId, marinaListings.id))
      .where(and(...conditions, isNull(brokerListingClaims.id)))
      .orderBy(desc(marinaListings.publishedAt))
      .limit(size);

    res.json({ items: listings.map((row) => row.marina_listings) });
  } catch (err: any) {
    console.error("Unclaimed listings error:", err);
    res.status(500).json({ error: "fetch_failed", message: "Failed to fetch unclaimed listings" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Admin-facing
// ────────────────────────────────────────────────────────────────────────────

router.get("/admin/pending", async (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: "forbidden", message: "Admin access required" });

    const rows = await db
      .select({
        claim: brokerListingClaims,
        listing: {
          id: marinaListings.id,
          title: marinaListings.title,
          city: marinaListings.city,
          state: marinaListings.state,
          brokerEmail: marinaListings.brokerEmail,
          brokerPhone: marinaListings.brokerPhone,
        },
        profile: {
          id: brokerProfiles.id,
          displayName: brokerProfiles.displayName,
          contactEmail: brokerProfiles.contactEmail,
          contactPhone: brokerProfiles.contactPhone,
        },
      })
      .from(brokerListingClaims)
      .leftJoin(marinaListings, eq(marinaListings.id, brokerListingClaims.listingId))
      .leftJoin(brokerProfiles, eq(brokerProfiles.id, brokerListingClaims.brokerProfileId))
      .where(eq(brokerListingClaims.verified, false))
      .orderBy(desc(brokerListingClaims.claimedAt));

    res.json({ items: rows });
  } catch (err: any) {
    console.error("Admin pending claims error:", err);
    res.status(500).json({ error: "fetch_failed", message: "Failed to fetch pending claims" });
  }
});

router.post("/admin/:claimId/verify", async (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: "forbidden", message: "Admin access required" });
    const ctx = getUserContext(req);
    const { claimId } = req.params;
    const { notes } = req.body as { notes?: string };

    const result = await db.transaction(async (tx) => {
      const [claim] = await tx
        .select()
        .from(brokerListingClaims)
        .where(eq(brokerListingClaims.id, claimId));
      if (!claim) throw new Error("Claim not found");

      const [updated] = await tx
        .update(brokerListingClaims)
        .set({
          verified: true,
          verifiedAt: new Date(),
          verifiedBy: ctx?.userId,
          verificationEvidence: {
            ...((claim.verificationEvidence as any) || {}),
            adminNotes: notes || null,
          },
          updatedAt: new Date(),
        })
        .where(eq(brokerListingClaims.id, claimId))
        .returning();

      await tx
        .update(marinaListings)
        .set({ brokerProfileId: claim.brokerProfileId })
        .where(eq(marinaListings.id, claim.listingId));

      return updated;
    });

    res.json(result);
  } catch (err: any) {
    console.error("Admin verify claim error:", err);
    res.status(500).json({ error: "verify_failed", message: err?.message || "Failed to verify claim" });
  }
});

router.post("/admin/:claimId/reject", async (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: "forbidden", message: "Admin access required" });
    const { claimId } = req.params;

    const [deleted] = await db
      .delete(brokerListingClaims)
      .where(eq(brokerListingClaims.id, claimId))
      .returning();
    if (!deleted) return res.status(404).json({ error: "not_found", message: "Claim not found" });

    res.json({ success: true });
  } catch (err: any) {
    console.error("Admin reject claim error:", err);
    res.status(500).json({ error: "reject_failed", message: err?.message || "Failed to reject claim" });
  }
});

router.get("/admin/disputes", async (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: "forbidden", message: "Admin access required" });

    const rows = await db
      .select()
      .from(brokerListingClaimDisputes)
      .where(eq(brokerListingClaimDisputes.status, "open"))
      .orderBy(desc(brokerListingClaimDisputes.createdAt));

    res.json({ items: rows });
  } catch (err: any) {
    console.error("Admin disputes error:", err);
    res.status(500).json({ error: "fetch_failed", message: "Failed to fetch disputes" });
  }
});

router.post("/admin/disputes/:disputeId/resolve", async (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ error: "forbidden", message: "Admin access required" });
    const ctx = getUserContext(req);
    if (!ctx) return res.status(401).json({ error: "unauthorized", message: "Authentication required" });
    const { disputeId } = req.params;
    const { resolution, notes } = req.body as {
      resolution?: "existing" | "challenger" | "withdrawn";
      notes?: string;
    };
    if (!resolution || !["existing", "challenger", "withdrawn"].includes(resolution)) {
      return res
        .status(400)
        .json({ error: "bad_request", message: "resolution must be one of: existing, challenger, withdrawn" });
    }

    await resolveDispute({ disputeId, resolvedBy: ctx.userId, resolution, notes });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Admin resolve dispute error:", err);
    res.status(500).json({ error: "resolve_failed", message: err?.message || "Failed to resolve dispute" });
  }
});

export default router;
