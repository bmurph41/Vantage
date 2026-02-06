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

  if (lower.includes('slip') || lower.includes('dock') || lower.includes('berth') || lower.includes('mooring') || lower.includes('storage'))
    return 'Storage';
  if (lower.includes('fuel') || lower.includes('gas') || lower.includes('diesel'))
    return 'Fuel';
  if (lower.includes('store') || lower.includes('merchandise') || lower.includes('retail') || lower.includes('chandlery'))
    return "Ship's Store";
  if (lower.includes('service') || lower.includes('repair') || lower.includes('mechanic') || lower.includes('bottom paint'))
    return 'Service';
  if (lower.includes('boat sale') || lower.includes('brokerage'))
    return 'Boat Sales';
  if (lower.includes('payroll') || lower.includes('wage') || lower.includes('salary') || lower.includes('benefit'))
    return 'Payroll';
  if (lower.includes('launch') || lower.includes('haul') || lower.includes('electric') || lower.includes('power') || lower.includes('amenity'))
    return 'Marina & Amenities';

  return 'General';
}

export function departmentToAssumptionKey(department: string): string {
  switch (department) {
    case 'Storage': return 'storage';
    case 'Fuel': return 'fuel_dock';
    case "Ship's Store": return 'ship_store';
    case 'Service': return 'service';
    case 'Boat Sales': return 'boat_sales';
    case 'Boat Brokerage': return 'boat_sales';
    case 'Boat Rentals': return 'rental_boats';
    case 'Boat Club': return 'boat_club';
    case 'Marina & Amenities': return 'transient';
    case 'Commercial': return 'commercial_tenants';
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
