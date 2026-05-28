/**
 * Project Profile Service (Phase 2B Session 2, 2026-05-28)
 *
 * Provides the asset-class default vocabulary lookup that seeds a project's
 * `project_profile` column when no prior shape exists, and the read/write
 * surface the CRUD endpoints + migration script consume.
 *
 * Scope this session is WRITE-only: the wizard + Inputs & Data UI still read
 * customMetrics.config.profitCenters. Session 3+ flips consumers.
 */

import { pool } from "../db";
import {
  CANONICAL_PROFIT_CENTERS,
  emptyProjectProfile,
  getCanonicalProfitCenter,
  type ProfitCenterState,
  type ProjectProfile,
} from "@shared/profit-center-id-map";

/**
 * Return the layer-1 default profile for an asset class.
 *
 * For marina: all 17 canonical PCs (PC-100 .. PC-999) at status 'default',
 * labels mirroring the canonical names. Includes PC-999 G&A — wizard-surfacing
 * decision deferred to Session 3 per G3 follow-up.
 *
 * For any asset class with no COA pack registered (laundromat, multifamily,
 * STR, business in current DB): returns emptyProjectProfile(). Logs a single
 * line so the migration trace shows which projects fell through. Never throws.
 *
 * Lookup is case-insensitive on assetClass: DB stores 'MARINA' on the pack
 * while modeling_projects.asset_class stores 'marina' lower-case.
 */
export async function getAssetClassDefaultProfile(
  assetClass: string | null | undefined,
): Promise<ProjectProfile> {
  if (!assetClass) {
    console.log(`[project-profile] no asset_class set on project → empty profile`);
    return emptyProjectProfile();
  }

  const pack = await pool.query(
    `SELECT id FROM coa_taxonomy_packs WHERE LOWER(asset_class::text) = LOWER($1) LIMIT 1`,
    [assetClass],
  );

  if (pack.rowCount === 0) {
    console.log(
      `[project-profile] no coa_taxonomy_pack for asset_class="${assetClass}" → empty profile`,
    );
    return emptyProjectProfile();
  }

  // Marina is the only pack today. We seed from the canonical map (not the DB
  // pack contents) so the canonical metadata — kind, sortOrder — stays the
  // single source of truth. Other asset classes will get their own canonical
  // lists when their packs are added.
  const lc = assetClass.toLowerCase();
  if (lc !== 'marina') {
    console.log(
      `[project-profile] asset_class="${assetClass}" has a pack but no canonical list yet → empty profile`,
    );
    return emptyProjectProfile();
  }

  const profitCenters: Record<string, ProfitCenterState> = {};
  for (const pc of CANONICAL_PROFIT_CENTERS) {
    profitCenters[pc.code] = {
      code: pc.code,
      label: pc.name,
      status: 'default',
    };
  }
  return {
    profitCenters,
    customCategories: [],
  };
}

/**
 * Load a project's stored profile. Returns the raw JSONB; callers decide
 * whether to merge with the asset-class default.
 */
export async function getProjectProfile(
  projectId: string,
  orgId: string,
): Promise<{ profile: ProjectProfile; assetClass: string | null } | null> {
  const res = await pool.query(
    `SELECT project_profile, asset_class
       FROM modeling_projects
      WHERE id = $1 AND org_id = $2`,
    [projectId, orgId],
  );
  if (res.rowCount === 0) return null;
  const row = res.rows[0];
  const profile = (row.project_profile ?? {}) as Partial<ProjectProfile>;
  return {
    profile: {
      profitCenters: profile.profitCenters ?? {},
      customCategories: profile.customCategories ?? [],
      lastSystemDiscoveryAt: profile.lastSystemDiscoveryAt,
    },
    assetClass: row.asset_class ?? null,
  };
}

/**
 * Write the full profile back. Single full-replace write — the row is small
 * and the JSONB delta surface (six state values per PC) is not worth a
 * jsonb_set chain. updated_at refresh is automatic via the column's now()
 * default — only the existing app-managed updated_at is touched here.
 */
export async function saveProjectProfile(
  projectId: string,
  orgId: string,
  profile: ProjectProfile,
): Promise<void> {
  await pool.query(
    `UPDATE modeling_projects
        SET project_profile = $3::jsonb,
            updated_at = now()
      WHERE id = $1 AND org_id = $2`,
    [projectId, orgId, JSON.stringify(profile)],
  );
}

/**
 * Apply a single profit-center state mutation. Validates the code against
 * CANONICAL_PROFIT_CENTERS so callers can't store junk PCs (e.g. 'PC-RV_PARK'
 * or stale legacyPcIds). Returns the resulting state.
 */
export async function updateProfitCenterState(
  projectId: string,
  orgId: string,
  code: string,
  patch: Partial<Omit<ProfitCenterState, 'code'>>,
): Promise<ProfitCenterState | null> {
  const canonical = getCanonicalProfitCenter(code);
  if (!canonical) return null;

  const current = await getProjectProfile(projectId, orgId);
  if (!current) return null;

  const existing = current.profile.profitCenters[code] ?? {
    code,
    label: canonical.name,
    status: 'default' as const,
  };
  const next: ProfitCenterState = {
    ...existing,
    ...patch,
    code,
  };
  current.profile.profitCenters[code] = next;
  await saveProjectProfile(projectId, orgId, current.profile);
  return next;
}

/**
 * Append a custom category. Returns the new full custom-categories list.
 */
export async function addCustomCategory(
  projectId: string,
  orgId: string,
  category: import("@shared/profit-center-id-map").CustomCategory,
): Promise<import("@shared/profit-center-id-map").CustomCategory[] | null> {
  const current = await getProjectProfile(projectId, orgId);
  if (!current) return null;
  current.profile.customCategories.push(category);
  await saveProjectProfile(projectId, orgId, current.profile);
  return current.profile.customCategories;
}
