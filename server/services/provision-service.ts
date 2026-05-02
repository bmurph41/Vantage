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
} from '@shared/tier-packs';
import { getFeaturesForTier } from '@shared/tier-features';
import { eq, and, inArray, notInArray } from 'drizzle-orm';

export interface ProvisionTierOptions {
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  stripePriceId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  billingCycle?: 'monthly' | 'annual';
  status?: 'trialing' | 'active';
  mode: 'create' | 'change' | 'webhook';
  userId?: string;
}

export interface ProvisionTierResult {
  subscription: BillingSubscription;
  packs: OrganizationPack[];
  flagsApplied: number;
}

/**
 * Atomically set an org's tier — writes subscription, packs, and
 * feature flags in a single transaction.
 */
export async function provisionTier(
  orgId: string,
  tier: SubscriptionTierSlug,
  options: ProvisionTierOptions,
): Promise<ProvisionTierResult> {
  // Suppress unused-import warnings until substep 2 lands the implementation.
  void db;
  void billingSubscriptions;
  void organizationPacks;
  void billingFeatureFlags;
  void getPacksForTier;
  void getFeaturesForTier;
  void eq;
  void and;
  void inArray;
  void notInArray;
  void orgId;
  void tier;
  void options;

  throw new Error(
    'provisionTier: not yet implemented (Phase A fix-4b PR-A substep 2)',
  );
}
