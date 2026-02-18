/**
 * PNL Alias Matcher Service
 * Uses the 525+ line item aliases to auto-categorize P&L items
 */

import { db } from '../db';
import { pnlLineItemAliases, pnlCanonicalLineItems } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export interface AliasMatch {
  coaCode: string;
  displayName: string;
  majorGroup: 'Revenue' | 'COGS' | 'OpEx' | 'Payroll' | 'Other';
  subcategoryGroup: string;
  confidence: number;
  matchType: 'exact' | 'normalized' | 'fuzzy';
}

function coaCodeToTier(coaCode: string): 'revenue' | 'cogs' | 'expense' {
  if (coaCode.startsWith('REV_')) return 'revenue';
  if (coaCode.startsWith('COGS_')) return 'cogs';
  return 'expense';
}

function subcategoryToDept(subcategory: string): string {
  const mapping: Record<string, string> = {
    'Storage': 'storage',
    'Fuel': 'fuel',
    'Marina & Amenities': 'marina_amenities',
    'Ship Store/Retail': 'ship_store_retail',
    'Service': 'service',
    'Parts': 'parts',
    'Third-Party Leases': 'third_party_leases',
    'Boat Club': 'boat_club',
    'Boat Rentals': 'boat_rentals',
    'Boat Sales': 'boat_sales',
    'Boat Brokerage': 'boat_brokerage',
    'Boat Finance': 'boat_finance',
    'F&B': 'fb',
    'RV Park': 'rv_park',
    'Hospitality/Lodging': 'hospitality_lodging',
    'Miscellaneous': 'miscellaneous',
    'Payroll': 'payroll',
    'General & Administrative': 'general_admin',
    'Advertising': 'advertising',
    'Repairs & Maintenance': 'repairs_maintenance',
    'Utilities': 'utilities',
    'Licenses & Permits': 'licenses_permits',
    'Security & Contract Services': 'security_contract_services',
    'Bank & CC Fees': 'bank_cc_fees',
    'Professional Services': 'professional_services',
    'Insurance': 'insurance',
    'Taxes': 'taxes',
    'Leases': 'leases',
  };
  return mapping[subcategory] || 'miscellaneous';
}

const DEPT_TO_SUBCATEGORY: Record<string, string> = {
  storage: 'Storage',
  fuel: 'Fuel',
  marina_amenities: 'Marina & Amenities',
  ship_store_retail: 'Ship Store/Retail',
  service: 'Service',
  parts: 'Parts',
  third_party_leases: 'Third-Party Leases',
  boat_club: 'In-House Boat Club',
  boat_rentals: 'Boat Rentals',
  boat_sales: 'Boat Sales',
  boat_brokerage: 'Boat Brokerage',
  boat_finance: 'Boat Finance',
  fb: 'F&B',
  rv_park: 'RV Park',
  hospitality_lodging: 'Hospitality/Lodging',
  miscellaneous: 'Miscellaneous',
  payroll: 'Payroll',
  general_admin: 'General & Administrative',
  advertising: 'Advertising',
  repairs_maintenance: 'Repairs & Maintenance',
  utilities: 'Utilities',
  licenses_permits: 'Licenses & Permits',
  security_contract_services: 'Security & Contract Services',
  bank_cc_fees: 'Bank/Credit Card Fees',
  professional_services: 'Professional Services',
  insurance: 'Insurance',
  taxes: 'Property Taxes',
  leases: 'Leases',
};

const TIER_TO_MAJOR_GROUP: Record<string, string> = {
  revenue: 'Revenue',
  cogs: 'COGS',
  expense: 'OpEx',
};

let coaCodeCache: Map<string, string> | null = null;

async function loadCoaCodeCache() {
  if (coaCodeCache) return;
  
  const items = await db.select({
    majorGroup: pnlCanonicalLineItems.majorGroup,
    subcategoryGroup: pnlCanonicalLineItems.subcategoryGroup,
    coaCode: pnlCanonicalLineItems.coaCode,
  }).from(pnlCanonicalLineItems).where(eq(pnlCanonicalLineItems.isActive, true));
  
  coaCodeCache = new Map();
  for (const item of items) {
    const key = `${item.majorGroup}:${item.subcategoryGroup}`;
    coaCodeCache.set(key, item.coaCode);
  }
}

export async function buildCoaCode(
  categoryTier: 'revenue' | 'cogs' | 'expense',
  dept: string | null
): Promise<string> {
  await loadCoaCodeCache();
  
  const majorGroup = TIER_TO_MAJOR_GROUP[categoryTier] || 'OpEx';
  const subcategory = dept ? (DEPT_TO_SUBCATEGORY[dept] || 'Miscellaneous') : 'Miscellaneous';
  
  const key = `${majorGroup}:${subcategory}`;
  const coaCode = coaCodeCache?.get(key);
  
  if (coaCode) return coaCode;
  
  // Fallback to miscellaneous for tier
  const fallbackKey = `${majorGroup}:Miscellaneous`;
  return coaCodeCache?.get(fallbackKey) || `${majorGroup === 'Revenue' ? 'REV' : majorGroup === 'COGS' ? 'COGS' : 'OPEX'}_MISCELLANEOUS`;
}

function normalizeLabel(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

let aliasCache: Map<string, { coaCode: string; confidence: number }> | null = null;
let canonicalCache: Map<string, { displayName: string; majorGroup: string; subcategoryGroup: string }> | null = null;

async function loadCaches() {
  if (aliasCache && canonicalCache) return;

  const aliases = await db.select().from(pnlLineItemAliases).where(eq(pnlLineItemAliases.isActive, true));
  aliasCache = new Map();
  for (const alias of aliases) {
    aliasCache.set(alias.normalizedLabel, { coaCode: alias.canonicalCoaCode, confidence: parseFloat(alias.confidence || '1.0') });
  }

  const canonicals = await db.select().from(pnlCanonicalLineItems).where(eq(pnlCanonicalLineItems.isActive, true));
  canonicalCache = new Map();
  for (const item of canonicals) {
    canonicalCache.set(item.coaCode, { displayName: item.displayName, majorGroup: item.majorGroup, subcategoryGroup: item.subcategoryGroup });
  }

  console.log(`[AliasMatcher] Loaded ${aliasCache.size} aliases and ${canonicalCache.size} canonical items`);
}

export async function findAliasMatch(rawText: string, sectionHint?: 'income' | 'cogs' | 'expense'): Promise<AliasMatch | null> {
  await loadCaches();
  if (!aliasCache || !canonicalCache) return null;

  const normalized = normalizeLabel(rawText);

  // Exact normalized match
  const exactMatch = aliasCache.get(normalized);
  if (exactMatch) {
    const canonical = canonicalCache.get(exactMatch.coaCode);
    if (canonical) {
      return {
        coaCode: exactMatch.coaCode,
        displayName: canonical.displayName,
        majorGroup: canonical.majorGroup as AliasMatch['majorGroup'],
        subcategoryGroup: canonical.subcategoryGroup,
        confidence: exactMatch.confidence,
        matchType: 'exact',
      };
    }
  }

  // Fuzzy match
  const words = normalized.split(' ').filter(w => w.length > 2);
  let bestMatch: { coaCode: string; confidence: number } | null = null;

  for (const [aliasLabel, aliasData] of aliasCache.entries()) {
    let matchCount = 0;
    for (const word of words) {
      if (aliasLabel.includes(word)) matchCount++;
    }
    if (matchCount > 0) {
      const score = matchCount / Math.max(words.length, aliasLabel.split(' ').length);
      if (!bestMatch || score > bestMatch.confidence) {
        bestMatch = { coaCode: aliasData.coaCode, confidence: score * 0.8 };
      }
    }
  }

  if (bestMatch && bestMatch.confidence > 0.4) {
    const canonical = canonicalCache.get(bestMatch.coaCode);
    if (canonical) {
      return {
        coaCode: bestMatch.coaCode,
        displayName: canonical.displayName,
        majorGroup: canonical.majorGroup as AliasMatch['majorGroup'],
        subcategoryGroup: canonical.subcategoryGroup,
        confidence: bestMatch.confidence,
        matchType: 'fuzzy',
      };
    }
  }

  // Section hint fallback
  if (sectionHint) {
    const fallbackCode = sectionHint === 'income' ? 'REV_MISCELLANEOUS' : sectionHint === 'cogs' ? 'COGS_MISCELLANEOUS' : 'OPEX_MISCELLANEOUS';
    const fallbackGroup = sectionHint === 'income' ? 'Revenue' : sectionHint === 'cogs' ? 'COGS' : 'OpEx';
    return {
      coaCode: fallbackCode,
      displayName: 'Miscellaneous',
      majorGroup: fallbackGroup as AliasMatch['majorGroup'],
      subcategoryGroup: 'Miscellaneous',
      confidence: 0.3,
      matchType: 'fuzzy',
    };
  }

  return null;
}

export function getMatchResult(match: AliasMatch): {
  categoryTier: 'revenue' | 'cogs' | 'expense';
  revenueCogsDept: string | null;
  expenseDept: string | null;
} {
  const tier = coaCodeToTier(match.coaCode);
  const dept = subcategoryToDept(match.subcategoryGroup);
  return {
    categoryTier: tier,
    revenueCogsDept: tier === 'revenue' || tier === 'cogs' ? dept : null,
    expenseDept: tier === 'expense' ? dept : null,
  };
}

export async function clearAliasCache() {
  aliasCache = null;
  canonicalCache = null;
}

export async function promoteHighFrequencyAliasesToGlobal(): Promise<number> {
  const PROMOTION_THRESHOLD = 3;
  
  try {
    const orgScopedAliases = await db.select()
      .from(pnlLineItemAliases)
      .where(and(
        eq(pnlLineItemAliases.source, 'user_learned'),
        eq(pnlLineItemAliases.isActive, true)
      ));
    
    const labelGroups = new Map<string, { coaCodes: Map<string, number>; orgCount: Set<string> }>();
    
    for (const alias of orgScopedAliases) {
      const key = alias.normalizedLabel;
      if (!labelGroups.has(key)) {
        labelGroups.set(key, { coaCodes: new Map(), orgCount: new Set() });
      }
      const group = labelGroups.get(key)!;
      if (alias.orgId) group.orgCount.add(alias.orgId);
      const count = group.coaCodes.get(alias.canonicalCoaCode) || 0;
      group.coaCodes.set(alias.canonicalCoaCode, count + (alias.timesUsed || 1));
    }
    
    let promoted = 0;
    
    for (const [normalizedLabel, group] of labelGroups) {
      if (group.orgCount.size < PROMOTION_THRESHOLD) continue;
      
      let bestCode = '';
      let bestCount = 0;
      for (const [code, count] of group.coaCodes) {
        if (count > bestCount) {
          bestCode = code;
          bestCount = count;
        }
      }
      
      if (!bestCode) continue;
      
      const existingGlobal = await db.select()
        .from(pnlLineItemAliases)
        .where(and(
          eq(pnlLineItemAliases.normalizedLabel, normalizedLabel),
          eq(pnlLineItemAliases.source, 'global_promoted')
        ))
        .limit(1);
      
      if (existingGlobal.length > 0) {
        await db.update(pnlLineItemAliases)
          .set({
            canonicalCoaCode: bestCode,
            confidence: '0.92',
            timesUsed: bestCount,
            lastUsedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(pnlLineItemAliases.id, existingGlobal[0].id));
      } else {
        const sampleAlias = orgScopedAliases.find(a => a.normalizedLabel === normalizedLabel);
        await db.insert(pnlLineItemAliases)
          .values({
            orgId: null,
            rawLabel: sampleAlias?.rawLabel || normalizedLabel,
            normalizedLabel,
            canonicalCoaCode: bestCode,
            source: 'global_promoted',
            confidence: '0.92',
            timesUsed: bestCount,
            lastUsedAt: new Date(),
          });
      }
      
      promoted++;
    }
    
    if (promoted > 0) {
      aliasCache = null;
      console.log(`[AliasMatcher] Promoted ${promoted} aliases to global scope`);
    }
    
    return promoted;
  } catch (err) {
    console.error('[AliasMatcher] Global promotion failed:', err);
    return 0;
  }
}

export async function learnAlias(
  rawLabel: string,
  canonicalCoaCode: string,
  orgId: string
): Promise<{ created: boolean; updated: boolean; aliasId: string }> {
  const normalized = normalizeLabel(rawLabel);
  
  // First check for org-scoped user_learned alias
  const orgExisting = await db.select()
    .from(pnlLineItemAliases)
    .where(and(
      eq(pnlLineItemAliases.normalizedLabel, normalized),
      eq(pnlLineItemAliases.orgId, orgId),
      eq(pnlLineItemAliases.source, 'user_learned')
    ))
    .limit(1);
  
  if (orgExisting.length > 0) {
    const alias = orgExisting[0];
    if (alias.canonicalCoaCode === canonicalCoaCode) {
      // Same mapping - just update usage stats
      await db.update(pnlLineItemAliases)
        .set({ 
          timesUsed: (alias.timesUsed || 0) + 1,
          lastUsedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(pnlLineItemAliases.id, alias.id));
      return { created: false, updated: true, aliasId: alias.id };
    }
    
    // Different mapping for same label - update the alias
    await db.update(pnlLineItemAliases)
      .set({ 
        canonicalCoaCode,
        timesUsed: (alias.timesUsed || 0) + 1,
        lastUsedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(pnlLineItemAliases.id, alias.id));
    
    aliasCache = null;
    return { created: false, updated: true, aliasId: alias.id };
  }
  
  // No org-scoped alias exists - create a new one (even if system/global alias exists)
  const newAlias = await db.insert(pnlLineItemAliases)
    .values({
      orgId,
      rawLabel,
      normalizedLabel: normalized,
      canonicalCoaCode,
      source: 'user_learned',
      confidence: '0.95',
      timesUsed: 1,
      lastUsedAt: new Date(),
    })
    .returning({ id: pnlLineItemAliases.id });
  
  aliasCache = null;
  
  return { created: true, updated: false, aliasId: newAlias[0].id };
}
