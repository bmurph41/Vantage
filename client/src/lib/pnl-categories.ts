export type CategoryTier = "revenue" | "cogs" | "expense";

export type RevenueCogsDept =
  | "storage"
  | "fuel"
  | "marina_amenities"
  | "ship_store_retail"
  | "service"
  | "parts"
  | "third_party_leases"
  | "commercial_leases"
  | "parking"
  | "boat_club"
  | "boat_rentals"
  | "boat_sales"
  | "boat_brokerage"
  | "boat_finance"
  | "events_charters"
  | "fb"
  | "rv_park"
  | "hospitality_lodging"
  | "miscellaneous";

export type ExpenseDept = 
  | "payroll" 
  | "general_admin" 
  | "advertising" 
  | "repairs_maintenance" 
  | "utilities" 
  | "licenses_permits" 
  | "security_contract_services" 
  | "bank_cc_fees" 
  | "professional_services" 
  | "insurance" 
  | "taxes" 
  | "leases" 
  | "fb" 
  | "service" 
  | "parts" 
  | "rv_park" 
  | "hospitality_lodging" 
  | "miscellaneous";

export const CATEGORY_TIER_LABELS: Record<CategoryTier, string> = {
  revenue: "Revenue",
  cogs: "Cost of Goods Sold",
  expense: "Expense",
};

export const REVENUE_COGS_DEPT_LABELS: Record<RevenueCogsDept, string> = {
  storage: "Storage",
  fuel: "Fuel",
  marina_amenities: "Marina & Amenities",
  ship_store_retail: "Ship's Store/Retail",
  service: "Service",
  parts: "Parts",
  third_party_leases: "Third-Party Leases",
  commercial_leases: "Commercial Leases",
  parking: "Parking",
  boat_club: "Boat Club",
  boat_rentals: "Boat Rentals",
  boat_sales: "Boat Sales",
  boat_brokerage: "Boat Brokerage",
  boat_finance: "Boat Finance",
  events_charters: "Events & Charters",
  fb: "F&B",
  rv_park: "RV Park",
  hospitality_lodging: "Hospitality/Lodging",
  miscellaneous: "Miscellaneous",
};

export const EXPENSE_DEPT_LABELS: Record<ExpenseDept, string> = {
  payroll: "Payroll",
  general_admin: "General & Administrative",
  advertising: "Advertising",
  repairs_maintenance: "Repairs & Maintenance",
  utilities: "Utilities",
  licenses_permits: "Licenses & Permits",
  security_contract_services: "Security & Contract Services",
  bank_cc_fees: "Bank & Credit Card Fees",
  professional_services: "Professional Services",
  insurance: "Insurance",
  taxes: "Taxes",
  leases: "Leases",
  fb: "F&B",
  service: "Service",
  parts: "Parts",
  rv_park: "RV Park",
  hospitality_lodging: "Hospitality/Lodging",
  miscellaneous: "Miscellaneous",
};

export const CATEGORY_TIER_OPTIONS = Object.entries(CATEGORY_TIER_LABELS).map(([value, label]) => ({
  value: value as CategoryTier,
  label,
}));

export const REVENUE_COGS_DEPT_OPTIONS = Object.entries(REVENUE_COGS_DEPT_LABELS).map(([value, label]) => ({
  value: value as RevenueCogsDept,
  label,
}));

export const EXPENSE_DEPT_OPTIONS = Object.entries(EXPENSE_DEPT_LABELS).map(([value, label]) => ({
  value: value as ExpenseDept,
  label,
}));

export function getDeptOptionsForTier(tier: CategoryTier | null) {
  if (!tier) return [];
  if (tier === "revenue" || tier === "cogs") {
    return REVENUE_COGS_DEPT_OPTIONS;
  }
  return EXPENSE_DEPT_OPTIONS;
}

/**
 * Returns the full canonical dept vocabulary across BOTH revenue/cogs and
 * expense tiers, deduped by value. Used by reviewer surfaces that render the
 * Department dropdown WITHOUT tier context (the dropdown sits next to a
 * separate Category dropdown that determines tier; the dept dropdown shows
 * the union and the server-side mapping handles the tier dispatch).
 *
 * Phase 2B Session 1 (2026-05-28): introduced to replace the 10-entry
 * hardcoded `DEPARTMENTS` constant in ReviewWizard.tsx and MultiDocumentReview.tsx.
 */
export function getAllDeptOptions(): { value: string; label: string }[] {
  const seen = new Set<string>();
  const result: { value: string; label: string }[] = [];
  for (const opt of [...REVENUE_COGS_DEPT_OPTIONS, ...EXPENSE_DEPT_OPTIONS]) {
    if (!seen.has(opt.value)) {
      seen.add(opt.value);
      result.push(opt);
    }
  }
  return result;
}

/**
 * Look up a dept label by value, searching both revenue/cogs and expense
 * vocabularies. Returns the raw value if no label found (defensive).
 */
export function getAnyDeptLabel(value: string | null | undefined): string {
  if (!value) return "";
  return (REVENUE_COGS_DEPT_LABELS as Record<string, string>)[value]
    ?? (EXPENSE_DEPT_LABELS as Record<string, string>)[value]
    ?? value;
}

export function getDeptLabel(tier: CategoryTier | null, dept: string | null): string {
  if (!tier || !dept) return "";
  if (tier === "revenue" || tier === "cogs") {
    return REVENUE_COGS_DEPT_LABELS[dept as RevenueCogsDept] || dept;
  }
  return EXPENSE_DEPT_LABELS[dept as ExpenseDept] || dept;
}

export const PROFIT_CENTER_TO_DEPT: Record<string, RevenueCogsDept> = {
  pc_fuel_dock: "fuel",
  pc_marina_amenities: "marina_amenities",
  pc_ships_store: "ship_store_retail",
  pc_service: "service",
  pc_parts: "parts",
  pc_boat_club: "boat_club",
  pc_rental_boats: "boat_rentals",
  pc_boat_sales: "boat_sales",
  pc_boat_finance: "boat_finance",
  pc_boat_brokerage: "boat_brokerage",
  pc_commercial_leases: "commercial_leases",
  pc_fb: "fb",
  pc_rv_park: "rv_park",
  pc_hospitality: "hospitality_lodging",
};

export const DEPT_TO_PROFIT_CENTER: Record<string, string> = Object.fromEntries(
  Object.entries(PROFIT_CENTER_TO_DEPT).map(([k, v]) => [v, k])
);

/**
 * Returns the subset of revenue/cogs departments the project's profile
 * EXPLICITLY DECLARES (wizard-checked PCs + the implicit always-on
 * `storage` + `miscellaneous` defaults).
 *
 * Phase 2B Session 1 (2026-05-28) — behavioral note:
 * This function used to drive AVAILABILITY of dropdown options. As of Session
 * 1, availability is ALWAYS the full canonical vocabulary (`REVENUE_COGS_DEPT_OPTIONS`),
 * because mid-mapping a user must be able to choose any valid dept regardless
 * of what the wizard collected. This function is preserved for FUTURE Session 3
 * UI work (highlighting / sort-order / "declared" affordances) but is NOT
 * called by any dropdown today. See `getFilteredDeptOptionsForTier` below.
 *
 * Robust to all shapes observed in persisted data:
 *   - absent (null/undefined)  → returns full vocabulary
 *   - empty object {}          → returns full vocabulary
 *   - legacy string[] shape    → reads bare dept strings + wild "ship_store" variant
 *   - pc_*-keyed object        → reads pc_*.isEnabled
 *
 * All-false shape (object exists but no PCs enabled) returns the storage +
 * miscellaneous default, preserving any user "I turned them all off" intent
 * for future highlighting work.
 */
/**
 * Accepts any of the live-observed shapes (see jsdoc above):
 *   - `Record<string, { isEnabled?: boolean; enabled?: boolean; [key]: unknown }>`
 *     — the canonical wizard write format (sometimes `enabled`, sometimes
 *     `isEnabled`; the function reads both for safety)
 *   - `Array<{ id?: string; label?: string; enabled?: boolean }>` — declared by
 *     client/src/types/modeling.ts:ProjectConfig but never observed in
 *     persisted data. Handled defensively for type compat.
 *   - `string[]` — legacy bare-string shape on older projects (2026-05-28
 *     audit: 2 marina projects).
 *   - `[]` / `{}` / null / undefined — treated as "no declared selection".
 */
export type ProfitCentersInputShape =
  | Record<string, { isEnabled?: boolean; enabled?: boolean; [key: string]: unknown }>
  | Array<{ id?: string; label?: string; enabled?: boolean }>
  | string[]
  | null
  | undefined;

export function getEnabledRevenueCogsDepts(
  profitCenters?: ProfitCentersInputShape
): RevenueCogsDept[] {
  // Phase 2B Session 1 — fall through to full vocabulary for any shape that's
  // effectively "no declared selection" (null/undefined, empty array/object).
  if (!profitCenters) return Object.keys(REVENUE_COGS_DEPT_LABELS) as RevenueCogsDept[];

  if (Array.isArray(profitCenters)) {
    if (profitCenters.length === 0) {
      return Object.keys(REVENUE_COGS_DEPT_LABELS) as RevenueCogsDept[];
    }
    const enabledDepts = new Set<RevenueCogsDept>();
    enabledDepts.add("storage");
    enabledDepts.add("miscellaneous");
    for (const raw of profitCenters) {
      // Legacy string[] shape (e.g. ["storage","fuel","service"]) — treat
      // the strings as bare RevenueCogsDept values. Handle the wild
      // "ship_store" no-suffix variant by normalizing to "ship_store_retail".
      if (typeof raw === 'string') {
        const normalized = (raw === 'ship_store' ? 'ship_store_retail' : raw) as RevenueCogsDept;
        if (normalized in REVENUE_COGS_DEPT_LABELS) enabledDepts.add(normalized);
      } else if (raw && typeof raw === 'object' && raw.enabled && typeof raw.id === 'string') {
        // {id, label, enabled}[] shape — declared in ProjectConfig but never
        // observed in persisted data; handled for type compatibility.
        const id = raw.id;
        const dept = PROFIT_CENTER_TO_DEPT[id] ?? (id in REVENUE_COGS_DEPT_LABELS ? id as RevenueCogsDept : null);
        if (dept) enabledDepts.add(dept);
      }
    }
    return REVENUE_COGS_DEPT_OPTIONS.map(o => o.value).filter(d => enabledDepts.has(d));
  }

  // Empty object → full vocab (config initialized but never populated).
  if (Object.keys(profitCenters).length === 0) {
    return Object.keys(REVENUE_COGS_DEPT_LABELS) as RevenueCogsDept[];
  }

  // pc_id object shape — the wizard's canonical write format.
  const enabledDepts = new Set<RevenueCogsDept>();
  enabledDepts.add("storage");
  enabledDepts.add("miscellaneous");

  for (const [pcId, cfg] of Object.entries(profitCenters)) {
    // Server emits `isEnabled` (crm-routes.ts:16181) but the declared
    // ProjectConfig type uses `enabled`. Read either; this is a known drift
    // that Session 2 will reconcile when the project_profile column lands.
    if (cfg && (cfg.isEnabled === true || cfg.enabled === true)) {
      const dept = PROFIT_CENTER_TO_DEPT[pcId];
      if (dept) enabledDepts.add(dept);
    }
  }

  return REVENUE_COGS_DEPT_OPTIONS
    .map(o => o.value)
    .filter(d => enabledDepts.has(d));
}

/**
 * Returns dropdown options for the given category tier.
 *
 * Phase 2B Session 1 (2026-05-28) — behavioral change:
 * AVAILABILITY is now ALWAYS the full canonical vocabulary for the tier. The
 * `enabledRevenueCogsDepts` parameter is preserved for API back-compat but
 * IGNORED — see Brett's principle that dropdowns must always reflect the full
 * options for the asset class, with the profile driving highlighting/sort
 * (Session 3) rather than availability. Mid-mapping, a user must be able to
 * choose any valid dept regardless of what the wizard collected.
 *
 * The previous wizard-narrowing behavior (filter REVENUE_COGS_DEPT_OPTIONS by
 * enabledRevenueCogsDepts) produced symptoms like the 4-5 entry dropdown
 * Brett observed on Sunset Harbor Village Marina (project 7df94d2a) where the
 * wizard collected only `pc_marina_amenities` + `pc_hospitality` enabled.
 */
export function getFilteredDeptOptionsForTier(
  tier: CategoryTier | null,
  _enabledRevenueCogsDepts?: RevenueCogsDept[]
) {
  // _enabledRevenueCogsDepts intentionally unused (see jsdoc). Parameter kept
  // for API back-compat with existing call sites that pass it; can be removed
  // in Session 3 once consumers migrate to getDeptOptionsForTier directly.
  if (!tier) return [];
  if (tier === "expense") return EXPENSE_DEPT_OPTIONS;
  return REVENUE_COGS_DEPT_OPTIONS;
}
