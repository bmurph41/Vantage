import { db } from '../db';
import { pnlCanonicalLineItems, pnlKeywordRules } from '@shared/schema';
import { eq, and, or, isNull } from 'drizzle-orm';

export interface CoaSeedItem {
  canonicalKey: string;
  displayName: string;
  department: string;
  section: 'revenue' | 'cogs' | 'expense' | 'payroll' | 'other';
  sortOrder: number;
  parentKey?: string;
  keywords?: string[];
}

export const MARINA_COA_SEED: CoaSeedItem[] = [
  { canonicalKey: 'revenue.storage.wet_slip', displayName: 'Wet Slip Rentals', department: 'Storage', section: 'revenue', sortOrder: 100, keywords: ['wet slip', 'slip rental', 'dock rental', 'berth', 'mooring', 'dockage'] },
  { canonicalKey: 'revenue.storage.dry_storage', displayName: 'Dry Storage', department: 'Storage', section: 'revenue', sortOrder: 110, keywords: ['dry storage', 'rack storage', 'indoor storage', 'land storage'] },
  { canonicalKey: 'revenue.storage.covered_storage', displayName: 'Covered Storage', department: 'Storage', section: 'revenue', sortOrder: 120, keywords: ['covered storage', 'covered rack'] },
  { canonicalKey: 'revenue.storage.trailer_storage', displayName: 'Trailer Storage', department: 'Storage', section: 'revenue', sortOrder: 130, keywords: ['trailer storage', 'trailer parking'] },
  { canonicalKey: 'revenue.storage.transient', displayName: 'Transient Dockage', department: 'Storage', section: 'revenue', sortOrder: 140, keywords: ['transient', 'visitor', 'guest dock', 'short term'] },
  { canonicalKey: 'revenue.storage.live_aboard', displayName: 'Live Aboard Fees', department: 'Storage', section: 'revenue', sortOrder: 150, keywords: ['live aboard', 'liveaboard'] },
  { canonicalKey: 'revenue.storage.other', displayName: 'Other Storage Income', department: 'Storage', section: 'revenue', sortOrder: 190, keywords: ['other storage', 'misc storage'] },

  { canonicalKey: 'revenue.fuel.gas', displayName: 'Gasoline Sales', department: 'Fuel', section: 'revenue', sortOrder: 200, keywords: ['gasoline', 'gas sales', 'regular fuel', '87 octane', '89 octane', '91 octane'] },
  { canonicalKey: 'revenue.fuel.diesel', displayName: 'Diesel Sales', department: 'Fuel', section: 'revenue', sortOrder: 210, keywords: ['diesel', 'diesel fuel'] },
  { canonicalKey: 'revenue.fuel.other', displayName: 'Other Fuel Income', department: 'Fuel', section: 'revenue', sortOrder: 290, keywords: ['fuel surcharge', 'pump fee', 'fuel handling'] },

  { canonicalKey: 'revenue.service.repair', displayName: 'Boat Repair Revenue', department: 'Service', section: 'revenue', sortOrder: 300, keywords: ['repair', 'boat repair', 'mechanical', 'engine repair'] },
  { canonicalKey: 'revenue.service.labor', displayName: 'Service Labor', department: 'Service', section: 'revenue', sortOrder: 310, keywords: ['labor', 'service labor', 'mechanic labor', 'technician'] },
  { canonicalKey: 'revenue.service.bottom_paint', displayName: 'Bottom Paint Services', department: 'Service', section: 'revenue', sortOrder: 320, keywords: ['bottom paint', 'antifouling', 'hull paint'] },
  { canonicalKey: 'revenue.service.detailing', displayName: 'Detailing Services', department: 'Service', section: 'revenue', sortOrder: 330, keywords: ['detailing', 'wash', 'cleaning', 'wax'] },
  { canonicalKey: 'revenue.service.winterization', displayName: 'Winterization Services', department: 'Service', section: 'revenue', sortOrder: 340, keywords: ['winterization', 'winterize', 'shrink wrap', 'dewinterization'] },
  { canonicalKey: 'revenue.service.rigging', displayName: 'Rigging Services', department: 'Service', section: 'revenue', sortOrder: 350, keywords: ['rigging', 'sailboat rigging', 'mast'] },
  { canonicalKey: 'revenue.service.other', displayName: 'Other Service Revenue', department: 'Service', section: 'revenue', sortOrder: 390, keywords: ['other service', 'misc service'] },

  { canonicalKey: 'revenue.marina.launch_haul', displayName: 'Launch & Haul Fees', department: 'Marina & Amenities', section: 'revenue', sortOrder: 400, keywords: ['launch', 'haul', 'haul out', 'launch fee', 'crane', 'travel lift'] },
  { canonicalKey: 'revenue.marina.power_electric', displayName: 'Electric/Power Charges', department: 'Marina & Amenities', section: 'revenue', sortOrder: 410, keywords: ['electric', 'power', 'shore power', 'metered electric'] },
  { canonicalKey: 'revenue.marina.water', displayName: 'Water Charges', department: 'Marina & Amenities', section: 'revenue', sortOrder: 420, keywords: ['water', 'fresh water', 'water hookup'] },
  { canonicalKey: 'revenue.marina.pump_out', displayName: 'Pump Out Fees', department: 'Marina & Amenities', section: 'revenue', sortOrder: 430, keywords: ['pump out', 'sewage', 'holding tank'] },
  { canonicalKey: 'revenue.marina.ice', displayName: 'Ice Sales', department: 'Marina & Amenities', section: 'revenue', sortOrder: 440, keywords: ['ice', 'bagged ice', 'block ice'] },
  { canonicalKey: 'revenue.marina.laundry', displayName: 'Laundry Income', department: 'Marina & Amenities', section: 'revenue', sortOrder: 450, keywords: ['laundry', 'coin op', 'washer', 'dryer'] },
  { canonicalKey: 'revenue.marina.shower', displayName: 'Shower/Restroom Fees', department: 'Marina & Amenities', section: 'revenue', sortOrder: 460, keywords: ['shower', 'restroom', 'bathroom'] },
  { canonicalKey: 'revenue.marina.wifi', displayName: 'WiFi/Internet', department: 'Marina & Amenities', section: 'revenue', sortOrder: 470, keywords: ['wifi', 'internet', 'cable'] },
  { canonicalKey: 'revenue.marina.parking', displayName: 'Parking Income', department: 'Marina & Amenities', section: 'revenue', sortOrder: 480, keywords: ['parking', 'car parking', 'vehicle storage'] },
  { canonicalKey: 'revenue.marina.other', displayName: 'Other Marina Income', department: 'Marina & Amenities', section: 'revenue', sortOrder: 490, keywords: ['other marina', 'misc marina', 'ancillary'] },

  { canonicalKey: 'revenue.store.merchandise', displayName: "Ship's Store Merchandise", department: "Ship's Store", section: 'revenue', sortOrder: 500, keywords: ['merchandise', 'store sales', 'chandlery', 'ship store'] },
  { canonicalKey: 'revenue.store.apparel', displayName: 'Apparel Sales', department: "Ship's Store", section: 'revenue', sortOrder: 510, keywords: ['apparel', 'clothing', 't-shirt', 'hat'] },
  { canonicalKey: 'revenue.store.parts', displayName: 'Parts Sales', department: "Ship's Store", section: 'revenue', sortOrder: 520, keywords: ['parts', 'boat parts', 'marine parts'] },
  { canonicalKey: 'revenue.store.snacks', displayName: 'Snacks & Beverages', department: "Ship's Store", section: 'revenue', sortOrder: 530, keywords: ['snacks', 'beverages', 'food', 'drinks', 'soda', 'beer', 'wine'] },
  { canonicalKey: 'revenue.store.bait', displayName: 'Bait & Tackle', department: "Ship's Store", section: 'revenue', sortOrder: 540, keywords: ['bait', 'tackle', 'fishing', 'lure'] },
  { canonicalKey: 'revenue.store.other', displayName: 'Other Store Revenue', department: "Ship's Store", section: 'revenue', sortOrder: 590, keywords: ['other store', 'misc retail'] },

  { canonicalKey: 'revenue.boat_sales.new', displayName: 'New Boat Sales', department: 'Boat Sales', section: 'revenue', sortOrder: 600, keywords: ['new boat', 'boat sales'] },
  { canonicalKey: 'revenue.boat_sales.used', displayName: 'Used Boat Sales', department: 'Boat Sales', section: 'revenue', sortOrder: 610, keywords: ['used boat', 'pre-owned'] },
  { canonicalKey: 'revenue.boat_sales.brokerage', displayName: 'Brokerage Commissions', department: 'Boat Brokerage', section: 'revenue', sortOrder: 620, keywords: ['brokerage', 'commission', 'broker fee'] },

  { canonicalKey: 'cogs.fuel.gas', displayName: 'Cost of Gas', department: 'Fuel', section: 'cogs', sortOrder: 700, keywords: ['cost of gas', 'gasoline cost', 'fuel cost'] },
  { canonicalKey: 'cogs.fuel.diesel', displayName: 'Cost of Diesel', department: 'Fuel', section: 'cogs', sortOrder: 710, keywords: ['cost of diesel', 'diesel cost'] },
  { canonicalKey: 'cogs.store.merchandise', displayName: 'Store COGS', department: "Ship's Store", section: 'cogs', sortOrder: 720, keywords: ['merchandise cost', 'store cost', 'inventory cost', 'cost of goods'] },
  { canonicalKey: 'cogs.service.parts', displayName: 'Parts Cost', department: 'Service', section: 'cogs', sortOrder: 730, keywords: ['parts cost', 'materials cost', 'supplies cost'] },
  { canonicalKey: 'cogs.boat_sales', displayName: 'Boat Sales COGS', department: 'Boat Sales', section: 'cogs', sortOrder: 740, keywords: ['boat cost', 'inventory boat'] },

  { canonicalKey: 'payroll.wages.management', displayName: 'Management Salaries', department: 'Payroll', section: 'payroll', sortOrder: 800, keywords: ['management salary', 'manager salary', 'executive pay'] },
  { canonicalKey: 'payroll.wages.dock_staff', displayName: 'Dock Staff Wages', department: 'Payroll', section: 'payroll', sortOrder: 810, keywords: ['dock staff', 'dockhand', 'dock master', 'harbor master'] },
  { canonicalKey: 'payroll.wages.service_tech', displayName: 'Service Technician Wages', department: 'Payroll', section: 'payroll', sortOrder: 820, keywords: ['technician', 'mechanic wage', 'service labor'] },
  { canonicalKey: 'payroll.wages.retail', displayName: 'Retail Staff Wages', department: 'Payroll', section: 'payroll', sortOrder: 830, keywords: ['retail staff', 'store clerk', 'cashier'] },
  { canonicalKey: 'payroll.wages.admin', displayName: 'Administrative Wages', department: 'Payroll', section: 'payroll', sortOrder: 840, keywords: ['admin', 'office staff', 'bookkeeper'] },
  { canonicalKey: 'payroll.wages.other', displayName: 'Other Wages', department: 'Payroll', section: 'payroll', sortOrder: 890, keywords: ['other wages', 'misc wages', 'temp labor'] },
  { canonicalKey: 'payroll.taxes', displayName: 'Payroll Taxes', department: 'Payroll', section: 'payroll', sortOrder: 900, keywords: ['payroll tax', 'fica', 'suta', 'futa', 'employer tax'] },
  { canonicalKey: 'payroll.benefits.health', displayName: 'Health Insurance', department: 'Payroll', section: 'payroll', sortOrder: 910, keywords: ['health insurance', 'medical', 'health benefit'] },
  { canonicalKey: 'payroll.benefits.retirement', displayName: 'Retirement Benefits', department: 'Payroll', section: 'payroll', sortOrder: 920, keywords: ['401k', 'retirement', 'pension'] },
  { canonicalKey: 'payroll.benefits.other', displayName: 'Other Benefits', department: 'Payroll', section: 'payroll', sortOrder: 930, keywords: ['other benefit', 'pto', 'vacation pay', 'bonus'] },
  { canonicalKey: 'payroll.workers_comp', displayName: "Workers' Compensation", department: 'Payroll', section: 'payroll', sortOrder: 940, keywords: ['workers comp', 'work comp', 'wc insurance'] },

  { canonicalKey: 'expense.insurance.property', displayName: 'Property Insurance', department: 'General', section: 'expense', sortOrder: 1000, keywords: ['property insurance', 'building insurance'] },
  { canonicalKey: 'expense.insurance.liability', displayName: 'Liability Insurance', department: 'General', section: 'expense', sortOrder: 1010, keywords: ['liability', 'general liability', 'gl insurance'] },
  { canonicalKey: 'expense.insurance.marine', displayName: 'Marine Insurance', department: 'General', section: 'expense', sortOrder: 1020, keywords: ['marine insurance', 'hull insurance', 'marina liability'] },
  { canonicalKey: 'expense.insurance.other', displayName: 'Other Insurance', department: 'General', section: 'expense', sortOrder: 1090, keywords: ['other insurance', 'misc insurance'] },

  { canonicalKey: 'expense.taxes.property', displayName: 'Property Taxes', department: 'General', section: 'expense', sortOrder: 1100, keywords: ['property tax', 'real estate tax'] },
  { canonicalKey: 'expense.taxes.sales', displayName: 'Sales Tax Expense', department: 'General', section: 'expense', sortOrder: 1110, keywords: ['sales tax'] },
  { canonicalKey: 'expense.taxes.other', displayName: 'Other Taxes & Licenses', department: 'General', section: 'expense', sortOrder: 1190, keywords: ['license', 'permit', 'franchise tax'] },

  { canonicalKey: 'expense.utilities.electric', displayName: 'Electric Expense', department: 'General', section: 'expense', sortOrder: 1200, keywords: ['electric', 'electricity', 'power bill'] },
  { canonicalKey: 'expense.utilities.water_sewer', displayName: 'Water & Sewer', department: 'General', section: 'expense', sortOrder: 1210, keywords: ['water', 'sewer', 'water bill'] },
  { canonicalKey: 'expense.utilities.gas', displayName: 'Natural Gas/Propane', department: 'General', section: 'expense', sortOrder: 1220, keywords: ['natural gas', 'propane', 'heating'] },
  { canonicalKey: 'expense.utilities.trash', displayName: 'Trash/Waste Removal', department: 'General', section: 'expense', sortOrder: 1230, keywords: ['trash', 'waste', 'garbage', 'dumpster'] },
  { canonicalKey: 'expense.utilities.phone', displayName: 'Phone & Internet', department: 'General', section: 'expense', sortOrder: 1240, keywords: ['phone', 'telephone', 'internet', 'cable', 'wifi'] },
  { canonicalKey: 'expense.utilities.other', displayName: 'Other Utilities', department: 'General', section: 'expense', sortOrder: 1290, keywords: ['other utilities', 'misc utilities'] },

  { canonicalKey: 'expense.repairs.dock', displayName: 'Dock Repairs & Maintenance', department: 'General', section: 'expense', sortOrder: 1300, keywords: ['dock repair', 'dock maintenance', 'piling', 'bulkhead'] },
  { canonicalKey: 'expense.repairs.building', displayName: 'Building Repairs', department: 'General', section: 'expense', sortOrder: 1310, keywords: ['building repair', 'building maintenance', 'roof', 'hvac'] },
  { canonicalKey: 'expense.repairs.equipment', displayName: 'Equipment Repairs', department: 'General', section: 'expense', sortOrder: 1320, keywords: ['equipment repair', 'travel lift', 'forklift', 'crane repair'] },
  { canonicalKey: 'expense.repairs.grounds', displayName: 'Grounds Maintenance', department: 'General', section: 'expense', sortOrder: 1330, keywords: ['grounds', 'landscaping', 'parking lot', 'paving'] },
  { canonicalKey: 'expense.repairs.other', displayName: 'Other R&M', department: 'General', section: 'expense', sortOrder: 1390, keywords: ['other repair', 'misc maintenance', 'r&m'] },

  { canonicalKey: 'expense.marketing.advertising', displayName: 'Advertising', department: 'General', section: 'expense', sortOrder: 1400, keywords: ['advertising', 'ads', 'marketing', 'promotion'] },
  { canonicalKey: 'expense.marketing.website', displayName: 'Website & Digital', department: 'General', section: 'expense', sortOrder: 1410, keywords: ['website', 'digital', 'seo', 'social media'] },
  { canonicalKey: 'expense.marketing.events', displayName: 'Events & Shows', department: 'General', section: 'expense', sortOrder: 1420, keywords: ['boat show', 'event', 'trade show', 'open house'] },
  { canonicalKey: 'expense.marketing.other', displayName: 'Other Marketing', department: 'General', section: 'expense', sortOrder: 1490, keywords: ['other marketing', 'misc marketing'] },

  { canonicalKey: 'expense.professional.legal', displayName: 'Legal Fees', department: 'General', section: 'expense', sortOrder: 1500, keywords: ['legal', 'attorney', 'lawyer'] },
  { canonicalKey: 'expense.professional.accounting', displayName: 'Accounting Fees', department: 'General', section: 'expense', sortOrder: 1510, keywords: ['accounting', 'cpa', 'bookkeeping', 'audit'] },
  { canonicalKey: 'expense.professional.consulting', displayName: 'Consulting Fees', department: 'General', section: 'expense', sortOrder: 1520, keywords: ['consulting', 'consultant'] },
  { canonicalKey: 'expense.professional.other', displayName: 'Other Professional Fees', department: 'General', section: 'expense', sortOrder: 1590, keywords: ['other professional', 'misc professional'] },

  { canonicalKey: 'expense.admin.office', displayName: 'Office Supplies', department: 'General', section: 'expense', sortOrder: 1600, keywords: ['office supplies', 'office expense', 'stationery'] },
  { canonicalKey: 'expense.admin.software', displayName: 'Software & Subscriptions', department: 'General', section: 'expense', sortOrder: 1610, keywords: ['software', 'subscription', 'saas', 'marina software'] },
  { canonicalKey: 'expense.admin.bank_fees', displayName: 'Bank & Credit Card Fees', department: 'General', section: 'expense', sortOrder: 1620, keywords: ['bank fee', 'credit card fee', 'merchant fee', 'processing fee'] },
  { canonicalKey: 'expense.admin.dues', displayName: 'Dues & Memberships', department: 'General', section: 'expense', sortOrder: 1630, keywords: ['dues', 'membership', 'association'] },
  { canonicalKey: 'expense.admin.travel', displayName: 'Travel & Entertainment', department: 'General', section: 'expense', sortOrder: 1640, keywords: ['travel', 'entertainment', 'meals'] },
  { canonicalKey: 'expense.admin.other', displayName: 'Other Administrative', department: 'General', section: 'expense', sortOrder: 1690, keywords: ['other admin', 'misc admin', 'miscellaneous'] },

  { canonicalKey: 'expense.depreciation', displayName: 'Depreciation', department: 'General', section: 'expense', sortOrder: 1700, keywords: ['depreciation', 'amortization'] },
  { canonicalKey: 'expense.interest', displayName: 'Interest Expense', department: 'General', section: 'expense', sortOrder: 1710, keywords: ['interest', 'loan interest', 'mortgage interest'] },
  { canonicalKey: 'expense.rent', displayName: 'Rent/Lease Expense', department: 'General', section: 'expense', sortOrder: 1720, keywords: ['rent', 'lease', 'land lease', 'ground rent'] },
  { canonicalKey: 'expense.bad_debt', displayName: 'Bad Debt Expense', department: 'General', section: 'expense', sortOrder: 1730, keywords: ['bad debt', 'write off', 'uncollectible'] },
];

export async function seedMarinaCoa(orgId: string): Promise<{ coaCount: number; keywordCount: number }> {
  const existingItems = await db.query.pnlCanonicalLineItems.findMany({
    where: eq(pnlCanonicalLineItems.orgId, orgId),
  });

  const existingKeys = new Set(existingItems.map(item => item.canonicalKey));
  const coaToInsert = MARINA_COA_SEED.filter(item => !existingKeys.has(item.canonicalKey));

  if (coaToInsert.length > 0) {
    await db.insert(pnlCanonicalLineItems).values(
      coaToInsert.map(item => ({
        orgId,
        canonicalKey: item.canonicalKey,
        displayName: item.displayName,
        department: item.department,
        section: item.section,
        sortOrder: item.sortOrder,
        isActive: true,
      }))
    );
  }

  const allItems = await db.query.pnlCanonicalLineItems.findMany({
    where: eq(pnlCanonicalLineItems.orgId, orgId),
  });
  const keyMap = new Map(allItems.map(item => [item.canonicalKey, item.id]));

  const existingRules = await db.query.pnlKeywordRules.findMany({
    where: or(eq(pnlKeywordRules.orgId, orgId), isNull(pnlKeywordRules.orgId)),
  });
  const existingKeywords = new Set(existingRules.map(r => r.keyword.toLowerCase()));

  const keywordsToInsert: Array<{
    orgId: string | null;
    department: string;
    bucket: string;
    keyword: string;
    matchType: string;
    priority: number;
    canonicalLineItemId: string | null;
    isActive: boolean;
    source: string;
  }> = [];

  for (const item of MARINA_COA_SEED) {
    if (!item.keywords) continue;
    const canonicalId = keyMap.get(item.canonicalKey);
    const bucket = item.section === 'cogs' ? 'COGS' :
                   item.section === 'revenue' ? 'Revenue' :
                   item.section === 'payroll' ? 'Expense' : 'Expense';

    for (const keyword of item.keywords) {
      if (existingKeywords.has(keyword.toLowerCase())) continue;
      existingKeywords.add(keyword.toLowerCase());

      keywordsToInsert.push({
        orgId: null,
        department: item.department,
        bucket,
        keyword: keyword.toLowerCase(),
        matchType: keyword.includes(' ') ? 'phrase' : 'token',
        priority: 100,
        canonicalLineItemId: canonicalId ?? null,
        isActive: true,
        source: 'seed',
      });
    }
  }

  if (keywordsToInsert.length > 0) {
    await db.insert(pnlKeywordRules).values(keywordsToInsert).onConflictDoNothing();
  }

  return {
    coaCount: coaToInsert.length,
    keywordCount: keywordsToInsert.length,
  };
}

export async function getCoaStats(orgId: string): Promise<{
  totalItems: number;
  bySection: Record<string, number>;
  byDepartment: Record<string, number>;
}> {
  const items = await db.query.pnlCanonicalLineItems.findMany({
    where: eq(pnlCanonicalLineItems.orgId, orgId),
  });

  const bySection: Record<string, number> = {};
  const byDepartment: Record<string, number> = {};

  for (const item of items) {
    bySection[item.section] = (bySection[item.section] || 0) + 1;
    byDepartment[item.department] = (byDepartment[item.department] || 0) + 1;
  }

  return {
    totalItems: items.length,
    bySection,
    byDepartment,
  };
}
