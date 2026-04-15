/**
 * Broker Listing Claim Service
 *
 * Handles auto-claim backfill on broker profile publication, manual claims
 * with auto-verify via email/phone match, dispute creation/resolution, and
 * release of claims when a broker profile goes unpublished.
 */

import { db } from "../db";
import {
  brokerListingClaims,
  brokerListingClaimDisputes,
  brokerProfiles,
  marinaListings,
  type BrokerListingClaim,
  type BrokerListingClaimDispute,
} from "@shared/schema";
import { and, eq, isNull, or, ilike, sql } from "drizzle-orm";

function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  return phone.replace(/\D+/g, "");
}

export type ClaimResult =
  | { status: "auto_verified"; claim: BrokerListingClaim }
  | { status: "pending_review"; claim: BrokerListingClaim }
  | { status: "conflict"; existingClaimBrokerProfileId: string; existingClaimId: string };

export async function backfillClaimsForProfile(
  brokerProfileId: string,
): Promise<{ claimed: number; skipped: number }> {
  const [profile] = await db
    .select()
    .from(brokerProfiles)
    .where(eq(brokerProfiles.id, brokerProfileId));

  if (!profile) return { claimed: 0, skipped: 0 };

  const email = (profile.contactEmail || "").trim();
  const normalizedPhone = normalizePhone(profile.contactPhone);

  if (!email && !normalizedPhone) return { claimed: 0, skipped: 0 };

  // Find candidate listings: unclaimed + email OR phone match, no existing claim row.
  const matchConds = [] as any[];
  if (email) matchConds.push(ilike(marinaListings.brokerEmail, email));
  if (normalizedPhone) {
    matchConds.push(
      sql`regexp_replace(COALESCE(${marinaListings.brokerPhone}, ''), '\\D', '', 'g') = ${normalizedPhone}`,
    );
  }

  const candidates = await db
    .select({
      id: marinaListings.id,
      brokerEmail: marinaListings.brokerEmail,
      brokerPhone: marinaListings.brokerPhone,
    })
    .from(marinaListings)
    .leftJoin(brokerListingClaims, eq(brokerListingClaims.listingId, marinaListings.id))
    .where(
      and(
        isNull(marinaListings.brokerProfileId),
        isNull(brokerListingClaims.id),
        or(...matchConds)!,
      ),
    );

  let claimed = 0;
  let skipped = 0;

  for (const listing of candidates) {
    const listingPhoneNormalized = normalizePhone(listing.brokerPhone);
    const emailMatch =
      email && listing.brokerEmail && listing.brokerEmail.toLowerCase() === email.toLowerCase();
    const phoneMatch =
      normalizedPhone && listingPhoneNormalized && listingPhoneNormalized === normalizedPhone;

    if (!emailMatch && !phoneMatch) {
      skipped++;
      continue;
    }

    const claimMethod = emailMatch ? "auto_email_match" : "auto_phone_match";

    try {
      await db.transaction(async (tx) => {
        await tx.insert(brokerListingClaims).values({
          listingId: listing.id,
          brokerProfileId,
          claimMethod,
          verified: true,
          verificationEvidence: {
            matchedField: emailMatch ? "email" : "phone",
            brokerEmail: profile.contactEmail,
            brokerPhone: profile.contactPhone,
            listingBrokerEmail: listing.brokerEmail,
            listingBrokerPhone: listing.brokerPhone,
          },
          verifiedAt: new Date(),
        });
        await tx
          .update(marinaListings)
          .set({ brokerProfileId })
          .where(eq(marinaListings.id, listing.id));
      });
      claimed++;
    } catch (err) {
      // Unique violation — another claim landed first. Skip.
      skipped++;
    }
  }

  return { claimed, skipped };
}

export async function requestManualClaim(params: {
  listingId: string;
  brokerProfileId: string;
}): Promise<ClaimResult> {
  const { listingId, brokerProfileId } = params;

  const [existing] = await db
    .select()
    .from(brokerListingClaims)
    .where(eq(brokerListingClaims.listingId, listingId));

  if (existing) {
    if (existing.brokerProfileId === brokerProfileId) {
      return { status: "auto_verified", claim: existing };
    }
    return {
      status: "conflict",
      existingClaimBrokerProfileId: existing.brokerProfileId,
      existingClaimId: existing.id,
    };
  }

  const [listing] = await db
    .select()
    .from(marinaListings)
    .where(eq(marinaListings.id, listingId));
  if (!listing) throw new Error("Listing not found");

  const [profile] = await db
    .select()
    .from(brokerProfiles)
    .where(eq(brokerProfiles.id, brokerProfileId));
  if (!profile) throw new Error("Broker profile not found");

  const profileEmail = (profile.contactEmail || "").toLowerCase().trim();
  const listingEmail = (listing.brokerEmail || "").toLowerCase().trim();
  const profilePhone = normalizePhone(profile.contactPhone);
  const listingPhone = normalizePhone(listing.brokerPhone);

  const emailMatch = !!profileEmail && !!listingEmail && profileEmail === listingEmail;
  const phoneMatch = !!profilePhone && !!listingPhone && profilePhone === listingPhone;
  const autoVerify = emailMatch || phoneMatch;

  if (autoVerify) {
    const claim = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(brokerListingClaims)
        .values({
          listingId,
          brokerProfileId,
          claimMethod: "manual_claim",
          verified: true,
          verificationEvidence: {
            matchedField: emailMatch ? "email" : "phone",
            brokerEmail: profile.contactEmail,
            listingBrokerEmail: listing.brokerEmail,
            brokerPhone: profile.contactPhone,
            listingBrokerPhone: listing.brokerPhone,
          },
          verifiedAt: new Date(),
        })
        .returning();
      await tx
        .update(marinaListings)
        .set({ brokerProfileId })
        .where(eq(marinaListings.id, listingId));
      return inserted;
    });
    return { status: "auto_verified", claim };
  }

  const [claim] = await db
    .insert(brokerListingClaims)
    .values({
      listingId,
      brokerProfileId,
      claimMethod: "manual_claim",
      verified: false,
      verificationEvidence: {
        matchedField: null,
        brokerEmail: profile.contactEmail,
        listingBrokerEmail: listing.brokerEmail,
        brokerPhone: profile.contactPhone,
        listingBrokerPhone: listing.brokerPhone,
      },
    })
    .returning();

  return { status: "pending_review", claim };
}

export async function openDispute(params: {
  listingId: string;
  challengerBrokerProfileId: string;
  reason: string;
  evidence?: unknown;
}): Promise<BrokerListingClaimDispute> {
  const { listingId, challengerBrokerProfileId, reason, evidence } = params;

  const [existing] = await db
    .select()
    .from(brokerListingClaims)
    .where(eq(brokerListingClaims.listingId, listingId));

  if (!existing) {
    throw new Error("No existing claim to dispute");
  }
  if (existing.brokerProfileId === challengerBrokerProfileId) {
    throw new Error("Cannot dispute your own claim");
  }

  const [dispute] = await db
    .insert(brokerListingClaimDisputes)
    .values({
      listingId,
      existingClaimId: existing.id,
      challengerBrokerProfileId,
      reason,
      evidence: (evidence as any) ?? null,
      status: "open",
    })
    .returning();

  return dispute;
}

export async function resolveDispute(params: {
  disputeId: string;
  resolvedBy: string;
  resolution: "existing" | "challenger" | "withdrawn";
  notes?: string;
}): Promise<void> {
  const { disputeId, resolvedBy, resolution, notes } = params;

  await db.transaction(async (tx) => {
    const [dispute] = await tx
      .select()
      .from(brokerListingClaimDisputes)
      .where(eq(brokerListingClaimDisputes.id, disputeId));
    if (!dispute) throw new Error("Dispute not found");
    if (dispute.status !== "open") throw new Error("Dispute already resolved");

    const statusMap = {
      existing: "resolved_in_favor_of_existing" as const,
      challenger: "resolved_in_favor_of_challenger" as const,
      withdrawn: "withdrawn" as const,
    };

    if (resolution === "challenger") {
      // Delete old claim + create new one + reassign listing.
      if (dispute.existingClaimId) {
        await tx
          .delete(brokerListingClaims)
          .where(eq(brokerListingClaims.id, dispute.existingClaimId));
      }
      await tx.insert(brokerListingClaims).values({
        listingId: dispute.listingId,
        brokerProfileId: dispute.challengerBrokerProfileId,
        claimMethod: "admin_assigned",
        verified: true,
        verificationEvidence: {
          resolvedFromDisputeId: disputeId,
          notes: notes || null,
        },
        verifiedAt: new Date(),
        verifiedBy: resolvedBy,
      });
      await tx
        .update(marinaListings)
        .set({ brokerProfileId: dispute.challengerBrokerProfileId })
        .where(eq(marinaListings.id, dispute.listingId));
    }

    await tx
      .update(brokerListingClaimDisputes)
      .set({
        status: statusMap[resolution],
        resolutionNotes: notes || null,
        resolvedBy,
        resolvedAt: new Date(),
      })
      .where(eq(brokerListingClaimDisputes.id, disputeId));
  });
}

export async function releaseUnpublishedProfileClaims(
  brokerProfileId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(marinaListings)
      .set({ brokerProfileId: null })
      .where(eq(marinaListings.brokerProfileId, brokerProfileId));
    await tx
      .delete(brokerListingClaims)
      .where(eq(brokerListingClaims.brokerProfileId, brokerProfileId));
  });
}
