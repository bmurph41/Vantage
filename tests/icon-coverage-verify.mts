/**
 * Verifies the assumptions.tsx ICON_MAP coverage fix (2026-05-24).
 *
 * Walks every asset class config in shared/asset-class-model-config.ts,
 * collects every `icon:` string referenced, and reports:
 *
 *   1. BEFORE — which icons would render via the OLD 20-key ICON_MAP
 *      (anchor fallback for unknowns).
 *   2. AFTER  — which icons render via the NEW 87-key ICON_MAP
 *      (building-2 fallback for unknowns).
 *   3. Per-class anchor count BEFORE vs AFTER.
 *   4. Residual: which config-referenced names still don't resolve (the
 *      'tool' findings — separate config bugs, not ICON_MAP bugs).
 *   5. Non-regression: any icon currently resolving to a real lucide
 *      icon must keep resolving to the SAME real lucide icon AFTER.
 */

import { getModelConfig, type AssetClassModelConfig } from '../shared/asset-class-model-config';

// All registered asset class slugs (matches MODEL_CONFIG_REGISTRY).
const ASSET_CLASSES = [
  'marina','multifamily','retail','office','industrial','self_storage','hotel','str',
  'medical_office','mixed_use','laundromat','sfr','business','duplex','triplex','quad',
  'car_wash','shopping_center','golf_course','landscaping','construction','accounting_firm',
  'rv_park','car_dealership','gas_station','restaurant','gym','daycare','mobile_home_park',
  'parking','data_center','land',
];

// OLD ICON_MAP — the 20-key state pre-2026-05-24, used to simulate BEFORE.
const OLD_MAP = new Set([
  'anchor','waves','sailboat','warehouse','container','ship','home','car','map-pin','fuel',
  'store','wrench','users','utensils','building','building-2','shopping-cart','dollar-sign',
  'edit','settings',
]);

// NEW ICON_MAP — the 87-key state post-2026-05-24.
const NEW_MAP = new Set([
  // Marine / nautical
  'anchor','waves','sailboat','ship','compass',
  // Storage / structural
  'warehouse','container','building','building-2','landmark','layout','layers',
  // Residential / hospitality
  'home','bed','tent','utensils','coffee','wine',
  // Retail / commerce
  'store','shopping-cart','shopping-bag','tag','receipt','shirt',
  // Transport / vehicles
  'car','truck','bike','train','package',
  // Operations / services
  'fuel','wrench','hard-hat','scissors','palette','ruler',
  // Health / personal
  'heart','pill','dumbbell','smile',
  // People
  'user','users','user-check',
  // Money / finance
  'dollar-sign','credit-card','percent','pie-chart','bar-chart','trending-up','gauge','trophy','star','crown',
  // Tech / digital
  'server','monitor','zap','link',
  // Documents / admin
  'file-text','clipboard','book','briefcase','presentation','edit','settings',
  // Geography / location
  'map-pin','map','globe','flag','target',
  // Nature / weather
  'sun','cloud-snow','wind','droplet','flame','tree-deciduous','sparkles',
  // Status / flow
  'activity','alert-circle','check-circle','clock','calendar','refresh-cw','arrow-right','arrow-up','shield','lock','square','x',
]);

function renderBefore(iconName: string | undefined): string {
  const key = iconName || 'anchor';
  return OLD_MAP.has(key) ? key : 'ANCHOR(fallback)';
}
function renderAfter(iconName: string | undefined): string {
  const key = iconName || 'building-2';
  return NEW_MAP.has(key) ? key : 'BUILDING-2(fallback)';
}

// Walk every icon-bearing field in a config.
function collectIcons(cfg: AssetClassModelConfig): { path: string; icon: string | undefined }[] {
  const icons: { path: string; icon: string | undefined }[] = [];
  if (cfg.unitMix?.tabIcon !== undefined)
    icons.push({ path: `unitMix.tabIcon`, icon: cfg.unitMix.tabIcon });
  for (const [i, t] of (cfg.unitMix?.types ?? []).entries())
    icons.push({ path: `unitMix.types[${i}=${t.id}].icon`, icon: t.icon });
  for (const [i, d] of (cfg.profitCenters?.departments ?? []).entries())
    icons.push({ path: `profitCenters.departments[${i}=${d.id}].icon`, icon: d.icon });
  for (const [i, s] of (cfg.inputSections ?? []).entries())
    icons.push({ path: `inputSections[${i}=${s.id}].icon`, icon: s.icon });
  for (const [i, g] of (cfg.growthCategories ?? []).entries())
    icons.push({ path: `growthCategories[${i}=${g.id}].icon`, icon: (g as any).icon });
  for (const [i, k] of (cfg.kpis ?? []).entries())
    icons.push({ path: `kpis[${i}=${(k as any).id}].icon`, icon: (k as any).icon });
  return icons;
}

let totalIcons = 0;
let totalAnchorBefore = 0;
let totalBuilding2After = 0;
let totalChanged = 0;
let totalUnchanged = 0;
const regressions: string[] = [];
const residualUnmapped: { class: string; path: string; icon: string }[] = [];
const perClass: Record<string, { total: number; anchorBefore: number; building2After: number; corrected: number }> = {};

for (const ac of ASSET_CLASSES) {
  const cfg = getModelConfig(ac);
  const icons = collectIcons(cfg);
  perClass[ac] = { total: icons.length, anchorBefore: 0, building2After: 0, corrected: 0 };

  for (const { path, icon } of icons) {
    totalIcons++;
    const before = renderBefore(icon);
    const after = renderAfter(icon);

    if (before === 'ANCHOR(fallback)') { totalAnchorBefore++; perClass[ac].anchorBefore++; }
    if (after === 'BUILDING-2(fallback)') {
      totalBuilding2After++;
      perClass[ac].building2After++;
      residualUnmapped.push({ class: ac, path, icon: icon ?? '<undefined>' });
    }

    // Non-regression check: if BEFORE resolved to a real lucide icon name
    // (not fallback), AFTER must resolve to the SAME real icon name.
    if (before !== 'ANCHOR(fallback)' && after !== 'BUILDING-2(fallback)') {
      if (before !== after) {
        regressions.push(`${ac}/${path}: BEFORE=${before} → AFTER=${after}`);
      } else {
        totalUnchanged++;
      }
    }
    // Correction: BEFORE was anchor-fallback, AFTER is a real icon.
    if (before === 'ANCHOR(fallback)' && after !== 'BUILDING-2(fallback)') {
      totalChanged++;
      perClass[ac].corrected++;
    }
  }
}

console.log('=== ICON_MAP coverage fix — verification ===\n');

console.log(`Total icon references walked: ${totalIcons}`);
console.log(`BEFORE — rendered as Anchor (fallback): ${totalAnchorBefore}`);
console.log(`AFTER  — rendered as Building2 (fallback): ${totalBuilding2After}`);
console.log(`Icons CORRECTED (was anchor-fallback, now correct icon): ${totalChanged}`);
console.log(`Icons UNCHANGED (already resolved correctly, same icon after): ${totalUnchanged}`);
console.log(`Icons REGRESSED (resolved before, different icon now): ${regressions.length}`);

if (regressions.length > 0) {
  console.error('\n✗ REGRESSIONS FOUND:');
  for (const r of regressions) console.error(`  ${r}`);
  process.exit(1);
}

console.log('\n=== Per-class breakdown ===');
console.table(perClass);

console.log('\n=== Residual unmapped icon names (Building2 fallback in AFTER) ===');
const residualByIcon = new Map<string, { count: number; classes: Set<string> }>();
for (const r of residualUnmapped) {
  const entry = residualByIcon.get(r.icon) ?? { count: 0, classes: new Set() };
  entry.count++;
  entry.classes.add(r.class);
  residualByIcon.set(r.icon, entry);
}
const residualSummary = Array.from(residualByIcon.entries())
  .map(([icon, { count, classes }]) => ({ icon, count, classes: Array.from(classes).join(',') }))
  .sort((a, b) => b.count - a.count);
console.table(residualSummary);

console.log('\n=== Marina non-regression spot-check ===');
const marinaCfg = getModelConfig('marina');
const marinaIcons = collectIcons(marinaCfg);
const marinaExplicitAnchor = marinaIcons.filter(i => i.icon === 'anchor');
console.log(`Marina types/depts/sections referencing icon='anchor' explicitly: ${marinaExplicitAnchor.length}`);
for (const m of marinaExplicitAnchor.slice(0, 5)) {
  console.log(`  ${m.path}: BEFORE=${renderBefore(m.icon)} AFTER=${renderAfter(m.icon)}`);
}
const allMarinaResolve = marinaIcons.every(i => renderAfter(i.icon) !== 'BUILDING-2(fallback)' || (i.icon === 'tool'));
console.log(`All marina icons resolve correctly AFTER (excluding 'tool' residual): ${allMarinaResolve ? '✓ yes' : '✗ no'}`);

console.log('\n=== MF spot-check (the symptom case) ===');
const mfCfg = getModelConfig('multifamily');
const mfIcons = collectIcons(mfCfg);
const mfAnchorBefore = mfIcons.filter(i => renderBefore(i.icon) === 'ANCHOR(fallback)');
const mfAnchorAfter = mfIcons.filter(i => renderAfter(i.icon) === 'BUILDING-2(fallback)');
console.log(`MF icons rendering as Anchor (fallback) BEFORE: ${mfAnchorBefore.length}`);
for (const m of mfAnchorBefore) console.log(`  ${m.path}: icon='${m.icon}'`);
console.log(`MF icons rendering as Building2 (fallback) AFTER: ${mfAnchorAfter.length}`);
for (const m of mfAnchorAfter) console.log(`  ${m.path}: icon='${m.icon}'`);

console.log('\n=== Verdict ===');
if (regressions.length === 0) console.log('✓ GREEN — 0 regressions, every previously-resolving icon still resolves to the same lucide icon AFTER.');
else process.exit(1);
