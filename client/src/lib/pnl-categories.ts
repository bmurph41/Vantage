export type CategoryTier = "revenue" | "cogs" | "expense";

export type RevenueCogsDept = 
  | "storage" 
  | "fuel" 
  | "marina_amenities" 
  | "ship_store_retail" 
  | "service" 
  | "parts" 
  | "third_party_leases" 
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
