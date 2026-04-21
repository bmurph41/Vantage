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

/**
 * Canonical mapping from wizard property-type values (uppercase) and raw asset-class keys
 * (lowercase) to the entitled asset-class key stored in organizations.assetClasses.
 *
 * A value of `null` means the type has no asset-class gate and is always permitted.
 * Any key not present in this map is considered unknown and is rejected by the backend guard.
 */
export const PROPERTY_TYPE_TO_ASSET_CLASS_KEY: Record<string, string | null> = {
  // Wizard uppercase values
  MARINA: 'marina',
  RV_PARK: 'rv_park',
  MULTIFAMILY: 'multifamily',
  RETAIL: 'retail',
  INDUSTRIAL: 'industrial',
  MIXED_USE: null,
  SELF_STORAGE: 'self_storage',
  MOBILE_HOME_PARK: 'mobile_home',
  HOTEL: 'hotel',
  OTHER: null,
  // Canonical lowercase keys for the wizard's 9 property types (so resolveAssetClassKey
  // handles "marina" and "MARINA" identically).  Other lowercase keys (e.g. "dry_stack",
  // "warehouse") are NOT in this map and are returned as-is by resolveAssetClassKey —
  // meaning entitlement check governs them rather than a 400 rejection.
  marina: 'marina',
  rv_park: 'rv_park',
  multifamily: 'multifamily',
  retail: 'retail',
  industrial: 'industrial',
  mixed_use: null,
  self_storage: 'self_storage',
  mobile_home: 'mobile_home',
  hotel: 'hotel',
  other: null,
};

/**
 * Resolve an incoming assetClass value to a canonical lowercase key.
 *
 * Return values:
 *   - `string`    — canonical asset-class key to compare against `org.assetClasses`.
 *                   Returned for: all known alias entries (e.g. "MARINA" → "marina") and
 *                   for any purely-lowercase value not found in the alias table (treated as a
 *                   direct key, e.g. "dry_stack", "warehouse"). The caller is responsible for
 *                   the entitlement check (`orgAssetClasses.includes(key)`).
 *   - `null`      — gating-exempt type (e.g. "MIXED_USE", "OTHER"); always allowed, skip check.
 *   - `undefined` — unrecognised uppercase/mixed-case alias (not in the table); indicates a
 *                   malformed input that the caller should reject with HTTP 400.
 */
export function resolveAssetClassKey(value: string): string | null | undefined {
  if (value in PROPERTY_TYPE_TO_ASSET_CLASS_KEY) {
    return PROPERTY_TYPE_TO_ASSET_CLASS_KEY[value];
  }
  // Uppercase/mixed-case values that aren't in the known alias map look like a bad alias
  if (value !== value.toLowerCase()) {
    return undefined; // unrecognised wizard alias → caller should return 400
  }
  // Lowercase values are treated as direct asset-class keys (e.g. from AssetClassPicker)
  return value;
}

export const USER_ROLES = [
  { key: "owner", label: "Owner / Operator", description: "I own or operate the asset(s) directly" },
  { key: "broker", label: "Broker", description: "I facilitate the buying, selling, or leasing of assets" },
  { key: "investor", label: "Investor", description: "I invest in or provide capital for assets" },
] as const;

export type UserRoleKey = typeof USER_ROLES[number]["key"];
