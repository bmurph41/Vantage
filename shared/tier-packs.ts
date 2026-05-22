/**
 * Tier ↔ Packs Mapping (canonical source of truth)
 *
 * This file defines which packs each subscription tier grants. It lives in
 * `shared/` so that shared code (e.g. `tier-features.ts`) can consume it
 * without importing from `server/`, which would violate the shared-rootDir
 * boundary enforced by `tsc -b shared`.
 *
 * `server/services/pack-service.ts SUBSCRIPTION_TIERS` is derived by
 * extending these entries with marketing bullets, prices, and Stripe ids.
 * `PackType` is also defined here and re-exported from pack-service.ts for
 * backward compatibility with existing consumers.
 */

// ── Pack type unions ──────────────────────────────────────────────────────
export type CorePackType = "crm_pipeline" | "modeling_tools" | "analysis" | "operations";
export type AddonPackType = "fund_management" | "lp_portal" | "prospecting" | "analytics_pro";
export type RolePackType = "owner" | "investor" | "broker";
export type MasterPackType = "master_comps";
export type PackType = CorePackType | AddonPackType | RolePackType | MasterPackType;

// ── Tier slugs ────────────────────────────────────────────────────────────
export type SubscriptionTierSlug =
  | "starter"
  | "investor"
  | "broker"
  | "owner-operator"
  | "institutional";

export interface TierPackMapping {
  slug: SubscriptionTierSlug;
  name: string; // canonical display name
  packs: PackType[];
  /** Monthly price in USD. 0 = free tier. */
  priceMonthly: number;
  /**
   * Monthly-equivalent price in USD when billed annually.
   * 0 = free. Multiply by 12 to get the annual total charged.
   * Matches billing-service.ts semantics exactly.
   */
  priceAnnualMonthly: number;
}

/**
 * Authoritative tier → packs mapping. Marketing bullets and Stripe ids are
 * layered on top in `pack-service.ts SUBSCRIPTION_TIERS`.
 * Prices here are canonical; billing-service.ts SUBSCRIPTION_TIERS must stay
 * in sync (priceAnnual there = priceAnnualMonthly * 12 for standard tiers;
 * Institutional uses priceAnnualMonthly directly as its billing-service priceAnnual).
 */
export const TIER_PACKS: TierPackMapping[] = [
  {
    slug: "starter",
    name: "Starter",
    packs: [],
    priceMonthly: 0,
    priceAnnualMonthly: 0,
  },
  {
    slug: "investor",
    name: "Investor",
    packs: ["modeling_tools", "analysis", "investor"],
    priceMonthly: 89,
    priceAnnualMonthly: 74, // $890/yr ÷ 12
  },
  {
    slug: "broker",
    name: "Broker",
    packs: ["modeling_tools", "analysis", "crm_pipeline", "prospecting", "investor", "broker"],
    priceMonthly: 179,
    priceAnnualMonthly: 149, // $1,790/yr ÷ 12
  },
  {
    slug: "owner-operator",
    name: "Owner / Operator",
    packs: [
      "modeling_tools",
      "analysis",
      "crm_pipeline",
      "prospecting",
      "operations",
      "investor",
      "broker",
      "owner",
    ],
    priceMonthly: 249,
    priceAnnualMonthly: 208, // $2,490/yr ÷ 12
  },
  {
    slug: "institutional",
    name: "Institutional",
    packs: [
      "modeling_tools",
      "analysis",
      "crm_pipeline",
      "prospecting",
      "operations",
      "fund_management",
      "lp_portal",
      "analytics_pro",
      "investor",
      "broker",
      "owner",
    ],
    priceMonthly: 1999,
    priceAnnualMonthly: 1649, // $19,788/yr — billing-service priceAnnual matches this value
  },
];

/** Get the packs granted to a tier slug. Returns [] for unknown slugs. */
export function getPacksForTier(slug: SubscriptionTierSlug): PackType[] {
  return TIER_PACKS.find((t) => t.slug === slug)?.packs ?? [];
}

// ── Tier limits ───────────────────────────────────────────────────────────

/** Per-tier resource limits. -1 means unlimited. */
export interface TierLimits {
  seats: number;
  deals: number;
  storageGb: number;
  aiQueries: number;
  lpInvestors?: number;
}

// INTERPOLATED limits for the 3 newly-canonical middle tiers — see
// project_phase_a_fix_5_followups.md for product review TODOs.
export const TIER_LIMITS: Record<SubscriptionTierSlug, TierLimits> = {
  starter:          { seats: 1,  deals: 1,  storageGb: 1,    aiQueries: 10 },
  investor:         { seats: 3,  deals: -1, storageGb: 25,   aiQueries: 200 },
  broker:           { seats: 10, deals: -1, storageGb: 100,  aiQueries: 1000 },
  'owner-operator': { seats: 25, deals: -1, storageGb: 500,  aiQueries: 2500, lpInvestors: 25 },
  institutional:    { seats: -1, deals: -1, storageGb: 1000, aiQueries: -1, lpInvestors: -1 },
};

/** Helper: get limits for a tier slug. */
export function getLimitsForTier(slug: SubscriptionTierSlug): TierLimits {
  return TIER_LIMITS[slug];
}

/** Type guard: is this string a valid SubscriptionTierSlug? */
export function isTierSlug(s: string): s is SubscriptionTierSlug {
  return TIER_PACKS.some(t => t.slug === s);
}
