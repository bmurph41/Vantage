import { db } from '../db';
import { eq } from 'drizzle-orm';
import {
  taxonomyPacks,
  coaProfitCenters,
  coaSubCenters,
  coaCanonicalAccounts,
  coaGlobalAliases,
  coaMappingRules,
} from '@shared/schema';

function normalizeLabel(raw: string): string {
  return raw.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function seedMarinaTaxonomyPack(): Promise<string> {
  const existing = await db.select().from(taxonomyPacks).where(eq(taxonomyPacks.assetClass, 'MARINA')).limit(1);
  if (existing.length > 0) {
    console.log('[COA Seed] Marina taxonomy pack already exists, skipping seed.');
    return existing[0].id;
  }

  console.log('[COA Seed] Seeding Marina taxonomy pack...');

  const [pack] = await db.insert(taxonomyPacks).values({
    assetClass: 'MARINA',
    name: 'MarinaMatch Marina COA v1',
    version: '1.0.0',
    isActive: true,
  }).returning();

  const packId = pack.id;

  const pcDefs = [
    { code: 'PC-100', name: 'Storage', description: 'All boat storage revenue and COGS', sortOrder: 10 },
    { code: 'PC-200', name: 'Fuel', description: 'Fuel dock operations', sortOrder: 20 },
    { code: 'PC-300', name: 'Service', description: 'Service yard, mechanical, haul-out', sortOrder: 30 },
    { code: 'PC-350', name: 'Parts', description: 'Parts sales and inventory', sortOrder: 35 },
    { code: 'PC-400', name: 'Retail', description: 'Ship store and retail', sortOrder: 40 },
    { code: 'PC-500', name: 'Commercial Leases', description: 'Commercial tenant leases', sortOrder: 50 },
    { code: 'PC-550', name: 'Parking', description: 'Parking lot and vehicle storage', sortOrder: 55 },
    { code: 'PC-600', name: 'Rentals', description: 'Boat rentals and charters', sortOrder: 60 },
    { code: 'PC-650', name: 'Boat Club', description: 'Membership-based boat club', sortOrder: 65 },
    { code: 'PC-700', name: 'Boat Sales', description: 'New and used boat sales', sortOrder: 70 },
    { code: 'PC-750', name: 'Finance & F&I', description: 'Boat financing and insurance products', sortOrder: 75 },
    { code: 'PC-800', name: 'Brokerage', description: 'Boat brokerage commissions', sortOrder: 80 },
    { code: 'PC-850', name: 'Events & Charters', description: 'Events, parties, charter operations', sortOrder: 85 },
    { code: 'PC-900', name: 'Hospitality', description: 'Restaurant, bar, F&B operations', sortOrder: 90 },
    { code: 'PC-950', name: 'Amenities', description: 'Marina amenities, pool, lounge, laundry', sortOrder: 95 },
    { code: 'PC-999', name: 'General & Administrative', description: 'Overhead, admin, unallocated', sortOrder: 999 },
  ];

  const pcInserted = await db.insert(coaProfitCenters).values(
    pcDefs.map(pc => ({ packId, ...pc }))
  ).returning();

  const pcMap = new Map<string, string>();
  for (const pc of pcInserted) {
    pcMap.set(pc.code, pc.id);
  }

  const scDefs = [
    { pcCode: 'PC-100', code: 'SC-110', name: 'Wet Slips', description: 'In-water wet slip storage', sortOrder: 10 },
    { pcCode: 'PC-100', code: 'SC-120', name: 'Dry Racks – Indoor', description: 'Indoor dry rack storage', sortOrder: 20 },
    { pcCode: 'PC-100', code: 'SC-130', name: 'Dry Racks – Outdoor', description: 'Outdoor dry rack storage', sortOrder: 30 },
    { pcCode: 'PC-100', code: 'SC-140', name: 'Moorings', description: 'Mooring balls and fields', sortOrder: 40 },
    { pcCode: 'PC-100', code: 'SC-150', name: 'Land Storage', description: 'Yard, trailer, outdoor storage', sortOrder: 50 },
    { pcCode: 'PC-100', code: 'SC-160', name: 'Lift Slips', description: 'Lift-equipped slips', sortOrder: 60 },
    { pcCode: 'PC-100', code: 'SC-170', name: 'Liveaboards', description: 'Liveaboard slip surcharges', sortOrder: 70 },
    { pcCode: 'PC-200', code: 'SC-210', name: 'Gas', description: 'Gasoline fuel sales', sortOrder: 10 },
    { pcCode: 'PC-200', code: 'SC-220', name: 'Diesel', description: 'Diesel fuel sales', sortOrder: 20 },
    { pcCode: 'PC-200', code: 'SC-230', name: 'Valvtect', description: 'Valvtect marine fuel', sortOrder: 30 },
    { pcCode: 'PC-300', code: 'SC-310', name: 'Mechanical', description: 'Engine and mechanical repair', sortOrder: 10 },
    { pcCode: 'PC-300', code: 'SC-320', name: 'Fiberglass & Paint', description: 'Hull and cosmetic work', sortOrder: 20 },
    { pcCode: 'PC-300', code: 'SC-330', name: 'Haul-out', description: 'Travel lift, haul, launch', sortOrder: 30 },
    { pcCode: 'PC-300', code: 'SC-340', name: 'Bottom Paint', description: 'Bottom paint services', sortOrder: 40 },
    { pcCode: 'PC-300', code: 'SC-350', name: 'Winterization', description: 'Winterization and shrink-wrap', sortOrder: 50 },
    { pcCode: 'PC-400', code: 'SC-410', name: 'Chandlery', description: 'Marine hardware, accessories', sortOrder: 10 },
    { pcCode: 'PC-400', code: 'SC-420', name: 'Apparel', description: 'Clothing and apparel', sortOrder: 20 },
    { pcCode: 'PC-400', code: 'SC-430', name: 'Convenience', description: 'Snacks, beverages, ice', sortOrder: 30 },
  ];

  const scInserted = await db.insert(coaSubCenters).values(
    scDefs.map(sc => ({
      packId,
      profitCenterId: pcMap.get(sc.pcCode)!,
      code: sc.code,
      name: sc.name,
      description: sc.description,
      sortOrder: sc.sortOrder,
    }))
  ).returning();

  const scMap = new Map<string, string>();
  for (const sc of scInserted) {
    scMap.set(sc.code, sc.id);
  }

  const acctDefs: Array<{
    pcCode: string;
    scCode?: string;
    code: string;
    statementType: 'REVENUE' | 'COGS' | 'OPEX' | 'OTHER';
    name: string;
    description: string;
    keywords: string[];
    sortOrder: number;
  }> = [
    { pcCode: 'PC-100', scCode: 'SC-110', code: 'REV-1101', statementType: 'REVENUE', name: 'Annual Wet Slip Rent', description: 'Annual wet slip lease revenue', keywords: ['dockage', 'slip rent', 'wet slip', 'berth', 'dock rental', 'slip fee', 'annual dockage'], sortOrder: 10 },
    { pcCode: 'PC-100', scCode: 'SC-110', code: 'REV-1102', statementType: 'REVENUE', name: 'Monthly Wet Slip Rent', description: 'Month-to-month wet slip revenue', keywords: ['monthly slip', 'transient dock', 'short-term slip'], sortOrder: 20 },
    { pcCode: 'PC-100', scCode: 'SC-110', code: 'REV-1103', statementType: 'REVENUE', name: 'Transient Dockage', description: 'Transient and visiting vessel dockage', keywords: ['transient', 'visiting', 'guest dock', 'daily dock'], sortOrder: 30 },
    { pcCode: 'PC-100', scCode: 'SC-110', code: 'REV-1104', statementType: 'REVENUE', name: 'Electric Revenue', description: 'Electric metering charges to tenants', keywords: ['electric', 'shore power', 'power charge', 'metered electric'], sortOrder: 40 },
    { pcCode: 'PC-100', scCode: 'SC-120', code: 'REV-1201', statementType: 'REVENUE', name: 'Dry Rack Storage – Indoor', description: 'Indoor dry rack storage fees', keywords: ['dry storage indoor', 'rack indoor', 'indoor dry'], sortOrder: 50 },
    { pcCode: 'PC-100', scCode: 'SC-130', code: 'REV-1301', statementType: 'REVENUE', name: 'Dry Rack Storage – Outdoor', description: 'Outdoor dry rack storage fees', keywords: ['dry storage outdoor', 'rack outdoor', 'outdoor dry'], sortOrder: 60 },
    { pcCode: 'PC-100', scCode: 'SC-140', code: 'REV-1401', statementType: 'REVENUE', name: 'Mooring Revenue', description: 'Mooring field fees', keywords: ['mooring', 'mooring ball', 'mooring field'], sortOrder: 70 },
    { pcCode: 'PC-100', scCode: 'SC-150', code: 'REV-1501', statementType: 'REVENUE', name: 'Land Storage Revenue', description: 'Yard and trailer storage fees', keywords: ['land storage', 'yard storage', 'trailer storage', 'boat on trailer'], sortOrder: 80 },
    { pcCode: 'PC-100', scCode: 'SC-160', code: 'REV-1601', statementType: 'REVENUE', name: 'Lift Slip Revenue', description: 'Lift-equipped slip fees', keywords: ['lift slip', 'boat lift'], sortOrder: 90 },
    { pcCode: 'PC-100', scCode: 'SC-170', code: 'REV-1701', statementType: 'REVENUE', name: 'Liveaboard Surcharge', description: 'Liveaboard premium', keywords: ['liveaboard', 'live aboard', 'residential'], sortOrder: 100 },
    { pcCode: 'PC-100', code: 'COGS-1001', statementType: 'COGS', name: 'Storage Direct Costs', description: 'Direct costs allocated to storage', keywords: ['storage cogs', 'dock maintenance', 'slip maintenance'], sortOrder: 110 },
    { pcCode: 'PC-200', scCode: 'SC-210', code: 'REV-2101', statementType: 'REVENUE', name: 'Gas Fuel Sales', description: 'Gasoline fuel revenue', keywords: ['gas', 'gasoline', 'unleaded', 'gas fuel'], sortOrder: 10 },
    { pcCode: 'PC-200', scCode: 'SC-220', code: 'REV-2201', statementType: 'REVENUE', name: 'Diesel Fuel Sales', description: 'Diesel fuel revenue', keywords: ['diesel', 'diesel fuel'], sortOrder: 20 },
    { pcCode: 'PC-200', scCode: 'SC-230', code: 'REV-2301', statementType: 'REVENUE', name: 'Valvtect Fuel Sales', description: 'Valvtect branded fuel', keywords: ['valvtect', 'valv-tect'], sortOrder: 30 },
    { pcCode: 'PC-200', code: 'COGS-2001', statementType: 'COGS', name: 'Fuel COGS', description: 'Cost of fuel purchased', keywords: ['fuel cost', 'fuel cogs', 'petroleum cost', 'gas cost', 'diesel cost', 'fuel purchase'], sortOrder: 40 },
    { pcCode: 'PC-200', code: 'REV-2401', statementType: 'REVENUE', name: 'Fuel Delivery Surcharge', description: 'Fuel delivery and pump-out fees', keywords: ['pump out', 'pumpout', 'fuel delivery', 'fuel surcharge'], sortOrder: 50 },
    { pcCode: 'PC-300', scCode: 'SC-310', code: 'REV-3101', statementType: 'REVENUE', name: 'Mechanical Service Revenue', description: 'Engine and mechanical repair revenue', keywords: ['mechanical', 'engine repair', 'service labor', 'tech labor', 'mechanic'], sortOrder: 10 },
    { pcCode: 'PC-300', scCode: 'SC-320', code: 'REV-3201', statementType: 'REVENUE', name: 'Fiberglass & Paint Revenue', description: 'Hull, fiberglass and paint work', keywords: ['fiberglass', 'gelcoat', 'paint', 'hull repair'], sortOrder: 20 },
    { pcCode: 'PC-300', scCode: 'SC-330', code: 'REV-3301', statementType: 'REVENUE', name: 'Haul-out Revenue', description: 'Travel lift, haul, launch fees', keywords: ['haul', 'haulout', 'haul-out', 'launch', 'travel lift', 'travelift', 'crane'], sortOrder: 30 },
    { pcCode: 'PC-300', scCode: 'SC-340', code: 'REV-3401', statementType: 'REVENUE', name: 'Bottom Paint Revenue', description: 'Bottom painting service revenue', keywords: ['bottom paint', 'antifouling', 'hull paint'], sortOrder: 40 },
    { pcCode: 'PC-300', scCode: 'SC-350', code: 'REV-3501', statementType: 'REVENUE', name: 'Winterization Revenue', description: 'Winterization and shrink-wrap', keywords: ['winterize', 'winterization', 'shrink wrap', 'shrinkwrap', 'decommission'], sortOrder: 50 },
    { pcCode: 'PC-300', code: 'COGS-3001', statementType: 'COGS', name: 'Service COGS', description: 'Parts and materials for service', keywords: ['service parts', 'service cogs', 'repair parts'], sortOrder: 60 },
    { pcCode: 'PC-350', code: 'REV-3510', statementType: 'REVENUE', name: 'Parts Sales Revenue', description: 'Marine parts retail sales', keywords: ['parts sales', 'marine parts'], sortOrder: 10 },
    { pcCode: 'PC-350', code: 'COGS-3501', statementType: 'COGS', name: 'Parts COGS', description: 'Cost of parts inventory', keywords: ['parts cost', 'parts cogs', 'parts inventory'], sortOrder: 20 },
    { pcCode: 'PC-400', scCode: 'SC-410', code: 'REV-4101', statementType: 'REVENUE', name: 'Ship Store Sales', description: "Ship's store retail revenue", keywords: ['ship store', 'ships store', 'chandlery', 'marine store', 'retail store'], sortOrder: 10 },
    { pcCode: 'PC-400', code: 'COGS-4001', statementType: 'COGS', name: 'Retail COGS', description: 'Cost of retail merchandise', keywords: ['retail cogs', 'store cogs', 'merchandise cost', 'inventory cost'], sortOrder: 20 },
    { pcCode: 'PC-500', code: 'REV-5001', statementType: 'REVENUE', name: 'Commercial Lease Revenue', description: 'Commercial tenant lease income', keywords: ['commercial lease', 'tenant rent', 'commercial rent', 'office rent', 'retail rent', 'leased space'], sortOrder: 10 },
    { pcCode: 'PC-500', code: 'REV-5002', statementType: 'REVENUE', name: 'CAM Recovery', description: 'Common area maintenance recovery', keywords: ['cam', 'common area', 'cam recovery', 'cam charges'], sortOrder: 20 },
    { pcCode: 'PC-550', code: 'REV-5501', statementType: 'REVENUE', name: 'Parking Revenue', description: 'Parking lot and garage income', keywords: ['parking', 'parking lot', 'vehicle storage', 'car storage'], sortOrder: 10 },
    { pcCode: 'PC-600', code: 'REV-6001', statementType: 'REVENUE', name: 'Boat Rental Revenue', description: 'Boat rental income', keywords: ['boat rental', 'charter', 'rental boat', 'watercraft rental'], sortOrder: 10 },
    { pcCode: 'PC-650', code: 'REV-6501', statementType: 'REVENUE', name: 'Boat Club Membership', description: 'Boat club monthly dues and fees', keywords: ['boat club', 'membership dues', 'club dues', 'club membership'], sortOrder: 10 },
    { pcCode: 'PC-700', code: 'REV-7001', statementType: 'REVENUE', name: 'Boat Sales Revenue', description: 'New and used boat sales', keywords: ['boat sale', 'vessel sale', 'new boat', 'used boat'], sortOrder: 10 },
    { pcCode: 'PC-700', code: 'COGS-7001', statementType: 'COGS', name: 'Boat Sales COGS', description: 'Cost of boats sold', keywords: ['boat cost', 'boat cogs', 'vessel cost'], sortOrder: 20 },
    { pcCode: 'PC-750', code: 'REV-7501', statementType: 'REVENUE', name: 'F&I Revenue', description: 'Finance and insurance commissions', keywords: ['f&i', 'finance income', 'insurance commission', 'financing fee'], sortOrder: 10 },
    { pcCode: 'PC-800', code: 'REV-8001', statementType: 'REVENUE', name: 'Brokerage Commission', description: 'Boat brokerage commissions', keywords: ['brokerage', 'broker commission', 'brokerage fee'], sortOrder: 10 },
    { pcCode: 'PC-850', code: 'REV-8501', statementType: 'REVENUE', name: 'Event Revenue', description: 'Events, parties, marina events', keywords: ['event', 'party', 'function', 'boat show'], sortOrder: 10 },
    { pcCode: 'PC-900', code: 'REV-9001', statementType: 'REVENUE', name: 'F&B Revenue', description: 'Restaurant and bar revenue', keywords: ['restaurant', 'food', 'beverage', 'bar', 'grill', 'cafe', 'f&b'], sortOrder: 10 },
    { pcCode: 'PC-900', code: 'COGS-9001', statementType: 'COGS', name: 'F&B COGS', description: 'Food and beverage cost', keywords: ['food cost', 'beverage cost', 'f&b cogs'], sortOrder: 20 },
    { pcCode: 'PC-950', code: 'REV-9501', statementType: 'REVENUE', name: 'Amenity Revenue', description: 'Pool, lounge, laundry, Wi-Fi fees', keywords: ['amenity', 'pool', 'lounge', 'laundry', 'wifi', 'shower'], sortOrder: 10 },
    { pcCode: 'PC-999', code: 'OPEX-9001', statementType: 'OPEX', name: 'Payroll & Benefits', description: 'Staff compensation and benefits', keywords: ['payroll', 'salary', 'wage', 'compensation', 'benefits', 'health insurance', 'fica', 'workers comp'], sortOrder: 10 },
    { pcCode: 'PC-999', code: 'OPEX-9002', statementType: 'OPEX', name: 'Utilities', description: 'Electric, water, sewer, gas', keywords: ['utility', 'utilities', 'electric', 'water', 'sewer', 'power', 'gas utility'], sortOrder: 20 },
    { pcCode: 'PC-999', code: 'OPEX-9003', statementType: 'OPEX', name: 'Insurance', description: 'Property and liability insurance', keywords: ['insurance', 'liability', 'property insurance', 'gl insurance'], sortOrder: 30 },
    { pcCode: 'PC-999', code: 'OPEX-9004', statementType: 'OPEX', name: 'Property Taxes', description: 'Real estate and personal property taxes', keywords: ['property tax', 'real estate tax', 'ad valorem'], sortOrder: 40 },
    { pcCode: 'PC-999', code: 'OPEX-9005', statementType: 'OPEX', name: 'Repairs & Maintenance', description: 'General R&M', keywords: ['repair', 'maintenance', 'r&m', 'repairs and maintenance'], sortOrder: 50 },
    { pcCode: 'PC-999', code: 'OPEX-9006', statementType: 'OPEX', name: 'Marketing & Advertising', description: 'Marketing, ads, promotions', keywords: ['marketing', 'advertising', 'promotion', 'ads', 'media'], sortOrder: 60 },
    { pcCode: 'PC-999', code: 'OPEX-9007', statementType: 'OPEX', name: 'Professional Fees', description: 'Legal, accounting, consulting', keywords: ['legal', 'accounting', 'professional', 'consulting', 'attorney', 'cpa'], sortOrder: 70 },
    { pcCode: 'PC-999', code: 'OPEX-9008', statementType: 'OPEX', name: 'Office & Administrative', description: 'Office supplies, admin costs', keywords: ['office', 'admin', 'supplies', 'postage', 'printing'], sortOrder: 80 },
    { pcCode: 'PC-999', code: 'OPEX-9009', statementType: 'OPEX', name: 'Technology & Software', description: 'IT, software, marina management systems', keywords: ['software', 'technology', 'it', 'computer', 'marina management'], sortOrder: 90 },
    { pcCode: 'PC-999', code: 'OPEX-9010', statementType: 'OPEX', name: 'Dredging & Marine Services', description: 'Dredging, environmental compliance', keywords: ['dredge', 'dredging', 'marine service', 'environmental'], sortOrder: 100 },
    { pcCode: 'PC-999', code: 'OPEX-9011', statementType: 'OPEX', name: 'Security', description: 'Security services and systems', keywords: ['security', 'guard', 'surveillance', 'cameras'], sortOrder: 110 },
    { pcCode: 'PC-999', code: 'OPEX-9012', statementType: 'OPEX', name: 'Waste & Environmental', description: 'Waste removal, environmental fees', keywords: ['waste', 'trash', 'garbage', 'environmental fee', 'disposal'], sortOrder: 120 },
    { pcCode: 'PC-999', code: 'OPEX-9013', statementType: 'OPEX', name: 'Taxes & Licenses', description: 'Business taxes and permits', keywords: ['tax', 'license', 'permit', 'franchise tax'], sortOrder: 130 },
    { pcCode: 'PC-999', code: 'OPEX-9014', statementType: 'OPEX', name: 'Contract Labor', description: 'Contract and temporary labor', keywords: ['contract labor', 'contractor', 'temp labor', 'subcontractor'], sortOrder: 140 },
    { pcCode: 'PC-999', code: 'OPEX-9015', statementType: 'OPEX', name: 'Rent & Lease Expense', description: 'Facility and equipment leases', keywords: ['rent', 'lease expense', 'equipment lease', 'land lease'], sortOrder: 150 },
    { pcCode: 'PC-999', code: 'OPEX-9016', statementType: 'OPEX', name: 'Depreciation & Amortization', description: 'D&A on fixed assets', keywords: ['depreciation', 'amortization', 'd&a'], sortOrder: 160 },
    { pcCode: 'PC-999', code: 'OPEX-9017', statementType: 'OPEX', name: 'Interest Expense', description: 'Loan and debt interest', keywords: ['interest', 'interest expense', 'loan interest', 'debt service'], sortOrder: 170 },
    { pcCode: 'PC-999', code: 'OPEX-9018', statementType: 'OPEX', name: 'Management Fee', description: 'Third-party management fees', keywords: ['management fee', 'property management', 'management company'], sortOrder: 180 },
    { pcCode: 'PC-100', code: 'REV-1105', statementType: 'REVENUE', name: 'Launch / Ramp Fees', description: 'Boat launch and ramp access fees', keywords: ['launch', 'ramp', 'launch fee', 'boat ramp'], sortOrder: 105 },
  ];

  const acctInserted = await db.insert(coaCanonicalAccounts).values(
    acctDefs.map(a => ({
      packId,
      profitCenterId: pcMap.get(a.pcCode)!,
      subCenterId: a.scCode ? scMap.get(a.scCode) || null : null,
      code: a.code,
      statementType: a.statementType,
      name: a.name,
      description: a.description,
      keywords: a.keywords,
      isActive: true,
      sortOrder: a.sortOrder,
    }))
  ).returning();

  const acctMap = new Map<string, string>();
  for (const a of acctInserted) {
    acctMap.set(a.code, a.id);
  }

  const aliasDefs: Array<{ rawLabel: string; acctCode: string; confidence?: number }> = [
    { rawLabel: 'Dockage Income', acctCode: 'REV-1101' },
    { rawLabel: 'Dockage Revenue', acctCode: 'REV-1101' },
    { rawLabel: 'Slip Rental Income', acctCode: 'REV-1101' },
    { rawLabel: 'Wet Slip Revenue', acctCode: 'REV-1101' },
    { rawLabel: 'Dock Rental', acctCode: 'REV-1101' },
    { rawLabel: 'Berth Revenue', acctCode: 'REV-1101' },
    { rawLabel: 'Annual Slip Fees', acctCode: 'REV-1101' },
    { rawLabel: 'Dockage - Annual', acctCode: 'REV-1101' },
    { rawLabel: 'Dock Fees', acctCode: 'REV-1101' },
    { rawLabel: 'Transient Dock Revenue', acctCode: 'REV-1103' },
    { rawLabel: 'Guest Dockage', acctCode: 'REV-1103' },
    { rawLabel: 'Transient Dockage', acctCode: 'REV-1103' },
    { rawLabel: 'Daily Dockage', acctCode: 'REV-1103' },
    { rawLabel: 'Electric Revenue', acctCode: 'REV-1104' },
    { rawLabel: 'Shore Power Income', acctCode: 'REV-1104' },
    { rawLabel: 'Metered Electric', acctCode: 'REV-1104' },
    { rawLabel: 'Dry Storage Revenue', acctCode: 'REV-1201' },
    { rawLabel: 'Rack Storage', acctCode: 'REV-1201' },
    { rawLabel: 'Indoor Storage', acctCode: 'REV-1201' },
    { rawLabel: 'Outdoor Dry Storage', acctCode: 'REV-1301' },
    { rawLabel: 'Mooring Revenue', acctCode: 'REV-1401' },
    { rawLabel: 'Mooring Fees', acctCode: 'REV-1401' },
    { rawLabel: 'Land Storage', acctCode: 'REV-1501' },
    { rawLabel: 'Yard Storage', acctCode: 'REV-1501' },
    { rawLabel: 'Trailer Storage', acctCode: 'REV-1501' },
    { rawLabel: 'Liveaboard Income', acctCode: 'REV-1701' },
    { rawLabel: 'Launch Fees', acctCode: 'REV-1105' },
    { rawLabel: 'Boat Ramp Fees', acctCode: 'REV-1105' },
    { rawLabel: 'Fuel Sales', acctCode: 'REV-2101' },
    { rawLabel: 'Gas Sales', acctCode: 'REV-2101' },
    { rawLabel: 'Gasoline Revenue', acctCode: 'REV-2101' },
    { rawLabel: 'Diesel Sales', acctCode: 'REV-2201' },
    { rawLabel: 'Diesel Fuel Revenue', acctCode: 'REV-2201' },
    { rawLabel: 'Valvtect Revenue', acctCode: 'REV-2301' },
    { rawLabel: 'Fuel Cost', acctCode: 'COGS-2001' },
    { rawLabel: 'Fuel COGS', acctCode: 'COGS-2001' },
    { rawLabel: 'Cost of Fuel', acctCode: 'COGS-2001' },
    { rawLabel: 'Fuel Purchases', acctCode: 'COGS-2001' },
    { rawLabel: 'Petroleum Cost', acctCode: 'COGS-2001' },
    { rawLabel: 'Service Revenue', acctCode: 'REV-3101' },
    { rawLabel: 'Mechanical Service', acctCode: 'REV-3101' },
    { rawLabel: 'Service Labor', acctCode: 'REV-3101' },
    { rawLabel: 'Haul-out Revenue', acctCode: 'REV-3301' },
    { rawLabel: 'Travel Lift Revenue', acctCode: 'REV-3301' },
    { rawLabel: 'Travelift Income', acctCode: 'REV-3301' },
    { rawLabel: 'Bottom Paint Revenue', acctCode: 'REV-3401' },
    { rawLabel: 'Winterization Revenue', acctCode: 'REV-3501' },
    { rawLabel: 'Shrink Wrap Revenue', acctCode: 'REV-3501' },
    { rawLabel: 'Ship Store Sales', acctCode: 'REV-4101' },
    { rawLabel: "Ship's Store Revenue", acctCode: 'REV-4101' },
    { rawLabel: 'Chandlery Sales', acctCode: 'REV-4101' },
    { rawLabel: 'Retail Sales', acctCode: 'REV-4101' },
    { rawLabel: 'Store Revenue', acctCode: 'REV-4101' },
    { rawLabel: 'Retail COGS', acctCode: 'COGS-4001' },
    { rawLabel: 'Merchandise Cost', acctCode: 'COGS-4001' },
    { rawLabel: 'Store COGS', acctCode: 'COGS-4001' },
    { rawLabel: 'Commercial Lease Income', acctCode: 'REV-5001' },
    { rawLabel: 'Tenant Rent', acctCode: 'REV-5001' },
    { rawLabel: 'Parking Revenue', acctCode: 'REV-5501' },
    { rawLabel: 'Boat Rental Income', acctCode: 'REV-6001' },
    { rawLabel: 'Charter Revenue', acctCode: 'REV-6001' },
    { rawLabel: 'Boat Club Revenue', acctCode: 'REV-6501' },
    { rawLabel: 'Membership Dues', acctCode: 'REV-6501' },
    { rawLabel: 'Boat Sales', acctCode: 'REV-7001' },
    { rawLabel: 'Vessel Sales', acctCode: 'REV-7001' },
    { rawLabel: 'Brokerage Revenue', acctCode: 'REV-8001' },
    { rawLabel: 'Brokerage Commission', acctCode: 'REV-8001' },
    { rawLabel: 'Restaurant Revenue', acctCode: 'REV-9001' },
    { rawLabel: 'Food & Beverage', acctCode: 'REV-9001' },
    { rawLabel: 'Bar Revenue', acctCode: 'REV-9001' },
    { rawLabel: 'Payroll Expense', acctCode: 'OPEX-9001' },
    { rawLabel: 'Salaries & Wages', acctCode: 'OPEX-9001' },
    { rawLabel: 'Employee Benefits', acctCode: 'OPEX-9001' },
    { rawLabel: 'Utility Expense', acctCode: 'OPEX-9002' },
    { rawLabel: 'Electric Expense', acctCode: 'OPEX-9002' },
    { rawLabel: 'Water & Sewer', acctCode: 'OPEX-9002' },
    { rawLabel: 'Insurance Expense', acctCode: 'OPEX-9003' },
    { rawLabel: 'Property Tax', acctCode: 'OPEX-9004' },
    { rawLabel: 'Real Estate Taxes', acctCode: 'OPEX-9004' },
    { rawLabel: 'Repairs & Maintenance', acctCode: 'OPEX-9005' },
    { rawLabel: 'R&M', acctCode: 'OPEX-9005' },
    { rawLabel: 'Marketing Expense', acctCode: 'OPEX-9006' },
    { rawLabel: 'Advertising', acctCode: 'OPEX-9006' },
    { rawLabel: 'Legal Fees', acctCode: 'OPEX-9007' },
    { rawLabel: 'Accounting Fees', acctCode: 'OPEX-9007' },
    { rawLabel: 'Professional Fees', acctCode: 'OPEX-9007' },
    { rawLabel: 'Office Supplies', acctCode: 'OPEX-9008' },
    { rawLabel: 'Office Expense', acctCode: 'OPEX-9008' },
    { rawLabel: 'Software Expense', acctCode: 'OPEX-9009' },
    { rawLabel: 'Dredging Expense', acctCode: 'OPEX-9010' },
    { rawLabel: 'Security Expense', acctCode: 'OPEX-9011' },
    { rawLabel: 'Depreciation', acctCode: 'OPEX-9016' },
    { rawLabel: 'Amortization', acctCode: 'OPEX-9016' },
    { rawLabel: 'Interest Expense', acctCode: 'OPEX-9017' },
    { rawLabel: 'Management Fee', acctCode: 'OPEX-9018' },
  ];

  if (aliasDefs.length > 0) {
    await db.insert(coaGlobalAliases).values(
      aliasDefs.map(a => ({
        packId,
        rawLabel: a.rawLabel,
        normalizedLabel: normalizeLabel(a.rawLabel),
        canonicalAccountId: acctMap.get(a.acctCode)!,
        confidenceHint: (a.confidence ?? 0.95).toString(),
      }))
    );
  }

  const ruleDefs: Array<{
    name: string;
    priority: number;
    ruleType: 'KEYWORD' | 'REGEX' | 'VENDOR' | 'CLASS_LOCATION' | 'COMPOSITE';
    pattern: string;
    excludes?: string;
    outputAcctCode: string;
    outputPcCode: string;
    outputScCode?: string;
    baseConfidence: string;
    explanationTemplate: string;
  }> = [
    { name: 'Dockage/Slip Revenue', priority: 10, ruleType: 'KEYWORD', pattern: 'dockage|slip|berth|mooring', excludes: 'expense|cost|maintenance', outputAcctCode: 'REV-1101', outputPcCode: 'PC-100', outputScCode: 'SC-110', baseConfidence: '0.88', explanationTemplate: 'Matched dockage/slip keyword in account label → Storage / Wet Slips revenue' },
    { name: 'Fuel Revenue', priority: 20, ruleType: 'KEYWORD', pattern: 'fuel|gas|diesel|petroleum|valvtect', excludes: 'cost|cogs|purchase|expense', outputAcctCode: 'REV-2101', outputPcCode: 'PC-200', baseConfidence: '0.87', explanationTemplate: 'Matched fuel keyword with revenue context → Fuel revenue' },
    { name: 'Fuel COGS', priority: 21, ruleType: 'KEYWORD', pattern: 'fuel|gas|diesel|petroleum', excludes: 'revenue|income|sale', outputAcctCode: 'COGS-2001', outputPcCode: 'PC-200', baseConfidence: '0.87', explanationTemplate: 'Matched fuel keyword with COGS/expense context → Fuel COGS' },
    { name: 'Haul-out / Travel Lift', priority: 30, ruleType: 'KEYWORD', pattern: 'haul|haulout|launch|travel lift|travelift|crane', excludes: 'expense|cost', outputAcctCode: 'REV-3301', outputPcCode: 'PC-300', outputScCode: 'SC-330', baseConfidence: '0.88', explanationTemplate: 'Matched haul-out/travel lift keyword → Service / Haul-out revenue' },
    { name: 'Service/Mechanical Revenue', priority: 40, ruleType: 'KEYWORD', pattern: 'mechanic|service labor|engine repair|tech labor', excludes: 'cost|cogs|expense', outputAcctCode: 'REV-3101', outputPcCode: 'PC-300', outputScCode: 'SC-310', baseConfidence: '0.85', explanationTemplate: 'Matched service/mechanical keyword → Service revenue' },
    { name: 'Ship Store/Retail Revenue', priority: 50, ruleType: 'KEYWORD', pattern: 'ship store|chandlery|retail|marine store', excludes: 'cost|cogs', outputAcctCode: 'REV-4101', outputPcCode: 'PC-400', baseConfidence: '0.87', explanationTemplate: 'Matched retail/ship store keyword → Retail revenue' },
    { name: 'Retail COGS', priority: 51, ruleType: 'KEYWORD', pattern: 'retail|merchandise|store|chandlery', excludes: 'revenue|income|sale', outputAcctCode: 'COGS-4001', outputPcCode: 'PC-400', baseConfidence: '0.85', explanationTemplate: 'Matched retail keyword with COGS context → Retail COGS' },
    { name: 'Commercial Tenant Lease', priority: 60, ruleType: 'KEYWORD', pattern: 'commercial lease|tenant rent|commercial rent|office rent|leased space', outputAcctCode: 'REV-5001', outputPcCode: 'PC-500', baseConfidence: '0.85', explanationTemplate: 'Matched commercial lease keyword → Commercial Lease revenue' },
    { name: 'Boat Club Membership', priority: 70, ruleType: 'KEYWORD', pattern: 'boat club|membership dues|club dues', outputAcctCode: 'REV-6501', outputPcCode: 'PC-650', baseConfidence: '0.87', explanationTemplate: 'Matched boat club keyword → Boat Club revenue' },
    { name: 'Boat Sales Revenue', priority: 80, ruleType: 'KEYWORD', pattern: 'boat sale|vessel sale|new boat|used boat', excludes: 'cost|cogs', outputAcctCode: 'REV-7001', outputPcCode: 'PC-700', baseConfidence: '0.85', explanationTemplate: 'Matched boat sales keyword → Boat Sales revenue' },
    { name: 'Brokerage Commission', priority: 90, ruleType: 'KEYWORD', pattern: 'brokerage|broker commission', outputAcctCode: 'REV-8001', outputPcCode: 'PC-800', baseConfidence: '0.85', explanationTemplate: 'Matched brokerage keyword → Brokerage revenue' },
    { name: 'F&B Revenue', priority: 100, ruleType: 'KEYWORD', pattern: 'restaurant|food|beverage|bar|grill|cafe|f&b', excludes: 'cost|cogs', outputAcctCode: 'REV-9001', outputPcCode: 'PC-900', baseConfidence: '0.85', explanationTemplate: 'Matched F&B keyword → Hospitality / F&B revenue' },
    { name: 'Payroll', priority: 200, ruleType: 'KEYWORD', pattern: 'payroll|salary|wage|compensation|benefits|fica|workers comp', outputAcctCode: 'OPEX-9001', outputPcCode: 'PC-999', baseConfidence: '0.87', explanationTemplate: 'Matched payroll keyword → G&A / Payroll' },
    { name: 'Utilities', priority: 210, ruleType: 'KEYWORD', pattern: 'utility|utilities|electric|water|sewer|power', excludes: 'revenue|income|shore power', outputAcctCode: 'OPEX-9002', outputPcCode: 'PC-999', baseConfidence: '0.87', explanationTemplate: 'Matched utilities keyword → G&A / Utilities' },
    { name: 'Insurance Expense', priority: 220, ruleType: 'KEYWORD', pattern: 'insurance', excludes: 'revenue|income|commission|f&i', outputAcctCode: 'OPEX-9003', outputPcCode: 'PC-999', baseConfidence: '0.87', explanationTemplate: 'Matched insurance keyword → G&A / Insurance' },
    { name: 'Property Tax', priority: 230, ruleType: 'KEYWORD', pattern: 'property tax|real estate tax|ad valorem', outputAcctCode: 'OPEX-9004', outputPcCode: 'PC-999', baseConfidence: '0.90', explanationTemplate: 'Matched property tax keyword → G&A / Property Taxes' },
    { name: 'Repairs & Maintenance', priority: 240, ruleType: 'KEYWORD', pattern: 'repair|maintenance|r&m', excludes: 'revenue|income', outputAcctCode: 'OPEX-9005', outputPcCode: 'PC-999', baseConfidence: '0.85', explanationTemplate: 'Matched R&M keyword → G&A / Repairs & Maintenance' },
    { name: 'Depreciation', priority: 300, ruleType: 'KEYWORD', pattern: 'depreciation|amortization|d&a', outputAcctCode: 'OPEX-9016', outputPcCode: 'PC-999', baseConfidence: '0.90', explanationTemplate: 'Matched depreciation keyword → G&A / D&A' },
    { name: 'Interest Expense', priority: 310, ruleType: 'KEYWORD', pattern: 'interest expense|loan interest|debt service|interest payment', outputAcctCode: 'OPEX-9017', outputPcCode: 'PC-999', baseConfidence: '0.90', explanationTemplate: 'Matched interest keyword → G&A / Interest Expense' },
    { name: 'Class Ship Store Override', priority: 5, ruleType: 'CLASS_LOCATION', pattern: 'ship store|retail', outputAcctCode: 'REV-4101', outputPcCode: 'PC-400', baseConfidence: '0.90', explanationTemplate: 'Class/location explicitly says Ship Store → Retail profit center' },
    { name: 'Class Fuel Override', priority: 5, ruleType: 'CLASS_LOCATION', pattern: 'fuel|gas dock', outputAcctCode: 'REV-2101', outputPcCode: 'PC-200', baseConfidence: '0.90', explanationTemplate: 'Class/location explicitly says Fuel → Fuel profit center' },
    { name: 'Class Service Override', priority: 5, ruleType: 'CLASS_LOCATION', pattern: 'service|yard|mechanical', outputAcctCode: 'REV-3101', outputPcCode: 'PC-300', baseConfidence: '0.88', explanationTemplate: 'Class/location explicitly says Service → Service profit center' },
  ];

  await db.insert(coaMappingRules).values(
    ruleDefs.map(r => ({
      packId,
      name: r.name,
      priority: r.priority,
      ruleType: r.ruleType,
      pattern: r.pattern,
      excludes: r.excludes || null,
      outputCanonicalAccountId: acctMap.get(r.outputAcctCode)!,
      outputProfitCenterId: pcMap.get(r.outputPcCode)!,
      outputSubCenterId: r.outputScCode ? scMap.get(r.outputScCode) || null : null,
      baseConfidence: r.baseConfidence,
      explanationTemplate: r.explanationTemplate,
      isActive: true,
    }))
  );

  console.log(`[COA Seed] Marina taxonomy pack seeded: ${pcInserted.length} profit centers, ${scInserted.length} sub-centers, ${acctInserted.length} canonical accounts, ${aliasDefs.length} global aliases, ${ruleDefs.length} mapping rules`);

  return packId;
}
