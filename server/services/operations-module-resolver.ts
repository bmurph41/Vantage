/**
 * Operations Module Resolver Service
 *
 * Resolves which operations modules are enabled for a given org
 * based on the asset classes of their owned properties.
 */

import { db } from '../db';
import { ownedAssets, crmProperties } from '@shared/schema';
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
}

/**
 * Queries owned assets joined with CRM properties to get all property types for the org,
 * then resolves which operations modules should be available.
 */
export async function resolveOpsModulesForOrg(orgId: string): Promise<ResolvedModulesResult> {
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
    .where(and(
      eq(ownedAssets.orgId, orgId),
      eq(ownedAssets.status, 'under_management')
    ));

  const assetClassSet = new Set<string>();
  const assets: OwnedAssetInfo[] = [];

  for (const row of results) {
    const assetType = row.propertyType || 'marina';
    assetClassSet.add(assetType);
    assets.push({
      id: row.assetId,
      name: row.propertyTitle || 'Unnamed Asset',
      assetType,
      propertyId: row.propertyId,
      projectId: row.projectId,
      status: row.status,
    });
  }

  const assetClasses = Array.from(assetClassSet);
  const modules = getOpsModulesForAssetClasses(assetClasses);

  return { modules, assetClasses, assets };
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
