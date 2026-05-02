/**
 * provision-service.ts — Atomic tier provisioning.
 *
 * Single source of truth for "set an org's tier" — collapses the
 * three downstream tables (billing_subscriptions, organization_packs,
 * billing_feature_flags) into one transaction.
 *
 * Replaces hand-coded provisioning across createSubscription,
 * changePlan, handleCheckoutSessionCompleted, and the server/index.ts
 * Stripe webhook handlers. Migration in progress (Phase A fix-4b).
 *
 * Key behaviors:
 * - Atomic: all writes in single db.transaction()
 * - Idempotent: provisionTier(org, currentTier) is safe no-op
 * - Override-preserving: billing_feature_flags is_override=true rows
 *   are NEVER demoted to false (fixes pre-existing bug in
 *   provisionFeatureFlags)
 * - Audit-preserving: organization_packs rows for packs not in new
 *   tier are status='cancelled', NOT deleted
 * - Trial-preserving: existing trialEndsAt / expiresAt on packs are
 *   not overwritten on re-provision
 */

import { db } from '../db';
import {
  billingSubscriptions,
  organizationPacks,
  billingFeatureFlags,
  type BillingSubscription,
  type OrganizationPack,
} from '@shared/schema';
import {
  type SubscriptionTierSlug,
  getPacksForTier,
  getLimitsForTier,
} from '@shared/tier-packs';
import { getFeaturesForTier } from '@shared/tier-features';
import { eq, and, notInArray, sql } from 'drizzle-orm';

export interface ProvisionTierOptions {
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  stripePriceId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  billingCycle?: 'monthly' | 'annual';
  status?: 'trialing' | 'active' | 'canceled' | 'past_due' | 'paused' | 'incomplete';
  mode: 'create' | 'change' | 'webhook';
  userId?: string;
  /** Future cancellation date (Stripe cancel_at_period_end). */
  cancelAt?: Date | null;
  /** Cancellation timestamp (Stripe canceled_at). */
  canceledAt?: Date | null;
}

export interface ProvisionTierResult {
  subscription: BillingSubscription;
  packs: OrganizationPack[];
  flagsApplied: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Atomically set an org's tier — writes subscription, packs, and
 * feature flags in a single transaction.
 */
export async function provisionTier(
  orgId: string,
  tier: SubscriptionTierSlug,
  options: ProvisionTierOptions,
): Promise<ProvisionTierResult> {
  const now = new Date();
  const billingCycle = options.billingCycle ?? 'monthly';
  const currentPeriodStart = options.currentPeriodStart ?? now;
  const currentPeriodEnd =
    options.currentPeriodEnd ??
    new Date(
      currentPeriodStart.getTime() +
        (billingCycle === 'annual' ? 365 : 30) * MS_PER_DAY,
    );

  const isCreate = options.mode === 'create';
  const status = options.status ?? (isCreate ? 'trialing' : 'active');
  const trialStart = isCreate ? now : undefined;
  const trialEnd = isCreate ? new Date(now.getTime() + 14 * MS_PER_DAY) : undefined;

  // TypeScript enforces tier as SubscriptionTierSlug at the signature, so
  // every tier is in TIER_LIMITS — no unknown-tier check needed.
  const limits = getLimitsForTier(tier);
  const seatLimit = limits.seats === -1 ? null : limits.seats;
  const dealLimit = limits.deals === -1 ? null : limits.deals;
  const storageGbLimit = limits.storageGb === -1 ? null : limits.storageGb;
  const aiQueryLimit = limits.aiQueries === -1 ? null : limits.aiQueries;

  const stripeSubscriptionId = options.stripeSubscriptionId ?? null;
  const stripeCustomerId = options.stripeCustomerId ?? null;
  const stripePriceId = options.stripePriceId ?? null;

  const cancelAt = options.cancelAt ?? null;
  const canceledAt = options.canceledAt ?? null;

  return await db.transaction(async (tx) => {
    // ── Phase 1 — billing_subscriptions upsert ──────────────────────────
    const subInsertValues = {
      orgId,
      tier,
      status,
      billingCycle,
      currentPeriodStart,
      currentPeriodEnd,
      stripeSubscriptionId,
      stripeCustomerId,
      stripePriceId,
      seatLimit,
      dealLimit,
      storageGbLimit,
      aiQueryLimit,
      cancelAt,
      canceledAt,
      ...(isCreate ? { trialStart, trialEnd } : {}),
      updatedAt: now,
    };

    const [subscription] = await tx
      .insert(billingSubscriptions)
      .values(subInsertValues)
      .onConflictDoUpdate({
        target: billingSubscriptions.orgId,
        // trial fields excluded from conflict update — preserved across re-provision
        set: {
          tier: sql`EXCLUDED.tier`,
          status: sql`EXCLUDED.status`,
          billingCycle: sql`EXCLUDED.billing_cycle`,
          currentPeriodStart: sql`EXCLUDED.current_period_start`,
          currentPeriodEnd: sql`EXCLUDED.current_period_end`,
          stripeSubscriptionId: sql`COALESCE(EXCLUDED.stripe_subscription_id, billing_subscriptions.stripe_subscription_id)`,
          stripeCustomerId: sql`COALESCE(EXCLUDED.stripe_customer_id, billing_subscriptions.stripe_customer_id)`,
          stripePriceId: sql`COALESCE(EXCLUDED.stripe_price_id, billing_subscriptions.stripe_price_id)`,
          seatLimit: sql`EXCLUDED.seat_limit`,
          dealLimit: sql`EXCLUDED.deal_limit`,
          storageGbLimit: sql`EXCLUDED.storage_gb_limit`,
          aiQueryLimit: sql`EXCLUDED.ai_query_limit`,
          // cancelAt / canceledAt: COALESCE preserves existing values when caller
          // passes null/undefined. To explicitly clear, caller would need a
          // separate UPDATE — webhook handlers always pass the current Stripe value.
          cancelAt: sql`COALESCE(EXCLUDED.cancel_at, billing_subscriptions.cancel_at)`,
          canceledAt: sql`COALESCE(EXCLUDED.canceled_at, billing_subscriptions.canceled_at)`,
          updatedAt: sql`EXCLUDED.updated_at`,
        },
      })
      .returning();

    // ── Phase 2 — organization_packs diff ───────────────────────────────
    const desiredPacks = getPacksForTier(tier);

    // Phase 2a — upsert each desired pack
    if (desiredPacks.length > 0) {
      const packInsertValues = desiredPacks.map((pack) => ({
        orgId,
        packType: pack,
        status: 'active' as const,
        stripeSubscriptionId,
        stripeCustomerId,
        stripePriceId,
        purchasedBy: options.userId ?? null,
        purchasedAt: now,
        updatedAt: now,
      }));

      await tx
        .insert(organizationPacks)
        .values(packInsertValues)
        .onConflictDoUpdate({
          target: [organizationPacks.orgId, organizationPacks.packType],
          // trialEndsAt / expiresAt / purchasedAt / purchasedBy / notes excluded —
          // preserve trial extensions and original purchase metadata
          set: {
            status: sql`'active'`,
            stripeSubscriptionId: sql`COALESCE(EXCLUDED.stripe_subscription_id, organization_packs.stripe_subscription_id)`,
            stripeCustomerId: sql`COALESCE(EXCLUDED.stripe_customer_id, organization_packs.stripe_customer_id)`,
            stripePriceId: sql`COALESCE(EXCLUDED.stripe_price_id, organization_packs.stripe_price_id)`,
            updatedAt: sql`EXCLUDED.updated_at`,
          },
        });
    }

    // Phase 2b — cancel active packs not in desired list (audit-preserving, never delete)
    const cancelWhere =
      desiredPacks.length === 0
        ? and(
            eq(organizationPacks.orgId, orgId),
            eq(organizationPacks.status, 'active'),
          )
        : and(
            eq(organizationPacks.orgId, orgId),
            eq(organizationPacks.status, 'active'),
            notInArray(organizationPacks.packType, desiredPacks),
          );

    await tx
      .update(organizationPacks)
      .set({ status: 'cancelled', updatedAt: now })
      .where(cancelWhere);

    const packs = await tx
      .select()
      .from(organizationPacks)
      .where(eq(organizationPacks.orgId, orgId));

    // ── Phase 3 — billing_feature_flags diff (override-preserving) ──────
    const desiredFeatures = getFeaturesForTier(tier);

    // Phase 3a — delete non-override flags for features no longer in tier.
    // Override rows preserved unconditionally; non-override rows for features
    // still in the new tier are preserved (avoid delete-and-reinsert flap).
    const deleteWhere =
      desiredFeatures.length === 0
        ? and(
            eq(billingFeatureFlags.orgId, orgId),
            eq(billingFeatureFlags.isOverride, false),
          )
        : and(
            eq(billingFeatureFlags.orgId, orgId),
            eq(billingFeatureFlags.isOverride, false),
            notInArray(billingFeatureFlags.feature, desiredFeatures),
          );

    await tx.delete(billingFeatureFlags).where(deleteWhere);

    // Phase 3b — insert/upsert desired features
    if (desiredFeatures.length > 0) {
      const flagInsertValues = desiredFeatures.map((feature) => ({
        orgId,
        feature,
        isEnabled: true,
        isOverride: false,
        enabledAt: now,
      }));

      await tx
        .insert(billingFeatureFlags)
        .values(flagInsertValues)
        .onConflictDoUpdate({
          target: [billingFeatureFlags.orgId, billingFeatureFlags.feature],
          // is_override / override_expires_at excluded — fixes override-demotion bug.
          // Existing rows with is_override=true keep their override status.
          set: {
            isEnabled: sql`true`,
            enabledAt: sql`COALESCE(billing_feature_flags.enabled_at, EXCLUDED.enabled_at)`,
          },
        });
    }

    return {
      subscription,
      packs,
      flagsApplied: desiredFeatures.length,
    };
  });
}
