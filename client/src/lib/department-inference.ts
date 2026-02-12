export function inferDepartmentClient(subcategory: string, _category?: string): string {
  const lower = subcategory.toLowerCase();
  const cat = (_category || '').toLowerCase();

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

  return 'General';
}
