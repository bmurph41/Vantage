import { MARINA_COA_SEED, type CoaSeedItem } from '../scripts/seedMarinaCoa';

const coaLookup: Record<string, CoaSeedItem> = {};
for (const item of MARINA_COA_SEED) {
  coaLookup[item.canonicalKey] = item;
}

export const COA_DEPARTMENT_MAP: Record<string, string> = {};
for (const item of MARINA_COA_SEED) {
  COA_DEPARTMENT_MAP[item.displayName.toLowerCase()] = item.department;
}

export function inferDepartment(subcategory: string, category?: string): string {
  const lower = subcategory.toLowerCase();
  const cat = (category || '').toLowerCase();

  if (COA_DEPARTMENT_MAP[lower]) return COA_DEPARTMENT_MAP[lower];

  for (const item of MARINA_COA_SEED) {
    if (item.keywords) {
      for (const kw of item.keywords) {
        if (lower.includes(kw.toLowerCase())) {
          return item.department;
        }
      }
    }
  }

  if (lower.includes('brokerage') || lower.includes('broker') || lower.includes('finance commission'))
    return 'Boat Brokerage';
  if (lower.includes('new boat') || lower.includes('used boat') || lower.includes('boat sale') || lower.includes('boat purchase') || lower.includes('boats &') || lower.includes('boats and'))
    return 'Boat Sales';
  if ((lower.includes('trade') && !lower.includes('trademark')) || lower.includes('warranty') || lower.includes('extended warranty'))
    return 'Boat Sales';
  if ((cat === 'cogs' || lower.startsWith('cogs')) && (lower.includes('boat') || lower.includes('trailer')))
    return 'Boat Sales';
  if (lower.includes('commission') && !lower.includes('finance commission')) {
    if (cat === 'revenue' || cat === 'cogs' || lower.includes('salesmen') || lower.includes('sales comm'))
      return 'Boat Sales';
  }

  if (lower.includes('slip') || lower.includes('berth') || lower.includes('mooring') || lower.includes('land storage') || lower.includes('winter storage') || lower.includes('summer dock') || lower.includes('annual dock'))
    return 'Storage';
  if (lower.includes('dockage') && !lower.includes('fuel') && !lower.includes('dockside'))
    return 'Storage';
  if (lower.includes('storage') && !lower.includes('store'))
    return 'Storage';

  if (lower.includes('fuel') || lower.includes('diesel'))
    return 'Fuel';
  if (lower.includes('gas') && (cat === 'revenue' || cat === 'cogs' || lower.includes('gas dock') || lower.includes('gas sale')))
    return 'Fuel';

  if (lower.includes('store') || lower.includes('merchandise') || lower.includes('retail') || lower.includes('chandlery'))
    return "Ship's Store";

  if (lower.includes('service') || lower.includes('repair') || lower.includes('mechanic') || lower.includes('bottom paint') || lower.includes('bottom wash') || lower.includes('shrink wrap') || lower.includes('hauling'))
    return 'Service';
  if (lower.includes('parts') && (cat === 'cogs' || lower.includes('parts &')))
    return 'Service';
  if (lower.includes('subcontract'))
    return 'Service';

  if (lower.includes('payroll') || lower.includes('wage') || lower.includes('salari') || lower.includes('salary') || lower.includes('workers comp') || lower.includes('soc security') || lower.includes('soc sec') || lower.includes('medicare'))
    return 'Payroll';
  if (lower.includes('futa') || lower.includes('sui') || lower.includes('disability') || lower.includes('family leave') || lower.includes('medical insurance'))
    return 'Payroll';
  if (lower.includes('benefit') && !lower.includes('membership'))
    return 'Payroll';

  if (lower.includes('launch') || lower.includes('haul') || lower.includes('electric') || lower.includes('power') || lower.includes('amenity') || lower.includes('dockside') || lower.includes('marina income'))
    return 'Marina & Amenities';

  if (lower.includes('commercial lease') || lower.includes('commercial tenant') || lower.includes('commercial rent') || lower.includes('tenant lease') || lower.includes('tenant rent'))
    return 'Commercial Leases';

  // ─── Extended expense department inference ────────────────────────────────
  if (lower.includes('insur')) return 'Insurance';
  if (lower.includes('tax') && !lower.includes('payroll tax')) return 'Taxes';
  if (lower.includes('utilit') || lower.includes('telephone') || lower.includes('propane') || lower.includes('heating') || lower.includes('sewer') || lower.includes('trash') || lower.includes('garbage removal')) return 'Utilities';
  if (lower.includes('professional fee') || lower.includes('legal') || lower.includes('accounting') || lower.includes('audit') || lower.includes(' cpa')) return 'Professional Services';
  if (lower.includes('bank') || lower.includes('merchant fee') || lower.includes('credit card') || lower.includes('dockwa') || lower.includes('processing fee')) return 'Bank & Credit Card Fees';
  if (lower.includes('license') || lower.includes('permit') || lower.includes('registration')) return 'Licenses & Permits';
  if (lower.includes('security') || lower.includes('guard') || lower.includes('surveillance') || lower.includes('alarm') || lower.includes('janitorial') || lower.includes('cleaning service') || lower.includes('outside service') || lower.includes('contract service')) return 'Security & Contract Services';
  if (lower.includes('repair') || lower.includes('maintenance') || lower.includes('r&m')) return 'Repairs & Maintenance';
  if (lower.includes('advertis') || lower.includes('marketing') || lower.includes('promotion') || lower.includes('boat show')) return 'Advertising';
  if (lower.includes('lease') || lower.includes('ground lease') || lower.includes('land lease') || lower.includes('rent expense')) return 'Leases';

  return 'General';
}

const LEGACY_DEPARTMENT_MAP: Record<string, string> = {
  'marina': 'Storage',
  'retail': "Ship's Store",
  'store': "Ship's Store",
  'ship store': "Ship's Store",
  'ships store': "Ship's Store",
  'ship\'s store': "Ship's Store",
  'dock': 'Storage',
  'dockage': 'Storage',
  'amenities': 'Marina & Amenities',
  'marina operations': 'Marina & Amenities',
  'marina & amenities': 'Marina & Amenities',
  'brokerage': 'Boat Brokerage',
  'boat brokerage': 'Boat Brokerage',
  'boats': 'Boat Sales',
  'boat sales': 'Boat Sales',
  'payroll': 'Payroll',
  'fuel': 'Fuel',
  'service': 'Service',
  'storage': 'Storage',
  'general': 'General',
  'commercial leases': 'Commercial Leases',
  'commercial_leases': 'Commercial Leases',
  'commercial': 'Commercial Leases',
  'commercial tenant': 'Commercial Leases',
  'commercial tenants': 'Commercial Leases',
};

const VALID_DEPARTMENTS = new Set([
  'Storage', 'Fuel', "Ship's Store", 'Service', 'Boat Sales',
  'Boat Brokerage', 'Payroll', 'Marina & Amenities', 'General',
  'Commercial Leases',
]);

// ─── Expense department key → display label (from EXPENSE_DEPT_LABELS) ─────────
// These are the keys used in the PLReviewGrid (expenseDeptConfirmed field)
export const EXPENSE_DEPT_KEY_TO_LABEL: Record<string, string> = {
  payroll: 'Payroll',
  general_admin: 'General & Administrative',
  advertising: 'Advertising',
  repairs_maintenance: 'Repairs & Maintenance',
  utilities: 'Utilities',
  licenses_permits: 'Licenses & Permits',
  security_contract_services: 'Security & Contract Services',
  bank_cc_fees: 'Bank & Credit Card Fees',
  professional_services: 'Professional Services',
  insurance: 'Insurance',
  taxes: 'Taxes',
  leases: 'Leases',
  fb: 'F&B',
  service: 'Service',
  parts: 'Parts',
  rv_park: 'RV Park',
  hospitality_lodging: 'Hospitality/Lodging',
  miscellaneous: 'Miscellaneous',
};

// Revenue/COGS department key → display label (from REVENUE_COGS_DEPT_LABELS)
export const REVENUE_COGS_DEPT_KEY_TO_LABEL: Record<string, string> = {
  storage: 'Storage',
  fuel: 'Fuel',
  marina_amenities: 'Marina & Amenities',
  ship_store_retail: "Ship's Store",
  service: 'Service',
  parts: 'Parts',
  third_party_leases: 'Third Party Leases',
  commercial_leases: 'Commercial Leases',
  boat_club: 'Boat Club',
  boat_rentals: 'Boat Rentals',
  boat_sales: 'Boat Sales',
  boat_brokerage: 'Boat Brokerage',
  boat_finance: 'Boat Finance',
  fb: 'F&B',
  rv_park: 'RV Park',
  hospitality_lodging: 'Hospitality/Lodging',
  miscellaneous: 'Miscellaneous',
};

/**
 * Translate a dept key (from expenseDeptConfirmed / revenueCogsDeptConfirmed)
 * to its display label for storage in modelingActuals.department.
 *
 * e.g. 'taxes' → 'Taxes', 'repairs_maintenance' → 'Repairs & Maintenance'
 *      'storage' → 'Storage', 'bank_cc_fees' → 'Bank & Credit Card Fees'
 */
export function deptKeyToLabel(key: string, tier?: string): string {
  if (!key) return 'General';
  // Try expense map first (most common for expense items)
  if (EXPENSE_DEPT_KEY_TO_LABEL[key]) return EXPENSE_DEPT_KEY_TO_LABEL[key];
  // Try revenue/cogs map
  if (REVENUE_COGS_DEPT_KEY_TO_LABEL[key]) return REVENUE_COGS_DEPT_KEY_TO_LABEL[key];
  // Already a display label? Pass through
  if (VALID_DEPARTMENTS.has(key)) return key;
  // Titlecase fallback for unknown keys
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function normalizeDepartment(dept: string): string {
  if (!dept) return 'General';
  const trimmed = dept.trim();
  // Already a valid display-label department
  if (VALID_DEPARTMENTS.has(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  // Expense dept key (e.g. 'taxes', 'bank_cc_fees')
  if (EXPENSE_DEPT_KEY_TO_LABEL[lower]) return EXPENSE_DEPT_KEY_TO_LABEL[lower];
  // Revenue/cogs dept key (e.g. 'storage', 'fuel')
  if (REVENUE_COGS_DEPT_KEY_TO_LABEL[lower]) return REVENUE_COGS_DEPT_KEY_TO_LABEL[lower];
  // Legacy map
  if (LEGACY_DEPARTMENT_MAP[lower]) return LEGACY_DEPARTMENT_MAP[lower];
  return 'General';
}

const VALID_BUCKETS = new Set(['Revenue', 'COGS', 'Expense']);

export function normalizeBucket(bucket: string): string {
  if (!bucket) return 'Expense';
  const trimmed = bucket.trim();
  if (VALID_BUCKETS.has(trimmed)) return trimmed;
  const lower = trimmed.toLowerCase();
  if (lower === 'revenue' || lower === 'income') return 'Revenue';
  if (lower === 'cogs' || lower === 'cost of goods' || lower === 'cost of goods sold') return 'COGS';
  if (lower === 'expense' || lower === 'expenses' || lower === 'opex') return 'Expense';
  return 'Expense';
}

export function departmentToAssumptionKey(department: string): string {
  switch (department) {
    case 'Storage': return 'storage';
    case 'Fuel': return 'fuel_dock';
    case "Ship's Store": return 'ship_store';
    case 'Service': return 'service';
    case 'Boat Sales': return 'boat_sales';
    case 'Boat Brokerage': return 'boat_brokerage';
    case 'Boat Rentals': return 'rental_boats';
    case 'Boat Club': return 'boat_club';
    case 'Boat Finance': return 'boat_finance';
    case 'Marina & Amenities': return 'marina_amenities';
    case 'Commercial': return 'commercial_tenants';
    case 'Commercial Leases': return 'commercial_leases';
    case 'F&B': return 'restaurant';
    case 'Restaurant': return 'restaurant';
    case 'RV Park': return 'rv_sites';
    case 'Hospitality': return 'hospitality';
    case 'Parts': return 'parts';
    case 'Miscellaneous': return 'misc_revenue';
    case 'Payroll': return 'payroll';
    case 'General': return 'g_and_a';
    default: return 'g_and_a';
  }
}

export function storageSubcategoryToTypeKey(subcategory: string): string | undefined {
  const lower = subcategory.toLowerCase();
  if (lower.includes('wet slip') || lower.includes('slip rental') || lower.includes('dockage') || lower.includes('berth'))
    return 'wet_slips';
  if (lower.includes('dry') && lower.includes('indoor'))
    return 'dry_racks_indoor';
  if (lower.includes('dry') && lower.includes('outdoor'))
    return 'dry_racks_outdoor';
  if (lower.includes('dry') || lower.includes('rack'))
    return 'dry_racks_indoor';
  if (lower.includes('covered'))
    return 'carports';
  if (lower.includes('trailer'))
    return 'boats_on_trailers';
  if (lower.includes('transient') || lower.includes('visitor') || lower.includes('guest'))
    return 'transient';
  if (lower.includes('live aboard'))
    return 'houseboats';
  if (lower.includes('mooring'))
    return 'moorings';
  if (lower.includes('lift'))
    return 'lift_slips';
  if (lower.includes('land'))
    return 'land_storage';
  return undefined;
}

export function getDepartmentFromSubcategory(subcategory: string): string | undefined {
  for (const item of MARINA_COA_SEED) {
    if (item.displayName === subcategory) {
      return item.department;
    }
  }
  return undefined;
}

export function getDepartmentFromCoaCode(coaCode: string): string | undefined {
  return coaLookup[coaCode]?.department;
}

export function sectionToCategory(section: string): string {
  switch (section) {
    case 'revenue': return 'Revenue';
    case 'cogs': return 'COGS';
    case 'expense': return 'Expenses';
    case 'payroll': return 'Expenses';
    case 'other': return 'Expenses';
    default: return 'Expenses';
  }
}

export function majorGroupToCategory(majorGroup: string): string {
  switch (majorGroup) {
    case 'Revenue': return 'Revenue';
    case 'COGS': return 'COGS';
    case 'OpEx': return 'Expenses';
    case 'Payroll': return 'Expenses';
    default: return 'Expenses';
  }
}

// ─── Category/tier correction based on department ────────────────────────────
// When the AI mis-tiers a line item, this overrides to the correct category.
// e.g. "Repairs & Service" department=Service but tier=expense → should be Revenue
const DEPT_FORCES_CATEGORY: Record<string, string> = {
  // Revenue departments — these should NEVER be Expenses
  'Service':           'Revenue',
  "Ship's Store":      'Revenue',
  'Storage':           'Revenue',
  'Fuel':              'Revenue',
  'Boat Sales':        'Revenue',
  'Boat Brokerage':    'Revenue',
  'Boat Rentals':      'Revenue',
  'Boat Club':         'Revenue',
  'Marina & Amenities':'Revenue',
  'Commercial Leases': 'Revenue',
};

// COGS line items that are commonly mis-tiered as Expenses
const LINE_ITEM_FORCES_COGS = [
  'gas purchase', 'fuel purchase', 'diesel purchase', 'fuel cost',
  'sub-contract', 'subcontract', 'sub contract',
  'shop supplies', 'parts & supplies', 'parts and supplies', 'parts & materials',
  'cost of goods', 'cogs',
];

export function correctCategoryForDepartment(
  category: string,
  department: string,
  lineItemDescription: string
): string {
  // Check if this line item is clearly COGS
  const lower = (lineItemDescription || '').toLowerCase();
  for (const kw of LINE_ITEM_FORCES_COGS) {
    if (lower.includes(kw)) return 'COGS';
  }
  // Check if department forces a specific category
  if (DEPT_FORCES_CATEGORY[department]) {
    // Only override if currently wrong (don't flip Revenue→Revenue)
    const forced = DEPT_FORCES_CATEGORY[department];
    if (category === 'Expenses' && forced === 'Revenue') return forced;
  }
  return category;
}
