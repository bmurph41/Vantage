/**
 * Broker-side subscription tiers.
 *
 * These are the SKUs a broker subscribes to (starter/pro/enterprise) in order to
 * have a public profile, publish listings, and sell advisory packages on the
 * MarinaMatch platform. Platform charges the broker monthly via Stripe.
 *
 * This is distinct from MARKETPLACE_PLUS_TIERS (in broker-entitlements.ts), which
 * is what buyers/users subscribe to in order to follow brokers and unlock extra
 * marketplace features.
 */

export type BrokerTier = "starter" | "pro" | "enterprise";

export type BrokerTierFeature =
  | "profile"
  | "claim_listings"
  | "basic_analytics"
  | "full_analytics"
  | "featured_placement"
  | "priority_claim_resolution"
  | "lead_routing"
  | "white_label"
  | "api_access"
  | "dedicated_csm";

export interface BrokerTierDefinition {
  tier: BrokerTier;
  label: string;
  priceMonthlyCents: number;
  priceAnnualCents: number;
  /** -1 = unlimited */
  maxPublishedListings: number;
  /** -1 = unlimited */
  maxAdvisoryPackages: number;
  /** -1 = unlimited */
  maxTeamSeats: number;
  features: BrokerTierFeature[];
  stripeProductId: string | null;
  stripePriceIdMonthly: string | null;
  stripePriceIdAnnual: string | null;
}

export const BROKER_TIERS: Record<BrokerTier, BrokerTierDefinition> = {
  starter: {
    tier: "starter",
    label: "Broker Starter",
    priceMonthlyCents: 7900,
    priceAnnualCents: 79000,
    maxPublishedListings: 25,
    maxAdvisoryPackages: 1,
    maxTeamSeats: 1,
    features: ["profile", "claim_listings", "basic_analytics"],
    stripeProductId: null,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_BROKER_STARTER_MONTHLY || null,
    stripePriceIdAnnual: process.env.STRIPE_PRICE_BROKER_STARTER_ANNUAL || null,
  },
  pro: {
    tier: "pro",
    label: "Broker Pro",
    priceMonthlyCents: 19900,
    priceAnnualCents: 199000,
    maxPublishedListings: -1,
    maxAdvisoryPackages: 3,
    maxTeamSeats: 1,
    features: [
      "profile",
      "claim_listings",
      "basic_analytics",
      "full_analytics",
      "featured_placement",
      "priority_claim_resolution",
      "lead_routing",
    ],
    stripeProductId: null,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_BROKER_PRO_MONTHLY || null,
    stripePriceIdAnnual: process.env.STRIPE_PRICE_BROKER_PRO_ANNUAL || null,
  },
  enterprise: {
    tier: "enterprise",
    label: "Broker Enterprise",
    priceMonthlyCents: 49900,
    priceAnnualCents: 499000,
    maxPublishedListings: -1,
    maxAdvisoryPackages: -1,
    maxTeamSeats: 5,
    features: [
      "profile",
      "claim_listings",
      "basic_analytics",
      "full_analytics",
      "featured_placement",
      "priority_claim_resolution",
      "lead_routing",
      "white_label",
      "api_access",
      "dedicated_csm",
    ],
    stripeProductId: null,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_BROKER_ENTERPRISE_MONTHLY || null,
    stripePriceIdAnnual: process.env.STRIPE_PRICE_BROKER_ENTERPRISE_ANNUAL || null,
  },
};

export function getBrokerTierDefinition(tier: string): BrokerTierDefinition | null {
  return (BROKER_TIERS as Record<string, BrokerTierDefinition>)[tier] || null;
}

export function hasBrokerFeature(tier: string, feature: BrokerTierFeature): boolean {
  const def = getBrokerTierDefinition(tier);
  if (!def) return false;
  return def.features.includes(feature);
}

/**
 * Resolve the broker tier corresponding to a Stripe price ID. Used by the
 * webhook handler to map a completed checkout back onto a SKU.
 */
export function resolveBrokerTierFromPriceId(
  priceId: string,
): { tier: BrokerTier; billingCycle: "monthly" | "annual" } | null {
  for (const def of Object.values(BROKER_TIERS)) {
    if (def.stripePriceIdMonthly && def.stripePriceIdMonthly === priceId) {
      return { tier: def.tier, billingCycle: "monthly" };
    }
    if (def.stripePriceIdAnnual && def.stripePriceIdAnnual === priceId) {
      return { tier: def.tier, billingCycle: "annual" };
    }
  }
  return null;
}

/**
 * Marketplace+ price ID resolution (Solo/Pro). Returns null if the price ID
 * does not match a Marketplace+ SKU.
 */
export function resolveMarketplacePlusTierFromPriceId(
  priceId: string,
): { tier: "solo" | "pro"; billingCycle: "monthly" | "annual" } | null {
  const map: Array<{ tier: "solo" | "pro"; cycle: "monthly" | "annual"; env: string }> = [
    { tier: "solo", cycle: "monthly", env: "STRIPE_PRICE_MARKETPLACE_PLUS_SOLO_MONTHLY" },
    { tier: "solo", cycle: "annual", env: "STRIPE_PRICE_MARKETPLACE_PLUS_SOLO_ANNUAL" },
    { tier: "pro", cycle: "monthly", env: "STRIPE_PRICE_MARKETPLACE_PLUS_PRO_MONTHLY" },
    { tier: "pro", cycle: "annual", env: "STRIPE_PRICE_MARKETPLACE_PLUS_PRO_ANNUAL" },
  ];
  for (const entry of map) {
    const v = process.env[entry.env];
    if (v && v === priceId) return { tier: entry.tier, billingCycle: entry.cycle };
  }
  return null;
}
