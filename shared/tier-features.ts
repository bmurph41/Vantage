/**
 * Tier ↔ Feature Flag Mapping (canonical source of truth)
 *
 * This file is the SINGLE source of truth for which feature flags
 * (gate strings consumed by `requireEntitlement` / `requireFeature`)
 * each subscription tier grants.
 *
 * Architecture:
 *   tier (DB enum, 5 canonical values)
 *     → packs (defined in `server/services/pack-service.ts SUBSCRIPTION_TIERS[].packs`)
 *       → features (defined here in PACK_TO_FEATURES)
 *
 * `billing-service.ts SUBSCRIPTION_TIERS[tier].features` is derived via
 * `getFeaturesForTier(tier)` below — DO NOT hand-maintain feature arrays
 * in `billing-service.ts`. Update PACK_TO_FEATURES here instead and the
 * change propagates automatically.
 *
 * Marketing-bullet "features" in `pack-service.ts SUBSCRIPTION_TIERS[].features`
 * are a SEPARATE thing — those are customer-facing copy, not gate flags.
 *
 * ── PRODUCT REVIEW NEEDED (positioning decisions, not architectural) ──
 * The current pack→feature mapping is a starting point. Brett to confirm
 * or rebalance:
 *   - sso, audit_trail, white_label under 'owner' — typically
 *     enterprise/institutional features. Move to higher tier?
 *   - ai_underwriting under 'investor' — Investor is the lowest paid tier;
 *     AI underwriting is usually higher-tier. Promote?
 *   - kyc_aml, construction_module under 'owner' — institutional-grade,
 *     may not belong on owner-operator. Promote?
 * Filed as follow-up; do not block fix-5 on these.
 */

import { getPacksForTier, type PackType, type SubscriptionTierSlug } from "./tier-packs";

export type SubscriptionTier = SubscriptionTierSlug;
export type { PackType };

/**
 * Features granted to ALL tiers (including starter free tier).
 * Carried over from the prior STARTER_FEATURES constant.
 */
export const BASE_FEATURES: string[] = [
  "deal_workspace",
  "crm_basic",
  "document_vault",
  "dd_checklist",
  "basic_reporting",
];

/**
 * Pack → feature flag mapping. When an org has a pack active, they
 * receive every feature flag listed under that pack key.
 *
 * Keys must match `PackType` exactly (see pack-service.ts:7-17).
 * Features are arbitrary strings consumed by `requireEntitlement(name)`.
 */
export const PACK_TO_FEATURES: Record<PackType, string[]> = {
  // ── Core packs ──
  modeling_tools: ["financial_model"],
  analysis: ["ai_narratives"],
  crm_pipeline: ["workflow_automation", "gantt_view", "custom_deal_stages"],
  operations: ["vendor_management", "work_orders", "lease_abstractor"],

  // ── Addon packs ──
  fund_management: [
    "capital_calls",
    "distributions",
    "fund_accounting",
    "capital_account_ledger",
    "waterfall_engine",
  ],
  lp_portal: ["lp_portal"],
  prospecting: ["email_integration", "sms_alerts"],
  analytics_pro: [
    "portfolio_dashboard",
    "benchmark_engine",
    "stress_testing",
    "performance_attribution",
  ],

  // ── Role packs ──
  // PRODUCT REVIEW: positioning of these is provisional.
  investor: ["ai_underwriting"],
  broker: [],
  owner: [
    "document_intelligence",
    "sso",
    "audit_trail",
    "api_access",
    "kyc_aml",
    "construction_module",
    "custom_report_builder",
    "white_label",
  ],

  // ── Master packs ──
  master_comps: [],
};

/**
 * Compute the feature-flag set for a given tier by union'ing BASE_FEATURES
 * with the features granted by every pack the tier includes.
 */
export function getFeaturesForTier(tier: SubscriptionTier): string[] {
  const packs = getPacksForTier(tier);
  const fromPacks = packs.flatMap((p) => PACK_TO_FEATURES[p] ?? []);
  return Array.from(new Set([...BASE_FEATURES, ...fromPacks]));
}
