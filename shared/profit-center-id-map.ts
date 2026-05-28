// =============================================================================
// FILE: shared/profit-center-id-map.ts
//
// Canonical profit-center ID reconciliation (Phase 2B Session 1, 2026-05-28).
//
// MarinaMatch has SIX historical vocabularies for the same profit-center
// concept, each in a different layer of the stack. This file is the single
// canonical reference and the translation surface between them.
//
//   1. PC-XXX        — `coa_profit_centers.code` (DB source of truth)
//   2. pc_*          — `client/src/lib/pnl-categories.ts:PROFIT_CENTER_TO_DEPT` keys
//   3. wizardKey     — `client/src/pages/modeling/projects/setup-wizard.tsx` profit-center step keys
//   4. uiDept        — `RevenueCogsDept` union (the dropdown option value)
//   5. legacy[]      — bare strings persisted in `cm.config.profitCenters` on
//                      older projects (e.g. ["storage","fuel","service"]).
//                      Same vocabulary as #4 but with one wild variant:
//                      "ship_store" (no _retail suffix) seen in DB.
//   6. MultiDocReview — hardcoded 10-entry list in MultiDocumentReview.tsx
//                      (marina_ops, fuel_dock, ship_store, restaurant,
//                      boat_sales, service_dept, storage, commercial_leases,
//                      admin, other). Translation provided for completeness;
//                      consumer is being deprecated to use uiDept in this session.
//
// Canonical output is always a PC-XXX code, or `null` for deprecated /
// unmappable inputs (RV Park on a marina project being the headline case —
// it's its own asset class, not a marina sub-profit-center).
//
// Phase 2B Session 1 scope:
//   - Translation FUNCTIONS only — no schema migration of stored data yet.
//   - Consumers continue to read their existing shapes; new code uses this map.
//   - Session 2 lands the project_profile JSONB column + full data migration.
// =============================================================================

/**
 * Whether a canonical PC code represents a revenue-side profit center or an
 * expense-side department-as-profit-center. The DB pack lists G&A as a profit
 * center, but every other consumer treats it as an expense department. Until
 * Session 2 makes the formal data-model decision, we mark its kind explicitly
 * and let consumers decide.
 */
export type ProfitCenterKind = 'profit_center' | 'expense_department';

export interface CanonicalProfitCenter {
  /** Canonical code — matches coa_profit_centers.code. */
  code: string;
  /** Display name — matches coa_profit_centers.name. */
  name: string;
  /** Behavioral classification (Session 2 may refine PC-999 specifically). */
  kind: ProfitCenterKind;
  /** RevenueCogsDept / ExpenseDept value used by pnl-categories.ts dropdowns. */
  uiDept: string;
  /** setup-wizard.tsx profit-center key, or null if wizard doesn't ask. */
  wizardKey: string | null;
  /** pnl-categories.ts PROFIT_CENTER_TO_DEPT key, or null if UI map doesn't list. */
  legacyPcId: string | null;
  /** Sort order matching coa_profit_centers.sort_order. */
  sortOrder: number;
}

// -----------------------------------------------------------------------------
// CANONICAL LIST
//
// Mirrors coa_profit_centers DB rows (16 marina rows as of 2026-05-27) plus
// PC-901 Food & Beverage being added to the DB in this session's migration.
//
// Notes on Phase 2A gaps now filled:
//   - G1 PC-850 Events & Charters: filled. uiDept = 'events_charters'.
//   - G2 PC-550 Parking: filled. uiDept = 'parking'.
//   - G5 F&B (PC-901): NEW row added this session — distinct from PC-900
//     Hospitality (operator-run kitchen/bar vs lodging/rooms).
//
// Notes on Phase 2A gaps deferred:
//   - G3 PC-999 G&A: kind='expense_department' here. Session 2 finalizes
//     whether the DB pack should keep listing it under profit_centers.
//   - G5 RV Park: pnl-categories.ts retains `pc_rv_park` / `rv_park`, but this
//     map does NOT include a marina-side PC code. legacyPcIdToPcCode() returns
//     null with a deprecation warning. UI cleanup is a separate workstream.
// -----------------------------------------------------------------------------
export const CANONICAL_PROFIT_CENTERS: CanonicalProfitCenter[] = [
  // sortOrder matches coa_profit_centers.sort_order in DB. DB uses compressed
  // values (10, 20, …, 95) not PC-code-aligned (100, 200, …). PC-901 sits at
  // 92 between Hospitality (90) and Amenities (95).
  { code: 'PC-100', name: 'Storage',                  kind: 'profit_center',     uiDept: 'storage',             wizardKey: null,                legacyPcId: null,                  sortOrder: 10  },
  { code: 'PC-200', name: 'Fuel',                     kind: 'profit_center',     uiDept: 'fuel',                wizardKey: 'fuelSales',         legacyPcId: 'pc_fuel_dock',        sortOrder: 20  },
  { code: 'PC-300', name: 'Service',                  kind: 'profit_center',     uiDept: 'service',             wizardKey: 'serviceDepartment', legacyPcId: 'pc_service',          sortOrder: 30  },
  { code: 'PC-350', name: 'Parts',                    kind: 'profit_center',     uiDept: 'parts',               wizardKey: null,                legacyPcId: 'pc_parts',            sortOrder: 35  },
  { code: 'PC-400', name: 'Retail (Ship Store)',      kind: 'profit_center',     uiDept: 'ship_store_retail',   wizardKey: 'shipStore',         legacyPcId: 'pc_ships_store',      sortOrder: 40  },
  { code: 'PC-500', name: 'Commercial Leases',        kind: 'profit_center',     uiDept: 'commercial_leases',   wizardKey: 'commercialTenants', legacyPcId: 'pc_commercial_leases',sortOrder: 50  },
  { code: 'PC-550', name: 'Parking',                  kind: 'profit_center',     uiDept: 'parking',             wizardKey: 'parkingLot',        legacyPcId: null,                  sortOrder: 55  },
  { code: 'PC-600', name: 'Rentals',                  kind: 'profit_center',     uiDept: 'boat_rentals',        wizardKey: 'boatRentals',       legacyPcId: 'pc_rental_boats',     sortOrder: 60  },
  { code: 'PC-650', name: 'Boat Club',                kind: 'profit_center',     uiDept: 'boat_club',           wizardKey: 'boatClub',          legacyPcId: 'pc_boat_club',        sortOrder: 65  },
  { code: 'PC-700', name: 'Boat Sales',               kind: 'profit_center',     uiDept: 'boat_sales',          wizardKey: 'boatSales',         legacyPcId: 'pc_boat_sales',       sortOrder: 70  },
  { code: 'PC-750', name: 'Finance & F&I',            kind: 'profit_center',     uiDept: 'boat_finance',        wizardKey: null,                legacyPcId: 'pc_boat_finance',     sortOrder: 75  },
  { code: 'PC-800', name: 'Brokerage',                kind: 'profit_center',     uiDept: 'boat_brokerage',      wizardKey: null,                legacyPcId: 'pc_boat_brokerage',   sortOrder: 80  },
  { code: 'PC-850', name: 'Events & Charters',        kind: 'profit_center',     uiDept: 'events_charters',     wizardKey: null,                legacyPcId: null,                  sortOrder: 85  },
  { code: 'PC-900', name: 'Hospitality',              kind: 'profit_center',     uiDept: 'hospitality_lodging', wizardKey: null,                legacyPcId: 'pc_hospitality',      sortOrder: 90  },
  { code: 'PC-901', name: 'Food & Beverage',          kind: 'profit_center',     uiDept: 'fb',                  wizardKey: null,                legacyPcId: 'pc_fb',               sortOrder: 92  },
  { code: 'PC-950', name: 'Amenities',                kind: 'profit_center',     uiDept: 'marina_amenities',    wizardKey: null,                legacyPcId: 'pc_marina_amenities', sortOrder: 95  },
  { code: 'PC-999', name: 'General & Administrative', kind: 'expense_department',uiDept: 'general_admin',       wizardKey: null,                legacyPcId: null,                  sortOrder: 999 },
];

// -----------------------------------------------------------------------------
// Lookup indexes (built once at module load)
// -----------------------------------------------------------------------------
const BY_CODE = new Map(CANONICAL_PROFIT_CENTERS.map(pc => [pc.code, pc]));
const BY_WIZARD_KEY = new Map(
  CANONICAL_PROFIT_CENTERS.filter(pc => pc.wizardKey).map(pc => [pc.wizardKey as string, pc])
);
const BY_LEGACY_PC_ID = new Map(
  CANONICAL_PROFIT_CENTERS.filter(pc => pc.legacyPcId).map(pc => [pc.legacyPcId as string, pc])
);
const BY_UI_DEPT = new Map(CANONICAL_PROFIT_CENTERS.map(pc => [pc.uiDept, pc]));

// Wild variants observed in persisted data — map to canonical without inventing
// new aliases. Add only when seen in real DB rows.
const WILD_BARE_DEPT_ALIASES: Record<string, string> = {
  // 2026-05-28: project 9a10a6a1 Test Marina has cm.config.profitCenters =
  // ["storage","fuel","ship_store","service",...]. Missing _retail suffix.
  ship_store: 'ship_store_retail',
};

// MultiDocumentReview hardcoded 10-entry list — translation provided so the
// migration can read items already classified with these labels. The consumer
// is being switched to uiDept this session; this is read-only legacy support.
const MULTI_DOC_REVIEW_LEGACY_MAP: Record<string, string> = {
  marina_ops:          'marina_amenities',
  fuel_dock:           'fuel',
  ship_store:          'ship_store_retail',
  restaurant:          'fb',
  boat_sales:          'boat_sales',
  service_dept:        'service',
  storage:             'storage',
  commercial_leases:   'commercial_leases',
  admin:               'general_admin',
  other:               'miscellaneous',
};

// Deprecated legacyPcIds — these used to exist in PROFIT_CENTER_TO_DEPT but
// are not valid marina-side profit centers. Returning null + warning lets the
// caller decide whether to surface a migration prompt or silently drop.
const DEPRECATED_LEGACY_PC_IDS = new Set<string>(['pc_rv_park']);

// -----------------------------------------------------------------------------
// Translation functions
//
// All return a canonical PC-XXX code (string) or null when the input is
// genuinely unmappable (deprecated or unknown). Callers must handle null.
// -----------------------------------------------------------------------------

/**
 * Wizard step key (setup-wizard.tsx) → canonical PC code.
 * Example: 'fuelSales' → 'PC-200'
 */
export function wizardKeyToPcCode(key: string): string | null {
  return BY_WIZARD_KEY.get(key)?.code ?? null;
}

/**
 * Legacy `pc_*` ID (pnl-categories.ts vocabulary) → canonical PC code.
 *
 * RV Park is deprecated for marina projects — returns null and logs a
 * deprecation notice the first time per legacyId per session. Callers passing
 * `assetClass: 'marina'` opt into the warning; other asset classes get null
 * without noise (RV Park is a legitimate primary asset class).
 */
export function legacyPcIdToPcCode(
  legacyId: string,
  options?: { assetClass?: string; warn?: boolean }
): string | null {
  if (DEPRECATED_LEGACY_PC_IDS.has(legacyId)) {
    const shouldWarn = options?.warn !== false &&
      (options?.assetClass === 'marina' || options?.assetClass == null);
    if (shouldWarn) {
      warnOnce(`[profit-center-id-map] deprecated legacyPcId "${legacyId}" — RV Park is a primary asset class, not a marina sub-profit-center. Map output is null; caller should drop or migrate.`);
    }
    return null;
  }
  return BY_LEGACY_PC_ID.get(legacyId)?.code ?? null;
}

/**
 * Bare RevenueCogsDept string (or wild persisted variant) → canonical PC code.
 *
 * Handles the wild "ship_store" no-suffix variant observed in project
 * 9a10a6a1 (cm.config.profitCenters as string[]). Returns the canonical PC
 * matching whichever uiDept the bare string resolves to.
 *
 * Returns null for `miscellaneous` and `third_party_leases` — these are UI-
 * only catch-alls without a canonical PC code.
 */
export function bareDeptToPcCode(dept: string): string | null {
  const normalized = WILD_BARE_DEPT_ALIASES[dept] ?? dept;
  return BY_UI_DEPT.get(normalized)?.code ?? null;
}

/**
 * Canonical PC code → wizard step key.
 * Returns null for PCs the wizard doesn't surface (Parts, Finance, Brokerage,
 * Events & Charters, Hospitality, F&B, Amenities, G&A).
 */
export function pcCodeToWizardKey(code: string): string | null {
  return BY_CODE.get(code)?.wizardKey ?? null;
}

/**
 * Canonical PC code → legacy `pc_*` ID used by pnl-categories.ts.
 * Returns null for codes that pnl-categories.ts doesn't list (Storage as a
 * pc_id — UI treats storage as implicit-always; PC-550 Parking — UI doesn't
 * have parking until this session's enum extension; PC-850 Events; PC-999 G&A).
 */
export function pcCodeToLegacyPcId(code: string): string | null {
  return BY_CODE.get(code)?.legacyPcId ?? null;
}

/**
 * Canonical PC code → uiDept (the dropdown option value).
 * Always returns a value for any valid canonical code.
 */
export function pcCodeToUiDept(code: string): string | null {
  return BY_CODE.get(code)?.uiDept ?? null;
}

/**
 * Canonical PC code → full canonical record. Useful when callers need the
 * kind/name/sortOrder too.
 */
export function getCanonicalProfitCenter(code: string): CanonicalProfitCenter | null {
  return BY_CODE.get(code) ?? null;
}

/**
 * Translate a MultiDocumentReview-vintage hardcoded dept value (marina_ops,
 * fuel_dock, ship_store, restaurant, etc.) → canonical PC code. Read-only —
 * used only to migrate items already classified with these values. The
 * consumer is being switched to the standard uiDept vocabulary in this
 * session's commit.
 */
export function multiDocReviewLegacyDeptToPcCode(dept: string): string | null {
  const mapped = MULTI_DOC_REVIEW_LEGACY_MAP[dept];
  if (!mapped) return null;
  return BY_UI_DEPT.get(mapped)?.code ?? null;
}

/**
 * Detect & classify a stored profitCenters JSON value's shape.
 * Used by Session 2's data migration AND by current consumers that need to
 * decide "is this populated, or empty/legacy/null?".
 */
export type ProfitCentersShape =
  | { kind: 'absent' }                     // null/undefined
  | { kind: 'empty_object' }               // {} (truthy but no keys)
  | { kind: 'legacy_string_array'; values: string[] } // ["storage","fuel",...]
  | { kind: 'pc_id_object'; enabledCount: number; totalCount: number } // {pc_*: {isEnabled}}
  | { kind: 'unknown' };                   // shape we haven't seen

export function classifyProfitCentersShape(value: unknown): ProfitCentersShape {
  if (value == null) return { kind: 'absent' };
  if (Array.isArray(value)) {
    return { kind: 'legacy_string_array', values: value.filter((v): v is string => typeof v === 'string') };
  }
  if (typeof value !== 'object') return { kind: 'unknown' };
  const keys = Object.keys(value as Record<string, unknown>);
  if (keys.length === 0) return { kind: 'empty_object' };
  // pc_id_object shape: at least one key starts with 'pc_'
  const hasPcKey = keys.some(k => k.startsWith('pc_'));
  if (hasPcKey) {
    let enabled = 0;
    for (const k of keys) {
      const v = (value as Record<string, any>)[k];
      if (v && typeof v === 'object' && v.isEnabled === true) enabled += 1;
    }
    return { kind: 'pc_id_object', enabledCount: enabled, totalCount: keys.length };
  }
  return { kind: 'unknown' };
}

// -----------------------------------------------------------------------------
// One-shot deprecation logging
// Per-session memoization so legacy reads don't flood the console.
// -----------------------------------------------------------------------------
const WARNED = new Set<string>();
function warnOnce(msg: string): void {
  if (WARNED.has(msg)) return;
  WARNED.add(msg);
  console.warn(msg);
}

// -----------------------------------------------------------------------------
// Convenience: full canonical list as an array of (code, name) pairs.
// Used by future Session 2 wizard work to render checkbox grids and by UI
// dropdowns that want the canonical ordering.
// -----------------------------------------------------------------------------
export function getCanonicalProfitCenterList(): ReadonlyArray<CanonicalProfitCenter> {
  return CANONICAL_PROFIT_CENTERS;
}

// =============================================================================
// PROJECT PROFILE (Phase 2B Session 2, 2026-05-28)
//
// The project_profile JSONB column on modeling_projects stores per-project,
// PC-XXX-keyed state describing which profit centers are visible/active/hidden
// for a given deal. Replaces the legacy customMetrics.config.profitCenters
// blob (six historical shapes — see classifyProfitCentersShape above).
//
// SCOPE this session: WRITE-only. The new column is populated by the one-shot
// migration and by CRUD endpoints, but the wizard + Inputs & Data UI continue
// to read customMetrics.config.profitCenters. Session 3+ flips consumers.
//
// STATE SEMANTICS — keep this taxonomy explicit so consumers don't drift:
//
//   default            Untouched. System has not asked, user has not declared.
//                      Rendered as "available" (i.e. enabled/visible) by
//                      default. The asset-class pack pre-populates this state
//                      for every PC the pack knows about.
//
//   declared_yes       User explicitly opted in (wizard checkbox checked, or
//                      legacy_string_array migration source). Enabled/visible.
//
//   declared_no        User explicitly opted out (wizard checkbox unchecked,
//                      or pc_id_object isEnabled:false migration source).
//                      Hidden by default but still mappable — uploads can
//                      surface evidence that flips this to system_suggested
//                      pending re-confirmation.
//
//   system_suggested   Transient. The discovery job (Session 5) noticed PnL
//                      lines matching this PC and is asking the user to
//                      confirm/dismiss. Rendered with a "we noticed X" prompt.
//
//   user_confirmed     User accepted a system_suggested item. Enabled/visible.
//                      Distinguished from declared_yes so we can tell whether
//                      the user opted in proactively or in response to a
//                      discovery prompt (analytics surface).
//
//   user_removed       User dismissed a system_suggested item. Hidden by
//                      default — same effective visibility as declared_no but
//                      tracks that the system once proposed it.
//
// "Enabled/visible" group:  default, declared_yes, user_confirmed
// "Hidden by default" group: declared_no, user_removed
// "Transient prompt" group:  system_suggested
//
// PC-999 G&A (G3 follow-up): included in the default profile with kind carried
// on the canonical record (`getCanonicalProfitCenter('PC-999').kind ===
// 'expense_department'`). Whether the wizard surfaces it as a togglable PC at
// all is a Session 3 product decision; the schema doesn't force a stance.
// =============================================================================

export type ISO8601 = string;

export type ProfitCenterStateKind =
  | 'default'
  | 'declared_yes'
  | 'declared_no'
  | 'system_suggested'
  | 'user_confirmed'
  | 'user_removed';

export const ENABLED_STATES = new Set<ProfitCenterStateKind>([
  'default',
  'declared_yes',
  'user_confirmed',
]);

export const HIDDEN_STATES = new Set<ProfitCenterStateKind>([
  'declared_no',
  'user_removed',
]);

export interface ProfitCenterState {
  /** Canonical PC-XXX code (must match a CANONICAL_PROFIT_CENTERS entry). */
  code: string;
  /** Display label at the time of state assignment. Free-form so the UI can
   *  show a snapshot of what the user saw when they made the decision; the
   *  canonical name is always retrievable via getCanonicalProfitCenter(code). */
  label: string;
  status: ProfitCenterStateKind;
  declaredAt?: ISO8601;
  discoveredAt?: ISO8601;
  discoverySource?: {
    jobId: string;
    sampleLabels: string[];
  };
}

export interface CustomCategory {
  /** Stable client-generated id (UUID). */
  id: string;
  label: string;
  suggestedSection: 'revenue' | 'cogs' | 'expense' | 'non_operating' | 'business_income';
  addedAt: ISO8601;
  occurrenceCount: number;
  /** If true, the user has flagged this for promotion into the global pack. */
  proposedForGlobal: boolean;
}

export interface ProjectProfile {
  /** PC-XXX → state. Asset-class default pack populates every known PC at
   *  status 'default'; mutations only change individual entries. */
  profitCenters: Record<string, ProfitCenterState>;
  /** ISO timestamp of the last successful auto-discovery run (Session 5+). */
  lastSystemDiscoveryAt?: ISO8601;
  customCategories: CustomCategory[];
}

/**
 * Empty/no-pack project profile. Returned by getAssetClassDefaultProfile when
 * the asset class has no COA pack registered. Never throws.
 */
export function emptyProjectProfile(): ProjectProfile {
  return { profitCenters: {}, customCategories: [] };
}
