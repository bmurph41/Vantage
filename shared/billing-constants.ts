/**
 * Asset Class Tier Constants
 *
 * Defines pricing tiers based on how many asset classes an org has selected.
 * These tiers are a separate billing dimension from the main subscription tier
 * and govern which asset classes are available to the org's users.
 */

export interface AssetClassTierDef {
  key: "essentials" | "professional" | "enterprise";
  name: string;
  label: string;
  description: string;
  minClasses: number;
  maxClasses: number | null;
  priceMonthly: number;
  priceAnnual: number;
  color: string;
}

export const ASSET_CLASS_TIERS: AssetClassTierDef[] = [
  {
    key: "essentials",
    name: "Essentials",
    label: "Essentials",
    description: "Up to 2 asset class specializations",
    minClasses: 1,
    maxClasses: 2,
    priceMonthly: 0,
    priceAnnual: 0,
    color: "#3b82f6",
  },
  {
    key: "professional",
    name: "Professional",
    label: "Professional",
    description: "3–5 asset class specializations",
    minClasses: 3,
    maxClasses: 5,
    priceMonthly: 99,
    priceAnnual: 79,
    color: "#8b5cf6",
  },
  {
    key: "enterprise",
    name: "Enterprise",
    label: "Enterprise",
    description: "6 or more asset class specializations",
    minClasses: 6,
    maxClasses: null,
    priceMonthly: 249,
    priceAnnual: 199,
    color: "#f59e0b",
  },
];

/**
 * Compute the asset class tier from the number of selected classes.
 */
export function getAssetClassTier(count: number): AssetClassTierDef {
  for (const tier of [...ASSET_CLASS_TIERS].reverse()) {
    if (count >= tier.minClasses) return tier;
  }
  return ASSET_CLASS_TIERS[0];
}

/**
 * Max number of asset classes allowed at the given tier.
 * Returns Infinity for enterprise.
 */
export function getMaxAssetClasses(tierKey: string): number {
  const tier = ASSET_CLASS_TIERS.find((t) => t.key === tierKey);
  return tier?.maxClasses ?? Infinity;
}

export const USER_ROLES = [
  { key: "owner", label: "Owner / Operator", description: "I own or operate the asset(s) directly" },
  { key: "broker", label: "Broker", description: "I facilitate the buying, selling, or leasing of assets" },
  { key: "investor", label: "Investor", description: "I invest in or provide capital for assets" },
] as const;

export type UserRoleKey = typeof USER_ROLES[number]["key"];
