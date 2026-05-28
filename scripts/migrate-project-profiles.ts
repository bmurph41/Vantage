#!/usr/bin/env tsx
/**
 * Phase 2B Session 2 one-shot data migration (2026-05-28).
 *
 * Translates every modeling_projects.custom_metrics.config.profitCenters value
 * (whatever historical shape) into the new modeling_projects.project_profile
 * JSONB column, normalizing all entries to canonical PC-XXX codes.
 *
 * Mapping rules (per Session 2 spec):
 *   absent / empty_object       → asset-class default (all PCs status:'default')
 *   legacy_string_array empty   → asset-class default (explicit branch, not zero-loop)
 *   legacy_string_array values  → each value → bareDeptToPcCode → declared_yes;
 *                                 remaining canonical PCs → default
 *   pc_id_object                → each key → legacyPcIdToPcCode;
 *                                 isEnabled:true → declared_yes,
 *                                 isEnabled:false → declared_no;
 *                                 remaining canonical PCs → default
 *   object_with_code_label / unknown → log + skip (never observed in trace)
 *
 * Idempotent: skips rows where project_profile already has any profitCenters
 * entries. Re-running is safe.
 *
 * Usage:
 *   npx tsx scripts/migrate-project-profiles.ts
 */

import pg from 'pg';
import {
  bareDeptToPcCode,
  CANONICAL_PROFIT_CENTERS,
  classifyProfitCentersShape,
  legacyPcIdToPcCode,
  type ProfitCenterState,
  type ProjectProfile,
} from '../shared/profit-center-id-map';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

interface MigrationRowResult {
  id: string;
  marinaName: string;
  assetClass: string | null;
  action: 'wrote_default' | 'wrote_translated' | 'skipped_already_populated' | 'skipped_no_pack' | 'skipped_unknown_shape';
  shapeKind: string;
  pcCounts?: { declared_yes: number; declared_no: number; default: number };
  untranslatable?: string[];
}

async function hasMarinaPack(assetClass: string | null): Promise<boolean> {
  if (!assetClass) return false;
  const r = await pool.query(
    `SELECT 1 FROM coa_taxonomy_packs WHERE LOWER(asset_class::text) = LOWER($1) LIMIT 1`,
    [assetClass],
  );
  return (r.rowCount ?? 0) > 0;
}

function buildDefaultProfile(assetClass: string | null): ProjectProfile {
  // Only marina has a canonical list this session (same gate as the service).
  // Empty profile for everything else — including asset classes with a pack
  // but no canonical list yet (none exist today; the service guard logs this).
  if (!assetClass || assetClass.toLowerCase() !== 'marina') {
    return { profitCenters: {}, customCategories: [] };
  }
  const profitCenters: Record<string, ProfitCenterState> = {};
  for (const pc of CANONICAL_PROFIT_CENTERS) {
    profitCenters[pc.code] = { code: pc.code, label: pc.name, status: 'default' };
  }
  return { profitCenters, customCategories: [] };
}

async function migrateRow(
  id: string,
  marinaName: string,
  assetClass: string | null,
  pc: unknown,
  existingProfile: any,
): Promise<MigrationRowResult> {
  // Idempotency: a row is "already migrated" when project_profile carries our
  // sentinel `_migratedAt`. Bare `profitCenters` count is NOT the gate, because
  // a successfully-migrated non-marina row legitimately has profitCenters:{}.
  if (existingProfile?._migratedAt) {
    return { id, marinaName, assetClass, action: 'skipped_already_populated', shapeKind: 'n/a' };
  }

  if (assetClass && !(await hasMarinaPack(assetClass))) {
    // No pack for this asset class — write the empty default with sentinel.
    const defaultProfile = buildDefaultProfile(assetClass);
    const payload = { ...defaultProfile, _migratedAt: new Date().toISOString() };
    await pool.query(
      `UPDATE modeling_projects SET project_profile = $2::jsonb, updated_at = now() WHERE id = $1`,
      [id, JSON.stringify(payload)],
    );
    return { id, marinaName, assetClass, action: 'skipped_no_pack', shapeKind: classifyProfitCentersShape(pc).kind };
  }

  const shape = classifyProfitCentersShape(pc);
  const defaultProfile = buildDefaultProfile(assetClass);

  // Asset class with no canonical list (today: anything non-marina). Treat as
  // empty default; emit no PC translations. Stamp sentinel as above.
  const isNonMarinaAssetClass = !assetClass || assetClass.toLowerCase() !== 'marina';

  // Branch 1: absent / empty_object / explicit empty legacy_string_array
  const isExplicitlyEmpty =
    shape.kind === 'absent' ||
    shape.kind === 'empty_object' ||
    (shape.kind === 'legacy_string_array' && shape.values.length === 0);

  if (isExplicitlyEmpty) {
    const payload = { ...defaultProfile, _migratedAt: new Date().toISOString() };
    await pool.query(
      `UPDATE modeling_projects SET project_profile = $2::jsonb, updated_at = now() WHERE id = $1`,
      [id, JSON.stringify(payload)],
    );
    const counts = countStates(defaultProfile.profitCenters);
    return { id, marinaName, assetClass, action: 'wrote_default', shapeKind: shape.kind, pcCounts: counts };
  }

  // Non-marina with non-empty legacy shape → log and write empty default.
  // bareDeptToPcCode/legacyPcIdToPcCode only know marina vocab.
  if (isNonMarinaAssetClass) {
    const payload = { ...defaultProfile, _migratedAt: new Date().toISOString() };
    await pool.query(
      `UPDATE modeling_projects SET project_profile = $2::jsonb, updated_at = now() WHERE id = $1`,
      [id, JSON.stringify(payload)],
    );
    console.log(`  [non-marina translate skipped] ${id.slice(0,8)} assetClass=${assetClass} shape=${shape.kind} → empty default written`);
    return { id, marinaName, assetClass, action: 'wrote_default', shapeKind: shape.kind, pcCounts: countStates(defaultProfile.profitCenters) };
  }

  // Branch 2: legacy_string_array with values (marina only)
  if (shape.kind === 'legacy_string_array') {
    const next = { ...defaultProfile, profitCenters: { ...defaultProfile.profitCenters } };
    const untranslatable: string[] = [];
    const now = new Date().toISOString();
    for (const dept of shape.values) {
      const code = bareDeptToPcCode(dept);
      if (!code) {
        untranslatable.push(dept);
        continue;
      }
      const existing = next.profitCenters[code];
      next.profitCenters[code] = {
        code,
        label: existing?.label ?? code,
        status: 'declared_yes',
        declaredAt: now,
      };
    }
    const payload = { ...next, _migratedAt: now };
    await pool.query(
      `UPDATE modeling_projects SET project_profile = $2::jsonb, updated_at = now() WHERE id = $1`,
      [id, JSON.stringify(payload)],
    );
    return {
      id, marinaName, assetClass,
      action: 'wrote_translated',
      shapeKind: shape.kind,
      pcCounts: countStates(next.profitCenters),
      untranslatable: untranslatable.length ? untranslatable : undefined,
    };
  }

  // Branch 3: pc_id_object (marina only)
  if (shape.kind === 'pc_id_object') {
    const next = { ...defaultProfile, profitCenters: { ...defaultProfile.profitCenters } };
    const untranslatable: string[] = [];
    const now = new Date().toISOString();
    const obj = pc as Record<string, { isEnabled?: boolean }>;
    for (const [legacyKey, value] of Object.entries(obj)) {
      const code = legacyPcIdToPcCode(legacyKey, { assetClass: assetClass ?? undefined, warn: false });
      if (!code) {
        untranslatable.push(legacyKey);
        continue;
      }
      const existing = next.profitCenters[code];
      next.profitCenters[code] = {
        code,
        label: existing?.label ?? code,
        status: value?.isEnabled ? 'declared_yes' : 'declared_no',
        declaredAt: now,
      };
    }
    const payload = { ...next, _migratedAt: now };
    await pool.query(
      `UPDATE modeling_projects SET project_profile = $2::jsonb, updated_at = now() WHERE id = $1`,
      [id, JSON.stringify(payload)],
    );
    return {
      id, marinaName, assetClass,
      action: 'wrote_translated',
      shapeKind: shape.kind,
      pcCounts: countStates(next.profitCenters),
      untranslatable: untranslatable.length ? untranslatable : undefined,
    };
  }

  // Branch 4: unknown / object_with_code_label — never observed in trace.
  // Don't write; emit warning so the operator can inspect.
  console.warn(`  [skipped] ${id.slice(0,8)} unknown shape kind=${shape.kind} pc=${JSON.stringify(pc).slice(0,200)}`);
  return { id, marinaName, assetClass, action: 'skipped_unknown_shape', shapeKind: shape.kind };
}

function countStates(pcs: Record<string, ProfitCenterState>) {
  const counts = { declared_yes: 0, declared_no: 0, default: 0 };
  for (const s of Object.values(pcs)) {
    if (s.status === 'declared_yes') counts.declared_yes++;
    else if (s.status === 'declared_no') counts.declared_no++;
    else if (s.status === 'default') counts.default++;
  }
  return counts;
}

async function main() {
  console.log('=== Phase 2B Session 2 — project_profile migration ===\n');

  const rows = await pool.query(`
    SELECT id, marina_name, asset_class,
           custom_metrics->'config'->'profitCenters' AS pc,
           project_profile
      FROM modeling_projects
     ORDER BY created_at DESC NULLS LAST
  `);

  const results: MigrationRowResult[] = [];
  for (const row of rows.rows) {
    const r = await migrateRow(row.id, row.marina_name, row.asset_class, row.pc, row.project_profile);
    results.push(r);
  }

  console.log('\n=== Per-row results ===');
  for (const r of results) {
    const pcSummary = r.pcCounts
      ? `[yes=${r.pcCounts.declared_yes} no=${r.pcCounts.declared_no} default=${r.pcCounts.default}]`
      : '';
    const untr = r.untranslatable ? ` UNTRANSLATABLE=[${r.untranslatable.join(',')}]` : '';
    console.log(
      `  ${r.id.slice(0,8)}  ${(r.assetClass ?? '(null)').padEnd(12)} ${r.action.padEnd(28)} ${r.shapeKind.padEnd(22)} ${pcSummary}${untr}  ${r.marinaName}`,
    );
  }

  const totals = new Map<string, number>();
  for (const r of results) totals.set(r.action, (totals.get(r.action) || 0) + 1);
  console.log('\n=== Totals ===');
  for (const [k, v] of totals) console.log(`  ${k.padEnd(28)} ${v}`);

  await pool.end();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Migration failed:', err);
  pool.end().catch(() => {});
  process.exit(1);
});
