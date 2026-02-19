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
  | "boat_club" 
  | "boat_rentals" 
  | "boat_sales" 
  | "boat_brokerage" 
  | "boat_finance" 
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
  boat_club: "Boat Club",
  boat_rentals: "Boat Rentals",
  boat_sales: "Boat Sales",
  boat_brokerage: "Boat Brokerage",
  boat_finance: "Boat Finance",
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

export function getEnabledRevenueCogsDepts(
  profitCenters?: Record<string, { isEnabled?: boolean }> | null
): RevenueCogsDept[] {
  if (!profitCenters) return Object.keys(REVENUE_COGS_DEPT_LABELS) as RevenueCogsDept[];

  const enabledDepts = new Set<RevenueCogsDept>();
  enabledDepts.add("storage");
  enabledDepts.add("miscellaneous");

  for (const [pcId, cfg] of Object.entries(profitCenters)) {
    if (cfg.isEnabled) {
      const dept = PROFIT_CENTER_TO_DEPT[pcId];
      if (dept) enabledDepts.add(dept);
    }
  }

  return REVENUE_COGS_DEPT_OPTIONS
    .map(o => o.value)
    .filter(d => enabledDepts.has(d));
}

export function getFilteredDeptOptionsForTier(
  tier: CategoryTier | null,
  enabledRevenueCogsDepts?: RevenueCogsDept[]
) {
  if (!tier) return [];
  if (tier === "expense") return EXPENSE_DEPT_OPTIONS;
  if (enabledRevenueCogsDepts) {
    return REVENUE_COGS_DEPT_OPTIONS.filter(o => enabledRevenueCogsDepts.includes(o.value));
  }
  return REVENUE_COGS_DEPT_OPTIONS;
}
