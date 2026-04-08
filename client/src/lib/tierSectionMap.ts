import { SUBSCRIPTION_PACKAGES, FEATURE_MODULES } from '@/config/featureModules';
import { sidebarConfig } from '@/config/sidebarConfig';

const INSTITUTIONAL_ONLY_IDS = ['fund-management', 'lp-portal'] as const;

/**
 * Canonical tier → pack-type mapping (authoritative source of truth).
 * This matches the PaywallModal TIERS definitions and schema pack types.
 */
export const TIER_PACK_MAP: Record<string, string[]> = {
  starter: [],
  investor: ['modeling_tools', 'analysis', 'investor'],
  broker: ['modeling_tools', 'analysis', 'crm_pipeline', 'prospecting', 'investor', 'broker'],
  'owner-operator': ['modeling_tools', 'analysis', 'crm_pipeline', 'prospecting', 'operations', 'investor', 'broker', 'owner'],
  institutional: ['modeling_tools', 'analysis', 'crm_pipeline', 'prospecting', 'operations', 'fund_management', 'lp_portal', 'analytics_pro', 'investor', 'broker', 'owner'],
};

/**
 * Pack type → FEATURE_MODULES mapping.
 * Maps each pack to the set of feature module keys it provides.
 * Used to compute which sidebar sections a user currently has access to
 * from their list of active pack types.
 */
const PACK_MODULE_MAP: Record<string, string[]> = {
  analysis: [
    FEATURE_MODULES.ANALYTICS_COMPS,
    FEATURE_MODULES.ANALYTICS_DEMOGRAPHICS,
    FEATURE_MODULES.ANALYTICS_CAPITAL,
  ],
  modeling_tools: [
    FEATURE_MODULES.DEALROOM_PROJECTS,
    FEATURE_MODULES.DEALROOM_DATAROOM,
    FEATURE_MODULES.UNDERWRITING_VALUATOR,
    FEATURE_MODULES.UNDERWRITING_DEBT,
    FEATURE_MODULES.UNDERWRITING_EXIT,
    FEATURE_MODULES.UNDERWRITING_SETTINGS,
  ],
  crm_pipeline: [
    FEATURE_MODULES.CRM_CORE,
    FEATURE_MODULES.CRM_PIPELINE,
    FEATURE_MODULES.CRM_TASKS,
    FEATURE_MODULES.CRM_FORECAST,
    FEATURE_MODULES.DEALROOM_DD,
    FEATURE_MODULES.UNDERWRITING_OM,
    FEATURE_MODULES.INTEGRATIONS_MARKETPLACE,
  ],
  prospecting: [
    FEATURE_MODULES.PROSPECTING_CORE,
    FEATURE_MODULES.PROSPECTING_MARKETING,
    FEATURE_MODULES.DEALROOM_DD,
    FEATURE_MODULES.UNDERWRITING_OM,
    FEATURE_MODULES.INTEGRATIONS_MARKETPLACE,
  ],
  operations: [
    FEATURE_MODULES.ANALYTICS_PORTFOLIO,
    FEATURE_MODULES.OPS_PORTFOLIO,
    FEATURE_MODULES.OPS_DOCKAGE,
    FEATURE_MODULES.OPS_TENANTS,
    FEATURE_MODULES.OPS_FUEL,
    FEATURE_MODULES.OPS_RETAIL,
    FEATURE_MODULES.OPS_SERVICE,
    FEATURE_MODULES.OPS_RENTALS,
    FEATURE_MODULES.OPS_CLUB,
    FEATURE_MODULES.OPS_SALES,
    FEATURE_MODULES.OPS_BOOKKEEPING,
    FEATURE_MODULES.OPS_PAYROLL,
  ],
  analytics_pro: [],
  fund_management: [],
  lp_portal: [],
  owner: [],
  investor: [],
  broker: [],
  master_comps: [],
};

function getSectionIdsForModules(moduleSet: Set<string>): string[] {
  const unlockedIds: string[] = [];

  for (const group of sidebarConfig) {
    const groupRequired = group.requiredModules;
    const groupUnlocked =
      !groupRequired ||
      groupRequired.length === 0 ||
      groupRequired.some((m) => moduleSet.has(m));

    if (groupUnlocked) {
      unlockedIds.push(group.id);
    }

    if (group.children) {
      for (const item of group.children) {
        const itemRequired = item.requiredModules;
        const itemUnlocked =
          !itemRequired ||
          itemRequired.length === 0 ||
          itemRequired.some((m) => moduleSet.has(m));
        if (itemUnlocked) {
          unlockedIds.push(item.id);
        }
      }
    }

    if (group.subcategories) {
      for (const sub of group.subcategories) {
        for (const item of sub.items) {
          const itemRequired = item.requiredModules;
          const itemUnlocked =
            !itemRequired ||
            itemRequired.length === 0 ||
            itemRequired.some((m) => moduleSet.has(m));
          if (itemUnlocked) {
            unlockedIds.push(item.id);
          }
        }
      }
    }
  }

  return unlockedIds;
}

/**
 * Returns all sidebar section IDs unlocked by a given tier slug.
 * Uses SUBSCRIPTION_PACKAGES modules list as the source of truth.
 */
export function getUnlockedSectionIds(tierSlug: string): string[] {
  const pkg = SUBSCRIPTION_PACKAGES.find((p) => p.slug === tierSlug);
  if (!pkg) return [];
  const moduleSet = new Set<string>(pkg.modules);
  const ids = getSectionIdsForModules(moduleSet);

  if (tierSlug === 'institutional') {
    INSTITUTIONAL_ONLY_IDS.forEach((id) => {
      if (!ids.includes(id)) ids.push(id);
    });
  }

  return ids;
}

/**
 * Returns all sidebar section IDs unlocked by a user's active pack types.
 * Builds the module set from the user's packs using PACK_MODULE_MAP,
 * then adds the base starter modules (dashboard, news).
 * Also adds fund-management/lp-portal synthetic IDs when appropriate packs are active.
 */
export function getUnlockedSectionIdsFromPackTypes(activePackTypes: string[]): string[] {
  const moduleSet = new Set<string>([
    FEATURE_MODULES.DASHBOARD,
    FEATURE_MODULES.ANALYTICS_NEWS,
  ]);

  for (const packType of activePackTypes) {
    const modules = PACK_MODULE_MAP[packType];
    if (modules) {
      modules.forEach((m) => moduleSet.add(m));
    }
  }

  const ids = getSectionIdsForModules(moduleSet);

  const packSet = new Set(activePackTypes);
  if (packSet.has('fund_management')) {
    if (!ids.includes('fund-management')) ids.push('fund-management');
  }
  if (packSet.has('lp_portal')) {
    if (!ids.includes('lp-portal')) ids.push('lp-portal');
  }

  return ids;
}

/**
 * Returns sidebar section IDs that are newly unlocked by the recommended tier
 * compared to the user's currently active pack types.
 */
export function getNewlyUnlockedSectionIds(
  recommendedTierSlug: string,
  currentActivePackTypes: string[],
): string[] {
  const currentIds = new Set(getUnlockedSectionIdsFromPackTypes(currentActivePackTypes));
  const recommendedIds = getUnlockedSectionIds(recommendedTierSlug);
  return recommendedIds.filter((id) => !currentIds.has(id));
}

export interface TierInfo {
  slug: string;
  name: string;
  priceMonthly: number;
  popular?: boolean;
  recommended?: boolean;
  features: string[];
}

export function getAllTiers(): TierInfo[] {
  return SUBSCRIPTION_PACKAGES.map((p) => ({
    slug: p.slug,
    name: p.name,
    priceMonthly: p.priceMonthly,
    popular: p.popular,
    recommended: p.recommended,
    features: p.features,
  }));
}
