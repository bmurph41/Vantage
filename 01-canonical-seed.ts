// =============================================================================
// FILE: server/services/pnl/canonical-seed.ts
//
// Seeds pnlCanonicalLineItems for an org from the multi-asset Chart of Accounts
// defined in shared/direct-input-coa.ts.
//
// Called automatically on first PNL upload per org.
// Safe to call multiple times — uses onConflictDoNothing.
// =============================================================================

import { db } from '../../db';
import { pnlCanonicalLineItems } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

// All 16 supported asset classes
const ALL_ASSET_CLASSES = [
  'str', 'sfr', 'residential_multi', 'multifamily', 'hotel', 'marina',
  'self_storage', 'mobile_home_park', 'office', 'retail', 'industrial',
  'mixed_use', 'car_wash', 'rv_park', 'senior_housing', 'medical_office',
];

// Map COA field group label → pnlCanonicalLineItems section
const GROUP_TO_SECTION: Record<string, string> = {
  'Revenue Assumptions':    'revenue',
  'Other Revenue':          'revenue',
  'Operating Expenses':     'expense',
  'Fixed Expenses':         'expense',
  'Management':             'expense',
  'Reserves':               'expense',
  'COGS':                   'cogs',
  'Cost of Goods Sold':     'cogs',
  'Payroll':                'payroll',
  'Fuel':                   'cogs',
  'Storage':                'revenue',
  'Service':                'expense',
};

function groupToSection(group: string | undefined, category: 'revenue' | 'expense'): string {
  if (group && GROUP_TO_SECTION[group]) return GROUP_TO_SECTION[group];
  return category === 'revenue' ? 'revenue' : 'expense';
}

// Additional universal line items that appear across all asset classes
// but may not be in individual COA arrays
const UNIVERSAL_ITEMS = [
  { key: 'annualPropertyTax',   label: 'Property Tax',          category: 'expense' as const, section: 'expense', group: 'Fixed Expenses' },
  { key: 'annualInsurance',     label: 'Insurance',             category: 'expense' as const, section: 'expense', group: 'Fixed Expenses' },
  { key: 'annualMaintenance',   label: 'Maintenance & Repairs', category: 'expense' as const, section: 'expense', group: 'Operating Expenses' },
  { key: 'annualCapEx',         label: 'Capital Reserves',      category: 'expense' as const, section: 'expense', group: 'Reserves' },
  { key: 'annualPayroll',       label: 'Payroll & Benefits',    category: 'expense' as const, section: 'payroll', group: 'Payroll' },
  { key: 'annualUtilities',     label: 'Utilities',             category: 'expense' as const, section: 'expense', group: 'Operating Expenses' },
  { key: 'annualMarketing',     label: 'Marketing & Advertising',category:'expense' as const, section: 'expense', group: 'Operating Expenses' },
  { key: 'annualAdmin',         label: 'Admin & General',       category: 'expense' as const, section: 'expense', group: 'Operating Expenses' },
  { key: 'managementFeePct',    label: 'Management Fee',        category: 'expense' as const, section: 'expense', group: 'Management' },
  { key: 'annualOtherIncome',   label: 'Other Income',          category: 'revenue' as const, section: 'revenue', group: 'Other Revenue' },
  { key: 'vacancyLoss',         label: 'Vacancy Loss',          category: 'revenue' as const, section: 'revenue', group: 'Revenue Assumptions' },
  { key: 'grossRevenue',        label: 'Gross Revenue',         category: 'revenue' as const, section: 'revenue', group: 'Revenue Assumptions' },
  { key: 'netRevenue',          label: 'Net Revenue',           category: 'revenue' as const, section: 'revenue', group: 'Revenue Assumptions' },
  { key: 'totalRevenue',        label: 'Total Revenue',         category: 'revenue' as const, section: 'revenue', group: 'Revenue Assumptions' },
  { key: 'totalExpenses',       label: 'Total Expenses',        category: 'expense' as const, section: 'expense', group: 'Operating Expenses' },
  { key: 'noi',                 label: 'Net Operating Income',  category: 'expense' as const, section: 'other',   group: 'Operating Expenses' },
  { key: 'ebitda',              label: 'EBITDA',                category: 'expense' as const, section: 'other',   group: 'Operating Expenses' },
];

export interface SeedResult {
  inserted: number;
  skipped: number;
  total: number;
}

export async function ensurePnlCanonicalItemsSeeded(orgId: string): Promise<SeedResult> {
  // Check if already seeded for this org (quick count)
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pnlCanonicalLineItems)
    .where(eq(pnlCanonicalLineItems.orgId, orgId));

  if ((countRow?.count ?? 0) >= 30) {
    // Already seeded — skip
    return { inserted: 0, skipped: countRow.count, total: countRow.count };
  }

  return seedPnlCanonicalItems(orgId);
}

export async function seedPnlCanonicalItems(orgId: string): Promise<SeedResult> {
  // Dynamically import to avoid circular deps at module load time
  const { getCOAFields } = await import('@shared/direct-input-coa');

  // Collect unique keys across all asset classes (first-seen label wins)
  const seen = new Map<string, {
    label: string;
    section: string;
    department: string;
    sortOrder: number;
  }>();

  let sortOrder = 0;

  // Seed from each asset class COA
  for (const assetClass of ALL_ASSET_CLASSES) {
    try {
      const fields = getCOAFields(assetClass);
      for (const field of fields) {
        if (!seen.has(field.key)) {
          seen.set(field.key, {
            label: field.label,
            section: groupToSection(field.group, field.category),
            department: 'General',
            sortOrder: sortOrder++,
          });
        }
      }
    } catch (_e) {
      // Unknown asset class — skip silently
    }
  }

  // Add universal items not covered by COA arrays
  for (const item of UNIVERSAL_ITEMS) {
    if (!seen.has(item.key)) {
      seen.set(item.key, {
        label: item.label,
        section: item.section,
        department: 'General',
        sortOrder: sortOrder++,
      });
    }
  }

  const items = Array.from(seen.entries()).map(([key, meta]) => ({
    orgId,
    canonicalKey: key,
    displayName: meta.label,
    department: meta.department,
    section: meta.section,
    sortOrder: meta.sortOrder,
    isActive: true,
  }));

  let inserted = 0;
  let skipped = 0;

  // Batch insert in chunks of 50 to avoid query size limits
  const CHUNK = 50;
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    try {
      const result = await db
        .insert(pnlCanonicalLineItems)
        .values(chunk)
        .onConflictDoNothing()
        .returning({ id: pnlCanonicalLineItems.id });
      inserted += result.length;
      skipped += chunk.length - result.length;
    } catch (e) {
      console.warn('[PNL Seed] Chunk insert error:', (e as Error).message);
      skipped += chunk.length;
    }
  }

  console.log(`[PNL Seed] org=${orgId} inserted=${inserted} skipped=${skipped} total=${items.length}`);
  return { inserted, skipped, total: items.length };
}
