/**
 * Operations Module Resolver Service
 *
 * Resolves which operations modules are enabled for a given org
 * based on the asset classes of their owned properties, intersected
 * with the asset classes in their subscription (organizations.asset_classes).
 *
 * Gating rule: a class is enabled iff the org owns an asset of that class
 * AND that class is listed in organizations.asset_classes. When
 * organizations.asset_classes is empty, we grandfather — the full owned set
 * is returned (no subscription gating applied yet).
 */

import { db } from '../db';
import { ownedAssets, crmProperties, organizations } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { getOpsModulesForAssetClasses, type OpsModuleKey } from '@shared/asset-class-ops-modules';

export interface OwnedAssetInfo {
  id: string;
  name: string;
  assetType: string;
  propertyId: string;
  projectId: string | null;
  status: string;
}

export interface ResolvedModulesResult {
  modules: OpsModuleKey[];
  assetClasses: string[];
  assets: OwnedAssetInfo[];
  /** Full list of subscribed asset classes from organizations.asset_classes.
   *  Useful for the sidebar to show locked-but-subscribed vs. fully unavailable. */
  subscribedAssetClasses: string[];
}

/**
 * Queries owned assets joined with CRM properties to get all property types for the org,
 * then intersects with organizations.asset_classes to determine which modules should be
 * available.
 */
export async function resolveOpsModulesForOrg(orgId: string): Promise<ResolvedModulesResult> {
  let results: Array<{
    assetId: string;
    propertyId: string;
    projectId: string | null;
    status: string;
    propertyTitle: string | null;
    propertyType: string | null;
  }>;

  try {
    results = await db
      .select({
        assetId: ownedAssets.id,
        propertyId: ownedAssets.propertyId,
        projectId: ownedAssets.projectId,
        status: ownedAssets.status,
        propertyTitle: crmProperties.title,
        propertyType: crmProperties.type,
      })
      .from(ownedAssets)
      .innerJoin(crmProperties, eq(ownedAssets.propertyId, crmProperties.id))
      .where(and(
        eq(ownedAssets.orgId, orgId),
        eq(ownedAssets.status, 'under_management')
      ));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('column')) {
      console.warn('[resolveOpsModulesForOrg] Table or column missing, returning empty modules:', msg);
      return { modules: [], assetClasses: [], assets: [], subscribedAssetClasses: [] };
    }
    throw err;
  }

  // Fetch the org's subscribed asset classes
  let subscribedAssetClasses: string[] = [];
  try {
    const orgRow = await db
      .select({ assetClasses: organizations.assetClasses })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    subscribedAssetClasses = orgRow[0]?.assetClasses ?? [];
  } catch (err) {
    console.warn('[resolveOpsModulesForOrg] Failed to read organizations.asset_classes:', err instanceof Error ? err.message : String(err));
  }

  const ownedSet = new Set<string>();
  const assets: OwnedAssetInfo[] = [];

  for (const row of results) {
    const assetType = row.propertyType || 'marina';
    ownedSet.add(assetType);
    assets.push({
      id: row.assetId,
      name: row.propertyTitle || 'Unnamed Asset',
      assetType,
      propertyId: row.propertyId,
      projectId: row.projectId,
      status: row.status,
    });
  }

  const ownedClasses = Array.from(ownedSet);

  // Intersect owned with subscribed. If subscribed list is empty, grandfather
  // (fall through to full owned set).
  const enabledClasses = subscribedAssetClasses.length > 0
    ? ownedClasses.filter((c) => subscribedAssetClasses.includes(c))
    : ownedClasses;

  const modules = getOpsModulesForAssetClasses(enabledClasses);

  return {
    modules,
    assetClasses: enabledClasses,
    assets,
    subscribedAssetClasses,
  };
}

/**
 * Gets all owned assets for an org (any asset type, not just marinas).
 */
export async function getOwnedAssetsForOrg(orgId: string): Promise<OwnedAssetInfo[]> {
  const results = await db
    .select({
      assetId: ownedAssets.id,
      propertyId: ownedAssets.propertyId,
      projectId: ownedAssets.projectId,
      status: ownedAssets.status,
      propertyTitle: crmProperties.title,
      propertyType: crmProperties.type,
    })
    .from(ownedAssets)
    .innerJoin(crmProperties, eq(ownedAssets.propertyId, crmProperties.id))
    .where(eq(ownedAssets.orgId, orgId));

  return results.map(row => ({
    id: row.assetId,
    name: row.propertyTitle || 'Unnamed Asset',
    assetType: row.propertyType || 'marina',
    propertyId: row.propertyId,
    projectId: row.projectId,
    status: row.status,
  }));
}
