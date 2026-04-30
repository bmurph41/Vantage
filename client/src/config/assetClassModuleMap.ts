// client/src/config/assetClassModuleMap.ts
//
// Maps the legacy short-key array stored in
// platform_asset_classes.enabled_modules (e.g. ["crm","modeling","vdr"])
// to canonical FeatureModule enum values used by EntitlementsContext.
//
// TODO(C17-cleanup): Re-seed platform_asset_classes.enabled_modules with
// FeatureModule values directly and remove this map. Tracked as a
// separate Phase C item ("narrow enabled_modules seed to minimum-required").

import { FEATURE_MODULES, SUBSCRIPTION_PACKAGES, type FeatureModule } from './featureModules';

export const ASSET_CLASS_MODULE_MAP: Record<string, FeatureModule[]> = {
  crm:          [FEATURE_MODULES.CRM_CORE],
  salesComps:   [FEATURE_MODULES.ANALYTICS_COMPS],
  modeling:     [FEATURE_MODULES.UNDERWRITING_VALUATOR],
  proForma:     [FEATURE_MODULES.UNDERWRITING_VALUATOR],
  rentRoll:     [FEATURE_MODULES.OPS_TENANTS],
  fuelSales:    [FEATURE_MODULES.OPS_FUEL],
  shipStore:    [FEATURE_MODULES.OPS_RETAIL],
  vdr:          [FEATURE_MODULES.DEALROOM_DATAROOM],
  dueDiligence: [FEATURE_MODULES.DEALROOM_DD],
  docket:       [FEATURE_MODULES.ANALYTICS_NEWS],
};

/**
 * Translate the legacy short-key array on a platform asset class into
 * canonical FeatureModule[] for use with getMissingModules().
 * Unknown short keys are dropped (warned in dev). Result is deduplicated.
 */
export function mapAssetClassModules(shortKeys: string[]): FeatureModule[] {
  const seen = new Set<FeatureModule>();
  for (const key of shortKeys) {
    const mapped = ASSET_CLASS_MODULE_MAP[key];
    if (!mapped) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[assetClassModuleMap] Unknown short key: "${key}"`);
      }
      continue;
    }
    for (const mod of mapped) seen.add(mod);
  }
  return Array.from(seen);
}

/**
 * Pure: given the missing modules for a context, return the slug of the
 * cheapest subscription package that includes all of them. Returns null
 * if no package covers the set (or if missing is empty).
 *
 * Safe to call inside .map() / render — does not use hooks.
 */
export function getSuggestedPackageSlug(
  missingModules: FeatureModule[]
): string | null {
  if (missingModules.length === 0) return null;
  const sorted = [...SUBSCRIPTION_PACKAGES].sort(
    (a, b) => a.priceMonthly - b.priceMonthly
  );
  for (const pkg of sorted) {
    const pkgModules = new Set(pkg.modules);
    if (missingModules.every(m => pkgModules.has(m))) {
      return pkg.slug;
    }
  }
  return null;
}
