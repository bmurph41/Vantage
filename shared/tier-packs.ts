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
}

/**
 * Authoritative tier → packs mapping. Marketing bullets, prices, and Stripe
 * ids are layered on top in `pack-service.ts SUBSCRIPTION_TIERS`.
 */
export const TIER_PACKS: TierPackMapping[] = [
  {
    slug: "starter",
    name: "Starter",
    packs: [],
  },
  {
    slug: "investor",
    name: "Investor",
    packs: ["modeling_tools", "analysis", "investor"],
  },
  {
    slug: "broker",
    name: "Broker",
    packs: ["modeling_tools", "analysis", "crm_pipeline", "prospecting", "investor", "broker"],
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
  },
];

/** Get the packs granted to a tier slug. Returns [] for unknown slugs. */
export function getPacksForTier(slug: SubscriptionTierSlug): PackType[] {
  return TIER_PACKS.find((t) => t.slug === slug)?.packs ?? [];
}
